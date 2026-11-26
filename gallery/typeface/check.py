# -*- coding: utf-8 -*-
"""전수 검사 — 먹물이 실제로 겹치거나 너무 붙는지 기하로 잰다.

상자(bbox)로 재면 '고' 의 ㄱ 과 ㅗ 의 짧은기둥처럼 상자만 겹치고 먹물은
닿지 않는 경우를 모두 잡아내 쓸모가 없다. 다각형 교집합으로 본다.
"""
import sys
import pyclipper
import hangul as H, render, compose, jamo, outline

ST = dict(compose.STYLES['plain']); ST['detail'] = None
S = outline.SCALE


def _ip(polys):
    return [[(int(round(x * S)), int(round(y * S))) for x, y in p] for p in polys if len(p) >= 3]


def _grow(polys, d):
    """다각형을 d 만큼 부풀린다. 가까움을 재려고 쓴다."""
    if d <= 0:
        return _ip(polys)
    co = pyclipper.PyclipperOffset()
    co.AddPaths(_ip(polys), pyclipper.JT_MITER, pyclipper.ET_CLOSEDPOLYGON)
    return co.Execute(d * S)


def _hits(a, b):
    if not a or not b:
        return 0.0
    pc = pyclipper.Pyclipper()
    pc.AddPaths(a, pyclipper.PT_SUBJECT, True)
    pc.AddPaths(b, pyclipper.PT_CLIP, True)
    sol = pc.Execute(pyclipper.CT_INTERSECTION, pyclipper.PFT_NONZERO, pyclipper.PFT_NONZERO)
    return sum(abs(pyclipper.Area(p)) for p in sol) / (S * S)


def groups(ch):
    """초성 / 중성 / 종성 의 다각형 덩어리."""
    L = H.layout(ch)
    cho, cb = L['cho']
    cp, _ = jamo.draw(cho, render._box(cb), ST)
    jp = []
    for e in L['jung']:
        if e[0] in ('stem', 'tick'):
            _, x, y0, y1 = e
            jp.append(jamo.vbar(render._fx(x), render._fy(y0), render._fy(y1), ST['w']))
        else:
            _, x0, x1, y = e
            jp.append(jamo.hbar(render._fx(x0), render._fx(x1), render._fy(y), ST['w'], ST))
    gp = []
    if L['jong']:
        jg, jb = L['jong']
        gp, _ = jamo.draw(jg, render._box(jb), ST)
    return cp, jp, gp


def run(near=None, limit=None):
    near = ST['w'] * 0.55 if near is None else near     # 이만큼은 떨어져 있어야 한다
    overlap, tooclose, outside = [], [], []
    codes = range(0xAC00, 0xD7A4)
    if limit:
        codes = list(codes)[::max(1, 11172 // limit)]
    for code in codes:
        ch = chr(code)
        cp, jp, gp = groups(ch)
        ci, ji, gi = _ip(cp), _ip(jp), _ip(gp)
        for a, b, tag in ((ci, ji, '초성↔중성'), (ci, gi, '초성↔종성'), (ji, gi, '중성↔종성')):
            if a and b and _hits(a, b) > 1.0:
                overlap.append((ch, tag))
        cg, jg2, gg = _grow(cp, near / 2), _grow(jp, near / 2), _grow(gp, near / 2)
        for a, b, tag in ((cg, jg2, '초성↔중성'), (cg, gg, '초성↔종성'), (jg2, gg, '중성↔종성')):
            if a and b and _hits(a, b) > 1.0:
                tooclose.append((ch, tag))
        bb = render.bounds(ch, ST)
        if bb and (bb[0] < -2 or bb[2] > render.ADVANCE + 2):
            outside.append(ch)
    n = len(list(codes))
    print('검사 %d자' % n)
    print('  먹물이 실제로 겹침 : %d' % len(overlap), [c for c, _ in overlap[:12]])
    print('  %.0f em 보다 가까움 : %d' % (near, len(tooclose)), [c for c, _ in tooclose[:12]])
    print('  자폭 이탈          : %d' % len(outside), outside[:10])
    return overlap, tooclose


if __name__ == '__main__':
    lim = int(sys.argv[1]) if len(sys.argv) > 1 else None
    run(limit=lim)
