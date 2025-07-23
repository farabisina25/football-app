const players = JSON.parse(localStorage.getItem('players')) || [];

if (!Array.isArray(players) || players.length === 0) {
  alert("Kullanıcı bilgisi bulunamadı. Lütfen giriş sayfasından başlayın.");
  window.location.href = 'start.html';
}

const endGameBtn = document.getElementById('end-game-btn');
const playerArea = document.getElementById('player-area');
const spinBtn = document.getElementById("spin-btn");
const canvas = document.getElementById("team-wheel");
const ctx = canvas.getContext("2d");
const radius = canvas.width / 2;

let teamData = [];
let spinning = false;
let angle = 0;
let velocity = 0;
let selectedTeam = null;
let currentPlayerIndex = 0;
let currentTurn = 0;
let maxTurns = 11;
let isWaitingForTeamSelection = true;

async function calculateCurrentTurn() {
  const userPlayerCounts = await Promise.all(
    players.map(async player => {
      const response = await fetch(`http://localhost:8000/football.php?action=user_players&username=${encodeURIComponent(player.name)}`);
      const data = await response.json();
      return Array.isArray(data) ? data.length : 0;
    })
  );

  const minCount = Math.min(...userPlayerCounts);
  const allEqual = userPlayerCounts.every(count => count === userPlayerCounts[0]);
  const allMaxed = userPlayerCounts.every(count => count >= maxTurns);

  currentTurn = minCount;
  currentPlayerIndex = userPlayerCounts.findIndex(count => count === minCount);

  if (allEqual && allMaxed) {
    isWaitingForTeamSelection = false;  // Turlar bitti

    // Çark butonunu tamamen gizle
    spinBtn.style.display = "none";

    // "Oyunu Bitir" butonunu göster
    endGameBtn.style.display = 'inline-block';

    // Oyuncu listesi gizlensin
    playerArea.style.display = "none";

    return false;
  }


  return true;
}

function updateTurnInfo() {
  const heading = document.getElementById("turn-info-heading");

  // Tüm oyuncular 11 kişilik kadro oluşturduysa
  if (!isWaitingForTeamSelection) {
    heading.textContent = "Turlar Bitti";
    return;
  }

  const username = players[currentPlayerIndex].name;
  heading.textContent = `${username} - ${currentTurn + 1}. Tur`;
  playerArea.innerHTML = ""; // Tur metni gösterilmeyecek
}



