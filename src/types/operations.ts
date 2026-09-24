export type BookId = string;
export type CostMode = 'manual' | 'multiplier';
export interface RateItem {
  id: string; supplier: string; description: string; unit: string;
  supplierCost: number; multiplier: number; manualCost: number; costMode: CostMode;
  exchangeRate: number; margin: number; sourceRow?: number;
}
export interface PriceBook {
  id: BookId; name: string; description: string; version: number;
  status: 'Draft' | 'Published'; effectiveFrom: string; effectiveTo: string;
  items: RateItem[]; updatedAt: string;
}
export interface CostLine extends RateItem { quantity: number; rateItemId: string; }
export interface FlatLine { id: string; description: string; amount: number; addition: number; }
export interface CostInput {
  lines: CostLine[]; flatLines: FlatLine[]; shipping: number; brokerage: number;
  usdRate: number; taxPercent: number;
}
export interface QuoteDraft extends CostInput {
  customerSnapshot?: Client;
  revises?: string;
  customerId: string; site: string; title: string; bookId: string;
  bookVersion: number; notes: string; validityDays: number; currency: 'CAD' | 'USD';
}
export interface SavedQuote extends QuoteDraft {
  id: string; number: string; revision: number; status: 'Draft' | 'Pending review' | 'Approved';
  createdAt: string; totalCost: number; sellingPrice: number; profit: number;
  approvedAt?: string; formulaVersion: string;
}
export interface Client {
  phone?: string; billingAddress?: string;
  id: string; name: string; contact: string; email: string; site: string;
  bookId: string; equipment: string; notes: string;
}
export interface Mail {
  isRead?: boolean; sentAt?: string; aiSummary?: { text: string; generatedAt: string; sourceIds: string[] };
  id: string; threadId: string; clientId: string; from: string; email: string;
  subject: string; body: string; draft: string; date: string;
  category: 'Service' | 'Quotation' | 'Tender' | 'General';
  status: 'Needs review' | 'Draft saved' | 'Approved' | 'Archived';
  urgent: boolean; attachments: string[]; direction?: 'incoming' | 'outgoing';
}
export interface TenderTask { id: string; label: string; complete: boolean; note: string; }
export interface Tender {
  id: string; title: string; organization: string; reference: string; deadline: string;
  status: 'In review' | 'Preparing' | 'Ready for review'; notes: string;
  tasks: TenderTask[]; documents: { name: string; status: string }[];
}
export interface Activity { id: string; text: string; at: string; }
export interface Workspace {
  version: 1; books: PriceBook[]; bookHistory: PriceBook[];
  quotes: SavedQuote[]; customers: Client[]; emails: Mail[];
  tenders: Tender[]; activity: Activity[]; draft: QuoteDraft | null;
}
