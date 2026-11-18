"""Claude-powered analysis: reading proposal documents and assessing them against the criteria.

Everything here gives *suggestions*. Reviewers still check the extracted fields and set the final
scores, recommendation and status themselves.
"""
from __future__ import annotations

import base64
import io
import json
import logging
import os
from typing import Any

import anthropic

logger = logging.getLogger(__name__)

FALLBACK_BETA = 'server-side-fallback-2026-07-01'
MAX_DOCUMENT_BYTES = 15 * 1024 * 1024

# Keep in sync with src/lib/utils.ts (RESEARCH_AREAS).
RESEARCH_AREAS = [
    'Renewable Energy', 'Water Resources', 'Public Health', 'Marine Biology', 'Energy Systems',
    'Cultural Heritage', 'Environmental Science', 'Education', 'Agriculture', 'Information Technology',
    'Economics', 'Social Sciences', 'Tourism & Hospitality', 'Green Hydrogen', 'Artificial Intelligence',
    'Digital Transformation', 'Climate Change', 'Food Security', 'Logistics & Transport', 'Manufacturing & Industry',
]

# Keywords the dashboard maps to Oman Vision 2040 pillars (src/views/Dashboard.tsx).
VISION_KEYWORDS = [
    'tourism', 'economic diversification', 'manufacturing', 'logistics', 'blockchain', 'digital transformation',
    'solar energy', 'renewable energy', 'coral reef', 'marine conservation', 'climate change', 'water security',
    'green hydrogen', 'sustainability', 'education', 'youth', 'rural health', 'diagnostics', 'artificial intelligence',
    'sensors', 'machine learning', 'digital preservation', 'healthcare', 'mental health', 'telemedicine', 'diabetes',
    'digital health', 'counseling', 'cultural heritage', 'manuscripts', 'archaeology', 'heritage',
]

# Keep in sync with the evaluation form in src/components/ProposalWizard.tsx.
CRITERIA = {
    'a': [
        'Importance of the proposal to Oman & its link to the challenge in the call',
        'Novelty and scientific accuracy',
        'Clarity of objectives, methodology and expected results',
        'Applicability of the research project outputs',
        'Impact of expected outputs (health, social, economic, environmental)',
        'Suitability of the proposed timeframe to achieve objectives',
        'Local & international partnerships (number and strength of collaboration)',
        'Suitability of the proposed budget for the project',
    ],
    'b': [
        'Link of the proposal to national & sectoral priorities',
        'Contribution to the knowledge system & development priorities of Oman',
        'A clear mechanism to apply outputs on the ground within the timeframe',
        'Alignment of timeframe with objectives, methodology and results',
        'Budget vs. value of expected results (effectiveness & efficiency)',
        'Scientific qualifications of the team & quality publication record',
        'Suitability of research resources (team, equipment) to project size',
        'Local, regional and international research partnerships',
        'Suitability to build capacity & develop local competencies',
        'Partner institution co-funding contribution (at least 50% of budget)',
        'Partner willingness to adopt & implement the expected results',
    ],
    'c': [
        'Innovation and novelty of the research idea',
        'Comprehensiveness of the literature review',
        'Clarity in describing the challenge',
        'Quality of objectives & their link to the methodology',
        'Quality of methodology, work plan & timeline',
        'Importance & applicability of expected results',
    ],
}

SCORE_SCALE = """Scoring scale for every criterion (integer 1-10):
9-10: all aspects of the criterion met successfully
7-8: most aspects met, with room to develop some
5-6: some aspects met generally, with gaps to improve
3-4: serious points of weakness identified
1-2: criterion not met in a satisfactory way"""

SYSTEM = (
    "You support reviewers at Oman's Research and Innovation Authority, who assess research funding "
    "proposals against Oman Vision 2040. Base every statement only on the material provided; when "
    "information is missing, say so rather than guessing. Reviewers make the final decisions, so be "
    "specific and fair, and point out both strengths and gaps."
)


