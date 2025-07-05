    const container = document.getElementById('players-container');
    const startBtn = document.getElementById('start-game');

    let maxPlayers = 4;
    let players = new Array(maxPlayers).fill(null); // Şimdilik boş


    function renderPlayers() {
      container.innerHTML = '';

      for (let i = 0; i < maxPlayers; i++) {
        const card = document.createElement('div');
        card.className = 'player-card';

        if (!players[i]) {
          const addBtn = document.createElement('button');
          addBtn.textContent = 'Add';
          addBtn.className = 'add-button';

          addBtn.onclick = () => {
            card.innerHTML = '';

            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Kullanıcı adı';

            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Kaydet';
            saveBtn.className = 'add-button';

            saveBtn.onclick = () => {
              const username = input.value.trim();
              if (username && !players.some(p => p?.name === username)) {
                // Ad kaydedildi, şimdi renk seçtir
                card.innerHTML = '';

                const colorLabel = document.createElement('div');
                colorLabel.textContent = 'Renk seçin:';
                colorLabel.style.marginBottom = '10px';

                const colorInput = document.createElement('input');
                colorInput.type = 'color';
                colorInput.value = '#ff0000';
                colorInput.style.width = '60px';
                colorInput.style.height = '40px';

                const finalSaveBtn = document.createElement('button');
                finalSaveBtn.textContent = 'Tamamla';
                finalSaveBtn.className = 'add-button';

                finalSaveBtn.onclick = () => {
                  const color = colorInput.value;
                  players[i] = { name: username, color: color };
                  renderPlayers();
                };

                card.appendChild(colorLabel);
                card.appendChild(colorInput);
                card.appendChild(finalSaveBtn);
              } else {
                alert("Geçersiz veya tekrar eden kullanıcı adı.");
              }
            };

            card.appendChild(input);
            card.appendChild(saveBtn);
            input.focus();
          };

          card.appendChild(addBtn);
        } else {
          const nameEl = document.createElement('div');
          nameEl.className = 'username-label';
          nameEl.textContent = players[i].name;
          nameEl.style.color = players[i].color || '#e0ffcc'; // renk göster
          card.appendChild(nameEl);
        }

        container.appendChild(card);
      }
    }

    startBtn.onclick = () => {
      const validPlayers = players.filter(Boolean);
      if (validPlayers.length === 0) {
        alert("En az bir kullanıcı adı girilmelidir.");
        return;
      }
      localStorage.setItem('players', JSON.stringify(validPlayers));


      // Önce tabloları temizle
      fetch("http://localhost:8000/football.php?action=reset_game")
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            // Tablolar temizlendiyse oyunu başlat
            localStorage.setItem('players', JSON.stringify(validPlayers));
            window.location.href = 'index.html';
          } else {
            alert("Veritabanı sıfırlanamadı: " + (data.error || "Bilinmeyen hata"));
          }
        })
        .catch(err => {
          alert("Sunucu hatası: " + err.message);
        });
    };


    renderPlayers();