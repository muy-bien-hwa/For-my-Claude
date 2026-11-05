# %% [markdown]
# # 34일차: 전이학습과 데이터 증강
#
# 딥러닝 8주 과정 34일차 실습 노트북이다. 꽃 사진 102종(Flowers102)을 클래스당 10장씩만으로 분류한다. ImageNet으로 미리 학습한 ResNet-18을 가져와 (1) 처음부터 학습, (2) 특징 추출, (3) 미세조정을 비교하고, 증강과 Mixup·CutMix를 적용한다.
#
# - **런타임**: T4 GPU를 권장한다(런타임 → 런타임 유형 변경). GPU에서 전체 실행은 15분 안팎으로 예상한다.
# - **그래프**: Colab에는 한글 글꼴이 없어 그래프의 축 이름과 범례는 영어로 쓴다.

# %%
import copy
import math
import time

import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision
from torch.utils.data import DataLoader
from torchvision import transforms
from torchvision.models import ResNet18_Weights, resnet18

use_cuda = torch.cuda.is_available()
device = torch.device("cuda" if use_cuda else "cpu")
amp_dtype = torch.float16 if use_cuda else torch.bfloat16
print("PyTorch", torch.__version__, " torchvision", torchvision.__version__, " 장치:", device)

# %% [markdown]
# ## 1. 데이터와 증강
#
# Flowers102는 학습 1,020장(클래스당 10장), 검증 1,020장, 테스트 6,149장이다. 사전학습 모델은 ImageNet의 전처리를 그대로 기대하므로 같은 평균·표준편차로 정규화한다.
#
# - **학습용 변환**: 무작위 크기 조절 자르기(원본의 35~100% 영역을 224×224로), 좌우 뒤집기, 색 변화. 에폭마다 다른 변형이 나온다.
# - **평가용 변환**: 짧은 변을 256으로 줄이고 가운데 224×224를 자른다. 무작위성이 없다.

# %%
MEAN, STD = (0.485, 0.456, 0.406), (0.229, 0.224, 0.225)        # ImageNet 통계
train_tf = transforms.Compose([
    transforms.RandomResizedCrop(224, scale=(0.35, 1.0)),
    transforms.RandomHorizontalFlip(),
    transforms.ColorJitter(0.3, 0.3, 0.3),
    transforms.ToTensor(),
    transforms.Normalize(MEAN, STD),
])
eval_tf = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(MEAN, STD),
])
train_set = torchvision.datasets.Flowers102("data", split="train", transform=train_tf, download=True)
train_plain = torchvision.datasets.Flowers102("data", split="train", transform=eval_tf, download=True)
val_set = torchvision.datasets.Flowers102("data", split="val", transform=eval_tf, download=True)
test_set = torchvision.datasets.Flowers102("data", split="test", transform=eval_tf, download=True)
print(len(train_set), len(val_set), len(test_set))
loader = lambda ds, shuffle, bs=32: DataLoader(ds, batch_size=bs, shuffle=shuffle, num_workers=2,
                                               pin_memory=use_cuda)

# %%
def show(t):
    return (t.permute(1, 2, 0) * torch.tensor(STD) + torch.tensor(MEAN)).clamp(0, 1).numpy()


raw = torchvision.datasets.Flowers102("data", split="train", download=True)
img, label = raw[0]
fig, axs = plt.subplots(1, 7, figsize=(13, 2.2))
axs[0].imshow(img)
axs[0].set_title(f"original (class {label})", fontsize=8)
torch.manual_seed(0)
for ax in axs[1:]:
    ax.imshow(show(train_tf(img)))
    ax.set_title("augmented", fontsize=8)
for ax in axs:
    ax.axis("off")
plt.show()

# %% [markdown]
# ## 2. 학습 도구
#
# 30일차 템플릿을 줄인 것이다. `param_groups`로 층마다 다른 학습률을 줄 수 있게 했다. `mix`에 Mixup이나 CutMix 함수를 넘기면 배치마다 적용한다.

# %%
@torch.inference_mode()
def evaluate(model, ds, bs=128):
    model.eval()
    correct = 0
    for xb, yb in loader(ds, False, bs):
        with torch.autocast(device.type, dtype=amp_dtype):
            correct += (model(xb.to(device)).argmax(1).cpu() == yb).sum().item()
    return correct / len(ds)


def train(model, param_groups, epochs, ds=train_set, mix=None, label_smoothing=0.1, seed=0):
    torch.manual_seed(seed)
    opt = torch.optim.AdamW(param_groups, weight_decay=0.05)
    dl = loader(ds, True)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=[g["lr"] for g in param_groups],
                                                total_steps=epochs * len(dl), pct_start=0.2)
    scaler = torch.amp.GradScaler("cuda", enabled=use_cuda)
    for ep in range(epochs):
        model.train()
        t0, tot, n = time.perf_counter(), 0.0, 0
        for xb, yb in dl:
            xb, yb = xb.to(device), yb.to(device)
            with torch.autocast(device.type, dtype=amp_dtype):
                if mix is None:
                    loss = F.cross_entropy(model(xb), yb, label_smoothing=label_smoothing)
                else:
                    xm, ya, yb2, lam = mix(xb, yb)
                    out = model(xm)
                    loss = lam * F.cross_entropy(out, ya) + (1 - lam) * F.cross_entropy(out, yb2)
            opt.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.step(opt)
            scaler.update()
            sched.step()
            tot += loss.item() * len(yb)
            n += len(yb)
        if ep % 5 == 4 or ep == epochs - 1:
            print(f"  에폭 {ep + 1:2d}  학습 손실 {tot / n:.3f}  검증 정확도 {evaluate(model, val_set):.4f}  "
                  f"({time.perf_counter() - t0:.0f}초)")
    return model


