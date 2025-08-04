// supabase/functions/get-recommendations/index.ts

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const openKey = Deno.env.get("OPENAI_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

async function embed(text: string) {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openKey}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text })
  });
  if (!r.ok) {
    const errorBody = await r.json();
    throw new Error(`OpenAI API Error: ${errorBody.error?.message}`);
  }
  const j = await r.json();
  return j.data[0].embedding as number[];
}

async function logQuery(q: string) {
  sb.from("query_log").insert({ user_query: q }).then(() => {}).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { message, filters = {}, limit = 10 } = await req.json();
    if (!message) throw new Error("`message` is required");
    await logQuery(message);

    let embeddingText = message;
    if (filters.genres || filters.actor) {
        const genreText = filters.genres ? `movies in the genres: ${filters.genres.join(', ')}` : '';
        const actorText = filters.actor ? `movies starring actor: ${filters.actor}` : '';
        embeddingText = [genreText, actorText].filter(Boolean).join('. ');
    }

    const vec = await embed(embeddingText);

    // --- THIS IS THE FIX ---
    // We are now calling the new, unambiguous function 'v2_match_media'.
    let { data: recs, error } = await sb.rpc("v2_match_media", {
      in_user_vector: vec,
      in_genres: filters.genres ?? null,
      in_max_runtime: filters.max_runtime ?? null,
      in_year_min: filters.release_year_min ?? null,
      in_year_max: filters.release_year_max ?? null,
      match_count: limit
    });
    // --- END OF FIX ---

    if (error) {
      console.error("Database error:", error.message);
      throw error;
    }
    
    if ((!recs || recs.length === 0) && filters.actor && filters.genres) {
      console.log(`[Fallback] Retrying with genre only.`);
      const { data: fallbackRecs } = await sb.rpc("v2_match_media", {
        in_user_vector: vec, in_genres: filters.genres, in_max_runtime: null,
        in_year_min: null, in_year_max: null, match_count: limit
      });
      recs = fallbackRecs;
    }

    return new Response(JSON.stringify({ recommendations: recs ?? [] }), {
      headers: { ...CORS, "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Function error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" }
    });
  }
});