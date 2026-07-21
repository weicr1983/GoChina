/* ========================================
   language.js — 语言切换器（UI 行为）
   ======================================== */
(function () {
  'use strict';

  function buildSwitcher() {
    const root = document.querySelector('[data-lang-root]');
    if (!root) return;
    const current = (window.I18N && window.I18N.state.lang) || 'en';
    const labels = {
      en: 'EN', 'zh-CN': '简体', 'zh-TW': '繁體', ja: '日本語',
      ko: '한국어', ru: 'Русский', fr: 'Français', de: 'Deutsch',
      es: 'Español', it: 'Italiano'
    };
    // MVP：保留 EN 主版本；其他语言为未来 URL 切换锚点
    const urlMap = {
      en: '/',
      'zh-CN': '/zh-CN/',
      'zh-TW': '/zh-TW/',
      ja: '/ja/',
      ko: '/ko/',
      ru: '/ru/',
      fr: '/fr/',
      de: '/de/',
      es: '/es/',
      it: '/it/'
    };
    const currentPath = location.pathname;
    // 提取子路径（去掉语言前缀）—保留当前位置，跨语言切换不跳走
    const subPath = (() => {
      const m = currentPath.match(/^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?(.*)$/);
      const inner = (m && m[1]) ? m[1] : '';
      return inner === '' ? '' : inner;
    })();

    const dropdown = document.createElement('div');
    dropdown.className = 'lang-switch-wrap';
    dropdown.style.cssText = 'position:relative;display:inline-block;';
    dropdown.innerHTML = `
      <button class="lang-switch" type="button" aria-haspopup="listbox" aria-expanded="false">
        <span class="lang-switch__current">${labels[current] || current}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
      </button>
      <ul class="lang-menu" role="listbox" style="position:absolute;right:0;top:calc(100% + 6px);background:#0F1115;border:1px solid var(--c-line);border-radius:8px;padding:6px;min-width:160px;display:none;box-shadow:var(--sh-md);z-index:60;">
        ${Object.keys(urlMap).map(code => `
          <li><a href="${urlMap[code]}${subPath}" data-lang-switch="${code}" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:4px;font-size:13px;color:var(--c-rice);">
            <span style="opacity:.7;min-width:56px;">${labels[code]}</span>
            <span style="opacity:.5;font-size:11px;">${code}</span>
          </a></li>
        `).join('')}
      </ul>
    `;
    root.appendChild(dropdown);

    const btn = dropdown.querySelector('.lang-switch');
    const menu = dropdown.querySelector('.lang-menu');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.style.display === 'block';
      menu.style.display = open ? 'none' : 'block';
      btn.setAttribute('aria-expanded', String(!open));
    });
    document.addEventListener('click', () => {
      menu.style.display = 'none';
      btn.setAttribute('aria-expanded', 'false');
    });
    menu.addEventListener('click', (e) => {
      e.stopPropagation();
      const a = e.target.closest('a[data-lang-switch]');
      if (!a) return;
      const target = a.getAttribute('data-lang-switch');
      localStorage.setItem('gochina.lang', target);
    });
  }

  document.addEventListener('DOMContentLoaded', buildSwitcher);
})();
