# %% [markdown]
# # 주간 프로젝트 4: NumPy만으로 MNIST 98%
#
# 딥러닝 8주 과정 28일차 실습 노트북이다. 강의 페이지의 단계와 같은 순서로 진행한다.
#
# - **런타임**: CPU로 충분하다. NumPy는 GPU를 쓰지 않는다. 처음부터 끝까지 한 번 실행하는 데 Colab 무료 CPU에서 약 10~20분 걸린다.
# - **그래프**: Colab에는 한글 글꼴이 없어 그래프의 축 이름과 범례는 영어로 쓴다.
# - **실험**: `# 바꿔 보기` 표시가 있는 줄은 값을 바꿔 다시 실행해 보는 곳이다.
#
# 목표는 PyTorch 없이 NumPy만으로 만든 다층 퍼셉트론으로 MNIST 테스트 정확도 98% 이상에 도달하는 것이다. 3주차의 미니 프레임워크(minidl)에 4주차의 학습 기법(He 초기화, AdamW, 워밍업과 코사인 스케줄, 드롭아웃, 데이터 증강, 디버깅 절차)을 더한다.

# %% [markdown]
# ## 0. 준비

# %%
import hashlib
import math
import os
import time
import urllib.request

import matplotlib.pyplot as plt
import numpy as np

print("NumPy", np.__version__)

# %% [markdown]
# ## 1. 데이터
#
# MNIST는 28×28 픽셀 흑백 손글씨 숫자 이미지 7만 장이다(학습 6만, 테스트 1만). 픽셀 값은 0(배경)부터 255(획)까지다. Keras가 배포하는 `mnist.npz` 파일(11 MB)을 내려받고, SHA-256 해시로 파일이 온전한지 확인한다.

# %%
URL = "https://storage.googleapis.com/tensorflow/tf-keras-datasets/mnist.npz"
SHA256 = "731c5ac602752760c8e48fbffcf8c3b850d9dc2a2aedcf2cc48468fc17b673d1"
if not os.path.exists("mnist.npz"):
    urllib.request.urlretrieve(URL, "mnist.npz")
with open("mnist.npz", "rb") as f:
    ok = hashlib.sha256(f.read()).hexdigest() == SHA256
assert ok, "파일이 손상되었다. mnist.npz를 지우고 다시 실행한다."
with np.load("mnist.npz") as d:
    x_train, y_train, x_test, y_test = d["x_train"], d["y_train"], d["x_test"], d["y_test"]
print("학습:", x_train.shape, x_train.dtype, "  테스트:", x_test.shape)
print("픽셀 범위:", x_train.min(), "~", x_train.max())
print("클래스별 개수:", np.bincount(y_train))

# %%
fig, axs = plt.subplots(2, 10, figsize=(10, 2.4))
for ax, i in zip(axs.ravel(), range(20)):
    ax.imshow(x_train[i], cmap="gray_r")
    ax.set_title(str(y_train[i]))
    ax.axis("off")
plt.tight_layout()
plt.show()

# %% [markdown]
# 학습 데이터 6만 장 중 1만 장을 **검증 세트**로 떼어 낸다. 하이퍼파라미터는 검증 세트로만 고르고, 테스트 세트는 7단계에서 한 번만 쓴다(12일차).
#
# 입력은 255로 나눠 0~1로 만든 뒤, 학습 세트의 평균과 표준편차로 표준화한다. 평균과 표준편차는 픽셀 전체에 대해 값 하나씩이다. 픽셀마다 따로 표준화하면 늘 0인 테두리 픽셀의 표준편차가 0이 되어 0으로 나누게 된다.

# %%
rng = np.random.default_rng(0)
perm = rng.permutation(len(x_train))
tr_idx, va_idx = perm[:50000], perm[50000:]
X_all = x_train.reshape(len(x_train), -1).astype(np.float32) / 255
MEAN, STD = X_all[tr_idx].mean(), X_all[tr_idx].std()


def prep(X):
    return ((X - MEAN) / STD).astype(np.float32)


