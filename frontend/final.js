// ✅ TAKAS ÖNCESİ
const preTrade = JSON.parse(localStorage.getItem("preTradeLeaderboard") || "[]");
const preList = document.getElementById('pre-trade-leaderboard');

preTrade.forEach((entry, index) => {
    const li = document.createElement('li');
    li.className = "leaderboard-item";
    if (index === 0) li.classList.add("champion");

    li.innerHTML = `
        <span class="rank">${index === 0 ? '🏆' : '#' + (index + 1)}</span>
        <span class="username">${entry.username}</span>
        <span class="score">Güç: ${entry.power}</span>
    `;
    preList.appendChild(li);

    // İsteğe bağlı console log:
    console.log(`🟡 [ÖNCE] ${entry.username} oyuncuları:`);
    entry.players?.forEach(player => {
        console.log(`- ${player.player} (${player.position}) slot ${player.slot}: OVR ${player.original_ovr} × ${player.multiplier} = ${player.adjusted_ovr.toFixed(2)}`);
    });
});


// ✅ TAKAS SONRASI
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

            console.log(`🟢 [SONRA] ${entry.username} oyuncuları:`);
            entry.players?.forEach(player => {
                console.log(`- ${player.player} (${player.position}) slot ${player.slot}: OVR ${player.original_ovr} × ${player.multiplier} = ${player.adjusted_ovr.toFixed(2)}`);
            });
        });
    });

