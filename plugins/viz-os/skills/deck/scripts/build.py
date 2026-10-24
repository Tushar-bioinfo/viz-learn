#!/usr/bin/env python3
"""Build a viz-os deck: deck.yaml (or .json) -> one self-contained deck.html, after a lint pass.

Usage: build.py path/to/deck.yaml [-o deck.html] [--katex-dir DIR] [--quiet]

The lint enforces the rules that long outputs forget: every symbol in a formula has a plain meaning,
no concept is used before it is introduced, derived table columns show their formula, text stays inside budgets.
ERR lines must be fixed (exit 1). WARN lines are judgement calls; fix them unless you have a reason.
The page loads Inter from Google Fonts and KaTeX 0.16.11 from cdnjs (or inlines KaTeX from --katex-dir / $VIZOS_KATEX_DIR).
"""
import argparse, base64, json, mimetypes, os, re, sys
from pathlib import Path

KIT = Path(__file__).resolve().parent.parent / "kit"
KIT_JS = ["core.js", "chart.js", "slides.js", "deck.js"]
KATEX_V = "0.16.11"
KATEX_CDN = (f'<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/{KATEX_V}/katex.min.css">'
             f'<script defer src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/{KATEX_V}/katex.min.js"></script>')
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300..800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">')

COMMON = {"type", "title", "lead", "eyebrow", "chapter", "introduces", "uses", "more", "derive", "controls", "id", "notes"}
FIELDS = {
    "title": {"kicker", "subtitle", "question", "chips"},
    "chapter": {"q"},
    "statement": {"text", "sub"},
    "idea": {"points", "text", "visual", "layout", "build"},
    "predict": {"q", "options", "answer", "why", "kind", "visual"},
    "equation": {"expr", "tex", "lhs", "terms", "order", "read", "plug", "code", "note", "fmt", "store", "build", "from", "kin"},
    "calc": {"lines", "given", "visual"},
    "table": {"rows", "from", "cols", "focus", "build", "given"},
    "bridge": {"from", "to", "pairs", "breaks"},
    "compare": {"a", "b", "verdict"},
    "quiz": {"cards"},
    "recap": {"answer", "points", "breaks", "next"},
    "map": {"center", "links"},
}
REQUIRED = {"predict": ["q", "options"], "equation": [], "calc": ["lines"], "table": ["cols"], "bridge": ["pairs"],
            "compare": ["a", "b"], "quiz": ["cards"], "recap": ["answer"], "map": ["center", "links"], "statement": ["text"]}
VISUAL = {"chart", "stat", "units", "parts", "flow", "code", "image", "eqn", "svg", "caption", "terms"}
PARTS = {"items", "rows", "total", "share", "fmt", "build"}
# words a learner reads on a slide's face, per type (the more sheet, table cells and chart internals do not count).
# The visual carries the story; past these the slide reads as a page of text. An equation's budget includes the moves
# of its `from:` chain, since where a formula comes from is part of explaining it.
FACE_LIMIT = {"idea": 40, "statement": 30, "equation": 40, "calc": 45, "table": 30, "bridge": 55, "compare": 55,
              "predict": 70, "recap": 60, "map": 60}
CHART = {"x", "y", "series", "marks", "legend", "table", "alt", "controls"}
SERIES_KINDS = {"line", "area", "bars", "hist", "dots", "lollipop", "step"}
MARK_KINDS = {"vline", "hline", "band", "point", "label", "arrow", "line", "fn", "area", "span"}
CONTENT = {"idea", "equation", "calc", "table", "bridge", "compare", "statement", "map"}
FUNCS = set("""abs sqrt exp log ln log2 log10 log1p floor ceil sign round pow sum mean var sd min max median count len quantile cumsum sort rank at first last
seq where clamp choose factorial normPdf normCdf normInv tPdf tCdf binomPmf poisPmf nbPmf gammaPdf betaPdf betaCdf poisCdf binomCdf nbCdf rnorm runif rpois rgamma rnb rbinom""".split())
CONSTS = {"pi", "e", "inf"}
BANNED = re.compile(r"\b(imagine|clearly|obviously|of course|simply|trivially|it is easy to see|it's easy to see|as you know|intuitively|just)\b", re.I)
ABBR = re.compile(r"(?<![\w$\\{])([A-Z][A-Z0-9]{1,5})(?![\w}])")
ABBR_OK = {"OK", "I", "A", "TV", "US", "UK", "PC", "AI", "ID", "QA", "II", "III", "IV", "VS", "AND", "OR", "NOT", "A1", "A2", "B1", "B2"}


