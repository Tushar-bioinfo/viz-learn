#!/usr/bin/env python3
"""Toy data for the MAGeCK RRA deck, worked the way MAGeCK 0.5.9.5 works it.

Two simulated screens share one noise law: variance = mu + K * mu^B (B = 2 would be the negative binomial).
- A full screen of 2,000 guides x 3 control replicates, only for fitting the mean-variance line (MAGeCK fits it
  on every guide; 9 guides are too few for a line).
- A mini screen of 9 guides (3 genes x 3 guides) x 3 control + 3 treated samples, worked step by step in the deck:
  gene A is essential but A3 is a dud guide, gene B's knockout grows faster (enriched), gene C has one weak guide (C1).
  Three guides fall, three rise and three stay put, so each treated sample's median ratio lands mid-pack: on A3
  (unchanged) in trt1 and trt3, on the weak C1 (fold 0.6) in trt2. With most of 9 guides falling, the median would
  be dragged; a real screen's thousands of guides pin it.

Steps follow the MAGeCK code: median-ratio size factors (geometric mean of count + 1), per-guide median and
median-centred variance over the controls, weighted least squares of log2(var - median + 1) on log2(median + 1)
(weights = median, slope >= 1, intercept >= 0), adjusted variance = median^slope * 2^intercept + median, a normal
test cut at zero reads, then alpha-RRA on percentiles. The mini screen's seed is the first one that tells the story:
A1, A2, C1 lead; the three unchanged guides stay above p = 0.25 but point both ways; the B guides come last; every
guide spreads wider than Poisson; the size factors track the depths within 12%.
Writes data.json. Pure Python, no packages needed.
"""
import json, math, random
from itertools import combinations
from pathlib import Path

K, B = 2.5, 1.3                                         # the noise law both screens are drawn from
DEPTH_FULL = [1.0, 1.2, 0.9]
DEPTH_MINI = [1.0, 1.2, 0.9, 0.85, 1.1, 1.0]            # C1 C2 C3 T1 T2 T3
GUIDES = ["A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3"]
LEVEL = [520, 380, 450, 300, 610, 240, 700, 350, 420]   # true control level of each guide
FOLD = [0.22, 0.30, 1.0, 2.0, 2.3, 1.8, 0.6, 1.0, 1.0]  # treated / control


def poisson(lam, rng):
    if lam > 500:  # split big rates into pieces so exp(-lam) does not underflow
        return sum(poisson(lam / 8, rng) for _ in range(8))
    k, p, F, u = 0, math.exp(-lam), math.exp(-lam), rng.random()
    while u > F:
        k += 1
        p *= lam / k
        F += p
    return k


def draw(mu, rng):
    """A count with variance mu + K mu^B: a gamma-distributed true level, then Poisson counting."""
    a = K * mu ** (B - 2)
    return poisson(rng.gammavariate(1 / a, mu * a), rng)


