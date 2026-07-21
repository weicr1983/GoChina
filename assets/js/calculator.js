/* ========================================
   calculator.js — 预算计算器（纯函数 + 视图）
   输入：天数、城市数、酒店/餐饮档次、交通、景点、购物、其他、跨城高铁、同行人数
   输出：分项 USD 总额 + 按城市拆分 + CNY 换算 + URL hash 同步
   ======================================== */
(function () {
  'use strict';

  const FX_USD_CNY = 7.20;     // 汇率，README 需同步
  const FX_UPDATED = '2026-01-15';

  // 5 城示例数据集（V1 接入完整 cities.json）
  const CITIES = [
    { id: 'beijing',   name: 'Beijing',   hotel: { budget: 30, mid: 95,  luxury: 280 }, food: { budget: 18, mid: 40,  luxury: 100 }, transport: 10, attraction: 8 },
    { id: 'shanghai',  name: 'Shanghai',  hotel: { budget: 35, mid: 110, luxury: 320 }, food: { budget: 22, mid: 48,  luxury: 120 }, transport: 11, attraction: 9 },
    { id: 'guangzhou', name: 'Guangzhou', hotel: { budget: 28, mid: 85,  luxury: 240 }, food: { budget: 18, mid: 38,  luxury: 95  }, transport: 9,  attraction: 7 },
    { id: 'chengdu',   name: 'Chengdu',   hotel: { budget: 22, mid: 70,  luxury: 200 }, food: { budget: 16, mid: 32,  luxury: 80  }, transport: 7,  attraction: 6 },
    { id: 'xian',      name: 'Xi’an',     hotel: { budget: 20, mid: 65,  luxury: 180 }, food: { budget: 14, mid: 28,  luxury: 70  }, transport: 6,  attraction: 7 }
  ];

  // 城市间高铁时间（小时，单程）
  const HSR = {
    'beijing-shanghai':  4.5, 'beijing-guangzhou': 8.0, 'beijing-chengdu': 7.5, 'beijing-xian': 4.5,
    'shanghai-guangzhou': 6.5, 'shanghai-chengdu': 10.0, 'shanghai-xian': 11.0,
    'guangzhou-chengdu':  8.0, 'guangzhou-xian':   8.0,
    'chengdu-xian':       3.5
  };

  // ---- 纯计算函数（无 DOM 依赖） ----
  function clamp(n, lo, hi) {
    n = Number(n);
    if (Number.isNaN(n)) return lo;
    return Math.min(Math.max(n, lo), hi);
  }

  function distributeDays(total, parts) {
    const base = Math.floor(total / parts);
    const rem = total - base * parts;
    return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0));
  }

  function transportCost(mode, base) {
    if (mode === 'metro') return Math.round(base * 0.6);
    if (mode === 'taxi')  return Math.round(base * 1.4);
    return base; // mixed
  }

  // 多人酒店分摊：1 人单间 = 1 房；2 人 = 1 房（共享）；3-4 人 = 2 房；以此类推
  function roomMultiplier(travellers) {
    return Math.ceil(travellers / 2);
  }

  function calculate(cfg) {
    const days          = clamp(cfg.days, 1, 14);
    const cityCount     = clamp(cfg.cityCount, 1, 5);
    const hotelTier     = cfg.hotelTier || 'mid';
    const foodTier      = cfg.foodTier  || 'mid';
    const transportMode = cfg.transport || 'metro';
    const attractionsPerCity = clamp(cfg.attractions ?? 2, 0, 8);
    const shopping      = clamp(cfg.shopping ?? 0, 0, 100000);
    const other         = clamp(cfg.other ?? 0, 0, 100000);
    const intercityRail = !!cfg.intercityRail;
    const travellers    = clamp(cfg.travellers ?? 1, 1, 8);

    const selectedCities = CITIES.slice(0, cityCount);
    const daysPerCity = distributeDays(days, cityCount);
    const rooms = roomMultiplier(travellers);

    // ---- 每城明细 ----
    const perCity = selectedCities.map((c, i) => {
      const d = daysPerCity[i];
      const local = transportCost(transportMode, c.transport);
      const hotelN    = c.hotel[hotelTier] * d * rooms;            // 整间房 * 房数 * 天
      const foodN     = c.food[foodTier] * d * travellers;          // 人均 * 人 * 天
      const localN    = local * d * travellers;                    // 人均 * 人 * 天
      const attrN     = c.attraction * attractionsPerCity * travellers; // 单价 * 数量 * 人
      return {
        cityId: c.id,
        cityName: c.name,
        days: d,
        hotel: hotelN,
        food: foodN,
        transport: localN,
        attraction: attrN,
        total: hotelN + foodN + localN + attrN
      };
    });

    // ---- 跨城高铁 ----
    let intercityCost = 0;
    if (intercityRail && cityCount > 1) {
      for (let i = 0; i < cityCount - 1; i++) {
        const a = selectedCities[i].id;
        const b = selectedCities[i + 1].id;
        const key1 = `${a}-${b}`;
        const key2 = `${b}-${a}`;
        const hours = HSR[key1] ?? HSR[key2] ?? 5;
        intercityCost += Math.round(hours * 18) * travellers; // 约 18 USD/人/小时 二等座
      }
    }

    // ---- 购物 / 其他（按人） ----
    const shoppingTotal = shopping * travellers;
    const otherTotal    = other * travellers;

    // ---- 汇总 ----
    const subtotals = {
      hotel:     Math.round(perCity.reduce((s, p) => s + p.hotel, 0)),
      food:      Math.round(perCity.reduce((s, p) => s + p.food, 0)),
      transport: Math.round(perCity.reduce((s, p) => s + p.transport, 0)),
      attraction:Math.round(perCity.reduce((s, p) => s + p.attraction, 0)),
      intercity: Math.round(intercityCost),
      shopping:  Math.round(shoppingTotal),
      other:     Math.round(otherTotal)
    };

    const total = subtotals.hotel + subtotals.food + subtotals.transport
                + subtotals.attraction + subtotals.intercity + subtotals.shopping + subtotals.other;
    const cny = Math.round(total * FX_USD_CNY);

    return { cfg, perCity, subtotals, total, cny, fx: { rate: FX_USD_CNY, updated: FX_UPDATED } };
  }

  // ---- 视图 ----
  function fmt(n) {
    return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function render(result) {
    const r = result;
    const s = r.subtotals;
    setText('calc-total',         `$${fmt(r.total)}`);
    setText('calc-total-cny',     `≈ ¥${fmt(r.cny)} CNY · FX 1 USD = ${r.fx.rate} CNY (updated ${r.fx.updated})`);
    setText('calc-hotel',         `$${fmt(s.hotel)}`);
    setText('calc-food',          `$${fmt(s.food)}`);
    setText('calc-transport',     `$${fmt(s.transport)}`);
    setText('calc-attraction',    `$${fmt(s.attraction)}`);
    setText('calc-intercity',     `$${fmt(s.intercity)}`);
    setText('calc-shopping',      `$${fmt(s.shopping)}`);
    setText('calc-other',         `$${fmt(s.other)}`);

    const list = document.getElementById('calc-per-city');
    if (list) {
      list.innerHTML = r.perCity.map(p => `
        <div class="calc__city">
          <span>${p.cityName} <span class="text-mute-2">· ${p.days}d</span></span>
          <strong>$${fmt(p.total)}</strong>
        </div>
      `).join('');
    }
  }

  function readForm() {
    const f = id => document.getElementById(id);
    return {
      days:        +f('in-days').value,
      cityCount:   +f('in-cities').value,
      hotelTier:   f('in-hotel').value,
      foodTier:    f('in-food').value,
      transport:   f('in-transport').value,
      attractions: +f('in-attr').value,
      shopping:    +f('in-shop').value,
      other:       +f('in-other').value,
      intercityRail: f('in-rail').checked,
      travellers:  +f('in-travellers').value
    };
  }

  function syncHash(cfg) {
    const p = new URLSearchParams();
    Object.entries(cfg).forEach(([k, v]) => {
      if (typeof v === 'boolean') p.set(k, v ? '1' : '0');
      else p.set(k, String(v));
    });
    history.replaceState(null, '', '#' + p.toString());
  }

  function loadFromHash() {
    const h = location.hash.replace('#', '');
    if (!h) return null;
    try {
      const p = new URLSearchParams(h);
      return {
        days: +p.get('days') || 5,
        cityCount: +p.get('cityCount') || 2,
        hotelTier: p.get('hotelTier') || 'mid',
        foodTier:  p.get('foodTier')  || 'mid',
        transport: p.get('transport') || 'metro',
        attractions: +p.get('attractions') || 2,
        shopping:  +p.get('shopping')  || 0,
        other:     +p.get('other')     || 0,
        intercityRail: p.get('intercityRail') === '1',
        travellers:  +p.get('travellers') || 1
      };
    } catch { return null; }
  }

  function updateRangeDisplays() {
    const map = {
      'in-days': 'val-days',
      'in-cities': 'val-cities',
      'in-attr': 'val-attr',
      'in-travellers': 'val-travellers'
    };
    Object.entries(map).forEach(([inp, out]) => {
      const el = document.getElementById(inp);
      const outEl = document.getElementById(out);
      if (el && outEl) outEl.textContent = el.value;
    });
  }

  function recompute() {
    const cfg = readForm();
    syncHash(cfg);
    render(calculate(cfg));
  }

  function init() {
    const form = document.getElementById('calc-form');
    if (!form) return;

    const initial = loadFromHash();
    if (initial) {
      Object.entries(initial).forEach(([k, v]) => {
        const el = form.querySelector(`[name="${k}"]`);
        if (!el) return;
        if (el.type === 'checkbox') el.checked = !!v;
        else el.value = v;
      });
    }
    updateRangeDisplays();
    recompute();

    form.addEventListener('input', () => { updateRangeDisplays(); recompute(); });
    form.addEventListener('change', () => { updateRangeDisplays(); recompute(); });

    document.getElementById('calc-print')?.addEventListener('click', () => window.print());
    document.getElementById('calc-reset')?.addEventListener('click', () => {
      form.reset();
      history.replaceState(null, '', location.pathname);
      updateRangeDisplays();
      recompute();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.CALC = { calculate, CITIES, FX_USD_CNY, FX_UPDATED };
})();
