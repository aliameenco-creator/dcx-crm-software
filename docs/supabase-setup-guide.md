# DCX customer database — Supabase setup guide

## What this release does

The dashboard now has a server-backed Customers & history module. It can create and edit customers, contacts, sites, equipment, completed purchases and service history. A read-only email lookup endpoint makes those same records available to n8n. Saving a record does not itself trigger an email or an automation.

Your dashboard uses its existing single-user environment-variable login. **Supabase Auth is not used.** Database access goes through the app's authenticated server API. The browser never receives the Supabase secret key.

### Status and boundaries

| Component | Status |
| --- | --- |
| Customer forms and SQL-backed persistence | Implemented; requires the setup below |
| Exact email matching and customer history lookup | Implemented, including ambiguity handling |
| Multiple contacts, sites, equipment, purchases, service visits | Implemented |
| Change history and conflicting-edit detection | Implemented |
| Spreadsheet / old CRM bulk importer | Not implemented; see migration preparation below |
| Original invoice/attachment upload | Not implemented; record source references in the forms |
| Company knowledge storage and pgvector | Optional database foundation supplied; ingestion/search pending |
| Outlook email import, sync and sending | Not connected |
| n8n mailbox router and approval/send workflows | Not deployed; lookup integration instructions supplied |
| Quotes, pricing, tender records, sample inbox | Still use the existing local-browser workspace |

BGIS-specific automation is outside this release. Existing price-book tools remain available.

## 1. Create your Supabase project

1. Sign in at https://supabase.com/dashboard with the account that should own the business database.
2. Create an organization if needed, then select **New project**.
3. Name it something clear, such as `dcx-operations`.
4. Generate a strong database password and store it in your password manager. The application below uses an API secret, not this database password.
5. Choose a region suitable for the client's data-location requirements and near your backend. Confirm the region before creating the project.
6. Choose a plan based on storage and recovery requirements. Do not assume free hosting includes every backup or production feature you need.
7. Wait for provisioning to finish.

Do not create dashboard users in Supabase Authentication. The owner signs into our app using the APP_LOGIN variables.

## 2. Install the customer schema

Use **SQL Editor → New query** in the project.

1. Open `supabase/migrations/202609160001_customer_crm.sql` from this repository.
2. Copy its entire contents into the SQL editor.
3. Run it once. It is wrapped in a transaction, so a failed installation rolls back.
4. Save the query as `DCX customer CRM initial migration`.
5. Open **Table Editor** and confirm the following tables exist in `public`:

| Table | Purpose |
| --- | --- |
| `crm_customers` | Customer/company identity |
| `crm_contacts` | People and email addresses linked to a customer |
| `crm_sites` | Customer locations |
| `crm_equipment` | Installed assets, linked to a customer and its site |
| `crm_purchases` | Completed purchases and evidence references; optional equipment link |
| `crm_services` | Completed service history and report references |
| `crm_audit` | Before/after records for inserts and edits |

**Do not run the old root `supabase_schema.sql`.** It belongs to the previous prototype. The new `crm_` tables deliberately avoid overwriting any older tables. If you already ran the old schema, leave existing data intact; migrate it separately after reviewing it.

The new migration is intentionally run once. If you receive “relation already exists,” check whether the installation already succeeded. Do not delete tables to rerun it.

### Security built into this schema

All customer tables have Row Level Security enabled. The public `anon` and `authenticated` API roles receive no table access. There are no open read/write policies. Our backend checks the owner's session before using the server secret. The n8n lookup token can access only the lookup action through our app, not the write endpoints.

The audit table records changes, but is not tamper-proof against a database administrator. It records database changes, not proof of who approved an email. Email approvals need their own future records.

## 3. Copy the project connection settings

1. Use the project's **Connect** dialog to find the Project URL, typically `https://YOUR-PROJECT.supabase.co`.
2. Open **Settings → API Keys**.
3. Create/copy a server **secret key**, normally beginning with `sb_secret_`.
4. Store it only in the server environment.

Do not use the publishable/anon key for this backend. Do not put the secret in a `VITE_` variable, a React component, an n8n workflow export, a screenshot, or source control. Secret keys bypass RLS, so the app must enforce authorization before using one.

The new module does not use the old `src/lib/supabase.ts` browser client or the old prototype database-settings component.

## 4. Configure local login and connection

In the project root, copy `.env.example` to `.env.local` if it does not already exist. Preserve existing values if you already configured a login.

Fill in:

```dotenv
APP_LOGIN_EMAIL=owner@your-company.example
APP_LOGIN_PASSWORD=REPLACE_WITH_A_UNIQUE_LONG_PASSWORD
APP_SESSION_SECRET=REPLACE_WITH_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SECRET_KEY=sb_secret_REPLACE_WITH_PROJECT_SECRET
AUTOMATION_API_TOKEN=REPLACE_WITH_A_DIFFERENT_RANDOM_SECRET
```

