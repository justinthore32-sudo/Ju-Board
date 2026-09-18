/* ============================================
   JU BOARD — home.js
   Page Accueil : Priorité Absolue, À ne pas manquer
   et grille des secteurs — vraies news (NewsAPI +
   flux RSS Le Monde / NASA).

   Pas encore d'IA branchée : la sélection "priorité"
   et "positif" utilise des requêtes ciblées en
   attendant un vrai tri par importance/impact via Claude.
   ============================================ */

/* Indices/devises/matières premières via des ETF proxies (Finnhub /quote,
   même clé que la watchlist — pas de nouvelle API nécessaire). Finnhub
   gratuit ne donne pas les vrais indices (^GSPC etc. renvoient vide),
   mais les ETF qui les répliquent sont des actions normales, couvertes
   sans restriction. */
const MARKET_TICKERS = [
  { symbol: 'SPY', label: 'S&P 500' },
  { symbol: 'QQQ', label: 'Nasdaq' },
  { symbol: 'EWQ', label: 'CAC 40*' },
  { symbol: 'EWG', label: 'DAX*' },
  { symbol: 'GLD', label: 'Or' },
  { symbol: 'USO', label: 'Pétrole' },
  { symbol: 'UUP', label: 'Dollar' },
  { symbol: 'VIXY', label: 'Volatilité' }
];

