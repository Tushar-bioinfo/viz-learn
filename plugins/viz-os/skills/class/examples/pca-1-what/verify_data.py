#!/usr/bin/env python3
"""Recompute every number of PCA episode 1 with numpy, separately from make_data.py, and compare with data.json."""
import json, math
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
D = json.loads((HERE / "data.json").read_text())
H = json.loads((HERE.parent / "home" / "cells.json").read_text())
bad = []
def ok(name, got, want, tol=1e-9):
    g, w = np.asarray(got, float), np.asarray(want, float)
    if g.shape != w.shape or not np.allclose(g, w, atol=tol, rtol=0):
        bad.append(f"{name}: data {got} vs recomputed {want}")

assert D["home"] == {"name": H["name"], "provenance": H["provenance"]}, "home block differs from the home file"
ids = D["ids"]
X = np.array([H["values"][H["row_ids"].index(c)][:2] for c in ids])      # CD3, CD19
assert H["col_ids"][:2] == ["CD3", "CD19"]
ok("cd3", D["cd3"], X[:, 0]); ok("cd19", D["cd19"], X[:, 1]); ok("n", D["n"], len(ids))
mu = X.mean(axis=0); Z = X - mu
ok("m1", D["m1"], mu[0]); ok("m2", D["m2"], mu[1]); ok("d1", D["d1"], Z[:, 0]); ok("d2", D["d2"], Z[:, 1])
for k, c in enumerate(D["cells"]):
    assert c["id"] == ids[k] and c["type"] == H["row_info"]["type"][H["row_ids"].index(ids[k])]
    ok(f"cells[{k}]", [c["cd3"], c["cd19"], c["d1"], c["d2"]], [X[k, 0], X[k, 1], Z[k, 0], Z[k, 1]])
C = np.cov(X, rowvar=False)                       # divides by n - 1
ok("v_cd3", D["v_cd3"], C[0, 0]); ok("v_cd19", D["v_cd19"], C[1, 1]); ok("c12", D["c12"], C[0, 1])
ok("tot", D["tot"], np.trace(C)); ok("share_cd3", D["share_cd3"], C[0, 0] / np.trace(C))

u = np.array([D["u1"], D["u2"]]); ok("|u|", np.linalg.norm(u), 1.0)
ok("p", D["p"], Z @ u); ok("p1", D["p1"], (Z @ u)[0]); ok("s2u", D["s2u"], np.var(Z @ u, ddof=1))
ok("th_hand", D["th_hand"], math.degrees(math.atan2(u[1], u[0])))

th = np.arange(0, 181, 5); U = np.stack([np.cos(np.radians(th)), np.sin(np.radians(th))], 1)
ok("ths", D["ths"], th); ok("cosl", D["cosl"], U[:, 0]); ok("sinl", D["sinl"], U[:, 1])
ok("spl", D["spl"], np.var(Z @ U.T, axis=0, ddof=1)); ok("n_frames", D["n_frames"], len(th))
kb = int(np.argmax(np.var(Z @ U.T, axis=0, ddof=1)))
ok("k_best", D["k_best"], kb); ok("th_best", D["th_best"], th[kb]); ok("sp_best", D["sp_best"], np.var(Z @ U[kb], ddof=1))
ok("k_hand", D["k_hand"], round(math.degrees(math.atan2(u[1], u[0])) / 5))

w, V = np.linalg.eigh(C); v = V[:, 1] * np.sign(V[1, 1])          # top eigenvector, CD19 part positive (angle in 0..180)
ok("lam1", D["lam1"], w[1]); ok("lam2", D["lam2"], w[0])
ok("v1 v2", [D["v1"], D["v2"]], v); ok("th_star", D["th_star"], math.degrees(math.atan2(v[1], v[0])) % 180)
ok("th_low", D["th_low"], math.degrees(math.atan2(V[1, 0], V[0, 0])) % 180, 1e-6)
ok("score", D["score"], Z @ v); ok("share1", D["share1"], w[1] / w.sum()); ok("lost", D["lost"], w[0] / w.sum())
# the sweep never beats the eigenvalue, and the spread along a line is its eigen-mix (the curve lives between lam2 and lam1)
assert np.all(np.var(Z @ U.T, axis=0, ddof=1) <= w[1] + 1e-12) and np.all(np.var(Z @ U.T, axis=0, ddof=1) >= w[0] - 1e-12)

ok("m_panel", D["m_panel"], 30); ok("grid2", D["grid2"], 36); ok("grid3", D["grid3"], 36 ** 2); ok("log_grid30", D["log_grid30"], 29 * math.log10(36))
T = np.array([r[:2] for r, t in zip(H["values"], H["row_info"]["type"]) if t == "T"])
wt, Vt = np.linalg.eigh(np.cov(T, rowvar=False)); vt = Vt[:, 1] * np.sign(Vt[1, 1])
ok("n_t", D["n_t"], len(T)); ok("lam1_t", D["lam1_t"], wt[1]); ok("th_t", D["th_t"], math.degrees(math.atan2(vt[1], vt[0])) % 180)

print("\n".join(bad) if bad else "ALL OK")
