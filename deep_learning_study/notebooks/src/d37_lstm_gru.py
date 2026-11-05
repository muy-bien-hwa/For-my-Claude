# %% [markdown]
# # 37일차: LSTM과 GRU
#
# 딥러닝 8주 과정 37일차 실습 노트북이다. PyTorch의 `nn.RNN`, `nn.LSTM`, `nn.GRU`의 입출력 형상을 익히고, LSTM 셀을 직접 구현해 `nn.LSTMCell`과 비교한 뒤, "처음 본 기호 기억하기" 과제로 세 모델의 장기 기억 능력을 비교한다.
#
# - **런타임**: CPU로 충분하다(GPU면 더 빠르다). 전체 실행에 CPU에서 10분 안팎 걸린다.
# - **그래프**: Colab에는 한글 글꼴이 없어 그래프의 축 이름과 범례는 영어로 쓴다.

# %%
import time

import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("PyTorch", torch.__version__, " 장치:", device)

# %% [markdown]
# ## 1. 입출력 형상
#
# `batch_first=True`이면 입력은 (배치, 길이, 입력 차원)이다. 출력은 두 가지다.
#
# - `out`: 모든 시점의 마지막 층 은닉 상태 (배치, 길이, 은닉 × 방향 수)
# - `h_n`: 마지막 시점의 모든 층 은닉 상태 (층 수 × 방향 수, 배치, 은닉). LSTM은 셀 상태 `c_n`도 함께 돌려준다.

# %%
x = torch.randn(4, 7, 10)                                  # 배치 4, 길이 7, 입력 10
for name, cls in [("RNN", nn.RNN), ("GRU", nn.GRU), ("LSTM", nn.LSTM)]:
    m = cls(10, 16, batch_first=True)
    out, state = m(x)
    shapes = [tuple(s.shape) for s in state] if isinstance(state, tuple) else tuple(state.shape)
    print(f"{name:4s} 파라미터 {sum(p.numel() for p in m.parameters()):5d}  out {tuple(out.shape)}  상태 {shapes}")

lstm2 = nn.LSTM(10, 16, num_layers=2, bidirectional=True, batch_first=True)
out, (h_n, c_n) = lstm2(x)
print("2층 양방향 LSTM: out", tuple(out.shape), " h_n", tuple(h_n.shape))
print("마지막 층의 정방향 마지막 시점 = out[:, -1, :16]:", torch.allclose(h_n[-2], out[:, -1, :16]))
print("마지막 층의 역방향 마지막 시점 = out[:, 0, 16:]:", torch.allclose(h_n[-1], out[:, 0, 16:]))

# %% [markdown]
# RNN 셀의 파라미터는 $W_x$(10×16), $W_h$(16×16), 편향이다. PyTorch는 편향을 두 벌(`bias_ih`, `bias_hh`) 둔다. LSTM은 게이트 4개, GRU는 3개분의 가중치를 가지므로 파라미터가 RNN의 4배, 3배다.
#
# ## 2. LSTM 셀을 직접 구현
#
# $$\begin{aligned} i_t &= \sigma(x_tW_{xi} + h_{t-1}W_{hi} + b_i) &&\text{입력 게이트}\\ f_t &= \sigma(x_tW_{xf} + h_{t-1}W_{hf} + b_f) &&\text{망각 게이트}\\ g_t &= \tanh(x_tW_{xg} + h_{t-1}W_{hg} + b_g) &&\text{후보 값}\\ o_t &= \sigma(x_tW_{xo} + h_{t-1}W_{ho} + b_o) &&\text{출력 게이트}\\ c_t &= f_t \odot c_{t-1} + i_t \odot g_t\\ h_t &= o_t \odot \tanh(c_t) \end{aligned}$$
#
# PyTorch는 네 게이트의 가중치를 (i, f, g, o) 순서로 한 행렬에 이어 붙여 저장한다.

# %%
def lstm_cell(x, h, c, W_ih, W_hh, b_ih, b_hh):
    z = x @ W_ih.T + b_ih + h @ W_hh.T + b_hh                # (B, 4H)
    i, f, g, o = z.chunk(4, dim=1)
    i, f, g, o = torch.sigmoid(i), torch.sigmoid(f), torch.tanh(g), torch.sigmoid(o)
    c = f * c + i * g                                         # 셀 상태: 곱이 아니라 더하기로 갱신
    h = o * torch.tanh(c)
    return h, c


torch.manual_seed(0)
cell = nn.LSTMCell(10, 16)
x1, h0, c0 = torch.randn(4, 10), torch.randn(4, 16), torch.randn(4, 16)
h_ref, c_ref = cell(x1, (h0, c0))
h_me, c_me = lstm_cell(x1, h0, c0, cell.weight_ih, cell.weight_hh, cell.bias_ih, cell.bias_hh)
print("직접 구현과 nn.LSTMCell의 최대 차이: h", (h_me - h_ref).abs().max().item(),
      " c", (c_me - c_ref).abs().max().item())

# %% [markdown]
# ## 3. 장기 기억 과제: 처음 본 기호 맞히기
#
# 기호 8개 중 하나씩 무작위로 뽑은 길이 $T$의 시퀀스를 읽고, 마지막에 **첫 번째 기호**가 무엇이었는지 맞힌다. 첫 기호 뒤의 $T-1$개는 정답과 무관한 방해물이다. 찍으면 정확도 12.5%다. 길이를 10, 30, 100으로 늘리며 RNN, GRU, LSTM을 비교한다.

