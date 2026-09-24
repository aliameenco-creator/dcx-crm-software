import React, { useState } from 'react';
import { Customer, Quotation, EmailLog } from '../../types/crm';
import { formatCurrencyCAD } from '../../lib/calculator';
import { CustomerDetailModal } from './CustomerDetailModal';
import { AddCustomerModal } from './AddCustomerModal';
import { 
  Search, 
  Plus, 
  BatteryWarning, 
  ShieldCheck, 
  ChevronRight,
  Zap
} from 'lucide-react';

interface CustomerDirectoryProps {
  customers: Customer[];
  quotations: Quotation[];
  emails: EmailLog[];
  onAddCustomer: (customer: Customer) => void;
  onTriggerQuote: (customer: Customer) => void;
}

export const CustomerDirectory: React.FC<CustomerDirectoryProps> = ({
  customers,
  quotations,
  emails,
  onAddCustomer,
  onTriggerQuote
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('All');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const tiers = ['All', 'VIP (Tier 1)', 'Commercial', 'Standard'];

  const filteredCustomers = customers.filter((cust) => {
    if (selectedTier !== 'All' && cust.priority_tier !== selectedTier) {
      return false;
    }
    if (showOverdueOnly) {
      const hasOverdue = cust.assets?.some((a) => a.is_battery_overdue);
      if (!hasOverdue) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        cust.company_name.toLowerCase().includes(q) ||
        cust.contact_name.toLowerCase().includes(q) ||
        cust.primary_email.toLowerCase().includes(q) ||
        cust.facility_address.toLowerCase().includes(q) ||
        cust.assets?.some((a) => a.ups_model.toLowerCase().includes(q) || a.serial_number.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-5 pb-12">
      
      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company, contact, equipment model, serial..."
            className="w-full bg-white border border-slate-200 text-slate-900 text-xs sm:text-sm pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-slate-800 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOverdueOnly(!showOverdueOnly)}
            className={`text-xs px-3.5 py-2 rounded-lg border transition-all flex items-center gap-1.5 font-semibold ${
              showOverdueOnly
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <BatteryWarning className="w-3.5 h-3.5 text-amber-600" />
            <span>3-Year Overdue Only</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary text-xs flex items-center gap-1.5 py-2 px-3.5 font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Client
          </button>
        </div>

      </div>

      {/* Tier Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {tiers.map((tier) => (
          <button
            key={tier}
            onClick={() => setSelectedTier(tier)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedTier === tier
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {tier}
          </button>
        ))}
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredCustomers.map((cust) => {
          const primaryAsset = cust.assets?.[0];
          const hasOverdue = cust.assets?.some((a) => a.is_battery_overdue);

          return (
            <div
              key={cust.customer_id}
              className="card-surface p-5 space-y-4 hover:border-slate-400 transition-all flex flex-col justify-between bg-white border border-slate-200 rounded-xl shadow-sm"
            >
              <div className="space-y-3">
                
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge-blue">{cust.priority_tier}</span>
                      <span className="text-[10px] font-mono text-slate-400">{cust.customer_id}</span>
                    </div>
                    <h3 className="font-bold text-base text-slate-900">
                      {cust.company_name}
                    </h3>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono font-bold text-slate-900">
                      {formatCurrencyCAD(cust.total_spend_cad || 0)}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Total Spend</span>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{cust.contact_name}</span>
                    <span className="font-mono text-slate-600 text-[11px]">{cust.distance_km} km ({cust.distance_km * 2} km RT)</span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{cust.primary_email} • {cust.phone_number}</div>
                  <div className="text-[11px] text-slate-500 truncate">{cust.facility_address}</div>
                </div>

                {/* Equipment Status */}
                {primaryAsset && (
                  <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 truncate max-w-[220px]">
                        {primaryAsset.ups_model}
                      </span>
                      {hasOverdue ? (
                        <span className="badge-amber flex items-center gap-1 text-[10px] font-bold">
                          <BatteryWarning className="w-3 h-3" /> Replacement Due
                        </span>
                      ) : (
                        <span className="badge-emerald flex items-center gap-1 text-[10px] font-semibold">
                          <ShieldCheck className="w-3 h-3" /> Battery Normal
                        </span>
                      )}
                    </div>

                    {/* Progress */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 font-medium">
                        <span>Age: {primaryAsset.battery_age_years} Yrs ({primaryAsset.battery_quantity}x {primaryAsset.battery_type})</span>
                        <span className={hasOverdue ? 'text-amber-700 font-bold' : 'text-slate-600'}>
                          Due: {primaryAsset.battery_replacement_due}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${hasOverdue ? 'bg-amber-500' : 'bg-slate-700'}`}
                          style={{ width: `${Math.min(100, (primaryAsset.battery_age_years / 3.0) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                <button
                  onClick={() => setSelectedCustomer(cust)}
                  className="text-slate-700 hover:text-slate-900 font-semibold flex items-center gap-1 transition-colors"
                >
                  <span>View Profile &amp; History</span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => onTriggerQuote(cust)}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                >
                  <Zap className="w-3 h-3 text-slate-800" />
                  <span>Create Quote</span>
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Customer Detail Modal */}
      <CustomerDetailModal
        isOpen={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        customer={selectedCustomer}
        quotations={quotations}
        emails={emails}
        onTriggerQuote={onTriggerQuote}
      />

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddCustomer={onAddCustomer}
      />

    </div>
  );
};
