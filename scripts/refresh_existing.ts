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