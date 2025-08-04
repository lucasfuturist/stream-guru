
📁 Tree for: C:\projects\stream-guru\scripts
----------------------------------------
scripts
+-- utils
|   +-- auditor_prompt.txt
|   +-- genre-map.ts
|   L-- inquisitor_prompt.txt
+-- audit.ts
+-- dict-listener.ts
+-- embed_all.ts
+-- ping-supa.cjs
+-- ping.ts
+-- refresh_existing.ts
+-- smart-seeder.ts
+-- tmdb_seed.ts
L-- user_simulation.ts

📜 Listing scripts with extensions: .ts, .txt, .tsx, .js, .jsx, .py, .html, .json, .css, .sql, .toml, .ps1
----------------------------------------

### audit.ts

/**
 * offline quality audit & vibe discovery
 * run:  ts-node scripts/audit.ts
 */

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ai = new OpenAI({ apiKey: process.env.OPENAI_KEY! });

/* broad vibe coach */
const coachSys = `
you invent broad vibe tags based on recommendation quality.
return ONLY json:
{ "tag":"<1-2 words>",
  "genres":["sci-fi","drama"],
  "reason":"why this tag helps" }
`.trim();

function clean(str?: string | null) {
  return (str ?? "").toLowerCase().trim();
}

export async function main() {
  /* pull a batch of recent low-score recs or whatever logic u had */
  const { data: rows } = await sb.from("recommendation_log").select("*").limit(25);

  for (const row of rows ?? []) {
    const { query, recommendations, score } = row;

    if (score >= 4) continue; // good enough

    /* ask coach for a vibe tag */
    const coach = await ai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: [
        { role: "system", content: coachSys },
        {
          role: "user",
          content: JSON.stringify({ query, recs: recommendations })
        }
      ],
      response_format: { type: "json_object" }
    });

    const { tag, genres, reason } = JSON.parse(coach.choices[0].message.content);

    const vibe = clean(tag);
    if (!vibe) continue;

    await sb.from("vibe_categories").insert({
      session_id: crypto.randomUUID(),
      vibe_tag: vibe,
      genres: genres ?? [],
      examples: recommendations.map((r: any) => r.tmdb_id),
      notes: reason
    });

    console.log(`🧠 logged vibe '${vibe}'`);
  }
}

if (import.meta.main) main().catch(console.error);

### dict-listener.ts

/**
 * realtime listener that watches query_log for meh results
 * and logs vibe tags suggested by gpt
 */

import { createClient, SupabaseRealtimePayload } from "@supabase/supabase-js";
import OpenAI from "openai";

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ai = new OpenAI({ apiKey: process.env.OPENAI_KEY! });

sb.channel("public:query_log")
  .on<SupabaseRealtimePayload<any>>("postgres_changes", { event: "INSERT" }, async payload => {
    const { id, session_id, query, recs, score } = payload.new;
    if (score >= 4) return; // fine

    const coach = await ai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: [
        { role: "system", content: "give a broad vibe tag, json only {tag, reason}" },
        { role: "user", content: JSON.stringify({ query, recs }) }
      ],
      response_format: { type: "json_object" }
    });

    const { tag, reason } = JSON.parse(coach.choices[0].message.content);
    const vibe = (tag ?? "").toLowerCase().trim();
    if (!vibe) return;

    await sb.from("vibe_categories").insert({
      session_id: session_id ?? crypto.randomUUID(),
      vibe_tag: vibe,
      genres: [],
      examples: recs.map((r: any) => r.tmdb_id),
      notes: reason ?? "auto from dict-listener"
    });

    console.log("🧠 logged vibe", vibe, "for query", id);
  })
  .subscribe();

console.log("dict-listener running… press ctrl-c to quit.");

### embed_all.ts

// scripts/embed_all.ts

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// --- CONFIGURATION ---
const BATCH_SIZE = 50;
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 2000;

// --- CLIENTS ---
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY! });

