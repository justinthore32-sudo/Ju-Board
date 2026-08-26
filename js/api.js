/* ============================================
   JU BOARD — api.js
   Appels API centralisés.

   Anthropic (chat + analyses) et NewsAPI passent par
   le Worker proxy (clés gardées côté serveur — voir
   /worker). OpenWeatherMap reste appelé directement
   depuis le client : c'est son usage prévu (clé
   gratuite, géolocalisation) et le risque d'abus en
   cas de fuite est négligeable.
   ============================================ */

/* URL du Worker déployé — à remplacer une fois `wrangler deploy` fait.
   Exemple : 'https://ju-board-proxy.TON-SOUS-DOMAINE.workers.dev' */
const PROXY_URL = 'https://ju-board-proxy.YOUR-SUBDOMAIN.workers.dev';

/* Clé OpenWeatherMap gratuite — openweathermap.org */
const OPENWEATHER_KEY = 'REMPLACE_MOI';

/* ---------- ANTHROPIC (via proxy) ---------- */
async function callClaude(messages, { system, maxTokens = 1000 } = {}) {
  const resp = await fetch(`${PROXY_URL}/api/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, system, max_tokens: maxTokens })
  });
  if (!resp.ok) throw new Error(`Erreur API Claude (${resp.status})`);
  return resp.json();
}

/* ---------- NEWSAPI (via proxy) ---------- */
async function fetchNews(query) {
  const resp = await fetch(`${PROXY_URL}/api/news?q=${encodeURIComponent(query)}`);
  if (!resp.ok) throw new Error(`Erreur NewsAPI (${resp.status})`);
  return resp.json();
}

/* ---------- OPENWEATHERMAP (direct) ---------- */
async function fetchWeather(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_KEY}&units=metric&lang=fr`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Erreur météo (${resp.status})`);
  const data = await resp.json();
  return {
    temp: Math.round(data.main.temp),
    icon: data.weather[0].icon,
    description: data.weather[0].description
  };
}

function getWeatherForCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Géolocalisation non disponible'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchWeather(pos.coords.latitude, pos.coords.longitude).then(resolve).catch(reject);
      },
      (err) => reject(err),
      { timeout: 8000 }
    );
  });
}
