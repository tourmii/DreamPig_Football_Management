import { api } from '../api.js';
import { posBadge, statusBadge, starsDisplay } from '../main.js';

export async function renderDashboard(container) {
  container.innerHTML = '<div class="text-center text-muted mt-lg">Loading dashboard...</div>';

  try {
    const [players, matches] = await Promise.all([api.getPlayers(), api.getMatches()]);

    const upcoming = matches.filter((m) => m.status === 'upcoming');
    const completed = matches.filter((m) => m.status === 'completed');
    const nextMatch = upcoming[0];

    // Sort players by avg_score for top performers
    const topPlayers = [...players]
      .filter((p) => p.matches_played > 0)
      .sort((a, b) => b.avg_score - a.avg_score)
      .slice(0, 5);

    container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">📊 Dashboard</h2>
      </div>

      <!-- Stats Overview -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-icon">👥</div>
          <div class="stat-number">${players.length}</div>
          <div class="stat-desc">Total Players</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🏟️</div>
          <div class="stat-number">${upcoming.length}</div>
          <div class="stat-desc">Upcoming Matches</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-number">${completed.length}</div>
          <div class="stat-desc">Completed</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⭐</div>
          <div class="stat-number">${topPlayers.length > 0 ? topPlayers[0].avg_score.toFixed(1) : '—'}</div>
          <div class="stat-desc">Top Rating</div>
        </div>
      </div>

      <!-- Next Match -->
      <div class="card mb-lg">
        <div class="card-header">
          <h3 class="card-title">🏟️ Next Match</h3>
          ${nextMatch ? statusBadge(nextMatch.status) : ''}
        </div>
        ${nextMatch
        ? `
          <div class="match-title">
            ${nextMatch.title}
          </div>
          <div class="match-meta mt-sm">
            <span>📅 ${formatDate(nextMatch.date)}</span>
            <span>⏰ ${nextMatch.time}</span>
            ${nextMatch.location ? `<span>📍 ${nextMatch.location}</span>` : ''}
            <span>👥 ${nextMatch.player_count || 0} players</span>
            ${nextMatch.score_a !== null ? `<div class="match-score-badge">${nextMatch.score_a} – ${nextMatch.score_b}</div>` : ''}
          </div>
          <div class="mt-md">
            <button class="btn btn-primary" onclick="appNavigate('matches')">View Match Details →</button>
          </div>
        `
        : `
          <div class="empty-state">
            <div class="empty-icon">🏟️</div>
            <p>No upcoming matches</p>
            <button class="btn btn-primary" onclick="appNavigate('matches')">Create a Match</button>
          </div>
        `
      }
      </div>

      <div style="display:grid;grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));gap:var(--space-lg)">
        <!-- Top Performers -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">🏆 Top Performers</h3>
          </div>
          ${topPlayers.length > 0
        ? `
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Avg Score</th>
                    <th>Matches</th>
                  </tr>
                </thead>
                <tbody>
                  ${topPlayers
          .map(
            (p, i) => `
                    <tr>
                      <td><strong>${p.name}</strong><br><small class="text-muted">${posBadge(p.position)}</small></td>
                      <td><strong style="color:var(--accent)">${p.avg_score.toFixed(1)}</strong></td>
                      <td>${p.matches_played}</td>
                    </tr>
                  `
          )
          .join('')}
                </tbody>
              </table>
            </div>
          `
        : `
            <div class="empty-state">
              <div class="empty-icon">⭐</div>
              <p>No evaluations yet.</p>
            </div>
          `
      }
        </div>

        <!-- Top Scorers -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">⚽ Top Scorers</h3>
          </div>
          ${players.some(p => (p.goals || 0) > 0)
        ? `
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Goals</th>
                    <th>Assists</th>
                  </tr>
                </thead>
                <tbody>
                  ${[...players]
          .filter(p => (p.goals || 0) > 0 || (p.assists || 0) > 0)
          .sort((a, b) => (b.goals || 0) - (a.goals || 0) || (b.assists || 0) - (a.assists || 0))
          .slice(0, 5)
          .map(p => `
                    <tr>
                      <td><strong>${p.name}</strong></td>
                      <td><span class="stat-pill stat-pill-goals">⚽ ${p.goals || 0}</span></td>
                      <td><span class="stat-pill stat-pill-assists">👟 ${p.assists || 0}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            `
        : `
            <div class="empty-state">
              <div class="empty-icon">⚽</div>
              <p>No goals recorded yet.</p>
            </div>
            `
      }
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p class="text-danger">Error: ${err.message}</p></div>`;
  }
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
