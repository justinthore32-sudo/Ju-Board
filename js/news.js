/* ============================================
   JU BOARD — news.js
   Page News : filtres, tri réel, pagination et
   chargement des vraies actualités (NewsAPI)
   ============================================ */

const SUBDOMAINS = {
  economie: ['Marchés actions', 'Obligataire', 'Crypto', 'Banques centrales', 'M&A', 'Private equity', 'IPO'],
  geopolitique: ['Europe', 'USA', 'Chine', 'Russie', 'Moyen-Orient', 'Afrique', 'Asie', 'Amérique latine'],
  tech: ['Intelligence artificielle', 'Semiconducteurs', 'Cloud', 'Cybersécurité', 'Quantum', 'Robotique'],
  environnement: ['Changement climatique', 'Biodiversité', 'Océans', 'Forêts', 'Agriculture', 'COP'],
  politique: ['France', 'Europe', 'USA', 'Élections mondiales', 'Régulation', 'Institutions'],
  sante: ['Biotech', 'Pharma', 'Épidémies', 'Oncologie', 'Recherche', 'OMS', 'FDA'],
  spatial: ['Exploration', 'Satellites', 'Défense spatiale', 'Tourisme spatial', 'Agences'],
  energie: ['Pétrole-gaz', 'Nucléaire', 'Solaire', 'Éolien', 'Hydrogène', 'Matières premières'],
  histoire: ['Anniversaires', 'Parallèles historiques', 'Contexte', 'Commémorations'],
  societe: ['Tendances sociales', 'Démographie', 'Culture', 'Sciences sociales']
};

const DOMAIN_QUERIES = {
  all: 'actualité internationale',
  economie: 'économie OR marchés financiers OR banque centrale',
  geopolitique: 'géopolitique OR diplomatie OR conflit international',
  tech: 'intelligence artificielle OR technologie',
  environnement: 'climat OR environnement',
  politique: 'politique France OR Europe',
  sante: 'santé OR médecine OR vaccin',
  spatial: 'espace OR spatial OR NASA',
  energie: 'énergie OR pétrole OR nucléaire',
  histoire: 'histoire',
  societe: 'société'
};

const DOMAIN_LABELS = {
  economie: '💰 Économie', geopolitique: '🌍 Géopolitique', tech: '💻 Tech & IA',
  environnement: '🌱 Environnement', politique: '🏛️ Politique', sante: '💊 Santé',
  spatial: '🚀 Spatial', energie: '⚡ Énergie', histoire: '📚 Histoire', societe: '🎭 Société'
};

const SORT_MAP = { recent: 'publishedAt', important: 'popularity', impact: 'relevancy' };

let currentPage = 1;
let currentSort = 'recent';
let lastTotalResults = 0;
let loadedCount = 0;

function timeAgo(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `Il y a ${Math.max(mins, 1)} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.round(hours / 24);
  return `Il y a ${days}j`;
}

function buildQuery() {
  const domain = document.getElementById('domain-select').value;
  const subdomain = document.getElementById('subdomain-select').value;
  let query = DOMAIN_QUERIES[domain] || DOMAIN_QUERIES.all;
  if (subdomain && subdomain !== 'all') query = `${subdomain} ${query}`;
  return { query, domain };
}

function renderArticle(article, domainKey) {
  const badge = DOMAIN_LABELS[domainKey] || '🌐 Actualité';
  const summary = article.description || "Pas de résumé disponible pour cet article.";
  return `
    <article class="card news-card">
      <div class="news-meta">
        <span class="sector-badge">${badge}</span>
        <span class="news-source">${article.source?.name || 'Source inconnue'}</span>
        <span class="news-time">${timeAgo(article.publishedAt)}</span>
      </div>
      <h3 class="news-title">${article.title || 'Sans titre'}</h3>
      <p class="news-summary">${summary}</p>
      <a class="btn-expand" href="${buildArticleUrl(article, timeAgo(article.publishedAt))}">Lire plus →</a>
    </article>`;
}

async function loadNews(append = false) {
  const list = document.getElementById('news-list');
  const loadMoreBtn = document.getElementById('load-more');

  if (!append) {
    currentPage = 1;
    loadedCount = 0;
    list.innerHTML = `
      <div class="skeleton" style="height: 180px; margin-bottom: 14px;"></div>
      <div class="skeleton" style="height: 180px; margin-bottom: 14px;"></div>
      <div class="skeleton" style="height: 180px;"></div>`;
  }

  const { query, domain } = buildQuery();
  const sortBy = SORT_MAP[currentSort] || 'publishedAt';

  if (typeof fetchNews !== 'function') {
    list.innerHTML = '<p style="color: var(--text3); font-size: 13px;">API News non configurée.</p>';
    return;
  }

  try {
    const data = await fetchNews(query, { sortBy, page: currentPage });
    if (data.status !== 'ok') throw new Error(data.message || 'Erreur inconnue');

    const articles = (data.articles || []).filter((a) => a.title && a.title !== '[Removed]');
    lastTotalResults = data.totalResults || 0;

    if (!append && articles.length === 0) {
      list.innerHTML = '<p style="color: var(--text3); font-size: 13px;">Aucune actualité trouvée pour ce filtre.</p>';
      loadMoreBtn.classList.add('hidden');
      return;
    }

    const html = articles.map((a) => renderArticle(a, domain)).join('');
    list.innerHTML = append ? list.innerHTML + html : html;
    loadedCount += articles.length;

    loadMoreBtn.classList.toggle('hidden', loadedCount >= lastTotalResults || articles.length === 0);
  } catch (err) {
    list.innerHTML = `<p style="color: var(--red); font-size: 13px;">Erreur de chargement : ${err.message}</p>`;
  }
}

function applySectorFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const secteur = params.get('secteur');
  if (!secteur) return false;
  const domainSelect = document.getElementById('domain-select');
  if (!domainSelect || !DOMAIN_QUERIES[secteur]) return false;
  domainSelect.value = secteur;
  domainSelect.dispatchEvent(new Event('change'));
  return true;
}

function initDomainFilter() {
  const domainSelect = document.getElementById('domain-select');
  const subdomainSelect = document.getElementById('subdomain-select');
  if (!domainSelect || !subdomainSelect) return;

  function populateSubdomains(domain) {
    subdomainSelect.innerHTML = '<option value="all">Tous les sous-domaines</option>';
    const list = SUBDOMAINS[domain];
    if (!list) return;
    list.forEach((label) => {
      const opt = document.createElement('option');
      opt.value = label;
      opt.textContent = label;
      subdomainSelect.appendChild(opt);
    });
  }

  domainSelect.addEventListener('change', () => {
    populateSubdomains(domainSelect.value);
    loadNews();
  });

  subdomainSelect.addEventListener('change', () => loadNews());
}

function initSortTabs() {
  const tabs = document.querySelectorAll('.sort-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentSort = tab.dataset.sort;
      loadNews();
    });
  });
}

function initLoadMore() {
  const btn = document.getElementById('load-more');
  if (!btn) return;
  btn.addEventListener('click', () => {
    currentPage += 1;
    loadNews(true);
  });
}

function refreshNews() {
  loadNews();
}

window.juBoardRefresh = refreshNews;

document.addEventListener('DOMContentLoaded', () => {
  initDomainFilter();
  initSortTabs();
  initLoadMore();
  const appliedFromUrl = applySectorFromUrl();
  if (!appliedFromUrl) loadNews();
});
