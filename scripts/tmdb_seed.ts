// scripts/tmdb_seed.ts

import { createClient } from "npm:@supabase/supabase-js@2";
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { genreMap } from "./utils/genre-map.ts";

const genreIdMap: Record<string, number> = {};
for (const [id, name] of Object.entries(genreMap)) {
  genreIdMap[name.toLowerCase()] = Number(id);
}
genreIdMap['sci-fi'] = 878;
genreIdMap['science fiction'] = 878;

let mode: 'popular' | 'genre' = 'popular';
let genreName: string | undefined;
let genreId: number | undefined;
let totalPagesToFetch: number;

const genreArgIndex = Deno.args.indexOf('--genre');
const pagesArgIndex = Deno.args.indexOf('--pages');

if (genreArgIndex > -1 && pagesArgIndex > -1) {
  mode = 'genre';
  genreName = Deno.args[genreArgIndex + 1];
  totalPagesToFetch = parseInt(Deno.args[pagesArgIndex + 1], 10);
  if (genreName) {
    genreId = genreIdMap[genreName.toLowerCase()];
    if (!genreId) { throw new Error(`Genre "${genreName}" not found.`); }
  } else {
    throw new Error("The --genre flag requires a genre name after it.");
  }
} else {
  mode = 'popular';
  const totalItemsArg = Deno.args[0];
  const targetValue = totalItemsArg ? parseInt(totalItemsArg, 10) : 2000;
  totalPagesToFetch = Math.ceil(targetValue / 40);
}

if (isNaN(totalPagesToFetch) || totalPagesToFetch <= 0) {
  throw new Error(`Invalid --pages argument. Expected a positive number.`);
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE')!);
const V3 = Deno.env.get('TMDB_V3_API_KEY');
if (!V3) throw new Error("TMDB_V3_API_KEY not found");
const TMDB_API = "https://api.themoviedb.org/3";

// --- ANTI-DUPLICATE CACHE ---
let existingTmdbIds = new Set<number>();

async function loadExistingIds() {
  console.log("Loading all existing TMDb IDs into cache...");
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const from = page * 1000;
    const to = from + 1000 - 1;
    const { data, error } = await supabase.from("media").select("tmdb_id").range(from, to);
    if (error) { console.error(`Failed to load IDs:`, error.message); hasMore = false; return; }
    if (data && data.length > 0) {
      data.forEach((item: { tmdb_id: number }) => existingTmdbIds.add(item.tmdb_id));
    }
    if (!data || data.length < 1000) { hasMore = false; }
    page++;
  }
  console.log(`✅ Cache loading complete. Found ${existingTmdbIds.size} existing items.`);
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string): Promise<any> {
  // ... (this function is fine)
    for (let i = 0; i < 3; i++) {
        try {
          const response = await fetch(url);
          if (response.ok) return response.json();
          if (response.status >= 400 && response.status < 500) { return null; }
          throw new Error(`Server error: ${response.status}`);
        } catch (error) {
          if (i === 2) { console.error(`Final attempt failed for ${url}. Error:`, error as Error); return null; }
          await delay(2000 * Math.pow(2, i));
        }
    }
    return null;
}

const url = (path: string, params?: Record<string, string>) => {
    const u = new URL(`${TMDB_API}${path}`);
    u.searchParams.set("api_key", V3);
    if (params) Object.entries(params).forEach(([key, value]) => u.searchParams.set(key, value));
    return u.toString();
};

async function getBaseConfig() { return fetchWithRetry(url("/configuration")); }
async function fetchDetails(kind: "movie" | "tv", id: number) { return fetchWithRetry(url(`/${kind}/${id}`, { append_to_response: "videos,credits,images,watch/providers" })); }

