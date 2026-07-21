// Planner 逻辑单测：在 Node 环境下模拟 window 后执行 planner.js
// 用法：node test-planner.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = {
  window: {},
  document: {
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    readyState: 'complete'
  },
  console
};
sandbox.window.document = sandbox.document;
sandbox.self = sandbox.window;
sandbox.globalThis = sandbox.window;
vm.createContext(sandbox);

// 加载 calculator.js（PLANNER 依赖 window.CALC）
const calcSrc = fs.readFileSync(path.join(__dirname, 'assets/js/calculator.js'), 'utf8');
vm.runInContext(calcSrc, sandbox);

// 加载 planner.js
const planSrc = fs.readFileSync(path.join(__dirname, 'assets/js/planner.js'), 'utf8');
vm.runInContext(planSrc, sandbox);

const PLANNER = sandbox.window.PLANNER;
if (!PLANNER) {
  console.error('PLANNER not exposed');
  process.exit(1);
}

const cases = [
  {
    name: '144h + history only → Beijing/Xi\'an (history-heavy)',
    input: { hours: 144, interests: ['history'], travellers: 1, hotelTier: 'mid' },
    expectMinCities: 1,
    expectMaxCities: 3,
    expectDays: 6
  },
  {
    name: '240h + food + modern → Shanghai + Beijing + Chengdu (food-heavy)',
    input: { hours: 240, interests: ['food', 'modern'], travellers: 2 },
    expectDays: 10
  },
  {
    name: '240h + nature only → Chengdu (top nature)',
    input: { hours: 240, interests: ['nature'], travellers: 1 },
    expectFirstCity: 'chengdu'
  },
  {
    name: '144h no interests → defaults to all interests',
    input: { hours: 144, interests: [], travellers: 1 },
    expectDays: 6
  },
  {
    name: '240h family → Chengdu + Shanghai (family-friendly)',
    input: { hours: 240, interests: ['family'], travellers: 4, hotelTier: 'mid' },
    expectDays: 10
  }
];

let pass = 0, fail = 0;
for (const c of cases) {
  const result = PLANNER.planRoute(c.input);
  const checks = [];
  if (c.expectDays != null)        checks.push(['days', result.days === c.expectDays]);
  if (c.expectMinCities != null)   checks.push(['min cities', result.citiesCount >= c.expectMinCities]);
  if (c.expectMaxCities != null)   checks.push(['max cities', result.citiesCount <= c.expectMaxCities]);
  if (c.expectFirstCity != null)   checks.push(['first city', result.route[0]?.city.id === c.expectFirstCity]);
  checks.push(['has budget', !!PLANNER.estimateBudget(result)]);
  checks.push(['has route', Array.isArray(result.route) && result.route.length > 0]);
  checks.push(['hsrHours >= 0', result.hsrHours >= 0]);

  const allOk = checks.every(([_, ok]) => ok);
  if (allOk) pass++; else fail++;
  console.log(`${allOk ? '✓' : '✗'} ${c.name}`);
  if (!allOk) {
    checks.filter(([_, ok]) => !ok).forEach(([k]) => console.log(`    └─ failed: ${k}`));
    console.log(`    route: ${result.route.map(r => `${r.city.id}(${r.days}d)`).join(' → ')}`);
    const budget = PLANNER.estimateBudget(result);
    if (budget) console.log(`    est cost: $${budget.total} (~¥${budget.cny})`);
  } else {
    console.log(`    route: ${result.route.map(r => `${r.city.id}(${r.days}d)`).join(' → ')} | HSR ${result.hsrHours}h | $${PLANNER.estimateBudget(result).total}`);
  }
}

console.log(`\nPlanner: ${pass}/${cases.length} passed`);

// 边界测试
const edge = [
  { name: 'travellers=8 (max)', input: { hours: 240, interests: ['food'], travellers: 8 } },
  { name: 'luxury hotel',       input: { hours: 240, interests: ['modern'], hotelTier: 'luxury' } },
  { name: 'all 5 interests',    input: { hours: 240, interests: ['history', 'food', 'nature', 'modern', 'family'] } }
];
console.log('\n--- Edge cases ---');
for (const e of edge) {
  const r = PLANNER.planRoute(e.input);
  const b = PLANNER.estimateBudget(r);
  console.log(`  ${e.name.padEnd(28)} → ${r.route.map(x => x.city.id).join(' → ')} | $${b?.total}`);
}

process.exit(fail > 0 ? 1 : 0);
