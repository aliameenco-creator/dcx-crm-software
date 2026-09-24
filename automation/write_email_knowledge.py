"""Render manually synthesized, source-linked email knowledge as ordinary text.
No embeddings, database, LLM calls, or network access.
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT/'.tools/email-knowledge'
DEST = OUT/'deliverables'
entries = []

def add(title, question, answer, need, boundary, refs, audience='customer_support'):
    entries.append(dict(title=title, question=question, answer=answer, information_needed=need, limits=boundary, refs=refs.split(), audience=audience))

add('UPS preventive-maintenance options',
    'Can you arrange annual or twice-yearly UPS maintenance?',
    'Annual and semi-annual maintenance were both offered in the sampled correspondence. Start by identifying the installed UPS and batteries, then ask the service team for the applicable scope and quotation. Confirm the chosen visit frequency, approval and site availability before booking. A customer in the sample selected maintenance every six months and subsequently confirmed a visit.',
    'UPS model and serial number; site; quantity of systems; existing service agreement; desired frequency and access hours.',
    'These are historical options, not a rule that every UPS needs the same maintenance interval. Use the equipment requirements and agreed contract.',
    'E0003 E0004 E0200 E0007 E0008')

add('Major and minor maintenance scope',
    'What is included in a UPS maintenance contract, and how often are visits required?',
    'Obtain a written scope separating UPS maintenance, battery maintenance, major visits, minor visits and emergency support. One request specified an after-hours major visit, normal-hours minor visits and quarterly VRLA battery maintenance. Another service scope listed battery testing, bypass testing and a service report. These examples show why the quotation must describe the actual systems and checks rather than simply say maintenance.',
    'Equipment list; battery type and string count; contract dates; visit frequency; working hours; requested emergency coverage.',
    'The sampled requested scope is not proof of an awarded contract or a universal service package. Do not promise a requested response-time SLA without an approved agreement.',
    'E1077 E0992')

add('Confirming a maintenance appointment',
    'What information is needed to book a UPS service visit?',
    'Confirm the system, exact service location, customer contact, room access, proposed date and start time. Identify the assigned technician and obtain the customer’s confirmation. Send the site contact details to the technician. In a sampled maintenance case, the customer first confirmed room access, the service team confirmed the technician, and completion was reported later.',
    'Site address and room; asset identifier; scope; approved commercial arrangement; contact; access requirements; time window.',
    'An offered date or named technician is not a confirmed appointment until scheduling is agreed. Historical availability cannot establish current availability.',
    'E0191 E0192 E0246 E0247 E0248')

add('Missed service and completion confirmation',
    'Our UPS maintenance appears overdue. Was the work actually completed?',
    'Check the asset and the latest service record rather than relying on the planned date. If the visit is outstanding, coordinate a new appointment. If completed, provide the dated service report and the recorded findings. In one sampled case, staff confirmed that the planned maintenance had been performed with no issues recorded, and the customer requested the report before approving the invoice.',
    'Site; model or serial number; expected service date; work order or invoice reference.',
    'A booking, quote or invoice alone does not prove completion. The sampled report attachments were not opened; completion here is supported by the email statement.',
    'E0191 E0249 E0193 E0194 E0196')

add('Requesting a service report',
    'Can you send the report for our last UPS or battery service?',
    'Request the report for the specific site, asset and service date from the service coordinator. If an OEM performed the work, obtain its report through the responsible service team. Provide the customer-facing report and state any recorded outstanding recommendations separately. The sample includes customers requesting reports for their records and to support invoice approval.',
    'Site; equipment identifier; service date; work order; intended recipient.',
    'Do not invent measured readings, findings or attachment contents. Internal job-cost sheets are separate from customer service reports.',
    'E0194 E0195 E0196 E0804')

add('Purchase orders and alternative authorization',
    'Can service be arranged if our organization does not issue purchase orders?',
    'Tell the service coordinator how your organization authorizes work and pays invoices. The sample commonly requested a PO, but also contains explicitly accepted alternatives: one customer did not issue POs, and another obtained agreement to direct invoicing. Ask the responsible sales or finance team to confirm the arrangement before treating it as authorized.',
    'Billing entity; accepted quotation; authorized customer contact; proposed approval and payment process.',
    'A historical exception is not blanket permission to bypass purchase-order or finance requirements for another customer.',
    'E0200 E0202 E0203 E0453 E0454')

add('Obtaining an upfront cost',
    'Can you tell us the cost before scheduling the repair?',
    'Request the current written quotation for the identified equipment and scope. Make sure it separates the relevant equipment, batteries, labour and logistics, including after-hours work when applicable. In one repair discussion, the customer asked for budgeting certainty and the service team resent the existing firm quotation.',
    'Equipment and fault details; site; requested scope; working hours; existing quote reference.',
    'Do not reuse a historical amount, supplier cost, margin or rental rate as today’s customer price.',
    'E0456 E0457 E0690 E1084')

add('Questions about a revised quotation',
    'Why did the amount or scope change on the revised quote?',
    'Compare the latest approved revision with the previous quotation and identify the changed quantities, parts, scope or logistics. Ask sales to explain and correct any unintended change. The sample includes a customer querying a changed amount and the team issuing another copy for review.',
    'Both quote revisions; expected scope and price; PO if already issued.',
    'The sampled correspondence does not establish that a requested price reduction was approved. Do not promise a discount or restore an old price automatically.',
    'E0692 E0693 E0694')

add('Battery replacement quotation details',
    'What do you need to quote a UPS battery replacement?',
    'Identify the exact UPS and battery configuration before ordering. Confirm whether the request covers internal packs, external cabinets, complete strings, or labour only. Record battery part numbers and quantities for each asset, then verify supply and access arrangements. The sample includes requests for internal packs only and separate labour quotations when the customer already had batteries on site.',
    'UPS model and serial; battery labels or existing report; quantity and string/cabinet arrangement; site access; supply-versus-labour scope.',
    'Do not infer a compatible battery solely from the UPS capacity or copy the configuration of a different installation.',
    'E0547 E0180 E0182 E0800')

add('Labour-only battery replacement',
    'We already have the batteries. Can you quote the installation labour?',
    'The sampled team quoted onsite labour separately where batteries were already available. Confirm the exact parts, quantity, arrival and storage location, required handling equipment, access window and disposal responsibilities before scheduling the technicians.',
    'Battery model and quantity; UPS model; delivery confirmation; site and room; handling/access arrangements; disposal scope.',
    'Customer-supplied batteries still require compatibility and condition checks by the service team. A historical open slot is not current availability.',
    'E0180 E0181 E0182 E0183 E0755')

add('Correcting a battery part or quantity mismatch',
    'The batteries used do not match the original quotation. How should this be resolved?',
    'Reconcile the quotation with the actual UPS assets and the service report. State which part number and quantity were installed in each system, and have sales resolve any price or PO difference. In one completed job, four RBC133 replacements were used and a different system required RBC115 instead; the supplier exchanged the extra part at no additional cost in that case.',
    'Original quote; affected asset; ordered and installed part numbers; quantities; technician’s report.',
    'RBC133 and RBC115 are not established as interchangeable by this example. The no-charge exchange was a case-specific commercial outcome.',
    'E0800 E0804')

add('Comparing alternative battery brands',
    'Can an alternative battery brand replace the specified battery?',
    'Ask the technical team and supplier for a documented comparison against the exact installed battery and application. The sample requested comparisons covering capacity, UPS-rate discharge performance, dimensions and weight, recharge characteristics, operating conditions and warranty. A lower price or similar amp-hour label alone is not sufficient evidence of suitability.',
    'Existing part number; UPS and cabinet details; required runtime/load; proposed replacement data sheet; installation constraints.',
    'The emails contain quotation discussions, not validated interchangeability tables. Obtain written technical approval for the proposed replacement.',
    'E0965 E0967 E0969 E0157')

add('Battery availability and obsolete parts',
    'Is this battery still available, or has it been superseded?',
    'Ask the supplier to confirm current availability, any discontinuation notice and the approved replacement for the specific application. Recheck compatibility, price and lead time before updating a customer quotation. A September 2026 email reported a product transition for certain EnerSys models, but the underlying attachment was not reviewed.',
    'Exact manufacturer and part number; quantity; equipment/application; required delivery date.',
    'Treat historical discontinuation dates, warranties and replacement-model claims as leads to verify, not current manufacturer policy.',
    'E0098 E0099')

add('Parts lead time and installation dates',
    'When can you install the replacement batteries or UPS?',
    'Confirm parts availability and delivery before committing to installation. Then coordinate the technician, customer access and any required supporting trades. In the sample, staff explicitly waited for battery-pack pickup availability before scheduling, and another project encountered a mismatch between the travel plan and the shipment lead time.',
    'Approved scope; supplier ETA; delivery destination; site contact; access window; crew availability.',
    'Historical next-day or multiweek estimates apply only to their original orders. Do not guarantee a new date from those examples.',
    'E0551 E0525 E0534 E0754')

add('Battery delivery has arrived but installation is not booked',
    'Our batteries were delivered. What happens next?',
    'Notify the service coordinator that the shipment is onsite, and confirm its quantity, condition and staging location. Ask for installation availability and clarify who will move the batteries and remove the old ones. In one case, the service team had not received the arrival notification, which delayed arranging the onsite labour.',
    'Delivery confirmation; site and storage location; received items; contact; requested work window; removal arrangements.',
    'Delivery is not evidence of installation or successful testing.',
    'E1004 E0473 E0754')

add('Battery removal and disposal scope',
    'Can you remove old UPS batteries while leaving the cabinet in place?',
    'Clarify whether the work is battery-only removal or removal of the complete UPS/cabinet. The sample contains a customer requesting removal of batteries while retaining the empty cabinet. To quote the work, the service team asked about the exact location, loading dock, truck restrictions, stairs or elevators, and permitted working hours.',
    'Battery quantity and type; battery-only or complete-equipment scope; asset location; route to loading dock; truck access; work window.',
    'Do not expand a battery-only request into cabinet disposal. The equipment’s safe work condition must be established by qualified personnel.',
    'E0963 E0964')

add('Same-day removal and disposal documentation',
    'Can you take the old batteries away the same day and provide a disposal certificate?',
    'Coordinate pickup with the replacement schedule and site storage limits. Confirm whether pallets or skids are available, reserve the loading dock as required, and ask the disposal provider for the appropriate documentation. The sample includes a site with no loading-dock storage space and a separate request for a certificate of disposal.',
    'Battery quantity; completion/pickup window; storage restrictions; dock reservation; pallets; required documentation.',
    'A requested or scheduled pickup does not prove collection or certification. Confirm receipt of the actual disposal record.',
    'E0473 E0762 E1068 E1071')

add('Battery handling and access survey',
    'Why do you need a site survey before quoting battery work?',
    'Access can materially change the labour and equipment required. Establish the route from delivery to the battery room, including distance, stairs, elevators, lifting needs and storage. The sample included uncertainty about crane requirements and a survey report that incorrectly suggested stairs until the technician clarified the route.',
    'Photographs or site survey; delivery point; route and distance; elevator availability; lifting constraints; room layout.',
    'Do not infer a difficult route from a copied report. Confirm ambiguities with the site contact or survey technician before quoting.',
    'E0643 E0967 E0630 E0922 E0924 E0925 E0926')

add('Downtime during battery replacement',
    'Will our UPS remain online while the batteries are replaced?',
    'The answer depends on the exact UPS architecture, redundancy and approved work procedure. Ask the technical lead to confirm the operating plan and expected impact for this site. The emails include a cabinet-by-cabinet online replacement proposal, but other work required discussion of bypass, isolation and operational risk.',
    'UPS model/configuration; load and redundancy; battery arrangement; current operating status; approved method of procedure; allowed outage window.',
    'Do not repeat historical promises of no risk or no impact as a general guarantee. Do not provide breaker-switching instructions from these email examples.',
    'E1006 E1074 E0774 E0775')

add('Reduced runtime and battery percentage drops',
    'Why does battery percentage fall rapidly, or why is backup runtime shorter than before?',
    'Review the affected asset’s load, battery age, charging history, alarms and previous test results. In one sampled assessment, the technician distinguished newer batteries from older systems already flagged for replacement, and the customer considered budgeting for the recommended work. Arrange a technical assessment rather than diagnosing from the percentage display alone.',
    'UPS model; battery replacement date; load; recent outage history; observed runtime; alarm text; previous service report.',
    'The email explanation was a case-specific assessment. Its percentage thresholds and age statements are not universal diagnostic rules, and a completed repair was not shown in that exchange.',
    'E0426 E0427 E0428')

add('Long recharge time after adding an external battery cabinet',
    'Why do the larger external batteries take so long to recharge?',
    'A sampled installation report explained that the existing UPS had a relatively small internal charger compared with the new battery capacity, so recharge after a deep discharge would take longer. The team arranged follow-up testing; the later email reported acceptable battery test results. Ask the technical team to assess charger capability and the actual battery configuration.',
    'UPS model; installed battery capacity and cabinet; recent discharge duration; load; time since utility returned; charging alarms.',
    'The case does not establish a recharge duration or runtime for other systems. An external charger was only a possible future option and requires engineering/OEM approval.',
    'E0609 E0610')

add('Internal batteries with an external cabinet',
    'Does adding an external battery cabinet mean the internal batteries can be removed?',
    'Do not assume that external capacity removes the need for internal batteries. In a sampled installation, the technician reported that the particular UPS would not operate without its internal set and installed replacement internal batteries. Confirm the requirements for the exact model before changing the configuration.',
    'Exact UPS model and configuration; internal and external battery details; manufacturer documentation.',
    'This requirement was reported for one installation. It is not a statement about every UPS model.',
    'E0609 E0610')

add('UPS or battery warranty questions',
    'Is this repair or battery replacement covered by warranty?',
    'Check the individual asset, battery installation record, applicable warranty or service contract, and written coverage decision. The sample includes an investigation because a battery had apparently not been replaced when assumed, and another case where service coverage was escalated while a contract PO was being processed.',
    'Model and serial; installation/replacement date; invoice or service record; contract entitlement; fault details; existing case number.',
    'Age assumptions, a pending PO or a prior customer’s exception do not establish coverage. Obtain confirmation before promising a free repair.',
    'E0628 E0629 E0437 E0712 E0715')

add('Expired contract and renewal start date',
    'When does renewed service coverage start after the previous contract expired?',
    'Ask the service team to confirm the renewal order and provide the entitlement with its actual start and end dates. In the sample, a customer requested those dates after a lapse, and the team described a planned start when the order was processed and promised to forward the entitlement.',
    'Asset identifier; expired agreement; renewal quote and PO; order status; issued entitlement.',
    'A tentative start date in an email is not the final entitlement and does not establish retroactive coverage.',
    'E0714 E0715')

add('Charger fault or recurring UPS alarm',
    'A charger fault or battery alarm keeps returning. What information should we provide?',
    'Provide the exact alarm, affected UPS, recent battery work and previous reports so the service team can investigate. The sample shows technicians coordinating a visit to inspect several units with charger faults and one with a faulty battery. Warranty status and the fault diagnosis were handled separately.',
    'Model and serial; exact alarm text; time and recurrence; battery history; recent service; operational impact.',
    'The sampled exchange does not establish a verified root cause or universal reset fix. Do not recommend repeated resets or component replacement solely from the alarm name.',
    'E0546 E0628 E0629')

add('Flywheel vacuum alarms',
    'A Vycon flywheel reports a vacuum alarm or goes offline. What is the next step?',
    'Escalate the exact flywheel and UPS symptoms to the manufacturer-supported service team. In the sample, manufacturer correspondence identified a pump problem or a leak as possibilities, and the technician later reported that a restart caused a breaker trip and UPS bypass. Subsequent correspondence pursued replacement pumps and possible further troubleshooting.',
    'Flywheel and UPS identifiers; complete alarm history; recent UPS faults; current status; relevant service case.',
    'The sample does not prove that pump replacement resolved the fault. Do not supply reset, restart, pump-swap or breaker-operation instructions from this knowledge entry.',
    'E0734 E0735 E0736 E0795 E0738')

add('Flywheel repair work window',
    'Can an offline flywheel be repaired during normal business hours?',
    'Confirm the site’s maintenance window and technical risk review first. In the sample, an initial daytime proposal was challenged because the customer required after-hours work. After further discussion, the customer agreed to align the repair with annual maintenance and include additional time.',
    'Site operating restrictions; approved procedure; other equipment status; maintenance calendar; customer authorization.',
    'An offline component does not by itself establish that daytime work is acceptable or that the wider UPS system will be unaffected.',
    'E0770 E0777 E0773 E0774 E0775 E1074')

add('Flywheel lifecycle maintenance request',
    'Which lifecycle parts should be replaced on an older flywheel system?',
    'Obtain the manufacturer’s maintenance and lifecycle recommendations for the exact model and operating history. A customer in the sample asked for a lifecycle review and costs, including fans and filters in addition to a pump repair. Route the request for a model-specific scope and quotation.',
    'Flywheel model and serial; age and operating history; completed maintenance; known faults; current manufacturer recommendations.',
    'The sampled request did not contain an approved parts list or replacement intervals. Do not invent them.',
    'E1075 E1076')

add('BMS integration and communications',
    'What is needed to connect the UPS to a building-management system?',
    'Identify the UPS, network-management card and supported communication protocol, then obtain the correct point map and implementation documentation. In the sample, staff supplied SNMP/Modbus documentation and the controls team planned point uploads and alarm graphics. Troubleshooting requests asked for communication settings, monitored addresses and actual responses.',
    'UPS and card model; required protocol; BMS/controls contact; point list; current settings and observed responses.',
    'The archive does not contain a verified configuration guide. Do not assume BACnet/IP and BACnet MS/TP are interchangeable or invent register addresses.',
    'E0055 E0218 E0059 E0221 E0056')

add('Network connection after replacing a UPS',
    'The replacement UPS is installed but cannot be reached on the network. What should happen?',
    'Coordinate the onsite technician with the customer’s IT contact to verify the network connection and required addressing. In a sampled replacement, the customer raised a static-IP question and later confirmed that the new UPS was reachable over the network. Record that customer confirmation before calling the network handover complete.',
    'UPS/network-card model; IT contact; approved network settings; current connectivity symptoms.',
    'Connecting an Ethernet cable alone is not proof of successful configuration. No credentials or network settings from other customers should be reused.',
    'E0707 E0708 E0710 E0711')

add('Battery monitoring installation prerequisites',
    'What do we need to prepare for battery-monitoring installation?',
    'Confirm that the monitoring equipment has arrived, identify the cabinet/string configuration, and arrange access with the site contact. The sample also requested staff preparation using the product training material, especially software, and coordination with an experienced technician.',
    'Monitoring product; cabinet/string count; existing or new battery installation; equipment arrival; site contact; access requirements.',
    'One email initially suggested no additional prerequisites, but a later message explicitly requested confirmation of special access requirements. Use the complete site-specific checklist.',
    'E0552 E0553 E0554 E0555 E0558 E0561')

add('Battery-monitoring labour estimate',
    'How long does installation of monitoring on four battery strings take?',
    'Ask the service lead to estimate from the cabinet design, existing-versus-new installation, wiring and commissioning scope. In one historical discussion, technicians suggested two people for a full day and explicitly said that the cabinet mattered. A later first-installation discussion involved additional assistance and training.',
    'Cabinet details; strings and battery count; monitoring equipment; access; commissioning/training requirements.',
    'The historical two-person/day estimate is not a fixed service standard or quote for a new site.',
    'E0270 E0271 E0273 E0275 E0555')

add('Planning a load-bank test',
    'What is needed to schedule UPS load-bank testing?',
    'Plan the complete job: equipment availability, delivery location, cable route and length, setup assistance, approved testing window, test scope, removal and rental return. The emails show setup, testing and cleanup on separate days, and another site required a long vertical cable route between floors.',
    'UPS rating and configuration; test specification; site address; cable route; access; delivery arrangements; crew and authorized work window.',
    'Do not infer test load, duration, pass criteria or staffing from a different job. Electrical connections and test operation require the approved procedure and qualified team.',
    'E0222 E0225 E0652 E0653 E0656 E0209')

add('Load-bank testing exclusions and scope',
    'Does a load-bank test include power-quality monitoring and infrared inspection?',
    'Check the quotation and test scope. One sampled load-bank assignment explicitly excluded power-quality monitoring and infrared scanning. If those services are required, ask for them to be included and scheduled with the appropriate resources.',
    'Approved scope; test objectives; desired monitoring/inspection services; required report.',
    'A load-bank test is not evidence that every other electrical inspection was performed.',
    'E0090')

add('Temporary or rental UPS selection',
    'Can you provide a temporary UPS, and what specifications are needed?',
    'Provide the required load, runtime, input/output supply requirements, rental period and delivery deadline. The sample shows that a UPS available in stock was not necessarily a complete ready-to-deploy solution: batteries, transformers and their lead times changed the proposed options. Ask for a quotation covering the full installation.',
    'Required kW/kVA and runtime; input/output voltage and phase; site constraints; rental duration; deployment date.',
    'Historical warehouse stock, rental prices and rapid-delivery statements are not current commitments. Transformer selection and sizing require technical review.',
    'E0513 E0522 E0515 E0520 E0519 E0517 E1014')

add('Replacing an aging UPS',
    'Our UPS is old. Can you recommend a replacement?',
    'Start with the current equipment, load, electrical requirements, battery runtime and installation constraints. In one sampled case, maintenance on an older system led to a replacement proposal specifying the UPS, external batteries, rack, installation and warranty terms. Request an updated engineered proposal for the actual site.',
    'Existing model and configuration; load; required runtime; supply/output; footprint; installation access; service history.',
    'The sampled proposal is a historical solution, not a universal replacement recommendation, current price or warranty promise.',
    'E0174 E0175 E0176')

add('Emergency-lighting UPS replacement',
    'Can a standard UPS replace an emergency-lighting inverter?',
    'Identify the lighting application and exact electrical requirements before proposing equipment. In the sample, a single-phase 347 V emergency-lighting system prompted a request for a like-for-like solution from the brand’s supplier; the discussion did not confirm a final replacement.',
    'Existing nameplate and model; application; input/output and phase; load; required runtime; applicable project requirements.',
    'Do not substitute an ordinary UPS or a different phase/voltage system based solely on capacity. This sample provides no validated equivalent.',
    'E0335 E0340 E0336 E0339 E0338 E0342 E0343')

add('Old fault still mentioned in a service report',
    'A past report identified a fault, but the latest visit looked normal. Is the issue closed?',
    'Check for documented repair closure. In a sampled case, an earlier report identified a faulty interlock in the maintenance-bypass cabinet. The later technician reported no new issues but explicitly asked for the OEM repair record before treating the earlier fault as resolved or sending the final report.',
    'Earlier recommendation; affected asset; repair/work-order reference; current report; OEM repair confirmation.',
    'No new issue observed is not equivalent to proof that an earlier defect was corrected. Do not bypass interlocks or infer safe switching from this correspondence.',
    'E0792')

add('Emergency support and response-time requests',
    'Do you provide after-hours emergency support, and how fast can someone attend?',
    'Have the service coordinator confirm support availability and the applicable contract or time-and-materials terms for the site. Separate telephone response from onsite arrival. One sampled sales discussion proposed immediate telephone support and a specific onsite response for that opportunity; another customer requested a different SLA.',
    'Site location; criticality; exact alarm/problem; contract details; required assistance and access.',
    'A sales proposal or customer request is not a universal guaranteed SLA. Do not publish historical response times or unverified telephone numbers as current policy.',
    'E1084 E1086 E1077')

add('Site onboarding and insurance',
    'What onboarding documents are needed before technicians can attend?',
    'Ask the customer or prime contractor for its current onboarding checklist. Sampled requests included insurance certificates, workplace-insurance clearance, subcontractor information and safety documents. Insurance wording sometimes required correction before onboarding could proceed. Route sensitive finance and identity documents through the authorized onboarding process.',
    'Customer onboarding contact; current checklist; legal entity; required insurance wording; technician access requirements.',
    'Requirements and coverage limits varied by customer. Do not treat one customer’s checklist as general law or disclose another customer’s documents.',
    'E0301 E0304 E0306 E0876 E0878 E0880')

add('Changing an appointment because of a site conflict',
    'Can we reschedule battery replacement because of a fire drill or access conflict?',
    'Coordinate a new work window with the service team and customer, then update the crew, calendar, badges, loading-dock booking and disposal pickup. In a sampled project, a fire drill caused a previously accepted date to change and the customer accepted a later proposal.',
    'Original booking; alternative dates; site restrictions; dock/access reservations; crew and pickup arrangements.',
    'Use the latest mutually confirmed information across the related correspondence. A changed date in one thread may leave logistics in another thread needing reconfirmation.',
    'E1008 E1009 E1011 E1012 E1013 E1068 E1071')

add('Billing a partially completed project',
    'Why have we been invoiced for the whole project when only part of the work is complete?',
    'Reconcile the invoice with the approved scope, completed visits and agreed billing milestones. A sampled customer rejected an invoice because only an initial service visit had occurred and requested partial billing. Ask finance and the project owner to review the supporting records and issue a correction where appropriate.',
    'Quotation/contract; PO; invoice; completed service records; remaining scope; billing terms.',
    'A partial-payment percentage suggested in one email is not a company-wide billing rule. Do not declare a disputed invoice valid or settled without the account record.',
    'E0028 E0206 E0207 E0208')

add('Confirmed work versus proposed work',
    'Has the UPS or battery replacement been completed?',
    'Use a completion message or service report for the correct asset and date. The sample contains a direct confirmation that UPS and battery replacements at one site were complete, while other threads only discuss quotations, scheduling or materials. Describe exactly what is supported and request the completion record when it is absent.',
    'Site; equipment; work order; expected scope/date; completion report.',
    'Do not turn a quotation, delivery notification, appointment or recommendation into a completed repair.',
    'E1096 E1097 E1004 E1013')

# Internal records are kept in a separate human-readable file.
add('Preparing an accurate maintenance report',
    'How should staff prepare and reuse UPS service report templates?',
    'In the sampled workflow, staff completed the Electronic Field Activity Report first, then the associated data sheets. They used separate system data sheets and replaced old site photographs with current photographs. Review the final report before issuing it and ensure asset details, measurements, battery dates and recommendations belong to this visit.',
    'Current EFAR/report template; asset list; actual measurements; current photos; previous open recommendations.',
    'Template reuse must not copy old measurements or imply that an unperformed check took place. Exact spreadsheet behaviour depends on the template version.',
    'E0933 E0509 E0510 E0511 E0512 E0545','internal')

add('Checking contact information in report templates',
    'What should staff do when a report template contains an incorrect support number?',
    'Correct the shared template and verify the current approved company contact before reissuing documents. In June 2026, a technician identified that a service number in a template belonged to an unrelated office, and the recipient agreed to update it. Treat this as a template-control issue, not merely a correction to one report.',
    'Affected template; current approved support contact; reports generated from that version.',
    'This entry intentionally omits telephone numbers. Confirm current company contact details before publishing them.',
    'E0362 E0363','internal')

add('Closing recommendations across maintenance visits',
    'How should a previous battery replacement recommendation be tracked?',
    'Carry the asset-level recommendation forward until a completion record closes it. Record the installed part, quantity and date against the affected UPS, and update the next service report from that evidence. The sample used data sheets to track recommended and completed replacements; colour alone is insufficient without an explicit status.',
    'Asset identifier; prior recommendation; new service findings; replacement record; installed part and date.',
    'The same colour was discussed for recommended and completed work in the sampled correspondence. Use explicit words so future readers cannot confuse the two.',
    'E0800 E0804 E1058 E1059 E0545','internal')

add('Job handover for battery replacement',
    'What belongs in the internal handover from sales to service?',
    'Provide the customer quotation, supplier quotation, PO, freight assumptions, site contact and agreed scope. Make the party responsible for installation, staging, removal and disposal explicit. A sampled handover removed a supplier disposal line because that responsibility was being handled separately.',
    'Approved sales package; supplier order; logistics; site contact; scope allocation; scheduling owner.',
    'Keep supplier costs and internal commercial documents out of the customer-facing knowledge base. Check for duplicated or omitted disposal charges.',
    'E0471 E0472 E0473','internal')

add('Refreshing parts costs before quoting',
    'Can an old repair cost sheet be reused for a new quotation?',
    'Use it as a scope reference, then reconfirm current parts cost, freight, duties and labour assumptions. In the pump-repair correspondence, staff requested updated pump and shipping costs before quoting, and another message noted that prior duties and shipping had been missed.',
    'Current supplier quotation; freight/duties; quantity; labour scope; approved pricing assumptions.',
    'Do not treat old supplier prices, estimated surcharges or internal margins as approved current customer prices.',
    'E0177 E0178 E0179 E0461 E0737','internal')

add('Handling a vendor part-number mismatch',
    'What if the supplier’s part number does not match the installed UPS component?',
    'Escalate for technical identification before ordering. A sampled capacitor inquiry requested the installed component’s voltage and capacitance because the supplier’s part number and quantity differed. Another power-supply request identified the exact UPS model and system configuration.',
    'Equipment model; installed component markings/photos obtained by qualified staff; relevant specifications; supplier proposal.',
    'No component equivalence or repair procedure was validated by these emails. Do not ask an unqualified customer to open energized equipment.',
    'E0932 E0831','internal')

add('Technical diagnosis awaiting supplier confirmation',
    'Can a suspected module failure be quoted as a confirmed repair?',
    'Distinguish the initial diagnosis, supplier verification, quotation and completed repair. In one lighting-inverter case, the initial assessment was followed by a supplier visit, which also recommended module replacement; the next step was a quotation. Completion was not shown in that exchange.',
    'Asset and fault; diagnostic record; supplier findings; approved quote; later repair/test result.',
    'Agreement on a proposed replacement is not proof that it was installed or solved the problem.',
    'E0935 E0937 E0939','internal')

add('Manufacturer requirements mentioned in an email',
    'Can staff use an emailed summary of a battery manual as the work instruction?',
    'Retrieve and verify the actual current manual for the exact battery and application. One sampled message proposed delayed final readings and referred to torque, corrosion protection and maintenance requirements, but requested review before proceeding. Preserve that as a verification task rather than an approved instruction.',
    'Exact product; applicable manual revision; approved installation procedure; warranty terms; technical sign-off.',
    'The attachment/manual was not inspected. Specific torque values, waiting periods and warranty conditions are intentionally excluded from reusable support answers.',
    'E0919','internal')

add('Avoiding unsafe reuse of site-specific switching instructions',
    'How should the assistant handle emails describing breaker operations or UPS isolation?',
    'Use them only to identify the need for a qualified technical lead and the approved site-specific procedure. A sampled discussion explicitly distinguished an offline UPS from live input/output sections and limited a statement about battery isolation to one particular UPS. The assistant should collect context and escalate, not reproduce switching steps.',
    'Exact asset/configuration; current state; authorized technical lead; approved work procedure and maintenance window.',
    'Historical isolation states cannot establish today’s electrical safety. No breaker sequence, permission to open a cabinet or guarantee of zero downtime belongs in this general support corpus.',
    'E0377 E0379 E0381 E0700','internal')

add('Screening irrelevant or unverified email content',
    'Which sampled messages should be excluded from reusable support knowledge?',
    'Exclude automatic replies, delivery marketing, event invitations, recruitment, payroll, personal messages, credentials, internal margins and unrelated conversations. Treat email-generated AI explanations, sales assertions and customer requests as unverified until supported. Do not copy sensitive customer identifiers or another organization’s onboarding documents into general guidance.',
    'Message purpose; provenance; relevance to a support question; supporting evidence; publication audience.',
    'Presence in the mailbox does not make content correct or appropriate for a customer-facing answer.',
    'E0145 E1084 E1086','internal')

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    messages = [json.loads(x) for x in (OUT/'messages.jsonl').read_text(encoding='utf-8').strip().split('\n')]
    lookup = {m['ref']:m for m in messages}
    assert len(messages)>=1000 and len({m['source_id'] for m in messages})==len(messages)
    header = (
        'DCX UPS POWER-SYSTEM SUPPORT KNOWLEDGE\n'
        'Prepared from a bounded sample of 1,100 distinct emails. This is ordinary text; no embeddings or database were created.\n'
        'The UPS here is an uninterruptible power supply.\n\n'
        'Evidence status: historical correspondence, not an approved policy manual. Answers synthesize selected relevant email evidence after local processing of the full sample. '
        'Not every sampled email received full model review. Email attachments were not opened. '
        'Preserve the applicability limits and source references with each answer. Confirm current contracts, availability, prices and technical requirements before making commitments.\n\n'
    )
    for audience, filename in [('customer_support','customer-support-knowledge.txt'),('internal','internal-service-workflows.txt')]:
        blocks = []
        for e in [e for e in entries if e['audience']==audience]:
            e['id'] = ('KB' if audience=='customer_support' else 'OPS')+f'-{len(blocks)+1:03d}'
            assert all(ref in lookup for ref in e['refs']),e
            dates = sorted({lookup[ref]['date'][:10] for ref in e['refs']})
            date_range = dates[0] if len(dates)==1 else dates[0]+' to '+dates[-1]
            block = '\n'.join([e['id']+' | '+e['title'], 'Audience: '+audience.replace('_',' '), 'Question: '+e['question'], '', 'Answer: '+e['answer'], '', 'Information to collect: '+e['information_needed'], '', 'Applicability and limits: '+e['limits'], 'Evidence: historical emails '+', '.join(e['refs'])+'. Email dates: '+date_range+'.'])
            blocks.append(block)
        (DEST/filename).write_text(header+('\n\n'+'-'*72+'\n\n').join(blocks)+'\n',encoding='utf-8')
    (OUT/'authored_entries.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2),encoding='utf-8')
    used = {ref for e in entries for ref in e['refs']}
    ledger = ['PRIVATE SOURCE LOOKUP','Keep local. Do not add this file or the raw email evidence to a general customer knowledge index.','Source IDs point into the local PST; source text is in ../private_evidence.md.','']
    for ref in sorted(used):
        m = lookup[ref]
        ledger += [ref+' | '+m['date'], 'Subject: '+m['subject'], 'PST EntryID: '+m['source_id'], '']
    (OUT/'private_source_lookup.txt').write_text('\n'.join(ledger),encoding='utf-8')
    stats = {'sampled_emails':len(messages),'support_articles':sum(e['audience']=='customer_support' for e in entries),'internal_articles':sum(e['audience']=='internal' for e in entries),'cited_source_emails':len(used),'external_ai_calls':0,'embeddings':0,'database_created':False}
    (DEST/'build-summary.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
    print(json.dumps(stats,indent=2))

if __name__=='__main__':
    main()
