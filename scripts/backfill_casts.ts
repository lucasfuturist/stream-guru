// deno run -A scripts/backfill_cast.ts
// Env: TMDB_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TMDB = Deno.env.get("TMDB_V3_API_KEY");
const URL  = Deno.env.get("SUPABASE_URL");
const KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!TMDB || !URL || !KEY) {
  console.error("Missing env: TMDB_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

type MediaRow = { tmdb_id: number; media_type: "movie" | "tv" };

async function fetchCredits(id: number, type: "movie" | "tv") {
  const endpoint = `https://api.themoviedb.org/3/${type}/${id}/credits?api_key=${TMDB}&language=en-US`;
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`TMDB ${type}/${id} credits: ${res.status}`);
  const json = await res.json();
  return (json.cast || []) as Array<{ id:number; name:string; character?:string; order?:number }>;
}

async function upsertCast(tmdb_id: number, cast: Awaited<ReturnType<typeof fetchCredits>>) {
  if (!cast.length) return;
  const rows = cast.map(c => ({
    tmdb_id,
    person_id: c.id,
    name: c.name,
    character: c.character ?? null,
    order: Number.isFinite(c.order) ? c.order : null,
  }));
  const { error } = await sb.from("media_cast")
    .upsert(rows, { onConflict: "tmdb_id,person_id", ignoreDuplicates: false, defaultToNull: true });
  if (error) throw error;
}

async function main() {
  const start = Number(Deno.args[0] ?? 0);
  const limit = Number(Deno.args[1] ?? 5000);
  const pageSize = 500;
  let offset = start;
  let processed = 0;

  while (processed < limit) {
    const rangeEnd = offset + Math.min(pageSize, limit - processed) - 1;

    const { data: media, error } = await sb
      .from("media")
      .select("tmdb_id, media_type")   // <- make sure it's tmdb_id (with b)
      .order("popularity", { ascending: false })
      .range(offset, rangeEnd);

    if (error) throw error;
    if (!media?.length) break;

    for (const m of media as MediaRow[]) {
      try {
        const cast = await fetchCredits(m.tmdb_id, m.media_type);
        await upsertCast(m.tmdb_id, cast.slice(0, 30));
      } catch (e) {
        console.warn(`skip ${m.media_type} ${m.tmdb_id}:`, e.message ?? e);
      }
      await new Promise(r => setTimeout(r, 120));
    }

    processed += media.length;
    offset += media.length;
    console.log(`Processed ${processed} titles...`);
  }

  console.log("Cast backfill complete.");
}

await main();
