#!/usr/bin/env python3
"""Check each skill's documents against its code: what an agent reads must name every field the kit reads, and only what ships.

Usage: tools/check_docs.py        Prints one line per test, then "doc tests: X/Y ok"; exits 1 if any fails.

  board.md names, in code (`…` or a code block), every field board.js reads and every beat, step field, item,
  plane mark and top-level key the lesson lint and lesson.py know.
  No class skill file points at docs/ (skill files ship; docs do not).
  page.md names every sheet field, figure item, top-level key and field a part reads, and each part's row in its table
  names that part's states and anchors.
  Across all skills: no shipped file names a folder that does not ship, every path a SKILL.md gives exists,
  and every `description` fits the 1024 characters a harness allows.
"""
import re, sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
SKILLS = ROOT / "plugins/viz-os/skills"
CLASS = SKILLS / "class"
SKETCH = SKILLS / "sketch"
sys.path[:0] = [str(CLASS / "scripts"), str(SKETCH / "scripts")]
import lesson, lesson_lint, page_lint, sketch  # noqa: E402

# board.js reads YAML fields off these objects (an item, a step, a control, a mark, a symbol); longest first
OBJS = r"(?:it\.\w+|s\.table|run\.c|ln\.c|ln\.f|A\.a|it|st|c|mk|P|F|a|x|cp|pr|nt|s|X|Y|t|p)"
JS_ONLY = {"dataset", "innerHTML", "layout", "length", "node", "style", "c", "issues", "startsWith", "steps"}


def fields():
    js = (CLASS / "kit/board.js").read_text()
    out = set(re.findall(rf"(?<![\w.]){OBJS}\.([a-z_][a-z_0-9]*)\b", js))
    out |= set(re.findall(r"\|\| \{\}\)\.([a-z_]+)", js))   # ((ctx.symbols || {})[n] || {}).kind and the like
    return out - JS_ONLY


def known():
    return (lesson_lint.BEATS | lesson_lint.STEP | lesson_lint.ITEMS | set(lesson_lint.PLANE) | set(lesson_lint.SPACE)
            | lesson.TOP_EXTRA | lesson.BOARD - {"assemble"})


def code_words(md):
    spans = re.findall(r"```[\s\S]*?```|`[^`\n]+`", md)
    return set(re.findall(r"[A-Za-z_][\w-]*", "\n".join(spans)))


def part_rows(md):
    """part -> (its `state` cell + its anchors cell) as words, from page.md's table of parts."""
    rows = re.findall(r"^\| `(\w+)` \|([^|]*)\|[^|]*\|([^|]*)\|$", md, re.M)
    return {p: (code_words(st), code_words(an)) for p, st, an in rows}


def part_anchors():
    """part -> the anchors parts.js publishes for it; `spot.${q}.${c}` counts as `spot`."""
    js = (SKETCH / "kit/parts.js").read_text()
    js = js[js.index("K.parts = {"):]
    heads = list(re.finditer(r"^    (\w+)\(G\b", js, re.M))
    ends = [m.start() for m in heads[1:]] + [len(js)]
    return {m.group(1): set(re.findall(r"G\.pub\([\'`](\w+)", js[m.start():e])) for m, e in zip(heads, ends)}


def sketch_tests():
    md = (SKETCH / "page.md").read_text()
    have = code_words(md)
    want = (page_lint.SHEET | set(page_lint.NOTE) | page_lint.BEATS | set(page_lint.PAPERS) | sketch.TOP_EXTRA
            | page_lint.FIGS - {"code"} | {"draw"} | {"review", "cards"})
    miss = sorted(want - have)
    yield f"page.md names every sheet field, beat, paper, figure item and top-level key{' (missing: ' + ', '.join(miss) + ')' if miss else ''}", not miss
    js = (SKETCH / "kit/parts.js").read_text()
    miss = sorted(set(re.findall(r"\bit\.([a-z]+)", js)) - have - {"code"})   # `code` is what the build calls a `draw:` block
    yield f"page.md names every field a part reads{' (missing: ' + ', '.join(miss) + ')' if miss else ''}", not miss
    rows, pubs, miss = part_rows(md), part_anchors(), []
    for p, states in page_lint.PARTS.items():
        st, an = rows.get(p, (set(), set()))
        miss += [f"{p}: no row"] * (p not in rows) + [f"{p}: state {x}" for x in sorted(states - st)]
        miss += [f"{p}: anchor {x}" for x in sorted(pubs.get(p, set()) - an - {"top", "bottom", "left", "right", "center"})]
    yield f"page.md's parts table names each part, state and anchor{' (missing: ' + ', '.join(miss) + ')' if miss else ''}", not miss
    miss = [p for p in page_lint.PARTS if p not in pubs]
    yield f"every part in the lint is drawn in parts.js{' (missing: ' + ', '.join(miss) + ')' if miss else ''}", not miss


