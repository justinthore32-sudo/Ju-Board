/* ============================================
   JU BOARD — calendar-widget.js
   Badge rouge "?" sur l'icône calendrier du header
   (toutes les pages) quand une échéance approche ou
   qu'un résultat récent déçoit. Le clic amène
   directement sur calendrier.html (voir js/calendrier.js
   pour le contenu complet de cette page).
   ============================================ */

/* Repli si la watchlist est indisponible (erreur réseau, etc.) — les
   géants tech restent surveillés dans tous les cas. */
const DEFAULT_CALENDAR_SYMBOLS = ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'INTC', 'AMD'];

const CALENDAR_CACHE_KEY = 'ju-board-earnings-cache';
const CALENDAR_CACHE_TTL = 15 * 60 * 1000;

async function getEarningsBadgeData() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CALENDAR_CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.timestamp < CALENDAR_CACHE_TTL) return cached.data;
  } catch (err) {
    /* cache corrompu, on ignore */
  }

  let symbols = DEFAULT_CALENDAR_SYMBOLS;
  if (typeof fetchWatchlist === 'function') {
    try {
      const wl = await fetchWatchlist();
      if (wl.watchlist && wl.watchlist.length > 0) {
        symbols = Array.from(new Set([...DEFAULT_CALENDAR_SYMBOLS, ...wl.watchlist.map((c) => c.symbol)]));
      }
    } catch (err) {
      /* watchlist indisponible, on retombe sur les géants tech */
    }
  }

  const data = await fetchEarnings(symbols);
  sessionStorage.setItem(CALENDAR_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
  return data;
}

async function updateCalendarBadge() {
  const badge = document.getElementById('calendar-badge');
  if (!badge || typeof fetchEarnings !== 'function') return;

  try {
    const data = await getEarningsBadgeData();
    const now = Date.now();
    const todayStr = new Date().toISOString().slice(0, 10);
    let important = false;

    (data.results || []).forEach((r) => {
      const entries = r.entries || [];
      const next = entries.filter((e) => e.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date))[0];
      if (next && new Date(next.date).getTime() - now < 3 * 24 * 60 * 60 * 1000) important = true;

      const past = entries.filter((e) => e.date < todayStr && e.epsActual != null).sort((a, b) => b.date.localeCompare(a.date))[0];
      if (past && now - new Date(past.date).getTime() < 3 * 24 * 60 * 60 * 1000 && past.epsActual < past.epsEstimate) important = true;
    });

    badge.classList.toggle('hidden', !important);
  } catch (err) {
    /* silencieux — le badge reste caché en cas d'erreur */
  }
}

document.addEventListener('DOMContentLoaded', updateCalendarBadge);
