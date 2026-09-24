"""Refine cached pilot categories locally; no AI calls or PST access."""
import collections
import json
import pathlib
import re

OUT = pathlib.Path(__file__).resolve().parents[1] / '.tools' / 'email-pilot'
RULES = {
    'quotes_contracts_renewals': r'\b(quote|quotation|proposal|renewal|renew|contract|agreement|pricing)\b',
    'maintenance_service': r'\b(maintenance|preventative|preventive|servic(?:e|ed|ing)|\bPM\b)\b',
    'scheduling_site_access': r'\b(schedule|scheduling|scheduled|availability|site access|badge|clearance|start.?up|commissioning)\b',
    'technical_battery_equipment': r'\b(batter(?:y|ies)|alarm|fault|bypass|inverter|voltage|kva|runtime|replacement|replace)\b',
    'reports_documentation': r'\b(report|data sheet|datasheet|inspection|documentation|certificate)\b',
    'invoices_payments': r'\b(invoice|payment|overdue|billing|remittance|purchase order)\b',
}

def main():
    records = [json.loads(x) for x in (OUT/'sample.jsonl').read_text(encoding='utf-8').splitlines()]
    for r in records:
        text = r['subject']+'\n'+r['text']
        automatic = bool(re.search(r'(?i)^(automatic reply|auto.?reply|out of office):',r['subject']) or re.search(r'(?i)\b(out of (?:the )?office|automated (?:message|response))\b',r['text'][:300]))
        r['excluded_automatic_reply'] = automatic
        r['labels_heuristic'] = ['automatic_reply'] if automatic else [k for k,p in RULES.items() if re.search(p,text,re.I)] or ['other']
    (OUT/'sample.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in records),encoding='utf-8')
    summary = json.loads((OUT/'summary.json').read_text(encoding='utf-8'))
    summary['categories_multi_label_heuristic'] = dict(collections.Counter(k for r in records for k in r['labels_heuristic']))
    summary['domain_observed'] = 'UPS power systems, maintenance and service (based on brief sample review)'
    summary['automatic_replies_excluded_from_candidates'] = sum(r['excluded_automatic_reply'] for r in records)
    summary['candidate_messages'] = sum(not r['excluded_automatic_reply'] for r in records)
    summary['incomplete_thread_messages'] = sum(r['thread_sample_incomplete'] for r in records)
    (OUT/'summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    (OUT/'candidates.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in records if not r['excluded_automatic_reply']),encoding='utf-8')
    lines = ['# Email pilot results','',f"Read {summary['bodies_attempted']} bodies; retained {len(records)} unique cleaned messages across {summary['sampled_threads']} conversations.",f"Candidate messages after automatic-reply filtering: {summary['candidate_messages']}.",'','Observed domain: UPS power systems, maintenance and service.','', '## Tentative topic counts','', 'Keyword-based, overlapping message counts; not verified customer-query counts.','']
    lines += [f'- {k}: {v}' for k,v in summary['categories_multi_label_heuristic'].items()]
    lines += ['', '## Limits', '', 'No paid AI calls, embeddings, attachment extraction, or database uploads. Only short representative excerpts were inspected in chat. Attachments may contain the actual reports or solutions, so this body-only pilot cannot confirm those outcomes. Private sample files still require privacy review. Incomplete threads and unknown outcomes are flagged.', '', 'Next: validate candidate conversations, extract question/action/outcome records, check against current procedures, and only then embed approved solutions.']
    (OUT/'report.md').write_text('\n'.join(lines),encoding='utf-8')
    print(json.dumps({'candidate_messages':summary['candidate_messages'],'categories':summary['categories_multi_label_heuristic']},indent=2))

if __name__ == '__main__':
    main()
