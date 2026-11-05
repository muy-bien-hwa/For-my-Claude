# %% [markdown]
# # 30일차: 학습 파이프라인
#
# 딥러닝 8주 과정 30일차 실습 노트북이다. Fashion-MNIST로 Dataset, DataLoader, 학습·평가 함수, 혼합 정밀도, 체크포인트, 재현성, 기록을 갖춘 학습 템플릿을 만든다. 이후 강의의 노트북은 이 템플릿을 조금씩 바꿔 쓴다.
#
# - **런타임**: T4 GPU를 권장한다(런타임 → 런타임 유형 변경). CPU로도 돌아가며 15분 안팎 걸린다.
# - **그래프**: Colab에는 한글 글꼴이 없어 그래프의 축 이름과 범례는 영어로 쓴다.

# %%
import copy
import math
import os
import random
import time

import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision
from torch.utils.data import DataLoader, Dataset, random_split
from torchvision import transforms

use_cuda = torch.cuda.is_available()
device = torch.device("cuda" if use_cuda else "cpu")
print("PyTorch", torch.__version__, " 장치:", device)

# %% [markdown]
# ## 1. 재현성: 시드 고정
#
# 난수를 쓰는 곳(파이썬, NumPy, PyTorch의 CPU·GPU)의 시드를 모두 고정한다. `DataLoader`가 섞는 순서는 따로 만든 `Generator`로 고정한다(27일차).

# %%
def seed_everything(seed):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)                     # CPU와 모든 GPU
    os.environ["PYTHONHASHSEED"] = str(seed)


seed_everything(0)

# %% [markdown]
# ## 2. Dataset
#
# `Dataset`은 "몇 개인가"(`__len__`)와 "i번째는 무엇인가"(`__getitem__`)만 정하면 된다. `torchvision.datasets`에 자주 쓰는 데이터셋이 들어 있다. Fashion-MNIST는 옷 이미지 7만 장(학습 6만, 테스트 1만), 28×28 흑백, 10개 클래스다. MNIST와 형식이 같지만 훨씬 어렵다.

# %%
raw_train = torchvision.datasets.FashionMNIST("data", train=True, download=True)
raw_test = torchvision.datasets.FashionMNIST("data", train=False, download=True)
CLASSES = raw_train.classes
print(len(raw_train), len(raw_test), CLASSES)
img, label = raw_train[0]                       # PIL 이미지와 정수 레이블
print(type(img).__name__, img.size, label, CLASSES[label])

