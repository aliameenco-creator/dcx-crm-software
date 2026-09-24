import { Customer, PricingConfig, Quotation, EmailLog, TenderRecord, ExecutiveStats } from '../types/crm';

export const INITIAL_PRICING_CONFIG: PricingConfig = {
  technician_labor_rate_per_hour: 150.00,
  emergency_labor_rate_per_hour: 225.00,
  fuel_rate_per_km: 0.65,
  base_callout_fee: 250.00,
  maintenance_1yr_multiplier: 1.00,
  maintenance_3yr_multiplier: 1.00,
  maintenance_5yr_multiplier: 1.00,
  catalog: [
    {
      id: 'bat-100ah',
      name: '12V 100Ah High-Rate VRLA Battery',
      category: 'Battery String',
      brand: 'Enersys PowerSafe',
      wholesale_cost: 165.00,
      standard_rate: 240.00,
      warranty_years: 2,
      spec_summary: 'Flame-retardant casing, 10-year design life, high-rate data center grade.'
    },
    {
      id: 'bat-150ah',
      name: '12V 150Ah Heavy-Duty VRLA Battery',
      category: 'Battery String',
      brand: 'CSB Battery',
      wholesale_cost: 210.00,
      standard_rate: 310.00,
      warranty_years: 2,
      spec_summary: 'High energy density for extended autonomy runtime.'
    },
    {
      id: 'bat-200ah',
      name: '12V 200Ah Long-Life Front-Terminal Battery',
      category: 'Battery String',
      brand: 'NorthStar / Enersys',
      wholesale_cost: 290.00,
      standard_rate: 420.00,
      warranty_years: 3,
      spec_summary: 'Front terminal design for fast rack servicing; substation grade.'
    },
    {
      id: 'ups-eaton-50k',
      name: 'Eaton 93PM 50kVA Modular UPS Unit',
      category: 'UPS System',
      brand: 'Eaton',
      wholesale_cost: 12400.00,
      standard_rate: 18450.00,
      warranty_years: 2,
      spec_summary: '3-Phase 208/120V, 97% efficiency, scalable modular slots.'
    },
    {
      id: 'ups-schneider-80k',
      name: 'Schneider Galaxy 5000 80kVA Industrial UPS',
      category: 'UPS System',
      brand: 'Schneider Electric',
      wholesale_cost: 19800.00,
      standard_rate: 28900.00,
      warranty_years: 2,
      spec_summary: 'Industrial dual mains input, harmonic filter, CSA certified.'
    },
    {
      id: 'acc-bypass-panel',
      name: 'Integrated External Maintenance Bypass Panel',
      category: 'Bypass Panel',
      brand: 'UPS Canada Systems',
      wholesale_cost: 1450.00,
      standard_rate: 2200.00,
      warranty_years: 5,
      spec_summary: '3-breaker interlocked manual bypass panel.'
    }
  ]
};

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    customer_id: 'CUST-1042',
    company_name: 'Toronto General Hospital (Data Centre Alpha)',
    contact_name: 'Mark Davis (Facilities Director)',
    primary_email: 'mark.davis@torontohospital.ca',
    phone_number: '+1 (416) 555-0192',
    facility_address: '200 Elizabeth St, Toronto, ON M5G 2C4',
    distance_km: 28.5,
    priority_tier: 'VIP (Tier 1)',
    customer_since: '2023-05-10',
    total_spend_cad: 44780.00,
    notes: 'Critical ICU & imaging data centre power. 24/7 priority SLA tier active.',
    assets: [
      {
        asset_id: 'ASSET-904',
        customer_id: 'CUST-1042',
        ups_model: 'Eaton 93PM 50kVA Modular UPS (3-Phase 208/120V)',
        serial_number: 'ETN-93PM-50K-2023-0941',
        battery_type: '12V 100Ah High-Rate VRLA Battery',
        battery_quantity: 32,
        installation_date: '2023-05-15',
        warranty_end_date: '2025-05-15',
        battery_replacement_due: '2026-05-15',
        battery_age_years: 3.3,
        is_battery_overdue: true,
        active_sla_tier: '3-Year Silver Care',
        status: 'Active',
        last_service_date: '2025-11-20'
      }
    ]
  },
  {
    customer_id: 'CUST-1088',
    company_name: 'Hydro One Transmission Substation 14',
    contact_name: 'Sarah Jenkins (Grid Operations Manager)',
    primary_email: 'sarah.jenkins@hydroone.ca',
    phone_number: '+1 (905) 555-4811',
    facility_address: '4830 Derry Rd W, Mississauga, ON L5N 7L9',
    distance_km: 34.0,
    priority_tier: 'VIP (Tier 1)',
    customer_since: '2022-11-01',
    total_spend_cad: 86400.00,
    notes: 'Substation SCADA & breaker trip power bank. Zero tolerance for voltage drop.',
    assets: [
      {
        asset_id: 'ASSET-712',
        customer_id: 'CUST-1088',
        ups_model: 'Schneider Galaxy 5000 80kVA Industrial UPS',
        serial_number: 'SCH-GLX50-80K-2022-4112',
        battery_type: '12V 200Ah Long-Life Front-Terminal Battery',
        battery_quantity: 40,
        installation_date: '2022-11-15',
        warranty_end_date: '2025-11-15',
        battery_replacement_due: '2025-11-15',
        battery_age_years: 3.8,
        is_battery_overdue: true,
        active_sla_tier: '5-Year Gold 24/7 Care',
        status: 'Active',
        last_service_date: '2026-02-10'
      }
    ]
  },
  {
    customer_id: 'CUST-2015',
    company_name: 'Markham Cloud Tier-3 Colocation Centre',
    contact_name: 'David Chen (Chief Infrastructure Officer)',
    primary_email: 'dchen@markhamcloud.com',
    phone_number: '+1 (289) 555-8930',
    facility_address: '100 Enterprise Blvd, Markham, ON L6G 0A1',
    distance_km: 22.0,
    priority_tier: 'Commercial',
    customer_since: '2024-08-14',
    total_spend_cad: 32900.00,
    notes: 'Modular N+1 scalable deployment.',
    assets: [
      {
        asset_id: 'ASSET-419',
        customer_id: 'CUST-2015',
        ups_model: 'APC Symmetra PX 30kVA Scalable N+1 UPS',
        serial_number: 'APC-SYMX-30K-2024-0019',
        battery_type: '12V 100Ah High-Rate VRLA Battery',
        battery_quantity: 24,
        installation_date: '2024-08-20',
        warranty_end_date: '2026-08-20',
        battery_replacement_due: '2027-08-20',
        battery_age_years: 2.0,
        is_battery_overdue: false,
        active_sla_tier: '3-Year Silver Care',
        status: 'Active',
        last_service_date: '2025-08-15'
      }
    ]
  },
  {
    customer_id: 'CUST-2099',
    company_name: 'St. Michael’s Health Centre',
    contact_name: 'Dr. Evelyn Adams (Surgical Tech Director)',
    primary_email: 'evelyn.adams@stmichael.ca',
    phone_number: '+1 (416) 555-9014',
    facility_address: '30 Bond St, Toronto, ON M5B 1W8',
    distance_km: 29.0,
    priority_tier: 'Commercial',
    customer_since: '2023-01-10',
    total_spend_cad: 21500.00,
    notes: 'Operating Theatre Isolated Power Panels.',
    assets: [
      {
        asset_id: 'ASSET-311',
        customer_id: 'CUST-2099',
        ups_model: 'Vertiv Liebert EXM 40kVA High-Efficiency UPS',
        serial_number: 'VRT-EXM-40K-2023-8812',
        battery_type: '12V 100Ah High-Rate VRLA Battery',
        battery_quantity: 32,
        installation_date: '2023-01-20',
        warranty_end_date: '2025-01-20',
        battery_replacement_due: '2026-01-20',
        battery_age_years: 3.6,
        is_battery_overdue: true,
        active_sla_tier: '1-Year Standard',
        status: 'Active',
        last_service_date: '2025-06-11'
      }
    ]
  }
];

