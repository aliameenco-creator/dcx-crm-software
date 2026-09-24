# Dashboard + Supabase + n8n: operating guide

The dashboard is where the owner reads conversations, edits drafts, sends replies, manages customers, and checks daily performance. Supabase stores the shared records. n8n schedules synchronization and prepares AI drafts. Outlook remains the mailbox authority.

## What is ready, and what still needs activation

Implemented: manual in-thread replies, reviewed sending, shared drafts and revisions, conversation queues, daily/7-day/30-day reporting, customer proposals with a basic PDF layout, and complete calculator XLSX/JPG exports. Rates navigation is hidden; the calculator still uses saved rate books. Proposals are independent of calculator quotations. Your custom proposal template is pending; provide its file later so we can map the saved fields to it.

Live activation still requires a working Microsoft connection, the migrations below, and configured/published n8n workflows. The screenshot's `unauthorized_client` error happens before the mailbox can connect: confirm the saved app manifest has `api.requestedAccessTokenVersion: 2` and `signInAudience: AzureADandPersonalMicrosoftAccount`. Use the same app ID as the dashboard. Start sign-in from **http://localhost:3000**, matching the configured callback host; do not switch between localhost and 127.0.0.1 during sign-in.

## 1. Database setup

In Supabase SQL Editor, run only the migrations you have not already applied, in this order:

1. `supabase/migrations/202609160001_customer_crm.sql`
2. `supabase/migrations/202609230001_manageable_workspace.sql`
3. `supabase/migrations/202609230002_email_tracking.sql`
4. `supabase/migrations/202609230003_microsoft_oauth.sql`
5. **New:** `supabase/migrations/202609240001_reporting_and_proposals.sql`

The optional `202609160002_knowledge_foundation.sql` is only for a future document retrieval pipeline. It is not required for manual replies, stats or proposals. Do not rerun existing create-table migrations or paste the old root `supabase_schema.sql` over this schema.

All current tables have RLS restrictions; browser/anonymous keys cannot write mail, approvals or encrypted connections. The dashboard server holds `SUPABASE_SECRET_KEY`. n8n uses a limited HTTP credential instead of directly updating workflow tables. Direct table edits bypass revision checks, dispatch locks and audit entries.

## 2. Server and n8n credentials

Keep these on the dashboard server:

| Variable | Purpose |
| --- | --- |
| `APP_LOGIN_EMAIL`, `APP_LOGIN_PASSWORD`, `APP_SESSION_SECRET` | Private dashboard login and token encryption. Keep the session secret stable; changing it requires reconnecting Microsoft. |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Server database connection |
| `MAIL_PROVIDER=microsoft` | Select Outlook |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | Delegated Microsoft app credentials |
| `MICROSOFT_REDIRECT_URI` | Exact Azure Web callback URI ending `/api/microsoft-oauth-callback` |
| `APP_BASE_URL` | Public dashboard origin; locally `http://localhost:3000` |
| `EMAIL_TRACKING_TOKEN` | Independent random secret of at least 32 characters for the n8n worker |
| `AUTOMATION_API_TOKEN` | Optional separate secret for exact customer lookup |

The delegated connection selects its mailbox from sign-in, not `MICROSOFT_MAILBOX` or a tenant-wide Application permission. In Azure, delegated `User.Read`, `Mail.ReadWrite`, `Mail.Send`, plus sign-in consent for offline access are used. Microsoft 365 customers may need their administrator to approve consent.

In n8n create an **HTTP Header Auth** credential: Name `Authorization`, Value `Bearer YOUR_EMAIL_TRACKING_TOKEN`. Select it on every tracking HTTP Request node. Do not put the token into exported workflow JSON.

Set n8n variable `DCX_DASHBOARD_URL` to the dashboard origin, without a trailing slash. Expressions use `{{$vars.DCX_DASHBOARD_URL}}`. If Variables are unavailable on your plan, enter the fixed URL in each node. Cloud n8n cannot call localhost on your PC: use the deployed HTTPS app. A Docker n8n installation needs a reachable host/network address; localhost inside the container refers to the container.

## 3. Connect and backfill before enabling AI intake