# %%
fig, axs = plt.subplots(2, 10, figsize=(12, 2.8))
for k, ax in enumerate(axs.ravel()):
    i = (raw_train.targets == k % 10).nonzero()[k // 10].item()
    ax.imshow(raw_train.data[i], cmap="gray_r")
    ax.set_title(CLASSES[k % 10], fontsize=7)
    ax.axis("off")
plt.tight_layout()
plt.show()

# %% [markdown]
# **변환(transform).** `__getitem__`이 이미지를 꺼낼 때마다 적용할 전처리다. `ToTensor`는 PIL 이미지(0~255)를 (1, 28, 28) 텐서(0~1)로 바꾸고, `Normalize`는 평균을 빼고 표준편차로 나눈다. 평균과 표준편차는 **학습 데이터**로 구한다.

# %%
x = raw_train.data.float() / 255
MEAN, STD = x.mean().item(), x.std().item()
print(f"평균 {MEAN:.4f}, 표준편차 {STD:.4f}")
tf = transforms.Compose([transforms.ToTensor(), transforms.Normalize((MEAN,), (STD,))])
train_full = torchvision.datasets.FashionMNIST("data", train=True, transform=tf)
test_set = torchvision.datasets.FashionMNIST("data", train=False, transform=tf)
xb0, yb0 = train_full[0]
print(xb0.shape, xb0.dtype, f"{xb0.min():.2f} ~ {xb0.max():.2f}", yb0)

# %% [markdown]
# **직접 만드는 Dataset.** 텐서 두 개를 감싸는 가장 단순한 Dataset이다. 사진 폴더, CSV, 텍스트 파일도 같은 방식으로 감싼다. `__getitem__`에서 파일을 읽으면 데이터 전체를 메모리에 올리지 않아도 된다.

# %%
class TensorPairDataset(Dataset):
    def __init__(self, X, y, transform=None):
        self.X, self.y, self.transform = X, y, transform

    def __len__(self):
        return len(self.X)

    def __getitem__(self, i):
        x = self.X[i]
        if self.transform:
            x = self.transform(x)
        return x, self.y[i]


toy = TensorPairDataset(torch.randn(5, 3), torch.arange(5))
print(len(toy), toy[2])

# %% [markdown]
# **검증 세트 떼어 내기.** 학습 데이터 6만 장을 5만 4천 / 6천으로 나눈다. `random_split`에 시드를 준 `Generator`를 넘겨 분할을 고정한다.

# %%
train_set, val_set = random_split(train_full, [54000, 6000], generator=torch.Generator().manual_seed(0))
print(len(train_set), len(val_set), len(test_set))

# %% [markdown]
# ## 3. DataLoader
#
# `DataLoader`는 Dataset에서 표본을 꺼내 미니배치로 묶는다. 주요 인자는 다음과 같다.
#
# | 인자 | 뜻 |
# |---|---|
# | `batch_size` | 배치 크기 |
# | `shuffle` | 에폭마다 순서를 섞는다(학습만 True) |
# | `num_workers` | 데이터를 준비하는 프로세스 수. 0이면 학습 루프와 같은 프로세스에서 준비 |
# | `pin_memory` | CPU → GPU 복사를 빠르게 하는 고정 메모리 사용 |
# | `drop_last` | 마지막의 작은 배치를 버린다 |

# %%
def make_loader(ds, bs, shuffle, seed=0, workers=2):
    g = torch.Generator().manual_seed(seed)
    return DataLoader(ds, batch_size=bs, shuffle=shuffle, generator=g, num_workers=workers,
                      pin_memory=use_cuda, persistent_workers=workers > 0)


train_loader = make_loader(train_set, 128, True)
val_loader = make_loader(val_set, 1000, False)
test_loader = make_loader(test_set, 1000, False)
xb, yb = next(iter(train_loader))
print("배치:", xb.shape, xb.dtype, yb.shape, yb.dtype, "  에폭당 배치 수:", len(train_loader))

# %%
for workers in (0, 2):
    loader = make_loader(train_set, 128, True, workers=workers)
    t0 = time.perf_counter()
    for i, (xb, yb) in enumerate(loader):
        if i == 100:
            break
    print(f"num_workers = {workers}: 배치 100개 준비 {time.perf_counter() - t0:.2f}초")

# %% [markdown]
# ## 4. 모델
#
# 아직 합성곱을 배우기 전이므로 다층 퍼셉트론을 쓴다(합성곱은 31일차). `nn.Flatten`이 (N, 1, 28, 28)을 (N, 784)로 펼친다.

# %%
def make_model(p_drop=0.2):
    return nn.Sequential(
        nn.Flatten(),
        nn.Linear(784, 512), nn.ReLU(), nn.Dropout(p_drop),
        nn.Linear(512, 256), nn.ReLU(), nn.Dropout(p_drop),
        nn.Linear(256, 10),
    )


model = make_model().to(device)
print(f"파라미터 {sum(p.numel() for p in model.parameters()):,}개")

# %% [markdown]
# ## 5. 학습 함수와 평가 함수
#
# - `train_one_epoch`: `model.train()` → 배치마다 장치로 옮기기 → 순전파·손실(혼합 정밀도) → 역전파 → 갱신 → 스케줄러. 손실과 정확도는 **표본 수로 가중 평균**한다(마지막 배치가 작을 수 있다).
# - `evaluate`: `model.eval()`과 `torch.inference_mode()`. 기울기 기록을 끄고 드롭아웃을 끈다.
#
# **혼합 정밀도.** `torch.autocast` 안의 행렬곱은 16비트로 계산하고, 정밀도가 중요한 연산(합, 소프트맥스 등)은 32비트로 계산한다. GPU의 float16은 표현 범위가 좁아 작은 기울기가 0이 되므로(언더플로), `GradScaler`가 손실에 큰 수를 곱해 역전파한 뒤 기울기를 다시 나눈다. bfloat16은 범위가 float32와 같아 스케일러가 필요 없다.

# %%
amp_dtype = torch.float16 if use_cuda else torch.bfloat16


def train_one_epoch(model, loader, opt, loss_fn, scaler, sched=None):
    model.train()
    tot_loss, correct, n = 0.0, 0, 0
    for xb, yb in loader:
        xb, yb = xb.to(device, non_blocking=True), yb.to(device, non_blocking=True)
        with torch.autocast(device.type, dtype=amp_dtype):
            out = model(xb)
            loss = loss_fn(out, yb)
        opt.zero_grad(set_to_none=True)
        scaler.scale(loss).backward()
        scaler.step(opt)
        scaler.update()
        if sched is not None:
            sched.step()
        tot_loss += loss.item() * len(yb)
        correct += (out.argmax(1) == yb).sum().item()
        n += len(yb)
    return tot_loss / n, correct / n


@torch.inference_mode()
def evaluate(model, loader, loss_fn):
    model.eval()
    tot_loss, correct, n = 0.0, 0, 0
    for xb, yb in loader:
        xb, yb = xb.to(device), yb.to(device)
        with torch.autocast(device.type, dtype=amp_dtype):
            out = model(xb)
        tot_loss += loss_fn(out.float(), yb).item() * len(yb)
        correct += (out.argmax(1) == yb).sum().item()
        n += len(yb)
    return tot_loss / n, correct / n


loss_fn = nn.CrossEntropyLoss()
print("학습 전 검증:", evaluate(model, val_loader, loss_fn))

# %% [markdown]
# ## 6. 체크포인트
#
# 학습을 이어서 하려면 모델만이 아니라 옵티마이저(모멘텀, Adam의 이동 평균), 스케줄러, 혼합 정밀도 스케일러, 진행한 에폭, 기록, 그리고 **난수 생성기의 상태**(드롭아웃 마스크, 데이터 순서)를 함께 저장한다.

# %%
def save_checkpoint(path, model, opt, sched, scaler, epoch, history, loader=None):
    torch.save({"model": model.state_dict(), "opt": opt.state_dict(), "sched": sched.state_dict(),
                "scaler": scaler.state_dict(), "epoch": epoch, "history": history,
                "rng": torch.get_rng_state(),
                "loader_rng": loader.generator.get_state() if loader is not None else None}, path)


def load_checkpoint(path, model, opt=None, sched=None, scaler=None, loader=None):
    ck = torch.load(path, map_location=device)
    model.load_state_dict(ck["model"])
    if opt is not None:                          # 학습을 이어 갈 때만 나머지 상태를 되돌린다
        opt.load_state_dict(ck["opt"])
        sched.load_state_dict(ck["sched"])
        scaler.load_state_dict(ck["scaler"])
        torch.set_rng_state(ck["rng"])
        if loader is not None and ck["loader_rng"] is not None:
            loader.generator.set_state(ck["loader_rng"])
    return ck["epoch"], ck["history"]


# %% [markdown]
# ## 7. 학습 템플릿 `fit`
#
# 지금까지의 부품을 하나로 묶는다. 에폭마다 검증하고, 검증 정확도가 가장 좋은 모델을 `best.pt`로 저장하며, `patience` 에폭 동안 검증 손실이 나아지지 않으면 멈춘다(조기 종료, 26일차).

# %%
def make_optimizer(model, epochs, steps_per_epoch, lr=1e-3, wd=0.01):
    decay = [p for p in model.parameters() if p.dim() >= 2]           # 가중치 행렬
    no_decay = [p for p in model.parameters() if p.dim() < 2]         # 편향
    opt = torch.optim.AdamW([{"params": decay, "weight_decay": wd},
                             {"params": no_decay, "weight_decay": 0.0}], lr=lr)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=lr, pct_start=0.1,
                                                total_steps=epochs * steps_per_epoch)
    return opt, sched


