import React, { useState } from 'react';
import { Quotation, TenderRecord, Customer, PricingConfig } from '../../types/crm';
import { formatCurrencyCAD } from '../../lib/calculator';
import { QuoteDetailModal } from './QuoteDetailModal';
import { CreateQuoteModal } from './CreateQuoteModal';
import { 
  Plus, 
  FileText, 
  Printer, 
  ExternalLink,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';

interface QuotationPipelineProps {
  quotations: Quotation[];
  tenders: TenderRecord[];
  customers: Customer[];
  pricingConfig: PricingConfig;
  onApproveQuote: (quoteId: string) => void;
  onSaveNewQuote: (newQuote: Quotation) => void;
}

export const QuotationPipeline: React.FC<QuotationPipelineProps> = ({
  quotations,
  tenders,
  customers,
  pricingConfig,
  onApproveQuote,
  onSaveNewQuote
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'quotes' | 'tenders'>('quotes');

  const statuses = ['All', 'Pending Approval', 'Sent to Client', 'Accepted / Won', 'Follow-up Due'];

  const filteredQuotes = quotations.filter((q) => {
    if (selectedStatus !== 'All' && q.status !== selectedStatus) {
      return false;
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        q.quote_id.toLowerCase().includes(query) ||
        q.customer_name.toLowerCase().includes(query) ||
        q.scope_summary.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="space-y-5 pb-12">
      
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        {/* Toggle: Quotes vs Tenders */}
        <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-lg shadow-sm">
          <button
            onClick={() => setActiveTab('quotes')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'quotes'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Quotations ({quotations.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tenders')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'tenders'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Bids &amp; RFQs ({tenders.length})</span>
          </button>
        </div>

        {/* Create Quote Button */}
        <button
          onClick={() => setIsCreateOpen(true)}
          className="btn-primary text-xs flex items-center gap-1.5 py-2 px-3.5 font-bold shadow-sm"
        >
          <Plus className="w-4 h-4" /> Create Quote
        </button>
      </div>

      {activeTab === 'quotes' ? (
        <div className="space-y-4">
          
          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {statuses.map((st) => {
              const isSelected = selectedStatus === st;
              const count = st === 'All' ? quotations.length : quotations.filter(q => q.status === st).length;

              return (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  <span>{st}</span>
                  <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded ${
                    isSelected ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quotes Table */}
          <div className="card-surface overflow-hidden bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-3.5">Quote ID &amp; Date</th>
                    <th className="p-3.5">Client</th>
                    <th className="p-3.5">Scope of Work</th>
                    <th className="p-3.5">Maintenance Plan</th>
                    <th className="p-3.5 text-right">Total (CAD)</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredQuotes.map((quote) => (
                    <tr key={quote.quote_id} className="hover:bg-slate-50/80 transition-colors">
                      
                      <td className="p-3.5 font-mono">
                        <span className="font-bold text-slate-900 block">{quote.quote_id}</span>
                        <span className="text-[10px] text-slate-400">{new Date(quote.created_at).toLocaleDateString()}</span>
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-slate-800">{quote.customer_name}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{quote.facility_address}</div>
                      </td>

                      <td className="p-3.5">
                        <div className="text-slate-700 line-clamp-1 max-w-[260px] font-medium">{quote.scope_summary}</div>
                        <div className="text-[10px] font-mono text-slate-500">Distance: {quote.travel_distance_km} km RT</div>
                      </td>

                      <td className="p-3.5">
                        <span className="text-[11px] text-slate-600 font-medium">{quote.maintenance_plan_name}</span>
                      </td>

                      <td className="p-3.5 text-right font-mono font-bold text-sm text-slate-900">
                        {formatCurrencyCAD(quote.total_amount_cad)}
                      </td>

                      <td className="p-3.5 text-center font-mono">
                        {quote.status === 'Accepted / Won' ? (
                          <span className="badge-emerald text-[10px] font-semibold">
                            Won / Paid
                          </span>
                        ) : quote.status === 'Pending Approval' ? (
                          <span className="badge-amber text-[10px] font-bold">
                            Pending Sign-off
                          </span>
                        ) : quote.status === 'Follow-up Due' ? (
                          <span className="badge-neutral text-[10px] text-amber-800 font-bold">
                            Follow-up Due
                          </span>
                        ) : (
                          <span className="badge-neutral text-[10px] font-medium">
                            {quote.status}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {quote.status === 'Pending Approval' && (
                            <button
                              onClick={() => onApproveQuote(quote.quote_id)}
                              className="btn-primary text-xs py-1 px-2.5 flex items-center gap-1 shadow-sm text-[11px]"
                              title="Approve and send official PDF proposal to client"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                              <span>Approve &amp; Send</span>
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedQuote(quote)}
                            className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1"
                          >
                            <Printer className="w-3 h-3" /> View / Print
                          </button>
                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        /* Bids & RFQs List */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tenders.map((tender) => (
            <div key={tender.id} className="card-surface p-5 space-y-4 bg-white border border-slate-200 rounded-xl shadow-sm">
              
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge-blue">{tender.id}</span>
                    <span className="badge-emerald text-[10px] font-semibold">
                      {tender.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-slate-900">{tender.title}</h3>
                  <div className="text-xs text-slate-500 mt-0.5">{tender.organization}</div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-mono font-bold text-slate-900">{formatCurrencyCAD(tender.estimated_value_cad)}</div>
                  <span className="text-[10px] font-mono text-slate-400">Est. Value</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                  <span className="text-slate-500 block text-[10px]">Required Capacity:</span>
                  <span className="text-slate-900 font-bold">{tender.kVA_requirement}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Runtime:</span>
                  <span className="text-slate-900 font-bold">{tender.battery_autonomy_mins} Mins Full Load</span>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {tender.summary_notes}
              </p>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="text-[11px] font-mono text-slate-500 font-medium">
                  Deadline: {new Date(tender.submission_deadline).toLocaleDateString()}
                </div>
                <a
                  href={tender.onedrive_document_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-slate-700 hover:text-slate-900 font-semibold flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> Attached Documents
                </a>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Quote PDF Modal */}
      <QuoteDetailModal
        isOpen={!!selectedQuote}
        onClose={() => setSelectedQuote(null)}
        quote={selectedQuote}
        onApproveQuote={onApproveQuote}
      />

      {/* Create Quote Modal */}
      <CreateQuoteModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        customers={customers}
        pricingConfig={pricingConfig}
        onSaveQuote={onSaveNewQuote}
      />

    </div>
  );
};
