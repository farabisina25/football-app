const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('username');
const positionOrder = ['ST', 'LW', 'RW', 'LM', 'RM', 'CAM', 'CM', 'CDM', 'LB', 'CB', 'RB', 'GK'];
document.getElementById('user-title').innerText = `${username} - Seçtiği Oyuncular`;

// Kadroda yer alan oyuncuların isimlerini burada tutacağız
let existingLineupNames = [];

fetchJsonSafe(`http://localhost:8000/football.php?action=get_lineup&username=${encodeURIComponent(username)}`)
  .then(lineup => {
    if (Array.isArray(lineup)) {
      existingLineupNames = lineup.map(p => p.player_name.trim());
      lineup.forEach(player => {
        const slot = document.getElementById(`slot${player.slot_no}`);
        if (slot) {
          const position = player.position?.toUpperCase() || "POZİSYON YOK";
          slot.innerText = `${player.player_name} - ${position}`;
          slot.setAttribute("data-position", position);
        }
      });
    }
  })
  .then(() => fetchJsonSafe(`http://localhost:8000/football.php?action=user_players&username=${encodeURIComponent(username)}`))
  .then(data => {
    const list = document.getElementById('player-list');
    if (!Array.isArray(data) || data.length === 0) {
      list.innerHTML = '<p>Bu kullanıcı henüz oyuncu seçmemiş.</p>';
      return;
    }
    const positionOrder = ['ST','LW','RW','LM','RM','CAM','CM','CDM','LB','CB','RB','GK'];
    data.sort((a,b) => {
      const posA = (a.position||'').toUpperCase();
      const posB = (b.position||'').toUpperCase();
      const indexA = positionOrder.indexOf(posA);
      const indexB = positionOrder.indexOf(posB);
      return (indexA===-1?999:indexA) - (indexB===-1?999:indexB);
    });
    data.forEach((player, index) => {
      const rawName = player.player_name?.trim();
      const position = player.position?.toUpperCase() || "POZİSYON YOK";
      if (existingLineupNames.includes(rawName)) return;
      const div = document.createElement('div');
      div.className = 'player-item';
      div.id = `player-${index + 1}`;
      div.draggable = true;
      div.ondragstart = drag;
      div.innerText = `${rawName} - ${position}`;
      div.setAttribute("data-position", position);
      div.setAttribute("data-team", player.team_id || "");
      list.appendChild(div);
    });
  })
  .catch(err => {
    console.error(err);
    document.getElementById('player-list').innerHTML = '<p>Oyuncular yüklenemedi.</p>';
  });


async function fetchJsonSafe(url, options) {
  const res = await fetch(url, options);
  const txt = await res.text();
  try { return JSON.parse(txt); }
  catch (e) { console.error("JSON parse edilemedi. Ham cevap:", txt); throw e; }
}



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

  items.forEach(item => list.appendChild(item)); // sıraya göre tekrar ekle
}


function allowDrop(ev) {
  ev.preventDefault();
}

function drag(ev) {
  ev.dataTransfer.setData("text", ev.target.id);
}

