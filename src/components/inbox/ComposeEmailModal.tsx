import React, { useState } from 'react';
import { X, Send, Sparkles } from 'lucide-react';
import { Customer } from '../../types/crm';

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  onSendEmail: (recipientEmail: string, subject: string, body: string) => void;
}

export const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({
  isOpen,
  onClose,
  customers,
  onSendEmail
}) => {
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (toEmail.trim() && subject.trim() && body.trim()) {
      onSendEmail(toEmail, subject, body);
      onClose();
    }
  };

  const handleSelectCustomer = (email: string) => {
    setToEmail(email);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Compose Message</h3>
              <p className="text-xs text-slate-500">Sent directly via Microsoft Outlook</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Select Registered Client
            </label>
            <select
              onChange={(e) => handleSelectCustomer(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs p-2.5 rounded-lg focus:outline-none focus:border-slate-800"
            >
              <option value="">-- Choose a client or enter recipient email below --</option>
              {customers.map((c) => (
                <option key={c.customer_id} value={c.primary_email}>
                  {c.company_name} ({c.contact_name}) - {c.primary_email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Recipient Email <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="e.g. client@hospital.ca"
              className="w-full bg-white border border-slate-200 text-slate-900 text-xs sm:text-sm p-2.5 rounded-lg focus:outline-none focus:border-slate-800 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Subject Line <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. UPS Preventative Maintenance Inspection"
              className="w-full bg-white border border-slate-200 text-slate-900 text-xs sm:text-sm p-2.5 rounded-lg focus:outline-none focus:border-slate-800 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Message Content <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email message here..."
              className="w-full bg-white border border-slate-200 text-slate-900 text-xs sm:text-sm p-3.5 rounded-lg focus:outline-none focus:border-slate-800 font-sans leading-relaxed shadow-sm"
            />
          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-slate-400" /> Professional signature attached automatically
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary text-xs flex items-center gap-1.5 font-bold shadow-sm"
              >
                <Send className="w-3.5 h-3.5" /> Send Message
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
