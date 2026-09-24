import React from 'react';
import { ExecutiveStats } from '../../types/crm';
import { formatCurrencyCAD } from '../../lib/calculator';

interface StatCardsProps {
  stats: ExecutiveStats;
  onNavigate: (tab: string) => void;
}

export const StatCards: React.FC<StatCardsProps> = ({ stats, onNavigate }) => {
  const cards = [
    {
      label: 'INBOUND TODAY',
      value: `${stats.inbound_emails_today}`,
      subtext: `${stats.auto_handled_percent}% Automated Response`,
      subtextColor: 'text-emerald-600',
      onClick: () => onNavigate('inbox'),
    },
    {
      label: 'PENDING REVIEW',
      value: `${stats.pending_review}`,
      subtext: 'Requires Decision',
      subtextColor: 'text-emerald-600',
      onClick: () => onNavigate('inbox'),
    },
    {
      label: 'QUOTES SENT (MTD)',
      value: `${stats.quotes_sent_month}`,
      subtext: `${stats.conversion_rate_percent}% Win Rate`,
      subtextColor: 'text-emerald-600',
      onClick: () => onNavigate('quotes'),
    },
    {
      label: 'ACTIVE QUOTED VALUE',
      value: formatCurrencyCAD(stats.quoted_revenue_month_cad),
      subtext: `Won: ${formatCurrencyCAD(stats.won_revenue_month_cad)}`,
      subtextColor: 'text-emerald-600',
      onClick: () => onNavigate('quotes'),
    },
    {
      label: 'BATTERY REPLACEMENTS DUE',
      value: `${stats.batteries_overdue_count} Clients`,
      subtext: '3-Year Milestone Reached',
      subtextColor: 'text-emerald-600',
      onClick: () => onNavigate('customers'),
    },
    {
      label: 'ACTIVE BIDS & RFQS',
      value: `${stats.active_tenders_count}`,
      subtext: 'Closing within 14 Days',
      subtextColor: 'text-amber-600',
      onClick: () => onNavigate('quotes'),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
      {cards.map((card, idx) => {
        return (
          <div
            key={idx}
            onClick={card.onClick}
            className="card-surface-hover p-4 cursor-pointer flex flex-col justify-between group bg-white border border-slate-200 rounded-xl shadow-sm hover:border-slate-400"
          >
            <div>
              <div className="mb-2">
                <span className="text-[11px] font-mono uppercase text-slate-500 font-bold tracking-tight">
                  {card.label}
                </span>
              </div>
              <div className="text-xl font-bold font-mono text-slate-900 mb-1">
                {card.value}
              </div>
            </div>
            <div className="text-[11px] border-t border-slate-100 pt-2 font-bold">
              <span className={card.subtextColor}>{card.subtext}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