- The login password must be at least 12 characters.
- Session secret and automation token must be at least 32 characters. Use different values.
- Generate each random value with this command, running it separately for each secret:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

The automation token is optional until n8n needs access. Never use the database password as an application secret. `.env.local` is ignored by source control and deployment packaging.

Restart your development server after changing environment variables:

```powershell
npm run dev -- --host 127.0.0.1
```

Open http://127.0.0.1:3000 (or the port Vite prints if that port was already occupied). Sign in using APP_LOGIN_EMAIL and APP_LOGIN_PASSWORD. Do not use development preview for real customer data: preview has no authorized server session.

## 5. Verify the connection with one test customer

1. Open **Customers & sites** in the sidebar.
2. Click **Add customer**, enter a clearly labeled test company, and save.
3. Add a contact using a test email you control.
4. Add a site with its service address.
5. Add equipment and select that site. Fill in model/serial and where those details came from. Use “Last confirmed” only when actually confirmed.
6. Add a completed purchase with an invoice/order reference; add a service visit with its report reference.
7. Refresh the page and confirm the records remain.
8. In Supabase Table Editor, inspect the corresponding `crm_` tables and `crm_audit`.
9. In the dashboard's **Test an incoming sender** box, enter the contact email. It should return the customer and the correct history counts.
10. Try an unknown email: it should report `not_found`.
11. Optionally put the same email under a second test customer: the lookup should report `needs_review`, never choose one automatically. Edit the test contact back afterwards.
12. Log out. Opening `/api/crm?entity=customers` should return a sign-in error.

Test records are ordinary persistent records. The UI currently offers editing, not deletion. Use an isolated test project for extensive testing rather than filling the production database with fixtures.

## 6. How daily customer entry works

Create the customer once, then add all relevant contacts. Incoming email lookup compares the sender against contact email addresses, case-insensitively after normalization. It does not infer identity from a similar name or domain.

Add sites before equipment. Database constraints prevent equipment from pointing to another customer's site. Purchases and services may refer to a specific equipment record or be left at customer level when that link is not known.

Record actual completed purchases, not quotations. Equipment history is evidence, not a guarantee of current ownership. Keep source references and last-confirmed dates useful and up to date.

The app detects stale edits: if a record was edited elsewhere after you opened it, save is rejected. Close the editor, refresh, and reapply your intended change to the latest record.

If the connection fails, the form stays open and reports the error. The app does not silently save a pretend database update in localStorage.

## 7. Connect customer lookup to n8n

The endpoint is implemented now:

```text
GET https://YOUR-APP-DOMAIN/api/crm?action=lookup&email=CONTACT_EMAIL
Authorization: Bearer YOUR_AUTOMATION_API_TOKEN
```

The URL above is YOUR DASHBOARD/backend address, not the Supabase URL.

In n8n:

1. Create an **HTTP Request** node after the step that extracts the incoming sender address.
2. Choose GET.
3. Set URL to `https://YOUR-APP-DOMAIN/api/crm`.
4. Add query parameter `action` with value `lookup`.
5. Add query parameter `email` with an expression pointing to the sender's plain email address from the previous node. Check that node's output; do not assume its field path.
6. Use a saved Header Auth credential: name `Authorization`, value `Bearer YOUR_AUTOMATION_API_TOKEN`.
7. Execute with your test contact.
8. Add a Switch/IF step checking `status`:
   - `matched`: use `customer`, `contacts`, `sites`, `equipment`, `purchases`, `services` as context.
   - `not_found`: prepare a request for details or an owner review item.
   - `needs_review`: stop automatic customer selection and ask the owner to resolve it.
9. Treat HTTP failures as workflow errors with retry/owner attention, never as “new customer.”

The automation token cannot add or edit customer data and cannot list all customers through this endpoint. It provides read access to the history returned by email lookup. Rotate it by changing the environment value and the n8n credential together.

If n8n runs in the cloud, it cannot access your computer's `127.0.0.1`. Deploy the backend to a reachable HTTPS address before using cloud n8n. A local n8n installation needs a network address that reaches the Vite server; container localhost refers to the container itself.

**No live n8n mailbox workflow is included in this release.** A successful lookup does not send a reply. The next workflow should import an email, call this lookup, prepare a draft, save an approval request, and send through Microsoft only after approval. That requires mailbox authorization and the additional email/approval persistence implementation.

## 8. Optional company knowledge foundation

After the customer migration, optionally run `supabase/migrations/202609160002_knowledge_foundation.sql` once. It creates:

- `crm_documents`: document identity, storage path, version and review status.
- `crm_knowledge_chunks`: text chunks, source page and vector embedding.
- A private Storage bucket named `crm-private`.
- The `vector` extension in the `extensions` schema.

Check **Database → Extensions** first if your project already has vector installed. This script expects `extensions.vector`. If vector lives in another schema, have the migration adapted to that schema before running; do not drop an extension that existing data uses.

