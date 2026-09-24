"""Create local readable evidence and compact review indexes from cached mail."""
import collections
import json
import pathlib
import re
from prepare_email_knowledge import normalized

OUT = pathlib.Path(__file__).resolve().parents[1]/'.tools/email-knowledge'

def concise(text):
    text = re.split(r'(?im)^\s*(?:kind regards|best regards|regards|sincerely|warm regards|confidentiality notice|disclaimer)\s*[,!:]?\s*$',text)[0]
    text = re.sub(r'(?im)^\s*(?:\[cid:.*|\[image.*|[|_\-=]{4,}.*)$','',text)
    return re.sub(r'\n{3,}','\n\n',text).strip()

def main():
    rows = [json.loads(x) for x in (OUT/'messages.jsonl').read_text(encoding='utf-8').strip().split('\n')]
    groups = collections.defaultdict(list)
    for r in rows:
        groups[normalized(r['subject'])].append(r)
    index, evidence, review = [], [], []
    for i,(subject,messages) in enumerate(groups.items(),1):
        gid = f'G{i:03d}'
        automatic = bool(re.match(r'(?i)(automatic reply|auto.?reply|out of office|undeliverable|read:)',subject))
        blocks = []
        for r in sorted(messages,key=lambda x:x['date']):
            text = concise(r['text'])
            blocks.append({'ref':r['ref'],'date':r['date'],'text':text})
            evidence.append(f"## {r['ref']} | {gid} | {r['date']}\nSubject: {r['subject']}\n\n{text}\n")
        index.append({'group':gid,'subject':subject,'messages':len(messages),'automatic':automatic,'characters':sum(len(x['text']) for x in blocks),'refs':[r['ref'] for r in messages]})
        review.append({'group':gid,'subject':subject,'messages':blocks})
    (OUT/'review_groups.json').write_text(json.dumps(review,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'review_index.json').write_text(json.dumps(index,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'private_evidence.md').write_text('# Private email evidence\n\nNot for shared embeddings: may contain personal/customer information. Subject groups may combine distinct conversations. Text is cleaned and quoted history may be absent.\n\n'+'\n'.join(evidence),encoding='utf-8')
    print(json.dumps({'groups':len(index),'automatic_groups':sum(x['automatic'] for x in index),'evidence_chars':sum(x['characters'] for x in index)}))

if __name__=='__main__':
    main()
