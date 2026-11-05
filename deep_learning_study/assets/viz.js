/* 인터랙티브 시각화 모음 — 캔버스 기반, 외부 라이브러리 없음 */
(function () {
  'use strict';
  const running = new Set();
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const PAL = () => ({ text: css('--text'), muted: css('--muted'), border: css('--border'), bg: css('--surface-2'), surf: css('--surface'), accent: css('--accent'), good: css('--good'), bad: css('--bad'), warn: css('--warn') });
  const SERIES = ['#5b5bd6', '#e5484d', '#12a594', '#f5a524', '#8e4ec6', '#0091ff'];

  // 페이지 이동 후 떨어져 나간 캔버스의 리스너를 정리
  const envFns = new Set();
  const onEnv = (cv, fn) => { const f = () => { if (!cv.isConnected) { envFns.delete(f); return; } fn(); }; envFns.add(f); };
  window.addEventListener('themechange', () => envFns.forEach(f => f()));
  window.addEventListener('resize', () => envFns.forEach(f => f()));
  function setupCanvas(cv, h) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.parentElement.clientWidth - 0;
    cv.style.height = h + 'px';
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }
  function shell(el, title, desc, h, controls) {
    el.classList.add('card', 'viz');
    el.innerHTML = `<div class="vt">${title}</div><div class="vd">${desc}</div><div class="cvwrap"><canvas></canvas></div><div class="controls">${controls || ''}</div>`;
    const cv = el.querySelector('canvas');
    return { cv, ctl: el.querySelector('.controls'), q: s => el.querySelector(s) };
  }
  function loop(fn) {
    const o = { on: true };
    running.add(o);
    const tick = () => { if (!o.on) return; fn(); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    return o;
  }
  function axes(ctx, w, h, xr, yr, P, pad = 30) {
    const X = x => pad + (x - xr[0]) / (xr[1] - xr[0]) * (w - pad * 1.5);
    const Y = y => h - pad + -(y - yr[0]) / (yr[1] - yr[0]) * (h - pad * 1.6);
    ctx.strokeStyle = P.border; ctx.lineWidth = 1; ctx.fillStyle = P.muted; ctx.font = '11px JetBrains Mono, monospace';
    ctx.beginPath();
    if (yr[0] <= 0 && yr[1] >= 0) { ctx.moveTo(X(xr[0]), Y(0)); ctx.lineTo(X(xr[1]), Y(0)); }
    if (xr[0] <= 0 && xr[1] >= 0) { ctx.moveTo(X(0), Y(yr[0])); ctx.lineTo(X(0), Y(yr[1])); }
    ctx.stroke();
    const sx = niceStep(xr[1] - xr[0]), sy = niceStep(yr[1] - yr[0]);
    ctx.textAlign = 'center';
    for (let x = Math.ceil(xr[0] / sx) * sx; x <= xr[1] + 1e-9; x += sx) if (Math.abs(x) > 1e-9) ctx.fillText(+x.toFixed(2), X(x), Math.min(h - 8, Math.max(12, Y(0) + 14)));
    ctx.textAlign = 'right';
    for (let y = Math.ceil(yr[0] / sy) * sy; y <= yr[1] + 1e-9; y += sy) if (Math.abs(y) > 1e-9) ctx.fillText(+y.toFixed(2), Math.max(26, X(0) - 4), Y(y) + 4);
    return { X, Y };
  }
  function niceStep(r) { const s = Math.pow(10, Math.floor(Math.log10(r / 5))); const m = r / 5 / s; return (m < 1.5 ? 1 : m < 3.5 ? 2 : 5) * s; }
  function plotFn(ctx, f, xr, X, Y, color, width = 2.5, dash) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.beginPath();
    let first = true;
    for (let i = 0; i <= 400; i++) {
      const x = xr[0] + (xr[1] - xr[0]) * i / 400, y = f(x);
      if (!isFinite(y)) { first = true; continue; }
      first ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y)); first = false;
    }
    ctx.stroke(); ctx.setLineDash([]);
  }
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; }; }
  function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r()); }

  /* ===== 1. 미분: 접선 ===== */
  function derivative(el) {
    const fns = {
      'x²': [x => x * x, x => 2 * x, [-3, 3], [-1, 9]],
      'sin(x)': [Math.sin, Math.cos, [-6.3, 6.3], [-1.6, 1.6]],
      'x³ − 3x': [x => x ** 3 - 3 * x, x => 3 * x * x - 3, [-2.6, 2.6], [-5, 5]],
      'σ(x) 시그모이드': [x => 1 / (1 + Math.exp(-x)), x => { const s = 1 / (1 + Math.exp(-x)); return s * (1 - s); }, [-7, 7], [-0.2, 1.2]]
    };
    const { cv, q } = shell(el, '📈 미분 = 접선의 기울기', '캔버스를 드래그해 점을 옮기고, h를 줄이면 할선(주황)이 접선(파랑)에 다가가는 것을 확인하세요.', 300,
      `<label>함수 <select data-k="f">${Object.keys(fns).map(k => `<option>${k}</option>`).join('')}</select></label>
       <label>h <input type="range" data-k="h" min="0.01" max="2" step="0.01" value="1"></label><span class="readout" data-k="ro"></span>`);
    let x0 = 1, drag = false;
    const draw = () => {
      const P = PAL(); const { ctx, w, h } = setupCanvas(cv, 300);
      const [f, df, xr, yr] = fns[q('[data-k=f]').value]; const hh = +q('[data-k=h]').value;
      x0 = Math.max(xr[0], Math.min(xr[1], x0));
      const { X, Y } = axes(ctx, w, h, xr, yr, P);
      plotFn(ctx, f, xr, X, Y, P.text, 2.5);
      const m = df(x0); plotFn(ctx, x => f(x0) + m * (x - x0), xr, X, Y, SERIES[0], 2);
      const ms = (f(x0 + hh) - f(x0)) / hh; plotFn(ctx, x => f(x0) + ms * (x - x0), xr, X, Y, SERIES[3], 2, [6, 4]);
      [[x0, f(x0), SERIES[0]], [x0 + hh, f(x0 + hh), SERIES[3]]].forEach(([a, b, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(X(a), Y(b), 6, 0, 7); ctx.fill(); });
      q('[data-k=ro]').textContent = `x=${x0.toFixed(2)}  f'(x)=${m.toFixed(4)}  할선 기울기=${ms.toFixed(4)}  오차=${Math.abs(ms - m).toFixed(4)}`;
      cv._X = X; cv._xr = xr;
    };
    const pick = e => { const r = cv.getBoundingClientRect(); const px = (e.touches ? e.touches[0].clientX : e.clientX) - r.left; const xr = cv._xr; x0 = xr[0] + (px - 30) / (r.width - 45) * (xr[1] - xr[0]); draw(); };
    cv.addEventListener('pointerdown', e => { drag = true; pick(e); }); cv.addEventListener('pointermove', e => drag && pick(e)); window.addEventListener('pointerup', () => drag = false);
    el.querySelectorAll('select,input').forEach(i => i.oninput = draw);
    draw(); onEnv(cv, draw);
  }

  /* ===== 2. 경사하강법 (선형회귀 손실 지형) ===== */
  function gd(el) {
    const { cv, q } = shell(el, '⛰️ 경사하강법: 손실 지형을 내려가기', '등고선은 손실 $L(w_1,w_2)$입니다. 캔버스를 클릭해 시작점을 정하고 ▶를 누르세요. 학습률이 너무 크면 발산하고, 너무 작으면 거의 움직이지 않습니다.', 340,
      `<label>학습률 η <input type="range" data-k="lr" min="0.005" max="1.1" step="0.005" value="0.1"></label><span class="readout" data-k="lrv"></span>
       <label>지형 <select data-k="s"><option value="bowl">둥근 그릇</option><option value="ellipse" selected>길쭉한 골짜기</option><option value="saddle">안장점 근처</option></select></label>
       <button class="btn sm" data-k="go">▶ 실행</button><button class="btn sm" data-k="step">한 걸음</button><button class="btn sm" data-k="rs">초기화</button><span class="readout" data-k="ro"></span>`);
    const surf = {
      bowl: { f: (a, b) => a * a + b * b, g: (a, b) => [2 * a, 2 * b] },
      ellipse: { f: (a, b) => 0.5 * a * a + 4 * b * b, g: (a, b) => [a, 8 * b] },
      saddle: { f: (a, b) => 0.5 * a * a - 0.3 * b * b + 0.05 * b ** 4, g: (a, b) => [a, -0.6 * b + 0.2 * b ** 3] }
    };
    const R = 3;
    let p = [-2.6, 1.6], path = [p.slice()], anim = null, it = 0;
    const reset = () => { path = [p.slice()]; it = 0; };
    const step = () => {
      const S = surf[q('[data-k=s]').value]; const lr = +q('[data-k=lr]').value;
      const c = path[path.length - 1]; const g = S.g(c[0], c[1]);
      const n = [c[0] - lr * g[0], c[1] - lr * g[1]];
      if (Math.abs(n[0]) > 50 || Math.abs(n[1]) > 50 || !isFinite(n[0])) { stop(); q('[data-k=ro]').textContent += '  ⚠ 발산!'; return; }
      path.push(n); it++; draw();
    };
    const stop = () => { if (anim) { anim.on = false; running.delete(anim); anim = null; } q('[data-k=go]').textContent = '▶ 실행'; };
    let bg = null, bgKey = '';
    const draw = () => {
      const P = PAL(); const { ctx, w, h } = setupCanvas(cv, 340);
      const S = surf[q('[data-k=s]').value];
      const sx = a => w / 2 + a / R * (w / 2), sy = b => h / 2 - b / R * (h / 2) * (w > h ? 1 : 1);
      const key = q('[data-k=s]').value + w + h + P.accent;
      if (bgKey !== key) {
        // 히트맵 + 등고선
        const img = ctx.createImageData(Math.round(w), Math.round(h));
        let mx = 0; for (let i = 0; i < 400; i++) { const a = -R + 2 * R * Math.random(), b = -R * h / w + 2 * R * h / w * Math.random(); mx = Math.max(mx, S.f(a, b)); }
        const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
        for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
          const a = (x - w / 2) / (w / 2) * R, b = -(y - h / 2) / (h / 2) * R;
          const v = S.f(a, b); const t = Math.max(0, Math.min(1, Math.log1p(Math.max(v, 0) * 3) / Math.log1p(mx * 3)));
          const band = (Math.floor(Math.sqrt(Math.max(0, v - (q('[data-k=s]').value === 'saddle' ? -3 : 0))) * 4) % 2) ? 0.04 : 0;
          const i = (y * img.width + x) * 4;
          if (dark) { img.data[i] = 20 + 90 * t; img.data[i + 1] = 22 + 40 * t + 30 * band * 10; img.data[i + 2] = 40 + 120 * (1 - t); }
          else { img.data[i] = 235 - 40 * (1 - t) + 20 * t; img.data[i + 1] = 238 - 30 * t - band * 300; img.data[i + 2] = 250 - 120 * t; }
          img.data[i + 3] = 255;
        }
        bg = img; bgKey = key;
      }
      ctx.putImageData(bg, 0, 0);
      // 최소점 표시
      ctx.strokeStyle = P.muted; ctx.beginPath(); ctx.arc(sx(0), sy(0), 5, 0, 7); ctx.stroke();
      // 경로
      ctx.strokeStyle = '#e5484d'; ctx.lineWidth = 2; ctx.beginPath();
      path.forEach((c, i) => i ? ctx.lineTo(sx(c[0]), sy(c[1])) : ctx.moveTo(sx(c[0]), sy(c[1]))); ctx.stroke();
      path.forEach((c, i) => { ctx.fillStyle = i === path.length - 1 ? '#e5484d' : 'rgba(229,72,77,.5)'; ctx.beginPath(); ctx.arc(sx(c[0]), sy(c[1]), i === path.length - 1 ? 6 : 3, 0, 7); ctx.fill(); });
      const c = path[path.length - 1];
      q('[data-k=ro]').textContent = `step ${it}  w=(${c[0].toFixed(3)}, ${c[1].toFixed(3)})  L=${S.f(c[0], c[1]).toFixed(4)}`;
      q('[data-k=lrv]').textContent = (+q('[data-k=lr]').value).toFixed(3);
      cv._inv = (px, py) => [(px - w / 2) / (w / 2) * R, -(py - h / 2) / (h / 2) * R];
    };
    cv.addEventListener('click', e => { const r = cv.getBoundingClientRect(); p = cv._inv(e.clientX - r.left, e.clientY - r.top); stop(); reset(); draw(); });
    q('[data-k=go]').onclick = () => { if (anim) return stop(); q('[data-k=go]').textContent = '⏸ 정지'; let t = 0; anim = loop(() => { if (++t % 6 === 0) { step(); if (path.length > 300) stop(); } }); };
    q('[data-k=step]').onclick = step;
    q('[data-k=rs]').onclick = () => { stop(); reset(); draw(); };
    q('[data-k=lr]').oninput = () => { q('[data-k=lrv]').textContent = (+q('[data-k=lr]').value).toFixed(3); };
    q('[data-k=s]').onchange = () => { stop(); reset(); draw(); };
    draw(); onEnv(cv, () => { bgKey = ''; draw(); });
  }

  /* ===== 3. 활성화 함수 ===== */
  function activation(el) {
    const A = {
      Sigmoid: [x => 1 / (1 + Math.exp(-x)), x => { const s = 1 / (1 + Math.exp(-x)); return s * (1 - s); }],
      Tanh: [Math.tanh, x => 1 - Math.tanh(x) ** 2],
      ReLU: [x => Math.max(0, x), x => x > 0 ? 1 : 0],
      'Leaky ReLU': [x => x > 0 ? x : 0.1 * x, x => x > 0 ? 1 : 0.1],
      GELU: [x => 0.5 * x * (1 + Math.tanh(0.7978845608 * (x + 0.044715 * x ** 3))), x => { const h = 1e-4; const g = A.GELU[0]; return (g(x + h) - g(x - h)) / (2 * h); }],
      SiLU: [x => x / (1 + Math.exp(-x)), x => { const s = 1 / (1 + Math.exp(-x)); return s + x * s * (1 - s); }]
    };
    const names = Object.keys(A);
    const { cv, q } = shell(el, '⚡ 활성화 함수와 그 도함수', '실선은 함수, 점선은 도함수입니다. 시그모이드·tanh의 도함수가 양 끝에서 0에 가까워지는 것이 바로 "기울기 소실"의 원인입니다.', 300,
      names.map((n, i) => `<label><input type="checkbox" data-n="${n}" ${i === 0 || i === 2 ? 'checked' : ''}> <span style="color:${SERIES[i]};font-weight:700">${n}</span></label>`).join('') + `<label><input type="checkbox" data-k="d" checked> 도함수 표시</label>`);
    const draw = () => {
      const P = PAL(); const { ctx, w, h } = setupCanvas(cv, 300);
      const xr = [-5, 5], yr = [-1.5, 3];
      const { X, Y } = axes(ctx, w, h, xr, yr, P);
      names.forEach((n, i) => {
        if (!q(`[data-n="${n}"]`).checked) return;
        plotFn(ctx, A[n][0], xr, X, Y, SERIES[i], 2.5);
        if (q('[data-k=d]').checked) plotFn(ctx, A[n][1], xr, X, Y, SERIES[i], 1.6, [5, 4]);
      });
    };
    el.querySelectorAll('input').forEach(i => i.onchange = draw);
    draw(); onEnv(cv, draw);
  }

  /* ===== 4. 미니 신경망 플레이그라운드 ===== */
  function makeData(kind, n, seed) {
    const r = rng(seed), X = [], Y = [];
    for (let i = 0; i < n; i++) {
      let x, y, c;
      if (kind === 'xor') { x = r() * 2 - 1; y = r() * 2 - 1; c = (x * y > 0) ? 1 : 0; x += gauss(r) * .05; y += gauss(r) * .05; }
      else if (kind === 'circle') { const rad = i % 2 ? r() * .45 : .65 + r() * .3; const t = r() * 6.283; x = rad * Math.cos(t); y = rad * Math.sin(t); c = i % 2; }
      else if (kind === 'moons') { const t = r() * Math.PI; c = i % 2; if (c) { x = Math.cos(t) * .6 - .3; y = Math.sin(t) * .6 - .15; } else { x = .3 - Math.cos(t) * .6; y = .15 - Math.sin(t) * .6; } x += gauss(r) * .06; y += gauss(r) * .06; }
      else if (kind === 'spiral') { c = i % 2; const t = (i / n) * 3.2 * Math.PI / 1 + 0.3; const rad = t / (3.6 * Math.PI) ; x = rad * Math.cos(t + c * Math.PI) + gauss(r) * .03; y = rad * Math.sin(t + c * Math.PI) + gauss(r) * .03; }
      else { c = i % 2; x = (c ? .4 : -.4) + gauss(r) * .22; y = (c ? .3 : -.3) + gauss(r) * .22; }
      X.push([x, y]); Y.push(c);
    }
    return { X, Y };
  }
  function MLP(sizes, act, seed) {
    const r = rng(seed); const W = [], B = [];
    for (let l = 0; l < sizes.length - 1; l++) {
      const a = sizes[l], b = sizes[l + 1], s = Math.sqrt(2 / a);
      W.push(Array.from({ length: b }, () => Array.from({ length: a }, () => gauss(r) * s)));
      B.push(new Array(b).fill(0));
    }
    const f = { tanh: [Math.tanh, (z, a) => 1 - a * a], relu: [z => z > 0 ? z : 0, z => z > 0 ? 1 : 0], sigmoid: [z => 1 / (1 + Math.exp(-z)), (z, a) => a * (1 - a)] }[act];
    function forward(x) {
      const As = [x], Zs = [];
      for (let l = 0; l < W.length; l++) {
        const z = W[l].map((row, j) => row.reduce((s, w, k) => s + w * As[l][k], B[l][j]));
        Zs.push(z);
        As.push(l === W.length - 1 ? z.map(v => 1 / (1 + Math.exp(-v))) : z.map(f[0]));
      }
      return { As, Zs };
    }
    function trainBatch(X, Y, lr, l2) {
      const gW = W.map(m => m.map(r => r.map(() => 0))), gB = B.map(b => b.map(() => 0));
      let loss = 0;
      for (let i = 0; i < X.length; i++) {
        const { As, Zs } = forward(X[i]); const p = As[As.length - 1][0];
        loss += -(Y[i] * Math.log(p + 1e-9) + (1 - Y[i]) * Math.log(1 - p + 1e-9));
        let d = [p - Y[i]];
        for (let l = W.length - 1; l >= 0; l--) {
          for (let j = 0; j < W[l].length; j++) { gB[l][j] += d[j]; for (let k = 0; k < W[l][j].length; k++) gW[l][j][k] += d[j] * As[l][k]; }
          if (l > 0) { d = As[l].map((a, k) => W[l].reduce((s, row, j) => s + row[k] * d[j], 0) * f[1](Zs[l - 1][k], a)); }
        }
      }
      const n = X.length;
      for (let l = 0; l < W.length; l++) for (let j = 0; j < W[l].length; j++) { B[l][j] -= lr * gB[l][j] / n; for (let k = 0; k < W[l][j].length; k++) W[l][j][k] -= lr * (gW[l][j][k] / n + l2 * W[l][j][k]); }
      return loss / n;
    }
    return { forward, trainBatch, predict: x => { const { As } = forward(x); return As[As.length - 1][0]; } };
  }
  function playground(el) {
    const { cv, q } = shell(el, '🧠 미니 신경망 놀이터', '브라우저에서 진짜 신경망(역전파 포함)을 학습시킵니다. 배경색은 모델이 예측한 확률, 점은 데이터입니다. 은닉층이 없으면 직선 경계밖에 못 그린다는 사실을 XOR·원·나선 데이터로 확인해 보세요.', 360,
      `<label>데이터 <select data-k="d"><option value="xor">XOR</option><option value="circle">원</option><option value="moons">반달</option><option value="spiral">나선</option><option value="blobs">두 덩어리</option></select></label>
       <label>은닉층 <select data-k="arch"><option value="">없음(로지스틱 회귀)</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="8" selected>8</option><option value="16,16">16-16</option><option value="32,32,16">32-32-16</option></select></label>
       <label>활성화 <select data-k="a"><option>tanh</option><option>relu</option><option>sigmoid</option></select></label>
       <label>학습률 <select data-k="lr"><option>0.03</option><option>0.1</option><option selected>0.3</option><option>1</option><option>3</option></select></label>
       <label>L2 <select data-k="l2"><option value="0" selected>0</option><option>0.001</option><option>0.01</option></select></label>
       <button class="btn sm" data-k="go">▶ 학습</button><button class="btn sm" data-k="rs">초기화</button><span class="readout" data-k="ro"></span>`);
    let data, net, ep = 0, anim = null, lossHist = [];
    const init = () => {
      data = makeData(q('[data-k=d]').value, 240, 7);
      const hid = q('[data-k=arch]').value ? q('[data-k=arch]').value.split(',').map(Number) : [];
      net = MLP([2, ...hid, 1], q('[data-k=a]').value, 42); ep = 0; lossHist = [];
    };
    const draw = () => {
      const P = PAL(); const { ctx, w, h } = setupCanvas(cv, 360);
      const sz = Math.min(h, w * .62), ox = 0, cell = 6;
      const map = v => (v + 1.1) / 2.2 * sz;
      for (let py = 0; py < sz; py += cell) for (let px = 0; px < sz; px += cell) {
        const p = net.predict([px / sz * 2.2 - 1.1, -(py / sz * 2.2 - 1.1)]);
        const a = Math.abs(p - .5) * 1.2;
        ctx.fillStyle = p > .5 ? `rgba(91,91,214,${a})` : `rgba(229,72,77,${a})`;
        ctx.fillRect(ox + px, py, cell, cell);
      }
      data.X.forEach((x, i) => { ctx.fillStyle = data.Y[i] ? '#3a3ab8' : '#c62f34'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ox + map(x[0]), map(-x[1]), 3.6, 0, 7); ctx.fill(); ctx.stroke(); });
      // 손실 곡선
      const lx = sz + 20, lw = w - lx - 10;
      if (lw > 80) {
        ctx.fillStyle = P.muted; ctx.font = '12px Noto Sans KR, sans-serif'; ctx.fillText('손실(교차 엔트로피)', lx, 16);
        ctx.strokeStyle = P.border; ctx.strokeRect(lx, 24, lw, h - 40);
        if (lossHist.length > 1) {
          const mx = Math.max(...lossHist, .8);
          ctx.strokeStyle = SERIES[0]; ctx.lineWidth = 2; ctx.beginPath();
          lossHist.forEach((l, i) => { const x = lx + i / (lossHist.length - 1) * lw, y = 24 + (h - 40) * (1 - l / mx); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
        }
      }
      let acc = 0; data.X.forEach((x, i) => { acc += ((net.predict(x) > .5 ? 1 : 0) === data.Y[i]); });
      q('[data-k=ro]').textContent = `epoch ${ep}  loss ${lossHist.length ? lossHist[lossHist.length - 1].toFixed(4) : '-'}  정확도 ${(acc / data.X.length * 100).toFixed(1)}%`;
    };
    const stop = () => { if (anim) { anim.on = false; running.delete(anim); anim = null; } q('[data-k=go]').textContent = '▶ 학습'; };
    q('[data-k=go]').onclick = () => {
      if (anim) return stop();
      q('[data-k=go]').textContent = '⏸ 정지';
      anim = loop(() => {
        let l; for (let k = 0; k < 5; k++) { l = net.trainBatch(data.X, data.Y, +q('[data-k=lr]').value, +q('[data-k=l2]').value); ep++; }
        lossHist.push(l); if (lossHist.length > 400) lossHist = lossHist.filter((_, i) => i % 2 === 0);
        draw(); if (ep > 4000) stop();
      });
    };
    q('[data-k=rs]').onclick = () => { stop(); init(); draw(); };
    el.querySelectorAll('select').forEach(s => s.onchange = () => { stop(); init(); draw(); });
    init(); draw(); onEnv(cv, draw);
  }

  /* ===== 5. 계산 그래프 ===== */
  function compgraph(el) {
    const { cv, q } = shell(el, '🔁 계산 그래프 위의 순전파·역전파', '$f = \\sigma(w x + b)$, 손실 $L = (f - y)^2$. 위쪽 숫자(검정)는 순전파 값, 아래쪽 숫자(빨강)는 $\\partial L/\\partial(\\cdot)$ 입니다. 슬라이더를 움직이며 각 기울기가 어떻게 곱해져 전달되는지 따라가 보세요.', 320,
      ['x', 'w', 'b', 'y'].map((k, i) => `<label>${k} <input type="range" data-k="${k}" min="-3" max="3" step="0.1" value="${[1.5, -0.8, 0.5, 1][i]}"><span class="readout" data-v="${k}"></span></label>`).join(''));
    const draw = () => {
      const P = PAL(); const { ctx, w, h } = setupCanvas(cv, 320);
      const v = k => +q(`[data-k=${k}]`).value;
      ['x', 'w', 'b', 'y'].forEach(k => q(`[data-v=${k}]`).textContent = v(k).toFixed(1));
      const x = v('x'), W = v('w'), b = v('b'), y = v('y');
      const m = W * x, z = m + b, f = 1 / (1 + Math.exp(-z)), d = f - y, L = d * d;
      const dL = 1, dd = 2 * d, df = dd, dz = df * f * (1 - f), dm = dz, db = dz, dW = dm * x, dx = dm * W;
      const sx = w / 760;
      const N = {
        x: [60, 70, 'x', x, dx], w: [60, 200, 'w', W, dW], mul: [200, 135, '×', m, dm], b: [200, 232, 'b', b, db],
        add: [330, 170, '+', z, dz], sig: [460, 170, 'σ', f, df], y: [460, 60, 'y', y, null], sub: [590, 120, '−', d, dd], sq: [700, 120, '²', L, dL]
      };
      const E = [['x', 'mul'], ['w', 'mul'], ['mul', 'add'], ['b', 'add'], ['add', 'sig'], ['sig', 'sub'], ['y', 'sub'], ['sub', 'sq']];
      ctx.lineWidth = 1.5;
      E.forEach(([a, c]) => {
        const A = N[a], B = N[c]; ctx.strokeStyle = P.muted; ctx.beginPath(); ctx.moveTo(A[0] * sx, A[1]); ctx.lineTo(B[0] * sx, B[1]); ctx.stroke();
        const ang = Math.atan2(B[1] - A[1], (B[0] - A[0]) * sx), ex = B[0] * sx - Math.cos(ang) * 24, ey = B[1] - Math.sin(ang) * 24;
        ctx.fillStyle = P.muted; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - 8 * Math.cos(ang - .4), ey - 8 * Math.sin(ang - .4)); ctx.lineTo(ex - 8 * Math.cos(ang + .4), ey - 8 * Math.sin(ang + .4)); ctx.fill();
      });
      Object.values(N).forEach(([nx, ny, lab, val, grad]) => {
        const op = !'xwby'.includes(lab) || lab.length > 1;
        ctx.fillStyle = op ? P.accent : P.surf; ctx.strokeStyle = P.accent; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(nx * sx, ny, 22, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = op ? '#fff' : P.text; ctx.font = 'bold 16px JetBrains Mono, monospace'; ctx.textAlign = 'center'; ctx.fillText(lab, nx * sx, ny + 5);
        ctx.font = '12px JetBrains Mono, monospace'; ctx.fillStyle = P.text; ctx.fillText(val.toFixed(3), nx * sx, ny - 30);
        if (grad !== null) { ctx.fillStyle = '#e5484d'; ctx.fillText(grad.toFixed(3), nx * sx, ny + 40); }
      });
      ctx.textAlign = 'left'; ctx.fillStyle = P.muted; ctx.font = '12px Noto Sans KR, sans-serif';
      ctx.fillText(`L = ${L.toFixed(4)}   →  경사하강 한 걸음(η=0.5): w ← ${W.toFixed(2)} − 0.5×${dW.toFixed(3)} = ${(W - .5 * dW).toFixed(3)}`, 10, h - 10);
    };
    el.querySelectorAll('input').forEach(i => i.oninput = draw);
    draw(); onEnv(cv, draw);
  }

  /* ===== 6. 옵티마이저 경주 ===== */
  function optim(el) {
    const { cv, q } = shell(el, '🏁 옵티마이저 경주', '같은 시작점, 같은 학습률에서 SGD·Momentum·RMSProp·Adam이 길쭉한 골짜기를 내려가는 모습을 비교합니다. 클릭으로 시작점을 바꿀 수 있어요.', 340,
      `<label>학습률 <select data-k="lr"><option>0.01</option><option selected>0.05</option><option>0.1</option><option>0.2</option></select></label>
       <label>지형 <select data-k="s"><option value="val">길쭉한 골짜기</option><option value="ros">로젠브록(바나나)</option><option value="bump">국소 최소점</option></select></label>
       <button class="btn sm" data-k="go">▶ 출발</button><button class="btn sm" data-k="rs">초기화</button>
       <div class="legend">${['SGD', 'Momentum', 'RMSProp', 'Adam'].map((n, i) => `<span><i style="background:${SERIES[i]}"></i>${n}</span>`).join('')}</div>`);
    const S = {
      val: { f: (x, y) => 0.1 * x * x + 2 * y * y, g: (x, y) => [0.2 * x, 4 * y], r: [-4, 4], st: [-3.6, 1.3] },
      ros: { f: (x, y) => (1 - x) ** 2 + 5 * (y - x * x) ** 2, g: (x, y) => [-2 * (1 - x) - 20 * x * (y - x * x), 10 * (y - x * x)], r: [-2, 2], st: [-1.6, 1.6] },
      bump: { f: (x, y) => x * x * .3 + y * y * .3 - 1.2 * Math.exp(-((x - 1.2) ** 2 + (y - 1) ** 2) * 2) - 1.6 * Math.exp(-((x + 1.3) ** 2 + (y + 1.2) ** 2)), g: null, r: [-3, 3], st: [2.6, 2.4] }
    };
    S.bump.g = (x, y) => { const h = 1e-4, f = S.bump.f; return [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)]; };
    let st = null, P0, anim = null, bg = null, bgKey = '';
    const reset = (p) => {
      const s = S[q('[data-k=s]').value]; P0 = p || s.st.slice();
      st = [0, 1, 2, 3].map(() => ({ p: P0.slice(), path: [P0.slice()], v: [0, 0], s: [0, 0], m: [0, 0], t: 0 }));
    };
    const upd = () => {
      const s = S[q('[data-k=s]').value], lr = +q('[data-k=lr]').value;
      st.forEach((o, i) => {
        const g = s.g(o.p[0], o.p[1]); o.t++;
        for (let k = 0; k < 2; k++) {
          if (i === 0) o.p[k] -= lr * g[k];
          if (i === 1) { o.v[k] = 0.9 * o.v[k] + g[k]; o.p[k] -= lr * o.v[k]; }
          if (i === 2) { o.s[k] = 0.9 * o.s[k] + 0.1 * g[k] * g[k]; o.p[k] -= lr * g[k] / (Math.sqrt(o.s[k]) + 1e-8); }
          if (i === 3) { o.m[k] = 0.9 * o.m[k] + 0.1 * g[k]; o.s[k] = 0.999 * o.s[k] + 0.001 * g[k] * g[k]; const mh = o.m[k] / (1 - .9 ** o.t), sh = o.s[k] / (1 - .999 ** o.t); o.p[k] -= lr * 2 * mh / (Math.sqrt(sh) + 1e-8); }
          o.p[k] = Math.max(-50, Math.min(50, o.p[k]));
        }
        o.path.push(o.p.slice());
      });
    };
    const draw = () => {
      const P = PAL(); const { ctx, w, h } = setupCanvas(cv, 340); const s = S[q('[data-k=s]').value];
      const R = s.r[1], asp = h / w;
      const X = a => w / 2 + a / R * w / 2, Y = b => h / 2 - b / (R * asp) * h / 2;
      const key = q('[data-k=s]').value + w + h + P.bg;
      if (bgKey !== key) {
        const img = ctx.createImageData(Math.round(w), Math.round(h)); const vals = []; let mn = 1e9, mx = -1e9;
        for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) { const v = s.f((x - w / 2) / (w / 2) * R, -(y - h / 2) / (h / 2) * R * asp); vals.push(v); mn = Math.min(mn, v); mx = Math.max(mx, v); }
        const dark = getComputedStyle(document.body).backgroundColor.match(/\d+/g).slice(0, 3).reduce((a, b) => a + +b, 0) < 200;
        vals.forEach((v, i) => { const t = Math.pow((v - mn) / (mx - mn), .35); const band = Math.floor(t * 14) % 2 ? 1 : 0; const j = i * 4; const L = dark ? 25 + 40 * t + band * 6 : 245 - 70 * t - band * 8; img.data[j] = L; img.data[j + 1] = L; img.data[j + 2] = L + (dark ? 15 : 8); img.data[j + 3] = 255; });
        bg = img; bgKey = key;
      }
      ctx.putImageData(bg, 0, 0);
      st.forEach((o, i) => {
        ctx.strokeStyle = SERIES[i]; ctx.lineWidth = 2; ctx.beginPath(); o.path.forEach((c, j) => j ? ctx.lineTo(X(c[0]), Y(c[1])) : ctx.moveTo(X(c[0]), Y(c[1]))); ctx.stroke();
        ctx.fillStyle = SERIES[i]; ctx.beginPath(); ctx.arc(X(o.p[0]), Y(o.p[1]), 5, 0, 7); ctx.fill();
      });
      cv._inv = (px, py) => [(px - w / 2) / (w / 2) * R, -(py - h / 2) / (h / 2) * R * asp];
    };
    const stop = () => { if (anim) { anim.on = false; running.delete(anim); anim = null; } q('[data-k=go]').textContent = '▶ 출발'; };
    q('[data-k=go]').onclick = () => { if (anim) return stop(); q('[data-k=go]').textContent = '⏸ 정지'; anim = loop(() => { upd(); draw(); if (st[0].t > 600) stop(); }); };
    q('[data-k=rs]').onclick = () => { stop(); reset(P0); draw(); };
    cv.addEventListener('click', e => { const r = cv.getBoundingClientRect(); stop(); reset(cv._inv(e.clientX - r.left, e.clientY - r.top)); draw(); });
    q('[data-k=s]').onchange = () => { stop(); reset(); draw(); };
    reset(); draw(); onEnv(cv, () => { bgKey = ''; draw(); });
  }

  /* ===== 7. 합성곱 ===== */
  function conv(el) {
    const K = {
      '수직 경계 검출': [[1, 0, -1], [2, 0, -2], [1, 0, -1]],
      '수평 경계 검출': [[1, 2, 1], [0, 0, 0], [-1, -2, -1]],
      '흐림(평균)': [[1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9]],
      '선명하게': [[0, -1, 0], [-1, 5, -1], [0, -1, 0]],
      '항등': [[0, 0, 0], [0, 1, 0], [0, 0, 0]]
    };
    const { cv, q } = shell(el, '🔲 합성곱(Convolution) 직접 보기', '왼쪽 입력 격자를 클릭/드래그해 그림을 그리세요. 3×3 커널이 입력 위를 미끄러지며 곱하고 더한 결과가 오른쪽 특성 맵입니다. 출력 칸에 마우스를 올리면 대응하는 입력 영역이 강조됩니다.', 330,
      `<label>커널 <select data-k="k">${Object.keys(K).map(k => `<option>${k}</option>`).join('')}</select></label>
       <label>패딩 <select data-k="p"><option>0</option><option>1</option></select></label>
       <label>스트라이드 <select data-k="s"><option>1</option><option>2</option></select></label>
       <button class="btn sm" data-k="clr">지우기</button><button class="btn sm" data-k="smp">예시 그림</button><span class="readout" data-k="ro"></span>`);
    const N = 10; let img = Array.from({ length: N }, () => new Array(N).fill(0)), hov = null, paint = null;
    const sample = () => { img = img.map((r, i) => r.map((_, j) => (j >= 3 && j <= 6 && i >= 2 && i <= 7) ? 1 : 0)); img[2][3] = 0; };
    sample();
    let geo = null;
    const draw = () => {
      const P = PAL(); const { ctx, w, h } = setupCanvas(cv, 330);
      const k = K[q('[data-k=k]').value], pd = +q('[data-k=p]').value, s = +q('[data-k=s]').value;
      const M = N + 2 * pd, O = Math.floor((M - 3) / s) + 1;
      const cs = Math.min((w - 120) / (M + O + 3), 30);
      const ix = 10, iy = 20, kx = ix + M * cs + 20, ox = kx + 3 * cs + 30;
      const get = (i, j) => (i < pd || j < pd || i >= N + pd || j >= N + pd) ? 0 : img[i - pd][j - pd];
      const out = []; let mx = 0;
      for (let i = 0; i < O; i++) { out.push([]); for (let j = 0; j < O; j++) { let v = 0; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) v += k[a][b] * get(i * s + a, j * s + b); out[i].push(v); mx = Math.max(mx, Math.abs(v)); } }
      ctx.font = '12px Noto Sans KR, sans-serif'; ctx.fillStyle = P.muted;
      ctx.fillText(`입력 ${N}×${N}${pd ? ' (+패딩)' : ''}`, ix, 13); ctx.fillText('커널 3×3', kx, 13); ctx.fillText(`출력 ${O}×${O}`, ox, 13);
      for (let i = 0; i < M; i++) for (let j = 0; j < M; j++) {
        const pad = i < pd || j < pd || i >= N + pd || j >= N + pd; const v = get(i, j);
        ctx.fillStyle = pad ? P.bg : (v ? P.text : P.surf); ctx.fillRect(ix + j * cs, iy + i * cs, cs - 1, cs - 1);
        if (pad) { ctx.fillStyle = P.muted; ctx.fillText('0', ix + j * cs + cs / 2 - 3, iy + i * cs + cs / 2 + 4); }
      }
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        const v = k[a][b]; ctx.fillStyle = v > 0 ? `rgba(91,91,214,${Math.min(1, Math.abs(v) / 2 + .15)})` : v < 0 ? `rgba(229,72,77,${Math.min(1, Math.abs(v) / 2 + .15)})` : P.bg;
        ctx.fillRect(kx + b * cs, iy + a * cs, cs - 1, cs - 1); ctx.fillStyle = P.text; ctx.font = `${Math.max(9, cs * .36)}px JetBrains Mono, monospace`; ctx.textAlign = 'center';
        ctx.fillText(Math.abs(v) < 1 && v !== 0 ? v.toFixed(2).replace('0.', '.') : v, kx + b * cs + cs / 2, iy + a * cs + cs / 2 + 4); ctx.textAlign = 'left';
      }
      for (let i = 0; i < O; i++) for (let j = 0; j < O; j++) {
        const v = out[i][j] / (mx || 1);
        ctx.fillStyle = v >= 0 ? `rgba(91,91,214,${Math.abs(v)})` : `rgba(229,72,77,${Math.abs(v)})`;
        ctx.fillRect(ox + j * cs, iy + i * cs, cs - 1, cs - 1); ctx.strokeStyle = P.border; ctx.strokeRect(ox + j * cs, iy + i * cs, cs - 1, cs - 1);
      }
      if (hov && hov[0] < O && hov[1] < O) {
        ctx.strokeStyle = '#f5a524'; ctx.lineWidth = 3;
        ctx.strokeRect(ix + hov[1] * s * cs, iy + hov[0] * s * cs, 3 * cs - 1, 3 * cs - 1);
        ctx.strokeRect(ox + hov[1] * cs, iy + hov[0] * cs, cs - 1, cs - 1);
        q('[data-k=ro]').textContent = `출력[${hov[0]},${hov[1]}] = Σ 입력영역 ⊙ 커널 = ${out[hov[0]][hov[1]].toFixed(2)}`;
      } else q('[data-k=ro]').textContent = `출력 크기 = ⌊(${N} + 2·${pd} − 3)/${s}⌋ + 1 = ${O}`;
      geo = { ix, iy, ox, cs, M, O, pd };
    };
    const cell = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointermove', e => {
      const [x, y] = cell(e), g = geo;
      if (paint !== null) { const j = Math.floor((x - g.ix) / g.cs) - g.pd, i = Math.floor((y - g.iy) / g.cs) - g.pd; if (i >= 0 && j >= 0 && i < N && j < N) img[i][j] = paint; }
      const oj = Math.floor((x - g.ox) / g.cs), oi = Math.floor((y - g.iy) / g.cs);
      hov = (oi >= 0 && oj >= 0 && oi < g.O && oj < g.O) ? [oi, oj] : null; draw();
    });
    cv.addEventListener('pointerdown', e => { const [x, y] = cell(e), g = geo; const j = Math.floor((x - g.ix) / g.cs) - g.pd, i = Math.floor((y - g.iy) / g.cs) - g.pd; if (i >= 0 && j >= 0 && i < N && j < N) { paint = img[i][j] ? 0 : 1; img[i][j] = paint; draw(); } });
    window.addEventListener('pointerup', () => paint = null);
    cv.addEventListener('pointerleave', () => { hov = null; draw(); });
    q('[data-k=clr]').onclick = () => { img = img.map(r => r.map(() => 0)); draw(); };
    q('[data-k=smp]').onclick = () => { sample(); draw(); };
    el.querySelectorAll('select').forEach(s => s.onchange = draw);
    draw(); onEnv(cv, draw);
  }

  /* ===== 8. 어텐션 ===== */
  function attention(el) {
    const { cv, q } = shell(el, '🎯 셀프 어텐션 가중치', '각 행은 하나의 토큰(Query)이 다른 토큰(Key)들을 얼마나 참고하는지를 나타냅니다(행의 합 = 1). 온도(=√d 스케일)를 바꾸면 분포가 날카로워지거나 평평해집니다. Causal 마스크는 GPT처럼 미래 토큰을 못 보게 막습니다.', 380,
      `<label>문장 <input data-k="t" value="고양이 가 생선 을 먹었다 그리고 고양이 는 잠들었다" style="width:min(380px,100%);font:inherit;padding:4px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text)"></label>
       <label>온도 τ <input type="range" data-k="tau" min="0.1" max="3" step="0.05" value="1"></label>
       <label><input type="checkbox" data-k="m"> Causal 마스크</label><span class="readout" data-k="ro"></span>`);
    const D = 16;
    const emb = tok => { // 결정적 '가짜 임베딩': 글자 n-gram 해시 → 비슷한 단어는 비슷한 벡터
      const v = new Array(D).fill(0); const s = '#' + tok + '#';
      for (let i = 0; i < s.length - 1; i++) { let hsh = 0; for (const c of s.slice(i, i + 2)) hsh = (hsh * 131 + c.charCodeAt(0)) >>> 0; const r = rng(hsh + 1); for (let d = 0; d < D; d++) v[d] += gauss(r); }
      const n = Math.hypot(...v) || 1; return v.map(x => x / n * 3);
    };
    let hovRow = null;
    const draw = () => {
      const P = PAL(); const { ctx, w, h } = setupCanvas(cv, 380);
      const toks = q('[data-k=t]').value.trim().split(/\s+/).slice(0, 12);
      const tau = +q('[data-k=tau]').value, mask = q('[data-k=m]').checked;
      const E = toks.map(emb), n = toks.length;
      const A = E.map((qv, i) => {
        const s = E.map((kv, j) => (mask && j > i) ? -Infinity : qv.reduce((a, x, d) => a + x * kv[d], 0) / Math.sqrt(D) / tau * 2.2);
        const mx = Math.max(...s); const e = s.map(x => Math.exp(x - mx)); const z = e.reduce((a, b) => a + b, 0); return e.map(x => x / z);
      });
      const lab = 90, cs = Math.min((w - lab - 20) / n, (h - lab - 10) / n);
      ctx.font = '13px Noto Sans KR, sans-serif'; ctx.fillStyle = P.text;
      toks.forEach((t, i) => {
        ctx.textAlign = 'right'; ctx.fillStyle = hovRow === i ? P.accent : P.text; ctx.fillText(t, lab - 8, lab + i * cs + cs / 2 + 4);
        ctx.save(); ctx.translate(lab + i * cs + cs / 2 + 4, lab - 8); ctx.rotate(-Math.PI / 3); ctx.textAlign = 'left'; ctx.fillStyle = P.text; ctx.fillText(t, 0, 0); ctx.restore();
      });
      A.forEach((row, i) => row.forEach((a, j) => {
        ctx.fillStyle = mask && j > i ? P.bg : `rgba(91,91,214,${0.06 + a * 0.94})`;
        ctx.fillRect(lab + j * cs, lab + i * cs, cs - 2, cs - 2);
        if (cs > 30) { ctx.fillStyle = a > .5 ? '#fff' : P.muted; ctx.font = '10px JetBrains Mono, monospace'; ctx.textAlign = 'center'; ctx.fillText(mask && j > i ? '' : a.toFixed(2), lab + j * cs + cs / 2 - 1, lab + i * cs + cs / 2 + 3); }
      }));
      if (hovRow !== null && hovRow < n) { ctx.strokeStyle = '#f5a524'; ctx.lineWidth = 2.5; ctx.strokeRect(lab - 1, lab + hovRow * cs - 1, n * cs, cs); }
      q('[data-k=ro]').textContent = hovRow !== null && hovRow < n ? `"${toks[hovRow]}"가 가장 많이 참고하는 토큰: "${toks[A[hovRow].indexOf(Math.max(...A[hovRow]))]}"` : '행 위에 마우스를 올려 보세요';
      cv._g = { lab, cs, n };
    };
    cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(), g = cv._g; const i = Math.floor((e.clientY - r.top - g.lab) / g.cs); hovRow = i >= 0 && i < g.n ? i : null; draw(); });
    cv.addEventListener('pointerleave', () => { hovRow = null; draw(); });
    el.querySelectorAll('input').forEach(i => i.oninput = draw);
    draw(); onEnv(cv, draw);
  }

  /* ===== 9. 학습률 & 과적합 곡선 (다항 회귀) ===== */
  function overfit(el) {
    const { cv, q } = shell(el, '📉 과적합 실험: 다항식 차수와 규제', '초록 점은 학습 데이터, 회색 점선은 진짜 함수입니다. 차수를 올리면 학습 데이터에는 완벽히 맞지만 진짜 함수에서 멀어집니다(과적합). λ(L2 규제)를 올려 곡선을 진정시켜 보세요.', 300,
      `<label>차수 <input type="range" data-k="d" min="1" max="15" step="1" value="3"><span class="readout" data-v="d"></span></label>
       <label>log₁₀ λ <input type="range" data-k="l" min="-8" max="1" step="0.5" value="-8"><span class="readout" data-v="l"></span></label>
       <label>데이터 수 <select data-k="n"><option>8</option><option selected>15</option><option>40</option></select></label><span class="readout" data-k="ro"></span>`);
    const truth = x => Math.sin(2.5 * x) * .8 + .2 * x;
    const draw = () => {
      const P = PAL(); const { ctx, w, h } = setupCanvas(cv, 300);
      const deg = +q('[data-k=d]').value, lam = Math.pow(10, +q('[data-k=l]').value), n = +q('[data-k=n]').value;
      q('[data-v=d]').textContent = deg; q('[data-v=l]').textContent = lam < 1e-7 ? '0' : lam.toExponential(0);
      const r = rng(11); const X = [], Y = []; for (let i = 0; i < n; i++) { const x = -1 + 2 * r(); X.push(x); Y.push(truth(x) + gauss(r) * .18); }
      const Xt = [], Yt = []; for (let i = 0; i < 200; i++) { const x = -1 + 2 * r(); Xt.push(x); Yt.push(truth(x) + gauss(r) * .18); }
      // 정규방정식 (X^T X + λI) w = X^T y
      const phi = x => Array.from({ length: deg + 1 }, (_, k) => x ** k);
      const F = X.map(phi), m = deg + 1;
      const A = Array.from({ length: m }, (_, i) => Array.from({ length: m }, (_, j) => F.reduce((s, f) => s + f[i] * f[j], 0) + (i === j && i > 0 ? lam * n : 0)));
      const bv = Array.from({ length: m }, (_, i) => F.reduce((s, f, k) => s + f[i] * Y[k], 0));
      // 가우스 소거
      for (let i = 0; i < m; i++) { let p = i; for (let k = i + 1; k < m; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k; [A[i], A[p]] = [A[p], A[i]]; [bv[i], bv[p]] = [bv[p], bv[i]]; const d = A[i][i] || 1e-12; for (let k = i + 1; k < m; k++) { const f = A[k][i] / d; for (let j = i; j < m; j++) A[k][j] -= f * A[i][j]; bv[k] -= f * bv[i]; } }
      const wv = new Array(m).fill(0); for (let i = m - 1; i >= 0; i--) { let s = bv[i]; for (let j = i + 1; j < m; j++) s -= A[i][j] * wv[j]; wv[i] = s / (A[i][i] || 1e-12); }
      const pred = x => phi(x).reduce((s, v, k) => s + v * wv[k], 0);
      const mse = (xs, ys) => xs.reduce((s, x, i) => s + (pred(x) - ys[i]) ** 2, 0) / xs.length;
      const { X: SX, Y: SY } = axes(ctx, w, h, [-1.05, 1.05], [-1.8, 1.8], P);
      plotFn(ctx, truth, [-1, 1], SX, SY, P.muted, 1.5, [5, 5]);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip(); plotFn(ctx, pred, [-1, 1], SX, SY, SERIES[0], 2.5); ctx.restore();
      X.forEach((x, i) => { ctx.fillStyle = SERIES[2]; ctx.beginPath(); ctx.arc(SX(x), SY(Y[i]), 4.5, 0, 7); ctx.fill(); });
      const tr = mse(X, Y), te = mse(Xt, Yt);
      q('[data-k=ro]').innerHTML = `학습 MSE <b>${tr.toFixed(3)}</b> · 검증 MSE <b style="color:${te > tr * 3 && te > .1 ? '#e5484d' : 'inherit'}">${te > 99 ? '>99' : te.toFixed(3)}</b>`;
    };
    el.querySelectorAll('input,select').forEach(i => i.oninput = draw);
    draw(); onEnv(cv, draw);
  }

  const REG = {
    derivative: [derivative, 4], gd: [gd, 6], activation: [activation, 8], playground: [playground, 8], compgraph: [compgraph, 10],
    optim: [optim, 12], overfit: [overfit, 14], conv: [conv, 17], attention: [attention, 22]
  };
  window.VIZ = {
    mount(el) {
      const r = REG[el.dataset.viz];
      if (!r) { el.textContent = '알 수 없는 시각화: ' + el.dataset.viz; return; }
      try { r[0](el); if (window.renderMathInElement) renderMathInElement(el.querySelector('.vd'), { delimiters: [{ left: '$', right: '$', display: false }], throwOnError: false }); }
      catch (e) { console.error(e); el.textContent = '시각화 오류: ' + e.message; }
    },
    stopAll() { running.forEach(o => o.on = false); running.clear(); },
    list: Object.entries(REG).map(([id, [, day]]) => ({ id, day }))
  };
})();
