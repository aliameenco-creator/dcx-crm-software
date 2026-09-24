# Hostinger custom-domain mailbox setup

The dashboard supports Hostinger Mail through Hostinger's first-party Mail API. The API token remains on the server. The browser never receives the token or your mailbox password.

## What is supported

- Outlook-style folder, message-list, and conversation panes.
- Live folders and unread counts from Hostinger.
- Reading message bodies and downloading attachments up to 3 MB.
- Mark read/unread, archive, move back to Inbox, compose, reply, and reply all.
- A mandatory server-verified **Review before sending → Approve & send** step.
- Replies use Hostinger's `inReplyTo` operation so the provider supplies the reply headers and preserves threading.
- Sent messages are saved by Hostinger in the Sent folder.

Hostinger's current public Mail API sends and reads mail but does not expose a create/update-draft operation in its generated SDK. For Hostinger, **Save for approval** therefore keeps a signed, expiring review draft in the active dashboard session; it does not create a visible item in Hostinger Drafts. Microsoft-connected mail continues to create real Outlook drafts. Durable cross-device AI drafts will be stored in Supabase in the automation phase.

## 1. Create the Hostinger credential

1. Sign in to hPanel and open the email domain.
2. Open **Agentic Mail → API access**.
3. Create a token with access only to the mailbox you want this dashboard to manage.
4. Copy the token once and keep it private. This is different from a general Hostinger hosting API token.
5. Record the mailbox resource ID beginning with `AC`. If it is not shown, the exact full mailbox address can be used and the app will resolve its resource ID.

Do not paste the mailbox password into this project. Do not prefix the variables with `VITE_`.

## 2. Configure the local application

The project contains a git-ignored `.env` prepared for local Hostinger testing. Replace the blank Hostinger values:

```dotenv
MAIL_PROVIDER=hostinger
HOSTINGER_MAIL_API_TOKEN=your-mail-api-token
HOSTINGER_MAILBOX_ID=AC1234567890
HOSTINGER_MAILBOX=you@yourdomain.com
```

`HOSTINGER_MAILBOX_ID` is preferred. You may leave it blank if `HOSTINGER_MAILBOX` exactly matches one of the mailboxes allowed by the token.

The `.env` also contains development-only workspace login values. Change them before sharing or deploying the app:

```dotenv
APP_LOGIN_EMAIL=your-dashboard-login@example.com
APP_LOGIN_PASSWORD=a-unique-password-at-least-12-characters
APP_SESSION_SECRET=a-random-secret-at-least-32-characters
```

## 3. Run and verify

Restart Vite after changing `.env`:

```powershell
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:3000`, sign in with `APP_LOGIN_EMAIL` and `APP_LOGIN_PASSWORD`, and open **Settings & connections → Check connection**. Then open **Inbox**.

Use a harmless test conversation:

1. Compare Inbox and Sent with Hostinger webmail.
2. Open a message and confirm its body and attachments.
3. Mark it read, refresh Hostinger webmail, and verify the change.
4. Write a reply and select **Save for approval**. This does not send.
5. Select **Review before sending**, confirm the recipients and message, then select **Approve & send**.
6. Refresh Sent and confirm the new copy. Confirm receipt separately; provider acceptance is not proof of delivery.

Never use a production customer recipient for the first send test. A send timeout is treated as uncertain and is not automatically retried.

## Provider selection

- `MAIL_PROVIDER=hostinger` uses the Hostinger integration.
- `MAIL_PROVIDER=microsoft` uses Microsoft Graph and the `MICROSOFT_` variables.
- Only one provider is active in this first release.

Hostinger documentation: [Mail API SDKs](https://docs.hostinger.com/api-reference/email-sdks), [mailbox application settings](https://support.hostinger.com/en/articles/1575756-how-to-get-email-account-configuration-details-for-hostinger-email).
