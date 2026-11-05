/* 2주차 시각화: 선형회귀, 1차원·2차원 경사하강법, 로지스틱 회귀, 소프트맥스, 과적합, 임계값, kNN */
(function () {
  'use strict';
  const fmt = V.fmt;

  /* ===== 1. 선형회귀와 잔차 ===== */
  V.register('regression-fit', el => {
    const ui = V.shell(el, {
      title: '선형회귀: 잔차 제곱의 합을 최소로',
      desc: '점을 끌어 옮기고, 슬라이더로 직선 $\\hat y = wx + b$를 조절한다. 각 점의 잔차(세로 오차)를 한 변으로 하는 정사각형을 그렸다. 평균제곱오차는 이 정사각형 넓이의 평균이다.',
      how: ['검은 점: 데이터. 파란 직선: 현재 모델.', '빨간 정사각형: 잔차 제곱. 넓이가 클수록 큰 벌점을 받는다.', '회색 점선: 최소제곱 해(정규방정식으로 구한 최적 직선).'],
      try: ['슬라이더만으로 정사각형 넓이의 합을 최소로 만들어 본 뒤 "최적 직선"과 비교한다.', '점 하나를 멀리 끌어 이상치를 만든다. 최적 직선이 얼마나 끌려가는가? 제곱 오차는 이상치에 민감하다.', '모든 점을 한 직선 위에 놓으면 MSE가 0이 되는지 확인한다.']
    });
    const cv = ui.canvas(ui.body, 0, { aspect: .6, maxH: 400 });
    let pts = [[1, 2.2], [2, 2.8], [3, 4.5], [4, 4.1], [5, 6.0], [6, 5.6], [7, 7.4], [8, 7.1]];
    let w = .5, b = 2, drag = -1, P;
    const sw = ui.slider({ label: '기울기 w', min: -1, max: 2.5, step: .01, value: w, fmt: v => v.toFixed(2), onInput: v => { w = v; draw(); } });
    const sb = ui.slider({ label: '절편 b', min: -3, max: 6, step: .01, value: b, fmt: v => v.toFixed(2), onInput: v => { b = v; draw(); } });
    const tSq = ui.toggle({ label: '잔차 정사각형', value: true, onChange: draw });
    const tOpt = ui.toggle({ label: '최적 직선 표시', value: false, onChange: draw });
    ui.button({ label: '최적 직선으로', primary: true, onClick: () => { const [ww, bb] = ols(); w = ww; b = bb; sw.value = w; sb.value = b; draw(); } });
    function ols() {
      const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
      const sxy = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0), sxx = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
      const ww = sxx ? sxy / sxx : 0; return [ww, my - ww * mx];
    }
    cv.drag({
      down: (x, y) => { drag = pts.findIndex(p => Math.hypot(P.X(p[0]) - x, P.Y(p[1]) - y) < 14); },
      move: (x, y) => { if (drag < 0) return; pts[drag] = [V.clamp(P.ix(x), 0, 10), V.clamp(P.iy(y), 0, 10)]; draw(); },
      up: () => { drag = -1; }
    });
    function draw() {
      const pal = V.pal(); cv.size();
      P = V.plot(cv, { x: [0, 10], y: [0, 10], equal: true, xlabel: '입력 x', ylabel: '출력 y' }).axes();
      const ctx = P.ctx; P.clip();
      let sse = 0;
      pts.forEach(([x, y]) => {
        const r = w * x + b - y; sse += r * r;
        if (tSq.value) { ctx.fillStyle = V.rgba(pal.bad, .13); ctx.strokeStyle = V.rgba(pal.bad, .6); const x0 = P.X(x), y0 = P.Y(Math.max(y, y + r)), s = Math.abs(P.X(x + Math.abs(r)) - P.X(x)); ctx.fillRect(x0, y0, s, s); ctx.strokeRect(x0, y0, s, s); }
        P.line([[x, y], [x, y + r]], pal.bad, 1.6);
      });
      if (tOpt.value) { const [ow, ob] = ols(); P.fn(x => ow * x + ob, pal.muted, 1.6, [6, 4]); }
      P.fn(x => w * x + b, pal.series[0], 2.6);
      P.unclip();
      pts.forEach(([x, y]) => P.dot(x, y, 6, pal.text, pal.surface));
      const [ow, ob] = ols(), best = pts.reduce((s, [x, y]) => s + (ow * x + ob - y) ** 2, 0) / pts.length;
      ui.setRO(`현재: w = ${w.toFixed(2)}, b = ${b.toFixed(2)}, MSE = ${fmt(sse / pts.length, 4)}\n최적: w = ${fmt(ow, 3)}, b = ${fmt(ob, 3)}, MSE = ${fmt(best, 4)}`);
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 2. 1차원 경사하강법과 학습률 ===== */
  V.register('gd-1d', el => {
    const F = {
      para: { name: '포물선 L = (w−2)²', f: w => (w - 2) ** 2, g: w => 2 * (w - 2), c: 2, xr: [-2, 6], yr: [-.5, 16] },
      steep: { name: '가파른 포물선 L = 5(w−2)²', f: w => 5 * (w - 2) ** 2, g: w => 10 * (w - 2), c: 10, xr: [-1, 5], yr: [-2, 45] },
      quart: { name: '비대칭 L = (w−2)⁴/4 + (w−2)²/2', f: w => (w - 2) ** 4 / 4 + (w - 2) ** 2 / 2, g: w => (w - 2) ** 3 + (w - 2), c: 1, xr: [-1.5, 5.5], yr: [-.5, 20] }
    };
    const ui = V.shell(el, {
      title: '경사하강법 한 걸음씩: 학습률의 영향',
      desc: '공을 손실 곡선 위에 놓고, 매 걸음 $w \\leftarrow w - \\eta\\,L\'(w)$로 움직인다. 학습률 $\\eta$에 따라 천천히 내려가거나, 양쪽 벽을 오가거나, 튕겨 나간다.',
      how: ['왼쪽: 손실 곡선과 걸음마다의 위치. 화살표가 한 걸음의 이동이다.', '오른쪽: 걸음 수에 따른 손실(로그 눈금). 직선으로 내려가면 일정한 비율로 줄어드는 것이다.', '포물선에서는 한 걸음마다 최솟값까지의 거리가 $|1 - \\eta L\'\'|$배가 된다.'],
      try: ['포물선에서 η = 0.1, 0.5, 0.9, 1.05를 차례로 시험한다. 각각 어떤 모양인가?', '가파른 포물선에서는 같은 η = 0.5가 발산하는 이유를 곡률로 설명한다.', 'η = 1/L″에서 한 걸음 만에 최솟값에 도착하는지 확인한다(포물선: 0.5).']
    });
    const row = ui.row(2);
    const c1 = ui.canvas(ui.panel(row, '손실 곡선과 이동 경로'), 0, { aspect: .7, maxH: 330 });
    const c2 = ui.canvas(ui.panel(row, '손실 대 걸음 수'), 0, { aspect: .7, maxH: 330 });
    let key = 'para', S = F[key], lr = .1, w0 = -1, path = [], anim = null;
    const reset = () => { path = [w0]; };
    ui.select({ label: '손실 함수', options: Object.entries(F).map(([k, v]) => [k, v.name]), value: key, onChange: v => { key = v; S = F[v]; stop(); reset(); draw(); } });
    ui.slider({ label: '학습률 η', min: .01, max: 1.2, step: .01, value: lr, fmt: v => v.toFixed(2), onInput: v => { lr = v; stop(); reset(); draw(); } });
    ui.slider({ label: '시작 w₀', min: -1.5, max: 5.5, step: .1, value: w0, fmt: v => v.toFixed(1), onInput: v => { w0 = v; stop(); reset(); draw(); } });
    const bRun = ui.button({ label: '실행', primary: true, onClick: () => { if (anim) return stop(); bRun.setLabel('정지'); let t = 0; anim = V.loop(() => { if (++t % 12) return; step(); if (path.length > 40) { stop(); return false; } }); } });
    ui.button({ label: '한 걸음', onClick: step });
    ui.button({ label: '초기화', onClick: () => { stop(); reset(); draw(); } });
    function stop() { if (anim) { anim.stop(); anim = null; } bRun.setLabel('실행'); }
    function step() { const w = path[path.length - 1]; const nw = w - lr * S.g(w); path.push(Math.abs(nw) > 1e6 ? Math.sign(nw) * 1e6 : nw); draw(); }
    function draw() {
      const pal = V.pal(); c1.size(); c2.size();
      const P = V.plot(c1, { x: S.xr, y: S.yr, xlabel: '파라미터 w', ylabel: '손실 L(w)' }).axes();
      P.fn(S.f, pal.text, 2.2);
      P.clip();
      for (let i = 1; i < path.length; i++) { const a = path[i - 1], c = path[i]; P.arrow(a, S.f(a), c, S.f(c), V.rgba(pal.bad, .75), 1.6, 7); }
      path.forEach((w, i) => P.dot(w, S.f(w), i === path.length - 1 ? 6 : 3.5, i === path.length - 1 ? pal.bad : V.rgba(pal.bad, .55)));
      P.unclip();
      const vals = path.map(w => Math.max(S.f(w), 1e-12)), lg = vals.map(v => Math.log10(v));
      const Q = V.plot(c2, { x: [0, Math.max(10, path.length - 1)], y: [Math.min(-6, ...lg), Math.max(2, ...lg) + .3], xlabel: '걸음 수', ylabel: 'log₁₀ L' }).axes();
      Q.clip(); Q.line(lg.map((v, i) => [i, v]), pal.series[0], 2); lg.forEach((v, i) => Q.dot(i, v, 2.5, pal.series[0])); Q.unclip();
      const factor = Math.abs(1 - lr * S.c), w = path[path.length - 1];
      const regime = key === 'quart' ? '' : factor < 1e-9 ? '한 걸음에 도착' : lr * S.c < 1 ? '단조롭게 수렴' : lr * S.c < 2 ? '진동하며 수렴' : '발산';
      ui.setRO(`걸음 ${path.length - 1}   w = ${fmt(w, 4)}   L = ${fmt(S.f(w), 4)}   L″ (곡률) = ${S.c}   η·L″ = ${fmt(lr * S.c, 3)}${regime ? `   → ${regime} (배율 |1 − ηL″| = ${fmt(factor, 3)})` : ''}`);
    }
    reset(); draw(); V.onEnv(el, draw);
  });

  /* ===== 3. 손실 지형: 등고선 + 3D + 손실 곡선 ===== */
  // 선형회귀 데이터: 입력 x가 넓은 범위(0~10)에 퍼져 있어 손실 지형이 길쭉해진다
  const RD = (() => { const r = V.rng(5); return Array.from({ length: 30 }, () => { const x = 10 * r(); return [x, 0.8 * x + 1 + V.gauss(r) * 0.8]; }); })();
  const rx = RD.map(p => p[0]), ry = RD.map(p => p[1]);
  const mxx = rx.reduce((a, b) => a + b) / rx.length, sxx = Math.sqrt(rx.reduce((a, b) => a + (b - mxx) ** 2, 0) / rx.length);
  const regLoss = std => (w, b) => { let s = 0; for (let i = 0; i < rx.length; i++) { const x = std ? (rx[i] - mxx) / sxx : rx[i]; s += (w * x + b - ry[i]) ** 2; } return s / rx.length; };
  const regGrad = std => (w, b) => { let gw = 0, gb = 0; for (let i = 0; i < rx.length; i++) { const x = std ? (rx[i] - mxx) / sxx : rx[i]; const r = w * x + b - ry[i]; gw += 2 * r * x; gb += 2 * r; } return [gw / rx.length, gb / rx.length]; };
  const LAND = {
    reg: { name: '선형회귀 손실 L(w, b) (원래 입력)', f: regLoss(false), g: regGrad(false), xr: [-0.6, 2.2], yr: [-3, 5], st: [-0.4, 4], lab: ['w', 'b'], lr: .02, lrMax: .07 },
    regstd: { name: '같은 데이터, 표준화한 입력', f: regLoss(true), g: regGrad(true), xr: [-1, 5], yr: [-1, 8], st: [0, 0], lab: ['w', 'b'], lr: .2, lrMax: 1.1 },
    bowl: { name: '둥근 그릇', f: (a, b) => a * a + b * b, g: (a, b) => [2 * a, 2 * b], xr: [-3, 3], yr: [-3, 3], st: [-2.5, 2], lab: ['w₁', 'w₂'], lr: .1, lrMax: 1.1 },
    valley: { name: '길쭉한 골짜기', f: (a, b) => .2 * a * a + 4 * b * b, g: (a, b) => [.4 * a, 8 * b], xr: [-4, 4], yr: [-2, 2], st: [-3.6, 1.2], lab: ['w₁', 'w₂'], lr: .1, lrMax: .3 },
    saddle: { name: '안장점 근처', f: (a, b) => .5 * a * a - .4 * b * b + .06 * b ** 4 + 2.5, g: (a, b) => [a, -.8 * b + .24 * b ** 3], xr: [-3, 3], yr: [-3.5, 3.5], st: [-2.6, 0.05], lab: ['w₁', 'w₂'], lr: .1, lrMax: 1 }
  };
  V.register('gd', el => {
    const ui = V.shell(el, {
      title: '손실 지형 위의 경사하강법: 등고선, 3D 곡면, 손실 곡선',
      desc: '파라미터 두 개의 손실 $L(w_1, w_2)$를 세 가지로 본다. 왼쪽은 위에서 내려다본 등고선 지도(선 위 숫자가 손실 값), 오른쪽은 같은 지형의 3D 곡면, 아래는 걸음 수에 따른 손실이다. 등고선 지도를 클릭해 출발점을 정하고 실행한다.',
      how: ['등고선 하나 = 손실이 같은 파라미터들. 진한 파랑일수록 손실이 낮다. 별표가 최솟값이다.', '빨간 경로: 경사하강법의 발자취. 매 걸음 등고선에 수직인 방향(가장 가파른 내리막)으로 움직인다.', '초록 화살표: 현재 위치에서 $-\\nabla L$ 방향. 길이는 그래디언트의 크기에 비례한다.', '3D 곡면은 끌어서 회전한다. 같은 경로가 곡면 위에 그려진다.'],
      try: ['"선형회귀 손실 (원래 입력)": 등고선이 길쭉해 경로가 지그재그로 움직이고 느리게 수렴한다. 학습률을 올리면 어떻게 되는가?', '"표준화한 입력"으로 바꾼다. 같은 데이터인데 지형이 둥글어지고 몇 걸음 만에 도착한다. 입력 표준화가 학습을 빠르게 하는 이유다.', '"안장점 근처": 출발점을 가운데 선 근처에 두면 한동안 거의 멈춰 있다가 미끄러진다.', '학습률을 최대로 올려 발산하는 모습을 3D로 본다.']
    });
    const row = ui.row(2);
    const c1 = ui.canvas(ui.panel(row, '등고선 지도 (클릭: 출발점)'), 0, { aspect: .82, maxH: 420 });
    const c2 = ui.canvas(ui.panel(row, '3D 곡면 (끌어서 회전)'), 0, { aspect: .82, maxH: 420 });
    const c3 = ui.canvas(ui.panel(ui.body, '손실 대 걸음 수'), 0, { aspect: .2, minH: 120, maxH: 170 });
    let key = 'reg', S = LAND[key], lr = S.lr, path = [S.st.slice()], anim = null, P, info;
    const view = { yaw: -0.65, pitch: 0.82 };
    const sLr = ui.slider({ label: '학습률 η', min: .001, max: S.lrMax, step: .001, value: lr, fmt: v => v.toFixed(3), onInput: v => { lr = v; } });
    ui.select({ label: '지형', options: Object.entries(LAND).map(([k, v]) => [k, v.name]), value: key, onChange: v => { key = v; S = LAND[v]; lr = S.lr; sLr.input.max = S.lrMax; sLr.value = lr; stop(); path = [S.st.slice()]; draw(); } });
    const bRun = ui.button({ label: '실행', primary: true, onClick: () => { if (anim) return stop(); bRun.setLabel('정지'); let t = 0; anim = V.loop(() => { if (++t % 4) return; step(); if (path.length > 400) { stop(); return false; } }); } });
    ui.button({ label: '한 걸음', onClick: step });
    ui.button({ label: '초기화', onClick: () => { stop(); path = [S.st.slice()]; draw(); } });
    function stop() { if (anim) { anim.stop(); anim = null; } bRun.setLabel('실행'); }
    function step() {
      const c = path[path.length - 1], g = S.g(c[0], c[1]);
      const n = [c[0] - lr * g[0], c[1] - lr * g[1]];
      if (!isFinite(n[0]) || Math.abs(n[0]) > 1e4 || Math.abs(n[1]) > 1e4) { stop(); ui.setRO('발산: 파라미터가 무한히 커졌다. 학습률을 줄이고 초기화한다.'); return; }
      path.push(n); draw();
    }
    c1.el.addEventListener('click', e => { const [x, y] = c1.pos(e); if (!P.inside(x, y)) return; stop(); path = [[P.ix(x), P.iy(y)]]; draw(); });
    V.orbit(c2, view, () => draw(true));
    function minimum() { // 격자 탐색 + 미세 조정으로 최솟값 표시
      let best = [0, 0], bv = Infinity;
      for (let i = 0; i <= 60; i++) for (let j = 0; j <= 60; j++) { const a = S.xr[0] + (S.xr[1] - S.xr[0]) * i / 60, b = S.yr[0] + (S.yr[1] - S.yr[0]) * j / 60, v = S.f(a, b); if (v < bv) { bv = v; best = [a, b]; } }
      return best;
    }
    function draw(only3d) {
      const pal = V.pal();
      if (!only3d) {
        c1.size();
        P = V.plot(c1, { x: S.xr, y: S.yr, xlabel: S.lab[0], ylabel: S.lab[1], pad: { r: 66 } });
        info = V.contour(P, S.f, { n: 9 });
        P.axes({ zero: false });
        V.colorbar(P.ctx, P.box.x1 + 12, P.box.y0 + 20, 12, P.box.y1 - P.box.y0 - 40, info, '손실');
        P.clip();
        const m = minimum(); P.ctx.fillStyle = pal.text; P.ctx.font = '16px sans-serif'; P.ctx.textAlign = 'center'; P.ctx.textBaseline = 'middle'; P.ctx.fillText('★', P.X(m[0]), P.Y(m[1]));
        P.line(path, pal.bad, 2);
        path.forEach((c, i) => P.dot(c[0], c[1], i === path.length - 1 ? 5.5 : 2.4, i === path.length - 1 ? pal.bad : V.rgba(pal.bad, .6)));
        const c = path[path.length - 1], g = S.g(c[0], c[1]), gn = Math.hypot(...g);
        if (gn > 1e-9) { const L = Math.min(1, gn / 6) * (S.xr[1] - S.xr[0]) * .18 + (S.xr[1] - S.xr[0]) * .04; P.arrow(c[0], c[1], c[0] - g[0] / gn * L, c[1] - g[1] / gn * L, pal.ok, 2.4, 9); }
        P.unclip();
        c3.size();
        const vals = path.map(p => Math.max(S.f(p[0], p[1]), 1e-12));
        const Q = V.plot(c3, { x: [0, Math.max(20, path.length - 1)], y: [0, Math.max(...vals) * 1.08], xlabel: '걸음 수', ylabel: '손실', pad: { b: 38 } }).axes();
        Q.clip(); Q.line(vals.map((v, i) => [i, v]), pal.series[0], 2); Q.unclip();
        const last = path[path.length - 1];
        ui.setRO(`걸음 ${path.length - 1}   (${S.lab[0]}, ${S.lab[1]}) = (${fmt(last[0], 3)}, ${fmt(last[1], 3)})   L = ${fmt(S.f(last[0], last[1]), 4)}   ‖∇L‖ = ${fmt(Math.hypot(...S.g(last[0], last[1])), 3)}`);
      }
      c2.size();
      const zmax = info.levels[info.levels.length - 1] * 1.15;
      V.surface3d(c2, (a, b) => Math.min(S.f(a, b), zmax), { xr: S.xr, yr: S.yr, zr: [Math.min(0, info.vmin), zmax], n: 30, yaw: view.yaw, pitch: view.pitch, levels: info.levels, xlabel: S.lab[0], ylabel: S.lab[1], zlabel: 'L', path: path.slice(-150), pathColor: pal.bad });
    }
    draw(); V.onEnv(el, () => draw());
  });

  /* ===== 4. 로지스틱 회귀의 결정 경계 ===== */
  V.register('logistic', el => {
    const ui = V.shell(el, {
      title: '로지스틱 회귀: 확률을 출력하는 선형 분류기',
      desc: '배경색은 모델이 출력하는 확률 $P(y=1\\mid x) = \\sigma(w_1x_1 + w_2x_2 + b)$다. 굵은 선이 확률 0.5인 결정 경계, 점선이 0.1과 0.9 등확률선이다. "학습"을 누르면 이진 교차 엔트로피를 경사하강법으로 줄인다.',
      how: ['파랑: 클래스 1일 확률이 높은 영역. 빨강: 클래스 0일 확률이 높은 영역. 경계에서 멀수록 확신이 크다.', '오른쪽: 각 점의 점수 $z$와 시그모이드 곡선. 점의 색은 실제 클래스다.'],
      try: ['캔버스를 클릭해 점을 추가한다(선택한 클래스로). 경계 반대편에 점을 추가하고 다시 학습한다.', '"원 모양" 데이터에서는 직선 경계로 풀리지 않는다. "제곱 특징 추가"를 켜면 경계가 원이 된다.', '학습을 오래 하면 경계 근처 점선 간격이 좁아진다. 모델이 점점 더 확신하는 것이다.']
    });
    const row = ui.row(2);
    const c1 = ui.canvas(ui.panel(row, '입력 공간과 확률'), 0, { aspect: .82, maxH: 400 });
    const c2 = ui.canvas(ui.panel(row, '점수 z와 시그모이드'), 0, { aspect: .82, maxH: 400 });
    const r = V.rng(9);
    const make = kind => {
      const pts = [];
      for (let i = 0; i < 80; i++) {
        if (kind === 'blobs') { const c = i % 2; pts.push([(c ? 1 : -1) + V.gauss(r) * .8, (c ? .6 : -.6) + V.gauss(r) * .8, c]); }
        else { const c = i % 2, rad = c ? 2.1 + r() * .8 : r() * 1.4, t = r() * 6.283; pts.push([rad * Math.cos(t), rad * Math.sin(t), c]); }
      }
      return pts;
    };
    let kind = 'blobs', pts = make(kind), W = [0, 0, 0, 0], b = 0, sq = false, cls = 1, anim = null, epoch = 0, P;
    const feats = (x, y) => sq ? [x, y, x * x, y * y] : [x, y, 0, 0];
    const sig = z => 1 / (1 + Math.exp(-z));
    const prob = (x, y) => { const f = feats(x, y); return sig(W[0] * f[0] + W[1] * f[1] + W[2] * f[2] + W[3] * f[3] + b); };
    function trainStep(lr = .3) {
      const g = [0, 0, 0, 0]; let gb = 0;
      pts.forEach(([x, y, c]) => { const f = feats(x, y), e = prob(x, y) - c; for (let k = 0; k < 4; k++) g[k] += e * f[k]; gb += e; });
      for (let k = 0; k < 4; k++) W[k] -= lr * g[k] / pts.length; b -= lr * gb / pts.length; epoch++;
    }
    ui.select({ label: '데이터', options: [['blobs', '두 무리'], ['circle', '원 모양']], value: kind, onChange: v => { kind = v; pts = make(v); reset(); } });
    ui.toggle({ label: '제곱 특징 추가 (x₁², x₂²)', value: false, onChange: v => { sq = v; reset(); } });
    ui.select({ label: '추가할 클래스', options: [[1, '클래스 1 (파랑)'], [0, '클래스 0 (빨강)']], value: 1, onChange: v => { cls = +v; } });
    const bRun = ui.button({ label: '학습', primary: true, onClick: () => { if (anim) return stop(); bRun.setLabel('정지'); anim = V.loop(() => { for (let i = 0; i < 4; i++) trainStep(); draw(); if (epoch > 3000) { stop(); return false; } }); } });
    ui.button({ label: '초기화', onClick: reset });
    function stop() { if (anim) { anim.stop(); anim = null; } bRun.setLabel('학습'); }
    function reset() { stop(); W = [0, 0, 0, 0]; b = 0; epoch = 0; draw(); }
    c1.el.addEventListener('click', e => { const [x, y] = c1.pos(e); if (!P.inside(x, y)) return; pts.push([P.ix(x), P.iy(y), cls]); draw(); });
    function draw() {
      const pal = V.pal(); c1.size(); c2.size();
      P = V.plot(c1, { x: [-4, 4], y: [-4, 4], equal: true, xlabel: 'x₁', ylabel: 'x₂' });
      const ctx = P.ctx, st = 5;
      for (let py = P.box.y0; py < P.box.y1; py += st) for (let px = P.box.x0; px < P.box.x1; px += st) { ctx.fillStyle = V.cmapCss('prob', prob(P.ix(px + st / 2), P.iy(py + st / 2)), .55); ctx.fillRect(px, py, st, st); }
      P.axes({ zero: false });
      P.clip();
      [[.5, 2.6, []], [.1, 1.2, [5, 4]], [.9, 1.2, [5, 4]]].forEach(([lv, wd, ds]) => {
        const lg = Math.log(lv / (1 - lv));
        ctx.strokeStyle = pal.text; ctx.lineWidth = wd; ctx.setLineDash(ds); ctx.beginPath();
        V.iso((x, y) => { const f = feats(x, y); return W[0] * f[0] + W[1] * f[1] + W[2] * f[2] + W[3] * f[3] + b; }, P.xr, P.yr, lg, 80, 80).forEach(([a, c]) => { ctx.moveTo(P.X(a[0]), P.Y(a[1])); ctx.lineTo(P.X(c[0]), P.Y(c[1])); });
        ctx.stroke(); ctx.setLineDash([]);
      });
      P.unclip();
      pts.forEach(([x, y, c]) => P.dot(x, y, 4.2, c ? pal.series[0] : pal.series[1], pal.surface));
      // 오른쪽: 시그모이드와 점수
      const zs = pts.map(([x, y]) => { const f = feats(x, y); return W[0] * f[0] + W[1] * f[1] + W[2] * f[2] + W[3] * f[3] + b; });
      const zr = Math.max(4, ...zs.map(Math.abs)) * 1.05;
      const Q = V.plot(c2, { x: [-zr, zr], y: [-.08, 1.08], xlabel: '점수 z = w·x + b', ylabel: 'P(y = 1)' }).axes({ zero: false });
      Q.fn(sig, pal.text, 2.2);
      Q.line([[-zr, .5], [zr, .5]], pal.muted, 1, [4, 4]); Q.line([[0, -.08], [0, 1.08]], pal.muted, 1, [4, 4]);
      pts.forEach(([, , c], i) => Q.dot(zs[i], c ? 1.02 - (i % 5) * .012 : -.02 + (i % 5) * .012, 3.2, c ? pal.series[0] : pal.series[1]));
      let loss = 0, acc = 0;
      pts.forEach(([x, y, c]) => { const p = Math.min(Math.max(prob(x, y), 1e-9), 1 - 1e-9); loss += -(c * Math.log(p) + (1 - c) * Math.log(1 - p)); acc += ((p > .5 ? 1 : 0) === c); });
      ui.setRO(`반복 ${epoch}   w = (${W.slice(0, sq ? 4 : 2).map(v => fmt(v, 2)).join(', ')}), b = ${fmt(b, 2)}   평균 BCE = ${fmt(loss / pts.length, 4)}   정확도 = ${(acc / pts.length * 100).toFixed(1)}%`);
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 5. 소프트맥스와 온도 ===== */
  V.register('softmax', el => {
    const cls = ['고양이', '개', '새', '물고기'];
    const ui = V.shell(el, {
      title: '소프트맥스: 점수를 확률분포로',
      desc: '네 클래스의 로짓(점수) $z_k$를 슬라이더로 정한다. 소프트맥스 $p_k = e^{z_k/\\tau}/\\sum_j e^{z_j/\\tau}$가 확률분포를 만든다. 온도 $\\tau$는 분포의 날카로움을 조절한다.',
      how: ['막대: 각 클래스의 확률(합 1). 굵은 테두리가 정답 클래스.', '표: 로짓, 지수값, 확률. 확률은 지수값을 합으로 나눈 것이다.'],
      try: ['모든 로짓에 같은 수를 더해도(예: 전부 +2) 확률이 변하지 않음을 확인한다.', '온도를 0.2로 낮추면 가장 큰 로짓 쪽으로 몰리고(argmax에 가까움), 5로 높이면 균등해진다.', '정답 확률을 0.9 이상으로 만드는 데 로짓 차이가 얼마나 필요한지 본다.']
    });
    const cv = ui.canvas(ui.body, 0, { aspect: .36, minH: 200, maxH: 260 });
    const tbl = document.createElement('div'); ui.body.appendChild(tbl);
    let z = [2, 1, 0.1, -1], tau = 1, tgt = 0;
    z.forEach((v, i) => ui.slider({ label: `z(${cls[i]})`, min: -4, max: 4, step: .1, value: v, fmt: x => x.toFixed(1), onInput: x => { z[i] = x; draw(); } }));
    ui.slider({ label: '온도 τ', min: .1, max: 5, step: .05, value: tau, fmt: x => x.toFixed(2), onInput: x => { tau = x; draw(); } });
    ui.select({ label: '정답', options: cls.map((c, i) => [i, c]), value: 0, onChange: v => { tgt = +v; draw(); } });
    function draw() {
      const pal = V.pal(); cv.size();
      const s = z.map(v => v / tau), m = Math.max(...s), e = s.map(v => Math.exp(v - m)), Z = e.reduce((a, b) => a + b, 0), p = e.map(v => v / Z);
      const P = V.bars(cv, p, { y: [0, 1], labels: cls, ylabel: '확률', colors: p.map((_, i) => i === tgt ? pal.series[0] : V.rgba(pal.series[0], .4)), showValues: true, fmt: v => v.toFixed(2) });
      const bw = (P.box.x1 - P.box.x0) / 4 * .7; P.ctx.strokeStyle = pal.text; P.ctx.lineWidth = 2.4; P.ctx.strokeRect(P.X(tgt) - bw / 2, P.Y(p[tgt]), bw, P.Y(0) - P.Y(p[tgt]));
      const ent = -p.reduce((a, q) => a + (q > 0 ? q * Math.log(q) : 0), 0);
      tbl.innerHTML = `<table style="margin:10px 0 0;font-size:13.5px"><thead><tr><th></th>${cls.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>
        <tr><td>로짓 z</td>${z.map(v => `<td>${v.toFixed(1)}</td>`).join('')}</tr>
        <tr><td>exp(z/τ)</td>${z.map(v => `<td>${fmt(Math.exp(v / tau), 3)}</td>`).join('')}</tr>
        <tr><td>확률 p</td>${p.map(v => `<td><b>${v.toFixed(3)}</b></td>`).join('')}</tr></tbody></table>`;
      ui.setRO(`교차 엔트로피 −ln p(${cls[tgt]}) = ${fmt(-Math.log(p[tgt]), 4)}   분포의 엔트로피 = ${fmt(ent, 3)} (최대 ln 4 = 1.386)`);
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 6. 과적합과 규제 (다항 회귀) ===== */
  V.register('overfit', el => {
    const ui = V.shell(el, {
      title: '과적합: 모델 복잡도와 규제',
      desc: '진짜 함수(회색 점선)에서 잡음 섞인 학습 데이터(초록 점)를 뽑아 다항식으로 맞춘다. 오른쪽은 차수에 따른 학습 오차와 검증 오차다. 검증 오차가 가장 작은 차수가 일반화가 가장 좋은 모델이다.',
      how: ['왼쪽 파란 곡선: 현재 차수와 규제 강도로 맞춘 다항식.', '오른쪽 초록: 학습 MSE, 빨강: 검증 MSE(처음 보는 데이터 200개). 세로 점선이 현재 차수.', '학습 오차는 차수가 오를수록 계속 줄지만, 검증 오차는 U자 모양이다.'],
      try: ['차수를 1 → 3 → 15로 올리며 과소적합 → 적절 → 과적합을 관찰한다.', '차수 15에서 log₁₀ λ를 −8에서 −2로 올려 곡선이 진정되는 것을 본다. 오른쪽 U자 곡선도 같이 변한다.', '데이터 수를 40으로 늘리면 차수 15도 덜 과적합한다. 데이터가 최고의 규제다.']
    });
    const row = ui.row(2);
    const c1 = ui.canvas(ui.panel(row, '데이터와 다항식'), 0, { aspect: .75, maxH: 330 });
    const c2 = ui.canvas(ui.panel(row, '차수에 따른 오차'), 0, { aspect: .75, maxH: 330 });
    let deg = 3, lam = -8, n = 12;
    const truth = x => Math.sin(2.5 * x) * .8 + .25 * x;
    ui.slider({ label: '다항식 차수', min: 1, max: 15, step: 1, value: deg, fmt: v => String(v), onInput: v => { deg = v; draw(); } });
    ui.slider({ label: 'log₁₀ λ (L2 규제)', min: -8, max: 1, step: .5, value: lam, fmt: v => v <= -8 ? '규제 없음' : v.toFixed(1), onInput: v => { lam = v; draw(); } });
    ui.select({ label: '학습 데이터 수', options: [[8, '8'], [12, '12'], [20, '20'], [40, '40']], value: n, onChange: v => { n = +v; draw(); } });
    function fit(X, Y, d, l) {
      const m = d + 1, phi = x => Array.from({ length: m }, (_, k) => x ** k);
      const F = X.map(phi);
      const A = Array.from({ length: m }, (_, i) => Array.from({ length: m }, (_, j) => F.reduce((s, f) => s + f[i] * f[j], 0) + (i === j && i > 0 ? l * X.length : 0)));
      const bv = Array.from({ length: m }, (_, i) => F.reduce((s, f, k) => s + f[i] * Y[k], 0));
      for (let i = 0; i < m; i++) { let p = i; for (let k = i + 1; k < m; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k; [A[i], A[p]] = [A[p], A[i]]; [bv[i], bv[p]] = [bv[p], bv[i]]; const dd = A[i][i] || 1e-12; for (let k = i + 1; k < m; k++) { const f = A[k][i] / dd; for (let j = i; j < m; j++) A[k][j] -= f * A[i][j]; bv[k] -= f * bv[i]; } }
      const w = new Array(m).fill(0); for (let i = m - 1; i >= 0; i--) { let s = bv[i]; for (let j = i + 1; j < m; j++) s -= A[i][j] * w[j]; w[i] = s / (A[i][i] || 1e-12); }
      return x => phi(x).reduce((s, v, k) => s + v * w[k], 0);
    }
    function draw() {
      const pal = V.pal(); c1.size(); c2.size();
      const r = V.rng(11), X = [], Y = [], Xv = [], Yv = [];
      for (let i = 0; i < n; i++) { const x = -1 + 2 * r(); X.push(x); Y.push(truth(x) + V.gauss(r) * .2); }
      const rv = V.rng(99); for (let i = 0; i < 200; i++) { const x = -1 + 2 * rv(); Xv.push(x); Yv.push(truth(x) + V.gauss(rv) * .2); }
      const l = lam <= -8 ? 0 : Math.pow(10, lam);
      const mse = (f, xs, ys) => xs.reduce((s, x, i) => s + (f(x) - ys[i]) ** 2, 0) / xs.length;
      const f = fit(X, Y, deg, l);
      const P = V.plot(c1, { x: [-1.05, 1.05], y: [-1.8, 1.8], xlabel: 'x', ylabel: 'y' }).axes();
      P.fn(truth, pal.muted, 1.6, [5, 5]); P.clip(); P.fn(f, pal.series[0], 2.5); P.unclip();
      X.forEach((x, i) => P.dot(x, Y[i], 4.5, pal.series[2], pal.surface));
      const tr = [], va = [];
      for (let d = 1; d <= 15; d++) { const g = fit(X, Y, d, l); tr.push(mse(g, X, Y)); va.push(mse(g, Xv, Yv)); }
      const cap = v => Math.log10(Math.min(Math.max(v, 1e-4), 1e2));
      const Q = V.plot(c2, { x: [1, 15], y: [-4, 2], xlabel: '다항식 차수', ylabel: 'log₁₀ MSE' }).axes({ xstep: 2 });
      Q.line(tr.map((v, i) => [i + 1, cap(v)]), pal.series[2], 2.2); Q.line(va.map((v, i) => [i + 1, cap(v)]), pal.series[1], 2.2);
      tr.forEach((v, i) => Q.dot(i + 1, cap(v), 3, pal.series[2])); va.forEach((v, i) => Q.dot(i + 1, cap(v), 3, pal.series[1]));
      Q.line([[deg, -4], [deg, 2]], pal.text, 1.2, [4, 4]);
      Q.label(deg, 1.7, '현재 ' + deg + '차', { dx: 5, color: pal.text });
      const best = va.indexOf(Math.min(...va)) + 1, cx = c2.ctx;
      cx.beginPath(); cx.arc(Q.X(best), Q.Y(cap(va[best - 1])), 8, 0, 7); cx.strokeStyle = pal.series[1]; cx.lineWidth = 2; cx.stroke();
      Q.label(best, cap(va[best - 1]), '검증 최소 ' + best + '차', { dy: 20, align: 'center', color: pal.series[1], bold: true });
      ui.setRO(`차수 ${deg}   λ = ${l ? l.toExponential(1) : 0}   학습 MSE = ${fmt(tr[deg - 1], 4)}   검증 MSE = ${fmt(va[deg - 1], 4)}   검증이 가장 낮은 차수 = ${best}`);
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 7. 임계값과 정밀도·재현율·ROC ===== */
  V.register('threshold', el => {
    const ui = V.shell(el, {
      title: '분류 임계값: 정밀도, 재현율, ROC 곡선',
      desc: '모델이 음성(빨강)과 양성(파랑) 샘플에 매긴 점수의 분포다. 점수가 임계값보다 크면 양성으로 판정한다. 임계값을 옮기면 네 가지 결과(TP, FP, FN, TN)의 개수가 바뀐다.',
      how: ['왼쪽: 두 클래스의 점수 분포(넓이 = 샘플 수). 세로선 오른쪽이 양성 판정이다.', '가운데 표: 혼동 행렬. 오른쪽: 임계값을 바꿔 가며 그린 ROC 곡선과 현재 지점.', 'ROC 아래 넓이(AUC)는 두 분포가 얼마나 잘 갈라지는지를 나타낸다.'],
      try: ['임계값을 오른쪽으로 옮기면 정밀도는 오르고 재현율은 내려간다. 반대도 확인한다.', '양성 비율을 5%로 낮춘다. 같은 모델인데 정밀도가 크게 떨어진다. 6일차의 질병 검사 예제와 같은 현상이다.', '분리 정도를 0으로 만들면 ROC가 대각선(AUC 0.5, 무작위 추측)이 된다.']
    });
    const row = ui.row(2);
    const c1 = ui.canvas(ui.panel(row, '점수 분포'), 0, { aspect: .72, maxH: 300 });
    const c2 = ui.canvas(ui.panel(row, 'ROC 곡선'), 0, { aspect: .72, maxH: 300 });
    const tbl = document.createElement('div'); ui.body.appendChild(tbl);
    let sep = 2, prev = .3, th = .5;
    ui.slider({ label: '분리 정도', min: 0, max: 4, step: .1, value: sep, fmt: v => v.toFixed(1), onInput: v => { sep = v; draw(); } });
    ui.slider({ label: '양성 비율', min: .02, max: .5, step: .01, value: prev, fmt: v => (v * 100).toFixed(0) + '%', onInput: v => { prev = v; draw(); } });
    ui.slider({ label: '임계값', min: -4, max: 5, step: .05, value: th, fmt: v => v.toFixed(2), onInput: v => { th = v; draw(); } });
    const N = 1000, Phi = x => .5 * (1 + erf(x / Math.SQRT2));
    function erf(x) { const t = 1 / (1 + .3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x); return Math.sign(x) * y; }
    function draw() {
      const pal = V.pal(); c1.size(); c2.size();
      const nP = N * prev, nN = N - nP, muN = -sep / 2, muP = sep / 2;
      const pdf = (x, m) => Math.exp(-((x - m) ** 2) / 2) / Math.sqrt(2 * Math.PI);
      const P = V.plot(c1, { x: [-4.5, 5], y: [0, Math.max(nN, nP) * .42], xlabel: '모델 점수', ylabel: '샘플 밀도' }).axes({ yfmt: () => '' });
      const ctx = P.ctx;
      const fill = (m, n, col, from, to) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(P.X(from), P.Y(0)); for (let x = from; x <= to; x += .02) ctx.lineTo(P.X(x), P.Y(n * pdf(x, m))); ctx.lineTo(P.X(to), P.Y(0)); ctx.closePath(); ctx.fill(); };
      fill(muN, nN, V.rgba(pal.series[1], .18), -4.5, th); fill(muN, nN, V.rgba(pal.series[1], .45), th, 5);
      fill(muP, nP, V.rgba(pal.series[0], .45), th, 5); fill(muP, nP, V.rgba(pal.series[0], .18), -4.5, th);
      P.fn(x => nN * pdf(x, muN), pal.series[1], 2); P.fn(x => nP * pdf(x, muP), pal.series[0], 2);
      P.line([[th, 0], [th, P.yr[1]]], pal.text, 2);
      P.label(th, P.yr[1] * .92, '양성 판정 →', { dx: 8, color: pal.text });
      const TP = nP * (1 - Phi(th - muP)), FN = nP - TP, FP = nN * (1 - Phi(th - muN)), TN = nN - FP;
      const prec = TP / (TP + FP || 1), rec = TP / (nP || 1), fpr = FP / (nN || 1), f1 = 2 * prec * rec / (prec + rec || 1);
      const Q = V.plot(c2, { x: [0, 1], y: [0, 1], xlabel: '위양성률 FPR = FP / 음성', ylabel: '재현율 = TP / 양성' }).axes();
      Q.line([[0, 0], [1, 1]], pal.muted, 1, [4, 4]);
      const roc = []; for (let t = 6; t >= -6; t -= .05) roc.push([1 - Phi(t - muN), 1 - Phi(t - muP)]);
      Q.line(roc, pal.series[0], 2.4); Q.dot(fpr, rec, 6, pal.bad, pal.surface);
      const auc = Phi(sep / Math.SQRT2);
      tbl.innerHTML = `<table style="margin:10px 0 0;font-size:13.5px;max-width:520px"><thead><tr><th></th><th>실제 양성</th><th>실제 음성</th></tr></thead><tbody>
        <tr><td><b>양성 판정</b></td><td>TP ${TP.toFixed(0)}</td><td>FP ${FP.toFixed(0)}</td></tr>
        <tr><td><b>음성 판정</b></td><td>FN ${FN.toFixed(0)}</td><td>TN ${TN.toFixed(0)}</td></tr></tbody></table>`;
      ui.setRO(`정확도 ${((TP + TN) / N * 100).toFixed(1)}%   정밀도 ${(prec * 100).toFixed(1)}%   재현율 ${(rec * 100).toFixed(1)}%   F1 ${f1.toFixed(3)}   FPR ${(fpr * 100).toFixed(1)}%   AUC ${auc.toFixed(3)}`);
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 8. k-최근접 이웃 ===== */
  V.register('knn', el => {
    const ui = V.shell(el, {
      title: 'k-최근접 이웃과 특징 스케일',
      desc: '각 위치를 가장 가까운 학습 점 $k$개의 다수결로 분류한 결정 영역이다. 학습은 데이터를 저장하는 것뿐이고, 예측 때 거리를 계산한다. 클릭하면 선택한 클래스의 점이 추가된다.',
      how: ['배경색: 그 위치에 점을 놓았을 때의 예측 클래스. 점: 학습 데이터.', '"스케일 불균형"에서는 가로축이 0~100, 세로축이 0~1 범위다. 거리 계산이 가로축에 지배된다.'],
      try: ['$k=1$이면 경계가 들쭉날쭉하다(과적합). $k$를 키우면 매끄러워지지만 너무 크면 작은 무리를 무시한다(과소적합).', '"스케일 불균형" 데이터에서 표준화를 끄고 켜며 결정 영역을 비교한다. 거리 기반 모델에 스케일링이 필수인 이유다.']
    });
    const cv = ui.canvas(ui.body, 0, { aspect: .62, maxH: 420 });
    const r = V.rng(4);
    const make = kind => {
      const pts = [];
      if (kind === 'three') { const cs = [[-1.5, -1], [1.5, -1], [0, 1.5]]; for (let i = 0; i < 60; i++) { const c = i % 3; pts.push([cs[c][0] + V.gauss(r) * .8, cs[c][1] + V.gauss(r) * .8, c]); } }
      else { for (let i = 0; i < 60; i++) { const c = i % 2; pts.push([20 + 60 * r(), c ? .65 + V.gauss(r) * .1 : .35 + V.gauss(r) * .1, c]); } }
      return pts;
    };
    let kind = 'three', pts = make(kind), k = 5, std = true, cls = 0, P;
    ui.select({ label: '데이터', options: [['three', '세 무리'], ['scale', '스케일 불균형 (x: 0~100, y: 0~1)']], value: kind, onChange: v => { kind = v; pts = make(v); draw(); } });
    ui.slider({ label: 'k', min: 1, max: 25, step: 1, value: k, fmt: v => String(v), onInput: v => { k = v; draw(); } });
    ui.toggle({ label: '표준화', value: true, onChange: v => { std = v; draw(); } });
    ui.select({ label: '추가할 클래스', options: [[0, '0'], [1, '1'], [2, '2']], value: 0, onChange: v => { cls = +v; } });
    cv.el.addEventListener('click', e => { const [x, y] = cv.pos(e); if (!P.inside(x, y)) return; pts.push([P.ix(x), P.iy(y), cls]); draw(); });
    function draw() {
      const pal = V.pal(); cv.size();
      const xr = kind === 'three' ? [-4, 4] : [0, 100], yr = kind === 'three' ? [-3.5, 4] : [0, 1];
      P = V.plot(cv, { x: xr, y: yr, xlabel: kind === 'three' ? 'x₁' : 'x₁ (범위 0~100)', ylabel: kind === 'three' ? 'x₂' : 'x₂ (범위 0~1)' });
      const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const sx = std ? Math.sqrt(pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0) / pts.length) || 1 : 1, sy = std ? Math.sqrt(pts.reduce((s, p) => s + (p[1] - my) ** 2, 0) / pts.length) || 1 : 1;
      const T = pts.map(([x, y, c]) => [(x - mx) / sx, (y - my) / sy, c]);
      const predict = (x, y) => {
        const qx = (x - mx) / sx, qy = (y - my) / sy;
        const d = T.map(([a, b, c]) => [(a - qx) ** 2 + (b - qy) ** 2, c]).sort((u, v) => u[0] - v[0]).slice(0, Math.min(k, T.length));
        const cnt = [0, 0, 0]; d.forEach(([, c]) => cnt[c]++); return cnt.indexOf(Math.max(...cnt));
      };
      const ctx = P.ctx, st = 4;
      P.clip();
      for (let py = P.box.y0; py < P.box.y1; py += st) for (let px = P.box.x0; px < P.box.x1; px += st) { ctx.fillStyle = V.rgba(pal.series[predict(P.ix(px + st / 2), P.iy(py + st / 2))], .22); ctx.fillRect(px, py, Math.min(st, P.box.x1 - px), Math.min(st, P.box.y1 - py)); }
      P.unclip();
      P.axes({ zero: false });
      pts.forEach(([x, y, c]) => P.dot(x, y, 4.2, pal.series[c], pal.surface));
      let correct = 0; pts.forEach(([x, y, c], i) => { const sv = T.splice(i, 1)[0]; correct += predict(x, y) === c; T.splice(i, 0, sv); });
      ui.setRO(`k = ${k}   표준화 ${std ? '켬' : '끔'}   한 점 빼기 교차검증 정확도 = ${(correct / pts.length * 100).toFixed(1)}%`);
    }
    draw(); V.onEnv(el, draw);
  });

  V.modsReady.push('w2');
})();
