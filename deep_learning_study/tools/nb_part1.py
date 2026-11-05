from nbgen import md, code, header

COMMON_DATA = '''
import numpy as np, torch
from torchvision import datasets
mn_tr = datasets.MNIST("data", train=True, download=True)
mn_te = datasets.MNIST("data", train=False, download=True)
X_all = mn_tr.data.numpy().reshape(-1, 784).astype(np.float32) / 255.0
y_all = mn_tr.targets.numpy()
X_test = mn_te.data.numpy().reshape(-1, 784).astype(np.float32) / 255.0
y_test = mn_te.targets.numpy()
rng = np.random.default_rng(0)
perm = rng.permutation(len(y_all))
tr_idx, va_idx = perm[:55000], perm[55000:]
X_tr, y_tr, X_va, y_va = X_all[tr_idx], y_all[tr_idx], X_all[va_idx], y_all[va_idx]
mu, sd = X_tr.mean(), X_tr.std()                      # 학습 세트 통계로만 정규화
X_tr, X_va, X_test = (X_tr - mu) / sd, (X_va - mu) / sd, (X_test - mu) / sd
print(X_tr.shape, X_va.shape, X_test.shape)
'''

week2 = [
    header("Day 14 · 2주차 프로젝트", "NumPy만으로 MNIST 98% 달성하기",
           ["MNIST 6만 장을 불러와 학습/검증/테스트로 나눈다 (torchvision은 다운로드에만 사용)",
            "2주 동안 만든 부품(Linear, ReLU, Dropout, Softmax-CE, AdamW, 조기 종료)을 조립한다",
            "784-256-128-10 MLP로 테스트 정확도 98% 이상을 목표로 학습한다",
            "학습 곡선·틀린 예시·혼동 행렬로 결과를 분석한다"]),
    md("## 1. 데이터 준비\n학습 55,000 / 검증 5,000 / 테스트 10,000으로 나눕니다. 정규화 통계는 **학습 세트로만** 계산합니다(Day 14 데이터 누수)."),
    code(COMMON_DATA),
    md("## 2. 층 구현 (Day 11, 13, 14)\n모든 층은 `forward`, `backward`, `params`를 가집니다. `params`는 `(파라미터, 기울기, 가중치감쇠 적용여부)`를 돌려줍니다."),
    code('''
class Linear:
    def __init__(self, d_in, d_out):
        self.W = (rng.standard_normal((d_in, d_out)) * np.sqrt(2.0 / d_in)).astype(np.float32)   # He 초기화
        self.b = np.zeros(d_out, np.float32)
        self.dW = np.zeros_like(self.W); self.db = np.zeros_like(self.b)
    def forward(self, x): self.x = x; return x @ self.W + self.b
    def backward(self, g):
        self.dW[...] = self.x.T @ g; self.db[...] = g.sum(0)     # 제자리 대입: params()가 같은 배열을 가리키게
        return g @ self.W.T
    def params(self): return [(self.W, self.dW, True), (self.b, self.db, False)]

class ReLU:
    def forward(self, x): self.m = x > 0; return x * self.m
    def backward(self, g): return g * self.m
    def params(self): return []

class Dropout:
    def __init__(self, p): self.p, self.training = p, True
    def forward(self, x):
        if not self.training or self.p == 0: return x
        self.mask = (rng.random(x.shape) >= self.p).astype(np.float32) / (1 - self.p)
        return x * self.mask
    def backward(self, g): return g * self.mask if (self.training and self.p > 0) else g
    def params(self): return []

class Model:
    def __init__(self, *layers): self.layers = list(layers)
    def forward(self, x):
        for l in self.layers: x = l.forward(x)
        return x
    def backward(self, g):
        for l in reversed(self.layers): g = l.backward(g)
    def params(self): return [p for l in self.layers for p in l.params()]
    def train(self, mode=True):
        for l in self.layers:
            if hasattr(l, "training"): l.training = mode

def softmax_ce(logits, y):
    z = logits - logits.max(1, keepdims=True)
    logp = z - np.log(np.exp(z).sum(1, keepdims=True))
    P = np.exp(logp); g = P.copy(); g[np.arange(len(y)), y] -= 1
    return -logp[np.arange(len(y)), y].mean(), g / len(y)

class AdamW:
    def __init__(self, model, lr=1e-3, wd=1e-4, b1=0.9, b2=0.999, eps=1e-8):
        self.model, self.lr, self.wd, self.b1, self.b2, self.eps, self.t = model, lr, wd, b1, b2, eps, 0
        self.m = [np.zeros_like(p) for p, _, _ in model.params()]
        self.v = [np.zeros_like(p) for p, _, _ in model.params()]
    def step(self):
        self.t += 1
        for (p, g, decay), m, v in zip(self.model.params(), self.m, self.v):
            m *= self.b1; m += (1 - self.b1) * g
            v *= self.b2; v += (1 - self.b2) * g * g
            mh = m / (1 - self.b1 ** self.t); vh = v / (1 - self.b2 ** self.t)
            p -= self.lr * mh / (np.sqrt(vh) + self.eps)
            if decay: p -= self.lr * self.wd * p
'''),
    md("## 3. 기울기 검증\n새 부품을 쓰기 전에 반드시 통과시킵니다 (Day 11)."),
    code('''
def grad_check(model, X, y, n=10, h=1e-3):
    model.train(False)
    X = X.astype(np.float64)
    for l in model.layers:                       # 정밀도를 위해 float64로
        if isinstance(l, Linear): l.W = l.W.astype(np.float64); l.b = l.b.astype(np.float64); l.dW = np.zeros_like(l.W); l.db = np.zeros_like(l.b)
    _, g = softmax_ce(model.forward(X), y); model.backward(g)
    worst = 0
    for p, dp, _ in model.params():
        for _ in range(n):
            i = tuple(rng.integers(0, s) for s in p.shape); old = p[i]
            p[i] = old + h; lp, _ = softmax_ce(model.forward(X), y)
            p[i] = old - h; lm, _ = softmax_ce(model.forward(X), y); p[i] = old
            num = (lp - lm) / (2 * h); worst = max(worst, abs(num - dp[i]) / max(abs(num), abs(dp[i]), 1e-8))
    return worst

small = Model(Linear(784, 16), ReLU(), Linear(16, 10))
print("max relative error:", grad_check(small, X_tr[:8], y_tr[:8]))
'''),
    md("## 4. 학습 (조기 종료 포함)\nCPU에서도 에폭당 수 초~십수 초면 돕니다. 이 프로젝트는 GPU가 필요 없습니다."),
    code('''
import time
model = Model(Linear(784, 256), ReLU(), Dropout(0.2), Linear(256, 128), ReLU(), Dropout(0.2), Linear(128, 10))
opt = AdamW(model, lr=1e-3, wd=1e-4)

def evaluate(X, y, bs=2000):
    model.train(False); losses, correct = [], 0
    for s in range(0, len(y), bs):
        l, _ = softmax_ce(out := model.forward(X[s:s+bs]), y[s:s+bs]); losses.append(l * len(out))
        correct += (out.argmax(1) == y[s:s+bs]).sum()
    return sum(losses) / len(y), correct / len(y)

hist = {"tr_loss": [], "va_loss": [], "va_acc": []}
best, best_params, patience, bad = 0, None, 5, 0
B = 128
for epoch in range(40):
    t0 = time.time(); model.train(True); idx = rng.permutation(len(y_tr)); run = 0
    for s in range(0, len(idx), B):
        bi = idx[s:s+B]
        loss, g = softmax_ce(model.forward(X_tr[bi]), y_tr[bi]); model.backward(g); opt.step(); run += loss * len(bi)
    va_loss, va_acc = evaluate(X_va, y_va)
    hist["tr_loss"].append(run / len(idx)); hist["va_loss"].append(va_loss); hist["va_acc"].append(va_acc)
    print(f"epoch {epoch:2d}  train loss {run/len(idx):.4f}  val loss {va_loss:.4f}  val acc {va_acc:.4f}  ({time.time()-t0:.1f}s)")
    if va_acc > best: best, bad, best_params = va_acc, 0, [p.copy() for p, _, _ in model.params()]
    else:
        bad += 1
        if bad >= patience: print("early stopping"); break
for (p, _, _), bp in zip(model.params(), best_params): p[...] = bp
print("best val acc:", best)
'''),
    md("## 5. 최종 테스트 (딱 한 번!)"),
    code('''
test_loss, test_acc = evaluate(X_test, y_test)
print(f"TEST accuracy: {test_acc:.4f}   {'🎉 목표 달성!' if test_acc >= 0.98 else '조금 더 튜닝해 보세요 (은닉 크기, 드롭아웃, 학습률)'}")
'''),
    md("## 6. 분석"),
    code('''
import matplotlib.pyplot as plt
fig, ax = plt.subplots(1, 2, figsize=(12, 3.5))
ax[0].plot(hist["tr_loss"], label="train"); ax[0].plot(hist["va_loss"], label="val"); ax[0].set_title("loss"); ax[0].legend()
ax[1].plot(hist["va_acc"]); ax[1].set_title("val accuracy"); plt.show()

model.train(False)
pred = model.forward(X_test).argmax(1)
wrong = np.where(pred != y_test)[0][:16]
fig, axs = plt.subplots(2, 8, figsize=(14, 4))
for a, i in zip(axs.ravel(), wrong):
    a.imshow((X_test[i] * sd + mu).reshape(28, 28), cmap="gray"); a.set_title(f"true {y_test[i]} / pred {pred[i]}", fontsize=9); a.axis("off")
plt.tight_layout(); plt.show()

cm = np.zeros((10, 10), int)
for t, p in zip(y_test, pred): cm[t, p] += 1
plt.figure(figsize=(6, 5)); plt.imshow(np.log1p(cm), cmap="Blues"); plt.colorbar(label="log(1+count)")
plt.xlabel("predicted"); plt.ylabel("true"); plt.xticks(range(10)); plt.yticks(range(10)); plt.show()
print("per-class accuracy:", (cm.diagonal() / cm.sum(1)).round(3))
'''),
    md("""## 7. 도전 과제
1. 은닉층을 512-256으로 키우고 드롭아웃을 0.3으로 올려 보세요. 98.5%를 넘길 수 있나요?
2. Day 13의 BatchNorm을 구현해 Linear와 ReLU 사이에 넣어 보세요 (기울기 검증 필수!).
3. 학습률 스케줄(에폭마다 0.9배)을 추가해 보세요.

> 이 노트북의 모든 코드는 여러분이 2주 동안 직접 유도한 것입니다. 다음 주부터는 PyTorch가 이 일을 대신합니다."""),
]

