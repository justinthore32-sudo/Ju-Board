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
let newsByCompany = {};
let journalBySymbol = {};
let activeCategory = 'all';

/* Journal de convictions : notes personnelles horodatées, liées à une
   entreprise ("je pense que X va se passer parce que Y") — pour se
   confronter plus tard à ses propres analyses. */
async function loadJournal() {
  journalBySymbol = {};
  if (typeof fetchJournal !== 'function') return;
  try {
    const data = await fetchJournal();
    (data.entries || []).forEach((entry) => {
      if (!entry.symbol) return;
      if (!journalBySymbol[entry.symbol]) journalBySymbol[entry.symbol] = [];
      journalBySymbol[entry.symbol].push(entry);
    });
  } catch (err) {
    /* pas grave, les cartes s'affichent sans notes */
  }
}

async function addNote(symbol, text) {
  try {
    const { entry } = await addJournalEntry(text, symbol);
    if (!journalBySymbol[symbol]) journalBySymbol[symbol] = [];
    journalBySymbol[symbol].unshift(entry);
    renderCompanyList();
    if (typeof showToast === 'function') showToast('Note ajoutée');
  } catch (err) {
    if (typeof showToast === 'function') showToast('Erreur : impossible d\'ajouter la note');
  }
}

async function removeNote(id, symbol) {
  try {
    await deleteJournalEntry(id);
    if (journalBySymbol[symbol]) {
      journalBySymbol[symbol] = journalBySymbol[symbol].filter((n) => n.id !== id);
    }
    renderCompanyList();
  } catch (err) {
    if (typeof showToast === 'function') showToast('Erreur : impossible de supprimer la note');
  }
}

/* Relie les news déjà récupérées ailleurs dans l'app aux entreprises de
   la watchlist : une seule requête NewsAPI groupée (comme pour les
   secteurs de l'accueil), puis on associe chaque article aux entreprises
   dont le nom apparaît dedans — pas un appel par entreprise. */
