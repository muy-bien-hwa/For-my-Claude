# %% [markdown]
# # 29일차: PyTorch 기초
#
# 딥러닝 8주 과정 29일차 실습 노트북이다. 강의 페이지의 절 순서를 따른다.
#
# - **런타임**: CPU로 충분하다. 2절의 CPU·GPU 속도 비교만 GPU 런타임(런타임 → 런타임 유형 변경 → T4 GPU)에서 의미가 있다. GPU가 없으면 그 부분은 건너뛴다.
# - **그래프**: Colab에는 한글 글꼴이 없어 그래프의 축 이름과 범례는 영어로 쓴다.
# - 전체 실행에 CPU에서 5분 안팎 걸린다.

# %%
import hashlib
import math
import os
import time
import urllib.request

import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

print("PyTorch", torch.__version__, " CUDA 사용 가능:", torch.cuda.is_available())

# %% [markdown]
# ## 1. 텐서
#
# 텐서는 NumPy 배열과 거의 같다. 다른 점은 **장치**(CPU, GPU)를 가진다는 것과 **자동 미분**을 위한 기록을 남길 수 있다는 것이다.

# %%
a = torch.tensor([[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]])
print(a)
print("형상", a.shape, " 자료형", a.dtype, " 장치", a.device)
print(torch.zeros(2, 3).dtype, torch.arange(6).dtype)      # 실수의 기본은 float32, 정수는 int64
print(torch.randn(2, 3).shape, torch.ones_like(a).shape)

# %% [markdown]
# **형상 바꾸기.** `reshape`(또는 `view`), `permute`, `unsqueeze`, `squeeze`, `cat`, `stack`을 가장 많이 쓴다. 이미지는 PyTorch에서 (N, C, H, W) 순서다. NumPy·matplotlib의 (H, W, C)와 다르다.

# %%
x = torch.arange(24)
print(x.reshape(2, 3, 4).shape, x.view(4, 6).shape)
img_hwc = torch.rand(32, 32, 3)                            # matplotlib 순서
img_chw = img_hwc.permute(2, 0, 1)                          # PyTorch 순서
batch = img_chw.unsqueeze(0)                                # 배치 축 추가
print(img_chw.shape, batch.shape, batch.squeeze(0).shape)
print(torch.cat([a, a], dim=0).shape, torch.stack([a, a], dim=0).shape)

# %% [markdown]
# **NumPy와 오가기.** `torch.from_numpy`와 `.numpy()`는 메모리를 공유한다(복사하지 않는다). 한쪽을 바꾸면 다른 쪽도 바뀐다. `torch.tensor(배열)`은 복사한다.

# %%
n = np.ones(3)
t = torch.from_numpy(n)
n[0] = 100
print("공유:", t)
t2 = torch.tensor(n)
n[1] = 200
print("복사:", t2)
print("자료형:", t.dtype, "→ float32로:", t.float().dtype)

# %% [markdown]
# **연산.** 브로드캐스팅 규칙은 NumPy와 같다(2일차). 축 인자의 이름이 `axis` 대신 `dim`이다. 이름 끝에 밑줄이 붙은 메서드(`add_`, `zero_`)는 제자리 연산이다.

# %%
W = torch.randn(3, 4)
v = torch.randn(4)
print((W @ v).shape, (W + v).shape, W.sum(dim=0).shape, W.mean(dim=1, keepdim=True).shape)
z = torch.zeros(3)
z.add_(1)
print(z)

# %% [markdown]
# ## 2. GPU
#
# 모델과 데이터는 **같은 장치**에 있어야 한다. `.to(device)`로 옮긴다. GPU 연산은 비동기로 실행되므로 시간을 잴 때는 `torch.cuda.synchronize()`로 연산이 끝나기를 기다린다.

# %%
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("사용할 장치:", device)


def bench(dev, n=4096, reps=5):
    A = torch.randn(n, n, device=dev)
    B = torch.randn(n, n, device=dev)
    A @ B                                                   # 첫 실행(준비)은 빼고 잰다
    if dev.type == "cuda":
        torch.cuda.synchronize()
    t0 = time.perf_counter()
    for _ in range(reps):
        A @ B
    if dev.type == "cuda":
        torch.cuda.synchronize()
    return (time.perf_counter() - t0) / reps


