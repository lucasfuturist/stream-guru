// scripts/refresh_all.ts
// Refresh ALL rows in `media` by calling the tmdb-import edge function in chunks.
// Env required: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// Optional tuning via env: CHUNK_SIZE, CONCURRENCY, MAX_ROWS, DRY_RUN=true

import "jsr:@std/dotenv/load";
import { delay } from "jsr:@std/async/delay";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const ANON          = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
if (!SUPABASE_URL || !ANON || !SERVICE_ROLE) {
  throw new Error("Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
}

const REST = `${SUPABASE_URL}/rest/v1`;
const FN   = `${SUPABASE_URL}/functions/v1`;
const CHUNK_SIZE   = Number(Deno.env.get("CHUNK_SIZE") ?? 200);   // items per tmdb-import call
const CONCURRENCY  = Number(Deno.env.get("CONCURRENCY") ?? 6);    // concurrent tmdb-import calls
const MAX_ROWS     = Deno.env.get("MAX_ROWS") ? Number(Deno.env.get("MAX_ROWS")) : undefined; // cap for testing
const DRY_RUN      = (Deno.env.get("DRY_RUN") ?? "false").toLowerCase() === "true";

type Row = { tmdb_id: number; media_type: "movie" | "tv" };

// --- REST helpers (PostgREST) ---
async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${REST}${path}`, {
    ...init,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      ...(init.headers ?? {})
    }
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`REST ${r.status}: ${t}`);
  }
  return r.json() as Promise<T>;
}

async function listAllIds(): Promise<Row[]> {
  const pageSize = 1000;
  let from = 0;
  let results: Row[] = [];
  for (;;) {
    const to = from + pageSize - 1;
    const qs = new URLSearchParams({
      select: "tmdb_id,media_type",
      order: "tmdb_id.asc",
      limit: String(pageSize),
      offset: String(from)
    });
    const batch = await rest<Row[]>(`/media?${qs.toString()}`);
    if (!batch.length) break;
    results = results.concat(batch);
    from += pageSize;
    if (MAX_ROWS && results.length >= MAX_ROWS) {
      results = results.slice(0, MAX_ROWS);
      break;
    }
    // small pause to be nice to PostgREST
    await delay(50);
  }
  return results;
}

// --- Functions helper (tmdb-import) ---
async function tmdbImport(items: { type: "movie" | "tv"; id: number }[]) {
  const r = await fetch(`${FN}/tmdb-import`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${SERVICE_ROLE}`, // upsert needs service role
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ items, concurrency: 4 }),
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`tmdb-import ${r.status}: ${text}`);
  }
  try {
    return JSON.parse(text) as { imported: number; failed: number; results: any[] };
  } catch {
    throw new Error(`tmdb-import parse error: ${text}`);
  }
}

// --- chunk runner with retries/backoff ---
async function runChunks(all: Row[]) {
  let imported = 0, failed = 0, idx = 0;

  const mkChunk = (start: number, size: number) =>
    all.slice(start, start + size).map(r => ({ type: r.media_type, id: r.tmdb_id }));

  // queue of chunk start indices
  const starts: number[] = [];
  for (let i = 0; i < all.length; i += CHUNK_SIZE) starts.push(i);

  async function worker(name: string) {
    while (starts.length) {
      const start = starts.shift()!;
      const items = mkChunk(start, CHUNK_SIZE);

      if (DRY_RUN) {
        console.log(`[${name}] DRY_RUN chunk @${start}: ${items.length} items`);
        continue;
      }

      // retry up to 3x with backoff
      let attempt = 0;
      for (;;) {
        attempt++;
        try {
          const res = await tmdbImport(items);
          imported += res.imported;
          failed   += res.failed;
          idx      += items.length;
          // summarize any failures briefly
          if (res.failed) {
            const firstErr = res.results.find(x => x.ok === false)?.error;
            console.warn(`[${name}] chunk @${start} -> imported=${res.imported}, failed=${res.failed} ${firstErr ? `| firstErr=${String(firstErr).slice(0,120)}...` : ""}`);
          } else {
            console.log(`[${name}] chunk @${start} ok (${res.imported}/${items.length}) | progress ${idx}/${all.length}`);
          }
          break; // success
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn(`[${name}] tmdb-import error (attempt ${attempt}): ${msg}`);
          if (attempt >= 3) {
            failed += items.length;
            break;
          }
          await delay(500 * attempt);
        }
      }

      await delay(50);
    }
  }

  const workers = Array.from({ length: Math.max(1, CONCURRENCY) }, (_, i) => worker(`W${i+1}`));
  await Promise.all(workers);
  return { imported, failed };
}

// --- main ---
(async () => {
  console.log(`🚀 Refresh ALL — via tmdb-import
CHUNK_SIZE=${CHUNK_SIZE}  CONCURRENCY=${CONCURRENCY}  DRY_RUN=${DRY_RUN}  MAX_ROWS=${MAX_ROWS ?? "∞"}`);

  const all = await listAllIds();
  if (!all.length) {
    console.log("Nothing to refresh (media is empty).");
    return;
  }
  console.log(`Found ${all.length} rows to refresh.`);

  const t0 = Date.now();
  const { imported, failed } = await runChunks(all);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  const { error: analyzeErr } = await supabase.rpc("run_sql", {
    sql: "ANALYZE public.media"
  });
  if (analyzeErr) console.error("ANALYZE failed", analyzeErr);


  console.log(`\n✅ Done in ${secs}s  |  imported=${imported}  failed=${failed}`);
})();
