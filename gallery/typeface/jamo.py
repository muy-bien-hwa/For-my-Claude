# -*- coding: utf-8 -*-
"""자모 기하 — 한글 낱자를 주어진 상자 안에 획으로 그린다.

좌표는 em 1000 단위, 기준선(baseline) y=0, 위가 +.
획 굵기 w 는 상자 크기와 무관한 절대값이라 어느 자리에 놓여도 굵기가 같다.

낱자는 33종만 그린다. 쌍자음과 겹받침, 복합모음은 이 33종을 좌우로
눌러 담아 만든다. 조합형 폰트가 쓰는 방식이다.
"""

from math import cos, sin, pi


# ── 획 ─────────────────────────────────────────────────────────────
def hbar(x0, x1, y, w):
    """y 를 중심선으로 하는 가로 획."""
    h = w / 2.0
    return [(x0, y - h), (x1, y - h), (x1, y + h), (x0, y + h)]


def vbar(x, y0, y1, w):
    """x 를 중심선으로 하는 세로 획."""
    h = w / 2.0
    return [(x - h, y0), (x + h, y0), (x + h, y1), (x - h, y1)]


def diag(p0, p1, w):
    """두 점을 잇는 사선 획. 끝은 직각으로 자른다."""
    (ax, ay), (bx, by) = p0, p1
    dx, dy = bx - ax, by - ay
    L = (dx * dx + dy * dy) ** 0.5 or 1.0
    nx, ny = -dy / L * w / 2.0, dx / L * w / 2.0
    return [(ax + nx, ay + ny), (bx + nx, by + ny), (bx - nx, by - ny), (ax - nx, ay - ny)]


def ring(cx, cy, rx, ry, w, n):
    """n 각형 고리. 바깥 윤곽과 안쪽 구멍 두 개를 돌려준다."""
    out, inn = [], []
    irx, iry = max(rx - w, rx * 0.12), max(ry - w, ry * 0.12)
    for i in range(n):
        a = 2 * pi * i / n - pi / 2 + pi / n
        out.append((cx + rx * cos(a), cy + ry * sin(a)))
        inn.append((cx + irx * cos(a), cy + iry * sin(a)))
    inn.reverse()                      # 구멍은 반대 방향으로 감는다
    return [out, inn]


# ── 낱자 ───────────────────────────────────────────────────────────
# 각 함수는 상자 (x0, y0, x1, y1) 와 style 을 받아 다각형 목록을 낸다.
def _frame(box, st):
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    # 상자가 얇으면 획도 같이 얇아져야 한다. 그렇지 않으면 속공간이 막힌다.
    w = min(st['w'], bh * 0.46, bw * 0.46)
    X = lambda t: x0 + t * bw
    Y = lambda t: y0 + t * bh
    return X, Y, w, bw, bh


