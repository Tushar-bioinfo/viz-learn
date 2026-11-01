#!/usr/bin/env python3
"""Test the class skill's tidy.py on a copy of a built example, in a throwaway home (out/tidy-home); the real ~/.viz-os is never touched.

Usage: tools/check_tidy.py        Prints one line per test, then "tidy tests: X/Y ok"; exits 1 if any fails.
"""
import json, os, re, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLASS = ROOT / "plugins/viz-os/skills/class"
TIDY = CLASS / "scripts/tidy.py"
LESSON = CLASS / "scripts/lesson.py"
EXAMPLE = CLASS / "examples/board-gallery"     # it has data, an image, and a make_data.py that reads ../home
WORK = ROOT / "out" / "tidy-home"
ENV = {**os.environ, "VIZOS_HOME": str(WORK / "home")}
THERE = ["cells.png", "data.json", "make_data.py", "verify_data.py"]


def run(*args, script=TIDY):
    p = subprocess.run([sys.executable, script, *map(str, args)], capture_output=True, text=True, env=ENV)
    return p.returncode, p.stdout + p.stderr


def fresh():
    """A built lesson in a folder of its own, with a snaps folder, a __pycache__ and a file tidy does not know."""
    f = WORK / "lessons" / "gallery"
    shutil.rmtree(WORK, ignore_errors=True)
    shutil.copytree(EXAMPLE, f, ignore=shutil.ignore_patterns("lesson.html"))
    (f / "snaps").mkdir(); (f / "snaps/desktop.png").write_bytes(b"png")
    (f / "__pycache__").mkdir(); (f / "__pycache__/x.pyc").write_bytes(b"pyc")
    (f / "my-notes.txt").write_text("mine\n")
    code, out = run(f / "lesson.yaml", "--quiet", script=LESSON)
    assert code == 0, out
    return f


def listing(f):
    return sorted(str(p.relative_to(f)) for p in f.rglob("*") if p.is_file())


def attic():
    return sorted((WORK / "home/attic").glob("*"))


def tests():
    f = fresh()
    before = listing(f)
    code, out = run(f, "--dry-run")
    yield "--dry-run prints the moves and changes nothing", code == 0 and "would move data.json" in out and listing(f) == before and not attic()

    code, out = run(f)
    yield "tidy keeps the page, the yaml and the unknown file", code == 0 and listing(f) == ["lesson.html", "lesson.yaml", "my-notes.txt"]
    yield "tidy lists what it left alone", "left alone: my-notes.txt" in out
    box = attic()[0] if attic() else WORK
    yield "tidy moves every known file to attic/<slug>-<date>", re.fullmatch(r"gallery-\d{4}-\d\d-\d\d", box.name) is not None and all((box / n).is_file() for n in [*THERE, "snaps/desktop.png", "__pycache__/x.pyc"])

    code, out = run(f / "lesson.yaml", script=LESSON)
    yield "a build with the data gone names --restore", code != 0 and "--restore" in out and "data.json" in out

    (f / "make_data.py").write_text("# a new one\n")
    code, out = run(f, "--restore")
    yield "--restore never overwrites a file", code != 0 and "make_data.py" in out and (f / "make_data.py").read_text() == "# a new one\n" and (box / "data.json").is_file()
    (f / "make_data.py").unlink()
    code, out = run(f, "--restore", "--dry-run")
    yield "--restore --dry-run changes nothing", code == 0 and not (f / "data.json").exists()
    code, out = run(f, "--restore")
    yield "--restore brings every file back", code == 0 and listing(f) == before and not attic()
    code, out = run(f / "lesson.yaml", "--quiet", script=LESSON)
    yield "the lesson builds again after --restore", code == 0

    run(f, "--keep", "make_data.py")
    yield "--keep spares a file", (f / "make_data.py").is_file() and not (f / "data.json").exists()
    run(f, "--restore")

    run(f)
    first = attic()[0]
    run(f, "--restore")
    first.mkdir(parents=True); (first / "stale.txt").write_text("an earlier tidy\n")
    run(f)
    yield "a second tidy the same day keeps both", (first / "stale.txt").is_file() and first.with_name(first.name + "-2").is_dir()
    run(f, "--restore")
    yield "--restore takes the newest", listing(f) == before and (first / "stale.txt").is_file()

    f = fresh()
    (f / "lesson.html").write_text("")
    code, out = run(f)
    yield "refuses an empty lesson.html", code != 0 and "refused" in out and (f / "data.json").exists()
    (f / "lesson.html").unlink()
    code, out = run(f)
    yield "refuses with no lesson.html", code != 0 and "refused" in out and (f / "data.json").exists()

    f = fresh()
    os.utime(f / "lesson.html", (1, 1))
    code, out = run(f)
    yield "refuses a lesson.html older than the yaml", code != 0 and "older" in out and (f / "data.json").exists()

    f = fresh()
    page = (f / "lesson.html").read_text()
    (f / "lesson.html").write_text(re.sub(r"window\.VIZOS_DATA=.*?;</script>", "</script>", page, flags=re.S))
    code, out = run(f)
    yield "refuses a page without its data", code != 0 and "does not hold its data" in out and (f / "data.json").exists()

    f = fresh()
    d = json.loads((f / "data.json").read_text()); d["n"] = d["n"] + 1
    (f / "data.json").write_text(json.dumps(d))
    code, out = run(f)
    yield "refuses a page built from older data", code != 0 and "data now in" in out and (f / "make_data.py").exists()

    f = fresh()
    page = (f / "lesson.html").read_text()
    (f / "lesson.html").write_text(re.sub(r'"cells\.png":\s*"[^"]*"', '"other.png":"x"', page))
    code, out = run(f)
    yield "refuses a page without its image", code != 0 and "cells.png" in out and (f / "cells.png").exists()

    made = sorted(p.name for p in EXAMPLE.iterdir())
    code, out = run(EXAMPLE)
    yield "refuses inside the plugin's skills folder", code != 0 and "regression tests" in out and sorted(p.name for p in EXAMPLE.iterdir()) == made

    f = fresh()
    doc = (f / "lesson.yaml").read_text().replace("data_file: data.json", "data_file: ../outside.json")
    (f.parent / "outside.json").write_text((f / "data.json").read_text())
    (f / "lesson.yaml").write_text(doc)
    run(f / "lesson.yaml", "--quiet", script=LESSON); run(f)
    yield "a data file outside the folder stays where it is", (f.parent / "outside.json").exists()


def main():
    res = []
    for name, ok in tests():
        res.append(ok)
        print(f"tidy test {name} | {'ok' if ok else 'FAIL'}")
    print(f"tidy tests: {sum(res)}/{len(res)} ok")
    return 0 if all(res) else 1


if __name__ == "__main__":
    sys.exit(main())
