import { useCallback, useEffect, useRef, useState } from "react";
import { TrackedInbox } from "./TrackedInbox";
import DOMPurify from "dompurify";
import {
  Archive,
  ChevronDown,
  ExternalLink,
  FileText,
  Inbox,
  MailOpen,
  Paperclip,
  PenLine,
  RefreshCw,
  Reply,
  Search,
  Send,
  X,
} from "lucide-react";
import type { Client } from "../../types/operations";
import {
  addressList,
  groupMicrosoftMessages,
  mailTimestamp,
  mailRequest,
  outlookLink,
  type MailAttachment,
  type MicrosoftFolder,
  type MicrosoftMessage,
  type Page,
} from "../../lib/microsoft-mail";
import { useMailConnection, MailConnectionCard } from "./MailConnection";
import type { MailProviderName } from "./MailConnection";

function formatMailListDate(message: MicrosoftMessage) {
  const date = new Date(mailTimestamp(message));
  if (!Number.isFinite(date.getTime())) return "";
  const today = new Date();
  if (date.toDateString() === today.toDateString())
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (date.getFullYear() === today.getFullYear())
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  return date.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ConnectedInbox({
  preview = false,
  focusId,
  children,
  customers,
  onQuote,
}: {
  preview?: boolean;
  focusId?: string;
  children: React.ReactNode;
  customers: Client[];
  onQuote: (id: string) => void;
}) {
  const connection = useMailConnection();
  const [mailboxView, setMailboxView] = useState(false);
  if (preview) return <>{children}</>;
  if (!mailboxView) return <TrackedInbox focusId={focusId} customers={customers} onQuote={onQuote} provider={connection.provider || 'microsoft'} onMailbox={() => setMailboxView(true)} />;
  if (connection.mode !== "live") return <><button className="secondary" onClick={() => setMailboxView(false)}>Back to tracked conversations</button><MailConnectionCard /></>;
  return (
    <>
    <button className="secondary" onClick={() => setMailboxView(false)}>Back to tracked conversations</button>
    <MicrosoftInbox
      customers={customers}
      onQuote={onQuote}
      mailbox={connection.mailbox!}
      inboxId={connection.inboxId || "inbox"}
      provider={connection.provider || "microsoft"}
    />
    </>
  );
}
function MicrosoftInbox({
  customers,
  onQuote,
  mailbox,
  inboxId,
  provider,
}: {
  customers: Client[];
  onQuote: (id: string) => void;
  mailbox: string;
  inboxId: string;
  provider: MailProviderName;
}) {
  const [folders, setFolders] = useState<MicrosoftFolder[]>([]);
  const [folder, setFolder] = useState(inboxId);
  const [messages, setMessages] = useState<MicrosoftMessage[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState("");
  const [compose, setCompose] = useState(false);
  const [revision, setRevision] = useState(0);
  const [openThreads, setOpenThreads] = useState<string[]>([]);
  const [threadMessages, setThreadMessages] = useState<
    Record<string, MicrosoftMessage[]>
  >({});
  const dirty = useRef(false);
  const listSequence = useRef(0);
  const loading = useRef(false);
  const canLeave = () =>
    !dirty.current ||
    window.confirm(
      "Discard your unsaved reply changes? Save the draft first to keep them.",
    );
  const loadFolders = useCallback(async () => {
    let page = await mailRequest<Page<MicrosoftFolder>>("folders");
    const all = [...page.records];
    while (page.next) {
      page = await mailRequest("page", { cursor: page.next });
      all.push(...page.records);
    }
    setFolders(all);
  }, []);
  const refresh = useCallback(
    async (cursor?: string) => {
      const seq = ++listSequence.current;
      loading.current = true;
      setBusy(true);
      setError("");
      try {
        const page = await mailRequest<Page<MicrosoftMessage>>(
          cursor ? "page" : "messages",
          cursor ? { cursor } : { folder },
        );
        if (seq !== listSequence.current) return;
        setMessages((old) =>
          cursor
            ? [
                ...new Map(
                  [...old, ...page.records].map((m) => [m.id, m]),
                ).values(),
              ]
            : page.records,
        );
        setNext(page.next);
        setUpdated(new Date().toLocaleTimeString());
        if (!cursor) setRevision((v) => v + 1);
      } catch (error) {
        if (seq === listSequence.current) setError((error as Error).message);
      } finally {
        if (seq === listSequence.current) {
          loading.current = false;
          setBusy(false);
        }
      }
    },
    [folder],
  );
  useEffect(() => {
    loadFolders().catch((e) => setError(e.message));
  }, [loadFolders]);
  useEffect(() => {
    setMessages([]);
    setNext(null);
    setOpenThreads([]);
    setThreadMessages({});
    refresh();
    const timer = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        !dirty.current &&
        !loading.current
      )
        refresh();
    }, 60000);
    return () => {
      clearInterval(timer);
      listSequence.current++;
    };
  }, [refresh]);
  const groups = groupMicrosoftMessages(messages)
    .map((thread) => {
      const complete = threadMessages[thread.id];
      return complete?.length
        ? {
            ...thread,
            messages: complete,
            latest: complete[complete.length - 1],
          }
        : thread;
    })
    .filter((t) =>
      t.messages.some((m) =>
        `${m.subject} ${m.bodyPreview} ${m.from?.emailAddress.address} ${addressList(m.toRecipients)}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    )
    .sort(
      (a, b) =>
        mailTimestamp(b.latest) - mailTimestamp(a.latest) ||
        a.id.localeCompare(b.id),
    );
  const active = groups.find((t) => t.id === selected) || groups[0];
  const rememberThread = useCallback(
    (id: string, records: MicrosoftMessage[]) => {
      const ordered = groupMicrosoftMessages(records).flatMap(
        (thread) => thread.messages,
      );
      setThreadMessages((old) => ({ ...old, [id]: ordered }));
      if (ordered.length > 1)
        setOpenThreads((old) => (old.includes(id) ? old : [...old, id]));
    },
    [],
  );
  const unreadSignature =
    active?.messages
      .filter((message) => !message.isRead && !message.isDraft)
      .map((message) => message.id.slice(-24))
      .join("|") || "";
  const afterAction = () => {
    refresh();
    loadFolders().catch((e) => setError(e.message));
  };
  const missingPreviewIds =
    provider === "hostinger"
      ? messages
          .filter(
            (message) =>
              message.bodyPreview === "Open this message to read its contents.",
          )
          .slice(0, 20)
          .map((message) => message.id)
      : [];
  const previewSignature = missingPreviewIds
    .map((id) => id.slice(-24))
    .join("|");
  useEffect(() => {
    if (!previewSignature) return;
    const controller = new AbortController();
    mailRequest<{ records: { id: string; bodyPreview: string }[] }>(
      "previews",
      {},
      { ids: missingPreviewIds },
      controller.signal,
    )
      .then((result) => {
        const previews = new Map(
          result.records.map((item) => [item.id, item.bodyPreview]),
        );
        setMessages((old) =>
          old.map((message) =>
            previews.has(message.id)
              ? { ...message, bodyPreview: previews.get(message.id)! }
              : message,
          ),
        );
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError((error as Error).message);
      });
    return () => controller.abort();
  }, [previewSignature]);
  useEffect(() => {
    if (!active) return;
    const unread = active.messages.filter(
      (message) => !message.isRead && !message.isDraft,
    );
    if (!unread.length) return;
    const timer = window.setTimeout(() => {
      const ids = new Set(unread.map((message) => message.id));
      setMessages((old) =>
        old.map((message) =>
          ids.has(message.id) ? { ...message, isRead: true } : message,
        ),
      );
      setThreadMessages((old) =>
        active.id && old[active.id]
          ? {
              ...old,
              [active.id]: old[active.id].map((message) =>
                ids.has(message.id) ? { ...message, isRead: true } : message,
              ),
            }
          : old,
      );
      setFolders((old) =>
        old.map((item) =>
          item.id === folder
            ? {
                ...item,
                unreadItemCount: Math.max(
                  0,
                  item.unreadItemCount - unread.length,
                ),
              }
            : item,
        ),
      );
      Promise.all(
        unread.map((message) =>
          mailRequest("read", {}, { id: message.id, isRead: true }),
        ),
      )
        .then(() => loadFolders())
        .catch((error) => {
          setError((error as Error).message);
          refresh();
        });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [active?.id, unreadSignature]);
  async function quickAction(type: "read" | "move") {
    if (!active?.latest || busy) return;
    setBusy(true);
    setError("");
    try {
      await mailRequest(
        type,
        {},
        type === "read"
          ? { id: active.latest.id, isRead: true }
          : { id: active.latest.id },
      );
      afterAction();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function expandFolder(f: MicrosoftFolder) {
    setError("");
    try {
      let page = await mailRequest<Page<MicrosoftFolder>>("folders", {
        parent: f.id,
      });
      const children = [...page.records];
      while (page.next) {
        page = await mailRequest("page", { cursor: page.next });
        children.push(...page.records);
      }
      setFolders((old) => {
        const copy = [...old];
        const index = copy.findIndex((x) => x.id === f.id);
        copy.splice(
          index + 1,
          0,
          ...children
            .filter((c) => !copy.some((x) => x.id === c.id))
            .map((c) => ({ ...c, depth: (f.depth || 0) + 1 })),
        );
        return copy;
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const providerName =
    provider === "hostinger" ? "Hostinger Mail" : "Microsoft Outlook";
  return (
    <>
      {error && (
        <div className="notice amber" role="alert">
          {error} Existing messages may be out of date.
        </div>
      )}
      <div className="outlook-ribbon">
        <button
          className="outlook-new"
          onClick={() => {
            if (canLeave()) {
              dirty.current = false;
              setCompose(true);
            }
          }}
        >
          <PenLine size={16} /> New mail <ChevronDown size={13} />
        </button>
        <span className="ribbon-separator" />
        <button disabled={!active || busy} onClick={() => quickAction("move")}>
          <Archive size={16} /> Archive
        </button>
        <button
          disabled={!active || busy || active.latest.isRead}
          onClick={() => quickAction("read")}
        >
          <MailOpen size={16} /> Mark read
        </button>
        <span className="ribbon-spacer" />
        <button
          disabled={busy}
          onClick={() => {
            if (dirty.current) {
              setError("Save your reply before refreshing.");
              return;
            }
            afterAction();
          }}
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      <div className="live-mail-status">
        <span>
          {busy
            ? "Refreshing mailbox…"
            : updated
              ? `Last refreshed ${updated} · Updates every minute`
              : "Loading mailbox…"}
        </span>
        <span>{providerName} is the source of your email</span>
      </div>
      <div className="outlook-shell">
        <aside className="mail-folders">
          <div className="mail-account">
            <strong>{mailbox}</strong>
            <ChevronDown size={14} />
          </div>
          <button
            className="primary full folder-compose"
            onClick={() => {
              if (canLeave()) {
                dirty.current = false;
                setCompose(true);
              }
            }}
          >
            <PenLine size={15} /> New message
          </button>
          <small>FOLDERS</small>
          {!folders.length && (
            <button
              className={folder === "inbox" ? "active" : ""}
              onClick={() => {
                if (canLeave()) {
                  dirty.current = false;
                  setFolder(inboxId);
                  setSelected("");
                }
              }}
            >
              <Inbox size={16} /> Inbox
            </button>
          )}
          {folders.map((f) => (
            <div
              className="live-folder-row"
              key={f.id}
              style={{ paddingLeft: (f.depth || 0) * 10 }}
            >
              <button
                className={folder === f.id ? "active" : ""}
                onClick={() => {
                  if (canLeave()) {
                    dirty.current = false;
                    setFolder(f.id);
                    setSelected("");
                    setQuery("");
                  }
                }}
              >
                <span>{f.displayName}</span>
                {f.unreadItemCount > 0 && <b>{f.unreadItemCount}</b>}
              </button>
              {f.childFolderCount > 0 && (
                <button
                  aria-label={`Show folders in ${f.displayName}`}
                  onClick={() => expandFolder(f)}
                >
                  <ChevronDown size={14} />
                </button>
              )}
            </div>
          ))}
          <div className="mail-folder-foot">
            Live mailbox · AI and approval labels will appear here when
            automation is connected.
          </div>
        </aside>
        <section className="thread-list">
          <div className="thread-list-search">
            <Search size={15} />
            <input
              aria-label="Search loaded messages"
              placeholder="Search mail"
              value={query}
              onChange={(e) => {
                if (canLeave()) {
                  dirty.current = false;
                  setQuery(e.target.value);
                }
              }}
            />
          </div>
          <div className="mail-list-tabs">
            <strong>Focused</strong>
            <span>All mail</span>
          </div>
          <div className="list-caption">
            <strong>
              {folders.find((f) => f.id === folder)?.displayName || "Inbox"}
            </strong>
            <span>{groups.length} conversations</span>
          </div>
          {groups.map((t) => {
            const isOpen = openThreads.includes(t.id);
            const hasThread = t.messages.length > 1;
            return (
              <div className="thread-group" key={t.id}>
                <button
                  className={`thread-item ${active?.id === t.id ? "active" : ""} ${t.messages.some((m) => !m.isRead) ? "unread" : ""}`}
                  aria-expanded={hasThread ? isOpen : undefined}
                  onClick={() => {
                    if (canLeave()) {
                      dirty.current = false;
                      setSelected(t.id);
                      if (hasThread)
                        setOpenThreads((old) =>
                          old.includes(t.id)
                            ? old.filter((id) => id !== t.id)
                            : [...old, t.id],
                        );
                    }
                  }}
                >
                  <span
                    className={`thread-chevron ${hasThread ? "has-thread" : ""} ${isOpen ? "open" : ""}`}
                  >
                    {hasThread && <ChevronDown size={13} />}
                  </span>
                  <span className="thread-avatar">
                    {(t.latest.from?.emailAddress.name ||
                      t.latest.from?.emailAddress.address ||
                      mailbox)[0].toUpperCase()}
                  </span>
                  <span className="thread-copy">
                    <span className="thread-sender">
                      <strong>
                        {t.latest.from?.emailAddress.name ||
                          t.latest.from?.emailAddress.address ||
                          mailbox}
                      </strong>
                      <time>{formatMailListDate(t.latest)}</time>
                    </span>
                    <h3>{t.latest.subject || "(No subject)"}</h3>
                    <p
                      className={
                        t.latest.bodyPreview ===
                        "Open this message to read its contents."
                          ? "preview-loading"
                          : ""
                      }
                    >
                      {t.latest.bodyPreview}
                    </p>
                    <footer>
                      <span>
                        {t.messages.length} message
                        {t.messages.length === 1 ? "" : "s"}
                      </span>
                      {t.latest.isDraft && (
                        <span className="pill amber">Draft</span>
                      )}
                      {t.latest.importance === "high" && (
                        <span className="pill red">High</span>
                      )}
                      {t.latest.hasAttachments && <Paperclip size={13} />}
                    </footer>
                  </span>
                </button>
                {isOpen && hasThread && (
                  <div
                    className="thread-children"
                    aria-label="Conversation messages"
                  >
                    {t.messages.map((message) => (
                      <div className="thread-child" key={message.id}>
                        <span className="thread-child-avatar">
                          {(message.from?.emailAddress.name ||
                            mailbox)[0].toUpperCase()}
                        </span>
                        <span className="thread-child-copy">
                          <strong>
                            {message.from?.emailAddress.name ||
                              message.from?.emailAddress.address ||
                              mailbox}
                          </strong>
                          <span>{message.subject || "(No subject)"}</span>
                          <small>{message.bodyPreview}</small>
                        </span>
                        <time>{formatMailListDate(message)}</time>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {!groups.length && (
            <div className="empty-state">
              {busy ? "Loading…" : "No matching messages."}
            </div>
          )}
          {next && (
            <button
              className="secondary load-more"
              disabled={busy}
              onClick={() => refresh(next)}
            >
              Load older messages
            </button>
          )}
        </section>
        {active ? (
          <LiveConversation
            key={active.id}
            id={active.id}
            revision={revision}
            customers={customers}
            onQuote={onQuote}
            onChanged={afterAction}
            onLoaded={rememberThread}
            onDirty={(v) => {
              dirty.current = v;
            }}
            provider={provider}
          />
        ) : (
          <section className="reading-pane empty-state">
            Select a conversation.
          </section>
        )}
      </div>
      {compose && (
        <div className="modal-backdrop">
          <section
            className="detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label="New email"
          >
            <div className="panel-heading">
              <h2>New message</h2>
              <button
                className="icon-button"
                aria-label="Close composer"
                onClick={() => {
                  if (canLeave()) {
                    dirty.current = false;
                    setCompose(false);
                  }
                }}
              >
                <X size={18} />
              </button>
            </div>
            <DraftEditor
              onDirty={(v) => {
                dirty.current = v;
              }}
              onChanged={afterAction}
              provider={provider}
            />
          </section>
        </div>
      )}
    </>
  );
}
function LiveConversation({
  id,
  revision,
  customers,
  onQuote,
  onChanged,
  onLoaded,
  onDirty,
  provider,
}: {
  id: string;
  revision: number;
  customers: Client[];
  onQuote: (id: string) => void;
  onChanged: () => void;
  onLoaded: (id: string, messages: MicrosoftMessage[]) => void;
  onDirty: (v: boolean) => void;
  provider: MailProviderName;
}) {
  const [messages, setMessages] = useState<MicrosoftMessage[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [editor, setEditor] = useState<{
    replyTo?: string;
    replyAll?: boolean;
    existing?: MicrosoftMessage;
  }>();
  const [actionBusy, setActionBusy] = useState(false);
  const editorDirty = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    (async () => {
      let page = await mailRequest<Page<MicrosoftMessage>>(
        "thread",
        { conversation: id },
        undefined,
        controller.signal,
      );
      const all = [...page.records];
      while (page.next) {
        page = await mailRequest(
          "page",
          { cursor: page.next },
          undefined,
          controller.signal,
        );
        all.push(...page.records);
      }
      const ordered = groupMicrosoftMessages(all).flatMap((t) => t.messages);
      if (!controller.signal.aborted) {
        setMessages(ordered);
        onLoaded(id, ordered);
        setExpanded((old) =>
          old.length
            ? old
            : ordered.length
              ? [ordered[ordered.length - 1].id]
              : [],
        );
      }
    })()
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, revision, onLoaded]);
  const latest = messages[messages.length - 1];
  const senderEmails = messages
    .filter((m) => !m.isDraft)
    .map((m) => m.from?.emailAddress.address?.toLowerCase());
  const matches = customers.filter(
    (c) => c.email && senderEmails.includes(c.email.toLowerCase()),
  );
  async function action(
    m: MicrosoftMessage,
    type: "read" | "move",
    restore = false,
  ) {
    if (type === "move" && editorDirty.current) {
      setError("Save your reply before moving a message.");
      return;
    }
    setActionBusy(true);
    setError("");
    try {
      await mailRequest(
        type,
        {},
        type === "read"
          ? { id: m.id, isRead: !m.isRead }
          : { id: m.id, restore },
      );
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionBusy(false);
    }
  }
  function edit(value: typeof editor) {
    if (
      !editorDirty.current ||
      window.confirm("Discard unsaved reply changes?")
    ) {
      editorDirty.current = false;
      onDirty(false);
      setEditor(value);
    }
  }
  return (
    <section className="reading-pane">
      <header className="reading-heading">
        <span className="pill neutral">
          {provider === "hostinger" ? "Hostinger" : "Microsoft"} conversation
        </span>
        <h2>{latest?.subject || "Conversation"}</h2>
        <p className="field-help">
          History includes matching messages from your mailbox folders.
        </p>
      </header>
      <div className="conversation-content">
        {error && (
          <p className="notice amber" role="alert">
            {error}
          </p>
        )}
        {loading && <p role="status">Refreshing conversation…</p>}
        <section className="mail-intelligence">
          <strong>Conversation overview</strong>
          <p>
            {messages.length} messages ·{" "}
            {messages.filter((m) => m.isDraft).length} saved drafts
            {messages.some((m) => m.importance === "high")
              ? " · Marked high importance by the sender"
              : ""}
            .
          </p>
          <small>
            AI summaries are not connected. Original messages are shown below.
          </small>
          {matches.length === 1 && (
            <div className="conversation-next">
              <strong>{matches[0].name}</strong>
              <button
                className="text-button"
                onClick={() => onQuote(matches[0].id)}
              >
                <FileText size={14} /> Create quotation
              </button>
            </div>
          )}
          {matches.length > 1 && (
            <p>
              Multiple customer records match. Open Customers to choose the
              correct account.
            </p>
          )}
        </section>
        <div className="conversation-label">
          <span>ORIGINAL CONVERSATION</span>
          <button
            className="text-button"
            onClick={() =>
              setExpanded(
                expanded.length === messages.length
                  ? []
                  : messages.map((m) => m.id),
              )
            }
          >
            {expanded.length === messages.length
              ? "Collapse all"
              : "Expand all"}
          </button>
        </div>
        {messages.map((m) => (
          <article className="conversation-message" key={m.id}>
            <button
              className="conversation-message-header"
              aria-expanded={expanded.includes(m.id)}
              onClick={() =>
                setExpanded((old) =>
                  old.includes(m.id)
                    ? old.filter((x) => x !== m.id)
                    : [...old, m.id],
                )
              }
            >
              <span className="avatar">
                {(m.from?.emailAddress.name || "M")[0]}
              </span>
              <span>
                <strong>
                  {m.from?.emailAddress.name ||
                    m.from?.emailAddress.address ||
                    "Draft"}
                </strong>
                <small>To: {addressList(m.toRecipients)}</small>
              </span>
              <span>
                <time>
                  {new Date(
                    m.receivedDateTime || m.sentDateTime || "",
                  ).toLocaleString()}
                </time>
                <small>
                  {m.isDraft ? "Saved draft" : m.isRead ? "Read" : "Unread"}
                </small>
              </span>
            </button>
            {expanded.includes(m.id) ? (
              <div className="conversation-message-body">
                <MessageContent message={m} revision={revision} />
                <div className="mail-command-bar">
                  {m.isDraft ? (
                    provider === "hostinger" ? (
                      <span className="field-help">
                        Edit provider drafts in Hostinger webmail.
                      </span>
                    ) : (
                      <button
                        className="text-button"
                        onClick={() => edit({ existing: m })}
                      >
                        <PenLine size={14} /> Edit draft
                      </button>
                    )
                  ) : (
                    <>
                      <button
                        className="text-button"
                        onClick={() => edit({ replyTo: m.id })}
                      >
                        <Reply size={14} /> Reply
                      </button>
                      <button
                        className="text-button"
                        onClick={() => edit({ replyTo: m.id, replyAll: true })}
                      >
                        Reply all
                      </button>
                    </>
                  )}
                  <button
                    className="text-button"
                    disabled={actionBusy}
                    onClick={() => action(m, "read")}
                  >
                    {m.isRead ? "Mark unread" : "Mark read"}
                  </button>
                  {!m.isDraft && (
                    <>
                      <button
                        className="text-button"
                        disabled={actionBusy}
                        onClick={() => action(m, "move")}
                      >
                        <Archive size={14} /> Archive message
                      </button>
                      <button
                        className="text-button"
                        disabled={actionBusy}
                        onClick={() => action(m, "move", true)}
                      >
                        Move to Inbox
                      </button>
                    </>
                  )}
                  {outlookLink(m.webLink) && (
                    <a
                      className="text-button"
                      href={outlookLink(m.webLink)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open in Outlook <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <p className="collapsed-message">{m.bodyPreview}</p>
            )}
          </article>
        ))}
        {editor && (
          <DraftEditor
            key={`${editor.replyTo}-${editor.replyAll}-${editor.existing?.id}`}
            {...editor}
            onDirty={(v) => {
              editorDirty.current = v;
              onDirty(v);
            }}
            onChanged={onChanged}
            provider={provider}
          />
        )}
      </div>
    </section>
  );
}
function MessageContent({
  message,
  revision,
}: {
  message: MicrosoftMessage;
  revision: number;
}) {
  const [record, setRecord] = useState<MicrosoftMessage>();
  const [attachments, setAttachments] = useState<MailAttachment[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    (async () => {
      const detail = await mailRequest(
        "message",
        { id: message.id },
        undefined,
        controller.signal,
      );
      if (!controller.signal.aborted) setRecord(detail.record);
      let page = await mailRequest<Page<MailAttachment>>(
        "attachments",
        { id: message.id },
        undefined,
        controller.signal,
      );
      const all = [...page.records];
      while (page.next) {
        page = await mailRequest(
          "page",
          { cursor: page.next },
          undefined,
          controller.signal,
        );
        all.push(...page.records);
      }
      if (!controller.signal.aborted) setAttachments(all);
    })().catch((e) => {
      if (!controller.signal.aborted) setError(e.message);
    });
    return () => controller.abort();
  }, [message.id, revision]);
  async function download(a: MailAttachment) {
    setError("");
    try {
      const response = await fetch(
        `/api/mail?${new URLSearchParams({ action: "download", id: message.id, attachment: a.id })}`,
      );
      if (!response.ok) throw new Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = a.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      {record?.ccRecipients?.length ? (
        <p className="field-help">Cc: {addressList(record.ccRecipients)}</p>
      ) : null}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {record?.body ? (
        <SafeMailBody body={record.body} />
      ) : (
        <p>{message.bodyPreview}</p>
      )}
      {attachments.length > 0 && (
        <div className="attachment-list">
          {attachments.map((a) => (
            <button
              className="secondary"
              key={a.id}
              onClick={() => download(a)}
            >
              <Paperclip size={14} />
              {a.name}
              <small>
                {Math.ceil(a.size / 1024)} KB
                {a.isInline ? " · embedded image" : ""}
              </small>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
export function SafeMailBody({
  body,
}: {
  body: { contentType: string; content: string };
}) {
  if (body.contentType.toLowerCase() !== "html")
    return <p className="pre-line">{body.content}</p>;
  const clean = DOMPurify.sanitize(body.content, {
    WHOLE_DOCUMENT: false,
    FORBID_TAGS: [
      "script",
      "form",
      "input",
      "button",
      "iframe",
      "object",
      "embed",
      "base",
      "link",
      "meta",
      "svg",
      "math",
      "video",
      "audio",
    ],
    FORBID_ATTR: [
      "href",
      "target",
      "srcset",
      "action",
      "formaction",
      "background",
    ],
  });
  const doc = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; form-action 'none'; base-uri 'none'"><style>body{font:14px/1.6 Arial,sans-serif;color:#243649;overflow-wrap:anywhere;margin:12px}::selection{background:#0f6cbd;color:#fff;text-shadow:none}::-moz-selection{background:#0f6cbd;color:#fff;text-shadow:none}table{max-width:100%}img{max-width:100%}a{pointer-events:none}</style></head><body>${clean}</body></html>`;
  return (
    <>
      <iframe
        className="original-email-frame"
        title="Original email content"
        sandbox=""
        referrerPolicy="no-referrer"
        srcDoc={doc}
      />
      <p className="field-help">
        External images and links are blocked in this view. Embedded files can
        be downloaded below. Use your mailbox provider for the full original
        rendering.
      </p>
    </>
  );
}
function DraftEditor({
  replyTo,
  replyAll,
  existing,
  onDirty,
  onChanged,
  provider,
}: {
  replyTo?: string;
  replyAll?: boolean;
  existing?: MicrosoftMessage;
  onDirty: (v: boolean) => void;
  onChanged: () => void;
  provider: MailProviderName;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState<{
    record: MicrosoftMessage;
    version: string;
  }>();
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(!!existing);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [review, setReview] = useState<{
    record: MicrosoftMessage;
    approval: string;
  }>();
  const [sent, setSent] = useState(false);
  const [ready, setReady] = useState(!existing);
  useEffect(() => {
    if (!existing) return;
    const controller = new AbortController();
    mailRequest(
      "message",
      { id: existing.id, text: "true" },
      undefined,
      controller.signal,
    )
      .then((data) => {
        setSaved(data);
        setContent(data.record.body.content);
        setReady(true);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [existing?.id]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const navigate = (event: Event) => {
      if (
        dirty &&
        !window.confirm(
          "Discard your unsaved reply changes? Save the draft first to keep them.",
        )
      )
        event.preventDefault();
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("dcx-before-navigate", navigate);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("dcx-before-navigate", navigate);
    };
  }, [dirty]);
  const change = () => {
    setDirty(true);
    onDirty(true);
    setReview(undefined);
    setNotice("");
  };
  async function persistDraft() {
    const data = await mailRequest(
      "draft",
      {},
      saved
        ? { draftId: saved.record.id, version: saved.version, content }
        : { replyTo, replyAll, to, subject, content },
    );
    setSaved(data);
    setDirty(false);
    onDirty(false);
    onChanged();
    return data as { record: MicrosoftMessage; version: string };
  }
  async function save() {
    setBusy(true);
    setError("");
    setReview(undefined);
    try {
      await persistDraft();
      setNotice(
        provider === "hostinger"
          ? "Draft secured for approval. It has not been sent."
          : "Draft saved in Microsoft Outlook. It has not been sent.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveAndPrepare() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const current = !saved || dirty ? await persistDraft() : saved;
      setReview(await mailRequest("review", {}, { id: current.record.id }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    setBusy(true);
    setError("");
    const approval = review!.approval;
    setReview(undefined);
    try {
      const result = await mailRequest("send", {}, { approval });
      setSent(true);
      setNotice(result.message);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="conversation-reply">
      <div className="panel-heading">
        <h3>
          <Reply size={16} />
          {existing
            ? `Edit ${provider === "hostinger" ? "mailbox" : "Outlook"} draft`
            : replyTo
              ? replyAll
                ? "Reply all"
                : "Reply"
              : "New message"}
        </h3>
        <span className="pill neutral">
          {sent
            ? "Send requested"
            : dirty
              ? "Unsaved changes"
              : saved
                ? provider === "hostinger"
                  ? "Ready for approval"
                  : "Saved in Outlook"
                : "Not sent"}
        </span>
      </div>
      {error && (
        <p className="notice amber" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {!replyTo && !existing && !saved && (
        <>
          <label>
            To
            <input
              aria-label="Recipient emails"
              value={to}
              disabled={busy}
              onChange={(e) => {
                setTo(e.target.value);
                change();
              }}
              placeholder="customer@example.com"
            />
          </label>
          <label>
            Subject
            <input
              aria-label="Email subject"
              value={subject}
              disabled={busy}
              onChange={(e) => {
                setSubject(e.target.value);
                change();
              }}
            />
          </label>
        </>
      )}
      {saved && (
        <p className="field-help">
          To: {addressList(saved.record.toRecipients)}
          {saved.record.ccRecipients?.length
            ? ` · Cc: ${addressList(saved.record.ccRecipients)}`
            : ""}
          <br />
          {saved.record.subject}
        </p>
      )}
      {!sent && (
        <>
          <textarea
            aria-label="Email reply content"
            rows={8}
            value={content}
            disabled={busy || !ready}
            onChange={(e) => {
              setContent(e.target.value);
              change();
            }}
            placeholder="Write your message…"
          />
          <div className="button-row">
            <button
              className="secondary"
              disabled={
                busy || !ready || !content.trim() || (!!saved && !dirty)
              }
              onClick={save}
            >
              {provider === "hostinger"
                ? "Save draft"
                : "Save to Outlook drafts"}
            </button>
            <button
              className="primary"
              disabled={busy || !ready || !content.trim()}
              onClick={saveAndPrepare}
            >
              <Send size={14} /> Review & send
            </button>
          </div>
          <p className="field-help">
            Review & send saves this version and opens the final confirmation.
            It will not send until you select Approve & send.
          </p>
        </>
      )}
      {review && (
        <section
          className="mail-send-review"
          aria-label="Review email before sending"
        >
          <h3>Confirm this message</h3>
          <p>
            <strong>To:</strong> {addressList(review.record.toRecipients)}
          </p>
          {!!review.record.ccRecipients?.length && (
            <p>
              <strong>Cc:</strong> {addressList(review.record.ccRecipients)}
            </p>
          )}
          {!!review.record.bccRecipients?.length && (
            <p>
              <strong>Bcc:</strong> {addressList(review.record.bccRecipients)}
            </p>
          )}
          <p>
            <strong>Subject:</strong> {review.record.subject}
          </p>
          <p className="pre-line">{review.record.body?.content}</p>
          {review.record.hasAttachments && (
            <p>
              This draft includes attachments. Review them in your mailbox
              before sending.
            </p>
          )}
          <div className="button-row">
            <button className="primary" disabled={busy} onClick={send}>
              <Send size={14} /> Approve & send
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setReview(undefined)}
            >
              Keep as draft
            </button>
          </div>
          <p className="field-help">
            This sends a real email from the connected mailbox. Review expires
            after 10 minutes; any edit requires a new review.
          </p>
        </section>
      )}
    </section>
  );
}
