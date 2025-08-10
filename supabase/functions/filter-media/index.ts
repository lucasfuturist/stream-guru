import { createClient } from "jsr:@supabase/supabase-js@^2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAGE_SIZE = 21; // Define a consistent page size

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // Create Supabase client with the request's Authorization header to respect RLS policies
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! }
        }
      }
    );

    // Destructure page from the request, default to 1 if not provided
    const { filters, page = 1 } = await req.json();
    if (!filters) throw new Error("A 'filters' object is required.");

    // Call the database function with pagination parameters
    const { data, error } = await supabaseClient.rpc("filter_media", {
      in_genre: filters.genre,
      in_actor_name: filters.actor_name,
      in_max_runtime: filters.max_runtime,
      page_number: page,
      page_size: PAGE_SIZE,
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