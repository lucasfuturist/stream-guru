// supabase/functions/get-details/index.ts

import { createClient } from "@supabase/supabase-js";

const SB_URL = Deno.env.get("SB_URL")!;
const SB_SERVICE_ROLE = Deno.env.get("SB_SERVICE_ROLE")!;
const supabase = createClient(SB_URL, SB_SERVICE_ROLE);

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

    // --- ROBUSTNESS CHECK ---
    // Defensively parse the ID, as it might come in as a string from the client.
    const numericId = parseInt(String(tmdb_id), 10);

    if (isNaN(numericId)) {
        throw new Error("Invalid tmdb_id format. Must be a number.");
    }
    // --- END CHECK ---

    const { data, error } = await supabase
      .from("media")
      .select("*")
      .eq("tmdb_id", numericId) // Use the sanitized numericId
      .single();

    if (error) {
        // This will now give a more useful error if the ID doesn't exist
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