from nbgen import md, code, header
from nb_part1 import TEMPLATE_FUNCS

day20 = [
    header("Day 20", "RNN과 LSTM: 시계열 예측과 셰익스피어 생성기",
           ["사인파 시계열 예측으로 RNN과 LSTM의 장기 기억 능력을 비교한다",
            "문자 단위 LSTM 언어 모델을 학습하고 temperature를 바꿔 텍스트를 생성한다"]),
    code('''
import math, time, numpy as np, torch, torch.nn as nn, torch.nn.functional as F
import matplotlib.pyplot as plt
device = "cuda" if torch.cuda.is_available() else "cpu"; torch.manual_seed(0)
'''),
    md("## 1. 장기 기억 테스트\n입력 시퀀스의 **첫 번째 값**을 마지막에 맞히는 과제입니다. 중간은 모두 잡음입니다. 시퀀스가 길어질수록 바닐라 RNN은 첫 값을 잊어버립니다."),
    code('''
def make_batch(B, T):
    x = torch.randn(B, T, 1) * 0.5
    y = x[:, 0, 0].clone()                        # 정답 = 첫 값
    return x.to(device), y.to(device)

class SeqReg(nn.Module):
    def __init__(self, cell="lstm", hidden=64):
        super().__init__()
        rnn = {"rnn": nn.RNN, "lstm": nn.LSTM, "gru": nn.GRU}[cell]
        self.rnn = rnn(1, hidden, batch_first=True); self.head = nn.Linear(hidden, 1)
    def forward(self, x):
        out, _ = self.rnn(x)                      # (B, T, H)
        return self.head(out[:, -1]).squeeze(-1)  # 마지막 시점으로 예측

def run(cell, T, steps=1500):
    m = SeqReg(cell).to(device); opt = torch.optim.Adam(m.parameters(), 3e-3)
    for s in range(steps):
        x, y = make_batch(128, T); loss = F.mse_loss(m(x), y)
        opt.zero_grad(); loss.backward(); torch.nn.utils.clip_grad_norm_(m.parameters(), 1.0); opt.step()
    with torch.no_grad(): x, y = make_batch(1000, T); return F.mse_loss(m(x), y).item()

print("기준선(항상 0 예측) MSE ≈ 0.25")
for T in [5, 20, 50]:
    print(f"T={T:3d}  " + "  ".join(f"{c}: {run(c, T):.4f}" for c in ["rnn", "gru", "lstm"]))
'''),
    md("## 2. 문자 단위 언어 모델: 셰익스피어"),
    code('''
import urllib.request
url = "https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt"
text = urllib.request.urlopen(url).read().decode("utf-8")
chars = sorted(set(text)); V = len(chars)
stoi = {c: i for i, c in enumerate(chars)}; itos = {i: c for c, i in stoi.items()}
data = torch.tensor([stoi[c] for c in text], dtype=torch.long)
n = int(0.9 * len(data)); train_data, val_data = data[:n], data[n:]
print(f"{len(text):,} chars, vocab {V}"); print(text[:300])

def get_batch(split, T=128, B=64):
    d = train_data if split == "train" else val_data
    ix = torch.randint(len(d) - T - 1, (B,))
    x = torch.stack([d[i:i+T] for i in ix]); y = torch.stack([d[i+1:i+T+1] for i in ix])
    return x.to(device), y.to(device)
'''),
    code('''
class CharLSTM(nn.Module):
    def __init__(self, V, emb=64, hidden=512, layers=2):
        super().__init__()
        self.emb = nn.Embedding(V, emb)
        self.lstm = nn.LSTM(emb, hidden, layers, batch_first=True, dropout=0.2)
        self.head = nn.Linear(hidden, V)
    def forward(self, idx, state=None):
        out, state = self.lstm(self.emb(idx), state)
        return self.head(out), state

@torch.no_grad()
def generate(model, start="ROMEO:", n=400, temperature=0.8):
    model.eval(); idx = torch.tensor([[stoi[c] for c in start]], device=device); out = list(start); state = None
    logits, state = model(idx, state)
    for _ in range(n):
        probs = F.softmax(logits[0, -1] / temperature, -1)
        nxt = torch.multinomial(probs, 1).item(); out.append(itos[nxt])
        logits, state = model(torch.tensor([[nxt]], device=device), state)
    model.train(); return "".join(out)

model = CharLSTM(V).to(device)
opt = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=0.01)
print(f"{sum(p.numel() for p in model.parameters())/1e6:.2f}M params,  initial loss should be ~ln(V) = {math.log(V):.2f}")
for it in range(3001):
    x, y = get_batch("train")
    logits, _ = model(x); loss = F.cross_entropy(logits.reshape(-1, V), y.reshape(-1))
    opt.zero_grad(); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step()
    if it % 500 == 0:
        with torch.no_grad():
            xv, yv = get_batch("val"); vl = F.cross_entropy(model(xv)[0].reshape(-1, V), yv.reshape(-1)).item()
        print(f"\\n=== iter {it}  train {loss.item():.3f}  val {vl:.3f} ===")
        print(generate(model, n=200))
'''),
    md("## 3. 온도 비교"),
    code('''
for t in [0.3, 0.8, 1.5]:
    print(f"\\n----- temperature {t} -----"); print(generate(model, "JULIET:", 300, t))
'''),
    md("## 과제\n- 세 온도의 결과를 학습 노트에 붙이고 특징을 비교하세요.\n- (도전) `text`를 여러분이 고른 한국어 텍스트로 바꿔 학습해 보세요 (저작권 유의)."),
]

