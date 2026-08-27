/* ============================================
   JU BOARD — auth.js
   Connexion, protection des pages, menu utilisateur,
   personnalisation du "Bonjour {utilisateur}".

   La protection réelle vient du Worker (toute route
   /api/* exige un token de session valide) — ce fichier
   gère l'expérience côté client (redirection, UI).
   ============================================ */

function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  if (getAuthToken()) {
    window.location.href = 'index.html';
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.classList.add('hidden');

    try {
      await login(username, password);
      window.location.href = 'index.html';
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    }
  });
}

function initUserMenu() {
  const btn = document.getElementById('user-menu-btn');
  const menu = document.getElementById('user-menu');
  if (!btn || !menu) return;

  const user = getCurrentUser();
  if (!user) return;

  document.getElementById('user-initial').textContent = (user.displayName || user.username || '?').charAt(0).toUpperCase();
  document.getElementById('user-menu-name').textContent = `Bonjour ${user.displayName || user.username}`;

  const adminLink = document.getElementById('user-menu-admin');
  if (adminLink) adminLink.classList.toggle('hidden', !user.isAdmin);

  btn.addEventListener('click', () => menu.classList.toggle('active'));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu-wrap')) menu.classList.remove('active');
  });

  const logoutBtn = document.getElementById('user-menu-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await logout();
      window.location.href = 'login.html';
    });
  }
}

function applyPersonalizedGreeting() {
  const nameEl = document.querySelector('.greeting-name');
  if (!nameEl) return;
  const user = getCurrentUser();
  if (user) nameEl.textContent = `Bonjour ${user.displayName || user.username}`;
}

const PAGE_PERMISSIONS = {
  'news.html': 'news',
  'analyse.html': 'analyse',
  'recherche.html': 'recherche',
  'assistant.html': 'assistant'
};

function enforcePagePermission() {
  const user = getCurrentUser();
  if (!user || user.isAdmin) return;
  const page = window.location.pathname.split('/').pop();
  const requiredPermission = PAGE_PERMISSIONS[page];
  if (!requiredPermission) return;
  const allowed = user.permissions ? user.permissions[requiredPermission] !== false : true;
  if (!allowed) {
    window.location.href = 'index.html';
  }
}

function hideRestrictedNavItems() {
  const user = getCurrentUser();
  if (!user || user.isAdmin || !user.permissions) return;
  Object.entries(PAGE_PERMISSIONS).forEach(([page, permission]) => {
    if (user.permissions[permission] === false) {
      document.querySelector(`.bottom-nav a[href="${page}"]`)?.remove();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initLoginForm();
  initUserMenu();
  applyPersonalizedGreeting();
  enforcePagePermission();
  hideRestrictedNavItems();
});