def c_giyeok(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    return [hbar(X(0), X(1), Y(1) - w / 2, w),
            vbar(X(1) - w / 2, Y(0), Y(1), w)]


def c_nieun(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    return [vbar(X(0) + w / 2, Y(0), Y(1), w),
            hbar(X(0), X(1), Y(0) + w / 2, w)]


def c_digeut(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    return [hbar(X(0), X(1), Y(1) - w / 2, w),
            vbar(X(0) + w / 2, Y(0), Y(1), w),
            hbar(X(0), X(1), Y(0) + w / 2, w)]


def c_rieul(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    m = 0.5
    return [hbar(X(0), X(1), Y(1) - w / 2, w),
            vbar(X(1) - w / 2, Y(m), Y(1), w),
            hbar(X(0), X(1), Y(m), w),
            vbar(X(0) + w / 2, Y(0), Y(m), w),
            hbar(X(0), X(1), Y(0) + w / 2, w)]


def c_mieum(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    return [hbar(X(0), X(1), Y(1) - w / 2, w),
            hbar(X(0), X(1), Y(0) + w / 2, w),
            vbar(X(0) + w / 2, Y(0), Y(1), w),
            vbar(X(1) - w / 2, Y(0), Y(1), w)]


def c_bieup(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    return [vbar(X(0) + w / 2, Y(0), Y(1), w),
            vbar(X(1) - w / 2, Y(0), Y(1), w),
            hbar(X(0), X(1), Y(0.44), w),
            hbar(X(0), X(1), Y(0) + w / 2, w)]


def c_siot(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    apex = (X(0.5), Y(1))
    return [diag(apex, (X(0.02), Y(0)), w),
            diag(apex, (X(0.98), Y(0)), w)]


def c_ieung(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    return ring(X(0.5), Y(0.5), bw / 2, bh / 2, w, st['sides'])


def c_jieut(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    out = [hbar(X(0), X(1), Y(1) - w / 2, w)]
    out += c_siot((box[0], box[1], box[2], Y(1) - w), st)
    return out


def c_chieut(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    out = [vbar(X(0.5), Y(0.84), Y(1), w),
            hbar(X(0), X(1), Y(0.78), w)]
    out += c_siot((box[0], box[1], box[2], Y(0.70)), st)
    return out


def c_kiyeok(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    return c_giyeok(box, st) + [hbar(X(0), X(1), Y(0.46), w)]


def c_tieut(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    return c_digeut(box, st) + [hbar(X(0), X(1), Y(0.5), w)]


def c_pieup(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    return [hbar(X(0), X(1), Y(1) - w / 2, w),
            hbar(X(0), X(1), Y(0) + w / 2, w),
            vbar(X(0.26), Y(0), Y(1), w),
            vbar(X(0.74), Y(0), Y(1), w)]


def c_hieut(box, st):
    X, Y, w, bw, bh = _frame(box, st)
    out = [vbar(X(0.5), Y(0.86), Y(1), w),
            hbar(X(0), X(1), Y(0.80), w)]
    r = (Y(0.72) - Y(0)) / 2
    out += ring(X(0.5), Y(0.36), min(bw / 2, r * 1.15), r, w, st['sides'])
    return out


# ── 모음 ───────────────────────────────────────────────────────────
def v_a(box, st):      # ㅏ
    X, Y, w, bw, bh = _frame(box, st)
    return [vbar(X(0.30), Y(0), Y(1), w), hbar(X(0.30), X(1), Y(0.52), w)]


def v_ya(box, st):     # ㅑ
    X, Y, w, bw, bh = _frame(box, st)
    return [vbar(X(0.30), Y(0), Y(1), w),
            hbar(X(0.30), X(1), Y(0.66), w),
            hbar(X(0.30), X(1), Y(0.34), w)]


def v_eo(box, st):     # ㅓ
    X, Y, w, bw, bh = _frame(box, st)
    return [vbar(X(0.70), Y(0), Y(1), w), hbar(X(0), X(0.70), Y(0.52), w)]


def v_yeo(box, st):    # ㅕ
    X, Y, w, bw, bh = _frame(box, st)
    return [vbar(X(0.70), Y(0), Y(1), w),
            hbar(X(0), X(0.70), Y(0.66), w),
            hbar(X(0), X(0.70), Y(0.34), w)]


def v_i(box, st):      # ㅣ
    X, Y, w, bw, bh = _frame(box, st)
    return [vbar(X(0.5), Y(0), Y(1), w)]


def v_o(box, st):      # ㅗ
    X, Y, w, bw, bh = _frame(box, st)
    return [hbar(X(0), X(1), Y(0) + w / 2, w), vbar(X(0.5), Y(0), Y(1), w)]


def v_yo(box, st):     # ㅛ
    X, Y, w, bw, bh = _frame(box, st)
    return [hbar(X(0), X(1), Y(0) + w / 2, w),
            vbar(X(0.34), Y(0), Y(1), w),
            vbar(X(0.66), Y(0), Y(1), w)]


def v_u(box, st):      # ㅜ
    X, Y, w, bw, bh = _frame(box, st)
    return [hbar(X(0), X(1), Y(1) - w / 2, w), vbar(X(0.5), Y(0), Y(1), w)]


def v_yu(box, st):     # ㅠ
    X, Y, w, bw, bh = _frame(box, st)
    return [hbar(X(0), X(1), Y(1) - w / 2, w),
            vbar(X(0.34), Y(0), Y(1), w),
            vbar(X(0.66), Y(0), Y(1), w)]


def v_eu(box, st):     # ㅡ
    X, Y, w, bw, bh = _frame(box, st)
    return [hbar(X(0), X(1), Y(0.5), w)]


# 그린 낱자 33종
SHAPES = {
    'ㄱ': c_giyeok, 'ㄴ': c_nieun, 'ㄷ': c_digeut, 'ㄹ': c_rieul, 'ㅁ': c_mieum,
    'ㅂ': c_bieup, 'ㅅ': c_siot, 'ㅇ': c_ieung, 'ㅈ': c_jieut, 'ㅊ': c_chieut,
    'ㅋ': c_kiyeok, 'ㅌ': c_tieut, 'ㅍ': c_pieup, 'ㅎ': c_hieut,
    'ㅏ': v_a, 'ㅑ': v_ya, 'ㅓ': v_eo, 'ㅕ': v_yeo, 'ㅣ': v_i,
    'ㅗ': v_o, 'ㅛ': v_yo, 'ㅜ': v_u, 'ㅠ': v_yu, 'ㅡ': v_eu,
}

# 쌍자음·겹받침은 두 낱자를 좌우로 눌러 담는다
PAIRS = {
    'ㄲ': ('ㄱ', 'ㄱ'), 'ㄸ': ('ㄷ', 'ㄷ'), 'ㅃ': ('ㅂ', 'ㅂ'),
    'ㅆ': ('ㅅ', 'ㅅ'), 'ㅉ': ('ㅈ', 'ㅈ'),
    'ㄳ': ('ㄱ', 'ㅅ'), 'ㄵ': ('ㄴ', 'ㅈ'), 'ㄶ': ('ㄴ', 'ㅎ'),
    'ㄺ': ('ㄹ', 'ㄱ'), 'ㄻ': ('ㄹ', 'ㅁ'), 'ㄼ': ('ㄹ', 'ㅂ'),
    'ㄽ': ('ㄹ', 'ㅅ'), 'ㄾ': ('ㄹ', 'ㅌ'), 'ㄿ': ('ㄹ', 'ㅍ'),
    'ㅀ': ('ㄹ', 'ㅎ'), 'ㅄ': ('ㅂ', 'ㅅ'),
}

# 겹모음은 가로 낱자와 세로 낱자의 짝으로 푼다
COMPOUND_V = {
    'ㅐ': ('ㅏ', 'ㅣ'), 'ㅒ': ('ㅑ', 'ㅣ'), 'ㅔ': ('ㅓ', 'ㅣ'), 'ㅖ': ('ㅕ', 'ㅣ'),
    'ㅘ': ('ㅗ', 'ㅏ'), 'ㅙ': ('ㅗ', 'ㅐ'), 'ㅚ': ('ㅗ', 'ㅣ'),
    'ㅝ': ('ㅜ', 'ㅓ'), 'ㅞ': ('ㅜ', 'ㅔ'), 'ㅟ': ('ㅜ', 'ㅣ'), 'ㅢ': ('ㅡ', 'ㅣ'),
}


def draw(key, box, st, gap=None):
    """낱자 하나를 상자 안에 그린다. 쌍자음·겹받침은 좌우로 나눠 담는다."""
    if key in PAIRS:
        a, b = PAIRS[key]
        x0, y0, x1, y1 = box
        g = (x1 - x0) * (0.10 if gap is None else gap)
        half = (x1 - x0 - g) / 2
        return (draw(a, (x0, y0, x0 + half, y1), st)
                + draw(b, (x1 - half, y0, x1, y1), st))
    fn = SHAPES.get(key)
    return fn(box, st) if fn else []