week3 = [
    header("Day 21 · 3주차 프로젝트", "CIFAR-10 종합 프로젝트",
           ["Day 16 템플릿 + Day 18 ResNet + Day 19 증강을 조합한다",
            "목표: 테스트 정확도 93% 이상, 클래스별 정확도·오분류 분석",
            "보너스: 사전학습 ResNet 미세조정으로 96%+"]),
    code(TEMPLATE_FUNCS),
    md("## 1. 데이터 (강한 증강)"),
    code('''
mean, std = (0.4914, 0.4822, 0.4465), (0.2470, 0.2435, 0.2616)
train_tf = transforms.Compose([transforms.RandomCrop(32, padding=4), transforms.RandomHorizontalFlip(),
                               transforms.TrivialAugmentWide(), transforms.ToTensor(), transforms.Normalize(mean, std),
                               transforms.RandomErasing(p=0.25)])
test_tf = transforms.Compose([transforms.ToTensor(), transforms.Normalize(mean, std)])
tr_full = datasets.CIFAR10("data", train=True, download=True, transform=train_tf)
va_full = datasets.CIFAR10("data", train=True, download=True, transform=test_tf)
test_ds = datasets.CIFAR10("data", train=False, download=True, transform=test_tf)
idx = torch.randperm(50000, generator=torch.Generator().manual_seed(0))
train_dl = DataLoader(torch.utils.data.Subset(tr_full, idx[:45000]), 256, shuffle=True, num_workers=2, pin_memory=True, drop_last=True)
val_dl = DataLoader(torch.utils.data.Subset(va_full, idx[45000:]), 1000, num_workers=2)
test_dl = DataLoader(test_ds, 1000, num_workers=2); classes = tr_full.classes
'''),
    md("## 2. 모델 (Day 18의 ResNet)"),
    code('''
class BasicBlock(nn.Module):
    def __init__(self, c_in, c_out, stride=1):
        super().__init__()
        self.c1 = nn.Conv2d(c_in, c_out, 3, stride, 1, bias=False); self.b1 = nn.BatchNorm2d(c_out)
        self.c2 = nn.Conv2d(c_out, c_out, 3, 1, 1, bias=False); self.b2 = nn.BatchNorm2d(c_out)
        self.sc = nn.Identity() if (stride == 1 and c_in == c_out) else nn.Sequential(nn.Conv2d(c_in, c_out, 1, stride, bias=False), nn.BatchNorm2d(c_out))
    def forward(self, x): return F.relu(self.b2(self.c2(F.relu(self.b1(self.c1(x))))) + self.sc(x))
class ResNet18(nn.Module):
    def __init__(self, n=10):
        super().__init__()
        self.stem = nn.Sequential(nn.Conv2d(3, 64, 3, 1, 1, bias=False), nn.BatchNorm2d(64), nn.ReLU())
        L, c = [], 64
        for i, w in enumerate([64, 128, 256, 512]):
            for j in range(2): L.append(BasicBlock(c, w, 2 if (j == 0 and i > 0) else 1)); c = w
        self.layers = nn.Sequential(*L); self.head = nn.Sequential(nn.AdaptiveAvgPool2d(1), nn.Flatten(), nn.Linear(512, n))
    def forward(self, x): return self.head(self.layers(self.stem(x)))
'''),
    md("## 3. 배치 하나 과적합 테스트 (Day 28) → 본 학습"),
    code('''
seed_everything(0); m = ResNet18().to(device); o = torch.optim.AdamW(m.parameters(), 1e-3)
xb, yb = next(iter(train_dl)); xb, yb = xb[:32].to(device), yb[:32].to(device)
for i in range(150):
    l = F.cross_entropy(m(xb), yb); o.zero_grad(); l.backward(); o.step()
print("single-batch loss after 150 steps:", l.item(), "(should be near 0)")
'''),
    code('''
seed_everything(42)
model = ResNet18().to(device).to(memory_format=torch.channels_last)
hist = fit(model, train_dl, val_dl, epochs=40, lr=0.1, wd=5e-4, sgd=True, label_smoothing=0.1, ckpt="proj_best.pt")
plot_hist(hist, "CIFAR-10 project")
'''),
    md("## 4. 최종 평가와 분석"),
    code('''
import matplotlib.pyplot as plt
test_loss, test_acc = evaluate(model, test_dl, nn.CrossEntropyLoss())
print(f"TEST accuracy {test_acc:.4f}")
model.eval(); preds, ys, probs, xs = [], [], [], []
with torch.no_grad():
    for xb, yb in test_dl:
        p = F.softmax(model(xb.to(device)), -1).cpu(); preds.append(p.argmax(1)); probs.append(p.max(1).values); ys.append(yb); xs.append(xb)
preds, ys, probs, xs = map(torch.cat, (preds, ys, probs, xs))
cm = torch.zeros(10, 10, dtype=torch.long)
for t, p in zip(ys, preds): cm[t, p] += 1
for i, c in enumerate(classes): print(f"{c:10s} {cm[i, i].item() / cm[i].sum().item():.3f}")
plt.figure(figsize=(6, 5)); plt.imshow(cm, cmap="Blues"); plt.xticks(range(10), classes, rotation=60); plt.yticks(range(10), classes); plt.colorbar(); plt.show()

wrong = torch.where(preds != ys)[0]; top = wrong[probs[wrong].argsort(descending=True)[:16]]
fig, axs = plt.subplots(2, 8, figsize=(16, 4.5))
for a, i in zip(axs.ravel(), top):
    img = xs[i].permute(1, 2, 0) * torch.tensor(std) + torch.tensor(mean)
    a.imshow(img.clamp(0, 1)); a.set_title(f"{classes[ys[i]]}->{classes[preds[i]]}\\n{probs[i]:.2f}", fontsize=8); a.axis("off")
plt.suptitle("most confident mistakes"); plt.show()
'''),
    md("## 5. 보너스: 사전학습 모델 미세조정 (96%+)\nImageNet 사전학습 ResNet-50을 128×128로 키운 이미지에 미세조정합니다. T4에서 약 25분."),
    code('''
from torchvision import models
up_tr = transforms.Compose([transforms.Resize(128), transforms.RandomCrop(128, padding=8), transforms.RandomHorizontalFlip(),
                            transforms.ToTensor(), transforms.Normalize((0.485, 0.456, 0.406), (0.229, 0.224, 0.225))])
up_te = transforms.Compose([transforms.Resize(128), transforms.ToTensor(), transforms.Normalize((0.485, 0.456, 0.406), (0.229, 0.224, 0.225))])
tr_b = DataLoader(torch.utils.data.Subset(datasets.CIFAR10("data", True, transform=up_tr), idx[:45000]), 128, shuffle=True, num_workers=2, drop_last=True)
va_b = DataLoader(torch.utils.data.Subset(datasets.CIFAR10("data", True, transform=up_te), idx[45000:]), 500, num_workers=2)
pt = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2); pt.fc = nn.Linear(2048, 10); pt = pt.to(device)
hist_pt = fit(pt, tr_b, va_b, epochs=5, lr=3e-4, wd=0.05, ckpt="pt_best.pt")
'''),
    md("## 과제\n- 결과 표(베이스라인 / ResNet18 / 미세조정)를 학습 노트에 기록하세요.\n- 가장 많이 헷갈린 클래스 쌍은 무엇이고, 왜 그럴까요?"),
]

