import type { ProposalStatus } from '@/lib/types';
import { getLang, locale, translate } from '@/lib/i18n';

export function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString(locale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatNumber(value: number): string {
  return value.toLocaleString(locale(), { maximumFractionDigits: 0 });
}

/** "OMR 72,000" in English, "72,000 ر.ع." in Arabic. */
export function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '—';
  const n = formatNumber(amount);
  return getLang() === 'ar' ? `${n} ر.ع.` : `OMR ${n}`;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function statusLabel(status: string): string {
  return translate(STATUS_LABELS[status] ?? status.replace(/_/g, ' '));
}

export const PROPOSAL_STATUSES: ProposalStatus[] = ['pending', 'under_review', 'approved', 'rejected'];

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
