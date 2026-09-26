const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// Strips the password hash before a user object goes back to the client.
function publicUser(user) {
  const { password, ...rest } = user;
  return rest;
}

// POST /api/users/register  — backs the Registration Form page
// body: { title, name, sex, email, password, affiliation, department, city, state, country, telephone, specialization, tier }
async function register(req, res) {
  const {
    title, name, sex, email, password,
    affiliation, department, city, state, country,
    telephone, specialization, tier,
  } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email and password are required" });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(400).json({ message: "Email already registered" });

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      title, name, sex, email, password: hashed,
      affiliation, department, city, state, country,
      telephone, specialization, tier,
    },
  });

  res.status(201).json({ ...publicUser(user), token: signToken(user) });
}

// POST /api/users/login  — backs the Login / Account page
async function login(req, res) {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }
  res.json({ ...publicUser(user), token: signToken(user) });
}

// GET /api/users/me  (protected)
async function getProfile(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(publicUser(user));
}

// GET /api/users  (admin — list member registrations)
async function listUsers(req, res) {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  res.json(users.map(publicUser));
}

module.exports = { register, login, getProfile, listUsers };
