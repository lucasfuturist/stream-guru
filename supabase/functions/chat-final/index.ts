// supabase/functions/chat-final/index.ts

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// --- CLIENTS ---
const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const ai = new OpenAI({ apiKey: Deno.env.get("OPENAI_KEY")! });

// --- CORS HEADERS ---
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- HELPER: Embedding ---
async function embed(text: string): Promise<number[]> {
  const resp = await ai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return resp.data[0].embedding;
}

// --- LOGIC FROM "chatbot" FUNCTION ---
async function getRecommendationsAndProse(prompt: string, boosts: string[] = []) {
  const embeddingText = [prompt, ...boosts].join(" ");
  const vec = await embed(embeddingText);

  const { data: recs, error } = await sb.rpc("final_match_media", {
    in_user_vector: vec,
    in_media_type: null, in_genres: null, in_actor_name: null,
    in_max_runtime: null, in_year_min: null, in_year_max: null,
    match_count: 10
  });

  if (error) {
    console.error("Chatbot DB error:", error.message);
    throw new Error(`Failed to match media: ${error.message}`);
  }

  const chat = await ai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are StreamGuru. You are informal, witty, and passionate about movies. Briefly introduce the recommendations based on the user's prompt. DO NOT mention specific movie titles." },
      { role: "user", content: prompt }
    ]
  });

  return {
    prose: chat.choices[0].message.content,
    recs: recs || []
  };
}

// --- LOGIC FROM "auditor" FUNCTION ---
const auditorSystemPrompt = `
You are a Quality Assurance bot. Your job is to analyze a user's query and the movie recommendations.
- If the query is specific and the recommendations are relevant, the response is GOOD ("ok": true).
- If the query is a vague vibe (e.g., "hi", "I'm sad"), the response is NOT OK. Invent 1-3 specific, creative "vibe tags".
- If the recommendations list is EMPTY for a specific query, the response is NOT OK. Invent vibe tags to broaden the search.
You MUST reply with JSON only: { "ok": boolean, "vibes": [{ "tag": "your tag" }] }
`;

async function auditResponse(userQuery: string, recommendations: any[]) {
  const audit = await ai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: auditorSystemPrompt },
      { role: "user", content: JSON.stringify({ query: userQuery, recs: recommendations }) }
    ],
    response_format: { type: "json_object" }
  });
  return JSON.parse(audit.choices[0].message.content!);
}

// --- MAIN ORCHESTRATOR LOGIC from "chat-session" ---
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { prompt } = await req.json();
    if (!prompt) throw new Error("Missing 'prompt' in request body");
    let boosts: string[] = [];

    for (let attempt = 1; attempt <= 3; attempt++) {
      const botResponse = await getRecommendationsAndProse(prompt, boosts);
      const audit = await auditResponse(prompt, botResponse.recs);

      if (!audit.ok && audit.vibes?.length) {
        boosts = audit.vibes.map((v: any) => v.tag);
        console.log(`Attempt ${attempt} failed audit. Retrying with boosts:`, boosts);
        if (attempt < 3) continue;
      }
      
      return new Response(
        JSON.stringify(botResponse),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: "Auditor was never satisfied after 3 attempts." }),
      { status: 422, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Chat-final function error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});