GPT_CODE = '''
import math, time, torch, torch.nn as nn, torch.nn.functional as F
from dataclasses import dataclass
device = "cuda" if torch.cuda.is_available() else "cpu"; torch.manual_seed(1337)

@dataclass
class GPTConfig:
    vocab_size: int = 65
    block_size: int = 256
    n_layer: int = 6
    n_head: int = 6
    d_model: int = 384
    dropout: float = 0.2

class CausalSelfAttention(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.n_head = cfg.n_head; self.p = cfg.dropout
        self.qkv = nn.Linear(cfg.d_model, 3 * cfg.d_model); self.proj = nn.Linear(cfg.d_model, cfg.d_model)
        self.drop = nn.Dropout(cfg.dropout)
        self.save_attn = False; self.attn = None
    def forward(self, x):
        B, T, D = x.shape
        q, k, v = self.qkv(x).split(D, dim=2)
        q, k, v = [t.view(B, T, self.n_head, D // self.n_head).transpose(1, 2) for t in (q, k, v)]
        if self.save_attn:                      # 시각화용: 어텐션 가중치를 직접 계산해 저장
            att = (q @ k.transpose(-2, -1)) / math.sqrt(q.size(-1))
            att = att.masked_fill(torch.triu(torch.ones(T, T, dtype=torch.bool, device=x.device), 1), float("-inf"))
            self.attn = att.softmax(-1).detach().cpu()
        y = F.scaled_dot_product_attention(q, k, v, is_causal=True, dropout_p=self.p if self.training else 0.0)
        y = y.transpose(1, 2).contiguous().view(B, T, D)
        return self.drop(self.proj(y))

class MLP(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(cfg.d_model, 4 * cfg.d_model), nn.GELU(), nn.Linear(4 * cfg.d_model, cfg.d_model), nn.Dropout(cfg.dropout))
    def forward(self, x): return self.net(x)

class Block(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.ln1, self.ln2 = nn.LayerNorm(cfg.d_model), nn.LayerNorm(cfg.d_model)
        self.attn, self.mlp = CausalSelfAttention(cfg), MLP(cfg)
    def forward(self, x):
        x = x + self.attn(self.ln1(x))
        return x + self.mlp(self.ln2(x))

class GPT(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.cfg = cfg
        self.tok_emb = nn.Embedding(cfg.vocab_size, cfg.d_model); self.pos_emb = nn.Embedding(cfg.block_size, cfg.d_model)
        self.drop = nn.Dropout(cfg.dropout)
        self.blocks = nn.Sequential(*[Block(cfg) for _ in range(cfg.n_layer)])
        self.ln_f = nn.LayerNorm(cfg.d_model)
        self.head = nn.Linear(cfg.d_model, cfg.vocab_size, bias=False)
        self.head.weight = self.tok_emb.weight
        self.apply(self._init)
    def _init(self, m):
        if isinstance(m, (nn.Linear, nn.Embedding)): nn.init.normal_(m.weight, 0.0, 0.02)
        if isinstance(m, nn.Linear) and m.bias is not None: nn.init.zeros_(m.bias)
    def forward(self, idx, targets=None):
        B, T = idx.shape
        x = self.drop(self.tok_emb(idx) + self.pos_emb(torch.arange(T, device=idx.device)))
        logits = self.head(self.ln_f(self.blocks(x)))
        loss = None if targets is None else F.cross_entropy(logits.view(-1, logits.size(-1)), targets.view(-1))
        return logits, loss
'''

