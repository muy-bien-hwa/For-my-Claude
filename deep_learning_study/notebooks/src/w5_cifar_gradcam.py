# %% [markdown]
# # 주간 프로젝트 5: CIFAR-10 분류기와 Grad-CAM
#
# 딥러닝 8주 과정 35일차 실습 노트북이다. 강의 페이지의 단계와 같은 순서로 진행한다.
#
# - **런타임**: GPU를 쓴다. Colab 메뉴의 런타임 → 런타임 유형 변경 → T4 GPU를 고른다. GPU에서 전체 실행은 10분 안팎으로 예상한다. CPU로도 돌아가지만 1시간 이상 걸린다.
# - **그래프**: Colab에는 한글 글꼴이 없어 그래프의 축 이름과 범례는 영어로 쓴다.
#
# 목표는 테스트 정확도 93% 이상의 CIFAR-10 분류기를 만들고, Grad-CAM으로 모델이 이미지의 어디를 보고 판단하는지 확인하는 것이다.

# %% [markdown]
# ## 0. 준비

# %%
import math
import time

import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision

torch.manual_seed(0)
use_cuda = torch.cuda.is_available()
device = torch.device("cuda" if use_cuda else "cpu")
# 혼합 정밀도: GPU는 float16(+ GradScaler), CPU는 bfloat16
amp_dtype = torch.float16 if use_cuda else torch.bfloat16
print("PyTorch", torch.__version__, " 장치:", device,
      torch.cuda.get_device_name(0) if use_cuda else "")

# %% [markdown]
# ## 1. 데이터
#
# CIFAR-10은 32×32 컬러 이미지 6만 장(학습 5만, 테스트 1만)이고 클래스는 10개다. `torchvision.datasets.CIFAR10`이 내려받기와 해시 확인을 해 준다. 데이터 전체가 150 MB 정도라, 이미지를 하나씩 읽는 대신 **전체를 텐서 하나로 만들어 GPU에 올려 두고** 배치 단위로 꺼내 쓴다. 이렇게 하면 데이터 공급이 GPU를 기다리게 하지 않는다.

# %%
train_set = torchvision.datasets.CIFAR10("data", train=True, download=True)
test_set = torchvision.datasets.CIFAR10("data", train=False, download=True)
CLASSES = train_set.classes
print(CLASSES)


def to_tensor(ds):
    x = torch.tensor(ds.data).permute(0, 3, 1, 2).float() / 255   # (N, 3, 32, 32)
    y = torch.tensor(ds.targets)
    return x, y


x_train, y_train = to_tensor(train_set)
x_test, y_test = to_tensor(test_set)
MEAN = x_train.mean(dim=(0, 2, 3), keepdim=True)                 # 채널별 평균
STD = x_train.std(dim=(0, 2, 3), keepdim=True)
print("채널별 평균", MEAN.flatten().numpy().round(4), " 표준편차", STD.flatten().numpy().round(4))
x_train = ((x_train - MEAN) / STD).to(device)
x_test = ((x_test - MEAN) / STD).to(device)
y_train, y_test = y_train.to(device), y_test.to(device)
print(x_train.shape, x_test.shape)

# %%
def show(x):
    """정규화된 텐서 (3, H, W) → 그릴 수 있는 (H, W, 3) 배열"""
    return (x.cpu() * STD[0] + MEAN[0]).clamp(0, 1).permute(1, 2, 0).numpy()


