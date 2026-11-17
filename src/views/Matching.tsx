import { useMemo, useState } from 'react';
import { GitCompare, Sparkles, Filter, X, FileText, BookOpen, ArrowRight, Check, XCircle, Eye } from 'lucide-react';
import type { MatchStatus } from '@/lib/types';
import { useMatches, useProposals, usePublications, updateMatch, generateMatches } from '@/lib/hooks';
import { ScoreRing, Toast } from '@/components/ui';
import { formatDate, statusLabel, MATCH_STATUSES } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

export function Matching() {
  const { t, lang } = useI18n();
  const { matches, loading, refresh } = useMatches();
  const { proposals } = useProposals();
  const { publications } = usePublications();
  const [scoreFilter, setScoreFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [proposalFilter, setProposalFilter] = useState('all');
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return matches.filter((m) => {
      if (scoreFilter === 'high' && m.match_score < 80) return false;
      if (scoreFilter === 'medium' && (m.match_score < 40 || m.match_score >= 80)) return false;
      if (scoreFilter === 'low' && m.match_score >= 40) return false;
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (proposalFilter !== 'all' && m.proposal_id !== proposalFilter) return false;
      return true;
    });
  }, [matches, scoreFilter, statusFilter, proposalFilter]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const run = await generateMatches(lang);
      await refresh();
      setToast(run.warning
        ? { message: t(run.warning), type: 'error' }
        : { message: t(run.method === 'ai' ? 'Found {count} matches with AI analysis' : 'Found {count} matches by keyword overlap', { count: run.count }), type: 'success' });
    } catch (err) {
      setToast({ message: t(err instanceof Error ? err.message : 'Matching failed'), type: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    await updateMatch(id, { status: status as MatchStatus });
    await refresh();
    setToast({ message: t('Match marked as {status}', { status: statusLabel(status) }), type: 'success' });
  };

  const selected = filtered.find((m) => m.id === selectedMatch);

  return (
    <div className="space-y-5 fade-in">
      {/* Toolbar */}
      <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-brand" />
          <div>
            <p className="text-sm font-medium text-ink-50">{t('Auto-Matching Engine')}</p>
            <p className="text-[11px] text-ink-300">{t('AI compares proposals with publications by meaning (keyword overlap if AI is off)')}</p>
          </div>
        </div>
        <div className="flex-1" />
        <select value={proposalFilter} onChange={(e) => setProposalFilter(e.target.value)} className="glass-input glass-select rounded-xl px-3 py-2 text-sm">
          <option value="all">{t('All Proposals')}</option>
          {proposals.map((p) => <option key={p.id} value={p.id}>{p.title.slice(0, 40)}...</option>)}
        </select>
        <select value={scoreFilter} onChange={(e) => setScoreFilter(e.target.value as 'all' | 'high' | 'medium' | 'low')} className="glass-input glass-select rounded-xl px-3 py-2 text-sm">
          <option value="all">{t('All Scores')}</option>
          <option value="high">{t('High (80%+)')}</option>
          <option value="medium">{t('Medium (40-79%)')}</option>
          <option value="low">{t('Low (<40%)')}</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="glass-input glass-select rounded-xl px-3 py-2 text-sm">
          <option value="all">{t('All Statuses')}</option>
          {MATCH_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
        <button onClick={handleGenerate} disabled={generating} className="btn-solid rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
          <Sparkles size={16} /> {generating ? t('Matching...') : t('Run Matching')}
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-ink-50">{matches.length}</p>
          <p className="text-[10px] text-ink-300">{t('Total Matches')}</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-emerald-600">{matches.filter((m) => m.match_score >= 80).length}</p>
          <p className="text-[10px] text-ink-300">{t('High Confidence')}</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-amber-600">{matches.filter((m) => m.status === 'pending').length}</p>
          <p className="text-[10px] text-ink-300">{t('Pending Review')}</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-emerald-600">{matches.filter((m) => m.status === 'accepted').length}</p>
          <p className="text-[10px] text-ink-300">{t('Accepted')}</p>
        </div>
      </div>

      <p className="text-sm text-ink-300 px-1">{loading ? t('Loading...') : t(filtered.length === 1 ? '{count} match found' : '{count} matches found', { count: filtered.length })}</p>

      {/* Match list */}
      {loading ? (
        <div className="glass-card rounded-2xl p-8 text-center text-ink-300">{t('Loading matches...')}</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <GitCompare size={40} className="text-ink-400 mx-auto mb-3" />
          <p className="text-ink-200">{t('No matches found. Click "Run Matching" to generate.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <div key={m.id} className="glass-card rounded-2xl p-4">
              <div className="flex items-center gap-4">
                <ScoreRing score={m.match_score} size={56} />

                {/* Proposal side */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <FileText size={12} className="text-brand-600" />
                    <span className="text-[10px] text-ink-300 uppercase tracking-wider">{t('Proposal')}</span>
                  </div>
                  <p className="text-sm text-ink-50 truncate" dir="auto">{m.proposal?.title ?? '—'}</p>
                  <p className="text-xs text-ink-300" dir="auto">{m.proposal?.author ?? '—'}</p>
                </div>

                <ArrowRight size={18} className="text-ink-400 flex-shrink-0 rtl:-scale-x-100" />

                {/* Publication side */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <BookOpen size={12} className="text-slate-600" />
                    <span className="text-[10px] text-ink-300 uppercase tracking-wider">{t('Publication')}</span>
                  </div>
                  <p className="text-sm text-ink-50 truncate" dir="auto">{m.publication?.title ?? '—'}</p>
                  <p className="text-xs text-ink-300" dir="auto">{m.publication?.journal ?? '—'} · {formatDate(m.publication?.publication_date ?? null)}</p>
                </div>

                {/* Matched keywords */}
                <div className="hidden lg:flex flex-col items-end gap-1 max-w-[160px]">
                  <span className="text-[10px] text-ink-300 uppercase tracking-wider">{t('Matched Keywords')}</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {m.matched_keywords.slice(0, 3).map((k) => <span key={k} className="chip text-[10px]">{k}</span>)}
                    {m.matched_keywords.length > 3 && <span className="chip text-[10px]">+{m.matched_keywords.length - 3}</span>}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className={`badge badge-${m.status}`}>{statusLabel(m.status)}</span>
                  <button onClick={() => setSelectedMatch(m.id)} className="glass rounded-lg p-1.5 hover:bg-slate-50 transition-colors" aria-label={t('View details')}>
                    <Eye size={14} className="text-ink-200" />
                  </button>
                </div>
              </div>

              {m.rationale && (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-300">
                  <Sparkles size={12} className="text-brand mt-0.5 flex-shrink-0" />
                  <span><span className="font-medium text-ink-200">{t('AI:')}</span> {m.rationale}</span>
                </p>
              )}

              {/* Quick actions */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-ink-700/20">
                <span className="text-[10px] text-ink-300 me-2">{t('Review:')}</span>
                <button onClick={() => handleStatusChange(m.id, 'accepted')} className="badge badge-accepted opacity-70 hover:opacity-100 cursor-pointer transition-opacity flex items-center gap-1">
                  <Check size={10} /> {t('Accept')}
                </button>
                <button onClick={() => handleStatusChange(m.id, 'rejected')} className="badge badge-rejected opacity-70 hover:opacity-100 cursor-pointer transition-opacity flex items-center gap-1">
                  <XCircle size={10} /> {t('Reject')}
                </button>
                <button onClick={() => handleStatusChange(m.id, 'reviewed')} className="badge badge-reviewed opacity-70 hover:opacity-100 cursor-pointer transition-opacity">
                  {t('Mark Reviewed')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 !mt-0 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setSelectedMatch(null)} />
          <div className="glass-strong relative z-10 w-full max-w-3xl rounded-3xl p-6 slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-ink-50">{t('Match Details')}</h2>
              <button onClick={() => setSelectedMatch(null)} className="text-ink-200 hover:text-ink-50 text-2xl leading-none" aria-label={t('Close')}>&times;</button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <ScoreRing score={selected.match_score} size={100} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={14} className="text-brand-600" />
                    <span className="text-[10px] text-ink-300 uppercase tracking-wider">{t('Proposal')}</span>
                  </div>
                  <p className="text-sm font-medium text-ink-50" dir="auto">{selected.proposal?.title}</p>
                  <p className="text-xs text-ink-300 mt-1" dir="auto">{selected.proposal?.author}</p>
                  {selected.proposal?.research_area && <span className="chip mt-2">{t(selected.proposal.research_area)}</span>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selected.proposal?.keywords.map((k) => <span key={k} className="chip text-[10px]">{k}</span>)}
                  </div>
                </div>
                <div className="glass rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen size={14} className="text-slate-600" />
                    <span className="text-[10px] text-ink-300 uppercase tracking-wider">{t('Publication')}</span>
                  </div>
                  <p className="text-sm font-medium text-ink-50" dir="auto">{selected.publication?.title}</p>
                  <p className="text-xs text-ink-300 mt-1" dir="auto">{selected.publication?.authors}</p>
                  {selected.publication?.research_area && <span className="chip mt-2">{t(selected.publication.research_area)}</span>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selected.publication?.keywords.map((k) => <span key={k} className="chip text-[10px]">{k}</span>)}
                  </div>
                </div>
              </div>
              {selected.rationale && (
                <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3 text-sm text-ink-100 flex items-start gap-2">
                  <Sparkles size={14} className="text-brand mt-0.5 flex-shrink-0" />
                  <span dir="auto">{selected.rationale}</span>
                </div>
              )}
              <div>
                <p className="text-xs text-ink-300 mb-2">{t('Matched Keywords')}</p>
                <div className="flex flex-wrap gap-2">
                  {selected.matched_keywords.map((k) => (
                    <span key={k} className="chip" style={{ background: '#fdf2f3', borderColor: '#f6c9cf', color: '#a50d26' }}>{k}</span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {MATCH_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => { handleStatusChange(selected.id, s); setSelectedMatch(null); }}
                    className={`badge badge-${s} ${selected.status === s ? 'ring-2 ring-brand/30' : 'opacity-60 hover:opacity-100'} cursor-pointer transition-opacity`}
                  >
                    {statusLabel(s)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
