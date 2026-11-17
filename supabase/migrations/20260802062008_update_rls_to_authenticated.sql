/*
# Update RLS Policies to Require Authentication

## Overview
The platform now has a login screen. All RLS policies must be updated from
anon+authenticated (shared/public) to authenticated-only with ownership checks.

## Changes
- Drop all existing anon policies on proposals, publications, and matches.
- Create new authenticated-only policies for all CRUD operations.
- Add user_id column to proposals (owner = uploader) with DEFAULT auth.uid().
- Publications and matches remain shared among authenticated users (ministry staff
  share access to all records), so they use authenticated-only with USING (true).

## Security
- proposals: owner-scoped (user can only see/edit their own proposals)
- publications: authenticated-only, shared (all ministry staff can manage)
- matches: authenticated-only, shared (all ministry staff can review)
*/

-- Add user_id to proposals for ownership
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposals' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE proposals ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update proposals policies: owner-scoped
DROP POLICY IF EXISTS "anon_select_proposals" ON proposals;
DROP POLICY IF EXISTS "anon_insert_proposals" ON proposals;
DROP POLICY IF EXISTS "anon_update_proposals" ON proposals;
DROP POLICY IF EXISTS "anon_delete_proposals" ON proposals;

CREATE POLICY "select_own_proposals" ON proposals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_proposals" ON proposals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_proposals" ON proposals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_proposals" ON proposals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Update publications policies: authenticated, shared
DROP POLICY IF EXISTS "anon_select_publications" ON publications;
DROP POLICY IF EXISTS "anon_insert_publications" ON publications;
DROP POLICY IF EXISTS "anon_update_publications" ON publications;
DROP POLICY IF EXISTS "anon_delete_publications" ON publications;

CREATE POLICY "auth_select_publications" ON publications FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_publications" ON publications FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_publications" ON publications FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_publications" ON publications FOR DELETE
  TO authenticated USING (true);

-- Update matches policies: authenticated, shared
DROP POLICY IF EXISTS "anon_select_matches" ON matches;
DROP POLICY IF EXISTS "anon_insert_matches" ON matches;
DROP POLICY IF EXISTS "anon_update_matches" ON matches;
DROP POLICY IF EXISTS "anon_delete_matches" ON matches;

CREATE POLICY "auth_select_matches" ON matches FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_matches" ON matches FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_matches" ON matches FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_matches" ON matches FOR DELETE
  TO authenticated USING (true);