class Lint:
    def __init__(self):
        self.out = []

    def err(self, where, msg):
        self.out.append(("ERR", where, msg))

    def warn(self, where, msg):
        self.out.append(("WARN", where, msg))


def load(path):
    raw = Path(path).read_text(encoding="utf-8")
    if path.suffix.lower() == ".json":
        return json.loads(raw)
    try:
        import yaml
    except ImportError:
        sys.exit("build: PyYAML is needed for .yaml decks (pip install pyyaml), or write the deck as .json")

    class Loader(yaml.SafeLoader):
        pass
    # YAML 1.2 booleans only: yes/no/on/off stay text, so an answer option written as No is not turned into false
    Loader.yaml_implicit_resolvers = {k: [r for r in v if r[0] != "tag:yaml.org,2002:bool"] for k, v in yaml.SafeLoader.yaml_implicit_resolvers.items()}
    Loader.add_implicit_resolver("tag:yaml.org,2002:bool", re.compile(r"^(?:true|True|TRUE|false|False|FALSE)$"), list("tTfF"))
    def parse(text, name):
        try:
            return yaml.load(text, Loader=Loader)
        except yaml.YAMLError as e:   # one readable line instead of a traceback: where, what, and the usual fix
            mk = getattr(e, "problem_mark", None)
            line = text.splitlines()[mk.line] if mk and mk.line < len(text.splitlines()) else ""
            where = f"{name} line {mk.line + 1}, column {mk.column + 1}" if mk else name
            sys.exit(f"ERR  YAML {where}: {getattr(e, 'problem', e)}\n     {line.strip()}\n"
                     "     Fix: inside { } or [ ], quote any text that has  ? : , # [ ] { }  in it, or switch that item to block style (one key per line).")
    doc = parse(raw, Path(path).name)
    base = Path(path).parent
    for inc in doc.pop("include", []) or []:   # chapters in their own files: slides are appended in order
        part = parse((base / inc).read_text(encoding="utf-8"), inc) or {}
        doc.setdefault("slides", []).extend(part.get("slides", part if isinstance(part, list) else []))
        for k in ("data", "derive", "symbols", "abbr"):
            if isinstance(part, dict) and part.get(k):
                doc.setdefault(k, {}).update(part[k])
    return doc


def words(s):
    return len(re.sub(r"\$[^$]*\$|\{\{[^}]*\}\}", "x", str(s or "")).split())


def idents(expr):
    """Names an expression uses, not counting functions."""
    s = str(expr)
    out = []
    for m in re.finditer(r"[A-Za-z_][A-Za-z0-9_]*", s):
        tail = s[m.end():].lstrip()
        # skip digits inside numbers like 1e6
        if m.start() > 0 and (s[m.start() - 1].isdigit() or s[m.start() - 1] == "."):
            continue
        if tail.startswith("("):
            continue
        if m.group() not in out:
            out.append(m.group())
    return out


def funcs(expr):
    return [m.group(1) for m in re.finditer(r"([A-Za-z_][A-Za-z0-9_]*)\s*\(", str(expr))]


def face_words(s):
    """Words on the face of a slide: what the learner has to read before the visual can do its work."""
    w = lambda x: words(x) if isinstance(x, str) else 0
    t = s.get("type", "idea")
    n = sum(w(s.get(k)) for k in ("title", "lead", "eyebrow", "text", "sub", "q", "why", "note", "given", "breaks", "answer", "verdict", "center"))
    n += sum(w(x) for k in ("points", "options") for x in (s.get(k) or []))
    if t == "recap":
        n += sum(w(x) for x in (s.get("breaks") or []) if isinstance(s.get("breaks"), list))
    n += sum(w(ln.get("say")) for ln in s.get("lines") or [] if isinstance(ln, dict))
    n += sum(w(a) + w(b) for pr in s.get("pairs") or [] if isinstance(pr, list) and len(pr) == 2 for a, b in [pr])
    n += sum(w(l.get("to")) + w(l.get("how")) for l in s.get("links") or [] if isinstance(l, dict))
    if t == "equation":   # where the formula comes from: the moves are read as text; chips are labels
        chain = s.get("from") if isinstance(s.get("from"), list) else [s.get("from")] if isinstance(s.get("from"), dict) else []
        n += sum(w(c.get("move")) for c in chain if isinstance(c, dict))   # chip names are labels, like a chart's
    for side in (s.get("a"), s.get("b")):
        if isinstance(side, dict):
            n += sum(w(side.get(k)) for k in ("title", "text", "verdict")) + sum(w(x) for x in side.get("points") or [])
    for v in [s.get("visual")] + [(x or {}).get("visual") for x in (s.get("a"), s.get("b")) if isinstance(x, dict)]:
        if isinstance(v, dict):
            n += w(v.get("caption"))
            st = v.get("stat") or {}
            n += w(st.get("label")) + w(st.get("sub"))
            n += w((v.get("units") or {}).get("label"))
    return n   # labels inside a chart, flow or parts are the visual itself: they have their own limits


