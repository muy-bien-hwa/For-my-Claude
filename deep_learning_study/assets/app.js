/* 30일 딥러닝 완전 정복 — SPA 라우터, 진도/책갈피, 퀴즈, 실행 가능한 코드 */
(function () {
  'use strict';
  const C = window.CURRICULUM;
  const REPO = 'muy-bien-hwa/For-my-Claude';
  const NB_BASE = `https://colab.research.google.com/github/${REPO}/blob/main/deep_learning_study/notebooks/`;
  const KEY = 'dl30.progress.v1';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const main = $('#main');

  /* ---------- 저장소 ---------- */
  const blank = () => ({ done: {}, bookmark: null, headings: {}, notes: {}, quiz: {}, visits: {}, scroll: {}, started: null });
  let S = load();
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return Object.assign(blank(), JSON.parse(raw)); } catch (e) {}
    return blank();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  const today = () => new Date().toISOString().slice(0, 10);
  function markVisit() { if (!S.started) S.started = today(); S.visits[today()] = (S.visits[today()] || 0) + 1; save(); }

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }
  const pad = n => String(n).padStart(2, '0');
  const dayMeta = n => C.days.find(d => d.day === n);
  const doneCount = () => Object.keys(S.done).length;

  /* ---------- 공통 UI ---------- */
  function renderSidebar(activeDay) {
    const sb = $('#sidebar');
    let h = `<a class="side-day ${activeDay === 0 ? 'active' : ''}" href="#/"><span class="num">⌂</span>대시보드</a>`;
    h += `<div class="mobile-links" style="display:none;padding:6px 8px"><a href="#/playground">실험실</a> · <a href="#/glossary">용어 사전</a> · <a href="#/me">내 기록</a></div>`;
    for (const w of C.weeks) {
      h += `<div class="side-week"><h4>${w.title}</h4>`;
      for (const d of C.days.filter(x => x.week === w.id)) {
        const cls = [S.done[d.day] ? 'done' : '', activeDay === d.day ? 'active' : '', S.bookmark && S.bookmark.day === d.day ? 'bm' : ''].join(' ');
        h += `<a class="side-day ${cls}" href="#/day/${d.day}"><span class="num">${S.done[d.day] ? '✓' : d.day}</span><span>${d.title}</span>${S.bookmark && S.bookmark.day === d.day ? '<span class="bm-dot">🔖</span>' : ''}</a>`;
      }
      h += `</div>`;
    }
    sb.innerHTML = h;
    const pct = Math.round(doneCount() / C.days.length * 100);
    $('#topFill').style.width = pct + '%';
    $('#topPct').textContent = pct + '%';
    $$('.top-links a').forEach(a => a.classList.toggle('active', location.hash.startsWith(a.getAttribute('href'))));
  }
  function closeMenu() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); }
  $('#menuBtn').onclick = () => { $('#sidebar').classList.toggle('open'); $('#scrim').classList.toggle('show'); };
  $('#scrim').onclick = closeMenu;
  $('#themeBtn').onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const nx = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nx;
    try { localStorage.setItem('dl30.theme', nx); } catch (e) {}
    window.dispatchEvent(new Event('themechange'));
  };

  /* ---------- 라우터 ---------- */
  let scrollSaver = null;
  async function route() {
    closeMenu();
    if (scrollSaver) { window.removeEventListener('scroll', scrollSaver); scrollSaver = null; }
    window.VIZ && window.VIZ.stopAll && window.VIZ.stopAll();
    const h = location.hash.replace(/^#/, '') || '/';
    const m = h.match(/^\/day\/(\d+)(?:\/(.+))?$/);
    if (m) return renderDay(+m[1], m[2] ? decodeURIComponent(m[2]) : null);
    if (h.startsWith('/glossary')) return renderGlossary();
    if (h.startsWith('/playground')) return renderPlayground();
    if (h.startsWith('/me')) return renderMe();
    return renderHome();
  }
  window.addEventListener('hashchange', route);

  /* ---------- 대시보드 ---------- */
  function nextDay() {
    if (S.bookmark) return S.bookmark.day;
    const nd = C.days.find(d => !S.done[d.day]);
    return nd ? nd.day : 30;
  }
  function streak() {
    let n = 0; const d = new Date();
    for (;;) { const k = d.toISOString().slice(0, 10); if (S.visits[k]) { n++; d.setDate(d.getDate() - 1); } else break; }
    return n;
  }
  function renderHome() {
    renderSidebar(0);
    document.title = C.title;
    const nd = dayMeta(nextDay());
    const bm = S.bookmark;
    const totalMin = C.days.reduce((a, d) => a + d.time, 0);
    const doneMin = C.days.filter(d => S.done[d.day]).reduce((a, d) => a + d.time, 0);
    const quizzes = Object.values(S.quiz);
    const qAvg = quizzes.length ? Math.round(quizzes.reduce((a, q) => a + q.score / q.total, 0) / quizzes.length * 100) : null;
    let h = `<div class="wide">
      <div class="hero">
        <div class="eyebrow">DEEP LEARNING · 30 DAYS</div>
        <h1>바닥부터 Transformer까지, 직접 만들며 이해하는 딥러닝</h1>
        <p class="lead" style="margin-bottom:18px">하루 1~3시간, 30일. 수학의 언어로 시작해서 NumPy로 신경망을 직접 짜 보고, PyTorch로 CNN·RNN·Transformer·생성 모델까지 만들어 봅니다. 마지막 이틀은 혼자 힘으로 모델 하나를 완성하는 캡스톤입니다.</p>
        <div class="day-actions">
          <a class="btn primary" href="#/day/${nd.day}${bm && bm.heading ? '/' + encodeURIComponent(bm.heading) : ''}">${bm ? '🔖 책갈피에서 이어서' : (doneCount() ? '▶ 이어서 공부하기' : '▶ Day 1 시작하기')} — Day ${nd.day}. ${nd.title}</a>
          <a class="btn" href="#/playground">🧪 실험실 둘러보기</a>
        </div>
        ${bm ? `<p style="font-size:14px;color:var(--muted);margin:10px 0 0">책갈피: Day ${bm.day}${bm.headingText ? ' · ' + esc(bm.headingText) : ''} (${bm.ts ? bm.ts.slice(0, 10) : ''})</p>` : ''}
      </div>
      <div class="grid cols-3" style="grid-template-columns:repeat(4,1fr)">
        <div class="card stat"><div class="n">${doneCount()}<span style="font-size:16px;color:var(--muted)"> / 30</span></div><div class="l">완료한 날</div><div class="bar" style="margin-top:8px"><div class="fill" style="width:${doneCount() / 30 * 100}%"></div></div></div>
        <div class="card stat"><div class="n">${Math.round(doneMin / 60)}<span style="font-size:16px;color:var(--muted)"> / ${Math.round(totalMin / 60)}h</span></div><div class="l">공부한 분량(예상 시간 기준)</div></div>
        <div class="card stat"><div class="n">${streak()}일</div><div class="l">연속 접속</div></div>
        <div class="card stat"><div class="n">${qAvg === null ? '–' : qAvg + '%'}</div><div class="l">퀴즈 평균 정답률</div></div>
      </div>
      <div class="card" style="margin-top:14px"><b style="font-size:14px">30일 진도 지도</b><div class="heat">${C.days.map(d => `<span class="${S.done[d.day] ? 'on' : (bm && bm.day === d.day ? 'bm' : '')}" title="Day ${d.day}. ${d.title}"></span>`).join('')}</div></div>
      <div class="callout prof" style="margin-top:20px"><span class="ct">👨‍🏫 강의를 시작하며</span>
      이 강의의 목표는 단 하나입니다. <b>30일 뒤, 아무것도 없는 빈 노트북에서 여러분 스스로 딥러닝 모델을 설계하고 학습시키는 것.</b> 그래서 우리는 "어떻게 쓰는가"보다 "왜 그렇게 동작하는가"를 먼저 묻습니다. 수식이 나오면 겁내지 말고 손으로 따라 써 보세요. 코드가 나오면 반드시 실행하고, 숫자를 바꿔 보세요. 각 페이지의 소제목 옆 🔖을 누르면 그 위치가 책갈피로 저장됩니다.</div>`;
    for (const w of C.weeks) {
      h += `<div class="week-block"><h3>${w.title}</h3><div class="wd">${w.desc}</div><div class="day-cards">`;
      for (const d of C.days.filter(x => x.week === w.id)) {
        const q = S.quiz[d.day];
        h += `<a class="card day-card ${S.done[d.day] ? 'done' : ''}" href="#/day/${d.day}">
          <span class="st">${S.done[d.day] ? '✅' : (bm && bm.day === d.day ? '🔖' : '')}</span>
          <div class="dn">DAY ${pad(d.day)} · ${d.time}분</div><div class="dt">${d.title}</div>
          <div class="chips" style="margin:0">${d.tags.map(t => `<span class="chip">${t}</span>`).join('')}${d.runnable ? '<span class="chip accent">브라우저 실행</span>' : ''}${d.notebook ? '<span class="chip accent">Colab</span>' : ''}${d.viz ? '<span class="chip accent">시각화</span>' : ''}${q ? `<span class="chip">퀴즈 ${q.score}/${q.total}</span>` : ''}</div></a>`;
      }
      h += `</div></div>`;
    }
    h += `</div>`;
    main.innerHTML = h;
    window.scrollTo(0, 0);
  }

  /* ---------- Day 페이지 ---------- */
  const cache = {};
  async function renderDay(n, anchor) {
    const d = dayMeta(n);
    if (!d) return renderHome();
    renderSidebar(n);
    document.title = `Day ${n}. ${d.title} — ${C.title}`;
    main.innerHTML = `<div class="page"><p style="color:var(--muted)">강의 자료를 불러오는 중…</p></div>`;
    let html = cache[n];
    if (!html) {
      try {
        const r = await fetch(`content/day${pad(n)}.html`, { cache: 'no-cache' });
        if (!r.ok) throw new Error(r.status);
        html = cache[n] = await r.text();
      } catch (e) {
        main.innerHTML = `<div class="page"><h1>불러오기 실패</h1><p>Day ${n} 자료를 불러오지 못했습니다. (${e.message})</p></div>`;
        return;
      }
    }
    markVisit();
    const week = C.weeks.find(w => w.id === d.week);
    const prev = dayMeta(n - 1), next = dayMeta(n + 1);
    main.innerHTML = `<article class="page" id="article">
      <div class="day-hero">
        <div class="eyebrow">${week.title} · DAY ${pad(n)}</div>
        <h1>${d.title}</h1>
        <div class="day-meta"><span>⏱ 예상 ${d.time}분</span>${S.done[n] ? `<span style="color:var(--good)">✅ ${S.done[n].slice(0, 10)} 완료</span>` : ''}</div>
        <div class="chips">${d.tags.map(t => `<span class="chip">${t}</span>`).join('')}</div>
        <div class="day-actions">
          ${d.notebook ? `<a class="btn primary" target="_blank" rel="noopener" href="${NB_BASE}${d.notebook}">📓 Colab에서 실습 노트북 열기</a>` : ''}
          <button class="btn" id="bmTop">🔖 이 날을 책갈피</button>
        </div>
      </div>
      <div id="body">${html}</div>
      <div class="day-footer">
        <div class="card">
          <h3 style="margin-top:0">📝 나의 학습 노트</h3>
          <p style="margin-top:0;color:var(--muted);font-size:14px">오늘 배운 것을 내 말로 3줄 요약해 보세요. 설명할 수 있어야 아는 것입니다. (자동 저장)</p>
          <textarea class="notes" id="notes" placeholder="예) 역전파는 연쇄법칙을 계산 그래프 위에서 뒤에서부터 적용하는 것이다…">${esc(S.notes[n] || '')}</textarea>
        </div>
        <div class="card" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between">
          <div><b>${S.done[n] ? '완료한 강의입니다 👏' : '오늘의 강의를 모두 마쳤나요?'}</b><div style="font-size:14px;color:var(--muted)">완료 표시를 하면 대시보드 진도에 반영되고 책갈피가 다음 날로 넘어갑니다.</div></div>
          <button class="btn ${S.done[n] ? '' : 'good'}" id="doneBtn">${S.done[n] ? '완료 취소' : '✅ 완료로 표시'}</button>
        </div>
        <div class="pager">
          ${prev ? `<a class="card" href="#/day/${prev.day}"><small>← 이전</small>Day ${prev.day}. ${prev.title}</a>` : '<span></span>'}
          ${next ? `<a class="card" href="#/day/${next.day}" style="text-align:right"><small>다음 →</small>Day ${next.day}. ${next.title}</a>` : '<span></span>'}
        </div>
      </div>
    </article><nav class="toc" id="toc"></nav>`;

    const body = $('#body');
    enhance(body, n);

    // 책갈피 버튼(상단)
    $('#bmTop').onclick = () => setBookmark(n, null, null);
    // 노트
    let nt;
    $('#notes').addEventListener('input', e => { clearTimeout(nt); nt = setTimeout(() => { S.notes[n] = e.target.value; save(); }, 400); });
    // 완료
    $('#doneBtn').onclick = () => {
      if (S.done[n]) { delete S.done[n]; toast('완료를 취소했습니다'); }
      else {
        S.done[n] = new Date().toISOString();
        if (next) S.bookmark = { day: next.day, heading: null, headingText: null, ts: new Date().toISOString() };
        else S.bookmark = null;
        toast(next ? `Day ${n} 완료! 책갈피를 Day ${next.day}로 옮겼어요` : '🎉 30일 과정을 모두 마쳤습니다!');
      }
      save(); renderDay(n);
    };

    // 위치 복원
    requestAnimationFrame(() => {
      if (anchor) { const el = document.getElementById(anchor); if (el) { el.scrollIntoView(); return; } }
      if (S.scroll[n] && !anchor) window.scrollTo(0, S.scroll[n]); else window.scrollTo(0, 0);
    });
    let st;
    scrollSaver = () => { clearTimeout(st); st = setTimeout(() => { S.scroll[n] = Math.round(window.scrollY); save(); updateToc(); }, 150); };
    window.addEventListener('scroll', scrollSaver, { passive: true });
  }

  function setBookmark(day, id, text) {
    S.bookmark = { day, heading: id, headingText: text, ts: new Date().toISOString() };
    save(); renderSidebar(day);
    $$('.h-bm').forEach(b => b.classList.toggle('on', b.dataset.id === id));
    toast(`🔖 책갈피 저장: Day ${day}${text ? ' · ' + text : ''}`);
  }

  function slug(s, i) { return 's' + i + '-' + s.replace(/[^\w가-힣]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); }

  function enhance(body, n) {
    // 학습 목표 박스
    const goals = $('ul.goals', body);
    if (goals) {
      const box = document.createElement('div');
      box.className = 'card objectives';
      box.innerHTML = '<h3>🎯 오늘의 학습 목표</h3>';
      goals.replaceWith(box); box.appendChild(goals);
    }
    // 헤딩 책갈피 + TOC
    const toc = $('#toc');
    let tocH = '<b style="display:block;margin:0 0 6px 10px;color:var(--text)">목차</b>';
    $$('h2', body).forEach((h, i) => {
      const id = h.id || slug(h.textContent, i);
      h.id = id;
      const b = document.createElement('button');
      b.className = 'h-bm' + (S.bookmark && S.bookmark.day === n && S.bookmark.heading === id ? ' on' : '');
      b.dataset.id = id; b.title = '여기에 책갈피'; b.textContent = '🔖';
      b.onclick = () => setBookmark(n, id, h.textContent.replace('🔖', '').trim());
      h.prepend(b);
      tocH += `<a href="#/day/${n}/${encodeURIComponent(id)}" data-id="${id}">${esc(h.textContent.replace('🔖', '').trim())}</a>`;
    });
    toc.innerHTML = tocH;
    $$('a', toc).forEach(a => a.onclick = e => { e.preventDefault(); document.getElementById(a.dataset.id).scrollIntoView({ behavior: 'smooth' }); });

    // 코드 하이라이트
    $$('pre:not(.run) code', body).forEach(c => { if (!c.className) c.className = 'language-python'; window.hljs && hljs.highlightElement(c); });
    // 실행 가능한 코드
    $$('pre.run', body).forEach(mountRunnable);
    // 퀴즈
    $$('script.quiz', body).forEach(s => mountQuiz(s, n));
    // 시각화
    $$('.viz-mount', body).forEach(el => window.VIZ && window.VIZ.mount(el));
    // 수식
    if (window.renderMathInElement) {
      renderMathInElement(body, {
        delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\[', right: '\\]', display: true }, { left: '$', right: '$', display: false }, { left: '\\(', right: '\\)', display: false }],
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'], throwOnError: false
      });
    }
    updateToc();
  }
  function updateToc() {
    const toc = $('#toc'); if (!toc) return;
    let cur = null;
    $$('#body h2').forEach(h => { if (h.getBoundingClientRect().top < 140) cur = h.id; });
    $$('a', toc).forEach(a => a.classList.toggle('cur', a.dataset.id === cur));
  }

  /* ---------- 퀴즈 ---------- */
  function mountQuiz(script, n) {
    let qs;
    try { qs = JSON.parse(script.textContent); } catch (e) { console.error('quiz parse', e); return; }
    const wrap = document.createElement('div');
    wrap.className = 'quiz';
    let answered = 0, right = 0;
    const score = document.createElement('div'); score.className = 'quiz-score';
    qs.forEach((q, qi) => {
      const box = document.createElement('div');
      box.className = 'card q';
      box.innerHTML = `<div class="qt">Q${qi + 1}. ${q.q}</div><div class="opts"></div><div class="exp">💡 ${q.e || ''}</div>`;
      const opts = $('.opts', box);
      q.o.forEach((o, oi) => {
        const b = document.createElement('button');
        b.className = 'opt'; b.innerHTML = `${String.fromCharCode(65 + oi)}. ${o}`;
        b.onclick = () => {
          $$('.opt', box).forEach((x, xi) => { x.disabled = true; if (xi === q.a) x.classList.add('right'); });
          if (oi !== q.a) b.classList.add('wrong'); else right++;
          box.classList.add('answered'); answered++;
          if (window.renderMathInElement) renderMathInElement($('.exp', box), { delimiters: [{ left: '$', right: '$', display: false }], throwOnError: false });
          if (answered === qs.length) {
            S.quiz[n] = { score: right, total: qs.length, ts: new Date().toISOString() }; save();
            score.innerHTML = `결과: ${right} / ${qs.length} ${right === qs.length ? '— 완벽합니다! 🎉' : right >= qs.length * .6 ? '— 좋아요. 틀린 문항의 해설을 다시 읽어 보세요.' : '— 본문을 한 번 더 복습하고 다시 풀어 봅시다.'} <button class="btn sm" style="margin-left:8px">다시 풀기</button>`;
            $('button', score).onclick = () => { const s2 = script.cloneNode(true); wrap.replaceWith(s2); mountQuiz(s2, n); };
          }
        };
        opts.appendChild(b);
      });
      wrap.appendChild(box);
    });
    if (S.quiz[n]) score.innerHTML = `<span style="color:var(--muted);font-weight:500">지난 기록: ${S.quiz[n].score} / ${S.quiz[n].total}</span>`;
    wrap.appendChild(score);
    script.replaceWith(wrap);
  }

  /* ---------- Pyodide 실행기 ---------- */
  let pyReady = null;
  function loadPy(status) {
    if (pyReady) return pyReady;
    pyReady = new Promise((res, rej) => {
      status('파이썬 런타임(Pyodide) 다운로드 중… 첫 실행은 10~20초 정도 걸립니다');
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
      s.onload = async () => {
        try {
          const py = await loadPyodide();
          status('NumPy · Matplotlib 설치 중…');
          await py.loadPackage(['numpy', 'matplotlib']);
          // 그래프 한글 표시용 폰트 (실패해도 계속 진행)
          try {
            status('한글 폰트 설치 중…');
            const fr = await fetch('https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf');
            if (fr.ok) py.FS.writeFile('/tmp/NanumGothic.ttf', new Uint8Array(await fr.arrayBuffer()));
          } catch (e) { console.warn('font', e); }
          await py.runPythonAsync(`
import os
import matplotlib
from matplotlib import font_manager
if os.path.exists('/tmp/NanumGothic.ttf'):
    font_manager.fontManager.addfont('/tmp/NanumGothic.ttf')
    matplotlib.rcParams['font.family'] = font_manager.FontProperties(fname='/tmp/NanumGothic.ttf').get_name()
matplotlib.rcParams['axes.unicode_minus'] = False
`);
          await py.runPythonAsync(`
import sys, io, base64
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
def _dl30_figs():
    out = []
    for num in plt.get_fignums():
        f = plt.figure(num)
        b = io.BytesIO(); f.savefig(b, format='png', dpi=96, bbox_inches='tight')
        out.append(base64.b64encode(b.getvalue()).decode())
    plt.close('all')
    return out
`);
          res(py);
        } catch (e) { pyReady = null; rej(e); }
      };
      s.onerror = () => { pyReady = null; rej(new Error('Pyodide 스크립트를 불러오지 못했습니다(네트워크 확인)')); };
      document.head.appendChild(s);
    });
    return pyReady;
  }
  function mountRunnable(pre) {
    const code = pre.textContent.replace(/^\n/, '').replace(/\s+$/, '');
    const w = document.createElement('div');
    w.className = 'runnable-wrap';
    w.innerHTML = `<div class="rbar"><span class="lbl">🐍 Python · 브라우저에서 실행 (수정해 보세요)</span><button class="rbtn ghost" data-a="reset">원래대로</button><button class="rbtn" data-a="run">▶ 실행</button></div><textarea spellcheck="false"></textarea><div class="out"></div>`;
    const ta = $('textarea', w), out = $('.out', w);
    ta.value = code;
    const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 4, 640) + 'px'; };
    requestAnimationFrame(fit);
    ta.addEventListener('input', fit);
    ta.addEventListener('keydown', e => {
      if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('    ', s, ta.selectionEnd, 'end'); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
    });
    $('[data-a=reset]', w).onclick = () => { ta.value = code; fit(); };
    $('[data-a=run]', w).onclick = run;
    async function run() {
      out.style.display = 'block'; out.classList.remove('err');
      const status = m => { out.textContent = '⏳ ' + m; };
      let py;
      try { py = await loadPy(status); } catch (e) { out.classList.add('err'); out.textContent = '런타임 로드 실패: ' + e.message; return; }
      status('실행 중…');
      let buf = '';
      py.setStdout({ batched: s => { buf += s + '\n'; } });
      py.setStderr({ batched: s => { buf += s + '\n'; } });
      try {
        await py.runPythonAsync(ta.value);
        const figs = py.runPython('_dl30_figs()').toJs();
        out.textContent = buf || (figs.length ? '' : '(출력 없음)');
        figs.forEach(b64 => { const img = document.createElement('img'); img.src = 'data:image/png;base64,' + b64; out.appendChild(img); });
      } catch (e) {
        out.classList.add('err');
        out.textContent = buf + String(e.message || e).split('\n').filter(l => !l.includes('/lib/python') && !l.includes('pyodide')).slice(-8).join('\n');
      }
    }
    pre.replaceWith(w);
  }

  /* ---------- 실험실 ---------- */
  function renderPlayground() {
    renderSidebar(-1);
    document.title = '실험실 — ' + C.title;
    const list = window.VIZ ? window.VIZ.list : [];
    main.innerHTML = `<div class="page"><div class="eyebrow">PLAYGROUND</div><h1>🧪 실험실</h1>
      <p class="lead">강의에 나오는 인터랙티브 시각화를 한곳에 모았습니다. 슬라이더를 움직이며 직관을 만들어 보세요.</p>
      ${list.map(v => `<p style="margin:28px 0 0;font-size:13px;color:var(--muted)">관련 강의: <a href="#/day/${v.day}">Day ${v.day}</a></p><div class="viz-mount" data-viz="${v.id}"></div>`).join('')}</div>`;
    $$('.viz-mount', main).forEach(el => window.VIZ.mount(el));
    window.scrollTo(0, 0);
  }

  /* ---------- 용어 사전 ---------- */
  function renderGlossary() {
    renderSidebar(-1);
    document.title = '용어 사전 — ' + C.title;
    const G = (window.GLOSSARY || []).slice().sort((a, b) => a.k.localeCompare(b.k, 'ko'));
    main.innerHTML = `<div class="page"><div class="eyebrow">GLOSSARY</div><h1>📖 용어 사전</h1>
      <p class="lead">강의에 등장하는 핵심 용어 ${G.length}개. 한국어·영어 모두 검색됩니다.</p>
      <input class="gl-search" id="gq" placeholder="예: 역전파, softmax, 과적합…" autocomplete="off"><div id="gl"></div></div>`;
    const draw = q => {
      q = (q || '').trim().toLowerCase();
      $('#gl').innerHTML = G.filter(g => !q || (g.k + g.en + g.d).toLowerCase().includes(q)).map(g =>
        `<div class="gl-item"><b>${g.k}</b><span class="en">${g.en}</span><div class="gd">${g.d}</div><div class="gdays">${(g.days || []).map(x => `<a href="#/day/${x}">Day ${x}</a>`).join('')}</div></div>`).join('') || '<p>검색 결과가 없습니다.</p>';
      if (window.renderMathInElement) renderMathInElement($('#gl'), { delimiters: [{ left: '$', right: '$', display: false }], throwOnError: false });
    };
    $('#gq').oninput = e => draw(e.target.value);
    draw('');
    window.scrollTo(0, 0);
  }

  /* ---------- 내 기록 ---------- */
  function renderMe() {
    renderSidebar(-1);
    document.title = '내 기록 — ' + C.title;
    const notes = C.days.filter(d => S.notes[d.day] && S.notes[d.day].trim());
    main.innerHTML = `<div class="page"><div class="eyebrow">MY RECORD</div><h1>📒 내 기록</h1>
      <p class="lead">진도, 퀴즈 점수, 노트는 이 브라우저(localStorage)에 저장됩니다. 다른 기기로 옮기려면 내보내기 → 가져오기를 사용하세요.</p>
      <div class="day-actions"><button class="btn primary" id="exp">⬇ 진도 내보내기(JSON)</button><label class="btn">⬆ 가져오기<input type="file" id="imp" accept="application/json" hidden></label><button class="btn" id="rst" style="color:var(--bad)">초기화</button></div>
      <h2>진도 요약</h2>
      <table><thead><tr><th>Day</th><th>제목</th><th>완료</th><th>퀴즈</th></tr></thead><tbody>
      ${C.days.map(d => `<tr><td>${d.day}</td><td><a href="#/day/${d.day}">${d.title}</a></td><td>${S.done[d.day] ? '✅ ' + S.done[d.day].slice(0, 10) : ''}</td><td>${S.quiz[d.day] ? S.quiz[d.day].score + '/' + S.quiz[d.day].total : ''}</td></tr>`).join('')}
      </tbody></table>
      <h2>나의 노트 모아보기</h2>
      ${notes.length ? notes.map(d => `<div class="card" style="margin:12px 0"><b><a href="#/day/${d.day}">Day ${d.day}. ${d.title}</a></b><p style="white-space:pre-wrap;margin-bottom:0">${esc(S.notes[d.day])}</p></div>`).join('') : '<p style="color:var(--muted)">아직 작성한 노트가 없습니다. 각 강의 하단에서 작성할 수 있어요.</p>'}
    </div>`;
    $('#exp').onclick = () => {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `dl30-progress-${today()}.json`; a.click();
    };
    $('#imp').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => { S = Object.assign(blank(), JSON.parse(t)); save(); toast('진도를 가져왔습니다'); renderMe(); }).catch(() => toast('파일을 읽지 못했습니다'));
    };
    $('#rst').onclick = () => { if (confirm('모든 진도·노트·퀴즈 기록을 삭제할까요? 되돌릴 수 없습니다.')) { S = blank(); save(); renderMe(); } };
    window.scrollTo(0, 0);
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  route();
})();
