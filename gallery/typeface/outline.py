# -*- coding: utf-8 -*-
"""윤곽 가공 — 겹쳐 그은 획을 하나의 윤곽으로 합치고 모서리를 다듬는다.

획을 사각형으로 겹쳐 놓기만 하면 이음매에 군더더기가 남는다. 여기서
합집합을 구해 윤곽 하나로 만든 뒤, 꼭짓점을 안쪽(오목)과 바깥쪽(볼록)으로
가려내고 성격에 맞는 가공을 건다.

  잉크 트랩  오목한 이음매에 쐐기를 파낸다. 획이 모이는 자리가 뭉치지 않는다.
  모따기      볼록한 모서리를 일정하게 깎는다.
  비낀 맺음   자유로운 획 끝만 비스듬히 자른다.
"""

import pyclipper
from math import cos, sin, pi, hypot

SCALE = 100          # 클리퍼는 정수만 다루므로 100배로 올려 계산한다
KAPPA = 0.5522847498  # 원을 베지에로 근사할 때 쓰는 비율


# ── 합집합 ─────────────────────────────────────────────────────────
def union(polys):
    """겹친 다각형들을 윤곽 목록으로 합친다."""
    if not polys:
        return []
    pc = pyclipper.Pyclipper()
    pc.AddPaths([[(int(round(x * SCALE)), int(round(y * SCALE))) for x, y in p]
                 for p in polys if len(p) >= 3], pyclipper.PT_SUBJECT, True)
    try:
        sol = pc.Execute(pyclipper.CT_UNION, pyclipper.PFT_NONZERO, pyclipper.PFT_NONZERO)
    except pyclipper.ClipperException:
        return [[(x, y) for x, y in p] for p in polys]
    return [[(x / SCALE, y / SCALE) for x, y in c] for c in sol]


# ── 꼭짓점 가려내기 ────────────────────────────────────────────────
def _area2(c):
    s = 0.0
    for i in range(len(c)):
        x0, y0 = c[i]
        x1, y1 = c[(i + 1) % len(c)]
        s += x0 * y1 - x1 * y0
    return s


def _convex_flags(c):
    """각 꼭짓점이 볼록이면 True. 윤곽의 감긴 방향을 따져 판정한다."""
    ccw = _area2(c) > 0
    out = []
    n = len(c)
    for i in range(n):
        ax, ay = c[i - 1]
        bx, by = c[i]
        cx, cy = c[(i + 1) % n]
        cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx)
        out.append((cross > 0) == ccw)
    return out


