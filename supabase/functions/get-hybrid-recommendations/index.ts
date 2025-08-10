// supabase/functions/get-hybrid-recommendations/index.ts

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

// --- PROMPT DEFINITIONS (Moved from get-ai-response) ---
const parserPrompt = `
You are a master query parser. Your sole mission is to deconstruct a user's natural language request into a precise JSON object that will be used to query a movie and TV show database.
Your output MUST be a single, raw JSON object. If a constraint is not mentioned, omit the key.
For "Soft Constraints," generate a concise 'theme_analysis' string.
--- TARGET SCHEMA ---
{
  "media_type": "movie" | "tv", "genres": ["..."], "not_genres": ["..."],
  "actor_name": "...", "not_actor_name": "...", "director_name": "...", "not_director_name": "...",
  "release_year_min": YYYY, "release_year_max": YYYY, "max_runtime": Minutes,
  "spoken_language": "...", "theme_analysis": "concise summary of abstract request"
}
--- END SCHEMA ---`;

const chatPrompt = `
You are StreamGuru, a witty movie expert. Write a short, engaging intro for the recommendations based on the user's prompt.
RULES: 1-3 sentences. Charismatic tone. DO NOT mention specific movie titles. DO NOT output JSON.`;

// --- HELPER: Create Embedding ---
async function createEmbedding(text: string): Promise<number[]> {
  const resp = await ai.embeddings.create({ model: "text-embedding-3-small", input: text });
  return resp.data[0].embedding;
}

// --- CONSOLIDATED ORCHESTRATOR LOGIC ---
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { history } = await req.json();
    if (!history || !Array.isArray(history) || history.length === 0) {
      throw new Error("A non-empty 'history' array is required.");
    }

    const lastUserPrompt = history[history.length - 1].content;

    // STEP 1: Perform AI calls in parallel to get filters and prose
    const [parserResponse, chatResponse] = await Promise.all([
      ai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: parserPrompt }, ...history],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
      ai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: chatPrompt }, { role: "user", content: lastUserPrompt }],
        temperature: 0.8,
      })
    ]);

    const filters = JSON.parse(parserResponse.choices[0].message.content!);
    const ai_message = chatResponse.choices[0].message.content!;

    // STEP 2: Create vector embedding from the semantic text
    const semanticSearchText = `${lastUserPrompt} ${filters.theme_analysis || ''}`.trim();
    const embedding = await createEmbedding(semanticSearchText);

    // STEP 3: Call the hybrid search database function
    const { data: recommendations, error: rpcError } = await sb.rpc("hybrid_search", {
      in_media_type: filters.media_type,
      in_genres: filters.genres,
      in_not_genres: filters.not_genres,
      in_actor_name: filters.actor_name,
      in_not_actor_name: filters.not_actor_name,
      in_director_name: filters.director_name,
      in_not_director_name: filters.not_director_name,
      in_release_year_min: filters.release_year_min,
      in_release_year_max: filters.release_year_max,
      in_max_runtime: filters.max_runtime,
      in_spoken_language: filters.spoken_language,
      in_user_vector: embedding,
    });

    if (rpcError) {
      console.error("Hybrid Search RPC Error:", rpcError);
      throw new Error(`Database search failed: ${rpcError.message}`);
    }

    // STEP 4: Return the complete package to the frontend
    return new Response(
      JSON.stringify({ prose: ai_message, recs: recommendations || [] }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    // This will now catch errors from any step (AI, embedding, DB)
    console.error("Consolidated Orchestrator Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});