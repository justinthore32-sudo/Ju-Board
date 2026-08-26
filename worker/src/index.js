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

async function handleNews(request, env) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || 'monde';

  const newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=fr&sortBy=publishedAt&pageSize=20&apiKey=${env.NEWSAPI_KEY}`;
  const resp = await fetch(newsUrl, {
    headers: { 'User-Agent': 'JuBoard/1.0 (+https://justinthore32-sudo.github.io/Ju-Board/)' }
  });
  const data = await resp.json();

  return new Response(JSON.stringify(data), {
    status: resp.status,
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
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders(env), 'content-type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404, headers: corsHeaders(env) });
  }
};
