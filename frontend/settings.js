const fullTeamsListEl = document.getElementById("fullTeamsList");
const teamsListEl = document.getElementById("teamsList");
const leagueSelect = document.getElementById("leagueSelect");
const clearBtn = document.getElementById("clearTeams");

let selectedTeamIds = new Set();


async function fetchJSON(url, opts={}) {
  const r = await fetch(url, {
    headers: { "Content-Type":"application/json" },
    ...opts
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// Ligleri doldur (full_teams’ten distinct league)
async function loadLeagues() {
  const leagues = await fetchJSON(`${API}?action=get_full_teams_leagues`);
  // leagues = [{league:"Premier League"}, ...]
  leagues.forEach(l => {
    if (!l.league) return;
    const opt = document.createElement("option");
    opt.value = l.league;
    opt.textContent = l.league;
    leagueSelect.appendChild(opt);
  });
}

// Soldaki liste (full_teams)
async function loadFullTeams() {
  const league = leagueSelect.value;
  const url = league ? `${API}?action=get_full_teams&league=${encodeURIComponent(league)}`
                     : `${API}?action=get_full_teams`;
  const data = await fetchJSON(url);
  renderFullTeams(data);
}

function renderFullTeams(rows){
  fullTeamsListEl.innerHTML = "";
  if (!rows.length){
    fullTeamsListEl.innerHTML = `<div class="empty">Takım bulunamadı</div>`;
    return;
  }
  rows.forEach(r=>{
    const already = selectedTeamIds.has(Number(r.team_id));
    const li = document.createElement("li");
    li.className="item";
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



// Sağdaki liste (teams)
async function loadTeams(){
  const rows = await fetchJSON(`${API}?action=get_teams`);
  // Sağ liste render
  renderTeams(rows);
  // Seçilileri set’e işle
  selectedTeamIds = new Set(rows.map(r => Number(r.id)));
}

function renderTeams(rows){
  teamsListEl.innerHTML = "";
  if (!rows.length){
    teamsListEl.innerHTML = `<div class="empty">Henüz takım seçilmedi</div>`;
    return;
  }
  rows.forEach(r=>{
    const li = document.createElement("li");
    li.className="item";
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


fullTeamsListEl.addEventListener("click", async (e)=>{
  const id = e.target.getAttribute("data-add");
  if (!id || e.target.disabled) return;
  try{
    await fetchJSON(`${API}?action=teams_add`, {
      method:"POST",
      body: JSON.stringify({ team_id: Number(id) })
    });
    await Promise.all([loadTeams(), loadFullTeams()]);  // <-- önemli
  }catch(err){ alert("Ekleme hatası: " + err.message); }
});

teamsListEl.addEventListener("click", async (e)=>{
  const rid = e.target.getAttribute("data-remove");
  if (!rid) return;
  const url = `${API}?action=teams_remove&id=${encodeURIComponent(rid)}`;
  try{
    await fetchJSON(url, { method:"DELETE" });
    await Promise.all([loadTeams(), loadFullTeams()]);  // <-- önemli
  }catch(err){ alert("Silme hatası: " + err.message); }
});

clearBtn.addEventListener("click", async ()=>{ 
  try{
    await fetchJSON(`${API}?action=teams_truncate`, { method:"DELETE" });
    await Promise.all([loadTeams(), loadFullTeams()]);  // <-- önemli
  }catch(err){ alert("Temizleme hatası: " + err.message); }
});

// Lig değişince sol listeyi yenile
leagueSelect.addEventListener("change", loadFullTeams);

(async function init(){
  await loadLeagues();
  await loadTeams();       // önce sağ
  await loadFullTeams();   // sonra sol
})();

