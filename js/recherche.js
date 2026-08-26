/* ============================================
   JU BOARD — recherche.js
   Page Recherche avancée : filtres + réponse IA
   de secours si aucun résultat news
   ============================================ */

function initFilterChips() {
  document.querySelectorAll('.filter-chips').forEach((group) => {
    const chips = group.querySelectorAll('.filter-chip');
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });
  });
}

function initAdvancedSearch() {
  const input = document.getElementById('advanced-search-input');
  const resultsMeta = document.getElementById('results-meta');
  const resultsList = document.querySelector('.news-list');
  const aiBox = document.getElementById('ai-answer-box');
  const aiText = document.getElementById('ai-answer-text');
  if (!input) return;

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const query = input.value.trim();
    if (!query) return;

    const hasResults = resultsList.querySelectorAll('.result-item').length > 0;

    if (!hasResults) {
      aiBox.classList.add('active');
      aiText.textContent = `Aucun résultat trouvé dans les news pour « ${query} ». Voici une réponse contextuelle générée par l'IA à ce sujet — cette fonctionnalité nécessite la connexion à l'API Anthropic.`;
    } else {
      resultsMeta.textContent = `Résultats pour « ${query} »`;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initFilterChips();
  initAdvancedSearch();
});
