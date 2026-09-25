const express = require("express");
const router = express.Router();
const {
  getJournals,
  getJournal,
  createJournal,
  updateJournal,
  deleteJournal,
} = require("../controllers/journalController");
const { protect, requireAdmin } = require("../middleware/auth");

router.get("/", getJournals);
router.get("/:id", getJournal);
router.post("/", protect, requireAdmin, createJournal);
router.put("/:id", protect, requireAdmin, updateJournal);
router.delete("/:id", protect, requireAdmin, deleteJournal);

module.exports = router;
