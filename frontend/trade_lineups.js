document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("lineup-grid");
  const allPlayers = JSON.parse(localStorage.getItem("players") || "[]");

  if (!Array.isArray(allPlayers) || allPlayers.length === 0) {
    container.innerHTML = "<p style='color:white'>Kullanıcı verisi bulunamadı.</p>";
    return;
  }

  allPlayers.forEach(user => {
    fetch(`http://localhost:8000/football.php?action=get_lineup&username=${encodeURIComponent(user.name)}`)
      .then(res => res.json())
      .then(lineup => {
        const box = document.createElement("div");
        box.className = "lineup-box";

        const title = document.createElement("h2");
        title.textContent = user.name;
        box.appendChild(title);

        const fieldImg = document.createElement("img");
        fieldImg.src = "assets/field.png";
        fieldImg.alt = "Saha";
        fieldImg.className = "field-img";
        box.appendChild(fieldImg);

        if (Array.isArray(lineup)) {
          lineup.forEach(player => {
            const slot = document.createElement("div");
            slot.className = `static-slot slot${player.slot_no}`;
            const position = player.position?.toUpperCase() || "POZİSYON YOK";
            slot.textContent = `${player.player_name} - ${position}`;
            slot.style.border = `3px solid ${user.color || "#ffffff"}`; // 🎨 kullanıcı rengiyle border
            box.appendChild(slot);
          });
        }

        container.appendChild(box);
      })
      .catch(err => {
        console.error("Kadro alınamadı:", err);
      });
  });
});
