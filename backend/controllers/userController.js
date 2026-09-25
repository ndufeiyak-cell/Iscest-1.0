const jwt = require("jsonwebtoken");
const User = require("../models/User");

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// POST /api/users/register  — backs the Registration Form page
// body: { name, email, password, institution, country, tier, interest }
async function register(req, res) {
  const { name, email, password, institution, country, tier, interest } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email and password are required" });
  }

  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ message: "Email already registered" });

  const user = await User.create({ name, email, password, institution, country, tier, interest });

  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    tier: user.tier,
    membershipStatus: user.membershipStatus,
    token: signToken(user),
  });
}

// POST /api/users/login  — backs the Login / Account page
async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }
  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    tier: user.tier,
    membershipStatus: user.membershipStatus,
    token: signToken(user),
  });
}

// GET /api/users/me  (protected)
async function getProfile(req, res) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
}

// GET /api/users  (admin — list member registrations)
async function listUsers(req, res) {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users);
}

module.exports = { register, login, getProfile, listUsers };
