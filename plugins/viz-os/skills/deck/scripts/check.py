#!/usr/bin/env python3
"""Check a built viz-os deck in a real browser, on a desktop screen (1440 × 900).

Usage: check.py deck.html [--out DIR] [--slides 3,5-7] [--vendor DIR] [--all-steps]

For every slide and every build step it reports text that overlaps, leaves the slide, hides under the
navigation, renders too small, or overflows its box; content shrunk below 80%; formula and expression errors;
charts that did not draw; worked lines that read ≈ (their rounded numbers do not give the result shown).
It moves every slider to both ends, opens every predict answer and audits the slide again ("after the answer"),
and measures text contrast on the real pixels (labels over chart marks are where legibility fails). On a lesson it opens
each pop-up card (up to 80 a slide) and checks its text against the lightest pixel behind it (4.5 : 1). The check
runs with animations off; it then re-fits every slide with them on and reports any slide a viewer would see
shrunk differently.
Contact sheet: <out>/desktop.png. Every visible line that holds a digit, per slide (all steps
shown, answers open): <out>/numbers.txt, to check the deck's numbers against an independent recompute.
Exit 0 = clean, 1 = warnings, 2 = could not run (say "not checked").
--vendor DIR serves cdnjs and Google Fonts files from DIR (offline machines): DIR/katex/katex.min.js etc.
"""
import argparse, json, os, re, sys
from pathlib import Path

VIEW = (1440, 900)   # a laptop screen; the kit's portrait (phone) layout is not checked
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


# a board's pop-up cards (class kit, `.vt` terms): every card's text against the lightest pixel behind it. The card hangs off <body>,
# so the slide pass above never sees it. Colours go through a canvas, since a colour-mix computes to oklab(), not rgb()
CARD_MAX = 80   # cards measured per slide, in page order (a cap against a runaway page)
CARD_TERMS = """(i) => { const n = VizOS.slides[i].r.node;
  return [...n.querySelectorAll('.vt')].filter(e => !e.closest('[data-step]:not(.shown)') && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').length; }"""
CARD_OPEN = """([i, j]) => { const n = VizOS.slides[i].r.node, e = [...n.querySelectorAll('.vt')].filter(e => !e.closest('[data-step]:not(.shown)') && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')[j];
  if (!e) return false; const k0 = document.querySelector('.vpop.on'); if (k0) document.body.click();
  e.scrollIntoView({ block: 'center' }); e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); return true; }"""
CARD_PARTS = """() => { const k = document.querySelector('.vpop.on'); if (!k) return null;
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const g = cv.getContext('2d', { willReadFrequently: true });
  const rgb = c => { g.fillStyle = '#010203'; g.fillStyle = c; if (g.fillStyle === '#010203') return null; g.clearRect(0, 0, 1, 1); g.fillRect(0, 0, 1, 1); return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3); };
  const r = k.getBoundingClientRect(), rg = document.createRange(), w = document.createTreeWalker(k, NodeFilter.SHOW_TEXT), out = [];
  while (w.nextNode()) { const t = w.currentNode, p = t.parentElement; if (!t.textContent.trim() || p.closest('.katex-mathml, .nt, svg')) continue;
    rg.selectNodeContents(t); const c = getComputedStyle(p).color;
    out.push({ text: t.textContent.trim(), color: c, rgb: rgb(c), rects: [...rg.getClientRects()].filter(q => q.width && q.height).map(q => [q.x, q.y, q.width, q.height]) }); }
  const nm = k.querySelector('.ttl b'); return { name: nm ? nm.textContent.trim() : '', card: [r.x, r.y, r.width, r.height], parts: out }; }"""
CARD_BARE = "/*card-bare*/ .vpop.on, .vpop.on * { color: transparent !important; -webkit-text-fill-color: transparent !important; } .vpop.on svg, .vpop.on .katex { visibility: hidden !important; }"


def wcag(rgb_a, rgb_b):
    def lum(c):
        def ch(v):
            v /= 255
            return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
        r, g, b = c
        return .2126 * ch(r) + .7152 * ch(g) + .0722 * ch(b)
    a, b = lum(rgb_a), lum(rgb_b)
    return (max(a, b) + .05) / (min(a, b) + .05)


