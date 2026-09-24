import { createHmac, timingSafeEqual } from "node:crypto";
import {
  AccountApi,
  Configuration,
  FoldersApi,
  MessagesApi,
  SendApi,
} from "hostinger-mail-api-sdk";
import {
  configuration as loginConfiguration,
  getSession,
} from "./auth-core.js";
import { MailError } from "./microsoft-graph.js";

const dispatches = new Map();
const previewCache = new Map();
const respond = (res, status, data) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
};

export function hostingerConfiguration(env = process.env) {
  return {
    token: env.HOSTINGER_MAIL_API_TOKEN || "",
    mailboxId: env.HOSTINGER_MAILBOX_ID || "",
    mailbox: env.HOSTINGER_MAILBOX || "",
  };
}
export const hostingerConfigured = (config) =>
  !!(config.token && (config.mailboxId || config.mailbox));

function clients(env) {
  const configuration = new Configuration({
    accessToken: hostingerConfiguration(env).token,
  });
  return {
    account: new AccountApi(configuration),
    folders: new FoldersApi(configuration),
    messages: new MessagesApi(configuration),
    send: new SendApi(configuration),
  };
}
function seal(data, env, minutes = 60) {
  const payload = Buffer.from(
    JSON.stringify({ ...data, exp: data.exp || Date.now() + minutes * 60000 }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", env.APP_SESSION_SECRET).update(payload).digest("base64url")}`;
}
function unseal(value, kind, env, allowExpired = false) {
  try {
    if (typeof value !== "string" || value.length > 150000) throw 0;
    const [payload, signature, extra] = value.split(".");
    const expected = createHmac("sha256", env.APP_SESSION_SECRET)
      .update(payload)
      .digest();
    const actual = Buffer.from(signature, "base64url");
    if (
      extra ||
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    )
      throw 0;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (data.kind !== kind || (!allowExpired && data.exp < Date.now())) throw 0;
    return data;
  } catch {
    throw new MailError(
      400,
      `This ${kind} reference has expired. Refresh and try again.`,
    );
  }
}
// Only renew references retrieved from the server-owned tracking database.
export function renewHostingerReference(value, env) {
  const data = unseal(value, 'message', env, true);
  return seal({ ...data, exp: Date.now() + 60 * 60000 }, env);
}
async function readBody(req) {
  let raw = "";
  if (req.body !== undefined)
    raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  else
    for await (const chunk of req) {
      raw += chunk;
      if (Buffer.byteLength(raw) > 160000)
        throw new MailError(413, "Message is too large.");
    }
  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw new MailError(400, "Invalid request.");
  }
}
function addresses(value) {
  if (typeof value !== "string")
    throw new MailError(400, "Enter recipient email addresses.");
  const list = value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (
    !list.length ||
    list.length > 20 ||
    list.some(
      (item) =>
        item.length > 320 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(item),
    )
  )
    throw new MailError(
      400,
      "Enter valid email addresses separated by commas (up to 20).",
    );
  return list;
}
function messageContent(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 50000)
    throw new MailError(400, "Enter a message of up to 50,000 characters.");
  return value;
}
const recipient = (item) => ({
  emailAddress: { name: item?.name || "", address: item?.address || "" },
});
const normalizedSubject = (value) =>
  String(value || "")
    .replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, "")
    .trim()
    .toLowerCase();
const stableExpiry = () => (Math.floor(Date.now() / 86400000) + 2) * 86400000;
const externalAddresses = (message, mailbox) =>
  [message.from, ...(message.to || []), ...(message.cc || [])]
    .map((item) => item?.address?.toLowerCase())
    .filter((value) => value && value !== mailbox.toLowerCase())
    .sort();
