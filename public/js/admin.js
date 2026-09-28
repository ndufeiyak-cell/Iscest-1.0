// ISCEST — admin dashboard
//
// Auth is Supabase's: the session comes from supabase-js and the access
// token goes to our own API, which is what actually authorizes admin
// actions. Nothing here is a security boundary — it only decides what to
// render. `role === "admin"` is re-checked server-side on every request.

const loginGate = document.getElementById("loginGate");
const dashApp = document.getElementById("dashApp");
const dashError = document.getElementById("dashError");

// Rows are built from values users typed into the Registration Form, so
// everything interpolated into HTML is escaped. Action buttons carry a
// data-id and are handled by delegation below — an inline onclick holding a
// serialized object would let a journal title break out of the attribute.
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function showError(msg) {
  dashError.textContent = msg;
  dashError.classList.remove("hidden");
}
function clearError() {
  dashError.classList.add("hidden");
}

// Wraps the shared iscestApi() helper: if the API rejects our token, drop
// the session and fall back to the login gate instead of leaving the
// dashboard showing empty tables.
async function apiFetch(path, options) {
  const res = await window.iscestApi(path, options);
  if (res.status === 401) {
    await window.iscestSupabase.auth.signOut();
    await checkAuth();
    throw new Error("Your session expired — please sign in again.");
  }
  return res;
}

/* ---------- Auth gate ---------- */
let currentProfile = null;

async function checkAuth() {
  const { data } = await window.iscestSupabase.auth.getSession();
  const session = data?.session;

  // The role isn't in the session — it lives in the profiles table, so ask
  // the API for it.
  let profile = null;
  if (session) {
    try {
      const res = await window.iscestApi("/users/me");
      if (res.ok) profile = await res.json();
    } catch (err) {
      /* network hiccup — treated as "not signed in" below */
    }
  }

  if (session && profile?.role === "admin") {
    currentProfile = profile;
    loginGate.classList.add("hidden");
    dashApp.classList.remove("hidden");
    document.getElementById("dashUserName").textContent = profile.name || "Admin";
    document.getElementById("accountEmail").textContent = profile.email || "—";
    loadOverview();
    return true;
  }

  currentProfile = null;
  loginGate.classList.remove("hidden");
  dashApp.classList.add("hidden");

  // A non-admin who is signed in gets told why, rather than being shown a
  // login form they'd only fail against.
  const note = document.getElementById("dashLoginNote");
  if (session && profile && profile.role !== "admin") {
    note.className = "text-sm min-h-[1.2em] text-clay";
    note.textContent = `${profile.name || "This account"} doesn't have admin access.`;
  } else if (note) {
    note.textContent = "";
  }
  return false;
}

document.getElementById("dashLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const note = document.getElementById("dashLoginNote");
  note.className = "text-sm min-h-[1.2em] text-inksoft";
  note.textContent = "Signing in…";

  if (!window.iscestSupabase) {
    note.className = "text-sm min-h-[1.2em] text-clay";
    note.textContent = "Authentication isn't configured — check js/iscest-config.js.";
    return;
  }

  const { error } = await window.iscestSupabase.auth.signInWithPassword({
    email: document.getElementById("dashEmail").value,
    password: document.getElementById("dashPassword").value,
  });

  if (error) {
    note.className = "text-sm min-h-[1.2em] text-clay";
    note.textContent = error.message;
    return;
  }

  note.textContent = "";
  checkAuth();
});

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await window.iscestSupabase.auth.signOut();
  checkAuth();
});

/* ---------- Tabs ---------- */
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("text-ink", "font-semibold", "border-b-2", "border-gold"));
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.add("text-inksoft"));
    btn.classList.add("text-ink", "font-semibold", "border-b-2", "border-gold");
    btn.classList.remove("text-inksoft");

    const tab = btn.dataset.tab;
    document.querySelectorAll("[data-panel]").forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== tab));
    clearError();
    if (tab === "members") loadMembers();
    if (tab === "journals") loadJournals();
    if (tab === "conferences") loadConferences();
  });
});
document.querySelector('.tab-btn[data-tab="overview"]')?.classList.add("text-ink", "font-semibold", "border-b-2", "border-gold");

