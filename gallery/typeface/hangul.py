# -*- coding: utf-8 -*-
"""한글 짜임 — 치수는 Pretendard Regular 를 실측해서 맞췄다.

좌표계
  모든 값은 **자폭(advance)에 대한 비율**이다. 가로도 세로도 같은 단위를 쓴다.
  기준선이 y=0, 위가 +. 한글은 기준선 아래로 조금 내려간다.

왜 바꿨나 (v1 의 잘못)
  · 글자가 납작했다. v1 은 0.86w × 0.74h 였는데 Pretendard 는 0.95 × 1.00 으로
    거의 정사각이다. 세로로 눌린 글자는 획 사이가 좁아 보인다.
  · 초성이 글자틀을 세로로 꽉 채웠다. Pretendard 의 초성은 0.19~0.89 만 쓴다.
  · 섞임모임에서 초성을 작은 상자에 가뒀다. Pretendard 는 섞임모임에서도
    초성 폭을 0.51 (기둥 둘이면 0.43) 로 유지한다. 초성이 쪼그라들면
    왼쪽이 비어서 글자가 한 덩어리로 안 읽힌다.
  · 초성과 중성 사이가 좁았다. Pretendard 의 '가' 는 0.172 를 띄운다.

실측값 (Pretendard Regular, 자폭 1770 / em 2048)
  가  초성 x 0.048~0.559  y 0.101~0.805   기둥 0.774   틈 0.172
  기  초성 x 0.053~0.574                  기둥 0.826   틈 0.208
  개  초성 x 0.043~0.473  y 0.126~0.782   기둥 0.629 0.854   틈 0.114
  간  초성 x 0.041~0.555  y 0.294~0.835   기둥 y 0.177~0.912  받침 x 0.197~0.873
  과  초성 x 0.088~0.598  y 0.350~0.802   가로줄기 x 0.030~0.669
  뭬  초성 x 0.091~0.509  y 0.504~0.831   가로줄기 x 0.026~0.562
"""

CHO = list('ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ')
JUNG = list('ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ')
JONG = [''] + list('ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ')


