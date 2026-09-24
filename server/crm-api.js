import { createClient } from '@supabase/supabase-js';
import { createHash, timingSafeEqual } from 'node:crypto';
import { configuration, getSession } from './auth-core.js';
import { validatePriceBook } from './rates-model.js';
import { entities, uuid, validateRecord } from './crm-model.js';
import { validateProposal } from './proposal-model.js';

const respond = (res, status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
const equal = (a, b) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
async function bodyOf(req) {
  let raw = '';
  if (req.body !== undefined) raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  else for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 32768) throw new Error('Record is too large.'); }
  if (Buffer.byteLength(raw) > 32768) throw new Error('Record is too large.');
  return JSON.parse(raw || '{}');
}
async function allRows(db, entity, customerId) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    let query = db.from(`crm_${entity}`).select('*').order('id').range(offset, offset + 499);
    if (customerId) query = query.eq('customer_id', customerId);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
export async function crmHandler(req, res, env = process.env, injectedDb) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const url = new URL(req.url, 'http://localhost');
  const action = url.searchParams.get('action');
  const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
  const automation = action === 'lookup' && req.method === 'GET' && (env.AUTOMATION_API_TOKEN || '').length >= 32 && equal(token, env.AUTOMATION_API_TOKEN);
  if (!automation && !getSession(req, configuration(env))) return respond(res, 401, { error: 'Please sign in to access customer records.' });
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) return respond(res, 405, { error: 'Method not allowed.' });
  if (req.method !== 'GET') {
    const origin = `${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://${req.headers.host}`;
    if (req.headers.origin !== origin || req.headers['sec-fetch-site'] === 'cross-site') return respond(res, 403, { error: 'Request origin is not allowed.' });
  }
  if (!injectedDb && (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY)) return respond(res, 503, { error: 'Supabase is not configured. Follow docs/supabase-setup-guide.md.', code: 'NOT_CONFIGURED' });
  try {
    const db = injectedDb || createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    if(action==='proposals') {
      const checked=async q=>{const {data,error}=await q;if(error)throw error;return data;};
      if(req.method==='GET') {
        const customerId=url.searchParams.get('customer_id');
        if(!uuid(customerId))return respond(res,400,{error:'Select a customer.'});
        return respond(res,200,{records:await checked(db.from('crm_proposals').select('*').eq('customer_id',customerId).order('created_at',{ascending:false}).limit(100))});
      }
      let input,content;
      try {input=await bodyOf(req);content=validateProposal(input.content);if(!uuid(input.customer_id))throw new Error('Select a customer.');}
      catch(e){return respond(res,400,{error:e.message});}
      let record;
      if(req.method==='POST') {
        const customer=await checked(db.from('crm_customers').select('id,name,contact,email,phone,billing_address').eq('id',input.customer_id).single());
        record=await checked(db.from('crm_proposals').insert({customer_id:customer.id,title:content.title,customer_snapshot:customer,content,template_key:'basic-v1'}).select().single());
      } else {
        if(!uuid(input.id)||!Number.isSafeInteger(input.version)||input.version<1)return respond(res,400,{error:'Reload the proposal before saving.'});
        record=await checked(db.from('crm_proposals').update({title:content.title,content,version:input.version+1,updated_at:new Date().toISOString()}).eq('id',input.id).eq('customer_id',input.customer_id).eq('version',input.version).select().maybeSingle());
        if(!record)return respond(res,409,{error:'This proposal changed elsewhere. Reopen it before saving. Your edits have not been saved.'});
      }
      return respond(res,req.method==='POST'?201:200,{record});
    }
    if (action === 'rates') {
      if (req.method === 'PATCH') return respond(res, 405, { error: 'Rate versions are immutable. Save a new version.' });
      if (req.method === 'GET') {
        const rows = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await db.from('calculator_rate_versions').select('*').order('version', { ascending: false }).order('book_id').range(offset, offset + 499);
          if (error) throw error;
          rows.push(...data);
          if (data.length < 500) break;
        }
        const seen = new Set(); const books = [], history = [];
        for (const row of rows) {
          const book = { ...row.snapshot, id: row.book_id, version: row.version, updatedAt: row.created_at };
          (seen.has(row.book_id) ? history : books).push(book); seen.add(row.book_id);
        }
        return respond(res, 200, { books, history });
      }
      let input, book;
      try {
        input = await bodyOf(req); book = validatePriceBook(input.book);
        if (input.expectedVersion !== null && (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1)) throw new Error('Refresh rates before saving.');
      } catch (error) { return respond(res, 400, { error: error.message }); }
      const { data: latest, error: readError } = await db.from('calculator_rate_versions').select('version').eq('book_id', book.id).order('version', { ascending: false }).limit(1).maybeSingle();
      if (readError) throw readError;
      if ((latest?.version ?? null) !== input.expectedVersion) return respond(res, 409, { error: 'Rates changed elsewhere. Reload the page before saving; your edits have not been overwritten.' });
      const version = latest ? latest.version + 1 : (Number.isSafeInteger(input.book.version) && input.book.version > 0 && input.book.version < 2147483647 ? input.book.version : 1);
      const { data: saved, error } = await db.from('calculator_rate_versions').insert({ book_id: book.id, version, snapshot: book, saved_by: getSession(req, configuration(env)).email }).select().single();
      if (error?.code === '23505') return respond(res, 409, { error: 'Another rate version was saved. Reload and review before retrying.' });
      if (error) throw error;
      return respond(res, 201, { book: { ...book, version, updatedAt: saved.created_at } });
    }
    if (req.method === 'GET' && action === 'lookup') {
      const email = (url.searchParams.get('email') || '').trim().toLowerCase();
      if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond(res, 400, { error: 'A valid email is required.' });
      const { data: contacts, error } = await db.from('crm_contacts').select('*').eq('email', email);
      if (error) throw error;
      const { data: primary, error: primaryError } = await db.from('crm_customers').select('id').eq('email', email);
      if (primaryError) throw primaryError;
      const ids = [...new Set([...contacts.map(c => c.customer_id), ...primary.map(c => c.id)])];
      if (!ids.length) return respond(res, 200, { status: 'not_found', customer: null, message: 'No exact contact match. Ask for details or review a new contact.' });
      if (ids.length !== 1) return respond(res, 200, { status: 'needs_review', customer: null, message: 'Multiple customer matches. Do not select automatically.' });
      const { data: customer, error: customerError } = await db.from('crm_customers').select('*').eq('id', ids[0]).single();
      if (customerError) throw customerError;
      const history = Object.fromEntries(await Promise.all(Object.keys(entities).filter(e => e !== 'customers').map(async e => [e, await allRows(db, e, customer.id)])));
      return respond(res, 200, { status: 'matched', customer, ...history, message: 'Exact contact match only. Confirm which site/equipment the request concerns; historical ownership is not guaranteed.' });
    }
    const entity = url.searchParams.get('entity') || 'customers';
    if (!Object.hasOwn(entities, entity)) return respond(res, 400, { error: 'Unknown record type.' });
    if (req.method === 'GET') {
      const customerId = url.searchParams.get('customer_id');
      if (entity !== 'customers' && !uuid(customerId)) return respond(res, 400, { error: 'Select a customer.' });
      return respond(res, 200, { records: await allRows(db, entity, entity === 'customers' ? undefined : customerId) });
    }
    let input, record;
    try { input = await bodyOf(req); record = validateRecord(entity, input); }
    catch (error) { return respond(res, 400, { error: error.message }); }
    if (req.method === 'PATCH' && (!uuid(input.id) || typeof input.updated_at !== 'string')) return respond(res, 400, { error: 'Record ID and version are required.' });
    let query = db.from(`crm_${entity}`);
    query = req.method === 'POST' ? query.insert(record) : query.update(record).eq('id', input.id).eq('updated_at', input.updated_at);
    const { data, error } = await query.select().maybeSingle();
    if (error) {
      if (error.code === '23505') return respond(res, 409, { error: 'This contact email or equipment serial number already exists for this customer.' });
      if (error.code === '23503') return respond(res, 400, { error: 'The linked site or equipment must belong to this customer.' });
      throw error;
    }
    if (!data) return respond(res, 409, { error: 'This record changed elsewhere. Close the form, refresh, and try again.' });
    return respond(res, req.method === 'POST' ? 201 : 200, { record: data });
  } catch(error) { return respond(res, 502, { error: action==='proposals'&&['42P01','PGRST205'].includes(error.code)?'Run supabase/migrations/202609240001_reporting_and_proposals.sql in Supabase SQL Editor first.':'Database unavailable. Check the server connection and apply the workspace migrations. No local fallback was saved.' }); }
}
