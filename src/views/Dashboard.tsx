import { FileText, BookOpen, GitCompare, TrendingUp, DollarSign, CheckCircle2, Clock, AlertCircle, Flame, Target, Wallet, Lightbulb, ArrowUpRight, ArrowDownRight, BarChart3 } from 'lucide-react';
import type { Proposal, Publication, MatchWithRelations } from '@/lib/supabase';
import { ScoreRing } from '@/components/ui';
import { formatDate, formatCurrency, statusLabel, OMAN_VISION_PILLARS, FUNDING_TIERS } from '@/lib/utils';

interface DashboardProps {
  proposals: Proposal[];
  publications: Publication[];
  matches: MatchWithRelations[];
}

export function Dashboard({ proposals, publications, matches }: DashboardProps) {
  const pendingProposals = proposals.filter((p) => p.status === 'pending').length;
  const approvedProposals = proposals.filter((p) => p.status === 'approved').length;
  const totalFunding = proposals.reduce((sum, p) => sum + (p.funding_requested ?? 0), 0);
  const avgFunding = proposals.length > 0 ? totalFunding / proposals.length : 0;
  const avgMatchScore = matches.length > 0 ? matches.reduce((s, m) => s + m.match_score, 0) / matches.length : 0;
  const highConfidenceMatches = matches.filter((m) => m.match_score >= 80).length;

  // Funding analysis
  const lowFundingProposals = proposals.filter((p) => (p.funding_requested ?? 0) > 0 && (p.funding_requested ?? 0) < FUNDING_TIERS.LOW);
  const mediumFundingProposals = proposals.filter((p) => (p.funding_requested ?? 0) >= FUNDING_TIERS.LOW && (p.funding_requested ?? 0) < FUNDING_TIERS.MEDIUM);
  const highFundingProposals = proposals.filter((p) => (p.funding_requested ?? 0) >= FUNDING_TIERS.MEDIUM);

  // Research area distribution
  const areaCounts: Record<string, number> = {};
  const areaFunding: Record<string, number> = {};
  proposals.forEach((p) => {
    if (p.research_area) {
      areaCounts[p.research_area] = (areaCounts[p.research_area] ?? 0) + 1;
      areaFunding[p.research_area] = (areaFunding[p.research_area] ?? 0) + (p.funding_requested ?? 0);
    }
  });
  const topAreas = Object.entries(areaCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxAreaCount = topAreas.length > 0 ? topAreas[0][1] : 1;

  // Trending topics — keywords ranked by frequency across proposals
  const keywordCounts: Record<string, number> = {};
  proposals.forEach((p) => {
    (p.keywords ?? []).forEach((k) => { keywordCounts[k] = (keywordCounts[k] ?? 0) + 1; });
  });
  const trendingTopics = Object.entries(keywordCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Oman Vision pillar alignment — map keywords to pillars
  const pillarAlignment: Record<string, number> = {};
  OMAN_VISION_PILLARS.forEach((p) => { pillarAlignment[p] = 0; });
  const pillarKeywords: Record<string, string[]> = {
    'Economic Diversification': ['tourism', 'economic diversification', 'manufacturing', 'logistics', 'blockchain', 'digital transformation'],
    'Sustainability & Environment': ['solar energy', 'renewable energy', 'coral reef', 'marine conservation', 'climate change', 'water security', 'green hydrogen', 'sustainability'],
    'Human Capital & Education': ['education', 'youth', 'rural health', 'diagnostics'],
    'Innovation & Technology': ['artificial intelligence', 'IoT', 'blockchain', 'sensors', '3D scanning', 'machine learning', 'digital preservation'],
    'Health & Wellbeing': ['healthcare', 'mental health', 'telemedicine', 'diabetes', 'digital health', 'counseling', 'rural health'],
    'Heritage & Culture': ['cultural heritage', 'digital preservation', 'manuscripts', 'archaeology', 'heritage'],
  };
  proposals.forEach((p) => {
    const kws = (p.keywords ?? []).map((k) => k.toLowerCase());
    OMAN_VISION_PILLARS.forEach((pillar) => {
      const matched = kws.some((k) => (pillarKeywords[pillar] ?? []).includes(k));
      if (matched) pillarAlignment[pillar] = (pillarAlignment[pillar] ?? 0) + 1;
    });
  });
  const maxPillarCount = Math.max(...Object.values(pillarAlignment), 1);

  const stats = [
    { label: 'Total Proposals', value: proposals.length, icon: FileText, color: 'text-teal-600', bg: 'from-teal-500/10 to-teal-500/5' },
    { label: 'Publications', value: publications.length, icon: BookOpen, color: 'text-cyan-600', bg: 'from-cyan-500/10 to-cyan-500/5' },
    { label: 'Matches Found', value: matches.length, icon: GitCompare, color: 'text-blue-600', bg: 'from-blue-500/10 to-blue-500/5' },
    { label: 'Avg Match Score', value: `${Math.round(avgMatchScore)}%`, icon: TrendingUp, color: 'text-amber-600', bg: 'from-amber-500/10 to-amber-500/5' },
  ];

  const statusBreakdown = [
    { label: 'Pending', count: pendingProposals, icon: Clock, color: 'text-amber-600', badge: 'badge-pending' },
    { label: 'Approved', count: approvedProposals, icon: CheckCircle2, color: 'text-teal-600', badge: 'badge-approved' },
    { label: 'Under Review', count: proposals.filter((p) => p.status === 'under_review').length, icon: AlertCircle, color: 'text-cyan-600', badge: 'badge-under_review' },
    { label: 'Rejected', count: proposals.filter((p) => p.status === 'rejected').length, icon: AlertCircle, color: 'text-rose-600', badge: 'badge-rejected' },
  ];

  const recentProposals = proposals.slice(0, 5);
  const topMatches = matches.slice(0, 5);

  return (
    <div className="space-y-6 fade-in">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`glass-card rounded-2xl p-5 bg-gradient-to-br ${stat.bg}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="glass rounded-lg p-2">
                  <Icon size={18} className={stat.color} />
                </div>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-ink-50">{stat.value}</p>
              <p className="text-xs text-ink-300 mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Funding overview + Oman Vision alignment */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funding analysis */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-ink-100 mb-4 flex items-center gap-2">
            <Wallet size={16} className="text-amber-600" />
            Funding Analysis
          </h3>
          <div className="glass rounded-xl p-4 mb-4 text-center">
            <p className="text-3xl font-bold text-amber-600">{formatCurrency(totalFunding)}</p>
            <p className="text-xs text-ink-300 mt-1">Total Funding Requested</p>
            <p className="text-[10px] text-ink-400 mt-1">Avg per proposal: {formatCurrency(avgFunding)}</p>
          </div>
          <div className="space-y-2.5">
            <FundingBar label="Low (< 30K OMR)" count={lowFundingProposals.length} total={proposals.length} color="from-teal-400/60 to-teal-500/60" />
            <FundingBar label="Medium (30K–75K)" count={mediumFundingProposals.length} total={proposals.length} color="from-amber-400/60 to-amber-500/60" />
            <FundingBar label="High (75K+)" count={highFundingProposals.length} total={proposals.length} color="from-rose-400/60 to-rose-500/60" />
          </div>
          {lowFundingProposals.length > 0 && (
            <div className="glass rounded-xl p-3 mt-4 flex items-start gap-2">
              <Lightbulb size={14} className="text-teal-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-ink-300">
                <span className="text-teal-600 font-medium">{lowFundingProposals.length} low-budget proposal{lowFundingProposals.length !== 1 ? 's' : ''}</span> — consider consolidating or prioritizing for quick wins.
              </p>
            </div>
          )}
        </div>

        {/* Oman Vision 2040 alignment */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-ink-100 mb-4 flex items-center gap-2">
            <Target size={16} className="text-teal-600" />
            Oman Vision 2040 Alignment
          </h3>
          <div className="space-y-2.5">
            {OMAN_VISION_PILLARS.map((pillar) => {
              const count = pillarAlignment[pillar] ?? 0;
              const pct = (count / maxPillarCount) * 100;
              return (
                <div key={pillar}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-ink-200">{pillar}</span>
                    <span className="text-xs font-semibold text-ink-100">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-ink-700/20 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500/60 to-cyan-500/60 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-ink-700/20">
            <p className="text-[10px] text-ink-400">
              Based on keyword alignment with Vision 2040 strategic pillars across {proposals.length} proposals
            </p>
          </div>
        </div>

        {/* Trending topics */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-ink-100 mb-4 flex items-center gap-2">
            <Flame size={16} className="text-rose-500" />
            Trending Research Topics
          </h3>
          {trendingTopics.length === 0 ? (
            <p className="text-sm text-ink-400">No keyword data yet</p>
          ) : (
            <div className="space-y-2">
              {trendingTopics.map(([topic, count], i) => (
                <div key={topic} className="flex items-center gap-3">
                  <span className={`text-xs font-bold ${i < 3 ? 'text-teal-600' : 'text-ink-400'} w-4`}>{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-ink-200 capitalize">{topic}</span>
                      <span className="text-xs font-semibold text-ink-100">{count}</span>
                    </div>
                    <div className="h-1 rounded-full bg-ink-700/20 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-400/50 to-amber-400/50 transition-all duration-500"
                        style={{ width: `${(count / trendingTopics[0][1]) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status + Area + Match overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Proposal status breakdown */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-ink-100 mb-4 flex items-center gap-2">
            <FileText size={16} className="text-teal-600" />
            Proposal Status
          </h3>
          <div className="space-y-3">
            {statusBreakdown.map((s) => {
              const Icon = s.icon;
              const pct = proposals.length > 0 ? (s.count / proposals.length) * 100 : 0;
              return (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Icon size={14} className={s.color} />
                      <span className="text-xs text-ink-200">{s.label}</span>
                    </div>
                    <span className="text-xs font-semibold text-ink-100">{s.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-ink-700/20 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500/60 to-cyan-500/60 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Research area distribution */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-ink-100 mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-cyan-600" />
            Research Areas
          </h3>
          {topAreas.length === 0 ? (
            <p className="text-sm text-ink-400">No data yet</p>
          ) : (
            <div className="space-y-3">
              {topAreas.map(([area, count]) => (
                <div key={area}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-ink-200">{area}</span>
                    <span className="text-xs font-semibold text-ink-100">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-ink-700/20 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500/60 to-blue-500/60 transition-all duration-500"
                      style={{ width: `${(count / maxAreaCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Match score overview */}
        <div className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center">
          <h3 className="text-sm font-semibold text-ink-100 mb-4 self-start flex items-center gap-2">
            <GitCompare size={16} className="text-blue-600" />
            Match Overview
          </h3>
          <ScoreRing score={avgMatchScore} size={120} />
          <p className="text-xs text-ink-300 mt-3 text-center">Average match score across all proposals</p>
          <div className="grid grid-cols-2 gap-3 w-full mt-4">
            <div className="glass rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-teal-600">{highConfidenceMatches}</p>
              <p className="text-[10px] text-ink-300">High (80%+)</p>
            </div>
            <div className="glass rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-amber-600">{matches.filter((m) => m.match_score >= 40 && m.match_score < 80).length}</p>
              <p className="text-[10px] text-ink-300">Medium</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent proposals + Top matches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-ink-100 mb-4">Recent Proposals</h3>
          {recentProposals.length === 0 ? (
            <p className="text-sm text-ink-400">No proposals yet</p>
          ) : (
            <div className="space-y-3">
              {recentProposals.map((p) => (
                <div key={p.id} className="flex items-start gap-3 group">
                  <div className="glass rounded-lg p-2 mt-0.5 group-hover:bg-white/20 transition-colors">
                    <FileText size={14} className="text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-100 truncate">{p.title}</p>
                    <p className="text-xs text-ink-300">{p.author} · {formatDate(p.publication_date)}</p>
                  </div>
                  <span className={`badge badge-${p.status}`}>{statusLabel(p.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-ink-100 mb-4">Top Matches</h3>
          {topMatches.length === 0 ? (
            <p className="text-sm text-ink-400">No matches yet — upload a proposal to auto-match</p>
          ) : (
            <div className="space-y-3">
              {topMatches.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <ScoreRing score={m.match_score} size={44} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-100 truncate">{m.proposal?.title ?? '—'}</p>
                    <p className="text-xs text-ink-300 truncate">↳ {m.publication?.title ?? '—'}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 max-w-[120px] justify-end">
                    {m.matched_keywords.slice(0, 2).map((k) => (
                      <span key={k} className="chip text-[10px]">{k}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FundingBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-ink-200">{label}</span>
        <span className="text-xs font-semibold text-ink-100">{count}</span>
      </div>
      <div className="h-1.5 rounded-full bg-ink-700/20 overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
