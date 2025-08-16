const fullTeamsListEl = document.getElementById("fullTeamsList");
const teamsListEl = document.getElementById("teamsList");
const leagueSelect = document.getElementById("leagueSelect");
const clearBtn = document.getElementById("clearTeams");

let selectedTeamIds = new Set();
const UID_KEY = "user_id";

// ✅ user_id yoksa üret (backend X-User-Id zorunlu)
let userId = localStorage.getItem(UID_KEY);
if (!userId) {
  if (window.crypto && crypto.randomUUID) {
    userId = crypto.randomUUID();
  } else {
    userId = 'uid-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }
  localStorage.setItem(UID_KEY, userId);
}

function authedFetch(url, options = {}) {
  const headers = Object.assign({}, options.headers, { "X-User-Id": userId });
  return fetch(url, { ...options, headers });
}

async function fetchJSON(url, opts = {}) {
  const r = await authedFetch(url, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...opts
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function loadLeagues() {
  const leagues = await fetchJSON(`${API}?action=get_full_teams_leagues`);
  leagues.forEach(l => {
    if (!l.league) return;
    const opt = document.createElement("option");
    opt.value = l.league;
    opt.textContent = l.league;
    leagueSelect.appendChild(opt);
  });

  // 🔹 Özel filtre: Şampiyonlar Ligi Son 16
  const clOpt = document.createElement("option");
  clOpt.value = "__ucl16";
  clOpt.textContent = "Şampiyonlar Ligi Son 16";
  leagueSelect.appendChild(clOpt);
}

async function loadFullTeams() {
  const league = leagueSelect.value;

  let data = [];
  if (league === "__ucl16") {
    const ids = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 17, 50, 49, 54, 29, 74];
    data = await fetchJSON(`${API}?action=get_full_teams_by_ids&ids=${ids.join(",")}`);
  } else {
    const url = league
      ? `${API}?action=get_full_teams&league=${encodeURIComponent(league)}`
      : `${API}?action=get_full_teams`;
    data = await fetchJSON(url);
  }

  renderFullTeams(data);
}

function renderFullTeams(rows) {
  fullTeamsListEl.innerHTML = "";
  if (!rows.length) {
    fullTeamsListEl.innerHTML = `<div class="empty">Takım bulunamadı</div>`;
    return;
  }
  rows.forEach(r => {
    const already = selectedTeamIds.has(Number(r.team_id));
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <div class="meta">
        <span class="name">${r.team_name}</span>
        <span class="league">${r.league}</span>
      </div>
      <div class="actions">
        <button class="btn small ${already ? 'disabled' : 'accent'}"
                data-add="${r.team_id}" ${already ? 'disabled' : ''}>
          ${already ? 'Eklendi' : '+ Ekle'}
        </button>
      </div>
    `;
    fullTeamsListEl.appendChild(li);
  });
}

// Sağdaki liste (kullanıcının seçtikleri)
async function loadTeams() {
  // backend: get_teams -> user_teams JOIN full_teams
  const rows = await fetchJSON(`${API}?action=get_teams`);
  renderTeams(rows);
  // backend id = full_teams.team_id
  selectedTeamIds = new Set(rows.map(r => Number(r.id)));
}

function renderTeams(rows) {
  teamsListEl.innerHTML = "";
  if (!rows.length) {
    teamsListEl.innerHTML = `<div class="empty">Henüz takım seçilmedi</div>`;
    return;
  }
  rows.forEach(r => {
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <div class="meta">
        <span class="name">${r.team_name}</span>
      </div>
      <div class="actions">
        <button class="btn danger small" data-remove="${r.id}">✕</button>
      </div>
    `;
    teamsListEl.appendChild(li);
  });
}

const addAllBtn = document.getElementById("addAllBtn");

addAllBtn.addEventListener("click", async () => {
  const addButtons = fullTeamsListEl.querySelectorAll("button[data-add]:not(:disabled)");
  if (!addButtons.length) {
    alert("Eklenecek takım bulunamadı.");
    return;
  }

  const ids = Array.from(addButtons).map(btn => Number(btn.getAttribute("data-add")));
  if (!ids.length) return;

  addAllBtn.disabled = true;
  addAllBtn.textContent = "Ekleniyor...";

  try {
    await fetchJSON(API + "?action=teams_add_bulk", {
      method: "POST",
      body: JSON.stringify({ team_ids: ids })
    });

    await loadTeams();
    await loadFullTeams();
  } catch (err) {
    alert("Toplu ekleme hatası: " + err.message);
  } finally {
    addAllBtn.disabled = false;
    addAllBtn.textContent = "Hepsini Ekle";
  }
});

fullTeamsListEl.addEventListener("click", async (e) => {
  const btn = e.target.closest('button[data-add]');
  if (!btn || btn.disabled) return;

  const id = Number(btn.getAttribute("data-add"));
  if (!id) return;

  btn.disabled = true;

  // Optimistik UI
  const oldText = btn.textContent;
  const had = selectedTeamIds.has(id);
  selectedTeamIds.add(id);
  btn.textContent = "Eklendi";
  btn.classList.add("disabled");

  try {
    await fetchJSON(API + "?action=teams_add", {
      method: "POST",
      body: JSON.stringify({ team_id: id })
    });

    await loadTeams();
    await loadFullTeams();
  } catch (err) {
    if (!had) selectedTeamIds.delete(id);
    btn.textContent = oldText;
    btn.classList.remove("disabled");
    btn.disabled = false;
    alert("Ekleme hatası: " + err.message);
    return;
  }
});

// Sil
teamsListEl.addEventListener("click", async (e) => {
  const btn = e.target.closest('button[data-remove]');
  if (!btn) return;

  const rid = Number(btn.getAttribute("data-remove"));
  if (!rid) return;

  btn.disabled = true;

  const had = selectedTeamIds.has(rid);
  if (had) selectedTeamIds.delete(rid);

  try {
    await fetchJSON(API + "?action=teams_remove&id=" + encodeURIComponent(rid), { method: "DELETE" });
    await loadTeams();
    await loadFullTeams();
  } catch (err) {
    if (had) selectedTeamIds.add(rid);
    btn.disabled = false;
    alert("Silme hatası: " + err.message);
  }
});

// Tümünü Temizle
clearBtn.addEventListener("click", async () => {
  clearBtn.disabled = true;
  const old = clearBtn.textContent;
  clearBtn.textContent = "Temizleniyor...";

  const backup = new Set(selectedTeamIds);
  selectedTeamIds.clear();
  renderTeams([]);
  await loadFullTeams();

  try {
    await fetchJSON(API + "?action=teams_truncate", { method: "DELETE" });
    await loadTeams();
    await loadFullTeams();
  } catch (err) {
    selectedTeamIds = backup;
    await loadTeams();
    await loadFullTeams();
    alert("Temizleme hatası: " + err.message);
  } finally {
    clearBtn.disabled = false;
    clearBtn.textContent = old;
  }
});

leagueSelect.addEventListener("change", loadFullTeams);

(async function init() {
  await loadLeagues();
  await loadTeams();       // önce sağ (kullanıcının seçtikleri)
  await loadFullTeams();   // sonra sol (filtreli tüm takımlar)
})();
