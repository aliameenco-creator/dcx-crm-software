export type PriorityTier = 'VIP (Tier 1)' | 'Commercial' | 'Standard' | 'New Prospect';

export type EmailCategory = 
  | 'Technical Support / Bug'
  | 'Equipment Upgrade & Pricing'
  | 'Tender / RFQ with Docs'
  | 'New Lead Inquiry'
  | 'Internal Team'
  | 'Calendar & Scheduling'
  | 'Spam / Filtered';

export type EmailStatus = 
  | 'Pending Review'
  | 'Auto-Replied (FAQ)'
  | 'Approved & Sent'
  | 'Manually Replied'
  | 'Archived'
  | 'Archived / Ignored';

export type QuoteStatus = 
  | 'Drafted'
  | 'Pending Approval'
  | 'Sent to Client'
  | 'Accepted / Won'
  | 'Rejected'
  | 'Follow-up Due'
  | 'Expired';

export interface Customer {
  customer_id: string;
  company_name: string;
  contact_name: string;
  primary_email: string;
  phone_number: string;
  facility_address: string;
  distance_km: number;
  priority_tier: PriorityTier;
  customer_since: string;
  notes?: string;
  assets?: CustomerAsset[];
  total_spend_cad?: number;
}

export interface CustomerAsset {
  asset_id: string;
  customer_id: string;
  ups_model: string;
  serial_number: string;
  battery_type: string;
  battery_quantity: number;
  installation_date: string;
  warranty_end_date: string;
  battery_replacement_due: string;
  battery_age_years: number;
  is_battery_overdue: boolean;
  active_sla_tier: string;
  status: 'Active' | 'Under Maintenance' | 'Decommissioned';
  last_service_date?: string;
}

export interface ProductCatalogItem {
  id: string;
  name: string;
  category: 'UPS System' | 'Battery String' | 'Bypass Panel' | 'Accessory';
  brand: string;
  wholesale_cost: number;
  standard_rate: number;
  warranty_years: number;
  spec_summary: string;
}

export interface PricingConfig {
  technician_labor_rate_per_hour: number;
  emergency_labor_rate_per_hour: number;
  fuel_rate_per_km: number;
  base_callout_fee: number;
  maintenance_1yr_multiplier: number;
  maintenance_3yr_multiplier: number;
  maintenance_5yr_multiplier: number;
  catalog: ProductCatalogItem[];
}

export interface QuoteItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Quotation {
  quote_id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  facility_address: string;
  scope_summary: string;
  items: QuoteItem[];
  hardware_subtotal: number;
  labor_hours: number;
  labor_rate_per_hour: number;
  labor_subtotal: number;
  travel_distance_km: number;
  fuel_rate_per_km: number;
  travel_subtotal: number;
  callout_fee: number;
  maintenance_plan_name: string;
  maintenance_plan_cad: number;
  subtotal_cad: number;
  tax_cad: number;
  total_amount_cad: number;
  status: QuoteStatus;
  created_at: string;
  valid_until: string;
  follow_up_count: number;
  notes?: string;
}

export interface EmailLog {
  id: string;
  thread_id: string;
  customer_id?: string;
  customer_name?: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  body: string;
  category: EmailCategory;
  urgency: 'Low' | 'Medium' | 'High' | 'Emergency Critical';
  status: EmailStatus;
  ai_reasoning?: string;
  ai_draft_reply?: string;
  approved_by?: string;
  approval_timestamp?: string;
  final_sent_email?: string;
  received_at: string;
  cited_manuals?: string[];
  attachments?: {
    name: string;
    size_mb: number;
    url: string;
  }[];
}

export interface TenderRecord {
  id: string;
  title: string;
  organization: string;
  submission_deadline: string;
  kVA_requirement: string;
  battery_autonomy_mins: number;
  compliance_tags: string[];
  estimated_value_cad: number;
  status: 'In Review' | 'Drafting Proposal' | 'Submitted' | 'Won' | 'Archived';
  onedrive_document_url: string;
  summary_notes: string;
}

export interface ExecutiveStats {
  inbound_emails_today: number;
  auto_handled_percent: number;
  pending_review: number;
  quotes_sent_month: number;
  quoted_revenue_month_cad: number;
  won_revenue_month_cad: number;
  conversion_rate_percent: number;
  batteries_overdue_count: number;
  active_tenders_count: number;
}