def texts_of(node):
    """Every author string in a slide, for word and banned-word checks."""
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for k, v in node.items():
            if k in ("expr", "tex", "fn", "code", "svg", "x", "y", "values", "min", "max", "from", "rows", "at", "to", "eqn", "key", "highlight", "image", "plug") and not (k == "from" and isinstance(v, (list, dict))):
                continue
            yield from texts_of(v)
    elif isinstance(node, list):
        for v in node:
            yield from texts_of(v)


TOP = {"title", "subtitle", "kicker", "question", "answer", "learner", "ladder", "arc", "beats", "chapters", "data", "derive", "symbols", "abbr", "slides", "theme", "include"}


def lint(deck, lint_extra_names=()):
    Lx = Lint()
    for k in set(deck) - TOP:
        Lx.warn("deck", f"unknown top-level key `{k}` (known: {', '.join(sorted(TOP))})")
    if not deck.get("answer"):
        Lx.warn("deck", "no `answer`: write the one-sentence answer before the slides (story.md §1)")
    slides = deck.get("slides") or []
    if not slides:
        Lx.err("deck", "no slides")
        return Lx
    symbols = deck.get("symbols") or {}
    data = deck.get("data") or {}
    derive = deck.get("derive") or {}
    abbr = deck.get("abbr") or {}
    learner = deck.get("learner") or {}
    known = set(learner.get("knows") or [])
    ladder = deck.get("ladder") or {}
    glob = set(data) | set(derive) | CONSTS | set(lint_extra_names)
    for k, v in derive.items():
        check_expr(Lx, "deck derive." + k, v, glob)

    for k, v in symbols.items():
        if not isinstance(v, dict) or not v.get("says"):
            Lx.err(f"symbols.{k}", "every symbol needs `says` (its meaning in plain words)")
        elif words(v["says"]) > 9 and not v.get("short"):
            Lx.warn(f"symbols.{k}", "`says` is long, and it labels numbers in the working: keep it to about 6 words, or add `short:`")

    def meaning(n, extra=None):
        return bool((extra or {}).get(n, {}).get("says") if isinstance((extra or {}).get(n), dict) else False) or bool(isinstance(symbols.get(n), dict) and symbols[n].get("says"))

    introduced = set(known)
    seen_abbr = set(abbr)
    since_check, leads, contents, bridges = 0, 0, 0, 0
    if (slides[0].get("type") or "idea") != "title":
        Lx.warn("slide 1", "start with a `title` slide that asks the deck's question")
    if not deck.get("question"):
        Lx.warn("deck", "no `question`: say what question the deck answers (it frames the story and the recap)")
    for i, s in enumerate(slides):
        t = s.get("type") or "idea"
        where = f"slide {i + 1} ({t}{(' “' + str(s.get('title') or s.get('q') or s.get('text') or '')[:38] + '”') if (s.get('title') or s.get('q') or s.get('text')) else ''})"
        if t not in FIELDS:
            Lx.err(where, f"unknown type `{t}`; use one of {', '.join(sorted(FIELDS))}")
            continue
        extra = set(s) - COMMON - FIELDS[t]
        if extra:
            Lx.err(where, f"unknown field(s) {sorted(extra)} for {t}")
        for f in REQUIRED.get(t, []):
            if not s.get(f):
                Lx.err(where, f"`{f}` is required for {t}")
        if t in CONTENT and t not in ("statement", "map") and not s.get("title"):
            Lx.err(where, "needs a `title`: one line that states the claim of this slide")
        if s.get("title") and words(s["title"]) > 10:
            Lx.warn(where, f"title has {words(s['title'])} words; a headline claim reads best at 4–8")
        if s.get("lead"):
            leads += 1
            if words(s["lead"]) > 14:
                Lx.warn(where, "lead is long; it is one short bridge line from the last slide (≤ 12 words)")
        if t in CONTENT:
            contents += 1
            since_check += 1
        if t in ("predict", "quiz"):
            since_check = 0
        if since_check > 7:
            Lx.warn(where, "8 content slides without a `predict` or `quiz`: add a checkpoint so the learner retrieves, not just reads")
            since_check = 0
        if t == "bridge":
            bridges += 1
        # scope for this slide
        scope = set(glob) | set((s.get("derive") or {}).keys())
        ctls = s.get("controls") or ((s.get("visual") or {}).get("chart") or {}).get("controls") or []
        scope |= {c.get("name") for c in ctls if isinstance(c, dict)}
        for k, v in (s.get("derive") or {}).items():
            check_expr(Lx, f"{where} derive.{k}", v, scope)
        # ladder
        for c in s.get("uses") or []:
            if c not in introduced:
                Lx.warn(where, f"uses `{c}` before any slide introduces it (add it to `introduces:` on an earlier slide, or to learner.knows)")
        for c in s.get("introduces") or []:
            if ladder and c not in ladder:
                Lx.warn(where, f"introduces `{c}`, which is not in the ladder")
            introduced.add(c)
        # text budgets: the visual tells the story, words only point at it
        pts = s.get("points") or []
        for p in pts:
            if words(p) > 16:
                Lx.warn(where, f"a point has {words(p)} words (≤ 16): cut it, or put it on the visual as a label")
        cap = 2 if s.get("visual") else 3
        if t in ("idea", "compare") and len(pts) > cap:
            Lx.warn(where, f"{len(pts)} points (≤ {cap}{' with a visual' if s.get('visual') else ''}): label the visual instead, or move detail to `more:`")
        if t == "idea" and not s.get("visual"):
            Lx.warn(where, "no visual: show it (chart, parts, units, flow, stat or image) and keep words for the caption")
        lim = FACE_LIMIT.get(t)
        if lim and face_words(s) > lim:
            Lx.warn(where, f"{face_words(s)} words on the slide (aim ≤ {lim}): let the visual carry it; cut words or move detail to `more:`")
        cap_ = (s.get("visual") or {}).get("caption") if isinstance(s.get("visual"), dict) else None
        if cap_ and words(cap_) > 20:
            Lx.warn(where, f"caption has {words(cap_)} words (≤ 20): one line that says where to look")
        if t == "statement" and words(s.get("text")) > 22:
            Lx.warn(where, "statement over 22 words: it should be one sentence worth remembering")
        if t == "predict":
            opts = s.get("options") or []
            for a_, b_ in zip(opts, opts[1:]):
                if isinstance(a_, str) and isinstance(b_, str) and words(a_) <= 2 and b_[:1].islower():
                    Lx.warn(where, f"options {a_!r} and {b_!r} look like one option split at a comma: quote it, or use a block list")
                    break
            if any(not isinstance(o, str) for o in opts):
                Lx.err(where, f"options must be text; got {opts!r}. Quote options with commas or colons, or write them as a block list")
            if s.get("answer") is not None and not (0 <= int(s["answer"]) < len(opts)):
                Lx.err(where, f"answer {s['answer']} is not an option index (0–{len(opts) - 1})")
            if not s.get("why"):
                Lx.warn(where, "predict has no `why`: the reveal is where the learning happens")
            elif words(s["why"]) > 35:
                Lx.warn(where, f"`why` has {words(s['why'])} words (≤ 35): the reason in two short sentences, or show it with a `visual`")
        for txt in texts_of(s):
            m = BANNED.search(txt)
            if m:
                Lx.warn(where, f"“{m.group(0)}” asks the reader to already see it; show it or say why")
            for mm in ABBR.finditer(re.sub(r"\$[^$]*\$|\{\{[^}]*\}\}|`[^`]*`", "", txt)):
                a = mm.group(1)
                if a in seen_abbr or a in ABBR_OK or a.isdigit() or re.fullmatch(r"[A-Z]\d*", a):
                    continue
                after = txt[mm.end(): mm.end() + 4]
                before = txt[max(0, mm.start() - 2): mm.start()]
                if "(" in after or before.endswith("("):
                    seen_abbr.add(a)
                    continue
                Lx.warn(where, f"abbreviation {a} is not spelled out: write “{a} (…)” the first time, or add it to `abbr:`")
                seen_abbr.add(a)
            for x in re.findall(r"\{\{([\s\S]+?)\}\}", txt):
                check_expr(Lx, where, re.sub(r"\|\s*(\d+|s\d+|%\d*|e\d*|,|int)\s*$", "", x), scope)
        # type-specific
        if t == "equation":
            lint_equation(Lx, where, s, scope, symbols)
        if t == "calc":
            if len(s.get("lines") or []) > 4:
                Lx.warn(where, f"{len(s['lines'])} lines: 4 or fewer read well; split the working over two slides")
            names = set(scope)
            for j, ln in enumerate(s.get("lines") or []):
                if ln.get("expr"):
                    check_expr(Lx, f"{where} line {j + 1}", ln["expr"], names)
                    for n in idents(ln["expr"]):
                        if n not in CONSTS and not meaning(n):
                            Lx.err(f"{where} line {j + 1}", f"`{n}` appears in the working but has no meaning: add `{n}: {{tex: ..., says: ...}}` under symbols")
                    if ln.get("name"):
                        names.add(ln["name"])
                        if not meaning(ln["name"]):
                            Lx.err(f"{where} line {j + 1}", f"result `{ln['name']}` needs a meaning under symbols")
                elif not ln.get("tex"):
                    Lx.err(f"{where} line {j + 1}", "each line needs `expr` (computed, preferred) or `tex`")
                if not ln.get("say"):
                    Lx.warn(f"{where} line {j + 1}", "each line needs `say`: what this step does, in words")
                elif words(ln["say"]) > 9:
                    Lx.warn(f"{where} line {j + 1}", f"`say` has {words(ln['say'])} words (≤ 9): the working shows the rest")
        if t == "table":
            cols = s.get("cols") or []
            rows = s.get("rows") or []
            keys = set(scope) | {c.get("key") for c in cols} | {k for r in rows if isinstance(r, dict) for k in r}
            if len(cols) > 6:
                Lx.warn(where, f"{len(cols)} columns: more than 6 will not read on a phone")
            if len(rows) > 8:
                Lx.warn(where, f"{len(rows)} rows: show ≤ 8 and say the rest follow the same rule")
            bmode = s.get("build", "cols")
            if bmode not in ("cols", "rows", "cells", True, False):
                Lx.err(where, f"table `build` is {bmode!r}: use cols (one column per step), rows, cells or false")
            nder = sum(1 for c in cols if c.get("expr"))
            nsteps = (nder * len(rows) if bmode == "cells" else len(rows) if bmode == "rows" else nder) + (1 if s.get("given", True) is not False and nder else 0)
            if bmode is not False and nsteps > 15:
                Lx.warn(where, f"the table takes {nsteps} steps: use build: cols, or fewer rows")
            for c in cols:
                if c.get("expr"):
                    check_expr(Lx, f"{where} column {c.get('key')}", c["expr"], keys)
                    if not c.get("says") and not meaning(c.get("key")):
                        Lx.err(f"{where} column {c.get('key')}", "a computed column needs `says`: what the number means")
                    for n in idents(c["expr"]):
                        col = next((x for x in cols if x.get("key") == n), None)
                        if n not in CONSTS and not meaning(n) and not (col and (col.get("says") or col.get("label"))):
                            Lx.err(f"{where} column {c.get('key')}", f"`{n}` is used in the formula but never explained")
        if t == "map" and len(s.get("links") or []) > 6:
            Lx.warn(where, "more than 6 links: keep the strongest connections")
        if t == "map":
            for l in s.get("links") or []:
                if isinstance(l, dict) and words(l.get("how")) > 7:
                    Lx.warn(where, f"link to {l.get('to')!r}: `how` has {words(l.get('how'))} words (≤ 7)")
        if t == "recap":
            if len(s.get("points") or []) > 3 or len(s.get("breaks") or []) > 2:
                Lx.warn(where, "recap keeps ≤ 3 points and ≤ 2 breaks: the rest goes to `next` (in the more sheet) or is cut")
        if t == "equation" and s.get("note") and words(s["note"]) > 20:
            Lx.warn(where, f"`note` has {words(s['note'])} words (≤ 20): one line that says what the formula tells you")
        if t == "bridge":
            fr = str((s.get("from") or {}).get("name", "") if isinstance(s.get("from"), dict) else s.get("from") or "").lower()
            anchors = [str(a).lower() for a in learner.get("anchors") or []]
            if anchors and fr and not any(a in fr or fr in a for a in anchors):
                Lx.warn(where, f"the bridge comes from {fr!r}, which is not one of the learner's anchors ({', '.join(anchors)}): use the world they picked in the probe")
            if not s.get("breaks"):
                Lx.warn(where, "a bridge needs `breaks`: say where the analogy stops working")
            if len(s.get("pairs") or []) > 3:
                Lx.warn(where, "more than 3 pairs: keep the mapping to what matters")
            for pr in s.get("pairs") or []:
                if isinstance(pr, list) and any(words(x) > 6 for x in pr if isinstance(x, str)):
                    Lx.warn(where, f"pair {pr!r}: each side ≤ 6 words")
        vis_list = [s.get("visual")] + [(s.get(k) or {}).get("visual") for k in ("a", "b")]
        for v in vis_list:
            if v:
                lint_visual(Lx, where, v, scope)
    if ladder:
        for c in ladder:
            if c not in introduced:
                Lx.warn("ladder", f"`{c}` is on the ladder but no slide introduces it")
    if learner.get("anchors") and not bridges and contents >= 6:
        Lx.warn("deck", "the learner gave anchors but there is no `bridge` slide: connect the new idea to something they know")
    if contents >= 6 and leads < contents / 2:
        Lx.warn("deck", f"only {leads}/{contents} content slides have a `lead`; the lead is the 'but/so' that links each slide to the last")
    if not any((s.get("type") == "recap") for s in slides[-3:]):
        Lx.warn("deck", "no `recap` near the end: answer the opening question in one sentence")
    return Lx


