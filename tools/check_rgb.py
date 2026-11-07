#!/usr/bin/env python3
"""Dots in their true colour: build a small lesson, read the colours the browser drew, and compare them with colours
worked out here from the same numbers, apart from the kit's code.

Usage: tools/check_rgb.py        Outputs: out/rgb-check/ (the lesson, its build log).

Prints one line per test, then "rgb tests: X/Y ok"; exits 1 if any fails, 2 if the lesson did not build or no browser
could start ("not checked"). It covers `rgb: 10` on a point (and its legend dot), `rgb: {r, g, max}` on a points mark
with per-row channels that change under a slider, a value past `max` (clipped), and rounding.
"""
import math, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LESSON = ROOT / "plugins/viz-os/skills/class/scripts/lesson.py"
OUT = ROOT / "out" / "rgb-check"

ROWS = [{"id": "p1", "red": 10, "green": 0, "gain": 0},     # pure red, does not move
        {"id": "p2", "red": 3, "green": 7, "gain": 4},      # green passes max at s = 1: clips
        {"id": "p3", "red": 1, "green": 1, "gain": 2.5}]    # small levels: rounding
SPOT = ("8 + 2 * s", "4 + 4 * s")                          # the point, read as red and green, full at 10
MAX = 10
SLIDER = (0, 0.5, 1)

YAML = f"""title: Dot colours
question: Does each dot take the colour its numbers make?
answer: Yes.
data:
  pixels: {[{k: v for k, v in r.items()} for r in ROWS]}
symbols: {{}}
slides:
  - type: title
  - type: board
    beat: picture
    title: Pixels as dots
    controls:
      - {{name: s, label: gain, min: 0, max: 1, step: 0.5, value: 0}}
    steps:
      - say: 'Each pixel is drawn in the colour its levels make.'
        add:
          plane:
            x: {{label: red level, min: 0, max: 12}}
            y: {{label: green level, min: 0, max: 12}}
            marks:
              - points: {{from: pixels, x: red, y: green, label: id}}
                rgb: {{r: red, g: 'green + gain * s', max: {MAX}}}
              - {{point: ['{SPOT[0]}', '{SPOT[1]}'], rgb: {MAX}, name: p5, label: spot, says: the pixel the gain moves}}
      - say: Move the gain.
  - type: recap
    answer: A dot's colour comes from its numbers.
"""


def byte(level, top):
    """One channel: a straight share of full, clipped to 0..1, then to 0..255 with halves rounded up (as JS Math.round)."""
    share = min(1.0, max(0.0, level / top))
    return int(math.floor(255 * share + 0.5))


def want(s):
    """The colours the page should draw at slider value s: the three rows, then the point."""
    rows = [(byte(r["red"], MAX), byte(r["green"] + r["gain"] * s, MAX), 0) for r in ROWS]
    x, y = 8 + 2 * s, 4 + 4 * s
    return rows + [(byte(x, MAX), byte(y, MAX), 0)]


def rgb_of(css):
    """'rgb(204, 102, 0)' or '#cc6600' -> (204, 102, 0)."""
    css = css.strip()
    if css.startswith("#"):
        return tuple(int(css[i:i + 2], 16) for i in (1, 3, 5))
    return tuple(int(float(v)) for v in css[css.index("(") + 1:css.index(")")].split(",")[:3])


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    src, html = OUT / "lesson.yaml", OUT / "lesson.html"
    src.write_text(YAML)
    html.unlink(missing_ok=True)
    log = subprocess.run([sys.executable, LESSON, src, "-o", html], capture_output=True, text=True)
    (OUT / "build.log").write_text(log.stdout + log.stderr)
    if " 0 errors" not in log.stdout + log.stderr or not html.exists():
        print("rgb tests: the lesson did not build (not checked)")
        return 2
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("rgb tests: no playwright (not checked)")
        return 2
    results = []
    try:
        with sync_playwright() as pw:
            b = pw.chromium.launch()
            page = b.new_page(viewport={"width": 1280, "height": 800})
            page.goto(html.as_uri() + "?check")
            page.wait_for_function("window.VizOS && VizOS.ready === true", timeout=20000)
            page.evaluate("VizOS.go(1, -1)")
            page.wait_for_timeout(300)
            for s in SLIDER:
                page.evaluate(f"VizOS.setControl('s', {s})")
                page.wait_for_timeout(300)
                dots = [rgb_of(f) for f in page.evaluate("[...document.querySelectorAll('#scene-2 svg.pl circle')].map(c => getComputedStyle(c).fill)")]
                legend = page.evaluate("[...document.querySelectorAll('#scene-2 .plegend .pk')].map(e => [e.textContent.trim(), getComputedStyle(e.querySelector('i')).getPropertyValue('--c')])")
                exp = want(s)
                names = [r["id"] for r in ROWS] + ["p5"]
                for n, got, w in zip(names, dots, exp):
                    results.append((f"s = {s}: dot {n} is rgb{w}", got == w, f"drew rgb{got}"))
                if len(dots) != len(exp):
                    results.append((f"s = {s}: {len(exp)} dots", False, f"drew {len(dots)}"))
                key = [rgb_of(c) for t, c in legend if t == "spot"]
                results.append((f"s = {s}: legend dot 'spot' is rgb{exp[-1]}", key == [exp[-1]], f"legend {legend}"))
            b.close()
    except Exception as e:   # no browser: not checked, never passed
        print(f"rgb tests: the browser did not run ({e.__class__.__name__}) (not checked)")
        return 2
    for what, ok, why in results:
        print(f"rgb test {what} | {'ok' if ok else 'FAIL: ' + why}")
    n = sum(ok for _, ok, _ in results)
    print(f"rgb tests: {n}/{len(results)} ok")
    return 0 if n == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
