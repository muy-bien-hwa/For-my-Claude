# -*- coding: utf-8 -*-
"""음절 조립 — 초성·중성·종성을 자리에 앉혀 한 글자를 만든다.

모음의 성격이 초성의 자리를 정한다.
  세로모음(ㅏㅣ…)  초성은 왼쪽 절반
  가로모음(ㅗㅜㅡ…) 초성은 위쪽
  겹모음(ㅘㅚ…)    초성은 왼쪽 위
받침이 있으면 위 요소들이 눌려 올라가고 아래가 열린다.
"""

import jamo, outline

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


def _narrow(box, k):
    """상자를 가운데를 축으로 가로로 좁힌다. 받침 폭을 줄일 때 쓴다."""
    if k >= 1.0:
        return box
    x0, y0, x1, y1 = box
    cx, half = (x0 + x1) / 2, (x1 - x0) / 2 * k
    return (cx - half, y0, cx + half, y1)


def _taller(box, k, limit):
    """상자를 위아래로 늘인다. 기둥이 틀 밖으로 조금 넘치게 할 때 쓴다."""
    if not k:
        return box
    x0, y0, x1, y1 = box
    d = (y1 - y0) * k
    return (x0, max(limit[0], y0 - d), x1, min(limit[1], y1 + d))


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
    """음절 하나를 (다각형, 베지에) 로 조립한다. 윤곽 합치기는 glyph() 가 한다."""
    parts = decompose(ch)
    if not parts:
        return [], []
    cho, jung, jong = parts
    frame = st['frame']
    P, B = [], []

    def put(key, box):
        p, b = jamo.draw(key, box, st)
        P.extend(p); B.extend(b)

    if st['layout'] == 'decon':
        slot = dict(DECON_BASE)
        cls = vclass(jung)
        put(cho, _box(slot['cho'], frame))
        if cls == 'V':
            for k, b in _jung_boxes(jung, {'jung': slot['jungV']}, frame, st):
                put(k, b)
        elif cls == 'H':
            for k, b in _jung_boxes(jung, {'jungH': slot['jungH']}, frame, st):
                put(k, b)
        else:
            for k, b in _jung_boxes(jung, slot, frame, st):
                put(k, b)
        if jong:
            put(jong, _box(slot['jong'], frame))
        return P, B

    slot = SQUARE[(vclass(jung), 1 if jong else 0)]
    over = st.get('stem_over', 0.0)
    limit = (st.get('ymin', -40), st.get('ymax', 800))
    put(cho, _box(slot['cho'], frame))
    for k, b in _jung_boxes(jung, slot, frame, st):
        # 세로 기둥만 틀 위아래로 조금 넘긴다
        put(k, _taller(b, over, limit) if k in 'ㅏㅑㅓㅕㅣ' else b)
    if jong:
        put(jong, _narrow(_box(slot['jong'], frame), st.get('jong_width', 1.0)))
    return P, B


def glyph(ch, st):
    """한 글자의 최종 윤곽. 겹친 획을 합치고 모서리를 가공한다."""
    P, B = syllable(ch, st)
    if not P and not B:
        P, B = jamo_letter(ch, st)
    return outline.treat(outline.union(P), st), B


def jamo_letter(ch, st):
    """낱자 자체(ㄱ, ㅏ …)를 한 글자로 그린다."""
    x0, y0, x1, y1 = st['frame']
    if ch in jamo.SHAPES or ch in jamo.PAIRS:
        w = (x1 - x0) * (0.60 if ch in jamo.SHAPES else 0.86)
        cx = (x0 + x1) / 2
        return jamo.draw(ch, (cx - w / 2, y0 + (y1 - y0) * 0.10, cx + w / 2, y1 * 0.92), st)
    if ch in jamo.COMPOUND_V:
        a, b = jamo.COMPOUND_V[ch]
        pa, ba = jamo.draw(a, (x0, y0, (x0 + x1) / 2, y1), st)
        pb, bb = jamo.draw(b, ((x0 + x1) / 2, y0, x1, y1), st)
        return pa + pb, ba + bb
    return [], []


# ── 성격 ───────────────────────────────────────────────────────────
# 모노라인 한 줄기에서 갈라지는 셋. 굵기·비례·틀은 똑같이 두고
# 모서리 가공만 다르게 해서 디테일만 견주어 보이게 한다.
_MONO = {
    'w': 34, 'hw': 0.94, 'overshoot': 0.028, 'layout': 'square',
    'frame': (66, 8, 934, 756), 'advance': 1000,
}

STYLES = {
    'trap': dict(_MONO, **{
        'name': '정밀', 'detail': 'trap',
        'trap_back': 15, 'trap_depth': 9,
        'hw': 0.94, 'ring_inset': 0.14, 'jong_width': 0.78, 'siot_spread': -0.02,
        'note': '안쪽 이음매마다 쐐기를 판다 (잉크 트랩). ㅇ은 상자에서 물러나 '
                '또렷한 점이 되고 받침은 좁다. 계기판 글자 같은 인상.',
    }),
    'chamfer': dict(_MONO, **{
        'name': '모서리', 'detail': 'chamfer', 'chamfer': 13,
        'hw': 0.96, 'ring_inset': 0.0, 'jong_width': 0.97,
        'stem_over': 0.035, 'siot_spread': 0.07,
        'note': '바깥 모서리를 전부 같은 양으로 깎는다. ㅇ이 네모를 꽉 채우고 '
                '기둥이 틀 밖으로 조금 넘쳐 글줄이 팽팽해진다.',
    }),
    'slant': dict(_MONO, **{
        'name': '맺음', 'detail': 'slant', 'slant': 19,
        'hw': 0.86, 'ring_inset': 0.05, 'jong_width': 0.86, 'siot_spread': -0.08,
        'note': '자유로운 획 끝만 비스듬히 자른다. 가로획이 세로획보다 뚜렷이 '
                '얇고 ㅅ 다리가 가팔라, 모노라인에 쓰기의 결이 남는다.',
    }),
    'plain': dict(_MONO, **{
        'name': '민짜 (대조군)', 'detail': None,
        'note': '가공도 구조 특징도 없다. 셋이 무엇을 더했는지 견주려고 둔다.',
    }),
}
