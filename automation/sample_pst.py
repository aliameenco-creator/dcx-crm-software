"""Local-only, bounded Outlook PST pilot. No AI/network calls; no message writes.
Outputs contain private data and belong only under ignored .tools/.
Run: python automation/sample_pst.py
"""
import collections
import hashlib
import json
import pathlib
import random
import re
import win32com.client

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / '.tools' / 'email-pilot'
OUT.mkdir(parents=True, exist_ok=True)
LIMIT = 200
SEED = 20260922

def save(name, obj):
    (OUT / name).write_text(json.dumps(obj, indent=2, ensure_ascii=False), encoding='utf-8')

def clean(text):
    # Keep only new text; original bodies remain available through local source IDs.
    text = text.replace('\r\n', '\n')
    text = re.split(r'(?im)^\s*(?:From:|On .{5,180}wrote:|[-_]{5,}|Sent from my |Get Outlook for )', text)[0]
    text = '\n'.join(x for x in text.splitlines() if not x.lstrip().startswith('>'))
    text = re.sub(r'https?://\S+', '[URL]', text)
    text = re.sub(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', '[EMAIL]', text)
    text = re.sub(r'\b1Z[A-Z0-9]{16}\b', '[TRACKING]', text, flags=re.I)
    text = re.sub(r'\b\d[\d ()+.-]{7,}\d\b', '[NUMBER]', text)
    text = re.sub(r'\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b', '[POSTCODE]', text, flags=re.I)
    text = re.sub(r'\n{3,}', '\n\n', text).strip()
    return text

RULES = {
    'tracking_delivery': r'\b(track(?:ing)?|delivery|delivered|delayed|where is|not received)\b',
    'billing_payment': r'\b(invoice|billing|payment|charged|refund|credit)\b',
    'customs_import': r'\b(customs|duties|duty|brokerage|clearance|import)\b',
    'quote_shipping': r'\b(quote|quotation|shipping rate|estimate|how much)\b',
    'pickup': r'\b(pickup|pick.up|collection)\b',
    'damage_loss_claim': r'\b(damaged|damage|lost|missing|claim)\b',
    'printing_mailbox': r'\b(printing|copies|mailbox|mail box|scan|laminat)\b',
    'address_return': r'\b(address|return to sender|return label|redirect)\b',
}

def main():
    if (OUT / 'summary.json').exists():
        print((OUT / 'summary.json').read_text(encoding='utf-8'))
        return
    pst = str((ROOT / 'backup.pst').resolve())
    ns = win32com.client.Dispatch('Outlook.Application').GetNamespace('MAPI')
    store = next((s for s in ns.Stores if s.FilePath.lower() == pst.lower()), None)
    attached = store is None
    if attached:
        ns.AddStoreEx(pst, 2)
        store = next(s for s in ns.Stores if s.FilePath.lower() == pst.lower())
    root = store.GetRootFolder()
    metadata, folders, errors = [], [], []
    def walk(folder, path=''):
        path += '/' + folder.Name
        if folder.Name.lower() in {'deleted items','junk email','drafts','calendar','contacts','sync issues','tasks','yammer root'}:
            return
        if folder.DefaultItemType == 0:
            table = folder.GetTable()
            table.Columns.RemoveAll()
            for col in ['EntryID','Subject','MessageClass','CreationTime','LastModificationTime','ConversationID']:
                try:
                    table.Columns.Add(col)
                except Exception:
                    pass
            count = 0
            while not table.EndOfTable and len(metadata) < 20000:
                row = table.GetNextRow()
                def value(key):
                    try:
                        return str(row.Item(key))
                    except Exception:
                        return ''
                if value('MessageClass').startswith('IPM.Note'):
                    metadata.append({'id': value('EntryID'), 'subject': value('Subject'), 'conversation': value('ConversationID'), 'folder': path, 'created': value('CreationTime')})
                    count += 1
            folders.append({'folder': path, 'mail_metadata_rows': count})
        for child in folder.Folders:
            walk(child, path)
    try:
        walk(root)
        save('inventory.json', folders)
        save('metadata.json', metadata)
        # Group by Outlook conversation ID; normalized subject is a fallback, not proof of a thread.
        groups = collections.defaultdict(list)
        for m in metadata:
            fallback = re.sub(r'^(?:(?:re|fw|fwd):\s*)+', '', m['subject'], flags=re.I).strip().lower()
            key = m['conversation'] or fallback or m['id']
            groups[key].append(m)
        strata = collections.defaultdict(list)
        for key, rows in groups.items():
            first = min(rows, key=lambda m:m['created'])
            strata[(first['folder'], first['created'][:7])].append(key)
        rng = random.Random(SEED)
        for keys in strata.values():
            rng.shuffle(keys)
        ordered = []
        while any(strata.values()):
            for bucket in sorted(strata):
                if strata[bucket]:
                    ordered.append(strata[bucket].pop())
        records, seen, raw_chars, cleaned_chars, attempted = [], set(), 0, 0, 0
        for key in ordered:
            if attempted >= LIMIT:
                break
            rows = sorted(groups[key], key=lambda m:m['created'])
            # Bound long threads to first two + last four; mark incomplete.
            chosen = rows if len(rows) <= 6 else rows[:2] + rows[-4:]
            chosen = chosen[:LIMIT-attempted]
            for m in chosen:
                attempted += 1
                try:
                    mail = ns.GetItemFromID(m['id'], store.StoreID)
                    body = mail.Body or ''
                    raw_chars += len(body)
                    cleaned = clean(body)
                    digest = hashlib.sha256(cleaned.encode()).hexdigest()
                    if not cleaned or digest in seen:
                        continue
                    seen.add(digest)
                    clipped = cleaned[:6000]
                    cleaned_chars += len(clipped)
                    text = clean(m['subject']) + '\n' + clipped
                    labels = [label for label, pattern in RULES.items() if re.search(pattern, text, re.I)]
                    records.append({'source_id':m['id'], 'thread_id':hashlib.sha256(key.encode()).hexdigest()[:16], 'folder':m['folder'], 'date':str(mail.SentOn), 'subject':clean(m['subject']), 'text':clipped, 'truncated':len(cleaned)>6000, 'thread_sample_incomplete':len(chosen)<len(rows), 'labels_heuristic':labels or ['other'], 'resolution_confirmed':None, 'requires_privacy_review':True})
                except Exception as e:
                    errors.append({'source_id':m['id'], 'error_type':type(e).__name__})
        (OUT/'sample.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in records),encoding='utf-8')
        counts = collections.Counter(label for r in records for label in r['labels_heuristic'])
        summary = {'metadata_messages':len(metadata),'metadata_limit':20000,'bodies_attempted':attempted,'unique_cleaned_messages':len(records),'sampled_threads':len({r['thread_id'] for r in records}),'raw_body_characters':raw_chars,'cleaned_body_characters':cleaned_chars,'rough_cleaned_tokens_at_4_chars':round(cleaned_chars/4),'external_ai_calls':0,'attachment_contents_read':0,'categories_multi_label_heuristic':dict(counts),'errors':len(errors),'limitations':['Folder/month stratified pilot, not mailbox frequency estimates.','Metadata creation dates used for sampling; message sent dates retained.','Regex redaction is incomplete: names and addresses may remain.','Quoted history stripping may omit context; incomplete threads are flagged.','No resolution has been verified; no embeddings generated.']}
        save('errors.json',errors)
        save('summary.json',summary)
        print(json.dumps(summary,indent=2))
    finally:
        if attached:
            ns.RemoveStore(root)

if __name__ == '__main__':
    main()
