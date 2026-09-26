require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const prisma = require("./lib/prisma");

const userRoutes = require("./routes/users");
const journalRoutes = require("./routes/journals");
const conferenceRoutes = require("./routes/conferences");

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => res.json({ message: "ISCEST API is running" }));

app.use("/api/users", userRoutes);
app.use("/api/journals", journalRoutes);
app.use("/api/conferences", conferenceRoutes);

app.use((req, res) => res.status(404).json({ message: "Route not found" }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

const PORT = process.env.PORT || 5000;

prisma
  .$connect()
  .then(() => {
    console.log("Connected to PostgreSQL via Prisma");
    app.listen(PORT, () => console.log(`ISCEST API listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  });