export const INITIAL_QUOTATIONS: Quotation[] = [
  {
    quote_id: 'Q-2026-0841',
    customer_id: 'CUST-1042',
    customer_name: 'Toronto General Hospital (Data Centre Alpha)',
    customer_email: 'mark.davis@torontohospital.ca',
    facility_address: '200 Elizabeth St, Toronto, ON M5G 2C4',
    scope_summary: '32x 12V 100Ah VRLA Battery Replacement & Preventative Commissioning',
    items: [
      {
        id: 'bat-100ah',
        name: '12V 100Ah High-Rate VRLA Battery',
        description: 'Enersys PowerSafe High-Rate (2-Year Manufacturer Warranty)',
        quantity: 32,
        unit_price: 240.00,
        total_price: 7680.00
      }
    ],
    hardware_subtotal: 7680.00,
    labor_hours: 12,
    labor_rate_per_hour: 150.00,
    labor_subtotal: 1800.00,
    travel_distance_km: 57.0,
    fuel_rate_per_km: 0.65,
    travel_subtotal: 37.05,
    callout_fee: 250.00,
    maintenance_plan_name: '3-Year Silver Preventative Care Plan',
    maintenance_plan_cad: 3800.00,
    subtotal_cad: 13567.05,
    tax_cad: 1763.72,
    total_amount_cad: 15330.77,
    status: 'Pending Approval',
    created_at: '2026-09-02T10:30:00Z',
    valid_until: '2026-10-02T23:59:59Z',
    follow_up_count: 0,
    notes: 'Generated via quotation calculator.'
  },
  {
    quote_id: 'Q-2026-0792',
    customer_id: 'CUST-1088',
    customer_name: 'Hydro One Transmission Substation 14',
    customer_email: 'sarah.jenkins@hydroone.ca',
    facility_address: '4830 Derry Rd W, Mississauga, ON L5N 7L9',
    scope_summary: '40x 12V 200Ah Long-Life Front-Terminal Battery Bank Replacement',
    items: [
      {
        id: 'bat-200ah',
        name: '12V 200Ah Long-Life Front-Terminal Battery',
        description: 'NorthStar / Enersys High-Rate Substation Grade (3-Year Warranty)',
        quantity: 40,
        unit_price: 420.00,
        total_price: 16800.00
      }
    ],
    hardware_subtotal: 16800.00,
    labor_hours: 16,
    labor_rate_per_hour: 150.00,
    labor_subtotal: 2400.00,
    travel_distance_km: 68.0,
    fuel_rate_per_km: 0.65,
    travel_subtotal: 44.20,
    callout_fee: 250.00,
    maintenance_plan_name: '5-Year Gold 24/7 Emergency Care Plan',
    maintenance_plan_cad: 5900.00,
    subtotal_cad: 25394.20,
    tax_cad: 3301.25,
    total_amount_cad: 28695.45,
    status: 'Sent to Client',
    created_at: '2026-08-28T14:15:00Z',
    valid_until: '2026-09-28T23:59:59Z',
    follow_up_count: 1,
    notes: 'Quote sent via Outlook.'
  }
];

