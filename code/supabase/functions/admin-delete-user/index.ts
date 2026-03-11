import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeleteUserRequest {
  userId: string;
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
    const requestData: DeleteUserRequest = await req.json();
    const { userId } = requestData;

    if (!userId) {
      throw new Error("User ID is required");
    }

    // Prevent admin from deleting themselves
    if (userId === user.id) {
      throw new Error("You cannot delete your own account");
    }

    console.log("Deleting user:", userId);

    // Delete from auth.users first (this will cascade to public.users via foreign key)
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      console.error("Error deleting user from auth:", authDeleteError);
      throw new Error(`Failed to delete user from auth: ${authDeleteError.message}`);
    }

    console.log("User deleted from auth.users");

    // Also explicitly delete from public.users in case cascade didn't work
    const { error: dbDeleteError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", userId);

    if (dbDeleteError) {
      console.error("Error deleting user from database:", dbDeleteError);
      // Don't throw here since auth deletion succeeded
      console.log("Warning: User deleted from auth but may still exist in public.users");
    } else {
      console.log("User deleted from public.users");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "User deleted successfully",
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
    console.error("Error in admin-delete-user function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "An error occurred while deleting user",
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
