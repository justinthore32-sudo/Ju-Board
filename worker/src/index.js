/* ============================================
   JU BOARD — Proxy Worker
   Garde les clés API (Anthropic, NewsAPI) côté
   serveur. Le site GitHub Pages n'appelle que ce
   Worker, jamais les APIs directement.
   ============================================ */

const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function jsonResponse(data, env, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(env), 'content-type': 'application/json' }
  });
}

/* ---------- AUTHENTIFICATION ---------- */

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(byteLength) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const saltBytes = new Uint8Array(saltHex.match(/.{2}/g).map((b) => parseInt(b, 16)));
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

async function verifyPassword(password, saltHex, hashHex) {
  const computed = await hashPassword(password, saltHex);
  return computed === hashHex;
}

const DEFAULT_PERMISSIONS = { news: true, analyse: true, recherche: true, assistant: true };

async function ensureAdminSeeded(env) {
  const existing = await env.USERS.get('user:admin');
  if (existing) return;
  const bootstrapPassword = env.ADMIN_BOOTSTRAP_PASSWORD || '2511';
  const salt = randomHex(16);
  const hash = await hashPassword(bootstrapPassword, salt);
  await env.USERS.put('user:admin', JSON.stringify({
    username: 'admin',
    displayName: 'Justin',
    isAdmin: true,
    permissions: { ...DEFAULT_PERMISSIONS },
    salt,
    hash,
    createdAt: Date.now(),
    lastLoginAt: null,
    lastSeenAt: null
  }));
}

async function handleLogin(request, env) {
  const { username, password } = await request.json();
  if (!username || !password) return jsonResponse({ error: 'Identifiants manquants' }, env, 400);

  await ensureAdminSeeded(env);

  const userRaw = await env.USERS.get(`user:${username.toLowerCase()}`);
  if (!userRaw) return jsonResponse({ error: 'Identifiants invalides' }, env, 401);

  const user = JSON.parse(userRaw);
  const valid = await verifyPassword(password, user.salt, user.hash);
  if (!valid) return jsonResponse({ error: 'Identifiants invalides' }, env, 401);

  const now = Date.now();
  const token = randomHex(32);
  const permissions = user.permissions || DEFAULT_PERMISSIONS;

  await env.SESSIONS.put(`session:${token}`, JSON.stringify({
    username: user.username,
    displayName: user.displayName,
    isAdmin: user.isAdmin,
    permissions,
    loginAt: now
  }), { expirationTtl: 60 * 60 * 24 * 30 });

  user.lastLoginAt = now;
  user.lastSeenAt = now;
  await env.USERS.put(`user:${user.username}`, JSON.stringify(user));

  return jsonResponse({ token, username: user.username, displayName: user.displayName, isAdmin: user.isAdmin, permissions }, env);
}

async function getSession(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const raw = await env.SESSIONS.get(`session:${token}`);
  if (!raw) return null;
  const session = { token, ...JSON.parse(raw) };
  if (!session.permissions) session.permissions = DEFAULT_PERMISSIONS;
  return session;
}

/* Met à jour "dernière activité" sur la fiche utilisateur (pour le panneau
   admin) — limité à 1 écriture toutes les 2 min pour ménager les quotas KV. */
async function touchUserActivity(env, username) {
  const key = `user:${username}`;
  const raw = await env.USERS.get(key);
  if (!raw) return;
  const user = JSON.parse(raw);
  const now = Date.now();
  if (user.lastSeenAt && now - user.lastSeenAt < 2 * 60 * 1000) return;
  user.lastSeenAt = now;
  await env.USERS.put(key, JSON.stringify(user));
}

async function handleMe(request, env) {
  const session = await getSession(request, env);
  if (!session) return jsonResponse({ error: 'Non authentifié' }, env, 401);
  return jsonResponse({
    username: session.username,
    displayName: session.displayName,
    isAdmin: session.isAdmin,
    permissions: session.permissions
  }, env);
}

async function handleLogout(request, env) {
  const session = await getSession(request, env);
  if (session) await env.SESSIONS.delete(`session:${session.token}`);
  return jsonResponse({ ok: true }, env);
}

