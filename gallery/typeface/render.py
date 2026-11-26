# -*- coding: utf-8 -*-
"""새 짜임으로 음절을 그린다. hangul.layout 의 자리표를 획으로 옮긴다."""

import hangul, jamo, outline

# 자폭. Pretendard 의 한글은 em 의 0.864 를 쓴다 (1770/2048). 1em 을 꽉 채우면
# 같은 글자 크기에서 글자가 더 크고 글줄이 더 벌어져 읽기 나쁘다.
ADVANCE = 880
SPACE = 300                            # 띄어쓰기 자폭

# hangul.py 의 좌표는 모두 '자폭에 대한 비율' 이다. 가로도 세로도 같은 단위.


def _fx(t):
    return t * ADVANCE


def _fy(t):
    return t * ADVANCE


def _box(rel):
    return (_fx(rel[0]), _fy(rel[1]), _fx(rel[2]), _fy(rel[3]))


def advance(ch):
    return SPACE if ch == ' ' else ADVANCE


def syllable(ch, st):
    """(다각형, 베지에). 합치기는 glyph() 가 한다."""
    L = hangul.layout(ch)
    if not L:
        return [], []
    P, B = [], []
    w = st['w']
    hw = w * st.get('hw', 1.0)

    # 초성
    cho, cbox = L['cho']
    p, b = jamo.draw(cho, _box(cbox), st)
    P.extend(p); B.extend(b)

    # 중성 — 기둥·곁줄기·짧은기둥
    for e in L['jung']:
        if e[0] == 'stem':
            _, x, y0, y1 = e
            P.append(jamo.vbar(_fx(x), _fy(y0), _fy(y1), w))
        elif e[0] == 'bar':
            _, x0, x1, y = e
            P.append(jamo.hbar(_fx(x0), _fx(x1), _fy(y), w, st))
        elif e[0] == 'tick':
            _, x, y0, y1 = e
            P.append(jamo.vbar(_fx(x), _fy(y0), _fy(y1), w))

    # 종성
    if L['jong']:
        jong, jbox = L['jong']
        p, b = jamo.draw(jong, _box(jbox), st)
        P.extend(p); B.extend(b)

    return P, B


def glyph(ch, st):
    P, B = syllable(ch, st)
    return outline.treat(outline.union(P), st), B


def path(ch, st):
    c, b = glyph(ch, st)
    return outline.to_svg_path(c, b)


def bounds(ch, st):
    c, b = glyph(ch, st)
    xs = [x for ct in c for x, _ in ct] + [p[0] for bz in b for cm in bz for p in cm[1:]]
    ys = [y for ct in c for _, y in ct] + [p[1] for bz in b for cm in bz for p in cm[1:]]
    return (min(xs), min(ys), max(xs), max(ys)) if xs else None