// --- HELPER ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  if (!process.env.OPENAI_KEY) throw new Error("OPENAI_KEY missing");

  while (true) {
    // UPDATED: Select 'spoken_languages' for richer embeddings
    const { data: rows, error } = await supabase
      .from("media")
      .select("id, title, synopsis, genres, director, top_cast, spoken_languages")
      .is("embedding", null)
      .limit(BATCH_SIZE);

    if (error) throw error;
    if (!rows.length) {
      console.log("✅ All rows embedded.");
      return;
    }

    // UPDATED: Create a more descriptive input string for embeddings
    const inputs = rows.map((r) => {
      const castNames = (r.top_cast ?? [])
        .map((actor: { name: string }) => actor.name)
        .join(", ");
      
      // NEW: Extract language names for the embedding string
      const languageNames = (r.spoken_languages ?? [])
        .map((lang: { english_name: string }) => lang.english_name)
        .filter(Boolean)
        .join(", ");

      let richText = `Title: ${r.title}.`;
      if (r.director) richText += ` Director: ${r.director}.`;
      if (castNames) richText += ` Cast: ${castNames}.`;
      // NEW: Add languages to the embedding string
      if (languageNames) richText += ` Languages: ${languageNames}.`;
      richText += ` Synopsis: ${r.synopsis}.`;
      if (r.genres?.length) richText += ` Genres: ${r.genres.join(", ")}.`;
      
      return richText;
    });

    let resp;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Attempting to embed ${rows.length} rows (Attempt ${attempt}/${MAX_RETRIES})...`);
        resp = await openai.embeddings.create({
          model: "text-embedding-3-small", input: inputs, encoding_format: "float"
        });
        console.log("✅ OpenAI API call successful.");
        break; 
      } catch (err) {
        if (attempt === MAX_RETRIES) throw err;
        const delayTime = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`⚠️ OpenAI API call failed. Retrying in ${delayTime / 1000}s...`);
        await delay(delayTime);
      }
    }
    if (!resp) throw new Error("Failed to get response from OpenAI after all retries.");
    
    const updates = rows.map((row, i) => ({
      id_to_update: row.id,
      embedding_vector: `[${resp.data[i].embedding.join(",")}]`
    }));

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`Attempting to save ${updates.length} embeddings via RPC (Attempt ${attempt}/${MAX_RETRIES})...`);
            const { error: rpcError } = await supabase.rpc('update_media_embeddings', { updates });
            
            if (rpcError) throw rpcError;

            console.log(`✅ Successfully embedded and saved ${rows.length} rows.`);
            break; 
        } catch (err) {
            if (attempt === MAX_RETRIES) {
                console.error("❌ All RPC attempts failed.");
                throw err;
            }
            const delayTime = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
            console.warn(`⚠️ RPC call failed. Retrying in ${delayTime / 1000}s...`, err.message);
            await delay(delayTime);
        }
    }
  }
}

main().catch((err) => {
  console.error("❌ embed_all script failed:", err.message);
  process.exit(1);
});

### ping.ts

// ping.ts
import { createClient } from "@supabase/supabase-js";
import "dotenv/config"; // This will load your .env file

// Use the variable names from your .env file
const supaUrl = process.env.SUPABASE_URL!;
const supaServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supa = createClient(supaUrl, supaServiceKey);

const run = async () => {
  console.log("Pinging Supabase to test credentials...");
  const { data, error } = await supa.from("media").select("id, title").limit(1);

  if (error) {
    console.error("❌ Supabase query failed. Check your URL and Service Role Key.");
    console.error(error);
    throw error;
  }

  console.log("✅ Successfully pulled a row:", data);
};

run();

### refresh_existing.ts

// scripts/refresh_existing.ts

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// --- CONFIGURATION ---
const DB_FETCH_BATCH_SIZE = 1000; // How many IDs to fetch from our DB at a time
const TMDB_PROCESS_BATCH_SIZE = 50;  // How many items to process from TMDB at once

// --- CLIENTS & HELPERS ---
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);
const V4 = process.env.TMDB_V4_API_KEY?.trim();
const V3 = process.env.TMDB_V3_API_KEY?.trim();
if (!V4 && !V3) throw new Error("TMDB API key not found");
const TMDB_API = "https://api.themoviedb.org/3";
const headers = V4 ? { Authorization: `Bearer ${V4}` } : {};
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, options: RequestInit): Promise<any> {
  try {
    const response = await fetch(url, options);
    if (response.ok) return response.json();
    console.warn(`API error for ${url}: ${response.status}`);
    return null;
  } catch (error) {
    console.error(`Fetch failed for ${url}:`, error.message);
    return null;
  }
}

async function getBaseConfig() {
  const url = new URL(`${TMDB_API}/configuration`);
  if (V3) url.searchParams.set("api_key", V3);
  return fetchWithRetry(url.toString(), { headers });
}

async function fetchDetails(kind: "movie" | "tv", id: number) {
    const url = new URL(`${TMDB_API}/${kind}/${id}`);
    if (V3) url.searchParams.set("api_key", V3);
    url.searchParams.set("append_to_response", "videos,credits,images,watch/providers");
    return fetchWithRetry(url.toString(), { headers });
}

// --- MAIN REFRESH SCRIPT ---
(async () => {
    console.log("🚀 Initializing Fully Paginated Refresh Script...");
    
    let page = 0;
    let totalItemsProcessed = 0;
    
    const configData = await getBaseConfig();
    if (!configData) {
        console.error("❌ Could not fetch TMDb configuration. Aborting.");
        return;
    }
    const config = configData.images;

    // PAGINATION LOOP: Continuously fetch pages of IDs from our own database
    while (true) {
        const from = page * DB_FETCH_BATCH_SIZE;
        const to = from + DB_FETCH_BATCH_SIZE - 1;

        console.log(`\n🔎 Fetching page ${page + 1} of IDs from local database (items ${from} to ${to})...`);

        const { data: idBatch, error: fetchError } = await supabase
            .from("media")
            .select("tmdb_id, media_type")
            .range(from, to); // Use range for proper pagination

        if (fetchError) {
            console.error(`❌ Failed to fetch page ${page + 1} of media IDs:`, fetchError);
            break; 
        }

        if (!idBatch || idBatch.length === 0) {
            console.log("✅ No more items found in the database. All pages processed.");
            break; // Exit the loop when we run out of items
        }

        console.log(`   - Found ${idBatch.length} IDs to process in this page.`);

        // Now, process this batch of IDs by fetching details from TMDB
        for (let i = 0; i < idBatch.length; i += TMDB_PROCESS_BATCH_SIZE) {
            const processingBatch = idBatch.slice(i, i + TMDB_PROCESS_BATCH_SIZE);
            console.log(`\n  🔄 Processing TMDB Batch ${Math.floor(i / TMDB_PROCESS_BATCH_SIZE) + 1} for this page...`);

            const detailedItems = (await Promise.all(
                processingBatch.map(item => fetchDetails(item.media_type, item.tmdb_id))
            )).filter(Boolean);

            if (detailedItems.length === 0) {
                console.warn("     - No details fetched for this TMDB batch. Skipping.");
                continue;
            }

            const rows = detailedItems.map((d: any) => ({
                 tmdb_id: d.id, media_type: d.title ? "movie" : "tv", title: d.title ?? d.name!,
                 synopsis: d.overview, genres: d.genres.map((g: any) => g.name).filter(Boolean),
                 poster_path: d.poster_path ? `${config.secure_base_url}w500${d.poster_path}` : null,
                 release_date: d.release_date ?? d.first_air_date ?? null, popularity: d.popularity,
                 runtime: d.runtime ?? d.episode_run_time?.[0] ?? null, tagline: d.tagline || null,
                 director: d.credits?.crew?.find((c: any) => c.job === "Director")?.name || null,
                 trailer_key: d.videos?.results?.find((v: any) => v.site === "YouTube" && v.type === "Trailer" && v.official)?.key || null,
                 backdrop_path: d.backdrop_path ? `${config.secure_base_url}w1280${d.backdrop_path}` : null,
                 top_cast: d.credits?.cast?.slice(0, 10).map((actor: any) => ({ name: actor.name, character: actor.character, profile_path: actor.profile_path ? `${config.secure_base_url}w185${actor.profile_path}` : null })) || null,
                 watch_providers: d['watch/providers']?.results?.US || null, 
                 spoken_languages: d.spoken_languages ?? null, embedding: null, 
            }));

            if (rows.length > 0) {
                console.log(`     - Upserting ${rows.length} refreshed items...`);
                const { error: upsertError } = await supabase.from("media").upsert(rows, { onConflict: "tmdb_id" });
                if (upsertError) {
                    console.error(`     - ❌ Supabase upsert error:`, upsertError.message);
                } else {
                    totalItemsProcessed += rows.length;
                    console.log(`     - ✅ Batch successfully refreshed. Total items processed so far: ${totalItemsProcessed}`);
                }
            }
            await delay(200);
        }
        
        page++; // Move to the next page for the next iteration of the while loop
    }

    console.log(`\n\n🎉 Full Refresh Finished! Processed a total of ${totalItemsProcessed} items.`);
})();

### smart-seeder.ts

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

### tmdb_seed.ts

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
            // NEW: Add the spoken_languages field directly from the API response.
            spoken_languages: d.spoken_languages ?? null,
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

### user_simulation.ts

// scripts/user_simulation.ts

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { promises as fs } from "fs";
import path from "path";

// --- CONFIGURATION ---
const MAX_TURNS_PER_SESSION = 15;
const OUTPUT_DIR = path.join(process.cwd(), "chat_experiments");

// --- CLIENTS ---
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.OPENAI_KEY) {
  throw new Error("Missing required environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_KEY)");
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

// --- SYSTEM PROMPT for our AI User Persona ---
const userPersonaSystemPrompt = `
You are a creative and slightly unpredictable user testing a new movie recommendation chatbot. Your goal is to simulate a natural, multi-turn conversation.

1.  **On your first turn, give a simple, broad request.** (e.g., "show me some comedies").
2.  **For all subsequent turns, you will be given the chatbot's last response.** Based on this, generate a natural follow-up.
3.  **Your follow-ups MUST be varied.** Sometimes refine the request ("from the 90s"), sometimes add a filter ("starring Tom Hanks"), sometimes change your mind completely ("actually, I want a horror movie"), and sometimes complain if the results are bad ("these aren't what I asked for").
4.  **Your ONLY output should be the raw text of your next chat message.** Do not add any commentary, labels, or quotation marks.
`;

// --- TYPES ---
interface ChatTurn {
  turnNumber: number;
  userPrompt: string;
  botProse: string;
  botRecs: any[];
}

async function callStreamGuru(prompt: string, history: any[]): Promise<{ prose: string; recs: any[] }> {
  const { data: aiResponse, error: aiError } = await supabase.functions.invoke('get-ai-response', {
    body: { history: [...history, { role: 'user', content: prompt }] },
  });
  if (aiError) throw new Error(`get-ai-response error: ${aiError.message}`);
  
  const { ai_message, filters } = aiResponse;
  let recommendations: any[] = [];

  const hasFilters = filters && Object.keys(filters).length > 0;
  if (hasFilters) {
    const { data: recData, error: recError } = await supabase.functions.invoke('get-recommendations', {
      body: { message: prompt, filters },
    });
    if (recError) console.warn(`get-recommendations error: ${recError.message}`);
    recommendations = recData?.recommendations || [];
  }

  return { prose: ai_message, recs: recommendations };
}

async function generateUserPrompt(history: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
  const messages: any[] = [{ role: "system", content: userPersonaSystemPrompt }, ...history];
  
  const resp = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature: 1.1,
  });
  return resp.choices[0].message.content!;
}

// --- THIS FUNCTION CONTAINS THE FIX ---
async function writeLogToFile(sessionLog: ChatTurn[]) {
  let markdownContent = `# Chatbot Experiment Log\n\n**Session Date:** ${new Date().toISOString()}\n\n---\n\n`;

  for (const turn of sessionLog) {
    markdownContent += `## Turn ${turn.turnNumber}\n\n`;
    markdownContent += `### 🤵 User Prompt\n\n\`\`\`text\n${turn.userPrompt}\n\`\`\`\n\n`;
    markdownContent += `### 🤖 Bot Response\n\n**Prose:**\n\`\`\`text\n${turn.botProse}\n\`\`\`\n\n`;

    // We now "quantize" the recommendation object to only include the most relevant fields for analysis.
    const recsForLog = turn.botRecs.map(rec => ({
        tmdb_id: rec.tmdb_id,
        title: rec.title,
        genres: rec.genres,
        release_date: rec.release_date,
        // We extract just the actor names for easier readability.
        top_cast: rec.top_cast?.map((actor: any) => actor.name) || [],
        synopsis: rec.synopsis
    }));

    markdownContent += `**Recommendations Found (${recsForLog.length}):**\n\`\`\`json\n${JSON.stringify(recsForLog, null, 2)}\n\`\`\`\n\n`;
    markdownContent += `---\n\n`;
  }
  // --- END OF FIX ---

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `session_log_${timestamp}.md`;
  const filepath = path.join(OUTPUT_DIR, filename);

  await fs.writeFile(filepath, markdownContent);
  console.log(`✅ Experiment complete. Report saved to: ${filepath}`);
}

