/* ============================================
   JU BOARD — news.js
   Page News : navigation par secteur (mode par défaut,
   comme avant) + recherche libre fusionnée depuis
   l'ancienne page Recherche avancée (mot-clé, entreprise,
   glossaire, favoris). Une requête tapée bascule
   automatiquement l'interface en mode recherche.
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
  all: 'international OR politique OR économie OR monde',
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
const PERIOD_DAYS = { '24h': 1, '7j': 7, '30j': 30, '1an': 365 };

let currentPage = 1;
let currentSort = 'recent';
let lastTotalResults = 0;
let loadedCount = 0;
let currentQuery = '';
let favorisActive = false;
let searchFilters = { periode: '24h', type: 'tous' };

function timeAgo(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `Il y a ${Math.max(mins, 1)} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.round(hours / 24);
  return `Il y a ${days}j`;
}

function glossify(text) {
  return typeof linkifyGlossary === 'function' ? linkifyGlossary(text) : text;
}

function impactTag(article) {
  return typeof impactBadgeHtml === 'function' ? impactBadgeHtml(article) : '';
}

/* ---------- MODE NAVIGATION (par secteur) ---------- */
function buildBrowseQuery() {
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
        ${impactTag(article)}
      </div>
      <h3 class="news-title">${glossify(article.title || 'Sans titre')}</h3>
      <p class="news-summary">${glossify(summary)}</p>
      <a class="btn-expand" href="${buildArticleUrl(article, timeAgo(article.publishedAt))}">Lire plus →</a>
    </article>`;
}

async function loadBrowse(append = false) {
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

  const { query, domain } = buildBrowseQuery();
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

/* ---------- MODE RECHERCHE (mot-clé, entreprise, glossaire) ---------- */
function computeFromDate() {
  const days = PERIOD_DAYS[searchFilters.periode] || 1;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function renderSearchNewsResult(article) {
  return `
    <article class="card result-item">
      <span class="result-type">News</span>
      ${impactTag(article)}
      <h3 class="result-title"><a href="${buildArticleUrl(article, timeAgo(article.publishedAt))}">${glossify(article.title || 'Sans titre')}</a></h3>
      <p class="result-excerpt">${glossify(article.description || '')}</p>
    </article>`;
}

function renderGlossaryResult(entry) {
  return `
    <article class="card result-item">
      <span class="result-type">Définition</span>
      <h3 class="result-title">${entry.term}</h3>
      <p class="result-excerpt">${entry.definition}</p>
    </article>`;
}

function renderCompanyResult(company) {
  return `
    <article class="card result-item">
      <span class="result-type">Analyse</span>
      <h3 class="result-title"><a href="analyse.html">${company.name}</a></h3>
      <p class="result-excerpt">Voir ${company.name} dans ta watchlist (page Analyse).</p>
    </article>`;
}

async function runNewsSearch(append = false) {
  const list = document.getElementById('news-list');
  const meta = document.getElementById('results-meta');
  const loadMoreBtn = document.getElementById('load-more');
  const trimmed = currentQuery.trim();
  if (!trimmed) return;

  if (!append) {
    currentPage = 1;
    loadedCount = 0;
    meta.classList.remove('hidden');
    meta.textContent = `Recherche en cours pour « ${trimmed} »…`;
    list.innerHTML = `
      <div class="skeleton" style="height: 110px; margin-bottom: 14px;"></div>
      <div class="skeleton" style="height: 110px;"></div>`;
  }

  const lowerQuery = trimmed.toLowerCase();
  const glossaryMatches = !append && (searchFilters.type === 'tous' || searchFilters.type === 'definition') && typeof SEARCH_GLOSSARY !== 'undefined'
    ? SEARCH_GLOSSARY.filter((g) => g.term.toLowerCase().includes(lowerQuery)) : [];
  const companyMatches = !append && (searchFilters.type === 'tous' || searchFilters.type === 'analyse') && typeof SEARCH_COMPANIES !== 'undefined'
    ? SEARCH_COMPANIES.filter((c) => c.name.toLowerCase().includes(lowerQuery)) : [];

  let newsArticles = [];
  let newsError = null;

  if (searchFilters.type === 'tous' || searchFilters.type === 'news') {
    try {
      const data = await fetchNews(trimmed, { sortBy: 'relevancy', page: currentPage, from: computeFromDate() });
      if (data.status !== 'ok') throw new Error(data.message || 'Erreur');
      newsArticles = (data.articles || []).filter((a) => a.title && a.title !== '[Removed]');
      lastTotalResults = data.totalResults || 0;
    } catch (err) {
      newsError = err.message;
      lastTotalResults = 0;
    }
  } else {
    lastTotalResults = 0;
  }

  const totalCount = newsArticles.length + glossaryMatches.length + companyMatches.length;

  if (!append && totalCount === 0) {
    meta.classList.add('hidden');
    list.innerHTML = newsError
      ? `<p style="color: var(--red); font-size: 13px;">Erreur de recherche : ${newsError}</p>`
      : `<p style="color: var(--text3); font-size: 13px;">Aucun résultat pour « ${trimmed} » avec ces filtres.</p>`;
    loadMoreBtn.classList.add('hidden');
    return;
  }

  if (!append) {
    meta.textContent = `${totalCount} résultat${totalCount > 1 ? 's' : ''} pour « ${trimmed} »`;
    list.innerHTML = [
      ...companyMatches.map(renderCompanyResult),
      ...glossaryMatches.map(renderGlossaryResult),
      ...newsArticles.map(renderSearchNewsResult)
    ].join('');
  } else {
    list.innerHTML += newsArticles.map(renderSearchNewsResult).join('');
  }

  loadedCount += newsArticles.length;
  loadMoreBtn.classList.toggle('hidden', loadedCount >= lastTotalResults || newsArticles.length === 0);
}

/* ---------- FAVORIS ---------- */
function renderFavorisView() {
  const list = document.getElementById('news-list');
  const meta = document.getElementById('results-meta');
  document.getElementById('load-more').classList.add('hidden');
  meta.classList.remove('hidden');

  let favorites = {};
  try { favorites = JSON.parse(localStorage.getItem('ju-board-favorites') || '{}'); } catch (err) { /* stockage indisponible */ }
  const entries = Object.entries(favorites).sort((a, b) => (b[1].savedAt || 0) - (a[1].savedAt || 0));

  if (entries.length === 0) {
    meta.textContent = 'Aucun favori pour le moment.';
    list.innerHTML = '<p style="color: var(--text3); font-size: 13px;">Fais un appui long sur une news pour la sauvegarder ici.</p>';
    return;
  }

  meta.textContent = `${entries.length} favori${entries.length > 1 ? 's' : ''}`;
  list.innerHTML = entries.map(([, fav]) => `
    <article class="card result-item">
      <span class="result-type">★ Favori</span>
      <h3 class="result-title"><a href="${fav.link}">${fav.title || 'Sans titre'}</a></h3>
    </article>`).join('');
}

/* ---------- ORCHESTRATION DES 3 MODES ---------- */
function updateModeVisibility() {
  const browseFilters = document.getElementById('browse-filters');
  const searchFiltersEl = document.getElementById('search-filters');
  const favBtn = document.getElementById('favoris-toggle');
  const searching = !favorisActive && currentQuery.trim().length > 0;

  browseFilters.classList.toggle('hidden', favorisActive || searching);
  searchFiltersEl.classList.toggle('hidden', favorisActive || !searching);
  favBtn.classList.toggle('active', favorisActive);
  if (!favorisActive && !searching) document.getElementById('results-meta').classList.add('hidden');
}

function refreshCurrentMode(append = false) {
  if (favorisActive) { renderFavorisView(); return; }
  if (currentQuery.trim()) { runNewsSearch(append); return; }
  loadBrowse(append);
}

function initSearchInput() {
  const input = document.getElementById('news-search-input');
  if (!input) return;
  let debounceTimer = null;

  input.addEventListener('input', () => {
    if (favorisActive) favorisActive = false;
    currentQuery = input.value;
    updateModeVisibility();
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => refreshCurrentMode(false), 400);
  });
}

function initFavorisToggle() {
  const btn = document.getElementById('favoris-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    favorisActive = !favorisActive;
    if (favorisActive) {
      document.getElementById('news-search-input').value = '';
      currentQuery = '';
    }
    updateModeVisibility();
    refreshCurrentMode(false);
  });
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
    loadBrowse();
  });

  subdomainSelect.addEventListener('change', () => loadBrowse());
}

function initSortTabs() {
  const tabs = document.querySelectorAll('.sort-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentSort = tab.dataset.sort;
      loadBrowse();
    });
  });
}

function initSearchFilterChips() {
  document.querySelectorAll('#search-filters .filter-chips').forEach((group) => {
    const groupName = group.dataset.group;
    const chips = group.querySelectorAll('.filter-chip');
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        searchFilters[groupName] = chip.dataset.value;
        if (currentQuery.trim()) refreshCurrentMode(false);
      });
    });
  });
}

function initLoadMore() {
  const btn = document.getElementById('load-more');
  if (!btn) return;
  btn.addEventListener('click', () => {
    currentPage += 1;
    refreshCurrentMode(true);
  });
}

function refreshNews() {
  refreshCurrentMode(false);
}

window.juBoardRefresh = refreshNews;

document.addEventListener('DOMContentLoaded', () => {
  initDomainFilter();
  initSortTabs();
  initSearchFilterChips();
  initLoadMore();
  initSearchInput();
  initFavorisToggle();
  updateModeVisibility();
  const appliedFromUrl = applySectorFromUrl();
  if (!appliedFromUrl) loadBrowse();
});