def new_head(model, num_classes=102):
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    return model.to(device).to(memory_format=torch.channels_last)

# %% [markdown]
# **사전학습 가중치.** 기본은 torchvision의 ImageNet 가중치(`IMAGENET1K_V1`)다. 강의 페이지의 수치는 같은 ResNet-18 구조에 timm 라이브러리가 공개한 다른 ImageNet 가중치(`resnet18_a1_0`, 더 강한 증강과 긴 학습으로 얻은 것)로 검증했다. 페이지와 같은 결과를 보려면 `WEIGHTS = "timm_a1"`로 바꾼다. 두 가중치를 비교하는 것 자체가 좋은 실험이다.

# %%
WEIGHTS = "torchvision"                                  # 바꿔 보기: "timm_a1"
TIMM_A1 = ("https://github.com/rwightman/pytorch-image-models/releases/download/"
           "v0.1-rsb-weights/resnet18_a1_0-d63eafa0.pth")


def pretrained_resnet18():
    if WEIGHTS == "torchvision":
        return resnet18(weights=ResNet18_Weights.IMAGENET1K_V1)
    m = resnet18()
    m.load_state_dict(torch.hub.load_state_dict_from_url(TIMM_A1, map_location="cpu"))
    return m

# %% [markdown]
# ## 3. 처음부터 학습
#
# 무작위 초기화한 ResNet-18을 1,020장으로 학습한다. 파라미터는 1,100만 개인데 데이터는 클래스당 10장이다.

# %%
torch.manual_seed(0)
scratch = new_head(resnet18(weights=None))
t0 = time.perf_counter()
train(scratch, [{"params": scratch.parameters(), "lr": 2e-3}], epochs=30)
acc_scratch = evaluate(scratch, val_set)
print(f"처음부터 학습: 검증 정확도 {acc_scratch:.4f}  ({time.perf_counter() - t0:.0f}초)")

# %% [markdown]
# ## 4. 특징 추출
#
# 사전학습 모델의 모든 층을 얼리고(`requires_grad = False`), 마지막 선형층만 새로 학습한다. 얼린 부분은 배치 정규화도 평가 모드로 두어 ImageNet에서 얻은 통계를 그대로 쓴다.

# %%
torch.manual_seed(0)
fe = new_head(pretrained_resnet18())
for name, p in fe.named_parameters():
    p.requires_grad = name.startswith("fc.")
n_train = sum(p.numel() for p in fe.parameters() if p.requires_grad)
print(f"학습하는 파라미터 {n_train:,}개 / 전체 {sum(p.numel() for p in fe.parameters()):,}개")


class FrozenBN(nn.Module):
    """학습 모드에서도 얼린 부분의 배치 정규화를 평가 모드로 유지하는 감싸개"""
    def __init__(self, model):
        super().__init__()
        self.model = model

    def train(self, mode=True):
        super().train(mode)
        for m in self.model.modules():
            if isinstance(m, nn.BatchNorm2d):
                m.eval()
        return self

    def forward(self, x):
        return self.model(x)


fe_wrapped = FrozenBN(fe)
t0 = time.perf_counter()
train(fe_wrapped, [{"params": fe.fc.parameters(), "lr": 3e-3}], epochs=15)
acc_fe = evaluate(fe_wrapped, val_set)
print(f"특징 추출: 검증 정확도 {acc_fe:.4f}  ({time.perf_counter() - t0:.0f}초)")

# %% [markdown]
# ## 5. 미세조정과 차등 학습률
#
# 모든 층을 학습하되, 앞쪽 층일수록 작은 학습률을 준다. 앞쪽 층의 일반적인 특징(경계, 질감)은 조금만 고치고, 새로 붙인 선형층은 크게 학습한다. 학습률이 너무 크면 사전학습으로 얻은 특징을 망가뜨린다(파국적 망각).

# %%
def param_groups(model, base_lr):
    """앞쪽 층일수록 학습률을 줄인다: stem·layer1 → ×0.1, layer2 → ×0.2, layer3 → ×0.4, layer4 → ×0.7, fc → ×1"""
    groups = {"stem": [], "layer1": [], "layer2": [], "layer3": [], "layer4": [], "fc": []}
    for name, p in model.named_parameters():
        key = name.split(".")[0]
        groups[key if key in groups else "stem"].append(p)
    scale = {"stem": 0.1, "layer1": 0.1, "layer2": 0.2, "layer3": 0.4, "layer4": 0.7, "fc": 1.0}
    return [{"params": ps, "lr": base_lr * scale[k]} for k, ps in groups.items()]