t_cpu = bench(torch.device("cpu"), n=2048)
print(f"CPU 2048×2048 행렬곱: {t_cpu * 1000:.1f} ms  ({2 * 2048 ** 3 / t_cpu / 1e9:.0f} GFLOP/s)")
if device.type == "cuda":
    t_gpu = bench(device, n=2048)
    print(f"GPU 2048×2048 행렬곱: {t_gpu * 1000:.2f} ms  ({2 * 2048 ** 3 / t_gpu / 1e9:.0f} GFLOP/s)")
    print(f"GPU가 약 {t_cpu / t_gpu:.0f}배 빠르다")

# %%
if device.type == "cuda":
    try:
        torch.ones(2, device=device) + torch.ones(2)        # GPU 텐서 + CPU 텐서
    except RuntimeError as e:
        print("장치가 다르면 오류:", str(e).splitlines()[0][:90])
else:
    print("GPU가 없어 장치 불일치 예시는 건너뛴다.")

# %% [markdown]
# ## 3. 자동 미분 (autograd)
#
# `requires_grad=True`인 텐서로 계산하면 PyTorch가 계산 그래프를 **실행하면서** 기록한다. `backward()`를 부르면 그래프를 거꾸로 따라가며 기울기를 `.grad`에 **더한다**. 19일차에 만든 `Value` 엔진과 같은 원리다.

# %%
x = torch.tensor(2.0, requires_grad=True)
y = x ** 3 + 2 * x
y.backward()
print("dy/dx =", x.grad.item(), " (손으로: 3·2² + 2 = 14)")
print("y를 만든 연산:", y.grad_fn)

# %% [markdown]
# 19일차의 예: 뉴런 하나 $s = w_1x_1 + w_2x_2 + b$, $L = -\log \sigma(s)$. `Value` 엔진으로 구한 값($L = 0.3133$, $\partial L/\partial w_1 = 0.2689$, $\partial L/\partial x_1 = -0.5379$, …)과 같아야 한다.

# %%
vals = (2.0, -1.0, -3.0, -2.0, -3.0)
w1, x1, w2, x2, b = (torch.tensor(v, requires_grad=True) for v in vals)
s = w1 * x1 + w2 * x2 + b
L = -torch.log(torch.sigmoid(s))
L.backward()
print(f"L = {L.item():.4f}, ∂w1 = {w1.grad.item():.4f}, ∂x1 = {x1.grad.item():.4f}, "
      f"∂w2 = {w2.grad.item():.4f}, ∂x2 = {x2.grad.item():.4f}, ∂b = {b.grad.item():.4f}")

# %% [markdown]
# **기울기는 누적된다.** `backward()`를 다시 부르면 이전 값에 더해진다. 그래서 학습 루프는 매 스텝 기울기를 0으로 지운다(`zero_grad`).

# %%
w = torch.tensor(1.0, requires_grad=True)
for k in range(3):
    (3 * w).backward()
    print(f"{k + 1}번째 backward 뒤 w.grad = {w.grad.item()}")
w.grad.zero_()
print("지운 뒤:", w.grad.item())

# %% [markdown]
# **기록 끄기.** 평가와 파라미터 갱신은 기록할 필요가 없다. `torch.no_grad()` 안의 계산은 그래프를 만들지 않는다. `detach()`는 그래프에서 떼어 낸 텐서를 돌려준다.

# %%
with torch.no_grad():
    y2 = w * 3
print(y2.requires_grad, (w * 3).requires_grad, (w * 3).detach().requires_grad)

# %% [markdown]
# **자동 미분만으로 선형 회귀.** `nn` 없이 텐서와 autograd만으로 학습 루프를 쓴다. 9일차의 경사하강법과 같고, 기울기 계산만 PyTorch가 한다.

