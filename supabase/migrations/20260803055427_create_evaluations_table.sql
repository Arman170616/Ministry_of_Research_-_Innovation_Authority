/*
# Create Evaluations Table

## Overview
Stores three-theme proposal evaluation scores submitted by authenticated reviewers.
Each reviewer can submit one evaluation per proposal.

## Tables

### evaluations
- id (uuid, PK)
- proposal_id (uuid, FK → proposals, cascade delete)
- user_id (uuid, FK → auth.users, default auth.uid())
- a_scores (integer[]) — Appendix A: 8 criteria × max 10 each = 80
- b_scores (integer[]) — Appendix B: 11 criteria × max 10 each = 110
- c_scores (integer[]) — Appendix C: 6 criteria × max 10 each = 60
- scientific_capacity (integer 0–10)
- leadership (integer 0–10)
- team_size (integer)
- recommendation (text: recommend | do_not_fund)
- evaluator_notes (text)
- created_at, updated_at

## Security
- RLS enabled, owner-scoped (each user manages their own evaluations)
*/

CREATE TABLE IF NOT EXISTS evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  a_scores integer[] NOT NULL DEFAULT '{}',
  b_scores integer[] NOT NULL DEFAULT '{}',
  c_scores integer[] NOT NULL DEFAULT '{}',
  scientific_capacity integer NOT NULL DEFAULT 5,
  leadership integer NOT NULL DEFAULT 5,
  team_size integer NOT NULL DEFAULT 1,
  recommendation text CHECK (recommendation IN ('recommend','do_not_fund')),
  evaluator_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(proposal_id, user_id)
);

ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_evaluations" ON evaluations;
CREATE POLICY "select_own_evaluations" ON evaluations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_evaluations" ON evaluations;
CREATE POLICY "insert_own_evaluations" ON evaluations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_evaluations" ON evaluations;
CREATE POLICY "update_own_evaluations" ON evaluations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_evaluations" ON evaluations;
CREATE POLICY "delete_own_evaluations" ON evaluations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
