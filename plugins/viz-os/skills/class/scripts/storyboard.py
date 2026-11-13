#!/usr/bin/env python3
"""Draw an adv lesson's picture plan as one storyboard image (adv.md), before any scene is written.

Usage: storyboard.py lessons/<slug>/lesson.yaml      Writes storyboard.svg beside the yaml and prints its path.

One card per scene in reading order, wrapping: the scene number, its beat, a line icon for its idea, its title and
the learner's question. Pointing at a card shows its `shows` and `see`. Plan, summary and next are small and grey.
It reads the yaml only: it never runs the lint, so a spine of stub scenes (no steps) draws too.
"""
import math, re, sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lesson_lint import BOOKENDS, DEPTH, IDEAS, THEME, adv_boards, idea_key, idea_ok, is_adv  # noqa: E402

# the kit's colours (board.css over the deck's vizos.css), with the class values as a fallback
C = {k: THEME.get(k, v) for k, v in {"bg": "#0b0c0e", "ink": "#f2f2f0", "mist": "#a29f97", "thin": "#2c2d2b", "card": "#121315",
                                      "line": "#565653", "line-dim": "#353634", "s1": "#5bfbcb", "s2": "#4bbbfb", "s3": "#9973a8",
                                      "s4": "#6be619", "s5": "#4b77fa"}.items()}
HAZE, GREY, GUIDE, DIM = "#8a877f", C["mist"], C["line"], C["line-dim"]
UI = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace"
# each family's witness colour is fixed: the series colours in table order, so neighbours in the table differ, and the
# last (`like`) differs from both its neighbours round the loop (`angle` and `made-of`)
WITNESS = {k: C[f"s{3 if k == 'like' else i % 5 + 1}"] for i, k in enumerate(IDEAS)}
WIDTH, PAD = 1280, 40


def f(n):
    return f"{n:.2f}".rstrip("0").rstrip(".")


BADXML = re.compile("[^\t\n\r\x20-\ud7ff\ue000-\ufffd\U00010000-\U0010ffff]")   # characters XML 1.0 forbids


def esc(s):
    return BADXML.sub("", str(s)).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


# ---- glyphs: line pictograms on a 64 x 48 grid. 2 px grey strokes; the witness at 3.5 px in the family's colour
V = 'vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"'
DASH, DOTS = 'stroke-dasharray="4 3"', 'stroke-dasharray="2 2.5"'


def pts(p):
    return " ".join(f"{f(x)},{f(y)}" for x, y in p)


def ln(x1, y1, x2, y2, c, w, x=""):
    return f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" stroke="{c}" stroke-width="{w}" {V} {x}/>'


def pl(p, c, w, x=""):
    return f'<polyline points="{pts(p)}" fill="none" stroke="{c}" stroke-width="{w}" {V} {x}/>'


def pg(p, c, w):
    return f'<polygon points="{pts(p)}" fill="none" stroke="{c}" stroke-width="{w}" {V}/>'


def rc(x, y, w, h, c, sw, fill="none"):
    return f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" fill="{fill}" stroke="{c}" stroke-width="{sw}" {V}/>'


def box(x, y, w, h, fill):
    return f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" fill="{fill}"/>'


def ci(cx, cy, r, c, sw, fill="none"):
    return f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{fill}" stroke="{c}" stroke-width="{sw}" {V}/>'


def dot(cx, cy, r, c):
    return f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{c}"/>'


def pa(d, c, w, x=""):
    return f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" {V} {x}/>'


def head(x, y, ang, c, w, s=4.5):
    a1, a2 = ang + math.pi * 0.8, ang - math.pi * 0.8
    return pl([[x + s * math.cos(a1), y + s * math.sin(a1)], [x, y], [x + s * math.cos(a2), y + s * math.sin(a2)]], c, w)


def arrow(x1, y1, x2, y2, c, w, s):
    return ln(x1, y1, x2, y2, c, w) + head(x2, y2, math.atan2(y2 - y1, x2 - x1), c, w, s)


