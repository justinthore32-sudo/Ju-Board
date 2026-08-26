/* ============================================
   JU BOARD — home.js
   Page Accueil : Priorité Absolue, À ne pas manquer
   et grille des secteurs — vraies news (NewsAPI).

   Pas encore d'IA branchée : la sélection "priorité"
   et "positif" utilise des requêtes NewsAPI ciblées en
   attendant un vrai tri par importance/impact via Claude.
   ============================================ */

const SECTORS = [
  { icon: '💰', name: 'Économie', query: 'économie OR marchés financiers OR banque centrale', param: 'economie' },
  { icon: '🌍', name: 'Géopolitique', query: 'géopolitique OR diplomatie OR conflit international', param: 'geopolitique' },
  { icon: '💻', name: 'Tech & IA', query: 'intelligence artificielle OR technologie', param: 'tech' },
  { icon: '🌱', name: 'Environnement', query: 'climat OR environnement', param: 'environnement' },
  { icon: '🏛️', name: 'Politique', query: 'politique France OR Europe', param: 'politique' },
  { icon: '💊', name: 'Santé', query: 'santé OR médecine OR vaccin', param: 'sante' },
  { icon: '🚀', name: 'Spatial', query: 'espace OR spatial OR NASA', param: 'spatial' },
  { icon: '⚡', name: 'Énergie', query: 'énergie OR pétrole OR nucléaire', param: 'energie' },
  { icon: '📚', name: 'Histoire', query: 'histoire', param: 'histoire' },
  { icon: '🎭', name: 'Société', query: 'société', param: 'societe' }
];

function timeAgo(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.round(hours / 24);
  return `Il y a ${days}j`;
}

function renderNewsBlock(article) {
  return `
    <div class="priority-news">
      <div class="news-meta">
        <span class="sector-badge">🌐 ${article.source?.name || 'Actualité'}</span>
        <span>${timeAgo(article.publishedAt)}</span>
      </div>
      <a href="${article.url}" target="_blank" rel="noopener" style="text-decoration: none;">
        <h3 class="news-title">${article.title || 'Sans titre'}</h3>
      </a>
      <p class="news-summary">${article.description || ''}</p>
    </div>`;
}

async function loadNewsBlock(containerId, query, count = 3) {
  const container = document.getElementById(containerId);
  if (!container || typeof fetchNews !== 'function') return;

  try {
    const data = await fetchNews(query);
    if (data.status !== 'ok') throw new Error(data.message || 'Erreur');
    const articles = (data.articles || []).filter((a) => a.title && a.title !== '[Removed]').slice(0, count);
    if (articles.length === 0) {
      container.innerHTML = '<p style="color: var(--text3); font-size: 13px;">Aucune actualité disponible pour le moment.</p>';
      return;
    }
    container.innerHTML = articles.map(renderNewsBlock).join('');
  } catch (err) {
    container.innerHTML = `<p style="color: var(--red); font-size: 13px;">Erreur de chargement : ${err.message}</p>`;
  }
}

async function loadSectors() {
  const grid = document.getElementById('sectors-grid');
  if (!grid || typeof fetchNews !== 'function') return;

  const results = await Promise.all(
    SECTORS.map(async (sector) => {
      try {
        const data = await fetchNews(sector.query);
        const article = (data.articles || []).find((a) => a.title && a.title !== '[Removed]');
        return { sector, headline: article ? article.title : "Pas d'actualité pour le moment" };
      } catch (err) {
        return { sector, headline: 'Erreur de chargement' };
      }
    })
  );

  grid.innerHTML = results.map(({ sector, headline }) => `
    <a href="news.html?secteur=${sector.param}" class="card sector-card">
      <span class="sector-icon">${sector.icon}</span>
      <span class="sector-name">${sector.name}</span>
      <span class="sector-headline">${headline}</span>
    </a>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  loadNewsBlock('priority-list', 'actualité importante France monde', 3);
  loadNewsBlock('highlight-list', 'découverte OR avancée scientifique OR record positif', 3);
  loadSectors();
});
