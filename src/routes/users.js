const express = require("express");
const router = express.Router();
const { getProfile, listUsers, updateMembershipStatus } = require("../controllers/userController");
const { protect, requireAdmin } = require("../middleware/auth");

// No /register or /login here any more — the browser signs users up and in
// through Supabase Auth directly (public/js/supabase-client.js). This API
// only reads the profile rows that Supabase's auth.users trigger creates.
router.get("/me", protect, getProfile);
router.get("/", protect, requireAdmin, listUsers);
router.patch("/:id/status", protect, requireAdmin, updateMembershipStatus);

module.exports = router;
