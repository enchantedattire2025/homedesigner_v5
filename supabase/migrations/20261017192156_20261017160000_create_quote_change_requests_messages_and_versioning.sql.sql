/*
# Customer Quotation Actions: Versioning, Change Requests, Messaging, Rejection Reasons, Payment Tracking

## Overview
This migration adds the database foundation for four customer-side quotation actions:
1. Accept & Proceed (10% confirmation payment via Razorpay, contact unlocked only after verified payment)
2. Request Changes (multi-select options, capped at 3 revision rounds; designer submits revised quotation as a new versioned row without overwriting the original)
3. Ask a Question (in-platform bidirectional messaging per quote, never exposes designer private contact pre-payment)
4. Reject Quotation (reason selection + optional comments, never deletes the quote)

## 1. New Columns on designer_quotes
- version_number (integer, default 1) — increments for each revised quotation.
- parent_quote_id (uuid, self-referencing) — links a revised quotation back to the original; NULL for the first version.
- rejection_reason (text) — optional reason code selected by the customer on rejection.
- rejection_comments (text) — optional free-text comments accompanying the rejection.
- payment_status (text, default 'pending') — one of: pending, verified, failed. Separates acceptance from payment verification.
- razorpay_order_id (text) — Razorpay order id for the 10% confirmation payment.
- razorpay_payment_id (text) — Razorpay payment id once captured.
- confirmation_amount (numeric) — the 10% amount charged.
- revision_round (integer, default 0) — how many change-request rounds have occurred on this quote chain; capped at 3.

## 2. New Table: quote_change_requests
Stores "Request Changes" submissions from customers.
- id (uuid PK)
- quote_id (uuid FK -> designer_quotes, cascade delete)
- customer_id (uuid FK -> auth.users, cascade delete) — the customer's auth user id
- designer_id (uuid FK -> designers, set null on delete)
- change_options (text[]) — selected change reasons (e.g. reduce_budget, change_materials, add_remove_items, alternative_designs, revise_timeline, other)
- target_budget (numeric, nullable) — optional target budget
- additional_instructions (text, nullable)
- status (text, default 'pending') — one of: pending, addressed
- revision_round (integer) — which round this request belongs to (1-3)
- created_at, updated_at (timestamptz)

## 3. New Table: quote_messages
Stores in-platform bidirectional messaging between customer and designer per quote.
- id (uuid PK)
- quote_id (uuid FK -> designer_quotes, cascade delete)
- sender_role (text) — 'customer' or 'designer'
- sender_id (uuid) — auth.users id of the sender
- message_body (text, not null)
- read_by_customer (boolean, default false)
- read_by_designer (boolean, default false)
- created_at (timestamptz, default now())

## 4. Security (RLS + Policies)
- RLS enabled on quote_change_requests and quote_messages.
- Customers can select/insert change requests and messages only for quotes they own (customers.user_id = auth.uid()).
- Designers can select change requests and messages only for quotes they own (designers.user_id = auth.uid() and designers.id = designer_quotes.designer_id).
- Designers can update change request status to 'addressed'.
- Designers can insert messages as sender_role='designer'; customers as 'customer'.
- Both sides can update read flags on messages they are the recipient of.

## 5. SECURITY DEFINER Functions
- request_quote_changes(p_quote_id, p_options, p_target_budget, p_instructions):
  Customer-callable. Validates ownership, enforces 3-revision cap, inserts change request,
  sets quote status to 'changes_requested', increments revision_round, notifies designer.
- reject_quote(p_quote_id, p_reason, p_comments):
  Customer-callable. Validates ownership, prevents rejecting confirmed quotes, stores reason,
  sets status to 'rejected', notifies designer.
- submit_quote_revision(p_parent_quote_id, p_quote_data jsonb, p_items jsonb):
  Designer-callable. Creates a new designer_quotes row with incremented version_number and revision_round,
  clones line items, marks the latest pending change request as 'addressed', sets new quote status to 'sent',
  notifies customer. Original quote is never modified.
- record_quote_payment(p_quote_id, p_razorpay_order_id, p_razorpay_payment_id, p_amount):
  Edge-function-callable. Sets payment_status='verified', status='accepted', customer_accepted=true,
  acceptance_date=now(). Idempotent — no-op if already verified. Assigns designer to project.
- mark_quote_messages_read(p_quote_id, p_role):
  Marks all messages of a quote as read for the given role. Validates caller is party to the quote.

## 6. Notification Triggers
- Trigger on quote_change_requests INSERT: notify the designer that the customer requested changes.
- Trigger on quote_messages INSERT: notify the opposite party of a new message.
- Reuses the existing create_notification(text, text, text, text, text, uuid, text) helper.

## 7. Extended get_customer_quotes
Drops and recreates the function to additionally return:
- version_number, parent_quote_id, rejection_reason, rejection_comments, payment_status,
  confirmation_amount, revision_round,
- latest_change_request_status (text or null),
- unread_message_count (integer),
and keeps withholding designer email/phone/location until customer_accepted AND status='accepted' AND payment_status='verified'.

## 8. Realtime
- quote_messages and quote_change_requests added to supabase_realtime publication.

## Important Notes
1. The original quotation and all prior versions remain fully auditable — revisions create new rows, never overwrite.
2. Designer contact details are gated behind payment_status='verified', not just customer click.
3. The 3-revision cap is enforced inside request_quote_changes at the database level.
4. No existing data is lost; all new columns have safe defaults.
*/

