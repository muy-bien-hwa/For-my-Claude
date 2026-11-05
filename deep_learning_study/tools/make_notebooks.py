"""Colab 노트북 생성기.

notebooks/src/이름.py (퍼센트 형식) → notebooks/이름.ipynb

- '# %%' 줄은 코드 셀의 시작, '# %% [markdown]' 줄은 마크다운 셀의 시작이다.
- 마크다운 셀은 각 줄 앞의 '# '를 떼어 낸다.
- 원본은 그대로 파이썬 스크립트이므로 `python3 notebooks/src/이름.py`로 전체를 실행해 검증할 수 있다.
- 마크다운에 금지 어미(~요, ~세요 등)가 있으면 경고한다.

사용법: python3 tools/make_notebooks.py [이름 ...]
"""
import glob
import hashlib
import json
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
POLITE = re.compile(r'(습니다|습니까|어요|아요|에요|예요|해요|세요|이죠|지요|군요|네요|거든요|볼까요|봅시다|합시다|여러분)')
CELL = re.compile(r'^# %%( \[markdown\])?\s*$')


def parse(src):
    cells, cur = [], None
    for line in src.split('\n'):
        m = CELL.match(line)
        if m:
            cur = {'type': 'markdown' if m.group(1) else 'code', 'lines': []}
            cells.append(cur)
            continue
        if cur is not None:
            cur['lines'].append(line)
    out = []
    for c in cells:
        lines = c['lines']
        while lines and not lines[-1].strip():
            lines.pop()
        while lines and not lines[0].strip():
            lines.pop(0)
        if c['type'] == 'markdown':
            lines = [re.sub(r'^# ?', '', l) for l in lines]
        if lines:
            out.append((c['type'], lines))
    return out


def to_ipynb(cells, name):
    nb_cells = []
    for i, (kind, lines) in enumerate(cells):
        cell = {
            'cell_type': kind,
            'metadata': {'id': hashlib.md5(f'{name}-{i}'.encode()).hexdigest()[:12]},
            'source': [l + '\n' for l in lines[:-1]] + [lines[-1]],
        }
        if kind == 'code':
            cell['execution_count'] = None
            cell['outputs'] = []
        nb_cells.append(cell)
    return {
        'nbformat': 4,
        'nbformat_minor': 0,
        'metadata': {
            'colab': {'provenance': [], 'toc_visible': True},
            'kernelspec': {'name': 'python3', 'display_name': 'Python 3'},
            'language_info': {'name': 'python'},
        },
        'cells': nb_cells,
    }


def main(names):
    srcs = [f'{ROOT}/notebooks/src/{n}.py' for n in names] or sorted(glob.glob(f'{ROOT}/notebooks/src/*.py'))
    for path in srcs:
        name = os.path.splitext(os.path.basename(path))[0]
        cells = parse(open(path, encoding='utf-8').read())
        for kind, lines in cells:
            if kind == 'markdown':
                for l in lines:
                    if POLITE.search(l):
                        print(f'  경고 {name}: 금지 어미 → {l.strip()[:60]}')
        nb = to_ipynb(cells, name)
        out = f'{ROOT}/notebooks/{name}.ipynb'
        with open(out, 'w', encoding='utf-8') as f:
            json.dump(nb, f, ensure_ascii=False, indent=1)
            f.write('\n')
        n_code = sum(1 for k, _ in cells if k == 'code')
        print(f'{name}.ipynb  셀 {len(cells)}개 (코드 {n_code}개)')


if __name__ == '__main__':
    main(sys.argv[1:])
