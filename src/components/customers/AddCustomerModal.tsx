import React, { useState } from 'react';
import { X, UserPlus, Plus } from 'lucide-react';
import { Customer, CustomerAsset, PriorityTier } from '../../types/crm';
import { calculateBatteryAgeYears, isBatteryOverdue } from '../../lib/calculator';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCustomer: (customer: Customer) => void;
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  onAddCustomer
}) => {
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [primaryEmail, setPrimaryEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [facilityAddress, setFacilityAddress] = useState('');
  const [distanceKm, setDistanceKm] = useState<number>(30);
  const [priorityTier, setPriorityTier] = useState<PriorityTier>('Commercial');
  const [notes, setNotes] = useState('');

  // Equipment fields
  const [upsModel, setUpsModel] = useState('Eaton 93PM 50kVA Modular UPS (3-Phase 208/120V)');
  const [serialNumber, setSerialNumber] = useState('');
  const [batteryType, setBatteryType] = useState('12V 100Ah High-Rate VRLA Battery');
  const [batteryQuantity, setBatteryQuantity] = useState<number>(32);
  const [installationDate, setInstallationDate] = useState('2024-01-15');
  const [activeSlaTier, setActiveSlaTier] = useState('3-Year Silver Care');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !primaryEmail) return;

    const newCustomerId = `CUST-${Math.floor(1000 + Math.random() * 9000)}`;
    const newAssetId = `ASSET-${Math.floor(100 + Math.random() * 900)}`;

    const newAsset: CustomerAsset = {
      asset_id: newAssetId,
      customer_id: newCustomerId,
      ups_model: upsModel,
      serial_number: serialNumber || `ETN-${Math.floor(10000 + Math.random() * 90000)}`,
      battery_type: batteryType,
      battery_quantity: batteryQuantity,
      installation_date: installationDate,
      warranty_end_date: new Date(new Date(installationDate).setFullYear(new Date(installationDate).getFullYear() + 2)).toISOString().split('T')[0],
      battery_replacement_due: new Date(new Date(installationDate).setFullYear(new Date(installationDate).getFullYear() + 3)).toISOString().split('T')[0],
      battery_age_years: calculateBatteryAgeYears(installationDate),
      is_battery_overdue: isBatteryOverdue(installationDate),
      active_sla_tier: activeSlaTier,
      status: 'Active',
    };

    const newCustomer: Customer = {
      customer_id: newCustomerId,
      company_name: companyName,
      contact_name: contactName,
      primary_email: primaryEmail,
      phone_number: phoneNumber,
      facility_address: facilityAddress,
      distance_km: distanceKm,
      priority_tier: priorityTier,
      customer_since: new Date().toISOString().split('T')[0],
      notes: notes,
      assets: [newAsset],
      total_spend_cad: 0,
    };

    onAddCustomer(newCustomer);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900">Add New Client &amp; Equipment</h3>
              <p className="text-xs text-slate-500">Register facility and installed UPS hardware</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          
          <div className="text-xs font-mono uppercase text-slate-500 font-bold pb-1 border-b border-slate-100">
            1. Client &amp; Facility Details
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Company Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Toronto Health Centre"
                className="w-full bg-white border border-slate-200 text-slate-900 text-xs p-2.5 rounded-lg focus:outline-none focus:border-slate-800 shadow-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g. Mark Davis"
                className="w-full bg-white border border-slate-200 text-slate-900 text-xs p-2.5 rounded-lg focus:outline-none focus:border-slate-800 shadow-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={primaryEmail}
                onChange={(e) => setPrimaryEmail(e.target.value)}
                placeholder="e.g. client@hospital.ca"
                className="w-full bg-white border border-slate-200 text-slate-900 text-xs p-2.5 rounded-lg focus:outline-none focus:border-slate-800 shadow-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. +1 (416) 555-0192"
                className="w-full bg-white border border-slate-200 text-slate-900 text-xs p-2.5 rounded-lg focus:outline-none focus:border-slate-800 shadow-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Facility Address
              </label>
              <input
                type="text"
                value={facilityAddress}
                onChange={(e) => setFacilityAddress(e.target.value)}
                placeholder="e.g. 200 Elizabeth St, Toronto, ON"
                className="w-full bg-white border border-slate-200 text-slate-900 text-xs p-2.5 rounded-lg focus:outline-none focus:border-slate-800 shadow-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Distance (km)
              </label>
              <input
                type="number"
                value={distanceKm}
                onChange={(e) => setDistanceKm(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 text-slate-900 text-xs p-2.5 rounded-lg focus:outline-none focus:border-slate-800 font-mono shadow-sm"
              />
            </div>
          </div>

          <div className="text-xs font-mono uppercase text-slate-500 font-bold pt-2 pb-1 border-b border-slate-100">
            2. Installed Equipment &amp; Batteries
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Installed UPS Model
              </label>
              <select
                value={upsModel}
                onChange={(e) => setUpsModel(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-900 text-xs p-2.5 rounded-lg focus:outline-none focus:border-slate-800 shadow-sm"
              >
                <option value="Eaton 93PM 50kVA Modular UPS (3-Phase 208/120V)">Eaton 93PM 50kVA Modular UPS</option>
                <option value="Schneider Galaxy 5000 80kVA Industrial UPS">Schneider Galaxy 5000 80kVA Industrial UPS</option>
                <option value="APC Symmetra PX 30kVA Scalable N+1 UPS">APC Symmetra PX 30kVA Scalable N+1 UPS</option>
                <option value="Vertiv Liebert EXM 40kVA High-Efficiency UPS">Vertiv Liebert EXM 40kVA UPS</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Serial Number
              </label>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="e.g. ETN-93PM-50K-2024-9941"
                className="w-full bg-white border border-slate-200 text-slate-900 text-xs p-2.5 rounded-lg focus:outline-none focus:border-slate-800 font-mono shadow-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Battery Type
              </label>
              <input
                type="text"
                value={batteryType}
                onChange={(e) => setBatteryType(e.target.value)}
                placeholder="12V 100Ah VRLA"
                className="w-full bg-white border border-slate-200 text-slate-900 text-xs p-2.5 rounded-lg focus:outline-none focus:border-slate-800 shadow-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Battery Qty
              </label>
              <input
                type="number"
                value={batteryQuantity}
                onChange={(e) => setBatteryQuantity(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 text-slate-900 text-xs p-2.5 rounded-lg focus:outline-none focus:border-slate-800 font-mono shadow-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Install Date
              </label>
              <input
                type="date"
                value={installationDate}
                onChange={(e) => setInstallationDate(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-900 text-xs p-2.5 rounded-lg focus:outline-none focus:border-slate-800 font-mono shadow-sm"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-ghost text-xs">
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs font-bold py-2 px-4 flex items-center gap-1.5 shadow-sm">
              <Plus className="w-3.5 h-3.5" /> Save Client
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
