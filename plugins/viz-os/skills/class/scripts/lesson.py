#!/usr/bin/env python3
"""Build a viz-os class lesson: lesson.yaml -> one self-contained lesson.html, after a lint pass.

Usage: lesson.py path/to/lesson.yaml [-o lesson.html] [--katex-dir DIR] [--quiet]

A lesson is a deck file with `board` scenes in it. This script runs the deck's own build.py (from the sibling
`deck` skill) with the board kit and the lesson rules added, so every deck rule and check still applies.
ERR lines must be fixed (exit 1). WARN lines are judgement calls; fix them unless you have a reason.
"""
import argparse, copy, importlib.util, json, re, sys
from pathlib import Path

CLASS = Path(__file__).resolve().parent.parent
DECK = CLASS.parent / "deck"
KIT = CLASS / "kit"
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lesson_lint import EXPRS, FMT, as_list, items_of, make_lint  # noqa: E402

# a board scene: one board that grows click by click beside a pinned table (board.md)
BOARD = {"beat", "table", "steps", "assemble"}
TOP_EXTRA = {"series", "episode", "recall", "home"}
NOT_PROSE_EXTRA = {"mark", "beat", "col", "row", "lhs", "toggle", "when"}
RECALL_TITLE, RECALL_MAX = "Before we start: from last time", 5
NAME = re.compile(r"(?<![\w.])([A-Za-z_][A-Za-z0-9_]*)(?!\w|\s*\()")


def deck_build():
    f = DECK / "scripts" / "build.py"
    if not f.exists():
        sys.exit(f"lesson: the deck skill is missing: expected {DECK}. The class skill draws with the deck's kit, "
                 "so both must sit side by side in plugins/viz-os/skills/ (reinstall viz-os)")
    spec = importlib.util.spec_from_file_location("vizos_deck_build", f)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def board_names(s):
    """Names a board makes as it goes (worked lines), so `{{}}` in later lines may use them."""
    if s.get("type") != "board":
        return set()
    out = {it["calc"]["name"] for _, it in items_of(s) if isinstance(it.get("calc"), dict) and it["calc"].get("name")}
    return out | {it["assemble"]["lhs"] for _, it in items_of(s) if isinstance(it.get("assemble"), dict) and it["assemble"].get("lhs")}


def prepare(deck, data, path):
    """Write each run and toggle as the plain slider it is (frames 0..n-1; states 0 and 1), before the lint and the
    page read them, so the browser check moves it to both ends like any slider. A run's `stops` default to 0, 1, 2, n-1."""
    for s in deck.get("slides") or []:
        if not isinstance(s, dict) or s.get("type") != "board":
            continue
        for c in s.get("controls") or []:
            if not isinstance(c, dict):
                continue
            if isinstance(c.get("run"), int) and c["run"] >= 2:
                n = c["run"]
                c.setdefault("stops", sorted({0, min(1, n - 1), min(2, n - 1), n - 1}))
                c.update(min=0, max=n - 1, step=1)
                c.setdefault("value", c["stops"][0] if c["stops"] else 0)
            elif isinstance(c.get("toggle"), list) and len(c["toggle"]) == 2:
                c.update(min=0, max=1, step=1)
                c.setdefault("value", 0)
    return data