def loupe(W):   # whole -> one part -> its numbers
    x0, y0, c = 4, 9, 9.5
    s = "".join(rc(x0 + k * c, y0 + r * c, c, c, GREY, 2) for r in range(3) for k in range(3))
    px, py, bx = x0 + 2 * c, y0 + c, 41
    s += ln(px + c, py, bx - 3, y0 - 2, GUIDE, 1) + ln(px + c, py + c, bx - 3, y0 + 3 * c + 2, GUIDE, 1) + rc(px, py, c, c, W, 3.5)
    return s + "".join(box(bx, y0 + i * c + 1.5, b, 5, GREY) for i, b in enumerate([16, 9, 13]))


def units(W):   # countable units, some filled
    sz, g, x0, y0 = 7.5, 2.8, 3.5, 9.5
    return "".join(rc(x0 + k * (sz + g), y0 + r * (sz + g), sz, sz, W, 1, W) if r * 6 + k < 8 else rc(x0 + k * (sz + g), y0 + r * (sz + g), sz, sz, GREY, 2)
                   for r in range(3) for k in range(6))


def handle(W):   # a slider; an arrow from its knob to the one mark it moves
    ty, kx = 34, 40
    s = ln(5, ty, 59, ty, GREY, 2) + "".join(ln(x, ty + 5, x, ty + 9, GUIDE, 1) for x in range(5, 60, 6))
    s += dot(12, 10, 3, GREY) + dot(22, 15, 3, GREY) + dot(54, 13, 3, GREY)
    return s + arrow(kx, ty - 7, kx, 16, W, 3.5, 4.5) + dot(kx, 8.5, 4.5, W) + ci(kx, ty, 4.5, W, 3.5, C["bg"])


def guess(W):   # a point, a line of choices, the drop to the line, a bracket that measures the gap
    A, B, T = (3, 42), (61, 22), (22, 7)
    dx, dy = B[0] - A[0], B[1] - A[1]
    L = math.hypot(dx, dy)
    t = ((T[0] - A[0]) * dx + (T[1] - A[1]) * dy) / (L * L)
    F, u, n = (A[0] + t * dx, A[1] + t * dy), (dx / L, dy / L), (-dy / L, dx / L)
    k = 4
    s = ln(*A, *B, GREY, 2) + pl([[F[0] - u[0] * k, F[1] - u[1] * k], [F[0] - u[0] * k - n[0] * k, F[1] - u[1] * k - n[1] * k], [F[0] - n[0] * k, F[1] - n[1] * k]], GUIDE, 1)
    s += ln(*T, *F, W, 3.5)
    o = 8
    b0, b1 = (T[0] + u[0] * o, T[1] + u[1] * o), (F[0] + u[0] * o, F[1] + u[1] * o)
    s += ln(*b0, *b1, GREY, 2) + ln(b0[0] - u[0] * 3, b0[1] - u[1] * 3, *b0, GREY, 2) + ln(b1[0] - u[0] * 3, b1[1] - u[1] * 3, *b1, GREY, 2)
    return s + dot(*T, 4, C["ink"])


def ghost(W):   # the wrong way as a dashed ghost behind the right way
    b = 42

    def hump(x0, x1, top):
        m, w = (x0 + x1) / 2, (x1 - x0) / 2
        return f"M{x0},{b} C{f(m - w * 0.45)},{b} {f(m - w * 0.55)},{top} {f(m)},{top} S{f(x1 - w * 0.45)},{b} {x1},{b}"
    return ln(4, b, 60, b, GUIDE, 1) + pa(hump(6, 58, 4), GREY, 2, DASH) + pa(hump(15, 49, 19), W, 3.5)


def run(W):   # a run with stops, a trail behind the current stop
    P = [[5, 41], [18, 34], [30, 18], [44, 24], [58, 7]]
    s = pl(P[:4], GREY, 2, 'stroke-dasharray="3 3"') + pl(P[3:], W, 3.5)
    return s + "".join(ci(x, y, 3, GREY, 2, C["bg"]) for x, y in P[:4]) + dot(*P[4], 5, W)


