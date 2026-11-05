# 집필 가이드 (v2)

이 문서는 강의 본문(`content/dayNN.html`)과 시각화, 용어 사전을 작성할 때 지키는 규칙이다.

## 1. 구성

- 8주 × 7일 = 56일. 매주 1~6일차는 강의(각 180분), 7일차는 주간 프로젝트.
- 강의 1개의 시간 배분 기준: 개념 70~90분, 예제·시각화 30~40분, 코드 실습 20~30분, 미니 프로젝트 40~60분.
- 각 `h2`에 `data-min`(분)과 `data-kind`(concept | practice | project | review)를 단다. 상단의 "강의 흐름" 막대가 이 값으로 그려진다.
- 강의 순서: 학습 목표 → 개념 절(정의 → 그림 → 수식 → 숫자 예제 → 코드) → 정리 → 확인 문제 → 연습 문제 → 미니 프로젝트.

## 2. 문체

- 교과서체. 서술은 `~다/~이다`. 목록·요약은 명사형(`~의 최소화`) 또는 `~함/~음`.
- 금지: `~요`, `~세요`, `~죠`, `여러분`, 말을 거는 문장, 감탄문, 이모지, 불필요한 수사("놀랍게도", "자, 이제").
- 문제·과제의 지시문은 `~하라`, `~구하라`, `~비교하라`.
- 한 문단은 3~4문장 이내. 같은 내용을 글로 길게 설명하기보다 그림·표·인터랙티브로 보여 준다.
- 기호는 처음 나올 때 반드시 뜻을 적는다. 수식 뒤에는 숫자를 넣은 예제를 붙인다.

## 3. 마크업 컴포넌트

```html
<ul class="goals"><li>...</li></ul>                                   학습 목표 (맨 앞에 1개)

<h2 data-min="25" data-kind="concept">제목</h2>                      절 (번호는 자동)
<h3>소제목</h3>                                                        소절 (번호는 자동)

<dfn data-t="gradient">그래디언트</dfn>                                용어의 '정의 위치'. 사전의 "설명 위치로 이동"이 여기로 온다.
                                                                        용어마다 전체 강의에서 한 번만 쓴다 (build_index.py가 검사).

<div class="box def" data-title="경사하강법">...</div>               정의
<div class="box key">...</div>                                        핵심 / 정리
<div class="box warn">...</div>                                       주의
<div class="box note">...</div>                                       참고
<div class="box ex" data-title="잔차 계산">...</div>                  예제 (번호 자동)

<figure class="fig"><svg viewBox=...>...</svg><figcaption>...</figcaption></figure>   그림 (번호 자동)
<div class="viz-mount" data-viz="gd"></div>                            인터랙티브 (번호 자동)

<div class="flow"><div>입력</div><div>순전파</div><div>손실</div></div>                 흐름도 (가로, 좁은 화면에서 세로)
<div class="flow v">...</div>                                          흐름도 (세로)
<ol class="steps"><li>...</li></ol>                                    절차 (원 번호)

<pre><code class="language-python">...</code></pre>                     읽기 전용 코드
<pre class="run"><code>...</code></pre>                               브라우저 실행 코드 (Pyodide, 같은 페이지 셀끼리 변수 공유)
                                                                        코드 안의 < > & 는 &lt; &gt; &amp; 로 쓴다.

<script type="application/json" class="quiz">[{"q":"","o":["",""],"a":0,"e":""}]</script>   확인 문제

<ol class="exercises"><li>문제 <details class="sol"><summary>풀이</summary>...</details></li></ol>

<section class="project" data-title="..." data-min="50">              미니 프로젝트
  <p class="lead">무엇을 만드는가</p>
  <ol class="steps"><li>단계 + 실행 셀(TODO 포함)</li></ol>
  <details class="sol"><summary>참고 답안</summary>...</details>
</section>

<ul class="checklist" data-id="w1">...</ul>                            체크리스트 (주간 프로젝트, 상태 저장)
<a class="colab" data-nb="파일명.ipynb">...</a>                         Colab 노트북 버튼
```

SVG 그림은 테마 변수를 쓰는 클래스로 색을 지정한다: `s-ln`(선, 본문색), `s-mu`(보조선), `s-ac`(강조 선), `s-acf`(강조 채움), `s-f`(면), `s-f2`(진한 면), `s-tx`(글자), `s-txm`(보조 글자), `s-red`/`s-grn`/`s-org`(계열색).

## 4. 시각화 규칙

- 모든 축에 이름과 단위가 있어야 한다. 범례가 필요한 색은 반드시 범례를 단다.
- 등고선은 값 레이블을 선 위에 쓰고, 색 막대(colorbar)를 함께 둔다.
- 각 시각화에 "읽는 법"(무엇이 무엇을 뜻하는가)과 "해 볼 것"(조작 과제)을 넣는다.
- 색은 `V.pal()`의 계열색만 쓴다. 다크 모드에서도 읽혀야 한다.

## 5. 데이터

- 브라우저 실습의 실제 데이터: `load_data('digits' | 'iris' | 'breast_cancer' | 'wine')` → 사전(dict) 반환 (`X`, `y`, `feature_names`, `target_names`).
- 출처: UCI Machine Learning Repository (CC BY 4.0). scikit-learn 동봉본을 JSON으로 변환.

## 6. 검증

- `python3 tools/check.py` : 실행 셀 전체 실행, 퀴즈 JSON, `dfn` 중복·누락, 이모지·금지 어미 검사.
- `python3 tools/build_index.py` : 용어 → (정의 강의·위치, 등장 강의) 색인 생성 → `assets/glossary-index.js`.
- 실행 셀의 한 줄은 86자(한글은 2자로 셈) 이내. 화면 폭 1280px 이상에서 가로 스크롤 없이 보이는 폭이다.

## 7. Colab 노트북 (5주차 이후의 대부분과 4주차 프로젝트)

- 원본은 `notebooks/src/이름.py` (퍼센트 형식). `# %%`는 코드 셀, `# %% [markdown]`은 마크다운 셀이고 마크다운 줄은 `# `로 시작한다.
- `python3 tools/make_notebooks.py [이름]` → `notebooks/이름.ipynb` 생성. 강의 본문의 버튼은 `<a class="colab" data-nb="이름.ipynb">`이고, 커리큘럼의 `nb` 필드와 이름이 같아야 한다.
- 원본은 그대로 파이썬 스크립트이므로 전체를 실제로 실행해 검증한 뒤, 강의 본문의 수치와 그림을 그 실행 결과로 채운다. 실행하지 못한 부분이 있으면 본문에 그 사실을 적는다.
- Colab에는 한글 글꼴이 없으므로 그래프의 축 이름·범례·제목은 영어로 쓴다. 마크다운과 `print` 출력은 한국어.
- 외부 데이터는 공식 배포처에서 내려받고 해시로 확인한다. 노트북 첫 셀에 런타임 종류(CPU/GPU)와 예상 실행 시간을 적는다.
- Colab 실습 날의 강의 페이지: 핵심 코드는 읽기 전용 코드 블록으로 보여 주고, 결과는 실제 실행에서 얻은 표와 그림(테마 클래스를 쓰는 SVG)으로 제시한다.