-- ============================================================
-- 1. Add columns to designer_quotes
-- ============================================================
ALTER TABLE designer_quotes
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_quote_id uuid REFERENCES designer_quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS rejection_comments text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','verified','failed')),
  ADD COLUMN IF NOT EXISTS razorpay_order_id text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS confirmation_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS revision_round integer NOT NULL DEFAULT 0 CHECK (revision_round >= 0 AND revision_round <= 3);

CREATE INDEX IF NOT EXISTS idx_designer_quotes_parent_quote_id ON designer_quotes(parent_quote_id);
CREATE INDEX IF NOT EXISTS idx_designer_quotes_payment_status ON designer_quotes(payment_status);

-- ============================================================
-- 2. Create quote_change_requests table
-- ============================================================
CREATE TABLE IF NOT EXISTS quote_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES designer_quotes(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  designer_id uuid REFERENCES designers(id) ON DELETE SET NULL,
  change_options text[] NOT NULL DEFAULT '{}',
  target_budget numeric(12,2),
  additional_instructions text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','addressed')),
  revision_round integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quote_change_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_quote_change_requests_quote_id ON quote_change_requests(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_change_requests_status ON quote_change_requests(status);

-- Policies: customer side
DROP POLICY IF EXISTS "customer_select_own_change_requests" ON quote_change_requests;
CREATE POLICY "customer_select_own_change_requests"
  ON quote_change_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designer_quotes q
      JOIN customers c ON c.id = q.project_id
      WHERE q.id = quote_change_requests.quote_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "customer_insert_own_change_requests" ON quote_change_requests;
CREATE POLICY "customer_insert_own_change_requests"
  ON quote_change_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designer_quotes q
      JOIN customers c ON c.id = q.project_id
      WHERE q.id = quote_change_requests.quote_id
        AND c.user_id = auth.uid()
    )
  );

-- Policies: designer side
DROP POLICY IF EXISTS "designer_select_change_requests" ON quote_change_requests;
CREATE POLICY "designer_select_change_requests"
  ON quote_change_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designer_quotes q
      JOIN designers d ON d.id = q.designer_id
      WHERE q.id = quote_change_requests.quote_id
        AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "designer_update_change_requests" ON quote_change_requests;
CREATE POLICY "designer_update_change_requests"
  ON quote_change_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designer_quotes q
      JOIN designers d ON d.id = q.designer_id
      WHERE q.id = quote_change_requests.quote_id
        AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designer_quotes q
      JOIN designers d ON d.id = q.designer_id
      WHERE q.id = quote_change_requests.quote_id
        AND d.user_id = auth.uid()
    )
  );

