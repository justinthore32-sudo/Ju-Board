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

/* ---------- MÉTÉO (cache 30 min) ---------- */
const WEATHER_ICONS = {
  '01d': '☀️', '01n': '🌙', '02d': '⛅', '02n': '⛅',
  '03d': '☁️', '03n': '☁️', '04d': '☁️', '04n': '☁️',
  '09d': '🌧️', '09n': '🌧️', '10d': '🌦️', '10n': '🌦️',
  '11d': '⛈️', '11n': '⛈️', '13d': '❄️', '13n': '❄️',
  '50d': '🌫️', '50n': '🌫️'
};

async function setWeather() {
  const iconEl = document.getElementById('weather-icon');
  const tempEl = document.getElementById('weather-temp');
  if (!iconEl || !tempEl) return;

  const cached = JSON.parse(localStorage.getItem('ju-board-weather') || 'null');
  const now = Date.now();
  if (cached && now - cached.timestamp < 30 * 60 * 1000) {
    iconEl.textContent = cached.icon;
    tempEl.textContent = `${cached.temp}°C`;
    return;
  }

  if (typeof getWeatherForCurrentLocation !== 'function') return;

  try {
    const weather = await getWeatherForCurrentLocation();
    const emoji = WEATHER_ICONS[weather.icon] || '☀️';
    iconEl.textContent = emoji;
    tempEl.textContent = `${weather.temp}°C`;
    localStorage.setItem('ju-board-weather', JSON.stringify({
      icon: emoji,
      temp: weather.temp,
      timestamp: now
    }));
  } catch (err) {
    /* Géolocalisation refusée ou clé API absente — on garde le placeholder */
  }
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
  setWeather();
});
