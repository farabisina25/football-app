const preTrade = JSON.parse(localStorage.getItem("preTradeLeaderboard") || "[]");
const preList = document.getElementById('pre-trade-leaderboard');

// Kimya bonuslarını hesaplayıp finalPower alanını ekle
preTrade.forEach(entry => {
  const chemistry = parseInt(localStorage.getItem(`chemistry_before_${entry.username}`)) || 0;
  const bonus = chemistry * 0.3;
  entry.finalPower = Number(entry.power) + bonus;
  entry.bonus = bonus;
});

// 🔄 finalPower'a göre sırala (büyükten küçüğe)
preTrade.sort((a, b) => b.finalPower - a.finalPower);

// Listeyi render et
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

const players = JSON.parse(localStorage.getItem("players") || "[]");
const postTradeParams = new URLSearchParams();

players.forEach((p) => {
  const formation = localStorage.getItem(`selectedFormation_${p.name}`) || "4231";
  postTradeParams.append(`formation_${encodeURIComponent(p.name)}`, formation);
});

// 📡 SONRA leaderboard verisini çek
fetch(`http://localhost:8000/football.php?action=get_leaderboard&${postTradeParams.toString()}`)
  .then(res => res.json())
  .then(data => {
    console.log(postTradeParams.toString());
    // Her entry'ye kimya bonuslu final power hesapla ve ekle
    data.forEach(entry => {
      const chemistry = parseInt(localStorage.getItem(`chemistry_after_${entry.username}`)) || 0;
      const bonus = chemistry * 0.3;
      entry.finalPower = Number(entry.power) + bonus;
      entry.bonus = bonus;
    });

    // 🔄 Şimdi finalPower'a göre büyükten küçüğe sırala
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

// 🔁 Reset
document.getElementById("restart-btn")?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "start.html";
});
