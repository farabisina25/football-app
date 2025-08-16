const API = "http://localhost:8000/football.php";

// ——— user_id ———
const UID_KEY = "user_id";
let userId = localStorage.getItem(UID_KEY);
if (!userId) {
  userId = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : `uid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(UID_KEY, userId);
}

// ——— header’lı fetch ———
function authedFetch(url, options = {}) {
  const headers = Object.assign({}, options.headers, { "X-User-Id": userId });
  return fetch(url, { ...options, headers });
}

// ——— Öncesi (preTrade) ———
const preTrade = JSON.parse(localStorage.getItem("preTradeLeaderboard") || "[]");
const preList = document.getElementById('pre-trade-leaderboard');

// Kimya bonuslarını ekle ve sırala
preTrade.forEach(entry => {
  const chemistry = parseInt(localStorage.getItem(`chemistry_before_${entry.username}`)) || 0;
  const bonus = chemistry * 0.3;
  entry.finalPower = Number(entry.power) + bonus;
  entry.bonus = bonus;
});
preTrade.sort((a, b) => b.finalPower - a.finalPower);

// Listeyi bas
preTrade.forEach((entry, index) => {
  const li = document.createElement('li');
  li.className = "leaderboard-item";
  if (index === 0) li.classList.add("champion");
  li.innerHTML = `
    <span class="rank">${index === 0 ? '🏆' : '#' + (index + 1)}</span>
    <span class="username">${entry.username}</span>
    <span class="score">Güç: ${entry.finalPower.toFixed(2)} <small>(+${entry.bonus.toFixed(2)})</small></span>
  `;
  preList.appendChild(li);

  console.log(`🟡 [ÖNCE] ${entry.username} oyuncuları:`);
  entry.players?.forEach(player => {
    console.log(`- ${player.player} (${player.position}) slot ${player.slot}: OVR ${player.original_ovr} × ${player.multiplier} = ${player.adjusted_ovr.toFixed(2)}`);
  });
});

// ——— Sonrası (postTrade) ———
const players = JSON.parse(localStorage.getItem("players") || "[]");
const postTradeParams = new URLSearchParams();
players.forEach(p => {
  const formation = localStorage.getItem(`selectedFormation_${p.name}`) || "4231";
  postTradeParams.append(`formation_${encodeURIComponent(p.name)}`, formation);
});

// SONRA leaderboard’u çek
authedFetch(`${API}?action=get_leaderboard&${postTradeParams.toString()}`)
  .then(res => res.json())
  .then(data => {
    console.log(postTradeParams.toString());

    data.forEach(entry => {
      const chemistry = parseInt(localStorage.getItem(`chemistry_after_${entry.username}`)) || 0;
      const bonus = chemistry * 0.3;
      entry.finalPower = Number(entry.power) + bonus;
      entry.bonus = bonus;
    });

    data.sort((a, b) => b.finalPower - a.finalPower);

    const list = document.getElementById('leaderboard-list');
    data.forEach((entry, index) => {
      const li = document.createElement('li');
      li.className = "leaderboard-item";
      if (index === 0) li.classList.add("champion");
      li.innerHTML = `
        <span class="rank">${index === 0 ? '🏆' : '#' + (index + 1)}</span>
        <span class="username">${entry.username}</span>
        <span class="score">Güç: ${entry.finalPower.toFixed(2)} <small>(+${entry.bonus.toFixed(2)})</small></span>
      `;
      list.appendChild(li);

      console.log(`🟢 [SONRA] ${entry.username} oyuncuları:`);
      entry.players?.forEach(player => {
        console.log(`- ${player.player} (${player.position}) slot ${player.slot}: OVR ${player.original_ovr} × ${player.multiplier} = ${player.adjusted_ovr.toFixed(2)}`);
      });
    });
  });

// ——— Reset ———
document.getElementById("restart-btn")?.addEventListener("click", async () => {
  try {
    localStorage.clear();

    // Oyun tablolarını temizle
    await authedFetch(`${API}?action=reset_game`).then(res => res.json());

    // Kullanıcının takımlarını temizle
    await authedFetch(`${API}?action=teams_truncate`, { method: "DELETE" })
      .then(res => res.json());

    window.location.href = "start.html";
  } catch (err) {
    console.error("Sunucu hatası:", err);
    alert("Tablolar temizlenemedi.");
  }
});