# %%
g = torch.Generator().manual_seed(0)
X = torch.rand(100, 1, generator=g) * 4 - 2
Y = 3 * X + 1 + 0.3 * torch.randn(100, 1, generator=g)
w = torch.zeros(1, requires_grad=True)
b = torch.zeros(1, requires_grad=True)
for step in range(200):
    loss = ((X * w + b - Y) ** 2).mean()
    loss.backward()
    with torch.no_grad():                                   # 갱신은 기록하지 않는다
        w -= 0.1 * w.grad
        b -= 0.1 * b.grad
    w.grad.zero_()
    b.grad.zero_()
print(f"w = {w.item():.3f}, b = {b.item():.3f}, 손실 {loss.item():.4f}  (참값 w = 3, b = 1)")

# %% [markdown]
# ## 4. nn.Module
#
# 층과 모델은 `nn.Module`을 상속한다. `__init__`에서 층을 속성으로 만들면 그 파라미터가 자동으로 등록되고, `forward`에 계산을 쓴다. 모델을 호출하면(`model(x)`) `forward`가 실행된다.

# %%
class MLP(nn.Module):
    def __init__(self, sizes=(784, 256, 128, 10), p_drop=0.0):
        super().__init__()
        self.fc1 = nn.Linear(sizes[0], sizes[1])
        self.fc2 = nn.Linear(sizes[1], sizes[2])
        self.fc3 = nn.Linear(sizes[2], sizes[3])
        self.drop = nn.Dropout(p_drop)

    def forward(self, x):
        x = self.drop(F.relu(self.fc1(x)))
        x = self.drop(F.relu(self.fc2(x)))
        return self.fc3(x)                                  # 로짓 (소프트맥스는 손실 함수 안에서)


model = MLP()
print(model)
print("파라미터 수:", sum(p.numel() for p in model.parameters()))
for name, p in model.named_parameters():
    print(f"  {name:12s} {tuple(p.shape)}")

# %% [markdown]
# 같은 모델을 `nn.Sequential`로 쓸 수도 있다. 층을 순서대로 지나가기만 하면 될 때 편하다.

# %%
seq = nn.Sequential(nn.Linear(784, 256), nn.ReLU(), nn.Linear(256, 128), nn.ReLU(),
                    nn.Linear(128, 10))
print(seq)
print("state_dict 키:", list(seq.state_dict().keys()))

# %% [markdown]
# **학습 모드와 평가 모드.** 드롭아웃과 배치 정규화는 두 모드에서 다르게 동작한다(25, 26일차). `model.train()`과 `model.eval()`로 바꾼다.

# %%
m = MLP(p_drop=0.5)
xin = torch.randn(1, 784)
m.train()
print("학습 모드, 같은 입력 두 번:", m(xin)[0, :3].detach(), m(xin)[0, :3].detach())
m.eval()
print("평가 모드, 같은 입력 두 번:", m(xin)[0, :3].detach(), m(xin)[0, :3].detach())

# %% [markdown]
# ## 5. 손실 함수와 옵티마이저
#
# `nn.CrossEntropyLoss`는 **로짓**과 정수 레이블을 받는다. 안에서 로그-소프트맥스를 안정적으로 계산하므로, 모델 출력에 소프트맥스를 미리 씌우면 안 된다.

# %%
logits = torch.tensor([[2.0, 0.5, -1.0], [0.1, 0.2, 3.0]])
labels = torch.tensor([0, 2])
loss_fn = nn.CrossEntropyLoss()
manual = -(logits.log_softmax(dim=1)[torch.arange(2), labels]).mean()
print(f"CrossEntropyLoss {loss_fn(logits, labels).item():.4f},  직접 계산 {manual.item():.4f}")
print(f"소프트맥스를 먼저 씌우면(잘못): {loss_fn(logits.softmax(dim=1), labels).item():.4f}")

# %% [markdown]
# **표준 학습 단계.** 어떤 모델이든 학습 한 스텝은 다섯 줄이다.
#
# ```python
# optimizer.zero_grad()          # 1. 기울기 지우기
# out = model(xb)                # 2. 순전파
# loss = loss_fn(out, yb)        # 3. 손실
# loss.backward()                # 4. 역전파
# optimizer.step()               # 5. 갱신
# ```
#
# 3절의 선형 회귀를 `nn.Linear`와 `torch.optim.SGD`로 다시 쓴다.