Xtr, ytr = prep(X_all[tr_idx]), y_train[tr_idx].astype(np.int64)
Xva, yva = prep(X_all[va_idx]), y_train[va_idx].astype(np.int64)
Xte = prep(x_test.reshape(len(x_test), -1).astype(np.float32) / 255)
yte = y_test.astype(np.int64)
print(f"평균 {MEAN:.4f}, 표준편차 {STD:.4f}")
print("학습", Xtr.shape, "  검증", Xva.shape, "  테스트", Xte.shape)

# %% [markdown]
# ## 2. 모델 부품
#
# 21일차 minidl의 구조를 그대로 따른다. 달라진 점은 네 가지다.
#
# 1. 속도를 위해 `float32`를 쓴다. `float64`보다 메모리가 절반이고 행렬곱이 약 2배 빠르다.
# 2. `params()`가 `(파라미터, 기울기, 감쇠 여부)` 세 값을 낸다. 가중치 감쇠는 가중치에만 적용하고 편향에는 적용하지 않는다.
# 3. 드롭아웃 층이 있다(26일차). `train()`과 `eval()`로 동작이 바뀐다.
# 4. 옵티마이저는 AdamW다(22일차).

# %%
class Module:
    training = True

    def params(self):
        return []

    def train(self):
        self.training = True

    def eval(self):
        self.training = False

    def __call__(self, X):
        return self.forward(X)


class Linear(Module):
    def __init__(self, n_in, n_out, rng, dtype=np.float32):
        std = math.sqrt(2 / n_in)                       # He 초기화 (24일차)
        self.W = (rng.standard_normal((n_in, n_out)) * std).astype(dtype)
        self.b = np.zeros(n_out, dtype)
        self.dW, self.db = np.zeros_like(self.W), np.zeros_like(self.b)

    def forward(self, X):
        self.X = X
        return X @ self.W + self.b

    def backward(self, G):
        self.dW[...] = self.X.T @ G
        self.db[...] = G.sum(0)
        return G @ self.W.T

    def params(self):
        return [(self.W, self.dW, True), (self.b, self.db, False)]


class ReLU(Module):
    def forward(self, X):
        self.mask = X > 0
        return X * self.mask

    def backward(self, G):
        return G * self.mask


class Dropout(Module):
    """역 드롭아웃: 학습 때 확률 p로 0을 만들고 남은 값을 1/(1-p)배 한다.
    평가 때는 입력을 그대로 통과시킨다."""

    def __init__(self, p, rng):
        self.p, self.rng = p, rng

    def forward(self, X):
        if not self.training or self.p == 0:
            return X
        keep = self.rng.random(X.shape, dtype=np.float32) >= self.p
        self.mask = keep.astype(X.dtype) / (1 - self.p)
        return X * self.mask

    def backward(self, G):
        if not self.training or self.p == 0:
            return G
        return G * self.mask


class Sequential(Module):
    def __init__(self, *layers):
        self.layers = layers

    def forward(self, X):
        for layer in self.layers:
            X = layer(X)
        return X

    def backward(self, G):
        for layer in reversed(self.layers):
            G = layer.backward(G)
        return G

    def params(self):
        return [p for layer in self.layers for p in layer.params()]

    def train(self):
        for layer in self.layers:
            layer.train()

    def eval(self):
        for layer in self.layers:
            layer.eval()


class SoftmaxCE:
    """소프트맥스 + 교차 엔트로피. 행마다 최댓값을 빼 넘침을 막는다(11일차)."""

    def forward(self, Z, y):
        Z = Z - Z.max(1, keepdims=True)
        logp = Z - np.log(np.exp(Z).sum(1, keepdims=True))
        self.P, self.y = np.exp(logp), y
        return float(-logp[np.arange(len(y)), y].mean())

    def backward(self):
        G = self.P.copy()
        G[np.arange(len(self.y)), self.y] -= 1
        return G / len(self.y)


def make_mlp(sizes, p_drop=0.0, seed=0, dtype=np.float32):
    r = np.random.default_rng(seed)
    layers = []
    for i in range(len(sizes) - 1):
        layers.append(Linear(sizes[i], sizes[i + 1], r, dtype))
        if i < len(sizes) - 2:
            layers.append(ReLU())
            if p_drop > 0:
                layers.append(Dropout(p_drop, r))
    return Sequential(*layers)