async function loadMarketTicker() {
  const el = document.getElementById('market-ticker');
  if (!el || typeof fetchStockQuotes !== 'function') return;

  try {
    const data = await fetchStockQuotes(MARKET_TICKERS.map((t) => t.symbol));
    const bySymbol = {};
    (data.results || []).forEach((r) => { bySymbol[r.symbol] = r; });

    el.innerHTML = MARKET_TICKERS.map((t) => {
      const q = bySymbol[t.symbol];
      if (!q || q.error) {
        return `<div class="market-item"><span class="market-item-label">${t.label}</span><span class="market-item-value">—</span></div>`;
      }
      const dir = q.change > 0 ? 'up' : q.change < 0 ? 'down' : 'neutral';
      const sign = q.change > 0 ? '+' : '';
      return `
        <div class="market-item">
          <span class="market-item-label">${t.label}</span>
          <span class="market-item-value">${q.price.toFixed(2)}</span>
          <span class="market-item-change ${dir}">${sign}${q.changePercent.toFixed(2)}%</span>
        </div>`;
    }).join('');
  } catch (err) {
    el.innerHTML = '<p style="color: var(--text3); font-size: 12px;">Marchés indisponibles pour le moment.</p>';
  }
}

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
        ${typeof impactBadgeHtml === 'function' ? impactBadgeHtml(article) : ''}
      </div>
      <a href="${link}" style="text-decoration: none;">
        <h3 class="news-title">${typeof linkifyGlossary === 'function' ? linkifyGlossary(article.title || 'Sans titre') : (article.title || 'Sans titre')}</h3>
      </a>
      <p class="news-summary">${typeof linkifyGlossary === 'function' ? linkifyGlossary(article.description || '') : (article.description || '')}</p>
      <a class="btn-expand" href="${link}">Lire plus →</a>
    </div>`;
}

async function loadNewsBlock(containerId, query, { count = 3, rssFeed, domains, rankByImpact = false } = {}) {
  const container = document.getElementById(containerId);
  if (!container || typeof fetchNews !== 'function') return;

  let newsFailed = false;
  try {
    const [newsData, rssData] = await Promise.all([
      fetchNews(query, { sortBy: 'publishedAt', domains, pageSize: rankByImpact ? 30 : undefined }).catch(() => { newsFailed = true; return { status: 'error', articles: [] }; }),
      rssFeed && typeof fetchRss === 'function' ? fetchRss(rssFeed).catch(() => ({ status: 'error', articles: [] })) : Promise.resolve({ status: 'error', articles: [] })
    ]);

    const newsArticles = (newsData.articles || []).filter((a) => a.title && a.title !== '[Removed]');
    const rssArticles = (rssData.articles || []).filter((a) => a.title);

    let merged = [...rssArticles, ...newsArticles].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    /* Priorité Absolue tire maintenant sur des domaines plus larges (dont
       BFMTV, généraliste) pour avoir assez de volume — sans ce reclassement,
       un article de foot mentionnant "acquisition" au détour d'un transfert
       remonterait au même niveau qu'une vraie news de marché. On repasse le
       lot par le même détecteur de mots-clés que le badge d'impact. */
    if (rankByImpact && typeof getImpactLevel === 'function') {
      const rank = (a) => { const lvl = getImpactLevel(a); return lvl === 'fort' ? 2 : lvl === 'moyen' ? 1 : 0; };
      merged = merged.slice().sort((a, b) => rank(b) - rank(a));
    }

    merged = merged.slice(0, count);

    if (merged.length === 0) {
      container.innerHTML = newsFailed
        ? '<p style="color: var(--gold); font-size: 13px;">⚠️ Actualités temporairement indisponibles (quota NewsAPI atteint) — réessaie dans quelques minutes.</p>'
        : '<p style="color: var(--text3); font-size: 13px;">Aucune actualité disponible pour le moment.</p>';
      return;
    }
    container.innerHTML = merged.map(renderNewsBlock).join('');
  } catch (err) {
    container.innerHTML = `<p style="color: var(--red); font-size: 13px;">Erreur de chargement : ${err.message}</p>`;
  }
}

/* Un seul appel NewsAPI groupant tous les secteurs au lieu d'un appel par
   secteur (10 requêtes -> 1) : le quota gratuit (50/12h) ne survivait pas
   à 2-3 visites de l'accueil sinon. On matche ensuite chaque secteur par
   mot-clé dans les résultats déjà récupérés. */
async function loadSectors() {
  const grid = document.getElementById('sectors-grid');
  if (!grid || typeof fetchNews !== 'function') return;

  const combinedQuery = SECTORS.map((s) => s.query).join(' OR ');
  let combinedArticles = [];
  try {
    const data = await fetchNews(combinedQuery, { pageSize: 50 });
    combinedArticles = (data.articles || []).filter((a) => a.title && a.title !== '[Removed]');
  } catch (err) {
    combinedArticles = [];
  }

  function matchSector(sector) {
    const keywords = sector.query.split(' OR ').map((k) => k.trim().toLowerCase()).filter(Boolean);
    return combinedArticles.find((a) => {
      const text = `${a.title} ${a.description || ''}`.toLowerCase();
      return keywords.some((k) => text.includes(k));
    });
  }

  const results = await Promise.all(
    SECTORS.map(async (sector) => {
      if (sector.rss && typeof fetchRss === 'function') {
        try {
          const rssData = await fetchRss(sector.rss);
          const rssArticle = rssData?.articles?.[0];
          if (rssArticle) return { sector, headline: rssArticle.title };
        } catch (err) { /* on retombe sur le matching par mot-clé ci-dessous */ }
      }
      const match = matchSector(sector);
      return { sector, headline: match ? match.title : "Pas d'actualité pour le moment" };
    })
  );

  grid.innerHTML = results.map(({ sector, headline }) => `
    <a href="news.html?secteur=${sector.param}" class="card sector-card">
      <span class="sector-icon">${sector.icon}</span>
      <span class="sector-name">${sector.name}</span>
      <span class="sector-headline">${headline}</span>
    </a>`).join('');
}

/* "À ne pas manquer" et "Actualité mondiale" fusionnés en un seul bloc
   ("Aussi dans l'actu") : c'était deux appels NewsAPI distincts pour un
   total de 8 cartes sur l'accueil, en plus de Priorité Absolue et des
   10 secteurs — beaucoup trop dense pour un coup d'oeil rapide. */
/* L'override domains: 'lesechos.fr,capital.fr,challenges.fr' tournait en
   fait sur challenges.fr SEUL depuis le début — NewsAPI n'indexe pas
   lesechos.fr ni capital.fr (0 résultat vérifié par test direct), et ça
   ne se voyait pas puisque challenges.fr suffisait à remplir le bloc.
   On repasse sur les domaines de confiance par défaut (TRUSTED_DOMAINS,
   nettoyés côté Worker) pour retrouver du volume et de la diversité
   réelle, en laissant le mot-clé filtrer ce qui est pertinent. */
function refreshHome() {
  loadMarketTicker();
  loadNewsBlock('priority-list', 'marchés OR bourse OR taux OR inflation OR résultats OR Fed OR BCE OR fusion OR acquisition', {
    count: 4,
    rankByImpact: true
  });
  loadNewsBlock('also-list', 'découverte OR avancée scientifique OR international OR politique OR économie OR monde', { count: 4 });
  loadSectors();
}

window.juBoardRefresh = refreshHome;

document.addEventListener('DOMContentLoaded', refreshHome);
