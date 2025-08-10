// Re-fetch certifications/ratings for existing rows and set nsfw_flag deterministically.
import { createClient } from "@supabase/supabase-js";
import { pickMovieCertification, pickTvRating } from "../_shared/tmdb-selectors.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const TMDB = "https://api.themoviedb.org/3";
const H = () => {
  const t = Deno.env.get("TMDB_V4_TOKEN");
  if (!t) throw new Error("TMDB_V4_TOKEN not set");
  return { Authorization: `Bearer ${t}`, accept: "application/json" };
};

function deriveNSFW(media_type: "movie"|"tv", adult: boolean|undefined, cert_country?: string|null, cert_rating?: string|null) {
  const hardMovie = new Set(["NC-17","X"]);
  const hardTv = new Set(["TV-MA"]);
  if (media_type === "movie") {
    if (adult) return { flag: true, level: "hard" as const };
    if (cert_country === "US" && cert_rating && hardMovie.has(cert_rating)) return { flag: true, level: "hard" as const };
    return { flag: false, level: "none" as const };
  } else {
    if (cert_country === "US" && cert_rating && hardTv.has(cert_rating)) return { flag: true, level: "soft" as const };
    return { flag: false, level: "none" as const };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { limit = 200 } = await req.json().catch(() => ({}));

    // grab items missing cert_rating or nsfw_flag is null
    const { data: rows, error } = await sb
      .from("media")
      .select("tmdb_id, media_type, adult")
      .or("cert_rating.is.null,nsfw_flag.is.null")
      .limit(Math.min(1000, limit));

    if (error) throw error;
    if (!rows?.length) return new Response(JSON.stringify({ processed: 0 }), { headers: { ...CORS, "Content-Type": "application/json" } });

    let ok = 0, fail = 0;
    for (const r of rows) {
      try {
        if (r.media_type === "movie") {
          const rel = await fetch(`${TMDB}/movie/${r.tmdb_id}/release_dates`, { headers: H() }).then(x => x.json());
          const picked = pickMovieCertification(rel);
          const nsfw = deriveNSFW("movie", !!r.adult, picked?.country ?? null, picked?.rating ?? null);
          const { error: uerr } = await sb.from("media").update({
            ratings_payload: rel ?? null,
            cert_country: picked?.country ?? null,
            cert_rating: picked?.rating ?? null,
            cert_source: picked?.source ?? null,
            nsfw_flag: nsfw.flag,
            nsfw_level: nsfw.level,
            updated_from_tmdb_at: new Date().toISOString()
          }).eq("tmdb_id", r.tmdb_id);
          if (uerr) throw uerr;
        } else {
          const cont = await fetch(`${TMDB}/tv/${r.tmdb_id}/content_ratings`, { headers: H() }).then(x => x.json());
          const picked = pickTvRating(cont);
          const nsfw = deriveNSFW("tv", false, picked?.country ?? null, picked?.rating ?? null);
          const { error: uerr } = await sb.from("media").update({
            ratings_payload: cont ?? null,
            cert_country: picked?.country ?? null,
            cert_rating: picked?.rating ?? null,
            cert_source: picked?.source ?? null,
            nsfw_flag: nsfw.flag,
            nsfw_level: nsfw.level,
            updated_from_tmdb_at: new Date().toISOString()
          }).eq("tmdb_id", r.tmdb_id);
          if (uerr) throw uerr;
        }
        ok++;
      } catch (e) {
        console.error("backfill error", r.tmdb_id, e);
        fail++;
      }
    }

    return new Response(JSON.stringify({ processed: rows.length, ok, fail }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