model = make_mlp([784, 256, 128, 10])
print("파라미터 수:", sum(p.size for p, _, _ in model.params()))

# %% [markdown]
# **AdamW와 학습률 스케줄.** 처음 1에폭 동안 학습률을 0에서 최댓값까지 선형으로 올리고(워밍업), 이후 코사인 곡선으로 0까지 내린다(23일차).

# %%
class AdamW:
    def __init__(self, params, lr=1e-3, betas=(0.9, 0.999), eps=1e-8, weight_decay=0.0):
        self.params, self.lr, self.eps, self.wd = params, lr, eps, weight_decay
        self.b1, self.b2 = betas
        self.m = [np.zeros_like(p) for p, _, _ in params]
        self.v = [np.zeros_like(p) for p, _, _ in params]
        self.t = 0

    def step(self):
        self.t += 1
        c1, c2 = 1 - self.b1 ** self.t, 1 - self.b2 ** self.t      # 편향 보정
        for (p, g, decay), m, v in zip(self.params, self.m, self.v):
            m *= self.b1
            m += (1 - self.b1) * g
            v *= self.b2
            v += (1 - self.b2) * g * g
            if decay and self.wd > 0:
                p -= self.lr * self.wd * p                          # 분리된 가중치 감쇠
            p -= self.lr * (m / c1) / (np.sqrt(v / c2) + self.eps)


def lr_at(step, total, lr_max, warmup):
    if step < warmup:
        return lr_max * (step + 1) / warmup
    progress = (step - warmup) / max(1, total - warmup)
    return 0.5 * lr_max * (1 + math.cos(math.pi * progress))


steps = np.arange(3910)
plt.figure(figsize=(6, 2.6))
plt.plot(steps, [lr_at(s, 3910, 1e-3, 391) for s in steps])
plt.xlabel("step (10 epochs x 391 steps)")
plt.ylabel("learning rate")
plt.grid(alpha=.3)
plt.show()

# %% [markdown]
# **데이터 증강.** 학습 배치의 이미지를 상하좌우로 최대 2픽셀씩 무작위로 옮긴다(26일차). 숫자를 조금 옮겨도 레이블은 그대로이므로, 모델은 "위치가 조금 달라도 같은 숫자"라는 사실을 데이터에서 배운다. 빈 곳은 배경값으로 채운다.

# %%
BG = float(prep(np.zeros(1, np.float32))[0])          # 배경(픽셀 0)의 표준화 값


def shift_batch(X, rng, max_shift=2):
    N, s = len(X), max_shift
    imgs = X.reshape(N, 28, 28)
    pad = np.pad(imgs, ((0, 0), (s, s), (s, s)), constant_values=BG)
    dy = rng.integers(0, 2 * s + 1, N)
    dx = rng.integers(0, 2 * s + 1, N)
    out = np.empty_like(imgs)
    for i in range(2 * s + 1):
        for j in range(2 * s + 1):
            sel = (dy == i) & (dx == j)
            out[sel] = pad[sel, i:i + 28, j:j + 28]
    return out.reshape(N, -1)


demo = shift_batch(np.repeat(Xtr[:1], 8, axis=0), np.random.default_rng(0))
fig, axs = plt.subplots(1, 9, figsize=(10, 1.6))
for ax, img, title in zip(axs, [Xtr[0], *demo], ["original"] + ["shifted"] * 8):
    ax.imshow(img.reshape(28, 28), cmap="gray_r")
    ax.axhline(13.5, color="tab:red", lw=0.6)          # 이미지 중심선: 이동을 눈으로 확인
    ax.axvline(13.5, color="tab:red", lw=0.6)
    ax.set_title(title, fontsize=8)
    ax.set_xticks([])
    ax.set_yticks([])
plt.show()

# %% [markdown]
# **평가와 학습 함수.** `fit`은 에폭마다 데이터를 섞고, 미니배치마다 학습률을 정하고, 순전파 → 손실 → 역전파 → 갱신을 반복한 뒤 검증 세트로 평가한다.

