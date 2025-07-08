const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('username');
document.getElementById('user-title').innerText = `${username} - Seçtiği Oyuncular`;

// Kadroda yer alan oyuncuların isimlerini burada tutacağız
let existingLineupNames = [];

// 1. Önce kadroyu alalım
fetch(`http://localhost:8000/football.php?action=get_lineup&username=${encodeURIComponent(username)}`)
  .then(response => response.json())
  .then(lineup => {
    if (Array.isArray(lineup)) {
      existingLineupNames = lineup.map(p => p.player_name.trim());
      lineup.forEach(player => {
        const slot = document.getElementById(`slot${player.slot_no}`);
        if (slot) {
          const position = player.position?.toUpperCase() || "POZİSYON YOK";
          slot.innerText = `${player.player_name} - ${position}`;
          slot.setAttribute("data-position", position); // sadece pozisyonu kaydet
        }
      });
    }
  })


  // 2. Ardından oyuncu listesini yükleyelim
.then(() => {
  return fetch(`http://localhost:8000/football.php?action=user_players&username=${encodeURIComponent(username)}`);
})
.then(response => response.json())
.then(data => {
  const list = document.getElementById('player-list');
  if (!Array.isArray(data) || data.length === 0) {
    list.innerHTML = '<p>Bu kullanıcı henüz oyuncu seçmemiş.</p>';
    return;
  }

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

    list.appendChild(div);
  });
}).catch(err => {
    console.error(err);
    document.getElementById('player-list').innerHTML = '<p>Oyuncular yüklenemedi.</p>';
  });

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

    if (draggedElement.classList.contains("player-item")) {
      draggedElement.remove();

      // 👇 Oyuncunun adını ayıkla ve existingLineupNames'e ekle
      const justName = draggedText.split(" - ")[0].trim();
      if (!existingLineupNames.includes(justName)) {
        existingLineupNames.push(justName);
      }

    } else if (draggedElement.classList.contains("player-slot")) {
      draggedElement.innerText = '';
    }

    targetSlot.classList.add('fade-in');
    setTimeout(() => targetSlot.classList.remove('fade-in'), 300);

  } else {
    if (draggedElement.classList.contains("player-slot")) {
      draggedElement.innerText = targetText;
      const draggedName = draggedText.split(" - ")[0].trim();
      const draggedPosition = draggedElement.getAttribute("data-position") || draggedText.split(" - ")[1]?.trim() || "POZİSYON YOK";
      targetSlot.innerText = `${draggedName} - ${draggedPosition}`;
      targetSlot.setAttribute("data-position", draggedPosition);

      draggedElement.classList.add('fade-in');
      targetSlot.classList.add('fade-in');
      setTimeout(() => {
        draggedElement.classList.remove('fade-in');
        targetSlot.classList.remove('fade-in');
      }, 300);

    } else if (draggedElement.classList.contains("player-item")) {
      // Yeni bir liste öğesi oluştur (mevcut slottaki oyuncuyu geri eklemek için)
      const newListItem = document.createElement("div");
      newListItem.className = 'player-item fade-in';
      const targetName = targetText.split(" - ")[0].trim();
      const targetPosition = targetSlot.getAttribute("data-position") || targetText.split(" - ")[1]?.trim() || "POZİSYON YOK";
      newListItem.innerText = `${targetName} - ${targetPosition}`;

      newListItem.id = `player-${Date.now()}`;
      newListItem.draggable = true;
      newListItem.ondragstart = drag;

      document.getElementById("player-list").appendChild(newListItem);

      const draggedName = draggedText.split(" - ")[0].trim();
      const draggedPosition = draggedText.split(" - ")[1]?.trim() || "POZİSYON YOK";
      targetSlot.innerText = `${draggedName} - ${draggedPosition}`;

      draggedElement.remove();

      // 👇 Yeni eklenen oyuncuyu da liste dışına alma
      const justName = draggedText.split(" - ")[0].trim();
      if (!existingLineupNames.includes(justName)) {
        existingLineupNames.push(justName);
      }

      targetSlot.classList.add('fade-in');
      setTimeout(() => targetSlot.classList.remove('fade-in'), 300);
    }
  }

  updateSlotDraggables();
  autoSaveLineup();
  setTimeout(updateSlotDraggables, 100); // DOM tamamlandıktan sonra çalışması için
}

function dropToList(ev) {
  ev.preventDefault();
  const data = ev.dataTransfer.getData("text");
  const draggedElement = document.getElementById(data);
  if (!draggedElement) return;

  const playerText = draggedElement.innerText.trim();
  const playerName = playerText.split(" - ")[0].trim();
  const playerPosition = draggedElement.getAttribute("data-position") || playerText.split(" - ")[1]?.trim() || "POZİSYON YOK";

  // 🔧 Yeni player DOM öğesi oluşturuluyor
  const newPlayer = document.createElement('div');
  newPlayer.className = 'player-item fade-in'; // 🎯 Stil sınıfları eksiksiz
  newPlayer.innerText = `${playerName} - ${playerPosition}`;
  newPlayer.setAttribute("data-position", playerPosition);
  newPlayer.setAttribute("draggable", "true");
  newPlayer.ondragstart = drag;
  newPlayer.id = `player-${Date.now()}`; // benzersiz id

  document.getElementById("player-list").appendChild(newPlayer);

  // 🔄 Slot'tan alındıysa slot'u temizle, listeden alındıysa sil
  if (draggedElement.classList.contains("player-slot")) {
    draggedElement.innerText = '';
  } else {
    draggedElement.remove();
  }

  setTimeout(updateSlotDraggables, 100);
  autoSaveLineup();
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

  // Ardından kadroyu yükle
  fetch(`http://localhost:8000/football.php?action=get_lineup&username=${encodeURIComponent(username)}`)
  .then(response => response.json())
  .then(lineup => {
    if (Array.isArray(lineup)) {
      existingLineupNames = lineup.map(p => p.player_name.trim());
      lineup.forEach(player => {
        const slot = document.getElementById(`slot${player.slot_no}`);
        if (slot) {
          const position = player.position?.toUpperCase() || "POZİSYON YOK";
          slot.innerText = `${player.player_name} - ${position}`;
          slot.setAttribute("data-position", position); // sadece pozisyonu kaydet
        }
      });
      updateSlotDraggables();
    }
  }).catch(err => {
      console.error("Kadro yüklenirken hata:", err);
    });
});