fig, axs = plt.subplots(2, 10, figsize=(12, 2.8))
for k, ax in enumerate(axs.ravel()):
    i = (y_train == k % 10).nonzero()[k // 10].item()
    ax.imshow(show(x_train[i]))
    ax.set_title(CLASSES[k % 10], fontsize=8)
    ax.axis("off")
plt.tight_layout()
plt.show()

# %% [markdown]
# ## 2. 데이터 증강
#
# 배치 단위로 GPU에서 증강한다(34일차).
#
# 1. **무작위 자르기**: 사방에 4픽셀씩 반사 패딩을 붙여 40×40으로 만든 뒤 32×32를 무작위 위치에서 잘라 낸다.
# 2. **좌우 뒤집기**: 절반의 확률로 좌우를 뒤집는다.
# 3. **컷아웃**: 8×8 정사각형 하나를 무작위 위치에서 0(평균색)으로 지운다. 모델이 한 부분에만 의존하지 않게 한다.

# %%
def augment(x, crop_pad=4, cutout=8):
    B, C, H, W = x.shape
    dev = x.device
    # 1. 무작위 자르기: 패딩한 이미지에서 이미지마다 다른 위치를 고른다
    xp = F.pad(x, (crop_pad,) * 4, mode="reflect")
    i = torch.randint(0, 2 * crop_pad + 1, (B,), device=dev)
    j = torch.randint(0, 2 * crop_pad + 1, (B,), device=dev)
    rows = (i[:, None] + torch.arange(H, device=dev))[:, None, :, None]   # (B, 1, H, 1)
    cols = (j[:, None] + torch.arange(W, device=dev))[:, None, None, :]   # (B, 1, 1, W)
    bidx = torch.arange(B, device=dev)[:, None, None, None]
    cidx = torch.arange(C, device=dev)[None, :, None, None]
    x = xp[bidx, cidx, rows, cols]
    # 2. 좌우 뒤집기
    flip = torch.rand(B, device=dev) < 0.5
    x = torch.where(flip[:, None, None, None], x.flip(3), x)
    # 3. 컷아웃: 중심을 무작위로 고르고 그 둘레 cutout × cutout 정사각형을 0으로
    if cutout:
        h = cutout // 2
        cy = torch.randint(0, H, (B,), device=dev)[:, None, None]
        cx = torch.randint(0, W, (B,), device=dev)[:, None, None]
        yy = torch.arange(H, device=dev)[None, :, None]
        xx = torch.arange(W, device=dev)[None, None, :]
        hole = (yy >= cy - h) & (yy < cy + h) & (xx >= cx - h) & (xx < cx + h)   # (B, H, W)
        x = x.masked_fill(hole[:, None], 0.0)
    return x


torch.manual_seed(1)
demo = augment(x_train[:1].repeat(8, 1, 1, 1))
fig, axs = plt.subplots(1, 9, figsize=(12, 1.6))
for ax, img, t in zip(axs, [x_train[0], *demo], ["original"] + ["augmented"] * 8):
    ax.imshow(show(img))
    ax.set_title(t, fontsize=8)
    ax.axis("off")
plt.show()

# %% [markdown]
# ## 3. 모델: ResNet-9
#
# 합성곱 9층의 작은 ResNet이다(33일차). 블록은 합성곱 → 배치 정규화 → ReLU 순서이고, 해상도를 줄일 때마다 채널을 두 배로 늘린다. 잔차 블록 두 개가 같은 해상도에서 입력을 그대로 더해 준다.
#
# | 단계 | 출력 형상 |
# |---|---|
# | prep: conv 3→64 | 64 × 32 × 32 |
# | layer1: conv 64→128, 최대 풀링 + 잔차 블록 | 128 × 16 × 16 |
# | layer2: conv 128→256, 최대 풀링 | 256 × 8 × 8 |
# | layer3: conv 256→512, 최대 풀링 + 잔차 블록 | 512 × 4 × 4 |
# | 전역 최대 풀링 → Linear 512→10 | 10 |

# %%
def conv_bn(c_in, c_out):
    return nn.Sequential(
        nn.Conv2d(c_in, c_out, kernel_size=3, padding=1, bias=False),
        nn.BatchNorm2d(c_out),
        nn.ReLU(inplace=True),
    )


class Residual(nn.Module):
    def __init__(self, c):
        super().__init__()
        self.block = nn.Sequential(conv_bn(c, c), conv_bn(c, c))

    def forward(self, x):
        return x + self.block(x)


class ResNet9(nn.Module):
    def __init__(self, num_classes=10, w=64):
        super().__init__()
        self.prep = conv_bn(3, w)
        self.layer1 = nn.Sequential(conv_bn(w, 2 * w), nn.MaxPool2d(2), Residual(2 * w))
        self.layer2 = nn.Sequential(conv_bn(2 * w, 4 * w), nn.MaxPool2d(2))
        self.layer3 = nn.Sequential(conv_bn(4 * w, 8 * w), nn.MaxPool2d(2), Residual(8 * w))
        self.pool = nn.AdaptiveMaxPool2d(1)
        self.fc = nn.Linear(8 * w, num_classes, bias=False)

    def forward(self, x):
        x = self.layer3(self.layer2(self.layer1(self.prep(x))))
        return self.fc(torch.flatten(self.pool(x), 1)) * 0.125   # 로짓을 작게 시작한다


model = ResNet9().to(device).to(memory_format=torch.channels_last)
print(f"파라미터 {sum(p.numel() for p in model.parameters()):,}개")
with torch.no_grad():
    print("출력 형상:", model(x_train[:2]).shape)

# %% [markdown]
# ## 4. 학습 설정
#
# - **옵티마이저**: SGD, 모멘텀 0.9(네스테로프), 가중치 감쇠 $5\times10^{-4}$ (22, 26일차)
# - **학습률**: 처음 5에폭 동안 0에서 0.4까지 선형으로 올리고, 마지막 에폭까지 0으로 선형으로 내린다(23일차의 원사이클 모양).
# - **배치 크기**: 512
# - **손실**: 레이블 스무딩 0.1을 쓴 교차 엔트로피(26일차)
# - **혼합 정밀도**: 순전파를 16비트로 계산해 빠르게 한다(30일차).

# %%
EPOCHS = 24                                               # 바꿔 보기
BATCH = 512
PEAK_LR, WARMUP = 0.4, 5
steps_per_epoch = math.ceil(len(x_train) / BATCH)
total_steps = EPOCHS * steps_per_epoch


def lr_at(step):
    e = step / steps_per_epoch                            # 진행한 에폭 수(소수)
    if e < WARMUP:
        return PEAK_LR * e / WARMUP
    return PEAK_LR * max(0.0, (EPOCHS - e) / (EPOCHS - WARMUP))


plt.figure(figsize=(6, 2.4))
plt.plot(np.arange(total_steps) / steps_per_epoch, [lr_at(s) for s in range(total_steps)])
plt.xlabel("epoch")
plt.ylabel("learning rate")
plt.grid(alpha=.3)
plt.show()

# %% [markdown]
# ## 5. 학습

# %%
def evaluate(model, x, y, bs=1000, tta=False):
    """정확도와 확률. tta=True면 좌우 뒤집은 이미지의 예측도 평균한다."""
    model.eval()
    probs = []
    with torch.no_grad(), torch.autocast(device.type, dtype=amp_dtype):
        for s in range(0, len(x), bs):
            xb = x[s:s + bs].contiguous(memory_format=torch.channels_last)
            p = model(xb).float().softmax(1)
            if tta:
                p = (p + model(xb.flip(3)).float().softmax(1)) / 2
            probs.append(p)
    model.train()
    P = torch.cat(probs)
    return (P.argmax(1) == y).float().mean().item(), P


def train(model, epochs=EPOCHS, seed=0):
    torch.manual_seed(seed)
    opt = torch.optim.SGD(model.parameters(), lr=0.0, momentum=0.9, nesterov=True,
                          weight_decay=5e-4)
    loss_fn = nn.CrossEntropyLoss(label_smoothing=0.1)
    scaler = torch.amp.GradScaler("cuda", enabled=use_cuda)
    hist, step = [], 0
    for ep in range(epochs):
        t0, run_loss, correct = time.perf_counter(), 0.0, 0
        order = torch.randperm(len(x_train), device=device)
        for s in range(0, len(x_train), BATCH):
            idx = order[s:s + BATCH]
            xb = augment(x_train[idx]).contiguous(memory_format=torch.channels_last)
            yb = y_train[idx]
            for g in opt.param_groups:
                g["lr"] = lr_at(step)
            with torch.autocast(device.type, dtype=amp_dtype):
                out = model(xb)
                loss = loss_fn(out, yb)
            opt.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.step(opt)
            scaler.update()
            run_loss += loss.item() * len(idx)
            correct += (out.argmax(1) == yb).sum().item()
            step += 1
        test_acc, _ = evaluate(model, x_test, y_test)
        hist.append((run_loss / len(x_train), correct / len(x_train), test_acc))
        print(f"에폭 {ep + 1:2d}  학습 손실 {hist[-1][0]:.3f}  학습 정확도 {hist[-1][1]:.3f}  "
              f"테스트 정확도 {test_acc:.4f}  ({time.perf_counter() - t0:.0f}초)")
    return np.array(hist)


t_start = time.perf_counter()
hist = train(model)
print(f"전체 학습 {(time.perf_counter() - t_start) / 60:.1f}분")

# %% [markdown]
# 이 프로젝트에서는 하이퍼파라미터를 고르지 않고 알려진 설정을 그대로 쓰므로, 에폭마다 테스트 정확도를 찍어 학습 과정을 본다. 설정을 바꿔 가며 비교하려면 4주차처럼 학습 데이터에서 검증 세트를 떼어 내야 한다.

# %%
fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 3.4))
ep = np.arange(1, len(hist) + 1)
a1.plot(ep, hist[:, 0], "o-", ms=3)
a1.set_xlabel("epoch")
a1.set_ylabel("train loss (label smoothing)")
a2.plot(ep, 100 * hist[:, 1], "o-", ms=3, label="train (augmented)")
a2.plot(ep, 100 * hist[:, 2], "o-", ms=3, label="test")
a2.set_xlabel("epoch")
a2.set_ylabel("accuracy (%)")
a2.legend()
for a in (a1, a2):
    a.grid(alpha=.3)
