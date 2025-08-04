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
