import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createSession } from "../server/auth-core.js";
import { mailHandler } from "../server/mail-api.js";
import { graphClient, MailError } from "../server/microsoft-graph.js";
import {
  groupMicrosoftMessages,
  outlookLink,
} from "../src/lib/microsoft-mail.ts";

const env = {
  APP_LOGIN_EMAIL: "owner@example.com",
  APP_LOGIN_PASSWORD: "test-password-long",
  APP_SESSION_SECRET: "s".repeat(40),
  MICROSOFT_TENANT_ID: "tenant",
  MICROSOFT_CLIENT_ID: "client",
  MICROSOFT_CLIENT_SECRET: "test-secret",
  MICROSOFT_MAILBOX: "owner@example.com",
};
const cookie = `dcx_session=${createSession({ email: env.APP_LOGIN_EMAIL, password: env.APP_LOGIN_PASSWORD, secret: env.APP_SESSION_SECRET })}`;
async function fixture(t, graph, config = env) {
  const server = createServer((req, res) =>
    mailHandler(req, res, config, graph),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
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
test("mailbox rejects anonymous/automation access and cross-origin writes before Graph", async (t) => {
  let calls = 0;
  const f = await fixture(t, async () => {
    calls++;
    return {};
  });
  assert.equal((await fetch(f.base)).status, 401);
  assert.equal(
    (await fetch(f.base, { headers: { Authorization: "Bearer automation" } }))
      .status,
    401,
  );
  assert.equal(
    (
      await fetch(f.base + "?action=send", {
        method: "POST",
        headers: { Cookie: cookie, Origin: "https://other.example" },
        body: "{}",
      })
    ).status,
    403,
  );
  assert.equal(calls, 0);
});
test("missing mail credentials produces setup status, never a simulated live mailbox", async (t) => {
  const f = await fixture(t, undefined, {
    ...env,
    MICROSOFT_CLIENT_SECRET: "",
  });
  assert.deepEqual((await (await f.get("status")).json()).configured, false);
  assert.equal((await f.get("messages")).status, 503);
});
test("conversation requests use Microsoft ID across folders; pagination is signed and cannot become a proxy", async (t) => {
  const calls = [];
  const continuation =
    "https://graph.microsoft.com/v1.0/users/owner%40example.com/messages?$skiptoken=next";
  const f = await fixture(t, async (path) => {
    calls.push(path);
    return { value: [{ id: "m1" }], "@odata.nextLink": continuation };
  });
  const result = await (await f.get("thread", { conversation: "a'b" })).json();
  const parsed = new URL(calls[0], "https://example.com");
  assert.equal(parsed.pathname, "/messages");
  assert.equal(parsed.searchParams.get("$filter"), "conversationId eq 'a''b'");
  assert.equal((await f.get("page", { cursor: result.next })).status, 200);
  assert.equal(calls[1], continuation);
  const count = calls.length;
  assert.equal(
    (await f.get("page", { cursor: "https://attacker.example" })).status,
    400,
  );
  assert.equal(
    (await f.get("page", { cursor: result.next.slice(0, -5) + "badxx" }))
      .status,
    400,
  );
  assert.equal(calls.length, count);
});
test("reply and reply-all create real conversation drafts and never invoke send", async (t) => {
  const calls = [];
  const f = await fixture(t, async (path, options) => {
    calls.push({ path, options });
    return path.includes("createReply")
      ? { id: "draft", changeKey: "v1", isDraft: true }
      : { id: "original", isDraft: false };
  });
  for (const replyAll of [false, true])
    assert.equal(
      (
        await f.post("draft", {
          replyTo: "original/+=",
          replyAll,
          content: "Hello",
        })
      ).status,
      200,
    );
  assert.equal(calls[1].path, "/messages/original%2F%2B%3D/createReply");
  assert.equal(calls[3].path, "/messages/original%2F%2B%3D/createReplyAll");
  assert.equal(calls[1].options.body.message.body.content, "Hello");
  assert.equal(
    calls.some((c) => c.path.endsWith("/send")),
    false,
  );
});
test("draft updates reject stale versions and use conditional Microsoft writes", async (t) => {
  const calls = [];
  const f = await fixture(t, async (path, options) => {
    calls.push({ path, options });
    return { id: "draft", isDraft: true, changeKey: "new" };
  });
  assert.equal(
    (
      await f.post("draft", {
        draftId: "draft",
        version: 'W/"old"',
        content: "Reply",
      })
    ).status,
    409,
  );
  assert.equal(calls.length, 1);
  assert.equal(
    (
      await f.post("draft", {
        draftId: "draft",
        version: 'W/"new"',
        content: "Reply",
      })
    ).status,
    200,
  );
  assert.equal(calls[2].options.etag, 'W/"new"');
});
test("send requires reviewed current draft; changed, sent, and forged reviews cannot send", async (t) => {
  let changeKey = "v1",
    isDraft = true,
    sends = 0;
  const f = await fixture(t, async (path) => {
    if (path.endsWith("/send")) {
      sends++;
      isDraft = false;
      return null;
    }
    return {
      id: "draft",
      changeKey,
      isDraft,
      body: { content: "Approved reply" },
      toRecipients: [{ emailAddress: { address: "customer@example.com" } }],
    };
  });
  assert.equal((await f.post("send", { approval: "forged" })).status, 400);
  const first = await (await f.post("review", { id: "draft" })).json();
  changeKey = "v2";
  assert.equal(
    (await f.post("send", { approval: first.approval })).status,
    409,
  );
  assert.equal(sends, 0);
  const second = await (await f.post("review", { id: "draft" })).json();
  assert.equal(
    (await f.post("send", { approval: second.approval })).status,
    202,
  );
  assert.equal(sends, 1);
  assert.equal(
    (await f.post("send", { approval: second.approval })).status,
    409,
  );
  assert.equal(sends, 1);
});
test("compose validates recipient and body before writing; read/archive target a single message", async (t) => {
  const calls = [];
  const f = await fixture(t, async (path, options) => {
    calls.push({ path, options });
    return { id: "m" };
  });
  assert.equal(
    (
      await f.post("draft", {
        to: "invalid",
        subject: "Hello",
        content: "Hello",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.post("draft", {
        to: "ok@example.com",
        subject: "Hello",
        content: " ",
      })
    ).status,
    400,
  );
  assert.equal(calls.length, 0);
  assert.equal(
    (
      await f.post("draft", {
        to: "a@example.com, b@example.com",
        subject: "Hello",
        content: "Hello",
      })
    ).status,
    200,
  );
  assert.equal(calls[0].options.body.toRecipients.length, 2);
  await f.post("read", { id: "m", isRead: true });
  await f.post("move", { id: "m" });
  assert.deepEqual(calls[1].options.body, { isRead: true });
  assert.equal(calls[2].options.body.destinationId, "archive");
});
test("throttling and download size failures are explicit; no success on a failed write", async (t) => {
  const f = await fixture(t, async () => {
    throw new MailError(429, "Please wait", "30");
  });
  const r = await f.post("read", { id: "m", isRead: true });
  assert.equal(r.status, 429);
  assert.equal(r.headers.get("Retry-After"), "30");
  const download = await fixture(t, async () => ({
    name: "large.pdf",
    size: 10 * 1024 * 1024,
  }));
  assert.equal(
    (await download.get("download", { id: "m", attachment: "a" })).status,
    413,
  );
});
test("Graph transport requests stable IDs, isolates configured mailbox and never retries a send timeout", async () => {
  const calls = [];
  const graph = graphClient(
    { ...env, MICROSOFT_CLIENT_ID: "transport-test" },
    async (url, options) => {
      calls.push({ url, options });
      if (url.includes("/token"))
        return new Response(
          JSON.stringify({ access_token: "fake", expires_in: 3600 }),
        );
      if (options.method === "POST") throw new Error("timeout");
      return new Response(JSON.stringify({ id: "m" }));
    },
  );
  await graph("/messages/m", { text: true });
  assert.ok(calls[1].options.headers.Prefer.includes("ImmutableId"));
  assert.ok(
    calls[1].options.headers.Prefer.includes(
      'outlook.body-content-type="text"',
    ),
  );
  await assert.rejects(
    graph("https://attacker.example/message"),
    /Invalid mailbox/,
  );
  await assert.rejects(
    graph("https://graph.microsoft.com/v1.0/users/other/messages"),
    /Invalid mailbox/,
  );
  await assert.rejects(
    graph("/messages/m/send", { method: "POST" }),
    /may have completed/,
  );
  assert.equal(
    calls.filter(
      (c) => c.options.method === "POST" && !c.url.includes("/token"),
    ).length,
    1,
  );
});
test("Microsoft grouping keeps different same-subject conversations apart and deduplicates IDs", () => {
  const m = (id, conversationId, receivedDateTime) => ({
    id,
    conversationId,
    receivedDateTime,
    subject: "Same subject",
  });
  const groups = groupMicrosoftMessages([
    m("later", "a", "2026-09-20"),
    m("other", "b", "2026-09-18"),
    m("earlier", "a", "2026-09-19"),
    m("later", "a", "2026-09-20"),
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups[0].messages.map((m) => m.id),
    ["earlier", "later"],
  );
  assert.equal(outlookLink("javascript:alert(1)"), undefined);
  assert.equal(outlookLink("https://evil.example"), undefined);
  assert.equal(
    outlookLink("https://outlook.office.com/mail/id/test"),
    "https://outlook.office.com/mail/id/test",
  );
});

test("conversation and message order uses the newest real mail timestamp", () => {
  const m = (id, conversationId, receivedDateTime, sentDateTime) => ({
    id,
    conversationId,
    receivedDateTime,
    sentDateTime,
    subject: id,
  });
  const groups = groupMicrosoftMessages([
    m("old", "one", "2026-09-20T08:00:00Z"),
    m("newest", "two", "", "2026-09-20T12:00:00Z"),
    m("reply", "one", "2026-09-20T10:00:00Z"),
  ]);
  assert.deepEqual(
    groups.map((group) => group.id),
    ["two", "one"],
  );
  assert.deepEqual(
    groups[1].messages.map((message) => message.id),
    ["old", "reply"],
  );
});

test("review includes Bcc and blocks repeated sends even before Microsoft updates draft state", async (t) => {
  let sends = 0;
  const f = await fixture(t, async (path) => {
    if (path.endsWith("/send")) {
      sends++;
      return null;
    }
    return {
      id: "bcc-draft",
      isDraft: true,
      changeKey: "v1",
      body: { content: "Test" },
      toRecipients: [{ emailAddress: { address: "customer@example.com" } }],
      bccRecipients: [{ emailAddress: { address: "copy@example.com" } }],
    };
  });
  const reviewed = await (await f.post("review", { id: "bcc-draft" })).json();
  assert.equal(
    reviewed.record.bccRecipients[0].emailAddress.address,
    "copy@example.com",
  );
  const results = await Promise.all([
    f.post("send", { approval: reviewed.approval }),
    f.post("send", { approval: reviewed.approval }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [202, 409]);
  assert.equal(sends, 1);
});

test("uncertain sends cannot be immediately re-dispatched in the same server instance", async (t) => {
  let sends = 0;
  const f = await fixture(t, async (path) => {
    if (path.endsWith("/send")) {
      sends++;
      throw new MailError(502, "Microsoft did not confirm the send.");
    }
    return {
      id: "uncertain-draft",
      isDraft: true,
      changeKey: "v1",
      body: { content: "Test" },
      toRecipients: [{ emailAddress: { address: "customer@example.com" } }],
    };
  });
  const reviewed = await (
    await f.post("review", { id: "uncertain-draft" })
  ).json();
  assert.equal(
    (await f.post("send", { approval: reviewed.approval })).status,
    502,
  );
  assert.equal(
    (await f.post("send", { approval: reviewed.approval })).status,
    409,
  );
  assert.equal(sends, 1);
});
