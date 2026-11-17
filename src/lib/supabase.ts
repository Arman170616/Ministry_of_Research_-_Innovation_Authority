import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

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
  user_id: string | null;
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
  user_id: string | null;
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
