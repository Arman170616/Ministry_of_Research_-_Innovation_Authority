import { useRef } from 'react';
import {
  FileText, Printer, Sparkles, CheckCircle2, AlertCircle, XCircle, Users, Target, Trophy, MessageSquare,
} from 'lucide-react';
import type { Evaluation, Proposal } from '@/lib/types';
import { APPENDICES, overallPercent, percent, verdict, TONE_CLASSES, alignedPillars, type Scores } from '@/lib/criteria';
import { formatCurrency, formatDate, OMAN_VISION_PILLARS } from '@/lib/utils';
import { ScoreRing } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

export type ReportEvaluation = Pick<
  Evaluation,
  'a_scores' | 'b_scores' | 'c_scores' | 'scientific_capacity' | 'leadership' | 'team_size' | 'recommendation' | 'evaluator_notes' | 'ai_assessment'
> & { updated_at?: string };

/**
 * The matching report: how well a proposal meets the evaluation criteria.
 * Used at the end of the upload flow, on the Ranking page and in proposal details.
 */
export function MatchingReport({ proposal, evaluation, rank, totalRanked }: {
  proposal: Proposal;
  evaluation: ReportEvaluation;
  rank?: number;
  totalRanked?: number;
}) {
  const { t, lang } = useI18n();
  const ref = useRef<HTMLDivElement>(null);

  const scores: Scores = { a: evaluation.a_scores, b: evaluation.b_scores, c: evaluation.c_scores };
  const overall = overallPercent(scores);
  const v = verdict(overall);
  const ai = evaluation.ai_assessment ?? {};
  const pillars = alignedPillars(proposal.keywords ?? []);
  const sep = lang === 'ar' ? '، ' : ', ';

  return (
    <div ref={ref} className="space-y-5 report">
      {/* Title */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] text-brand font-semibold tracking-widest uppercase mb-1">{t('Matching Report')}</p>
          <h3 className="text-lg font-bold text-ink-50 leading-snug" dir="auto">{proposal.title}</h3>
          <p className="text-xs text-ink-300 mt-1" dir="auto">
            {[proposal.author, proposal.institution, proposal.research_area ? t(proposal.research_area) : null, formatDate(proposal.publication_date)]
              .filter(Boolean).join(' · ')}
          </p>
        </div>
        <button
          onClick={() => ref.current && printElement(ref.current, t('Matching Report'))}
          className="no-print btn-liquid rounded-xl px-3 py-2 text-xs font-medium flex items-center gap-1.5 flex-shrink-0"
        >
          <Printer size={14} /> {t('Print')}
        </button>
      </div>

      {/* Score summary */}
      <div className="glass-card rounded-2xl p-5 flex flex-wrap items-center gap-6">
        <ScoreRing score={overall} size={96} />
        <div className="flex-1 min-w-[200px] space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${TONE_CLASSES[v.tone]}`}>{t(v.label)}</span>
            {evaluation.recommendation && (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 flex items-center gap-1 ${
                evaluation.recommendation === 'recommend' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'
              }`}>
                {evaluation.recommendation === 'recommend' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                {evaluation.recommendation === 'recommend' ? t('Recommended for funding') : t('Not recommended for funding')}
              </span>
            )}
            {rank !== undefined && (
              <span className="rounded-full px-3 py-1 text-xs font-semibold ring-1 bg-white text-ink-100 ring-slate-200 flex items-center gap-1">
                <Trophy size={12} className="text-amber-500" />
                {totalRanked ? t('Rank {rank} of {total}', { rank, total: totalRanked }) : t('Rank {rank}', { rank })}
              </span>
            )}
          </div>
          <p className="text-sm text-ink-200">
            {t('The proposal meets {score}% of the evaluation criteria.', { score: overall })}
          </p>
          <p className="text-xs text-ink-300">
            {t('Funding requested: {amount}', { amount: formatCurrency(proposal.funding_requested) })}
          </p>
        </div>
      </div>

      {/* Appendix scores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {APPENDICES.map((ap) => {
          const s = scores[ap.key];
          const pct = percent(s);
          return (
            <div key={ap.key} className="glass-card rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400">{t('Appendix {letter}', { letter: ap.letter })}</p>
              <p className="text-xs font-semibold text-ink-100 mt-0.5 min-h-[2rem]">{t(ap.title)}</p>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold text-ink-50">{pct}%</span>
                <span className="text-[11px] text-ink-300" dir="ltr">{s.reduce((x, y) => x + y, 0)}/{s.length * 10}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-2">
                <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* AI summary */}
      {(ai.summary || ai.strengths?.length || ai.weaknesses?.length) ? (
        <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-4 space-y-3">
          <p className="text-xs font-semibold text-ink-100 flex items-center gap-1.5"><Sparkles size={14} className="text-brand" /> {t('AI assessment summary')}</p>
          {ai.summary && <p className="text-xs text-ink-200 leading-relaxed" dir="auto">{ai.summary}</p>}
          <div className="grid md:grid-cols-2 gap-3">
            {!!ai.strengths?.length && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mb-1">{t('Strengths')}</p>
                <ul className="space-y-1">{ai.strengths.map((s) => <li key={s} dir="auto" className="text-xs text-ink-200 flex gap-1.5"><CheckCircle2 size={12} className="text-emerald-600 mt-0.5 flex-shrink-0" />{s}</li>)}</ul>
              </div>
            )}
            {!!ai.weaknesses?.length && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-700 mb-1">{t('Weaknesses')}</p>
                <ul className="space-y-1">{ai.weaknesses.map((s) => <li key={s} dir="auto" className="text-xs text-ink-200 flex gap-1.5"><AlertCircle size={12} className="text-brand mt-0.5 flex-shrink-0" />{s}</li>)}</ul>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Criterion by criterion */}
      {APPENDICES.map((ap) => (
        <div key={ap.key} className="glass-card rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-ink-50">
              <span className="text-ink-400 me-1.5">{t('Appendix {letter}', { letter: ap.letter })}</span>{t(ap.title)}
            </p>
            <span className="text-xs font-semibold text-ink-200">{percent(scores[ap.key])}%</span>
          </div>
          <div className="divide-y divide-slate-100">
            {ap.criteria.map((c, i) => {
              const score = scores[ap.key][i] ?? 0;
              const reason = ai[ap.key]?.[i]?.reason;
              return (
                <div key={c} className="px-4 py-2.5 flex items-start gap-3">
                  <span className="text-[11px] text-ink-400 w-4 flex-shrink-0 pt-0.5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-ink-100">{t(c)}</p>
                    {reason && <p className="text-[11px] text-ink-300 mt-0.5 leading-snug" dir="auto">{reason}</p>}
                  </div>
                  <ScorePill score={score} />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Team + Vision 2040 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold text-ink-100 mb-3 flex items-center gap-1.5"><Users size={14} className="text-brand-600" /> {t('Researcher & Team Judgment')}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat value={String(evaluation.team_size)} label={t('researchers')} />
            <Stat value={`${evaluation.scientific_capacity}/10`} label={t('Team scientific capacity')} />
            <Stat value={`${evaluation.leadership}/10`} label={t('Principal investigator leadership')} />
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold text-ink-100 mb-3 flex items-center gap-1.5"><Target size={14} className="text-brand-600" /> {t('Oman Vision 2040')}</p>
          {pillars.length === 0 ? (
            <p className="text-xs text-ink-400">{t('No direct pillar alignment detected')}</p>
          ) : (
            <p className="text-xs text-ink-200">{pillars.map((p) => t(p)).join(sep)}</p>
          )}
          <p className="text-[10px] text-ink-400 mt-2">{t('{count} of {total} strategic pillars aligned', { count: pillars.length, total: OMAN_VISION_PILLARS.length })}</p>
        </div>
      </div>

      {evaluation.evaluator_notes && (
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold text-ink-100 mb-2 flex items-center gap-1.5"><MessageSquare size={14} className="text-brand-600" /> {t('Evaluator notes')}</p>
          <p className="text-xs text-ink-200 leading-relaxed whitespace-pre-line" dir="auto">{evaluation.evaluator_notes}</p>
        </div>
      )}

      <p className="text-[10px] text-ink-400 flex items-center gap-1.5">
        <FileText size={11} />
        {ai.model ? t('Assessed by AI ({model}) and reviewed by a person.', { model: ai.model }) : t('Scored by a reviewer.')}
        {evaluation.updated_at && <> · {formatDate(evaluation.updated_at)}</>}
      </p>
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const color = score >= 9 ? 'bg-emerald-100 text-emerald-700' : score >= 7 ? 'bg-sky-100 text-sky-700' : score >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';
  return <span className={`flex-shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold ${color}`} dir="ltr">{score}/10</span>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="glass rounded-xl p-2.5">
      <p className="text-lg font-bold text-ink-50" dir="ltr">{value}</p>
      <p className="text-[10px] text-ink-300 leading-tight">{label}</p>
    </div>
  );
}

/** Print one element: copy it with the page's styles into a hidden frame and print that. */
function printElement(el: HTMLElement, title: string) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) return;
  const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((n) => n.outerHTML).join('');
  const root = document.documentElement;
  doc.open();
  doc.write(`<!doctype html><html lang="${root.lang}" dir="${root.dir}"><head><meta charset="utf-8"><title>${title}</title>${styles}
<style>body{background:#fff;padding:24px}.no-print{display:none!important}.glass-card,.glass{box-shadow:none!important}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${el.outerHTML}</body></html>`);
  doc.close();
  const go = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  };
  // Give stylesheets and fonts a moment to load.
  setTimeout(go, 400);
}
