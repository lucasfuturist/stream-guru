// scripts/ping_validator.ts
// A dedicated script to test the connection and response time of the Validator AI.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import OpenAI from "openai";

const ai = new OpenAI({ apiKey: process.env.OPENAI_KEY! });
const TIMEOUT_MS = 30000; // 30 seconds

const validatorSystemPrompt = `You are a meticulous parsing validator. You will be given a user query and the JSON an AI generated from it. Your task is to score how accurately the JSON represents ALL of the query's constraints. Score 1-5 (5 is perfect). Respond ONLY with the integer score.`;

// A realistic, hardcoded payload for the test.
const testUserContent = JSON.stringify({
    query: "Show me a romantic comedy from the 90s not starring Julia Roberts.",
    json_result: {
        "media_type": "movie",
        "genres": ["Romance", "Comedy"],
        "release_year_min": 1990,
        "release_year_max": 1999,
        "not_actor_name": "Julia Roberts"
    }
});

async function main() {
    console.log("[INFO] Attempting to call the Validator AI (gpt-4o-mini)...");
    console.log("[INFO] This will time out after 30 seconds if no response is received.");

    try {
        const apiCall = ai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: validatorSystemPrompt },
                { role: "user", content: testUserContent }
            ],
            response_format: { type: "json_object" }
        });

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`API call timed out after ${TIMEOUT_MS / 1000} seconds.`)), TIMEOUT_MS)
        );

        // Promise.race will resolve with whichever promise finishes first.
        const result: any = await Promise.race([apiCall, timeoutPromise]);

        console.log("\n[SUCCESS] Validator AI responded successfully!");
        console.log("[RESPONSE]:", result.choices[0].message.content);

    } catch (err) {
        console.error("\n[FAILURE] The diagnostic test failed.");
        console.error("[ERROR]:", err.message);
    }
}

main();