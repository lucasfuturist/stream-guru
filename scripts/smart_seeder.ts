// --- IMPORTS using the aliases from deno.json ---
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import "dotenv"; // This now maps to the Deno standard library dotenv module

// Argument parsing for Deno
const modeArg = Deno.args.find(arg => arg.startsWith('--mode='));
const mode: 'niche' | 'balance' | 'curate' = modeArg ? modeArg.split('=')[1] as any : 'niche';

// --- CONFIGURATION ---
const TARGET_TOTAL_ITEMS = 100_000;
const TMD_DB_REQUEST_DELAY_MS = 250;
const STRATEGY_DELAY_MS = 5000;
const MAX_API_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 2000;
const PAGE_SIZE = 1000;

// --- CLIENTS ---
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE')!);
const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_KEY')! });
const TMDB_V3_API_KEY = Deno.env.get('TMDB_V3_API_KEY');

if (!TMDB_V3_API_KEY) {
  console.error("TMDB_V3_API_KEY not found in environment variables.");
  Deno.exit(1);
}
const TMDB_API_BASE = "https://api.themoviedb.org/3";
let existingTmdbIds = new Set<number>();
async function loadExistingIds() {
  console.log("Loading all existing TMDb IDs into cache...");
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase.from("media").select("tmdb_id").range(from, to);
    if (error) { console.error(`❌ Failed to load IDs on page ${page}:`, error.message); hasMore = false; return; }
    if (data && data.length > 0) {
      data.forEach((item: { tmdb_id: number }) => existingTmdbIds.add(item.tmdb_id));
    }
    if (!data || data.length < PAGE_SIZE) { hasMore = false; }
    page++;
  }
  console.log(`✅ Cache loading complete. Found ${existingTmdbIds.size} existing items.`);
}
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function fetchWithRetry(url: string, options?: RequestInit, retries = MAX_API_RETRIES): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) { const delayTime = (parseInt(response.headers.get("Retry-After") || "1", 10) * 1000) + (i * 1000); console.warn(`⚠️ TMDb Rate Limit hit. Retrying in ${delayTime / 1000}s...`); await delay(delayTime); continue; }
      if (response.ok) return response.json();
      throw new Error(`API error: ${response.status} - ${await response.text()}`);
    } catch (error: any) {
      if (i === retries - 1) { console.error(`❌ Final attempt failed for ${url}. Error:`, error.message); return null; }
      const delayTime = INITIAL_RETRY_DELAY_MS * Math.pow(2, i); console.warn(`⚠️ Request failed for ${url}. Retrying in ${delayTime / 1000}s...`); await delay(delayTime);
    }
  }
  return null;
}
async function fetchTmdbPage(endpoint: string, params: Record<string, string>, page: number = 1) {
  const url = new URL(`${TMDB_API_BASE}${endpoint}`);
  url.searchParams.set("api_key", TMDB_V3_API_KEY!);
  url.searchParams.set("page", String(page));
  for (const key in params) { url.searchParams.set(key, params[key]); }
  return fetchWithRetry(url.toString(), {});
}
async function getTmdbConfig() { return fetchWithRetry(`${TMDB_API_BASE}/configuration?api_key=${TMDB_V3_API_KEY}`, {}); }
async function getDetailedMedia(type: "movie" | "tv", id: number) { return fetchWithRetry(`${TMDB_API_BASE}/${type}/${id}?api_key=${TMDB_V3_API_KEY}&append_to_response=videos,credits,images,watch/providers`, {}); }
async function upsertMediaToSupabase(mediaItems: any[], tmdbConfig: any): Promise<number> {
  const rows = mediaItems.filter(Boolean).filter((d: any) => d.overview && d.poster_path && d.genres?.length > 0)
    .map((d: any) => {
      const isMovie = d.title; const officialTrailer = d.videos?.results?.find((v: any) => v.site === "YouTube" && v.type === "Trailer" && v.official); const director = d.credits?.crew?.find((c: any) => c.job === "Director"); const logo = d.images?.logos?.find((l: any) => l.iso_639_1 === "en") || d.images?.logos?.[0]; const topCast = d.credits?.cast?.slice(0, 10).map((actor: any) => ({ name: actor.name, character: actor.character, profile_path: actor.profile_path ? `${tmdbConfig.secure_base_url}w185${actor.profile_path}` : null }));
      return { tmdb_id: d.id, media_type: isMovie ? "movie" : "tv", title: d.title ?? d.name!, synopsis: d.overview, genres: d.genres.map((g: any) => g.name).filter(Boolean), runtime: d.runtime ?? d.episode_run_time?.[0] ?? null, poster_path: `${tmdbConfig.secure_base_url}w500${d.poster_path}`, release_date: d.release_date ?? d.first_air_date ?? null, popularity: d.popularity, tagline: d.tagline || null, director: director?.name || null, trailer_key: officialTrailer?.key || null, backdrop_path: d.backdrop_path ? `${tmdbConfig.secure_base_url}w1280${d.backdrop_path}` : null, logo_path: logo ? `${tmdbConfig.secure_base_url}w300${logo.file_path}` : null, top_cast: topCast || null, watch_providers: d['watch/providers']?.results?.US || null, spoken_languages: d.spoken_languages ?? null, embedding: null, };
    });
  if (rows.length === 0) return 0;
  const { error } = await supabase.from("media").upsert(rows, { onConflict: "tmdb_id", ignoreDuplicates: true });
  if (error) { console.error("❌ Supabase upsert error:", error.message); return 0; }
  rows.forEach(row => existingTmdbIds.add(row.tmdb_id));
  return rows.length;
}
interface DbStats { totalItems: number; genres: Record<string, number>; decades: Record<string, number>; }
async function fetchDbStatistics(): Promise<DbStats> {
    const { count } = await supabase.from("media").select('*', { count: 'exact', head: true });
    const { data: genreData } = await supabase.rpc("get_genre_counts");
    const { data: decadeData } = await supabase.rpc("get_decade_counts");
    const genres = (genreData as any[] || []).reduce((acc, g) => { acc[g.genre] = g.count; return acc; }, {});
    const decades = (decadeData as any[] || []).reduce((acc, d) => { acc[d.decade] = d.count; return acc; }, {});
    return { totalItems: count ?? 0, genres, decades };
}
const llmNicheStrategyPrompt = (stats: DbStats) => `You are a content strategist trying to discover niche and interesting movies. The database currently has ${stats.totalItems} items. Suggest 8 diverse and specific queries for content that is LIKELY NOT in the database. Focus on international cinema, older decades, and unique keyword combinations. You MUST return a JSON object: { "plan": [{ "description": "...", "endpoint": "...", "params": {...}, "pages_to_fetch": 3 }] }`;
const llmBalancingStrategyPrompt = (stats: DbStats) => `You are a database curator trying to balance the content. The database has ${stats.totalItems} items. Provided stats show the current distribution. Suggest 8 queries that target the MOST UNDER-REPRESENTED genres and decades to improve balance. You MUST return a JSON object: { "plan": [{ "description": "...", "endpoint": "...", "params": {...}, "pages_to_fetch": 5 }] }`;
const llmCuratorPrompt = (stats: DbStats) => `You are an automated database curator. Your goal is to aggressively fill the largest gaps in a media library of ${stats.totalItems} items. Analyze the following statistics which show the current count of items per category. - Genre Distribution: ${JSON.stringify(stats.genres)} - Decade Distribution: ${JSON.stringify(stats.decades)} Your task is to create a multi-step seeding plan to fix the worst imbalances. Identify the top 3-4 most under-represented genres or decades. For each, create a job to fetch a LARGE number of pages (between 20 and 50) of popular, high-quality content for that category. You MUST return a JSON object with a single key "plan". Each object in the plan must have a "pages_to_fetch" key. Example: { "plan": [ { "description": "Bulk-filling the severely under-represented 'Western' genre.", "endpoint": "/discover/movie", "params": { "with_genres": "37", "sort_by": "popularity.desc" }, "pages_to_fetch": 50 }, { "description": "Addressing the lack of content from the 1970s.", "endpoint": "/discover/tv", "params": { "first_air_date_year": "1975", "sort_by": "popularity.desc" }, "pages_to_fetch": 25 } ] }`;
async function generateLlmPlan(prompt: string): Promise<any[]> {
  console.log("🧠 Generating new curation plan with LLM...");
  const messages = [{ role: "system", content: prompt }];
  const resp = await openai.chat.completions.create({ model: "gpt-4o-mini", messages, temperature: 0.7, response_format: { type: "json_object" } });
  try {
    const content = resp.choices[0].message.content!;
    const parsed = JSON.parse(content);
    if (!parsed.plan || !Array.isArray(parsed.plan)) throw new Error("LLM did not return a valid 'plan' array.");
    return parsed.plan;
  } catch (e) { console.error("❌ Failed to parse LLM plan response:", e as Error); return []; }
}
async function runSmartSeeder() {
  console.log(`🚀 Starting Smart Seeder in [${mode.toUpperCase()}] mode. Target: ${TARGET_TOTAL_ITEMS} items.`);
  await loadExistingIds();
  const tmdbConfig = await getTmdbConfig();
  if (!tmdbConfig?.images) { console.error("Could not fetch TMDb configuration. Aborting."); return; }
  while (existingTmdbIds.size < TARGET_TOTAL_ITEMS) {
    const dbStats = await fetchDbStatistics();
    console.log(`\n📊 Current DB count: ${dbStats.totalItems} / ${TARGET_TOTAL_ITEMS}.`);
    let prompt;
    switch (mode) {
      case 'curate': prompt = llmCuratorPrompt(dbStats); break;
      case 'balance': prompt = llmBalancingStrategyPrompt(dbStats); break;
      default: prompt = llmNicheStrategyPrompt(dbStats);
    }
    const plan = await generateLlmPlan(prompt);
    if (plan.length === 0) { console.warn("LLM failed to generate a plan. Waiting before retry."); await delay(STRATEGY_DELAY_MS * 3); continue; }
    console.log(`\n🤖 LLM Curation Plan Received. Executing ${plan.length} jobs.`);
    for (const job of plan) {
      if (existingTmdbIds.size >= TARGET_TOTAL_ITEMS) break;
      console.log(`\n▶️ Executing Job: "${job.description}"`);
      const pagesToFetch = job.pages_to_fetch || 5;
      for (let page = 1; page <= pagesToFetch; page++) {
        if (existingTmdbIds.size >= TARGET_TOTAL_ITEMS) { console.log("   - Target item count reached. Stopping job early."); break; }
        console.log(`   - Fetching page ${page} of ${pagesToFetch}...`);
        const data = await fetchTmdbPage(job.endpoint, job.params, page);
        if (!data?.results || data.results.length === 0) { console.log(`   - No more results for this job. Moving to next job.`); break; }
        const newItems = data.results.filter((item: any) => !existingTmdbIds.has(item.id));
        if (newItems.length === 0) { console.log(`   - Page ${page} contains only items we already have.`); continue; }
        const detailedItems = (await Promise.all(newItems.map((item: any) => getDetailedMedia(item.title ? "movie" : "tv", item.id)))).filter(Boolean);
        const processedCount = await upsertMediaToSupabase(detailedItems, tmdbConfig.images);
        if (processedCount > 0) { console.log(`   - Saved ${processedCount} new items. DB total is now: ${existingTmdbIds.size}`); }
        await delay(TMD_DB_REQUEST_DELAY_MS);
      }
    }
    console.log("\n✅ Curation cycle complete. Re-evaluating database state...");
    await delay(STRATEGY_DELAY_MS);
  }
  console.log(`\n\n🎉 Smart Seeder Finished! Reached target. Final count: ${existingTmdbIds.size}.`);
}

runSmartSeeder().catch(console.error);