#!/usr/bin/env python3
"""Build the block map page from docs/map.yaml, with live facts from the repo.

    python3 tools/block_map.py            # writes out/map/index.html
    python3 tools/block_map.py --check    # also lint-builds the two quick-check lessons (no browser)

The page shows where the work stands: what waits on the user, what comes next, the
block graph, each block's detail under a toggle, and health facts the script measures
itself (git state, skill-file reading cost against budget, built pages older than the kit).
It prints its own warnings: a ledger block missing from the map, an unknown status,
a dependency on an unknown block, a missing path, a stale map date.
Then republish out/map/index.html to the `artifact` URL in docs/map.yaml.
"""
import argparse, datetime as dt, html, json, os, re, subprocess, sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
MAP = ROOT / "docs/map.yaml"
LEDGER = ROOT / "docs/c10-visuals.md"
KIT = ROOT / "plugins/viz-os/skills/class/kit"
KIT_EXTRA = [ROOT / "plugins/viz-os/skills/deck/kit"]
QUICK = ["board-gallery", "pca-2-how"]
STATUS = {  # label, css class, counts as finished
    "done": ("done", "done", True), "approved": ("approved", "appr", True),
    "review": ("your review", "rev", False), "active": ("in work", "act", False),
    "next": ("proposed", "nxt", False), "todo": ("to do", "todo", False),
    "parked": ("parked", "park", False), "dropped": ("dropped", "drop", True),
}
SHIPS = {"plugin": "in plugin", "mockup": "mock-up only", "none": ""}
WARN = []


def warn(msg):
    WARN.append(msg)
    print(f"block_map: {msg}", file=sys.stderr)


def git(*args):
    try:
        return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, timeout=20).stdout.strip()
    except Exception:
        return ""


def esc(s):
    return html.escape(str(s), quote=True)


def inline(s):
    s = esc(s)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)
    return s


def prose(text):
    """Paragraphs and '- ' lists; continuation lines join the item above."""
    if not text:
        return ""
    out, para, items = [], [], []

    def flush():
        if para:
            out.append(f"<p>{inline(' '.join(para))}</p>"); para.clear()
        if items:
            out.append("<ul>" + "".join(f"<li>{inline(i)}</li>" for i in items) + "</ul>"); items.clear()

    for raw in str(text).splitlines():
        line = raw.strip()
        if not line:
            flush(); continue
        if line.startswith("- "):
            if para:
                flush()
            items.append(line[2:])
        elif items and raw.startswith("  "):
            items[-1] += " " + line
        else:
            if items:
                flush()
            para.append(line)
    flush()
    return "".join(out)


def facts():
    branch = git("rev-parse", "--abbrev-ref", "HEAD")
    head = git("log", "-1", "--format=%h|%ad|%s", "--date=short").split("|", 2)
    dirty = [l for l in git("status", "--porcelain").splitlines() if l.strip()]
    try:
        version = json.loads((ROOT / "plugins/viz-os/.claude-plugin/plugin.json").read_text())["version"]
    except Exception:
        version = "unknown"
    return {"branch": branch, "head": head[0] if head else "", "head_date": head[1] if len(head) > 1 else "",
            "head_msg": head[2] if len(head) > 2 else "", "dirty": len(dirty),
            "dirty_plugin": sum(1 for l in dirty if "plugins/" in l), "version": version}


def budget(cfg):
    rows, base = [], (cfg or {}).get("base")
    for path, allow in ((cfg or {}).get("files") or {}).items():
        p = ROOT / path
        now = len(p.read_text().splitlines()) if p.exists() else None
        old = git("show", f"{base}:{path}")
        then = len(old.splitlines()) if old else 0
        if now is None:
            warn(f"budget file missing: {path}"); continue
        rows.append({"file": Path(path).name, "now": now, "grew": now - then, "allow": allow})
    return rows


NO_PAGE = {"lesson_lint.py", "memory.py", "tidy.py", "home.py", "storyboard.py"}   # never change a built page


