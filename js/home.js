/* ============================================
   JU BOARD — home.js
   Page Accueil : Priorité Absolue, À ne pas manquer
   et grille des secteurs — vraies news (NewsAPI +
   flux RSS Le Monde / NASA).

   Pas encore d'IA branchée : la sélection "priorité"
   et "positif" utilise des requêtes ciblées en
   attendant un vrai tri par importance/impact via Claude.
   ============================================ */

const SECTORS = [
  { icon: '💰', name: 'Économie', query: 'économie OR marchés financiers OR banque centrale', param: 'economie' },
  { icon: '🌍', name: 'Géopolitique', query: 'géopolitique OR diplomatie OR conflit international', param: 'geopolitique' },
  { icon: '💻', name: 'Tech & IA', query: 'intelligence artificielle OR technologie', param: 'tech' },
  { icon: '🌱', name: 'Environnement', query: 'climat OR environnement', param: 'environnement' },
  { icon: '🏛️', name: 'Politique', query: 'politique France OR Europe', param: 'politique' },
  { icon: '💊', name: 'Santé', query: 'santé OR médecine OR vaccin', param: 'sante' },
  { icon: '🚀', name: 'Spatial', query: 'espace OR spatial OR NASA', param: 'spatial', rss: 'nasa' },
  { icon: '⚡', name: 'Énergie', query: 'énergie OR pétrole OR nucléaire', param: 'energie' },
  { icon: '📚', name: 'Histoire', query: 'histoire', param: 'histoire' },
  { icon: '🎭', name: 'Société', query: 'société', param: 'societe' }
];

