const API = "http://localhost:8000/football.php";

const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('username');
const positionOrder = ['ST', 'LW', 'RW', 'LM', 'RM', 'CAM', 'CM', 'CDM', 'LB', 'CB', 'RB', 'GK'];
document.getElementById('user-title').innerText = `${username} - Seçtiği Oyuncular`;

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
  const txt = await res.text();
  try { return JSON.parse(txt); }
  catch (e) { console.error("JSON parse edilemedi. Ham cevap:", txt); throw e; }
}

// --- KADRODAKI OYUNCULARI ID BAZLI TUT ---
let existingLineupIds = new Set();

// İlk kadroyu çek + slotlara yaz
fetchJsonSafe(`${API}?action=get_lineup&username=${encodeURIComponent(username)}`)
  .then(lineup => {
    if (Array.isArray(lineup)) {
      lineup.forEach(player => {
        const slot = document.getElementById(`slot${player.slot_no}`);
        if (!slot) return;
        const position = player.position?.toUpperCase() || "POZİSYON YOK";
        slot.innerText = `${player.player_name} - ${position}`;
        slot.setAttribute("data-position", position);
        slot.setAttribute("data-team", player.team_id || "");
        slot.setAttribute("data-player-id", player.player_id || ""); // önemli
        if (player.player_id) existingLineupIds.add(String(player.player_id));
      });
    }
  })
  .then(() => fetchJsonSafe(`${API}?action=user_players&username=${encodeURIComponent(username)}`))
  .then(data => {
    const list = document.getElementById('player-list');
    if (!Array.isArray(data) || data.length === 0) {
      list.innerHTML = '<p>Bu kullanıcı henüz oyuncu seçmemiş.</p>';
      return;
    }
    // Pozisyona göre sırala
    data.sort((a,b) => {
      const posA = (a.position||'').toUpperCase();
      const posB = (b.position||'').toUpperCase();
      const indexA = positionOrder.indexOf(posA);
      const indexB = positionOrder.indexOf(posB);
      return (indexA===-1?999:indexA) - (indexB===-1?999:indexB);
    });

    data.forEach((player, index) => {
      const rawName  = (player.player_name || '').trim();
      const position = (player.position || 'POZİSYON YOK').toUpperCase();
      const pid      = player.player_id != null ? String(player.player_id) : "";

      // Aynı isim olabilir; bu yüzden ID'ye göre filtrele
      if (pid && existingLineupIds.has(pid)) return;

      const div = document.createElement('div');
      div.className = 'player-item';
      div.id = `player-${index + 1}`;
      div.draggable = true;
      div.ondragstart = drag;
      div.innerText = `${rawName} - ${position}`;
      div.setAttribute("data-position", position);
      div.setAttribute("data-team", player.team_id || "");
      div.setAttribute("data-player-id", pid);
      document.getElementById('player-list').appendChild(div);
    });
  })
  .catch(err => {
    console.error(err);
    document.getElementById('player-list').innerHTML = '<p>Oyuncular yüklenemedi.</p>';
  });

function sortPlayerList() {
  const list = document.getElementById("player-list");
  const items = Array.from(list.getElementsByClassName("player-item"));
  items.sort((a, b) => {
    const posA = a.getAttribute("data-position")?.toUpperCase() || "Z";
    const posB = b.getAttribute("data-position")?.toUpperCase() || "Z";
    const indexA = positionOrder.indexOf(posA);
    const indexB = positionOrder.indexOf(posB);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });
  items.forEach(item => list.appendChild(item));
}

function allowDrop(ev) { ev.preventDefault(); }
function drag(ev) { ev.dataTransfer.setData("text", ev.target.id); }

