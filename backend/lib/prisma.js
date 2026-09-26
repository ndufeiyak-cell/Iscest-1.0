// Reuses one PrismaClient across the app instead of creating a new one per request/reload.
const { PrismaClient } = require("@prisma/client");

const prisma = global.__iscestPrisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") global.__iscestPrisma = prisma;

module.exports = prisma;
