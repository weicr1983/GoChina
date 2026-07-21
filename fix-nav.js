// fix-nav.js — 一次性脚本：把所有页面统一成 6 项 nav
// 顶部 6 项：Visa / Budget / Planner / Payment / Transport / Cities
// About / Contact 留页脚
// 移动菜单同步
const fs   = require('fs');
const path = require('path');

// (filePath, depth) — depth=0 根目录；depth=1 一级子目录；depth=2 二级子目录
const FILES = [
  // depth 0 (root)
  { p: 'index.html',           d: 0, current: null },
  { p: '404.html',             d: 0, current: null },
  // depth 1
  { p: 'visa/index.html',      d: 1, current: 'visa' },
  { p: 'calculator/index.html',d: 1, current: 'calculator' },
  { p: 'planner/index.html',   d: 1, current: 'planner' },
  { p: 'payment/index.html',   d: 1, current: 'payment' },
  { p: 'transport/index.html', d: 1, current: 'transport' },
  { p: 'cities/index.html',    d: 1, current: 'cities' },
  { p: 'about/index.html',     d: 1, current: null },
  { p: 'contact/index.html',   d: 1, current: null },
  { p: 'privacy/index.html',   d: 1, current: null },
  { p: 'terms/index.html',     d: 1, current: null },
  { p: 'disclaimer/index.html',d: 1, current: null },
  // depth 2
  { p: 'cities/beijing/index.html',    d: 2, current: 'cities' },
  { p: 'cities/shanghai/index.html',   d: 2, current: 'cities' },
  { p: 'cities/guangzhou/index.html',  d: 2, current: 'cities' },
  { p: 'cities/chengdu/index.html',    d: 2, current: 'cities' },
  { p: 'cities/xian/index.html',       d: 2, current: 'cities' },
];

const ITEMS = [
  { key: 'visa',       href: 'visa/' },
  { key: 'calculator', href: 'calculator/' },
  { key: 'planner',    href: 'planner/' },
  { key: 'payment',    href: 'payment/' },
  { key: 'transport',  href: 'transport/' },
  { key: 'cities',     href: 'cities/' }
];

function makeDesktopNav(d, current) {
  const prefix = d === 0 ? '' : '../'.repeat(d);
  const lines = ITEMS.map(({ key, href }) => {
    const aria = key === current ? ' aria-current="page"' : '';
    return `        <a class="nav__link" href="${prefix}${href}"${aria} data-i18n="nav.${key}">${cap(key)}</a>`;
  });
  return `      <nav class="nav__links" aria-label="Primary">\n${lines.join('\n')}\n      </nav>`;
}

function makeMobileNav(d, current) {
  const prefix = d === 0 ? '' : '../'.repeat(d);
  const lines = ITEMS.map(({ key, href }) => {
    const aria = key === current ? ' aria-current="page"' : '';
    return `        <a href="${prefix}${href}"${aria} data-i18n="nav.${key}">${cap(key)}</a>`;
  });
  return `      <div class="nav__mobile" data-nav-mobile>\n${lines.join('\n')}\n      </div>`;
}

function cap(k) {
  return k === 'calculator' ? 'Budget' : (k.charAt(0).toUpperCase() + k.slice(1));
}

// 匹配两种 nav 块：
// 1) 深度 nav 形式：<nav class="nav__links"...>...</nav>（含多行内容）
// 2) 移动 nav 形式：<div class="nav__mobile" data-nav-mobile>...</div>
const RE_DESKTOP = /[ \t]*<nav class="nav__links"[^>]*>[\s\S]*?<\/nav>/;
const RE_MOBILE  = /[ \t]*<div class="nav__mobile" data-nav-mobile>[\s\S]*?<\/div>/;

let changed = 0, fail = 0;
for (const { p, d, current } of FILES) {
  const fp = path.join(__dirname, p);
  if (!fs.existsSync(fp)) { console.log(`✗ missing: ${p}`); fail++; continue; }
  let html = fs.readFileSync(fp, 'utf8');

  if (!RE_DESKTOP.test(html)) { console.log(`✗ no desktop nav: ${p}`); fail++; continue; }
  if (!RE_MOBILE.test(html))  { console.log(`✗ no mobile nav: ${p}`);  fail++; continue; }

  // 计算缩进：原始文件中 <nav 和 <div 的前缀空白
  const indMatch = html.match(new RegExp(`^([ \\t]*)<nav class="nav__links"`, 'm'));
  const ind = indMatch ? indMatch[1] : '      ';
  const ind2 = ind + '  ';

  // 重建 nav 块时统一缩进
  const desktopNew = `${ind}<nav class="nav__links" aria-label="Primary">\n${ITEMS.map(({ key, href }) => {
    const aria = key === current ? ' aria-current="page"' : '';
    return `${ind2}<a class="nav__link" href="${d === 0 ? '' : '../'.repeat(d)}${href}"${aria} data-i18n="nav.${key}">${cap(key)}</a>`;
  }).join('\n')}\n${ind}</nav>`;

  const mobileNew = `${ind}<div class="nav__mobile" data-nav-mobile>\n${ITEMS.map(({ key, href }) => {
    const aria = key === current ? ' aria-current="page"' : '';
    return `${ind2}<a href="${d === 0 ? '' : '../'.repeat(d)}${href}"${aria} data-i18n="nav.${key}">${cap(key)}</a>`;
  }).join('\n')}\n${ind}</div>`;

  html = html.replace(RE_DESKTOP, desktopNew);
  html = html.replace(RE_MOBILE, mobileNew);

  fs.writeFileSync(fp, html);
  console.log(`✓ ${p.padEnd(36)} (depth=${d}, current=${current || '—'})`);
  changed++;
}

console.log(`\n${changed} files updated, ${fail} failed.`);
process.exit(fail > 0 ? 1 : 0);