function drop(ev) {
  ev.preventDefault();
  const data = ev.dataTransfer.getData("text");
  const draggedElement = document.getElementById(data);
  const targetSlot = ev.target;

  if (!targetSlot.classList.contains("player-slot")) return;

  const draggedText = draggedElement.innerText.trim();
  const targetText = targetSlot.innerText.trim();

  if (targetText === "") {
    const draggedName = draggedText.split(" - ")[0].trim();
    const draggedPosition = draggedText.split(" - ")[1]?.trim() || "POZİSYON YOK";
    targetSlot.innerText = `${draggedName} - ${draggedPosition}`;
    targetSlot.setAttribute("data-position", draggedPosition);
    targetSlot.setAttribute("data-team", draggedElement.getAttribute("data-team") || ""); 

    if (draggedElement.classList.contains("player-item")) {
      draggedElement.remove();
      const justName = draggedName;
      if (!existingLineupNames.includes(justName)) {
        existingLineupNames.push(justName);
      }
    } else if (draggedElement.classList.contains("player-slot")) {
      draggedElement.innerText = '';
      draggedElement.removeAttribute("data-position");
      draggedElement.removeAttribute("data-team");
    }

    targetSlot.classList.add('fade-in');
    setTimeout(() => targetSlot.classList.remove('fade-in'), 300);

  } else {
    if (draggedElement.classList.contains("player-slot")) {
      // 🛠️ Slot-to-slot: iki slotun içeriği ve pozisyon bilgisi takas ediliyor
      const draggedName = draggedText.split(" - ")[0].trim();
      const draggedPosition = draggedElement.getAttribute("data-position") || "POZİSYON YOK";
      const targetName = targetText.split(" - ")[0].trim();
      const targetPosition = targetSlot.getAttribute("data-position") || "POZİSYON YOK";

      draggedElement.innerText = `${targetName} - ${targetPosition}`;
      draggedElement.setAttribute("data-position", targetPosition);

      targetSlot.innerText = `${draggedName} - ${draggedPosition}`;
      targetSlot.setAttribute("data-position", draggedPosition);

      // ✅ BURAYA EKLE 👇
      const draggedTeam = draggedElement.getAttribute("data-team") || "";
      const targetTeam = targetSlot.getAttribute("data-team") || "";
      draggedElement.setAttribute("data-team", targetTeam);
      targetSlot.setAttribute("data-team", draggedTeam);

      draggedElement.classList.add('fade-in');
      targetSlot.classList.add('fade-in');
      setTimeout(() => {
        draggedElement.classList.remove('fade-in');
        targetSlot.classList.remove('fade-in');
      }, 300);
    }
    else if (draggedElement.classList.contains("player-item")) {
      const newListItem = document.createElement("div");
      newListItem.className = 'player-item fade-in';
      const targetName = targetText.split(" - ")[0].trim();
      const targetPosition = targetSlot.getAttribute("data-position") || targetText.split(" - ")[1]?.trim() || "POZİSYON YOK";
      newListItem.innerText = `${targetName} - ${targetPosition}`;
      newListItem.id = `player-${Date.now()}`;
      newListItem.draggable = true;
      newListItem.ondragstart = drag;
      newListItem.setAttribute("data-position", targetPosition);

      document.getElementById("player-list").appendChild(newListItem);
      sortPlayerList(); // ✅ listeye yeni oyuncu eklendiğinde yeniden sırala

      const draggedName = draggedText.split(" - ")[0].trim();
      const draggedPosition = draggedText.split(" - ")[1]?.trim() || "POZİSYON YOK";
      const draggedTeam = draggedElement.getAttribute("data-team") || ""; // 👈 EKLENDİ
      targetSlot.innerText = `${draggedName} - ${draggedPosition}`;
      targetSlot.setAttribute("data-position", draggedPosition);
      targetSlot.setAttribute("data-team", draggedTeam); // 👈 EKLENDİ

      draggedElement.remove();

      const justName = draggedName;
      if (!existingLineupNames.includes(justName)) {
        existingLineupNames.push(justName);
      }

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
  const playerName = playerText.split(" - ")[0].trim();
  const playerPosition = draggedElement.getAttribute("data-position") || playerText.split(" - ")[1]?.trim() || "POZİSYON YOK";
  const playerTeam = draggedElement.getAttribute("data-team") || "";

  // 🔧 Yeni player DOM öğesi oluşturuluyor
  const newPlayer = document.createElement('div');
  newPlayer.className = 'player-item fade-in'; // 🎯 Stil sınıfları eksiksiz
  newPlayer.innerText = `${playerName} - ${playerPosition}`;
  newPlayer.setAttribute("data-position", playerPosition);
  newPlayer.setAttribute("data-team", playerTeam);
  newPlayer.setAttribute("draggable", "true");
  newPlayer.ondragstart = drag;
  newPlayer.id = `player-${Date.now()}`; // benzersiz id

  document.getElementById("player-list").appendChild(newPlayer);
  sortPlayerList(); // 🔄 Liste güncellendiğinde otomatik sırala


  // 🔄 Slot'tan alındıysa slot'u temizle, listeden alındıysa sil
  if (draggedElement.classList.contains("player-slot")) {
    draggedElement.innerText = '';
    draggedElement.removeAttribute("data-position");
    draggedElement.removeAttribute("data-team");
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
        slot.draggable = true;
        slot.ondragstart = drag;
      } else {
        slot.draggable = false;
        slot.ondragstart = null;
      }
    }
  }
}

