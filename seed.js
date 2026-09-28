// Creates (or refreshes) the ISCEST admin account(s).
//
//   node seed.js      — or: npm run seed
//
// ADMIN_EMAIL may list several admins, comma-separated; each gets its own
// account.
//
// Only the admin account lives here, because it needs an auth.users row and
// SQL can't create one. The sample journals and the 2027 conference are
// seeded by supabase/migrations/20260928090300_seed_reference_data.sql, so
// `supabase db push` already gives you a populated site.
require("dotenv").config();
const supabaseAdmin = require("./src/lib/supabaseAdmin");

// ADMIN_EMAIL takes one address or several, comma-separated — one admin
// account is created per address. It used to be handed to createUser() as a
// single string, so a list was rejected outright with the unhelpful
// "Unable to validate email address: invalid format".
//
// Lowercased because Supabase Auth stores and compares addresses that way:
// createUser() treats "Matthew@x.com" as already existing, but listUsers()
// hands back "matthew@x.com", so an un-normalised address fails to match
// itself and the re-promote path reports the account as missing.
const ADMIN_EMAILS = String(process.env.ADMIN_EMAIL || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (ADMIN_EMAILS.length === 0 || !ADMIN_PASSWORD) {
  console.error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
  process.exit(1);
}

// Caught here because Supabase's error names the whole value, not the entry
// inside it that was actually wrong.
const malformed = ADMIN_EMAILS.filter((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
if (malformed.length) {
  console.error(
    `ADMIN_EMAIL has ${malformed.length} entr${malformed.length === 1 ? "y" : "ies"} that don't look like an email address:\n` +
      malformed.map((email) => `  • ${email}`).join("\n") +
      "\nSeparate multiple admins with commas."
  );
  process.exit(1);
}

// Re-running `npm run seed` re-promotes the existing account but normally
// leaves its password alone, so a password changed from the dashboard's
// Account tab survives. Set ADMIN_RESET_PASSWORD=true to deliberately put
// the .env password back — the recovery route if that password is lost.
const RESET_PASSWORD = /^(1|true|yes)$/i.test(process.env.ADMIN_RESET_PASSWORD || "");

// The auth.users trigger (public.handle_new_user) copies these into the new
// profiles row. Note there is deliberately no `role` here: the trigger
// hardcodes 'member', so admin rights can't be granted through signup.
// `name` is filled in per address by metadataFor() below.
const ADMIN_METADATA = {
  title: "Professor",
  affiliation: "ISCEST Secretariat",
  state: "Rivers",
  country: "Nigeria",
  tier: "Full Membership — ₦10,000",
};

// What the trigger used to write for every seeded admin. A profile still
// carrying it is one this script made, so it's safe to rename. Anything else
// is a name someone gave us.
const PLACEHOLDER_NAME = "ISCEST Admin";

// "Matthew.wegwu@uniport.edu.ng" → "Matthew Wegwu". This is a guess from the
// address rather than a name anyone told us, so it's deliberately rough:
// words that are all one case get capitalised, mixed-case ones are left
// exactly as typed so "McDonald" and "DeVries" survive.
function displayName(email) {
  const words = email
    .split("@")[0]
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((word) =>
      word === word.toLowerCase() || word === word.toUpperCase()
        ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        : word
    );

  return words.join(" ") || PLACEHOLDER_NAME;
}

const metadataFor = (email) => ({ ...ADMIN_METADATA, name: displayName(email) });

// The trigger runs inside Supabase's own insert, so the profiles row should
// already exist by the time createUser() resolves. Poll briefly anyway
// rather than assume it.
async function waitForProfile(userId, attempts = 10) {
  for (let i = 0; i < attempts; i += 1) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (data) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

async function findExistingUserId(email) {
  // perPage is raised well past the default 50: the admin list has to be
  // found among every registered member, so the default would silently miss
  // it on a site with more than fifty signups.
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email)?.id;
}

async function seedAdmin(email) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: ADMIN_PASSWORD,
    email_confirm: true, // skip the confirmation email for the seeded account
    user_metadata: metadataFor(email),
  });

  let userId = data?.user?.id;
  const created = !error;

  if (error) {
    // Already seeded on a previous run — that's fine, just re-promote.
    if (!/already|exists|registered/i.test(error.message)) throw error;

    userId = await findExistingUserId(email);
    if (!userId) {
      throw new Error(`Supabase reports ${email} exists, but it wasn't in the user list.`);
    }

    // Password is only included when explicitly asked for, so a password
    // changed in the dashboard isn't silently reverted by a re-seed.
    const updates = { email_confirm: true, user_metadata: metadataFor(email) };
    if (RESET_PASSWORD) updates.password = ADMIN_PASSWORD;

    console.log(
      RESET_PASSWORD
        ? `${email} already exists — resetting its password to ADMIN_PASSWORD from .env.`
        : `${email} already exists — re-promoting to admin, leaving its password alone.`
    );

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, updates);
    if (updateError) throw updateError;
  }

  if (!(await waitForProfile(userId))) {
    throw new Error(
      `No profiles row appeared for ${userId}. Check that the on_auth_user_created trigger from ` +
        `supabase/migrations/20260928090100_auth_profiles.sql was applied.`
    );
  }

  // role is not settable through signup metadata, so promotion is a
  // separate privileged write. This is the only place `role` is set to
  // 'admin' in the whole codebase.
  //
  // user_metadata is only read by the INSERT trigger, so a re-seed never
  // rewrites an existing profile — which is why the display name has to be
  // repaired here. Only a name still sitting at PLACEHOLDER_NAME is touched:
  // johnnwok@gmail.com is both an admin and an ordinary member who
  // registered for themselves, and their real name must survive a re-seed.
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .maybeSingle();

  const promote = { role: "admin", membership_status: "active" };
  if (!profile?.name || profile.name === PLACEHOLDER_NAME) {
    promote.name = displayName(email);
  }

  const { error: promoteError } = await supabaseAdmin
    .from("profiles")
    .update(promote)
    .eq("id", userId);

  if (promoteError) throw promoteError;

  console.log(`Admin ready: ${email}`);
  if (created) {
    console.log("  Password is the ADMIN_PASSWORD from .env — you can change it from the dashboard's Account tab.");
  } else if (RESET_PASSWORD) {
    console.log("  Password reset to the ADMIN_PASSWORD from .env.");
  } else {
    console.log("  Password left as-is. Set ADMIN_RESET_PASSWORD=true to force it back to the .env value.");
  }
}

async function main() {
  // Sequential rather than parallel: a failure should stop with the address
  // it failed on at the bottom of the output, not race three requests.
  for (const email of ADMIN_EMAILS) {
    await seedAdmin(email);
  }
  if (ADMIN_EMAILS.length > 1) {
    console.log(`\n${ADMIN_EMAILS.length} admin accounts ready.`);
  }
}

main().catch((err) => {
  // undici reports any network failure as a bare "fetch failed" and hides the
  // part that tells you what to do — ENOTFOUND (DNS), ECONNREFUSED, a TLS
  // error — in a nested `cause`. Unwrap it, or a typo'd SUPABASE_URL and a
  // dead wifi connection look identical.
  console.error(err.message || err);
  if (err.cause) {
    console.error(`  ↳ ${err.cause.code || err.cause.name || "cause"}: ${err.cause.message || err.cause}`);
  } else if (err.message === "fetch failed") {
    console.error(`  ↳ Couldn't reach ${process.env.SUPABASE_URL} — check your connection and that SUPABASE_URL is right.`);
  }
  process.exit(1);
});
