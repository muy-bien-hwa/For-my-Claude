/* previews.js — 카드 썸네일로 쓰는 라이브 캔버스 스케치 모음.
 *
 * 각 스케치는 (ctx, w, h, t, p) 를 받는다.
 *   ctx  CSS 픽셀 좌표계로 이미 보정된 2D 컨텍스트
 *   w,h  CSS 픽셀 기준 캔버스 크기
 *   t    마운트 후 흐른 시간(초)
 *   p    포인터 { x, y, inside } — x,y 는 0~1 로 정규화, 캔버스 밖이면 inside=false
 *
 * 스케치는 매 프레임 전체를 다시 그린다. 상태를 들고 있지 않으므로
 * 어느 카드에 붙여도, 몇 개를 동시에 돌려도 서로 간섭하지 않는다.
 */
(function () {
  'use strict';

  var INK = '#e6e2d8';   // 종이색 — 선과 점
  var DIM = '#55514a';   // 가라앉은 선
  var SIG = '#c33c1e';   // 단 하나의 강조색
  var BG = '#141311';    // 카드 바탕

  function clear(ctx, w, h) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);
  }

  // 결정적 의사난수 — 새로고침해도 같은 그림이 나오게 한다.
  function rnd(i) {
    var x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // 포인터와의 거리를 0~1 영향력으로 바꾼다. 포인터가 없으면 0.
  function pull(p, x, y, w, h, radius) {
    if (!p.inside) return 0;
    var dx = (x - p.x * w) / radius;
    var dy = (y - p.y * h) / radius;
    var d = Math.sqrt(dx * dx + dy * dy);
    return d > 1 ? 0 : (1 - d) * (1 - d);
  }

  var PREVIEWS = {

    /* 표류 — 벡터장을 따라 누운 짧은 획들. 포인터가 지나가면 그쪽으로 휜다. */
    drift: function (ctx, w, h, t, p) {
      clear(ctx, w, h);
      var step = Math.max(14, Math.min(w, h) / 13);
      var len = step * 0.62;
      ctx.lineWidth = 1;
      ctx.lineCap = 'butt';
      for (var y = step * 0.6; y < h; y += step) {
        for (var x = step * 0.6; x < w; x += step) {
          var a = Math.sin(x * 0.012 + t * 0.35) + Math.cos(y * 0.015 - t * 0.22);
          var f = pull(p, x, y, w, h, Math.min(w, h) * 0.45);
          if (f > 0) {
            a += Math.atan2(p.y * h - y, p.x * w - x) * f * 1.6;
          }
          ctx.strokeStyle = f > 0.22 ? SIG : DIM;
          ctx.beginPath();
          ctx.moveTo(x - Math.cos(a) * len * 0.5, y - Math.sin(a) * len * 0.5);
          ctx.lineTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5);
          ctx.stroke();
        }
      }
    },

    /* 분절 — 가로로 잘린 띠가 서로 다른 속도로 어긋난다. */
    slice: function (ctx, w, h, t, p) {
      clear(ctx, w, h);
      var rows = 15;
      var bh = h / rows;
      var lean = p.inside ? (p.x - 0.5) * 2 : 0;
      for (var i = 0; i < rows; i++) {
        var seed = rnd(i + 3);
        var phase = t * (0.18 + seed * 0.5) + seed * 9;
        var off = Math.sin(phase) * w * 0.17 * (0.4 + seed) + lean * w * 0.1;
        var bw = w * (0.3 + seed * 0.48);
        ctx.fillStyle = i % 5 === 2 ? SIG : i % 3 === 0 ? INK : DIM;
        ctx.fillRect(off, i * bh + bh * 0.22, bw, bh * 0.56);
      }
      // 잘린 자리를 드러내는 세로 기준선 하나
      ctx.strokeStyle = INK;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, 0);
      ctx.lineTo(w * 0.5, h);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* 망점 — 지나가는 파동과 포인터가 점 크기를 키운다. */
    halftone: function (ctx, w, h, t, p) {
      clear(ctx, w, h);
      var step = Math.max(9, Math.min(w, h) / 20);
      var maxR = step * 0.44;
      for (var y = step * 0.5; y < h; y += step) {
        for (var x = step * 0.5; x < w; x += step) {
          var wave = Math.sin((x + y) * 0.03 - t * 1.1) * 0.5 + 0.5;
          var f = pull(p, x, y, w, h, Math.min(w, h) * 0.38);
          var r = maxR * (0.18 + wave * 0.55 + f * 0.9);
          if (r < 0.35) continue;
          ctx.fillStyle = f > 0.45 ? SIG : INK;
          ctx.globalAlpha = 0.25 + wave * 0.6;
          ctx.beginPath();
          ctx.arc(x, y, Math.min(r, maxR * 1.3), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    },

    /* 궤도 — 서로 다른 주기로 도는 헤어라인 호. */
    orbit: function (ctx, w, h, t, p) {
      clear(ctx, w, h);
      var cx = w * 0.5;
      var cy = h * 0.5;
      // 긴 변을 기준으로 잡아 세로로 긴 액자에서도 화면을 채운다
      var base = Math.max(w, h) * 0.44;
      var tilt = p.inside ? (p.y - 0.5) * 1.2 : 0;
      ctx.lineWidth = 1;
      for (var i = 0; i < 11; i++) {
        var r = base * (0.1 + i * 0.085);
        var spin = t * (0.5 - i * 0.04) + i * 1.3;
        var arc = 0.7 + rnd(i + 1) * 1.9;
        ctx.strokeStyle = (i === 4 || i === 8) ? SIG : i % 2 ? DIM : INK;
        ctx.globalAlpha = (i === 4 || i === 8) ? 1 : 0.8;
        ctx.lineWidth = i % 3 === 0 ? 1.4 : 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * (1 - Math.abs(tilt) * 0.5), tilt, spin, spin + arc);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = SIG;
      ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    },

    /* 적층 — 눌리고 펴지는 괘선 더미. */
    stack: function (ctx, w, h, t, p) {
      clear(ctx, w, h);
      var rows = 26;
      var squeeze = p.inside ? p.y : 0.5;
      ctx.lineWidth = 1;
      for (var i = 0; i < rows; i++) {
        var k = i / (rows - 1);
        var bias = 1 - Math.abs(k - squeeze) * 1.6;
        var amp = Math.sin(t * 0.8 + i * 0.42) * 0.5 + 0.5;
        var len = w * (0.14 + amp * 0.5 + Math.max(0, bias) * 0.32);
        var y = h * (0.08 + k * 0.84);
        ctx.strokeStyle = bias > 0.72 ? SIG : i % 4 === 0 ? INK : DIM;
        ctx.beginPath();
        ctx.moveTo(w * 0.08, y);
        ctx.lineTo(w * 0.08 + Math.min(len, w * 0.84), y);
        ctx.stroke();
      }
    },

    /* 결절 — 흔들리는 격자 위 점들을 선 굵기만으로 잇는다. */
    mesh: function (ctx, w, h, t, p) {
      clear(ctx, w, h);
      var cols = 7;
      var rows = 7;
      var pts = [];
      for (var j = 0; j < rows; j++) {
        for (var i = 0; i < cols; i++) {
          var id = j * cols + i;
          var gx = w * (0.12 + (i / (cols - 1)) * 0.76);
          var gy = h * (0.12 + (j / (rows - 1)) * 0.76);
          var sway = Math.min(w, h) * 0.055;
          var f = pull(p, gx, gy, w, h, Math.min(w, h) * 0.42);
          pts.push({
            x: gx + Math.sin(t * 0.6 + id * 1.7) * sway + (p.inside ? (p.x * w - gx) * f * 0.3 : 0),
            y: gy + Math.cos(t * 0.5 + id * 2.3) * sway + (p.inside ? (p.y * h - gy) * f * 0.3 : 0),
            f: f,
          });
        }
      }
      var near = Math.min(w, h) * 0.26;
      for (var a = 0; a < pts.length; a++) {
        for (var b = a + 1; b < pts.length; b++) {
          var dx = pts[a].x - pts[b].x;
          var dy = pts[a].y - pts[b].y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d > near) continue;
          var closeness = 1 - d / near;
          ctx.strokeStyle = pts[a].f > 0.5 || pts[b].f > 0.5 ? SIG : DIM;
          ctx.lineWidth = 0.4 + closeness * 1.1;
          ctx.globalAlpha = 0.25 + closeness * 0.6;
          ctx.beginPath();
          ctx.moveTo(pts[a].x, pts[a].y);
          ctx.lineTo(pts[b].x, pts[b].y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = INK;
      for (var c = 0; c < pts.length; c++) {
        ctx.fillRect(pts[c].x - 1, pts[c].y - 1, 2, 2);
      }
    },
  };

  /* ── 러너 ──────────────────────────────────────────────────────────
   * 화면에 보이는 캔버스만 하나의 rAF 루프로 돌린다.
   * 탭이 가려지거나 카드가 화면 밖으로 나가면 그리지 않는다.
   */
  var mounted = [];
  var running = false;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize(entry) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = entry.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    entry.w = rect.width;
    entry.h = rect.height;
    entry.canvas.width = Math.round(rect.width * dpr);
    entry.canvas.height = Math.round(rect.height * dpr);
    entry.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  function frame(now) {
    var live = 0;
    for (var i = 0; i < mounted.length; i++) {
      var e = mounted[i];
      if (!e.visible) continue;
      live++;
      if (e.dirty) {
        if (!resize(e)) continue;
        e.dirty = false;
      }
      if (e.t0 === 0) e.t0 = now;
      var t = (now - e.t0) / 1000;
      if (reduce) t = 0;             // 모션 최소화 설정이면 한 장면에 고정
      e.sketch(e.ctx, e.w, e.h, t, e.pointer);
      if (reduce) e.visible = false; // 한 번만 그리고 멈춘다
    }
    if (live > 0 && !document.hidden) {
      requestAnimationFrame(frame);
    } else {
      running = false;
    }
  }

  function kick() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  var io = null;
  function observer() {
    if (io || !('IntersectionObserver' in window)) return io;
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (ent) {
        var e = mounted.filter(function (m) { return m.canvas === ent.target; })[0];
        if (!e) return;
        e.visible = ent.isIntersecting;
        if (e.visible) { e.dirty = true; kick(); }
      });
    }, { rootMargin: '120px' });
    return io;
  }

  /* 캔버스 하나에 스케치를 붙인다. key 가 없으면 아무것도 하지 않는다. */
  function mount(canvas, key) {
    var sketch = PREVIEWS[key];
    if (!canvas || !sketch) return null;
    var entry = {
      canvas: canvas,
      ctx: canvas.getContext('2d'),
      sketch: sketch,
      w: 0, h: 0, t0: 0,
      visible: false, dirty: true,
      pointer: { x: 0.5, y: 0.5, inside: false },
    };
    mounted.push(entry);
    var obs = observer();
    if (obs) { obs.observe(canvas); } else { entry.visible = true; kick(); }
    return entry;
  }

  /* 카드 바깥(부모 요소)의 포인터를 스케치에 흘려보낸다. */
  function track(entry, host) {
    if (!entry) return;
    host.addEventListener('pointermove', function (ev) {
      var r = entry.canvas.getBoundingClientRect();
      if (!r.width) return;
      entry.pointer.x = (ev.clientX - r.left) / r.width;
      entry.pointer.y = (ev.clientY - r.top) / r.height;
      entry.pointer.inside = true;
      kick();
    });
    host.addEventListener('pointerleave', function () {
      entry.pointer.inside = false;
    });
  }

  window.addEventListener('resize', function () {
    mounted.forEach(function (e) { e.dirty = true; });
    kick();
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { mounted.forEach(function (e) { e.dirty = true; }); kick(); }
  });

  window.PREVIEWS = PREVIEWS;
  window.PreviewRunner = { mount: mount, track: track, kick: kick, keys: Object.keys(PREVIEWS) };
})();
