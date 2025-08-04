// scripts/smart-seeder.ts

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { promises as fs } from "fs";
import path from "path";

// --- CONFIGURATION ---
const TARGET_TOTAL_ITEMS = 100_000;
const TMD_DB_REQUEST_DELAY_MS = 300;
const STRATEGY_DELAY_MS = 5000;
const MAX_API_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 2000;
const PAGE_SIZE = 1000; // Chunk size for fetching existing IDs

// --- CLIENTS ---
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE! || !process.env.OPENAI_KEY || !process.env.TMDB_V3_API_KEY) {
  console.error("Missing required environment variables. Ensure SUPABASE_URL, SUPABASE_SERVICE_ROLE, OPENAI_KEY, and TMDB_V3_API_KEY are set.");
  process.exit(1);
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });
const TMDB_V3_API_KEY = process.env.TMDB_V3_API_KEY;
const TMDB_API_BASE = "https://api.themoviedb.org/3";

// --- ANTI-DUPLICATE CACHE ---
let existingTmdbIds = new Set<number>();

async function loadExistingIds() {
  console.log("Loading all existing TMDb IDs from the database into cache...");
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("media")
      .select("tmdb_id")
      .range(from, to);

    if (error) {
      console.error(`❌ Failed to load IDs on page ${page}:`, error.message);
      hasMore = false;
      return;
    }
    if (data.length > 0) {
      data.forEach(item => existingTmdbIds.add(item.tmdb_id));
      console.log(`  - Loaded ${data.length} IDs (page ${page + 1}). Cache size: ${existingTmdbIds.size}`);
    }
    if (data.length < PAGE_SIZE) {
      hasMore = false;
    }
    page++;
  }
  console.log(`✅ Cache loading complete. Found ${existingTmdbIds.size} existing items.`);
}

// --- HELPER FUNCTIONS ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_API_RETRIES): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const delayTime = (retryAfter ? parseInt(retryAfter, 10) * 1000 : INITIAL_RETRY_DELAY_MS) + (i * 1000);
        console.warn(`⚠️ TMDb Rate Limit hit. Retrying in ${delayTime / 1000}s...`);
        await delay(delayTime);
        continue;
      }
      if (response.ok) return response.json();
      throw new Error(`API error: ${response.status} - ${await response.text()}`);
    } catch (error: any) {
      if (i === retries - 1) {
        console.error(`❌ Final attempt failed for ${url}. Error:`, error.message);
        return null;
      }
      const delayTime = INITIAL_RETRY_DELAY_MS * Math.pow(2, i);
      console.warn(`⚠️ Request failed for ${url}. Retrying in ${delayTime / 1000}s...`);
      await delay(delayTime);
    }
  }
  return null;
}

async function getTmdbConfig() {
  return fetchWithRetry(`${TMDB_API_BASE}/configuration?api_key=${TMDB_V3_API_KEY}`, {});
}

async function fetchTmdbPage(endpoint: string, params: Record<string, string>, page: number = 1) {
  const url = new URL(`${TMDB_API_BASE}${endpoint}`);
  url.searchParams.set("api_key", TMDB_V3_API_KEY);
  url.searchParams.set("page", String(page));
  for (const key in params) {
    url.searchParams.set(key, params[key]);
  }
  return fetchWithRetry(url.toString(), {});
}

async function getDetailedMedia(type: "movie" | "tv", id: number) {
  const url = `${TMDB_API_BASE}/${type}/${id}?api_key=${TMDB_V3_API_KEY}&append_to_response=videos,credits,images,watch/providers`;
  return fetchWithRetry(url, {});
}

