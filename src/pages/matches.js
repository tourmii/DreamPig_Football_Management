import { api } from '../api.js';
import { openModal, closeModal, showToast, posBadge, statusBadge } from '../main.js';

// Mutable state for the current scenario being edited via drag & drop
let activeScenario = null;

export async function renderMatches(container) {
  container.innerHTML = '<div class="text-center text-muted mt-lg">Loading matches...</div>';

  try {
    const matches = await api.getMatches();
    renderList(container, matches);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p class="text-danger">Error: ${err.message}</p></div>`;
  }
}

function renderList(container, matches) {
  const upcoming = matches.filter((m) => m.status === 'upcoming');
  const completed = matches.filter((m) => m.status === 'completed');

  container.innerHTML = `
    <div class="section-header">
      <h2 class="section-title">🏟️ Matches</h2>
      <button class="btn btn-primary" id="create-match-btn">+ New Match</button>
    </div>

    ${upcoming.length > 0
      ? `
      <h3 style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:var(--space-md)">📅 Upcoming</h3>
      <div style="display:grid;gap:var(--space-md);margin-bottom:var(--space-xl)">
        ${upcoming.map((m) => matchCard(m)).join('')}
      </div>
    `
      : ''
    }

    ${completed.length > 0
      ? `
      <h3 style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:var(--space-md)">✅ Completed</h3>
      <div style="display:grid;gap:var(--space-md)">
        ${completed.map((m) => matchCard(m)).join('')}
      </div>
    `
      : ''
    }

    ${matches.length === 0
      ? `
      <div class="empty-state">
        <div class="empty-icon">🏟️</div>
        <p>No matches yet. Create your first match!</p>
      </div>
    `
      : ''
    }
  `;

  // Create match
  document.getElementById('create-match-btn').addEventListener('click', () => showMatchForm(container));

  // Match card clicks
  document.querySelectorAll('.match-card').forEach((card) => {
    card.addEventListener('click', () => showMatchDetail(container, card.dataset.id));
  });
}

function matchCard(m) {
  return `
    <div class="match-card" data-id="${m.id}">
      <div class="match-card-top">
        <div class="match-title">${m.title}</div>
        ${statusBadge(m.status)}
      </div>
      <div class="match-meta">
        <span>📅 ${m.date}</span>
        <span>⏰ ${m.time}</span>
        ${m.location ? `<span>📍 ${m.location}</span>` : ''}
        <span>👥 ${m.player_count || 0} players</span>
      </div>
    </div>
  `;
}

function showMatchForm(container, match = null) {
  const isEdit = !!match;

  openModal(
    isEdit ? 'Edit Match' : 'Create New Match',
    `
    <form id="match-form">
      <div class="form-group">
        <label class="form-label">Match Title</label>
        <input class="form-input" name="title" value="${match?.title || 'Friendly Match'}" placeholder="Friendly Match" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date</label>
          <input class="form-input" type="date" name="date" value="${match?.date || ''}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Time</label>
          <input class="form-input" type="time" name="time" value="${match?.time || '19:00'}" required />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Location / Field</label>
        <input class="form-input" name="location" value="${match?.location || ''}" placeholder="e.g. City Stadium, Field 3" />
      </div>
      <div class="form-group">
        <label class="form-label">Fee per Player</label>
        <input class="form-input" type="number" name="fee" value="${match?.fee || 0}" min="0" step="0.01" />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.remove('active')">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Create Match'}</button>
      </div>
    </form>
  `
  );

  document.getElementById('match-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      title: fd.get('title'),
      date: fd.get('date'),
      time: fd.get('time'),
      location: fd.get('location'),
      fee: +fd.get('fee'),
    };

    try {
      if (isEdit) {
        await api.updateMatch(match.id, data);
        showToast('Match updated!');
      } else {
        await api.createMatch(data);
        showToast('Match created!');
      }
      closeModal();
      renderMatches(container);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function showMatchDetail(container, matchId) {
  try {
    const [match, allPlayers] = await Promise.all([api.getMatch(matchId), api.getPlayers()]);

    const registeredIds = new Set(match.players.map((p) => p.player_id));
    const unregistered = allPlayers.filter((p) => !registeredIds.has(p.id));
    const teamA = match.players.filter((p) => p.team === 'A');
    const teamB = match.players.filter((p) => p.team === 'B');

    container.innerHTML = `
      <div class="section-header">
        <div>
          <button class="btn btn-ghost mb-sm" id="back-to-matches">← Back to Matches</button>
          <h2 class="section-title">${match.title}</h2>
          <div class="match-meta mt-sm">
            <span>📅 ${match.date}</span>
            <span>⏰ ${match.time}</span>
            ${match.location ? `<span>📍 ${match.location}</span>` : ''}
            ${statusBadge(match.status)}
          </div>
        </div>
        <div class="flex gap-md">
          <button class="btn btn-secondary" id="edit-match-btn">✏️ Edit</button>
          <button class="btn btn-danger" id="delete-match-btn">🗑️ Delete</button>
        </div>
      </div>

      <!-- Register Players -->
      <div class="card mb-lg">
        <div class="card-header">
          <h3 class="card-title">👥 Registered Players (${match.players.length})</h3>
          ${unregistered.length > 0
        ? `
            <div class="flex gap-md items-center">
              <select class="form-select" id="add-player-select" style="min-width:180px">
                <option value="">Add player...</option>
                ${unregistered.map((p) => `<option value="${p.id}">${p.name} (${p.position})</option>`).join('')}
              </select>
              <button class="btn btn-primary btn-sm" id="register-player-btn">Add</button>
            </div>
          `
        : ''
      }
        </div>
        ${match.players.length > 0
        ? `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Position</th>
                  <th>Rating</th>
                  <th>Team</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${match.players
          .map(
            (p) => `
                  <tr>
                    <td><strong>${p.name}</strong></td>
                    <td>${posBadge(p.position)}</td>
                    <td>${p.rating} ★</td>
                    <td>${p.team ? `<span class="badge badge-${p.team === 'A' ? 'gk' : 'upcoming'}">Team ${p.team}</span>` : '<span class="text-muted">—</span>'}</td>
                    <td><button class="btn btn-ghost btn-sm remove-player" data-pid="${p.player_id}">✕</button></td>
                  </tr>
                `
          )
          .join('')}
              </tbody>
            </table>
          </div>
        `
        : '<p class="text-muted text-center">No players registered yet</p>'
      }
      </div>

      <!-- Team Division -->
      <div class="card mb-lg">
        <div class="card-header">
          <h3 class="card-title">⚔️ Team Division</h3>
          <button class="btn btn-primary" id="generate-teams-btn" ${match.players.length < 2 ? 'disabled' : ''}>
            🎲 Auto-Balance Teams
          </button>
        </div>
        <div id="teams-display">
          ${teamA.length > 0 || teamB.length > 0
        ? renderTeamsWithDragDrop(teamA, teamB, null)
        : '<p class="text-muted text-center">Click "Auto-Balance Teams" to generate balanced teams</p>'
      }
        </div>
        <div id="scenarios-container"></div>
      </div>
    `;

    // Attach drag-drop if saved teams exist
    if (teamA.length > 0 || teamB.length > 0) {
      activeScenario = {
        name: 'Saved',
        teamA: [...teamA],
        teamB: [...teamB],
      };
      recalcScenarioScores(activeScenario);
      attachDragDropHandlers(container, matchId);
    }

    // Event handlers
    document.getElementById('back-to-matches').addEventListener('click', () => renderMatches(container));

    document.getElementById('edit-match-btn').addEventListener('click', () => {
      showMatchForm(container, match);
    });

    document.getElementById('delete-match-btn').addEventListener('click', async () => {
      if (confirm('Delete this match?')) {
        try {
          await api.deleteMatch(matchId);
          showToast('Match deleted');
          renderMatches(container);
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });

    // Register player
    const regBtn = document.getElementById('register-player-btn');
    if (regBtn) {
      regBtn.addEventListener('click', async () => {
        const sel = document.getElementById('add-player-select');
        const pid = sel.value;
        if (!pid) return;
        try {
          await api.registerPlayers(matchId, [+pid]);
          showToast('Player registered!');
          showMatchDetail(container, matchId);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Remove player
    document.querySelectorAll('.remove-player').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api.removePlayer(matchId, btn.dataset.pid);
          showToast('Player removed');
          showMatchDetail(container, matchId);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    // Generate teams
    document.getElementById('generate-teams-btn').addEventListener('click', async () => {
      try {
        const result = await api.generateTeams(matchId);
        showScenarios(container, matchId, result.scenarios);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p class="text-danger">Error: ${err.message}</p></div>`;
  }
}

