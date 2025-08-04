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