day24 = [
    header("Day 24", "미니 GPT 밑바닥 구현",
           ["셰익스피어 텍스트로 1천만 파라미터 문자 단위 GPT를 학습한다 (T4에서 약 10~15분)",
            "탐욕 / 온도 / top-k / top-p 생성 전략을 비교한다", "학습된 어텐션 헤드가 무엇을 보는지 시각화한다"]),
    md("## 1. 데이터"),
    code('''
import urllib.request, torch
url = "https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt"
text = urllib.request.urlopen(url).read().decode("utf-8")
chars = sorted(set(text)); V = len(chars)
stoi = {c: i for i, c in enumerate(chars)}; itos = {i: c for c, i in stoi.items()}
encode = lambda s: [stoi[c] for c in s]; decode = lambda ids: "".join(itos[i] for i in ids)
data = torch.tensor(encode(text), dtype=torch.long); n = int(0.9 * len(data))
train_data, val_data = data[:n], data[n:]
print(len(text), "chars, vocab", V)
'''),
    md("## 2. 모델 (강의 본문 코드와 동일 + 어텐션 저장 옵션)"),
    code(GPT_CODE),
    code('''
cfg = GPTConfig(vocab_size=V)
model = GPT(cfg).to(device)
print(f"{sum(p.numel() for p in model.parameters())/1e6:.2f}M parameters")
def get_batch(split, B=64):
    d = train_data if split == "train" else val_data
    ix = torch.randint(len(d) - cfg.block_size - 1, (B,))
    x = torch.stack([d[i:i+cfg.block_size] for i in ix]); y = torch.stack([d[i+1:i+cfg.block_size+1] for i in ix])
    return x.to(device), y.to(device)
x, y = get_batch("train"); print("initial loss:", model(x, y)[1].item(), " expected ~", round(math.log(V), 3))
'''),
    md("## 3. 학습"),
    code('''
opt = torch.optim.AdamW(model.parameters(), lr=3e-4, betas=(0.9, 0.95), weight_decay=0.1)
max_iters, warmup, lr_max, lr_min = 5000, 200, 1e-3, 1e-4
def lr_at(it):
    if it < warmup: return lr_max * (it + 1) / warmup
    r = (it - warmup) / (max_iters - warmup); return lr_min + 0.5 * (lr_max - lr_min) * (1 + math.cos(math.pi * r))
@torch.no_grad()
def estimate_loss(iters=40):
    model.eval(); out = {}
    for s in ("train", "val"): out[s] = torch.stack([model(*get_batch(s))[1] for _ in range(iters)]).mean().item()
    model.train(); return out
amp_dtype = torch.bfloat16 if torch.cuda.is_available() and torch.cuda.is_bf16_supported() else torch.float16
scaler = torch.amp.GradScaler("cuda", enabled=(amp_dtype == torch.float16))
t0 = time.time()
for it in range(max_iters + 1):
    for g in opt.param_groups: g["lr"] = lr_at(it)
    x, y = get_batch("train")
    with torch.autocast(device_type="cuda", dtype=amp_dtype):
        _, loss = model(x, y)
    opt.zero_grad(set_to_none=True)
    scaler.scale(loss).backward(); scaler.unscale_(opt)
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    scaler.step(opt); scaler.update()
    if it % 500 == 0:
        l = estimate_loss(); print(f"iter {it:5d}  train {l['train']:.3f}  val {l['val']:.3f}  ({time.time()-t0:.0f}s)")
'''),
    md("## 4. 생성 전략 비교"),
    code('''
@torch.no_grad()
def generate(idx, max_new_tokens, temperature=1.0, top_k=None, top_p=None, greedy=False):
    model.eval()
    for _ in range(max_new_tokens):
        logits, _ = model(idx[:, -cfg.block_size:])
        logits = logits[:, -1, :]
        if greedy:
            nxt = logits.argmax(-1, keepdim=True)
        else:
            logits = logits / temperature
            if top_k is not None:
                v, _ = torch.topk(logits, top_k); logits[logits < v[:, [-1]]] = -float("inf")
            probs = F.softmax(logits, -1)
            if top_p is not None:
                sp, si = torch.sort(probs, descending=True); cum = sp.cumsum(-1)
                sp[cum - sp > top_p] = 0; probs = torch.zeros_like(probs).scatter(-1, si, sp); probs /= probs.sum(-1, keepdim=True)
            nxt = torch.multinomial(probs, 1)
        idx = torch.cat([idx, nxt], 1)
    model.train(); return decode(idx[0].tolist())

start = torch.tensor([encode("ROMEO:\\n")], device=device)
for name, kw in [("greedy", dict(greedy=True)), ("temp 0.5", dict(temperature=0.5)), ("temp 1.0 + top-k 40", dict(temperature=1.0, top_k=40)), ("temp 1.0 + top-p 0.9", dict(temperature=1.0, top_p=0.9))]:
    print(f"\\n========== {name} =========="); print(generate(start, 300, **kw))
'''),
    md("## 5. 어텐션 시각화\n마지막 층의 각 헤드가 어디를 보는지 히트맵으로 그립니다. 바로 앞 글자를 보는 헤드, 단어 시작이나 줄바꿈을 보는 헤드 등이 있는지 찾아보세요."),
    code('''
import matplotlib.pyplot as plt
s = "ROMEO:\\nBut soft, what light through yonder window breaks?"
ids = torch.tensor([encode(s)], device=device)
layer = model.blocks[-1].attn; layer.save_attn = True
model.eval(); model(ids); layer.save_attn = False; model.train()
A = layer.attn[0]                                   # (heads, T, T)
fig, axs = plt.subplots(2, 3, figsize=(15, 9))
for h, ax in enumerate(axs.ravel()):
    ax.imshow(A[h], cmap="viridis"); ax.set_title(f"head {h}")
    ax.set_xticks(range(len(s))); ax.set_xticklabels(list(s.replace("\\n", "⏎")), fontsize=6)
    ax.set_yticks(range(len(s))); ax.set_yticklabels(list(s.replace("\\n", "⏎")), fontsize=6)
plt.tight_layout(); plt.show()
'''),
    md("## 과제\n- 검증 손실 1.6 이하를 달성했나요?\n- `n_layer=2`로 다시 학습해 생성 품질을 비교하세요.\n- 생성 전략별 결과를 학습 노트에 붙이세요."),
]

