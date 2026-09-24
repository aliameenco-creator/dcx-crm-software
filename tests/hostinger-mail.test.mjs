import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createSession } from "../server/auth-core.js";
import { hostingerMailHandler } from "../server/hostinger-mail.js";

const env = {
  APP_LOGIN_EMAIL: "owner@example.com",
  APP_LOGIN_PASSWORD: "test-password-long",
  APP_SESSION_SECRET: "h".repeat(40),
  MAIL_PROVIDER: "hostinger",
  HOSTINGER_MAIL_API_TOKEN: "test-token",
  HOSTINGER_MAILBOX_ID: "ACtest",
  HOSTINGER_MAILBOX: "owner@example.com",
};
const cookie = `dcx_session=${createSession({ email: env.APP_LOGIN_EMAIL, password: env.APP_LOGIN_PASSWORD, secret: env.APP_SESSION_SECRET })}`;
const folders = [
  {
    path: "INBOX",
    name: "Inbox",
    delimiter: ".",
    specialUse: "\\Inbox",
    messageCount: 1,
    unreadCount: 1,
  },
  {
    path: "INBOX.Sent",
    name: "Sent",
    delimiter: ".",
    specialUse: "\\Sent",
    messageCount: 1,
    unreadCount: 0,
  },
  {
    path: "INBOX.Archive",
    name: "Archive",
    delimiter: ".",
    specialUse: "\\Archive",
    messageCount: 0,
    unreadCount: 0,
  },
];
const message = {
  uid: 7,
  path: "INBOX",
  date: "2026-09-20T10:00:00Z",
  flags: [],
  unseen: true,
  size: 123,
  subject: "Question",
  from: { name: "Customer", address: "customer@example.com" },
  to: [{ name: "Owner", address: "owner@example.com" }],
  cc: [],
  bcc: [],
  messageId: "<m7@example.com>",
  inReplyTo: null,
  attachments: [],
};

async function fixture(t, api) {
  const server = createServer((req, res) =>
    hostingerMailHandler(req, res, env, api),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    get: (action, params = {}) =>
      fetch(`${base}?${new URLSearchParams({ action, ...params })}`, {
        headers: { Cookie: cookie },
      }),
    post: (action, body) =>
      fetch(`${base}?action=${action}`, {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: base,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }),
  };
}
function fake(overrides = {}) {
  return {
    account: {
      getCurrentAccount: async () => ({
        data: {
          data: {
            mailboxes: [{ resourceId: "ACtest", address: "owner@example.com" }],
          },
        },
      }),
    },
    folders: {
      listFolders: async () => ({
        data: { data: folders, pagination: { page: 1, totalPages: 1 } },
      }),
    },
    messages: {
      listMessages: async () => ({
        data: { data: [message], pagination: { page: 1, totalPages: 1 } },
      }),
      getMessage: async () => ({ data: { data: message } }),
      getMessageText: async () => ({
        data: { data: { text: "Original question", html: "" } },
      }),
      searchMessages: async () => ({
        data: { data: [message], pagination: { page: 1, totalPages: 1 } },
      }),
      patchMessage: async () => ({
        data: { data: { ...message, unseen: false } },
      }),
      moveMessage: async () => ({ data: null }),
    },
    send: { sendEmail: async () => ({ status: 202 }) },
    ...overrides,
  };
}

test("Hostinger status and folders resolve only the configured mailbox", async (t) => {
  const f = await fixture(t, fake());
  const status = await (await f.get("status")).json();
  assert.deepEqual(status, {
    configured: true,
    connected: true,
    provider: "hostinger",
    mailbox: "owner@example.com",
    inboxId: "INBOX",
  });
  const result = await (await f.get("folders")).json();
  assert.equal(result.records[0].displayName, "Inbox");
  assert.equal(result.records[0].unreadItemCount, 1);
});

test("Hostinger message locators are signed and body reads cannot be forged", async (t) => {
  const f = await fixture(t, fake());
  const listed = await (await f.get("messages", { folder: "INBOX" })).json();
  assert.equal(listed.records[0].subject, "Question");
  assert.equal(listed.records[0].isRead, false);
  const previews = await (
    await f.post("previews", { ids: [listed.records[0].id] })
  ).json();
  assert.equal(previews.records[0].bodyPreview, "Original question");
  const detail = await (
    await f.get("message", { id: listed.records[0].id })
  ).json();
  assert.equal(detail.record.body.content, "Original question");
  assert.equal(
    (await f.get("message", { id: listed.records[0].id + "bad" })).status,
    400,
  );
});

test("Hostinger groups Re and original subjects into one stable conversation", async (t) => {
  const api = fake();
  api.messages.listMessages = async () => ({
    data: {
      data: [
        message,
        {
          ...message,
          uid: 8,
          subject: "Re: Question",
          date: "2026-09-20T11:00:00Z",
        },
      ],
      pagination: { page: 1, totalPages: 1 },
    },
  });
  const f = await fixture(t, api);
  const listed = await (await f.get("messages", { folder: "INBOX" })).json();
  assert.equal(listed.records.length, 2);
  assert.equal(
    listed.records[0].conversationId,
    listed.records[1].conversationId,
  );
});

test("Hostinger replies require review and send with the provider reply reference", async (t) => {
  const sends = [];
  const f = await fixture(
    t,
    fake({
      send: {
        sendEmail: async (mailbox, body) => {
          sends.push({ mailbox, body });
          return { status: 202 };
        },
      },
    }),
  );
  const listed = await (await f.get("messages", { folder: "INBOX" })).json();
  const saved = await (
    await f.post("draft", {
      replyTo: listed.records[0].id,
      content: "Approved answer",
    })
  ).json();
  assert.equal(saved.record.isDraft, true);
  assert.equal(sends.length, 0);
  assert.equal((await f.post("send", { approval: "forged" })).status, 400);
  const review = await (await f.post("review", { id: saved.record.id })).json();
  assert.equal(
    review.record.toRecipients[0].emailAddress.address,
    "customer@example.com",
  );
  assert.equal(
    (await f.post("send", { approval: review.approval })).status,
    202,
  );
  assert.equal(sends.length, 1);
  assert.deepEqual(sends[0].body.inReplyTo, { folder: "INBOX", uid: 7 });
  assert.equal(
    (await f.post("send", { approval: review.approval })).status,
    409,
  );
});
