// supabase/functions/search-media/index.ts

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { query } = await req.json();
    if (!query) throw new Error("A 'query' is required.");

    // Call the new, simple database function
    const { data, error } = await sb.rpc("search_media_by_keyword", {
      keyword: query,
    });

    if (error) {
      console.error("Database error:", error);
      throw error;
    }

    return new Response(JSON.stringify({ results: data ?? [] }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});