import React from 'react';
import { StatCards } from './StatCards';
import { CategoryDistribution } from './CategoryDistribution';
import { UrgentTasksQueue } from './UrgentTasksQueue';
import { ExecutiveStats, Quotation, TenderRecord, Customer } from '../../types/crm';
import { Plus } from 'lucide-react';

interface ExecutiveDashboardProps {
  stats: ExecutiveStats;
  quotations: Quotation[];
  tenders: TenderRecord[];
  customers: Customer[];
  onNavigate: (tab: string) => void;
  onSelectQuote: (quote: Quotation) => void;
  onSelectCustomer: (customer: Customer) => void;
  onOpenCreateQuote: () => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  stats,
  quotations,
  tenders,
  customers,
  onNavigate,
  onSelectQuote,
  onSelectCustomer,
  onOpenCreateQuote
}) => {
  const pendingQuotes = quotations.filter(q => q.status === 'Pending Approval' || q.status === 'Drafted');
  const customersWithOverdueBatteries = customers.filter(c => c.assets?.some(a => a.is_battery_overdue));

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Banner (View Inbox removed) */}
      <div className="card-surface p-6 bg-white border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Operations &amp; Sales Overview
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            {stats.inbound_emails_today} communications triaged today. {stats.pending_review} items awaiting approval.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onOpenCreateQuote}
            className="btn-primary text-xs flex items-center gap-1.5 py-2 px-3.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Quote</span>
          </button>
        </div>
      </div>

      {/* 6 Metric Cards */}
      <StatCards stats={stats} onNavigate={onNavigate} />

      {/* Category Breakdown + Urgent Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryDistribution onSelectCategory={() => onNavigate('inbox')} />
        <UrgentTasksQueue
          pendingQuotes={pendingQuotes}
          tenders={tenders}
          customersWithOverdueBatteries={customersWithOverdueBatteries}
          onNavigate={onNavigate}
          onSelectQuote={onSelectQuote}
          onSelectCustomer={onSelectCustomer}
        />
      </div>

      {/* Quotations Pipeline Card */}
      <div className="card-surface p-6 space-y-4 bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="font-bold text-base text-slate-900">
            Monthly Quotations &amp; Pipeline Status
          </h3>
          <p className="text-xs text-slate-500">
            Real-time pipeline progression based on active rates and client responses
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 font-mono font-semibold">
              <span>DRAFTED QUOTES</span>
              <span className="text-slate-900">45 Proposals</span>
            </div>
            <div className="text-xl font-bold font-mono text-slate-900">
              $214,800.00 <span className="text-xs text-slate-500 font-normal">CAD</span>
            </div>
            <p className="text-xs text-slate-600">
              Prepared via automated rate calculations.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 font-mono font-semibold">
              <span>APPROVED &amp; DISPATCHED</span>
              <span className="text-slate-900">42 Sent (93%)</span>
            </div>
            <div className="text-xl font-bold font-mono text-slate-900">
              $198,350.00 <span className="text-xs text-slate-500 font-normal">CAD</span>
            </div>
            <p className="text-xs text-slate-600">
              Signed off and sent to clients via Outlook.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 font-mono font-semibold">
              <span>ACCEPTED / WON</span>
              <span className="text-emerald-700">18 Closed (46%)</span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-700">
              $92,400.00 <span className="text-xs text-slate-500 font-normal">CAD</span>
            </div>
            <p className="text-xs text-slate-600">
              Purchase orders confirmed and logged into asset registry.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
};
