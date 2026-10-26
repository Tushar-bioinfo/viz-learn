#!/usr/bin/env python3
"""Recompute the perceptron-trick lesson's numbers with numpy and scipy, separately from make_data.py, and compare.

The run's shuffles are not replayed. Instead every recorded update is checked: its cell was wrong under the line before,
and the weights moved by exactly eta * (y - yhat) * (1, CD3, CD19). Whether a set of cells can be split by a line at all
is settled by a linear program, not by running the perceptron. Prints one line per check and ALL OK at the end.
"""
import json
from pathlib import Path

import numpy as np
from scipy.optimize import linprog

HERE = Path(__file__).resolve().parent
d = json.loads((HERE / "data.json").read_text())
home = json.loads((HERE.parent / "home" / "cells.json").read_text())
bad = []


def ok(name, got, want, tol=1e-9):
    good = np.allclose(np.asarray(got, float), np.asarray(want, float), atol=tol, rtol=0)
    print(f"{'ok ' if good else 'BAD'} {name}: {got if np.size(got) < 4 else '…'}")
    if not good:
        bad.append(name)


ids = np.array(home["row_ids"])
kinds = np.array(home["row_info"]["type"])
vals = np.array(home["values"])
j3, j19 = home["col_ids"].index("CD3"), home["col_ids"].index("CD19")
keep = np.isin(kinds, ["B"]) | np.isin(ids, ids[kinds == "T"][:4])
X = np.c_[np.ones(keep.sum()), vals[keep][:, j3], vals[keep][:, j19]]   # x0 = 1, CD3, CD19
Y = (kinds[keep] == "T").astype(int)
calls = lambda w, X=X: (X @ np.asarray(w) >= 0).astype(int)

ok("home provenance copied", d["home"]["provenance"] == home["provenance"], True)
ok("the eight cells", [c["id"] for c in d["pcells"]] == list(ids[keep]), True)
ok("CD3 and CD19", [d["cd3"], d["cd19"]], [X[:, 1], X[:, 2]])
ok("labels", d["y"], Y)
w = np.array([d["w0"], d["w1"], d["w2"]])
ok("start: cells wrong", d["n_wrong0"], np.sum(calls(w) != Y))
ok("start: which cells", d["wrong0_ids"] == list(ids[keep][calls(w) != Y]), True)
k5 = list(ids[keep]).index("c5")
ok("c5 is a B cell the start calls T", [Y[k5], calls(w)[k5]], [0, 1])
ok("c5's score", d["c5_score"], X[k5] @ w)
ok("c1's score", d["sc1"], X[list(ids[keep]).index("c1")] @ w)
ok("c5's score after the small step", d["c5_small"], X[k5] @ (w - d["eta"] * X[k5]))
ok("c5's label and call", [d["c5_y"], d["c5_call"]], [Y[k5], calls(w)[k5]])
ok("trick table", [[r["xv"] for r in d["trick"]], [r["wv"] for r in d["trick"]]], [X[k5], w])
ok("eta = 1 step", [d["wb0"], d["wb1"], d["wb2"]], w - X[k5])
ok("eta = 1: cells wrong", d["n_wrong_big"], np.sum(calls(w - X[k5]) != Y))
ok("small step", [d["ws0"], d["ws1"], d["ws2"]], w - d["eta"] * X[k5])
ok("small step: cells wrong", d["n_wrong_small"], np.sum(calls(w - d["eta"] * X[k5]) != Y))
ok("four cases of y - yhat", [c["y"] - c["call"] for c in d["cases"]], [0, 0, 1, -1])

T = np.c_[d["w0_trace"], d["w1_trace"], d["w2_trace"]]
nid = d["next_id"]
ok("run starts at the start line", T[0], w)
ok("one frame per update, plus the start", [len(T), d["n_frames"]], [d["updates"] + 1] * 2)
steps_ok = True
for f in range(d["updates"]):
    k = list(ids[keep]).index(nid[f])
    yhat = calls(T[f])[k]
    steps_ok &= yhat != Y[k] and np.allclose(T[f + 1] - T[f], d["eta"] * (Y[k] - yhat) * X[k])