function formatDuration(ms) {
  if (!ms || ms < 0) return null;
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours}h${rem ? ` ${rem}min` : ''}`;
}

async function handleListUsers(request, env) {
  const session = await getSession(request, env);
  if (!session || !session.isAdmin) return jsonResponse({ error: 'Accès refusé' }, env, 403);

  const list = await env.USERS.list({ prefix: 'user:' });
  const users = await Promise.all(
    list.keys.map(async (k) => {
      const raw = await env.USERS.get(k.name);
      const u = JSON.parse(raw);
      const sessionDurationMs = u.lastSeenAt && u.lastLoginAt ? u.lastSeenAt - u.lastLoginAt : null;
      return {
        username: u.username,
        displayName: u.displayName,
        isAdmin: u.isAdmin,
        permissions: u.permissions || DEFAULT_PERMISSIONS,
        createdAt: u.createdAt || null,
        lastLoginAt: u.lastLoginAt || null,
        lastSeenAt: u.lastSeenAt || null,
        lastSessionDuration: formatDuration(sessionDurationMs)
      };
    })
  );
  return jsonResponse({ users }, env);
}

async function handleCreateUser(request, env) {
  const session = await getSession(request, env);
  if (!session || !session.isAdmin) return jsonResponse({ error: 'Accès refusé' }, env, 403);

  const { username, password, displayName, isAdmin, permissions } = await request.json();
  if (!username || !password) return jsonResponse({ error: 'Identifiants manquants' }, env, 400);

  const key = `user:${username.toLowerCase()}`;
  const existing = await env.USERS.get(key);
  if (existing) return jsonResponse({ error: 'Ce nom d\'utilisateur existe déjà' }, env, 409);

  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  await env.USERS.put(key, JSON.stringify({
    username: username.toLowerCase(),
    displayName: displayName || username,
    isAdmin: !!isAdmin,
    permissions: { ...DEFAULT_PERMISSIONS, ...(permissions || {}) },
    salt,
    hash,
    createdAt: Date.now(),
    lastLoginAt: null,
    lastSeenAt: null
  }));
  return jsonResponse({ ok: true }, env);
}

async function handleUpdateUser(request, env, username) {
  const session = await getSession(request, env);
  if (!session || !session.isAdmin) return jsonResponse({ error: 'Accès refusé' }, env, 403);

  const key = `user:${username.toLowerCase()}`;
  const raw = await env.USERS.get(key);
  if (!raw) return jsonResponse({ error: 'Compte introuvable' }, env, 404);
  const user = JSON.parse(raw);

  const { displayName, isAdmin, permissions, password } = await request.json();
  if (displayName !== undefined) user.displayName = displayName;
  if (isAdmin !== undefined && username.toLowerCase() !== 'admin') user.isAdmin = !!isAdmin;
  if (permissions !== undefined) user.permissions = { ...DEFAULT_PERMISSIONS, ...permissions };
  if (password) {
    const salt = randomHex(16);
    user.salt = salt;
    user.hash = await hashPassword(password, salt);
  }

  await env.USERS.put(key, JSON.stringify(user));
  return jsonResponse({ ok: true }, env);
}

async function handleDeleteUser(request, env, username) {
  const session = await getSession(request, env);
  if (!session || !session.isAdmin) return jsonResponse({ error: 'Accès refusé' }, env, 403);
  if (username.toLowerCase() === 'admin') return jsonResponse({ error: 'Impossible de supprimer le compte admin' }, env, 400);

  await env.USERS.delete(`user:${username.toLowerCase()}`);
  return jsonResponse({ ok: true }, env);
}

async function handleClaude(request, env) {
  const payload = await request.json();

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: payload.model || DEFAULT_MODEL,
      max_tokens: payload.max_tokens || 1000,
      system: payload.system,
      messages: payload.messages
    })
  });

  const data = await resp.json();
  return new Response(JSON.stringify(data), {
    status: resp.status,
    headers: { ...corsHeaders(env), 'content-type': 'application/json' }
  });
}

async function handleWeather(request, env) {
  const url = new URL(request.url);
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');

  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${env.OPENWEATHER_KEY}&units=metric&lang=fr`;
  const resp = await fetch(weatherUrl);
  const data = await resp.json();

  return new Response(JSON.stringify(data), {
    status: resp.status,
    headers: { ...corsHeaders(env), 'content-type': 'application/json' }
  });
}

/* ---------- CACHE EDGE (Cache API) ----------
   NewsAPI/Finnhub gratuits ont des quotas très bas (NewsAPI : 50 req/12h).
   La page d'accueil déclenche à elle seule ~13 requêtes NewsAPI à chaque
   chargement — sans cache le quota est épuisé en 2-3 visites. On met en
   cache la réponse brute par URL de requête (donc par combinaison de
   paramètres) pendant `ttlSeconds`, et on ne cache jamais les erreurs. */
