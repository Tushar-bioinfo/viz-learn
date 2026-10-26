#!/usr/bin/env python3
"""Test the class skill's memory.py and home.py in a throwaway viz-os home (out/memory-home); the real ~/.viz-os is never touched.

Usage: tools/check_memory.py        Prints one line per test, then "memory tests: X/Y ok"; exits 1 if any fails.
"""
import os, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "plugins/viz-os/skills/class/scripts"
FIXTURE = ROOT / "plugins/viz-os/skills/class/examples/home/cells.json"
PROFILE = ROOT / "plugins/viz-os/skills/deck/profile.example.yaml"
HOME = ROOT / "out" / "memory-home"
ENV = {**os.environ, "VIZOS_HOME": str(HOME)}


def run(script, *args):
    p = subprocess.run([sys.executable, SCRIPTS / script, *map(str, args)], capture_output=True, text=True, env=ENV)
    return p.returncode, p.stdout + p.stderr


def tests():
    series = HOME / "series" / "spread.yaml"
    ep = ("episode", "spread", "--part", 1, "--path", "a/lesson.yaml", "--gates", "4/4", "--title", "What")
    run("memory.py", *ep)
    first = series.read_bytes() if series.exists() else b""
    _, out = run("memory.py", *ep)
    yield "episode: a second identical add changes nothing", bool(first) and series.read_bytes() == first and "unchanged" in out
    run("memory.py", "home", "spread", "--name", "cells", "--template", "cells-x-markers", "--seed", 7)
    run("memory.py", "loop", "spread", "why n - 1?")
    before = series.read_bytes()
    run("memory.py", "loop", "spread", "why n - 1?")
    run("memory.py", "home", "spread", "--name", "cells", "--template", "cells-x-markers", "--seed", 7)
    yield "home and loop: reruns change nothing", series.read_bytes() == before and before.count(b"why n - 1?") == 1
    shutil.copy(PROFILE, HOME / "learner.yaml")
    lr = ("learner", "--topic", "variance", "--note", "liked the parts bar", "--date", "2026-10-25", "--home", "home/cells.json")
    run("memory.py", *lr)
    once = (HOME / "learner.yaml").read_text()
    run("memory.py", *lr)
    twice = (HOME / "learner.yaml").read_text()
    kept = [ln for ln in PROFILE.read_text().splitlines() if not ln.startswith("history:")]
    yield "learner: one history line, home set, comments kept, rerun unchanged", (
        once == twice and once.count("topic: variance") == 1 and "home: home/cells.json" in once and all(ln in once for ln in kept))
    a, b = HOME / "a.json", HOME / "b.json"
    for f in (a, b):
        run("home.py", "genes-x-samples", "--name", "counts", "--seed", 11, "-o", f)
    yield "home.py: same template and seed write the same bytes", a.exists() and a.read_bytes() == b.read_bytes()
    code, _ = run("home.py", "--check", FIXTURE)
    yield "cells.json regenerates byte for byte from its seed", code == 0
    run("home.py", "cells-x-markers", "--name", "c", "--seed", 7, "--n", 4, "--markers", "CD3,CD19", "-o", a)
    import json
    d = json.loads(a.read_text())
    yield "cells x markers: one row per cell, one column per marker", (
        d["rows_are"] == "cells" and len(d["values"]) == 4 and all(len(r) == 2 for r in d["values"]) and d["col_ids"] == ["CD3", "CD19"])


def main():
    shutil.rmtree(HOME, ignore_errors=True)
    HOME.mkdir(parents=True)
    results = list(tests())
    for name, ok in results:
        print(f"memory test {name} | {'ok' if ok else 'FAIL'}")
    good = sum(ok for _, ok in results)
    print(f"memory tests: {good}/{len(results)} ok")
    return 0 if good == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
