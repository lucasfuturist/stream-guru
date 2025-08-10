// scripts/prompt_tournament.ts
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { promises as fs } from "node:fs";
import path from "node:path";

// --- CONFIGURATION ---
const NUM_QUERIES_TO_TEST = 50;
const API_DELAY_MS = 250; // A smaller delay as we aren't saving to DB in a loop

// --- CLIENTS ---
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ai = new OpenAI({ apiKey: process.env.OPENAI_KEY! });

// --- HELPER ---
const readPrompt = (filename: string) => fs.readFile(path.join(Deno.cwd(), "scripts", "utils", filename), "utf-8");
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// =================================================================================
// --- THE 5 PROMPT CHALLENGERS ---
// We will test these 5 different system prompts to see which is best at parsing.
// =================================================================================
const contenderPrompts = [
  // --- Prompt 1: The "Simple & Direct" ---
  `You are an API that converts user text into a JSON filter object. Extract genres, actors, release years, and media types (movie or tv). Your response must ONLY be the raw JSON.`,

  // --- Prompt 2: The "Strict Role-Player" ---
  `You are StreamGuru, a stateful API assistant. Your job is to act as a JSON filter generator. Synthesize ALL relevant filters from the user's query into a single JSON object. If the user's intent is conversational, return an empty JSON object.`,

  // --- Prompt 3: The "Few-Shot Learner" (with examples) ---
  `You are an expert query parser. Your task is to convert natural language into a structured JSON filter object.
--- EXAMPLES ---
User: "Show me 90s action movies starring Bruce Willis"
JSON: {"genres": ["Action"], "media_type": "movie", "release_year_min": 1990, "release_year_max": 1999, "actor": "Bruce Willis"}
User: "I want a funny show that's not too long"
JSON: {"genres": ["Comedy"], "media_type": "tv", "max_runtime": 100}
--- END EXAMPLES ---
Now, parse the user's request. Return ONLY the JSON.`,

  // --- Prompt 4: The "Rule-Follower" ---
  `Your task is to generate a JSON filter object based on the user's request.
CRITICAL RULES:
1. Extract 'media_type' if the user specifies 'series', 'tv show', or 'movie'.
2. If the user gives a decade like "80s", set release_year_min to 1980 and release_year_max to 1989.
3. If the user says "not too long", set max_runtime to 100 minutes.
4. ONLY return the JSON object.`,

  // --- Prompt 5: The "Kitchen Sink" (combines multiple strategies) ---
  `You are StreamGuru, a stateful API assistant acting as a JSON filter generator. Synthesize filters into a single JSON object.
RULES:
- 'series' or 'tv show' -> "media_type": "tv"
- 'movie' -> "media_type": "movie"
- Decade (e.g., "70s") -> min/max release year
EXAMPLE:
User: "A sci-fi series from the 90s"
JSON: {"genres": ["Science Fiction"], "media_type": "tv", "release_year_min": 1990, "release_year_max": 1999}
Return ONLY the JSON. If the query is conversational, return {}.`
];

// =================================================================================
// --- THE AI JUDGES ---
// =================================================================================

const inquisitorPrompt = `
You are a creative movie-goer. Generate a list of ${NUM_QUERIES_TO_TEST} DIVERSE AND COMPLEX test queries for a movie recommendation chatbot.
These queries should test multiple constraints at once (e.g., genre + era + actor + vibe).
Make them challenging.
You MUST respond with ONLY a JSON object containing a single key "queries", which is an array of ${NUM_QUERIES_TO_TEST} strings.
`.trim();

const validatorPrompt = `
You are a meticulous parsing validator. You will be given an original user query and the JSON filter object that an AI generated from it.
Your task is to score how accurately the JSON represents the query's constraints.
- **5:** Perfect. All constraints (genre, actor, era, type, vibes) are captured flawlessly.
- **4:** Minor miss. Almost perfect, but missed one subtle detail.
- **3:** Decent. Captured the main genre/idea but missed several other constraints.
- **2:** Poor. It only vaguely understood the query.
- **1:** Terrible. The JSON has almost no relation to the query.

Respond with ONLY a JSON object: {"score": <1-5>, "reason": "A brief justification for your score."}
`.trim();

