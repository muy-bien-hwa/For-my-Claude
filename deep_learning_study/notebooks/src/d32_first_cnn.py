# %% [markdown]
# # 32일차: 첫 합성곱 신경망
#
# 딥러닝 8주 과정 32일차 실습 노트북이다. MNIST로 첫 CNN을 만들어 99%를 넘기고, CIFAR-10에서 다층 퍼셉트론과 CNN을 비교한 뒤, 학습된 필터와 특성 맵을 들여다본다.
#
# - **런타임**: T4 GPU를 권장한다(런타임 → 런타임 유형 변경). GPU에서 전체 실행은 10분 안팎으로 예상한다.
# - **그래프**: Colab에는 한글 글꼴이 없어 그래프의 축 이름과 범례는 영어로 쓴다.

# %%
import math
import time

import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision

use_cuda = torch.cuda.is_available()
device = torch.device("cuda" if use_cuda else "cpu")
amp_dtype = torch.float16 if use_cuda else torch.bfloat16
print("PyTorch", torch.__version__, " 장치:", device)

# %% [markdown]
# ## 1. 공통 도구
#
# 데이터가 작으므로 30일차의 DataLoader 대신 35일차처럼 데이터 전체를 장치의 텐서로 올려 두고 인덱스로 잘라 쓴다. 학습 함수는 30일차 템플릿을 줄인 것이다(AdamW + 원사이클, 혼합 정밀도).

# %%
def to_device_tensors(ds, mean=None, std=None):
    x = torch.as_tensor(ds.data).float() / 255
    x = x.unsqueeze(1) if x.dim() == 3 else x.permute(0, 3, 1, 2)    # (N, C, H, W)
    y = torch.as_tensor(ds.targets)
    if mean is None:
        mean, std = x.mean(dim=(0, 2, 3), keepdim=True), x.std(dim=(0, 2, 3), keepdim=True)
    return ((x - mean) / std).to(device), y.to(device), mean, std


@torch.inference_mode()
def accuracy(model, x, y, bs=1000):
    model.eval()
    correct = 0
    for s in range(0, len(x), bs):
        with torch.autocast(device.type, dtype=amp_dtype):
            correct += (model(x[s:s + bs]).argmax(1) == y[s:s + bs]).sum().item()
    return correct / len(x)


def fit(model, x, y, x_val, y_val, epochs=10, lr=2e-3, wd=0.05, bs=128, seed=0, verbose=True):
    torch.manual_seed(seed)
    decay = [p for p in model.parameters() if p.dim() >= 2]
    no_decay = [p for p in model.parameters() if p.dim() < 2]
    opt = torch.optim.AdamW([{"params": decay, "weight_decay": wd},
                             {"params": no_decay, "weight_decay": 0.0}], lr=lr)
    steps = math.ceil(len(x) / bs)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=lr, total_steps=epochs * steps,
                                                pct_start=0.2)
    scaler = torch.amp.GradScaler("cuda", enabled=use_cuda)
    hist = []
    for ep in range(epochs):
        model.train()
        t0, tot, correct = time.perf_counter(), 0.0, 0
        order = torch.randperm(len(x), device=device)
        for s in range(0, len(x), bs):
            idx = order[s:s + bs]
            with torch.autocast(device.type, dtype=amp_dtype):
                out = model(x[idx])
                loss = F.cross_entropy(out, y[idx])
            opt.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.step(opt)
            scaler.update()
            sched.step()
            tot += loss.item() * len(idx)
            correct += (out.argmax(1) == y[idx]).sum().item()
        va = accuracy(model, x_val, y_val)
        hist.append((tot / len(x), correct / len(x), va))
        if verbose:
            print(f"에폭 {ep + 1:2d}  학습 손실 {hist[-1][0]:.4f}  학습 정확도 {hist[-1][1]:.4f}  "
                  f"평가 정확도 {va:.4f}  ({time.perf_counter() - t0:.0f}초)")
    return np.array(hist)


