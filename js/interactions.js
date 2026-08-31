/* ============================================
   JU BOARD — interactions.js
   Pull-to-refresh, auto-refresh 30 min, appui long
   (copier/partager) et swipe gauche (marquer lu).
   ============================================ */

const CARD_SELECTOR = '.news-card, .priority-news, .result-item, .sector-card';
const READ_KEY = 'ju-board-read-articles';

/* ---------- LECTURE (état persistant + historique consultable) ---------- */
function getReadData() {
  try {
    const raw = JSON.parse(localStorage.getItem(READ_KEY) || '{}');
    if (Array.isArray(raw)) {
      /* migration depuis l'ancien format (tableau d'IDs sans titre) */
      const migrated = {};
      raw.forEach((id) => { migrated[id] = { title: id, link: '', readAt: Date.now() }; });
      return migrated;
    }
    return raw;
  } catch (err) {
    return {};
  }
}

function getReadSet() {
  return new Set(Object.keys(getReadData()));
}

function markAsRead(id, card) {
  if (!id) return;
  const data = getReadData();
  const title = card?.querySelector('.news-title, .result-title')?.textContent?.trim() || id;
  const link = card?.querySelector('a[href]')?.getAttribute('href') || '';
  data[id] = { title, link, readAt: Date.now() };
  localStorage.setItem(READ_KEY, JSON.stringify(data));
}

/* L'URL interne (article.html?...) embarque un label "Il y a 3h" qui change
   avec le temps : l'utiliser comme identifiant ferait "oublier" un article
   déjà lu. On extrait plutôt l'URL source (stable) du paramètre `url`. */
function cardId(card) {
  const link = card.querySelector('a[href]');
  const href = link?.getAttribute('href') || '';
  if (href.includes('article.html?')) {
    try {
      const sourceUrl = new URLSearchParams(href.split('?')[1] || '').get('url');
      if (sourceUrl) return sourceUrl;
    } catch (err) { /* on retombe sur le href complet ci-dessous */ }
  }
  const title = card.querySelector('.news-title, .result-title')?.textContent?.trim();
  return href || title || '';
}

function applyReadStates() {
  const readSet = getReadSet();
  document.querySelectorAll(CARD_SELECTOR).forEach((card) => {
    if (readSet.has(cardId(card))) card.classList.add('card-read');
  });
}

/* ---------- FAVORIS ---------- */
const FAV_KEY = 'ju-board-favorites';

function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '{}'); }
  catch (err) { return {}; }
}

function saveFavorites(favs) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); } catch (err) { /* stockage indisponible */ }
}

function isFavorite(id) {
  return !!getFavorites()[id];
}

function toggleFavorite(card) {
  const id = cardId(card);
  if (!id) return false;
  const favs = getFavorites();
  if (favs[id]) {
    delete favs[id];
    saveFavorites(favs);
    return false;
  }
  const title = card.querySelector('.news-title, .result-title')?.textContent?.trim() || '';
  const link = card.querySelector('a[href]')?.getAttribute('href') || '';
  favs[id] = { title, link, savedAt: Date.now() };
  saveFavorites(favs);
  return true;
}

/* ---------- PULL-TO-REFRESH ---------- */
function createPullIndicator() {
  const el = document.createElement('div');
  el.className = 'pull-indicator';
  el.textContent = '↓';
  document.body.appendChild(el);
  return el;
}

function initPullToRefresh() {
  let startY = null;
  let pulling = false;
  const threshold = 70;
  const indicator = createPullIndicator();

  document.addEventListener('touchstart', (e) => {
    if (window.scrollY <= 0) {
      startY = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!pulling || startY === null) return;
    const delta = e.touches[0].clientY - startY;
    if (delta > 4) {
      const progress = Math.min(1, delta / threshold);
      indicator.style.opacity = progress;
      indicator.style.transform = `translateX(-50%) rotate(${progress * 180}deg)`;
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!pulling || startY === null) return;
    const delta = (e.changedTouches[0]?.clientY || startY) - startY;
    indicator.style.opacity = '0';
    indicator.style.transform = 'translateX(-50%) rotate(0deg)';
    if (delta > threshold && window.scrollY <= 0) {
      if (typeof window.juBoardRefresh === 'function') {
        window.juBoardRefresh();
        if (typeof showToast === 'function') showToast('Contenu mis à jour');
      }
    }
    startY = null;
    pulling = false;
  });
}

