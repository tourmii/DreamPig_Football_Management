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
        ${m.score_a !== null && m.score_b !== null ? `<div class="match-score-badge">${m.score_a} – ${m.score_b}</div>` : ''}
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
    // Sort all players - registered first, then alphabetically
    const poolPlayers = allPlayers.sort((a, b) => {
      const aReg = registeredIds.has(a.id);
      const bReg = registeredIds.has(b.id);
      if (aReg && !bReg) return -1;
      if (!aReg && bReg) return 1;
      return a.name.localeCompare(b.name);
    });

    const teamA = match.players.filter((p) => p.team === 'A');
    const teamB = match.players.filter((p) => p.team === 'B');
    const subA = match.players.filter((p) => p.team === 'SUB_A');
    const subB = match.players.filter((p) => p.team === 'SUB_B');

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
          ${match.status !== 'cancelled' ? `<button class="btn btn-success" id="enter-result-btn">🏆 Result</button>` : ''}
          <button class="btn btn-secondary" id="edit-match-btn">✏️ Edit</button>
          <button class="btn btn-danger" id="delete-match-btn">🗑️ Delete</button>
        </div>
      </div>

      <div class="match-detail-grid">
        <!-- Main Area: Teams Split View -->
        <div class="main-match-area">
          ${match.score_a !== null && match.score_b !== null ? `
          <div class="scoreboard mb-lg">
            <div class="scoreboard-team">
              <div class="team-name" style="color:var(--team-a)">${match.team_a_name}</div>
              <div class="scoreboard-score">${match.score_a}</div>
            </div>
            <div class="scoreboard-divider">VS</div>
            <div class="scoreboard-team">
              <div class="team-name" style="color:var(--team-b)">${match.team_b_name}</div>
              <div class="scoreboard-score">${match.score_b}</div>
            </div>
          </div>
          ` : ''}

          <div class="card mb-lg">
            <div class="card-header">
              <h3 class="card-title">⚔️ Team Division</h3>
              <div class="flex gap-sm">
                <button class="btn btn-secondary btn-sm" id="generate-teams-btn" ${match.players.length < 2 ? 'disabled' : ''}>🎲 Auto-Balance</button>
              </div>
            </div>
            <div id="teams-display">
              ${(teamA.length + teamB.length + subA.length + subB.length) > 0
        ? renderTeamsSplitView(teamA, teamB, subA, subB, match)
        : '<p class="text-muted text-center p-xl">Drag players from the pool to assign teams</p>'
      }
            </div>
            <div id="scenarios-container"></div>
          </div>

          <!-- Player Stats -->
          ${match.score_a !== null && match.score_b !== null ? `
          <div class="card mb-lg">
            <div class="card-header"><h3 class="card-title">📊 Match Stats</h3></div>
            <div class="table-wrap">
              <table class="player-stats-table">
                <thead><tr><th>Player</th><th>Team</th><th>Goals</th><th>Assists</th></tr></thead>
                <tbody>
                  ${match.players.filter(p => (p.goals > 0 || p.assists > 0)).sort((a, b) => b.goals - a.goals || b.assists - a.assists).map(p => `
                    <tr>
                      <td><strong>${p.name}</strong></td>
                      <td><span class="badge badge-${p.team?.startsWith('A') ? 'gk' : p.team?.startsWith('B') ? 'upcoming' : 'mid'}">${p.team?.includes('A') ? match.team_a_name : match.team_b_name}</span></td>
                      <td><span class="stat-pill stat-pill-goals">⚽ ${p.goals}</span></td>
                      <td><span class="stat-pill stat-pill-assists">👟 ${p.assists}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          ` : ''}
        </div>

        <!-- Sidebar: Registration Pool -->
        <div class="registration-pool-card card">
          <div class="card-header" style="margin-bottom: var(--space-sm)">
            <h3 class="card-title" style="font-size: 0.9rem">👥 Players Pool</h3>
            <span class="badge">${poolPlayers.length}</span>
          </div>
          <div class="pool-search">
            <input type="text" class="form-input" id="pool-search-input" placeholder="Search player..." style="padding: 4px 8px; font-size: 0.8rem" />
          </div>
          <div class="pool-list" id="pool-list">
            ${poolPlayers.map(p => renderPoolPlayer(p, registeredIds.has(p.id))).join('')}
          </div>
          <p class="text-xs text-muted mt-sm">💡 Tick to register player for match</p>
        </div>
      </div>
    `;

    // Active scenario for D&D
    activeScenario = {
      name: 'Current',
      teamA: [...teamA],
      teamB: [...teamB],
      subA: [...subA],
      subB: [...subB],
      team_a_name: match.team_a_name,
      team_b_name: match.team_b_name
    };
    recalcScenarioScores(activeScenario);
    attachDragDropHandlers(container, matchId);

    // Registration List Event (Checkboxes)
    document.getElementById('pool-list').addEventListener('change', async (e) => {
      if (e.target.classList.contains('pool-checkbox')) {
        const playerId = +e.target.dataset.playerId;
        const isChecked = e.target.checked;

        try {
          if (isChecked) {
            await api.registerPlayers(matchId, [playerId]);
            showToast('Player registered!');
          } else {
            await api.removePlayer(matchId, playerId);
            showToast('Player removed');
          }
          // Refresh to show in teams
          showMatchDetail(container, matchId);
        } catch (err) {
          showToast(err.message, 'error');
          e.target.checked = !isChecked; // Revert checkbox
        }
      }
    });

    // Team Display Events (Remove buttons)
    document.getElementById('teams-display').addEventListener('click', async (e) => {
      const btn = e.target.closest('.remove-player-btn');
      if (btn) {
        const playerId = +btn.dataset.playerId;
        try {
          await api.removePlayer(matchId, playerId);
          showToast('Player removed');
          showMatchDetail(container, matchId);
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });

    // Event handlers
    document.getElementById('back-to-matches').addEventListener('click', () => renderMatches(container));
    document.getElementById('edit-match-btn').addEventListener('click', () => showMatchForm(container, match));

    document.getElementById('delete-match-btn').addEventListener('click', async () => {
      if (confirm('Delete this match?')) {
        await api.deleteMatch(matchId);
        showToast('Match deleted');
        renderMatches(container);
      }
    });

    document.getElementById('generate-teams-btn').addEventListener('click', async () => {
      const result = await api.generateTeams(matchId);
      showScenarios(container, matchId, result.scenarios);
    });

    const resBtn = document.getElementById('enter-result-btn');
    if (resBtn) resBtn.addEventListener('click', () => showResultForm(container, match));

    // Pool Search
    const searchInput = document.getElementById('pool-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('.pool-player').forEach(el => {
          const name = el.querySelector('.pool-player div div').textContent.toLowerCase();
          el.style.display = name.includes(q) ? 'block' : 'none';
        });
      });
    }

    // Inline Team Name Edits
    document.querySelectorAll('.team-name-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        const team = input.dataset.team;
        const newName = e.target.value || `Team ${team}`;
        try {
          await api.updateMatch(matchId, { [`team_${team.toLowerCase()}_name`]: newName });
          showToast(`Renamed ${team} to ${newName}`);
          activeScenario[`team_${team.toLowerCase()}_name`] = newName;
          // Partial re-render not needed if logic handles it, but let's refresh just in case
          // showMatchDetail(container, matchId); 
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
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
    subA: [...(s.subA || [])],
    subB: [...(s.subB || [])]
  }));

  activeScenario = editableScenarios[0];

  scenariosContainer.innerHTML = `
    <div class="scenario-tabs" id="scenario-tabs">
      ${editableScenarios.map((s, i) => `<button class="scenario-tab ${i === 0 ? 'active' : ''}" data-idx="${i}">${s.name} (Δ${s.diff})</button>`).join('')}
    </div>
    <div id="scenario-display">${renderTeamsSplitView(activeScenario.teamA, activeScenario.teamB, activeScenario.subA, activeScenario.subB)}</div>
    <p class="text-center text-muted mt-sm" style="font-size:0.75rem">💡 Drag & drop players between teams to adjust</p>
    <div class="text-center mt-lg">
      <button class="btn btn-success btn-lg" id="save-teams-btn">✅ Save This Team Division</button>
    </div>
  `;

  // Attach drag-drop for the initial scenario
  attachDragDropHandlers(container, matchId);

  // Scenario tab clicks
  scenariosContainer.querySelectorAll('.scenario-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const currentIdx = +tab.dataset.idx;
      activeScenario = editableScenarios[currentIdx];
      scenariosContainer.querySelectorAll('.scenario-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('scenario-display').innerHTML = renderTeamsSplitView(
        activeScenario.teamA,
        activeScenario.teamB,
        activeScenario.subA,
        activeScenario.subB
      );
      attachDragDropHandlers(container, matchId);
    });
  });

  // Save teams
  document.getElementById('save-teams-btn').addEventListener('click', async () => {
    const s = activeScenario;
    try {
      await api.saveTeams(
        matchId,
        s.teamA.map(p => p.player_id || p.id),
        s.teamB.map(p => p.player_id || p.id),
        s.subA.map(p => p.player_id || p.id),
        s.subB.map(p => p.player_id || p.id)
      );
      showToast('Teams saved!');
      showMatchDetail(container, matchId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}


// ========== DRAG & DROP TEAM RENDERING ==========

function renderTeamsSplitView(teamA, teamB, subA = [], subB = [], match = null) {
  const teamAName = match?.team_a_name || activeScenario?.team_a_name || 'Team A';
  const teamBName = match?.team_b_name || activeScenario?.team_b_name || 'Team B';

  return `
    <div class="teams-split-view">
      <!-- Team A Column -->
      <div class="team-card team-a" data-team="A">
        <div class="team-header">
          <input type="text" class="team-name-input" data-team="A" value="${teamAName}" />
          ${activeScenario ? `<div class="team-score" id="score-team-a">${activeScenario.teamAScore}</div>` : ''}
          <div class="text-muted" style="font-size:0.75rem" id="count-team-a">${teamA.length} players</div>
          ${teamA.length > 7 ? '<div class="team-limit-warning">⚠️ Max 7 allowed</div>' : ''}
        </div>
        <div class="team-player-list" data-team="A" style="min-height:100px">
          ${teamA.map(p => draggableTeamPlayer(p, 'A')).join('')}
          ${teamA.length === 0 ? '<p class="text-muted text-center p-md text-xs">Drop active players</p>' : ''}
        </div>

        <div class="team-bench-area">
          <div class="bench-title">💺 Bench (${subA.length})</div>
          <div class="team-player-list" data-team="SUB_A" style="min-height:60px">
            ${subA.map(p => draggableTeamPlayer(p, 'SUB_A')).join('')}
            ${subA.length === 0 ? '<p class="text-muted text-center p-sm text-xs">Drop substitutes</p>' : ''}
          </div>
        </div>
      </div>

      <!-- Team B Column -->
      <div class="team-card team-b" data-team="B">
        <div class="team-header">
          <input type="text" class="team-name-input" data-team="B" value="${teamBName}" />
          ${activeScenario ? `<div class="team-score" id="score-team-b">${activeScenario.teamBScore}</div>` : ''}
          <div class="text-muted" style="font-size:0.75rem" id="count-team-b">${teamB.length} players</div>
          ${teamB.length > 7 ? '<div class="team-limit-warning">⚠️ Max 7 allowed</div>' : ''}
        </div>
        <div class="team-player-list" data-team="B" style="min-height:100px">
          ${teamB.map(p => draggableTeamPlayer(p, 'B')).join('')}
          ${teamB.length === 0 ? '<p class="text-muted text-center p-md text-xs">Drop active players</p>' : ''}
        </div>

        <div class="team-bench-area">
          <div class="bench-title">💺 Bench (${subB.length})</div>
          <div class="team-player-list" data-team="SUB_B" style="min-height:60px">
            ${subB.map(p => draggableTeamPlayer(p, 'SUB_B')).join('')}
            ${subB.length === 0 ? '<p class="text-muted text-center p-sm text-xs">Drop substitutes</p>' : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderPoolPlayer(p, isRegistered = false) {
  const posAbbr = { Goalkeeper: 'GK', Defender: 'DEF', Midfielder: 'MID', Forward: 'FWD' };
  return `
    <div class="pool-player ${isRegistered ? 'registered' : ''}">
      <label class="flex items-center gap-sm w-full cursor-pointer">
        <input type="checkbox" class="pool-checkbox" data-player-id="${p.id}" ${isRegistered ? 'checked' : ''} />
        <div class="flex-1">
          <div style="font-size: 0.85rem; font-weight: 600">${p.name}</div>
          <div style="font-size: 0.7rem; color: var(--text-muted)">${posAbbr[p.position] || p.position} • ${p.rating}★</div>
        </div>
        ${isRegistered ? '<span class="text-success" style="font-size: 0.7rem">Registered</span>' : ''}
      </label>
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
      <div class="flex items-center gap-xs flex-1 overflow-hidden">
        <span class="drag-handle">⠿</span>
        <span class="player-pos">${posAbbr[p.position] || p.position}</span>
        <span class="player-name overflow-hidden text-ellipsis whitespace-nowrap">${p.name}</span>
      </div>
      <div class="flex items-center gap-sm">
        <span class="player-rating">${p.rating}★</span>
        <button class="remove-player-btn" data-player-id="${p.player_id}" title="Unregister Player">×</button>
      </div>
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

async function movePlayerBetweenTeams(playerId, fromTeam, toTeam, container, matchId) {
  if (!activeScenario) return;

  // 1. Find and Remove from Source
  let player = null;
  let fromArr = null;

  if (fromTeam === 'POOL') {
    // Player is in the Sidebar Pool (not yet registered)
    const allPlayers = await api.getPlayers();
    player = allPlayers.find(p => p.id === playerId);
    if (!player) return;
    // Register player if moving FROM pool
    if (toTeam !== 'POOL') {
      try {
        await api.registerPlayers(matchId, [playerId]);
        showToast(`${player.name} registered!`);
      } catch (err) {
        showToast(err.message, 'error');
        return;
      }
    }
  } else {
    fromArr = fromTeam === 'A' ? activeScenario.teamA :
      fromTeam === 'B' ? activeScenario.teamB :
        fromTeam === 'SUB_A' ? activeScenario.subA :
          fromTeam === 'SUB_B' ? activeScenario.subB : null;

    if (!fromArr) return;
    const idx = fromArr.findIndex(p => p.player_id === playerId);
    if (idx !== -1) {
      [player] = fromArr.splice(idx, 1);
    }
  }

  if (!player) return;

  // 2. Handle Case: Moving TO Pool (Unregister)
  if (toTeam === 'POOL') {
    try {
      await api.removePlayer(matchId, playerId);
      showToast(`${player.name} unregistered`);
      showMatchDetail(container, matchId); // Full refresh for pool updates
      return;
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
  }

  // 3. Add to Destination
  const toArr = toTeam === 'A' ? activeScenario.teamA :
    toTeam === 'B' ? activeScenario.teamB :
      toTeam === 'SUB_A' ? activeScenario.subA : activeScenario.subB;

  // Ensure consistent object structure (pool players have id, match players have player_id)
  const playerObj = player.player_id ? player : { ...player, player_id: player.id };
  toArr.push(playerObj);

  recalcScenarioScores(activeScenario);

  // 4. Update UI
  const display = document.getElementById('scenario-display') || document.getElementById('teams-display');
  if (display) {
    display.innerHTML = renderTeamsSplitView(activeScenario.teamA, activeScenario.teamB, activeScenario.subA, activeScenario.subB);
    attachDragDropHandlers(container, matchId);

    // If it's the registered view (not scenario view), save immediately? 
    // Usually it's better to save on manual button click for Scenarios, 
    // but for the "Current" view, let's auto-save to match old behavior if desired.
    // For now, let's keep it manual or auto-save if it's the main teams-display.
    if (display.id === 'teams-display') {
      try {
        await api.saveTeams(
          matchId,
          activeScenario.teamA.map(p => p.player_id),
          activeScenario.teamB.map(p => p.player_id),
          activeScenario.subA.map(p => p.player_id),
          activeScenario.subB.map(p => p.player_id)
        );
      } catch (err) {
        showToast('Auto-save failed: ' + err.message, 'error');
      }
    }
  }

  // Update Pool List if it was a registration
  if (fromTeam === 'POOL') {
    showMatchDetail(container, matchId);
  }

  showToast(`${player.name} moved to ${toTeam}`, 'info');
}

function recalcScenarioScores(scenario) {
  const calc = (team, sub) => {
    const all = [...team, ...sub];
    if (all.length === 0) return 0;
    const total = all.reduce((sum, p) => {
      // Use composite rating for balance
      const composite = (p.rating * 2 + (p.passing || 3) + (p.shooting || 3) + (p.defending || 3) + (p.dribbling || 3) + (p.stamina || 3)) / 7;
      return sum + composite;
    }, 0);
    return +(total / all.length).toFixed(2);
  };

  scenario.teamAScore = calc(scenario.teamA, scenario.subA || []);
  scenario.teamBScore = calc(scenario.teamB, scenario.subB || []);
  scenario.diff = Math.abs(scenario.teamAScore - scenario.teamBScore).toFixed(2);
}

// ========== RESULT ENTRY FORM ==========

function showResultForm(container, match) {
  const players = match.players;
  // Initialize stats locally
  const stats = {};
  players.forEach(p => {
    stats[p.player_id] = { goals: p.goals || 0, assists: p.assists || 0 };
  });

  openModal(
    'Enter Match Result',
    `
    <form id="result-form">
      <div class="card mb-lg" style="background:var(--bg-dark)">
        <div class="flex items-center justify-center gap-xl p-lg">
          <div class="text-center" style="flex:1">
            <div class="form-label">Team A</div>
            <input class="form-input text-center" style="font-size:2rem;font-weight:800;height:60px" type="number" name="score_a" value="${match.score_a ?? 0}" min="0" required />
          </div>
          <div class="scoreboard-divider">VS</div>
          <div class="text-center" style="flex:1">
            <div class="form-label">Team B</div>
            <input class="form-input text-center" style="font-size:2rem;font-weight:800;height:60px" type="number" name="score_b" value="${match.score_b ?? 0}" min="0" required />
          </div>
        </div>
      </div>

      <h4 class="section-title mb-md" style="font-size:0.9rem">⚽ Individual Stats</h4>
      <div class="table-wrap mb-lg">
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Team</th>
              <th class="text-center">Goals</th>
              <th class="text-center">Assists</th>
            </tr>
          </thead>
          <tbody>
            ${players.map(p => `
              <tr>
                <td><strong>${p.name}</strong></td>
                <td><span class="badge badge-${p.team === 'A' ? 'gk' : p.team === 'B' ? 'upcoming' : 'mid'}">${p.team || 'SUB'}</span></td>
                <td>
                  <div class="stat-counter mx-auto" style="width:fit-content">
                    <button type="button" class="stat-counter-btn minus" data-pid="${p.player_id}" data-type="goals">−</button>
                    <span class="stat-counter-value" id="goals-${p.player_id}">${stats[p.player_id].goals}</span>
                    <button type="button" class="stat-counter-btn plus" data-pid="${p.player_id}" data-type="goals">+</button>
                  </div>
                </td>
                <td>
                  <div class="stat-counter mx-auto" style="width:fit-content">
                    <button type="button" class="stat-counter-btn minus" data-pid="${p.player_id}" data-type="assists">−</button>
                    <span class="stat-counter-value" id="assists-${p.player_id}">${stats[p.player_id].assists}</span>
                    <button type="button" class="stat-counter-btn plus" data-pid="${p.player_id}" data-type="assists">+</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.remove('active')">Cancel</button>
        <button type="submit" class="btn btn-success">Save Result</button>
      </div>
    </form>
    `
  );

  // Counter logic
  document.querySelectorAll('.stat-counter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.pid;
      const type = btn.dataset.type;
      const isPlus = btn.classList.contains('plus');

      if (isPlus) {
        stats[pid][type]++;
      } else {
        if (stats[pid][type] > 0) stats[pid][type]--;
      }

      document.getElementById(`${type}-${pid}`).textContent = stats[pid][type];
    });
  });

  document.getElementById('result-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const scoreA = +fd.get('score_a');
    const scoreB = +fd.get('score_b');

    try {
      await api.saveMatchResult(match.id, scoreA, scoreB);

      const statsList = Object.keys(stats).map(pid => ({
        player_id: +pid,
        goals: stats[pid].goals,
        assists: stats[pid].assists
      }));

      await api.savePlayerStats(match.id, statsList);

      showToast('Match result saved!');
      closeModal();
      showMatchDetail(container, match.id);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
