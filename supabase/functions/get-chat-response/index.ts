// supabase/functions/get-chat-response/index.ts
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// Your proven client initialization
const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const ai = new OpenAI({ apiKey: Deno.env.get("OPENAI_KEY")! });

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const { history } = await req.json();
    if (!history || !Array.isArray(history)) {
      throw new Error("Chat history is required and must be an array");
    }

    // --- THE FINAL, STATEFUL PROMPT (v12) ---
    // This prompt teaches the AI to remember the entire conversation.
    const parserPrompt = `
You are a stateful API assistant. Your job is to act as a JSON filter generator. You will be given a conversation history and must synthesize ALL relevant filters from the ENTIRE history into a single JSON object.

**CRITICAL RULES:**
1.  **Always build upon the previous context.** If the user asks for "westerns" and then says "from the 21st century," your final JSON must include BOTH constraints.
2.  **Handle Pivots:** If the user uses pivot words like "instead" or "actually", you MUST discard the previous context and start a NEW filter set.
3.  **Schema and Formatting:** Output a single, raw JSON object. Omit unused keys. Use "Animation", not "Animated". Capitalize genres.

--- TARGET SCHEMA ---
{
  "media_type": "movie" | "tv",
  "genres": ["..."],
  "not_genres": ["..."],
  "actor_name": "...",
  "release_year_min": 1990,
  "release_year_max": 1999,
  "theme_analysis": "..."
}
--- END SCHEMA ---

--- CONVERSATION EXAMPLE ---
[
  {"role": "user", "content": "western movies"},
  {"role": "assistant", "content": "(... a list of westerns ...)"},
  {"role": "user", "content": "only from the 21st century"}
]
YOUR FINAL JSON:
{
  "media_type": "movie",
  "genres": ["Western"],
  "release_year_min": 2000
}
--- END CONVERSATION EXAMPLE ---
`;

    // First, parse the user's request into structured filters
    const parserResponse = await ai.chat.completions.create({
      // --- UPGRADED MODEL: GPT-4o-mini is required for reliable stateful conversation ---
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: parserPrompt },
        // --- CRITICAL CHANGE: The entire history is sent to the parser for context ---
        ...history
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    let filters = {};
    try {
      const parserOutput = parserResponse.choices[0].message.content;
      filters = JSON.parse(parserOutput!);
      console.log("Stateful Parsed Filters:", filters);
    } catch (err) {
      console.error("Failed to parse filters:", err);
      filters = {}; // Fallback to empty filters on error
    }

    // The logic for generating the conversational prose remains the same,
    // but we use the faster model for efficiency.
    const lastUserPrompt = history[history.length - 1].content;
    const chatResponse = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are StreamGuru, a friendly movie and TV show recommendation assistant. 
          Keep responses brief (2-3 sentences). Be conversational and helpful.
          Don't list specific movies.
          If the user asks for "more" results, acknowledge that you're showing more.`
        },
        { role: "user", content: lastUserPrompt } // The prose only needs the last message
      ],
      temperature: 0.7,
    });

    const prose = chatResponse.choices[0].message.content || "I'm not sure what to recommend.";

    return new Response(JSON.stringify({ prose, filters }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Chat Response Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});