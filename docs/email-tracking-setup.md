# Activate shared email tracking

For the current end-to-end setup, table map, migration order, daily metrics and migration from Teams approval, use [the n8n dashboard automation guide](n8n-dashboard-automation-guide.md). Apply `202609240001_reporting_and_proposals.sql` for performance reporting, sent-copy reconciliation and standalone customer proposals. Microsoft now uses delegated sign-in, described in `microsoft-mail-setup.md`.

The tracking system is provider-independent. Outlook is the intended mailbox connection; customer, conversation, draft, approval and activity IDs are owned by Supabase. Microsoft conversation/message IDs are external references, not database primary keys.

## 1. Run the new SQL migration

Your customer CRM and calculator-rate tables have been verified as present. In **Supabase → SQL Editor → New query**, run the full contents of:

`supabase/migrations/202609230002_email_tracking.sql`

Run it once. It creates these tables, their indexes, RLS restrictions and transactional server functions:

| Table | Purpose |
| --- | --- |
| `email_mailboxes` | Provider and mailbox identity |
| `email_sync_cursors` | Per-folder Outlook delta checkpoints and sync leases |
| `email_threads` | Customer, status, owner, priority, next action, follow-up date and summary |
| `email_messages` | Incoming/outgoing messages and original content loaded on demand |
| `email_attachments` | Attachment metadata and provider references; storage path reserved for later file copies |
| `email_drafts` | Shared editable reply, original AI text, revision and dispatch status |
| `email_draft_revisions` | Saved bodies, recipients, timestamps and actors |
| `email_approvals` | Exact reviewed draft revision and server-only provider review token |
| `email_automation_jobs` | Draft-generation jobs, leases, failures, execution IDs and dispatch records |
| `email_activity` | Conversation activity history |

The migration does not send email, connect Outlook, generate AI drafts or import sample records. Tables are inaccessible to anonymous/browser Supabase roles. Keep the service key server-only. The current authentication model remains a single-owner workspace; separate organization membership and tenant scoping are required before serving multiple independent businesses.

## 2. Connect Outlook when ready

Follow `docs/microsoft-mail-setup.md` to configure mailbox-scoped Microsoft permissions. Set the server environment:

```dotenv
MAIL_PROVIDER=microsoft
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/microsoft-oauth-callback
APP_BASE_URL=http://localhost:3000
```

Keep the existing login and Supabase variables. Restart/redeploy the application after changing environment variables. Existing provider configuration has not been changed by this implementation.

The tracking screen is the default authenticated Inbox view. **Open mailbox** accesses the existing provider mailbox interface. Preview mode stays separate and does not create real tracking records.

## 3. Use the dashboard

1. Open Inbox and click **Sync mail** for Inbox, then Sent mail. Outlook uses a durable delta checkpoint per folder; **Import next page** continues initial backfill. Once backfill completes, later syncs fetch incremental changes.
2. Select a conversation. Set its customer, owner, priority, status, next action and follow-up date. Save details.
3. Expand messages to load their original content and attachment metadata. Attachments download through the authenticated provider backend. Remote images are blocked in HTML messages.
4. Write and **Save draft**. The draft and its revision history are shared in Supabase. A later user edit cannot silently overwrite a newer revision.
5. **Review & send** prepares a provider reply and shows exact recipients, subject and body. The final **Send this reply** button sends a real email.
6. Submission is recorded separately from delivery. Sync Sent mail and select the matching outgoing copy to confirm it. A send timeout or server crash does not automatically unlock the draft for another send.

Current tracked replies support one incoming sender, a text body and no outgoing attachments. Reply-all, custom recipients, forwarding and attachments remain available through the existing mailbox interface; those actions do not use the new tracked-draft approval ledger. Incoming attachment binaries are not copied to Supabase Storage yet. Provider deletions do not erase historical tracking records; an original attachment or body may become unavailable after deletion.

Outlook sync covers the selected folders; the included schedule covers Inbox and Sent Items. Add sync calls for other folders if mailbox rules route customer mail elsewhere. Lists use cursor pagination, conversation history loads in pages of 30, and automation context is bounded to the latest 10 messages.

## 4. Configure n8n

Use a separate random server secret, at least 32 characters:

```dotenv
EMAIL_TRACKING_TOKEN=...
```

Do not reuse a browser key. The tracking token allows intake and leased drafting jobs only. It cannot approve, send, or update user workflow decisions. The existing `AUTOMATION_API_TOKEN` retains its customer-lookup role.

