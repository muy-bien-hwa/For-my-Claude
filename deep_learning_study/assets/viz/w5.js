/* 5주차 시각화: 합성곱과 풀링, 출력 크기 계산기, 수용 영역, 잔차 연결과 기울기 흐름, 데이터 증강 */
(function () {
  'use strict';
  const fmt = V.fmt;
  const text = (ctx, s, x, y, o = {}) => {
    const pal = V.pal();
    ctx.font = o.font || (o.bold ? V.FONT_B : V.FONT); ctx.fillStyle = o.color || pal.text;
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.base || 'middle'; ctx.fillText(s, x, y); ctx.textBaseline = 'alphabetic';
  };
  const lineCol = pal => V.rgba(pal.border2.startsWith('#') ? pal.border2 : '#999999', .7);
  const gray = v => { const t = Math.round(255 * (1 - V.clamp(v, 0, 1))); return `rgb(${t},${t},${t})`; };   // 0 = 흰색, 1 = 검정

  /* ===== 1. 합성곱과 풀링 ===== */
  const N = 12;
  const IMAGES = {
    square: { name: '사각형', f: (r, c) => (r >= 3 && r <= 8 && c >= 3 && c <= 8) ? 1 : 0 },
    circle: { name: '원', f: (r, c) => V.clamp(4.6 - Math.hypot(r - 5.5, c - 5.5), 0, 1) },
    seven: { name: '숫자 7', f: (r, c) => { if (r >= 2 && r <= 3 && c >= 2 && c <= 9) return 1; const t = (r - 3) / 6.5; if (r >= 4 && r <= 10 && Math.abs(c - (9 - 4 * t)) < .9) return 1; return 0; } },
    diag: { name: '대각선', f: (r, c) => Math.abs(r - c) <= .5 ? 1 : (Math.abs(r - c) <= 1.5 ? .35 : 0) }
  };
  const KERNELS = {
    identity: { name: '항등', k: [[0, 0, 0], [0, 1, 0], [0, 0, 0]] },
    blur: { name: '흐림 (평균)', k: [[1, 1, 1], [1, 1, 1], [1, 1, 1]].map(r => r.map(v => v / 9)), frac: '1/9' },
    sobelx: { name: '세로 경계 (소벨 x)', k: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]] },
    sobely: { name: '가로 경계 (소벨 y)', k: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]] },
    sharpen: { name: '날카롭게', k: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]] },
    custom: { name: '직접 (칸을 클릭)', k: [[0, 0, 0], [0, 1, 0], [0, 0, 0]] }
  };
  V.register('conv', el => {
    const ui = V.shell(el, {
      title: '합성곱: 커널이 이미지를 훑으며 특성 맵을 만든다',
      desc: '3×3 커널이 입력 위를 한 칸씩 움직이며, 겹친 9개 픽셀과 커널 값을 곱해 더한 값을 특성 맵의 한 칸에 쓴다. 같은 커널(같은 9개 가중치)을 모든 위치에서 쓴다.',
      how: ['왼쪽: 입력(검정 = 1, 흰색 = 0). 파란 틀이 지금 커널이 놓인 자리다. 패딩을 1로 하면 바깥에 0인 칸이 한 줄 붙는다.', '가운데: 커널. 파란 칸은 양수, 빨간 칸은 음수 가중치다. "직접" 커널은 칸을 클릭할 때마다 값이 −2 → −1 → 0 → 1 → 2로 바뀐다.', '오른쪽 위: 특성 맵(파랑 = 양수, 빨강 = 음수). 오른쪽 아래: 특성 맵(ReLU를 켜면 그 결과)을 2×2 최대 풀링한 결과. ReLU 없이 풀링하면 음수 반응은 이웃의 0에 밀려 사라진다.', '아래 글: 지금 위치에서의 곱셈과 덧셈.'],
      try: ['세로 경계 커널로 사각형을 훑는다. 왼쪽 변에서는 양수, 오른쪽 변에서는 음수가 나오고 평평한 곳은 0이다. 커널은 "밝기가 바뀌는 곳"을 찾는다.', '같은 커널을 원에 적용한다. 위치가 달라도 같은 모양에는 같은 반응이 나온다(이동 등변성).', '스트라이드를 2로 바꾸면 특성 맵이 가로·세로 절반 가까이로 줄어든다. 출력 크기 공식과 비교한다.', '"직접"으로 대각선만 찾는 커널을 만들어 본다(예: 대각선에 2, 나머지 −1).']
    });
    const row = ui.row(3);
    const cIn = ui.canvas(ui.panel(row, '입력 (12 × 12)'), 0, { aspect: 1, maxH: 320 });
    const cK = ui.canvas(ui.panel(row, '커널 (3 × 3)'), 0, { aspect: 1, maxH: 320 });
    const cOut = ui.canvas(ui.panel(row, '특성 맵과 2 × 2 최대 풀링'), 0, { aspect: 1.25, maxH: 400 });
    let img = 'square', ker = 'sobelx', pad = 0, stride = 1, relu = false, pos = -1, anim = null;
    const custom = KERNELS.custom.k.map(r => r.slice());
    const K = () => ker === 'custom' ? custom : KERNELS[ker].k;
    const input = () => Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => +IMAGES[img].f(r, c).toFixed(2)));
    const M = () => Math.floor((N + 2 * pad - 3) / stride) + 1;
    function conv(X) {
      const k = K(), m = M(), out = [];
      for (let i = 0; i < m; i++) {
        out.push([]);
        for (let j = 0; j < m; j++) {
          let s = 0;
          for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { const r = i * stride + a - pad, c = j * stride + b - pad; if (r >= 0 && r < N && c >= 0 && c < N) s += X[r][c] * k[a][b]; }
          out[i].push(relu ? Math.max(0, s) : s);
        }
      }
      return out;
    }
    ui.select({ label: '이미지', options: Object.entries(IMAGES).map(([k, v]) => [k, v.name]), value: img, onChange: v => { img = v; draw(); } });
    ui.select({ label: '커널', options: Object.entries(KERNELS).map(([k, v]) => [k, v.name]), value: ker, onChange: v => { ker = v; draw(); } });
    ui.select({ label: '패딩', options: [[0, '0'], [1, '1']], value: 0, onChange: v => { pad = +v; pos = -1; draw(); } });
    ui.select({ label: '스트라이드', options: [[1, '1'], [2, '2']], value: 1, onChange: v => { stride = +v; pos = -1; draw(); } });
    ui.toggle({ label: 'ReLU', value: false, onChange: v => { relu = v; draw(); } });
    const bPlay = ui.button({ label: '훑기', primary: true, onClick: () => { if (anim) return stop(); bPlay.setLabel('정지'); if (pos >= M() * M() - 1) pos = -1; let last = 0; anim = V.loop(t => { if (t - last < 110) return; last = t; pos++; draw(); if (pos >= M() * M() - 1) { stop(); return false; } }); } });
    ui.button({ label: '한 칸', onClick: () => { stop(); pos = Math.min(pos + 1, M() * M() - 1); draw(); } });
    ui.button({ label: '전체 결과', onClick: () => { stop(); pos = -1; draw(); } });
    function stop() { if (anim) { anim.stop(); anim = null; } bPlay.setLabel('훑기'); }
    // 직접 커널: 칸 클릭
    let kGeo = null;
    cK.el.addEventListener('click', e => {
      if (ker !== 'custom' || !kGeo) return;
      const [x, y] = cK.pos(e), c = Math.floor((x - kGeo.x) / kGeo.cs), r = Math.floor((y - kGeo.y) / kGeo.cs);
      if (r < 0 || r > 2 || c < 0 || c > 2) return;
      const cyc = [-2, -1, 0, 1, 2]; custom[r][c] = cyc[(cyc.indexOf(custom[r][c]) + 1) % 5]; draw();
    });
    function draw() {
      const pal = V.pal(), X = input(), out = conv(X), m = M(), k = K();
      [cIn, cK, cOut].forEach(c => c.size());
      const cur = pos >= 0 ? [Math.floor(pos / m), pos % m] : null;
      // 입력
      {
        const ctx = cIn.ctx, T = N + 2 * pad, cs = Math.floor(Math.min(cIn.w, cIn.h) / T), x0 = (cIn.w - cs * T) / 2, y0 = (cIn.h - cs * T) / 2;
        for (let r = 0; r < T; r++) for (let c = 0; c < T; c++) {
          const rr = r - pad, cc = c - pad, inside = rr >= 0 && rr < N && cc >= 0 && cc < N;
          ctx.fillStyle = inside ? gray(X[rr][cc]) : pal.surface3; ctx.fillRect(x0 + c * cs, y0 + r * cs, cs, cs);
          ctx.strokeStyle = lineCol(pal); ctx.lineWidth = .5; ctx.strokeRect(x0 + c * cs + .5, y0 + r * cs + .5, cs - 1, cs - 1);
        }
        if (cur) {
          const r0 = cur[0] * stride, c0 = cur[1] * stride;
          for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
            const rr = r0 + a - pad, cc = c0 + b - pad, v = rr >= 0 && rr < N && cc >= 0 && cc < N ? X[rr][cc] : 0;
            text(ctx, v === 0 ? '0' : String(v), x0 + (c0 + b + .5) * cs, y0 + (r0 + a + .5) * cs, { font: V.MONO, color: v > .55 ? '#ffffff' : pal.text });
          }
          ctx.strokeStyle = pal.accent; ctx.lineWidth = 3; ctx.strokeRect(x0 + c0 * cs, y0 + r0 * cs, 3 * cs, 3 * cs);
        }
      }
      // 커널
      {
        const ctx = cK.ctx, cs = Math.floor(Math.min(cK.w, cK.h - 40) / 3), x0 = (cK.w - 3 * cs) / 2, y0 = 6;
        kGeo = { x: x0, y: y0, cs };
        const amax = Math.max(1e-9, ...k.flat().map(Math.abs));
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
          const v = k[a][b];
          ctx.fillStyle = V.cmapCss('div', .5 + .5 * v / amax); ctx.fillRect(x0 + b * cs, y0 + a * cs, cs, cs);
          ctx.strokeStyle = lineCol(pal); ctx.lineWidth = 1; ctx.strokeRect(x0 + b * cs + .5, y0 + a * cs + .5, cs - 1, cs - 1);
          const lab = KERNELS[ker].frac && ker !== 'custom' ? KERNELS[ker].frac : fmt(v, 2);
          text(ctx, lab, x0 + (b + .5) * cs, y0 + (a + .5) * cs, { font: '600 15px "JetBrains Mono", monospace', color: Math.abs(v) / amax > .6 ? '#ffffff' : pal.text });
        }
        text(ctx, `출력 크기 = ⌊(${N} + 2·${pad} − 3) / ${stride}⌋ + 1 = ${m}`, cK.w / 2, y0 + 3 * cs + 20, { color: pal.text2 });
      }
      // 특성 맵과 풀링
      {
        const ctx = cOut.ctx, area = Math.min(cOut.w, cOut.h * .62), cs = Math.floor(area / m), x0 = (cOut.w - cs * m) / 2, y0 = 4;
        const amax = Math.max(1e-9, ...out.flat().map(Math.abs));
        for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) {
          const shown = !cur || i * m + j <= pos, v = out[i][j];
          ctx.fillStyle = shown ? V.cmapCss('div', .5 + .5 * v / amax) : pal.surface2; ctx.fillRect(x0 + j * cs, y0 + i * cs, cs, cs);
          ctx.strokeStyle = lineCol(pal); ctx.lineWidth = .5; ctx.strokeRect(x0 + j * cs + .5, y0 + i * cs + .5, cs - 1, cs - 1);
        }
        if (cur) { ctx.strokeStyle = pal.accent; ctx.lineWidth = 3; ctx.strokeRect(x0 + cur[1] * cs, y0 + cur[0] * cs, cs, cs); }
        const pm = Math.floor(m / 2), pool = [];
        for (let i = 0; i < pm; i++) { pool.push([]); for (let j = 0; j < pm; j++) pool[i].push(Math.max(out[2 * i][2 * j], out[2 * i][2 * j + 1], out[2 * i + 1][2 * j], out[2 * i + 1][2 * j + 1])); }
        const ps = Math.max(6, Math.floor(Math.min(cs * 1.3, (cOut.h - y0 - cs * m - 30) / Math.max(1, pm)))), px0 = (cOut.w - ps * pm) / 2, py0 = y0 + cs * m + 26;
        text(ctx, `2 × 2 최대 풀링 → ${pm} × ${pm}`, cOut.w / 2, py0 - 12, { color: pal.text2 });
        if (!cur) for (let i = 0; i < pm; i++) for (let j = 0; j < pm; j++) {
          ctx.fillStyle = V.cmapCss('div', .5 + .5 * pool[i][j] / amax); ctx.fillRect(px0 + j * ps, py0 + i * ps, ps, ps);
          ctx.strokeStyle = lineCol(pal); ctx.lineWidth = .5; ctx.strokeRect(px0 + j * ps + .5, py0 + i * ps + .5, ps - 1, ps - 1);
        }
        else text(ctx, '(훑기가 끝나면 표시)', cOut.w / 2, py0 + 20, { color: pal.muted });
      }
      if (cur) {
        const terms = [];
        let s = 0;
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
          const rr = cur[0] * stride + a - pad, cc = cur[1] * stride + b - pad, v = rr >= 0 && rr < N && cc >= 0 && cc < N ? X[rr][cc] : 0;
          s += v * k[a][b];
          if (k[a][b] !== 0 && v !== 0) terms.push(`${fmt(v, 2)}·(${fmt(k[a][b], 3)})`);
        }
        ui.setRO(`위치 (${cur[0]}, ${cur[1]}): Σ 입력 × 커널 = ${terms.length ? terms.join(' + ') : '0'} = ${fmt(s, 3)}${relu ? ` → ReLU ${fmt(Math.max(0, s), 3)}` : ''}`);
      } else ui.setRO(`특성 맵 ${m} × ${m}, 값 범위 ${fmt(Math.min(...out.flat()), 2)} ~ ${fmt(Math.max(...out.flat()), 2)}. 파라미터는 커널 9개뿐이다(편향 제외). 같은 크기의 완전연결층이라면 ${N * N} × ${m * m} = ${(N * N * m * m).toLocaleString()}개가 필요하다.`);
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 2. 출력 크기 계산기 ===== */
  V.register('conv-shape', el => {
    const ui = V.shell(el, {
      title: '합성곱 출력 크기: 패딩, 스트라이드, 팽창',
      desc: '한 축(가로)만 그렸다. 위 줄이 입력(회색 칸은 패딩), 가운데 막대 하나가 출력 한 칸을 만드는 커널의 위치, 아래 줄이 출력이다. 출력 크기는 $\\left\\lfloor \\frac{n + 2p - d(k-1) - 1}{s} \\right\\rfloor + 1$이다.',
      how: ['막대의 점이 커널이 실제로 읽는 입력 칸이다. 팽창(d)이 2면 한 칸씩 건너뛰며 읽는다.', '주황 테두리 칸은 어떤 커널 위치도 읽지 않는 입력이다. 스트라이드가 나누어떨어지지 않으면 끝부분이 버려진다.', '아래 글은 2차원(가로 = 세로)일 때의 파라미터 수와 곱셈-덧셈 횟수다.'],
      try: ['n = 7, k = 3에서 p = 1로 두면 출력이 입력과 같은 크기가 된다("same" 패딩). k = 5면 p가 얼마여야 하는가?', 's = 2로 하면 출력이 약 절반이 된다. n = 8, k = 3, p = 1, s = 2와 n = 7일 때를 비교한다.', 'k = 3, d = 2는 5칸 범위를 3개 가중치로 본다. 파라미터는 그대로인데 보는 범위가 넓어진다.', '채널 수를 64 → 128로 늘려 파라미터와 계산량이 어떻게 늘어나는지 본다.']
    });
    const cv = ui.canvas(ui.body, 240);
    let n = 7, k = 3, p = 0, s = 1, d = 1, cin = 64, cout = 64;
    ui.slider({ label: '입력 n', min: 3, max: 16, step: 1, value: n, onInput: v => { n = v; draw(); } });
    ui.slider({ label: '커널 k', min: 1, max: 7, step: 1, value: k, onInput: v => { k = v; draw(); } });
    ui.slider({ label: '패딩 p', min: 0, max: 3, step: 1, value: p, onInput: v => { p = v; draw(); } });
    ui.slider({ label: '스트라이드 s', min: 1, max: 4, step: 1, value: s, onInput: v => { s = v; draw(); } });
    ui.slider({ label: '팽창 d', min: 1, max: 3, step: 1, value: d, onInput: v => { d = v; draw(); } });
    const CH = [1, 3, 16, 32, 64, 128, 256, 512];
    ui.select({ label: '입력 채널', options: CH.map(c => [c, c]), value: cin, onChange: v => { cin = +v; draw(); } });
    ui.select({ label: '출력 채널', options: CH.map(c => [c, c]), value: cout, onChange: v => { cout = +v; draw(); } });
    function draw() {
      const pal = V.pal(), T = n + 2 * p, span = d * (k - 1) + 1, out = span > T ? 0 : Math.floor((T - span) / s) + 1;
      const W = Math.max(10, cv.el.parentElement.clientWidth), cw0 = Math.min(40, (W - 30) / T), rowH = 16;
      cv.hOpt = 24 + cw0 + 12 + rowH * out + 14 + Math.min(cw0, 40) + 16; cv.size();
      const ctx = cv.ctx, cw = cw0, x0 = (cv.w - cw * T) / 2;
      const yIn = 24, yW = yIn + cw + 12, yOut = yW + rowH * out + 14;
      const used = new Array(T).fill(false);
      for (let o = 0; o < out; o++) for (let t = 0; t < k; t++) used[o * s + t * d] = true;
      text(ctx, '입력 (패딩 포함)', x0, 12, { align: 'left', color: pal.text2 });
      for (let i = 0; i < T; i++) {
        const isPad = i < p || i >= p + n;
        ctx.fillStyle = isPad ? pal.surface3 : pal.surface2; ctx.fillRect(x0 + i * cw + 1, yIn, cw - 2, cw - 2);
        ctx.strokeStyle = !isPad && !used[i] ? pal.warn : lineCol(pal); ctx.lineWidth = !isPad && !used[i] ? 2.5 : 1; ctx.strokeRect(x0 + i * cw + 1.5, yIn + .5, cw - 3, cw - 3);
        if (cw > 14) text(ctx, isPad ? '0' : String(i - p + 1), x0 + (i + .5) * cw, yIn + cw / 2 - 1, { font: V.MONO, color: isPad ? pal.muted : pal.text });
      }
      for (let o = 0; o < out; o++) {
        const col = pal.series[o % 6], y = yW + o * rowH + rowH / 2, a = o * s, b = a + (k - 1) * d;
        ctx.strokeStyle = V.rgba(col, .45); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 + (a + .5) * cw, y); ctx.lineTo(x0 + (b + .5) * cw, y); ctx.stroke();
        for (let t = 0; t < k; t++) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x0 + (a + t * d + .5) * cw, y, Math.min(5, rowH / 3), 0, 7); ctx.fill(); }
      }
      text(ctx, `출력 (${out}칸)`, x0, yOut - 4, { align: 'left', base: 'bottom', color: pal.text2 });
      const oc = Math.min(cw, 40), ox0 = (cv.w - oc * out) / 2;
      for (let o = 0; o < out; o++) {
        ctx.fillStyle = V.rgba(pal.series[o % 6], .3); ctx.fillRect(ox0 + o * oc + 1, yOut + 4, oc - 2, oc - 2);
        ctx.strokeStyle = pal.series[o % 6]; ctx.lineWidth = 1.5; ctx.strokeRect(ox0 + o * oc + 1.5, yOut + 4.5, oc - 3, oc - 3);
      }
      const params = cout * (cin * k * k + 1), macs = out * out * cout * cin * k * k;
      const left = used.slice(p, p + n).filter(u => !u).length;
      ui.setRO(`출력 = ⌊(${n} + 2·${p} − ${d}·(${k} − 1) − 1) / ${s}⌋ + 1 = ${out}${left ? `   (읽지 않는 입력 ${left}칸)` : ''}\n2차원 ${n}×${n}×${cin} → ${out}×${out}×${cout}: 파라미터 ${cout}·(${cin}·${k}² + 1) = ${params.toLocaleString()}개, 곱셈-덧셈 ${out}²·${cout}·${cin}·${k}² = ${macs.toLocaleString()}회`);
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 3. 수용 영역 ===== */
  const c3 = { t: 'conv', k: 3, s: 1, d: 1 }, pool2 = { t: 'pool', k: 2, s: 2, d: 1 };
  const RF = {
    three: { name: '3×3 합성곱 3층', L: [c3, c3, c3] },
    vgg: { name: 'VGG식 (합성곱 2 + 풀링) × 2', L: [c3, c3, pool2, c3, c3, pool2] },
    stride: { name: '스트라이드 2 합성곱 3층', L: [{ t: 'conv', k: 3, s: 2, d: 1 }, { t: 'conv', k: 3, s: 2, d: 1 }, { t: 'conv', k: 3, s: 2, d: 1 }] },
    five: { name: '5×5 합성곱 1층', L: [{ t: 'conv', k: 5, s: 1, d: 1 }] },
    two3: { name: '3×3 합성곱 2층', L: [c3, c3] },
    dil: { name: '팽창 합성곱 (d = 1, 2, 4)', L: [c3, { t: 'conv', k: 3, s: 1, d: 2 }, { t: 'conv', k: 3, s: 1, d: 4 }] }
  };
  V.register('receptive-field', el => {
    const ui = V.shell(el, {
      title: '수용 영역: 위층의 한 칸은 입력의 얼마를 보는가',
      desc: '맨 아래 줄이 입력 픽셀(한 축만 그림), 위로 갈수록 깊은 층이다. 맨 위 층의 한 칸을 클릭하면 그 칸의 값에 영향을 주는 아래 층의 칸들과 입력 범위(수용 영역)가 강조된다.',
      how: ['선은 "이 칸이 계산될 때 읽는 아래 칸"을 잇는다. 합성곱은 패딩을 넣어(same) 위치를 맞췄다.', '오른쪽 글: 층마다 수용 영역 크기 r과 점프 j(위층 한 칸이 입력에서 몇 픽셀 간격인가). r은 $r_l = r_{l-1} + (k_l - 1)\\,d_l\\,j_{l-1}$, j는 $j_l = j_{l-1}s_l$로 늘어난다.'],
      try: ['"3×3 합성곱 3층"에서 수용 영역은 3 → 5 → 7로 2씩 늘어난다.', '"5×5 합성곱 1층"과 "3×3 합성곱 2층"은 수용 영역이 5로 같다. 채널이 C일 때 파라미터는 25C²와 18C²이고, 2층 쪽은 비선형 활성화가 하나 더 들어간다(VGG의 선택).', '"VGG식"에서 풀링 뒤의 합성곱은 점프가 2라 수용 영역이 4씩 늘어난다. 풀링이 수용 영역을 빨리 키운다.', '"팽창 합성곱"은 파라미터를 늘리지 않고 수용 영역을 3 → 7 → 15로 빠르게 키운다.']
    });
    const cv = ui.canvas(ui.body, 0, { aspect: .5, minH: 280, maxH: 440 });
    let key = 'three', sel = null;
    ui.select({ label: '구조', options: Object.entries(RF).map(([k, v]) => [k, v.name]), value: key, onChange: v => { key = v; sel = null; draw(); } });
    let geo = null;
    cv.el.addEventListener('click', e => {
      if (!geo) return; const [x, y] = cv.pos(e);
      const top = geo.layers.length - 1, Ly = geo.ys[top];
      if (Math.abs(y - Ly) > 14) return;
      let best = 0, bd = Infinity;
      for (let i = 0; i < geo.n[top]; i++) { const dx = Math.abs(geo.X(geo.center[top](i)) - x); if (dx < bd) { bd = dx; best = i; } }
      sel = best; draw();
    });
    function draw() {
      const pal = V.pal(); cv.size();
      const ctx = cv.ctx, L = RF[key].L, n0 = 33;
      const layers = [{ t: 'input' }].concat(L), n = [n0], j = [1], r = [1], a = [0], center = [i => i];
      L.forEach((ly, l) => {
        const pd = ly.t === 'conv' ? ly.d * (ly.k - 1) / 2 : 0;
        n.push(ly.t === 'conv' ? Math.ceil(n[l] / ly.s) : Math.floor(n[l] / ly.s));
        r.push(r[l] + (ly.k - 1) * ly.d * j[l]); j.push(j[l] * ly.s);
        const off = -pd + (ly.k - 1) * ly.d / 2;      // 아래 층 인덱스 좌표에서 커널 중심
        const al = a[l] + off * j[l]; a.push(al);
        const jl = j[l + 1]; center.push(i => al + i * jl);
      });
      const top = layers.length - 1;
      if (sel == null || sel >= n[top]) sel = Math.floor((n[top] - 1) / 2);
      const padL = 20, X = u => padL + (u + .5) * (cv.w - 2 * padL - 150) / n0, ys = layers.map((_, l) => cv.h - 34 - l * (cv.h - 70) / Math.max(1, top));
      geo = { layers, n, center, X, ys };
      // 관여하는 칸 집합 (위에서 아래로)
      const S = new Array(layers.length); S[top] = new Set([sel]);
      const links = [];
      for (let l = top; l >= 1; l--) {
        const ly = L[l - 1], pd = ly.t === 'conv' ? ly.d * (ly.k - 1) / 2 : 0, low = new Set();
        S[l].forEach(i => { for (let t = 0; t < ly.k; t++) { const q = i * ly.s - pd + t * ly.d; if (q >= 0 && q < n[l - 1]) { low.add(q); links.push([l, i, q]); } } });
        S[l - 1] = low;
      }
      // 수용 영역 띠
      const lo = Math.min(...S[0]), hi = Math.max(...S[0]);
      ctx.fillStyle = V.rgba(pal.accent.startsWith('#') ? pal.accent : '#2c5db6', .14);
      ctx.fillRect(X(lo) - 6, ys[0] - 12, X(hi) - X(lo) + 12, 24);
      // 연결선
      ctx.lineWidth = 1.2; ctx.strokeStyle = V.rgba(pal.accent.startsWith('#') ? pal.accent : '#2c5db6', .55);
      links.forEach(([l, i, q]) => { ctx.beginPath(); ctx.moveTo(X(center[l](i)), ys[l]); ctx.lineTo(X(center[l - 1](q)), ys[l - 1]); ctx.stroke(); });
      // 칸
      layers.forEach((ly, l) => {
        for (let i = 0; i < n[l]; i++) {
          const on = S[l].has(i), x = X(center[l](i)), rad = l === top ? 6 : 4.5;
          ctx.beginPath(); ctx.arc(x, ys[l], rad, 0, 7);
          ctx.fillStyle = on ? pal.accent : pal.surface; ctx.fill(); ctx.strokeStyle = on ? pal.accent : pal.border2; ctx.lineWidth = 1.2; ctx.stroke();
        }
        const lab = l === 0 ? '입력' : (ly.t === 'pool' ? `풀링 ${ly.k}, s${ly.s}` : `합성곱 ${ly.k}×${ly.k}${ly.s > 1 ? `, s${ly.s}` : ''}${ly.d > 1 ? `, d${ly.d}` : ''}`);
        text(ctx, lab, cv.w - 140, ys[l] - 7, { align: 'left', color: pal.text2 });
        text(ctx, l === 0 ? '픽셀 1칸' : `r = ${r[l]}, j = ${j[l]}`, cv.w - 140, ys[l] + 9, { align: 'left', font: V.MONO, color: l === top ? pal.accent : pal.muted });
      });
      text(ctx, `수용 영역 ${hi - lo + 1}픽셀`, (X(lo) + X(hi)) / 2, ys[0] + 22, { color: pal.accent, bold: true });
      const convs = L.filter(x => x.t === 'conv'), wc = convs.reduce((s2, x) => s2 + x.k * x.k, 0);
      ui.setRO(`맨 위 층 한 칸의 수용 영역: ${r[top]} × ${r[top]} (2차원)   합성곱 가중치: 채널이 C → C일 때 ${wc}C²   (선택: 위층 ${sel}번 칸)`);
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 4. 잔차 연결과 기울기 흐름 ===== */
  V.register('residual-flow', el => {
    const ui = V.shell(el, {
      title: '잔차 연결: 기울기가 지나가는 지름길',
      desc: '폭 32인 깊은 신경망에 무작위 입력을 넣고, 손실의 기울기가 층을 거꾸로 지나며 얼마나 남는지 잰다. 빨강은 평범한 망 $h_{l} = \\phi(W_l h_{l-1})$, 파랑은 잔차 망 $h_{l} = h_{l-1} + \\alpha\\,\\phi(W_l h_{l-1})$이다.',
      how: ['세로축: 각 층 입력에 대한 기울기의 크기(로그 눈금). 가로축: 층 번호(1 = 입력에 가까운 층). 역전파는 오른쪽에서 왼쪽으로 흐른다.', '잔차 망에서는 $\\frac{\\partial h_l}{\\partial h_{l-1}} = I + \\alpha\\frac{\\partial F}{\\partial h_{l-1}}$이다. 항등 행렬 $I$ 덕분에 기울기가 곱해져 사라지지 않고 그대로 전달되는 길이 있다.', '선 하나는 무작위 가중치 5벌의 평균이다.'],
      try: ['시그모이드를 고르고 깊이를 40으로 늘린다. 평범한 망은 입력 쪽 기울기가 수십 자릿수 작아진다(소실). 잔차 망은 거의 그대로다.', 'ReLU + He 초기화에서는 평범한 망도 버틴다(24일차). 그러나 깊이 60에서 초기화 배율을 0.5로 바꾸면 다시 사라진다.', '잔차 배율 α를 1로 두고 ReLU를 쓰면 잔차 망의 신호가 층마다 커진다. 실제 ResNet은 가지 끝의 배치 정규화로 이를 조절한다(33일차).']
    });
    const row = ui.row(2);
    const cv = ui.canvas(ui.panel(row, '층별 기울기 크기 (log₁₀)'), 0, { aspect: .72, maxH: 380 });
    const cd = ui.canvas(ui.panel(row, '잔차 블록'), 0, { aspect: .72, maxH: 380 });
    let depth = 30, act = 'tanh', gain = 1, alpha = .5;
    const ACT = {
      sigmoid: { name: '시그모이드', f: z => 1 / (1 + Math.exp(-z)), d: z => { const s = 1 / (1 + Math.exp(-z)); return s * (1 - s); }, init: 1 },
      tanh: { name: 'tanh', f: Math.tanh, d: z => 1 - Math.tanh(z) ** 2, init: 1 },
      relu: { name: 'ReLU', f: z => Math.max(0, z), d: z => z > 0 ? 1 : 0, init: 2 }
    };
    ui.slider({ label: '깊이', min: 4, max: 60, step: 1, value: depth, onInput: v => { depth = v; draw(); } });
    ui.select({ label: '활성화', options: Object.entries(ACT).map(([k, v]) => [k, v.name]), value: act, onChange: v => { act = v; draw(); } });
    ui.select({ label: '초기화 배율', options: [[.5, '× 0.5'], [1, '× 1 (Xavier/He)'], [1.5, '× 1.5']], value: 1, onChange: v => { gain = +v; draw(); } });
    ui.select({ label: '잔차 배율 α', options: [[.25, '0.25'], [.5, '0.5'], [1, '1']], value: .5, onChange: v => { alpha = +v; draw(); } });
    function run(residual, seed) {
      const D = 32, B = 8, r = V.rng(seed), A = ACT[act], sd = gain * Math.sqrt(A.init / D);
      const Ws = Array.from({ length: depth }, () => Array.from({ length: D }, () => Float64Array.from({ length: D }, () => V.gauss(r) * sd)));
      let H = Array.from({ length: B }, () => Float64Array.from({ length: D }, () => V.gauss(r)));
      const Zs = [], Hs = [H];
      for (let l = 0; l < depth; l++) {
        const W = Ws[l], Z = H.map(h => { const z = new Float64Array(D); for (let i = 0; i < D; i++) { let s = 0; for (let q = 0; q < D; q++) s += W[i][q] * h[q]; z[i] = s; } return z; });
        Zs.push(Z);
        H = Z.map((z, b) => Float64Array.from(z, (v, i) => (residual ? H[b][i] + alpha * A.f(v) : A.f(v))));
        Hs.push(H);
      }
      const u = Float64Array.from({ length: D }, () => V.gauss(r) / Math.sqrt(D));
      let G = H.map(() => Float64Array.from(u));
      const norms = new Array(depth);
      for (let l = depth - 1; l >= 0; l--) {
        const W = Ws[l], Z = Zs[l];
        G = G.map((g, b) => {
          const dz = Float64Array.from(g, (v, i) => v * A.d(Z[b][i]) * (residual ? alpha : 1)), out = new Float64Array(D);
          for (let q = 0; q < D; q++) { let s = 0; for (let i = 0; i < D; i++) s += W[i][q] * dz[i]; out[q] = (residual ? g[q] : 0) + s; }
          return out;
        });
        norms[l] = Math.sqrt(G.reduce((s, g) => s + g.reduce((t, v) => t + v * v, 0), 0) / B);
      }
      return norms;
    }
    function avg(residual) { const R = [1, 2, 3, 4, 5].map(sd => run(residual, sd * 7 + 1)); return R[0].map((_, l) => R.reduce((s, x) => s + Math.log10(Math.max(x[l], 1e-300)), 0) / R.length); }
    function draw() {
      const pal = V.pal(); cv.size(); cd.size();
      const plain = avg(false), res = avg(true), all = plain.concat(res).filter(isFinite);
      const lo = Math.min(-2, Math.floor(Math.min(...all))), hi = Math.max(1, Math.ceil(Math.max(...all)));
      const P = V.plot(cv, { x: [1, depth], y: [lo, hi], xlabel: '층 (1 = 입력 쪽)', ylabel: 'log₁₀ ‖기울기‖' }).axes({ zero: false });
      P.line(plain.map((v, l) => [l + 1, v]), pal.series[1], 2.4);
      P.line(res.map((v, l) => [l + 1, v]), pal.series[0], 2.4);
      P.label(depth * .6, plain[Math.floor(depth * .6) - 1], '평범한 망', { color: pal.series[1], bold: true, dy: -14 });
      P.label(depth * .25, res[Math.floor(depth * .25)], '잔차 망', { color: pal.series[0], bold: true, dy: -14 });
      // 블록 그림
      const ctx = cd.ctx, w = cd.w, h = cd.h, cx = Math.min(w / 2, w - 130), skipX = cx + Math.min(105, w - cx - 14);
      const box = (y, label, fill) => { ctx.fillStyle = fill; ctx.fillRect(cx - 70, y - 16, 140, 32); ctx.strokeStyle = pal.border2; ctx.lineWidth = 1; ctx.strokeRect(cx - 69.5, y - 15.5, 139, 31); text(ctx, label, cx, y, { bold: true }); };
      const yIn = h - 44, y1 = h * .64, y2 = h * .42, yPlus = h * .23, yOut = 22;
      V.arrowPx(ctx, cx, yIn - 6, cx, y1 + 18, pal.text2, 1.6, 7);
      box(y1, '가중치 층 + ' + ACT[act].name, pal.surface2);
      V.arrowPx(ctx, cx, y1 - 16, cx, y2 + 18, pal.text2, 1.6, 7);
      box(y2, '가중치 층 (× α)', pal.surface2);
      V.arrowPx(ctx, cx, y2 - 16, cx, yPlus + 14, pal.text2, 1.6, 7);
      ctx.beginPath(); ctx.arc(cx, yPlus, 12, 0, 7); ctx.fillStyle = pal.surface; ctx.fill(); ctx.strokeStyle = pal.series[0]; ctx.lineWidth = 2; ctx.stroke(); text(ctx, '+', cx, yPlus, { bold: true, color: pal.series[0] });
      V.arrowPx(ctx, cx, yPlus - 12, cx, yOut + 6, pal.text2, 1.6, 7);
      ctx.strokeStyle = pal.series[0]; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(cx, yIn - 10); ctx.lineTo(skipX, yIn - 10); ctx.lineTo(skipX, yPlus); ctx.stroke();
      V.arrowPx(ctx, skipX, yPlus, cx + 13, yPlus, pal.series[0], 2.4, 8);
      ctx.save(); ctx.translate(skipX + 10, (yIn + yPlus) / 2); ctx.rotate(Math.PI / 2); text(ctx, '항등 지름길', 0, 0, { color: pal.series[0], bold: true }); ctx.restore();
      text(ctx, 'x', cx - 12, yIn, { align: 'right', font: V.MONO });
      text(ctx, 'y = x + F(x)', cx, yOut - 6, { font: V.MONO });
      text(ctx, '∂y/∂x = 1 + ∂F/∂x', cx, h - 14, { color: pal.text2, bold: true });
      ui.setRO(`입력 쪽 1층 / 출력 쪽 마지막 층 기울기 비: 평범한 망 10^${(plain[0] - plain[depth - 1]).toFixed(1)}, 잔차 망 10^${(res[0] - res[depth - 1]).toFixed(1)}`);
    }
    draw(); V.onEnv(el, draw);
  });

  /* ===== 5. 데이터 증강 ===== */
  function scene(kind, S) {
    const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
    if (kind === 'house') {
      const sky = g.createLinearGradient(0, 0, 0, S); sky.addColorStop(0, '#7fb2e5'); sky.addColorStop(1, '#d9ecf7'); g.fillStyle = sky; g.fillRect(0, 0, S, S);
      g.fillStyle = '#f2c94c'; g.beginPath(); g.arc(S * .8, S * .2, S * .09, 0, 7); g.fill();
      g.fillStyle = '#6aa84f'; g.fillRect(0, S * .72, S, S * .28);
      g.fillStyle = '#e8d6b0'; g.fillRect(S * .22, S * .45, S * .36, S * .3);
      g.fillStyle = '#b5473a'; g.beginPath(); g.moveTo(S * .18, S * .47); g.lineTo(S * .4, S * .28); g.lineTo(S * .62, S * .47); g.closePath(); g.fill();
      g.fillStyle = '#7a4b2a'; g.fillRect(S * .36, S * .58, S * .09, S * .17);
      g.fillStyle = '#9fd3f0'; g.fillRect(S * .26, S * .52, S * .07, S * .07);
      g.fillStyle = '#7a4b2a'; g.fillRect(S * .76, S * .5, S * .04, S * .24);
      g.fillStyle = '#3d7a34'; g.beginPath(); g.arc(S * .78, S * .46, S * .11, 0, 7); g.fill();
    } else {
      const sky = g.createLinearGradient(0, 0, 0, S * .55); sky.addColorStop(0, '#f6b26b'); sky.addColorStop(1, '#fde7c8'); g.fillStyle = sky; g.fillRect(0, 0, S, S * .55);
      g.fillStyle = '#e06666'; g.beginPath(); g.arc(S * .25, S * .32, S * .1, 0, 7); g.fill();
      const sea = g.createLinearGradient(0, S * .55, 0, S); sea.addColorStop(0, '#3d85c6'); sea.addColorStop(1, '#0b5394'); g.fillStyle = sea; g.fillRect(0, S * .55, S, S * .45);
      g.fillStyle = '#5b3a1e'; g.beginPath(); g.moveTo(S * .42, S * .66); g.lineTo(S * .88, S * .66); g.lineTo(S * .8, S * .76); g.lineTo(S * .5, S * .76); g.closePath(); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(S * .64, S * .26); g.lineTo(S * .64, S * .63); g.lineTo(S * .46, S * .63); g.closePath(); g.fill();
      g.fillStyle = '#eeeeee'; g.beginPath(); g.moveTo(S * .67, S * .32); g.lineTo(S * .67, S * .63); g.lineTo(S * .82, S * .63); g.closePath(); g.fill();
      g.strokeStyle = '#3a2410'; g.lineWidth = S * .015; g.beginPath(); g.moveTo(S * .655, S * .24); g.lineTo(S * .655, S * .67); g.stroke();
    }
    return c;
  }
  V.register('augment', el => {
    const ui = V.shell(el, {
      title: '데이터 증강: 레이블을 지키는 변환',
      desc: '원본 이미지 한 장에서 무작위 변환으로 매번 다른 학습 표본을 만든다. Mixup과 CutMix는 두 이미지를 섞고 레이블도 같은 비율로 섞는다. 학습 중에는 배치마다 새로 뽑으므로 모델은 같은 이미지를 같은 모습으로 두 번 보지 않는다.',
      how: ['왼쪽 위가 원본이다. 나머지 일곱 칸이 같은 설정에서 뽑은 증강 결과다.', '아래 글자는 학습에 쓰는 레이블이다. 일반 증강은 레이블이 그대로이고, Mixup·CutMix는 섞은 비율만큼 두 레이블을 나눠 가진다.'],
      try: ['자르기 강도를 최대로 올리면 집의 일부만 남는 표본이 생긴다. 모델은 부분만 보고도 맞히도록 배운다. 너무 강하면 집이 아예 사라진 "레이블 오류" 표본이 생긴다.', '숫자 데이터라면 좌우 뒤집기를 쓰면 안 된다. 어떤 숫자가 문제가 되는가?', 'Mixup과 CutMix를 비교한다. Mixup은 두 이미지가 반투명하게 겹치고, CutMix는 한 이미지의 사각형 조각이 다른 이미지에 붙는다.']
    });
    const cv = ui.canvas(ui.body, 0, { aspect: .55, minH: 260, maxH: 460 });
    const S = 128, A = scene('house', S), B = scene('boat', S);
    let mode = 'basic', flip = true, crop = .5, rot = 10, color = .4, cut = false, seed = 1;
    ui.select({ label: '방식', options: [['basic', '일반 증강'], ['mixup', 'Mixup'], ['cutmix', 'CutMix']], value: mode, onChange: v => { mode = v; draw(); } });
    ui.toggle({ label: '좌우 뒤집기', value: flip, onChange: v => { flip = v; draw(); } });
    ui.slider({ label: '자르기 강도', min: 0, max: .9, step: .1, value: crop, fmt: v => v ? `면적 ${Math.round((1 - v) * 100)}~100%` : '끔', onInput: v => { crop = v; draw(); } });
    ui.slider({ label: '회전 ±', min: 0, max: 45, step: 5, value: rot, fmt: v => v + '°', onInput: v => { rot = v; draw(); } });
    ui.slider({ label: '색 변화', min: 0, max: .8, step: .1, value: color, fmt: v => v.toFixed(1), onInput: v => { color = v; draw(); } });
    ui.toggle({ label: '컷아웃', value: cut, onChange: v => { cut = v; draw(); } });
    ui.button({ label: '다시 뽑기', primary: true, onClick: () => { seed++; draw(); } });
    function augmentOne(r) {
      const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
      // 무작위 크기 조절 자르기
      let sw = S, sh = S, sx = 0, sy = 0;
      if (crop > 0) {
        const area = (1 - crop + crop * r()) * S * S, ar = Math.exp(Math.log(3 / 4) + r() * Math.log(16 / 9));
        sw = Math.min(S, Math.sqrt(area * ar)); sh = Math.min(S, Math.sqrt(area / ar)); sx = r() * (S - sw); sy = r() * (S - sh);
      }
      g.save(); g.translate(S / 2, S / 2);
      if (rot) g.rotate((r() * 2 - 1) * rot * Math.PI / 180);
      if (flip && r() < .5) g.scale(-1, 1);
      g.drawImage(A, sx, sy, sw, sh, -S / 2, -S / 2, S, S); g.restore();
      // 색 변화: 밝기, 대비, 채도
      if (color > 0) {
        const br = 1 + (r() * 2 - 1) * color, ct = 1 + (r() * 2 - 1) * color, sa = 1 + (r() * 2 - 1) * color;
        const im = g.getImageData(0, 0, S, S), d = im.data;
        for (let i = 0; i < d.length; i += 4) {
          let R = d[i] * br, G = d[i + 1] * br, Bc = d[i + 2] * br;
          R = (R - 128) * ct + 128; G = (G - 128) * ct + 128; Bc = (Bc - 128) * ct + 128;
          const Y = .299 * R + .587 * G + .114 * Bc; R = Y + (R - Y) * sa; G = Y + (G - Y) * sa; Bc = Y + (Bc - Y) * sa;
          d[i] = V.clamp(R, 0, 255); d[i + 1] = V.clamp(G, 0, 255); d[i + 2] = V.clamp(Bc, 0, 255);
        }
        g.putImageData(im, 0, 0);
      }
      if (cut) { const L = S * .3, cx = r() * S, cy = r() * S; g.fillStyle = '#808080'; g.fillRect(cx - L / 2, cy - L / 2, L, L); }
      return c;
    }
    function mix(r) {
      const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
      // λ ~ Beta(1, 1) = 균등분포
      const lam = r();
      if (mode === 'mixup') {
        g.drawImage(A, 0, 0); g.globalAlpha = 1 - lam; g.drawImage(B, 0, 0); g.globalAlpha = 1;
        return { c, lab: `집 ${lam.toFixed(2)} · 배 ${(1 - lam).toFixed(2)}` };
      }
      const cw = S * Math.sqrt(1 - lam), ch = cw, cx = r() * S, cy = r() * S;
      const x0 = V.clamp(cx - cw / 2, 0, S), x1 = V.clamp(cx + cw / 2, 0, S), y0 = V.clamp(cy - ch / 2, 0, S), y1 = V.clamp(cy + ch / 2, 0, S);
      g.drawImage(A, 0, 0); g.drawImage(B, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
      const frac = (x1 - x0) * (y1 - y0) / (S * S);
      return { c, lab: `집 ${(1 - frac).toFixed(2)} · 배 ${frac.toFixed(2)}` };
    }
    function draw() {
      const pal = V.pal(); cv.size();
      const ctx = cv.ctx, cols = 4, gap = 10, cs = Math.min((cv.w - gap * (cols + 1)) / cols, (cv.h - 2 * 30 - gap) / 2), x0 = (cv.w - (cs * cols + gap * (cols - 1))) / 2;
      const r = V.rng(seed * 7919);
      ctx.imageSmoothingEnabled = true;
      for (let k = 0; k < 8; k++) {
        const col = k % cols, rowi = Math.floor(k / cols), x = x0 + col * (cs + gap), y = 4 + rowi * (cs + 30);
        let im = A, lab = '집 1.00';
        if (k > 0) { if (mode === 'basic') im = augmentOne(r); else { const m = mix(r); im = m.c; lab = m.lab; } }
        ctx.drawImage(im, x, y, cs, cs);
        ctx.strokeStyle = k === 0 ? pal.accent : pal.border2; ctx.lineWidth = k === 0 ? 2.5 : 1; ctx.strokeRect(x + .5, y + .5, cs - 1, cs - 1);
        text(ctx, k === 0 ? '원본 (레이블: 집)' : lab, x + cs / 2, y + cs + 14, { color: k === 0 ? pal.accent : pal.text2, font: k === 0 ? V.FONT_B : V.FONT });
      }
      ui.setRO(mode === 'basic' ? '일반 증강: 레이블은 모두 "집"이다. 변환은 이미지의 내용(클래스)을 바꾸지 않는 범위에서 골라야 한다.' : `${mode === 'mixup' ? 'Mixup: x = λ·집 + (1 − λ)·배' : 'CutMix: 배 이미지의 사각형 조각을 붙이고, 면적 비율로 레이블을 나눈다'}. λ는 Beta(1, 1)에서 뽑았다.`);
    }
    draw(); V.onEnv(el, draw);
  });

  V.modsReady.push('w5');
})();
