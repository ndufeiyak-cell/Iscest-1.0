const express = require("express");
const router = express.Router();
const {
  getConferences,
  getConference,
  createConference,
  updateConference,
  deleteConference,
} = require("../controllers/conferenceController");
const { protect, requireAdmin } = require("../middleware/auth");

router.get("/", getConferences);
router.get("/:id", getConference);
router.post("/", protect, requireAdmin, createConference);
router.put("/:id", protect, requireAdmin, updateConference);
router.delete("/:id", protect, requireAdmin, deleteConference);

module.exports = router;