plt.tight_layout()
plt.show()

# %% [markdown]
# ## 6. 평가

# %%
acc, P = evaluate(model, x_test, y_test)
acc_tta, P_tta = evaluate(model, x_test, y_test, tta=True)
print(f"테스트 정확도 {acc:.4f},  좌우 뒤집기 평균(TTA) {acc_tta:.4f}")
pred = P_tta.argmax(1).cpu()
yt = y_test.cpu()
for k, name in enumerate(CLASSES):
    m = yt == k
    print(f"{name:11s} {(pred[m] == k).float().mean().item():.3f}")

# %%
cm = torch.zeros(10, 10, dtype=torch.long)
cm.index_put_((yt, pred), torch.ones_like(yt), accumulate=True)
off = cm.clone()
off.fill_diagonal_(0)
fig, ax = plt.subplots(figsize=(6, 5.2))
im = ax.imshow(off, cmap="Reds")
for i in range(10):
    for j in range(10):
        if cm[i, j]:
            color = "gray" if i == j else ("white" if off[i, j] > off.max() / 2 else "black")
            ax.text(j, i, int(cm[i, j]), ha="center", va="center", fontsize=7, color=color)
ax.set_xticks(range(10), CLASSES, rotation=60, fontsize=8)
ax.set_yticks(range(10), CLASSES, fontsize=8)
ax.set_xlabel("predicted")
ax.set_ylabel("true")
plt.colorbar(im, fraction=0.046)
plt.tight_layout()
plt.show()
pairs = sorted(((int(off[i, j]), i, j) for i in range(10) for j in range(10)), reverse=True)[:5]
print("가장 많이 헷갈린 쌍:", [f"{CLASSES[i]}→{CLASSES[j]}: {n}" for n, i, j in pairs])