day15 = [
    header("Day 15", "PyTorch 기초와 Keras 비교",
           ["PyTorch 텐서와 GPU 사용법을 익힌다", "autograd 결과를 Day 10의 직접 만든 엔진과 비교한다",
            "nn.Module로 MLP를 정의하고 MNIST를 학습한다", "같은 모델을 Keras로 학습해 비교한다"]),
    code('''
import torch, torch.nn as nn, torch.nn.functional as F
import numpy as np
device = "cuda" if torch.cuda.is_available() else "cpu"
print(torch.__version__, device)
'''),
    md("## 1. 텐서"),
    code('''
x = torch.tensor([[1., 2.], [3., 4.]])
print(x.shape, x.dtype, x.device)
print(x @ x.T)
print(x.sum(dim=0), x.mean(dim=1, keepdim=True))
a = np.ones(3); t = torch.from_numpy(a); a[0] = 100; print("공유 메모리:", t)
z = torch.randn(8, 3, 32, 32)
print(z.view(8, -1).shape, z.permute(0, 2, 3, 1).shape, z.unsqueeze(0).shape)
g = torch.randn(1000, 1000, device=device)
print("GPU 행렬곱:", (g @ g).shape, (g @ g).device)
'''),
    md("## 2. Autograd vs Day 10의 Value 엔진\nDay 10에서 손으로 계산한 값과 같은지 확인하세요: `x.grad=-4, y.grad=-4, z.grad=3`."),
    code('''
x = torch.tensor(-2.0, requires_grad=True); y = torch.tensor(5.0, requires_grad=True); z = torch.tensor(-4.0, requires_grad=True)
f = (x + y) * z
print(f.grad_fn)
f.backward()
print(x.grad, y.grad, z.grad)

# 뉴런 하나 + 손실 (Day 10 테스트 2와 같은 값이 나와야 함: dL/dw = -3.0551, dL/db = -2.0367)
x1 = torch.tensor(1.5); w1 = torch.tensor(-0.8, requires_grad=True); b = torch.tensor(0.5, requires_grad=True)
loss = (torch.tanh(w1 * x1 + b) - 1.0) ** 2
loss.backward()
print(f"loss {loss.item():.4f}  dL/dw {w1.grad.item():.4f}  dL/db {b.grad.item():.4f}")

# 누적 확인: zero_grad를 하지 않으면?
loss = (torch.tanh(w1 * x1 + b) - 1.0) ** 2; loss.backward()
print("두 번째 backward 후 (누적됨):", w1.grad.item())
'''),
    md("## 3. nn.Module과 MNIST 학습"),
    code('''
from torchvision import datasets, transforms
from torch.utils.data import DataLoader
tf = transforms.Compose([transforms.ToTensor(), transforms.Normalize((0.1307,), (0.3081,))])
train_ds = datasets.MNIST("data", train=True, download=True, transform=tf)
test_ds = datasets.MNIST("data", train=False, download=True, transform=tf)
train_dl = DataLoader(train_ds, batch_size=128, shuffle=True, num_workers=2)
test_dl = DataLoader(test_ds, batch_size=512, num_workers=2)

class MLP(nn.Module):
    def __init__(self, d_in=784, d_hidden=256, n_classes=10, p_drop=0.2):
        super().__init__()
        self.fc1 = nn.Linear(d_in, d_hidden); self.fc2 = nn.Linear(d_hidden, d_hidden); self.fc3 = nn.Linear(d_hidden, n_classes)
        self.drop = nn.Dropout(p_drop)
    def forward(self, x):
        x = x.flatten(1)
        x = self.drop(F.relu(self.fc1(x)))
        x = self.drop(F.relu(self.fc2(x)))
        return self.fc3(x)

model = MLP().to(device)
print(model)
print(sum(p.numel() for p in model.parameters()), "parameters")
for n, p in model.named_parameters(): print(n, tuple(p.shape))
'''),
    code('''
opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=0.01)
loss_fn = nn.CrossEntropyLoss()
for epoch in range(5):
    model.train()
    for xb, yb in train_dl:
        xb, yb = xb.to(device), yb.to(device)
        loss = loss_fn(model(xb), yb)
        opt.zero_grad(); loss.backward(); opt.step()
    model.eval(); correct = 0
    with torch.no_grad():
        for xb, yb in test_dl: correct += (model(xb.to(device)).argmax(1) == yb.to(device)).sum().item()
    print(f"epoch {epoch}  last batch loss {loss.item():.4f}  test acc {correct/len(test_ds):.4f}")
'''),
    md("## 4. 흔한 실수 직접 체험\n아래 셀은 **일부러 틀린** 코드입니다. 무엇이 문제인지 먼저 생각해 보고 실행하세요."),
    code('''
# 실수 1: 모델 끝에 softmax를 붙이고 CrossEntropyLoss에 넣기
bad = nn.Sequential(MLP(), nn.Softmax(dim=1)).to(device)
opt_b = torch.optim.AdamW(bad.parameters(), lr=1e-3)
for i, (xb, yb) in enumerate(train_dl):
    loss = loss_fn(bad(xb.to(device)), yb.to(device)); opt_b.zero_grad(); loss.backward(); opt_b.step()
    if i == 300: break
print("softmax 두 번 적용 후 손실:", loss.item(), "← 확률(0~1)이 다시 softmax에 들어가므로 손실이 이론적으로 ln(e+9)-1 ≈ 1.46 아래로 내려갈 수 없다")

# 실수 2: 디바이스 불일치
try:
    model(torch.randn(2, 1, 28, 28))      # 모델은 GPU, 입력은 CPU
except RuntimeError as e:
    print("RuntimeError:", str(e)[:90])
'''),
    md("## 5. 같은 모델을 Keras로\nColab에는 TensorFlow가 설치되어 있습니다. 코드 구조를 PyTorch 버전과 나란히 비교해 보세요."),
    code('''
import tensorflow as tf
from tensorflow import keras
(x_tr, y_tr), (x_te, y_te) = keras.datasets.mnist.load_data()
x_tr, x_te = x_tr / 255.0, x_te / 255.0
kmodel = keras.Sequential([
    keras.layers.Input((28, 28)), keras.layers.Flatten(),
    keras.layers.Dense(256, activation="relu"), keras.layers.Dropout(0.2),
    keras.layers.Dense(256, activation="relu"), keras.layers.Dropout(0.2),
    keras.layers.Dense(10)])
kmodel.compile(optimizer=keras.optimizers.AdamW(1e-3),
               loss=keras.losses.SparseCategoricalCrossentropy(from_logits=True), metrics=["accuracy"])
kmodel.summary()
kmodel.fit(x_tr, y_tr, batch_size=128, epochs=5, validation_split=0.1)
print(kmodel.evaluate(x_te, y_te, verbose=0))
'''),
    md("## 6. 과제\n- PyTorch와 Keras 모델의 파라미터 수가 같은지 확인하세요.\n- `MLP`를 `nn.Sequential` 한 줄 버전으로 다시 작성해 보세요.\n- 학습 루프에서 `model.eval()`을 빼고 평가하면 정확도가 어떻게 달라지나요?"),
]

