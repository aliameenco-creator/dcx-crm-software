import type { CostInput, CostLine, PriceBook, QuoteDraft } from '../types/operations';

export const FORMULA_VERSION = 'job-cost-v1';
export const money = (v: number, currency = 'CAD') => new Intl.NumberFormat('en-CA', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v);
export const roundMoney = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
export function calculateCost(input: CostInput) {
  const errors: string[] = [];
  const nonnegative = (value: number, label: string) => { if (!Number.isFinite(value) || value < 0 || value > 1e12) errors.push(`${label} must be a valid non-negative number.`); };
  const lines = input.lines.map((line, i) => {
    const label = line.description || `Line ${i + 1}`;
    nonnegative(line.supplierCost, `${label}: supplier cost`);
    nonnegative(line.multiplier, `${label}: multiplier`);
    nonnegative(line.manualCost, `${label}: my cost`);
    nonnegative(line.quantity, `${label}: quantity`);
    if (!Number.isFinite(line.exchangeRate) || line.exchangeRate <= 0) errors.push(`${label}: exchange divisor must be greater than zero.`);
    if (!Number.isFinite(line.margin) || line.margin < 0 || line.margin >= 1) errors.push(`${label}: margin must be between 0% and less than 100%.`);
    // Workbook F: preserve manual overrides; only formula-driven F cells use D * E.
    const unitCost = line.costMode === 'manual' ? line.manualCost : line.supplierCost * line.multiplier;
    const extendedCost = unitCost * line.quantity; // H = F * G
    const cadCost = extendedCost / line.exchangeRate; // J = H / I
    const sell = cadCost / (1 - line.margin); // M = J / (1 - K)
    return { ...line, unitCost, extendedCost, cadCost, sell, profit: sell - cadCost };
  });
  for (const flat of input.flatLines) { nonnegative(flat.amount, 'Flat amount'); nonnegative(flat.addition, 'Flat addition'); }
  nonnegative(input.shipping, 'Shipping'); nonnegative(input.brokerage, 'Brokerage'); nonnegative(input.usdRate, 'USD conversion rate');
  if (!Number.isFinite(input.taxPercent) || input.taxPercent < 0 || input.taxPercent > 100) errors.push('Tax must be between 0% and 100%.');
  const flatSelling = input.flatLines.reduce((sum, f) => sum + f.amount + f.addition, 0); // M22/23 = D + F; quantity unused in original.
  const totalCost = lines.reduce((sum, line) => sum + line.cadCost, 0) + input.shipping + input.brokerage; // E29
  const sellingPrice = lines.reduce((sum, line) => sum + line.sell, 0) + flatSelling; // E31
  const profit = sellingPrice - totalCost; // E33
  const grossMargin = sellingPrice > 0 ? profit / sellingPrice : null; // L33, guard empty estimate.
  const tax = roundMoney(sellingPrice * input.taxPercent / 100); // Explicit dashboard extension, not in workbook.
  const cadTotal = roundMoney(sellingPrice + tax);
  const usdSellingPrice = sellingPrice * input.usdRate; // L35 = E31 * F35
  if (![totalCost, sellingPrice, profit, cadTotal, usdSellingPrice].every(Number.isFinite)) errors.push('The estimate cannot be calculated until all inputs are valid.');
  return { lines, totalCost, sellingPrice, flatSelling, profit, grossMargin, tax, cadTotal, usdSellingPrice, errors, valid: errors.length === 0 };
}
export const today = () => new Date().toISOString().slice(0, 10);
export function bookUsable(book: PriceBook, date = today()) {
  return book.status === 'Published' && !!book.effectiveFrom && book.effectiveFrom <= date && (!book.effectiveTo || book.effectiveTo >= date);
}
export function lineFromRate(rate: PriceBook['items'][number], quantity = 0): CostLine {
  return { ...rate, id: crypto.randomUUID(), rateItemId: rate.id, quantity };
}
export function newDraft(book: PriceBook, customerId = '', site = ''): QuoteDraft {
  return { customerId, site, title: 'UPS maintenance and battery services', bookId: book.id, bookVersion: book.version,
    lines: book.items.map(r => lineFromRate(r)), flatLines: [], shipping: 0, brokerage: 0, usdRate: 0,
    taxPercent: 0, notes: '', validityDays: 30, currency: 'CAD' };
}