# %% [markdown]
# ## 7. Grad-CAM
#
# Grad-CAM은 합성곱 층의 특성 맵 $A^k$(채널 $k$)와, 클래스 점수 $y^c$를 그 특성 맵으로 미분한 기울기를 쓴다. 보통 마지막 합성곱 층을 쓰지만, ResNet-9의 마지막 출력은 4×4로 너무 거칠어서 layer3의 첫 합성곱 출력(8×8)을 쓴다.
#
# 1. 채널 가중치: 기울기를 공간에 대해 평균한다. $\alpha_k = \frac{1}{HW}\sum_{i,j} \frac{\partial y^c}{\partial A^k_{ij}}$
# 2. 지도: 특성 맵의 가중합에 ReLU를 씌운다. $L = \mathrm{ReLU}\left(\sum_k \alpha_k A^k\right)$
# 3. 8×8 지도를 32×32로 키워 이미지 위에 겹친다.
#
# 특성 맵과 기울기는 **훅(hook)**으로 꺼낸다. 순전파 훅은 층의 출력을, 텐서 훅은 그 출력에 대한 기울기를 저장한다.

# %%
class GradCAM:
    def __init__(self, model, layer):
        self.model, self.acts, self.grads = model, None, None
        layer.register_forward_hook(self._save)

    def _save(self, module, inputs, output):
        self.acts = output
        if output.requires_grad:                            # 평가(no_grad) 중에는 건너뛴다
            output.register_hook(lambda g: setattr(self, "grads", g))

    def __call__(self, x, cls=None):
        self.model.eval()
        x = x.clone().requires_grad_(True)
        logits = self.model(x)                              # Grad-CAM은 32비트로 계산한다
        cls = logits.argmax(1) if cls is None else cls
        self.model.zero_grad()
        logits.gather(1, cls[:, None]).sum().backward()
        alpha = self.grads.mean(dim=(2, 3), keepdim=True)    # (B, C, 1, 1)
        cam = F.relu((alpha * self.acts).sum(1, keepdim=True))
        cam = F.interpolate(cam, size=x.shape[-2:], mode="bilinear", align_corners=False)
        cam = cam / (cam.amax(dim=(2, 3), keepdim=True) + 1e-8)
        self.model.train()
        return cam[:, 0].detach(), logits.softmax(1).detach()


