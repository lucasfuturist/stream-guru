// supabase/functions/chat-session/index.ts

import { createClient } from "@supabase/supabase-js";

// --- NEW: Define CORS Headers ---
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const call = (fn: string, body: unknown) => {
  const url = `${Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", ".functions.supabase.co")}/${fn}`;
  return fetch(url, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      // We must pass the service role key to call other functions internally
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`
    },
    body: JSON.stringify(body)
  }).then(r => r.json());
};

Deno.serve(async (req) => {
  // --- NEW: Handle preflight OPTIONS request ---
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { prompt } = await req.json();
    let boosts: string[] = [];

    for (let attempt = 1; attempt <= 3; attempt++) {
      const bot = await call("chatbot", { prompt, boosts });
      if (bot.error) throw new Error(bot.error);

      const audit = await call("auditor", {
        userQuery: prompt,
        chatbotResp: bot
      });
      if (audit.error) throw new Error(audit.error);

      if (!audit.ok && audit.vibes?.length) {
        boosts = audit.vibes.map((v: any) => v.tag);
        console.log(`Attempt ${attempt} failed audit. Retrying with boosts:`, boosts);
        continue;
      }

      console.log(`Attempt ${attempt} passed audit. Returning results.`);
      return new Response(
        JSON.stringify({ ...bot, audited: true }),
        // --- MODIFIED: Include CORS headers in the main response ---
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    console.warn("Auditor was dissatisfied after 3 tries.");
    return new Response(
      JSON.stringify({ error: "Auditor was never satisfied." }),
      // --- MODIFIED: Include CORS headers in the error response ---
      { status: 422, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Chat session error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      // --- MODIFIED: Include CORS headers in the error response ---
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});