def fit(model, train_loader, val_loader, epochs=15, lr=1e-3, wd=0.01, patience=5, ckpt="best.pt",
        stop_at=None, start_epoch=0, history=None, opt=None, sched=None, scaler=None):
    loss_fn = nn.CrossEntropyLoss()
    if opt is None:
        opt, sched = make_optimizer(model, epochs, len(train_loader), lr, wd)
    scaler = scaler or torch.amp.GradScaler("cuda", enabled=use_cuda)
    history = history or {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": []}
    best_acc = max(history["val_acc"], default=0.0)
    best_loss = min(history["val_loss"], default=float("inf"))
    bad = 0
    for ep in range(start_epoch, stop_at or epochs):
        t0 = time.perf_counter()
        tl, ta = train_one_epoch(model, train_loader, opt, loss_fn, scaler, sched)
        vl, va = evaluate(model, val_loader, loss_fn)
        for k, v in zip(history, (tl, ta, vl, va)):
            history[k].append(v)
        mark = ""
        if va > best_acc:
            best_acc = va
            save_checkpoint(ckpt, model, opt, sched, scaler, ep + 1, history, train_loader)
            mark = "  *저장"
        print(f"에폭 {ep + 1:2d}  학습 {tl:.4f}/{ta:.4f}  검증 {vl:.4f}/{va:.4f}  "
              f"학습률 {sched.get_last_lr()[0]:.2e}  ({time.perf_counter() - t0:.1f}초){mark}")
        if vl < best_loss - 1e-4:
            best_loss, bad = vl, 0
        else:
            bad += 1
            if bad >= patience:
                print(f"검증 손실이 {patience}에폭 동안 나아지지 않아 멈춘다")
                break
    return history, opt, sched, scaler


# %% [markdown]
# ## 8. 미니 프로젝트: 학습 템플릿으로 Fashion-MNIST 학습

# %%
seed_everything(0)
model = make_model().to(device)
train_loader = make_loader(train_set, 128, True, seed=0)
t0 = time.perf_counter()
history, opt, sched, scaler = fit(model, train_loader, val_loader, epochs=15)
print(f"전체 {time.perf_counter() - t0:.0f}초")

# %%
fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 3.4))
ep = np.arange(1, len(history["train_loss"]) + 1)
a1.plot(ep, history["train_loss"], "o-", ms=3, label="train")
a1.plot(ep, history["val_loss"], "o-", ms=3, label="val")
a1.set_xlabel("epoch")
a1.set_ylabel("cross-entropy")
a2.plot(ep, 100 * np.array(history["train_acc"]), "o-", ms=3, label="train (dropout on)")
a2.plot(ep, 100 * np.array(history["val_acc"]), "o-", ms=3, label="val")
a2.set_xlabel("epoch")
a2.set_ylabel("accuracy (%)")
for a in (a1, a2):
    a.grid(alpha=.3)
    a.legend()
