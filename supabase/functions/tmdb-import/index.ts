// supabase/functions/tmdb-import/index.ts
// Upserts TMDB details into public.media and stamps updated_from_tmdb_at.
// Body: { items:[{type:"movie"|"tv", id:number}], concurrency?: number }

import { createClient } from "jsr:@supabase/supabase-js@^2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,                              // injected by Supabase
  Deno.env.get("SB_SERVICE_ROLE_KEY")
    ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    ?? (() => { throw new Error("Missing SB_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE_KEY"); })()
);

const TMDB_BASE = "https://api.themoviedb.org/3";

// Prefer v4 bearer, fall back to v3 api_key
const V4 =
  Deno.env.get("TMDB_V4_API_KEY") ??
  Deno.env.get("TMDB_V4_TOKEN") ?? null;

const V3 =
  Deno.env.get("TMDB_V3_API_KEY") ??
  Deno.env.get("TMDB_API_KEY") ?? null;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Item = { type: "movie" | "tv"; id: number };

async function tmdb(path: string) {
  if (V4) {
    const r = await fetch(`${TMDB_BASE}${path}`, {
      headers: { Authorization: `Bearer ${V4}` },
    });
    if (!r.ok) throw new Error(`TMDB V4 ${r.status}: ${await r.text()}`);
    return r.json();
  }
  if (V3) {
    const sep = path.includes("?") ? "&" : "?";
    const r = await fetch(`${TMDB_BASE}${path}${sep}api_key=${encodeURIComponent(V3)}`);
    if (!r.ok) throw new Error(`TMDB V3 ${r.status}: ${await r.text()}`);
    return r.json();
  }
  throw new Error("Missing TMDB_V4_API_KEY/TMDB_V4_TOKEN or TMDB_V3_API_KEY/TMDB_API_KEY.");
}

function normalize(type: "movie" | "tv", j: any) {
  const now = new Date().toISOString();

  // Ratings: movies use release_dates; TV uses content_ratings
  let cert_country: string | null = null;
  let cert_rating: string | null = null;
  let cert_source: string | null = null;

  if (type === "movie") {
    const usRel = j?.release_dates?.results?.find((r: any) => r.iso_3166_1 === "US");
    const usCert = usRel?.release_dates?.[0]?.certification ?? null;
    if (usCert) {
      cert_country = "US";
      cert_rating  = usCert;
      cert_source  = "tmdb";
    }
  } else {
    const usTV = j?.content_ratings?.results?.find((r: any) => r.iso_3166_1 === "US");
    const usTVCert = usTV?.rating ?? null;
    if (usTVCert) {
      cert_country = "US";
      cert_rating  = usTVCert;
      cert_source  = "tmdb";
    }
  }

  return {
    tmdb_id: j.id,
    media_type: type,

    // Titles & language
    title: j.title ?? j.name ?? null,
    original_title: j.original_title ?? j.original_name ?? null,
    original_language: j.original_language ?? null,

    // Synopsis / meta (synopsis is NOT NULL in your schema)
    synopsis: j.overview ?? "",           // <-- ensures non-null
    overview: j.overview ?? null,
    tagline: j.tagline ?? null,
    status: j.status ?? null,
    homepage: j.homepage ?? null,
    imdb_id: j.imdb_id ?? null,

    // Dates & counts
    release_date: j.release_date ?? j.first_air_date ?? null,
    first_air_date: j.first_air_date ?? null,
    last_air_date: j.last_air_date ?? null,
    in_production: j.in_production ?? null,
    type: j.type ?? null,
    number_of_seasons: j.number_of_seasons ?? null,
    number_of_episodes: j.number_of_episodes ?? null,

    // Runtimes
    runtime: j.runtime ?? null,
    episode_run_time: j.episode_run_time ?? null,

    // Arrays / JSON
    origin_country: j.origin_country ?? null,
    genres: (j.genres ?? []).map((g: any) => g?.name).filter(Boolean),
    spoken_languages: (j.spoken_languages ?? [])
      .map((l: any) => l?.english_name ?? l?.name)
      .filter(Boolean),
    production_companies: j.production_companies ?? null,
    production_countries: j.production_countries ?? null,
    belongs_to_collection: j.belongs_to_collection ?? null,

    // Popularity / voting
    popularity: j.popularity ?? null,
    vote_average: j.vote_average ?? null,
    vote_count: j.vote_count ?? null,

    // Art
    poster_path: j.poster_path ?? null,
    backdrop_path: j.backdrop_path ?? null,
    logo_path: j.networks?.[0]?.logo_path ?? j.logo_path ?? null,

    // Extras
    videos: j.videos ?? null,
    images: j.images ?? null,
    external_ids: j.external_ids ?? null,
    keywords: j.keywords?.keywords ?? j.keywords?.results ?? null,
    watch_providers: j["watch/providers"] ?? null,

    // Ratings
    cert_country,
    cert_rating,
    cert_source,

    // Adult / NSFW
    adult: j.adult ?? false,
    nsfw_flag: !!j.adult,            // always true/false; never null
    nsfw_level: j.adult ? "soft" : "none",  // optional, if you use it
    // Audit
    updated_from_tmdb_at: now,
  };
}

async function pullOne(it: Item) {
  const append = "videos,images,external_ids,keywords,release_dates,content_ratings,watch/providers";
  const url = `/${it.type}/${it.id}?append_to_response=${encodeURIComponent(append)}&language=en-US`;
  const j = await tmdb(url);
  const row = normalize(it.type, j);

  const { error } = await sb.from("media").upsert(row, { onConflict: "tmdb_id" });
  if (error) throw new Error(JSON.stringify(error));
  return { id: it.id, ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const { items = [], concurrency = 4 } = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ imported: 0, failed: 0, results: [] }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const queue: Item[] = [...items];
    const results: Array<{ id: number; ok: boolean; error?: string }> = [];
    const workers = Math.max(1, Math.min(concurrency, 8));

    const run = async () => {
      while (queue.length) {
        const it = queue.shift()!;
        try {
          results.push(await pullOne(it));
        } catch (e) {
          const msg = e instanceof Error ? e.message : JSON.stringify(e);
          results.push({ id: it.id, ok: false, error: msg });
          console.error("[tmdb-import] item failed", it, msg);
        }
      }
    };

    await Promise.all(Array.from({ length: workers }, run));

    const imported = results.filter(r => r.ok).length;
    const failed = results.length - imported;

    return new Response(
      JSON.stringify({ imported, failed, results }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[tmdb-import] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