day26 = [
    header("Day 26", "VAE로 손글씨 숫자 생성하기",
           ["MNIST VAE를 학습해 재구성·무작위 생성·잠재 공간 보간을 시각화한다",
            "잠재 차원 2짜리 VAE로 '숫자 지도'를 그린다", "β 값에 따른 변화를 비교한다"]),
    code('''
import torch, torch.nn as nn, torch.nn.functional as F, numpy as np, matplotlib.pyplot as plt
from torchvision import datasets, transforms
from torch.utils.data import DataLoader
device = "cuda" if torch.cuda.is_available() else "cpu"; torch.manual_seed(0)
train_ds = datasets.MNIST("data", train=True, download=True, transform=transforms.ToTensor())
test_ds = datasets.MNIST("data", train=False, download=True, transform=transforms.ToTensor())
train_dl = DataLoader(train_ds, 128, shuffle=True, num_workers=2); test_dl = DataLoader(test_ds, 256)

class VAE(nn.Module):
    def __init__(self, d_z=16, d_h=512):
        super().__init__()
        self.enc = nn.Sequential(nn.Flatten(), nn.Linear(784, d_h), nn.ReLU(), nn.Linear(d_h, d_h // 2), nn.ReLU())
        self.mu, self.logvar = nn.Linear(d_h // 2, d_z), nn.Linear(d_h // 2, d_z)
        self.dec = nn.Sequential(nn.Linear(d_z, d_h // 2), nn.ReLU(), nn.Linear(d_h // 2, d_h), nn.ReLU(), nn.Linear(d_h, 784))
    def encode(self, x): h = self.enc(x); return self.mu(h), self.logvar(h)
    def forward(self, x):
        mu, logvar = self.encode(x)
        z = mu + torch.exp(0.5 * logvar) * torch.randn_like(mu)        # 재매개변수화
        return self.dec(z), mu, logvar

def vae_loss(x, logits, mu, logvar, beta=1.0):
    recon = F.binary_cross_entropy_with_logits(logits, x.flatten(1), reduction="sum") / x.size(0)
    kl = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp()) / x.size(0)
    return recon + beta * kl, recon, kl

def train_vae(d_z=16, beta=1.0, epochs=15):
    m = VAE(d_z).to(device); opt = torch.optim.Adam(m.parameters(), 1e-3)
    for ep in range(epochs):
        tot = rc = klt = 0
        for x, _ in train_dl:
            x = x.to(device); logits, mu, lv = m(x); loss, r, k = vae_loss(x, logits, mu, lv, beta)
            opt.zero_grad(); loss.backward(); opt.step(); tot += loss.item(); rc += r.item(); klt += k.item()
        n = len(train_dl); print(f"[d_z={d_z} β={beta}] epoch {ep+1}: loss {tot/n:.1f}  recon {rc/n:.1f}  KL {klt/n:.1f}")
    return m
model = train_vae()
'''),
    md("## 1. 재구성과 무작위 생성"),
    code('''
model.eval()
x, y = next(iter(test_dl)); x = x[:10].to(device)
with torch.no_grad():
    rec = torch.sigmoid(model(x)[0]).view(-1, 28, 28).cpu()
    samples = torch.sigmoid(model.dec(torch.randn(30, 16, device=device))).view(-1, 28, 28).cpu()
fig, axs = plt.subplots(2, 10, figsize=(12, 2.6))
for i in range(10):
    axs[0, i].imshow(x[i, 0].cpu(), cmap="gray"); axs[1, i].imshow(rec[i], cmap="gray"); axs[0, i].axis("off"); axs[1, i].axis("off")
axs[0, 0].set_title("input", fontsize=9, loc="left"); axs[1, 0].set_title("reconstruction", fontsize=9, loc="left"); plt.show()
fig, axs = plt.subplots(3, 10, figsize=(12, 3.8))
for a, s in zip(axs.ravel(), samples): a.imshow(s, cmap="gray"); a.axis("off")
plt.suptitle("samples from z ~ N(0, I)"); plt.show()
'''),
    md("## 2. 잠재 공간 보간\n두 숫자의 잠재 벡터 사이를 직선으로 이동하며 디코딩합니다. 중간 이미지가 그럴듯하게 이어진다면 잠재 공간이 매끄럽다는 뜻입니다."),
    code('''
xs, ys = next(iter(test_dl))
a = xs[(ys == 1).nonzero()[0]].to(device); b = xs[(ys == 7).nonzero()[0]].to(device)
with torch.no_grad():
    za, zb = model.encode(a)[0], model.encode(b)[0]
    frames = [torch.sigmoid(model.dec((1 - t) * za + t * zb)).view(28, 28).cpu() for t in torch.linspace(0, 1, 10)]
fig, axs = plt.subplots(1, 10, figsize=(12, 1.6))
for ax, f in zip(axs, frames): ax.imshow(f, cmap="gray"); ax.axis("off")
plt.show()
'''),
    md("## 3. 2차원 잠재 공간: 숫자 지도"),
    code('''
m2 = train_vae(d_z=2, epochs=15); m2.eval()
grid = torch.linspace(-2.5, 2.5, 15)
canvas = np.zeros((15 * 28, 15 * 28))
with torch.no_grad():
    for i, yv in enumerate(grid.flip(0)):
        for j, xv in enumerate(grid):
            img = torch.sigmoid(m2.dec(torch.tensor([[xv, yv]], device=device))).view(28, 28).cpu().numpy()
            canvas[i*28:(i+1)*28, j*28:(j+1)*28] = img
plt.figure(figsize=(8, 8)); plt.imshow(canvas, cmap="gray"); plt.axis("off"); plt.title("decoded 2D latent grid"); plt.show()
zs, ls = [], []
with torch.no_grad():
    for x, y in test_dl: zs.append(m2.encode(x.to(device))[0].cpu()); ls.append(y)
zs, ls = torch.cat(zs), torch.cat(ls)
plt.figure(figsize=(7, 6)); plt.scatter(zs[:, 0], zs[:, 1], c=ls, cmap="tab10", s=2); plt.colorbar(); plt.title("test set in latent space"); plt.show()
'''),
    md("## 4. β 비교"),
    code('''
for beta in [0.0, 4.0]:
    mb = train_vae(beta=beta, epochs=8); mb.eval()
    with torch.no_grad(): s = torch.sigmoid(mb.dec(torch.randn(10, 16, device=device))).view(-1, 28, 28).cpu()
    fig, axs = plt.subplots(1, 10, figsize=(12, 1.6))
    for a, im in zip(axs, s): a.imshow(im, cmap="gray"); a.axis("off")
    plt.suptitle(f"beta = {beta}"); plt.show()
'''),
    md("## 과제\n- β=0(사실상 오토인코더)에서 무작위 생성 결과가 왜 이상한지 강의 내용으로 설명해 보세요.\n- β=4에서 재구성 품질과 생성 다양성은 어떻게 바뀌었나요?"),
]

