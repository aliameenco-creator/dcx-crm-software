# Microsoft mailbox connection

The dashboard uses delegated Microsoft OAuth. A mailbox owner signs in to Microsoft and grants access; no mailbox password is stored. This supports personal Outlook.com accounts and Microsoft 365 business accounts, including mailboxes in a client's organization when that organization permits consent.

The dashboard can retain several authorized accounts and has one active mailbox at a time. Switching the active account changes the inbox and tracking view. Tokens are encrypted before they are stored in Supabase.

## 1. Run the Supabase migration

Run `supabase/migrations/202609230003_microsoft_oauth.sql` in the Supabase SQL editor. This creates the server-only encrypted connection table.

## 2. Configure the Microsoft app

In Microsoft Entra admin center, open **App registrations**, select the application, and make these changes:

1. Under **Authentication**, set **Supported account types** to **Accounts in any organizational directory and personal Microsoft accounts**.
2. Add a **Web** redirect URI. It must exactly match the value shown on the dashboard connection card. For local development this is normally `http://localhost:3000/api/microsoft-oauth-callback`.
3. Under **API permissions**, add these Microsoft Graph **Delegated permissions**:
   - `User.Read`
   - `Mail.ReadWrite`
   - `Mail.Send`
4. Keep the existing client secret and record its **Value**. Remove broad **Application** Mail permissions after the delegated connection is working; the dashboard does not need tenant-wide mailbox access.

Some Microsoft 365 organizations block user consent. In that case, the client's Microsoft administrator must grant consent for these delegated permissions. Personal Outlook.com users approve them during sign-in.

## 3. Configure the server

Use these server-only values in `.env.local` and in the deployed environment:

```dotenv
MAIL_PROVIDER=microsoft
MICROSOFT_CLIENT_ID=application-client-id
MICROSOFT_CLIENT_SECRET=client-secret-value
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/microsoft-oauth-callback
APP_BASE_URL=http://localhost:3000
```

Keep the existing `APP_SESSION_SECRET`, Supabase URL, and Supabase service-role key. The redirect URI must use the deployed HTTPS domain in production. Do not add `VITE_` to secrets.

Restart the server after changing environment variables.

## 4. Connect and verify

1. Sign in to the dashboard.
2. Open **Inbox** and select **Connect Microsoft**.
3. Choose the Outlook.com or Microsoft 365 account and accept the requested permissions.
4. Return to the dashboard and select **Check connection**.
5. Open a known conversation, save a test reply as an Outlook draft, and verify the draft in Outlook before testing send.

Use **Connect another mailbox** to authorize a client mailbox. The account owner must complete Microsoft's sign-in and consent. If the mailbox belongs to a client's Microsoft 365 tenant, their tenant policy may require admin approval. The dashboard keeps each authorization separately and lets the workspace owner choose the active mailbox.

## Tracking and automation

Microsoft remains the source of truth for the mailbox. The tracking sync copies normalized conversation state to Supabase so the dashboard can show counts, statuses, drafts, and follow-ups. n8n can call the tracking worker routes to schedule synchronization and draft generation; it cannot approve or send mail. A dashboard user must review and approve every outbound message.

See `docs/email-tracking-setup.md` for the tracking migration and n8n workflows.
