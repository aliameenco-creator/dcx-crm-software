import React from 'react';
import { Customer, Quotation, EmailLog } from '../../types/crm';
import { formatCurrencyCAD } from '../../lib/calculator';
import { 
  X, 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  BatteryCharging, 
  ShieldCheck, 
  AlertTriangle, 
  FileText, 
  MessageSquare,
  Zap
} from 'lucide-react';

interface CustomerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  quotations: Quotation[];
  emails: EmailLog[];
  onTriggerQuote: (customer: Customer) => void;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  isOpen,
  onClose,
  customer,
  quotations,
  emails,
  onTriggerQuote
}) => {
  if (!isOpen || !customer) return null;

  const customerQuotes = quotations.filter(q => q.customer_id === customer.customer_id);
  const customerEmails = emails.filter(e => e.customer_id === customer.customer_id || e.sender_email === customer.primary_email);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold font-mono">
              {customer.company_name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-slate-900">{customer.company_name}</h3>
                <span className="badge-blue">{customer.priority_tier}</span>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5 font-mono">
                <span>ID: {customer.customer_id}</span>
                <span>•</span>
                <span>Client Since: {customer.customer_since}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onTriggerQuote(customer);
              }}
              className="btn-primary text-xs font-bold flex items-center gap-1.5 py-1.5 px-3"
            >
              <Zap className="w-3.5 h-3.5" /> Create Quote
            </button>
            <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-800">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50/50">
          
          {/* Top Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5 shadow-sm">
              <div className="text-[10px] font-mono text-slate-500 uppercase font-bold flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Contact Details
              </div>
              <div className="text-sm font-bold text-slate-900">{customer.contact_name}</div>
              <div className="text-xs text-slate-600 flex items-center gap-1">
                <Mail className="w-3 h-3 text-slate-400" /> {customer.primary_email}
              </div>
              <div className="text-xs text-slate-600 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" /> {customer.phone_number}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5 shadow-sm">
              <div className="text-[10px] font-mono text-slate-500 uppercase font-bold flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Facility Location
              </div>
              <div className="text-xs text-slate-700 leading-relaxed font-medium">{customer.facility_address}</div>
              <div className="text-xs font-mono text-slate-900 font-semibold pt-1">
                Distance: {customer.distance_km} km ({customer.distance_km * 2} km RT)
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5 shadow-sm">
              <div className="text-[10px] font-mono text-slate-500 uppercase font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" /> Account Financials
              </div>
              <div className="text-lg font-bold font-mono text-slate-900">
                {formatCurrencyCAD(customer.total_spend_cad || 0)}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {customerQuotes.length} Total Quotes Logged
              </div>
            </div>

          </div>

          {/* Installed Equipment Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <BatteryCharging className="w-4 h-4 text-slate-700" /> Installed Hardware &amp; Battery Lifecycle
              </h4>
              <span className="text-xs font-mono text-slate-500">
                {customer.assets?.length || 0} Registered Units
              </span>
            </div>

            <div className="space-y-3">
              {customer.assets?.map((asset) => {
                const lifePercent = Math.min(100, Math.round((asset.battery_age_years / 3.0) * 100));

                return (
                  <div key={asset.asset_id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h5 className="font-bold text-slate-900 text-sm">{asset.ups_model}</h5>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          Serial: <strong className="text-slate-800">{asset.serial_number}</strong> • String: {asset.battery_quantity}x {asset.battery_type}
                        </div>
                      </div>
                      <div>
                        {asset.is_battery_overdue ? (
                          <span className="badge-amber flex items-center gap-1 font-bold">
                            <AlertTriangle className="w-3.5 h-3.5" /> 3-Year Milestone Due ({asset.battery_age_years} Yrs)
                          </span>
                        ) : (
                          <span className="badge-emerald flex items-center gap-1 font-semibold">
                            <ShieldCheck className="w-3.5 h-3.5" /> Battery Normal ({asset.battery_age_years} Yrs)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between text-xs font-mono font-medium">
                        <span className="text-slate-600">Battery Lifecycle (36-Month Milestone):</span>
                        <span className={asset.is_battery_overdue ? 'text-amber-800 font-bold' : 'text-slate-800'}>
                          {asset.battery_age_years} / 3.0 Years ({lifePercent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            asset.is_battery_overdue ? 'bg-amber-500' : 'bg-slate-800'
                          }`}
                          style={{ width: `${lifePercent}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5 font-mono">
                        <span>Installed: {asset.installation_date}</span>
                        <span>Replacement Due: {asset.battery_replacement_due}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                      <span>SLA Contract: <strong className="text-slate-800">{asset.active_sla_tier}</strong></span>
                      <span>Last Service: <strong className="text-slate-800">{asset.last_service_date || 'N/A'}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Past Quotations */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-700" /> Quotations History
              </h4>
              <span className="text-xs font-mono text-slate-500">{customerQuotes.length} Records</span>
            </div>

            {customerQuotes.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200 shadow-sm">
                No previous quotes found for this client.
              </div>
            ) : (
              <div className="space-y-2">
                {customerQuotes.map((q) => (
                  <div key={q.quote_id} className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs shadow-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{q.quote_id}</span>
                        <span className="font-medium text-slate-700">{q.scope_summary}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Date: {new Date(q.created_at).toLocaleDateString()} • Plan: {q.maintenance_plan_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-slate-900 text-sm">
                        {formatCurrencyCAD(q.total_amount_cad)}
                      </div>
                      <span className="badge-neutral text-[10px] font-semibold">
                        {q.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Email Conversation History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-slate-700" /> Communications History
              </h4>
              <span className="text-xs font-mono text-slate-500">{customerEmails.length} Threads</span>
            </div>

            <div className="space-y-2">
              {customerEmails.map((e) => (
                <div key={e.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5 text-xs shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{e.subject}</span>
                    <span className="text-[10px] font-mono text-slate-400">{new Date(e.received_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-slate-600 line-clamp-2 leading-relaxed">
                    {e.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