day27 = [
    header("Day 27", "확산 모델(DDPM)로 손글씨 숫자 생성하기",
           ["작은 U-Net 노이즈 예측기를 MNIST로 학습한다 (T4에서 약 15분)",
            "노이즈에서 숫자가 나타나는 역방향 과정을 시각화한다",
            "클래스 조건 + classifier-free guidance로 원하는 숫자를 생성한다"]),
    code('''
import math, torch, torch.nn as nn, torch.nn.functional as F, matplotlib.pyplot as plt
from torchvision import datasets, transforms
from torch.utils.data import DataLoader
device = "cuda" if torch.cuda.is_available() else "cpu"; torch.manual_seed(0)
tf = transforms.Compose([transforms.ToTensor(), transforms.Lambda(lambda x: x * 2 - 1)])   # [-1, 1]
dl = DataLoader(datasets.MNIST("data", train=True, download=True, transform=tf), 128, shuffle=True, num_workers=2, drop_last=True)

T = 400
betas = torch.linspace(1e-4, 0.02 * 1000 / T, T, device=device)
alphas = 1 - betas; abar = torch.cumprod(alphas, 0)
def q_sample(x0, t, eps): return abar[t].sqrt().view(-1, 1, 1, 1) * x0 + (1 - abar[t]).sqrt().view(-1, 1, 1, 1) * eps

x0, _ = next(iter(dl)); x0 = x0[:1].to(device)
fig, axs = plt.subplots(1, 8, figsize=(12, 1.8))
for a, t in zip(axs, [0, 20, 50, 100, 150, 200, 300, 399]):
    a.imshow(q_sample(x0, torch.tensor([t], device=device), torch.randn_like(x0))[0, 0].cpu(), cmap="gray"); a.set_title(f"t={t}"); a.axis("off")
plt.suptitle("forward process"); plt.show()
'''),
    md("## 1. 작은 U-Net (시점 + 클래스 조건)\n클래스 레이블 10은 '조건 없음'을 뜻합니다 (classifier-free guidance용)."),
    code('''
def t_embedding(t, dim):
    half = dim // 2
    f = torch.exp(-math.log(10000) * torch.arange(half, device=t.device) / half)
    a = t.float()[:, None] * f[None]
    return torch.cat([a.sin(), a.cos()], -1)

class ResBlock(nn.Module):
    def __init__(self, c_in, c_out, d_emb):
        super().__init__()
        self.n1 = nn.GroupNorm(8, c_in); self.c1 = nn.Conv2d(c_in, c_out, 3, padding=1)
        self.emb = nn.Linear(d_emb, c_out)
        self.n2 = nn.GroupNorm(8, c_out); self.c2 = nn.Conv2d(c_out, c_out, 3, padding=1)
        self.skip = nn.Conv2d(c_in, c_out, 1) if c_in != c_out else nn.Identity()
    def forward(self, x, e):
        h = self.c1(F.silu(self.n1(x))) + self.emb(e)[:, :, None, None]
        h = self.c2(F.silu(self.n2(h)))
        return h + self.skip(x)

class UNet(nn.Module):
    def __init__(self, ch=64, d_emb=128, n_classes=10):
        super().__init__()
        self.d_emb = d_emb
        self.t_mlp = nn.Sequential(nn.Linear(d_emb, d_emb), nn.SiLU(), nn.Linear(d_emb, d_emb))
        self.cls = nn.Embedding(n_classes + 1, d_emb)                     # +1: 조건 없음
        self.inp = nn.Conv2d(1, ch, 3, padding=1)
        self.d1 = ResBlock(ch, ch, d_emb); self.down1 = nn.Conv2d(ch, ch, 4, 2, 1)            # 28 → 14
        self.d2 = ResBlock(ch, 2 * ch, d_emb); self.down2 = nn.Conv2d(2 * ch, 2 * ch, 4, 2, 1)  # 14 → 7
        self.mid = ResBlock(2 * ch, 2 * ch, d_emb)
        self.up2 = nn.ConvTranspose2d(2 * ch, 2 * ch, 4, 2, 1); self.u2 = ResBlock(4 * ch, ch, d_emb)   # 7 → 14
        self.up1 = nn.ConvTranspose2d(ch, ch, 4, 2, 1); self.u1 = ResBlock(2 * ch, ch, d_emb)            # 14 → 28
        self.out = nn.Sequential(nn.GroupNorm(8, ch), nn.SiLU(), nn.Conv2d(ch, 1, 3, padding=1))
    def forward(self, x, t, y):
        e = self.t_mlp(t_embedding(t, self.d_emb)) + self.cls(y)
        h0 = self.inp(x)
        h1 = self.d1(h0, e)
        h2 = self.d2(self.down1(h1), e)
        m = self.mid(self.down2(h2), e)
        u = self.u2(torch.cat([self.up2(m), h2], 1), e)                # 스킵 연결
        u = self.u1(torch.cat([self.up1(u), h1], 1), e)
        return self.out(u)

net = UNet().to(device)
print(f"{sum(p.numel() for p in net.parameters())/1e6:.2f}M params", net(torch.randn(2, 1, 28, 28, device=device), torch.tensor([1, 2], device=device), torch.tensor([3, 10], device=device)).shape)
'''),
    md("## 2. 학습: 노이즈 예측 MSE\n10% 확률로 레이블을 '조건 없음(10)'으로 바꿔 무조건부 예측도 함께 학습합니다."),
    code('''
opt = torch.optim.AdamW(net.parameters(), lr=2e-4)
ema = torch.optim.swa_utils.AveragedModel(net, multi_avg_fn=torch.optim.swa_utils.get_ema_multi_avg_fn(0.999))   # 가중치 EMA (Day 12)
for epoch in range(15):
    for i, (x, y) in enumerate(dl):
        x, y = x.to(device), y.to(device)
        y = torch.where(torch.rand_like(y, dtype=torch.float) < 0.1, torch.full_like(y, 10), y)
        t = torch.randint(0, T, (x.size(0),), device=device); eps = torch.randn_like(x)
        loss = F.mse_loss(net(q_sample(x, t, eps), t, y), eps)
        opt.zero_grad(); loss.backward(); torch.nn.utils.clip_grad_norm_(net.parameters(), 1.0); opt.step(); ema.update_parameters(net)
    print(f"epoch {epoch+1}  loss {loss.item():.4f}")
'''),
    md("## 3. 샘플링 (+ guidance)"),
    code('''
@torch.no_grad()
def sample(model, labels, w=3.0, snapshots=()):
    model.eval(); n = len(labels); x = torch.randn(n, 1, 28, 28, device=device); snaps = []
    y = torch.tensor(labels, device=device); y_null = torch.full_like(y, 10)
    for t in reversed(range(T)):
        tt = torch.full((n,), t, device=device)
        e_c, e_u = model(x, tt, y), model(x, tt, y_null)
        eps = e_u + w * (e_c - e_u)                               # classifier-free guidance
        x = (x - betas[t] / (1 - abar[t]).sqrt() * eps) / alphas[t].sqrt()
        if t > 0: x = x + betas[t].sqrt() * torch.randn_like(x)
        if t in snapshots: snaps.append(x.clamp(-1, 1).cpu())
    return x.clamp(-1, 1).cpu(), snaps

gen = ema.module
imgs, snaps = sample(gen, list(range(10)) * 2, w=3.0, snapshots=(399, 300, 200, 100, 50, 0))
fig, axs = plt.subplots(len(snaps), 10, figsize=(12, 1.3 * len(snaps)))
for r, s in enumerate(snaps):
    for c in range(10): axs[r, c].imshow(s[c, 0], cmap="gray"); axs[r, c].axis("off")
plt.suptitle("reverse process (rows: t = 399 → 0)"); plt.show()
'''),
    code('''
for w in [0.0, 2.0, 5.0]:
    imgs, _ = sample(gen, [7] * 10, w=w)
    fig, axs = plt.subplots(1, 10, figsize=(12, 1.5))
    for a, im in zip(axs, imgs): a.imshow(im[0], cmap="gray"); a.axis("off")
    plt.suptitle(f"label 7, guidance w = {w}"); plt.show()
'''),
    md("## 과제\n- guidance w가 커질수록 '7다움'과 다양성이 어떻게 변하나요?\n- `T=100`으로 줄여 다시 학습하면 품질과 속도는?"),
]

