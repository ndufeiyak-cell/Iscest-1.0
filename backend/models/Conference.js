const mongoose = require("mongoose");

const conferenceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    location: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    tracks: [{ type: String }],
    registrationOpen: { type: Boolean, default: true },
    submissionDeadline: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conference", conferenceSchema);