/* ---------- AUTO-REFRESH (30 min) ---------- */
function initAutoRefresh() {
  window.setInterval(() => {
    if (typeof window.juBoardRefresh === 'function') {
      window.juBoardRefresh();
      if (typeof showToast === 'function') showToast('Contenu mis à jour');
    }
  }, 30 * 60 * 1000);
}

/* ---------- APPUI LONG : copier / partager ---------- */
function closeLongPressMenu() {
  document.querySelector('.longpress-menu')?.remove();
}

function showLongPressMenu(card, x, y) {
  closeLongPressMenu();

  const title = card.querySelector('.news-title, .result-title')?.textContent?.trim() || '';
  const link = card.querySelector('a[href]')?.getAttribute('href') || '';
  const favored = isFavorite(cardId(card));

  const menu = document.createElement('div');
  menu.className = 'longpress-menu';
  menu.style.left = `${Math.min(x, window.innerWidth - 180)}px`;
  menu.style.top = `${y}px`;
  menu.innerHTML = `
    <button data-action="favorite">${favored ? '★ Retirer des favoris' : '☆ Sauvegarder'}</button>
    <button data-action="copy">📋 Copier le titre</button>
    <button data-action="share">↗ Partager</button>`;
  document.body.appendChild(menu);

  menu.querySelector('[data-action="favorite"]').addEventListener('click', () => {
    const added = toggleFavorite(card);
    if (typeof showToast === 'function') showToast(added ? 'Ajouté aux favoris' : 'Retiré des favoris');
    closeLongPressMenu();
  });

  menu.querySelector('[data-action="copy"]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(title);
      if (typeof showToast === 'function') showToast('Titre copié');
    } catch (err) {
      /* clipboard indisponible */
    }
    closeLongPressMenu();
  });

  menu.querySelector('[data-action="share"]').addEventListener('click', async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url: link || undefined });
      } catch (err) {
        /* partage annulé */
      }
    } else if (link) {
      try {
        await navigator.clipboard.writeText(link);
        if (typeof showToast === 'function') showToast('Lien copié');
      } catch (err) {
        /* clipboard indisponible */
      }
    }
    closeLongPressMenu();
  });

  window.setTimeout(() => {
    document.addEventListener('touchstart', closeLongPressMenu, { once: true });
    document.addEventListener('click', closeLongPressMenu, { once: true });
  }, 50);
}

function initLongPress() {
  let timer = null;
  let startX = 0;
  let startY = 0;
  let targetCard = null;

  document.addEventListener('touchstart', (e) => {
    const card = e.target.closest(CARD_SELECTOR);
    if (!card) return;
    targetCard = card;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    timer = window.setTimeout(() => {
      showLongPressMenu(card, startX, startY);
      targetCard = null;
    }, 550);
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!timer) return;
    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dx > 10 || dy > 10) {
      window.clearTimeout(timer);
      timer = null;
    }
  }, { passive: true });

  document.addEventListener('touchend', () => {
    window.clearTimeout(timer);
    timer = null;
  });
}

/* ---------- SWIPE GAUCHE : marquer comme lue ---------- */
function initSwipeToRead() {
  let startX = null;
  let startY = null;
  let card = null;

  document.addEventListener('touchstart', (e) => {
    card = e.target.closest(CARD_SELECTOR);
    if (!card) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!card || startX === null) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy)) {
      card.style.transform = `translateX(${Math.min(0, Math.max(dx, -80))}px)`;
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!card || startX === null) return;
    const dx = (e.changedTouches[0]?.clientX || startX) - startX;
    card.style.transform = '';
    if (dx < -60) {
      card.classList.add('card-read');
      markAsRead(cardId(card), card);
    }
    card = null;
    startX = null;
    startY = null;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  applyReadStates();
  initPullToRefresh();
  initAutoRefresh();
  initLongPress();
  initSwipeToRead();
});
