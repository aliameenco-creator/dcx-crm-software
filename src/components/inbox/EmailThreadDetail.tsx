import React, { useState } from 'react';
import { EmailLog } from '../../types/crm';
import { 
  CheckCircle2, 
  Edit3, 
  Send, 
  Paperclip, 
  ExternalLink,
  MessageSquare,
  Sparkles,
  User,
  ShieldCheck
} from 'lucide-react';

interface EmailThreadDetailProps {
  email: EmailLog;
  onApprove: (emailId: string) => void;
  onReject: (emailId: string) => void;
  onSaveEdit: (emailId: string, editedDraft: string) => void;
  onReplyManual: (emailId: string, replyText: string) => void;
}

export const EmailThreadDetail: React.FC<EmailThreadDetailProps> = ({
  email,
  onApprove,
  onReject,
  onSaveEdit,
  onReplyManual
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(email.ai_draft_reply || '');
  const [manualReplyText, setManualReplyText] = useState('');
  const [showManualReply, setShowManualReply] = useState(false);

  const handleApprove = () => {
    onApprove(email.id);
  };

  const handleSaveEdit = () => {
    onSaveEdit(email.id, draftText);
    setIsEditing(false);
  };

  const handleSendManual = () => {
    if (manualReplyText.trim()) {
      onReplyManual(email.id, manualReplyText);
      setManualReplyText('');
      setShowManualReply(false);
    }
  };

  return (
    <div className="card-surface flex flex-col h-full overflow-hidden bg-white border border-slate-200 rounded-xl shadow-sm">
      
      {/* 1. Clean Top Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="badge-blue text-[11px]">{email.category}</span>
              {email.urgency === 'High' || email.urgency === 'Emergency Critical' ? (
                <span className="badge-amber font-semibold text-[11px]">High Priority</span>
              ) : null}
            </div>
            
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              {email.subject}
            </h2>
            
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-800">{email.sender_name}</span>
              <span>&lt;{email.sender_email}&gt;</span>
              <span>•</span>
              <span className="font-mono">{new Date(email.received_at).toLocaleString()}</span>
            </div>
          </div>

          {/* Top Actions for Pending Review */}
          {email.status === 'Pending Review' && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onReject(email.id)}
                className="btn-secondary text-xs py-2 px-3 text-slate-600 hover:text-rose-600"
              >
                Archive
              </button>
              <button
                onClick={handleApprove}
                className="btn-primary text-xs flex items-center gap-1.5 py-2 px-4 shadow-sm font-bold"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Approve &amp; Send</span>
              </button>
            </div>
          )}

        </div>
      </div>

      {/* 2. Main Conversation Stream */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-slate-50/60">
        
        {/* Inbound Customer Message */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">
                {email.sender_name.charAt(0)}
              </div>
              <span className="text-slate-800 font-bold">{email.sender_name}</span>
            </div>
            <span className="font-mono text-[11px] text-slate-400">
              {new Date(email.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 text-sm text-slate-800 leading-relaxed shadow-sm whitespace-pre-line font-sans">
            {email.body}

            {/* Attachments */}
            {email.attachments && email.attachments.length > 0 && (
              <div className="pt-4 mt-4 border-t border-slate-100 flex flex-wrap gap-2">
                {email.attachments.map((att, idx) => (
                  <a
                    key={idx}
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-medium">{att.name}</span>
                    <span className="text-slate-400 font-mono text-[10px]">({att.size_mb} MB)</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Technical Reference Note (Clean Minimal Banner) */}
        {email.ai_reasoning && (
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-1.5 text-xs text-slate-600">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-slate-700" />
              <span>Equipment Verification &amp; Context:</span>
            </div>
            <p className="leading-relaxed text-slate-600 pl-5">{email.ai_reasoning}</p>
            {email.cited_manuals && email.cited_manuals.length > 0 && (
              <div className="pl-5 pt-0.5 text-[11px] text-slate-500 font-mono">
                Reference: {email.cited_manuals.join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Response Message (Draft or Sent) */}
        {email.ai_draft_reply && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span className="font-bold text-slate-800">
                {email.status === 'Approved & Sent' ? 'Sent Response' : 'Proposed Draft Response'}
              </span>
              {email.status === 'Pending Review' && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-slate-700 hover:text-slate-900 flex items-center gap-1 font-semibold"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Message
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  rows={8}
                  className="w-full bg-white border-2 border-slate-300 text-slate-900 text-sm p-4 rounded-xl font-sans focus:outline-none focus:border-slate-800 leading-relaxed shadow-sm"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setIsEditing(false)} className="btn-ghost text-xs">
                    Cancel
                  </button>
                  <button onClick={handleSaveEdit} className="btn-primary text-xs py-1.5 px-3 font-bold">
                    Save Draft
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white border-2 border-slate-200 rounded-xl p-5 text-sm text-slate-800 leading-relaxed shadow-sm whitespace-pre-line font-sans">
                {email.final_sent_email || email.ai_draft_reply}
              </div>
            )}

            {email.approval_timestamp && (
              <div className="text-[11px] text-slate-400 font-mono">
                Dispatched on {new Date(email.approval_timestamp).toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* Manual Direct Composer */}
        {showManualReply && (
          <div className="bg-white border border-slate-300 rounded-xl p-5 space-y-3 shadow-md">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-slate-700" /> Send Custom Email
            </h4>
            <textarea
              value={manualReplyText}
              onChange={(e) => setManualReplyText(e.target.value)}
              placeholder="Type your reply here..."
              rows={5}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm p-3.5 rounded-lg focus:outline-none focus:border-slate-500 leading-relaxed"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowManualReply(false)} className="btn-ghost text-xs">
                Cancel
              </button>
              <button onClick={handleSendManual} className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3 font-bold">
                <Send className="w-3.5 h-3.5" /> Send Email
              </button>
            </div>
          </div>
        )}

      </div>

      {/* 3. Action Footer */}
      <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between">
        <button
          onClick={() => setShowManualReply(!showManualReply)}
          className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3"
        >
          <Edit3 className="w-3.5 h-3.5" /> Custom Reply
        </button>

        {email.status === 'Pending Review' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onReject(email.id)}
              className="btn-ghost text-xs text-slate-500 hover:text-rose-600"
            >
              Archive
            </button>
            <button
              onClick={handleApprove}
              className="btn-primary text-xs flex items-center gap-1.5 py-2 px-4 shadow-sm font-bold"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Approve &amp; Send</span>
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
