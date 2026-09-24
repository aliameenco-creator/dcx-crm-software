"""Build concise reference-free text from the 2,100-message local sample.
Private provenance stays in source-audit.json and private_source_lookup.txt.
"""
import collections
import json
import pathlib
import re

OUT=pathlib.Path(__file__).resolve().parents[1]/'.tools/email-knowledge'
DEST=OUT/'deliverables'

# Human-authored condensation of the previous supported answers.
ANSWERS={
'KB-001':'Annual and semi-annual maintenance have been offered. Identify the installed UPS and batteries, agree the scope and visit frequency, obtain commercial approval, then confirm site availability. The appropriate interval depends on the equipment and contract.',
'KB-002':'Ask for a written scope separating UPS checks, battery checks, major/minor visits, reporting and emergency support. Confirm which measurements and tests are included. A battery replacement, voltage check or self-test must not be described as a complete maintenance visit unless that scope was actually performed.',
'KB-003':'Confirm the exact asset, site and room, proposed time, access conditions and assigned technician. Obtain the customer’s acceptance and give the technician the current site contact. For multiple locations, confirm each local contact’s availability rather than assuming a central contact has arranged access everywhere.',
'KB-004':'Check the asset’s latest completion record, not just the planned date. If outstanding, arrange a new visit. If completed, provide the dated service report and recorded findings. A booking or invoice alone does not prove work was done.',
'KB-005':'Ask the service coordinator for the customer-facing report for the correct asset and service date. Obtain an OEM report through the responsible team when necessary. State open recommendations separately and keep internal costing and unrelated asset records out of the customer copy.',
'KB-006':'Explain how your organization authorizes work and pays invoices. POs are commonly requested, but alternative arrangements have been accepted for specific customers. Have sales or finance explicitly approve the arrangement before treating work as authorized.',
'KB-007':'Request a current written quotation for the identified equipment and scope. Clarify equipment, batteries, labour, delivery, disposal, access-related costs and after-hours work where applicable. An estimate should be identified as an estimate.',
'KB-008':'Ask sales to confirm the current quote’s validity and compare revisions for changed parts, quantities, labour or logistics. If the amount changed unexpectedly, request an explanation or corrected quotation before authorizing the order. Match the PO to the accepted revision.',
'KB-009':'Identify the exact UPS and battery arrangement, including internal packs versus external strings/cabinets. Confirm part numbers and quantities per asset, who supplies the batteries, labour scope, delivery and disposal. Have compatibility checked before ordering.',
'KB-010':'Labour-only installation has been quoted for customer-supplied batteries. Confirm the parts, quantity, condition, arrival and storage location, handling needs, access window and disposal responsibility before scheduling.',
'KB-011':'Reconcile the quoted parts and quantities with the installed assets and technician’s report. Record the actual part used for each UPS and have sales resolve any price or PO difference. Similar-looking UPSs may require different battery packs.',
'KB-012':'Obtain a documented comparison against the existing battery and application: voltage, capacity and UPS-rate performance, dimensions, terminals, cabinet/rack fit, charging requirements and warranty. Require technical approval; a similar amp-hour label or lower price does not establish equivalence.',
'KB-013':'Confirm current availability, any discontinuation notice and the approved replacement with the supplier. Recheck compatibility, price and delivery before updating the quotation. Historical product-transition emails are not a current availability list.',
'KB-014':'Confirm parts availability and delivery, crew readiness, access approvals and the customer’s work window before committing to installation. Stock can change before an order is placed. Communicate a provisional date as provisional while any dependency remains open.',
'KB-015':'Notify the service coordinator when batteries arrive and confirm the received quantity, condition and staging location. Agree who receives and moves the shipment into the room, then coordinate installation and removal of old batteries. Delivery alone does not establish readiness or completed installation.',
'KB-016':'Clarify battery-only removal versus removal of the whole UPS or cabinet. Confirm the exact location, route to the loading dock, stairs/elevators, truck restrictions, handling equipment and allowed work hours before quoting.',
'KB-017':'Coordinate disposal pickup with the replacement schedule and site storage restrictions. Confirm pallets/skids, loading-dock reservations and required disposal documentation. Obtain the actual collection or disposal record rather than treating a scheduled pickup as proof.',
'KB-018':'Survey the delivery-to-battery-room route, distance, stairs, elevators, lifting needs and storage. Resolve contradictory survey notes with the site contact or technician. Ask about tailgate/pallet-jack needs, truck size restrictions and delivery appointments.',
'KB-019':'Have the technical lead assess the exact UPS architecture, redundancy, operating state and approved method of procedure. Confirm the expected impact and permitted outage window for this site before committing to online work or downtime.',
'KB-020':'Compare actual outage load, runtime, battery age, charging history and test results. Check whether equipment was added or whether a dual-supply load shifts more demand onto this UPS when another feed fails. That can change runtime from the normal-state estimate, but the actual configuration and battery condition must be assessed.',
'KB-021':'A larger external battery bank can take longer to recharge when the existing UPS charger has limited capacity. Ask the technical team to assess the exact configuration and arrange appropriate follow-up testing. Do not assume an external charger is supported without engineering/OEM approval.',
'KB-022':'Confirm the exact model’s configuration requirements. An external cabinet does not automatically remove the need for internal batteries; a sampled installation still required its internal set to operate.',
'KB-023':'Check the specific asset, battery installation record, applicable warranty or contract and written coverage decision. Resolve uncertain replacement dates from records. A pending renewal PO or a previous customer’s exception does not establish free repair entitlement.',
'KB-024':'Ask for the processed renewal order and issued entitlement showing the actual start and end dates. Distinguish a proposed start date from confirmed coverage and clarify any gap after the old contract expired.',
'KB-025':'Give the service team the exact alarm, affected asset, timing, recent battery work and previous reports. Arrange investigation where needed. An alarm name alone does not establish the cause, warranty coverage or a safe universal reset.',
'KB-026':'Escalate the exact flywheel and UPS symptoms to manufacturer-supported service. The historical case considered a pump issue or leak and later reported a breaker trip during restart; subsequent messages pursued pumps and further investigation. No successful repair was established in that evidence.',
'KB-027':'Confirm the site’s authorized maintenance window and technical risk assessment. Even an offline flywheel may require after-hours work or coordination with annual maintenance. Agree sufficient time and supporting resources with the customer.',
'KB-028':'Request current manufacturer lifecycle recommendations for the exact flywheel and operating history, covering the complete relevant scope rather than assuming a pump repair addresses every aging component. Obtain a model-specific quotation.',
'KB-029':'Confirm the UPS and communication-card model, whether the card is installed, the BMS platform, supported protocol and required point map. Coordinate the controls/IT team and manufacturer service. Obtain the applicable documentation and verify actual communication and alarms before accepting the integration.',
'KB-030':'Coordinate the onsite technician with customer IT to verify the physical connection and approved network addressing. Confirm that the customer can reach the UPS and that required monitoring works before closing the handover. A connected cable alone is insufficient.',
'KB-031':'Confirm equipment delivery, cabinet/string details, physical access and any special site requirements. Plan software configuration with customer IT, using the applicable installation/configuration manuals and an appropriately prepared technician. Hardware installation alone is not complete monitoring commissioning.',
'KB-032':'Ask the service lead to estimate from cabinet design, string count, wiring, existing-versus-new installation and software commissioning scope. Allow for any training or specialist assistance. A prior two-person/day estimate is not a fixed standard for four strings.',
'KB-033':'Plan equipment delivery, cable route and length, setup assistance, authorized test window, test specification, cleanup and rental return. Confirm site and crew availability before committing; setup and removal can require separate work periods.',
'KB-034':'Check the quotation. Power-quality monitoring and infrared inspection are not automatically included in load-bank testing; request them explicitly if needed and agree the equipment, personnel and reporting scope.',
'KB-035':'Provide required load/runtime, input and output requirements, rental period and deadline. Obtain a complete configuration and scope covering batteries, transformers, delivery, installation and removal. For contingency equipment, confirm who authorizes deployment. Reserved or discussed options are not automatically a placed rental order.',
'KB-036':'Assess the current model, load, electrical requirements, runtime, footprint and service history. Request a site-specific replacement proposal covering equipment, batteries, installation and warranty. Do not select a replacement solely from the age of the old UPS.',
'KB-037':'Identify the emergency-lighting application and exact electrical/project requirements. Ask the technical team and supplier for a suitable solution. Do not assume an ordinary UPS or a different phase/voltage system is a valid replacement.',
'KB-038':'Obtain the repair or closure record for the earlier defect. A later visit with no new issues does not prove that a previous fault was repaired. Keep the open recommendation visible until documented closure.',
'KB-039':'Have the service coordinator confirm current availability and contract or time-and-materials terms for the site. Separate telephone response from onsite arrival. Do not turn a historical sales proposal into a guaranteed universal response time.',
'KB-040':'Get the current customer/prime-contractor onboarding checklist. Coordinate required insurance wording, workplace-insurance clearance, safety documents and individual access requirements with the responsible team. Use authorized channels for sensitive documents.',
'KB-041':'Agree a new date with the customer and service team, then update the crew, calendars, badges, delivery, handling rentals, dock bookings and disposal pickup. Reconfirm linked arrangements; changing one email thread does not automatically change the others.',
'KB-042':'Compare the invoice with the approved scope, completed visits and agreed billing milestones. Ask finance and the project owner to investigate discrepancies and correct the invoice where appropriate. Do not assume a suggested partial-billing percentage is an established rule.',
'KB-043':'Look for a completion message or report for the exact asset, date and scope. Describe only the confirmed work and known result. A quotation, material delivery, recommendation or accepted appointment is not proof of a finished repair.',
}