function timeAgo(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `Il y a ${Math.max(mins, 1)} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.round(hours / 24);
  return `Il y a ${days}j`;
}

function renderNewsBlock(article) {
  const link = buildArticleUrl(article, timeAgo(article.publishedAt));
  return `
    <div class="priority-news">
      <div class="news-meta">
        <span class="sector-badge">🌐 ${article.source?.name || 'Actualité'}</span>
        <span>${timeAgo(article.publishedAt)}</span>
      </div>
      <a href="${link}" style="text-decoration: none;">
        <h3 class="news-title">${article.title || 'Sans titre'}</h3>
      </a>
      <p class="news-summary">${article.description || ''}</p>
      <a class="btn-expand" href="${link}">Lire plus →</a>
    </div>`;
}

async function loadNewsBlock(containerId, query, { count = 3, rssFeed } = {}) {
  const container = document.getElementById(containerId);
  if (!container || typeof fetchNews !== 'function') return;

  try {
    const [newsData, rssData] = await Promise.all([
      fetchNews(query).catch(() => ({ status: 'error', articles: [] })),
      rssFeed && typeof fetchRss === 'function' ? fetchRss(rssFeed).catch(() => ({ status: 'error', articles: [] })) : Promise.resolve({ status: 'error', articles: [] })
    ]);

    const newsArticles = (newsData.articles || []).filter((a) => a.title && a.title !== '[Removed]');
    const rssArticles = (rssData.articles || []).filter((a) => a.title);

    const merged = [...rssArticles, ...newsArticles]
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, count);

    if (merged.length === 0) {
      container.innerHTML = '<p style="color: var(--text3); font-size: 13px;">Aucune actualité disponible pour le moment.</p>';
      return;
    }
    container.innerHTML = merged.map(renderNewsBlock).join('');
  } catch (err) {
    container.innerHTML = `<p style="color: var(--red); font-size: 13px;">Erreur de chargement : ${err.message}</p>`;
  }
}

async function loadSectors() {
  const grid = document.getElementById('sectors-grid');
  if (!grid || typeof fetchNews !== 'function') return;

  const results = await Promise.all(
    SECTORS.map(async (sector) => {
      try {
        if (sector.rss && typeof fetchRss === 'function') {
          const rssData = await fetchRss(sector.rss).catch(() => null);
          const rssArticle = rssData?.articles?.[0];
          if (rssArticle) return { sector, headline: rssArticle.title };
        }
        const data = await fetchNews(sector.query);
        const article = (data.articles || []).find((a) => a.title && a.title !== '[Removed]');
        return { sector, headline: article ? article.title : "Pas d'actualité pour le moment" };
      } catch (err) {
        return { sector, headline: 'Erreur de chargement' };
      }
    })
  );

  grid.innerHTML = results.map(({ sector, headline }) => `
    <a href="news.html?secteur=${sector.param}" class="card sector-card">
      <span class="sector-icon">${sector.icon}</span>
      <span class="sector-name">${sector.name}</span>
      <span class="sector-headline">${headline}</span>
    </a>`).join('');
}

const EARNINGS_COMPANIES = [
  // Tech
  { name: 'Apple', symbol: 'AAPL', slug: 'apple' },
  { name: 'Nvidia', symbol: 'NVDA', slug: 'nvidia' },
  { name: 'Microsoft', symbol: 'MSFT' },
  { name: 'Alphabet (Google)', symbol: 'GOOGL' },
  { name: 'Amazon', symbol: 'AMZN' },
  { name: 'Meta', symbol: 'META' },
  { name: 'Tesla', symbol: 'TSLA' },
  { name: 'Intel', symbol: 'INTC' },
  { name: 'AMD', symbol: 'AMD' },
  // Finance
  { name: 'JPMorgan Chase', symbol: 'JPM', slug: 'jpmorgan-chase' },
  { name: 'Goldman Sachs', symbol: 'GS' },
  { name: 'BlackRock', symbol: 'BLK' },
  { name: 'Visa', symbol: 'V' },
  { name: 'Mastercard', symbol: 'MA' },
  // Santé
  { name: 'UnitedHealth', symbol: 'UNH' },
  { name: 'Pfizer', symbol: 'PFE' },
  { name: 'Johnson & Johnson', symbol: 'JNJ' },
  { name: 'Moderna', symbol: 'MRNA' },
  // Industrie & énergie
  { name: 'LVMH', symbol: 'MC.PA', slug: 'lvmh' },
  { name: 'ExxonMobil', symbol: 'XOM', slug: 'exxonmobil' },
  { name: 'Saudi Aramco', symbol: '2222.SR', slug: 'saudi-aramco' }
];

function formatEarningsDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function beatOrMiss(actual, estimate) {
  if (actual == null || estimate == null) return null;
  return actual >= estimate ? 'beat' : 'miss';
}

async function loadEarnings() {
  const upcomingEl = document.getElementById('earnings-upcoming');
  const latestEl = document.getElementById('earnings-latest');
  if (!upcomingEl || !latestEl || typeof fetchEarnings !== 'function') return;

  try {
    const symbols = EARNINGS_COMPANIES.map((c) => c.symbol);
    const data = await fetchEarnings(symbols);
    const todayStr = new Date().toISOString().slice(0, 10);

    const upcoming = [];
    const latest = [];

    EARNINGS_COMPANIES.forEach((company) => {
      const result = data.results?.find((r) => r.symbol === company.symbol);
      const entries = (result?.entries || []).slice().sort((a, b) => a.date.localeCompare(b.date));

      const next = entries.find((e) => e.date >= todayStr);
      if (next) upcoming.push({ company, entry: next });

      const past = entries.filter((e) => e.date < todayStr && e.epsActual != null).pop();
      if (past) latest.push({ company, entry: past });
    });

    upcoming.sort((a, b) => a.entry.date.localeCompare(b.entry.date));
    latest.sort((a, b) => b.entry.date.localeCompare(a.entry.date));

    const companyHref = (company) => company.slug ? `analyse.html#company-${company.slug}` : 'analyse.html';

    upcomingEl.innerHTML = upcoming.length === 0
      ? '<p style="color: var(--text3); font-size: 12px;">Aucune date connue pour le moment.</p>'
      : upcoming.slice(0, 8).map(({ company, entry }) => `
        <a href="${companyHref(company)}" class="card earnings-item">
          <div class="earnings-item-left">
            <span class="earnings-company">${company.name}</span>
            <span class="earnings-date">${formatEarningsDate(entry.date)} · T${entry.quarter} ${entry.year}</span>
          </div>
          <span class="earnings-figures"><span class="inline">${entry.hour === 'bmo' ? 'Avant ouverture' : entry.hour === 'amc' ? 'Après clôture' : ''}</span></span>
        </a>`).join('');

    latestEl.innerHTML = latest.length === 0
      ? '<p style="color: var(--text3); font-size: 12px;">Aucun résultat récent disponible.</p>'
      : latest.slice(0, 8).map(({ company, entry }) => {
        const status = beatOrMiss(entry.epsActual, entry.epsEstimate);
        const statusLabel = status === 'beat' ? '↑ Au-dessus des attentes' : status === 'miss' ? '↓ En dessous des attentes' : '';
        return `
          <a href="${companyHref(company)}" class="card earnings-item">
            <div class="earnings-item-left">
              <span class="earnings-company">${company.name}</span>
              <span class="earnings-date">${formatEarningsDate(entry.date)} · T${entry.quarter} ${entry.year}</span>
            </div>
            <span class="earnings-figures">
              <span>EPS ${entry.epsActual ?? '–'} / est. ${entry.epsEstimate ?? '–'}</span>
              ${statusLabel ? `<span class="${status}">${statusLabel}</span>` : ''}
            </span>
          </a>`;
      }).join('');
  } catch (err) {
    upcomingEl.innerHTML = `<p style="color: var(--red); font-size: 12px;">Erreur : ${err.message}</p>`;
    latestEl.innerHTML = '';
  }
}

function refreshHome() {
  loadNewsBlock('priority-list', 'marchés financiers OR investissement OR bourse OR matières premières OR métaux OR taux d\'intérêt OR banque centrale', { count: 6, rssFeed: 'lemonde' });
  loadNewsBlock('highlight-list', 'découverte OR avancée scientifique OR record positif', { count: 3 });
  loadNewsBlock('world-list', 'international OR politique OR économie OR monde', { count: 5 });
  loadSectors();
  loadEarnings();
}

window.juBoardRefresh = refreshHome;

document.addEventListener('DOMContentLoaded', refreshHome);
