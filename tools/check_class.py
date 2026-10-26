#!/usr/bin/env python3
"""Build every class test case and test it against what it expects.

Usage: tools/check_class.py [name ...]      Outputs: out/class-cases/<name>.html, .log and the check folder.

Each tools/class-cases/<name>.yaml says what it expects in "# expect:" lines at the top:
  clean        the build has 0 errors and 0 warnings, and the browser check 0 warnings
  builds       the build has 0 errors and the browser check 0 warnings (lesson-shape warnings allowed: a fragment)
  not: TEXT    TEXT appears nowhere in the build or check output
  TEXT         TEXT appears in the build or check output, or in the page's numbers.txt (e.g. "slide 2: The mean was 7.9")
The browser check runs only when the build output alone cannot settle the case.
"""
import subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CASES = ROOT / "tools" / "class-cases"
LESSON = ROOT / "plugins/viz-os/skills/class/scripts/lesson.py"
CHECK = ROOT / "plugins/viz-os/skills/deck/scripts/check.py"
OUT = ROOT / "out" / "class-cases"


def expects(path):
    return [ln[len("# expect:"):].strip() for ln in path.read_text().splitlines() if ln.startswith("# expect:")]


def run(path):
    name, want = path.stem, expects(path)
    if not want:
        return name, "no `# expect:` lines"
    html = OUT / f"{name}.html"
    html.unlink(missing_ok=True)
    log = subprocess.run([sys.executable, LESSON, path, "-o", html], capture_output=True, text=True)
    text = log.stdout + log.stderr
    built = " 0 errors" in text
    pos = [w for w in want if w not in ("clean", "builds") and not w.startswith("not:")]
    if html.exists() and ({"clean", "builds"} & set(want) or any(w.startswith("not:") for w in want) or any(w not in text for w in pos)):
        chk = subprocess.run([sys.executable, CHECK, html, "--out", OUT / name], capture_output=True, text=True)
        text += chk.stdout + chk.stderr
        nums = OUT / name / "numbers.txt"   # the text each slide shows, numbers formatted, as the browser drew it
        text += "\n" + nums.read_text() if nums.exists() else ""
    (OUT / f"{name}.log").write_text(text)
    checked = "\ncheck: 0 warnings" in "\n" + text
    for w in want:
        if w == "clean" and not (" 0 errors  0 warnings" in text and checked):
            return name, "not clean"
        if w == "builds" and not (built and checked):
            return name, "does not build clean"
        if w.startswith("not:") and w[4:].strip() in text:
            return name, f"unwanted: {w[4:].strip()}"
        if w in pos and w not in text:
            return name, f"missing: {w}"
    return name, "ok"


def main(names):
    OUT.mkdir(parents=True, exist_ok=True)
    paths = sorted(CASES.glob("*.yaml")) if not names else [CASES / f"{n.removesuffix('.yaml')}.yaml" for n in names]
    with ThreadPoolExecutor(4) as pool:
        results = list(pool.map(run, paths))
    for name, r in results:
        print(f"class case {name} | {r}")
    bad = [n for n, r in results if r != "ok"]
    print(f"class cases: {len(results) - len(bad)}/{len(results)} ok")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
