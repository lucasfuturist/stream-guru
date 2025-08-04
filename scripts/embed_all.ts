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