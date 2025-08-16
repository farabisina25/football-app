const API = "http://localhost:8000/football.php";

const players = JSON.parse(localStorage.getItem('players')) || [];
const trades = [];
const summaries = [];

const UID_KEY = "user_id";
let userId = localStorage.getItem(UID_KEY);
if (!userId) {
  userId = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : `uid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(UID_KEY, userId);
}

function authedFetch(url, options = {}) {
  const headers = Object.assign({}, options.headers, { "X-User-Id": userId });
  return fetch(url, { ...options, headers });
}

async function fetchJsonSafe(url, options = {}) {
  const res = await authedFetch(url, options);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch (e) {
    console.error("JSON parse edilemedi. Ham cevap:", text);
    throw e;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const savedSummary = localStorage.getItem("tradeSummary");
  if (savedSummary) {
    const parsed = JSON.parse(savedSummary);
    showSummary(parsed);
    return;
  }

  const totalTrades = parseInt(localStorage.getItem("totalTrades"));
  const protectCount = parseInt(localStorage.getItem("protectCount"));

  if (!isNaN(totalTrades) && !isNaN(protectCount)) {
    document.getElementById("trade-count-input").value = totalTrades;
    document.getElementById("protect-count-input").value = protectCount;
    document.getElementById("generate-trade-fields-btn").click();
  }
});

if (!Array.isArray(players) || players.length === 0) {
  alert("Kullanıcı bilgisi bulunamadı. Lütfen giriş sayfasından başlayın.");
  window.location.href = 'start.html';
}

document.getElementById("view-lineups-btn").addEventListener("click", () => {
  const firstUser = players[0].name;
  const tradesDone = localStorage.getItem("tradesSubmitted") === "true";

  if (tradesDone) {
    localStorage.setItem("fromPage", "trade");
    window.location.href = `user_players.html?username=${encodeURIComponent(firstUser)}&from=trade`;
  } else {
    window.location.href = "trade_lineups.html";
  }
});

document.getElementById("generate-trade-fields-btn").addEventListener("click", async () => {
  const totalTrades = parseInt(document.getElementById("trade-count-input").value);
  const protectCount = parseInt(document.getElementById("protect-count-input").value);

  if (isNaN(totalTrades) || isNaN(protectCount)) {
    alert("Lütfen geçerli takas ve koruma sayısı giriniz.");
    return;
  }

  localStorage.setItem("totalTrades", totalTrades);
  localStorage.setItem("protectCount", protectCount);

  // takas veya koruma yoksa: pre-leaderboard al ve final'e geç
  if (totalTrades <= 0 || protectCount <= 0) {
    await precomputeAndGoFinal();
    return;
  }

  // UI ayarları
  document.getElementById("trade-count-input").style.display = "none";
  document.getElementById("trade-count-label").style.display = "none";
  document.getElementById("protect-count-input").style.display = "none";
  document.getElementById("protect-count-label").style.display = "none";
  document.getElementById("generate-trade-fields-btn").style.display = "none";
  document.getElementById("submit-trades-btn").style.display = "block";

  const container = document.getElementById("trade-fields-container");
  container.innerHTML = "";

  players.forEach(player => {
    const column = document.createElement("div");
    column.className = "user-trade-column";
    column.setAttribute("data-username", player.name);

    // Koruma alanı
    const protectDiv = document.createElement("div");
    protectDiv.className = "trade-container";
    protectDiv.innerHTML = `
      <h3>${player.name} - Koruma Hakları (${protectCount})</h3>
      ${[...Array(protectCount)].map((_, i) => `
        <label>Koruma ${i + 1}</label>
        <select class="protect-select" data-username="${player.name}"></select>
      `).join("")}
    `;
    column.appendChild(protectDiv);
    loadTeamPlayers(player.name, 'protect');

    // Takas alanları
    players.filter(p => p.name !== player.name).forEach(opponent => {
      for (let t = 0; t < totalTrades; t++) {
        const tradeDiv = document.createElement("div");
        tradeDiv.className = "trade-container";
        tradeDiv.innerHTML = `
          <h3>${player.name} → ${opponent.name} Takası ${t + 1}</h3>
          <label>${opponent.name}'dan çalmak istediğin oyuncu:</label>
          <select class="steal-select" data-username="${player.name}" data-target="${opponent.name}"></select>

          <label>${player.name}'dan vereceğin oyuncu:</label>
          <select class="exchange-select" data-username="${player.name}"></select>
        `;
        column.appendChild(tradeDiv);

        loadOpponentPlayers(opponent.name, player.name);
      }
    });

    loadTeamPlayers(player.name, 'exchange');
    container.appendChild(column);
  });
});

// Kullanıcının oyuncuları (protect / exchange için)
function loadTeamPlayers(username, type) {
  fetchJsonSafe(`${API}?action=user_players&username=${encodeURIComponent(username)}`)
    .then(data => {
      const selects = document.querySelectorAll(`select.${type}-select[data-username="${username}"]`);

      const positionOrder = ['ST', 'LW', 'RW', 'LM', 'RM', 'CAM', 'CM', 'CDM', 'LB', 'CB', 'RB', 'GK'];
      const sortedPlayers = data.sort((a, b) => {
        const posA = (a.position || '').toUpperCase();
        const posB = (b.position || '').toUpperCase();
        const indexA = positionOrder.indexOf(posA);
        const indexB = positionOrder.indexOf(posB);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });

      selects.forEach(select => {
        select.innerHTML = `<option disabled selected>Oyuncu Seç</option>`;
        sortedPlayers.forEach(p => {
          const option = document.createElement("option");
          option.value = p.player_name;
          option.textContent = `${p.player_name} (${p.position})`;
          select.appendChild(option);
        });
      });
    });
}

// Rakibin oyuncuları (steal-select için)
function loadOpponentPlayers(opponentName, forUsername) {
  fetchJsonSafe(`${API}?action=user_players&username=${encodeURIComponent(opponentName)}`)
    .then(data => {
      const selects = document.querySelectorAll(
        `select.steal-select[data-username="${forUsername}"][data-target="${opponentName}"]`
      );

      const positionOrder = ['ST', 'LW', 'RW', 'LM', 'RM', 'CAM', 'CM', 'CDM', 'LB', 'CB', 'RB', 'GK'];
      const sortedPlayers = data.sort((a, b) => {
        const posA = (a.position || '').toUpperCase();
        const posB = (b.position || '').toUpperCase();
        const indexA = positionOrder.indexOf(posA);
        const indexB = positionOrder.indexOf(posB);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });

      selects.forEach(select => {
        select.innerHTML = `<option disabled selected>Oyuncu Seç</option>`;
        sortedPlayers.forEach(p => {
          const option = document.createElement("option");
          option.value = `${p.player_name}|${opponentName}`;
          option.textContent = `${p.player_name} (${p.position})`;
          select.appendChild(option);
        });
      });
    });
}

// Trade yok/koruma yok ise ilk skorlamayı al ve final'e geç
async function precomputeAndGoFinal() {
  const players = JSON.parse(localStorage.getItem("players") || "[]");
  const params = new URLSearchParams();
  players.forEach(p => {
    const formation = localStorage.getItem(`selectedFormation_${p.name}`) || "4231";
    params.append(`formation_${encodeURIComponent(p.name)}`, formation);
  });

  try {
    const preTradeLeaderboard = await fetchJsonSafe(`${API}?action=get_leaderboard&${params.toString()}`);
    localStorage.setItem("preTradeLeaderboard", JSON.stringify(preTradeLeaderboard));
    window.location.href = "final.html";
  } catch (err) {
    console.error("Pre-trade leaderboard alınırken hata:", err);
    alert("Skor tablosu alınırken bir hata oluştu. Lütfen tekrar deneyin.");
  }
}

function showSummary(summaries) {
  const summaryDiv = document.createElement("div");
  summaryDiv.id = "trade-summary";

  summaryDiv.innerHTML = `
    <h2 style="text-align:center;">Takas Özeti</h2>
    <ul style="list-style:none; padding:0;">
      ${summaries.map(item => `
        <li class="${item.status}">
          ⚽ ${item.message}
        </li>`).join('')}
    </ul>
  `;

  const finishBtn = document.createElement("button");
  finishBtn.textContent = "Oyunu Bitir";
  finishBtn.style.display = "block";
  finishBtn.style.margin = "20px auto";
  finishBtn.onclick = async () => {
    const allLineups = await fetchJsonSafe(`${API}?action=get_all_lineups`);
    const usernames = players.map(p => p.name);
    const isComplete = usernames.every(user =>
      allLineups.filter(entry => entry.username === user).length === 11
    );

    if (!isComplete) {
      alert("Tüm kullanıcılar kadrolarını tamamlamadan oyunu bitiremezsiniz.");
      return;
    }

    localStorage.removeItem("tradeSummary");
    localStorage.removeItem("tradesSubmitted");
    window.location.href = "final.html";
  };

  summaryDiv.appendChild(finishBtn);

  document.querySelector("main").style.display = "none";
  document.getElementById("submit-trades-btn").style.display = "none";
  document.body.appendChild(summaryDiv);

  localStorage.setItem("tradeSummary", JSON.stringify(summaries));
  localStorage.removeItem("totalTrades");
  localStorage.removeItem("protectCount");
}

document.getElementById("submit-trades-btn").addEventListener("click", async () => {
  const players = JSON.parse(localStorage.getItem("players") || "[]");

  // formasyonları querystring’e ekle (pre-leaderboard için)
  const params = new URLSearchParams();
  players.forEach(p => {
    const formation = localStorage.getItem(`selectedFormation_${p.name}`) || "4231";
    params.append(`formation_${encodeURIComponent(p.name)}`, formation);
  });

  const preTradeLeaderboard = await fetchJsonSafe(`${API}?action=get_leaderboard&${params.toString()}`);
  localStorage.setItem("preTradeLeaderboard", JSON.stringify(preTradeLeaderboard));

  const tradeContainers = document.querySelectorAll(".trade-container");
  const attemptedSteals = [];

  tradeContainers.forEach(container => {
    const stealEl = container.querySelector(".steal-select");
    const exchangeEl = container.querySelector(".exchange-select");
    const protectEls = container.querySelectorAll(".protect-select");

    if (!stealEl && !exchangeEl && protectEls.length > 0) return;
    if (!stealEl || !exchangeEl) return;

    const username = stealEl.dataset.username;
    const stealValue = stealEl.value;
    const exchangeValue = exchangeEl.value;
    if (!stealValue || !exchangeValue) return;

    const [stolen_player, target_username] = stealValue.split("|");
    attemptedSteals.push({ thief: username, target_username, stolen_player, exchange_player: exchangeValue });
  });

  // Aynı oyuncuya çoklu talip -> iptal
  const stealCounts = {};
  attemptedSteals.forEach(t => {
    const key = `${t.target_username}|${t.stolen_player}`;
    stealCounts[key] = (stealCounts[key] || 0) + 1;
  });

  attemptedSteals.forEach(t => {
    const key = `${t.target_username}|${t.stolen_player}`;
    if (stealCounts[key] > 1) {
      summaries.push({
        status: "fail",
        message: `${t.thief} kullanıcısı ${t.target_username}'dan ${t.stolen_player} oyuncusunu çalmaya çalıştı ancak bu oyuncuya birden fazla kişi talip olduğu için takas iptal edildi.`
      });
    } else {
      // Hedef kullanıcının korumaları
      const protectSelects = document.querySelectorAll(`.protect-select[data-username="${t.target_username}"]`);
      let isProtected = false;
      protectSelects.forEach(select => {
        if (select.value === t.stolen_player) isProtected = true;
      });

      if (isProtected) {
        summaries.push({
          status: "fail",
          message: `${t.thief} kullanıcısı, ${t.target_username}'dan ${t.stolen_player} oyuncusunu çalmak istedi ama bu oyuncu koruma altında.`
        });
      } else {
        trades.push(t);
      }
    }
  });

  // Geçerli takas yoksa, sadece özet göster
  if (trades.length === 0 && summaries.length > 0) {
    showSummary(summaries);
    return;
  }

  // Takasları gönder
  const result = await fetchJsonSafe(`${API}?action=process_trades`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trades)
  });

  if (result.success) {
    const allSummaries = [...summaries, ...(result.summary || [])];
    showSummary(allSummaries);
    localStorage.setItem("tradesSubmitted", "true");
  } else {
    alert("Takas işlemleri sırasında hata oluştu.");
  }
});
