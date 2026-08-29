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

/* ---------- TAG D'IMPACT MARCHÉ (mots-clés, sans IA) ----------
   Premier niveau de tri avant qu'une vraie analyse Anthropic soit
   branchée : un dictionnaire pondéré suffit à repérer les articles qui
   ont statistiquement plus de chances de bouger les marchés. */
const IMPACT_KEYWORDS_FORT = [
  'fed', 'bce', 'banque centrale', 'taux directeur', 'opep', 'inflation',
  'récession', 'fusion', 'acquisition', 'faillite', 'défaut de paiement',
  'krach', 'crash boursier', 'sanctions', 'nucléaire', 'guerre'
];
const IMPACT_KEYWORDS_MOYEN = [
  'résultats', 'bénéfice', 'chiffre d\'affaires', 'pib', 'chômage',
  'élection', 'tarifs douaniers', 'accord commercial', 'grève', 'opa'
];

function getImpactLevel(article) {
  const text = `${article?.title || ''} ${article?.description || ''}`.toLowerCase();
  if (IMPACT_KEYWORDS_FORT.some((k) => text.includes(k))) return 'fort';
  if (IMPACT_KEYWORDS_MOYEN.some((k) => text.includes(k))) return 'moyen';
  return null;
}

function impactBadgeHtml(article) {
  const level = getImpactLevel(article);
  if (level === 'fort') return '<span class="impact-badge impact-fort">🔴 Impact fort</span>';
  if (level === 'moyen') return '<span class="impact-badge impact-moyen">🟠 Impact modéré</span>';
  return '';
}

/* ---------- GLOSSAIRE CLIQUABLE ----------
   Même liste de termes que search.js (dupliquée volontairement : ici on
   matche par regex dans le texte des news, là-bas par recherche tapée —
   deux usages différents, pas la peine de coupler les deux fichiers). */
const GLOSSARY_TERMS = [
  { term: 'Quantitative tightening', definition: "Politique monétaire par laquelle une banque centrale réduit la taille de son bilan, à l'inverse du quantitative easing.", pattern: /quantitative tightening/i },
  { term: 'Quantitative easing', definition: "Politique monétaire non conventionnelle où une banque centrale achète des actifs financiers pour injecter des liquidités dans l'économie.", pattern: /quantitative easing/i },
  { term: 'PER (Price Earnings Ratio)', definition: 'Ratio cours sur bénéfice — mesure combien de fois le bénéfice annuel les investisseurs sont prêts à payer pour une action.', pattern: /\bPER\b/ },
  { term: 'ROE (Return on Equity)', definition: "Rentabilité des capitaux propres — mesure la capacité d'une entreprise à générer du profit avec l'argent de ses actionnaires.", pattern: /\bROE\b/ },
  { term: 'OPEP+', definition: 'Organisation des pays exportateurs de pétrole élargie à des alliés comme la Russie, qui coordonne les niveaux de production mondiaux.', pattern: /opep\+?/i },
  { term: 'Cycle économique', definition: "Alternance de phases d'expansion, de pic, de contraction et de reprise que traverse une économie ou une entreprise dans le temps.", pattern: /cycle économique/i },
  { term: 'Inflation', definition: "Hausse générale et durable des prix, qui réduit le pouvoir d'achat de la monnaie.", pattern: /\binflation\b/i },
  { term: 'PIB (Produit Intérieur Brut)', definition: "Valeur totale des biens et services produits dans un pays sur une période donnée — indicateur clé de l'activité économique.", pattern: /\bPIB\b/ },
  { term: 'Taux directeur', definition: "Taux d'intérêt fixé par une banque centrale, qui influence le coût du crédit dans toute l'économie.", pattern: /taux directeur/i },
  { term: 'Géopolitique', definition: 'Étude des rapports entre la géographie, le pouvoir et les relations internationales entre États.', pattern: /géopolitique/i }
];

function escapeHtmlText(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* Entoure le premier terme de glossaire trouvé dans un texte d'un <span>
   cliquable — un seul par appel pour ne pas saturer les cartes de tags. */
function linkifyGlossary(text) {
  const safe = escapeHtmlText(text);
  for (const g of GLOSSARY_TERMS) {
    if (g.pattern.test(safe)) {
      return safe.replace(g.pattern, (match) => `<span class="glossary-term" data-term="${encodeURIComponent(g.term)}">${match}</span>`);
    }
  }
  return safe;
}

function initGlossaryTooltips() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('.glossary-term');
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const term = decodeURIComponent(el.dataset.term || '');
    const entry = GLOSSARY_TERMS.find((g) => g.term === term);
    if (entry && typeof showToast === 'function') {
      showToast(`📖 ${entry.term} — ${entry.definition}`, 6000);
    }
  });
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
  initGlossaryTooltips();
});