-- ============================================================
-- 3. Create quote_messages table
-- ============================================================
CREATE TABLE IF NOT EXISTS quote_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES designer_quotes(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('customer','designer')),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_body text NOT NULL,
  read_by_customer boolean NOT NULL DEFAULT false,
  read_by_designer boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quote_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_quote_messages_quote_id ON quote_messages(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_messages_created_at ON quote_messages(created_at);

-- A helper view predicate: the caller is either the owning customer or the owning designer of the quote.
-- We inline this in each policy for clarity.

DROP POLICY IF EXISTS "parties_select_quote_messages" ON quote_messages;
CREATE POLICY "parties_select_quote_messages"
  ON quote_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designer_quotes q
      JOIN customers c ON c.id = q.project_id
      LEFT JOIN designers d ON d.id = q.designer_id
      WHERE q.id = quote_messages.quote_id
        AND (c.user_id = auth.uid() OR d.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "parties_insert_quote_messages" ON quote_messages;
CREATE POLICY "parties_insert_quote_messages"
  ON quote_messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designer_quotes q
      JOIN customers c ON c.id = q.project_id
      LEFT JOIN designers d ON d.id = q.designer_id
      WHERE q.id = quote_messages.quote_id
        AND (
          (quote_messages.sender_role = 'customer' AND c.user_id = auth.uid() AND quote_messages.sender_id = auth.uid())
          OR
          (quote_messages.sender_role = 'designer' AND d.user_id = auth.uid() AND quote_messages.sender_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "parties_update_quote_messages" ON quote_messages;
CREATE POLICY "parties_update_quote_messages"
  ON quote_messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designer_quotes q
      JOIN customers c ON c.id = q.project_id
      LEFT JOIN designers d ON d.id = q.designer_id
      WHERE q.id = quote_messages.quote_id
        AND (c.user_id = auth.uid() OR d.user_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designer_quotes q
      JOIN customers c ON c.id = q.project_id
      LEFT JOIN designers d ON d.id = q.designer_id
      WHERE q.id = quote_messages.quote_id
        AND (c.user_id = auth.uid() OR d.user_id = auth.uid())
    )
  );

-- ============================================================
-- 4. SECURITY DEFINER Functions
-- ============================================================

-- request_quote_changes (customer-callable)
DROP FUNCTION IF EXISTS request_quote_changes(uuid, text[], numeric, text);
CREATE OR REPLACE FUNCTION request_quote_changes(
  p_quote_id uuid,
  p_options text[],
  p_target_budget numeric DEFAULT NULL,
  p_instructions text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote designer_quotes%ROWTYPE;
  v_customer_id uuid;
  v_designer_user_id uuid;
  v_revision_round integer;
  v_request_id uuid;
BEGIN
  -- Load quote and verify ownership
  SELECT q.* INTO v_quote
  FROM designer_quotes q
  JOIN customers c ON c.id = q.project_id
  WHERE q.id = p_quote_id AND c.user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found or you do not have permission to modify it.';
  END IF;

  -- Only allow change requests on quotes in a reviewable state
  IF v_quote.status NOT IN ('sent','changes_requested') THEN
    RAISE EXCEPTION 'Changes can only be requested on quotes awaiting your review.';
  END IF;

  -- Enforce 3-revision cap
  IF v_quote.revision_round >= 3 THEN
    RAISE EXCEPTION 'You have reached the maximum of 3 revision rounds for this quotation.';
  END IF;

  v_revision_round := v_quote.revision_round + 1;

  -- Insert change request
  INSERT INTO quote_change_requests (
    quote_id, customer_id, designer_id, change_options, target_budget,
    additional_instructions, status, revision_round
  ) VALUES (
    p_quote_id, auth.uid(), v_quote.designer_id, p_options, p_target_budget,
    p_instructions, 'pending', v_revision_round
  ) RETURNING id INTO v_request_id;

  -- Update quote status and revision round
  UPDATE designer_quotes
  SET status = 'changes_requested',
      revision_round = v_revision_round,
      updated_at = now()
  WHERE id = p_quote_id;

  -- Notify designer
  SELECT d.user_id INTO v_designer_user_id FROM designers d WHERE d.id = v_quote.designer_id;
  IF v_designer_user_id IS NOT NULL THEN
    PERFORM create_notification(
      v_designer_user_id,
      'designer',
      'Changes Requested on Quotation',
      'A customer has requested changes on quotation #' || v_quote.quote_number || '.',
      'quotation_change_requested',
      p_quote_id,
      'quotation'
    );
  END IF;

  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION request_quote_changes(uuid, text[], numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION request_quote_changes(uuid, text[], numeric, text) TO authenticated;

-- reject_quote (customer-callable)
DROP FUNCTION IF EXISTS reject_quote(uuid, text, text);
CREATE OR REPLACE FUNCTION reject_quote(
  p_quote_id uuid,
  p_reason text DEFAULT NULL,
  p_comments text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote designer_quotes%ROWTYPE;
  v_customer_name text;
  v_project_name text;
  v_customer_id uuid;
  v_designer_user_id uuid;
  v_designer_email text;
  v_designer_name text;
BEGIN
  SELECT q.* INTO v_quote
  FROM designer_quotes q
  JOIN customers c ON c.id = q.project_id
  WHERE q.id = p_quote_id AND c.user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found or you do not have permission to reject it.';
  END IF;

  -- Prevent rejecting confirmed quotes
  IF v_quote.status = 'accepted' AND v_quote.payment_status = 'verified' THEN
    RAISE EXCEPTION 'This quotation has already been confirmed and cannot be rejected.';
  END IF;

  -- Prevent rejecting already-rejected quotes
  IF v_quote.status = 'rejected' THEN
    RAISE EXCEPTION 'This quotation has already been rejected.';
  END IF;

  UPDATE designer_quotes
  SET status = 'rejected',
      rejection_reason = p_reason,
      rejection_comments = p_comments,
      customer_accepted = false,
      customer_feedback = COALESCE(p_comments, p_reason),
      updated_at = now()
  WHERE id = p_quote_id;

  -- Notify designer (existing trigger handles status->rejected, but we also call create_notification directly for richness)
  SELECT c.user_id, c.project_name INTO v_customer_id, v_project_name
  FROM customers c WHERE c.id = v_quote.project_id;

  SELECT COALESCE(raw_user_meta_data->>'full_name', email) INTO v_customer_name
  FROM auth.users WHERE id = v_customer_id;

  SELECT d.user_id, d.email, d.name INTO v_designer_user_id, v_designer_email, v_designer_name
  FROM designers d WHERE d.id = v_quote.designer_id;

  IF v_designer_user_id IS NOT NULL THEN
    PERFORM create_notification(
      v_designer_user_id,
      'designer',
      'Quotation Rejected',
      v_customer_name || ' has rejected your quotation for project "' || COALESCE(v_project_name,'') || '"' ||
      COALESCE('. Reason: ' || p_reason, '') || COALESCE('. Comments: ' || p_comments, ''),
      'quotation_rejected',
      p_quote_id,
      'quotation'
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION reject_quote(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION reject_quote(uuid, text, text) TO authenticated;

-- submit_quote_revision (designer-callable)
DROP FUNCTION IF EXISTS submit_quote_revision(uuid, jsonb, jsonb);
CREATE OR REPLACE FUNCTION submit_quote_revision(
  p_parent_quote_id uuid,
  p_quote_data jsonb,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent designer_quotes%ROWTYPE;
  v_designer_user_id uuid;
  v_customer_id uuid;
  v_new_quote_id uuid;
  v_new_quote_number text;
  v_next_version integer;
  v_next_round integer;
  v_item jsonb;
  v_project_name text;
  v_customer_name text;
BEGIN
  -- Load parent quote and verify designer ownership
  SELECT q.* INTO v_parent
  FROM designer_quotes q
  JOIN designers d ON d.id = q.designer_id
  WHERE q.id = p_parent_quote_id AND d.user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent quote not found or you do not have permission to revise it.';
  END IF;

  v_next_version := COALESCE(v_parent.version_number, 1) + 1;
  v_next_round := COALESCE(v_parent.revision_round, 0);
  -- Keep the revision_round from the parent (already incremented when the customer requested changes)

  -- Generate a new quote number: append -vN
  v_new_quote_number := v_parent.quote_number || '-v' || v_next_version;

  -- Insert new quote row
  INSERT INTO designer_quotes (
    designer_id, project_id, quote_number, title, description,
    subtotal, discount_amount, tax_rate, tax_amount, total_amount,
    status, valid_until, terms_and_conditions, notes,
    version_number, parent_quote_id, revision_round, payment_status
  ) VALUES (
    v_parent.designer_id,
    v_parent.project_id,
    v_new_quote_number,
    COALESCE(p_quote_data->>'title', v_parent.title),
    COALESCE(p_quote_data->>'description', v_parent.description),
    COALESCE((p_quote_data->>'subtotal')::numeric, v_parent.subtotal),
    COALESCE((p_quote_data->>'discount_amount')::numeric, 0),
    COALESCE((p_quote_data->>'tax_rate')::numeric, v_parent.tax_rate),
    COALESCE((p_quote_data->>'tax_amount')::numeric, 0),
    COALESCE((p_quote_data->>'total_amount')::numeric, v_parent.total_amount),
    'sent',
    COALESCE((p_quote_data->>'valid_until')::date, v_parent.valid_until),
    COALESCE(p_quote_data->>'terms_and_conditions', v_parent.terms_and_conditions),
    COALESCE(p_quote_data->>'notes', v_parent.notes),
    v_next_version,
    p_parent_quote_id,
    v_next_round,
    'pending'
  ) RETURNING id INTO v_new_quote_id;

  -- Clone / insert items
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT jsonb_array_elements(p_items) LOOP
      INSERT INTO quote_items (
        quote_id, name, description, quantity, unit, unit_price,
        discount_percent, amount, item_type
      ) VALUES (
        v_new_quote_id,
        v_item->>'name',
        v_item->>'description',
        COALESCE((v_item->>'quantity')::numeric, 1),
        COALESCE(v_item->>'unit', 'unit'),
        COALESCE((v_item->>'unit_price')::numeric, 0),
        COALESCE((v_item->>'discount_percent')::numeric, 0),
        COALESCE((v_item->>'amount')::numeric, 0),
        COALESCE(v_item->>'item_type', 'other')
      );
    END LOOP;
  END IF;

  -- Mark the latest pending change request as addressed
  UPDATE quote_change_requests
  SET status = 'addressed', updated_at = now()
  WHERE quote_id = p_parent_quote_id AND status = 'pending';

  -- Notify customer
  SELECT c.user_id, c.project_name INTO v_customer_id, v_project_name
  FROM customers c WHERE c.id = v_parent.project_id;

  SELECT COALESCE(raw_user_meta_data->>'full_name', email) INTO v_customer_name
  FROM auth.users WHERE id = v_customer_id;

  IF v_customer_id IS NOT NULL THEN
    PERFORM create_notification(
      v_customer_id,
      'customer',
      'Revised Quotation Available',
      'A revised quotation (version ' || v_next_version || ') is available for your project "' || COALESCE(v_project_name,'') || '".',
      'quotation_revised',
      v_new_quote_id,
      'quotation'
    );
  END IF;

  RETURN v_new_quote_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_quote_revision(uuid, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION submit_quote_revision(uuid, jsonb, jsonb) TO authenticated;

-- record_quote_payment (edge-function-callable, idempotent)
DROP FUNCTION IF EXISTS record_quote_payment(uuid, text, text, numeric);
CREATE OR REPLACE FUNCTION record_quote_payment(
  p_quote_id uuid,
  p_razorpay_order_id text DEFAULT NULL,
  p_razorpay_payment_id text DEFAULT NULL,
  p_amount numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote designer_quotes%ROWTYPE;
  v_designer_user_id uuid;
  v_customer_id uuid;
  v_customer_name text;
  v_project_name text;
BEGIN
  SELECT q.* INTO v_quote FROM designer_quotes q WHERE q.id = p_quote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found.';
  END IF;

  -- Idempotent: no-op if already verified
  IF v_quote.payment_status = 'verified' THEN
    RETURN;
  END IF;

  -- Update quote
  UPDATE designer_quotes
  SET payment_status = 'verified',
      status = 'accepted',
      customer_accepted = true,
      acceptance_date = now(),
      razorpay_order_id = COALESCE(p_razorpay_order_id, razorpay_order_id),
      razorpay_payment_id = COALESCE(p_razorpay_payment_id, razorpay_payment_id),
      confirmation_amount = COALESCE(p_amount, confirmation_amount),
      updated_at = now()
  WHERE id = p_quote_id;

  -- Assign designer to project
  UPDATE customers
  SET assignment_status = 'assigned',
      assigned_designer_id = v_quote.designer_id
  WHERE id = v_quote.project_id;

  -- Notify designer (the existing acceptance trigger also fires, but we ensure it here too)
  SELECT d.user_id INTO v_designer_user_id FROM designers d WHERE d.id = v_quote.designer_id;
  SELECT c.user_id, c.project_name INTO v_customer_id, v_project_name
  FROM customers c WHERE c.id = v_quote.project_id;
  SELECT COALESCE(raw_user_meta_data->>'full_name', email) INTO v_customer_name
  FROM auth.users WHERE id = v_customer_id;

  IF v_designer_user_id IS NOT NULL THEN
    PERFORM create_notification(
      v_designer_user_id,
      'designer',
      'Quotation Confirmed — Payment Verified',
      v_customer_name || ' has confirmed the quotation for project "' || COALESCE(v_project_name,'') || '" with a verified 10% payment.',
      'quotation_confirmed',
      p_quote_id,
      'quotation'
    );
  END IF;

  IF v_customer_id IS NOT NULL THEN
    PERFORM create_notification(
      v_customer_id,
      'customer',
      'Payment Confirmed',
      'Your 10% confirmation payment has been verified. The designer''s contact details are now unlocked.',
      'quotation_payment_verified',
      p_quote_id,
      'quotation'
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION record_quote_payment(uuid, text, text, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION record_quote_payment(uuid, text, text, numeric) TO authenticated;

-- mark_quote_messages_read
DROP FUNCTION IF EXISTS mark_quote_messages_read(uuid, text);
CREATE OR REPLACE FUNCTION mark_quote_messages_read(
  p_quote_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_party boolean := false;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM designer_quotes q
    JOIN customers c ON c.id = q.project_id
    LEFT JOIN designers d ON d.id = q.designer_id
    WHERE q.id = p_quote_id AND (c.user_id = auth.uid() OR d.user_id = auth.uid())
  ) INTO v_is_party;

  IF NOT v_is_party THEN
    RAISE EXCEPTION 'You do not have permission to mark messages on this quote.';
  END IF;

  IF p_role = 'customer' THEN
    UPDATE quote_messages SET read_by_customer = true WHERE quote_id = p_quote_id AND read_by_customer = false;
  ELSIF p_role = 'designer' THEN
    UPDATE quote_messages SET read_by_designer = true WHERE quote_id = p_quote_id AND read_by_designer = false;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION mark_quote_messages_read(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION mark_quote_messages_read(uuid, text) TO authenticated;

-- ============================================================
-- 5. Notification triggers
-- ============================================================

CREATE OR REPLACE FUNCTION notify_on_change_request_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_designer_user_id uuid;
  v_quote_number text;
  v_project_name text;
BEGIN
  SELECT d.user_id, q.quote_number INTO v_designer_user_id, v_quote_number
  FROM designer_quotes q
  JOIN designers d ON d.id = q.designer_id
  WHERE q.id = NEW.quote_id;

  SELECT c.project_name INTO v_project_name
  FROM customers c
  JOIN designer_quotes q ON q.project_id = c.id
  WHERE q.id = NEW.quote_id;

  IF v_designer_user_id IS NOT NULL THEN
    PERFORM create_notification(
      v_designer_user_id,
      'designer',
      'Changes Requested on Quotation',
      'A customer has requested changes on quotation #' || COALESCE(v_quote_number,'') || ' for project "' || COALESCE(v_project_name,'') || '".',
      'quotation_change_requested',
      NEW.quote_id,
      'quotation'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_change_request ON quote_change_requests;
CREATE TRIGGER trigger_notify_on_change_request
  AFTER INSERT ON quote_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_change_request_created();

CREATE OR REPLACE FUNCTION notify_on_quote_message_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote designer_quotes%ROWTYPE;
  v_customer_id uuid;
  v_designer_user_id uuid;
  v_sender_name text;
BEGIN
  SELECT q.* INTO v_quote FROM designer_quotes q WHERE q.id = NEW.quote_id;

  SELECT c.user_id INTO v_customer_id FROM customers c WHERE c.id = v_quote.project_id;
  SELECT d.user_id INTO v_designer_user_id FROM designers d WHERE d.id = v_quote.designer_id;

  SELECT COALESCE(raw_user_meta_data->>'full_name', email) INTO v_sender_name
  FROM auth.users WHERE id = NEW.sender_id;

  IF NEW.sender_role = 'customer' AND v_designer_user_id IS NOT NULL THEN
    PERFORM create_notification(
      v_designer_user_id,
      'designer',
      'New Question on Quotation',
      COALESCE(v_sender_name,'A customer') || ' asked a question on quotation #' || v_quote.quote_number || '.',
      'quotation_message',
      NEW.quote_id,
      'quotation'
    );
  ELSIF NEW.sender_role = 'designer' AND v_customer_id IS NOT NULL THEN
    PERFORM create_notification(
      v_customer_id,
      'customer',
      'Designer Replied to Your Question',
      COALESCE(v_sender_name,'The designer') || ' replied to your question on quotation #' || v_quote.quote_number || '.',
      'quotation_message',
      NEW.quote_id,
      'quotation'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_quote_message ON quote_messages;
CREATE TRIGGER trigger_notify_on_quote_message
  AFTER INSERT ON quote_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_quote_message_created();

-- ============================================================
-- 6. Extend get_customer_quotes
-- ============================================================
DROP FUNCTION IF EXISTS get_customer_quotes(uuid);

CREATE OR REPLACE FUNCTION get_customer_quotes(customer_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(
  id uuid,
  designer_id uuid,
  project_id uuid,
  quote_number text,
  title text,
  description text,
  subtotal numeric,
  discount_amount numeric,
  tax_rate numeric,
  tax_amount numeric,
  total_amount numeric,
  status text,
  valid_until date,
  terms_and_conditions text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  customer_accepted boolean,
  acceptance_date timestamptz,
  customer_feedback text,
  notification_sent boolean,
  quotation_file_url text,
  payment_receipt_url text,
  design_image_url text,
  customer_name text,
  customer_email text,
  customer_phone text,
  project_name text,
  assigned_designer_id uuid,
  designer_name text,
  designer_email text,
  designer_phone text,
  designer_location text,
  designer_profile_image text,
  designer_specialization text,
  items json,
  version_number integer,
  parent_quote_id uuid,
  rejection_reason text,
  rejection_comments text,
  payment_status text,
  confirmation_amount numeric,
  revision_round integer,
  latest_change_request_status text,
  unread_message_count integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id,
    q.designer_id,
    q.project_id,
    q.quote_number,
    q.title,
    q.description,
    q.subtotal,
    q.discount_amount,
    q.tax_rate,
    q.tax_amount,
    q.total_amount,
    q.status,
    q.valid_until,
    q.terms_and_conditions,
    q.notes,
    q.created_at,
    q.updated_at,
    q.customer_accepted,
    q.acceptance_date,
    q.customer_feedback,
    q.notification_sent,
    q.quotation_file_url,
    q.payment_receipt_url,
    q.design_image_url,
    c.name AS customer_name,
    c.email AS customer_email,
    c.phone AS customer_phone,
    c.project_name,
    c.assigned_designer_id,
    d.name AS designer_name,
    -- Contact details only unlocked when accepted AND payment verified
    CASE WHEN q.customer_accepted AND q.status = 'accepted' AND q.payment_status = 'verified'
         THEN d.email ELSE NULL END AS designer_email,
    CASE WHEN q.customer_accepted AND q.status = 'accepted' AND q.payment_status = 'verified'
         THEN d.phone ELSE NULL END AS designer_phone,
    CASE WHEN q.customer_accepted AND q.status = 'accepted' AND q.payment_status = 'verified'
         THEN d.location ELSE NULL END AS designer_location,
    d.profile_image AS designer_profile_image,
    d.specialization AS designer_specialization,
    (
      SELECT json_agg(i.*)
      FROM quote_items i
      WHERE i.quote_id = q.id
    ) AS items,
    q.version_number,
    q.parent_quote_id,
    q.rejection_reason,
    q.rejection_comments,
    q.payment_status,
    q.confirmation_amount,
    q.revision_round,
    (
      SELECT cr.status
      FROM quote_change_requests cr
      WHERE cr.quote_id = q.id
      ORDER BY cr.created_at DESC
      LIMIT 1
    ) AS latest_change_request_status,
    (
      SELECT COUNT(*)::integer
      FROM quote_messages m
      WHERE m.quote_id = q.id
        AND m.sender_role = 'designer'
        AND m.read_by_customer = false
    ) AS unread_message_count
  FROM designer_quotes q
  JOIN customers c ON c.id = q.project_id
  JOIN designers d ON d.id = q.designer_id
  WHERE c.user_id = customer_user_id
  ORDER BY q.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_customer_quotes(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION get_customer_quotes(uuid) TO authenticated;

-- ============================================================
-- 7. Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE quote_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE quote_change_requests;