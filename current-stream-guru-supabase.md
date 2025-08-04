
📁 Tree for: C:\projects\stream-guru\supabase
----------------------------------------
supabase
+-- .temp
|   +-- cli-latest
|   +-- gotrue-version
|   +-- pooler-url
|   +-- postgres-version
|   +-- project-ref
|   +-- rest-version
|   L-- storage-version
+-- functions
|   +-- audit-train
|   |   +-- deno.json
|   |   L-- index.ts
|   +-- auditor
|   |   +-- deno.json
|   |   L-- index.ts
|   +-- chat-final
|   |   +-- deno.json
|   |   L-- index.ts
|   +-- chat-session
|   |   +-- deno.json
|   |   L-- index.ts
|   +-- chatbot
|   |   +-- deno.json
|   |   L-- index.ts
|   +-- dict-train
|   |   +-- deno.json
|   |   L-- index.ts
|   +-- filter-media
|   |   +-- deno.json
|   |   L-- index.ts
|   +-- get-ai-response
|   |   +-- deno.json
|   |   L-- index.ts
|   +-- get-details
|   |   +-- deno.json
|   |   L-- index.ts
|   +-- get-recommendations
|   |   +-- deno.json
|   |   L-- index.ts
|   +-- search-media
|   |   +-- deno.json
|   |   L-- index.ts
|   L-- trending
|       +-- deno.json
|       L-- index.ts
+-- migrations
|   L-- 20250802015421_remote_schema.sql
L-- migrations_backup
    L-- migrations
        +-- 20250728_initial.sql
        L-- 20250730135401_create_embedding_update_function.sql

📜 Listing scripts with extensions: .ts, .txt, .tsx, .js, .jsx, .py, .html, .json, .css, .sql, .toml, .ps1
----------------------------------------

### deno.json

{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2",
    "openai": "npm:openai@4"
  }
}

### index.ts

// ------------------------------------------------------------
// audit-train edge function – runs in Supabase, no local script
// ------------------------------------------------------------

import { createClient } from "npm:@supabase/supabase-js@2.53.0";
import OpenAI from "npm:openai@5.10.2";

// ---------- env ------------------------------------------------
const sb  = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const ai  = new OpenAI({ apiKey: Deno.env.get("OPENAI_KEY")! });

// ---------- static prompts ------------------------------------
const inquisitorPrompt = `respond ONLY with a JSON array of 10 diverse movie-search phrases`;
const auditorPrompt    = `return {"score":1-5,"suggestion":""}`;
const coachPrompt      = `return {"keyword":"x","phrases":["y","z"]} or {"keyword":null,"phrases":[]}`;

// ---------- helper --------------------------------------------
async function chat(
  prompt: string | OpenAI.ChatCompletionMessageParam[]
): Promise<string> {
  const messages = Array.isArray(prompt)
    ? prompt
    : [{ role: "user", content: prompt }];

  const resp = await ai.chat.completions.create({
    model: "gpt-4o-mini",
    messages
  });
  return resp.choices[0].message.content!;
}