async function upsertMediaToSupabase(mediaItems: any[], tmdbConfig: any): Promise<number> {
  const rows = mediaItems.filter(Boolean).filter((d: any) => d.overview && d.poster_path && d.genres?.length > 0)
    .map((d: any) => {
      const isMovie = d.title;
      const officialTrailer = d.videos?.results?.find((v: any) => v.site === "YouTube" && v.type === "Trailer" && v.official);
      const director = d.credits?.crew?.find((c: any) => c.job === "Director");
      const logo = d.images?.logos?.find((l: any) => l.iso_639_1 === "en") || d.images?.logos?.[0];

      const topCast = d.credits?.cast?.slice(0, 10).map((actor: any) => ({
        name: actor.name,
        character: actor.character,
        profile_path: actor.profile_path ? `${tmdbConfig.secure_base_url}w185${actor.profile_path}` : null
      }));

      return {
        tmdb_id: d.id, media_type: isMovie ? "movie" : "tv", title: d.title ?? d.name!,
        synopsis: d.overview, genres: d.genres.map((g: any) => g.name).filter(Boolean),
        runtime: d.runtime ?? d.episode_run_time?.[0] ?? null,
        poster_path: `${tmdbConfig.secure_base_url}w500${d.poster_path}`,
        release_date: d.release_date ?? d.first_air_date ?? null,
        popularity: d.popularity, tagline: d.tagline || null, director: director?.name || null,
        trailer_key: officialTrailer?.key || null,
        backdrop_path: d.backdrop_path ? `${tmdbConfig.secure_base_url}w1280${d.backdrop_path}` : null,
        logo_path: logo ? `${tmdbConfig.secure_base_url}w300${logo.file_path}` : null,
        top_cast: topCast || null, watch_providers: d['watch/providers']?.results?.US || null,
        spoken_languages: d.spoken_languages ?? null, embedding: null,
      };
    });

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("media").upsert(rows, { onConflict: "tmdb_id", ignoreDuplicates: true });
  if (error) {
    console.error("❌ Supabase upsert error:", error.message);
    return 0;
  }
  
  rows.forEach(row => existingTmdbIds.add(row.tmdb_id));
  return rows.length;
}

interface DbStats {
  totalItems: number;
  genres: Record<string, number>;
  decades: Record<string, number>;
}

interface TmdbQuerySuggestion {
  endpoint: "/discover/movie" | "/discover/tv";
  params: Record<string, string>;
  description: string;
}

async function fetchDbStatistics(): Promise<DbStats> {
    const { count, error: totalError } = await supabase.from("media").select('*', { count: 'exact', head: true });
    if (totalError) { console.error("Error fetching total count:", totalError); return { totalItems: 0, genres: {}, decades: {} }; }

    const { data: genreData, error: genreError } = await supabase.rpc("get_genre_counts");
    if (genreError) console.error("Error fetching genre counts:", genreError);

    const { data: decadeData, error: decadeError } = await supabase.rpc("get_decade_counts");
    if (decadeError) console.error("Error fetching decade counts:", decadeError);

    const genres = (genreData as any[] || []).reduce((acc, g) => { acc[g.genre] = g.count; return acc; }, {});
    const decades = (decadeData as any[] || []).reduce((acc, d) => { acc[d.decade] = d.count; return acc; }, {});

    return { totalItems: count ?? 0, genres, decades };
}

const llmStrategyPrompt = (dbStats: DbStats, target: number) => `
You are an expert content strategist for a movie and TV show database. Your goal is to help expand the database from its current state of ${dbStats.totalItems} items to a target of ${target}. The database already contains most of the globally popular movies and TV shows.

Current Database Stats:
- Genre Distribution (top 10): ${JSON.stringify(Object.entries(dbStats.genres).sort(([,a],[,b])=>b-a).slice(0,10))}
- Decade Distribution (last 5 decades): ${JSON.stringify(Object.entries(dbStats.decades).sort().slice(-5))}

Suggest 8 diverse TMDb API queries to discover NEW and INTERESTING content. Your primary goal is to find content that is NOT LIKELY to be in the database already. Focus on:
1.  **Niche Genres & Keywords:** Instead of just "Action", suggest "Action films with a 'heist' keyword".
2.  **Older or Underrepresented Decades:** Look for content from the 1960s, 1950s, etc.
3.  **International Cinema:** Use 'with_origin_country' to suggest content from different countries (e.g., KR for South Korea, JP for Japan).
4.  **Highly Rated but Less Popular:** Use 'sort_by: vote_average.desc' combined with a 'vote_count.gte: 100' to find hidden gems.

You MUST output a JSON object with a single key "strategies".
Example:
{
  "strategies": [
    { "endpoint": "/discover/movie", "params": { "sort_by": "vote_average.desc", "vote_count.gte": "100", "with_genres": "99", "primary_release_year": "1985" }, "description": "Highly-rated 1985 documentaries" },
    { "endpoint": "/discover/tv", "params": { "with_genres": "10765", "with_origin_country": "JP" }, "description": "Japanese Sci-Fi & Fantasy Anime" }
  ]
}
`;

