// 自测脚本：扫描所有主要路由，检查 200 + 关键内容
const http = require('http');
const BASE = '/assets/data/i18n';
const LANGS = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'ru', 'fr', 'de', 'es', 'it'];
const ROUTES = [
  '/',
  '/visa/',
  '/calculator/',
  '/planner/',
  '/payment/',
  '/transport/',
  '/cities/',
  '/cities/beijing/',
  '/cities/shanghai/',
  '/cities/guangzhou/',
  '/cities/chengdu/',
  '/cities/xian/',
  '/about/',
  '/contact/',
  '/privacy/',
  '/terms/',
  '/disclaimer/',
  '/sitemap.xml',
  '/robots.txt',
  '/assets/css/base.css',
  '/assets/css/components.css',
  '/assets/css/calculator.css',
  '/assets/js/i18n.js',
  '/assets/js/calculator.js',
  '/assets/js/planner.js',
  ...LANGS.map(l => `${BASE}/${l}.json`),
  '/assets/data/cities.json',
  // 语言前缀 URL（serve.js 会去前缀回退到根）
  ...LANGS.filter(l => l !== 'en').flatMap(l => [
    `/${l}/`,
    `/${l}/visa/`,
    `/${l}/calculator/`,
    `/${l}/planner/`,
    `/${l}/payment/`,
    `/${l}/transport/`,
    `/${l}/cities/beijing/`
  ])
];

function get(path) {
  return new Promise((resolve) => {
    const req = http.get({ host: 'localhost', port: 4173, path, timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, size: body.length, body }));
    });
    req.on('error', e => resolve({ status: 0, size: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, size: 0, error: 'timeout' }); });
  });
}

(async () => {
  let pass = 0, fail = 0;
  for (const r of ROUTES) {
    const res = await get(r);
    const ok = res.status === 200;
    if (ok) pass++; else fail++;
    console.log(`${ok ? '✓' : '✗'} ${r.padEnd(36)} ${String(res.status).padEnd(4)} ${res.size}B${res.error ? ' ' + res.error : ''}`);
  }
  console.log(`\nPassed: ${pass} | Failed: ${fail}`);

  // 关键内容关键字检查
  const home = await get('/');
  const visa = await get('/visa/');
  const calc = await get('/calculator/');
  const planner = await get('/planner/');
  const payment = await get('/payment/');
  const transport = await get('/transport/');
  // 取一个语言前缀 URL（验证 serve.js 去前缀正常）
  const jaRoot = await get('/ja/');
  const jaVisa = await get('/ja/visa/');
  const frPlanner = await get('/fr/planner/');
  // 加载若干种语言 JSON 验证关键 key 存在
  const jaJson = JSON.parse((await get('/assets/data/i18n/ja.json')).body);
  const ruJson = JSON.parse((await get('/assets/data/i18n/ru.json')).body);
  const frJson = JSON.parse((await get('/assets/data/i18n/fr.json')).body);
  const checks = [
    ['/ contains hero title', home.body.includes('Plan in')],
    ['/ contains 144h tag',    home.body.includes('144')],
    ['/ contains 240h tag',    home.body.includes('240')],
    ['/ has GoChina brand',    home.body.includes('GoChina')],
    ['/visa/ has comparison',  visa.body.includes('144') && visa.body.includes('240')],
    ['/visa/ has airport steps',visa.body.includes('How to apply')],
    ['/calculator/ has form',  calc.body.includes('calc-form')],
    ['/planner/ has form',     planner.body.includes('planner-form')],
    ['/planner/ has hours opt',planner.body.includes('name="hours"')],
    ['/planner/ has 5 interests',planner.body.includes('name="interest"')],
    ['/payment/ has Alipay',   payment.body.includes('Alipay')],
    ['/payment/ has WeChat',   payment.body.includes('WeChat')],
    ['/payment/ has 4 methods', (payment.body.match(/payment\.methods\.\d+\.name/g) || []).length === 4],
    ['/transport/ has HSR',    transport.body.includes('High-speed rail')],
    ['/transport/ has 5 modes',(transport.body.match(/transport\.modes\.\d+\.name/g) || []).length === 5],
    ['/ja/ serves root',       jaRoot.status === 200 && jaRoot.body.includes('GoChina')],
    ['/ja/visa/ serves visa',  jaVisa.status === 200 && jaVisa.body.includes('data-i18n')],
    ['/fr/planner/ serves planner', frPlanner.status === 200 && frPlanner.body.includes('planner-form')],
    ['ja.json has nav.visa',   typeof jaJson.nav?.visa === 'string'],
    ['ja.json has payment methods', Array.isArray(jaJson.payment?.methods) && jaJson.payment.methods.length === 4],
    ['ru.json has transport modes', Array.isArray(ruJson.transport?.modes) && ruJson.transport.modes.length === 5],
    ['fr.json has heroTitle',  typeof frJson.home?.heroTitle === 'string' && frJson.home.heroTitle.length > 0],
    ['/zh-TW/visa/ rewrites',  (await get('/zh-TW/visa/')).status === 200]
  ];
  console.log('\n--- Content checks ---');
  for (const [name, ok] of checks) {
    console.log(`${ok ? '✓' : '✗'} ${name}`);
  }
})();
