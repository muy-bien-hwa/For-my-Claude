# -*- coding: utf-8 -*-
"""음절 조립 — 초성·중성·종성을 자리에 앉혀 한 글자를 만든다.

모음의 성격이 초성의 자리를 정한다.
  세로모음(ㅏㅣ…)  초성은 왼쪽 절반
  가로모음(ㅗㅜㅡ…) 초성은 위쪽
  겹모음(ㅘㅚ…)    초성은 왼쪽 위
받침이 있으면 위 요소들이 눌려 올라가고 아래가 열린다.
"""

import jamo

CHO = list('ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ')
JUNG = list('ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ')
JONG = [''] + list('ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ')

VERTICAL = set('ㅏㅐㅑㅒㅓㅔㅕㅖㅣ')
HORIZONTAL = set('ㅗㅛㅜㅠㅡ')
MIXED = set('ㅘㅙㅚㅝㅞㅟㅢ')


def decompose(ch):
    """한 음절을 (초성, 중성, 종성) 으로 쪼갠다. 음절이 아니면 None."""
    code = ord(ch) - 0xAC00
    if not (0 <= code < 11172):
        return None
    return CHO[code // 588], JUNG[(code % 588) // 28], JONG[code % 28]


def compose_code(cho, jung, jong=''):
    return 0xAC00 + CHO.index(cho) * 588 + JUNG.index(jung) * 28 + JONG.index(jong)


def vclass(v):
    if v in VERTICAL:
        return 'V'
    if v in HORIZONTAL:
        return 'H'
    return 'M'


# ── 자리표 ─────────────────────────────────────────────────────────
# 값은 음절 상자 안의 비율 (x0, y0, x1, y1). y 는 아래가 0.
# 네모틀: 받침 유무와 모음 성격에 따라 요소를 눌러 넣는다.
SQUARE = {
    ('V', 0): {'cho': (0.00, 0.00, 0.58, 1.00), 'jung': (0.63, 0.00, 1.00, 1.00)},
    ('V', 1): {'cho': (0.00, 0.36, 0.58, 1.00), 'jung': (0.63, 0.24, 1.00, 1.00),
               'jong': (0.00, 0.00, 1.00, 0.32)},
    ('H', 0): {'cho': (0.14, 0.40, 0.86, 1.00), 'jung': (0.00, 0.00, 1.00, 0.34)},
    ('H', 1): {'cho': (0.14, 0.66, 0.86, 1.00), 'jung': (0.00, 0.35, 1.00, 0.60),
               'jong': (0.12, 0.00, 0.88, 0.31)},
    ('M', 0): {'cho': (0.00, 0.40, 0.50, 1.00), 'jungH': (0.00, 0.00, 1.00, 0.33),
               'jungV': (0.56, 0.38, 1.00, 1.00)},
    ('M', 1): {'cho': (0.00, 0.60, 0.50, 1.00), 'jungH': (0.00, 0.33, 1.00, 0.57),
               'jungV': (0.56, 0.58, 1.00, 1.00), 'jong': (0.00, 0.00, 1.00, 0.30)},
}

# 탈네모틀: 받침이 있든 없든 낱자의 자리와 크기가 고정이다.
# 받침은 기준선 아래로 내려가 글줄 밑이 들쭉날쭉해진다.
DECON_BASE = {
    'cho':   (0.00, 0.38, 0.58, 1.02),
    'jungV': (0.60, 0.22, 1.02, 1.04),
    'jungH': (0.00, 0.08, 0.58, 0.34),
    'jong':  (0.02, -0.24, 0.56, 0.10),
}


def _box(rel, frame):
    """비율 자리를 em 좌표 상자로 바꾼다."""
    fx0, fy0, fx1, fy1 = frame
    fw, fh = fx1 - fx0, fy1 - fy0
    return (fx0 + rel[0] * fw, fy0 + rel[1] * fh,
            fx0 + rel[2] * fw, fy0 + rel[3] * fh)


def _jung_boxes(v, slot, frame, st):
    """중성 자리. 겹모음은 가로 낱자와 세로 낱자로 나눠 돌려준다."""
    out = []
    if v in jamo.COMPOUND_V:
        a, b = jamo.COMPOUND_V[v]
        if vclass(v) == 'M':
            out.append((a, _box(slot['jungH'], frame)))
            # ㅙ·ㅞ 처럼 세로쪽이 또 겹모음이면 한 번 더 푼다
            if b in jamo.COMPOUND_V:
                c, d = jamo.COMPOUND_V[b]
                vb = _box(slot['jungV'], frame)
                x0, y0, x1, y1 = vb
                cut = x0 + (x1 - x0) * 0.60
                out.append((c, (x0, y0, cut, y1)))
                out.append((d, (cut, y0, x1, y1)))
            else:
                out.append((b, _box(slot['jungV'], frame)))
        else:
            # ㅐㅔㅒㅖ — 세로 자리를 좌우로 나눈다
            vb = _box(slot['jung'], frame)
            x0, y0, x1, y1 = vb
            cut = x0 + (x1 - x0) * 0.62
            out.append((a, (x0, y0, cut, y1)))
            out.append((b, (cut, y0, x1, y1)))
    else:
        key = 'jung' if 'jung' in slot else ('jungH' if vclass(v) == 'H' else 'jungV')
        out.append((v, _box(slot[key], frame)))
    return out


def syllable(ch, st):
    """음절 하나를 다각형 목록으로 그린다."""
    parts = decompose(ch)
    if not parts:
        return []
    cho, jung, jong = parts
    frame = st['frame']
    polys = []

    if st['layout'] == 'decon':
        slot = dict(DECON_BASE)
        cls = vclass(jung)
        polys += jamo.draw(cho, _box(slot['cho'], frame), st)
        if cls == 'V':
            polys += [p for k, b in _jung_boxes(jung, {'jung': slot['jungV']}, frame, st)
                      for p in jamo.draw(k, b, st)]
        elif cls == 'H':
            polys += [p for k, b in _jung_boxes(jung, {'jungH': slot['jungH']}, frame, st)
                      for p in jamo.draw(k, b, st)]
        else:
            polys += [p for k, b in _jung_boxes(jung, slot, frame, st)
                      for p in jamo.draw(k, b, st)]
        if jong:
            polys += jamo.draw(jong, _box(slot['jong'], frame), st)
        return polys

    slot = SQUARE[(vclass(jung), 1 if jong else 0)]
    polys += jamo.draw(cho, _box(slot['cho'], frame), st)
    for k, b in _jung_boxes(jung, slot, frame, st):
        polys += jamo.draw(k, b, st)
    if jong:
        polys += jamo.draw(jong, _box(slot['jong'], frame), st)
    return polys


def jamo_letter(ch, st):
    """낱자 자체(ㄱ, ㅏ …)를 한 글자로 그린다."""
    frame = st['frame']
    x0, y0, x1, y1 = frame
    if ch in jamo.SHAPES or ch in jamo.PAIRS:
        w = (x1 - x0) * (0.62 if ch in jamo.SHAPES else 0.86)
        cx = (x0 + x1) / 2
        return jamo.draw(ch, (cx - w / 2, y0 + (y1 - y0) * 0.08, cx + w / 2, y1 * 0.94), st)
    if ch in jamo.COMPOUND_V:
        a, b = jamo.COMPOUND_V[ch]
        return (jamo.draw(a, (x0, y0, (x0 + x1) / 2, y1), st)
                + jamo.draw(b, ((x0 + x1) / 2, y0, x1, y1), st))
    return []


# ── 성격 네 가지 ───────────────────────────────────────────────────
# frame 은 음절이 들어앉는 상자. em 1000, 기준선 0.
STYLES = {
    'modular': {
        'name': '각진 모듈러', 'w': 92, 'sides': 8, 'layout': 'square',
        'frame': (72, 8, 928, 748), 'advance': 1000,
        'note': '기본 획을 직각으로 자르고 ㅇ·ㅎ의 원을 팔각형으로 깎았다.',
    },
    'decon': {
        'name': '탈네모', 'w': 90, 'sides': 8, 'layout': 'decon',
        'frame': (70, 8, 930, 748), 'advance': 980,
        'note': '낱자의 자리와 크기가 고정이라 받침이 기준선 아래로 내려간다.',
    },
    'hairline': {
        'name': '모노라인 헤어라인', 'w': 34, 'sides': 16, 'layout': 'square',
        'frame': (64, 8, 936, 760), 'advance': 1000,
        'note': '모든 획이 같은 가는 굵기. 1px 괘선과 한 몸이 된다.',
    },
    'heavy': {
        'name': '초고중량 납작체', 'w': 150, 'sides': 8, 'layout': 'square',
        'frame': (46, 4, 1104, 742), 'advance': 1150,
        'note': '획이 두껍고 자폭이 넓다. 제목이 벽처럼 보인다.',
    },
}
