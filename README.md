# ISCEST

A professional society website: a static Tailwind front end plus an Express + MongoDB REST API for membership accounts, journals, and conferences.

> Backend stack assumed as Node.js / Express / MongoDB, matching what was used earlier in this project. Swap it out if you had a different stack in mind.

```
iscest/
├── index.html, about.html, news.html, events.html,   Front end — static
│   conference.html, journals.html, membership.html,   HTML + Tailwind (via CDN)
│   registration.html, login.html, contact.html
├── assets/
│   ├── logo.svg          header/footer logo
│   └── vision.svg         homepage "Our vision" illustration
├── css/base.css            the handful of styles Tailwind utilities don't cover
├── js/main.js               nav toggle, membership dropdown, search, contact demo
├── backend/                  Express REST API
│   ├── server.js
│   ├── config/db.js
│   ├── models/                 User, Journal, Conference (Mongoose schemas)
│   ├── controllers/            CRUD + auth logic
│   ├── routes/                  API endpoints
│   ├── middleware/auth.js       JWT auth + admin guard
│   └── seed.js                   sample journals, a conference, an admin account
└── README.md
```

## 1. Run the front end

Static, no build step — open `index.html` directly, or serve the folder:

```bash
npx serve .
```

Tailwind and Google Fonts load from CDNs, so an internet connection is needed to see the styling.

## 2. Run the backend

**Requirements:** Node.js 18+, a MongoDB connection string (local `mongod` or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster).

```bash
cd backend
npm install
cp .env.example .env      # fill in MONGO_URI and JWT_SECRET
npm run dev                 # nodemon, restarts on save
```

Load sample data (3 journals, the 2027 conference, an admin account):

```bash
node seed.js
```

The API runs at `http://localhost:5000` by default.

## 3. How the front end talks to the API

`registration.html` and `login.html` already call the API directly:

- **Registration Form** → `POST /api/users/register` with `{ name, email, password, institution, country, tier, interest }`. On success it stores the returned JWT in `localStorage` under `iscest_token`.
- **Login** → `POST /api/users/login` with `{ email, password }`, same token handling.

If the API isn't running, both forms show a friendly "couldn't reach the API" message instead of failing silently — that's expected until you start the backend.

To point the front end at a deployed API instead of `localhost:5000`, set `window.ISCEST_API_BASE = "https://your-api.example.com/api";` in a `<script>` tag before `js/main.js` loads on any page.

`journals.html` and `conference.html` currently show static placeholder content — wire them to `GET /api/journals` and `GET /api/conferences?upcoming=true` the same way the registration form calls the API, once you're ready to make them live.

## 4. API reference

| Resource | Endpoints | Notes |
|---|---|---|
| Users / accounts | `POST /api/users/register`, `POST /api/users/login`, `GET /api/users/me` (auth), `GET /api/users` (admin) | Registration doubles as account creation — `tier` and `interest` come straight from the Registration Form |
| Journals | `GET /api/journals`, `GET /api/journals/:id`, `POST/PUT/DELETE` (admin) | `frequency`: continuous / quarterly / biannual / annual |
| Conferences | `GET /api/conferences`, `GET /api/conferences?upcoming=true`, `GET /api/conferences/:id`, `POST/PUT/DELETE` (admin) | `startDate` / `endDate` / `submissionDeadline` are real `Date` fields |

Protected routes expect `Authorization: Bearer <token>`. The seeded admin (`admin@iscest.org` / `changeme123`) can create and edit journals and conferences — change that password before using it anywhere real.

## 5. Deployment

| Piece | Suggested host |
|---|---|
| Front end | Netlify, Vercel, or GitHub Pages |
| Backend | Render, Railway, or Fly.io — set `MONGO_URI`, `JWT_SECRET`, `CLIENT_ORIGIN` as environment variables |
| Database | MongoDB Atlas free tier |

After deploying, update `CLIENT_ORIGIN` on the backend and `window.ISCEST_API_BASE` on the front end to point at each other.
