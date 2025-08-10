// scripts/generate_test_suite.ts
// A one-time script to create a standardized benchmark of test queries.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import OpenAI from "openai";
import { promises as fs } from "node:fs";
import path from "node:path";

const NUM_QUERIES = 50;
const OUTPUT_FILE = path.join(Deno.cwd(), "scripts", "utils", "test_queries.json");
const ai = new OpenAI({ apiKey: process.env.OPENAI_KEY! });

const inquisitorPrompt = `You are a creative movie-goer. Generate a list of ${NUM_QUERIES} DIVERSE AND COMPLEX test queries for a movie chatbot. They should test multiple constraints at once (genre, era, actor, vibe, negative constraints). Make them challenging. Respond with ONLY a JSON object: {"queries": [...]}`;

async function generate() {
    console.log(`Generating ${NUM_QUERIES} benchmark queries...`);
    const response = await ai.chat.completions.create({
        model: "gpt-4o", // Use the best model for this one-time generation
        temperature: 1.0,
        messages: [{ role: "system", content: inquisitorPrompt }],
        response_format: { type: "json_object" },
    });
    const content = response.choices[0].message.content!;
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(JSON.parse(content), null, 2));
    console.log(`✅ Benchmark suite saved to: ${OUTPUT_FILE}`);
}

generate().catch(console.error);