/* viz-os deck runtime: boot, stage scaling (landscape 1600x900, portrait 720x1280), navigation, chrome, audit.
   Keys: → space next step · ← back · ↑↓ slide · Home End · m more · d data. Touch: swipe, or tap right/left third. */
(function () {
  'use strict';
  const L = window.VizOS;
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const SIZE = { land: [1600, 900], port: [720, 1280] };
  const q = new URLSearchParams(location.search);
  const CHECK = q.has('check');
  L.slides = []; L.i = 0;

  function readColors() {
    const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue('--' + n).trim();
    L.colors = { accent: v('accent'), tint: v('tint'), s1: v('s1'), s2: v('s2'), s3: v('s3'), good: v('good'), bad: v('bad'), ink: v('ink'), mist: v('mist'), haze: v('haze'), plate: v('plate-solid'), pill: v('pill'), line: v('line'), surf: v('surf'), surf2: v('surf2') };
    L.colors.lantern = L.colors.accent; L.colors.amber = L.colors.tint;   // older decks wrote `color: lantern` / `amber`
    L.fontUI = v('f-ui'); L.fontMono = v('f-mono');
  }

  // ---------- layout ----------
  let orient = null;
  function fit() {
    const vw = innerWidth, vh = innerHeight;
    const o = q.get('o') || (vw / vh < .9 ? 'port' : 'land');
    const changed = o !== orient; orient = o;
    document.body.classList.toggle('port', o === 'port'); document.body.classList.toggle('land', o === 'land');
    const [W, H] = SIZE[o], s = Math.min(vw / W, vh / H);
    L.scale = s; L.W = W; L.H = H;
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
    if (changed && L.ready) { L.slides.forEach(sl => sl.laid = false); layoutCurrent(); }
  }
  // layout pipeline: unzoom -> draw (renders maths, decides stacking, renders maths it made) -> labels (next frame) -> fit -> if the zoom moved,
  // redraw (wrapping and labels move with it) and fit again, only ever shrinking, so it settles in a few rounds
  L.busy = 0;
  const later = fn => { L.busy++; requestAnimationFrame(() => requestAnimationFrame(() => { try { fn(); } finally { L.busy--; } })); };
  const mains = sl => [...sl.r.node.children].filter(e => e.matches(MAIN));
  function draw(sl) { L.fill(sl.r.node, sl.ctx.scope); try { sl.r.layout && sl.r.layout(); } catch (e) { L.err(`slide ${sl.ctx.index + 1}`, e.message); console.error(e); } L.fill(sl.r.node, sl.ctx.scope); sl.r.show && sl.r.show(sl.k); }
  // a fit that comes due after the viewer has moved on would measure a hidden slide, so that slide is laid out again when next shown
  const refit = (sl, top, tries) => later(() => { if (sl !== L.slides[L.i]) { sl.laid = false; return; }
    fitSlide(sl, top); if (Math.abs(sl.zoom - top) > .005 && tries > 0) { draw(sl); refit(sl, sl.zoom, tries - 1); } });
  function layoutCurrent() {
    const sl = L.slides[L.i]; if (!sl) return;
    if (!sl.laid) {
      sl.laid = true; mains(sl).forEach(e => e.style.zoom = ''); sl.zoom = 1;
      draw(sl); refit(sl, 1, 3);
    } else { L.fill(sl.r.node, sl.ctx.scope); sl.r.show && sl.r.show(sl.k); }
  }
  // content that grew after the fit (an answer opened): shrink again if it no longer fits, never grow back (no jump)
  L.refit = () => { const sl = L.slides[L.i]; if (sl && sl.laid) refit(sl, sl.zoom, 3); };
  // content that runs long is zoomed down (never below 70%) instead of spilling under the navigation
  const MAIN = '.body, .predict, .eqwrap, .bridge, .compare, .verdict, .quiz, .recap, .mapw, .s-statement > .g';
  function fitSlide(sl, top = 1) {
    const node = sl.r.node, main = mains(sl);
    sl.zoom = 1;
    if (!main.length || sl.s.type === 'title') return;
    main.forEach(e => e.style.zoom = '');
    const limit = node.clientHeight - parseFloat(getComputedStyle(node).paddingBottom);
    // under zoom, offsetTop and heights come back in the element's own (zoomed) units
    const offTop = el => { let t = 0; for (let n = el; n && n !== node; n = n.offsetParent) t += n.offsetTop; return t; };
    // how far a box's in-flow content runs past its content edge, into its bottom padding or beyond
    // (Chrome's scrollHeight misses this for grid and flex items that stick out, so measure the children)
    const spill = c => { const kids = [...c.children].filter(k => k.offsetParent && getComputedStyle(k).position !== 'absolute'); if (!kids.length) return -1e9;
      return Math.max(...kids.map(k => offTop(k) + k.offsetHeight)) - (offTop(c) + c.offsetHeight - (parseFloat(getComputedStyle(c).paddingBottom) || 0)); };
    const boxes = main.flatMap(e => [e, ...e.querySelectorAll('.g, .family, .eqbody')]);   // a card, or a column inside one, must hold its content
    const over = z => { main.forEach(e => e.style.zoom = z === 1 ? '' : z);
      return Math.max(Math.max(...main.map(e => offTop(e) + Math.max(e.scrollHeight, e.offsetHeight))) * z - limit, ...boxes.map(c => spill(c) * z)); };
    const TOL = 2;   // .fitting drops the entry offset of hidden steps, so this is rounding only
    node.classList.add('fitting');
    if (over(top) > TOL && top > .7) {
      let lo = .7, hi = top;
      for (let i = 0; i < 7; i++) { const mid = (lo + hi) / 2; if (over(mid) <= TOL) lo = mid; else hi = mid; }
      over(lo); sl.zoom = lo;
    } else if (top < 1) { over(top); sl.zoom = top; }
    node.classList.remove('fitting');
  }

  // ---------- slides ----------
  let stage, chrome;
  function build(deck) {
    L.deck = deck;
    const g = L.scope(null, {});
    Object.assign(g, deck.data || {});
    if (window.VIZOS_DATA) Object.assign(g, window.VIZOS_DATA);
    L.derive(g, deck.derive, 'deck');
    L.global = g;
    // chapters: listed, or taken from slides in order. A chapter may name the shape of the data it hands on
    // (`{title: Normalize, shape: guides × samples}`), so the deck reads as a pipeline.
    L.chapterShape = {};
    let chs = (deck.chapters || []).map(c => { if (c && typeof c === 'object') { if (c.shape) L.chapterShape[c.title] = c.shape; return c.title; } return c; });
    let cur = null;
    deck.slides.forEach(s => { if (s.type === 'chapter' && !s.chapter) s.chapter = s.title; if (s.type === 'chapter' && s.shape) L.chapterShape[s.title] = s.shape;
      if (s.chapter) { cur = s.chapter; if (!chs.includes(cur)) chs.push(cur); } s._ch = cur; });
    L.chapters = chs;
    L.seenNotation = new Set();   // notation explained once, the first time a slide uses it
    deck.slides.forEach((s, i) => {
      const scope = L.scope(g, {});
      const ctx = { index: i, deck, scope, symbols: deck.symbols || {}, charts: [], later: [], ctl: {}, k: 0 };
      (s.controls || (s.visual && s.visual.chart && s.visual.chart.controls) || []).forEach(c => scope[c.name] = c.value ?? c.min);
      const rederive = () => L.derive(scope, s.derive, `slide ${i + 1}`);
      rederive();
      const type = L.types[s.type || 'idea'];
      let r;
      if (!type) { L.err(`slide ${i + 1}`, `unknown type "${s.type}"`); r = { node: h('section', 'slide'), steps: 0 }; }
      else { try { r = type(s, ctx); } catch (e) { L.err(`slide ${i + 1}`, e.message); console.error(e); r = { node: h('section', 'slide', `<div class="h1">Slide ${i + 1} failed: ${L.esc(e.message)}</div>`), steps: 0 }; } }
      r.node.dataset.i = i;
      const sl = { s, r, ctx, k: 0, laid: false, steps: r.steps || 0 };
      ctx.refresh = () => { rederive(); draw(sl); };
      Object.defineProperty(ctx, 'k', { get: () => sl.k });
      L.slides.push(sl); stage.appendChild(r.node);
    });
  }

  function chromeBuild() {
    chrome = h('div'); chrome.id = 'chrome';
    const chs = L.chapters;
    chrome.innerHTML = `${chs.length ? `<div class="chapters"><span class="chn"></span>${chs.map((c, i) => `<span class="seg" data-c="${i}">${L.esc(c)}${L.chapterShape[c] ? `<span class="shp">${L.esc(L.chapterShape[c])}</span>` : ''}</span>`).join('')}</div>` : ''}
      <div class="counter"></div>
      <div class="progress">${(chs.length ? chs : ['all']).map(() => '<div class="pc"><i></i></div>').join('')}</div>
      <div class="stepdots"></div>
      <button class="morebtn">Details</button>
      <div class="navbtns"><button class="prev" aria-label="previous"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><button class="next" aria-label="next"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></div>
      <div class="sheet g"><div class="eyebrow">Details</div><div class="p sheetbody"></div></div>`;
    stage.appendChild(chrome);
    chrome.querySelector('.prev').onclick = e => { e.stopPropagation(); back(); };
    chrome.querySelector('.next').onclick = e => { e.stopPropagation(); fwd(); };
    chrome.querySelector('.morebtn').onclick = e => { e.stopPropagation(); chrome.querySelector('.sheet').classList.toggle('open'); };
    chrome.querySelector('.sheet').onclick = e => e.stopPropagation();
  }
  function chromeUpdate() {
    const sl = L.slides[L.i], chs = L.chapters, ci = chs.indexOf(sl.s._ch);
    chrome.querySelectorAll('.chapters .seg').forEach((e, i) => { e.classList.toggle('now', i === ci); e.classList.toggle('done', i < ci); });
    const chn = chrome.querySelector('.chn'); if (chn) chn.textContent = ci >= 0 ? `${ci + 1}/${chs.length}` : '';
    chrome.querySelector('.counter').textContent = `${L.i + 1} / ${L.slides.length}`;
    const pcs = chrome.querySelectorAll('.progress .pc i');
    if (chs.length) chs.forEach((c, j) => { const idx = L.slides.map((x, n) => x.s._ch === c ? n : -1).filter(n => n >= 0); const done = idx.filter(n => n <= L.i).length; pcs[j].style.width = (idx.length ? done / idx.length * 100 : 0) + '%'; });
    else pcs[0].style.width = ((L.i + 1) / L.slides.length * 100) + '%';
    const dots = chrome.querySelector('.stepdots'); dots.innerHTML = sl.steps > 1 ? Array.from({ length: sl.steps }, (_, j) => `<i class="${j + 1 < sl.k ? 'on' : j + 1 === sl.k ? 'now' : ''}"></i>`).join('') : '';
    chrome.querySelector('.prev').disabled = L.i === 0 && sl.k <= minStep(sl);
    chrome.querySelector('.next').disabled = L.i === L.slides.length - 1 && sl.k >= sl.steps;
    const more = chrome.querySelector('.morebtn'), sheet = chrome.querySelector('.sheet');
    const extra = sl.r.more || '';   // what a renderer moved off the slide's face (said aloud, code, next steps)
    more.classList.toggle('show', !!(sl.s.more || extra)); sheet.classList.remove('open');
    if (sl.s.more || extra) { chrome.querySelector('.sheetbody').innerHTML = extra + (sl.s.more ? `<div>${L.md(sl.s.more)}</div>` : ''); L.fill(sheet, sl.ctx.scope); }
  }

  const minStep = sl => sl.steps > 0 ? 1 : 0;
  function apply(sl) {
    const k = sl.k;
    sl.r.node.querySelectorAll('[data-step]').forEach(e => e.classList.toggle('shown', +e.dataset.step <= k));
    sl.r.node.querySelectorAll('[data-only]').forEach(e => e.classList.toggle('shown', +e.dataset.only === k));
    sl.r.show && sl.r.show(k);
  }
  L.go = function (i, k) {
    i = Math.max(0, Math.min(L.slides.length - 1, i | 0));
    const prev = L.slides[L.i];
    if (prev && prev !== L.slides[i]) prev.r.node.classList.remove('on');
    L.i = i; const sl = L.slides[i];
    sl.k = k == null ? minStep(sl) : k < 0 ? sl.steps : Math.max(minStep(sl), Math.min(sl.steps, k));
    sl.r.node.classList.add('on');
    layoutCurrent(); apply(sl); chromeUpdate();
    if (!CHECK) history.replaceState(null, '', `#${i + 1}${sl.k > 1 ? '.' + sl.k : ''}`);
  };
  function fwd() { const sl = L.slides[L.i]; if (sl.k < sl.steps) { sl.k++; apply(sl); chromeUpdate(); } else if (L.i < L.slides.length - 1) L.go(L.i + 1); }
  function back() { const sl = L.slides[L.i]; if (sl.k > minStep(sl)) { sl.k--; apply(sl); chromeUpdate(); } else if (L.i > 0) L.go(L.i - 1, -1); }
  L.next = fwd; L.prev = back;

  function bindInput() {
    addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.tagName === 'INPUT' && !/Arrow(Up|Down)/.test(e.key) && e.target.type === 'range' && /Arrow(Left|Right)/.test(e.key)) return;
      const sl = L.slides[L.i];
      if (sl.ctx.keys && sl.ctx.keys(e)) return;
      if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); fwd(); }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); back(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); L.go(L.i + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); L.go(L.i - 1); }
      else if (e.key === 'Home') L.go(0); else if (e.key === 'End') L.go(L.slides.length - 1, -1);
      else if (e.key === 'm') chrome.querySelector('.morebtn.show')?.click();
      else if (e.key === 'd') sl.r.node.querySelector('.datatoggle')?.click();
    });
    let x0 = null, y0 = null, t0 = 0;
    addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; t0 = Date.now(); });
    addEventListener('pointerup', e => {
      if (x0 == null) return; const dx = e.clientX - x0, dy = e.clientY - y0; const tgt = e.target;
      const interactive = tgt.closest('button,input,a,.opt,.flip,.chart svg,.datatable,.sheet,.recipe th,.tblwrap');
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4 && !tgt.closest('input')) (dx < 0 ? fwd : back)();
      else if (!interactive && Math.abs(dx) < 8 && Math.abs(dy) < 8 && Date.now() - t0 < 500) (e.clientX < innerWidth * .3 ? back : fwd)();
      x0 = null;
    });
    addEventListener('resize', fit);
  }

  // ---------- audit: what check.py reads, per slide and step ----------
  L.audit = function () {
    const sl = L.slides[L.i], out = [], node = sl.r.node, sr = stage.getBoundingClientRect(), s = L.scale;
    const toStage = r => ({ x0: (r.left - sr.left) / s, y0: (r.top - sr.top) / s, x1: (r.right - sr.left) / s, y1: (r.bottom - sr.top) / s });
    const visible = e => { if (!e.getClientRects().length) return false; let n = e; while (n && n !== node) { const cs = getComputedStyle(n); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < .05) return false; n = n.parentElement; } return true; };
    // text blocks: block-level boxes holding text (inline runs belong to their block), KaTeX roots, positioned labels
    const hasText = e => (e.textContent || '').trim().length > 0;
    const isInline = e => { const d = getComputedStyle(e).display; return d === 'inline' || d === 'contents'; };
    const leaves = [...node.querySelectorAll('*')].filter(e => {
      if (e.closest('svg') || e.closest('.datatable') || e.closest('.tip')) return false;
      if (e.closest('.katex') && !e.matches('.katex')) return false;
      if (e.matches('.katex')) return true;
      if (isInline(e) || !hasText(e)) return false;
      return ![...e.querySelectorAll('*')].some(c => !c.closest('.katex') && !isInline(c) && hasText(c) && c !== e);
    }).filter(e => visible(e) && !hiddenFace(e));
    const svgTexts = [...node.querySelectorAll('svg text')].filter(t => visible(t) && !t.closest('.off'));
    const name = e => `"${(e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34)}"`;
    const [W, H] = [L.W, L.H], top = 104, bot = H - parseFloat(getComputedStyle(node).paddingBottom) + 12;
    const items = [...leaves, ...svgTexts].map(e => ({ e, b: toStage(e.getBoundingClientRect()) }));
    for (const { e, b } of items) {
      if (b.x0 < 20 || b.x1 > W - 20 || b.y0 < 20 || b.y1 > H - 16) out.push(`${name(e)} runs off the slide`);
      else if (b.y1 > bot + 2 && !e.closest('#chrome')) out.push(`${name(e)} runs into the navigation bar`);
      else if (b.y0 < top - 4 && !e.closest('#chrome')) out.push(`${name(e)} runs into the chapter bar`);
      const fs = parseFloat(getComputedStyle(e).fontSize) * s;
      if (fs < (orient === 'port' ? 10.5 : 12) && s > .3) out.push(`${name(e)} renders at ${fs.toFixed(1)}px on screen (too small)`);
      if (e.nodeType === 1 && !e.closest('svg')) { const cs = getComputedStyle(e);
        if (['block', 'flex', 'grid', 'list-item'].includes(cs.display) && cs.overflow === 'visible' && e.clientWidth && (e.scrollWidth > e.clientWidth + 3)) out.push(`${name(e)} is wider than its box`);
        // text must stay inside its card, clear of the border
        const card = e.parentElement && e.parentElement.closest('.g');
        if (card && node.contains(card) && getComputedStyle(card).overflow === 'visible') { const c = toStage(card.getBoundingClientRect());
          if (b.y1 > c.y1 - 6 || b.x1 > c.x1 - 4 || b.y0 < c.y0 + 2 || b.x0 < c.x0 + 2) out.push(`${name(e)} spills out of its card`); } }
    }
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j]; if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
      const ov = Math.max(0, Math.min(a.b.x1, b.b.x1) - Math.max(a.b.x0, b.b.x0) - 2) * Math.max(0, Math.min(a.b.y1, b.b.y1) - Math.max(a.b.y0, b.b.y0) - 2);
      if (ov > 40) out.push(`text overlaps: ${name(a.e)} × ${name(b.e)}`);
    }
    if (node.scrollHeight > node.clientHeight + 4) out.push(`content is taller than the slide by ${node.scrollHeight - node.clientHeight}px`);
    node.querySelectorAll('.family > *, .family .g').forEach(e => { const c = e.closest('.family').parentElement, cb = toStage(c.getBoundingClientRect()), b = toStage(e.getBoundingClientRect());
      if (visible(e) && (b.y1 > cb.y1 - 4 || b.y0 < cb.y0 + 2)) out.push(`${name(e)} runs past the edge of its card`); });
    if (sl.zoom && sl.zoom < .8) out.push(`content was shrunk to ${Math.round(sl.zoom * 100)}% to fit: cut words or split the slide`);
    node.querySelectorAll('.katex-error').forEach(e => out.push(`formula error: ${e.title || e.textContent.slice(0, 40)}`));
    node.querySelectorAll('.iv.bad').forEach(e => out.push(`could not compute {{${e.dataset.x}}}`));
    node.querySelectorAll('.approx').forEach(e => { if (!visible(e)) return;
      const k = e.closest('.katex') || e, line = k.closest('.part') ? k.closest('.part').parentElement : k;   // a calc line is split into parts
      const t = [...line.querySelectorAll('.katex-html')].map(x => x.textContent).join(' ').replace(/\s+/g, ' ').trim();
      out.push(`a worked line reads ≈ (“${t.length > 70 ? '…' + t.slice(-69) : t}”): its rounded numbers do not give the result shown even with 2 more digits; give the inputs a finer fmt or name the step in between`); });
    node.querySelectorAll('.vis .chart').forEach(c => { if (!c.querySelector('svg')) out.push('a chart did not draw (no room, or bad data)'); });
    node.querySelectorAll('.codebox').forEach(c => { if (c.scrollWidth > c.clientWidth + 2) out.push(`code runs off its box: "${c.textContent.split('\n').sort((a, b) => b.length - a.length)[0].slice(0, 40)}"`); });
    if (sl.r.audit) try { out.push(...sl.r.audit()); } catch (e) { out.push('audit failed: ' + e.message); }
    return [...new Set(out)];
  };
  // the hidden side of a flip card is not on screen
  const hiddenFace = e => { const f = e.closest('.face'); if (!f) return false; const on = f.closest('.flip').classList.contains('on'); return on ? f.classList.contains('front') : f.classList.contains('back'); };
  // text boxes and colours, for the contrast check in check.py (viewport px)
  L.textBoxes = function () {
    const node = L.slides[L.i].r.node, out = [];
    const ownText = e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    node.querySelectorAll('*').forEach(e => { if (!ownText(e) || e.closest('svg') || e.closest('.katex') || e.closest('.datatable') || hiddenFace(e)) return;
      const rg = document.createRange(), rs = []; [...e.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).forEach(n => { rg.selectNodeContents(n); rs.push(...rg.getClientRects()); });
      if (!rs.length) return; const r = { left: Math.min(...rs.map(x => x.left)), top: Math.min(...rs.map(x => x.top)), width: Math.max(...rs.map(x => x.right)) - Math.min(...rs.map(x => x.left)), height: Math.max(...rs.map(x => x.bottom)) - Math.min(...rs.map(x => x.top)) };
      if (!r.width || !r.height) return;
      const cs = getComputedStyle(e); if (+cs.opacity < .5 || cs.visibility === 'hidden') return; let n = e, hidden = false; while (n && n !== node) { if (getComputedStyle(n).opacity < .5) { hidden = true; break; } n = n.parentElement; } if (hidden) return;
      out.push({ text: e.textContent.trim().slice(0, 40), x: r.left, y: r.top, w: r.width, h: r.height, rects: rs.filter(q => q.width > 2 && q.height > 2).map(q => [q.left, q.top, q.width, q.height]),
        color: cs.color, size: parseFloat(cs.fontSize) * L.scale, weight: +cs.fontWeight }); });
    return out;
  };
  L.info = () => ({ n: L.slides.length, slides: L.slides.map((sl, i) => ({ i, type: sl.s.type || 'idea', title: L.plain(sl.s.title || sl.s.q || sl.s.text || '', sl.ctx.scope).slice(0, 60), steps: sl.steps,
    controls: (sl.s.controls || (sl.s.visual && sl.s.visual.chart && sl.s.visual.chart.controls) || []).map(c => ({ name: c.name, min: c.min, max: c.max, value: c.value ?? c.min })), predict: sl.s.type === 'predict' })), errors: L.errors });
  L.setControl = (name, v) => { const sl = L.slides[L.i]; if (sl.ctx.ctl[name]) sl.ctx.ctl[name](v); };
  L.reveal = () => { const sl = L.slides[L.i]; sl.ctx.reveal && sl.ctx.reveal(); };

  // ---------- boot ----------
  function boot() {
    const src = document.getElementById('vizos-deck');
    const deck = JSON.parse(src.textContent);
    if (CHECK) document.body.classList.add('no-anim');
    readColors();
    const vp = h('div'); vp.id = 'viewport'; stage = h('div'); stage.id = 'stage'; vp.appendChild(stage); document.body.appendChild(vp);
    document.title = deck.title || 'viz-os deck';
    fit();
    build(deck); chromeBuild(); bindInput();
    L.ready = true;
    // the formula fonts arrive only when a formula first needs them: measure again once they have
    if (document.fonts) document.fonts.addEventListener('loadingdone', () => { L.slides.forEach(sl => sl.laid = false); layoutCurrent(); });
    const m = /^#(\d+)(?:\.(\d+))?/.exec(location.hash);
    L.go(m ? +m[1] - 1 : 0, m && m[2] ? +m[2] : null);
  }
  const start = () => (document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]) : Promise.resolve()).then(boot).catch(e => { L.err('boot', e.message); console.error(e); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  addEventListener('error', e => L.err('page', e.message));
})();