// ---------- function entry ------------------------------------
Deno.serve(async () => {
  // 1) generate 10 test queries
  const queries: string[] = JSON.parse(
    await chat([{ role: "system", content: inquisitorPrompt }])
  );

  for (const q of queries) {
    // call the public recommendation function
    const recRes = await fetch(
      `${Deno.env.get("EDGE_BASE")}/get-recommendations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q })
      }
    );
    const { recommendations = [] } = await recRes.json();

    // audit the response
    const audit = JSON.parse(
      await chat([
        { role: "system", content: auditorPrompt },
        { role: "user",   content: JSON.stringify({ query: q, recs: recommendations }) }
      ])
    );

    // coach if score < 4
    if (audit.score < 4 && audit.suggestion) {
      const insight = JSON.parse(
        await chat([
          { role: "system", content: coachPrompt },
          { role: "user",   content: `Query:${q}\nSuggestion:${audit.suggestion}` }
        ])
      );

      if (insight.keyword && insight.phrases?.length) {
        await sb.from("keyword_booster").upsert(
          { keyword: insight.keyword, booster_phrases: insight.phrases },
          { onConflict: "keyword" }
        );
      }
    }

    // always log the query
    await sb.from("query_log").insert({ user_query: q });
  }

  return new Response("ok");
});

### deno.json

{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2",
    "openai": "npm:openai@4"
  }
}

### index.ts

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

### deno.json

{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2",
    "openai": "npm:openai@4"
  }
}

### index.ts

// supabase/functions/chat-final/index.ts

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// --- CLIENTS ---
const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const ai = new OpenAI({ apiKey: Deno.env.get("OPENAI_KEY")! });

// --- CORS HEADERS ---
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- HELPER: Embedding ---
async function embed(text: string): Promise<number[]> {
  const resp = await ai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return resp.data[0].embedding;
}

// --- LOGIC FROM "chatbot" FUNCTION ---
async function getRecommendationsAndProse(prompt: string, boosts: string[] = []) {
  const embeddingText = [prompt, ...boosts].join(" ");
  const vec = await embed(embeddingText);

  const { data: recs, error } = await sb.rpc("final_match_media", {
    in_user_vector: vec,
    in_media_type: null, in_genres: null, in_actor_name: null,
    in_max_runtime: null, in_year_min: null, in_year_max: null,
    match_count: 10
  });

  if (error) {
    console.error("Chatbot DB error:", error.message);
    throw new Error(`Failed to match media: ${error.message}`);
  }

  const chat = await ai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are StreamGuru. You are informal, witty, and passionate about movies. Briefly introduce the recommendations based on the user's prompt. DO NOT mention specific movie titles." },
      { role: "user", content: prompt }
    ]
  });

  return {
    prose: chat.choices[0].message.content,
    recs: recs || []
  };
}

// --- LOGIC FROM "auditor" FUNCTION ---
const auditorSystemPrompt = `
You are a Quality Assurance bot. Your job is to analyze a user's query and the movie recommendations.
- If the query is specific and the recommendations are relevant, the response is GOOD ("ok": true).
- If the query is a vague vibe (e.g., "hi", "I'm sad"), the response is NOT OK. Invent 1-3 specific, creative "vibe tags".
- If the recommendations list is EMPTY for a specific query, the response is NOT OK. Invent vibe tags to broaden the search.
You MUST reply with JSON only: { "ok": boolean, "vibes": [{ "tag": "your tag" }] }
`;

async function auditResponse(userQuery: string, recommendations: any[]) {
  const audit = await ai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: auditorSystemPrompt },
      { role: "user", content: JSON.stringify({ query: userQuery, recs: recommendations }) }
    ],
    response_format: { type: "json_object" }
  });
  return JSON.parse(audit.choices[0].message.content!);
}

// --- MAIN ORCHESTRATOR LOGIC from "chat-session" ---
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { prompt } = await req.json();
    if (!prompt) throw new Error("Missing 'prompt' in request body");
    let boosts: string[] = [];

    for (let attempt = 1; attempt <= 3; attempt++) {
      const botResponse = await getRecommendationsAndProse(prompt, boosts);
      const audit = await auditResponse(prompt, botResponse.recs);

      if (!audit.ok && audit.vibes?.length) {
        boosts = audit.vibes.map((v: any) => v.tag);
        console.log(`Attempt ${attempt} failed audit. Retrying with boosts:`, boosts);
        if (attempt < 3) continue;
      }
      
      return new Response(
        JSON.stringify(botResponse),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: "Auditor was never satisfied after 3 attempts." }),
      { status: 422, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Chat-final function error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});

### deno.json

{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2",
    "openai": "npm:openai@4"
  }
}

### index.ts

// supabase/functions/chat-session/index.ts

import { createClient } from "@supabase/supabase-js";

// --- NEW: Define CORS Headers ---
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const call = (fn: string, body: unknown) => {
  const url = `${Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", ".functions.supabase.co")}/${fn}`;
  return fetch(url, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      // We must pass the service role key to call other functions internally
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`
    },
    body: JSON.stringify(body)
  }).then(r => r.json());
};

Deno.serve(async (req) => {
  // --- NEW: Handle preflight OPTIONS request ---
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { prompt } = await req.json();
    let boosts: string[] = [];

    for (let attempt = 1; attempt <= 3; attempt++) {
      const bot = await call("chatbot", { prompt, boosts });
      if (bot.error) throw new Error(bot.error);

      const audit = await call("auditor", {
        userQuery: prompt,
        chatbotResp: bot
      });
      if (audit.error) throw new Error(audit.error);

      if (!audit.ok && audit.vibes?.length) {
        boosts = audit.vibes.map((v: any) => v.tag);
        console.log(`Attempt ${attempt} failed audit. Retrying with boosts:`, boosts);
        continue;
      }

      console.log(`Attempt ${attempt} passed audit. Returning results.`);
      return new Response(
        JSON.stringify({ ...bot, audited: true }),
        // --- MODIFIED: Include CORS headers in the main response ---
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    console.warn("Auditor was dissatisfied after 3 tries.");
    return new Response(
      JSON.stringify({ error: "Auditor was never satisfied." }),
      // --- MODIFIED: Include CORS headers in the error response ---
      { status: 422, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Chat session error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      // --- MODIFIED: Include CORS headers in the error response ---
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});

### deno.json

{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2",
    "openai": "npm:openai@4"
  }
}

### index.ts

// supabase/functions/chatbot/index.ts

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const ai = new OpenAI({ apiKey: Deno.env.get("OPENAI_KEY")! });

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function embed(text: string): Promise<number[]> {
  const resp = await ai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return resp.data[0].embedding;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { prompt, boosts = [] } = await req.json();

    const embeddingText = [prompt, ...boosts].join(" ");
    const vec = await embed(embeddingText);
    
    // --- THIS IS THE FIX ---
    // This function now calls the new, unambiguous 'final_match_media' function,
    // aligning it with the rest of our corrected application architecture.
    // We pass nulls for all filters because this simpler function does not use the AI parser.
    const { data: recs, error } = await sb.rpc("final_match_media", {
      in_user_vector: vec,
      in_media_type: null,
      in_genres: null,
      in_actor_name: null,
      in_max_runtime: null,
      in_year_min: null,
      in_year_max: null,
      match_count: 10
    });
    // --- END OF FIX ---

    if (error) {
      console.error("Chatbot DB error:", error.message);
      throw new Error(`Failed to match media: ${error.message}`);
    }
    
    // We only send the original prompt to the AI to prevent it from being too verbose.
    const chat = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are StreamGuru. You are informal, witty, and passionate about movies. Your job is to write a brief, fun, top-level introduction based on the user's request. DO NOT mention specific movie titles, as they will be displayed separately." 
        },
        { role: "user", content: prompt }
      ]
    });

    return new Response(
      JSON.stringify({
        prose: chat.choices[0].message.content,
        recs: recs || []
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});

### deno.json

{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2",
    "openai": "npm:openai@4"
  }
}

### index.ts

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const sb  = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const open = new OpenAI({ apiKey: Deno.env.get("OPENAI_KEY")! });

const coachSys = {
  role: "system",
  content:
`you create keyword boosters. respond with {"keyword":"x","phrases":["y","z"]} or {"keyword":null,"phrases":[]}`
};

Deno.serve(async () => {
  const { data: rows } = await sb.from("query_log").select("*").eq("processed", false).limit(50);
  if (!rows?.length) return new Response("nothing to do");

  for (const r of rows) {
    try {
      const chat = await open.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          coachSys,
          { role: "user", content: r.user_query }
        ],
        response_format: { type: "json_object" }
      });
      const { keyword, phrases } = JSON.parse(chat.choices[0].message.content!);
      if (keyword && phrases?.length) {
        await sb.from("keyword_booster").upsert(
          { keyword, booster_phrases: phrases },
          { onConflict: "keyword" }
        );
      }
      await sb.from("query_log").update({ processed: true }).eq("id", r.id);
    } catch (err) {
      console.error("trainer error", err);
    }
  }
  return new Response("ok");
});

### deno.json

{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2",
    "openai": "npm:openai@4"
  }
}

### index.ts

// supabase/functions/filter-media/index.ts
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { filters } = await req.json();
    if (!filters) throw new Error("A 'filters' object is required.");

    console.log("Received filters:", filters);

    // Call the new database function with the structured filters
    const { data, error } = await sb.rpc("filter_media", {
      in_genre: filters.genre,
      in_actor_name: filters.actor_name,
      in_max_runtime: filters.max_runtime
    });

    if (error) {
      console.error("Database error:", error);
      throw error;
    }

    return new Response(JSON.stringify({ results: data ?? [] }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

### deno.json

{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2",
    "openai": "npm:openai@4"
  }
}

### index.ts

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

### deno.json

{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2",
    "openai": "npm:openai@4"
  }
}

### index.ts

// supabase/functions/get-details/index.ts

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { tmdb_id } = await req.json();
    if (!tmdb_id) {
      throw new Error("tmdb_id is required.");
    }

    const numericId = parseInt(String(tmdb_id), 10);

    if (isNaN(numericId)) {
        throw new Error("Invalid tmdb_id format. Must be a number.");
    }

    const { data, error } = await supabase
      .from("media")
      .select("*")
      .eq("tmdb_id", numericId) 
      .single();

    if (error) {
        console.error(`Supabase query failed for tmdb_id ${numericId}:`, error);
        throw new Error(`No media found with TMDb ID ${numericId}.`);
    }

    return new Response(JSON.stringify({ details: data }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

### deno.json

{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2",
    "openai": "npm:openai@4"
  }
}

### index.ts

// supabase/functions/get-recommendations/index.ts

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const openKey = Deno.env.get("OPENAI_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

async function embed(text: string) {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openKey}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text })
  });
  if (!r.ok) {
    const errorBody = await r.json();
    throw new Error(`OpenAI API Error: ${errorBody.error?.message}`);
  }
  const j = await r.json();
  return j.data[0].embedding as number[];
}

async function logQuery(q: string) {
  sb.from("query_log").insert({ user_query: q }).then(() => {}).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { message, filters = {}, limit = 10 } = await req.json();
    if (!message) throw new Error("`message` is required");
    await logQuery(message);

    let embeddingText = message;
    if (filters.genres || filters.actor) {
        const genreText = filters.genres ? `movies in the genres: ${filters.genres.join(', ')}` : '';
        const actorText = filters.actor ? `movies starring actor: ${filters.actor}` : '';
        embeddingText = [genreText, actorText].filter(Boolean).join('. ');
    }

    const vec = await embed(embeddingText);

    // --- THIS IS THE FIX ---
    // We are now calling the new, unambiguous function 'v2_match_media'.
    let { data: recs, error } = await sb.rpc("v2_match_media", {
      in_user_vector: vec,
      in_genres: filters.genres ?? null,
      in_max_runtime: filters.max_runtime ?? null,
      in_year_min: filters.release_year_min ?? null,
      in_year_max: filters.release_year_max ?? null,
      match_count: limit
    });
    // --- END OF FIX ---

    if (error) {
      console.error("Database error:", error.message);
      throw error;
    }
    
    if ((!recs || recs.length === 0) && filters.actor && filters.genres) {
      console.log(`[Fallback] Retrying with genre only.`);
      const { data: fallbackRecs } = await sb.rpc("v2_match_media", {
        in_user_vector: vec, in_genres: filters.genres, in_max_runtime: null,
        in_year_min: null, in_year_max: null, match_count: limit
      });
      recs = fallbackRecs;
    }

    return new Response(JSON.stringify({ recommendations: recs ?? [] }), {
      headers: { ...CORS, "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Function error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" }
    });
  }
});

### deno.json

{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2",
    "openai": "npm:openai@4"
  }
}

### index.ts

// supabase/functions/search-media/index.ts

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { query } = await req.json();
    if (!query) throw new Error("A 'query' is required.");

    // Call the new, simple database function
    const { data, error } = await sb.rpc("search_media_by_keyword", {
      keyword: query,
    });

    if (error) {
      console.error("Database error:", error);
      throw error;
    }

    return new Response(JSON.stringify({ results: data ?? [] }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

### deno.json

{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2",
    "openai": "npm:openai@4"
  }
}

### index.ts

// supabase/functions/trending/index.ts

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { data, error } = await supabase
      .from("media")
      .select("tmdb_id, media_type, title, poster_path")
      .order("popularity", { ascending: false })
      .limit(12);

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ trending: data ?? [] }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("[trending_function_error]", err);
    return new Response(JSON.stringify({ error: "Failed to fetch trending media." }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

### 20250802015421_remote_schema.sql



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE TYPE "public"."embedding_update" AS (
	"id_to_update" "uuid",
	"embedding_vector" "public"."vector"(1536)
);


ALTER TYPE "public"."embedding_update" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tmdb_id" integer NOT NULL,
    "media_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "synopsis" "text" NOT NULL,
    "genres" "text"[] NOT NULL,
    "runtime" integer,
    "poster_path" "text",
    "release_date" "date",
    "popularity" numeric,
    "embedding" "public"."vector"(1536),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "director" "text",
    "tagline" "text",
    "trailer_key" "text",
    "backdrop_path" "text",
    "logo_path" "text",
    "top_cast" "jsonb",
    "watch_providers" "jsonb",
    "spoken_languages" "jsonb",
    CONSTRAINT "media_media_type_check" CHECK (("media_type" = ANY (ARRAY['movie'::"text", 'tv'::"text"])))
);


ALTER TABLE "public"."media" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_media"("in_actor_name" "text" DEFAULT NULL::"text", "in_genre" "text" DEFAULT NULL::"text", "in_user_vector" "public"."vector" DEFAULT NULL::"public"."vector", "in_year_max" integer DEFAULT NULL::integer, "in_year_min" integer DEFAULT NULL::integer, "match_count" integer DEFAULT 10, "match_threshold" numeric DEFAULT 0.7) RETURNS SETOF "public"."media"
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select m.*
  from   public.media m
  where
        (in_genre      is null or m.genres @> array[in_genre])
    and (in_actor_name is null or exists (
          select 1 from jsonb_array_elements(m.top_cast) a
          where a->>'name' = in_actor_name))
    and (in_year_min   is null or extract(year from m.release_date) >= in_year_min)
    and (in_year_max   is null or extract(year from m.release_date) <= in_year_max)
    and (in_user_vector is not null)
    and (1 - (m.embedding <=> in_user_vector)) >= match_threshold
  order by m.embedding <=> in_user_vector        -- nearest first
  limit match_count;
end;
$$;


ALTER FUNCTION "public"."match_media"("in_actor_name" "text", "in_genre" "text", "in_user_vector" "public"."vector", "in_year_max" integer, "in_year_min" integer, "match_count" integer, "match_threshold" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_media_embeddings"("updates" "public"."embedding_update"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  -- Declare the loop variable
  update_item embedding_update;
BEGIN
  -- This loop iterates through the array of updates we send from our script
  -- and performs an UPDATE for each one. This is extremely fast because
  -- it all happens directly inside the database.
  FOREACH update_item IN ARRAY updates
  LOOP
    UPDATE public.media
    SET embedding = update_item.embedding_vector
    WHERE id = update_item.id_to_update;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."update_media_embeddings"("updates" "public"."embedding_update"[]) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."keyword_booster" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "keyword" "text" NOT NULL,
    "booster_phrases" "text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."keyword_booster" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."query_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_query" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."query_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vibe_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "vibe_tag" "text" NOT NULL,
    "genres" "text"[] DEFAULT '{}'::"text"[],
    "examples" integer[] DEFAULT '{}'::integer[],
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vibe_categories" OWNER TO "postgres";


ALTER TABLE ONLY "public"."keyword_booster"
    ADD CONSTRAINT "keyword_booster_keyword_key" UNIQUE ("keyword");



ALTER TABLE ONLY "public"."keyword_booster"
    ADD CONSTRAINT "keyword_booster_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media"
    ADD CONSTRAINT "media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media"
    ADD CONSTRAINT "media_tmdb_id_key" UNIQUE ("tmdb_id");



ALTER TABLE ONLY "public"."query_log"
    ADD CONSTRAINT "query_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vibe_categories"
    ADD CONSTRAINT "vibe_categories_pkey" PRIMARY KEY ("id");



CREATE INDEX "media_vec_ivf" ON "public"."media" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "query_log_unprocessed_idx" ON "public"."query_log" USING "btree" ("processed") WHERE ("processed" = false);



CREATE INDEX "vibe_categories_session_id_idx" ON "public"."vibe_categories" USING "btree" ("session_id");



CREATE INDEX "vibe_genres_gin_idx" ON "public"."vibe_categories" USING "gin" ("genres");



CREATE INDEX "vibe_tag_btree_idx" ON "public"."vibe_categories" USING "btree" ("vibe_tag");



CREATE OR REPLACE TRIGGER "on_keyword_booster_updated" BEFORE UPDATE ON "public"."keyword_booster" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE POLICY "Allow public read access" ON "public"."keyword_booster" FOR SELECT USING (true);



CREATE POLICY "Allow service role to manage" ON "public"."keyword_booster" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Enable read access for all users" ON "public"."media" FOR SELECT USING (true);



CREATE POLICY "allow insert" ON "public"."query_log" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "allow select self" ON "public"."query_log" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow update processed" ON "public"."query_log" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."keyword_booster" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."query_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vibe_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vibes api read" ON "public"."vibe_categories" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "vibes api write" ON "public"."vibe_categories" FOR INSERT TO "service_role" WITH CHECK (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON TABLE "public"."media" TO "anon";
GRANT ALL ON TABLE "public"."media" TO "authenticated";
GRANT ALL ON TABLE "public"."media" TO "service_role";



GRANT ALL ON FUNCTION "public"."match_media"("in_actor_name" "text", "in_genre" "text", "in_user_vector" "public"."vector", "in_year_max" integer, "in_year_min" integer, "match_count" integer, "match_threshold" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."match_media"("in_actor_name" "text", "in_genre" "text", "in_user_vector" "public"."vector", "in_year_max" integer, "in_year_min" integer, "match_count" integer, "match_threshold" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_media"("in_actor_name" "text", "in_genre" "text", "in_user_vector" "public"."vector", "in_year_max" integer, "in_year_min" integer, "match_count" integer, "match_threshold" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_media_embeddings"("updates" "public"."embedding_update"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."update_media_embeddings"("updates" "public"."embedding_update"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_media_embeddings"("updates" "public"."embedding_update"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";












GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";









GRANT ALL ON TABLE "public"."keyword_booster" TO "anon";
GRANT ALL ON TABLE "public"."keyword_booster" TO "authenticated";
GRANT ALL ON TABLE "public"."keyword_booster" TO "service_role";



GRANT ALL ON TABLE "public"."query_log" TO "anon";
GRANT ALL ON TABLE "public"."query_log" TO "authenticated";
GRANT ALL ON TABLE "public"."query_log" TO "service_role";



GRANT ALL ON TABLE "public"."vibe_categories" TO "anon";
GRANT ALL ON TABLE "public"."vibe_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."vibe_categories" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;

### 20250728_initial.sql

-- enable pgvector (only installs once)
create extension if not exists "vector";

-- ────────────────────────────
-- media table
-- ────────────────────────────
create table public.media (
  id           uuid primary key default gen_random_uuid(),
  tmdb_id      integer not null unique,
  media_type   text    not null check (media_type in ('movie','tv')),
  title        text    not null,
  synopsis     text    not null,
  genres       text[]  not null,
  runtime      integer,
  poster_path  text,
  release_date date,
  popularity   numeric,
  embedding    vector(1536),
  created_at   timestamptz not null default now()
);

-- exact-search / ANN index (pgvector IVF)
create index if not exists media_vec_ivf
  on public.media using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ────────────────────────────
-- rpc: match_media
-- returns top-N similar rows to an embedding
-- ────────────────────────────
create or replace function public.match_media(
    in_query_embedding vector,
    in_genres         text[]   default null,
    in_max_runtime    integer  default null,
    in_limit          integer  default 5
) returns table (
    id           uuid,
    tmdb_id      integer,
    media_type   text,
    title        text,
    synopsis     text,
    genres       text[],
    runtime      integer,
    poster_path  text,
    release_date date,
    score        float
)
language plpgsql security definer as $$
begin
  return query
  select  m.id,
          m.tmdb_id,
          m.media_type,
          m.title,
          m.synopsis,
          m.genres,
          m.runtime,
          m.poster_path,
          m.release_date,
          1 - (m.embedding <=> in_query_embedding) as score
  from    public.media m
  where   m.embedding is not null
      and (in_genres      is null or m.genres && in_genres)
      and (in_max_runtime is null or m.runtime <= in_max_runtime)
  order by m.embedding <=> in_query_embedding
  limit   in_limit;
end;
$$;

-- allow callers (anon/auth) to execute the rpc
grant execute on function public.match_media(
  vector, text[], integer, integer
) to anon, authenticated, service_role;

### 20250730135401_create_embedding_update_function.sql

-- First, we need to create a custom data type that matches the structure of our updates.
-- This makes the function safer and easier to use.
CREATE TYPE public.embedding_update AS (
    id_to_update UUID,
    embedding_vector VECTOR(1536)
);

-- Now, create the function that accepts an array of our new custom type.
CREATE OR REPLACE FUNCTION public.update_media_embeddings(updates embedding_update[])
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  -- Declare the loop variable
  update_item embedding_update;
BEGIN
  -- This loop iterates through the array of updates we send from our script
  -- and performs an UPDATE for each one. This is extremely fast because
  -- it all happens directly inside the database.
  FOREACH update_item IN ARRAY updates
  LOOP
    UPDATE public.media
    SET embedding = update_item.embedding_vector
    WHERE id = update_item.id_to_update;
  END LOOP;
END;
$$;

----------------------------------------
----------------------------------------