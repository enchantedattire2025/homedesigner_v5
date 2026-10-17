/*
# Add designer Instagram URL field

1. Purpose
- Restore the public Social Wall query, which reads the Instagram URL for verified designers.
- This migration addresses a live-schema mismatch where the application expects the field but the `designers` table does not contain it.

2. Modified Tables
- `designers`
  - Adds `instagram_url` as an optional text field containing a designer's public Instagram profile URL.

3. Data Safety
- The new column is nullable, so existing designer records remain valid and unchanged.
- No rows are deleted, updated, or renamed.

4. Security
- No RLS policies are changed.
- Existing table permissions and public-read rules remain in effect.

5. Idempotency
- The column is added only when it does not already exist, making this migration safe to re-run.
*/

ALTER TABLE public.designers
ADD COLUMN IF NOT EXISTS instagram_url text;