TEMPLATE_FUNCS = '''
import random, os, json, time
import numpy as np, torch, torch.nn as nn, torch.nn.functional as F
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms
from tqdm.auto import tqdm
device = "cuda" if torch.cuda.is_available() else "cpu"

def seed_everything(seed=42):
    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed); torch.cuda.manual_seed_all(seed)

def train_one_epoch(model, loader, loss_fn, opt, scheduler=None, clip=None, scaler=None):
    model.train(); tot, correct, n = 0.0, 0, 0
    for xb, yb in tqdm(loader, leave=False):
        xb, yb = xb.to(device, non_blocking=True), yb.to(device, non_blocking=True)
        with torch.autocast(device_type="cuda", dtype=torch.float16, enabled=scaler is not None):
            logits = model(xb); loss = loss_fn(logits, yb)
        opt.zero_grad(set_to_none=True)
        if scaler is not None:
            scaler.scale(loss).backward()
            if clip: scaler.unscale_(opt); torch.nn.utils.clip_grad_norm_(model.parameters(), clip)
            scaler.step(opt); scaler.update()
        else:
            loss.backward()
            if clip: torch.nn.utils.clip_grad_norm_(model.parameters(), clip)
            opt.step()
        if scheduler is not None: scheduler.step()
        tot += loss.item() * len(yb); correct += (logits.argmax(1) == yb).sum().item(); n += len(yb)
    return tot / n, correct / n

@torch.no_grad()
def evaluate(model, loader, loss_fn):
    model.eval(); tot, correct, n = 0.0, 0, 0
    for xb, yb in loader:
        xb, yb = xb.to(device), yb.to(device)
        logits = model(xb); tot += loss_fn(logits, yb).item() * len(yb)
        correct += (logits.argmax(1) == yb).sum().item(); n += len(yb)
    return tot / n, correct / n

def save_ckpt(path, model, opt, epoch, best):
    torch.save({"model": model.state_dict(), "opt": opt.state_dict(), "epoch": epoch, "best": best}, path)

def load_ckpt(path, model, opt=None):
    ck = torch.load(path, map_location=device)
    model.load_state_dict(ck["model"])
    if opt is not None: opt.load_state_dict(ck["opt"])
    return ck["epoch"], ck["best"]

def fit(model, train_dl, val_dl, epochs, lr=1e-3, wd=0.05, ckpt="best.pt", patience=None, label_smoothing=0.0, amp=True, sgd=False):
    loss_fn = nn.CrossEntropyLoss(label_smoothing=label_smoothing)
    if sgd: opt = torch.optim.SGD(model.parameters(), lr=lr, momentum=0.9, nesterov=True, weight_decay=wd)
    else:   opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=wd)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=lr, total_steps=epochs * len(train_dl), pct_start=0.15)
    scaler = torch.amp.GradScaler("cuda") if (amp and device == "cuda") else None
    hist = {k: [] for k in ["tr_loss", "tr_acc", "va_loss", "va_acc"]}; best, bad = 0.0, 0
    for ep in range(epochs):
        t0 = time.time()
        tl, ta = train_one_epoch(model, train_dl, loss_fn, opt, sched, clip=1.0, scaler=scaler)
        vl, va = evaluate(model, val_dl, nn.CrossEntropyLoss())
        for k, v in zip(hist, [tl, ta, vl, va]): hist[k].append(v)
        print(f"[{ep+1:02d}/{epochs}] train {tl:.4f}/{ta:.3f}  val {vl:.4f}/{va:.3f}  lr {opt.param_groups[0]['lr']:.2e}  {time.time()-t0:.0f}s")
        if va > best: best, bad = va, 0; save_ckpt(ckpt, model, opt, ep, best)
        else:
            bad += 1
            if patience and bad >= patience: print("early stopping"); break
    load_ckpt(ckpt, model)
    return hist

def plot_hist(hist, title=""):
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(1, 2, figsize=(12, 3.5))
    ax[0].plot(hist["tr_loss"], label="train"); ax[0].plot(hist["va_loss"], label="val"); ax[0].set_title(f"{title} loss"); ax[0].legend()
    ax[1].plot(hist["tr_acc"], label="train"); ax[1].plot(hist["va_acc"], label="val"); ax[1].set_title(f"{title} accuracy"); ax[1].legend()
    plt.show()
print("template ready on", device)
'''

