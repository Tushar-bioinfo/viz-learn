#!/usr/bin/env python3
"""Check data.json two ways before any of its numbers reaches a slide.

1. Reproducible: make_data.py, run again in a temporary folder, writes the same data.json byte for byte.
2. Independent: numpy and scipy redo every step from the simulated counts, without make_data.py's code, and must
   agree with data.json (to 2e-6; p-values to 1e-9 relative).
It also prints the paper's negative binomial tail beside the normal tail the 0.5.9.5 code uses (the deck's caveat).
Needs numpy and scipy. One ok/BAD line per quantity, then ALL OK (exit 0) or MISMATCH (exit 1).
"""
import contextlib, io, itertools, json, math, runpy, shutil, sys, tempfile
from pathlib import Path

import numpy as np
from scipy import stats

HERE = Path(__file__).resolve().parent
d = json.loads((HERE / "data.json").read_text())
bad = []


def same(name, mine, theirs, rtol=2e-6, atol=2e-6):
    ok = np.allclose(np.asarray(mine, float), np.asarray(theirs, float), rtol=rtol, atol=atol)
    print(f"{'ok ' if ok else 'BAD'} {name}")
    if not ok:
        bad.append(name)
        print("   mine  ", np.round(np.asarray(mine, float), 6).tolist(), "\n   theirs", theirs)


# 1. reproducible: the generator writes data.json next to itself, so run a copy of it elsewhere
with tempfile.TemporaryDirectory() as tmp:
    shutil.copy(HERE / "make_data.py", tmp)
    with contextlib.redirect_stdout(io.StringIO()):
        gen = runpy.run_path(str(Path(tmp) / "make_data.py"))
    rep = (Path(tmp) / "data.json").read_bytes() == (HERE / "data.json").read_bytes()
print(f"{'ok ' if rep else 'BAD'} data.json is reproducible from make_data.py")
rep or bad.append("reproducible")


def size_factors(raw):   # median ratio over each guide's geometric mean of (count + 1); all-zero guides left out
    raw = raw[raw.sum(1) > 0]
    gm = np.exp(np.log(raw + 1).mean(1))
    return np.array([np.sort(raw[:, j] / gm)[len(gm) // 2] for j in range(raw.shape[1])])


def med_var(m):          # per-guide median, and the variance around that median (n - 1)
    mu = np.median(m, 1)
    return mu, ((m - mu[:, None]) ** 2).sum(1) / max(m.shape[1] - 1, 1)


# 2a. the mean-variance line, fitted on the full screen's simulated counts (the only thing taken from the generator)
full = np.array(gen["full"], float)
fmu, fvar = med_var(full / size_factors(full))
cut = fmu.mean() + 4 * fmu.std(ddof=1)
keep = (fmu < fvar) & (fmu < cut)
x, y, w = np.log2(fmu[keep] + 1), np.log2(fvar[keep] - fmu[keep] + 1), fmu[keep]
b0, a0 = np.polyfit(x, y, 1, w=np.sqrt(w))   # polyfit weights the residuals, so sqrt(w) gives least squares weighted by w
print(f"   fit on {keep.sum()} guides: slope {b0:.6f}, intercept {a0:.6f} before the clamps (slope >= 1, intercept >= 0)")
slope, icept = max(b0, 1), max(a0, 0)
same("slope", slope, d["slope"]); same("intercept", icept, d["icept"]); same("guides in the fit", keep.sum(), d["nfit"])

# 2b. the 9-guide screen, step by step
raw = np.array(d["raw"], float)
sf = size_factors(raw); same("size factors", sf, d["sf"])
norm = raw / sf
ctrl, trt = norm[:, :3], norm[:, 3:]
same("normalized controls", ctrl, d["ctrl"])
cmu, cvar = med_var(ctrl); same("control medians", cmu, d["cmu"]); same("control variances", cvar, d["cvar"])
tmu = np.median(trt, 1); same("treated medians", tmu, d["tmu"])
adj = cmu ** slope * 2 ** icept + cmu; same("model variances", adj, d["adj"])
z = (tmu - cmu) / np.sqrt(adj); same("z", z, d["z"])
z0 = -cmu / np.sqrt(adj)   # the normal tail is cut at zero reads
plow = (stats.norm.cdf(z) - stats.norm.cdf(z0)) / stats.norm.sf(z0)
same("p.low (normal, cut at 0)", plow, d["plow"], rtol=1e-9, atol=1e-15)
alpha = min(max((plow <= .25).mean(), .05), .5); same("alpha", alpha, d["alpha_rra"])
n = len(plow)
pct = (stats.rankdata(plow, method="ordinal") - .5) / n; same("percentiles", pct, d["pct"])


def rho(r):   # alpha-RRA: the smallest Beta tail over the sorted percentiles, stopping past alpha
    r, out = np.sort(r), 1.0
    for i, v in enumerate(r):
        if i > 0 and v > alpha:
            break
        out = min(out, stats.beta.cdf(v, i + 1, len(r) - i))
    return out


genes = {G: pct[[i for i, g in enumerate(d["guides"]) if g[0] == G]] for G in "ABC"}
rhos = {G: rho(genes[G]) for G in "ABC"}
null = np.array([rho(np.array(c)) for c in itertools.combinations(pct, 3)])   # every set of 3 guides chance could pick
for G in "ABC":
    same(f"rho {G}", rhos[G], d[f"rho{G}"])
    same(f"permutation p {G}", (null <= rhos[G] + 1e-12).mean(), d[f"p{G}"])
same("null size", len(null), d["nnull"])

# the paper's negative binomial with the same mean and variance, beside the code's normal tail
nb = lambda t, m, a: stats.nbinom.cdf(math.floor(t), m * m / (a - m), m / a)   # size m^2/(a - m), success prob m/a
for i, g in [(0, "A1"), (1, "A2"), (6, "C1")]:
    print(f"   {g}: NB P(count <= {math.floor(tmu[i])}) = {nb(tmu[i], cmu[i], adj[i]):.4g}, normal p.low = {plow[i]:.4g}")
order_nb = np.argsort([nb(t, m, a) for t, m, a in zip(tmu, cmu, adj)], kind="stable")
print("   same guide order under both tails:", list(order_nb) == list(np.argsort(plow, kind="stable")))
print("ALL OK" if not bad else f"MISMATCH: {bad}")
sys.exit(1 if bad else 0)
