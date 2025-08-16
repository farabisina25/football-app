const API = "http://localhost:8000/football.php";

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

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("lineup-grid");
  const allPlayers = JSON.parse(localStorage.getItem("players") || "[]");

  if (!Array.isArray(allPlayers) || allPlayers.length === 0) {
    container.innerHTML = "<p style='color:white'>Kullanıcı verisi bulunamadı.</p>";
    return;
  }

  allPlayers.forEach(user => {
    const username = user.name;
    const formation = localStorage.getItem(`selectedFormation_${username}`) || "4231";
    const layout = formationLayouts[formation];
    const adjacentMap = adjacentSlotsMap[formation];

    authedFetch(`${API}?action=get_lineup&username=${encodeURIComponent(username)}`)
      .then(res => res.json())
      .then(lineup => {
        const box = document.createElement("div");
        box.className = "lineup-box";

        const nameHeader = document.createElement("div");
        nameHeader.className = "lineup-username";
        nameHeader.textContent = username;
        box.appendChild(nameHeader);

        const fieldImg = document.createElement("img");
        fieldImg.src = "assets/field.png";
        fieldImg.alt = "Saha";
        fieldImg.className = "field-img";
        box.appendChild(fieldImg);

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.style.position = "absolute";
        svg.style.top = 0;
        svg.style.left = 0;
        svg.style.pointerEvents = "none";
        box.appendChild(svg);

        const slotElements = {};

        if (Array.isArray(lineup)) {
          const teamMap = {};

          lineup.forEach(player => {
            const slotNo = player.slot_no;
            const position = player.position?.toUpperCase() || "POZİSYON YOK";

            const slot = document.createElement("div");
            slot.className = "static-slot";
            slot.textContent = `${player.player_name} - ${position}`;
            slot.style.border = `3px solid ${user.color || "#ffffff"}`;

            const coords = layout[slotNo];
            if (coords) {
              slot.style.top = coords.top + "px";
              slot.style.left = coords.left + "px";
              slot.style.position = "absolute";
            }

            box.appendChild(slot);
            slotElements[slotNo] = slot;

            // kimya çizgileri için takım id’si
            teamMap[slotNo] = player.team_id;
          });

          drawChemistryLines(svg, box, slotElements, teamMap, adjacentMap);
        }

        container.appendChild(box);
      })
      .catch(err => {
        console.error("Kadro alınamadı:", err);
      });
  });
});

function drawChemistryLines(svg, box, slotElements, teamMap, adjacentMap) {
  setTimeout(() => {
    const drawn = new Set();

    Object.keys(teamMap).forEach(i => {
      const team = teamMap[i];
      const neighbors = adjacentMap?.[i] || [];
      neighbors.forEach(j => {
        if (teamMap[j] && teamMap[j] === team) {
          const key = [Math.min(i, j), Math.max(i, j)].join("-");
          if (drawn.has(key)) return;
          drawn.add(key);

          const el1 = slotElements[i];
          const el2 = slotElements[j];
          if (!el1 || !el2) return;

          const rect1 = el1.getBoundingClientRect();
          const rect2 = el2.getBoundingClientRect();
          const parentRect = box.getBoundingClientRect();

          const x1 = rect1.left + rect1.width / 2 - parentRect.left;
          const y1 = rect1.top + rect1.height / 2 - parentRect.top;
          const x2 = rect2.left + rect2.width / 2 - parentRect.left;
          const y2 = rect2.top + rect2.height / 2 - parentRect.top;

          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", x1);
          line.setAttribute("y1", y1);
          line.setAttribute("x2", x2);
          line.setAttribute("y2", y2);
          line.setAttribute("stroke", "#00ffff");
          line.setAttribute("stroke-width", "6");
          line.setAttribute("opacity", "0.9");
          line.setAttribute("stroke-linecap", "round");
          line.style.filter = "drop-shadow(0 0 8px #00ffff)";
          svg.appendChild(line);
        }
      });
    });
  }, 100);
}


const formationLayouts = {
  "4231": {
    1: { top: 570, left: 135 },
    2: { top: 490, left: 60 },
    3: { top: 490, left: 210 },
    4: { top: 430, left: 21 },
    5: { top: 430, left: 250 },
    6: { top: 330, left: 39 },
    7: { top: 330, left: 231 },
    8: { top: 250, left: 135 },
    9: { top: 160, left: 20 },
    10:{ top: 160, left: 250 },
    11:{ top: 70,  left: 135 }
  },
  "433": {
    1: { top: 570, left: 135 },
    2: { top: 490, left: 60 },
    3: { top: 490, left: 210 },
    4: { top: 430, left: 21 },
    5: { top: 430, left: 250 },
    6: { top: 350, left: 135 },
    7: { top: 290, left: 39 },
    8: { top: 290, left: 231 },
    9: { top: 160, left: 20 },
    10:{ top: 160, left: 250 },
    11:{ top: 70,  left: 135 }
  },
  "442": {
    1: { top: 570, left: 135 },
    2: { top: 490, left: 60 },
    3: { top: 490, left: 210 },
    4: { top: 430, left: 21 },
    5: { top: 430, left: 250 },
    6: { top: 310, left: 60 },
    7: { top: 310, left: 210 },
    8: { top: 230, left: 21 },
    9: { top: 230, left: 250 },
    10:{ top: 95, left: 60 },
    11:{ top: 95, left: 210 }
  },
  "343": {
    1: { top: 570, left: 135 },
    2: { top: 490, left: 135 },
    3: { top: 440, left: 50 },
    4: { top: 440, left: 220 },
    5: { top: 350, left: 60 },
    6: { top: 350, left: 210 },
    7: { top: 270, left: 21 },
    8: { top: 270, left: 240 },
    9: { top: 160, left: 20 },
    10:{ top: 160, left: 250 },
    11:{ top: 70,  left: 135 }
  },
  "532": {
    1: { top: 570, left: 135 },
    2: { top: 490, left: 135 },
    3: { top: 440, left: 50 },
    4: { top: 440, left: 220 },
    5: { top: 390, left: 20 },
    6: { top: 390, left: 250 },
    7: { top: 290, left: 40 },
    8: { top: 290, left: 230 },
    9: { top: 210, left: 135 },
    10:{ top: 95, left: 60 },
    11:{ top: 95, left: 210 }
  },
  "352": {
    1: { top: 570, left: 135 },
    2: { top: 490, left: 135 },
    3: { top: 440, left: 50 },
    4: { top: 440, left: 220 },
    5: { top: 350, left: 60 },
    6: { top: 350, left: 210 },
    7: { top: 270, left: 21 },
    8: { top: 270, left: 240 },
    9: { top: 190, left: 135 },
    10:{ top: 95, left: 60 },
    11:{ top: 95, left: 210 }
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
