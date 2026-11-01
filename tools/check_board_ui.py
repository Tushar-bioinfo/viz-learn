#!/usr/bin/env python3
"""Act like a learner on the built class examples, in a real browser, and test that the page answers.

Usage: tools/check_board_ui.py [example ...]      Run it after the examples are built (tools/check-all.sh does both).

Prints one line per test, then "board ui tests: X/Y ok"; exits 1 if any fails, 2 if no browser could start ("not checked").
Next changes a figure and Back undoes it; a click on a line goes to its stop; a stop on a think step opens it; Show answer
grows its card from a fixed top; a slider changes a number; a run's scrubber moves the lit line; scrolling lights steps and
fills columns but never moves a figure; no sideways scroll; every plane has equal units; charts and images keep their ratio.
Then the look's own rules: a long formula sends its figure above its text; the plan shows no lines of text; the scene counter
stays in the margin; a column not filled in keeps its row lines; Next stays on screen; the line by the buttons stays on
screen after every Next; Next onto a think step takes two presses.
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
EQUAL = """() => { const out = []; VizOS.slides.forEach(sl => { const boxes = [...sl.r.node.querySelectorAll('.pbox')], specs = [];
  (sl.s.steps || []).forEach(st => [].concat((st && st.add) || []).forEach(it => { if (it && it.plane) specs.push(it.plane); }));
  boxes.forEach((b, i) => { const p = specs[i], v = (x, d) => VizOS.val(x ?? d, sl.ctx.scope, 'test'), w = +b.getAttribute('width'), h = +b.getAttribute('height');
    const ux = w / (v(p.x.max, 10) - v(p.x.min, 0)), uy = h / (v(p.y.max, 10) - v(p.y.min, 0)); out.push(Math.abs(ux / uy - 1)); }); }); return out; }"""
SHAPES = """() => [...document.querySelectorAll('.bvis .chart')].map(c => { const r = c.getBoundingClientRect(); return r.width / r.height; })"""
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
    bad, shape0 = [], None
    for w in WIDTHS:
        page.set_viewport_size({"width": w, "height": 900}); page.wait_for_timeout(350)
        if page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth"):
            bad.append(f"sideways scroll at {w}")
        if max(page.evaluate(EQUAL) or [0]) > .01:
            bad.append(f"unequal plane at {w}")
        sh = page.evaluate(SHAPES)
        if shape0 is not None and any(abs(x / y - 1) > .02 for x, y in zip(sh, shape0)):
            bad.append(f"chart ratio moved at {w}")
        shape0 = shape0 or sh
        if any(abs(x - 1) > .02 for x in page.evaluate(IMAGES)):
            bad.append(f"image ratio wrong at {w}")
    page.set_viewport_size({"width": 1440, "height": 900})
    return not bad, "; ".join(bad) or f"{len(shape0 or [])} charts"


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
            r = host.locator(".stopl").evaluate("e => { const r = e.getBoundingClientRect(); return [r.top, r.bottom, innerHeight, e.textContent.trim().length, scrollY]; }")
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


TESTS = [("Next changes a figure, Back undoes it", next_back), ("a click on a line goes to its stop", click_line), ("a think step's stop opens it", think_stop),
         ("Show answer grows its card from a fixed top", show_answer), ("a slider changes a number", slider), ("a run's scrubber moves the lit line", scrubber),
         ("scrolling lights steps and fills columns, figures stay", scrolling), ("no sideways scroll; planes equal; charts and images keep their ratio", widths),
         ("a long formula sends its figure above its text", narrow_formula), ("the plan shows no lines of text", plan_words), ("the scene counter stays in the margin", rail_margin),
         ("a column not filled in keeps its row lines", row_lines), ("Back and Next stay on screen", next_on_screen), ("the line by the buttons stays on screen", stop_line),
         ("Next onto a think step takes two presses", two_presses)]


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