function threadToken(message, mailbox, env) {
  const contacts = [...new Set(externalAddresses(message, mailbox))];
  return seal(
    {
      kind: "thread",
      subject: normalizedSubject(message.subject),
      contacts: contacts.slice(0, 1),
      exp: stableExpiry(),
    },
    env,
    24 * 60,
  );
}
function locator(message, env) {
  return seal(
    {
      kind: "message",
      folder: message.path,
      uid: message.uid,
      exp: stableExpiry(),
    },
    env,
    24 * 60,
  );
}
function mapMessage(message, mailbox, env, body) {
  const flags = message.flags || [];
  return {
    id: locator(message, env),
    conversationId: threadToken(message, mailbox, env),
    internetMessageId: message.messageId || null,
    inReplyTo: message.inReplyTo || null,
    subject: message.subject || "(No subject)",
    bodyPreview: body?.text
      ? body.text.replace(/\s+/g, " ").trim().slice(0, 180)
      : "Open this message to read its contents.",
    from: message.from ? recipient(message.from) : undefined,
    toRecipients: (message.to || []).map(recipient),
    ccRecipients: (message.cc || []).map(recipient),
    bccRecipients: (message.bcc || []).map(recipient),
    receivedDateTime: message.date,
    sentDateTime: message.date,
    lastModifiedDateTime: message.date,
    isRead: !message.unseen,
    isDraft: flags.some((flag) => /draft/i.test(flag)),
    importance: "normal",
    hasAttachments: !!message.attachments?.length,
    parentFolderId: message.path,
    changeKey: `${message.uid}:${flags.join(",")}`,
    ...(body
      ? {
          body: {
            contentType: body.html ? "html" : "text",
            content: body.html || body.text || "",
          },
        }
      : {}),
  };
}
function hostingerError(error) {
  if (error instanceof MailError) return error;
  const status = Number(error?.response?.status || error?.status || 502);
  const providerMessage =
    error?.response?.data?.error || error?.response?.data?.message;
  const message =
    status === 401 || status === 403
      ? "Hostinger denied the mailbox request. Check the Mail API token and its mailbox scopes."
      : status === 404
        ? "That Hostinger message or folder is no longer available. Refresh the mailbox."
        : status === 429
          ? "Hostinger is limiting mailbox requests. Please wait before refreshing."
          : providerMessage || "Hostinger Mail could not complete the request.";
  return new MailError(
    [400, 404, 409, 413, 429].includes(status) ? status : 502,
    message,
    error?.response?.headers?.["retry-after"],
  );
}
async function mailboxContext(env, injected) {
  const config = hostingerConfiguration(env);
  const api = injected || clients(env);
  const response = await api.account.getCurrentAccount();
  const available =
    response.data?.data?.mailboxes || response.data?.mailboxes || [];
  const mailbox =
    available.find(
      (item) => config.mailboxId && item.resourceId === config.mailboxId,
    ) ||
    available.find(
      (item) =>
        config.mailbox &&
        item.address.toLowerCase() === config.mailbox.toLowerCase(),
    );
  if (!mailbox)
    throw new MailError(
      404,
      "The configured Hostinger mailbox is not available to this API token.",
    );
  return { api, mailbox };
}
async function allFolders(api, mailboxId) {
  const result = await api.folders.listFolders(mailboxId, 1, 100);
  return result.data?.data || [];
}
const findFolder = (folders, use, fallback) =>
  folders.find(
    (folder) =>
      String(folder.specialUse || "").toLowerCase() === use.toLowerCase(),
  )?.path ||
  folders.find((folder) => folder.path.toLowerCase() === fallback.toLowerCase())
    ?.path ||
  fallback;
async function getRecord(api, mailboxId, token, env) {
  const ref = unseal(token, "message", env);
  const response = await api.messages.getMessage(
    mailboxId,
    ref.folder,
    ref.uid,
  );
  return { ref, record: response.data?.data || response.data };
}