def kit_time():
    files = [f for d in [KIT, *KIT_EXTRA] for f in d.rglob("*") if f.is_file() and f.suffix in (".js", ".css")]
    files += [f for f in (ROOT / "plugins/viz-os/skills/class/scripts").glob("*.py") if f.name not in NO_PAGE]
    return max((f.stat().st_mtime for f in files), default=0)


def pages(items):
    kt, out = kit_time(), []
    for p in items or []:
        f = ROOT / p["path"]
        row = {**p, "exists": f.exists(), "stale": False, "built": ""}
        if not f.exists():
            warn(f"page missing: {p['path']}")
        else:
            row["built"] = dt.datetime.fromtimestamp(f.stat().st_mtime).strftime("%d %b %H:%M")
            row["stale"] = bool(p.get("kit")) and f.stat().st_mtime < kt
        out.append(row)
    return out


def quick_check():
    res = []
    for name in QUICK:
        y = ROOT / f"plugins/viz-os/skills/class/examples/{name}/lesson.yaml"
        dst = ROOT / f"out/map/lint-{name}.html"
        r = subprocess.run([sys.executable, "plugins/viz-os/skills/class/scripts/lesson.py", str(y), "-o", str(dst)],
                           cwd=ROOT, capture_output=True, text=True, timeout=300)
        m = re.search(r"(\d+) errors\s+(\d+) warnings", r.stdout + r.stderr)
        res.append({"name": name, "errors": int(m.group(1)) if m else None, "warnings": int(m.group(2)) if m else None})
    return res


def ledger_ids():
    if not LEDGER.exists():
        return set()
    return set(re.findall(r"^\| (C10[a-z])\b", LEDGER.read_text(), re.M))


def validate(m):
    ids = {str(b["id"]) for b in m["blocks"]}
    for b in m["blocks"]:
        if b.get("status") not in STATUS:
            warn(f"{b['id']}: unknown status {b.get('status')!r}")
        if b.get("ships", "none") not in SHIPS:
            warn(f"{b['id']}: unknown ships {b.get('ships')!r}")
        if b.get("lane") not in m["lanes"]:
            warn(f"{b['id']}: unknown lane {b.get('lane')!r}")
        for a in (b.get("after") or []) + (b.get("optional_after") or []):
            if str(a) not in ids:
                warn(f"{b['id']}: after unknown block {a}")
        for w in b.get("where") or []:
            if not (ROOT / w).exists():
                warn(f"{b['id']}: path missing: {w}")
    for i in sorted(ledger_ids() - ids):
        warn(f"{i} is in docs/c10-visuals.md but not in docs/map.yaml")
    last = git("log", "-1", "--format=%ad", "--date=short")
    if last and str(m.get("updated")) < last:
        warn(f"map updated {m.get('updated')} is older than the last commit {last}")


def layout(m):
    blocks = {str(b["id"]): b for b in m["blocks"]}
    depth = {}

    def d(i, seen=()):
        if i in depth:
            return depth[i]
        if i in seen:
            warn(f"dependency loop at {i}"); return 0
        b = blocks[i]
        ps = [str(a) for a in (b.get("after") or []) + (b.get("optional_after") or []) if str(a) in blocks]
        depth[i] = b["col"] if isinstance(b.get("col"), int) else 1 + max((d(p, seen + (i,)) for p in ps), default=-1)
        return depth[i]

    for i in blocks:
        d(i)
    NW, NH, CG, RG, LW, PAD = 156, 60, 34, 14, 128, 14
    cells, y, pos, rows = {}, PAD, {}, []
    for lane in m["lanes"]:
        inlane = [i for i in blocks if blocks[i].get("lane") == lane]
        if not inlane:
            continue
        stack = {}
        for i in inlane:
            stack.setdefault(depth[i], []).append(i)
        h = max(len(v) for v in stack.values())
        rows.append((lane, y, h * NH + (h - 1) * RG))
        for col, ids in stack.items():
            for k, i in enumerate(ids):
                pos[i] = (LW + col * (NW + CG), y + k * (NH + RG))
        y += h * NH + (h - 1) * RG + 26
    width = LW + (max(depth.values()) + 1) * (NW + CG) - CG + PAD
    return blocks, pos, rows, width, y - 26 + PAD, NW, NH


