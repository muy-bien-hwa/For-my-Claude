# -*- coding: utf-8 -*-
"""옛 짜임과 새 짜임을 나란히 찍는다."""
import io, sys, compose, render, outline

UPM = 1000.0
ST = dict(compose.STYLES['plain']); ST['detail'] = None


def svg(d, size, adv=1000, cls='g'):
    top, bot = 830, -130
    return ('<svg class="%s" width="%.1f" height="%.1f" viewBox="0 %.1f %.1f %.1f" '
            'fill="currentColor" fill-rule="evenodd"><g transform="scale(1 -1)">'
            '<path d="%s"/></g></svg>'
            % (cls, adv * size / UPM, (top - bot) * size / UPM, -top, adv, top - bot, d))


def old_d(ch):
    c, b = compose.glyph(ch, ST)
    return outline.to_svg_path(c, b)


def new_d(ch):
    return render.path(ch, ST)


GROUPS = [
    ('섞임모임 — 문제의 핵심', '뭬 궤 웨 쉐 왜 과 의 귀 돼 뇌'),
    ('ㅅ·ㅈ·ㅊ 받침 — 삐져나오던 자리', '삿 촛 좃 밫 읏 닻'),
    ('기본 여섯 짜임', '가 고 구 간 곤 권'),
    ('두 기둥 모음', '개 게 걔 계 괘 꿰'),
]


def page():
    out = []
    for title, chars in GROUPS:
        rows = []
        for ch in chars.split():
            rows.append(
                '<div class="pair"><span class="ch">%s</span>'
                '<div class="side old"><span class="t">옛</span>%s</div>'
                '<div class="side new"><span class="t">새</span>%s</div></div>'
                % (ch, svg(old_d(ch), 150), svg(new_d(ch), 150)))
        out.append('<section><h2>%s</h2><div class="grid">%s</div></section>'
                   % (title, ''.join(rows)))

    return """<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Azeret+Mono:wght@400&family=IBM+Plex+Sans+KR:wght@300;400&display=swap" rel="stylesheet">
<style>
 *{box-sizing:border-box;border-radius:0}
 body{margin:0;background:#141311;color:#e6e2d8;
      font-family:'Azeret Mono','IBM Plex Sans KR',monospace;font-size:12px;padding:0 0 30px}
 section{padding:26px 40px 30px;border-bottom:1px solid #2b2824}
 h2{margin:0 0 20px;font-size:12px;font-weight:400;letter-spacing:.08em;color:#c33c1e}
 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:22px}
 .pair{display:grid;grid-template-columns:2.2rem 1fr 1fr;gap:8px;align-items:start}
 .ch{color:#55514a;font-size:11px;padding-top:6px}
 .side{border:1px solid #221f1c;padding:4px 6px 0}
 .side .t{display:block;font-size:9px;letter-spacing:.1em;color:#55514a;margin-bottom:2px}
 .old{color:#7d7870}
 .new{color:#e6e2d8;border-color:#3a352f}
 svg.g{display:block;width:100%;height:auto}
</style></head><body>""" + ''.join(out) + "</body></html>"


if __name__ == '__main__':
    o = sys.argv[1] if len(sys.argv) > 1 else 'compare.html'
    with io.open(o, 'w', encoding='utf-8') as f:
        f.write(page())
    print('wrote', o)
