const mongoose = require("mongoose");

const journalSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true }, // e.g. "JCS"
    title: { type: String, required: true, trim: true },
    issn: { type: String, trim: true },
    description: { type: String, default: "" },
    frequency: {
      type: String,
      enum: ["continuous", "quarterly", "biannual", "annual"],
      default: "quarterly",
    },
    openAccess: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Journal", journalSchema);
