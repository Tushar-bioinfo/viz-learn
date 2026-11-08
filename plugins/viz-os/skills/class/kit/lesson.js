/* viz-os class runtime: one long page, a scene after a scene. It takes deck.js's place and answers to the same VizOS API,
   so check.py walks it: a scene is a slide, a click is a step. Sizes are real pixels: nothing is scaled to fit a stage.
   Scrolling reads; it never moves a figure. As the reading line passes a step, that step lights up, the table's next
   column fills in and the row in use is lit. A figure that changes has its own Back and Next.
   Keys: ← → step the figure in view, else go a scene back or on; the page's own scroll keys work as on any page. */
(function () {
  'use strict';
  const L = window.VizOS, h = L.h;
  const q = new URLSearchParams(location.search), CHECK = q.has('check');
  const READ = .45;   // the reading line, as a share of the window's height
  L.slides = []; L.i = 0; L.busy = 0; L.scale = 1;

  function readColors() {
    const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue('--' + n).trim();
    L.colors = { accent: v('accent'), tint: v('tint'), s1: v('s1'), s2: v('s2'), s3: v('s3'), s4: v('s4'), s5: v('s5'), good: v('good'), bad: v('bad'), ink: v('ink'), mist: v('mist'), haze: v('haze'), plate: v('plate-solid'), pill: v('pill'), line: v('line'), surf: v('surf'), surf2: v('surf2') };
    L.fontUI = v('f-ui'); L.fontMono = v('f-mono');
  }

  // ---------- drawing ----------
  function draw(sl) {
    L.fill(sl.r.node, sl.ctx.scope);
    try { sl.r.layout && sl.r.layout(); } catch (e) { L.err(`slide ${sl.ctx.index + 1}`, e.message); console.error(e); }
    L.fill(sl.r.node, sl.ctx.scope);
    sl.r.repaint && sl.r.repaint();
    // a deck slide between scenes has no reading line: all its steps show
    if (sl.r.repaint) return;
    if (sl.r.show) sl.r.show(sl.steps); else sl.r.node.querySelectorAll('[data-step]').forEach(e => e.classList.add('shown'));
  }
  function drawAll() { L.slides.forEach(draw); spy(); }

  // ---------- the page ----------
  let page, bar, rail;
  function build(deck) {
    L.deck = deck;
    const g = L.scope(null, {});
    Object.assign(g, deck.data || {});
    if (window.VIZOS_DATA) Object.assign(g, window.VIZOS_DATA);
    L.derive(g, deck.derive, 'lesson');
    L.global = g; L.seenNotation = new Set(); L.chapters = []; L.chapterShape = {};
    deck.slides.forEach((s, i) => {
      const scope = L.scope(g, {});
      const ctx = { index: i, deck, scope, symbols: deck.symbols || {}, charts: [], later: [], ctl: {}, k: 0 };
      (s.controls || []).forEach(c => scope[c.name] = c.value ?? c.min);
      const rederive = () => L.derive(scope, s.derive, `slide ${i + 1}`);
      rederive();
      const type = L.types[s.type || 'idea'];
      let r;
      if (!type) { L.err(`slide ${i + 1}`, `unknown type "${s.type}"`); r = { node: h('section', 'slide'), steps: 0 }; }
      else { try { r = type(s, ctx); } catch (e) { L.err(`slide ${i + 1}`, e.message); console.error(e); r = { node: h('section', 'slide', `<div class="h1">Scene ${i + 1} failed: ${L.esc(e.message)}</div>`), steps: 0 }; } }
      r.node.dataset.i = i; r.node.id = `scene-${i + 1}`;
      // what the deck keeps in its Details sheet stays on the page
      if (r.more || s.more) r.node.appendChild(h('div', 'lsmore g thin', (r.more || '') + (s.more ? `<div>${L.md(s.more)}</div>` : '')));
      const sl = { s, r, ctx, k: 0, steps: r.steps || 0 };
      // a slider moves many times a frame: redraw once a frame, and leave the slider itself alone so it keeps the pointer
      let queued = false;
      ctx.refresh = () => { if (queued) return; queued = true; L.busy++; requestAnimationFrame(() => { queued = false; try { rederive(); draw(sl); } finally { L.busy--; } }); };
      Object.defineProperty(ctx, 'k', { get: () => sl.k });
      L.slides.push(sl); page.appendChild(r.node);
    });
  }

  // ---------- reading: which step is under the reading line ----------
  let ticking = false;
  function spy() {
    ticking = false; if (CHECK) return;
    const line = innerHeight * READ, end = scrollY + innerHeight >= document.documentElement.scrollHeight - 4;
    L.slides.forEach(sl => sl.r.spy && sl.r.spy(end ? Infinity : line));
    let at = 0; L.slides.forEach((sl, i) => { if (sl.r.node.getBoundingClientRect().top <= line) at = i; });
    if (end) at = L.slides.length - 1;
    if (at !== L.i) { L.slides[L.i].r.node.classList.remove('on'); L.i = at; L.slides[at].r.node.classList.add('on'); history.replaceState(null, '', `#${at + 1}`); }
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = (max > 0 ? scrollY / max * 100 : 0) + '%';
    rail.querySelector('.rn').textContent = `${L.i + 1} / ${L.slides.length}`;
    rail.querySelector('.rp').disabled = L.i === 0; rail.querySelector('.rx').disabled = L.i === L.slides.length - 1;
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } };
  const jump = i => { i = Math.max(0, Math.min(L.slides.length - 1, i)); scrollTo({ top: L.slides[i].r.node.getBoundingClientRect().top + scrollY - 8, behavior: 'smooth' }); };

  function chromeBuild() {
    bar = h('div'); bar.id = 'lsbar'; document.body.appendChild(bar);
    rail = h('nav', '', '<button class="rp" aria-label="previous scene">‹</button><span class="rn"></span><button class="rx" aria-label="next scene">›</button>'); rail.id = 'lsrail'; document.body.appendChild(rail);
    rail.querySelector('.rp').onclick = () => jump(L.i - 1);
    rail.querySelector('.rx').onclick = () => jump(L.i + 1);
  }
  // the figure the keys act on: the stepped figure nearest the reading line, if one is on screen
  function stageInView() {
    let best = null, gap = 1e9; const line = innerHeight * READ;
    L.slides.forEach(sl => (sl.r.stages || []).forEach(S => { const b = S.node.getBoundingClientRect(); if (b.bottom < 60 || b.top > innerHeight - 60) return;
      const d = Math.abs((Math.max(b.top, 0) + Math.min(b.bottom, innerHeight)) / 2 - line); if (d < gap) { gap = d; best = S; } }));
    return best;
  }
  function bindInput() {
    addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.matches && e.target.matches('input, textarea, select')) return;
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const dir = e.key === 'ArrowRight' ? 1 : -1, S = stageInView();
      e.preventDefault();
      if (S && S.move(dir)) return;
      jump(L.i + dir);
    });
    addEventListener('scroll', onScroll, { passive: true });
    // a height change redraws too, as figures are sized to the window; a phone (under 760 px) redraws on width only: its bar comes and goes as it scrolls.
    // The check opens its window to a whole scene's height to shoot it: that must not redraw the scene it measured
    let t, wide = innerWidth, high = innerHeight;
    const redraw = () => { onScroll(); L.slides.forEach(sl => sl.r.stick && sl.r.stick());
      if (innerWidth === wide && (innerHeight === high || innerWidth < 760 || CHECK)) return; wide = innerWidth; high = innerHeight; clearTimeout(t); t = setTimeout(drawAll, 120); };
    addEventListener('resize', redraw);
    addEventListener('beforeprint', () => L.slides.forEach(sl => sl.r.show && sl.r.show(sl.steps)));
    addEventListener('afterprint', () => L.slides.forEach(sl => sl.r.reset && sl.r.reset()));
  }

  // ---------- VizOS API, as check.py reads it ----------
  L.go = function (i, k) {
    i = Math.max(0, Math.min(L.slides.length - 1, i | 0));
    const prev = L.slides[L.i]; if (prev) prev.r.node.classList.remove('on');
    L.i = i; const sl = L.slides[i], top = sl.r.node;
    sl.k = k == null ? 0 : k < 0 ? sl.steps : Math.max(0, Math.min(sl.steps, k));
    top.classList.add('on');
    sl.r.show && sl.r.show(sl.k);
    scrollTo({ top: top.getBoundingClientRect().top + scrollY, behavior: 'instant' });
  };
  L.setControl = (name, v) => { const sl = L.slides[L.i]; if (sl.ctx.ctl[name]) sl.ctx.ctl[name](v); };
  L.reveal = () => {};
  L.info = () => ({ n: L.slides.length, page: true, slides: L.slides.map((sl, i) => ({ i, type: sl.s.type || 'idea', title: L.plain(sl.s.title || sl.s.beat || '', sl.ctx.scope).slice(0, 60), steps: sl.steps,
    controls: (sl.s.controls || []).map(c => ({ name: c.name, min: c.min, max: c.max, value: c.value ?? c.min })), predict: false })), errors: L.errors });
  // how much screen one scene needs, so the check can show it whole
  L.sheetHeight = () => Math.ceil(L.slides[L.i].r.node.getBoundingClientRect().height);

  const shownBy = (e, stop) => { if (!e.getClientRects().length) return false; for (let n = e; n && n !== stop; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < .05) return false; } return true; };
  L.textBoxes = function () {
    const node = L.slides[L.i].r.node, out = [], ownText = e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    node.querySelectorAll('*').forEach(e => { if (!ownText(e) || e.closest('svg') || e.closest('.katex') || e.closest('.datatable') || !shownBy(e, node)) return;
      const rg = document.createRange(), rs = []; [...e.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).forEach(n => { rg.selectNodeContents(n); rs.push(...rg.getClientRects()); });
      if (!rs.length) return; const r = { left: Math.min(...rs.map(x => x.left)), top: Math.min(...rs.map(x => x.top)), width: Math.max(...rs.map(x => x.right)) - Math.min(...rs.map(x => x.left)), height: Math.max(...rs.map(x => x.bottom)) - Math.min(...rs.map(x => x.top)) };
      if (!r.width || !r.height) return; const cs = getComputedStyle(e);
      out.push({ text: e.textContent.trim().slice(0, 40), x: r.left, y: r.top, w: r.width, h: r.height, rects: rs.filter(x => x.width > 2 && x.height > 2).map(x => [x.left, x.top, x.width, x.height]), color: cs.color, size: parseFloat(cs.fontSize), weight: +cs.fontWeight }); });
    return out;
  };

  // what the check reads, per scene and click: nothing runs off the page, nothing covers anything, nothing is too small
  const MIN_TEXT = 15, MIN_TICK = 14;
  L.audit = function () {
    const sl = L.slides[L.i], node = sl.r.node, out = [], vw = document.documentElement.clientWidth;
    const hasText = e => (e.textContent || '').trim().length > 0;
    const inline = e => { const d = getComputedStyle(e).display; return d === 'inline' || d === 'contents'; };
    const leaves = [...node.querySelectorAll('*')].filter(e => {
      if (e.closest('svg') || e.closest('.datatable') || e.closest('.tip') || e.closest('.flip .back')) return false;
      if (e.closest('.katex') && !e.matches('.katex')) return false;
      if (e.matches('.katex')) return true;
      if (inline(e) || !hasText(e)) return false;
      return ![...e.querySelectorAll('*')].some(c => !c.closest('.katex') && !inline(c) && hasText(c) && c !== e);
    }).filter(e => shownBy(e, node));
    const ticks = [...node.querySelectorAll('svg text')].filter(t => shownBy(t, node) && !t.closest('.off'));
    const name = e => `"${(e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34)}"`;
    const items = [...leaves, ...ticks].map(e => ({ e, b: e.getBoundingClientRect() }));
    for (const { e, b } of items) {
      if (b.left < 8 || b.right > vw - 8) out.push(`${name(e)} runs off the page`);
      const fs = parseFloat(getComputedStyle(e).fontSize), svg = !!e.closest('svg');
      if (fs < (svg ? MIN_TICK : MIN_TEXT)) out.push(`${name(e)} renders at ${fs.toFixed(1)}px (too small)`);
      if (!svg) { const cs = getComputedStyle(e);
        if (['block', 'flex', 'grid', 'list-item'].includes(cs.display) && cs.overflow === 'visible' && e.clientWidth && e.scrollWidth > e.clientWidth + 3) out.push(`${name(e)} is wider than its box`);
        const card = e.parentElement && e.parentElement.closest('.g');
        if (card && node.contains(card) && getComputedStyle(card).overflow === 'visible') { const c = card.getBoundingClientRect();
          if (b.bottom > c.bottom + 1 || b.right > c.right + 1 || b.top < c.top - 1 || b.left < c.left - 1) out.push(`${name(e)} spills out of its card`); } }
    }
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j]; if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
      const ov = Math.max(0, Math.min(a.b.right, b.b.right) - Math.max(a.b.left, b.b.left) - 2) * Math.max(0, Math.min(a.b.bottom, b.b.bottom) - Math.max(a.b.top, b.b.top) - 2);
      if (ov > 40) out.push(`text overlaps: ${name(a.e)} × ${name(b.e)}`);
    }
    node.querySelectorAll('.katex-error').forEach(e => out.push(`formula error: ${e.title || e.textContent.slice(0, 40)}`));
    node.querySelectorAll('.iv.bad').forEach(e => out.push(`could not compute {{${e.dataset.x}}}`));
    node.querySelectorAll('.approx').forEach(e => { if (!shownBy(e, node)) return;
      const k = e.closest('.katex') || e, line = k.closest('.part') ? k.closest('.part').parentElement : k;
      const t = [...line.querySelectorAll('.katex-html')].map(x => x.textContent).join(' ').replace(/\s+/g, ' ').trim();
      out.push(`a worked line reads ≈ (“${t.length > 70 ? '…' + t.slice(-69) : t}”): its rounded numbers do not give the result shown even with 2 more digits; give the inputs a finer fmt or name the step in between`); });
    node.querySelectorAll('.vis .chart').forEach(c => { if (!c.querySelector('svg')) out.push('a chart did not draw (no room, or bad data)'); });
    if (sl.r.audit) try { out.push(...sl.r.audit()); } catch (e) { out.push('audit failed: ' + e.message); }
    return [...new Set(out)];
  };

  // ---------- boot ----------
  function boot() {
    const deck = JSON.parse(document.getElementById('vizos-deck').textContent);
    document.documentElement.classList.add('ls-page');
    if (CHECK) document.body.classList.add('no-anim');
    readColors();
    page = h('main'); page.id = 'lesson'; document.body.appendChild(page);
    document.title = deck.title || 'viz-os lesson';
    build(deck); chromeBuild(); bindInput();
    L.slides.forEach(draw);
    L.slides[0] && L.slides[0].r.node.classList.add('on');
    L.ready = true;
    // the formula fonts arrive only when a formula first needs them: measure again once they have
    if (document.fonts) document.fonts.addEventListener('loadingdone', drawAll);
    const m = /^#(\d+)/.exec(location.hash);
    if (m) { const s = L.slides[+m[1] - 1]; if (s) { L.i = +m[1] - 1; requestAnimationFrame(() => s.r.node.scrollIntoView()); } }
    spy();
  }
  const start = () => (document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]) : Promise.resolve()).then(boot).catch(e => { L.err('boot', e.message); console.error(e); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  addEventListener('error', e => L.err('page', e.message));
})();