export const INITIAL_EMAIL_LOGS: EmailLog[] = [
  {
    id: 'LOG-7801',
    thread_id: 'TH-99410',
    customer_id: 'CUST-1042',
    customer_name: 'Toronto General Hospital',
    sender_name: 'Mark Davis',
    sender_email: 'mark.davis@torontohospital.ca',
    subject: 'URGENT: Eaton 50kVA UPS Beeping - Alarm Code #104',
    body: `Hello,\n\nOur main ICU Eaton 50kVA unit started beeping 20 minutes ago. The screen is displaying Alarm Code 104 and a yellow triangle. Is this dangerous, and what should our facility team do immediately?`,
    category: 'Technical Support / Bug',
    urgency: 'High',
    status: 'Approved & Sent',
    ai_reasoning: 'Customer matched with installed Eaton 93PM 50kVA. Searched manual: Alarm 104 = Inverter Air Intake Filter Blockage / Temp Warning. Drafted safety instructions.',
    ai_draft_reply: `Hi Mark,\n\nThanks for reaching out. Based on your Eaton 93PM 50kVA unit, Alarm Code 104 indicates an Inverter Air Intake Filter Temperature Warning caused by restricted airflow.\n\nImmediate Actions:\n1. Verify front airflow grilles are unobstructed by boxes or cabling.\n2. Verify ambient room cooling is between 20°C–25°C.\n\nSafe Operating Status: Your critical ICU load remains fully protected. If the alarm persists over 30 minutes, we can dispatch a technician.\n\nBest regards,\nTechnical Operations\nUPS & Battery Systems Canada`,
    approved_by: 'Operations Lead',
    approval_timestamp: '2026-09-02T15:15:30Z',
    final_sent_email: `Hi Mark,\n\nThanks for reaching out. Based on your Eaton 93PM 50kVA unit, Alarm Code 104 indicates an Inverter Air Intake Filter Temperature Warning caused by restricted airflow.\n\nImmediate Actions:\n1. Verify front airflow grilles are unobstructed by boxes or cabling.\n2. Verify ambient room cooling is between 20°C–25°C.\n\nSafe Operating Status: Your critical ICU load remains fully protected. If the alarm persists over 30 minutes, we can dispatch a technician.\n\nBest regards,\nTechnical Operations\nUPS & Battery Systems Canada`,
    received_at: '2026-09-02T15:14:22Z',
    cited_manuals: ['Eaton_93PM_50kVA_User_Manual.pdf (Page 48, Section 6.2)']
  },
  {
    id: 'LOG-7802',
    thread_id: 'TH-99411',
    customer_id: 'CUST-1042',
    customer_name: 'Toronto General Hospital',
    sender_name: 'Mark Davis',
    sender_email: 'mark.davis@torontohospital.ca',
    subject: 'Quote for 32x VRLA Battery String Replacement',
    body: `Hello,\n\nOur battery bank is past the 3-year mark. Could you provide a quote for replacing all 32 cells (12V 100Ah VRLA) with recycling and on-site testing?`,
    category: 'Equipment Upgrade & Pricing',
    urgency: 'Medium',
    status: 'Pending Review',
    ai_reasoning: 'Extracted 32x 12V 100Ah cells. Looked up facility distance (28.5 km one-way = 57 km RT). Applied standard formula: $7,680 hardware + $1,800 labor (12 hrs @ $150) + $37.05 fuel + $250 callout + $3,800 3-yr SLA + 13% HST = $15,330.77 CAD.',
    ai_draft_reply: `Hi Mark,\n\nHere is our quote for the proactive battery replacement on your Eaton 93PM 50kVA:\n\n• 32x Enersys 12V 100Ah High-Rate Batteries: $7,680.00 CAD\n• Certified Senior Technician Labor (12 hrs total): $1,800.00 CAD\n• Transport & Tooling Callout: $287.05 CAD\n• 3-Year Silver Preventative Care Plan: $3,800.00 CAD\n• Subtotal: $13,567.05 CAD | HST (13%): $1,763.72 CAD\n• Total Project Investment: $15,330.77 CAD\n\nPlease let us know if this works for your PO cycle.\n\nBest regards,\nTechnical Operations\nUPS & Battery Systems Canada`,
    received_at: '2026-09-02T14:40:10Z'
  },
  {
    id: 'LOG-7803',
    thread_id: 'TH-99412',
    sender_name: 'City of Markham Procurement',
    sender_email: 'bids@markham.ca',
    subject: 'RFP-2026-992: Emergency Substation 80kVA UPS System Supply & 5-Year Maintenance',
    body: `Attached is RFP-2026-992 regarding the municipal water pump substation backup power modernization project. Submissions close September 15, 2026 at 2:00 PM EST.`,
    category: 'Tender / RFQ with Docs',
    urgency: 'High',
    status: 'Pending Review',
    ai_reasoning: 'Multi-document RFQ received. Ingested 3 files into OneDrive. Extracted specs: 80kVA 3-Phase, 30-min autonomy, CSA C22.2 No 107.3 compliance, 5-Year maintenance.',
    ai_draft_reply: `To the City of Markham Procurement Committee,\n\nWe acknowledge receipt of RFP-2026-992. UPS & Battery Systems Canada is preparing our compliant technical bid and pricing schedule for submission prior to September 15.\n\nSincerely,\nTechnical Operations\nUPS & Battery Systems Canada`,
    received_at: '2026-09-02T13:33:05Z',
    attachments: [
      { name: 'RFP-2026-992_Specifications.pdf', size_mb: 8.2, url: '#' },
      { name: 'Pricing_Schedule_Appendix_B.xlsx', size_mb: 2.1, url: '#' },
      { name: 'Mandatory_CSA_Requirements.pdf', size_mb: 3.4, url: '#' }
    ]
  },
  {
    id: 'LOG-7804',
    thread_id: 'TH-99413',
    sender_name: 'Robert Vance',
    sender_email: 'robert@vancecoldstorage.ca',
    subject: 'Need UPS backup for our industrial refrigerated warehouse',
    body: `Hello,\n\nWe run a cold storage facility in Vaughan. We experienced two brief power flickers last month that tripped our ammonia compressors. Can you quote us for a battery backup system?`,
    category: 'New Lead Inquiry',
    urgency: 'Medium',
    status: 'Approved & Sent',
    ai_reasoning: 'New prospect. Missing key electrical parameters (kVA load, 3-phase voltage, autonomy duration). Created Lead record and drafted qualification questionnaire.',
    ai_draft_reply: `Hi Robert,\n\nThanks for reaching out to UPS & Battery Systems Canada. Industrial cold storage compressor loads require specific inrush current sizing to ensure reliable backup.\n\nTo prepare an accurate quote, could you share:\n1. Total connected compressor electrical load (kVA or Amps)?\n2. Facility voltage (e.g. 600V 3-Phase or 208V 3-Phase)?\n3. Desired battery runtime (e.g. 15 mins for generator start, or 60 mins)?\n\nLooking forward to assisting you.\n\nBest regards,\nTechnical Operations\nUPS & Battery Systems Canada`,
    approved_by: 'Operations Lead',
    approval_timestamp: '2026-09-01T20:50:00Z',
    final_sent_email: `Hi Robert,\n\nThanks for reaching out to UPS & Battery Systems Canada. Industrial cold storage compressor loads require specific inrush current sizing to ensure reliable backup.\n\nTo prepare an accurate quote, could you share:\n1. Total connected compressor electrical load (kVA or Amps)?\n2. Facility voltage (e.g. 600V 3-Phase or 208V 3-Phase)?\n3. Desired battery runtime (e.g. 15 mins for generator start, or 60 mins)?\n\nLooking forward to assisting you.\n\nBest regards,\nTechnical Operations\nUPS & Battery Systems Canada`,
    received_at: '2026-09-01T20:45:12Z'
  }
];

