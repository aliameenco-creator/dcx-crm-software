-- ==============================================================================
-- 🔋 UPS & BATTERY SYSTEMS CANADA — MASTER DATABASE SCHEMA FOR SUPABASE
-- 1-Click Installation Script: Copy & paste into Supabase SQL Editor and click RUN
-- ==============================================================================

-- Enable the pgvector extension for Vector Embeddings (Technical Manuals RAG)
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Customers Master Table
CREATE TABLE IF NOT EXISTS customers (
    customer_id VARCHAR(50) PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    primary_email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(50),
    facility_address TEXT,
    distance_km NUMERIC(6, 2) DEFAULT 0.00,
    priority_tier VARCHAR(50) DEFAULT 'Standard', -- 'VIP (Tier 1)', 'Commercial', 'Standard', 'New Prospect'
    customer_since DATE DEFAULT CURRENT_DATE,
    total_spend_cad NUMERIC(12, 2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Customer Installed Equipment & Battery Asset Registry
CREATE TABLE IF NOT EXISTS customer_assets (
    asset_id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50) REFERENCES customers(customer_id) ON DELETE CASCADE,
    ups_model VARCHAR(255) NOT NULL,
    serial_number VARCHAR(100),
    battery_type VARCHAR(255),
    battery_quantity INT DEFAULT 0,
    installation_date DATE NOT NULL,
    warranty_end_date DATE,
    battery_replacement_due DATE, -- Target 36-Month Milestone
    active_sla_tier VARCHAR(100) DEFAULT 'Standard Warranty',
    status VARCHAR(50) DEFAULT 'Active', -- 'Active', 'Under Maintenance', 'Decommissioned'
    last_service_date DATE
);

-- 3. Live Pricing Catalog & Rate Configuration Matrix
CREATE TABLE IF NOT EXISTS pricing_catalog (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'UPS System', 'Battery String', 'Bypass Panel', 'Accessory'
    brand VARCHAR(100),
    wholesale_cost NUMERIC(10, 2) NOT NULL,
    standard_rate NUMERIC(10, 2) NOT NULL,
    warranty_years INT DEFAULT 2,
    spec_summary TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Operational Rates Configuration Table (Single Row Configuration)
CREATE TABLE IF NOT EXISTS operational_rates (
    id INT PRIMARY KEY DEFAULT 1,
    technician_labor_rate_per_hour NUMERIC(10, 2) DEFAULT 150.00,
    emergency_labor_rate_per_hour NUMERIC(10, 2) DEFAULT 225.00,
    fuel_rate_per_km NUMERIC(10, 2) DEFAULT 0.65,
    base_callout_fee NUMERIC(10, 2) DEFAULT 250.00,
    maintenance_1yr_multiplier NUMERIC(4, 2) DEFAULT 1.00,
    maintenance_3yr_multiplier NUMERIC(4, 2) DEFAULT 1.00,
    maintenance_5yr_multiplier NUMERIC(4, 2) DEFAULT 1.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Quotations Ledger
CREATE TABLE IF NOT EXISTS quotations_ledger (
    quote_id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50) REFERENCES customers(customer_id),
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    facility_address TEXT,
    scope_summary TEXT,
    hardware_subtotal NUMERIC(10, 2) DEFAULT 0.00,
    labor_hours INT DEFAULT 0,
    labor_rate_per_hour NUMERIC(10, 2) DEFAULT 150.00,
    labor_subtotal NUMERIC(10, 2) DEFAULT 0.00,
    travel_distance_km NUMERIC(6, 2) DEFAULT 0.00,
    fuel_rate_per_km NUMERIC(10, 2) DEFAULT 0.65,
    travel_subtotal NUMERIC(10, 2) DEFAULT 0.00,
    callout_fee NUMERIC(10, 2) DEFAULT 250.00,
    maintenance_plan_name VARCHAR(150),
    maintenance_plan_cad NUMERIC(10, 2) DEFAULT 0.00,
    subtotal_cad NUMERIC(10, 2) DEFAULT 0.00,
    tax_cad NUMERIC(10, 2) DEFAULT 0.00,
    total_amount_cad NUMERIC(10, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Drafted', -- 'Drafted', 'Pending Approval', 'Sent to Client', 'Accepted / Won', 'Follow-up Due'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,
    follow_up_count INT DEFAULT 0,
    notes TEXT
);

-- 6. Full Email Activity & Audit Trail
CREATE TABLE IF NOT EXISTS email_activity_logs (
    id VARCHAR(50) PRIMARY KEY,
    thread_id VARCHAR(100),
    customer_id VARCHAR(50) REFERENCES customers(customer_id),
    customer_name VARCHAR(255),
    sender_name VARCHAR(255),
    sender_email VARCHAR(255) NOT NULL,
    subject TEXT,
    body TEXT,
    category VARCHAR(100), -- 'Technical Support', 'Quote Request', 'Tender', etc.
    urgency VARCHAR(50) DEFAULT 'Medium',
    status VARCHAR(50) DEFAULT 'Pending Review', -- 'Pending Review', 'Approved & Sent', 'Auto-Replied'
    ai_reasoning TEXT,
    ai_draft_reply TEXT,
    approved_by VARCHAR(100),
    approval_timestamp TIMESTAMP WITH TIME ZONE,
    final_sent_email TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Technical Manuals & Knowledge Base Embeddings (RAG)
CREATE TABLE IF NOT EXISTS knowledge_manual_chunks (
    id BIGSERIAL PRIMARY KEY,
    manual_title VARCHAR(255) NOT NULL,
    page_number INT,
    chunk_content TEXT NOT NULL,
    embedding VECTOR(1536), -- 1536 dimensions for OpenAI text-embedding-3-small
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Seed Initial Pricing Catalog
INSERT INTO pricing_catalog (id, name, category, brand, wholesale_cost, standard_rate, warranty_years, spec_summary)
VALUES 
    ('bat-100ah', '12V 100Ah High-Rate VRLA Battery', 'Battery String', 'Enersys PowerSafe', 165.00, 240.00, 2, 'Flame-retardant casing, 10-year design life, data center grade.'),
    ('bat-150ah', '12V 150Ah Heavy-Duty VRLA Battery', 'Battery String', 'CSB Battery', 210.00, 310.00, 2, 'High energy density for extended autonomy runtime.'),
    ('bat-200ah', '12V 200Ah Long-Life Front-Terminal Battery', 'Battery String', 'NorthStar / Enersys', 290.00, 420.00, 3, 'Front terminal design for fast rack servicing; substation grade.'),
    ('ups-eaton-50k', 'Eaton 93PM 50kVA Modular UPS Unit', 'UPS System', 'Eaton', 12400.00, 18450.00, 2, '3-Phase 208/120V or 480V, 97% efficiency, scalable modular slots.'),
    ('ups-schneider-80k', 'Schneider Galaxy 5000 80kVA Industrial UPS', 'UPS System', 'Schneider Electric', 19800.00, 28900.00, 2, 'Industrial dual mains input, harmonic filter, CSA certified.'),
    ('acc-bypass-panel', 'Integrated External Maintenance Bypass Panel', 'Bypass Panel', 'UPS Canada Systems', 1450.00, 2200.00, 5, '3-breaker interlocked manual bypass panel.')
ON CONFLICT (id) DO NOTHING;

-- 9. Seed Operational Parameters
INSERT INTO operational_rates (id, technician_labor_rate_per_hour, emergency_labor_rate_per_hour, fuel_rate_per_km, base_callout_fee)
VALUES (1, 150.00, 225.00, 0.65, 250.00)
ON CONFLICT (id) DO NOTHING;

-- 10. Seed Initial Customer Profile (Toronto General Hospital)
INSERT INTO customers (customer_id, company_name, contact_name, primary_email, phone_number, facility_address, distance_km, priority_tier, customer_since, total_spend_cad)
VALUES ('CUST-1042', 'Toronto General Hospital (Data Centre Alpha)', 'Mark Davis (Facilities Director)', 'mark.davis@torontohospital.ca', '+1 (416) 555-0192', '200 Elizabeth St, Toronto, ON M5G 2C4', 28.50, 'VIP (Tier 1)', '2023-05-10', 44780.00)
ON CONFLICT (customer_id) DO NOTHING;

INSERT INTO customer_assets (asset_id, customer_id, ups_model, serial_number, battery_type, battery_quantity, installation_date, warranty_end_date, battery_replacement_due, active_sla_tier, status)
VALUES ('ASSET-904', 'CUST-1042', 'Eaton 93PM 50kVA Modular UPS (3-Phase 208/120V)', 'ETN-93PM-50K-2023-0941', '12V 100Ah High-Rate VRLA Battery', 32, '2023-05-15', '2025-05-15', '2026-05-15', '3-Year Silver Care', 'Active')
ON CONFLICT (asset_id) DO NOTHING;

