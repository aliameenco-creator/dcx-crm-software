# Integration contracts — ups-automation-v1

This document specifies future endpoints; it does not claim they are deployed. Reuse the existing CRM tables and custom server authentication. Phase 1 is a single-business deployment. If adding multiple businesses later, derive workspace authorization from credentials/session rather than trusting an input workspace ID.

## Common envelope and task transport

Each POST adapter receives `{contract_version, workflow, correlation_id, execution_id, input, previous}`. `input` is the original normalized task, `previous` is the preceding node output. No node may assume arbitrary fields from older nodes survive an HTTP response. Retrieve the durable record by its stable ID when more context is needed.

The server validates the service credential, schema, task authorization and current DB state. It derives approval identity from the signed-in human session, never from an n8n body field. Models never receive credentials or privileged write tools.

Use durable task IDs/idempotency derived from business identity and revision, not `execution_id`: executions change on retries. POST operations return JSON objects, not arrays; errors use non-2xx HTTP status. Preserve original IDs in later records. Every mutation creates a deduplicated business activity event in the same database transaction.

Webhooks:

| Workflow | n8n path suffix | Required task fields |
| --- | --- | --- |
| WF01 | ups-v1-mail-intake | mailbox_id, provider_message_id, from, subject, body_text, direction, historical |
| WF02 | ups-v1-reply-drafting | message_id, sender_email, thread_id, question |
| WF03 | ups-v1-quotation-preparation | message_id, customer_id, scope, quote_revision_id |
| WF05 | ups-v1-teams-approval | draft_id, revision, approval_id |
| WF05B | ups-v1-approved-dispatch | outbound_id |
| WF06 | ups-v1-followups-digest | business_date YYYY-MM-DD, timezone |
| WF00 | ups-v1-knowledge-ingestion | document_id, version, storage_path |

Append paths to the production webhook prefix provided by n8n. Keep all URLs/credentials in dispatcher configuration. A posted task is not complete until the backend records its terminal event. Each item is a separate execution; do not pass batches into these flows.

## Existing endpoint

`GET /api/crm?action=lookup&email=...`: implemented in `server/crm-api.js`. Returns `status: matched|not_found|needs_review`, customer/history if matched. Ambiguity must block inferred customer association, not silently choose the first contact. HTTP failure is an integration error, not a new customer.

## Proposed backend adapters

All paths below are prefixed `/api/automation/v1/`.