def layer_table(model, x):
    """층별 출력 형상, 파라미터 수, 곱셈-덧셈 횟수(합성곱·선형층)를 순전파 훅으로 모은다."""
    rows, hooks = [], []

    def hook(m, inp, out):
        p = sum(q.numel() for q in m.parameters(recurse=False))
        macs = 0
        if isinstance(m, nn.Conv2d):
            macs = out[0].numel() * (m.in_channels // m.groups) * m.kernel_size[0] * m.kernel_size[1]
        elif isinstance(m, nn.Linear):
            macs = m.in_features * m.out_features
        rows.append((type(m).__name__, tuple(out.shape[1:]), p, macs))

    for m in model.modules():
        if len(list(m.children())) == 0:
            hooks.append(m.register_forward_hook(hook))
    model.eval()
    with torch.no_grad():
        model(x[:1])
    for h in hooks:
        h.remove()
    for name, shape, p, macs in rows:
        print(f"{name:18s} {str(shape):18s} 파라미터 {p:>9,}   곱셈-덧셈 {macs:>12,}")
    print(f"{'합계':18s} {'':18s} 파라미터 {sum(r[2] for r in rows):>9,}   "
          f"곱셈-덧셈 {sum(r[3] for r in rows):>12,}")

# %% [markdown]
# ## 2. MNIST: 첫 CNN
#
# 합성곱 블록(합성곱 → 배치 정규화 → ReLU) 두 개마다 최대 풀링으로 해상도를 절반으로 줄이고, 그때마다 채널을 두 배로 늘린다. 끝에서 전역 평균 풀링으로 채널마다 값 하나를 만들어 선형층에 넣는다. 합성곱 뒤에 배치 정규화가 오면 합성곱의 편향은 쓸모가 없으므로(정규화가 평균을 빼 버린다) `bias=False`로 둔다.

# %%
def conv_block(c_in, c_out):
    return nn.Sequential(nn.Conv2d(c_in, c_out, 3, padding=1, bias=False),
                         nn.BatchNorm2d(c_out), nn.ReLU(inplace=True))


def small_cnn(c_in=1, w=32, num_classes=10):
    return nn.Sequential(
        conv_block(c_in, w), conv_block(w, w), nn.MaxPool2d(2),
        conv_block(w, 2 * w), conv_block(2 * w, 2 * w), nn.MaxPool2d(2),
        conv_block(2 * w, 4 * w), conv_block(4 * w, 4 * w),
        nn.AdaptiveAvgPool2d(1), nn.Flatten(), nn.Linear(4 * w, num_classes))


mn_tr = torchvision.datasets.MNIST("data", train=True, download=True)
mn_te = torchvision.datasets.MNIST("data", train=False, download=True)
xm, ym, m_mean, m_std = to_device_tensors(mn_tr)
xm_te, ym_te, _, _ = to_device_tensors(mn_te, m_mean, m_std)
torch.manual_seed(0)
cnn_mnist = small_cnn(1).to(device)
layer_table(cnn_mnist, xm)

# %%
h_mnist = fit(cnn_mnist, xm, ym, xm_te, ym_te, epochs=3)
print(f"MNIST CNN 테스트 정확도 {accuracy(cnn_mnist, xm_te, ym_te):.4f}")

# %% [markdown]
# 파라미터 28만 개 남짓으로 3에폭 만에 99%를 넘는다. 28일차의 다층 퍼셉트론(53만 개, 15에폭, 이동 증강)은 98.8%였다. 이 노트북에서는 하이퍼파라미터를 고르지 않으므로 검증 세트 대신 테스트 세트로 학습 과정을 본다.
#
# ## 3. CIFAR-10: 다층 퍼셉트론 대 CNN
#
# CIFAR-10은 32×32 컬러 이미지 6만 장, 10클래스다(35일차에 다시 다룬다). 같은 학습 설정(15에폭, 증강 없음)으로 다층 퍼셉트론과 CNN을 비교한다.

# %%
cf_tr = torchvision.datasets.CIFAR10("data", train=True, download=True)
cf_te = torchvision.datasets.CIFAR10("data", train=False, download=True)
CLASSES = cf_tr.classes
xc, yc, c_mean, c_std = to_device_tensors(cf_tr)
xc_te, yc_te, _, _ = to_device_tensors(cf_te, c_mean, c_std)
print(xc.shape, xc_te.shape, CLASSES)

mlp = nn.Sequential(nn.Flatten(), nn.Linear(3072, 512), nn.ReLU(), nn.Dropout(0.2),
                    nn.Linear(512, 256), nn.ReLU(), nn.Dropout(0.2), nn.Linear(256, 10)).to(device)
torch.manual_seed(0)
cnn = small_cnn(3, w=32).to(device).to(memory_format=torch.channels_last)
print(f"다층 퍼셉트론 파라미터 {sum(p.numel() for p in mlp.parameters()):,}개,  "
      f"CNN 파라미터 {sum(p.numel() for p in cnn.parameters()):,}개")
layer_table(cnn, xc)

# %%
EPOCHS = 15                                              # 바꿔 보기
t0 = time.perf_counter()
h_mlp = fit(mlp, xc, yc, xc_te, yc_te, epochs=EPOCHS, lr=1e-3, wd=0.01, verbose=False)
print(f"다층 퍼셉트론: 학습 정확도 {h_mlp[-1, 1]:.4f}, 테스트 정확도 {h_mlp[-1, 2]:.4f} "
      f"({time.perf_counter() - t0:.0f}초)")
t0 = time.perf_counter()
h_cnn = fit(cnn, xc, yc, xc_te, yc_te, epochs=EPOCHS)
print(f"CNN: 학습 정확도 {h_cnn[-1, 1]:.4f}, 테스트 정확도 {h_cnn[-1, 2]:.4f} "
      f"({time.perf_counter() - t0:.0f}초)")

# %%
fig, ax = plt.subplots(figsize=(7, 3.6))
ep = np.arange(1, EPOCHS + 1)
for h, name, c in [(h_mlp, "MLP", "tab:red"), (h_cnn, "CNN", "tab:blue")]:
    ax.plot(ep, 100 * h[:, 1], "--", color=c, label=f"{name} train")
    ax.plot(ep, 100 * h[:, 2], "o-", ms=3, color=c, label=f"{name} test")
ax.set_xlabel("epoch")
ax.set_ylabel("accuracy (%)")
ax.grid(alpha=.3)
ax.legend()
plt.show()

# %% [markdown]
# CNN은 파라미터가 다층 퍼셉트론의 6분의 1 정도인데 테스트 정확도가 훨씬 높다. 그러나 학습 정확도가 테스트 정확도보다 크게 높다. 증강이 없어서 학습 이미지를 외우고 있다. 34일차의 증강과 35일차의 더 큰 모델로 이 간격을 줄인다.
#
# ## 4. 학습된 필터와 특성 맵
#
# 첫 합성곱 층의 커널(3×3×3) 32개를 그림으로 그린다. 각 커널을 RGB 이미지처럼 보면 어떤 색과 방향에 반응하는지 보인다.

# %%
W1 = cnn[0][0].weight.detach().float().cpu()            # (32, 3, 3, 3)
W1 = (W1 - W1.amin(dim=(1, 2, 3), keepdim=True)) / (W1.amax(dim=(1, 2, 3), keepdim=True)
                                                    - W1.amin(dim=(1, 2, 3), keepdim=True))
fig, axs = plt.subplots(2, 16, figsize=(12, 1.8))
for k, ax in enumerate(axs.ravel()):
    ax.imshow(W1[k].permute(1, 2, 0).numpy(), interpolation="nearest")
    ax.axis("off")
plt.suptitle("first-layer kernels (3x3x3, each rescaled to 0-1)", fontsize=9)
plt.show()

# %% [markdown]
# 3×3은 너무 작아 무늬가 잘 안 보인다. 대신 이미지 한 장이 각 층을 지날 때의 특성 맵을 본다. 앞쪽 층은 경계와 색을, 뒤쪽 층은 더 큰 부분의 존재를 나타낸다.

# %%
def feature_maps(model, x):
    maps, h = [], x
    model.eval()
    with torch.no_grad():
        for layer in model:
            h = layer(h)
            if isinstance(layer, nn.Sequential):        # 합성곱 블록의 출력
                maps.append(h[0].float().cpu())
    return maps


i = (yc_te == CLASSES.index("horse")).nonzero()[0].item()
maps = feature_maps(cnn, xc_te[i:i + 1])
img = (xc_te[i].cpu() * c_std[0] + c_mean[0]).clamp(0, 1).permute(1, 2, 0).numpy()
fig, axs = plt.subplots(3, 7, figsize=(12, 5.4))
axs[0, 0].imshow(img)
axs[0, 0].set_title("input", fontsize=8)
for r, li in enumerate([0, 3, 5]):
    for c in range(1, 7):
        axs[r, c].imshow(maps[li][c - 1], cmap="viridis")
        axs[r, c].set_title(f"block {li + 1} ch {c - 1}  {tuple(maps[li].shape[1:])}", fontsize=7)
for ax in axs.ravel():
    ax.axis("off")
plt.tight_layout()
plt.show()

# %% [markdown]
# ## 5. 연습: Fashion-MNIST에 CNN
#
# 30일차의 다층 퍼셉트론은 Fashion-MNIST에서 테스트 89.85%였다. 같은 `small_cnn(1)`을 10에폭 학습해 비교한다.

# %%
fm_tr = torchvision.datasets.FashionMNIST("data", train=True, download=True)
fm_te = torchvision.datasets.FashionMNIST("data", train=False, download=True)
xf, yf, f_mean, f_std = to_device_tensors(fm_tr)
xf_te, yf_te, _, _ = to_device_tensors(fm_te, f_mean, f_std)
torch.manual_seed(0)
cnn_f = small_cnn(1).to(device)
h_f = fit(cnn_f, xf, yf, xf_te, yf_te, epochs=10, verbose=False)
print(f"Fashion-MNIST CNN: 학습 정확도 {h_f[-1, 1]:.4f}, 테스트 정확도 {h_f[-1, 2]:.4f}")
