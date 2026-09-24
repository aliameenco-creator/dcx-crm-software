# Phase 1 n8n workflow exports

These are **integration scaffolds**, not a connected production automation. Each JSON imports as a separate workflow, inactive and in fixture-only mode. No n8n skill, n8n instance, Microsoft credentials or live Supabase connection was available during authoring. Node types follow n8n's documented core nodes; importing into your installed version still needs verification.

## Files and import order

| File | Purpose |
| --- | --- |
| WF01-mail-intake.json | Validate email, persist/deduplicate, use existing CRM lookup, classify and queue a route |
| WF00-knowledge-ingestion.json | Extract documents, split passages, embed and store unpublished knowledge |
| WF02-reply-drafting.json | Retrieve customer/thread/approved knowledge context and save a review draft |
| WF03-quotation-preparation.json | Load confirmed pricing inputs, call the calculator, validate and request approval |
| WF05-teams-approval.json | Validate approval snapshot, send a Teams notification with authenticated review link, record notification |
| WF05B-approved-dispatch.json | Claim an approved message, validate lease/revision and call the single sender |
| WF06-followups-digest.json | Reconcile mail, prepare follow-up drafts and publish database-derived digest |

WF04 is omitted. Tender emails go to manual review. Every customer-facing reply requires approval in this initial package. Future template-only auto-replies need a separately implemented policy.

## What works locally

- Valid JSON exports, node connections and standalone Code-node validation.
- Manual sample runs choose a branch that makes **no external requests** and labels its output `sample_only`, `dry_run: true`, `persisted: false`.
- Input validation, deterministic route policy, source requirements, quotation contract checks, exact approval revision checks and lease checks.
- Customer lookup nodes reference the existing `/api/crm?action=lookup` endpoint.
- Teams notification uses Microsoft Graph's chat message endpoint with a delegated Teams OAuth2 credential.

The sample branch is not a simulated integration test: it bypasses production processing and returns an illustrative result. Invalid-input and business-gate tests are run separately by `verify.mjs`.

## What must be connected/implemented

All `/api/automation/v1/*` endpoints are **proposed adapters, not implemented in this repository**. CONTRACTS.md defines them. Most AI, database persistence, extraction and sending work sits behind those adapters in this scaffold. You can implement them in the backend or replace a node with equivalent n8n/Supabase/model nodes while preserving the same contract.

Additional required work: mail synchronization/Outlook trigger, database migrations and RPCs, model credentials and prompts, extraction/embedding service, an authenticated approval page and decision endpoint, outbound sender/reconciliation, durable task dispatch, retry recovery/error workflow, scheduling and dashboard views. Do not activate these workflows expecting those services to exist.

Supabase knowledge tables currently have no retrieval function or configured embedding dimension. `crm_documents` and `crm_knowledge_chunks` are the intended existing records to extend. Customer matching already uses `crm_customers`, `crm_contacts`, sites, equipment, purchases and services.

The current dashboard uses a custom server session, not Supabase Auth. Keep database access behind that authenticated server API. Do not add public table policies just to make a workflow work. A browser cannot directly consume Supabase Realtime under the present access model; authenticated API polling is the first dashboard integration option.

## Import and configure

1. Import each JSON separately using n8n's workflow file import. Check node versions against your installation: Code v2, HTTP Request v4.2, IF v2.2, Webhook v2.
2. Run `Manual test`. Expect a clearly labelled sample result and no persistence.
3. Create a Header Auth credential for task webhooks, e.g. `X-Automation-Task-Key`. Use it only between trusted task dispatcher and n8n. Assign it to every `Authenticated task webhook`.
4. Assign backend Header Auth credentials to HTTP nodes. The **existing customer lookup** requires `Authorization: Bearer AUTOMATION_API_TOKEN`. New adapters should use a separate scoped integration token; the lookup token does not authorize writes.
5. In each `Configuration` node, set `api_base` to the deployed HTTPS dashboard/backend origin. Keep `dry_run: true` until dependencies are implemented. Payloads cannot switch this flag.
6. On WF05's Teams node, select a Microsoft Teams OAuth2 credential with delegated chat-send permission appropriate to the target chat. Test using a private test chat. Graph access must be configured by the tenant administrator as necessary.
7. Implement contracts/database state first, then test each production branch against an isolated backend and test mailbox. The sender must independently default to non-live mode.
8. Assign an n8n Error Trigger workflow and set retention/redaction appropriate to email content. Error execution data can contain sensitive input. Set external integration-health alerts and stuck-job reconciliation before production.
9. Enable the required production workflow webhooks only after import and end-to-end testing. Callers should consider webhook HTTP success an **execution receipt, not business completion**. Completion must come from persisted job/events.

## How separate workflows connect

Only one mailbox synchronizer should deliver incoming messages to WF01. Its accepted message and processing job must be durable before acknowledgement is relied upon. The adapter behind `mail/route` saves the classification and queues a WF02 or WF03 job in the same transaction. A dispatcher leases pending jobs and posts their documented payload to the destination production webhook.

WF02/WF03 persist draft/quote revisions and queue WF05. WF05 records a Teams notification; it does not accept a caller-supplied approval decision. Raza follows the review link and signs in. The future approval endpoint validates identity/current snapshot atomically, records the decision, and queues WF05B only after approval.

WF05B calls the one authoritative sender. That server records attempts before calling Outlook and reconciles uncertain outcomes. Do not enable automatic n8n retries on the send HTTP node. If HTTP times out, inspect/reconcile the persisted attempt rather than rerunning the execution from the send step.

WF06 is invoked by a scheduler at 09:00 America/Toronto (including daylight saving). Add the Schedule Trigger after replacing its test input with the local business date, or have a durable scheduler post the documented payload. Urgent alerts and stuck-job detection need their own shorter schedule. Document ingestion is invoked from the authenticated document upload process.

## Teams limitation

This version sends a **review link**, not inline Approve/Reject buttons and not a native Microsoft Approvals record. The authenticated page remains an external dependency. This avoids claiming the recipient's identity from possession of a response URL. Native Teams card decisions can replace this later through a verified bot/Power Automate adapter using the same approval records.

## Verification

Run from project root: `node automation/n8n/verify.mjs`.

This checks export structure and executes Code nodes in an isolated harness. It does not establish n8n import compatibility, Microsoft consent, live SQL correctness or provider delivery. No database migration, external message, deployment or existing dashboard code change is made by this package.

References consulted:
- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/
- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/
- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.code/

