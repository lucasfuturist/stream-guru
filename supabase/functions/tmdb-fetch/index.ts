// Fetch a single movie or TV and upsert it into media (max data via append_to_response).
import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";
import { pickMovieCertification, pickTvRating, mapTopCast } from "../_shared/tmdb-selectors.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const TMDB = "https://api.themoviedb.org/3";
const APPEND_MOVIE = [
  "videos","images","credits","external_ids","release_dates",
  "watch/providers","keywords","recommendations","similar","translations","reviews"
].join(",");
const APPEND_TV = [
  "videos","images","aggregate_credits","external_ids","content_ratings",
  "watch/providers","keywords","recommendations","similar","translations","reviews"
].join(",");

function headers() {
  const token = Deno.env.get("TMDB_V4_TOKEN");
  if (!token) throw new Error("TMDB_V4_TOKEN is not set");
  return { Authorization: `Bearer ${token}`, accept: "application/json" };
}

function deriveNSFW(media_type: "movie"|"tv", adult: boolean|undefined, cert_country?: string|null, cert_rating?: string|null) {
  const hardMovie = new Set(["NC-17","X"]);
  const hardTv = new Set(["TV-MA"]); // tune to your taste
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

    const { type, id, language = "en-US", region = "US" } = await req.json();
    if (!type || !id) throw new Error("Body must include { type: 'movie'|'tv', id: number }");

    const h = headers();
    if (type === "movie") {
      const url = `${TMDB}/movie/${id}?append_to_response=${APPEND_MOVIE}&language=${language}`;
      const details = await fetch(url, { headers: h }).then(r => r.json());
      const certPayload = await details?.release_dates;
      const picked = pickMovieCertification(certPayload);
      const { top_cast, director } = mapTopCast(details?.credits);

      const { flag, level } = deriveNSFW("movie", !!details.adult, picked?.country ?? null, picked?.rating ?? null);

      const upsert = {
        tmdb_id: details.id,
        media_type: "movie",
        title: details.title,
        original_title: details.original_title,
        original_language: details.original_language,
        status: details.status,
        release_date: details.release_date ? dayjs(details.release_date).format("YYYY-MM-DD") : null,
        runtime: details.runtime ?? null,
        genres: (details.genres ?? []).map((g: any) => g.name),
        production_companies: details.production_companies ?? null,
        production_countries: details.production_countries ?? null,
        spoken_languages: (details.spoken_languages ?? []).map((l: any) => l.english_name ?? l.name),
        belongs_to_collection: details.belongs_to_collection ?? null,
        homepage: details.homepage ?? null,
        imdb_id: details.imdb_id ?? null,
        vote_average: details.vote_average ?? null,
        vote_count: details.vote_count ?? null,
        poster_path: details.poster_path ?? null,
        backdrop_path: details.backdrop_path ?? null,
        logo_path: (details.images?.logos?.[0]?.file_path ?? null),
        popularity: details.popularity ?? null,
        overview: details.overview ?? null,
        tagline: details.tagline ?? null,
        top_cast, director,
        videos: details.videos ?? null,
        images: details.images ?? null,
        external_ids: details.external_ids ?? null,
        keywords: details.keywords ?? null,
        recommendations: details.recommendations ?? null,
        similar: details.similar ?? null,
        translations: details.translations ?? null,
        reviews: details.reviews ?? null,
        watch_providers: details["watch/providers"] ?? null,
        ratings_payload: certPayload ?? null,
        cert_country: picked?.country ?? null,
        cert_rating: picked?.rating ?? null,
        cert_source: picked?.source ?? null,
        adult: !!details.adult,
        nsfw_flag: flag,
        nsfw_level: level,
        updated_from_tmdb_at: new Date().toISOString()
      };

      const { error } = await sb.from("media").upsert(upsert, { onConflict: "tmdb_id" });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, upsert }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    if (type === "tv") {
      const url = `${TMDB}/tv/${id}?append_to_response=${APPEND_TV}&language=${language}`;
      const details = await fetch(url, { headers: h }).then(r => r.json());
      const ratingPayload = await details?.content_ratings;
      const picked = pickTvRating(ratingPayload);
      // aggregate_credits: cast is nested differently than movie credits
      const agg = details?.aggregate_credits;
      const cast = (agg?.cast ?? []).slice(0, 10).map((p: any) => ({
        name: p.name, character: p?.roles?.[0]?.character ?? null, profile_path: p.profile_path
      }));
      const director = (agg?.crew ?? []).find((c: any) => c.jobs?.some((j: any) => j.job === "Director"))?.name ?? null;

      const { flag, level } = deriveNSFW("tv", false, picked?.country ?? null, picked?.rating ?? null);

      const upsert = {
        tmdb_id: details.id,
        media_type: "tv",
        title: details.name,
        original_title: details.original_name,
        original_language: details.original_language,
        status: details.status,
        first_air_date: details.first_air_date ? dayjs(details.first_air_date).format("YYYY-MM-DD") : null,
        last_air_date: details.last_air_date ? dayjs(details.last_air_date).format("YYYY-MM-DD") : null,
        in_production: details.in_production ?? null,
        type: details.type ?? null,
        episode_run_time: details.episode_run_time ?? null,
        number_of_seasons: details.number_of_seasons ?? null,
        number_of_episodes: details.number_of_episodes ?? null,
        origin_country: details.origin_country ?? null,
        genres: (details.genres ?? []).map((g: any) => g.name),
        production_companies: details.production_companies ?? null,
        production_countries: details.production_countries ?? null,
        spoken_languages: (details.spoken_languages ?? []).map((l: any) => l.english_name ?? l.name),
        homepage: details.homepage ?? null,
        vote_average: details.vote_average ?? null,
        vote_count: details.vote_count ?? null,
        poster_path: details.poster_path ?? null,
        backdrop_path: details.backdrop_path ?? null,
        logo_path: (details.images?.logos?.[0]?.file_path ?? null),
        popularity: details.popularity ?? null,
        overview: details.overview ?? null,
        tagline: details.tagline ?? null,
        top_cast: cast,
        director,
        videos: details.videos ?? null,
        images: details.images ?? null,
        external_ids: details.external_ids ?? null,
        keywords: details.keywords ?? null,
        recommendations: details.recommendations ?? null,
        similar: details.similar ?? null,
        translations: details.translations ?? null,
        reviews: details.reviews ?? null,
        watch_providers: details["watch/providers"] ?? null,
        ratings_payload: ratingPayload ?? null,
        cert_country: picked?.country ?? null,
        cert_rating: picked?.rating ?? null,
        cert_source: picked?.source ?? null,
        adult: false,
        nsfw_flag: flag,
        nsfw_level: level,
        updated_from_tmdb_at: new Date().toISOString()
      };

      const { error } = await sb.from("media").upsert(upsert, { onConflict: "tmdb_id" });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, upsert }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    throw new Error("type must be 'movie' or 'tv'");
  } catch (err: any) {
    console.error("[tmdb-fetch]", err);
    return new Response(JSON.stringify({ error: String(err.message || err) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
