const fullTeamsListEl = document.getElementById("fullTeamsList");
const teamsListEl = document.getElementById("teamsList");
const leagueSelect = document.getElementById("leagueSelect");
const clearBtn = document.getElementById("clearTeams");

let selectedTeamIds = new Set();


async function fetchJSON(url, opts={}) {
  const r = await fetch(url, {
    headers: { "Content-Type":"application/json" },
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
    // Özel ID listesi
    const ids = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 17, 50, 49, 54, 29];
    data = await fetchJSON(`${API}?action=get_full_teams_by_ids&ids=${ids.join(",")}`);
  } else {
    const url = league
      ? `${API}?action=get_full_teams&league=${encodeURIComponent(league)}`
      : `${API}?action=get_full_teams`;
    data = await fetchJSON(url);
  }

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

const addAllBtn = document.getElementById("addAllBtn");

addAllBtn.addEventListener("click", async () => {
  // Sol listedeki tüm eklenebilir takımlar
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
    // API'ye toplu gönderim (tek tek POST atmak yerine toplu array göndermek daha hızlı olur)
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

  // 🔒 Çift tıklamayı engelle
  btn.disabled = true;

  // ✅ OPTİMİSTİK: Hemen state + UI güncelle
  const oldText = btn.textContent;
  const had = selectedTeamIds.has(id);
  selectedTeamIds.add(id);
  btn.textContent = "Eklendi";
  btn.classList.add("disabled"); // varsa CSS'te gri görünüm
  // not: renderFullTeams() zaten selectedTeamIds’e bakıyor

  try {
    await fetchJSON(API + "?action=teams_add", {
      method: "POST",
      body: JSON.stringify({ team_id: id })
    });

    // Sunucu gerçek durumu ile yeniden senkronla
    await loadTeams();      // selectedTeamIds = sunucudan gelen gerçek liste
    await loadFullTeams();  // soldaki butonları yeni sete göre çiz
  } catch (err) {
    // ❌ Hata: optimistik değişiklikleri geri al
    if (!had) selectedTeamIds.delete(id);
    btn.textContent = oldText;
    btn.classList.remove("disabled");
    btn.disabled = false;
    alert("Ekleme hatası: " + err.message);
    return;
  }

  // Başarılıysa buton disabled kalabilir (zaten eklendi)
});


// Sil
teamsListEl.addEventListener("click", async (e) => {
  const btn = e.target.closest('button[data-remove]');
  if (!btn) return;

  const rid = Number(btn.getAttribute("data-remove"));
  if (!rid) return;

  btn.disabled = true;

  // ✅ OPTİMİSTİK: hemen set’ten çıkar
  const had = selectedTeamIds.has(rid);
  if (had) selectedTeamIds.delete(rid);

  try {
    await fetchJSON(API + "?action=teams_remove&id=" + encodeURIComponent(rid), { method: "DELETE" });
    await loadTeams();
    await loadFullTeams();
  } catch (err) {
    // ❌ geri al
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

  // ✅ OPTİMİSTİK: set’i boşalt, UI hemen boş görünsün
  const backup = new Set(selectedTeamIds);
  selectedTeamIds.clear();
  renderTeams([]);            // sağ paneli anında boşalt (isteğe bağlı)
  await loadFullTeams();      // soldaki butonlar aktifleşsin

  try {
    await fetchJSON(API + "?action=teams_truncate", { method: "DELETE" });
    await loadTeams();
    await loadFullTeams();
  } catch (err) {
    // ❌ geri al
    selectedTeamIds = backup;
    await loadTeams();
    await loadFullTeams();
    alert("Temizleme hatası: " + err.message);
  } finally {
    clearBtn.disabled = false;
    clearBtn.textContent = old;
  }
});



// Lig değişince sol listeyi yenile
leagueSelect.addEventListener("change", loadFullTeams);

(async function init(){
  await loadLeagues();
  await loadTeams();       // önce sağ
  await loadFullTeams();   // sonra sol
})();