export const INITIAL_TENDERS: TenderRecord[] = [
  {
    id: 'RFP-2026-992',
    title: 'Municipal Water Pump Substation 80kVA UPS & 5-Yr Care',
    organization: 'City of Markham — Environmental Infrastructure',
    submission_deadline: '2026-09-15T14:00:00Z',
    kVA_requirement: '80kVA (3-Phase 600V Input / 208V Output)',
    battery_autonomy_mins: 30,
    compliance_tags: ['CSA C22.2 No 107.3', 'OESC Compliant', '5-Year On-Site 4hr SLA'],
    estimated_value_cad: 142000.00,
    status: 'In Review',
    onedrive_document_url: 'https://onedrive.live.com',
    summary_notes: '12-document RFQ ingested. Requires Schneider Galaxy 5000 80kVA specification with external bypass.'
  },
  {
    id: 'TND-2026-104',
    title: 'Hamilton Regional Health Backup Power Modernization',
    organization: 'Hamilton Health Sciences Authority',
    submission_deadline: '2026-09-22T17:00:00Z',
    kVA_requirement: '2x 50kVA N+1 Redundant Configuration',
    battery_autonomy_mins: 45,
    compliance_tags: ['Hospital Grade Isolation', 'CSA Compliant', 'Dual Input Feeds'],
    estimated_value_cad: 198500.00,
    status: 'Drafting Proposal',
    onedrive_document_url: 'https://onedrive.live.com',
    summary_notes: '2x Eaton 93PM 50kVA modular units in parallel synchronization.'
  }
];

export const INITIAL_STATS: ExecutiveStats = {
  inbound_emails_today: 18,
  auto_handled_percent: 88,
  pending_review: 2,
  quotes_sent_month: 42,
  quoted_revenue_month_cad: 198350.00,
  won_revenue_month_cad: 92400.00,
  conversion_rate_percent: 46.2,
  batteries_overdue_count: 3,
  active_tenders_count: 2
};