def median(v):
    return sorted(v)[(len(v) - 1) // 2]                 # MAGeCK's mmedian (odd lengths here)


def size_factors(rows):
    """Median ratio: each count over its guide's geometric mean of (count + 1); the median ratio per sample.
    Guides with no reads in any sample are left out, as MAGeCK does."""
    rows = [r for r in rows if sum(r) > 0]
    g = [math.exp(sum(math.log(x + 1) for x in r) / len(r)) for r in rows]
    return [sorted(r[j] / gi for r, gi in zip(rows, g))[len(g) // 2] for j in range(len(rows[0]))]


def med_var(rows):
    mu = [median(r) for r in rows]
    return mu, [sum((x - m) ** 2 for x in r) / max(len(r) - 1, 1) for r, m in zip(rows, mu)]


def fit(mu, var):
    """MAGeCK's modelmeanvar(method='linear'): returns (slope, intercept) on the log2 scale."""
    mm = sum(mu) / len(mu)
    sd = math.sqrt(sum((m - mm) ** 2 for m in mu) / (len(mu) - 1))
    cut = mm + 4 * sd
    keep = [(m, v - m) for m, v in zip(mu, var) if m < v and m < cut]
    x = [math.log2(m + 1) for m, _ in keep]
    y = [math.log2(e + 1) for _, e in keep]
    w = [m for m, _ in keep]
    nw, sx, sy = sum(w), sum(a * c for a, c in zip(x, w)), sum(a * c for a, c in zip(y, w))
    sx2, sxy = sum(a * a * c for a, c in zip(x, w)), sum(a * b * c for a, b, c in zip(x, y, w))
    a0 = (sy * sx2 - sx * sxy) / (nw * sx2 - sx * sx)
    b0 = (nw * sxy - sx * sy) / (nw * sx2 - sx * sx)
    return max(b0, 1.0), max(a0, 0.0), x, y, (b0, a0)


def ncdf(z):
    return math.erfc(-z / math.sqrt(2)) / 2


def beta_cdf(x, k, n):
    """CDF of Beta(k, n + 1 - k) at x: the chance that the k-th smallest of n uniform draws is at most x."""
    return sum(math.comb(n, j) * x ** j * (1 - x) ** (n - j) for j in range(k, n + 1))


def rho(r, alpha):
    """alpha-RRA: walk a gene's sorted percentiles, stop at the first one above alpha (the best always counts)."""
    r, best = sorted(r), 1.0
    for i, x in enumerate(r):
        if i > 0 and x > alpha:
            break
        best = min(best, beta_cdf(x, i + 1, len(r)))
    return best


# ---------- the full screen: only for the mean-variance fit ----------
rng = random.Random(7)
full = []
for _ in range(2000):
    lam = min(max(math.exp(rng.gauss(math.log(300), 0.8)), 5), 5000)
    full.append([draw(lam * d, rng) for d in DEPTH_FULL])
sf = size_factors(full)
fmu, fvar = med_var([[x / s for x, s in zip(r, sf)] for r in full])
slope, icept, fx, fy, unclamped = fit(fmu, fvar)


# ---------- the mini screen: the first seed that tells the story ----------
def mini(seed):
    rng = random.Random(seed)
    raw = [[draw(lv * f * d, rng) for d, f in zip(DEPTH_MINI, [1, 1, 1, fo, fo, fo])] for lv, fo in zip(LEVEL, FOLD)]
    s = size_factors(raw)
    norm = [[x / sj for x, sj in zip(r, s)] for r in raw]
    cmu, cvar = med_var([r[:3] for r in norm])
    tmu = [median(r[3:]) for r in norm]
    adj = [m ** slope * 2 ** icept + m for m in cmu]
    z = [(t - m) / math.sqrt(v) for t, m, v in zip(tmu, cmu, adj)]
    z0 = [-m / math.sqrt(v) for m, v in zip(cmu, adj)]
    plow = [(ncdf(a) - ncdf(b)) / (1 - ncdf(b)) for a, b in zip(z, z0)]
    return raw, s, norm, cmu, cvar, tmu, adj, z, plow


for seed in range(1, 5000):
    raw, s, norm, cmu, cvar, tmu, adj, z, plow = mini(seed)
    order = sorted(range(9), key=lambda i: plow[i])
    nulls = [plow[i] for i in (2, 7, 8)]
    depth_ok = all(abs(s[j] / s[0] / (DEPTH_MINI[j] / DEPTH_MINI[0]) - 1) < 0.12 for j in range(6))
    if (order[:3] == [0, 1, 6] and sorted(order[6:]) == [3, 4, 5] and min(nulls) > 0.25 and min(nulls) < 0.5 < max(nulls)
            and all(v > m for m, v in zip(cmu, cvar)) and depth_ok):
        break
else:
    raise SystemExit("no seed tells the story")

n = len(GUIDES)
alpha = min(max(sum(p <= 0.25 for p in plow) / n, 0.05), 0.5)
rank = [order.index(i) + 1 for i in range(n)]
pct = [(rk - 0.5) / n for rk in rank]
genes = {g: [pct[i] for i in range(n) if GUIDES[i][0] == g] for g in "ABC"}
rhos = {g: rho(r, alpha) for g, r in genes.items()}
null = [rho(list(c), alpha) for c in combinations(sorted(pct), 3)]   # every way chance could hand a gene 3 guides
pperm = {g: sum(x <= rhos[g] + 1e-12 for x in null) / len(null) for g in rhos}
nullx = sorted({round(x, 6) for x in null})
nully = [sum(round(x, 6) == v for x in null) for v in nullx]
show = sorted(random.Random(3).sample(range(len(fx)), min(700, len(fx))))   # the chart draws 700 of the fitted guides
xw = sum(math.log2(m + 1) * m for m, v in zip(fmu, fvar) if m < v) / sum(m for m, v in zip(fmu, fvar) if m < v)

r6 = lambda v: round(v, 6)
out = {
    "seed": seed, "guides": GUIDES, "raw": raw, "sf": [r6(x) for x in s],
    "ctrl": [[r6(x) for x in r[:3]] for r in norm],
    "cmu": [r6(x) for x in cmu], "cvar": [r6(x) for x in cvar], "tmu": [r6(x) for x in tmu],
    "adj": [r6(x) for x in adj], "z": [r6(x) for x in z], "plow": [float(f"{p:.12g}") for p in plow], "pcol": [[float(f"{p:.12g}")] for p in plow],
    "slope": r6(slope), "icept": r6(icept), "nfit": len(fx),
    "fx": [round(fx[i], 3) for i in show], "fy": [round(fy[i], 3) for i in show], "nshow": len(show),
    "xc": round(xw, 3), "yc": round(icept + slope * xw, 3),
    "mx": [round(math.log2(m + 1), 3) for m in cmu], "my": [round(math.log2(v - m + 1), 3) for m, v in zip(cmu, cvar)],
    "alpha_rra": r6(alpha), "pct": [r6(p) for p in pct], "rA": [r6(p) for p in sorted(genes["A"])],
    **{f"rho{g}": r6(v) for g, v in rhos.items()}, **{f"p{g}": pperm[g] for g in rhos},
    "nnull": len(null), "nullx": nullx, "nully": nully,
    "hitx": [x for x in nullx if x <= rhos["A"] + 1e-9], "hity": [y for x, y in zip(nullx, nully) if x <= rhos["A"] + 1e-9],
}
Path(__file__).with_name("data.json").write_text(json.dumps(out))
print(f"fit on {len(fx)} guides: slope {slope:.3f}, intercept {icept:.3f} (before clamps {unclamped[0]:.3f}, {unclamped[1]:.3f}); "
      f"mini seed {seed}; alpha {alpha:.3f}")
for i, g in enumerate(GUIDES):
    print(f"  {g}: raw {raw[i]}  ctrl median {cmu[i]:7.1f}  var {cvar[i]:8.1f}  adj {adj[i]:8.1f}  "
          f"treat {tmu[i]:7.1f}  z {z[i]:6.2f}  p.low {plow[i]:.3g}  pct {pct[i]:.3f}")
print("  size factors", [round(x, 3) for x in s], " rho", {g: round(v, 4) for g, v in rhos.items()}, " p", pperm)