# %%
def evaluate(model, X, y, bs=2000):
    """평균 손실과 정확도. 평가 모드로 계산하고 학습 모드로 되돌린다."""
    model.eval()
    loss_fn, tot, correct = SoftmaxCE(), 0.0, 0
    for s in range(0, len(X), bs):
        Z = model(X[s:s + bs])
        tot += loss_fn.forward(Z, y[s:s + bs]) * len(Z)
        correct += (Z.argmax(1) == y[s:s + bs]).sum()
    model.train()
    return tot / len(X), correct / len(X)


def fit(model, epochs=10, lr=1e-3, wd=0.0, bs=128, warmup_epochs=1, aug=0, seed=1,
        verbose=True):
    r = np.random.default_rng(seed)
    loss_fn = SoftmaxCE()
    opt = AdamW(model.params(), lr, weight_decay=wd)
    steps_per_epoch = math.ceil(len(Xtr) / bs)
    total, warmup = epochs * steps_per_epoch, warmup_epochs * steps_per_epoch
    step, hist = 0, []
    for ep in range(epochs):
        t0, run_loss = time.perf_counter(), 0.0
        order = r.permutation(len(Xtr))
        for s in range(0, len(Xtr), bs):
            idx = order[s:s + bs]
            xb = shift_batch(Xtr[idx], r, aug) if aug else Xtr[idx]
            opt.lr = lr_at(step, total, lr, warmup)
            loss = loss_fn.forward(model(xb), ytr[idx])
            model.backward(loss_fn.backward())
            opt.step()
            run_loss += loss * len(idx)
            step += 1
        va_loss, va_acc = evaluate(model, Xva, yva)
        hist.append((run_loss / len(Xtr), va_loss, va_acc))
        if verbose:
            print(f"에폭 {ep + 1:2d}  학습 손실 {hist[-1][0]:.4f}  검증 손실 {va_loss:.4f}  "
                  f"검증 정확도 {va_acc:.4f}  ({time.perf_counter() - t0:.1f}초)")
    return np.array(hist)

# %% [markdown]
# ## 3. 점검: 첫 손실, 기울기 검증, 작은 배치 외우기
#
# 27일차의 디버깅 절차를 전체 학습 전에 적용한다. 세 시험을 모두 통과해야 다음 단계로 간다.
#
# 1. **첫 손실**: 학습 전 손실이 $\ln 10 \approx 2.303$과 같은 자릿수(2~3 정도)여야 한다. 10이 넘거나 `inf`, `nan`이면 초기화나 입력 스케일이 잘못된 것이다.
# 2. **기울기 검증**: 작은 신경망을 `float64`로 만들어 역전파 기울기를 중앙 차분과 비교한다. `float32`는 유효숫자가 7자리 정도라 수치 미분의 오차가 커서 검증에 쓰지 않는다.
# 3. **작은 배치 외우기**: 64장을 200스텝 학습해 손실이 0 가까이 가야 한다.

# %%
model = make_mlp([784, 256, 128, 10])
loss0 = SoftmaxCE().forward(model(Xtr[:1000]), ytr[:1000])
print(f"첫 손실 {loss0:.3f}  (모든 로짓이 같을 때의 값 ln 10 = {math.log(10):.3f})")
# 바꿔 보기: model.layers[-1].W *= 0.1 로 마지막 층을 줄이고 다시 재면 ln 10에 가까워진다.

# %% [markdown]
# 기울기 검증은 20일차와 같다. 다만 원소 하나씩의 상대 오차 대신, 파라미터마다 고른 원소들을 벡터로 묶어 노름으로 비교한다.
#
# $$\text{상대 오차} = \frac{\lVert g_{\text{역전파}} - g_{\text{수치}} \rVert}{\lVert g_{\text{역전파}} \rVert + \lVert g_{\text{수치}} \rVert}$$
#
# MNIST의 테두리 픽셀처럼 기울기가 아주 작은 원소($10^{-5}$ 이하)에서는 수치 미분의 반올림 오차만으로 원소별 상대 오차가 $10^{-6}$을 넘을 수 있기 때문이다.

