// 30일 딥러닝 커리큘럼 메타데이터
window.CURRICULUM = {
  title: "30일 딥러닝 완전 정복",
  weeks: [
    { id: 1, title: "1주차 · 수학과 첫 모델", desc: "딥러닝을 읽기 위한 언어(선형대수·미분·확률)를 익히고, 경사하강법으로 첫 모델을 학습시킵니다." },
    { id: 2, title: "2주차 · 신경망의 원리", desc: "퍼셉트론에서 다층 신경망으로, 역전파를 손으로 유도하고 NumPy로 직접 구현합니다." },
    { id: 3, title: "3주차 · PyTorch와 핵심 아키텍처", desc: "PyTorch로 갈아타고, CNN·RNN·임베딩 등 대표 구조를 실전 코드로 다룹니다." },
    { id: 4, title: "4주차 · 현대 딥러닝", desc: "어텐션과 Transformer, LLM, 생성 모델, 그리고 실전 학습 노하우." },
    { id: 5, title: "캡스톤 · 나만의 모델", desc: "문제 정의부터 배포 직전까지, 혼자 힘으로 딥러닝 프로젝트를 완성합니다." }
  ],
  days: [
    { day: 1,  week: 1, title: "딥러닝이란 무엇인가", time: 90,  tags: ["개론", "환경 세팅"], viz: false },
    { day: 2,  week: 1, title: "NumPy와 텐서", time: 120, tags: ["NumPy", "브로드캐스팅"], runnable: true },
    { day: 3,  week: 1, title: "선형대수 핵심", time: 120, tags: ["벡터", "행렬", "선형변환"], runnable: true },
    { day: 4,  week: 1, title: "미분과 그래디언트", time: 120, tags: ["편미분", "연쇄법칙"], runnable: true, viz: true },
    { day: 5,  week: 1, title: "확률과 정보이론", time: 120, tags: ["최대우도", "교차 엔트로피"], runnable: true },
    { day: 6,  week: 1, title: "선형회귀와 경사하강법", time: 150, tags: ["MSE", "학습률"], runnable: true, viz: true },
    { day: 7,  week: 1, title: "로지스틱 회귀와 분류", time: 150, tags: ["시그모이드", "소프트맥스"], runnable: true, review: true },
    { day: 8,  week: 2, title: "퍼셉트론에서 다층 신경망으로", time: 120, tags: ["XOR", "활성화 함수"], runnable: true, viz: true },
    { day: 9,  week: 2, title: "순전파와 행렬 연산", time: 120, tags: ["배치", "형상(shape)"], runnable: true },
    { day: 10, week: 2, title: "역전파 I — 계산 그래프", time: 150, tags: ["계산 그래프", "국소 미분"], runnable: true, viz: true },
    { day: 11, week: 2, title: "역전파 II — MLP 밑바닥 구현", time: 180, tags: ["NumPy MLP", "기울기 검증"], runnable: true },
    { day: 12, week: 2, title: "옵티마이저", time: 150, tags: ["Momentum", "Adam"], runnable: true, viz: true },
    { day: 13, week: 2, title: "초기화와 정규화", time: 150, tags: ["He 초기화", "BatchNorm"], runnable: true },
    { day: 14, week: 2, title: "과적합과 규제 + 2주차 프로젝트", time: 180, tags: ["Dropout", "L2"], runnable: true, review: true, notebook: "week2_numpy_mlp.ipynb" },
    { day: 15, week: 3, title: "PyTorch 기초 (+ Keras 비교)", time: 150, tags: ["Tensor", "autograd"], notebook: "day15_pytorch_basics.ipynb" },
    { day: 16, week: 3, title: "학습 루프의 정석", time: 150, tags: ["DataLoader", "train/eval"], notebook: "day16_training_loop.ipynb" },
    { day: 17, week: 3, title: "CNN I — 합성곱의 원리", time: 150, tags: ["커널", "패딩", "풀링"], runnable: true, viz: true },
    { day: 18, week: 3, title: "CNN II — 아키텍처의 진화", time: 150, tags: ["VGG", "ResNet"], notebook: "day18_cnn_cifar10.ipynb" },
    { day: 19, week: 3, title: "전이학습과 데이터 증강", time: 120, tags: ["Fine-tuning", "Augmentation"], notebook: "day19_transfer_learning.ipynb" },
    { day: 20, week: 3, title: "RNN · LSTM · GRU", time: 150, tags: ["시퀀스", "BPTT"], runnable: true, notebook: "day20_rnn.ipynb" },
    { day: 21, week: 3, title: "임베딩과 자연어 기초 + 3주차 프로젝트", time: 180, tags: ["토큰화", "word2vec"], review: true, notebook: "week3_cnn_project.ipynb" },
    { day: 22, week: 4, title: "어텐션 메커니즘", time: 150, tags: ["Query/Key/Value"], runnable: true, viz: true },
    { day: 23, week: 4, title: "Transformer 구조", time: 150, tags: ["멀티헤드", "위치 인코딩"], runnable: true },
    { day: 24, week: 4, title: "미니 GPT 밑바닥 구현", time: 180, tags: ["Causal mask", "생성"], notebook: "day24_mini_gpt.ipynb" },
    { day: 25, week: 4, title: "사전학습 모델과 LLM", time: 120, tags: ["BERT/GPT", "LoRA"] },
    { day: 26, week: 4, title: "오토인코더와 VAE", time: 150, tags: ["잠재공간", "ELBO"], notebook: "day26_vae.ipynb" },
    { day: 27, week: 4, title: "GAN과 확산 모델", time: 150, tags: ["GAN", "Diffusion"], notebook: "day27_diffusion.ipynb" },
    { day: 28, week: 4, title: "실전 학습 노하우", time: 120, tags: ["디버깅", "LR 스케줄"], review: true },
    { day: 29, week: 5, title: "캡스톤 I — 설계와 베이스라인", time: 240, tags: ["문제 정의", "베이스라인"], notebook: "capstone_template.ipynb" },
    { day: 30, week: 5, title: "캡스톤 II — 개선·평가·회고", time: 240, tags: ["실험", "회고", "다음 로드맵"], notebook: "capstone_template.ipynb" }
  ]
};
