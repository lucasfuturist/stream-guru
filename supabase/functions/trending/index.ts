// supabase/functions/trending/index.ts

import { createClient } from "@supabase/supabase-js";

// --- Environment Variables ---
const SB_URL = Deno.env.get("SB_URL")!;
const SB_SERVICE_ROLE = Deno.env.get("SB_SERVICE_ROLE")!;

// --- Supabase Client ---
const supabase = createClient(SB_URL, SB_SERVICE_ROLE);

// --- CORS Headers ---
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // Fetch the top 12 most popular items from the media table
    const { data, error } = await supabase
      .from("media")
      .select("tmdb_id, media_type, title, poster_path") // Only select what the card needs
      .order("popularity", { ascending: false })
      .limit(12);

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ trending: data ?? [] }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("[trending_function_error]", err);
    return new Response(JSON.stringify({ error: "Failed to fetch trending media." }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      status: 500,
    });
  }
});