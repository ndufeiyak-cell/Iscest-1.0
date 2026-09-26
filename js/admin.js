// ISCEST — admin dashboard
const API = (window.ISCEST_API_BASE || "http://localhost:5000/api");

const loginGate = document.getElementById("loginGate");
const dashApp = document.getElementById("dashApp");
const dashError = document.getElementById("dashError");

function authHeaders() {
  const token = localStorage.getItem("iscest_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function showError(msg) {
  dashError.textContent = msg;
  dashError.classList.remove("hidden");
}
function clearError() {
  dashError.classList.add("hidden");
}

/* ---------- Auth gate ---------- */
function checkAuth() {
  const token = localStorage.getItem("iscest_token");
  const role = localStorage.getItem("iscest_role");
  if (token && role === "admin") {
    loginGate.classList.add("hidden");
    dashApp.classList.remove("hidden");
    document.getElementById("dashUserName").textContent = localStorage.getItem("iscest_name") || "Admin";
    loadOverview();
    return true;
  }
  loginGate.classList.remove("hidden");
  dashApp.classList.add("hidden");
  return false;
}

document.getElementById("dashLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const note = document.getElementById("dashLoginNote");
  note.className = "text-sm min-h-[1.2em] text-inksoft";
  note.textContent = "Signing in…";
  try {
    const res = await fetch(`${API}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: document.getElementById("dashEmail").value,
        password: document.getElementById("dashPassword").value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Login failed");
    if (data.role !== "admin") throw new Error("This account doesn't have admin access");
    localStorage.setItem("iscest_token", data.token);
    localStorage.setItem("iscest_role", data.role);
    localStorage.setItem("iscest_name", data.name);
    checkAuth();
  } catch (err) {
    note.className = "text-sm min-h-[1.2em] text-clay";
    note.textContent = err.message;
  }
});

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.removeItem("iscest_token");
  localStorage.removeItem("iscest_role");
  localStorage.removeItem("iscest_name");
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
    const [users, journals, conferences] = await Promise.all([
      fetch(`${API}/users`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`${API}/journals`).then((r) => r.json()),
      fetch(`${API}/conferences`).then((r) => r.json()),
    ]);
    document.getElementById("statMembers").textContent = Array.isArray(users) ? users.length : "—";
    document.getElementById("statActive").textContent = Array.isArray(users) ? users.filter((u) => u.membershipStatus === "active").length : "—";
    document.getElementById("statJournals").textContent = Array.isArray(journals) ? journals.length : "—";
    document.getElementById("statConferences").textContent = Array.isArray(conferences) ? conferences.length : "—";
  } catch (err) {
    showError("Couldn't reach the ISCEST API. Make sure the backend in /backend is running.");
  }
}

/* ---------- Members ---------- */
async function loadMembers() {
  const body = document.getElementById("membersBody");
  const empty = document.getElementById("membersEmpty");
  try {
    const res = await fetch(`${API}/users`, { headers: authHeaders() });
    const users = await res.json();
    if (!res.ok) throw new Error(users.message || "Couldn't load members");
    empty.classList.toggle("hidden", users.length !== 0);
    body.innerHTML = users.map((u) => `
      <tr class="border-b border-line">
        <td class="p-3 text-inksoft">${u.title || "—"}</td>
        <td class="p-3">${u.name}</td>
        <td class="p-3 text-inksoft">${u.sex || "—"}</td>
        <td class="p-3">${u.email}</td>
        <td class="p-3">${u.affiliation || "—"}</td>
        <td class="p-3">${u.department || "—"}</td>
        <td class="p-3">${u.city || "—"}</td>
        <td class="p-3">${u.state || "—"}</td>
        <td class="p-3">${u.country || "—"}</td>
        <td class="p-3">${u.telephone || "—"}</td>
        <td class="p-3">${u.specialization || "—"}</td>
        <td class="p-3">${u.tier}</td>
        <td class="p-3"><span class="text-xs font-semibold px-2 py-1 rounded-full border ${u.membershipStatus === "active" ? "border-teal text-teal" : "border-line text-inksoft"}">${u.membershipStatus}</span></td>
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

async function loadJournals() {
  try {
    const res = await fetch(`${API}/journals`);
    const journals = await res.json();
    document.getElementById("journalsBody").innerHTML = journals.map((j) => `
      <tr class="border-b border-line">
        <td class="p-3 font-semibold">${j.code}</td>
        <td class="p-3">${j.title}</td>
        <td class="p-3 capitalize">${j.frequency}</td>
        <td class="p-3 text-inksoft">${j.issn || "—"}</td>
        <td class="p-3 text-right whitespace-nowrap">
          <button class="text-teal hover:underline mr-3" onclick='editJournal(${JSON.stringify(j)})'>Edit</button>
          <button class="text-clay hover:underline" onclick="deleteJournal('${j.id}')">Delete</button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    showError("Couldn't load journals.");
  }
}

document.getElementById("newJournalBtn").addEventListener("click", () => {
  journalForm.reset();
  document.getElementById("journalId").value = "";
  journalForm.classList.remove("hidden");
});
document.getElementById("cancelJournal").addEventListener("click", () => journalForm.classList.add("hidden"));

window.editJournal = (j) => {
  document.getElementById("journalId").value = j.id;
  document.getElementById("jCode").value = j.code;
  document.getElementById("jTitle").value = j.title;
  document.getElementById("jIssn").value = j.issn || "";
  document.getElementById("jFrequency").value = j.frequency;
  document.getElementById("jOpenAccess").checked = j.openAccess;
  document.getElementById("jDescription").value = j.description || "";
  journalForm.classList.remove("hidden");
  journalForm.scrollIntoView({ behavior: "smooth" });
};

window.deleteJournal = async (id) => {
  if (!confirm("Delete this journal?")) return;
  try {
    const res = await fetch(`${API}/journals/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) throw new Error("Delete failed");
    loadJournals();
  } catch (err) {
    showError(err.message);
  }
};

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
    const res = await fetch(`${API}/journals${id ? "/" + id : ""}`, {
      method: id ? "PUT" : "POST",
      headers: authHeaders(),
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

async function loadConferences() {
  try {
    const res = await fetch(`${API}/conferences`);
    const conferences = await res.json();
    document.getElementById("conferencesBody").innerHTML = conferences.map((c) => `
      <tr class="border-b border-line">
        <td class="p-3 font-semibold">${c.title}</td>
        <td class="p-3 text-inksoft">${new Date(c.startDate).toLocaleDateString()} – ${new Date(c.endDate).toLocaleDateString()}</td>
        <td class="p-3">${c.location}</td>
        <td class="p-3">${c.registrationOpen ? "Yes" : "No"}</td>
        <td class="p-3 text-right whitespace-nowrap">
          <button class="text-teal hover:underline mr-3" onclick='editConference(${JSON.stringify(c)})'>Edit</button>
          <button class="text-clay hover:underline" onclick="deleteConference('${c.id}')">Delete</button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    showError("Couldn't load conferences.");
  }
}

document.getElementById("newConferenceBtn").addEventListener("click", () => {
  conferenceForm.reset();
  document.getElementById("confId").value = "";
  conferenceForm.classList.remove("hidden");
});
document.getElementById("cancelConference").addEventListener("click", () => conferenceForm.classList.add("hidden"));

const toDateInput = (d) => new Date(d).toISOString().slice(0, 10);

window.editConference = (c) => {
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
};

window.deleteConference = async (id) => {
  if (!confirm("Delete this conference?")) return;
  try {
    const res = await fetch(`${API}/conferences/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) throw new Error("Delete failed");
    loadConferences();
  } catch (err) {
    showError(err.message);
  }
};

conferenceForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("confId").value;
  const payload = {
    title: document.getElementById("cTitle").value,
    startDate: document.getElementById("cStart").value,
    endDate: document.getElementById("cEnd").value,
    submissionDeadline: document.getElementById("cDeadline").value || undefined,
    location: document.getElementById("cLocation").value,
    tracks: document.getElementById("cTracks").value.split(",").map((t) => t.trim()).filter(Boolean),
    description: document.getElementById("cDescription").value,
    registrationOpen: document.getElementById("cRegOpen").checked,
  };
  try {
    const res = await fetch(`${API}/conferences${id ? "/" + id : ""}`, {
      method: id ? "PUT" : "POST",
      headers: authHeaders(),
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