| Path | Required behavior and response |
| --- | --- |
| mail/ingest | Atomically upsert mailbox/provider identity and enqueue recoverable processing. Return `{accepted:true,message_id}` when this execution owns processing; duplicate completed or already leased jobs return `{accepted:false,message_id}`. A sweeper must reclaim abandoned jobs; do not suppress failed work forever as duplicate. Preserve originals, attachments, thread/reply IDs and sync provenance. |
| ai/triage | Load ingested message using original mailbox/provider IDs; use `previous` CRM result. Return `{category,urgency,summary,secondary_intents,missing_fields,requires_reply,source_message_ids}` with category enum in WF01. Treat historical/outgoing/auto-response messages as record-only. Filter bounces and response loops at intake. |
| mail/route | Persist validated classification, thread/case links and friendly event. Atomically enqueue WF02/WF03 task or manual review/record-only outcome. Critical urgency must alert the owner independently of processing. Never parse tender packages. Return `{message_id,route,status,job_id}`. |
| knowledge/context | Combine message/thread history, `previous` CRM match and retrieved approved current passages. Return `{message_id,thread_id,customer_match,history,passages,missing_fields}`. Each passage has chunk/document/version/page IDs. Empty evidence is explicit. |
| ai/draft | Use context and prompts/reply.md. Return `{body_text,source_refs,missing_fields,technical_claims,summary}`. No commercial promises or invented facts. Body is a proposal. Reject malformed model output rather than treating it as a draft. |
| drafts/save | Recheck customer/thread context, persist immutable draft revision and source links, create pending approval/job for WF05. Return `{draft_id,revision,approval_id,status}`. Approval is not granted by workflow output. |
| quotes/context | Load authoritative quote revision and confirmed inputs; resolve explicit customer/site rate agreement. Missing agreement/rate/scope goes to review. Return `{revision_id,inputs,rate_version,missing_inputs}`. |
| quotes/calculate | Use existing validated costing code with documented approved inputs. Return `{validated:true,revision_id,formula_version,currency,total_decimal,missing_inputs:[],lines,rate_version}`. Amount string must represent deterministic rounded money. No model-generated totals. |
| quotes/render | Persist a customer-safe document excluding internal costs/margins; return `{revision_id,storage_path,content_hash}`. Requires document rendering dependency, not supplied by these exports. |
| quotes/request-approval | Load the persisted revision, create its approval snapshot and queue WF05. Return `{draft_id,revision,approval_id,status}`. |
| approvals/request | Atomically create/load pending request for exact draft revision. Return `{status:'pending',approval_id,payload_hash,review_url,teams_chat_id,approver_id,snapshot}`. Snapshot covers body/recipient/attachment hashes and quote revision. review_url must use the configured trusted dashboard origin, require a real session, and have no GET-side decision mutation. Resolve approver/chat server-side. |
| approvals/notification | `previous` is Graph chat-message response; input contains approval_id. Save message ID/chat ref/time against the pending request. Return `{approval_id,notification_status:'sent'}`. A retry after Graph success/log failure may duplicate a notification; reconcile provider message before resending. This is not an approval. |
| outbound/claim | Atomically claim one approved outbound ID with a short lease. Recheck current snapshot, expiry, recipients, attachments, newer incoming messages and existing attempts. Return `{claimed:true,authorized:true,approval_status:'approved',outbound_id,current_revision,approved_revision,lease_token,lease_expires_at,payload_hash,send_mode:'live'}` only when all checks pass. For no-op/unauthorized return non-2xx or claimed:false; the workflow stops without sending. |
| outbound/send | Validate lease and authorization again; record attempt before provider call; send exact snapshot with original thread context through canonical Outlook service. Return `{outbound_id,attempt_id,status}` where status is provider_accepted/sent_confirmed/outcome_unknown/failed. Distinguish provider acceptance from delivery. Record uncertain send on timeout and reconcile Sent Items before considering another attempt. Never make a fresh send simply because an execution was retried. |
| followups/sweep | Reconcile Inbox/Sent before selecting due three/seven-day milestones. Exclude customer replies, manual replies, closed/expired/accepted/rejected quotes and opted-out recipients. Claim tasks atomically and deduplicate milestones. Return `{business_date,task_ids}`. |
| followups/prepare | Recheck claimed tasks; prepare drafts, owner reminders and approval jobs. No customer send. Use confirmed installation dates for lifecycle reminders. Return `{business_date,draft_ids,reminder_ids}`. |
| reporting/digest | Count durable business events using configured local-date boundaries. Separate received-today, confirmed sent-today by actor, pending backlog and failures. Return `{business_date,summary,event_ids,metrics}`. |
| reporting/publish | Persist digest and notify owner through configured adapter, idempotent by business date/version. Dashboard queries same records. Return `{digest_id,status}`. |
| knowledge/extract | Authorize private path, claim document/version, detect duplicate bytes and extract PDF/Word/text or supported OCR. Reject unsupported/oversize input. Return `{document_id,version,content_hash,pages:[{page,text}]}`. No macros/scripts. |
| knowledge/embed | Input previous contains chunks; embed content with one configured model/dimension, bounded requests. Preserve all chunk metadata. Return `{document_id,version,content_hash,embedding_model,dimension,chunks:[{chunk_index,content,source_page,embedding}]}`. |
| knowledge/persist | Transactionally replace/upsert chunks only for the exact unmodified document version, store embedding metadata and mark ready for review. Do not automatically approve. Return `{document_id,version,status:'draft',chunk_count}`. |

## Human approval endpoint (not a workflow webhook)

The authenticated dashboard review page submits a CSRF-protected POST to a future approval decision endpoint. The server verifies the designated user, pending status, expiry and revision hash under a lock. Approve records a decision and creates one outbound job; reject/request-changes records a comment and no send job. Price/body edits create a new revision and invalidate old approvals. Repeated/expired/unauthorized decisions cannot create another job. Tokens or webhook payloads from n8n cannot impersonate a human session.

## Supabase foundation needed

Extend the existing `crm_*` records with durable threads/messages/attachments, draft revisions, approvals, outbound attempts, tasks, events and health tables. Keep browser roles denied as in the existing migrations and expose authorized dashboard API queries. New migrations/RPC implementations are intentionally a separate integration step; **these exports contain no runnable SQL migration**.

Reuse `crm_documents`, `crm_knowledge_chunks`, private `crm-private` storage and the existing customer/history tables. Select one embedding model and dimension before creating the search RPC/index. Search must require approved current document versions and return provenance; exact customer matching and pricing use relational SQL. Schema/version migrations must not discard existing vectors or contacts.

Required event fields: event_id, deduplication_key, event_type, occurred_at, actor_type, actor_id, correlation_id, message/thread/customer/draft/approval/outbound IDs where relevant, friendly_summary and technical execution reference. Actor attribution is server-derived. Log facts, not private model reasoning.

## Operational tasks before activation

Implement a dispatcher with persistent leases, bounded retries and a dead-letter view; a mailbox reconciliation worker; a send-outcome reconciliation worker; and a sweep for stalled approvals/jobs. Capture workflow errors through an n8n Error Trigger integration and show integration health in the dashboard. Database idempotency constraints are necessary in addition to the Code-node gates. Test each adapter independently and end-to-end before disabling fixture mode.