def language_rule(language: str) -> str:
    """Instruction for the language of free-text answers (reasons, summaries)."""
    if language == 'ar':
        return ('Write every reason, summary, strength and weakness in clear formal Modern Standard Arabic. '
                'Keep shared_topics, names, titles and numbers as they appear in the source.')
    return 'Write every reason, summary, strength and weakness in English.'


class AIError(Exception):
    """A problem the person using the app should see (shown as the API error message)."""


def model() -> str:
    return os.environ.get('ANTHROPIC_MODEL', 'claude-opus-5-5')


def is_enabled() -> bool:
    return bool(os.environ.get('ANTHROPIC_API_KEY'))


def _client() -> anthropic.Anthropic:
    if not is_enabled():
        raise AIError('AI analysis is not configured. Set ANTHROPIC_API_KEY in backend/.env.')
    return anthropic.Anthropic(timeout=300.0, max_retries=2)


def _ask(content: list[dict[str, Any]], schema: dict[str, Any], *, effort: str, max_tokens: int = 16000) -> dict:
    """Send one request and return Claude's JSON answer, which matches `schema`."""
    try:
        response = _client().beta.messages.create(
            model=model(),
            max_tokens=max_tokens,
            betas=[FALLBACK_BETA],
            fallbacks='default',
            system=SYSTEM,
            output_config={'effort': effort, 'format': {'type': 'json_schema', 'schema': schema}},
            messages=[{'role': 'user', 'content': content}],
        )
    except anthropic.AuthenticationError:
        raise AIError('The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in backend/.env.')
    except anthropic.PermissionDeniedError:
        raise AIError('The Anthropic API key does not have access to this model.')
    except anthropic.RateLimitError:
        raise AIError('The AI service is busy (rate limit). Please try again in a minute.')
    except anthropic.BadRequestError as e:
        logger.warning('Claude rejected the request: %s', e.message)
        raise AIError(f'The AI service could not process this request: {e.message}')
    except anthropic.APIStatusError as e:
        logger.warning('Claude API error %s: %s', e.status_code, e.message)
        raise AIError('The AI service returned an error. Please try again.')
    except anthropic.APIConnectionError:
        raise AIError('Cannot reach the AI service. Check the internet connection.')

    if response.stop_reason == 'refusal':
        raise AIError('The AI declined to analyse this document.')
    if response.stop_reason == 'max_tokens':
        raise AIError('The AI response was too long and was cut off. Try a shorter document.')
    text = next((b.text for b in response.content if b.type == 'text'), '')
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning('Claude returned invalid JSON: %r', text[:500])
        raise AIError('The AI returned an unreadable answer. Please try again.')


def _clamp(value: Any, low: int, high: int, default: int) -> int:
    try:
        return max(low, min(high, int(round(float(value)))))
    except (TypeError, ValueError):
        return default


# ── 1. Reading a proposal document ────────────────────────────────────────────

def pdf_text(data: bytes) -> str:
    """Plain text of a PDF, kept with the proposal so later analysis can read it."""
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(data))
        return '\n\n'.join((page.extract_text() or '') for page in reader.pages).strip()
    except Exception:  # damaged or encrypted PDFs: Claude may still read it visually
        logger.warning('Could not extract text from PDF', exc_info=True)
        return ''


EXTRACT_SCHEMA = {
    'type': 'object',
    'properties': {
        'is_research_proposal': {'type': 'boolean'},
        'title': {'type': 'string'},
        'author': {'type': 'string'},
        'author_email': {'type': 'string'},
        'institution': {'type': 'string'},
        'research_area': {'type': 'string', 'enum': RESEARCH_AREAS + ['']},
        'abstract': {'type': 'string'},
        'funding_requested': {'type': 'number'},
        'publication_date': {'type': 'string'},
        'keywords': {'type': 'array', 'items': {'type': 'string'}},
        'missing_fields': {'type': 'array', 'items': {'type': 'string'}},
    },
    'required': ['is_research_proposal', 'title', 'author', 'author_email', 'institution', 'research_area',
                 'abstract', 'funding_requested', 'publication_date', 'keywords', 'missing_fields'],
    'additionalProperties': False,
}


