/* ============================================
   JU BOARD — news.js
   Page News : filtres, tri, expansion des cartes
   ============================================ */

const SUBDOMAINS = {
  economie: ['Marchés actions', 'Obligataire', 'Crypto', 'Banques centrales', 'M&A', 'Private equity', 'IPO'],
  geopolitique: ['Europe', 'USA', 'Chine', 'Russie', 'Moyen-Orient', 'Afrique', 'Asie', 'Amérique latine'],
  tech: ['Intelligence artificielle', 'Semiconducteurs', 'Cloud', 'Cybersécurité', 'Quantum', 'Robotique'],
  environnement: ['Changement climatique', 'Biodiversité', 'Océans', 'Forêts', 'Agriculture', 'COP'],
  politique: ['France', 'Europe', 'USA', 'Élections mondiales', 'Régulation', 'Institutions'],
  sante: ['Biotech', 'Pharma', 'Épidémies', 'Oncologie', 'Recherche', 'OMS', 'FDA'],
  spatial: ['Exploration', 'Satellites', 'Défense spatiale', 'Tourisme spatial', 'Agences'],
  energie: ['Pétrole-gaz', 'Nucléaire', 'Solaire', 'Éolien', 'Hydrogène', 'Matières premières'],
  histoire: ['Anniversaires', 'Parallèles historiques', 'Contexte', 'Commémorations'],
  societe: ['Tendances sociales', 'Démographie', 'Culture', 'Sciences sociales']
};

function initDomainFilter() {
  const domainSelect = document.getElementById('domain-select');
  const subdomainSelect = document.getElementById('subdomain-select');
  const cards = document.querySelectorAll('.news-card');
  if (!domainSelect || !subdomainSelect) return;

  function populateSubdomains(domain) {
    subdomainSelect.innerHTML = '<option value="all">Tous les sous-domaines</option>';
    const list = SUBDOMAINS[domain];
    if (!list) return;
    list.forEach((label) => {
      const opt = document.createElement('option');
      opt.value = label;
      opt.textContent = label;
      subdomainSelect.appendChild(opt);
    });
  }

  function applyFilter() {
    const domain = domainSelect.value;
    cards.forEach((card) => {
      const match = domain === 'all' || card.dataset.domain === domain;
      card.classList.toggle('hidden', !match);
    });
  }

  domainSelect.addEventListener('change', () => {
    populateSubdomains(domainSelect.value);
    applyFilter();
  });

  subdomainSelect.addEventListener('change', applyFilter);
}

function initSortTabs() {
  const tabs = document.querySelectorAll('.sort-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });
}

function initExpandCards() {
  document.querySelectorAll('.btn-expand').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.news-card');
      const expanded = card.querySelector('.news-expanded');
      const isHidden = expanded.classList.contains('hidden');
      expanded.classList.toggle('hidden');
      btn.textContent = isHidden ? 'Réduire ↑' : 'Lire plus ↓';
    });
  });
}

function initLoadMore() {
  const btn = document.getElementById('load-more');
  if (!btn) return;
  btn.addEventListener('click', () => {
    showToast('Toutes les news du moment sont affichées');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initDomainFilter();
  initSortTabs();
  initExpandCards();
  initLoadMore();
});