def check_expr(Lx, where, expr, names):
    if isinstance(expr, (int, float)) or expr is None:
        return
    if isinstance(expr, list):
        return
    for f in funcs(expr):
        if f not in FUNCS:
            Lx.err(where, f"unknown function `{f}()` in `{expr}`")
    for n in idents(expr):
        if n not in names and n not in CONSTS:
            Lx.err(where, f"unknown name `{n}` in `{expr}` (define it in data:, derive:, controls, or the table row)")


def lint_equation(Lx, where, s, scope, symbols):
    terms = s.get("terms") or {}
    if not s.get("expr") and not s.get("tex"):
        Lx.err(where, "equation needs `expr` (computable: shows the numbers too) or `tex` with [name] terms")
        return
    ids = idents(s["expr"]) if s.get("expr") else re.findall(r"\[([A-Za-z_]\w*)\]", s.get("tex", ""))
    if s.get("tex") and not ids:
        Lx.err(where, "a `tex` equation must mark its terms as [name] so each one gets explained")
    if s.get("lhs"):
        ids = ids + [s["lhs"]]
    for n in dict.fromkeys(ids):
        t = terms.get(n) if isinstance(terms.get(n), dict) else None
        if not (t and t.get("says")) and not (isinstance(symbols.get(n), dict) and symbols[n].get("says")):
            Lx.err(where, f"term `{n}` has no meaning: add `{n}: {{tex: ..., says: ...}}` under symbols (or terms)")
    if s.get("expr"):
        check_expr(Lx, where, s["expr"], set(scope) | set(terms))
    if len(set(ids)) > 5:
        Lx.warn(where, f"{len(set(ids))} terms: more than 5 is a wall; split the formula into two slides")
    if not s.get("read"):
        Lx.warn(where, "add `read`: the formula said as a plain sentence (\"spread = mean + knob × mean squared\")")
    # no formula from nowhere: say what known form it grows from and the move that changes it (story.md §7)
    fr = s.get("from")
    if fr is None:
        Lx.warn(where, "this formula comes from nowhere: add `from:` with a form the learner knows ({name, tex}) and the `move` that turns it into this one (or `from: false` if an earlier slide built it)")
    elif fr is not False:
        chain = fr if isinstance(fr, list) else [fr]
        if len(chain) > 3:
            Lx.warn(where, f"`from` has {len(chain)} links: 3 or fewer sketch the idea; put a longer derivation in `more:`")
        for j, c in enumerate(chain):
            if not isinstance(c, dict) or not (c.get("tex") or c.get("name")):
                Lx.err(where, f"`from` link {j + 1} needs `tex` (the known form) or `name`")
                continue
            if not c.get("move"):
                Lx.warn(where, f"`from` link {j + 1} needs `move`: the one change that leads to the next form")
            elif words(c["move"]) > 10:
                Lx.warn(where, f"`from` link {j + 1}: `move` has {words(c['move'])} words (≤ 10)")
    kin = s.get("kin") or []
    if len(kin) > 3:
        Lx.warn(where, f"{len(kin)} relatives in `kin`: keep the 1–3 the learner is most likely to know")
    for j, c in enumerate(kin):
        if not isinstance(c, dict) or not (c.get("tex") or c.get("name")) or not c.get("where"):
            Lx.err(where, f"`kin` item {j + 1} needs `where` (the topic) and `tex` or `name` (the same shape there)")


