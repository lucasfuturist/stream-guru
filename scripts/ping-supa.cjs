const { createClient } = require("@supabase/supabase-js");

const supa = createClient(
  process.env.SB_URL,
  process.env.SB_SERVICE_ROLE_KEY
);

(async () => {
  const { data, error } = await supa.from("media").select("*").limit(1);
  if (error) throw error;
  console.log("✅ pulled row:", data);
})();