function drop(ev) {
  ev.preventDefault();
  const data = ev.dataTransfer.getData("text");
  const draggedElement = document.getElementById(data);
  const targetSlot = ev.target;
  if (!draggedElement || !targetSlot.classList.contains("player-slot")) return;

  const draggedText = draggedElement.innerText.trim();
  const targetText  = targetSlot.innerText.trim();

  // dragged meta
  const draggedName = (draggedText.split(" - ")[0] || "").trim();
  const draggedPos  = (draggedElement.getAttribute("data-position") || draggedText.split(" - ")[1] || "POZİSYON YOK").trim();
  const draggedTeam = draggedElement.getAttribute("data-team") || "";
  const draggedId   = draggedElement.getAttribute("data-player-id") || "";

  if (targetText === "") {
    // Boş slota bırak
    targetSlot.innerText = `${draggedName} - ${draggedPos}`;
    targetSlot.setAttribute("data-position", draggedPos);
    targetSlot.setAttribute("data-team", draggedTeam);
    targetSlot.setAttribute("data-player-id", draggedId);

    if (draggedElement.classList.contains("player-item")) {
      draggedElement.remove();
      if (draggedId) existingLineupIds.add(draggedId);
    } else if (draggedElement.classList.contains("player-slot")) {
      draggedElement.innerText = '';
      draggedElement.removeAttribute("data-position");
      draggedElement.removeAttribute("data-team");
      draggedElement.removeAttribute("data-player-id");
    }

    targetSlot.classList.add('fade-in');
    setTimeout(() => targetSlot.classList.remove('fade-in'), 300);

  } else {
    if (draggedElement.classList.contains("player-slot")) {
      // slot-to-slot takas
      const targetName = (targetText.split(" - ")[0] || "").trim();
      const targetPos  = (targetSlot.getAttribute("data-position") || targetText.split(" - ")[1] || "POZİSYON YOK").trim();
      const targetTeam = targetSlot.getAttribute("data-team") || "";
      const targetId   = targetSlot.getAttribute("data-player-id") || "";

      // Swap text
      draggedElement.innerText = `${targetName} - ${targetPos}`;
      targetSlot.innerText     = `${draggedName} - ${draggedPos}`;

      // Swap meta
      draggedElement.setAttribute("data-position", targetPos);
      targetSlot.setAttribute("data-position", draggedPos);

      draggedElement.setAttribute("data-team", targetTeam);
      targetSlot.setAttribute("data-team", draggedTeam);

      draggedElement.setAttribute("data-player-id", targetId);
      targetSlot.setAttribute("data-player-id", draggedId);

      draggedElement.classList.add('fade-in');
      targetSlot.classList.add('fade-in');
      setTimeout(() => {
        draggedElement.classList.remove('fade-in');
        targetSlot.classList.remove('fade-in');
      }, 300);

    } else if (draggedElement.classList.contains("player-item")) {
      // listeden DOLU slota bırak
      const targetName = (targetText.split(" - ")[0] || "").trim();
      const targetPos  = (targetSlot.getAttribute("data-position") || targetText.split(" - ")[1] || "POZİSYON YOK").trim();
      const targetTeam = targetSlot.getAttribute("data-team") || "";
      const targetId   = targetSlot.getAttribute("data-player-id") || "";

      // Hedefteki oyuncuyu listeye geri koy
      const newListItem = document.createElement("div");
      newListItem.className = 'player-item fade-in';
      newListItem.innerText = `${targetName} - ${targetPos}`;
      newListItem.id = `player-${Date.now()}`;
      newListItem.draggable = true;
      newListItem.ondragstart = drag;
      newListItem.setAttribute("data-position", targetPos);
      newListItem.setAttribute("data-team", targetTeam);
      newListItem.setAttribute("data-player-id", targetId);
      document.getElementById("player-list").appendChild(newListItem);
      sortPlayerList();
      if (targetId) existingLineupIds.delete(targetId); // artık kadrodan çıktı

      // Sürüklenen oyuncuyu slota yaz
      targetSlot.innerText = `${draggedName} - ${draggedPos}`;
      targetSlot.setAttribute("data-position", draggedPos);
      targetSlot.setAttribute("data-team", draggedTeam);
      targetSlot.setAttribute("data-player-id", draggedId);

      // Listeden sürüklenen item'ı kaldır
      draggedElement.remove();
      if (draggedId) existingLineupIds.add(draggedId);

      targetSlot.classList.add('fade-in');
      setTimeout(() => targetSlot.classList.remove('fade-in'), 300);
    }
  }

  updateSlotDraggables();
  autoSaveLineup();
  setTimeout(updateSlotDraggables, 100);
  calculateChemistryLinks();
}

