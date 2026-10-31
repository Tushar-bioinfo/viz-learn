/* viz-os sketch runtime: a long page of paper sheets on a wall, joined by a thread. It takes deck.js's place and answers
   to the same VizOS API, so check.py walks it: a sheet is a slide, a think stop is a step. Text is HTML over each canvas. */
(function () {
  'use strict';
  const L = window.VizOS, K = L.sketch, h = L.h, md = s => L.md(s);
  const q = new URLSearchParams(location.search), CHECK = q.has('check');
  const FULL = 1080, WMM = 240, PPM = 6, GUT = .036;   // widest sheet in css px; its width in mm; pixels per mm; thread gutter as a share of a full sheet
  const LAPS = { shown: 'What', read: 'How', why: 'Why', changed: 'Changed' };
  const PAPER_VARS = ['paper', 'ink', 'soft', 'accent', 's1', 's2', 's3', 'gold', 'gold2', 'red', 'red2', 'pale', 'edge', 'tag', 'tagink', 'wash', 'cord'];
  L.slides = []; L.i = 0; L.busy = 0; L.scale = 1;
  const pals = {};
  function palette(paper) {
    if (pals[paper]) return pals[paper];
    const e = h('div', 'paper-' + paper); document.body.appendChild(e);
    const cs = getComputedStyle(e), p = { name: paper, pen: paper === 'navy' ? 'gel' : 'fineliner' };
    PAPER_VARS.forEach(v => p[v] = cs.getPropertyValue('--' + v).trim());
    e.remove(); return pals[paper] = p;
  }
  const penOf = (S, pal, color, nib = .35) => S.tool(pal.pen, pal.pen === 'gel' ? { color: color || pal.ink, nib: Math.max(.3, nib) } : { color: color || pal.ink, nib, kind: 'technical' });
  K.penOf = penOf;

  // ---------- the parts of a sheet ----------
  function thinkBlock(t, cls) {
    const e = h('div', 'think ' + (cls || ''), `<span class="tk">Think</span><span class="tq">${md(t.q)}</span><button type="button" class="tb">Show answer</button><span class="ta">${md(t.a)}</span>`);
    e.querySelector('.tb').onclick = () => e.classList.toggle('open');
    return e;
  }
  function foldBlock(m) { const d = h('details', 'fold', `<summary>${md(m.ask)}</summary><div>${md(m.answer)}</div>`); if (CHECK) d.open = true; return d; }
  function controlRow(c, ctx, set) {
    const r = h('label', 'ctl', `<span class="cn">${md(c.label || c.name)}</span>`), i = h('input'), v = h('span', 'cv');
    Object.assign(i, { type: 'range', min: c.min, max: c.max, step: c.step ?? ((c.max - c.min) / 100), value: c.value ?? c.min });
    const say = x => { v.textContent = c.toggle ? c.toggle[+x] : L.fmt(+x, c.fmt ?? (Number.isInteger(+x) ? ',' : 's3')); };
    i.oninput = () => { say(i.value); set(+i.value); };
    ctx.ctl[c.name] = x => { i.value = x; say(x); set(+x); };
    say(i.value); r.append(i, v); return r;
  }

  L.types = L.types || {};
  L.types.sheet = (s, ctx) => {
    const paper = s.paper || 'cream', node = h('section', `slide sk paper-${paper}`), sheet = h('div', 'sk-sheet'), art = h('canvas', 'art'), steps = K.thinksOf(s);
    if (s.width) sheet.style.setProperty('--w', s.width / 100);
    sheet.appendChild(art);
    sheet.appendChild(h('header', 'head', `<h2 class="ttl">${md(s.title || '')}</h2>${s.lead ? `<p class="lead">${md(s.lead)}</p>` : ''}`));
    const [rw, rh] = String(s.ratio || '16:7').split(':').map(Number), fig = h('div', 'fig');
    fig.style.aspectRatio = `${rw} / ${rh}`; sheet.appendChild(fig);
    const R = { node, steps: steps.length, sheet, art, fig, paper, figH: 100 * rh / rw, parts: [], labels: [] };
    if (s.controls) { const row = h('div', 'ctls'); s.controls.forEach(c => row.appendChild(controlRow(c, ctx, v => { ctx.scope[c.name] = v; ctx.refresh(); }))); sheet.appendChild(row); }
    if (s.stop) { const b = h('div', 'band'), t = h('div', 'tag', `<span class="ts">${md(s.stop.say)}</span>${s.stop.shape ? `<span class="tp">${md(s.stop.shape)}</span>` : ''}`); b.appendChild(t); sheet.appendChild(b); R.band = b; R.tag = t; }
    const note = s.note || {}, notes = h('div', 'notes');
    for (const k in LAPS) if (note[k]) notes.appendChild(h('div', 'n', `<h4>${LAPS[k]}</h4><p>${md(note[k])}</p>`));
    notes.style.setProperty('--c', notes.children.length); sheet.appendChild(notes);
    if (s.think) { const w = h('div', 'thinks'), t = thinkBlock(s.think); t.dataset.k = steps.length; w.appendChild(t); sheet.appendChild(w); }
    if (Array.isArray(s.more)) { const w = h('div', 'folds'); s.more.forEach(m => w.appendChild(foldBlock(m))); sheet.appendChild(w); w.addEventListener('toggle', () => R.redraw && R.redraw(), true); }
    node.appendChild(sheet);
    K.buildFigure(s, ctx, R, thinkBlock);
    R.show = k => sheet.querySelectorAll('.think').forEach(t => { if (t.dataset.k) t.classList.toggle('open', +t.dataset.k <= k); });
    return R;
  };

  // review and recall cards: the question shows, a click shows the answer
  L.types.quiz = (s, ctx) => {
    const node = h('section', 'slide sk paper-cream'), sheet = h('div', 'sk-sheet'), art = h('canvas', 'art'), cards = s.cards || [];
    sheet.appendChild(art);
    sheet.appendChild(h('header', 'head', `<h2 class="ttl">${md(s.title || 'Say it before you turn it over')}</h2>`));
    const g = h('div', 'cards');
    cards.forEach((c, j) => { const t = thinkBlock(c, 'card'); t.dataset.k = j + 1; t.querySelector('.tk').textContent = j + 1; g.appendChild(t); });
    sheet.appendChild(g); node.appendChild(sheet);
    const R = { node, steps: cards.length, sheet, art, paper: 'cream', parts: [], labels: [], quiz: true };
    R.show = k => g.querySelectorAll('.think').forEach(t => t.classList.toggle('open', +t.dataset.k <= k));
    return R;
  };

  // ---------- the wall: where each sheet sits, and where the thread crosses from one to the next ----------
  let wall, mmPerPx = WMM / FULL;
  function fullWidth() { return Math.min(FULL, wall.clientWidth - 40); }
  function measure() {
    const fw = fullWidth(), W = wall.clientWidth, g = fw * GUT, sl = L.slides, n = sl.length;
    mmPerPx = WMM / fw;
    document.documentElement.style.setProperty('--full', fw + 'px');
    let side = 'L';   // each sheet keeps the thread in its own gutter; where two widths differ, the wall takes the step across
    for (let i = 0; i < n; i++) {
      const w = sl[i].r.sheet.offsetWidth, gut = sd => sd === 'L' ? g : w - g, out = sl[i].r.band ? (side === 'L' ? 'R' : 'L') : side;
      sl[i].thread = { inX: gut(side), outX: gut(out), inSide: side, outSide: out, left: (W - w) / 2 };
      side = out;
    }
  }

  // ---------- drawing ----------
  const hashOf = c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let x = 2166136261; for (let i = 0; i < d.length; i += 3) { x ^= d[i]; x = Math.imul(x, 16777619); } return x >>> 0; };
  const inMM = (el, base) => { const a = el.getBoundingClientRect(), b = base.getBoundingClientRect(), k = mmPerPx; return { x: (a.left - b.left) * k, y: (a.top - b.top) * k, w: a.width * k, h: a.height * k }; };
  const rectIn = (el, base) => { const a = el.getBoundingClientRect(), b = base.getBoundingClientRect(); return { x0: a.left - b.left, y0: a.top - b.top, x1: a.right - b.left, y1: a.bottom - b.top }; };

  function threadPath(sl, H, W) {
    const { inX, outX } = sl.thread, k = mmPerPx, x0 = inX * k, x1 = outX * k, last = sl.ctx.index === L.slides.length - 1, first = sl.ctx.index === 0, top = first ? 8 : -3;
    if (!sl.r.band) { const end = last ? Math.min(H - 8, 34) : H + 3; return [[x0, top], [(x0 + (x1 - x0) * .2), top + (end - top) * .4], [(x0 + (x1 - x0) * .8), top + (end - top) * .7], [x1, end]]; }
    const b = inMM(sl.r.band, sl.r.sheet), y = b.y + b.h / 2, dir = Math.sign(x1 - x0) || 1, mid = (x0 + x1) / 2;
    return [[x0, top], [x0, y - 9], [x0 + dir * 7, y - 1.4], [mid - (x1 - x0) * .25, y + .9], [mid + (x1 - x0) * .25, y - .9], [x1 - dir * 7, y + 1.4], [x1, y + 9], [x1, last ? H - 8 : H + 3]];
  }
  function branchPath(sl, H) {
    const { inX, outX } = sl.thread, k = mmPerPx, x0 = inX * k, x1 = outX * k, b = inMM(sl.r.band, sl.r.sheet), y = b.y + b.h / 2, dir = Math.sign(x1 - x0) || 1;
    return [[x0 + dir * 7, y - 1.4], [x0 + dir * 2.4, y + 6], [x0, y + 16], [x0, H + 3]];
  }
  function paintBase(sl) {
    const { sheet, paper } = sl.r, pal = palette(paper), r = sheet.getBoundingClientRect(), w = r.width * mmPerPx, H = r.height * mmPerPx;
    const S = K.sheet({ id: 's' + sl.ctx.index, w, h: H, ppm: PPM, paper, seed: `${K.pageSeed}:${sl.ctx.index}` }), th = K.themes(pal);
    const pts = threadPath(sl, H); sl.threadPts = K.catmull(pts, 1);
    K.cord(S, pts, th.gold);
    const br = sl.s.break ? 'red' : sl.s.alt ? 'pale' : null;
    if (br && sl.r.band) K.cord(S, branchPath(sl, H), th[br]);
    if (sl.r.tag) { const b = inMM(sl.r.tag, sheet); K.tag(S, { x: b.x - 1.4, y: b.y - .9, w: b.w + 2.8, h: b.h + 1.8 }, pal, S.seed); }
    if (sl.ctx.index === L.slides.length - 1) K.arrowhead(S, pts[pts.length - 1], pts[pts.length - 2], th.gold);
    S.base = { rgb: S.rgb.slice(), fill: S.fill.slice(), cov: S.cov.slice() };
    return S;
  }
  function paintFigures(sl, S) {
    S.rgb.set(S.base.rgb); S.fill.set(S.base.fill); S.cov.set(S.base.cov); S.R = K.rng('figure:' + S.seed); sl.anchorErrors = [];
    const pal = palette(sl.r.paper), figBox = sl.r.fig ? inMM(sl.r.fig, sl.r.sheet) : null;
    try { if (sl.r.fig) K.drawFigure(sl, S, pal, figBox, penOf); sl.failed = null; }
    catch (e) { sl.failed = e.message; L.err(`sheet ${sl.ctx.index + 1}`, 'drawing failed: ' + e.message); console.error(e); }
    S.toCanvas(sl.r.art);
    sl.hash = hashOf(sl.r.art);
  }
  function drawLink(sl) {
    const i = sl.ctx.index, next = L.slides[i + 1], gap = sl.r.gap; if (!gap) return;
    const c = gap.querySelector('canvas.link'), w = wall.clientWidth, H = gap.offsetHeight, k = mmPerPx, x = (sl.thread.left + sl.thread.outX) * k, nx = (next.thread.left + next.thread.inX) * k, pal = palette(sl.r.paper);
    const S = K.sheet({ id: 'l' + i, w: w * k, h: H * k, ppm: PPM, paper: 'navy', seed: `${K.pageSeed}:link:${i}` }), th = K.themes(pal);
    K.cord(S, x === nx ? [[x, -3], [x, H * k * .5], [x, H * k + 3]] : [[x, -3], [x, H * k * .2], [x + (nx - x) * .1, H * k * .4], [nx - (nx - x) * .1, H * k * .6], [nx, H * k * .8], [nx, H * k + 3]], { c1: palette('navy').gold, c2: pal.gold, edge: pal.cord });   // lit brighter where it crosses the dark wall
    const b = gap.querySelector('.branch');
    if (b) { const bx = (sl.thread.left + sl.thread.inX) * k, r = rectIn(b, gap), t = sl.s.break ? 'red' : 'pale', end = r.y0 * k + 1;
      K.cord(S, [[bx, -3], [bx, end * .6], [bx, end]], th[t]); K.arrowhead(S, [bx, end + 2.6], [bx, end - 4], th[t], 4.6); }
    S.toCanvas(c);
    const ctx = c.getContext('2d'), im = ctx.getImageData(0, 0, c.width, c.height), d = im.data, p0 = S.paper0;   // the wall shows through wherever no pen went
    for (let n = 0, m = S.W * S.H; n < m; n++) if (Math.abs(S.rgb[3 * n] - p0[3 * n]) + Math.abs(S.rgb[3 * n + 1] - p0[3 * n + 1]) + Math.abs(S.rgb[3 * n + 2] - p0[3 * n + 2]) < 3) d[4 * n + 3] = 0;
    ctx.putImageData(im, 0, 0);
    if (b) drawBranch(sl, b);
  }
  function drawBranch(sl, b) {
    const k = mmPerPx, pal = palette(sl.r.paper), r = b.getBoundingClientRect(), red = !!sl.s.break;
    const S = K.sheet({ id: 'b' + sl.ctx.index, w: r.width * k, h: r.height * k, ppm: PPM, paper: sl.r.paper, seed: `${K.pageSeed}:branch:${sl.ctx.index}` });
    if (red) K.breakMark(S, [6.5, 7], 2.6, pal);
    S.toCanvas(b.querySelector('canvas'));
  }
  function draw(sl) {
    if (sl.drawing) return;
    sl.drawing = true; L.busy++;
    try {
      L.fill(sl.r.node, sl.ctx.scope);
      sl.r.show && sl.r.show(sl.k);
      const r = sl.r.sheet.getBoundingClientRect();
      if (!sl.S || Math.abs(sl.S.h - r.height * mmPerPx) > .3 || Math.abs(sl.S.w - r.width * mmPerPx) > .3) { sl.S = paintBase(sl); drawLink(sl); }
      paintFigures(sl, sl.S);
      sl.drawn = true;
    } catch (e) { sl.failed = e.message; L.err(`sheet ${sl.ctx.index + 1}`, 'drawing failed: ' + e.message); console.error(e); }
    finally { sl.drawing = false; L.busy--; }
  }

  // ---------- building the page ----------
  function masthead(deck) {
    const m = h('header', 'mast', `<h1 class="ttl">${md(deck.title || '')}</h1>${deck.question ? `<p class="mq">${md(deck.question)}</p>` : ''}${deck.goal ? `<p class="mg"><span>Goal</span> ${md(deck.goal)}</p>` : ''}`);
    wall.appendChild(m); L.fill(m, L.global);
  }
  function branchNode(s) {
    const b = s.break, a = s.alt, e = h('aside', 'branch ' + (b ? 'red' : 'pale'), `<canvas></canvas>` + (b
      ? `<h4>Breaks here</h4><p class="rule">${md(b.rule)}</p><p class="path"><span>Shortest way there</span> ${md(b.path)}</p>`
      : `<h4>Another way</h4><p class="rule">${md(a.say)}</p>${a.why ? `<p class="path">${md(a.why)}</p>` : ''}`));
    return e;
  }
  function build(deck) {
    L.deck = deck;
    K.pageSeed = String(deck.seed ?? deck.title ?? 'page');
    const g = L.scope(null, {});
    Object.assign(g, deck.data || {});
    if (window.VIZOS_DATA) Object.assign(g, window.VIZOS_DATA);
    L.derive(g, deck.derive, 'page');
    L.global = g; L.seenNotation = new Set(); L.chapters = [];
    masthead(deck);
    deck.slides.forEach((s, i) => {
      const scope = L.scope(g, {});
      const ctx = { index: i, deck, scope, symbols: deck.symbols || {}, charts: [], later: [], ctl: {}, k: 0 };
      (s.controls || []).forEach(c => scope[c.name] = c.value ?? c.min);
      const rederive = () => L.derive(scope, s.derive, `sheet ${i + 1}`);
      rederive();
      const type = L.types[s.type];
      let r;
      try { r = type(s, ctx); }
      catch (e) { L.err(`sheet ${i + 1}`, e.message); console.error(e); r = { node: h('section', 'slide sk paper-cream', `<div class="sk-sheet"><canvas class="art"></canvas><h2 class="ttl">Sheet ${i + 1} failed: ${L.esc(e.message)}</h2></div>`), steps: 0, paper: 'cream', parts: [], labels: [] }; r.sheet = r.node.firstChild; r.art = r.sheet.firstChild; }
      r.node.dataset.i = i;
      const sl = { s, r, ctx, k: 0, steps: r.steps || 0 };
      let queued = false;
      ctx.refresh = () => { if (queued) return; queued = true; L.busy++; requestAnimationFrame(() => { queued = false; L.busy--; rederive(); if (sl.drawn) draw(sl); else L.fill(r.node, scope); }); };
      r.redraw = () => { sl.S = null; if (sl.drawn) { measure(); draw(sl); } };
      L.slides.push(sl); wall.appendChild(r.node);
      if (i < deck.slides.length - 1) {
        const gap = h('div', 'gap', '<canvas class="link"></canvas>'); r.gap = gap; r.node.appendChild(gap);
        if ((s.break || s.alt) && s.stop) gap.appendChild(branchNode(s));
      }
      L.fill(r.node, scope);
    });
  }
  function drawNear() {
    if (!('IntersectionObserver' in window)) { L.slides.forEach(draw); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { const sl = L.slides[+e.target.dataset.i]; io.unobserve(e.target); requestAnimationFrame(() => draw(sl)); } }), { rootMargin: '100% 0px' });
    L.slides.forEach(sl => io.observe(sl.r.node));
  }
  const place = sl => { const b = sl.r.gap && sl.r.gap.querySelector('.branch'); if (b) { const side = sl.thread.inSide; b.classList.toggle('right', side === 'R'); sl.r.gap.style.height = (b.offsetHeight + 96) + 'px'; } };

  // ---------- VizOS API ----------
  L.go = function (i, k) {
    i = Math.max(0, Math.min(L.slides.length - 1, i | 0));
    const prev = L.slides[L.i]; if (prev) prev.r.node.classList.remove('on');
    L.i = i; const sl = L.slides[i], top = sl.r.node;
    sl.k = k == null ? 0 : k < 0 ? sl.steps : Math.max(0, Math.min(sl.steps, k));
    top.classList.add('on');
    if (!sl.drawn) draw(sl);
    sl.r.show && sl.r.show(sl.k);
    scrollTo({ top: top.getBoundingClientRect().top + scrollY, behavior: 'instant' });
  };
  L.setControl = (name, v) => { const sl = L.slides[L.i]; if (sl.ctx.ctl[name]) sl.ctx.ctl[name](v); };
  L.reveal = () => {};
  L.info = () => ({ n: L.slides.length, page: true, slides: L.slides.map((sl, i) => ({ i, type: sl.s.type, title: L.plain(sl.s.title || sl.s.beat || '', sl.ctx.scope).slice(0, 60), steps: sl.steps,
    controls: (sl.s.controls || []).map(c => ({ name: c.name, min: c.min, max: c.max, value: c.value ?? c.min })), predict: false })), errors: L.errors });
  // how much screen one sheet needs, so the check can show it whole
  L.sheetHeight = () => Math.ceil(L.slides[L.i].r.node.getBoundingClientRect().height);
  L.textBoxes = function () {
    const node = L.slides[L.i].r.node, out = [];
    const ownText = e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    node.querySelectorAll('*').forEach(e => { if (!ownText(e) || e.closest('svg') || e.closest('.katex')) return;
      const rg = document.createRange(), rs = []; [...e.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).forEach(n => { rg.selectNodeContents(n); rs.push(...rg.getClientRects()); });
      if (!rs.length) return; const r = { left: Math.min(...rs.map(x => x.left)), top: Math.min(...rs.map(x => x.top)), width: Math.max(...rs.map(x => x.right)) - Math.min(...rs.map(x => x.left)), height: Math.max(...rs.map(x => x.bottom)) - Math.min(...rs.map(x => x.top)) };
      if (!r.width || !r.height) return;
      const cs = getComputedStyle(e); if (+cs.opacity < .5 || cs.visibility === 'hidden') return;
      out.push({ text: e.textContent.trim().slice(0, 40), x: r.left, y: r.top, w: r.width, h: r.height, rects: rs.filter(x => x.width > 2 && x.height > 2).map(x => [x.left, x.top, x.width, x.height]), color: cs.color, size: parseFloat(cs.fontSize), weight: +cs.fontWeight }); });
    return out;
  };
  L.audit = () => K.audit(L.slides[L.i], { hashOf, rectIn, paintBase, paintFigures, mmPerPx: () => mmPerPx, VIEW: 900 });

  // ---------- boot ----------
  function relayout() { measure(); L.slides.forEach(place); measure(); }
  function boot() {
    const deck = JSON.parse(document.getElementById('vizos-deck').textContent);
    document.documentElement.classList.add('sk-page');
    if (CHECK) document.body.classList.add('no-anim');
    const pal = palette('cream');
    L.colors = { accent: pal.accent, tint: pal.wash, s1: pal.s1, s2: pal.s2, s3: pal.s3, good: pal.s2, bad: pal.red, ink: pal.ink, mist: pal.soft, haze: pal.soft, plate: pal.paper, pill: pal.tag, line: pal.ink, surf: pal.paper, surf2: pal.tag };
    L.fontUI = '"Kevin Sans", cursive'; L.fontMono = 'var(--f-mono)';
    wall = h('main'); wall.id = 'wall'; document.body.appendChild(wall);
    document.title = deck.title || 'viz-os sketch';
    measureEarly();
    build(deck);
    relayout();
    if (CHECK) L.slides.forEach(draw); else drawNear();
    L.ready = true;
    if (document.fonts) document.fonts.addEventListener('loadingdone', () => { relayout(); L.slides.forEach(sl => { if (sl.drawn) { sl.S = null; draw(sl); } }); });
    let t, wide = innerWidth; addEventListener('resize', () => { if (innerWidth === wide) return; wide = innerWidth; clearTimeout(t); t = setTimeout(() => { relayout(); L.slides.forEach(sl => { if (sl.drawn) { sl.S = null; draw(sl); } }); }, 150); });
    addEventListener('beforeprint', () => { document.querySelectorAll('details').forEach(d => d.open = true); relayout(); L.slides.forEach(draw); });
    const m = /^#(\d+)/.exec(location.hash); if (m) L.go(+m[1] - 1);
  }
  function measureEarly() { document.documentElement.style.setProperty('--full', fullWidth() + 'px'); }
  // tags are drawn to the measured size of their words, so the lettering must be in before the first drawing
  const fontsIn = () => document.fonts ? Promise.all(['400 20px "Kevin Sans"', '400 17px "Source Serif 4"'].map(f => document.fonts.load(f))).catch(() => {}) : Promise.resolve();
  const start = () => Promise.race([fontsIn(), new Promise(r => setTimeout(r, 2500))]).then(boot).catch(e => { L.err('boot', e.message); console.error(e); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  addEventListener('error', e => L.err('page', e.message));
})();
