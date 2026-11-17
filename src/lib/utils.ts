import type { ProposalStatus, MatchStatus } from '@/lib/supabase';

export function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '—';
  return `OMR ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

export const PROPOSAL_STATUSES: ProposalStatus[] = ['pending', 'under_review', 'approved', 'rejected'];
export const MATCH_STATUSES: MatchStatus[] = ['pending', 'reviewed', 'accepted', 'rejected'];

export const RESEARCH_AREAS = [
  'Renewable Energy',
  'Water Resources',
  'Public Health',
  'Marine Biology',
  'Energy Systems',
  'Cultural Heritage',
  'Environmental Science',
  'Education',
  'Agriculture',
  'Information Technology',
  'Economics',
  'Social Sciences',
  'Tourism & Hospitality',
  'Green Hydrogen',
  'Artificial Intelligence',
  'Digital Transformation',
  'Climate Change',
  'Food Security',
  'Logistics & Transport',
  'Manufacturing & Industry',
];

export const OMAN_VISION_PILLARS = [
  'Economic Diversification',
  'Sustainability & Environment',
  'Human Capital & Education',
  'Innovation & Technology',
  'Health & Wellbeing',
  'Heritage & Culture',
];

export const FUNDING_TIERS = {
  LOW: 30000,
  MEDIUM: 75000,
  HIGH: 150000,
};
