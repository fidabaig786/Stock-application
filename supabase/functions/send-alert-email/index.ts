import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertEmailRequest {
  email: string;
  ticker: string;
  assetType: string;
  metCriteria: string[];
  price: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, ticker, assetType, metCriteria, price }: AlertEmailRequest = await req.json();

    console.log(`Sending alert email to ${email} for ${ticker}`);

    const criteriaList = metCriteria.join(", ");

    const emailResponse = await resend.emails.send({
      from: "Stock Alerts <onboarding@resend.dev>",
      to: [email],
      subject: `🎯 Alert: ${ticker} meets your criteria!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Trading Alert</h1>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #1f2937;">${ticker}</h2>
            <p><strong>Asset Type:</strong> ${assetType}</p>
            <p><strong>Current Price:</strong> $${price.toFixed(2)}</p>
            <p><strong>Criteria Met:</strong> ${criteriaList}</p>
          </div>
          <p style="color: #6b7280;">
            This ${assetType.toLowerCase()} has met your configured analysis criteria. 
            Review the full analysis in your dashboard for more details.
          </p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
            You are receiving this email because you have enabled email notifications for this criteria combination.
          </p>
        </div>
      `,
    });

    console.log("Alert email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-alert-email function:", error);
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
