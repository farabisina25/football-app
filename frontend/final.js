fetch("http://localhost:8000/football.php?action=get_leaderboard")
    .then(res => res.json())
    .then(data => {
        const list = document.getElementById('leaderboard-list');
        data.forEach((entry, index) => {
          const li = document.createElement('li');
          li.className = "leaderboard-item";
          if (index === 0) li.classList.add("champion");

          li.innerHTML = `
            <span class="rank">${index === 0 ? '🏆' : '#' + (index + 1)}</span>
            <span class="username">${entry.username}</span>
            <span class="score">Güç: ${entry.power}</span>
          `;
          list.appendChild(li);
        });
    });