# folders in the repo that do not ship. Two shipped lines may name such a path: an upstream's own folder, in an attribution,
# and a comment in the deck's stylesheet, which stays because a change there changes every deck's bytes.
NOT_SHIPPED = re.compile(r"(?<![\w./-])(?:docs|tools|plans|research|out)/")
SAID_OK = ("statechart-art tools/kit", "colour blindness (docs/design.md)")
TEXT = {".md", ".py", ".js", ".css", ".yaml", ".yml", ".txt", ""}


def shipped_paths():
    for f in sorted(SKILLS.rglob("*")):
        if f.is_file() and f.suffix in TEXT and f.name not in (".DS_Store", "kevin-chars.txt") and "snaps" not in f.parts:
            for i, ln in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
                if NOT_SHIPPED.search(ln) and not any(s in ln for s in SAID_OK):
                    yield f"{f.relative_to(SKILLS)}:{i}"


def named_paths(folder):
    """(row text, path) for each file a SKILL.md names: its Files table, and any S/ C/ D/ path in its text."""
    md = (folder / "SKILL.md").read_text(encoding="utf-8")
    table = md[md.index("## Files"):].split("\n")
    for ln in table:
        if ln.startswith("| `"):
            first, *rest = re.findall(r"`([^`]+)`", ln.split("|")[1])
            yield first, None
            for span in rest:     # `examples/a/`, `b/`: a later name sits beside the first
                yield span, Path(first).parent / span
    for m in re.finditer(r"(?<![\w/.-])[SCD]/[\w./-]*\w/?", md):
        yield m.group(0), None


def missing_paths():
    for folder in sorted(p for p in SKILLS.iterdir() if (p / "SKILL.md").exists()):
        for name, beside in named_paths(folder):
            root = {"S/": folder, "C/": CLASS, "D/": SKILLS / "deck"}.get(name[:2])
            f = folder / beside if beside else (root / name[2:] if root else folder / name)
            if not f.exists():
                yield f"{folder.name}: {name}"


def description_lengths():
    for f in sorted(SKILLS.glob("*/SKILL.md")):
        yield f.parent.name, len(yaml.safe_load(f.read_text(encoding="utf-8").split("---")[1])["description"])


def plugin_tests():
    bad = list(shipped_paths())
    yield f"no shipped file names a folder that does not ship{' (' + ', '.join(bad) + ')' if bad else ''}", not bad
    bad = list(missing_paths())
    yield f"every path a SKILL.md names exists{' (missing: ' + ', '.join(bad) + ')' if bad else ''}", not bad
    bad = [f"{k} {n}" for k, n in description_lengths() if n > 1024]
    yield f"every skill description fits 1024 characters{' (' + ', '.join(bad) + ')' if bad else ''}", not bad


def tests():
    yield from class_tests()
    yield from sketch_tests()
    yield from plugin_tests()


def class_tests():
    md = (CLASS / "board.md").read_text()
    have = code_words(md)
    miss = sorted(fields() - have)
    yield f"board.md names every field board.js reads{' (missing: ' + ', '.join(miss) + ')' if miss else ''}", not miss
    miss = sorted(known() - have)
    yield f"board.md names every beat, step field, item, plane mark and top-level key{' (missing: ' + ', '.join(miss) + ')' if miss else ''}", not miss
    bad = [f"{f.name}:{i}" for f in sorted(CLASS.rglob("*.md")) for i, ln in enumerate(f.read_text().splitlines(), 1) if "docs/" in ln]
    yield f"no class skill file points at docs/{' (' + ', '.join(bad) + ')' if bad else ''}", not bad


def main():
    results = list(tests())
    for name, ok in results:
        print(f"doc test {name} | {'ok' if ok else 'FAIL'}")
    good = sum(ok for _, ok in results)
    print(f"doc tests: {good}/{len(results)} ok")
    return 0 if good == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
