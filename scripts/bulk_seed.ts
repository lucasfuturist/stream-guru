// scripts/bulk_seed.ts
// This script acts as a manager, running the tmdb_seed.ts script for every genre.

import { genreMap } from "./utils/genre-map.ts";

// Create a unique list of all genre names from the map.
const genresToSeed = [...new Set(Object.values(genreMap))];

// The maximum number of pages TMDb allows for any discovery query.
const MAX_PAGES_PER_GENRE = 750;

async function runBulkSeed() {
  console.log("🚀 Starting Bulk Seeding Orchestrator.");
  console.log(`Found ${genresToSeed.length} unique genres to process.`);
  console.log("This process will take a very long time.\n");

  // Loop through every genre, one by one.
  for (const [index, genre] of genresToSeed.entries()) {
    console.log(`\n=========================================================`);
    console.log(`[${index + 1}/${genresToSeed.length}] EXECUTING JOB FOR GENRE: "${genre}"`);
    console.log(`=========================================================`);

    // Create a Deno command to run the tmdb_seed.ts script as a subprocess.
    const command = new Deno.Command("deno", {
      args: [
        "run",
        "-A", // Grant all permissions
        "scripts/tmdb_seed.ts",
        "--genre",
        genre, // Pass the current genre
        "--pages",
        String(MAX_PAGES_PER_GENRE) // Tell it to fetch everything
      ],
      // Pipe the output of the subprocess to our current terminal so we see its progress.
      stdout: "inherit",
      stderr: "inherit",
    });

    // Execute the command and wait for it to complete.
    const status = await command.spawn().status;

    if (!status.success) {
      console.error(`❌ Job for genre "${genre}" failed with code ${status.code}.`);
      console.error("Aborting bulk seed process.");
      // If one genre fails, we stop the whole process.
      Deno.exit(1);
    }
  }

  const { error: analyzeErr } = await supabase.rpc("run_sql", {
    sql: "ANALYZE public.media"
  });
  if (analyzeErr) console.error("ANALYZE failed", analyzeErr);


  console.log("\n\n🎉🎉🎉 Bulk Seeding Orchestrator Finished! 🎉🎉🎉");
  console.log("All genres have been processed.");
  console.log("Don't forget to run the embedding script to process all the new content!");
}

// Run the main function.
runBulkSeed();