# %%
def grad_check(model, X, y, n_each=10, h=1e-5, seed=0):
    """파라미터마다 원소 n_each개를 골라 역전파와 중앙 차분을 비교한 노름 상대 오차의 최댓값"""
    loss_fn, r, worst = SoftmaxCE(), np.random.default_rng(seed), 0.0
    loss_fn.forward(model(X), y)
    model.backward(loss_fn.backward())
    for P, G, _ in model.params():
        num, ana = [], []
        for _ in range(n_each):
            idx = tuple(r.integers(0, n) for n in P.shape)
            old = P[idx]
            P[idx] = old + h
            lp = loss_fn.forward(model(X), y)
            P[idx] = old - h
            lm = loss_fn.forward(model(X), y)
            P[idx] = old
            num.append((lp - lm) / (2 * h))
            ana.append(G[idx])
        num, ana = np.array(num), np.array(ana)
        rel = np.linalg.norm(num - ana) / (np.linalg.norm(num) + np.linalg.norm(ana) + 1e-12)
        worst = max(worst, rel)
    return worst


small = make_mlp([784, 32, 16, 10], seed=1, dtype=np.float64)
err = grad_check(small, Xtr[:16].astype(np.float64), ytr[:16])
print(f"상대 오차 {err:.1e}  (1e-6 이하면 통과)")

# %%
tiny = make_mlp([784, 256, 128, 10], seed=2)
opt, loss_fn = AdamW(tiny.params(), lr=1e-3), SoftmaxCE()
xb, yb = Xtr[:64], ytr[:64]
for it in range(200):
    loss = loss_fn.forward(tiny(xb), yb)
    tiny.backward(loss_fn.backward())
    opt.step()
    if it % 50 == 0 or it == 199:
        print(f"스텝 {it:3d}  손실 {loss:.4f}")

# %% [markdown]
# ## 4. 학습률 범위 테스트
#
# 학습률을 $10^{-5}$부터 1까지 스텝마다 지수적으로 키우며 한 번 학습하고, 손실의 지수 이동 평균을 학습률에 대해 그린다(23일차). 손실이 가장 빨리 줄어드는 구간을 찾고, 손실이 다시 커지기 시작하는 학습률보다 충분히 작은 값을 최대 학습률로 고른다.

# %%
def lr_range_test(lr_min=1e-5, lr_max=1.0, steps=300, bs=128, seed=3):
    model = make_mlp([784, 256, 128, 10], seed=seed)
    opt, loss_fn, r = AdamW(model.params()), SoftmaxCE(), np.random.default_rng(seed)
    lrs, losses, avg = [], [], None
    for t in range(steps):
        opt.lr = lr_min * (lr_max / lr_min) ** (t / (steps - 1))
        idx = r.integers(0, len(Xtr), bs)
        loss = loss_fn.forward(model(Xtr[idx]), ytr[idx])
        model.backward(loss_fn.backward())
        opt.step()
        avg = loss if avg is None else 0.9 * avg + 0.1 * loss
        lrs.append(opt.lr)
        losses.append(avg)
        if avg > 4 * min(losses):                       # 발산하면 멈춘다
            break
    return np.array(lrs), np.array(losses)


lrs, losses = lr_range_test()
k = losses.argmin()
print(f"평활 손실이 가장 낮은 학습률 {lrs[k]:.1e},  멈춘 학습률 {lrs[-1]:.1e}")
plt.figure(figsize=(6, 3.2))
plt.semilogx(lrs, losses)
plt.axvline(1e-3, color="gray", ls=":")
plt.xlabel("learning rate")
plt.ylabel("smoothed train loss")
plt.grid(alpha=.3)
plt.show()

# %% [markdown]
# ## 5. 기준 모델
#
# 784-256-128-10 다층 퍼셉트론을 AdamW(최대 학습률 $10^{-3}$, 배치 128)로 10에폭 학습한다. 규제는 아직 쓰지 않는다.

# %%
base = make_mlp([784, 256, 128, 10], seed=0)
t0 = time.perf_counter()
h_base = fit(base, epochs=10, lr=1e-3)                  # 바꿔 보기: epochs, lr
print(f"총 {time.perf_counter() - t0:.0f}초")


