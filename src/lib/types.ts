// Data shapes returned by the Django REST API (backend/research/serializers.py).

export type ProposalStatus = 'pending' | 'under_review' | 'approved' | 'rejected';
export type MatchStatus = 'pending' | 'reviewed' | 'accepted' | 'rejected';

export interface Proposal {
  id: string;
  title: string;
  author: string;
  author_email: string | null;
  institution: string | null;
  research_area: string | null;
  abstract: string | null;
  document_url: string | null;
  status: ProposalStatus;
  funding_requested: number | null;
  publication_date: string | null;
  keywords: string[];
  user_id: number | null;
  created_at: string;
}

export interface Publication {
  id: string;
  title: string;
  authors: string;
  journal: string | null;
  research_area: string | null;
  abstract: string | null;
  document_url: string | null;
  doi: string | null;
  publication_date: string | null;
  keywords: string[];
  citation_count: number;
  created_at: string;
}

export interface Match {
  id: string;
  proposal_id: string;
  publication_id: string;
  match_score: number;
  matched_keywords: string[];
  /** 'ai' = Claude judged relevance by meaning; 'keyword' = exact keyword overlap. */
  method: 'ai' | 'keyword';
  /** Claude's one-sentence reason for the match (empty for keyword matches). */
  rationale: string;
  status: MatchStatus;
  reviewed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface MatchWithRelations extends Match {
  proposal?: Proposal;
  publication?: Publication;
}

export interface Evaluation {
  id: string;
  proposal_id: string;
  user_id: number | null;
  a_scores: number[];
  b_scores: number[];
  c_scores: number[];
  scientific_capacity: number;
  leadership: number;
  team_size: number;
  recommendation: 'recommend' | 'do_not_fund' | null;
  evaluator_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
}

/** Fields Claude read from an uploaded proposal document (POST /api/ai/extract/). */
export interface ExtractedDocument {
  is_research_proposal: boolean;
  title: string;
  author: string;
  author_email: string;
  institution: string;
  research_area: string;
  abstract: string;
  funding_requested: number;
  publication_date: string;
  keywords: string[];
  missing_fields: string[];
  document_text: string;
}

export interface CriterionSuggestion {
  score: number;
  reason: string;
}

/** Claude's suggested evaluation (POST /api/ai/evaluate/). Reviewers adjust and submit the final scores. */
export interface EvaluationSuggestion {
  a: CriterionSuggestion[];
  b: CriterionSuggestion[];
  c: CriterionSuggestion[];
  scientific_capacity: number;
  leadership: number;
  team_size: number;
  recommendation: 'recommend' | 'do_not_fund' | null;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  model: string;
}

export interface MatchRun {
  method: 'ai' | 'keyword';
  warning: string | null;
}
