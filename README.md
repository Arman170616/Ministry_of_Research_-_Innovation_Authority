# Ministry of Research — Innovation Authority

**Research Proposal Matching Platform** for the Research and Innovation Authority, Sultanate of Oman.

A single workspace for reviewing national research funding proposals, from submission through matching to final evaluation:

1. **Intake**: submit and filter funding proposals in one place.
2. **Match**: compare proposals against the national research publication record.
3. **Evaluate**: score proposals across three evaluation themes aligned with Oman Vision 2040.

## Login page

![Login page](docs/login-page.png)

The login page has a branded panel (logo, platform overview, workflow steps) on the left and the sign-in form on the right. On phones and narrow screens the branded panel is hidden and the logo appears above the form.

- **Sign in** with a username or email and a password. A plain username is signed in as `username@ria.gov.om`.
- **Sign up** with an email and a password. The new user is signed in straight away.
- The password field has a show/hide toggle, and errors are shown above the form.

The page is in [`src/views/Login.tsx`](src/views/Login.tsx) and the logo is in [`public/images/ria-logo.png`](public/images/ria-logo.png).

## Tech stack

- [React 18](https://react.dev/) + TypeScript
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Supabase](https://supabase.com/) for authentication and the Postgres database
- [lucide-react](https://lucide.dev/) for icons

## Getting started

You need Node.js 18 or later and a Supabase project.

```bash
# 1. Install dependencies
npm install

# 2. Add your Supabase credentials
cp .env.example .env
# then edit .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 3. Start the dev server
npm run dev
```

Then open http://localhost:5173.

### Database

The schema is in [`supabase/migrations/`](supabase/migrations/). It creates the `proposals`, `publications`, `matches` and `evaluations` tables with row-level security for signed-in users. Apply the migrations to your Supabase project with the [Supabase CLI](https://supabase.com/docs/guides/cli) (`supabase db push`) or by running them in the SQL editor.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Build for production into `dist/` |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | Run the TypeScript checks |
| `npm run lint` | Run ESLint |

## Project structure

```
src/
  views/        Pages: Login, Dashboard, Proposals, Publications, Matching
  components/   Header, Sidebar, ProposalWizard, shared UI
  lib/          Supabase client, hooks, helpers
public/images/  Logos and images
supabase/       Database migrations
docs/           Screenshots
```

## Environment variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon (public) key |

`.env` is git-ignored. Never commit real credentials.
