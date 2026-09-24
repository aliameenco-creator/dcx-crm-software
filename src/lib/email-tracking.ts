export interface TrackedThread {
  id: string; subject: string; status: string; priority: string; customer_id: string | null;
  assigned_to: string; next_action: string; followup_at: string | null; summary: string;
  summary_message_version: number | null; message_version: number; version: number; last_message_at: string;
}
export interface TrackedMessage {
  id: string; thread_id: string; sender: string; to_addresses: string[]; cc_addresses: string[];
  subject: string; body_text: string; body_html: string; body_loaded: boolean;
  direction: string; has_attachments: boolean; occurred_at: string;
}
export interface TrackedDraft {
  id: string; reply_to_message_id: string; current_body: string; original_ai_body: string | null;
  revision: number; source_message_version: number; status: string; to_addresses: string[]; subject: string;
}
export interface ThreadDetail {
  reply_target?: TrackedMessage | null;
  thread: TrackedThread; messages: TrackedMessage[]; next: string | null; draft?: TrackedDraft;
  activity: { id: number; action: string; actor: string; created_at: string; details: Record<string, any> }[];
  jobs: { id: string; kind: string; status: string; error?: string; created_at: string }[];
}
export const trackingLabels: Record<string,string> = { all:'All conversations', needs_attention:'Needs attention', draft_ready:'Draft ready', waiting_customer:'Waiting for customer', due:'Follow-ups due', closed:'Closed', failed:'Needs checking' };
export async function trackingRequest<T = any>(action: string, params: Record<string,string> = {}, body?: unknown): Promise<T> {
  const response=await fetch(`/api/tracking?${new URLSearchParams({action,...params})}`, { credentials:'same-origin', cache:'no-store',
    ...(body === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}) });
  const result=await response.json();
  if(!response.ok) throw new Error(result.error || 'Email tracking request failed.');
  return result;
}