def _unit(ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    L = hypot(dx, dy) or 1.0
    return dx / L, dy / L, L


# ── 가공 ───────────────────────────────────────────────────────────
def chamfer(contour, d):
    """볼록한 모서리를 d 만큼 깎는다. 짧은 변에서는 변 길이에 맞춰 줄인다."""
    n = len(contour)
    if n < 3:
        return contour
    flags = _convex_flags(contour)
    out = []
    for i in range(n):
        v = contour[i]
        p, q = contour[i - 1], contour[(i + 1) % n]
        if not flags[i]:
            out.append(v)
            continue
        ux, uy, L0 = _unit(v[0], v[1], p[0], p[1])
        vx, vy, L1 = _unit(v[0], v[1], q[0], q[1])
        k = min(d, L0 * 0.45, L1 * 0.45)
        if k < 0.5:
            out.append(v)
            continue
        out.append((v[0] + ux * k, v[1] + uy * k))
        out.append((v[0] + vx * k, v[1] + vy * k))
    return out


def inktrap(contour, back, depth):
    """오목한 이음매에 쐐기를 판다.

    꼭짓점에서 양쪽 변을 back 만큼 물러난 두 점을 잡고, 그 사이에
    꼭짓점보다 depth 만큼 더 깊은 점을 끼워 넣는다.
    """
    n = len(contour)
    if n < 3:
        return contour
    flags = _convex_flags(contour)
    out = []
    for i in range(n):
        v = contour[i]
        p, q = contour[i - 1], contour[(i + 1) % n]
        if flags[i]:
            out.append(v)
            continue
        ux, uy, L0 = _unit(v[0], v[1], p[0], p[1])
        vx, vy, L1 = _unit(v[0], v[1], q[0], q[1])
        lim = min(L0, L1)
        # 마주 보는 두 트랩이 서로 만나 이음매를 뚫지 않도록 이웃 변 길이에 묶는다
        k = min(back, lim * 0.34)
        d = min(depth, lim * 0.26)
        if k < 1.0 or d < 1.0:
            out.append(v)
            continue
        a = (v[0] + ux * k, v[1] + uy * k)
        b = (v[0] + vx * k, v[1] + vy * k)
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        dx, dy = v[0] - mx, v[1] - my
        L = hypot(dx, dy) or 1.0
        tip = (v[0] + dx / L * d, v[1] + dy / L * d)
        out.extend([a, tip, b])
    return out


def slant_caps(contour, w, slant, tol=0.22):
    """자유로운 획 끝만 비스듬히 자른다.

    모노라인에서 끝맺음은 '길이가 획 굵기와 같고 양끝이 볼록한 변'이다.
    이음매는 그런 변을 만들지 않으므로 이 조건으로 끝을 가려낼 수 있다.
    """
    n = len(contour)
    if n < 4:
        return contour
    flags = _convex_flags(contour)
    moved = {}
    for i in range(n):
        j = (i + 1) % n
        if not (flags[i] and flags[j]):
            continue
        L = hypot(contour[j][0] - contour[i][0], contour[j][1] - contour[i][1])
        if abs(L - w) > w * tol:
            continue
        # 끝변의 한쪽은 물러나고 다른 쪽은 그대로 두어 비스듬한 단면을 만든다
        px = contour[i - 1]
        ux, uy, L0 = _unit(contour[i][0], contour[i][1], px[0], px[1])
        k = min(slant, L0 * 0.45)
        moved[i] = (contour[i][0] + ux * k, contour[i][1] + uy * k)
    if not moved:
        return contour
    return [moved.get(i, contour[i]) for i in range(n)]


def treat(contours, st):
    """성격에 맞는 모서리 가공을 건다."""
    kind = st.get('detail')
    out = []
    for c in contours:
        if kind == 'trap':
            c = inktrap(c, st['trap_back'], st['trap_depth'])
        elif kind == 'chamfer':
            c = chamfer(c, st['chamfer'])
        elif kind == 'slant':
            c = slant_caps(c, st['w'], st['slant'])
        out.append(c)
    return out


# ── 원 ─────────────────────────────────────────────────────────────
def circle_contours(cx, cy, rx, ry, w):
    """참된 원 고리. 베지에 네 조각으로 그린다. (바깥, 안쪽) 두 윤곽."""
    def arc(r_x, r_y, reverse):
        k = KAPPA
        pts = [
            ('M', (cx + r_x, cy)),
            ('C', (cx + r_x, cy + r_y * k), (cx + r_x * k, cy + r_y), (cx, cy + r_y)),
            ('C', (cx - r_x * k, cy + r_y), (cx - r_x, cy + r_y * k), (cx - r_x, cy)),
            ('C', (cx - r_x, cy - r_y * k), (cx - r_x * k, cy - r_y), (cx, cy - r_y)),
            ('C', (cx + r_x * k, cy - r_y), (cx + r_x, cy - r_y * k), (cx + r_x, cy)),
        ]
        if reverse:
            pts = _reverse_bezier(pts)
        return pts

    irx, iry = max(rx - w, rx * 0.10), max(ry - w, ry * 0.10)
    return [arc(rx, ry, False), arc(irx, iry, True)]


def _reverse_bezier(cmds):
    """베지에 경로의 방향을 뒤집는다. 구멍은 반대로 감겨야 한다."""
    pts = [cmds[0][1]]
    segs = []
    for c in cmds[1:]:
        segs.append((c[1], c[2], c[3]))
        pts.append(c[3])
    out = [('M', pts[-1])]
    for i in range(len(segs) - 1, -1, -1):
        c1, c2, _ = segs[i]
        out.append(('C', c2, c1, pts[i]))
    return out


# ── 경로 글자 ──────────────────────────────────────────────────────
def to_svg_path(contours, beziers):
    """윤곽(직선)과 베지에 경로를 합쳐 SVG d 속성으로 만든다."""
    parts = []
    for c in contours:
        if len(c) < 3:
            continue
        parts.append('M' + ' '.join('%.1f %.1f' % (x, y) for x, y in c) + 'Z')
    for b in beziers:
        d = []
        for cmd in b:
            if cmd[0] == 'M':
                d.append('M%.1f %.1f' % cmd[1])
            else:
                d.append('C%.1f %.1f %.1f %.1f %.1f %.1f'
                         % (cmd[1][0], cmd[1][1], cmd[2][0], cmd[2][1], cmd[3][0], cmd[3][1]))
        parts.append(''.join(d) + 'Z')
    return ''.join(parts)