Check **Storage → crm-private** and verify the bucket is private. Do not add public access policies. A future authenticated backend will upload originals and issue short-lived signed download links after checking the user's session.

This migration does not populate knowledge or make AI search work. The remaining pipeline is: approved upload → text extraction → chunks with source references → embeddings → search restricted to approved/current documents. An embedding model must be selected before specifying vector dimensions and a suitable search index. The provided vector column intentionally has no fixed dimension yet.

Exact prices remain structured rate records/calculator inputs, not answers guessed from vector search. Source documents and customer purchases have different purposes.

## 9. Bring in existing customer data

The next migration task starts with finding the source: accounting software, invoices, spreadsheets, service reports, an old CRM or mailbox history.

Prepare separate exports for customers, contacts, sites, equipment, completed purchases and services. Agree which source proves each fact. Preview duplicates and uncertain links before importing. Import in this order: customers → contacts/sites → equipment → purchases/services. Child rows need the parent's actual database UUID.

For a small number of customers, enter them through the forms. For larger sets, build a reviewed import with a mapping preview and errors report before inserting. Do not paste a mixed spreadsheet directly into a table or automatically turn every emailed quote into a purchase.

Current browser sample customers are not automatically migrated. Export the local workspace first if any real information was entered there. Customer cloud records are not included in a complete form in that local-workspace export; use database backups for cloud history.

## 10. Later deployment to Vercel

This release does not deploy anything automatically.

1. Add the project source to a private Git repository, excluding `.env*` and client source documents according to the repository ignore rules.
2. Import that repository into Vercel as a Vite project.
3. Build command: `npm run build`; output: `dist`.
4. Add the same APP_LOGIN, APP_SESSION, SUPABASE and optional AUTOMATION variables in project environment settings.
5. Use a separate Supabase project for preview/testing if previews should not touch production customer data.
6. Deploy/redeploy after environment changes.
7. Verify login, create/edit, refresh, unauthorized access rejection and n8n lookup over HTTPS.

The `/api/auth` and `/api/crm` server functions are necessary. Uploading only `dist` to static hosting does not provide login or database access. `npm run preview` is a static build preview and does not run the development API middleware; use `npm run dev` locally or the configured server deployment.

Choose an appropriate hosting plan for business use and verify current provider terms/pricing. This guide makes no promise of zero operating cost.

## 11. Backups and operations

- Set a backup/recovery schedule appropriate to the client and the chosen Supabase plan.
- Test restoring into a separate project. A backup that has never been restored is unverified.
- Database backups do not include the actual Storage file objects: plan a separate copy/recovery process for original documents when uploads begin.
- Keep credentials in the hosting/n8n secret stores; rotate exposed keys immediately.
- The current login throttle is in-memory per server instance. Before public production rollout, add a shared rate limiter or equivalent platform protection for distributed deployments.
- At this scale the UI loads the customer list and selected customer's history. For much larger datasets, add server-side search/pagination and bounded automation history retrieval.
- Audit rows include previous customer data. Include them in retention and deletion decisions.

## Troubleshooting

| Message / symptom | Check |
| --- | --- |
| “Please sign in” | Real login session required; development preview has no database authorization |
| “Supabase is not configured” | Both SUPABASE variables exist in `.env.local`; restart Vite |
| “Customer database unavailable” | Correct project URL/secret; migration ran in that same project; project is available |
| Duplicate contact email | That email already exists under this customer; edit the existing contact |
| Linked site/equipment error | Choose a record belonging to the selected customer |
| Record changed elsewhere | Close editor, refresh, reopen and reapply changes |
| n8n gets 401 | Correct Bearer token, at least 32 characters, same environment; lookup GET only |
| pgvector migration fails | Confirm extension schema; customer CRM does not require the optional migration |
| App loads but APIs fail on static preview | Run the backend with Vite dev or Vercel, not static-only hosting |

## Official references

Checked September 16, 2026. Provider menus may change.

- Database: https://supabase.com/docs/guides/database/overview
- Keys and server-only usage: https://supabase.com/docs/guides/getting-started/api-keys
- Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- pgvector: https://supabase.com/docs/guides/database/extensions/pgvector
- Storage access: https://supabase.com/docs/guides/storage/security/access-control


## Customer details and shared calculator rates

After the customer CRM migration, apply `supabase/migrations/202609230001_manageable_workspace.sql`. This adds the primary customer fields and the append-only `calculator_rate_versions` table used by the Rates screen. Review and save starting books explicitly. See [dashboard and n8n plan](dashboard-and-n8n-plan.md) for deployment checks and the next automation phases.


## Shared email tracking

Run `supabase/migrations/202609230002_email_tracking.sql` after the CRM and calculator-rate migrations. See [email tracking setup](email-tracking-setup.md) for activation and the n8n worker contract.
