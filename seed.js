// Creates (or refreshes) the ISCEST admin account.
//
//   node seed.js      — or: npm run seed
//
// Only the admin account lives here, because it needs an auth.users row and
// SQL can't create one. The sample journals and the 2027 conference are
// seeded by supabase/migrations/20260928090300_seed_reference_data.sql, so
// `supabase db push` already gives you a populated site.
require("dotenv").config();
const supabaseAdmin = require("./src/lib/supabaseAdmin");

const ADMIN_EMAIL = "admin@iscest.com";
const ADMIN_PASSWORD = "changeme123";

// The auth.users trigger (public.handle_new_user) copies these into the new
// profiles row. Note there is deliberately no `role` here: the trigger
// hardcodes 'member', so admin rights can't be granted through signup.
const ADMIN_METADATA = {
  title: "Professor",
  name: "ISCEST Admin",
  affiliation: "ISCEST Secretariat",
  state: "Rivers",
  country: "Nigeria",
  tier: "Full Membership — ₦10,000",
};

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

async function findExistingUserId() {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) throw error;
  return data.users.find((u) => u.email === ADMIN_EMAIL)?.id;
}

async function main() {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true, // skip the confirmation email for the seeded account
    user_metadata: ADMIN_METADATA,
  });

  let userId = data?.user?.id;

  if (error) {
    // Already seeded on a previous run — that's fine, just re-promote.
    if (!/already|exists|registered/i.test(error.message)) throw error;

    userId = await findExistingUserId();
    if (!userId) {
      throw new Error(`Supabase reports ${ADMIN_EMAIL} exists, but it wasn't in the user list.`);
    }
    console.log(`${ADMIN_EMAIL} already exists — updating it instead.`);
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
  const { error: promoteError } = await supabaseAdmin
    .from("profiles")
    .update({ role: "admin", membership_status: "active" })
    .eq("id", userId);

  if (promoteError) throw promoteError;

  console.log(`Admin ready: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log("Change that password before using this anywhere real.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