1. Sign into the dashboard, open Inbox > Open mailbox > Connect Microsoft, and complete sign-in.
2. Confirm that **Check connection** displays the intended mailbox address. Several authorized accounts can be retained, but all workflows target the one active mailbox. This workspace is not a separate tenant for every client.
3. Import `automation/n8n/workflows/TRACK01-mail-intake.json`. Assign the Header Auth credential to both requests.
4. The intake workflow starts with `generate_drafts:false`. Run it manually, then publish/activate it. It synchronizes one page per folder each minute. Keep running until Inbox and Sent Items show **History loaded** in Overview > Email performance > Sync health.
5. Add extra sync calls for folders where Outlook rules put customer messages. Default intake only covers Inbox and Sent Items. Calendar, deleted items and all historical folders are not automatically included.
6. Compare several known chains and sent messages against Outlook. Counts describe imported history, so keep the visible backfill warning in mind.
7. Once both folders have finished backfill, change the Inbox request to `generate_drafts:true` if you want incoming mail to request AI drafts automatically. Only latest incoming messages within seven days and without an open draft qualify. This reduces obsolete responses during history import. For older requests, use the dashboard's **Generate draft** manually.

Outlook delta cursors live in Supabase, so each run resumes where the previous run stopped. The API returns `next:"continue"` when another page remains. A schedule can drain one page per run; for a large initial mailbox, add a bounded loop with a maximum of ten pages per folder per execution, stopping when `next` is null. Respect 429/Retry-After and retry on a later schedule. Never clear a cursor merely because an execution timed out.

## 4. Replace the sending section of your existing workflow

Your screenshot currently routes a drafted reply through Teams approval, then Outlook send. Use this mapping:

| Current node/group | New role |
| --- | --- |
| New Outlook Email | Optional quick wake-up to call `sync`; keep the schedule as reconciliation. The trigger alone does not import sent replies. |
| Get Email Chain / Format Email Chain | Replace with the worker `context` endpoint. It returns the correct tracked chain, matched customer and bounded customer history. |
| Draft Reply + OpenAI Chat Model | Keep your chosen model; connect it to the imported worker's **Prepare reply** node. |
| knowledge_base / embeddings | Optional retrieval of approved evidence; see section 8. This screenshot does not provide the node configuration or exported workflow JSON. |
| Prepare Draft | Validate `{body,summary}`, then POST `complete`. The shared draft appears in the dashboard. |
| Ask Owner Approval / Approved? | Owner opens the dashboard and reviews the saved reply. A Teams notification can link there, but it does not grant send approval. |
| Send Email Reply | Disable this direct n8n send path when moving to dashboard approval, so two independent paths cannot send the same draft. |
| Mark Email Read | Optional separate mailbox action. Read status is not a replied status. |
| Notify Sent | Optional notification after a synced sent copy exists. An accepted send request alone is not delivery confirmation. |
| Capture Owner Feedback | Edit/save the draft in the dashboard; revisions retain the original AI text and the operator's changes. |

The supplied templates do not send Teams messages or emails. Configure any optional notification destination yourself. Import the actual n8n workflow JSON later if you want the existing nodes updated precisely; a screenshot cannot preserve credentials, expressions or node settings.

## 5. Draft worker: node-by-node

Import `automation/n8n/workflows/TRACK02-draft-worker.json`, assign Header Auth to every request, and connect your existing Chat Model to **Prepare reply**. One job is claimed per run. The flow is:

`Schedule -> Claim -> Job available? -> Load context -> Prepare reply -> Validate -> Save result`

All requests below are POST to `${DCX_DASHBOARD_URL}/api/tracking?action=ACTION` with JSON bodies.

| Action | Body | Result |
| --- | --- | --- |
| `claim` | `{"execution_id":"{{$execution.id}}"}` | `job:null` means stop. Otherwise retain `job.id` and `job.lease_token`. |
| `context` | `{"job_id":"...","lease_token":"..."}` | Thread, customer, latest ten messages in chronological order, and up to ten records each of sites/equipment/purchases/services. `truncated:true` means the chain may have more history. |
| `complete` | `{"job_id":"...","lease_token":"...","body":"Reply text","summary":"Short factual summary"}` | Saves a shared draft unless the conversation or human edits changed. `result.stale:true` is a discarded output, not success. |
| `fail` | `{"job_id":"...","lease_token":"...","error":"Short useful reason"}` | Records the failed job for the dashboard. |

