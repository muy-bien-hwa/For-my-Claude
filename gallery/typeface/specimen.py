# -*- coding: utf-8 -*-
"""모노라인 견본지 — 디테일 가공 셋을 같은 글자로 나란히 견준다."""

import io, sys, compose, outline

UPM = 1000.0
KEYS = ['trap', 'chamfer', 'slant', 'plain']


def glyph_d(ch, st):
    if ch == ' ':
        return ''
    c, b = compose.glyph(ch, st)
    return outline.to_svg_path(c, b)


def line_svg(text, st, size, cls='sp'):
    adv = st['advance']
    k = size / UPM
    parts = []
    for i, ch in enumerate(text):
        d = glyph_d(ch, st)
        if d:
            parts.append('<path d="%s" transform="translate(%.2f 0)"/>' % (d, i * adv))
    top, bot = 830, -150
    return ('<svg class="%s" width="%.1f" height="%.1f" viewBox="0 %.1f %.1f %.1f" '
            'fill="currentColor" fill-rule="evenodd" aria-label="%s">'
            '<g transform="scale(1 -1)">%s</g></svg>'
            % (cls, len(text) * adv * k, (top - bot) * k, -top,
               len(text) * adv, top - bot, text, ''.join(parts)))


# 가공이 드러나는 글자들
ZOOM = [
    ('릴', '이음매 — ㄹ 의 꺾임이 네 번 겹친다'),
    ('웅', '고리 — ㅇ 의 크기와 받침 폭'),
    ('촛', '사선 — ㅊ 의 점·획·다리'),
]
SAMPLES = [
    ('머리글', '인터랙티브 웹', 74),
    ('작품 제목', '표류 분절 망점 궤도 적층 결절', 32),
    ('까다로운 글자', '꽃 밟 읽 왜 쉼 흙 값 닭 쭉 뷁', 32),
    ('작은 라벨', '생성 캔버스 커서 타이포 스크롤 레이아웃 · 전체 앨범 목록', 12),
]


def page():
    out = []

    # ── 1부. 같은 글자를 네 변형 나란히 크게 ──────────────────────
    out.append('<section class="cmp"><header class="bh">'
               '<span class="bn">가공 비교</span>'
               '<span class="bnote">같은 글자를 네 가지로. 맨 오른쪽이 가공하지 않은 대조군.</span>'
               '</header>')
    for ch, why in ZOOM:
        cells = ''.join(
            '<div class="z"><span class="zk">%s</span>%s</div>'
            % (compose.STYLES[k]['name'], line_svg(ch, compose.STYLES[k], 300, 'sp'))
            for k in KEYS)
        out.append('<div class="zrow"><p class="why">%s</p><div class="zg">%s</div></div>'
                   % (why, cells))
    out.append('</section>')

    # ── 2부. 변형마다 실제 쓰임새 ────────────────────────────────
    for key in KEYS:
        st = compose.STYLES[key]
        rows = ''.join(
            '<div class="row"><span class="rl">%s</span><div class="rv">%s</div></div>'
            % (label, line_svg(text, st, size))
            for label, text, size in SAMPLES)
        out.append('<section class="blk"><header class="bh">'
                   '<span class="bn">%s</span><span class="bk">%s</span>'
                   '<span class="bnote">%s</span></header>%s</section>'
                   % (st['name'], key, st['note'], rows))

    return """<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Azeret+Mono:wght@400&family=IBM+Plex+Sans+KR:wght@300;400&display=swap" rel="stylesheet">
<style>
 *{box-sizing:border-box;border-radius:0}
 body{margin:0;background:#141311;color:#e6e2d8;
      font-family:'Azeret Mono','IBM Plex Sans KR',monospace;font-size:12px}
 section{padding:30px 44px 36px;border-bottom:1px solid #2b2824}
 .bh{display:flex;align-items:baseline;gap:16px;padding-bottom:16px;margin-bottom:22px;
     border-bottom:1px solid #2b2824}
 .bn{font-size:16px}
 .bk{color:#c33c1e;font-size:10.5px;letter-spacing:.1em}
 .bnote{color:#8b857a;font-size:11px;margin-left:auto;max-width:58ch;text-align:right}
 .zrow{padding:6px 0 22px}
 .why{margin:0 0 10px;color:#55514a;font-size:10.5px;letter-spacing:.06em}
 .zg{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
 .z{border:1px solid #221f1c;padding:10px 12px 4px}
 .z:last-child{border-color:#2b2824;opacity:.62}
 .zk{display:block;color:#8b857a;font-size:10px;letter-spacing:.1em;margin-bottom:4px}
 .row{display:grid;grid-template-columns:7rem 1fr;gap:20px;align-items:center;padding:8px 0}
 .rl{color:#55514a;font-size:10px;letter-spacing:.1em}
 .rv{min-width:0;overflow:hidden}
 svg.sp{display:block;max-width:100%;height:auto}
</style></head><body>""" + ''.join(out) + "</body></html>"


if __name__ == '__main__':
    o = sys.argv[1] if len(sys.argv) > 1 else 'specimen.html'
    with io.open(o, 'w', encoding='utf-8') as f:
        f.write(page())
    print('wrote', o)
