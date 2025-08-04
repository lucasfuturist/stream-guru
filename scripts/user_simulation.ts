// scripts/user_simulation.ts

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { promises as fs } from "fs";
import path from "path";

// --- CONFIGURATION ---
const MAX_TURNS_PER_SESSION = 15;
const OUTPUT_DIR = path.join(process.cwd(), "chat_experiments");

// --- CLIENTS ---
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.OPENAI_KEY) {
  throw new Error("Missing required environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_KEY)");
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

// --- SYSTEM PROMPT for our AI User Persona ---
const userPersonaSystemPrompt = `
You are a creative and slightly unpredictable user testing a new movie recommendation chatbot. Your goal is to simulate a natural, multi-turn conversation.

1.  **On your first turn, give a simple, broad request.** (e.g., "show me some comedies").
2.  **For all subsequent turns, you will be given the chatbot's last response.** Based on this, generate a natural follow-up.
3.  **Your follow-ups MUST be varied.** Sometimes refine the request ("from the 90s"), sometimes add a filter ("starring Tom Hanks"), sometimes change your mind completely ("actually, I want a horror movie"), and sometimes complain if the results are bad ("these aren't what I asked for").
4.  **Your ONLY output should be the raw text of your next chat message.** Do not add any commentary, labels, or quotation marks.
`;

// --- TYPES ---
interface ChatTurn {
  turnNumber: number;
  userPrompt: string;
  botProse: string;
  botRecs: any[];
}

async function callStreamGuru(prompt: string, history: any[]): Promise<{ prose: string; recs: any[] }> {
  const { data: aiResponse, error: aiError } = await supabase.functions.invoke('get-ai-response', {
    body: { history: [...history, { role: 'user', content: prompt }] },
  });
  if (aiError) throw new Error(`get-ai-response error: ${aiError.message}`);
  
  const { ai_message, filters } = aiResponse;
  let recommendations: any[] = [];

  const hasFilters = filters && Object.keys(filters).length > 0;
  if (hasFilters) {
    const { data: recData, error: recError } = await supabase.functions.invoke('get-recommendations', {
      body: { message: prompt, filters },
    });
    if (recError) console.warn(`get-recommendations error: ${recError.message}`);
    recommendations = recData?.recommendations || [];
  }

  return { prose: ai_message, recs: recommendations };
}

async function generateUserPrompt(history: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
  const messages: any[] = [{ role: "system", content: userPersonaSystemPrompt }, ...history];
  
  const resp = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature: 1.1,
  });
  return resp.choices[0].message.content!;
}

// --- THIS FUNCTION CONTAINS THE FIX ---
async function writeLogToFile(sessionLog: ChatTurn[]) {
  let markdownContent = `# Chatbot Experiment Log\n\n**Session Date:** ${new Date().toISOString()}\n\n---\n\n`;

  for (const turn of sessionLog) {
    markdownContent += `## Turn ${turn.turnNumber}\n\n`;
    markdownContent += `### 🤵 User Prompt\n\n\`\`\`text\n${turn.userPrompt}\n\`\`\`\n\n`;
    markdownContent += `### 🤖 Bot Response\n\n**Prose:**\n\`\`\`text\n${turn.botProse}\n\`\`\`\n\n`;

    // We now "quantize" the recommendation object to only include the most relevant fields for analysis.
    const recsForLog = turn.botRecs.map(rec => ({
        tmdb_id: rec.tmdb_id,
        title: rec.title,
        genres: rec.genres,
        release_date: rec.release_date,
        // We extract just the actor names for easier readability.
        top_cast: rec.top_cast?.map((actor: any) => actor.name) || [],
        synopsis: rec.synopsis
    }));

    markdownContent += `**Recommendations Found (${recsForLog.length}):**\n\`\`\`json\n${JSON.stringify(recsForLog, null, 2)}\n\`\`\`\n\n`;
    markdownContent += `---\n\n`;
  }
  // --- END OF FIX ---

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `session_log_${timestamp}.md`;
  const filepath = path.join(OUTPUT_DIR, filename);

  await fs.writeFile(filepath, markdownContent);
  console.log(`✅ Experiment complete. Report saved to: ${filepath}`);
}

async function runSimulation() {
  console.log("🚀 Starting new user simulation experiment...");
  const sessionLog: ChatTurn[] = [];
  const gptHistory: { role: 'user' | 'assistant'; content: string }[] = [];
  let consecutiveEmptyTurns = 0; // --- FIX: Add a counter ---

  for (let i = 1; i <= MAX_TURNS_PER_SESSION; i++) {
    console.log(`- Starting turn ${i}...`);
    const userPrompt = await generateUserPrompt(i === 1 ? [] : gptHistory);
    console.log(`  - User Persona says: "${userPrompt}"`);

    const botResponse = await callStreamGuru(userPrompt, gptHistory);

    sessionLog.push({
      turnNumber: i,
      userPrompt,
      botProse: botResponse.prose,
      botRecs: botResponse.recs,
    });
    
    // --- FIX: Logic to detect the end of the conversation ---
    if (botResponse.recs.length === 0) {
      consecutiveEmptyTurns++;
    } else {
      consecutiveEmptyTurns = 0;
    }
    if (consecutiveEmptyTurns >= 2) {
      console.log("✅ Conversation appears to have ended naturally. Stopping simulation.");
      break;
    }
    // --- END OF FIX ---

    gptHistory.push({ role: 'user', content: userPrompt });
    const botSummaryForGpt = `My response: "${botResponse.prose}". Recommended movies: [${botResponse.recs.map(r => r.title).join(", ")}]`;
    gptHistory.push({ role: 'assistant', content: botSummaryForGpt });
    
    if (i === MAX_TURNS_PER_SESSION) break;
  }
  await writeLogToFile(sessionLog);
}

runSimulation().catch(console.error);