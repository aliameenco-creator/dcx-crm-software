import React, { useState } from 'react';
import { BookOpen, Search, FileText, CheckCircle2, ShieldAlert, Sparkles, ExternalLink, Bot } from 'lucide-react';

export const KnowledgeBaseExplorer: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('Alarm Code 104');
  const [selectedManual, setSelectedManual] = useState('Eaton_93PM_50kVA_User_Manual.pdf');

  const manuals = [
    {
      name: 'Eaton_93PM_50kVA_User_Manual.pdf',
      pages: 148,
      size_mb: 8.4,
      category: 'UPS Technical Manual',
      vector_chunks: 340,
      description: 'Complete electrical specifications, inverter operation, bypass schematics & alarm troubleshooting table.'
    },
    {
      name: 'Schneider_Galaxy_5000_80kVA_Specs.pdf',
      pages: 182,
      size_mb: 11.2,
      category: 'UPS Technical Manual',
      vector_chunks: 410,
      description: 'Industrial dual-mains input, harmonic filter specs, battery breaker sizing & fault diagnostics.'
    },
    {
      name: 'APC_Symmetra_PX_30kVA_Guide.pdf',
      pages: 96,
      size_mb: 5.6,
      category: 'UPS Technical Manual',
      vector_chunks: 220,
      description: 'N+1 scalable modular power frame, hot-swap battery modules & remote network management card.'
    },
    {
      name: 'Enersys_Powersafe_VRLA_Datasheet.pdf',
      pages: 24,
      size_mb: 2.1,
      category: 'Battery Technical Guide',
      vector_chunks: 65,
      description: 'High-rate discharge performance curves, float voltage charging parameters & 3-year replacement guidelines.'
    },
    {
      name: 'CSA_C22_2_No_107_3_Compliance_Summary.pdf',
      pages: 42,
      size_mb: 3.4,
      category: 'Compliance & Safety',
      vector_chunks: 110,
      description: 'Canadian electrical safety requirements for uninterruptible power systems and commercial bidding.'
    }
  ];

  // Simulated Vector Search Results
  const getSimulatedResults = (query: string) => {
    if (query.toLowerCase().includes('104')) {
      return {
        matchedSection: 'Section 6.2: System Alarm Codes & Diagnostics (Page 48)',
        confidence: '98.4% Semantic Match',
        manualSource: 'Eaton_93PM_50kVA_User_Manual.pdf',
        extractedText: `Alarm Code 104: Inverter Air Intake Filter Temperature Warning.
Condition: Internal airflow sensor detects restricted ventilation across the front sub-chassis filter matrix.
Action Required:
1. Verify front airflow grilles are unobstructed by external debris or cabling.
2. Check ambient server room cooling is operating within nominal 20°C–25°C range.
3. If alarm persists > 30 minutes, inspect front particulate filter for dust accumulation.
Safe Operating Note: System remains in normal double-conversion inverter mode and will transfer safely to static bypass if thermal threshold is exceeded.`,
      };
    }
    return {
      matchedSection: 'Section 4.1: General Maintenance & Battery Inspection (Page 32)',
      confidence: '92.1% Semantic Match',
      manualSource: selectedManual,
      extractedText: `Preventative Maintenance Procedures:
All VRLA battery strings must undergo annual impedance testing and visual terminal torque verification. 
Battery cells operating under normal 25°C ambient conditions reach end-of-design life at 36 to 48 months, after which cell internal resistance increases exponentially, posing critical failure risk during mains outages. Proactive string replacement is strongly mandated at Year 3.`,
    };
  };

  const results = getSimulatedResults(searchQuery);

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="card-surface p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-l-lavender">
        <div>
          <div className="text-[11px] font-mono text-lavender uppercase font-bold tracking-wider">
            // CONTROLLED KNOWLEDGE BASE &amp; VECTOR SEARCH (RAG)
          </div>
          <h2 className="font-serif text-xl sm:text-2xl text-cream font-bold mt-0.5">
            UPS Technical Manuals &amp; Troubleshooting Guide
          </h2>
          <p className="text-xs text-cream-muted mt-1 max-w-xl">
            Official manufacturer manuals, warranty policies, and CSA compliance standards. The AI only answers from these verified documents to guarantee <strong className="text-cream">Zero Hallucinations</strong>.
          </p>
        </div>

        <span className="badge-lavender text-xs py-1.5 px-3">
          pgvector Semantic RAG Active
        </span>
      </div>

      {/* Two Columns: Manuals List + Live Search Testbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Registered Manuals (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-mono text-cream-dim uppercase font-bold px-1">
            Official Approved Documents ({manuals.length})
          </div>

          <div className="space-y-2.5">
            {manuals.map((man, idx) => {
              const isSelected = selectedManual === man.name;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedManual(man.name)}
                  className={`card-surface p-4 cursor-pointer transition-all space-y-2 ${
                    isSelected ? 'border-lavender-border bg-bg-elevated' : 'hover:border-cream-border/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-lavender shrink-0" />
                      <h4 className="text-xs font-semibold text-cream truncate max-w-[220px]">
                        {man.name}
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-cream-dim">{man.pages} pgs</span>
                  </div>

                  <p className="text-[11px] text-cream-dim line-clamp-2 leading-relaxed">
                    {man.description}
                  </p>

                  <div className="flex items-center justify-between text-[10px] font-mono text-cream-dim pt-1 border-t border-cream-border/40">
                    <span>{man.category}</span>
                    <span className="text-lavender font-semibold">{man.vector_chunks} Embeddings</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Interactive Semantic Search Testbench (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="card-surface p-5 space-y-4">
            
            <div className="flex items-center justify-between border-b border-cream-border pb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-lavender" />
                <h3 className="font-serif font-bold text-base text-cream">
                  Semantic RAG Search Testbench
                </h3>
              </div>
              <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Vector Query Live
              </span>
            </div>

            {/* Query Input */}
            <div>
              <label className="block text-xs font-mono text-cream-dim uppercase mb-1.5">
                Simulate Customer Question or Alarm Code:
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cream-dim" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. Alarm Code 104, battery float voltage, bypass procedure..."
                  className="w-full bg-bg-elevated border border-cream-border text-cream text-xs sm:text-sm pl-9 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-lavender"
                />
              </div>
            </div>

            {/* Search Result Box */}
            <div className="bg-bg-elevated/70 border border-lavender-border/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-lavender-border/30">
                <span className="font-mono font-bold text-lavender flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> {results.matchedSection}
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-full font-bold">
                  {results.confidence}
                </span>
              </div>

              <div className="text-xs font-mono text-cream-dim">
                Source Document: <strong className="text-copper">{results.manualSource}</strong>
              </div>

              <div className="bg-bg-surface p-3.5 rounded-lg border border-cream-border/50 text-xs text-cream leading-relaxed font-mono whitespace-pre-line">
                {results.extractedText}
              </div>

              <div className="text-[11px] text-cream-dim flex items-center justify-between pt-1">
                <span>The AI drafts its response using ONLY this verified manual text.</span>
                <span className="text-lavender font-semibold">Zero Hallucination Guaranteed</span>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};

