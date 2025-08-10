// supabase/functions/get-ai-response/index.ts

import OpenAI from "openai";

// --- THE FINAL, PRODUCTION-READY PROMPT (v7) ---
const parserPrompt = `
You are a master query parser. Your sole mission is to deconstruct a user's natural language request into a precise JSON object that will be used to query a movie and TV show database.

**CRITICAL RULES:**
1.  Your output **MUST** be a single, raw JSON object. Do not include any conversational text, explanations, or markdown formatting.
2.  Analyze the user's query for both "Hard Constraints" (specific filters) and "Soft Constraints" (thematic vibes).
3.  Populate the JSON object according to the schema below. If a constraint is not mentioned, omit the key from the JSON.
4.  For "Soft Constraints," generate a concise \`theme_analysis\` string that captures the essence of the user's desired feeling or concept. This is critical for semantic matching.

--- TARGET SCHEMA ---
{
  "media_type": "movie" | "tv",
  "genres": ["Genre1", "Genre2"],
  "not_genres": ["GenreToExclude"],
  "actor_name": "Actor Name",
  "not_actor_name": "ActorToExclude",
  "director_name": "Director Name",
  "not_director_name": "DirectorToExclude",
  "release_year_min": YYYY,
  "release_year_max": YYYY,
  "max_runtime": Minutes,
  "spoken_language": "Language",
  "theme_analysis": "A concise summary of the user's abstract request, like 'a story about redemption and unlikely friendship' or 'a mind-bending plot with a philosophical twist'."
}
--- END SCHEMA ---

--- EXAMPLES ---
User: "Show me a romantic comedy from the 90s not starring Julia Roberts, with a plot set during a road trip."
JSON:
{
  "media_type": "movie",
  "genres": ["Romance", "Comedy"],
  "release_year_min": 1990,
  "release_year_max": 1999,
  "not_actor_name": "Julia Roberts",
  "theme_analysis": "A love story that unfolds during a road trip."
}

User: "I want a psychological drama from the last decade featuring a single father, but not set in an urban environment."
JSON:
{
    "genres": ["Drama", "Psychological"],
    "release_year_min": 2015,
    "release_year_max": 2025,
    "theme_analysis": "A psychological drama about a single father in a non-urban setting."
}
--- END EXAMPLES ---
`;

// --- NEW CHAT PROMPT ---
const chatPrompt = `
You are StreamGuru, a witty and passionate movie expert. You will be given a user's prompt. Your task is to write a short, engaging, and fun response that introduces the recommendations you're about to show them.

**RULES:**
- Keep it brief (1-3 sentences).
- Your tone should be charismatic, not robotic.
- **DO NOT** mention specific movie titles. The UI will display the titles separately.
- **DO NOT** output JSON. Just return the conversational text.

--- EXAMPLES ---
User Prompt: "Show me some Tom Hanks comedies"
Your Response: "Say no more! I've lined up some classic Tom Hanks laugh-fests for you. Get ready for some serious feel-good vibes."

User Prompt: "A modern horror film with a comedic twist, avoiding any supernatural elements"
Your Response: "Ooh, a tricky one! I love a good scare that keeps it real. Here are some terrifyingly funny picks that stay grounded in reality."
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
    const OPENAI_KEY = Deno.env.get("OPENAI_KEY");
    if (!OPENAI_KEY) throw new Error("OPENAI_KEY is not set.");
    const openai = new OpenAI({ apiKey: OPENAI_KEY });

    const { history } = await req.json();
    if (!history || !Array.isArray(history)) throw new Error("A 'history' array is required");

    const lastUserPrompt = history[history.length - 1].content;

    // --- PARALLEL AI CALLS for SPEED ---
    const [parserResponse, chatResponse] = await Promise.all([
      // Call 1: The Parser AI to get structured JSON
      openai.chat.completions.create({
        // --- THIS IS THE FIX ---
        model: "gpt-4o-mini", // Use the faster model to prevent timeouts
        messages: [{ role: "system", content: parserPrompt }, ...history],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
      // Call 2: The Chat AI to get the witty prose
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: chatPrompt }, { role: "user", content: lastUserPrompt }],
        temperature: 0.8,
      })
    ]);

    const filters = JSON.parse(parserResponse.choices[0].message.content!);
    const ai_message = chatResponse.choices[0].message.content!;

    return new Response(JSON.stringify({ ai_message, filters }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});