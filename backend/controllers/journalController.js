const prisma = require("../lib/prisma");

async function getJournals(req, res) {
  const journals = await prisma.journal.findMany({ orderBy: { code: "asc" } });
  res.json(journals);
}

async function getJournal(req, res) {
  const journal = await prisma.journal.findUnique({ where: { id: req.params.id } });
  if (!journal) return res.status(404).json({ message: "Journal not found" });
  res.json(journal);
}

async function createJournal(req, res) {
  const journal = await prisma.journal.create({ data: req.body });
  res.status(201).json(journal);
}

async function updateJournal(req, res) {
  try {
    const journal = await prisma.journal.update({ where: { id: req.params.id }, data: req.body });
    res.json(journal);
  } catch (err) {
    res.status(404).json({ message: "Journal not found" });
  }
}

async function deleteJournal(req, res) {
  try {
    await prisma.journal.delete({ where: { id: req.params.id } });
    res.json({ message: "Journal deleted" });
  } catch (err) {
    res.status(404).json({ message: "Journal not found" });
  }
}

module.exports = { getJournals, getJournal, createJournal, updateJournal, deleteJournal };
