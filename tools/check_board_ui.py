#!/usr/bin/env python3
"""Act like a learner on the built class examples, in a real browser, and test that the page answers.

Usage: tools/check_board_ui.py [example ...]      Run it after the examples are built (tools/check-all.sh does both).

Prints one line per test, then "board ui tests: X/Y ok"; exits 1 if any fails, 2 if no browser could start ("not checked").
Next changes a figure and Back undoes it; a click on a line goes to its stop; a stop on a think step opens it; Show answer
grows its card from a fixed top; a slider changes a number; a run's scrubber moves the lit line; scrolling lights steps and
fills columns but never moves a figure; no sideways scroll; every plane without `fill` has equal units; charts and images keep their ratio.
Then the look's own rules: a long formula sends its figure above its text; the plan shows no lines of text; the scene counter
stays in the margin; a column not filled in keeps its row lines; Next stays on screen; the line by the buttons stays on
screen after every Next; Next onto a think step takes two presses; rows fit their figures at five widths and stay on
screen at three windows; a filled plane and a table fill their room; the first stop has no line;
Next stays under the pointer through a scene; the line by the buttons never repeats words already on screen;
text not side by side starts at the page's left edge while figures and equations centre on it; callouts and thinks have
no lines and no indent, stand 18 px from their line, and show a bar when lit without moving their text. The pause button
shows only with a pop-up, keeps clear of the rail, quiets pointing but not a click, and survives a reload. Formulas carry
no names under them: a term's name is on its pop-up card, which is as wide as its text, framed in the term's colour, fades
the rest of its formula, gives a matrix its shape, and follows a slider. Controls share one grid per box, read their value
bare, and a control's label opens its card, which blurs what is behind it.
"""
import importlib.util, json, re, subprocess, sys
import yaml
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EX = ROOT / "plugins/viz-os/skills/class/examples"
WIDTHS = (1280, 1440, 1920)

spec = importlib.util.spec_from_file_location("vizos_check", ROOT / "plugins/viz-os/skills/deck/scripts/check.py")
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)

# what a figure shows right now: the parts that are up, its dots, and the text of a matrix
STATE = "e => [...e.querySelectorAll('.shown')].length + '|' + [...e.querySelectorAll('.off')].length + '|' + [...e.querySelectorAll('.sdot.now')].map(d => [...d.parentNode.children].indexOf(d)).join() + '|' + [...e.querySelectorAll('.mc, .opcard .ok.shown')].map(c => c.textContent).join().length"
STAGES = "VizOS.slides.flatMap(sl => (sl.r.stages || []).map(S => S.i))"
# a chart with no ratio of its own holds 16:9, and may go to 2:1 in a short window; one with a ratio keeps it
SHAPES = """() => VizOS.slides.flatMap(sl => { const specs = (sl.s.steps || []).flatMap(st => [].concat((st && st.add) || [])).filter(it => it && it.chart), cs = [...sl.r.node.querySelectorAll('.fg .bvis.chart .chart')];
  return cs.map((c, i) => { const r = c.getBoundingClientRect(), k = specs[i] || {}, own = k.ratio ?? (k.chart || {}).ratio; return [r.width / r.height, own ?? null]; }); })"""
IMAGES = """() => [...document.querySelectorAll('.bvis img')].map(m => { const r = m.getBoundingClientRect(); return (r.width / r.height) / (m.naturalWidth / m.naturalHeight); })"""


def open_page(ctx, name):
    page = ctx.new_page()
    page.goto((EX / name / "lesson.html").as_uri())
    page.wait_for_function("window.VizOS && VizOS.ready === true", timeout=20000)
    page.wait_for_timeout(300)
    return page


def stage_test(page, nth, want):
    """The nth stage whose Next can be pressed: returns (host handle, Next, Back)."""
    host = page.locator(".fg:has(> .stage)").nth(nth)
    host.scroll_into_view_if_needed()
    return host, host.locator("> .stage .next"), host.locator("> .stage .back")


def next_back(page):
    n, bad = page.locator(".fg:has(> .stage)").count(), []
    for i in range(n):
        host, nx, bk = stage_test(page, i, None)
        if nx.is_disabled() or host.locator("> .controls .run").count():
            continue
        a = host.evaluate(STATE)
        nx.click(); page.wait_for_timeout(60); b = host.evaluate(STATE)
        if a == b:                                         # the first press onto a think step only asks
            nx.click(); page.wait_for_timeout(60); b = host.evaluate(STATE)
        bk.click(); page.wait_for_timeout(60); c = host.evaluate(STATE)
        if a == b or a != c:
            bad.append(f"figure {i + 1}: {a} / {b} / {c}")
    return n > 0 and not bad, f"{n} figures {bad[:2]}"


def click_line(page):
    host = page.locator(".fg:has(> .stage)").first
    host.scroll_into_view_if_needed()
    last = page.evaluate("""() => { const S = VizOS.slides.flatMap(sl => sl.r.stages || [])[0], ln = S.lines.filter(e => e.dataset.at == S.stops[S.stops.length - 1])[0];
      const from = S.i; ln.querySelector('.say, .cline, .tqt').click(); if (S.ask != null) ln.querySelector('.say, .cline, .tqt').click(); return [from, S.stops.length - 1]; }""")
    page.wait_for_timeout(60)
    now = page.evaluate("VizOS.slides.flatMap(sl => sl.r.stages || [])[0].i")
    page.evaluate("VizOS.slides.flatMap(sl => sl.r.stages || [])[0].to(0)")
    return now == last[1] and last[0] == 0, f"stop {last[0]} -> {now}"


def think_stop(page):
    """Next onto a think step's stop opens that think; a think step's added marks wait behind the answer."""
    r = page.evaluate("""() => { for (const sl of VizOS.slides) for (const S of sl.r.stages || []) { const th = [...sl.r.node.querySelectorAll('.think')].filter(e => S.stops.includes(+e.dataset.at) && S.stops.indexOf(+e.dataset.at) > 0)[0];
      if (!th) continue; const j = S.stops.indexOf(+th.dataset.at); th.scrollIntoView({ block: 'center' }); const closed = !th.classList.contains('open'); S.to(j); const opened = th.classList.contains('open');
      th.querySelector('.tb').click(); const back = !th.classList.contains('open') && S.i < j; S.to(0); return [closed, opened, back]; } return null; }""")
    return r is None or all(r), f"closed, opened, hidden again: {r}"


