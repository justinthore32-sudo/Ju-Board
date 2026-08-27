/* ============================================
   JU BOARD — search.js
   Barre de recherche du header, présente sur les
   5 pages. Dropdown dès 3 caractères, résultats
   groupés : News / Entreprises / Concepts.
   ============================================ */

const SEARCH_COMPANIES = [
  { name: 'Apple', slug: 'apple' },
  { name: 'Nvidia', slug: 'nvidia' },
  { name: 'JPMorgan Chase', slug: 'jpmorgan-chase' },
  { name: 'LVMH', slug: 'lvmh' },
  { name: 'Saudi Aramco', slug: 'saudi-aramco' },
  { name: 'ExxonMobil', slug: 'exxonmobil' }
];

const SEARCH_GLOSSARY = [
  { term: 'Quantitative tightening', definition: "Politique monétaire par laquelle une banque centrale réduit la taille de son bilan, à l'inverse du quantitative easing." },
  { term: 'Quantitative easing', definition: 'Politique monétaire non conventionnelle où une banque centrale achète des actifs financiers pour injecter des liquidités dans l\'économie.' },
  { term: 'PER (Price Earnings Ratio)', definition: "Ratio cours sur bénéfice — mesure combien de fois le bénéfice annuel les investisseurs sont prêts à payer pour une action." },
  { term: 'ROE (Return on Equity)', definition: 'Rentabilité des capitaux propres — mesure la capacité d\'une entreprise à générer du profit avec l\'argent de ses actionnaires.' },
  { term: 'OPEP+', definition: "Organisation des pays exportateurs de pétrole élargie à des alliés comme la Russie, qui coordonne les niveaux de production mondiaux." },
  { term: 'Cycle économique', definition: "Alternance de phases d'expansion, de pic, de contraction et de reprise que traverse une économie ou une entreprise dans le temps." },
  { term: 'Inflation', definition: "Hausse générale et durable des prix, qui réduit le pouvoir d'achat de la monnaie." },
  { term: 'PIB (Produit Intérieur Brut)', definition: "Valeur totale des biens et services produits dans un pays sur une période donnée — indicateur clé de l'activité économique." },
  { term: 'Taux directeur', definition: "Taux d'intérêt fixé par une banque centrale, qui influence le coût du crédit dans toute l'économie." },
  { term: 'Géopolitique', definition: "Étude des rapports entre la géographie, le pouvoir et les relations internationales entre États." }
];

let searchDebounceTimer = null;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderGroup(title, items) {
  if (items.length === 0) return '';
  return `<div class="search-group">
    <div class="search-group-title">${title}</div>
    ${items.join('')}
  </div>`;
}

async function runSearch(query) {
  const resultsEl = document.getElementById('search-results');
  if (!resultsEl) return;

  resultsEl.innerHTML = '<div class="search-loading">Recherche…</div>';
  resultsEl.classList.add('active');

  const lowerQuery = query.toLowerCase();

  const companies = SEARCH_COMPANIES.filter((c) => c.name.toLowerCase().includes(lowerQuery));
  const glossary = SEARCH_GLOSSARY.filter((g) => g.term.toLowerCase().includes(lowerQuery));

  let newsHtml = [];
  if (typeof fetchNews === 'function') {
    try {
      const data = await fetchNews(query, { sortBy: 'relevancy' });
      const articles = (data.articles || []).filter((a) => a.title && a.title !== '[Removed]').slice(0, 4);
      newsHtml = articles.map((a) => `
        <a class="search-result" href="${buildArticleUrl(a)}">
          <span class="search-result-title">${escapeHtml(a.title)}</span>
          <span class="search-result-meta">${a.source?.name || ''}</span>
        </a>`);
    } catch (err) {
      newsHtml = [];
    }
  }

  const companyHtml = companies.map((c) => `
    <a class="search-result" href="analyse.html#company-${c.slug}">
      <span class="search-result-title">${escapeHtml(c.name)}</span>
      <span class="search-result-meta">Voir l'analyse →</span>
    </a>`);

  const glossaryHtml = glossary.map((g) => `
    <div class="search-result search-result-static">
      <span class="search-result-title">${escapeHtml(g.term)}</span>
      <span class="search-result-meta">${escapeHtml(g.definition)}</span>
    </div>`);

  const html = [
    renderGroup('News', newsHtml),
    renderGroup('Entreprises', companyHtml),
    renderGroup('Concepts & définitions', glossaryHtml)
  ].join('');

  resultsEl.innerHTML = html || '<div class="search-empty">Aucun résultat</div>';
}

function initSearchBar() {
  const input = document.getElementById('search-input');
  const resultsEl = document.getElementById('search-results');
  if (!input || !resultsEl) return;

  input.addEventListener('input', () => {
    const query = input.value.trim();
    window.clearTimeout(searchDebounceTimer);

    if (query.length < 3) {
      resultsEl.classList.remove('active');
      resultsEl.innerHTML = '';
      return;
    }

    searchDebounceTimer = window.setTimeout(() => runSearch(query), 350);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-bar')) {
      resultsEl.classList.remove('active');
    }
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 3) resultsEl.classList.add('active');
  });
}

document.addEventListener('DOMContentLoaded', initSearchBar);
