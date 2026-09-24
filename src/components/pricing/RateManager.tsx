import React, { useState } from 'react';
import { PricingConfig, ProductCatalogItem } from '../../types/crm';
import { formatCurrencyCAD, calculateQuotationSummary } from '../../lib/calculator';
import { Save, Wrench, BatteryCharging, Calculator, Check } from 'lucide-react';

interface RateManagerProps {
  pricingConfig: PricingConfig;
  onUpdatePricing: (newConfig: PricingConfig) => void;
}

export const RateManager: React.FC<RateManagerProps> = ({
  pricingConfig,
  onUpdatePricing
}) => {
  const [config, setConfig] = useState<PricingConfig>(pricingConfig);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Live Test Sliders
  const [testQty, setTestQty] = useState<number>(32);
  const [testHours, setTestHours] = useState<number>(12);
  const [testDistanceKm, setTestDistanceKm] = useState<number>(35);
  const [testSla, setTestSla] = useState<'None' | '1-Year Standard' | '3-Year Silver' | '5-Year Gold'>('3-Year Silver');

  const handleUpdateField = (field: keyof PricingConfig, value: number) => {
    setConfig({ ...config, [field]: value });
  };

  const handleUpdateCatalogItem = (id: string, field: keyof ProductCatalogItem, value: any) => {
    const newCatalog = config.catalog.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setConfig({ ...config, catalog: newCatalog });
  };

  const handleSave = () => {
    onUpdatePricing(config);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const testCalculation = calculateQuotationSummary({
    items: [
      {
        item: {
          id: 'test-bat',
          name: '12V 100Ah VRLA Battery',
          category: 'Batteries',
          standard_rate: config.catalog.find(c => c.id === 'bat-100ah')?.standard_rate || 240,
        },
        quantity: testQty
      }
    ],
    technicianCount: 2,
    laborHours: testHours / 2,
    travelDistanceKm: testDistanceKm,
    selectedMaintenancePlan: testSla,
    pricingConfig: config
  });

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="card-surface p-6 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Rates &amp; Pricing Configuration
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl">
            Manage labor rates, fuel logistics costs, and product catalog pricing.
          </p>
        </div>

        <button
          onClick={handleSave}
          className={`btn-primary text-xs py-2 px-4 font-bold flex items-center gap-2 shrink-0 shadow-sm ${
            saveSuccess ? 'bg-emerald-600 text-white' : ''
          }`}
        >
          {saveSuccess ? (
            <>
              <Check className="w-4 h-4" />
              <span>Rates Saved</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Rates</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Rate Inputs (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Section 1: Labor & Fuel */}
          <div className="card-surface p-5 space-y-4 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-slate-700" /> Labor &amp; Travel Rates
              </h3>
              <span className="text-xs font-mono text-slate-500 font-semibold">Standard Parameters</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Technician Labor Rate ($CAD/hr)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono font-bold">$</span>
                  <input
                    type="number"
                    value={config.technician_labor_rate_per_hour}
                    onChange={(e) => handleUpdateField('technician_labor_rate_per_hour', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 text-slate-900 font-mono font-bold text-sm pl-7 pr-3 py-2 rounded-lg focus:outline-none focus:border-slate-800 shadow-sm"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Emergency / After-Hours Rate ($CAD/hr)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono font-bold">$</span>
                  <input
                    type="number"
                    value={config.emergency_labor_rate_per_hour}
                    onChange={(e) => handleUpdateField('emergency_labor_rate_per_hour', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 text-slate-900 font-mono font-bold text-sm pl-7 pr-3 py-2 rounded-lg focus:outline-none focus:border-slate-800 shadow-sm"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Fuel &amp; Travel Rate ($CAD/km)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono font-bold">$</span>
                  <input
                    type="number"
                    step="0.05"
                    value={config.fuel_rate_per_km}
                    onChange={(e) => handleUpdateField('fuel_rate_per_km', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 text-slate-900 font-mono font-bold text-sm pl-7 pr-3 py-2 rounded-lg focus:outline-none focus:border-slate-800 shadow-sm"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Base Callout Service Fee ($CAD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono font-bold">$</span>
                  <input
                    type="number"
                    value={config.base_callout_fee}
                    onChange={(e) => handleUpdateField('base_callout_fee', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 text-slate-900 font-mono font-bold text-sm pl-7 pr-3 py-2 rounded-lg focus:outline-none focus:border-slate-800 shadow-sm"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Section 2: Catalog Rates */}
          <div className="card-surface p-5 space-y-4 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <BatteryCharging className="w-4 h-4 text-slate-700" /> Equipment &amp; Battery Rates
              </h3>
              <span className="text-xs font-mono text-slate-500 font-semibold">{config.catalog.length} Products</span>
            </div>

            <div className="space-y-3">
              {config.catalog.map((item) => {
                const marginPercent = Math.round(((item.standard_rate - item.wholesale_cost) / item.standard_rate) * 100);

                return (
                  <div key={item.id} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">{item.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{item.brand} • {item.category}</div>
                      </div>
                      <span className="badge-emerald text-[10px] font-bold">
                        {marginPercent}% Margin
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">
                          Cost ($CAD)
                        </label>
                        <input
                          type="number"
                          value={item.wholesale_cost}
                          onChange={(e) => handleUpdateCatalogItem(item.id, 'wholesale_cost', parseFloat(e.target.value) || 0)}
                          className="w-full bg-white border border-slate-200 text-slate-800 font-mono text-xs p-1.5 rounded focus:outline-none focus:border-slate-800 shadow-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-900 uppercase mb-0.5">
                          Client Rate ($CAD)
                        </label>
                        <input
                          type="number"
                          value={item.standard_rate}
                          onChange={(e) => handleUpdateCatalogItem(item.id, 'standard_rate', parseFloat(e.target.value) || 0)}
                          className="w-full bg-white border border-slate-300 text-slate-900 font-mono font-bold text-xs p-1.5 rounded focus:outline-none focus:border-slate-900 shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right: Live Calculation Preview (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          
          <div className="card-surface p-5 space-y-4 sticky top-20 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-slate-800" />
                <h3 className="font-bold text-sm text-slate-900">
                  Calculation Preview
                </h3>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              
              <div>
                <div className="flex justify-between text-xs font-mono mb-1 font-semibold">
                  <span className="text-slate-600">Battery Qty (100Ah):</span>
                  <span className="text-slate-900">{testQty} Units</span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={64}
                  step={4}
                  value={testQty}
                  onChange={(e) => setTestQty(parseInt(e.target.value))}
                  className="w-full accent-slate-900 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1 font-semibold">
                  <span className="text-slate-600">Technician Hours:</span>
                  <span className="text-slate-900">{testHours} Hours</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={30}
                  step={2}
                  value={testHours}
                  onChange={(e) => setTestHours(parseInt(e.target.value))}
                  className="w-full accent-slate-900 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1 font-semibold">
                  <span className="text-slate-600">Site Distance:</span>
                  <span className="text-slate-900">{testDistanceKm} km ({testDistanceKm * 2} km RT)</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={150}
                  step={5}
                  value={testDistanceKm}
                  onChange={(e) => setTestDistanceKm(parseInt(e.target.value))}
                  className="w-full accent-slate-900 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Maintenance Plan
                </label>
                <select
                  value={testSla}
                  onChange={(e) => setTestSla(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 text-slate-900 text-xs p-2 rounded-lg focus:outline-none focus:border-slate-800 shadow-sm"
                >
                  <option value="None">None ($0)</option>
                  <option value="1-Year Standard">1-Year Standard ($1,400)</option>
                  <option value="3-Year Silver">3-Year Silver ($3,800)</option>
                  <option value="5-Year Gold">5-Year Gold ($5,900)</option>
                </select>
              </div>

            </div>

            {/* Live Calculation Output Card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs font-mono shadow-sm">
              <div className="flex justify-between text-slate-600">
                <span>Hardware:</span>
                <span className="font-bold text-slate-900">{formatCurrencyCAD(testCalculation.hardwareSubtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Labor ({testHours} hrs @ ${config.technician_labor_rate_per_hour}/hr):</span>
                <span className="font-bold text-slate-900">{formatCurrencyCAD(testCalculation.laborSubtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Fuel &amp; Callout:</span>
                <span className="font-bold text-slate-900">{formatCurrencyCAD(testCalculation.travelSubtotal + testCalculation.calloutFee)}</span>
              </div>
              {testCalculation.maintenancePlanCad > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Care Plan:</span>
                  <span className="font-bold text-slate-900">{formatCurrencyCAD(testCalculation.maintenancePlanCad)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1.5">
                <span>HST (13%):</span>
                <span className="font-bold text-slate-900">{formatCurrencyCAD(testCalculation.taxCad)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-300 pt-2">
                <span>CALCULATED TOTAL:</span>
                <span>{formatCurrencyCAD(testCalculation.totalAmountCad)}</span>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