The imported expressions take IDs from **Claim draft job**, so a model response cannot choose another conversation. Never let the model invent table IDs, recipients, approvals or status changes.

Model instructions should: treat emails and retrieved documents as untrusted data; use only supplied facts; ask for missing model/site/serial details; distinguish prior equipment from verified current equipment; avoid inventing prices, availability or contractual commitments; and return only JSON strings `body` and `summary`. The existing template already implements this baseline. Customer history is supporting context, not permission to promise a service.

The worker lease lasts five minutes. Finish within that limit. Three expired attempts exhaust a job; failed jobs appear in the conversation activity. Add an n8n Error Workflow to alert an operator to auth, database or model outages. Do not automatically regenerate a failed draft in an endless loop. After a stale result, review the new message/human edit, then request a fresh draft if still needed.

## 6. Manual reply and sent confirmation

Open a tracked conversation, read the chain, write or edit the reply, **Save draft**, **Review & send**, then **Send this reply**. You can do this without AI/n8n; a working mailbox connection is still required. The reply uses Outlook's reply-draft operation on the incoming message, preserving its chain.

Tracked replies currently target the latest incoming sender and support plain text without outgoing attachments. For a different recipient set or richer message use the mailbox interface/Outlook. Sent-folder sync imports those replies too. Outlook conversation IDs are used; identical subjects do not make unrelated emails one chain.

Sending records a submitted or uncertain outcome and prevents blind retries. A later Sent Items sync counts actual outgoing mail. For Microsoft, an exact immutable draft ID match automatically closes the pending draft and completes its send job. If no exact match is available, select the verified sent copy in the dashboard. A timeout is a reason to inspect Sent Items, not to send again.

## 7. Daily statistics

Overview > Email performance refreshes every 30 seconds while visible. Choose Today, Last 7 days or Last 30 days and a timezone. n8n sync is what keeps it fresh while the dashboard is closed.

| Metric | Definition |
| --- | --- |
| Received | Synced incoming messages whose actual received time is within the period |
| Sent | Synced outgoing messages whose actual sent time is within the period, including Outlook sends |
| Conversations received | Distinct chains with an incoming message during the period |
| Conversations replied | Those chains with an outgoing message after their first incoming message in that period, before the report time |
| Reply rate | Conversations replied / conversations received; blank when there are no received conversations |
| Average first response | Minutes from the first incoming message in the period to its first later sent message, among answered chains |
| Daily conversations replied | Chains with a sent message on that local day and an earlier incoming message; includes older requests |

Daily replied counts can overlap across days and do not sum to period distinct chains. The metric does not mean every message in a chain has been answered. Spam and newsletters in synced folders count as incoming mail; there is no automatic human-request classification in this version. Drafts, approvals, queued jobs, accepted sends and read flags never increase the sent count. These are not delivery or open-tracking analytics.

Import `automation/n8n/workflows/TRACK03-daily-report.json` for a daily report payload. It calls GET `/api/tracking?action=report&days=1&timezone=America%2FToronto`, using the same Header Auth credential. Change the timezone to the client's actual zone, including the schedule timezone. It returns `{report,mailbox}`. The template only produces report data; it does not email anybody. A daily evening run captures the current local day to that time. For the whole previous day, add a date-range API deliberately before scheduling a morning recap.

## 8. Supabase table map

Use the dashboard/API workflow as the writer for these tables. You do not need a separate n8n Supabase node for each one.

