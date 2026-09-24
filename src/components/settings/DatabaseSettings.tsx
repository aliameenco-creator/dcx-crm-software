import React, { useState } from 'react';
import { Database, CheckCircle2, Copy, Check, ExternalLink, HelpCircle, ShieldCheck, RefreshCw, Key, Globe } from 'lucide-react';
import { testSupabaseConnection } from '../../lib/supabase';

export const DatabaseSettings: React.FC = () => {
  const [supabaseUrl, setSupabaseUrl] = useState(import.meta.env.VITE_SUPABASE_URL || '');
  const [supabaseKey, setSupabaseKey] = useState(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const res = await testSupabaseConnection(supabaseUrl, supabaseKey);
    setTestResult(res);
    setIsTesting(false);
  };

  const sqlScript = `-- ==========================================================
-- UPS & BATTERY SYSTEMS CANADA — MASTER SUPABASE SQL SCHEMA
-- Copy and paste this into Supabase SQL Editor and click RUN
-- ==========================================================

-- 1. Customers Master Table
CREATE TABLE IF NOT EXISTS customers (
    customer_id VARCHAR(50) PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    primary_email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(50),
    facility_address TEXT,
    distance_km NUMERIC(6, 2) DEFAULT 0.00,
    priority_tier VARCHAR(50) DEFAULT 'Standard',
    customer_since DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Customer Installed Equipment & Battery Assets
CREATE TABLE IF NOT EXISTS customer_assets (
    asset_id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50) REFERENCES customers(customer_id) ON DELETE CASCADE,
    ups_model VARCHAR(255) NOT NULL,
    serial_number VARCHAR(100),
    battery_type VARCHAR(255),
    battery_quantity INT DEFAULT 0,
    installation_date DATE NOT NULL,
    warranty_end_date DATE,
    battery_replacement_due DATE,
    active_sla_tier VARCHAR(100) DEFAULT 'Standard Warranty',
    status VARCHAR(50) DEFAULT 'Active',
    last_service_date DATE
);

-- 3. Live Pricing & Rate Configuration Matrix
CREATE TABLE IF NOT EXISTS pricing_catalog (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    brand VARCHAR(100),
    wholesale_cost NUMERIC(10, 2) NOT NULL,
    standard_rate NUMERIC(10, 2) NOT NULL,
    spec_summary TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Quotations Ledger
CREATE TABLE IF NOT EXISTS quotations_ledger (
    quote_id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50) REFERENCES customers(customer_id),
    customer_name VARCHAR(255),
    scope_summary TEXT,
    hardware_subtotal NUMERIC(10, 2),
    labor_hours INT,
    labor_subtotal NUMERIC(10, 2),
    travel_subtotal NUMERIC(10, 2),
    callout_fee NUMERIC(10, 2),
    maintenance_plan_cad NUMERIC(10, 2),
    tax_cad NUMERIC(10, 2),
    total_amount_cad NUMERIC(10, 2),
    status VARCHAR(50) DEFAULT 'Drafted',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Full Email Activity & Audit Trail
CREATE TABLE IF NOT EXISTS email_activity_logs (
    id VARCHAR(50) PRIMARY KEY,
    thread_id VARCHAR(100),
    customer_id VARCHAR(50),
    sender_name VARCHAR(255),
    sender_email VARCHAR(255),
    subject TEXT,
    body TEXT,
    category VARCHAR(100),
    urgency VARCHAR(50),
    status VARCHAR(50),
    ai_reasoning TEXT,
    ai_draft_reply TEXT,
    approved_by VARCHAR(100),
    approval_timestamp TIMESTAMP WITH TIME ZONE,
    final_sent_email TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="card-surface p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-l-emerald-500">
        <div>
          <div className="text-[11px] font-mono text-emerald-400 uppercase font-bold tracking-wider">
            // DATABASE INFRASTRUCTURE &amp; CONNECTION
          </div>
          <h2 className="font-serif text-xl sm:text-2xl text-cream font-bold mt-0.5">
            Supabase Connection &amp; Non-Technical Setup Guide
          </h2>
          <p className="text-xs text-cream-muted mt-1 max-w-xl">
            Connect your live Supabase database or manage customer data visually without writing a single line of code.
          </p>
        </div>

        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="btn-outline-copper text-xs py-2 px-4 font-bold flex items-center gap-1.5 shrink-0"
        >
          <span>Open Supabase Cloud Dashboard</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: API Keys & Connection Test (6 Cols) */}
        <div className="lg:col-span-6 space-y-5">
          
          <div className="card-surface p-5 space-y-4">
            <h3 className="font-serif font-bold text-base text-cream flex items-center gap-2 border-b border-cream-border pb-2.5">
              <Key className="w-4 h-4 text-copper" /> Live Supabase API Keys
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-cream-dim uppercase mb-1">
                  Supabase Project URL
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cream-dim" />
                  <input
                    type="text"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://xyzcompany.supabase.co"
                    className="w-full bg-bg-elevated border border-cream-border text-cream text-xs font-mono pl-9 pr-3 py-2.5 rounded-lg focus:outline-none focus:border-copper"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-cream-dim uppercase mb-1">
                  Supabase Anon Public Key
                </label>
                <input
                  type="password"
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full bg-bg-elevated border border-cream-border text-cream text-xs font-mono p-2.5 rounded-lg focus:outline-none focus:border-copper"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="btn-copper text-xs py-2 px-4 font-bold flex items-center gap-2"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Testing Connection...</span>
                    </>
                  ) : (
                    <>
                      <Database className="w-3.5 h-3.5" />
                      <span>Test Live Database Connection</span>
                    </>
                  )}
                </button>
              </div>

              {/* Test Result Message */}
              {testResult && (
                <div className={`p-3.5 rounded-xl border text-xs font-mono leading-relaxed ${
                  testResult.success
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                    : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                }`}>
                  <div className="font-bold mb-0.5">
                    {testResult.success ? '✓ Connection Verified:' : '✗ Connection Error:'}
                  </div>
                  {testResult.message}
                </div>
              )}
            </div>
          </div>

          {/* Non-Technical Guide Card */}
          <div className="card-surface p-5 space-y-3 border border-lavender-border/50 bg-bg-elevated/40">
            <h4 className="font-serif font-bold text-sm text-cream flex items-center gap-2 text-lavender">
              <HelpCircle className="w-4 h-4 text-lavender" /> How to Edit Data in Supabase (Non-Technical Guide)
            </h4>
            
            <div className="text-xs text-cream-muted space-y-2 leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="font-mono text-lavender font-bold">1.</span>
                <span>Log into <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-lavender underline font-semibold">Supabase.com</a> and open your project.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-lavender font-bold">2.</span>
                <span>Click <strong>Table Editor</strong> on the left sidebar (it looks just like Excel / Google Sheets).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-lavender font-bold">3.</span>
                <span>Click on <code className="text-copper">customers</code> or <code className="text-copper">pricing_catalog</code>, double-click any cell to change a number or name, and hit Enter!</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right: 1-Click SQL Setup Script (6 Cols) */}
        <div className="lg:col-span-6 space-y-5">
          <div className="card-surface p-5 space-y-3">
            
            <div className="flex items-center justify-between border-b border-cream-border pb-3">
              <div>
                <h3 className="font-serif font-bold text-base text-cream">
                  1-Click Database Schema Script
                </h3>
                <p className="text-[11px] text-cream-dim">Paste into Supabase SQL Editor and click Run</p>
              </div>

              <button
                onClick={handleCopySql}
                className="btn-outline-copper text-xs py-1.5 px-3 flex items-center gap-1.5 font-bold"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy SQL</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-bg-base p-3.5 rounded-xl border border-cream-border font-mono text-[11px] text-cream-muted overflow-x-auto max-h-[380px] leading-relaxed">
              <pre>{sqlScript}</pre>
            </div>

            <div className="text-[11px] text-cream-dim font-mono flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Includes ACID tables, foreign keys, timestamps &amp; formulas
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};

