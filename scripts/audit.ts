// scripts/audit.ts
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { promises as fs } from "node:fs";
import path from "node:path";

// --- CONFIGURATION ---
const TARGET_QUERY_COUNT = 500;
const BATCH_SIZE = 10;
const API_DELAY_MS = 1000;

// --- CLIENTS ---
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ai = new OpenAI({ apiKey: process.env.OPENAI_KEY! });

// --- HELPERS ---
const readPrompt = (filename: string) => fs.readFile(path.join(Deno.cwd(), "scripts", "utils", filename), "utf-8");
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const clean = (str?: string | null) => (str ?? "").toLowerCase().trim();

// --- AI COACH PROMPT ---
const coachSys = `
You are a "vibe coach". Based on a user's query, poor recommendations, and an auditor's suggestion, you invent a broad, reusable vibe tag.
RETURN ONLY JSON: { "tag":"<1-2 words>", "genres":["relevant", "genres"], "reason":"why this tag helps" }
`.trim();

async function main() {
  console.log(`🚀 Starting Mega-Audit & Coaching Cycle. Target: ${TARGET_QUERY_COUNT} queries.`);
  
  let totalQueriesProcessed = 0;
  let totalVibesLogged = 0;
  
  // --- FIX #1: Keep track of queries we have already tested ---
  const testedQueries = new Set<string>();

  const inquisitorPrompt = await readPrompt("inquisitor_prompt.txt");
  const auditorPrompt = await readPrompt("auditor_prompt.txt");

  while (totalQueriesProcessed < TARGET_QUERY_COUNT) {
    console.log(`\n--- Starting new batch. Progress: ${totalQueriesProcessed}/${TARGET_QUERY_COUNT} ---`);

    // 1. INQUISITION
    console.log("  - Step 1: Generating new, unique test queries from Inquisitor...");
    
    // --- FIX #2: Create a dynamic prompt that tells the AI what to avoid ---
    const dynamicInquisitorPrompt = `
      ${inquisitorPrompt}

      CRITICAL: You are in a loop. Do NOT generate any of the following queries that have already been tested:
      ${JSON.stringify(Array.from(testedQueries))}
    `.trim();

    const iqResponse = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      // --- FIX #3: Increase the temperature to ensure creative, non-deterministic responses ---
      temperature: 0.9,
      messages: [ { role: "system", content: dynamicInquisitorPrompt } ],
      response_format: { type: "json_object" },
    });
    const { queries } = JSON.parse(iqResponse.choices[0].message.content!);
    console.log(`    - Generated ${queries.length} fresh queries for this batch.`);

    for (const [index, query] of (queries as string[]).entries()) {
      if (testedQueries.has(query)) {
        console.log(`\n  [Batch query ${index + 1}/${queries.length}] Skipping duplicate: "${query}"`);
        continue;
      }
      
      console.log(`\n  [Batch query ${index + 1}/${queries.length}] Testing: "${query}"`);
      testedQueries.add(query); // Add the new query to our set of tested ones

      // 2. EXECUTION, 3. AUDITING, 4. COACHING... (The rest of the loop is the same)
      const { data: recData, error: recError } = await sb.functions.invoke("get-recommendations", { body: { message: query } });
      if (recError) { console.error(`    - ❌ Error fetching recommendations:`, recError.message); continue; }
      const recommendations = recData.recommendations || [];
      const recommendationsForAudit = recommendations.map((r: any) => ({ title: r.title, genres: r.genres, release_date: r.release_date }));

      const auditResponse = await ai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "system", content: auditorPrompt }, { role: "user", content: JSON.stringify({ query, recommendations: recommendationsForAudit }) }],
        response_format: { type: "json_object" },
      });
      const { score, justification } = JSON.parse(auditResponse.choices[0].message.content!);
      console.log(`    - Audit Score: ${score}/5.`);

      if (score < 4) {
        const coachResponse = await ai.chat.completions.create({
          model: "gpt-4o",
          temperature: 0,
          messages: [{ role: "system", content: coachSys }, { role: "user", content: JSON.stringify({ query, recommendations: recommendationsForAudit, suggestion_from_auditor: justification }) }],
          response_format: { type: "json_object" },
        });
        try {
            const { tag, genres, reason } = JSON.parse(coachResponse.choices[0].message.content!);
            const vibe = clean(tag);
            if (vibe) {
                await sb.from("vibe_categories").insert({ session_id: crypto.randomUUID(), vibe_tag: vibe, genres: genres ?? [], examples: recommendations.map((r: any) => r.tmdb_id), notes: `[AUDITOR]: ${justification} [COACH]: ${reason}` });
                console.log(`    - ✅🧠 Coach logged new vibe: '${vibe}'`);
                totalVibesLogged++;
            }
        } catch (e) { console.warn("    - ⚠️ Coach returned malformed JSON, skipping.") }
      }
      totalQueriesProcessed++;
    }
    
    console.log(`\n--- Batch complete. Delaying for ${API_DELAY_MS / 1000}s... ---`);
    await delay(API_DELAY_MS); 
  }

  console.log("\n\n🎉🎉🎉 Mega-Audit Finished! 🎉🎉🎉");
  console.log(`- Total Queries Processed: ${totalQueriesProcessed}`);
  console.log(`- New Vibe Categories Logged: ${totalVibesLogged}`);
}

if (import.meta.main) {
  main().catch(console.error);
}