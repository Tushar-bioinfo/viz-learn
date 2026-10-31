#!/usr/bin/env python3
"""Recompute every number of the PCA page with numpy, separately from make_data.py, and compare with data.json."""
import json
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
D = json.loads((HERE / "data.json").read_text())
H = json.loads((HERE.parent.parent.parent / "class" / "examples" / "home" / "cells.json").read_text())
bad = []


def ok(name, got, want, tol=1e-9):
    g, w = np.asarray(got, float), np.asarray(want, float)
    if g.shape != w.shape or not np.allclose(g, w, atol=tol, rtol=0):
        bad.append(f"{name}: data {got} vs recomputed {want}")


def pc1(X):
    """Top eigenvalue, eigenvector and angle in [0, 180) of the covariance of the columns of X."""
    C = np.cov(X, rowvar=False)
    lam, vec = np.linalg.eigh(C)
    u = vec[:, 1]
    if u[1] < 0:      # the same line, pointing up
        u = -u
    return lam[1], u, float(np.degrees(np.arctan2(u[1], u[0])) % 180), lam.sum()


assert D["home"] == {"name": H["name"], "provenance": H["provenance"]}, "home block differs from the home file"
ids = D["ids"]
rows = [H["row_ids"].index(c) for c in ids]
X = np.array(H["values"])[rows][:, [H["col_ids"].index("CD3"), H["col_ids"].index("CD19")]]
kinds = np.array(H["row_info"]["type"])[rows]
assert list(kinds) == D["kinds"]
ok("cd3", D["cd3"], X[:, 0]); ok("cd19", D["cd19"], X[:, 1]); ok("n", D["n"], len(ids)); ok("df", D["df"], len(ids) - 1)
mu = X.mean(axis=0); Z = X - mu
ok("sum3", D["sum3"], X[:, 0].sum()); ok("sum19", D["sum19"], X[:, 1].sum()); ok("m1", D["m1"], mu[0]); ok("m2", D["m2"], mu[1]); ok("d1", D["d1"], Z[:, 0]); ok("d2", D["d2"], Z[:, 1])
ok("d1c1", D["d1c1"], Z[0, 0]); ok("d2c1", D["d2c1"], Z[0, 1])

# the line by hand, as a matrix times a column
u = np.array(D["uvec"])
ok("u length", u @ u, 1.0)
P = Z @ u
ok("p", D["p"], P); ok("p1", D["p1"], P[0]); ok("sq", D["sq"], P ** 2); ok("sumsq", D["sumsq"], (P ** 2).sum()); ok("s2u", D["s2u"], np.var(P, ddof=1))
F = np.outer(P, u)
ok("footx", D["footx"], F[:, 0]); ok("footy", D["footy"], F[:, 1])
ok("rux", D["rux"], np.hypot(D["rux"], D["ruy"]) * u[0]); ok("ruy", D["ruy"], np.hypot(D["rux"], D["ruy"]) * u[1])

# every angle
th = np.radians(D["ths"]); U = np.column_stack([np.cos(th), np.sin(th)])
ok("cosl", D["cosl"], U[:, 0]); ok("sinl", D["sinl"], U[:, 1])
S = Z @ U.T
ok("spl", D["spl"], S.var(axis=0, ddof=1))
ok("fx", D["fx"], (S * U[:, 0]).T); ok("fy", D["fy"], (S * U[:, 1]).T)
reach = np.hypot(D["rx"][0], D["ry"][0])
ok("rx", D["rx"], reach * U[:, 0]); ok("ry", D["ry"], reach * U[:, 1])
ok("hi_th", D["hi_th"], D["ths"][int(np.argmax(S.var(axis=0, ddof=1)))]); ok("lo_th", D["lo_th"], D["ths"][int(np.argmin(S.var(axis=0, ddof=1)))])

# the best line
C = np.cov(X, rowvar=False)
ok("v_cd3", D["v_cd3"], C[0, 0]); ok("v_cd19", D["v_cd19"], C[1, 1]); ok("c12", D["c12"], C[0, 1]); ok("tot", D["tot"], np.trace(C)); ok("share_cd3", D["share_cd3"], C[0, 0] / np.trace(C))
lam, vec, angle, total = pc1(X)
ok("lam1", D["lam1"], lam); ok("lam2", D["lam2"], total - lam); ok("th_star", D["th_star"], angle); ok("v1", D["v1"], vec[0]); ok("v2", D["v2"], vec[1])
ok("share1", D["share1"], lam / total); ok("lost", D["lost"], 1 - lam / total)
s = Z @ vec
ok("score", D["score"], s); ok("left", D["left"], Z @ np.array([-vec[1], vec[0]]))
ok("rvx", D["rvx"], np.hypot(D["rvx"], D["rvy"]) * vec[0]); ok("rvy", D["rvy"], np.hypot(D["rvx"], D["rvy"]) * vec[1])
ok("score spread", s.var(ddof=1), lam)

# the same cells by kind
for key, kind in (("t", "T"), ("b", "B"), ("m", "mono")):
    m = kinds == kind
    assert D[key + "ids"] == [c for c, keep in zip(ids, m) if keep]
    for suf, col in (("3", X[:, 0]), ("19", X[:, 1]), ("d1", Z[:, 0]), ("d2", Z[:, 1]), ("s", s), ("l", Z @ np.array([-vec[1], vec[0]]))):
        ok(key + suf, D[key + suf], col[m])

# the limit, and the other path
Y = X * [D["big"], 1]
lam_b, _, angle_b, total_b = pc1(Y)
ok("bigx", D["bigx"], Y[:, 0]); ok("v_big", D["v_big"], np.var(Y[:, 0], ddof=1)); ok("th_b", D["th_b"], angle_b, 1e-6); ok("share_big", D["share_big"], lam_b / total_b)
W = (X - mu) / X.std(axis=0, ddof=1)
lam_z, _, angle_z, total_z = pc1(W)
ok("r", D["r"], np.corrcoef(X, rowvar=False)[0, 1]); ok("th_z", D["th_z"], angle_z, 1e-6); ok("share_z", D["share_z"], lam_z / total_z)

ok("cov1", D["cov1"], C[0]); ok("cov2", D["cov2"], C[1]); ok("rowv", D["rowv"], vec)
ok("route_th", D["route_th"], [angle, angle_b, angle_z], 1e-6); ok("route_share", D["route_share"], [lam / total, lam_b / total_b, lam_z / total_z])

print("ALL OK" if not bad else "\n".join(bad))
raise SystemExit(1 if bad else 0)
