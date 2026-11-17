import { useMemo, useState } from 'react';
import { BookOpen, Upload, Filter, X, Search, Calendar, Quote, Tag, ChevronRight, ExternalLink, Users, type LucideIcon } from 'lucide-react';
import type { Publication } from '@/lib/supabase';
import { usePublications, createPublication } from '@/lib/hooks';
import { Modal, Toast } from '@/components/ui';
import { formatDate, RESEARCH_AREAS } from '@/lib/utils';

export function Publications() {
  const { publications, loading, refresh } = usePublications();
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'citations' | 'title'>('date');
  const [showFilters, setShowFilters] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selected, setSelected] = useState<Publication | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const filtered = useMemo(() => {
    let result = publications.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.title.toLowerCase().includes(q) && !p.authors.toLowerCase().includes(q) && !(p.journal ?? '').toLowerCase().includes(q)) return false;
      }
      if (areaFilter !== 'all' && p.research_area !== areaFilter) return false;
      if (dateFrom && p.publication_date && p.publication_date < dateFrom) return false;
      if (dateTo && p.publication_date && p.publication_date > dateTo) return false;
      return true;
    });
    if (sortBy === 'date') result = [...result].sort((a, b) => (b.publication_date ?? '').localeCompare(a.publication_date ?? ''));
    if (sortBy === 'citations') result = [...result].sort((a, b) => b.citation_count - a.citation_count);
    if (sortBy === 'title') result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    return result;
  }, [publications, search, areaFilter, dateFrom, dateTo, sortBy]);

  const activeFilters = (areaFilter !== 'all' ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  return (
    <div className="space-y-5 fade-in">
      {/* Toolbar */}
      <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 glass-input rounded-xl px-3 py-2 flex-1 min-w-[200px]">
          <Search size={16} className="text-ink-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search publications, authors, journals..."
            className="bg-transparent border-0 outline-none text-sm text-ink-50 placeholder:text-ink-400 flex-1"
          />
          {search && <button onClick={() => setSearch('')} className="text-ink-300 hover:text-ink-50"><X size={14} /></button>}
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className={`btn-liquid rounded-xl px-4 py-2 text-sm font-medium flex items-center gap-2 ${showFilters ? 'ring-1 ring-teal-400/40' : ''}`}>
          <Filter size={16} /> Filters
          {activeFilters > 0 && <span className="ml-1 w-5 h-5 rounded-full bg-teal-glow text-white text-[10px] font-bold flex items-center justify-center">{activeFilters}</span>}
        </button>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'date' | 'citations' | 'title')} className="glass-input glass-select rounded-xl px-3 py-2 text-sm">
          <option value="date">Sort: Date</option>
          <option value="citations">Sort: Citations</option>
          <option value="title">Sort: Title</option>
        </select>
        <button onClick={() => setShowUpload(true)} className="btn-solid rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-2">
          <Upload size={16} /> Upload Publication
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="glass-card rounded-2xl p-4 slide-up">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-ink-300 mb-1.5 block">Research Area</label>
              <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} className="glass-input glass-select rounded-xl px-3 py-2 text-sm w-full">
                <option value="all">All Areas</option>
                {RESEARCH_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
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
            <button onClick={() => { setAreaFilter('all'); setDateFrom(''); setDateTo(''); }} className="mt-3 text-xs text-teal-glow hover:text-teal-700 flex items-center gap-1">
              <X size={12} /> Clear all filters
            </button>
          )}
        </div>
      )}

      <p className="text-sm text-ink-300 px-1">{loading ? 'Loading...' : `${filtered.length} publication${filtered.length !== 1 ? 's' : ''} found`}</p>

      {loading ? (
        <div className="glass-card rounded-2xl p-8 text-center text-ink-300">Loading publications...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <BookOpen size={40} className="text-ink-400 mx-auto mb-3" />
          <p className="text-ink-200">No publications match your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <button key={p.id} onClick={() => setSelected(p)} className="glass-card rounded-2xl p-5 text-left group">
              <div className="flex items-start justify-between mb-3">
                <div className="glass rounded-lg p-2">
                  <BookOpen size={16} className="text-cyan-600" />
                </div>
                <div className="flex items-center gap-1 text-xs text-amber-600">
                  <Quote size={12} /> {p.citation_count}
                </div>
              </div>
              <h3 className="text-sm font-semibold text-ink-50 mb-1 line-clamp-2 group-hover:text-teal-glow transition-colors">{p.title}</h3>
              <p className="text-xs text-ink-300 mb-2">{p.authors}</p>
              {p.journal && <p className="text-xs text-ink-400 italic mb-2 truncate">{p.journal}</p>}
              {p.research_area && <span className="chip mb-2">{p.research_area}</span>}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-ink-700/20">
                <span className="text-xs text-ink-300 flex items-center gap-1"><Calendar size={12} /> {formatDate(p.publication_date)}</span>
                {p.doi && <span className="text-[10px] text-cyan-600/70 font-mono">{p.doi}</span>}
              </div>
              {p.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {p.keywords.slice(0, 3).map((k) => <span key={k} className="chip text-[10px]">{k}</span>)}
                  {p.keywords.length > 3 && <span className="chip text-[10px]">+{p.keywords.length - 3}</span>}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Publication Details">
        {selected && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-ink-50">{selected.title}</h3>
              <p className="text-sm text-ink-300 mt-1 flex items-center gap-1"><Users size={14} /> {selected.authors}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow icon={BookOpen} label="Journal" value={selected.journal ?? '—'} />
              <InfoRow icon={Quote} label="Citations" value={String(selected.citation_count)} />
              <InfoRow icon={Calendar} label="Published" value={formatDate(selected.publication_date)} />
              <InfoRow icon={Tag} label="Research Area" value={selected.research_area ?? '—'} />
            </div>
            {selected.doi && (
              <div className="glass rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs text-ink-300">DOI</span>
                <span className="text-xs text-cyan-600 font-mono">{selected.doi}</span>
              </div>
            )}
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
            {selected.document_url && (
              <a href={selected.document_url} target="_blank" rel="noreferrer" className="btn-liquid rounded-xl px-4 py-2 text-sm flex items-center gap-2 w-fit">
                <ExternalLink size={14} /> View Document
              </a>
            )}
          </div>
        )}
      </Modal>

      <UploadPubModal open={showUpload} onClose={() => setShowUpload(false)} onCreated={async () => { await refresh(); setShowUpload(false); setToast({ message: 'Publication uploaded successfully', type: 'success' }); }} />

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

function UploadPubModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: '', authors: '', journal: '', research_area: '', abstract: '', document_url: '', doi: '', publication_date: '', keywords: '', citation_count: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!form.title || !form.authors) { setError('Title and authors are required'); return; }
    setSaving(true);
    setError(null);
    const ok = await createPublication({
      title: form.title,
      authors: form.authors,
      journal: form.journal || null,
      research_area: form.research_area || null,
      abstract: form.abstract || null,
      document_url: form.document_url || null,
      doi: form.doi || null,
      publication_date: form.publication_date || null,
      keywords: form.keywords ? form.keywords.split(',').map((k) => k.trim()).filter(Boolean) : [],
      citation_count: form.citation_count ? parseInt(form.citation_count) : 0,
    });
    setSaving(false);
    if (ok) {
      setForm({ title: '', authors: '', journal: '', research_area: '', abstract: '', document_url: '', doi: '', publication_date: '', keywords: '', citation_count: '' });
      onCreated();
    } else {
      setError('Failed to save publication');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Upload New Publication">
      <div className="space-y-4">
        {error && <div className="glass rounded-xl p-3 text-sm text-rose-600 border border-rose-400/30">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Title *">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" placeholder="Publication title" />
          </Field>
          <Field label="Authors *">
            <input value={form.authors} onChange={(e) => setForm({ ...form, authors: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" placeholder="Author names" />
          </Field>
          <Field label="Journal / Conference">
            <input value={form.journal} onChange={(e) => setForm({ ...form, journal: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" placeholder="Journal name" />
          </Field>
          <Field label="Research Area">
            <select value={form.research_area} onChange={(e) => setForm({ ...form, research_area: e.target.value })} className="glass-input glass-select rounded-xl px-3 py-2 text-sm w-full">
              <option value="">Select area...</option>
              {RESEARCH_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="Publication Date">
            <input type="date" value={form.publication_date} onChange={(e) => setForm({ ...form, publication_date: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" />
          </Field>
          <Field label="DOI">
            <input value={form.doi} onChange={(e) => setForm({ ...form, doi: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" placeholder="10.xxxx/..." />
          </Field>
          <Field label="Citation Count">
            <input type="number" value={form.citation_count} onChange={(e) => setForm({ ...form, citation_count: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" placeholder="0" />
          </Field>
          <Field label="Document URL">
            <input value={form.document_url} onChange={(e) => setForm({ ...form, document_url: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" placeholder="https://..." />
          </Field>
        </div>
        <Field label="Abstract">
          <textarea value={form.abstract} onChange={(e) => setForm({ ...form, abstract: e.target.value })} rows={3} className="glass-input rounded-xl px-3 py-2 text-sm w-full resize-none" placeholder="Publication summary..." />
        </Field>
        <Field label="Keywords (comma-separated)">
          <input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} className="glass-input rounded-xl px-3 py-2 text-sm w-full" placeholder="solar, energy, desert" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="glass-card rounded-xl px-4 py-2 text-sm text-ink-200 hover:text-ink-50">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-solid rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-50">
            {saving ? 'Saving...' : 'Upload Publication'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-ink-300 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
