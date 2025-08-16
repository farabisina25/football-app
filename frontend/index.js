const API = "http://localhost:8000/football.php";

const players = JSON.parse(localStorage.getItem('players')) || [];
const UID_KEY = "user_id";
let isAdding = false; // global

// ✅ user_id yoksa üret
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

const SLICE_COLORS = [
  "#2ecc71", "#27ae60", "#1abc9c", "#16a085", "#2e86de",
  "#8e44ad", "#f39c12", "#e67e22", "#e74c3c", "#95a5a6"
];

if (!Array.isArray(players) || players.length === 0) {
  alert("Kullanıcı bilgisi bulunamadı. Lütfen giriş sayfasından başlayın.");
  window.location.href = 'start.html';
}

const endGameBtn   = document.getElementById('end-game-btn');
const playerArea   = document.getElementById('player-area');
const spinBtn      = document.getElementById("spin-btn");
const canvas       = document.getElementById("team-wheel");
const ctx          = canvas.getContext("2d");
const radius       = canvas.width / 2;

let teamData = [];
let spinning = false;
let angle = 0;
let velocity = 0;
let selectedTeam = null;
let currentPlayerIndex = 0;
let currentTurn = 0;
let maxTurns = 11;
let isWaitingForTeamSelection = true;

function disableAllAddButtons(disabled) {
  document.querySelectorAll(".add-button").forEach(btn => {
    btn.disabled = disabled;
    if (disabled) {
      btn.textContent = "İşleniyor...";
    } else {
      btn.textContent = "Kadroma Ekle";
    }
  });
}

async function calculateCurrentTurn() {
  const userPlayerCounts = await Promise.all(
    players.map(async player => {
      const response = await authedFetch(
        `${API}?action=user_players&username=${encodeURIComponent(player.name)}`
      );
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
    spinBtn.style.display = "none";
    endGameBtn.style.display = 'inline-block';
    playerArea.style.display = "none";
    return false;
  }

  return true;
}

function updateTurnInfo() {
  const heading = document.getElementById("turn-info-heading");

  if (!isWaitingForTeamSelection) {
    heading.textContent = "Turlar Bitti";
    return;
  }

  const username = players[currentPlayerIndex].name;
  heading.textContent = `${username} - ${currentTurn + 1}. Tur`;
  playerArea.innerHTML = "";
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
    ctx.fillStyle = SLICE_COLORS[index % SLICE_COLORS.length];
    ctx.fill();

    ctx.save();
    ctx.translate(radius, radius);
    ctx.rotate(angleStart + sliceAngle / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px sans-serif";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.strokeText(team.team_name, radius - 10, 5);
    ctx.fillText(team.team_name, radius - 10, 5);
    ctx.restore();
  });

  // merkezden çıkan ok
  ctx.save();
  ctx.translate(radius, radius);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -radius + 170);
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#e91e63";
  ctx.stroke();
  ctx.restore();
}

