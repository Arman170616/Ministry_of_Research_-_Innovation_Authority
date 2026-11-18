# Ministry of Research — Innovation Authority

**Research Proposal Matching Platform** for the Research and Innovation Authority, Sultanate of Oman.

A single workspace for assessing national research funding proposals against the authority's official evaluation criteria and ranking them:

1. **Upload**: upload one proposal or several at once (PDF or TXT).
2. **Assessment**: AI reads each proposal and scores every criterion in Appendix A, B and C, with a reason for each score.
3. **Review**: a reviewer checks the details and scores, changes any they disagree with, and records the funding recommendation.
4. **Matching report**: shows how well the proposal meets the criteria: the overall score, a score for each appendix, strengths and weaknesses. It can be printed.
5. **Ranking & Matching**: all assessed proposals are ranked best first by their overall score, with their research area and how well they match each appendix (A, B, C).

## Login page

![Login page](docs/login-page.png)

The login page has a branded panel (platform overview and workflow steps) on the left and the sign-in form on the right. On phones and narrow screens the branded panel is hidden and only the form is shown.

- **Sign in** with a username or email and a password. A plain username also matches an account registered as `username@ria.gov.om`.
- **Sign up** with an email and a password. The new user is signed in straight away.
- The password field has a show/hide toggle, and errors are shown above the form.

The page is in [`src/views/Login.tsx`](src/views/Login.tsx).

## Tech stack

