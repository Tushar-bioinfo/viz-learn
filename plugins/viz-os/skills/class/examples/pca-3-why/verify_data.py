#!/usr/bin/env python3
"""Recompute every number of PCA episode 3 with numpy, separately from make_data.py, and compare with data.json."""
import json, math
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
D = json.loads((HERE / "data.json").read_text())
H = json.loads((HERE.parent / "home" / "cells.json").read_text())
E1 = json.loads((HERE.parent / "pca-1-what" / "data.json").read_text())
E2 = json.loads((HERE.parent / "pca-2-how" / "data.json").read_text())
bad = []
def ok(name, got, want, tol=1e-9):
    g, w = np.asarray(got, float), np.asarray(want, float)
    if g.shape != w.shape or not np.allclose(g, w, atol=tol, rtol=0):
        bad.append(f"{name}: data {got} vs recomputed {want}")

assert D["home"] == {"name": H["name"], "provenance": H["provenance"]}, "home block differs from the home file"
assert D["ids"] == E1["ids"] == E2["ids"], "episode 3 must use episodes 1 and 2's cells"
assert D["markers"] == ["CD3", "CD19", "CD14"]
J = [H["col_ids"].index(m) for m in D["markers"]]
X = np.array([[H["values"][H["row_ids"].index(c)][j] for j in J] for c in D["ids"]]); n = len(X)
Z = X - X.mean(axis=0)
ok("n", D["n"], n); ok("d1", D["d1"], Z[:, 0]); ok("d2", D["d2"], Z[:, 1]); ok("d3", D["d3"], Z[:, 2]); ok("m3", D["m3"], X[:, 2].mean())
C = np.cov(X, rowvar=False)
ok("v_cd3 v_cd19 c12", [D["v_cd3"], D["v_cd19"], D["c12"]], [C[0, 0], C[1, 1], C[0, 1]])
ok("v_cd14 c13 c23", [D["v_cd14"], D["c13"], D["c23"]], [C[2, 2], C[0, 2], C[1, 2]])
ok("cmat3", [[r["cd3"], r["cd19"], r["cd14"]] for r in D["cmat3"]], C); assert [r["name"] for r in D["cmat3"]] == D["markers"]
ok("2-D spreads = ep2", [D["v_cd3"], D["v_cd19"], D["c12"]], [E2["v_cd3"], E2["v_cd19"], E2["c12"]], 1e-12)

# two markers
C2 = C[:2, :2]; w2, V2 = np.linalg.eigh(C2)
v = V2[:, 1] * np.sign(V2[1, 1]); w = V2[:, 0] * np.sign(V2[1, 0])
ok("lam1 lam2", [D["lam1"], D["lam2"]], [w2[1], w2[0]]); ok("lam1 = ep2", D["lam1"], E2["lam1"], 1e-12)
ok("v", [D["v1"], D["v2"]], v); ok("th1", D["th1"], math.degrees(math.atan2(v[1], v[0])) % 180)
ok("w", [D["w1"], D["w2"]], w); ok("th2", D["th2"], math.degrees(math.atan2(w[1], w[0])) % 180)
u = np.array([D["u1"], D["u2"]]); h = np.array([D["h1"], D["h2"]])
ok("a b", [D["a"], D["b"]], [u @ v, u @ w]); ok("a2 b2", [D["a2"], D["b2"]], [(u @ v) ** 2, (u @ w) ** 2])
ok("s2u", D["s2u"], np.var(Z[:, :2] @ u, ddof=1)); ok("s2u = mix", D["s2u"], (u @ v) ** 2 * w2[1] + (u @ w) ** 2 * w2[0])
ok("ha hb hb2", [D["ha"], D["hb"], D["hb2"]], [h @ v, h @ w, (h @ w) ** 2]); ok("s2h", D["s2h"], np.var(Z[:, :2] @ h, ddof=1))
ok("s2h = ep1 hand", D["s2h"], E1["s2u"], 1e-12)
ok("ax ay", [D["ax"], D["ay"]], (u @ v) * v)

# three markers
w3, V3 = np.linalg.eigh(C); order = np.argsort(w3)[::-1]; w3, V3 = w3[order], V3[:, order]
for k, pin in enumerate([1, 2, 0]):                 # the sign rule
    V3[:, k] *= np.sign(V3[pin, k])
ok("L1 L2 L3", [D["L1"], D["L2"], D["L3"]], w3); ok("tot3", D["tot3"], np.trace(C))
ok("e1", D["e1"], V3[:, 0]); ok("e2", D["e2"], V3[:, 1]); ok("e3", D["e3"], V3[:, 2])
ok("cv1", D["cv1"], C @ V3[:, 0]); ok("ratio_cv", D["ratio_cv"], [w3[0]] * 3)
S = Z @ V3
ok("z1", D["z1"], S[:, 0]); ok("z2", D["z2"], S[:, 1]); ok("z3", D["z3"], S[:, 2])
ok("z ranges", [D["z1min"], D["z1max"], D["z2min"], D["z2max"]], [S[:, 0].min(), S[:, 0].max(), S[:, 1].min(), S[:, 1].max()])
R1 = np.outer(S[:, 0], V3[:, 0])                     # each cell rebuilt from PC1 alone
loss = ((Z - R1) ** 2).sum(axis=1)
k = D["ids"].index(D["lost_cell"]); ok("lost_row", D["lost_row"], k)
ok("lost_one", D["lost_one"], loss[k]); ok("lost_all", D["lost_all"], loss.sum()); ok("lost_all = (n-1)(L2+L3)", D["lost_all"], (n - 1) * (w3[1] + w3[2]))
ok("shares", D["shares"], w3 / w3.sum()); ok("share1", D["share1"], w3[0] / w3.sum()); ok("share12", D["share12"], w3[:2].sum() / w3.sum())
for i, c in enumerate(D["cells"]):
    assert c["id"] == D["ids"][i] and c["type"] == H["row_info"]["type"][H["row_ids"].index(c["id"])]
    ok(f"cells[{i}]", [c["cd3"], c["cd19"], c["cd14"], c["d1"], c["d2"], c["d3"], c["z1"], c["z2"], c["z3"], c["lost"]],
       [*X[i], *Z[i], *S[i], loss[i]])
# the reason PC1 wins: every unit arrow's spread is a mix of the three stretches, so it never beats L1
rng = np.random.default_rng(0); A = rng.normal(size=(2000, 3)); A /= np.linalg.norm(A, axis=1, keepdims=True)
assert np.all(np.einsum("ij,jk,ik->i", A, C, A) <= w3[0] + 1e-12)

print("\n".join(bad) if bad else "ALL OK")