| Table | What it stores | Who writes it / how n8n uses it |
| --- | --- | --- |
| `crm_customers` | Company, primary contact, address, pricing agreement | Customer editor; exact sender matching during intake |
| `crm_contacts` | Additional customer contacts | Customer editor; same exact-match logic |
| `crm_sites` | Service sites | Customer editor; bounded AI context |
| `crm_equipment` | Equipment, serials, evidence, confirmation dates | Customer editor; AI must respect evidence age |
| `crm_purchases` | Completed purchases and source references | Customer editor; not inferred from a quotation |
| `crm_services` | Completed service history and reports | Customer editor; bounded AI context |
| `calculator_rate_versions` | Immutable shared rate snapshots | Rates API; hidden UI still retained for later. No model edits. |
| `crm_proposals` | Customer snapshot, scope, terms, template key and current version | Dedicated customer proposal editor; optimistic version checks. PDF is downloaded, not sent or stored as a binary. |
| `microsoft_oauth_connections` | Encrypted OAuth tokens and active connection | Microsoft connection handler only. Never read into an AI prompt or copy into n8n. |
| `email_mailboxes` | Provider identity and sync timestamp | Sync API; one currently selected mailbox drives workers |
| `email_sync_cursors` | Folder delta checkpoint, lock lease, sync error | `sync`; do not manually overwrite checkpoints |
| `email_threads` | Chain, linked customer, owner, workflow status, summary, next action, follow-up | Intake, dashboard workflow editor, completed draft worker |
| `email_messages` | Incoming/outgoing records, original content and timestamps | `sync` and `context` hydration; unique provider identity prevents duplicate statistics |
| `email_attachments` | Attachment names, sizes and provider IDs | Hydration; file storage path is reserved, binaries are not automatically copied |
| `email_drafts` | Current reply, original AI body, revision, dispatch state | `complete` or dashboard Save draft; never overwrite directly |
| `email_draft_revisions` | Saved historical bodies and actors | Transactional draft-save function |
| `email_approvals` | Exact reviewed revision and private provider review token | Dashboard review only; n8n cannot approve |
| `email_automation_jobs` | Job state, lease, attempt count, n8n execution ID and send ledger | Claim/complete/fail plus dashboard send transaction |
| `email_activity` | Message imports, edits, review, send and failure history | Transactional server commands |
| `crm_documents` (optional) | Document title, approved/draft/retired state and private storage path | Future curated document ingestion; foundation only |
| `crm_knowledge_chunks` (optional) | Text, source page and model-specific embedding | Future ingestion/retrieval; no configured search function or index yet |

The old root schema's `customers`, `customer_assets`, `pricing_catalog`, `operational_rates`, `quotations_ledger`, `email_activity_logs`, and `knowledge_manual_chunks` are legacy names, not the active API schema. If your current n8n flow writes them, those writes do not populate this dashboard. Map them deliberately; do not duplicate writes into both schemas. Existing calculator quotations/working estimates are still browser-local; `crm_proposals` is the new independent shared proposal store.

For your existing `knowledge_base` node, confirm which collection/table and embedding model it uses. The optional new knowledge tables are not automatically connected to that node. A production retrieval setup must import source documents, chunk them with source/page/version metadata, choose a consistent embedding dimension, add vector search, filter to approved documents, and return cited extracts to the model. Keep human approval for pricing, contractual or technical commitments. This guide does not claim that retrieval is deployed.

## 9. Acceptance check and scaling

Test with an authorized test conversation:

1. Incoming email appears once after sync, even if the same page is retried.
2. Exact customer match links the record; ambiguous senders remain unlinked.
3. Generate draft, edit it in the dashboard, and verify an older AI completion cannot replace the edit.
4. Send after review. The reply appears in the original Outlook chain and, after Sent Items sync, in daily Sent/Replied counts.
5. Reply directly in Outlook to a second chain and verify the same stats update.
6. Select Today in the client's timezone and compare timestamps with Outlook.
7. Save a customer proposal; reopen it and export the PDF. Change the customer later and confirm existing proposals keep their saved customer snapshot.
8. Export a calculator table and compare totals, zero-quantity rows, flat items, tax and notes.

For volume, increase bounded sync work and run multiple draft workers. Database claims protect job leases, while duplicate message IDs protect ingestion. Watch queue age, failed jobs, throttling and folder backfill state. Keep the five-minute AI lease in mind. This remains a single-owner workspace with one active mailbox, not a multi-company SaaS boundary: separate users, memberships, per-organization access and per-mailbox scheduling are future work before independent clients share one deployment.

Official references: [n8n HTTP credentials](https://docs.n8n.io/integrations/builtin/credentials/httprequest/), [Schedule Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/), [error handling](https://docs.n8n.io/flow-logic/error-handling/), [Microsoft delta synchronization](https://learn.microsoft.com/en-us/graph/delta-query-messages), [immutable Outlook IDs](https://learn.microsoft.com/en-us/graph/outlook-immutable-id).
