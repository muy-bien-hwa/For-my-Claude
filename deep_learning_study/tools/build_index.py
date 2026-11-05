"""용어 색인 생성: content/dayNN.html 에서 <dfn data-t> (정의 위치)와 용어 등장 강의를 찾아
assets/glossary-index.js 를 만든다.

사용법: python3 tools/build_index.py
"""
import html
import json
import os
import re
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def load_glossary():
    js = ('global.window={};'
          f"eval(require('fs').readFileSync('{ROOT}/assets/glossary.js','utf8'));"
          f"eval(require('fs').readFileSync('{ROOT}/assets/glossary2.js','utf8'));"
          'console.log(JSON.stringify(window.GLOSSARY));')
    return json.loads(subprocess.check_output(['node', '-e', js]))


def strip(s):
    s = re.sub(r'<script[^>]*>.*?</script>', ' ', s, flags=re.S)
    s = re.sub(r'<pre[^>]*>.*?</pre>', ' ', s, flags=re.S)
    s = re.sub(r'<svg[^>]*>.*?</svg>', ' ', s, flags=re.S)
    s = re.sub(r'<[^>]+>', ' ', s)
    return html.unescape(s)


def main():
    G = load_glossary()
    keys = {g['k'] for g in G}
    index = {g['k']: {'def': None, 'days': []} for g in G}
    errors = []
    files = sorted(f for f in os.listdir(f'{ROOT}/content') if re.match(r'day\d\d\.html$', f))
    for f in files:
        day = int(f[3:5])
        src = open(f'{ROOT}/content/{f}', encoding='utf-8').read()
        # 정의 위치: 바로 앞 h2 제목
        h2s = [(m.start(), strip(m.group(1)).strip()) for m in re.finditer(r'<h2[^>]*>(.*?)</h2>', src, re.S)]
        for m in re.finditer(r'<dfn data-t="([^"]+)">', src):
            k = m.group(1)
            if k not in keys:
                errors.append(f'{f}: 사전에 없는 용어 키 {k}')
                continue
            if index[k]['def']:
                errors.append(f"{f}: {k} 중복 정의 (이미 Day {index[k]['def']['day']})")
                continue
            prev = [(i, t) for i, (pos, t) in enumerate(h2s) if pos < m.start()]
            sec = f'{prev[-1][0] + 1}. {prev[-1][1]}' if prev else ''
            index[k]['def'] = {'day': day, 'sec': sec}
        text = strip(src)
        low = text.lower()
        for g in G:
            names = [g['ko']] + g.get('aka', []) + ([g['en']] if g.get('en') else [])
            hit = False
            for nm in names:
                if not nm or len(nm) < 2:
                    continue
                if re.fullmatch(r'[A-Za-z0-9 .\-/]+', nm):
                    if re.search(r'(?<![A-Za-z])' + re.escape(nm.lower()) + r'(?![A-Za-z])', low):
                        hit = True
                        break
                elif nm in text:
                    hit = True
                    break
            if hit:
                index[g['k']]['days'].append(day)
    # 정의된 날을 등장 목록 맨 앞으로
    for k, v in index.items():
        if v['def'] and v['def']['day'] not in v['days']:
            v['days'].insert(0, v['def']['day'])
        v['days'] = sorted(set(v['days']))
    out = {k: v for k, v in index.items() if v['def'] or v['days']}
    with open(f'{ROOT}/assets/glossary-index.js', 'w', encoding='utf-8') as fp:
        fp.write('/* tools/build_index.py 가 생성함. 직접 수정하지 말 것. */\n')
        fp.write('window.GLOSSARY_INDEX = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
    nd = sum(1 for v in index.values() if v['def'])
    print(f'용어 {len(G)}개 중 정의 위치가 있는 용어 {nd}개, 색인 항목 {len(out)}개')
    for e in errors:
        print('ERROR', e)
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