plt.tight_layout()
plt.show()

# %% [markdown]
# **가장 좋았던 모델로 테스트.** 마지막 에폭의 모델이 아니라, 검증 정확도가 가장 높았던 시점에 저장한 `best.pt`를 불러와 테스트 세트로 한 번 평가한다.

# %%
best = make_model().to(device)
best_epoch, _ = load_checkpoint("best.pt", best)
test_loss, test_acc = evaluate(best, test_loader, loss_fn)
print(f"최고 검증 정확도 에폭 {best_epoch},  테스트 손실 {test_loss:.4f},  테스트 정확도 {test_acc:.4f}")

# %%
preds, labels = [], []
best.eval()
with torch.inference_mode():
    for xb, yb in test_loader:
        preds.append(best(xb.to(device)).argmax(1).cpu())
        labels.append(yb)
preds, labels = torch.cat(preds), torch.cat(labels)
cm = torch.zeros(10, 10, dtype=torch.long)
cm.index_put_((labels, preds), torch.ones_like(labels), accumulate=True)
for k, name in enumerate(CLASSES):
    print(f"{name:12s} 정확도 {cm[k, k].item() / cm[k].sum().item():.3f}")
off = cm.clone()
off.fill_diagonal_(0)
pairs = sorted(((int(off[i, j]), i, j) for i in range(10) for j in range(10)), reverse=True)[:5]
print("가장 많이 헷갈린 쌍:", [f"{CLASSES[i]} → {CLASSES[j]}: {n}" for n, i, j in pairs])

