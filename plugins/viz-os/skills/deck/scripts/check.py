#!/usr/bin/env python3
"""Check a built viz-os deck in a real browser, on a desktop and a phone screen.

Usage: check.py deck.html [--out DIR] [--only desktop|phone] [--slides 3,5-7] [--vendor DIR] [--all-steps]

For every slide and every build step it reports text that overlaps, leaves the slide, hides under the
navigation, renders too small, or overflows its box; content shrunk below 80%; formula and expression errors;
charts that did not draw; worked lines that read ≈ (their rounded numbers do not give the result shown).
It moves every slider to both ends, opens every predict answer and audits the slide again ("after the answer"),
and measures text contrast on the real pixels (labels over chart marks are where legibility fails). The check
runs with animations off; it then re-fits every slide with them on and reports any slide a viewer would see
shrunk differently.
Contact sheets: <out>/desktop.png, <out>/phone.png. Every visible line that holds a digit, per slide (all steps
shown, answers open): <out>/numbers.txt, to check the deck's numbers against an independent recompute.
Exit 0 = clean, 1 = warnings, 2 = could not run (say "not checked").
--vendor DIR serves cdnjs and Google Fonts files from DIR (offline machines): DIR/katex/katex.min.js etc.
"""
import argparse, json, os, re, sys
from pathlib import Path

VIEWS = {"desktop": (1440, 900), "phone": (390, 844)}
HIDE_TEXT = ("/*hide-text*/ :root body .slide.on, :root body .slide.on * { color: transparent !important; -webkit-text-fill-color: transparent !important; caret-color: transparent !important; text-decoration-color: transparent !important; }"
             " .slide.on svg text { fill: transparent !important; } .slide.on mark.hi { background: none !important; }")
# the visible lines with a digit on slide i (KaTeX keeps a hidden MathML copy of each formula: leave it out)
NUMBERS = """(i) => { const n = VizOS.slides[i].r.node, st = document.createElement('style'), seen = new Set();
  st.textContent = '.katex-mathml{display:none!important}'; document.head.appendChild(st);
  const ticks = [...n.querySelectorAll('svg text')].map(e => e.textContent).filter(x => /\\d/.test(x)).join(' · ');
  const t = n.innerText + (ticks ? '\\nchart: ' + ticks : ''); st.remove();
  return t.split('\\n').map(x => x.replace(/\\s+/g, ' ').trim()).filter(x => /\\d/.test(x) && x.length > 1 && !seen.has(x) && seen.add(x)); }"""


def launch(p):
    errs = []
    for kw in ({}, {"channel": "chrome"}, {"executable_path": os.environ.get("VIZOS_CHROMIUM") or "/opt/pw-browsers/chromium"}):
        if "executable_path" in kw and not Path(kw["executable_path"]).exists():
            continue
        try:
            return p.chromium.launch(**kw)
        except Exception as e:  # try the next way to find a browser
            errs.append(str(e).splitlines()[0])
    raise RuntimeError("no Chromium found: run `playwright install chromium` (" + " | ".join(errs) + ")")


def vendor_route(vdir):
    vdir = Path(vdir)
    def handler(route):
        url = route.request.url
        m = re.search(r"/KaTeX/[\d.]+/(.+)$", url)
        f = vdir / "katex" / m.group(1) if m else None
        if f and f.exists():
            ct = {"js": "application/javascript", "css": "text/css", "woff2": "font/woff2", "woff": "font/woff", "ttf": "font/ttf"}.get(f.suffix[1:], "application/octet-stream")
            return route.fulfill(path=str(f), content_type=ct)
        return route.abort()
    return handler


def settle(page):
    """Wait until the deck has finished laying out the current slide (labels, fit, redraw).
    A font that finishes loading (KaTeX loads its fonts per glyph style) starts a fresh layout, so wait for the
    fonts too, twice: the layout it starts is only queued once the load is done."""
    page.wait_for_timeout(40)
    for _ in range(2):
        try:
            page.wait_for_function("window.VizOS && VizOS.busy === 0 && (!document.fonts || document.fonts.status === 'loaded')", timeout=3000)
        except Exception:
            pass
        page.wait_for_timeout(30)


def parse_slides(spec, n):
    if not spec:
        return list(range(n))
    out = set()
    for part in spec.split(","):
        a, _, b = part.partition("-")
        out.update(range(int(a) - 1, int(b or a)))
    return sorted(i for i in out if 0 <= i < n)


