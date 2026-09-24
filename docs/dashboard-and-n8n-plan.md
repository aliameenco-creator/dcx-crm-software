# A manageable operations dashboard

Update: the shared email-tracking implementation is now in the project. See [email tracking setup](email-tracking-setup.md) for the migration, Outlook connection, n8n templates, supported actions and activation steps. The staged plan below records the earlier architecture; use the setup guide for current email functionality.

## What this change delivers

Five destinations: Overview, Inbox, Customers, Cost calculator, Rates. Tender workspace, Knowledge & templates, Settings, the redundant company card, and the global connection badges are removed. Existing stored tender and knowledge data is preserved.

Customers have a Make proposal action beside their name. It opens an estimate with saved customer information and pricing agreement. The existing quotation review and print/PDF flow remains available. The final one-click proposal export will use the template supplied later; the app must not invent that template or treat an incomplete estimate as a finished proposal.

Customer forms now save primary contact, email, phone, billing address, pricing agreement and notes through the server. Additional contacts, service sites, equipment and history remain in the customer profile. Both primary and additional contact emails participate in exact sender lookup; ambiguous matches require review.

Rates save as immutable snapshots in `calculator_rate_versions` through the authenticated server. Each save records a version, timestamp and actor. Concurrent edits are rejected instead of silently overwriting changes. The calculator loads shared books on startup; existing estimates keep their snapshots and offer a refresh when a newer version exists. Preview mode stays local and says so.

## Current deployment gap

The configured Supabase project was checked read-only during this change. Neither `crm_customers` nor `calculator_rate_versions` is present in its REST schema. Server credentials exist, but no database connection or management token is available to apply SQL.

Apply these migrations, in order, using Supabase SQL Editor or an authenticated migration runner:

1. `supabase/migrations/202609160001_customer_crm.sql` (only if the CRM tables do not already exist).
2. `supabase/migrations/202609230001_manageable_workspace.sql`.

Then reload the app, create a customer, review the initial rates, and save each required book. No sample customers or unreviewed rates are uploaded automatically. A successful save followed by a reload in another signed-in browser is the live persistence acceptance check. Failed database saves retain edits and do not report local fallback as success.

Quotes, working estimates, and the overview activity feed still use browser storage. Live email uses the configured provider. AI drafts, shared workflow state, and n8n execution tracking are a subsequent backend phase, not activated by this UI change.

## Screen design

| Screen | Main content | Main actions |
| --- | --- | --- |
| Overview | Needs attention, drafts ready, overdue follow-ups, pending proposals, recent activity | Open the exact conversation, customer or proposal |
| Inbox | Left: work filters. Middle: conversations. Right: full history, summary, linked customer, editable draft | Save draft, review and send, assign customer, create proposal, close |
| Customers | Searchable customer list; simple profile with contact details, sites and history | Add/edit customer, Make proposal, open prior proposals |
| Cost calculator | Customer, scope, site, quantities and calculated totals | Save estimate, review proposal, export |
| Rates | Standard and partner rate books, editable costs/margins, saved versions | Save draft rates, publish reviewed version |

For the shared inbox phase, use filters All, Needs attention, Draft ready, Waiting for customer, Closed. Display a status, owner, next action, follow-up date and last activity on each conversation. A draft editor sits below the history, so the user can review evidence and edit in one place. Save must distinguish Saved, Saving, Unsaved changes and Failed. Sending must show the exact recipients, attachments and final body. A failed automation appears on the affected conversation and in Needs attention, with a specific retry action.

Keep technical configuration in deployment environment variables. Use inline errors and a retry button where a failure affects work; removing Settings must not hide failures.

## Responsibilities

The dashboard is the control surface. Supabase owns customer data, conversation state, draft revisions, approvals, proposal revisions and durable jobs. The mail provider owns actual mailbox messages and delivery. n8n performs asynchronous integration work. Keep ordinary customer/rate edits and deterministic calculations in the application API; they should not stop working because an automation worker is down.

Use internal UUIDs for business entities and separate provider IDs. The application already supports Hostinger and Microsoft; do not require an Outlook migration for this redesign. Use `provider`, `mailbox_id` and `provider_message_id` rather than Microsoft-specific columns everywhere. For Microsoft, request immutable IDs consistently when implementing synchronization.

## n8n workflows to build

