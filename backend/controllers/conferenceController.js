const Conference = require("../models/Conference");

// GET /api/conferences?upcoming=true
async function getConferences(req, res) {
  const filter = {};
  if (req.query.upcoming === "true") {
    filter.startDate = { $gte: new Date() };
  }
  const conferences = await Conference.find(filter).sort({ startDate: 1 });
  res.json(conferences);
}

async function getConference(req, res) {
  const conference = await Conference.findById(req.params.id);
  if (!conference) return res.status(404).json({ message: "Conference not found" });
  res.json(conference);
}

async function createConference(req, res) {
  const conference = await Conference.create(req.body);
  res.status(201).json(conference);
}

async function updateConference(req, res) {
  const conference = await Conference.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!conference) return res.status(404).json({ message: "Conference not found" });
  res.json(conference);
}

async function deleteConference(req, res) {
  const conference = await Conference.findByIdAndDelete(req.params.id);
  if (!conference) return res.status(404).json({ message: "Conference not found" });
  res.json({ message: "Conference deleted" });
}

module.exports = { getConferences, getConference, createConference, updateConference, deleteConference };
