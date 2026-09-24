"""Expand the local pilot without AI/API calls. Cache each fetched body immediately."""
import collections
import argparse
import hashlib
import json
import pathlib
import random
import re
import win32com.client

ROOT = pathlib.Path(__file__).resolve().parents[1]
OLD = ROOT / '.tools/email-pilot'
OUT = ROOT / '.tools/email-knowledge'
TARGET = 1100

def normalized(subject):
    return re.sub(r'^(?:(?:re|fw|fwd):\s*)+', '', subject, flags=re.I).strip().lower()

def clean(text):
    text = text.replace('\r\n', '\n').replace('\ufeff','')
    text = re.split(r'(?im)^\s*(?:From:|On .{5,180}wrote:|Sent from my |Get Outlook for )', text)[0]
    text = re.sub(r'(?im)^>.*$', '', text)
    text = re.sub(r'https?://\S+', '[URL]', text)
    text = re.sub(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', '[EMAIL]', text)
    text = re.sub(r'(?im)^\s*(?:confidentiality notice|this email (?:message )?is (?:intended|for the sole)).*', '', text)
    return re.sub(r'\n[ \t]*\n(?:[ \t]*\n)+','\n\n',text).strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--target', type=int, default=TARGET)
    target = parser.parse_args().target
    OUT.mkdir(parents=True, exist_ok=True)
    cache = OUT/'messages.jsonl'
    if not cache.exists():
        old = [json.loads(x) for x in (OLD/'sample.jsonl').read_text(encoding='utf-8').strip().split('\n')]
        for r in old:
            r['cleaning_version'] = 'pilot-v1'
        cache.write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in old),encoding='utf-8')
    records = [json.loads(x) for x in cache.read_text(encoding='utf-8').strip().split('\n')]
    seen = {r['source_id'] for r in records}
    metadata = json.loads((OLD/'metadata.json').read_text(encoding='utf-8'))
    groups = collections.defaultdict(list)
    for m in metadata:
        groups[normalized(m['subject']) or m['id']].append(m)
    buckets = collections.defaultdict(list)
    for key, rows in groups.items():
        first = min(rows,key=lambda x:x['created'])
        buckets[(first['folder'],first['created'][:7])].append(key)
    rng = random.Random(20260922)
    for keys in buckets.values():
        rng.shuffle(keys)
    order = []
    while any(buckets.values()):
        for b in sorted(buckets):
            if buckets[b]:
                order.append(buckets[b].pop())
    if len(records) < target:
        ns = win32com.client.Dispatch('Outlook.Application').GetNamespace('MAPI')
        pst = str((ROOT/'backup.pst').resolve())
        store = next((s for s in ns.Stores if s.FilePath.lower()==pst.lower()),None)
        attached = store is None
        if attached:
            ns.AddStoreEx(pst,2)
            store = next(s for s in ns.Stores if s.FilePath.lower()==pst.lower())
        errors = []
        try:
            with cache.open('a',encoding='utf-8') as f:
                for key in order:
                    if len(records) >= target:
                        break
                    rows = sorted(groups[key],key=lambda x:x['created'])
                    chosen = rows if len(rows)<=10 else rows[:3]+rows[-7:]
                    for m in chosen:
                        if len(records)>=target:
                            break
                        if m['id'] in seen:
                            continue
                        try:
                            mail = ns.GetItemFromID(m['id'],store.StoreID)
                            body = mail.Body or ''
                            try:
                                cid = str(mail.ConversationID)
                            except Exception:
                                cid = ''
                            r = {'source_id':m['id'],'thread_id':hashlib.sha256(key.encode()).hexdigest()[:16], 'outlook_conversation_id':cid, 'folder':m['folder'],'subject':m['subject'],'date':str(mail.SentOn),'text':clean(body),'raw_characters':len(body),'cleaning_version':'v2','thread_sample_incomplete':len(chosen)<len(rows),'resolution_confirmed':None,'requires_privacy_review':True}
                            f.write(json.dumps(r,ensure_ascii=False)+'\n'); f.flush()
                            records.append(r); seen.add(m['id'])
                            if len(records)%100==0:
                                print(f'Cached {len(records)} messages',flush=True)
                        except Exception as e:
                            errors.append({'source_id':m['id'],'error_type':type(e).__name__})
            (OUT/'extraction_errors.json').write_text(json.dumps(errors,indent=2),encoding='utf-8')
        finally:
            if attached:
                ns.RemoveStore(store.GetRootFolder())
    # Stable local reference IDs for readable evidence; no source IDs in shared guidance.
    for i,r in enumerate(records,1):
        r['ref'] = f'E{i:04d}'
    cache.write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in records),encoding='utf-8')
    summary = {'messages_cached':len(records),'unique_source_ids':len(seen),'nonempty_cleaned_bodies':sum(bool(r['text']) for r in records),'subject_groups':len({normalized(r['subject']) for r in records}),'cleaned_characters':sum(len(r['text']) for r in records),'date_min':min(r['date'] for r in records),'date_max':max(r['date'] for r in records),'external_ai_calls':0,'attachments_read':0,'embeddings_created':0}
    (OUT/'extraction_summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(json.dumps(summary,indent=2))

if __name__=='__main__':
    main()
