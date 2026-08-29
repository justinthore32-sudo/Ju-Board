/* ============================================
   JU BOARD — recherche.js
   Page Recherche avancée : recherche réelle
   (NewsAPI + entreprises + glossaire local),
   filtres période/secteur/type, pagination.
   ============================================ */

const SECTOR_QUERIES = {
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

const PERIOD_DAYS = { '24h': 1, '7j': 7, '30j': 30, '1an': 365 };

let activeFilters = { periode: '24h', secteur: 'tous', type: 'tous' };
let currentQuery = '';
let currentPage = 1;
let lastTotalResults = 0;
const PAGE_SIZE = 10;

function timeAgo(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `Il y a ${Math.max(mins, 1)} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.round(hours / 24);
  return `Il y a ${days}j`;
}

function computeFromDate() {
  const days = PERIOD_DAYS[activeFilters.periode] || 1;
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function buildEffectiveQuery(userQuery) {
  const sectorTerm = activeFilters.secteur !== 'tous' ? SECTOR_QUERIES[activeFilters.secteur] : null;
  return sectorTerm ? `${userQuery} ${sectorTerm}` : userQuery;
}

function renderNewsResult(article) {
  return `
    <article class="card result-item">
      <span class="result-type">News</span>
      ${typeof impactBadgeHtml === 'function' ? impactBadgeHtml(article) : ''}
      <h3 class="result-title"><a href="${buildArticleUrl(article, timeAgo(article.publishedAt))}">${typeof linkifyGlossary === 'function' ? linkifyGlossary(article.title || 'Sans titre') : (article.title || 'Sans titre')}</a></h3>
      <p class="result-excerpt">${typeof linkifyGlossary === 'function' ? linkifyGlossary(article.description || '') : (article.description || '')}</p>
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
      <h3 class="result-title"><a href="analyse.html#company-${company.slug}">${company.name}</a></h3>
      <p class="result-excerpt">Voir le cycle, les ratios et les scénarios pour ${company.name} dans la page Analyse.</p>
    </article>`;
}

function renderPagination() {
  const pagination = document.getElementById('pagination');
  const totalPages = Math.min(5, Math.max(1, Math.ceil(lastTotalResults / PAGE_SIZE)));

  if (totalPages <= 1) {
    pagination.classList.add('hidden');
    pagination.innerHTML = '';
    return;
  }

  pagination.classList.remove('hidden');
  let html = '';
  for (let i = 1; i <= totalPages; i += 1) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  pagination.innerHTML = html;

  pagination.querySelectorAll('.page-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.dataset.page, 10);
      runSearch(currentQuery, false);
    });
  });
}

async function runSearch(query, resetPage = true) {
  const trimmed = query.trim();
  if (!trimmed) return;

  currentQuery = trimmed;
  if (resetPage) currentPage = 1;

  const resultsList = document.getElementById('results-list');
  const resultsMeta = document.getElementById('results-meta');
  const aiBox = document.getElementById('ai-answer-box');
  const aiText = document.getElementById('ai-answer-text');

  aiBox.classList.remove('active');
  resultsMeta.classList.remove('hidden');
  resultsMeta.textContent = `Recherche en cours pour « ${trimmed} »…`;
  resultsList.innerHTML = `
    <div class="skeleton" style="height: 110px; margin-bottom: 14px;"></div>
    <div class="skeleton" style="height: 110px;"></div>`;

  const lowerQuery = trimmed.toLowerCase();
  const glossaryMatches = activeFilters.type === 'tous' || activeFilters.type === 'definition'
    ? SEARCH_GLOSSARY.filter((g) => g.term.toLowerCase().includes(lowerQuery))
    : [];
  const companyMatches = activeFilters.type === 'tous' || activeFilters.type === 'analyse'
    ? SEARCH_COMPANIES.filter((c) => c.name.toLowerCase().includes(lowerQuery))
    : [];

  let newsArticles = [];
  let newsError = null;

  if (activeFilters.type === 'tous' || activeFilters.type === 'news') {
    try {
      const effectiveQuery = buildEffectiveQuery(trimmed);
      const data = await fetchNews(effectiveQuery, {
        sortBy: 'relevancy',
        page: currentPage,
        from: computeFromDate()
      });
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

  if (totalCount === 0) {
    resultsMeta.classList.add('hidden');
    resultsList.innerHTML = '';
    aiBox.classList.add('active');
    aiText.textContent = newsError
      ? `Erreur de recherche : ${newsError}`
      : `Aucun résultat trouvé pour « ${trimmed} » avec ces filtres. Une vraie réponse contextuelle générée par l'IA apparaîtra ici une fois l'API Anthropic branchée.`;
    document.getElementById('pagination').classList.add('hidden');
    return;
  }

  resultsMeta.textContent = `${totalCount} résultat${totalCount > 1 ? 's' : ''} pour « ${trimmed} »`;
  resultsList.innerHTML = [
    ...companyMatches.map(renderCompanyResult),
    ...glossaryMatches.map(renderGlossaryResult),
    ...newsArticles.map(renderNewsResult)
  ].join('');

  renderPagination();
}

function renderFavorites() {
  const resultsList = document.getElementById('results-list');
  const resultsMeta = document.getElementById('results-meta');
  const aiBox = document.getElementById('ai-answer-box');
  const pagination = document.getElementById('pagination');

  aiBox.classList.remove('active');
  pagination.classList.add('hidden');
  resultsMeta.classList.remove('hidden');

  let favorites = {};
  try { favorites = JSON.parse(localStorage.getItem('ju-board-favorites') || '{}'); } catch (err) { /* stockage indisponible */ }
  const entries = Object.entries(favorites).sort((a, b) => (b[1].savedAt || 0) - (a[1].savedAt || 0));

  if (entries.length === 0) {
    resultsMeta.textContent = 'Aucun favori pour le moment.';
    resultsList.innerHTML = '<p style="color: var(--text3); font-size: 13px;">Fais un appui long sur une news pour la sauvegarder ici.</p>';
    return;
  }

  resultsMeta.textContent = `${entries.length} favori${entries.length > 1 ? 's' : ''}`;
  resultsList.innerHTML = entries.map(([, fav]) => `
    <article class="card result-item">
      <span class="result-type">★ Favori</span>
      <h3 class="result-title"><a href="${fav.link}">${fav.title || 'Sans titre'}</a></h3>
    </article>`).join('');
}

function initFilterChips() {
  document.querySelectorAll('.filter-chips').forEach((group) => {
    const groupName = group.dataset.group;
    const chips = group.querySelectorAll('.filter-chip');
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        activeFilters[groupName] = chip.dataset.value;
        if (groupName === 'type' && chip.dataset.value === 'favoris') {
          renderFavorites();
          return;
        }
        if (currentQuery) runSearch(currentQuery);
      });
    });
  });
}

function initAdvancedSearch() {
  const input = document.getElementById('advanced-search-input');
  if (!input) return;

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    runSearch(input.value);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initFilterChips();
  initAdvancedSearch();
});
