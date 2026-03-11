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
          <div class="match-title">${nextMatch.title}</div>
          <div class="match-meta mt-sm">
            <span>📅 ${formatDate(nextMatch.date)}</span>
            <span>⏰ ${nextMatch.time}</span>
            ${nextMatch.location ? `<span>📍 ${nextMatch.location}</span>` : ''}
            <span>👥 ${nextMatch.player_count || 0} players</span>
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
                  <th>#</th>
                  <th>Player</th>
                  <th>Position</th>
                  <th>Rating</th>
                  <th>Avg Score</th>
                  <th>Matches</th>
                </tr>
              </thead>
              <tbody>
                ${topPlayers
                    .map(
                        (p, i) => `
                  <tr>
                    <td><strong>${i + 1}</strong></td>
                    <td><strong>${p.name}</strong></td>
                    <td>${posBadge(p.position)}</td>
                    <td class="text-warning">${starsDisplay(p.rating)}</td>
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
            <p>No evaluations yet. Complete a match and rate players to see top performers.</p>
          </div>
        `
            }
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
