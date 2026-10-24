/* Lucid deck runtime: boot, stage scaling (landscape 1600x900, portrait 720x1280), navigation, chrome, wallpaper, audit.
   Keys: → space next step · ← back · ↑↓ slide · Home End · m more · d data. Touch: swipe, or tap right/left third. */
(function () {
  'use strict';
  const L = window.Lucid;
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const SIZE = { land: [1600, 900], port: [720, 1280] };
  const q = new URLSearchParams(location.search);
  const CHECK = q.has('check');
  L.slides = []; L.i = 0;

  function readColors() {
    const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue('--' + n).trim();
    L.colors = { accent: v('accent'), amber: v('amber'), s1: v('s1'), s2: v('s2'), s3: v('s3'), good: v('good'), bad: v('bad'), ink: v('ink'), mist: v('mist'), haze: v('haze'), plate: v('plate-solid') };
    L.colors.lantern = L.colors.accent;   // older decks wrote `color: lantern`
    L.fontUI = v('f-ui');
  }

  function wallpaper() {
    const wall = h('div'); wall.id = 'wall';
    wall.innerHTML = '<svg class="ribbons" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"></svg><div class="orb o1"></div><div class="orb o2"></div>'
      + '<div class="orb o3"></div><div class="orb o4"></div><div class="sparks"></div><div class="grain"></div><div class="vignette"></div>';
    document.body.prepend(wall);
    // silk ribbons of warm light: wide soft strokes the glass can blur (a flat gradient behind glass reads as a tint, not glass)
    const NS = 'http://www.w3.org/2000/svg', svg = wall.querySelector('.ribbons');
    svg.innerHTML = `<defs>
      <linearGradient id="fa" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#5a1608" stop-opacity=".0"/><stop offset=".22" stop-color="#8f2812" stop-opacity=".72"/><stop offset=".55" stop-color="#c8401f" stop-opacity=".66"/><stop offset=".82" stop-color="#e0703f" stop-opacity=".4"/><stop offset="1" stop-color="#ffb27f" stop-opacity="0"/></linearGradient>
      <linearGradient id="fb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e0803" stop-opacity=".92"/><stop offset=".5" stop-color="#5e1a0a" stop-opacity=".8"/><stop offset="1" stop-color="#b8401f" stop-opacity=".42"/></linearGradient>
      <linearGradient id="fc" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ffd2b8" stop-opacity="0"/><stop offset=".4" stop-color="#ffd9c2" stop-opacity=".6"/><stop offset=".75" stop-color="#ffb27f" stop-opacity=".38"/><stop offset="1" stop-color="#ffb27f" stop-opacity="0"/></linearGradient>
      <linearGradient id="fd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffb27f" stop-opacity="0"/><stop offset=".6" stop-color="#ff8a50" stop-opacity=".2"/><stop offset="1" stop-color="#ff5a36" stop-opacity=".32"/></linearGradient>
      <filter id="soft" x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation="3"/></filter></defs>
      <path filter="url(#soft)" fill="url(#fd)" d="M 820 -40 C 1060 70, 1260 40, 1660 170 L 1660 -40 Z"/>
      <path filter="url(#soft)" fill="url(#fb)" d="M -120 860 C 320 720, 700 940, 1080 800 S 1540 600, 1740 660 L 1740 1120 L -120 1120 Z"/>
      <path filter="url(#soft)" fill="url(#fa)" d="M -120 740 C 300 590, 600 840, 960 640 S 1480 300, 1740 360 L 1740 520 C 1500 500, 1260 760, 980 850 S 380 960, -120 990 Z"/>
      <path fill="url(#fc)" d="M -120 738 C 300 588, 600 838, 960 638 S 1480 298, 1740 358 L 1740 368 C 1480 312, 1000 660, 962 662 C 600 862, 300 610, -120 760 Z"/>`;
    // sparks: a few warm embers, more of them low down, near the glow
    const sp = wall.querySelector('.sparks'), r = L.rng(17);
    for (let i = 0; i < 38; i++) { const d = 2 + Math.pow(r(), 3) * 7, y = 100 - Math.pow(r(), 1.7) * 100, a = .25 + r() * .55, c = r() < .7 ? '255,138,80' : '255,214,186';
      const e = document.createElement('i'); Object.assign(e.style, { left: (r() * 100) + '%', top: y + '%', width: d + 'px', height: d + 'px',
        background: `rgba(${c},${a})`, boxShadow: `0 0 ${d * 3}px ${d * .8}px rgba(${c},${a * .55})` }); sp.appendChild(e); }
    // film grain: inside the glass it is blurred away, outside it stays crisp, so the glass reads as a smoother material
    const cv = document.createElement('canvas'); cv.width = cv.height = 220; const c = cv.getContext('2d'), im = c.createImageData(220, 220), rg = L.rng(3);
    for (let i = 0; i < im.data.length; i += 4) { const v = rg() * 255 | 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    c.putImageData(im, 0, 0); wall.querySelector('.grain').style.backgroundImage = `url(${cv.toDataURL()})`;
    L.wall = wall;
  }
  // the light moves a little with every slide, so the glass always has something shifting behind it
  function drift(i) {
    if (!L.wall) return; const r = L.rng(1000 + i * 7), m = (a) => (r() - .5) * a;
    L.wall.querySelector('.o1').style.transform = `translate(${m(14)}vmax, ${m(10)}vmax)`;
    L.wall.querySelector('.o2').style.transform = `translate(${m(12)}vmax, ${m(12)}vmax)`;
    L.wall.querySelector('.o3').style.transform = `translate(${m(10)}vmax, ${m(6)}vmax)`;
    L.wall.querySelector('.o4').style.transform = `translate(${m(16)}vmax, ${m(12)}vmax)`;
    const low = document.body.classList.contains('port') ? 9 : 0;   // portrait crops the wall: keep the bright folds lower
    L.wall.querySelector('.ribbons').style.transform = `translate(${m(5)}%, ${m(4) + low}%) rotate(${m(6)}deg)`;
    L.wall.querySelector('.sparks').style.transform = `translate(${m(3)}vmax, ${m(2)}vmax)`;
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
  // layout pipeline: unzoom -> draw (decides stacking, renders maths) -> labels (next frame) -> fit -> redraw once if the zoom moved
  L.busy = 0;
  const later = fn => { L.busy++; requestAnimationFrame(() => requestAnimationFrame(() => { try { fn(); } finally { L.busy--; } })); };
  const mains = sl => [...sl.r.node.children].filter(e => e.matches(MAIN));
  function draw(sl) { try { sl.r.layout && sl.r.layout(); } catch (e) { L.err(`slide ${sl.ctx.index + 1}`, e.message); console.error(e); } L.fill(sl.r.node, sl.ctx.scope); sl.r.show && sl.r.show(sl.k); }
  function layoutCurrent() {
    const sl = L.slides[L.i]; if (!sl) return;
    if (!sl.laid) {
      sl.laid = true; mains(sl).forEach(e => e.style.zoom = ''); sl.zoom = 1;
      draw(sl);
      later(() => { const z0 = sl.zoom; fitSlide(sl); if (Math.abs(sl.zoom - z0) > .005) { draw(sl); later(() => {}); } });
    } else { L.fill(sl.r.node, sl.ctx.scope); sl.r.show && sl.r.show(sl.k); }
  }
  // content that runs long is zoomed down (never below 70%) instead of spilling under the navigation
  const MAIN = '.body, .predict, .eqwrap, .bridge, .compare, .verdict, .quiz, .recap, .mapw, .s-statement > .g';
  function fitSlide(sl) {
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
    const boxes = main.flatMap(e => [e, ...e.querySelectorAll('.g')]);
    const over = z => { main.forEach(e => e.style.zoom = z === 1 ? '' : z);
      return Math.max(Math.max(...main.map(e => offTop(e) + Math.max(e.scrollHeight, e.offsetHeight))) * z - limit, ...boxes.map(c => spill(c) * z)); };
    const TOL = 2;   // .fitting drops the entry offset of hidden steps, so this is rounding only
    node.classList.add('fitting');
    if (over(1) > TOL) {
      let lo = .7, hi = 1;
      for (let i = 0; i < 7; i++) { const mid = (lo + hi) / 2; if (over(mid) <= TOL) lo = mid; else hi = mid; }
      over(lo); sl.zoom = lo;
    }
    node.classList.remove('fitting');
  }

  // ---------- slides ----------
  let stage, chrome;
  function build(deck) {
    L.deck = deck;
    const g = L.scope(null, {});
    Object.assign(g, deck.data || {});
    if (window.LUCID_DATA) Object.assign(g, window.LUCID_DATA);
    L.derive(g, deck.derive, 'deck');
    L.global = g;
    // chapters: listed, or taken from slides in order
    let chs = deck.chapters ? [...deck.chapters] : [];
    let cur = null;
    deck.slides.forEach(s => { if (s.type === 'chapter' && !s.chapter) s.chapter = s.title; if (s.chapter) { cur = s.chapter; if (!chs.includes(cur)) chs.push(cur); } s._ch = cur; });
    L.chapters = chs;
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
    chrome.innerHTML = `${chs.length ? `<div class="chapters g pill thin"><span class="chn"></span>${chs.map((c, i) => `<span class="seg" data-c="${i}">${L.esc(c)}</span>`).join('')}</div>` : ''}
      <div class="counter g pill thin"></div>
      <div class="progress">${(chs.length ? chs : ['all']).map(() => '<div class="pc"><i></i></div>').join('')}</div>
      <div class="stepdots"></div>
      <button class="morebtn g pill thin">+ more</button>
      <div class="navbtns"><button class="g pill thin prev" aria-label="previous"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><button class="g pill thin next" aria-label="next"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></div>
      <div class="sheet g"><div class="eyebrow">Deeper</div><div class="p sheetbody"></div></div>`;
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
    more.classList.toggle('show', !!sl.s.more); sheet.classList.remove('open');
    if (sl.s.more) { chrome.querySelector('.sheetbody').innerHTML = L.md(sl.s.more); L.fill(sheet, sl.ctx.scope); }
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
    layoutCurrent(); apply(sl); chromeUpdate(); drift(i);
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
        // text must stay inside its glass card, clear of the rim
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
    if (sl.zoom && sl.zoom < .8) out.push(`content was shrunk to ${Math.round(sl.zoom * 100)}% to fit: cut words or split the slide`);
    node.querySelectorAll('.katex-error').forEach(e => out.push(`formula error: ${e.title || e.textContent.slice(0, 40)}`));
    node.querySelectorAll('.iv.bad').forEach(e => out.push(`could not compute {{${e.dataset.x}}}`));
    node.querySelectorAll('.vis .chart').forEach(c => { if (!c.querySelector('svg')) out.push('a chart did not draw (no room, or bad data)'); });
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
    const src = document.getElementById('lucid-deck');
    const deck = JSON.parse(src.textContent);
    if (CHECK) document.body.classList.add('no-anim');
    readColors(); wallpaper();
    const vp = h('div'); vp.id = 'viewport'; stage = h('div'); stage.id = 'stage'; vp.appendChild(stage); document.body.appendChild(vp);
    document.title = deck.title || 'Lucid deck';
    fit();
    build(deck); chromeBuild(); bindInput();
    L.ready = true;
    const m = /^#(\d+)(?:\.(\d+))?/.exec(location.hash);
    L.go(m ? +m[1] - 1 : 0, m && m[2] ? +m[2] : null);
  }
  const start = () => (document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]) : Promise.resolve()).then(boot).catch(e => { L.err('boot', e.message); console.error(e); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  addEventListener('error', e => L.err('page', e.message));
})();
