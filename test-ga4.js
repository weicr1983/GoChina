// GA4 + Consent 联动单测：在 Node 中模拟 window 后执行 ga4.js / consent.js，
// 验证以下场景：
//   1) 首次加载：dataLayer 含默认 denied 同意状态
//   2) 用户点 Accept all：触发 gtag('consent','update',{...granted}) + 注入 gtag.js script
//   3) 用户点 Analytics only：只 analytics_storage granted，其他仍 denied
//   4) 用户点 Essential only：所有 consent 维持 denied，不加载 gtag.js
//   5) 历史选择持久化：刷新后恢复状态
// 用法：node test-ga4.js
const fs   = require('fs');
const vm   = require('vm');
const path = require('path');

// 用 jsdom 风格的简单 mock：window / document / localStorage
function makeSandbox(extra = {}) {
  const dataLayer = [];
  const scripts   = [];
  const consentEl = { innerHTML: '', classList: { add() {}, remove() {} } };
  const listeners = { 'consent:updated': [] };

  const sandbox = {
    console,
    setTimeout, clearTimeout, queueMicrotask,
    Date, JSON, localStorage: (() => {
      const m = new Map();
      return {
        getItem: k => m.has(k) ? m.get(k) : null,
        setItem: (k, v) => m.set(k, String(v)),
        removeItem: k => m.delete(k),
        clear: () => m.clear(),
        _map: m
      };
    })(),
    window: null,
    document: {
      addEventListener() {},
      readyState: 'complete',
      getElementById: id => id === 'consent' ? consentEl : null,
      createElement: tag => {
        if (tag === 'script') {
          const s = { src: '', async: false, crossOrigin: '', onerror: null, _appended: false };
          const orig = s.src;
          Object.defineProperty(s, 'src', {
            get: () => orig,
            set: v => { s._appended = true; scripts.push({ src: v, async: s.async, crossOrigin: s.crossOrigin }); }
          });
          return s;
        }
        return { setAttribute() {}, getAttribute() {}, querySelector: () => null, querySelectorAll: () => [] };
      },
      head: { appendChild: () => {} },
      querySelector: () => null,
      querySelectorAll: () => []
    },
    CustomEvent: class { constructor(name, opts) { this.name = name; this.detail = opts?.detail; } },
    addEventListener: (name, fn) => {
      listeners[name] = listeners[name] || [];
      listeners[name].push(fn);
    },
    dispatchEvent: (e) => {
      (listeners[e.name] || []).forEach(fn => fn(e));
    },
    dataLayer,
    // gtag stub：把 push 累积到 dataLayer
    encodeURIComponent,
    URL,
    ...extra
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window = {
    dataLayer,
    addEventListener: sandbox.addEventListener,
    dispatchEvent: sandbox.dispatchEvent,
    location: { href: 'http://localhost/', pathname: '/' }
  };
  vm.createContext(sandbox);
  return { sandbox, dataLayer, scripts, listeners, consentEl };
}

function load(into, file) {
  const src = fs.readFileSync(path.join(__dirname, file), 'utf8');
  vm.runInContext(src, into);
}

let pass = 0, fail = 0;
function assert(name, cond, extra) {
  if (cond) { pass++; console.log(`✓ ${name}`); }
  else      { fail++; console.log(`✗ ${name}`, extra || ''); }
}

// ============== 1) 首次加载默认 denied ==============
{
  console.log('\n[1] First load: default consent = denied');
  const { sandbox, dataLayer } = makeSandbox();
  load(sandbox, 'assets/js/ga4.js');
  // dataLayer 应至少有：js、consent:default、set ads_data_redaction
  const findDefault = dataLayer.find(a => a[0] === 'consent' && a[1] === 'default');
  assert('consent:default pushed', !!findDefault);
  if (findDefault) {
    const s = findDefault[2];
    assert('  analytics_storage=denied', s.analytics_storage === 'denied', s);
    assert('  ad_storage=denied',        s.ad_storage === 'denied', s);
    assert('  ad_user_data=denied',      s.ad_user_data === 'denied', s);
    assert('  ad_personalization=denied',s.ad_personalization === 'denied', s);
    assert('  wait_for_update set',      typeof s.wait_for_update === 'number', s);
  }
  assert('gtag.js not loaded (no MEASUREMENT_ID yet)',
         sandbox.window.__GA4 && sandbox.window.__GA4.isLoaded() === false);
}

// ============== 2) 模拟 Accept all 流程（带占位 ID，但设 DEBUG） ==============
{
  console.log('\n[2] Accept all → grants + loads gtag');
  // 临时把 DEBUG=true + 注入 ID，避开占位 ID 的拦截
  const { sandbox, dataLayer, scripts } = makeSandbox();
  load(sandbox, 'assets/js/ga4.js');
  // 强制覆盖 MEASUREMENT_ID 调试
  vm.runInContext(`
    window.dataLayer.length = 0;
    window.__GA4 = null;
  `, sandbox);
  // 直接读源然后替换常量
  let src = fs.readFileSync(path.join(__dirname, 'assets/js/ga4.js'), 'utf8');
  src = src.replace("'G-XXXXXXXXXX'", "'G-TEST1234'");
  src = src.replace('const DEBUG = false', 'const DEBUG = true');
  vm.runInContext(src, sandbox);
  // 模拟用户选择 all
  sandbox.dispatchEvent(new sandbox.CustomEvent('consent:updated', { detail: { choice: 'all' } }));
  // 找 update
  const upd = dataLayer.find(a => a[0] === 'consent' && a[1] === 'update');
  assert('consent:update pushed on Accept all', !!upd);
  if (upd) {
    const s = upd[2];
    assert('  analytics_storage=granted', s.analytics_storage === 'granted', s);
    assert('  ad_storage=granted',        s.ad_storage === 'granted', s);
  }
  assert('gtag.js <script> injected (id=G-TEST1234)',
         scripts.some(s => s.src && s.src.includes('G-TEST1234')), scripts);
  assert('__GA4.isLoaded()=true after grant', sandbox.window.__GA4.isLoaded() === true);
}

// ============== 3) Analytics only：仅 analytics 同意 ==============
{
  console.log('\n[3] Analytics only → only analytics_storage granted');
  const { sandbox, dataLayer, scripts } = makeSandbox();
  let src = fs.readFileSync(path.join(__dirname, 'assets/js/ga4.js'), 'utf8');
  src = src.replace("'G-XXXXXXXXXX'", "'G-TEST1234'");
  vm.runInContext(src, sandbox);
  sandbox.dispatchEvent(new sandbox.CustomEvent('consent:updated', { detail: { choice: 'analytics' } }));
  const upd = dataLayer.find(a => a[0] === 'consent' && a[1] === 'update');
  assert('consent:update pushed on Analytics only', !!upd);
  if (upd) {
    const s = upd[2];
    assert('  analytics_storage=granted', s.analytics_storage === 'granted', s);
    assert('  ad_storage=denied',        s.ad_storage === 'denied', s);
    assert('  ad_user_data=denied',      s.ad_user_data === 'denied', s);
  }
  assert('gtag.js loaded (analytics granted)',
         scripts.some(s => s.src && s.src.includes('G-TEST1234')));
}

// ============== 4) Essential only：全 denied，不加载 gtag ==============
{
  console.log('\n[4] Essential only → all denied, no gtag');
  const { sandbox, dataLayer, scripts } = makeSandbox();
  let src = fs.readFileSync(path.join(__dirname, 'assets/js/ga4.js'), 'utf8');
  src = src.replace("'G-XXXXXXXXXX'", "'G-TEST1234'");
  vm.runInContext(src, sandbox);
  sandbox.dispatchEvent(new sandbox.CustomEvent('consent:updated', { detail: { choice: 'essential' } }));
  const upd = dataLayer.find(a => a[0] === 'consent' && a[1] === 'update');
  assert('consent:update pushed on Essential only', !!upd);
  if (upd) {
    const s = upd[2];
    assert('  analytics_storage=denied', s.analytics_storage === 'denied', s);
    assert('  ad_storage=denied',        s.ad_storage === 'denied', s);
  }
  assert('gtag.js NOT loaded on essential',
         !scripts.some(s => s.src && s.src.includes('G-TEST1234')));
}

// ============== 5) localStorage 持久化：刷新后恢复 ==============
{
  console.log('\n[5] Persisted consent: reload restores gtag load');
  const ls = new Map();
  const storage = {
    getItem: k => ls.has(k) ? ls.get(k) : null,
    setItem: (k, v) => ls.set(k, String(v)),
    removeItem: k => ls.delete(k)
  };
  // 第一次访问：用户选了 analytics
  let { sandbox, dataLayer, scripts } = makeSandbox({ localStorage: storage });
  let src = fs.readFileSync(path.join(__dirname, 'assets/js/ga4.js'), 'utf8');
  src = src.replace("'G-XXXXXXXXXX'", "'G-TEST1234'");
  vm.runInContext(src, sandbox);
  sandbox.dispatchEvent(new sandbox.CustomEvent('consent:updated', { detail: { choice: 'analytics' } }));
  // 模拟 consent.js 把选择写入 localStorage
  storage.setItem('gochina.consent', JSON.stringify({ choice: 'analytics', at: Date.now() }));
  // 模拟页面刷新：新建 sandbox 复用同一 storage
  ({ sandbox, dataLayer, scripts } = makeSandbox({ localStorage: storage }));
  vm.runInContext(src, sandbox);
  // 等 microtask 跑完后检查
  setImmediate(() => {
    assert('reload: gtag.js loaded (consent restored)',
           scripts.some(s => s.src && s.src.includes('G-TEST1234')));

    console.log(`\nResult: ${pass} passed, ${fail} failed`);
    process.exit(fail > 0 ? 1 : 0);
  });
}
