# -*- coding: utf-8 -*-
"""한글 짜임 — 글자틀 위의 고정 좌표에 요소를 앉힌다.

이전 판의 잘못
  자모를 '임의의 상자에 넣고 늘이는' 방식이었다. 겹모음은 상자를 쪼개고
  또 쪼갰기 때문에 기둥이 토막나고 가로줄기가 기둥 밑을 가로질렀다.
  ㅞ 가 무너진 이유가 이것이다.

이 판의 원칙
  1. 기둥은 언제나 글자틀 높이를 끝까지 지난다. 섞임모임에서도 자르지 않는다.
  2. 가로줄기는 기둥 앞에서 끝난다. 기둥 밑을 지나가지 않는다.
  3. 곁줄기 높이는 글자틀 기준으로 고정이다. 초성 모양에 흔들리지 않는다.
  4. 모든 요소는 제 자리를 벗어나지 않는다.
  5. 초성은 모음 무리와 받침 유무로 8벌, 종성은 모음 무리로 4벌을 쓴다.

8×4×4 조합형의 벌 분류를 따랐다. 초성이 ㅗㅛㅡ 앞에서와 ㅜㅠ 앞에서
달라야 하는 까닭은, ㅗ 는 짧은기둥이 위로 올라와 초성을 밀어내지만
ㅜ 는 아래로 내려가 초성이 더 내려앉을 수 있기 때문이다.

좌표는 모두 글자틀에 대한 비율이다. x 는 왼쪽이 0, y 는 아래가 0.
"""

CHO = list('ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ')
JUNG = list('ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ')
JONG = [''] + list('ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ')