day16 = [
    header("Day 16", "학습 루프의 정석: Fashion-MNIST",
           ["재사용 가능한 학습 템플릿(train_one_epoch / evaluate / fit)을 만든다",
            "시드 3개로 반복해 평균 ± 표준편차를 보고한다",
            "체크포인트를 Google Drive에 저장하고 이어서 학습한다", "TensorBoard로 학습 과정을 기록한다"]),
    md("## 1. 템플릿\n이 셀은 이후 노트북들(Day 18, 19, 21, 29)에서도 그대로 다시 씁니다. 각 줄의 의미를 강의 본문과 대조해 보세요."),
    code(TEMPLATE_FUNCS),
    md("## 2. 데이터: Fashion-MNIST\n옷·신발·가방 등 10종류의 28×28 흑백 이미지. MNIST보다 어렵습니다."),
    code('''
tf = transforms.Compose([transforms.ToTensor(), transforms.Normalize((0.2860,), (0.3530,))])
full = datasets.FashionMNIST("data", train=True, download=True, transform=tf)
test_ds = datasets.FashionMNIST("data", train=False, download=True, transform=tf)
train_ds, val_ds = random_split(full, [55000, 5000], generator=torch.Generator().manual_seed(42))
train_dl = DataLoader(train_ds, batch_size=128, shuffle=True, num_workers=2, pin_memory=True, drop_last=True)
val_dl = DataLoader(val_ds, batch_size=512, num_workers=2)
test_dl = DataLoader(test_ds, batch_size=512, num_workers=2)
classes = full.classes
xb, yb = next(iter(train_dl))
print(xb.shape, yb.shape, f"min {xb.min():.2f} max {xb.max():.2f}", classes)

import matplotlib.pyplot as plt
fig, axs = plt.subplots(2, 8, figsize=(14, 4))
for a, x, y in zip(axs.ravel(), xb, yb): a.imshow(x[0], cmap="gray"); a.set_title(classes[y], fontsize=8); a.axis("off")
plt.show()
'''),
    md("## 3. 모델과 학습"),
    code('''
def make_mlp():
    return nn.Sequential(nn.Flatten(), nn.Linear(784, 512), nn.ReLU(), nn.Dropout(0.3),
                         nn.Linear(512, 256), nn.ReLU(), nn.Dropout(0.3), nn.Linear(256, 10)).to(device)
seed_everything(0)
model = make_mlp()
hist = fit(model, train_dl, val_dl, epochs=15, lr=2e-3, wd=0.05, ckpt="fmnist_best.pt")
plot_hist(hist, "Fashion-MNIST MLP")
print("test (loss, acc):", evaluate(model, test_dl, nn.CrossEntropyLoss()))
'''),
    md("## 4. 시드 3개로 신뢰할 수 있는 결과 내기"),
    code('''
accs = []
for seed in [0, 1, 2]:
    seed_everything(seed); m = make_mlp()
    h = fit(m, train_dl, val_dl, epochs=10, lr=2e-3, ckpt=f"seed{seed}.pt")
    accs.append(max(h["va_acc"]))
print(f"val acc = {np.mean(accs):.4f} ± {np.std(accs):.4f}  (seeds: {np.round(accs, 4)})")
'''),
    md("## 5. Google Drive에 체크포인트 저장 → 이어서 학습\nColab 세션이 끊기면 로컬 파일은 사라집니다. 중요한 체크포인트는 Drive에 두세요."),
    code('''
from google.colab import drive
drive.mount("/content/drive")
os.makedirs("/content/drive/MyDrive/dl30", exist_ok=True)
path = "/content/drive/MyDrive/dl30/fmnist.pt"
opt = torch.optim.AdamW(model.parameters(), lr=1e-4)
save_ckpt(path, model, opt, epoch=15, best=max(hist["va_acc"]))
print("saved to", path)

# (런타임을 다시 시작했다고 가정) 새 모델을 만들고 불러와서 이어서 학습
model2 = make_mlp(); opt2 = torch.optim.AdamW(model2.parameters(), lr=1e-4)
ep, best = load_ckpt(path, model2, opt2)
print("resumed from epoch", ep, "best", best, "→ val", evaluate(model2, val_dl, nn.CrossEntropyLoss()))
'''),
    md("## 6. TensorBoard"),
    code('''
from torch.utils.tensorboard import SummaryWriter
writer = SummaryWriter("runs/fmnist")
for i, (tl, vl, va) in enumerate(zip(hist["tr_loss"], hist["va_loss"], hist["va_acc"])):
    writer.add_scalar("loss/train", tl, i); writer.add_scalar("loss/val", vl, i); writer.add_scalar("acc/val", va, i)
writer.close()
'''),
    code('''
%load_ext tensorboard
%tensorboard --logdir runs
'''),
    md("## 7. 과제\n- 검증 정확도 89% 이상을 달성했나요? 못 했다면 무엇을 바꿔 볼지 Day 28 진단표를 참고하세요.\n- `fit`의 `patience=3`을 주고 조기 종료가 언제 일어나는지 보세요.\n- 이 템플릿 셀을 복사해 두세요. Day 29 캡스톤에서 그대로 씁니다."),
]

