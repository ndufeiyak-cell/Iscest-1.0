// Run with: node seed.js
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");
const Journal = require("./models/Journal");
const Conference = require("./models/Conference");

const journals = [
  { code: "JCS", title: "Journal of Computational Systems", issn: "2411-0091", frequency: "continuous", description: "Distributed systems, algorithms, and computational theory." },
  { code: "JAT", title: "Journal of Applied Technology", issn: "2411-0108", frequency: "quarterly", description: "Robotics, applied machine learning, and hardware-software systems." },
  { code: "JSE", title: "Journal of Sustainable Engineering", issn: "2411-0115", frequency: "biannual", description: "Energy-efficient computing and green infrastructure research." },
];

const conferences = [
  {
    title: "ISCEST 2027 Annual Conference",
    startDate: new Date("2027-06-14"),
    endDate: new Date("2027-06-17"),
    location: "Lisbon, Portugal",
    tracks: ["AI & intelligent systems", "Embedded & hardware engineering", "Sustainable computing"],
    submissionDeadline: new Date("2027-01-30"),
    description: "Four days of keynotes, technical sessions, and poster presentations.",
  },
];

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    await Journal.deleteMany({});
    await Journal.insertMany(journals);

    await Conference.deleteMany({});
    await Conference.insertMany(conferences);

    const adminExists = await User.findOne({ email: "admin@iscest.org" });
    if (!adminExists) {
      await User.create({
        name: "ISCEST Admin",
        email: "admin@iscest.org",
        password: "changeme123",
        role: "admin",
        membershipStatus: "active",
        tier: "Institutional — $450/yr",
      });
    }

    console.log(`Seeded ${journals.length} journals, ${conferences.length} conference(s), and an admin account.`);
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
})();