# %%
lin = nn.Linear(1, 1)
opt = torch.optim.SGD(lin.parameters(), lr=0.1)
for step in range(200):
    opt.zero_grad()
    loss = F.mse_loss(lin(X), Y)
    loss.backward()
    opt.step()
print(f"w = {lin.weight.item():.3f}, b = {lin.bias.item():.3f}, 손실 {loss.item():.4f}")

# %% [markdown]
# **학습률 스케줄러.** `torch.optim.lr_scheduler`에 여러 스케줄이 있다. 스텝마다 학습률을 바꾸려면 `scheduler.step()`을 `optimizer.step()` 뒤에 부른다. `LambdaLR`은 "최대 학습률에 곱할 배율"을 함수로 받는다. 28일차의 워밍업 + 코사인 스케줄을 이렇게 쓸 수 있다.

# %%
def warmup_cosine(total, warmup):
    def f(step):
        if step < warmup:
            return (step + 1) / warmup
        return 0.5 * (1 + math.cos(math.pi * (step - warmup) / max(1, total - warmup)))
    return f


opt = torch.optim.AdamW(lin.parameters(), lr=1e-3)
sched = torch.optim.lr_scheduler.LambdaLR(opt, warmup_cosine(total=1000, warmup=100))
lrs = []
for step in range(1000):
    opt.step()
    sched.step()
    lrs.append(opt.param_groups[0]["lr"])
print("스텝 0, 99, 500, 999의 학습률:", [f"{lrs[i]:.2e}" for i in (0, 99, 500, 999)])

# %% [markdown]
# ## 6. 미니 프로젝트: 28일차의 NumPy MLP를 PyTorch로 옮기기
#
# 1. 28일차와 같은 MNIST 파일, 같은 분할, 같은 정규화를 쓴다.
# 2. 같은 가중치를 넣으면 NumPy 구현과 PyTorch 모델의 **출력과 기울기가 같은지** 확인한다.
# 3. 28일차의 최종 설정("넓게 + 모두")으로 학습해 결과를 비교한다.

# %%
URL = "https://storage.googleapis.com/tensorflow/tf-keras-datasets/mnist.npz"
SHA256 = "731c5ac602752760c8e48fbffcf8c3b850d9dc2a2aedcf2cc48468fc17b673d1"
if not os.path.exists("mnist.npz"):
    urllib.request.urlretrieve(URL, "mnist.npz")
with open("mnist.npz", "rb") as f:
    assert hashlib.sha256(f.read()).hexdigest() == SHA256
with np.load("mnist.npz") as d:
    x_train, y_train, x_test, y_test = d["x_train"], d["y_train"], d["x_test"], d["y_test"]
perm = np.random.default_rng(0).permutation(60000)           # 28일차와 같은 분할
tr_idx, va_idx = perm[:50000], perm[50000:]
X_all = x_train.reshape(60000, -1).astype(np.float32) / 255
MEAN, STD = X_all[tr_idx].mean(), X_all[tr_idx].std()
to_t = lambda a: torch.from_numpy(((a - MEAN) / STD).astype(np.float32))
Xtr, Xva = to_t(X_all[tr_idx]), to_t(X_all[va_idx])
Xte = to_t(x_test.reshape(10000, -1).astype(np.float32) / 255)
ytr, yva, yte = (torch.from_numpy(a.astype(np.int64)) for a in (y_train[tr_idx], y_train[va_idx], y_test))
print(Xtr.shape, Xva.shape, Xte.shape, f"평균 {MEAN:.4f} 표준편차 {STD:.4f}")

# %% [markdown]
# **같은 가중치, 같은 결과인가.** 28일차의 NumPy 순전파·역전파를 짧게 다시 쓰고, PyTorch 모델의 가중치를 그대로 복사해 출력과 기울기를 비교한다. `nn.Linear`의 가중치는 (출력, 입력) 형상이라 NumPy의 (입력, 출력)과 전치 관계다.