function autoSaveLineup() {
  const username = new URLSearchParams(window.location.search).get("username");
  const lineup = [];

  for (let i = 1; i <= 11; i++) {
    const slot = document.getElementById(`slot${i}`);
    const playerText = slot.innerText.trim();

    if (playerText !== "") {
      const playerName = playerText.split(" - ")[0].trim(); // ✅ sadece isim
      lineup.push({
        username: username,
        slot_no: i,
        player_name: playerName
      });
    }
  }

  fetch("http://localhost:8000/football.php?action=save_lineup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lineup)
  })
    .then(res => res.json())
    .then(response => {
      if (!response.success) {
        console.warn("Kadro kaydedilemedi:", response.error);
      }
    })
    .catch(err => {
      console.error("Kadro otomatik kaydedilirken hata:", err);
    });
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


function calculateChemistryLinks() {
  // Önce tüm kimya sınıflarını temizle
  for (let i = 1; i <= 11; i++) {
    const slot = document.getElementById(`slot${i}`);
    slot?.classList.remove("chemistry-link");
  }

  // Ardından yeniden hesapla
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
        const pair = [i, n].sort().join("-");
        bondedPairs.add(pair); // tekrar edenleri engellemek için
      }
    });
  }

  console.log("🔥 Kimya Bağları:", Array.from(bondedPairs));

  // 🔄 SVG ile çizgileri çiz
  const svg = document.getElementById("chemistry-lines");
  svg.innerHTML = ''; // önceki çizgileri sil

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
  const username = new URLSearchParams(window.location.search).get("username");
  const chemistryCount = bondedPairs.size; // eşsiz bağlantı sayısı
  if (localStorage.getItem("fromPage") === "trade") {
    localStorage.setItem(`chemistry_after_${username}`, chemistryCount);
  } else {
    localStorage.setItem(`chemistry_after_${username}`, chemistryCount);
    localStorage.setItem(`chemistry_before_${username}`, chemistryCount);
  }
}


// Sayfanın alt kısmına kullanıcı linkleri oluştur
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


      if (player.name === username) {
        link.classList.add('active-user');
      }

      container.appendChild(link);
    });


  } catch (e) {
    console.error("Kullanıcı linkleri oluşturulamadı:", e);
  }
})();

const from = localStorage.getItem("fromPage"); // artık buradan geliyor
const backBtn = document.getElementById("back-to-game-btn");

if (from === "trade") {
  backBtn.textContent = "← Takasa Dön";
  backBtn.addEventListener("click", () => {
    window.location.href = "trade.html";
  });
} else {
  backBtn.textContent = "← Oyuna Dön";
  backBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const username = new URLSearchParams(window.location.search).get("username");
  // ⬇️ Her kullanıcıya özel formasyon getir
  const savedFormation = localStorage.getItem(`selectedFormation_${username}`) || "4231";
  const selectEl = document.getElementById("formation-select");
  if (selectEl) {
    selectEl.value = savedFormation;
  }
  changeFormation(savedFormation);

  // Slot kutularına sınıf ekle
  for (let i = 1; i <= 11; i++) {
    const slot = document.getElementById(`slot${i}`);
    if (slot) {
      slot.classList.add("player-slot");
    }
  }

  updateSlotDraggables();

  // Renkli çerçeve uygulamasını HEMEN yap
  const allPlayers = JSON.parse(localStorage.getItem("players") || "[]");
  applySlotBordersForAllSlots(username, allPlayers);

 fetchJsonSafe(`http://localhost:8000/football.php?action=get_lineup&username=${encodeURIComponent(username)}`)
  .then(lineup => {
    if (Array.isArray(lineup)) {
      existingLineupNames = lineup.map(p => p.player_name.trim());
      lineup.forEach(player => {
        const slot = document.getElementById(`slot${player.slot_no}`);
        if (slot) {
          const position = player.position?.toUpperCase() || "POZİSYON YOK";
          slot.innerText = `${player.player_name} - ${position}`;
          slot.setAttribute("data-position", position);
          slot.setAttribute("data-team", player.team_id || "");
        }
      });
      updateSlotDraggables();
    }
  })
  .catch(err => {
    console.error("Kadro yüklenirken hata:", err);
  });


  setTimeout(() => {
    calculateChemistryLinks();
  }, 100);
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
  // ✅ Her kullanıcıya özel dizilişi kaydet
  const username = new URLSearchParams(window.location.search).get("username");
  if (username) {
    localStorage.setItem(`selectedFormation_${username}`, formation);
  }

  calculateChemistryLinks(); // Kimya yeniden hesaplanı
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


