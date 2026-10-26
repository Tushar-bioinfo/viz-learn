#!/usr/bin/env python3
"""Recompute every number of PCA episode 2 with numpy, separately from make_data.py, and compare with data.json."""
import json, math
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
D = json.loads((HERE / "data.json").read_text())
H = json.loads((HERE.parent / "home" / "cells.json").read_text())
E1 = json.loads((HERE.parent / "pca-1-what" / "data.json").read_text())
bad = []
def ok(name, got, want, tol=1e-9):
    g, w = np.asarray(got, float), np.asarray(want, float)
    if g.shape != w.shape or not np.allclose(g, w, atol=tol, rtol=0):
        bad.append(f"{name}: data {got} vs recomputed {want}")

assert D["home"] == {"name": H["name"], "provenance": H["provenance"]}, "home block differs from the home file"
assert D["ids"] == E1["ids"], "episode 2 must use episode 1's cells"
X = np.array([H["values"][H["row_ids"].index(c)][:2] for c in D["ids"]])
assert H["col_ids"][:2] == ["CD3", "CD19"]
Z = X - X.mean(axis=0); n = len(X)
ok("n", D["n"], n); ok("cd3", D["cd3"], X[:, 0]); ok("cd19", D["cd19"], X[:, 1])
ok("m1 m2", [D["m1"], D["m2"]], X.mean(axis=0)); ok("d1", D["d1"], Z[:, 0]); ok("d2", D["d2"], Z[:, 1])
ok("prod", D["prod"], Z[:, 0] * Z[:, 1]); ok("n_neg", D["n_neg"], int((Z[:, 0] * Z[:, 1] < 0).sum()))
for k, c in enumerate(D["cells"]):
    assert c["id"] == D["ids"][k] and c["type"] == H["row_info"]["type"][H["row_ids"].index(c["id"])]
    ok(f"cells[{k}]", [c["cd3"], c["cd19"], c["d1"], c["d2"], c["prod"]], [*X[k], *Z[k], Z[k, 0] * Z[k, 1]])

C = np.cov(X, rowvar=False)
ok("v_cd3", D["v_cd3"], C[0, 0]); ok("v_cd19", D["v_cd19"], C[1, 1]); ok("c12", D["c12"], C[0, 1])
ok("cmat", [[r["cd3"], r["cd19"]] for r in D["cmat"]], C); assert [r["name"] for r in D["cmat"]] == ["CD3", "CD19"]
# the three numbers are episode 1's
ok("ep1 spreads", [D["v_cd3"], D["v_cd19"], D["c12"]], [E1["v_cd3"], E1["v_cd19"], E1["c12"]], 1e-12)

u = np.array([D["u1"], D["u2"]]); ok("uvec", D["uvec"], u); ok("|u|", np.linalg.norm(u), 1)
ok("th_hand", D["th_hand"], math.degrees(math.atan2(u[1], u[0])))
ok("p0", D["p0"], Z[0] @ u); ok("s2u", D["s2u"], u @ C @ u); ok("s2u = ep1", D["s2u"], E1["s2u"], 1e-12)
ok("s2u = var of shadows", D["s2u"], np.var(Z @ u, ddof=1))
ok("cu", [D["cu1"], D["cu2"]], C @ u); ok("cu_th", D["cu_th"], math.degrees(math.atan2(*(C @ u)[::-1])) % 180)

th = np.arange(0, 181, 5); U = np.stack([np.cos(np.radians(th)), np.sin(np.radians(th))], 1); CU = U @ C
ok("ths", D["ths"], th); ok("n_lines", D["n_lines"], len(th)); ok("sweep", D["sweep"], np.var(Z @ U.T, axis=0, ddof=1)); ok("sweep = ep1", D["sweep"], E1["spl"], 1e-12); ok("ux", D["ux"], U[:, 0]); ok("uy", D["uy"], U[:, 1]); ok("cux", D["cux"], CU[:, 0]); ok("cuy", D["cuy"], CU[:, 1])
cth = np.degrees(np.arctan2(CU[:, 1], CU[:, 0])) % 180; ok("cth", D["cth"], cth)
g = np.abs(cth - th) % 180; ok("gap", D["gap"], np.minimum(g, 180 - g))

w, V = np.linalg.eigh(C)
ok("lam1 lam2", [D["lam1"], D["lam2"]], [w[1], w[0]]); ok("ratio", D["ratio"], w[0] / w[1]); ok("ratio2", D["ratio2"], (w[0] / w[1]) ** 2)
ok("th_star", D["th_star"], math.degrees(math.atan2(V[1, 1], V[0, 1])) % 180); ok("th_low", D["th_low"], math.degrees(math.atan2(V[1, 0], V[0, 0])) % 180, 1e-6)
vv = V[:, 1] * np.sign(V[1, 1]); ok("v1 v2", [D["v1"], D["v2"]], vv); ok("lam1 = ep1", D["lam1"], E1["lam1"], 1e-12)

# power iteration, written again
x = np.array([D["a1"], D["a2"]]); P = [x]
for _ in range(D["reps"]):
    y = C @ P[-1]; P.append(y / np.linalg.norm(y))
P = np.array(P); PC = P @ C
ok("steps_t", D["steps_t"], np.arange(D["reps"] + 1))
ok("pu1", D["pu1"], P[:, 0]); ok("pu2", D["pu2"], P[:, 1]); ok("pcu1", D["pcu1"], PC[:, 0]); ok("pcu2", D["pcu2"], PC[:, 1])
ok("plen", D["plen"], np.linalg.norm(PC, axis=1)); ok("pth", D["pth"], np.degrees(np.arctan2(P[:, 1], P[:, 0])) % 180)
q = np.einsum("ij,jk,ik->i", P, C, P); ok("pq", D["pq"], q); ok("perr", D["perr"], w[1] - q, 1e-9)
assert abs(D["pth"][-1] - D["th_star"]) < 1e-2, "the repeats do not reach PC1"

# limits: CD3 scaled, then both standardised
S = np.diag([D["gain"], 1.0]); wg, Vg = np.linalg.eigh(S @ C @ S)
ok("th_g", D["th_g"], math.degrees(math.atan2(Vg[1, 1], Vg[0, 1])) % 180, 1e-6)
R = np.corrcoef(X, rowvar=False); wr, Vr = np.linalg.eigh(R)
ok("r12", D["r12"], R[0, 1]); ok("th_r", D["th_r"], math.degrees(math.atan2(Vr[1, 1], Vr[0, 1])) % 180, 1e-6)

print("\n".join(bad) if bad else "ALL OK")
