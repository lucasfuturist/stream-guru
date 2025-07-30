// scripts/tmdb_seed.ts

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// --- ROBUST Argument Parsing ---
let mode: 'totalItems' | 'singlePage' = 'totalItems';
let targetValue: number;

const pageArgIndex = process.argv.indexOf('--page');

if (pageArgIndex > -1) {
  // Check if a value exists after the --page flag
  if (process.argv[pageArgIndex + 1]) {
    mode = 'singlePage';
    targetValue = parseInt(process.argv[pageArgIndex + 1], 10);
  } else {
    throw new Error("The --page flag requires a number after it.");
  }
} else {
  // In production mode, the argument is the 3rd element (node, script, arg)
  const totalItemsArg = process.argv[2];
  targetValue = totalItemsArg ? parseInt(totalItemsArg, 10) : 2000;
}

if (isNaN(targetValue)) {
    throw new Error(`Invalid argument provided. Expected a number, but got NaN.`);
}
// --- End Argument Parsing ---


// --- CONFIGURATION ---
const ITEMS_PER_PAGE = 40;
const TOTAL_PAGES_TO_FETCH = mode === 'totalItems' ? Math.ceil(targetValue / ITEMS_PER_PAGE) : 1;
// ... (The rest of the file is unchanged)

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);
const V4 = process.env.TMDB_V4_API_KEY?.trim();
const V3 = process.env.TMDB_V3_API_KEY?.trim();
if (!V4 && !V3) throw new Error("TMDB API key not found");
const TMDB_API = "https://api.themoviedb.org/3";
const headers = V4 ? { Authorization: `Bearer ${V4}` } : {};
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 2000;

const url = (path: string, params?: Record<string, string>) => {
    const url = new URL(`${TMDB_API}${path}`);
    if (V3) url.searchParams.set("api_key", V3);
    if (params) Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    return url.toString();
};
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response.json();
      if (response.status >= 400 && response.status < 500) {
        console.warn(`Client error fetching ${url}: ${response.status}. Not retrying.`);
        return null;
      }
      throw new Error(`Server error: ${response.status}`);
    } catch (error) {
      if (i === retries - 1) {
        console.error(`Final attempt failed for ${url}. Error:`, error.message);
        return null;
      }
      const delayMs = INITIAL_RETRY_DELAY * Math.pow(2, i);
      console.warn(`Request failed for ${url}. Retrying in ${delayMs / 1000}s... (Attempt ${i + 1}/${retries})`);
      await delay(delayMs);
    }
  }
  return null;
}
async function getBaseConfig() {
  return fetchWithRetry(url("/configuration"), { headers });
}
async function fetchDetails(kind: "movie" | "tv", id: number) {
  return fetchWithRetry(url(`/${kind}/${id}`, { append_to_response: "videos,credits,images" }), { headers });
}
async function processPage(page: number, config: any) {
  console.log(`--- Processing Page ${page} ---`);
  const [moviesData, tvData] = await Promise.all([
    fetchWithRetry(url("/movie/popular", { page: String(page) }), { headers }),
    fetchWithRetry(url("/tv/popular", { page: String(page) }), { headers })
  ]);
  if (!moviesData?.results || !tvData?.results) {
    console.warn(`Could not fetch list for page ${page}. Skipping.`);
    return 0;
  }
  const itemsToFetch = [
    ...moviesData.results.map((m: any) => ({ id: m.id, media_type: "movie" as const })),
    ...tvData.results.map((t: any) => ({ id: t.id, media_type: "tv" as const })),
  ];
  if (itemsToFetch.length === 0) return -1;
  console.log(`Found ${itemsToFetch.length} items. Fetching details...`);
  const detailedItems = [];
  for (const item of itemsToFetch) {
    const details = await fetchDetails(item.media_type, item.id);
    if (details) detailedItems.push(details);
    await delay(50);
  }
  const rows = detailedItems.filter(Boolean).filter((d: any) => d.overview && d.poster_path && d.genres?.length > 0)
    .map((d: any) => {
        const officialTrailer = d.videos?.results?.find((v: any) => v.site === "YouTube" && v.type === "Trailer" && v.official);
        const director = d.credits?.crew?.find((c: any) => c.job === "Director");
        const englishLogo = d.images?.logos?.find((l: any) => l.iso_639_1 === "en");
        const anyLogo = d.images?.logos?.[0];
        const logo = englishLogo || anyLogo;
        const topCast = d.credits?.cast?.slice(0, 6).map((actor: any) => ({ name: actor.name, character: actor.character, profile_path: actor.profile_path ? `${config.secure_base_url}${config.profile_size}${actor.profile_path}` : null }));
        return {
            tmdb_id: d.id, media_type: d.title ? "movie" : "tv", title: d.title ?? d.name!, synopsis: d.overview, genres: d.genres.map((g: any) => g.name).filter(Boolean),
            poster_path: `${config.secure_base_url}${config.poster_size}${d.poster_path}`, release_date: d.release_date ?? d.first_air_date ?? null, popularity: d.popularity,
            runtime: d.runtime ?? d.episode_run_time?.[0] ?? null, tagline: d.tagline || null, director: director?.name || null, trailer_key: officialTrailer?.key || null,
            backdrop_path: d.backdrop_path ? `${config.secure_base_url}${config.backdrop_size}${d.backdrop_path}` : null,
            logo_path: logo ? `${config.secure_base_url}${config.logo_size}${logo.file_path}` : null, top_cast: topCast || null,
        };
    });
  if (rows.length > 0) {
    const { error } = await supabase.from("media").upsert(rows, { onConflict: "tmdb_id" });
    if (error) { console.error("Supabase upsert error:", error.message); return 0; }
    console.log(`Upserted ${rows.length} valid rows.`);
    return rows.length;
  }
  return 0;
}
(async () => {
    console.log("🚀 Seeder script initializing...");
    const config = await getBaseConfig();
    if (!config) { console.error("Could not fetch TMDb configuration. Aborting."); return; }
    let totalSeeded = 0;
    if (mode === 'singlePage') {
        console.log(`Running in SINGLE PAGE mode for page ${targetValue}.`);
        await processPage(targetValue, config);
    } else {
        console.log(`Running in TOTAL ITEMS mode. Goal: ~${targetValue} items across ${TOTAL_PAGES_TO_FETCH} pages.`);
        for (let page = 1; page <= TOTAL_PAGES_TO_FETCH; page++) {
            const seededCount = await processPage(page, config);
            if (seededCount === -1) { console.log("No more items found on TMDb, ending process early."); break; }
            totalSeeded += seededCount;
            console.log(`✅ Page ${page} complete. Total items seeded so far: ${totalSeeded}`);
        }
    }
    console.log(`\n🎉 Seeder script finished!`);
})();