const supabaseAdmin = require("../lib/supabaseAdmin");
const { PROFILE_COLUMNS, MEMBERSHIP_STATUSES } = require("../lib/mappers");

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

// PATCH /api/users/:id/status  (admin — confirm a member's payment, expire
// a lapsed one, or put one back to pending)
//
// Deliberately narrow: this endpoint can only ever touch membership_status.
// A general PUT /users/:id would also make `role` writable, which is the one
// column that grants admin access — keeping the two apart means a mistake
// here can't escalate anyone's privileges. `role` is set in exactly one
// place: seed.js.
async function updateMembershipStatus(req, res) {
  const { membershipStatus } = req.body;

  if (!MEMBERSHIP_STATUSES.includes(membershipStatus)) {
    return res.status(400).json({
      message: `membershipStatus must be one of: ${MEMBERSHIP_STATUSES.join(", ")}`,
    });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ membership_status: membershipStatus })
    .eq("id", req.params.id)
    .select(PROFILE_COLUMNS)
    .maybeSingle();

  if (error) return res.status(400).json({ message: error.message });
  if (!data) return res.status(404).json({ message: "Member not found" });
  res.json(data);
}

module.exports = { getProfile, listUsers, updateMembershipStatus };
