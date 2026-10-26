"""Check data.json next to this script.

Recomputes the CD3 mean, sum of deviations from that mean, sum of squared
deviations, sample variance, and standard deviation; the farthest cell; the
CD19 and CD4 sample variances; and the two donors' means, sample variances,
and variance ratio. Compares those with the stored values. Also checks that
every marker is on a 0.2-9.8 scale with at most one decimal, that the donors
have nearly the same mean while donor B is more spread out, that cells.png
is 1200 by 360 pixels, that each cell's i is its 1-based position, and that
far_i is the 1-based position of the farthest cell.

Recomputes the perceptron on pcells. Checks eight cells, ids p1-p8, four T
and four B, markers on a 0.4-9.6 scale with at most one decimal, and no pair
closer than 0.8 in (cd3, cd19). Starts at w = (0.5, -0.1, 0.1) with
eta = 0.1, walks the cells in list order, and repeats passes until a clean
one. Checks w0_trace, w1_trace, and w2_trace (start plus each update, length
12), updates == 11, that each update puts that cell on its right side
(y * score > 0), and that the final weights do so for every cell. Checks
next_x, next_y, and next_id (the cell for each update, last frame repeated)
and has_next (eleven 1s, then 0). Checks redo_n, the most times one cell is
updated, and redo_id, the earliest such cell. Checks that pseed is an integer.

Needs numpy and pillow.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
RTOL = 1e-9
ATOL = 1e-9

failed = False


def report(name, good, stored=None, got=None):
    global failed
    if good:
        print(f"ok  {name}")
        return
    failed = True
    print(f"BAD {name} {stored} {got}")


def close(stored, got):
    return bool(
        np.allclose(
            np.asarray(stored, dtype=float),
            np.asarray(got, dtype=float),
            rtol=RTOL,
            atol=ATOL,
        )
    )


def at_most_one_decimal(value):
    # A value with at most one decimal is an integer after scaling by 10.
    scaled = float(value) * 10.0
    return abs(scaled - round(scaled)) <= 1e-6


def run_perceptron(pcells, eta, max_updates=64):
    # y is +1 for a T cell and -1 otherwise. Score is w0 + w1*cd3 + w2*cd19.
    # Record the start, then the weights after each update. Stop after a pass
    # that changes nothing. The cap only keeps a bad run from looping forever.
    w = np.array([0.5, -0.1, 0.1], dtype=float)
    frames = [w.copy()]
    used = []
    while len(used) < max_updates:
        stepped = False
        for i, cell in enumerate(pcells):
            y = 1.0 if cell["kind"] == "T" else -1.0
            x = np.array(
                [1.0, float(cell["cd3"]), float(cell["cd19"])],
                dtype=float,
            )
            if y * float(np.dot(w, x)) <= 0.0:
                w = w + eta * y * x
                frames.append(w.copy())
                used.append(i)
                stepped = True
                if len(used) >= max_updates:
                    break
        if not stepped:
            break
    return frames, used


def main():
    data = json.loads((HERE / "data.json").read_text())
    cells = data["cells"]

    cd3 = np.array([cell["cd3"] for cell in cells], dtype=float)
    cd19 = np.array([cell["cd19"] for cell in cells], dtype=float)
    cd4 = np.array([cell["cd4"] for cell in cells], dtype=float)
    donor_a = np.array(data["donor_a"], dtype=float)
    donor_b = np.array(data["donor_b"], dtype=float)

    xbar = float(np.mean(cd3))
    dev = cd3 - xbar
    # sum_dev is stored rounded to 10 decimals; allclose absorbs that.
    sum_dev = float(np.sum(dev))
    ss = float(np.sum(dev ** 2))
    s2 = float(np.var(cd3, ddof=1))
    sd = float(np.sqrt(s2))
    far_i = int(np.argmax(np.abs(dev)))
    far_id = cells[far_i]["id"]
    far_dev = float(np.abs(dev)[far_i])
    mvar_cd19 = float(np.var(cd19, ddof=1))
    mvar_cd4 = float(np.var(cd4, ddof=1))

    mA = float(np.mean(donor_a))
    mB = float(np.mean(donor_b))
    sA = float(np.var(donor_a, ddof=1))
    sB = float(np.var(donor_b, ddof=1))
    ratio = float(sB / sA)

    report("xbar", close(data["xbar"], xbar), data["xbar"], xbar)
    report("sum_dev", close(data["sum_dev"], sum_dev), data["sum_dev"], sum_dev)
    report("ss", close(data["ss"], ss), data["ss"], ss)
    report("s2", close(data["s2"], s2), data["s2"], s2)
    report("sd", close(data["sd"], sd), data["sd"], sd)
    report("far_id", far_id == data["far_id"], data["far_id"], far_id)
    report("far_i", data["far_i"] == far_i + 1, data["far_i"], far_i + 1)
    report("far_dev", close(data["far_dev"], far_dev), data["far_dev"], far_dev)
    report("mvar_cd19", close(data["mvar_cd19"], mvar_cd19), data["mvar_cd19"], mvar_cd19)
    report("mvar_cd4", close(data["mvar_cd4"], mvar_cd4), data["mvar_cd4"], mvar_cd4)
    report("mA", close(data["mA"], mA), data["mA"], mA)
    report("mB", close(data["mB"], mB), data["mB"], mB)
    report("sA", close(data["sA"], sA), data["sA"], sA)
    report("sB", close(data["sB"], sB), data["sB"], sB)
    report("ratio", close(data["ratio"], ratio), data["ratio"], ratio)

    report("cd3", close(data["cd3"], cd3), data["cd3"], cd3.tolist())
    report("n", data["n"] == len(cells), data["n"], len(cells))
    ids = [cell["id"] for cell in cells]
    expected_ids = [f"c{i}" for i in range(1, 7)]
    report("ids", ids == expected_ids, expected_ids, ids)
    stored_i = [cell.get("i") for cell in cells]
    expected_i = list(range(1, len(cells) + 1))
    report("cell_i", stored_i == expected_i, stored_i, expected_i)

    marker_values = (
        cd3.tolist() + cd19.tolist() + cd4.tolist()
        + donor_a.tolist() + donor_b.tolist()
    )
    bad_markers = [
        value for value in marker_values
        if not (at_most_one_decimal(value) and 0.2 <= value <= 9.8)
    ]
    report(
        "markers",
        not bad_markers,
        "[0.2, 9.8] at most 1 decimal",
        bad_markers,
    )

    report("donor_means", abs(mA - mB) < 0.1, mA, mB)
    report("donor_spread", ratio > 3, ">3", ratio)

    png = HERE / "cells.png"
    if not png.is_file():
        report("cells_png", False, (1200, 360), "missing")
    else:
        with Image.open(png) as im:
            im.load()
            size = im.size
        report("cells_png", size == (1200, 360), (1200, 360), size)

    pcells = data["pcells"]
    p_ids = [cell.get("id") for cell in pcells]
    p_kinds = [cell.get("kind") for cell in pcells]
    expected_p_ids = [f"p{i}" for i in range(1, 9)]
    report(
        "pcells",
        (
            len(pcells) == 8
            and p_ids == expected_p_ids
            and p_kinds.count("T") == 4
            and p_kinds.count("B") == 4
        ),
        {"n": 8, "ids": expected_p_ids, "T": 4, "B": 4},
        {"n": len(pcells), "ids": p_ids, "T": p_kinds.count("T"), "B": p_kinds.count("B")},
    )
    p_markers = [float(cell["cd3"]) for cell in pcells] + [
        float(cell["cd19"]) for cell in pcells
    ]
    bad_p = [
        value for value in p_markers
        if not (at_most_one_decimal(value) and 0.4 <= value <= 9.6)
    ]
    report("pmarkers", not bad_p, "[0.4, 9.6] at most 1 decimal", bad_p)

    pts = np.column_stack([
        np.array([float(cell["cd3"]) for cell in pcells], dtype=float),
        np.array([float(cell["cd19"]) for cell in pcells], dtype=float),
    ])
    if len(pcells) < 2:
        report("psep", False, ">=0.8", "too few")
    else:
        diff = pts[:, None, :] - pts[None, :, :]
        sq = np.sum(diff * diff, axis=-1)
        iu = np.triu_indices(len(pcells), k=1)
        min_sq = float(np.min(sq[iu]))
        report("psep", min_sq + ATOL >= 0.64, ">=0.8", float(np.sqrt(min_sq)))

    eta = float(data["eta"])
    report("eta", close(eta, 0.1), 0.1, eta)
    frames, used = run_perceptron(pcells, eta)
    w_trace = np.vstack(frames)
    for name, col in (("w0_trace", 0), ("w1_trace", 1), ("w2_trace", 2)):
        got = w_trace[:, col]
        stored = data[name]
        report(
            name,
            len(stored) == len(got) == 12 and close(stored, got),
            stored,
            got.tolist(),
        )
    report("updates", data["updates"] == len(used) == 11, data["updates"], len(used))

    def side(cell, weights):
        y = 1.0 if cell["kind"] == "T" else -1.0
        score = float(weights[0] + weights[1] * float(cell["cd3"]) + weights[2] * float(cell["cd19"]))
        return y * score

    bad_steps = [
        (t + 1, pcells[i]["id"], side(pcells[i], frames[t + 1]))
        for t, i in enumerate(used)
        if not side(pcells[i], frames[t + 1]) > 0.0
    ]
    report("update_side", not bad_steps, "y*score>0", bad_steps)
    bad_final = [
        (cell["id"], side(cell, frames[-1]))
        for cell in pcells
        if not side(cell, frames[-1]) > 0.0
    ]
    report("separated", not bad_final, "y*score>0", bad_final)

    if used:
        next_x = [float(pcells[i]["cd3"]) for i in used]
        next_y = [float(pcells[i]["cd19"]) for i in used]
        next_id = [pcells[i]["id"] for i in used]
        next_x = next_x + [next_x[-1]]
        next_y = next_y + [next_y[-1]]
        next_id = next_id + [next_id[-1]]
        has_next = [1] * len(used) + [0]
    else:
        next_x, next_y, next_id, has_next = [], [], [], []
    report(
        "next_x",
        len(data["next_x"]) == len(next_x) == 12 and close(data["next_x"], next_x),
        data["next_x"],
        next_x,
    )
    report(
        "next_y",
        len(data["next_y"]) == len(next_y) == 12 and close(data["next_y"], next_y),
        data["next_y"],
        next_y,
    )
    report(
        "next_id",
        list(data["next_id"]) == next_id and len(next_id) == 12,
        data["next_id"],
        next_id,
    )
    report(
        "has_next",
        list(data["has_next"]) == has_next == [1] * 11 + [0],
        data["has_next"],
        has_next,
    )

    counts = np.zeros(len(pcells), dtype=int)
    for i in used:
        if 0 <= i < len(counts):
            counts[i] += 1
    if len(counts) == 0:
        redo_n, redo_id = 0, None
    else:
        redo_n = int(np.max(counts))
        # argmax returns the first maximum, the earliest cell in a tie.
        redo_id = pcells[int(np.argmax(counts))]["id"]
    report("redo_n", data["redo_n"] == redo_n, data["redo_n"], redo_n)
    report("redo_id", data["redo_id"] == redo_id, data["redo_id"], redo_id)
    report("pseed", type(data["pseed"]) is int, "int", type(data["pseed"]).__name__)

    if failed:
        print("MISMATCH")
        sys.exit(1)
    print("ALL OK")
    sys.exit(0)


if __name__ == "__main__":
    main()
