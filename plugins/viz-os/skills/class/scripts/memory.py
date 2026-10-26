#!/usr/bin/env python3
"""Series memory for viz-os class lessons: what was taught, on which data, and what is still open.

Usage:
  memory.py show <series>
  memory.py episode <series> --part N --path lesson.yaml --gates "5/5" [--title T] [--date YYYY-MM-DD]
  memory.py home <series> --name cells --template cells-x-markers --seed 7
  memory.py loop <series> "a question the lesson left open" [--close]
  memory.py learner --topic T --note N [--date YYYY-MM-DD] [--home PATH]

Files live in the viz-os home folder: $VIZOS_HOME if it is set, else ~/.viz-os.
  series/<series>.yaml   three lists: episodes (part, title, path, date, gates), home data (name, template, seed), open loops
  learner.yaml           the deck's profile. `learner` only adds one line to `history:` and sets `home:`; it never
                         rewrites the deck's fields, and it keeps the file's comments.
Every write is idempotent: the same call twice changes nothing the second time, and says "unchanged".
"""
import argparse, datetime, os, re, sys
from pathlib import Path

import yaml


def home_dir():
    return Path(os.environ.get("VIZOS_HOME") or Path.home() / ".viz-os")


def slug_ok(s):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", s):
        sys.exit(f"memory: series name `{s}` must be lowercase letters, digits and dashes (e.g. pca)")
    return s


def series_file(name):
    return home_dir() / "series" / f"{slug_ok(name)}.yaml"


def read(name):
    f = series_file(name)
    doc = yaml.safe_load(f.read_text()) if f.exists() else None
    doc = doc if isinstance(doc, dict) else {}
    doc.setdefault("series", name)
    for k in ("episodes", "home", "open_loops"):
        doc[k] = doc.get(k) or []
    return doc


def write(name, doc, before):
    """Write only when something changed, so a rerun leaves the file's bytes alone."""
    if doc == before:
        print(f"memory: unchanged {series_file(name)}")
        return
    f = series_file(name)
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(yaml.safe_dump(doc, sort_keys=False, allow_unicode=True, width=120))
    print(f"memory: wrote {f}")


def put(items, key, new):
    """Replace the entry whose `key` matches, or append; the list stays sorted by that key."""
    return sorted([x for x in items if x.get(key) != new[key]] + [new], key=lambda x: x[key])


def today(d):
    return d or datetime.date.today().isoformat()


def cmd_show(a):
    f = series_file(a.series)
    print(f.read_text() if f.exists() else f"memory: no series `{a.series}` yet ({f})")


def cmd_episode(a):
    doc = read(a.series)
    before = yaml.safe_load(yaml.safe_dump(doc))
    ep = {"part": a.part, "title": a.title, "path": str(Path(a.path).resolve()), "date": today(a.date), "gates": a.gates}
    ep = {k: v for k, v in ep.items() if v is not None}
    old = next((x for x in doc["episodes"] if x.get("part") == a.part), None)
    if old and {k: v for k, v in old.items() if k != "date"} == {k: v for k, v in ep.items() if k != "date"} and not a.date:
        ep["date"] = old["date"]   # a rebuild on a later day is the same episode
    doc["episodes"] = put(doc["episodes"], "part", ep)
    write(a.series, doc, before)


def cmd_home(a):
    doc = read(a.series)
    before = yaml.safe_load(yaml.safe_dump(doc))
    f = home_dir() / "home" / f"{a.name}.json"
    doc["home"] = put(doc["home"], "name", {"name": a.name, "template": a.template, "seed": a.seed, "file": str(f)})
    if not f.exists():
        print(f"memory: note: {f} does not exist yet; make it with home.py {a.template} --name {a.name} --seed {a.seed}")
    write(a.series, doc, before)


def cmd_loop(a):
    doc = read(a.series)
    before = yaml.safe_load(yaml.safe_dump(doc))
    loops = [x for x in doc["open_loops"] if x != a.text]
    doc["open_loops"] = loops if a.close else loops + [a.text]
    if not a.close and a.text in before["open_loops"]:
        doc["open_loops"] = before["open_loops"]   # already open: keep its place
    write(a.series, doc, before)


def cmd_learner(a):
    """Add one history line and set `home:` by editing the text, so the profile's comments survive."""
    f = home_dir() / "learner.yaml"
    text = f.read_text() if f.exists() else "history: []\n"
    doc = yaml.safe_load(text) or {}
    new = text
    if a.topic:
        line = {"date": today(a.date), "topic": a.topic, "note": a.note or "", "skill": "class"}
        hist = doc.get("history") or []
        if not any(isinstance(h, dict) and h.get("topic") == a.topic and h.get("date") == line["date"] for h in hist):
            item = "  - " + yaml.safe_dump(line, default_flow_style=True, sort_keys=False, allow_unicode=True, width=1000).strip()
            lines = new.split("\n")
            h = next((k for k, ln in enumerate(lines) if ln.startswith("history:")), None)
            rest = lines[h][len("history:"):].strip() if h is not None else ""
            if h is None:
                lines[-1:] = ["", "history:", item, ""] if lines[-1] == "" else [lines[-1], "", "history:", item]
            elif re.fullmatch(r"\[\]\s*(#.*)?", rest):   # history: []  ->  a block list
                lines[h] = "history:" + (" " + rest[2:].strip() if rest[2:].strip() else "")
                lines.insert(h + 1, item)
            elif rest == "" or rest.startswith("#"):   # a block list: add after its last line
                j = h + 1
                while j < len(lines) and lines[j].strip() and lines[j][:1] in (" ", "\t", "-"):
                    j += 1
                lines.insert(j, item)
            else:
                sys.exit(f"memory: cannot add to `history: {rest[:40]}` in {f}; write it as a block list (one `- ` line per entry)")
            new = "\n".join(lines)
    if a.home:
        if re.search(r"^home:.*$", new, re.M):
            new = re.sub(r"^home:.*$", f"home: {a.home}", new, count=1, flags=re.M)
        else:
            new = new.rstrip("\n") + f"\nhome: {a.home}\n"
    if new == text:
        print(f"memory: unchanged {f}")
        return
    after = yaml.safe_load(new) or {}
    keep = {k: v for k, v in doc.items() if k not in ("history", "home")}
    if {k: v for k, v in after.items() if k not in ("history", "home")} != keep:
        sys.exit(f"memory: refusing to write {f}: the edit would change fields other than history and home")
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(new)
    print(f"memory: wrote {f}")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("show"); p.add_argument("series"); p.set_defaults(fn=cmd_show)
    p = sub.add_parser("episode"); p.add_argument("series"); p.add_argument("--part", type=int, required=True)
    p.add_argument("--path", required=True); p.add_argument("--gates", required=True); p.add_argument("--title")
    p.add_argument("--date"); p.set_defaults(fn=cmd_episode)
    p = sub.add_parser("home"); p.add_argument("series"); p.add_argument("--name", required=True)
    p.add_argument("--template", required=True); p.add_argument("--seed", type=int, required=True); p.set_defaults(fn=cmd_home)
    p = sub.add_parser("loop"); p.add_argument("series"); p.add_argument("text"); p.add_argument("--close", action="store_true")
    p.set_defaults(fn=cmd_loop)
    p = sub.add_parser("learner"); p.add_argument("--topic"); p.add_argument("--note"); p.add_argument("--date")
    p.add_argument("--home"); p.set_defaults(fn=cmd_learner)
    a = ap.parse_args(argv)
    a.fn(a)


if __name__ == "__main__":
    main()