async function loadTeams() {
  const res = await authedFetch(`${API}?action=get_teams`);
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

    if (index === highlightIndex) {
      ctx.fillStyle = "#ffeb3b";
      ctx.shadowColor = "#ffc107";
      ctx.shadowBlur = 30;
    } else {
      ctx.fillStyle = SLICE_COLORS[index % SLICE_COLORS.length];
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }

    ctx.fill();

    ctx.save();
    ctx.translate(radius, radius);
    ctx.rotate(angleStart + sliceAngle / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px sans-serif";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.strokeText(team.team_name, radius - 10, 5);
    ctx.fillText(team.team_name, radius - 10, 5);
    ctx.restore();
  });

  // ok
  ctx.save();
  ctx.translate(radius, radius);
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

  velocity = Math.random() * 0.1 + 0.15;

  function animate() {
    drawRotatedWheel(angle);
    angle += velocity;

    if (velocity < 0.03) {
      velocity *= 0.96;
    } else {
      velocity *= 0.99;
    }

    if (velocity < 0.005) {
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

  const [playersList, gameplayers] = await Promise.all([
    authedFetch(`${API}?action=get_players_by_team&team_id=${selectedTeam.id}`).then(res => res.json()),
    authedFetch(`${API}?action=get_all_game_players`).then(res => res.json())
  ]);

  const positionOrder = ['ST', 'LW', 'RW', 'LM', 'RM', 'CAM', 'CM', 'CDM', 'LB', 'CB', 'RB', 'GK'];

  playersList.sort((a, b) => {
    const posA = a.position?.toUpperCase() || '';
    const posB = b.position?.toUpperCase() || '';
    const indexA = positionOrder.indexOf(posA);
    const indexB = positionOrder.indexOf(posB);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });

  playerArea.innerHTML = "";

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
        if (isAdding) return; // zaten işlem varsa tıklamayı engelle
        isAdding = true;
        disableAllAddButtons(true);

        const payload = {
          username,
          team_id: selectedTeam.id,
          player_id: player.id
        };

        try {
          const res = await authedFetch(`${API}?action=add_game_player`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          const data = await res.json();
          if (data.success) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            localStorage.removeItem("selectedTeamIndex");

            setTimeout(async () => {
              document.getElementById("player-area").style.display = "none";
              document.getElementById("right-heading").style.visibility = "hidden";
              drawWheel();
              isWaitingForTeamSelection = true;
              await calculateCurrentTurn();
              updateTurnInfo();
              isAdding = false; // ✅ işlem bitti
            }, 900);
          } else {
            isAdding = false;
            disableAllAddButtons(false); // ❌ başarısızsa geri aç
            alert("Ekleme başarısız: " + (data.error || "Bilinmeyen hata"));
          }
        } catch (err) {
          isAdding = false;
          disableAllAddButtons(false);
          alert("Sunucu hatası: " + err.message);
        }
      };
    }

    div.appendChild(nameSpan);
    div.appendChild(btn);
    playerArea.appendChild(div);
  });

  requestAnimationFrame(() => {
    setTimeout(() => {
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: 'smooth'
      });
    }, 100);
  });
}

document.getElementById("end-game-btn").addEventListener("click", async () => {
  for (let player of players) {
    const res = await authedFetch(`${API}?action=get_lineup&username=${encodeURIComponent(player.name)}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length !== 11) {
      alert(`${player.name} adlı oyuncunun sahaya yerleştirdiği oyuncu sayısı 11 değil!`);
      return;
    }
  }
  window.location.href = "trade.html";
});

document.getElementById("view-lineups-btn").onclick = () => {
  const username = players[currentPlayerIndex].name;
  localStorage.setItem("fromPage", "index");
  window.location.href = `user_players.html?username=${encodeURIComponent(username)}&from=index`;
};

document.getElementById("restart-btn").addEventListener("click", async () => {
  try {
    // ❗ user_id’yi koru
    const keepUid = localStorage.getItem(UID_KEY);
    localStorage.clear();
    if (keepUid) localStorage.setItem(UID_KEY, keepUid);

    // oyun tablolarını temizle (user scope)
    await authedFetch(`${API}?action=reset_game`).then(res => res.json());

    // kullanıcının takımlarını temizle
    await authedFetch(`${API}?action=teams_truncate`, { method: "DELETE" }).then(res => res.json());

    window.location.href = "start.html";
  } catch (err) {
    console.error("Sunucu hatası:", err);
    alert("Tablolar temizlenemedi.");
  }
});

spinBtn.addEventListener("click", spinWheel);

// Başlat
loadTeams().then(async () => {
  const savedIndex = localStorage.getItem("selectedTeamIndex");
  await calculateCurrentTurn();
  updateTurnInfo();

  if (savedIndex !== null && isWaitingForTeamSelection) {
    await handleTeamSelection(parseInt(savedIndex, 10));
    return;
  }

  setTimeout(() => {
    const anchor = document.getElementById('scroll-anchor');
    if (anchor) {
      anchor.scrollIntoView({ behavior: 'smooth' });
    }
  }, 300);
});
