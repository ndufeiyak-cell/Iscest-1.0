// ISCEST — shared site behaviour (loaded on every page)

/* ---------- Mobile nav toggle ---------- */
const navToggle = document.getElementById("navToggle");
const mainNav = document.getElementById("mainNav");
navToggle?.addEventListener("click", () => {
  const nowHidden = mainNav.classList.toggle("hidden");
  navToggle.setAttribute("aria-expanded", String(!nowHidden));
});

/* ---------- Membership dropdown ---------- */
const memberToggle = document.getElementById("memberToggle");
const memberDropdown = document.getElementById("memberDropdown");
memberToggle?.addEventListener("click", (e) => {
  e.stopPropagation();
  const nowHidden = memberDropdown.classList.toggle("hidden");
  memberToggle.setAttribute("aria-expanded", String(!nowHidden));
});
document.addEventListener("click", () => memberDropdown?.classList.add("hidden"));

/* ---------- Search (placeholder — wire to a real search endpoint later) ---------- */
document.getElementById("siteSearch")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = document.getElementById("searchInput").value.trim();
  if (q) alert(`Searching ISCEST for "${q}" — connect this to a search endpoint or index.`);
});

/* ---------- Generic form success message (registration / login / contact) ---------- */
document.querySelectorAll("form[data-demo-submit]").forEach((form) => {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const note = form.querySelector(".form-note");
    if (note) note.textContent = form.dataset.demoSubmit;
    form.reset();
  });
});
