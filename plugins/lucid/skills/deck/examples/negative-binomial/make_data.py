#!/usr/bin/env python3
"""Simulated teaching data for the negative-binomial deck: 400 genes x 4 replicates.

Each gene has a mean count mu (5 to 5,000 reads) and a dispersion alpha that falls with the mean, the way
DESeq2's trend does (alpha = 0.08 + 1.5 / mu). Each replicate draws its own true level from a gamma
distribution (mean mu, wobble alpha), then a Poisson count around that level. Writes data.json with the
sample mean and variance of every gene. Pure Python, seeded, no packages needed.
"""
import json, math, random
from pathlib import Path

rng = random.Random(42)


def poisson(lam):
    if lam > 500:  # split big rates into pieces so exp(-lam) does not underflow
        return sum(poisson(lam / 8) for _ in range(8))
    k, p, F, u = 0, math.exp(-lam), math.exp(-lam), rng.random()
    while u > F:
        k += 1
        p *= lam / k
        F += p
    return k


gm, gv = [], []
for _ in range(400):
    mu = 10 ** rng.uniform(math.log10(5), math.log10(5000))
    alpha = 0.08 + 1.5 / mu
    reps = [poisson(rng.gammavariate(1 / alpha, mu * alpha)) for _ in range(4)]
    m = sum(reps) / 4
    v = sum((x - m) ** 2 for x in reps) / 3
    if m > 0 and v > 0:
        gm.append(round(m, 2))
        gv.append(round(v, 2))

above = sum(v > m for m, v in zip(gm, gv)) / len(gm)
out = {"gm": gm, "gv": gv, "above": round(above, 3), "ngenes": len(gm)}
Path(__file__).with_name("data.json").write_text(json.dumps(out))
print(f"data.json: {len(gm)} genes, {above:.0%} above the Poisson line")
