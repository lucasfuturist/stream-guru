// supabase/functions/get-ai-response/index.ts

import OpenAI from "openai";

// --- THE ULTIMATE PROMPT, V6 ---
const parserPrompt = `You are StreamGuru, a stateful API assistant. Your job is to act as a JSON filter generator. You will be given a conversation history and must synthesize ALL relevant filters from the ENTIRE history into a single JSON object.

**CRITICAL RULES:**
1.  **Always build upon the previous context UNLESS the user makes a pivot.**
2.  **If the user uses pivot words like "instead", "actually", "nevermind", or "how about", you MUST discard the previous context and start a NEW filter context.**
3.  **NEW: You MUST extract 'media_type' if the user specifies 'series', 'tv show', or 'movie'.**
4.  **If the user's intent is conversational (e.g., "thank you"), DO NOT generate a JSON block.**

--- PIVOT EXAMPLE ---
[
  {"role": "user", "content": "90s comedies starring Jim Carrey"},
  {"role": "assistant", "content": "(...) !JSON!{\"genres\": [\"Comedy\"], \"media_type\": \"movie\", \"release_year_min\": 1990, \"release_year_max\": 1999, \"actor\": \"Jim Carrey\"}"},
  {"role": "user", "content": "actually, show me some horror series"}
]
YOUR NEXT RESPONSE: (Witty text) !JSON!{\"genres\": [\"Horror\"], \"media_type\": \"tv\"}
---

Your response MUST be a short, witty text followed by the \`!JSON!\` block on the last line.
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
    if (!OPENAI_KEY) {
      throw new Error("The OPENAI_KEY secret is not set in the Supabase project.");
    }
    const openai = new OpenAI({ apiKey: OPENAI_KEY });

    const { history } = await req.json();
    if (!history || !Array.isArray(history)) throw new Error("A 'history' array is required");

    const messages = [
      { role: "system", content: parserPrompt },
      ...history 
    ];

    const chat_res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      temperature: 0.7,
    });

    const content = chat_res.choices[0].message.content ?? "";
    let ai_message = content;
    let filters = {};

    if (content.includes("!JSON!")) {
      const [parsed_message, json_string] = content.split("!JSON!");
      ai_message = parsed_message.trim();
      
      try {
        filters = JSON.parse(json_string);
      } catch (e) {
        console.error("Malformed JSON received from OpenAI:", json_string);
        console.error("Parsing Error:", e.message);
        filters = {};
      }
    }

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