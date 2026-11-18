import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload, FileText, X, ArrowRight, ArrowLeft, Check, Sparkles, Loader2, FileCheck2,
  User, Mail, Building2, Calendar, DollarSign, Tag, ClipboardList, ClipboardCheck,
  Users, AlertCircle, ChevronRight, CheckCircle2, XCircle, BarChart3, RotateCw, Plus, Clock,
} from 'lucide-react';
import type { Proposal, Evaluation, EvaluationSuggestion, CriterionSuggestion } from '@/lib/types';
import { createProposal, updateProposal, saveEvaluation, extractDocument, assessProposal, type NewProposal } from '@/lib/hooks';
import { APPENDICES, SCORE_SCALE, defaultScores, overallPercent, percent, verdict, TONE_CLASSES, type Scores } from '@/lib/criteria';
import { RESEARCH_AREAS } from '@/lib/utils';
import { MatchingReport } from '@/components/MatchingReport';
import { useI18n, type Lang } from '@/lib/i18n';

const MAX_FILES = 10;
const MAX_BYTES = 15 * 1024 * 1024;

interface Details {
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

/** The reviewer's working scores for one proposal (starts from the AI assessment). */
interface Draft {
  scores: Scores;
  scientific_capacity: number;
  leadership: number;
  team_size: number;
  recommendation: 'recommend' | 'do_not_fund' | '';
  notes: string;
}

type ItemStatus = 'queued' | 'reading' | 'assessing' | 'ready' | 'saved' | 'invalid';

interface Item {
  id: string;
  file: File;
  status: ItemStatus;
  error: string | null;
  details: Details;
  documentText: string;
  readInfo: { ok: boolean; message: string; missing: string[] } | null;
  assessment: EvaluationSuggestion | null;
  assessError: string | null;
  draft: Draft;
  proposal: Proposal | null;
  evaluation: Evaluation | null;
}

type Phase = 'upload' | 'list' | 'assessment' | 'review' | 'report';

const STEPS: { key: Phase; label: string; icon: typeof Upload }[] = [
  { key: 'upload', label: 'Upload', icon: Upload },
  { key: 'list', label: 'Reading', icon: FileText },
  { key: 'assessment', label: 'Assessment', icon: ClipboardCheck },
  { key: 'review', label: 'Review', icon: ClipboardList },
  { key: 'report', label: 'Matching Report', icon: BarChart3 },
];

let nextId = 0;

function titleFromFile(name: string) {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

function emptyDraft(): Draft {
  return { scores: defaultScores(), scientific_capacity: 5, leadership: 5, team_size: 1, recommendation: '', notes: '' };
}

function draftFrom(sg: EvaluationSuggestion, notes = ''): Draft {
  return {
    scores: { a: sg.a.map((x) => x.score), b: sg.b.map((x) => x.score), c: sg.c.map((x) => x.score) },
    scientific_capacity: sg.scientific_capacity,
    leadership: sg.leadership,
    team_size: sg.team_size,
    recommendation: sg.recommendation ?? '',
    notes: notes || sg.summary,
  };
}

function newItem(file: File): Item {
  const ext = file.name.toLowerCase().split('.').pop();
  const error = ext !== 'pdf' && ext !== 'txt'
    ? 'Please upload a PDF or TXT file.'
    : file.size > MAX_BYTES ? 'The file is larger than 15 MB.' : null;
  return {
    id: `f${nextId++}`,
    file,
    status: error ? 'invalid' : 'queued',
    error,
    details: {
      title: titleFromFile(file.name), author: '', author_email: '', institution: '', research_area: '',
      abstract: '', funding_requested: '', publication_date: '', keywords: '',
    },
    documentText: '',
    readInfo: null,
    assessment: null,
    assessError: null,
    draft: emptyDraft(),
    proposal: null,
    evaluation: null,
  };
}

function keywordList(details: Details) {
  return details.keywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
}

export function ProposalWizard({ open, onClose }: {
  open: boolean;
  /** Called when the wizard closes, with how many proposals were saved. */
  onClose: (saved: number) => void;
}) {
  const { t, lang } = useI18n();
  const [phase, setPhase] = useState<Phase>('upload');
  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  // Items removed or abandoned while being processed; their results are dropped.
  const alive = useRef(new Set<string>());

  const active = items.find((i) => i.id === activeId) ?? null;

  const patch = useCallback((id: string, changes: Partial<Item> | ((item: Item) => Partial<Item>)) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...(typeof changes === 'function' ? changes(i) : changes) } : i)));
  }, []);

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    const room = MAX_FILES - items.filter((i) => i.status !== 'invalid').length;
    if (list.length > room) setNotice(t('You can upload up to {max} proposals at a time. Extra files were left out.', { max: MAX_FILES }));
    else setNotice(null);
    const added = list.slice(0, Math.max(0, room)).map(newItem);
    added.forEach((i) => alive.current.add(i.id));
    setItems((cur) => [...cur, ...added]);
  };

  const removeItem = (id: string) => {
    alive.current.delete(id);
    setItems((cur) => cur.filter((i) => i.id !== id));
  };

  const reset = () => {
    alive.current.clear();
    setItems([]);
    setPhase('upload');
    setActiveId(null);
    setNotice(null);
  };

  const savedCount = items.filter((i) => i.status === 'saved').length;
  const unsaved = items.filter((i) => i.status === 'ready' || i.status === 'reading' || i.status === 'assessing' || i.status === 'queued').length;

  const handleClose = () => {
    if (phase !== 'upload' && unsaved > 0 && !window.confirm(t('{count} proposals are not saved yet. Close anyway?', { count: unsaved }))) return;
    const saved = savedCount;
    reset();
    onClose(saved);
  };

  // Ask the AI to assess one item against the criteria.
  const runAssessment = useCallback(async (item: Item, language: Lang) => {
    patch(item.id, { status: 'assessing', assessError: null });
    const d = item.details;
    try {
      const sg = await assessProposal({
        title: d.title,
        author: d.author,
        institution: d.institution,
        research_area: d.research_area,
        funding_requested: d.funding_requested ? parseFloat(d.funding_requested) || 0 : 0,
        keywords: keywordList(d),
        abstract: d.abstract,
        document_text: item.documentText,
      }, language);
      if (!alive.current.has(item.id)) return;
      patch(item.id, (cur) => ({ status: 'ready', assessment: sg, draft: draftFrom(sg, cur.draft.notes) }));
    } catch (err) {
      if (!alive.current.has(item.id)) return;
      patch(item.id, { status: 'ready', assessError: err instanceof Error ? err.message : 'AI assessment failed.' });
    }
  }, [patch]);

  // Read, then assess, one file at a time.
  const processItem = useCallback(async (item: Item, language: Lang) => {
    patch(item.id, { status: 'reading' });
    let details = item.details;
    let documentText = '';
    try {
      const doc = await extractDocument(item.file);
      documentText = doc.document_text;
      details = {
        title: doc.title || item.details.title,
        author: doc.author,
        author_email: doc.author_email,
        institution: doc.institution,
        research_area: doc.research_area,
        abstract: doc.abstract,
        funding_requested: doc.funding_requested ? String(doc.funding_requested) : '',
        publication_date: doc.publication_date,
        keywords: doc.keywords.join(', '),
      };
      if (!alive.current.has(item.id)) return;
      patch(item.id, {
        details,
        documentText,
        readInfo: {
          ok: doc.is_research_proposal,
          message: doc.is_research_proposal
            ? 'AI read the document and filled in the fields below. Please check them before saving.'
            : 'This file does not look like a research proposal. Please check the fields carefully.',
          missing: doc.missing_fields,
        },
      });
    } catch (err) {
      // Without the document text there is nothing to assess: the reviewer fills in and scores by hand.
      if (!alive.current.has(item.id)) return;
      patch(item.id, {
        status: 'ready',
        readInfo: { ok: false, message: err instanceof Error ? err.message : 'AI reading failed.', missing: [] },
        assessError: 'The document could not be read, so it was not assessed. Score each criterion yourself.',
      });
      return;
    }
    await runAssessment({ ...item, details, documentText }, language);
  }, [patch, runAssessment]);

  useEffect(() => {
    if (phase === 'upload' || busy.current) return;
    const next = items.find((i) => i.status === 'queued');
    if (!next) return;
    busy.current = true;
    processItem(next, lang).finally(() => {
      busy.current = false;
      // Trigger the effect again for the next queued file.
      setItems((cur) => [...cur]);
    });
  }, [items, phase, processItem, lang]);

  // With a single upload, open it as soon as it is ready.
  useEffect(() => {
    if (phase !== 'list') return;
    const valid = items.filter((i) => i.status !== 'invalid');
    if (valid.length === 1 && valid[0].status === 'ready') {
      setActiveId(valid[0].id);
      setPhase('assessment');
    }
  }, [items, phase]);

  const openItem = (item: Item) => {
    setActiveId(item.id);
    setPhase(item.status === 'saved' ? 'report' : 'assessment');
  };

  const backToList = () => { setActiveId(null); setPhase('list'); };
  const multiple = items.filter((i) => i.status !== 'invalid').length > 1;

  if (!open) return null;

  const stepIndex = STEPS.findIndex((s) => s.key === phase);

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
              <h2 className="text-lg font-semibold text-ink-50">{t('Upload & Assess Proposals')}</h2>
              <p className="text-xs text-ink-300">{t('Upload one or more proposals — AI reads and assesses each against the criteria')}</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-ink-200 hover:text-ink-50 text-2xl leading-none" aria-label={t('Close')}>&times;</button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === stepIndex;
            const done = i < stepIndex;
            return (
              <div key={s.key} className="flex items-center gap-1 flex-shrink-0">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive ? 'glass-strong text-brand ring-1 ring-brand-400/30' : done ? 'text-emerald-600' : 'text-ink-400'
                }`}>
                  <Icon size={14} />
                  <span>{t(s.label)}</span>
                  {done && <Check size={12} className="text-emerald-600" />}
                </div>
                {i < STEPS.length - 1 && <ChevronRight size={14} className="text-ink-400 flex-shrink-0 rtl:-scale-x-100" />}
              </div>
            );
          })}
        </div>

        {/* Which proposal is open (when there are several) */}
        {active && multiple && (
          <div className="glass rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2">
            <button onClick={backToList} className="text-xs text-brand hover:text-brand-700 flex items-center gap-1 flex-shrink-0">
              <ArrowLeft size={12} className="rtl:-scale-x-100" /> {t('All uploads')}
            </button>
            <span className="text-ink-400">·</span>
            <span className="text-xs text-ink-200 truncate" dir="auto">{active.details.title || active.file.name}</span>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
        />

        {notice && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-4 text-xs text-amber-800 flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> <span>{notice}</span>
          </div>
        )}

        {/* 1. Upload */}
        {phase === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={`glass-card rounded-2xl p-10 text-center cursor-pointer transition-all border-2 border-dashed ${
                dragOver ? 'border-brand-400/50 bg-brand-500/5' : 'border-ink-700/30 hover:border-brand-400/30'
              }`}
            >
              <div className="w-16 h-16 rounded-2xl glass mx-auto mb-4 flex items-center justify-center">
                <Upload size={28} className="text-brand" />
              </div>
              <p className="text-sm text-ink-100 font-medium mb-1">{t('Drop proposal documents here')}</p>
              <p className="text-xs text-ink-300">{t('or click to browse — PDF or TXT, up to 15 MB each, {max} files at a time', { max: MAX_FILES })}</p>
            </div>

            {items.length > 0 && (
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="glass rounded-xl p-3 flex items-center gap-3">
                    <div className="glass rounded-lg p-2">
                      <FileCheck2 size={16} className={item.status === 'invalid' ? 'text-rose-500' : 'text-brand-600'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-100 truncate" dir="auto">{item.file.name}</p>
                      <p className={`text-xs ${item.error ? 'text-rose-600' : 'text-ink-300'}`}>
                        {item.error ? t(item.error) : `${(item.file.size / 1024).toFixed(0)} KB`}
                      </p>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="text-ink-300 hover:text-rose-500" aria-label={t('Remove')}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => { setItems((cur) => cur.filter((i) => i.status !== 'invalid')); setNotice(null); setPhase('list'); }}
                disabled={!items.some((i) => i.status === 'queued')}
                className="btn-solid rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
              >
                {t('Start assessment ({count})', { count: items.filter((i) => i.status === 'queued').length })}
                <ArrowRight size={16} className="rtl:-scale-x-100" />
              </button>
            </div>
          </div>
        )}

        {/* 2. Upload list with progress */}
        {phase === 'list' && (
          <UploadList
            items={items}
            onOpen={openItem}
            onRemove={removeItem}
            onAddMore={() => fileInputRef.current?.click()}
            canAddMore={items.length < MAX_FILES}
            onDone={handleClose}
          />
        )}

        {/* 3. Assessment */}
        {phase === 'assessment' && active && (
          <AssessmentStep
            item={active}
            onChange={(draft) => patch(active.id, { draft })}
            onRetry={() => runAssessment(active, lang)}
            onBack={multiple ? backToList : null}
            onContinue={() => setPhase('review')}
          />
        )}

        {/* 4. Review */}
        {phase === 'review' && active && (
          <ReviewStep
            item={active}
            onDetails={(details) => patch(active.id, { details })}
            onDraft={(draft) => patch(active.id, { draft })}
            onBack={() => setPhase('assessment')}
            onSaved={(proposal, evaluation) => { patch(active.id, { status: 'saved', proposal, evaluation }); setPhase('report'); }}
            onProposalCreated={(proposal) => patch(active.id, { proposal })}
          />
        )}

        {/* 5. Matching report */}
        {phase === 'report' && active?.proposal && active.evaluation && (
          <div className="space-y-5">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 size={14} /> {t('Saved. The proposal now appears in Proposals and Ranking.')}
            </div>
            <MatchingReport proposal={active.proposal} evaluation={active.evaluation} />
            <div className="flex justify-between gap-3">
              {multiple ? (
                <button onClick={backToList} className="glass-card rounded-xl px-4 py-2 text-sm text-ink-200 hover:text-ink-50 flex items-center gap-2">
                  <ArrowLeft size={14} className="rtl:-scale-x-100" /> {t('All uploads')}
                </button>
              ) : <span />}
              {(() => {
                const next = items.find((i) => i.status === 'ready' && i.id !== active.id);
                return next ? (
                  <button onClick={() => openItem(next)} className="btn-solid rounded-xl px-6 py-2.5 text-sm font-semibold flex items-center gap-2">
                    {t('Next proposal')} <ArrowRight size={14} className="rtl:-scale-x-100" />
                  </button>
                ) : (
                  <button onClick={handleClose} className="btn-solid rounded-xl px-6 py-2.5 text-sm font-semibold flex items-center gap-2">
                    <Check size={16} /> {t('Done')}
                  </button>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Upload list ─────────────────────────────────────────────

function UploadList({ items, onOpen, onRemove, onAddMore, canAddMore, onDone }: {
  items: Item[];
  onOpen: (item: Item) => void;
  onRemove: (id: string) => void;
  onAddMore: () => void;
  canAddMore: boolean;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const finished = items.filter((i) => i.status === 'ready' || i.status === 'saved').length;
  const saved = items.filter((i) => i.status === 'saved').length;
  const working = items.some((i) => i.status === 'queued' || i.status === 'reading' || i.status === 'assessing');

  const statusView = (item: Item) => {
    switch (item.status) {
      case 'queued': return { icon: <Clock size={14} className="text-ink-400" />, text: t('Waiting') };
      case 'reading': return { icon: <Loader2 size={14} className="text-brand animate-spin" />, text: t('AI is reading the document...') };
      case 'assessing': return { icon: <Loader2 size={14} className="text-brand animate-spin" />, text: t('AI is assessing against the criteria...') };
      case 'ready': return item.assessment
        ? { icon: <Sparkles size={14} className="text-brand" />, text: t('Assessed — ready for review') }
        : { icon: <AlertCircle size={14} className="text-amber-600" />, text: t('Not assessed — score by hand') };
      case 'saved': return { icon: <CheckCircle2 size={14} className="text-emerald-600" />, text: t('Reviewed and saved') };
      default: return { icon: <XCircle size={14} className="text-rose-500" />, text: item.error ? t(item.error) : '' };
    }
  };

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-ink-50">{t('{done} of {total} ready', { done: finished, total: items.length })}</p>
          {working && <p className="text-xs text-ink-300">{t('About 30–60 seconds per proposal')}</p>}
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${items.length ? (finished / items.length) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const sv = statusView(item);
          const canOpen = item.status === 'ready' || item.status === 'saved';
          const score = item.status === 'saved' && item.evaluation ? item.evaluation.score : item.assessment ? overallPercent(item.draft.scores) : null;
          return (
            <div key={item.id} className="glass-card rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 flex-shrink-0 text-center">
                {score !== null ? <span className="text-lg font-bold text-ink-50">{score}%</span> : <FileText size={20} className="text-ink-400 mx-auto" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-50 truncate" dir="auto">{item.details.title || item.file.name}</p>
                <p className="text-xs text-ink-300 truncate" dir="auto">{item.file.name}</p>
                <p className="text-xs text-ink-300 mt-1 flex items-center gap-1.5">{sv.icon} {sv.text}</p>
              </div>
              {canOpen && (
                <button onClick={() => onOpen(item)} className={`${item.status === 'saved' ? 'btn-liquid' : 'btn-solid'} rounded-xl px-4 py-2 text-xs font-semibold flex-shrink-0`}>
                  {item.status === 'saved' ? t('View report') : t('Review')}
                </button>
              )}
              {(item.status === 'queued' || item.status === 'ready') && (
                <button onClick={() => onRemove(item.id)} className="text-ink-300 hover:text-rose-500 flex-shrink-0" aria-label={t('Remove')}>
                  <X size={16} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between">
        {canAddMore ? (
          <button onClick={onAddMore} className="btn-liquid rounded-xl px-4 py-2 text-sm font-medium flex items-center gap-2">
            <Plus size={14} /> {t('Add more files')}
          </button>
        ) : <span />}
        {saved > 0 && !working && (
          <button onClick={onDone} className="btn-solid rounded-xl px-6 py-2.5 text-sm font-semibold flex items-center gap-2">
            <Check size={16} /> {t('Done')}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Assessment ───────────────────────────────────────────────

function AssessmentStep({ item, onChange, onRetry, onBack, onContinue }: {
  item: Item;
  onChange: (draft: Draft) => void;
  onRetry: () => void;
  onBack: (() => void) | null;
  onContinue: () => void;
}) {
  const { t, isRTL } = useI18n();
  const { draft, assessment: sg } = item;
  const assessing = item.status === 'assessing';
  const overall = overallPercent(draft.scores);
  const v = verdict(overall);

  const setScores = (key: keyof Scores) => (scores: number[]) => onChange({ ...draft, scores: { ...draft.scores, [key]: scores } });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] text-brand font-semibold tracking-widest uppercase mb-1">{t('Assessment')}</p>
        <h3 className="text-xl font-bold text-ink-50">{t('Assessment against the criteria')}</h3>
        <p className="text-xs text-ink-300 mt-1">{t('AI scored each criterion on a 1–10 scale with a reason. Check the scores and adjust any you disagree with.')}</p>
      </div>

      {/* AI result */}
      <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-white ring-1 ring-brand-200 flex items-center justify-center flex-shrink-0">
            {assessing ? <Loader2 size={16} className="text-brand animate-spin" /> : <Sparkles size={16} className="text-brand" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-50">{t('AI assessment')}</p>
            {assessing && <p className="text-xs text-ink-300 mt-0.5">{t('AI is reading the full proposal and scoring each criterion. This takes about 30–90 seconds.')}</p>}
            {!assessing && item.assessError && (
              <div className="mt-1 text-xs">
                <p className="text-brand-700">{t(item.assessError)}</p>
                {item.documentText && (
                  <button onClick={onRetry} className="mt-2 btn-liquid rounded-lg px-3 py-1 text-xs font-medium flex items-center gap-1.5">
                    <RotateCw size={12} /> {t('Try again')}
                  </button>
                )}
              </div>
            )}
            {!assessing && sg && (
              <div className="mt-1 space-y-2">
                <p className="text-xs text-ink-200 leading-relaxed" dir="auto">{sg.summary}</p>
                <div className="grid md:grid-cols-2 gap-3">
                  {sg.strengths.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mb-1">{t('Strengths')}</p>
                      <ul className="space-y-1">{sg.strengths.map((s) => <li key={s} dir="auto" className="text-xs text-ink-200 flex gap-1.5"><CheckCircle2 size={12} className="text-emerald-600 mt-0.5 flex-shrink-0" />{s}</li>)}</ul>
                    </div>
                  )}
                  {sg.weaknesses.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-700 mb-1">{t('Weaknesses')}</p>
                      <ul className="space-y-1">{sg.weaknesses.map((s) => <li key={s} dir="auto" className="text-xs text-ink-200 flex gap-1.5"><AlertCircle size={12} className="text-brand mt-0.5 flex-shrink-0" />{s}</li>)}</ul>
                    </div>
                  )}
                </div>
                <p className="text-xs text-ink-300">
                  {t('AI recommendation:')} <span className="font-semibold text-ink-100">{sg.recommendation === 'recommend' ? t('Recommend') : sg.recommendation === 'do_not_fund' ? t('Do not fund') : '—'}</span>
                </p>
                <p className="text-[10px] text-ink-400">{t('These are suggestions only. Adjust any score before you submit; the final evaluation is yours.')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scale */}
      <div className="glass-card rounded-2xl p-4">
        <p className="text-[10px] text-ink-300 font-semibold uppercase tracking-wider mb-3">{t('Scoring scale (applies to every criterion)')}</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {SCORE_SCALE.map((s) => (
            <div key={s.range} className="glass rounded-xl p-2.5">
              <p className="text-sm font-bold text-ink-50 mb-1" dir="ltr">{s.range}</p>
              <p className="text-[10px] text-ink-300 leading-tight">{t(s.label)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Overview */}
      <div className="glass-card rounded-2xl p-4 flex items-center gap-6 flex-wrap">
        <div>
          <p className="text-3xl font-bold text-ink-50">{overall}%</p>
          <p className="text-[10px] text-ink-300 uppercase tracking-wider">{t('Overall Score')}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${TONE_CLASSES[v.tone]}`}>{t(v.label)}</span>
        <div className="flex flex-wrap gap-5 ms-auto">
          {APPENDICES.map((ap) => (
            <div key={ap.key} className="text-center">
              <p className="text-xl font-bold text-ink-100">{percent(draft.scores[ap.key])}%</p>
              <p className="text-[9px] text-ink-400 uppercase tracking-wider leading-tight max-w-[120px]">{t(ap.title)}</p>
            </div>
          ))}
        </div>
      </div>

      {APPENDICES.map((ap) => (
        <CriteriaSection
          key={ap.key}
          appendix={ap.letter}
          title={t(ap.title)}
          subtitle={isRTL ? ap.title : ap.arabic}
          criteria={ap.criteria}
          scores={draft.scores[ap.key]}
          onChange={setScores(ap.key)}
          suggestions={sg?.[ap.key]}
        />
      ))}

      <div className="flex justify-between">
        {onBack ? (
          <button onClick={onBack} className="glass-card rounded-xl px-4 py-2 text-sm text-ink-200 hover:text-ink-50 flex items-center gap-2">
            <ArrowLeft size={14} className="rtl:-scale-x-100" /> {t('All uploads')}
          </button>
        ) : <span />}
        <button onClick={onContinue} disabled={assessing} className="btn-solid rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
          {t('Continue to Review')} <ArrowRight size={14} className="rtl:-scale-x-100" />
        </button>
      </div>
    </div>
  );
}