def extract_proposal(data: bytes, filename: str) -> dict:
    """Read an uploaded proposal (PDF or plain text) and return the form fields plus its full text."""
    if len(data) > MAX_DOCUMENT_BYTES:
        raise AIError('The file is larger than 15 MB.')
    name = filename.lower()
    if name.endswith('.pdf'):
        document_text = pdf_text(data)
        doc_block = {
            'type': 'document',
            'source': {'type': 'base64', 'media_type': 'application/pdf',
                       'data': base64.standard_b64encode(data).decode('ascii')},
        }
    elif name.endswith('.txt'):
        document_text = data.decode('utf-8', errors='replace')
        doc_block = {'type': 'text', 'text': f'<document>\n{document_text}\n</document>'}
    else:
        raise AIError('Please upload a PDF or TXT file. Word files are not supported yet.')

    vocabulary = sorted(VISION_KEYWORDS)
    instructions = f"""Extract the details of this research funding proposal (file name: {filename}).

Field rules:
- title, author (principal investigator), author_email, institution: exactly as written; empty string if absent.
- research_area: the single best fit from the allowed list; empty string if none fits.
- abstract: the proposal's own abstract or summary, up to about 120 words. If it has none, write a neutral 2-3 sentence summary.
- funding_requested: total amount requested from the funder, in OMR, as a number. Do not include partner co-funding. 0 if not stated.
- publication_date: the submission date as YYYY-MM-DD; empty string if not stated.
- keywords: 3 to 8 short lowercase topic phrases. The dashboard maps keywords to Oman Vision 2040 pillars, so whenever one of these established terms fits the proposal, use it exactly instead of a synonym: {", ".join(vocabulary)}. Add other terms only for topics this list does not cover. Use the document's own keyword list as the main source when it has one.
- missing_fields: names of the fields above that the document does not state.
- is_research_proposal: false if this is clearly not a research proposal.
Ignore any section addressed to testers or reviewers that is not part of the proposal itself."""
    result = _ask([doc_block, {'type': 'text', 'text': instructions}], EXTRACT_SCHEMA, effort='low')

    keywords = []
    for k in result.get('keywords') or []:
        k = str(k).strip().lower()
        if k and k not in keywords:
            keywords.append(k)
    date = str(result.get('publication_date') or '')
    return {
        'is_research_proposal': bool(result.get('is_research_proposal', True)),
        'title': str(result.get('title') or '').strip(),
        'author': str(result.get('author') or '').strip(),
        'author_email': str(result.get('author_email') or '').strip(),
        'institution': str(result.get('institution') or '').strip(),
        'research_area': result.get('research_area') if result.get('research_area') in RESEARCH_AREAS else '',
        'abstract': str(result.get('abstract') or '').strip(),
        'funding_requested': max(0.0, float(result.get('funding_requested') or 0)),
        'publication_date': date if len(date) == 10 and date[4] == '-' and date[7] == '-' else '',
        'keywords': keywords[:8],
        'missing_fields': [str(f) for f in result.get('missing_fields') or []],
        'document_text': document_text,
    }


# ── 2. Assessing a proposal against the criteria ───────────────────────────────────────────

def _scored_list(name: str) -> dict:
    return {
        'type': 'array',
        'description': f'One entry per criterion in section {name}, in the given order.',
        'items': {
            'type': 'object',
            'properties': {'score': {'type': 'integer'}, 'reason': {'type': 'string'}},
            'required': ['score', 'reason'],
            'additionalProperties': False,
        },
    }


