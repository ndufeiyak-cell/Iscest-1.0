# ISCEST

A professional society website: a static Tailwind front end plus an Express API, served as **one Node app** with **Supabase** providing authentication and the Postgres database.

```
iscest/
├── server.js              Express — serves public/ and /api/* from one process
├── seed.js                creates the admin account
├── package.json
├── .env / .env.example
├── public/                the website — static, no build step
│   ├── index.html, about.html, news.html, events.html, conference.html,
│   │   journals.html, membership.html, registration.html, login.html,
│   │   contact.html, dashboard.html
│   ├── assets/
│   ├── css/base.css
│   └── js/
│       ├── iscest-config.js    Supabase URL + anon key + API base — edit this
│       ├── supabase-client.js  the browser Supabase client (auth only)
│       ├── main.js             nav toggle, membership dropdown, search
│       └── admin.js            the admin dashboard
├── src/
│   ├── routes/                 API endpoints
│   ├── controllers/            users, journals, conferences
│   ├── middleware/auth.js      Supabase token check + admin guard
│   └── lib/
│       ├── supabaseAdmin.js    service-role client (server only)
│       └── mappers.js          camelCase API <-> snake_case columns
└── supabase/migrations/        the schema, as versioned SQL
```

## 1. Create the Supabase project

1. Make a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. From **Project Settings → API**, collect three values:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Apply the migrations

The schema lives in `supabase/migrations/` as four versioned files — tables, the auth→profiles trigger, the RLS policies, and the sample journals and conference.

```bash
npm install -g supabase      # or use npx supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

That's the whole schema. Nothing else needs running by hand.

To test against a throwaway local stack instead, run `supabase start` then `supabase db reset` — the migrations replay from scratch.

## 3. Configure and run

```bash
cp .env.example .env      # fill in the three Supabase values
npm install
npm run seed              # creates admin@iscest.com / changeme123
npm run dev               # http://localhost:3000
```

Express serves the site and the API on the same port, so there's nothing else to start. `npm run seed` only creates the admin account — the journals and conference come from the migration above.

**Change the seeded password before this is public.** Registration and login are otherwise fully self-service.

## 4. How authentication works

Supabase Auth owns credentials; this codebase never sees a password beyond passing it to `signUp`/`signInWithPassword` in the browser.

- **Registration** (`registration.html`) calls `supabase.auth.signUp` with the academic fields as metadata. A Postgres trigger on `auth.users` (`public.handle_new_user`) creates the matching `public.profiles` row. It **hardcodes `role = 'member'`** — metadata is attacker-controlled, so copying a role out of it would let anyone sign up as an admin.
- **Login** (`login.html`, `dashboard.html`) calls `signInWithPassword`. supabase-js stores the session and refreshes it automatically.
- **Every API call** then sends `Authorization: Bearer <access_token>`. `src/middleware/auth.js` validates it with `supabase.auth.getUser()` and loads the caller's `role` from `profiles`.

If you leave email confirmation on (the Supabase default), a new registration gets a user but no session until they click the emailed link — the form says so.

## 5. API reference

| Resource | Endpoints |
|---|---|
| Users | `GET /api/users/me` (auth), `GET /api/users` (admin) |
| Journals | `GET /api/journals`, `GET /api/journals/:id`, `POST`/`PUT`/`DELETE` (admin) |
| Conferences | `GET /api/conferences`, `GET /api/conferences?upcoming=true`, `GET /api/conferences/:id`, `POST`/`PUT`/`DELETE` (admin) |
| Health | `GET /api/health` |

`GET /api/conferences` returns tracks as a plain string array, e.g. `"tracks": ["AI & intelligent systems", ...]`.

There are deliberately **no `/api/users/register` or `/api/users/login`** endpoints — the browser goes straight to Supabase Auth.

Protected routes expect `Authorization: Bearer <token>`. `role: "admin"` is the only privilege level; promote someone with:

```sql
update public.profiles set role = 'admin' where email = 'someone@example.com';
```

## 6. Admin dashboard

`dashboard.html` (linked from the site footer as "Admin") is gated on a signed-in account whose `profiles.role` is `admin`:

- **Overview** — member, journal, and conference counts
- **Members** — read-only list of everyone who submitted the Registration Form
- **Journals** / **Conferences** — full create, edit, and delete

## 7. Deploying to Hostinger (Node.js app hosting)

The repo root *is* the app. There is no build step.

1. In hPanel, create a **Node.js application** pointing at this repo's root directory.
2. **Startup file:** `server.js`. **Node version:** 18 or newer.
3. Add the environment variables from `.env` in the app's settings — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Hostinger injects `PORT`, which `server.js` already reads.
4. Install dependencies (`npm install`).
5. Fill in `public/js/iscest-config.js` with the project URL and the **anon** key, and point `ISCEST_API_BASE` at `/api` (the default).

Because the front end and API share an origin, there is no CORS configuration and no second host to manage.

## 8. Security notes

- **The service-role key bypasses Row Level Security.** It belongs only in the server's environment. It must never appear in `public/`, including `js/iscest-config.js` — that file is meant to hold the *anon* key, which is publishable.
- **RLS is deny-by-default and read-only.** The policies in `supabase/migrations/20260928090200_rls_policies.sql` grant SELECT on public content and a member's own profile, and grant nothing else. Writes go through the service-role client after `src/middleware/auth.js` has authorized them, so a leaked anon key can't write anything.
- **`.env` is gitignored.** It previously wasn't (the old `.gitignore` was malformed), so if you're working from an older clone, check `git log -- backend/.env` — any secret in that history should be rotated.
