/* 6주차 시각화: RNN 시간 펼치기, 시간에 따른 기울기 소실 */
(function () {
  'use strict';
  const fmt = V.fmt;
  const text = (ctx, s, x, y, o = {}) => {
    const pal = V.pal();
    ctx.font = o.font || (o.bold ? V.FONT_B : V.FONT); ctx.fillStyle = o.color || pal.text;
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.base || 'middle'; ctx.fillText(s, x, y); ctx.textBaseline = 'alphabetic';
  };
  function randMat(r, n, m, sd) { return Array.from({ length: n }, () => Float64Array.from({ length: m }, () => V.gauss(r) * sd)); }
  // 무작위 직교 행렬 (그람-슈미트): 모든 고윳값의 크기가 1
  function orthogonal(r, n) {
    const A = randMat(r, n, n, 1), Q = [];
    for (let i = 0; i < n; i++) {
      const v = Float64Array.from(A[i]);
      for (const q of Q) { let d = 0; for (let k = 0; k < n; k++) d += v[k] * q[k]; for (let k = 0; k < n; k++) v[k] -= d * q[k]; }
      const nv = Math.hypot(...v); for (let k = 0; k < n; k++) v[k] /= nv; Q.push(v);
    }
    return Q;
  }

  /* ===== 1. RNN 시간 펼치기 ===== */
  const SEQS = {
    impulse: { name: '처음에만 1 (충격)', x: [1, 0, 0, 0, 0, 0, 0, 0] },
    step: { name: '계속 1 (계단)', x: [1, 1, 1, 1, 1, 1, 1, 1] },
    alt: { name: '번갈아 ±1', x: [1, -1, 1, -1, 1, -1, 1, -1] },
    rand: { name: '무작위', x: [0.6, -0.2, 0.9, 0.1, -0.7, 0.4, -0.5, 0.8] }
  };
  V.register('rnn-unroll', el => {
    const ui = V.shell(el, {
      title: 'RNN 시간 펼치기: 같은 셀, 이어지는 은닉 상태',
      desc: '왼쪽은 되먹임 고리가 있는 RNN 셀, 오른쪽은 그것을 시간 방향으로 펼친 모습이다. 펼친 셀들은 모두 같은 가중치를 쓴다. 칸 4개짜리 막대가 은닉 상태 $h_t$(파랑 = 양수, 빨강 = 음수)다.',
      how: ['아래 숫자가 입력 $x_t$, 셀 사이의 화살표가 $h_{t-1} \\to h_t$, 위의 숫자가 출력 $y_t$(은닉 상태의 첫 칸)다.', '"한 시점"을 누르면 왼쪽부터 차례로 계산한다. 계산은 $h_t = \\tanh(x_t W_x + h_{t-1} W_h)$이고, $W_x$, $W_h$는 고정된 무작위 값에 배율을 곱한 것이다.'],
      try: ['"처음에만 1"을 고른다. 입력은 첫 시점에만 있는데 은닉 상태에는 그 흔적이 몇 시점 남는다. 이것이 RNN의 기억이다.', '순환 배율을 0.3으로 낮추면 흔적이 금방 사라지고, 1.5로 높이면 오래 남거나 출렁인다. 오늘 배울 기울기 소실·폭발과 같은 현상이다.', '배율 0이면 은닉 상태가 이전을 전혀 기억하지 못하고 그 시점의 입력만 반영한다.']
    });
    const row = ui.row(1);
    const cv = ui.canvas(ui.panel(row, ''), 0, { aspect: .38, minH: 230, maxH: 330 });
    let key = 'impulse', scale = .9, shown = 8;
    const r = V.rng(5), H = 4, Wx = randMat(r, 1, H, 1.2)[0], Wh0 = randMat(r, H, H, 1 / Math.sqrt(H));
    ui.select({ label: '입력 시퀀스', options: Object.entries(SEQS).map(([k, v]) => [k, v.name]), value: key, onChange: v => { key = v; draw(); } });
    ui.slider({ label: '순환 배율', min: 0, max: 2, step: .1, value: scale, fmt: v => v.toFixed(1), onInput: v => { scale = v; draw(); } });
    ui.button({ label: '처음으로', onClick: () => { shown = 0; draw(); } });
    ui.button({ label: '한 시점', primary: true, onClick: () => { shown = Math.min(8, shown + 1); draw(); } });
    ui.button({ label: '모두', onClick: () => { shown = 8; draw(); } });
    function run() {
      const xs = SEQS[key].x, hs = [new Float64Array(H)];
      for (let t = 0; t < xs.length; t++) {
        const prev = hs[t], h = new Float64Array(H);
        for (let i = 0; i < H; i++) { let s = xs[t] * Wx[i]; for (let q = 0; q < H; q++) s += prev[q] * Wh0[q][i] * scale; h[i] = Math.tanh(s); }
        hs.push(h);
      }
      return { xs, hs };
    }
    function bar(ctx, x, y, w, h, vec, dim) {
      const pal = V.pal(), ch = h / H;
      for (let i = 0; i < H; i++) {
        ctx.fillStyle = dim ? pal.surface2 : V.cmapCss('div', .5 + .5 * vec[i]); ctx.fillRect(x, y + i * ch, w, ch);
        ctx.strokeStyle = pal.border2; ctx.lineWidth = .6; ctx.strokeRect(x + .5, y + i * ch + .5, w - 1, ch - 1);
      }
    }
    function draw() {
      const pal = V.pal(); cv.size();
      const ctx = cv.ctx, W = cv.w, Hh = cv.h, { xs, hs } = run();
      // 접힌 셀
      const fx = 46, fy = Hh / 2;
      ctx.strokeStyle = pal.text2; ctx.lineWidth = 1.4;
      ctx.strokeRect(fx - 22, fy - 30, 44, 60);
      text(ctx, 'RNN', fx, fy, { bold: true });
      ctx.beginPath(); ctx.moveTo(fx + 22, fy - 12); ctx.bezierCurveTo(fx + 52, fy - 12, fx + 52, fy - 52, fx, fy - 52); ctx.bezierCurveTo(fx - 52, fy - 52, fx - 52, fy - 12, fx - 22, fy - 12); ctx.stroke();
      V.arrowPx(ctx, fx - 30, fy - 12, fx - 22, fy - 12, pal.text2, 1.4, 6);
      text(ctx, 'h', fx, fy - 60, { color: pal.muted });
      V.arrowPx(ctx, fx, fy + 52, fx, fy + 31, pal.text2, 1.4, 6); text(ctx, 'x', fx, fy + 62, { color: pal.muted });
      text(ctx, '펼치기 →', fx + 62, fy, { color: pal.muted });
      // 펼친 셀
      const x0 = 130, n = xs.length, gap = (W - x0 - 20) / n, cw = Math.min(46, gap * .55), top = Hh * .2, bh = Hh * .48;
      for (let t = 0; t < n; t++) {
        const cx = x0 + gap * t + gap / 2, on = t < shown;
        ctx.strokeStyle = on ? pal.accent : pal.border2; ctx.lineWidth = on ? 1.6 : 1;
        ctx.strokeRect(cx - cw / 2 - 4, top - 4, cw + 8, bh + 8);
        bar(ctx, cx - cw / 2, top, cw, bh, hs[t + 1], !on);
        V.arrowPx(ctx, cx, top + bh + 30, cx, top + bh + 6, on ? pal.text2 : pal.border2, 1.3, 6);
        text(ctx, String(xs[t]), cx, top + bh + 40, { font: V.MONO, color: on ? pal.text : pal.muted });
        text(ctx, `t=${t + 1}`, cx, Hh - 8, { color: pal.muted, font: '11px sans-serif' });
        if (on) text(ctx, fmt(hs[t + 1][0], 2), cx, top - 16, { font: V.MONO, color: pal.text2 });
        if (t < n - 1) V.arrowPx(ctx, cx + cw / 2 + 5, top + bh / 2, cx + gap - cw / 2 - 5, top + bh / 2, t + 1 < shown ? pal.accent : pal.border2, 1.6, 7);
      }
      text(ctx, 'x_t', x0 - 8, top + bh + 40, { align: 'right', color: pal.muted });
      text(ctx, 'y_t', x0 - 8, top - 16, { align: 'right', color: pal.muted });
      const last = Math.max(0, shown);
      ui.setRO(last ? `h_${last} = [${Array.from(hs[last]).map(v => fmt(v, 2)).join(', ')}]   (순환 배율 ${scale.toFixed(1)}, 8개 셀이 같은 W_x, W_h를 쓴다)` : '처음 상태 h_0 = [0, 0, 0, 0]');
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 2. 시간에 따른 기울기 소실·폭발 ===== */
  V.register('bptt', el => {
    const ui = V.shell(el, {
      title: '시간에 따른 기울기: 같은 행렬을 거듭 곱하면',
      desc: '은닉 32차원 RNN을 60시점 돌린 뒤, 마지막 시점의 기울기를 거꾸로 전달하며 시점마다 크기 $\\lVert \\partial L/\\partial h_t \\rVert$를 잰다(로그 눈금). 순환 가중치는 $W_h = $ 배율 × 무작위 직교 행렬이라, 모든 고윳값의 크기가 배율과 같다(오른쪽 점선 원). 실선은 단위원이다.',
      how: ['왼쪽 그래프의 오른쪽 끝(시점 60)이 출발점이다. 왼쪽으로 갈수록 오래전 시점이다.', '선형이면 한 시점 거슬러 갈 때마다 기울기 크기에 정확히 배율이 곱해진다. 그래서 로그 눈금에서 직선이고 기울기가 $\\log_{10}$(배율)이다. 고윳값이 단위원 안에 있으면 줄고, 밖에 있으면 커진다.', 'tanh에서는 매 시점 $1 - h^2$(1 이하)가 더 곱해진다. 선은 무작위 가중치 4벌의 로그 평균이다.'],
      try: ['선형 활성화에서 배율을 0.9 → 1.0 → 1.1로 바꿔 본다. 60시점 뒤 기울기가 약 1/560배 → 1배 → 약 300배가 된다. 1에서 10%만 벗어나도 차이가 세 자릿수 가까이 난다.', 'tanh로 바꾸면 같은 배율에서도 기울기가 더 줄어든다. tanh의 미분이 1 이하라 매 시점 추가로 깎이기 때문이다.', '배율 1.5 이상에서 tanh는 기울기가 커지지 않고 어느 수준에 머물기도 한다. 은닉 상태가 포화(±1)되어 미분이 0에 가까워지기 때문이다.']
    });
    const row = ui.row(2);
    const cv = ui.canvas(ui.panel(row, '시점별 기울기 크기 (log₁₀)'), 0, { aspect: .72, maxH: 360 });
    const ce = ui.canvas(ui.panel(row, 'W_h 고윳값(점선 원 위)과 단위원'), 0, { aspect: .72, maxH: 360 });
    let scale = .9, act = 'linear';
    ui.slider({ label: 'W_h 배율', min: .3, max: 2, step: .05, value: scale, fmt: v => v.toFixed(2), onInput: v => { scale = v; draw(); } });
    ui.select({ label: '활성화', options: [['linear', '선형 (곱만)'], ['tanh', 'tanh']], value: act, onChange: v => { act = v; draw(); } });
    const T = 60, H = 32;
    function norms(seed) {
      const r = V.rng(seed), Wh = orthogonal(r, H).map(row => row.map(v => v * scale)), xs = Array.from({ length: T }, () => Float64Array.from({ length: H }, () => .5 * V.gauss(r)));
      const hs = [new Float64Array(H)];
      for (let t = 0; t < T; t++) { const h = new Float64Array(H); for (let i = 0; i < H; i++) { let s = xs[t][i]; for (let q = 0; q < H; q++) s += hs[t][q] * Wh[q][i]; h[i] = act === 'tanh' ? Math.tanh(s) : s; } hs.push(h); }
      let g = new Float64Array(H).fill(1 / Math.sqrt(H)); const out = new Array(T + 1); out[T] = 1;
      for (let t = T - 1; t >= 0; t--) {
        const dz = Float64Array.from(g, (v, i) => act === 'tanh' ? v * (1 - hs[t + 1][i] ** 2) : v), ng = new Float64Array(H);
        for (let q = 0; q < H; q++) { let s = 0; for (let i = 0; i < H; i++) s += Wh[q][i] * dz[i]; ng[q] = s; }
        g = ng; out[t] = Math.hypot(...g);
      }
      return out;
    }
    function draw() {
      const pal = V.pal(); cv.size(); ce.size();
      const runs = [1, 2, 3, 4].map(s => norms(s * 11)), avg = runs[0].map((_, t) => runs.reduce((a, rr) => a + Math.log10(Math.max(rr[t], 1e-300)), 0) / runs.length);
      const lo = Math.min(-6, Math.floor(Math.min(...avg))), hi = Math.max(2, Math.ceil(Math.max(...avg)));
      const P = V.plot(cv, { x: [0, T], y: [lo, hi], xlabel: '시점 t', ylabel: 'log₁₀ ‖∂L/∂h_t‖' }).axes({ zero: false });
      P.line([[0, 0], [T, 0]], pal.muted, 1, [4, 4]);
      P.line(avg.map((v, t) => [t, v]), scale < 1 ? pal.series[1] : pal.series[0], 2.6);
      // 고윳값 그림
      const Q = V.plot(ce, { x: [-2.3, 2.3], y: [-2.3, 2.3], equal: true, xlabel: '실수부', ylabel: '허수부' }).axes({ zero: true });
      const circ = (rad, color, dash) => Q.line(Array.from({ length: 121 }, (_, k) => [rad * Math.cos(k * Math.PI / 60), rad * Math.sin(k * Math.PI / 60)]), color, 2, dash);
      Q.ctx.fillStyle = V.rgba(pal.series[scale < 1 ? 1 : 0].startsWith('#') ? pal.series[scale < 1 ? 1 : 0] : '#2c5db6', .12);
      circ(scale, pal.series[scale < 1 ? 1 : 0], [5, 4]);
      circ(1, pal.text2);
      Q.label(.72, .78, '단위원', { color: pal.text2 });
      ui.setRO(`60시점 전의 기울기 = 출발점의 10^${avg[0].toFixed(1)}배   (${act === 'tanh' ? 'tanh' : '선형'}, 배율 ${scale.toFixed(2)})`);
    }
    draw(); V.onEnv(el, draw);
  });


  /* ===== 3. LSTM 게이트 ===== */
  V.register('lstm-gates', el => {
    const ui = V.shell(el, {
      title: 'LSTM 셀: 게이트가 기억을 지키고 고친다',
      desc: '유닛 하나짜리 LSTM 셀이다. 왼쪽은 한 시점의 계산, 오른쪽은 첫 시점에 담은 정보(와 그 기울기)가 시간이 지나며 얼마나 남는지를 기본 RNN과 비교한다.',
      how: ['왼쪽: $c_t = f \\cdot c_{t-1} + i \\cdot g$, $h_t = o \\cdot \\tanh(c_t)$. 상자 안 숫자가 실제 값이다. 게이트 $f, i, o$는 시그모이드 출력이라 0~1이고, 후보 값 $g$는 tanh 출력이라 −1~1이다.', '오른쪽: 첫 시점 이후 입력 게이트를 닫고(i = 0) 망각 게이트를 슬라이더 값으로 둘 때, 셀 상태에 남은 첫 정보의 크기 $\\partial c_t/\\partial c_1 = f^{t-1}$(파랑). 빨강은 순환 가중치가 같은 값인 기본 RNN의 $\\partial h_t/\\partial h_1$이다(로그 눈금).'],
      try: ['f = 1, i = 0으로 두면 $c_t = c_{t-1}$: 셀 상태가 그대로 복사된다. 오른쪽에서 파란 선이 수평(기울기 1)이다.', 'f = 0.95로 낮추면 60시점 뒤 약 5%만 남는다. 기본 RNN은 같은 배율에서도 tanh의 미분 때문에 훨씬 빨리 사라진다.', 'f = 0, i = 1이면 이전 기억을 완전히 지우고 새 값 g로 바꾼다. 게이트가 "언제 잊고 언제 쓸지"를 입력에 따라 정한다.']
    });
    const row = ui.row(2);
    const c1 = ui.canvas(ui.panel(row, '한 시점의 계산'), 0, { aspect: .72, maxH: 340 });
    const c2 = ui.canvas(ui.panel(row, '첫 시점 정보의 크기 (log₁₀)'), 0, { aspect: .72, maxH: 340 });
    let f = .95, ig = .8, o = .9, g = .6, cp = .5;
    ui.slider({ label: '망각 f', min: 0, max: 1, step: .01, value: f, fmt: v => v.toFixed(2), onInput: v => { f = v; draw(); } });
    ui.slider({ label: '입력 i', min: 0, max: 1, step: .01, value: ig, fmt: v => v.toFixed(2), onInput: v => { ig = v; draw(); } });
    ui.slider({ label: '출력 o', min: 0, max: 1, step: .01, value: o, fmt: v => v.toFixed(2), onInput: v => { o = v; draw(); } });
    ui.slider({ label: '후보 g', min: -1, max: 1, step: .01, value: g, fmt: v => v.toFixed(2), onInput: v => { g = v; draw(); } });
    ui.slider({ label: '이전 셀 c_{t-1}', min: -1, max: 1, step: .01, value: cp, fmt: v => v.toFixed(2), onInput: v => { cp = v; draw(); } });
    function node(ctx, x, y, label, val, color) {
      const pal = V.pal();
      ctx.fillStyle = pal.surface2; ctx.strokeStyle = color || pal.border2; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.rect(x - 27, y - 17, 54, 34); ctx.fill(); ctx.stroke();
      text(ctx, label, x, y - 7, { color: pal.muted, font: '10.5px sans-serif' });
      text(ctx, fmt(val, 3), x, y + 8, { font: V.MONO, color: color || pal.text });
    }
    function op(ctx, x, y, s) { const pal = V.pal(); ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.fillStyle = pal.surface; ctx.fill(); ctx.strokeStyle = pal.text2; ctx.lineWidth = 1.4; ctx.stroke(); text(ctx, s, x, y, { bold: true }); }
    function draw() {
      const pal = V.pal(); c1.size(); c2.size();
      const ctx = c1.ctx, W = c1.w, H = c1.h, ct = f * cp + ig * g, ht = o * Math.tanh(ct);
      const y1 = H * .22, y2 = H * .52, y3 = H * .82, xC0 = W * .1, xF = W * .3, xA = W * .53, xC = W * .78, xH = W * .92;
      // 셀 상태 길 (위)
      ctx.strokeStyle = pal.series[0]; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(xC0 + 27, y1); ctx.lineTo(xC - 27, y1); ctx.stroke();
      text(ctx, '셀 상태: 곱(f)과 덧셈(i·g)만 지난다', (xC0 + xC) / 2, y1 - 26, { color: pal.series[0], font: '11px sans-serif' });
      node(ctx, xC0, y1, 'c_{t-1}', cp, pal.series[0]);
      op(ctx, xF, y1, '×'); op(ctx, xA, y1, '+');
      node(ctx, xC, y1, 'c_t', ct, pal.series[0]);
      // 망각 게이트
      node(ctx, xF, y2, '망각 f', f); V.arrowPx(ctx, xF, y2 - 17, xF, y1 + 11, pal.text2, 1.3, 6);
      // 입력 게이트 × 후보
      op(ctx, xA, y2, '×'); V.arrowPx(ctx, xA, y2 - 10, xA, y1 + 11, pal.text2, 1.3, 6);
      node(ctx, xA - 30, y3, '입력 i', ig); node(ctx, xA + 30, y3, '후보 g', g);
      V.arrowPx(ctx, xA - 30, y3 - 17, xA - 7, y2 + 8, pal.text2, 1.2, 5); V.arrowPx(ctx, xA + 30, y3 - 17, xA + 7, y2 + 8, pal.text2, 1.2, 5);
      text(ctx, fmt(ig * g, 3), xA + 14, y2 - 14, { align: 'left', font: '10.5px sans-serif', color: pal.muted });
      // 출력 길
      op(ctx, xC, y2, '×'); V.arrowPx(ctx, xC, y1 + 17, xC, y2 - 10, pal.text2, 1.3, 6);
      text(ctx, 'tanh', xC + 5, (y1 + y2) / 2, { align: 'left', font: '10.5px sans-serif', color: pal.muted });
      node(ctx, xC, y3, '출력 o', o); V.arrowPx(ctx, xC, y3 - 17, xC, y2 + 10, pal.text2, 1.3, 6);
      V.arrowPx(ctx, xC + 10, y2, xH - 12, y2, pal.text2, 1.3, 6);
      text(ctx, 'h_t', xH, y2 - 16, { color: pal.muted }); text(ctx, fmt(ht, 3), xH, y2 + 14, { font: V.MONO, bold: true });
      // 오른쪽: 기억의 크기
      const T = 60, lstm = [], rnn = [];
      let h = Math.tanh(1), grad = 1;
      for (let t = 1; t <= T; t++) {
        lstm.push([t, (t - 1) * Math.log10(Math.max(f, 1e-6))]);
        rnn.push([t, Math.log10(Math.max(grad, 1e-30))]);
        const hn = Math.tanh(f * h); grad *= f * (1 - hn * hn); h = hn;
      }
      const lo = Math.max(-12, Math.min(-3, Math.floor(Math.min(...rnn.map(p => p[1]))))), P = V.plot(c2, { x: [1, T], y: [lo, .5], xlabel: '시점 t', ylabel: 'log₁₀ 크기' }).axes({ zero: false });
      P.line(lstm.map(p => [p[0], Math.max(p[1], lo)]), pal.series[0], 2.6);
      P.line(rnn.map(p => [p[0], Math.max(p[1], lo)]), pal.series[1], 2.2, [6, 4]);
      P.label(T * .55, Math.max(lstm[Math.floor(T * .55)][1], lo) + .4, 'LSTM 셀 상태 f^(t−1)', { color: pal.series[0], bold: true });
      P.label(T * .3, Math.max(rnn[Math.floor(T * .3)][1], lo) - .5, '기본 RNN (가중치 = f)', { color: pal.series[1], bold: true });
      ui.setRO(`c_t = ${fmt(f, 2)}·${fmt(cp, 2)} + ${fmt(ig, 2)}·${fmt(g, 2)} = ${fmt(ct, 3)},  h_t = ${fmt(o, 2)}·tanh(${fmt(ct, 3)}) = ${fmt(ht, 3)}.  60시점 뒤 남는 크기: LSTM ${(f ** 59).toExponential(1)}, 기본 RNN ${rnn[T - 1][1] < -29 ? '≈ 0' : '10^' + rnn[T - 1][1].toFixed(1)}`);
    }
    draw(); V.onEnv(el, draw);
  });


  /* ===== 4. BPE 병합 과정 ===== */
  const BPE_SAMPLES = {
    en: { name: '영어 (low, lower, newest …)', text: 'low low low low low lower lower newest newest newest newest newest newest widest widest widest' },
    ko: { name: '한국어 리뷰 조각', text: '영화 재밌다 영화가 재밌었다 영화는 재밌다 영화를 봤다 재미없다 재미없었다 영화 최고 최고다 최고였다 배우 연기 배우가 연기를 잘했다' }
  };
  V.register('bpe', el => {
    const ui = V.shell(el, {
      title: 'BPE: 자주 붙어 나오는 쌍을 하나로 합친다',
      desc: '단어를 글자 단위로 쪼갠 상태에서 시작해, 말뭉치에서 가장 자주 나란히 나오는 두 토큰을 새 토큰 하나로 합치는 일을 반복한다. 합칠 때마다 어휘 사전이 하나 늘고, 단어를 나타내는 토큰 수는 줄어든다.',
      how: ['위: 단어마다 지금의 토큰 분할(괄호 안 숫자는 그 단어의 출현 횟수). 단어 끝 표시 ⌟는 같은 글자라도 단어 끝에 오는 경우를 구별하려고 붙였다.', '아래 왼쪽: 지금 가장 흔한 인접 쌍과 그 횟수(출현 횟수로 가중). 아래 오른쪽: 지금까지의 병합 규칙. 새 단어를 토큰화할 때는 이 규칙을 순서대로 적용한다.'],
      try: ['영어 예에서 병합을 한 번씩 진행한다. 처음 병합은 e+s → es, es+t → est 순서로 "est"가 만들어진다(newest, widest 공통).', '한국어 예에서는 "영화", "재밌", "최고"처럼 자주 나오는 덩어리가 먼저 하나의 토큰이 된다. 조사(가, 는, 를)는 따로 남는다.', '병합을 아주 많이 하면 결국 단어 전체가 토큰이 된다. 어휘 크기와 시퀀스 길이 사이의 맞바꿈이다.']
    });
    const area = document.createElement('div'); area.style.cssText = 'font-size:14px;line-height:2;margin:4px 2px 10px'; ui.body.appendChild(area);
    const row = ui.row(2);
    const pairBox = ui.panel(row, '가장 흔한 인접 쌍'), mergeBox = ui.panel(row, '병합 규칙 (순서대로)');
    const pairList = document.createElement('div'), mergeList = document.createElement('div');
    [pairList, mergeList].forEach(d => { d.style.cssText = 'font: 13px/1.8 "JetBrains Mono", monospace; min-height: 120px'; });
    pairBox.appendChild(pairList); mergeBox.appendChild(mergeList);
    let key = 'en', words = [], merges = [];
    function reset() {
      const cnt = new Map(); BPE_SAMPLES[key].text.split(/\s+/).filter(Boolean).forEach(w => cnt.set(w, (cnt.get(w) || 0) + 1));
      words = [...cnt].map(([w, n]) => ({ w, n, toks: [...w].map((ch, i, arr) => i === arr.length - 1 ? ch + '⌟' : ch) }));
      merges = []; draw();
    }
    function pairs() {
      const m = new Map();
      for (const { n, toks } of words) for (let i = 0; i + 1 < toks.length; i++) { const k = toks[i] + '\u0000' + toks[i + 1]; m.set(k, (m.get(k) || 0) + n); }
      return [...m].sort((a, b) => b[1] - a[1]);
    }
    function mergeOnce() {
      const ps = pairs(); if (!ps.length) return false;
      const [a, b] = ps[0][0].split('\u0000');
      for (const wd of words) {
        const out = [];
        for (let i = 0; i < wd.toks.length; i++) { if (i + 1 < wd.toks.length && wd.toks[i] === a && wd.toks[i + 1] === b) { out.push(a + b); i++; } else out.push(wd.toks[i]); }
        wd.toks = out;
      }
      merges.push([a, b, ps[0][1]]); return true;
    }
    ui.select({ label: '말뭉치', options: Object.entries(BPE_SAMPLES).map(([k, v]) => [k, v.name]), value: key, onChange: v => { key = v; reset(); } });
    ui.button({ label: '병합 1번', primary: true, onClick: () => { mergeOnce(); draw(); } });
    ui.button({ label: '병합 5번', onClick: () => { for (let i = 0; i < 5; i++) mergeOnce(); draw(); } });
    ui.button({ label: '처음으로', onClick: reset });
    const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    function chip(t, hot) {
      const pal = V.pal();
      return `<span style="display:inline-block;padding:0 6px;margin:0 2px;border-radius:4px;border:1px solid ${hot ? pal.accent : pal.border2};background:${hot ? pal.accentSoft : pal.surface2};font-family:'JetBrains Mono',monospace">${esc(t)}</span>`;
    }
    function draw() {
      const last = merges.length ? merges[merges.length - 1][0] + merges[merges.length - 1][1] : null;
      area.innerHTML = words.map(({ w, n, toks }) => `<span style="white-space:nowrap;margin-right:14px">${toks.map(t => chip(t, t === last)).join('')}<span class="muted" style="font-size:12px"> (${n})</span></span>`).join(' ');
      const ps = pairs().slice(0, 6);
      pairList.innerHTML = ps.length ? ps.map(([k, c], i) => `${i === 0 ? '<b>' : ''}${esc(k.replace('\u0000', ' + '))}  ×${c}${i === 0 ? '  ← 다음 병합</b>' : ''}`).join('<br>') : '더 합칠 쌍이 없다';
      mergeList.innerHTML = merges.length ? merges.map(([a, b, c], i) => `${i + 1}. ${esc(a)} + ${esc(b)} → ${esc(a + b)}  (${c})`).slice(-8).join('<br>') + (merges.length > 8 ? '<br>…' : '') : '(아직 없음)';
      const base = new Set(words.flatMap(wd => [...wd.w].map((ch, i, arr) => i === arr.length - 1 ? ch + '⌟' : ch))).size;
      const ntok = words.reduce((a, wd) => a + wd.n * wd.toks.length, 0), nch = words.reduce((a, wd) => a + wd.n * [...wd.w].length, 0);
      ui.setRO(`병합 ${merges.length}번: 어휘 크기 ${base} + ${merges.length} = ${base + merges.length},  말뭉치 전체 토큰 수 ${ntok} (글자 수 ${nch})`);
    }
    reset(); V.onEnv(el, draw);
  });

  /* ===== 5. 생성 샘플링 전략 ===== */
  const CANDS = [['재밌었다', 3.0], ['좋았다', 2.6], ['최고였다', 2.2], ['감동적이었다', 1.5], ['별로였다', 1.2], ['지루했다', 1.0], ['슬펐다', .4], ['길었다', .2], ['이상했다', -.3], ['배고프다', -1.5]];
  V.register('sampling', el => {
    const ui = V.shell(el, {
      title: '다음 토큰 고르기: 온도, top-k, top-p',
      desc: '언어 모델이 "오늘 본 영화는 정말 ___" 다음에 올 단어 10개에 로짓을 냈다. 이 로짓을 확률로 바꾸고 하나를 뽑는 방법에 따라 생성되는 문장의 성격이 달라진다.',
      how: ['막대: 최종 확률. 흐린 막대는 top-k·top-p에서 잘려 뽑히지 않는 후보다.', '온도 $\\tau$: 확률 = softmax(로짓 / $\\tau$). 작을수록 가장 큰 후보에 몰리고(1에 가까우면 원래 분포), 클수록 평평해진다.', 'top-k: 확률이 큰 순서로 k개만 남긴다. top-p(핵 샘플링): 큰 순서로 더해 누적 확률이 p를 넘는 최소 집합만 남긴다. 남은 후보끼리 다시 정규화한다.'],
      try: ['온도를 0.1로 낮춘다. "재밌었다"만 거의 확률 1이 된다(탐욕적 디코딩과 같다). 문장이 늘 같아지고 반복되기 쉽다.', '온도를 2로 올리면 "배고프다" 같은 엉뚱한 후보도 뽑힌다.', 'top-p = 0.9로 두고 온도를 바꿔 본다. 분포가 뾰족하면 후보가 적게, 평평하면 많이 남는다. top-k는 분포 모양과 상관없이 늘 k개다.', '"20개 뽑기"를 여러 번 눌러 실제로 뽑힌 단어를 본다.']
    });
    const cv = ui.canvas(ui.body, 0, { aspect: .42, minH: 240, maxH: 330 });
    let tau = 1, topk = 10, topp = 1, samples = [], seed = 1;
    ui.slider({ label: '온도 τ', min: .1, max: 2, step: .05, value: tau, fmt: v => v.toFixed(2), onInput: v => { tau = v; samples = []; draw(); } });
    ui.slider({ label: 'top-k', min: 1, max: 10, step: 1, value: topk, fmt: v => v === 10 ? '끔(10)' : String(v), onInput: v => { topk = v; samples = []; draw(); } });
    ui.slider({ label: 'top-p', min: .1, max: 1, step: .05, value: topp, fmt: v => v >= 1 ? '끔(1.0)' : v.toFixed(2), onInput: v => { topp = v; samples = []; draw(); } });
    ui.button({ label: '20개 뽑기', primary: true, onClick: () => { const pr = probs(), r = V.rng(++seed * 7); samples = Array.from({ length: 20 }, () => { let u = r(), k = 0; while (k < pr.length - 1 && (u -= pr[k].p) > 0) k++; return pr[k].w; }); draw(); } });
    function probs() {
      const z = CANDS.map(([w, l]) => l / tau), m = Math.max(...z), e = z.map(v => Math.exp(v - m)), S = e.reduce((a, b) => a + b, 0);
      let items = CANDS.map(([w], i) => ({ w, p0: e[i] / S, keep: true })).sort((a, b) => b.p0 - a.p0);
      items.forEach((it, i) => { if (i >= topk) it.keep = false; });
      let acc = 0; items.forEach(it => { if (!it.keep) return; if (acc >= topp - 1e-9 && topp < 1) it.keep = false; acc += it.p0; });
      const Z = items.filter(it => it.keep).reduce((a, it) => a + it.p0, 0);
      return items.map(it => ({ w: it.w, p: it.keep ? it.p0 / Z : 0, keep: it.keep }));
    }
    function draw() {
      const pal = V.pal(); cv.size();
      const pr = probs(), ctx = cv.ctx, W = cv.w, H = cv.h, padL = 96, padR = 70, rowH = (H - 20) / pr.length;
      pr.forEach((it, i) => {
        const y = 10 + i * rowH, bw = (W - padL - padR) * it.p;
        text(ctx, it.w, padL - 8, y + rowH / 2, { align: 'right', color: it.keep ? pal.text : pal.muted });
        ctx.fillStyle = it.keep ? pal.series[0] : V.rgba(pal.border2.startsWith('#') ? pal.border2 : '#999999', .4);
        ctx.fillRect(padL, y + rowH * .18, Math.max(bw, it.keep ? 1 : 0), rowH * .64);
        const cnt = samples.filter(s2 => s2 === it.w).length;
        text(ctx, (it.p * 100).toFixed(1) + '%' + (cnt ? `  ×${cnt}` : ''), padL + Math.max(bw, 0) + 6, y + rowH / 2, { align: 'left', font: V.MONO, color: it.keep ? pal.text2 : pal.muted });
      });
      const kept = pr.filter(it => it.keep), Hn = -kept.reduce((a, it) => a + (it.p > 0 ? it.p * Math.log2(it.p) : 0), 0);
      ui.setRO(`남은 후보 ${kept.length}개, 엔트로피 ${Hn.toFixed(2)}비트${samples.length ? `,  뽑힌 20개: ${samples.join(' · ')}` : ''}`);
    }
    draw(); V.onEnv(el, draw);
  });

  V.modsReady.push('w6');
})();
