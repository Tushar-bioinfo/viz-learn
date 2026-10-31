#!/usr/bin/env python3
"""Build every sketch test case and test it against what it expects.

Usage: tools/check_sketch.py [name ...]      Outputs: out/sketch-cases/<name>.html, .log and the check folder.

Each tools/sketch-cases/<name>.yaml says what it expects in "# expect:" lines at the top:
  clean        the build has 0 errors and 0 warnings, and the browser check 0 warnings
  builds       the build has 0 errors and the browser check 0 warnings (page-shape warnings allowed: a fragment)
  not: TEXT    TEXT appears nowhere in the build or check output
  TEXT         TEXT appears in the build or check output, or in the page's numbers.txt
A case with a "# base: NAME" line holds only `sheets`, `data`, `derive` and the series keys: they join that full page, after
its first sheet, so a rule can be tested on one sheet without repeating the whole page.
The browser check runs only when the build output alone cannot settle the case.
A full run adds four tests: recall cards open a page, anchors turn with a part, a bare copy of the plugin builds the same
bytes, and a copy with no `class` beside `sketch` says so.
Prints a line per failure and the counts; exit 0 when all pass.
"""
import filecmp, math, re, shutil, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "plugins/viz-os/skills/deck/scripts"))
import build as B
import yaml
CASES = ROOT / "tools" / "sketch-cases"
PLUGIN = ROOT / "plugins/viz-os"
SKETCH = PLUGIN / "skills/sketch/scripts/sketch.py"
CHECK = PLUGIN / "skills/deck/scripts/check.py"
OUT = ROOT / "out" / "sketch-cases"


def expects(path):
    return [ln[len("# expect:"):].strip() for ln in path.read_text().splitlines() if ln.startswith("# expect:")]


def page_for(path):
    base = [ln.split(":", 1)[1].strip() for ln in path.read_text().splitlines() if ln.startswith("# base:")]
    if not base:
        return path
    page, add = B.load(CASES / f"{base[0]}.yaml"), B.load(path)
    page["sheets"][1:1] = add.get("sheets") or []
    for key in ("data", "derive", "abbr"):
        page.setdefault(key, {}).update(add.get(key) or {})
    page.update({k: add[k] for k in ("series", "episode") if k in add})
    if "recall" in add:   # the joined page sits in out/, so the case's relative path would no longer reach
        page["recall"] = str((path.parent / add["recall"]).resolve())
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


def in_browser(case, read):
    """What `read(page)` returns on a case's built page."""
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1240, "height": 900})
        pg.goto((OUT / f"{case}.html").as_uri() + "?check")
        pg.wait_for_function("window.VizOS && VizOS.ready", timeout=30000)
        out = read(pg)
        b.close()
    return out


def recall_opens(case, ask):
    """The earlier page's card question sits on the first sheet of this one."""
    return ask in in_browser(case, lambda pg: pg.evaluate("VizOS.slides[0].r.node.textContent"))


def anchors_turn():
    """A turned part's anchors are the flat part's, turned by hand about the centre."""
    def read(pg):
        i = pg.evaluate("VizOS.slides.findIndex(s => s.title === 'Turned parts' || (s.s && s.s.title === 'Turned parts'))")
        pg.evaluate(f"VizOS.go({i},-1)")
        pg.wait_for_timeout(400)
        return pg.evaluate(f"VizOS.slides[{i}].anchors")
    A, off = in_browser("turned-parts", read), []
    for flat, turned, deg in (("a", "b", 90), ("c", "d", 30)):
        c0, c1, r = A[f"{flat}.center"], A[f"{turned}.center"], math.radians(deg)
        names = [k.split(".", 1)[1] for k in A if k.startswith(flat + ".")]
        for n in set(names) - {"top", "bottom", "left", "right"}:   # the sides stay the turned box's own
            dx, dy = A[f"{flat}.{n}"][0] - c0[0], A[f"{flat}.{n}"][1] - c0[1]
            got = A[f"{turned}.{n}"]
            if math.hypot(c1[0] + dx * math.cos(r) - dy * math.sin(r) - got[0], c1[1] + dx * math.sin(r) + dy * math.cos(r) - got[1]) > 1e-6:
                off.append(f"{turned}.{n}")
    return off


def bare_copy():
    """The plugin alone, in a folder that holds nothing else: same bytes as the repo, and a missing sibling is named."""
    with tempfile.TemporaryDirectory() as tmp:
        skills = Path(tmp) / "plugins/viz-os/skills"
        shutil.copytree(PLUGIN, skills.parent, ignore=shutil.ignore_patterns("snaps", "__pycache__", "page.html"))
        ex = "sketch/examples/pca-what/page.yaml"
        subprocess.run([sys.executable, skills / "sketch/scripts/sketch.py", skills / ex, "--quiet"], capture_output=True)
        here = OUT / "pca-what-repo.html"
        subprocess.run([sys.executable, SKETCH, PLUGIN / "skills" / ex, "-o", here, "--quiet"], capture_output=True)
        made = (skills / ex).with_suffix(".html")
        same = made.exists() and filecmp.cmp(made, here, shallow=False)
        shutil.rmtree(skills / "class")
        r = subprocess.run([sys.executable, skills / "sketch/scripts/sketch.py", skills / ex], capture_output=True, text=True)
    return same, r.returncode != 0 and "class skill is missing" in r.stderr


def powers():
    """A negative number raised to a power keeps its brackets: -3.8^2 is a different sum."""
    def read(pg):
        i = pg.evaluate("VizOS.slides.findIndex(s => s.title === 'Square a difference' || (s.s && s.s.title === 'Square a difference'))")
        pg.evaluate(f"VizOS.go({i},-1)")
        pg.wait_for_timeout(400)
        return pg.evaluate("[...document.querySelectorAll('.asm .nums .tx')].map(e => e.dataset.tex).join(' ')")
    return re.search(r"\(\S*3\.8\)\^", in_browser("negative-power", read)) is not None


def tests():
    yield "recall from a page opens with its card", recall_opens("recall-page", "What did the first page follow?")
    yield "recall from a lesson opens with its card", recall_opens("recall-lesson", "What did the first lesson follow?")
    off = anchors_turn()
    yield f"anchors turn with their part{' (off: ' + ', '.join(off) + ')' if off else ''}", not off
    yield "a negative number keeps its brackets under a power", powers()
    same, named = bare_copy()
    yield "a bare copy of the plugin builds the PCA page to the same bytes", same
    yield "a copy with no class skill says so", named


def main(names):
    OUT.mkdir(parents=True, exist_ok=True)
    paths = sorted(CASES.glob("*.yaml")) if not names else [CASES / f"{n.removesuffix('.yaml')}.yaml" for n in names]
    with ThreadPoolExecutor(4) as pool:
        results = list(pool.map(run, paths))
    bad = [(n, r) for n, r in results if r != "ok"]
    for n, r in bad:
        print(f"sketch case {n} | {r}")
    print(f"sketch cases: {len(results) - len(bad)}/{len(results)} ok")
    if names:
        return 1 if bad else 0
    done = list(tests())
    for name, ok in done:
        print(f"sketch test {name} | {'ok' if ok else 'FAIL'}")
    good = sum(ok for _, ok in done)
    print(f"sketch tests: {good}/{len(done)} ok")
    return 1 if bad or good < len(done) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