gradcam = GradCAM(model, model.layer3[0])                    # 512 × 8 × 8 특성 맵 (풀링 전)
idx = torch.arange(0, 10000, 625)[:16]
cam, prob = gradcam(x_test[idx])
fig, axs = plt.subplots(2, 16, figsize=(16, 2.6))
for k in range(16):
    i = idx[k].item()
    p = prob[k].argmax().item()
    axs[0, k].imshow(show(x_test[i]))
    axs[0, k].set_title(f"{CLASSES[y_test[i]]}\n-> {CLASSES[p]}", fontsize=7,
                        color="black" if p == y_test[i] else "red")
    axs[1, k].imshow(show(x_test[i]))
    axs[1, k].imshow(cam[k].cpu(), cmap="jet", alpha=0.45)
    for a in axs[:, k]:
        a.axis("off")
plt.tight_layout()
plt.show()

# %% [markdown]
# **같은 이미지, 다른 클래스.** Grad-CAM은 클래스마다 따로 계산할 수 있다. 개와 고양이처럼 헷갈리는 이미지에서 각 클래스의 근거가 어디에 있는지 비교한다.

# %%
i = (y_test == CLASSES.index("dog")).nonzero()[3].item()
fig, axs = plt.subplots(1, 4, figsize=(8, 2.4))
axs[0].imshow(show(x_test[i]))
axs[0].set_title("input", fontsize=8)
for ax, name in zip(axs[1:], ["dog", "cat", "deer"]):
    c = torch.tensor([CLASSES.index(name)], device=device)
    cam, prob = gradcam(x_test[i:i + 1], c)
    ax.imshow(show(x_test[i]))
    ax.imshow(cam[0].cpu(), cmap="jet", alpha=0.45)
    ax.set_title(f"{name} (p = {prob[0, c].item():.2f})", fontsize=8)
for ax in axs:
    ax.axis("off")
plt.show()

# %% [markdown]
# ## 8. 저장

# %%
torch.save(model.state_dict(), "resnet9_cifar10.pt")
fresh = ResNet9().to(device).to(memory_format=torch.channels_last)
fresh.load_state_dict(torch.load("resnet9_cifar10.pt", map_location=device))
print("불러온 모델의 테스트 정확도:", evaluate(fresh, x_test, y_test)[0])

# %% [markdown]
# ## 9. 확장 과제
#
# 1. **증강 빼 보기.** `augment`에서 컷아웃, 뒤집기, 자르기를 하나씩 끄고 다시 학습해 정확도가 얼마나 떨어지는지 표로 정리한다.
# 2. **에폭 줄이기.** `EPOCHS`를 12로 줄여 정확도와 시간을 비교한다. 스케줄은 에폭 수에 맞춰 자동으로 늘어나고 줄어든다.
# 3. **틀린 이미지의 Grad-CAM.** 확률이 가장 높은데 틀린 이미지 8장을 골라 정답 클래스와 예측 클래스의 Grad-CAM을 나란히 그린다. 모델은 무엇을 근거로 틀렸는가?
# 4. **너비 바꾸기.** `ResNet9(w=32)`로 채널을 절반으로 줄이면 파라미터와 계산량이 약 1/4이 된다. 정확도는 얼마나 떨어지는가?
