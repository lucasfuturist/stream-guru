/**
 * offline quality audit & vibe discovery
 * run:  ts-node scripts/audit.ts
 */

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ai = new OpenAI({ apiKey: process.env.OPENAI_KEY! });

/* broad vibe coach */
const coachSys = `
you invent broad vibe tags based on recommendation quality.
return ONLY json:
{ "tag":"<1-2 words>",
  "genres":["sci-fi","drama"],
  "reason":"why this tag helps" }
`.trim();

function clean(str?: string | null) {
  return (str ?? "").toLowerCase().trim();
}

export async function main() {
  /* pull a batch of recent low-score recs or whatever logic u had */
  const { data: rows } = await sb.from("recommendation_log").select("*").limit(25);

  for (const row of rows ?? []) {
    const { query, recommendations, score } = row;

    if (score >= 4) continue; // good enough

    /* ask coach for a vibe tag */
    const coach = await ai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: [
        { role: "system", content: coachSys },
        {
          role: "user",
          content: JSON.stringify({ query, recs: recommendations })
        }
      ],
      response_format: { type: "json_object" }
    });

    const { tag, genres, reason } = JSON.parse(coach.choices[0].message.content);

    const vibe = clean(tag);
    if (!vibe) continue;

    await sb.from("vibe_categories").insert({
      session_id: crypto.randomUUID(),
      vibe_tag: vibe,
      genres: genres ?? [],
      examples: recommendations.map((r: any) => r.tmdb_id),
      notes: reason
    });

    console.log(`🧠 logged vibe '${vibe}'`);
  }
}

if (import.meta.main) main().catch(console.error);