day18 = [
    header("Day 18", "ResNet으로 CIFAR-10 90% 넘기기",
           ["잔차 연결이 있는 망과 없는 망(plain)을 같은 깊이로 비교한다",
            "작은 ResNet을 증강 + OneCycle + 혼합 정밀도로 학습한다 (목표 90%+)", "첫 층 합성곱 필터를 시각화한다"]),
    code(TEMPLATE_FUNCS),
    md("## 1. CIFAR-10 데이터와 증강"),
    code('''
mean, std = (0.4914, 0.4822, 0.4465), (0.2470, 0.2435, 0.2616)
train_tf = transforms.Compose([transforms.RandomCrop(32, padding=4), transforms.RandomHorizontalFlip(),
                               transforms.ToTensor(), transforms.Normalize(mean, std)])
test_tf = transforms.Compose([transforms.ToTensor(), transforms.Normalize(mean, std)])
full_train = datasets.CIFAR10("data", train=True, download=True, transform=train_tf)
full_val = datasets.CIFAR10("data", train=True, download=True, transform=test_tf)     # 검증은 증강 없이
test_ds = datasets.CIFAR10("data", train=False, download=True, transform=test_tf)
idx = torch.randperm(50000, generator=torch.Generator().manual_seed(0))
train_ds = torch.utils.data.Subset(full_train, idx[:45000]); val_ds = torch.utils.data.Subset(full_val, idx[45000:])
train_dl = DataLoader(train_ds, batch_size=256, shuffle=True, num_workers=2, pin_memory=True, drop_last=True)
val_dl = DataLoader(val_ds, batch_size=1000, num_workers=2); test_dl = DataLoader(test_ds, batch_size=1000, num_workers=2)
classes = full_train.classes; print(classes)
'''),
    md("## 2. ResNet (잔차 연결 on/off 가능)"),
    code('''
class BasicBlock(nn.Module):
    def __init__(self, c_in, c_out, stride=1, use_residual=True):
        super().__init__()
        self.use_residual = use_residual
        self.conv1 = nn.Conv2d(c_in, c_out, 3, stride, 1, bias=False); self.bn1 = nn.BatchNorm2d(c_out)
        self.conv2 = nn.Conv2d(c_out, c_out, 3, 1, 1, bias=False); self.bn2 = nn.BatchNorm2d(c_out)
        self.shortcut = nn.Identity()
        if stride != 1 or c_in != c_out:
            self.shortcut = nn.Sequential(nn.Conv2d(c_in, c_out, 1, stride, bias=False), nn.BatchNorm2d(c_out))
    def forward(self, x):
        out = self.bn2(self.conv2(F.relu(self.bn1(self.conv1(x)))))
        if self.use_residual: out = out + self.shortcut(x)
        return F.relu(out)

class ResNet(nn.Module):
    def __init__(self, blocks=(2, 2, 2, 2), widths=(64, 128, 256, 512), n_classes=10, use_residual=True):
        super().__init__()
        self.stem = nn.Sequential(nn.Conv2d(3, widths[0], 3, 1, 1, bias=False), nn.BatchNorm2d(widths[0]), nn.ReLU())
        layers, c = [], widths[0]
        for i, (n, w) in enumerate(zip(blocks, widths)):
            for j in range(n):
                layers.append(BasicBlock(c, w, 2 if (j == 0 and i > 0) else 1, use_residual)); c = w
        self.layers = nn.Sequential(*layers)
        self.head = nn.Sequential(nn.AdaptiveAvgPool2d(1), nn.Flatten(), nn.Linear(c, n_classes))
    def forward(self, x): return self.head(self.layers(self.stem(x)))

m = ResNet(); print(f"{sum(p.numel() for p in m.parameters())/1e6:.1f}M params", m(torch.randn(2, 3, 32, 32)).shape)
'''),
    md("## 3. 실험: 깊은 plain 망 vs ResNet\n블록을 (5,5,5) × 폭 (16,32,64)로 쌓은 **32층** 망입니다(ResNet-32 구조). 같은 조건에서 잔차 연결만 끄고 켜서 8에폭씩 학습합니다. 학습 손실 곡선을 비교하세요."),
    code('''
results = {}
for res in [False, True]:
    seed_everything(0)
    net = ResNet(blocks=(5, 5, 5), widths=(16, 32, 64), use_residual=res).to(device).to(memory_format=torch.channels_last)
    results["ResNet" if res else "Plain"] = fit(net, train_dl, val_dl, epochs=8, lr=2e-3, ckpt=f"cmp_{res}.pt")
import matplotlib.pyplot as plt
plt.figure(figsize=(7, 3.5))
for k, h in results.items(): plt.plot(h["tr_loss"], label=f"{k} train loss"); plt.plot(h["va_acc"], "--", label=f"{k} val acc")
plt.legend(); plt.title("32-layer: plain vs residual"); plt.show()
'''),
    md("## 4. 본 학습: ResNet-18 스타일, 목표 90%+\nT4 GPU 기준 약 15~20분. 기다리는 동안 강의 본문 5~7절을 읽으세요."),
    code('''
seed_everything(42)
model = ResNet().to(device).to(memory_format=torch.channels_last)
hist = fit(model, train_dl, val_dl, epochs=30, lr=0.1, wd=5e-4, sgd=True, ckpt="resnet_cifar.pt", label_smoothing=0.1)
plot_hist(hist, "ResNet CIFAR-10")
print("TEST:", evaluate(model, test_dl, nn.CrossEntropyLoss()))
'''),
    md("## 5. 첫 층 필터 시각화\nCNN이 스스로 학습한 64개의 3×3 컬러 필터입니다. 색 덩어리, 방향성 있는 경계 검출기가 보이나요?"),
    code('''
w = model.stem[0].weight.detach().cpu()           # (64, 3, 3, 3)
w = (w - w.min()) / (w.max() - w.min())
fig, axs = plt.subplots(4, 16, figsize=(14, 3.6))
for a, f in zip(axs.ravel(), w): a.imshow(f.permute(1, 2, 0)); a.axis("off")
plt.suptitle("learned first-layer filters"); plt.show()
'''),
    md("## 6. 과제\n- plain 망과 ResNet의 결과를 학습 노트에 기록하세요. 어느 쪽 학습 손실이 더 빨리 줄었나요?\n- `blocks=(9,9,9)`(56층)로 바꾸면 plain 망은 어떻게 되나요?"),
]