torch.manual_seed(0)
ft = new_head(pretrained_resnet18())
t0 = time.perf_counter()
train(ft, param_groups(ft, 2e-3), epochs=15)
acc_ft = evaluate(ft, val_set)
print(f"미세조정(차등 학습률): 검증 정확도 {acc_ft:.4f}  ({time.perf_counter() - t0:.0f}초)")

# %% [markdown]
# **같은 학습률로 미세조정하면?** 모든 층에 선형층과 같은 큰 학습률(2e-3)을 주고 비교한다.

# %%
torch.manual_seed(0)
ft_same = new_head(pretrained_resnet18())
train(ft_same, [{"params": ft_same.parameters(), "lr": 2e-3}], epochs=15)
acc_ft_same = evaluate(ft_same, val_set)
print(f"미세조정(모든 층 같은 학습률 2e-3): 검증 정확도 {acc_ft_same:.4f}")

# %% [markdown]
# ## 6. 증강의 효과
#
# 미세조정을 증강 없이(평가용 변환으로) 학습해 비교한다.

# %%
torch.manual_seed(0)
ft_noaug = new_head(pretrained_resnet18())
train(ft_noaug, param_groups(ft_noaug, 2e-3), epochs=15, ds=train_plain)
acc_noaug = evaluate(ft_noaug, val_set)
print(f"미세조정, 증강 없음: 검증 정확도 {acc_noaug:.4f}")

# %% [markdown]
# ## 7. Mixup과 CutMix
#
# - **Mixup**: 두 이미지를 $\lambda : 1-\lambda$로 섞고, 레이블도 같은 비율로 섞는다. $\lambda \sim \mathrm{Beta}(\alpha, \alpha)$.
# - **CutMix**: 한 이미지의 사각형 영역을 다른 이미지의 같은 영역으로 바꾸고, 면적 비율로 레이블을 섞는다.
#
# 섞은 레이블의 교차 엔트로피는 두 레이블에 대한 교차 엔트로피의 가중합과 같으므로, 정수 레이블 두 개와 $\lambda$만 넘기면 된다.

# %%
def mixup(x, y, alpha=0.2):
    lam = float(np.random.beta(alpha, alpha))
    perm = torch.randperm(len(x), device=x.device)
    return lam * x + (1 - lam) * x[perm], y, y[perm], lam


def cutmix(x, y, alpha=1.0):
    lam = float(np.random.beta(alpha, alpha))
    perm = torch.randperm(len(x), device=x.device)
    H, W = x.shape[-2:]
    h, w = int(H * math.sqrt(1 - lam)), int(W * math.sqrt(1 - lam))
    cy, cx = np.random.randint(H), np.random.randint(W)
    y0, y1 = max(cy - h // 2, 0), min(cy + h // 2, H)
    x0, x1 = max(cx - w // 2, 0), min(cx + w // 2, W)
    x = x.clone()
    x[:, :, y0:y1, x0:x1] = x[perm, :, y0:y1, x0:x1]
    lam = 1 - (y1 - y0) * (x1 - x0) / (H * W)          # 실제로 붙인 면적으로 다시 계산
    return x, y, y[perm], lam


np.random.seed(0)
torch.manual_seed(0)
xb, yb = next(iter(loader(train_set, True, 8)))
fig, axs = plt.subplots(2, 4, figsize=(10, 5))
for row, (fn, name) in enumerate([(mixup, "Mixup"), (cutmix, "CutMix")]):
    xm, ya, yb2, lam = fn(xb, yb, 1.0)
    for k in range(4):
        axs[row, k].imshow(show(xm[k]))
        axs[row, k].set_title(f"{name}: {lam:.2f} x class {ya[k].item()} + {1 - lam:.2f} x class {yb2[k].item()}",
                              fontsize=7)
        axs[row, k].axis("off")
plt.tight_layout()
plt.show()

# %%
np.random.seed(0)
torch.manual_seed(0)
ft_cm = new_head(pretrained_resnet18())
train(ft_cm, param_groups(ft_cm, 2e-3), epochs=15, mix=cutmix)
acc_cm = evaluate(ft_cm, val_set)
print(f"미세조정 + CutMix: 검증 정확도 {acc_cm:.4f}")

# %% [markdown]
# ## 8. 정리와 최종 평가
#
# 검증 정확도로 가장 좋은 방법을 고르고, 그 모델로 테스트 세트(6,149장)를 한 번 평가한다.

# %%
summary = {"scratch": (acc_scratch, scratch), "feature extraction": (acc_fe, fe_wrapped),
           "fine-tune (discriminative lr)": (acc_ft, ft), "fine-tune (same lr)": (acc_ft_same, ft_same),
           "fine-tune, no augmentation": (acc_noaug, ft_noaug), "fine-tune + CutMix": (acc_cm, ft_cm)}
for name, (acc, _) in summary.items():
    print(f"{name:32s} 검증 정확도 {acc:.4f}")
best_name = max(summary, key=lambda k: summary[k][0])
print(f"선택: {best_name},  테스트 정확도 {evaluate(summary[best_name][1], test_set):.4f}")
