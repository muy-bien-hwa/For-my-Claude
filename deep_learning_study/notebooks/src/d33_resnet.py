# %% [markdown]
# # 33일차: 평범한 망과 ResNet
#
# 딥러닝 8주 과정 33일차 실습 노트북이다. 층만 쌓은 "평범한 망"과 잔차 연결을 넣은 ResNet을 깊이 20과 56으로 만들어, 깊은 평범한 망이 오히려 학습 오차가 큰 성능 저하 문제와 잔차 연결의 효과를 확인한다.
#
# - **런타임**: T4 GPU를 권장한다(런타임 → 런타임 유형 변경). 기본 설정(학습 1만 장, 15에폭, 모델 4개)은 GPU에서 수 분 걸린다.
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
# ## 1. 데이터
#
# CIFAR-10 학습 데이터 중 1만 장만 쓴다(`N_TRAIN`). 성능 저하 문제는 **최적화**의 문제라 학습 데이터에 대한 손실에서 드러나므로, 적은 데이터로도 충분히 보인다. 시간이 있으면 `N_TRAIN = 50000`으로 늘려 본다.

# %%
N_TRAIN = 10000                                          # 바꿔 보기: 50000
train_set = torchvision.datasets.CIFAR10("data", train=True, download=True)
test_set = torchvision.datasets.CIFAR10("data", train=False, download=True)


def to_tensor(ds):
    x = torch.as_tensor(ds.data).permute(0, 3, 1, 2).float() / 255
    return x, torch.as_tensor(ds.targets)


x_train, y_train = to_tensor(train_set)
x_test, y_test = to_tensor(test_set)
MEAN = x_train.mean(dim=(0, 2, 3), keepdim=True)
STD = x_train.std(dim=(0, 2, 3), keepdim=True)
g = torch.Generator().manual_seed(0)
sub = torch.randperm(len(x_train), generator=g)[:N_TRAIN]
x_train = ((x_train[sub] - MEAN) / STD).to(device)
y_train = y_train[sub].to(device)
x_test = ((x_test - MEAN) / STD).to(device)
y_test = y_test.to(device)
print(x_train.shape, x_test.shape)


def augment(x, pad=4):
    """무작위 자르기(반사 패딩 4) + 좌우 뒤집기 (35일차와 같은 방식)"""
    B, C, H, W = x.shape
    xp = F.pad(x, (pad,) * 4, mode="reflect")
    i = torch.randint(0, 2 * pad + 1, (B,), device=x.device)
    j = torch.randint(0, 2 * pad + 1, (B,), device=x.device)
    rows = (i[:, None] + torch.arange(H, device=x.device))[:, None, :, None]
    cols = (j[:, None] + torch.arange(W, device=x.device))[:, None, None, :]
    x = xp[torch.arange(B, device=x.device)[:, None, None, None],
           torch.arange(C, device=x.device)[None, :, None, None], rows, cols]
    flip = torch.rand(B, device=x.device) < 0.5
    return torch.where(flip[:, None, None, None], x.flip(3), x)

# %% [markdown]
# ## 2. 모델: 같은 구조, 잔차 연결만 다르게
#
# He et al.(2016)의 CIFAR용 구조를 따른다. 3×3 합성곱(16채널) 다음에 세 단계가 있고, 단계마다 블록이 $n$개다. 채널은 16 → 32 → 64로 늘고, 둘째·셋째 단계의 첫 블록이 스트라이드 2로 해상도를 절반으로 줄인다. 블록 하나에 합성곱이 2개이므로 전체 깊이는 $6n + 2$층이다($n = 3$이면 20층, $n = 9$면 56층).
#
# 블록은 `합성곱 → BN → ReLU → 합성곱 → BN`이고, 잔차 연결이 있으면 입력을 더한 뒤 ReLU를 씌운다. 입력과 출력의 형상이 다르면(채널 수나 해상도가 바뀌는 첫 블록) 지름길에 1×1 합성곱 + BN을 넣어 형상을 맞춘다(사영 지름길).

# %%
class Block(nn.Module):
    def __init__(self, c_in, c_out, stride, residual):
        super().__init__()
        self.residual = residual
        self.conv1 = nn.Conv2d(c_in, c_out, 3, stride, 1, bias=False)
        self.bn1 = nn.BatchNorm2d(c_out)
        self.conv2 = nn.Conv2d(c_out, c_out, 3, 1, 1, bias=False)
        self.bn2 = nn.BatchNorm2d(c_out)
        self.shortcut = nn.Identity()
        if residual and (stride != 1 or c_in != c_out):
            self.shortcut = nn.Sequential(nn.Conv2d(c_in, c_out, 1, stride, bias=False),
                                          nn.BatchNorm2d(c_out))

    def forward(self, x):
        out = F.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        if self.residual:
            out = out + self.shortcut(x)                 # 잔차 연결: F(x) + x
        return F.relu(out)


