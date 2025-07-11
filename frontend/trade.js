const players = JSON.parse(localStorage.getItem('players')) || [];

document.addEventListener("DOMContentLoaded", () => {
  const savedSummary = localStorage.getItem("tradeSummary");
  if (savedSummary) {
    const parsed = JSON.parse(savedSummary);
    showSummary(parsed);
  }
});

if (!Array.isArray(players) || players.length === 0) {
  alert("Kullanıcı bilgisi bulunamadı. Lütfen giriş sayfasından başlayın.");
  window.location.href = 'start.html';
}

document.getElementById("view-lineups-btn").addEventListener("click", () => {
  const firstUser = players[0].name;
  localStorage.setItem("fromPage", "trade");
  window.location.href = `user_players.html?username=${encodeURIComponent(firstUser)}&from=trade`;
});

document.getElementById("generate-trade-fields-btn").addEventListener("click", () => {
  const tradeCount = parseInt(document.getElementById("trade-count-input").value);
  const container = document.getElementById("trade-fields-container");
  container.innerHTML = "";

  if (isNaN(tradeCount) || tradeCount <= 0) {
    alert("Lütfen 1 ile 5 arasında geçerli bir takas hakkı giriniz.");
    return;
  }

  // ➤ Input ve butonu gizle
  document.getElementById("trade-count-input").style.display = "none";
  document.getElementById("generate-trade-fields-btn").style.display = "none";
  document.getElementById("trade-count-input").style.display = "none";
  document.getElementById("trade-count-label").style.display = "none";

  // ➤ Takasları Bitir butonunu göster
  document.getElementById("submit-trades-btn").style.display = "block";

  // ➤ Her kullanıcı için takas alanlarını oluştur
  players.forEach(player => {
    const column = document.createElement("div");
    column.className = "user-trade-column";
    column.setAttribute("data-username", player.name);

    for (let i = 0; i < tradeCount; i++) {
      const tradeDiv = document.createElement("div");
      tradeDiv.className = "trade-container";
      tradeDiv.innerHTML = `
        <h3>${player.name} - Takas ${i + 1}</h3>

        <label>Çalmak istediğin oyuncu (rakip):</label>
        <select class="steal-select" data-username="${player.name}"></select>

        <label>Takaslamak istediğin oyuncu (kendi):</label>
        <select class="exchange-select" data-username="${player.name}"></select>

        <label>Korumak istediğin oyuncu (kendi):</label>
        <select class="protect-select" data-username="${player.name}"></select>
      `;
      column.appendChild(tradeDiv);
    }

    container.appendChild(column);
    loadTeamPlayers(player.name, 'exchange');
    loadTeamPlayers(player.name, 'protect');
    loadOpponentPlayers(player.name);
  });
});


function loadTeamPlayers(username, type) {
  fetch(`http://localhost:8000/football.php?action=user_players&username=${encodeURIComponent(username)}`)
    .then(res => res.json())
    .then(data => {
      const selects = document.querySelectorAll(`select.${type}-select[data-username="${username}"]`);
      
      // Veriyi mevkisine göre sıralama
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
          option.textContent = `${p.player_name} (${p.position})`; // İsmin yanında mevkiyi göster
          select.appendChild(option);
        });
      });
    });
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
    const res = await fetch("http://localhost:8000/football.php?action=get_all_lineups");
    const allLineups = await res.json();
    const usernames = players.map(p => p.name);
    const isComplete = usernames.every(user =>
      allLineups.filter(entry => entry.username === user).length === 11
    );

    if (!isComplete) {
      alert("Tüm kullanıcılar kadrolarını tamamlamadan oyunu bitiremezsiniz.");
      return;
    }

    localStorage.removeItem("tradeSummary"); // özeti temizle
    window.location.href = "final.html";
  };

  summaryDiv.appendChild(finishBtn);

  document.querySelector("main").style.display = "none";
  document.getElementById("submit-trades-btn").style.display = "none";

  document.body.appendChild(summaryDiv);

  // ✅ Özet bilgisini localStorage'a yaz
  localStorage.setItem("tradeSummary", JSON.stringify(summaries));
}


function loadOpponentPlayers(username) {
  players
    .filter(p => p.name !== username)
    .forEach(opponent => {
      fetch(`http://localhost:8000/football.php?action=user_players&username=${encodeURIComponent(opponent.name)}`)
        .then(res => res.json())
        .then(data => {
          const selects = document.querySelectorAll(`select.steal-select[data-username="${username}"]`);
          
          // Veriyi mevkisine göre sıralama
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
              option.value = `${p.player_name}|${opponent.name}`;
              option.textContent = `${p.player_name} (${p.position})`; // İsmin yanında mevkiyi göster
              select.appendChild(option);
            });
          });
        });
    });
}



document.getElementById("submit-trades-btn").addEventListener("click", async () => {
  const preTradeRes = await fetch("http://localhost:8000/football.php?action=get_leaderboard");
  const preTradeLeaderboard = await preTradeRes.json();
  localStorage.setItem("preTradeLeaderboard", JSON.stringify(preTradeLeaderboard));
  
  const tradeContainers = document.querySelectorAll(".trade-container");
  const trades = [];
  const summaries = [];

  tradeContainers.forEach(container => {
    const username = container.querySelector(".steal-select").dataset.username;
    const stealValue = container.querySelector(".steal-select").value;
    const exchangeValue = container.querySelector(".exchange-select").value;
    const protectValue = container.querySelector(".protect-select").value;

    if (!stealValue || !exchangeValue || !protectValue) return;

    const [stolen_player, target_username] = stealValue.split("|");

    // Eğer korunan oyuncu, çalınmak istenen oyuncuysa trade geçersiz
    if (stolen_player === protectValue) {
      summaries.push({
        status: "fail",
        message: `${username} kullanıcısı, ${target_username}'dan ${stolen_player} oyuncusunu çalmak istedi ama bu oyuncu koruma altında.`
      });
      return; // Backend'e gönderme
    }

    trades.push({
      thief: username,
      target_username,
      stolen_player,
      protected_player: protectValue,
      exchange_player: exchangeValue
    });
  });

  // Eğer hiç geçerli takas yoksa sadece özet göster
  if (trades.length === 0 && summaries.length > 0) {
    showSummary(summaries);
    return;
  }

  const res = await fetch("http://localhost:8000/football.php?action=process_trades", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trades)
  });

  const result = await res.json();

  if (result.success) {
    const allSummaries = [...summaries, ...(result.summary || [])];
    showSummary(allSummaries);
  } else {
    alert("Takas işlemleri sırasında hata oluştu.");
  }
});

