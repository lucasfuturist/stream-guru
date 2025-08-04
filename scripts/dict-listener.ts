/**
 * realtime listener that watches query_log for meh results
 * and logs vibe tags suggested by gpt
 */

import { createClient, SupabaseRealtimePayload } from "@supabase/supabase-js";
import OpenAI from "openai";

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ai = new OpenAI({ apiKey: process.env.OPENAI_KEY! });

sb.channel("public:query_log")
  .on<SupabaseRealtimePayload<any>>("postgres_changes", { event: "INSERT" }, async payload => {
    const { id, session_id, query, recs, score } = payload.new;
    if (score >= 4) return; // fine

    const coach = await ai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: [
        { role: "system", content: "give a broad vibe tag, json only {tag, reason}" },
        { role: "user", content: JSON.stringify({ query, recs }) }
      ],
      response_format: { type: "json_object" }
    });

    const { tag, reason } = JSON.parse(coach.choices[0].message.content);
    const vibe = (tag ?? "").toLowerCase().trim();
    if (!vibe) return;

    await sb.from("vibe_categories").insert({
      session_id: session_id ?? crypto.randomUUID(),
      vibe_tag: vibe,
      genres: [],
      examples: recs.map((r: any) => r.tmdb_id),
      notes: reason ?? "auto from dict-listener"
    });

    console.log("🧠 logged vibe", vibe, "for query", id);
  })
  .subscribe();

console.log("dict-listener running… press ctrl-c to quit.");
