/* ========================================
   ga4.js — Google Analytics 4 + Consent Mode v2
   --------------------------------------------------------------
   - 默认所有 consent 信号 denied（GDPR / EEA 强制）
   - 监听 consent.js 的 'consent:updated' 事件，按选择更新同意
   - 选择 'all' / 'analytics' 时按需加载 gtag.js（动态注入 script）
   - Measurement ID 集中配置在顶部 MEASUREMENT_ID 常量
   - AdSense 当前未启用，所以 ad_storage 始终跟随选择
   ======================================== */
(function () {
  'use strict';

  // ===== 配置 =====
  // TODO: 申请真实 Measurement ID 后替换。
  // 在 https://analytics.google.com/ → 管理 → 数据流 → 衡量 ID 形如 G-XXXXXXXXXX
  const MEASUREMENT_ID = 'G-XXXXXXXXXX';
  const DEBUG = false; // 调试模式：gtag('set','debug_mode',true)

  // ===== dataLayer & gtag stub（必须在加载 gtag.js 之前建立）=====
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag('js', new Date());

  // ===== 1) 设置默认 consent（denied）=====
  // wait_for_update: 在用户做出选择前，给 gtag 一段等待时间
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 800
  });
  gtag('set', 'ads_data_redaction', true); // 同意被拒时再去除 IP
  if (DEBUG) gtag('set', 'debug_mode', true);

  // ===== 2) 状态 =====
  let gtagLoaded = false;

  // ===== 3) 根据选择计算 consent 状态 =====
  function computeConsent(choice) {
    const state = {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied'
    };
    if (choice === 'all') {
      // 全开：分析 + 广告（未来 AdSense）
      state.ad_storage = 'granted';
      state.ad_user_data = 'granted';
      state.ad_personalization = 'granted';
      state.analytics_storage = 'granted';
    } else if (choice === 'analytics') {
      // 仅分析：用于流量分析，不投放广告
      state.analytics_storage = 'granted';
    }
    // 'essential'：全部 denied
    return state;
  }

  // ===== 4) 加载 gtag.js =====
  function loadGtag() {
    if (gtagLoaded) return;
    if (MEASUREMENT_ID === 'G-XXXXXXXXXX' && !DEBUG) {
      console.info('[ga4] 未配置 Measurement ID，跳过 gtag.js 加载');
      return;
    }
    gtagLoaded = true;
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEASUREMENT_ID);
    s.crossOrigin = 'anonymous';
    s.onerror = () => console.warn('[ga4] gtag.js 加载失败（离线 / 屏蔽）');
    document.head.appendChild(s);
    // config 必须在 gtag.js 加载完成后调用，但 consent:update 可立即发
    gtag('config', MEASUREMENT_ID, {
      anonymize_ip: true,            // 满足 GDPR
      send_page_view: true
    });
  }

  // ===== 5) 应用选择 =====
  function applyChoice(choice) {
    if (!choice) return;
    const state = computeConsent(choice);
    gtag('consent', 'update', state);
    // 仅当用户授予分析权限时才注入 gtag.js
    if (state.analytics_storage === 'granted') loadGtag();
  }

  // ===== 6) 监听 consent 事件 =====
  window.addEventListener('consent:updated', (e) => {
    applyChoice(e.detail?.choice);
  });

  // ===== 7) 启动时读取历史选择（用户曾经选过）=====
  try {
    const stored = JSON.parse(localStorage.getItem('gochina.consent') || 'null');
    if (stored && stored.choice) {
      // 异步：避免阻塞首次渲染；可接受在 consent banner 出现前已发回 default denied
      queueMicrotask(() => applyChoice(stored.choice));
    }
  } catch { /* 忽略损坏的 localStorage */ }

  // ===== 8) 暴露调试 API =====
  window.__GA4 = {
    applyChoice,
    MEASUREMENT_ID,
    isLoaded: () => gtagLoaded
  };
})();
