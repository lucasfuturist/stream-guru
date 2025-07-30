
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
|   +-- get-ai-response
|   |   +-- deno.json
|   |   L-- index.ts
|   +-- get-details
|   |   +-- deno.json
|   |   L-- index.ts
|   +-- get-recommendations
|   |   +-- deno.json
|   |   L-- index.ts
|   L-- trending
|       +-- deno.json
|       L-- index.ts
L-- migrations
    +-- 20250728_initial.sql
    L-- 20250730135401_create_embedding_update_function.sql

📜 Listing scripts with extensions: .ts, .txt, .tsx, .js, .jsx, .py, .html, .json, .css, .sql, .toml, .cjs, .ps1
----------------------------------------

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

const parserPrompt = `You are StreamGuru, a charismatic and witty movie and TV show concierge. Your knowledge of film is encyclopedic, but you are not a robot. You are a friend, a film buff who is passionate about helping people find their next favorite thing to watch.
Your personality:
- **Witty & Charismatic:** You use clever turns of phrase and a friendly, engaging tone.
- **Knowledgeable:** You speak with confidence about movies and TV.
- **Perceptive:** You read between the lines of what a user is asking for. You understand "vibes."
Your primary task is to do two things:
1.  **Parse the user's request** into a structured JSON object containing any specified filters.
2.  **Write a creative, human-sounding response** to the user, acknowledging their request.
**FILTERING RULES:**
- You must extract up to four movie or TV genres. The valid genres are: Action, Adventure, Animation, Comedy, Crime, Documentary, Drama, Family, Fantasy, History, Horror, Music, Mystery, Romance, Science Fiction, TV Movie, Thriller, War, Western, Action & Adventure, Kids, News, Reality, Sci-Fi & Fantasy, Soap, Talk, War & Politics.
- You must determine if the user has specified a maximum runtime in minutes. For example, "under 2 hours" or "a quick movie" should be parsed as \`120\`. If no runtime is mentioned, this should be \`null\`.
- **CRITICAL RULE: You MUST ALWAYS write a creative, human-sounding response, even if the user's query is very simple. NEVER respond with only the JSON part.**
- The final JSON object MUST be on the last line of your response and start with \`!JSON!\`.
**EXAMPLE 1:**
User request: "I want to watch a really funny sci-fi movie, but I don't have much time."
Your response:
On the hunt for some quick sci-fi laughs? Excellent choice. Let's see what the cosmos has to offer in the comedy department.
!JSON!{"genres": ["Comedy", "Science Fiction", "Sci-Fi & Fantasy"], "max_runtime": 100}
**EXAMPLE 2:**
User request: "Something like The Matrix"
Your response:
Ah, a classic! You're looking for that mind-bending, leather-clad, reality-questioning vibe. I know just the thing.
!JSON!{"genres": ["Action", "Science Fiction"], "max_runtime": null}
**EXAMPLE 3 (Simple Query):**
User request: "Horror"
Your response:
You want to get scared, do you? Say no more. Let's find something that will have you checking behind the curtains.
!JSON!{"genres": ["Horror"], "max_runtime": null}`;

const OPENAI_KEY = Deno.env.get("OPENAI_KEY")!;
const openai = new OpenAI({ apiKey: OPENAI_KEY });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { message } = await req.json();
    if (!message) throw new Error("message is required");

    const chat_res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: parserPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.7,
    });

    const content = chat_res.choices[0].message.content ?? "";
    let ai_message = content;
    let filters = {};

    if (content.includes("!JSON!")) {
      const [parsed_message, json_string] = content.split("!JSON!");
      ai_message = parsed_message.trim();
      filters = JSON.parse(json_string);
    }

    return new Response(
      JSON.stringify({ ai_message, filters }),
      { headers: { "Content-Type": "application/json", ...CORS } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json", ...CORS } });
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

const SB_URL = Deno.env.get("SB_URL")!;
const SB_SERVICE_ROLE = Deno.env.get("SB_SERVICE_ROLE")!;
const supabase = createClient(SB_URL, SB_SERVICE_ROLE);

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

    // --- ROBUSTNESS CHECK ---
    // Defensively parse the ID, as it might come in as a string from the client.
    const numericId = parseInt(String(tmdb_id), 10);

    if (isNaN(numericId)) {
        throw new Error("Invalid tmdb_id format. Must be a number.");
    }
    // --- END CHECK ---

    const { data, error } = await supabase
      .from("media")
      .select("*")
      .eq("tmdb_id", numericId) // Use the sanitized numericId
      .single();

    if (error) {
        // This will now give a more useful error if the ID doesn't exist
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
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2"
  }
}

### index.ts

// supabase/functions/get-recommendations/index.ts

import { createClient } from "@supabase/supabase-js";

const SB_URL = Deno.env.get("SB_URL")!;
const SB_SERVICE_ROLE = Deno.env.get("SB_SERVICE_ROLE")!;
const OPENAI_KEY = Deno.env.get("OPENAI_KEY")!; // Still need this for embeddings

const supabase = createClient(SB_URL, SB_SERVICE_ROLE);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8191) }),
  });
  if (!res.ok) throw new Error(`OpenAI embedding failed: ${await res.text()}`);
  const { data } = await res.json();
  return data[0].embedding;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { message, filters } = await req.json();
    if (!message || !filters) throw new Error("message and filters are required");

    const vector = await getEmbedding(message);

    const { data, error } = await supabase.rpc("match_media", {
      in_query_embedding: vector,
      in_genres: filters.genres ?? null,
      in_max_runtime: filters.max_runtime ?? null,
      in_limit: 4,
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({ recommendations: data ?? [] }),
      { headers: { "Content-Type": "application/json", ...CORS } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json", ...CORS } });
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

// --- Environment Variables ---
const SB_URL = Deno.env.get("SB_URL")!;
const SB_SERVICE_ROLE = Deno.env.get("SB_SERVICE_ROLE")!;

// --- Supabase Client ---
const supabase = createClient(SB_URL, SB_SERVICE_ROLE);

// --- CORS Headers ---
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // Fetch the top 12 most popular items from the media table
    const { data, error } = await supabase
      .from("media")
      .select("tmdb_id, media_type, title, poster_path") // Only select what the card needs
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