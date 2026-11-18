import { FileText, ClipboardCheck, ThumbsUp, TrendingUp, CheckCircle2, Clock, AlertCircle, Flame, Target, Wallet, Lightbulb, BarChart3, Trophy } from 'lucide-react';
import type { Proposal, Evaluation } from '@/lib/types';
import { rankProposals, verdict, TONE_CLASSES, PILLAR_KEYWORDS } from '@/lib/criteria';
import { ScoreRing } from '@/components/ui';
import { formatDate, formatCurrency, statusLabel, OMAN_VISION_PILLARS, FUNDING_TIERS } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

interface DashboardProps {
  proposals: Proposal[];
  evaluations: Evaluation[];
}

export function Dashboard({ proposals, evaluations }: DashboardProps) {
  const { t } = useI18n();
  const pendingProposals = proposals.filter((p) => p.status === 'pending').length;
  const approvedProposals = proposals.filter((p) => p.status === 'approved').length;
  const totalFunding = proposals.reduce((sum, p) => sum + (p.funding_requested ?? 0), 0);
  const avgFunding = proposals.length > 0 ? totalFunding / proposals.length : 0;
  const { ranked } = rankProposals(proposals, evaluations);
  const avgScore = ranked.length > 0 ? ranked.reduce((s, r) => s + r.score, 0) / ranked.length : 0;
  const recommended = ranked.filter((r) => r.evaluation.recommendation === 'recommend').length;
  const bands = [
    { label: 'Strong match', min: 75, max: 101 },
    { label: 'Good match', min: 60, max: 75 },
    { label: 'Partial match', min: 45, max: 60 },
    { label: 'Weak match', min: 0, max: 45 },
  ].map((b) => ({ ...b, count: ranked.filter((r) => r.score >= b.min && r.score < b.max).length, tone: verdict(b.min).tone }));

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
  const pillarKeywords = PILLAR_KEYWORDS;
  proposals.forEach((p) => {
    const kws = (p.keywords ?? []).map((k) => k.toLowerCase());
    OMAN_VISION_PILLARS.forEach((pillar) => {
      const matched = kws.some((k) => (pillarKeywords[pillar] ?? []).includes(k));
      if (matched) pillarAlignment[pillar] = (pillarAlignment[pillar] ?? 0) + 1;
    });
  });
  const maxPillarCount = Math.max(...Object.values(pillarAlignment), 1);

  const stats = [
    { label: t('Total Proposals'), value: proposals.length, icon: FileText, color: 'text-brand-600', bg: 'from-brand-500/10 to-brand-500/5' },
    { label: t('Assessed'), value: ranked.length, icon: ClipboardCheck, color: 'text-slate-600', bg: 'from-slate-500/10 to-slate-500/5' },
    { label: t('Average Score'), value: `${Math.round(avgScore)}%`, icon: TrendingUp, color: 'text-amber-600', bg: 'from-amber-500/10 to-amber-500/5' },
    { label: t('Recommended'), value: recommended, icon: ThumbsUp, color: 'text-emerald-600', bg: 'from-emerald-500/10 to-emerald-500/5' },
  ];

  const statusBreakdown = [
    { label: t('Pending'), count: pendingProposals, icon: Clock, color: 'text-amber-600', bar: 'bg-amber-500', badge: 'badge-pending' },
    { label: t('Approved'), count: approvedProposals, icon: CheckCircle2, color: 'text-emerald-600', bar: 'bg-emerald-500', badge: 'badge-approved' },
    { label: t('Under Review'), count: proposals.filter((p) => p.status === 'under_review').length, icon: AlertCircle, color: 'text-slate-600', bar: 'bg-slate-500', badge: 'badge-under_review' },
    { label: t('Rejected'), count: proposals.filter((p) => p.status === 'rejected').length, icon: AlertCircle, color: 'text-brand', bar: 'bg-brand', badge: 'badge-rejected' },
  ];

  const recentProposals = proposals.slice(0, 5);
  const topRanked = ranked.slice(0, 5);

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
            {t('Funding Analysis')}
          </h3>
          <div className="glass rounded-xl p-4 mb-4 text-center">
            <p className="text-3xl font-bold text-amber-600">{formatCurrency(totalFunding)}</p>
            <p className="text-xs text-ink-300 mt-1">{t('Total Funding Requested')}</p>
            <p className="text-[10px] text-ink-400 mt-1">{t('Avg per proposal: {amount}', { amount: formatCurrency(avgFunding) })}</p>
          </div>
          <div className="space-y-2.5">
            <FundingBar label={t('Low (< 30K OMR)')} count={lowFundingProposals.length} total={proposals.length} color="from-emerald-400 to-emerald-500" />
            <FundingBar label={t('Medium (30K–75K)')} count={mediumFundingProposals.length} total={proposals.length} color="from-amber-400/60 to-amber-500/60" />
            <FundingBar label={t('High (75K+)')} count={highFundingProposals.length} total={proposals.length} color="from-rose-400/60 to-rose-500/60" />
          </div>
          {lowFundingProposals.length > 0 && (
            <div className="glass rounded-xl p-3 mt-4 flex items-start gap-2">
              <Lightbulb size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-ink-300">
                <span className="text-emerald-700 font-medium">{t(lowFundingProposals.length === 1 ? '{count} low-budget proposal' : '{count} low-budget proposals', { count: lowFundingProposals.length })}</span> {t('— consider consolidating or prioritizing for quick wins.')}
              </p>
            </div>
          )}
        </div>

        {/* Oman Vision 2040 alignment */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-ink-100 mb-4 flex items-center gap-2">
            <Target size={16} className="text-brand-600" />
            {t('Oman Vision 2040 Alignment')}
          </h3>
          <div className="space-y-2.5">
            {OMAN_VISION_PILLARS.map((pillar) => {
              const count = pillarAlignment[pillar] ?? 0;
              const pct = (count / maxPillarCount) * 100;
              return (
                <div key={pillar}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-ink-200">{t(pillar)}</span>
                    <span className="text-xs font-semibold text-ink-100">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-ink-700/20">
            <p className="text-[10px] text-ink-400">
              {t('Based on keyword alignment with Vision 2040 strategic pillars across {count} proposals', { count: proposals.length })}
            </p>
          </div>
        </div>

        {/* Trending topics */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-ink-100 mb-4 flex items-center gap-2">
            <Flame size={16} className="text-rose-500" />
            {t('Trending Research Topics')}
          </h3>
          {trendingTopics.length === 0 ? (
            <p className="text-sm text-ink-400">{t('No keyword data yet')}</p>
          ) : (
            <div className="space-y-2">
              {trendingTopics.map(([topic, count], i) => (
                <div key={topic} className="flex items-center gap-3">
                  <span className={`text-xs font-bold ${i < 3 ? 'text-brand-600' : 'text-ink-400'} w-4`}>{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-ink-200 capitalize">{topic}</span>
                      <span className="text-xs font-semibold text-ink-100">{count}</span>
                    </div>
                    <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
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

      {/* Status + Area + Assessment overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Proposal status breakdown */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-ink-100 mb-4 flex items-center gap-2">
            <FileText size={16} className="text-brand-600" />
            {t('Proposal Status')}
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
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.bar} transition-all duration-500`}
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
            <BarChart3 size={16} className="text-slate-600" />
            {t('Research Areas')}
          </h3>
          {topAreas.length === 0 ? (
            <p className="text-sm text-ink-400">{t('No data yet')}</p>
          ) : (
            <div className="space-y-3">
              {topAreas.map(([area, count]) => (
                <div key={area}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-ink-200">{t(area)}</span>
                    <span className="text-xs font-semibold text-ink-100">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-slate-500 to-slate-600 transition-all duration-500"
                      style={{ width: `${(count / maxAreaCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assessment overview */}
        <div className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center">
          <h3 className="text-sm font-semibold text-ink-100 mb-4 self-start flex items-center gap-2">
            <ClipboardCheck size={16} className="text-slate-600" />
            {t('Assessment Overview')}
          </h3>
          <ScoreRing score={avgScore} size={120} />
          <p className="text-xs text-ink-300 mt-3 text-center">{t('Average criteria score across assessed proposals')}</p>
          <div className="grid grid-cols-2 gap-2 w-full mt-4">
            {bands.map((b) => (
              <div key={b.label} className={`rounded-lg p-2.5 text-center ring-1 ${TONE_CLASSES[b.tone]}`}>
                <p className="text-lg font-bold">{b.count}</p>
                <p className="text-[10px]">{t(b.label)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent proposals + Top ranked */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-ink-100 mb-4">{t('Recent Proposals')}</h3>
          {recentProposals.length === 0 ? (
            <p className="text-sm text-ink-400">{t('No proposals yet')}</p>
          ) : (
            <div className="space-y-3">
              {recentProposals.map((p) => (
                <div key={p.id} className="flex items-start gap-3 group">
                  <div className="glass rounded-lg p-2 mt-0.5 group-hover:bg-slate-50 transition-colors">
                    <FileText size={14} className="text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-100 truncate" dir="auto">{p.title}</p>
                    <p className="text-xs text-ink-300" dir="auto">{p.author} · {formatDate(p.publication_date)}</p>
                  </div>
                  <span className={`badge badge-${p.status}`}>{statusLabel(p.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-ink-100 mb-4 flex items-center gap-2">
            <Trophy size={16} className="text-amber-500" />
            {t('Top Ranked Proposals')}
          </h3>
          {topRanked.length === 0 ? (
            <p className="text-sm text-ink-400">{t('No assessed proposals yet — upload proposals to assess and rank them')}</p>
          ) : (
            <div className="space-y-3">
              {topRanked.map((r) => {
                const v = verdict(r.score);
                return (
                  <div key={r.proposal.id} className="flex items-center gap-3">
                    <span className="w-6 text-center text-sm font-bold text-ink-300">{r.rank}</span>
                    <ScoreRing score={r.score} size={44} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-100 truncate" dir="auto">{r.proposal.title}</p>
                      <p className="text-xs text-ink-300 truncate" dir="auto">{r.proposal.author}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 flex-shrink-0 ${TONE_CLASSES[v.tone]}`}>{t(v.label)}</span>
                  </div>
                );
              })}
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
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