async function runSimulation() {
  console.log("🚀 Starting new user simulation experiment...");
  const sessionLog: ChatTurn[] = [];
  const gptHistory: { role: 'user' | 'assistant'; content: string }[] = [];
  let consecutiveEmptyTurns = 0; // --- FIX: Add a counter ---

  for (let i = 1; i <= MAX_TURNS_PER_SESSION; i++) {
    console.log(`- Starting turn ${i}...`);
    const userPrompt = await generateUserPrompt(i === 1 ? [] : gptHistory);
    console.log(`  - User Persona says: "${userPrompt}"`);

    const botResponse = await callStreamGuru(userPrompt, gptHistory);

    sessionLog.push({
      turnNumber: i,
      userPrompt,
      botProse: botResponse.prose,
      botRecs: botResponse.recs,
    });
    
    // --- FIX: Logic to detect the end of the conversation ---
    if (botResponse.recs.length === 0) {
      consecutiveEmptyTurns++;
    } else {
      consecutiveEmptyTurns = 0;
    }
    if (consecutiveEmptyTurns >= 2) {
      console.log("✅ Conversation appears to have ended naturally. Stopping simulation.");
      break;
    }
    // --- END OF FIX ---

    gptHistory.push({ role: 'user', content: userPrompt });
    const botSummaryForGpt = `My response: "${botResponse.prose}". Recommended movies: [${botResponse.recs.map(r => r.title).join(", ")}]`;
    gptHistory.push({ role: 'assistant', content: botSummaryForGpt });
    
    if (i === MAX_TURNS_PER_SESSION) break;
  }
  await writeLogToFile(sessionLog);
}