/* ---------- Overview ---------- */
async function loadOverview() {
  try {
    const [usersRes, journalsRes, conferencesRes] = await Promise.all([
      apiFetch("/users"),
      apiFetch("/journals"),
      apiFetch("/conferences"),
    ]);
    const [users, journals, conferences] = await Promise.all([
      usersRes.json(),
      journalsRes.json(),
      conferencesRes.json(),
    ]);

    document.getElementById("statMembers").textContent = Array.isArray(users) ? users.length : "—";
    document.getElementById("statActive").textContent = Array.isArray(users) ? users.filter((u) => u.membershipStatus === "active").length : "—";
    document.getElementById("statJournals").textContent = Array.isArray(journals) ? journals.length : "—";
    document.getElementById("statConferences").textContent = Array.isArray(conferences) ? conferences.length : "—";
  } catch (err) {
    showError(err.message || "Couldn't load the overview.");
  }
}

/* ---------- Members ---------- */
// A profile row carries fourteen fields, which is more than fits across a
// readable table. So the columns group them: the four that describe who
// someone is and where they are get stacked inside a cell, the rest live in
// a details row that opens on demand. Every field stays reachable — nothing
// is dropped, it's just ranked.
const membersBody = document.getElementById("membersBody");
const memberSearch = document.getElementById("memberSearch");
let members = [];

// Tier values arrive as "Full Membership — ₦10,000", so the fee is split off
// as a sub-line instead of stretching the column.
function tierParts(tier) {
  const [name, ...rest] = String(tier ?? "").split(" — ");
  return { name: name.trim(), note: rest.join(" — ").trim() };
}

// Mirrors the check constraint on profiles.membership_status (see
// src/lib/mappers.js). "active" is what an admin picks once a member's
// payment has come through.
const MEMBERSHIP_STATUSES = ["pending", "active", "expired"];

// The status a row shows for a member. Constrained to three values, so
// anything else can only mean the row was edited outside the API: an
// unrecognised value is surfaced as-is, while a null/absent one falls back to
// "pending". Shared by the render and by the rollback after a failed save, so
// the two can't disagree about what the control should be showing.
function shownStatus(u) {
  if (MEMBERSHIP_STATUSES.includes(u.membershipStatus)) return u.membershipStatus;
  return u.membershipStatus || "pending";
}

function memberRow(u) {
  const tier = tierParts(u.tier);
  const location = [u.city, u.state].filter(Boolean).join(", ");
  const isAdmin = u.role === "admin";
  const id = escapeHtml(u.id);

  // An unrecognised status gets its own disabled option so it's visible but
  // can't be re-selected; the three valid ones are always offered.
  const status = shownStatus(u);
  const unrecognised = MEMBERSHIP_STATUSES.includes(status) ? null : status;
  const statuses = unrecognised ? [unrecognised, ...MEMBERSHIP_STATUSES] : MEMBERSHIP_STATUSES;
  const owner = escapeHtml(u.name) || "this member";

  // Only the fields with no column of their own — and only the ones filled in.
  const details = [
    ["Sex", u.sex],
    ["Phone", u.telephone],
    ["Specialization", u.specialization],
  ].filter(([, v]) => v);

  return `
    <tr>
      <td data-label="Member">
        <span class="font-semibold">${escapeHtml([u.title, u.name].filter(Boolean).join(" ")) || "—"}</span>
        <span class="pill ${isAdmin ? "pill-admin" : "pill-member"}">${isAdmin ? "Admin" : "Member"}</span>
        <span class="cell-sub">${escapeHtml(u.email)}</span>
      </td>
      <td data-label="Institution">
        ${escapeHtml(u.affiliation) || "—"}
        ${u.department ? `<span class="cell-sub">${escapeHtml(u.department)}</span>` : ""}
      </td>
      <td data-label="Location">
        ${escapeHtml(u.country) || "—"}
        ${location ? `<span class="cell-sub">${escapeHtml(location)}</span>` : ""}
      </td>
      <td data-label="Tier">
        ${escapeHtml(tier.name) || "—"}
        ${tier.note ? `<span class="cell-sub">${escapeHtml(tier.note)}</span>` : ""}
      </td>
      <td data-label="Status">
        <select class="status-select is-${status}" data-action="status" data-id="${id}"
                aria-label="Membership status for ${owner}">
          ${statuses.map((s) => `<option value="${escapeHtml(s)}"${s === status ? " selected" : ""}${s === unrecognised ? " disabled" : ""}>${escapeHtml(s)}</option>`).join("")}
        </select>
      </td>
      <td data-label="Joined" class="cell-nowrap text-inksoft">${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
      <td class="text-right">
        ${details.length ? `<button class="row-action row-action-quiet" data-action="details" data-id="${id}" aria-expanded="false">Details</button>` : ""}
      </td>
    </tr>
    ${details.length ? `
      <tr class="detail-row hidden" data-detail-for="${id}">
        <td colspan="7">
          <dl class="detail-grid">
            ${details.map(([label, value]) => `
              <div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>
            `).join("")}
          </dl>
        </td>
      </tr>
    ` : ""}
  `;
}

