# -*- coding: utf-8 -*-
"""자모 기하 — 한글 낱자를 획으로 긋는다.

좌표는 em 1000 단위, 기준선 y=0, 위가 +.

이전 판과 달라진 점
  · 획은 이음매에서 반드시 겹치게 긋는다. 합집합을 구해 윤곽 하나로
    만들기 때문에, 겹쳐야 군더더기 없이 이어진다.
  · ㅇ·ㅎ의 고리는 다각형이 아니라 참된 원(베지에)이다.
  · 가로획은 세로획보다 살짝 얇다. 같은 굵기로 그으면 가로가 더 두꺼워
    보인다 (광학 보정).
  · ㅅ·ㅈ·ㅊ의 사선은 꼭지 위로 넘겨 그은 뒤 상자로 잘라낸다. 그래야
    꼭지에 틈이나 가시가 남지 않는다.

draw() 는 (직선 다각형 목록, 베지에 경로 목록) 을 돌려준다.
"""

from math import hypot
import outline

OVER = 1.6    # 이음매에서 획을 더 밀어 넣는 양 (겹치게 만든다)


def _w(st):
    return st['w']


def hbar(x0, x1, y, w, st):
    h = w * st.get('hw', 1.0) / 2.0
    return [(x0, y - h), (x1, y - h), (x1, y + h), (x0, y + h)]


def vbar(x, y0, y1, w, st=None):
    h = w / 2.0
    return [(x - h, y0), (x + h, y0), (x + h, y1), (x - h, y1)]


def diag(p0, p1, w, ext=0.0):
    """두 점을 잇는 사선. ext 만큼 양쪽으로 늘여 긋는다."""
    (ax, ay), (bx, by) = p0, p1
    dx, dy = bx - ax, by - ay
    L = hypot(dx, dy) or 1.0
    ux, uy = dx / L, dy / L
    ax, ay = ax - ux * ext, ay - uy * ext
    bx, by = bx + ux * ext, by + uy * ext
    nx, ny = -uy * w / 2.0, ux * w / 2.0
    return [(ax + nx, ay + ny), (bx + nx, by + ny), (bx - nx, by - ny), (ax - nx, ay - ny)]


def _ring_radii(bw, bh, st):
    """ㅇ 의 반지름. 상자가 납작해도 고리는 원에 가깝게 유지한다.

    round 가 1 이면 참된 원, 0 이면 상자를 그대로 채운다. 한글의 ㅇ 은
    가로가 아주 조금 넓은 쪽이 자연스러워 1.04 : 0.98 로 둔다.
    """
    k = st.get('ring_round', 0.82)
    r = min(bw, bh) / 2
    rx = (bw / 2) * (1 - k) + (r * 1.04) * k
    ry = (bh / 2) * (1 - k) + (r * 0.98) * k
    return rx, ry


def _frame(box, st):
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    w = min(st['w'], bh * 0.46, bw * 0.46)
    return (lambda t: x0 + t * bw), (lambda t: y0 + t * bh), w, bw, bh


