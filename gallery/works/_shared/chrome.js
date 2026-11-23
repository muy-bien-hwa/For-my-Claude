/* chrome.js — 작품 페이지 공통 동작.
 *   · ESC 를 누르면 목록으로 돌아간다.
 *   · I 키나 INFO 버튼으로 설명 패널을 연다.
 * 작품의 내용 자체에는 관여하지 않는다.
 */
(function () {
  'use strict';

  function init() {
    var panel = document.querySelector('.work-info');
    var toggle = document.querySelector('.work-toggle');

    function setOpen(open) {
      if (!panel) return;
      panel.dataset.open = String(open);
      if (toggle) toggle.setAttribute('aria-expanded', String(open));
    }

    if (toggle && panel) {
      setOpen(false);
      toggle.addEventListener('click', function () {
        setOpen(panel.dataset.open !== 'true');
      });
    }

    document.addEventListener('keydown', function (ev) {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      var t = ev.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

      if (ev.key === 'Escape') {
        if (panel && panel.dataset.open === 'true') { setOpen(false); return; }
        var back = document.querySelector('.work-bar__back');
        if (back) window.location.href = back.getAttribute('href');
      }
      if (ev.key === 'i' || ev.key === 'I') {
        if (panel) setOpen(panel.dataset.open !== 'true');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
