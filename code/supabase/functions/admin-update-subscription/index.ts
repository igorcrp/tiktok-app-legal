import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-UPDATE-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Create Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin access
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user is admin
    const { data: adminData, error: adminError } = await supabaseClient
      .from("users")
      .select("level_id")
      .eq("id", user.id)
      .single();

    if (adminError || !adminData || adminData.level_id < 2) {
      throw new Error("Admin access required");
    }

    const body = await req.json();
    const { userId, subscriptionTier } = body;

    if (!userId || !subscriptionTier) {
      throw new Error("userId and subscriptionTier are required");
    }

    logStep("Updating subscription", { userId, subscriptionTier });

    // Get user data
    const { data: userData, error: userError } = await supabaseClient
      .from("users")
      .select("email, stripe_customer_id")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      throw new Error("User not found");
    }

    // Update in Supabase
    const subscriptionData = {
      subscription_tier: subscriptionTier,
      subscribed: subscriptionTier === "Premium",
      subscription_end: subscriptionTier === "Premium" ? null : null,
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabaseClient
      .from("users")
      .update(subscriptionData)
      .eq("id", userId);

    if (updateError) {
      logStep("Error updating user in Supabase", updateError);
      throw updateError;
    }

    logStep("User updated in Supabase", { userId, subscriptionTier });

    // Update in Stripe if customer exists
    if (userData.stripe_customer_id) {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey) {
        const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

        try {
          // Update customer metadata in Stripe
          await stripe.customers.update(userData.stripe_customer_id, {
            metadata: {
              subscription_tier: subscriptionTier,
              updated_by_admin: "true",
              updated_at: new Date().toISOString()
            }
          });

          logStep("Stripe customer metadata updated", {
            customerId: userData.stripe_customer_id,
            tier: subscriptionTier
          });

          // If setting to Free, cancel any active subscriptions
          if (subscriptionTier === "Free") {
            const subscriptions = await stripe.subscriptions.list({
              customer: userData.stripe_customer_id,
              status: 'active',
              limit: 10
            });

            for (const subscription of subscriptions.data) {
              await stripe.subscriptions.cancel(subscription.id);
              logStep("Cancelled Stripe subscription", { subscriptionId: subscription.id });
            }
          }
        } catch (stripeError) {
          logStep("Stripe update failed (non-critical)", stripeError);
          // Don't throw - Supabase update was successful
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Subscription updated to ${subscriptionTier}`
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
