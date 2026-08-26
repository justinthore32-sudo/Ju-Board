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

const PROXY_URL = 'https://ju-board-proxy.ju-board-justin.workers.dev';

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
async function fetchNews(query, { sortBy = 'publishedAt', page = 1, from } = {}) {
  const params = new URLSearchParams({ q: query, sortBy, page });
  if (from) params.set('from', from);
  const resp = await fetch(`${PROXY_URL}/api/news?${params.toString()}`);
  if (!resp.ok) throw new Error(`Erreur NewsAPI (${resp.status})`);
  return resp.json();
}

/* ---------- FLUX RSS (via proxy) ---------- */
async function fetchRss(feedKey) {
  const resp = await fetch(`${PROXY_URL}/api/rss?feed=${encodeURIComponent(feedKey)}`);
  if (!resp.ok) throw new Error(`Erreur RSS (${resp.status})`);
  return resp.json();
}

/* ---------- CALENDRIER DES RÉSULTATS (Finnhub, via proxy) ---------- */
async function fetchEarnings(symbols) {
  const resp = await fetch(`${PROXY_URL}/api/earnings?symbols=${encodeURIComponent(symbols.join(','))}`);
  if (!resp.ok) throw new Error(`Erreur calendrier résultats (${resp.status})`);
  return resp.json();
}

async function fetchTopHeadlines(category = 'general') {
  const resp = await fetch(`${PROXY_URL}/api/top-headlines?category=${encodeURIComponent(category)}&country=fr`);
  if (!resp.ok) throw new Error(`Erreur NewsAPI (${resp.status})`);
  return resp.json();
}

/* ---------- OPENWEATHERMAP (via proxy) ---------- */
async function fetchWeather(lat, lon) {
  const resp = await fetch(`${PROXY_URL}/api/weather?lat=${lat}&lon=${lon}`);
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