ok("every update: its cell was wrong, and w moved by eta (y - yhat) x", steps_ok, True)
ok("adds and subtracts", [d["n_adds"], d["n_subs"]], [sum(Y[list(ids[keep]).index(c)] for c in nid[:-1]), sum(1 - Y[list(ids[keep]).index(c)] for c in nid[:-1])])
ok("plus frame is the first add", [d["next_add"][d["plus_frame"]], min(f for f in range(d["updates"]) if d["next_add"][f])], [1, d["plus_frame"]])
ok("cells wrong per frame", d["wrong_trace"], [np.sum(calls(t) != Y) for t in T])
ep = np.array(d["epoch_trace"][1:])
ok("epochs never go back", np.all(np.diff(ep) >= 0), True)
ok("a cell is fixed at most once per epoch", all(len(set(np.array(nid[:-1])[ep == e])) == np.sum(ep == e) for e in set(ep)), True)
ok("final line: no cell wrong", np.sum(calls(T[-1]) != Y), 0)
ok("slope and intercept", [d["slope"], d["icept"]], [-T[-1, 1] / T[-1, 2], -T[-1, 0] / T[-1, 2]])
dist = lambda w: np.abs(X @ w) / np.hypot(w[1], w[2])
ok("closest cell to the final line", [d["gap1"], d["graze_id"] == ids[keep][np.argmin(dist(T[-1]))]], [dist(T[-1]).min(), True])
w2 = np.array([d["wg0"], d["wg1"], d["wg2"]])
ok("line from zero: no cell wrong", np.sum(calls(w2) != Y), 0)
ok("line from zero: closest cell", d["gap2"], dist(w2).min())


def separable(X, Y):
    """Is there w with (2y - 1) * (w . x) >= 1 for every cell? A feasibility linear program."""
    s = 2 * np.asarray(Y) - 1
    r = linprog(np.zeros(X.shape[1]), A_ub=-(s[:, None] * X), b_ub=-np.ones(len(X)), bounds=[(None, None)] * X.shape[1])
    return r.status == 0


ok("the eight cells can be split by a line", separable(X, Y), True)
c9 = d["c9"]
X9 = np.r_[X, [[1, c9["cd3"], c9["cd19"]]]]
Y9 = np.r_[Y, c9["y"]]
ok("c9 is home's c9, a T cell, typed B", [c9["cd3"], c9["cd19"], kinds[ids == "c9"][0] == "T", c9["y"]], [vals[ids == "c9"][0, j3], vals[ids == "c9"][0, j19], True, 0])
ok("with c9 typed B no line splits them", separable(X9, Y9), False)
ok("so the run never reaches 0 wrong", [len(d["err9"]), min(d["err9"]) > 0], [d["epochs9"], True])
th = d["thymo"]
XT = np.c_[np.ones(len(th)), [t["cd4"] for t in th], [t["cd8"] for t in th]]
YT = np.array([t["y"] for t in th])
ok("thymocytes: single-positive is SP4 or SP8", all(t["y"] == t["kind"].startswith("SP") for t in th), True)
ok("thymocytes: no line splits them", separable(XT, YT), False)
rng = np.random.default_rng(0)   # many random lines: the fewest wrong should match the sweep in make_data
W = np.c_[rng.uniform(-6, 6, 200000), rng.normal(size=(200000, 2))]
fewest = np.min(np.sum((XT @ W.T >= 0).astype(int) != YT[:, None], axis=0))
ok("thymocytes: the best line still gets a group wrong", [d["xor_best"], fewest], [4, 4])
print("ALL OK" if not bad else f"FAILED: {', '.join(bad)}")
