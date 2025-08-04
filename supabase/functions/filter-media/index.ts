// supabase/functions/filter-media/index.ts
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
    const { filters } = await req.json();
    if (!filters) throw new Error("A 'filters' object is required.");

    console.log("Received filters:", filters);

    // Call the new database function with the structured filters
    const { data, error } = await sb.rpc("filter_media", {
      in_genre: filters.genre,
      in_actor_name: filters.actor_name,
      in_max_runtime: filters.max_runtime
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