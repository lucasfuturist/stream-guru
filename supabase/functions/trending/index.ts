// supabase/functions/trending/index.ts

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { data, error } = await supabase
      .from("media")
      .select("tmdb_id, media_type, title, poster_path")
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