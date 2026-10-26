#!/usr/bin/env python3
"""Recompute the variance lesson's numbers from the home table with numpy, separately from make_data.py, and compare.

The run's random draws are not replayed: for 3 cells, dividing by n gives exactly 2/3 of dividing by n - 1 on every
sample, so the two running averages must keep that ratio on every frame, and the n - 1 one must end near the true
variance. Prints one line per check and ALL OK at the end.
"""
import json
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
d = json.loads((HERE / "data.json").read_text())
home = json.loads((HERE.parent / "home" / "cells.json").read_text())
bad = []


def ok(name, got, want, tol=1e-9):
    good = np.allclose(np.asarray(got, float), np.asarray(want, float), atol=tol, rtol=0)
    print(f"{'ok ' if good else 'BAD'} {name}: {got if np.size(got) < 4 else '…'}")
    if not good:
        bad.append(name)


vals = np.array(home["values"])
cd3_all = vals[:, home["col_ids"].index("CD3")]
is_t = np.array(home["row_info"]["type"]) == "T"
x = cd3_all[is_t]
ok("home provenance copied", d["home"]["provenance"] == home["provenance"], True)
ok("T cells' CD3", d["cd3"], x)
ok("table rows match the list", [c["cd3"] for c in d["tcells"]], x)
ok("n", d["n"], x.size)
ok("picture slots match the table", d["slots"], [c["slot"] for c in d["tcells"]])
ok("mean", d["xbar"], x.mean())
dev = x - x.mean()
ok("distances sum to 0", d["sum_dev"], dev.sum(), 1e-9)
ok("sum of squares", d["ss"], np.sum(dev ** 2))
ok("variance (n - 1)", d["s2"], np.var(x, ddof=1))
k = int(np.argmax(np.where(dev > 0, dev ** 2, -1)))
ok("far cell is the biggest square above the mean", d["far_id"] == np.array(home["row_ids"])[is_t][k], True)
ok("far distance", d["far_dev"], dev[k])
top2 = np.sort(dev ** 2)[-2:].sum()
ok("two biggest squares' share", d["top_share"], top2 / np.sum(dev ** 2))
ok("donor B mean equals A's", d["mB"], d["mA"])
ok("donor B variance", d["sB"], np.var(d["donor_b"], ddof=1))
ok("tripled distances give 9x", d["ratio"], 9, 1e-6)
ok("patios share an average", [np.mean(d["even"]), np.mean(d["patchy"])], [d["drops"]] * 2)
ok("patio variances", [d["v_even"], d["v_patchy"]], [np.var(d["even"], ddof=1), np.var(d["patchy"], ddof=1)])
ok("true variance is s2 to 2 decimals", d["sig2"], round(np.var(x, ddof=1), 2))
rn, rn1 = np.array(d["run_n"]), np.array(d["run_n1"])
ok("run has one value per frame", [rn.size, rn1.size], [len(d["draws"])] * 2)
ok("dividing by n is 2/3 of n - 1 on every frame", rn, rn1 * 2 / 3, 1e-12)
ok("n - 1 ends within 5% of the truth", abs(rn1[-1] / d["sig2"] - 1) < 0.05, True)
ok("doublet: twice the light", d["dbl"], round(float(np.arcsinh(2 * np.sinh(x[k]))), 1))
kinds = np.array(home["row_info"]["type"])
ok("B cells' CD3", d["cd3_b"], cd3_all[kinds == "B"])
ok("monocytes' CD3", d["cd3_mono"], cd3_all[kinds == "mono"])
ok("all twelve cells' variance", d["s2_all"], np.var(cd3_all, ddof=1))
ok("standard deviation", d["sd"], np.std(x, ddof=1))
ok("z of the far cell", d["z_far"], dev[k] / np.std(x, ddof=1))
print("ALL OK" if not bad else f"FAILED: {', '.join(bad)}")
