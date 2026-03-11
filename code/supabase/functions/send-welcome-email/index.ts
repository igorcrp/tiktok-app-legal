import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  name: string;
  temporaryPassword: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, temporaryPassword }: WelcomeEmailRequest = await req.json();

    console.log("Sending welcome email to:", email);

    const emailResponse = await resend.emails.send({
      from: "Platform <onboarding@resend.dev>",
      to: [email],
      subject: "Welcome! Your Account Has Been Created",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px;">Welcome to Our Platform, ${name}!</h1>
          
          <p style="font-size: 16px; color: #555; line-height: 1.6;">
            Your account has been successfully created by an administrator. We're excited to have you on board!
          </p>
          
          <div style="background-color: #f5f5f5; padding: 25px; border-radius: 8px; margin: 25px 0; border: 2px solid #e0e0e0;">
            <h2 style="color: #333; margin-top: 0; font-size: 18px;">🔐 Your Temporary Login Credentials</h2>
            <p style="font-size: 14px; color: #666; margin: 10px 0;">
              <strong>Email:</strong> ${email}
            </p>
            <p style="font-size: 14px; color: #666; margin: 10px 0;">
              <strong>Temporary Password:</strong><br>
              <code style="background-color: #fff; padding: 10px 15px; border-radius: 4px; display: inline-block; margin-top: 5px; font-size: 16px; border: 1px solid #ddd; letter-spacing: 1px;">${temporaryPassword}</code>
            </p>
          </div>
          
          <div style="background-color: #fff3cd; border-left: 4px solid #ff6b6b; padding: 20px; margin: 25px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 15px; color: #856404; line-height: 1.6;">
              <strong>⚠️ CRITICAL SECURITY NOTICE:</strong><br><br>
              This is a <strong>temporary password</strong> that can only be used once. You <strong>MUST</strong> change your password immediately after your first login.<br><br>
              <strong>Steps to change your password:</strong><br>
              1. Log in with the credentials above<br>
              2. Navigate to <strong>"My Profile"</strong><br>
              3. Update your password with a strong, unique password<br><br>
              <em>Your account security depends on changing this temporary password!</em>
            </p>
          </div>
          
          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #1565c0;">
              💡 <strong>Tip:</strong> Use a strong password with at least 8 characters, including uppercase, lowercase, numbers, and special characters.
            </p>
          </div>
          
          <p style="font-size: 14px; color: #555; line-height: 1.6;">
            If you have any questions or need assistance, please don't hesitate to contact our support team.
          </p>
          
          <p style="font-size: 14px; color: #888; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
            Best regards,<br>
            <strong>The Platform Team</strong>
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
