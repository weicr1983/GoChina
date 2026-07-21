/* ========================================
   common.js — 通用：导航、年份、滚动
   ======================================== */
(function () {
  'use strict';

  function setYear() {
    document.querySelectorAll('[data-year]').forEach(el => {
      el.textContent = new Date().getFullYear();
    });
  }

  function mobileNav() {
    const burger = document.querySelector('[data-nav-burger]');
    const panel = document.querySelector('[data-nav-mobile]');
    if (!burger || !panel) return;
    burger.addEventListener('click', () => {
      const open = panel.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
    });
  }

  function scrollReveal() {
    const els = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window) || !els.length) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.style.opacity = '1';
          e.target.style.transform = 'translateY(0)';
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    els.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(16px)';
      el.style.transition = 'opacity 0.6s var(--ease), transform 0.6s var(--ease)';
      io.observe(el);
    });
    window.__revealObserver = io;
  }

  function init() {
    setYear();
    mobileNav();
    scrollReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
