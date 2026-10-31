#!/usr/bin/env python3
"""Measure each sketch paper's inks: the method in design.md's colour row, rebuilt for the papers.

Usage: python3 tools/check_palette.py [--no-pixels] [--css FILE]

Colours come from sketch/kit/sketch.css. Text and marks are judged against real paper: a Chromium run of paper.js
gives the grain's lightest and darkest pixels (--no-pixels, or no Playwright, uses the flat paper colour and says so).
Bars (the dark look's numbers, design.md):
  text, soft text and the four data colours  WCAG 4.5:1 on the worst grain
  thread colours (gold, red, pale)           WCAG 3:1 on the worst grain (a thick mark, and it has an edge)
  accent + three series, every pair          dE00 >= 31.5 normal, >= 15.9 protan and deutan, >= 10.7 tritan
  gold vs red                                the same three bars: they carry method against break
Prints a table per paper and OK, or names the failing pair and exits 1.
"""
import argparse, itertools, math, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSS = ROOT / "plugins/viz-os/skills/sketch/kit/sketch.css"
PAPERS = ("cream", "graph", "navy")
TEXT = ("ink", "soft", "accent", "s1", "s2", "s3")
THREAD = ("gold", "red", "pale")
DATA = ("accent", "s1", "s2", "s3")
BARS = {"normal": 31.5, "protan": 15.9, "deutan": 15.9, "tritan": 10.7}
# Machado, Oliveira & Fernandes 2009, severity 1.0, linear RGB
MACHADO = {
    "protan": ((0.152286, 1.052583, -0.204868), (0.114503, 0.786281, 0.099216), (-0.003882, -0.048116, 1.051998)),
    "deutan": ((0.367322, 0.860646, -0.227968), (0.280085, 0.672501, 0.047413), (-0.011820, 0.042940, 0.968881)),
    "tritan": ((1.255528, -0.076749, -0.178779), (-0.078411, 0.930809, 0.147602), (0.004733, 0.691367, 0.303900)),
}


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lin(v):
    v /= 255
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4


def unlin(v):
    v = max(0, min(1, v))
    return 255 * (12.92 * v if v <= .0031308 else 1.055 * v ** (1 / 2.4) - .055)


def lum(c):
    return .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2])


def contrast(a, b):
    x, y = sorted((lum(a), lum(b)), reverse=True)
    return (x + .05) / (y + .05)


def lab(c):
    r, g, b = (lin(v) for v in c)
    X = (.4124564 * r + .3575761 * g + .1804375 * b) / .95047
    Y = .2126729 * r + .7151522 * g + .0721750 * b
    Z = (.0193339 * r + .1191920 * g + .9503041 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116
    return 116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))


def de00(l1, l2):
    L1, a1, b1 = l1
    L2, a2, b2 = l2
    C = (math.hypot(a1, b1) + math.hypot(a2, b2)) / 2
    G = .5 * (1 - math.sqrt(C ** 7 / (C ** 7 + 25 ** 7)))
    a1, a2 = a1 * (1 + G), a2 * (1 + G)
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    h1 = math.degrees(math.atan2(b1, a1)) % 360 if C1 else 0
    h2 = math.degrees(math.atan2(b2, a2)) % 360 if C2 else 0
    dL, dC = L2 - L1, C2 - C1
    dh = 0 if C1 * C2 == 0 else h2 - h1
    if C1 * C2 and abs(dh) > 180:
        dh -= 360 * math.copysign(1, dh)
    dH = 2 * math.sqrt(C1 * C2) * math.sin(math.radians(dh) / 2)
    Lm, Cm = (L1 + L2) / 2, (C1 + C2) / 2
    if C1 * C2 == 0:
        hm = h1 + h2
    elif abs(h1 - h2) <= 180:
        hm = (h1 + h2) / 2
    else:
        hm = (h1 + h2 + 360) / 2 if h1 + h2 < 360 else (h1 + h2 - 360) / 2
    T = 1 - .17 * math.cos(math.radians(hm - 30)) + .24 * math.cos(math.radians(2 * hm)) + .32 * math.cos(math.radians(3 * hm + 6)) - .2 * math.cos(math.radians(4 * hm - 63))
    dT = 30 * math.exp(-((hm - 275) / 25) ** 2)
    Rc = 2 * math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7))
    Sl = 1 + .015 * (Lm - 50) ** 2 / math.sqrt(20 + (Lm - 50) ** 2)
    Sc, Sh = 1 + .045 * Cm, 1 + .015 * Cm * T
    Rt = -math.sin(math.radians(2 * dT)) * Rc
    return math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh))