UPDATES={
'KB-002':['E1339','E1855'], 'KB-003':['E1257','E1258'],
'KB-005':['E1858','E1860','E1861'], 'KB-008':['E2003','E2004'],
'KB-012':['E1502','E1505','E1507'], 'KB-014':['E1497','E1500','E1505'],
'KB-015':['E1382','E1496','E1512'], 'KB-018':['E1512'],
'KB-020':['E1220','E1221','E1222','E1260','E1261','E1707'],
'KB-023':['E1670','E1671','E1672','E1673'],
'KB-029':['E1564','E1567','E2074','E2083'],
'KB-031':['E1564','E1567'], 'KB-035':['E1880','E1876','E1877','E1878'],
'KB-041':['E1618','E1623'], 'KB-043':['E2016'],
}

def main():
    entries=json.loads((OUT/'versions/v1-1100/authored_entries.json').read_text(encoding='utf-8'))
    messages=[json.loads(x) for x in (OUT/'messages.jsonl').read_text(encoding='utf-8').strip().split('\n')]
    lookup={m['ref']:m for m in messages}
    original_ids=json.loads((OUT/'versions/v1-1100/source_ids.json').read_text(encoding='utf-8'))
    baseline=set(original_ids)
    current={m['source_id'] for m in messages}
    assert len(messages)==len(current)==2100
    assert len(baseline)==1100 and baseline <= current and len(current-baseline)==1000
    assert [m['source_id'] for m in messages[:1100]]==original_ids
    for e in entries:
        if e['id'] in ANSWERS:
            e['answer']=ANSWERS[e['id']]
        e['refs']=list(dict.fromkeys(e['refs']+UPDATES.get(e['id'],[])))
    # Replace stale wording where the evidence has become more nuanced.
    by_id={e['id']:e for e in entries}
    by_id['KB-020']['limits']='Do not assume equal sharing across dual power supplies, a fixed percentage drop, or a universal battery lifespan. An explanation about outage behaviour does not resolve an allegation of load loss while utility power remains available.'
    by_id['KB-023']['limits']='Resolve conflicting installation or replacement dates from the actual service record. A technician’s planning interval for one battery type is not a universal warranty or replacement rule.'
    by_id['KB-029']['limits']='Verify supported features and configuration against current product documentation. The sampled manuals were not opened. Do not invent registers, IP settings, alert capabilities or service activation.'
    by_id['KB-035']['limits']='Current stock, term pricing, battery availability and installation costs must be confirmed. Rigging, electrical hookup, extended runtime and emergency coverage may be separately quoted. Transformer sizing requires technical review.'
    by_id['OPS-001']['answer']='Complete the applicable field activity report and asset data sheets using this visit’s actual work, measurements, battery dates and photographs. For a battery-only job, report the systems actually serviced and the installed part numbers; do not imply a full test occurred. Keep other assets and internal tracking sheets separate, obtain technical review, and issue the approved customer report.'
    by_id['OPS-001']['refs']+=['E1855','E1856','E1858','E1860','E1861']

    def add(title,question,answer,need,limits,refs,audience='customer_support'):
        prefix='KB' if audience=='customer_support' else 'OPS'
        count=sum(e['audience']==audience for e in entries)+1
        entries.append(dict(id=f'{prefix}-{count:03d}',title=title,question=question,answer=answer,information_needed=need,limits=limits,refs=refs.split(),audience=audience))

    add('Batteries stored before installation',
        'Can batteries still be used after a long period in storage?',
        'Confirm how long they have already been stored and how much longer installation is delayed. Identify the model, date code, storage conditions and charging history, then request a service assessment against the manufacturer’s storage requirements. Quote any testing, charging, transport or storage work separately.',
        'Battery model/date code; actual storage dates; intended installation date; storage and charging history.',
        'No shelf-life cutoff, recovery guarantee or recharge interval was verified. In the correspondence, the original storage duration was corrected, changing the question. Do not prescribe charging or discharge cycles from this example.',
        'E1299 E1300 E1301 E1302 E1303')

    add('Storage charges when a project is delayed',
        'Will delaying delivery create storage charges, and how do we release the batteries?',
        'Ask the supplier to confirm whether storage charges apply, the covered period and any required revised PO. Confirm the release notice period, receiving crew and delivery booking before arranging shipment. The sampled order required advance notice to release goods from third-party storage.',
        'Order reference; revised project date; storage terms; approval; delivery and receiving details.',
        'Storage fees and release notice vary by supplier and order. Do not reuse the historical amount or notice period as a general policy.',
        'E1693 E1694 E1696 E1697 E1698 E1702 E1119 E1120')

    add('Maintenance records for an audit',
        'Can you provide UPS preventive maintenance and reports for our audit?',
        'Clarify whether the request is a condition assessment or a full PM service and what evidence the auditor requires for each unit. Agree the asset list, scope, report format and deadline before booking. An anonymized sample report can help confirm the expected format.',
        'Audit deadline; equipment inventory; required checks; required report format; access and work window.',
        'A report or service visit is not a guarantee that an organization will pass an audit. Repair work beyond the agreed PM scope needs separate approval.',
        'E1352 E1353 E1354 E1357 E1360')

    add('Resolving the asset list for a multi-site contract',
        'Which UPS units and sites are included in our maintenance quotation?',
        'Reconcile the number of sites with the number of individual UPSs. Record each asset’s model, serial and location, then mark included, excluded or deferred assets explicitly. Check whether any units still have OEM service coverage and agree when the new provider’s work begins.',
        'Asset register; site list; existing OEM entitlements; requested scope; accepted quote revision.',
        'A historical offer to add units without changing the price was customer-specific. A new UPS is not automatically exempt from maintenance or covered by an OEM service agreement.',
        'E1790 E1791 E1792 E1793 E1794 E1795')

    add('Coordinating maintenance with a shutdown and fire-alarm work',
        'Our UPS supports a fire-alarm system. How should maintenance be coordinated?',
        'Have the facility lead coordinate the UPS service team, fire-alarm contractor and other affected trades within the authorized shutdown plan. Confirm the exact date, dependencies and customer-approved procedure, and update every team if the shutdown changes.',
        'Affected systems; site technical lead; shutdown plan; participating contractors; permitted work window.',
        'This is coordination guidance, not an instruction to disable alarms, isolate circuits or perform safety-system testing. Only the approved site procedure determines the work sequence.',
        'E1664 E1665 E1666 E1667 E1669 E1670')

    add('Commissioning documents and missing drawings',
        'What should we do when the installer cannot find the required UPS or flywheel connection details?',
        'Obtain the applicable pre-start checklist and approved shop/record drawings from the project or OEM team. Confirm the onsite installer has the relevant revision and arrange a technical clarification call where needed. Do not improvise a connection from a general description.',
        'Equipment model; project drawing revision; installer’s question; pre-start checklist; OEM/project contact.',
        'The historical email described one installation’s power-feed arrangement. It is not a wiring instruction for another installation, and the attached drawings were not inspected.',
        'E1838 E1839 E1840')

    add('Fan fault: component repair or complete UPS replacement',
        'Can a failed internal UPS fan be replaced, or does the whole UPS need replacement?',
        'Ask the manufacturer-supported service team whether the failed component is serviceable in the exact model. In one case, staff reported an OEM recommendation to replace the complete UPS because its internal fans were not replaceable. A later message confirmed that the replacement installation was complete and the customer reported the unit online.',
        'Exact model/serial; fault details; current operating condition; OEM diagnosis; load and replacement plan.',
        'This does not mean all UPS fans are non-replaceable. A complete-unit recommendation must be model-specific; current repairability and coverage require confirmation.',
        'E2013 E1297 E2014 E2016')

    add('Failed battery self-test followed by normal operation',
        'A UPS battery test failed, but the unit now seems normal. Is a visit still needed?',
        'Provide the alarm history and asset details to the service team for assessment. In one case, the customer believed the units were working again, but a visit still took place; the completion email reported reset battery-test alarms and no other issues recorded.',
        'UPS identifier; exact alarm and date; recent outages or battery work; present status; service history.',
        'That reported outcome is not proof that every self-test failure is harmless or that resetting the alarm fixes its cause. Do not instruct a customer to run a disruptive test without an approved plan.',
        'E1172 E1173 E1174 E1181')

    add('Maintenance findings despite acceptable readings',
        'If battery readings look acceptable, can maintenance still be required?',
        'Yes. Review the inspection findings and outstanding actions as well as measured values. One service summary described generally acceptable readings but also identified affected terminals requiring attention. Ask the technical team to specify and prioritize the corrective scope.',
        'Service report; affected battery/terminal; measurements; inspection findings; recommended actions.',
        'Do not interpret no major issue as no maintenance required. Terminal treatment and other physical work must follow the qualified team’s approved procedure.',
        'E1327')

    add('Battery-only work versus a wider UPS repair',
        'Does a battery replacement quotation also include the UPS or transfer switch?',
        'Check the asset-by-asset scope. A service assessment can recommend battery replacements for some systems and separate UPS or automatic-transfer-switch replacement for others. Request clear line items and distinguish maintenance, parts, installation and corrective work before approval.',
        'Asset recommendations; quotation line items; affected UPS/transfer switch; approved scope.',
        'A battery quotation does not automatically authorize replacing other equipment, and a recommendation is not evidence that the work has been completed.',
        'E1771 E1323 E1324')

    add('Calibration certificates for battery test equipment',
        'How should staff arrange calibration and obtain a certificate for a battery tester?',
        'Record the exact tester model and serial number, then ask the authorized calibration provider about the applicable service, turnaround and certificate. Submit the required request and arrange equipment handover. Track completion and receipt of the certificate separately from the request.',
        'Tester model/serial; calibration service requirements; provider; required date; certificate requirements.',
        'The sampled correspondence confirms a request process, not completed calibration or a universal calibration interval. Do not claim a tester is calibrated without its valid record.',
        'E1251 E1253 E1254 E1255','internal')

    add('Conflicting battery-test reference values',
        'What should staff do when a tester reference differs from a supplied report or specification?',
        'Confirm the battery model, measurement method, instrument setup and approved reference source. Resolve the discrepancy with the responsible technical lead and applicable manufacturer/test documentation before interpreting results. Document the chosen basis consistently across comparable batteries.',
        'Battery model; instrument/model/settings; units; proposed baselines; applicable test method; technical approval.',
        'The email advocated one tester’s generated reference, but this was not independently validated. Do not automatically prefer a device default or derive pass/fail limits from the same population being assessed.',
        'E1423 E1422','internal')

    add('Per-cell versus per-jar reporting scope',
        'How should staff resolve disagreement about per-cell and per-jar battery testing?',
        'Compare the PO, accepted scope, applicable technical procedure and customer reporting requirement. Obtain technical review and written agreement before reducing the test granularity. Preserve the distinction between an automated monitoring reading and the agreed maintenance measurements.',
        'Battery type/configuration; approved scope; test/reporting method; customer requirements; technical lead decision.',
        'The sampled thread contains unresolved disagreement. It does not authorize replacing required individual-cell testing with a jar-level reading or establish a verified standards interpretation.',
        'E2058 E2059 E2060','internal')

    add('Using the latest tender forms and addenda',
        'Which tender version should staff use when a customer issues an addendum?',
        'Track the current official submission deadline, scope and pricing forms. Replace superseded documents as directed by the issuer and reconcile pricing against the revised scope. Confirm the technical, training and authorization requirements before claiming compliance.',
        'Current official tender package; addenda; revised forms; submission deadline; required credentials.',
        'Historical deadlines, portal pricing and employee interpretations are not current procurement rules. Verify the actual issuer documents; the email attachments were not opened.',
        'E1330 E1335 E1904','internal')

    add('Investigating invoice portal submission problems',
        'How should staff handle invoices that cannot be submitted through the customer portal?',
        'Collect the affected work-order and invoice references, submission status and error details, then contact the customer’s authorized invoice-portal support team for assistance. Arrange a guided review when necessary and verify submission acknowledgment afterward.',
        'Customer portal; invoice/work-order references; error details; support owner; acknowledgment/status.',
        'The sampled exchange arranged assistance but did not establish successful submission. Do not claim an invoice was accepted or paid, and do not include credentials in support messages.',
        'E1655 E1659 E1660 E1661','internal')

    add('Resolving contradictory technical explanations',
        'How should staff handle an explanation that does not answer the reported operating condition?',
        'Keep the exact symptom and operating condition visible. One exchange asked about load loss while utility power was present, but the reply explained runtime change during an outage. Treat the original condition as unresolved until investigated; do not accept reassurance that addresses a different scenario.',
        'Exact symptom; operating mode/time; logs; actual load/feed configuration; confirmed technician findings.',
        'Do not repeat unsupported claims that the UPS is working perfectly, that dual supplies always split power equally, or that display behaviour proves battery health.',
        'E1260 E1261 E1707','internal')

    for e in entries:
        e['refs']=list(dict.fromkeys(e['refs']))
        assert e['refs'] and all(r in lookup for r in e['refs']),e['title']
    DEST.mkdir(parents=True,exist_ok=True)
    for audience,name in [('customer_support','customer-support-knowledge.txt'),('internal','internal-service-workflows.txt')]:
        selected=[e for e in entries if e['audience']==audience]
        heading='DCX UPS POWER-SYSTEM SUPPORT KNOWLEDGE' if audience=='customer_support' else 'DCX INTERNAL SERVICE WORKFLOWS — STAFF ONLY'
        blocks=[heading+'\n\nHistorical service guidance. Confirm current asset records, contracts and technical requirements before making commitments. Keep each answer together with its limits.']
        for e in selected:
            blocks.append('\n'.join([e['title'].upper(),'Question: '+e['question'],'','Answer: '+e['answer'],'','Information needed: '+e['information_needed'],'','Limits: '+e['limits']]))
        text=('\n\n'+'-'*60+'\n\n').join(blocks)+'\n'
        assert not re.search(r'\bE\d{4}\b|^Evidence:|Email dates:',text,re.M)
        assert not re.search(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|https?://|\$\d',text)
        (DEST/name).write_text(text,encoding='utf-8')

    # Archive source evidence outside the deliverable knowledge files.
    (OUT/'authored_entries.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'source-audit.json').write_text(json.dumps([dict(article=e['title'],article_id=e['id'],refs=e['refs'],dates=sorted({lookup[r]['date'][:10] for r in e['refs']})) for e in entries],indent=2),encoding='utf-8')
    refs={r for e in entries for r in e['refs']}
    lines=['PRIVATE SOURCE LOOKUP — NOT FOR EMBEDDING','']
    for r in sorted(refs):
        m=lookup[r]
        lines += [r+' | '+m['date'],'Subject: '+m['subject'],'PST EntryID: '+m['source_id'],'']
    (OUT/'private_source_lookup.txt').write_text('\n'.join(lines),encoding='utf-8')
    counts=collections.Counter(e['audience'] for e in entries)
    old_words=sum(len((OUT/'versions/v1-1100/deliverables'/name).read_text(encoding='utf-8').split()) for name in ['customer-support-knowledge.txt','internal-service-workflows.txt'])
    new_words=sum(len((DEST/name).read_text(encoding='utf-8').split()) for name in ['customer-support-knowledge.txt','internal-service-workflows.txt'])
    summary={'sampled_emails':len(messages),'additional_distinct_emails':1000,'nonempty_cleaned_bodies':sum(bool(m['text']) for m in messages),'support_articles':counts['customer_support'],'internal_articles':counts['internal'],'new_support_articles':counts['customer_support']-43,'new_internal_articles':counts['internal']-10,'existing_articles_enriched_with_new_evidence':len(UPDATES)+1,'cited_source_emails_private_only':len(refs),'new_batch_cited_emails':sum(int(r[1:])>1100 for r in refs),'previous_knowledge_words':old_words,'updated_knowledge_words':new_words,'external_ai_calls':0,'attachments_read':0,'embeddings':0,'database_created':False}
    (DEST/'build-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')

    from finalize_email_knowledge import PROMPT
    prompt=PROMPT.replace('with its source date and applicability limits','with its applicability limits').replace('put evidence IDs and outstanding confirmations in a separate internal note','put outstanding confirmations in a separate internal note')
    prompt+='\nThe supplied knowledge files are self-contained text without original emails or reference IDs. Do not claim to have opened those emails or ask the user to supply arbitrary internal email IDs. Base answers on the available text and clearly identify gaps.\n'
    (DEST/'assistant-system-prompt.txt').write_text(prompt,encoding='utf-8')

    notes=f'''UPDATED KNOWLEDGE BASE — 2,100-EMAIL SAMPLE

Use customer-support-knowledge.txt as the primary support text. Use internal-service-workflows.txt only for staff workflows. The system prompt is separate from the factual knowledge.

What changed
- Exactly 1,000 additional distinct messages were cached, bringing the total to 2,100. The previous 1,100 source IDs remain present and unchanged; no message body from that original cache was fetched again.
- {counts['customer_support']} support answers and {counts['internal']} staff workflow notes are now available: 10 new support answers, 6 new staff notes, and 16 existing records enriched using new evidence.
- All 43 earlier support answers were condensed. Repeated histories were reduced and new overlapping evidence improved existing answers rather than creating duplicates.
- Evidence rows, email IDs and source date ranges were removed from every current deliverable knowledge text. Private source mapping remains outside this folder.
- The two knowledge texts contain {new_words:,} words combined, compared with {old_words:,} previously, while covering more questions. Compare this only as a text-size measure, not a measured model-token count.

New coverage
Stored batteries; delayed-project storage fees; audit-oriented PM reports; multi-site asset coverage; coordinated shutdowns/fire-alarm work; commissioning drawings; model-specific fan repair versus replacement; failed battery self-tests; inspection findings despite acceptable readings; battery-only versus wider corrective scope.

New internal guidance
Tester calibration records; conflicting battery-test baselines; per-cell versus per-jar scope; tender addenda; invoice-portal support; technical explanations that do not answer the reported symptom.

Important refinements
Runtime guidance now asks about added load and actual feed behaviour instead of assuming a fixed split between dual power supplies. Battery replacement planning must reconcile actual installation records when emails disagree. Customer reports must identify work actually performed and must not imply full testing after battery-only work. Monitoring installation includes software/IT coordination. Shipment, staging, access, handling rentals and disposal remain separate scheduling dependencies.

Method and limits
All 2,100 messages passed through local extraction/text processing; 2,089 have nonempty cleaned bodies. Relevant selected excerpts were reviewed in chat, not every full email. The larger cache spans April 2025–September 2026 and has 614 normalized-subject groups. Grouping by subject does not prove thread continuity. Some long groups have missing middle messages; quoted history was stripped. Sampling is not a census or a measure of mailbox-wide issue frequencies.

No attachments were read. Manuals, detailed reports and quotes mentioned as attachments have not been reconstructed. Do not treat unverified email advice as manufacturer instructions or company-wide policy. Current prices, availability, live job status and approved entitlements still require current records.

The additional batch was compared with the existing corpus. Weakly supported, repetitive, personal, commercial-sensitive and unrelated content was not promoted into reusable support guidance. {summary['new_batch_cited_emails']} messages from the added batch support the authored updates; the remaining messages were not all individually validated or converted into answers.

Privacy and traceability
The parent folder holds private source-audit.json, private_source_lookup.txt, message_processing_audit.json and the cached email text. Do not add these to a general customer knowledge index. The prior deliverable version is preserved under versions/v1-1100 for rollback and source auditing, not for use alongside this updated corpus.

Cost
No paid AI API calls, embeddings, database operations or full-PST export were made. This chat used tokens for selected evidence review and writing. Cached messages and reusable scripts avoid rereading the archive.

Validation
2,100 unique source IDs; 1,000 new IDs; original prefix preserved; all article references resolve in the private cache; no evidence rows or original email IDs in current deliverable text; no email addresses, URLs or monetary amounts in the authored knowledge files. Basic scans are not a formal privacy certification.

Rebuild this version with: python automation/expand_email_knowledge_v2.py
The earlier write_email_knowledge.py and finalize_email_knowledge.py scripts generated version 1 and should not be used to rebuild version 2.
'''
    (DEST/'READ-ME.txt').write_text(notes,encoding='utf-8')
    audit=[]
    used=collections.defaultdict(list)
    for e in entries:
        for ref in e['refs']: used[ref].append(e['id'])
    for m in messages:
        text=m['subject']+'\n'+m['text']
        audit.append(dict(ref=m['ref'],batch='original' if m['source_id'] in baseline else 'additional',body_processed_locally=True,nonempty=bool(m['text']),characters=len(m['text']),keywords_heuristic=[k for k,p in {'battery':r'\bbatter(?:y|ies)\b','maintenance':r'\b(?:maintenance|PM)\b','technical':r'\b(?:alarm|fault|voltage|charger|vacuum|bypass)\b','commercial':r'\b(?:quote|quotation|invoice|purchase order)\b','scheduling':r'\b(?:schedule|scheduling|delivery|appointment)\b'}.items() if re.search(p,text,re.I)],used_in_articles=used[m['ref']]))
    (OUT/'message_processing_audit.json').write_text(json.dumps(audit,indent=2),encoding='utf-8')
    for p in DEST.glob('*.txt'):
        assert not re.search(r'^Evidence:|\bE\d{4}\b|Email dates:',p.read_text(encoding='utf-8'),re.M),p.name
    assert len(entries)==69 and len({e['title'] for e in entries})==69
    assert sum('Limits:' in block for block in (DEST/'customer-support-knowledge.txt').read_text(encoding='utf-8').split('-'*60))==53
    print(json.dumps(summary,indent=2))

if __name__=='__main__':
    main()