async function cachedJsonFetch(cacheKeyUrl, fetchUrl, fetchOptions, env, ctx, ttlSeconds) {
  const cache = caches.default;
  const cacheKey = new Request(cacheKeyUrl, { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) {
    const body = await cached.text();
    return new Response(body, {
      status: cached.status,
      headers: { ...corsHeaders(env), 'content-type': 'application/json', 'X-Cache': 'HIT' }
    });
  }

  const resp = await fetch(fetchUrl, fetchOptions);
  const data = await resp.text();

  if (resp.ok) {
    const toCache = new Response(data, {
      status: resp.status,
      headers: { 'content-type': 'application/json', 'Cache-Control': `max-age=${ttlSeconds}` }
    });
    ctx.waitUntil(cache.put(cacheKey, toCache));
  }

  return new Response(data, {
    status: resp.status,
    headers: { ...corsHeaders(env), 'content-type': 'application/json', 'X-Cache': 'MISS' }
  });
}

async function handleTopHeadlines(request, env, ctx) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category') || 'general';
  const country = url.searchParams.get('country') || 'fr';

  const newsUrl = `https://newsapi.org/v2/top-headlines?category=${encodeURIComponent(category)}&country=${encodeURIComponent(country)}&pageSize=10&apiKey=${env.NEWSAPI_KEY}`;
  return cachedJsonFetch(
    url.toString(),
    newsUrl,
    { headers: { 'User-Agent': 'JuBoard/1.0 (+https://justinthore32-sudo.github.io/Ju-Board/)' } },
    env,
    ctx,
    30 * 60
  );
}

const ALLOWED_SORT = new Set(['publishedAt', 'popularity', 'relevancy']);

/* Médias reconnus uniquement — évite les blogs obscurs remontés par
   défaut par la recherche NewsAPI "everything". */
const TRUSTED_DOMAINS = [
  'lemonde.fr', 'lesechos.fr', 'lefigaro.fr', 'liberation.fr',
  'francetvinfo.fr', 'bfmtv.com', 'ouest-france.fr', 'lepoint.fr',
  'capital.fr', 'courrierinternational.com', 'la-croix.com', 'challenges.fr'
].join(',');

