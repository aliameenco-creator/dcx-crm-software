import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { configuration, getSession } from './auth-core.js';
import { MailError } from './microsoft-graph.js';

const AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const SCOPES = ['openid','profile','email','offline_access','https://graph.microsoft.com/User.Read','https://graph.microsoft.com/Mail.ReadWrite','https://graph.microsoft.com/Mail.Send'];
const COOKIE = 'microsoft_oauth_state';
const respond=(res,status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
const originOf=(req,env)=>env.APP_BASE_URL?.replace(/\/$/,'') || `${env.NODE_ENV==='production'?'https':'http'}://${req.headers.host}`;
export const redirectUri=(req,env)=>env.MICROSOFT_REDIRECT_URI || `${originOf(req,env)}/api/microsoft-oauth-callback`;
const key=env=>createHash('sha256').update(`microsoft-oauth:${env.APP_SESSION_SECRET}`).digest();
export function encryptTokens(value,env){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(env),iv);const body=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),body].map(x=>x.toString('base64url')).join('.');}
export function decryptTokens(value,env){try{const [iv,tag,body,extra]=String(value).split('.').map(x=>Buffer.from(x,'base64url'));if(extra||!iv||!tag||!body)throw 0;const decipher=createDecipheriv('aes-256-gcm',key(env),iv);decipher.setAuthTag(tag);return JSON.parse(Buffer.concat([decipher.update(body),decipher.final()]).toString());}catch{throw new Error('The saved Microsoft connection cannot be decrypted. Reconnect the mailbox.');}}
function stateToken(env){const nonce=randomBytes(24).toString('base64url');const payload=Buffer.from(JSON.stringify({nonce,expires:Date.now()+10*60000})).toString('base64url');return {nonce,value:`${payload}.${createHmac('sha256',env.APP_SESSION_SECRET).update(payload).digest('base64url')}`};}
function verifyState(value,nonce,env){try{const [payload,signature,extra]=String(value).split('.');const expected=createHmac('sha256',env.APP_SESSION_SECRET).update(payload).digest();const actual=Buffer.from(signature,'base64url');if(extra||expected.length!==actual.length||!timingSafeEqual(expected,actual))throw 0;const data=JSON.parse(Buffer.from(payload,'base64url').toString());return data.nonce===nonce&&data.expires>Date.now();}catch{return false;}}
const parseCookies=req=>Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),decodeURIComponent(x.slice(i+1))];}));
const dbFor=(env,injected)=>injected || createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const checked=async query=>{const {data,error}=await query;if(error){const e=new Error(error.message);e.code=error.code;throw e;}return data;};
async function tokenRequest(params,env,transport=fetch){const response=await transport(`${AUTHORITY}/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.MICROSOFT_CLIENT_ID,client_secret:env.MICROSOFT_CLIENT_SECRET,...params}),redirect:'error',signal:AbortSignal.timeout(20000)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new MailError(502,data.error==='invalid_grant'?'Microsoft authorization expired or was revoked. Reconnect the mailbox.':'Microsoft could not complete mailbox authorization.');return data;}
export async function activeMicrosoftConnection(env=process.env,injectedDb){if(!env.SUPABASE_URL||!env.SUPABASE_SECRET_KEY)return null;const db=dbFor(env,injectedDb);return checked(db.from('microsoft_oauth_connections').select('*').eq('is_active',true).maybeSingle());}
const accessCache=new Map();
export async function delegatedGraphClient(env=process.env,injectedDb,transport=fetch){
 if(!injectedDb&&(!env.SUPABASE_URL||!env.SUPABASE_SECRET_KEY))return null;
 const db=dbFor(env,injectedDb),connection=await activeMicrosoftConnection(env,db);if(!connection)return null;
 async function token(){const cached=accessCache.get(connection.id);if(cached?.until>Date.now()+120000)return cached.value;let saved=decryptTokens(connection.token_ciphertext,env),access=saved.access_token,until=Date.parse(connection.token_expires_at);if(!access||until<Date.now()+120000){const refreshed=await tokenRequest({grant_type:'refresh_token',refresh_token:saved.refresh_token,scope:SCOPES.join(' ')},env,transport);saved={access_token:refreshed.access_token,refresh_token:refreshed.refresh_token||saved.refresh_token};access=saved.access_token;until=Date.now()+Number(refreshed.expires_in||3600)*1000;await checked(db.from('microsoft_oauth_connections').update({token_ciphertext:encryptTokens(saved,env),token_expires_at:new Date(until).toISOString(),granted_scopes:String(refreshed.scope||'').split(' ').filter(Boolean),updated_at:new Date().toISOString()}).eq('id',connection.id));}accessCache.set(connection.id,{value:access,until});return access;}
 const root=`${GRAPH}/me`;
 const graph=async(path,{method='GET',body,text=false,etag,raw=false}={})=>{const url=path.startsWith('https://')?path:root+(path.startsWith('/')?path:'/'+path);if(!url.startsWith(root+'/'))throw new MailError(400,'Invalid Microsoft continuation.');let response;try{response=await transport(url,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${await token()}`,'Content-Type':'application/json',Prefer:`IdType="ImmutableId"${text?', outlook.body-content-type="text"':''}`,...(etag?{'If-Match':etag}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});}catch(error){if(error instanceof MailError)throw error;throw new MailError(502,method==='GET'?'Microsoft could not be reached.':'Microsoft did not confirm the action. Check Outlook before retrying.');}if(!response.ok){if(response.status===401)accessCache.delete(connection.id);let detail={};try{detail=await response.json();}catch{}throw new MailError([400,401,403,404,410,412,429].includes(response.status)?response.status:502,detail.error?.message||'Microsoft could not complete the action.',response.headers.get('Retry-After'));}if(raw)return response;return [202,204].includes(response.status)?null:response.json();};
 return {graph,connection};
}
export async function microsoftOAuthHandler(req,res,env=process.env,injected={}){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const url=new URL(req.url,'http://localhost'),action=url.pathname.replace(/\/$/,'').endsWith('/microsoft-oauth-callback')?'callback':url.searchParams.get('action')||'status';
 const session=getSession(req,configuration(env));if(action!=='callback'&&!session)return respond(res,401,{error:'Sign in to connect Microsoft.'});
 if(!env.MICROSOFT_CLIENT_ID||!env.MICROSOFT_CLIENT_SECRET||!env.APP_SESSION_SECRET)return respond(res,503,{error:'Microsoft OAuth client settings are incomplete.'});
 if(!injected.db&&(!env.SUPABASE_URL||!env.SUPABASE_SECRET_KEY))return respond(res,503,{error:'Supabase is required to store the Microsoft connection.'});
 const db=dbFor(env,injected.db),transport=injected.transport||fetch;
 try{
  if(req.method==='GET'&&action==='status'){const records=await checked(db.from('microsoft_oauth_connections').select('id,email_address,display_name,is_active,connected_at,updated_at').order('connected_at',{ascending:false}));return respond(res,200,{connections:records,redirectUri:redirectUri(req,env)});}
  if(req.method==='GET'&&action==='start'){const state=stateToken(env);res.statusCode=302;res.setHeader('Set-Cookie',`${COOKIE}=${encodeURIComponent(state.nonce)}; HttpOnly; SameSite=Lax; Path=/api; Max-Age=600${env.NODE_ENV==='production'?'; Secure':''}`);res.setHeader('Location',`${AUTHORITY}/authorize?${new URLSearchParams({client_id:env.MICROSOFT_CLIENT_ID,response_type:'code',redirect_uri:redirectUri(req,env),response_mode:'query',scope:SCOPES.join(' '),state:state.value,prompt:'select_account'})}`);return res.end();}
  if(req.method==='GET'&&action==='callback'){
   const nonce=parseCookies(req)[COOKIE];if(!verifyState(url.searchParams.get('state'),nonce,env))return respond(res,400,{error:'Microsoft connection request expired. Start again from the dashboard.'});
   if(url.searchParams.get('error'))return respond(res,400,{error:'Microsoft sign-in was cancelled or denied.'});
   const code=url.searchParams.get('code');if(!code)return respond(res,400,{error:'Microsoft did not return an authorization code.'});
   const tokens=await tokenRequest({grant_type:'authorization_code',code,redirect_uri:redirectUri(req,env),scope:SCOPES.join(' ')},env,transport);
   if(!tokens.access_token||!tokens.refresh_token)throw new Error('Microsoft did not grant persistent mailbox access. Reconnect and accept the requested permissions.');
   const profileResponse=await transport(`${GRAPH}/me?$select=id,displayName,mail,userPrincipalName`,{headers:{Authorization:`Bearer ${tokens.access_token}`},redirect:'error'});const profile=await profileResponse.json().catch(()=>({}));if(!profileResponse.ok||!profile.id)throw new Error('Microsoft signed in, but the mailbox profile could not be read.');
   const email=(profile.mail||profile.userPrincipalName||'').toLowerCase();if(!email)throw new Error('The selected Microsoft account has no mailbox address.');
   await checked(db.from('microsoft_oauth_connections').update({is_active:false}).eq('is_active',true));
   const expires=Date.now()+Number(tokens.expires_in||3600)*1000;
   await checked(db.from('microsoft_oauth_connections').upsert({microsoft_account_id:profile.id,email_address:email,display_name:profile.displayName||'',tenant_id:null,token_ciphertext:encryptTokens({access_token:tokens.access_token,refresh_token:tokens.refresh_token},env),granted_scopes:String(tokens.scope||'').split(' ').filter(Boolean),token_expires_at:new Date(expires).toISOString(),is_active:true,updated_at:new Date().toISOString()},{onConflict:'microsoft_account_id'}));
   res.statusCode=302;res.setHeader('Set-Cookie',`${COOKIE}=; HttpOnly; SameSite=Lax; Path=/api; Max-Age=0${env.NODE_ENV==='production'?'; Secure':''}`);res.setHeader('Location',`${originOf(req,env)}/#inbox`);return res.end();
  }
  if(req.method==='POST'){
   const expected=originOf(req,env);if(req.headers.origin!==expected||req.headers['sec-fetch-site']==='cross-site')return respond(res,403,{error:'Request origin is not allowed.'});
   let raw='';if(req.body!==undefined)raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);else for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>10000)throw new Error('Request is too large.');}const input=JSON.parse(raw||'{}');
   if(action==='select'){if(typeof input.id!=='string')throw new Error('Select a Microsoft connection.');const record=await checked(db.from('microsoft_oauth_connections').select('id').eq('id',input.id).maybeSingle());if(!record)return respond(res,404,{error:'Microsoft connection not found.'});await checked(db.from('microsoft_oauth_connections').update({is_active:false}).eq('is_active',true));await checked(db.from('microsoft_oauth_connections').update({is_active:true,updated_at:new Date().toISOString()}).eq('id',input.id));accessCache.clear();return respond(res,200,{ok:true});}
   if(action==='disconnect'){if(typeof input.id!=='string')throw new Error('Select a Microsoft connection.');await checked(db.from('microsoft_oauth_connections').delete().eq('id',input.id));accessCache.delete(input.id);return respond(res,200,{ok:true});}
  }
  return respond(res,400,{error:'Unknown Microsoft connection action.'});
 }catch(error){if(['PGRST205','42P01'].includes(error.code))return respond(res,503,{code:'MIGRATION_REQUIRED',error:'Run supabase/migrations/202609230003_microsoft_oauth.sql, then retry.'});return respond(res,error.status||502,{error:error.message||'Microsoft connection failed.'});}
}