def card_contrast(page, i, need=4.5, cap=CARD_MAX, shot=None):
    """Open each pop-up card on slide i in turn and hide only its text: every text line must reach `need` against the
    lightest pixel behind it (the busiest background the glass lets through). Returns (cards measured, problems, worst),
    worst = (ratio, card name, text). `shot(j, parts)` is called with each card open, for pictures."""
    try:
        from PIL import Image
    except ImportError:
        return 0, [], None
    import io
    n, done, bad, worst = page.evaluate(CARD_TERMS, i), 0, [], None
    for j in range(min(n, cap)):
        if not page.evaluate(CARD_OPEN, [i, j]):
            continue
        page.wait_for_timeout(60)
        pr = page.evaluate(CARD_PARTS)
        if not pr or not pr["parts"]:
            continue
        if shot:
            shot(j, pr)
        page.add_style_tag(content=CARD_BARE)
        page.wait_for_timeout(30)
        x, y, w, h = pr["card"]
        X, Y = max(0, int(x)), max(0, int(y))
        clip = {"x": X, "y": Y, "width": max(1, min(int(x + w + 1), page.viewport_size["width"]) - X), "height": max(1, min(int(y + h + 1), page.viewport_size["height"]) - Y)}
        bg = Image.open(io.BytesIO(page.screenshot(clip=clip))).convert("RGB")
        s = bg.width / clip["width"]   # device pixels per CSS pixel
        page.evaluate("document.querySelectorAll('style').forEach(s => { if (s.textContent.startsWith('/*card-bare*/')) s.remove(); })")
        done += 1
        for part in pr["parts"]:
            if part["rgb"] is None:
                bad.append((0, pr["name"], part["text"], f'colour {part["color"]} could not be read'))
                continue
            for rx, ry, rw, rh in part["rects"]:
                x0, y0 = max(0, int((rx - X) * s)), max(0, int((ry - Y) * s))
                x1, y1 = min(bg.width, int((rx + rw - X) * s + .999)), min(bg.height, int((ry + rh - Y) * s + .999))
                if x1 - x0 < 2 or y1 - y0 < 2:
                    continue
                cols = set(bg.crop((x0, y0, x1, y1)).getdata())
                r = min(wcag(part["rgb"], c) for c in cols)
                if worst is None or r < worst[0]:
                    worst = (r, pr["name"], part["text"])
                if r < need:
                    bad.append((r, pr["name"], part["text"], None))
    if page.evaluate("!!document.querySelector('.vpop.on')"):
        page.evaluate("document.body.click()")
    return done, bad, worst


