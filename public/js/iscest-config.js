// ISCEST — public runtime config. Loaded on every page, before the others.
//
// Fill these in from the Supabase dashboard: Project Settings -> API.
//
// The anon key is publishable by design — Row Level Security is what limits
// what it can reach, and the policies in
// supabase/migrations/20260928090200_rls_policies.sql make it read-only.
//
// The SERVICE-ROLE key must never appear in this file, or anywhere else
// under public/. It bypasses RLS and lives only in the server's .env.
window.ISCEST_SUPABASE_URL = "https://ggqjaaaxkkqwajfghbaf.supabase.co";
window.ISCEST_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncWphYWF4a2txd2FqZmdoYmFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0NjAxODUsImV4cCI6MjEwNjAzNjE4NX0.kWy1l9VjvgwX4CKptjICZzCNKshIV-8ZtL-y2tclifc";

// Same origin: Express serves this site and /api from one process, so a
// relative path is all that's needed.
window.ISCEST_API_BASE = "/api";
