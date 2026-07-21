/* ========================================
   consent.js — Cookie / 同意横幅（GDPR）
   三档：all（分析+广告）/ analytics（仅分析）/ essential（仅必要）
   发出 'consent:updated' 事件供 ga4.js 等模块消费
   ======================================== */
(function () {
  'use strict';

  const KEY = 'gochina.consent';

  // i18n 文案由 data-i18n 同步替换（默认英文）
  const HTML = `
    <div class="consent__inner">
      <p data-i18n="consent.text">We use cookies for analytics and ads. You can accept all, only the analytics, or only the essentials.</p>
      <div class="consent__actions">
        <button type="button" class="btn btn--primary btn--sm" data-consent="all"      data-i18n-aria="consent.ariaAcceptAll">Accept all</button>
        <button type="button" class="btn btn--ghost   btn--sm" data-consent="analytics" data-i18n-aria="consent.ariaAnalytics">Analytics only</button>
        <button type="button" class="btn btn--ghost   btn--sm" data-consent="essential" data-i18n-aria="consent.ariaEssential">Essential only</button>
        <a href="/privacy/" class="btn btn--ghost   btn--sm" data-i18n="consent.policy">Privacy policy</a>
      </div>
    </div>
  `;

  function get() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
  }
  function set(record) {
    localStorage.setItem(KEY, JSON.stringify({ ...record, at: Date.now() }));
  }

  function deriveFlags(choice) {
    return {
      choice,
      essential: true,
      analytics: choice === 'all' || choice === 'analytics',
      ads:       choice === 'all'
    };
  }

  function show() {
    const el = document.getElementById('consent');
    if (!el) return;
    el.innerHTML = HTML;
    el.classList.add('is-visible');
    // 触发 i18n 渲染（若 i18n 已就绪）
    if (window.I18N && typeof window.I18N.refresh === 'function') {
      window.I18N.refresh();
    } else if (window.I18N && window.I18N.state?.dict && typeof window.I18N.applyTranslations === 'function') {
      window.I18N.applyTranslations(window.I18N.state.dict);
    }
    el.querySelectorAll('[data-consent]').forEach(btn => {
      btn.addEventListener('click', () => {
        const choice = btn.getAttribute('data-consent');
        if (!['all', 'analytics', 'essential'].includes(choice)) return;
        set(deriveFlags(choice));
        el.classList.remove('is-visible');
        el.querySelector('.consent__inner')?.setAttribute('data-choice', choice);
        // 通知其它模块（ga4.js 等）按选择初始化
        window.dispatchEvent(new CustomEvent('consent:updated', { detail: { choice } }));
      });
    });
  }

  // 提供"重置选择" API：让用户可在隐私页面再次选择
  function reset() {
    localStorage.removeItem(KEY);
    const el = document.getElementById('consent');
    if (el) {
      el.classList.remove('is-visible');
      el.innerHTML = '';
    }
    show();
  }

  function init() {
    const stored = get();
    if (stored) {
      // 已选过：把事件再发一次，方便后来加载的模块（如异步注入的 ga4）拿到状态
      window.dispatchEvent(new CustomEvent('consent:updated', { detail: { choice: stored.choice, restored: true } }));
      return;
    }
    show();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.__CONSENT = { get, set, reset, show, deriveFlags };
})();
