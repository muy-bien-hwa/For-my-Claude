# 8주 딥러닝

수학 기초부터 트랜스포머·생성 모델까지, 개념과 구현을 함께 익히는 8주(56일) 딥러닝 과정 웹사이트.

**사이트**: https://muy-bien-hwa.github.io/For-my-Claude/

## 구성

하루 180분, 주 6일 강의 + 1일 주간 프로젝트. 모든 강의는 학습 목표 → 개념(그림·수식·예제) → 인터랙티브 시각화 → 실행 코드 → 정리 → 확인 문제 → 연습 문제 → 미니 프로젝트 순서다.

| 주차 | 주제 | 실습 |
|---|---|---|
| 1 | 수학과 도구: NumPy, 선형대수(SVD·PCA), 미분과 등고선, 확률·정보이론 | 브라우저 |
| 2 | 머신러닝 기초: 선형·로지스틱·소프트맥스 회귀, 경사하강법, 평가와 일반화, 고전 ML | 브라우저 |
| 3 | 신경망의 원리: 퍼셉트론, MLP, 순전파, 역전파, 자동 미분 엔진, NumPy MLP | 브라우저 |
| 4 | 학습 기술: 옵티마이저, 학습률 스케줄, 초기화, 정규화 층, 규제, 디버깅 | 브라우저 + Colab |
| 5 | PyTorch와 CNN: 학습 파이프라인, 합성곱, ResNet, 전이학습, Grad-CAM | Colab |
| 6 | 시퀀스와 자연어: RNN, LSTM, 토큰화, 임베딩, 언어 모델, Seq2Seq와 어텐션 | 브라우저 + Colab |
| 7 | 트랜스포머와 LLM: 셀프 어텐션, 트랜스포머, 미니 GPT, BERT, LoRA·RAG, ViT·CLIP | 브라우저 + Colab |
| 8 | 생성 모델과 실전: VAE, GAN, 확산 모델, 강화학습, 경량화·배포, 캡스톤 | 브라우저 + Colab |

완성된 강의부터 순서대로 공개되며, 아직 준비 중인 날짜는 목차에 "준비 중"으로 표시된다.

## 기능

- **진도 관리**: 날짜별 완료, 절마다 책갈피, 읽은 절 자동 표시("강의 흐름" 막대), 스크롤 위치 복원, 학습 노트, 확인 문제 기록, JSON 내보내기·가져오기.
- **용어 사전**: 357개 용어. 한글·영문·초성 검색, 짧은 정의, 처음 설명한 강의 위치로 이동, 등장 강의 목록, 단어장과 카드 복습. 모든 페이지에서 `/` 키로 연다.
- **브라우저 Python**: 1~4주차 코드 칸을 페이지 안에서 실행(Pyodide). 실제 데이터 `load_data("digits" | "iris" | "breast_cancer" | "wine")` 내장.
- **인터랙티브 시각화**: 등고선·3D 곡면·그래디언트, 선형변환, SVD, 확률분포 등. 실험실 페이지에 모아 둠.
- 밝은 회색·어두운 테마, 모바일 레이아웃, 인쇄용 스타일.

진도와 노트는 브라우저(localStorage)에 저장된다. 다른 기기로 옮길 때는 "내 기록"의 내보내기·가져오기를 사용한다.

## 폴더 구조

```
deep_learning_study/
├── index.html                 앱 셸
├── assets/
│   ├── app.js                 라우터, 진도·책갈피, 강의 렌더러, 사전, Pyodide 실행기
│   ├── curriculum.js          56일 커리큘럼과 공개 목록
│   ├── glossary.js, glossary2.js   용어 사전 데이터
│   ├── glossary-index.js      용어 → 정의 위치·등장 강의 색인 (생성됨)
│   ├── viz/core.js            시각화 공통 라이브러리 (좌표계, 등고선, 3D 곡면, 히트맵)
│   ├── viz/w1.js ...          주차별 시각화
│   ├── data/*.json            UCI 데이터셋 (CC BY 4.0)
│   ├── vendor/                KaTeX (MIT), highlight.js (BSD-3)
│   └── style.css
├── content/dayNN.html         강의 본문
├── notebooks/*.ipynb          Colab 노트북 (tools/로 생성)
└── tools/
    ├── AUTHORING.md           집필 규칙 (문체, 마크업 컴포넌트)
    ├── check.py               실행 셀·퀴즈·문체·마크업 검사
    └── build_index.py         용어 색인 생성
```

## 로컬에서 보기와 검사

```bash
cd deep_learning_study && python3 -m http.server 8000
```

```bash
python3 deep_learning_study/tools/check.py
```

```bash
python3 deep_learning_study/tools/build_index.py
```

## 배포

`main` 브랜치의 `deep_learning_study/`가 바뀌면 GitHub Actions(`.github/workflows/deploy-deep-learning-study.yml`)가 `gh-pages` 브랜치로 배포한다. 저장소 **Settings → Pages → Source: Deploy from a branch → Branch: `gh-pages` / `(root)`** 설정이 필요하다.

## 데이터 출처

UCI Machine Learning Repository (CC BY 4.0): Iris (Fisher), Optical Recognition of Handwritten Digits (Alpaydin & Kaynak), Breast Cancer Wisconsin Diagnostic (Wolberg et al.), Wine. scikit-learn 동봉본을 JSON으로 변환했다. 유방암 데이터는 scikit-learn과 달리 y=1이 악성이다.
