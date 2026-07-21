// 极简静态服务器（无依赖）
// 用法：node serve.js
const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const PORT = 4173;
const ROOT = __dirname;

// 支持的语言前缀：URL 形如 /ja/visa/ 时，会去掉 /ja/ 前缀并回退到 /visa/，
// 由前端 i18n.js 根据前缀加载对应语言字典。
const LANG_PREFIX = /^\/(en|zh-CN|zh-TW|ja|ko|ru|fr|de|es|it)(?:\/|$)/;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.xml':  'application/xml; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  let p = url.parse(req.url).pathname;

  // 去掉语言前缀（URL 改写，不影响 SEO 的 hreflang 链接）
  p = p.replace(LANG_PREFIX, '/');

  if (p === '') p = '/';
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, decodeURIComponent(p));

  // 防越界
  if (!file.startsWith(ROOT)) {
    res.writeHead(403); return res.end('forbidden');
  }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      // SPA fallback 到 404
      const nf = path.join(ROOT, '404.html');
      if (fs.existsSync(nf)) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        return fs.createReadStream(nf).pipe(res);
      }
      res.writeHead(404); return res.end('404');
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`GoChina dev server → http://localhost:${PORT}/`);
  console.log(`Language URL prefix supported: /en/ /zh-CN/ /zh-TW/ /ja/ /ko/ /ru/ /fr/ /de/ /es/ /it/`);
});
