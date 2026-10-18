/*
# Fix Missing Public SELECT Policies on Designers and Customers Tables

## Problem
The `designers` and `customers` tables have RLS enabled but are missing
public SELECT policies. A prior migration (#20251125164959) dropped the
original "Public can read active designers" policy and never recreated it.
This means:

1. `designers` table: Only an INSERT policy exists. No SELECT policy at all.
   The Gallery (Social Wall) page and the Designers listing page both query
   this table as the anon-key client and receive zero rows.

2. `customers` table: Has SELECT policies only for authenticated roles
   (admins, designers, own-customer). No anon SELECT policy exists.
   The public Projects page (which shows completed projects) gets zero rows
   and falls back to demo data.

## Fix
Add public SELECT policies to both tables:

### designers table
- Add "Public can read active designers" SELECT policy (TO anon, authenticated)
  scoped to is_active = true, so the public listing and gallery pages work.

### customers table
- Add "Public can view completed projects" SELECT policy (TO anon, authenticated)
  scoped to assignment_status = 'completed', so the public projects gallery
  shows real completed project data.

## Security
- Both policies only expose data that is intentionally public:
  - Active designer profiles (already meant to be public-facing)
  - Completed projects only (not pending/in-progress customer data)
- No INSERT, UPDATE, or DELETE access is granted by these policies.
- Existing authenticated-scoped policies remain unchanged.
*/

-- ===== designers table: restore public SELECT =====
DROP POLICY IF EXISTS "Public can read active designers" ON designers;
CREATE POLICY "Public can read active designers"
  ON designers FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- ===== customers table: add public SELECT for completed projects only =====
DROP POLICY IF EXISTS "Public can view completed projects" ON customers;
CREATE POLICY "Public can view completed projects"
  ON customers FOR SELECT
  TO anon, authenticated
  USING (assignment_status = 'completed');
