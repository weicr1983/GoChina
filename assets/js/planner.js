/* ========================================
   planner.js — 行程规划器
   纯函数 planRoute() + 视图渲染 + URL hash 同步
   依赖：window.CALC（来自 calculator.js）做预算预估
   ======================================== */
(function () {
  'use strict';

  // ---- 城市兴趣打分（5 兴趣 × 5 城市，0-5 分）----
  const INTERESTS = ['history', 'food', 'nature', 'modern', 'family'];

  const CITIES = [
    {
      id: 'beijing',
      name: 'Beijing',
      minStayDays: 2,
      // 兴趣得分
      score: { history: 5, food: 4, nature: 3, modern: 4, family: 4 },
      tagline: 'Imperial capital: Forbidden City, Great Wall, hutongs.'
    },
    {
      id: 'shanghai',
      name: 'Shanghai',
      minStayDays: 2,
      score: { history: 3, food: 5, nature: 2, modern: 5, family: 4 },
      tagline: 'Futuristic Bund, dumplings, 24/7 pulse.'
    },
    {
      id: 'guangzhou',
      name: 'Guangzhou',
      minStayDays: 1,
      score: { history: 3, food: 5, nature: 2, modern: 4, family: 3 },
      tagline: 'Cantonese food capital, dim sum, river cruises.'
    },
    {
      id: 'chengdu',
      name: 'Chengdu',
      minStayDays: 2,
      score: { history: 3, food: 5, nature: 5, modern: 2, family: 5 },
      tagline: 'Pandas, Sichuan food, slow tea-house pace.'
    },
    {
      id: 'xian',
      name: 'Xi’an',
      minStayDays: 2,
      score: { history: 5, food: 3, nature: 2, modern: 2, family: 3 },
      tagline: 'Terracotta Warriors, Silk Road starting point.'
    }
  ];

  // 跨城高铁近似小时（与 calculator.js 同步）
  const HSR = {
    'beijing-shanghai': 4.5, 'beijing-guangzhou': 8.0, 'beijing-chengdu': 7.5, 'beijing-xian': 4.5,
    'shanghai-guangzhou': 6.5, 'shanghai-chengdu': 10.0, 'shanghai-xian': 11.0,
    'guangzhou-chengdu':  8.0, 'guangzhou-xian':   8.0,
    'chengdu-xian':       3.5
  };

  // ---- 工具 ----
  function clamp(n, lo, hi) {
    n = Number(n);
    if (Number.isNaN(n)) return lo;
    return Math.min(Math.max(n, lo), hi);
  }

  function getHsrHours(a, b) {
    return HSR[`${a}-${b}`] ?? HSR[`${b}-${a}`] ?? 5;
  }

  // ---- 核心：贪心行程规划 ----
  function planRoute(input) {
    const hours        = input.hours === 240 ? 240 : 144;
    const days         = hours / 24;             // 6 或 10
    const interests    = (input.interests && input.interests.length) ? input.interests : INTERESTS;
    const hotelTier    = input.hotelTier || 'mid';
    const foodTier     = input.foodTier  || 'mid';
    const transport    = input.transport || 'metro';
    const travellers   = clamp(input.travellers ?? 1, 1, 8);

    // 1) 计算每城得分（每兴趣分求和，无任何兴趣时按 1 分保底，使所有城市都可选）
    const scored = CITIES.map(c => {
      const score = interests.reduce((s, k) => s + (c.score[k] || 0), 0) || 1;
      return { city: c, score };
    }).sort((a, b) => b.score - a.score);

    // 2) 贪心：按分数高到低挑城市，每城至少 minStayDays
    const picked = [];
    let remaining = days;
    for (const item of scored) {
      if (remaining < item.city.minStayDays) continue;
      picked.push({ city: item.city, days: item.city.minStayDays });
      remaining -= item.city.minStayDays;
    }

    // 3) 把剩余天数分给分数最高的城市（避免出现 0 天空城）
    if (remaining > 0 && picked.length > 0) {
      picked[0].days += remaining;
    }

    // 4) 分配每一天的城市归属（用于"Day 1: Beijing"展示）
    let cursor = 1;
    const days_ = picked.map(p => {
      const block = [];
      for (let d = 0; d < p.days; d++) {
        block.push({ dayNumber: cursor++, cityId: p.city.id, cityName: p.city.name });
      }
      return { city: p.city, days: p.days, block };
    });

    // 5) 跨城总 HSR 小时（仅展示用）
    let hsrHours = 0;
    for (let i = 0; i < days_.length - 1; i++) {
      hsrHours += getHsrHours(days_[i].city.id, days_[i + 1].city.id);
    }

    return {
      hours, days, interests, travellers, hotelTier, foodTier, transport,
      route: days_,
      citiesCount: days_.length,
      hsrHours: Math.round(hsrHours * 10) / 10
    };
  }

  // ---- 预算预估（复用 calculator 纯函数）----
  function estimateBudget(plan) {
    if (!window.CALC || typeof window.CALC.calculate !== 'function') return null;
    const cfg = {
      days:         plan.days,
      cityCount:    plan.citiesCount,
      hotelTier:    plan.hotelTier,
      foodTier:     plan.foodTier,
      transport:    plan.transport,
      attractions:  2,
      shopping:     0,
      other:        0,
      intercityRail: true,
      travellers:   plan.travellers
    };
    return window.CALC.calculate(cfg);
  }

  // ---- 视图 ----
  function $(id) { return document.getElementById(id); }

  function fmtUSD(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function interpolate(template, vars) {
    if (typeof template !== 'string') return template;
    return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : `{${k}}`));
  }

  function setText(id, val) {
    const el = $(id);
    if (el) el.textContent = val;
  }

  function getInterestForm() {
    return Array.from(document.querySelectorAll('input[name="interest"]:checked')).map(i => i.value);
  }

  function readForm() {
    return {
      hours:      document.querySelector('input[name="hours"]:checked')?.value === '240' ? 240 : 144,
      interests:  getInterestForm(),
      travellers: +$('in-travellers').value,
      hotelTier:  $('in-hotel').value,
      foodTier:   $('in-food').value,
      transport:  $('in-transport').value
    };
  }

  function writeForm(state) {
    if (!state) return;
    const hours = document.querySelector(`input[name="hours"][value="${state.hours}"]`);
    if (hours) hours.checked = true;
    (state.interests || []).forEach(k => {
      const el = document.querySelector(`input[name="interest"][value="${k}"]`);
      if (el) el.checked = true;
    });
    if (state.travellers) $('in-travellers').value = state.travellers;
    if (state.hotelTier)  $('in-hotel').value  = state.hotelTier;
    if (state.foodTier)   $('in-food').value   = state.foodTier;
    if (state.transport)  $('in-transport').value = state.transport;
  }

  function syncHash() {
    const f = readForm();
    const p = new URLSearchParams();
    p.set('hours', String(f.hours));
    p.set('interests', f.interests.join(','));
    p.set('travellers', String(f.travellers));
    p.set('hotelTier', f.hotelTier);
    p.set('foodTier', f.foodTier);
    p.set('transport', f.transport);
    history.replaceState(null, '', '#' + p.toString());
  }

  function loadFromHash() {
    const h = location.hash.replace('#', '');
    if (!h) return null;
    try {
      const p = new URLSearchParams(h);
      return {
        hours:      +p.get('hours') === 240 ? 240 : 144,
        interests:  (p.get('interests') || '').split(',').filter(Boolean),
        travellers: +p.get('travellers') || 1,
        hotelTier:  p.get('hotelTier') || 'mid',
        foodTier:   p.get('foodTier')  || 'mid',
        transport:  p.get('transport') || 'metro'
      };
    } catch { return null; }
  }

  function updateRangeDisplays() {
    const map = { 'in-travellers': 'val-travellers' };
    Object.entries(map).forEach(([inp, out]) => {
      const el = $(inp), outEl = $(out);
      if (el && outEl) outEl.textContent = el.value;
    });
  }

  function render(plan) {
    const result = $('planner-result');
    if (!plan || !plan.route || plan.route.length === 0) {
      result.style.display = 'block';
      result.innerHTML = `<p class="text-mute-2" data-i18n="planner.noMatch">No cities match your visa and interest selection. Try 240h or add an interest.</p>`;
      return;
    }

    const budget = estimateBudget(plan);
    const t = window.I18N ? window.I18N.get.bind(window.I18N) : (k) => k;
    const visaNoteKey = plan.hours === 144 ? 'planner.visaNote144' : 'planner.visaNote240';
    const dayLabelTpl = t('planner.dayLabel') || 'Day {n}';
    const totalDaysTpl = t('planner.totalDays') || 'Days';
    const estCostTpl = t('planner.estCost') || 'Estimated total';
    const perDayTpl = t('planner.perDay') || 'Day';
    const cityVisitedTpl = t('planner.cityVisited') || 'Cities';

    // Summary cards
    const summary = `
      <div class="card" style="background:var(--c-rice-2);border-color:var(--c-cinnabar);">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:var(--sp-4);">
          <div>
            <div class="text-mute-2" style="font-size:var(--fs-sm);">${totalDaysTpl}</div>
            <div style="font-family:var(--font-display);font-size:var(--fs-2xl);line-height:1;">${plan.days}</div>
          </div>
          <div>
            <div class="text-mute-2" style="font-size:var(--fs-sm);">${cityVisitedTpl}</div>
            <div style="font-family:var(--font-display);font-size:var(--fs-2xl);line-height:1;">${plan.citiesCount}</div>
          </div>
          <div>
            <div class="text-mute-2" style="font-size:var(--fs-sm);">HSR</div>
            <div style="font-family:var(--font-display);font-size:var(--fs-2xl);line-height:1;">${plan.hsrHours}h</div>
          </div>
          ${budget ? `
          <div>
            <div class="text-mute-2" style="font-size:var(--fs-sm);">${estCostTpl}</div>
            <div style="font-family:var(--font-display);font-size:var(--fs-2xl);line-height:1;color:var(--c-cinnabar);">${fmtUSD(budget.total)}</div>
            ${plan.days > 0 ? `<div class="text-mute-2" style="font-size:var(--fs-sm);">≈ ${fmtUSD(budget.total / plan.days)} / ${perDayTpl.toLowerCase()}</div>` : ''}
          </div>` : ''}
        </div>
      </div>
    `;

    // Per-city cards
    const route = plan.route.map(r => {
      const cityBudget = budget ? budget.perCity.find(p => p.cityId === r.city.id) : null;
      return `
        <div class="card" data-reveal>
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--sp-4);flex-wrap:wrap;">
            <div>
              <h3 style="margin-bottom:var(--sp-2);">${r.city.name}</h3>
              <p class="text-mute-2" style="max-width:54ch;">${r.city.tagline}</p>
            </div>
            <span class="tag tag--cinnabar">${r.days} ${r.days === 1 ? (t('planner.dayLabel') || 'Day').replace(/\{n\}/g, '') : (t('planner.dayLabel') || 'Day').replace(/\{n\}/g, 's')}</span>
          </div>
          <ol style="margin-top:var(--sp-4);display:flex;flex-direction:column;gap:var(--sp-2);">
            ${r.block.map(b => `<li><strong>${interpolate(dayLabelTpl, { n: b.dayNumber })}</strong> · ${b.cityName}</li>`).join('')}
          </ol>
          ${cityBudget ? `
          <div style="margin-top:var(--sp-4);padding-top:var(--sp-4);border-top:1px solid var(--c-rice-3);display:flex;justify-content:space-between;font-size:var(--fs-sm);">
            <span class="text-mute-2">${r.days} × hotel + food + local + attractions</span>
            <strong>${fmtUSD(cityBudget.total)}</strong>
          </div>` : ''}
        </div>
      `;
    }).join('');

    const visaNote = t(visaNoteKey) || (plan.hours === 144
      ? 'Under 144h, you can only enter via Beijing, Shanghai, or Guangzhou and stay within the corresponding region.'
      : 'Under 240h, you can now enter via 16+ ports and travel across most provinces.');

    const openInCalc = t('planner.openInCalc') || 'Open in budget calculator';
    const addToCalc = t('planner.addToCalc') || 'Add to calculator';
    const disclaimer = t('planner.disclaimer') || 'Itinerary is a suggestion based on your inputs. Real rail times, attraction hours, and prices vary — confirm before booking.';
    const calcParams = `?days=${plan.days}&cities=${plan.citiesCount}&hotelTier=${plan.hotelTier}&foodTier=${plan.foodTier}&transport=${plan.transport}&travellers=${plan.travellers}&rail=1`;

    result.style.display = 'block';
    result.innerHTML = `
      <h2 style="margin-bottom:var(--sp-5);" data-i18n="planner.resultTitle">${t('planner.resultTitle') || 'Your suggested trip'}</h2>
      ${summary}
      <p class="text-mute-2" style="margin-top:var(--sp-4);font-size:var(--fs-sm);">${visaNote}</p>
      <div style="margin-top:var(--sp-6);display:flex;flex-direction:column;gap:var(--sp-4);">
        ${route}
      </div>
      <div style="margin-top:var(--sp-6);display:flex;gap:var(--sp-3);flex-wrap:wrap;">
        <a class="btn btn--primary" href="../calculator/#days=${plan.days}&cityCount=${plan.citiesCount}&hotelTier=${plan.hotelTier}&foodTier=${plan.foodTier}&transport=${plan.transport}&attractions=2&intercityRail=1&travellers=${plan.travellers}">${openInCalc}</a>
        <a class="btn btn--ghost" href="../calculator/${calcParams}">${addToCalc}</a>
      </div>
      <p class="text-mute-2" style="margin-top:var(--sp-5);font-size:var(--fs-sm);">${disclaimer}</p>
    `;

    // 重新触发 i18n 替换（因为 innerHTML 写入时跳过了 data-i18n 渲染）
    if (window.I18N && typeof window.I18N.setLanguage === 'function' && window.I18N.state && window.I18N.state.dict) {
      // 把剩余的 data-i18n 重新渲染一次
      document.querySelectorAll('[data-i18n]').forEach(el => {
        if (!el.textContent || el.textContent.trim() === '') {
          const k = el.getAttribute('data-i18n');
          const v = window.I18N.get(k);
          if (v != null) el.textContent = v;
        }
      });
    }

    // 触发 reveal 动画
    if (window.__revealObserver) window.__revealObserver.observe(result);
  }

  function generate() {
    const input = readForm();
    syncHash();
    const plan = planRoute(input);
    render(plan);
    // 平滑滚到结果
    $('planner-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function init() {
    const form = $('planner-form');
    if (!form) return;

    const initial = loadFromHash();
    if (initial) writeForm(initial);
    updateRangeDisplays();

    form.addEventListener('submit', (e) => { e.preventDefault(); generate(); });
    form.addEventListener('input', updateRangeDisplays);
    form.addEventListener('change', updateRangeDisplays);

    $('planner-regenerate')?.addEventListener('click', generate);

    // 首次加载如果 URL 已有参数，直接生成
    if (initial) generate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.PLANNER = { planRoute, estimateBudget, CITIES, INTERESTS };
})();