Import these **inactive** workflows:

- `automation/n8n/workflows/TRACK01-mail-intake.json`
- `automation/n8n/workflows/TRACK02-draft-worker.json`
- `automation/n8n/workflows/TRACK03-daily-report.json` (optional report data; no messages sent)

In n8n:

1. Set `DCX_DASHBOARD_URL` in Variables to the deployed HTTPS origin, without a trailing slash. If your n8n plan does not support Variables, replace the `$vars.DCX_DASHBOARD_URL` expression in each HTTP Request node with that fixed origin.
2. Create an HTTP Header Auth credential: header `Authorization`, value `Bearer <EMAIL_TRACKING_TOKEN>`. Select it on every dashboard HTTP Request node.
3. In the draft worker, connect your preferred **Chat Model** node to **Prepare reply** and configure that model's credentials. No model vendor is hardcoded. The chain requests a JSON object with `body` and `summary` strings; validation rejects other output.
4. Test with a dedicated test mailbox and review the resulting drafts. Activate the workflows only after the complete claim → context → draft → save path succeeds.

Intake checks one bounded page per folder per run and queues a draft for eligible conversations with no open draft. Outlook checkpoints persist across runs, so initial backfill continues rather than repeatedly reading the same first page. The worker claims one job per run. Adjust schedules or add workers based on queue age and mailbox throttling. Five-minute leases and atomic claims permit multiple drafting workers without processing the same lease. After three expired attempts a job becomes failed. A late model result cannot overwrite a human edit, workflow change, or newer message.

The workflows are importable templates, not deployed executions. The AI node still needs a model and credentials. No workflow sends email. Actual sending remains an explicit authenticated dashboard action backed by the same durable dispatch ledger.

## API contract

All routes use `/api/tracking?action=...`. Dashboard calls use the signed login cookie and same-origin POST protection. Automation uses the dedicated bearer credential.

| Action | Method/access | Input / result |
| --- | --- | --- |
| `overview` | GET, dashboard | Shared queue counts and recent conversations |
| `threads` | GET, dashboard | `status`, `q`, `cursor`; returns 30 rows and next cursor |
| `thread` | GET, dashboard | `id`, optional `cursor`; messages, current draft, recent jobs/activity |
| `sync` | POST, dashboard/worker | `{folder:"inbox"}` or `sentitems`; worker can set `generate_drafts:true` |
| `hydrate` | POST, dashboard | `{thread_id,message_id}`; full body and attachment metadata |
| `attachment` | GET, dashboard | `id`; authorized redirect to provider download |
| `update_thread` | POST, dashboard | Thread ID, expected version, status, priority, customer, owner, next action, follow-up |
| `save_draft` | POST, dashboard | `{thread_id,reply_to_message_id,revision,body}`; revision 0 creates a draft |
| `queue_draft` | POST, dashboard | `{thread_id,request_id}`; caller-generated UUID makes retries idempotent |
| `review` | POST, dashboard | `{draft_id,revision}`; exact reviewed content, no provider token exposed |
| `send` | POST, dashboard | `{draft_id,revision}`; atomically claims dispatch before provider call |
| `confirm_sent` | POST, dashboard | `{draft_id,message_id}`; user-confirmed matching outgoing copy |
| `claim` | POST, worker | `{execution_id}`; returns a job/lease or null |
| `context` | POST, worker | `{job_id,lease_token}`; scoped customer and latest message context |
| `complete` | POST, worker | `{job_id,lease_token,body,summary}`; saves revision unless stale |
| `fail` | POST, worker | `{job_id,lease_token,error}`; records an actionable failure |

## Verification and remaining activation work

Local tests exercise the SQL in a PostgreSQL-compatible PGlite database and the HTTP API against it. They cover deduplication, revisions, approval invalidation, repeated dispatch, stale AI results, worker leases, synchronization leases, access restrictions and provider-neutral identities. Provider calls in those tests are mocked; no real email was sent.

Still required: run the migration in your Supabase project, connect Outlook, configure/import the n8n workflows and chosen model, then perform live integration testing. Browser visual QA and a live Outlook/n8n run were not available in this session.

References: [Microsoft incremental message sync](https://learn.microsoft.com/en-us/graph/delta-query-messages), [Microsoft draft-send response semantics](https://learn.microsoft.com/en-us/graph/api/message-send?view=graph-rest-1.0), [n8n HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/).
