import { useEffect, useState } from 'react';
import { supabase, type Proposal, type Publication, type MatchWithRelations, type Match, type Evaluation } from '@/lib/supabase';

export function useProposals() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setProposals(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel('proposals-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals' }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return { proposals, loading, error, refresh };
}

export function usePublications() {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('publications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setPublications(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel('publications-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'publications' }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return { publications, loading, error, refresh };
}

export function useMatches() {
  const [matches, setMatches] = useState<MatchWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('matches')
      .select('*, proposal:proposals(*), publication:publications(*)')
      .order('match_score', { ascending: false });
    if (error) setError(error.message);
    else setMatches(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel('matches-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return { matches, loading, error, refresh };
}

export async function createProposal(input: Omit<Proposal, 'id' | 'created_at' | 'user_id'>): Promise<Proposal | null> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('proposals').insert([{ ...input, user_id: user?.id ?? null }]).select().single();
  if (error) return null;
  return data as Proposal;
}

export async function createPublication(input: Omit<Publication, 'id' | 'created_at'>): Promise<boolean> {
  const { error } = await supabase.from('publications').insert([input]);
  return !error;
}

export async function updateProposalStatus(id: string, status: string): Promise<boolean> {
  const { error } = await supabase.from('proposals').update({ status }).eq('id', id);
  return !error;
}

export async function deleteProposal(id: string): Promise<boolean> {
  await supabase.from('matches').delete().eq('proposal_id', id);
  const { error } = await supabase.from('proposals').delete().eq('id', id);
  return !error;
}

export async function updateMatch(id: string, updates: Partial<Match>): Promise<boolean> {
  const { error } = await supabase.from('matches').update(updates).eq('id', id);
  return !error;
}

export async function saveEvaluation(input: Omit<Evaluation, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Evaluation | null> {
  const { data, error } = await supabase.from('evaluations').upsert([input], { onConflict: 'proposal_id,user_id' }).select().single();
  if (error) return null;
  return data as Evaluation;
}

export async function generateMatches(): Promise<number> {
  const [{ data: proposals }, { data: publications }] = await Promise.all([
    supabase.from('proposals').select('*'),
    supabase.from('publications').select('*'),
  ]);

  if (!proposals || !publications) return 0;

  const rows: { proposal_id: string; publication_id: string; match_score: number; matched_keywords: string[] }[] = [];
  for (const p of proposals) {
    for (const pub of publications) {
      const pk = p.keywords ?? [];
      const bk = pub.keywords ?? [];
      const overlap = pk.filter((k: string) => bk.includes(k));
      if (overlap.length > 0) {
        rows.push({
          proposal_id: p.id,
          publication_id: pub.id,
          match_score: Math.min(100, overlap.length * 20),
          matched_keywords: overlap,
        });
      }
    }
  }

  if (rows.length === 0) return 0;

  const { data, error } = await supabase
    .from('matches')
    .upsert(rows, { onConflict: 'proposal_id,publication_id', ignoreDuplicates: false })
    .select();

  return data?.length ?? 0;
}

export async function generateMatchesForProposal(proposalId: string): Promise<MatchWithRelations[]> {
  const { data: proposal } = await supabase.from('proposals').select('*').eq('id', proposalId).maybeSingle();
  const { data: publications } = await supabase.from('publications').select('*');
  if (!proposal || !publications) return [];

  const pk = proposal.keywords ?? [];
  const rows: { proposal_id: string; publication_id: string; match_score: number; matched_keywords: string[] }[] = [];
  for (const pub of publications) {
    const bk = pub.keywords ?? [];
    const overlap = pk.filter((k: string) => bk.includes(k));
    if (overlap.length > 0) {
      rows.push({
        proposal_id: proposalId,
        publication_id: pub.id,
        match_score: Math.min(100, overlap.length * 20),
        matched_keywords: overlap,
      });
    }
  }

  if (rows.length === 0) return [];

  await supabase
    .from('matches')
    .upsert(rows, { onConflict: 'proposal_id,publication_id', ignoreDuplicates: false });

  const { data } = await supabase
    .from('matches')
    .select('*, proposal:proposals(*), publication:publications(*)')
    .eq('proposal_id', proposalId)
    .order('match_score', { ascending: false });

  return (data as MatchWithRelations[]) ?? [];
}
