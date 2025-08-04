// supabase/functions/get-details/index.ts

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
    const { tmdb_id } = await req.json();
    if (!tmdb_id) {
      throw new Error("tmdb_id is required.");
    }

    const numericId = parseInt(String(tmdb_id), 10);

    if (isNaN(numericId)) {
        throw new Error("Invalid tmdb_id format. Must be a number.");
    }

    const { data, error } = await supabase
      .from("media")
      .select("*")
      .eq("tmdb_id", numericId) 
      .single();

    if (error) {
        console.error(`Supabase query failed for tmdb_id ${numericId}:`, error);
        throw new Error(`No media found with TMDb ID ${numericId}.`);
    }

    return new Response(JSON.stringify({ details: data }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      status: 400,
    });
  }
});