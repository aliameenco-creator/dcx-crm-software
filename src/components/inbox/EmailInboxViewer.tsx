import React, { useState } from 'react';
import { EmailLog, Customer } from '../../types/crm';
import { EmailThreadDetail } from './EmailThreadDetail';
import { ComposeEmailModal } from './ComposeEmailModal';
import { 
  Search, 
  Plus, 
  Clock, 
  CheckCircle2
} from 'lucide-react';

interface EmailInboxViewerProps {
  emails: EmailLog[];
  customers: Customer[];
  onApproveEmail: (emailId: string) => void;
  onRejectEmail: (emailId: string) => void;
  onSaveEmailDraft: (emailId: string, editedDraft: string) => void;
  onSendManualEmail: (recipientEmail: string, subject: string, body: string) => void;
}

export const EmailInboxViewer: React.FC<EmailInboxViewerProps> = ({
  emails,
  customers,
  onApproveEmail,
  onRejectEmail,
  onSaveEmailDraft,
  onSendManualEmail
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedEmailId, setSelectedEmailId] = useState<string>(emails[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const filterTabs = [
    { id: 'All', label: 'All Messages' },
    { id: 'Pending Review', label: 'Pending Review' },
    { id: 'Technical Support / Bug', label: 'Technical Support' },
    { id: 'Equipment Upgrade & Pricing', label: 'Quotes & Upgrades' },
    { id: 'Tender / RFQ with Docs', label: 'Tenders & RFQs' },
    { id: 'New Lead Inquiry', label: 'New Leads' },
  ];

  const filteredEmails = emails.filter((email) => {
    if (selectedCategory === 'Pending Review') {
      if (email.status !== 'Pending Review') return false;
    } else if (selectedCategory !== 'All') {
      if (email.category !== selectedCategory) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        email.subject.toLowerCase().includes(q) ||
        email.sender_name.toLowerCase().includes(q) ||
        email.sender_email.toLowerCase().includes(q) ||
        email.body.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeEmail = emails.find((e) => e.id === selectedEmailId) || filteredEmails[0];

  return (
    <div className="space-y-4 pb-12">
      
      {/* Top Search Bar & Category Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Clean Filter Tabs (No Overflow Scroll) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {filterTabs.map((tab) => {
            const isSelected = selectedCategory === tab.id;
            const count = tab.id === 'All' 
              ? emails.length 
              : tab.id === 'Pending Review'
              ? emails.filter(e => e.status === 'Pending Review').length
              : emails.filter(e => e.category === tab.id).length;

            return (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                    isSelected 
                      ? 'bg-slate-700 text-white' 
                      : tab.id === 'Pending Review'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Search & Compose */}
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-slate-800"
            />
          </div>

          <button
            onClick={() => setIsComposeOpen(true)}
            className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3 shrink-0 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Compose
          </button>
        </div>

      </div>

      {/* Split Pane: Email List (Left) + Email Detail (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-190px)] min-h-[580px]">
        
        {/* Left: Email Threads List (5 Cols) */}
        <div className="lg:col-span-5 card-surface flex flex-col overflow-hidden bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="px-4 py-2.5 border-b border-slate-200 text-xs font-semibold text-slate-500 flex items-center justify-between bg-slate-50">
            <span>INBOX ({filteredEmails.length})</span>
            <span className="font-normal text-[11px]">Latest First</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredEmails.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No communications found for this filter.
              </div>
            ) : (
              filteredEmails.map((email) => {
                const isSelected = activeEmail?.id === email.id;
                return (
                  <div
                    key={email.id}
                    onClick={() => setSelectedEmailId(email.id)}
                    className={`p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50/80 border-l-4 border-l-slate-900'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-900 truncate max-w-[200px]">
                        {email.sender_name}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {new Date(email.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h4 className="text-xs font-semibold text-slate-800 truncate mb-1">
                      {email.subject}
                    </h4>

                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-2.5">
                      {email.body}
                    </p>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="badge-neutral text-[10px]">
                        {email.category}
                      </span>

                      {email.status === 'Approved & Sent' ? (
                        <span className="badge-emerald text-[10px] flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="w-3 h-3" /> Dispatched
                        </span>
                      ) : email.status === 'Pending Review' ? (
                        <span className="badge-amber text-[10px] flex items-center gap-1 font-bold">
                          <Clock className="w-3 h-3" /> Needs Review
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[10px]">{email.status}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Conversation Stream (7 Cols) */}
        <div className="lg:col-span-7 h-full">
          {activeEmail ? (
            <EmailThreadDetail
              email={activeEmail}
              onApprove={onApproveEmail}
              onReject={onRejectEmail}
              onSaveEdit={onSaveEmailDraft}
              onReplyManual={(emailId, replyText) => onSendManualEmail(activeEmail.sender_email, `Re: ${activeEmail.subject}`, replyText)}
            />
          ) : (
            <div className="card-surface h-full flex items-center justify-center text-slate-400 text-xs bg-white">
              Select an email thread to view conversation.
            </div>
          )}
        </div>

      </div>

      {/* Compose Email Modal */}
      <ComposeEmailModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        customers={customers}
        onSendEmail={onSendManualEmail}
      />

    </div>
  );
};
