// supabase/functions/chatbot/index.ts

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const ai = new OpenAI({ apiKey: Deno.env.get("OPENAI_KEY")! });

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function embed(text: string): Promise<number[]> {
  const resp = await ai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return resp.data[0].embedding;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { prompt, boosts = [] } = await req.json();

    const embeddingText = [prompt, ...boosts].join(" ");
    const vec = await embed(embeddingText);
    
    // --- THIS IS THE FIX ---
    // This function now calls the new, unambiguous 'final_match_media' function,
    // aligning it with the rest of our corrected application architecture.
    // We pass nulls for all filters because this simpler function does not use the AI parser.
    const { data: recs, error } = await sb.rpc("final_match_media", {
      in_user_vector: vec,
      in_media_type: null,
      in_genres: null,
      in_actor_name: null,
      in_max_runtime: null,
      in_year_min: null,
      in_year_max: null,
      match_count: 10
    });
    // --- END OF FIX ---

    if (error) {
      console.error("Chatbot DB error:", error.message);
      throw new Error(`Failed to match media: ${error.message}`);
    }
    
    // We only send the original prompt to the AI to prevent it from being too verbose.
    const chat = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are StreamGuru. You are informal, witty, and passionate about movies. Your job is to write a brief, fun, top-level introduction based on the user's request. DO NOT mention specific movie titles, as they will be displayed separately." 
        },
        { role: "user", content: prompt }
      ]
    });

    return new Response(
      JSON.stringify({
        prose: chat.choices[0].message.content,
        recs: recs || []
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});