function showScenarios(container, matchId, scenarios) {
  const scenariosContainer = document.getElementById('scenarios-container');

  // Deep-clone scenarios so drag-drop mutations don't corrupt originals
  const editableScenarios = scenarios.map((s) => ({
    ...s,
    teamA: [...s.teamA],
    teamB: [...s.teamB],
  }));

  activeScenario = editableScenarios[0];

  scenariosContainer.innerHTML = `
    <div class="scenario-tabs" id="scenario-tabs">
      ${editableScenarios.map((s, i) => `<button class="scenario-tab ${i === 0 ? 'active' : ''}" data-idx="${i}">${s.name} (Δ${s.diff})</button>`).join('')}
    </div>
    <div id="scenario-display">${renderTeamsWithDragDrop(editableScenarios[0].teamA, editableScenarios[0].teamB, editableScenarios[0])}</div>
    <p class="text-center text-muted mt-sm" style="font-size:0.75rem">💡 Drag & drop players between teams to adjust</p>
    <div class="text-center mt-lg">
      <button class="btn btn-success btn-lg" id="save-teams-btn">✅ Save This Team Division</button>
    </div>
  `;

  let currentIdx = 0;

  // Attach drag-drop for the initial scenario
  attachDragDropHandlers(container, matchId);

  // Scenario tab clicks
  scenariosContainer.querySelectorAll('.scenario-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      currentIdx = +tab.dataset.idx;
      activeScenario = editableScenarios[currentIdx];
      scenariosContainer.querySelectorAll('.scenario-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('scenario-display').innerHTML = renderTeamsWithDragDrop(
        activeScenario.teamA,
        activeScenario.teamB,
        activeScenario
      );
      attachDragDropHandlers(container, matchId);
    });
  });

  // Save teams
  document.getElementById('save-teams-btn').addEventListener('click', async () => {
    const scenario = activeScenario;
    try {
      await api.saveTeams(
        matchId,
        scenario.teamA.map((p) => p.player_id),
        scenario.teamB.map((p) => p.player_id)
      );
      showToast('Teams saved!');
      showMatchDetail(container, matchId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ========== DRAG & DROP TEAM RENDERING ==========

function renderTeamsWithDragDrop(teamA, teamB, scenario = null) {
  return `
    <div class="teams-container">
      <div class="team-card team-a" data-team="A" id="drop-team-a">
        <div class="team-header">
          <div class="team-name">Team A</div>
          ${scenario ? `<div class="team-score" id="score-team-a">${scenario.teamAScore}</div>` : ''}
          <div class="text-muted" style="font-size:0.8rem" id="count-team-a">${teamA.length} players</div>
        </div>
        <div class="team-player-list" data-team="A">
          ${teamA.map((p) => draggableTeamPlayer(p, 'A')).join('')}
          ${teamA.length === 0 ? '<p class="text-muted text-center drop-hint">Drop players here</p>' : ''}
        </div>
      </div>
      <div class="vs-divider">VS</div>
      <div class="team-card team-b" data-team="B" id="drop-team-b">
        <div class="team-header">
          <div class="team-name">Team B</div>
          ${scenario ? `<div class="team-score" id="score-team-b">${scenario.teamBScore}</div>` : ''}
          <div class="text-muted" style="font-size:0.8rem" id="count-team-b">${teamB.length} players</div>
        </div>
        <div class="team-player-list" data-team="B">
          ${teamB.map((p) => draggableTeamPlayer(p, 'B')).join('')}
          ${teamB.length === 0 ? '<p class="text-muted text-center drop-hint">Drop players here</p>' : ''}
        </div>
      </div>
    </div>
  `;
}

function draggableTeamPlayer(p, team) {
  const posAbbr = { Goalkeeper: 'GK', Defender: 'DEF', Midfielder: 'MID', Forward: 'FWD' };
  return `
    <div class="team-player draggable-player" 
         draggable="true" 
         data-player-id="${p.player_id}" 
         data-team="${team}"
         data-player-json='${JSON.stringify(p).replace(/'/g, '&#39;')}'>
      <span class="drag-handle">⠿</span>
      <span class="player-pos">${posAbbr[p.position] || p.position}</span>
      <span class="player-name">${p.name}</span>
      <span class="player-rating">${p.rating}★</span>
    </div>
  `;
}

function attachDragDropHandlers(container, matchId) {
  const players = document.querySelectorAll('.draggable-player');
  const dropZones = document.querySelectorAll('.team-player-list');

  players.forEach((el) => {
    el.addEventListener('dragstart', handleDragStart);
    el.addEventListener('dragend', handleDragEnd);

    // Touch support for mobile
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
  });

  dropZones.forEach((zone) => {
    zone.addEventListener('dragover', handleDragOver);
    zone.addEventListener('dragenter', handleDragEnter);
    zone.addEventListener('dragleave', handleDragLeave);
    zone.addEventListener('drop', (e) => handleDrop(e, container, matchId));
  });
}

let draggedElement = null;
let touchClone = null;
let touchStartX = 0;
let touchStartY = 0;

function handleDragStart(e) {
  draggedElement = e.target.closest('.draggable-player');
  draggedElement.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedElement.dataset.playerId);
}

function handleDragEnd(e) {
  if (draggedElement) {
    draggedElement.classList.remove('dragging');
    draggedElement = null;
  }
  document.querySelectorAll('.team-player-list').forEach((z) => z.classList.remove('drag-over'));
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
  e.preventDefault();
  const zone = e.target.closest('.team-player-list');
  if (zone) zone.classList.add('drag-over');
}

function handleDragLeave(e) {
  const zone = e.target.closest('.team-player-list');
  if (zone && !zone.contains(e.relatedTarget)) {
    zone.classList.remove('drag-over');
  }
}

function handleDrop(e, container, matchId) {
  e.preventDefault();
  const targetZone = e.target.closest('.team-player-list');
  if (!targetZone || !draggedElement) return;

  targetZone.classList.remove('drag-over');

  const fromTeam = draggedElement.dataset.team;
  const toTeam = targetZone.dataset.team;

  if (fromTeam === toTeam) return; // Dropped on the same team

  const playerId = +draggedElement.dataset.playerId;
  movePlayerBetweenTeams(playerId, fromTeam, toTeam, container, matchId);
}

// Touch handlers for mobile drag & drop
function handleTouchStart(e) {
  const el = e.target.closest('.draggable-player');
  if (!el) return;

  draggedElement = el;
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;

  // Create a floating clone
  touchClone = el.cloneNode(true);
  touchClone.classList.add('touch-dragging');
  touchClone.style.position = 'fixed';
  touchClone.style.zIndex = '9999';
  touchClone.style.pointerEvents = 'none';
  touchClone.style.width = el.offsetWidth + 'px';
  touchClone.style.left = touch.clientX - el.offsetWidth / 2 + 'px';
  touchClone.style.top = touch.clientY - 20 + 'px';
  document.body.appendChild(touchClone);

  el.classList.add('dragging');
}

function handleTouchMove(e) {
  if (!draggedElement || !touchClone) return;
  e.preventDefault();
  const touch = e.touches[0];
  touchClone.style.left = touch.clientX - touchClone.offsetWidth / 2 + 'px';
  touchClone.style.top = touch.clientY - 20 + 'px';

  // Highlight drop zone under finger
  document.querySelectorAll('.team-player-list').forEach((z) => z.classList.remove('drag-over'));
  const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
  const zone = elemBelow?.closest('.team-player-list');
  if (zone) zone.classList.add('drag-over');
}

function handleTouchEnd(e) {
  if (!draggedElement) return;

  const touch = e.changedTouches[0];
  const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
  const targetZone = elemBelow?.closest('.team-player-list');

  if (targetZone && draggedElement.dataset.team !== targetZone.dataset.team) {
    const playerId = +draggedElement.dataset.playerId;
    const fromTeam = draggedElement.dataset.team;
    const toTeam = targetZone.dataset.team;
    movePlayerBetweenTeams(playerId, fromTeam, toTeam);
  }

  // Cleanup
  if (touchClone) {
    touchClone.remove();
    touchClone = null;
  }
  if (draggedElement) {
    draggedElement.classList.remove('dragging');
    draggedElement = null;
  }
  document.querySelectorAll('.team-player-list').forEach((z) => z.classList.remove('drag-over'));
}

function movePlayerBetweenTeams(playerId, fromTeam, toTeam, container, matchId) {
  if (!activeScenario) return;

  const fromArr = fromTeam === 'A' ? activeScenario.teamA : activeScenario.teamB;
  const toArr = toTeam === 'A' ? activeScenario.teamA : activeScenario.teamB;

  const playerIdx = fromArr.findIndex((p) => p.player_id === playerId);
  if (playerIdx === -1) return;

  const [player] = fromArr.splice(playerIdx, 1);
  toArr.push(player);

  recalcScenarioScores(activeScenario);

  // Re-render the teams display
  const display = document.getElementById('scenario-display') || document.getElementById('teams-display');
  if (display) {
    display.innerHTML = renderTeamsWithDragDrop(activeScenario.teamA, activeScenario.teamB, activeScenario);
    attachDragDropHandlers(container, matchId);
  }

  showToast(`${player.name} moved to Team ${toTeam}`, 'info');
}

function recalcScenarioScores(scenario) {
  const calc = (team) => {
    if (team.length === 0) return 0;
    const total = team.reduce((sum, p) => {
      const composite = (p.rating * 2 + p.passing + p.shooting + p.defending + p.dribbling + p.stamina) / 7;
      return sum + composite;
    }, 0);
    return +(total / team.length).toFixed(2);
  };

  scenario.teamAScore = calc(scenario.teamA);
  scenario.teamBScore = calc(scenario.teamB);
  scenario.diff = Math.abs(scenario.teamAScore - scenario.teamBScore).toFixed(2);
}
