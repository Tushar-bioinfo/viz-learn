#!/usr/bin/env python3
"""Read one section of a skill file, so you do not read the whole file.

  python3 docs.py board.md              # list the headings, with their sizes
  python3 docs.py board.md plane        # print the section whose heading has "plane"
  python3 docs.py adv.md "9b" fork      # every word must be in the heading
  python3 docs.py ../deck/spec.md expressions

A file name without a folder is looked up in this skill's folder. A section runs
from its heading to the next heading of the same or a higher level, so `## Items`
prints every item under it; name one item to print only that.
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def heads(lines):
    out, fence = [], False
    for i, ln in enumerate(lines):
        if ln.startswith("```"):
            fence = not fence
        m = None if fence else re.match(r"^(#{1,4})\s+(.*)", ln)
        if m:
            out.append((i, len(m.group(1)), m.group(2).strip()))
    return out


def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__.strip())
        return 0
    path = argv[0]
    if not os.path.exists(path):
        path = os.path.join(HERE, path)
    if not os.path.exists(path):
        print(f"no file {argv[0]!r} here or in {HERE}")
        return 1
    lines = open(path, encoding="utf-8").read().split("\n")
    hs = heads(lines)
    ends = []
    for k, (i, lvl, _) in enumerate(hs):
        nxt = next((j for j, l2, _ in hs[k + 1:] if l2 <= lvl), len(lines))
        ends.append(nxt)
    words = [w.lower() for w in argv[1:]]
    if not words:
        for (i, lvl, t), e in zip(hs, ends):
            size = sum(len(x) + 1 for x in lines[i:e])
            print(f"{'  ' * (lvl - 1)}{t}  ({size:,} chars, line {i + 1})")
        return 0
    hits = [k for k, (_, _, t) in enumerate(hs) if all(w in t.lower() for w in words)]
    if not hits:
        print(f"no heading has {' '.join(words)!r}; run without words to list them")
        return 1
    k = min(hits, key=lambda k: hs[k][1])   # the highest-level match
    i, e = hs[k][0], ends[k]
    print("\n".join(lines[i:e]).rstrip())
    if len(hits) > 1:
        others = "; ".join(hs[j][2] for j in hits if j != k)
        print(f"\n(also matched: {others})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
