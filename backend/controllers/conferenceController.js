const prisma = require("../lib/prisma");

// Prisma returns tracks as [{ id, name, conferenceId }]; the front end just wants string names.
function withTrackNames(conference) {
  return { ...conference, tracks: conference.tracks.map((t) => t.name) };
}

// Converts the date-string fields the front end sends into real Date objects for Prisma.
function parseDates(body) {
  const out = { ...body };
  if (out.startDate) out.startDate = new Date(out.startDate);
  if (out.endDate) out.endDate = new Date(out.endDate);
  if (out.submissionDeadline) out.submissionDeadline = new Date(out.submissionDeadline);
  return out;
}

// GET /api/conferences?upcoming=true
async function getConferences(req, res) {
  const where = req.query.upcoming === "true" ? { startDate: { gte: new Date() } } : {};
  const conferences = await prisma.conference.findMany({
    where,
    include: { tracks: true },
    orderBy: { startDate: "asc" },
  });
  res.json(conferences.map(withTrackNames));
}

async function getConference(req, res) {
  const conference = await prisma.conference.findUnique({
    where: { id: req.params.id },
    include: { tracks: true },
  });
  if (!conference) return res.status(404).json({ message: "Conference not found" });
  res.json(withTrackNames(conference));
}

async function createConference(req, res) {
  const { tracks = [], ...rest } = parseDates(req.body);
  const conference = await prisma.conference.create({
    data: { ...rest, tracks: { create: tracks.map((name) => ({ name })) } },
    include: { tracks: true },
  });
  res.status(201).json(withTrackNames(conference));
}

async function updateConference(req, res) {
  const { tracks, ...rest } = parseDates(req.body);
  try {
    if (tracks) {
      await prisma.conferenceTrack.deleteMany({ where: { conferenceId: req.params.id } });
    }
    const conference = await prisma.conference.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(tracks ? { tracks: { create: tracks.map((name) => ({ name })) } } : {}),
      },
      include: { tracks: true },
    });
    res.json(withTrackNames(conference));
  } catch (err) {
    res.status(404).json({ message: "Conference not found" });
  }
}

async function deleteConference(req, res) {
  try {
    await prisma.conference.delete({ where: { id: req.params.id } });
    res.json({ message: "Conference deleted" });
  } catch (err) {
    res.status(404).json({ message: "Conference not found" });
  }
}

module.exports = { getConferences, getConference, createConference, updateConference, deleteConference };
