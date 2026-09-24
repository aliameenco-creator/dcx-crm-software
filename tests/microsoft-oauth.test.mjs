import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createSession } from '../server/auth-core.js';
import { decryptTokens, encryptTokens, microsoftOAuthHandler } from '../server/microsoft-oauth.js';

const env={
  APP_LOGIN_EMAIL:'owner@example.com', APP_LOGIN_PASSWORD:'test-password-long', APP_SESSION_SECRET:'s'.repeat(40),
  MICROSOFT_CLIENT_ID:'client-id', MICROSOFT_CLIENT_SECRET:'client-secret',
  SUPABASE_URL:'https://example.supabase.co', SUPABASE_SECRET_KEY:'service-key', NODE_ENV:'development'
};
const session=`dcx_session=${createSession({email:env.APP_LOGIN_EMAIL,password:env.APP_LOGIN_PASSWORD,secret:env.APP_SESSION_SECRET})}`;

function memoryDb(){
  const rows=[];
  const from=()=>{
    let mode='select',payload,filters=[],fields='*';
    const matching=()=>rows.filter(row=>filters.every(([key,value])=>row[key]===value));
    const run=async()=>{
      if(mode==='update'){for(const row of matching())Object.assign(row,payload);return {data:matching(),error:null};}
      if(mode==='upsert'){const current=rows.find(row=>row.microsoft_account_id===payload.microsoft_account_id);if(current)Object.assign(current,payload);else rows.push({id:'connection-1',connected_at:new Date().toISOString(),...payload});return {data:null,error:null};}
      const selected=matching().map(row=>fields==='*'?{...row}:Object.fromEntries(fields.split(',').map(key=>[key,row[key]])));
      return {data:selected,error:null};
    };
    const query={select(value='*'){fields=value;return query;},eq(key,value){filters.push([key,value]);return query;},update(value){mode='update';payload=value;return query;},upsert(value){mode='upsert';payload=value;return query;},order(){return query;},async maybeSingle(){const result=await run();return {...result,data:result.data[0]||null};},then(resolve,reject){return run().then(resolve,reject);}};
    return query;
  };
  return {rows,from};
}

async function fixture(t,db,transport){
  const server=createServer((req,res)=>microsoftOAuthHandler(req,res,env,{db,transport}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('Microsoft tokens are encrypted at rest',()=>{
  const encrypted=encryptTokens({access_token:'access',refresh_token:'refresh'},env);
  assert.equal(encrypted.includes('access'),false);
  assert.deepEqual(decryptTokens(encrypted,env),{access_token:'access',refresh_token:'refresh'});
});

test('delegated OAuth connects a mailbox through a clean callback route',async t=>{
  const db=memoryDb();
  const transport=async url=>url.includes('/token')
    ? new Response(JSON.stringify({access_token:'access',refresh_token:'refresh',expires_in:3600,scope:'User.Read Mail.ReadWrite Mail.Send'}),{status:200,headers:{'Content-Type':'application/json'}})
    : new Response(JSON.stringify({id:'microsoft-user',displayName:'Mailbox Owner',mail:'owner@outlook.com'}),{status:200,headers:{'Content-Type':'application/json'}});
  const base=await fixture(t,db,transport);
  const start=await fetch(`${base}/api/microsoft-oauth?action=start`,{headers:{Cookie:session},redirect:'manual'});
  assert.equal(start.status,302);
  const authorize=new URL(start.headers.get('location'));
  assert.equal(authorize.pathname.endsWith('/common/oauth2/v2.0/authorize'),true);
  assert.equal(authorize.searchParams.get('redirect_uri'),`${base}/api/microsoft-oauth-callback`);
  assert.match(authorize.searchParams.get('scope'),/Mail\.ReadWrite/);
  assert.match(authorize.searchParams.get('scope'),/User\.Read/);
  const stateCookie=start.headers.get('set-cookie').split(';')[0];
  const callback=await fetch(`${base}/api/microsoft-oauth-callback?code=code&state=${encodeURIComponent(authorize.searchParams.get('state'))}`,{headers:{Cookie:stateCookie},redirect:'manual'});
  assert.equal(callback.status,302);
  assert.equal(db.rows[0].email_address,'owner@outlook.com');
  assert.equal(db.rows[0].is_active,true);
  assert.equal(db.rows[0].token_ciphertext.includes('access'),false);
});
