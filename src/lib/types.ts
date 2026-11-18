// Data shapes returned by the Django REST API (backend/research/serializers.py).

export type ProposalStatus = 'pending' | 'under_review' | 'approved' | 'rejected';

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
  /** What the AI said when it assessed the proposal (empty when it was scored by hand). */
  ai_assessment: Partial<EvaluationSuggestion>;
  /** How well the proposal meets the criteria: all criterion scores as a % of the maximum (from the server). */
  score: number;
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

/** Claude's assessment against the criteria (POST /api/ai/evaluate/). Reviewers adjust and submit the final scores. */
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
