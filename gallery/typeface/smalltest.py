# -*- coding: utf-8 -*-
"""작은 크기 가독성 비교 — '전부 자체 폰트' 로 갈지 판단하는 핵심 자료."""
import io, sys, compose, specimen

LABEL = '생성 캔버스 커서 타이포 스크롤 레이아웃'
BAR = '전체 앨범 목록 공개 정보 기법 연도'
SIZES = [10, 11, 13, 16]
KEYS = ['modular', 'decon', 'hairline', 'heavy']

rows = []
for size in SIZES:
    cells = []
    for key in KEYS:
        st = compose.STYLES[key]
        cells.append('<div class="c"><span class="k">%s</span>%s%s</div>'
                     % (st['name'],
                        specimen.line_svg(LABEL, st, size),
                        specimen.line_svg(BAR, st, size)))
    # 비교 대상: 지금 쓰는 기성 폰트
    cells.append('<div class="c ref"><span class="k">지금 (Plex Sans KR)</span>'
                 '<p style="font-size:%dpx">%s</p><p style="font-size:%dpx">%s</p></div>'
                 % (size, LABEL, size, BAR))
    rows.append('<section><h2>%dpx</h2><div class="g">%s</div></section>'
                % (size, ''.join(cells)))

html = """<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Azeret+Mono:wght@400&family=IBM+Plex+Sans+KR:wght@300;400&display=swap" rel="stylesheet">
<style>
 *{box-sizing:border-box;border-radius:0}
 body{margin:0;background:#141311;color:#e6e2d8;font-family:'Azeret Mono','IBM Plex Sans KR',monospace;padding:30px 40px 44px}
 section{padding:18px 0 24px;border-bottom:1px solid #2b2824}
 h2{margin:0 0 16px;font-size:11px;letter-spacing:.14em;color:#c33c1e;font-weight:400}
 .g{display:grid;gap:26px}
 .c{display:grid;gap:5px}
 .k{font-size:9.5px;letter-spacing:.1em;color:#55514a}
 .ref p{margin:0;color:#e6e2d8;font-family:'IBM Plex Sans KR',sans-serif;line-height:1.5}
 svg.sp{display:block}
</style></head><body>""" + ''.join(rows) + "</body></html>"

out = sys.argv[1] if len(sys.argv) > 1 else 'small.html'
with io.open(out, 'w', encoding='utf-8') as f:
    f.write(html)
print('wrote', out)
