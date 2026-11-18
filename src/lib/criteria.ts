import type { Evaluation, Proposal } from '@/lib/types';

/**
 * The authority's official evaluation criteria and how scores are combined.
 * Keep the criteria in sync with CRITERIA in backend/research/ai.py.
 */
export const APPENDICES = [
  {
    key: 'a' as const,
    letter: 'A',
    title: 'Initial Proposal Evaluation',
    arabic: 'التقييم المبدئي للمقترح البحثي',
    criteria: [
      'Importance of the proposal to Oman & its link to the challenge in the call',
      'Novelty and scientific accuracy',
      'Clarity of objectives, methodology and expected results',
      'Applicability of the research project outputs',
      'Impact of expected outputs (health, social, economic, environmental)',
      'Suitability of the proposed timeframe to achieve objectives',
      'Local & international partnerships (number and strength of collaboration)',
      'Suitability of the proposed budget for the project',
    ],
  },
  {
    key: 'b' as const,
    letter: 'B',
    title: 'Institutional Challenge Linkage & Impact',
    arabic: 'الربط بتحديات المؤسسة والأثر',
    criteria: [
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
    ],
  },
  {
    key: 'c' as const,
    letter: 'C',
    title: 'Research Excellence',
    arabic: 'التميز البحثي',
    criteria: [
      'Innovation and novelty of the research idea',
      'Comprehensiveness of the literature review',
      'Clarity in describing the challenge',
      'Quality of objectives & their link to the methodology',
      'Quality of methodology, work plan & timeline',
      'Importance & applicability of expected results',
    ],
  },
];

export type AppendixKey = (typeof APPENDICES)[number]['key'];
export type Scores = Record<AppendixKey, number[]>;

export const SCORE_SCALE = [
  { range: '9 – 10', label: 'All aspects of the criterion met successfully' },
  { range: '7 – 8', label: 'Most aspects met, with room to develop some' },
  { range: '5 – 6', label: 'Some aspects met generally, with gaps to improve' },
  { range: '3 – 4', label: 'Serious points of weakness identified' },
  { range: '1 – 2', label: 'Criterion not met in a satisfactory way' },
];

export function defaultScores(value = 5): Scores {
  return {
    a: APPENDICES[0].criteria.map(() => value),
    b: APPENDICES[1].criteria.map(() => value),
    c: APPENDICES[2].criteria.map(() => value),
  };
}

/** Points as a whole-number percentage of the maximum (10 per criterion). */
export function percent(scores: number[]): number {
  if (scores.length === 0) return 0;
  return Math.round((scores.reduce((s, v) => s + v, 0) / (scores.length * 10)) * 100);
}

/** Overall score: every criterion counts equally. Matches Evaluation.score on the server. */
export function overallPercent(scores: Scores): number {
  return percent([...scores.a, ...scores.b, ...scores.c]);
}

/** How well the proposal meets the criteria, in words. */
export function verdict(score: number): { label: string; tone: 'emerald' | 'sky' | 'amber' | 'rose' } {
  if (score >= 75) return { label: 'Strong match', tone: 'emerald' };
  if (score >= 60) return { label: 'Good match', tone: 'sky' };
  if (score >= 45) return { label: 'Partial match', tone: 'amber' };
  return { label: 'Weak match', tone: 'rose' };
}

export const TONE_CLASSES: Record<'emerald' | 'sky' | 'amber' | 'rose', string> = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
};

/** Keywords that map a proposal to the Oman Vision 2040 pillars. */
export const PILLAR_KEYWORDS: Record<string, string[]> = {
  'Economic Diversification': ['tourism', 'economic diversification', 'manufacturing', 'logistics', 'blockchain', 'digital transformation'],
  'Sustainability & Environment': ['solar energy', 'renewable energy', 'coral reef', 'marine conservation', 'climate change', 'water security', 'green hydrogen', 'sustainability'],
  'Human Capital & Education': ['education', 'youth', 'rural health', 'diagnostics'],
  'Innovation & Technology': ['artificial intelligence', 'iot', 'blockchain', 'sensors', '3d scanning', 'machine learning', 'digital preservation'],
  'Health & Wellbeing': ['healthcare', 'mental health', 'telemedicine', 'diabetes', 'digital health', 'counseling', 'rural health'],
  'Heritage & Culture': ['cultural heritage', 'digital preservation', 'manuscripts', 'archaeology', 'heritage'],
};

export function alignedPillars(keywords: string[]): string[] {
  const kws = keywords.map((k) => k.toLowerCase());
  return Object.keys(PILLAR_KEYWORDS).filter((p) => kws.some((k) => PILLAR_KEYWORDS[p].includes(k)));
}

export interface RankedProposal {
  rank: number;
  proposal: Proposal;
  /** The most recent evaluation, used for the matching report. */
  evaluation: Evaluation;
  /** Average over all reviewers' evaluations (usually one). */
  score: number;
  sections: Record<AppendixKey, number>;
  reviewers: number;
}

/**
 * Rank assessed proposals best first. Proposals with equal scores share a rank (1, 2, 2, 4).
 * Proposals without an evaluation are returned separately.
 */
export function rankProposals(proposals: Proposal[], evaluations: Evaluation[]): { ranked: RankedProposal[]; unassessed: Proposal[] } {
  const byProposal = new Map<string, Evaluation[]>();
  for (const e of evaluations) byProposal.set(e.proposal_id, [...(byProposal.get(e.proposal_id) ?? []), e]);

  const avg = (xs: number[]) => Math.round(xs.reduce((s, v) => s + v, 0) / xs.length);
  const rows: Omit<RankedProposal, 'rank'>[] = [];
  const unassessed: Proposal[] = [];
  for (const proposal of proposals) {
    const evs = byProposal.get(proposal.id);
    if (!evs?.length) { unassessed.push(proposal); continue; }
    const latest = [...evs].sort((x, y) => y.updated_at.localeCompare(x.updated_at))[0];
    rows.push({
      proposal,
      evaluation: latest,
      score: avg(evs.map((e) => e.score)),
      sections: {
        a: avg(evs.map((e) => percent(e.a_scores))),
        b: avg(evs.map((e) => percent(e.b_scores))),
        c: avg(evs.map((e) => percent(e.c_scores))),
      },
      reviewers: evs.length,
    });
  }
  rows.sort((x, y) => y.score - x.score || y.sections.c - x.sections.c || x.proposal.title.localeCompare(y.proposal.title));
  const ranked = rows.map((r, i) => ({ ...r, rank: i > 0 && rows[i - 1].score === r.score ? 0 : i + 1 }));
  ranked.forEach((r, i) => { if (r.rank === 0) r.rank = ranked[i - 1].rank; });
  return { ranked, unassessed };
}
