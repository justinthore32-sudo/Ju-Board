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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
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

async function handleTopHeadlines(request, env) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category') || 'general';
  const country = url.searchParams.get('country') || 'fr';

  const newsUrl = `https://newsapi.org/v2/top-headlines?category=${encodeURIComponent(category)}&country=${encodeURIComponent(country)}&pageSize=10&apiKey=${env.NEWSAPI_KEY}`;
  const resp = await fetch(newsUrl, {
    headers: { 'User-Agent': 'JuBoard/1.0 (+https://justinthore32-sudo.github.io/Ju-Board/)' }
  });
  const data = await resp.json();

  return new Response(JSON.stringify(data), {
    status: resp.status,
    headers: { ...corsHeaders(env), 'content-type': 'application/json' }
  });
}

const ALLOWED_SORT = new Set(['publishedAt', 'popularity', 'relevancy']);

/* Médias reconnus uniquement — évite les blogs obscurs remontés par
   défaut par la recherche NewsAPI "everything". */
const TRUSTED_DOMAINS = [
  'lemonde.fr', 'lesechos.fr', 'lefigaro.fr', 'liberation.fr',
  'francetvinfo.fr', 'bfmtv.com', 'ouest-france.fr', 'lepoint.fr',
  'capital.fr', 'courrierinternational.com', 'la-croix.com', 'challenges.fr'
].join(',');

async function handleNews(request, env) {
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

  const resp = await fetch(newsUrl, {
    headers: { 'User-Agent': 'JuBoard/1.0 (+https://justinthore32-sudo.github.io/Ju-Board/)' }
  });
  const data = await resp.json();

  return new Response(JSON.stringify(data), {
    status: resp.status,
    headers: { ...corsHeaders(env), 'content-type': 'application/json' }
  });
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

async function handleRss(request, env) {
  const url = new URL(request.url);
  const feedKey = url.searchParams.get('feed') || '';
  const feed = RSS_FEEDS[feedKey];

  if (!feed) {
    return new Response(JSON.stringify({ status: 'error', message: 'Flux inconnu', available: Object.keys(RSS_FEEDS) }), {
      status: 400,
      headers: { ...corsHeaders(env), 'content-type': 'application/json' }
    });
  }

  try {
    const resp = await fetch(feed.url, {
      headers: { 'User-Agent': 'JuBoard/1.0 (+https://justinthore32-sudo.github.io/Ju-Board/)' }
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const xml = await resp.text();
    const articles = parseRss(xml, feed.name).slice(0, 15);
    return new Response(JSON.stringify({ status: 'ok', source: feedKey, articles }), {
      headers: { ...corsHeaders(env), 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message, source: feedKey, articles: [] }), {
      headers: { ...corsHeaders(env), 'content-type': 'application/json' }
    });
  }
}

async function handleEarnings(request, env) {
  const url = new URL(request.url);
  const symbolsParam = url.searchParams.get('symbols') || '';
  const symbols = symbolsParam.split(',').map((s) => s.trim()).filter(Boolean);

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

  return new Response(JSON.stringify({ status: 'ok', results }), {
    headers: { ...corsHeaders(env), 'content-type': 'application/json' }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    try {
      if (url.pathname === '/api/claude' && request.method === 'POST') {
        return await handleClaude(request, env);
      }
      if (url.pathname === '/api/news' && request.method === 'GET') {
        return await handleNews(request, env);
      }
      if (url.pathname === '/api/top-headlines' && request.method === 'GET') {
        return await handleTopHeadlines(request, env);
      }
      if (url.pathname === '/api/weather' && request.method === 'GET') {
        return await handleWeather(request, env);
      }
      if (url.pathname === '/api/rss' && request.method === 'GET') {
        return await handleRss(request, env);
      }
      if (url.pathname === '/api/earnings' && request.method === 'GET') {
        return await handleEarnings(request, env);
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
