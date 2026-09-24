export interface Recipient {
  emailAddress: { name?: string; address: string };
}
export interface MicrosoftMessage {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  from?: Recipient;
  toRecipients: Recipient[];
  ccRecipients?: Recipient[];
  bccRecipients?: Recipient[];
  receivedDateTime: string;
  sentDateTime?: string;
  lastModifiedDateTime?: string;
  isRead: boolean;
  isDraft: boolean;
  importance: string;
  hasAttachments: boolean;
  parentFolderId: string;
  webLink?: string;
  changeKey: string;
  body?: { contentType: string; content: string };
  uniqueBody?: { contentType: string; content: string };
}
export interface MicrosoftFolder {
  id: string;
  displayName: string;
  childFolderCount: number;
  unreadItemCount: number;
  totalItemCount: number;
  depth?: number;
}
export interface MailAttachment {
  id: string;
  name: string;
  size: number;
  isInline: boolean;
  contentType: string;
}
export interface Page<T> {
  records: T[];
  next: string | null;
}
export async function mailRequest<T = any>(
  action: string,
  params: Record<string, string> = {},
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(
    `/api/mail?${new URLSearchParams({ action, ...params })}`,
    {
      credentials: "same-origin",
      signal,
      ...(body === undefined
        ? {}
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "The mailbox request failed.");
  return data;
}
export const addressList = (list?: Recipient[]) =>
  (list || []).map((r) => r.emailAddress.address).join(", ");
export function outlookLink(value?: string) {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" &&
      [
        "outlook.office.com",
        "outlook.office365.com",
        "outlook.live.com",
      ].includes(url.hostname)
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function mailTimestamp(
  message: Pick<
    MicrosoftMessage,
    "receivedDateTime" | "sentDateTime" | "lastModifiedDateTime"
  >,
) {
  for (const value of [
    message.receivedDateTime,
    message.sentDateTime,
    message.lastModifiedDateTime,
  ]) {
    const parsed = Date.parse(value || "");
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}
export function groupMicrosoftMessages(messages: MicrosoftMessage[]) {
  const map = new Map<string, MicrosoftMessage[]>();
  for (const m of messages) {
    const id = m.conversationId || m.id;
    const list = map.get(id) || [];
    if (!list.some((x) => x.id === m.id)) list.push(m);
    map.set(id, list);
  }
  return [...map]
    .map(([id, messages]) => {
      messages.sort(
        (a, b) =>
          mailTimestamp(a) - mailTimestamp(b) || a.id.localeCompare(b.id),
      );
      return { id, messages, latest: messages[messages.length - 1] };
    })
    .sort(
      (a, b) =>
        mailTimestamp(b.latest) - mailTimestamp(a.latest) ||
        a.id.localeCompare(b.id),
    );
}
