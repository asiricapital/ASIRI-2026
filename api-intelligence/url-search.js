(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const query = String(params.get('search') || params.get('q') || '').trim();
  if (!query) return;

  const input = document.getElementById('searchInput');
  if (!input) return;

  input.value = query;
  input.dispatchEvent(new Event('input', { bubbles: true }));

  requestAnimationFrame(() => {
    const catalog = document.getElementById('catalog');
    catalog?.scrollIntoView({ block: 'start' });
  });
})();
