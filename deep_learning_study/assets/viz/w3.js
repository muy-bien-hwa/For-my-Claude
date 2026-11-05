/* 3주차 시각화: 퍼셉트론, 공간 변환, 활성화 함수, 신경망 놀이터, 형상 추적, 계산 그래프, 역전파 단계 */
(function () {
  'use strict';
  const fmt = V.fmt;
  const sig = z => 1 / (1 + Math.exp(-z));
  const rrect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  const text = (ctx, s, x, y, o = {}) => {
    const pal = V.pal();
    ctx.font = o.font || (o.bold ? V.FONT_B : V.FONT); ctx.fillStyle = o.color || pal.text;
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.base || 'middle'; ctx.fillText(s, x, y); ctx.textBaseline = 'alphabetic';
  };

  /* ===== 1. 퍼셉트론 학습 규칙과 XOR ===== */
  V.register('perceptron', el => {
    const ui = V.shell(el, {
      title: '퍼셉트론 학습 규칙: 선형 분리와 XOR',
      desc: '점을 차례로 보며 틀린 점을 만나면 $\\mathbf w \\leftarrow \\mathbf w + \\eta\\,y\\,\\mathbf x$, $b \\leftarrow b + \\eta\\,y$로 고친다(레이블 $y = \\pm1$). 오른쪽은 에폭(데이터 한 바퀴)마다 틀린 점의 수다.',
      how: ['파랑: $y = +1$, 빨강: $y = -1$. 배경색은 현재 퍼셉트론의 판정이다.', '검은 직선: 결정 경계 $\\mathbf w\\cdot\\mathbf x + b = 0$. 화살표: $\\mathbf w$ (경계에 수직, $+1$로 판정하는 쪽).', '원으로 둘러싼 점: 현재 틀린 점. 굵은 원: 방금 갱신에 쓰인 점.'],
      try: ['AND와 OR에서 "실행"을 눌러 몇 에폭 만에 틀린 점이 0이 되는지 본다.', 'XOR에서는 틀린 점의 수가 0이 되지 않고 계속 흔들린다. 직선 하나로는 XOR을 가를 수 없기 때문이다.', '학습률 η를 바꿔도 선형 분리 가능한 데이터에서는 결국 멈춘다. 왜 그런지 생각해 본다(η는 w의 크기만 바꾼다).']
    });
    const row = ui.row(2);
    const c1 = ui.canvas(ui.panel(row, '입력 공간과 결정 경계'), 0, { aspect: .9, maxH: 400 });
    const c2 = ui.canvas(ui.panel(row, '에폭별 틀린 점의 수'), 0, { aspect: .9, maxH: 400 });
    const corners = [[0, 0], [0, 1], [1, 0], [1, 1]];
    const LAB = { and: (a, b) => a && b, or: (a, b) => a || b, xor: (a, b) => a !== b };
    function make(kind) {
      const r = V.rng(7), pts = [];
      if (kind === 'blobs') { for (let i = 0; i < 30; i++) { const c = i % 2 ? 1 : -1; pts.push([(c > 0 ? 1.0 : 0.1) + V.gauss(r) * .16, (c > 0 ? 0.9 : 0.2) + V.gauss(r) * .16, c]); } return pts; }
      corners.forEach(([a, b]) => { for (let k = 0; k < 5; k++) pts.push([a + V.gauss(r) * .07, b + V.gauss(r) * .07, LAB[kind](a, b) ? 1 : -1]); });
      // 점 순서를 섞어 둔다 (같은 꼭짓점이 연달아 나오지 않게)
      for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
      return pts;
    }
    let kind = 'and', pts = make(kind), w = [0, 0], b = 0, eta = .5, p = 0, errs = 0, hist = [], epoch = 0, updates = 0, last = -1, done = false, anim = null;
    const score = q => w[0] * q[0] + w[1] * q[1] + b;
    function step() {                       // 갱신 한 번 또는 에폭 끝까지
      if (done) return 'done';
      while (p < pts.length) {
        const i = p++, q = pts[i];
        if (q[2] * score(q) <= 0) { w = [w[0] + eta * q[2] * q[0], w[1] + eta * q[2] * q[1]]; b += eta * q[2]; errs++; updates++; last = i; return 'update'; }
      }
      hist.push(errs); epoch++;
      if (errs === 0) { done = true; stop(); return 'done'; }
      p = 0; errs = 0; return 'epoch';
    }
    ui.select({ label: '데이터', options: [['and', 'AND'], ['or', 'OR'], ['blobs', '두 무리'], ['xor', 'XOR']], value: kind, onChange: v => { kind = v; pts = make(v); reset(); } });
    ui.slider({ label: '학습률 η', min: .1, max: 1, step: .1, value: eta, fmt: v => v.toFixed(1), onInput: v => { eta = v; } });
    ui.button({ label: '한 번 갱신', onClick: () => { stop(); let s; do { s = step(); } while (s === 'epoch'); draw(); } });
    const bRun = ui.button({ label: '실행', primary: true, onClick: () => { if (anim) return stop(); if (done) reset(); bRun.setLabel('정지'); let t = 0; anim = V.loop(() => { if (++t % 10) return; const s = step(); draw(); if (s === 'done' || epoch >= 40) { stop(); return false; } }); } });
    ui.button({ label: '초기화', onClick: reset });
    function stop() { if (anim) { anim.stop(); anim = null; } bRun.setLabel('실행'); }
    function reset() { stop(); w = [0, 0]; b = 0; p = 0; errs = 0; hist = []; epoch = 0; updates = 0; last = -1; done = false; draw(); }
    function draw() {
      const pal = V.pal(); c1.size(); c2.size();
      const P = V.plot(c1, { x: [-.5, 1.5], y: [-.5, 1.5], equal: true, xlabel: 'x₁', ylabel: 'x₂' });
      const ctx = P.ctx, st = 6;
      if (w[0] || w[1] || b) for (let py = P.box.y0; py < P.box.y1; py += st) for (let px = P.box.x0; px < P.box.x1; px += st) { ctx.fillStyle = V.rgba(score([P.ix(px + 3), P.iy(py + 3)]) > 0 ? pal.series[0] : pal.series[1], .12); ctx.fillRect(px, py, st, st); }
      P.axes({ xstep: .5, ystep: .5 });
      P.clip();
      if (Math.hypot(w[0], w[1]) > 1e-9) {
        const n = Math.hypot(w[0], w[1]), x0 = -w[0] * b / (n * n), y0 = -w[1] * b / (n * n), dx = -w[1] / n, dy = w[0] / n;
        P.line([[x0 - dx * 5, y0 - dy * 5], [x0 + dx * 5, y0 + dy * 5]], pal.text, 2.4);
        const cx = V.clamp(x0, -.3, 1.3), cy = V.clamp(y0, -.3, 1.3), t0 = (cx - x0) * dx + (cy - y0) * dy, ax = x0 + dx * t0, ay = y0 + dy * t0;
        P.arrow(ax, ay, ax + w[0] / n * .35, ay + w[1] / n * .35, pal.accent, 2.4, 9);
      }
      P.unclip();
      pts.forEach((q, i) => {
        P.dot(q[0], q[1], 5, q[2] > 0 ? pal.series[0] : pal.series[1], pal.surface);
        if (q[2] * score(q) <= 0 && (w[0] || w[1] || b)) { ctx.beginPath(); ctx.arc(P.X(q[0]), P.Y(q[1]), 9, 0, 7); ctx.strokeStyle = pal.text2; ctx.lineWidth = 1.2; ctx.stroke(); }
        if (i === last) { ctx.beginPath(); ctx.arc(P.X(q[0]), P.Y(q[1]), 12, 0, 7); ctx.strokeStyle = pal.warn; ctx.lineWidth = 2.6; ctx.stroke(); }
      });
      const nE = Math.max(10, hist.length + 1);
      const Q = V.plot(c2, { x: [0, nE], y: [0, Math.max(4, ...hist, 1) + 1], xlabel: '에폭', ylabel: '틀린 점의 수' }).axes({ zero: false, xstep: nE > 20 ? 5 : 2 });
      hist.forEach((v, i) => { const x0 = Q.X(i + .15), x1 = Q.X(i + .85); Q.ctx.fillStyle = v ? pal.series[1] : pal.ok; Q.ctx.fillRect(x0, Q.Y(v), x1 - x0, Q.Y(0) - Q.Y(v)); });
      const wrong = pts.filter(q => q[2] * score(q) <= 0).length;
      ui.setRO(`에폭 ${epoch}   갱신 ${updates}회   w = (${fmt(w[0], 2)}, ${fmt(w[1], 2)}), b = ${fmt(b, 2)}   현재 틀린 점 ${wrong}개${done ? '   → 수렴 (한 에폭 동안 틀린 점 없음)' : ''}`);
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 2. 은닉층이 공간을 바꾸는 방식 ===== */
  V.register('space-warp', el => {
    const ui = V.shell(el, {
      title: '은닉층이 공간을 바꾸는 방식',
      desc: '은닉 뉴런 2개짜리 신경망 $\\mathbf h = \\tanh(W\\mathbf x + \\mathbf b)$, $p = \\sigma(\\mathbf v\\cdot\\mathbf h + c)$를 학습시키며, 입력 공간(왼쪽)이 은닉 공간(오른쪽)으로 어떻게 옮겨지는지 본다. 은닉 공간에서는 출력층의 직선 하나가 두 클래스를 가른다.',
      how: ['왼쪽: 입력 공간. 배경은 신경망의 확률, 굵은 선은 결정 경계 $p = 0.5$.', '오른쪽: 같은 점과 격자를 "변환 단계"만큼 옮긴 모습. 0은 입력 그대로, 1은 선형 변환 $W\\mathbf x + \\mathbf b$, 2는 tanh까지 통과한 은닉 표현 $\\mathbf h$.', '단계 2의 검은 직선: 출력층의 경계 $\\mathbf v\\cdot\\mathbf h + c = 0$. 직선 경계가 입력 공간에서는 곡선이 된다.'],
      try: ['"구불구불한 두 곡선"을 학습시킨 뒤 변환 단계를 0 → 1 → 2로 천천히 움직인다. 선형 변환은 격자를 기울이고 늘이기만 하고, tanh가 공간을 휘어 두 곡선을 직선으로 가를 수 있게 만든다.', 'XOR도 같은 방식으로 풀린다. 단계 1에서는 아직 직선으로 가를 수 없음을 확인한다.', '"원"은 은닉 뉴런 2개로는 끝까지 풀리지 않는다. 평면을 접고 휘기만 해서는 안쪽 원을 바깥 원에서 떼어 낼 수 없기 때문이다. 놀이터(아래)에서 뉴런을 3개로 늘리면 풀린다.']
    });
    const row = ui.row(2);
    const c1 = ui.canvas(ui.panel(row, '입력 공간'), 0, { aspect: .9, maxH: 400 });
    const c2 = ui.canvas(ui.panel(row, '변환된 공간'), 0, { aspect: .9, maxH: 400 });
    function make(kind) {
      const r = V.rng(3), P = [];
      for (let i = 0; i < 160; i++) {
        const c = i % 2;
        if (kind === 'xor') { const q = Math.floor(r() * 2), sx = q ? 1 : -1, sy = (c ? -1 : 1) * sx; P.push([sx * (.5 + r() * .9), sy * (.5 + r() * .9), c]); }
        else if (kind === 'circle') { const rad = c ? 1.3 + r() * .5 : r() * .8, t = r() * 6.283; P.push([rad * Math.cos(t), rad * Math.sin(t), c]); }
        else { const x = -2 + 4 * r(); P.push([x, .6 * Math.sin(1.6 * x) + (c ? .45 : -.45) + V.gauss(r) * .07, c]); }
      }
      return P;
    }
    let kind = 'curves', pts = make(kind), th, mo, ve, tstep, stage = 0, anim = null, loss = NaN, acc = NaN;
    function init() { const r = V.rng(1); th = [V.gauss(r), V.gauss(r), V.gauss(r), V.gauss(r), 0, 0, V.gauss(r) * .5, V.gauss(r) * .5, 0]; mo = th.map(() => 0); ve = th.map(() => 0); tstep = 0; evalAll(); }
    // th = [W00, W01, W10, W11, b0, b1, v0, v1, c]; z_j = W0j x + W1j y + b_j
    const hid = (x, y) => [th[0] * x + th[2] * y + th[4], th[1] * x + th[3] * y + th[5]];
    const out = (x, y) => { const z = hid(x, y); return sig(th[6] * Math.tanh(z[0]) + th[7] * Math.tanh(z[1]) + th[8]); };
    function evalAll() { let L = 0, A = 0; pts.forEach(([x, y, c]) => { const p = out(x, y); L += -(c * Math.log(p + 1e-12) + (1 - c) * Math.log(1 - p + 1e-12)); A += (p > .5) === (c === 1); }); loss = L / pts.length; acc = A / pts.length; }
    function trainStep() {
      const g = th.map(() => 0);
      pts.forEach(([x, y, c]) => {
        const z = hid(x, y), h0 = Math.tanh(z[0]), h1 = Math.tanh(z[1]), p = sig(th[6] * h0 + th[7] * h1 + th[8]), d = p - c;
        const d0 = d * th[6] * (1 - h0 * h0), d1 = d * th[7] * (1 - h1 * h1);
        g[0] += d0 * x; g[1] += d1 * x; g[2] += d0 * y; g[3] += d1 * y; g[4] += d0; g[5] += d1; g[6] += d * h0; g[7] += d * h1; g[8] += d;
      });
      tstep++;
      // 작은 가중치 감쇠(3e-4)로 tanh가 지나치게 포화되지 않게 한다
      for (let k = 0; k < 9; k++) { const gk = g[k] / pts.length + (k < 4 || k === 6 || k === 7 ? 3e-4 * th[k] : 0); mo[k] = .9 * mo[k] + .1 * gk; ve[k] = .999 * ve[k] + .001 * gk * gk; th[k] -= .02 * (mo[k] / (1 - .9 ** tstep)) / (Math.sqrt(ve[k] / (1 - .999 ** tstep)) + 1e-8); }
    }
    const warp = (x, y) => {                 // 변환 단계에 따른 위치
      const z = hid(x, y);
      if (stage <= 1) return [(1 - stage) * x + stage * z[0], (1 - stage) * y + stage * z[1]];
      const u = stage - 1; return [(1 - u) * z[0] + u * Math.tanh(z[0]), (1 - u) * z[1] + u * Math.tanh(z[1])];
    };
    ui.select({ label: '데이터', options: [['curves', '구불구불한 두 곡선'], ['xor', 'XOR'], ['circle', '원 (은닉 2개로는 불가능)']], value: kind, onChange: v => { kind = v; pts = make(v); reset(); } });
    const sStage = ui.slider({ label: '변환 단계', min: 0, max: 2, step: .02, value: stage, fmt: v => v < .01 ? '0 입력' : v < .99 ? v.toFixed(2) : v < 1.01 ? '1 선형' : v < 1.99 ? v.toFixed(2) : '2 tanh', onInput: v => { stage = v; draw(); } });
    const bRun = ui.button({ label: '학습', primary: true, onClick: () => { if (anim) return stop(); bRun.setLabel('정지'); anim = V.loop(() => { for (let i = 0; i < 8; i++) trainStep(); evalAll(); draw(); if (tstep >= 3000) { stop(); return false; } }); } });
    ui.button({ label: '초기화', onClick: reset });
    ui.button({ label: '단계 0 → 2 재생', onClick: () => { stage = 0; let t0 = null; V.loop(t => { if (t0 === null) t0 = t; stage = Math.min(2, (t - t0) / 1500); sStage.value = stage; draw(); return stage < 2; }); } });
    function stop() { if (anim) { anim.stop(); anim = null; } bRun.setLabel('학습'); }
    function reset() { stop(); init(); draw(); }
    function draw() {
      const pal = V.pal(); c1.size(); c2.size();
      const P = V.plot(c1, { x: [-2.4, 2.4], y: [-2.4, 2.4], equal: true, xlabel: 'x₁', ylabel: 'x₂' });
      const ctx = P.ctx, st = 6;
      for (let py = P.box.y0; py < P.box.y1; py += st) for (let px = P.box.x0; px < P.box.x1; px += st) { ctx.fillStyle = V.cmapCss('prob', out(P.ix(px + 3), P.iy(py + 3)), .45); ctx.fillRect(px, py, st, st); }
      P.axes({ zero: false });
      P.clip();
      ctx.strokeStyle = pal.text; ctx.lineWidth = 2.4; ctx.beginPath();
      V.iso((x, y) => { const z = hid(x, y); return th[6] * Math.tanh(z[0]) + th[7] * Math.tanh(z[1]) + th[8]; }, P.xr, P.yr, 0, 90, 90).forEach(([a, c]) => { ctx.moveTo(P.X(a[0]), P.Y(a[1])); ctx.lineTo(P.X(c[0]), P.Y(c[1])); });
      ctx.stroke();
      // 격자
      ctx.strokeStyle = V.rgba(pal.text2.startsWith('#') ? pal.text2 : '#666666', .35); ctx.lineWidth = 1;
      for (let k = -2; k <= 2; k += .5) { ctx.beginPath(); ctx.moveTo(P.X(k), P.Y(-2.4)); ctx.lineTo(P.X(k), P.Y(2.4)); ctx.moveTo(P.X(-2.4), P.Y(k)); ctx.lineTo(P.X(2.4), P.Y(k)); ctx.stroke(); }
      P.unclip();
      pts.forEach(([x, y, c]) => P.dot(x, y, 3.6, c ? pal.series[0] : pal.series[1], pal.surface));
      // 변환된 공간
      const W = pts.map(([x, y]) => warp(x, y));
      let m = 1.2; W.forEach(([a, b2]) => { m = Math.max(m, Math.abs(a), Math.abs(b2)); });
      m = Math.min(m * 1.12, 40);
      const Q = V.plot(c2, { x: [-m, m], y: [-m, m], equal: true, xlabel: stage < 1 ? '좌표 1' : stage < 2 ? 'z₁ 쪽' : 'h₁ = tanh(z₁)', ylabel: stage < 1 ? '좌표 2' : stage < 2 ? 'z₂ 쪽' : 'h₂ = tanh(z₂)' }).axes({ zero: true });
      const qc = Q.ctx; Q.clip();
      qc.lineWidth = 1;
      for (let k = -2; k <= 2.001; k += .5) {
        [[0, k], [1, k]].forEach(([dir, val]) => {
          qc.strokeStyle = V.rgba(pal.text2.startsWith('#') ? pal.text2 : '#666666', Math.abs(val) < 1e-9 ? .7 : .3); qc.beginPath();
          for (let i = 0; i <= 60; i++) { const s = -2.4 + 4.8 * i / 60, [a, b2] = dir ? warp(s, val) : warp(val, s); i ? qc.lineTo(Q.X(a), Q.Y(b2)) : qc.moveTo(Q.X(a), Q.Y(b2)); }
          qc.stroke();
        });
      }
      if (stage > 1.98) {                  // 출력층의 직선 경계
        const v0 = th[6], v1 = th[7], c0 = th[8];
        if (Math.abs(v1) > 1e-6 || Math.abs(v0) > 1e-6) {
          const seg = Math.abs(v1) > Math.abs(v0) ? [[-m, (-c0 - v0 * -m) / v1], [m, (-c0 - v0 * m) / v1]] : [[(-c0 - v1 * -m) / v0, -m], [(-c0 - v1 * m) / v0, m]];
          Q.line(seg, pal.text, 2.6);
        }
      }
      Q.unclip();
      pts.forEach(([, , c], i) => Q.dot(W[i][0], W[i][1], 3.6, c ? pal.series[0] : pal.series[1], pal.surface));
      const name = stage < .01 ? '입력 그대로' : stage < .99 ? '입력 → 선형 변환 중' : stage < 1.01 ? '선형 변환 Wx + b' : stage < 1.99 ? '선형 → tanh 통과 중' : '은닉 표현 h = tanh(Wx + b)';
      ui.setRO(`학습 스텝 ${tstep}   손실 ${fmt(loss, 4)}   정확도 ${(acc * 100).toFixed(1)}%   오른쪽: ${name}`);
    }
    init(); draw(); V.onEnv(el, draw);
  });

  /* ===== 3. 활성화 함수와 도함수 ===== */
  const ACT = {
    step: { name: '계단', f: x => x > 0 ? 1 : 0, d: x => 0 },
    sigmoid: { name: '시그모이드', f: sig, d: x => sig(x) * (1 - sig(x)) },
    tanh: { name: 'tanh', f: Math.tanh, d: x => 1 - Math.tanh(x) ** 2 },
    relu: { name: 'ReLU', f: x => Math.max(0, x), d: x => x > 0 ? 1 : 0 },
    leaky: { name: 'Leaky ReLU (α=0.1)', f: x => x > 0 ? x : .1 * x, d: x => x > 0 ? 1 : .1 },
    gelu: { name: 'GELU', f: x => .5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + .044715 * x ** 3))), d: null },
    silu: { name: 'SiLU', f: x => x * sig(x), d: x => sig(x) * (1 + x * (1 - sig(x))) }
  };
  ACT.gelu.d = x => (ACT.gelu.f(x + 1e-4) - ACT.gelu.f(x - 1e-4)) / 2e-4;
  V.register('activation', el => {
    const ui = V.shell(el, {
      title: '활성화 함수와 도함수',
      desc: '왼쪽은 활성화 함수 $\\phi(z)$, 오른쪽은 도함수 $\\phi\'(z)$다. 역전파에서 기울기는 층을 지날 때마다 $\\phi\'(z)$가 곱해진다. 그래프 위에서 마우스를 움직이면 그 점의 값과 기울기(접선)를 보여 준다.',
      how: ['굵은 선: 강조한 함수. 가는 선: 비교용으로 켠 함수들.', '오른쪽 회색 점선 0.25: 시그모이드 도함수의 최댓값.', '왼쪽 검은 점선: 현재 점에서의 접선. 그 기울기가 오른쪽 그래프의 값이다.'],
      try: ['시그모이드의 도함수가 $|z| &gt; 5$에서 거의 0임을 확인한다. 이런 "포화" 구간에서는 기울기가 사라진다.', 'ReLU는 양수 구간에서 도함수가 정확히 1이다. 깊은 망에서 기울기가 줄지 않는 이유다. 대신 음수 구간은 0이다(죽은 ReLU).', 'GELU와 SiLU는 ReLU를 매끄럽게 만든 모양이며, 음수 쪽에 작은 골이 있다. 트랜스포머(44일차)가 주로 쓴다.']
    });
    const row = ui.row(2);
    const c1 = ui.canvas(ui.panel(row, '활성화 함수 φ(z)'), 0, { aspect: .78, maxH: 360 });
    const c2 = ui.canvas(ui.panel(row, '도함수 φ′(z)'), 0, { aspect: .78, maxH: 360 });
    let hl = 'sigmoid', shown = new Set(['sigmoid', 'tanh', 'relu']), hx = 1.0;
    const leg = document.createElement('div'); leg.className = 'legend'; ui.body.appendChild(leg);
    ui.select({ label: '강조', options: Object.entries(ACT).map(([k, v]) => [k, v.name]), value: hl, onChange: v => { hl = v; shown.add(v); toggles[v].value = true; draw(); } });
    const toggles = {};
    Object.entries(ACT).forEach(([k, v]) => { toggles[k] = ui.toggle({ label: v.name, value: shown.has(k), onChange: on => { on ? shown.add(k) : shown.delete(k); draw(); } }); });
    let P1, P2;
    [c1, c2].forEach(cv => cv.drag({ hover: x => { const P = cv === c1 ? P1 : P2; if (x === null || !P) return; hx = V.clamp(P.ix(x), -5, 5); draw(); }, down: x => { const P = cv === c1 ? P1 : P2; hx = V.clamp(P.ix(x), -5, 5); draw(); }, move: x => { const P = cv === c1 ? P1 : P2; hx = V.clamp(P.ix(x), -5, 5); draw(); } }));
    function draw() {
      const pal = V.pal(); c1.size(); c2.size();
      const keys = Object.keys(ACT), CI = { sigmoid: 1, tanh: 2, relu: 0, leaky: 4, gelu: 5, silu: 3 };
      const col = k => k === 'step' ? pal.muted : pal.series[CI[k]];
      leg.innerHTML = keys.filter(k => shown.has(k)).map(k => `<span><i style="background:${col(k)}"></i>${ACT[k].name}${k === hl ? ' (강조)' : ''}</span>`).join('') + `<span><i class="dash" style="--c:${pal.text}"></i>접선</span>`;
      P1 = V.plot(c1, { x: [-5, 5], y: [-1.5, 3], xlabel: 'z', ylabel: 'φ(z)' }).axes();
      P2 = V.plot(c2, { x: [-5, 5], y: [-.25, 1.25], xlabel: 'z', ylabel: 'φ′(z)' }).axes();
      P2.line([[-5, .25], [5, .25]], pal.muted, 1, [4, 4]);
      P1.clip(); P2.clip();
      keys.filter(k => shown.has(k) && k !== hl).forEach(k => { P1.fn(ACT[k].f, V.rgba(col(k), .55), 1.6); P2.fn(ACT[k].d, V.rgba(col(k), .55), 1.6); });
      P1.fn(ACT[hl].f, col(hl), 3); P2.fn(ACT[hl].d, col(hl), 3);
      const fy = ACT[hl].f(hx), dy = ACT[hl].d(hx);
      P1.line([[hx - .9, fy - .9 * dy], [hx + .9, fy + .9 * dy]], pal.text, 1.8, [6, 4]);
      P1.line([[hx, -1.5], [hx, 3]], pal.muted, 1, [3, 3]); P2.line([[hx, -.25], [hx, 1.25]], pal.muted, 1, [3, 3]);
      P1.unclip(); P2.unclip();
      P1.dot(hx, fy, 5, col(hl), pal.surface); P2.dot(hx, dy, 5, col(hl), pal.surface);
      ui.setRO(`${ACT[hl].name}:  z = ${hx.toFixed(2)}   φ(z) = ${fmt(fy, 4)}   φ′(z) = ${fmt(dy, 4)}`);
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 4. 신경망 놀이터 ===== */
  V.register('playground', el => {
    const ui = V.shell(el, {
      title: '신경망 놀이터: 은닉층과 결정 경계',
      desc: '입력은 좌표 $(x_1, x_2)$ 두 개뿐이다. 은닉층의 수와 뉴런 수, 활성화 함수를 바꿔 가며 학습시키면 신경망이 어떤 결정 경계를 만드는지 본다. 아래 작은 그림들은 첫 번째 은닉층 각 뉴런의 출력이다.',
      how: ['배경: 출력 확률(파랑 = 클래스 1). 점: 학습 데이터.', '오른쪽 위: 에폭에 따른 학습 손실(BCE).', '아래 작은 지도: 첫 은닉층 뉴런 하나하나가 입력 공간에서 어디에 반응하는지(빨강 음수, 파랑 양수). 각 뉴런은 직선 하나를 기준으로 반응이 바뀐다. 출력층은 이 반응들을 조합한다.', '옵티마이저는 22일차에 배울 Adam이다. 학습 원리는 경사하강법과 같다.'],
      try: ['"원" 데이터: 은닉층 0개(로지스틱 회귀)로는 풀리지 않는다. 은닉층 1개, 뉴런 2개 → 3개 → 4개로 늘려 가며 언제 풀리는지 찾는다.', '"나선": 은닉층 1개로는 어렵다. 은닉층 2~3개, 뉴런 8개로 학습시킨다.', '활성화를 "없음(선형)"으로 바꾸면 은닉층을 아무리 쌓아도 경계가 직선뿐이다. 선형 함수의 합성은 선형이기 때문이다.']
    });
    const row = ui.row(2);
    const c1 = ui.canvas(ui.panel(row, '결정 경계'), 0, { aspect: .95, maxH: 400 });
    const pR = ui.panel(row, '학습 손실');
    const c2 = ui.canvas(pR, 0, { aspect: .55, maxH: 220 });
    const thumbLab = document.createElement('div'); thumbLab.className = 'vlab'; thumbLab.style.marginTop = '10px'; thumbLab.textContent = '첫 은닉층 뉴런들의 출력'; pR.appendChild(thumbLab);
    const thumbs = document.createElement('div'); thumbs.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px'; pR.appendChild(thumbs);
    function make(kind) {
      const r = V.rng(5), P = [];
      for (let i = 0; i < 200; i++) {
        const c = i % 2;
        if (kind === 'circle') { const rad = c ? r() * 1.0 : 1.6 + r() * .7, t = r() * 6.283; P.push([rad * Math.cos(t), rad * Math.sin(t), c]); }
        else if (kind === 'xor') { let x = (r() * 2 - 1) * 2.2, y = (r() * 2 - 1) * 2.2; x += x > 0 ? .15 : -.15; y += y > 0 ? .15 : -.15; P.push([x, y, (x * y > 0) ? 1 : 0]); }
        else if (kind === 'gauss') { P.push([(c ? 1 : -1) + V.gauss(r) * .7, (c ? 1 : -1) + V.gauss(r) * .7, c]); }
        else if (kind === 'moons') { const t = r() * Math.PI; const x = c ? 1 - Math.cos(t) : Math.cos(t), y = c ? .5 - Math.sin(t) : Math.sin(t); P.push([(x - .5) * 2 + V.gauss(r) * .12, (y - .25) * 2 + V.gauss(r) * .12, c]); }
        else { const k = Math.floor(i / 2), t = k / 100 * 3.2 * Math.PI, rad = .25 + k / 100 * 2.1, s = c ? Math.PI : 0; P.push([rad * Math.cos(t + s) + V.gauss(r) * .06, rad * Math.sin(t + s) + V.gauss(r) * .06, c]); }
      }
      return P;
    }
    const ACTS = { tanh: [Math.tanh, a => 1 - a * a], relu: [z => z > 0 ? z : 0, a => a > 0 ? 1 : 0], sigmoid: [sig, a => a * (1 - a)], linear: [z => z, () => 1] };
    let kind = 'circle', pts = make(kind), nL = 1, nH = 4, act = 'tanh', lr = .03, net, adam, anim = null, epoch = 0, losses = [];
    function init() {
      const r = V.rng(11), sizes = [2, ...Array(nL).fill(nH), 1];
      net = sizes.slice(1).map((o, l) => { const i = sizes[l], s = Math.sqrt((act === 'relu' ? 2 : 1) / i); return { W: Array.from({ length: i }, () => Array.from({ length: o }, () => V.gauss(r) * s)), b: Array(o).fill(0) }; });
      adam = net.map(L => ({ mW: L.W.map(r2 => r2.map(() => 0)), vW: L.W.map(r2 => r2.map(() => 0)), mb: L.b.map(() => 0), vb: L.b.map(() => 0) }));
      epoch = 0; losses = []; buildThumbs();
    }
    function forward(x) {                   // 모든 층의 활성값을 반환
      const A = [x];
      net.forEach((L, l) => {
        const a = A[l], z = L.b.slice();
        for (let i = 0; i < a.length; i++) for (let j = 0; j < z.length; j++) z[j] += a[i] * L.W[i][j];
        A.push(l === net.length - 1 ? [sig(z[0])] : z.map(ACTS[act][0]));
      });
      return A;
    }
    let t = 0;
    function trainEpoch() {
      const r = V.rng(100 + epoch), order = pts.map((_, i) => i).sort(() => r() - .5);
      for (let s = 0; s < order.length; s += 20) {
        const G = net.map(L => ({ W: L.W.map(r2 => r2.map(() => 0)), b: L.b.map(() => 0) }));
        const batch = order.slice(s, s + 20);
        batch.forEach(i => {
          const [x, y, c] = pts[i], A = forward([x, y]);
          let d = [A[A.length - 1][0] - c];
          for (let l = net.length - 1; l >= 0; l--) {
            const a = A[l], L = net[l];
            for (let k = 0; k < a.length; k++) for (let j = 0; j < d.length; j++) G[l].W[k][j] += a[k] * d[j];
            for (let j = 0; j < d.length; j++) G[l].b[j] += d[j];
            if (l > 0) { const nd = a.map((ak, k) => { let s2 = 0; for (let j = 0; j < d.length; j++) s2 += L.W[k][j] * d[j]; return s2 * ACTS[act][1](ak); }); d = nd; }
          }
        });
        t++;
        const upd = (p, g, m, v) => { const gk = g / batch.length; const m2 = .9 * m + .1 * gk, v2 = .999 * v + .001 * gk * gk; return [p - lr * (m2 / (1 - .9 ** t)) / (Math.sqrt(v2 / (1 - .999 ** t)) + 1e-8), m2, v2]; };
        net.forEach((L, l) => {
          const S = adam[l];
          for (let i = 0; i < L.W.length; i++) for (let j = 0; j < L.W[i].length; j++) [L.W[i][j], S.mW[i][j], S.vW[i][j]] = upd(L.W[i][j], G[l].W[i][j], S.mW[i][j], S.vW[i][j]);
          for (let j = 0; j < L.b.length; j++) [L.b[j], S.mb[j], S.vb[j]] = upd(L.b[j], G[l].b[j], S.mb[j], S.vb[j]);
        });
      }
      epoch++;
      let loss = 0; pts.forEach(([x, y, c]) => { const p = forward([x, y]).pop()[0]; loss += -(c * Math.log(p + 1e-12) + (1 - c) * Math.log(1 - p + 1e-12)); });
      losses.push(loss / pts.length);
    }
    let tcv = [];
    function buildThumbs() {
      thumbs.innerHTML = ''; tcv = [];
      if (nL === 0) { thumbLab.style.display = 'none'; return; }
      thumbLab.style.display = '';
      for (let j = 0; j < nH; j++) { const c = document.createElement('canvas'); c.width = 40; c.height = 40; c.style.cssText = 'width:100%;aspect-ratio:1;border-radius:4px;border:1px solid var(--border);image-rendering:pixelated'; thumbs.appendChild(c); tcv.push(c); }
    }
    ui.select({ label: '데이터', options: [['circle', '원'], ['xor', 'XOR'], ['gauss', '두 무리'], ['moons', '두 개의 달'], ['spiral', '나선']], value: kind, onChange: v => { kind = v; pts = make(v); reset(); } });
    ui.select({ label: '은닉층 수', options: [[0, '0 (로지스틱 회귀)'], [1, '1'], [2, '2'], [3, '3']], value: nL, onChange: v => { nL = +v; reset(); } });
    ui.slider({ label: '층당 뉴런', min: 1, max: 8, step: 1, value: nH, fmt: v => String(v), onInput: v => { nH = v; reset(); } });
    ui.select({ label: '활성화', options: [['tanh', 'tanh'], ['relu', 'ReLU'], ['sigmoid', '시그모이드'], ['linear', '없음 (선형)']], value: act, onChange: v => { act = v; reset(); } });
    ui.select({ label: '학습률', options: [[.003, '0.003'], [.01, '0.01'], [.03, '0.03'], [.1, '0.1']], value: lr, onChange: v => { lr = +v; } });
    const bRun = ui.button({ label: '학습', primary: true, onClick: () => { if (anim) return stop(); bRun.setLabel('정지'); anim = V.loop(() => { trainEpoch(); trainEpoch(); draw(); if (epoch >= 1000) { stop(); return false; } }); } });
    ui.button({ label: '초기화', onClick: reset });
    function stop() { if (anim) { anim.stop(); anim = null; } bRun.setLabel('학습'); }
    function reset() { stop(); t = 0; init(); draw(); }
    function draw() {
      const pal = V.pal(); c1.size(); c2.size();
      const P = V.plot(c1, { x: [-3, 3], y: [-3, 3], equal: true, xlabel: 'x₁', ylabel: 'x₂' });
      const ctx = P.ctx, st = 6;
      for (let py = P.box.y0; py < P.box.y1; py += st) for (let px = P.box.x0; px < P.box.x1; px += st) { ctx.fillStyle = V.cmapCss('prob', forward([P.ix(px + 3), P.iy(py + 3)]).pop()[0], .5); ctx.fillRect(px, py, st, st); }
      P.axes({ zero: false });
      pts.forEach(([x, y, c]) => P.dot(x, y, 3.4, c ? pal.series[0] : pal.series[1], pal.surface));
      const n = Math.max(50, losses.length);
      const Q = V.plot(c2, { x: [0, n], y: [0, Math.max(.8, ...losses.slice(0, 3))], xlabel: '에폭', ylabel: 'BCE' }).axes({ zero: false });
      if (losses.length) Q.line(losses.map((v, i) => [i + 1, v]), pal.accent, 2);
      if (tcv.length) {
        const imgs = tcv.map(c => c.getContext('2d').createImageData(40, 40)), L0 = net[0];
        for (let py = 0; py < 40; py++) for (let px = 0; px < 40; px++) {
          const x1 = -3 + 6 * (px + .5) / 40, x2 = 3 - 6 * (py + .5) / 40, k = (py * 40 + px) * 4;
          tcv.forEach((c, j) => {
            const a = ACTS[act][0](x1 * L0.W[0][j] + x2 * L0.W[1][j] + L0.b[j]);
            const v = act === 'relu' || act === 'linear' ? Math.tanh(a) : act === 'sigmoid' ? 2 * a - 1 : a;
            const [rr, gg, bb] = V.cmap('div', (v + 1) / 2);
            imgs[j].data[k] = rr; imgs[j].data[k + 1] = gg; imgs[j].data[k + 2] = bb; imgs[j].data[k + 3] = 255;
          });
        }
        tcv.forEach((c, j) => c.getContext('2d').putImageData(imgs[j], 0, 0));
      }
      let acc = 0; pts.forEach(([x, y, c]) => { acc += (forward([x, y]).pop()[0] > .5) === (c === 1); });
      const params = net.reduce((s, L) => s + L.W.length * L.W[0].length + L.b.length, 0);
      ui.setRO(`구조 2 → ${nL ? Array(nL).fill(nH).join(' → ') + ' → ' : ''}1   파라미터 ${params}개   에폭 ${epoch}   손실 ${losses.length ? fmt(losses[losses.length - 1], 4) : '-'}   정확도 ${(acc / pts.length * 100).toFixed(1)}%`);
    }
    init(); draw(); V.onEnv(el, draw);
  });

  /* ===== 5. 순전파의 형상 추적 ===== */
  V.register('shapes', el => {
    const ui = V.shell(el, {
      title: '순전파의 형상 추적: 행렬곱, 파라미터, 연산량',
      desc: '각 층은 $Z = AW + \\mathbf b$를 계산한다. 배치 크기 $N$, 입력 크기, 은닉 크기를 바꾸며 각 텐서의 형상, 파라미터 수, 곱셈-덧셈 연산량(FLOPs)이 어떻게 변하는지 본다. 사각형의 가로세로는 차원의 크기를 로그 눈금으로 나타낸다.',
      how: ['한 줄이 층 하나다: (활성값 $A$) × (가중치 $W$) + $\\mathbf b$ = (출력 $Z$).', '같은 색 숫자끼리 맞물린다: $A$의 열 수(파랑) = $W$의 행 수(파랑). 맞물린 차원이 행렬곱에서 사라지고, $N$(회색)과 출력 크기(주황)가 남는다.', 'FLOPs는 곱셈과 덧셈을 각각 한 번으로 센 $2 \\times N \\times$ 입력 $\\times$ 출력이다.'],
      try: ['배치 크기 $N$을 1에서 256으로 바꿔도 파라미터 수는 그대로이고 FLOPs와 활성값 메모리만 늘어난다.', 'MNIST 프리셋에서 파라미터의 대부분이 어느 층에 있는지 찾는다(첫 층: 784 × 256).', '은닉 크기를 두 배로 하면 그 층의 앞뒤 두 행렬이 모두 두 배가 되어 파라미터가 크게 는다.']
    });
    const cv = ui.canvas(ui.body, 380);
    const PRE = { iris: [4, [8], 3, '붓꽃 4 → 8 → 3'], digits: [64, [32], 10, '손글씨 8×8: 64 → 32 → 10'], mnist: [784, [256, 128], 10, 'MNIST: 784 → 256 → 128 → 10'] };
    let pre = 'digits', N = 32, cfg = JSON.parse(JSON.stringify(PRE[pre]));
    ui.select({ label: '구조', options: Object.entries(PRE).map(([k, v]) => [k, v[3]]), value: pre, onChange: v => { pre = v; cfg = JSON.parse(JSON.stringify(PRE[v])); sH.value = cfg[1][0]; draw(); } });
    ui.slider({ label: '배치 크기 N', min: 0, max: 8, step: 1, value: 5, fmt: v => String(2 ** v), onInput: v => { N = 2 ** v; draw(); } });
    const sH = ui.slider({ label: '첫 은닉 크기', min: 2, max: 512, step: 2, value: cfg[1][0], fmt: v => String(v), onInput: v => { cfg[1][0] = v; draw(); } });
    const L = v => 6 + 8.5 * Math.log2(v + 1);
    function block(ctx, x, y, w, h, fill, stroke) { rrect(ctx, x, y, w, h, 3); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.stroke(); }
    function draw() {
      const pal = V.pal();
      const dims = [cfg[0], ...cfg[1], cfg[2]], layers = dims.length - 1;
      const W0 = cv.el.parentElement.clientWidth, compact = W0 < 640;
      let req = 0, reqV = 0; for (let l = 0; l < layers; l++) { req = Math.max(req, 234 + L(dims[l]) + 2 * L(dims[l + 1])); reqV = Math.max(reqV, L(dims[l]) + 2 * L(dims[l + 1])); }
      const sc = compact ? Math.min(1, (W0 - 172) / reqV) : Math.min(1, (W0 - 270) / req);
      let rows = [], H = 16;
      for (let l = 0; l < layers; l++) { const h = Math.max(L(N), L(dims[l])) * sc + 46 + (compact ? 58 : 0); rows.push([H, h]); H += h; }
      cv.hOpt = H + 8; cv.size();
      const ctx = cv.ctx;
      const cN = pal.muted, cIn = pal.series[0], cOut = pal.series[3];
      let totP = 0, totF = 0, totA = 0;
      for (let l = 0; l < layers; l++) {
        const [y0] = rows[l], din = dims[l], dout = dims[l + 1], last = l === layers - 1;
        const hN = L(N) * sc, wIn = L(din) * sc, hIn = L(din) * sc, wOut = L(dout) * sc;
        const yc = y0 + 22, top = yc;
        text(ctx, `층 ${l + 1}`, 4, yc - 12, { align: 'left', bold: true, color: pal.text2 });
        let x = 30;
        // A (N × din)
        block(ctx, x, top, wIn, hN, V.rgba(cIn, .14), cIn);
        text(ctx, l === 0 ? 'X' : `A${l}`, x + wIn / 2, top + hN / 2, { bold: true });
        text(ctx, `${N}`, x - 4, top + hN / 2, { align: 'right', color: cN, font: V.MONO });
        text(ctx, `${din}`, x + wIn / 2, top + hN + 9, { color: cIn, font: V.MONO });
        text(ctx, '×', x + wIn + 12, top + hN / 2, { bold: true, color: pal.muted }); x += wIn + 40;
        // W (din × dout)
        block(ctx, x, top, wOut, hIn, V.rgba(cOut, .14), cOut);
        text(ctx, `W${l + 1}`, x + wOut / 2, top + hIn / 2, { bold: true });
        text(ctx, `${din}`, x - 4, top + hIn / 2, { align: 'right', color: cIn, font: V.MONO });
        text(ctx, `${dout}`, x + wOut / 2, top + hIn + 9, { color: cOut, font: V.MONO });
        text(ctx, '+ b =', x + wOut + 10, top + hN / 2, { align: 'left', bold: true, color: pal.muted }); x += wOut + 84;
        // Z (N × dout)
        block(ctx, x, top, wOut, hN, V.rgba(pal.text2.startsWith('#') ? pal.text2 : '#777777', .12), pal.border2);
        text(ctx, `Z${l + 1}`, x + wOut / 2, top + hN / 2, { bold: true });
        text(ctx, `${N}`, x - 4, top + hN / 2, { align: 'right', color: cN, font: V.MONO });
        text(ctx, `${dout}`, x + wOut / 2, top + hN + 9, { color: cOut, font: V.MONO });
        if (!compact) text(ctx, last ? '→ softmax' : '→ ReLU', x + wOut + 10, top + hN / 2, { align: 'left', color: pal.text2 });
        const params = din * dout + dout, flops = 2 * N * din * dout;
        totP += params; totF += flops; totA += N * dout;
        const xr = compact ? 14 : W0 - 12, al = compact ? 'left' : 'right', ty = compact ? top + Math.max(hN, hIn) + 26 : top + 4;
        text(ctx, `(${N}, ${din}) @ (${din}, ${dout}) → (${N}, ${dout})${compact ? (last ? ' → softmax' : ' → ReLU') : ''}`, xr, ty, { align: al, font: V.MONO, color: pal.text2 });
        text(ctx, `파라미터 ${params.toLocaleString()}`, xr, ty + 18, { align: al });
        text(ctx, `FLOPs ${flops.toLocaleString()}`, xr, ty + 36, { align: al, color: pal.muted });
      }
      ui.setRO(`합계: 파라미터 ${totP.toLocaleString()}개 (${(totP * 4 / 1024).toFixed(1)} KB, float32)   순전파 FLOPs ${totF.toLocaleString()}   저장할 활성값 ${totA.toLocaleString()}개 (배치 ${N})`);
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 6. 계산 그래프 위의 역전파 ===== */
  const GRAPHS = {
    add_mul: {
      name: 'f = (x + y) · z',
      inputs: { x: -2, y: 5, z: -4 },
      nodes: [
        { id: 'x', type: 'in', pos: [.08, .22] }, { id: 'y', type: 'in', pos: [.08, .5] }, { id: 'z', type: 'in', pos: [.08, .82] },
        { id: 'q', op: '+', args: ['x', 'y'], pos: [.45, .36], f: (a, b) => a + b, g: (a, b) => [1, 1], rule: '덧셈 노드: 상류 기울기를 두 입력에 그대로 나눠 준다 (국소 기울기 1, 1).' },
        { id: 'f', op: '×', args: ['q', 'z'], pos: [.8, .58], f: (a, b) => a * b, g: (a, b) => [b, a], rule: '곱셈 노드: 한 입력의 기울기 = 상류 기울기 × 다른 입력의 값 (서로 바꿔 곱한다).' }
      ]
    },
    neuron: {
      name: '뉴런: L = −ln σ(w·x + b)',
      inputs: { w1: 2, x1: -1, w2: -3, x2: -2, b: -3 },
      nodes: [
        { id: 'w1', type: 'in', pos: [.05, .08] }, { id: 'x1', type: 'in', pos: [.05, .3] }, { id: 'w2', type: 'in', pos: [.05, .52] }, { id: 'x2', type: 'in', pos: [.05, .74] }, { id: 'b', type: 'in', pos: [.05, .95] },
        { id: 'm1', op: '×', args: ['w1', 'x1'], pos: [.33, .2], f: (a, b) => a * b, g: (a, b) => [b, a], rule: '곱셈 노드: 서로의 값을 바꿔 곱한다. ∂m₁/∂w₁ = x₁, ∂m₁/∂x₁ = w₁.' },
        { id: 'm2', op: '×', args: ['w2', 'x2'], pos: [.33, .63], f: (a, b) => a * b, g: (a, b) => [b, a], rule: '곱셈 노드: ∂m₂/∂w₂ = x₂, ∂m₂/∂x₂ = w₂.' },
        { id: 's', op: '+', args: ['m1', 'm2', 'b'], pos: [.56, .45], f: (a, b, c) => a + b + c, g: () => [1, 1, 1], rule: '덧셈 노드(입력 3개): 상류 기울기를 세 입력에 그대로 복사한다.' },
        { id: 'p', op: 'σ', args: ['s'], pos: [.73, .45], f: a => sig(a), g: a => [sig(a) * (1 - sig(a))], rule: '시그모이드 노드: 국소 기울기 σ(s)(1 − σ(s)) = p(1 − p)를 곱한다.' },
        { id: 'L', op: '−ln', args: ['p'], pos: [.88, .45], f: a => -Math.log(a), g: a => [-1 / a], rule: '−ln 노드: 국소 기울기 −1/p. 출력 L에서 시작하는 기울기는 ∂L/∂L = 1이다.' }
      ]
    },
    branch: {
      name: 'f = x · y + x (x가 두 번 쓰임)',
      inputs: { x: 3, y: -2 },
      nodes: [
        { id: 'x', type: 'in', pos: [.1, .3] }, { id: 'y', type: 'in', pos: [.1, .78] },
        { id: 'm', op: '×', args: ['x', 'y'], pos: [.45, .62], f: (a, b) => a * b, g: (a, b) => [b, a], rule: '곱셈 노드: ∂m/∂x = y, ∂m/∂y = x.' },
        { id: 'f', op: '+', args: ['m', 'x'], pos: [.8, .4], f: (a, b) => a + b, g: () => [1, 1], rule: '덧셈 노드. x는 이 노드와 곱셈 노드 두 곳으로 갈라졌으므로, x의 기울기는 두 경로에서 온 기울기의 합이다 (분기 = 기울기 합).' }
      ]
    }
  };
  V.register('compgraph', el => {
    const ui = V.shell(el, {
      title: '계산 그래프 위의 역전파',
      desc: '식을 기본 연산의 그래프로 쪼개고, 순전파로 값을 계산한 뒤 역전파로 출력에서 입력 쪽으로 기울기를 전달한다. 각 노드는 자기 연산의 국소 기울기만 알면 된다.',
      how: ['초록 숫자(선 위): 순전파 값. 빨간 숫자(선 아래): 출력의 그 값에 대한 기울기 $\\partial f/\\partial(\\cdot)$.', '"역전파 한 단계"는 노드 하나를 처리한다: 상류 기울기 × 국소 기울기 → 입력들의 기울기.', '아래 설명은 방금 처리한 노드의 규칙이다.'],
      try: ['$f = (x + y)z$에서 $\\partial f/\\partial x = z$, $\\partial f/\\partial z = x + y$가 되는지 확인한다.', '뉴런 그래프에서 $w_1$의 기울기를 손으로 먼저 계산한 뒤 단계를 진행해 맞춰 본다.', '분기 그래프에서 x의 기울기가 두 경로의 합 $y + 1$인지 확인한다.']
    });
    const cv = ui.canvas(ui.body, 0, { aspect: .5, minH: 260, maxH: 380 });
    let gk = 'add_mul', G = GRAPHS[gk], vals = {}, grads = {}, eg = {}, order = [], bstep = 0, lastRule = '', sliders = [];
    function forward() {
      vals = { ...G.inputs };
      G.nodes.filter(n => n.op).forEach(n => { vals[n.id] = n.f(...n.args.map(a => vals[a])); });
      order = G.nodes.filter(n => n.op).map(n => n.id).reverse();
    }
    function resetGrads() { grads = {}; eg = {}; bstep = 0; lastRule = ''; }
    function backStep() {
      if (bstep === 0) { const out = order[0]; grads[out] = 1; lastRule = `시작: 출력 ${out}의 자기 자신에 대한 기울기 ∂${out}/∂${out} = 1.`; bstep = 1; return; }
      if (bstep > order.length) return;
      const n = G.nodes.find(q => q.id === order[bstep - 1]), up = grads[n.id], loc = n.g(...n.args.map(a => vals[a]));
      n.args.forEach((a, i) => { grads[a] = (grads[a] || 0) + up * loc[i]; eg[a + '>' + n.id] = up * loc[i]; });
      lastRule = `${n.rule}  상류 ${fmt(up, 3)} × 국소 (${loc.map(v => fmt(v, 3)).join(', ')}) → ${n.args.map((a, i) => `${a}: ${fmt(up * loc[i], 3)}`).join(', ')}`;
      bstep++;
    }
    function buildSliders() {
      sliders.forEach(s => s.el.remove()); sliders = [];
      Object.keys(G.inputs).forEach(k => sliders.push(ui.slider({ label: k, min: -5, max: 5, step: .5, value: G.inputs[k], fmt: v => v.toFixed(1), onInput: v => { G.inputs[k] = v; forward(); resetGrads(); draw(); } })));
    }
    ui.select({ label: '그래프', options: Object.entries(GRAPHS).map(([k, v]) => [k, v.name]), value: gk, onChange: v => { gk = v; G = GRAPHS[v]; buildSliders(); forward(); resetGrads(); draw(); } });
    ui.button({ label: '역전파 한 단계', primary: true, onClick: () => { backStep(); draw(); } });
    ui.button({ label: '역전파 전체', onClick: () => { while (bstep <= order.length) backStep(); draw(); } });
    ui.button({ label: '기울기 지우기', onClick: () => { resetGrads(); draw(); } });
    buildSliders();
    function draw() {
      const pal = V.pal(); cv.size();
      const ctx = cv.ctx, W = cv.w, H = cv.h, pos = n => [n.pos[0] * (W - 40) + 20, n.pos[1] * (H - 40) + 20];
      const byId = Object.fromEntries(G.nodes.map(n => [n.id, n]));
      // 간선
      G.nodes.filter(n => n.op).forEach(n => {
        const [x1, y1] = pos(n);
        n.args.forEach(a => {
          const [x0, y0] = pos(byId[a]), sx = x0 + (byId[a].type === 'in' ? 26 : 20), ex = x1 - 22;
          ctx.strokeStyle = pal.border2; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(sx, y0); ctx.bezierCurveTo((sx + ex) / 2, y0, (sx + ex) / 2, y1, ex, y1); ctx.stroke();
          V.arrowPx(ctx, ex - 8, y1, ex, y1, pal.border2, 1.6, 7);
          // 값과 기울기는 출발 노드 가까이(곡선의 t 지점)에 쓴다
          const t = byId[a].type === 'in' ? .3 : .5, u = 1 - t, cx = (sx + ex) / 2;
          const mx = u ** 3 * sx + 3 * u * u * t * cx + 3 * u * t * t * cx + t ** 3 * ex, my = u ** 3 * y0 + 3 * u * u * t * y0 + 3 * u * t * t * y1 + t ** 3 * y1;
          text(ctx, fmt(vals[a], 3), mx, my - 10, { color: pal.ok, font: V.FONT_B });
          if (eg[a + '>' + n.id] !== undefined) text(ctx, fmt(eg[a + '>' + n.id], 3), mx, my + 11, { color: pal.bad, font: V.FONT_B });
        });
      });
      // 출력 간선
      const outN = byId[order[0]], [ox, oy] = pos(outN);
      V.arrowPx(ctx, ox + 22, oy, Math.min(W - 6, ox + 52), oy, pal.border2, 1.6, 7);
      text(ctx, fmt(vals[outN.id], 4), Math.min(W - 30, ox + 40), oy - 12, { color: pal.ok, font: V.FONT_B });
      if (grads[outN.id] !== undefined) text(ctx, '1', Math.min(W - 30, ox + 40), oy + 12, { color: pal.bad, font: V.FONT_B });
      // 노드
      G.nodes.forEach(n => {
        const [x, y] = pos(n);
        const active = bstep > 0 && order[bstep - 2] === n.id;
        if (n.type === 'in') { rrect(ctx, x - 26, y - 15, 52, 30, 7); ctx.fillStyle = pal.surface2; ctx.fill(); ctx.strokeStyle = pal.border2; ctx.lineWidth = 1.2; ctx.stroke(); text(ctx, n.id, x, y, { bold: true }); }
        else {
          ctx.beginPath(); ctx.arc(x, y, 21, 0, 7); ctx.fillStyle = active ? pal.accentSoft : pal.surface; ctx.fill(); ctx.strokeStyle = active ? pal.accent : pal.border2; ctx.lineWidth = active ? 2.4 : 1.4; ctx.stroke();
          text(ctx, n.op, x, y, { bold: true, color: active ? pal.accent : pal.text });
          text(ctx, n.id, x, y - 30, { color: pal.muted });
        }
      });
      const done = bstep > order.length;
      const inGrads = Object.keys(G.inputs).map(k => `∂/∂${k} = ${grads[k] !== undefined && done ? fmt(grads[k], 4) : '?'}`).join('   ');
      ui.setRO(`${lastRule || '순전파 완료. "역전파 한 단계"를 누른다.'}\n입력의 기울기: ${inGrads}`);
    }
    forward(); draw(); V.onEnv(el, draw);
  });

  /* ===== 7. 역전파 단계별 실행 ===== */
  V.register('backprop-steps', el => {
    const ui = V.shell(el, {
      title: '역전파 단계별 실행: 2-2-1 신경망',
      desc: '입력 2개, 은닉 뉴런 2개(시그모이드), 출력 1개(시그모이드), 이진 교차 엔트로피 손실. 표본 하나에 대해 순전파 → 손실 → 역전파 → 갱신을 숫자로 한 단계씩 따라간다.',
      how: ['노드 안 검은 숫자: 순전파 값. 노드 아래 빨간 숫자: 그 노드의 기울기 $\\delta = \\partial L/\\partial z$.', '선 위 숫자: 가중치. 역전파 단계에서는 가중치의 기울기가 빨갛게 함께 표시된다.', '아래 상자: 현재 단계의 식과 숫자.'],
      try: ['각 단계의 숫자를 계산기로 먼저 계산한 뒤 "다음"을 눌러 확인한다.', '학습률을 바꾸고 마지막 단계에서 손실이 얼마나 줄어드는지 비교한다.', '은닉층 기울기 $\\delta^{(1)}$에 $h(1 - h)$가 곱해지는 이유를 계산 그래프와 연결해 본다.']
    });
    const cv = ui.canvas(ui.body, 0, { aspect: .48, minH: 250, maxH: 340 });
    const box = document.createElement('div'); box.className = 'ro'; box.style.cssText = 'display:block;white-space:pre-wrap;min-height:5.2em'; ui.body.appendChild(box);
    const x = [1.0, 0.5], y = 1;
    let W1 = [[.5, -.3], [.2, .4]], b1 = [.1, -.1], W2 = [.7, -.5], b2 = .2, eta = .5, k = 0;
    function compute() {
      const z1 = [0, 1].map(j => x[0] * W1[0][j] + x[1] * W1[1][j] + b1[j]), h = z1.map(sig);
      const z2 = h[0] * W2[0] + h[1] * W2[1] + b2, p = sig(z2), L = -Math.log(p);
      const d2 = p - y, gW2 = h.map(v => v * d2), gb2 = d2, dh = W2.map(w => w * d2), d1 = dh.map((v, j) => v * h[j] * (1 - h[j]));
      const gW1 = [[x[0] * d1[0], x[0] * d1[1]], [x[1] * d1[0], x[1] * d1[1]]], gb1 = d1.slice();
      const nW1 = W1.map((r, i) => r.map((w, j) => w - eta * gW1[i][j])), nb1 = b1.map((v, j) => v - eta * gb1[j]), nW2 = W2.map((w, j) => w - eta * gW2[j]), nb2 = b2 - eta * gb2;
      const nz1 = [0, 1].map(j => x[0] * nW1[0][j] + x[1] * nW1[1][j] + nb1[j]), nh = nz1.map(sig), np = sig(nh[0] * nW2[0] + nh[1] * nW2[1] + nb2);
      return { z1, h, z2, p, L, d2, gW2, gb2, dh, d1, gW1, gb1, nW1, nb1, nW2, nb2, np, nL: -Math.log(np) };
    }
    const f3 = v => fmt(v, 4);
    const STEPS = [
      ['초기 상태', s => `입력 x = (${x.join(', ')}), 정답 y = ${y}\nW1 = [[${W1[0].join(', ')}], [${W1[1].join(', ')}]] (행: 입력, 열: 은닉),  b1 = (${b1.join(', ')})\nW2 = (${W2.join(', ')}),  b2 = ${b2}`],
      ['1. 은닉층 선형 결합', s => `z1ⱼ = x₁W1₁ⱼ + x₂W1₂ⱼ + b1ⱼ\nz1₁ = 1.0×0.5 + 0.5×0.2 + 0.1 = ${f3(s.z1[0])}\nz1₂ = 1.0×(−0.3) + 0.5×0.4 − 0.1 = ${f3(s.z1[1])}`],
      ['2. 은닉층 활성화', s => `h = σ(z1)\nh₁ = σ(${f3(s.z1[0])}) = ${f3(s.h[0])},  h₂ = σ(${f3(s.z1[1])}) = ${f3(s.h[1])}`],
      ['3. 출력', s => `z2 = h₁W2₁ + h₂W2₂ + b2 = ${f3(s.h[0])}×0.7 + ${f3(s.h[1])}×(−0.5) + 0.2 = ${f3(s.z2)}\np = σ(z2) = ${f3(s.p)}`],
      ['4. 손실', s => `L = −[y ln p + (1 − y) ln(1 − p)] = −ln ${f3(s.p)} = ${f3(s.L)}`],
      ['5. 출력층 기울기', s => `δ2 = ∂L/∂z2 = p − y = ${f3(s.p)} − 1 = ${f3(s.d2)}  (시그모이드 + BCE, 10일차)`],
      ['6. 출력층 가중치의 기울기', s => `∂L/∂W2ⱼ = hⱼ · δ2 → (${f3(s.gW2[0])}, ${f3(s.gW2[1])})\n∂L/∂b2 = δ2 = ${f3(s.gb2)}`],
      ['7. 은닉층으로 전달', s => `∂L/∂hⱼ = W2ⱼ · δ2 → (0.7 × ${f3(s.d2)}, −0.5 × ${f3(s.d2)}) = (${f3(s.dh[0])}, ${f3(s.dh[1])})`],
      ['8. 활성화 함수 통과', s => `δ1ⱼ = ∂L/∂hⱼ · hⱼ(1 − hⱼ)\nδ1₁ = ${f3(s.dh[0])} × ${f3(s.h[0] * (1 - s.h[0]))} = ${f3(s.d1[0])},  δ1₂ = ${f3(s.dh[1])} × ${f3(s.h[1] * (1 - s.h[1]))} = ${f3(s.d1[1])}`],
      ['9. 은닉층 가중치의 기울기', s => `∂L/∂W1ᵢⱼ = xᵢ · δ1ⱼ (= xᵀδ1)\n[[${f3(s.gW1[0][0])}, ${f3(s.gW1[0][1])}], [${f3(s.gW1[1][0])}, ${f3(s.gW1[1][1])}]],  ∂L/∂b1 = (${f3(s.gb1[0])}, ${f3(s.gb1[1])})`],
      ['10. 갱신과 확인', s => `W ← W − η∇W (η = ${eta})\nW2 = (${f3(s.nW2[0])}, ${f3(s.nW2[1])}), b2 = ${f3(s.nb2)}\n새 예측 p = ${f3(s.np)} (전 ${f3(s.p)}),  손실 ${f3(s.L)} → ${f3(s.nL)}`]
    ];
    ui.button({ label: '처음으로', onClick: () => { k = 0; draw(); } });
    ui.button({ label: '이전', onClick: () => { k = Math.max(0, k - 1); draw(); } });
    ui.button({ label: '다음', primary: true, onClick: () => { k = Math.min(STEPS.length - 1, k + 1); draw(); } });
    ui.slider({ label: '학습률 η', min: .1, max: 2, step: .1, value: eta, fmt: v => v.toFixed(1), onInput: v => { eta = v; draw(); } });
    function draw() {
      const pal = V.pal(); cv.size();
      const ctx = cv.ctx, W = cv.w, H = cv.h, s = compute();
      const X = [W * .1, W * .42, W * .74], Ys = [[H * .3, H * .7], [H * .3, H * .7], [H * .5]];
      const node = (cx, cy, label, val, grad, on) => {
        ctx.beginPath(); ctx.arc(cx, cy, 25, 0, 7); ctx.fillStyle = on ? pal.accentSoft : pal.surface; ctx.fill(); ctx.strokeStyle = on ? pal.accent : pal.border2; ctx.lineWidth = on ? 2.4 : 1.4; ctx.stroke();
        text(ctx, label, cx, cy - 36, { color: pal.muted });
        if (val !== null) text(ctx, val, cx, cy, { bold: true });
        if (grad !== null) text(ctx, grad, cx, cy + 38, { color: pal.bad, font: V.FONT_B });
      };
      const edge = (x0, y0, x1, y1, w, g, on, t = .5) => {
        ctx.strokeStyle = on ? pal.accent : pal.border2; ctx.lineWidth = on ? 2.2 : 1.3; ctx.beginPath(); ctx.moveTo(x0 + 25, y0); ctx.lineTo(x1 - 25, y1); ctx.stroke();
        const mx = x0 + 25 + (x1 - x0 - 50) * t, my = y0 + (y1 - y0) * t;
        V.label(ctx, mx, my - 8, w, { align: 'center', font: V.MONO, color: pal.text2 });
        if (g !== null) V.label(ctx, mx, my + 10, g, { align: 'center', font: V.MONO, color: pal.bad });
      };
      const showF = i => k >= i, showB = i => k >= i;
      // 간선
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) edge(X[0], Ys[0][i], X[1], Ys[1][j], fmt(W1[i][j], 2), showB(9) ? fmt(s.gW1[i][j], 3) : null, k === 1 || k === 9, i === j ? .55 : .2);
      for (let j = 0; j < 2; j++) edge(X[1], Ys[1][j], X[2], Ys[2][0], fmt(W2[j], 2), showB(6) ? fmt(s.gW2[j], 3) : null, k === 3 || k === 6 || k === 7);
      node(X[0], Ys[0][0], 'x₁', '1.0', null, k === 1); node(X[0], Ys[0][1], 'x₂', '0.5', null, k === 1);
      for (let j = 0; j < 2; j++) node(X[1], Ys[1][j], `h${j ? '₂' : '₁'}`, showF(2) ? fmt(s.h[j], 3) : showF(1) ? `z ${fmt(s.z1[j], 2)}` : null, showB(8) ? `δ ${fmt(s.d1[j], 3)}` : showB(7) ? `∂h ${fmt(s.dh[j], 3)}` : null, k === 1 || k === 2 || k === 7 || k === 8);
      node(X[2], Ys[2][0], 'p', showF(3) ? fmt(s.p, 3) : null, showB(5) ? `δ ${fmt(s.d2, 3)}` : null, k === 3 || k === 5);
      if (showF(4)) { text(ctx, `L = ${fmt(s.L, 4)}`, Math.min(W - 50, X[2] + 80), Ys[2][0], { bold: true, color: k === 4 ? pal.accent : pal.text }); }
      text(ctx, `y = ${y}`, Math.min(W - 50, X[2] + 80), Ys[2][0] + 24, { color: pal.muted });
      box.textContent = `${STEPS[k][0]}\n${STEPS[k][1](s)}`;
      ui.setRO(`단계 ${k} / ${STEPS.length - 1}`);
    }
    draw(); V.onEnv(el, draw);
  });

  V.modsReady.push('w3');
})();