def sheet(page, shots, path, cols, w, h, tall=False):
    rows = (len(shots) + cols - 1) // cols
    top, high = (";vertical-align:top", "auto") if tall else ("", f"{h}px")   # a sketch page's sheets keep their own height
    imgs = "".join(f'<figure style="margin:6px;display:inline-block;position:relative{top}"><img src="{Path(f).as_uri()}" style="width:{w}px;height:{high};display:block;border-radius:8px">'
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
# a board figure's frame (class lessons): the content's box (its legend and drawing) against the frame. The top needs AIR_TOP px
# under the frame's line; the air under the content, counting the empty band under a lone figure beside a taller text column
# (within the pin), may exceed the air above by at most BAND px. Measured on the page, so it judges any kit
AIR_TOP, BAND = 16, 24
FRAME_AIR = """([top, band]) => { const n = VizOS.slides[VizOS.i].r.node, out = [], b0 = n.querySelector('.body.board'), pin = Math.min(820, innerHeight - 49, b0 ? innerHeight - (b0.getBoundingClientRect().top - n.getBoundingClientRect().top) - 12 : 1e9);   // as the kit sizes: the pin, and the room with the scene head in view
  n.querySelectorAll('.board .fg .fr').forEach(f => { if (!f.offsetHeight) return; const F = f.getBoundingClientRect(), kids = [...f.children].filter(e => e.getBoundingClientRect().height > 0 && getComputedStyle(e).position !== 'absolute');   // an svg has no offsetHeight
    if (!kids.length) return; const c0 = Math.min(...kids.map(e => e.getBoundingClientRect().top)), c1 = Math.max(...kids.map(e => e.getBoundingClientRect().bottom));
    const fb = f.closest('.fb.beside'), ff = f.closest('.ffig'), side = fb && fb.querySelector(':scope > .fside'), lone = side && ff && ff.querySelectorAll('.fr').length === 1;
    const under = lone ? Math.max(0, Math.min(side.offsetHeight, pin) - ff.offsetHeight) : 0, up = Math.round(c0 - F.top), down = Math.round(F.bottom - c1 + under);
    const kind = (f.className.match(/\\b(plane|space|chance|beads|fork|recorder|wheel|pileup|chart|units|image|dist|parts|ops)\\b/) || ['figure'])[0];
    if (up < top) out.push(`a ${kind} frame is cramped at the top: its content starts ${up} px under the frame's line (needs ${top})`);
    if (down - up > band) out.push(`a ${kind} frame has an empty band: ${down} px under its content against ${up} px above (at most ${band} px more)`); });
  // parts that stand side by side end on one baseline: a chance figure's groups, figures in a row, the two sides of a compare
  const bot = e => Math.round(e.getBoundingClientRect().bottom), uneven = (es, what) => { const b = es.filter(e => e.getBoundingClientRect().height > 0).map(bot); if (b.length > 1 && Math.max(...b) - Math.min(...b) > 2) out.push(`${what} do not end on one baseline: bottoms ${b.join(', ')} px`); };
  n.querySelectorAll('.bi.chance svg').forEach(s => uneven([...s.querySelectorAll('rect.chit')].filter(r => r.parentNode.querySelectorAll(':scope > :is(rect, path):not(.chit)').length >= 4), "a chance figure's groups"));
  n.querySelectorAll('.fb.many > .ffig').forEach(r => uneven([...r.children].filter(e => e.matches('.fg')), 'figures in one row'));
  n.querySelectorAll('.bcmp').forEach(c => uneven([...c.querySelectorAll(':scope > .side > .vis')], "the two sides' figures"));
  return out; }"""
PAGE_MAX = 1_000_000


def check_deck(br, deck, out, args, report):
    W, H = VIEW
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
        report.append((0, "deck did not start: " + " | ".join(console[:3])))
        return []
    page.wait_for_timeout(300)
    if not page.evaluate("!!window.katex") and page.evaluate("document.querySelectorAll('.tex-fallback').length"):
        report.append((0, "KaTeX did not load: formulas show as plain text (offline? use --vendor or --katex-dir)"))
    info = page.evaluate("VizOS.info()")
    shots, zooms, nums, cards, cards_found = [], {}, [], [0], [0]
    for i in parse_slides(args.slides, info["n"]):
        s = info["slides"][i]
        lo = 1 if s["steps"] > 0 else 0
        steps = range(lo, s["steps"] + 1) if args.all_steps or True else [s["steps"]]
        for k in steps:
            page.evaluate(f"VizOS.go({i},{k})")
            settle(page)
            for w in page.evaluate("VizOS.audit()"):
                report.append((i + 1, w if k == s["steps"] or s["steps"] <= 1 else f"step {k}: {w}"))
        if info.get("page"):   # every step shown, every answer open: the frames as the figure was sized for them
            for w in page.evaluate(FRAME_AIR, [AIR_TOP, BAND]):
                report.append((i + 1, w))
        for c in s["controls"]:
            if c["min"] is None or c["max"] is None:   # a control with no range is a lint error already
                continue
            for v in (c["min"], c["max"]):
                page.evaluate(f"VizOS.setControl({json.dumps(c['name'])},{v})")
                settle(page)
                for w in page.evaluate("VizOS.audit()"):
                    report.append((i + 1, f"{c['name']}={v}: {w}"))
            page.evaluate(f"VizOS.setControl({json.dumps(c['name'])},{c['value'] if c['value'] is not None else c['min']})")
        if s["predict"]:
            page.evaluate("VizOS.reveal()")
            page.wait_for_timeout(120)
            for w in page.evaluate("VizOS.audit()"):
                report.append((i + 1, f"after the answer: {w}"))
        page.evaluate(f"VizOS.go({i},-1)")
        if s["predict"]:
            page.evaluate("VizOS.reveal()")
        settle(page)
        page.wait_for_timeout(150)
        zooms[i] = page.evaluate(ZOOM)
        nums.append(f"slide {i + 1}: " + " | ".join(page.evaluate(NUMBERS, i)))
        f = out / f"desktop-{i + 1:02d}.png"
        if info.get("page"):   # a sheet can be taller than the screen: open the window to fit it, so all its text is seen and measured
            page.set_viewport_size({"width": W, "height": max(H, page.evaluate("VizOS.sheetHeight()"))})
            page.evaluate(f"VizOS.go({i},-1)")
            settle(page)
        page.screenshot(path=str(f))
        boxes = page.evaluate("VizOS.textBoxes()")
        bgf = out / f".bg-{i + 1:02d}.png"
        page.add_style_tag(content=HIDE_TEXT)
        page.wait_for_timeout(60)
        page.screenshot(path=str(bgf))
        page.evaluate("document.querySelectorAll('style[data-hide]').forEach(s => s.remove()); document.querySelectorAll('style').forEach(s => { if (s.textContent.startsWith('/*hide-text*/')) s.remove(); })")
        bad = contrast_issues(f, bgf, boxes, 1)
        bgf.unlink(missing_ok=True)
        if info.get("page"):
            page.set_viewport_size({"width": W, "height": H})
        if bad is None and i == 0:
            report.append((0, "contrast not checked (pip install pillow)"))
        for ratio, need, text in sorted(bad or [])[:3]:
            report.append((i + 1, f'low contrast {ratio:.1f}:1 (needs {need:g}) on "{text}"'))
        shots.append((f, f"{i + 1}"))
        if page.evaluate(CARD_TERMS, i):   # a board's pop-up cards (decks and sketch pages have none)
            done, cbad, cw = card_contrast(page, i)
            found = page.evaluate(CARD_TERMS, i)
            cards[0] += done
            cards_found[0] += found
            if cw and (len(cards) < 2 or cw[0] < cards[1][0]):
                cards[1:] = [cw]
            for ratio, name, text, why in sorted(cbad, key=lambda b: b[0])[:3]:
                report.append((i + 1, f'pop-up card "{name}": {why} on "{text}"' if why else f'pop-up card "{name}": low contrast {ratio:.1f}:1 (needs 4.5) on "{text}" over the lightest pixel behind it'))
            if done < min(found, CARD_MAX):
                report.append((i + 1, f"pop-up cards: {found - done if found <= CARD_MAX else min(found, CARD_MAX) - done} of the slide's terms opened no card to measure"))
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
                report.append((i + 1, f"with animations on, the slide fits at {zl:.0%}, not {z:.0%}: its fit depends on timing (kit bug)"))
    except Exception as e:
        report.append((0, f"could not re-fit with animations on: {str(e).splitlines()[0]}"))
    live.close()
    errs = page.evaluate("VizOS.errors")
    for e in errs:
        report.append((0, "error: " + e))
    for c in console[:5]:
        if "favicon" not in c and "net::ERR" not in c:
            report.append((0, "console: " + c[:160]))
    if cards[0]:
        w = cards[1] if len(cards) > 1 else None
        print(f"cards: {cards[0]} of {cards_found[0]} pop-up cards measured (at most {CARD_MAX} a slide), every text line against the lightest pixel behind it"
              + (f"; lowest {w[0]:.2f}:1 on \"{w[2]}\" (card \"{w[1]}\")" if w else ""))
    if nums:
        (out / "numbers.txt").write_text("\n".join(nums) + "\n")
    if shots:
        sheet(page, shots, out / "desktop.png", 3, 480, 270, tall=bool(info.get("page")))
    size = deck.stat().st_size
    if info.get("page") and size > PAGE_MAX and "<img" not in deck.read_text(encoding="utf-8"):
        report.append((0, f"the page is {size / 1e6:.2f} MB (≤ {PAGE_MAX / 1e6:g} MB with no picture)"))
    ctx.close()
    return shots


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck")
    ap.add_argument("--out")
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
        check_deck(br, deck, out, args, report)
        br.close()
    seen, lines = set(), []
    for i, msg in report:
        key = (i, re.sub(r"^step \d+: ", "", msg))
        if key in seen:
            continue
        seen.add(key)
        lines.append(f"WARN slide {i}: {msg}" if i else f"WARN {msg}")
    for ln in lines[:45]:
        print(ln)
    if len(lines) > 45:
        print(f"WARN ... and {len(lines) - 45} more")
    nf = out / "numbers.txt"
    print(f"check: {len(lines)} warnings · sheet: {out / 'desktop.png'}" + (f" · numbers: {nf}" if nf.exists() else ""))
    return 1 if lines else 0


if __name__ == "__main__":
    sys.exit(main())