def show_answer(page):
    """The answer takes no room until pressed: the card grows, its top stays, and nothing above it moves."""
    page.evaluate("VizOS.slides.forEach(sl => sl.r.reset && sl.r.reset())")
    n, bad = page.locator(".think").count(), []
    for i in range(0, n, max(1, n // 6)):
        t = page.locator(".think").nth(i)
        t.scroll_into_view_if_needed()
        rect = "e => { const r = e.getBoundingClientRect(); return [Math.round(r.top + scrollY), Math.round(r.height)]; }"
        top0, h0 = t.evaluate(rect)
        room = t.locator(".ta").evaluate("e => e.getClientRects().length")
        t.locator(".tb").click(); page.wait_for_timeout(40)
        top1, h1 = t.evaluate(rect)
        vis = t.locator(".ta").evaluate("e => getComputedStyle(e).visibility")
        if room or vis != "visible" or abs(top0 - top1) > 1 or h1 <= h0:
            bad.append(i)
    return n > 0 and not bad, f"{n} thinks, bad {bad}"


def slider(page):
    inp = page.locator(".ctl:not(.run):not(.tog) input").first
    if not inp.count():
        return True, "no slider here"
    inp.scroll_into_view_if_needed()
    sec = page.locator("section.slide", has=inp)
    a = sec.inner_text()
    inp.evaluate("e => { e.value = e.max; e.dispatchEvent(new Event('input', { bubbles: true })); }")
    page.wait_for_timeout(120)
    b = sec.inner_text()
    return a != b, "text changed" if a != b else "nothing changed"


def scrubber(page):
    inp = page.locator(".ctl.run input").first
    if not inp.count():
        return True, "no run here"
    page.evaluate("VizOS.slides.forEach(sl => sl.r.reset && sl.r.reset())")
    inp.scroll_into_view_if_needed()
    sec = page.locator("section.slide", has=inp)
    lit = "s => [...s.querySelectorAll('.st.atstop')].map(e => e.dataset.at).join()"
    a = sec.evaluate(lit)
    inp.evaluate("e => { e.value = e.max; e.dispatchEvent(new Event('input', { bubbles: true })); }")
    page.wait_for_timeout(120)
    b = sec.evaluate(lit)
    return a != b and bool(b), f"lit lines {a} -> {b}"


def scrolling(page):
    page.evaluate("VizOS.slides.forEach(sl => sl.r.reset && sl.r.reset()); scrollTo(0, 0)")
    page.wait_for_timeout(100)
    a, fa = page.evaluate(STAGES), page.locator("td.shown").count()
    H = page.evaluate("document.documentElement.scrollHeight")
    lit = False
    for y in range(0, H, 400):
        page.evaluate(f"scrollTo({{ top: {y}, behavior: 'instant' }})"); page.wait_for_timeout(40)
        lit = lit or page.locator(".st.now").count() > 0
    page.wait_for_timeout(80)
    b, fb = page.evaluate(STAGES), page.locator("td.shown").count()
    return lit and a == b and (fb > fa or not page.locator("td[data-step]").count()), f"now seen {lit}, cells {fa} -> {fb}, stages same {a == b}"


def widths(page):
    bad, sh = [], []
    for w in WIDTHS:
        page.set_viewport_size({"width": w, "height": 900}); page.wait_for_timeout(350)
        if page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth"):
            bad.append(f"sideways scroll at {w}")
        sh = page.evaluate(SHAPES)
        if any(own is None and not 1.74 <= x <= 2.03 for x, own in sh):
            bad.append(f"chart shape left 16:9 to 2:1 at {w}: {[round(x, 2) for x, own in sh if own is None]}")
        if any(abs(x - 1) > .02 for x in page.evaluate(IMAGES)):
            bad.append(f"image ratio wrong at {w}")
    page.set_viewport_size({"width": 1440, "height": 900})
    return not bad, "; ".join(bad) or f"{len(sh)} charts"


def narrow_formula(page):
    """Rule 3: at a width where text sits beside a figure, no formula passes the edge of its column."""
    page.set_viewport_size({"width": 1040, "height": 900}); page.wait_for_timeout(350)
    over = page.evaluate("""() => [...document.querySelectorAll('.fb.beside')].filter(b => { const s = b.querySelector('.fside'), e = s.getBoundingClientRect().right;
      return [...s.querySelectorAll('.katex')].some(k => k.getBoundingClientRect().right > e + 1); }).length""")
    moved = page.evaluate("""() => [...document.querySelectorAll('.fb:not(.beside):not(.many)')].filter(b => !b.closest('.bpair:not(.stacked)') && b.querySelector('.fside .katex')).length""")
    page.set_viewport_size({"width": 1440, "height": 900}); page.wait_for_timeout(350)
    return over == 0 and (moved > 0 or "pca-2-how" not in page.url), f"{over} past the edge, {moved} figures above their text"   # pca-2-how has a formula too long for its column at this width


def plan_words(page):
    r = page.evaluate("""() => VizOS.slides.filter(sl => sl.s.beat === 'plan').map(sl => [sl.r.node.querySelectorAll('.board .say').length, sl.r.node.querySelectorAll('.track').length, sl.r.node.querySelectorAll('.tks.on').length, sl.r.node.querySelectorAll('.verb').length])""")
    return bool(r) and all(x == [0, 1, 1, 0] for x in r), f"say, track, first filled, verbs: {r}"


def rail_margin(page):
    bad = []
    for w in WIDTHS:
        page.set_viewport_size({"width": w, "height": 900}); page.wait_for_timeout(250)
        gap = page.evaluate("document.getElementById('lsrail').getBoundingClientRect().left - document.getElementById('lesson').getBoundingClientRect().right")
        tall = page.evaluate("(() => { const r = document.getElementById('lsrail').getBoundingClientRect(); return r.height > r.width; })()")
        if gap < 0 or not tall:
            bad.append(f"{w}: gap {gap}, upright {tall}")
    page.set_viewport_size({"width": 1440, "height": 900}); page.wait_for_timeout(250)
    return not bad, "; ".join(bad) or "in the margin"


def row_lines(page):
    """A column not filled in keeps its row lines, and a waiting column too; only the text waits."""
    page.evaluate("VizOS.slides.forEach(sl => sl.r.reset && sl.r.reset()); scrollTo(0, 0)")
    page.wait_for_timeout(60)
    r = page.evaluate("""() => { const tds = [...document.querySelectorAll('td[data-step]:not(.shown)')]; return [tds.length, tds.filter(t => { const c = getComputedStyle(t), v = getComputedStyle(t.querySelector('.cv'));
      return !(c.visibility === 'visible' && +c.opacity === 1 && v.visibility === 'hidden'); }).length]; }""")
    return r[1] == 0, f"{r[0]} waiting cells, {r[1]} lost their lines"


# at each scene with a stepped figure first on its page, the head at the top of the window: Next, and the stop line, are on screen
FIRSTS = """() => VizOS.slides.flatMap((sl, i) => (sl.r.stages || []).map((S, k) => [i, k, S.node.getBoundingClientRect().top - sl.r.node.getBoundingClientRect().top])).filter(x => x[2] < 330 && x[1] === 0).map(x => x[0])"""


def head_top(page, i):
    page.evaluate(f"document.getElementById('scene-{i + 1}').scrollIntoView({{ block: 'start', behavior: 'instant' }})")
    page.wait_for_timeout(50)


def next_on_screen(page):
    page.evaluate("VizOS.slides.forEach(sl => sl.r.reset && sl.r.reset())")
    bad, firsts = [], page.evaluate(FIRSTS)
    for i in firsts:
        head_top(page, i)
        b = page.evaluate(f"""() => {{ const S = VizOS.slides[{i}].r.stages[0], r = S.node.querySelector('.stage').getBoundingClientRect(); return [r.top, r.bottom, innerHeight]; }}""")
        if b[0] < 0 or b[1] > b[2]:
            bad.append(f"scene {i + 1}: bottom {round(b[1])}")
    return not bad, "; ".join(bad) or f"{len(firsts)} scenes"


# the line's box, its words if they show, and scrollY. When it steps aside for the same words elsewhere, those words count, and must be on screen
WORDS_SEEN = """e => { const r = e.getBoundingClientRect(), t = e.textContent.replace(/\\s+/g, ' ').trim(), same = [...e.closest('.slide').querySelectorAll('.say, .tqt, .ta > span:last-child, .note')].filter(q => q.textContent.replace(/\\s+/g, ' ').trim() === t && q.getBoundingClientRect().height && q.getBoundingClientRect().top >= 0 && q.getBoundingClientRect().bottom <= innerHeight);
  return [r.top, r.bottom, innerHeight, getComputedStyle(e).visibility === 'visible' ? t.length : same.length, scrollY]; }"""


def stop_line(page):
    """Text under a figure: after every Next the line by the buttons shows, without scrolling."""
    page.evaluate("VizOS.slides.forEach(sl => sl.r.reset && sl.r.reset())")
    bad, seen = [], 0
    for i in page.evaluate(FIRSTS):
        host = page.locator(f"#scene-{i + 1} .fg:has(> .stage)").first
        if not host.locator(".stopl").evaluate("e => e.getClientRects().length || !e.closest('.fb.beside')"):
            continue
        if host.evaluate("e => !!e.closest('.fb.beside')"):
            continue
        head_top(page, i)
        y0, nx = page.evaluate("scrollY"), host.locator("> .stage .next")
        for _ in range(12):
            if nx.is_disabled():
                break
            nx.click(); page.wait_for_timeout(40); seen += 1
            r = host.locator(".stopl").evaluate(WORDS_SEEN)
            if r[1] > r[2] or r[0] < 0 or not r[3] or r[4] != y0:
                bad.append(f"scene {i + 1}: {[round(x) for x in r]}"); break
    return not bad, "; ".join(bad[:3]) or f"{seen} presses"


def two_presses(page):
    """Next onto a think step: the first press asks and leaves the figure, the second answers and moves it."""
    r = page.evaluate("""() => { for (const sl of VizOS.slides) for (const S of sl.r.stages || []) { const th = [...sl.r.node.querySelectorAll('.think')].find(e => S.stops.indexOf(+e.dataset.at) > 0);
      if (!th) continue; const j = S.stops.indexOf(+th.dataset.at), nx = S.node.querySelector('.next'), line = S.node.querySelector('.stopl'); S.to(j - 1); th.classList.contains('open') && th.querySelector('.tb').click(); S.to(j - 1);
      nx.click(); const asked = S.i === j - 1 && !th.classList.contains('open') && line.textContent.trim().length > 0;
      nx.click(); const answered = S.i === j && th.classList.contains('open'); S.to(0); return [asked, answered]; } return null; }""")
    return r is None or all(r), f"asked, answered: {r}"


# every row under a figure, as the options sheet's scan reads them
SCAN = """(()=>{const out=[];const rc=e=>e.getBoundingClientRect();const vis=e=>{const r=rc(e);return r.width>2&&r.height>2};
VizOS.slides.forEach((sl,i)=>{const n=sl.r.node;
 n.querySelectorAll('.fg').forEach(g=>{const G=rc(g);if(!G.width)return;const pic=g.querySelector(':scope > .bvis, :scope > .bi'),P=pic?rc(pic):G;
  const rows=[...g.querySelectorAll(':scope > .controls, :scope > .stage')].filter(vis);const groups=[];rows.forEach(c=>{const R=rc(c),m=groups.find(g=>g.some(o=>{const q=rc(o);return q.top<R.bottom&&R.top<q.bottom}));if(m)m.push(c);else groups.push([c])});
  rows.forEach(c=>{const R=rc(c);[...c.querySelectorAll('.ctl,.sb,.dots,label,output,input')].filter(vis).forEach(e=>{const q=rc(e);if(q.right>R.right+1.5||q.left<R.left-1.5)out.push([i+1,'part sticks out of its row',e.className||e.tagName])});
   const box=c.closest('.fb');const fs=box&&box.querySelector('.fside');if(fs&&vis(fs)&&box.classList.contains('beside')&&R.right>rc(fs).left+1)out.push([i+1,'row runs under the text',Math.round(R.right-rc(fs).left)]);
   if(R.right>P.right+1.5&&R.right>G.right+1.5||R.left<Math.min(P.left,G.left)-1.5)out.push([i+1,'row wider than figure',Math.round(R.width)+'>'+Math.round(P.width)]);});
  groups.forEach(cs=>{const kids=cs.flatMap(c=>[...c.children].filter(vis));const L=Math.min(...kids.map(k=>rc(k).left)),Rr=Math.max(...kids.map(k=>rc(k).right));const d=(L+Rr)/2-(P.left+P.right)/2;if(Math.abs(d)>3)out.push([i+1,'row off centre',Math.round(d)])});
  if(pic&&!g.closest('.ffig')&&Math.abs((P.left+P.right)/2-(rc(g.parentElement).left+rc(g.parentElement).right)/2)>3)out.push([i+1,'wide picture off centre',Math.round((P.left+P.right)/2-(rc(g.parentElement).left+rc(g.parentElement).right)/2)]);});
 n.querySelectorAll('.fb.beside').forEach(b=>{const f=rc(b.querySelector('.ffig')),t=rc(b.querySelector('.fside'));if(f.right>t.left+1)out.push([i+1,'figure runs under the text',Math.round(f.right-t.left)]);});
 const t=n.querySelector('.tcol');const ff=n.querySelector('.bpair .ffig');if(t&&ff&&vis(t)&&vis(ff)&&rc(t).right>rc(ff).left+1)out.push([i+1,'table runs under the figure',0]);
});return {sw:document.documentElement.scrollWidth,out}})()"""
# a figure with nothing above it but its own line is seen with the scene's head at the top of the window; one lower in the
# scene, under worked lines or a table, is reached by scrolling to it, so its own top goes there
FEET = """() => { const out = [], rc = e => e.getBoundingClientRect();
  VizOS.slides.forEach((sl, i) => { const n = sl.r.node; [...n.querySelectorAll('.fg')].filter(g => g.querySelector(':scope > .controls .ctl, :scope > .stage') && g.offsetWidth).forEach(g => {
    n.scrollIntoView({ block: 'start', behavior: 'instant' }); const say = g.closest('.fb') && !g.closest('.beside') && g.closest('.fb').querySelector('.st.intro > .say'), top = say || g, room = n.querySelector('.board');
    if (rc(top).top - rc(room).top > 4 && !(rc(g).top - rc(room).top < 90)) top.scrollIntoView({ block: 'start', behavior: 'instant' });
    out.push([i + 1, Math.round(Math.max(...[...g.querySelectorAll(':scope > .controls, :scope > .stage')].map(e => rc(e).bottom))), innerHeight]); }); });
  return out; }"""


def sized(page, w, h):
    page.set_viewport_size({"width": w, "height": h}); page.wait_for_timeout(350)


def rows_fit(page):
    """A row is never wider than its figure or under the text; a row and a wide picture are centred; nothing goes sideways."""
    bad = []
    for w, h in ((1100, 800), (1280, 720), (1440, 900), (1728, 1000), (1920, 1080)):
        sized(page, w, h)
        r = page.evaluate(SCAN)
        bad += [f"{w}: scene {x[0]} {x[1]} {x[2]}" for x in r["out"]]
        if r["sw"] > w:
            bad.append(f"{w}: {r['sw']} wide")
    sized(page, 1440, 900)
    return not bad, "; ".join(bad[:4]) or "5 widths"


def rows_on_screen(page):
    bad, n = [], 0
    for w, h in ((1280, 720), (1440, 900), (1920, 1080)):
        sized(page, w, h)
        q = page.evaluate(FEET); n += len(q)
        bad += [f"{w}: scene {x[0]} row foot {x[1]} of {x[2]}" for x in q if x[1] > x[2]]
    sized(page, 1440, 900)
    return n > 0 and not bad, "; ".join(bad[:4]) or f"{n} rows"


def plane_fills(page):
    """A filled plane reaches its room, or its height limit."""
    r = page.evaluate("""() => { const rc = e => e.getBoundingClientRect(); return [...document.querySelectorAll('.bi.plane.fill')].map(p => { const n = p.closest('.slide'), room = p.closest('.fb.beside') ? rc(p.closest('.fb.beside')).width * .7 - 40 : rc(p.closest('.lines')).width * .98; n.scrollIntoView({ block: 'start', behavior: 'instant' });
      return [n.id, Math.round(rc(p).width), Math.round(room), Math.round(rc(p.closest('.fg')).bottom), innerHeight]; }); }""")
    bad = [x for x in r if x[1] < x[2] and x[3] < x[4] - 60]
    return not bad and (bool(r) or not ("perceptron" in page.url or "board-gallery" in page.url)), f"{len(r)} planes" + (f", small: {bad[:2]}" if bad else "")


def table_fills(page):
    r = page.evaluate("""() => { const rc = e => e.getBoundingClientRect(), W = rc(document.querySelector('#lesson')).width; return [...document.querySelectorAll('.bpair:not(.stacked)')].map(p => [p.closest('.slide').id, rc(p.querySelector('.tcol')).width, rc(p.querySelector('table.t')).width, W]); }""")
    bad = [x for x in r if x[1] < x[3] * .29 or x[2] < x[1] - 20]
    return bool(r) and not bad, f"{len(r)} tables" + (f", thin: {bad[:2]}" if bad else "")


def first_stop_quiet(page):
    """The line by the buttons starts at the second stop: at the first it would repeat the line just read."""
    page.evaluate("VizOS.slides.forEach(sl => sl.r.reset && sl.r.reset())")
    r = page.evaluate("VizOS.slides.flatMap(sl => (sl.r.stages || []).map(S => S.node.querySelector('.stopl').textContent.trim().length))")
    page.evaluate("VizOS.slides.forEach(sl => sl.r.reset && sl.r.reset())")
    return bool(r) and not any(r), f"{len(r)} stages"


# scenes by title, since their numbers move: a think answer here grows the text column past a figure that was held by the block's foot
STAY = {"pca-2-how": "Repeat until it stops turning", "board-gallery": "A line that learns, one cell at a time"}
REPEAT = {"pca-2-how": "C times an arrow is a new arrow"}
SCENE = "t => VizOS.slides.findIndex(sl => sl.s.title === t)"


def stays_put(page):
    """Next stays under the pointer: scroll a scene's top to -200 and keep pressing, and the button moves under 2 px."""
    title, name = next(((t, n) for n, t in STAY.items() if n in page.url), (None, None))
    if not title:
        return True, "no such scene here"
    sized(page, 1480, 800)
    page.evaluate("VizOS.slides.forEach(sl => sl.r.reset && sl.r.reset())")
    i = page.evaluate(SCENE, title)
    head_top(page, i)
    page.evaluate("scrollBy({ top: 200, behavior: 'instant' })"); page.wait_for_timeout(80)
    nx, ys = page.locator(f"#scene-{i + 1} .stage .next").first, []
    for _ in range(14):
        ys.append(round(nx.evaluate("e => e.getBoundingClientRect().top")))
        if nx.is_disabled():
            break
        box = nx.bounding_box()
        page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2); page.wait_for_timeout(60)
    done = nx.is_disabled()
    page.evaluate("VizOS.slides.forEach(sl => sl.r.reset && sl.r.reset())")
    sized(page, 1440, 900)
    return done and len(ys) > 2 and max(ys) - min(ys) <= 2, f"{name} Next at y {ys}"


COPIES = """() => { const seen = e => { const r = e.getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight && getComputedStyle(e).visibility === 'visible'; }, same = e => e.textContent.replace(/\\s+/g, ' ').trim();
  return [...document.querySelectorAll('.stopl')].filter(l => same(l) && l.getBoundingClientRect().top < innerHeight && l.getBoundingClientRect().bottom > 0).map(l => { const n = l.closest('.slide');
    return [n.id, same(l).slice(0, 40), seen(l), [...n.querySelectorAll('.say, .tqt, .ta > span:last-child, .note')].filter(e => same(e) === same(l) && seen(e)).length]; }); }"""


def no_repeat(page):
    """The line by the buttons shows only when its words are not on screen elsewhere: seen once, not twice, as the window moves."""
    title = next((t for n, t in REPEAT.items() if n in page.url), None)
    bad, seen = [], 0
    page.evaluate("VizOS.slides.forEach(sl => sl.r.reset && sl.r.reset())")
    n = page.evaluate("VizOS.slides.length")
    for (w, h) in ((1440, 2400), (1440, 900)):
        sized(page, w, h)
        for i in range(n):
            for j in range(page.evaluate(f"(VizOS.slides[{i}].r.stages || []).length")):
                last = page.evaluate(f"VizOS.slides[{i}].r.stages[{j}].stops.length")
                for k in range(1, last):
                    page.evaluate(f"VizOS.slides[{i}].r.stages[{j}].to({k})")
                    head_top(page, i)
                    for r in page.evaluate(COPIES):
                        seen += 1
                        if r[2] and r[3]:
                            bad.append(f"{w}x{h} {r[0]}: {r[1]!r} twice")
                page.evaluate(f"VizOS.slides[{i}].r.stages[{j}].to(0)")
    page.evaluate("VizOS.slides.forEach(sl => sl.r.reset && sl.r.reset())")
    if title:                  # the case that was found: the words are in the next block, so the line goes only while they are on screen
        sized(page, 1440, 2400)
        i = page.evaluate(SCENE, title)
        last = page.evaluate(f"VizOS.slides[{i}].r.stages[0].stops.length") - 1
        page.evaluate(f"VizOS.slides[{i}].r.stages[0].to({last})")
        head_top(page, i)
        tall = page.evaluate(COPIES)
        sized(page, 1440, 700)
        head_top(page, i)
        short = page.evaluate(COPIES)
        page.evaluate("VizOS.slides.forEach(sl => sl.r.reset && sl.r.reset())")
        if not any(not r[2] and r[3] for r in tall):
            bad.append(f"tall window: {tall}")
        if not any(r[2] and not r[3] for r in short):
            bad.append(f"short window: {short}")
    sized(page, 1440, 900)
    return not bad, "; ".join(bad[:3]) or f"{seen} lines"


FIVE = ((1100, 800), (1280, 720), (1480, 800), (1728, 1000), (1920, 1080))
FORMULAS = ".cline .math, .fline .math, .asm .math"
# a part of a worked line whose pieces go back to the left has broken across rows
BROKEN = """() => { const out = []; document.querySelectorAll('.cline .part, .fline .math, .asm .math').forEach(p => { const bs = [...p.querySelectorAll('.katex-html > .base')].filter(b => !b.closest('.wkey')).map(b => b.getBoundingClientRect()).filter(r => r.width);
  if (bs.some((r, i) => i && r.left < bs[i - 1].right - 2)) out.push([p.closest('.slide').id, p.textContent.slice(0, 30)]); }); return out; }"""


def one_row(page):
    """A piece of a formula never breaks across rows, at five windows."""
    bad = []
    for w, h in FIVE:
        sized(page, w, h)
        bad += [f"{w}: {x}" for x in page.evaluate(BROKEN)]
    sized(page, 1440, 900)
    return not bad, "; ".join(bad[:3]) or "5 windows"


# a step that only wraps (display: contents, a stacked figure's lead step) has no box: measure against the one around it
FLOOR = """s => { const out = []; document.querySelectorAll(s).forEach(m => { const fs = parseFloat(getComputedStyle(m).fontSize), box = e => { let q = e.closest('.st, .asm, .slide'); while (q && !q.getBoundingClientRect().width) q = q.parentElement.closest('.st, .asm, .fb, .slide'); return q; }, b = box(m).getBoundingClientRect(), k = [...m.querySelectorAll('.katex')].filter(e => !e.closest('.wkey')).map(e => e.getBoundingClientRect());
  if (!k.length) return; if (fs < 20 || Math.max(...k.map(r => r.right)) > b.right + 2) out.push([m.closest('.slide').id, fs, Math.round(Math.max(...k.map(r => r.right)) - b.right)]); });
  return [out, [...document.querySelectorAll(s)].filter(m => m.style.fontSize).length]; }"""


def formula_floor(page):
    """A formula shrinks to fit its box, and never under 20 px."""
    bad, shrunk = [], 0
    for w, h in FIVE:
        sized(page, w, h)
        r = page.evaluate(FLOOR, FORMULAS)
        bad += [f"{w}: {x}" for x in r[0]]; shrunk += r[1]
    sized(page, 1440, 900)
    return not bad and (shrunk > 0 or "perceptron" not in page.url), "; ".join(bad[:3]) or f"{shrunk} shrunk"


def no_names(page):
    """Names in a formula live on its terms' pop-up cards (the user's pick): nothing is written under a formula, and every
    term whose symbol has `says` is a pop-up target."""
    r = page.evaluate("""() => { const S = (VizOS.slides[0] || { ctx: {} }).ctx.symbols || {}, terms = [...document.querySelectorAll('.cline .lt, .fline .lt, .asm .lt, .fline .mt, .asm .mt')];
      const bare = terms.filter(t => { const q = [...t.classList].find(c => /^(lt|mt)-/.test(c)).slice(3); return S[q] && S[q].says && !t.classList.contains('vt'); });
      return [document.querySelectorAll('.board .wl, .board .wkey').length, terms.length, bare.length]; }""")
    return r[0] == 0 and r[2] == 0, f"names under formulas {r[0]}, terms {r[1]}, terms with no card {r[2]}"

def side_gap(page):
    """Beside a figure the text starts 20 px from it, whatever the figure's width."""
    sized(page, 1480, 800)
    r = page.evaluate("""() => { const rc = e => e.getBoundingClientRect(); return [...document.querySelectorAll('.fb.beside')].map(b => [b.closest('.slide').id, rc(b.querySelector('.fside')).left - rc(b.querySelector('.ffig')).right, rc(b.querySelector('.ffig')).left - rc(b).left, rc(b.querySelector('.fside')).width / rc(b).width]); }""")
    sized(page, 1440, 900)
    bad = [x for x in r if abs(x[1] - 20) > 2 or abs(x[2]) > 2 or x[3] < .295]
    return not bad, f"{len(r)} scenes" + (f", off: {bad[:2]}" if bad else "")


ROOMS = """() => { const rc = e => e.getBoundingClientRect(), out = [];
  document.querySelectorAll('.fg').forEach(g => { const p = g.querySelector(':scope > .bi.plane, :scope > .bvis.chart, :scope > .bvis.dist, :scope > .bvis.parts, :scope > .bvis.flow, :scope > .track'); if (!p || !rc(p).width || g.closest('.many')) return;
    const beside = g.closest('.fb.beside'), pair = g.closest('.bpair:not(.stacked)'), w = rc(p).width, id = g.closest('.slide').id;
    if (beside) out.push([id, 'beside', Math.round(w), Math.round(rc(beside).width * .7 - 10), .85]);
    else if (pair) out.push([id, 'table', Math.round(w), Math.round(rc(pair.querySelector('.lines')).width), .85]);
    else if (!g.querySelector(':scope > .bops')) out.push([id, 'column', Math.round(w), 1060, 1]); }); return out; }"""


def fills_room(page):
    """At 1480 x 800 a figure beside text or a table takes 85% of its room, and a wide figure 1060 px."""
    sized(page, 1480, 800)
    r = page.evaluate(ROOMS)
    sized(page, 1440, 900)
    bad = [x for x in r if x[2] < x[3] * x[4]]
    return bool(r) and not bad, f"{len(r)} figures" + (f", small: {bad[:3]}" if bad else "")


# one unit on each axis, read off the drawn ticks: the data keep one scale however far the range widens
UNITS = """() => { const num = t => +t.textContent.replace('−', '-'), out = []; document.querySelectorAll('.bi.plane:not(.fill)').forEach(n => { const ts = [...n.querySelectorAll('.pgrid text')], xs = ts.filter(t => t.getAttribute('text-anchor') === 'middle'), ys = ts.filter(t => t.getAttribute('text-anchor') === 'end');
  if (xs.length < 2 || ys.length < 2) { out.push([n.closest('.slide').id, 9]); return; } const a = xs[0], b = xs[xs.length - 1], c = ys[0], d = ys[ys.length - 1], ux = Math.abs((+b.getAttribute('x') - +a.getAttribute('x')) / (num(b) - num(a))), uy = Math.abs((+d.getAttribute('y') - +c.getAttribute('y')) / (num(d) - num(c)));
  out.push([n.closest('.slide').id, Math.abs(ux / uy - 1)]); }); return out; }"""


def equal_units(page):
    """An equal plane keeps 1 unit in x equal to 1 unit in y within 1%, at five windows."""
    bad, n = [], 0
    for w, h in FIVE:
        sized(page, w, h)
        r = page.evaluate(UNITS); n += len(r)
        bad += [f"{w}: {x}" for x in r if x[1] > .01]
    sized(page, 1440, 900)
    return not bad, "; ".join(bad[:3]) or f"{n} planes"


# a scene's parts that are not side by side: text starts at the head's left edge; figures and equations centre on the page column
OPEN = ".fb.beside, .fb.many .ffig, .bpair:not(.stacked), .bcmp .side"
EDGES = """o => { const rc = e => e.getBoundingClientRect(), bad = [], SEL = '.st > .say, .think .tqt, .think .ta > span, .think .btag, .think .tb, .note, .params, .asm > .say, .abridge .say, .atag, .fline > .say, .cline > .num, .bcmp, .fg > .stopl';
  document.querySelectorAll('.board').forEach(b => { const L = rc(b.closest('.slide').querySelector('.head')).left; b.querySelectorAll(SEL).forEach(e => { if (!rc(e).width || !e.textContent.trim() || e.closest(o) || getComputedStyle(e).textAlign === 'center' && !e.matches('.stopl')) return;
    const x = (() => { const n = document.createRange(); n.selectNodeContents(e); const q = [...n.getClientRects()].filter(r => r.width); return e.matches('.bcmp, .num') || !q.length ? rc(e).left : Math.min(...q.map(r => r.left)); })();
    if (Math.abs(x - L) > 2) bad.push([b.closest('.slide').id, e.className, Math.round(x - L)]); }); }); return bad; }"""
CENTRES = """o => { const rc = e => e.getBoundingClientRect(), bad = []; let n = 0; const mid = r => (r.left + r.right) / 2;
  document.querySelectorAll('.board').forEach(b => { const P = rc(b), C = mid(P), off = (e, r) => { n++; if (Math.abs(mid(r) - C) > 3) bad.push([b.closest('.slide').id, e.className, Math.round(mid(r) - C)]); }, ink = m => { const k = [...m.querySelectorAll('.katex-html')].filter(e => !e.closest('.wkey')).map(rc).filter(r => r.width); return k.length ? { left: Math.min(...k.map(r => r.left)), right: Math.max(...k.map(r => r.right)) } : null; };
    b.querySelectorAll(':scope .fg').forEach(g => { if (rc(g).width && !g.closest(o) && !g.closest('.bcmp')) { off(g, rc(g)); g.querySelectorAll(':scope > .controls, :scope > .stage').forEach(c => { if (rc(c).width) off(c, rc(c)); }); } });
    b.querySelectorAll('.cline .math, .fline .math, .asm .math').forEach(m => { const r = ink(m); if (r && !m.closest(o)) off(m, r); });
    b.querySelectorAll('.asm .wkey').forEach(k => { const c = [...k.children].map(rc); if (c.length) off(k, { left: Math.min(...c.map(r => r.left)), right: Math.max(...c.map(r => r.right)) }); }); }); return [bad, n]; }"""


def edges(page):
    """Not side by side, all text starts at the scene head's left edge: says, callouts, thinks, a formula card's title and tags, the line by the buttons."""
    bad = []
    for w, h in ((1480, 800), (1920, 1080)):
        sized(page, w, h)
        bad += [f"{w}: {x}" for x in page.evaluate(EDGES, OPEN)]
    sized(page, 1440, 900)
    return not bad, "; ".join(bad[:3]) or "2 windows"


def centres(page):
    """Wide figures with their rows, worked-line math and formula-card equations with their key rows centre on the page column."""
    bad, n = [], 0
    for w, h in ((1480, 800), (1920, 1080)):
        sized(page, w, h)
        r = page.evaluate(CENTRES, ".fb.beside, .fb.many, .bpair:not(.stacked)")
        bad += [f"{w}: {x}" for x in r[0]]; n += r[1]
    sized(page, 1440, 900)
    return n > 0 and not bad, "; ".join(bad[:3]) or f"{n} centred"


COLOURS = """() => { const seen = {}; VizOS.slides.forEach((sl, i) => Object.keys(sl.ctx.symbols || {}).forEach(q => sl.r.node.querySelectorAll(`.lt-${CSS.escape(q)}, .sy-${CSS.escape(q)}`).forEach(e => { const c = getComputedStyle(e).color; (seen[q] = seen[q] || {})[c] = i + 1; })));
  return Object.entries(seen).filter(([q, m]) => Object.keys(m).length > 1).map(([q, m]) => [q, Object.keys(m).length]); }"""


def one_colour(page):
    """A symbol has one colour in every scene of a lesson."""
    bad = page.evaluate(COLOURS)
    return not bad, f"{bad[:4]}" if bad else "one each"


def frames(page):
    """Formula cards and matrix panels wear the figure's frame, and a formula card has no side padding; the chip is all orange."""
    r = page.evaluate("""() => { const bad = [], ac = 'rgb(255, 90, 54)'; document.querySelectorAll('.asm, .bops .opsw, .bops .opcard').forEach(e => { const c = getComputedStyle(e), a = getComputedStyle(e, '::after'); if (c.backgroundColor !== 'rgba(0, 0, 0, 0)' || c.borderLeftWidth !== '0px' || c.borderBottomWidth !== '0px' || a.width !== '64px' || a.height !== '3px' || c.boxShadow === 'none') bad.push(e.className); });
      document.querySelectorAll('.asm').forEach(e => { const c = getComputedStyle(e); if (c.paddingLeft !== '0px' || c.paddingRight !== '0px' || Math.abs(e.getBoundingClientRect().width - e.closest('.board').getBoundingClientRect().width) > 2) bad.push('asm width'); });
      document.querySelectorAll('.s-board .head .eyebrow').forEach(e => { const c = getComputedStyle(e); if (c.borderTopColor !== ac || !c.boxShadow.startsWith(ac) || !c.boxShadow.endsWith('3px 3px 0px 0px')) bad.push('chip ' + c.boxShadow); }); return bad; }""")
    return not r, f"{r[:3]}" if r else "frames ok"


def no_lines(page):
    """A callout, a number card and a think card have no line, box, ground or left padding, in the page and in side columns."""
    r = page.evaluate("""() => { const es = [...document.querySelectorAll('.board .rl, .board .think.g')]; return [es.length, es.filter(e => { const c = getComputedStyle(e); return c.borderTopWidth !== '0px' || c.borderBottomWidth !== '0px' || c.borderLeftWidth !== '0px' || c.paddingLeft !== '0px' || c.paddingTop !== '0px' || c.paddingBottom !== '0px' || c.backgroundColor !== 'rgba(0, 0, 0, 0)' || c.boxShadow !== 'none'; }).map(e => e.className).slice(0, 3)]; }""")
    return r[0] > 0 and not r[1], f"{r[0]} cards, lined: {r[1]}"


def card_gap(page):
    """A line stands 18 px from the card it brings, and level with it; steps stand 28 px apart."""
    sized(page, 1480, 800)
    r = page.evaluate("""() => { const rc = e => e.getBoundingClientRect(), gaps = [], left = [], apart = [];
      document.querySelectorAll('.st > .say').forEach(s => { const c = s.nextElementSibling; if (c && c.matches('.rl, .think, .asm, .cline, .fline') && rc(s).height && rc(c).height) { gaps.push(rc(c).top - rc(s).bottom); if (!c.matches('.cline, .asm')) left.push(rc(c).left - rc(s).left); } });
      document.querySelectorAll('.lines > .st + .st, .fside > .st + .st').forEach(s => { const p = s.previousElementSibling; if (rc(s).height && rc(p).height) apart.push(rc(s).top - rc(p).bottom); });
      document.querySelectorAll('.fb:not(.beside) .st.intro > .say').forEach(s => { const f = s.closest('.fb').querySelector('.ffig'); if (rc(s).height && rc(f).height) gaps.push(rc(f).top - rc(s).bottom); });
      return [gaps, left, apart]; }""")
    sized(page, 1440, 900)
    bad = [round(x, 1) for x in r[0] if abs(x - 18) > 1] + [f"left {round(x)}" for x in r[1] if abs(x) > 1] + [f"apart {round(x)}" for x in r[2] if abs(x - 28) > 1]
    return bool(r[0]) and not bad, f"{len(r[0])} gaps, {len(r[2])} steps" + (f", off: {bad[:4]}" if bad else "")


def lit_mark(page):
    """A lit callout or think card shows the orange bar hung outside its edge, a marked one too, in or out of a step, and its text does not move."""
    r = page.evaluate("""() => { const ac = 'rgb(255, 90, 54)', bad = [], still = document.head.appendChild(document.createElement('style')); still.textContent = '.board *::before { transition: none !important; }'; let n = 0; const box = e => { const r = document.createRange(); r.selectNodeContents(e); const q = r.getBoundingClientRect(); return [q.left, q.top, q.width, q.height].map(Math.round).join(); };
      VizOS.slides.forEach(sl => { if (!sl.r.hover) return; const es = [...sl.r.node.querySelectorAll('.rl, .think')].filter(e => e.getClientRects().length); es.forEach(e => { const at = +(e.dataset.at || 0), lit = c => [c.backgroundColor, c.width, c.position, parseFloat(c.left) < 0], cs = () => getComputedStyle(e, '::before'), id = sl.r.node.id;
          n++; sl.r.hover(0); const was = box(e); if (cs().backgroundColor === ac && !e.closest('.atstop')) bad.push([id, 'lit at rest']);
          sl.r.hover(at); const a = lit(cs()); if (a[0] !== ac || a[1] !== '4px' || a[2] !== 'absolute' || !a[3] || box(e) !== was) bad.push([id, e.className, 'step', a]);
          sl.r.hover(null); if (e.matches('.rl')) { e.classList.add('hl'); const b = lit(cs()); if (b[0] !== ac || getComputedStyle(e).boxShadow !== 'none' || box(e) !== was) bad.push([id, 'hl', b]); e.classList.remove('hl'); } }); });
      still.remove(); return [n, bad]; }""")
    page.evaluate("VizOS.slides.forEach(sl => sl.r.reset && sl.r.reset())")
    return r[0] > 0 and not r[1], f"{r[0]} cards" + (f", off: {r[1][:3]}" if r[1] else "")


def legend_room(page):
    """A legend sits 10 px under the frame's top line (8 px padding, 2 px more)."""
    r = page.evaluate("""() => [...document.querySelectorAll('.bi.plane > .plegend, .bvis .vhead')].filter(e => e.offsetHeight).map(e => { const f = e.closest('.vis, .plane'), k = e.querySelector('.pk, .legend span'); return k ? Math.round(k.getBoundingClientRect().top - f.getBoundingClientRect().top) : null; }).filter(x => x != null)""")
    bad = [x for x in r if x < 10]
    return not bad, f"{len(r)} legends" + (f", tight: {bad[:4]}" if bad else "")


# the pause button: what it shows, and whether the first name with `says` that is on the page opens its pop-up
PAUSE = """() => { const b = document.getElementById('lspause'); return b && [b.getAttribute('aria-pressed'), b.getAttribute('aria-label')]; }"""
POP_OPEN = "() => !!document.querySelector('.vpop.on')"


def hover_pause(page):
    """Pause hover pop-ups: a button only on a page with `says`, in the margin above the rail at 1280 and 1000 px;
    while paused, pointing opens nothing and a click still does; the choice survives a reload; pausing closes a hover pop-up."""
    n = page.evaluate("document.querySelectorAll('.says').length")
    if not n:
        return page.evaluate(PAUSE) is None, "no says, no button"
    bad = []
    for w, hh in ((1280, 900), (1000, 800)):
        page.set_viewport_size({"width": w, "height": hh}); page.wait_for_timeout(250)
        r = page.evaluate("""() => { const b = document.getElementById('lspause').getBoundingClientRect(), r = document.getElementById('lsrail').getBoundingClientRect(), l = document.getElementById('lesson').getBoundingClientRect();
          return [Math.round(r.top - b.bottom), Math.round(b.left - l.right), Math.round(innerWidth - b.right), b.width, Math.round(b.top)]; }""")
        if r[0] < 2 or r[1] < 0 or r[2] < 0 or r[3] < 16 or r[4] < 0:
            bad.append(f"{w}: gap to rail {r[0]}, to page {r[1]}, to edge {r[2]}, width {r[3]}")
    page.set_viewport_size({"width": 1440, "height": 900}); page.wait_for_timeout(250)
    if page.evaluate(PAUSE)[0] == "true":
        page.click("#lspause")
    # the first name with says that is drawn and not waiting for its step
    # every stepped figure to its last stop, so names that come in on a later step are up
    page.evaluate("VizOS.slides.forEach(sl => (sl.r.stages || []).forEach(S => { for (let k = 0; k < 40 && S.move(1); k++); }))")
    pick = """() => { const e = [...document.querySelectorAll('.board .says')].find(e => e.getClientRects().length && !e.closest('[data-step]:not(.shown)')); if (!e) return null; e.scrollIntoView({block: 'center'}); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }"""
    xy = page.evaluate(pick)
    if not xy:
        return False, "no name with says is shown"
    page.wait_for_timeout(150); xy = page.evaluate(pick); page.wait_for_timeout(100)
    away = lambda: (page.mouse.move(5, 300), page.wait_for_timeout(100))
    page.mouse.move(*xy); page.wait_for_timeout(100)
    hover_on = page.evaluate(POP_OPEN)
    # pause from the keyboard while the pointer rests on the name: its pop-up closes
    page.focus("#lspause"); page.keyboard.press("Enter"); page.wait_for_timeout(100)
    closed = not page.evaluate(POP_OPEN); state = page.evaluate(PAUSE)
    away(); page.mouse.move(*xy); page.wait_for_timeout(100)
    paused_hover = page.evaluate(POP_OPEN)
    page.mouse.click(*xy); page.wait_for_timeout(100)
    paused_click = page.evaluate(POP_OPEN)
    page.mouse.click(5, 300); page.wait_for_timeout(100)
    page.reload(); page.wait_for_function("window.VizOS && VizOS.ready === true", timeout=20000); page.wait_for_timeout(300)
    kept = page.evaluate(PAUSE)
    page.click("#lspause"); page.reload(); page.wait_for_function("window.VizOS && VizOS.ready === true", timeout=20000); page.wait_for_timeout(300)
    back = page.evaluate(PAUSE)
    want = (hover_on, closed, state == ["true", "Resume hover pop-ups"], not paused_hover, paused_click, kept and kept[0] == "true", back == ["false", "Pause hover pop-ups"])
    ok = all(want) and not bad
    return ok, f"{n} names; hover, closes, pressed, quiet, click, kept, resumed: {want}" + (f"; {bad}" if bad else "")


def case_page(ctx, case):
    """Build a class case into out/board-ui and open it."""
    html = ROOT / f"out/board-ui/{case}.html"
    html.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([sys.executable, ROOT / "plugins/viz-os/skills/class/scripts/lesson.py", ROOT / f"tools/class-cases/{case}.yaml", "-o", html, "--quiet"], capture_output=True, check=True)
    page = ctx.new_page(); page.goto(html.as_uri()); page.wait_for_function("window.VizOS && VizOS.ready === true", timeout=20000); page.wait_for_timeout(300)
    return page


def no_says_page(ctx):
    """A lesson whose formula has no symbols (so nothing opens a card) has no targets and no pause button, but has its formula."""
    page = case_page(ctx, "no-card")
    r = page.evaluate("[document.querySelectorAll('.katex').length > 0, document.querySelectorAll('.vt, .says').length, !!document.getElementById('lspause')]"); page.close()
    return r == [True, 0, False], f"formula drawn, targets, button: {r}"


def slider_card(ctx):
    """A term's card says its value now: open on y = 2k, move the slider, and the open card reads the new value."""
    page = case_page(ctx, "pop-slider")
    page.evaluate("document.querySelector('.cline .lt-y').scrollIntoView({block: 'center'})"); page.click(".cline .lt-y"); page.wait_for_timeout(150)
    a = page.evaluate("(document.querySelector('.vpop.on .vv') || {}).textContent")
    page.evaluate("() => { const e = document.querySelector('input[type=range]'); e.value = 3; e.dispatchEvent(new Event('input', {bubbles: true})); }"); page.wait_for_timeout(300)
    b = page.evaluate("(document.querySelector('.vpop.on .vv') || {}).textContent")
    page.close()
    return (a, b) == ("= 4", "= 6"), f"value before, after: {a!r}, {b!r}"


SET_K = "v => { const e = document.querySelector('input[type=range]'); e.value = v; e.dispatchEvent(new Event('input', {bubbles: true})); }"
# which v is lit: its place among the page's v brackets, whether it sits in a teacher line, and whether the card is open
LIT_V = "() => [[...document.querySelectorAll('.mt-v')].findIndex(e => e.classList.contains('act')), !!document.querySelector('.say .mt-v.act'), !!document.querySelector('.vpop.on')]"


ALL_STEPS = "VizOS.slides.forEach(sl => (sl.r.stages || []).forEach(S => { for (let k = 0; k < 40 && S.move(1); k++); }))"
SAY_WITH = "t => ([...document.querySelectorAll('.st .say')].map(e => e.textContent.replace(/\\s+/g, ' ').trim()).find(x => x.startsWith(t)) || '')"


def prod_live(ctx):
    """A worked product under a slider: a scene derive that reads the result keeps up (prod-derive-order), and the
    teacher line gives v's numbers in the format the formula gives them now (prod-say-format)."""
    page = case_page(ctx, "prod-derive-order")
    a = page.evaluate(SAY_WITH, "Twice"); page.evaluate(SET_K, 3); page.wait_for_timeout(300); b = page.evaluate(SAY_WITH, "Twice"); page.close()
    page = case_page(ctx, "prod-say-format")
    got = []
    for k in (2, 1, 1.5):
        page.evaluate(SET_K, k); page.wait_for_timeout(300)
        got.append(page.evaluate(SAY_WITH, "Take"))
    page.close()
    want = ["Twice the first reading is 20.", "Twice the first reading is 60.", "Take 2 of column 1 and 2 of column 2.",
            "Take 1 of column 1 and 1 of column 2.", "Take 1.5 of column 1 and 1.5 of column 2."]
    return [a, b, *got] == want, f"lines: {[a, b, *got]}"


def prod_colours(ctx):
    """With no input colours the pairs take the series colours s1, s2, the plane's arrows the same two, and the final
    answer stays ink even though the result's symbol has colours of its own (prod-colours)."""
    page = case_page(ctx, "prod-colours")
    page.evaluate(ALL_STEPS); page.wait_for_timeout(300)
    r = page.evaluate("""() => { const c = q => { const e = document.querySelector('.fline .kc-' + q); return e ? getComputedStyle(e).color : null; };
      const fl = [...document.querySelectorAll('.fline')], last = fl[fl.length - 1];
      const strokes = [...document.querySelectorAll('.board svg line')].map(l => getComputedStyle(l).stroke);
      return [c('s1'), c('s2'), strokes.includes(c('s1')), strokes.includes(c('s2')), last.querySelectorAll('.mt-y').length, last.querySelectorAll('.mt-y .kc').length]; }""")
    page.close()
    return bool(r[0] and r[1] and r[2] and r[3] and r[4] and r[5] == 0), f"s1, s2 in terms; arrows s1, s2; answer brackets, coloured cells in them: {r}"


def say_refind(ctx):
    """A slider redraws the teacher lines: a card pinned on the second v (in a say) stays open on that same second v,
    and a card opened by keyboard focus stays on it with the focus."""
    page = case_page(ctx, "pop-slider")
    page.evaluate("VizOS.slides.forEach(sl => (sl.r.stages || []).forEach(S => { for (let k = 0; k < 40 && S.move(1); k++); }))"); page.wait_for_timeout(150)
    n = page.evaluate("document.querySelectorAll('.say .mt-v.vt').length")
    page.evaluate("document.querySelectorAll('.mt-v')[1].scrollIntoView({block: 'center'})")
    page.locator(".mt-v").nth(1).click(); page.wait_for_timeout(150)
    a = page.evaluate(LIT_V)
    page.evaluate(SET_K, 3); page.wait_for_timeout(400)
    b = page.evaluate(LIT_V)
    page.locator(".mt-v").nth(1).click(); page.wait_for_timeout(100)          # unpin
    page.keyboard.press("Shift"); page.evaluate("document.querySelectorAll('.mt-v')[1].focus()"); page.wait_for_timeout(150)
    page.evaluate(SET_K, 1); page.wait_for_timeout(400)
    c = page.evaluate("(" + LIT_V + ")().concat(document.activeElement === document.querySelectorAll('.mt-v')[1])")
    page.close()
    want = [1, True, True]
    return n == 2 and a == want and b == want and c == want + [True], f"say targets {n}; before {a}, after the slider {b}, focused after {c}"


def clamp_card(ctx):
    """At 1280 x 720 a card on a tall bracket at the bottom of the window, or at its top, stays inside the window."""
    page = ctx.new_page(); page.set_viewport_size({"width": 1280, "height": 720})
    page.goto((EX / "board-gallery/lesson.html").as_uri()); page.wait_for_function("window.VizOS && VizOS.ready === true", timeout=20000); page.wait_for_timeout(300)
    page.evaluate("VizOS.slides.forEach(sl => (sl.r.stages || []).forEach(S => { for (let k = 0; k < 40 && S.move(1); k++); }))"); page.wait_for_timeout(150)
    out = []
    for where in ("bottom", "top"):
        page.mouse.move(2, 2); page.wait_for_timeout(60)
        box = page.evaluate(f"""() => {{ const e = [...document.querySelectorAll('.mt-cellmat.vt')].find(m => m.getClientRects().length); const r = e.getBoundingClientRect();
          scrollBy(0, {"r.top - innerHeight + 60" if where == "bottom" else "r.bottom - 60"}); const q = e.getBoundingClientRect(); return [q.left + q.width / 2, {"innerHeight - 30" if where == "bottom" else "30"}]; }}""")
        page.wait_for_timeout(100); page.mouse.move(*box); page.wait_for_timeout(150)
        out.append(page.evaluate("() => { const k = document.querySelector('.vpop.on'); if (!k) return null; const r = k.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), innerHeight]; }"))
    page.close()
    ok = all(o and o[0] >= 0 and o[1] <= o[2] for o in out)
    return ok, f"card top, bottom, window (bottom, top): {out}"


# the open card: its text's left and right gaps to the frame, its frame colour, the term's own colour (--hc), how much of the
# formula is faded and whether the term itself is, and its shape chip
CARD = """t => { const k = document.querySelector('.vpop.on'); if (!k) return null; const r = k.getBoundingClientRect(), rg = document.createRange(), w = document.createTreeWalker(k, NodeFilter.SHOW_TEXT); let lo = 1e9, hi = -1e9;
  while (w.nextNode()) { if (w.currentNode.parentElement.closest('.katex-mathml')) continue; rg.selectNodeContents(w.currentNode); for (const q of rg.getClientRects()) if (q.width) { lo = Math.min(lo, q.left); hi = Math.max(hi, q.right); } }
  k.querySelectorAll('.katex-html, svg, .chip').forEach(q => { const b = q.getBoundingClientRect(); if (b.width) { lo = Math.min(lo, b.left); hi = Math.max(hi, b.right); } });
  const probe = document.createElement('span'); probe.style.color = 'var(--hc)'; t.appendChild(probe); const hc = getComputedStyle(probe).color; probe.remove();
  const chip = k.querySelector('.chip'), vv = k.querySelector('.vv');
  return { l: lo - r.left, r: r.right - hi, border: getComputedStyle(k).borderTopColor, hc, dm: document.querySelectorAll('.dm').length, self: !!t.closest('.dm'), chip: chip && chip.textContent, vv: vv && vv.textContent, w: r.width }; }"""
MARK_T = "e => { e.setAttribute('data-ui-t', '1'); }"


def hover_card(page, sel_js):
    """Point at the first shown target the JS expression picks; returns (the card's measures, the target's selector)."""
    page.evaluate("document.querySelectorAll('[data-ui-t]').forEach(e => e.removeAttribute('data-ui-t'))")
    ok = page.evaluate(f"""() => {{ const e = ({sel_js})(); if (!e) return false; e.setAttribute('data-ui-t', '1'); e.scrollIntoView({{block: 'center'}}); return true; }}""")
    if not ok:
        return None
    page.mouse.move(5, 300); page.wait_for_timeout(60)
    page.hover("[data-ui-t]"); page.wait_for_timeout(120)
    m = page.evaluate(f"() => ({CARD})(document.querySelector('[data-ui-t]'))")
    page.mouse.move(5, 300); page.wait_for_timeout(80)
    return m


SHOWN = "e => e.getClientRects().length && !e.closest('[data-step]:not(.shown)') && getComputedStyle(e).visibility !== 'hidden'"


PAGE = {}   # the lesson open now: its YAML and data, for the tests that know what the page must have


def walk(o):
    if isinstance(o, dict):
        yield o
        for v in o.values(): yield from walk(v)
    elif isinstance(o, list):
        for v in o: yield from walk(v)


def expected_kinds(Y):
    """The kinds of pop-up target the lesson's YAML puts on the page."""
    S, items = Y.get("symbols") or {}, list(walk(Y.get("slides") or []))
    says = {q for q, v in S.items() if isinstance(v, dict) and v.get("says")}
    kinds = set()
    if any(isinstance(d.get("calc"), dict) and d["calc"].get("name") in says for d in items): kinds.add("formula term")
    if "\\mat{" in PAGE["text"] or any("matrix" in d and isinstance(d.get("matrix"), str) or isinstance(d.get("vec"), str) for d in items): kinds.add("brackets")
    if any(isinstance(d.get("plane"), dict) and any(isinstance(m, dict) and m.get("says") for m in walk(d["plane"])) for d in items): kinds.add("plane name")
    return kinds


def pop_cards(page):
    """Every kind of target on the page (a formula term, a matrix's brackets, a plane name or legend entry): its card is as wide as
    its text (left and right gaps within 1 px), framed in the term's colour; a formula term fades the rest of its formula, not
    itself, and nothing stays faded once the pointer leaves."""
    page.evaluate("VizOS.slides.forEach(sl => (sl.r.stages || []).forEach(S => { for (let k = 0; k < 40 && S.move(1); k++); }))")
    kinds = {"formula term": "'.cline .vt, .fline .lt.vt, .asm .vt'", "brackets": "'.mt.vt'", "plane name": "'.plane .vt'"}
    out, bad, want = [], [], expected_kinds(PAGE["yaml"])
    for kind, sel in kinds.items():
        m = hover_card(page, f"() => [...document.querySelectorAll({sel})].find({SHOWN})")
        if m is None:
            if kind in want: bad.append(f"{kind}: the YAML has one, the page has no target")
            continue
        out.append(kind)
        if abs(m["l"] - m["r"]) > 1: bad.append(f"{kind}: gaps {m['l']:.1f} / {m['r']:.1f}")
        if m["border"] != m["hc"]: bad.append(f"{kind}: frame {m['border']} vs term {m['hc']}")
        if kind != "plane name" and (not m["dm"] or m["self"]): bad.append(f"{kind}: faded {m['dm']}, itself {m['self']}")
    left = page.evaluate("[document.querySelectorAll('.dm').length, !!document.querySelector('.vpop.on')]")
    if left != [0, False]: bad.append(f"after leaving: faded {left[0]}, card {left[1]}")
    return bool(out) and not bad, f"{', '.join(out)} (YAML wants {', '.join(sorted(want))})" + (f"; {bad[:3]}" if bad else "")


def mat_card(page):
    """\\mat brackets and matrix/vec items open their symbol's card, with its shape worked out here from data.json
    (rows × columns; a row item is 1 × n). A page whose YAML has brackets must have bracket targets."""
    has = "brackets" in expected_kinds(PAGE["yaml"])
    found = page.evaluate(f"() => [...new Set([...document.querySelectorAll('.mt.vt')].filter({SHOWN}).map(e => [...e.classList].find(c => c.startsWith('mt-')).slice(3) + (e.closest('.mrow') ? '|row' : '')))]")
    if not found:
        return not has, "no brackets on this page" if not has else "the YAML has brackets, the page has no .mt target"
    out, bad = [], []
    for key in found:
        q, row = key.split("|")[0], key.endswith("|row")
        v = PAGE["data"].get(q)
        if not isinstance(v, list) or not v:
            bad.append(f"{q}: not in data.json"); continue
        want = f"{len(v)} × {len(v[0])}" if isinstance(v[0], list) else f"1 × {len(v)}" if row else f"{len(v)} × 1"
        sel = f".mrow .mt-{q}.vt" if row else f".mt-{q}.vt:not(.mrow .mt-{q})"
        m = hover_card(page, f"() => [...document.querySelectorAll('{sel}')].find({SHOWN})")
        got = m and m["chip"]
        out.append(f"{q}{' row' if row else ''} {got}")
        if got != want: bad.append(f"{q}: chip {got!r}, data.json {want!r}")
    return not bad, "; ".join(out) + (f"; {bad}" if bad else "")


# the term's computed filter; the focus ring's border and whether it holds the whole term; whether the term is :focus-visible
GLOW = """() => { const e = document.querySelector('[data-ui-t]'), cs = getComputedStyle(e), g = document.querySelector('.vring.on'), b = [...e.querySelectorAll('*')].reduce((u, q) => { const r = q.getBoundingClientRect(); return r.width && r.height ? [Math.min(u[0], r.left), Math.min(u[1], r.top), Math.max(u[2], r.right), Math.max(u[3], r.bottom)] : u; }, [1e9, 1e9, -1e9, -1e9]);
  const k = g && g.getBoundingClientRect(), gs = g && getComputedStyle(g); return [cs.filter, g ? gs.borderTopStyle : 'none', g ? gs.borderTopWidth : '0px', e.matches(':focus-visible'), !!g && k.left <= b[0] && k.top <= b[1] && k.right >= b[2] && k.bottom >= b[3]]; }"""


def glows(f):
    """The drop-shadow colour in a computed filter, and whether it shows (not transparent, alpha above 0)."""
    m = re.search(r"drop-shadow\((rgba?\([^)]*\))", f or "")
    if not m: return None, False
    n = [float(x) for x in re.findall(r"[\d.]+", m.group(1))]
    return m.group(1), len(n) == 3 or n[3] > 0


def glow_focus(page):
    """A hovered term glows in a real colour (the filter computes to a drop-shadow that is not transparent), and a term
    reached by the keyboard glows and wears a focus ring."""
    if not page.evaluate("document.querySelectorAll('.vt').length"):
        return not expected_kinds(PAGE["yaml"]), "no targets on this page"
    page.evaluate("document.querySelectorAll('[data-ui-t]').forEach(e => e.removeAttribute('data-ui-t'))")
    page.evaluate(f"() => {{ const e = [...document.querySelectorAll('.vt')].find({SHOWN}); e.setAttribute('data-ui-t', '1'); e.scrollIntoView({{block: 'center'}}); }}")
    page.mouse.move(5, 300); page.hover("[data-ui-t]"); page.wait_for_timeout(200)
    hov = page.evaluate(GLOW)
    page.mouse.move(5, 300); page.wait_for_timeout(100)
    page.keyboard.press("Shift"); page.evaluate("document.querySelector('[data-ui-t]').focus()"); page.wait_for_timeout(200)
    foc = page.evaluate(GLOW)
    page.evaluate("document.activeElement.blur()"); page.wait_for_timeout(80)
    (hc, hok), (fc, fok) = glows(hov[0]), glows(foc[0])
    ring = foc[3] and foc[1] != "none" and float(foc[2].rstrip("px") or 0) >= 1 and foc[4] and hov[1] == "none"
    return hok and fok and ring, f"hover glow {hc}, focus glow {fc}, ring {foc[1]} {foc[2]} round the term {foc[4]} (focus-visible {foc[3]}), no ring on hover {hov[1] == 'none'}"


# controls (change 5): every row of a box shares one grid, so tracks start and end at one x; a toggle's buttons sit centred in
# the track column; a run's value column shows its `show:` value, else its bare frame
CTL_GRID = """() => { const out = [], rc = e => e.getBoundingClientRect();
  document.querySelectorAll('.board .controls').forEach((b, k) => { if (!rc(b).width) return; const ts = [...b.querySelectorAll('.ctl > input')].map(rc);
    if (ts.length && ts.some(t => Math.abs(t.left - ts[0].left) > 1 || Math.abs(t.right - ts[0].right) > 1)) out.push(`box ${k}: tracks at ${ts.map(t => Math.round(t.left) + '-' + Math.round(t.right)).join(', ')}`);
    b.querySelectorAll('.ctl.tog > .seg2').forEach(g => { const t = ts[0] || rc(b.querySelector('.ctl.tog')), r = rc(g);
      if (ts.length && Math.abs((r.left + r.right) / 2 - (ts[0].left + ts[0].right) / 2) > 2) out.push(`box ${k}: toggle centre ${Math.round((r.left + r.right) / 2)} vs track ${Math.round((ts[0].left + ts[0].right) / 2)}`); }); });
  VizOS.slides.forEach((sl, i) => (sl.s.controls || []).forEach(c => { if (!c.run || c.show) return; const e = document.getElementById(`ctl-${i}-${c.name}`), o = e && e.parentNode.querySelector('output');
    if (o && o.textContent !== String(+e.value)) out.push(`slide ${i + 1} run ${c.name}: reads ${o.textContent}, frame ${e.value}`); }));
  return [document.querySelectorAll('.board .controls').length, out]; }"""


def ctl_grid(page):
    n, bad = page.evaluate(CTL_GRID)
    return not bad, f"{n} boxes" + (f"; {bad[:4]}" if bad else "")


def ctl_case(ctx):
    """The stack case: at frame 10 of 20 the run reads s = 0.50 bare; the s label opens s's card; the card blurs what is behind it."""
    page = case_page(ctx, "ctl-good")
    page.evaluate("document.querySelector('.controls').scrollIntoView({block: 'center'})")
    page.evaluate("VizOS.slides[1].ctx.ctl.t(10)"); page.wait_for_timeout(300)
    out = page.evaluate("[...document.querySelectorAll('.ctl output')].map(o => o.textContent)")
    grid = page.evaluate(CTL_GRID)[1]
    page.hover(".ctl.run .clab"); page.wait_for_timeout(250)
    card = page.evaluate("() => { const k = document.querySelector('.vpop.on'); return k && [k.querySelector('.ttl b') && k.querySelector('.ttl b').textContent, (k.querySelector('.vv') || {}).textContent, getComputedStyle(k).backdropFilter || getComputedStyle(k).webkitBackdropFilter]; }")
    page.mouse.move(5, 5); page.wait_for_timeout(150)
    page.hover(".ctl.tog .clab"); page.wait_for_timeout(250)
    word = page.evaluate("() => { const k = document.querySelector('.vpop.on'); return k && [k.querySelector('.ttl b').textContent, (k.querySelector('.ds') || {}).textContent]; }")
    page.close()
    ok = out[:2] == ["0.50", "1.0"] and not grid and card and card[:2] == ["leak", "= 0.50"] and "blur" in (card[2] or "") and word and word[0] == "before" and "scanner" in (word[1] or "")
    return ok, f"readouts {out}, grid {grid}, s card {card}, word card {word}"


# chart marks on a board (change 5, part 2): no tag on the plot, a legend entry per named mark, the board's card on the mark
CHART_TAGS = """() => { const out = []; let n = 0;
  document.querySelectorAll('.board .bvis.chart').forEach((b, k) => { const names = [...b.querySelectorAll('.legend .mkx')].map(e => e.textContent.trim()); n += names.length;
    const texts = [...b.querySelectorAll('.chart > svg text')].map(t => t.textContent.trim());
    names.forEach(nm => { if (texts.some(t => t && t.includes(nm))) out.push(`chart ${k}: "${nm}" is drawn on the plot`); }); });
  return [n, out]; }"""


def chart_tags(page):
    n, bad = page.evaluate(CHART_TAGS)
    return not bad, f"{n} mark entries" + (f"; {bad[:3]}" if bad else "")


def chart_case(ctx):
    """chart-marks-good: no tag text on the plot; legend entries; the mean line's card says the mean now and follows the
    slider; the data pop-up has the glass look; pointing at the mark hides the data pop-up and opens the card."""
    import statistics
    Y = yaml.safe_load((ROOT / "tools/class-cases/chart-marks-good.yaml").read_text())
    cd3 = Y["data"]["cd3"]; m0 = statistics.fmean(cd3); m2 = statistics.fmean([v + (2 if i == 1 else 0) for i, v in enumerate(cd3)])
    page = case_page(ctx, "chart-marks-good")
    page.evaluate("document.querySelector('.bvis.chart').scrollIntoView({block: 'center'})"); page.wait_for_timeout(200)
    tags = page.evaluate(CHART_TAGS)
    legend = page.evaluate("[...document.querySelectorAll('.bvis.chart .legend .mkx')].map(e => e.textContent.trim())")
    # the data pop-up first: point at a cell's dot
    dot = page.locator(".bvis.chart .chart > svg circle").nth(3).bounding_box()   # c4, clear of every mark
    for dx in range(0, 130, 10):   # the chart's pop-up answers near a category's left edge: walk left from the dot
        page.mouse.move(dot["x"] + dot["width"] / 2 - dx, dot["y"] + dot["height"] / 2); page.wait_for_timeout(60)
        if page.evaluate("document.querySelector('.bvis.chart .tip').classList.contains('on')"):
            break
    tip = page.evaluate("() => { const t = document.querySelector('.bvis.chart .tip'); return [t.classList.contains('on'), getComputedStyle(t).backdropFilter || getComputedStyle(t).webkitBackdropFilter]; }")
    hit = page.locator('.bvis.chart .mhit[data-sym="xbar"]').first.bounding_box()
    page.mouse.move(hit["x"] + hit["width"] * .3, hit["y"] + hit["height"] / 2); page.wait_for_timeout(250)
    card = lambda: page.evaluate("() => { const k = document.querySelector('.vpop.on'); return k && [k.querySelector('.ttl b').textContent, (k.querySelector('.vv') || {}).textContent]; }")
    a = card(); tip_after = page.evaluate("document.querySelector('.bvis.chart .tip').classList.contains('on')")
    page.evaluate("VizOS.slides[1].ctx.ctl.k(2)"); page.wait_for_timeout(500)
    b = card()
    page.close()
    want = (not tags[1], legend == ["mean", "usual range", "top cell"], tip[0] and "blur" in (tip[1] or ""), not tip_after,
            a == ["mean", f"= {m0:.2f}"], b == ["mean", f"= {m2:.2f}"])
    return all(want), f"no tags, legend, glass tip, tip hides, card, follows: {want}; legend {legend}, tip {tip}, card {a} -> {b}"


def chart_fixes(ctx):
    """chart-marks-ui: a legend entry hides with its mark until the mark's step (no pointer, no Tab); an unnamed mark has no
    hit area; a point's card shows its pair; the mean line draws in its symbol's colour; pointing at a legend entry lights
    its mark and pointing at a mark lights its entry; the chart's guide takes no pointer; inside a data dot the dot wins."""
    import statistics
    Y = yaml.safe_load((ROOT / "tools/class-cases/chart-marks-ui.yaml").read_text())
    cd3 = Y["data"]["cd3"]
    page = case_page(ctx, "chart-marks-ui")
    page.evaluate("document.querySelector('.bvis.chart').scrollIntoView({block: 'center'})"); page.wait_for_timeout(200)
    S = "VizOS.slides.flatMap(sl => sl.r.stages || [])[0]"
    page.evaluate(f"{S}.to(0)"); page.wait_for_timeout(150)
    entry = "[...document.querySelectorAll('.bvis.chart .legend .mkx')].find(e => e.textContent.trim() === 'top cell')"
    before = page.evaluate(f"() => {{ const e = {entry}; e.focus(); return [getComputedStyle(e).visibility, document.activeElement === e]; }}")
    page.evaluate(f"{S}.to({S}.stops.length - 1)"); page.wait_for_timeout(150)
    after = page.evaluate(f"() => getComputedStyle({entry}).visibility")
    no_hit = page.evaluate("[...document.querySelectorAll('.bvis.chart g.mkm')].filter(g => g.querySelector('line') && !g.querySelector('.mhit')).length")
    # the point's card: its pair, from the data (x 1.5, y the top cell)
    eb = page.evaluate(f"() => {{ const b = {entry}.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }}")
    page.mouse.move(*eb); page.wait_for_timeout(250)
    pair = page.evaluate("() => { const k = document.querySelector('.vpop.on'); return k && (k.querySelector('.vv') || {}).textContent; }")
    lit_mark = page.evaluate("[...document.querySelectorAll('.bvis.chart g.mkm.lit')].length")
    page.mouse.move(5, 5); page.wait_for_timeout(200)
    # the mean line in x-bar's colour, and pointing at it lights its legend entry
    col = page.evaluate("""() => { const g = document.querySelector('.bvis.chart .mhit[data-sym="xbar"]').closest('g.mkm'), ln = g.querySelector('line:not(.mhit)');
      const pr = document.createElement('span'); pr.style.color = 'var(--s2)'; document.body.appendChild(pr); const want = getComputedStyle(pr).color; pr.remove();
      return [getComputedStyle(ln).stroke, want]; }""")
    hit = page.locator('.bvis.chart .mhit[data-sym="xbar"]').first.bounding_box()
    page.mouse.move(hit["x"] + hit["width"] * .9, hit["y"] + hit["height"] / 2); page.wait_for_timeout(250)
    lit_entry = page.evaluate("[...document.querySelectorAll('.bvis.chart .legend .mkx.lit')].map(e => e.textContent.trim())")
    guide = page.evaluate("[...document.querySelectorAll('.bvis.chart svg line.grid')].map(l => getComputedStyle(l).pointerEvents)")
    # inside a data dot under the mean line the dot wins: no mark card, the pass-through class is on
    m = statistics.fmean(cd3); i = min(range(len(cd3)), key=lambda j: abs(cd3[j] - m))
    page.mouse.move(5, 5); page.wait_for_timeout(200)
    dot = page.locator(".bvis.chart .chart > svg g.mk:not(.mkm) circle").nth(i).bounding_box()
    page.mouse.move(dot["x"] + dot["width"] / 2, dot["y"] + dot["height"] / 2); page.wait_for_timeout(250)
    on_dot = page.evaluate("[document.querySelector('.bvis.chart svg').classList.contains('ondot'), !!document.querySelector('.vpop.on')]")
    page.close()
    want = (before == ["hidden", False], after == "visible", no_hit >= 1, pair == f"= (1.5, {max(cd3):.1f})", lit_mark == 1,
            col[0] == col[1], lit_entry == ["mean"], all(g == "none" for g in guide), on_dot == [True, False])
    return all(want), f"hidden before step, shown after, unnamed has no hit, pair, legend lights mark, symbol colour, mark lights legend, guide, dot wins: {want}; {before} {after} {no_hit} {pair} {col} {lit_entry} {guide} {on_dot}"


TESTS = [("Next changes a figure, Back undoes it", next_back), ("a click on a line goes to its stop", click_line), ("a think step's stop opens it", think_stop),
         ("Show answer grows its card from a fixed top", show_answer), ("a slider changes a number", slider), ("a run's scrubber moves the lit line", scrubber),
         ("scrolling lights steps and fills columns, figures stay", scrolling), ("no sideways scroll; planes equal; charts and images keep their ratio", widths),
         ("a long formula sends its figure above its text", narrow_formula), ("the plan shows no lines of text", plan_words), ("the scene counter stays in the margin", rail_margin),
         ("a column not filled in keeps its row lines", row_lines), ("Back and Next stay on screen", next_on_screen), ("the line by the buttons stays on screen", stop_line),
         ("Next onto a think step takes two presses", two_presses),
         ("every row fits its figure at five widths", rows_fit), ("every row is on screen at three windows", rows_on_screen),
         ("a filled plane fills its room", plane_fills), ("a table fills its column", table_fills), ("the first stop has no line by the buttons", first_stop_quiet),
         ("Next stays under the pointer", stays_put), ("the line by the buttons never repeats words on screen", no_repeat),
         ("no piece of a formula on two rows", one_row), ("a formula shrinks to fit, never under 20 px", formula_floor), ("formulas carry no names under them", no_names),
         ("the text sits 20 px from its figure", side_gap), ("figures fill their room at 1480 x 800", fills_room), ("equal planes keep one scale", equal_units),
         ("all text starts at the page's left edge", edges), ("figures and equations centre on the page", centres), ("a symbol has one colour", one_colour), ("cards wear the figure's frame", frames),
         ("callouts and thinks have no lines and no indent", no_lines), ("a line stands 18 px from its card", card_gap), ("a lit callout shows its mark, its text stays", lit_mark), ("legends have room above them", legend_room),
         ("pause hover pop-ups: hover quiet, click opens, kept", hover_pause),
         ("a pop-up card fits its text, wears its term's colour, fades the rest", pop_cards), ("brackets open their symbol's card with its shape", mat_card),
         ("a term glows on hover and on keyboard focus, with a focus ring", glow_focus), ("controls share one grid; a run reads its value bare", ctl_grid),
         ("chart marks draw no tag; named marks have legend entries", chart_tags)]


def series_of(name):
    m = re.search(r"^series:\s*(\S+)", (EX / name / "lesson.yaml").read_text(), re.M)
    return m.group(1) if m else None


def series_colours(books):
    """A symbol keeps its colour in every lesson of a series. books: {lesson: {symbol: colour}}, one series."""
    seen = {}
    for book in books.values():
        for q, c in book.items():
            seen.setdefault(q, set()).add(c)
    bad = sorted(q for q, c in seen.items() if len(c) > 1)
    return not bad, f"{bad[:6]}" if bad else f"{len(seen)} symbols"


def main(names):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("board ui tests: playwright is not installed: not checked")
        return 2
    names = names or sorted(p.parent.name for p in EX.glob("*/lesson.yaml"))
    res, series = [], {}
    with sync_playwright() as p:
        try:
            br = check.launch(p)
        except RuntimeError as e:
            print(f"board ui tests: {e}: not checked")
            return 2
        ctx = br.new_context(viewport={"width": 1440, "height": 900})
        for name in names:
            Y = yaml.safe_load((EX / name / "lesson.yaml").read_text())
            dj = EX / name / (Y.get("data_file") or "data.json")
            PAGE.update(yaml=Y, text=(EX / name / "lesson.yaml").read_text(), data=json.loads(dj.read_text()) if dj.exists() else (Y.get("data") or {}))
            page = open_page(ctx, name)
            for label, fn in TESTS:
                try:
                    ok, why = fn(page)
                except Exception as e:
                    ok, why = False, str(e).splitlines()[0][:160]
                res.append(ok)
                print(f"board ui {name}: {label} | {'ok' if ok else 'FAIL: ' + str(why)}")
            if series_of(name):
                # by the symbol as written, the first listed wins as in the page: two lessons may use one key for different symbols
                series.setdefault(series_of(name), {})[name] = page.evaluate("() => { const S = VizOS.slides[0].ctx.symbols || {}, out = {}; Object.keys(S).forEach(q => { const t = S[q].tex || q; if (S[q].color && !(t in out)) out[t] = S[q].color; }); return out; }")
            page.close()
        try:
            ok, why = no_says_page(ctx)
        except Exception as e:
            ok, why = False, str(e).splitlines()[0][:160]
        res.append(ok)
        print(f"board ui no-says case: no pause button without says | {'ok' if ok else 'FAIL: ' + str(why)}")
        try:
            ok, why = slider_card(ctx)
        except Exception as e:
            ok, why = False, str(e).splitlines()[0][:160]
        res.append(ok)
        print(f"board ui pop-slider case: a card's value follows the slider | {'ok' if ok else 'FAIL: ' + str(why)}")
        for label, fn in (("pop-slider case: the card stays on the same term in a teacher line", say_refind), ("board-gallery: a card stays inside the window", clamp_card),
                          ("product cases: lines follow the slider in their own format", prod_live), ("product cases: pairs, arrows and answer share one colour rule", prod_colours),
                          ("ctl-good case: bare readouts, one grid, a label opens its card, the card blurs", ctl_case),
                          ("chart-marks-good case: no tags, legend, mark card follows the slider and wins over the glass data pop-up", chart_case),
                          ("chart-marks-ui case: entry hides before its step, no hit on unnamed marks, pair, symbol colour, legend and mark light, dot wins", chart_fixes)):
            try:
                ok, why = fn(ctx)
            except Exception as e:
                ok, why = False, str(e).splitlines()[0][:160]
            res.append(ok)
            print(f"board ui {label} | {'ok' if ok else 'FAIL: ' + str(why)}")
        br.close()
    for s, books in sorted(series.items()):
        ok, why = series_colours(books)
        res.append(ok)
        print(f"board ui series {s}: a symbol keeps its colour across the series | {'ok' if ok else 'FAIL: ' + str(why)}")
    print(f"board ui tests: {sum(res)}/{len(res)} ok")
    return 0 if all(res) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
