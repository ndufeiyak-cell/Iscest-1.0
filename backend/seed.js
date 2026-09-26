// Run with: node seed.js  (or: npm run seed)
require("dotenv").config();
const bcrypt = require("bcryptjs");
const prisma = require("./lib/prisma");

const journals = [
  { code: "JCS", title: "Journal of Computational Systems", issn: "2411-0091", frequency: "continuous", description: "Distributed systems, algorithms, and computational theory." },
  { code: "JAT", title: "Journal of Applied Technology", issn: "2411-0108", frequency: "quarterly", description: "Robotics, applied machine learning, and hardware-software systems." },
  { code: "JSE", title: "Journal of Sustainable Engineering", issn: "2411-0115", frequency: "biannual", description: "Energy-efficient computing and green infrastructure research." },
];

async function main() {
  // Clear existing data (children first, to respect the foreign key)
  await prisma.conferenceTrack.deleteMany();
  await prisma.conference.deleteMany();
  await prisma.journal.deleteMany();

  await prisma.journal.createMany({ data: journals });

  await prisma.conference.create({
    data: {
      title: "ISCEST 2027 Annual Conference",
      startDate: new Date("2027-06-14"),
      endDate: new Date("2027-06-17"),
      location: "Lisbon, Portugal",
      submissionDeadline: new Date("2027-01-30"),
      description: "Four days of keynotes, technical sessions, and poster presentations.",
      tracks: {
        create: [
          { name: "AI & intelligent systems" },
          { name: "Embedded & hardware engineering" },
          { name: "Sustainable computing" },
        ],
      },
    },
  });

  const adminExists = await prisma.user.findUnique({ where: { email: "admin@iscest.com" } });
  if (!adminExists) {
    const hashed = await bcrypt.hash("changeme123", 10);
    await prisma.user.create({
      data: {
        name: "ISCEST Admin",
        email: "admin@iscest.com",
        password: hashed,
        role: "admin",
        membershipStatus: "active",
        tier: "Full Membership — ₦10,000",
      },
    });
  }

  console.log(`Seeded ${journals.length} journals, 1 conference, and an admin account (if it didn't already exist).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
