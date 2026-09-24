# Professional mailbox architecture

## Product goal

The dashboard should be the owner's normal email workspace, not a reporting screen beside Outlook. Inbox, Sent, Drafts, Archive, search, conversation history, attachments, composing, replies, approval state, and automation status must be usable without opening another mail client.

The provider remains the authority for actual delivery and mailbox folders. The application database becomes the fast read model and audit layer.

## Why direct provider loading is not enough

The current first release loads folders and messages directly from Microsoft Graph or the Hostinger Mail API. This proves the connection but has unavoidable weaknesses:

- Opening the application waits on the external provider.
- Hostinger list responses do not include message-body previews, requiring additional calls.
- A one-minute browser timer does nothing while the dashboard is closed.
- Provider throttling or a temporary outage makes the entire inbox feel unavailable.
- Automation metadata such as AI draft, approval state, owner, category, and retry status does not belong in the provider's message record.
- Direct reads alone cannot provide a durable activity trail or reliable background work.

## Target architecture

```text
Microsoft Graph change notification / Hostinger webhook
                         |
                         v
                  authenticated webhook
                         |
                         v
                 durable sync job queue
                         |
         +---------------+----------------+
         |                                |
         v                                v
 Microsoft delta reconciliation     Hostinger API reconciliation
         |                                |
         +---------------+----------------+
                         v
                Supabase/Postgres mirror
       messages, folders, bodies, attachments metadata,
       threads, drafts, approvals, send attempts, audit events
                         |
                         v
             dashboard API + live updates
                         |
                         v
        instant Outlook-style React mailbox UI
```

The UI reads its list and conversation data from Postgres, so opening Inbox is normally one fast database request. Provider writes are applied optimistically in the UI, recorded as pending operations, and reconciled in the background.

## Read/unread behavior

1. Selecting a conversation starts a short configurable delay, initially 650 ms.
2. The row immediately switches from unread to read styling and the folder counter decreases.
3. The backend records the intended state and writes it to Microsoft or Hostinger.
4. A successful provider response confirms the operation.
5. A failure restores or marks the item as unsynchronized and exposes Retry rather than silently lying to the user.
6. Provider webhooks/delta synchronization reconcile changes made in Outlook, Hostinger webmail, or another device.

The production database should store both `desired_is_read` and `provider_is_read` until reconciliation completes.

## Provider adapter

Both providers should implement one internal contract:

```text
listFolders   listMessages   getThread   getBody   downloadAttachment
markRead      move           delete      flag      search
createDraft   updateDraft    review      send      reconcileSend
subscribe     incrementalSync
```

The interface exposes the common behavior consistently and shows a clear provider-specific limitation only when necessary.

### Microsoft 365

Microsoft Graph provides native conversation IDs, Outlook drafts, immutable message IDs, reply/reply-all draft operations, folder delta synchronization, and change notifications. It can support the closest behavior to Outlook.

Maintain one delta cursor per synchronized folder. A change notification should enqueue synchronization; the delta pass remains the source of truth and catches missed or duplicated notifications.

### Hostinger

Hostinger's first-party Mail API provides folders, messages, flags, attachments, threaded sending, Sent storage, and webhooks. The present public SDK does not expose provider-side draft creation/editing, so drafts and approvals should be stored durably in Postgres and sent through Hostinger only after approval.

For historical Hostinger conversations, persist Message-ID and In-Reply-To relationships during ingestion rather than rebuilding threads repeatedly from subject searches.

## Database records

- `mail_accounts`: provider, mailbox resource, status, last sync, error state.
- `mail_folders`: provider ID/path, special use, counts, delta cursor.
- `mail_threads`: normalized subject, participants, customer/case relationship, latest activity.
- `mail_messages`: stable provider identity, folder, headers, body preview, safe body, read/flag state, direction and timestamps.
- `mail_attachments`: private metadata and provider reference; content may be cached privately according to retention policy.
- `mail_drafts`: revisioned content, recipients, reply source, author type and status.
- `mail_approvals`: exact draft revision/hash, requested/approved/rejected identities and timestamps.
- `mail_operations`: queued provider writes, idempotency key, attempts, next retry and last error.
- `mail_send_attempts`: requested, provider accepted, Sent reconciled, failed or uncertain.
- `mail_audit_events`: human, AI and system actions.

## Performance rules

- Render cached folder/list data immediately; refresh in the background.
- Return previews in the first database query instead of fetching each body from the provider.
- Fetch complete bodies and attachment metadata when a thread is opened, then cache them.
- Paginate or virtualize long lists; do not render the whole mailbox.
- Debounce search and use indexed Postgres full-text search for the local mirror.
- Never perform one provider request per visible row during normal steady-state use.
- Use push notifications for freshness and scheduled reconciliation for reliability.
- Display last successful sync and pending/failed operation indicators.

## Professional Outlook-style capabilities

### First production milestone

- Instant Inbox/Sent/Drafts/Archive/Trash loading from the mirror.
- Reliable read/unread synchronization.
- Full message previews and conversations.
- Compose, reply, reply all, forward, attachments and signatures.
- Move, archive, delete, restore, flag and search.
- Draft autosave and recovery.
- Approval queue with exact revision locking.
- Visible offline/provider-error state and retry controls.

### Second milestone

- Categories, pin, snooze, scheduled send, rules and saved searches.
- Multiple mailbox accounts and shared mailboxes.
- Keyboard shortcuts, bulk selection and drag/drop moves.
- AI summary, suggested response, confidence, source links, and AI/human authorship labels.
- Mobile approval notifications and assignment.

## Reliability requirements

- Every provider write receives an idempotency key.
- A send request is never automatically repeated after an uncertain timeout; reconcile Sent first.
- Webhook delivery is authenticated, deduplicated and acknowledged quickly before processing.
- Queue workers use leases and exponential retry for safe idempotent operations.
- The UI never displays provider acceptance as recipient delivery.
- Draft edits invalidate previous approvals.
- Provider secrets stay server-side and are encrypted at rest.
- Original email HTML remains sanitized and sandboxed.

## Recommended delivery order

1. Implement the Postgres mail schema and provider-neutral adapter.
2. Add initial historical import with checkpoints and deduplication.
3. Add Microsoft folder delta sync and Hostinger webhook/reconciliation jobs.
4. Switch the UI list and thread reads to the local mirror.
5. Add durable operation queue, optimistic writes, retries and live UI events.
6. Complete everyday mail actions and autosaved drafts.
7. Add AI/n8n workflows only after the mailbox foundation is reliable.

n8n may start and observe business workflows, reminders and integrations. It should not own the canonical mailbox mirror, approval record, pricing decision or final send lock.