class CifarNet(nn.Module):
    def __init__(self, n, residual, num_classes=10):
        super().__init__()
        self.stem = nn.Sequential(nn.Conv2d(3, 16, 3, 1, 1, bias=False), nn.BatchNorm2d(16), nn.ReLU())
        blocks, c_in = [], 16
        for c_out, stride in [(16, 1), (32, 2), (64, 2)]:
            for b in range(n):
                blocks.append(Block(c_in, c_out, stride if b == 0 else 1, residual))
                c_in = c_out
        self.blocks = nn.Sequential(*blocks)
        self.head = nn.Linear(64, num_classes)

    def forward(self, x):
        x = self.blocks(self.stem(x))
        return self.head(F.adaptive_avg_pool2d(x, 1).flatten(1))


for n in (3, 9):
    for res in (False, True):
        m = CifarNet(n, res)
        print(f"{'ResNet' if res else '평범한 망'}-{6 * n + 2}: 파라미터 {sum(p.numel() for p in m.parameters()):,}개")

# %% [markdown]
# ## 3. 초기화 직후의 기울기 흐름
#
# 학습하기 전에, 무작위 배치 하나로 역전파해 블록마다 출력에 대한 기울기의 크기를 잰다. 평범한 망은 입력 쪽으로 갈수록 기울기가 어떻게 되는가?

# %%
def block_grad_norms(model, x, y):
    outs = []
    hooks = [b.register_forward_hook(lambda m, i, o: (o.retain_grad(), outs.append(o)))
             for b in model.blocks]
    model.train()
    F.cross_entropy(model(x), y).backward()
    for h in hooks:
        h.remove()
    return [o.grad.norm().item() / math.sqrt(o.numel()) for o in outs]


torch.manual_seed(0)
xb, yb = x_train[:128], y_train[:128]
plt.figure(figsize=(7, 3.4))
for res, c in [(False, "tab:red"), (True, "tab:blue")]:
    torch.manual_seed(0)
    gnorm = block_grad_norms(CifarNet(9, res).to(device), xb, yb)
    plt.semilogy(range(1, len(gnorm) + 1), gnorm, "o-", ms=3, color=c,
                 label="ResNet-56" if res else "plain-56")
    print(f"{'ResNet-56' if res else '평범한 망-56'}: 첫 블록 {gnorm[0]:.2e}, 마지막 블록 {gnorm[-1]:.2e}, "
          f"비 {gnorm[0] / gnorm[-1]:.2f}")
plt.xlabel("block (1 = input side)")
plt.ylabel("RMS gradient at block output")
plt.grid(alpha=.3)
plt.legend()
plt.show()

# %% [markdown]
# ## 4. 학습: 네 모델 비교
#
# SGD(모멘텀 0.9, 네스테로프), 가중치 감쇠 $5\times10^{-4}$, 원사이클 학습률(최대 0.1), 배치 128, 증강(자르기 + 뒤집기)으로 네 모델을 똑같이 학습한다. 학습 손실은 증강이 켜진 상태로 잰다.

# %%
EPOCHS = 15                                              # 바꿔 보기


@torch.inference_mode()
def evaluate(model, x, y, bs=1000):
    model.eval()
    correct, tot = 0, 0.0
    for s in range(0, len(x), bs):
        with torch.autocast(device.type, dtype=amp_dtype):
            out = model(x[s:s + bs]).float()
        tot += F.cross_entropy(out, y[s:s + bs], reduction="sum").item()
        correct += (out.argmax(1) == y[s:s + bs]).sum().item()
    return tot / len(x), correct / len(x)


def train(model, epochs=EPOCHS, lr=0.1, bs=128, seed=0):
    torch.manual_seed(seed)
    opt = torch.optim.SGD(model.parameters(), lr=lr, momentum=0.9, nesterov=True, weight_decay=5e-4)
    steps = math.ceil(len(x_train) / bs)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=lr, total_steps=epochs * steps,
                                                pct_start=0.15)
    scaler = torch.amp.GradScaler("cuda", enabled=use_cuda)
    hist = []
    for ep in range(epochs):
        model.train()
        tot, correct = 0.0, 0
        order = torch.randperm(len(x_train), device=device)
        for s in range(0, len(x_train), bs):
            idx = order[s:s + bs]
            xb = augment(x_train[idx]).contiguous(memory_format=torch.channels_last)
            with torch.autocast(device.type, dtype=amp_dtype):
                out = model(xb)
                loss = F.cross_entropy(out, y_train[idx])
            opt.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.step(opt)
            scaler.update()
            sched.step()
            tot += loss.item() * len(idx)
            correct += (out.argmax(1) == y_train[idx]).sum().item()
        _, te = evaluate(model, x_test, y_test)
        hist.append((tot / len(x_train), 1 - correct / len(x_train), te))
    return np.array(hist)


