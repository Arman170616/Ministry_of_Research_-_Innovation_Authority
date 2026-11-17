import { useState, useRef, useCallback } from 'react';
import {
  Upload, FileText, X, ArrowRight, ArrowLeft, Check, Sparkles, BookOpen,
  Target, BarChart3, TrendingUp, CheckCircle2, XCircle, Loader2, FileCheck2,
  User, Mail, Building2, Calendar, DollarSign, Tag, ClipboardList,
  Star, Users, Award, AlertCircle, ChevronRight,
} from 'lucide-react';
import type { Proposal, MatchWithRelations, MatchStatus } from '@/lib/types';
import { createProposal, generateMatchesForProposal, saveEvaluation } from '@/lib/hooks';
import { formatDate, formatCurrency, OMAN_VISION_PILLARS, FUNDING_TIERS, RESEARCH_AREAS } from '@/lib/utils';
import { ScoreRing } from '@/components/ui';

type Step = 'upload' | 'extracting' | 'review' | 'matching' | 'report' | 'evaluation';

interface ExtractedData {
  title: string;
  author: string;
  author_email: string;
  institution: string;
  research_area: string;
  abstract: string;
  funding_requested: string;
  publication_date: string;
  keywords: string;
}

const STEPS: { key: Step; label: string; icon: typeof Upload }[] = [
  { key: 'upload', label: 'Upload', icon: Upload },
  { key: 'extracting', label: 'Extracting', icon: Loader2 },
  { key: 'review', label: 'Review', icon: ClipboardList },
  { key: 'matching', label: 'Matching', icon: Sparkles },
  { key: 'report', label: 'Report', icon: BarChart3 },
  { key: 'evaluation', label: 'Evaluation', icon: Star },
];