async function handleNews(request, env, ctx) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || 'monde';
  const sortByParam = url.searchParams.get('sortBy');
  const sortBy = ALLOWED_SORT.has(sortByParam) ? sortByParam : 'publishedAt';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const from = url.searchParams.get('from');
  const domains = url.searchParams.get('domains') || TRUSTED_DOMAINS;

  let newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=fr&sortBy=${sortBy}&pageSize=20&page=${page}&apiKey=${env.NEWSAPI_KEY}`;
  if (domains) newsUrl += `&domains=${encodeURIComponent(domains)}`;
  if (from) newsUrl += `&from=${encodeURIComponent(from)}`;

  return cachedJsonFetch(
    url.toString(),
    newsUrl,
    { headers: { 'User-Agent': 'JuBoard/1.0 (+https://justinthore32-sudo.github.io/Ju-Board/)' } },
    env,
    ctx,
    20 * 60
  );
}

const RSS_FEEDS = {
  reuters: { url: 'https://feeds.reuters.com/reuters/businessNews', name: 'Reuters' },
  lesechos: { url: 'https://www.lesechos.fr/rss/rss_une.xml', name: 'Les Échos' },
  lemonde: { url: 'https://www.lemonde.fr/rss/une.xml', name: 'Le Monde' },
  yahoo: { url: 'https://finance.yahoo.com/news/rssindex', name: 'Yahoo Finance' },
  nasa: { url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', name: 'NASA' }
};

function parseRss(xml, sourceName) {
  const items = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const block of itemBlocks) {
    const pick = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      if (!m) return '';
      return m[1]
        .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1')
        .replace(/<[^>]+>/g, '')
        .trim();
    };
    const linkMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    items.push({
      title: pick('title'),
      description: pick('description'),
      url: linkMatch ? linkMatch[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1').trim() : '',
      publishedAt: pick('pubDate'),
      source: { name: sourceName }
    });
  }
  return items;
}

async function handleRss(request, env, ctx) {
  const url = new URL(request.url);
  const feedKey = url.searchParams.get('feed') || '';
  const feed = RSS_FEEDS[feedKey];

  if (!feed) {
    return new Response(JSON.stringify({ status: 'error', message: 'Flux inconnu', available: Object.keys(RSS_FEEDS) }), {
      status: 400,
      headers: { ...corsHeaders(env), 'content-type': 'application/json' }
    });
  }

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) {
    const body = await cached.text();
    return new Response(body, { headers: { ...corsHeaders(env), 'content-type': 'application/json', 'X-Cache': 'HIT' } });
  }

  try {
    const resp = await fetch(feed.url, {
      headers: { 'User-Agent': 'JuBoard/1.0 (+https://justinthore32-sudo.github.io/Ju-Board/)' }
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const xml = await resp.text();
    const articles = parseRss(xml, feed.name).slice(0, 15);
    const payload = JSON.stringify({ status: 'ok', source: feedKey, articles });
    ctx.waitUntil(cache.put(cacheKey, new Response(payload, { headers: { 'content-type': 'application/json', 'Cache-Control': 'max-age=600' } })));
    return new Response(payload, {
      headers: { ...corsHeaders(env), 'content-type': 'application/json', 'X-Cache': 'MISS' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message, source: feedKey, articles: [] }), {
      headers: { ...corsHeaders(env), 'content-type': 'application/json' }
    });
  }
}

async function handleEarnings(request, env, ctx) {
  const url = new URL(request.url);
  const symbolsParam = url.searchParams.get('symbols') || '';
  const symbols = symbolsParam.split(',').map((s) => s.trim()).filter(Boolean);

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) {
    const body = await cached.text();
    return new Response(body, { headers: { ...corsHeaders(env), 'content-type': 'application/json', 'X-Cache': 'HIT' } });
  }

  const today = new Date();
  const from = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date(today.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const results = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const finnhubUrl = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&symbol=${encodeURIComponent(symbol)}&token=${env.FINNHUB_KEY}`;
        const resp = await fetch(finnhubUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        return { symbol, entries: data.earningsCalendar || [] };
      } catch (err) {
        return { symbol, entries: [], error: err.message };
      }
    })
  );

  const payload = JSON.stringify({ status: 'ok', results });
  ctx.waitUntil(cache.put(cacheKey, new Response(payload, { headers: { 'content-type': 'application/json', 'Cache-Control': 'max-age=10800' } })));
  return new Response(payload, {
    headers: { ...corsHeaders(env), 'content-type': 'application/json', 'X-Cache': 'MISS' }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    try {
      /* Authentification — /api/auth/login est public, tout le reste
         nécessite une session valide (protège aussi contre l'appel
         direct du Worker en dehors du site). */
      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        return await handleLogin(request, env);
      }
      if (url.pathname === '/api/auth/me' && request.method === 'GET') {
        return await handleMe(request, env);
      }
      if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
        return await handleLogout(request, env);
      }
      if (url.pathname === '/api/auth/users' && request.method === 'GET') {
        return await handleListUsers(request, env);
      }
      if (url.pathname === '/api/auth/users' && request.method === 'POST') {
        return await handleCreateUser(request, env);
      }
      if (url.pathname.startsWith('/api/auth/users/') && request.method === 'DELETE') {
        return await handleDeleteUser(request, env, decodeURIComponent(url.pathname.slice('/api/auth/users/'.length)));
      }
      if (url.pathname.startsWith('/api/auth/users/') && request.method === 'PATCH') {
        return await handleUpdateUser(request, env, decodeURIComponent(url.pathname.slice('/api/auth/users/'.length)));
      }

      if (url.pathname.startsWith('/api/') && url.pathname !== '/api/auth/login') {
        const session = await getSession(request, env);
        if (!session) return jsonResponse({ error: 'Non authentifié' }, env, 401);
        ctx.waitUntil(touchUserActivity(env, session.username));
      }

      if (url.pathname === '/api/claude' && request.method === 'POST') {
        return await handleClaude(request, env);
      }
      if (url.pathname === '/api/news' && request.method === 'GET') {
        return await handleNews(request, env, ctx);
      }
      if (url.pathname === '/api/top-headlines' && request.method === 'GET') {
        return await handleTopHeadlines(request, env, ctx);
      }
      if (url.pathname === '/api/weather' && request.method === 'GET') {
        return await handleWeather(request, env);
      }
      if (url.pathname === '/api/rss' && request.method === 'GET') {
        return await handleRss(request, env, ctx);
      }
      if (url.pathname === '/api/earnings' && request.method === 'GET') {
        return await handleEarnings(request, env, ctx);
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders(env), 'content-type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404, headers: corsHeaders(env) });
  }
};