# %%
def numpy_forward_backward(Ws, bs, X, y):
    hs, a = [X], X
    for i, (W, bias) in enumerate(zip(Ws, bs)):
        a = a @ W + bias
        if i < len(Ws) - 1:
            a = np.maximum(0, a)
        hs.append(a)
    Z = a - a.max(1, keepdims=True)
    P = np.exp(Z) / np.exp(Z).sum(1, keepdims=True)
    loss = -np.log(P[np.arange(len(y)), y]).mean()
    G = P.copy()
    G[np.arange(len(y)), y] -= 1
    G /= len(y)
    dWs, dbs = [], []
    for i in reversed(range(len(Ws))):
        dWs.insert(0, hs[i].T @ G)
        dbs.insert(0, G.sum(0))
        if i > 0:
            G = (G @ Ws[i].T) * (hs[i] > 0)
    return a, loss, dWs, dbs


torch.manual_seed(0)
net = MLP().double()                                        # 비교는 64비트로
xb, yb = Xtr[:64].double(), ytr[:64]
out = net(xb)
loss = F.cross_entropy(out, yb)
loss.backward()
layers = [net.fc1, net.fc2, net.fc3]
Ws = [l.weight.detach().numpy().T.copy() for l in layers]
bs = [l.bias.detach().numpy().copy() for l in layers]
out_np, loss_np, dWs, dbs = numpy_forward_backward(Ws, bs, xb.numpy(), yb.numpy())
print(f"로짓 최대 차이 {np.abs(out.detach().numpy() - out_np).max():.1e},  "
      f"손실 차이 {abs(loss.item() - loss_np):.1e}")
for l, dW, db in zip(layers, dWs, dbs):
    rel = np.abs(l.weight.grad.numpy().T - dW).max() / np.abs(dW).max()
    print(f"  {tuple(l.weight.shape)} 가중치 기울기 상대 차이 {rel:.1e},  "
          f"편향 기울기 최대 차이 {np.abs(l.bias.grad.numpy() - db).max():.1e}")

# %% [markdown]
# **초기화를 맞춘다.** `nn.Linear`의 기본 초기화는 균등분포 $U(-1/\sqrt{n_{\text{in}}}, 1/\sqrt{n_{\text{in}}})$로, 표준편차가 He 초기화의 약 0.41배다. 28일차와 같은 He 초기화를 쓰려면 직접 바꾼다.

# %%
def he_init(model):
    for m in model.modules():
        if isinstance(m, nn.Linear):
            nn.init.kaiming_normal_(m.weight, nonlinearity="relu")
            nn.init.zeros_(m.bias)


lin = nn.Linear(784, 256)
print(f"기본 초기화 표준편차 {lin.weight.std().item():.4f},  He 표준편차 {math.sqrt(2 / 784):.4f}")

# %% [markdown]
# **학습.** 28일차의 "넓게 + 모두" 설정(784-512-256-10, 드롭아웃 0.2, 이동 증강 ±2픽셀, AdamW 학습률 $10^{-3}$, 가중치 감쇠 0.01, 워밍업 1에폭 + 코사인, 15에폭)을 그대로 쓴다. 가중치 감쇠를 가중치에만 적용하려고 파라미터를 두 그룹으로 나눈다.

# %%
def shift_batch(x, max_shift=2):
    """(B, 784) 이미지를 상하좌우로 최대 max_shift 픽셀 옮긴다. 빈 곳은 배경값."""
    B = x.shape[0]
    s = max_shift
    imgs = x.view(B, 1, 28, 28)
    bg = float((0 - MEAN) / STD)
    pad = F.pad(imgs, (s, s, s, s), value=bg)
    i = torch.randint(0, 2 * s + 1, (B,))
    j = torch.randint(0, 2 * s + 1, (B,))
    rows = (i[:, None] + torch.arange(28))[:, None, :, None]
    cols = (j[:, None] + torch.arange(28))[:, None, None, :]
    out = pad[torch.arange(B)[:, None, None, None], 0, rows, cols]
    return out.reshape(B, 784)


def accuracy(model, X, y):
    model.eval()
    with torch.no_grad():
        acc = (model(X.to(device)).argmax(1).cpu() == y).float().mean().item()
    model.train()
    return acc


