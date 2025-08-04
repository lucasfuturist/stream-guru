// supabase/functions/auditor/index.ts

import OpenAI from "openai";

// --- CORRECTED: Pass the API key from environment variables ---
const ai = new OpenAI({ apiKey: Deno.env.get("OPENAI_KEY")! });

// --- UPGRADED PROMPT ---
const auditorSystemPrompt = `
You are a Quality Assurance bot. Your job is to analyze a user's query and the movie recommendations provided by another AI.
You must determine if the recommendations are a good, specific match for the query.

- If the query is specific and the recommendations list contains relevant movies, the response is GOOD ("ok": true).
- If the query is a vague vibe (e.g., "I'm sad"), the response is NOT OK. Invent 1-3 specific, creative "vibe tags" to help the user.
- **CRITICAL RULE: If the recommendations list is EMPTY for a specific, reasonable query (like "sci-fi"), the response is NOT OK. Invent vibe tags that could broaden or improve the search.**

You MUST reply with JSON only, matching this exact format:
{
  "ok": boolean,
  "vibes": [
    { "tag": "your invented vibe tag", "genres": ["relevant", "genres"], "reason": "a brief explanation" }
  ]
}

EXAMPLE 1: GOOD RESPONSE
User Query: "Show me some Tom Hanks comedies"
Recommendations: ["Forrest Gump", "Big", "Toy Story"]
Your output:
{
  "ok": true,
  "vibes": []
}

EXAMPLE 2: EMPTY LIST FOR A GOOD QUERY - BAD RESPONSE
User Query: "sci-fi"
Recommendations: []
Your output:
{
  "ok": false,
  "vibes": [
    { "tag": "Epic Space Opera", "genres": ["Science Fiction", "Adventure"], "reason": "For grand, galaxy-spanning adventures." },
    { "tag": "Dystopian Futures", "genres": ["Science Fiction", "Thriller"], "reason": "For thought-provoking stories about societal collapse." }
  ]
}
`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // --- CORRECTED: Ensure OPENAI_KEY is checked before use ---
    const OPENAI_KEY = Deno.env.get("OPENAI_KEY");
    if (!OPENAI_KEY) {
      throw new Error("The OPENAI_KEY secret is not set in the Supabase project.");
    }

    const { userQuery, chatbotResp } = await req.json();

    const audit = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: auditorSystemPrompt },
        {
          role: "user",
          content: JSON.stringify({ query: userQuery, recs: chatbotResp.recs })
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(audit.choices[0].message.content!);

    return new Response(
      JSON.stringify(result),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Auditor function error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});