function renderMembers() {
  const term = memberSearch.value.trim().toLowerCase();
  const matched = term
    ? members.filter((u) =>
        [u.name, u.email, u.affiliation, u.country, u.city, u.state, u.tier, u.specialization]
          .some((field) => String(field ?? "").toLowerCase().includes(term))
      )
    : members;

  // Admins are pinned above everyone else: they're the accounts that can
  // change things, so they shouldn't be buried among the members. sort() is
  // stable, so the API's newest-first order survives inside each group.
  const shown = [...matched].sort((a, b) => (b.role === "admin") - (a.role === "admin"));

  document.getElementById("memberCount").textContent = term
    ? `${shown.length} of ${members.length} members`
    : `${members.length} member${members.length === 1 ? "" : "s"}`;

  const empty = document.getElementById("membersEmpty");
  empty.classList.toggle("hidden", shown.length !== 0);
  empty.textContent = members.length === 0 ? "No members yet." : "No members match that search.";

  membersBody.innerHTML = shown.map(memberRow).join("");
}

async function loadMembers() {
  try {
    const res = await apiFetch("/users");
    const users = await res.json();
    if (!res.ok) throw new Error(users.message || "Couldn't load members");

    members = Array.isArray(users) ? users : [];
    renderMembers();
  } catch (err) {
    showError(err.message);
  }
}

document.getElementById("refreshMembers")?.addEventListener("click", loadMembers);
memberSearch?.addEventListener("input", renderMembers);

membersBody.addEventListener("click", (e) => {
  const btn = e.target.closest('button[data-action="details"]');
  if (!btn) return;
  const row = membersBody.querySelector(`[data-detail-for="${CSS.escape(btn.dataset.id)}"]`);
  if (!row) return;
  const open = row.classList.toggle("hidden");
  btn.setAttribute("aria-expanded", String(!open));
  btn.textContent = open ? "Details" : "Hide";
});

// Confirming a payment is a deliberate action, so the select only sends once
// it settles: it's disabled for the round-trip, and a failure puts it back to
// the stored value rather than leaving the row showing a status that was
// never saved.
membersBody.addEventListener("change", async (e) => {
  const select = e.target.closest('select[data-action="status"]');
  if (!select) return;

  const id = select.dataset.id;
  const next = select.value;
  const member = members.find((m) => m.id === id);

  select.disabled = true;
  try {
    const res = await apiFetch(`/users/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ membershipStatus: next }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Couldn't update the membership status");

    // Keep the local copy in step so a re-render (a search, say) keeps the
    // new value instead of snapping back to what the last fetch returned.
    if (member) member.membershipStatus = data.membershipStatus ?? next;
    select.className = `status-select is-${next}`;
    clearError();
  } catch (err) {
    showError(err.message);
    // Back to what the row was showing before, so the control never displays
    // a status that failed to save.
    const previous = member ? shownStatus(member) : "pending";
    select.value = previous;
    select.className = `status-select is-${previous}`;
  } finally {
    select.disabled = false;
  }
});

/* ---------- Journals ---------- */
const journalForm = document.getElementById("journalForm");
let journalsById = {};

async function loadJournals() {
  try {
    const res = await apiFetch("/journals");
    const journals = await res.json();
    if (!res.ok) throw new Error(journals.message || "Couldn't load journals");

    journalsById = Object.fromEntries(journals.map((j) => [j.id, j]));
    document.getElementById("journalsEmpty").classList.toggle("hidden", journals.length !== 0);
    document.getElementById("journalsBody").innerHTML = journals.map((j) => `
      <tr>
        <td data-label="Code" class="font-semibold cell-nowrap">${escapeHtml(j.code)}</td>
        <td data-label="Title">
          ${escapeHtml(j.title)}
          ${j.openAccess ? `<span class="cell-sub">Open access</span>` : ""}
        </td>
        <td data-label="Frequency" class="capitalize cell-nowrap">${escapeHtml(j.frequency)}</td>
        <td data-label="ISSN" class="text-inksoft cell-nowrap">${escapeHtml(j.issn) || "—"}</td>
        <td class="text-right cell-nowrap">
          <button class="row-action mr-3" data-action="edit" data-id="${escapeHtml(j.id)}">Edit</button>
          <button class="row-action row-action-danger" data-action="delete" data-id="${escapeHtml(j.id)}">Delete</button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    showError(err.message);
  }
}

document.getElementById("journalsBody").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "edit") editJournal(journalsById[btn.dataset.id]);
  if (btn.dataset.action === "delete") deleteJournal(btn.dataset.id);
});