results = {}
for n in (3, 9):
    for res in (False, True):
        name = f"{'ResNet' if res else 'plain'}-{6 * n + 2}"
        torch.manual_seed(0)
        model = CifarNet(n, res).to(device).to(memory_format=torch.channels_last)
        t0 = time.perf_counter()
        h = train(model)
        results[name] = h
        print(f"{name:10s} 마지막 에폭 학습 손실 {h[-1, 0]:.3f}  학습 오차 {h[-1, 1]:.3f}  "
              f"테스트 정확도 {h[-1, 2]:.4f}  ({time.perf_counter() - t0:.0f}초)")

# %%
fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 3.6))
style = {"plain-20": ("tab:red", "--"), "plain-56": ("tab:red", "-"),
         "ResNet-20": ("tab:blue", "--"), "ResNet-56": ("tab:blue", "-")}
for name, h in results.items():
    c, ls = style[name]
    ep = np.arange(1, len(h) + 1)
    a1.plot(ep, 100 * h[:, 1], ls, color=c, label=name)
    a2.plot(ep, 100 * h[:, 2], ls, color=c, label=name)
a1.set_ylabel("training error (%)")
a2.set_ylabel("test accuracy (%)")
for a in (a1, a2):
    a.set_xlabel("epoch")
    a.grid(alpha=.3)
    a.legend()
plt.tight_layout()
plt.show()

# %% [markdown]
# 평범한 망은 56층이 20층보다 **학습 오차**가 크다. 과적합이라면 학습 오차는 오히려 작아야 하므로, 이것은 깊은 망을 최적화하기 어려워서 생기는 문제다(성능 저하 문제). 잔차 연결을 넣으면 56층이 20층보다 좋아진다.
#
# ## 5. 병목 블록과 깊이별 분리 합성곱의 비용
#
# 층의 파라미터와 곱셈-덧셈 횟수를 직접 세어 비교한다. 입력은 56×56, 채널 256이다.

# %%
def cost(m, x):
    macs = []

    def hook(mod, inp, out):
        if isinstance(mod, nn.Conv2d):
            macs.append(out[0].numel() * (mod.in_channels // mod.groups) * mod.kernel_size[0] * mod.kernel_size[1])

    hs = [mod.register_forward_hook(hook) for mod in m.modules() if isinstance(mod, nn.Conv2d)]
    with torch.no_grad():
        m(x)
    for h in hs:
        h.remove()
    return sum(p.numel() for p in m.parameters() if p.dim() > 1), sum(macs)


x = torch.randn(1, 256, 56, 56)
designs = {
    "3x3 conv x2 (256)": nn.Sequential(nn.Conv2d(256, 256, 3, padding=1, bias=False),
                                       nn.Conv2d(256, 256, 3, padding=1, bias=False)),
    "bottleneck 1x1-3x3-1x1": nn.Sequential(nn.Conv2d(256, 64, 1, bias=False),
                                            nn.Conv2d(64, 64, 3, padding=1, bias=False),
                                            nn.Conv2d(64, 256, 1, bias=False)),
    "depthwise 3x3 + pointwise 1x1": nn.Sequential(nn.Conv2d(256, 256, 3, padding=1, groups=256, bias=False),
                                                   nn.Conv2d(256, 256, 1, bias=False)),
}
for name, m in designs.items():
    p, macs = cost(m, x)
    print(f"{name:32s} 가중치 {p:>9,}개   곱셈-덧셈 {macs / 1e6:8.1f}M")

# %% [markdown]
# ## 6. torchvision의 ResNet-18
#
# 34일차에 쓸 ImageNet용 ResNet-18의 구조를 본다. 입력 224×224에서 첫 층이 7×7 합성곱(스트라이드 2)과 최대 풀링으로 해상도를 4분의 1로 줄인 뒤, 기본 블록 2개씩 네 단계를 지난다.

# %%
r18 = torchvision.models.resnet18(weights=None)
print(f"ResNet-18 파라미터 {sum(p.numel() for p in r18.parameters()):,}개")
print(r18.layer2[0])
x = torch.randn(1, 3, 224, 224)
for name in ["conv1", "maxpool", "layer1", "layer2", "layer3", "layer4", "avgpool"]:
    x = getattr(r18, name)(x) if name != "conv1" else r18.relu(r18.bn1(r18.conv1(x)))
    print(f"{name:8s} → {tuple(x.shape[1:])}")
