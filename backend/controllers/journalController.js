const Journal = require("../models/Journal");

async function getJournals(req, res) {
  const journals = await Journal.find().sort({ code: 1 });
  res.json(journals);
}

async function getJournal(req, res) {
  const journal = await Journal.findById(req.params.id);
  if (!journal) return res.status(404).json({ message: "Journal not found" });
  res.json(journal);
}

async function createJournal(req, res) {
  const journal = await Journal.create(req.body);
  res.status(201).json(journal);
}

async function updateJournal(req, res) {
  const journal = await Journal.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!journal) return res.status(404).json({ message: "Journal not found" });
  res.json(journal);
}

async function deleteJournal(req, res) {
  const journal = await Journal.findByIdAndDelete(req.params.id);
  if (!journal) return res.status(404).json({ message: "Journal not found" });
  res.json({ message: "Journal deleted" });
}

module.exports = { getJournals, getJournal, createJournal, updateJournal, deleteJournal };