def lint_visual(Lx, where, v, scope):
    extra = set(v) - VISUAL
    if extra:
        Lx.err(where, f"unknown visual field(s) {sorted(extra)}")
    kinds = [k for k in ("chart", "stat", "units", "parts", "flow", "code", "image", "eqn", "svg") if k in v]
    if len(kinds) != 1:
        Lx.err(where, f"a visual has exactly one of chart, stat, units, parts, flow, code, image, eqn, svg (found {kinds or 'none'})")
    for nd in (v.get("flow") or {}).get("nodes") or []:
        nd = nd if isinstance(nd, dict) else {"label": nd}
        if words(nd.get("label")) > 5 or words(nd.get("sub")) > 5:
            Lx.warn(where, f"flow node {nd.get('label')!r}: ≤ 5 words for the name and ≤ 5 for the note under it")
    pa = v.get("parts")
    if pa:
        ex = set(pa) - PARTS
        if ex:
            Lx.err(where, f"unknown parts field(s) {sorted(ex)}")
        items = pa.get("items") or []
        if not items:
            Lx.err(where, "parts needs `items`: the named pieces, e.g. [{label: counting part, value: mu}, …]")
        for it in items:
            if not isinstance(it, dict) or not it.get("label"):
                Lx.err(where, f"each part needs a `label`: {it!r}")
            elif not pa.get("rows") and it.get("value") is None:
                Lx.err(where, f"part {it.get('label')!r} needs a `value` (a number or an expression)")
            elif isinstance(it.get("value"), str):
                check_expr(Lx, f"{where} part {it.get('label')}", it["value"], scope)
        for r in pa.get("rows") or []:
            vals = r.get("values") or []
            if len(vals) != len(items):
                Lx.err(where, f"row {r.get('label')!r} has {len(vals)} values for {len(items)} items")
            for x in vals:
                if isinstance(x, str):
                    check_expr(Lx, f"{where} row {r.get('label')}", x, scope)
        if isinstance(pa.get("total"), dict) and isinstance(pa["total"].get("value"), str):
            check_expr(Lx, f"{where} parts total", pa["total"]["value"], scope)
    c = v.get("chart")
    if c:
        ex = set(c) - CHART
        if ex:
            Lx.err(where, f"unknown chart field(s) {sorted(ex)}")
        names = set(scope) | {"x"} | {ct.get("name") for ct in c.get("controls") or [] if isinstance(ct, dict)}
        if not c.get("series"):
            Lx.err(where, "a chart needs at least one series")
        colored = 0
        for s in c.get("series") or []:
            k = s.get("kind", "line")
            if k not in SERIES_KINDS:
                Lx.err(where, f"series kind `{k}` (use {', '.join(sorted(SERIES_KINDS))})")
            for f in ("fn", "x", "y", "values"):
                if isinstance(s.get(f), str):
                    check_expr(Lx, f"{where} series {s.get('name', '')}", s[f], names)
            if not s.get("focus") and s.get("color") not in ("mist", "haze", "ink"):
                colored += 1
        if colored > 3:
            Lx.warn(where, f"{colored} coloured series: the palette carries 3 safely; grey the context series (color: mist) or split the chart")
        for m in c.get("marks") or []:
            if m.get("kind") not in MARK_KINDS:
                Lx.err(where, f"mark kind `{m.get('kind')}` (use {', '.join(sorted(MARK_KINDS))})")
            for f in ("x", "y", "fn"):
                val = m.get(f)
                for item in (val if isinstance(val, list) else [val]):
                    if isinstance(item, str):
                        check_expr(Lx, f"{where} mark {m.get('kind')}", item, names)
        for ax in ("x", "y"):
            a = c.get(ax) or {}
            if not a.get("label") and not a.get("cats"):
                Lx.warn(where, f"chart {ax}-axis has no label (say what is measured, with units)")
        if not v.get("caption"):
            Lx.warn(where, "chart has no caption: one line that says what to look at")


