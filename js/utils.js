/* ============================================
   JU BOARD — utils.js
   Fonctions utilitaires : thème, date, toast
   ============================================ */

/* ---------- THEME DARK/LIGHT ---------- */
function initTheme() {
  const saved = localStorage.getItem('ju-board-theme');
  const theme = saved || 'light';
  applyTheme(theme);

  const switchBtn = document.getElementById('theme-switch');
  if (switchBtn) {
    switchBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem('ju-board-theme', next);
    });
  }
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

/* ---------- DATE FRANÇAISE ---------- */
function setGreetingDate() {
  const el = document.getElementById('greeting-date');
  if (!el) return;
  const formatted = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  el.textContent = formatted;
}

/* ---------- TOAST ---------- */
function showToast(message, duration = 2500) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('active');
  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    toast.classList.remove('active');
  }, duration);
}

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setGreetingDate();
});
