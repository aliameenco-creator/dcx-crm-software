import React from 'react';
import { Quotation } from '../../types/crm';
import { formatCurrencyCAD } from '../../lib/calculator';
import { X, Printer, CheckCircle2, Zap } from 'lucide-react';

interface QuoteDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote: Quotation | null;
  onApproveQuote?: (quoteId: string) => void;
}

export const QuoteDetailModal: React.FC<QuoteDetailModalProps> = ({
  isOpen,
  onClose,
  quote,
  onApproveQuote
}) => {
  if (!isOpen || !quote) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* Top Actions */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <span className="badge-blue">{quote.quote_id}</span>
            <span className="text-xs font-mono font-bold text-slate-800">{quote.status}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF
            </button>
            {quote.status === 'Pending Approval' && onApproveQuote && (
              <button
                onClick={() => {
                  onApproveQuote(quote.quote_id);
                  onClose();
                }}
                className="btn-primary text-xs py-1.5 px-3 font-bold flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve &amp; Dispatch
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-800">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Branded Printable PDF View */}
        <div id="printable-quote" className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1 bg-white text-slate-900">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-slate-900 pb-6">
            <div>
              <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
                <Zap className="w-5 h-5 fill-slate-900 text-slate-900" />
                <span>UPS &amp; BATTERY SYSTEMS CANADA</span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Industrial Power Protection, Battery Supply &amp; Field Engineering
              </p>
              <div className="text-[11px] text-slate-500 font-mono mt-2 space-y-0.5">
                <div>Ontario Operations: Toronto / Mississauga, ON</div>
                <div>support@upssystems.ca | +1 (800) 555-UPS1</div>
                <div>Certified Technical Operations</div>
              </div>
            </div>

            <div className="text-left sm:text-right font-mono space-y-1">
              <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">OFFICIAL QUOTATION</div>
              <div className="text-base font-bold text-slate-900">{quote.quote_id}</div>
              <div className="text-xs text-slate-500">Date: {new Date(quote.created_at).toLocaleDateString()}</div>
              <div className="text-xs text-slate-500">Valid Until: {new Date(quote.valid_until).toLocaleDateString()}</div>
            </div>
          </div>

          {/* Client Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <div className="text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">CLIENT:</div>
              <div className="font-bold text-slate-900 text-sm">{quote.customer_name}</div>
              <div className="text-slate-600">{quote.customer_email}</div>
              <div className="text-slate-500 mt-1">{quote.facility_address}</div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">SCOPE SUMMARY:</div>
              <div className="text-slate-800 font-medium leading-relaxed">{quote.scope_summary}</div>
              <div className="text-slate-500 font-mono text-[11px] mt-1">
                Field Distance: {quote.travel_distance_km} km Round-Trip
              </div>
            </div>
          </div>

          {/* Hardware Breakdown */}
          <div className="space-y-2">
            <div className="text-xs font-mono uppercase text-slate-800 font-bold">1. Hardware Breakdown</div>
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Unit Rate (CAD)</th>
                    <th className="p-3 text-right">Total (CAD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {quote.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{item.name}</div>
                        <div className="text-[11px] text-slate-500">{item.description}</div>
                      </td>
                      <td className="p-3 text-center font-mono font-medium">{item.quantity}</td>
                      <td className="p-3 text-right font-mono font-medium">{formatCurrencyCAD(item.unit_price)}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">{formatCurrencyCAD(item.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Labor & Logistics */}
          <div className="space-y-2">
            <div className="text-xs font-mono uppercase text-slate-800 font-bold">2. Field Engineering &amp; Logistics</div>
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left">
                <tbody className="divide-y divide-slate-100 font-sans">
                  <tr>
                    <td className="p-3 font-semibold text-slate-800">
                      Certified Senior Electrical Technician Labor
                      <div className="text-[11px] text-slate-500 font-mono font-normal">
                        {quote.labor_hours} hours total @ ${quote.labor_rate_per_hour}/hr
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      {formatCurrencyCAD(quote.labor_subtotal)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-800">
                      Vehicle Fuel &amp; Transport Logistics
                      <div className="text-[11px] text-slate-500 font-mono font-normal">
                        {quote.travel_distance_km} km round-trip @ ${quote.fuel_rate_per_km}/km
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      {formatCurrencyCAD(quote.travel_subtotal)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-800">
                      Service Callout &amp; Tooling Fee
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      {formatCurrencyCAD(quote.callout_fee)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Maintenance Plan */}
          <div className="space-y-2">
            <div className="text-xs font-mono uppercase text-slate-800 font-bold">3. Preventative Maintenance Care</div>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs shadow-sm">
              <div>
                <div className="font-bold text-slate-800">{quote.maintenance_plan_name}</div>
                <div className="text-[11px] text-slate-500">Includes emergency response and scheduled annual impedance testing</div>
              </div>
              <div className="font-mono font-bold text-slate-900 text-sm">
                {formatCurrencyCAD(quote.maintenance_plan_cad)}
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-slate-50 p-5 rounded-xl border-2 border-slate-900 space-y-2 font-mono text-xs shadow-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-bold text-slate-900">{formatCurrencyCAD(quote.subtotal_cad)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>HST (13%):</span>
              <span className="font-bold text-slate-900">{formatCurrencyCAD(quote.tax_cad)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-300 pt-2">
              <span>TOTAL (CAD):</span>
              <span>{formatCurrencyCAD(quote.total_amount_cad)}</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
