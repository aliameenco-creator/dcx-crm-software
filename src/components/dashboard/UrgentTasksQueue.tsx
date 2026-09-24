import React from 'react';
import { Quotation, TenderRecord, Customer } from '../../types/crm';
import { formatCurrencyCAD } from '../../lib/calculator';
import { ArrowRight, BatteryWarning, Clock } from 'lucide-react';

interface UrgentTasksQueueProps {
  pendingQuotes: Quotation[];
  tenders: TenderRecord[];
  customersWithOverdueBatteries: Customer[];
  onNavigate: (tab: string) => void;
  onSelectQuote: (quote: Quotation) => void;
  onSelectCustomer: (customer: Customer) => void;
}

export const UrgentTasksQueue: React.FC<UrgentTasksQueueProps> = ({
  pendingQuotes,
  tenders,
  customersWithOverdueBatteries,
  onNavigate,
  onSelectQuote,
  onSelectCustomer
}) => {
  return (
    <div className="card-surface p-5 space-y-4 bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="font-bold text-sm sm:text-base text-slate-900">
          Items Requiring Attention
        </h3>
        <span className="text-xs font-mono text-slate-500 font-semibold">
          Action Required
        </span>
      </div>

      <div className="space-y-3">

        {/* 1. Active Tender Deadlines */}
        {tenders.slice(0, 2).map((tender) => (
          <div
            key={tender.id}
            className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-400 transition-all cursor-pointer space-y-2 group shadow-sm"
            onClick={() => onNavigate('quotes')}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="badge-blue">
                RFP / Tender
              </span>
              <span className="font-mono text-[11px] text-slate-500 font-medium">
                Deadline: Sept 15 @ 2:00 PM
              </span>
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-slate-800">
                {tender.title}
              </h4>
              <p className="text-xs text-slate-600 line-clamp-1">
                {tender.organization} • {tender.kVA_requirement}
              </p>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 font-medium">
              <span>Value: {formatCurrencyCAD(tender.estimated_value_cad)}</span>
              <span className="text-slate-800 font-semibold flex items-center gap-1">
                View RFP Details <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        ))}

        {/* 2. 3-Year Battery Overdue Alerts */}
        {customersWithOverdueBatteries.slice(0, 2).map((cust) => {
          const overdueAsset = cust.assets?.find(a => a.is_battery_overdue);
          return (
            <div
              key={cust.customer_id}
              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-400 transition-all cursor-pointer space-y-2 group shadow-sm"
              onClick={() => onSelectCustomer(cust)}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="badge-amber flex items-center gap-1 font-semibold">
                  <BatteryWarning className="w-3 h-3" /> 3-Year Milestone Due
                </span>
                <span className="font-mono text-[11px] text-slate-600 font-medium">
                  {overdueAsset?.battery_age_years} Yrs Active
                </span>
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-slate-800">
                  {cust.company_name}
                </h4>
                <p className="text-xs text-slate-600">
                  {overdueAsset?.ups_model} • {overdueAsset?.battery_quantity}x Batteries
                </p>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 font-medium">
                <span>Replacement Due</span>
                <span className="text-slate-800 font-semibold flex items-center gap-1">
                  Send Proposal <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}

        {/* 3. Pending Quotes */}
        {pendingQuotes.slice(0, 1).map((quote) => (
          <div
            key={quote.quote_id}
            className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-400 transition-all cursor-pointer space-y-2 group shadow-sm"
            onClick={() => onSelectQuote(quote)}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="badge-neutral flex items-center gap-1 font-semibold">
                <Clock className="w-3 h-3" /> Quote Awaiting Approval
              </span>
              <span className="font-mono text-[11px] text-slate-900 font-bold">
                {formatCurrencyCAD(quote.total_amount_cad)}
              </span>
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-slate-800">
                {quote.customer_name}
              </h4>
              <p className="text-xs text-slate-600 line-clamp-1">
                {quote.scope_summary}
              </p>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 font-medium">
              <span>{quote.quote_id}</span>
              <span className="text-slate-800 font-semibold flex items-center gap-1">
                Review <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        ))}

      </div>
    </div>
  );
};
