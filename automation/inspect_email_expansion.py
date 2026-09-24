"""Compact local review of only the newly cached messages; no API calls."""
import argparse
import collections
import json
import pathlib
import re

OUT = pathlib.Path(__file__).resolve().parents[1]/'.tools/email-knowledge'

def trim(text):
    text = re.split(r'(?im)^\s*(?:kind regards|best regards|regards|sincerely|thank you[,!.]?\s*$|thanks[,!.]?\s*$|cheers[,!.]?\s*$|[^\n]{2,65}\|\s*DCX|Raza Iqbal\s*$|David Gilpin\s*$|Roger Marok\s*$|Tylour Yeo\s*$|Harmeet Sangha\s*$|confidentiality notice)',text)[0]
    text = re.sub(r'(?i)(password|passwd|token|api.key)\s*[:=]\s*\S+',r'\1: [REMOVED]',text)
    return re.sub(r'\s+',' ',text).strip()

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--groups',nargs='*')
    parser.add_argument('--cap',type=int,default=1200)
    args=parser.parse_args()
    rows=[json.loads(x) for x in (OUT/'messages.jsonl').read_text(encoding='utf-8').strip().split('\n')]
    groups=collections.defaultdict(list)
    for r in rows[1100:]:
        key=re.sub(r'^(?:(?:re|fw|fwd):\s*)+','',r['subject'],flags=re.I).strip().lower()
        groups[key].append(r)
    review=[]
    for i,(subject,messages) in enumerate(groups.items(),1):
        gid=f'N{i:03d}'
        review.append({'group':gid,'subject':subject,'refs':[r['ref'] for r in messages]})
        if args.groups:
            if gid not in args.groups:
                continue
            print('\n'+gid+' '+ascii(subject))
            for m in sorted(messages,key=lambda x:x['date']):
                text=trim(m['text'])
                if len(text)>65:
                    print(m['ref'],m['date'][:10],ascii(text[:args.cap]),'[TRUNCATED]' if len(text)>args.cap else '')
        elif not re.search(r'(?i)automatic reply|auto.?reply|out of office|password|payroll|passport|enrolment|zoominfo|invitation|newsletter|undeliverable',subject):
            print(gid,len(messages),sum(len(trim(m['text'])) for m in messages),ascii(subject))
    (OUT/'expansion_review_index.json').write_text(json.dumps(review,ensure_ascii=False,indent=2),encoding='utf-8')

if __name__=='__main__':
    main()
