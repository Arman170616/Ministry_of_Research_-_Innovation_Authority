import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import type { Lang } from '@/lib/i18n';
import type { Proposal, Evaluation, ExtractedDocument, EvaluationSuggestion } from '@/lib/types';

/**
 * Several components load the same lists independently. After any change we
 * broadcast which collections changed so every mounted list reloads.
 */
type Collection = 'proposals' | 'evaluations';
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

/** Evaluations of every proposal the user can see (staff: all), newest first. */
export function useEvaluations() {
  const { items, ...rest } = useCollection<Evaluation>('evaluations', '/evaluations/');
  return { evaluations: items, ...rest };
}

export type NewProposal = Omit<Proposal, 'id' | 'created_at' | 'user_id'> & { document_text?: string };

export async function createProposal(input: NewProposal): Promise<Proposal | null> {
  try {
    const proposal = await apiRequest<Proposal>('/proposals/', { method: 'POST', body: input });
    notifyChanged('proposals');
    return proposal;
  } catch {
    return null;
  }
}

export async function updateProposal(id: string, updates: Partial<NewProposal>): Promise<Proposal | null> {
  try {
    const proposal = await apiRequest<Proposal>(`/proposals/${id}/`, { method: 'PATCH', body: updates });
    notifyChanged('proposals');
    return proposal;
  } catch {
    return null;
  }
}

export async function updateProposalStatus(id: string, status: string): Promise<boolean> {
  return (await updateProposal(id, { status: status as Proposal['status'] })) !== null;
}

/** Deleting a proposal also deletes its evaluations on the server. */
export async function deleteProposal(id: string): Promise<boolean> {
  try {
    await apiRequest(`/proposals/${id}/`, { method: 'DELETE' });
    notifyChanged('proposals', 'evaluations');
    return true;
  } catch {
    return false;
  }
}

export type EvaluationInput = Omit<Evaluation, 'id' | 'user_id' | 'score' | 'created_at' | 'updated_at'>;

/** Creates the reviewer's evaluation for a proposal, or updates it if one exists. */
export async function saveEvaluation(input: EvaluationInput): Promise<Evaluation | null> {
  try {
    const evaluation = await apiRequest<Evaluation>('/evaluations/', { method: 'POST', body: input });
    notifyChanged('evaluations');
    return evaluation;
  } catch {
    return null;
  }
}

/** Claude reads an uploaded PDF/TXT proposal and returns the form fields. Throws ApiError on failure. */
export async function extractDocument(file: File): Promise<ExtractedDocument> {
  const form = new FormData();
  form.append('file', file);
  return apiRequest<ExtractedDocument>('/ai/extract/', { method: 'POST', body: form });
}

export interface AssessInput {
  title: string;
  author: string;
  institution: string;
  research_area: string;
  funding_requested: number;
  keywords: string[];
  abstract: string;
  document_text: string;
}

/** Claude assesses a proposal (saved or not) against every criterion. Throws ApiError on failure. */
export async function assessProposal(input: AssessInput, language: Lang = 'en'): Promise<EvaluationSuggestion> {
  return apiRequest<EvaluationSuggestion>('/ai/evaluate/', { method: 'POST', body: { ...input, language } });
}