def build(path, out=None, katex_dir=None, quiet=False):
    path = Path(path)
    deck = load(path)
    data_file = deck.pop("data_file", None)
    extra_names = []
    data_js = ""
    if data_file:
        d = json.loads((path.parent / data_file).read_text())
        extra_names = list(d)
        data_js = f"window.VIZOS_DATA={safe_json(d)};"
    lx = lint(deck, extra_names)
    assets = {}
    for img in re.findall(r'"image":\s*"([^"]+)"', json.dumps(deck)):
        f = path.parent / img
        if f.exists():
            mt = mimetypes.guess_type(f.name)[0] or "image/png"
            assets[img] = f"data:{mt};base64," + base64.b64encode(f.read_bytes()).decode()
        else:
            lx.err("image", f"file not found: {img}")
    css = (KIT / "vizos.css").read_text()
    js = "\n".join((KIT / f).read_text() for f in KIT_JS)
    needs_tex = bool(re.search(r'"type":\s*"(equation|calc|table)"|\$[^$\s][^$]*\$|"eqn":', json.dumps(deck)))
    katex = ""
    if needs_tex:
        kd = katex_dir or os.environ.get("VIZOS_KATEX_DIR")
        katex = inline_katex(Path(kd)) if kd else KATEX_CDN
    title = deck.get("title", "viz-os deck")
    page = (f'<!doctype html><html lang="en"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            f'<meta name="theme-color" content="#000000"><title>{esc(title)}</title>{FONTS}{katex}<style>{css}</style></head><body>'
            f'<script type="application/json" id="vizos-deck">{safe_json(deck)}</script>'
            f'<script>window.VIZOS_ASSETS={safe_json(assets)};{data_js}</script>'
            f'<script>{js}</script></body></html>')
    out = Path(out) if out else path.with_suffix(".html")
    out.write_text(page, encoding="utf-8")
    errs = [x for x in lx.out if x[0] == "ERR"]
    warns = [x for x in lx.out if x[0] == "WARN"]
    for lvl, where, msg in (errs + warns)[:40]:
        print(f"{lvl:4} {where}: {msg}")
    if len(lx.out) > 40:
        print(f"... and {len(lx.out) - 40} more")
    if not quiet:
        print(f"build: {out}  {len(page) // 1024} KB  {len(deck.get('slides', []))} slides  {len(errs)} errors  {len(warns)} warnings")
    return 1 if errs else 0


def esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def safe_json(o):
    return json.dumps(o, ensure_ascii=False).replace("</", "<\\/")


def inline_katex(d):
    """KaTeX inlined (fonts as data URIs) for offline use: give the folder that holds katex.min.js, katex.min.css, fonts/."""
    css = (d / "katex.min.css").read_text()
    def font(m):
        f = d / m.group(1)
        if not f.exists():
            return m.group(0)
        mt = "font/woff2" if f.suffix == ".woff2" else "font/woff" if f.suffix == ".woff" else "font/ttf"
        return f"url(data:{mt};base64,{base64.b64encode(f.read_bytes()).decode()})"
    css = re.sub(r"url\((fonts/[^)]+\.woff2)\)", font, css)
    css = re.sub(r",\s*url\(fonts/[^)]+\.(woff|ttf)\) format\(\"(woff|truetype)\"\)", "", css)
    return f"<style>{css}</style><script>{(d / 'katex.min.js').read_text()}</script>"


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck")
    ap.add_argument("-o", "--out")
    ap.add_argument("--katex-dir", help="folder with katex.min.js, katex.min.css and fonts/ to inline (offline decks)")
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args()
    sys.exit(build(a.deck, a.out, a.katex_dir, a.quiet))