// =================================================================================
// --- THE TOURNAMENT LOGIC ---
// =================================================================================

async function main() {
  console.log("🏆 Welcome to the Prompt Tournament! 🏆");
  console.log(`Each of the ${contenderPrompts.length} prompts will be tested against the same ${NUM_QUERIES_TO_TEST} queries.`);

  // 1. Create the Arena: Generate one master list of test queries
  console.log("\n STEP 1: The Inquisitor is generating the test queries for the tournament...");
  const iqResponse = await ai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 1.0,
    messages: [{ role: "system", content: inquisitorPrompt }],
    response_format: { type: "json_object" },
  });
  const { queries: testQueries } = JSON.parse(iqResponse.choices[0].message.content!);
  console.log(`   - ✅ The ${testQueries.length} queries have been generated.`);
  
  const tournamentResults: Record<number, { totalScore: number; runs: number; average: number }> = {};

  // 2. Run the Gauntlet for each prompt
  for (let i = 0; i < contenderPrompts.length; i++) {
    const currentPrompt = contenderPrompts[i];
    console.log(`\n\n🥊 NOW TESTING PROMPT #${i + 1} 🥊`);
    tournamentResults[i] = { totalScore: 0, runs: 0, average: 0 };
    
    for (const query of testQueries) {
      try {
        // PARSE the query using the current contender prompt
        const parserResponse = await ai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: currentPrompt },
            { role: "user", content: query },
          ],
          response_format: { type: "json_object" },
        });
        const parsedFilters = JSON.parse(parserResponse.choices[0].message.content!);

        // VALIDATE the parse
        const validatorResponse = await ai.chat.completions.create({
            model: "gpt-4o-mini", // Use a cheaper model for validation
            messages: [
                { role: "system", content: validatorPrompt },
                { role: "user", content: JSON.stringify({ original_query: query, generated_json: parsedFilters })}
            ],
            response_format: {type: "json_object"}
        });
        const { score, reason } = JSON.parse(validatorResponse.choices[0].message.content!);
        
        tournamentResults[i].totalScore += score;
        tournamentResults[i].runs++;

        await delay(API_DELAY_MS);
      } catch (err) {
        console.error(`  - ❌ Error during test for query "${query}":`, err.message);
      }
    }
    
    // 3. The Reflection for the current prompt
    if (tournamentResults[i].runs > 0) {
      tournamentResults[i].average = tournamentResults[i].totalScore / tournamentResults[i].runs;
    }
    console.log(`\n--- REFLECTION FOR PROMPT #${i + 1} ---`);
    console.log(`  - Total Score: ${tournamentResults[i].totalScore}`);
    console.log(`  - Average Score: ${tournamentResults[i].average.toFixed(2)} / 5.00`);
    console.log(`----------------------------------`);
  }
  
  // 4. Declare the Champion
  console.log("\n\n🎉🎉🎉 TOURNAMENT COMPLETE! 🎉🎉🎉");
  console.log("Final scores for all contender prompts:");
  let bestScore = -1;
  let winnerIndex = -1;

  for (const index in tournamentResults) {
    const result = tournamentResults[index];
    console.log(`- Prompt #${parseInt(index) + 1}: Average Score = ${result.average.toFixed(2)}`);
    if (result.average > bestScore) {
      bestScore = result.average;
      winnerIndex = parseInt(index);
    }
  }

  console.log("\n===================================");
  console.log(`🥇 The Winning Prompt is... PROMPT #${winnerIndex + 1} with a score of ${bestScore.toFixed(2)}!`);
  console.log("===================================");
  console.log("\nWinning Prompt Text:\n---");
  console.log(contenderPrompts[winnerIndex]);
  console.log("---\n");

}

if (import.meta.main) {
  main().catch(console.error);
}