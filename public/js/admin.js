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
async function loadMembers() {
  const body = document.getElementById("membersBody");
  const empty = document.getElementById("membersEmpty");
  try {
    const res = await apiFetch("/users");
    const users = await res.json();
    if (!res.ok) throw new Error(users.message || "Couldn't load members");

    empty.classList.toggle("hidden", users.length !== 0);
    body.innerHTML = users.map((u) => `
      <tr class="border-b border-line">
        <td class="p-3 text-inksoft">${escapeHtml(u.title) || "—"}</td>
        <td class="p-3">${escapeHtml(u.name)}</td>
        <td class="p-3 text-inksoft">${escapeHtml(u.sex) || "—"}</td>
        <td class="p-3">${escapeHtml(u.email)}</td>
        <td class="p-3">${escapeHtml(u.affiliation) || "—"}</td>
        <td class="p-3">${escapeHtml(u.department) || "—"}</td>
        <td class="p-3">${escapeHtml(u.city) || "—"}</td>
        <td class="p-3">${escapeHtml(u.state) || "—"}</td>
        <td class="p-3">${escapeHtml(u.country) || "—"}</td>
        <td class="p-3">${escapeHtml(u.telephone) || "—"}</td>
        <td class="p-3">${escapeHtml(u.specialization) || "—"}</td>
        <td class="p-3">${escapeHtml(u.tier)}</td>
        <td class="p-3"><span class="text-xs font-semibold px-2 py-1 rounded-full border ${u.membershipStatus === "active" ? "border-teal text-teal" : "border-line text-inksoft"}">${escapeHtml(u.membershipStatus)}</span></td>
        <td class="p-3 text-inksoft whitespace-nowrap">${new Date(u.createdAt).toLocaleDateString()}</td>
      </tr>
    `).join("");
  } catch (err) {
    showError(err.message);
  }
}
document.getElementById("refreshMembers")?.addEventListener("click", loadMembers);

/* ---------- Journals ---------- */
const journalForm = document.getElementById("journalForm");
let journalsById = {};

async function loadJournals() {
  try {
    const res = await apiFetch("/journals");
    const journals = await res.json();
    if (!res.ok) throw new Error(journals.message || "Couldn't load journals");

    journalsById = Object.fromEntries(journals.map((j) => [j.id, j]));
    document.getElementById("journalsBody").innerHTML = journals.map((j) => `
      <tr class="border-b border-line">
        <td class="p-3 font-semibold">${escapeHtml(j.code)}</td>
        <td class="p-3">${escapeHtml(j.title)}</td>
        <td class="p-3 capitalize">${escapeHtml(j.frequency)}</td>
        <td class="p-3 text-inksoft">${escapeHtml(j.issn) || "—"}</td>
        <td class="p-3 text-right whitespace-nowrap">
          <button class="text-teal hover:underline mr-3" data-action="edit" data-id="${escapeHtml(j.id)}">Edit</button>
          <button class="text-clay hover:underline" data-action="delete" data-id="${escapeHtml(j.id)}">Delete</button>
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
    document.getElementById("conferencesBody").innerHTML = conferences.map((c) => `
      <tr class="border-b border-line">
        <td class="p-3 font-semibold">${escapeHtml(c.title)}</td>
        <td class="p-3 text-inksoft">${new Date(c.startDate).toLocaleDateString()} – ${new Date(c.endDate).toLocaleDateString()}</td>
        <td class="p-3">${escapeHtml(c.location)}</td>
        <td class="p-3">${c.registrationOpen ? "Yes" : "No"}</td>
        <td class="p-3 text-right whitespace-nowrap">
          <button class="text-teal hover:underline mr-3" data-action="edit" data-id="${escapeHtml(c.id)}">Edit</button>
          <button class="text-clay hover:underline" data-action="delete" data-id="${escapeHtml(c.id)}">Delete</button>
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

/* ---------- Init ---------- */
checkAuth();