function dropToList(ev) {
  ev.preventDefault();
  const data = ev.dataTransfer.getData("text");
  const draggedElement = document.getElementById(data);
  if (!draggedElement) return;

  const playerText = draggedElement.innerText.trim();
  const playerName = (playerText.split(" - ")[0] || "").trim();
  const playerPosition = (draggedElement.getAttribute("data-position") || playerText.split(" - ")[1] || "POZİSYON YOK").trim();
  const playerTeam = draggedElement.getAttribute("data-team") || "";
  const playerId = draggedElement.getAttribute("data-player-id") || "";

  const newPlayer = document.createElement('div');
  newPlayer.className = 'player-item fade-in';
  newPlayer.innerText = `${playerName} - ${playerPosition}`;
  newPlayer.setAttribute("data-position", playerPosition);
  newPlayer.setAttribute("data-team", playerTeam);
  newPlayer.setAttribute("data-player-id", playerId);
  newPlayer.setAttribute("draggable", "true");
  newPlayer.ondragstart = drag;
  newPlayer.id = `player-${Date.now()}`;

  document.getElementById("player-list").appendChild(newPlayer);
  sortPlayerList();

  if (draggedElement.classList.contains("player-slot")) {
    draggedElement.innerText = '';
    draggedElement.removeAttribute("data-position");
    draggedElement.removeAttribute("data-team");
    draggedElement.removeAttribute("data-player-id");
    if (playerId) existingLineupIds.delete(playerId);
  } else {
    draggedElement.remove();
  }

  setTimeout(updateSlotDraggables, 100);
  autoSaveLineup();
  calculateChemistryLinks();
}

function updateSlotDraggables() {
  for (let i = 1; i <= 11; i++) {
    const slot = document.getElementById(`slot${i}`);
    if (slot) {
      const text = slot.innerText.trim();
      if (text !== "") {
        slot.classList.add("player-slot"); // güvence
        slot.draggable = true;
        slot.ondragstart = drag;
      } else {
        slot.draggable = false;
        slot.ondragstart = null;
      }
    }
  }
}