def contrast_issues(png, bgpng, boxes, dpr):
    """Contrast of each text against the pixels around its letters: bgpng is the same frame with all text made transparent.
    The letters are where the two frames differ; the background is read in the pixels touching them, so a cell
    border or a chart line that passes near the text without touching it does not count."""
    try:
        from PIL import Image, ImageChops, ImageFilter
    except ImportError:
        return None
    fgim, im = Image.open(png).convert("RGB"), Image.open(bgpng).convert("RGB")
    W, H = im.size
    def lum(c):
        def ch(v):
            v /= 255
            return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
        r, g, b = c
        return .2126 * ch(r) + .7152 * ch(g) + .0722 * ch(b)
    out = []
    for b in boxes:
        m = re.match(r"rgba?\((\d+),\s*(\d+),\s*(\d+)", b["color"])
        if not m:
            continue
        fg = tuple(int(x) for x in m.groups())
        lf, ratio = lum(fg), None
        for rx, ry, rw, rh in b.get("rects") or [[b["x"], b["y"], b["w"], b["h"]]]:   # each line of the text on its own
            x0, y0, x1, y1 = [int(round(v * dpr)) for v in (rx, ry, rx + rw, ry + rh)]
            x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
            if x1 - x0 < 3 or y1 - y0 < 3:
                continue
            back, front = im.crop((x0, y0, x1, y1)), fgim.crop((x0, y0, x1, y1))
            near = ImageChops.difference(front, back).convert("L").point(lambda v: 255 if v > 24 else 0).filter(ImageFilter.MaxFilter(3)).load()
            bpx = back.load()
            pts = [bpx[x, y] for x in range(back.width) for y in range(back.height) if near[x, y]]
            if len(pts) < 6:   # no letters found (text the colour of its background): judge the whole box
                pts = [bpx[x, y] for x in range(0, back.width, 2) for y in range(0, back.height, 2)]
            if len(pts) < 6:
                continue
            pts.sort(key=lambda c: abs(lum(c) - lf))
            bg = pts[int(len(pts) * .08)]        # the 8% of background most like the text colour: the worst patch, not the average
            lb = lum(bg)
            r = (max(lf, lb) + .05) / (min(lf, lb) + .05)
            ratio = r if ratio is None else min(ratio, r)
        if ratio is None:
            continue
        need = 3.0 if b["size"] >= 24 or (b["size"] >= 18.6 and b["weight"] >= 650) else 4.5   # WCAG large text: 18pt, or 14pt bold
        if ratio < need:
            out.append((ratio, need, b["text"]))
    return out


def sheet(page, shots, path, cols, w, h):
    rows = (len(shots) + cols - 1) // cols
    imgs = "".join(f'<figure style="margin:6px;display:inline-block;position:relative"><img src="{Path(f).as_uri()}" style="width:{w}px;height:{h}px;display:block;border-radius:8px">'
                   f'<figcaption style="position:absolute;left:8px;top:6px;font:600 15px system-ui;color:#fff;background:rgba(0,0,0,.55);padding:2px 8px;border-radius:6px">{lab}</figcaption></figure>'
                   for f, lab in shots)
    tmp = Path(path).with_suffix(".tmp.html")
    tmp.write_text(f'<body style="margin:0;background:#0a0f2e;width:{cols * (w + 12)}px">{imgs}</body>')
    page.set_viewport_size({"width": cols * (w + 12), "height": rows * (h + 12)})
    page.goto(tmp.as_uri())
    page.wait_for_timeout(250)
    page.screenshot(path=str(path), full_page=True)
    tmp.unlink()


ZOOM = "(VizOS.slides[VizOS.i].zoom || 1)"


