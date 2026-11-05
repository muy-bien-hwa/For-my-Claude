/* 1주차 시각화: 학습 개념, 브로드캐스팅, 벡터, 선형변환, SVD, 미분, 등고선·그래디언트, 확률분포, 우도, 교차 엔트로피 */
(function () {
  'use strict';
  const fmt = V.fmt;

  /* ===== 1. 파라미터 탐색으로 보는 학습 ===== */
  V.register('learn-1d', el => {
    const ui = V.shell(el, {
      title: '학습 = 손실을 가장 작게 만드는 파라미터 찾기',
      desc: '섭씨 온도 $x$로 화씨 온도 $y$를 예측하는 모델 $\\hat y = w\\,x + 32$에서 기울기 $w$만 모른다고 하자. 왼쪽은 데이터와 현재 모델, 오른쪽은 $w$ 값마다 계산한 평균제곱오차 $L(w)$이다.',
      how: ['왼쪽 점: 측정된 (섭씨, 화씨) 쌍. 파란 직선: 현재 $w$의 모델.', '왼쪽 빨간 세로선: 각 점의 오차(잔차). 길수록 예측이 틀린 것.', '오른쪽 곡선: $w$에 따른 손실. 회색 점은 탐색으로 시험한 $w$, 파란 점은 현재 $w$.'],
      try: ['슬라이더로 $w$를 움직여 잔차가 가장 짧아지는 지점을 찾는다.', '"무차별 탐색"을 눌러 $w$를 0부터 3.5까지 차례로 시험하는 과정을 본다.', '손실 곡선의 최저점이 실제 변환식의 1.8과 일치하는지 확인한다.']
    });
    const row = ui.row(2);
    const c1 = ui.canvas(ui.panel(row, '데이터와 모델'), 0, { aspect: .75, maxH: 340 });
    const c2 = ui.canvas(ui.panel(row, '손실 L(w)'), 0, { aspect: .75, maxH: 340 });
    const r = V.rng(7);
    const D = Array.from({ length: 18 }, () => { const x = -10 + 50 * r(); return [x, 1.8 * x + 32 + V.gauss(r) * 4]; });
    const L = w => D.reduce((s, [x, y]) => s + (w * x + 32 - y) ** 2, 0) / D.length;
    let w = 0.6, scanned = [], anim = null;
    const s = ui.slider({ label: '기울기 w', min: 0, max: 3.5, step: 0.01, value: w, fmt: v => v.toFixed(2), onInput: v => { w = v; draw(); } });
    const btn = ui.button({ label: '무차별 탐색', primary: true, onClick: () => {
      if (anim) return; scanned = []; let ws = 0;
      anim = V.loop(() => { scanned.push([ws, L(ws)]); w = ws; s.value = ws; draw(); ws = +(ws + 0.05).toFixed(2); if (ws > 3.5) { anim = null; const best = scanned.reduce((a, b) => b[1] < a[1] ? b : a); w = best[0]; s.value = w; draw(); return false; } });
    } });
    ui.button({ label: '초기화', onClick: () => { if (anim) { anim.stop(); anim = null; } scanned = []; w = 0.6; s.value = w; draw(); } });
    function draw() {
      const pal = V.pal();
      c1.size(); c2.size();
      const P = V.plot(c1, { x: [-12, 42], y: [-10, 120], xlabel: '섭씨 x (°C)', ylabel: '화씨 y (°F)' }).axes();
      P.clip();
      D.forEach(([x, y]) => { const yh = w * x + 32; P.line([[x, y], [x, yh]], V.rgba(pal.bad, .7), 1.5); });
      P.fn(x => w * x + 32, pal.series[0], 2.4);
      D.forEach(([x, y]) => P.dot(x, y, 4, pal.text));
      P.unclip();
      const Q = V.plot(c2, { x: [0, 3.5], y: [0, Math.max(L(0), L(3.5)) * 1.05], xlabel: '기울기 w', ylabel: '평균제곱오차 L(w)' }).axes();
      Q.fn(L, V.rgba(pal.muted, .55), 1.5, [5, 4]);
      scanned.forEach(([a, b]) => Q.dot(a, b, 3, V.rgba(pal.muted, .9)));
      Q.dot(w, L(w), 6, pal.series[0], pal.surface);
      if (scanned.length) { const best = scanned.reduce((a, b) => b[1] < a[1] ? b : a); Q.label(best[0], best[1], `최소 w ≈ ${best[0].toFixed(2)}`, { dy: -18, align: 'center', bold: true }); }
      ui.setRO(`w = ${w.toFixed(2)}   L(w) = ${fmt(L(w), 2)}   (참값 w = 1.8 근처에서 최소)`);
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 2. 브로드캐스팅 ===== */
  V.register('broadcast', el => {
    const presets = [
      ['(3, 4) + (4,)', [3, 4], [4]], ['(3, 4) + (3, 1)', [3, 4], [3, 1]], ['(3, 1) + (1, 4)', [3, 1], [1, 4]],
      ['(4, 1) + (3,)', [4, 1], [3]], ['(3, 4) + (3,)', [3, 4], [3]], ['(2, 3) + (2, 3)', [2, 3], [2, 3]], ['(3, 4) + ()', [3, 4], []]
    ];
    const ui = V.shell(el, {
      title: '브로드캐스팅: 형상이 다른 배열의 연산',
      desc: '두 형상을 오른쪽 끝부터 맞춰 비교한다. 각 축의 길이가 같거나 한쪽이 1이면 1인 쪽을 늘려 맞추고, 그 외에는 오류다. 연한 칸은 실제로 복사되지 않고 늘어난 것처럼 취급되는 값이다.',
      how: ['진한 칸: 원래 배열의 값. 연한 칸: 늘어난(가상) 값.', '아래 표: 오른쪽 축부터 길이를 비교한 결과.'],
      try: ['(3, 4) + (3,)이 왜 오류인지 표에서 확인한다.', '(3, 1) + (1, 4)의 결과가 (3, 4)가 되는 과정을 본다. 이것이 외적을 만드는 방법이다.', '(4, 1) + (3,)은 어떤 형상이 되는지 예측한 뒤 확인한다.']
    });
    const cv = ui.canvas(ui.body, 160);
    const tbl = document.createElement('div'); ui.body.appendChild(tbl);
    let cur = 0;
    ui.select({ label: '연산', options: presets.map((p, i) => [i, p[0]]), value: 0, onChange: v => { cur = +v; draw(); } });
    const as2d = s => s.length === 0 ? [1, 1] : s.length === 1 ? [1, s[0]] : s;
    function rule(a, b) {
      const n = Math.max(a.length, b.length), A = Array(n - a.length).fill(null).concat(a), B = Array(n - b.length).fill(null).concat(b);
      const rows = [], out = [];
      for (let i = 0; i < n; i++) {
        const x = A[i], y = B[i];
        if (x === null || y === null) { rows.push([x, y, '없는 축은 1로 봄', x ?? y]); out.push(x ?? y); }
        else if (x === y) { rows.push([x, y, '같음', x]); out.push(x); }
        else if (x === 1 || y === 1) { rows.push([x, y, '1인 쪽을 늘림', Math.max(x, y)]); out.push(Math.max(x, y)); }
        else { rows.push([x, y, '불일치 → 오류', '—']); out.push(null); }
      }
      return { rows, out: out.includes(null) ? null : out };
    }
    function grid(ctx, x, y, cs, R, Cc, realR, realC, color, label) {
      const pal = V.pal();
      for (let i = 0; i < R; i++) for (let j = 0; j < Cc; j++) {
        const real = i < realR && j < realC;
        ctx.fillStyle = real ? color : V.rgba(color, .22);
        ctx.fillRect(x + j * cs + 1, y + i * cs + 1, cs - 2, cs - 2);
      }
      ctx.strokeStyle = pal.border2; ctx.strokeRect(x + .5, y + .5, Cc * cs, R * cs);
      V.label(ctx, x + Cc * cs / 2, y - 12, label, { align: 'center', bg: false, color: pal.text2, bold: true });
    }
    function draw() {
      const pal = V.pal();
      const [name, a, b] = presets[cur];
      const res = rule(a, b);
      const A2 = as2d(a), B2 = as2d(b);
      const R = res.out ? as2d(res.out)[0] : Math.max(A2[0], B2[0]), Cc = res.out ? as2d(res.out)[1] : Math.max(A2[1], B2[1]);
      const W = cv.el.parentElement.clientWidth;
      const cs = Math.min(28, (W - 140) / (A2[1] + B2[1] + Cc * 3 + 6));
      cv.hOpt = Math.max(R, A2[0], B2[0]) * cs + 60; cv.size(); const ctx = cv.ctx;
      let x = 10; const y = 40;
      const sa = `(${a.join(', ')}${a.length === 1 ? ',' : ''})`, sb = `(${b.join(', ')}${b.length === 1 ? ',' : ''})`;
      grid(ctx, x, y, cs, A2[0], A2[1], A2[0], A2[1], pal.series[0], 'A ' + sa); x += A2[1] * cs + 24;
      V.label(ctx, x - 12, y + A2[0] * cs / 2, '+', { align: 'center', bg: false, font: '600 18px sans-serif', color: pal.text });
      grid(ctx, x, y, cs, B2[0], B2[1], B2[0], B2[1], pal.series[1], 'B ' + (b.length ? sb : '()')); x += B2[1] * cs + 30;
      V.arrowPx(ctx, x - 22, y + Math.max(A2[0], B2[0]) * cs / 2, x - 6, y + Math.max(A2[0], B2[0]) * cs / 2, pal.muted, 2, 7);
      if (res.out) {
        grid(ctx, x, y, cs, R, Cc, A2[0], A2[1], pal.series[0], 'A 확장'); x += Cc * cs + 16;
        grid(ctx, x, y, cs, R, Cc, B2[0], B2[1], pal.series[1], 'B 확장'); x += Cc * cs + 28;
        V.label(ctx, x - 14, y + R * cs / 2, '=', { align: 'center', bg: false, font: '600 18px sans-serif', color: pal.text });
        grid(ctx, x, y, cs, R, Cc, R, Cc, pal.series[2], `결과 (${res.out.join(', ')})`);
      } else {
        V.label(ctx, x + 6, y + 30, '오류: 형상을 맞출 수 없다', { bg: false, color: pal.bad, bold: true });
      }
      tbl.innerHTML = `<table style="margin:12px 0 0;font-size:13.5px"><thead><tr><th>축 (오른쪽부터 정렬)</th>${res.rows.map((_, i) => `<th>${i - res.rows.length}</th>`).join('')}</tr></thead><tbody>
        <tr><td>A</td>${res.rows.map(r => `<td>${r[0] ?? '·'}</td>`).join('')}</tr>
        <tr><td>B</td>${res.rows.map(r => `<td>${r[1] ?? '·'}</td>`).join('')}</tr>
        <tr><td>판정</td>${res.rows.map(r => `<td style="color:${r[2].includes('오류') ? 'var(--bad)' : 'inherit'}">${r[2]}</td>`).join('')}</tr>
        <tr><td>결과</td>${res.rows.map(r => `<td><b>${r[3]}</b></td>`).join('')}</tr></tbody></table>`;
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 3. 벡터와 내적 ===== */
  V.register('vectors', el => {
    const ui = V.shell(el, {
      title: '벡터 연산, 내적, 투영',
      desc: '두 화살표의 끝점을 끌어 움직인다. 내적 $a\\cdot b = a_1b_1 + a_2b_2 = \\|a\\|\\|b\\|\\cos\\theta$는 두 벡터가 같은 방향을 가리키는 정도다.',
      how: ['파랑 $a$, 빨강 $b$. 초록 점선: $a$를 $b$ 방향으로 투영한 성분.', '회색 평행사변형: 벡터 합 $a+b$를 만드는 방법(끝을 이어 붙이기).', '내적이 양수면 예각, 0이면 직각, 음수면 둔각.'],
      try: ['$b$를 $a$와 직각이 되게 놓고 내적이 0인지 확인한다.', '$a$의 길이만 두 배로 늘리면 내적과 코사인 유사도가 각각 어떻게 변하는지 비교한다.', '두 벡터를 반대 방향으로 놓아 코사인 유사도가 -1에 가까워지는지 본다.']
    });
    const cv = ui.canvas(ui.body, 0, { aspect: .62, maxH: 420 });
    let a = [3, 1], b = [1, 2.5], drag = null;
    const tSum = ui.toggle({ label: '합 a+b', value: true, onChange: draw });
    const tProj = ui.toggle({ label: '투영', value: true, onChange: draw });
    let P;
    cv.drag({
      down: (x, y) => { const pa = [P.X(a[0]), P.Y(a[1])], pb = [P.X(b[0]), P.Y(b[1])]; drag = Math.hypot(x - pa[0], y - pa[1]) < Math.hypot(x - pb[0], y - pb[1]) ? 'a' : 'b'; this_move(x, y); },
      move: (x, y) => this_move(x, y), up: () => { drag = null; }
    });
    function this_move(x, y) { const v = [Math.round(P.ix(x) * 4) / 4, Math.round(P.iy(y) * 4) / 4]; if (drag === 'a') a = v; else b = v; draw(); }
    function draw() {
      const pal = V.pal(); cv.size();
      P = V.plot(cv, { x: [-5, 5], y: [-3.2, 3.2], equal: true, xlabel: 'x₁', ylabel: 'x₂' }).axes({ xstep: 1, ystep: 1 });
      const dot = a[0] * b[0] + a[1] * b[1], na = Math.hypot(...a), nb = Math.hypot(...b);
      const cos = dot / (na * nb || 1), th = Math.acos(V.clamp(cos, -1, 1)) * 180 / Math.PI;
      if (tSum.value) {
        P.ctx.fillStyle = V.rgba(pal.muted, .12); P.ctx.beginPath();
        [[0, 0], a, [a[0] + b[0], a[1] + b[1]], b].forEach(([x, y], i) => i ? P.ctx.lineTo(P.X(x), P.Y(y)) : P.ctx.moveTo(P.X(x), P.Y(y))); P.ctx.closePath(); P.ctx.fill();
        P.line([a, [a[0] + b[0], a[1] + b[1]]], pal.muted, 1, [4, 4]).line([b, [a[0] + b[0], a[1] + b[1]]], pal.muted, 1, [4, 4]);
        P.arrow(0, 0, a[0] + b[0], a[1] + b[1], pal.text2, 1.8);
        P.label(a[0] + b[0], a[1] + b[1], 'a+b', { dx: 8, dy: -10, color: pal.text2 });
      }
      if (tProj.value && nb > 0) {
        const k = dot / (nb * nb), pr = [b[0] * k, b[1] * k];
        P.line([a, pr], pal.ok, 1.5, [4, 4]); P.line([[0, 0], pr], pal.ok, 4);
        P.label(pr[0], pr[1], `투영 길이 ${fmt(dot / nb, 2)}`, { dx: 8, dy: 14, color: pal.ok });
      }
      P.arrow(0, 0, a[0], a[1], pal.series[0], 2.6, 11).arrow(0, 0, b[0], b[1], pal.series[1], 2.6, 11);
      P.dot(a[0], a[1], 6, pal.series[0], pal.surface).dot(b[0], b[1], 6, pal.series[1], pal.surface);
      P.label(a[0], a[1], `a (${a.join(', ')})`, { dx: 10, dy: -12, color: pal.series[0], bold: true });
      P.label(b[0], b[1], `b (${b.join(', ')})`, { dx: 10, dy: -12, color: pal.series[1], bold: true });
      ui.setRO(`a·b = ${a[0]}×${b[0]} + ${a[1]}×${b[1]} = ${fmt(dot, 3)}\n‖a‖ = ${fmt(na, 3)}   ‖b‖ = ${fmt(nb, 3)}   cos θ = ${fmt(cos, 3)}   θ = ${fmt(th, 1)}°`);
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 4. 행렬 = 공간의 변환 ===== */
  V.register('matrix-transform', el => {
    const presets = { '항등': [1, 0, 0, 1], '회전 30°': [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6), -Math.sin(Math.PI / 6), Math.cos(Math.PI / 6)], '늘이기': [2, 0, 0, 0.5], '기울이기': [1, 0, 1, 1], '반사': [1, 0, 0, -1], '납작하게 (행렬식 0)': [1, 0.5, 2, 1], '대칭 행렬': [2, 1, 1, 2] };
    const ui = V.shell(el, {
      title: '행렬 = 공간을 바꾸는 함수',
      desc: '행렬 $A=\\begin{bmatrix}a & c\\\\ b & d\\end{bmatrix}$의 첫 열 $(a,b)$는 기저벡터 $\\hat\\imath=(1,0)$이, 둘째 열 $(c,d)$는 $\\hat\\jmath=(0,1)$이 옮겨 가는 위치다. 빨강·초록 화살표 끝을 끌어 행렬을 바꾼다.',
      how: ['연한 회색 격자: 원래 공간. 진한 격자: 변환된 공간.', '파란 평행사변형: 단위 정사각형이 변환된 모양. 넓이 = |행렬식|. 주황색이면 방향이 뒤집힌 것(행렬식 < 0).', '점선: 고유벡터 방향. 이 방향의 벡터는 변환 후에도 방향이 그대로이고 길이만 λ배.'],
      try: ['"납작하게"를 골라 평행사변형 넓이가 0이 되는 것을 본다. 이 행렬은 역행렬이 없다.', '"대칭 행렬"에서 고유벡터 두 개가 직교하는지 확인한다.', '진행 슬라이더를 0에서 1로 움직여 변환이 연속적으로 일어나는 모습을 본다.']
    });
    const cv = ui.canvas(ui.body, 0, { aspect: .62, maxH: 440 });
    let M = presets['기울이기'].slice(), t = 1, drag = null, P;
    ui.select({ label: '예시', options: Object.keys(presets).map(k => [k, k]), value: '기울이기', onChange: v => { M = presets[v].slice(); draw(); } });
    const st = ui.slider({ label: '진행 t', min: 0, max: 1, step: 0.01, value: 1, fmt: v => v.toFixed(2), onInput: v => { t = v; draw(); } });
    const tEig = ui.toggle({ label: '고유벡터', value: true, onChange: draw });
    cv.drag({
      down: (x, y) => { const e1 = [P.X(M[0]), P.Y(M[1])], e2 = [P.X(M[2]), P.Y(M[3])]; drag = Math.hypot(x - e1[0], y - e1[1]) < Math.hypot(x - e2[0], y - e2[1]) ? 0 : 2; t = 1; st.value = 1; mv(x, y); },
      move: (x, y) => mv(x, y), up: () => { drag = null; }
    });
    function mv(x, y) { M[drag] = Math.round(P.ix(x) * 10) / 10; M[drag + 1] = Math.round(P.iy(y) * 10) / 10; draw(); }
    function draw() {
      const pal = V.pal(); cv.size();
      const A = [1 + (M[0] - 1) * t, M[1] * t, M[2] * t, 1 + (M[3] - 1) * t];
      const T = ([x, y]) => [A[0] * x + A[2] * y, A[1] * x + A[3] * y];
      P = V.plot(cv, { x: [-4.5, 4.5], y: [-3, 3], equal: true, grid: false }).axes({ xstep: 1, ystep: 1 });
      const ctx = P.ctx; P.clip();
      for (let k = -8; k <= 8; k++) { P.line([[k, -8], [k, 8]], V.rgba(pal.muted, .25), 1); P.line([[-8, k], [8, k]], V.rgba(pal.muted, .25), 1); }
      for (let k = -8; k <= 8; k++) { P.line([T([k, -8]), T([k, 8])], V.rgba(pal.series[0], .45), 1); P.line([T([-8, k]), T([8, k])], V.rgba(pal.series[0], .45), 1); }
      const det = A[0] * A[3] - A[1] * A[2];
      ctx.fillStyle = det >= 0 ? V.rgba(pal.series[0], .22) : V.rgba(pal.warn, .3); ctx.beginPath();
      [[0, 0], [1, 0], [1, 1], [0, 1]].map(T).forEach(([x, y], i) => i ? ctx.lineTo(P.X(x), P.Y(y)) : ctx.moveTo(P.X(x), P.Y(y))); ctx.closePath(); ctx.fill();
      // 고유값
      const tr = M[0] + M[3], dt = M[0] * M[3] - M[1] * M[2], disc = tr * tr / 4 - dt;
      let eigTxt = '고윳값: 실수 없음 (회전 성분)';
      if (disc >= -1e-9) {
        const l1 = tr / 2 + Math.sqrt(Math.max(0, disc)), l2 = tr / 2 - Math.sqrt(Math.max(0, disc));
        eigTxt = `고윳값 λ₁ = ${fmt(l1, 3)}, λ₂ = ${fmt(l2, 3)}`;
        if (tEig.value) [l1, l2].forEach((l, i) => {
          let v = Math.abs(M[2]) > 1e-9 ? [M[2], l - M[0]] : Math.abs(M[1]) > 1e-9 ? [l - M[3], M[1]] : (i === 0 ? [1, 0] : [0, 1]);
          const n = Math.hypot(...v); v = [v[0] / n, v[1] / n];
          P.line([[-v[0] * 9, -v[1] * 9], [v[0] * 9, v[1] * 9]], i ? pal.series[4] : pal.series[3], 1.5, [6, 5]);
        });
      }
      P.unclip();
      const e1 = T([1, 0]), e2 = T([0, 1]);
      P.arrow(0, 0, e1[0], e1[1], pal.series[1], 2.8, 11).arrow(0, 0, e2[0], e2[1], pal.series[2], 2.8, 11);
      P.dot(e1[0], e1[1], 6, pal.series[1], pal.surface).dot(e2[0], e2[1], 6, pal.series[2], pal.surface);
      P.label(e1[0], e1[1], 'î 의 위치', { dx: 10, dy: 12, color: pal.series[1], bold: true });
      P.label(e2[0], e2[1], 'ĵ 의 위치', { dx: 10, dy: -12, color: pal.series[2], bold: true });
      ui.setRO(`A = [[${fmt(M[0], 2)}, ${fmt(M[2], 2)}], [${fmt(M[1], 2)}, ${fmt(M[3], 2)}]]   행렬식 det A = ${fmt(dt, 3)}   ${eigTxt}`);
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 5. SVD 저랭크 근사 ===== */
  function jacobiEig(S) {      // 대칭행렬 고윳값 분해 (순환 야코비)
    const n = S.length, A = S.map(r => r.slice()), Vm = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => +(i === j)));
    for (let sweep = 0; sweep < 12; sweep++) {
      let off = 0; for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
      if (off < 1e-10) break;
      for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-12) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), tt = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(tt * tt + 1), s = tt * c;
        for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = Vm[k][p], vkq = Vm[k][q]; Vm[k][p] = c * vkp - s * vkq; Vm[k][q] = s * vkp + c * vkq; }
      }
    }
    const idx = A.map((r, i) => i).sort((i, j) => A[j][j] - A[i][i]);
    return { vals: idx.map(i => A[i][i]), vecs: idx.map(i => Vm.map(r => r[i])) };
  }
  function makeImage(kind, N) {
    const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, N, N); g.fillStyle = '#000';
    if (kind === 'text') { g.font = `700 ${N * .55}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('DL', N / 2, N / 2 + 2); }
    else if (kind === 'shapes') { g.beginPath(); g.arc(N * .32, N * .35, N * .2, 0, 7); g.fill(); g.fillRect(N * .55, N * .5, N * .32, N * .32); g.fillRect(0, N * .9, N, N * .06); }
    else { const im = g.createImageData(N, N); const r = V.rng(5); for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const v = 128 + 90 * Math.sin(i / 7) * Math.cos(j / 9) + 30 * (V.gauss(r)); const o = (i * N + j) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = V.clamp(v, 0, 255); im.data[o + 3] = 255; } g.putImageData(im, 0, 0); }
    const d = g.getImageData(0, 0, N, N).data;
    return Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => 1 - d[(i * N + j) * 4] / 255));
  }
  V.register('svd', el => {
    const N = 48;
    const ui = V.shell(el, {
      title: 'SVD로 이미지 압축하기',
      desc: `${N}×${N} 흑백 이미지를 행렬 $A$로 보고 특잇값 분해 $A=\\sum_i \\sigma_i u_i v_i^\\top$를 한다. 큰 특잇값 $k$개만 남긴 $A_k$는 랭크 $k$ 행렬 중 $A$에 가장 가까운 행렬이다.`,
      how: ['왼쪽: 원본, 가운데: 랭크 $k$ 근사, 오른쪽: 특잇값 크기(로그 눈금). 세로선 왼쪽이 사용한 성분.', '저장량: $k(m+n+1)$개 수로 $mn$개 픽셀을 근사한다.'],
      try: ['$k$를 1부터 늘리며 이미지가 어떤 순서로 복원되는지 본다(큰 구조 → 세부).', '"노이즈 무늬"는 특잇값이 천천히 줄어 압축이 잘 안 됨을 확인한다.', '오차가 5% 아래로 떨어지는 최소 $k$를 찾는다.']
    });
    const row = ui.row(3);
    const pans = ['원본', '근사', '특잇값'].map(t => ui.panel(row, t));
    const cs = pans.map(p => ui.canvas(p, 0, { aspect: 1, maxH: 260, minH: 120 }));
    let kind = 'text', k = 4, A, svd;
    function compute() {
      A = makeImage(kind, N);
      const AtA = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => { let s = 0; for (let r = 0; r < N; r++) s += A[r][i] * A[r][j]; return s; }));
      const { vals, vecs } = jacobiEig(AtA);
      const sig = vals.map(v => Math.sqrt(Math.max(v, 0)));
      const U = vecs.map((v, i) => Array.from({ length: N }, (_, r) => { let s = 0; for (let c = 0; c < N; c++) s += A[r][c] * v[c]; return sig[i] > 1e-9 ? s / sig[i] : 0; }));
      svd = { sig, V: vecs, U };
    }
    ui.select({ label: '이미지', options: [['text', '글자'], ['shapes', '도형'], ['noise', '노이즈 무늬']], value: kind, onChange: v => { kind = v; compute(); draw(); } });
    ui.slider({ label: '랭크 k', min: 1, max: N, step: 1, value: k, fmt: v => String(v), onInput: v => { k = v; draw(); } });
    function img(cv, M) {
      cv.size(); const ctx = cv.ctx, s = Math.min(cv.w, cv.h) / N, ox = (cv.w - s * N) / 2;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const v = 255 - V.clamp(M[i][j], 0, 1) * 255 | 0; ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(ox + j * s, i * s, s + .5, s + .5); }
    }
    function draw() {
      const pal = V.pal();
      const Ak = Array.from({ length: N }, () => new Array(N).fill(0));
      for (let t = 0; t < k; t++) { const s = svd.sig[t], u = svd.U[t], v = svd.V[t]; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) Ak[i][j] += s * u[i] * v[j]; }
      img(cs[0], A); img(cs[1], Ak);
      let num = 0, den = 0; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { num += (A[i][j] - Ak[i][j]) ** 2; den += A[i][j] ** 2; }
      const c = cs[2]; c.size();
      const lg = svd.sig.map(s => Math.log10(Math.max(s, 1e-3)));
      const P = V.plot(c, { x: [0, N], y: [Math.min(...lg) - .2, Math.max(...lg) + .2], xlabel: '성분 번호', ylabel: 'log₁₀ σ', pad: { l: 40, b: 38, r: 8 } }).axes({ xstep: 16 });
      lg.forEach((v, i) => P.dot(i + .5, v, 2.4, i < k ? pal.series[0] : V.rgba(pal.muted, .7)));
      P.line([[k, P.yr[0]], [k, P.yr[1]]], pal.bad, 1.5, [4, 3]);
      ui.setRO(`k = ${k}   상대 오차 ‖A−A_k‖/‖A‖ = ${(Math.sqrt(num / den) * 100).toFixed(1)}%   저장량 ${k * (2 * N + 1)} / ${N * N} = ${(k * (2 * N + 1) / (N * N) * 100).toFixed(0)}%`);
    }
    compute(); draw(); V.onEnv(el, draw);
  });

  /* ===== 6. 미분 = 접선의 기울기 ===== */
  V.register('derivative', el => {
    const F = {
      'x²': [x => x * x, x => 2 * x, [-3, 3], [-1, 9], [-6.5, 6.5]],
      'sin x': [Math.sin, Math.cos, [-6.3, 6.3], [-1.5, 1.5], [-1.5, 1.5]],
      'x³ − 3x': [x => x ** 3 - 3 * x, x => 3 * x * x - 3, [-2.5, 2.5], [-5, 5], [-4, 16]],
      'σ(x) 시그모이드': [x => 1 / (1 + Math.exp(-x)), x => { const s = 1 / (1 + Math.exp(-x)); return s * (1 - s); }, [-7, 7], [-.2, 1.2], [-.05, .3]],
      'ReLU max(0,x)': [x => Math.max(0, x), x => x > 0 ? 1 : 0, [-3, 3], [-.5, 3], [-.3, 1.3]]
    };
    const ui = V.shell(el, {
      title: '미분 = 접선의 기울기',
      desc: '위 그래프를 끌어 점 $x$를 옮긴다. 주황 점선(할선)의 기울기 $\\frac{f(x+h)-f(x)}{h}$는 $h\\to0$일 때 파란 접선의 기울기 $f\'(x)$에 다가간다. 아래 그래프는 모든 $x$에서의 기울기를 모은 도함수 $f\'(x)$다.',
      how: ['위: 함수 $f(x)$, 파란 접선, 주황 할선.', '아래: 도함수 $f\'(x)$. 위에서 접선이 가파를수록 아래 값이 크다.', '접선이 수평인 곳(극대·극소)에서 $f\'(x)=0$.'],
      try: ['$h$를 줄여 할선 기울기와 $f\'(x)$의 오차가 0에 가까워지는 것을 본다.', '"x³ − 3x"에서 $f\'(x)=0$인 두 점을 찾는다.', '시그모이드에서 $|x|$가 클 때 기울기가 거의 0인 것을 확인한다. 이것이 7주 뒤에 볼 기울기 소실의 원인이다.']
    });
    const c1 = ui.canvas(ui.panel(ui.body, '함수 f(x)'), 0, { aspect: .42, minH: 210, maxH: 300 });
    const c2 = ui.canvas(ui.panel(ui.body, '도함수 f′(x)'), 0, { aspect: .26, minH: 140, maxH: 200 });
    let name = 'x³ − 3x', x0 = 1.6, h = 0.8, P;
    ui.select({ label: '함수', options: Object.keys(F).map(k => [k, k]), value: name, onChange: v => { name = v; x0 = (F[v][2][0] + F[v][2][1]) / 2 + 0.7; draw(); } });
    ui.slider({ label: 'h', min: 0.01, max: 2, step: 0.01, value: h, fmt: v => v.toFixed(2), onInput: v => { h = v; draw(); } });
    const mv = x => { const [, , xr] = F[name]; x0 = V.clamp(P.ix(x), xr[0], xr[1] - .01); draw(); };
    c1.drag({ down: mv, move: mv });
    function draw() {
      const pal = V.pal(); c1.size(); c2.size();
      const [f, df, xr, yr, dr] = F[name];
      P = V.plot(c1, { x: xr, y: yr, xlabel: '' }).axes();
      P.clip();
      P.fn(f, pal.text, 2.4);
      const m = df(x0), ms = (f(x0 + h) - f(x0)) / h;
      P.fn(x => f(x0) + ms * (x - x0), pal.warn, 1.8, [6, 4]);
      P.fn(x => f(x0) + m * (x - x0), pal.series[0], 2);
      P.unclip();
      P.dot(x0 + h, f(x0 + h), 5, pal.warn).dot(x0, f(x0), 6, pal.series[0], pal.surface);
      const Q = V.plot(c2, { x: xr, y: dr, xlabel: 'x' }).axes();
      Q.clip(); Q.fn(df, pal.series[0], 2.2); Q.line([[x0, dr[0]], [x0, dr[1]]], V.rgba(pal.muted, .6), 1, [3, 3]); Q.unclip();
      Q.dot(x0, df(x0), 5.5, pal.series[0], pal.surface);
      ui.setRO(`x = ${fmt(x0, 3)}   f(x) = ${fmt(f(x0), 4)}   f′(x) = ${fmt(m, 4)}   할선 기울기(h=${h.toFixed(2)}) = ${fmt(ms, 4)}   오차 = ${fmt(Math.abs(ms - m), 4)}`);
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 7. 등고선과 그래디언트 ===== */
  const SURF = {
    bowl: { name: '그릇 x² + y²', f: (x, y) => x * x + y * y, g: (x, y) => [2 * x, 2 * y], r: [-2.5, 2.5], z: [0, 12.5], c: 2 },
    ellipse: { name: '길쭉한 그릇 x²/4 + y²', f: (x, y) => x * x / 4 + y * y, g: (x, y) => [x / 2, 2 * y], r: [-3, 3], z: [0, 11], c: 1 },
    saddle: { name: '안장 x² − y²', f: (x, y) => x * x - y * y, g: (x, y) => [2 * x, -2 * y], r: [-2, 2], z: [-4, 4], c: 1 },
    hills: { name: '봉우리 둘', f: (x, y) => 3 * Math.exp(-((x - 1) ** 2 + (y - .6) ** 2)) + 2 * Math.exp(-((x + 1.2) ** 2 + (y + .8) ** 2) / .8) - .15 * (x * x + y * y), g: null, r: [-3, 3], z: [-2.8, 3.2], c: 1.5 }
  };
  SURF.hills.g = (x, y) => { const e = 1e-4, f = SURF.hills.f; return [(f(x + e, y) - f(x - e, y)) / (2 * e), (f(x, y + e) - f(x, y - e)) / (2 * e)]; };
  V.register('gradient-field', el => {
    const ui = V.shell(el, {
      title: '등고선, 3D 곡면, 그래디언트',
      desc: '2변수 함수 $f(x,y)$는 높이가 있는 지형이다. 오른쪽 3D 곡면을 높이 $c$에서 수평으로 자르면 단면 곡선이 생기고, 그것을 위에서 내려다본 것이 왼쪽의 등고선이다. 왼쪽 지도에서 점 $P$를 끌어 움직이고, 오른쪽 곡면은 끌어서 회전한다.',
      how: ['왼쪽 색: 높이(함수값). 진한 파랑일수록 낮다. 각 선 위의 숫자가 그 등고선의 높이.', '굵은 주황 선: 슬라이더로 고른 높이 $c$의 등고선. 오른쪽에서도 같은 높이의 단면이 주황색으로 보인다.', '빨간 화살표: 점 $P$의 그래디언트 $\\nabla f$ (가장 가파르게 올라가는 방향). 항상 등고선에 수직이다.', '회색 작은 화살표: 여러 위치의 그래디언트. 등고선이 촘촘한 곳에서 길다.'],
      try: ['$c$를 바꾸며 단면 곡선과 등고선이 같은 모양인지 확인한다.', '$P$를 여러 곳으로 옮겨 빨간 화살표가 등고선과 항상 직각인지 본다.', '"안장"에서 가운데 점의 그래디언트가 0이지만 최소점이 아님을 확인한다.', '방향 각도를 돌려 방향 미분이 그래디언트 방향에서 최대, 수직 방향에서 0이 되는지 본다.']
    });
    const row = ui.row(2);
    const c1 = ui.canvas(ui.panel(row, '등고선 지도 (위에서 본 모습)'), 0, { aspect: .86, maxH: 420 });
    const c2 = ui.canvas(ui.panel(row, '3D 곡면 (끌어서 회전)'), 0, { aspect: .86, maxH: 420 });
    let key = 'bowl', S = SURF[key], p = [1.2, 0.9], ang = 30, cut = S.c, P;
    const view = { yaw: -0.7, pitch: 0.75 };
    const sCut = { el: null };
    ui.select({ label: '함수', options: Object.entries(SURF).map(([k, v]) => [k, v.name]), value: key, onChange: v => { key = v; S = SURF[v]; cut = S.c; sCut.ref.value = cut; sCut.ref.input.min = S.z[0]; sCut.ref.input.max = S.z[1]; p = [S.r[1] * .45, S.r[1] * .3]; draw(); } });
    sCut.ref = ui.slider({ label: '단면 높이 c', min: S.z[0], max: S.z[1], step: 0.05, value: cut, fmt: v => v.toFixed(2), onInput: v => { cut = v; draw(); } });
    ui.slider({ label: '방향 각도', min: 0, max: 360, step: 1, value: ang, fmt: v => v + '°', onInput: v => { ang = v; draw(); } });
    const tArr = ui.toggle({ label: '그래디언트 장', value: true, onChange: draw });
    const mv = (x, y) => { if (!P.inside(x, y)) return; p = [P.ix(x), P.iy(y)]; draw(); };
    c1.drag({ down: mv, move: mv });
    V.orbit(c2, view, () => draw());
    function draw() {
      const pal = V.pal(); c1.size(); c2.size();
      P = V.plot(c1, { x: S.r, y: S.r, equal: true, xlabel: 'x', ylabel: 'y', pad: { r: 64 } });
      const info = V.contour(P, S.f, { n: 8, mode: 'linear' });
      P.axes({ zero: false });
      V.colorbar(P.ctx, P.box.x1 + 12, P.box.y0 + 20, 12, P.box.y1 - P.box.y0 - 40, info, 'f 값');
      P.clip();
      const segs = V.iso(S.f, P.xr, P.yr, cut, 120, 120);
      P.ctx.strokeStyle = pal.warn; P.ctx.lineWidth = 3; P.ctx.beginPath();
      segs.forEach(([a, b]) => { P.ctx.moveTo(P.X(a[0]), P.Y(a[1])); P.ctx.lineTo(P.X(b[0]), P.Y(b[1])); }); P.ctx.stroke();
      if (tArr.value) {
        const n = 9, step = (S.r[1] - S.r[0]) / n;
        let gmax = 0; const pts = [];
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const x = S.r[0] + step * (i + .5), y = S.r[0] + step * (j + .5), g = S.g(x, y); gmax = Math.max(gmax, Math.hypot(...g)); pts.push([x, y, g]); }
        pts.forEach(([x, y, g]) => { const s = step * .42 / (gmax || 1); P.arrow(x, y, x + g[0] * s, y + g[1] * s, V.rgba(pal.text2, .55), 1.2, 5); });
      }
      const g = S.g(p[0], p[1]), gn = Math.hypot(...g), u = [Math.cos(ang * Math.PI / 180), Math.sin(ang * Math.PI / 180)];
      const L = (S.r[1] - S.r[0]) * .22;
      if (gn > 1e-6) P.arrow(p[0], p[1], p[0] + g[0] / gn * L, p[1] + g[1] / gn * L, pal.bad, 2.6, 10);
      P.arrow(p[0], p[1], p[0] + u[0] * L * .8, p[1] + u[1] * L * .8, pal.series[4], 2, 8);
      P.unclip();
      P.dot(p[0], p[1], 6, pal.text, pal.surface);
      P.label(p[0], p[1], 'P', { dx: -14, dy: -12, bold: true });
      const { proj } = V.surface3d(c2, S.f, { xr: S.r, yr: S.r, zr: S.z, n: 30, yaw: view.yaw, pitch: view.pitch, levels: info.levels, xlabel: 'x', ylabel: 'y', zlabel: 'f', marks: [{ x: p[0], y: p[1], color: pal.text, r: 5, label: 'P' }] });
      // 단면: 같은 높이 c의 곡선과 자르는 평면
      const ctx = c2.ctx; ctx.strokeStyle = pal.warn; ctx.lineWidth = 3; ctx.beginPath();
      V.iso(S.f, S.r, S.r, cut, 70, 70).forEach(([a, b]) => { const A = proj(a[0], a[1], cut), B = proj(b[0], b[1], cut); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); }); ctx.stroke();
      ctx.fillStyle = V.rgba(pal.warn, .1); ctx.beginPath();
      [[S.r[0], S.r[0]], [S.r[1], S.r[0]], [S.r[1], S.r[1]], [S.r[0], S.r[1]]].forEach(([x, y], i) => { const q = proj(x, y, cut); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.fill();
      ui.setRO(`P = (${fmt(p[0], 2)}, ${fmt(p[1], 2)})   f(P) = ${fmt(S.f(p[0], p[1]), 3)}   ∇f(P) = (${fmt(g[0], 3)}, ${fmt(g[1], 3)})   ‖∇f‖ = ${fmt(gn, 3)}\n방향 u = (${fmt(u[0], 2)}, ${fmt(u[1], 2)})의 방향 미분 ∇f·u = ${fmt(g[0] * u[0] + g[1] * u[1], 3)}   (최대 = ‖∇f‖, 등고선 방향 = 0)`);
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 8. 확률분포와 표본 ===== */
  V.register('distributions', el => {
    const ui = V.shell(el, {
      title: '확률분포와 표본: 큰 수의 법칙',
      desc: '분포에서 표본을 뽑아 히스토그램을 쌓는다. 표본이 많아질수록 히스토그램은 실제 분포에, 표본 평균은 기댓값에 가까워진다.',
      how: ['왼쪽 선(또는 막대 테두리): 실제 확률분포. 채운 막대: 지금까지 뽑은 표본의 비율(밀도).', '오른쪽: 표본 수에 따른 표본 평균. 점선이 기댓값 $\\mathbb E[X]$.'],
      try: ['"+10"을 여러 번 누를 때와 "+1000"을 누를 때 히스토그램 모양을 비교한다.', '가우시안의 $\\sigma$를 키우면 표본 평균이 기댓값에 수렴하는 속도가 어떻게 변하는지 본다.', '베르누이 $p=0.1$에서 표본 평균(성공 비율)이 0.1에 가까워지는지 확인한다.']
    });
    const row = ui.row(2);
    const c1 = ui.canvas(ui.panel(row, '분포와 표본 히스토그램'), 0, { aspect: .72, maxH: 320 });
    const c2 = ui.canvas(ui.panel(row, '표본 평균의 수렴'), 0, { aspect: .72, maxH: 320 });
    const r = V.rng(11);
    let kind = 'gauss', mu = 1, sigma = 1, p = .3, samples = [];
    const D = {
      gauss: { draw: () => mu + sigma * V.gauss(r), E: () => mu, Var: () => sigma * sigma },
      bern: { draw: () => r() < p ? 1 : 0, E: () => p, Var: () => p * (1 - p) },
      cat: { probs: [.5, .3, .2], draw() { const u = r(); return u < .5 ? 0 : u < .8 ? 1 : 2; }, E: () => 0 * .5 + 1 * .3 + 2 * .2, Var: () => (0 - .7) ** 2 * .5 + (1 - .7) ** 2 * .3 + (2 - .7) ** 2 * .2 },
      unif: { draw: () => -1 + 4 * r(), E: () => 1, Var: () => 16 / 12 }
    };
    ui.select({ label: '분포', options: [['gauss', '가우시안 N(μ, σ²)'], ['bern', '베르누이(p)'], ['cat', '범주형 (0.5, 0.3, 0.2)'], ['unif', '균등 U(−1, 3)']], value: kind, onChange: v => { kind = v; samples = []; draw(); } });
    const sMu = ui.slider({ label: 'μ', min: -2, max: 3, step: .1, value: mu, onInput: v => { mu = v; samples = []; draw(); } });
    const sSig = ui.slider({ label: 'σ', min: .2, max: 2.5, step: .1, value: sigma, onInput: v => { sigma = v; samples = []; draw(); } });
    const sP = ui.slider({ label: 'p', min: .02, max: .98, step: .01, value: p, onInput: v => { p = v; samples = []; draw(); } });
    [10, 100, 1000].forEach(n => ui.button({ label: '+' + n, onClick: () => { for (let i = 0; i < n; i++) samples.push(D[kind].draw()); draw(); } }));
    ui.button({ label: '비우기', onClick: () => { samples = []; draw(); } });
    function draw() {
      const pal = V.pal(); c1.size(); c2.size();
      sMu.el.style.display = sSig.el.style.display = kind === 'gauss' ? '' : 'none'; sP.el.style.display = kind === 'bern' ? '' : 'none';
      const d = D[kind], discrete = kind === 'bern' || kind === 'cat';
      if (discrete) {
        const K = kind === 'bern' ? 2 : 3, probs = kind === 'bern' ? [1 - p, p] : d.probs;
        const cnt = new Array(K).fill(0); samples.forEach(s => cnt[s]++);
        const P = V.plot(c1, { x: [-.6, K - .4], y: [0, 1], xlabel: '값', ylabel: '확률 / 비율' }).axes({ xstep: 1 });
        for (let k = 0; k < K; k++) {
          const w = (P.X(1) - P.X(0)) * .6;
          if (samples.length) { P.ctx.fillStyle = V.rgba(pal.series[0], .55); const y = cnt[k] / samples.length; P.ctx.fillRect(P.X(k) - w / 2, P.Y(y), w, P.Y(0) - P.Y(y)); }
          P.ctx.strokeStyle = pal.text; P.ctx.lineWidth = 2; P.ctx.strokeRect(P.X(k) - w / 2, P.Y(probs[k]), w, P.Y(0) - P.Y(probs[k]));
        }
      } else {
        const xr = kind === 'gauss' ? [mu - 4 * sigma, mu + 4 * sigma] : [-2, 4];
        const pdf = kind === 'gauss' ? x => Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)) / Math.sqrt(2 * Math.PI) / sigma : x => (x >= -1 && x <= 3) ? .25 : 0;
        const ymax = kind === 'gauss' ? 1.35 / Math.sqrt(2 * Math.PI) / sigma : .4;
        const P = V.plot(c1, { x: xr, y: [0, ymax], xlabel: '값 x', ylabel: '밀도' }).axes();
        if (samples.length) {
          const nb = 30, bw = (xr[1] - xr[0]) / nb, cnt = new Array(nb).fill(0);
          samples.forEach(s => { const b = Math.floor((s - xr[0]) / bw); if (b >= 0 && b < nb) cnt[b]++; });
          P.ctx.fillStyle = V.rgba(pal.series[0], .5);
          cnt.forEach((c, b) => { const h = c / samples.length / bw; P.ctx.fillRect(P.X(xr[0] + b * bw) + .5, P.Y(h), P.X(xr[0] + bw) - P.X(xr[0]) - 1, P.Y(0) - P.Y(h)); });
        }
        P.fn(pdf, pal.text, 2.2);
      }
      const E = d.E();
      const n = samples.length;
      const Q = V.plot(c2, { x: [1, Math.max(10, n)], y: [E - 1.5, E + 1.5], xlabel: '표본 수 n', ylabel: '표본 평균' }).axes();
      Q.line([[1, E], [Math.max(10, n), E]], pal.text, 1.5, [5, 4]);
      if (n) { let s = 0; const pts = []; const stepN = Math.max(1, Math.floor(n / 400)); samples.forEach((v, i) => { s += v; if (i % stepN === 0 || i === n - 1) pts.push([i + 1, s / (i + 1)]); }); Q.clip(); Q.line(pts, pal.series[0], 2); Q.unclip(); }
      const m = n ? samples.reduce((a, b) => a + b, 0) / n : NaN, v = n > 1 ? samples.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1) : NaN;
      ui.setRO(`표본 수 n = ${n}   표본 평균 = ${n ? fmt(m, 3) : '-'}   기댓값 E[X] = ${fmt(E, 3)}   표본 분산 = ${n > 1 ? fmt(v, 3) : '-'}   Var[X] = ${fmt(d.Var(), 3)}`);
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 9. 최대우도추정 ===== */
  V.register('likelihood', el => {
    const ui = V.shell(el, {
      title: '최대우도추정: 동전의 앞면 확률 추정',
      desc: '동전을 $n$번 던져 앞면이 $k$번 나왔다. 앞면 확률이 $p$라면 이 결과가 나올 확률(우도)은 $\\mathcal L(p)=p^k(1-p)^{n-k}$이다. 우도를 가장 크게 만드는 $p$가 최대우도 추정값이다.',
      how: ['위: 관측 결과. 채운 원 = 앞면, 빈 원 = 뒷면.', '아래 곡선: 각 $p$에서의 우도(최댓값을 1로 맞춘 상대 우도) 또는 로그 우도.', '세로 실선: 최대우도 추정값 $\\hat p=k/n$. 세로 점선: 슬라이더로 고른 후보 $p$.'],
      try: ['$n$을 키우면서 같은 비율($k/n$)을 유지하면 곡선이 좁아지는 것을 본다. 데이터가 많을수록 추정이 확실해진다.', '로그 우도로 바꿔도 최고점의 위치가 같은지 확인한다.', '$k=0$일 때 추정값이 0이 되는 문제를 생각해 본다.']
    });
    const c0 = ui.canvas(ui.panel(ui.body, '관측'), 70);
    const cv = ui.canvas(ui.panel(ui.body, '우도 곡선'), 0, { aspect: .4, minH: 200, maxH: 300 });
    let n = 10, k = 7, pc = .5, logm = false;
    const sk = ui.slider({ label: '앞면 수 k', min: 0, max: 10, step: 1, value: k, fmt: v => String(v), onInput: v => { k = v; draw(); } });
    ui.slider({ label: '던진 횟수 n', min: 1, max: 60, step: 1, value: n, fmt: v => String(v), onInput: v => { const ratio = k / n; n = v; sk.input.max = n; k = Math.round(ratio * n); sk.value = k; draw(); } });
    ui.slider({ label: '후보 p', min: 0.01, max: .99, step: .01, value: pc, fmt: v => v.toFixed(2), onInput: v => { pc = v; draw(); } });
    ui.toggle({ label: '로그 우도', value: false, onChange: v => { logm = v; draw(); } });
    const ll = p => k * Math.log(Math.max(p, 1e-12)) + (n - k) * Math.log(Math.max(1 - p, 1e-12));
    function draw() {
      const pal = V.pal(); c0.size(); cv.size();
      const ctx = c0.ctx, rr = Math.min(9, (c0.w - 20) / n / 2.6);
      for (let i = 0; i < n; i++) { const x = 14 + i * rr * 2.6, y = 34; ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); if (i < k) { ctx.fillStyle = pal.series[0]; ctx.fill(); } else { ctx.strokeStyle = pal.muted; ctx.lineWidth = 1.5; ctx.stroke(); } }
      const ph = k / n, lmax = ll(Math.min(Math.max(ph, 1e-6), 1 - 1e-6));
      const f = logm ? ll : p => Math.exp(ll(p) - lmax);
      const yr = logm ? [Math.max(lmax - 40, ll(.5) - 20), lmax + 3] : [0, 1.08];
      const P = V.plot(cv, { x: [0, 1], y: yr, xlabel: '앞면 확률 p', ylabel: logm ? '로그 우도 log L(p)' : '상대 우도 L(p) / max' }).axes();
      P.clip(); P.fn(f, pal.series[0], 2.4, null, [0.001, 0.999]); P.unclip();
      P.line([[ph, yr[0]], [ph, yr[1]]], pal.text, 1.5); P.label(ph, yr[1], `p̂ = k/n = ${fmt(ph, 3)}`, { dy: 14, align: 'center', bold: true });
      P.line([[pc, yr[0]], [pc, yr[1]]], pal.warn, 1.5, [5, 4]); P.dot(pc, f(pc), 5, pal.warn, pal.surface);
      ui.setRO(`관측: ${n}번 중 앞면 ${k}번   후보 p = ${pc.toFixed(2)}에서 우도 = ${Math.exp(ll(pc)).toExponential(3)}, 로그 우도 = ${fmt(ll(pc), 3)}   최대우도 추정값 p̂ = ${fmt(ph, 3)}`);
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 10. 교차 엔트로피 ===== */
  V.register('cross-entropy', el => {
    const cls = ['고양이', '개', '새'];
    const ui = V.shell(el, {
      title: '교차 엔트로피 손실',
      desc: '정답이 원-핫 분포일 때 교차 엔트로피는 $-\\log q_{\\text{정답}}$, 즉 모델이 정답에 준 확률의 음의 로그다. 정답 확률이 0에 가까워지면 손실이 폭발적으로 커진다.',
      how: ['왼쪽 막대: 모델의 예측 분포. 굵은 테두리가 정답 클래스.', '오른쪽 파랑: 교차 엔트로피 $-\\ln q$. 회색 점선: 비교용 제곱오차 $(1-q)^2$.'],
      try: ['정답 확률을 0.9 → 0.1 → 0.01로 낮추며 두 손실이 각각 얼마나 커지는지 비교한다.', '정답 확률이 0.5일 때 손실이 $\\ln 2\\approx0.693$인지 확인한다.', '정답을 다른 클래스로 바꿔 본다.']
    });
    const row = ui.row(2);
    const c1 = ui.canvas(ui.panel(row, '예측 분포'), 0, { aspect: .72, maxH: 300 });
    const c2 = ui.canvas(ui.panel(row, '손실 대 정답 확률'), 0, { aspect: .72, maxH: 300 });
    let tgt = 0, q = .7;
    ui.select({ label: '정답', options: cls.map((c, i) => [i, c]), value: 0, onChange: v => { tgt = +v; draw(); } });
    ui.slider({ label: '정답에 준 확률 q', min: .01, max: .99, step: .01, value: q, fmt: v => v.toFixed(2), onInput: v => { q = v; draw(); } });
    function draw() {
      const pal = V.pal(); c1.size(); c2.size();
      const probs = cls.map((_, i) => i === tgt ? q : (1 - q) * (i === (tgt + 1) % 3 ? .65 : .35));
      const P = V.bars(c1, probs, { y: [0, 1], labels: cls, ylabel: '확률', colors: probs.map((_, i) => i === tgt ? pal.series[0] : V.rgba(pal.muted, .6)), showValues: true });
      const xw = (P.box.x1 - P.box.x0) / 3 * .7; P.ctx.strokeStyle = pal.text; P.ctx.lineWidth = 2.5; P.ctx.strokeRect(P.X(tgt) - xw / 2, P.Y(q), xw, P.Y(0) - P.Y(q));
      const Q = V.plot(c2, { x: [0, 1], y: [0, 5], xlabel: '정답 확률 q', ylabel: '손실' }).axes();
      Q.clip(); Q.fn(x => -Math.log(x), pal.series[0], 2.4, null, [0.005, 1]); Q.fn(x => (1 - x) ** 2, pal.muted, 1.8, [5, 4]); Q.unclip();
      Q.dot(q, -Math.log(q), 6, pal.series[0], pal.surface).dot(q, (1 - q) ** 2, 4.5, pal.muted);
      ui.setRO(`교차 엔트로피 −ln q = ${fmt(-Math.log(q), 4)}   제곱오차 (1−q)² = ${fmt((1 - q) ** 2, 4)}   예측 분포 = [${probs.map(v => v.toFixed(2)).join(', ')}]`);
    }
    draw(); V.onEnv(el, draw);
  });

  V.modsReady.push('w1');
})();