| Part | Built with |
|---|---|
| Frontend | [React 18](https://react.dev/) + TypeScript, [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/), [lucide-react](https://lucide.dev/) icons |
| Backend | [Django 5.2](https://www.djangoproject.com/) + [Django REST Framework](https://www.django-rest-framework.org/), token authentication |
| Database | SQLite (default, for development) |
| AI analysis | [Claude](https://www.anthropic.com/) (Opus 5.5) through the Anthropic Python SDK |

## Getting started

You need **Node.js 18+** and **Python 3.11+**. Run the backend and the frontend in two terminals.

### 1. Backend (Django API on port 8000)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser   # an admin account (staff see every proposal)
python manage.py runserver
```

### 2. Frontend (Vite on port 5173)

```bash
npm install
npm run dev
```

Open http://localhost:5173. In development Vite forwards every `/api` request to Django, so no extra configuration is needed.

The Django admin is at http://127.0.0.1:8000/admin/ for managing users and data.

## Languages: English and Arabic

The whole interface is available in **English** and **Arabic (العربية)**. Use the switch in the header or on the login page; the choice is remembered in the browser.

- Arabic switches the layout to **right-to-left** (sidebar on the right, mirrored arrows and sliders) and uses the Cairo typeface.
- Dates, amounts and statuses are shown in the selected language, e.g. "72,000 ر.ع.".
- Proposal content (titles, abstracts, keywords) is shown as written, in its own text direction.
- With AI on, the reasons, summary, strengths and weaknesses are written in the language selected when the proposal is assessed.

**Adding or changing text:** components wrap English text in `t('...')` from [`src/lib/i18n.tsx`](src/lib/i18n.tsx). The Arabic text lives in [`src/lib/i18n-ar.ts`](src/lib/i18n-ar.ts), keyed by the English text. Missing translations fall back to English and are listed in the browser console during development.

## Assessment and ranking

**Uploading.** Choose up to 10 PDF or TXT files at once (15 MB each). They are processed one after another, and each shows its progress: Waiting → Reading → Assessing → Ready. Open a ready proposal to review it; the others keep processing in the background.

**Score.** Every criterion is scored 1–10. The overall score is the total points as a percentage of the maximum, with every criterion counting equally (Appendix A has 8 criteria, B has 11 and C has 6). The team judgment (team size, scientific capacity, leadership) is recorded in the report but does not change the score.

| Overall score | Shown as |
|---|---|
| 75% and above | Strong match |
| 60–74% | Good match |
| 45–59% | Partial match |
| below 45% | Weak match |

**Ranking & Matching.** The Ranking & Matching page lists assessed proposals by overall score, best first; proposals with the same score share a rank. If several reviewers have evaluated a proposal, their scores are averaged. Filter by research area, status or recommendation, and open any proposal's matching report. Proposals without an evaluation are listed separately.

## AI analysis

When `ANTHROPIC_API_KEY` is set in `backend/.env`, Claude helps reviewers at two points. Everything it produces is a suggestion that a person checks and can change.

| Step | What Claude does | Typical time |
|---|---|---|
| **Read the document** | Reads the uploaded PDF or TXT and fills in title, team, institution, research area, budget, date, abstract and keywords. Lists any fields the document doesn't state. | 5–10 s |
| **Assess against the criteria** | Reads the full proposal and scores every criterion (Appendix A, B, C) with a one-sentence reason, and gives a summary, strengths, weaknesses, a team judgment and a funding recommendation. | 25–60 s |

- **Without a key** the app still works: reviewers fill in the details and score each criterion by hand.
- What Claude said is saved with the evaluation, so the matching report can show the reason for each score later.
- **Status** (approved, rejected, and so on) is always set by a person.
- **Cost and limits:** each uploaded proposal makes 2 requests to the Anthropic API, which is billed per use. Each user can make 60 AI requests per hour (`AI_RATE_LIMIT`), so about 30 proposals.
- **Privacy:** proposal documents are sent to Anthropic's API for analysis. Confirm this is allowed for your documents before turning AI on.
- The code is in [`backend/research/ai.py`](backend/research/ai.py).

## Access rules

- Every API endpoint except login and sign-up requires a signed-in user.
- **Proposals** are private to the person who submitted them. **Staff** users (`is_staff`) see all proposals, so they can rank everything.
- **Evaluations** follow their proposal: you see the evaluations of the proposals you can see. Each reviewer has one evaluation per proposal; saving again updates it.

## API

All endpoints are under `/api/`. Send the token from login or sign-up as `Authorization: Token <token>`.

| Method | Endpoint | What it does |
|---|---|---|
| POST | `/auth/register/` | Create an account `{email, password}` and return `{token, user}` |
| POST | `/auth/login/` | Sign in `{username, password}` (username or email) and return `{token, user}` |
| POST | `/auth/logout/` | Revoke the token |
| GET | `/auth/me/` | The signed-in user |
| GET, POST | `/proposals/` | List or create proposals |
| GET, PATCH, DELETE | `/proposals/<id>/` | Read, update or delete a proposal (deleting also removes its evaluations) |
| GET, POST | `/evaluations/` | List evaluations (optionally `?proposal_id=<id>`), or save one (created or updated per proposal). Each has a read-only `score` (overall %) and the `ai_assessment` |
| GET | `/ai/status/` | Whether AI analysis is turned on, and which model |
| POST | `/ai/extract/` | Upload a proposal (`multipart`, field `file`, PDF or TXT) and get the extracted fields back |
| POST | `/ai/evaluate/` | Assess a proposal against the criteria. Send its details and `document_text` (it does not need to be saved yet) and an optional `language` (`en` or `ar`) |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the frontend dev server |
| `npm run build` | Build the frontend into `dist/` |
| `npm run typecheck` | Run the TypeScript checks |
| `npm run lint` | Run ESLint |
| `python manage.py test research` | Run the backend tests (from `backend/`) |

## Project structure

```
backend/
  config/       Django settings and root URLs
  research/     Models, API views, serializers, AI analysis, tests
src/
  views/        Pages: Login, Dashboard, Proposals, Ranking
  components/   Header, Sidebar, ProposalWizard (upload → report), MatchingReport, shared UI
  lib/          API client (api.ts), data hooks, criteria and scoring, types, translations
public/images/  Logos and images
docs/           Screenshots
```

## Environment variables

**Frontend** (`.env`, see [`.env.example`](.env.example)):

| Variable | Description |
|---|---|
| `VITE_API_URL` | Optional. The API's address when it is hosted on another domain. Leave empty in development. |

**Backend** (`backend/.env`, see [`backend/.env.example`](backend/.env.example)):

| Variable | Description |
|---|---|
| `DJANGO_DEBUG` | `true` for development, `false` in production |
| `DJANGO_SECRET_KEY` | Required when `DJANGO_DEBUG` is `false` |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated host names the API answers on |
| `CORS_ALLOWED_ORIGINS` | Comma-separated frontend addresses allowed to call the API |
| `ANTHROPIC_API_KEY` | Turns on AI analysis. Leave empty to turn it off. |
| `ANTHROPIC_MODEL` | Claude model to use (default `claude-opus-5-5`) |
| `AI_RATE_LIMIT` | AI requests allowed per user (default `60/hour`) |

`.env`, `backend/.env` and the SQLite database are git-ignored. Never commit real credentials, especially the Anthropic API key.
