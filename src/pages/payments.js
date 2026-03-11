import { api } from '../api.js';
import { showToast } from '../main.js';

export async function renderPayments(container) {
    container.innerHTML = '<div class="text-center text-muted mt-lg">Loading...</div>';

    try {
        const matches = await api.getMatches();
        const withPlayers = matches.filter((m) => m.player_count > 0);

        container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">💳 Payment Tracking</h2>
      </div>

      <div class="card mb-lg">
        <div class="card-header">
          <h3 class="card-title">Select Match</h3>
        </div>
        ${withPlayers.length > 0
                ? `
          <select class="form-select w-full" id="payment-match-select">
            <option value="">Choose a match...</option>
            ${withPlayers
                    .map(
                        (m) =>
                            `<option value="${m.id}">${m.title} — ${m.date} ${m.fee > 0 ? `(${m.fee} per player)` : ''}</option>`
                    )
                    .join('')}
          </select>
        `
                : '<p class="text-muted text-center">No matches with players available</p>'
            }
      </div>

      <div id="payment-content"></div>
    `;

        const select = document.getElementById('payment-match-select');
        if (select) {
            select.addEventListener('change', async () => {
                if (select.value) {
                    await loadPaymentView(container, select.value);
                } else {
                    document.getElementById('payment-content').innerHTML = '';
                }
            });
        }
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><p class="text-danger">Error: ${err.message}</p></div>`;
    }
}

async function loadPaymentView(container, matchId) {
    const content = document.getElementById('payment-content');
    content.innerHTML = '<div class="text-center text-muted">Loading...</div>';

    try {
        const data = await api.getPayments(matchId);
        const { payments, qr_image_path, fee } = data;
        const paidCount = payments.filter((p) => p.paid).length;

        content.innerHTML = `
      <!-- QR Code Section -->
      <div class="card mb-lg">
        <div class="card-header">
          <h3 class="card-title">📱 Payment QR Code</h3>
        </div>
        ${qr_image_path
                ? `
          <div class="qr-display">
            <img src="${qr_image_path}" alt="Payment QR Code" />
            <p style="color:var(--bg-dark);font-size:0.8rem;font-weight:500">Scan to pay${fee > 0 ? ` — ${fee} per player` : ''}</p>
          </div>
        `
                : ''
            }
        <div class="upload-area" id="qr-upload-area">
          <input type="file" id="qr-file-input" accept="image/*" />
          <div class="upload-icon">📤</div>
          <p>${qr_image_path ? 'Upload new QR code' : 'Click to upload QR code image'}</p>
        </div>
      </div>

      <!-- Payment Checklist -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">✅ Payment Status</h3>
          <span class="text-secondary" style="font-size:0.85rem">
            ${paidCount}/${payments.length} paid
          </span>
        </div>

        <!-- Progress bar -->
        <div class="skill-bar" style="margin-bottom:var(--space-lg);height:8px">
          <div class="skill-bar-fill" style="width:${payments.length > 0 ? (paidCount / payments.length) * 100 : 0}%;background:linear-gradient(90deg,var(--success),var(--accent))"></div>
        </div>

        <div id="payment-list">
          ${payments
                .map(
                    (p) => `
            <div class="checkbox-item">
              <input type="checkbox" id="pay-${p.player_id}" data-pid="${p.player_id}" ${p.paid ? 'checked' : ''} />
              <label for="pay-${p.player_id}">
                <strong>${p.name}</strong>
                ${fee > 0 ? `<span class="text-muted" style="font-size:0.8rem;margin-left:var(--space-sm)">${fee}</span>` : ''}
              </label>
              ${p.paid ? '<span class="badge badge-paid">Paid</span>' : '<span class="badge badge-unpaid">Unpaid</span>'}
            </div>
          `
                )
                .join('')}
        </div>

        ${payments.length > 0
                ? `
          <div class="text-center mt-lg">
            <button class="btn btn-success" id="save-payments-btn">💾 Save Payment Status</button>
          </div>
        `
                : '<p class="text-muted text-center">No players registered for this match</p>'
            }
      </div>
    `;

        // QR upload
        const uploadArea = document.getElementById('qr-upload-area');
        const fileInput = document.getElementById('qr-file-input');

        uploadArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                await api.uploadQR(matchId, file);
                showToast('QR code uploaded!');
                loadPaymentView(container, matchId);
            } catch (err) {
                showToast(err.message, 'error');
            }
        });

        // Save payments
        const saveBtn = document.getElementById('save-payments-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const checkboxes = document.querySelectorAll('#payment-list input[type="checkbox"]');
                const paymentUpdates = Array.from(checkboxes).map((cb) => ({
                    player_id: +cb.dataset.pid,
                    paid: cb.checked,
                }));

                try {
                    await api.updatePayments(matchId, paymentUpdates);
                    showToast('Payment status saved!');
                    loadPaymentView(container, matchId);
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        }
    } catch (err) {
        content.innerHTML = `<p class="text-danger text-center">Error: ${err.message}</p>`;
    }
}