// === SUNUCUYA ID/POZ/TAKIMLA KAYDET ===
function autoSaveLineup() {
  const lineup = [];
  for (let i = 1; i <= 11; i++) {
    const slot = document.getElementById(`slot${i}`);
    const playerText = slot.innerText.trim();
    if (playerText !== "") {
      const [namePart, posPart] = playerText.split(" - ");
      const playerName = (namePart || "").trim();
      const position   = (slot.getAttribute("data-position") || posPart || "POZİSYON YOK").trim();
      const teamId     = slot.getAttribute("data-team") || null;
      const playerId   = slot.getAttribute("data-player-id") || null;

      lineup.push({ username, slot_no: i, player_name: playerName, player_id: playerId, position, team_id: teamId });
    }
  }

  authedFetch(`${API}?action=save_lineup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lineup)
  })
    .then(res => res.json())
    .then(response => {
      if (!response.success) console.warn("Kadro kaydedilemedi:", response.error);
    })
    .catch(err => console.error("Kadro otomatik kaydedilirken hata:", err));
}

function applySlotBordersForAllSlots(username, allPlayers) {
  const user = allPlayers.find(p => p.name === username);
  const borderColor = user?.color || "#ffffff";
  for (let i = 1; i <= 11; i++) {
    const slot = document.getElementById(`slot${i}`);
    if (slot) {
      slot.style.border = `4px solid ${borderColor}`;
      slot.style.borderRadius = "8px";
    }
  }
}

function getAdjacentSlots(slotNo) {
  const username = new URLSearchParams(window.location.search).get("username");
  const formation = localStorage.getItem(`selectedFormation_${username}`) || "4231";
  const map = adjacentSlotsMap[formation];
  return map?.[slotNo] || [];
}

function syncSvgSize() {
  const container = document.getElementById("field-container");
  const svg = document.getElementById("chemistry-lines");
  if (!container || !svg) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (!w || !h) return;
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
}

function calculateChemistryLinks() {
  for (let i = 1; i <= 11; i++) {
    const slot = document.getElementById(`slot${i}`);
    slot?.classList.remove("chemistry-link");
  }

  const teamMap = {};
  for (let i = 1; i <= 11; i++) {
    const slot = document.getElementById(`slot${i}`);
    const team = slot?.getAttribute("data-team");
    if (team) teamMap[i] = team;
  }

  for (let i = 1; i <= 11; i++) {
    const thisTeam = teamMap[i];
    if (!thisTeam) continue;
    const neighbors = getAdjacentSlots(i);
    neighbors.forEach(n => {
      if (teamMap[n] && teamMap[n] === thisTeam) {
        document.getElementById(`slot${i}`)?.classList.add("chemistry-link");
        document.getElementById(`slot${n}`)?.classList.add("chemistry-link");
      }
    });
  }

  const bondedPairs = new Set();
  for (let i = 1; i <= 11; i++) {
    const thisTeam = teamMap[i];
    if (!thisTeam) continue;
    const neighbors = getAdjacentSlots(i);
    neighbors.forEach(n => {
      if (teamMap[n] && teamMap[n] === thisTeam) {
        bondedPairs.add([i, n].sort().join("-"));
      }
    });
  }

  const svg = document.getElementById("chemistry-lines");
  svg.innerHTML = '';
  bondedPairs.forEach(pair => {
    const [i, j] = pair.split("-").map(Number);
    const el1 = document.getElementById(`slot${i}`);
    const el2 = document.getElementById(`slot${j}`);
    if (!el1 || !el2) return;

    const rect1 = el1.getBoundingClientRect();
    const rect2 = el2.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();

    const x1 = rect1.left + rect1.width / 2 - svgRect.left;
    const y1 = rect1.top + rect1.height / 2 - svgRect.top;
    const x2 = rect2.left + rect2.width / 2 - svgRect.left;
    const y2 = rect2.top + rect2.height / 2 - svgRect.top;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    svg.appendChild(line);
  });

  const chemistryCount = bondedPairs.size;
  if (localStorage.getItem("fromPage") === "trade") {
    localStorage.setItem(`chemistry_after_${username}`, chemistryCount);
  } else {
    localStorage.setItem(`chemistry_after_${username}`, chemistryCount);
    localStorage.setItem(`chemistry_before_${username}`, chemistryCount);
  }
}

// Kullanıcı linkleri (değişmedi)
(function renderUserLinks() {
  const playersRaw = localStorage.getItem('players');
  if (!playersRaw) return;
  try {
    const players = JSON.parse(playersRaw);
    if (!Array.isArray(players) || players.length === 0) return;

    const container = document.getElementById('user-links');
    players.forEach(player => {
      const link = document.createElement('a');
      link.href = `user_players.html?username=${encodeURIComponent(player.name)}`;
      link.textContent = player.name;
      link.className = 'user-link';
      link.style.color = player.color || "#ffffff";
      if (player.name === username) link.classList.add('active-user');
      container.appendChild(link);
    });
  } catch (e) {
    console.error("Kullanıcı linkleri oluşturulamadı:", e);
  }
})();

const from = localStorage.getItem("fromPage");
const backBtn = document.getElementById("back-to-game-btn");
if (from === "trade") {
  backBtn.textContent = "← Takasa Dön";
  backBtn.addEventListener("click", () => { window.location.href = "trade.html"; });
} else {
  backBtn.textContent = "← Oyuna Dön";
  backBtn.addEventListener("click", () => { window.location.href = "index.html"; });
}

document.addEventListener("DOMContentLoaded", () => {
  const username = new URLSearchParams(window.location.search).get("username");
  const savedFormation = localStorage.getItem(`selectedFormation_${username}`) || "4231";
  const selectEl = document.getElementById("formation-select");
  if (selectEl) selectEl.value = savedFormation;
  changeFormation(savedFormation);

  for (let i = 1; i <= 11; i++) {
    const slot = document.getElementById(`slot${i}`);
    if (slot) slot.classList.add("player-slot");
  }

  updateSlotDraggables();

  const allPlayers = JSON.parse(localStorage.getItem("players") || "[]");
  applySlotBordersForAllSlots(username, allPlayers);

  // get_lineup tekrar (ilk başta da çağırdık ama DOMContentLoaded akışında kimya vs.)
  fetchJsonSafe(`${API}?action=get_lineup&username=${encodeURIComponent(username)}`)
    .then(lineup => {
      if (Array.isArray(lineup)) {
        lineup.forEach(player => {
          const slot = document.getElementById(`slot${player.slot_no}`);
          if (!slot) return;
          const position = player.position?.toUpperCase() || "POZİSYON YOK";
          slot.innerText = `${player.player_name} - ${position}`;
          slot.setAttribute("data-position", position);
          slot.setAttribute("data-team", player.team_id || "");
          slot.setAttribute("data-player-id", player.player_id || "");
          if (player.player_id) existingLineupIds.add(String(player.player_id));
        });
        updateSlotDraggables();
        syncSvgSize();
        requestAnimationFrame(() => {
          syncSvgSize();
          calculateChemistryLinks();
        });
      }
    })
    .catch(err => console.error("Kadro yüklenirken hata:", err));

  const fieldImg = document.getElementById("field-image");
  const initChemistry = () => {
    syncSvgSize();
    requestAnimationFrame(() => {
      syncSvgSize();
      calculateChemistryLinks();
    });
  };
  if (fieldImg && !fieldImg.complete) {
    fieldImg.addEventListener("load", initChemistry, { once: true });
  } else {
    initChemistry();
  }
  window.addEventListener("load", initChemistry, { once: true });
  window.addEventListener("resize", () => {
    syncSvgSize();
    calculateChemistryLinks();
  });
});

function changeFormation(formation) {
  const layout = formationLayouts[formation];
  if (!layout) return;
  for (let i = 1; i <= 11; i++) {
    const slot = document.getElementById(`slot${i}`);
    if (slot && layout[i]) {
      slot.style.top = layout[i].top + "px";
      slot.style.left = layout[i].left + "px";
    }
  }
  const username = new URLSearchParams(window.location.search).get("username");
  if (username) {
    localStorage.setItem(`selectedFormation_${username}`, formation);
  }
  calculateChemistryLinks();
}

const formationLayouts = {
  "4231": {
    1: { top: 550, left: 135 },
    2: { top: 470, left: 60 },
    3: { top: 470, left: 210 },
    4: { top: 410, left: 21 },
    5: { top: 410, left: 250 },
    6: { top: 310, left: 39 },
    7: { top: 310, left: 231 },
    8: { top: 230, left: 135 },
    9: { top: 140, left: 20 },
    10:{ top: 140, left: 250 },
    11:{ top: 50,  left: 135 }
  },
  "433": {
    1: { top: 550, left: 135 },
    2: { top: 470, left: 60 },
    3: { top: 470, left: 210 },
    4: { top: 410, left: 21 },
    5: { top: 410, left: 250 },
    6: { top: 330, left: 135 },
    7: { top: 270, left: 39 },
    8: { top: 270, left: 231 },
    9: { top: 140, left: 20 },
    10:{ top: 140, left: 250 },
    11:{ top: 50,  left: 135 }
  },
  "442": {
    1: { top: 550, left: 135 },
    2: { top: 470, left: 60 },
    3: { top: 470, left: 210 },
    4: { top: 410, left: 21 },
    5: { top: 410, left: 250 },
    6: { top: 290, left: 60 },
    7: { top: 290, left: 210 },
    8: { top: 210, left: 21 },
    9: { top: 210, left: 250 },
    10:{ top: 75, left: 60 },
    11:{ top: 75, left: 210 }
  },
  "343": {
    1: { top: 550, left: 135 },
    2: { top: 470, left: 135 },
    3: { top: 420, left: 50 },
    4: { top: 420, left: 220 },
    5: { top: 330, left: 60 },
    6: { top: 330, left: 210 },
    7: { top: 250, left: 21 },
    8: { top: 250, left: 240 },
    9: { top: 140, left: 20 },
    10:{ top: 140, left: 250 },
    11:{ top: 50,  left: 135 }
  },
  "532": {
    1: { top: 550, left: 135 },
    2: { top: 470, left: 135 },
    3: { top: 420, left: 50 },
    4: { top: 420, left: 220 },
    5: { top: 370, left: 20 },
    6: { top: 370, left: 250 },
    7: { top: 270, left: 40 },
    8: { top: 270, left: 230 },
    9: { top: 190, left: 135 },
    10:{ top: 75, left: 60 },
    11:{ top: 75, left: 210 }
  },
  "352": {
    1: { top: 550, left: 135 },
    2: { top: 470, left: 135 },
    3: { top: 420, left: 50 },
    4: { top: 420, left: 220 },
    5: { top: 330, left: 60 },
    6: { top: 330, left: 210 },
    7: { top: 250, left: 21 },
    8: { top: 250, left: 240 },
    9: { top: 170, left: 135 },
    10:{ top: 75, left: 60 },
    11:{ top: 75, left: 210 }
  }
};

const adjacentSlotsMap = {
  "4231": {
    1: [2, 3, 4, 5],
    2: [1, 3, 4],
    3: [1, 2, 5],
    4: [2, 6, 9],
    5: [3, 7, 10],
    6: [4, 7, 8],
    7: [5, 6, 8],
    8: [6, 7, 9, 10, 11],
    9: [4, 8, 10, 11],
    10: [5, 8, 9, 11],
    11: [8, 9, 10]
  },
  "433": {
    1: [2, 3, 4, 5],
    2: [1, 3, 4],
    3: [1, 2, 5],
    4: [2, 6, 7, 9],
    5: [3, 6, 8, 10],
    6: [4, 5, 7, 8],
    7: [4, 6, 8, 9],
    8: [5, 6, 7, 10],
    9: [7, 10, 11],
    10: [8, 9, 11],
    11: [9, 10]
  },
  "442": {
    1: [2, 3, 4, 5],
    2: [1, 3, 4],
    3: [1, 2, 5],
    4: [2, 6, 7, 8],
    5: [3, 6, 7, 9],
    6: [4, 5, 7, 8],
    7: [4, 5, 6, 9],
    8: [4, 6, 10],
    9: [5, 7, 11],
    10: [8, 11],
    11: [9, 10]
  },
  "343": {
    1: [2, 3, 4],
    2: [1, 3, 4],
    3: [1, 2, 4, 5, 6],
    4: [1, 2, 3, 5, 6],
    5: [3, 4, 6, 7],
    6: [3, 4, 5, 8],
    7: [5, 9],
    8: [6, 10],
    9: [7, 10, 11],
    10: [8, 9, 11],
    11: [9, 10]
  },
  "352": {
    1: [2, 3, 4],
    2: [1, 3, 4],
    3: [1, 2, 4, 5, 6, 7],
    4: [1, 2, 3, 5, 6, 8],
    5: [3, 4, 6, 7, 9],
    6: [3, 4, 5, 8, 9],
    7: [3, 5, 6, 9],
    8: [4, 5, 6, 9],
    9: [5, 6, 7, 8 ,10, 11],
    10: [9, 11],
    11: [9, 10]
  },
  "532": {
    1: [2, 3, 4, 5, 6],
    2: [1, 3, 4],
    3: [1, 2, 4, 5],
    4: [1, 2, 3, 6],
    5: [3, 7],
    6: [4, 8],
    7: [5, 8, 9],
    8: [6, 7, 9],
    9: [7, 8, 10, 11],
    10: [9, 11],
    11: [9, 10]
  }
};


