/*
# Fix missing UPDATE and admin SELECT policies on designers table

## Problem
The designers table is missing UPDATE RLS policies entirely. Without an
UPDATE policy, NO user (including admins) can update designer rows. This
means the admin's "Approve Designer" action silently fails — the UPDATE
query returns no rows affected because RLS blocks it.

Additionally, the only SELECT policy on designers is:
  "Public can read active designers" — USING (is_active = true)
This means admins cannot see pending or rejected designers (which have
is_active = true but the admin needs to see ALL designers regardless of
status). Actually, pending designers DO have is_active = true (set during
registration), so the SELECT might work. But to be safe, we add an admin
SELECT policy so admins can always see all designers regardless of
is_active status.

## Fix
Add three policies:
1. UPDATE policy for admins — allows admin users to update any designer row
   (needed for approval/rejection of designers).
2. UPDATE policy for verified designers — allows designers to update their
   own profile once they are verified.
3. SELECT policy for admins — allows admins to see all designers regardless
   of is_active status.

## Security
- Admin UPDATE policy checks is_active_admin() (SECURITY DEFINER function
  that verifies the caller has an active admin_users row).
- Designer UPDATE policy checks both user_id ownership AND verification_status
  = 'verified', so rejected/pending designers cannot edit their profile.
- Admin SELECT policy uses is_active_admin() for authorization.
*/

-- 1. Admins can update any designer (for verification approval/rejection)
DROP POLICY IF EXISTS "Admins can update designer verification status" ON public.designers;
CREATE POLICY "Admins can update designer verification status"
  ON public.designers
  FOR UPDATE
  TO authenticated
  USING (is_active_admin())
  WITH CHECK (is_active_admin());

-- 2. Verified designers can update their own profile
DROP POLICY IF EXISTS "Verified designers can update own profile" ON public.designers;
CREATE POLICY "Verified designers can update own profile"
  ON public.designers
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND verification_status = 'verified'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND verification_status = 'verified'
  );

-- 3. Admins can read all designers (including pending/rejected)
DROP POLICY IF EXISTS "Admins can view all designers" ON public.designers;
CREATE POLICY "Admins can view all designers"
  ON public.designers
  FOR SELECT
  TO authenticated
  USING (is_active_admin());
