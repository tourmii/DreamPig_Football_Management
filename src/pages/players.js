import { api } from '../api.js';
import { openModal, closeModal, showToast, posBadge, starsDisplay } from '../main.js';

export async function renderPlayers(container) {
    container.innerHTML = '<div class="text-center text-muted mt-lg">Loading players...</div>';

    try {
        const players = await api.getPlayers();
        render(container, players);
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><p class="text-danger">Error: ${err.message}</p></div>`;
    }
}

function render(container, players) {
    container.innerHTML = `
    <div class="section-header">
      <h2 class="section-title">👥 Players</h2>
      <div class="flex gap-md">
        <input type="text" class="form-input" id="player-search" placeholder="Search players..." style="max-width:220px" />
        <button class="btn btn-primary" id="add-player-btn">+ Add Player</button>
      </div>
    </div>

    <div class="players-grid" id="players-grid">
      ${players.length > 0
            ? players.map((p) => playerCard(p)).join('')
            : `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon">👥</div>
          <p>No players yet. Add your first player!</p>
        </div>
      `
        }
    </div>
  `;

    // Search
    document.getElementById('player-search').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = players.filter(
            (p) => p.name.toLowerCase().includes(q) || p.position.toLowerCase().includes(q)
        );
        document.getElementById('players-grid').innerHTML =
            filtered.length > 0
                ? filtered.map((p) => playerCard(p)).join('')
                : '<div class="empty-state" style="grid-column:1/-1"><p>No matches found</p></div>';
        attachCardHandlers(container);
    });

    // Add player
    document.getElementById('add-player-btn').addEventListener('click', () => showPlayerForm(container));

    attachCardHandlers(container);
}

function attachCardHandlers(container) {
    document.querySelectorAll('.player-card').forEach((card) => {
        card.addEventListener('click', async (e) => {
            if (e.target.closest('.btn')) return;
            const id = card.dataset.id;
            await showPlayerDetail(container, id);
        });
    });

    document.querySelectorAll('.edit-player-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showPlayerForm(container, JSON.parse(btn.dataset.player));
        });
    });

    document.querySelectorAll('.delete-player-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('Delete this player?')) {
                try {
                    await api.deletePlayer(btn.dataset.id);
                    showToast('Player deleted');
                    renderPlayers(container);
                } catch (err) {
                    showToast(err.message, 'error');
                }
            }
        });
    });
}

function playerCard(p) {
    const posClass = { Goalkeeper: 'gk', Defender: 'def', Midfielder: 'mid', Forward: 'fwd' };
    const initials = p.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return `
    <div class="player-card" data-id="${p.id}">
      <div class="player-card-header">
        <div class="flex items-center gap-md">
          <div class="player-avatar ${posClass[p.position] || 'mid'}">${initials}</div>
          <div class="player-info">
            <h3>${p.name}</h3>
            <span class="player-pos-label">${p.position}</span>
          </div>
        </div>
        <div class="flex gap-md">
          <button class="btn btn-ghost btn-icon edit-player-btn" data-player='${JSON.stringify(p)}' title="Edit">✏️</button>
          <button class="btn btn-ghost btn-icon delete-player-btn" data-id="${p.id}" title="Delete">🗑️</button>
        </div>
      </div>
      <div style="color:var(--warning);font-size:0.9rem;margin-bottom:var(--space-sm)">${starsDisplay(p.rating)}</div>
      <div class="player-stats-mini">
        <div class="stat-item">
          <div class="stat-value">${p.avg_score > 0 ? p.avg_score.toFixed(1) : '—'}</div>
          <div class="stat-label">Avg Score</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${p.matches_played}</div>
          <div class="stat-label">Matches</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${posBadge(p.position)}</div>
          <div class="stat-label">Position</div>
        </div>
      </div>
    </div>
  `;
}

function showPlayerForm(container, player = null) {
    const isEdit = !!player;
    const title = isEdit ? `Edit ${player.name}` : 'Add New Player';

    openModal(
        title,
        `
    <form id="player-form">
      <div class="form-group">
        <label class="form-label">Name</label>
        <input class="form-input" name="name" value="${player?.name || ''}" required placeholder="Player name" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Position</label>
          <select class="form-select" name="position">
            ${['Goalkeeper', 'Defender', 'Midfielder', 'Forward']
            .map((p) => `<option value="${p}" ${player?.position === p ? 'selected' : ''}>${p}</option>`)
            .join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Overall Rating</label>
          <select class="form-select" name="rating">
            ${[1, 2, 3, 4, 5]
            .map((r) => `<option value="${r}" ${(player?.rating || 3) === r ? 'selected' : ''}>${r} ★</option>`)
            .join('')}
          </select>
        </div>
      </div>
      <h4 style="color:var(--text-secondary);font-size:0.85rem;margin:var(--space-md) 0 var(--space-sm);text-transform:uppercase;letter-spacing:0.5px">Detailed Attributes</h4>
      ${['passing', 'shooting', 'defending', 'dribbling', 'stamina']
            .map(
                (attr) => `
        <div class="slider-group">
          <span class="slider-label">${attr.charAt(0).toUpperCase() + attr.slice(1)}</span>
          <input type="range" class="slider-input" name="${attr}" min="1" max="5" value="${player?.[attr] || 3}" 
                 oninput="this.nextElementSibling.textContent=this.value" />
          <span class="slider-value">${player?.[attr] || 3}</span>
        </div>
      `
            )
            .join('')}
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.remove('active')">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Player'}</button>
      </div>
    </form>
  `
    );

    document.getElementById('player-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            name: formData.get('name'),
            position: formData.get('position'),
            rating: +formData.get('rating'),
            passing: +formData.get('passing'),
            shooting: +formData.get('shooting'),
            defending: +formData.get('defending'),
            dribbling: +formData.get('dribbling'),
            stamina: +formData.get('stamina'),
        };

        try {
            if (isEdit) {
                await api.updatePlayer(player.id, data);
                showToast('Player updated!');
            } else {
                await api.createPlayer(data);
                showToast('Player added!');
            }
            closeModal();
            renderPlayers(container);
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

async function showPlayerDetail(container, id) {
    try {
        const player = await api.getPlayer(id);
        const posClass = { Goalkeeper: 'gk', Defender: 'def', Midfielder: 'mid', Forward: 'fwd' };
        const initials = player.name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

        openModal(
            player.name,
            `
      <div class="text-center mb-lg">
        <div class="player-avatar ${posClass[player.position] || 'mid'}" style="width:72px;height:72px;font-size:1.8rem;margin:0 auto var(--space-md)">${initials}</div>
        <div>${posBadge(player.position)}</div>
        <div style="color:var(--warning);font-size:1.1rem;margin-top:var(--space-sm)">${starsDisplay(player.rating)}</div>
      </div>

      <h4 style="color:var(--text-secondary);font-size:0.8rem;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:var(--space-md)">Skill Attributes</h4>
      ${['passing', 'shooting', 'defending', 'dribbling', 'stamina']
                .map(
                    (attr) => `
        <div class="skill-bar-wrap">
          <div class="skill-bar-label">
            <span>${attr.charAt(0).toUpperCase() + attr.slice(1)}</span>
            <span>${player[attr]}/5</span>
          </div>
          <div class="skill-bar">
            <div class="skill-bar-fill" style="width:${(player[attr] / 5) * 100}%"></div>
          </div>
        </div>
      `
                )
                .join('')}

      <div class="player-stats-mini mt-lg" style="margin-bottom:var(--space-lg)">
        <div class="stat-item">
          <div class="stat-value">${player.avg_score > 0 ? player.avg_score.toFixed(1) : '—'}</div>
          <div class="stat-label">Avg Score</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${player.matches_played}</div>
          <div class="stat-label">Matches</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${player.rating}</div>
          <div class="stat-label">Rating</div>
        </div>
      </div>

      ${player.history && player.history.length > 0
                ? `
        <h4 style="color:var(--text-secondary);font-size:0.8rem;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:var(--space-md)">Match History</h4>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Match</th><th>Date</th><th>Score</th></tr>
            </thead>
            <tbody>
              ${player.history
                    .map(
                        (h) => `
                <tr>
                  <td>${h.title}</td>
                  <td>${h.date}</td>
                  <td><strong style="color:var(--accent)">${h.overall_score.toFixed(1)}</strong></td>
                </tr>
              `
                    )
                    .join('')}
            </tbody>
          </table>
        </div>
      `
                : '<p class="text-muted text-center">No match history yet</p>'
            }
    `
        );
    } catch (err) {
        showToast(err.message, 'error');
    }
}
