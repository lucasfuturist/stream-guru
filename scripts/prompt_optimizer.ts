// scripts/prompt_optimizer.ts
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import OpenAI from "openai";
import { promises as fs } from "node:fs";
import path from "node:path";

// --- PRODUCTION-READY CONFIGURATION ---
const POPULATION_FILE = path.join(Deno.cwd(), "scripts", "utils", "prompt_population.json");
const ARCHIVE_FILE = path.join(Deno.cwd(), "scripts", "utils", "prompt_archives.json");
const TEST_SUITE_FILE = path.join(Deno.cwd(), "scripts", "utils", "test_queries.json");
const API_TIMEOUT_MS = 45000;
const DELAY_PER_TEST_MS = 1000;

// --- DEDICATED CLIENTS ---
const parserAI = new OpenAI({ apiKey: process.env.OPENAI_KEY!, timeout: API_TIMEOUT_MS });
const validatorAI = new OpenAI({ apiKey: process.env.OPENAI_KEY!, timeout: API_TIMEOUT_MS });
const mutatorAI = new OpenAI({ apiKey: process.env.OPENAI_KEY!, timeout: API_TIMEOUT_MS });

// --- HELPERS ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
type PromptObject = { name: string; prompt: string; score?: number };

// --- AI PERSONAS ---
const validatorSystemPrompt = `You are a meticulous parsing validator. You will be given a user query and the JSON an AI generated from it. Your task is to score how accurately the JSON represents ALL of the query's constraints. Score 1-5 (5 is perfect). Respond ONLY with a JSON object containing a single key "score" with the integer value. Example: {"score": 5}`;
const mutatorSystemPrompt = `
You are an expert AI Prompt Engineer, acting as a genetic algorithm's mutation function. Your goal is to create a **meaningfully different and potentially superior** version of the given 'Champion Prompt'.

**CRITICAL RULES:**
1.  You must introduce a significant, intelligent change, like adding a new example, a new rule, or changing the persona.
2.  Your output **MUST** be a single JSON object with two keys: "name" (a short, creative, descriptive name for your new prompt, like "Chain-of-Thought Persona") and "prompt" (the full text of the new prompt).
3.  Your new prompt **MUST** be different from all prompts in the 'Archive of Previously Tested Prompts'.

--- EXAMPLE OF YOUR TASK ---
[Input Champion Prompt]: "You are a parser. --- EXAMPLE --- User: 'Query A' JSON: {'A'}"
[Your CORRECT JSON Output]:
{
  "name": "Added Example B",
  "prompt": "You are a parser. --- EXAMPLE --- User: 'Query A' JSON: {'A'} User: 'Query B' JSON: {'B'}"
}
---

Now, perform this task on the following Champion Prompt. Return ONLY the JSON object.
`.trim();

// --- TIMEOUT WRAPPER ---
async function withTimeout(promise: Promise<any>, ms: number) {
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`API call timed out after ${ms / 1000} seconds.`)), ms)
    );
    return Promise.race([promise, timeout]);
}