# %%
N_SYM = 8


def make_batch(B, T, gen):
    x = torch.randint(0, N_SYM, (B, T), generator=gen)
    return F.one_hot(x, N_SYM).float(), x[:, 0]


class Recaller(nn.Module):
    def __init__(self, kind, hidden=64):
        super().__init__()
        self.rnn = {"RNN": nn.RNN, "GRU": nn.GRU, "LSTM": nn.LSTM}[kind](N_SYM, hidden, batch_first=True)
        self.head = nn.Linear(hidden, N_SYM)

    def forward(self, x):
        out, _ = self.rnn(x)
        return self.head(out[:, -1])                          # 마지막 시점의 은닉 상태로 분류


def run(kind, T, steps=1500, B=64, seed=0):
    torch.manual_seed(seed)
    gen = torch.Generator().manual_seed(seed)
    model = Recaller(kind).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=3e-3)
    curve = []
    for step in range(1, steps + 1):
        x, y = make_batch(B, T, gen)
        loss = F.cross_entropy(model(x.to(device)), y.to(device))
        opt.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        if step % 100 == 0:
            with torch.no_grad():
                xt, yt = make_batch(1000, T, torch.Generator().manual_seed(999))
                acc = (model(xt.to(device)).argmax(1).cpu() == yt).float().mean().item()
            curve.append((step, acc))
    return model, np.array(curve)


results = {}
for T in (10, 30, 100):
    for kind in ("RNN", "GRU", "LSTM"):
        t0 = time.perf_counter()
        model, curve = run(kind, T)
        results[(kind, T)] = (model, curve)
        print(f"T = {T:3d}  {kind:4s}  최종 정확도 {curve[-1, 1]:.3f}  "
              f"(90% 첫 도달 스텝 {next((int(s) for s, a in curve if a >= 0.9), '-')})  "
              f"{time.perf_counter() - t0:.0f}초")

# %%
fig, axs = plt.subplots(1, 3, figsize=(13, 3.4), sharey=True)
for ax, T in zip(axs, (10, 30, 100)):
    for kind, c in [("RNN", "tab:red"), ("GRU", "tab:green"), ("LSTM", "tab:blue")]:
        cur = results[(kind, T)][1]
        ax.plot(cur[:, 0], cur[:, 1], color=c, label=kind)
    ax.axhline(1 / N_SYM, color="gray", ls=":")
    ax.set_title(f"T = {T}")
    ax.set_xlabel("step")
    ax.grid(alpha=.3)
axs[0].set_ylabel("accuracy")
axs[0].legend()
plt.tight_layout()
plt.show()

# %% [markdown]
# ## 4. LSTM의 게이트 들여다보기
#
# 길이 100에서 학습한 LSTM에 시퀀스 하나를 넣고, 시점마다 망각 게이트와 셀 상태를 기록한다. 첫 기호를 셀 상태에 담아 두고 100시점 동안 지키는 유닛을 찾는다.

# %%
lstm_model = results[("LSTM", 100)][0].cpu()
W_ih, W_hh = lstm_model.rnn.weight_ih_l0, lstm_model.rnn.weight_hh_l0
b_ih, b_hh = lstm_model.rnn.bias_ih_l0, lstm_model.rnn.bias_hh_l0
x, y = make_batch(8, 100, torch.Generator().manual_seed(5))
H = W_hh.shape[1]
h, c = torch.zeros(8, H), torch.zeros(8, H)
fs, cs = [], []
with torch.no_grad():
    for t in range(100):
        z = x[:, t] @ W_ih.T + b_ih + h @ W_hh.T + b_hh
        i, f, g, o = z.chunk(4, dim=1)
        f = torch.sigmoid(f)
        c = f * c + torch.sigmoid(i) * torch.tanh(g)
        h = torch.sigmoid(o) * torch.tanh(c)
        fs.append(f)
        cs.append(c)
fs, cs = torch.stack(fs, 1), torch.stack(cs, 1)                # (8, 100, H)
f_mean = fs[:, 1:].mean(dim=(0, 1))                           # 유닛별 평균 망각 게이트 (첫 시점 제외)
keep = f_mean.argsort(descending=True)[:5]
print("망각 게이트 평균이 가장 큰 유닛 5개:", keep.tolist(), " 평균값", f_mean[keep].numpy().round(3))
print("전체 유닛의 망각 게이트 평균:", f_mean.mean().item())
fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 3.2))
for u in keep[:3]:
    a1.plot(cs[0, :, u].numpy(), label=f"unit {u.item()}")
    a2.plot(fs[0, :, u].numpy(), label=f"unit {u.item()}")
a1.set_title("cell state (sequence 0)")
a2.set_title("forget gate (sequence 0)")
for a in (a1, a2):
    a.set_xlabel("time step")
    a.legend(fontsize=8)
    a.grid(alpha=.3)
plt.tight_layout()
plt.show()

# %% [markdown]
# ## 5. 연습
#
# 1. 은닉 크기를 16으로 줄이면 길이 100에서 LSTM과 GRU의 학습이 어떻게 달라지는가?
# 2. RNN의 학습률을 1e-3으로 낮추거나 스텝을 3,000으로 늘려도 길이 100을 풀지 못하는지 확인하라.
# 3. 과제를 "첫 기호" 대신 "열 번째 기호"로 바꾸면 RNN의 정확도는 어떻게 되는가? 그 이유는?
