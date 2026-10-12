/*
# Fix Subscription System: Seed Plans, Add RLS Policies, Enable Management

## Summary

This migration fixes three root causes that blocked the AI quotation feature:

1. **No Standard plan data** — The `subscription_plans` table was empty, so the
   designer subscription page had nothing to display. Seeds a single
   "Professional" plan at ₹2,000/month with 15 projects and 60 quotes per quarter.

2. **Missing RLS policies** — `designer_subscriptions` had RLS enabled but zero
   policies, so designers could not read or update their own subscription.
   `designer_ai_subscriptions` lacked a designer insert policy, so designers
   could not activate an AI add-on. `subscription_plans` had no read policy at all.

3. **Subscription management disabled** — `site_settings.subscription_management_enabled`
   was `false`, which caused the frontend to skip all subscription checks and
   hide subscription-related UI.

## Changes

### Seed Data
- Insert one "Professional" plan into `subscription_plans` (idempotent via
  `ON CONFLICT (name) DO UPDATE`).
- Set `subscription_management_enabled` to `true` in `site_settings`.

### RLS Policies
- `subscription_plans`: SELECT for authenticated (all plans visible to logged-in
  designers/admins).
- `designer_subscriptions`: full CRUD for designers on their own rows (matched via
  `designers.user_id = auth.uid()`), plus admin override.
- `designer_ai_subscriptions`: INSERT for designers on their own rows.

## Important Notes
1. The Professional plan uses `billing_period = 'monthly'` and `price = 2000`.
2. Designer subscription policies use a subquery to `designers` to match
   `user_id = auth.uid()`, which is the same pattern used by the existing
   AI subscription policies.
3. No existing data is deleted or altered — only new rows and new policies.
*/

-- ============================================================
-- 1. SEED STANDARD SUBSCRIPTION PLAN
-- ============================================================

INSERT INTO subscription_plans (name, description, price, billing_period, features, max_projects, max_quotes, priority_support, is_active, sort_order)
VALUES (
  'Professional',
  'Full access to manual, template and modular quotation tools with priority support.',
  2000,
  'monthly',
  '["Up to 15 concurrent projects","60 quotes per quarter","Premium portfolio showcase","Priority email support","Analytics dashboard"]'::jsonb,
  15,
  60,
  true,
  true,
  1
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  billing_period = EXCLUDED.billing_period,
  features = EXCLUDED.features,
  max_projects = EXCLUDED.max_projects,
  max_quotes = EXCLUDED.max_quotes,
  priority_support = EXCLUDED.priority_support,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- ============================================================
-- 2. ENABLE SUBSCRIPTION MANAGEMENT
-- ============================================================

UPDATE site_settings
SET is_active = true, updated_at = now()
WHERE setting_key = 'subscription_management_enabled';

-- Ensure the row exists if it was missing
INSERT INTO site_settings (setting_key, is_active)
SELECT 'subscription_management_enabled', true
WHERE NOT EXISTS (
  SELECT 1 FROM site_settings WHERE setting_key = 'subscription_management_enabled'
);

-- ============================================================
-- 3. RLS POLICIES — subscription_plans
-- ============================================================

DROP POLICY IF EXISTS "authenticated read subscription plans" ON subscription_plans;
CREATE POLICY "authenticated read subscription plans"
ON subscription_plans FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "admins insert subscription plans" ON subscription_plans;
CREATE POLICY "admins insert subscription plans"
ON subscription_plans FOR INSERT
TO authenticated
WITH CHECK (is_active_admin());

DROP POLICY IF EXISTS "admins update subscription plans" ON subscription_plans;
CREATE POLICY "admins update subscription plans"
ON subscription_plans FOR UPDATE
TO authenticated
USING (is_active_admin())
WITH CHECK (is_active_admin());

DROP POLICY IF EXISTS "admins delete subscription plans" ON subscription_plans;
CREATE POLICY "admins delete subscription plans"
ON subscription_plans FOR DELETE
TO authenticated
USING (is_active_admin());

-- ============================================================
-- 4. RLS POLICIES — designer_subscriptions
--    (RLS was enabled but had ZERO policies — designers could
--     not read or write their own subscription at all.)
-- ============================================================

DROP POLICY IF EXISTS "designers read own subscription" ON designer_subscriptions;
CREATE POLICY "designers read own subscription"
ON designer_subscriptions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM designers d
    WHERE d.id = designer_subscriptions.designer_id
    AND d.user_id = auth.uid()
  ) OR is_active_admin()
);

DROP POLICY IF EXISTS "designers insert own subscription" ON designer_subscriptions;
CREATE POLICY "designers insert own subscription"
ON designer_subscriptions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM designers d
    WHERE d.id = designer_subscriptions.designer_id
    AND d.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "designers update own subscription" ON designer_subscriptions;
CREATE POLICY "designers update own subscription"
ON designer_subscriptions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM designers d
    WHERE d.id = designer_subscriptions.designer_id
    AND d.user_id = auth.uid()
  ) OR is_active_admin()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM designers d
    WHERE d.id = designer_subscriptions.designer_id
    AND d.user_id = auth.uid()
  ) OR is_active_admin()
);

DROP POLICY IF EXISTS "admins delete designer subscriptions" ON designer_subscriptions;
CREATE POLICY "admins delete designer subscriptions"
ON designer_subscriptions FOR DELETE
TO authenticated
USING (is_active_admin());

-- ============================================================
-- 5. RLS POLICIES — designer_ai_subscriptions
--    (Had read for designers + admin CRUD, but NO designer
--     INSERT policy — designers could not activate an AI plan.)
-- ============================================================

DROP POLICY IF EXISTS "designers insert own ai subscription" ON designer_ai_subscriptions;
CREATE POLICY "designers insert own ai subscription"
ON designer_ai_subscriptions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM designers d
    WHERE d.id = designer_ai_subscriptions.designer_id
    AND d.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "designers update own ai subscription" ON designer_ai_subscriptions;
CREATE POLICY "designers update own ai subscription"
ON designer_ai_subscriptions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM designers d
    WHERE d.id = designer_ai_subscriptions.designer_id
    AND d.user_id = auth.uid()
  ) OR is_active_admin()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM designers d
    WHERE d.id = designer_ai_subscriptions.designer_id
    AND d.user_id = auth.uid()
  ) OR is_active_admin()
);