function drawWheel() {
  const sliceAngle = (2 * Math.PI) / teamData.length;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  teamData.forEach((team, index) => {
    const angleStart = index * sliceAngle;
    ctx.beginPath();
    ctx.moveTo(radius, radius);
    ctx.arc(radius, radius, radius, angleStart, angleStart + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = index % 2 === 0 ? "#4caf50" : "#81c784";
    ctx.fill();

    ctx.save();
    ctx.translate(radius, radius);
    ctx.rotate(angleStart + sliceAngle / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(team.team_name, radius - 10, 5);
    ctx.restore();
  });

    // Saat yelkovanı şeklinde merkezden çıkan ok
  ctx.save();
  ctx.translate(radius, radius);
  ctx.rotate(0); // Yelkovan açısı sıfır
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -radius + 170); // veya -radius + 50
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#e91e63";
  ctx.stroke();
  ctx.restore();

}

async function loadTeams() {
  const res = await fetch("http://localhost:8000/football.php?action=get_teams");
  teamData = await res.json();
  drawWheel();
}

function drawRotatedWheel(angleOffset, highlightIndex = -1) {
  const sliceAngle = (2 * Math.PI) / teamData.length;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  teamData.forEach((team, index) => {
    const angleStart = index * sliceAngle + angleOffset;
    const angleEnd = angleStart + sliceAngle;

    ctx.beginPath();
    ctx.moveTo(radius, radius);
    ctx.arc(radius, radius, radius, angleStart, angleEnd);
    ctx.closePath();

    // 🎨 Seçilen takımsa parlak renk ve glow efekti
    if (index === highlightIndex) {
      ctx.fillStyle = "#ffeb3b"; // Sarı gibi bir parlak renk
      ctx.shadowColor = "#ffc107";
      ctx.shadowBlur = 30;
    } else {
      ctx.fillStyle = index % 2 === 0 ? "#4caf50" : "#81c784";
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }

    ctx.fill();

    ctx.save();
    ctx.translate(radius, radius);
    ctx.rotate(angleStart + sliceAngle / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#1b5e20";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(team.team_name, radius - 10, 5);
    ctx.restore();
  });

  ctx.save();
  ctx.translate(radius, radius);
  ctx.rotate(0);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -radius + 170);
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#e91e63";
  ctx.stroke();
  ctx.restore();
}

function spinWheel() {
  if (spinning || !isWaitingForTeamSelection) return;
  spinning = true;

  velocity = Math.random() * 0.1 + 0.15;  // Başlangıç hızı

  function animate() {
    drawRotatedWheel(angle);
    angle += velocity;

    // Durmaya yaklaştıkça yavaşlama daha da artar
    if (velocity < 0.03) {
      velocity *= 0.96;  // Daha keskin yavaşlat
    } else {
      velocity *= 0.99;  // Normal yavaşlama
    }

    if (velocity < 0.005) {  // Daha yumuşak eşik
      spinning = false;

      const sliceAngle = (2 * Math.PI) / teamData.length;
      let pointerAngle = (Math.PI * 1.5 - angle) % (2 * Math.PI);
      if (pointerAngle < 0) pointerAngle += 2 * Math.PI;

      const selectedIndex = Math.floor(pointerAngle / sliceAngle);

      drawRotatedWheel(angle, selectedIndex);

      setTimeout(() => {
        handleTeamSelection(selectedIndex);
      }, 700);

      return;
    }

    requestAnimationFrame(animate);
  }

  animate();
}





async function handleTeamSelection(index) {
  localStorage.setItem("selectedTeamIndex", index);

  const username = players[currentPlayerIndex].name;
  selectedTeam = teamData[index];
  isWaitingForTeamSelection = false;

  const headingRight = document.getElementById("right-heading");
  const playerAreaEl = document.getElementById("player-area");

  headingRight.style.visibility = "visible";
  playerAreaEl.style.display = "block";
  playerAreaEl.classList.add("fade-in");
  headingRight.classList.add("fade-in");

  headingRight.textContent = `${selectedTeam.team_name} Oyuncuları (${username})`;

  // Listenin altına yumuşak kaydır
  /*document.getElementById("scroll-anchor").scrollIntoView({
    behavior: "smooth",
    block: "end"
  });*/



  const [playersList, gameplayers] = await Promise.all([
    fetch(`http://localhost:8000/football.php?action=get_players_by_team&team_id=${selectedTeam.id}`).then(res => res.json()),
    fetch("http://localhost:8000/football.php?action=get_all_game_players").then(res => res.json())
  ]);

  const positionOrder = ['ST', 'LW', 'RW', 'LM', 'RM', 'CAM', 'CM', 'CDM', 'LB', 'CB', 'RB', 'GK'];

  playersList.sort((a, b) => {
    const posA = a.position?.toUpperCase() || '';
    const posB = b.position?.toUpperCase() || '';
    const indexA = positionOrder.indexOf(posA);
    const indexB = positionOrder.indexOf(posB);
    // Bilinmeyen pozisyonlar en sona atılır
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });

  playerArea.innerHTML = ""; // oyuncular için alan temizleniyor

  playersList.forEach(player => {
    const div = document.createElement("div");
    div.className = "player-item";

    const nameSpan = document.createElement("span");
    const playerName = player.player_name || "İsimsiz Oyuncu";
    const position = player.position || "";

    nameSpan.textContent = `${playerName} (${position})`;


    const btn = document.createElement("button");
    const owner = gameplayers.find(entry => entry.player_name?.trim() === playerName);

    if (owner) {
      btn.textContent = owner.username;
      btn.disabled = true;
      btn.style.backgroundColor = "darkred";
      btn.style.color = "white";
      btn.style.fontWeight = "bold";
    } else {
      btn.textContent = "Kadroma Ekle";
      btn.className = "add-button";

      btn.onclick = async () => {
        const payload = {
          username,
          team_id: selectedTeam.id,
          player_id: player.id
        };

        const res = await fetch("http://localhost:8000/football.php?action=add_game_player", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
          // 🌟 1. Scroll yukarıya
          window.scrollTo({
            top: 0,
            behavior: 'smooth'
          });

          // 🌟 2. Takım bilgisini temizle
          localStorage.removeItem("selectedTeamIndex");

          // 🌟 3. 900ms bekle, sonra player listi ve başlığı kaldır
          setTimeout(async () => {
            document.getElementById("player-area").style.display = "none";
            document.getElementById("right-heading").style.visibility = "hidden";

            // 🌟 4. Çarkı sıfırla
            drawWheel();

            // 🌟 5. Yeni tura geç
            isWaitingForTeamSelection = true;
            const canContinue = await calculateCurrentTurn();
            if (canContinue) updateTurnInfo();
          }, 900);
        } else {
          alert("Ekleme başarısız: " + (data.error || "Bilinmeyen hata"));
        }
      };


    }

    div.appendChild(nameSpan);
    div.appendChild(btn);
    playerArea.appendChild(div);
  });

  // Oyuncular eklendikten sonra sayfanın tamamen render edilmesini bekle, sonra scroll et
  requestAnimationFrame(() => {
    setTimeout(() => {
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: 'smooth'
      });
    }, 100); // render sonrası küçük gecikme
  });


}


document.getElementById("end-game-btn").addEventListener("click", async () => {
  for (let player of players) {
    const res = await fetch(`http://localhost:8000/football.php?action=get_lineup&username=${encodeURIComponent(player.name)}`);
    const data = await res.json();
    
    if (!Array.isArray(data) || data.length !== 11) {
      alert(`${player.name} adlı oyuncunun sahaya yerleştirdiği oyuncu sayısı 11 değil!`);
      return;
    }
  }
  // Tüm kullanıcılar 11 kişiyse yönlendir
  window.location.href = "trade.html";
});


document.getElementById("view-lineups-btn").onclick = () => {
  const firstUsername = players[0].name;
  localStorage.setItem("fromPage", "index");
  window.location.href = `user_players.html?username=${encodeURIComponent(firstUsername)}&from=index`;
};

document.getElementById("restart-btn").addEventListener("click", () => {
  localStorage.removeItem("selectedTeamIndex");
  window.location.href = "start.html";
});


spinBtn.addEventListener("click", spinWheel);

// Başlat
loadTeams().then(async () => {
  const savedIndex = localStorage.getItem("selectedTeamIndex");
  await calculateCurrentTurn();
  updateTurnInfo();

  if (savedIndex !== null && isWaitingForTeamSelection) {
    await handleTeamSelection(parseInt(savedIndex));
    return;
  }

  // En alta scroll
  setTimeout(() => {
    const anchor = document.getElementById('scroll-anchor');
    if (anchor) {
      anchor.scrollIntoView({ behavior: 'smooth' });
    }
  }, 300);
});

