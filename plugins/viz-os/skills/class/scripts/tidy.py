#!/usr/bin/env python3
"""Clear a finished lesson's folder down to lesson.html and lesson.yaml. Nothing is lost: the working files go to the attic.

Usage:
  tidy.py lessons/<slug> [--dry-run] [--keep NAME ...]
  tidy.py lessons/<slug> --restore [--dry-run]

Moves only files it knows: snaps/, the yaml's data_file, make_data.py, verify_data.py, images the yaml names, __pycache__.
They go to attic/<slug>-<date>/ in the viz-os home folder ($VIZOS_HOME if it is set, else ~/.viz-os). Any other file stays
and is listed. --restore brings the newest attic copy back and never overwrites a file. --dry-run prints the moves only.
It refuses unless lesson.html exists, is not empty, is at least as new as the yaml, and holds this lesson's data and images.
It refuses inside the plugin's skills/ folder, because the examples there are regression tests.
"""
import argparse, datetime, json, os, re, shutil, sys
from pathlib import Path

import yaml

SKILLS = Path(__file__).resolve().parent.parent.parent
KEEP = {"lesson.html", "lesson.yaml"}
WORKING = ["snaps", "make_data.py", "verify_data.py", "__pycache__"]
FROM = "tidied-from.txt"   # the attic copy's note of where it came from


def home_dir():
    return Path(os.environ.get("VIZOS_HOME") or Path.home() / ".viz-os")


def inside(folder, name):
    """A plain relative path into the folder; a path that leaves it is not the lesson's own file."""
    f = (folder / str(name)).resolve()
    return f.is_relative_to(folder) and f != folder


def names_of(folder, doc):
    """The top-level things in the folder this lesson made, as paths relative to it."""
    out = list(WORKING)
    if doc.get("data_file"):
        out.append(str(doc["data_file"]))
    out += re.findall(r'"image":\s*"([^"]+)"', json.dumps(doc, default=str))
    return [n for n in dict.fromkeys(out) if inside(folder, n) and (folder / n).exists()]


def embedded(html, name):
    """What the build wrote into `window.<name>=…;`, or None if it is not there."""
    m = re.search(rf"window\.{name}=(\{{.*?\}});(?:window\.|</script>)", html, re.S)
    try:
        return json.loads(m.group(1)) if m else None
    except ValueError:
        return None


def problems(folder, doc):
    """Why this folder is not safe to clear: a page that cannot stand alone needs its working files."""
    page, src = folder / "lesson.html", folder / "lesson.yaml"
    if not page.is_file() or not page.stat().st_size:
        return ["lesson.html is missing or empty: build the lesson first"]
    out = []
    if page.stat().st_mtime < src.stat().st_mtime:
        out.append("lesson.html is older than lesson.yaml: build the lesson again")
    html = page.read_text(encoding="utf-8")
    if doc.get("data_file"):
        f, have = folder / str(doc["data_file"]), embedded(html, "VIZOS_DATA")
        if have is None:
            out.append("lesson.html does not hold its data: build the lesson again")
        elif f.exists() and json.loads(f.read_text()) != have:
            out.append(f"lesson.html does not hold the data now in {doc['data_file']}: build the lesson again")
    assets = embedded(html, "VIZOS_ASSETS") or {}
    for img in re.findall(r'"image":\s*"([^"]+)"', json.dumps(doc, default=str)):
        if img not in assets:
            out.append(f"lesson.html does not hold the image {img}: build the lesson again")
    return out


def attic_for(slug):
    """A new attic folder: tidying twice in a day keeps both."""
    base = home_dir() / "attic" / f"{slug}-{datetime.date.today().isoformat()}"
    box, k = base, 1
    while box.exists():
        k += 1
        box = base.with_name(f"{base.name}-{k}")
    return box


def tidy(folder, keep, dry):
    src = folder / "lesson.yaml"
    if not src.is_file():
        return f"tidy: no lesson.yaml in {folder}"
    doc = yaml.safe_load(src.read_text(encoding="utf-8")) or {}
    why = problems(folder, doc)
    if why:
        return "tidy: refused, nothing moved\n  " + "\n  ".join(why)
    moves = [n for n in names_of(folder, doc) if n not in keep and Path(n).parts[0] not in keep]
    tops = {Path(n).parts[0] for n in moves}
    left = sorted(p.name for p in folder.iterdir() if p.name not in KEEP and p.name not in tops)
    box = attic_for(folder.name)
    for n in moves:
        print(f"{'would move' if dry else 'moved'} {n} -> {box}")
        if not dry:
            (box / n).parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(folder / n), str(box / n))
    if moves and not dry:
        (box / FROM).write_text(str(folder) + "\n")
    print(f"tidy: {len(moves)} moved, kept lesson.html and lesson.yaml" + (f"; left alone: {', '.join(left)}" if left else ""))


def restore(folder, dry):
    stamp = lambda p: re.fullmatch(r"(\d{4}-\d\d-\d\d)(?:-(\d+))?", p.name[len(folder.name) + 1:])
    boxes = [p for p in (home_dir() / "attic").glob(f"{folder.name}-*") if stamp(p)]
    boxes.sort(key=lambda p: (stamp(p)[1], int(stamp(p)[2] or 1)))   # the date, then the tidy of that day
    mine = [p for p in boxes if (p / FROM).is_file() and (p / FROM).read_text().strip() == str(folder)]
    if not (mine or boxes):
        return f"tidy: nothing in the attic for {folder.name}"
    box = (mine or boxes)[-1]
    if not mine:
        print(f"tidy: no attic copy came from {folder}; using the newest for this name")
    files = sorted(p for p in box.rglob("*") if p.is_file() and p.relative_to(box) != Path(FROM))
    clash = [str(p.relative_to(box)) for p in files if (folder / p.relative_to(box)).exists()]
    if clash:
        return f"tidy: refused, nothing moved: these are already in {folder}: {', '.join(clash)}"
    for p in files:
        rel = p.relative_to(box)
        print(f"{'would restore' if dry else 'restored'} {rel}")
        if not dry:
            (folder / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(p), str(folder / rel))
    if not dry:
        shutil.rmtree(box)
    print(f"tidy: {len(files)} file{'' if len(files) == 1 else 's'} {'would come' if dry else 'came'} back from {box}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder")
    ap.add_argument("--restore", action="store_true", help="bring the newest attic copy back")
    ap.add_argument("--dry-run", action="store_true", help="print the moves and change nothing")
    ap.add_argument("--keep", action="append", default=[], metavar="NAME", help="spare this file (repeatable)")
    a = ap.parse_args()
    folder = Path(a.folder).resolve()
    if folder.is_relative_to(SKILLS):
        return f"tidy: refused: {folder} is inside the plugin's skills folder, and the examples there are regression tests"
    if not folder.is_dir():
        return f"tidy: no such folder: {folder}"
    return restore(folder, a.dry_run) if a.restore else tidy(folder, set(a.keep), a.dry_run)


if __name__ == "__main__":
    sys.exit(main())
