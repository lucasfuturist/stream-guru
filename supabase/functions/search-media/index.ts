// deno run --allow-net --allow-env
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { query = "", page = 1, page_size = 21, adult_mode = false } =
      await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!, // RPC is granted to anon; no service key needed
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data, error } = await supabase.rpc("search_media", {
      in_query: String(query),
      page_number: Number(page),
      page_size: Number(page_size),
      adult_mode: Boolean(adult_mode),
    });
    if (error) throw error;

    return new Response(JSON.stringify({ results: data ?? [] }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message ?? "search failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