def decompose(ch):
    code = ord(ch) - 0xAC00
    if not (0 <= code < 11172):
        return None
    return CHO[code // 588], JUNG[(code % 588) // 28], JONG[code % 28]


# ── 글자의 세로 범위 ───────────────────────────────────────────────
TOP = 0.905          # 기둥 꼭대기
BOT = -0.085         # 기둥 바닥 (기준선 아래)
LEFT = 0.045         # 먹물 왼쪽 끝
RIGHT = 0.975        # 먹물 오른쪽 끝

# ── 모음 ───────────────────────────────────────────────────────────
# stems  기둥의 x. 언제나 세로로 끝까지 선다.
# bars   곁줄기 (방향, 높이비). +1 오른쪽 끝까지 / -1 reach 까지 / 0 기둥끼리
# cho_r  초성의 오른쪽 한계
V_FORMS = {
    'ㅏ': dict(kind='V', stems=[0.774], bars=[(+1, 0.50)], cho_r=0.560),
    'ㅑ': dict(kind='V', stems=[0.774], bars=[(+1, 0.645), (+1, 0.335)], cho_r=0.560),
    'ㅓ': dict(kind='V', stems=[0.830], bars=[(-1, 0.50)], reach=0.585, cho_r=0.520),
    'ㅕ': dict(kind='V', stems=[0.830], bars=[(-1, 0.645), (-1, 0.335)], reach=0.585, cho_r=0.520),
    'ㅣ': dict(kind='V', stems=[0.826], bars=[], cho_r=0.600),
    'ㅐ': dict(kind='V', stems=[0.629, 0.854], bars=[(0, 0.50)], cho_r=0.475),
    'ㅒ': dict(kind='V', stems=[0.629, 0.854], bars=[(0, 0.645), (0, 0.335)], cho_r=0.475),
    'ㅔ': dict(kind='V', stems=[0.660, 0.858], bars=[(-1, 0.50)], reach=0.470, cho_r=0.378),
    'ㅖ': dict(kind='V', stems=[0.660, 0.858], bars=[(-1, 0.645), (-1, 0.335)], reach=0.470, cho_r=0.378),

    'ㅗ': dict(kind='H', tick=+1, at=[0.50]),
    'ㅛ': dict(kind='H', tick=+1, at=[0.335, 0.665]),
    'ㅜ': dict(kind='H', tick=-1, at=[0.50]),
    'ㅠ': dict(kind='H', tick=-1, at=[0.335, 0.665]),
    'ㅡ': dict(kind='H', tick=0, at=[]),

    'ㅘ': dict(kind='M', h='ㅗ', v='ㅏ'),
    'ㅙ': dict(kind='M', h='ㅗ', v='ㅐ'),
    'ㅚ': dict(kind='M', h='ㅗ', v='ㅣ'),
    'ㅝ': dict(kind='M', h='ㅜ', v='ㅓ'),
    'ㅞ': dict(kind='M', h='ㅜ', v='ㅔ'),
    'ㅟ': dict(kind='M', h='ㅜ', v='ㅣ'),
    'ㅢ': dict(kind='M', h='ㅡ', v='ㅣ'),
}

# ── 세로모임 — 가로줄기 높이와 짧은기둥 길이 ───────────────────────
#            민글자            받침글자
H_BAR = {False: 0.145, True: 0.425}
H_TICK = {False: 0.300, True: 0.195}     # 가로줄기에서 뻗는 길이
H_SPAN = (0.040, 0.955)

# ── 섞임모임 — 가로줄기 ────────────────────────────────────────────
M_BAR = {False: 0.165, True: 0.415}
M_TICK = {False: 0.230, True: 0.165}
M_GAP = 0.098                            # 가로줄기와 기둥 사이
M_BAR_H = 0.42                           # 섞임모임의 곁줄기 높이비 (가로모임보다 낮다)
M_CHO_INSET = 0.050                      # 초성 오른쪽을 가로줄기 끝보다 더 당긴다

# ── 기둥의 세로 범위 ───────────────────────────────────────────────
STEM_Y = {False: (BOT, TOP), True: (0.180, TOP)}

# ── 초성 자리 ──────────────────────────────────────────────────────
# 가로모임·섞임모임은 x1 을 모음이 cho_r 로 덮어쓴다.
CHO_Y = {
    ('V', False): (0.100, 0.805),
    ('V', True):  (0.292, 0.840),
    ('H', False): (0.248, 0.812),        # 아래가 열린 초성은 짧은기둥 옆으로 내려온다
    ('H', True):  (0.479, 0.853),
    ('M', False): (0.350, 0.802),
    ('M', True):  (0.505, 0.845),
}
CHO_X_H = {False: (0.140, 0.850), True: (0.150, 0.840)}

# 아래가 열린 초성(ㄱㅋㅅㅈㅊ…)은 짧은기둥 옆으로 내려와도 부딪히지 않는다.
# 아래가 가로로 막힌 초성(ㄴㄷㄹㅁㅂㅇㅌㅍㅎ)은 짧은기둥 위에 머물러야 한다.
OPEN_BOTTOM = set('ㄱㄲㅅㅆㅈㅉㅊ')
CLOSED_LIFT = 0.075

# ── 받침 높이 ──────────────────────────────────────────────────────
# Pretendard 실측: ㄹ 0.355 · ㅌ 0.331 · ㅂ 0.324 · ㅇ 0.299 · ㅁ 0.296
#                 ㅈ 0.288 · ㄱ 0.274 · ㄴ 0.253
# 획이 많을수록 높다. 셋으로 묶는다.
JONG_BOT = -0.075
JONG_TOP_TALL = 0.352      # ㄹ 계열 — 가로줄기가 셋
JONG_TOP_HIGH = 0.325      # ㅂ ㅃ ㅄ ㅌ ㅍ
JONG_TOP_MID = 0.296       # ㄷ ㄸ ㅁ ㅇ ㅈ ㅉ ㅊ ㅎ
JONG_TOP_LOW = 0.268       # ㄱ ㄲ ㄳ ㄴ ㄵ ㄶ ㅅ ㅆ ㅋ
_TALL = set(['ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ'])
_HIGH = set(['ㅂ', 'ㅃ', 'ㅄ', 'ㅌ', 'ㅍ'])
_MID = set(['ㄷ', 'ㄸ', 'ㅁ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅎ'])


def jong_top(j):
    if j in _TALL:
        return JONG_TOP_TALL
    if j in _HIGH:
        return JONG_TOP_HIGH
    if j in _MID:
        return JONG_TOP_MID
    return JONG_TOP_LOW


STEM_CLEAR = 0.045         # 받침 위로 기둥이 비워야 하는 틈
CHO_CLEAR = 0.025          # 받침 위로 초성이 비워야 하는 틈
CHO_TOP_JONG = 0.845       # 받침글자의 초성 꼭대기

# ── 종성 4벌 — 가로 범위 ───────────────────────────────────────────
JONG_GROUP = {}
for v in 'ㅏㅑㅘ':
    JONG_GROUP[v] = 1
for v in 'ㅓㅕㅚㅝㅟㅢㅣ':
    JONG_GROUP[v] = 2
for v in 'ㅐㅒㅔㅖㅙㅞ':
    JONG_GROUP[v] = 3
for v in 'ㅗㅛㅜㅠㅡ':
    JONG_GROUP[v] = 4

JONG_X = {
    1: (0.190, 0.870),     # ㅏㅑㅘ
    2: (0.200, 0.880),     # ㅓㅕㅣㅚㅝㅟㅢ
    3: (0.228, 0.925),     # ㅐㅒㅔㅖㅙㅞ
    4: (0.165, 0.860),     # ㅗㅛㅜㅠㅡ
}


def vclass(v):
    return V_FORMS[v]['kind']


def _vbars(form, stems, y0, y1, shift=0.0, bar_h=None):
    out = []
    for d, h in form['bars']:
        # 섞임모임에서는 곁줄기를 조금 낮춘다. 초성이 내려올 자리를 비운다.
        if bar_h is not None:
            h = h * (bar_h / 0.50)
        yy = y0 + (y1 - y0) * h
        if d > 0:
            out.append(('bar', stems[0], RIGHT, yy))
        elif d < 0:
            out.append(('bar', form['reach'] + shift, stems[0], yy))
        else:
            out.append(('bar', stems[0], stems[1], yy))
    return out


def layout(ch):
    parts = decompose(ch)
    if not parts:
        return None
    cho, jung, jong = parts
    has = bool(jong)
    form = V_FORMS[jung]
    k = form['kind']
    elems = []

    jtop = jong_top(jong) if has else None

    if k == 'V':
        y0, y1 = (jtop + STEM_CLEAR, TOP) if has else (BOT, TOP)
        for x in form['stems']:
            elems.append(('stem', x, y0, y1))
        elems += _vbars(form, form['stems'], y0, y1)
        if has:
            cho_box = (LEFT, jtop + CHO_CLEAR, form['cho_r'], CHO_TOP_JONG)
        else:
            cy0, cy1 = CHO_Y[('V', False)]
            cho_box = (LEFT, cy0, form['cho_r'], cy1)

    elif k == 'H':
        # 아래로 내려가는 짧은기둥(ㅜㅠ)은 받침과 부딪히므로 가로줄기를 올리고
        # 기둥을 짧게 한다. Pretendard 는 받침 윗부분이 열린 것에 기대 그대로
        # 내려보내지만, 막힌 받침에서는 붙여버린다. 여기서는 떼어 둔다.
        down = form['tick'] < 0
        if has:
            bar_y = jtop + (0.175 if down else 0.105)
            tl = (bar_y - jtop - 0.055) if down else H_TICK[True]
        else:
            bar_y, tl = H_BAR[False], H_TICK[False]
        elems.append(('bar', H_SPAN[0], H_SPAN[1], bar_y))
        for x in form['at']:
            xx = H_SPAN[0] + (H_SPAN[1] - H_SPAN[0]) * x
            if form['tick'] > 0:
                elems.append(('tick', xx, bar_y, bar_y + tl))
            elif form['tick'] < 0:
                elems.append(('tick', xx, bar_y - tl, bar_y))
        cx0, cx1 = CHO_X_H[has]
        cy0, cy1 = CHO_Y[('H', has)]
        # 짧은기둥이 둘(ㅛㅠ)이면 ㅅ·ㅈ·ㅊ 의 벌어진 다리와 부딪힌다.
        # 하나(ㅗㅜ)일 때만 아래가 열린 초성이 옆으로 내려올 수 있다.
        if form['tick'] > 0 and (cho not in OPEN_BOTTOM or len(form['at']) > 1):
            cy0 = max(cy0, bar_y + tl + 0.045)
        elif form['tick'] <= 0:
            cy0 = max(cy0, bar_y + 0.065)
        cho_box = (cx0, cy0, cx1, cy1)

    else:
        hv, vv = form['h'], form['v']
        hform, vform = V_FORMS[hv], V_FORMS[vv]
        y0, y1 = (jtop + STEM_CLEAR, TOP) if has else (BOT, TOP)
        stems = list(vform['stems'])
        for x in stems:
            elems.append(('stem', x, y0, y1))

        # 가로줄기는 '기둥' 앞에서 끊는다
        bar_x1 = min(stems) - M_GAP
        down = hform['tick'] < 0
        if has:
            bar_y = jtop + (0.175 if down else 0.105)
            tl = (bar_y - jtop - 0.055) if down else M_TICK[True]
        else:
            bar_y, tl = M_BAR[False], M_TICK[False]
        elems.append(('bar', H_SPAN[0] - 0.01, bar_x1, bar_y))
        for t in hform['at']:
            tx = (H_SPAN[0] - 0.01) + (bar_x1 - H_SPAN[0] + 0.01) * (0.34 if len(hform['at']) == 1 else t)
            if hform['tick'] > 0:
                elems.append(('tick', tx, bar_y, bar_y + tl))
            elif hform['tick'] < 0:
                elems.append(('tick', tx, bar_y - tl, bar_y))

        # 초성 — 가로줄기(또는 짧은기둥) 위
        cy1 = CHO_TOP_JONG if has else CHO_Y[('M', False)][1]
        cy0 = (jtop + CHO_CLEAR + 0.18) if has else CHO_Y[('M', False)][0]
        if hform['tick'] > 0:
            cy0 = max(cy0, bar_y + tl + 0.040)
        elif hform['tick'] == 0:
            cy0 = max(cy0, bar_y + 0.085)
        else:
            cy0 = max(cy0, bar_y + 0.075)
        if cho not in OPEN_BOTTOM:
            cy0 += CLOSED_LIFT
        cho_box = (LEFT + 0.045, cy0, bar_x1 - M_CHO_INSET, cy1)

        # 곁줄기 — 오른쪽·연결형은 그대로, 왼쪽으로 뻗는 것만 빈 띠에 넣는다.
        # 그러지 않으면 초성의 내려오는 다리를 가로지른다.
        lefts = [h for d, h in vform['bars'] if d < 0]
        others = [(d, h) for d, h in vform['bars'] if d >= 0]
        for d, h in others:
            yy = y0 + (y1 - y0) * h
            elems.append(('bar', stems[0], RIGHT, yy) if d > 0
                         else ('bar', stems[0], stems[1], yy))
        if lefts:
            lo = bar_y + (tl if hform['tick'] > 0 else 0) + 0.055
            hi = cy0 - 0.055
            if hi - lo < 0.055:              # 띠가 좁으면 초성을 당겨 자리를 낸다
                cho_box = (cho_box[0], cho_box[1], min(cho_box[2], vform['reach'] - 0.055), cho_box[3])
                lo, hi = bar_y + 0.055, cy1 - 0.09
            if len(lefts) == 1:
                ys = [(lo + hi) / 2]
            else:
                ys = [lo + (hi - lo) * 0.30, lo + (hi - lo) * 0.74]
            for yy in sorted(ys, reverse=True):
                elems.append(('bar', vform['reach'], stems[0], yy))

    if has:
        jx0, jx1 = JONG_X[JONG_GROUP[jung]]
        jong_box = (jx0, JONG_BOT, jx1, jtop)
    else:
        jong_box = None
    return {'cho': (cho, cho_box), 'jung': elems,
            'jong': (jong, jong_box) if has else None}
