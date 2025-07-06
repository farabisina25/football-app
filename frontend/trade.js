const players = JSON.parse(localStorage.getItem('players')) || [];
if (!Array.isArray(players) || players.length === 0) {
  alert("Kullanıcı bilgisi bulunamadı. Lütfen giriş sayfasından başlayın.");
  window.location.href = 'start.html';
}

document.getElementById("view-lineups-btn").addEventListener("click", () => {
  const firstUser = players[0].name;
  window.location.href = `user_players.html?username=${encodeURIComponent(firstUser)}`;
});

document.getElementById("generate-trade-fields-btn").addEventListener("click", () => {
  const tradeCount = parseInt(document.getElementById("trade-count-input").value);
  const container = document.getElementById("trade-fields-container");
  container.innerHTML = "";

  if (isNaN(tradeCount) || tradeCount <= 0) {
    alert("Lütfen geçerli bir sayı giriniz.");
    return;
  }

  players.forEach(player => {
    for (let i = 0; i < tradeCount; i++) {
      const tradeDiv = document.createElement("div");
      tradeDiv.className = "trade-container";
      tradeDiv.innerHTML = `
        <h3>${player.name} - Takas ${i + 1}</h3>
        <label>Çalmak istediğin oyuncuyu seç (rakip oyuncular):</label>
        <select class="steal-select" data-username="${player.name}"></select>

        <label>Korumak istediğin oyuncuyu seç (kendi oyuncuların):</label>
        <select class="protect-select" data-username="${player.name}"></select>
      `;

      container.appendChild(tradeDiv);

      loadTeamPlayers(player.name, true);  // protect list
      loadOpponentPlayers(player.name);    // steal list
    }
  });
});

function loadTeamPlayers(username, isProtect = false) {
  fetch(`http://localhost:8000/football.php?action=user_players&username=${encodeURIComponent(username)}`)
    .then(res => res.json())
    .then(data => {
      const selects = document.querySelectorAll(`select.protect-select[data-username="${username}"]`);
      selects.forEach(select => {
        select.innerHTML = `<option disabled selected>Oyuncu Seç</option>`;
        data.forEach(p => {
          const opt = document.createElement("option");
          opt.value = p.player_name;
          opt.textContent = p.player_name;
          select.appendChild(opt);
        });
      });
    });
}

function loadOpponentPlayers(username) {
  players
    .filter(p => p.name !== username)
    .forEach(opponent => {
      fetch(`http://localhost:8000/football.php?action=user_players&username=${encodeURIComponent(opponent.name)}`)
        .then(res => res.json())
        .then(data => {
          const selects = document.querySelectorAll(`select.steal-select[data-username="${username}"]`);
          selects.forEach(select => {
            data.forEach(p => {
              const opt = document.createElement("option");
              opt.value = `${p.player_name}|${opponent.name}`;
              opt.textContent = `${p.player_name} (${opponent.name})`;
              select.appendChild(opt);
            });
          });
        });
    });
}

document.getElementById("submit-trades-btn").addEventListener("click", async () => {
  const tradeContainers = document.querySelectorAll(".trade-container");
  const trades = [];

  tradeContainers.forEach(container => {
    const username = container.querySelector(".steal-select").dataset.username;
    const stealValue = container.querySelector(".steal-select").value;
    const protectValue = container.querySelector(".protect-select").value;

    if (!stealValue || !protectValue) return;

    const [player_name, target_username] = stealValue.split("|");

    trades.push({
      thief: username,
      target_username,
      stolen_player: player_name,
      protected_player: protectValue
    });
  });

  if (trades.length === 0) {
    alert("Takas işlemi yapılacak veri bulunamadı.");
    return;
  }

  const res = await fetch("http://localhost:8000/football.php?action=process_trades", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trades)
  });

  const result = await res.json();

  if (result.success) {
    alert("Takas işlemleri başarıyla tamamlandı!");
    window.location.href = "final.html";
  } else {
    alert("Takas işlemleri sırasında hata oluştu:\n" + (result.error || "Bilinmeyen hata."));
    console.error(result);
  }
});