def plot_hist(hists, names):
    """왼쪽: 손실(점선 학습, 실선 검증), 오른쪽: 검증 정확도"""
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 3.4))
    for h, name in zip(hists, names):
        ep = np.arange(1, len(h) + 1)
        line, = a1.plot(ep, h[:, 0], "--")
        a1.plot(ep, h[:, 1], "-", color=line.get_color())
        a2.plot(ep, 100 * h[:, 2], "o-", ms=3, color=line.get_color(), label=name)
    a1.plot([], [], "k--", label="train")
    a1.plot([], [], "k-", label="val")
    a1.set_yscale("log")
    a1.set_xlabel("epoch")
    a1.set_ylabel("cross-entropy loss")
    a2.set_xlabel("epoch")
    a2.set_ylabel("val accuracy (%)")
    a2.set_ylim(max(90, 100 * min(h[:, 2].min() for h in hists) - 0.5), None)
    for a in (a1, a2):
        a.grid(alpha=.3)
        a.legend(fontsize=8)
    plt.tight_layout()
    plt.show()


plot_hist([h_base], ["base"])

# %% [markdown]
# 학습 손실은 0.003까지 내려가는데 검증 손실은 0.07 근처에서 멈춘다. 학습 데이터의 손실이 검증 데이터의 20분의 1이다. 모델이 학습 데이터를 외우고 있다는 신호다(과적합, 26일차). 6단계에서 규제와 증강으로 이 간격을 줄인다.
#
# ## 6. 개선 실험
#
# 한 번에 하나씩 바꾸며 **검증 정확도**로 비교한다. 모든 실험은 같은 시드, 같은 에폭 수로 학습한다. 실험 다섯 개를 모두 돌리는 데 Colab에서 5~10분 걸린다.
#
# 같은 설정이라도 시드나 실행 환경에 따라 검증 정확도가 0.1%p 안팎으로 흔들린다. 그보다 작은 차이로는 어느 쪽이 낫다고 결론 내리지 않는다(27일차).

# %%
EPOCHS = 15                                              # 바꿔 보기
experiments = {
    # 이름: (층 크기, 드롭아웃 확률, 이동 증강 픽셀, 가중치 감쇠)
    "base": ([784, 256, 128, 10], 0.0, 0, 0.0),
    "dropout": ([784, 256, 128, 10], 0.2, 0, 0.0),
    "shift": ([784, 256, 128, 10], 0.0, 2, 0.0),
    "dropout+shift": ([784, 256, 128, 10], 0.2, 2, 0.0),
    "wide+all": ([784, 512, 256, 10], 0.2, 2, 0.01),
}
results = {}
for name, (sizes, p, shift, wd) in experiments.items():
    t0 = time.perf_counter()
    m = make_mlp(sizes, p, seed=0)
    h = fit(m, epochs=EPOCHS, lr=1e-3, wd=wd, aug=shift, verbose=False)
    results[name] = (m, h)
    print(f"{name:14s} 검증 정확도 {h[-1, 2]:.4f}  검증 손실 {h[-1, 1]:.4f}  "
          f"학습 손실 {h[-1, 0]:.4f}  ({time.perf_counter() - t0:.0f}초)")

# %%
plot_hist([results[k][1] for k in results], list(results))

# %% [markdown]
# ## 7. 최종 평가와 오류 분석
#
# 검증 정확도가 가장 높은 설정을 고르고, 그 모델로 **테스트 세트를 한 번만** 평가한다. 테스트 결과를 보고 다시 설정을 바꾸면 테스트 세트가 검증 세트 노릇을 하게 되어 성능을 과대평가한다.

# %%
final_name = max(results, key=lambda k: results[k][1][-1, 2])
final = results[final_name][0]
te_loss, te_acc = evaluate(final, Xte, yte)
print(f"선택한 설정: {final_name}")
n_wrong = round((1 - te_acc) * len(yte))
print(f"테스트 정확도 {te_acc:.4f},  테스트 손실 {te_loss:.4f},  틀린 개수 {n_wrong}")

# %%
final.eval()
logits = final(Xte)
final.train()
P = np.exp(logits - logits.max(1, keepdims=True))
P /= P.sum(1, keepdims=True)
pred = P.argmax(1)
cm = np.zeros((10, 10), int)
np.add.at(cm, (yte, pred), 1)

