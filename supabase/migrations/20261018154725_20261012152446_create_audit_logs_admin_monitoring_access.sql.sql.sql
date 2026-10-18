/*
# Create audit logs table and enable admin read access on monitoring tables

## What this migration does

1. Creates `audit_logs` table for recording authorized administrative interventions
2. Enables RLS on `audit_logs` with admin-only read/write, designer read-own
3. Adds admin SELECT policies on monitoring tables that admins need to read:
   - `design_projects` (projects monitoring)
   - `designer_quotes` (quotation monitoring)
   - `quote_items` (quotation details)
   - `project_assignments` (project assignments)
   - `project_activities` (project activity log)
   - `project_updates` (project updates)
   - `project_versions` (project versions)
   - `project_images` (project images)
   - `designer_projects_earnings` (earnings/revenue)
   - `subscription_payments` (payment history)
   - `subscription_usage_tracking` (usage data)
   - `ai_quotation_rooms` (AI quotation details)
   - `ai_quotation_items` (AI quotation item details)
   - `ai_credit_ledger` (already has admin read via existing policy)
4. Adds admin SELECT on `wallpaper_orders` and `wallpapers_3d` (already may have via existing)

## Security changes
- `audit_logs`: admin can read all, admin can insert, designer can read own logs
- All monitoring tables: admin gets SELECT-only access via `is_active_admin()` function
- No admin INSERT/UPDATE/DELETE on monitoring tables — read-only by design

## Important notes
- Uses `is_active_admin()` helper function already defined in the database
- Drops policies first to ensure idempotency
- Does NOT modify any existing designer/customer policies
- Does NOT grant admin write access to project/quote/subscription data
*/

-- =========================================================
-- 1. Create audit_logs table
-- =========================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  target_user_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin can read all audit logs
DROP POLICY IF EXISTS "admins read audit logs" ON audit_logs;
CREATE POLICY "admins read audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (is_active_admin());

-- Admin can insert audit logs
DROP POLICY IF EXISTS "admins insert audit logs" ON audit_logs;
CREATE POLICY "admins insert audit logs"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (is_active_admin());

-- Designer can read their own audit logs (where they are the target)
DROP POLICY IF EXISTS "designers read own audit logs" ON audit_logs;
CREATE POLICY "designers read own audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (target_user_id = auth.uid());

-- =========================================================
-- 2. Admin SELECT on monitoring tables (read-only)
-- =========================================================

-- design_projects
DROP POLICY IF EXISTS "admins read projects" ON design_projects;
CREATE POLICY "admins read projects"
ON design_projects FOR SELECT
TO authenticated
USING (is_active_admin());

-- designer_quotes
DROP POLICY IF EXISTS "admins read quotes" ON designer_quotes;
CREATE POLICY "admins read quotes"
ON designer_quotes FOR SELECT
TO authenticated
USING (is_active_admin());

-- quote_items
DROP POLICY IF EXISTS "admins read quote items" ON quote_items;
CREATE POLICY "admins read quote items"
ON quote_items FOR SELECT
TO authenticated
USING (is_active_admin());

-- project_assignments
DROP POLICY IF EXISTS "admins read project assignments" ON project_assignments;
CREATE POLICY "admins read project assignments"
ON project_assignments FOR SELECT
TO authenticated
USING (is_active_admin());

-- project_activities
DROP POLICY IF EXISTS "admins read project activities" ON project_activities;
CREATE POLICY "admins read project activities"
ON project_activities FOR SELECT
TO authenticated
USING (is_active_admin());

-- project_updates
DROP POLICY IF EXISTS "admins read project updates" ON project_updates;
CREATE POLICY "admins read project updates"
ON project_updates FOR SELECT
TO authenticated
USING (is_active_admin());

-- project_versions
DROP POLICY IF EXISTS "admins read project versions" ON project_versions;
CREATE POLICY "admins read project versions"
ON project_versions FOR SELECT
TO authenticated
USING (is_active_admin());

-- project_images
DROP POLICY IF EXISTS "admins read project images" ON project_images;
CREATE POLICY "admins read project images"
ON project_images FOR SELECT
TO authenticated
USING (is_active_admin());

-- designer_projects_earnings
DROP POLICY IF EXISTS "admins read earnings" ON designer_projects_earnings;
CREATE POLICY "admins read earnings"
ON designer_projects_earnings FOR SELECT
TO authenticated
USING (is_active_admin());

-- subscription_payments
DROP POLICY IF EXISTS "admins read subscription payments" ON subscription_payments;
CREATE POLICY "admins read subscription payments"
ON subscription_payments FOR SELECT
TO authenticated
USING (is_active_admin());

-- subscription_usage_tracking
DROP POLICY IF EXISTS "admins read usage tracking" ON subscription_usage_tracking;
CREATE POLICY "admins read usage tracking"
ON subscription_usage_tracking FOR SELECT
TO authenticated
USING (is_active_admin());

-- ai_quotation_rooms
DROP POLICY IF EXISTS "admins read ai quotation rooms" ON ai_quotation_rooms;
CREATE POLICY "admins read ai quotation rooms"
ON ai_quotation_rooms FOR SELECT
TO authenticated
USING (is_active_admin());

-- ai_quotation_items
DROP POLICY IF EXISTS "admins read ai quotation items" ON ai_quotation_items;
CREATE POLICY "admins read ai quotation items"
ON ai_quotation_items FOR SELECT
TO authenticated
USING (is_active_admin());

-- ai_quotation_jobs (ensure admin read exists)
DROP POLICY IF EXISTS "admins read ai quotation jobs" ON ai_quotation_jobs;
CREATE POLICY "admins read ai quotation jobs"
ON ai_quotation_jobs FOR SELECT
TO authenticated
USING (is_active_admin());

-- ai_credit_periods (ensure admin read exists)
DROP POLICY IF EXISTS "admins read ai credit periods" ON ai_credit_periods;
CREATE POLICY "admins read ai credit periods"
ON ai_credit_periods FOR SELECT
TO authenticated
USING (is_active_admin());

-- designer_ai_subscriptions (ensure admin read exists)
DROP POLICY IF EXISTS "admins read designer ai subscriptions" ON designer_ai_subscriptions;
CREATE POLICY "admins read designer ai subscriptions"
ON designer_ai_subscriptions FOR SELECT
TO authenticated
USING (is_active_admin());

-- designer_subscriptions (ensure admin read exists)
DROP POLICY IF EXISTS "admins read designer subscriptions" ON designer_subscriptions;
CREATE POLICY "admins read designer subscriptions"
ON designer_subscriptions FOR SELECT
TO authenticated
USING (is_active_admin());

-- quote_acceptance_history
DROP POLICY IF EXISTS "admins read quote acceptance history" ON quote_acceptance_history;
CREATE POLICY "admins read quote acceptance history"
ON quote_acceptance_history FOR SELECT
TO authenticated
USING (is_active_admin());

-- Index for audit_logs queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id ON audit_logs (target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
