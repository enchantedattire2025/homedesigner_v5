/*
# Create get_accepted_quote_designer_contact SECURITY DEFINER function

Creates a SECURITY DEFINER function that returns designer contact details
(name, phone, email, location, profile_image, specialization) only when the
calling customer has an accepted quote from that designer. This enforces
access control server-side: customers cannot retrieve contact details for
quotes they haven't accepted, and cannot access another customer's designer
info.

- Function is STABLE and SECURITY DEFINER with search_path pinned to public.
- EXECUTE revoked from anon, granted to authenticated only.
- No tables or data are modified.
*/

CREATE OR REPLACE FUNCTION get_accepted_quote_designer_contact(p_quote_id uuid)
RETURNS TABLE(
  designer_name text,
  designer_phone text,
  designer_email text,
  designer_location text,
  designer_profile_image text,
  designer_specialization text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.name,
    d.phone,
    d.email,
    d.location,
    d.profile_image,
    d.specialization
  FROM designer_quotes q
  JOIN designers d ON d.id = q.designer_id
  JOIN customers c ON c.id = q.project_id
  WHERE q.id = p_quote_id
    AND c.user_id = auth.uid()
    AND q.status = 'accepted'
    AND q.customer_accepted = true;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_accepted_quote_designer_contact FROM anon;
GRANT EXECUTE ON FUNCTION get_accepted_quote_designer_contact TO authenticated;