fig, ax = plt.subplots(figsize=(5.2, 4.6))
off = cm.copy()
np.fill_diagonal(off, 0)
im = ax.imshow(off, cmap="Reds")
for i in range(10):
    for j in range(10):
        if cm[i, j]:
            color = "gray" if i == j else ("white" if off[i, j] > off.max() / 2 else "black")
            ax.text(j, i, cm[i, j], ha="center", va="center", fontsize=7, color=color)
ax.set_xticks(range(10))
ax.set_yticks(range(10))
ax.set_xlabel("predicted")
ax.set_ylabel("true")
ax.set_title("confusion matrix (color: errors only)")
plt.colorbar(im, fraction=0.046)
plt.show()
pairs = sorted(((off[i, j], i, j) for i in range(10) for j in range(10)), reverse=True)[:5]
print("가장 많이 헷갈린 쌍 (정답 → 예측: 개수):", [f"{i}→{j}: {n}" for n, i, j in pairs])

# %%
wrong = np.where(pred != yte)[0]
conf = P[wrong, pred[wrong]]
show = wrong[np.argsort(-conf)][:24]                     # 가장 자신 있게 틀린 24개
fig, axs = plt.subplots(3, 8, figsize=(10, 4.2))
for ax, i in zip(axs.ravel(), show):
    ax.imshow(x_test[i], cmap="gray_r")
    ax.set_title(f"true {yte[i]} / pred {pred[i]}\np = {P[i, pred[i]]:.2f}", fontsize=8)
    ax.axis("off")
plt.tight_layout()
plt.show()

# %% [markdown]
# 틀린 이미지 중에는 사람이 봐도 헷갈리는 것(4와 9, 7과 2, 획이 끊긴 숫자)과 레이블 자체가 의심스러운 것이 섞여 있다. 남은 오류의 성격을 보면 다음 개선 방향이 보인다. 위치·모양 변화에 약하다면 증강을, 지역적 획 모양을 놓친다면 5주차의 합성곱 신경망(CNN)이 답이다.
#
# ## 8. 저장과 불러오기

# %%
def state_dict(model):
    return {f"p{i}": p.copy() for i, (p, _, _) in enumerate(model.params())}


def load_state_dict(model, sd):
    for i, (p, _, _) in enumerate(model.params()):
        p[...] = sd[f"p{i}"]


np.savez("mnist_mlp.npz", **state_dict(final))
fresh = make_mlp(experiments[final_name][0], experiments[final_name][1], seed=123)
with np.load("mnist_mlp.npz") as sd:
    load_state_dict(fresh, sd)
print("불러온 모델의 테스트 정확도:", evaluate(fresh, Xte, yte)[1])
print(f"파일 크기 {os.path.getsize('mnist_mlp.npz') / 1e6:.2f} MB")
try:
    from google.colab import files                      # Colab에서만 동작한다
    # files.download("mnist_mlp.npz")                   # 내 컴퓨터로 내려받으려면 주석을 푼다
except ImportError:
    pass

# %% [markdown]
# ## 9. 확장 과제
#
# 1. **가중치 지수 이동 평균(EMA).** 매 스텝 `ema = 0.999 * ema + 0.001 * p`로 파라미터의 이동 평균을 따로 저장하고, 평가에는 이동 평균 가중치를 쓴다(22일차). 검증 정확도가 어떻게 바뀌는가?
# 2. **앙상블.** 시드만 다른 모델 3개의 소프트맥스 확률을 평균해 예측한다(26일차). 개별 모델보다 몇 %p 좋아지는가?
# 3. **배치 정규화.** 25일차의 `BatchNorm` 층을 `Linear`와 `ReLU` 사이에 넣고, 더 큰 학습률(예: 3e-3)로 학습해 비교한다.
# 4. **전체 학습 데이터로 다시 학습.** 하이퍼파라미터를 정한 뒤에는 검증용 1만 장까지 합친 6만 장으로 같은 설정을 다시 학습하는 것이 일반적이다. 이때는 에폭 수를 미리 정해 두어야 한다. 왜인가?
# 5. **회전 증강.** ±10° 회전을 증강에 추가한다. 힌트: `scipy.ndimage.rotate`.
