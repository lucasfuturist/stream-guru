// supabase/functions/trending/index.ts
// Proxies to RPC get_trending (keyset). Maintains legacy input/output shape.
//
// Request body (legacy):
//   { page?: number, page_size?: number, adult_mode?: boolean }
// New (preferred):
//   { last_popularity?: number|null, last_tmdb_id?: number|null, page_size?: number }
//
// Response (legacy-compatible):
//   { results: Array<{ tmdb_id, title, poster_path, media_type }> }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Media = {
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  media_type: "movie" | "tv" | string;
  backdrop_path?: string | null;
  release_date?: string | null;
  popularity?: number | null;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { "X-Client-Info": "edge-fn-trending/1.0" } },
});

function cors(resp: Response) {
  const h = new Headers(resp.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return new Response(resp.body, { status: resp.status, headers: h });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return cors(new Response(null, { status: 204 }));
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      // legacy
      page?: number;
      page_size?: number;
      adult_mode?: boolean;
      // keyset
      last_popularity?: number | null;
      last_tmdb_id?: number | null;
    };

    const pageSize = Math.max(1, Math.min(100, body.page_size ?? 21));

    // Preferred path: keyset params provided
    let lastPopularity = body.last_popularity ?? null;
    let lastTmdbId = body.last_tmdb_id ?? null;

    // Legacy compatibility: if page>1 and no cursor, walk forward page-1 times
    const page = Math.max(1, Math.floor(body.page ?? 1));
    if (page > 1 && lastPopularity == null && lastTmdbId == null) {
      // Walk pages cheaply via keyset
      for (let i = 1; i < page; i++) {
        const { data, error } = await sb.rpc("get_trending", {
          page_size: pageSize,
          last_popularity: lastPopularity,
          last_tmdb_id: lastTmdbId,
        });
        if (error) {
          return cors(
            new Response(JSON.stringify({ error: "rpc", details: error.message }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        const rows = (data ?? []) as Media[];
        if (rows.length === 0) break;
        const last = rows[rows.length - 1] as any;
        lastPopularity = last.popularity ?? null;
        lastTmdbId = last.tmdb_id ?? null;
      }
    }

    const { data, error } = await sb.rpc("get_trending", {
      page_size: pageSize,
      last_popularity: lastPopularity,
      last_tmdb_id: lastTmdbId,
    });
    if (error) {
      return cors(
        new Response(JSON.stringify({ error: "rpc", details: error.message }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    const results = (data ?? []).map((m: any) => ({
      tmdb_id: m.tmdb_id,
      title: m.title,
      poster_path: m.poster_path,
      media_type: m.media_type,
      // keep extra fields available if your UI wants them later
      backdrop_path: m.backdrop_path ?? null,
      release_date: m.release_date ?? null,
      popularity: m.popularity ?? null,
    })) as Media[];

    return cors(
      new Response(JSON.stringify({ results }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
  } catch (e) {
    return cors(
      new Response(JSON.stringify({ error: "unexpected", details: String(e?.message ?? e) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }
});
