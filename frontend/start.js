    const container = document.getElementById('players-container');
    const startBtn = document.getElementById('start-game');

    let maxPlayers = 4;
    let players = JSON.parse(localStorage.getItem('players')) || new Array(maxPlayers).fill(null);


    function renderPlayers() {
      container.innerHTML = '';

      // İlk boş indeks bulunur
      const firstEmptyIndex = players.findIndex(p => p === null);

      for (let i = 0; i < maxPlayers; i++) {
        const card = document.createElement('div');
        card.className = 'player-card';

        // ➤ HENÜZ EKLENMEMİŞ SLOT
        if (!players[i]) {
          if (i === firstEmptyIndex) {
            const addBtn = document.createElement('button');
            addBtn.textContent = 'Add';
            addBtn.className = 'add-button';

            addBtn.onclick = () => showPlayerInputForm(i, card);
            card.appendChild(addBtn);
          }
        }

        // ➤ ZATEN EKLENMİŞ SLOT
        else {
          const nameEl = document.createElement('div');
          nameEl.className = 'username-label';
          nameEl.textContent = players[i].name;
          nameEl.style.color = players[i].color || '#e0ffcc';
          card.appendChild(nameEl);

          const editBtn = document.createElement('button');
          editBtn.textContent = 'Düzenle';
          editBtn.className = 'add-button';
          editBtn.onclick = () => showPlayerInputForm(i, card, true);
          card.appendChild(editBtn);
        }

        container.appendChild(card);
      }
    }

    function showPlayerInputForm(index, card, isEdit = false) {
      card.innerHTML = '';

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Kullanıcı adı';
      input.value = isEdit && players[index] ? players[index].name : '';

      const colorWrapper = document.createElement('div');
      colorWrapper.className = 'color-picker-wrapper';

      const colorLabel = document.createElement('div');
      colorLabel.textContent = 'Renk Seçin';
      colorLabel.className = 'color-label';

      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'color-input';
      colorInput.value = isEdit && players[index] ? players[index].color : '#ff0000';

      colorWrapper.appendChild(colorLabel);
      colorWrapper.appendChild(colorInput);


      const saveBtn = document.createElement('button');
      saveBtn.textContent = isEdit ? 'Güncelle' : 'Kaydet';
      saveBtn.className = 'add-button';

      saveBtn.onclick = () => {
        const username = input.value.trim();
        const color = colorInput.value;

        const nameConflict = players.some((p, idx) =>
          idx !== index && p?.name === username
        );

        if (!username || nameConflict) {
          alert("Geçersiz veya tekrar eden kullanıcı adı.");
          return;
        }

        players[index] = { name: username, color: color };
        localStorage.setItem('players', JSON.stringify(players));
        renderPlayers();
      };

      card.appendChild(input);
      card.appendChild(colorWrapper);
      card.appendChild(saveBtn);
      input.focus();
    }

    // Yardım Modal kontrolü
    (function setupHelpModal() {
      const helpBtn   = document.getElementById('help-btn');
      const modal     = document.getElementById('help-modal');
      const closeBtn  = document.getElementById('help-close');
      const body      = document.querySelector('body');

      if (!helpBtn || !modal || !closeBtn) return;

      const openModal = () => {
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        body.style.overflow = 'hidden';       // arka plan kaymasın
        // odak
        const focusable = modal.querySelector('.modal-body');
        focusable && focusable.focus();
      };

      const closeModal = () => {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        body.style.overflow = '';             // eski haline
        helpBtn.focus();
      };

      helpBtn.addEventListener('click', openModal);
      closeBtn.addEventListener('click', closeModal);

      // Arka plana tıklayınca kapat
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });

      // ESC ile kapat
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('show')) {
          closeModal();
        }
      });
    })();

    startBtn.onclick = async () => {
      startBtn.disabled = true; // Çoklu tıklamayı engelle

      try {
        // 1) Oyuncu sayısı kontrolü
        const validPlayers = players.filter(Boolean);
        if (validPlayers.length < 2) {
          alert("En az iki kullanıcı adı girilmelidir.");
          startBtn.disabled = false;
          return;
        }

        // 2) teams tablosu boş mu kontrol et
        const teamsRes = await fetch("http://localhost:8000/football.php?action=get_teams");
        const teams = await teamsRes.json();

        if (!Array.isArray(teams) || teams.length === 0) {
          alert("Takımlar listesi boş: önce çarkı oluşturmanız gerekiyor (Takımları ekleyin).");
          startBtn.disabled = false;
          return;
        }

        // 3) LocalStorage’a oyuncuları yaz
        localStorage.clear();
        localStorage.setItem('players', JSON.stringify(validPlayers));

        // 4) reset_game çağır
        const resetRes = await fetch("http://localhost:8000/football.php?action=reset_game");
        const resetData = await resetRes.json();

        if (!resetData.success) {
          alert("Veritabanı sıfırlanamadı: " + (resetData.error || "Bilinmeyen hata"));
          startBtn.disabled = false;
          return;
        }

        // 5) Oyuna geç
        window.location.href = 'index.html';

      } catch (err) {
        console.error(err);
        alert("Sunucu hatası: " + (err?.message || err));
        startBtn.disabled = false;
      }
    };

    renderPlayers();