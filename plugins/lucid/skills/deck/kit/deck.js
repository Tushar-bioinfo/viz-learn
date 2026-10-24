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
    L.colors = { lantern: v('lantern'), s1: v('s1'), s2: v('s2'), s3: v('s3'), good: v('good'), bad: v('bad'), ink: v('ink'), mist: v('mist'), haze: v('haze'), plate: v('plate-solid') };
    L.fontUI = v('f-ui');
  }

  function wallpaper() {
    const wall = h('div'); wall.id = 'wall';
    wall.innerHTML = '<div class="stars"></div><div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div><div class="moon"></div><div class="bokeh"></div><div class="lake"></div>';
    // soft lights (moonlight, blossom, lantern) for the glass to blur: without them glass reads as a flat tint
    const bk = wall.querySelector('.bokeh'), rb = L.rng(5), tints = ['228,235,250', '153,130,201', '184,92,188', '94,109,228', '255,196,107'];
    for (let i = 0; i < 34; i++) { const d = 8 + Math.pow(rb(), 2.2) * 120, t = tints[i % 9 === 0 ? 4 : Math.floor(rb() * 4)];
      const e = document.createElement('i'); Object.assign(e.style, { left: (rb() * 100) + '%', top: (rb() * 100) + '%', width: d + 'px', height: d + 'px',
        background: `radial-gradient(circle, rgba(${t},${.22 + rb() * .4}) 0%, rgba(${t},${.08 + rb() * .12}) 60%, transparent 72%)` }); bk.appendChild(e); }
    document.body.prepend(wall);
    // star field: seeded, drawn once
    const cv = document.createElement('canvas'), W = 1600, H = 1000; cv.width = W; cv.height = H; const c = cv.getContext('2d'), r = L.rng(11);
    for (let i = 0; i < 260; i++) { const x = r() * W, y = Math.pow(r(), 1.6) * H * .8, s = r() < .08 ? 1.6 : r() * .9 + .3, a = .25 + r() * .6;
      c.fillStyle = `rgba(${235 + r() * 20 | 0},${238 + r() * 17 | 0},255,${a})`; c.beginPath(); c.arc(x, y, s, 0, 7); c.fill(); }
    wall.querySelector('.stars').style.backgroundImage = `url(${cv.toDataURL()})`;
    L.wall = wall;
  }
  // orbs drift a little with every slide, so the glass always has light moving behind it
  function drift(i) {
    if (!L.wall) return; const r = L.rng(1000 + i * 7), m = (a) => (r() - .5) * a;
    L.wall.querySelector('.o1').style.transform = `translate(${m(16)}vmax, ${m(12)}vmax)`;
    L.wall.querySelector('.o2').style.transform = `translate(${m(14)}vmax, ${m(10)}vmax)`;
    L.wall.querySelector('.o3').style.transform = `translate(${m(18)}vmax, ${m(8)}vmax)`;
    L.wall.querySelector('.moon').style.transform = `translate(${m(6)}vmin, ${m(4)}vmin)`;
    L.wall.querySelector('.bokeh').style.transform = `translate(${m(4)}vmax, ${m(3)}vmax)`;
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
    const over = z => { main.forEach(e => e.style.zoom = z === 1 ? '' : z); return Math.max(...main.map(e => (e.offsetTop + Math.max(e.scrollHeight, e.offsetHeight)) * z)) - limit; };
    const TOL = 12;   // steps not yet shown sit 8px low; that is not overflow
    if (over(1) <= TOL) return;
    let lo = .7, hi = 1;
    for (let i = 0; i < 7; i++) { const mid = (lo + hi) / 2; if (over(mid) <= TOL) lo = mid; else hi = mid; }
    over(lo); sl.zoom = lo;
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
        if (['block', 'flex', 'grid', 'list-item'].includes(cs.display) && cs.overflow === 'visible' && e.clientWidth && (e.scrollWidth > e.clientWidth + 3)) out.push(`${name(e)} is wider than its box`); }
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
