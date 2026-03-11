import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  name: string;
  level_id: number;
  status_users: "active" | "pending" | "inactive";
  email_verified: boolean;
  subscribed?: boolean;
  subscription_tier?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user is admin (level_id >= 2)
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("level_id")
      .eq("id", user.id)
      .single();

    if (userError || !userData || userData.level_id < 2) {
      throw new Error("User is not an admin");
    }

    // Parse request body
    const requestData: CreateUserRequest = await req.json();
    const { email, name, level_id, status_users, email_verified, subscribed, subscription_tier } = requestData;

    console.log("Creating user:", email);

    // Check if user already exists in auth
    const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = existingAuthUsers?.users.find(u => u.email === email);

    if (existingAuthUser) {
      // Check if user exists in public.users table
      const { data: existingDbUser } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .single();

      if (existingDbUser) {
        throw new Error(`User with email ${email} already exists in the system`);
      }

      console.log("Auth user exists, but not in public.users. Will use existing auth user.");
    }

    // Generate strong temporary password (16 characters with letters, numbers and special chars)
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
    let temporaryPassword = '';
    const crypto = globalThis.crypto;
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    for (let i = 0; i < 16; i++) {
      temporaryPassword += chars[array[i] % chars.length];
    }

    let authUserId: string;

    if (existingAuthUser) {
      // Update existing auth user's password
      const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingAuthUser.id,
        {
          password: temporaryPassword,
          email_confirm: email_verified,
        }
      );

      if (updateError) {
        console.error("Error updating auth user:", updateError);
        throw new Error(`Failed to update auth user: ${updateError.message}`);
      }

      authUserId = existingAuthUser.id;
      console.log("Auth user updated:", authUserId);
    } else {
      // Create new auth user
      const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: email_verified,
      });

      if (authCreateError) {
        console.error("Error creating auth user:", authCreateError);
        throw new Error(`Failed to create auth user: ${authCreateError.message}`);
      }

      authUserId = authData.user.id;
      console.log("Auth user created:", authUserId);
    }

    // Wait a bit for the trigger to complete (only if new user was created)
    if (!existingAuthUser) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Insert or update user data in users table
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from("users")
      .upsert({
        id: authUserId,
        email,
        name,
        level_id,
        status_users,
        email_verified: email_verified || false,
        subscribed: subscribed || false,
        subscription_tier: subscription_tier || "Free",
        must_change_password: true, // Force password change on first login
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error upserting user in database:", dbError);
      // Try to delete the auth user if database operation fails (only if we created it)
      if (!existingAuthUser) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      }
      throw new Error(`Failed to upsert user in database: ${dbError.message}`);
    }

    console.log("User updated in database:", dbUser.id);

    // Send welcome email with temporary password
    try {
      console.log("Sending welcome email to:", email);
      const { error: emailError } = await supabaseAdmin.functions.invoke('send-welcome-email', {
        body: {
          email,
          name,
          temporaryPassword
        }
      });

      if (emailError) {
        console.error("Error sending welcome email:", emailError);
        // Don't fail the whole operation if email fails
      } else {
        console.log("Welcome email sent successfully");
      }
    } catch (emailError) {
      console.error("Exception sending welcome email:", emailError);
      // Don't fail the whole operation if email fails
    }

    // Create Stripe customer
    let stripeCustomerId = null;
    try {
      const { data: stripeData, error: stripeError } = await supabaseAdmin.functions.invoke(
        "create-stripe-customer",
        {
          body: {
            email,
            name,
            userId: dbUser.id,
          },
        }
      );

      if (!stripeError && stripeData?.stripe_customer_id) {
        stripeCustomerId = stripeData.stripe_customer_id;
        await supabaseAdmin
          .from("users")
          .update({ stripe_customer_id: stripeCustomerId })
          .eq("id", dbUser.id);
        console.log("Stripe customer created:", stripeCustomerId);
      }
    } catch (stripeError) {
      console.error("Error with Stripe integration:", stripeError);
      // Don't fail the whole operation if Stripe fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          ...dbUser,
          stripe_customer_id: stripeCustomerId,
        },
        temporaryPassword: temporaryPassword,
        message: 'User created successfully. Please provide the temporary password to the user.',
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in admin-create-user function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "An error occurred while creating user",
      }),
      {
        status: 400,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