def sim(c, kind):
    if kind == "normal":
        return c
    v = [lin(x) for x in c]
    return tuple(unlin(sum(m * x for m, x in zip(row, v))) for row in MACHADO[kind])


def pair(a, b):
    return {k: de00(lab(sim(a, k)), lab(sim(b, k))) for k in BARS}


def palettes(css):
    text = Path(css).read_text()
    out = {}
    for p in PAPERS:
        m = re.search(r"\.paper-" + p + r"\s*\{([^}]*)\}", text)
        if m:
            out[p] = {k: rgb(v) for k, v in re.findall(r"--([a-z0-9]+):\s*(#[0-9a-fA-F]{6})", m.group(1))}
    return out


def grain():
    """The paper's real pixels: the 2% and 98% points of a small sheet's lightness (flecks and grid lines are thin, and text does not sit on one pixel) drawn by paper.js."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return None
    kit = ROOT / "plugins/viz-os/skills/sketch/kit"
    js = """() => { const K = VizOS.sketch, out = {};
      for (const paper of %s) { const S = K.sheet({ id: 'p', w: 80, h: 50, ppm: 6, paper, seed: 'palette' }), n = S.W * S.H, L = [];
        const lum = c => c.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
        for (let i = 0; i < n; i++) { const [r, g, b] = lum([S.paper0[3*i], S.paper0[3*i+1], S.paper0[3*i+2]]); L.push([.2126*r + .7152*g + .0722*b, i]); }
        L.sort((a, b) => a[0] - b[0]); const at = q => { const i = L[Math.floor(q * (n - 1))][1]; return [S.paper0[3*i], S.paper0[3*i+1], S.paper0[3*i+2]]; };
        out[paper] = [at(.02), at(.98)]; }
      return out; }""" % list(PAPERS)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page()
            pg.set_content("<!doctype html><body></body>")
            for f in ("paper.js", "pens.js"):
                pg.add_script_tag(path=str(kit / f))
            r = pg.evaluate(js)
            b.close()
            return {k: [tuple(v[0]), tuple(v[1])] for k, v in r.items()}
    except Exception as e:
        print(f"palette: real pixels not sampled ({str(e).splitlines()[0]})")
        return None


def measure(pal, gr, flat):
    """Failures and the printed rows for one paper."""
    bad, rows = [], []
    worst = gr or [flat, flat]
    on = lambda c: min(contrast(c, x) for x in worst)
    for k in TEXT:
        r = on(pal[k])
        rows.append(f"  {k:7s} {r:5.2f}:1 (needs 4.5)")
        if r < 4.5:
            bad.append(f"{k} on paper {r:.2f}:1 < 4.5")
    for k in THREAD:
        r = on(pal[k])
        rows.append(f"  {k:7s} {r:5.2f}:1 (needs 3.0)")
        if r < 3:
            bad.append(f"{k} on paper {r:.2f}:1 < 3")
    for a, b in itertools.chain(itertools.combinations(DATA, 2), [("gold", "red")]):
        d = pair(pal[a], pal[b])
        rows.append(f"  {a:7s}{b:7s} " + "  ".join(f"{k} {v:5.1f}" for k, v in d.items()))
        bad += [f"{a} vs {b} {k} {d[k]:.1f} < {BARS[k]}" for k in BARS if d[k] < BARS[k]]
    return bad, rows


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-pixels", action="store_true")
    ap.add_argument("--css", default=CSS)
    a = ap.parse_args()
    s = de00((50, 2.6772, -79.7751), (50, 0, -82.7485))
    if abs(s - 2.0425) > 5e-4:
        print(f"palette: dE00 code is wrong: Sharma pair 1 = {s:.4f}, not 2.0425")
        return 1
    pals = palettes(a.css)
    gr = None if a.no_pixels else grain()
    if gr is None:
        print("palette: flat paper colours only (grain not sampled)")
    fail = 0
    for p in PAPERS:
        if p not in pals:
            print(f"{p}: FAIL no .paper-{p} block in {a.css}")
            fail = 1
            continue
        bad, rows = measure(pals[p], gr and gr[p], pals[p]["paper"])
        print(f"{p}" + (f"  grain {gr[p][0]} .. {gr[p][1]}" if gr else ""))
        print("\n".join(rows))
        for b in bad:
            print(f"  FAIL {b}")
        print("  OK" if not bad else f"  FAIL {len(bad)}")
        fail |= bool(bad)
    return fail


if __name__ == "__main__":
    sys.exit(main())
