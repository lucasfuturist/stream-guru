// supabase/functions/search-suggestions/index.ts

// --- FIX: Use the import alias defined in deno.json ---
import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to create a standardized JSON response
function jsonResponse(data: object, status: number = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    status,
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // Check for required environment variables for security
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      console.error("Critical: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in function environment.");
      return jsonResponse({ error: "Server configuration error." }, 500);
    }
    
    const supabaseClient = createClient(supabaseUrl, serviceKey);
    
    const {
      query,
      genre,
      actor_name,
      max_runtime,
      page,
      page_size
    } = await req.json();
    
    const searchTerm = query || '';

    const rpcParams = {
      search_term: searchTerm,
      in_genre: genre || null,
      in_actor_name: actor_name || null,
      in_max_runtime: max_runtime || null,
      page_number: page || 1,
      page_size: page_size || 21
    };

    // Call the master_search function
    const { data, error } = await supabaseClient.rpc("master_search", rpcParams);

    // --- FIX: Handle the error gracefully instead of throwing ---
    if (error) {
      console.error("Database RPC error:", error);
      // Return a 500 status with the specific database error message
      return jsonResponse({ error: `Database error: ${error.message}` }, 500);
    }

    // Success!
    return jsonResponse({ suggestions: data || [] });

  } catch (err) {
    // This catches other errors, like a malformed JSON request body
    console.error("Generic function error:", err);
    return jsonResponse({ error: err.message }, 500);
  }
});