def fit(model, epochs=15, lr=1e-3, wd=0.01, bs=128, aug=True, seed=1):
    torch.manual_seed(seed)
    decay = [p for p in model.parameters() if p.dim() >= 2]
    no_decay = [p for p in model.parameters() if p.dim() < 2]
    opt = torch.optim.AdamW([{"params": decay, "weight_decay": wd},
                             {"params": no_decay, "weight_decay": 0.0}], lr=lr)
    steps = math.ceil(len(Xtr) / bs)
    sched = torch.optim.lr_scheduler.LambdaLR(opt, warmup_cosine(epochs * steps, steps))
    for ep in range(epochs):
        t0 = time.perf_counter()
        order = torch.randperm(len(Xtr))
        for s in range(0, len(Xtr), bs):
            idx = order[s:s + bs]
            xb = shift_batch(Xtr[idx]) if aug else Xtr[idx]
            xb, yb = xb.to(device), ytr[idx].to(device)
            opt.zero_grad()
            loss = F.cross_entropy(model(xb), yb)
            loss.backward()
            opt.step()
            sched.step()
        if ep % 5 == 4 or ep == 0:
            print(f"에폭 {ep + 1:2d}  마지막 배치 손실 {loss.item():.4f}  "
                  f"검증 정확도 {accuracy(model, Xva, yva):.4f}  ({time.perf_counter() - t0:.1f}초)")
    return model


torch.manual_seed(0)
model = MLP((784, 512, 256, 10), p_drop=0.2)
he_init(model)
model = model.to(device)
t0 = time.perf_counter()
fit(model)
print(f"학습 시간 {time.perf_counter() - t0:.0f}초")
print(f"검증 정확도 {accuracy(model, Xva, yva):.4f},  테스트 정확도 {accuracy(model, Xte, yte):.4f}")

# %% [markdown]
# 28일차의 NumPy 구현은 같은 설정에서 검증 98.67%, 테스트 98.76%였다. 난수의 순서와 일부 연산의 구현이 달라 소수점 셋째 자리는 다르지만 같은 수준이다. 코드는 순전파만 직접 쓰고, 역전파·옵티마이저·스케줄은 PyTorch가 맡는다.
#
# ## 7. 비교: Keras로 같은 모델
#
# Keras는 `compile`과 `fit`이 학습 루프를 감춰 준다. 같은 MLP(증강과 스케줄은 생략)를 3에폭 학습한다. Colab에는 Keras가 설치되어 있다.

# %%
import keras

keras.utils.set_random_seed(0)
model_k = keras.Sequential([
    keras.layers.Input((784,)),
    keras.layers.Dense(512, activation="relu", kernel_initializer="he_normal"),
    keras.layers.Dropout(0.2),
    keras.layers.Dense(256, activation="relu", kernel_initializer="he_normal"),
    keras.layers.Dropout(0.2),
    keras.layers.Dense(10),
])
model_k.compile(optimizer=keras.optimizers.AdamW(learning_rate=1e-3, weight_decay=0.01),
                loss=keras.losses.SparseCategoricalCrossentropy(from_logits=True),
                metrics=["accuracy"])
hist_k = model_k.fit(Xtr.numpy(), ytr.numpy(), batch_size=128, epochs=3,
                     validation_data=(Xva.numpy(), yva.numpy()), verbose=2)
print("Keras 테스트 정확도:", model_k.evaluate(Xte.numpy(), yte.numpy(), verbose=0)[1])

# %% [markdown]
# ## 8. 연습
#
# 1. `MLP`의 `forward`에서 `F.relu`를 `torch.tanh`로 바꾸고 He 초기화 대신 Xavier 초기화(`nn.init.xavier_normal_`)를 써서 다시 학습해 보라.
# 2. `fit`에서 `opt.zero_grad()`를 지우면 무슨 일이 일어나는지 예측하고 실행해 확인하라.
# 3. 학습한 모델의 `state_dict`를 `torch.save`로 저장하고, 새 `MLP`에 `load_state_dict`로 불러와 테스트 정확도가 같은지 확인하라.