def svg_map(m):
    blocks, pos, rows, W, H, NW, NH = layout(m)
    o = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Block graph: each block after the blocks it needs">',
         '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
         '<path class="arrow" d="M0 0L10 5L0 10z"/></marker></defs>']
    for lane, y, h in rows:
        o.append(f'<rect class="laneband" x="4" y="{y - 7}" width="{W - 8}" height="{h + 14}"/>')
        words, lines, cur = lane.split(), [], ""
        for w in words:
            if len(cur) + len(w) > 13 and cur:
                lines.append(cur); cur = w
            else:
                cur = f"{cur} {w}".strip()
        lines.append(cur)
        for k, t in enumerate(lines):
            o.append(f'<text class="lane" x="16" y="{y + 16 + k * 15}">{esc(t.upper())}</text>')
    for i, b in blocks.items():
        if b.get("edges") is False:
            continue
        for a, opt in [(str(x), False) for x in b.get("after") or []] + [(str(x), True) for x in b.get("optional_after") or []]:
            if a not in pos:
                continue
            x1, y1 = pos[a][0] + NW, pos[a][1] + NH / 2
            x2, y2 = pos[i][0] - 2, pos[i][1] + NH / 2
            dx = max(18, (x2 - x1) / 2)
            o.append(f'<path class="edge{" opt" if opt else ""}" d="M{x1} {y1}C{x1 + dx} {y1} {x2 - dx} {y2} {x2} {y2}" marker-end="url(#ah)"/>')
    for i, b in blocks.items():
        x, y = pos[i]
        st = STATUS.get(b.get("status"), ("?", "todo", False))
        sub = f"you: {b['you']}" if b.get("you") else SHIPS.get(b.get("ships", "none"), "")
        o.append(f'<a href="#b-{esc(i)}" class="node {st[1]}"><title>{esc(i)} {esc(b.get("name", ""))}: {esc(st[0])}</title>'
                 f'<rect x="{x}" y="{y}" width="{NW}" height="{NH}"/>'
                 f'<text class="nid" x="{x + 11}" y="{y + 18}">{esc(i)}</text>'
                 f'<text class="flag" x="{x + NW - 10}" y="{y + 18}" text-anchor="end">{esc(st[0].upper())}</text>'
                 f'<text class="ntitle" x="{x + 11}" y="{y + 37}">{esc(b.get("name", ""))}</text>'
                 f'<text class="nsub" x="{x + 11}" y="{y + 52}">{esc(sub)}</text></a>')
    o.append("</svg>")
    return "".join(o)


def chip(status):
    st = STATUS.get(status, (status, "todo", False))
    return f'<span class="chip {st[1]}">{esc(st[0])}</span>'


