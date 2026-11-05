/* 8주 딥러닝 — 앱 (라우터, 진도·책갈피, 강의 렌더러, 용어 사전, 실행기) */
(function () {
  'use strict';
  const C = window.CURRICULUM;
  const G = window.GLOSSARY || [];
  const GI = window.GLOSSARY_INDEX || {};
  const READY = new Set(C.ready || []);
  const REPO = 'muy-bien-hwa/For-my-Claude';
  const NB_BASE = `https://colab.research.google.com/github/${REPO}/blob/main/deep_learning_study/notebooks/`;
  const KEY = 'dl8.progress.v1';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const main = $('#main');
  const pad = n => String(n).padStart(2, '0');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dayMeta = n => C.days.find(d => d.day === n);
  const weekMeta = n => C.weeks.find(w => w.id === n);
  const isReady = n => READY.has(n);
  const GMAP = Object.fromEntries(G.map(g => [g.k, g]));

  /* ---------- 아이콘 ---------- */
  const ic = (p, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  const I = {
    check: ic('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    bookmark: ic('<path d="M7 4h10v16l-5-3.5L7 20z"/>'),
    chev: ic('<path d="M9 6l6 6-6 6"/>', 'chev'),
    search: ic('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    star: ic('<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>'),
    play: ic('<path d="M8 5.5v13l10.5-6.5z"/>'),
    playAll: ic('<path d="M5 5.5v13l8-6.5zM13 5.5v13l8-6.5z"/>'),
    undo: ic('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
    ext: ic('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    arrowR: ic('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    clock: ic('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2"/>'),
    code: ic('<path d="M8 8l-4 4 4 4M16 8l4 4-4 4"/>'),
    book: ic('<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>'),
    home: ic('<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>')
  };

  /* ---------- 저장소 ---------- */
  const blank = () => ({ done: {}, bookmark: null, notes: {}, quiz: {}, visits: {}, scroll: {}, read: {}, words: {}, checks: {}, started: null });
  let S = load();
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return Object.assign(blank(), JSON.parse(raw)); } catch (e) {}
    return blank();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  function markVisit() { if (!S.started) S.started = today(); S.visits[today()] = (S.visits[today()] || 0) + 1; save(); }
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400);
  }
  const doneCount = () => Object.keys(S.done).length;

  /* ---------- 공통 UI ---------- */
  let openWeeks = null;
  function renderSidebar(activeDay) {
    const sb = $('#sidebar');
    const curWeek = activeDay > 0 ? dayMeta(activeDay).week : (S.bookmark ? dayMeta(S.bookmark.day).week : 1);
    if (!openWeeks) openWeeks = new Set([curWeek]);
    if (activeDay > 0) openWeeks.add(curWeek);
    let h = `<a class="side-home ${activeDay === 0 ? 'active' : ''}" href="#/">${I.home}과정 홈</a>`;
    for (const w of C.weeks) {
      const ds = C.days.filter(d => d.week === w.id);
      const nd = ds.filter(d => S.done[d.day]).length;
      h += `<div class="wk ${openWeeks.has(w.id) ? 'open' : ''}" data-w="${w.id}">
        <button class="wk-head" aria-expanded="${openWeeks.has(w.id)}">${I.chev}<span class="wk-no">${w.id}주차</span><span>${w.title}</span><span class="wk-pct">${nd}/7</span></button>
        <div class="wk-days">`;
      for (const d of ds) {
        const cls = ['dlink', d.kind === 'project' ? 'project' : '', activeDay === d.day ? 'active' : '', isReady(d.day) ? '' : 'unready'].join(' ');
        const st = S.done[d.day] ? I.check : (S.bookmark && S.bookmark.day === d.day ? `<span style="color:var(--warn)">${I.bookmark}</span>` : '');
        h += `<a class="${cls}" href="#/day/${d.day}"><span class="dn">D${pad(d.day)}</span><span class="dt">${d.kind === 'project' ? '프로젝트 · ' + esc(d.title.replace(/^주간 프로젝트 \d+: /, '')) : esc(d.title)}</span><span class="st">${st}</span></a>`;
      }
      h += `</div></div>`;
    }
    sb.innerHTML = h;
    $$('.wk-head', sb).forEach(b => b.onclick = () => {
      const w = +b.parentElement.dataset.w;
      openWeeks.has(w) ? openWeeks.delete(w) : openWeeks.add(w);
      b.parentElement.classList.toggle('open'); b.setAttribute('aria-expanded', openWeeks.has(w));
    });
    const pct = Math.round(doneCount() / C.days.length * 100);
    $('#topFill').style.width = pct + '%';
    $('#topPct').textContent = pct + '%';
    $$('.nav-links a').forEach(a => a.classList.toggle('active', location.hash.startsWith(a.getAttribute('href'))));
  }
  function closeMenu() { $('#sidebar').classList.remove('open'); if (!$('#drawer').classList.contains('open')) $('#scrim').classList.remove('show'); }
  $('#menuBtn').onclick = () => { const o = $('#sidebar').classList.toggle('open'); $('#scrim').classList.toggle('show', o); };
  $('#scrim').onclick = () => { closeMenu(); closeDrawer(); };
  $('#themeBtn').onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const nx = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nx;
    try { localStorage.setItem('dl8.theme', nx); } catch (e) {}
    window.dispatchEvent(new Event('themechange'));
  };
  function setRail(on) { $('#layout').classList.toggle('with-rail', on); if (!on) $('#rail').innerHTML = ''; }
  function renderMath(el) {
    if (window.renderMathInElement) renderMathInElement(el, {
      delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\[', right: '\\]', display: true }, { left: '$', right: '$', display: false }, { left: '\\(', right: '\\)', display: false }],
      ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option'], throwOnError: false
    });
  }

  /* ---------- 라우터 ---------- */
  let cleanup = [];
  function route() {
    closeMenu(); closeDrawer();
    cleanup.forEach(f => { try { f(); } catch (e) {} }); cleanup = [];
    window.V && V.stopAll && V.stopAll();
    const h = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
    let m;
    if ((m = h.match(/^\/day\/(\d+)(?:\/(.+))?$/))) return renderDay(+m[1], m[2] || null);
    if ((m = h.match(/^\/glossary(?:\/(.+))?$/))) return renderGlossary(m[1] || null);
    if ((m = h.match(/^\/lab(?:\/(.+))?$/))) return renderLab(m[1] || null);
    if (h.startsWith('/me')) return renderMe();
    return renderHome();
  }
  window.addEventListener('hashchange', route);

  /* ---------- 과정 홈 ---------- */
  function nextDay() {
    if (S.bookmark && dayMeta(S.bookmark.day)) return S.bookmark.day;
    const nd = C.days.find(d => !S.done[d.day] && isReady(d.day));
    return nd ? nd.day : 1;
  }
  function streak() {
    let n = 0; const d = new Date();
    for (;;) { const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; if (S.visits[k]) { n++; d.setDate(d.getDate() - 1); } else break; }
    return n;
  }
  function renderHome() {
    setRail(false); renderSidebar(0);
    document.title = C.title;
    const nd = dayMeta(nextDay()), bm = S.bookmark;
    const qs = Object.values(S.quiz);
    const qAvg = qs.length ? Math.round(qs.reduce((a, q) => a + q.score / q.total, 0) / qs.length * 100) : null;
    const nWords = Object.keys(S.words).length;
    const hours = Math.round(doneCount() * C.minutesPerDay / 60);
    let h = `<div class="wide">
      <div class="home-head">
        <div class="eyebrow">DEEP LEARNING · 8 WEEKS · 56 DAYS</div>
        <h1>${C.title}</h1>
        <p class="lead" style="max-width:760px;margin:0">${C.subtitle}. 하루 180분, 주 6일 강의와 1일 주간 프로젝트로 구성된다. 1~4주차는 브라우저에서 NumPy로 원리를 직접 구현하고, 5~8주차는 PyTorch와 Colab GPU로 현대 모델을 다룬다.</p>
        <div class="cont">
          <div><div class="cl">${bm ? '책갈피에서 이어서' : (doneCount() ? '다음 강의' : '시작')}</div>
            <div class="ct">Day ${nd.day}. ${esc(nd.title)}</div>
            <div class="cs">${weekMeta(nd.week).id}주차 · ${esc(weekMeta(nd.week).title)}${bm && bm.label ? ' · ' + esc(bm.label) : ''}</div></div>
          <a class="btn primary" href="#/day/${nd.day}${bm && bm.anchor ? '/' + encodeURIComponent(bm.anchor) : ''}">학습 계속 ${I.arrowR}</a>
        </div>
      </div>
      <div class="stats">
        <div class="stat"><div class="n">${doneCount()}<small> / 56일</small></div><div class="l">완료</div></div>
        <div class="stat"><div class="n">${hours}<small> / 168시간</small></div><div class="l">학습량 (완료 기준)</div></div>
        <div class="stat"><div class="n">${qAvg === null ? '-' : qAvg + '%'}</div><div class="l">확인 문제 평균 정답률</div></div>
        <div class="stat"><div class="n">${nWords}<small> 개</small></div><div class="l">단어장 · 연속 학습 ${streak()}일</div></div>
      </div>
      <div class="panel" style="margin-bottom:36px"><div style="display:flex;justify-content:space-between;font-size:13px;color:var(--muted);font-weight:600"><span>56일 진도</span><span>초록: 완료 · 주황: 책갈피 · 테두리: 주간 프로젝트</span></div>
        <div class="heat">${C.days.map(d => `<a href="#/day/${d.day}" title="Day ${d.day}. ${esc(d.title)}" class="${S.done[d.day] ? 'on' : (bm && bm.day === d.day ? 'bm' : '')} ${d.kind === 'project' ? 'proj' : ''}"></a>`).join('')}</div></div>
      <div class="weeks">`;
    for (const w of C.weeks) {
      const ds = C.days.filter(d => d.week === w.id); const nd2 = ds.filter(d => S.done[d.day]).length;
      h += `<div class="wcard"><div class="wh"><div class="wn">${w.id}주차</div><div><div class="wt">${esc(w.title)}</div><div class="wd">${esc(w.desc)}</div></div>
        <div class="wp">${nd2} / 7 완료<div class="bar"><i style="width:${nd2 / 7 * 100}%"></i></div></div></div><ol>`;
      for (const d of ds) h += `<li class="${S.done[d.day] ? 'done' : ''} ${isReady(d.day) ? '' : 'unready'} ${d.kind === 'project' ? 'proj' : ''}"><span class="dn">Day ${d.day}</span><a href="#/day/${d.day}">${esc(d.title)}</a>${isReady(d.day) ? '' : '<span class="muted" style="font-size:12px">준비 중</span>'}</li>`;
      h += `</ol></div>`;
    }
    h += `</div></div>`;
    main.innerHTML = h;
    window.scrollTo(0, 0);
  }

  /* ---------- 강의 ---------- */
  const cache = {};
  async function renderDay(n, anchor) {
    const d = dayMeta(n);
    if (!d) return renderHome();
    renderSidebar(n);
    const w = weekMeta(d.week);
    document.title = `Day ${n}. ${d.title} — ${C.title}`;
    const prev = dayMeta(n - 1), next = dayMeta(n + 1);
    const head = `<div class="lec-head"><div class="eyebrow">${w.id}주차 · ${esc(w.title)} · Day ${n}${d.kind === 'project' ? ' · 주간 프로젝트' : ''}</div>
      <h1>${esc(d.title)}</h1>
      <div class="lec-meta"><span>${I.clock}${C.minutesPerDay}분</span><span>${I.code}${d.runtime === 'colab' ? 'Colab (GPU) 실습' : '브라우저 실습'}</span>${S.done[n] ? `<span style="color:var(--ok)">${I.check}${S.done[n].slice(0, 10)} 완료</span>` : ''}</div>
      <p class="lead" style="margin:0">${esc(d.summary)}</p></div>`;
    if (!isReady(n)) {
      setRail(false);
      main.innerHTML = `<article class="page article">${head}<div class="soon">이 강의는 아직 준비 중이다.<br>완성된 강의부터 순서대로 공개된다.</div>${pagerHtml(prev, next)}</article>`;
      window.scrollTo(0, 0); return;
    }
    main.innerHTML = `<div class="page"><p class="muted">불러오는 중</p></div>`;
    let html = cache[n];
    if (!html) {
      try {
        const r = await fetch(`content/day${pad(n)}.html`, { cache: 'no-cache' });
        if (!r.ok) throw new Error(r.status);
        html = cache[n] = await r.text();
      } catch (e) { main.innerHTML = `<div class="page"><h1>불러오기 실패</h1><p>Day ${n} 자료를 불러오지 못했다 (${esc(e.message)}).</p></div>`; return; }
    }
    if (location.hash.indexOf(`/day/${n}`) < 0) return;           // 그 사이 다른 페이지로 이동함
    markVisit();
    setRail(true);
    main.innerHTML = `<article class="page article" id="article">${head}
      <div class="lec-actions">${d.nb ? `<a class="btn primary" target="_blank" rel="noopener" href="${NB_BASE}${d.nb}">Colab 노트북 열기 ${I.ext}</a>` : ''}
        <button class="btn" id="bmTop">${I.bookmark}이 강의 책갈피</button></div>
      <div id="flowbar"></div>
      <div id="body">${html}</div>
      <div class="lec-foot">
        <div class="panel"><h3>학습 노트</h3><p class="muted" style="font-size:14px;margin-bottom:12px">이 강의의 핵심을 자신의 말로 요약한다. 자동 저장된다.</p>
          <textarea class="notes" id="notes" placeholder="예: 역전파는 계산 그래프 위에서 연쇄법칙을 출력 쪽부터 적용하는 알고리즘이다.">${esc(S.notes[n] || '')}</textarea></div>
        <div class="panel" style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between">
          <div><b>${S.done[n] ? '완료한 강의' : '강의 완료'}</b><div class="muted" style="font-size:14px">완료로 표시하면 진도에 반영되고 책갈피가 다음 날로 옮겨진다.</div></div>
          <button class="btn ${S.done[n] ? '' : 'ok'}" id="doneBtn">${S.done[n] ? '완료 취소' : I.check + '완료로 표시'}</button></div>
        ${pagerHtml(prev, next)}
      </div></article>`;
    const body = $('#body');
    enhance(body, n);
    buildRail(n);
    $('#bmTop').onclick = () => setBookmark(n, null, null);
    let nt;
    $('#notes').addEventListener('input', e => { clearTimeout(nt); nt = setTimeout(() => { S.notes[n] = e.target.value; save(); }, 400); });
    $('#doneBtn').onclick = () => {
      if (S.done[n]) { delete S.done[n]; toast('완료 표시를 취소함'); }
      else {
        S.done[n] = new Date().toISOString();
        const nx = C.days.find(x => x.day > n && !S.done[x.day]);
        S.bookmark = nx ? { day: nx.day, anchor: null, label: null, ts: new Date().toISOString() } : null;
        toast(nx ? `Day ${n} 완료. 책갈피를 Day ${nx.day}로 옮김` : '56일 과정을 모두 완료함');
      }
      save(); renderDay(n);
    };
    requestAnimationFrame(() => {
      if (anchor) { jumpTo(anchor); return; }
      if (S.scroll[n]) window.scrollTo(0, S.scroll[n]); else window.scrollTo(0, 0);
    });
    let st;
    const onScroll = () => { clearTimeout(st); st = setTimeout(() => { S.scroll[n] = Math.round(window.scrollY); save(); updateToc(); }, 160); };
    window.addEventListener('scroll', onScroll, { passive: true });
    cleanup.push(() => window.removeEventListener('scroll', onScroll));
  }
  function pagerHtml(prev, next) {
    return `<div class="pager">${prev ? `<a href="#/day/${prev.day}"><small>이전 · Day ${prev.day}</small>${esc(prev.title)}</a>` : '<span></span>'}
      ${next ? `<a class="next" href="#/day/${next.day}"><small>다음 · Day ${next.day}</small>${esc(next.title)}</a>` : '<span></span>'}</div>`;
  }
  function jumpTo(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: el.tagName === 'DFN' ? 'center' : 'start' });
    if (el.tagName === 'DFN') { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 2600); }
  }
  function setBookmark(day, anchor, label) {
    S.bookmark = { day, anchor, label, ts: new Date().toISOString() };
    save(); renderSidebar(day);
    $$('.h-bm').forEach(b => b.classList.toggle('on', b.dataset.id === anchor));
    toast(`책갈피 저장: Day ${day}${label ? ' · ' + label : ''}`);
  }

  function enhance(body, n) {
    // 학습 목표
    const goals = $('ul.goals', body);
    if (goals) { const box = document.createElement('div'); box.className = 'goals-box'; box.innerHTML = '<div class="gt">학습 목표</div>'; goals.replaceWith(box); box.appendChild(goals); }
    // 절 번호, id, 책갈피
    let h2i = 0, h3i = 0; const secs = [];
    $$(':scope > h2, :scope > h3', body).forEach(h => {
      if (h.tagName === 'H2') {
        h2i++; h3i = 0; h.id = 's' + h2i;
        const label = h.textContent.trim();          // 번호를 붙이기 전의 제목
        h.insertAdjacentHTML('afterbegin', `<span class="hno">${h2i}</span>`);
        const b = document.createElement('button');
        b.className = 'h-bm' + (S.bookmark && S.bookmark.day === n && S.bookmark.anchor === h.id ? ' on' : '');
        b.dataset.id = h.id; b.title = '이 절에 책갈피'; b.setAttribute('aria-label', '이 절에 책갈피'); b.innerHTML = I.bookmark;
        b.onclick = () => setBookmark(n, h.id, label);
        h.prepend(b);
        secs.push({ el: h, id: h.id, label, min: +(h.dataset.min || 0), kind: h.dataset.kind || 'concept' });
      } else {
        h3i++; h.id = `s${h2i}-${h3i}`;
        h.insertAdjacentHTML('afterbegin', `<span class="hno">${h2i}.${h3i}</span>`);
      }
    });
    buildFlowbar(n, secs);
    // 용어 정의 위치
    $$('dfn[data-t]', body).forEach(d => { d.id = 't-' + d.dataset.t; });
    // 상자 라벨
    let exN = 0;
    $$('.box', body).forEach(b => {
      const t = b.dataset.title;
      if (b.classList.contains('ex')) { exN++; b.dataset.label = `예제 ${exN}${t ? ' · ' + t : ''}`; }
      else if (t) { const base = { def: '정의', key: '핵심', warn: '주의', note: '참고' }[[...b.classList].find(c => c !== 'box')] || ''; b.dataset.label = `${base} · ${t}`; }
    });
    // 그림 번호
    $$('figure.fig', body).forEach((f, i) => { const cap = $('figcaption', f); if (cap) cap.insertAdjacentHTML('afterbegin', `<b class="fno">그림 ${i + 1}.</b>`); });
    // Colab 버튼
    $$('a.colab', body).forEach(a => { a.href = NB_BASE + a.dataset.nb; a.target = '_blank'; a.rel = 'noopener'; a.classList.add('btn'); a.insertAdjacentHTML('beforeend', ' ' + I.ext); });
    // 미니 프로젝트 머리
    $$('section.project', body).forEach(p => {
      p.insertAdjacentHTML('afterbegin', `<div class="ph"><span class="pl">미니 프로젝트</span><span class="ptt">${esc(p.dataset.title || '')}</span><span class="pm">${p.dataset.min ? p.dataset.min + '분' : ''}</span></div>`);
      const inner = document.createElement('div'); inner.className = 'pb';
      while (p.children.length > 1) inner.appendChild(p.children[1]);
      p.appendChild(inner);
    });
    // 체크리스트
    $$('ul.checklist', body).forEach(ul => {
      const id = ul.dataset.id || ('d' + n); S.checks[id] = S.checks[id] || {};
      $$('li', ul).forEach((li, i) => {
        const on = !!S.checks[id][i];
        li.innerHTML = `<input type="checkbox" ${on ? 'checked' : ''} aria-label="완료"><span>${li.innerHTML}</span>`;
        li.classList.toggle('done', on);
        $('input', li).onchange = e => { S.checks[id][i] = e.target.checked; li.classList.toggle('done', e.target.checked); save(); };
      });
    });
    // 코드
    $$('pre:not(.run) code', body).forEach(c => { if (!c.className) c.className = 'language-python'; if (window.hljs) hljs.highlightElement(c); });
    const runners = [];
    $$('pre.run', body).forEach(pre => runners.push(mountRunner(pre, runners)));
    // 확인 문제
    $$('script.quiz', body).forEach(s => mountQuiz(s, n));
    // 시각화
    let vn = 0;
    $$('.viz-mount', body).forEach(el => { vn++; el.dataset.no = vn; window.V && V.mount(el); });
    renderMath(body);
    // 읽음 추적
    trackRead(n, secs);
  }

  function buildFlowbar(n, secs) {
    const fb = $('#flowbar'); if (!fb || !secs.length) return;
    const total = secs.reduce((a, s) => a + (s.min || 0), 0) || 1;
    const read = new Set(S.read[n] || []);
    const kinds = { concept: '개념', practice: '실습', project: '미니 프로젝트', review: '정리·문제' };
    fb.className = 'flowbar';
    fb.innerHTML = `<div class="fb-title"><span>강의 흐름</span><span>${secs.filter(s => read.has(s.id)).length} / ${secs.length} 절 읽음</span></div>
      <div class="fb-track">${secs.map(s => `<button class="fb-seg k-${s.kind} ${read.has(s.id) ? 'read' : ''}" style="flex:${Math.max(s.min || 0, 4)}" data-id="${s.id}" title="${esc(s.label)} · ${s.min}분" aria-label="${esc(s.label)}"></button>`).join('')}</div>
      <div class="fb-legend">${Object.entries(kinds).filter(([k]) => secs.some(s => s.kind === k)).map(([k, v]) => `<span><i style="background:var(${{ concept: '--accent', practice: '--teal', project: '--warn', review: '--muted' }[k]})"></i>${v} ${secs.filter(s => s.kind === k).reduce((a, s) => a + s.min, 0)}분</span>`).join('')}<span style="margin-left:auto">합계 ${total}분</span></div>
      <ol class="fb-list">${secs.map((s, i) => `<li class="${read.has(s.id) ? 'read' : ''}" data-id="${s.id}"><a href="#/day/${n}/${s.id}">${i + 1}. ${esc(s.label)}</a><span class="m">${s.min}분</span></li>`).join('')}</ol>`;
    $$('.fb-seg', fb).forEach(b => b.onclick = () => jumpTo(b.dataset.id));
    $$('.fb-list a', fb).forEach(a => a.onclick = e => { e.preventDefault(); jumpTo(a.getAttribute('href').split('/').pop()); });
  }
  function trackRead(n, secs) {
    if (!('IntersectionObserver' in window) || !secs.length) return;
    S.read[n] = S.read[n] || [];
    const markers = [];
    secs.forEach((s, i) => {
      const nextEl = secs[i + 1] ? secs[i + 1].el : $('.lec-foot');
      if (!nextEl) return;
      const m = document.createElement('span'); m.dataset.sid = s.id; m.style.cssText = 'display:block;height:1px';
      nextEl.parentNode.insertBefore(m, nextEl); markers.push(m);
    });
    const io = new IntersectionObserver(es => {
      es.forEach(e => {
        if (!e.isIntersecting) return;
        const id = e.target.dataset.sid;
        if (!S.read[n].includes(id)) {
          S.read[n].push(id); save();
          const seg = $(`.fb-seg[data-id="${id}"]`); if (seg) seg.classList.add('read');
          const li = $(`.fb-list li[data-id="${id}"]`); if (li) li.classList.add('read');
          const t = $('.fb-title span:last-child'); if (t) t.textContent = `${S.read[n].length} / ${secs.length} 절 읽음`;
        }
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    markers.forEach(m => io.observe(m));
    cleanup.push(() => io.disconnect());
  }

  /* 오른쪽 레일: 사전 검색 + 이 강의의 용어 + 목차 */
  function buildRail(n) {
    const rail = $('#rail');
    const defs = $$('#body dfn[data-t]').map(d => d.dataset.t).filter(k => GMAP[k]);
    rail.innerHTML = `<div class="rsec"><div class="rt">용어 검색</div><div class="dict" id="railDict"></div></div>
      ${defs.length ? `<div class="rsec"><div class="rt">이 강의에서 정의하는 용어</div><div class="lt">${defs.map(k => `<a href="#/day/${n}/t-${k}" data-k="${k}">${esc(GMAP[k].ko)}</a>`).join('')}</div></div>` : ''}
      <div class="rsec"><div class="rt">목차</div><nav class="toc" id="toc">${$$('#body > h2, #body > h3').map(h => `<a href="#/day/${n}/${h.id}" data-id="${h.id}" class="${h.tagName === 'H3' ? 'sub' : ''}">${esc(headText(h))}</a>`).join('')}</nav></div>`;
    renderDict($('#railDict'), { compact: true, day: n });
    $$('.lt a, .toc a', rail).forEach(a => a.onclick = e => { e.preventDefault(); jumpTo(a.getAttribute('href').split('/').pop()); });
    updateToc();
  }
  function headText(h) {
    const no = h.querySelector('.hno');
    const rest = Array.from(h.childNodes).filter(x => !(x.classList && (x.classList.contains('hno') || x.classList.contains('h-bm')))).map(x => x.textContent).join('').trim();
    return (no ? no.textContent + '. ' : '') + rest;
  }
  function updateToc() {
    const toc = $('#toc'); if (!toc) return;
    let cur = null;
    $$('#body > h2, #body > h3').forEach(h => { if (h.getBoundingClientRect().top < 140) cur = h.id; });
    $$('a', toc).forEach(a => a.classList.toggle('cur', a.dataset.id === cur));
  }

  /* ---------- 확인 문제 ---------- */
  function mountQuiz(script, n) {
    let qs;
    try { qs = JSON.parse(script.textContent); } catch (e) { console.error('quiz', e); return; }
    const wrap = document.createElement('div'); wrap.className = 'quiz';
    let answered = 0, right = 0;
    const score = document.createElement('div'); score.className = 'quiz-score';
    qs.forEach((q, qi) => {
      const box = document.createElement('div'); box.className = 'q';
      box.innerHTML = `<div class="qt"><span class="qn">${qi + 1}.</span>${q.q}</div><div class="opts"></div><div class="exp">${q.e || ''}</div>`;
      const opts = $('.opts', box);
      q.o.forEach((o, oi) => {
        const b = document.createElement('button'); b.className = 'opt';
        b.innerHTML = `<span class="ol">${'ABCDEF'[oi]}</span><span>${o}</span>`;
        b.onclick = () => {
          $$('.opt', box).forEach((x, xi) => { x.disabled = true; if (xi === q.a) x.classList.add('right'); });
          if (oi !== q.a) b.classList.add('wrong'); else right++;
          box.classList.add('answered'); answered++;
          if (answered === qs.length) {
            S.quiz[n] = { score: right, total: qs.length, ts: new Date().toISOString() }; save();
            score.innerHTML = `<span>${right} / ${qs.length} 정답</span><button class="btn sm">다시 풀기</button>`;
            $('button', score).onclick = () => { const s2 = script.cloneNode(true); wrap.replaceWith(s2); mountQuiz(s2, n); };
          }
        };
        opts.appendChild(b);
      });
      wrap.appendChild(box);
    });
    if (S.quiz[n]) score.innerHTML = `<span class="muted" style="font-weight:500">지난 기록: ${S.quiz[n].score} / ${S.quiz[n].total}</span>`;
    wrap.appendChild(score);
    script.replaceWith(wrap);
    renderMath(wrap);
  }

  /* ---------- Pyodide 실행기 ---------- */
  let pyReady = null;
  function loadPy(status) {
    if (pyReady) return pyReady;
    pyReady = new Promise((res, rej) => {
      status('Python 런타임(Pyodide) 내려받는 중. 첫 실행은 10~30초 걸린다.');
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
      s.onload = async () => {
        try {
          const py = await loadPyodide();
          status('NumPy, Matplotlib 설치 중');
          await py.loadPackage(['numpy', 'matplotlib']);
          try {
            status('그래프용 한글 글꼴 설치 중');
            const fr = await fetch('https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf');
            if (fr.ok) py.FS.writeFile('/tmp/NanumGothic.ttf', new Uint8Array(await fr.arrayBuffer()));
          } catch (e) { console.warn('font', e); }
          await py.runPythonAsync(PY_PRELUDE);
          res(py);
        } catch (e) { pyReady = null; rej(e); }
      };
      s.onerror = () => { pyReady = null; rej(new Error('Pyodide를 불러오지 못했다. 네트워크를 확인하라.')); };
      document.head.appendChild(s);
    });
    return pyReady;
  }
  const PY_PRELUDE = `
import os, io, base64, json as _json
import numpy as _np
import matplotlib
matplotlib.use('Agg')
from matplotlib import font_manager as _fm
if os.path.exists('/tmp/NanumGothic.ttf'):
    _fm.fontManager.addfont('/tmp/NanumGothic.ttf')
    matplotlib.rcParams['font.family'] = _fm.FontProperties(fname='/tmp/NanumGothic.ttf').get_name()
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['figure.dpi'] = 96
import matplotlib.pyplot as plt
from pyodide.http import open_url as _open_url
def load_data(name):
    """강의용 실제 데이터 (UCI, CC BY 4.0): digits, iris, breast_cancer, wine"""
    d = _json.loads(_open_url(f"assets/data/{name}.json").read())
    for k in ("X", "y", "images"):
        if k in d: d[k] = _np.array(d[k])
    return d
def _dl_figs():
    out = []
    for num in plt.get_fignums():
        f = plt.figure(num); b = io.BytesIO(); f.savefig(b, format='png', dpi=96, bbox_inches='tight')
        out.append(base64.b64encode(b.getvalue()).decode())
    plt.close('all')
    return out
`;
  function mountRunner(pre, runners) {
    const code = pre.textContent.replace(/^\n/, '').replace(/\s+$/, '');
    const idx = runners.length + 1;
    const w = document.createElement('div'); w.className = 'runner';
    w.innerHTML = `<div class="rbar"><span class="lbl">Python · 브라우저 실행 <span class="cell-no">[${idx}]</span></span>
      <button class="rbtn" data-a="reset" title="원래 코드로">${I.undo}원래대로</button>
      ${idx > 1 ? `<button class="rbtn" data-a="all" title="1번 셀부터 이 셀까지 차례로 실행">${I.playAll}여기까지 모두 실행</button>` : ''}
      <button class="rbtn primary" data-a="run" title="실행 (Ctrl+Enter)">${I.play}실행</button></div>
      <textarea spellcheck="false" aria-label="코드 ${idx}"></textarea><div class="out" aria-live="polite"></div>`;
    const ta = $('textarea', w), out = $('.out', w);
    ta.value = code;
    const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 4, 720) + 'px'; };
    requestAnimationFrame(fit); ta.addEventListener('input', fit);
    ta.addEventListener('keydown', e => {
      if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('    ', s, ta.selectionEnd, 'end'); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
    });
    const status = m => { out.style.display = 'block'; out.classList.remove('err'); out.textContent = m; };
    async function run() {
      w.classList.add('running');
      let py;
      try { py = await loadPy(status); } catch (e) { out.classList.add('err'); out.textContent = '런타임 로드 실패: ' + e.message; w.classList.remove('running'); return false; }
      status('실행 중');
      let buf = '';
      py.setStdout({ batched: s => { buf += s + '\n'; } });
      py.setStderr({ batched: s => { buf += s + '\n'; } });
      let ok = true;
      try {
        await py.runPythonAsync(ta.value);
        const figs = py.runPython('_dl_figs()').toJs();
        out.textContent = buf || (figs.length ? '' : '(출력 없음)');
        figs.forEach(b64 => { const img = document.createElement('img'); img.alt = '실행 결과 그래프'; img.src = 'data:image/png;base64,' + b64; out.appendChild(img); });
      } catch (e) {
        ok = false; out.classList.add('err');
        const lines = String(e.message || e).split('\n').filter(l => !/\/lib\/python|pyodide|_pyodide|^\s*\^+\s*$/.test(l));
        out.textContent = buf + lines.slice(-10).join('\n') + (/NameError/.test(e.message) ? '\n\n앞 셀을 먼저 실행해야 하는 변수일 수 있다. "여기까지 모두 실행"을 사용하라.' : '');
        try { py.runPython("import matplotlib.pyplot as plt; plt.close('all')"); } catch (e2) {}
      }
      w.classList.remove('running');
      return ok;
    }
    async function runAll() {
      for (const r of runners.slice(0, idx)) { const ok = await r.run(); if (!ok) return; }
    }
    $('[data-a=reset]', w).onclick = () => { ta.value = code; fit(); };
    $('[data-a=run]', w).onclick = run;
    const allBtn = $('[data-a=all]', w); if (allBtn) allBtn.onclick = runAll;
    pre.replaceWith(w);
    return { run };
  }

  /* ---------- 용어 사전 ---------- */
  const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const cho = s => Array.from(s).map(ch => { const c = ch.charCodeAt(0) - 0xAC00; return c >= 0 && c <= 11171 ? CHO[Math.floor(c / 588)] : ch; }).join('');
  const isChoQuery = q => /^[ㄱ-ㅎ]+$/.test(q);
  const norm = s => String(s || '').toLowerCase().replace(/[\s\-·_()]/g, '');
  function searchTerms(q) {
    q = (q || '').trim(); if (!q) return [];
    const nq = norm(q), choQ = isChoQuery(q);
    const scored = [];
    for (const g of G) {
      const names = [g.ko, g.en, ...(g.aka || [])].map(norm);
      let s = 0;
      if (names.some(x => x === nq)) s = 100;
      else if (names.some(x => x.startsWith(nq))) s = 80;
      else if (names.some(x => x.includes(nq))) s = 60;
      else if (choQ && norm(cho(g.ko)).includes(nq)) s = 50;
      else if (norm(g.d).includes(nq)) s = 20;
      if (s) scored.push([s - g.ko.length * 0.01, g]);
    }
    return scored.sort((a, b) => b[0] - a[0]).map(x => x[1]);
  }
  function termHtml(g, opts = {}) {
    const ix = GI[g.k] || {};
    const saved = !!S.words[g.k];
    const def = ix.def;
    const days = (ix.days || []).filter(isReady);
    return `<div class="term" data-k="${g.k}" id="g-${g.k}">
      <div class="th"><span class="tk">${esc(g.ko)}</span><span class="te">${esc(g.en || '')}</span>
        <button class="star ${saved ? 'on' : ''}" data-k="${g.k}" title="${saved ? '단어장에서 빼기' : '단어장에 추가'}" aria-label="단어장">${I.star}</button></div>
      <div class="td">${g.d}</div>
      <div class="tw">${def && isReady(def.day) ? `<a class="go" href="#/day/${def.day}/t-${g.k}">설명 위치로 이동 ${I.arrowR}</a><span>Day ${def.day} · ${esc(def.sec || '')}</span>` : '<span>본문 설명 준비 중</span>'}</div>
      ${days.length ? `<div class="tw" style="margin-top:6px"><span>등장:</span>${days.slice(0, 14).map(dn => `<a class="chip" href="#/day/${dn}" title="${esc(dayMeta(dn).title)}">D${dn}</a>`).join('')}${days.length > 14 ? `<span>외 ${days.length - 14}개</span>` : ''}</div>` : ''}
      ${!opts.compact && g.rel && g.rel.length ? `<div class="rel">관련: ${g.rel.filter(k => GMAP[k]).map(k => `<a href="#" data-q="${esc(GMAP[k].ko)}">${esc(GMAP[k].ko)}</a>`).join('')}</div>` : ''}
    </div>`;
  }
  function bindTerms(container, onQuery) {
    $$('.star', container).forEach(b => b.onclick = () => {
      const k = b.dataset.k;
      if (S.words[k]) { delete S.words[k]; toast('단어장에서 뺌'); } else { S.words[k] = { ts: new Date().toISOString(), box: 0 }; toast('단어장에 추가함'); }
      save(); b.classList.toggle('on', !!S.words[k]);
    });
    $$('.rel a[data-q]', container).forEach(a => a.onclick = e => { e.preventDefault(); onQuery && onQuery(a.dataset.q); });
    $$('a.go, a.chip', container).forEach(a => a.addEventListener('click', () => closeDrawer()));
    renderMath(container);
  }
  function renderDict(container, opts = {}) {
    const day = opts.day || null;
    let tab = opts.tab || 'search', q = opts.query || '';
    container.innerHTML = `<div class="dict-search">${I.search}<input type="search" placeholder="한글·영문·초성 (예: ㅇㅈㅍ)" aria-label="용어 검색" value="${esc(q)}"></div>
      ${opts.compact ? '' : `<div class="dict-tabs"><button data-t="search">검색</button>${day ? '<button data-t="lecture">이 강의 용어</button>' : ''}<button data-t="words">단어장</button></div>`}
      <div class="dict-list"></div>`;
    const input = $('input', container), list = $('.dict-list', container);
    const draw = () => {
      $$('.dict-tabs button', container).forEach(b => b.classList.toggle('on', b.dataset.t === tab));
      let items = [], empty = '';
      if (tab === 'search') {
        items = q ? searchTerms(q).slice(0, opts.compact ? 6 : 40) : [];
        empty = q ? '일치하는 용어가 없다.' : (opts.compact ? '' : '용어를 입력하면 뜻, 처음 설명된 강의, 등장 강의를 보여 준다.');
      } else if (tab === 'lecture') {
        const ks = $$('#body dfn[data-t]').map(d => d.dataset.t);
        items = ks.map(k => GMAP[k]).filter(Boolean); empty = '이 강의에서 새로 정의하는 용어가 없다.';
      } else {
        items = Object.keys(S.words).map(k => GMAP[k]).filter(Boolean); empty = '단어장이 비어 있다. 용어 옆 별표로 추가한다.';
      }
      list.innerHTML = items.length ? items.map(g => termHtml(g, opts)).join('') : (empty ? `<div class="dict-empty">${empty}</div>` : '');
      bindTerms(list, nq => { q = nq; tab = 'search'; input.value = nq; draw(); });
    };
    input.addEventListener('input', () => { q = input.value; tab = 'search'; draw(); });
    $$('.dict-tabs button', container).forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
    draw();
    return { focus: () => input.focus(), set: v => { q = v; input.value = v; tab = 'search'; draw(); } };
  }
  let drawerDict = null;
  function openDrawer(query) {
    const dr = $('#drawer');
    const m = location.hash.match(/^#\/day\/(\d+)/);
    drawerDict = renderDict($('#drawerBody'), { day: m ? +m[1] : null, query: query || '' });
    dr.classList.add('open'); dr.setAttribute('aria-hidden', 'false'); $('#scrim').classList.add('show');
    setTimeout(() => drawerDict.focus(), 50);
  }
  function closeDrawer() { const dr = $('#drawer'); dr.classList.remove('open'); dr.setAttribute('aria-hidden', 'true'); if (!$('#sidebar').classList.contains('open')) $('#scrim').classList.remove('show'); }
  $('#dictBtn').onclick = () => $('#drawer').classList.contains('open') ? closeDrawer() : openDrawer();
  $('#drawerClose').onclick = closeDrawer;
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); openDrawer(); }
    if (e.key === 'Escape') { closeDrawer(); closeMenu(); }
  });

  /* 용어 사전 페이지 + 단어장 복습 */
  function renderGlossary(focusKey) {
    setRail(false); renderSidebar(-1);
    document.title = '용어 사전 — ' + C.title;
    const letters = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ', 'A-Z'];
    const firstLetter = g => { const c = cho(g.ko[0]); const map = { 'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ' }; return /[ㄱ-ㅎ]/.test(c) ? (map[c] || c) : 'A-Z'; };
    let mode = 'list', letter = null, week = 0, q = '';
    main.innerHTML = `<div class="page"><div class="eyebrow">GLOSSARY</div><h1>용어 사전</h1>
      <p class="lead">과정에 나오는 용어 ${G.length}개의 짧은 정의. 각 용어에서 처음 설명한 강의 위치로 바로 이동할 수 있고, 별표로 단어장에 모아 카드로 복습할 수 있다.</p>
      <div class="dict-tabs" id="glTabs"><button data-m="list" class="on">전체 용어</button><button data-m="words">단어장</button><button data-m="cards">카드 복습</button></div>
      <div id="glBody"></div></div>`;
    const body = $('#glBody');
    const drawList = () => {
      body.innerHTML = `<div class="gl-tools"><div class="dict-search">${I.search}<input type="search" placeholder="한글·영문·초성 검색" value="${esc(q)}" aria-label="용어 검색"></div>
        <select id="glWeek" aria-label="주차"><option value="0">모든 주차</option>${C.weeks.map(w => `<option value="${w.id}" ${week === w.id ? 'selected' : ''}>${w.id}주차 · ${esc(w.title)}</option>`).join('')}</select></div>
        <div class="gl-index">${letters.map(l => `<button data-l="${l}" class="${letter === l ? 'on' : ''}">${l}</button>`).join('')}</div><div id="glList"></div>`;
      const draw = () => {
        let items = q ? searchTerms(q) : G.slice().sort((a, b) => a.ko.localeCompare(b.ko, 'ko'));
        if (letter) items = items.filter(g => firstLetter(g) === letter);
        if (week) items = items.filter(g => { const d = GI[g.k] && GI[g.k].def; return d && dayMeta(d.day).week === week; });
        $('#glList').innerHTML = items.length ? items.map(g => termHtml(g)).join('') : '<div class="dict-empty">해당하는 용어가 없다.</div>';
        bindTerms($('#glList'), nq => { q = nq; $('input', body).value = nq; letter = null; draw(); });
      };
      $('input', body).oninput = e => { q = e.target.value; letter = null; $$('.gl-index button', body).forEach(b => b.classList.remove('on')); draw(); };
      $('#glWeek').onchange = e => { week = +e.target.value; draw(); };
      $$('.gl-index button', body).forEach(b => b.onclick = () => { letter = letter === b.dataset.l ? null : b.dataset.l; $$('.gl-index button', body).forEach(x => x.classList.toggle('on', x.dataset.l === letter)); draw(); });
      draw();
      if (focusKey) { const el = document.getElementById('g-' + focusKey); if (el) { el.scrollIntoView({ block: 'center' }); el.style.background = 'var(--accent-soft)'; } }
    };
    const drawWords = () => {
      const items = Object.keys(S.words).map(k => GMAP[k]).filter(Boolean);
      body.innerHTML = items.length ? `<p class="muted" style="margin-top:20px">${items.length}개 저장됨</p><div id="wl">${items.map(g => termHtml(g)).join('')}</div>` : '<div class="dict-empty" style="margin-top:20px">단어장이 비어 있다. 용어 옆 별표를 눌러 추가한다.</div>';
      if (items.length) bindTerms($('#wl'));
    };
    const drawCards = () => {
      const keys = Object.keys(S.words).filter(k => GMAP[k]);
      const pool = keys.length ? keys : [];
      if (!pool.length) { body.innerHTML = '<div class="dict-empty" style="margin-top:20px">단어장에 용어를 추가하면 카드로 복습할 수 있다.</div>'; return; }
      const order = pool.slice().sort((a, b) => (S.words[a].box - S.words[b].box) || (Math.random() - .5));
      let i = 0, shown = false;
      const draw = () => {
        const k = order[i % order.length], g = GMAP[k], w = S.words[k];
        body.innerHTML = `<p class="muted" style="margin-top:20px">${i % order.length + 1} / ${order.length} · 숙련도 ${'■'.repeat(w.box)}${'□'.repeat(Math.max(0, 4 - w.box))}</p>
          <div class="fcard"><div><div class="fk">${esc(g.ko)}</div><div class="fe">${esc(g.en || '')}</div>${shown ? `<div class="fd">${g.d}</div>` : ''}</div></div>
          <div class="flash-actions">${shown ? `<button class="btn" data-a="again">다시 보기</button><button class="btn ok" data-a="know">알고 있음</button>` : `<button class="btn primary" data-a="show">뜻 보기</button>`}
          ${GI[k] && GI[k].def && isReady(GI[k].def.day) ? `<a class="btn ghost" href="#/day/${GI[k].def.day}/t-${k}">강의에서 보기</a>` : ''}</div>`;
        renderMath(body);
        const act = (a) => {
          if (a === 'show') shown = true;
          else { w.box = a === 'know' ? Math.min(4, w.box + 1) : 0; save(); shown = false; i++; }
          draw();
        };
        $$('[data-a]', body).forEach(b => b.onclick = () => act(b.dataset.a));
      };
      draw();
    };
    $$('#glTabs button').forEach(b => b.onclick = () => { mode = b.dataset.m; $$('#glTabs button').forEach(x => x.classList.toggle('on', x === b)); ({ list: drawList, words: drawWords, cards: drawCards })[mode](); });
    drawList();
    if (!focusKey) window.scrollTo(0, 0);
  }

  /* ---------- 실험실 ---------- */
  function renderLab(focus) {
    setRail(false); renderSidebar(-1);
    document.title = '실험실 — ' + C.title;
    const cat = ((window.V && V.catalog) || []).filter(v => V.modsAvailable.includes(v.mod));
    let h = `<div class="page"><div class="eyebrow">LAB</div><h1>실험실</h1>
      <p class="lead">강의에 쓰인 인터랙티브 시각화 ${cat.length}개를 주차별로 모았다. 각 시각화 아래의 "읽는 법과 해 볼 것"을 먼저 펼쳐 보라.</p>
      <div class="dict-search" style="margin:20px 0"><svg class="ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input type="search" id="labQ" placeholder="시각화 검색 (예: 등고선, 어텐션)" aria-label="시각화 검색"></div><div id="labList">`;
    for (const w of C.weeks) {
      const items = cat.filter(v => dayMeta(v.day).week === w.id);
      if (!items.length) continue;
      h += `<div class="lab-week" data-w="${w.id}">${w.id}주차 · ${esc(w.title)}</div>`;
      for (const v of items) h += `<div class="lab-item" data-q="${esc(v.title + ' ' + (v.kw || ''))}"><div class="lab-rel">Day ${v.day} · ${esc(dayMeta(v.day).title)}${isReady(v.day) ? ` · <a href="#/day/${v.day}">강의로 이동</a>` : ''}</div><div class="viz-mount" data-viz="${v.id}" data-lazy="1" id="lab-${v.id}"></div></div>`;
    }
    h += `</div></div>`;
    main.innerHTML = h;
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && !e.target.dataset.mounted) { e.target.dataset.mounted = 1; V.mount(e.target); io.unobserve(e.target); } }), { rootMargin: '400px' }) : null;
    $$('.viz-mount', main).forEach(el => io ? io.observe(el) : V.mount(el));
    if (io) cleanup.push(() => io.disconnect());
    $('#labQ').oninput = e => {
      const q = norm(e.target.value);
      $$('.lab-item', main).forEach(it => it.style.display = !q || norm(it.dataset.q).includes(q) ? '' : 'none');
      $$('.lab-week', main).forEach(wk => { let n = wk.nextElementSibling, any = false; while (n && n.classList.contains('lab-item')) { if (n.style.display !== 'none') any = true; n = n.nextElementSibling; } wk.style.display = any ? '' : 'none'; });
    };
    if (focus) setTimeout(() => { const el = document.getElementById('lab-' + focus); if (el) el.scrollIntoView(); }, 50); else window.scrollTo(0, 0);
  }

  /* ---------- 내 기록 ---------- */
  function renderMe() {
    setRail(false); renderSidebar(-1);
    document.title = '내 기록 — ' + C.title;
    const notes = C.days.filter(d => S.notes[d.day] && S.notes[d.day].trim());
    main.innerHTML = `<div class="page"><div class="eyebrow">MY RECORD</div><h1>내 기록</h1>
      <p class="lead">진도, 확인 문제 점수, 학습 노트, 단어장은 이 브라우저에 저장된다. 다른 기기로 옮길 때는 내보내기와 가져오기를 사용한다.</p>
      <div class="lec-actions" style="margin:20px 0 8px"><button class="btn primary" id="exp">진도 내보내기 (JSON)</button><label class="btn">가져오기<input type="file" id="imp" accept="application/json" hidden></label><button class="btn" id="rst" style="color:var(--bad)">초기화</button></div>
      <h2 style="margin-top:48px">주차별 진도</h2>
      <table><thead><tr><th>Day</th><th>제목</th><th>완료</th><th>읽은 절</th><th>확인 문제</th></tr></thead><tbody>
      ${C.days.map(d => `<tr><td>${d.day}</td><td><a href="#/day/${d.day}">${esc(d.title)}</a></td><td>${S.done[d.day] ? S.done[d.day].slice(0, 10) : ''}</td><td>${(S.read[d.day] || []).length || ''}</td><td>${S.quiz[d.day] ? S.quiz[d.day].score + ' / ' + S.quiz[d.day].total : ''}</td></tr>`).join('')}
      </tbody></table>
      <h2 style="margin-top:48px">학습 노트</h2>
      ${notes.length ? notes.map(d => `<div class="panel" style="margin:14px 0"><b><a href="#/day/${d.day}">Day ${d.day}. ${esc(d.title)}</a></b><p style="white-space:pre-wrap;margin:8px 0 0">${esc(S.notes[d.day])}</p></div>`).join('') : '<p class="muted">아직 작성한 노트가 없다. 각 강의 하단에서 작성한다.</p>'}
    </div>`;
    $('#exp').onclick = () => {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `dl8-progress-${today()}.json`; a.click();
    };
    $('#imp').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => { S = Object.assign(blank(), JSON.parse(t)); save(); toast('진도를 가져옴'); renderMe(); }).catch(() => toast('파일을 읽지 못함'));
    };
    $('#rst').onclick = () => { if (confirm('진도·노트·확인 문제·단어장 기록을 모두 삭제한다. 되돌릴 수 없다.')) { S = blank(); save(); renderMe(); } };
    window.scrollTo(0, 0);
  }

  window.DL = { openDrawer, jumpTo, isReady, dayMeta };
  route();
})();