document.getElementById("newJournalBtn").addEventListener("click", () => {
  journalForm.reset();
  document.getElementById("journalId").value = "";
  journalForm.classList.remove("hidden");
});
document.getElementById("cancelJournal").addEventListener("click", () => journalForm.classList.add("hidden"));

function editJournal(j) {
  if (!j) return;
  document.getElementById("journalId").value = j.id;
  document.getElementById("jCode").value = j.code;
  document.getElementById("jTitle").value = j.title;
  document.getElementById("jIssn").value = j.issn || "";
  document.getElementById("jFrequency").value = j.frequency;
  document.getElementById("jOpenAccess").checked = j.openAccess;
  document.getElementById("jDescription").value = j.description || "";
  journalForm.classList.remove("hidden");
  journalForm.scrollIntoView({ behavior: "smooth" });
}

async function deleteJournal(id) {
  if (!confirm("Delete this journal?")) return;
  try {
    const res = await apiFetch(`/journals/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Delete failed");
    }
    loadJournals();
  } catch (err) {
    showError(err.message);
  }
}

journalForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("journalId").value;
  const payload = {
    code: document.getElementById("jCode").value,
    title: document.getElementById("jTitle").value,
    issn: document.getElementById("jIssn").value,
    frequency: document.getElementById("jFrequency").value,
    openAccess: document.getElementById("jOpenAccess").checked,
    description: document.getElementById("jDescription").value,
  };
  try {
    const res = await apiFetch(`/journals${id ? "/" + id : ""}`, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Save failed");
    journalForm.classList.add("hidden");
    loadJournals();
  } catch (err) {
    showError(err.message);
  }
});

/* ---------- Conferences ---------- */
const conferenceForm = document.getElementById("conferenceForm");
let conferencesById = {};

async function loadConferences() {
  try {
    const res = await apiFetch("/conferences");
    const conferences = await res.json();
    if (!res.ok) throw new Error(conferences.message || "Couldn't load conferences");

    conferencesById = Object.fromEntries(conferences.map((c) => [c.id, c]));
    document.getElementById("conferencesEmpty").classList.toggle("hidden", conferences.length !== 0);
    document.getElementById("conferencesBody").innerHTML = conferences.map((c) => `
      <tr>
        <td data-label="Title" class="font-semibold">${escapeHtml(c.title)}</td>
        <td data-label="Dates" class="text-inksoft cell-nowrap">${new Date(c.startDate).toLocaleDateString()} – ${new Date(c.endDate).toLocaleDateString()}</td>
        <td data-label="Location">${escapeHtml(c.location)}</td>
        <td data-label="Reg. open"><span class="pill ${c.registrationOpen ? "pill-on" : "pill-off"}">${c.registrationOpen ? "Open" : "Closed"}</span></td>
        <td class="text-right cell-nowrap">
          <button class="row-action mr-3" data-action="edit" data-id="${escapeHtml(c.id)}">Edit</button>
          <button class="row-action row-action-danger" data-action="delete" data-id="${escapeHtml(c.id)}">Delete</button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    showError(err.message);
  }
}

document.getElementById("conferencesBody").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "edit") editConference(conferencesById[btn.dataset.id]);
  if (btn.dataset.action === "delete") deleteConference(btn.dataset.id);
});