export async function hostingerMailHandler(
  req,
  res,
  env = process.env,
  injected,
) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!getSession(req, loginConfiguration(env)))
    return respond(res, 401, {
      error: "Sign in with the configured workspace account to access mail.",
    });
  if (!["GET", "POST"].includes(req.method))
    return respond(res, 405, { error: "Method not allowed." });
  if (
    req.method === "POST" &&
    (req.headers.origin !==
      `${env.NODE_ENV === "production" ? "https" : "http"}://${req.headers.host}` ||
      req.headers["sec-fetch-site"] === "cross-site")
  )
    return respond(res, 403, { error: "Request origin is not allowed." });
  const url = new URL(req.url, "http://localhost");
  const action = url.searchParams.get("action") || "status";
  const config = hostingerConfiguration(env);
  if (!hostingerConfigured(config) && !injected)
    return respond(res, action === "status" ? 200 : 503, {
      configured: false,
      provider: "hostinger",
      error:
        "Hostinger Mail is not configured. Follow docs/hostinger-mail-setup.md.",
    });
  try {
    const { api, mailbox } = await mailboxContext(env, injected);
    const mailboxId = mailbox.resourceId;
    if (req.method === "GET") {
      if (action === "status") {
        const folders = await allFolders(api, mailboxId);
        const inboxId = findFolder(folders, "\\Inbox", "INBOX");
        return respond(res, 200, {
          configured: true,
          connected: true,
          provider: "hostinger",
          mailbox: mailbox.address,
          inboxId,
        });
      }
      if (action === "folders") {
        const folders = await allFolders(api, mailboxId);
        return respond(res, 200, {
          records: folders.map((folder) => ({
            id: folder.path,
            displayName: folder.name,
            childFolderCount: 0,
            unreadItemCount: folder.unreadCount,
            totalItemCount: folder.messageCount,
            depth: Math.max(
              0,
              folder.path.split(folder.delimiter || ".").length - 1,
            ),
            specialUse: folder.specialUse,
          })),
          next: null,
        });
      }
      if (action === "messages" || action === "page") {
        let folder = url.searchParams.get("folder") || "INBOX",
          page = 1;
        if (action === "page") {
          const cursor = unseal(url.searchParams.get("cursor"), "page", env);
          folder = cursor.folder;
          page = cursor.page;
        }
        const result = await api.messages.listMessages(
          mailboxId,
          folder,
          page,
          50,
          "-date",
        );
        const payload = result.data;
        const pagination = payload.pagination || { page: 1, totalPages: 1 };
        return respond(res, 200, {
          records: (payload.data || []).map((message) =>
            mapMessage(message, mailbox.address, env),
          ),
          next:
            pagination.page < pagination.totalPages
              ? seal({ kind: "page", folder, page: page + 1 }, env)
              : null,
        });
      }
      if (action === "thread") {
        const thread = unseal(
          url.searchParams.get("conversation"),
          "thread",
          env,
        );
        const folders = await allFolders(api, mailboxId);
        const candidates = folders.slice(0, 12);
        const pages = await Promise.allSettled(
          candidates.map((folder) =>
            api.messages.searchMessages(
              mailboxId,
              folder.path,
              1,
              100,
              "date",
              { subject: thread.subject },
            ),
          ),
        );
        const records = [];
        for (const page of pages)
          if (page.status === "fulfilled")
            for (const message of page.value.data?.data || []) {
              if (normalizedSubject(message.subject) !== thread.subject)
                continue;
              const contacts = externalAddresses(message, mailbox.address);
              if (
                thread.contacts.length &&
                !contacts.some((value) => thread.contacts.includes(value))
              )
                continue;
              records.push(mapMessage(message, mailbox.address, env));
            }
        return respond(res, 200, { records, next: null });
      }
      if (action === "message") {
        const { ref, record } = await getRecord(
          api,
          mailboxId,
          url.searchParams.get("id"),
          env,
        );
        const text = await api.messages.getMessageText(
          mailboxId,
          ref.folder,
          ref.uid,
        );
        const body = text.data?.data || text.data;
        return respond(res, 200, {
          record: mapMessage(record, mailbox.address, env, body),
          version: `${record.uid}:${(record.flags || []).join(",")}`,
        });
      }
      if (action === "attachments") {
        const { record } = await getRecord(
          api,
          mailboxId,
          url.searchParams.get("id"),
          env,
        );
        return respond(res, 200, {
          records: (record.attachments || []).map((item) => ({
            id: item.id,
            name: item.filename || "attachment",
            size: item.sizeBytes,
            isInline: item.inline,
            contentType: item.contentType,
          })),
          next: null,
        });
      }
      if (action === "download") {
        const ref = unseal(url.searchParams.get("id"), "message", env);
        const attachment = String(url.searchParams.get("attachment") || "");
        const { record } = await getRecord(
          api,
          mailboxId,
          url.searchParams.get("id"),
          env,
        );
        const metadata = (record.attachments || []).find(
          (item) => item.id === attachment,
        );
        if (!metadata) throw new MailError(404, "Attachment not found.");
        if (metadata.sizeBytes > 3 * 1024 * 1024)
          throw new MailError(
            413,
            "For attachments over 3 MB, use Hostinger webmail.",
          );
        const response = await api.messages.getMessageAttachment(
          mailboxId,
          ref.folder,
          ref.uid,
          attachment,
          { responseType: "arraybuffer" },
        );
        res.statusCode = 200;
        res.setHeader(
          "Content-Type",
          metadata.contentType || "application/octet-stream",
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent((metadata.filename || "attachment").replace(/[\r\n]/g, ""))}`,
        );
        return res.end(Buffer.from(response.data));
      }
    } else {
      const input = await readBody(req);
      if (action === "previews") {
        if (
          !Array.isArray(input.ids) ||
          input.ids.length > 20 ||
          input.ids.some((id) => typeof id !== "string")
        )
          throw new MailError(
            400,
            "Provide up to 20 valid message references.",
          );
        const now = Date.now();
        for (const [key, item] of previewCache)
          if (item.expires < now) previewCache.delete(key);
        const records = await Promise.all(
          input.ids.map(async (id) => {
            const ref = unseal(id, "message", env);
            const key = `${mailboxId}:${ref.folder}:${ref.uid}`;
            const cached = previewCache.get(key);
            if (cached) return { id, bodyPreview: cached.value };
            const response = await api.messages.getMessageText(
              mailboxId,
              ref.folder,
              ref.uid,
            );
            const body = response.data?.data || response.data;
            const value =
              String(body?.text || "")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 180) || "(No text preview)";
            previewCache.set(key, { value, expires: now + 5 * 60000 });
            return { id, bodyPreview: value };
          }),
        );
        return respond(res, 200, { records });
      }
      if (action === "read") {
        const ref = unseal(input.id, "message", env);
        await api.messages.patchMessage(
          mailboxId,
          ref.folder,
          ref.uid,
          input.isRead ? { addFlags: ["\\Seen"] } : { removeFlags: ["\\Seen"] },
        );
        return respond(res, 200, { ok: true });
      }
      if (action === "move") {
        const ref = unseal(input.id, "message", env);
        const folders = await allFolders(api, mailboxId);
        const targetFolder = input.restore
          ? findFolder(folders, "\\Inbox", "INBOX")
          : findFolder(folders, "\\Archive", "INBOX.Archive");
        await api.messages.moveMessage(mailboxId, ref.folder, ref.uid, {
          targetFolder,
        });
        return respond(res, 200, { ok: true });
      }
      if (action === "draft") {
        const text = messageContent(input.content);
        let draft;
        if (input.draftId) {
          const current = unseal(input.draftId, "draft", env);
          if (input.version !== current.version)
            throw new MailError(
              409,
              "This draft changed. Reload it before editing.",
            );
          draft = { ...current, content: text };
        } else if (input.replyTo) {
          const { ref, record } = await getRecord(
            api,
            mailboxId,
            input.replyTo,
            env,
          );
          const all = input.replyAll
            ? [record.from, ...(record.to || []), ...(record.cc || [])]
            : [record.from];
          const to = [
            ...new Set(
              all
                .map((item) => item?.address?.toLowerCase())
                .filter(
                  (value) => value && value !== mailbox.address.toLowerCase(),
                ),
            ),
          ];
          draft = {
            kind: "draft",
            to,
            cc: [],
            bcc: [],
            subject: /^re:/i.test(record.subject || "")
              ? record.subject
              : `Re: ${record.subject || ""}`,
            content: text,
            reply: ref,
          };
        } else {
          if (
            typeof input.subject !== "string" ||
            !input.subject.trim() ||
            input.subject.length > 998
          )
            throw new MailError(400, "Enter a subject.");
          draft = {
            kind: "draft",
            to: addresses(input.to),
            cc: [],
            bcc: [],
            subject: input.subject.trim(),
            content: text,
          };
        }
        draft.version = createHmac("sha256", env.APP_SESSION_SECRET)
          .update(JSON.stringify({ ...draft, version: undefined }))
          .digest("base64url");
        const id = seal(draft, env, 24 * 60);
        const record = {
          id,
          conversationId: draft.reply
            ? seal(
                {
                  kind: "thread",
                  subject: normalizedSubject(draft.subject),
                  contacts: draft.to.slice(0, 1),
                  exp: stableExpiry(),
                },
                env,
                24 * 60,
              )
            : id,
          subject: draft.subject,
          bodyPreview: draft.content.slice(0, 180),
          toRecipients: draft.to.map((address) => recipient({ address })),
          ccRecipients: [],
          bccRecipients: [],
          receivedDateTime: new Date().toISOString(),
          sentDateTime: new Date().toISOString(),
          isRead: true,
          isDraft: true,
          importance: "normal",
          hasAttachments: false,
          parentFolderId: "approval-drafts",
          changeKey: draft.version,
          body: { contentType: "text", content: draft.content },
        };
        return respond(res, 200, {
          record,
          version: draft.version,
          providerDraft: true,
        });
      }
      if (action === "review") {
        const draft = unseal(input.id, "draft", env);
        const record = {
          id: input.id,
          subject: draft.subject,
          toRecipients: draft.to.map((address) => recipient({ address })),
          ccRecipients: (draft.cc || []).map((address) =>
            recipient({ address }),
          ),
          bccRecipients: (draft.bcc || []).map((address) =>
            recipient({ address }),
          ),
          body: { contentType: "text", content: draft.content },
          hasAttachments: false,
          isDraft: true,
        };
        return respond(res, 200, {
          record,
          approval: seal({ kind: "approval", draft }, env, 10),
        });
      }
      if (action === "send") {
        const approved = unseal(input.approval, "approval", env);
        const key = `${mailboxId}:${approved.draft.version}`;
        for (const [item, expiry] of dispatches)
          if (expiry < Date.now()) dispatches.delete(item);
        if (dispatches.has(key))
          throw new MailError(
            409,
            "A send was already requested for this draft. Check Sent before trying again.",
          );
        dispatches.set(key, Date.now() + 10 * 60000);
        try {
          const draft = approved.draft;
          await api.send.sendEmail(mailboxId, {
            to: draft.to,
            cc: draft.cc || [],
            bcc: draft.bcc || [],
            subject: draft.subject,
            text: draft.content,
            ...(draft.reply
              ? {
                  inReplyTo: {
                    folder: draft.reply.folder,
                    uid: draft.reply.uid,
                  },
                }
              : {}),
          });
        } catch (error) {
          throw hostingerError(error);
        }
        return respond(res, 202, {
          accepted: true,
          message:
            "Hostinger accepted the send request. Refresh Sent to confirm the saved copy.",
        });
      }
    }
    return respond(res, 400, { error: "Unknown mail action." });
  } catch (error) {
    const mapped = hostingerError(error);
    if (mapped.retryAfter && /^\d+$/.test(String(mapped.retryAfter)))
      res.setHeader("Retry-After", mapped.retryAfter);
    return respond(res, mapped.status || 502, { error: mapped.message });
  }
}