async function main() {
    console.log("[START] Welcome to the Intelligent Prompt Optimizer!");
    
    const testQueries: string[] = JSON.parse(await fs.readFile(TEST_SUITE_FILE, "utf-8")).queries;
    const currentPopulation: PromptObject[] = JSON.parse(await fs.readFile(POPULATION_FILE, "utf-8"));
    let archive: PromptObject[] = [];
    try { archive = JSON.parse(await fs.readFile(ARCHIVE_FILE, "utf-8")); } catch (e) { console.log("[INFO] Archive file not found, will create a new one."); }
    console.log(`[INFO] Loaded ${currentPopulation.length} prompts to test from population.`);
    console.log(`[INFO] Loaded ${testQueries.length} benchmark queries.`);

    const results: PromptObject[] = [];

    for (const [i, promptObj] of currentPopulation.entries()) {
        console.log(`\n[BEGIN TEST] Prompt #${i + 1}: "${promptObj.name}"`);
        let totalScore = 0;
        let successfulTests = 0;

        for (const [index, query] of testQueries.entries()) {
            const queryPreview = query.length > 60 ? `${query.substring(0, 57)}...` : query;
            console.log(`  [ATTEMPT] Test ${String(index + 1).padStart(2)}/${testQueries.length} | Query: "${queryPreview}"`);
            
            let singleScore = 0;
            try {
                const currentDate = new Date().toISOString().split('T')[0];
                const dynamicSystemPrompt = `For your reference, the current date is ${currentDate}.\n\n${promptObj.prompt}`;

                console.log(`    [API_CALL] Sending query to Parser AI (gpt-4o)...`);
                const parsedResponse: any = await withTimeout(
                    parserAI.chat.completions.create({
                        model: "gpt-4o",
                        // --- THIS IS THE FIX ---
                        messages: [{ role: "system", content: dynamicSystemPrompt }, { role: "user", content: query }],
                        // --- END OF FIX ---
                        response_format: { type: "json_object" },
                    }),
                    API_TIMEOUT_MS
                );

                const parsedFilters = JSON.parse(parsedResponse.choices[0].message.content!);
                console.log(`    [PARSED_JSON] ${JSON.stringify(parsedFilters)}`);

                const validationResponse: any = await withTimeout(
                    validatorAI.chat.completions.create({
                        model: "gpt-4o",
                        messages: [{ role: "system", content: validatorSystemPrompt }, { role: "user", content: JSON.stringify({ query, json_result: parsedFilters }) }],
                        response_format: { type: "json_object" }
                    }),
                    API_TIMEOUT_MS
                );
                
                const scoreContent = validationResponse.choices[0].message.content!;
                let scoreMatch = scoreContent.match(/\d+/);
                if (scoreMatch) {
                    singleScore = parseInt(scoreMatch[0]);
                } else {
                    console.warn(`    [WARN] Validator returned a non-numeric score: "${scoreContent}". Defaulting to 0.`);
                    singleScore = 0;
                }
                
                console.log(`    [SCORE] Validator returned a score of: ${singleScore}/5`);
                successfulTests++;

            } catch (err) {
                console.error(`    [FATAL_ERROR] Test ${String(index + 1).padStart(2)} FAILED. Error: ${err.message}`);
            }
            
            totalScore += singleScore;
            await delay(DELAY_PER_TEST_MS);
        }
        
        promptObj.score = successfulTests > 0 ? totalScore / successfulTests : 0;
        results.push(promptObj);
        console.log(`  [OVERALL_SCORE] Prompt #${i + 1} achieved an Average Score of: ${promptObj.score.toFixed(3)} / 5.00`);
    }

    results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const champion = results[0];

    console.log("\n\n---[FINAL REPORT]---");
    console.log("-------------------------------------------------");
    console.log("| Rank | Score   | Prompt Name                   |");
    console.log("-------------------------------------------------");
    results.forEach((r, i) => {
        const rank = `#${i + 1}`.padEnd(5);
        const score = (r.score ?? 0).toFixed(3).padEnd(8);
        const name = r.name.padEnd(30);
        console.log(`| ${rank}| ${score}| ${name} |`);
    });
    console.log("-------------------------------------------------");
    
    console.log("\n[ARCHIVING] Moving tested prompts to archive...");
    const updatedArchive = [...archive, ...currentPopulation];
    await fs.writeFile(ARCHIVE_FILE, JSON.stringify(updatedArchive, null, 2));
    console.log("[ARCHIVING] Complete.");

    console.log("[MUTATING] Creating new generation based on the champion...");
    const dynamicMutatorPrompt = `${mutatorSystemPrompt}\n\n--- Champion Prompt ---\n${champion.prompt}\n\n--- Archive of Previously Tested Prompts ---\n${JSON.stringify(archive.map(p => p.prompt))}`;
    
    const nextGeneration: PromptObject[] = [champion];
    for (let i = 0; i < currentPopulation.length - 1; i++) {
        try {
            const mutationResponse = await mutatorAI.chat.completions.create({ 
                model: "gpt-4o", 
                temperature: 1.0, 
                messages: [{ "role": "system", "content": dynamicMutatorPrompt }],
                response_format: { type: "json_object" }
            });
            const newPromptObject = JSON.parse(mutationResponse.choices[0].message.content!);
            nextGeneration.push({
                name: newPromptObject.name,
                prompt: newPromptObject.prompt
            });
        } catch (err) {
            console.error(`[MUTATION_ERROR] Failed to create mutation #${i + 1}. Error: ${err.message}`);
            nextGeneration.push({name: `Failed_Mutation_${i+1}`, prompt: champion.prompt});
        }
    }
    
    console.log("[SAVING] Saving new generation to 'prompt_population.json'...");
    await fs.writeFile(POPULATION_FILE, JSON.stringify(nextGeneration, null, 2));
    console.log("[SAVING] Complete.");
    
    console.log("\n\n[COMPLETE] OPTIMIZATION RUN COMPLETE!");
    console.log("Ready to evolve the next generation. Run the PowerShell script again to continue.");
    console.log("\nChampion from this run:\n---");
    console.log(champion.prompt);
    console.log("---");
}

main().catch(console.error);