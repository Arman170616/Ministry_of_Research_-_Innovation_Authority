import { useMemo, useState } from 'react';
import { FileText, Upload, Filter, X, Search, Calendar, DollarSign, User, Building2, Tag, type LucideIcon, Sparkles, Trash2 } from 'lucide-react';
import type { Proposal, ProposalStatus, MatchWithRelations } from '@/lib/types';
import { useProposals, useMatches, updateProposalStatus, deleteProposal } from '@/lib/hooks';
import { Modal, Toast } from '@/components/ui';
import { formatDate, formatCurrency, statusLabel, PROPOSAL_STATUSES, RESEARCH_AREAS } from '@/lib/utils';
import { ProposalWizard } from '@/components/ProposalWizard';

export function Proposals() {
  const { proposals, loading, refresh } = useProposals();
  const { matches, refresh: refreshMatches } = useMatches();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'funding' | 'title' | 'matches'>('date');
  const [showFilters, setShowFilters] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const matchCountByProposal = useMemo(() => {
    const counts: Record<string, number> = {};
    matches.forEach((m) => { counts[m.proposal_id] = (counts[m.proposal_id] ?? 0) + 1; });
    return counts;
  }, [matches]);

  const filtered = useMemo(() => {
    let result = proposals.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.title.toLowerCase().includes(q) && !p.author.toLowerCase().includes(q) && !(p.abstract ?? '').toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (areaFilter !== 'all' && p.research_area !== areaFilter) return false;
      if (dateFrom && p.publication_date && p.publication_date < dateFrom) return false;
      if (dateTo && p.publication_date && p.publication_date > dateTo) return false;
      return true;
    });
    if (sortBy === 'date') result = [...result].sort((a, b) => (b.publication_date ?? '').localeCompare(a.publication_date ?? ''));
    if (sortBy === 'funding') result = [...result].sort((a, b) => (b.funding_requested ?? 0) - (a.funding_requested ?? 0));
    if (sortBy === 'title') result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === 'matches') result = [...result].sort((a, b) => (matchCountByProposal[b.id] ?? 0) - (matchCountByProposal[a.id] ?? 0));
    return result;
  }, [proposals, search, statusFilter, areaFilter, dateFrom, dateTo, sortBy, matchCountByProposal]);

  const activeFilters = (statusFilter !== 'all' ? 1 : 0) + (areaFilter !== 'all' ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const clearFilters = () => {
    setStatusFilter('all');
    setAreaFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const handleStatusChange = async (id: string, status: string) => {
    await updateProposalStatus(id, status);
    await refresh();
    setToast({ message: `Proposal marked as ${statusLabel(status)}`, type: 'success' });
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteProposal(id);
    if (ok) {
      setConfirmDelete(null);
      setSelected(null);
      await refresh();
      await refreshMatches();
      setToast({ message: 'Proposal deleted', type: 'success' });
    } else {
      setToast({ message: 'Failed to delete proposal', type: 'error' });
    }
  };

  const handleWizardComplete = async () => {
    await refresh();
    await refreshMatches();
    setShowWizard(false);
    setToast({ message: 'Proposal uploaded, matched, and evaluated successfully', type: 'success' });
  };

  return (
    <div className="space-y-5 fade-in">
      {/* Toolbar */}
      <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 glass-input rounded-xl px-3 py-2 flex-1 min-w-[200px]">
          <Search size={16} className="text-ink-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search proposals, authors, abstracts..."
            className="bg-transparent border-0 outline-none text-sm text-ink-50 placeholder:text-ink-400 flex-1"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-ink-300 hover:text-ink-50">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn-liquid rounded-xl px-4 py-2 text-sm font-medium flex items-center gap-2 ${showFilters ? 'ring-1 ring-brand-400/40' : ''}`}
        >
          <Filter size={16} />
          Filters
          {activeFilters > 0 && <span className="ml-1 w-5 h-5 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center">{activeFilters}</span>}
        </button>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'date' | 'funding' | 'title' | 'matches')}
          className="glass-input glass-select rounded-xl px-3 py-2 text-sm"
        >
          <option value="date">Sort: Date</option>
          <option value="funding">Sort: Funding</option>
          <option value="title">Sort: Title</option>
          <option value="matches">Sort: Matches</option>
        </select>
        <button onClick={() => setShowWizard(true)} className="btn-solid rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-2">
          <Upload size={16} />
          Upload Proposal
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="glass-card rounded-2xl p-4 slide-up">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-ink-300 mb-1.5 block">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="glass-input glass-select rounded-xl px-3 py-2 text-sm w-full">
                <option value="all">All Statuses</option>
                {PROPOSAL_STATUSES.map((s) => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-ink-300 mb-1.5 block">Research Area</label>
              <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} className="glass-input glass-select rounded-xl px-3 py-2 text-sm w-full">
                <option value="all">All Areas</option>
                {RESEARCH_AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-ink-300 mb-1.5 block flex items-center gap-1"><Calendar size={12} /> Published From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="glass-input rounded-xl px-3 py-2 text-sm w-full" />
            </div>
            <div>
              <label className="text-xs text-ink-300 mb-1.5 block flex items-center gap-1"><Calendar size={12} /> Published To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="glass-input rounded-xl px-3 py-2 text-sm w-full" />
            </div>
          </div>
          {activeFilters > 0 && (
            <button onClick={clearFilters} className="mt-3 text-xs text-brand hover:text-brand-700 flex items-center gap-1">
              <X size={12} /> Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-ink-300">
          {loading ? 'Loading...' : `${filtered.length} proposal${filtered.length !== 1 ? 's' : ''} found`}
        </p>
      </div>

      {/* Proposals list */}
      {loading ? (
        <div className="glass-card rounded-2xl p-8 text-center text-ink-300">Loading proposals...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <FileText size={40} className="text-ink-400 mx-auto mb-3" />
          <p className="text-ink-200">No proposals match your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const matchCount = matchCountByProposal[p.id] ?? 0;
            return (
              <div key={p.id} className="glass-card rounded-2xl p-5 text-left group relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="glass rounded-lg p-2">
                    <FileText size={16} className="text-brand" />
                  </div>
                  <div className="flex items-center gap-2">
                    {matchCount > 0 && (
                      <span className="chip text-[10px]" style={{ background: '#fdf2f3', borderColor: '#f6c9cf', color: '#a50d26' }}>
                        <Sparkles size={10} className="mr-0.5" /> {matchCount} match{matchCount !== 1 ? 'es' : ''}
                      </span>
                    )}
                    <span className={`badge badge-${p.status}`}>{statusLabel(p.status)}</span>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-ink-50 mb-1 line-clamp-2 group-hover:text-brand transition-colors">{p.title}</h3>
                <p className="text-xs text-ink-300 mb-3">{p.author}</p>
                {p.research_area && <span className="chip mb-2">{p.research_area}</span>}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-ink-700/30">
                  <span className="text-xs text-ink-300 flex items-center gap-1">
                    <Calendar size={12} /> {formatDate(p.publication_date)}
                  </span>
                  <span className="text-xs font-semibold text-amber-600">{formatCurrency(p.funding_requested)}</span>
                </div>
                {p.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {p.keywords.slice(0, 3).map((k) => (
                      <span key={k} className="chip text-[10px]">{k}</span>
                    ))}
                    {p.keywords.length > 3 && <span className="chip text-[10px]">+{p.keywords.length - 3}</span>}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-ink-700/20">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelected(p); }}
                    className="flex-1 text-xs text-ink-300 hover:text-ink-50 transition-colors text-left"
                  >
                    View details
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(p.id); }}
                    className="glass rounded-lg p-1.5 hover:bg-rose-500/20 transition-colors group/del"
                  >
                    <Trash2 size={13} className="text-ink-400 group-hover/del:text-rose-400 transition-colors" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Proposal Details">
        {selected && (
          <div className="space-y-4">
            <div>
              <span className={`badge badge-${selected.status}`}>{statusLabel(selected.status)}</span>
              <h3 className="text-lg font-semibold text-ink-50 mt-2">{selected.title}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow icon={User} label="Author" value={selected.author} />
              <InfoRow icon={Building2} label="Institution" value={selected.institution ?? '—'} />
              <InfoRow icon={Calendar} label="Published" value={formatDate(selected.publication_date)} />
              <InfoRow icon={DollarSign} label="Funding" value={formatCurrency(selected.funding_requested)} />
            </div>
            {selected.abstract && (
              <div>
                <p className="text-xs text-ink-300 mb-1">Abstract</p>
                <p className="text-sm text-ink-100 leading-relaxed">{selected.abstract}</p>
              </div>
            )}
            {selected.keywords.length > 0 && (
              <div>
                <p className="text-xs text-ink-300 mb-2 flex items-center gap-1"><Tag size={12} /> Keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.keywords.map((k) => <span key={k} className="chip">{k}</span>)}
                </div>
              </div>
            )}
            <div>
              <p className="text-xs text-ink-300 mb-2">Update Status</p>
              <div className="flex flex-wrap gap-2">
                {PROPOSAL_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => { handleStatusChange(selected.id, s); setSelected({ ...selected, status: s }); }}
                    className={`badge badge-${s} ${selected.status === s ? 'ring-2 ring-brand/40' : 'opacity-60 hover:opacity-100'} cursor-pointer transition-opacity`}
                  >
                    {statusLabel(s)}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-2 border-t border-ink-700/20">
              <button
                onClick={() => setConfirmDelete(selected.id)}
                className="flex items-center gap-2 text-sm text-rose-400 hover:text-rose-300 transition-colors"
              >
                <Trash2 size={14} /> Delete this proposal
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 !mt-0 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="glass-strong relative z-10 w-full max-w-sm rounded-2xl p-6 slide-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-full bg-rose-500/15 p-2">
                <Trash2 size={18} className="text-rose-400" />
              </div>
              <h3 className="text-base font-semibold text-ink-50">Delete proposal?</h3>
            </div>
            <p className="text-sm text-ink-300 mb-5">This will permanently remove the proposal and all its matches. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 btn-liquid rounded-xl py-2 text-sm">Cancel</button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 rounded-xl py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload wizard */}
      <ProposalWizard open={showWizard} onClose={() => setShowWizard(false)} onComplete={handleWizardComplete} />

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-3">
      <p className="text-[10px] text-ink-300 mb-1 flex items-center gap-1"><Icon size={10} /> {label}</p>
      <p className="text-sm text-ink-100">{value}</p>
    </div>
  );
}


