const express = require("express");
const router = express.Router();
const { register, login, getProfile, listUsers } = require("../controllers/userController");
const { protect, requireAdmin } = require("../middleware/auth");

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getProfile);
router.get("/", protect, requireAdmin, listUsers);

module.exports = router;