// ─── Review ───────────────────────────────────────────────────

function ReviewStep({ item, onDetails, onDraft, onBack, onSaved, onProposalCreated }: {
  item: Item;
  onDetails: (details: Details) => void;
  onDraft: (draft: Draft) => void;
  onBack: () => void;
  onSaved: (proposal: Proposal, evaluation: Evaluation) => void;
  onProposalCreated: (proposal: Proposal) => void;
}) {
  const { t, lang } = useI18n();
  const { details: d, draft } = item;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overall = overallPercent(draft.scores);
  const set = (changes: Partial<Details>) => onDetails({ ...d, ...changes });
  const setDraft = (changes: Partial<Draft>) => onDraft({ ...draft, ...changes });

  const handleSave = async () => {
    if (!d.title.trim() || !d.author.trim()) { setError(t('Title and author are required')); return; }
    if (!draft.recommendation) { setError(t('Please select a funding recommendation before submitting.')); return; }
    setSaving(true);
    setError(null);

    const fields: NewProposal = {
      title: d.title.trim(),
      author: d.author.trim(),
      author_email: d.author_email || null,
      institution: d.institution || null,
      research_area: d.research_area || null,
      abstract: d.abstract || null,
      document_url: item.file.name,
      status: 'pending',
      funding_requested: d.funding_requested ? parseFloat(d.funding_requested) || 0 : 0,
      publication_date: d.publication_date || null,
      keywords: keywordList(d),
      document_text: item.documentText,
    };
    // If an earlier attempt saved the proposal but not the evaluation, update it instead of creating a copy.
    const proposal = item.proposal ? await updateProposal(item.proposal.id, fields) : await createProposal(fields);
    if (!proposal) { setSaving(false); setError(t('Failed to save proposal. Check that you are signed in.')); return; }
    onProposalCreated(proposal);

    const evaluation = await saveEvaluation({
      proposal_id: proposal.id,
      a_scores: draft.scores.a,
      b_scores: draft.scores.b,
      c_scores: draft.scores.c,
      scientific_capacity: draft.scientific_capacity,
      leadership: draft.leadership,
      team_size: draft.team_size,
      recommendation: draft.recommendation,
      evaluator_notes: draft.notes || null,
      ai_assessment: item.assessment ?? {},
    });
    setSaving(false);
    if (!evaluation) { setError(t('Failed to save evaluation. Please try again.')); return; }
    onSaved(proposal, evaluation);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] text-brand font-semibold tracking-widest uppercase mb-1">{t('Review')}</p>
        <h3 className="text-xl font-bold text-ink-50">{t('Review details and decide')}</h3>
        <p className="text-xs text-ink-300 mt-1">{t('Check the details the AI read from the document, then record the team judgment and your funding recommendation.')}</p>
      </div>

      {item.readInfo && (
        <div className={`rounded-xl border p-3 text-xs ${item.readInfo.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <div className="flex items-start gap-2">
            {item.readInfo.ok ? <Sparkles size={14} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />}
            <span>{t(item.readInfo.message)}</span>
          </div>
          {item.readInfo.missing.length > 0 && (
            <p className="mt-1.5 ps-6">{t('Not found in the document: {fields}.', { fields: item.readInfo.missing.map((f) => t(f)).join(lang === 'ar' ? '، ' : ', ') })}</p>
          )}
        </div>
      )}

      {/* Details */}
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <h4 className="text-sm font-semibold text-ink-100 flex items-center gap-2"><FileText size={16} className="text-brand-600" /> {t('Proposal details')}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field icon={FileText} label={t('Title *')}>
            <input dir="auto" value={d.title} onChange={(e) => set({ title: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" />
          </Field>
          <Field icon={User} label={t('Author *')}>
            <input dir="auto" value={d.author} onChange={(e) => set({ author: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" />
          </Field>
          <Field icon={Mail} label={t('Email')}>
            <input dir="auto" value={d.author_email} onChange={(e) => set({ author_email: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" placeholder="name@institution.om" />
          </Field>
          <Field icon={Building2} label={t('Institution')}>
            <input dir="auto" value={d.institution} onChange={(e) => set({ institution: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" />
          </Field>
          <Field icon={Tag} label={t('Research Area')}>
            <select value={d.research_area} onChange={(e) => set({ research_area: e.target.value })} className="glass-input glass-select rounded-xl px-3 py-2 text-sm w-full">
              <option value="">{t('Select area...')}</option>
              {RESEARCH_AREAS.map((a) => <option key={a} value={a}>{t(a)}</option>)}
            </select>
          </Field>
          <Field icon={DollarSign} label={t('Funding Requested (OMR)')}>
            <input type="number" min={0} value={d.funding_requested} onChange={(e) => set({ funding_requested: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" />
          </Field>
          <Field icon={Calendar} label={t('Submission Date')}>
            <input type="date" value={d.publication_date} onChange={(e) => set({ publication_date: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" />
          </Field>
          <Field icon={Tag} label={t('Keywords (comma-separated)')}>
            <input dir="auto" value={d.keywords} onChange={(e) => set({ keywords: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" />
          </Field>
        </div>
        <Field icon={FileText} label={t('Abstract')}>
          <textarea dir="auto" value={d.abstract} onChange={(e) => set({ abstract: e.target.value })} rows={3} className="glass-input rounded-xl px-3 py-2 text-sm w-full resize-none" />
        </Field>
      </div>

      {/* Team judgment + decision */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <h4 className="text-sm font-semibold text-ink-100 flex items-center gap-2">
          <Users size={16} className="text-brand-600" /> {t('Researcher & Team Judgment')}
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="glass rounded-xl p-3">
            <p className="text-xs text-ink-200 mb-2">{t('Team size')}</p>
            <div className="flex items-center gap-2">
              <input
                type="number" min={1} max={50} value={draft.team_size}
                onChange={(e) => setDraft({ team_size: Math.max(1, parseInt(e.target.value) || 1) })}
                className="glass-input rounded-lg px-2 py-1 text-lg font-bold text-ink-50 w-20 text-center"
              />
              <span className="text-sm text-ink-300">{t('researchers')}</span>
            </div>
          </div>
          <JudgmentSlider label={t('Team scientific capacity')} value={draft.scientific_capacity} onChange={(v) => setDraft({ scientific_capacity: v })} />
          <JudgmentSlider label={t('Principal investigator leadership')} value={draft.leadership} onChange={(v) => setDraft({ leadership: v })} />
        </div>

        <div>
          <p className="text-xs text-ink-300 mb-2">{t('General funding recommendation')}</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDraft({ recommendation: 'recommend' })}
              className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium transition-all ${
                draft.recommendation === 'recommend' ? 'bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-400/50' : 'glass text-ink-200 hover:text-ink-50'
              }`}
            >
              <CheckCircle2 size={15} /> {t('Recommend (Yes)')}
            </button>
            <button
              onClick={() => setDraft({ recommendation: 'do_not_fund' })}
              className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium transition-all ${
                draft.recommendation === 'do_not_fund' ? 'bg-rose-500/15 text-rose-600 ring-1 ring-rose-400/50' : 'glass text-ink-200 hover:text-ink-50'
              }`}
            >
              <XCircle size={15} /> {t('Do not fund (No)')}
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs text-ink-300 mb-2">{t('Evaluator notes')}</p>
          <textarea
            dir="auto"
            value={draft.notes}
            onChange={(e) => setDraft({ notes: e.target.value })}
            rows={3}
            className="glass-input rounded-xl px-3 py-2 text-sm w-full resize-none"
            placeholder={t('Recommendations, conditions, and other remarks...')}
          />
        </div>

        <div className="border-t border-ink-700/20 pt-3">
          <p className="text-xs text-ink-300">
            <span className="font-medium text-ink-200">{t('Summary:')}</span>{' '}
            {t('Overall criteria score {overall}%, funding decision {decision}.', {
              overall,
              decision: draft.recommendation === 'recommend' ? t('recommended') : draft.recommendation === 'do_not_fund' ? t('not recommended') : t('pending'),
            })}
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
          <ArrowLeft size={14} className="rtl:-scale-x-100" /> {t('Back to Assessment')}
        </button>
        <button onClick={handleSave} disabled={saving} className="btn-solid rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {saving ? t('Saving...') : t('Save & View Report')}
        </button>
      </div>
    </div>
  );
}

// ─── Shared pieces ────────────────────────────────────────────

function CriteriaSection({ appendix, title, subtitle, criteria, scores, onChange, suggestions }: {
  appendix: string;
  title: string;
  subtitle: string;
  criteria: string[];
  scores: number[];
  onChange: (scores: number[]) => void;
  suggestions?: CriterionSuggestion[];
}) {
  const { t } = useI18n();
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-ink-700/20 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600 mb-0.5">{t('Appendix {letter}', { letter: appendix })}</p>
          <h4 className="text-sm font-bold text-ink-50">{title}</h4>
          <p className="text-[10px] text-ink-400 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-sm font-bold text-ink-100">{percent(scores)}%</span>
      </div>
      <div className="px-5 py-3 divide-y divide-ink-700/10">
        {criteria.map((item, i) => {
          const score = scores[i];
          const pct = ((score - 1) / 9) * 100;
          const sg = suggestions?.[i];
          return (
            <div key={item} className="flex items-center gap-3 py-2.5">
              <span className="text-[11px] text-ink-400 w-4 flex-shrink-0 font-medium">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-ink-200 leading-snug">{t(item)}</p>
                {sg && (
                  <p className="mt-1 text-[11px] text-ink-400 leading-snug flex items-start gap-1">
                    <Sparkles size={10} className="text-brand mt-0.5 flex-shrink-0" />
                    <span>
                      <span className="font-semibold text-ink-300">{t('AI {score}/10:', { score: sg.score })}</span>{' '}
                      <span dir="auto">{sg.reason}</span>
                    </span>
                  </p>
                )}
              </div>
              <div className="relative flex items-center w-32 flex-shrink-0 cursor-pointer">
                <div className="w-full h-0.5 bg-ink-600/40 rounded-full" />
                <div className="absolute w-3 h-3 rounded-full bg-brand-500 ring-2 ring-white/10 shadow-md transition-all" style={{ insetInlineStart: `calc(${pct}% - 6px)` }} />
                <input
                  type="range" min={1} max={10} step={1} value={score}
                  aria-label={t(item)}
                  onChange={(e) => { const next = [...scores]; next[i] = parseInt(e.target.value); onChange(next); }}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer h-5"
                />
              </div>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ring-1 flex-shrink-0 ${
                sg && sg.score !== score ? 'bg-amber-100 text-amber-700 ring-amber-300' : 'bg-brand-500/15 text-brand-700 ring-brand-400/30'
              }`} title={sg && sg.score !== score ? t('Changed from the AI score') : undefined}>
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
        <span className="text-sm font-bold text-ink-50" dir="ltr">{value}/10</span>
      </div>
      <div className="relative flex items-center">
        <div className="w-full h-1 bg-ink-600/40 rounded-full" />
        <div className="absolute w-3 h-3 rounded-full bg-brand-500 ring-2 ring-white/10 shadow-md" style={{ insetInlineStart: `calc(${pct}% - 6px)` }} />
        <input
          type="range" min={1} max={10} step={1} value={value}
          aria-label={label}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-5"
        />
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, children }: { icon: typeof FileText; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-ink-300 mb-1.5 flex items-center gap-1.5"><Icon size={12} /> {label}</label>
      {children}
    </div>
  );
}
