// Supabase Edge Function: analyze-activity
// Deploy with: supabase functions deploy analyze-activity
// Set GEMINI_API_KEY as a Supabase secret. Never place it in the HTML.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    // Validate the caller's Supabase JWT before allowing AI use.
    const auth = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!auth) return Response.json({ error: "Sign in required." }, { status: 401, headers: corsHeaders });
    const verify = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: auth },
    });
    if (!verify.ok) return Response.json({ error: "Invalid session." }, { status: 401, headers: corsHeaders });

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return Response.json({ error: "Gemini API key is not configured. Set GEMINI_API_KEY in Supabase secrets." }, { status: 503, headers: corsHeaders });

    const body = await req.json();
    const a = body?.activity ?? {};
    const distance = Number(a.distance_km ?? 0);
    const duration = Number(a.duration_minutes ?? 0);
    if (!Number.isFinite(distance) || !Number.isFinite(duration) || distance < 0 || duration < 0) {
      return Response.json({ error: "Invalid distance or duration." }, { status: 400, headers: corsHeaders });
    }
    const activity = {
      date: String(a.session_date ?? "").slice(0, 10),
      type: String(a.session_type ?? "Run").slice(0, 60),
      distance_km: distance,
      duration_minutes: duration,
      effort_1_to_10: a.effort == null ? null : Math.min(10, Math.max(1, Number(a.effort))),
      remarks: String(a.remarks ?? "").slice(0, 2500),
      pace_min_per_km: distance > 0 ? Math.round((duration / distance) * 100) / 100 : null,
    };

    const configuredModel = Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash";
    const model = configuredModel.replace(/^models\//, "");
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: `You are a careful recreational running coach. Give a concise review: (1) what the numbers suggest, (2) one positive observation, (3) one practical next-session adjustment, and (4) recovery reminder. Use the supplied effort and remarks. Do not diagnose injuries or provide medical advice. Do not claim that one workout proves fitness or predict a race result. If pain, dizziness, chest symptoms, or unusual shortness of breath are mentioned, recommend stopping and seeking appropriate medical care.\n\nReview this activity:\n${JSON.stringify(activity)}`,
      })
    });
    const result = await response.json();
    if (!response.ok) {
      return Response.json({ error: result?.error?.message || "AI provider request failed." }, { status: 502, headers: corsHeaders });
    }
    const analysis = result?.output_text || result?.outputs
      ?.filter((output: { type?: string }) => output.type === "text")
      .map((output: { text?: string }) => output.text || "")
      .join("\n")
      .trim();
    if (!analysis) return Response.json({ error: "No analysis returned by provider." }, { status: 502, headers: corsHeaders });
    return Response.json({ analysis }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return Response.json({ error: error?.message || "Unexpected error." }, { status: 500, headers: corsHeaders });
  }
});
