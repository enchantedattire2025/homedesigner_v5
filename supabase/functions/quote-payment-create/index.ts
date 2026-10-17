import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

if (import.meta.main) {
  Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      // Authenticate the caller from the Authorization header
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabase.auth.getUser(token);

      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userId = userData.user.id;

      const body = await req.json();
      const quoteId: string | undefined = body?.quoteId;
      if (!quoteId) {
        return new Response(JSON.stringify({ error: "Missing quoteId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Load the quote and verify ownership via the customer link
      const { data: quote, error: quoteError } = await supabase
        .from("designer_quotes")
        .select("id, total_amount, project_id, status, payment_status, designer_id")
        .eq("id", quoteId)
        .maybeSingle();

      if (quoteError || !quote) {
        return new Response(JSON.stringify({ error: "Quote not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: customer, error: custError } = await supabase
        .from("customers")
        .select("id, user_id")
        .eq("id", quote.project_id)
        .maybeSingle();

      if (custError || !customer || customer.user_id !== userId) {
        return new Response(JSON.stringify({ error: "You do not own this quote" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent re-payment if already verified
      if (quote.payment_status === "verified") {
        return new Response(
          JSON.stringify({ error: "This quotation has already been confirmed." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const totalAmount = Number(quote.total_amount);
      const confirmationAmount = Math.round(totalAmount * 0.1 * 100); // paise

      // Razorpay key (placeholder — replace with real RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET secrets)
      const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID") || "rzp_test_placeholder";
      const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "placeholder_secret";

      const orderPayload = {
        amount: confirmationAmount,
        currency: "INR",
        receipt: `quote_${quoteId.slice(0, 30)}`,
        notes: {
          quote_id: quoteId,
          customer_user_id: userId,
          confirmation: "10_percent",
        },
      };

      const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Basic " + btoa(`${razorpayKeyId}:${razorpayKeySecret}`),
        },
        body: JSON.stringify(orderPayload),
      });

      const orderJson = await orderRes.json();

      if (!orderRes.ok) {
        // Surface a clear message so the app owner knows to set real Razorpay keys
        return new Response(
          JSON.stringify({
            error:
              "Razorpay order creation failed. If you are the app owner, set the RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET edge function secrets to your real Razorpay credentials.",
            details: orderJson,
            placeholderMode: razorpayKeyId === "rzp_test_placeholder",
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Persist the order id on the quote and set status to accepted-pending
      await supabase
        .from("designer_quotes")
        .update({
          razorpay_order_id: orderJson.id,
          confirmation_amount: confirmationAmount / 100,
          status: "accepted",
          customer_accepted: true,
          acceptance_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", quoteId);

      return new Response(
        JSON.stringify({
          orderId: orderJson.id,
          amount: confirmationAmount,
          currency: "INR",
          keyId: razorpayKeyId,
        }),
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
