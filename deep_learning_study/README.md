# 🧠 30일 딥러닝 완전 정복

기초 수학부터 Transformer·생성 모델까지, 30일 동안 개념과 코드를 함께 익히는 인터랙티브 딥러닝 강의 웹사이트입니다.

**사이트**: https://muy-bien-hwa.github.io/For-my-Claude/

## 구성

| 주차 | 내용 | 실습 |
|---|---|---|
| 1주차 (Day 1–7) | 개론, NumPy, 선형대수, 미분, 확률·정보이론, 선형회귀·경사하강법, 로지스틱·소프트맥스 회귀 | 브라우저 실행 |
| 2주차 (Day 8–14) | 퍼셉트론·MLP, 순전파, 역전파(계산 그래프·자동 미분 엔진), NumPy MLP, 옵티마이저, 초기화·정규화, 규제 | 브라우저 + MNIST 프로젝트(Colab) |
| 3주차 (Day 15–21) | PyTorch(+Keras 비교), 학습 루프, CNN, ResNet, 전이학습, RNN·LSTM, 토큰화·임베딩 | Colab |
| 4주차 (Day 22–28) | 어텐션, Transformer, 미니 GPT, LLM(사전학습·RLHF·LoRA), VAE, GAN·확산 모델, 실전 노하우 | 브라우저 + Colab |
| 캡스톤 (Day 29–30) | 나만의 문제 정의 → 베이스라인 → 개선 → 보고서 | Colab 템플릿 |

## 기능

- **진도 체크 / 책갈피**: 날짜별 완료 표시, 소제목마다 🔖 책갈피, 스크롤 위치 자동 저장, "이어서 공부하기"
- **브라우저 파이썬 실행**: NumPy 코드 상자를 페이지 안에서 바로 실행·수정 (Pyodide)
- **인터랙티브 시각화 9종**: 미분, 경사하강법, 활성화 함수, 신경망 놀이터, 계산 그래프, 옵티마이저 경주, 과적합, 합성곱, 어텐션
- **퀴즈**(날마다), **학습 노트**, **용어 사전**, **내 기록**(노트 모아보기, 진도 JSON 내보내기/가져오기), 다크 모드
- **Colab 노트북 11개**: 각 강의 상단 버튼으로 바로 열기

진도·노트·퀴즈 기록은 브라우저(localStorage)에 저장됩니다. 다른 기기로 옮기려면 "내 기록"에서 내보내기/가져오기를 사용하세요.

## 폴더 구조

```
deep_learning_study/
├── index.html            # SPA 셸
├── assets/
│   ├── app.js            # 라우터, 진도·책갈피, 퀴즈, Pyodide 실행기
│   ├── viz.js            # 인터랙티브 시각화
│   ├── curriculum.js     # 30일 커리큘럼 메타데이터
│   ├── glossary.js       # 용어 사전
│   └── style.css
├── content/dayNN.html    # 강의 본문 30개
├── notebooks/*.ipynb     # Colab 실습 노트북 (tools/nbgen.py로 생성)
└── tools/                # 노트북 생성 스크립트
```

## 로컬에서 보기

```bash
cd deep_learning_study && python3 -m http.server 8000
```

브라우저에서 http://localhost:8000 을 엽니다.

## 노트북 다시 생성

```bash
python3 deep_learning_study/tools/nbgen.py
```

## 배포

`main` 브랜치의 `deep_learning_study/`가 바뀌면 GitHub Actions(`.github/workflows/deploy-deep-learning-study.yml`)가 `gh-pages` 브랜치로 배포합니다.
저장소 **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `gh-pages` / `(root)`** 로 설정되어 있어야 합니다.
