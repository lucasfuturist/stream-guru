// ping.ts
import { createClient } from "@supabase/supabase-js";
import "dotenv/config"; // This will load your .env file

// Use the variable names from your .env file
const supaUrl = process.env.SUPABASE_URL!;
const supaServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supa = createClient(supaUrl, supaServiceKey);

const run = async () => {
  console.log("Pinging Supabase to test credentials...");
  const { data, error } = await supa.from("media").select("id, title").limit(1);

  if (error) {
    console.error("❌ Supabase query failed. Check your URL and Service Role Key.");
    console.error(error);
    throw error;
  }

  console.log("✅ Successfully pulled a row:", data);
};

run();