// ISCEST — the one Supabase client the browser uses.
//
// This is for AUTH ONLY: signUp, signInWithPassword, getSession, signOut.
// All data still goes through the Express API at window.ISCEST_API_BASE,
// which holds the service-role key. Pages never query Supabase tables
// directly, so RLS stays a safety net rather than the primary control.
//
// Requires the supabase-js CDN script tag to have loaded first.
(function () {
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error(
      "supabase-js didn't load — check the CDN <script> tag comes before this file."
    );
    return;
  }

  window.iscestSupabase = window.supabase.createClient(
    window.ISCEST_SUPABASE_URL,
    window.ISCEST_SUPABASE_ANON_KEY
  );

  // Authenticated fetch against the ISCEST API: attaches the current
  // Supabase access token, refreshing it first if it's expired.
  // Returns the raw Response so callers keep full control of status codes.
  window.iscestApi = async function (path, options) {
    const opts = options || {};
    const { data } = await window.iscestSupabase.auth.getSession();

    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (data.session) headers.Authorization = "Bearer " + data.session.access_token;

    return fetch(window.ISCEST_API_BASE + path, Object.assign({}, opts, { headers: headers }));
  };
})();
