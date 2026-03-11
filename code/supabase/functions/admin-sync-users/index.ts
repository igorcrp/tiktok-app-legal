import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    console.log("Starting user synchronization...");

    // Get all users from auth.users
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    
    if (!authUsers || !authUsers.users) {
      throw new Error("Failed to fetch auth users");
    }

    console.log(`Found ${authUsers.users.length} users in auth.users`);

    // Get all users from public.users
    const { data: publicUsers, error: publicUsersError } = await supabaseAdmin
      .from("users")
      .select("id, email");

    if (publicUsersError) {
      throw new Error(`Failed to fetch public users: ${publicUsersError.message}`);
    }

    const publicUserIds = new Set(publicUsers?.map(u => u.id) || []);
    console.log(`Found ${publicUsers?.length || 0} users in public.users`);

    let syncedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Sync missing users from auth.users to public.users
    for (const authUser of authUsers.users) {
      if (!publicUserIds.has(authUser.id)) {
        try {
          const { error: insertError } = await supabaseAdmin
            .from("users")
            .insert({
              id: authUser.id,
              email: authUser.email || "",
              name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "User",
              level_id: 1,
              status_users: authUser.email_confirmed_at ? "active" : "pending",
              subscription_tier: "Free",
              email_verified: !!authUser.email_confirmed_at,
              created_at: authUser.created_at,
            });

          if (insertError) {
            console.error(`Error syncing user ${authUser.email}:`, insertError);
            errorCount++;
            errors.push(`${authUser.email}: ${insertError.message}`);
          } else {
            console.log(`Synced user: ${authUser.email}`);
            syncedCount++;
          }
        } catch (error: any) {
          console.error(`Exception syncing user ${authUser.email}:`, error);
          errorCount++;
          errors.push(`${authUser.email}: ${error.message}`);
        }
      }
    }

    console.log(`Synchronization complete. Synced: ${syncedCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedCount,
        errors: errorCount,
        errorDetails: errors,
        message: `Synchronized ${syncedCount} users successfully${errorCount > 0 ? ` with ${errorCount} errors` : ""}`,
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
    console.error("Error in admin-sync-users function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "An error occurred while synchronizing users",
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
