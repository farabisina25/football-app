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
          slot.innerText = player.player_name;
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

    data.sort((a, b) => a.player_no - b.player_no);

    data.forEach((player, index) => {
      const fullName = `${player.player_name}`;
      if (existingLineupNames.includes(fullName)) return; // kadroda varsa listeye ekleme

      const div = document.createElement('div');
      div.className = 'player-item';
      div.innerText = fullName;
      div.id = `player-${index + 1}`;
      div.draggable = true;
      div.ondragstart = drag;
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
    targetSlot.innerText = draggedText;

    if (draggedElement.classList.contains("player-item")) {
      draggedElement.remove();
    } else if (draggedElement.classList.contains("player-slot")) {
      draggedElement.innerText = '';
    }

    targetSlot.classList.add('fade-in');
    setTimeout(() => targetSlot.classList.remove('fade-in'), 300);

  } else {
    if (draggedElement.classList.contains("player-slot")) {
      draggedElement.innerText = targetText;
      targetSlot.innerText = draggedText;

      draggedElement.classList.add('fade-in');
      targetSlot.classList.add('fade-in');
      setTimeout(() => {
        draggedElement.classList.remove('fade-in');
        targetSlot.classList.remove('fade-in');
      }, 300);

    } else if (draggedElement.classList.contains("player-item")) {
      const newListItem = document.createElement("div");
      newListItem.className = 'player-item fade-in';
      newListItem.innerText = targetText;
      newListItem.id = `player-${Date.now()}`;
      newListItem.draggable = true;
      newListItem.ondragstart = drag;

      document.getElementById("player-list").appendChild(newListItem);

      targetSlot.innerText = draggedText;

      draggedElement.remove();

      targetSlot.classList.add('fade-in');
      setTimeout(() => targetSlot.classList.remove('fade-in'), 300);
    }
  }

  updateSlotDraggables();
  autoSaveLineup();
}




function dropToList(ev) {
  ev.preventDefault();
  const data = ev.dataTransfer.getData("text");
  const draggedElement = document.getElementById(data);
  if (!draggedElement) return;

  const playerName = draggedElement.innerText;

  const newPlayer = document.createElement("div");
  newPlayer.className = 'player-item';
  newPlayer.innerText = playerName;
  newPlayer.id = `player-${Date.now()}`;
  newPlayer.draggable = true;
  newPlayer.ondragstart = drag;

  document.getElementById("player-list").appendChild(newPlayer);

  if (draggedElement.classList.contains("player-slot")) {
    draggedElement.innerText = '';
  } else {
    draggedElement.remove();
  }

  autoSaveLineup();
  updateSlotDraggables();
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
      lineup.push({
        username: username,
        slot_no: i,
        player_name: playerText
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

document.getElementById("back-to-game-btn").addEventListener("click", () => {
  window.location.href = "index.html";
});

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
      if (!Array.isArray(lineup) || lineup.length === 0) return;

      lineup.forEach(player => {
        const slot = document.getElementById(`slot${player.slot_no}`);
        if (slot) {
          slot.innerText = player.player_name;
        }
      });

      updateSlotDraggables();
    })
    .catch(err => {
      console.error("Kadro yüklenirken hata:", err);
    });
});



