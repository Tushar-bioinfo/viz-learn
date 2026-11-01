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
Next stays under the pointer through a scene; the line by the buttons never repeats words already on screen.
"""
import importlib.util, sys
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
BROKEN = """() => { const out = []; document.querySelectorAll('.cline .part, .fline .math, .asm .math').forEach(p => { const bs = [...p.querySelectorAll('.katex-html > .base')].map(b => b.getBoundingClientRect()).filter(r => r.width);
  if (bs.some((r, i) => i && r.left < bs[i - 1].right - 2)) out.push([p.closest('.slide').id, p.textContent.slice(0, 30)]); }); return out; }"""


def one_row(page):
    """A piece of a formula never breaks across rows, at five windows."""
    bad = []
    for w, h in FIVE:
        sized(page, w, h)
        bad += [f"{w}: {x}" for x in page.evaluate(BROKEN)]
    sized(page, 1440, 900)
    return not bad, "; ".join(bad[:3]) or "5 windows"


FLOOR = """s => { const out = []; document.querySelectorAll(s).forEach(m => { const fs = parseFloat(getComputedStyle(m).fontSize), b = m.closest('.st, .asm, .slide').getBoundingClientRect(), k = [...m.querySelectorAll('.katex')].filter(e => !e.closest('.wkey')).map(e => e.getBoundingClientRect());
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


def no_stack(page):
    """Term labels sit on one row, clear of each other; if not, the formula has a key row instead."""
    bad = []
    for w, h in FIVE:
        sized(page, w, h)
        bad += [f"{w}: {x}" for x in page.evaluate("""() => { const out = []; document.querySelectorAll('.cline .part, .fline .math, .asm .math').forEach(p => { const ls = [...p.querySelectorAll(':scope > .wl')].map(e => e.getBoundingClientRect());
          if (ls.some(a => ls.some(b => a !== b && (Math.abs(a.top - b.top) > 2 || (a.left < b.right && b.left < a.right))))) out.push(p.closest('.slide').id); if (ls.length && p.querySelector('.mfrac')) out.push(p.closest('.slide').id + ' fraction'); }); return out; }""")]
    sized(page, 1440, 900)
    return not bad, "; ".join(bad[:3]) or "5 windows"


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


EDGES = """() => { const rc = e => e.getBoundingClientRect(), bad = [], SEL = '.st > .say, .think, .asm, .bi.note, .bi.params, .bcmp, .track, .bi.plane, .bvis.chart, .bvis.dist, .bvis.parts, .bvis.flow';
  document.querySelectorAll('.board').forEach(b => { const broad = b.classList.contains('broad'), es = [...b.querySelectorAll(SEL)].filter(e => rc(e).width && !e.closest('.fb.beside, .fb.many, .bpair:not(.stacked), .tcol, .abridge, .bcmp .side') && !(e.matches('.say') && e.closest('.bcmp')));
    if (!es.length) return; const L = es.map(e => rc(e).left), R = es.map(e => rc(e).right);
    if (Math.max(...L) - Math.min(...L) > 2 || (!broad && Math.max(...R) - Math.min(...R) > 2)) bad.push([b.closest('.slide').id, Math.round(Math.min(...L)), Math.round(Math.max(...L)), Math.round(Math.min(...R)), Math.round(Math.max(...R))]); }); return bad; }"""


def edges(page):
    """Everything in the reading column shares its left and right edges."""
    bad = []
    for w, h in ((1480, 800), (1920, 1080)):
        sized(page, w, h)
        bad += [f"{w}: {x}" for x in page.evaluate(EDGES)]
    sized(page, 1440, 900)
    return not bad, "; ".join(bad[:3]) or "2 windows"


COLOURS = """() => { const seen = {}; VizOS.slides.forEach((sl, i) => Object.keys(sl.ctx.symbols || {}).forEach(q => sl.r.node.querySelectorAll(`.lt-${CSS.escape(q)}, .sy-${CSS.escape(q)}`).forEach(e => { const c = getComputedStyle(e).color; (seen[q] = seen[q] || {})[c] = i + 1; })));
  return Object.entries(seen).filter(([q, m]) => Object.keys(m).length > 1).map(([q, m]) => [q, Object.keys(m).length]); }"""


def one_colour(page):
    """A symbol has one colour in every scene of a lesson."""
    bad = page.evaluate(COLOURS)
    return not bad, f"{bad[:4]}" if bad else "one each"


def frames(page):
    """Formula cards and matrix panels wear the figure's frame; callouts and number cards a line above and below; the chips are orange."""
    r = page.evaluate("""() => { const bad = []; document.querySelectorAll('.asm, .bops .opsw, .bops .opcard').forEach(e => { const c = getComputedStyle(e), a = getComputedStyle(e, '::after'); if (c.backgroundColor !== 'rgba(0, 0, 0, 0)' || c.borderLeftWidth !== '0px' || c.borderBottomWidth !== '0px' || a.width !== '64px' || a.height !== '3px' || c.boxShadow === 'none') bad.push(e.className); });
      document.querySelectorAll('.bi.note, .bi.params').forEach(e => { const c = getComputedStyle(e); if (e.closest('.hl') || c.backgroundColor !== 'rgba(0, 0, 0, 0)' || c.borderTopColor !== 'rgb(44, 45, 43)' || c.borderTopWidth !== '1px' || c.borderBottomWidth !== '1px' || c.borderLeftWidth !== '0px' || c.boxShadow !== 'none' || c.paddingTop !== '12px' || c.paddingLeft !== '16px') bad.push(e.className); });
      const ac = getComputedStyle(document.documentElement).getPropertyValue('--accent'); document.querySelectorAll('.s-board .head .eyebrow').forEach(e => { if (getComputedStyle(e).borderTopColor !== 'rgb(255, 90, 54)') bad.push('chip'); }); return bad; }""")
    return not r, f"{r[:3]}" if r else "frames ok"


def legend_room(page):
    """A legend sits 10 px under the frame's top line (8 px padding, 2 px more)."""
    r = page.evaluate("""() => [...document.querySelectorAll('.bi.plane > .plegend, .bvis .vhead')].filter(e => e.offsetHeight).map(e => { const f = e.closest('.vis, .plane'), k = e.querySelector('.pk, .legend span'); return k ? Math.round(k.getBoundingClientRect().top - f.getBoundingClientRect().top) : null; }).filter(x => x != null)""")
    bad = [x for x in r if x < 10]
    return not bad, f"{len(r)} legends" + (f", tight: {bad[:4]}" if bad else "")


TESTS = [("Next changes a figure, Back undoes it", next_back), ("a click on a line goes to its stop", click_line), ("a think step's stop opens it", think_stop),
         ("Show answer grows its card from a fixed top", show_answer), ("a slider changes a number", slider), ("a run's scrubber moves the lit line", scrubber),
         ("scrolling lights steps and fills columns, figures stay", scrolling), ("no sideways scroll; planes equal; charts and images keep their ratio", widths),
         ("a long formula sends its figure above its text", narrow_formula), ("the plan shows no lines of text", plan_words), ("the scene counter stays in the margin", rail_margin),
         ("a column not filled in keeps its row lines", row_lines), ("Back and Next stay on screen", next_on_screen), ("the line by the buttons stays on screen", stop_line),
         ("Next onto a think step takes two presses", two_presses),
         ("every row fits its figure at five widths", rows_fit), ("every row is on screen at three windows", rows_on_screen),
         ("a filled plane fills its room", plane_fills), ("a table fills its column", table_fills), ("the first stop has no line by the buttons", first_stop_quiet),
         ("Next stays under the pointer", stays_put), ("the line by the buttons never repeats words on screen", no_repeat),
         ("no piece of a formula on two rows", one_row), ("a formula shrinks to fit, never under 20 px", formula_floor), ("term labels never stack", no_stack),
         ("the text sits 20 px from its figure", side_gap), ("figures fill their room at 1480 x 800", fills_room), ("equal planes keep one scale", equal_units),
         ("the reading column's edges line up", edges), ("a symbol has one colour", one_colour), ("cards wear the figure's frame", frames), ("legends have room above them", legend_room)]


def main(names):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("board ui tests: playwright is not installed: not checked")
        return 2
    names = names or sorted(p.parent.name for p in EX.glob("*/lesson.yaml"))
    res = []
    with sync_playwright() as p:
        try:
            br = check.launch(p)
        except RuntimeError as e:
            print(f"board ui tests: {e}: not checked")
            return 2
        ctx = br.new_context(viewport={"width": 1440, "height": 900})
        for name in names:
            page = open_page(ctx, name)
            for label, fn in TESTS:
                try:
                    ok, why = fn(page)
                except Exception as e:
                    ok, why = False, str(e).splitlines()[0][:160]
                res.append(ok)
                print(f"board ui {name}: {label} | {'ok' if ok else 'FAIL: ' + str(why)}")
            page.close()
        br.close()
    print(f"board ui tests: {sum(res)}/{len(res)} ok")
    return 0 if all(res) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