def run_view(br, deck, view, out, args, report):
    W, H = VIEWS[view]
    ctx = br.new_context(viewport={"width": W, "height": H}, device_scale_factor=1)
    if args.vendor:
        ctx.route(re.compile(r"https://cdnjs\.cloudflare\.com/.*"), vendor_route(args.vendor))
    page = ctx.new_page()
    console = []
    page.on("console", lambda m: console.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console.append(str(e)))
    page.goto(deck.as_uri() + "?check")
    try:
        page.wait_for_function("window.VizOS && VizOS.ready === true", timeout=20000)
    except Exception:
        report.append((view, 0, "deck did not start: " + " | ".join(console[:3])))
        return []
    page.wait_for_timeout(300)
    if not page.evaluate("!!window.katex") and page.evaluate("document.querySelectorAll('.tex-fallback').length"):
        report.append((view, 0, "KaTeX did not load: formulas show as plain text (offline? use --vendor or --katex-dir)"))
    info = page.evaluate("VizOS.info()")
    shots, zooms, nums = [], {}, []
    for i in parse_slides(args.slides, info["n"]):
        s = info["slides"][i]
        lo = 1 if s["steps"] > 0 else 0
        steps = range(lo, s["steps"] + 1) if args.all_steps or True else [s["steps"]]
        for k in steps:
            page.evaluate(f"VizOS.go({i},{k})")
            settle(page)
            for w in page.evaluate("VizOS.audit()"):
                report.append((view, i + 1, w if k == s["steps"] or s["steps"] <= 1 else f"step {k}: {w}"))
        for c in s["controls"]:
            for v in (c["min"], c["max"]):
                page.evaluate(f"VizOS.setControl({json.dumps(c['name'])},{v})")
                settle(page)
                for w in page.evaluate("VizOS.audit()"):
                    report.append((view, i + 1, f"{c['name']}={v}: {w}"))
            page.evaluate(f"VizOS.setControl({json.dumps(c['name'])},{c['value']})")
        if s["predict"]:
            page.evaluate("VizOS.reveal()")
            page.wait_for_timeout(120)
            for w in page.evaluate("VizOS.audit()"):
                report.append((view, i + 1, f"after the answer: {w}"))
        page.evaluate(f"VizOS.go({i},-1)")
        if s["predict"]:
            page.evaluate("VizOS.reveal()")
        settle(page)
        page.wait_for_timeout(150)
        zooms[i] = page.evaluate(ZOOM)
        if view == "desktop":
            nums.append(f"slide {i + 1}: " + " | ".join(page.evaluate(NUMBERS, i)))
        f = out / f"{view}-{i + 1:02d}.png"
        page.screenshot(path=str(f))
        boxes = page.evaluate("VizOS.textBoxes()")
        bgf = out / f".bg-{view}-{i + 1:02d}.png"
        page.add_style_tag(content=HIDE_TEXT)
        page.wait_for_timeout(60)
        page.screenshot(path=str(bgf))
        page.evaluate("document.querySelectorAll('style[data-hide]').forEach(s => s.remove()); document.querySelectorAll('style').forEach(s => { if (s.textContent.startsWith('/*hide-text*/')) s.remove(); })")
        bad = contrast_issues(f, bgf, boxes, 1)
        bgf.unlink(missing_ok=True)
        if bad is None and view == "desktop" and i == 0:
            report.append((view, 0, "contrast not checked (pip install pillow)"))
        for ratio, need, text in sorted(bad or [])[:3]:
            report.append((view, i + 1, f'low contrast {ratio:.1f}:1 (needs {need:g}) on "{text}"'))
        shots.append((f, f"{i + 1}"))
    # a viewer has animations on: each slide must fit the same way it did here
    live = ctx.new_page()
    live.goto(deck.as_uri())
    try:
        live.wait_for_function("window.VizOS && VizOS.ready === true", timeout=20000)
        for i, z in zooms.items():
            live.evaluate(f"VizOS.go({i},-1)")
            if info["slides"][i]["predict"]:
                live.evaluate("VizOS.reveal()")
            settle(live)
            zl = live.evaluate(ZOOM)
            if abs(zl - z) > .02:
                report.append((view, i + 1, f"with animations on, the slide fits at {zl:.0%}, not {z:.0%}: its fit depends on timing (kit bug)"))
    except Exception as e:
        report.append((view, 0, f"could not re-fit with animations on: {str(e).splitlines()[0]}"))
    live.close()
    errs = page.evaluate("VizOS.errors")
    for e in errs:
        report.append((view, 0, "error: " + e))
    for c in console[:5]:
        if "favicon" not in c and "net::ERR" not in c:
            report.append((view, 0, "console: " + c[:160]))
    if nums:
        (out / "numbers.txt").write_text("\n".join(nums) + "\n")
    if shots:
        cols, w, h = (3, 480, 270) if view == "desktop" else (5, 216, 468)
        sheet(page, shots, out / f"{view}.png", cols, w, h)
    ctx.close()
    return shots


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck")
    ap.add_argument("--out")
    ap.add_argument("--only", choices=list(VIEWS))
    ap.add_argument("--slides", help="e.g. 3,5-7 (1-based)")
    ap.add_argument("--vendor", default=os.environ.get("VIZOS_VENDOR"))
    ap.add_argument("--all-steps", action="store_true", help="also screenshot every step (slower)")
    args = ap.parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("check: playwright is not installed (pip install playwright && playwright install chromium): not checked")
        return 2
    deck = Path(args.deck).resolve()
    out = Path(args.out or deck.parent / "snaps").resolve()
    out.mkdir(parents=True, exist_ok=True)
    for f in [*out.glob("*.png"), out / "numbers.txt"]:
        f.unlink(missing_ok=True)
    report = []
    with sync_playwright() as p:
        try:
            br = launch(p)
        except RuntimeError as e:
            print(f"check: {e}: not checked")
            return 2
        for view in ([args.only] if args.only else list(VIEWS)):
            run_view(br, deck, view, out, args, report)
        br.close()
    seen, lines = set(), []
    for view, i, msg in report:
        key = (i, re.sub(r"^step \d+: ", "", msg))
        tag = f"[{view}] slide {i}" if i else f"[{view}]"
        if (view, key) in seen:
            continue
        seen.add((view, key))
        lines.append(f"WARN {tag}: {msg}")
    for ln in lines[:45]:
        print(ln)
    if len(lines) > 45:
        print(f"WARN ... and {len(lines) - 45} more")
    nf = out / "numbers.txt"
    print(f"check: {len(lines)} warnings · sheets: {out / 'desktop.png'} {out / 'phone.png'}" + (f" · numbers: {nf}" if nf.exists() else ""))
    return 1 if lines else 0


if __name__ == "__main__":
    sys.exit(main())
