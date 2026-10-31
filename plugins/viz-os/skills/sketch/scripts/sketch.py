#!/usr/bin/env python3
"""Build a viz-os sketch page: page.yaml -> one self-contained page.html, after a lint pass.

Usage: sketch.py path/to/page.yaml [-o page.html] [--katex-dir DIR] [--quiet]

A page is a list of sheets. This script runs the deck's own build.py (from the sibling `deck` skill) with the sketch
kit and the page rules added, so the expression engine and the typed-number lint are the ones decks and lessons use.
ERR lines must be fixed (exit 1). WARN lines are judgement calls; fix them unless you have a reason.
"""
import argparse, base64, sys, tempfile
from pathlib import Path

SKETCH = Path(__file__).resolve().parent.parent
CLASS = SKETCH.parent / "class"
KIT = SKETCH / "kit"
if not (CLASS / "scripts" / "lesson.py").exists():
    sys.exit(f"sketch: the class skill is missing: expected {CLASS}. A page takes its teaching rules from class and "
             "its build from deck, so all three must sit side by side in plugins/viz-os/skills/ (reinstall viz-os)")
sys.path[:0] = [str(Path(__file__).resolve().parent), str(CLASS / "scripts")]
import lesson  # noqa: E402
import page_lint  # noqa: E402

TOP_EXTRA = {"goal", "sheets", "seed", "series", "episode", "recall", "home"}
NOT_PROSE_EXTRA = {"beat", "paper", "ratio", "on", "tall", "cols", "mark", "side", "use", "part", "rows", "state", "color", "other", "values", "scale"}
READING_FONT = "family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400&"
JS = ["paper.js", "pens.js", "marks.js", "parts.js", "figures.js"]


def adopt(B):
    """This private copy of build.py loads the page's runtime in deck.js's place, and the reading font with the deck's fonts."""
    B.KIT_JS = [f for f in B.KIT_JS if f != "deck.js"] + [str(KIT / "page.js")]
    if READING_FONT not in B.FONTS:
        B.FONTS = B.FONTS.replace("family=Inter", READING_FONT + "family=Inter")
    return B


def to_slides(doc):
    """The sheets as the deck build reads slides: review cards become its `quiz`, the rest are the type `sheet`."""
    if "sheets" in doc:
        doc["slides"] = [dict(s, type="quiz" if s.get("beat") == "review" else "sheet") if isinstance(s, dict) else s
                         for s in doc.pop("sheets") or []]
    return doc


class Pages:
    """The deck module, except that `load` reads a page as slides, so lesson.recall can copy a page's review cards."""

    def __init__(self, B):
        self.B = B

    def __getattr__(self, name):
        return getattr(self.B, name)

    def load(self, f):
        return to_slides(self.B.load(f) or {})


def recall_paths(deck, path):
    """`recall:` may name a page's folder as well as a lesson's."""
    names = deck.get("recall")
    def one(r):
        d = path.parent / str(r)
        return str(Path(r) / "page.yaml") if d.is_dir() and (d / "page.yaml").is_file() else r
    if names:
        deck["recall"] = [one(r) for r in names] if isinstance(names, list) else one(names)


def keep_code(deck):
    """A custom drawing is code, not prose: the deck's text rules skip the key `code`."""
    for s in deck.get("slides") or []:
        if isinstance(s, dict):
            for it in page_lint.figures(s):
                if "draw" in it:
                    it["code"] = it.pop("draw")


def ext(B):
    data = {}   # data.json, kept for the lint (typed numbers, review cards)
    state = {"errs": [], "made": set(), "slide": None}

    def prep(deck, d, path):
        data.update(d or {})
        state["raw_slides"] = "slides" in deck
        state["size"] = len(Path(path).read_text(encoding="utf-8"))
        to_slides(deck)
        keep_code(deck)
        recall_paths(deck, path)
        d = lesson.recall(Pages(B), deck, d, path, state)
        # KTD8: lesson.prepare turns runs and toggles into sliders, and it only reads boards, so show it the controls as one
        lesson.prepare({"slides": [{"type": "board", "controls": s.get("controls")} for s in deck.get("slides") or [] if isinstance(s, dict)]}, d, path)
        return d
    return {
        "fields": {"sheet": page_lint.SHEET, "quiz": {"cards", "beat"}},
        "required": {"sheet": ["beat"]},
        "top": TOP_EXTRA,
        "not_prose": NOT_PROSE_EXTRA,
        "scope": page_lint.sheet_names,
        "lint": page_lint.make_lint(B, data, state),
        "prepare": prep,
        "js": [KIT / f for f in JS],
        "css": [KIT / "sketch.css"],
        "tex_types": ["sheet"],
    }


def font_face(folder):
    """Kevin Sans goes into the page, so lettering looks the same offline (KTD12)."""
    b64 = base64.b64encode((KIT / "fonts" / "KevinSans-Regular.woff2").read_bytes()).decode()
    f = Path(folder) / "kevin.css"
    f.write_text(f'@font-face{{font-family:"Kevin Sans";src:url(data:font/woff2;base64,{b64}) format("woff2");font-display:block}}')
    return f


def build(path, out=None, katex_dir=None, quiet=False):
    B = adopt(lesson.deck_build())
    e = ext(B)
    path = Path(path)
    with tempfile.TemporaryDirectory() as tmp:
        e["css"] = [font_face(tmp), *e["css"]]
        return B.build(path, Path(out) if out else path.with_suffix(".html"), katex_dir, quiet, ext=e)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("page")
    ap.add_argument("-o", "--out")
    ap.add_argument("--katex-dir", help="folder with katex.min.js, katex.min.css and fonts/ to inline (offline pages)")
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args()
    sys.exit(build(a.page, a.out, a.katex_dir, a.quiet))
