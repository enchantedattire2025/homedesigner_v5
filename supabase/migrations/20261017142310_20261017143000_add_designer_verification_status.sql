/*
# Add designer verification status field

1. Purpose
- Restore the Social Wall query, which displays only designers with a verified status.
- Align the live `designers` table with the application's existing verification workflow.

2. Modified Tables
- `designers`
  - Adds `verification_status` as a required text field.
  - New records default to `pending`.
  - Existing records are marked `verified` when the legacy `is_verified` field is true; other existing records remain `pending`.

3. Data Safety
- This is an additive change only.
- No rows are deleted, and existing designer profile data is preserved.
- Existing verification information is carried forward when the legacy field is available.

4. Security
- No RLS policies or table permissions are changed.
- Existing access rules remain in effect.

5. Idempotency
- The column, constraint, and index are created only when needed, making this migration safe to re-run.
*/

ALTER TABLE public.designers
ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'designers_verification_status_check'
      AND conrelid = 'public.designers'::regclass
  ) THEN
    ALTER TABLE public.designers
      ADD CONSTRAINT designers_verification_status_check
      CHECK (verification_status IN ('pending', 'verified', 'rejected'));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'designers'
      AND column_name = 'is_verified'
  ) THEN
    UPDATE public.designers
    SET verification_status = CASE
      WHEN is_verified = true THEN 'verified'
      ELSE 'pending'
    END
    WHERE verification_status = 'pending';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_designers_verification_status
  ON public.designers (verification_status);