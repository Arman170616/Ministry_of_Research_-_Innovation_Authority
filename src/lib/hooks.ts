import { useCallback, useEffect, useState } from 'react';
import { apiRequest, apiRequestWithHeaders } from '@/lib/api';
import type {
  Proposal, Publication, MatchWithRelations, Match, Evaluation, ExtractedDocument, EvaluationSuggestion, MatchRun,
} from '@/lib/types';

/**
 * Several components load the same lists independently. After any change we
 * broadcast which collections changed so every mounted list reloads, the way
 * live updates used to keep them in sync.
 */
type Collection = 'proposals' | 'publications' | 'matches';
const CHANGE_EVENT = 'ria:data-changed';

function notifyChanged(...collections: Collection[]) {
  window.dispatchEvent(new CustomEvent<Collection[]>(CHANGE_EVENT, { detail: collections }));
}

function useCollection<T>(collection: Collection, path: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await apiRequest<T[]>(path);
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    refresh();
    const onChange = (e: Event) => {
      if ((e as CustomEvent<Collection[]>).detail.includes(collection)) refresh();
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, [collection, refresh]);

  return { items, loading, error, refresh };
}

export function useProposals() {
  const { items, ...rest } = useCollection<Proposal>('proposals', '/proposals/');
  return { proposals: items, ...rest };
}

export function usePublications() {
  const { items, ...rest } = useCollection<Publication>('publications', '/publications/');
  return { publications: items, ...rest };
}

export function useMatches() {
  const { items, ...rest } = useCollection<MatchWithRelations>('matches', '/matches/');
  return { matches: items, ...rest };
}

export async function createProposal(
  input: Omit<Proposal, 'id' | 'created_at' | 'user_id'> & { document_text?: string },
): Promise<Proposal | null> {
  try {
    const proposal = await apiRequest<Proposal>('/proposals/', { method: 'POST', body: input });
    notifyChanged('proposals');
    return proposal;
  } catch {
    return null;
  }
}

export async function createPublication(input: Omit<Publication, 'id' | 'created_at'>): Promise<boolean> {
  try {
    await apiRequest('/publications/', { method: 'POST', body: input });
    notifyChanged('publications');
    return true;
  } catch {
    return false;
  }
}

export async function updateProposalStatus(id: string, status: string): Promise<boolean> {
  try {
    await apiRequest(`/proposals/${id}/`, { method: 'PATCH', body: { status } });
    notifyChanged('proposals', 'matches');
    return true;
  } catch {
    return false;
  }
}

/** Deleting a proposal also deletes its matches and evaluations on the server. */
export async function deleteProposal(id: string): Promise<boolean> {
  try {
    await apiRequest(`/proposals/${id}/`, { method: 'DELETE' });
    notifyChanged('proposals', 'matches');
    return true;
  } catch {
    return false;
  }
}

export async function updateMatch(id: string, updates: Partial<Match>): Promise<boolean> {
  try {
    await apiRequest(`/matches/${id}/`, { method: 'PATCH', body: updates });
    notifyChanged('matches');
    return true;
  } catch {
    return false;
  }
}

/** Creates the reviewer's evaluation for a proposal, or updates it if one exists. */
export async function saveEvaluation(input: Omit<Evaluation, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Evaluation | null> {
  try {
    return await apiRequest<Evaluation>('/evaluations/', { method: 'POST', body: input });
  } catch {
    return null;
  }
}

/**
 * Runs matching on the server for every proposal (Claude when AI is enabled, keyword overlap otherwise).
 * Throws ApiError with a readable message on failure.
 */
export async function generateMatches(): Promise<{ count: number } & MatchRun> {
  const result = await apiRequest<{ count: number } & MatchRun>('/matches/generate/', { method: 'POST', body: {} });
  notifyChanged('matches');
  return result;
}

/** Runs matching for one proposal and returns its matches, best first. */
export async function generateMatchesForProposal(proposalId: string): Promise<{ matches: MatchWithRelations[] } & MatchRun> {
  try {
    const { data, headers } = await apiRequestWithHeaders<MatchWithRelations[]>('/matches/generate/', {
      method: 'POST',
      body: { proposal_id: proposalId },
    });
    notifyChanged('matches');
    return {
      matches: data,
      method: headers.get('X-Match-Method') === 'ai' ? 'ai' : 'keyword',
      warning: headers.get('X-Match-Warning'),
    };
  } catch (err) {
    return { matches: [], method: 'keyword', warning: err instanceof Error ? err.message : 'Matching failed' };
  }
}

/** Claude reads an uploaded PDF/TXT proposal and returns the form fields. Throws ApiError on failure. */
export async function extractDocument(file: File): Promise<ExtractedDocument> {
  const form = new FormData();
  form.append('file', file);
  return apiRequest<ExtractedDocument>('/ai/extract/', { method: 'POST', body: form });
}

/** Claude suggests scores for every evaluation criterion. Throws ApiError on failure. */
export async function suggestEvaluation(proposalId: string): Promise<EvaluationSuggestion> {
  return apiRequest<EvaluationSuggestion>('/ai/evaluate/', { method: 'POST', body: { proposal_id: proposalId } });
}
