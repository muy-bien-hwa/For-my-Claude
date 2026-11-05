/* 8주 딥러닝 과정 커리큘럼 (56일 = 8주 × (강의 6일 + 주간 프로젝트 1일)) */
window.CURRICULUM = {
  title: "8주 딥러닝",
  subtitle: "수학 기초부터 트랜스포머·생성 모델까지, 개념과 구현을 함께 익히는 과정",
  minutesPerDay: 180,
  weeks: [
    { id: 1, title: "수학과 도구", desc: "NumPy, 선형대수, 미분, 확률. 딥러닝을 읽고 쓰기 위한 언어." },
    { id: 2, title: "머신러닝 기초", desc: "선형회귀, 경사하강법, 로지스틱·소프트맥스 회귀, 평가와 일반화." },
    { id: 3, title: "신경망의 원리", desc: "퍼셉트론에서 다층 신경망까지. 역전파를 유도하고 직접 구현." },
    { id: 4, title: "신경망 학습 기술", desc: "옵티마이저, 학습률, 초기화, 정규화 층, 규제, 디버깅." },
    { id: 5, title: "PyTorch와 합성곱 신경망", desc: "PyTorch 학습 파이프라인, CNN, ResNet, 전이학습." },
    { id: 6, title: "시퀀스 모델과 자연어 처리", desc: "RNN, LSTM, 토큰화, 임베딩, 언어 모델, Seq2Seq와 어텐션." },
    { id: 7, title: "트랜스포머와 대규모 언어 모델", desc: "셀프 어텐션, 트랜스포머, GPT 구현, 사전학습 모델, LLM, ViT." },
    { id: 8, title: "생성 모델과 실전", desc: "VAE, GAN, 확산 모델, 강화학습, 경량화·배포, 캡스톤." }
  ],
  days: [
    // ---------- 1주차 ----------
    { day: 1, week: 1, kind: "lecture", title: "딥러닝 개관과 학습 환경", summary: "학습의 정의(함수 근사 + 최적화), 학습의 종류, 딥러닝의 구성 요소, 실습 환경.", tags: ["개관", "학습의 정의", "환경"], viz: ["learn-1d"], project: "무차별 탐색으로 섭씨-화씨 관계 학습", runtime: "browser" },
    { day: 2, week: 1, kind: "lecture", title: "NumPy와 텐서", summary: "배열과 형상, 인덱싱, 벡터화, 브로드캐스팅, 축 집계.", tags: ["NumPy", "형상", "브로드캐스팅"], viz: ["broadcast"], project: "NumPy 이미지 처리기", runtime: "browser" },
    { day: 3, week: 1, kind: "lecture", title: "벡터와 행렬", summary: "벡터 연산, 노름, 내적과 코사인 유사도, 투영, 행렬곱의 규칙과 의미.", tags: ["벡터", "내적", "행렬곱"], viz: ["vectors"], project: "코사인 유사도 추천기", runtime: "browser" },
    { day: 4, week: 1, kind: "lecture", title: "선형변환과 행렬 분해", summary: "행렬 = 선형변환, 행렬식, 역행렬, 고윳값, SVD와 PCA.", tags: ["선형변환", "고윳값", "SVD", "PCA"], viz: ["matrix-transform", "svd"], project: "PCA로 손글씨 숫자 시각화와 압축", runtime: "browser" },
    { day: 5, week: 1, kind: "lecture", title: "미분과 그래디언트", summary: "도함수, 연쇄법칙, 편미분, 그래디언트, 등고선, 수치 미분.", tags: ["미분", "연쇄법칙", "그래디언트", "등고선"], viz: ["derivative", "gradient-field"], project: "수치 미분기와 최솟값 탐색", runtime: "browser" },
    { day: 6, week: 1, kind: "lecture", title: "확률·통계와 정보이론", summary: "확률분포, 기댓값, 베이즈 정리, 최대우도추정, 엔트로피, 교차 엔트로피, KL 발산.", tags: ["확률", "MLE", "교차 엔트로피"], viz: ["distributions", "likelihood", "cross-entropy"], project: "나이브 베이즈 스팸 분류기", runtime: "browser" },
    { day: 7, week: 1, kind: "project", title: "주간 프로젝트 1: 손글씨 숫자 탐색과 최근접 중심 분류기", summary: "실제 손글씨 데이터를 NumPy와 선형대수만으로 분석하고 분류.", tags: ["프로젝트", "digits", "PCA"], viz: [], project: "최근접 중심 분류기", runtime: "browser" },
    // ---------- 2주차 ----------
    { day: 8, week: 2, kind: "lecture", title: "선형회귀", summary: "가설 함수, 평균제곱오차, 정규방정식, 다항 특징.", tags: ["선형회귀", "MSE", "정규방정식"], viz: ["regression-fit"], project: "정규방정식 회귀기 구현", runtime: "browser" },
    { day: 9, week: 2, kind: "lecture", title: "경사하강법", summary: "학습률, 손실 지형과 등고선, 배치·확률적·미니배치 경사하강법, 특성 스케일링.", tags: ["경사하강법", "학습률", "SGD"], viz: ["gd-1d", "gd"], project: "경사하강법 회귀와 학습률 실험", runtime: "browser" },
    { day: 10, week: 2, kind: "lecture", title: "로지스틱 회귀와 이진 분류", summary: "시그모이드, 이진 교차 엔트로피, 결정 경계, 비선형 특징.", tags: ["로지스틱 회귀", "시그모이드", "BCE"], viz: ["logistic"], project: "유방암 데이터 이진 분류기", runtime: "browser" },
    { day: 11, week: 2, kind: "lecture", title: "소프트맥스 회귀와 다중 분류", summary: "원-핫, 소프트맥스, 교차 엔트로피, 수치 안정성.", tags: ["소프트맥스", "다중 분류"], viz: ["softmax"], project: "손글씨 숫자 소프트맥스 분류기", runtime: "browser" },
    { day: 12, week: 2, kind: "lecture", title: "모델 평가와 일반화", summary: "데이터 분할, 과적합, 편향-분산, 교차검증, 분류 지표, L1·L2 규제.", tags: ["과적합", "교차검증", "정밀도·재현율"], viz: ["overfit", "threshold"], project: "지표 비교와 교차검증 모델 선택", runtime: "browser" },
    { day: 13, week: 2, kind: "lecture", title: "고전 머신러닝과 데이터 전처리", summary: "kNN, 결정 트리, SVM, k-평균, 스케일링·인코딩·결측치.", tags: ["kNN", "결정 트리", "전처리"], viz: ["knn"], project: "kNN 구현과 스케일링의 영향", runtime: "browser" },
    { day: 14, week: 2, kind: "project", title: "주간 프로젝트 2: 유방암 진단 분류 파이프라인", summary: "탐색 → 전처리 → 학습 → 평가 → 임계값 선택까지 전 과정을 직접 구현.", tags: ["프로젝트", "파이프라인"], viz: [], project: "진단 분류 파이프라인", runtime: "browser" },
    // ---------- 3주차 ----------
    { day: 15, week: 3, kind: "lecture", title: "퍼셉트론과 선형 분리", summary: "인공 뉴런, 퍼셉트론 학습 규칙, 선형 분리 가능성, XOR 문제.", tags: ["퍼셉트론", "XOR"], viz: ["perceptron"], project: "퍼셉트론 학습 과정 추적", runtime: "browser" },
    { day: 16, week: 3, kind: "lecture", title: "다층 퍼셉트론과 활성화 함수", summary: "은닉층, 공간 변환, 활성화 함수, 보편 근사 정리, 깊이의 의미.", tags: ["MLP", "활성화 함수"], viz: ["space-warp", "activation", "playground"], project: "가중치를 직접 설계한 신경망", runtime: "browser" },
    { day: 17, week: 3, kind: "lecture", title: "순전파와 행렬 연산", summary: "층 계산, 배치 처리, 형상 추적, 파라미터 수와 연산량, 층 객체 설계.", tags: ["순전파", "형상", "FLOPs"], viz: ["shapes"], project: "층 객체 기반 순전파 프레임워크", runtime: "browser" },
    { day: 18, week: 3, kind: "lecture", title: "역전파 I: 계산 그래프", summary: "계산 그래프, 국소 기울기, 덧셈·곱셈·분기 노드, 층 단위 역전파 공식.", tags: ["역전파", "계산 그래프"], viz: ["compgraph", "backprop-steps"], project: "2층 신경망 역전파 손계산과 검증", runtime: "browser" },
    { day: 19, week: 3, kind: "lecture", title: "역전파 II: 자동 미분 엔진", summary: "자동 미분, 위상 정렬, 스칼라 자동 미분 엔진 구현.", tags: ["자동 미분", "autograd"], viz: [], project: "자동 미분 엔진 확장과 분류기 학습", runtime: "browser" },
    { day: 20, week: 3, kind: "lecture", title: "NumPy로 다층 퍼셉트론 구현", summary: "층별 forward/backward, 기울기 검증, 학습 루프, 학습 곡선 해석.", tags: ["MLP 구현", "기울기 검증"], viz: [], project: "손글씨 숫자 MLP와 하이퍼파라미터 실험", runtime: "browser" },
    { day: 21, week: 3, kind: "project", title: "주간 프로젝트 3: 미니 딥러닝 프레임워크", summary: "층·손실·옵티마이저·학습기를 갖춘 작은 프레임워크를 설계하고 검증.", tags: ["프로젝트", "프레임워크"], viz: [], project: "미니 프레임워크", runtime: "browser" },
    // ---------- 4주차 ----------
    { day: 22, week: 4, kind: "lecture", title: "옵티마이저", summary: "모멘텀, 네스테로프, AdaGrad, RMSProp, Adam, AdamW, 지수 이동 평균.", tags: ["모멘텀", "Adam"], viz: ["optim", "ema"], project: "옵티마이저 구현과 비교", runtime: "browser" },
    { day: 23, week: 4, kind: "lecture", title: "학습률과 스케줄링", summary: "학습률 탐색, 워밍업, 계단·코사인·원사이클 스케줄, 배치 크기와 학습률.", tags: ["학습률", "스케줄"], viz: ["lr-schedule"], project: "학습률 범위 테스트와 스케줄 비교", runtime: "browser" },
    { day: 24, week: 4, kind: "lecture", title: "가중치 초기화와 기울기 흐름", summary: "대칭성, 분산 보존, Xavier·He 초기화, 기울기 소실·폭발, 클리핑.", tags: ["초기화", "기울기 소실"], viz: ["init"], project: "깊은 망 초기화 실험", runtime: "browser" },
    { day: 25, week: 4, kind: "lecture", title: "정규화 층", summary: "배치 정규화, 층 정규화, 그룹 정규화, RMSNorm.", tags: ["BatchNorm", "LayerNorm"], viz: ["batchnorm"], project: "배치 정규화 구현과 검증", runtime: "browser" },
    { day: 26, week: 4, kind: "lecture", title: "규제와 일반화", summary: "가중치 감쇠, 드롭아웃, 조기 종료, 데이터 증강, 앙상블, 이중 하강.", tags: ["드롭아웃", "가중치 감쇠"], viz: ["dropout", "overfit"], project: "규제 기법 비교 실험", runtime: "browser" },
    { day: 27, week: 4, kind: "lecture", title: "학습 디버깅과 실험 방법론", summary: "디버깅 절차, 증상별 진단, 모니터링, 하이퍼파라미터 탐색, 재현성.", tags: ["디버깅", "실험"], viz: [], project: "버그가 숨은 학습 코드 고치기", runtime: "browser" },
    { day: 28, week: 4, kind: "project", title: "주간 프로젝트 4: NumPy만으로 MNIST 98%", summary: "6만 장의 손글씨 데이터로 직접 만든 신경망을 학습시켜 98%에 도달.", tags: ["프로젝트", "MNIST"], viz: [], project: "NumPy MNIST", runtime: "colab", nb: "w4_numpy_mnist.ipynb" },
    // ---------- 5주차 ----------
    { day: 29, week: 5, kind: "lecture", title: "PyTorch 기초", summary: "텐서, GPU, autograd, nn.Module, 옵티마이저. NumPy·Keras와의 대응.", tags: ["PyTorch", "autograd"], viz: [], project: "NumPy MLP를 PyTorch로 이식", runtime: "colab", nb: "d29_pytorch_basics.ipynb" },
    { day: 30, week: 5, kind: "lecture", title: "학습 파이프라인", summary: "Dataset, DataLoader, 학습·평가 함수, 체크포인트, 재현성, 기록.", tags: ["DataLoader", "학습 루프"], viz: [], project: "Fashion-MNIST 학습 템플릿", runtime: "colab", nb: "d30_training_pipeline.ipynb" },
    { day: 31, week: 5, kind: "lecture", title: "합성곱의 원리", summary: "지역 연결, 가중치 공유, 커널, 패딩·스트라이드, 채널, 풀링.", tags: ["합성곱", "풀링"], viz: ["conv", "conv-shape"], project: "NumPy 합성곱으로 이미지 필터 만들기", runtime: "browser" },
    { day: 32, week: 5, kind: "lecture", title: "CNN 구조와 수용 영역", summary: "특징 계층, 수용 영역, LeNet·AlexNet·VGG, 1×1 합성곱, 전역 평균 풀링.", tags: ["CNN", "수용 영역"], viz: ["receptive-field"], project: "첫 CNN으로 CIFAR-10 분류", runtime: "colab", nb: "d32_first_cnn.ipynb" },
    { day: 33, week: 5, kind: "lecture", title: "ResNet과 현대 CNN", summary: "성능 저하 문제, 잔차 연결, 병목 블록, 깊이별 분리 합성곱.", tags: ["ResNet", "잔차 연결"], viz: ["residual-flow"], project: "평범한 망과 ResNet 비교", runtime: "colab", nb: "d33_resnet.ipynb" },
    { day: 34, week: 5, kind: "lecture", title: "전이학습과 데이터 증강", summary: "특징 추출, 미세조정, 차등 학습률, 증강, Mixup·CutMix.", tags: ["전이학습", "증강"], viz: ["augment"], project: "Flowers102 전이학습", runtime: "colab", nb: "d34_transfer.ipynb" },
    { day: 35, week: 5, kind: "project", title: "주간 프로젝트 5: CIFAR-10 분류기와 Grad-CAM", summary: "93% 이상 분류기를 만들고 Grad-CAM으로 모델이 보는 곳을 해석.", tags: ["프로젝트", "CIFAR-10", "Grad-CAM"], viz: [], project: "CIFAR-10 + Grad-CAM", runtime: "colab", nb: "w5_cifar_gradcam.ipynb" },
    // ---------- 6주차 ----------
    { day: 36, week: 6, kind: "lecture", title: "순환 신경망", summary: "시퀀스 과제, RNN, 시간 펼치기, BPTT, 장기 의존성 문제.", tags: ["RNN", "BPTT"], viz: ["rnn-unroll", "bptt"], project: "NumPy RNN으로 다음 값 예측", runtime: "browser" },
    { day: 37, week: 6, kind: "lecture", title: "LSTM과 GRU", summary: "게이트, 셀 상태, GRU, nn.LSTM의 입출력 형상, 양방향·다층.", tags: ["LSTM", "GRU"], viz: ["lstm-gates"], project: "장기 기억 과제 비교", runtime: "colab", nb: "d37_lstm_gru.ipynb" },
    { day: 38, week: 6, kind: "lecture", title: "텍스트 전처리와 토큰화", summary: "정규화, 문자·단어·서브워드 토큰화, BPE, 한국어 토큰화, 패딩과 마스크.", tags: ["토큰화", "BPE"], viz: ["bpe"], project: "BPE 토크나이저 직접 학습", runtime: "browser" },
    { day: 39, week: 6, kind: "lecture", title: "단어 임베딩", summary: "원-핫의 한계, 분포 가설, word2vec, 임베딩 공간의 구조.", tags: ["임베딩", "word2vec"], viz: ["embedding-space"], project: "word2vec 학습과 유사 단어 검색", runtime: "browser" },
    { day: 40, week: 6, kind: "lecture", title: "텍스트 분류와 언어 모델", summary: "감성 분류, 언어 모델, 퍼플렉서티, 문자 단위 생성, 샘플링.", tags: ["언어 모델", "샘플링"], viz: ["sampling"], project: "문자 단위 LSTM 생성기", runtime: "colab", nb: "d40_char_lm.ipynb" },
    { day: 41, week: 6, kind: "lecture", title: "Seq2Seq와 어텐션의 등장", summary: "인코더-디코더, 정보 병목, 어텐션, 교사 강요, 빔 서치.", tags: ["Seq2Seq", "어텐션"], viz: ["alignment"], project: "날짜 형식 변환기", runtime: "colab", nb: "d41_seq2seq_attention.ipynb" },
    { day: 42, week: 6, kind: "project", title: "주간 프로젝트 6: 한국어 영화 리뷰 감성 분석", summary: "NSMC 20만 리뷰로 TF-IDF 기준선과 LSTM 분류기를 비교.", tags: ["프로젝트", "NSMC"], viz: [], project: "한국어 감성 분석", runtime: "colab", nb: "w6_nsmc.ipynb" },
    // ---------- 7주차 ----------
    { day: 43, week: 7, kind: "lecture", title: "셀프 어텐션", summary: "Query·Key·Value, 스케일드 점곱 어텐션, 마스크, 셀프·크로스 어텐션.", tags: ["셀프 어텐션", "QKV"], viz: ["qkv", "attention"], project: "NumPy 셀프 어텐션과 마스크 실험", runtime: "browser" },
    { day: 44, week: 7, kind: "lecture", title: "트랜스포머 구조", summary: "멀티헤드 어텐션, 위치 인코딩, FFN, 잔차와 층 정규화, 세 가지 구조.", tags: ["트랜스포머", "위치 인코딩"], viz: ["transformer-block", "pos-encoding"], project: "트랜스포머 블록 순전파 구현", runtime: "browser" },
    { day: 45, week: 7, kind: "lecture", title: "GPT 밑바닥 구현", summary: "언어 모델 데이터, GPT 모델, 학습, 생성 전략, KV 캐시.", tags: ["GPT", "생성"], viz: ["sampling"], project: "미니 GPT 학습과 생성 비교", runtime: "colab", nb: "d45_mini_gpt.ipynb" },
    { day: 46, week: 7, kind: "lecture", title: "사전학습 언어 모델과 미세조정", summary: "BERT·GPT·T5, 스케일링 법칙, Hugging Face, 분류 미세조정.", tags: ["BERT", "Hugging Face"], viz: [], project: "사전학습 BERT로 감성 분류", runtime: "colab", nb: "d46_bert_finetune.ipynb" },
    { day: 47, week: 7, kind: "lecture", title: "LLM의 정렬과 활용", summary: "지시 튜닝, RLHF·DPO, LoRA, 프롬프팅, RAG, 한계와 평가.", tags: ["RLHF", "LoRA", "RAG"], viz: ["lora"], project: "작은 RAG 질의응답 시스템", runtime: "colab", nb: "d47_lora_rag.ipynb" },
    { day: 48, week: 7, kind: "lecture", title: "비전 트랜스포머와 멀티모달", summary: "패치 임베딩, ViT, 대조 학습, CLIP, 제로샷 분류.", tags: ["ViT", "CLIP"], viz: ["vit-patches"], project: "CLIP 제로샷 이미지 분류", runtime: "colab", nb: "d48_vit_clip.ipynb" },
    { day: 49, week: 7, kind: "project", title: "주간 프로젝트 7: 나만의 미니 언어 모델", summary: "BPE 토크나이저와 GPT를 직접 학습시켜 원하는 문체의 텍스트를 생성.", tags: ["프로젝트", "GPT"], viz: [], project: "미니 언어 모델", runtime: "colab", nb: "w7_my_lm.ipynb" },
    // ---------- 8주차 ----------
    { day: 50, week: 8, kind: "lecture", title: "오토인코더와 VAE", summary: "생성 모델, 오토인코더, 잠재 공간, ELBO, 재매개변수화.", tags: ["VAE", "잠재 공간"], viz: ["vae-latent"], project: "MNIST VAE와 잠재 공간 지도", runtime: "colab", nb: "d50_vae.ipynb" },
    { day: 51, week: 8, kind: "lecture", title: "생성적 적대 신경망", summary: "적대적 학습, 손실, 불안정성과 모드 붕괴, DCGAN, 평가 지표.", tags: ["GAN", "DCGAN"], viz: ["gan-1d"], project: "DCGAN으로 의류 이미지 생성", runtime: "colab", nb: "d51_dcgan.ipynb" },
    { day: 52, week: 8, kind: "lecture", title: "확산 모델", summary: "순방향·역방향 과정, DDPM 목표, 샘플링, 조건부 생성과 가이던스.", tags: ["확산 모델", "DDPM"], viz: ["diffusion-2d"], project: "조건부 DDPM으로 숫자 생성", runtime: "colab", nb: "d52_ddpm.ipynb" },
    { day: 53, week: 8, kind: "lecture", title: "강화학습 입문", summary: "MDP, 보상과 가치, Q-러닝, 정책 경사, RLHF와의 연결.", tags: ["강화학습", "Q-러닝"], viz: ["gridworld"], project: "Q-러닝으로 미로 탈출", runtime: "browser" },
    { day: 54, week: 8, kind: "lecture", title: "실전 엔지니어링: 경량화와 배포", summary: "혼합 정밀도, 분산 학습, 양자화, 지식 증류, 내보내기와 데모 배포.", tags: ["양자화", "증류", "배포"], viz: ["quantization"], project: "지식 증류와 Gradio 데모", runtime: "colab", nb: "d54_compress_deploy.ipynb" },
    { day: 55, week: 8, kind: "lecture", title: "캡스톤 I: 문제 정의와 베이스라인", summary: "문제 정의서, 데이터 점검, 베이스라인 사다리, 실험 계획.", tags: ["캡스톤"], viz: [], project: "캡스톤 설계와 베이스라인", runtime: "colab", nb: "capstone_template.ipynb" },
    { day: 56, week: 8, kind: "project", title: "주간 프로젝트 8: 캡스톤 II — 개선·평가·보고", summary: "실험 루프로 모델을 개선하고 최종 평가·오류 분석·보고서까지 완성.", tags: ["캡스톤", "보고서"], viz: [], project: "캡스톤 완성", runtime: "colab", nb: "capstone_template.ipynb" }
  ]
};
/* 집필이 끝난 날짜. 나머지는 '준비 중'으로 표시된다. */
window.CURRICULUM.ready = [1, 2, 3, 4, 5, 6, 7];
