#!/usr/bin/env python3
"""Build every sketch test case and test it against what it expects.

Usage: tools/check_sketch.py [name ...]      Outputs: out/sketch-cases/<name>.html, .log and the check folder.

Each tools/sketch-cases/<name>.yaml says what it expects in "# expect:" lines at the top:
  clean        the build has 0 errors and 0 warnings, and the browser check 0 warnings
  builds       the build has 0 errors and the browser check 0 warnings (page-shape warnings allowed: a fragment)
  not: TEXT    TEXT appears nowhere in the build or check output
  TEXT         TEXT appears in the build or check output, or in the page's numbers.txt
A case with a "# base: NAME" line holds only `sheets`, `data` and `derive`: they join that full page, after its first sheet,
so a rule the browser checks can be tested on one sheet without repeating the whole page.
The browser check runs only when the build output alone cannot settle the case.
Prints a line per failure and the count; exit 0 when all pass.
"""
import subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "plugins/viz-os/skills/deck/scripts"))
import build as B
import yaml
CASES = ROOT / "tools" / "sketch-cases"
SKETCH = ROOT / "plugins/viz-os/skills/sketch/scripts/sketch.py"
CHECK = ROOT / "plugins/viz-os/skills/deck/scripts/check.py"
OUT = ROOT / "out" / "sketch-cases"


def expects(path):
    return [ln[len("# expect:"):].strip() for ln in path.read_text().splitlines() if ln.startswith("# expect:")]


def page_for(path):
    base = [ln.split(":", 1)[1].strip() for ln in path.read_text().splitlines() if ln.startswith("# base:")]
    if not base:
        return path
    page, add = B.load(CASES / f"{base[0]}.yaml"), B.load(path)
    page["sheets"][1:1] = add["sheets"]
    for key in ("data", "derive", "abbr"):
        page.setdefault(key, {}).update(add.get(key) or {})
    joined = OUT / f"{path.stem}.page.yaml"
    joined.write_text(yaml.safe_dump(page, sort_keys=False, allow_unicode=True))
    return joined


def run(path):
    name, want = path.stem, expects(path)
    if not want:
        return name, "no `# expect:` lines"
    html = OUT / f"{name}.html"
    html.unlink(missing_ok=True)
    log = subprocess.run([sys.executable, SKETCH, page_for(path), "-o", html], capture_output=True, text=True)
    text = log.stdout + log.stderr
    built = " 0 errors" in text
    pos = [w for w in want if w not in ("clean", "builds") and not w.startswith("not:")]
    if html.exists() and ({"clean", "builds"} & set(want) or any(w.startswith("not:") for w in want) or any(w not in text for w in pos)):
        chk = subprocess.run([sys.executable, CHECK, html, "--out", OUT / name], capture_output=True, text=True)
        text += chk.stdout + chk.stderr
        nums = OUT / name / "numbers.txt"
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
    bad = [(n, r) for n, r in results if r != "ok"]
    for n, r in bad:
        print(f"sketch case {n} | {r}")
    print(f"sketch cases: {len(results) - len(bad)}/{len(results)} ok")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
