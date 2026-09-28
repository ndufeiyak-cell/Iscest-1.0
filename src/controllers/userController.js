const supabaseAdmin = require("../lib/supabaseAdmin");
const { PROFILE_COLUMNS } = require("../lib/mappers");

// Registration and login are gone from this API on purpose: the browser
// talks to Supabase Auth directly via supabase-js (see
// public/js/supabase-client.js), so Supabase owns hashing, email
// confirmation, password reset and session tokens. What's left here is
// reading the profile row that the auth.users trigger creates.

// GET /api/users/me  (protected)
async function getProfile(req, res) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", req.userId)
    .maybeSingle();

  if (error) return res.status(500).json({ message: "Couldn't load your profile" });
  if (!data) return res.status(404).json({ message: "User not found" });
  res.json(data);
}

// GET /api/users  (admin — list member registrations, newest first)
async function listUsers(req, res) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ message: "Couldn't load members" });
  res.json(data);
}

module.exports = { getProfile, listUsers };
