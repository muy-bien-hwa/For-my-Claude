# -*- coding: utf-8 -*-
"""견본지 — 네 가지 성격을 같은 문장으로 나란히 찍는다."""

import compose, jamo

UPM = 1000.0


def glyph_path(ch, st):
    if ch == ' ':
        return ''
    polys = compose.syllable(ch, st)
    if not polys:
        polys = compose.jamo_letter(ch, st)
    if not polys:
        return ''
    out = []
    for p in polys:
        out.append('M' + ' '.join('%.1f %.1f' % (x, y) for x, y in p) + 'Z')
    return ''.join(out)


def line_svg(text, st, size, color='currentColor'):
    """한 줄을 SVG 로. 글자는 advance 만큼 띄워 앉힌다."""
    adv = st['advance']
    k = size / UPM
    width = len(text) * adv * k
    parts = []
    for i, ch in enumerate(text):
        d = glyph_path(ch, st)
        if not d:
            continue
        parts.append('<path d="%s" transform="translate(%.2f 0)"/>' % (d, i * adv))
    # 받침이 기준선 아래로 내려가는 성격이 있어 아래쪽을 넉넉히 연다
    top, bot = 820, -300
    h = (top - bot) * k
    return ('<svg class="sp" width="%.1f" height="%.1f" viewBox="%.1f %.1f %.1f %.1f" '
            'fill="%s" fill-rule="evenodd" aria-label="%s">%s</svg>'
            % (width, h, 0, -top, len(text) * adv, top - bot, color, text,
               '<g transform="scale(1 -1)">' + ''.join(parts) + '</g>'))


SAMPLES = [
    ('머리글', '인터랙티브', 86),
    ('', '웹 디자인 모음', 86),
    ('작품 제목', '표류 분절 망점 궤도 적층 결절', 34),
    ('작은 라벨', '생성 캔버스 커서 타이포 스크롤 레이아웃', 13),
    ('까다로운 글자', '꽃 밟 읽 왜 쉼 흙 값 닭 뷁 쭉', 34),
]


def page():
    blocks = []
    for key in ['modular', 'decon', 'hairline', 'heavy']:
        st = compose.STYLES[key]
        rows = []
        for label, text, size in SAMPLES:
            rows.append('<div class="row"><span class="rl">%s</span>'
                        '<div class="rv">%s</div></div>'
                        % (label, line_svg(text, st, size)))
        blocks.append(
            '<section class="blk"><header class="bh">'
            '<span class="bn">%s</span><span class="bk">%s</span>'
            '<span class="bnote">%s</span></header>%s</section>'
            % (st['name'], key, st['note'], ''.join(rows)))

    return """<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Azeret+Mono:wght@400&family=IBM+Plex+Sans+KR:wght@300;400&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;border-radius:0}
  body{margin:0;background:#141311;color:#e6e2d8;
       font-family:'Azeret Mono','IBM Plex Sans KR',monospace;font-size:12px}
  .blk{padding:34px 44px 40px;border-bottom:1px solid #2b2824}
  .bh{display:flex;align-items:baseline;gap:16px;padding-bottom:22px;margin-bottom:26px;
      border-bottom:1px solid #2b2824}
  .bn{font-size:15px}
  .bk{color:#c33c1e;font-size:10.5px;letter-spacing:.1em}
  .bnote{color:#8b857a;font-size:11px;margin-left:auto}
  .row{display:grid;grid-template-columns:7rem 1fr;gap:20px;align-items:center;
       padding:9px 0}
  .rl{color:#55514a;font-size:10px;letter-spacing:.1em;padding-top:4px}
  .rv{min-width:0;overflow:hidden}
  .sp{display:block;max-width:100%;height:auto}
</style></head><body>""" + ''.join(blocks) + "</body></html>"


if __name__ == '__main__':
    import io, sys
    out = sys.argv[1] if len(sys.argv) > 1 else 'specimen.html'
    with io.open(out, 'w', encoding='utf-8') as f:
        f.write(page())
    print('wrote', out)