def decompose(ch):
    code = ord(ch) - 0xAC00
    if not (0 <= code < 11172):
        return None
    return CHO[code // 588], JUNG[(code % 588) // 28], JONG[code % 28]


# ── 모음 짜임 ──────────────────────────────────────────────────────
# kind  V 가로모임(기둥이 오른쪽) · H 세로모임(가로줄기가 아래) · M 섞임모임
# stems 기둥의 x 자리 (글자틀 비율). 언제나 세로로 끝까지 선다.
# bars  곁줄기. (방향, 높이) — 방향 +1 오른쪽 끝까지, -1 왼쪽으로, 0 기둥끼리 잇기
# reach 곁줄기가 왼쪽으로 뻗는 끝 (방향 -1 일 때만)
# cho_r 초성의 오른쪽 한계. 모음 먹물이 시작하기 전에 끊는다.
V_FORMS = {
    'ㅏ': dict(kind='V', stems=[0.70], bars=[(+1, 0.50)], cho_r=0.60),
    'ㅑ': dict(kind='V', stems=[0.70], bars=[(+1, 0.64), (+1, 0.33)], cho_r=0.60),
    'ㅓ': dict(kind='V', stems=[0.84], bars=[(-1, 0.50)], reach=0.60, cho_r=0.52),
    'ㅕ': dict(kind='V', stems=[0.84], bars=[(-1, 0.64), (-1, 0.33)], reach=0.60, cho_r=0.52),
    'ㅣ': dict(kind='V', stems=[0.76], bars=[], cho_r=0.64),
    'ㅐ': dict(kind='V', stems=[0.66, 0.92], bars=[(0, 0.50)], cho_r=0.56),
    'ㅒ': dict(kind='V', stems=[0.66, 0.92], bars=[(0, 0.64), (0, 0.33)], cho_r=0.56),
    'ㅔ': dict(kind='V', stems=[0.74, 0.96], bars=[(-1, 0.50)], reach=0.52, cho_r=0.44),
    'ㅖ': dict(kind='V', stems=[0.74, 0.96], bars=[(-1, 0.64), (-1, 0.33)], reach=0.52, cho_r=0.44),

    # 세로모임. bar 는 가로줄기 높이, tick 은 짧은기둥 (+1 위, -1 아래, 0 없음)
    'ㅗ': dict(kind='H', bar=0.22, tick=+1, at=[0.50]),
    'ㅛ': dict(kind='H', bar=0.22, tick=+1, at=[0.33, 0.67]),
    'ㅜ': dict(kind='H', bar=0.32, tick=-1, at=[0.50]),
    'ㅠ': dict(kind='H', bar=0.32, tick=-1, at=[0.33, 0.67]),
    'ㅡ': dict(kind='H', bar=0.22, tick=0, at=[]),

    # 섞임모임. h 는 가로요소, v 는 세로요소. 둘 다 위 정의를 그대로 쓴다.
    'ㅘ': dict(kind='M', h='ㅗ', v='ㅏ'),
    'ㅙ': dict(kind='M', h='ㅗ', v='ㅐ'),
    'ㅚ': dict(kind='M', h='ㅗ', v='ㅣ'),
    'ㅝ': dict(kind='M', h='ㅜ', v='ㅓ'),
    'ㅞ': dict(kind='M', h='ㅜ', v='ㅔ'),
    'ㅟ': dict(kind='M', h='ㅜ', v='ㅣ'),
    'ㅢ': dict(kind='M', h='ㅡ', v='ㅣ'),
}

# 짧은기둥이 가로줄기에서 뻗는 길이 (글자틀 비율)
TICK_LEN = {False: 0.24, True: 0.16}      # 받침 유무

# 세로모임에서 가로줄기가 올라가는 높이
H_BAR_WITH_JONG = {'ㅗ': 0.46, 'ㅛ': 0.46, 'ㅜ': 0.52, 'ㅠ': 0.52, 'ㅡ': 0.46}

# 가로줄기의 좌우 끝 (세로모임)
H_SPAN = (0.04, 0.96)

# 기둥의 세로 범위
STEM_Y = {False: (0.00, 1.00), True: (0.30, 1.00)}

# 초성 자리 — 8벌
#   세로모음 / ㅗㅛㅡ / ㅜㅠ / ㅗ계 섞임 / ㅜ계 섞임 / ㅡ계 섞임, × 받침 유무
CHO_BOX = {
    # (무리, 받침) : (x0, y0, x1, y1)  — x1 은 모음이 cho_r 로 덮어쓴다
    ('V', False): (0.04, 0.00, None, 1.00),
    ('V', True):  (0.04, 0.32, None, 1.00),
    ('H_up', False):   (0.16, 0.52, 0.84, 1.00),   # ㅗㅛㅡ — 짧은기둥이 위로 올라온다
    ('H_down', False): (0.16, 0.44, 0.84, 1.00),   # ㅜㅠ — 아래로 내려가니 더 내려앉는다
    ('H_up', True):    (0.18, 0.64, 0.82, 1.00),
    ('H_down', True):  (0.18, 0.62, 0.82, 1.00),
    ('M_up', False):   (0.04, 0.52, None, 1.00),
    ('M_down', False): (0.04, 0.44, None, 1.00),
    ('M_flat', False): (0.04, 0.32, None, 1.00),   # ㅢ — 짧은기둥이 없다
    ('M_up', True):    (0.04, 0.66, None, 1.00),
    ('M_down', True):  (0.04, 0.60, None, 1.00),
    ('M_flat', True):  (0.04, 0.54, None, 1.00),
}

# 종성 자리 — 4벌. 모음이 오른쪽을 얼마나 차지했는지로 폭이 달라진다.
JONG_GROUP = {}
for v in 'ㅏㅑㅘ':
    JONG_GROUP[v] = 1
for v in 'ㅓㅕㅚㅝㅟㅢㅣ':
    JONG_GROUP[v] = 2
for v in 'ㅐㅒㅔㅖㅙㅞ':
    JONG_GROUP[v] = 3
for v in 'ㅗㅛㅜㅠㅡ':
    JONG_GROUP[v] = 4

JONG_BOX = {
    1: (0.10, 0.00, 0.92, 0.28),
    2: (0.10, 0.00, 0.88, 0.28),
    3: (0.08, 0.00, 0.84, 0.28),
    4: (0.18, 0.00, 0.82, 0.30),
}

# 섞임모임에서 가로줄기가 끝나는 자리 = 모음 먹물의 왼쪽 끝에서 물러난 곳
M_GAP = 0.06


def vclass(v):
    return V_FORMS[v]['kind']


def _leftmost_ink(form):
    """세로요소가 왼쪽으로 가장 멀리 뻗은 지점."""
    left = min(form['stems'])
    for d, _h in form['bars']:
        if d < 0:
            left = min(left, form.get('reach', left))
    return left


def cho_group(v):
    """초성 벌을 가른다."""
    k = vclass(v)
    if k == 'V':
        return 'V'
    if k == 'H':
        return 'H_up' if V_FORMS[v]['tick'] >= 0 else 'H_down'
    h = V_FORMS[v]['h']
    if h == 'ㅡ':
        return 'M_flat'
    return 'M_up' if V_FORMS[h]['tick'] > 0 else 'M_down'


def layout(ch):
    """음절 하나의 자리표를 낸다. 모든 값은 글자틀 비율.

    돌려주는 것
      cho   (초성 글자, 상자)
      jung  요소 목록 — ('stem', x, y0, y1) / ('bar', x0, x1, y) / ('tick', x, y0, y1)
      jong  (종성 글자, 상자) 또는 None
    """
    parts = decompose(ch)
    if not parts:
        return None
    cho, jung, jong = parts
    has = bool(jong)
    form = V_FORMS[jung]
    k = form['kind']
    elems = []

    if k == 'V':
        y0, y1 = STEM_Y[has]
        for x in form['stems']:
            elems.append(('stem', x, y0, y1))
        for d, h in form['bars']:
            yy = y0 + (y1 - y0) * h
            if d > 0:                      # 오른쪽 끝까지
                elems.append(('bar', form['stems'][0], 0.98, yy))
            elif d < 0:                    # 왼쪽으로 뻗는다
                elems.append(('bar', form['reach'], form['stems'][0], yy))
            else:                          # 기둥끼리 잇는다
                elems.append(('bar', form['stems'][0], form['stems'][1], yy))
        cx0, cy0, _cx1, cy1 = CHO_BOX[('V', has)]
        cho_box = (cx0, cy0, form['cho_r'], cy1)

    elif k == 'H':
        bar_y = H_BAR_WITH_JONG[jung] if has else form['bar']
        elems.append(('bar', H_SPAN[0], H_SPAN[1], bar_y))
        tl = TICK_LEN[has]
        for x in form['at']:
            if form['tick'] > 0:
                elems.append(('tick', x, bar_y, bar_y + tl))
            elif form['tick'] < 0:
                elems.append(('tick', x, bar_y - tl, bar_y))
        cho_box = CHO_BOX[(cho_group(jung), has)]

    else:                                   # 섞임모임
        hv, vv = form['h'], form['v']
        hform, vform = V_FORMS[hv], V_FORMS[vv]
        y0, y1 = STEM_Y[has]
        # 세로요소 — 가로모임과 같은 자리에서 조금 오른쪽으로 민다
        shift = 0.02
        stems = [x + shift for x in vform['stems']]
        for x in stems:
            elems.append(('stem', x, y0, y1))
        for d, h in vform['bars']:
            yy = y0 + (y1 - y0) * h
            if d > 0:
                elems.append(('bar', stems[0], 0.98, yy))
            elif d < 0:
                elems.append(('bar', vform['reach'] + shift, stems[0], yy))
            else:
                elems.append(('bar', stems[0], stems[1], yy))
        # 가로요소 — 기둥 앞에서 끊는다
        left_ink = _leftmost_ink(vform) + shift
        bar_x1 = left_ink - M_GAP
        bar_y = H_BAR_WITH_JONG[hv] if has else hform['bar']
        elems.append(('bar', H_SPAN[0], bar_x1, bar_y))
        tl = TICK_LEN[has] * 0.8
        for t in hform['at']:
            tx = H_SPAN[0] + (bar_x1 - H_SPAN[0]) * t
            if hform['tick'] > 0:
                elems.append(('tick', tx, bar_y, bar_y + tl))
            elif hform['tick'] < 0:
                elems.append(('tick', tx, bar_y - tl, bar_y))
        cx0, cy0, _cx1, cy1 = CHO_BOX[(cho_group(jung), has)]
        cho_box = (cx0, cy0, bar_x1, cy1)

    jong_box = JONG_BOX[JONG_GROUP[jung]] if has else None
    return {'cho': (cho, cho_box), 'jung': elems,
            'jong': (jong, jong_box) if has else None}
