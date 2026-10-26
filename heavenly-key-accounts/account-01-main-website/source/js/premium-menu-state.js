/* Shared current-page navigation state. Leaves existing menu click handlers intact. */
(() => {
  'use strict';
  function init() {
    const nav = document.querySelector('header.site-header #main-nav');
    if (!nav) return;
    const current = location.pathname.replace(/\\/g, '/').replace(/\\.html$/i, '').replace(/\\/+$|^$/g, '') || '/';
    const isHome = ['/', '/index', '/home'].includes(current);
    for (const link of nav.querySelectorAll('a')) {
      const previous = link.getAttribute('aria-current');
      if (previous === 'page') link.removeAttribute('aria-current');
      link.classList.remove('active');
      const url = new URL(link.getAttribute('href') || '', location.href);
      const path = url.pathname.replace(/\\.html$/i, '').replace(/\\/+$|^$/g, '') || '/';
      const linkIsHome = link.getAttribute('href') === '#main' || path === '/#main' || path === '/';
      const matches = (isHome && linkIsHome) || (!isHome && url.origin === location.origin && path === current);
      if (matches) {
        link.setAttribute('aria-current', 'page');
        link.classList.add('active');
        const parent = link.closest('details');
        if (parent) parent.classList.add('hk-nav-current');
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
