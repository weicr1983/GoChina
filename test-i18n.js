// i18n 字典完整性测试：8 种新语言必须与 en.json 共享 key 结构
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'assets', 'data', 'i18n');
const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'en.json'), 'utf8'));
const LANGS = ['zh-CN', 'zh-TW', 'ja', 'ko', 'ru', 'fr', 'de', 'es', 'it'];

function flatten(obj, prefix = '', out = new Set()) {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, key, out);
    } else {
      out.add(key);
    }
  }
  return out;
}
const enKeys = flatten(en);
console.log(`en.json keys: ${enKeys.size}`);

let pass = 0, fail = 0;
for (const lang of LANGS) {
  const file = path.join(ROOT, `${lang}.json`);
  if (!fs.existsSync(file)) {
    console.log(`✗ ${lang.padEnd(6)} file missing`);
    fail++;
    continue;
  }
  const dict = JSON.parse(fs.readFileSync(file, 'utf8'));
  const keys = flatten(dict);
  const missing = [...enKeys].filter(k => !keys.has(k));
  const extra   = [...keys].filter(k => !enKeys.has(k));

  // 占位符完整性：含 {year} 或 {n} 的 key，翻译也要保留
  const placeholderFails = [];
  for (const k of enKeys) {
    const enVal = k.split('.').reduce((a, p) => (a == null ? a : a[p]), en);
    if (typeof enVal === 'string' && /\{[a-z]+\}/i.test(enVal)) {
      const trVal = k.split('.').reduce((a, p) => (a == null ? a : a[p]), dict);
      if (typeof trVal === 'string' && !/\{[a-z]+\}/i.test(trVal)) {
        placeholderFails.push(k);
      }
    }
  }

  const ok = missing.length === 0 && extra.length === 0 && placeholderFails.length === 0;
  if (ok) pass++; else fail++;
  console.log(`${ok ? '✓' : '✗'} ${lang.padEnd(6)} keys=${keys.size} missing=${missing.length} extra=${extra.length} placeholderFails=${placeholderFails.length}`);
  if (!ok) {
    if (missing.length) console.log(`     missing (first 5): ${missing.slice(0, 5).join(', ')}`);
    if (placeholderFails.length) console.log(`     placeholderFails: ${placeholderFails.join(', ')}`);
  }
}

console.log(`\nResult: ${pass}/${LANGS.length} languages match en.json structure.`);
process.exit(fail > 0 ? 1 : 0);
