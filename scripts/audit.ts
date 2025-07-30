// scripts/audit.ts

import "dotenv/config";
import OpenAI from "openai";
// This syntax is correct for Deno
import inquisitorPrompt from "./utils/inquisitor_prompt.txt" with { type: "text" };
import auditorPrompt from "./utils/auditor_prompt.txt" with { type: "text" };

// --- CONFIG ---
const API_BASE = "https://gfbafuojtjtnbtfdhiqo.functions.supabase.co";
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY! });
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- API HELPERS (to call our live functions) ---
async function getAiResponse(message: string) {
  const res = await fetch(`${API_BASE}/get-ai-response`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  return await res.json();
}
async function getMediaMatches(message: string, filters: any) {
  const res = await fetch(`${API_BASE}/get-recommendations`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, filters }),
  });
  return await res.json();
}

// --- MAIN AUDIT SCRIPT ---
async function main() {
  console.log("🤖 Initializing AI Auditor...");

  // 1. Inquisitor generates test cases
  console.log("🕵️ Step 1: Inquisitor is generating test cases...");
  const inquisitorRes = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: inquisitorPrompt }],
    response_format: { type: "json_object" },
  });
  const { queries } = JSON.parse(inquisitorRes.choices[0].message.content!);
  console.log(`   Generated ${queries.length} queries.`);

  let fullReport = `# StreamGuru AI Audit Report\n\nGenerated on: ${new Date().toISOString()}\n\n---\n\n`;

  // 2. Loop through each query and have the Auditor evaluate it
  let i = 1;
  for (const query of queries) {
    console.log(`\n🧪 Testing Query ${i}/${queries.length}: "${query}"`);

    // 3. Get StreamGuru's response
    console.log("   - Calling StreamGuru API...");
    const { ai_message, filters } = await getAiResponse(query);
    const { recommendations } = await getMediaMatches(query, filters);
    await delay(1000); // Avoid rate-limiting

    // 4. Construct the prompt for the Auditor
    const auditContent = `
      Original User Query: "${query}"
      ---
      StreamGuru's Conversational Response: "${ai_message}"
      ---
      StreamGuru's Parsed Filters: ${JSON.stringify(filters)}
      ---
      StreamGuru's Recommendations: ${JSON.stringify(recommendations?.map((r: any) => r.title) ?? [])}
    `;

    // 5. Auditor evaluates the response
    console.log("   - Auditor is evaluating the response...");
    const auditorRes = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: auditorPrompt },
        { role: "user", content: auditContent },
      ],
      response_format: { type: "json_object" },
    });
    const analysis = JSON.parse(auditorRes.choices[0].message.content!);
    console.log(`   - Score: ${analysis.score}/5`);
    
    // 6. Append the findings to our report
    fullReport += `## Query ${i}: "${query}"\n\n`;
    fullReport += `**Score:** ${analysis.score}/5\n\n`;
    fullReport += `**Justification:** ${analysis.justification}\n\n`;
    fullReport += `**Strengths:** ${analysis.strengths}\n\n`;
    fullReport += `**Suggestion for Improvement:** ${analysis.suggestion}\n\n`;
    fullReport += `**Raw Response:**\n\`\`\`json\n${JSON.stringify({ ai_message, recommendations }, null, 2)}\n\`\`\`\n\n---\n\n`;
    i++;
  }

  // 7. Save the final report
  await Deno.writeTextFile("audit_report.md", fullReport);
  console.log("\n✅ Audit complete! Report saved to audit_report.md");
}

main().catch(console.error);