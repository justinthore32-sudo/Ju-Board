/* ============================================
   JU BOARD — analyse.js
   Page Analyse : watchlist personnalisable avec
   cours et ratios réels (Finnhub, via le Worker).

   L'analyse qualitative (cycle, scénarios, points de
   vigilance) n'est PAS générée ici — elle demande un
   vrai jugement et attend qu'Anthropic soit branché.
   Cette page se limite volontairement aux chiffres
   vérifiables.
   ============================================ */

const CATEGORY_LABELS = {
  tech: 'Tech',
  finance: 'Finance',
  industrie: 'Industrie & Luxe',
  emergents: 'Émergents',
  energie: 'Énergie'
};

let currentWatchlist = [];
let quotesBySymbol = {};
let metricsBySymbol = {};
let activeCategory = 'all';

function fmtRatio(value, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(2)}${suffix}`;
}

function fmtPrice(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderCompanyCard(entry) {
  const quote = quotesBySymbol[entry.symbol];
  const metric = metricsBySymbol[entry.symbol];

  let priceBlock;
  if (quote && !quote.error) {
    const dir = quote.change > 0 ? 'up' : quote.change < 0 ? 'down' : 'neutral';
    const sign = quote.change > 0 ? '+' : '';
    priceBlock = `
      <div class="indicator ${dir}">
        <span class="mono">${fmtPrice(quote.price)} $</span>
        <span class="mono">${sign}${fmtRatio(quote.changePercent, '%')}</span>
      </div>`;
  } else {
    priceBlock = `<span class="cycle-phase maturite">Cours indisponible</span>`;
  }

  const ratiosBlock = metric && !metric.error ? `
    <div class="ratios-grid">
      <div class="ratio-item">
        <span class="ratio-label">PER</span>
        <span class="ratio-value">${fmtRatio(metric.per, 'x')}</span>
      </div>
      <div class="ratio-item">
        <span class="ratio-label">ROE</span>
        <span class="ratio-value">${fmtRatio(metric.roe, '%')}</span>
      </div>
      <div class="ratio-item">
        <span class="ratio-label">Marge nette</span>
        <span class="ratio-value">${fmtRatio(metric.margeNette, '%')}</span>
      </div>
      <div class="ratio-item">
        <span class="ratio-label">Dette / capitaux propres</span>
        <span class="ratio-value">${fmtRatio(metric.detteCapitauxPropres, 'x')}</span>
      </div>
    </div>` : `
    <p style="font-size: 12px; color: var(--text3);">Ratios financiers indisponibles pour ce titre (couverture Finnhub gratuite limitée aux bourses américaines).</p>`;

  return `
    <article class="card company-card" data-cat="${entry.category}">
      <div class="company-head">
        <div class="company-name-row">
          <span class="company-name">${entry.name}</span>
          <span class="company-sector">${CATEGORY_LABELS[entry.category] || entry.category} · ${entry.symbol}</span>
        </div>
        ${priceBlock}
      </div>

      ${ratiosBlock}

      <div style="display:flex; justify-content:space-between; align-items:center; padding-top: 10px; border-top: 1px solid var(--border);">
        <span style="font-size: 11px; color: var(--text3);">🤖 Analyse qualitative disponible une fois Anthropic branché.</span>
        <button class="btn-remove-company" data-action="remove" data-symbol="${entry.symbol}">Retirer</button>
      </div>
    </article>`;
}

function renderCompanyList() {
  const list = document.getElementById('company-list');
  if (!list) return;

  if (currentWatchlist.length === 0) {
    list.innerHTML = '<p style="color: var(--text3); font-size: 13px;">Ta watchlist est vide — ajoute une entreprise ci-dessus.</p>';
    return;
  }

  const visible = activeCategory === 'all' ? currentWatchlist : currentWatchlist.filter((e) => e.category === activeCategory);
  if (visible.length === 0) {
    list.innerHTML = '<p style="color: var(--text3); font-size: 13px;">Aucune entreprise dans cette catégorie.</p>';
    return;
  }

  list.innerHTML = visible.map(renderCompanyCard).join('');

  list.querySelectorAll('[data-action="remove"]').forEach((btn) => {
    btn.addEventListener('click', () => removeFromWatchlist(btn.dataset.symbol));
  });
}

async function loadWatchlistPage() {
  const list = document.getElementById('company-list');
  if (!list || typeof fetchWatchlist !== 'function') return;

  try {
    const data = await fetchWatchlist();
    currentWatchlist = data.watchlist || [];
  } catch (err) {
    list.innerHTML = `<p style="color: var(--red); font-size: 13px;">Erreur de chargement de la watchlist : ${err.message}</p>`;
    return;
  }

  if (currentWatchlist.length === 0) {
    renderCompanyList();
    return;
  }

  const symbols = currentWatchlist.map((e) => e.symbol);
  try {
    const [quotesData, metricsData] = await Promise.all([
      fetchStockQuotes(symbols),
      fetchStockMetrics(symbols)
    ]);
    quotesBySymbol = {};
    (quotesData.results || []).forEach((r) => { quotesBySymbol[r.symbol] = r; });
    metricsBySymbol = {};
    (metricsData.results || []).forEach((r) => { metricsBySymbol[r.symbol] = r; });
  } catch (err) {
    /* on affiche quand même les cartes, sans cours/ratios */
  }

  renderCompanyList();
}

async function removeFromWatchlist(symbol) {
  currentWatchlist = currentWatchlist.filter((e) => e.symbol !== symbol);
  try {
    await updateWatchlist(currentWatchlist);
    if (typeof showToast === 'function') showToast('Retiré de la watchlist');
  } catch (err) {
    if (typeof showToast === 'function') showToast('Erreur : impossible de mettre à jour la watchlist');
  }
  renderCompanyList();
}

function initCategoryTabs() {
  const tabs = document.querySelectorAll('.category-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.dataset.cat;
      renderCompanyList();
    });
  });
}

function initAddForm() {
  const toggleBtn = document.getElementById('toggle-add-form');
  const form = document.getElementById('add-company-form');
  if (!toggleBtn || !form) return;

  toggleBtn.addEventListener('click', () => {
    const isHidden = form.style.display === 'none';
    form.style.display = isHidden ? 'flex' : 'none';
    form.style.flexDirection = 'column';
    toggleBtn.textContent = isHidden ? 'Annuler' : '+ Ajouter une entreprise';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const symbol = document.getElementById('add-symbol').value.trim().toUpperCase();
    const name = document.getElementById('add-name').value.trim();
    const category = document.getElementById('add-category').value;
    if (!symbol || !name) return;

    if (currentWatchlist.some((entry) => entry.symbol === symbol)) {
      if (typeof showToast === 'function') showToast('Ce titre est déjà dans ta watchlist');
      return;
    }

    currentWatchlist.push({ symbol, name, category });
    try {
      await updateWatchlist(currentWatchlist);
      if (typeof showToast === 'function') showToast('Ajouté à la watchlist');
    } catch (err) {
      if (typeof showToast === 'function') showToast('Erreur : impossible de mettre à jour la watchlist');
    }

    form.reset();
    form.style.display = 'none';
    toggleBtn.textContent = '+ Ajouter une entreprise';
    loadWatchlistPage();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initCategoryTabs();
  initAddForm();
  loadWatchlistPage();
});