runSimulation().catch(console.error);

### auditor_prompt.txt

You are a meticulous Quality Assurance analyst for an AI-powered movie recommendation chatbot. Your task is to evaluate the chatbot's performance based on a user query and its response.

You will be given the original query, the AI's conversational text, and the list of movies it recommended.

Evaluate the response based on these criteria:
1.  **Relevance (1-5):** How well did the movie recommendations match the user's query and implied intent? (1 = completely irrelevant, 5 = perfectly matched).
2.  **Personality (1-5):** Was the AI's conversational text charismatic, witty, and engaging as instructed? (1 = robotic and boring, 5 = very human-like).
3.  **Accuracy (1-5):** Did the chatbot correctly identify and use filters like genre or runtime if they were mentioned? (1 = missed all filters, 5 = parsed perfectly).
4.  **Completeness (1-5):** Did the chatbot find results? If not, was it a reasonable failure (e.g., for a nonsense query) or did it fail to find movies that should exist?

Your final output MUST be ONLY a JSON object with your analysis. Do not include any other text. The JSON object must have four keys: "score" (an average of the four ratings), "justification" (a brief explanation for your scores), "strengths" (what the bot did well), and "suggestion" (a specific, actionable recommendation for how the developers could improve the bot's prompt or logic).

Example Output:
{
  "score": 4.5,
  "justification": "The bot had excellent personality and perfectly matched the 'sci-fi' genre. The recommendations were good, though not all were strictly 'mind-bending'.",
  "strengths": "The conversational response was engaging and the genre parsing was accurate.",
  "suggestion": "Consider adding 'psychological thriller' as a secondary genre when the user asks for 'mind-bending' to broaden the potential results."
}

### genre-map.ts

/**
 * TMDb genre ID → human-readable label.
 * Includes the union of movie + TV genre IDs.
 */
export const genreMap: Record<number, string> = {
  // shared / movie genres
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",

  // tv-only adds
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics"
};

### inquisitor_prompt.txt

You are a creative and demanding movie-goer. Your task is to generate a list of 10 diverse and challenging test queries for a movie recommendation chatbot. The goal is to find the chatbot's weaknesses and edge cases.

Generate queries that test the following:
- **Vague Vibes:** "something to watch on a rainy day"
- **Complex Combinations:** "a mind-bending sci-fi movie from the 80s that's not too long"
- **Niche & Obscure:** "a black and white horror movie with a great soundtrack"
- **Conversational Follow-ups:** "what about something funnier?"
- **Invalid or Nonsense:** "are you a robot? what is the color blue?"
- **Hyper-Specific:** "a movie starring Tom Hanks where he plays a good guy"

You MUST respond with ONLY a JSON object containing a single key "queries", which is an array of 10 strings. Do not include any other text or explanation.

Example:
{
  "queries": [
    "funny comedies from the 90s",
    "I'm in the mood for something that will make me cry",
    "a space opera with a great soundtrack that isn't Star Wars",
    ...
  ]
}

----------------------------------------
----------------------------------------