capstone = [
    md("""# 🎓 캡스톤 프로젝트 템플릿

**30일 딥러닝 완전 정복 · Day 29–30**

이 노트북은 빈칸을 채워 가며 프로젝트를 진행하는 틀입니다. `TODO`라고 적힌 곳을 여러분의 문제에 맞게 고치세요.
강의 Day 29의 체크리스트와 Day 28의 디버깅 레시피를 옆에 띄워 두세요.

> ⚙️ 런타임 → 런타임 유형 변경 → T4 GPU"""),
    md("""## 0. 문제 정의서 (여기에 직접 작성)
1. **한 문장 목표**: TODO
2. **입력**: TODO (형식, 텐서 형상)
3. **출력 / 출력층 / 손실 함수**: TODO
4. **평가 지표와 이유**: TODO
5. **성공 기준**: TODO
6. **분할 계획**: TODO
7. **예상되는 어려움**: TODO"""),
    md("## 1. 공통 템플릿 (Day 16)"),
    code(TEMPLATE_FUNCS),
    md("## 2. 데이터\n아래는 이미지 폴더(`root/클래스명/*.jpg`) 예시입니다. 다른 유형이면 Day 16의 `Dataset` 예시를 참고해 바꾸세요."),
    code('''
from google.colab import drive
drive.mount("/content/drive")
DATA_ROOT = "/content/drive/MyDrive/capstone_data"      # TODO: 데이터 경로
IMG = 224                                               # TODO: 입력 크기
mean, std = (0.485, 0.456, 0.406), (0.229, 0.224, 0.225)
train_tf = transforms.Compose([transforms.RandomResizedCrop(IMG, scale=(0.6, 1)), transforms.RandomHorizontalFlip(),   # TODO: 도메인에 맞는 증강인가?
                               transforms.ToTensor(), transforms.Normalize(mean, std)])
eval_tf = transforms.Compose([transforms.Resize(int(IMG * 1.14)), transforms.CenterCrop(IMG), transforms.ToTensor(), transforms.Normalize(mean, std)])

full_tr = datasets.ImageFolder(DATA_ROOT, transform=train_tf)
full_ev = datasets.ImageFolder(DATA_ROOT, transform=eval_tf)
classes = full_tr.classes; N = len(full_tr)
g = torch.Generator().manual_seed(0); perm = torch.randperm(N, generator=g)
n_te, n_va = int(0.15 * N), int(0.15 * N)
te_idx, va_idx, tr_idx = perm[:n_te], perm[n_te:n_te + n_va], perm[n_te + n_va:]   # 테스트는 마지막까지 봉인!
train_dl = DataLoader(torch.utils.data.Subset(full_tr, tr_idx), 32, shuffle=True, num_workers=2, drop_last=True)
val_dl = DataLoader(torch.utils.data.Subset(full_ev, va_idx), 64, num_workers=2)
test_dl = DataLoader(torch.utils.data.Subset(full_ev, te_idx), 64, num_workers=2)
print(classes, len(tr_idx), len(va_idx), len(te_idx))
'''),
    md("## 3. 데이터 점검 (Day 28 레시피 1단계)"),
    code('''
import matplotlib.pyplot as plt
xb, yb = next(iter(train_dl))
print("x:", xb.shape, xb.dtype, f"min {xb.min():.2f} max {xb.max():.2f}"); print("y:", yb[:16].tolist())
print("class counts:", torch.bincount(torch.tensor([full_tr.targets[i] for i in tr_idx])).tolist())
fig, axs = plt.subplots(2, 8, figsize=(16, 4.5))
for a, x, y in zip(axs.ravel(), xb, yb):
    a.imshow((x.permute(1, 2, 0) * torch.tensor(std) + torch.tensor(mean)).clamp(0, 1)); a.set_title(classes[y], fontsize=8); a.axis("off")
plt.show()
'''),
    md("## 4. 베이스라인 사다리"),
    code('''
results = {}
# (1) 바보 베이스라인: 최빈 클래스
counts = torch.bincount(torch.tensor([full_tr.targets[i] for i in tr_idx]))
majority = counts.argmax().item()
val_targets = torch.tensor([full_tr.targets[i] for i in va_idx])
results["majority"] = (val_targets == majority).float().mean().item()
print(results)
'''),
    code('''
# (2) 사전학습 특징 추출 (Day 19)
from torchvision import models
def make_model(freeze=True):
    m = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)      # TODO: 다른 백본?
    if freeze:
        for p in m.parameters(): p.requires_grad = False
    m.fc = nn.Sequential(nn.Dropout(0.2), nn.Linear(m.fc.in_features, len(classes)))
    return m.to(device)
seed_everything(0)
model = make_model()
# 배치 하나 과적합 테스트
xb, yb = next(iter(train_dl)); xb, yb = xb[:16].to(device), yb[:16].to(device)
o = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], 1e-2)
for i in range(100): l = F.cross_entropy(model(xb), yb); o.zero_grad(); l.backward(); o.step()
print("single-batch loss:", l.item())
'''),
    code('''
seed_everything(0)
model = make_model(freeze=True)
hist = fit(model, train_dl, val_dl, epochs=10, lr=3e-3, ckpt="cap_fe.pt")
plot_hist(hist, "feature extraction"); results["feature_extraction"] = max(hist["va_acc"]); print(results)
'''),
    md("## 5. 실험 기록표\n| # | 가설 | 변경 | val 지표 | 결론 |\n|---|---|---|---|---|\n| 0 | 베이스라인 |  |  |  |\n| 1 | TODO |  |  |  |"),
    code('''
# (3) 미세조정 실험 (Day 19)  — TODO: 여러분의 실험을 여기에 하나씩 추가
for p in model.layer4.parameters(): p.requires_grad = True
opt = torch.optim.AdamW([{"params": model.layer4.parameters(), "lr": 1e-4}, {"params": model.fc.parameters(), "lr": 1e-3}], weight_decay=0.01)
best = 0
for ep in range(8):
    tl, ta = train_one_epoch(model, train_dl, nn.CrossEntropyLoss(label_smoothing=0.1), opt)
    vl, va = evaluate(model, val_dl, nn.CrossEntropyLoss())
    print(f"[{ep+1}] train {tl:.3f}/{ta:.3f}  val {vl:.3f}/{va:.3f}")
    if va > best: best = va; torch.save(model.state_dict(), "cap_ft.pt")
results["fine_tune"] = best; model.load_state_dict(torch.load("cap_ft.pt")); print(results)
'''),
    md("## 6. 최종 평가 (테스트 세트 — 단 한 번!)"),
    code('''
test_loss, test_acc = evaluate(model, test_dl, nn.CrossEntropyLoss())
print(f"TEST accuracy {test_acc:.4f}")
model.eval(); P, Y, X = [], [], []
with torch.no_grad():
    for xb, yb in test_dl: P.append(F.softmax(model(xb.to(device)), -1).cpu()); Y.append(yb); X.append(xb)
P, Y, X = torch.cat(P), torch.cat(Y), torch.cat(X); pred = P.argmax(1)
K = len(classes); cm = torch.zeros(K, K, dtype=torch.long)
for t, p in zip(Y, pred): cm[t, p] += 1
plt.figure(figsize=(6, 5)); plt.imshow(cm, cmap="Blues"); plt.xticks(range(K), classes, rotation=60); plt.yticks(range(K), classes); plt.colorbar(); plt.show()
wrong = torch.where(pred != Y)[0]; top = wrong[P[wrong].max(1).values.argsort(descending=True)[:12]]
fig, axs = plt.subplots(2, 6, figsize=(15, 5.5))
for a, i in zip(axs.ravel(), top):
    a.imshow((X[i].permute(1, 2, 0) * torch.tensor(std) + torch.tensor(mean)).clamp(0, 1))
    a.set_title(f"{classes[Y[i]]} -> {classes[pred[i]]} ({P[i].max():.2f})", fontsize=8); a.axis("off")
plt.suptitle("most confident mistakes"); plt.show()
'''),
    md("## 7. 데모 앱 (선택)"),
    code('''
!pip -q install gradio
import gradio as gr
def predict(img):
    x = eval_tf(img).unsqueeze(0).to(device)
    with torch.no_grad(): p = F.softmax(model.eval()(x), -1)[0]
    return {c: float(p[i]) for i, c in enumerate(classes)}
gr.Interface(fn=predict, inputs=gr.Image(type="pil"), outputs=gr.Label(num_top_classes=3)).launch(share=True)
'''),
    md("""## 8. 보고서 (README) 초안
1. **문제**:
2. **데이터**:
3. **방법**:
4. **결과** (베이스라인 사다리 표 + 테스트 점수):
5. **분석** (오류 사례와 원인):
6. **한계와 다음 단계**:
7. **재현 방법**:

수고 많았습니다. 🎉"""),
]

NOTEBOOKS = {
    "day20_rnn.ipynb": (True, day20),
    "week3_cnn_project.ipynb": (True, week3),
    "day24_mini_gpt.ipynb": (True, day24),
    "day26_vae.ipynb": (True, day26),
    "day27_diffusion.ipynb": (True, day27),
    "capstone_template.ipynb": (True, capstone),
}
