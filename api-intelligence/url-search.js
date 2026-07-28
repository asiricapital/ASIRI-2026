(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const query = String(params.get('search') || params.get('q') || '').trim();
  if (!query) return;

  function applySearch() {
    const input = document.getElementById('searchInput');
    if (!input) return false;

    if (input.value !== query) input.value = query;
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const catalog = document.getElementById('catalog');
    requestAnimationFrame(() => catalog?.scrollIntoView({ block: 'start' }));
    return true;
  }

  if (!applySearch()) {
    document.addEventListener('DOMContentLoaded', applySearch, { once: true });
  }

  // Safari/PWA may restore form state after scripts run; re-apply once more.
  window.addEventListener('pageshow', applySearch, { once: true });
  setTimeout(applySearch, 250);
})();
