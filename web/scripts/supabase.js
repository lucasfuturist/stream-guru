// web/scripts/supabase.js

// IMPORTANT: Replace with your actual Supabase URL and Anon Key.
// These are safe to be public in your frontend code.
const SUPABASE_URL = 'https://gfbafuojtjtnbtfdhiqo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmYmFmdW9qdGp0bmJ0ZmRoaXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3NDI1NzUsImV4cCI6MjA2OTMxODU3NX0.GzbJ7BjRwecWHab9tCq-DeTnGz5VUTVgkQubqhAkHO8';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);