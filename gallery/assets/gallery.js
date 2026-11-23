/* gallery.js — 목록 렌더링, 뷰 전환, 필터, 커서, 등장 처리.
 * works.js 와 previews.js 가 먼저 로드되어 있어야 한다.
 */
(function () {
  'use strict';

  var WORKS = window.WORKS || [];
  var Runner = window.PreviewRunner;
  var STORE_KEY = 'gallery:view';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  /* localStorage 는 사생활 보호 모드·차단 설정에서 던질 수 있다. 전부 감싼다. */
  function readStore(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeStore(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* 무시 */ }
  }

  /* ── 카드(그리드 뷰) ────────────────────────────────────────────── */
  function buildCard(work, i) {
    var live = work.status === 'live';
    var el = document.createElement(live ? 'a' : 'div');
    el.className = 'card reveal' + (live ? '' : ' card--wip');
    el.style.setProperty('--span', work.span || 4);
    el.style.setProperty('--drop', work.drop || 0);
    el.style.setProperty('--ratio', (work.ratio || '4/5').replace('/', ' / '));
    el.style.setProperty('--delay', (i % 3) * 90 + 'ms');
    el.dataset.tags = (work.tags || []).join(' ');
    el.dataset.no = work.no;
    if (live) {
      el.href = 'works/' + work.slug + '/';
      el.setAttribute('aria-label', work.title + ' — 작품 열기');
      el.dataset.cursor = '보기';
    } else {
      el.setAttribute('aria-disabled', 'true');
    }

    var frame = document.createElement('div');
    frame.className = 'card__frame';

    var canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', work.title + ' 미리보기');
    frame.appendChild(canvas);

    for (var c = 0; c < 4; c++) {
      var corner = document.createElement('span');
      corner.className = 'card__corner';
      corner.dataset.c = String(c);
      frame.appendChild(corner);
    }

    if (live) {
      var cta = document.createElement('span');
      cta.className = 'card__cta';
      cta.innerHTML = '<span>열기</span><span>&#8599;</span>';
      frame.appendChild(cta);
    } else {
      var wip = document.createElement('span');
      wip.className = 'card__wip';
      wip.textContent = '준비 중';
      frame.appendChild(wip);
    }

    var meta = document.createElement('div');
    meta.className = 'card__meta';
    meta.innerHTML =
      '<span class="card__no">' + work.no + '</span>' +
      '<span class="card__name">' +
        '<span class="card__ko">' + work.title + '</span>' +
      '</span>' +
      '<span class="card__year">' + work.year + '</span>' +
      '<span class="card__tags">' + (work.tags || []).join(' · ') + '</span>';

    el.appendChild(frame);
    el.appendChild(meta);

    var entry = Runner.mount(canvas, work.preview);
    if (entry && fine) Runner.track(entry, el);

    return el;
  }

  /* ── 행(인덱스 뷰) ──────────────────────────────────────────────── */
  function buildRow(work, i) {
    var live = work.status === 'live';
    var el = document.createElement(live ? 'a' : 'div');
    el.className = 'row reveal' + (live ? '' : ' row--wip');
    el.style.setProperty('--delay', Math.min(i, 6) * 55 + 'ms');
    el.dataset.tags = (work.tags || []).join(' ');
    el.dataset.preview = work.preview || '';
    el.dataset.caption = work.no;
    if (live) {
      el.href = 'works/' + work.slug + '/';
      el.dataset.cursor = '보기';
    } else {
      el.setAttribute('aria-disabled', 'true');
    }

    el.innerHTML =
      '<span class="row__no">' + work.no + '</span>' +
      '<span class="row__name">' +
        '<span class="row__ko">' + work.title + '</span>' +
      '</span>' +
      '<span class="row__tags">' + (work.tags || []).join(' · ') + '</span>' +
      '<span class="row__year">' + work.year + '</span>' +
      '<span class="row__go">' + (live ? '&#8599;' : '&#8212;') + '</span>';

    return el;
  }

  /* ── 필터 ───────────────────────────────────────────────────────── */
  function buildFilters(host, onPick) {
    var counts = { all: WORKS.length };
    WORKS.forEach(function (w) {
      (w.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
    });

    var tags = Object.keys(counts).filter(function (t) { return t !== 'all'; }).sort();
    tags.unshift('all');

    tags.forEach(function (tag) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.tag = tag;
      b.setAttribute('aria-pressed', tag === 'all' ? 'true' : 'false');
      b.innerHTML = (tag === 'all' ? '전체' : tag) + '<sup>' + counts[tag] + '</sup>';
      b.addEventListener('click', function () {
        host.querySelectorAll('button').forEach(function (other) {
          other.setAttribute('aria-pressed', other === b ? 'true' : 'false');
        });
        onPick(tag);
      });
      host.appendChild(b);
    });
  }

  function applyFilter(tag) {
    document.querySelectorAll('.card, .row').forEach(function (el) {
      var hit = tag === 'all' || (' ' + el.dataset.tags + ' ').indexOf(' ' + tag + ' ') > -1;
      el.hidden = !hit;
    });
    Runner.kick();
  }

  /* ── 뷰 전환 ────────────────────────────────────────────────────── */
  function setView(view) {
    var gallery = $('#gallery');
    gallery.dataset.view = view;
    document.querySelectorAll('.views button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.view === view));
    });
    writeStore(STORE_KEY, view);
    Runner.kick();
  }

  /* ── 커서를 따라다니는 인덱스 미리보기 ──────────────────────────── */
  function initPeek() {
    if (!fine || reduce) return null;

    var peek = document.createElement('div');
    peek.className = 'peek';
    peek.setAttribute('aria-hidden', 'true');
    var canvas = document.createElement('canvas');
    var cap = document.createElement('span');
    cap.className = 'peek__cap';
    peek.appendChild(canvas);
    peek.appendChild(cap);
    document.body.appendChild(peek);

    // 한 번만 마운트해 두고, 행이 바뀔 때 스케치 함수만 갈아끼운다.
    var seed = (WORKS[0] && WORKS[0].preview) || Runner.keys[0];
    var entry = Runner.mount(canvas, seed);

    var state = { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2, on: false };

    document.addEventListener('pointermove', function (ev) {
      state.tx = ev.clientX;
      state.ty = ev.clientY;
    }, { passive: true });

    function show(row) {
      var key = row.dataset.preview;
      if (!entry || !window.PREVIEWS[key]) return;
      entry.sketch = window.PREVIEWS[key];
      entry.dirty = true;
      entry.visible = true;
      cap.textContent = row.dataset.caption;
      state.on = true;
      peek.classList.add('is-on');
      Runner.kick();
    }
    function hide() {
      state.on = false;
      peek.classList.remove('is-on');
      if (entry) entry.visible = false;
    }

    function follow() {
      state.x += (state.tx - state.x) * 0.14;
      state.y += (state.ty - state.y) * 0.14;
      peek.style.transform =
        'translate3d(' + Math.round(state.x) + 'px,' + Math.round(state.y) + 'px,0)' +
        ' translate(-50%,-50%) scale(' + (state.on ? 1 : 0.94) + ')';
      requestAnimationFrame(follow);
    }
    requestAnimationFrame(follow);

    return { show: show, hide: hide };
  }

  /* ── 커스텀 커서 ────────────────────────────────────────────────── */
  function initCursor() {
    if (!fine || reduce) return;

    var dot = document.createElement('div');
    dot.className = 'cursor';
    dot.setAttribute('aria-hidden', 'true');
    dot.innerHTML = '<span class="cursor__txt"></span>';
    document.body.appendChild(dot);
    document.body.classList.add('has-cursor');

    var txt = $('.cursor__txt', dot);
    var s = { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2 };

    document.addEventListener('pointermove', function (ev) {
      s.tx = ev.clientX;
      s.ty = ev.clientY;
      dot.classList.add('is-on');
    }, { passive: true });

    document.addEventListener('pointerleave', function () { dot.classList.remove('is-on'); });

    document.addEventListener('pointerover', function (ev) {
      var host = ev.target.closest ? ev.target.closest('[data-cursor]') : null;
      if (host) {
        txt.textContent = host.dataset.cursor;
        dot.classList.add('is-hot');
      } else {
        dot.classList.remove('is-hot');
      }
    });

    (function follow() {
      s.x += (s.tx - s.x) * 0.2;
      s.y += (s.ty - s.y) * 0.2;
      dot.style.transform = 'translate3d(' + s.x + 'px,' + s.y + 'px,0) translate(-50%,-50%)';
      requestAnimationFrame(follow);
    })();
  }

  /* ── 등장 ───────────────────────────────────────────────────────── */
  function initReveal() {
    var targets = document.querySelectorAll('.reveal');
    if (reduce || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (ent) {
        if (!ent.isIntersecting) return;
        ent.target.classList.add('is-in');
        io.unobserve(ent.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* ── 시작 ───────────────────────────────────────────────────────── */
  function init() {
    var gridHost = $('#grid-view');
    var indexHost = $('#index-view');
    if (!gridHost || !indexHost) return;

    WORKS.forEach(function (w, i) {
      gridHost.appendChild(buildCard(w, i));
      indexHost.appendChild(buildRow(w, i));
    });

    var liveCount = WORKS.filter(function (w) { return w.status === 'live'; }).length;
    var counter = $('#count');
    if (counter) {
      counter.textContent =
        String(WORKS.length).padStart(2, '0') + ' · 공개 ' +
        String(liveCount).padStart(2, '0');
    }

    buildFilters($('#filters'), applyFilter);

    document.querySelectorAll('.views button').forEach(function (b) {
      b.addEventListener('click', function () { setView(b.dataset.view); });
    });
    var saved = readStore(STORE_KEY);
    setView(saved === 'index' ? 'index' : 'grid');

    var peek = initPeek();
    if (peek) {
      indexHost.addEventListener('pointerover', function (ev) {
        var row = ev.target.closest('.row');
        if (row && !row.hidden) peek.show(row);
      });
      indexHost.addEventListener('pointerleave', peek.hide);
    }

    initCursor();
    initReveal();

    // g / i 로 뷰를 바꾼다. 입력 중에는 가로채지 않는다.
    document.addEventListener('keydown', function (ev) {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      var t = ev.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (ev.key === 'g' || ev.key === 'G') setView('grid');
      if (ev.key === 'i' || ev.key === 'I') setView('index');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
