"""강의 본문 검사기.

- 실행 셀(<pre class="run">) 전부를 페이지 단위로 차례로 실행 (Pyodide 대신 로컬 CPython)
- 확인 문제 JSON, 절(h2)의 data-min/data-kind, 시간 합계, 그림 캡션, 시각화 ID
- 이모지, 금지 어미(~요, ~세요 등), <pre> 안의 이스케이프되지 않은 태그
사용법: python3 tools/check.py [day01 day02 ...] [--no-run]
"""
import contextlib
import glob
import html
import io
import json
import os
import re
import sys
import time
import traceback

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
os.environ.setdefault('MPLBACKEND', 'Agg')

EMOJI = re.compile('[\U0001F300-\U0001FAFF\U00002600-\U000026FF\U00002700-\U000027BF\U0001F000-\U0001F2FF⭐⭕✅❌❓❗]')
POLITE = re.compile(r'(습니다|습니까|어요|아요|에요|예요|해요|세요|이죠|지요|군요|네요|거든요|볼까요|봅시다|합시다|여러분)')
VIZ_IDS = set(re.findall(r"\{ id: '([^']+)'", open(f'{ROOT}/assets/viz/core.js', encoding='utf-8').read()))

PRELUDE = f'''
import json as _json, numpy as _np
import warnings as _w
_w.filterwarnings("ignore", message="Glyph")
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
plt.show = lambda *a, **k: None
def load_data(name):
    d = _json.load(open(r"{ROOT}/assets/data/" + name + ".json", encoding="utf-8"))
    for k in ("X", "y", "images"):
        if k in d: d[k] = _np.array(d[k])
    return d
'''


def text_only(src):
    s = re.sub(r'<script[^>]*>.*?</script>', ' ', src, flags=re.S)
    s = re.sub(r'<pre[^>]*>.*?</pre>', ' ', s, flags=re.S)
    s = re.sub(r'<code[^>]*>.*?</code>', ' ', s, flags=re.S)
    s = re.sub(r'<[^>]+>', ' ', s)
    return html.unescape(s)


def check_file(path, run=True):
    name = os.path.basename(path)
    src = open(path, encoding='utf-8').read()
    errs, warns = [], []
    # 확인 문제
    for q in re.findall(r'<script type="application/json" class="quiz">(.*?)</script>', src, re.S):
        try:
            for it in json.loads(q):
                assert set(it) >= {'q', 'o', 'a'} and 0 <= it['a'] < len(it['o']), it
                for t in [it['q'], it.get('e', '')] + it['o']:
                    if POLITE.search(t):
                        warns.append(f'퀴즈 문체: {t[:50]}')
        except Exception as e:
            errs.append(f'퀴즈 JSON 오류: {e}')
    # 절
    mins = 0
    h2 = re.findall(r'<h2([^>]*)>(.*?)</h2>', src, re.S)
    for attrs, title in h2:
        m = re.search(r'data-min="(\d+)"', attrs)
        k = re.search(r'data-kind="(concept|practice|project|review)"', attrs)
        if not m or not k:
            errs.append(f'h2 속성 누락: {re.sub("<[^>]+>", "", title)[:40]}')
        else:
            mins += int(m.group(1))
    if h2 and not 165 <= mins <= 195:
        warns.append(f'시간 합계 {mins}분 (목표 180분)')
    # 그림, 시각화
    for fig in re.findall(r'<figure class="fig">(.*?)</figure>', src, re.S):
        if '<figcaption>' not in fig:
            errs.append('figcaption 없는 그림')
    for vid in re.findall(r'data-viz="([^"]+)"', src):
        if vid not in VIZ_IDS:
            errs.append(f'알 수 없는 시각화 {vid}')
    # 문체, 이모지
    txt = text_only(src)
    for m in EMOJI.finditer(src):
        errs.append(f'이모지 {m.group(0)!r}')
    for m in POLITE.finditer(txt):
        ctx = txt[max(0, m.start() - 20):m.end() + 5].replace('\n', ' ')
        warns.append(f'문체: …{ctx}…')
    # pre 안의 태그
    for pre in re.findall(r'<pre[^>]*>(.*?)</pre>', src, re.S):
        inner = re.sub(r'^\s*<code[^>]*>|</code>\s*$', '', pre)
        bad = re.findall(r'<[A-Za-z/!][^>]{0,20}', inner)
        if bad:
            errs.append(f'pre 안에 이스케이프되지 않은 태그: {bad[:2]}')
    # 실행
    t0 = time.time()
    nrun = 0
    if run:
        ns = {}
        exec(PRELUDE, ns)
        import matplotlib.pyplot as plt
        for i, b in enumerate(re.findall(r'<pre class="run"><code>(.*?)</code></pre>', src, re.S)):
            code = html.unescape(b)
            nrun += 1
            buf = io.StringIO()
            try:
                with contextlib.redirect_stdout(buf):
                    exec(compile(code, f'{name}[{i + 1}]', 'exec'), ns)
            except Exception as e:
                tb = traceback.format_exc().strip().splitlines()[-4:]
                if '# 연습' in code or 'TODO' in code and isinstance(e, (NameError, TypeError, NotImplementedError, AssertionError)):
                    warns.append(f'셀 {i + 1}: 연습 셀 예외 {e!r}')
                else:
                    errs.append(f'셀 {i + 1} 실행 실패: {e!r} | ' + ' / '.join(tb))
            plt.close('all')
    return errs, warns, nrun, time.time() - t0, mins


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    run = '--no-run' not in sys.argv
    files = sorted(glob.glob(f'{ROOT}/content/day*.html'))
    if args:
        files = [f for f in files if any(os.path.basename(f).startswith(a) for a in args)]
    total = 0
    for f in files:
        errs, warns, n, dt, mins = check_file(f, run)
        status = 'OK ' if not errs else 'ERR'
        print(f'[{status}] {os.path.basename(f)}  셀 {n}개 {dt:.1f}s  {mins}분')
        for e in errs:
            print('   ERROR', e)
        for w in warns[:12]:
            print('   warn ', w)
        if len(warns) > 12:
            print(f'   ... 경고 {len(warns) - 12}개 더')
        total += len(errs)
    print('총 오류', total)
    return 1 if total else 0


if __name__ == '__main__':
    sys.exit(main())