def render(m, f, bud, pg, qc):
    blocks = m["blocks"]
    c10 = [b for b in blocks if str(b["id"]).startswith("C10")]
    fin = sum(1 for b in c10 if STATUS.get(b["status"], ("", "", False))[2])
    counts = {}
    for b in c10:
        counts[b["status"]] = counts.get(b["status"], 0) + 1
    bar = "".join(f'<span class="seg {STATUS[s][1]}" style="flex:{n}" title="{esc(STATUS[s][0])}: {n}"></span>'
                  for s, n in sorted(counts.items(), key=lambda kv: list(STATUS).index(kv[0])) if s in STATUS)
    tally = " · ".join(f"{n} {STATUS[s][0]}" for s, n in sorted(counts.items(), key=lambda kv: list(STATUS).index(kv[0])) if s in STATUS)
    stale = [p for p in pg if p["stale"]]
    over = [r for r in bud if r["grew"] > r["allow"]]

    meta = [f'as of {esc(m.get("updated"))}', f'branch <code>{esc(f["branch"])}</code>',
            f'last commit <code>{esc(f["head"])}</code> {esc(f["head_date"])}',
            f'{f["dirty"]} changed or new paths not committed ({f["dirty_plugin"]} in the plugin)', f'plugin {esc(f["version"])}']
    if qc:
        meta.append("quick lint: " + ", ".join(
            f'{esc(q["name"])} {q["errors"]} errors {q["warnings"]} warnings' if q["errors"] is not None else f'{esc(q["name"])} did not build'
            for q in qc))

    health = []
    health.append(f'<span class="hk {"bad" if over else "ok"}">{"reading cost over budget" if over else "reading cost in budget"}</span>')
    health.append(f'<span class="hk {"bad" if stale else "ok"}">{len(stale)} built page{"s" if len(stale) != 1 else ""} older than the kit</span>')
    health.append(f'<span class="hk {"bad" if WARN else "ok"}">{len(WARN)} map warning{"s" if len(WARN) != 1 else ""}</span>')

    wait = "".join(f'<details class="item"><summary><span class="dot rev"></span>{inline(w["title"])}</summary>{prose(w.get("more"))}</details>'
                   for w in m.get("waiting") or [])
    nxt = "".join(f'<details class="item"><summary><span class="num">{k}</span>{inline(n["title"])}'
                  f'{f" <span class=mono>{esc(n["id"])}</span>" if n.get("id") else ""}</summary>{prose(n.get("more"))}</details>'
                  for k, n in enumerate(m.get("next") or [], 1))
    chg = "".join(f'<span class="cg {STATUS.get(c["status"], ("", "todo"))[1]}" title="{esc(c["name"])}: {esc(STATUS.get(c["status"], (c["status"],))[0])}">'
                  f'<b>{esc(c["id"])}</b><i>{esc(c["name"])}</i></span>' for c in m.get("changes") or [])

    lanes = []
    for lane in m["lanes"]:
        bl = [b for b in blocks if b.get("lane") == lane]
        if not bl:
            continue
        rows = []
        for b in bl:
            parts = "".join(f'<span class="pt {STATUS.get(p["status"], ("", "todo"))[1]}">{esc(p["id"])} {esc(p["name"])}</span>'
                            for p in b.get("parts") or [])
            after = ", ".join(map(str, b.get("after") or [])) + (" (optional: " + ", ".join(map(str, b["optional_after"])) + ")" if b.get("optional_after") else "")
            where = "".join(f"<li><code>{esc(w)}</code></li>" for w in b.get("where") or [])
            body = prose(b.get("more"))
            if parts:
                body += f'<div class="parts">{parts}</div>'
            facts_ = []
            if after:
                facts_.append(f"after {esc(after)}")
            if b.get("commit"):
                facts_.append(f"commit <code>{esc(b['commit'])}</code>")
            if b.get("you"):
                facts_.append(f"your part: {esc(b['you'])}")
            if facts_:
                body += f'<p class="small">{" · ".join(facts_)}</p>'
            if where:
                body += f'<ul class="where">{where}</ul>'
            ships = SHIPS.get(b.get("ships", "none"), "")
            rows.append(f'<details class="blk" id="b-{esc(b["id"])}"><summary><span class="bid">{esc(b["id"])}</span>'
                        f'<span class="bname">{esc(b.get("name", ""))}</span>{chip(b["status"])}'
                        f'{f"<span class=ships>{esc(ships)}</span>" if ships else ""}'
                        f'<span class="bline">{inline(b.get("line", ""))}</span></summary><div class="body">{body}</div></details>')
        lanes.append(f'<section class="lanegrp"><h3>{esc(lane)}</h3>{"".join(rows)}</section>')

    brow = "".join(f'<tr><td><code>{esc(r["file"])}</code></td><td class="n">{r["now"]}</td>'
                   f'<td class="n {"badt" if r["grew"] > r["allow"] else ""}">+{r["grew"]}</td><td class="n">+{r["allow"]}</td></tr>' for r in bud)
    prow = "".join(f'<tr><td><code>{esc(p["path"])}</code></td><td>{esc(p.get("role", ""))}</td><td class="n">{esc(p["built"]) or "missing"}</td>'
                   f'<td>{"<span class=badt>older than kit</span>" if p["stale"] else ("current" if p.get("kit") else "own look")}</td></tr>' for p in pg)
    rebuild = "".join(f"<li><code>python3 plugins/viz-os/skills/class/scripts/lesson.py {esc(p['yaml'])}</code></li>" for p in stale if p.get("yaml"))
    warns = "".join(f"<li>{esc(w)}</li>" for w in WARN) or "<li>none</li>"

    return TEMPLATE.format(
        title=esc(m.get("title", "")), meta=" · ".join(meta), now=inline(m.get("now", "")), bar=bar,
        progress=f"{fin} of {len(c10)} C10 blocks finished", tally=esc(tally), health="".join(health),
        wait=wait, next=nxt, svg=svg_map(m), changes=chg, lanes="".join(lanes), brow=brow, prow=prow,
        rebuild=f"<p class=small>Rebuild the stale pages:</p><ul class=where>{rebuild}</ul>" if rebuild else "",
        warns=warns, art=esc(m.get("artifact", "")))


