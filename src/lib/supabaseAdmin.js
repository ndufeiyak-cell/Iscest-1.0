// Single Supabase service-role client for the API.
//
// The service-role key BYPASSES Row Level Security, so it must never reach
// the browser. It lives only here, server-side. The browser gets
// SUPABASE_ANON_KEY instead (see public/js/iscest-config.js) and uses it
// for authentication only.
const { createClient } = require("@supabase/supabase-js");

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. " +
      "Copy .env.example to .env and fill them in (Supabase dashboard -> Project Settings -> API)."
  );
}

// Reuse one client across the app and across nodemon reloads, rather than
// opening a new one per request.
const supabaseAdmin =
  global.__iscestSupabaseAdmin ||
  createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

if (process.env.NODE_ENV !== "production") {
  global.__iscestSupabaseAdmin = supabaseAdmin;
}

module.exports = supabaseAdmin;
