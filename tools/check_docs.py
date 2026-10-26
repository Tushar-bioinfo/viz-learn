#!/usr/bin/env python3
"""Check the class skill's documents against its code: what an agent reads must name every field the kit reads.

Usage: tools/check_docs.py        Prints one line per test, then "doc tests: X/Y ok"; exits 1 if any fails.

  board.md names, in code (`…` or a code block), every field board.js reads and every beat, step field, item,
  plane mark and top-level key the lesson lint and lesson.py know.
  No class skill file points at docs/ (skill files ship; docs do not).
"""
import re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLASS = ROOT / "plugins/viz-os/skills/class"
sys.path.insert(0, str(CLASS / "scripts"))
import lesson, lesson_lint  # noqa: E402

# board.js reads YAML fields off these objects (an item, a step, a control, a mark, a symbol); longest first
OBJS = r"(?:it\.\w+|s\.table|run\.c|ln\.c|ln\.f|A\.a|it|st|c|mk|P|F|a|x|cp|pr|nt|s|X|Y|t|p)"
JS_ONLY = {"dataset", "innerHTML", "layout", "length", "node", "style", "c", "issues", "startsWith", "steps"}


def fields():
    js = (CLASS / "kit/board.js").read_text()
    out = set(re.findall(rf"(?<![\w.]){OBJS}\.([a-z_][a-z_0-9]*)\b", js))
    out |= set(re.findall(r"\|\| \{\}\)\.([a-z_]+)", js))   # ((ctx.symbols || {})[n] || {}).kind and the like
    return out - JS_ONLY


def known():
    return (lesson_lint.BEATS | lesson_lint.STEP | lesson_lint.ITEMS | set(lesson_lint.PLANE)
            | lesson.TOP_EXTRA | lesson.BOARD - {"assemble"})


def code_words(md):
    spans = re.findall(r"```[\s\S]*?```|`[^`\n]+`", md)
    return set(re.findall(r"[A-Za-z_][\w-]*", "\n".join(spans)))


def tests():
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
