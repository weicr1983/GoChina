/* ========================================
   i18n.js — 字典加载与渲染
   极简静态站 i18n：扫描 [data-i18n] 与 [data-i18n-placeholder]，
   从字典查找后替换。不参与 SEO（HTML 内已有正确默认文本）。
   ======================================== */
(function (global) {
  'use strict';

  const SUPPORTED = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'ru', 'fr', 'de', 'es', 'it'];
  const DEFAULT = 'en';
  const STORAGE_KEY = 'gochina.lang';

  const state = {
    lang: DEFAULT,
    dict: {},
    loaded: {}
  };

  function detectInitialLang() {
    // URL 路径前缀 /xx/ 优先
    const m = location.pathname.match(/^\/([a-z]{2}(?:-[A-Z]{2})?)\//);
    if (m && SUPPORTED.includes(m[1])) return m[1];
    // localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
    // 浏览器
    const nav = (navigator.language || '').toLowerCase();
    if (nav.startsWith('zh-tw') || nav.startsWith('zh-hk')) return 'zh-TW';
    if (nav.startsWith('zh')) return 'zh-CN';
    if (nav.startsWith('ja')) return 'ja';
    if (nav.startsWith('ko')) return 'ko';
    if (nav.startsWith('ru')) return 'ru';
    if (nav.startsWith('fr')) return 'fr';
    if (nav.startsWith('de')) return 'de';
    if (nav.startsWith('es')) return 'es';
    if (nav.startsWith('it')) return 'it';
    return DEFAULT;
  }

  async function loadDict(lang) {
    if (state.loaded[lang]) return state.loaded[lang];
    // 字典始终位于 /assets/data/i18n/，按当前 HTML 在仓库中的层级计算相对路径
    const dataBase = computeDataBase();
    const url = `${dataBase}/data/i18n/${lang}.json`;
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`i18n load failed: ${lang}`);
    const dict = await res.json();
    state.loaded[lang] = dict;
    return dict;
  }

  function computeDataBase() {
    // 1) 去掉语言前缀（URL 形如 /ja/visa/ 时，文件实际位于 /visa/）
    const LANG = /^\/(en|zh-CN|zh-TW|ja|ko|ru|fr|de|es|it)(?:\/|$)/;
    let p = location.pathname.replace(LANG, '/');
    // 2) 计算 HTML 所在的目录深度（去掉文件名）
    const segs = p.split('/').filter(Boolean);
    let depth = segs.length;
    if (segs[segs.length - 1] && segs[segs.length - 1].includes('.')) {
      depth = segs.length - 1; // 当前段是文件名，深度 = 段数 - 1
    }
    return depth === 0 ? 'assets' : '../'.repeat(depth) + 'assets';
  }

  function getByPath(obj, path) {
    return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
  }

  // 允许的内联标签白名单（用于 data-i18n 的 innerHTML 渲染）
  const ALLOWED_TAGS = new Set(['br', 'em', 'strong', 'b', 'i', 'a', 'span', 'small']);

  function sanitizeHTML(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    // 遍历剥离掉非白名单标签，仅保留文本与允许的内联元素
    const walk = (node) => {
      const children = Array.from(node.childNodes);
      for (const c of children) {
        if (c.nodeType === 1) { // element
          if (!ALLOWED_TAGS.has(c.tagName.toLowerCase())) {
            // 非法标签：把它的子节点提到父节点
            while (c.firstChild) c.parentNode.insertBefore(c.firstChild, c);
            c.remove();
          } else {
            // 合法的 a 标签强制 rel
            if (c.tagName === 'A') {
              c.setAttribute('rel', 'noopener noreferrer');
              if (c.getAttribute('href') && !c.getAttribute('target')) {
                c.setAttribute('target', '_blank');
              }
            }
            walk(c);
          }
        }
      }
    };
    walk(tpl.content);
    return tpl.innerHTML;
  }

  function interpolate(val) {
    if (typeof val !== 'string') return val;
    return val.replace(/\{year\}/g, String(new Date().getFullYear()));
  }

  function applyTranslations(dict) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      let val = getByPath(dict, key);
      if (val == null) return;
      val = interpolate(val);
      // 含 HTML 标签则用 innerHTML，否则 textContent
      if (/<[a-z][^>]*>/i.test(val)) {
        el.innerHTML = sanitizeHTML(val);
      } else {
        el.textContent = val;
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const val = getByPath(dict, key);
      if (val != null) el.setAttribute('placeholder', interpolate(val));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      const val = getByPath(dict, key);
      if (val != null) el.setAttribute('aria-label', interpolate(val));
    });
    document.documentElement.setAttribute('lang', state.lang);
  }

  async function setLanguage(lang) {
    if (!SUPPORTED.includes(lang)) lang = DEFAULT;
    state.lang = lang;
    try {
      const dict = await loadDict(lang);
      state.dict = dict;
      applyTranslations(dict);
    } catch (e) {
      console.warn('[i18n] failed to load', lang, e);
    }
    localStorage.setItem(STORAGE_KEY, lang);
    // 同步 hreflang
    syncHreflang(lang);
  }

  function syncHreflang(current) {
    // 不强制生成 hreflang（静态 HTML 写好），仅高亮当前 lang 标签
    document.querySelectorAll('[data-lang-switch]').forEach(a => {
      const target = a.getAttribute('data-lang-switch');
      a.setAttribute('aria-current', target === current ? 'true' : 'false');
    });
  }

  global.I18N = {
    SUPPORTED,
    DEFAULT,
    detectInitialLang,
    setLanguage,
    applyTranslations: (d) => applyTranslations(d || state.dict),
    get: (k) => getByPath(state.dict, k),
    state
  };
})(window);
