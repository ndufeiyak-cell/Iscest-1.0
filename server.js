require("dotenv").config();

const path = require("path");
const express = require("express");
const morgan = require("morgan");

// Required first so a missing/invalid Supabase config fails immediately with
// a clear message, rather than on the first request.
const supabaseAdmin = require("./src/lib/supabaseAdmin");

const userRoutes = require("./src/routes/users");
const journalRoutes = require("./src/routes/journals");
const conferenceRoutes = require("./src/routes/conferences");

const app = express();

app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => res.json({ message: "ISCEST API is running" }));

// API routes mount before the static handler, so /api/* is never served a
// stray file, and an unknown /api path gets a JSON 404 instead of falling
// through to the site.
app.use("/api/users", userRoutes);
app.use("/api/journals", journalRoutes);
app.use("/api/conferences", conferenceRoutes);
app.use("/api", (req, res) => res.status(404).json({ message: "Route not found" }));

// Browser auth config comes from .env so the dashboard and member login
// use the same project as the API. Served before static so this wins over
// public/js/iscest-config.js. Only the publishable anon key is exposed.
app.get("/js/iscest-config.js", (req, res) => {
  const url = process.env.SUPABASE_URL || "";
  const anon = process.env.SUPABASE_ANON_KEY || "";
  res
    .type("application/javascript")
    .send(
      `window.ISCEST_SUPABASE_URL = ${JSON.stringify(url)};\n` +
        `window.ISCEST_SUPABASE_ANON_KEY = ${JSON.stringify(anon)};\n` +
        `window.ISCEST_API_BASE = "/api";\n`
    );
});

// The site itself. Served from public/ rather than the repo root so that
// server.js, package.json, node_modules/ and supabase/migrations/ are not
// published to the web.
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res) => res.status(404).json({ message: "Not found" }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

const PORT = process.env.PORT || 3000;

// Vercel finds a Node server by the listen() call made while this module
// loads, and routes requests to it. That call is the only thing that makes
// /api/* reachable in production: hide it behind a `require.main === module`
// check and Vercel sees no server at all, publishes public/ as a static site
// instead, and every API call 404s at the platform before reaching Express.
//
// The PORT below applies locally; Vercel uses its own internal port and does
// not expose this one.
app.listen(PORT, () => console.log(`ISCEST listening on http://localhost:${PORT}`));

// Best-effort connectivity check, logged but never fatal — the static pages
// should keep serving even if Supabase is briefly unreachable.
supabaseAdmin
  .from("journals")
  .select("id", { count: "exact", head: true })
  .then(({ error }) => {
    if (error) console.warn(`Supabase check failed: ${error.message}`);
    else console.log("Connected to Supabase");
  });
