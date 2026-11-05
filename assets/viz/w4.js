/* 4주차 시각화: 옵티마이저 경주, 지수 이동 평균, 학습률 스케줄, 초기화와 활성값 분포, 배치 정규화, 드롭아웃 */
(function () {
  'use strict';
  const fmt = V.fmt;
  const text = (ctx, s, x, y, o = {}) => {
    const pal = V.pal();
    ctx.font = o.font || (o.bold ? V.FONT_B : V.FONT); ctx.fillStyle = o.color || pal.text;
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.base || 'middle'; ctx.fillText(s, x, y); ctx.textBaseline = 'alphabetic';
  };

  /* ===== 1. 옵티마이저 경주 ===== */
  const OPTS = [
    { k: 'sgd', name: 'SGD', ci: 5 },
    { k: 'mom', name: '모멘텀', ci: 0 },
    { k: 'nest', name: '네스테로프', ci: 4 },
    { k: 'adagrad', name: 'AdaGrad', ci: 2 },
    { k: 'rms', name: 'RMSProp', ci: 3 },
    { k: 'adam', name: 'Adam', ci: 1 }
  ];
  const LAND4 = {
    valley: { name: '길쭉한 골짜기 (조건수 25)', f: (x, y) => .5 * (.2 * x * x + 5 * y * y), g: (x, y) => [.2 * x, 5 * y], xr: [-5, 5], yr: [-2.5, 2.5], st: [-4.5, 2], lr: { sgd: .1, mom: .1, nest: .1, adagrad: .8, rms: .05, adam: .1 } },
    rosen: { name: '바나나 골짜기 (로젠브록)', f: (x, y) => (1 - x) ** 2 + 10 * (y - x * x) ** 2, g: (x, y) => [-2 * (1 - x) - 40 * x * (y - x * x), 20 * (y - x * x)], xr: [-2, 2], yr: [-1, 3], st: [-1.5, 2.5], lr: { sgd: .005, mom: .005, nest: .005, adagrad: .4, rms: .01, adam: .05 } },
    saddle: { name: '안장점', f: (x, y) => .5 * x * x - .4 * y * y + .06 * y ** 4 + 2.5, g: (x, y) => [x, -.8 * y + .24 * y ** 3], xr: [-3, 3], yr: [-3.5, 3.5], st: [-2.6, .02], lr: { sgd: .1, mom: .1, nest: .1, adagrad: .4, rms: .05, adam: .1 } },
    bumpy: { name: '울퉁불퉁 (국소 최솟값)', f: (x, y) => .08 * (x * x + y * y) - .6 * Math.cos(2.2 * x) * Math.cos(2.2 * y) + .6, g: (x, y) => [.16 * x + 1.32 * Math.sin(2.2 * x) * Math.cos(2.2 * y), .16 * y + 1.32 * Math.cos(2.2 * x) * Math.sin(2.2 * y)], xr: [-4, 4], yr: [-4, 4], st: [-3.3, 2.9], lr: { sgd: .1, mom: .1, nest: .1, adagrad: .5, rms: .05, adam: .1 } }
  };
  function makeOpt(k, lr) {
    const st = { v: [0, 0], s: [0, 0], m: [0, 0], t: 0 };
    return (p, grad) => {
      const g = grad(p[0], p[1]); st.t++;
      if (k === 'sgd') return [p[0] - lr * g[0], p[1] - lr * g[1]];
      if (k === 'mom') { st.v = [.9 * st.v[0] + g[0], .9 * st.v[1] + g[1]]; return [p[0] - lr * st.v[0], p[1] - lr * st.v[1]]; }
      if (k === 'nest') { const la = grad(p[0] - lr * .9 * st.v[0], p[1] - lr * .9 * st.v[1]); st.v = [.9 * st.v[0] + la[0], .9 * st.v[1] + la[1]]; return [p[0] - lr * st.v[0], p[1] - lr * st.v[1]]; }
      if (k === 'adagrad') { st.s = [st.s[0] + g[0] ** 2, st.s[1] + g[1] ** 2]; return [p[0] - lr * g[0] / (Math.sqrt(st.s[0]) + 1e-8), p[1] - lr * g[1] / (Math.sqrt(st.s[1]) + 1e-8)]; }
      if (k === 'rms') { st.s = [.9 * st.s[0] + .1 * g[0] ** 2, .9 * st.s[1] + .1 * g[1] ** 2]; return [p[0] - lr * g[0] / (Math.sqrt(st.s[0]) + 1e-8), p[1] - lr * g[1] / (Math.sqrt(st.s[1]) + 1e-8)]; }
      st.m = [.9 * st.m[0] + .1 * g[0], .9 * st.m[1] + .1 * g[1]]; st.s = [.999 * st.s[0] + .001 * g[0] ** 2, .999 * st.s[1] + .001 * g[1] ** 2];
      const c1 = 1 - .9 ** st.t, c2 = 1 - .999 ** st.t;
      return [p[0] - lr * (st.m[0] / c1) / (Math.sqrt(st.s[0] / c2) + 1e-8), p[1] - lr * (st.m[1] / c1) / (Math.sqrt(st.s[1] / c2) + 1e-8)];
    };
  }
  V.register('optim', el => {
    const ui = V.shell(el, {
      title: '옵티마이저 경주: 같은 지형, 다른 걸음',
      desc: '여섯 가지 옵티마이저가 같은 출발점에서 동시에 출발한다. 등고선 지도의 선 위 숫자는 손실 값이고, 오른쪽은 걸음 수에 따른 손실(로그 눈금)이다. 지도를 클릭하면 출발점이 바뀐다.',
      how: ['색 경로 하나가 옵티마이저 하나다. 범례의 색을 본다. 별표는 최솟값이다.', '학습률은 지형마다 옵티마이저별로 적당히 정한 값에 "학습률 배율"을 곱해 쓴다. SGD 계열과 적응형(AdaGrad, RMSProp, Adam)은 학습률의 의미가 달라 같은 숫자를 쓰지 않는다.', '모멘텀 계열은 관성 때문에 목표를 지나쳤다가 돌아오고, 적응형은 축마다 보폭을 따로 맞춘다.'],
      try: ['길쭉한 골짜기: SGD는 가파른 축(세로)으로 진동하고 완만한 축(가로)으로 느리다. 모멘텀은 가로 방향 속도가 쌓여 훨씬 빨리 간다.', '바나나 골짜기: 골짜기 바닥이 휘어 있다. SGD는 바닥을 따라 아주 느리게 기어가고, Adam은 축별 보폭 조절로 빠르게 따라간다.', '안장점: 출발점이 가운데 선 근처면 SGD는 오래 머문다. 모멘텀과 Adam은 빨리 빠져나간다.', '울퉁불퉁: 모멘텀은 작은 언덕을 관성으로 넘어 더 깊은 골짜기에 닿기도 한다. 출발점을 바꿔 가며 본다.']
    });
    const row = ui.row(2);
    const c1 = ui.canvas(ui.panel(row, '등고선 지도 (클릭: 출발점)'), 0, { aspect: .86, maxH: 430 });
    const c2 = ui.canvas(ui.panel(row, '손실 대 걸음 수'), 0, { aspect: .86, maxH: 430 });
    const leg = document.createElement('div'); leg.className = 'legend'; ui.body.appendChild(leg);
    let key = 'valley', S = LAND4[key], mult = 1, start = S.st.slice(), on = new Set(OPTS.map(o => o.k)), paths = {}, steppers = {}, anim = null, P, info;
    function reset() { stop(); OPTS.forEach(o => { paths[o.k] = [start.slice()]; steppers[o.k] = makeOpt(o.k, S.lr[o.k] * mult); }); draw(); }
    function step() {
      OPTS.forEach(o => {
        const pth = paths[o.k], cur = pth[pth.length - 1];
        if (!isFinite(cur[0]) || Math.abs(cur[0]) > 1e3 || Math.abs(cur[1]) > 1e3) return;
        pth.push(steppers[o.k](cur, S.g));
      });
    }
    ui.select({ label: '지형', options: Object.entries(LAND4).map(([k, v]) => [k, v.name]), value: key, onChange: v => { key = v; S = LAND4[v]; start = S.st.slice(); reset(); } });
    ui.slider({ label: '학습률 배율', min: -2, max: 2, step: 1, value: 0, fmt: v => '×' + (2 ** v), onInput: v => { mult = 2 ** v; reset(); } });
    const bRun = ui.button({ label: '실행', primary: true, onClick: () => { if (anim) return stop(); if (paths.sgd.length > 300) reset(); bRun.setLabel('정지'); anim = V.loop(() => { step(); step(); draw(); if (paths.sgd.length > 300) { stop(); return false; } }); } });
    ui.button({ label: '10걸음', onClick: () => { for (let i = 0; i < 10; i++) step(); draw(); } });
    ui.button({ label: '초기화', onClick: reset });
    OPTS.forEach(o => ui.toggle({ label: o.name, value: true, onChange: v => { v ? on.add(o.k) : on.delete(o.k); draw(); } }));
    function stop() { if (anim) { anim.stop(); anim = null; } bRun.setLabel('실행'); }
    c1.el.addEventListener('click', e => { const [x, y] = c1.pos(e); if (!P || !P.inside(x, y)) return; start = [P.ix(x), P.iy(y)]; reset(); });
    function minimum() { let best = [0, 0], bv = Infinity; for (let i = 0; i <= 80; i++) for (let j = 0; j <= 80; j++) { const a = S.xr[0] + (S.xr[1] - S.xr[0]) * i / 80, b = S.yr[0] + (S.yr[1] - S.yr[0]) * j / 80, v = S.f(a, b); if (v < bv) { bv = v; best = [a, b]; } } return best; }
    function draw() {
      const pal = V.pal(); c1.size(); c2.size();
      const col = o => pal.series[o.ci];
      leg.innerHTML = OPTS.filter(o => on.has(o.k)).map(o => `<span><i style="background:${col(o)}"></i>${o.name} (η = ${fmt(S.lr[o.k] * mult, 3)})</span>`).join('');
      P = V.plot(c1, { x: S.xr, y: S.yr, xlabel: 'w₁', ylabel: 'w₂', pad: { r: 62 } });
      info = V.contour(P, S.f, { n: 10 });
      P.axes({ zero: false });
      V.colorbar(P.ctx, P.box.x1 + 10, P.box.y0 + 20, 12, P.box.y1 - P.box.y0 - 40, info, '손실');
      P.clip();
      const m = minimum(); text(P.ctx, '★', P.X(m[0]), P.Y(m[1]), { font: '16px sans-serif' });
      OPTS.filter(o => on.has(o.k)).forEach(o => { const pth = paths[o.k].filter(p => isFinite(p[0]) && Math.abs(p[0]) < 1e3); P.line(pth, col(o), 2); const c = pth[pth.length - 1]; P.dot(c[0], c[1], 5, col(o), pal.surface); });
      P.unclip();
      P.dot(start[0], start[1], 5, pal.text);
      const n = Math.max(50, paths.sgd.length);
      const vals = OPTS.filter(o => on.has(o.k)).map(o => paths[o.k].map(p => Math.max(S.f(p[0], p[1]) - S.f(m[0], m[1]), 1e-8)));
      const all = vals.flat().filter(isFinite); if (!all.length) all.push(1);
      const hi = Math.log10(Math.max(...all, 1e-6)) + .3, lo = Math.max(-8, Math.log10(Math.min(...all)) - .3);
      const Q = V.plot(c2, { x: [0, n], y: [Math.floor(lo), Math.ceil(hi)], xlabel: '걸음 수', ylabel: 'log₁₀(손실 − 최솟값)' }).axes({ zero: false, ystep: Math.ceil(hi) - Math.floor(lo) > 6 ? 2 : 1 });
      Q.clip(); OPTS.filter(o => on.has(o.k)).forEach((o, i) => Q.line(vals[i].map((v, t) => [t, Math.log10(v)]).filter(p => isFinite(p[1])), col(o), 2)); Q.unclip();
      const fin = OPTS.filter(o => on.has(o.k)).map(o => { const c = paths[o.k][paths[o.k].length - 1]; const v = S.f(c[0], c[1]); return `${o.name} ${isFinite(v) && Math.abs(c[0]) < 1e3 ? fmt(v, 3) : '발산'}`; });
      ui.setRO(`걸음 ${paths.sgd.length - 1}   손실: ${fin.join('  ')}`);
    }
    reset(); V.onEnv(el, draw);
  });

  /* ===== 2. 지수 이동 평균 ===== */
  V.register('ema', el => {
    const ui = V.shell(el, {
      title: '지수 이동 평균: 잡음 섞인 신호의 부드러운 추세',
      desc: '회색 점은 잡음이 섞인 측정값(예: 미니배치 손실)이다. 지수 이동 평균 $m_t = \\beta m_{t-1} + (1-\\beta)x_t$는 최근 약 $1/(1-\\beta)$개를 평균한 것처럼 동작한다. $m_0 = 0$에서 시작하므로 초반 값이 0 쪽으로 치우치는데, $1-\\beta^t$로 나누는 편향 보정이 이를 바로잡는다.',
      how: ['회색 점: 원래 값. 파란 선: 지수 이동 평균. 주황 점선: 편향 보정한 평균. 검은 점선: 잡음 없는 실제 추세.', 'β가 클수록 부드럽지만 변화에 늦게 반응한다(지연).'],
      try: ['β = 0.9에서 처음 10걸음의 파란 선이 실제 값보다 훨씬 낮게 출발하는 것을 확인하고, 편향 보정을 켠다.', 'β = 0.99로 올리면 초반 편향이 매우 커진다. Adam의 2차 모멘트(β₂ = 0.999)가 편향 보정 없이 쓰이면 어떻게 될지 생각한다.', 'β를 0.5로 낮추면 잡음을 거의 걸러내지 못한다.']
    });
    const cv = ui.canvas(ui.body, 0, { aspect: .42, minH: 230, maxH: 340 });
    let beta = .9, corr = true;
    const N = 200, r = V.rng(4), trend = t => 2 * Math.exp(-t / 50) + .4, xs = Array.from({ length: N }, (_, t) => trend(t + 1) + V.gauss(r) * .35);
    ui.slider({ label: 'β', min: 0, max: .99, step: .01, value: beta, fmt: v => v.toFixed(2), onInput: v => { beta = v; draw(); } });
    ui.toggle({ label: '편향 보정 표시', value: corr, onChange: v => { corr = v; draw(); } });
    function draw() {
      const pal = V.pal(); cv.size();
      const P = V.plot(cv, { x: [0, N], y: [-.5, 3.4], xlabel: '걸음 t', ylabel: '값' }).axes({ zero: false });
      xs.forEach((v, t) => P.dot(t + 1, v, 2, V.rgba(pal.muted.startsWith('#') ? pal.muted : '#888888', .7)));
      P.fn(t => trend(t), pal.text, 1.4, [4, 4], [1, N]);
      let m = 0; const em = [], ec = [];
      xs.forEach((v, t) => { m = beta * m + (1 - beta) * v; em.push([t + 1, m]); ec.push([t + 1, m / (1 - beta ** (t + 1))]); });
      P.line(em, pal.series[0], 2.4);
      if (corr) P.line(ec, pal.series[3], 2.2, [6, 4]);
      ui.setRO(`β = ${beta.toFixed(2)}: 유효 창 크기 ≈ 1/(1 − β) = ${fmt(1 / (1 - beta), 3)}걸음   t = 5에서 평균 ${fmt(em[4][1], 3)}, 보정 ${fmt(ec[4][1], 3)}, 실제 ${fmt(trend(5), 3)}`);
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 3. 학습률 스케줄 ===== */
  const SCHED = [
    { k: 'const', name: '일정', ci: 5, f: (t, T, W, a) => a },
    { k: 'step', name: '계단 감쇠', ci: 2, f: (t, T, W, a) => a * Math.pow(.1, Math.floor(t / (T / 3))) },
    { k: 'cos', name: '코사인', ci: 0, f: (t, T, W, a) => a * .5 * (1 + Math.cos(Math.PI * t / T)) },
    { k: 'wcos', name: '워밍업 + 코사인', ci: 1, f: (t, T, W, a) => t < W ? a * (t + 1) / W : a * .5 * (1 + Math.cos(Math.PI * (t - W) / Math.max(1, T - W))) },
    { k: 'one', name: '원사이클', ci: 4, f: (t, T, W, a) => { const up = Math.round(.3 * T); return t < up ? a / 25 + (a - a / 25) * t / up : a * .5 * (1 + Math.cos(Math.PI * (t - up) / (T - up))) + 1e-4 * a; } }
  ];
  V.register('lr-schedule', el => {
    const ui = V.shell(el, {
      title: '학습률 스케줄과 잡음 섞인 경사하강법',
      desc: '왼쪽은 걸음에 따른 학습률, 오른쪽은 그 학습률로 잡음 섞인 그래디언트(미니배치 SGD를 흉내 냄)를 따라 2차 함수 손실을 줄인 결과다. 잡음 때문에 학습률이 일정하면 손실이 어느 높이 아래로 내려가지 못한다.',
      how: ['오른쪽 곡선은 보기 쉽게 최근 10걸음의 이동 평균을 그렸다(로그 눈금).', '모든 스케줄이 같은 잡음 수열을 쓴다. 차이는 학습률뿐이다.', '처음 학습률이 너무 크면 발산한다. 워밍업은 처음 몇 걸음을 작은 학습률로 시작해 이를 막는다.'],
      try: ['"일정"과 "코사인"을 비교한다. 초반 하강 속도는 비슷하고, 후반에 학습률이 줄어든 코사인이 더 낮은 손실에 닿는다.', '최대 학습률을 1.8 근처로 올린다. 워밍업이 있는 스케줄과 없는 스케줄의 초반을 비교한다.', '잡음을 0으로 하면 일정한 학습률도 계속 내려간다. 학습률 감쇠는 잡음과의 싸움이다.']
    });
    const row = ui.row(2);
    const c1 = ui.canvas(ui.panel(row, '학습률 η(t)'), 0, { aspect: .75, maxH: 330 });
    const c2 = ui.canvas(ui.panel(row, '손실 (이동 평균, 로그)'), 0, { aspect: .75, maxH: 330 });
    const leg = document.createElement('div'); leg.className = 'legend'; ui.body.appendChild(leg);
    let T = 300, W = 30, a = .8, sigma = 1, on = new Set(['const', 'cos', 'wcos']);
    ui.slider({ label: '최대 학습률', min: .1, max: 2.2, step: .05, value: a, fmt: v => v.toFixed(2), onInput: v => { a = v; draw(); } });
    ui.slider({ label: '워밍업 걸음', min: 0, max: 100, step: 5, value: W, fmt: v => String(v), onInput: v => { W = v; draw(); } });
    ui.slider({ label: '그래디언트 잡음 σ', min: 0, max: 2, step: .1, value: sigma, fmt: v => v.toFixed(1), onInput: v => { sigma = v; draw(); } });
    SCHED.forEach(s => ui.toggle({ label: s.name, value: on.has(s.k), onChange: v => { v ? on.add(s.k) : on.delete(s.k); draw(); } }));
    function run(s) {
      const r = V.rng(17), A = [1, .3]; let th = [4, -4]; const out = []; let avg = null;
      for (let t = 0; t < T; t++) {
        const lr = s.f(t, T, W, a), g = [A[0] * th[0] + sigma * V.gauss(r), A[1] * th[1] + sigma * V.gauss(r)];
        th = [th[0] - lr * g[0], th[1] - lr * g[1]];
        let L = .5 * (A[0] * th[0] ** 2 + A[1] * th[1] ** 2); if (!isFinite(L) || L > 1e6) L = 1e6;
        avg = avg === null ? L : .9 * avg + .1 * L; out.push(avg);
      }
      return out;
    }
    function draw() {
      const pal = V.pal(); c1.size(); c2.size();
      const act = SCHED.filter(s => on.has(s.k)), col = s => pal.series[s.ci];
      leg.innerHTML = act.map(s => `<span><i style="background:${col(s)}"></i>${s.name}</span>`).join('');
      const P = V.plot(c1, { x: [0, T], y: [0, a * 1.1], xlabel: '걸음 t', ylabel: 'η' }).axes({ zero: false });
      act.forEach(s => P.line(Array.from({ length: T }, (_, t) => [t, s.f(t, T, W, a)]), col(s), 2.2));
      const res = act.map(s => run(s));
      const Q = V.plot(c2, { x: [0, T], y: [-3, 1.5], xlabel: '걸음 t', ylabel: 'log₁₀ 손실' }).axes({ zero: false });
      Q.clip(); res.forEach((r2, i) => Q.line(r2.map((v, t) => [t, Math.log10(Math.max(v, 1e-6))]), col(act[i]), 2)); Q.unclip();
      ui.setRO('마지막 30걸음 평균 손실: ' + act.map((s, i) => { const tail = res[i].slice(-30); const m = tail.reduce((x, y) => x + y, 0) / tail.length; return `${s.name} ${m > 1e5 ? '발산' : fmt(m, 3)}`; }).join('   '));
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 4. 초기화와 활성값 분포 ===== */
  V.register('init', el => {
    const ui = V.shell(el, {
      title: '가중치 초기화와 층별 활성값·기울기',
      desc: '폭 128인 은닉층을 깊게 쌓은 신경망에 표준정규분포 입력 128개를 넣고, 층마다 활성값의 분포와 표준편차, 그리고 역전파한 기울기의 표준편차를 잰다. 초기화가 맞지 않으면 신호가 층을 지나며 사라지거나 폭발한다.',
      how: ['왼쪽: 층에 따른 활성값 표준편차(파랑)와 기울기 표준편차(빨강), 로그 눈금. 수평에 가까울수록 신호가 잘 보존된다.', '오른쪽: 층마다 활성값의 히스토그램. 한 줄이 한 층이며 위가 첫 층이다.', '기울기는 출력에 무작위 상류 기울기를 넣어 입력 쪽으로 역전파한 것이다.'],
      try: ['tanh + 작은 초기화(0.01): 활성값이 층마다 줄어 10층에서 10⁻¹⁰ 수준이 되고, 기울기도 입력 쪽으로 갈수록 사라진다.', 'tanh + 큰 초기화(1.0): 활성값이 −1과 1에 몰린다(포화). 역전파 기울기는 오히려 입력 쪽으로 갈수록 커진다(폭발). 큰 가중치를 곱하는 효과가 포화로 줄어드는 효과보다 크기 때문이다.', 'ReLU + He: 10층까지 표준편차가 거의 일정하다. tanh + Xavier는 천천히 줄어든다.', 'ReLU + Xavier: 층마다 표준편차가 약 1/√2배(분산 절반)가 되어 10층에서 0.03 수준이 된다. He 초기화가 분산에 2를 곱하는 이유다.']
    });
    const row = ui.row(2);
    const c1 = ui.canvas(ui.panel(row, '층별 표준편차'), 0, { aspect: .8, maxH: 360 });
    const c2 = ui.canvas(ui.panel(row, '층별 활성값 분포'), 0, { aspect: .8, maxH: 360 });
    let initK = 'xavier', actK = 'tanh', depth = 10;
    const INIT = { small: ['작게 (0.01)', () => .01], xavier: ['Xavier √(1/n)', n => Math.sqrt(1 / n)], he: ['He √(2/n)', n => Math.sqrt(2 / n)], large: ['크게 (1.0)', () => 1] };
    const ACTF = { tanh: [Math.tanh, a => 1 - a * a], relu: [z => z > 0 ? z : 0, a => a > 0 ? 1 : 0], sigmoid: [z => 1 / (1 + Math.exp(-z)), a => a * (1 - a)] };
    ui.select({ label: '초기화', options: Object.entries(INIT).map(([k, v]) => [k, v[0]]), value: initK, onChange: v => { initK = v; compute(); } });
    ui.select({ label: '활성화', options: [['tanh', 'tanh'], ['relu', 'ReLU'], ['sigmoid', '시그모이드']], value: actK, onChange: v => { actK = v; compute(); } });
    ui.slider({ label: '깊이', min: 2, max: 20, step: 1, value: depth, fmt: v => v + '층', onInput: v => { depth = v; compute(); } });
    let res = null;
    function compute() {
      const n = 128, B = 128, r = V.rng(7), std = INIT[initK][1](n), [phi, dphi] = ACTF[actK];
      let A = Array.from({ length: B }, () => Float64Array.from({ length: n }, () => V.gauss(r)));
      const Ws = [], As = [], aStd = [];
      for (let l = 0; l < depth; l++) {
        const W = Array.from({ length: n }, () => Float64Array.from({ length: n }, () => V.gauss(r) * std)); Ws.push(W);
        const Z = A.map(a => { const z = new Float64Array(n); for (let i = 0; i < n; i++) { const ai = a[i]; if (ai === 0) continue; const Wi = W[i]; for (let j = 0; j < n; j++) z[j] += ai * Wi[j]; } return z; });
        A = Z.map(z => z.map(phi)); As.push(A);
        let s = 0, s2 = 0; A.forEach(a => a.forEach(v => { s += v; s2 += v * v; })); const m = s / (B * n); aStd.push(Math.sqrt(Math.max(s2 / (B * n) - m * m, 0)));
      }
      let G = Array.from({ length: B }, () => Float64Array.from({ length: n }, () => V.gauss(r))); const gStd = new Array(depth);
      for (let l = depth - 1; l >= 0; l--) {
        const W = Ws[l], A_ = As[l];
        const dZ = G.map((g, b) => g.map((v, j) => v * dphi(A_[b][j])));
        let s2 = 0; dZ.forEach(d => d.forEach(v => { s2 += v * v; })); gStd[l] = Math.sqrt(s2 / (B * n));
        G = dZ.map(d => { const o = new Float64Array(n); for (let i = 0; i < n; i++) { const Wi = W[i]; let s = 0; for (let j = 0; j < n; j++) s += d[j] * Wi[j]; o[i] = s; } return o; });
      }
      res = { aStd, gStd, As }; draw();
    }
    function draw() {
      if (!res) return;
      const pal = V.pal(); c1.size(); c2.size();
      const lg = v => Math.log10(Math.max(v, 1e-12));
      const vals = [...res.aStd, ...res.gStd].map(lg), lo = Math.max(-12, Math.floor(Math.min(...vals))), hi = Math.ceil(Math.max(...vals, 0) + .1);
      const P = V.plot(c1, { x: [1, depth], y: [lo, Math.max(hi, lo + 1)], xlabel: '층', ylabel: 'log₁₀ 표준편차' }).axes({ zero: false, xstep: depth > 10 ? 2 : 1 });
      P.line(res.aStd.map((v, i) => [i + 1, lg(v)]), pal.series[0], 2.4); res.aStd.forEach((v, i) => P.dot(i + 1, lg(v), 3.2, pal.series[0]));
      P.line(res.gStd.map((v, i) => [i + 1, lg(v)]), pal.series[1], 2.4); res.gStd.forEach((v, i) => P.dot(i + 1, lg(v), 3.2, pal.series[1]));
      text(P.ctx, '활성값', P.X(1) + 8, P.Y(lg(res.aStd[0])) - 12, { align: 'left', color: pal.series[0], bold: true });
      text(P.ctx, '기울기', P.X(depth) - 8, P.Y(lg(res.gStd[depth - 1])) + 14, { align: 'right', color: pal.series[1], bold: true });
      // 히스토그램
      const ctx = c2.ctx, W = c2.w, H = c2.h, show = depth <= 10 ? res.As.map((_, i) => i) : Array.from({ length: 10 }, (_, i) => Math.round(i * (depth - 1) / 9));
      const lo2 = actK === 'tanh' ? -1 : 0, hi2 = actK === 'tanh' ? 1 : actK === 'sigmoid' ? 1 : Math.max(1e-6, 3 * Math.max(...res.aStd));
      const rowH = (H - 30) / show.length, left = 46, right = W - 10, nb = 40;
      show.forEach((li, k) => {
        const cnt = new Array(nb).fill(0), A = res.As[li];
        A.forEach(a => a.forEach(v => { const b = Math.floor((v - lo2) / (hi2 - lo2) * nb); cnt[Math.max(0, Math.min(nb - 1, b))]++; }));
        const mx = Math.max(...cnt), y0 = 6 + k * rowH;
        cnt.forEach((c, b) => { const h = (rowH - 4) * c / mx; ctx.fillStyle = V.rgba(pal.series[0], .75); ctx.fillRect(left + (right - left) * b / nb, y0 + rowH - 2 - h, (right - left) / nb - 1, h); });
        text(ctx, `${li + 1}층`, left - 6, y0 + rowH / 2, { align: 'right', color: pal.muted, font: V.MONO });
      });
      text(ctx, fmt(lo2, 2), left, H - 12, { align: 'left', color: pal.muted, font: V.MONO });
      text(ctx, fmt(hi2, 2), right, H - 12, { align: 'right', color: pal.muted, font: V.MONO });
      text(ctx, '활성값', (left + right) / 2, H - 12, { color: pal.text2, bold: true });
      ui.setRO(`${INIT[initK][0]}, ${actK}: 1층 활성값 표준편차 ${fmt(res.aStd[0], 3)} → ${depth}층 ${fmt(res.aStd[depth - 1], 3)}   기울기 표준편차 ${depth}층 ${fmt(res.gStd[depth - 1], 3)} → 1층 ${fmt(res.gStd[0], 3)}`);
    }
    compute(); V.onEnv(el, draw);
  });

  /* ===== 5. 배치 정규화 ===== */
  V.register('batchnorm', el => {
    const ui = V.shell(el, {
      title: '배치 정규화: 미니배치 통계로 특징을 표준화',
      desc: '왼쪽은 어느 층에 들어온 미니배치(특징 2개)다. 특징마다 평균과 분산이 크게 다르다. 배치 정규화는 배치의 평균 $\\mu_B$와 표준편차 $\\sigma_B$로 표준화한 뒤 학습 가능한 $\\gamma$, $\\beta$로 다시 늘이고 옮긴다: $y = \\gamma\\,\\frac{x - \\mu_B}{\\sqrt{\\sigma_B^2 + \\epsilon}} + \\beta$.',
      how: ['회색 십자: 진짜 분포의 평균. 파란 십자: 이 배치의 평균. 사각형은 평균 ± 1 표준편차 범위다.', '오른쪽: 정규화 결과. 학습 모드는 이 배치의 통계를, 추론 모드는 지금까지 배치들의 이동 평균 통계를 쓴다.', '"새 배치"를 누를 때마다 이동 평균이 갱신된다(모멘텀 0.1).'],
      try: ['배치 크기를 4로 줄이고 "새 배치"를 여러 번 누른다. 배치 통계가 크게 흔들려 같은 점도 배치마다 다르게 정규화된다.', '추론 모드로 바꾸면 이동 평균을 쓰므로 한 점의 출력이 배치 구성과 무관해진다.', 'γ와 β를 움직여 정규화 후에도 원하는 평균·분산을 다시 학습할 수 있음을 본다(γ = σ, β = μ면 원래대로).']
    });
    const row = ui.row(2);
    const c1 = ui.canvas(ui.panel(row, '입력 미니배치'), 0, { aspect: .9, maxH: 380 });
    const c2 = ui.canvas(ui.panel(row, '배치 정규화 출력'), 0, { aspect: .9, maxH: 380 });
    const MU = [3, -2], SD = [2, .5];
    let B = 32, gamma = 1, beta = 0, mode = 'train', r = V.rng(3), batch = [], run = { m: [0, 0], v: [1, 1] }, nb = 0;
    function newBatch() {
      batch = Array.from({ length: B }, () => [MU[0] + SD[0] * V.gauss(r), MU[1] + SD[1] * V.gauss(r)]);
      const st = stats(); run.m = run.m.map((m, k) => .9 * m + .1 * st.m[k]); run.v = run.v.map((v, k) => .9 * v + .1 * st.v[k]); nb++;
    }
    const stats = () => { const m = [0, 1].map(k => batch.reduce((s, p) => s + p[k], 0) / batch.length); const v = [0, 1].map(k => batch.reduce((s, p) => s + (p[k] - m[k]) ** 2, 0) / batch.length); return { m, v }; };
    ui.slider({ label: '배치 크기', min: 2, max: 8, step: 1, value: 5, fmt: v => String(2 ** v), onInput: v => { B = 2 ** v; newBatch(); draw(); } });
    ui.slider({ label: 'γ', min: .2, max: 3, step: .1, value: gamma, fmt: v => v.toFixed(1), onInput: v => { gamma = v; draw(); } });
    ui.slider({ label: 'β', min: -3, max: 3, step: .1, value: beta, fmt: v => v.toFixed(1), onInput: v => { beta = v; draw(); } });
    ui.select({ label: '모드', options: [['train', '학습 (배치 통계)'], ['eval', '추론 (이동 평균)']], value: mode, onChange: v => { mode = v; draw(); } });
    ui.button({ label: '새 배치', primary: true, onClick: () => { newBatch(); draw(); } });
    ui.button({ label: '50배치 흘려보내기', onClick: () => { for (let i = 0; i < 50; i++) newBatch(); draw(); } });
    function frame(P, m, s, color, dash) { P.line([[m[0] - s[0], m[1] - s[1]], [m[0] + s[0], m[1] - s[1]], [m[0] + s[0], m[1] + s[1]], [m[0] - s[0], m[1] + s[1]], [m[0] - s[0], m[1] - s[1]]], color, 1.6, dash); }
    function cross(P, x, y, color) { P.line([[x - .25, y], [x + .25, y]], color, 2.2); P.line([[x, y - .25], [x, y + .25]], color, 2.2); }
    function draw() {
      const pal = V.pal(); c1.size(); c2.size();
      const st = stats(), use = mode === 'train' ? st : run, sd = use.v.map(v => Math.sqrt(v + 1e-5));
      const P = V.plot(c1, { x: [-4, 10], y: [-5, 3], equal: true, xlabel: '특징 1', ylabel: '특징 2' }).axes();
      frame(P, MU, SD, pal.muted, [4, 4]); cross(P, MU[0], MU[1], pal.muted);
      frame(P, st.m, st.v.map(Math.sqrt), pal.series[0]); cross(P, st.m[0], st.m[1], pal.series[0]);
      batch.forEach(p => P.dot(p[0], p[1], 3.4, pal.series[0], pal.surface));
      const Q = V.plot(c2, { x: [-5, 5], y: [-5, 5], equal: true, xlabel: '정규화된 특징 1', ylabel: '정규화된 특징 2' }).axes();
      frame(Q, [beta, beta], [gamma, gamma], pal.muted, [4, 4]);
      batch.forEach(p => { const y = [0, 1].map(k => gamma * (p[k] - use.m[k]) / sd[k] + beta); Q.dot(y[0], y[1], 3.4, pal.series[2], pal.surface); });
      ui.setRO(`배치 평균 (${fmt(st.m[0], 2)}, ${fmt(st.m[1], 2)}), 표준편차 (${fmt(Math.sqrt(st.v[0]), 2)}, ${fmt(Math.sqrt(st.v[1]), 2)})   이동 평균 (${fmt(run.m[0], 2)}, ${fmt(run.m[1], 2)}) / (${fmt(Math.sqrt(run.v[0]), 2)}, ${fmt(Math.sqrt(run.v[1]), 2)}) [${nb}배치]   진짜 (3, −2) / (2, 0.5)`);
    }
    newBatch(); draw(); V.onEnv(el, draw);
  });

  /* ===== 6. 드롭아웃 ===== */
  V.register('dropout', el => {
    const ui = V.shell(el, {
      title: '드롭아웃: 매 스텝 다른 부분망을 학습',
      desc: '학습 중 은닉 뉴런을 확률 $p$로 0으로 만든다(왼쪽, 매 스텝 새로 뽑음). 남은 뉴런의 출력은 $1/(1-p)$배 해 기댓값을 맞춘다. 추론 때는 모든 뉴런을 쓴다. 오른쪽은 잡음 섞인 작은 데이터에서 드롭아웃 없이 학습한 신경망과 드롭아웃으로 학습한 신경망의 결정 경계다.',
      how: ['왼쪽: 속이 빈 회색 뉴런이 이번 스텝에 꺼진 뉴런이다. 그 뉴런과 연결된 선도 흐려진다.', '오른쪽 두 그림: 점은 학습 데이터 60개(일부 레이블이 잡음). 배경은 학습된 신경망의 확률이다. 아래 숫자는 같은 분포에서 새로 뽑은 테스트 데이터 600개의 정확도다.', '두 신경망은 2 → 64 → 64 → 1(ReLU)로 같고, 드롭아웃 확률만 다르다.'],
      try: ['"두 신경망 학습"을 눌러 끝까지 기다린다. 드롭아웃이 없는 쪽은 잡음 점까지 둘러싸는 구불구불한 경계를, 드롭아웃 쪽은 매끄러운 경계를 만든다.', 'p를 0.8로 올리고 다시 학습한다. 너무 강한 드롭아웃은 과소적합을 부른다.', '왼쪽에서 "마스크 다시 뽑기"를 여러 번 누른다. 은닉 뉴런 12개만으로도 가능한 부분망은 2¹² = 4,096개다.']
    });
    const row = ui.row(3);
    const c0 = ui.canvas(ui.panel(row, '이번 스텝의 마스크'), 0, { aspect: 1, maxH: 300 });
    const cA = ui.canvas(ui.panel(row, '드롭아웃 없음'), 0, { aspect: 1, maxH: 300 });
    const cB = ui.canvas(ui.panel(row, '드롭아웃 p'), 0, { aspect: 1, maxH: 300 });
    let p = .5, mask = [[], []], anim = null, nets = null, epoch = 0;
    const rnd = V.rng(21);
    const sampleMask = () => { mask = [Array.from({ length: 6 }, () => rnd() >= p), Array.from({ length: 6 }, () => rnd() >= p)]; };
    function makeData(n, seed, noise) {
      const r = V.rng(seed), out = [];
      for (let i = 0; i < n; i++) { const c = i % 2, t = r() * Math.PI; let x = c ? 1 - Math.cos(t) : Math.cos(t), y = c ? .5 - Math.sin(t) : Math.sin(t); x = (x - .5) * 2 + V.gauss(r) * .25; y = (y - .25) * 2 + V.gauss(r) * .25; let lab = c; if (noise && r() < .12) lab = 1 - lab; out.push([x, y, lab]); }
      return out;
    }
    const train = makeData(60, 2, true), test = makeData(600, 99, false);
    function initNet(seed) { const r = V.rng(seed), L = [[2, 64], [64, 64], [64, 1]]; return L.map(([a, b]) => ({ W: Array.from({ length: a }, () => Float64Array.from({ length: b }, () => V.gauss(r) * Math.sqrt(2 / a))), b: new Float64Array(b), mW: Array.from({ length: a }, () => new Float64Array(b)), vW: Array.from({ length: a }, () => new Float64Array(b)), mb: new Float64Array(b), vb: new Float64Array(b) })); }
    function fwd(net, x, drop, r) {
      const acts = [x], masks = [];
      let a = x;
      net.forEach((L, l) => {
        const z = Float64Array.from(L.b); for (let i = 0; i < a.length; i++) { const ai = a[i]; if (!ai) continue; const Wi = L.W[i]; for (let j = 0; j < z.length; j++) z[j] += ai * Wi[j]; }
        if (l < net.length - 1) {
          const m = new Float64Array(z.length);
          for (let j = 0; j < z.length; j++) { const keep = drop > 0 ? (r() >= drop ? 1 / (1 - drop) : 0) : 1; m[j] = z[j] > 0 ? keep : 0; z[j] = z[j] > 0 ? z[j] * keep : 0; }
          masks.push(m);
        }
        a = z; acts.push(z);
      });
      return { out: 1 / (1 + Math.exp(-a[0])), acts, masks };
    }
    function trainStep(net, drop, r, t) {
      const grads = net.map(L => ({ W: L.W.map(row => new Float64Array(row.length)), b: new Float64Array(L.b.length) }));
      train.forEach(([x, y, c]) => {
        const F = fwd(net, [x, y], drop, r); let d = new Float64Array([F.out - c]);
        for (let l = net.length - 1; l >= 0; l--) {
          const a = F.acts[l], L = net[l];
          for (let i = 0; i < a.length; i++) { if (!a[i]) continue; const gi = grads[l].W[i]; for (let j = 0; j < d.length; j++) gi[j] += a[i] * d[j]; }
          for (let j = 0; j < d.length; j++) grads[l].b[j] += d[j];
          if (l > 0) { const m = F.masks[l - 1], nd = new Float64Array(a.length); for (let i = 0; i < a.length; i++) { if (!m[i]) continue; let s = 0; const Wi = L.W[i]; for (let j = 0; j < d.length; j++) s += Wi[j] * d[j]; nd[i] = s * m[i]; } d = nd; }
        }
      });
      const lr = .01, n = train.length, c1 = 1 - .9 ** t, c2 = 1 - .999 ** t;
      net.forEach((L, l) => {
        for (let i = 0; i < L.W.length; i++) for (let j = 0; j < L.W[i].length; j++) { const g = grads[l].W[i][j] / n; L.mW[i][j] = .9 * L.mW[i][j] + .1 * g; L.vW[i][j] = .999 * L.vW[i][j] + .001 * g * g; L.W[i][j] -= lr * (L.mW[i][j] / c1) / (Math.sqrt(L.vW[i][j] / c2) + 1e-8); }
        for (let j = 0; j < L.b.length; j++) { const g = grads[l].b[j] / n; L.mb[j] = .9 * L.mb[j] + .1 * g; L.vb[j] = .999 * L.vb[j] + .001 * g * g; L.b[j] -= lr * (L.mb[j] / c1) / (Math.sqrt(L.vb[j] / c2) + 1e-8); }
      });
    }
    const accOf = (net, data) => data.reduce((s, [x, y, c]) => s + ((fwd(net, [x, y], 0).out > .5) === (c === 1)), 0) / data.length;
    ui.slider({ label: '드롭아웃 확률 p', min: .1, max: .8, step: .1, value: p, fmt: v => v.toFixed(1), onInput: v => { p = v; sampleMask(); drawMask(); } });
    ui.button({ label: '마스크 다시 뽑기', onClick: () => { sampleMask(); drawMask(); } });
    const bRun = ui.button({ label: '두 신경망 학습', primary: true, onClick: () => {
      if (anim) { anim.stop(); anim = null; bRun.setLabel('두 신경망 학습'); return; }
      nets = { a: initNet(5), b: initNet(5), ra: V.rng(31), rb: V.rng(32), pb: p }; epoch = 0; bRun.setLabel('정지');
      anim = V.loop(() => { for (let k = 0; k < 4; k++) { epoch++; trainStep(nets.a, 0, nets.ra, epoch); trainStep(nets.b, nets.pb, nets.rb, epoch); } sampleMask(); drawMask(); drawNets(); if (epoch >= 600) { anim.stop(); anim = null; bRun.setLabel('두 신경망 학습'); return false; } });
    } });
    function drawMask() {
      const pal = V.pal(); c0.size();
      const ctx = c0.ctx, W = c0.w, H = c0.h, xs = [W * .12, W * .4, W * .68, W * .9];
      const ys = n => Array.from({ length: n }, (_, i) => H * (i + 1) / (n + 1));
      const layers = [[true, true], mask[0], mask[1], [true]], pos = layers.map((m, l) => ys(m.length).map(y => [xs[l], y]));
      for (let l = 0; l < 3; l++) pos[l].forEach((a, i) => pos[l + 1].forEach((b, j) => { const live = layers[l][i] && layers[l + 1][j]; ctx.strokeStyle = live ? V.rgba(pal.series[0], .5) : V.rgba(pal.muted.startsWith('#') ? pal.muted : '#888888', .12); ctx.lineWidth = live ? 1.2 : 1; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }));
      layers.forEach((m, l) => pos[l].forEach(([x, y], i) => { ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); if (m[i]) { ctx.fillStyle = l === 0 || l === 3 ? pal.text2 : pal.series[0]; ctx.fill(); } else { ctx.strokeStyle = pal.muted; ctx.lineWidth = 1.5; ctx.stroke(); } }));
      const kept = mask[0].filter(Boolean).length + mask[1].filter(Boolean).length;
      text(ctx, `살아남은 은닉 뉴런 ${kept}/12, 출력 ×${fmt(1 / (1 - p), 3)}`, W / 2, H - 8, { color: pal.text2, font: V.FONT });
    }
    function drawOne(cv, net, title) {
      const pal = V.pal(); cv.size();
      const P = V.plot(cv, { x: [-3, 3], y: [-3, 3], equal: true, pad: { l: 8, r: 8, t: 8, b: 26 } });
      const ctx = P.ctx, st = 6;
      if (net) for (let py = P.box.y0; py < P.box.y1; py += st) for (let px = P.box.x0; px < P.box.x1; px += st) { ctx.fillStyle = V.cmapCss('prob', fwd(net, [P.ix(px + 3), P.iy(py + 3)], 0).out, .5); ctx.fillRect(px, py, st, st); }
      ctx.strokeStyle = pal.border2; ctx.lineWidth = 1; ctx.strokeRect(P.box.x0 + .5, P.box.y0 + .5, P.box.x1 - P.box.x0 - 1, P.box.y1 - P.box.y0 - 1);
      train.forEach(([x, y, c]) => P.dot(x, y, 3.6, c ? pal.series[0] : pal.series[1], pal.surface));
      text(ctx, title, cv.w / 2, cv.h - 10, { color: pal.text2, font: V.FONT });
    }
    function drawNets() {
      if (!nets) { drawOne(cA, null, '"두 신경망 학습"을 누른다'); drawOne(cB, null, `p = ${p.toFixed(1)}`); ui.setRO(''); return; }
      const aA = [accOf(nets.a, train), accOf(nets.a, test)], aB = [accOf(nets.b, train), accOf(nets.b, test)];
      drawOne(cA, nets.a, `학습 ${(aA[0] * 100).toFixed(0)}%  테스트 ${(aA[1] * 100).toFixed(1)}%`);
      drawOne(cB, nets.b, `p = ${nets.pb.toFixed(1)}: 학습 ${(aB[0] * 100).toFixed(0)}%  테스트 ${(aB[1] * 100).toFixed(1)}%`);
      ui.setRO(`에폭 ${epoch} / 600   드롭아웃 없음: 학습 정확도 ${(aA[0] * 100).toFixed(1)}%, 테스트 ${(aA[1] * 100).toFixed(1)}%   드롭아웃 p = ${nets.pb.toFixed(1)}: 학습 ${(aB[0] * 100).toFixed(1)}%, 테스트 ${(aB[1] * 100).toFixed(1)}%`);
    }
    sampleMask(); drawMask(); drawNets(); V.onEnv(el, () => { drawMask(); drawNets(); });
  });

  V.modsReady.push('w4');
})();
