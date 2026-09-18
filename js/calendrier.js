/* ============================================
   JU BOARD — calendrier.js
   Page Calendrier des résultats : tableau complet
   à venir / précédent, géants tech toujours affichés.
   ============================================ */

/* Les géants tech restent toujours affichés (exigence d'origine),
   quelle que soit la watchlist de l'utilisateur. Le reste du tableau
   vient maintenant de la vraie watchlist (/api/watchlist) au lieu d'une
   liste figée déconnectée de ce que l'utilisateur suit réellement. */
const TECH_GIANT_SYMBOLS = new Set(['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'INTC', 'AMD']);

const TECH_GIANT_COMPANIES = [
  { name: 'Apple', symbol: 'AAPL' },
  { name: 'Nvidia', symbol: 'NVDA' },
  { name: 'Microsoft', symbol: 'MSFT' },
  { name: 'Alphabet (Google)', symbol: 'GOOGL' },
  { name: 'Amazon', symbol: 'AMZN' },
  { name: 'Meta', symbol: 'META' },
  { name: 'Tesla', symbol: 'TSLA' },
  { name: 'Intel', symbol: 'INTC' },
  { name: 'AMD', symbol: 'AMD' }
];

async function buildCalCompanies() {
  const companies = TECH_GIANT_COMPANIES.map((c) => ({ ...c, slug: c.symbol }));
  const seen = new Set(TECH_GIANT_SYMBOLS);

  if (typeof fetchWatchlist === 'function') {
    try {
      const data = await fetchWatchlist();
      (data.watchlist || []).forEach((entry) => {
        if (seen.has(entry.symbol)) return;
        seen.add(entry.symbol);
        companies.push({ name: entry.name, symbol: entry.symbol, slug: entry.symbol });
      });
    } catch (err) {
      /* watchlist indisponible — les géants tech restent affichés seuls */
    }
  }

  return companies;
}

function initials(name) {
  return name.split(/[\s&(]/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function pastelColor(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

function calFmtDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function calSurprise(actual, estimate) {
  if (actual == null || estimate == null || estimate === 0) return null;
  return (((actual - estimate) / Math.abs(estimate)) * 100).toFixed(1);
}

function companyCell(company) {
  const bg = pastelColor(company.symbol);
  return `
    <div style="display:flex; align-items:center; gap:10px;">
      <span style="width:28px; height:28px; border-radius:50%; background:${bg}; color:white; display:flex; align-items:center; justify-content:center; font-family:var(--font-sans); font-weight:700; font-size:11px; flex-shrink:0;">${initials(company.name)}</span>
      ${company.slug ? `<a href="analyse.html#company-${company.slug}" style="font-weight:600; color:var(--primary);">${company.name}</a>` : `<span style="font-weight:600; color:var(--primary);">${company.name}</span>`}
    </div>`;
}

function renderUpcomingTable(rows) {
  if (rows.length === 0) return '<tbody><tr><td colspan="3" style="color:var(--text3); font-size:12px; padding:14px;">Aucune date connue.</td></tr></tbody>';
  return `
    <thead><tr><th>Entreprise</th><th>Date</th><th>Trimestre</th></tr></thead>
    <tbody>
      ${rows.map(({ company, entry }) => `
        <tr>
          <td>${companyCell(company)}</td>
          <td class="mono">${entry ? calFmtDate(entry.date) : '—'}</td>
          <td class="mono">${entry ? `T${entry.quarter} ${entry.year}` : '—'}</td>
        </tr>`).join('')}
    </tbody>`;
}

function renderLatestTable(rows) {
  if (rows.length === 0) return '<tbody><tr><td colspan="5" style="color:var(--text3); font-size:12px; padding:14px;">Aucun résultat récent.</td></tr></tbody>';
  return `
    <thead><tr><th>Entreprise</th><th>Date</th><th>EPS réel</th><th>EPS est.</th><th>Écart</th></tr></thead>
    <tbody>
      ${rows.map(({ company, entry }) => {
        if (!entry) {
          return `<tr><td>${companyCell(company)}</td><td class="mono">—</td><td class="mono">—</td><td class="mono">—</td><td class="mono">—</td></tr>`;
        }
        const surprise = calSurprise(entry.epsActual, entry.epsEstimate);
        const cls = surprise === null ? '' : (parseFloat(surprise) >= 0 ? 'beat' : 'miss');
        return `
          <tr>
            <td>${companyCell(company)}</td>
            <td class="mono">${calFmtDate(entry.date)}</td>
            <td class="mono">${entry.epsActual ?? '–'}</td>
            <td class="mono">${entry.epsEstimate ?? '–'}</td>
            <td class="mono ${cls}">${surprise !== null ? `${surprise > 0 ? '+' : ''}${surprise}%` : '—'}</td>
          </tr>`;
      }).join('')}
    </tbody>`;
}

async function loadCalendrierPage() {
  const calCompanies = await buildCalCompanies();
  const symbols = calCompanies.map((c) => c.symbol);
  const data = await fetchEarnings(symbols);
  const todayStr = new Date().toISOString().slice(0, 10);

  const techUpcoming = [];
  const otherUpcoming = [];
  const techLatest = [];
  const otherLatest = [];

  calCompanies.forEach((company) => {
    const result = data.results?.find((r) => r.symbol === company.symbol);
    const entries = (result?.entries || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const next = entries.find((e) => e.date >= todayStr) || null;
    const past = entries.filter((e) => e.date < todayStr && e.epsActual != null).pop() || null;

    const isTech = TECH_GIANT_SYMBOLS.has(company.symbol);
    (isTech ? techUpcoming : otherUpcoming).push({ company, entry: next });
    if (isTech || past) (isTech ? techLatest : otherLatest).push({ company, entry: past });
  });

  const sortEntries = (a, b) => (a.entry?.date || '9999').localeCompare(b.entry?.date || '9999');
  otherUpcoming.filter((r) => r.entry).sort(sortEntries);
  otherLatest.filter((r) => r.entry).sort((a, b) => (b.entry?.date || '').localeCompare(a.entry?.date || ''));

  document.getElementById('table-tech-upcoming').innerHTML = renderUpcomingTable(techUpcoming);
  document.getElementById('table-other-upcoming').innerHTML = renderUpcomingTable(otherUpcoming.filter((r) => r.entry));
  document.getElementById('table-tech-latest').innerHTML = renderLatestTable(techLatest);
  document.getElementById('table-other-latest').innerHTML = renderLatestTable(otherLatest.filter((r) => r.entry));

  initTableScrollShadows();
}

/* Ombre sur le bord droit tant qu'il reste des colonnes non visibles
   (le tableau défile horizontalement mais rien ne le signalait avant). */
function initTableScrollShadows() {
  document.querySelectorAll('.table-wrap').forEach((wrap) => {
    const update = () => {
      const scrollable = wrap.scrollWidth > wrap.clientWidth + 2;
      const atEnd = wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth - 2;
      wrap.classList.toggle('scrolled-end', !scrollable || atEnd);
    };
    update();
    wrap.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  });
}

function initTabs() {
  const tabs = document.querySelectorAll('.sort-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-upcoming').classList.toggle('hidden', tab.dataset.tab !== 'upcoming');
      document.getElementById('tab-latest').classList.toggle('hidden', tab.dataset.tab !== 'latest');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadCalendrierPage();
});