def recall(B, deck, data, path, state):
    """R23, KTD17: copy the review cards of the lessons named under `recall:` into a quiz right after the title.
    Each data name inside a card's {{}} gets the prefix r<k>_ (k = its place in `recall:`), and its value is copied
    from that lesson's data, so the card shows the numbers that lesson showed even when this lesson reuses the name.
    The last lesson listed is the latest: it gives the first cards, and each older lesson adds its first card."""
    names = as_list(deck.get("recall"))
    lessons = []
    for k, r in enumerate(names, 1):
        f = path.parent / str(r)
        f = f / "lesson.yaml" if f.is_dir() else f
        if not f.is_file():
            state["errs"].append(f"`recall: {r}` not found (looked for {f}): name an earlier lesson.yaml or its folder")
            continue
        doc = B.load(f) or {}
        slides = doc.get("slides") or []
        if not slides or not isinstance(slides[-1], dict) or slides[-1].get("type") != "quiz":
            state["errs"].append(f"`recall: {r}` has no review cards: its last slide is not a `quiz`")
            continue
        d0 = dict(doc.get("data") or {})
        if doc.get("data_file"):
            df = f.parent / doc["data_file"]
            if not df.is_file():
                state["errs"].append(f"`recall: {r}` reads {doc['data_file']}, which is missing: run its make_data.py")
                continue
            d0.update(json.loads(df.read_text()))
        lessons.append((k, r, as_list(slides[-1].get("cards")), d0))
        for a, full in (doc.get("abbr") or {}).items():   # the cards spell out what that lesson spelled out
            deck.setdefault("abbr", {}).setdefault(a, full)
    if not lessons:
        return data
    data = {} if data is None else data
    latest, older = lessons[-1], lessons[:-1][::-1][:RECALL_MAX - 1]   # older: most recent first
    picks = [(latest, c) for c in latest[2][:RECALL_MAX - len(older)]] + [(ls, ls[2][0]) for ls in older if ls[2]]

    def rename(text, ls):
        k, r, _, d0 = ls
        def one(m):
            body = m.group(1)
            fm = FMT.search(body)
            expr, tail = (body[:fm.start()], body[fm.start():]) if fm else (body, "")
            def sub(n):
                n = n.group(1)
                if n in B.CONSTS or n in B.FUNCS:
                    return n
                if n not in d0:
                    state["errs"].append(f"`recall: {r}`: a review card reads `{n}`, which is not in that lesson's data.json")
                    return n
                new = f"r{k}_{n}"
                if new in data and data[new] != d0[n] and new not in state["made"]:
                    state["errs"].append(f"`recall:` wants to add `{new}`, but this lesson's data already has that name")
                data[new] = d0[n]
                state["made"].add(new)
                return new
            return "{{" + NAME.sub(sub, expr) + tail + "}}"
        return EXPRS.sub(one, text)

    def walk(node, ls):
        if isinstance(node, dict):
            return {key: walk(v, ls) for key, v in node.items()}
        if isinstance(node, list):
            return [walk(v, ls) for v in node]
        return rename(node, ls) if isinstance(node, str) else node

    cards = [walk(copy.deepcopy(c), ls) for ls, c in picks]
    slide = {"type": "quiz", "title": RECALL_TITLE, "eyebrow": "Recall", "cards": cards}
    slides = deck.setdefault("slides", [])
    at = 1 if slides and isinstance(slides[0], dict) and slides[0].get("type") == "title" else 0
    slides.insert(at, slide)
    state["slide"] = slide
    return data


def ext(B):
    data = {}   # data.json, kept for the lint (typed numbers, review cards)
    state = {"errs": [], "made": set(), "slide": None}   # what recall did, for the lint

    def prep(deck, d, path):
        data.update(d or {})   # this lesson's own data only: recalled values are not checked as its numbers
        d = recall(B, deck, d, path, state)
        return prepare(deck, d, path)
    return {
        "fields": {"board": BOARD},
        "required": {"board": ["steps"]},
        "top": TOP_EXTRA,
        "not_prose": NOT_PROSE_EXTRA,
        "scope": board_names,
        "lint": make_lint(B, data, state),
        "prepare": prep,
        "js": [KIT / "board.js"],
        "css": [KIT / "board.css"],
        "tex_types": ["board"],
    }


def build(path, out=None, katex_dir=None, quiet=False):
    B = deck_build()
    return B.build(path, out, katex_dir, quiet, ext=ext(B))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("lesson")
    ap.add_argument("-o", "--out")
    ap.add_argument("--katex-dir", help="folder with katex.min.js, katex.min.css and fonts/ to inline (offline lessons)")
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args()
    sys.exit(build(a.lesson, a.out, a.katex_dir, a.quiet))
