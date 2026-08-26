/* ============================================
   JU BOARD — analyse.js
   Page Analyse : filtres catégories, toggle analyse
   approfondie, graphique de cycle Chart.js
   ============================================ */

function initCategoryTabs() {
  const tabs = document.querySelectorAll('.category-tab');
  const cards = document.querySelectorAll('.company-card');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const cat = tab.dataset.cat;
      cards.forEach((card) => {
        const match = cat === 'all' || card.dataset.cat === cat;
        card.classList.toggle('hidden', !match);
      });
    });
  });
}

function initDeepToggle() {
  document.querySelectorAll('[data-action="toggle-deep"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.company-card');
      const deep = card.querySelector('.deep-analysis');
      const isHidden = deep.classList.contains('hidden');
      deep.classList.toggle('hidden');
      btn.textContent = isHidden ? 'Réduire ←' : 'Analyse approfondie →';
    });
  });
}

function initCycleChart() {
  const canvas = document.getElementById('chart-apple');
  if (!canvas || typeof Chart === 'undefined') return;

  const years = ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
  const values = [42, 44, 55, 78, 145, 160, 175, 220, 235, 228];

  const cycleZones = {
    id: 'cycleZones',
    beforeDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea) return;
      const zones = [
        { from: 0, to: 3, color: 'rgba(37, 99, 235, 0.06)' },
        { from: 3, to: 8, color: 'rgba(22, 163, 74, 0.06)' },
        { from: 8, to: 9, color: 'rgba(217, 119, 6, 0.08)' }
      ];
      ctx.save();
      zones.forEach((zone) => {
        const x1 = scales.x.getPixelForValue(zone.from);
        const x2 = scales.x.getPixelForValue(zone.to);
        ctx.fillStyle = zone.color;
        ctx.fillRect(x1, chartArea.top, x2 - x1, chartArea.bottom - chartArea.top);
      });
      ctx.restore();
    }
  };

  new Chart(canvas, {
    type: 'line',
    data: {
      labels: years,
      datasets: [{
        data: values,
        borderColor: '#2563EB',
        backgroundColor: 'rgba(37, 99, 235, 0.08)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: 'rgba(148, 163, 184, 0.15)' }, ticks: { font: { size: 10 } } }
      }
    },
    plugins: [cycleZones]
  });
}

function scrollToHashCompany() {
  if (!window.location.hash) return;
  const target = document.querySelector(window.location.hash);
  if (!target) return;
  window.setTimeout(() => {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.style.transition = 'box-shadow 0.3s';
    target.style.boxShadow = '0 0 0 3px var(--accent)';
    window.setTimeout(() => { target.style.boxShadow = ''; }, 1800);
  }, 150);
}

document.addEventListener('DOMContentLoaded', () => {
  initCategoryTabs();
  initDeepToggle();
  initCycleChart();
  scrollToHashCompany();
});
