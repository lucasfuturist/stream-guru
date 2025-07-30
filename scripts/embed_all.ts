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
    const { data: rows, error } = await supabase
      .from("media")
      .select("id, title, synopsis, genres")
      .is("embedding", null)
      .limit(BATCH_SIZE);

    if (error) throw error;
    if (!rows.length) {
      console.log("✅ All rows embedded.");
      return;
    }

    const inputs = rows.map(
      (r) => `${r.title}. ${r.synopsis}. genres: ${r.genres.join(", ")}`
    );

    let resp;
    // Step 1: Fetch embeddings from OpenAI (with retry)
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
    
    // Step 2: Prepare the payload for our new RPC function
    const updates = rows.map((row, i) => ({
      id_to_update: row.id,
      embedding_vector: `[${resp.data[i].embedding.join(",")}]`
    }));

    // Step 3: Call the RPC function to update the entire batch at once (with retry)
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`Attempting to save ${updates.length} embeddings via RPC (Attempt ${attempt}/${MAX_RETRIES})...`);
            // This single line replaces the entire upsert loop
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