| Workflow | Trigger and work | Durable result |
| --- | --- | --- |
| Mail intake | Provider notification/poll; reconcile cursor; deduplicate; fetch message and attachments; match customer | Message, thread, attachment references, activity event |
| Draft preparation | New message or explicit regenerate; classify; retrieve relevant customer history; prepare reply | Summary, original AI draft, editable revision, draft-ready state |
| Draft synchronization | Saved revision creates a job; update provider draft if supported | Provider draft ID, synchronized revision or actionable error |
| Reviewed dispatch | User explicitly confirms final recipients/body/attachments; backend freezes approved revision and queues job | Sending state, provider submission, later sent reconciliation |
| Proposal rendering | User requests export from a complete estimate | Customer/rate/template snapshots, generated PDF, private storage link |
| Follow-ups | Scheduled query of due conversations; skip closed or recently answered threads | Reminder and optional draft for review, never automatic send by default |
| Failure monitoring | Failed job or expired lease | Retry count, last error, alert on affected record |

Existing `automation/n8n/workflows` files are starting points, not proof of deployed automation. Reconcile their contracts with the current provider and proposed schema before activating them. Optional Teams approvals can be added later against the same approval records; they are not needed for the first usable release.

## Database additions for the shared workflow phase

Reuse `crm_customers`, `crm_contacts`, `crm_sites`, `crm_equipment`, the history tables and rate versions. Add migrations for:

- `workspaces` and `workspace_members`: identity, membership and roles before offering multiple organizations or employee logins. The current application is a single-owner workspace.
- `mailboxes`: workspace, provider, address, sync cursor, sync health.
- `email_threads`: workspace, mailbox, customer, subject, status, owner, priority, next action, follow-up time, last activity, revision.
- `email_messages`: thread, provider ID, internet message ID, direction, recipients, body, timestamps. Unique provider ID within each mailbox.
- `email_drafts` and `draft_revisions`: original AI text, current body, recipients, attachment IDs, provider draft ID, source message version, immutable approved revision.
- `approvals`: decision, actor, timestamp, approved revision/content hash. Any content or recipient change invalidates the approval.
- `proposals` and `proposal_revisions`: customer and site snapshots, estimate inputs, rate version, calculation version, template version, totals and generated-file reference. Assign proposal numbers atomically on the server.
- `attachments`: private storage path, size, MIME type, source message, extraction status. Use short-lived authorized download links.
- `automation_jobs`: unique idempotency key, entity reference, type, state, lease, attempts, next retry, error and n8n execution ID.
- `activity_events`: append-only business history with actor, action, entity ID, timestamp and revision references.

Add workspace scoping to existing tables and server queries before multi-tenant use. Enable RLS and restrict direct access; never expose the service key to browsers. Index mailbox/provider identity, thread last activity, customer references, and due jobs/follow-ups. Paginate lists by stable cursors and fetch a conversation only when opened. Avoid loading all email bodies or lifetime activity into the overview.

## Reliable job execution

Write the requested business change and outbox job in one database transaction. The browser talks to the authenticated application server, never to an unprotected n8n webhook. Workers claim jobs atomically with leases and use unique event keys to prevent duplicate intake. Retries use bounded exponential backoff and a failed state that a person can inspect.

Do not blindly retry an uncertain email send. Microsoft Graph returns `202 Accepted` with no response body for draft send; that is not a returned sent-message record or proof of delivery. Record submission, then reconcile Sent Items/provider state before marking Sent or retrying. Lock the draft revision before dispatch so edits cannot race with a send. A proposal export should also have an idempotency key based on proposal revision and template version.

Start with a small n8n deployment; scale with queue mode and Redis-backed workers when observed backlog requires it. Keep business state in Supabase, not in n8n execution history. Keep large attachments in private object storage and pass references to workers. Monitor queue age, failed jobs, provider throttling, sync delay and draft generation latency. Provider rate limits need per-mailbox concurrency controls even when adding workers.

## Delivery order and acceptance checks

1. **Shared customers and rates:** apply migrations; verify customer/rate save and reload across browsers; reject stale rate edits; confirm no service key in client bundle.
2. **Shared proposals:** move quotes/revisions out of local storage; add template mapping after template delivery; test export against real customer/site data and frozen rates. Export must omit internal costs/margins.
3. **Tracked inbox:** provider-backed intake, shared statuses, revisioned drafts, job/activity records; dashboard history and reply editor. Test duplicate notifications, changed drafts and failed provider writes.
4. **Reviewed dispatch:** explicit review, locked content, send reconciliation, no duplicate delivery on retry; use a dedicated test mailbox for integration validation.
5. **Follow-ups and scale:** reminders, optional Teams actions, paging, scoped membership, workers and monitoring; test recovery after a worker restart and provider throttling.

## References

- [n8n queue mode](https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/enable-queue-mode)
- [Microsoft Graph: send an existing draft](https://learn.microsoft.com/en-us/graph/api/message-send?view=graph-rest-1.0)
- [Microsoft Graph immutable identifiers](https://learn.microsoft.com/en-us/graph/outlook-immutable-id)
