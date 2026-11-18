import { useMemo, useState } from 'react';
import { Search, X, Trophy, CheckCircle2, XCircle, FileText, Upload, ClipboardList } from 'lucide-react';
import type { Proposal, Evaluation } from '@/lib/types';
import { rankProposals, verdict, TONE_CLASSES, APPENDICES, type RankedProposal } from '@/lib/criteria';
import { formatCurrency, statusLabel, PROPOSAL_STATUSES, RESEARCH_AREAS } from '@/lib/utils';
import { Modal } from '@/components/ui';
import { MatchingReport } from '@/components/MatchingReport';
import { useI18n } from '@/lib/i18n';

export function Ranking({ proposals, evaluations, onUpload }: {
  proposals: Proposal[];
  evaluations: Evaluation[];
  onUpload: () => void;
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('all');
  const [status, setStatus] = useState('all');
  const [recommendation, setRecommendation] = useState('all');
  const [open, setOpen] = useState<RankedProposal | null>(null);

  const { ranked, unassessed } = useMemo(() => rankProposals(proposals, evaluations), [proposals, evaluations]);

  // Ranks are worked out over all proposals, then filtered, so a proposal keeps its overall rank.
  const rows = ranked.filter(({ proposal: p, evaluation: e }) => {
    if (search) {
      const q = search.toLowerCase();
      if (![p.title, p.author, p.institution ?? ''].some((s) => s.toLowerCase().includes(q))) return false;
    }
    if (area !== 'all' && p.research_area !== area) return false;
    if (status !== 'all' && p.status !== status) return false;
    if (recommendation !== 'all' && e.recommendation !== recommendation) return false;
    return true;
  });

  const filtersOn = search || area !== 'all' || status !== 'all' || recommendation !== 'all';

  return (
    <div className="space-y-5 fade-in">
      {/* Filters */}
      <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 glass-input rounded-xl px-3 py-2 flex-1 min-w-[200px]">
          <Search size={16} className="text-ink-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Search title, author, institution...')}
            className="bg-transparent border-0 outline-none text-sm text-ink-50 placeholder:text-ink-400 flex-1"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-ink-300 hover:text-ink-50" aria-label={t('Clear search')}><X size={14} /></button>
          )}
        </div>
        <select value={area} onChange={(e) => setArea(e.target.value)} className="glass-input glass-select rounded-xl px-3 py-2 text-sm" aria-label={t('Research Area')}>
          <option value="all">{t('All Areas')}</option>
          {RESEARCH_AREAS.map((a) => <option key={a} value={a}>{t(a)}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="glass-input glass-select rounded-xl px-3 py-2 text-sm" aria-label={t('Status')}>
          <option value="all">{t('All Statuses')}</option>
          {PROPOSAL_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
        <select value={recommendation} onChange={(e) => setRecommendation(e.target.value)} className="glass-input glass-select rounded-xl px-3 py-2 text-sm" aria-label={t('Recommendation')}>
          <option value="all">{t('All recommendations')}</option>
          <option value="recommend">{t('Recommended')}</option>
          <option value="do_not_fund">{t('Not recommended')}</option>
        </select>
        <button onClick={onUpload} className="btn-solid rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-2">
          <Upload size={16} /> {t('Upload Proposals')}
        </button>
      </div>

      <p className="text-sm text-ink-300 px-1">
        {t('Ranked by how well each proposal meets the evaluation criteria (overall score).')}{' '}
        {filtersOn && t('Showing {shown} of {total}.', { shown: rows.length, total: ranked.length })}
      </p>

      {/* Ranking */}
      {ranked.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <Trophy size={40} className="text-ink-400 mx-auto mb-3" />
          <p className="text-ink-200">{t('No assessed proposals yet')}</p>
          <p className="text-xs text-ink-400 mt-1">{t('Upload proposals to assess and rank them.')}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center text-ink-300 text-sm">{t('No proposals match your filters')}</div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          {/* Header (wide screens) */}
          <div className="hidden lg:grid grid-cols-[56px_minmax(0,1fr)_150px_280px_110px_130px] gap-4 px-5 py-3 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            <span>{t('Rank')}</span>
            <span>{t('Proposal')}</span>
            <span>{t('Research Area')}</span>
            <span>{t('Criteria match')}</span>
            <span>{t('Score')}</span>
            <span />
          </div>
          <div className="divide-y divide-slate-100">
            {rows.map((r) => {
              const v = verdict(r.score);
              return (
                <div key={r.proposal.id} className="grid grid-cols-[48px_minmax(0,1fr)] lg:grid-cols-[56px_minmax(0,1fr)_150px_280px_110px_130px] gap-x-4 gap-y-3 px-5 py-4 items-center">
                  <RankBadge rank={r.rank} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-50 line-clamp-2" dir="auto">{r.proposal.title}</p>
                    <p className="text-xs text-ink-300 truncate" dir="auto">
                      {[r.proposal.author, r.proposal.institution].filter(Boolean).join(' · ')}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className={`badge badge-${r.proposal.status}`}>{statusLabel(r.proposal.status)}</span>
                      <span className="text-[11px] text-ink-400">{formatCurrency(r.proposal.funding_requested)}</span>
                      {r.evaluation.recommendation === 'recommend' ? (
                        <span className="text-[11px] font-medium text-emerald-700 flex items-center gap-1"><CheckCircle2 size={12} /> {t('Recommended')}</span>
                      ) : r.evaluation.recommendation === 'do_not_fund' ? (
                        <span className="text-[11px] font-medium text-rose-600 flex items-center gap-1"><XCircle size={12} /> {t('Not recommended')}</span>
                      ) : null}
                      {r.reviewers > 1 && <span className="text-[11px] text-ink-400">· {t('{count} reviewers', { count: r.reviewers })}</span>}
                    </div>
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    {r.proposal.research_area
                      ? <span className="chip text-[11px]" dir="auto">{t(r.proposal.research_area)}</span>
                      : <span className="text-xs text-ink-400">—</span>}
                  </div>
                  <div className="col-span-2 lg:col-span-1 space-y-1.5">
                    {APPENDICES.map((ap) => (
                      <div key={ap.key} className="flex items-center gap-2 text-[11px]" title={t(ap.title)}>
                        <span className="w-3 font-semibold text-ink-300">{ap.letter}</span>
                        <span className="flex-1 min-w-0 truncate text-ink-300">{t(ap.title)}</span>
                        <div className="w-14 h-1.5 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                          <div className="h-full rounded-full bg-brand/70" style={{ width: `${r.sections[ap.key]}%` }} />
                        </div>
                        <span className="w-8 text-end font-semibold text-ink-100">{r.sections[ap.key]}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="col-span-2 lg:col-span-1 flex lg:block items-center gap-2">
                    <p className="text-xl font-bold text-ink-50">{r.score}%</p>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${TONE_CLASSES[v.tone]}`}>{t(v.label)}</span>
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <button onClick={() => setOpen(r)} className="btn-liquid rounded-xl px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 w-full lg:w-auto justify-center whitespace-nowrap">
                      <FileText size={13} /> {t('View report')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Not assessed yet */}
      {unassessed.length > 0 && !filtersOn && (
        <div className="glass-card rounded-2xl p-5">
          <p className="text-sm font-semibold text-ink-100 flex items-center gap-2 mb-1">
            <ClipboardList size={16} className="text-ink-400" /> {t('Not assessed yet ({count})', { count: unassessed.length })}
          </p>
          <p className="text-xs text-ink-400 mb-3">{t('These proposals have no evaluation, so they are not ranked.')}</p>
          <ul className="space-y-1.5">
            {unassessed.map((p) => (
              <li key={p.id} className="text-xs text-ink-200 truncate" dir="auto">• {p.title}</li>
            ))}
          </ul>
        </div>
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title={t('Matching Report')} wide>
        {open && <MatchingReport proposal={open.proposal} evaluation={open.evaluation} rank={open.rank} totalRanked={ranked.length} />}
      </Modal>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const style = rank === 1 ? 'bg-amber-100 text-amber-700 ring-amber-300'
    : rank === 2 ? 'bg-slate-100 text-slate-700 ring-slate-300'
    : rank === 3 ? 'bg-orange-100 text-orange-700 ring-orange-300'
    : 'bg-white text-ink-200 ring-slate-200';
  return (
    <span className={`w-10 h-10 rounded-xl ring-1 flex items-center justify-center text-sm font-bold ${style}`}>
      {rank <= 3 ? <span className="flex items-center gap-0.5"><Trophy size={11} />{rank}</span> : rank}
    </span>
  );
}