document.getElementById("newConferenceBtn").addEventListener("click", () => {
  conferenceForm.reset();
  document.getElementById("confId").value = "";
  conferenceForm.classList.remove("hidden");
});
document.getElementById("cancelConference").addEventListener("click", () => conferenceForm.classList.add("hidden"));

const toDateInput = (d) => new Date(d).toISOString().slice(0, 10);

function editConference(c) {
  if (!c) return;
  document.getElementById("confId").value = c.id;
  document.getElementById("cTitle").value = c.title;
  document.getElementById("cStart").value = toDateInput(c.startDate);
  document.getElementById("cEnd").value = toDateInput(c.endDate);
  document.getElementById("cDeadline").value = c.submissionDeadline ? toDateInput(c.submissionDeadline) : "";
  document.getElementById("cLocation").value = c.location;
  document.getElementById("cTracks").value = (c.tracks || []).join(", ");
  document.getElementById("cDescription").value = c.description || "";
  document.getElementById("cRegOpen").checked = c.registrationOpen;
  conferenceForm.classList.remove("hidden");
  conferenceForm.scrollIntoView({ behavior: "smooth" });
}

async function deleteConference(id) {
  if (!confirm("Delete this conference?")) return;
  try {
    const res = await apiFetch(`/conferences/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Delete failed");
    }
    loadConferences();
  } catch (err) {
    showError(err.message);
  }
}

conferenceForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("confId").value;
  const deadline = document.getElementById("cDeadline").value;
  const payload = {
    title: document.getElementById("cTitle").value,
    startDate: document.getElementById("cStart").value,
    endDate: document.getElementById("cEnd").value,
    // null (not undefined) so clearing the field actually clears the column
    // instead of being dropped from the request.
    submissionDeadline: deadline || null,
    location: document.getElementById("cLocation").value,
    tracks: document.getElementById("cTracks").value.split(",").map((t) => t.trim()).filter(Boolean),
    description: document.getElementById("cDescription").value,
    registrationOpen: document.getElementById("cRegOpen").checked,
  };
  try {
    const res = await apiFetch(`/conferences${id ? "/" + id : ""}`, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Save failed");
    conferenceForm.classList.add("hidden");
    loadConferences();
  } catch (err) {
    showError(err.message);
  }
});

/* ---------- Account ---------- */
// Changing a password is a Supabase Auth operation, so it goes straight from
// this page to Supabase with supabase-js — it never touches our API. That's
// the same rule the rest of the site follows: credentials are the browser's
// business, and the Express server only ever sees access tokens.
const passwordForm = document.getElementById("passwordForm");
const passwordNote = document.getElementById("passwordNote");

function setPasswordNote(text, tone) {
  passwordNote.className = `text-sm min-h-[1.2em] ${tone}`;
  passwordNote.textContent = text;
}

passwordForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const current = document.getElementById("currentPassword").value;
  const next = document.getElementById("newPassword").value;
  const confirm = document.getElementById("confirmPassword").value;

  if (next.length < 8) return setPasswordNote("Your new password must be at least 8 characters.", "text-clay");
  if (next !== confirm) return setPasswordNote("Those new passwords don't match.", "text-clay");
  if (next === current) return setPasswordNote("Your new password must be different from the current one.", "text-clay");

  const email = currentProfile?.email;
  if (!email) return setPasswordNote("Couldn't read your account email — please sign in again.", "text-clay");

  setPasswordNote("Updating…", "text-inksoft");

  // Sign in again with the current password first. That proves whoever is at
  // the keyboard actually knows it, rather than just having found an unlocked
  // session — and it gives us a fresh session, which Supabase requires before
  // it will accept a password change on a session more than 24 hours old.
  const { error: reauthError } = await window.iscestSupabase.auth.signInWithPassword({
    email,
    password: current,
  });

  if (reauthError) {
    // Deliberately no signOut()/checkAuth() here, unlike apiFetch above: a
    // failed sign-in leaves the existing session intact, so a typo should
    // just report itself and let them retry, not throw them out.
    return setPasswordNote("Your current password is incorrect.", "text-clay");
  }

  const { error } = await window.iscestSupabase.auth.updateUser({ password: next });
  if (error) return setPasswordNote(error.message, "text-clay");

  passwordForm.reset();
  setPasswordNote("Password updated — use the new one next time you sign in.", "text-teal");
});

/* ---------- Init ---------- */
checkAuth();
