/* ============================================
   JU BOARD — api.js
   Appels API centralisés.

   Toutes les APIs externes (Anthropic, NewsAPI,
   OpenWeatherMap, RSS, Finnhub) passent par le Worker
   proxy (clés gardées côté serveur — voir /worker).
   Chaque appel est authentifié par le token de session
   (voir js/auth.js) — le Worker refuse toute requête
   sans session valide.
   ============================================ */

const PROXY_URL = 'https://ju-board-proxy.ju-board-justin.workers.dev';
const AUTH_TOKEN_KEY = 'ju-board-token';
const AUTH_USER_KEY = 'ju-board-user';

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null');
  } catch (err) {
    return null;
  }
}

function setSession(token, user) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

function authHeaders(extra = {}) {
  const token = getAuthToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

async function apiFetch(path, options = {}) {
  const resp = await fetch(`${PROXY_URL}${path}`, {
    ...options,
    headers: authHeaders(options.headers || {})
  });
  if (resp.status === 401) {
    clearSession();
    if (!window.location.pathname.endsWith('login.html')) {
      window.location.href = 'login.html';
    }
  }
  return resp;
}

/* ---------- AUTHENTIFICATION ---------- */
async function login(username, password) {
  const resp = await fetch(`${PROXY_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Erreur de connexion');
  setSession(data.token, { username: data.username, displayName: data.displayName, isAdmin: data.isAdmin });
  return data;
}

async function logout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    /* on efface la session locale même si l'appel échoue */
  }
  clearSession();
}

async function fetchUsers() {
  const resp = await apiFetch('/api/auth/users');
  if (!resp.ok) throw new Error('Erreur chargement utilisateurs');
  return resp.json();
}

async function createUser(username, password, displayName, isAdmin) {
  const resp = await apiFetch('/api/auth/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, displayName, isAdmin })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Erreur de création');
  return data;
}

async function updateUserPermissions(username, permissions) {
  const resp = await apiFetch(`/api/auth/users/${encodeURIComponent(username)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissions })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Erreur de mise à jour');
  return data;
}

async function deleteUser(username) {
  const resp = await apiFetch(`/api/auth/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Erreur de suppression');
  return data;
}

/* ---------- ANTHROPIC (via proxy) ---------- */
async function callClaude(messages, { system, maxTokens = 1000 } = {}) {
  const resp = await apiFetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, system, max_tokens: maxTokens })
  });
  if (!resp.ok) throw new Error(`Erreur API Claude (${resp.status})`);
  return resp.json();
}

/* ---------- NEWSAPI (via proxy) ---------- */
async function fetchNews(query, { sortBy = 'publishedAt', page = 1, from, domains } = {}) {
  const params = new URLSearchParams({ q: query, sortBy, page });
  if (from) params.set('from', from);
  if (domains) params.set('domains', domains);
  const resp = await apiFetch(`/api/news?${params.toString()}`);
  if (!resp.ok) throw new Error(`Erreur NewsAPI (${resp.status})`);
  return resp.json();
}

/* ---------- FLUX RSS (via proxy) ---------- */
async function fetchRss(feedKey) {
  const resp = await apiFetch(`/api/rss?feed=${encodeURIComponent(feedKey)}`);
  if (!resp.ok) throw new Error(`Erreur RSS (${resp.status})`);
  return resp.json();
}

/* ---------- CALENDRIER DES RÉSULTATS (Finnhub, via proxy) ---------- */
async function fetchEarnings(symbols) {
  const resp = await apiFetch(`/api/earnings?symbols=${encodeURIComponent(symbols.join(','))}`);
  if (!resp.ok) throw new Error(`Erreur calendrier résultats (${resp.status})`);
  return resp.json();
}

async function fetchTopHeadlines(category = 'general') {
  const resp = await apiFetch(`/api/top-headlines?category=${encodeURIComponent(category)}&country=fr`);
  if (!resp.ok) throw new Error(`Erreur NewsAPI (${resp.status})`);
  return resp.json();
}

/* ---------- OPENWEATHERMAP (via proxy) ---------- */
async function fetchWeather(lat, lon) {
  const resp = await apiFetch(`/api/weather?lat=${lat}&lon=${lon}`);
  if (!resp.ok) throw new Error(`Erreur météo (${resp.status})`);
  const data = await resp.json();
  return {
    temp: Math.round(data.main.temp),
    icon: data.weather[0].icon,
    description: data.weather[0].description
  };
}

/* ---------- LIEN VERS LA FICHE INTERNE (au lieu de l'article externe direct) ---------- */
function buildArticleUrl(article, timeLabel) {
  const cleanContent = (article.content || '').replace(/\s*\[\+\d+ chars\]$/, '');
  const params = new URLSearchParams({
    title: article.title || '',
    description: article.description || '',
    content: cleanContent,
    source: article.source?.name || 'Actualité',
    url: article.url || '',
    time: timeLabel || ''
  });
  return `article.html?${params.toString()}`;
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