def strip(W):   # three panels joined, one thread lit through all three
    y0, h, w, xs = 10, 28, 14, [3, 25, 47]
    s = "".join(rc(x, y0, w, h, GREY, 2) + "".join(ln(x + 3, y0 + h * q, x + w - 3, y0 + h * q, GUIDE, 1) for q in (0.25, 0.75)) for x in xs)
    return s + ln(xs[0] + 2.5, y0 + h / 2, xs[2] + w - 2.5, y0 + h / 2, W, 3.5)


def fork(W):   # one start, three branches to aligned ends
    s = ln(58, 3, 58, 45, GUIDE, 1, DOTS)
    for i, ey in enumerate([7, 24, 41]):
        s += pa(f"M10,24 C24,24 36,{ey} 54,{ey}", W if i == 0 else GREY, 3.5 if i == 0 else 2)
        s += rc(55.5, ey - 3, 5, 6, W, 1, W) if i == 0 else rc(55.5, ey - 3, 5, 6, GREY, 2, C["bg"])
    return s + dot(6, 24, 4.5, GREY)


def draws(W):   # two piles of draws, the gap between their centres bracketed
    b, r = 43, 2.7
    st = r * 2 + 1.2
    s = ln(3, b + r + 1.5, 61, b + r + 1.5, GUIDE, 1)
    for cx, hs in ((16, [2, 4, 3]), (46, [2, 3, 4, 1])):
        for k, n in enumerate(hs):
            x = cx + (k - (len(hs) - 1) / 2) * st
            s += "".join(dot(x, b - j * st, r, GREY) for j in range(n))
    by, c1, c2 = 8, 16, 46 + st / 2
    return s + ln(c1, by, c2, by, W, 3.5) + ln(c1, by - 4, c1, by + 5, W, 3.5) + ln(c2, by - 4, c2, by + 5, W, 3.5)


def view(W):   # the eye looks along the sheet, which shows as a line; a turn arrow says the camera moved
    ey, ex = 28, 10
    s = pa(f"M{ex - 7},{ey} Q{ex},{ey - 7} {ex + 7},{ey} Q{ex},{ey + 7} {ex - 7},{ey} Z", GREY, 2) + dot(ex, ey, 2.2, GREY)
    s += ln(ex + 10, ey, 61, ey, W, 3.5) + "".join(dot(x, ey + d, 2.3, GREY) for x, d in [(28, -4), (35, 3.5), (41, -3), (48, 4), (54, -2.5)])
    return s + pa("M26,15 Q41,2 56,15", GREY, 2) + head(56, 15, 0.95, GREY, 2)


def pair(W):   # two matched pictures tied together, the tie broken where the match fails
    y, sz = 24, 13

    def tri(cx):
        return [[cx, y - sz], [cx + sz * 0.95, y + sz * 0.7], [cx - sz * 0.95, y + sz * 0.7]]
    s = pg(tri(14), GREY, 2) + pg(tri(50), GREY, 2) + dot(14, y + 1, 2.6, GREY) + dot(50, y + 1, 2.6, GREY)
    s += pl([[14, y + sz * 0.7 + 3], [14, 44], [26, 44]], GREY, 2) + pl([[38, 44], [50, 44], [50, y + sz * 0.7 + 3]], GREY, 2)
    return s + ln(28, 48, 31.5, 40, W, 3.5) + ln(32.5, 48, 36, 40, W, 3.5)


def question(W):   # an own question: a speech bubble holding a question mark, no family
    s = pa("M14,6 H50 Q58,6 58,14 V28 Q58,36 50,36 H28 L18,44 L20,36 H14 Q6,36 6,28 V14 Q6,6 14,6 Z", GREY, 2)
    return s + pa("M26.5,16 Q26.5,11.5 32,11.5 Q37.5,11.5 37.5,16 Q37.5,19.5 32,21.5 V24.5", W, 3.5) + dot(32, 30, 2.2, W)


def bookend(W):   # a scene with no idea: three short lines
    return "".join(ln(6, y, 42 if i == 1 else 58, y, GREY, 2) for i, y in enumerate([10, 24, 38]))