EVALUATE_SCHEMA = {
    'type': 'object',
    'properties': {
        'a': _scored_list('A'),
        'b': _scored_list('B'),
        'c': _scored_list('C'),
        'scientific_capacity': {'type': 'integer'},
        'leadership': {'type': 'integer'},
        'team_size': {'type': 'integer'},
        'recommendation': {'type': 'string', 'enum': ['recommend', 'do_not_fund']},
        'summary': {'type': 'string'},
        'strengths': {'type': 'array', 'items': {'type': 'string'}},
        'weaknesses': {'type': 'array', 'items': {'type': 'string'}},
    },
    'required': ['a', 'b', 'c', 'scientific_capacity', 'leadership', 'team_size', 'recommendation',
                 'summary', 'strengths', 'weaknesses'],
    'additionalProperties': False,
}


def suggest_evaluation(proposal, language: str = 'en') -> dict:
    """Suggest a score for every evaluation criterion, with a short reason for each.

    `proposal` needs title, author, institution, research_area, funding_requested, keywords, abstract and
    document_text attributes (a saved Proposal or the details of one not saved yet).
    """
    def numbered(key):
        return '\n'.join(f'{i + 1}. {c}' for i, c in enumerate(CRITERIA[key]))

    funding = f'OMR {proposal.funding_requested:,.0f}' if proposal.funding_requested else 'not stated'
    prompt = f"""<proposal>
Title: {proposal.title}
Principal investigator: {proposal.author}
Institution: {proposal.institution or '-'}
Research area: {proposal.research_area or '-'}
Funding requested: {funding}
Keywords: {', '.join(proposal.keywords or []) or '-'}
Abstract: {proposal.abstract or '-'}

Full text:
{proposal.document_text or '(full text not available; judge from the fields above and say so in your reasons)'}
</proposal>

Evaluate this proposal with the authority's official criteria.

Section A - Initial proposal evaluation:
{numbered('a')}

Section B - Institutional challenge linkage and impact:
{numbered('b')}

Section C - Research excellence:
{numbered('c')}

{SCORE_SCALE}

Return exactly {len(CRITERIA['a'])} entries for a, {len(CRITERIA['b'])} for b and {len(CRITERIA['c'])} for c, in order.
Each reason is one sentence that cites evidence from the proposal or names what is missing.
Score what the document shows: a claim without evidence, a missing plan, an unrealistic timeline or budget, or
absent partners and co-funding should lower the relevant scores.
Also give: scientific_capacity and leadership (1-10) for the team and principal investigator; team_size (number of
named researchers, at least 1); recommendation (recommend or do_not_fund); a 2-3 sentence summary for the reviewer;
and up to 4 strengths and 4 weaknesses, each one short sentence.
{language_rule(language)}"""
    answer = _ask([{'type': 'text', 'text': prompt}], EVALUATE_SCHEMA, effort='high')

    def section(key):
        items = list(answer.get(key) or [])[:len(CRITERIA[key])]
        while len(items) < len(CRITERIA[key]):
            items.append({'score': 5, 'reason': 'No suggestion was returned for this criterion.'})
        return [{'score': _clamp(i.get('score'), 1, 10, 5), 'reason': str(i.get('reason') or '').strip()} for i in items]

    recommendation = answer.get('recommendation')
    return {
        'a': section('a'),
        'b': section('b'),
        'c': section('c'),
        'scientific_capacity': _clamp(answer.get('scientific_capacity'), 1, 10, 5),
        'leadership': _clamp(answer.get('leadership'), 1, 10, 5),
        'team_size': _clamp(answer.get('team_size'), 1, 50, 1),
        'recommendation': recommendation if recommendation in ('recommend', 'do_not_fund') else None,
        'summary': str(answer.get('summary') or '').strip(),
        'strengths': [str(s) for s in answer.get('strengths') or []][:4],
        'weaknesses': [str(s) for s in answer.get('weaknesses') or []][:4],
        'model': model(),
    }
