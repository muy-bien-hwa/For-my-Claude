"""Colab 실습 노트북 생성기.

사용법: python3 tools/nbgen.py  → notebooks/*.ipynb 생성
노트북 내용은 tools/nb_*.py 의 NOTEBOOKS 사전에 정의되어 있다.
"""
import ast
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "notebooks")
SITE = "https://muy-bien-hwa.github.io/For-my-Claude/"


def md(text):
    return {"cell_type": "markdown", "metadata": {}, "source": text.strip("\n").splitlines(keepends=True)}


def code(text):
    return {"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [],
            "source": text.strip("\n").splitlines(keepends=True)}


def notebook(cells, gpu=True):
    meta = {"kernelspec": {"name": "python3", "display_name": "Python 3"},
            "language_info": {"name": "python"},
            "colab": {"provenance": []}}
    if gpu:
        meta["accelerator"] = "GPU"
        meta["colab"]["gpuType"] = "T4"
    return {"nbformat": 4, "nbformat_minor": 0, "metadata": meta, "cells": cells}


def header(day, title, goals):
    goals_md = "\n".join(f"- {g}" for g in goals)
    return md(f"""# {title}

**30일 딥러닝 완전 정복 · {day}** — 강의 본문: [{SITE}]({SITE})

### 이 노트북에서 할 일
{goals_md}

> ⚙️ **런타임 → 런타임 유형 변경 → T4 GPU** 를 먼저 선택하세요. 셀은 위에서부터 `Shift+Enter`로 실행합니다.
> 그래프 라벨은 Colab 기본 글꼴 문제를 피하려고 영어로 표기했습니다.""")


def build(notebooks):
    os.makedirs(OUT, exist_ok=True)
    bad = 0
    for fname, (gpu, cells) in notebooks.items():
        # 코드 셀 문법 검사 (! 셸 명령과 % 매직은 제외)
        for i, c in enumerate(cells):
            if c["cell_type"] != "code":
                continue
            src = "".join(c["source"])
            py = "\n".join(l for l in src.splitlines() if not l.lstrip().startswith(("!", "%")))
            try:
                ast.parse(py)
            except SyntaxError as e:
                bad += 1
                print(f"[SYNTAX] {fname} cell {i}: {e}")
        with open(os.path.join(OUT, fname), "w", encoding="utf-8") as f:
            json.dump(notebook(cells, gpu), f, ensure_ascii=False, indent=1)
        print(f"wrote {fname}: {len(cells)} cells")
    if bad:
        sys.exit(1)


if __name__ == "__main__":
    sys.path.insert(0, HERE)
    from nb_part1 import NOTEBOOKS as A
    from nb_part2 import NOTEBOOKS as B
    build({**A, **B})