# ── 자음 ───────────────────────────────────────────────────────────
def c_giyeok(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    return [hbar(X(0), X(1), Y(1) - w * st.get('hw', 1) / 2, w, st),
            vbar(X(1) - w / 2, Y(0), Y(1), w)], []


def c_nieun(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    return [vbar(X(0) + w / 2, Y(0), Y(1), w),
            hbar(X(0), X(1), Y(0) + w * st.get('hw', 1) / 2, w, st)], []


def c_digeut(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    hw = w * st.get('hw', 1) / 2
    return [hbar(X(0), X(1), Y(1) - hw, w, st),
            vbar(X(0) + w / 2, Y(0), Y(1), w),
            hbar(X(0), X(1), Y(0) + hw, w, st)], []


def c_rieul(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    hw = w * st.get('hw', 1) / 2
    m = 0.5
    return [hbar(X(0), X(1), Y(1) - hw, w, st),
            vbar(X(1) - w / 2, Y(m) - OVER, Y(1), w),
            hbar(X(0), X(1), Y(m), w, st),
            vbar(X(0) + w / 2, Y(0), Y(m) + OVER, w),
            hbar(X(0), X(1), Y(0) + hw, w, st)], []


def c_mieum(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    hw = w * st.get('hw', 1) / 2
    return [hbar(X(0), X(1), Y(1) - hw, w, st),
            hbar(X(0), X(1), Y(0) + hw, w, st),
            vbar(X(0) + w / 2, Y(0), Y(1), w),
            vbar(X(1) - w / 2, Y(0), Y(1), w)], []


def c_bieup(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    hw = w * st.get('hw', 1) / 2
    return [vbar(X(0) + w / 2, Y(0), Y(1), w),
            vbar(X(1) - w / 2, Y(0), Y(1), w),
            hbar(X(0), X(1), Y(0.46), w, st),
            hbar(X(0), X(1), Y(0) + hw, w, st)], []


def c_siot(box, st):
    """사선 둘을 꼭지 위로 넘겨 그은 뒤 상자로 잘라 평평한 꼭지를 만든다.

    spread 가 +면 다리를 넓게 벌리고, -면 가파르게 세운다.
    """
    X, Y, w, bw, bh = _frame(box, st)
    sp = st.get('siot_spread', 0.0)
    apex = (X(0.5), Y(1))
    polys = [diag(apex, (X(0.03 - sp), Y(0)), w, ext=w * 0.9),
             diag(apex, (X(0.97 + sp), Y(0)), w, ext=w * 0.9)]
    # 자르는 선은 반드시 제 상자여야 한다. 밖에 두면 다리가 상자를 뚫고 나간다.
    return _clip(polys, (X(0), Y(0), X(1), Y(1))), []


def c_ieung(box, st):
    """ㅇ. ring_inset 만큼 상자에서 물러나면 또렷한 점처럼, 0 이면 네모를 꽉 채운다."""
    X, Y, w, bw, bh = _frame(box, st)
    o = st.get('overshoot', 0.0) * bh       # 원은 네모보다 조금 커야 같아 보인다
    ins = st.get('ring_inset', 0.0)
    rx, ry = _ring_radii(bw, bh, st)
    return [], list(outline.circle_contours(X(0.5), Y(0.5),
                                            rx * (1 - ins) + o,
                                            ry * (1 - ins) + o, w))


def c_jieut(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    hw = w * st.get('hw', 1) / 2
    top = [hbar(X(0), X(1), Y(1) - hw, w, st)]
    legs, _ = c_siot((box[0], box[1], box[2], Y(1) - hw * 0.4), st)
    return top + legs, []


def c_chieut(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    hw = w * st.get('hw', 1) / 2
    bar_y = Y(0.80)
    out = [vbar(X(0.5), bar_y - OVER, Y(1), w),          # 점은 획에 닿게
           hbar(X(0), X(1), bar_y, w, st)]
    legs, _ = c_siot((box[0], box[1], box[2], bar_y - hw * 0.4), st)
    return out + legs, []


def c_kiyeok(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    bars, _ = c_giyeok(box, st)
    return bars + [hbar(X(0), X(1), Y(0.48), w, st)], []


def c_tieut(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    bars, _ = c_digeut(box, st)
    return bars + [hbar(X(0), X(1), Y(0.5), w, st)], []


def c_pieup(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    hw = w * st.get('hw', 1) / 2
    return [hbar(X(0), X(1), Y(1) - hw, w, st),
            hbar(X(0), X(1), Y(0) + hw, w, st),
            vbar(X(0.27), Y(0), Y(1), w),
            vbar(X(0.73), Y(0), Y(1), w)], []


def c_hieut(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    bar_y = Y(0.82)
    o = st.get('overshoot', 0.0) * bh
    ins = st.get('ring_inset', 0.0)
    rh = bar_y - w * 0.8 - Y(0)
    rx, ry = _ring_radii(bw, rh, st)
    rx *= (1 - ins * 0.6); ry *= (1 - ins * 0.6)
    cy = Y(0) + rh / 2
    ring = outline.circle_contours(X(0.5), cy, rx + o, ry + o, w)
    return ([vbar(X(0.5), bar_y - OVER, Y(1), w),
             hbar(X(0), X(1), bar_y, w, st)], list(ring))


# ── 모음 ───────────────────────────────────────────────────────────
def v_a(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    return [vbar(X(0.30), Y(0), Y(1), w),
            hbar(X(0.30) - OVER, X(1), Y(0.52), w, st)], []


def v_ya(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    return [vbar(X(0.30), Y(0), Y(1), w),
            hbar(X(0.30) - OVER, X(1), Y(0.66), w, st),
            hbar(X(0.30) - OVER, X(1), Y(0.34), w, st)], []


def v_eo(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    return [vbar(X(0.70), Y(0), Y(1), w),
            hbar(X(0), X(0.70) + OVER, Y(0.52), w, st)], []


def v_yeo(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    return [vbar(X(0.70), Y(0), Y(1), w),
            hbar(X(0), X(0.70) + OVER, Y(0.66), w, st),
            hbar(X(0), X(0.70) + OVER, Y(0.34), w, st)], []


def v_i(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    return [vbar(X(0.5), Y(0), Y(1), w)], []


def v_o(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    hw = w * st.get('hw', 1) / 2
    return [hbar(X(0), X(1), Y(0) + hw, w, st),
            vbar(X(0.5), Y(0), Y(1), w)], []


def v_yo(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    hw = w * st.get('hw', 1) / 2
    return [hbar(X(0), X(1), Y(0) + hw, w, st),
            vbar(X(0.34), Y(0), Y(1), w),
            vbar(X(0.66), Y(0), Y(1), w)], []


def v_u(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    hw = w * st.get('hw', 1) / 2
    return [hbar(X(0), X(1), Y(1) - hw, w, st),
            vbar(X(0.5), Y(0), Y(1), w)], []


def v_yu(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    hw = w * st.get('hw', 1) / 2
    return [hbar(X(0), X(1), Y(1) - hw, w, st),
            vbar(X(0.34), Y(0), Y(1), w),
            vbar(X(0.66), Y(0), Y(1), w)], []


def v_eu(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    return [hbar(X(0), X(1), Y(0.5), w, st)], []


def _clip(polys, rect):
    """상자 바깥으로 넘긴 획을 잘라낸다."""
    import pyclipper
    S = outline.SCALE
    x0, y0, x1, y1 = rect
    box = [(int(x0 * S), int(y0 * S)), (int(x1 * S), int(y0 * S)),
           (int(x1 * S), int(y1 * S)), (int(x0 * S), int(y1 * S))]
    pc = pyclipper.Pyclipper()
    pc.AddPaths([[(int(round(x * S)), int(round(y * S))) for x, y in p] for p in polys],
                pyclipper.PT_SUBJECT, True)
    pc.AddPath(box, pyclipper.PT_CLIP, True)
    sol = pc.Execute(pyclipper.CT_INTERSECTION, pyclipper.PFT_NONZERO, pyclipper.PFT_NONZERO)
    return [[(x / S, y / S) for x, y in c] for c in sol]


SHAPES = {
    'ㄱ': c_giyeok, 'ㄴ': c_nieun, 'ㄷ': c_digeut, 'ㄹ': c_rieul, 'ㅁ': c_mieum,
    'ㅂ': c_bieup, 'ㅅ': c_siot, 'ㅇ': c_ieung, 'ㅈ': c_jieut, 'ㅊ': c_chieut,
    'ㅋ': c_kiyeok, 'ㅌ': c_tieut, 'ㅍ': c_pieup, 'ㅎ': c_hieut,
    'ㅏ': v_a, 'ㅑ': v_ya, 'ㅓ': v_eo, 'ㅕ': v_yeo, 'ㅣ': v_i,
    'ㅗ': v_o, 'ㅛ': v_yo, 'ㅜ': v_u, 'ㅠ': v_yu, 'ㅡ': v_eu,
}

PAIRS = {
    'ㄲ': ('ㄱ', 'ㄱ'), 'ㄸ': ('ㄷ', 'ㄷ'), 'ㅃ': ('ㅂ', 'ㅂ'),
    'ㅆ': ('ㅅ', 'ㅅ'), 'ㅉ': ('ㅈ', 'ㅈ'),
    'ㄳ': ('ㄱ', 'ㅅ'), 'ㄵ': ('ㄴ', 'ㅈ'), 'ㄶ': ('ㄴ', 'ㅎ'),
    'ㄺ': ('ㄹ', 'ㄱ'), 'ㄻ': ('ㄹ', 'ㅁ'), 'ㄼ': ('ㄹ', 'ㅂ'),
    'ㄽ': ('ㄹ', 'ㅅ'), 'ㄾ': ('ㄹ', 'ㅌ'), 'ㄿ': ('ㄹ', 'ㅍ'),
    'ㅀ': ('ㄹ', 'ㅎ'), 'ㅄ': ('ㅂ', 'ㅅ'),
}

COMPOUND_V = {
    'ㅐ': ('ㅏ', 'ㅣ'), 'ㅒ': ('ㅑ', 'ㅣ'), 'ㅔ': ('ㅓ', 'ㅣ'), 'ㅖ': ('ㅕ', 'ㅣ'),
    'ㅘ': ('ㅗ', 'ㅏ'), 'ㅙ': ('ㅗ', 'ㅐ'), 'ㅚ': ('ㅗ', 'ㅣ'),
    'ㅝ': ('ㅜ', 'ㅓ'), 'ㅞ': ('ㅜ', 'ㅔ'), 'ㅟ': ('ㅜ', 'ㅣ'), 'ㅢ': ('ㅡ', 'ㅣ'),
}


def draw(key, box, st, gap=0.12):
    """낱자 하나. (다각형, 베지에) 를 돌려준다."""
    if key in PAIRS:
        a, b = PAIRS[key]
        x0, y0, x1, y1 = box
        g = (x1 - x0) * gap
        half = (x1 - x0 - g) / 2
        pa, ba = draw(a, (x0, y0, x0 + half, y1), st)
        pb, bb = draw(b, (x1 - half, y0, x1, y1), st)
        return pa + pb, ba + bb
    fn = SHAPES.get(key)
    return fn(box, st) if fn else ([], [])