# %% [markdown]
# **이어서 학습하기.** 6에폭 학습을 한 번에 끝까지 한 결과와, 3에폭에서 체크포인트를 저장하고 **새 객체**에 불러와 나머지 3에폭을 학습한 결과를 비교한다. 스케줄러는 처음부터 전체 길이(6에폭)로 만든다. 데이터를 준비하는 프로세스(`num_workers`)를 0으로 두어 난수 흐름을 한 곳에 모은다.

# %%
def fresh(seed):
    seed_everything(seed)
    m = make_model().to(device)
    loader = make_loader(train_set, 128, True, seed=seed, workers=0)
    return m, loader


m, loader = fresh(1)
h_full, *_ = fit(m, loader, val_loader, epochs=6, ckpt="tmp.pt")

m, loader = fresh(1)
h, opt, sched, scaler = fit(m, loader, val_loader, epochs=6, stop_at=3, ckpt="tmp.pt")
save_checkpoint("resume.pt", m, opt, sched, scaler, 3, h, loader)
print("--- 3에폭에서 저장. 새 모델·옵티마이저·DataLoader를 만들어 불러온다 ---")

m2, loader2 = fresh(123)                                  # 일부러 다른 시드로 만든다
opt2, sched2 = make_optimizer(m2, 6, len(loader2))
scaler2 = torch.amp.GradScaler("cuda", enabled=use_cuda)
ep0, h2 = load_checkpoint("resume.pt", m2, opt2, sched2, scaler2, loader2)
h2, *_ = fit(m2, loader2, val_loader, epochs=6, start_epoch=ep0, history=h2,
             opt=opt2, sched=sched2, scaler=scaler2, ckpt="tmp.pt")
diff = max(abs(a - b) for a, b in zip(h_full["val_loss"], h2["val_loss"]))
print(f"에폭별 검증 손실의 최대 차이: {diff:.2e}")

# %% [markdown]
# CPU에서는 두 결과가 정확히 같다. GPU에서는 일부 연산(원자적 덧셈을 쓰는 커널)이 실행마다 미세하게 달라 마지막 자리가 다를 수 있다.
#
# ## 9. 연습
#
# 1. `make_loader`의 `num_workers`를 0, 2, 4로 바꿔 에폭당 시간을 재 보라. Colab의 CPU 수는 `os.cpu_count()`로 확인한다.
# 2. `fit`에 `torch.nn.utils.clip_grad_norm_`을 넣어 기울기 노름을 1로 자르고, 혼합 정밀도에서는 `scaler.unscale_(opt)`를 먼저 불러야 하는 이유를 설명하라.
# 3. 같은 시드로 `fit`을 두 번 실행해 에폭별 검증 손실이 같은지 확인하라. GPU에서는 일부 연산이 비결정적이라 마지막 자리가 다를 수 있다.
