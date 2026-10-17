import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Minimal HMAC-SHA256 using Web Crypto (Deno compatible)
async function hmacSha256(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

if (import.meta.main) {
  Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const quoteId: string | undefined = body?.quoteId;
      const razorpayOrderId: string | undefined = body?.razorpayOrderId;
      const razorpayPaymentId: string | undefined = body?.razorpayPaymentId;
      const razorpaySignature: string | undefined = body?.razorpaySignature;

      if (!quoteId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return new Response(
          JSON.stringify({ error: "Missing payment verification fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "placeholder_secret";

      const expectedSignature = await hmacSha256(
        `${razorpayOrderId}|${razorpayPaymentId}`,
        razorpayKeySecret
      );

      if (expectedSignature !== razorpaySignature) {
        return new Response(
          JSON.stringify({ error: "Payment signature verification failed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Load quote to compute confirmation amount for record_quote_payment
      const { data: quote } = await supabase
        .from("designer_quotes")
        .select("id, confirmation_amount, project_id")
        .eq("id", quoteId)
        .maybeSingle();

      if (!quote) {
        return new Response(JSON.stringify({ error: "Quote not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Call the SECURITY DEFINER function to mark payment verified (idempotent)
      const { error: rpcError } = await supabase.rpc("record_quote_payment", {
        p_quote_id: quoteId,
        p_razorpay_order_id: razorpayOrderId,
        p_razorpay_payment_id: razorpayPaymentId,
        p_amount: quote.confirmation_amount,
      });

      if (rpcError) {
        return new Response(
          JSON.stringify({ error: rpcError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ verified: true, quoteId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: (err as Error).message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  });
}