async function generateTmdbQueryStrategies(dbStats: DbStats): Promise<TmdbQuerySuggestion[]> {
  console.log("🧠 Generating new TMDb query strategies with LLM...");
  const messages = [{ role: "system", content: llmStrategyPrompt(dbStats, TARGET_TOTAL_ITEMS) }];
  
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini", messages, temperature: 0.8, response_format: { type: "json_object" }
  });
  
  try {
    const content = resp.choices[0].message.content!;
    const parsed = JSON.parse(content);
    if (!parsed.strategies || !Array.isArray(parsed.strategies)) throw new Error("LLM did not return a valid 'strategies' array.");
    return parsed.strategies;
  } catch (e) {
    console.error("❌ Failed to parse LLM strategy response:", e);
    return [];
  }
}

async function runSmartSeeder() {
  console.log(`🚀 Starting Smart Seeder: Target ${TARGET_TOTAL_ITEMS} items.`);
  
  await loadExistingIds();
  
  const tmdbConfig = await getTmdbConfig();
  if (!tmdbConfig) { console.error("Could not fetch TMDb configuration. Aborting."); return; }

  let currentItemCount = existingTmdbIds.size;

  while (currentItemCount < TARGET_TOTAL_ITEMS) {
    console.log(`\n📊 Current DB count: ${currentItemCount} / ${TARGET_TOTAL_ITEMS}.`);
    
    const dbStats = await fetchDbStatistics();
    currentItemCount = dbStats.totalItems;

    const strategies = await generateTmdbQueryStrategies(dbStats);

    if (strategies.length === 0) {
      console.warn("LLM failed to generate strategies. Waiting before retry.");
      await delay(STRATEGY_DELAY_MS * 3);
      continue;
    }

    for (const strategy of strategies) {
      if (currentItemCount >= TARGET_TOTAL_ITEMS) break;

      console.log(`\n▶️ Executing Strategy: "${strategy.description}"`);
      
      const pagesToFetch = 3;
      let newItemsThisStrategy = 0;
      
      for (let page = 1; page <= pagesToFetch; page++) {
        if ((await fetchDbStatistics()).totalItems >= TARGET_TOTAL_ITEMS) break;
        
        const data = await fetchTmdbPage(strategy.endpoint, strategy.params, page);
        if (!data?.results || data.results.length === 0) {
          console.log(`  - No more results for this strategy on page ${page}.`);
          break;
        }

        const newItems = data.results.filter((item: any) => !existingTmdbIds.has(item.id));
        if (newItems.length === 0) {
          console.log(`  - Page ${page} contains only items we already have. Skipping detail fetch.`);
          continue;
        }
        console.log(`  - Page ${page}: Found ${newItems.length} genuinely new items to process.`);
        
        const detailedItems = (await Promise.all(
          newItems.map((item: any) => getDetailedMedia(item.title ? "movie" : "tv", item.id))
        )).filter(Boolean);

        const processedCount = await upsertMediaToSupabase(detailedItems, tmdbConfig.images);
        newItemsThisStrategy += processedCount;
        
        await delay(TMD_DB_REQUEST_DELAY_MS);
      }
      
      const latestCount = (await fetchDbStatistics()).totalItems;
      console.log(`  - Strategy complete. Added ${newItemsThisStrategy} new items. DB total is now: ${latestCount}`);
      currentItemCount = latestCount;
    }
    await delay(STRATEGY_DELAY_MS);
  }

  console.log(`\n🎉 Smart Seeder Finished! Reached target. Final count: ${currentItemCount}.`);
}

runSmartSeeder().catch(console.error);