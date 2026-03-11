import { api } from '../api.js';
import { showToast, posBadge } from '../main.js';

export async function renderEvaluate(container) {
    container.innerHTML = '<div class="text-center text-muted mt-lg">Loading...</div>';

    try {
        const matches = await api.getMatches();
        // Show completed matches or upcoming ones that have players
        const evaluable = matches.filter((m) => m.player_count > 0);

        container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">⭐ Match Evaluation</h2>
      </div>

      <div class="card mb-lg">
        <div class="card-header">
          <h3 class="card-title">Select Match</h3>
        </div>
        ${evaluable.length > 0
                ? `
          <select class="form-select w-full" id="eval-match-select">
            <option value="">Choose a match...</option>
            ${evaluable
                    .map(
                        (m) =>
                            `<option value="${m.id}">${m.title} — ${m.date} (${m.status})</option>`
                    )
                    .join('')}
          </select>
        `
                : '<p class="text-muted text-center">No matches with players available for evaluation</p>'
            }
      </div>

      <div id="eval-form-container"></div>
    `;

        const select = document.getElementById('eval-match-select');
        if (select) {
            select.addEventListener('change', async () => {
                const matchId = select.value;
                if (matchId) {
                    await loadEvalForm(container, matchId);
                } else {
                    document.getElementById('eval-form-container').innerHTML = '';
                }
            });
        }
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><p class="text-danger">Error: ${err.message}</p></div>`;
    }
}

async function loadEvalForm(container, matchId) {
    const formContainer = document.getElementById('eval-form-container');
    formContainer.innerHTML = '<div class="text-center text-muted">Loading players...</div>';

    try {
        const match = await api.getMatch(matchId);
        const existingEvals = {};
        if (match.evaluations) {
            match.evaluations.forEach((ev) => {
                existingEvals[ev.player_id] = ev;
            });
        }

        if (match.players.length === 0) {
            formContainer.innerHTML = '<p class="text-muted text-center">No players in this match</p>';
            return;
        }

        const attrs = ['passing', 'shooting', 'defending', 'dribbling', 'stamina'];

        formContainer.innerHTML = `
      <form id="evaluation-form">
        ${match.players
                .map((p) => {
                    const existing = existingEvals[p.player_id];
                    return `
            <div class="card mb-md" style="border-left:3px solid ${p.team === 'A' ? 'var(--team-a)' : p.team === 'B' ? 'var(--team-b)' : 'var(--border)'}">
              <div class="flex items-center justify-between mb-md">
                <div class="flex items-center gap-md">
                  <strong>${p.name}</strong>
                  ${posBadge(p.position)}
                  ${p.team ? `<span class="badge badge-${p.team === 'A' ? 'gk' : 'upcoming'}">Team ${p.team}</span>` : ''}
                </div>
                <div class="stat-value" id="overall-${p.player_id}">
                  ${existing ? existing.overall_score.toFixed(1) : '3.0'}
                </div>
              </div>
              ${attrs
                            .map(
                                (attr) => `
                <div class="slider-group" style="margin-bottom:var(--space-sm)">
                  <span class="slider-label">${attr.charAt(0).toUpperCase() + attr.slice(1)}</span>
                  <input type="range" class="slider-input eval-slider" 
                         name="${p.player_id}_${attr}" 
                         data-pid="${p.player_id}"
                         min="1" max="5" value="${existing?.[attr] || 3}" 
                         oninput="this.nextElementSibling.textContent=this.value" />
                  <span class="slider-value">${existing?.[attr] || 3}</span>
                </div>
              `
                            )
                            .join('')}
            </div>
          `;
                })
                .join('')}
        <div class="text-center mt-lg">
          <button type="submit" class="btn btn-success btn-lg">✅ Submit Evaluations</button>
        </div>
      </form>
    `;

        // Live overall score calculation
        document.querySelectorAll('.eval-slider').forEach((slider) => {
            slider.addEventListener('input', () => {
                const pid = slider.dataset.pid;
                const sliders = document.querySelectorAll(`.eval-slider[data-pid="${pid}"]`);
                const sum = Array.from(sliders).reduce((s, sl) => s + +sl.value, 0);
                const avg = (sum / sliders.length).toFixed(1);
                document.getElementById(`overall-${pid}`).textContent = avg;
            });
        });

        // Submit form
        document.getElementById('evaluation-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const evaluations = match.players.map((p) => ({
                player_id: p.player_id,
                passing: +fd.get(`${p.player_id}_passing`),
                shooting: +fd.get(`${p.player_id}_shooting`),
                defending: +fd.get(`${p.player_id}_defending`),
                dribbling: +fd.get(`${p.player_id}_dribbling`),
                stamina: +fd.get(`${p.player_id}_stamina`),
            }));

            try {
                await api.submitEvaluations(matchId, evaluations);
                showToast('Evaluations submitted! Player stats updated.');
                renderEvaluate(container);
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    } catch (err) {
        formContainer.innerHTML = `<p class="text-danger text-center">Error: ${err.message}</p>`;
    }
}
