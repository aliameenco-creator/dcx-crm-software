import React, { useState } from 'react';
import { X, Calculator, Plus, Trash2 } from 'lucide-react';
import { Customer, PricingConfig, Quotation } from '../../types/crm';
import { calculateQuotationSummary, formatCurrencyCAD } from '../../lib/calculator';

interface CreateQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  pricingConfig: PricingConfig;
  initialCustomer?: Customer | null;
  onSaveQuote: (newQuote: Quotation) => void;
}

export const CreateQuoteModal: React.FC<CreateQuoteModalProps> = ({
  isOpen,
  onClose,
  customers,
  pricingConfig,
  initialCustomer,
  onSaveQuote
}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    initialCustomer?.customer_id || customers[0]?.customer_id || ''
  );
  const [scopeSummary, setScopeSummary] = useState('32x 12V 100Ah VRLA Battery Replacement & On-Site Installation');
  const [technicianCount, setTechnicianCount] = useState<number>(2);
  const [laborHours, setLaborHours] = useState<number>(6);
  const [selectedSla, setSelectedSla] = useState<'None' | '1-Year Standard' | '3-Year Silver' | '5-Year Gold'>('3-Year Silver');

  const [items, setItems] = useState<Array<{ catalogItemId: string; quantity: number }>>([
    { catalogItemId: 'bat-100ah', quantity: 32 }
  ]);

  if (!isOpen) return null;

  const currentCustomer = customers.find(c => c.customer_id === selectedCustomerId) || initialCustomer || customers[0];
  const travelDistanceKm = currentCustomer?.distance_km || 30;

  const calcItems = items.map(line => {
    const catalogItem = pricingConfig.catalog.find(c => c.id === line.catalogItemId) || pricingConfig.catalog[0];
    return {
      item: {
        id: catalogItem.id,
        name: catalogItem.name,
        category: catalogItem.category,
        standard_rate: catalogItem.standard_rate,
        description: catalogItem.spec_summary
      },
      quantity: line.quantity
    };
  });

  const calculation = calculateQuotationSummary({
    items: calcItems,
    technicianCount,
    laborHours,
    travelDistanceKm,
    selectedMaintenancePlan: selectedSla,
    pricingConfig
  });

  const handleAddItem = () => {
    setItems([...items, { catalogItemId: pricingConfig.catalog[0].id, quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: 'catalogItemId' | 'quantity', value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newQuote: Quotation = {
      quote_id: `Q-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      customer_id: currentCustomer.customer_id,
      customer_name: currentCustomer.company_name,
      customer_email: currentCustomer.primary_email,
      facility_address: currentCustomer.facility_address,
      scope_summary: scopeSummary,
      items: calculation.quoteItems,
      hardware_subtotal: calculation.hardwareSubtotal,
      labor_hours: calculation.laborHours,
      labor_rate_per_hour: calculation.laborRatePerHour,
      labor_subtotal: calculation.laborSubtotal,
      travel_distance_km: calculation.travelDistanceKm,
      fuel_rate_per_km: calculation.fuelRatePerKm || pricingConfig.fuel_rate_per_km,
      travel_subtotal: calculation.travelSubtotal,
      callout_fee: calculation.calloutFee,
      maintenance_plan_name: calculation.maintenancePlanName,
      maintenance_plan_cad: calculation.maintenancePlanCad,
      subtotal_cad: calculation.subtotalCad,
      tax_cad: calculation.taxCad,
      total_amount_cad: calculation.totalAmountCad,
      status: 'Pending Approval',
      created_at: new Date().toISOString(),
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      follow_up_count: 0,
      notes: 'Generated via quotation calculator.'
    };

    onSaveQuote(newQuote);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900">Create Quotation</h3>
              <p className="text-xs text-slate-500">Calculates automatically from live rates matrix</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Client <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs p-2.5 rounded-lg focus:outline-none focus:border-slate-800 shadow-sm"
              >
                {customers.map((c) => (
                  <option key={c.customer_id} value={c.customer_id}>
                    {c.company_name} ({c.contact_name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Facility Distance
              </label>
              <div className="bg-slate-50 border border-slate-200 text-slate-700 text-xs p-2.5 rounded-lg font-mono flex items-center justify-between shadow-sm">
                <span>{travelDistanceKm} km One-Way</span>
                <span className="text-slate-900 font-bold">{travelDistanceKm * 2} km Round-Trip</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Scope of Work Summary
            </label>
            <input
              type="text"
              required
              value={scopeSummary}
              onChange={(e) => setScopeSummary(e.target.value)}
              placeholder="e.g. 32x VRLA Battery Replacement &amp; Testing"
              className="w-full bg-white border border-slate-200 text-slate-900 text-xs p-2.5 rounded-lg focus:outline-none focus:border-slate-800 shadow-sm"
            />
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 uppercase pb-1 border-b border-slate-100">
              <span>Hardware Items</span>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-slate-900 hover:underline flex items-center gap-1 font-bold text-[11px]"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>

            {items.map((item, idx) => {
              const catalogItem = pricingConfig.catalog.find(c => c.id === item.catalogItemId);
              return (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs shadow-sm">
                  <div className="flex-1">
                    <select
                      value={item.catalogItemId}
                      onChange={(e) => handleUpdateItem(idx, 'catalogItemId', e.target.value)}
                      className="w-full bg-white border border-slate-200 text-slate-900 text-xs p-1.5 rounded focus:outline-none focus:border-slate-800"
                    >
                      {pricingConfig.catalog.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} — {formatCurrencyCAD(cat.standard_rate)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-20">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => handleUpdateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-full bg-white border border-slate-200 text-slate-900 text-xs p-1.5 rounded font-mono text-center font-bold"
                    />
                  </div>

                  <div className="w-24 text-right font-mono font-bold text-slate-900">
                    {formatCurrencyCAD((catalogItem?.standard_rate || 0) * item.quantity)}
                  </div>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Labor & Plan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                Technicians
              </label>
              <input
                type="number"
                min={1}
                value={technicianCount}
                onChange={(e) => setTechnicianCount(parseInt(e.target.value) || 1)}
                className="w-full bg-white border border-slate-200 text-slate-900 text-xs p-2 rounded font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                Hours per Tech
              </label>
              <input
                type="number"
                min={1}
                value={laborHours}
                onChange={(e) => setLaborHours(parseInt(e.target.value) || 1)}
                className="w-full bg-white border border-slate-200 text-slate-900 text-xs p-2 rounded font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                Maintenance Plan
              </label>
              <select
                value={selectedSla}
                onChange={(e) => setSelectedSla(e.target.value as any)}
                className="w-full bg-white border border-slate-200 text-slate-900 text-xs p-2 rounded focus:outline-none focus:border-slate-800 font-medium"
              >
                <option value="None">None</option>
                <option value="1-Year Standard">1-Year Standard ($1,400)</option>
                <option value="3-Year Silver">3-Year Silver ($3,800)</option>
                <option value="5-Year Gold">5-Year Gold ($5,900)</option>
              </select>
            </div>
          </div>

          {/* Calculation Box */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs font-mono shadow-sm">
            <div className="flex justify-between text-slate-600">
              <span>Hardware Subtotal:</span>
              <span className="font-bold text-slate-900">{formatCurrencyCAD(calculation.hardwareSubtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Labor Subtotal ({calculation.laborHours} hrs @ $150/hr):</span>
              <span className="font-bold text-slate-900">{formatCurrencyCAD(calculation.laborSubtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Travel &amp; Logistics:</span>
              <span className="font-bold text-slate-900">{formatCurrencyCAD(calculation.travelSubtotal + calculation.calloutFee)}</span>
            </div>
            {calculation.maintenancePlanCad > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Maintenance Plan:</span>
                <span className="font-bold text-slate-900">{formatCurrencyCAD(calculation.maintenancePlanCad)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1.5">
              <span>HST (13%):</span>
              <span className="font-bold text-slate-900">{formatCurrencyCAD(calculation.taxCad)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-300 pt-2">
              <span>TOTAL (CAD):</span>
              <span>{formatCurrencyCAD(calculation.totalAmountCad)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-ghost text-xs">
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs font-bold py-2 px-4 flex items-center gap-1.5 shadow-sm">
              <span>Save &amp; Generate Quote</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