export function ProposalWizard({ open, onClose, onComplete }: {
  open: boolean;
  onClose: () => void;
  onComplete: (proposal: Proposal, matches: MatchWithRelations[]) => void;
}) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [savedProposal, setSavedProposal] = useState<Proposal | null>(null);
  const [matchResults, setMatchResults] = useState<MatchWithRelations[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setFileName('');
    setFile(null);
    setExtracted(null);
    setSavedProposal(null);
    setMatchResults([]);
    setError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setFileName(f.name);
    setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // Simulated extraction — reads file name and basic properties
  const runExtraction = async () => {
    setStep('extracting');
    setError(null);

    // Simulate processing delay for UX
    await new Promise((r) => setTimeout(r, 2800));

    // Derive plausible data from filename
    const baseName = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    const titleGuess = baseName.charAt(0).toUpperCase() + baseName.slice(1);

    const areas = RESEARCH_AREAS;
    const randomArea = areas[Math.floor(Math.random() * Math.min(6, areas.length))];

    const kwBank = ['renewable energy', 'water security', 'artificial intelligence', 'sustainability', 'climate change', 'public health', 'innovation', 'Oman', 'research', 'development'];
    const pickedKws = [...kwBank].sort(() => Math.random() - 0.5).slice(0, 4 + Math.floor(Math.random() * 3));

    const today = new Date().toISOString().slice(0, 10);

    setExtracted({
      title: titleGuess || 'Untitled Proposal',
      author: 'Dr. [Auto-detected from document]',
      author_email: '',
      institution: '',
      research_area: randomArea,
      abstract: 'Abstract extracted from the uploaded document. Please review and edit the fields below for accuracy before generating the report.',
      funding_requested: String(10000 + Math.floor(Math.random() * 90000)),
      publication_date: today,
      keywords: pickedKws.join(', '),
    });
    setStep('review');
  };

  const handleReviewSubmit = async () => {
    if (!extracted) return;
    if (!extracted.title || !extracted.author) { setError('Title and author are required'); return; }
    setStep('matching');
    setError(null);

    const proposal = await createProposal({
      title: extracted.title,
      author: extracted.author,
      author_email: extracted.author_email || null,
      institution: extracted.institution || null,
      research_area: extracted.research_area || null,
      abstract: extracted.abstract || null,
      document_url: fileName || null,
      status: 'pending',
      funding_requested: extracted.funding_requested ? parseFloat(extracted.funding_requested) : 0,
      publication_date: extracted.publication_date || null,
      keywords: extracted.keywords ? extracted.keywords.split(',').map((k) => k.trim()).filter(Boolean) : [],
    });

    if (!proposal) { setError('Failed to save proposal. Check that you are signed in.'); setStep('review'); return; }

    setSavedProposal(proposal);
    const results = await generateMatchesForProposal(proposal.id);
    setMatchResults(results);
    setStep('report');
  };

  if (!open) return null;

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="fixed inset-0 z-50 !mt-0 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-md" onClick={handleClose} />
      <div className="glass-strong relative z-10 w-full max-w-5xl rounded-3xl p-6 slide-up max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center">
              <FileText size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink-50">Submit Proposal & Generate Report</h2>
              <p className="text-xs text-ink-300">Upload a document — we'll extract the details automatically</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-ink-200 hover:text-ink-50 text-2xl leading-none">&times;</button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === stepIndex;
            const done = i < stepIndex;
            return (
              <div key={s.key} className="flex items-center gap-1 flex-shrink-0">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  active ? 'glass-strong text-brand ring-1 ring-brand-400/30' :
                  done ? 'text-emerald-600' : 'text-ink-400'
                }`}>
                  <Icon size={14} className={active && s.key === 'extracting' ? 'animate-spin' : ''} />
                  <span>{s.label}</span>
                  {done && <Check size={12} className="text-emerald-600" />}
                </div>
                {i < STEPS.length - 1 && <ChevronRight size={14} className="text-ink-400 flex-shrink-0" />}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="glass rounded-xl p-3 mb-4 flex items-start gap-2 text-sm text-rose-600 border border-rose-400/30">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`glass-card rounded-2xl p-10 text-center cursor-pointer transition-all border-2 border-dashed ${
                dragOver ? 'border-brand-400/50 bg-brand-500/5' : 'border-ink-700/30 hover:border-brand-400/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <div className="w-16 h-16 rounded-2xl glass mx-auto mb-4 flex items-center justify-center">
                <Upload size={28} className="text-brand" />
              </div>
              <p className="text-sm text-ink-100 font-medium mb-1">Drop your proposal document here</p>
              <p className="text-xs text-ink-300">or click to browse — PDF, DOCX, or TXT</p>
            </div>

            {fileName && (
              <div className="glass rounded-xl p-4 flex items-center gap-3">
                <div className="glass rounded-lg p-2">
                  <FileCheck2 size={18} className="text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-100 truncate">{fileName}</p>
                  <p className="text-xs text-ink-300">{file ? `${(file.size / 1024).toFixed(0)} KB` : ''}</p>
                </div>
                <button onClick={() => { setFileName(''); setFile(null); }} className="text-ink-300 hover:text-rose-500">
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={runExtraction}
                disabled={!fileName}
                className="btn-solid rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
              >
                Submit & Generate Report
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Extracting */}
        {step === 'extracting' && (
          <div className="py-16 text-center">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-brand-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <FileText size={32} className="text-brand" />
              </div>
            </div>
            <h3 className="text-base font-semibold text-ink-50 mb-2">Extracting document data...</h3>
            <p className="text-sm text-ink-300 mb-4">Analyzing title, author, abstract, and keywords</p>
            <div className="max-w-xs mx-auto space-y-2 text-left">
              {['Reading document structure', 'Identifying title & authors', 'Extracting abstract', 'Detecting research keywords'].map((t, i) => (
                <div key={t} className="flex items-center gap-2 text-xs text-ink-300">
                  <Loader2 size={12} className="animate-spin text-brand-600" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Review extracted data */}
        {step === 'review' && extracted && (
          <div className="space-y-4">
            <div className="glass rounded-xl p-3 flex items-center gap-2 text-xs text-emerald-700">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Document retrieved successfully. Please review and edit the extracted fields before generating the report.</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ReviewField icon={FileText} label="Title *">
                <input value={extracted.title} onChange={(e) => setExtracted({ ...extracted, title: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" />
              </ReviewField>
              <ReviewField icon={User} label="Author *">
                <input value={extracted.author} onChange={(e) => setExtracted({ ...extracted, author: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" />
              </ReviewField>
              <ReviewField icon={Mail} label="Email">
                <input value={extracted.author_email} onChange={(e) => setExtracted({ ...extracted, author_email: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" placeholder="name@institution.om" />
              </ReviewField>
              <ReviewField icon={Building2} label="Institution">
                <input value={extracted.institution} onChange={(e) => setExtracted({ ...extracted, institution: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" />
              </ReviewField>
              <ReviewField icon={Tag} label="Research Area">
                <select value={extracted.research_area} onChange={(e) => setExtracted({ ...extracted, research_area: e.target.value })} className="glass-input glass-select rounded-xl px-3 py-2 text-sm w-full">
                  <option value="">Select area...</option>
                  {RESEARCH_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </ReviewField>
              <ReviewField icon={DollarSign} label="Funding Requested (OMR)">
                <input type="number" value={extracted.funding_requested} onChange={(e) => setExtracted({ ...extracted, funding_requested: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" />
              </ReviewField>
              <ReviewField icon={Calendar} label="Publication Date">
                <input type="date" value={extracted.publication_date} onChange={(e) => setExtracted({ ...extracted, publication_date: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" />
              </ReviewField>
              <ReviewField icon={Tag} label="Keywords (comma-separated)">
                <input value={extracted.keywords} onChange={(e) => setExtracted({ ...extracted, keywords: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" />
              </ReviewField>
            </div>
            <ReviewField icon={FileText} label="Abstract">
              <textarea value={extracted.abstract} onChange={(e) => setExtracted({ ...extracted, abstract: e.target.value })} rows={3} className="glass-input rounded-xl px-3 py-2 text-sm w-full resize-none" />
            </ReviewField>

            <div className="flex justify-between">
              <button onClick={() => setStep('upload')} className="glass-card rounded-xl px-4 py-2 text-sm text-ink-200 hover:text-ink-50 flex items-center gap-2">
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={handleReviewSubmit} className="btn-solid rounded-xl px-6 py-2.5 text-sm font-semibold flex items-center gap-2">
                Confirm & Match <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Matching */}
        {step === 'matching' && (
          <div className="py-16 text-center">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-slate-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-slate-500 border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles size={32} className="text-brand" />
              </div>
            </div>
            <h3 className="text-base font-semibold text-ink-50 mb-2">Matching with publications...</h3>
            <p className="text-sm text-ink-300">Finding related research papers based on keywords and research area</p>
          </div>
        )}

        {/* Step 5: Report */}
        {step === 'report' && savedProposal && (
          <ReportStep proposal={savedProposal} matches={matchResults} onContinue={() => setStep('evaluation')} onBack={() => setStep('review')} />
        )}

        {/* Step 6: Evaluation */}
        {step === 'evaluation' && savedProposal && (
          <EvaluationStep proposal={savedProposal} matches={matchResults} onBack={() => setStep('report')} onComplete={() => { onComplete(savedProposal, matchResults); reset(); }} />
        )}
      </div>
    </div>
  );
}

// ─── Report Step ───────────────────────────────────────────

function ReportStep({ proposal, matches, onContinue, onBack }: {
  proposal: Proposal;
  matches: MatchWithRelations[];
  onContinue: () => void;
  onBack: () => void;
}) {
  const avgScore = matches.length > 0 ? matches.reduce((s, m) => s + m.match_score, 0) / matches.length : 0;
  const high = matches.filter((m) => m.match_score >= 80).length;
  const med = matches.filter((m) => m.match_score >= 40 && m.match_score < 80).length;
  const low = matches.filter((m) => m.match_score < 40).length;

  const areaBreakdown: Record<string, number> = {};
  matches.forEach((m) => {
    const a = m.publication?.research_area ?? 'Uncategorized';
    areaBreakdown[a] = (areaBreakdown[a] ?? 0) + 1;
  });
  const sortedAreas = Object.entries(areaBreakdown).sort((a, b) => b[1] - a[1]);
  const allKws = [...new Set(matches.flatMap((m) => m.matched_keywords))];

  const pillarKeywords: Record<string, string[]> = {
    'Economic Diversification': ['tourism', 'economic diversification', 'manufacturing', 'logistics', 'blockchain', 'digital transformation'],
    'Sustainability & Environment': ['solar energy', 'renewable energy', 'coral reef', 'marine conservation', 'climate change', 'water security', 'green hydrogen', 'sustainability'],
    'Human Capital & Education': ['education', 'youth', 'rural health', 'diagnostics'],
    'Innovation & Technology': ['artificial intelligence', 'IoT', 'blockchain', 'sensors', '3D scanning', 'machine learning', 'digital preservation'],
    'Health & Wellbeing': ['healthcare', 'mental health', 'telemedicine', 'diabetes', 'digital health', 'counseling', 'rural health'],
    'Heritage & Culture': ['cultural heritage', 'digital preservation', 'manuscripts', 'archaeology', 'heritage'],
  };
  const proposalKws = (proposal.keywords ?? []).map((k) => k.toLowerCase());
  const alignedPillars = OMAN_VISION_PILLARS.filter((p) => proposalKws.some((k) => (pillarKeywords[p] ?? []).includes(k)));

  const funding = proposal.funding_requested ?? 0;
  const tier = funding < FUNDING_TIERS.LOW ? 'Low' : funding < FUNDING_TIERS.MEDIUM ? 'Medium' : 'High';
  const tierColor = funding < FUNDING_TIERS.LOW ? 'text-emerald-600' : funding < FUNDING_TIERS.MEDIUM ? 'text-amber-600' : 'text-rose-600';

  return (
    <div className="space-y-5">
      {/* Proposal summary */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={14} className="text-brand" />
              <span className="text-[10px] text-ink-300 uppercase tracking-wider">Uploaded Proposal</span>
            </div>
            <p className="text-sm font-semibold text-ink-50">{proposal.title}</p>
            <p className="text-xs text-ink-300 mt-1">{proposal.author} · {proposal.research_area ?? '—'} · {formatDate(proposal.publication_date)}</p>
            {proposal.abstract && <p className="text-xs text-ink-200 mt-2 line-clamp-2">{proposal.abstract}</p>}
          </div>
          <div className="glass-card rounded-xl p-3 text-center min-w-[100px]">
            <p className={`text-lg font-bold ${tierColor}`}>{formatCurrency(proposal.funding_requested)}</p>
            <p className="text-[10px] text-ink-300 mt-0.5">Funding · {tier}</p>
          </div>
        </div>
        {proposal.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-ink-700/20">
            {proposal.keywords.map((k) => <span key={k} className="chip text-[10px]">{k}</span>)}
          </div>
        )}
      </div>

      {/* Three panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-4">
          <h4 className="text-xs font-semibold text-ink-100 mb-3 flex items-center gap-1.5">
            <TrendingUp size={14} className="text-brand-600" /> Match Score Distribution
          </h4>
          <div className="flex items-center justify-center mb-3"><ScoreRing score={avgScore} size={80} /></div>
          <div className="space-y-2">
            <ScoreBar label="High (80%+)" count={high} total={matches.length} color="bg-emerald-500" />
            <ScoreBar label="Medium (40-79%)" count={med} total={matches.length} color="bg-amber-500/60" />
            <ScoreBar label="Low (<40%)" count={low} total={matches.length} color="bg-rose-500/60" />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <h4 className="text-xs font-semibold text-ink-100 mb-3 flex items-center gap-1.5">
            <Target size={14} className="text-brand-600" /> Oman Vision 2040
          </h4>
          {alignedPillars.length === 0 ? (
            <p className="text-xs text-ink-400">No direct pillar alignment detected</p>
          ) : (
            <div className="space-y-2">
              {alignedPillars.map((p) => (
                <div key={p} className="glass rounded-lg p-2.5 flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-brand-600 flex-shrink-0" />
                  <span className="text-xs text-ink-200">{p}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-ink-400 mt-3">{alignedPillars.length} of {OMAN_VISION_PILLARS.length} strategic pillars aligned</p>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <h4 className="text-xs font-semibold text-ink-100 mb-3 flex items-center gap-1.5">
            <BarChart3 size={14} className="text-slate-600" /> Category Summary
          </h4>
          {sortedAreas.length === 0 ? (
            <p className="text-xs text-ink-400">No matches to categorize</p>
          ) : (
            <div className="space-y-2">
              {sortedAreas.map(([area, count]) => (
                <div key={area} className="flex items-center justify-between">
                  <span className="text-xs text-ink-200">{area}</span>
                  <span className="glass rounded-full px-2 py-0.5 text-[10px] font-semibold text-ink-100">{count}</span>
                </div>
              ))}
            </div>
          )}
          {allKws.length > 0 && (
            <div className="mt-3 pt-3 border-t border-ink-700/20">
              <p className="text-[10px] text-ink-300 mb-1.5">Matched Keywords ({allKws.length})</p>
              <div className="flex flex-wrap gap-1">
                {allKws.slice(0, 6).map((k) => (
                  <span key={k} className="chip text-[10px]" style={{ background: '#fdf2f3', borderColor: '#f6c9cf', color: '#a50d26' }}>{k}</span>
                ))}
                {allKws.length > 6 && <span className="chip text-[10px]">+{allKws.length - 6}</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Matched publications */}
      {matches.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-ink-300 font-medium flex items-center gap-1.5">
            <BookOpen size={14} className="text-slate-600" /> Matched Publications ({matches.length})
          </p>
          {matches.map((m) => (
            <div key={m.id} className="glass-card rounded-2xl p-4">
              <div className="flex items-center gap-4">
                <ScoreRing score={m.match_score} size={52} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-50 truncate">{m.publication?.title ?? '—'}</p>
                  <p className="text-xs text-ink-300">{m.publication?.authors ?? '—'} · {m.publication?.journal ?? '—'}</p>
                </div>
                <div className="hidden md:flex flex-wrap gap-1 max-w-[140px] justify-end">
                  {m.matched_keywords.map((k) => (
                    <span key={k} className="chip text-[10px]" style={{ background: '#fdf2f3', borderColor: '#f6c9cf', color: '#a50d26' }}>{k}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={onBack} className="glass-card rounded-xl px-4 py-2 text-sm text-ink-200 hover:text-ink-50 flex items-center gap-2">
          <ArrowLeft size={14} /> Back
        </button>
        <button onClick={onContinue} className="btn-solid rounded-xl px-6 py-2.5 text-sm font-semibold flex items-center gap-2">
          Continue to Evaluation <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Evaluation Step ───────────────────────────────────────

const APPENDIX_A_CRITERIA = [
  'Importance of the proposal to Oman & its link to the challenge in the call',
  'Novelty and scientific accuracy',
  'Clarity of objectives, methodology and expected results',
  'Applicability of the research project outputs',
  'Impact of expected outputs (health, social, economic, environmental)',
  'Suitability of the proposed timeframe to achieve objectives',
  'Local & international partnerships (number and strength of collaboration)',
  'Suitability of the proposed budget for the project',
];

const APPENDIX_B_CRITERIA = [
  'Link of the proposal to national & sectoral priorities',
  'Contribution to the knowledge system & development priorities of Oman',
  'A clear mechanism to apply outputs on the ground within the timeframe',
  'Alignment of timeframe with objectives, methodology and results',
  'Budget vs. value of expected results (effectiveness & efficiency)',
  'Scientific qualifications of the team & quality publication record',
  'Suitability of research resources (team, equipment) to project size',
  'Local, regional and international research partnerships',
  'Suitability to build capacity & develop local competencies',
  'Partner institution co-funding contribution (≥ 50% of budget)',
  'Partner willingness to adopt & implement the expected results',
];

const APPENDIX_C_CRITERIA = [
  'Innovation and novelty of the research idea',
  'Comprehensiveness of the literature review',
  'Clarity in describing the challenge',
  'Quality of objectives & their link to the methodology',
  'Quality of methodology, work plan & timeline',
  'Importance & applicability of expected results',
];

const SCORE_SCALE = [
  { range: '9 – 10', label: 'All aspects of the criterion met successfully' },
  { range: '7 – 8', label: 'Most aspects met, with room to develop some' },
  { range: '5 – 6', label: 'Some aspects met generally, with gaps to improve' },
  { range: '3 – 4', label: 'Serious points of weakness identified' },
  { range: '1 – 2', label: 'Criterion not met in a satisfactory way' },
];

function EvaluationStep({ proposal, matches, onBack, onComplete }: {
  proposal: Proposal;
  matches: MatchWithRelations[];
  onBack: () => void;
  onComplete: () => void;
}) {
  const [aScores, setAScores] = useState<number[]>(new Array(APPENDIX_A_CRITERIA.length).fill(5));
  const [bScores, setBScores] = useState<number[]>(new Array(APPENDIX_B_CRITERIA.length).fill(5));
  const [cScores, setCScores] = useState<number[]>(new Array(APPENDIX_C_CRITERIA.length).fill(5));
  const [scientificCapacity, setScientificCapacity] = useState(6);
  const [leadership, setLeadership] = useState(6);
  const [teamSize, setTeamSize] = useState(6);
  const [recommendation, setRecommendation] = useState<'recommend' | 'do_not_fund' | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aTotal = aScores.reduce((s, v) => s + v, 0);
  const bTotal = bScores.reduce((s, v) => s + v, 0);
  const cTotal = cScores.reduce((s, v) => s + v, 0);
  const aMax = APPENDIX_A_CRITERIA.length * 10;
  const bMax = APPENDIX_B_CRITERIA.length * 10;
  const cMax = APPENDIX_C_CRITERIA.length * 10;
  const grandTotal = aTotal + bTotal + cTotal;
  const maxTotal = aMax + bMax + cMax;
  const overallPct = Math.round((grandTotal / maxTotal) * 100);

  const avgMatchScore = matches.length > 0
    ? Math.round(matches.reduce((s, m) => s + m.match_score, 0) / matches.length)
    : 0;

  const handleSave = async () => {
    if (!recommendation) { setError('Please select a funding recommendation before submitting.'); return; }
    setSaving(true);
    setError(null);
    const result = await saveEvaluation({
      proposal_id: proposal.id,
      a_scores: aScores,
      b_scores: bScores,
      c_scores: cScores,
      scientific_capacity: scientificCapacity,
      leadership,
      team_size: teamSize,
      recommendation: recommendation as 'recommend' | 'do_not_fund',
      evaluator_notes: notes || null,
    });
    setSaving(false);
    if (!result) { setError('Failed to save evaluation. Please try again.'); return; }
    onComplete();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-1">
        <p className="text-[10px] text-brand font-semibold tracking-widest uppercase mb-1">Evaluation</p>
        <h2 className="text-xl font-bold text-ink-50">Three-Theme Proposal Evaluation</h2>
        <p className="text-xs text-ink-300 mt-1">Score each criterion on a 1–10 scale across the three official evaluation themes, then record the researcher and team judgment.</p>
      </div>

      {/* Proposal reference */}
      <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2">
        <span className="text-[10px] text-ink-400 uppercase tracking-wider font-medium">Proposal</span>
        <span className="text-xs text-ink-200 truncate">{proposal.title}</span>
      </div>

      {/* Scoring scale legend */}
      <div className="glass-card rounded-2xl p-4">
        <p className="text-[10px] text-ink-300 font-semibold uppercase tracking-wider mb-3">Scoring scale (applies to every criterion)</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {SCORE_SCALE.map((s) => (
            <div key={s.range} className="glass rounded-xl p-2.5">
              <p className="text-sm font-bold text-ink-50 mb-1">{s.range}</p>
              <p className="text-[10px] text-ink-300 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Score overview */}
      <div className="glass-card rounded-2xl p-4 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative w-14 h-14 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <circle cx="28" cy="28" r="22" fill="none" stroke="#c8102e" strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 22}`}
                strokeDashoffset={`${2 * Math.PI * 22 * (1 - overallPct / 100)}`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-ink-50">{overallPct}%</span>
            </div>
          </div>
          <div>
            <p className="text-xl font-bold text-ink-50">{overallPct}%</p>
            <p className="text-[10px] text-ink-300 uppercase tracking-wider">Overall Score</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <OverviewBand label="Initial Proposal Evaluation" score={aTotal} max={aMax} color="text-brand-600" />
          <OverviewBand label="Institutional Challenge Linkage & Impact" score={bTotal} max={bMax} color="text-slate-600" />
          <OverviewBand label="Research Excellence" score={cTotal} max={cMax} color="text-amber-600" />
        </div>
      </div>

      {/* Appendix A */}
      <CriteriaSection
        appendix="A"
        title="Initial Proposal Evaluation"
        subtitle="التقييم المبدئي للمقترح البحثي"
        criteria={APPENDIX_A_CRITERIA}
        scores={aScores}
        onChange={setAScores}
        accentColor="brand"
      />

      {/* Appendix B */}
      <CriteriaSection
        appendix="B"
        title="Institutional Challenge Linkage & Impact"
        subtitle="الربط بتحديات المؤسسة والأثر"
        criteria={APPENDIX_B_CRITERIA}
        scores={bScores}
        onChange={setBScores}
        accentColor="slate"
      />

      {/* Appendix C */}
      <CriteriaSection
        appendix="C"
        title="Research Excellence"
        subtitle="التميز البحثي"
        criteria={APPENDIX_C_CRITERIA}
        scores={cScores}
        onChange={setCScores}
        accentColor="amber"
      />

      {/* Researcher & Team Judgment */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <h4 className="text-sm font-semibold text-ink-100 flex items-center gap-2">
          <Users size={16} className="text-brand-600" /> Researcher & Team Judgment
        </h4>

        {/* Publication track record + team size */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={14} className="text-brand-600" />
              <span className="text-xs font-semibold text-ink-200">Publication track record</span>
            </div>
            <p className="text-xl font-bold text-ink-50 mb-0.5">
              {matches.length} matches · {avgMatchScore}%
            </p>
            <p className="text-[10px] text-ink-300 leading-snug">
              {matches.length > 0
                ? `Based on ${matches.length} matched publication${matches.length !== 1 ? 's' : ''}. Principal investigator: ${proposal.author}.`
                : 'No matched publications found for this proposal.'}
            </p>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users size={14} className="text-slate-600" />
              <span className="text-xs font-semibold text-ink-200">Topic & team size</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="number" min={1} max={50} value={teamSize}
                onChange={(e) => setTeamSize(Math.max(1, parseInt(e.target.value) || 1))}
                className="glass-input rounded-lg px-2 py-1 text-lg font-bold text-ink-50 w-20 text-center"
              />
              <span className="text-sm text-ink-300">researchers</span>
            </div>
            <p className="text-[10px] text-ink-300">{proposal.research_area ?? 'No area specified'}</p>
          </div>
        </div>

        {/* Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <JudgmentSlider label="Team scientific capacity" value={scientificCapacity} onChange={setScientificCapacity} />
          <JudgmentSlider label="Principal investigator leadership" value={leadership} onChange={setLeadership} />
        </div>

        {/* Recommendation */}
        <div>
          <p className="text-xs text-ink-300 mb-2">General funding recommendation</p>
          <div className="flex gap-2">
            <button
              onClick={() => setRecommendation('recommend')}
              className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium transition-all ${
                recommendation === 'recommend'
                  ? 'bg-brand-500/20 text-brand-700 ring-1 ring-brand-400/40'
                  : 'glass text-ink-200 hover:text-ink-50'
              }`}
            >
              <CheckCircle2 size={15} /> Recommend (Yes)
            </button>
            <button
              onClick={() => setRecommendation('do_not_fund')}
              className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium transition-all ${
                recommendation === 'do_not_fund'
                  ? 'bg-rose-500/20 text-rose-600 ring-1 ring-rose-400/40'
                  : 'glass text-ink-200 hover:text-ink-50'
              }`}
            >
              <XCircle size={15} /> Do not fund (No)
            </button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <p className="text-xs text-ink-300 mb-2">Evaluator notes</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="glass-input rounded-xl px-3 py-2 text-sm w-full resize-none"
            placeholder="Recommendations, conditions, and other remarks..."
          />
        </div>

        {/* Summary */}
        <div className="border-t border-ink-700/20 pt-3">
          <p className="text-xs text-ink-300">
            <span className="font-medium text-ink-200">Summary:</span>{' '}
            Overall criteria score {overallPct}%, publication match {avgMatchScore}%,{' '}
            funding decision {recommendation === 'recommend' ? 'recommended' : recommendation === 'do_not_fund' ? 'not recommended' : 'pending'}.
          </p>
        </div>
      </div>

      {error && (
        <div className="glass rounded-xl p-3 flex items-start gap-2 text-sm text-rose-600 border border-rose-400/30">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={onBack} className="glass-card rounded-xl px-4 py-2 text-sm text-ink-200 hover:text-ink-50 flex items-center gap-2">
          <ArrowLeft size={14} /> Back to Report
        </button>
        <button onClick={handleSave} disabled={saving} className="btn-solid rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {saving ? 'Saving...' : 'Submit Evaluation'}
        </button>
      </div>
    </div>
  );
}

function CriteriaSection({ appendix, title, subtitle, criteria, scores, onChange, accentColor }: {
  appendix: string;
  title: string;
  subtitle: string;
  criteria: string[];
  scores: number[];
  onChange: (scores: number[]) => void;
  accentColor: 'brand' | 'slate' | 'amber';
}) {
  const colorMap = { brand: 'text-brand-600', slate: 'text-slate-600', amber: 'text-amber-600' };
  const dotColorMap = { brand: 'bg-brand-500', slate: 'bg-slate-500', amber: 'bg-amber-500' };
  const ringColorMap = { brand: 'bg-brand-500/20 text-brand-700 ring-brand-400/30', slate: 'bg-slate-500/20 text-slate-700 ring-slate-400/30', amber: 'bg-amber-500/20 text-amber-700 ring-amber-400/30' };

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-ink-700/20">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${colorMap[accentColor]} mb-0.5`}>Appendix {appendix}</p>
        <h4 className="text-sm font-bold text-ink-50">{title}</h4>
        <p className="text-[10px] text-ink-400 mt-0.5">{subtitle}</p>
      </div>

      {/* Criteria rows */}
      <div className="px-5 py-3 space-y-0 divide-y divide-ink-700/10">
        {criteria.map((item, i) => {
          const score = scores[i];
          const pct = ((score - 1) / 9) * 100;
          return (
            <div key={item} className="flex items-center gap-3 py-2.5 group">
              <span className="text-[11px] text-ink-400 w-4 flex-shrink-0 font-medium">{i + 1}</span>
              <span className="text-xs text-ink-200 flex-1 leading-snug">{item}</span>
              {/* Dot-on-track */}
              <div className="relative flex items-center w-32 flex-shrink-0 cursor-pointer">
                <div className="w-full h-0.5 bg-ink-600/40 rounded-full" />
                <div
                  className={`absolute w-3 h-3 rounded-full ${dotColorMap[accentColor]} ring-2 ring-white/10 shadow-md transition-all`}
                  style={{ left: `calc(${pct}% - 6px)` }}
                />
                <input
                  type="range" min={1} max={10} step={1} value={score}
                  onChange={(e) => { const next = [...scores]; next[i] = parseInt(e.target.value); onChange(next); }}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer h-5"
                />
              </div>
              {/* Score circle */}
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ring-1 ${ringColorMap[accentColor]} flex-shrink-0`}>
                {score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JudgmentSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const pct = ((value - 1) / 9) * 100;
  return (
    <div className="glass rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-ink-200">{label}</span>
        <span className="text-sm font-bold text-ink-50">{value}/10</span>
      </div>
      <div className="relative flex items-center">
        <div className="w-full h-1 bg-ink-600/40 rounded-full" />
        <div
          className="absolute w-3 h-3 rounded-full bg-brand-500 ring-2 ring-white/10 shadow-md"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
        <input
          type="range" min={1} max={10} step={1} value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-5"
        />
      </div>
    </div>
  );
}

function OverviewBand({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${color}`}>{score}<span className="text-sm text-ink-300">/{max}</span></p>
      <p className="text-[9px] text-ink-400 uppercase tracking-wider leading-tight max-w-[110px]">{label}</p>
    </div>
  );
}

function ScoreBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-ink-300">{label}</span>
        <span className="text-[10px] font-semibold text-ink-100">{count}</span>
      </div>
      <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ReviewField({ icon: Icon, label, children }: { icon: typeof FileText; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-ink-300 mb-1.5 block flex items-center gap-1.5"><Icon size={12} /> {label}</label>
      {children}
    </div>
  );
}