async function processPage(page: number, config: any) {
  console.log(`--- Processing Page ${page} of ${totalPagesToFetch} ---`);
  let moviesData: any, tvData: any;
  if (mode === 'genre' && genreId) {
    const params = { page: String(page), with_genres: String(genreId), sort_by: 'popularity.desc' };
    [moviesData, tvData] = await Promise.all([
      fetchWithRetry(url("/discover/movie", params)),
      fetchWithRetry(url("/discover/tv", params))
    ]);
  } else {
    const params = { page: String(page) };
    [moviesData, tvData] = await Promise.all([
      fetchWithRetry(url("/movie/popular", params)),
      fetchWithRetry(url("/tv/popular", params))
    ]);
  }

  if (!moviesData?.results || !tvData?.results) {
    console.warn(`Could not fetch list for page ${page}. Skipping.`);
    return 0;
  }

  const itemsToFetch = [
    ...moviesData.results.map((m: any) => ({ id: m.id, media_type: "movie" as const })),
    ...tvData.results.map((t: any) => ({ id: t.id, media_type: "tv" as const })),
  ];

  if (itemsToFetch.length === 0) return -1;

  // --- THIS IS THE KEY OPTIMIZATION ---
  const newItemsToFetch = itemsToFetch.filter(item => !existingTmdbIds.has(item.id));

  console.log(`   - Found ${itemsToFetch.length} items on page. After filtering, ${newItemsToFetch.length} are new.`);

  if (newItemsToFetch.length === 0) {
    // If there's nothing new, we don't need to do anything else for this page.
    return 0;
  }
  // --- END OF OPTIMIZATION ---

  console.log(`   - Fetching detailed info for the ${newItemsToFetch.length} new items...`);
  const detailedItems = [];
  // Now we loop over the MUCH smaller, pre-filtered list.
  for (const item of newItemsToFetch) {
    const details = await fetchDetails(item.media_type, item.id);
    if (details) detailedItems.push(details);
    await delay(50);
  }

  const rows = detailedItems.filter(Boolean).filter((d: any) => d.overview && d.poster_path && d.genres?.length > 0)
    .map((d: any) => {
        const isMovie = !!d.title;
        const officialTrailer = d.videos?.results?.find((v: any) => v.site === "YouTube" && v.type === "Trailer" && v.official);
        const director = d.credits?.crew?.find((c: any) => c.job === "Director");
        const logo = d.images?.logos?.find((l: any) => l.iso_639_1 === "en") || d.images?.logos?.[0];
        const topCast = d.credits?.cast?.slice(0, 10).map((actor: any) => ({ name: actor.name, character: actor.character, profile_path: actor.profile_path ? `${config.images.secure_base_url}w185${actor.profile_path}` : null }));
        return {
            tmdb_id: d.id, media_type: isMovie ? "movie" : "tv", title: d.title ?? d.name!, synopsis: d.overview, genres: d.genres.map((g: any) => g.name).filter(Boolean),
            poster_path: `${config.images.secure_base_url}w500${d.poster_path}`, release_date: d.release_date ?? d.first_air_date ?? null, popularity: d.popularity,
            runtime: d.runtime ?? d.episode_run_time?.[0] ?? null, tagline: d.tagline || null, director: director?.name || null, trailer_key: officialTrailer?.key || null,
            backdrop_path: d.backdrop_path ? `${config.images.secure_base_url}w1280${d.backdrop_path}` : null,
            logo_path: logo ? `${config.images.secure_base_url}w300${logo.file_path}` : null, top_cast: topCast || null,
            watch_providers: d['watch/providers']?.results?.US || null, spoken_languages: d.spoken_languages ?? null,
        };
    });

  if (rows.length > 0) {
    const { error } = await supabase.from("media").upsert(rows, { onConflict: "tmdb_id" });
    if (error) { console.error("Supabase upsert error:", error.message); return 0; }

    // --- Update the in-memory cache with the new IDs we just added ---
    rows.forEach(row => existingTmdbIds.add(row.tmdb_id));

    console.log(`   - Successfully upserted ${rows.length} valid rows. Cache size is now ${existingTmdbIds.size}.`);
    return rows.length;
  }
  return 0;
}

(async () => {
    console.log("🚀 Seeder script initializing...");
    // Load the cache at the very beginning of the run.
    await loadExistingIds();

    const config = await getBaseConfig();
    if (!config) { console.error("Could not fetch TMDb configuration. Aborting."); return; }

    if (mode === 'genre') {
        console.log(`\nRunning in GENRE mode. Goal: Fetch ${totalPagesToFetch} pages for genre "${genreName}".\n`);
    } else {
        console.log(`\nRunning in POPULAR mode. Goal: Fetch ~${totalPagesToFetch * 40} items across ${totalPagesToFetch} pages.\n`);
    }

    let totalSeeded = 0;
    for (let page = 1; page <= totalPagesToFetch; page++) {
        const seededCount = await processPage(page, config);
        if (seededCount === -1) { console.log("No more items found on TMDb, ending process early."); break; }
        totalSeeded += seededCount;
        console.log(`✅ Page ${page} complete. New items on this page: ${seededCount}. Total new items this run: ${totalSeeded}`);
    }
    
// at the bottom of your ingestion script
    const { error: analyzeErr } = await supabase.rpc("run_sql", {
      sql: "ANALYZE public.media"
    });
    if (analyzeErr) console.error("ANALYZE failed", analyzeErr);

    console.log(`\n\n🎉 Seeder script finished!`);
})();

