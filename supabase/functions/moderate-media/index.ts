// supabase/functions/moderate-media/index.ts
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const ai = new OpenAI({ apiKey: Deno.env.get("OPENAI_KEY")! });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Row = {
  id: string;
  tmdb_id: number;
  title: string;
  synopsis: string;
  tagline: string | null;
  genres: string[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { ids, limit = 100, threshold = 0.65 } = await req.json().catch(() => ({}));

    // Fetch items that haven't been moderated yet (or explicit list of ids)
    let q = sb.from("media")
      .select("id, tmdb_id, title, synopsis, tagline, genres")
      .limit(limit);
    q = ids?.length ? q.in("tmdb_id", ids) : q.is("moderated_at", null);

    const { data: rows, error } = await q;
    if (error) throw error;

    // Classify with a compact JSON-only chat call (fast + precise)
    const classify = async (r: Row) => {
      const text = [
        `Title: ${r.title}`,
        r.tagline ? `Tagline: ${r.tagline}` : "",
        `Genres: ${r.genres?.join(", ")}`,
        `Synopsis: ${r.synopsis}`
      ].join("\n");

      const resp = await ai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.1,
        messages: [{
          role: "system",
          content: `Return STRICT JSON: {"score": number (0..1), "flag": boolean, "reason": string}.
- "flag" must be true for pornography/softcore/explicit sexual themes, eroticization, or porn-adjacent content.
- Flag only for sexual content; do NOT flag for violence, gore, profanity, or horror alone.`
        }, { role: "user", content: text }]
      });

      const out = JSON.parse(resp.choices[0].message.content!);
      const score = Math.max(0, Math.min(1, Number(out.score ?? 0)));
      const flag = Boolean(out.flag || score >= threshold);
      const reason = String(out.reason || "");

      await sb.from("media").update({
        nsfw_flag: flag,
        nsfw_score: score,
        nsfw_reason: reason.slice(0, 500),
        moderated_at: new Date().toISOString()
      }).eq("id", r.id);
    };

    // small concurrency to be nice to the API
    const pool = 6;
    for (let i = 0; i < (rows?.length || 0); i += pool) {
      await Promise.all((rows as Row[]).slice(i, i + pool).map(classify));
    }

    return new Response(JSON.stringify({ processed: rows?.length || 0 }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[moderate-media]", err);
    return new Response(JSON.stringify({ error: String(err.message || err) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
