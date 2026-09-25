const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    institution: { type: String, trim: true },
    country: { type: String, trim: true },
    tier: {
      type: String,
      enum: ["Student — $25/yr", "Professional — $95/yr", "Institutional — $450/yr"],
      default: "Student — $25/yr",
    },
    interest: { type: String, trim: true },
    role: { type: String, enum: ["member", "admin"], default: "member" },
    membershipStatus: { type: String, enum: ["pending", "active", "expired"], default: "pending" },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);
