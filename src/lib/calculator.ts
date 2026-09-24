import { PricingConfig, QuoteItem } from '../types/crm';

export function calculateBatteryAgeYears(installDateStr: string): number {
  const installDate = new Date(installDateStr);
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - installDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Number((diffDays / 365.25).toFixed(1));
}

export function isBatteryOverdue(installDateStr: string): boolean {
  return calculateBatteryAgeYears(installDateStr) >= 3.0;
}

export interface QuoteCalculationInput {
  items: Array<{
    item: { id: string; name: string; category: any; standard_rate: number; description?: string };
    quantity: number;
  }>;
  technicianCount: number;
  laborHours: number;
  travelDistanceKm: number;
  selectedMaintenancePlan: 'None' | '1-Year Standard' | '3-Year Silver' | '5-Year Gold';
  pricingConfig: PricingConfig;
}

export function calculateQuotationSummary(input: QuoteCalculationInput) {
  const { items, technicianCount, laborHours, travelDistanceKm, selectedMaintenancePlan, pricingConfig } = input;

  // 1. Hardware & Components Subtotal
  let hardwareSubtotal = 0;
  const quoteItems: QuoteItem[] = items.map((line, idx) => {
    const lineTotal = line.item.standard_rate * line.quantity;
    hardwareSubtotal += lineTotal;
    return {
      id: `item-${idx + 1}`,
      name: line.item.name,
      description: line.item.description || `${line.quantity}x unit(s)`,
      category: line.item.category as any,
      unit_price: line.item.standard_rate,
      quantity: line.quantity,
      total_price: lineTotal,
    };
  });

  // 2. Field Labor Subtotal
  const laborSubtotal = technicianCount * laborHours * pricingConfig.technician_labor_rate_per_hour;

  // 3. Travel & Logistics Subtotal (Round-trip)
  const roundTripKm = travelDistanceKm * 2;
  const travelSubtotal = roundTripKm * pricingConfig.fuel_rate_per_km;

  // 4. Base Callout Fee
  const calloutFee = pricingConfig.base_callout_fee;

  // 5. Maintenance SLA Subtotal
  let maintenancePlanCad = 0;
  let maintenancePlanName = 'No Extended Plan';

  if (selectedMaintenancePlan === '1-Year Standard') {
    maintenancePlanCad = 1400 * pricingConfig.maintenance_1yr_multiplier;
    maintenancePlanName = '1-Year Standard Preventative Care';
  } else if (selectedMaintenancePlan === '3-Year Silver') {
    maintenancePlanCad = 3800 * pricingConfig.maintenance_3yr_multiplier;
    maintenancePlanName = '3-Year Comprehensive Silver Care (2x Annual)';
  } else if (selectedMaintenancePlan === '5-Year Gold') {
    maintenancePlanCad = 5900 * pricingConfig.maintenance_5yr_multiplier;
    maintenancePlanName = '5-Year Enterprise Gold Care (24/7 SLA + Parts)';
  }

  // 6. Subtotal, 13% Ontario HST, and Grand Total
  const subtotalCad = hardwareSubtotal + laborSubtotal + travelSubtotal + calloutFee + maintenancePlanCad;
  const taxCad = Number((subtotalCad * 0.13).toFixed(2));
  const totalAmountCad = Number((subtotalCad + taxCad).toFixed(2));

  return {
    quoteItems,
    hardwareSubtotal,
    laborHours: technicianCount * laborHours,
    laborRatePerHour: pricingConfig.technician_labor_rate_per_hour,
    laborSubtotal,
    travelDistanceKm: roundTripKm,
    fuelRatePerKm: pricingConfig.fuel_rate_per_km,
    travelSubtotal,
    calloutFee,
    maintenancePlanName,
    maintenancePlanCad,
    subtotalCad,
    taxCad,
    totalAmountCad,
  };
}

export function formatCurrencyCAD(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
  }).format(amount);
}

