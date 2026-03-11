import { renderDashboard } from './pages/dashboard.js';
import { renderPlayers } from './pages/players.js';
import { renderMatches } from './pages/matches.js';
import { renderEvaluate } from './pages/evaluate.js';
import { renderPayments } from './pages/payments.js';

const pages = {
    dashboard: renderDashboard,
    players: renderPlayers,
    matches: renderMatches,
    evaluate: renderEvaluate,
    payments: renderPayments,
};

let currentPage = 'dashboard';

function navigate(page) {
    currentPage = page;
    const main = document.getElementById('main-content');
    main.innerHTML = '';
    main.style.animation = 'none';
    // Trigger reflow
    main.offsetHeight;
    main.style.animation = 'fadeIn 0.3s ease';

    // Update nav
    document.querySelectorAll('.nav-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.page === page);
    });

    // Render page
    if (pages[page]) {
        pages[page](main);
    }
}

// Navigation click handlers
document.getElementById('main-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-btn');
    if (btn && btn.dataset.page) {
        navigate(btn.dataset.page);
    }
});

// Modal helpers
export function openModal(title, bodyHtml) {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    overlay.classList.add('active');
}

export function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
});

// Toast helper
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Position badge helper
export function posBadge(position) {
    const map = {
        Goalkeeper: 'gk',
        Defender: 'def',
        Midfielder: 'mid',
        Forward: 'fwd',
    };
    const abbr = { Goalkeeper: 'GK', Defender: 'DEF', Midfielder: 'MID', Forward: 'FWD' };
    return `<span class="badge badge-${map[position] || 'mid'}">${abbr[position] || position}</span>`;
}

// Status badge helper
export function statusBadge(status) {
    return `<span class="badge badge-${status}">${status}</span>`;
}

// Star display
export function starsDisplay(rating) {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

// Navigate and expose globally
window.appNavigate = navigate;

// Initial render
navigate('dashboard');
