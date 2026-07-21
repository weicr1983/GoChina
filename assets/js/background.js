/* ========================================
   background.js — 原创 Canvas 动态背景
   灵感来自新东方山水：多层径向渐变 + 缓动漂移 + 噪点。
   无任何外部素材，纯手写。
   ======================================== */
(function () {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init() {
    const containers = document.querySelectorAll('.bg-canvas');
    if (!containers.length) return;

    containers.forEach(container => {
      // prefers-reduced-motion → 用静态渐变（CSS）兜底
      if (reduced || !container.querySelector('canvas')) {
        const fallback = document.createElement('div');
        fallback.className = 'bg-static';
        container.appendChild(fallback);
        return;
      }

      const canvas = container.querySelector('canvas');
      const ctx = canvas.getContext('2d', { alpha: true });
      let dpr = Math.min(window.devicePixelRatio || 1, 2);
      let w = 0, h = 0;
      let t = 0;
      let mouseX = 0.5, mouseY = 0.5;
      let running = true;

      // 噪点缓存
      let noiseCanvas = document.createElement('canvas');
      let noiseCtx = noiseCanvas.getContext('2d');
      const noiseSize = 96;

      function buildNoise() {
        noiseCanvas.width = noiseSize;
        noiseCanvas.height = noiseSize;
        const img = noiseCtx.createImageData(noiseSize, noiseSize);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const v = (Math.random() * 255) | 0;
          d[i] = v; d[i + 1] = v; d[i + 2] = v;
          d[i + 3] = 16; // 极淡
        }
        noiseCtx.putImageData(img, 0, 0);
      }

      function resize() {
        const rect = container.getBoundingClientRect();
        w = rect.width;
        h = rect.height;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      // 颜色（取自 CSS 变量）
      const css = getComputedStyle(document.documentElement);
      const COL_A = hexToRgb(css.getPropertyValue('--c-landscape').trim() || '#3F7C85');
      const COL_B = hexToRgb(css.getPropertyValue('--c-cinnabar').trim()  || '#C03B2B');
      const COL_C = hexToRgb('#F5F0E6');

      function draw() {
        if (!running) return;
        t += 0.0035;

        // 视差偏移
        const ox = (mouseX - 0.5) * 8;
        const oy = (mouseY - 0.5) * 8;

        ctx.clearRect(0, 0, w, h);

        // 底层：暗墨色填充（透明叠加在页面底色上）
        ctx.fillStyle = 'rgba(15,17,21,0)';
        ctx.fillRect(0, 0, w, h);

        // 第一层：山水青（左侧大圆）
        const ax = w * (0.30 + Math.sin(t * 0.7) * 0.04) + ox;
        const ay = h * (0.32 + Math.cos(t * 0.6) * 0.03) + oy;
        const ar = Math.max(w, h) * 0.65;
        const gradA = ctx.createRadialGradient(ax, ay, 0, ax, ay, ar);
        gradA.addColorStop(0,   `rgba(${COL_A.r},${COL_A.g},${COL_A.b},0.55)`);
        gradA.addColorStop(0.5, `rgba(${COL_A.r},${COL_A.g},${COL_A.b},0.18)`);
        gradA.addColorStop(1,   `rgba(${COL_A.r},${COL_A.g},${COL_A.b},0)`);
        ctx.fillStyle = gradA;
        ctx.fillRect(0, 0, w, h);

        // 第二层：辰砂红（右侧偏下）
        const bx = w * (0.78 + Math.cos(t * 0.5) * 0.05) + ox;
        const by = h * (0.72 + Math.sin(t * 0.8) * 0.04) + oy;
        const br = Math.max(w, h) * 0.55;
        const gradB = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        gradB.addColorStop(0,   `rgba(${COL_B.r},${COL_B.g},${COL_B.b},0.45)`);
        gradB.addColorStop(0.5, `rgba(${COL_B.r},${COL_B.g},${COL_B.b},0.12)`);
        gradB.addColorStop(1,   `rgba(${COL_B.r},${COL_B.g},${COL_B.b},0)`);
        ctx.fillStyle = gradB;
        ctx.fillRect(0, 0, w, h);

        // 第三层：米白高光（顶部微弱）
        const cx = w * (0.5 + Math.sin(t * 0.3) * 0.02);
        const cy = h * (0.1 + Math.cos(t * 0.4) * 0.02);
        const cr = Math.max(w, h) * 0.4;
        const gradC = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
        gradC.addColorStop(0,   `rgba(${COL_C.r},${COL_C.g},${COL_C.b},0.06)`);
        gradC.addColorStop(1,   `rgba(${COL_C.r},${COL_C.g},${COL_C.b},0)`);
        ctx.fillStyle = gradC;
        ctx.fillRect(0, 0, w, h);

        // 噪点叠加
        const pat = ctx.createPattern(noiseCanvas, 'repeat');
        ctx.fillStyle = pat;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;

        rafId = requestAnimationFrame(draw);
      }

      let rafId;
      function loop() { running = true; draw(); }
      function stop() { running = false; cancelAnimationFrame(rafId); }

      buildNoise();
      resize();
      loop();

      window.addEventListener('resize', () => {
        resize();
        buildNoise();
      });

      container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        mouseX = (e.clientX - rect.left) / rect.width;
        mouseY = (e.clientY - rect.top) / rect.height;
      });
      container.addEventListener('mouseleave', () => { mouseX = 0.5; mouseY = 0.5; });

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) stop(); else loop();
      });
    });
  }

  function hexToRgb(hex) {
    const m = hex.replace('#', '').match(/.{1,2}/g);
    if (!m) return { r: 0, g: 0, b: 0 };
    return { r: parseInt(m[0], 16), g: parseInt(m[1], 16), b: parseInt(m[2], 16) };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
