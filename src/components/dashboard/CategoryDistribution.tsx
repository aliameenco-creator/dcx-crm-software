import React from 'react';
import { EmailCategory } from '../../types/crm';
import { Wrench, BatteryCharging, FileText, UserPlus, Users, Calendar } from 'lucide-react';

interface CategoryDistributionProps {
  onSelectCategory?: (category: EmailCategory) => void;
}

export const CategoryDistribution: React.FC<CategoryDistributionProps> = ({ onSelectCategory }) => {
  const categories: Array<{
    name: EmailCategory;
    count: number;
    percent: number;
    icon: any;
  }> = [
    {
      name: 'Equipment Upgrade & Pricing',
      count: 142,
      percent: 37,
      icon: BatteryCharging,
    },
    {
      name: 'Technical Support / Bug',
      count: 118,
      percent: 31,
      icon: Wrench,
    },
    {
      name: 'New Lead Inquiry',
      count: 46,
      percent: 12,
      icon: UserPlus,
    },
    {
      name: 'Tender / RFQ with Docs',
      count: 34,
      percent: 9,
      icon: FileText,
    },
    {
      name: 'Calendar & Scheduling',
      count: 16,
      percent: 4,
      icon: Calendar,
    },
    {
      name: 'Internal Team',
      count: 28,
      percent: 7,
      icon: Users,
    },
  ];

  return (
    <div className="card-surface p-5 space-y-4 bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-bold text-sm sm:text-base text-slate-900">
            Inbound Communications by Category
          </h3>
          <p className="text-xs text-slate-500">
            384 total messages triaged this month
          </p>
        </div>
      </div>

      <div className="space-y-3 pt-1">
        {categories.map((cat, idx) => {
          const Icon = cat.icon;
          return (
            <div
              key={idx}
              onClick={() => onSelectCategory && onSelectCategory(cat.name)}
              className="group cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors"
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-1 rounded bg-slate-100 text-slate-700">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-semibold text-slate-800 group-hover:text-slate-900 transition-colors">
                    {cat.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-400 text-[11px]">{cat.count}</span>
                  <span className="font-bold text-slate-800 text-xs">{cat.percent}%</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-800 rounded-full transition-all duration-500 group-hover:bg-slate-900"
                  style={{ width: `${cat.percent}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
