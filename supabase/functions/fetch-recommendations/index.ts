// Deno Edge Function
import { createClient } from "jsr:@supabase/supabase-js@^2";
import OpenAI from "npm:openai";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ai = new OpenAI({ apiKey: Deno.env.get("OPENAI_KEY")! });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAGE_SIZE = 21;

async function embed(text: string): Promise<number[]> {
  const resp = await ai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return resp.data[0].embedding;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { filters, lastUserPrompt = "", page = 1 } = await req.json();
    if (!filters) throw new Error("'filters' is required.");

    const adultMode = !!filters.adult_mode;
    const isConversational = Object.keys(filters).length === 0;
    const isThematic = !!filters.theme_analysis;

    const offset = (page - 1) * PAGE_SIZE;

    // A) Conversational -> Trending
    if (isConversational) {
      let q = sb.from("media").select("*");
      if (!adultMode) q = q.not("nsfw_flag", "is", true);
      const { data, error } = await q
        .order("popularity", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;

      return new Response(JSON.stringify({ recs: (data ?? []).map(d => ({ ...d, score: 0 })) }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // B) Thematic -> Hybrid search with embedding
    if (isThematic) {
      const semantic = `${lastUserPrompt} ${filters.theme_analysis}`.trim();
      const vector = await embed(semantic);

      const { data, error } = await sb.rpc("hybrid_search", {
        in_media_type:        filters.media_type ?? null,
        in_genres:            filters.genres ?? null,
        in_not_genres:        filters.not_genres ?? null,
        in_actor_name:        filters.actor_name ?? null,
        in_not_actor_name:    filters.not_actor_name ?? null,
        in_director_name:     filters.director_name ?? null,
        in_not_director_name: filters.not_director_name ?? null,
        in_release_year_min:  filters.release_year_min ?? null,
        in_release_year_max:  filters.release_year_max ?? null,
        in_max_runtime:       filters.max_runtime ?? null,
        in_spoken_language:   filters.spoken_language ?? null,
        in_user_vector:       vector,
        in_page_number:       page,
        in_page_size:         PAGE_SIZE,
        in_exclude_nsfw:      !adultMode,
      });
      if (error) throw error;

      return new Response(JSON.stringify({ recs: data ?? [] }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // C) Specific filters -> Filtered popularity
    let q = sb.from("media").select("*");
    if (filters.media_type)         q = q.eq("media_type", filters.media_type);
    if (filters.genres)             q = q.contains("genres", filters.genres);
    if (filters.not_genres)         q = q.not("genres", "cs", `{${filters.not_genres.join(",")}}`);
    if (filters.release_year_min)   q = q.gte("release_date", `${filters.release_year_min}-01-01`);
    if (filters.release_year_max)   q = q.lte("release_date", `${filters.release_year_max}-12-31`);
    if (filters.actor_name)         q = q.ilike("top_cast", `%${filters.actor_name}%`);
    if (!adultMode)                 q = q.not("nsfw_flag", "is", true);

    const { data, error } = await q
      .order("popularity", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;

    return new Response(JSON.stringify({ recs: (data ?? []).map(d => ({ ...d, score: 0 })) }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[fetch-recommendations]", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
