import { INITIAL_CUSTOMERS, INITIAL_EMAIL_LOGS } from './mockData';
import type { Workspace, RateItem, PriceBook } from '../types/operations';
import { today } from './costing';

const at = new Date().toISOString();
const rate = (id: string, description: string, supplier: string, unit: string, supplierCost: number, multiplier: number, manualCost: number, margin: number, sourceRow: number, costMode: 'manual' | 'multiplier' = 'manual'): RateItem => ({ id, description, supplier, unit, supplierCost, multiplier, manualCost, margin, sourceRow, costMode, exchangeRate: 1 });
export const workbookRates: RateItem[] = [
  rate('overtime', 'Supplier service · overtime', 'UPS & Batteries', 'hour', 0, .33, 40, .45, 11),
  rate('travel', 'Travel · regular', 'DCX', 'hour', 100, .38, 90, .45, 12),
  rate('service', 'Service · regular', 'DCX', 'hour', 100, .38, 90, .45, 13),
  rate('mileage', 'Mileage', 'DCX', 'km', .66, .82, .5412, .18, 14, 'multiplier'),
  rate('battery', 'Batteries', 'Supplier', 'unit', 0, 1, 400, .23, 15),
  rate('parking', 'Parking', 'DCX', 'visit', 22, 1, 30, .2, 16),
  rate('toll', 'Highway 407 ETR', 'DCX', 'trip', 100, 1, 100, .2, 17, 'multiplier'),
  rate('meals', 'Meals', 'DCX', 'day', 75, 1, 50, .2, 18),
];
export function initialWorkspace(): Workspace {
  const books: PriceBook[] = ['Standard', 'BGIS'].map(name => ({ id: name.toLowerCase(), name, version: 1, status: 'Draft', effectiveFrom: today(), effectiveTo: '', updatedAt: at,
    description: name === 'BGIS' ? 'Partner agreement · enter and publish the agreed BGIS rates.' : 'Direct customers · workbook starting values, ready for your review.',
    items: structuredClone(workbookRates) }));
  return { version: 1, books, bookHistory: [], quotes: [], draft: null,
    customers: [{ id: 'bgis', name: 'BGIS', contact: 'Facilities team', email: 'facilities@example.com', site: 'Select the end-customer site', bookId: 'bgis', equipment: 'Multiple client sites', notes: 'Example partner record. Confirm the contracting entity and site before quoting.' },
      ...INITIAL_CUSTOMERS.map(c => ({ id: c.customer_id, name: c.company_name.replace(' (Data Centre Alpha)', ''), contact: c.contact_name, email: c.primary_email, site: c.facility_address, bookId: 'standard', equipment: c.assets?.[0]?.ups_model || 'Equipment to confirm', notes: c.notes || '' }))],
    emails: INITIAL_EMAIL_LOGS.map((m, i) => ({ id: m.id, threadId: m.thread_id, clientId: m.customer_id || '', from: m.sender_name, email: m.sender_email, subject: m.subject, body: m.body, draft: i === 0 ? 'Hello,\n\nThank you for reporting the alarm. Please share a photo of the display, the equipment model, your site contact number and whether operations are affected. I will arrange a technical review of the reported issue.\n\nRegards,\nRaza' : i === 1 ? 'Hello,\n\nThank you for your battery replacement request. We will review the equipment details, access requirements and current pricing before preparing a quotation. Please confirm the site address and your preferred service window.\n\nRegards,\nRaza' : 'Hello,\n\nThank you for your request. We will review the requirements and supporting information and follow up with any questions.\n\nRegards,\nRaza',
      date: m.received_at, category: m.category.includes('Tender') ? 'Tender' : m.category.includes('Pricing') ? 'Quotation' : m.category.includes('Technical') ? 'Service' : 'General',
      status: 'Needs review', urgent: m.urgency === 'Emergency Critical' || m.urgency === 'High', attachments: m.attachments?.map(a => a.name) || [] })),
    tenders: [{ id: 'metrolinx', title: 'UPS preventive maintenance', organization: 'Metrolinx', reference: 'PT-2025-LCLO-162', deadline: '', status: 'In review',
      notes: 'Historical package for workflow review. Verify the governing addenda and deadline before preparing a live submission.',
      tasks: [
        { id: 'versions', label: 'Confirm the current document set', complete: false, note: 'Addendum 2 references replacement scope, asset lists and Appendix K.' },
        { id: 'prices', label: 'Review the revised pricing schedule', complete: false, note: 'Addendum 5 workbook. Confirm quantities, contract years and optional items.' },
        { id: 'forms', label: 'Complete bidder and personnel forms', complete: false, note: 'Use approved company information and reference projects.' },
        { id: 'wsib', label: 'Verify WSIB and supporting evidence', complete: false, note: 'Check document validity and the required evidence.' },
        { id: 'approval', label: 'Approve pricing and declarations', complete: false, note: 'Final human review before submission.' }],
      documents: [{ name: 'Contract Prices · Addendum 5.xlsx', status: 'Review revision' }, { name: 'Tender Document Forms DCX.docx', status: 'Needs completion' }, { name: 'Roger Marok Work Experience.docx', status: 'Verify details' }, { name: 'WSIB 2026 statement.pdf', status: 'Verify validity' }]
    }], activity: [{ id: 'welcome', text: 'Workspace prepared. Review the workbook rates to get started.', at }] };
}
export const STORAGE_KEY = 'dcx-workspace-v1';
export function loadWorkspace(): { data: Workspace; error: string } {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return { data: initialWorkspace(), error: '' };
    const data = JSON.parse(raw); if (data.version !== 1 || !Array.isArray(data.books) || !data.books.length || !Array.isArray(data.customers) || !Array.isArray(data.emails) || !Array.isArray(data.quotes) || !Array.isArray(data.tenders) || !Array.isArray(data.activity) || !Array.isArray(data.bookHistory)) throw new Error();
    return { data, error: '' };
  } catch { return { data: initialWorkspace(), error: 'Saved workspace could not be read. Your stored copy has not been replaced. Export or recover it before continuing.' }; }
}
export function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