TEMPLATE = """<title>C10 Block Map</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@500;700&display=swap">
<style>
/* layout: one column; where we stand, then waiting and next side by side, the graph, every block under a toggle, health. Look: the viz-os board (flat plates, grey borders, one orange) */
:root {{
  --bg:#0b0c0e; --surf:#171819; --surf2:#222324; --line:#565653; --dim:#353634; --ink:#f2f2f0; --mist:#b3b1aa;
  --accent:#ff5a36; --wash:rgba(255,90,54,.14); --good:#5fdcc4; --goodw:rgba(95,220,196,.12); --warn:#ffc163;
  --f-ui:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif; --f-mono:"JetBrains Mono",ui-monospace,Menlo,monospace;
  color-scheme:dark;
}}
@media (prefers-color-scheme: light) {{ :root:not([data-theme="dark"]) {{
  --bg:#f3f3f1; --surf:#ffffff; --surf2:#ececE9; --line:#8a8984; --dim:#cfcec9; --ink:#161616; --mist:#55534e;
  --accent:#d9431f; --wash:rgba(217,67,31,.10); --good:#0f7f6c; --goodw:rgba(15,127,108,.10); --warn:#9a6200; color-scheme:light }} }}
:root[data-theme="light"] {{
  --bg:#f3f3f1; --surf:#ffffff; --surf2:#ececE9; --line:#8a8984; --dim:#cfcec9; --ink:#161616; --mist:#55534e;
  --accent:#d9431f; --wash:rgba(217,67,31,.10); --good:#0f7f6c; --goodw:rgba(15,127,108,.10); --warn:#9a6200; color-scheme:light }}
* {{ box-sizing:border-box }}
body {{ background:var(--bg); color:var(--ink); font:15px/1.55 var(--f-ui); margin:0 }}
.wrap {{ max-width:1100px; margin:0 auto; padding-block:36px 64px; padding-left:max(16px,env(safe-area-inset-left,0px));
  padding-right:max(16px,env(safe-area-inset-right,0px)); display:grid; gap:34px }}
.wrap > * {{ min-width:0 }}
h1 {{ font-size:32px; line-height:1.1; margin:0; font-weight:800; letter-spacing:-.01em; text-wrap:balance }}
h2 {{ margin:0 0 12px; font:700 12px/1 var(--f-mono); letter-spacing:.12em; text-transform:uppercase; color:var(--mist) }}
h3 {{ margin:0 0 8px; font:700 11px/1 var(--f-mono); letter-spacing:.12em; text-transform:uppercase; color:var(--mist) }}
p {{ margin:0 0 8px; max-width:72ch }} p:last-child {{ margin-bottom:0 }}
code, .mono {{ font-family:var(--f-mono); font-size:.86em }}
.eyebrow {{ font:700 11px var(--f-mono); letter-spacing:.12em; text-transform:uppercase; color:var(--accent); margin-bottom:8px }}
.meta {{ color:var(--mist); font-size:13px; margin-top:10px; font-variant-numeric:tabular-nums }}
.now {{ background:var(--surf); border:2px solid var(--line); border-left:4px solid var(--accent); padding:14px 16px; margin-top:16px; max-width:none }}
.prog {{ display:grid; gap:8px }}
.bar {{ display:flex; height:14px; border:2px solid var(--line); background:var(--surf) }}
.seg {{ display:block; min-width:6px }}
.seg.done {{ background:var(--dim) }} .seg.rev {{ background:var(--accent) }} .seg.act {{ background:var(--wash); }}
.seg.todo {{ background:repeating-linear-gradient(45deg,var(--surf2) 0 4px,var(--surf) 4px 8px) }} .seg.park {{ background:none }}
.prog .row {{ display:flex; flex-wrap:wrap; gap:6px 16px; justify-content:space-between; font-size:13px; color:var(--mist) }}
.prog b {{ color:var(--ink) }}
.hks {{ display:flex; flex-wrap:wrap; gap:8px }}
.hk {{ font:700 11px var(--f-mono); letter-spacing:.06em; text-transform:uppercase; padding:5px 9px; border:2px solid var(--line) }}
.hk.ok {{ color:var(--good); border-color:var(--good) }} .hk.bad {{ color:var(--warn); border-color:var(--warn) }}
.two {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:24px }}
.two > * {{ min-width:0 }}
details.item {{ background:var(--surf); border:2px solid var(--line); margin-bottom:8px }}
details.item > summary {{ cursor:pointer; padding:10px 12px; display:flex; gap:10px; align-items:baseline; list-style:none; font-weight:600 }}
details.item > summary::-webkit-details-marker, details.blk > summary::-webkit-details-marker {{ display:none }}
details.item > summary::after, details.blk > summary::after {{ content:"+"; margin-left:auto; font:700 16px var(--f-mono); color:var(--mist); padding-left:8px }}
details[open] > summary::after {{ content:"−" }}
details.item > :not(summary) {{ padding:0 14px 0 34px }} details.item > :last-child {{ padding-bottom:12px }}
details.item p, details.item ul, .body p, .body ul {{ color:var(--mist); font-size:14px }}
details ul {{ margin:0 0 8px; padding-left:18px }}
.dot {{ width:10px; height:10px; flex:none; border:2px solid var(--accent); background:var(--wash); transform:translateY(1px) }}
.num {{ font:700 13px var(--f-mono); color:var(--accent); flex:none; width:14px }}
summary:focus-visible, a:focus-visible {{ outline:2px solid var(--accent); outline-offset:2px }}
.map {{ overflow-x:auto; background:var(--surf); border:2px solid var(--line) }}
.map svg {{ display:block; min-width:940px; width:100%; height:auto }}
.laneband {{ fill:var(--bg); opacity:.55 }}
.lane {{ font:700 10.5px var(--f-mono); letter-spacing:.1em; fill:var(--mist) }}
.node rect {{ fill:var(--surf2); stroke:var(--line); stroke-width:2 }}
.node:hover rect {{ stroke:var(--ink) }}
.node.done rect, .node.drop rect {{ fill:var(--surf); stroke:var(--dim) }}
.node.done .ntitle {{ fill:var(--mist) }}
.node.rev rect, .node.act rect {{ fill:var(--wash); stroke:var(--accent); stroke-width:3 }}
.node.appr rect {{ stroke:var(--accent) }}
.node.nxt rect {{ stroke:var(--ink); stroke-dasharray:5 4 }}
.node.park rect {{ fill:none; stroke:var(--dim); stroke-dasharray:6 5 }}
.nid {{ font:700 12px var(--f-mono); fill:var(--mist) }}
.node.rev .nid, .node.act .nid, .node.rev .flag, .node.act .flag {{ fill:var(--accent) }}
.flag {{ font:700 9.5px var(--f-mono); letter-spacing:.08em; fill:var(--mist) }}
.node.done .flag {{ fill:var(--good) }}
.ntitle {{ font:600 14px var(--f-ui); fill:var(--ink) }}
.nsub {{ font:500 11px var(--f-mono); fill:var(--mist) }}
.edge {{ fill:none; stroke:var(--line); stroke-width:2 }} .edge.opt {{ stroke-dasharray:6 5 }} .arrow {{ fill:var(--line) }}
.legend {{ display:flex; flex-wrap:wrap; gap:6px 18px; margin-top:10px; color:var(--mist); font-size:13px }}
.legend i {{ display:inline-block; width:22px; height:13px; vertical-align:-2px; margin-right:6px; border:2px solid var(--line); background:var(--surf2) }}
.legend i.done {{ border-color:var(--dim); background:var(--surf) }} .legend i.rev {{ border:3px solid var(--accent); background:var(--wash) }}
.legend i.nxt {{ border:2px dashed var(--ink) }} .legend i.park {{ border:2px dashed var(--dim); background:none }}
.changes {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:8px }}
.cg {{ background:var(--surf); border:2px solid var(--line); padding:8px 10px; display:flex; gap:8px; align-items:baseline; min-width:0 }}
.cg b {{ font:700 13px var(--f-mono) }} .cg i {{ font-style:normal; font-size:13px; color:var(--mist); overflow-wrap:anywhere }}
.cg.done {{ border-color:var(--dim) }} .cg.done b {{ color:var(--good) }}
.cg.act {{ border-color:var(--accent) }} .cg.act b {{ color:var(--accent) }}
.cg.drop {{ border-style:dashed; border-color:var(--dim) }} .cg.drop i {{ text-decoration:line-through }}
.lanes {{ display:grid; gap:22px }}
details.blk {{ background:var(--surf); border:2px solid var(--line); border-top-width:0 }}
.lanegrp details.blk:first-of-type {{ border-top-width:2px }}
details.blk > summary {{ cursor:pointer; list-style:none; padding:10px 12px; display:grid;
  grid-template-columns:52px 130px auto auto 1fr auto; gap:6px 12px; align-items:baseline }}
details.blk:target, details.blk.flash {{ outline:3px solid var(--accent); outline-offset:-3px }}
.bid {{ font:700 13px var(--f-mono) }} .bname {{ font-weight:600 }}
.bline {{ color:var(--mist); font-size:14px; min-width:0 }}
.chip {{ font:700 10.5px var(--f-mono); letter-spacing:.06em; text-transform:uppercase; padding:3px 7px; border:2px solid var(--line); white-space:nowrap }}
.chip.done {{ color:var(--good); border-color:var(--good) }} .chip.rev, .chip.act {{ color:var(--accent); border-color:var(--accent); background:var(--wash) }}
.chip.nxt {{ border-style:dashed }} .chip.park, .chip.drop {{ color:var(--mist); border-style:dashed }}
.ships {{ font:500 11px var(--f-mono); color:var(--mist); white-space:nowrap }}
.body {{ padding:0 14px 14px 76px }}
.parts {{ display:flex; flex-wrap:wrap; gap:6px; margin:4px 0 10px }}
.pt {{ font:500 12px var(--f-mono); border:2px solid var(--dim); padding:2px 7px; color:var(--mist) }}
.pt.rev {{ border-color:var(--accent); color:var(--ink) }}
.small {{ font-size:13px; color:var(--mist) }}
ul.where {{ list-style:none; padding:0; margin:0; display:grid; gap:2px }} ul.where code {{ color:var(--ink); overflow-wrap:anywhere }}
.tbl {{ overflow-x:auto; border:2px solid var(--line); margin-bottom:12px }}
table {{ border-collapse:collapse; width:100%; background:var(--surf); font-size:13.5px }}
th, td {{ text-align:left; padding:8px 10px; border-bottom:1px solid var(--dim); vertical-align:top }}
th {{ font:700 10.5px var(--f-mono); letter-spacing:.1em; text-transform:uppercase; color:var(--mist); background:var(--surf2) }}
td.n {{ font-variant-numeric:tabular-nums; white-space:nowrap }} .badt {{ color:var(--warn); font-weight:700 }}
tr:last-child td {{ border-bottom:0 }}
details.health > summary {{ cursor:pointer; font:700 12px var(--f-mono); letter-spacing:.12em; text-transform:uppercase; color:var(--mist); margin-bottom:12px }}
.foot {{ color:var(--mist); font-size:13px; border-top:2px solid var(--dim); padding-top:14px }}
.tools {{ display:flex; gap:8px; margin-bottom:10px }}
button {{ font:700 11px var(--f-mono); letter-spacing:.06em; text-transform:uppercase; color:var(--ink); background:var(--surf);
  border:2px solid var(--line); padding:6px 10px; cursor:pointer }}
button:hover {{ border-color:var(--ink) }}
@media (max-width:760px) {{
  details.blk > summary {{ grid-template-columns:52px 1fr auto; }}
  .bline {{ grid-column:1 / -1 }} .ships {{ grid-column:2 }} details.blk > summary::after {{ grid-row:1; grid-column:3 }}
  .body {{ padding-left:14px }} details.item > :not(summary) {{ padding-left:14px }}
}}
@media (prefers-reduced-motion: no-preference) {{ details.blk.flash {{ transition:outline-color .6s }} }}
</style>
<div class="wrap">
  <header>
    <div class="eyebrow">viz-os · class skill · block map</div>
    <h1>{title}</h1>
    <div class="meta">{meta}</div>
    <p class="now">{now}</p>
  </header>

  <section class="prog" aria-label="Progress">
    <div class="bar">{bar}</div>
    <div class="row"><span><b>{progress}</b> · {tally}</span></div>
    <div class="hks">{health}</div>
  </section>

  <section class="two">
    <div><h2>Waiting on you</h2>{wait}</div>
    <div><h2>Next up, proposed order</h2>{next}</div>
  </section>

  <section>
    <h2>The blocks and what waits on what</h2>
    <div class="map">{svg}</div>
    <div class="legend"><span><i class="done"></i>done</span><span><i class="rev"></i>your review or in work</span>
      <span><i class="nxt"></i>proposed next</span><span><i></i>to do</span><span><i class="park"></i>parked</span>
      <span>Press a block to open its notes below.</span></div>
  </section>

  <section>
    <h2>The draw-math to-do list</h2>
    <div class="changes">{changes}</div>
  </section>

  <section>
    <h2>Every block</h2>
    <div class="tools"><button type="button" id="openall">Open all</button><button type="button" id="closeall">Close all</button></div>
    <div class="lanes">{lanes}</div>
  </section>

  <section>
    <details class="health"><summary>Health, measured when the map was built</summary>
      <h3>Lines a lesson agent reads on every run</h3>
      <div class="tbl"><table><thead><tr><th>File</th><th>Lines now</th><th>Grew since branch start</th><th>Budget</th></tr></thead><tbody>{brow}</tbody></table></div>
      <h3>Pages to open, and whether they show the current kit</h3>
      <div class="tbl"><table><thead><tr><th>Page</th><th>What it is</th><th>Built</th><th>Look</th></tr></thead><tbody>{prow}</tbody></table></div>
      {rebuild}
      <h3>Map warnings</h3><ul class="small">{warns}</ul>
    </details>
  </section>

  <p class="foot">Source: <code>docs/map.yaml</code>, built by <code>python3 tools/block_map.py --check</code>. The block's chat updates the file when a block starts, needs you, or ends, then republishes this page.</p>
</div>
<script>
(function () {{
  function openHash() {{
    var id = location.hash.slice(1); if (!id) return;
    var el = document.getElementById(id); if (!el || el.tagName !== 'DETAILS') return;
    el.open = true; el.classList.add('flash'); setTimeout(function () {{ el.classList.remove('flash'); }}, 1400);
  }}
  window.addEventListener('hashchange', openHash); openHash();
  function all(v) {{ document.querySelectorAll('details.blk').forEach(function (d) {{ d.open = v; }}); }}
  document.getElementById('openall').addEventListener('click', function () {{ all(true); }});
  document.getElementById('closeall').addEventListener('click', function () {{ all(false); }});
}})();
</script>
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check", action="store_true", help="lint-build the two quick-check lessons (no browser) and show the counts")
    ap.add_argument("-o", default="out/map/index.html")
    a = ap.parse_args()
    m = yaml.safe_load(MAP.read_text())
    validate(m)
    f, bud, pg = facts(), budget(m.get("budget")), pages(m.get("pages"))
    (ROOT / "out/map").mkdir(parents=True, exist_ok=True)
    qc = quick_check() if a.check else None
    out = ROOT / a.o
    out.write_text(render(m, f, bud, pg, qc))
    stale = sum(1 for p in pg if p["stale"])
    print(f"block_map: {out.relative_to(ROOT)} · {len(m['blocks'])} blocks · {stale} stale pages · {len(WARN)} warnings")
    print(f"block_map: republish to {m.get('artifact')}")


if __name__ == "__main__":
    main()
