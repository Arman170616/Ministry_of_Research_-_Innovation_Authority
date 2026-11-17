/*
# Create Research Proposal Management Platform Schema

## Overview
Scientific research proposal management platform for the Ministry of Oman.
Stores research proposals (for funding requests) and publications (published papers),
and tracks matching between proposals and publications for filtering/review purposes.

## New Tables

### 1. proposals
Stores uploaded research proposals / funding requests.
- id (uuid, primary key)
- title (text, not null) — proposal title
- author (text, not null) — principal investigator / submitter name
- author_email (text) — contact email
- institution (text) — affiliated institution/organization
- research_area (text) — field of research (e.g. "Renewable Energy", "Public Health")
- abstract (text) — proposal abstract / summary
- document_url (text) — link to uploaded proposal document (file path or external URL)
- status (text, default 'pending') — pending / under_review / approved / rejected
- funding_requested (numeric) — requested funding amount in OMR
- publication_date (date) — date the proposal was published/submitted
- keywords (text[]) — searchable keywords for matching
- created_at (timestamptz, default now())

### 2. publications
Stores published research papers / ready-made papers (like CV projects).
- id (uuid, primary key)
- title (text, not null) — publication title
- authors (text, not null) — author names
- journal (text) — journal or conference name
- research_area (text) — field of research
- abstract (text) — publication abstract
- document_url (text) — link to uploaded publication document
- doi (text) — digital object identifier
- publication_date (date) — date published
- keywords (text[]) — searchable keywords for matching
- citation_count (integer, default 0) — number of citations
- created_at (timestamptz, default now())

### 3. matches
Tracks matching results between proposals and publications based on keyword/research-area overlap.
- id (uuid, primary key)
- proposal_id (uuid, references proposals, cascade delete)
- publication_id (uuid, references publications, cascade delete)
- match_score (numeric, default 0) — similarity score 0-100
- matched_keywords (text[]) — overlapping keywords that drove the match
- status (text, default 'pending') — pending / reviewed / accepted / rejected
- reviewed_by (text) — reviewer name
- notes (text) — reviewer notes
- created_at (timestamptz, default now())

## Security
- RLS enabled on all tables.
- This is a single-tenant platform (no sign-in screen) used by ministry staff, so
  anon + authenticated roles get full CRUD — the data is intentionally shared.
- USING (true) is acceptable here because all ministry users share access to all records.

## Indexes
- proposals: research_area, status, publication_date
- publications: research_area, publication_date
- matches: proposal_id, publication_id
*/

-- Proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text NOT NULL,
  author_email text,
  institution text,
  research_area text,
  abstract text,
  document_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','under_review','approved','rejected')),
  funding_requested numeric(12,2) DEFAULT 0,
  publication_date date,
  keywords text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_proposals" ON proposals;
CREATE POLICY "anon_select_proposals" ON proposals FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_proposals" ON proposals;
CREATE POLICY "anon_insert_proposals" ON proposals FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_proposals" ON proposals;
CREATE POLICY "anon_update_proposals" ON proposals FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_proposals" ON proposals;
CREATE POLICY "anon_delete_proposals" ON proposals FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_proposals_research_area ON proposals (research_area);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals (status);
CREATE INDEX IF NOT EXISTS idx_proposals_publication_date ON proposals (publication_date);

-- Publications table
CREATE TABLE IF NOT EXISTS publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  authors text NOT NULL,
  journal text,
  research_area text,
  abstract text,
  document_url text,
  doi text,
  publication_date date,
  keywords text[] DEFAULT '{}',
  citation_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE publications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_publications" ON publications;
CREATE POLICY "anon_select_publications" ON publications FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_publications" ON publications;
CREATE POLICY "anon_insert_publications" ON publications FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_publications" ON publications;
CREATE POLICY "anon_update_publications" ON publications FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_publications" ON publications;
CREATE POLICY "anon_delete_publications" ON publications FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_publications_research_area ON publications (research_area);
CREATE INDEX IF NOT EXISTS idx_publications_publication_date ON publications (publication_date);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  publication_id uuid NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  match_score numeric(5,2) DEFAULT 0,
  matched_keywords text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','accepted','rejected')),
  reviewed_by text,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (proposal_id, publication_id)
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_matches" ON matches;
CREATE POLICY "anon_select_matches" ON matches FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_matches" ON matches;
CREATE POLICY "anon_insert_matches" ON matches FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_matches" ON matches;
CREATE POLICY "anon_update_matches" ON matches FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_matches" ON matches;
CREATE POLICY "anon_delete_matches" ON matches FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_matches_proposal_id ON matches (proposal_id);
CREATE INDEX IF NOT EXISTS idx_matches_publication_id ON matches (publication_id);