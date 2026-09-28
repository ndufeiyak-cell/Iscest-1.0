const supabaseAdmin = require("../lib/supabaseAdmin");

// Verifies the Supabase access token the browser got from supabase-js and
// loads the caller's profile, so `req.userRole` can drive requireAdmin.
//
// Uses auth.getUser() rather than verifying the JWT locally: Supabase has
// deprecated the legacy shared HS256 secret in favour of asymmetric signing
// keys, and getUser() is signature-agnostic so it keeps working either way.
// The cost is one round-trip per protected request, which is fine at this
// traffic level. If that ever matters, the upgrade path is a short-TTL cache
// of this result or an Auth Hook that puts `role` in the token claims.
async function protect(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    const token = header.slice("Bearer ".length);
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ message: "Not authorized, token invalid" });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return res.status(403).json({ message: "No profile for this account" });
    }

    req.userId = data.user.id;
    req.userRole = profile.role;
    next();
  } catch (err) {
    res.status(401).json({ message: "Not authorized, token invalid" });
  }
}

function requireAdmin(req, res, next) {
  if (req.userRole !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

module.exports = { protect, requireAdmin };
