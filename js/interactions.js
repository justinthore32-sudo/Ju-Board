/* ============================================
   JU BOARD — interactions.js
   Pull-to-refresh, auto-refresh 30 min, appui long
   (copier/partager) et swipe gauche (marquer lu).
   ============================================ */

const CARD_SELECTOR = '.news-card, .priority-news, .result-item, .sector-card';
const READ_KEY = 'ju-board-read-articles';

/* ---------- LECTURE (état persistant) ---------- */
function getReadSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]'));
  } catch (err) {
    return new Set();
  }
}

function markAsRead(id) {
  const set = getReadSet();
  set.add(id);
  localStorage.setItem(READ_KEY, JSON.stringify([...set]));
}

function cardId(card) {
  const link = card.querySelector('a[href]');
  const title = card.querySelector('.news-title, .result-title')?.textContent?.trim();
  return link?.getAttribute('href') || title || '';
}

function applyReadStates() {
  const readSet = getReadSet();
  document.querySelectorAll(CARD_SELECTOR).forEach((card) => {
    if (readSet.has(cardId(card))) card.classList.add('card-read');
  });
}

/* ---------- PULL-TO-REFRESH ---------- */
function initPullToRefresh() {
  let startY = null;
  let pulling = false;
  const threshold = 70;

  document.addEventListener('touchstart', (e) => {
    if (window.scrollY <= 0) {
      startY = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!pulling || startY === null) return;
    const delta = e.touches[0].clientY - startY;
    if (delta > threshold) {
      document.body.style.setProperty('--pull-hint', '1');
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!pulling || startY === null) return;
    const delta = (e.changedTouches[0]?.clientY || startY) - startY;
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

  const menu = document.createElement('div');
  menu.className = 'longpress-menu';
  menu.style.left = `${Math.min(x, window.innerWidth - 180)}px`;
  menu.style.top = `${y}px`;
  menu.innerHTML = `
    <button data-action="copy">📋 Copier le titre</button>
    <button data-action="share">↗ Partager</button>`;
  document.body.appendChild(menu);

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
      markAsRead(cardId(card));
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