GLYPH = {"loupe": loupe, "units": units, "handle": handle, "guess": guess, "ghost": ghost, "run": run, "strip": strip,
         "fork": fork, "draws": draws, "view": view, "pair": pair}


# ---- text: measured without a font, by an em-width per character class (Inter-like, a little generous)
def tw(s, size, mono=False, bold=False):
    if mono:
        return len(s) * size * 0.62
    w = 0
    for ch in s:
        w += (0.28 if ch == " " else 0.3 if ch in "iljI.,:;'|!()[]`’" else 0.38 if ch in "ftr" else 0.86 if ch in "mwMW"
              else 0.68 if ch.isupper() else 0.6 if ch.isdigit() else 0.9 if ch in "—→×–" else 0.56)
    return w * size * (1.07 if bold else 1)


def split_word(word, size, width, bold=False):
    """A word wider than its box, cut into pieces that fit."""
    out, cur = [], ""
    for ch in word:
        if cur and tw(cur + ch, size, bold=bold) > width * 0.96:
            out.append(cur)
            cur = ""
        cur += ch
    return out + [cur]


def wrap(s, size, width, bold=False):
    out, cur = [], ""
    for word in (p for w in str(s).split() for p in split_word(w, size, width, bold)):
        t = f"{cur} {word}" if cur else word
        if cur and tw(t, size, bold=bold) > width * 0.96:
            out.append(cur)
            cur = word
        else:
            cur = t
    return out + ([cur] if cur else [])


def text(x, y, s, size, fill, mono=False, weight=None, italic=False, ls=None):
    return (f'<text x="{f(x)}" y="{f(y)}" font-family="{MONO if mono else UI}" font-size="{size}"'
            + (f' font-weight="{weight}"' if weight else "") + (' font-style="italic"' if italic else "")
            + (f' letter-spacing="{ls}"' if ls else "") + f' fill="{fill}">{s}</text>')


# ---- the plan, read into cards
def scenes(doc):
    out = []
    for n, s in enumerate(adv_boards(doc), 1):
        beat, idea = str(s.get("beat") or ""), s.get("idea")
        book = beat in BOOKENDS
        ok = idea_ok(idea)   # the lint's rule: a malformed idea gets the neutral glyph and is not counted
        idea = str(idea).strip() if idea is not None and str(idea).strip() else None
        row = IDEAS.get(idea) if ok else None
        out.append({"n": n, "beat": beat, "title": str(s.get("title") or ""), "book": book, "idea": idea, "ok": ok,
                    "stuck": row[0] if row else idea, "glyph": "bookend" if book else row[1] if row else "question",
                    "colour": HAZE if book else WITNESS[idea] if row else C["ink"],
                    "see": s.get("see"), "shows": s.get("shows")})
    return out


def card(sc, x, y, w, h, P):
    """One card: number and beat, the glyph, the title, the learner's question in quotes; its plan in a <title>."""
    tip = "\n".join(f"{k}: {sc[k]}" for k in ("shows", "see") if sc[k])
    g = f"<title>{esc(tip)}</title>" if tip else ""
    g += f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" fill="{C["bg"] if sc["book"] else C["card"]}" stroke="{C["thin"] if sc["book"] else DIM}" stroke-width="1"/>'
    num, bt = f"{sc['n']:02d}", sc["beat"].upper()
    nw, bw = tw(num, 13, True), tw(bt, 10, True) + 0.6 * len(bt) + 12
    iw = w - 2 * P
    hx, hy = x + P, y + P
    g += text(hx, hy + 13, num, 13, HAZE if sc["book"] else C["ink"], mono=True, weight=700)
    tx, ty = (hx + nw + 10, hy) if nw + 10 + bw <= iw else (hx, hy + 22)
    g += f'<rect x="{f(tx)}" y="{f(ty)}" width="{f(bw)}" height="17" fill="none" stroke="{C["thin"] if sc["book"] else DIM}" stroke-width="1"/>'
    g += text(tx + 6, ty + 12.2, esc(bt), 10, HAZE if sc["book"] else GREY, mono=True, weight=600, ls=0.6)
    gy = ty + 17 + 12 if ty > hy else hy + 18 + 12
    gw = 44 if sc["book"] else min(iw, 132)
    k = gw / 64
    g += f'<g transform="translate({f(hx)} {f(gy)}) scale({k:.4f})">{GLYPH.get(sc["glyph"], {"bookend": bookend, "question": question}.get(sc["glyph"]))(sc["colour"])}</g>'
    yy = gy + 48 * k + 14
    if sc["book"]:
        for l in wrap(sc["title"], 13, iw):
            yy += 13 * 1.3
            g += text(hx, yy - 13 * 0.33, esc(l), 13, HAZE)
    else:
        for l in wrap(sc["title"], 14.5, iw, bold=True):
            yy += 14.5 * 1.28
            g += text(hx, yy - 14.5 * 0.32, esc(l), 14.5, C["ink"], weight=650)
        if sc["stuck"]:
            yy += 4
            for l in wrap(f"“{sc['stuck']}”", 13, iw):
                yy += 13 * 1.32
                g += text(hx, yy - 13 * 0.34, esc(l), 13, GREY, italic=True)
    return f'<g class="card" data-n="{sc["n"]}">{g}</g>', yy - y + P