async function loadCompanyNews(watchlist) {
  newsByCompany = {};
  if (typeof fetchNews !== 'function' || watchlist.length === 0) return;

  const query = watchlist.map((e) => `"${e.name}"`).join(' OR ');
  try {
    const data = await fetchNews(query, { sortBy: 'publishedAt', pageSize: 50 });
    const articles = (data.articles || []).filter((a) => a.title && a.title !== '[Removed]');
    watchlist.forEach((entry) => {
      const nameLower = entry.name.toLowerCase();
      newsByCompany[entry.symbol] = articles
        .filter((a) => `${a.title} ${a.description || ''}`.toLowerCase().includes(nameLower))
        .slice(0, 2);
    });
  } catch (err) {
    /* pas de news liees disponibles — les cartes s'affichent sans cette section */
  }
}

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

  const relatedNews = newsByCompany[entry.symbol] || [];
  const newsBlock = relatedNews.length > 0 ? `
    <div style="display:flex; flex-direction:column; gap:5px;">
      <span class="deep-block-title" style="margin:0;">Actu récente sur ${entry.name}</span>
      ${relatedNews.map((a) => `<a href="${buildArticleUrl(a, '')}" style="font-size:12px; color:var(--accent); text-decoration:none; display:block; line-height:1.4;">→ ${a.title}</a>`).join('')}
    </div>` : '';

  const notes = journalBySymbol[entry.symbol] || [];
  const esc = typeof escapeHtmlText === 'function' ? escapeHtmlText : (s) => s;
  const journalBlock = `
    <div style="display:flex; flex-direction:column; gap:8px; padding-top: 10px; border-top: 1px solid var(--border);">
      <span class="deep-block-title" style="margin:0;">📝 Mon journal</span>
      ${notes.map((n) => `
        <div style="display:flex; justify-content:space-between; gap:8px; align-items:flex-start; background:var(--bg-elevated); border-radius:8px; padding:8px 10px;">
          <div>
            <p style="font-size:12px; color:var(--text2); margin:0;">${esc(n.text)}</p>
            <span style="font-size:10px; color:var(--text3);">${new Date(n.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
          <button data-action="delete-note" data-id="${n.id}" title="Supprimer" style="flex-shrink:0; background:none; border:none; color:var(--text3); cursor:pointer; font-size:13px;">✕</button>
        </div>`).join('')}
      <form data-action="add-note" data-symbol="${entry.symbol}" style="display:flex; gap:6px;">
        <input type="text" placeholder="Ta conviction sur ${entry.name}…" required style="flex:1; padding:7px 10px; border-radius:8px; background:var(--bg-elevated); border:1px solid var(--border); font-size:12px; color:var(--text);">
        <button type="submit" class="btn-remove-company" style="color:var(--accent); border-color:var(--accent);">+ Note</button>
      </form>
    </div>`;

  return `
    <article class="card company-card" data-cat="${entry.category}" id="company-${entry.symbol}">
      <div class="company-head">
        <div class="company-name-row">
          <span class="company-name">${entry.name}</span>
          <span class="company-sector">${CATEGORY_LABELS[entry.category] || entry.category} · ${entry.symbol}</span>
        </div>
        ${priceBlock}
      </div>

      ${ratiosBlock}

      ${newsBlock}

      ${journalBlock}

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

  list.querySelectorAll('[data-action="add-note"]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      const text = input.value.trim();
      if (!text) return;
      addNote(form.dataset.symbol, text);
    });
  });

  list.querySelectorAll('[data-action="delete-note"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.company-card');
      const symbol = card ? card.id.replace('company-', '') : null;
      removeNote(btn.dataset.id, symbol);
    });
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
    scrollToHashCompany();
    return;
  }

  const symbols = currentWatchlist.map((e) => e.symbol);
  try {
    const [quotesData, metricsData] = await Promise.all([
      fetchStockQuotes(symbols),
      fetchStockMetrics(symbols),
      loadCompanyNews(currentWatchlist),
      loadJournal()
    ]);
    quotesBySymbol = {};
    (quotesData.results || []).forEach((r) => { quotesBySymbol[r.symbol] = r; });
    metricsBySymbol = {};
    (metricsData.results || []).forEach((r) => { metricsBySymbol[r.symbol] = r; });
  } catch (err) {
    /* on affiche quand même les cartes, sans cours/ratios */
  }

  renderPriceAlerts();
  renderCompanyList();
  scrollToHashCompany();
}

/* Alerte sur mouvement de prix inhabituel (±3% dans la journée) — calculée
   à l'affichage à partir des cours déjà récupérés, pas de notification
   push (ça demanderait un service worker, un chantier séparé). */
const PRICE_ALERT_THRESHOLD = 3;

function renderPriceAlerts() {
  const container = document.getElementById('price-alerts');
  if (!container) return;

  const moves = currentWatchlist
    .map((entry) => ({ entry, quote: quotesBySymbol[entry.symbol] }))
    .filter(({ quote }) => quote && !quote.error && Math.abs(quote.changePercent) >= PRICE_ALERT_THRESHOLD)
    .sort((a, b) => Math.abs(b.quote.changePercent) - Math.abs(a.quote.changePercent));

  if (moves.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = moves.map(({ entry, quote }) => {
    const dir = quote.changePercent > 0 ? 'up' : 'down';
    const sign = quote.changePercent > 0 ? '+' : '';
    const arrow = quote.changePercent > 0 ? '↑' : '↓';
    return `<div class="price-alert ${dir}">${arrow} ${entry.name} bouge de ${sign}${quote.changePercent.toFixed(2)}% aujourd'hui</div>`;
  }).join('');
}

/* Lien profond depuis Calendrier/la recherche rapide du header
   (analyse.html#company-AAPL) : si la catégorie active masque la carte,
   on repasse sur "Tous" avant de scroller pour ne pas rater le clic. */
function scrollToHashCompany() {
  if (!window.location.hash) return;
  const symbol = window.location.hash.slice(1).replace(/^company-/, '');
  window.setTimeout(() => {
    let target = document.getElementById(`company-${symbol}`);
    if (!target && activeCategory !== 'all') {
      activeCategory = 'all';
      document.querySelectorAll('.category-tab').forEach((t) => t.classList.toggle('active', t.dataset.cat === 'all'));
      renderCompanyList();
      target = document.getElementById(`company-${symbol}`);
    }
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.style.transition = 'box-shadow 0.3s';
    target.style.boxShadow = '0 0 0 3px var(--accent)';
    window.setTimeout(() => { target.style.boxShadow = ''; }, 1800);
  }, 150);
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
