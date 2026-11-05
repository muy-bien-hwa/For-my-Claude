/* 시각화 핵심 라이브러리: 셸, 컨트롤, 2D 좌표계, 등고선, 3D 곡면, 히트맵, 색 지도, 생명주기 */
(function () {
  'use strict';
  const V = window.V = {};

  /* ---------- 카탈로그 (실험실 목록 + 모듈 지연 로딩) ---------- */
  V.catalog = [
    { id: 'learn-1d', mod: 'w1', day: 1, title: '파라미터 탐색으로 보는 학습', kw: '손실 학습 파라미터' },
    { id: 'broadcast', mod: 'w1', day: 2, title: '브로드캐스팅 규칙', kw: 'NumPy 형상 shape' },
    { id: 'vectors', mod: 'w1', day: 3, title: '벡터 연산과 내적', kw: '내적 투영 코사인' },
    { id: 'matrix-transform', mod: 'w1', day: 4, title: '행렬 = 공간의 변환', kw: '선형변환 행렬식 고윳값' },
    { id: 'svd', mod: 'w1', day: 4, title: 'SVD 저랭크 근사', kw: '특잇값 압축' },
    { id: 'derivative', mod: 'w1', day: 5, title: '미분 = 접선의 기울기', kw: '도함수 할선' },
    { id: 'gradient-field', mod: 'w1', day: 5, title: '등고선과 그래디언트', kw: '등고선 그래디언트 편미분 3D' },
    { id: 'distributions', mod: 'w1', day: 6, title: '확률분포와 표본', kw: '가우시안 베르누이 큰 수의 법칙' },
    { id: 'likelihood', mod: 'w1', day: 6, title: '최대우도추정', kw: 'MLE 우도' },
    { id: 'cross-entropy', mod: 'w1', day: 6, title: '교차 엔트로피 손실', kw: '로그 손실 엔트로피' },
    { id: 'regression-fit', mod: 'w2', day: 8, title: '선형회귀와 잔차', kw: 'MSE 최소제곱' },
    { id: 'gd-1d', mod: 'w2', day: 9, title: '1차원 경사하강법과 학습률', kw: '학습률 발산 진동' },
    { id: 'gd', mod: 'w2', day: 9, title: '손실 지형: 등고선과 3D', kw: '경사하강법 등고선 3D 손실' },
    { id: 'logistic', mod: 'w2', day: 10, title: '로지스틱 회귀의 결정 경계', kw: '시그모이드 확률' },
    { id: 'softmax', mod: 'w2', day: 11, title: '소프트맥스와 온도', kw: '로짓 확률 교차 엔트로피' },
    { id: 'overfit', mod: 'w2', day: 12, title: '과적합과 규제', kw: '다항 회귀 차수 L2' },
    { id: 'threshold', mod: 'w2', day: 12, title: '임계값과 정밀도·재현율', kw: 'ROC PR 혼동 행렬' },
    { id: 'knn', mod: 'w2', day: 13, title: 'k-최근접 이웃', kw: 'kNN 결정 경계' },
    { id: 'perceptron', mod: 'w3', day: 15, title: '퍼셉트론과 XOR', kw: '선형 분리' },
    { id: 'space-warp', mod: 'w3', day: 16, title: '은닉층이 공간을 바꾸는 방식', kw: '표현 학습 공간 변환' },
    { id: 'activation', mod: 'w3', day: 16, title: '활성화 함수와 도함수', kw: 'ReLU 시그모이드 GELU' },
    { id: 'playground', mod: 'w3', day: 16, title: '신경망 놀이터', kw: 'MLP 결정 경계 학습' },
    { id: 'shapes', mod: 'w3', day: 17, title: '순전파의 형상 추적', kw: '행렬곱 파라미터 FLOPs' },
    { id: 'compgraph', mod: 'w3', day: 18, title: '계산 그래프 위의 역전파', kw: '연쇄법칙 기울기' },
    { id: 'backprop-steps', mod: 'w3', day: 18, title: '역전파 단계별 실행', kw: '순전파 역전파 단계' },
    { id: 'optim', mod: 'w4', day: 22, title: '옵티마이저 비교', kw: 'SGD 모멘텀 Adam 등고선' },
    { id: 'ema', mod: 'w4', day: 22, title: '지수 이동 평균', kw: 'EMA 편향 보정' },
    { id: 'lr-schedule', mod: 'w4', day: 23, title: '학습률 스케줄', kw: '워밍업 코사인' },
    { id: 'init', mod: 'w4', day: 24, title: '초기화와 활성화 분포', kw: 'Xavier He 기울기 소실' },
    { id: 'batchnorm', mod: 'w4', day: 25, title: '배치 정규화', kw: 'BatchNorm 분포' },
    { id: 'dropout', mod: 'w4', day: 26, title: '드롭아웃', kw: '규제 부분망' },
    { id: 'conv', mod: 'w5', day: 31, title: '합성곱과 풀링', kw: '커널 특성 맵' },
    { id: 'conv-shape', mod: 'w5', day: 31, title: '합성곱 출력 크기 계산기', kw: '패딩 스트라이드' },
    { id: 'receptive-field', mod: 'w5', day: 32, title: '수용 영역', kw: 'CNN 층' },
    { id: 'residual-flow', mod: 'w5', day: 33, title: '잔차 연결과 기울기 흐름', kw: 'ResNet' },
    { id: 'augment', mod: 'w5', day: 34, title: '데이터 증강', kw: '뒤집기 자르기 색' },
    { id: 'rnn-unroll', mod: 'w6', day: 36, title: 'RNN 시간 펼치기', kw: '은닉 상태' },
    { id: 'bptt', mod: 'w6', day: 36, title: '시간에 따른 기울기 소실', kw: 'BPTT' },
    { id: 'lstm-gates', mod: 'w6', day: 37, title: 'LSTM 게이트', kw: '셀 상태' },
    { id: 'bpe', mod: 'w6', day: 38, title: 'BPE 병합 과정', kw: '토큰화 서브워드' },
    { id: 'embedding-space', mod: 'w6', day: 39, title: '임베딩 공간과 유추', kw: 'word2vec 벡터' },
    { id: 'sampling', mod: 'w6', day: 40, title: '생성 샘플링 전략', kw: '온도 top-k top-p' },
    { id: 'alignment', mod: 'w6', day: 41, title: '번역 어텐션 정렬', kw: 'Seq2Seq 어텐션' },
    { id: 'qkv', mod: 'w7', day: 43, title: 'Query·Key·Value 단계별 계산', kw: '어텐션' },
    { id: 'attention', mod: 'w7', day: 43, title: '셀프 어텐션 가중치', kw: '마스크 온도' },
    { id: 'transformer-block', mod: 'w7', day: 44, title: '트랜스포머 블록 구조', kw: '멀티헤드 FFN 잔차' },
    { id: 'pos-encoding', mod: 'w7', day: 44, title: '위치 인코딩', kw: '사인파' },
    { id: 'lora', mod: 'w7', day: 47, title: 'LoRA 저랭크 분해', kw: '미세조정 파라미터' },
    { id: 'vit-patches', mod: 'w7', day: 48, title: '이미지 패치 토큰', kw: 'ViT' },
    { id: 'vae-latent', mod: 'w8', day: 50, title: 'VAE 잠재 공간과 KL', kw: 'ELBO 사전분포' },
    { id: 'gan-1d', mod: 'w8', day: 51, title: '1차원 GAN 학습', kw: '생성자 판별자' },
    { id: 'diffusion-2d', mod: 'w8', day: 52, title: '2차원 확산 과정', kw: '노이즈 역방향' },
    { id: 'gridworld', mod: 'w8', day: 53, title: 'Q-러닝 미로', kw: '강화학습 가치' },
    { id: 'quantization', mod: 'w8', day: 54, title: '양자화 오차', kw: 'int8 경량화' }
  ];
  V.modsReady = [];                     // 불러온 모듈 (각 모듈 파일이 스스로 등록)
  V.modsAvailable = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'];             // 배포된 모듈. 실험실은 이 모듈의 시각화만 보여 준다.
  const CAT = Object.fromEntries(V.catalog.map(c => [c.id, c]));
  const REG = {};
  V.register = (id, fn) => { REG[id] = fn; };
  const loading = {};
  function loadMod(mod) {
    if (!loading[mod]) loading[mod] = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = `assets/viz/${mod}.js`; s.onload = res; s.onerror = () => rej(new Error('모듈 로드 실패: ' + mod));
      document.head.appendChild(s);
    });
    return loading[mod];
  }
  V.mount = async function (el) {
    const id = el.dataset.viz, meta = CAT[id];
    try {
      if (!REG[id]) {
        if (!meta) throw new Error('알 수 없는 시각화: ' + id);
        el.innerHTML = '<div class="viz"><div class="vh"><p class="vd">시각화를 불러오는 중</p></div></div>';
        await loadMod(meta.mod);
      }
      el.innerHTML = '';
      REG[id](el, meta || {});
      if (window.renderMathInElement) renderMathInElement(el, { delimiters: [{ left: '$', right: '$', display: false }], throwOnError: false, ignoredTags: ['script', 'textarea', 'option', 'select'] });
    } catch (e) {
      console.error(e);
      el.innerHTML = `<div class="viz"><div class="vh"><p class="vd">시각화를 표시하지 못했다: ${e.message}</p></div></div>`;
    }
  };

  /* ---------- 생명주기 ---------- */
  const running = new Set();
  V.loop = fn => {
    const o = { on: true };
    running.add(o);
    const tick = t => { if (!o.on) return; if (fn(t) === false) { o.on = false; running.delete(o); return; } requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    o.stop = () => { o.on = false; running.delete(o); };
    return o;
  };
  V.stopAll = () => { running.forEach(o => o.on = false); running.clear(); };
  const envFns = new Set();
  V.onEnv = (node, fn) => { const f = () => { if (!node.isConnected) { envFns.delete(f); return; } fn(); }; envFns.add(f); };
  let rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => envFns.forEach(f => f()), 120); });
  window.addEventListener('themechange', () => envFns.forEach(f => f()));
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => envFns.forEach(f => f()));

  /* ---------- 색 ---------- */
  const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  V.isDark = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
  V.pal = () => {
    const dark = V.isDark();
    return {
      dark, text: cssv('--text'), text2: cssv('--text-2'), muted: cssv('--muted'), border: cssv('--border'), border2: cssv('--border-strong'),
      surface: cssv('--surface'), surface2: cssv('--surface-2'), surface3: cssv('--surface-3'), accent: cssv('--accent'), accentSoft: cssv('--accent-soft'),
      ok: cssv('--ok'), warn: cssv('--warn'), bad: cssv('--bad'), teal: cssv('--teal'),
      series: dark ? ['#7fa6f0', '#e0827a', '#5cbfb5', '#d5a35c', '#ad94e6', '#93c26a'] : ['#2c5db6', '#c0433b', '#1d7f78', '#b5700e', '#7350b5', '#4d7d28']
    };
  };
  const hex = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  V.hex = hex;
  V.rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
  const ramp = (stops, t) => {
    t = Math.max(0, Math.min(1, t));
    const k = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1))), u = t * (stops.length - 1) - k;
    const a = stops[k], b = stops[k + 1];
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
  };
  const CM = {
    // 손실 지형: 낮음(골짜기) = 진한 파랑, 높음 = 배경에 가까운 색
    loss: () => V.isDark() ? ['#5b8fe8', '#3d64a8', '#2c3f62', '#25292f'].map(hex) : ['#1d4d9b', '#4f82c8', '#9fbde3', '#e9edf3'].map(hex),
    // 크기(0~1): 배경 → 강조색
    mag: () => V.isDark() ? ['#22252b', '#2f4772', '#7fa6f0'].map(hex) : ['#eef0f3', '#9cb6e0', '#1f4e9c'].map(hex),
    // 부호: 음수 빨강, 0 중립, 양수 파랑
    div: () => V.isDark() ? ['#e0827a', '#3a2b2c', '#26282d', '#2a3550', '#7fa6f0'].map(hex) : ['#b9403a', '#e9b4ae', '#f1f2f4', '#adc4e8', '#2c5db6'].map(hex),
    // 확률(0~1): 빨강(0) — 중립 — 파랑(1)
    prob: () => V.isDark() ? ['#d9786f', '#3a2c2d', '#2a3550', '#7fa6f0'].map(hex) : ['#c0433b', '#f0d4d0', '#d4e0f3', '#2c5db6'].map(hex)
  };
  V.cmap = (name, t) => ramp(CM[name](), t);
  V.cmapCss = (name, t, a = 1) => { const [r, g, b] = V.cmap(name, t); return `rgba(${r | 0},${g | 0},${b | 0},${a})`; };

  /* ---------- 수치 도우미 ---------- */
  V.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  V.lerp = (a, b, t) => a + (b - a) * t;
  V.linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
  V.fmt = (x, d = 3) => {
    if (!isFinite(x)) return x > 0 ? '∞' : (x < 0 ? '-∞' : 'NaN');
    const ax = Math.abs(x);
    if (ax !== 0 && (ax < 1e-3 || ax >= 1e5)) return x.toExponential(2).replace('e+', 'e');
    return (+x.toFixed(d)).toString();
  };
  V.rng = seed => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
  V.gauss = r => { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  V.niceStep = range => { const s = Math.pow(10, Math.floor(Math.log10(range / 5))); const m = range / 5 / s; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * s; };
  V.niceNum = v => { if (v === 0) return 0; const e = Math.floor(Math.log10(Math.abs(v))); const f = v / Math.pow(10, e); const r = Math.round(f * 2) / 2; return +(r * Math.pow(10, e)).toPrecision(3); };

  /* ---------- 셸과 컨트롤 ---------- */
  V.shell = function (el, o) {
    el.classList.add('viz');
    const no = el.dataset.no ? `인터랙티브 ${el.dataset.no}` : '인터랙티브';
    el.innerHTML = `<div class="vh"><div class="vno">${no}</div><div class="vt">${o.title || ''}</div>${o.desc ? `<p class="vd">${o.desc}</p>` : ''}</div>
      <div class="vbody"></div><div class="ctrls"></div><div class="ro"></div>
      ${(o.how || o.try) ? `<details class="how"><summary>읽는 법과 해 볼 것</summary><div class="hb"><div><h5>읽는 법</h5><ul>${(o.how || []).map(x => `<li>${x}</li>`).join('')}</ul></div><div><h5>해 볼 것</h5><ul>${(o.try || []).map(x => `<li>${x}</li>`).join('')}</ul></div></div></details>` : ''}`;
    const body = el.querySelector('.vbody'), ctrls = el.querySelector('.ctrls'), ro = el.querySelector('.ro');
    if (!o.controls) ctrls.style.display = 'none';
    const ui = {
      el, body, ctrls, ro,
      row(cols) { const r = document.createElement('div'); r.className = 'vrow'; r.style.setProperty('--cols', cols || 1); body.appendChild(r); return r; },
      panel(parent, label) { const p = document.createElement('div'); p.className = 'vpanel'; if (label) p.innerHTML = `<div class="vlab">${label}</div>`; (parent || body).appendChild(p); return p; },
      canvas(parent, h, opts) { return new Canvas(parent || body, h, opts); },
      legend(parent, items) {
        const d = document.createElement('div'); d.className = 'legend';
        d.innerHTML = items.map(it => `<span><i class="${it.type || ''}" style="${it.type === 'dash' ? `--c:${it.color}` : `background:${it.color}`}"></i>${it.label}</span>`).join('');
        (parent || body).appendChild(d); return d;
      },
      setRO(text) { ro.textContent = text; ro.style.display = text ? '' : 'none'; },
      slider({ label, min, max, step, value, fmt, onInput }) {
        ctrls.style.display = '';
        const w = document.createElement('label'); w.className = 'ctrl';
        w.innerHTML = `<span class="cl">${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}"><span class="cv"></span>`;
        const inp = w.querySelector('input'), cv = w.querySelector('.cv');
        const show = () => { cv.textContent = fmt ? fmt(+inp.value) : V.fmt(+inp.value); };
        inp.addEventListener('input', () => { show(); onInput && onInput(+inp.value); });
        show(); ctrls.appendChild(w);
        return { el: w, get value() { return +inp.value; }, set value(v) { inp.value = v; show(); }, input: inp };
      },
      select({ label, options, value, onChange }) {
        ctrls.style.display = '';
        const w = document.createElement('label'); w.className = 'ctrl';
        w.innerHTML = `<span class="cl">${label}</span><select>${options.map(([v, t]) => `<option value="${v}" ${String(v) === String(value) ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
        const s = w.querySelector('select'); s.addEventListener('change', () => onChange && onChange(s.value));
        ctrls.appendChild(w);
        return { el: w, get value() { return s.value; }, set value(v) { s.value = v; } };
      },
      toggle({ label, value, onChange }) {
        ctrls.style.display = '';
        const w = document.createElement('label'); w.className = 'ctrl';
        w.innerHTML = `<input type="checkbox" ${value ? 'checked' : ''}><span class="cl">${label}</span>`;
        const c = w.querySelector('input'); c.addEventListener('change', () => onChange && onChange(c.checked));
        ctrls.appendChild(w);
        return { el: w, get value() { return c.checked; }, set value(v) { c.checked = v; } };
      },
      button({ label, onClick, primary }) {
        ctrls.style.display = '';
        const b = document.createElement('button'); b.className = 'btn sm' + (primary ? ' primary' : ''); b.type = 'button'; b.textContent = label;
        b.addEventListener('click', onClick); ctrls.appendChild(b);
        b.setLabel = t => { b.textContent = t; };
        return b;
      },
      text(html) { ctrls.style.display = ''; const s = document.createElement('span'); s.className = 'muted'; s.style.fontSize = '13px'; s.innerHTML = html; ctrls.appendChild(s); return s; }
    };
    ui.setRO('');
    return ui;
  };

  /* ---------- 캔버스 ---------- */
  class Canvas {
    constructor(parent, h, opts = {}) {
      this.el = document.createElement('canvas');
      this.el.setAttribute('role', 'img');
      if (opts.label) this.el.setAttribute('aria-label', opts.label);
      parent.appendChild(this.el);
      this.hOpt = h; this.aspect = opts.aspect; this.minH = opts.minH || 160; this.maxH = opts.maxH || 560;
      this.size();
    }
    size() {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(10, this.el.parentElement.clientWidth);
      let h = this.aspect ? V.clamp(w * this.aspect, this.minH, this.maxH) : this.hOpt;
      this.el.style.height = h + 'px';
      this.el.width = Math.round(w * dpr); this.el.height = Math.round(h * dpr);
      this.w = w; this.h = h; this.dpr = dpr;
      this.ctx = this.el.getContext('2d');
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.clearRect(0, 0, w, h);
      return this;
    }
    pos(e) { const r = this.el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    drag({ down, move, up, hover }) {
      let active = false;
      this.el.addEventListener('pointerdown', e => { active = true; this.el.setPointerCapture(e.pointerId); down && down(...this.pos(e), e); });
      this.el.addEventListener('pointermove', e => { if (active) move && move(...this.pos(e), e); else hover && hover(...this.pos(e), e); });
      const end = e => { if (active) { active = false; up && up(...this.pos(e), e); } };
      this.el.addEventListener('pointerup', end); this.el.addEventListener('pointercancel', end);
      this.el.addEventListener('pointerleave', e => { if (!active && hover) hover(null, null, e); });
    }
  }
  V.Canvas = Canvas;

  const FONT = '12.5px "Noto Sans KR", system-ui, sans-serif';
  const FONT_B = '600 12.5px "Noto Sans KR", system-ui, sans-serif';
  const MONO = '11.5px "JetBrains Mono", ui-monospace, monospace';
  V.FONT = FONT; V.MONO = MONO; V.FONT_B = FONT_B;

  /* ---------- 2D 좌표계 ---------- */
  V.plot = function (cv, o) {
    const ctx = cv.ctx, pal = V.pal();
    const pad = Object.assign({ l: 52, r: 18, t: 16, b: 44 }, o.pad || {});
    let x0 = pad.l, x1 = cv.w - pad.r, y0 = pad.t, y1 = cv.h - pad.b;
    let xr = o.x.slice(), yr = o.y.slice();
    if (o.equal) {               // 같은 축척: 데이터 범위를 늘려 맞춤
      const sx = (x1 - x0) / (xr[1] - xr[0]), sy = (y1 - y0) / (yr[1] - yr[0]);
      if (sx > sy) { const c = (xr[0] + xr[1]) / 2, half = (x1 - x0) / sy / 2; xr = [c - half, c + half]; }
      else { const c = (yr[0] + yr[1]) / 2, half = (y1 - y0) / sx / 2; yr = [c - half, c + half]; }
    }
    const X = x => x0 + (x - xr[0]) / (xr[1] - xr[0]) * (x1 - x0);
    const Y = y => y1 - (y - yr[0]) / (yr[1] - yr[0]) * (y1 - y0);
    const P = {
      ctx, pal, X, Y, xr, yr, box: { x0, x1, y0, y1 },
      ix: px => xr[0] + (px - x0) / (x1 - x0) * (xr[1] - xr[0]),
      iy: py => yr[0] + (y1 - py) / (y1 - y0) * (yr[1] - yr[0]),
      inside: (px, py) => px >= x0 && px <= x1 && py >= y0 && py <= y1,
      clip() { ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip(); return P; },
      unclip() { ctx.restore(); return P; },
      axes(opt = {}) {
        const sx = opt.xstep || V.niceStep(xr[1] - xr[0]), sy = opt.ystep || V.niceStep(yr[1] - yr[0]);
        ctx.lineWidth = 1;
        if (o.grid !== false) {
          ctx.strokeStyle = V.rgba(pal.border2.startsWith('#') ? pal.border2 : '#999999', 0.45);
          ctx.beginPath();
          if (!opt.noX) for (let x = Math.ceil(xr[0] / sx) * sx; x <= xr[1] + 1e-9; x += sx) { ctx.moveTo(X(x) + .5, y0); ctx.lineTo(X(x) + .5, y1); }
          for (let y = Math.ceil(yr[0] / sy) * sy; y <= yr[1] + 1e-9; y += sy) { ctx.moveTo(x0, Y(y) + .5); ctx.lineTo(x1, Y(y) + .5); }
          ctx.stroke();
        }
        ctx.strokeStyle = pal.border2; ctx.beginPath();
        ctx.rect(x0 + .5, y0 + .5, x1 - x0 - 1, y1 - y0 - 1); ctx.stroke();
        if (opt.zero !== false) {
          ctx.strokeStyle = pal.muted; ctx.beginPath();
          if (yr[0] < 0 && yr[1] > 0) { ctx.moveTo(x0, Y(0) + .5); ctx.lineTo(x1, Y(0) + .5); }
          if (xr[0] < 0 && xr[1] > 0) { ctx.moveTo(X(0) + .5, y0); ctx.lineTo(X(0) + .5, y1); }
          ctx.stroke();
        }
        ctx.fillStyle = pal.muted; ctx.font = MONO;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        const fx = opt.xfmt || (v => V.fmt(v, 2)), fy = opt.yfmt || (v => V.fmt(v, 2));
        if (!opt.noX) for (let x = Math.ceil(xr[0] / sx) * sx; x <= xr[1] + 1e-9; x += sx) ctx.fillText(fx(Math.abs(x) < 1e-12 ? 0 : x), X(x), y1 + 6);
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        for (let y = Math.ceil(yr[0] / sy) * sy; y <= yr[1] + 1e-9; y += sy) ctx.fillText(fy(Math.abs(y) < 1e-12 ? 0 : y), x0 - 6, Y(y));
        ctx.fillStyle = pal.text2; ctx.font = FONT_B;
        if (o.xlabel) { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(o.xlabel, (x0 + x1) / 2, cv.h - 4); }
        if (o.ylabel) { ctx.save(); ctx.translate(13, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.ylabel, 0, 0); ctx.restore(); }
        ctx.textBaseline = 'alphabetic';
        return P;
      },
      fn(f, color, width = 2.2, dash, range) {
        const [a, b] = range || xr; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
        ctx.beginPath(); let pen = false; const N = Math.max(200, Math.round(x1 - x0));
        for (let i = 0; i <= N; i++) {
          const x = a + (b - a) * i / N, y = f(x);
          if (!isFinite(y) || Math.abs(Y(y)) > 1e5) { pen = false; continue; }
          pen ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); pen = true;
        }
        ctx.stroke(); ctx.setLineDash([]); return P;
      },
      line(pts, color, width = 2, dash) {
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.beginPath();
        pts.forEach(([x, y], i) => i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))); ctx.stroke(); ctx.setLineDash([]); return P;
      },
      dot(x, y, r, fill, stroke) {
        ctx.beginPath(); ctx.arc(X(x), Y(y), r, 0, 7);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
        return P;
      },
      arrow(xa, ya, xb, yb, color, width = 2, head = 8) { V.arrowPx(ctx, X(xa), Y(ya), X(xb), Y(yb), color, width, head); return P; },
      label(x, y, text, opt = {}) { V.label(ctx, X(x) + (opt.dx || 0), Y(y) + (opt.dy || 0), text, Object.assign({ color: pal.text }, opt)); return P; }
    };
    return P;
  };
  V.arrowPx = (ctx, xa, ya, xb, yb, color, width = 2, head = 8) => {
    const ang = Math.atan2(yb - ya, xb - xa), len = Math.hypot(xb - xa, yb - ya);
    if (len < 1) return;
    const hl = Math.min(head, len * 0.45);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb - Math.cos(ang) * hl * .8, yb - Math.sin(ang) * hl * .8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(xb, yb);
    ctx.lineTo(xb - hl * Math.cos(ang - .42), yb - hl * Math.sin(ang - .42));
    ctx.lineTo(xb - hl * Math.cos(ang + .42), yb - hl * Math.sin(ang + .42)); ctx.closePath(); ctx.fill();
  };
  V.label = (ctx, x, y, text, opt = {}) => {
    const pal = V.pal();
    ctx.font = opt.font || (opt.bold ? FONT_B : FONT);
    ctx.textAlign = opt.align || 'left'; ctx.textBaseline = opt.base || 'middle';
    if (opt.bg !== false) {
      const m = ctx.measureText(text), w = m.width + 8, h = 18;
      let bx = x - 4; if (ctx.textAlign === 'center') bx = x - w / 2; else if (ctx.textAlign === 'right') bx = x - w + 4;
      let by = y - h / 2; if (ctx.textBaseline === 'top') by = y - 2; else if (ctx.textBaseline === 'bottom') by = y - h + 2;
      ctx.fillStyle = V.rgba(pal.surface.startsWith('#') ? pal.surface : '#ffffff', opt.bgAlpha == null ? .86 : opt.bgAlpha);
      ctx.fillRect(bx, by, w, h);
    }
    ctx.fillStyle = opt.color || pal.text; ctx.fillText(text, x, y);
    ctx.textBaseline = 'alphabetic';
  };

  /* ---------- 등고선 ---------- */
  function niceLevels(vals, n, mode) {
    const s = vals.filter(isFinite).sort((a, b) => a - b);
    const lo = s[0], hi = s[Math.floor(s.length * 0.985)];
    const out = [];
    for (let i = 1; i <= n; i++) {
      let v;
      if (mode === 'linear') v = lo + (hi - lo) * i / (n + 1);
      else v = lo + (hi - lo) * Math.pow(i / (n + 1), 2);            // 바닥 쪽을 촘촘하게
      out.push(V.niceNum(v));
    }
    return [...new Set(out)].filter(v => v > lo).sort((a, b) => a - b);
  }
  /* f(x,y)의 등고선. opts: {levels | n, mode, fill, lines, labels, res, cmap, lineColor} */
  V.contour = function (P, f, opts = {}) {
    const ctx = P.ctx, pal = P.pal, { x0, x1, y0, y1 } = P.box;
    const nx = opts.res || 90, ny = Math.max(20, Math.round(nx * (y1 - y0) / (x1 - x0)));
    const gx = V.linspace(P.xr[0], P.xr[1], nx), gy = V.linspace(P.yr[0], P.yr[1], ny);
    const Z = [];
    for (let j = 0; j < ny; j++) { const row = []; for (let i = 0; i < nx; i++) row.push(f(gx[i], gy[j])); Z.push(row); }
    const flat = Z.flat();
    const levels = opts.levels || niceLevels(flat, opts.n || 9, opts.mode);
    const vmin = Math.min(...flat.filter(isFinite)), vmax = levels[levels.length - 1];
    const bandOf = v => { let k = 0; while (k < levels.length && v > levels[k]) k++; return k; };
    const cmap = opts.cmap || 'loss';
    // 채움: 띠별 색
    if (opts.fill !== false) {
      const step = 3, W = Math.ceil((x1 - x0) / step), H = Math.ceil((y1 - y0) / step);
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        const v = f(P.ix(x0 + c * step + step / 2), P.iy(y0 + r * step + step / 2));
        ctx.fillStyle = V.cmapCss(cmap, bandOf(v) / levels.length);
        ctx.fillRect(x0 + c * step, y0 + r * step, step + .5, step + .5);
      }
    }
    // 선: 마칭 스퀘어
    const segsByLevel = levels.map(L => {
      const segs = [];
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const a = Z[j][i], b = Z[j][i + 1], c = Z[j + 1][i + 1], d = Z[j + 1][i];
        const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const xa = gx[i], xb = gx[i + 1], ya = gy[j], yb = gy[j + 1];
        const t = (p, q) => (L - p) / (q - p);
        const top = [xa + (xb - xa) * t(a, b), ya], right = [xb, ya + (yb - ya) * t(b, c)], bottom = [xa + (xb - xa) * t(d, c), yb], left = [xa, ya + (yb - ya) * t(a, d)];
        const tbl = { 1: [[left, bottom]], 2: [[bottom, right]], 3: [[left, right]], 4: [[top, right]], 5: [[left, top], [bottom, right]], 6: [[top, bottom]], 7: [[left, top]], 8: [[left, top]], 9: [[top, bottom]], 10: [[left, bottom], [top, right]], 11: [[top, right]], 12: [[left, right]], 13: [[bottom, right]], 14: [[left, bottom]] };
        tbl[idx].forEach(s => segs.push(s));
      }
      return segs;
    });
    if (opts.lines !== false) {
      ctx.lineWidth = 1; ctx.strokeStyle = opts.lineColor || (pal.dark ? 'rgba(220,226,240,.45)' : 'rgba(25,40,70,.42)');
      segsByLevel.forEach(segs => { ctx.beginPath(); segs.forEach(([p, q]) => { ctx.moveTo(P.X(p[0]), P.Y(p[1])); ctx.lineTo(P.X(q[0]), P.Y(q[1])); }); ctx.stroke(); });
    }
    // 레이블: 각 등고선마다 하나, 서로 겹치지 않게
    if (opts.labels !== false) {
      const placed = [];
      const pref = opts.labelAt || [(x0 + x1) / 2 + (x1 - x0) * 0.18, (y0 + y1) / 2 - (y1 - y0) * 0.18];
      segsByLevel.forEach((segs, li) => {
        if (!segs.length) return;
        let best = null, bestScore = -1e9;
        for (let k = 0; k < segs.length; k += 2) {
          const [p, q] = segs[k], mx = P.X((p[0] + q[0]) / 2), my = P.Y((p[1] + q[1]) / 2);
          if (mx < x0 + 24 || mx > x1 - 24 || my < y0 + 12 || my > y1 - 12) continue;
          const dmin = placed.reduce((m, [px, py]) => Math.min(m, Math.hypot(px - mx, py - my)), 1e9);
          const score = Math.min(dmin, 120) - Math.hypot(mx - pref[0], my - pref[1]) * 0.25;
          if (score > bestScore) { bestScore = score; best = [mx, my]; }
        }
        if (best) {
          placed.push(best);
          V.label(ctx, best[0], best[1], V.fmt(levels[li], 3), { align: 'center', font: MONO, color: pal.text, bgAlpha: .8 });
        }
      });
    }
    return { levels, vmin, vmax, cmap };
  };
  /* 높이 L인 등고선 선분들 (데이터 좌표) */
  V.iso = function (f, xr, yr, L, nx = 90, ny = 90) {
    const gx = V.linspace(xr[0], xr[1], nx), gy = V.linspace(yr[0], yr[1], ny);
    const Z = gy.map(y => gx.map(x => f(x, y)));
    const segs = [];
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = Z[j][i], b = Z[j][i + 1], c = Z[j + 1][i + 1], d = Z[j + 1][i];
      const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const xa = gx[i], xb = gx[i + 1], ya = gy[j], yb = gy[j + 1], t = (p, q) => (L - p) / (q - p);
      const top = [xa + (xb - xa) * t(a, b), ya], right = [xb, ya + (yb - ya) * t(b, c)], bottom = [xa + (xb - xa) * t(d, c), yb], left = [xa, ya + (yb - ya) * t(a, d)];
      const tbl = { 1: [[left, bottom]], 2: [[bottom, right]], 3: [[left, right]], 4: [[top, right]], 5: [[left, top], [bottom, right]], 6: [[top, bottom]], 7: [[left, top]], 8: [[left, top]], 9: [[top, bottom]], 10: [[left, bottom], [top, right]], 11: [[top, right]], 12: [[left, right]], 13: [[bottom, right]], 14: [[left, bottom]] };
      tbl[idx].forEach(s => segs.push(s));
    }
    return segs;
  };
  /* 등고선용 색 막대 */
  V.colorbar = function (ctx, x, y, w, h, info, title) {
    const pal = V.pal(), n = info.levels.length + 1;
    for (let k = 0; k < n; k++) {
      ctx.fillStyle = V.cmapCss(info.cmap, k / info.levels.length);
      const yy = y + h - (k + 1) * h / n;
      ctx.fillRect(x, yy, w, h / n + .5);
    }
    ctx.strokeStyle = pal.border2; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
    ctx.font = MONO; ctx.fillStyle = pal.muted; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    info.levels.forEach((L, k) => { const yy = y + h - (k + 1) * h / n; ctx.fillText(V.fmt(L, 3), x + w + 4, yy); });
    ctx.font = FONT_B; ctx.fillStyle = pal.text2; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    if (title) ctx.fillText(title, x - 2, y - 6);
    ctx.font = FONT; ctx.fillStyle = pal.muted; ctx.textBaseline = 'top';
    ctx.fillText('낮음', x - 2, y + h + 4);
    ctx.textBaseline = 'alphabetic';
  };

  /* ---------- 3D 곡면 ---------- */
  V.surface3d = function (cv, f, o) {
    const ctx = cv.ctx, pal = V.pal();
    const n = o.n || 34, xr = o.xr, yr = o.yr, yaw = o.yaw, pitch = o.pitch;
    const zmin = o.zr[0], zmax = o.zr[1];
    const zs = o.zscale || 0.9;
    // 어떤 각도로 돌려도 잘리지 않도록 상자의 외접구 반지름으로 축척을 정한다
    const R = Math.sqrt(2 + zs * zs) * 0.93, s = Math.min(cv.w, cv.h) / (2 * R), cx = cv.w / 2, cy = cv.h / 2 + 4;
    const norm = (x, y, z) => [(x - (xr[0] + xr[1]) / 2) / ((xr[1] - xr[0]) / 2), (y - (yr[0] + yr[1]) / 2) / ((yr[1] - yr[0]) / 2), (V.clamp(z, zmin, zmax) - zmin) / (zmax - zmin) * zs * 2 - zs];
    const cy_ = Math.cos(yaw), sy_ = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const proj = (x, y, z) => {
      const [a, b, c] = norm(x, y, z);
      const x1 = a * cy_ - b * sy_, y1 = a * sy_ + b * cy_;
      const y2 = y1 * cp - c * sp, z2 = y1 * sp + c * cp;
      return [cx + s * x1, cy - s * z2, y2];
    };
    // 바닥 상자
    const corners = [[xr[0], yr[0]], [xr[1], yr[0]], [xr[1], yr[1]], [xr[0], yr[1]]].map(([x, y]) => proj(x, y, zmin));
    ctx.strokeStyle = pal.border2; ctx.lineWidth = 1; ctx.beginPath();
    corners.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.stroke();
    // 곡면 사각형
    const gx = V.linspace(xr[0], xr[1], n), gy = V.linspace(yr[0], yr[1], n);
    const Zg = gy.map(y => gx.map(x => f(x, y)));
    const quads = [];
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const pts = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => proj(gx[a], gy[b], Zg[b][a]));
      const zavg = (Zg[j][i] + Zg[j][i + 1] + Zg[j + 1][i + 1] + Zg[j + 1][i]) / 4;
      quads.push({ pts, depth: pts.reduce((m, p) => m + p[2], 0) / 4, z: zavg });
    }
    quads.sort((a, b) => b.depth - a.depth);
    const levels = o.levels;
    for (const q of quads) {
      let t;
      if (levels) { let k = 0; while (k < levels.length && q.z > levels[k]) k++; t = k / levels.length; }
      else t = (V.clamp(q.z, zmin, zmax) - zmin) / (zmax - zmin);
      // 간단한 음영
      const [p0, p1, , p3] = q.pts;
      const shade = V.clamp(0.82 + 0.18 * Math.sign((p1[0] - p0[0]) * (p3[1] - p0[1]) - (p1[1] - p0[1]) * (p3[0] - p0[0])), 0.64, 1);
      const [r, g, b] = V.cmap(o.cmap || 'loss', t);
      ctx.fillStyle = `rgb(${r * shade | 0},${g * shade | 0},${b * shade | 0})`;
      ctx.strokeStyle = pal.dark ? 'rgba(255,255,255,.12)' : 'rgba(30,40,60,.10)'; ctx.lineWidth = .6;
      ctx.beginPath(); q.pts.forEach(([px, py], k) => k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // 축 이름
    ctx.font = FONT_B; ctx.fillStyle = pal.text2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const ax = proj(xr[1] + (xr[1] - xr[0]) * .12, yr[0], zmin), ay = proj(xr[0], yr[1] + (yr[1] - yr[0]) * .12, zmin);
    if (o.xlabel) ctx.fillText(o.xlabel, ax[0], ax[1]);
    if (o.ylabel) ctx.fillText(o.ylabel, ay[0], ay[1]);
    if (o.zlabel) { const az = proj(xr[0], yr[0], zmax); ctx.fillText(o.zlabel, az[0] - 14, az[1] - 10); }
    // 경로
    if (o.path && o.path.length) {
      ctx.lineWidth = 2.2; ctx.strokeStyle = o.pathColor || pal.series[1]; ctx.beginPath();
      o.path.forEach(([x, y], k) => { const [px, py] = proj(x, y, f(x, y) + (zmax - zmin) * 0.01); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke();
      o.path.forEach(([x, y], k) => { const [px, py] = proj(x, y, f(x, y) + (zmax - zmin) * 0.01); ctx.beginPath(); ctx.arc(px, py, k === o.path.length - 1 ? 5 : 2.4, 0, 7); ctx.fillStyle = o.pathColor || pal.series[1]; ctx.fill(); });
    }
    if (o.marks) o.marks.forEach(m => { const [px, py] = proj(m.x, m.y, f(m.x, m.y)); ctx.beginPath(); ctx.arc(px, py, m.r || 5, 0, 7); ctx.fillStyle = m.color; ctx.fill(); if (m.label) V.label(ctx, px + 8, py - 10, m.label, { font: FONT, color: pal.text }); });
    return { proj };
  };
  /* 드래그로 회전하는 3D 뷰 상태 */
  V.orbit = function (cv, state, redraw) {
    let last = null;
    cv.el.classList.add('grab');
    cv.drag({
      down: (x, y) => { last = [x, y]; },
      move: (x, y) => { state.yaw -= (x - last[0]) * 0.012; state.pitch = V.clamp(state.pitch + (y - last[1]) * 0.01, 0.15, 1.45); last = [x, y]; redraw(); },
      up: () => { last = null; }
    });
  };

  /* ---------- 히트맵 ---------- */
  V.heatmap = function (ctx, rect, M, o = {}) {
    const pal = V.pal(), rows = M.length, cols = M[0].length;
    const { x, y, w, h } = rect, cw = w / cols, ch = h / rows;
    const flat = M.flat().filter(isFinite);
    const vmin = o.vmin != null ? o.vmin : Math.min(...flat), vmax = o.vmax != null ? o.vmax : Math.max(...flat);
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const v = M[i][j];
      if (!isFinite(v)) { ctx.fillStyle = pal.surface3; }
      else ctx.fillStyle = V.cmapCss(o.cmap || 'mag', (v - vmin) / ((vmax - vmin) || 1));
      ctx.fillRect(x + j * cw + .5, y + i * ch + .5, cw - 1, ch - 1);
      if (o.values && cw > 26 && ch > 16 && isFinite(v)) {
        const t = (v - vmin) / ((vmax - vmin) || 1);
        ctx.fillStyle = (o.cmap === 'div' ? Math.abs(t - .5) > .3 : t > .55) ? '#ffffff' : pal.text;
        ctx.font = MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((o.fmt || (z => V.fmt(z, 2)))(v), x + j * cw + cw / 2, y + i * ch + ch / 2);
      }
    }
    ctx.font = FONT; ctx.fillStyle = pal.text2; ctx.textBaseline = 'middle';
    if (o.rowLabels) { ctx.textAlign = 'right'; o.rowLabels.forEach((t, i) => ctx.fillText(t, x - 6, y + i * ch + ch / 2)); }
    if (o.colLabels) {
      o.colLabels.forEach((t, j) => {
        ctx.save(); ctx.translate(x + j * cw + cw / 2, y - 6);
        if (o.rotate) { ctx.rotate(-Math.PI / 4); ctx.textAlign = 'left'; } else ctx.textAlign = 'center';
        ctx.textBaseline = o.rotate ? 'middle' : 'bottom'; ctx.fillText(t, 0, 0); ctx.restore();
      });
    }
    ctx.textBaseline = 'alphabetic';
    return { cw, ch, vmin, vmax };
  };

  /* ---------- 간단한 막대그래프 ---------- */
  V.bars = function (cv, values, o = {}) {
    const ctx = cv.ctx, pal = V.pal();
    const P = V.plot(cv, { x: [-0.5, values.length - 0.5], y: o.y || [0, Math.max(1e-9, ...values) * 1.15], xlabel: o.xlabel, ylabel: o.ylabel, pad: o.pad, grid: true });
    P.axes({ noX: true, yfmt: o.yfmt, zero: false });
    const bw = (P.box.x1 - P.box.x0) / values.length * (o.width || 0.7);
    values.forEach((v, i) => {
      const xc = P.X(i), y0 = P.Y(Math.max(P.yr[0], 0)), y1 = P.Y(v);
      ctx.fillStyle = (o.colors && o.colors[i]) || o.color || pal.series[0];
      ctx.fillRect(xc - bw / 2, Math.min(y0, y1), bw, Math.abs(y0 - y1));
      if (o.labels) { ctx.fillStyle = pal.text2; ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(o.labels[i], xc, P.box.y1 + 6); }
      if (o.showValues) { ctx.fillStyle = pal.text; ctx.font = MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText((o.fmt || (z => V.fmt(z, 2)))(v), xc, Math.min(y0, y1) - 3); }
    });
    ctx.textBaseline = 'alphabetic';
    return P;
  };
})();