day19 = [
    header("Day 19", "전이학습: 102종 꽃 분류",
           ["클래스당 학습 이미지 10장뿐인 Flowers102로 세 방법을 비교한다: 처음부터 학습 / 특징 추출 / 미세조정",
            "데이터 증강의 효과를 확인한다", "(도전) 직접 찍은 사진으로 나만의 분류기를 만든다"]),
    code(TEMPLATE_FUNCS),
    md("## 1. 데이터\nFlowers102의 공식 분할은 학습 1020장(클래스당 10장) / 검증 1020장 / 테스트 6149장입니다. 데이터가 매우 적습니다."),
    code('''
from torchvision import models
weights = models.ResNet50_Weights.IMAGENET1K_V2
mean, std = (0.485, 0.456, 0.406), (0.229, 0.224, 0.225)     # 사전학습과 같은 정규화!
aug_tf = transforms.Compose([transforms.RandomResizedCrop(224, scale=(0.5, 1.0)), transforms.RandomHorizontalFlip(),
                             transforms.ColorJitter(0.2, 0.2, 0.2), transforms.ToTensor(), transforms.Normalize(mean, std)])
plain_tf = transforms.Compose([transforms.Resize(256), transforms.CenterCrop(224), transforms.ToTensor(), transforms.Normalize(mean, std)])
def loaders(train_tf):
    tr = datasets.Flowers102("data", split="train", download=True, transform=train_tf)
    va = datasets.Flowers102("data", split="val", download=True, transform=plain_tf)
    return (DataLoader(tr, batch_size=32, shuffle=True, num_workers=2, drop_last=True),
            DataLoader(va, batch_size=128, num_workers=2))
train_dl, val_dl = loaders(aug_tf)
print(len(train_dl.dataset), len(val_dl.dataset))
'''),
    md("## 2. 방법 ① 처음부터 학습 (작은 CNN)"),
    code('''
def small_cnn(n=102):
    def blk(i, o): return nn.Sequential(nn.Conv2d(i, o, 3, padding=1, bias=False), nn.BatchNorm2d(o), nn.ReLU(), nn.MaxPool2d(2))
    return nn.Sequential(blk(3, 32), blk(32, 64), blk(64, 128), blk(128, 256), nn.AdaptiveAvgPool2d(1), nn.Flatten(), nn.Dropout(0.3), nn.Linear(256, n))
seed_everything(0)
scratch = small_cnn().to(device)
h_scratch = fit(scratch, train_dl, val_dl, epochs=30, lr=3e-3, ckpt="scratch.pt")
'''),
    md("## 3. 방법 ② 특징 추출: 백본 동결 + 분류기만"),
    code('''
def resnet50_head(n=102, freeze=True):
    m = models.resnet50(weights=weights)
    if freeze:
        for p in m.parameters(): p.requires_grad = False
    m.fc = nn.Sequential(nn.Dropout(0.2), nn.Linear(m.fc.in_features, n))
    return m.to(device)
seed_everything(0)
fe = resnet50_head(freeze=True)
print("trainable:", sum(p.numel() for p in fe.parameters() if p.requires_grad))
h_fe = fit(fe, train_dl, val_dl, epochs=10, lr=3e-3, ckpt="fe.pt")
'''),
    md("## 4. 방법 ③ 미세조정: 분류기 먼저 → layer4 + 분류기를 차등 학습률로"),
    code('''
ft = fe                                                   # 특징 추출로 분류기가 이미 학습된 모델에서 시작
for p in ft.layer4.parameters(): p.requires_grad = True
opt = torch.optim.AdamW([{"params": ft.layer4.parameters(), "lr": 1e-4},
                         {"params": ft.fc.parameters(), "lr": 1e-3}], weight_decay=0.01)
loss_fn = nn.CrossEntropyLoss(label_smoothing=0.1)
h_ft = {"va_acc": []}
for ep in range(10):
    tl, ta = train_one_epoch(ft, train_dl, loss_fn, opt)
    vl, va = evaluate(ft, val_dl, nn.CrossEntropyLoss()); h_ft["va_acc"].append(va)
    print(f"[{ep+1}] train {tl:.3f}/{ta:.3f}  val {vl:.3f}/{va:.3f}")
'''),
    md("## 5. 결과 비교"),
    code('''
import matplotlib.pyplot as plt
plt.figure(figsize=(7, 3.5))
plt.plot(h_scratch["va_acc"], label=f"from scratch (best {max(h_scratch['va_acc']):.2f})")
plt.plot(h_fe["va_acc"], label=f"feature extraction (best {max(h_fe['va_acc']):.2f})")
plt.plot(range(len(h_fe["va_acc"]), len(h_fe["va_acc"]) + len(h_ft["va_acc"])), h_ft["va_acc"], label=f"+ fine-tuning (best {max(h_ft['va_acc']):.2f})")
plt.xlabel("epoch"); plt.ylabel("val acc"); plt.legend(); plt.show()
'''),
    md("## 6. 증강의 효과\n같은 특징 추출 설정을 증강 없이 학습해 보세요."),
    code('''
train_dl_noaug, _ = loaders(plain_tf)
seed_everything(0)
fe2 = resnet50_head(freeze=True)
h_noaug = fit(fe2, train_dl_noaug, val_dl, epochs=10, lr=3e-3, ckpt="fe_noaug.pt")
print("with aug:", max(h_fe["va_acc"]), " without aug:", max(h_noaug["va_acc"]))
'''),
    md("## 7. (도전) 나만의 사진으로\n1. 물건 3종류를 각 30장씩 찍어 Drive의 `MyDrive/my_photos/클래스명/` 폴더에 올립니다.\n2. 아래 셀의 경로를 확인하고 실행합니다."),
    code('''
from google.colab import drive
drive.mount("/content/drive")
root = "/content/drive/MyDrive/my_photos"
if os.path.isdir(root):
    ds = datasets.ImageFolder(root, transform=aug_tf)
    n_val = max(1, len(ds) // 5)
    tr, va = random_split(ds, [len(ds) - n_val, n_val], generator=torch.Generator().manual_seed(0))
    my = resnet50_head(n=len(ds.classes), freeze=True)
    fit(my, DataLoader(tr, 16, shuffle=True), DataLoader(va, 32), epochs=8, lr=3e-3, ckpt="mine.pt")
    print("classes:", ds.classes)
else:
    print("폴더가 없습니다:", root)
'''),
]

NOTEBOOKS = {
    "week2_numpy_mlp.ipynb": (False, week2),
    "day15_pytorch_basics.ipynb": (True, day15),
    "day16_training_loop.ipynb": (True, day16),
    "day18_cnn_cifar10.ipynb": (True, day18),
    "day19_transfer_learning.ipynb": (True, day19),
}
