# -*- coding: utf-8 -*-
"""짜임 해부도 — 글자틀 위에 초성 자리·기둥·줄기를 표시한다."""
import io, sys, hangul, render, compose, outline

ST = dict(compose.STYLES['plain']); ST['detail'] = None
S = 300.0                      # 그림 한 변 (px)
K = S / 1000.0


def px(t, axis='x'):
    """글자틀 비율 → 그림 좌표 (y 는 뒤집는다)."""
    if axis == 'x':
        return render._fx(t) * K
    return (830 - render._fy(t)) * K


def diagram(ch):
    L = hangul.layout(ch)
    g = []
    W = 1000 * K
    H = 960 * K

    # 글자틀
    x0, y0 = px(0), px(1, 'y')
    x1, y1 = px(1), px(0, 'y')
    g.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" '
             'stroke="#3a352f" stroke-dasharray="3 3"/>' % (x0, y0, x1 - x0, y1 - y0))

    # 초성 자리
    cho, cb = L['cho']
    g.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="#c33c1e" '
             'opacity=".14"/>' % (px(cb[0]), px(cb[3], 'y'),
                                  px(cb[2]) - px(cb[0]), px(cb[1], 'y') - px(cb[3], 'y')))
    # 종성 자리
    if L['jong']:
        _j, jb = L['jong']
        g.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="#4a7fb5" '
                 'opacity=".16"/>' % (px(jb[0]), px(jb[3], 'y'),
                                      px(jb[2]) - px(jb[0]), px(jb[1], 'y') - px(jb[3], 'y')))

    # 글자
    g.append('<g fill="#e6e2d8" fill-rule="evenodd" transform="scale(%.6f) translate(0,830) scale(1,-1)">'
             '<path d="%s"/></g>' % (K, render.path(ch, ST)))

    # 기둥·줄기 표시선
    for e in L['jung']:
        if e[0] == 'stem':
            _, x, a, b = e
            g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#c33c1e" '
                     'stroke-width="1"/>' % (px(x), px(b, 'y') - 10, px(x), px(a, 'y') + 10))
        elif e[0] == 'bar':
            _, a, b, y = e
            g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#4a9d7f" '
                     'stroke-width="1"/>' % (px(a) - 8, px(y, 'y'), px(b) + 8, px(y, 'y')))
    return ('<svg width="%.1f" height="%.1f" viewBox="0 0 %.1f %.1f">%s</svg>'
            % (W, H, W, H, ''.join(g)))


CASES = [
    ('뭬', 'ㅁ + ㅞ — 기둥 둘이 끝까지 서고, ㅜ 의 가로줄기는 곁줄기 앞에서 끊긴다'),
    ('과', 'ㄱ + ㅘ — 초성은 가로줄기 위 왼쪽에, 기둥은 오른쪽 끝까지'),
    ('간', 'ㄱ + ㅏ + ㄴ — 받침이 들어오면 기둥 아래가 열린다'),
    ('곤', 'ㄱ + ㅗ + ㄴ — 세로모임. 초성이 납작해지고 셋이 위아래로 쌓인다'),
]


def page():
    cells = ''.join(
        '<figure><div class="d">%s</div><figcaption><b>%s</b>%s</figcaption></figure>'
        % (diagram(ch), ch, why) for ch, why in CASES)
    return """<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Azeret+Mono:wght@400&family=IBM+Plex+Sans+KR:wght@300;400&display=swap" rel="stylesheet">
<style>
 *{box-sizing:border-box;border-radius:0}
 body{margin:0;background:#141311;color:#e6e2d8;padding:30px 40px 40px;
      font-family:'Azeret Mono','IBM Plex Sans KR',monospace;font-size:12px}
 h1{margin:0 0 6px;font-size:14px;font-weight:400;letter-spacing:.06em}
 .key{color:#8b857a;font-size:11px;margin:0 0 24px}
 .key i{font-style:normal;padding:1px 6px;margin-right:4px}
 .k1{background:rgba(195,60,30,.3)} .k2{background:rgba(74,127,181,.3)}
 .k3{color:#c33c1e} .k4{color:#4a9d7f}
 .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:26px}
 figure{margin:0}
 .d{border:1px solid #221f1c;padding:8px}
 figcaption{margin-top:8px;color:#8b857a;font-size:11px;line-height:1.6}
 figcaption b{display:block;color:#e6e2d8;font-size:13px;font-weight:400;margin-bottom:3px}
 svg{display:block;width:100%;height:auto}
</style></head><body>
<h1>짜임 해부도</h1>
<p class="key"><i class="k1">&nbsp;</i>초성 자리 &nbsp; <i class="k2">&nbsp;</i>종성 자리 &nbsp;
<span class="k3">━ 기둥</span> &nbsp; <span class="k4">━ 가로줄기·곁줄기</span> &nbsp; · 점선은 글자틀</p>
<div class="g">""" + cells + "</div></body></html>"


if __name__ == '__main__':
    o = sys.argv[1] if len(sys.argv) > 1 else 'diagram.html'
    with io.open(o, 'w', encoding='utf-8') as f:
        f.write(page())
    print('wrote', o)