def render(doc):
    sc = scenes(doc)
    W = WIDTH - 2 * PAD
    per, gap, P = 6, 14, 12
    cw = (W - gap * (per - 1)) / per
    bwid = max(110, cw * 0.62)
    rows, row, used = [], [], 0
    for c in sc:
        w = bwid if c["book"] else cw
        if row and used + gap + w > W + 0.5:
            rows.append(row)
            row, used = [], 0
        used += (gap if row else 0) + w
        row.append((c, w))
    rows += [row] if row else []
    head_, y = "", PAD
    for l in wrap(doc.get("title") or "", 24, W * 0.85, bold=True):   # 0.85: the width table runs short on wide letters at large sizes
        y += 30
        head_ += text(PAD, y - 6, esc(l), 24, C["ink"], weight=800)
    for l in wrap(doc.get("question") or "", 15, W * 0.85):
        y += 22
        head_ += text(PAD, y, esc(l), 15, GREY)
    y += 26
    body = ""
    for r in rows:
        hs = [card(c, 0, 0, w, 0, P)[1] for c, w in r]
        rh, x = max(hs), PAD
        for (c, w), h in zip(r, hs):
            body += card(c, x, y, w, h if c["book"] else rh, P)[0]
            x += w + gap
        y += rh + gap
    H = math.ceil(y - gap + PAD)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{H}" viewBox="0 0 {WIDTH} {H}" role="img" '
            f'aria-label="{esc("picture plan: " + str(doc.get("title") or ""))}">'
            f'<rect width="{WIDTH}" height="{H}" fill="{C["bg"]}"/>{head_}{body}</svg>\n'), sc


def main(argv):
    if len(argv) != 1:
        sys.exit(__doc__.strip().splitlines()[2])
    src = Path(argv[0])
    try:
        doc = yaml.safe_load(src.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, yaml.YAMLError) as e:
        sys.exit(f"storyboard: cannot read {src}: {str(e).splitlines()[0]}")
    if not isinstance(doc, dict) or not isinstance(doc.get("slides"), list):
        sys.exit(f"storyboard: {src} is not a lesson: it needs a mapping with a `slides:` list")
    if not is_adv(doc):
        sys.exit(f"storyboard: no board scene in {src} has `idea:`, so it is not an adv plan (adv.md); nothing drawn")
    svg, sc = render(doc)
    out = src.with_name("storyboard.svg")
    out.write_text(svg, encoding="utf-8")
    learner = doc.get("learner") if isinstance(doc.get("learner"), dict) else {}
    teach = [c for c in sc if not c["book"]]
    ideas = {idea_key(c["idea"]) for c in teach if c["ok"]}
    print(out)
    print(f"{len(teach)} scenes, {len(ideas)} ideas, depth {learner.get('depth', DEPTH)}")


if __name__ == "__main__":
    main(sys.argv[1:])
