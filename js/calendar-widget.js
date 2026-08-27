/* ============================================
   JU BOARD — calendar-widget.js
   Icône calendrier dans le header (toutes les pages) :
   panneau avec les résultats à venir / derniers résultats,
   badge rouge "?" si une info importante approche.
   ============================================ */

const CALENDAR_WIDGET_COMPANIES = [
  { name: 'Apple', symbol: 'AAPL', slug: 'apple' },
  { name: 'Nvidia', symbol: 'NVDA', slug: 'nvidia' },
  { name: 'Microsoft', symbol: 'MSFT' },
  { name: 'Alphabet (Google)', symbol: 'GOOGL' },
  { name: 'Amazon', symbol: 'AMZN' },
  { name: 'Meta', symbol: 'META' },
  { name: 'Tesla', symbol: 'TSLA' },
  { name: 'Intel', symbol: 'INTC' },
  { name: 'AMD', symbol: 'AMD' },
  { name: 'JPMorgan Chase', symbol: 'JPM', slug: 'jpmorgan-chase' },
  { name: 'Goldman Sachs', symbol: 'GS' },
  { name: 'BlackRock', symbol: 'BLK' },
  { name: 'Visa', symbol: 'V' },
  { name: 'Mastercard', symbol: 'MA' },
  { name: 'UnitedHealth', symbol: 'UNH' },
  { name: 'Pfizer', symbol: 'PFE' },
  { name: 'Johnson & Johnson', symbol: 'JNJ' },
  { name: 'Moderna', symbol: 'MRNA' },
  { name: 'LVMH', symbol: 'MC.PA', slug: 'lvmh' },
  { name: 'ExxonMobil', symbol: 'XOM', slug: 'exxonmobil' },
  { name: 'Saudi Aramco', symbol: '2222.SR', slug: 'saudi-aramco' }
];

const CALENDAR_CACHE_KEY = 'ju-board-earnings-cache';
const CALENDAR_CACHE_TTL = 15 * 60 * 1000;

function formatCalDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function calBeatOrMiss(actual, estimate) {
  if (actual == null || estimate == null) return null;
  return actual >= estimate ? 'beat' : 'miss';
}

function calCompanyHref(company) {
  return company.slug ? `analyse.html#company-${company.slug}` : 'analyse.html';
}

async function getEarningsData() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CALENDAR_CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.timestamp < CALENDAR_CACHE_TTL) {
      return cached.data;
    }
  } catch (err) {
    /* cache corrompu, on ignore */
  }

  const symbols = CALENDAR_WIDGET_COMPANIES.map((c) => c.symbol);
  const data = await fetchEarnings(symbols);
  sessionStorage.setItem(CALENDAR_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
  return data;
}

function buildUpcomingLatest(data) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcoming = [];
  const latest = [];

  CALENDAR_WIDGET_COMPANIES.forEach((company) => {
    const result = data.results?.find((r) => r.symbol === company.symbol);
    const entries = (result?.entries || []).slice().sort((a, b) => a.date.localeCompare(b.date));

    const next = entries.find((e) => e.date >= todayStr);
    if (next) upcoming.push({ company, entry: next });

    const past = entries.filter((e) => e.date < todayStr && e.epsActual != null).pop();
    if (past) latest.push({ company, entry: past });
  });

  upcoming.sort((a, b) => a.entry.date.localeCompare(b.entry.date));
  latest.sort((a, b) => b.entry.date.localeCompare(a.entry.date));
  return { upcoming, latest };
}

function isImportant({ upcoming, latest }) {
  const now = Date.now();
  const soon = upcoming.some((u) => new Date(u.entry.date).getTime() - now < 3 * 24 * 60 * 60 * 1000);
  const recentMiss = latest.some((l) => {
    const recent = now - new Date(l.entry.date).getTime() < 3 * 24 * 60 * 60 * 1000;
    return recent && calBeatOrMiss(l.entry.epsActual, l.entry.epsEstimate) === 'miss';
  });
  return soon || recentMiss;
}

async function loadCalendarWidget() {
  const upcomingEl = document.getElementById('calendar-upcoming');
  const latestEl = document.getElementById('calendar-latest');
  const badge = document.getElementById('calendar-badge');
  if (!upcomingEl || !latestEl || typeof fetchEarnings !== 'function') return;

  try {
    const data = await getEarningsData();
    const { upcoming, latest } = buildUpcomingLatest(data);

    badge.classList.toggle('hidden', !isImportant({ upcoming, latest }));

    upcomingEl.innerHTML = upcoming.length === 0
      ? '<p style="color: var(--text3); font-size: 12px; padding: 8px 14px;">Rien de prévu.</p>'
      : upcoming.slice(0, 5).map(({ company, entry }) => `
        <a href="${calCompanyHref(company)}" class="search-result earnings-item">
          <div class="earnings-item-left">
            <span class="earnings-company">${company.name}</span>
            <span class="earnings-date">${formatCalDate(entry.date)} · T${entry.quarter} ${entry.year}</span>
          </div>
        </a>`).join('');

    latestEl.innerHTML = latest.length === 0
      ? '<p style="color: var(--text3); font-size: 12px; padding: 8px 14px;">Aucun résultat récent.</p>'
      : latest.slice(0, 5).map(({ company, entry }) => {
        const status = calBeatOrMiss(entry.epsActual, entry.epsEstimate);
        const statusLabel = status === 'beat' ? '↑' : status === 'miss' ? '↓' : '';
        return `
          <a href="${calCompanyHref(company)}" class="search-result earnings-item">
            <div class="earnings-item-left">
              <span class="earnings-company">${company.name}</span>
              <span class="earnings-date">${formatCalDate(entry.date)} · EPS ${entry.epsActual ?? '–'}</span>
            </div>
            <span class="earnings-figures"><span class="${status}">${statusLabel}</span></span>
          </a>`;
      }).join('');
  } catch (err) {
    upcomingEl.innerHTML = `<p style="color: var(--red); font-size: 12px; padding: 8px 14px;">Erreur : ${err.message}</p>`;
    latestEl.innerHTML = '';
  }
}

function initCalendarWidget() {
  const btn = document.getElementById('calendar-btn');
  const panel = document.getElementById('calendar-panel');
  if (!btn || !panel) return;

  btn.addEventListener('click', () => panel.classList.toggle('active'));

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.calendar-widget-wrap')) panel.classList.remove('active');
  });

  /* Chargé au démarrage de la page pour que le badge reflète l'état à jour,
     même si le panneau n'est jamais ouvert. */
  loadCalendarWidget();
}

document.addEventListener('DOMContentLoaded', initCalendarWidget);
