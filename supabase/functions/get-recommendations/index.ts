// supabase/functions/get-recommendations/index.ts

import { createClient } from "@supabase/supabase-js";

const SB_URL = Deno.env.get("SB_URL")!;
const SB_SERVICE_ROLE = Deno.env.get("SB_SERVICE_ROLE")!;
const OPENAI_KEY = Deno.env.get("OPENAI_KEY")!; // Still need this for embeddings

const supabase = createClient(SB_URL, SB_SERVICE_ROLE);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8191) }),
  });
  if (!res.ok) throw new Error(`OpenAI embedding failed: ${await res.text()}`);
  const { data } = await res.json();
  return data[0].embedding;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { message, filters } = await req.json();
    if (!message || !filters) throw new Error("message and filters are required");

    const vector = await getEmbedding(message);

    const { data, error } = await supabase.rpc("match_media", {
      in_query_embedding: vector,
      in_genres: filters.genres ?? null,
      in_max_runtime: filters.max_runtime ?? null,
      in_limit: 4,
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({ recommendations: data ?? [] }),
      { headers: { "Content-Type": "application/json", ...CORS } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json", ...CORS } });
  }
});