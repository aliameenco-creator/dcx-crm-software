import React from 'react';
import { 
  LayoutDashboard, 
  Inbox, 
  Users, 
  FileText, 
  DollarSign
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  pendingEmailsCount: number;
  overdueBatteriesCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  pendingEmailsCount,
  overdueBatteriesCount
}) => {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'inbox',
      label: 'Inbox',
      icon: Inbox,
      badge: pendingEmailsCount > 0 ? { text: `${pendingEmailsCount}`, color: 'bg-amber-500 text-white' } : null
    },
    {
      id: 'customers',
      label: 'Clients & Equipment',
      icon: Users,
      badge: overdueBatteriesCount > 0 ? { text: `${overdueBatteriesCount} Due`, color: 'bg-slate-200 text-slate-700' } : null
    },
    {
      id: 'quotes',
      label: 'Quotations & Bids',
      icon: FileText,
      badge: null
    },
    {
      id: 'pricing',
      label: 'Rates Matrix',
      icon: DollarSign,
      badge: null
    }
  ];

  return (
    <aside className="w-full lg:w-60 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 shadow-sm h-full overflow-y-auto">
      
      {/* Navigation Links without 'NAVIGATION' label */}
      <div className="p-3 space-y-1.5 pt-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${item.badge.color}`}>
                  {item.badge.text}
                </span>
              )}
            </button>
          );
        })}
      </div>

    </aside>
  );
};
