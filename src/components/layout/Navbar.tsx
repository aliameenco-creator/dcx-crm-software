import React from 'react';
import { Zap, Plus } from 'lucide-react';

interface NavbarProps {
  onNavigate: (tab: string) => void;
  pendingReviewCount: number;
  onOpenCreateQuote: () => void;
  onOpenAddCustomer: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCreateQuote,
  onOpenAddCustomer
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 lg:px-6 py-2.5 shadow-sm h-[57px] flex items-center justify-between">
      
      {/* Left Brand Logo (Clean, no subtitle) */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-sm">
          <Zap className="w-4 h-4 fill-white text-white" />
        </div>
        <div>
          <h1 className="font-bold text-sm lg:text-base text-slate-900 tracking-tight leading-none">
            UPS &amp; Battery Systems Canada
          </h1>
        </div>
      </div>

      {/* Right Actions (No profile badge/text, no bell) */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenCreateQuote}
          className="btn-primary text-xs flex items-center gap-1.5 py-2 px-3.5 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Quote</span>
        </button>

        <button
          onClick={onOpenAddCustomer}
          className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3.5 hidden sm:flex"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Client</span>
        </button>
      </div>

    </header>
  );
};
