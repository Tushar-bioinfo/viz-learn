/* viz-os class: the board scene, on a page that scrolls. A scene is written top to bottom and stays written, the way a
   teacher fills a tablet page: each step is its teacher line and what it adds, and nothing is hidden behind a click.
   A table is pinned beside the work; its derived columns fill in as the reading line reaches the step that adds them, and
   the row in use is lit. A picture sits beside the lines that talk about it and stays in view while they scroll past.
   Every figure owns its shape: a plane's comes from its axis ranges (one scale for both axes), a chart's from its `ratio`,
   an image's from the image. The layout gives each a width and a height limit, never a box to fill.
   Next and Back appear only on a figure that really changes: marks that come in on a step, a run's frames, a matrix step.
   A step with `think` shows its question with a Show answer button. The answer takes no room until pressed: the card grows
   and its top stays. What the step adds waits behind the answer, in its own space. Attention goes by text colour on the thing itself: a symbol has one colour on the
   whole page, on its TeX, on its number, on its table column and on the table cell it came from. */
(function () {
  'use strict';
  const L = window.VizOS, h = L.h;
  // ==text== is the deck's orange underline; ==s1:text== (s2 to s5, good, bad, or a hex like #cc6600) is bold text in that colour, no underline
  const md = s => L.md(s).replace(/<mark class="hi">(accent|s1|s2|s3|s4|s5|good|bad|mist|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}):/g, (_, c) => `<mark class="hi tc" style="--hc:${c[0] === '#' ? c : `var(--${c})`}">`);
  const SVG = 'http://www.w3.org/2000/svg';
  // what follows the window on every board: a held figure lets go, and the line by the buttons steps aside
  let watching = false;
  addEventListener('scroll', () => { if (watching) return; watching = true; requestAnimationFrame(() => { watching = false; (L.slides || []).forEach(sl => sl.r.watch && sl.r.watch()); }); }, { passive: true });
  const sv = (tag, attrs, parent) => { const e = document.createElementNS(SVG, tag); for (const k in attrs || {}) if (attrs[k] != null) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const list = x => Array.isArray(x) ? x : x == null ? [] : [x];
  // hands-on figures (adv.md): motion that is not a hover. With reduced motion, or for the check, every move is at once
  const STILL = () => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || /[?&]check\b/.test(location.search);
  let EZ = null; const easeK = () => EZ || (EZ = (() => { const m = /cubic-bezier\(([^)]+)\)/.exec(getComputedStyle(document.documentElement).getPropertyValue('--ease')), b = m ? m[1].split(',').map(Number) : [.2, .7, .2, 1]; return bezier(...b); })());
  // a camera glide takes GLIDE ms, eased in and out evenly so the move uses its whole time, and pulls back PULL at its middle
  const GLIDE = 700, PULL = .08, EVEN = q => q < .5 ? 4 * q * q * q : 1 - (-2 * q + 2) ** 3 / 2;
  const MSTATE = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--m-state')) || 450;
  // a handle is an HTML button over the drawing (a dot in the colour of what it moves), so it keeps the focus and the pointer while the drawing is redrawn
  const handle = (host, c, aria) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'hdl'; b.setAttribute('aria-label', aria); b.style.setProperty('--hc', c);
    b.innerHTML = '<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="7.5" style="fill:var(--hc);stroke:var(--bg);stroke-width:2"/></svg>'; host.appendChild(b); return b; };
  const pulse = b => { if (!b || STILL()) return; b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); setTimeout(() => b.classList.remove('pulse'), 1300); };
  // drag a handle: onMove(clientX, clientY) while the button is down; the arrow keys call onKey(dx, dy), Shift for 5 times as far
  const dragHandle = (b, onMove, onKey, onStart) => {
    b.addEventListener('pointerdown', e => { if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); b.focus({ preventScroll: true, focusVisible: false }); try { b.setPointerCapture(e.pointerId); } catch (_) { /* a synthetic event */ } b.classList.add('on'); onStart(); });
    b.addEventListener('pointermove', e => { if (b.classList.contains('on') && e.buttons) onMove(e.clientX, e.clientY); });
    const up = () => b.classList.remove('on'); ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => b.addEventListener(t, up));
    b.addEventListener('keydown', e => { const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key]; if (!k) return; e.preventDefault(); e.stopPropagation();
      onStart(); onKey(k[0] * (e.shiftKey ? 5 : 1), k[1] * (e.shiftKey ? 5 : 1)); }); };
  // move named controls to new values over --m-state on the kit's one curve
  // each control has at most one tween: a new tween, or the learner's own drag (untween), takes the control from the old one
  const tweenCtl = (ctx, to) => { const tw = ctx.tw || (ctx.tw = {}), id = { to }, from = {}; Object.keys(to).forEach(k => { from[k] = ctx.scope[k]; tw[k] = id; }); const ms = STILL() ? 0 : MSTATE(), ez = easeK(), t0 = performance.now();
    const step = now => { const q = ms ? Math.min(1, (now - t0) / ms) : 1, e = ez(q), mine = Object.keys(to).filter(k => tw[k] === id); mine.forEach(k => { ctx.ctl[k] && ctx.ctl[k](from[k] + (to[k] - from[k]) * e); if (q >= 1) delete tw[k]; }); if (q < 1 && mine.length) requestAnimationFrame(step); };
    if (ms) requestAnimationFrame(step); else step(t0); };
  const untween = (ctx, k) => { if (ctx.tw) delete ctx.tw[k]; };
  const rangeOf = (ctx, name) => { const c = (((ctx.deck.slides || [])[ctx.index] || {}).controls || []).find(x => x && x.name === name) || {}; return [+c.min, +c.max]; };
  const clampTo = (ctx, name, v) => { const [a, b] = rangeOf(ctx, name); return Math.max(a, Math.min(b, v)); };
  // pause hover pop-ups: while paused, pointing at a name no longer opens its `says`; a tap, a click or a focus still does.
  // The button sits in the right margin just above the scene rail, made the first time a name or legend entry has `says`.
  // The choice is kept per viewer; storage may be blocked (a file page, a strict browser), so the page works without it
  const PAUSE_KEY = 'vizos-hover-paused';
  let hoverOff = false, pauseBtn = null;
  try { hoverOff = localStorage.getItem(PAUSE_KEY) === '1'; } catch (e) { /* storage blocked: start unpaused */ }
  const PAUSE_ICON = { on: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="1.5" y="1" width="2.5" height="8" fill="currentColor"/><rect x="6" y="1" width="2.5" height="8" fill="currentColor"/></svg>',
    off: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><polygon points="2,1 9,5 2,9" fill="currentColor"/></svg>' };
  const pauseShow = () => { const t = hoverOff ? 'Resume hover pop-ups' : 'Pause hover pop-ups';
    pauseBtn.innerHTML = hoverOff ? PAUSE_ICON.off : PAUSE_ICON.on; pauseBtn.title = t; pauseBtn.setAttribute('aria-label', t); pauseBtn.setAttribute('aria-pressed', String(hoverOff)); };
  let railSeen = null;   // the rail may be built after the first board: watch it once it exists, so the button follows its height
  const pausePlace = () => { const rail = document.getElementById('lsrail'), r = rail && rail.getBoundingClientRect();
    if (rail && rail !== railSeen && window.ResizeObserver) { railSeen = rail; new ResizeObserver(pausePlace).observe(rail); }
    pauseBtn.style.bottom = (r && r.height ? Math.round(innerHeight - r.top + 4) : 10) + 'px'; };
  const pauseButton = () => {
    if (pauseBtn || !document.body) return;
    pauseBtn = h('button'); pauseBtn.id = 'lspause'; pauseBtn.type = 'button'; pauseShow(); document.body.appendChild(pauseBtn);
    pauseBtn.addEventListener('click', () => { hoverOff = !hoverOff; try { localStorage.setItem(PAUSE_KEY, hoverOff ? '1' : '0'); } catch (e) { /* not kept */ }
      pauseShow(); document.dispatchEvent(new CustomEvent('vizos-hoverpause')); });
    pausePlace(); requestAnimationFrame(pausePlace); addEventListener('resize', pausePlace); addEventListener('load', pausePlace); };
  const COLOR = { accent: 1, tint: 1, s1: 1, s2: 1, s3: 1, s4: 1, s5: 1, ink: 1, mist: 1, haze: 1, line: 1, good: 1, bad: 1 };
  const col = c => COLOR[c] ? `var(--${c})` : c || 'var(--mist)';
  // line weights (board.css --w-data, --w-wit): every mark draws at the data weight; the witness, for now the mark drawn in the
  // accent colour, at its own heavier weight. An arrowhead grows with its line: today's size on the witness, 72% on a 2 px mark
  const LW = {}, lw = k => LW[k] ?? (LW[k] = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--w-${k}`)) || (k === 'wit' ? 3.5 : 2));
  const witOf = c => c === 'var(--accent)', wOf = c => lw(witOf(c) ? 'wit' : 'data'), headOf = w => (6.24 + 3.36 * w) / 18;
  // ---------- a dot in its true colour, and colour words that must fit it ----------
  // `rgb: 10` paints a dot the colour its place makes (x = red level, y = green, blue 0, full at 10); `rgb: {r, g, b, max}` from
  // any numbers. Each channel is a straight share of full, clipped at full: a sensor cannot read brighter than full
  const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
  const toHex = (lv, mx) => '#' + lv.map(q => Math.round(255 * Math.min(1, Math.max(0, q / mx))).toString(16).padStart(2, '0')).join('');
  const hsvOf = hex => { const hx = hex.slice(1), f = hx.length === 3 ? [...hx].map(q => q + q) : [hx.slice(0, 2), hx.slice(2, 4), hx.slice(4, 6)], [r, g, b] = f.map(q => parseInt(q, 16) / 255);
    const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); let hh = 0;
    if (d) hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (hh * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx }; };
  // each word's fit, in hue degrees (lo to hi, red wraps round 0) and limits on s and v; a hued word also needs s ≥ .25 and v ≥ .15
  const HUE = { red: [340, 20], orange: [15, 50, .5], amber: [35, 55], yellow: [45, 70, .5], olive: [45, 80, 0, .65], brown: [10, 50, 0, .65], lime: [70, 110],
    green: [75, 165], teal: [160, 200, 0, .7], cyan: [165, 200], blue: [195, 255], purple: [250, 300], violet: [250, 300], magenta: [285, 330], pink: [300, 355] };
  const GREY = { black: { vmax: .2 }, white: { smax: .2, vmin: .8 }, grey: { smax: .25, vmin: .15, vmax: .9 }, gray: { smax: .25, vmin: .15, vmax: .9 } };
  const ruleOf = w => { if (GREY[w]) return { smin: 0, vmin: 0, smax: 1, vmax: 1, ...GREY[w] }; const [lo, hi, vmin = .15, vmax = 1] = HUE[w]; return { lo, hi, smin: .25, vmin: Math.max(.15, vmin), smax: 1, vmax }; };
  // the edges count as inside, give or take float rounding (#8c8368's hue works out to 44.99999999999994)
  const EPS = 1e-6, fits = (w, mod, hsv) => { const R0 = ruleOf(w), vmin = mod === 'dark' ? 0 : R0.vmin, smin = mod === 'light' || mod === 'pale' ? 0 : R0.smin;
    if (hsv.s < smin - EPS || hsv.s > R0.smax + EPS || hsv.v < vmin - EPS || hsv.v > R0.vmax + EPS) return false;
    return R0.lo == null || (R0.lo <= R0.hi ? hsv.h >= R0.lo - EPS && hsv.h <= R0.hi + EPS : hsv.h >= R0.lo - EPS || hsv.h <= R0.hi + EPS); };
  // what a colour reads as: a grey word if one fits, else the hued word whose middle is nearest
  const readAs = hsv => { const g = Object.keys(GREY).find(w => fits(w, null, hsv)); if (g) return g;
    const mid = w => { const [lo, hi] = HUE[w]; return lo <= hi ? (lo + hi) / 2 : 0; }, far = w => { const d = Math.abs(hsv.h - mid(w)) % 360; return Math.min(d, 360 - d); };
    const ok = Object.keys(HUE).filter(w => fits(w, null, hsv)).sort((a, b) => far(a) - far(b)); return ok[0] || `hue ${Math.round(hsv.h)}°`; };
  // a colour word that names a channel ("red level", "green sensor") is not a claim about the mark's colour
  const CHANNEL = 'levels?|sensors?|channels?|readings?|light|share|part|signal|values?|axis|intensity|counts?';
  const WORD = new RegExp(`\\b(?:(dark|light|pale)[\\s-]+)?(${[...Object.keys(GREY), ...Object.keys(HUE)].join('|')})\\b(?![\\s-]+(?:${CHANNEL})\\b)`, 'gi');
  // the colour words in a text that do not fit the colour: numbers ({{…}}) and maths ($…$) are left out
  const wrongWords = (t, hex) => { const hsv = hsvOf(hex), bad = []; String(t ?? '').replace(/\{\{[^}]*\}\}|\$[^$]*\$/g, ' ').replace(WORD, (m, mod, w) => { if (!fits(w.toLowerCase(), mod && mod.toLowerCase(), hsv)) bad.push(m); return m; }); return bad; };
  // ---------- one colour per symbol: a notation keeps its colour wherever it appears, so the eye can track it ----------
  // A symbol's own `color` wins. One with none takes the next unused colour at boot, in the order the lesson lists them;
  // operators are left out, a symbol that is a whole expression stays ink, and when the five run out the rest stay ink. An ink symbol is
  // still ink everywhere: it does not take the grey of the card it stands on
  const PALETTE = ['s1', 's2', 's3', 's4', 's5'], ARGS = new Set(['\\htmlClass', '\\text', '\\textbf', '\\mathrm', '\\operatorname', '\\begin', '\\end', '\\color', '\\textcolor']);
  const KERN = /^\\(?:mkern|mskip|kern|hskip|mspace)$/;
  const atomic = t => !/[\s+=]|.-/.test(t);
  let book = null;
  const bookOf = () => { const S = L.deck && L.deck.symbols; if (!S) return null; if (book && book.S === S) return book;
    const texOf = q => S[q].tex || L.autoSym(q), used = new Set(Object.values(S).map(x => x.color)), free = PALETTE.filter(c => !used.has(c));
    Object.keys(S).forEach(q => { if (!S[q].color && S[q].kind !== 'operator') S[q].color = atomic(texOf(q)) && free.length ? free.shift() : 'ink'; });
    const names = Object.keys(S).filter(q => S[q].color && S[q].kind !== 'operator' && atomic(texOf(q)));
    book = { S, list: names.map(q => ({ q, tex: texOf(q) })).sort((a, b) => b.tex.length - a.tex.length), index: Object.fromEntries(names.filter(q => S[q].kind === 'index').map(q => [texOf(q), q])) };
    return book; };
  const closeOf = (t, i) => { if (t[i] !== '{') return i; for (let d = 0, j = i; j < t.length; j++) { if (t[j] === '\\') j++; else if (t[j] === '{') d++; else if (t[j] === '}' && !--d) return j + 1; } return t.length; };
  // each symbol's TeX, wrapped in a class: the longest match first, never inside a command's name or a word, and index letters inside _{ij}
  const paint = tex => { const B = bookOf(); if (!B || !B.list.length) return tex; let out = '', i = 0; const cls = (q, t) => `\\htmlClass{sy sy-${q}}{${t}}`;
    while (i < tex.length) {
      const hit = B.list.find(x => tex.startsWith(x.tex, i)); if (hit) { out += cls(hit.q, hit.tex); i += hit.tex.length; continue; }
      if (tex[i] === '\\') { const w = /^\\(?:[A-Za-z]+\*?|[\s\S])/.exec(tex.slice(i))[0]; out += w; i += w.length; if (ARGS.has(w)) { let e = closeOf(tex, i); if (w === '\\begin') e = closeOf(tex, e); out += tex.slice(i, e); i = e; }
        else if (KERN.test(w)) { const z = /^\s*-?[\d.]+\s*[a-z]{2}/.exec(tex.slice(i)); if (z) { out += z[0]; i += z[0].length; } }   // \mkern-1mu: its size is not a symbol
        continue; }   // an array's column letters too
      const m = tex[i] === '_' && /^_(?:\{([a-z](?:,?[a-z])*)\}|([a-z]))/.exec(tex.slice(i));
      if (m && [...(m[1] ?? m[2])].every(c => c === ',' || B.index[c])) { out += `_{${[...(m[1] ?? m[2])].map(c => B.index[c] ? cls(B.index[c], c) : c).join('')}}`; i += m[0].length; continue; }
      out += tex[i++]; }
    return out; };
  // all math on the page comes through here, the deck's matrix cards too
  const renderTex = L.renderTex;
  L.renderTex = (el, tex, display) => { const ok = renderTex(el, paint(tex), display); const B = bookOf();
    if (B) el.querySelectorAll('.sy').forEach(e => { const x = B.S[[...e.classList].find(c => c.startsWith('sy-')).slice(3)]; if (x) e.style.color = col(x.color); });
    if (B) el.querySelectorAll('.lt, .mt').forEach(tg => { const sym = B.S[termOf(tg)]; if (!sym || !sym.says) return;   // a formula's term, or \mat's brackets: one term with its card
      tg.classList.add('vt', 'says'); tg.tabIndex = 0; glow(tg, hue(sym.color)); tg.setAttribute('aria-description', L.plain(String(sym.says))); pauseButton(); });
    return ok; };
  const termOf = el => { const cl = [...el.classList].find(k => k.startsWith('lt-') || k.startsWith('mt-')); return cl ? cl.slice(3) : null; };
  const hue = c => !c || c === 'ink' ? 'var(--mist)' : col(c);   // an ink symbol's card and glow are grey
  // the glow's colour, worked out once per colour as a plain rgba: a filter cannot take a colour built from nested var()s
  const glows = {};
  const glow = (el, c) => { if (!(c in glows)) { const probe = document.createElement('span'); probe.style.color = c; document.body.appendChild(probe);
      const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(probe).color); probe.remove(); const [r, g, b] = m ? m[1].split(',').map(Number) : [162, 159, 151]; glows[c] = `rgba(${r}, ${g}, ${b}, 0.45)`; }
    el.style.setProperty('--hc', c); el.style.setProperty('--hg', glows[c]); };

  // ---------- pop-up cards: one look for every name on a board (a formula's term, a matrix, a plane mark, a legend entry, a control's label) ----------
  // The title line is the notation in its colour, the bold `short` name and its value now (a number); then `says`; then its
  // shape, worked out from the data. The card is a little see-through over a blur, framed in the term's colour, and as wide as its widest line.
  // It opens on point, tap, click or Tab; a click pins it. Pointing at a term lifts it (brighter, a glow in its colour), and the
  // rest of its formula fades. Its text fills only while open, so the page audit never reads it. Listeners sit on the document,
  // because a formula is drawn again when a slider moves
  let card = null, cur = null, pinned = null;
  const slideOf = el => (L.slides || []).find(sl => sl.r && sl.r.node && sl.r.node.contains(el));
  const symCard = (el, q0) => { const q = q0 ?? termOf(el), B = bookOf(), S = (B && B.S[q]) || {}, sl = slideOf(el), scope = sl ? sl.ctx.scope : {}, v = scope[q];
    let shape = null, value = null;
    if (S.kind === 'matrix' || S.kind === 'vector') { if (Array.isArray(v)) shape = Array.isArray(v[0]) ? `${v.length} × ${v[0].length}` : el.closest('.mrow') ? `1 × ${v.length}` : `${v.length} × 1`; }
    else if (S.kind !== 'index' && S.kind !== 'operator' && typeof v === 'number') { value = L.fmt(v, S.fmt ?? 's4'); shape = 'one number'; }
    return { tex: S.tex || L.autoSym(q), c: hue(S.color), ink: !S.color || S.color === 'ink', name: S.short, says: S.says, value, shape, scope }; };
  // the card as wide as its widest line, so its left and right padding match
  const fitCard = k => { k.style.width = ''; const r = k.getBoundingClientRect(), rg = document.createRange(), wk = document.createTreeWalker(k, NodeFilter.SHOW_TEXT); let max = r.left;
    while (wk.nextNode()) { if (wk.currentNode.parentElement.closest('.katex-mathml')) continue; rg.selectNodeContents(wk.currentNode); for (const q of rg.getClientRects()) if (q.width) max = Math.max(max, q.right); }
    k.querySelectorAll('.katex-html, svg, .chip').forEach(q => { max = Math.max(max, q.getBoundingClientRect().right); });
    const cs = getComputedStyle(k); k.style.width = Math.ceil(max - r.left + parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth)) + 'px'; };
  // a KaTeX span is one line tall, so a term's box is the union of what it draws (a tall bracket, a fraction)
  // (a plain start box: a DOMRect's edges are getters, lost when spread, as for a flat line with nothing tall inside it)
  const termBox = el => { const b0 = el.getBoundingClientRect(), r = [el, ...el.querySelectorAll('*')].map(e => e.getBoundingClientRect()).filter(q => q.width && q.height)
    .reduce((u, q) => ({ left: Math.min(u.left, q.left), right: Math.max(u.right, q.right), top: Math.min(u.top, q.top), bottom: Math.max(u.bottom, q.bottom) }), { left: b0.left, right: b0.right, top: b0.top, bottom: b0.bottom });
    return { ...r, width: r.right - r.left, height: r.bottom - r.top }; };
  // under the term, its pointer at the term's middle; above it when there is more room there; always inside the window
  const place = (k, el) => { k.style.left = '0px'; k.style.top = '0px'; fitCard(k);
    const r = termBox(el), w = k.offsetWidth, hh = k.offsetHeight, gap = 9, vw = document.documentElement.clientWidth, mid = r.left + r.width / 2;
    const below = innerHeight - r.bottom - gap, above = r.top - gap, up = below < hh && (above >= hh || above > below), x = Math.max(6, Math.min(vw - 6 - w, mid - 22));
    const y = Math.max(6, Math.min(innerHeight - 6 - hh, up ? r.top - gap - hh : r.bottom + gap));
    k.classList.toggle('up', up); k.querySelector('.caret').style.left = Math.max(6, Math.min(w - 18, mid - x - 6)) + 'px';
    k.style.left = x + scrollX + 'px'; k.style.top = y + scrollY + 'px'; at = [r.left, r.top, r.right, r.bottom].map(Math.round).join();
    // keyboard focus: one ring round the whole term (an outline on a KaTeX span breaks into a box per piece)
    if (!ring) { ring = h('div', 'vring'); document.body.appendChild(ring); }
    const kb = document.activeElement === el && el.matches(':focus-visible'); ring.classList.toggle('on', kb);
    if (kb) Object.assign(ring.style, { left: r.left - 4 + scrollX + 'px', top: r.top - 4 + scrollY + 'px', width: r.width + 8 + 'px', height: r.height + 8 + 'px' }); };
  const undim = () => { document.querySelectorAll('.board .dm').forEach(e => e.classList.remove('dm')); if (cur) cur.classList.remove('act'); };
  // the rest of the formula fades: every other piece of its maths, at each level from the term up to the formula
  const dim = el => { const m = el.closest('.math'), root = el.closest('.katex-html'); if (!m || !root) return;
    m.querySelectorAll('.katex-html').forEach(kh => { if (kh !== root) kh.classList.add('dm'); });
    for (let n = el; n !== root; n = n.parentElement) [...n.parentElement.children].forEach(sib => { if (sib !== n) sib.classList.add('dm'); }); };
  // where the open term sits, so a redraw (a slider, a run, a resize, a font, a plane laid out again) finds the same one:
  // its kind of term and its place among the page's terms of that kind
  const keyOf = el => el.dataset && el.dataset.vk ? `vk:${el.dataset.vk}` : termOf(el) ? [...el.classList].find(k => /^(lt|mt)-/.test(k)) : `mk:${el.textContent}`;
  const sameAs = key => [...document.querySelectorAll('.vt')].filter(x => keyOf(x) === key);
  let where = null, sig = '', at = '', ticker = 0, focused = false, ring = null;
  const sigOf = d => JSON.stringify([d.tex, d.name, d.value, d.shape, d.c, L.plain(String(d.says || ''), d.scope || {})]);
  const tick = () => { if (!cur) { clearInterval(ticker); ticker = 0; return; }
    const was = pinned, wasF = focused;
    if (!cur.isConnected) { const el = where && sameAs(where.key)[where.i]; if (!el) { popHide(); return; }
      popShow(el); if (was) pinned = el; if (wasF) { el.focus({ preventScroll: true }); focused = true; } return; }
    const d = cur._pd ? cur._pd() : symCard(cur), r = termBox(cur);
    if (sigOf(d) !== sig) { popShow(cur); if (was) pinned = cur; }
    else if ([r.left, r.top, r.right, r.bottom].map(Math.round).join() !== at) place(card, cur); };
  const popHide = () => { undim(); if (ring) ring.classList.remove('on'); if (card) { card.classList.remove('on'); card.innerHTML = ''; } cur = pinned = where = null; focused = false; };
  const popShow = el => {
    if (el.closest('[data-step]:not(.shown)')) return;
    undim(); const d = el._pd ? el._pd() : symCard(el);
    const key = keyOf(el); where = { key, i: sameAs(key).indexOf(el) }; sig = sigOf(d); focused = document.activeElement === el;
    if (!ticker) ticker = setInterval(tick, 150);
    if (!card) { card = h('div', 'vpop'); card.setAttribute('role', 'tooltip'); document.body.appendChild(card); }
    cur = el; el.classList.add('act'); dim(el); card.style.setProperty('--bc', d.c);
    card.innerHTML = `<div class="ttl">${d.swatch || (d.tex != null ? '<span class="nt"></span>' : '')}${d.name ? `<b>${md(d.name)}</b>` : ''}${d.value != null ? `<span class="vv">= ${L.esc(d.value)}</span>` : ''}</div>` +
      `${d.says ? `<div class="ds">${md(d.says)}</div>` : ''}${d.shape ? `<span class="chip">${L.esc(d.shape)}</span>` : ''}<i class="caret"></i>`;
    const nt = card.querySelector('.nt'); if (nt) { renderTex(nt, d.tex, false); nt.style.color = d.ink ? 'var(--ink)' : d.c; }
    L.fill(card, d.scope || {}); card.classList.add('on'); place(card, el); };
  const vt = e => e && e.closest ? e.closest('.vt') : null;
  // a redraw under a still pointer sends a mouseover to the new drawing: leave that to tick, which keeps the focus
  document.addEventListener('mouseover', e => { const tg = vt(e.target); if (tg && tg !== cur && !hoverOff && !pinned && !(cur && !cur.isConnected)) popShow(tg); });
  document.addEventListener('mouseout', e => { const tg = vt(e.target); if (tg && tg === cur && !tg.contains(e.relatedTarget) && pinned !== tg && document.activeElement !== tg) popHide(); });
  document.addEventListener('focusin', e => { const tg = vt(e.target); if (tg && tg !== cur) popShow(tg); });
  document.addEventListener('focusout', e => { const tg = vt(e.target); if (tg && tg === cur && pinned !== tg && tg.isConnected) requestAnimationFrame(() => { if (cur === tg && tg.isConnected && document.activeElement !== tg) popHide(); }); });
  // a tap focuses the term (which opens the card) and then clicks it, so the click pins it open rather than toggling
  document.addEventListener('click', e => { const tg = vt(e.target);
    if (tg) { if (pinned === tg) { popHide(); tg.blur(); } else { if (cur !== tg) popShow(tg); if (cur === tg) pinned = tg; } }
    else if (cur && !(card && card.contains(e.target))) popHide(); });
  // Escape closes an open card wherever it came from; pausing closes one that pointing opened; a redraw that drops the term closes it
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && cur) { const el = cur; popHide(); if (document.activeElement === el) el.blur(); } });
  document.addEventListener('vizos-hoverpause', () => { if (hoverOff && cur && cur !== pinned && document.activeElement !== cur) popHide(); });
  const BEAT = { 'by-hand': 'By hand', 'what-if': 'What if', misconception: 'A common mix-up' };
  const beatLabel = b => BEAT[b] || (b ? b[0].toUpperCase() + b.slice(1).replace(/-/g, ' ') : '');

  // ---------- worked lines: formula = numbers = result, each input in its colour ----------
  // The symbol, its number and the table cell it came from are written in the symbol's colour. Restraint: colour the text, never box or underline it.
  const symOf = (ctx, n) => { const s = (ctx.symbols || {})[n]; return s && s.tex ? s.tex : L.autoSym(n); };
  const shortOf = (ctx, n) => { const s = (ctx.symbols || {})[n]; return (s && (s.short || s.says)) || n; };
  const subFmt = (ctx, n, v, own) => own ?? (((ctx.symbols || {})[n] || {}).fmt) ?? (Number.isInteger(v) ? ',' : 's4');   // as the deck's calc
  // every \htmlClass{lt lt-<name>} span of a part takes its colour
  const tint = (part, colorOf) => part.querySelectorAll('.lt').forEach(sp => {
    const c = colorOf([...sp.classList].find(x => x.startsWith('lt-')).slice(3)); if (c) { sp.classList.add('tc'); sp.style.setProperty('--tc', c); } });
  // a worked line takes its full size if it fits, else it drops until it does, down to the floor. Every part keeps one size, so the line stays even
  const FLOOR = 20, wideOf = m => Math.max(0, ...[...m.querySelectorAll('.katex')].filter(k => !k.closest('.wkey')).map(k => k.getBoundingClientRect().width));
  const fitMath = ms => { ms.forEach(m => { m.style.fontSize = ''; }); const k = Math.min(1, ...ms.map(m => { const w = wideOf(m); return w && m.clientWidth ? m.clientWidth / w : 1; }));
    if (k < 1) ms.forEach(m => { m.style.fontSize = Math.max(FLOOR, Math.floor(parseFloat(getComputedStyle(m).fontSize) * k * 2) / 2) + 'px'; }); };
  // ---------- plane: one scale for both axes, so a slope and a right angle look like what they are ----------
  const niceStep = span => { const raw = span / 5, p = 10 ** Math.floor(Math.log10(raw)); return [1, 2, 5, 10].map(m => m * p).find(s => s >= raw) || p * 10; };
  // the part of the box where w0 + w1 x + w2 y has the given sign (Sutherland–Hodgman on the four corners)
  function halfBox(w, box, sign) {
    const f = ([x, y]) => sign * (w[0] + w[1] * x + w[2] * y), [x0, x1, y0, y1] = box;
    const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], out = [];
    pts.forEach((p, i) => { const q = pts[(i + 1) % 4], fp = f(p), fq = f(q);
      if (fp >= 0) out.push(p);
      if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); } });
    return out;
  }
  // where the line w0 + w1 x + w2 y = 0 crosses the box: two points, or null when it misses
  function clipLine(w, box) {
    const [x0, x1, y0, y1] = box, hit = [];
    const add = (x, y) => { if (x >= x0 - 1e-9 && x <= x1 + 1e-9 && y >= y0 - 1e-9 && y <= y1 + 1e-9 && !hit.some(p => Math.hypot(p[0] - x, p[1] - y) < 1e-6)) hit.push([x, y]); };
    if (w[2]) { add(x0, -(w[0] + w[1] * x0) / w[2]); add(x1, -(w[0] + w[1] * x1) / w[2]); }
    if (w[1]) { add(-(w[0] + w[2] * y0) / w[1], y0); add(-(w[0] + w[2] * y1) / w[1], y1); }
    return hit.length >= 2 ? hit.slice(0, 2) : null;
  }

  // a legend or card swatch per kind of mark: a line, a dashed line, an arrow, a dot, a soft block
  const SWATCH = { line: '<line x1="1" y1="6" x2="23" y2="6" style="stroke:C;stroke-width:3"/>', dash: '<line x1="1" y1="6" x2="23" y2="6" style="stroke:C;stroke-width:2.5;stroke-dasharray:5 3"/>',
    arrow: '<line x1="1" y1="6" x2="15" y2="6" style="stroke:C;stroke-width:3"/><polygon points="23,6 14,1.5 14,10.5" style="fill:C"/>', dot: '<circle cx="12" cy="6" r="5" style="fill:C;stroke:none"/>', ring: '<circle cx="12" cy="6" r="4.5" style="fill:none;stroke:C;stroke-width:2"/>',
    centre: '<circle cx="12" cy="6" r="5" style="fill:none;stroke:C;stroke-width:2"/><path d="M9.5 6h5M12 3.5v5" style="stroke:C;stroke-width:1.8;stroke-linecap:round"/>', area: '<rect x="3" y="1" width="18" height="10" style="fill:C;fill-opacity:.45"/>',
    ruler: '<polyline points="2,2 2,9 22,9 22,2" style="fill:none;stroke:C;stroke-width:2"/><line x1="12" y1="4" x2="12" y2="9" style="stroke:C;stroke-width:2"/>' };
  const swatch = (kind, c) => `<svg width="24" height="12" viewBox="0 0 24 12">${(SWATCH[kind] || SWATCH.line).replace(/C/g, c)}</svg>`;

  function plane(p, ctx, clickOf, at) {
    const node = h('div', p.fill ? 'bi plane fr fill' : 'bi plane fr'); node.dataset.at = at;
    if (p.id) node.dataset.id = p.id;
    const leg = h('div', 'plegend'); node.appendChild(leg);
    const wrap = h('div', 'pwrap'); node.appendChild(wrap);
    const svg = sv('svg', { class: 'pl' }, wrap);
    const R = { node, issues: [], kind: 'plane', w: 0, h: 0, leg: LEG, view: null, linked: new Set(), cols: [], wlOn: null, hotM: null };
    const num = (x, where) => L.val(x, ctx.scope, where);
    // `says`: the name or legend entry opens the board's pop-up card (see pop-up cards), with the mark's swatch for notation
    const SW = SWATCH;
    const tipOn = (el, mk, c, kind) => {
      el.classList.add('says', 'vt'); el.setAttribute('tabindex', '0'); glow(el, c === 'var(--ink)' ? 'var(--mist)' : c); el.setAttribute('aria-description', L.plain(String(mk.says), ctx.scope)); pauseButton();
      el._pd = () => ({ swatch: `<svg width="24" height="12" viewBox="0 0 24 12">${(SW[kind] || SW.line).replace(/C/g, c)}</svg>`, c: c === 'var(--ink)' ? 'var(--mist)' : c, name: mk.name ?? mk.label, says: mk.says, shape: kind === 'dot' || kind === 'centre' ? 'one point' : null, scope: ctx.scope }); };
    const m = { l: 62, r: 18, t: 14, b: 60 }, boxOf = () => { const X = p.x || {}, Y = p.y || {}; return [num(X.min ?? 0), num(X.max ?? 10), num(Y.min ?? 0), num(Y.max ?? 10)]; };
    // the picture takes its room. An equal plane keeps one scale on both axes and shows more of the plane on both sides, so the
    // data stay at true scale in any shape. With `fill` the plot holds 16:9, going to 2:1 if the window is short, each axis at its own scale
    R.size = room => { const b = boxOf(), ah = room.h - PAD - R.leg, aw = aim(room, ah) - PAD, hh = Math.min(ah, aw / SHAPE), ww = p.fill ? Math.min(aw, hh * WIDEST) : aw;
      R.w = Math.round(ww); R.h = Math.round(hh); node.style.width = R.w + 'px'; wrap.style.width = R.w + 'px'; wrap.style.height = R.h + 'px';
      const gw = R.w - m.l - m.r, gh = R.h - m.t - m.b, xs = b[1] - b[0], ys = b[3] - b[2], u = Math.min(gw / xs, gh / ys), cx = (b[0] + b[1]) / 2, cy = (b[2] + b[3]) / 2;
      R.view = p.fill ? b : [cx - gw / u / 2, cx + gw / u / 2, cy - gh / u / 2, cy + gh / u / 2]; return R.w + PAD; };
    R.layout = () => {
      svg.innerHTML = ''; leg.innerHTML = ''; R.issues = []; R.later = [];
      const W = R.w, H = R.h; if (W < 40 || H < 40) { R.issues.push('the picture has no room'); return; }
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const X = p.x || {}, Y = p.y || {}, own = boxOf(), box = R.view || own;
      const pw = W - m.l - m.r, ph = H - m.t - m.b, ux = pw / (box[1] - box[0]), uy = ph / (box[3] - box[2]);        // pixels per unit: the same on both axes, unless the plane has `fill`
      const gw = pw, gh = ph, ox = m.l, oy = m.t, shape = (own[1] - own[0]) / (own[3] - own[2]);                     // the shape limit reads the author's ranges
      if (!p.fill && (shape < .6 || shape > 1.8)) R.issues.push(`a plane is ${shape.toFixed(2)} wide per 1 tall: its width over height must stay between 0.6 and 1.8, so change its x and y ranges or the spacing of what it shows`);
      const sx = x => ox + (x - box[0]) * ux, sy = y => oy + gh - (y - box[2]) * uy;
      R.unit = [ux, uy];
      const grid = sv('g', { class: 'pgrid' }, svg);
      const short = Math.min(box[1] - box[0], box[3] - box[2]), tx = niceStep(p.fill ? box[1] - box[0] : short), ty = niceStep(p.fill ? box[3] - box[2] : short);
      for (let v = Math.ceil(box[0] / tx) * tx; v <= box[1] + 1e-9; v += tx) { sv('line', { x1: sx(v), x2: sx(v), y1: oy, y2: oy + gh }, grid); sv('text', { class: 'tick', x: sx(v), y: oy + gh + 26, 'text-anchor': 'middle' }, grid).textContent = L.fmt(+v.toFixed(6) + 0); }
      for (let v = Math.ceil(box[2] / ty) * ty; v <= box[3] + 1e-9; v += ty) { sv('line', { x1: ox, x2: ox + gw, y1: sy(v), y2: sy(v) }, grid); sv('text', { class: 'tick', x: ox - 12, y: sy(v) + 7, 'text-anchor': 'end' }, grid).textContent = L.fmt(+v.toFixed(6) + 0); }
      sv('rect', { class: 'pbox', x: ox, y: oy, width: gw, height: gh }, svg);
      if (X.label) sv('text', { class: 'axt', x: ox + gw / 2, y: oy + gh + 54, 'text-anchor': 'middle' }, svg).textContent = L.plain(X.label, ctx.scope);
      if (Y.label) sv('text', { class: 'axt', x: 0, y: 0, 'text-anchor': 'middle', transform: `translate(${ox - 44} ${oy + gh / 2}) rotate(-90)` }, svg).textContent = L.plain(Y.label, ctx.scope);
      const legend = [], dots = [], placed = [], segs = [], fills = [], inBox = (x, y) => x >= own[0] - 1e-9 && x <= own[1] + 1e-9 && y >= own[2] - 1e-9 && y <= own[3] + 1e-9;
      const pt = (v, where) => list(v).map(x => num(x, where));
      // a name beside its dot: the first spot that clears every dot, line and name already placed; none clear is an issue
      const cross = (b, [X0, Y0, X1, Y1]) => { const n = Math.ceil(Math.hypot(X1 - X0, Y1 - Y0) / 4);
        for (let q = 0; q <= n; q++) { const x = X0 + (X1 - X0) * q / n, y = Y0 + (Y1 - Y0) * q / n; if (x > b.x0 - 3 && x < b.x1 + 3 && y > b.y0 - 3 && y < b.y1 + 3) return true; } return false; };
      // a name would rather sit outside a filled square than on its fill: a box whose middle is inside one is a last resort
      const inside = (x, y, P) => { let c = false; for (let a = 0, z = P.length - 1; a < P.length; z = a++) if ((P[a][1] > y) !== (P[z][1] > y) && x < (P[z][0] - P[a][0]) * (y - P[a][1]) / (P[z][1] - P[a][1]) + P[a][0]) c = !c; return c; };
      const filled = b => fills.some(P => inside((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, P));
      const hit = b => placed.some(q => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0) || dots.some(([cx, cy, r = 11]) => cx + r > b.x0 && cx - r < b.x1 && cy + r > b.y0 && cy - r < b.y1) || segs.some(sg => cross(b, sg));
      // `spots` (centre points, for a vector's middle) replace the spots round a tip; `mk` with `says` makes the name open its pop-up
      const name = (t, cx, cy, g, cls, free, spots, mk, c, kind) => { t = L.plain(String(t ?? ''), ctx.scope); if (!t) return; const tw = t.length * 11 + 4;
        const box = (x0, y, end) => ({ x0, x1: x0 + tw, y0: y - 16, y1: y + 4, tx: end ? x0 + tw : x0, ty: y, end });   // `end`: right-aligned, so a name left of its dot never runs into it
        const opts = spots ? spots.map(([x, y]) => box(x - tw / 2, y + 6)) : [...(free ? [[-tw / 2, 6, 2]] : []), [14, -10, 0], [14, 22, 0], [-14, -10, 1], [-14, 22, 1], [-tw / 2, -16, 2], [-tw / 2, 32, 2], [27, -16, 0], [27, 30, 0], [-27, -16, 1], [-27, 30, 1], [-tw / 2, -28, 2], [-tw / 2, 44, 2]].map(([dx, dy, a]) => box(a === 1 ? cx + dx - tw : cx + dx, cy + dy, a === 1));
        let b = opts.find(o => !hit(o) && !filled(o)) || opts.find(o => !hit(o)); if (!b) { b = opts[0]; R.issues.push(`the plane label "${t}" overlaps another label or dot`); } placed.push(b);
        const el = sv('text', { class: cls || 'plab', x: b.tx, y: b.ty, 'text-anchor': b.end ? 'end' : 'start' }, g); el.textContent = t;
        if (mk && mk.says) tipOn(el, mk, c, kind); };
      const seg = (a, b, g, c, dash) => sv('line', { x1: sx(a[0]), y1: sy(a[1]), x2: sx(b[0]), y2: sy(b[1]), style: `stroke:${c};stroke-width:${wOf(c)};stroke-linecap:round${dash ? ';stroke-dasharray:10 8' : ''}` }, g);
      // a foot: the point q, its projection f on the line (or direction), the line's direction d, and the right-angle tick in pixels
      const footOf = (F, where) => { if (!F || !F.from || !(F.line || F.dir)) return null; const q = pt(F.from, where); let f, d;
        if (F.line) { const w = pt(F.line, where), nn = w[1] * w[1] + w[2] * w[2], k = (w[0] + w[1] * q[0] + w[2] * q[1]) / nn; f = [q[0] - k * w[1], q[1] - k * w[2]]; d = [-w[2], w[1]]; }
        else { d = pt(F.dir, where); const dd = d[0] * d[0] + d[1] * d[1], k = (q[0] * d[0] + q[1] * d[1]) / dd; f = [k * d[0], k * d[1]]; }
        const Ld = Math.hypot(d[0], -d[1]) || 1, ax = d[0] / Ld, ay = -d[1] / Ld, Lq = Math.hypot(sx(q[0]) - sx(f[0]), sy(q[1]) - sy(f[1])); let tick = null;
        if (Lq > 20) { const bx = (sx(q[0]) - sx(f[0])) / Lq, by = (sy(q[1]) - sy(f[1])) / Lq, r = 12, X = sx(f[0]), Y = sy(f[1]), A = [X + ax * r, Y + ay * r], B = [A[0] + bx * r, A[1] + by * r], C = [X + bx * r, Y + by * r];
          tick = [[...A, ...B], [...B, ...C]]; }
        return { q, f, tick }; };
      // spots beside the middle of a drawn line from (X0, Y0) to (X1, Y1), off to either side; a line too short to have a middle gets null,
      // so its name takes the spots round a point instead
      const midSpots = (X0, Y0, X1, Y1) => { const L0 = Math.hypot(X1 - X0, Y1 - Y0); if (L0 < 1) return null;
        const ux = (X1 - X0) / L0, uy = (Y1 - Y0) / L0, MX = (X0 + X1) / 2, MY = (Y0 + Y1) / 2, spots = [];
        [20, 32, 46].forEach(d => [0, -.2, .2].forEach(t => [1, -1].forEach(s => spots.push([MX - uy * d * s + ux * L0 * t, MY + ux * d * s + uy * L0 * t])))); return spots; };
      const outside = (i, kind, ...ps) => { if (ps.some(([x, y]) => !inBox(x, y))) R.issues.push(`plane mark ${i + 1} (${kind}) is outside the box: widen x/y or move it`); };
      const key = (mk, c, kind, st) => { if (mk.label) legend.push({ text: mk.label, c, kind, st, mk }); };   // `name` sits beside the mark, `label` in the legend: a mark may have both
      // dots, named points and lines first, so every name placed after them clears them
      list(p.marks).forEach(mk => { const where = `slide ${ctx.index + 1} plane`; if (mk.when != null && !num(mk.when, where)) return;
        if (mk.points) list(L.val(mk.points.from, ctx.scope, where)).forEach(r => dots.push([sx(r[mk.points.x]), sy(r[mk.points.y])]));
        if (mk.point) { const [x, y] = pt(mk.point, where); dots.push(mk.centre ? [sx(x), sy(y), 17] : [sx(x), sy(y)]); }
        if (mk.ring) { const [x, y] = pt(mk.ring, where); dots.push([sx(x), sy(y), 23]); }
        const L2 = mk.line ? clipLine(pt(mk.line, where), box) : mk.segment ? list(mk.segment).map(q => pt(q, where)) : null;
        if (L2) segs.push([sx(L2[0][0]), sy(L2[0][1]), sx(L2[1][0]), sy(L2[1][1])]);
        if (mk.shade) { const e = clipLine(pt(mk.shade, where), box); if (e) segs.push([sx(e[0][0]), sy(e[0][1]), sx(e[1][0]), sy(e[1][1])]); }   // a shaded half's edge
        if (mk.foot) { const ft = footOf(mk.foot, where); if (ft) { segs.push([sx(ft.q[0]), sy(ft.q[1]), sx(ft.f[0]), sy(ft.f[1])]); if (ft.tick) segs.push(...ft.tick); } }   // the drop and its right-angle tick
        if (mk.vector) { const o = mk.from ? pt(mk.from, where) : [0, 0], v = pt(mk.vector, where); segs.push([sx(o[0]), sy(o[1]), sx(o[0] + v[0]), sy(o[1] + v[1])]); }   // names clear the arrows too
        if (mk.square) { const [a, b] = list(mk.square).map(q => pt(q, where)), sg = mk.side === 'right' ? -1 : 1, dx = b[0] - a[0], dy = b[1] - a[1];
          const cs = [a, b, [b[0] - sg * dy, b[1] + sg * dx], [a[0] - sg * dy, a[1] + sg * dx]]; fills.push(cs.map(q => [sx(q[0]), sy(q[1])])); cs.forEach((q, j) => { const r = cs[(j + 1) % 4]; segs.push([sx(q[0]), sy(q[1]), sx(r[0]), sy(r[1])]); }); } });
      // a mark drawn in a true colour (a hex, or rgb) must not carry a colour word that does not fit it. The check runs on every
      // redraw, so it sees the colour under any slider; a word that is wrong only away from the start names the control
      const ctls = ((ctx.deck.slides || [])[ctx.index] || {}).controls || [], moved = ctls.filter(c => c && ctx.scope[c.name] !== +(c.value ?? c.min));
      if (!moved.length) R.startBad = new Set();
      // on a points mark (`row` given) a channel written as a bare name is that row's key, never a lesson-wide value of that name
      const rgbOf = (spec, x, y, sc, where, i, row, j, who) => { const o = spec && typeof spec === 'object' && !Array.isArray(spec), gone = [], at = q => q == null ? 0 : L.val(q, sc, where);
        const ch = (q, k) => { if (!row || q == null || !/^[A-Za-z_]\w*$/.test(String(q))) return at(q); const v = row[q]; if (typeof v !== 'number' || !Number.isFinite(v)) gone.push(`${k}: ${q}`); return v; };
        const lv = o ? [ch(spec.r, 'r'), ch(spec.g, 'g'), ch(spec.b, 'b')] : [x, y, 0], mx = o ? (spec.max == null ? 1 : at(spec.max)) : L.val(spec, sc, where);
        if (gone.length) { R.issues.push(`plane mark ${i + 1}: row ${j + 1}${who != null ? ` (${who})` : ''} has no number for rgb ${gone.join(', ')}: give every row that key`); return { hex: null, lv }; }
        if (![...lv, mx].every(Number.isFinite) || !(mx > 0)) { R.issues.push(`plane mark ${i + 1}: its rgb does not work out to numbers with a max above 0`); return { hex: '#000000', lv }; }
        return { hex: toHex(lv, mx), lv }; };
      // a word is checked only once its mark is shown (R.later holds its step); `j` keeps two dots with one label apart
      const trueCheck = (i, hex, lv, texts, st, j, who) => { if (!HEX.test(hex || '')) return;
        texts.forEach(([what, t]) => wrongWords(t, hex).forEach(wd => { const k = `${i}|${j ?? ''}|${what}|${t}|${wd}`, shown = lv ? `(${lv.map(q => L.fmt(q)).join(', ')}) ` : '';
          let msg = `plane mark ${i + 1}: ${what} “${t}” says ${wd}, but ${who != null ? `dot ${who}'s` : 'its'} colour ${shown}reads as ${readAs(hsvOf(hex))} (${hex.toLowerCase()})`;
          if (!moved.length) R.startBad.add(k);
          else if (!(R.startBad || new Set()).has(k)) msg += ` at ${moved.map(c => `${c.label ? L.plain(c.label, ctx.scope) + ' ' : ''}${c.name} = ${L.fmt(ctx.scope[c.name])}`).join(', ')}: name it by id, or by a word that stays true`;
          R.later.push({ st, msg }); })); };
      list(p.marks).forEach((mk, i) => {
        const where = `slide ${ctx.index + 1} plane mark ${i + 1}`;
        const g = sv('g', { class: 'pm', 'data-m': i }, svg); const st = mk.step != null ? clickOf(mk.step) : at; if (st > at) g.dataset.step = st;
        let c = mk.point && !mk.color ? 'var(--s1)' : col(mk.color), lv = null;   // a point with no colour is drawn in s1, and its legend swatch must match
        if (mk.when != null && !num(mk.when, where)) return;
        if (mk.point && mk.rgb != null) { const [x, y] = pt(mk.point, where); ({ hex: c, lv } = rgbOf(mk.rgb, x, y, ctx.scope, where, i)); }   // its legend dot takes the colour too
        R.cols[i] = mk.ring ? 'var(--accent)' : c; glow(g, R.cols[i]); if (witOf(R.cols[i]) && !mk.quarters) g.classList.add('wit');
        const nm = R.linked.has(i) ? null : mk.name;   // a word in the text names a linked mark: the figure carries no name for it
        if (!mk.points && !mk.text && !mk.ring) trueCheck(i, c, lv, [['name', mk.name], ['label', mk.label]], st);
        if (mk.shade) {
          const w = list(mk.shade).map(x => num(x, where)), poly = halfBox(w, box, mk.side === '-' ? -1 : 1);
          if (poly.length > 2) sv('polygon', { points: poly.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' '), style: `fill:${c};fill-opacity:.13` }, g);
          key(mk, c, 'area', st);
        } else if (mk.line) {
          const w = list(mk.line).map(x => num(x, where)), sg = clipLine(w, box);
          if (!sg) { if (mk.label) legend.push({ text: `${L.plain(mk.label, ctx.scope)} (outside the box)`, c, kind: mk.dash ? 'dash' : 'line', st }); return; }
          seg(sg[0], sg[1], g, c, mk.dash); key(mk, c, mk.dash ? 'dash' : 'line', st);
        } else if (mk.points) {
          const P = mk.points, rows = list(L.val(P.from, ctx.scope, where)), colors = P.colors || {};
          // with rgb, each dot takes its own row's colour (r, g, b are row keys, like x and y), so there is no colour key
          // the mark's own name and label must fit every dot; the first dot a word misses is reported
          const seen = new Set(), whole = (j, own, who) => trueCheck(i, own.hex, own.lv, [['name', mk.name], ['label', mk.label]].filter(([w, t]) => t != null && wrongWords(t, own.hex || '#000').length && !seen.has(w) && seen.add(w)), st, j, who);
          rows.forEach((r, j) => { const x = r[P.x], y = r[P.y], gk = P.by ? r[P.by] : null, who = P.label ? r[P.label] : null;
            if (!inBox(x, y)) R.issues.push(`point ${r[P.label] ?? ''} is outside the picture`);
            const own = mk.rgb != null ? rgbOf(mk.rgb, x, y, L.scope(ctx.scope, r), where, i, r, j, who) : { hex: colors[gk] && colors[gk].color || colors[gk] || mk.color || 'mist', lv: null };   // plain dots are neutral: s1 is a series colour, and a legend may give it a meaning
            if (P.label) trueCheck(i, own.hex, own.lv, [['dot', r[P.label]]], st, j);
            if (HEX.test(own.hex || '')) whole(j, own, who ?? `row ${j + 1}`);
            sv('circle', { cx: sx(x), cy: sy(y), r: 10, style: `fill:${col(own.hex)}` }, g); });
          if (P.label) rows.forEach(r => name(r[P.label], sx(r[P.x]), sy(r[P.y]), g));
          if (mk.rgb == null) Object.entries(colors).forEach(([k, v]) => { const hx = v && v.color || v; trueCheck(i, hx, null, [['label', (v && v.label) || k]], st); legend.push({ text: (v && v.label) || k, c: col(hx), kind: 'dot', st }); });
        } else if (mk.point) {
          const [x, y] = pt(mk.point, where); outside(i, 'point', [x, y]);
          // a centre (a mean, a cluster's centre) is a ring with a cross, so it never reads as one more data dot
          const X = sx(x), Y = sy(y), kd = mk.centre ? 'centre' : 'dot';
          if (mk.centre) { sv('circle', { cx: X, cy: Y, r: 13, style: `fill:var(--bg);fill-opacity:.7;stroke:${c};stroke-width:3` }, g);
            sv('path', { d: `M${X - 7},${Y}h14M${X},${Y - 7}v14`, style: `stroke:${c};stroke-width:3;stroke-linecap:round` }, g); }
          else sv('circle', { cx: X, cy: Y, r: 10, style: `fill:${c}` }, g);
          name(nm, X, Y, g, null, false, null, mk, c, kd); key(mk, c, kd, st);
        } else if (mk.segment) {
          const [a, b] = list(mk.segment).map(q => pt(q, where)); outside(i, 'segment', a, b);
          seg(a, b, g, c, mk.dash); if (nm) name(nm, sx((a[0] + b[0]) / 2), sy((a[1] + b[1]) / 2), g, null, false, midSpots(sx(a[0]), sy(a[1]), sx(b[0]), sy(b[1])), mk, c, mk.dash ? 'dash' : 'line'); key(mk, c, mk.dash ? 'dash' : 'line', st);
        } else if (mk.vector) {
          // an arrow from `from` (the origin by default) to from + vector, its head drawn in screen units
          const o = mk.from ? pt(mk.from, where) : [0, 0], v = pt(mk.vector, where), e = [o[0] + v[0], o[1] + v[1]]; outside(i, 'vector', o, e);
          const X0 = sx(o[0]), Y0 = sy(o[1]), X1 = sx(e[0]), Y1 = sy(e[1]), L0 = Math.hypot(X1 - X0, Y1 - Y0) || 1, ux = (X1 - X0) / L0, uy = (Y1 - Y0) / L0, w = wOf(c), hd = Math.min(18 * headOf(w), L0 / 2);
          sv('line', { x1: X0, y1: Y0, x2: X1 - ux * hd * .8, y2: Y1 - uy * hd * .8, style: `stroke:${c};stroke-width:${w};stroke-linecap:round` }, g);
          sv('polygon', { points: `${X1},${Y1} ${X1 - ux * hd - uy * hd * .55},${Y1 - uy * hd + ux * hd * .55} ${X1 - ux * hd + uy * hd * .55},${Y1 - uy * hd - ux * hd * .55}`, style: `fill:${c}` }, g);
          // its name beside the middle of the arrow, off to one side, so two arrows that end at one point keep their names apart;
          // an arrow of length 0 is a dot, so its name goes round that point
          name(nm, (X0 + X1) / 2, (Y0 + Y1) / 2, g, null, false, midSpots(X0, Y0, X1, Y1), mk, c, 'arrow'); key(mk, c, 'arrow', st);
        } else if (mk.foot) {
          // the projection of a point onto a line (w0 + w1 x + w2 y = 0) or onto a direction through the origin: a dashed drop and a right-angle tick
          const F = footOf(mk.foot, where); if (!F) return; const { q, f, tick } = F;
          outside(i, 'foot', q, f);
          seg(q, f, g, c, true); sv('circle', { cx: sx(f[0]), cy: sy(f[1]), r: 6, style: `fill:${c};stroke:none` }, g);
          if (tick) sv('polyline', { points: `${tick[0][0]},${tick[0][1]} ${tick[0][2]},${tick[0][3]} ${tick[1][2]},${tick[1][3]}`, style: `fill:none;stroke:${c};stroke-width:${wOf(c)}` }, g);
          // its name beside the middle of the drop, clear of the tick at the foot
          name(nm, sx(f[0]), sy(f[1]), g, null, false, midSpots(sx(q[0]), sy(q[1]), sx(f[0]), sy(f[1])), mk, c, 'dash'); key(mk, c, 'dash', st);
        } else if (mk.square) {
          // the square built on a segment (a squared distance you can see), on its left unless side: right
          const [a, b] = list(mk.square).map(q => pt(q, where)), sgn = mk.side === 'right' ? -1 : 1, dx = b[0] - a[0], dy = b[1] - a[1];
          const cs = [a, b, [b[0] - sgn * dy, b[1] + sgn * dx], [a[0] - sgn * dy, a[1] + sgn * dx]]; outside(i, 'square', ...cs);
          sv('polygon', { points: cs.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' '), style: `fill:${c};fill-opacity:.16;stroke:${c};stroke-width:${wOf(c)}` }, g); key(mk, c, 'area', st);
        } else if (mk.text) {
          const [x, y] = pt(mk.at, where); outside(i, 'text', [x, y]); name(mk.text, sx(x), sy(y), g, 'plab free', true);   // a free label: centred on its point first, in axis grey
        } else if (mk.quarters) {
          // the four quarters round the crossing of the zero lines: the two where (x − cx)(y − cy) > 0 washed, and the sign of each
          // quarter in its outer corner of the box, only when that quarter is at least 40 px each way (a crossing on or past an edge
          // leaves no room on that side). Under the box line and every mark, shown at the mark's own step; no name, legend, card or pointer
          const [x, y] = pt(mk.quarters, where); outside(i, 'quarters', [x, y]);
          const X0 = ox, X1 = ox + gw, Y0 = oy, Y1 = oy + gh, qx = Math.max(X0, Math.min(X1, sx(x))), qy = Math.max(Y0, Math.min(Y1, sy(y))), qg = sv('g', { class: 'pq' }); if (st > at) qg.dataset.step = st;
          svg.insertBefore(qg, svg.querySelector(':scope > .pbox'));
          [[1, 1], [-1, -1], [-1, 1], [1, -1]].forEach(([rx, up], j) => { const a = rx > 0 ? qx : X0, b = rx > 0 ? X1 : qx, t = up > 0 ? Y0 : qy, u = up > 0 ? qy : Y1;
            if (j < 2 && b > a && u > t) sv('rect', { x: a, y: t, width: b - a, height: u - t }, qg);
            if (b - a >= 40 && u - t >= 40) sv('text', { x: rx > 0 ? X1 - 14 : X0 + 14, y: up > 0 ? Y0 + 30 : Y1 - 14, 'text-anchor': rx > 0 ? 'end' : 'start' }, qg).textContent = j < 2 ? '+' : '\u2212'; });
        } else if (mk.ring) {
          const [x, y] = pt(mk.ring, where);
          sv('circle', { class: 'pring', cx: sx(x), cy: sy(y), r: 20 }, g);
        }
      });
      leg.style.paddingLeft = `${Math.max(0, ox - 8)}px`;   // the legend starts where the plot does
      legend.forEach(e => { const it = h('span', 'pk ' + e.kind); it.style.setProperty('--c', e.c); it.innerHTML = `<i></i><span>${md(e.text)}</span>`; if (e.st > at) it.dataset.step = e.st; leg.appendChild(it);
        if (e.mk && e.mk.says) tipOn(it.lastChild, e.mk, e.c, e.kind);
        const m = e.mk ? list(p.marks).indexOf(e.mk) : -1; if (m < 0) return; it.dataset.m = m; glow(it, e.c);
        ['pointerenter', 'focusin'].forEach(ev => it.addEventListener(ev, () => R.hover(m))); ['pointerleave', 'focusout'].forEach(ev => it.addEventListener(ev, () => R.hover(null))); });
      // a linked mark takes the pointer: a see-through copy of what it draws, a few pixels wider, under every name (so a name
      // with a card stays reachable), areas first so a line or dot on top of one wins. It lights the mark and its words, and opens its card
      const hl = sv('g', { class: 'phits' }); svg.insertBefore(hl, svg.querySelector(':scope > g.pm'));
      const rank = e => e.tagName === 'polygon' ? 0 : e.tagName === 'circle' ? 2 : 1;
      [...svg.querySelectorAll(':scope > g.pm')].filter(g => R.linked.has(+g.dataset.m)).flatMap(g => [...g.children].filter(e => e.tagName !== 'text').map(e => [g, e])).sort((a, b) => rank(a[1]) - rank(b[1])).forEach(([g, e]) => {
        const m = +g.dataset.m, mk = list(p.marks)[m], k = e.cloneNode(false), ring = e.tagName === 'circle';
        k.removeAttribute('class'); k.setAttribute('style', ring ? 'fill:transparent;stroke:none' : e.tagName === 'polygon' ? 'fill:transparent;stroke:transparent;stroke-width:10' : 'fill:none;stroke:transparent;stroke-width:16');
        if (ring) k.setAttribute('r', Math.max(14, +e.getAttribute('r') + 6)); k.dataset.m = m; if (g.dataset.step) k.dataset.step = g.dataset.step; hl.appendChild(k);
        k.addEventListener('pointerenter', () => R.hover(m)); k.addEventListener('pointerleave', () => R.hover(null));
        if (mk.says) { tipOn(k, mk, R.cols[m], mk.vector ? 'arrow' : mk.point ? 'dot' : mk.square || mk.shade ? 'area' : mk.foot || mk.dash ? 'dash' : 'line'); k.removeAttribute('tabindex'); } });
      R.paintWl();
      L.fill(leg, ctx.scope);
      const was = R.leg; R.leg = leg.offsetHeight + 6; return R.leg !== was;   // a legend on two rows takes its room from the plot: the caller sizes again
    };
    // a linked word (see the board): its mark's colour, and whether the mark is drawn at this stop
    const gOf = i => svg.querySelector(`:scope > g.pm[data-m="${i}"]`);
    R.wl = i => { const g = gOf(i); return { c: R.cols[i], drawn: !!g && g.childElementCount > 0 && (!g.dataset.step || +g.dataset.step <= (R.cNow ?? 1e9)) }; };   // by the stop, not a class a redraw has not set yet
    // lit: the word's mark (the others dim) or the mark pointed at (the others stay)
    R.paintWl = () => { const on = R.wlOn ?? R.hotM, rest = on == null ? R.rest : null; node.classList.toggle('lnk-dim', R.wlOn != null); node.classList.toggle('lnk-rest', !!rest);
      svg.querySelectorAll(':scope > g.pm').forEach(g => { g.classList.toggle('lnk-on', +g.dataset.m === on); g.classList.toggle('told', !!rest && rest.has(+g.dataset.m)); });
      leg.querySelectorAll('.pk').forEach(e => { e.classList.toggle('lnk-on', e.dataset.m != null && +e.dataset.m === on); e.classList.toggle('told', !!rest && e.dataset.m != null && rest.has(+e.dataset.m)); }); };
    R.wlLight = i => { if (R.wlOn !== i) { R.wlOn = i; R.paintWl(); } };
    R.wlRest = set => { R.rest = set; R.paintWl(); };   // the first look (see the board)
    R.hover = i => { if (R.hotM === i) return; R.hotM = i; R.paintWl(); if (R.onHot) R.onHot(i); };
    return R;
  }

  // ---------- chance: two groups as units, their shares on one line, the gap between them and a ruler of noise steps ----------
  // Each group is a grid of squares, 10 a row, its ill (`ill`) filled first in reading order, the rest outlined in its colour,
  // dimmed. One share line 0–100% carries a dot per group, the gap (the witness, with its soft glow) between the dots and,
  // with `step`, a ruler from the lower share: a numbered tick per noise step up to the first whole step past the gap, none
  // past 100%. With `tally` (one 0/1 per frame of the scene's run) a strip under the line: a square per frame after frame 0,
  // outlined until the run reaches it, then grey, or the gap's colour where the list holds 1; the frame on show is outlined.
  // Text on it: the axis name and tick numbers only. The four marks (the two groups, `gap`, `noise step`) take the legend
  // row, cards and linked words as a plane's marks do. It is drawn at the size it shows, and a number that changes moves
  // its marks over --m-state on the kit's one curve (no move with reduced motion)
  // The C10p two-share look (N5): a filled unit takes its group's colour, a hollow one grey ink; `unit: house` draws each unit
  // as a small house (one closed path, centred in its cell). The share line runs to the next named tick past the furthest
  // share or ruler end on any frame, so it never rescales during a run. The outer dots carry their group names beside them
  // when there is room. The gap runs see-through from the lower group's colour to the higher's; its word, swatch and card follow
  const CH_SHAPE = { house: (x, y, s) => { const h = s / 2, bw = s * .38, ev = y - h + s * .46, f = v => v.toFixed(2);
    return `M${f(x)},${f(y - h)} L${f(x + h)},${f(ev)} L${f(x + bw)},${f(ev)} L${f(x + bw)},${f(y + h)} L${f(x - bw)},${f(y + h)} L${f(x - bw)},${f(ev)} L${f(x - h)},${f(ev)} Z`; } };
  let chNo = 0;
  const CH = { most: 12, cols: 10, gapG: 50, cellMax: 34, top: 8, ruler: 56, plain: 22, below: 68, unitMin: 9, tallyMin: 9, l: 40, r: 30 };
  const GEO = new Set(['x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'width', 'height']);
  const bezier = (x1, y1, x2, y2) => t => { let u = t;
    for (let i = 0; i < 8; i++) { const x = 3 * (1 - u) ** 2 * u * x1 + 3 * (1 - u) * u * u * x2 + u ** 3 - t, dx = 3 * (1 - u) ** 2 * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2); if (Math.abs(x) < 1e-5 || !dx) break; u -= x / dx; }
    u = Math.min(1, Math.max(0, u)); return 3 * (1 - u) ** 2 * u * y1 + 3 * (1 - u) * u * u * y2 + u ** 3; };
  const motion = () => { const cs = getComputedStyle(document.documentElement), ms = parseFloat(cs.getPropertyValue('--m-state')) || 450,
      m = /cubic-bezier\(([^)]+)\)/.exec(cs.getPropertyValue('--ease')), b = m ? m[1].split(',').map(Number) : [.2, .7, .2, 1];
    return { ms, ease: bezier(...b) }; };
  function chance(p, ctx, at, env, ratio) {
    const frameOf = env.frame;
    const node = h('div', 'bi chance fr'); node.dataset.at = at; if (p.id) node.dataset.id = p.id;
    const leg = h('div', 'plegend'); node.appendChild(leg);
    const wrap = h('div', 'pwrap'); node.appendChild(wrap);
    const svg = sv('svg', { class: 'pl ch' }, wrap), defs = sv('defs', {}, svg), gid = `chg${++chNo}`;
    const R = { node, issues: [], kind: 'chance', w: 0, h: 0, leg: LEG, linked: new Set(), cols: [], wlOn: null, hotM: null };
    const G = list(p.groups).slice(0, 2).map((g, i) => ({ ...g, c: col(g.color || ['s1', 's2'][i]) }));
    const gapC = 'var(--ink)', stepC = col('s3'), rr = ratio != null ? ratioOf(ratio, null) : null;
    const num = (x, where) => L.val(x, ctx.scope, `slide ${ctx.index + 1} chance ${where}`);
    const pts = v => L.fmt(100 * v, 1), say = (t, d) => t != null ? String(t) : d;
    R.cols = [...G.map(g => g.c), gapC, stepC];
    // what each mark is: its legend name, swatch, card words and value now
    R.keys = [...G.map(g => String(g.name ?? '')), 'gap', ...(p.step != null ? ['noise step'] : [])];
    // the numbers at a scope, made safe to draw: `n` a whole number 1–100, `ill` 0..n, `step` above 0 or no ruler. What had
    // to change is kept in `bad`, for the page audit
    const read = (sc, bad) => { const v = G.map(g => { let n = L.val(g.n, sc, `slide ${ctx.index + 1} chance ${g.name} n`), x = L.val(g.ill, sc, `slide ${ctx.index + 1} chance ${g.name} ill`);
        if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 100) { bad.push(`\`n\` of ${g.name} is ${L.fmt(n)}, not a whole number from 1 to 100`); n = Math.min(100, Math.max(1, Math.round(+n) || 1)); }
        if (typeof x !== 'number' || !Number.isInteger(x) || x < 0 || x > n) { bad.push(`\`ill\` of ${g.name} is ${L.fmt(x)}, not a whole number from 0 to ${n}`); x = Math.min(n, Math.max(0, Math.round(+x) || 0)); }
        return { n, x }; }), s = v.map(q => q.x / q.n);
      let step = p.step != null ? L.val(p.step, sc, `slide ${ctx.index + 1} chance step`) : null;
      if (step != null && !(typeof step === 'number' && step > 0 && Number.isFinite(step))) { bad.push(`\`step\` is ${L.fmt(step)}, not a share above 0, so no ruler is drawn`); step = null; }
      return { v, s, gap: s[0] - s[1], step }; };
    const now = () => read(ctx.scope, []);
    // every frame the scene's run can reach, worked out with the page's own derive: the first frame each problem shows on
    // and the furthest the shares or the ruler reach on any frame (`T`), so the share line keeps one scale over the run
    const sweep = () => { const out = new Map(), n = Math.max(1, env.frames || 0); let T = 0;
      for (let f = 0; f < n; f++) { const sc = env.frames ? L.derive(L.scope(ctx.scope, { [env.name]: f }), env.derive, `slide ${ctx.index + 1}`) : ctx.scope, bad = [];
        const S = read(sc, bad), lo = Math.min(...S.s), hi = Math.max(...S.s);
        T = Math.max(T, hi, S.step ? lo + Math.min(CH.most, Math.max(1, Math.ceil((hi - lo) / S.step - 1e-9))) * S.step : 0); if (S.step && Math.abs(S.gap) / S.step > CH.most) bad.push(`the gap is ${Math.round(Math.abs(S.gap) / S.step)} noise steps; the ruler counts up to ${CH.most}, so check \`step\` is a share, not a percent`);
        bad.forEach(b => { const k = b.replace(/ is .*/, ''); if (!out.has(k)) out.set(k, `the chance figure: ${b}${env.frames ? ` (at frame ${f})` : ''}`); }); }
      return { issues: [...out.values()], T: Math.min(1, T) }; };
    // the share line's end: names every 10 points (every 20 when that needs more than 6), a tick between, at least one name
    const axisOf = T => { const ns = Math.ceil(T / .1 - 1e-9) <= 6 ? .1 : .2; return { ns, top: Math.min(1, Math.max(1, Math.ceil(T / ns - 1e-9)) * ns) }; };
    const gradOf = S => { const lo = S.s[0] < S.s[1] ? 0 : 1; return [G[lo].c, G[1 - lo].c]; };   // the gap's colours, lower share first
    const MK = [
      ...G.map((g, i) => ({ kind: 'dot', says: say(g.says, `Each ${p.unit === 'house' ? 'house' : 'square'} is one member of the ${g.name} group, filled when it has the outcome. The dot on the line is the share filled.`),
        value: S => `${L.fmt(S.v[i].x)} of ${L.fmt(S.v[i].n)} (${pts(S.s[i])}%)` })),
      { kind: 'line', says: say(p.gap_says, 'The distance between the two shares: the difference the data show.'), value: S => `${pts(Math.abs(S.gap))} points` },
      { kind: 'ruler', says: say(p.step_says, 'How far apart the two shares land by chance alone, as a rule, when both groups share one rate. Each tick is one more step.'),
        value: S => S.step == null ? null : `${pts(S.step)} points` },
    ];
    const gapSwatch = ([a, b]) => `<svg width="24" height="12" viewBox="0 0 24 12"><defs><linearGradient id="${gid}s" gradientUnits="userSpaceOnUse" x1="1" x2="23" y1="0" y2="0"><stop offset="0" style="stop-color:${a}"/><stop offset="1" style="stop-color:${b}"/></linearGradient></defs><line x1="1" y1="6" x2="23" y2="6" style="stroke:url(#${gid}s);stroke-width:3;stroke-opacity:.75"/></svg>`;
    const tipOn = (el, m) => { const mk = MK[m], c = R.cols[m];
      el.classList.add('says', 'vt'); el.setAttribute('tabindex', '0'); glow(el, c); el.setAttribute('aria-description', mk.says); pauseButton();
      el._pd = () => ({ swatch: m === 2 ? gapSwatch(gradOf(now())) : swatch(mk.kind, c), c, name: R.keys[m], says: mk.says, value: mk.value(now()), shape: null, scope: ctx.scope }); };
    // the drawing: every piece keyed, so a new frame moves what changed and leaves the rest
    const els = new Map(), tweens = []; let raf = 0, drawnW = 0;
    const tick = t => { const { ms, ease } = R.mo; for (let q = tweens.length - 1; q >= 0; q--) { const w = tweens[q], k = Math.min(1, (t - w.t0) / ms);
        w.el.setAttribute(w.a, (w.from + (w.to - w.from) * ease(k)).toFixed(2)); if (k >= 1) tweens.splice(q, 1); }
      raf = tweens.length ? requestAnimationFrame(tick) : 0; };
    R.size = room => { const ah = room.h - PAD - R.leg, ww = aim(room, ah) - PAD; let w = Math.round(ww);
      // as wide as the room allows, narrowed until its height fits the window
      // with a `ratio`, the box keeps that shape and the drawing fits inside it
      if (rr) { w = Math.round(Math.min(w, ah * rr)); R.box = Math.round(w / rr); }
      else for (let q = 0; q < 40 && w > 300 && R.hOf(w) > ah; q++) w = Math.round(w * .95);
      R.w = w; R.h = rr ? R.box : Math.round(R.hOf(w)); node.style.width = R.w + 'px'; wrap.style.width = R.w + 'px'; wrap.style.height = R.h + 'px'; return R.w + PAD; };
    const geo = W => { const X0 = CH.l, X1 = W - CH.r, rows = Math.max(1, ...G.map(g => Math.ceil((num(g.n, 'n') || 0) / CH.cols)));
      const cell = Math.min((X1 - X0 - CH.gapG) / 2 / CH.cols, CH.cellMax), uH = rows * cell;
      const ySh = CH.top + uH + 34 + (p.step != null ? CH.ruler : CH.plain), yT = ySh + CH.below + 6;
      const F = p.tally != null && env.frames ? env.frames - 1 : 0;   // one square per frame of the run after frame 0, whatever the list holds
      let per = 50; const pitchOf = k => (X1 - X0) / (k - .25); for (const k of [50, 40, 25, 20, 10]) { per = k; if (pitchOf(k) * .75 >= CH.tallyMin) break; }
      const pitch = pitchOf(per), tH = F ? Math.ceil(F / per) * pitch : 0;
      return { X0, X1, cell, uH, ySh, yT, F, per, pitch, s: pitch * .75, H: (F ? yT + tH : ySh + CH.below) + 4 }; };
    R.hOf = W => geo(W).H;
    R.layout = () => {
      R.issues = []; R.mo = R.mo || motion();
      const W = R.w, g = geo(W); if (W < 40) { R.issues.push('the chance figure has no room'); return false; }
      const hard = W !== drawnW || REDUCED; drawnW = W; R.h = rr ? R.box : Math.round(g.H); wrap.style.height = R.h + 'px';
      svg.setAttribute('viewBox', `0 0 ${W} ${Math.round(g.H)}`); svg.setAttribute('width', W); svg.setAttribute('height', R.h);
      const S = now(), sw = sweep(), A = axisOf(sw.T); R.issues.push(...sw.issues);
      if (p.tally != null) { const tl = list(num(p.tally, 'tally')).length; if (!env.frames) R.issues.push('the chance figure has a tally but the scene has no run, so no tally is drawn'); else if (tl !== env.frames) R.issues.push(`the chance figure's tally holds ${tl} entries but the run has ${env.frames} frames`); }
      const lo = Math.min(...S.s), hi = Math.max(...S.s), xs = v => g.X0 + v / A.top * (g.X1 - g.X0), stepPx = S.step != null ? S.step / A.top * (g.X1 - g.X0) : 0;
      if (g.cell * .8 < CH.unitMin) R.issues.push(`the chance figure's units are ${(g.cell * .8).toFixed(1)} px: give it more room`);
      if (g.F && g.s < CH.tallyMin) R.issues.push(`the chance figure's tally squares are ${g.s.toFixed(1)} px: give it more room`);
      if (S.step != null && stepPx < 16) R.issues.push(`one noise step is only ${stepPx.toFixed(0)} px on the share line, so its ticks crowd`);
      const t0 = performance.now(), seen = new Set(), groups = {};
      const grp = (key, m, cls) => { let e = groups[key]; if (!e) { e = els.get(key) || sv('g', {}); e.setAttribute('class', cls || 'pm'); if (m != null) { e.dataset.m = m; glow(e, R.cols[m]); } els.set(key, e); groups[key] = e; svg.appendChild(e); seen.add(key); } return e; };
      const put = (parent, tag, key, a, style, text) => { let e = els.get(key); seen.add(key);
        if (!e || e.tagName !== tag) { if (e) e.remove(); e = sv(tag, {}); els.set(key, e); for (const k in a) e.setAttribute(k, a[k]); }
        else for (const k in a) { const was = e.getAttribute(k), to = typeof a[k] === 'number' ? +a[k].toFixed(2) : a[k]; if (String(was) === String(to)) continue;
          const live = tweens.findIndex(w => w.el === e && w.a === k); if (live >= 0) tweens.splice(live, 1);
          if (!hard && GEO.has(k) && was != null) tweens.push({ el: e, a: k, from: +was, to: +to, t0 }); else e.setAttribute(k, to); }
        if (style != null) e.setAttribute('style', style); if (text != null && e.textContent !== String(text)) e.textContent = text; parent.appendChild(e); return e; };
      // the units: two grids side by side, ill first in reading order
      const gw = CH.cols * g.cell, left = g.X0 + (g.X1 - g.X0 - 2 * gw - CH.gapG) / 2;
      S.v.forEach((v, i) => { const gg = grp(`u${i}`, i), x0 = left + i * (gw + CH.gapG), c = G[i].c;
        for (let k = 0; k < v.n; k++) { const x = x0 + (k % CH.cols) * g.cell, y = CH.top + Math.floor(k / CH.cols) * g.cell, on = k < v.x;
          const look = on ? `fill:${c};stroke:${c};stroke-width:var(--w-data)` : 'fill:none;stroke:var(--mist);stroke-width:var(--w-data);stroke-opacity:.7';
          if (p.unit === 'house') put(gg, 'path', `u${i}-${k}`, { d: CH_SHAPE.house(x + g.cell / 2, y + g.cell / 2, g.cell * (on ? .8 : .76)), 'stroke-linejoin': 'round' }, look);
          else put(gg, 'rect', `u${i}-${k}`, { x: x + g.cell * .1, y: y + g.cell * .1, width: g.cell * .8, height: g.cell * .8 }, look); }
        put(gg, 'rect', `uh${i}`, { x: x0, y: CH.top, width: gw, height: Math.ceil(v.n / CH.cols) * g.cell }, 'fill:transparent;stroke:none').setAttribute('class', 'chit'); });
      // the share line: ticks every 10, numbers every 20, its name under them at the right
      const ax = grp('axis', null, 'pax');
      put(ax, 'line', 'axl', { x1: g.X0, x2: g.X1, y1: g.ySh, y2: g.ySh }, 'stroke:var(--c-axis);stroke-width:var(--w-guide)');
      for (let k = 0; k <= Math.round(2 * A.top / A.ns); k++) { const q = Math.round(k * A.ns * 50), x = xs(q / 100);
        put(ax, 'line', `axt${q}`, { x1: x, x2: x, y1: g.ySh, y2: g.ySh + (k % 2 ? 4 : 7) }, 'stroke:var(--c-tick);stroke-width:var(--w-guide)');
        if (k % 2 === 0) put(ax, 'text', `axn${q}`, { x, y: g.ySh + 30, 'text-anchor': 'middle', class: 'tick' }, null, q); }
      put(ax, 'text', 'axname', { x: g.X1, y: g.ySh + 54, 'text-anchor': 'end', class: 'axt' }, null, L.plain(String(p.axis ?? 'share (%)'), ctx.scope));
      // the gap: the witness between the two dots
      const gp = grp('gap', 2);
      // when the groups swap sides the dots slide past each other: the bar's colours and the names change once they arrive
      const [ga, gb] = gradOf(S), swap = !hard && R.grad && R.grad[0] !== ga, late = f => { clearTimeout(R.lateT); if (swap) R.lateT = setTimeout(f, R.mo.ms); else f(); }, lg = put(defs, 'linearGradient', 'grad', { id: gid, gradientUnits: 'userSpaceOnUse', x1: xs(lo), x2: Math.max(xs(hi), xs(lo) + .01), y1: 0, y2: 0 });
      const s0 = put(lg, 'stop', 'gs0', { offset: 0 }), s1 = put(lg, 'stop', 'gs1', { offset: 1 }), pend = [];
      late(() => { s0.setAttribute('style', `stop-color:${ga}`); s1.setAttribute('style', `stop-color:${gb}`); pend.forEach(t => { t.style.visibility = ''; }); }); R.grad = [ga, gb];
      put(gp, 'line', 'span', { x1: xs(lo), x2: xs(hi), y1: g.ySh, y2: g.ySh }, `stroke:url(#${gid});stroke-opacity:.75;stroke-width:var(--w-wit);stroke-linecap:round`).setAttribute('class', 'cwit');
      put(gp, 'line', 'spanh', { x1: xs(lo), x2: xs(hi), y1: g.ySh, y2: g.ySh }, 'stroke:transparent;stroke-width:16;fill:none').setAttribute('class', 'chit');
      // the noise steps: a ruler from the lower share, a tick per step to the first whole step past the gap (at least 1), none past 100%
      // the last tick, worked out first: the first whole step past the gap (at least 1), at most CH.most, and none past 100%
      if (S.step != null) { const rg = grp('ruler', 3), x0 = xs(lo), K = Math.max(0, Math.min(CH.most, Math.max(1, Math.ceil((hi - lo) / S.step - 1e-9)), Math.floor((A.top - lo) / S.step + 1e-9))), end = x0 + K * stepPx;
        put(rg, 'line', 'rl', { x1: x0, x2: end, y1: g.ySh - 14, y2: g.ySh - 14 }, `stroke:${stepC};stroke-width:var(--w-data)`);
        const most = Math.max(K, 4);   // ticks 0..4 always kept, so a tick slides in rather than pops; never more than CH.most + 1
        for (let k = 0; k <= CH.most; k++) { if (k > most) { if (els.has(`rt${k}`)) { put(rg, 'line', `rt${k}`, {}, 'opacity:0'); put(rg, 'text', `rn${k}`, {}, 'opacity:0'); } continue; }
          const x = x0 + Math.min(k, K) * stepPx, on = k <= K;
          put(rg, 'line', `rt${k}`, { x1: x, x2: x, y1: g.ySh - 22, y2: g.ySh - 8 }, `stroke:${stepC};stroke-width:var(--w-data);opacity:${on ? 1 : 0}`);
          put(rg, 'text', `rn${k}`, { x, y: g.ySh - 34, 'text-anchor': 'middle', class: 'tick' }, `fill:${stepC};font-weight:600;opacity:${on && stepPx >= 16 ? 1 : 0}`, k); }   // numbers only where they fit (the audit says when not)
        put(rg, 'rect', 'rh', { x: x0, y: g.ySh - 46, width: Math.max(8, end - x0), height: 40 }, 'fill:transparent;stroke:none').setAttribute('class', 'chit'); }
      // the dots on top of the span
      S.s.forEach((v, i) => { const dg = grp(`d${i}`, i); put(dg, 'circle', `m${i}`, { cx: xs(v), cy: g.ySh, r: 7 }, `fill:${G[i].c};stroke:var(--bg);stroke-width:var(--w-data)`);
        put(dg, 'circle', `mh${i}`, { cx: xs(v), cy: g.ySh, r: 14 }, 'fill:transparent;stroke:none').setAttribute('class', 'chit');
        // its name beside it, outward (the lower share's on its left); with no room there, above the dot when no ruler is drawn, else none
        const left = v < S.s[1 - i] || (v === S.s[1 - i] && i === 1), nm = String(G[i].name ?? ''), fresh = !els.has(`nm${i}${left ? 'l' : 'r'}`), t = put(dg, 'text', `nm${i}${left ? 'l' : 'r'}`, { x: xs(v) + (left ? -14 : 14), y: g.ySh + 6, 'text-anchor': left ? 'end' : 'start', class: 'axt cname' }, `fill:${G[i].c}`, nm);   // a new key when it changes side, so it does not slide across
        const tw = t.getComputedTextLength ? t.getComputedTextLength() : nm.length * 9, fits = left ? xs(v) - 14 - tw >= 2 : xs(v) + 14 + tw <= W - 2;
        if (!fits) { t.setAttribute('x', xs(v)); t.setAttribute('y', g.ySh - 14); t.setAttribute('text-anchor', 'middle'); t.style.opacity = S.step == null ? 1 : 0; }
        if (fresh && swap) { t.style.visibility = 'hidden'; pend.push(t); } });
      // the tally: a square per frame after frame 0
      if (g.F) { const tg = grp('tally', null, 'ptally'), far = list(num(p.tally, 'tally')), f = frameOf();
        for (let k = 1; k <= g.F; k++) { const x = g.X0 + ((k - 1) % g.per) * g.pitch, y = g.yT + Math.floor((k - 1) / g.per) * g.pitch, hit = +far[k] === 1;
          put(tg, 'rect', `ty${k}`, { x: x + .5, y: y + .5, width: g.s - 1, height: g.s - 1 }, f == null || k > f ? 'fill:none;stroke:var(--mist);stroke-width:var(--w-guide);stroke-opacity:.35'
            : `fill:${hit ? 'var(--accent)' : 'var(--mist)'};fill-opacity:${hit ? 1 : .55};stroke:none`); }
        if (f > 0 && f <= g.F) { const x = g.X0 + ((f - 1) % g.per) * g.pitch, y = g.yT + Math.floor((f - 1) / g.per) * g.pitch;
          put(tg, 'rect', 'tycur', { x: x - 1.25, y: y - 1.25, width: g.s + 2.5, height: g.s + 2.5 }, 'fill:none;stroke:var(--ink);stroke-width:1.5'); } }
      [...els.keys()].forEach(k => { if (!seen.has(k)) { els.get(k).remove(); els.delete(k); } });
      if (tweens.length && !raf) raf = requestAnimationFrame(tick);
      // what points at a mark: its hit areas (and the gap's glow) light it, its words and its card
      svg.querySelectorAll('.chit').forEach(e => { const m = +e.parentNode.dataset.m; if (e._on) return; e._on = 1;
        e.addEventListener('pointerenter', () => R.hover(m)); e.addEventListener('pointerleave', () => R.hover(null)); tipOn(e, m); e.removeAttribute('tabindex'); });
      const gl = svg.querySelector('.cwit'); if (gl) glow(gl, gapC);
      // the legend row: one entry a mark, from where the line starts
      if (!leg.childElementCount) { leg.style.paddingLeft = `${Math.max(0, CH.l - 8)}px`;
        R.keys.forEach((t, m) => { const it = h('span', 'pk ' + MK[m].kind); it.style.setProperty('--c', R.cols[m]); it.innerHTML = `<i></i><span>${md(t)}</span>`; it.dataset.m = m; glow(it, R.cols[m]); leg.appendChild(it);
          tipOn(it.lastChild, m); ['pointerenter', 'focusin'].forEach(ev => it.addEventListener(ev, () => R.hover(m))); ['pointerleave', 'focusout'].forEach(ev => it.addEventListener(ev, () => R.hover(null))); }); }
      const gi = leg.querySelector('.pk[data-m="2"] i'); if (gi) Object.assign(gi.style, { borderTop: '0', height: '4px', background: `linear-gradient(90deg, ${ga}, ${gb})`, opacity: .75 });
      R.paintWl();
      const was = R.leg; R.leg = leg.offsetHeight + 6; return R.leg !== was; };
    R.wl = i => ({ c: R.cols[i], grad: i === 2 && R.grad ? R.grad : null, drawn: i < R.keys.length && env.shown() });   // its words wait until the reading reaches the figure; the gap's word takes the bar's two colours
    R.paintWl = () => { const on = R.wlOn ?? R.hotM, rest = on == null ? R.rest : null, told = e => !!rest && rest.has(+e.dataset.m); node.classList.toggle('lnk-dim', R.wlOn != null); node.classList.toggle('lnk-rest', !!rest);
      svg.querySelectorAll(':scope > g[data-m]').forEach(e => { e.classList.toggle('lnk-on', +e.dataset.m === on); e.classList.toggle('told', told(e)); }); leg.querySelectorAll('.pk').forEach(e => { e.classList.toggle('lnk-on', +e.dataset.m === on); e.classList.toggle('told', told(e)); }); };
    R.wlLight = i => { if (R.wlOn !== i) { R.wlOn = i; R.paintWl(); } };
    R.wlRest = set => { R.rest = set; R.paintWl(); };   // the first look (see the board)
    R.hover = i => { if (R.hotM === i) return; R.hotM = i; R.paintWl(); if (R.onHot) R.onHot(i); };
    return R;
  }

  // ---------- fork: one start and 2–3 ends side by side, drawn with the box of parts (parts.js) ----------
  // The start sits at the top, the ends in a row below it, each reached by a curved path with its name (`via`) beside it. Under
  // each end: its name, red when it is a bad end (`bad`), and a number line (`num`, `{{…}}` filled from the data). A line under the
  // ends shows they are compared side by side. The end named by `see` is lit at rest (orange path, glow): the witness; pointing at
  // an end, its words or Tab lights that one instead, a press keeps it lit, and the others step back. A cell's chromosomes come
  // from a data list (`chroms`): one letter a kind, `*` after it for a damaged copy. Each kind keeps one colour across the figure,
  // in order of first use. The figure is wide (the reading column) and drawn at the size it shows
  const FK = { top: 128, endY: 430, H: 600, gap: 380, side: 400, endW: 300, startSize: 190, endSize: 128, minW: 700 };
  const FORK_HUES = ['s5', 's4', 's2', 's1'], FORK_COL = { cell: 's5', nucleus: 's5', chromosome: 's5', droplet: 's1', tube: 's2', plate: 's2', read: 's2', tissue: 's3', lens: 'mist' };
  let forkNo = 0;
  function fork(p, ctx, at, env) {
    const node = h('div', 'bi fork fr'); node.dataset.at = at; if (p.id) node.dataset.id = p.id;
    const svg = sv('svg', { class: 'fk' }, node), uid = `fk${++forkNo}`;
    const E = list(p.ends).filter(e => e && typeof e === 'object'), n = E.length, S0 = p.start || {};
    const R = { node, issues: [], kind: 'fork', w: 0, h: 0, leg: 0, linked: new Set(), cols: [], wlOn: null, hotM: null, pin: null };
    R.keys = E.map(e => String(e.via ?? e.name ?? ''));
    R.cols = E.map(e => e.bad ? 'var(--bad)' : 'var(--accent)');
    const seeI = E.findIndex(e => p.see != null && [e.via, e.name].map(String).includes(String(p.see)));
    // a cell's chromosomes: the data list read at this scope, each kind its colour, `*` a damaged copy
    const hue = new Map(), hueOf = k => { if (!hue.has(k)) hue.set(k, FORK_HUES[Math.min(hue.size, FORK_HUES.length - 1)]); return col(hue.get(k)); };
    const chromsOf = (q, where) => { if (q == null) return null; const v = list(L.val(q, ctx.scope, `slide ${ctx.index + 1} fork ${where} chroms`));
      return v.map(x => { const str = String(x), k = str.replace(/\*$/, ''); return { c: hueOf(k), mut: str.endsWith('*') }; }); };
    const ink = window.VizOS.ink;
    const parts = (D, x, y, big, where) => { const ds = list(D).filter(d => d && d.part), k = ds.length, size = Math.min(big, (big === FK.startSize ? 360 : 260) / Math.max(1, k));
      return ds.map((d, i) => { try { return ink.part(d.part, { x: x + (i - (k - 1) / 2) * (size + 6), y, size: d.size || size, state: d.state, rot: d.turn || 0, id: `${where}${i}`,
        color: col(d.color || FORK_COL[d.part] || 's5'), chroms: chromsOf(d.chroms, where) }); } catch (er) { R.issues.push(`the fork ${where}: ${er.message}`); return ''; } }).join(''); };
    const say = t => md(L.plain(String(t ?? ''), ctx.scope));
    const txt = (x, y, cls, anchor, html, style) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="${cls}" text-anchor="${anchor}"${style ? ` style="${style}"` : ''}>${html}</text>`;
    const plainOf = html => { const q = document.createElement('span'); q.innerHTML = html; return L.esc(q.textContent); };   // SVG text holds no HTML
    R.size = room => { R.w = Math.round(room.w - PAD); R.h = FK.H; node.style.width = R.w + 'px'; svg.setAttribute('width', R.w); svg.setAttribute('height', R.h); return R.w + PAD; };
    R.hOf = () => FK.H;
    R.layout = () => {
      R.issues = []; hue.clear(); const W = R.w; if (W < FK.minW) R.issues.push(`the fork has ${W} px; it needs ${FK.minW}`);
      svg.setAttribute('viewBox', `0 0 ${W} ${FK.H}`);
      const sx = W / 2, sy = FK.top, ey = FK.endY, gap = Math.min(FK.gap, (W - FK.side) / Math.max(1, n - 1)), xs = E.map((_, i) => sx + (i - (n - 1) / 2) * gap);
      let paths = '', words = '', ends = '', hits = '';
      E.forEach((e, i) => { const side = i - (n - 1) / 2, a = [sx + side * 34, sy + 108], b = [xs[i], ey - 80], c1 = [a[0], a[1] + 70], c2 = [b[0], b[1] - 80], s = 7;
        paths += `<g class="fp" data-i="${i}"><path class="fpl" d="M${a[0]} ${a[1]}C${c1} ${c2} ${b[0]} ${b[1]}"/><path class="fph" d="M${b[0] - s} ${b[1] - s * 1.4}L${b[0]} ${b[1]}L${b[0] + s} ${b[1] - s * 1.4}"/></g>`;
        const out = side < 0 ? -1 : 1;
        if (e.via != null) words += `<text class="fw" data-i="${i}" data-push="${out}" x="${b[0] + out * 16}" y="${b[1] - 22}" text-anchor="${out < 0 ? 'end' : 'start'}">${plainOf(say(e.via))}</text>`;
        ends += `<g class="fe" data-i="${i}">${parts(e.draw, xs[i], ey, FK.endSize, `end ${i + 1}`)}` +
          txt(xs[i], ey + 108, 'fc', 'middle', plainOf(say(e.name)), e.bad ? 'fill:var(--bad)' : '') + (e.num != null ? txt(xs[i], ey + 134, 'fn', 'middle', plainOf(say(e.num))) : '') + '</g>';
        hits += `<rect class="fh" data-i="${i}" x="${xs[i] - FK.endW / 2}" y="${ey - 76}" width="${FK.endW}" height="${FK.H - ey + 70}" tabindex="0" role="button" aria-label="${plainOf(say(e.via ?? e.name))}"/>`; });
      const start = `<g class="fs">${parts(S0.draw, sx, sy, FK.startSize, 'start')}${S0.name != null ? txt(sx + 139, sy + 6, 'fc', 'start', plainOf(say(S0.name))) : ''}</g>`;
      const base = `<line class="fbase" x1="${Math.max(8, xs[0] - 170)}" x2="${Math.min(W - 8, xs[n - 1] + 170)}" y1="${ey + 82}" y2="${ey + 82}"/>`;
      svg.innerHTML = `<defs><filter id="${uid}" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${FK.H}"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` +
        start + paths + base + ends + words + hits;
      svg.style.setProperty('--fkglow', `url(#${uid})`);
      R.clear(); document.fonts && document.fonts.ready.then(() => { R.clear(); });
      svg.querySelectorAll('.fh').forEach(q => { const i = +q.dataset.i;
        q.addEventListener('pointerenter', () => R.hover(i)); q.addEventListener('pointerleave', () => R.hover(null)); q.addEventListener('focus', () => R.hover(i)); q.addEventListener('blur', () => R.hover(null));
        q.addEventListener('click', () => { R.pin = R.pin === i ? null : i; R.paintWl(); });
        q.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); q.dispatchEvent(new MouseEvent('click')); } }); });
      R.paintWl(); return false; };
    // a path's word steps outward, 2 px at a time, until no path comes within 8 px; the audit names one still touching, and two ends' words that meet
    R.clear = () => { if (!svg.isConnected || !svg.getBBox) return; const pts = [...svg.querySelectorAll('.fpl')].flatMap(q => { const T = q.getTotalLength(), o = []; for (let d = 0; d <= T; d += 3) { const m = q.getPointAtLength(d); o.push([m.x, m.y]); } return o; });
      const near = b => pts.some(([x, y]) => x > b.x - 8 && x < b.x + b.width + 8 && y > b.y - 8 && y < b.y + b.height + 8);
      R.issues = R.issues.filter(t => !t.startsWith('the fork word'));
      svg.querySelectorAll('.fw').forEach(t => { const dx = +t.dataset.push, x0 = +t.getAttribute('x');
        for (let k = 0; k <= 40; k++) { t.setAttribute('x', x0 + dx * k * 2); if (!near(t.getBBox())) break; }
        const b = t.getBBox(); if (near(b)) R.issues.push(`the fork word "${t.textContent}" sits on a path: shorten it`);
        if (b.x < 0 || b.x + b.width > R.w) R.issues.push(`the fork word "${t.textContent}" runs off the figure: shorten it`); });
      const boxes = [...svg.querySelectorAll('.fe')].map(g => [...g.querySelectorAll('text')].map(t => t.getBBox()));
      boxes.forEach((bs, i) => bs.forEach(bb => (boxes[i + 1] || []).forEach(cb => { if (bb.x + bb.width + 12 > cb.x && cb.y < bb.y + bb.height && bb.y < cb.y + cb.height) R.issues.push(`the fork end ${i + 1}'s words meet end ${i + 2}'s: shorten them`); }))); };
    R.wl = i => ({ c: R.cols[i], drawn: i < n && env.shown() });
    R.paintWl = () => { const on = R.wlOn ?? R.hotM ?? R.pin ?? (seeI >= 0 ? seeI : null);
      svg.querySelectorAll('[data-i]').forEach(e => { const me = +e.dataset.i === on; e.classList.toggle('on', me); e.classList.toggle('off', on != null && !me); }); };
    R.wlLight = i => { if (R.wlOn !== i) { R.wlOn = i; R.paintWl(); } };
    R.hover = i => { if (R.hotM === i) return; R.hotM = i; R.paintWl(); if (R.onHot) R.onHot(i); };
    return R;
  }

  // ---------- beads: a part of a whole as a ring of beads, one ring per row of a data list (the C10p mock-up, 11 Nov) ----------
  // One bead per unit of the whole, open; the part's beads filled, clockwise from the top, in the row's colour (`colors`, else s1, s2, s3, s4
  // in order). Every ring is one size, so equal wholes draw equal rings. The row's name sits above its ring, large; the middle
  // holds the part's column word, the part, a rule, the whole and the whole's column word, stacked. A key at the bottom right:
  // one open bead and `key`. Each ring is a mark named by its row's name: a legend entry, a linked word and a card ("18 of 40
  // homes are ill"); pointing at a ring lights it and dims the others. The figure is wide (the reading column)
  // rMin clears the middle stack, so a small whole spreads its beads out; a filled bead is `fill` of an open one. The lint
  // works out the largest whole from the same numbers (lesson_lint.py BEADS_*): change both together
  const BD = { name: 30, gapName: 44, top: 6, foot: 54, pitch: 30, side: 40, rMax: 230, beadMax: 10, beadMin: 3.5, rMin: 110, fill: .72, most: 4 };
  function beads(p, ctx, at, env) {
    const node = h('div', 'bi beads fr'); node.dataset.at = at; if (p.id) node.dataset.id = p.id;
    const leg = h('div', 'plegend'); node.appendChild(leg);
    const svg = sv('svg', { class: 'bd' }, node);
    const R = { node, issues: [], kind: 'beads', w: 0, h: 0, leg: LEG, linked: new Set(), cols: [], wlOn: null, hotM: null, pin: null };
    const rows = () => { let v = []; try { v = list(L.val(p.from, ctx.scope, `slide ${ctx.index + 1} beads from`)); } catch (er) { R.issues.push(`the beads: ${er.message}`); }
      return v.filter(r => r && typeof r === 'object').slice(0, BD.most).map(r => ({ name: String(r[p.name] ?? ''), part: +r[p.part], whole: +r[p.whole] })); };
    const B0 = rows();
    R.keys = B0.map(r => r.name); R.cols = B0.map((_, i) => col(list(p.colors)[i] || `s${i + 1}`));
    const esc = t => L.esc(String(t));
    const says = r => `${L.fmt(r.part)} of ${L.fmt(r.whole)} ${p.whole} are ${p.part}.`;
    const tipOn = (el, i) => { const c = R.cols[i];
      el.classList.add('says', 'vt'); glow(el, c); el.setAttribute('aria-description', says(B0[i])); pauseButton();
      el._pd = () => { const r = rows()[i] || B0[i]; return { swatch: swatch('dot', c), c, name: r.name, says: says(r), value: `${L.fmt(r.part)} of ${L.fmt(r.whole)}`, shape: null, scope: ctx.scope }; }; };
    // one ring size for all: as large as a slot allows, beads about BD.pitch apart round the largest whole
    const geo = W => { const B = rows(), n = Math.max(1, B.length), most = Math.max(4, ...B.map(r => r.whole || 0)), slot = W / n;
      const r = Math.max(BD.rMin, Math.min(BD.rMax, slot / 2 - BD.side, most * BD.pitch / (2 * Math.PI))), rb = Math.min(BD.beadMax, Math.PI * r / most * .62);
      const cy = BD.top + BD.name + BD.gapName + rb + r; return { B, n, most, slot, r, rb, cy, H: Math.round(cy + r + rb + BD.foot) }; };
    R.size = room => { R.w = Math.round(room.w - PAD); R.h = geo(R.w).H; node.style.width = R.w + 'px'; svg.setAttribute('width', R.w); svg.setAttribute('height', R.h); return R.w + PAD; };
    R.hOf = W => geo(W).H;
    R.layout = () => {
      R.issues = []; const W = R.w, g = geo(W); R.h = g.H; svg.setAttribute('height', R.h); svg.setAttribute('viewBox', `0 0 ${W} ${g.H}`);
      if (2 * (g.r + g.rb) > g.slot) R.issues.push(`the bead rings are ${Math.round(2 * (g.r + g.rb))} px across in ${Math.round(g.slot)} px each: give the figure more room, or fewer rows`);
      if (g.rb < BD.beadMin) R.issues.push(`the beads are ${(2 * g.rb).toFixed(1)} px: a smaller whole, or fewer rows`);
      let out = '';
      g.B.forEach((r, i) => { const cx = g.slot * (i + .5), c = R.cols[i], at = (k, n) => { const a = -Math.PI / 2 + k * 2 * Math.PI / n; return [cx + g.r * Math.cos(a), g.cy + g.r * Math.sin(a)]; };
        const ok = Number.isInteger(r.whole) && r.whole >= 4 && r.whole <= 120 && Number.isInteger(r.part) && r.part >= 0 && r.part <= r.whole;
        if (!ok) { R.issues.push(`the beads row ${r.name}: ${p.part} ${r.part} of ${p.whole} ${r.whole} is not a whole number from 0 to a whole of 4 to 120`); return; }
        let beadsOpen = '', beadsFull = '';
        for (let k = 0; k < r.whole; k++) { const [x, y] = at(k, r.whole); beadsOpen += `<circle class="bdo" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${g.rb.toFixed(2)}"/>`;
          if (k < r.part) beadsFull += `<circle class="bdf" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(g.rb * BD.fill).toFixed(2)}"/>`; }
        const pw = String(L.fmt(r.part)), ww = String(L.fmt(r.whole)), rw = Math.max(pw.length * 26, ww.length * 18) + 40;
        out += `<g class="bdr" data-m="${i}" style="--c:${c}">` +
          `<text class="bdn" x="${cx}" y="${g.cy - g.r - g.rb - BD.gapName}" text-anchor="middle">${esc(r.name)}</text>${beadsOpen}${beadsFull}` +
          `<text class="bdw" x="${cx}" y="${g.cy - 64}" text-anchor="middle">${esc(p.part)}</text>` +
          `<text class="bdp" x="${cx}" y="${g.cy - 14}" text-anchor="middle">${esc(pw)}</text>` +
          `<line class="bdl" x1="${cx - rw / 2}" x2="${cx + rw / 2}" y1="${g.cy + 2}" y2="${g.cy + 2}"/>` +
          `<text class="bdt" x="${cx}" y="${g.cy + 38}" text-anchor="middle">${esc(ww)}</text>` +
          `<text class="bdw" x="${cx}" y="${g.cy + 70}" text-anchor="middle">${esc(p.whole)}</text>` +
          `<circle class="bdh" cx="${cx}" cy="${g.cy}" r="${(g.r + g.rb + 8).toFixed(1)}"/></g>`; });
      const kx = W - 8, ky = g.H - 14;
      out += `<g class="bdk"><text class="bdkt" x="${kx}" y="${ky}" text-anchor="end">${esc(L.plain(String(p.key ?? ''), ctx.scope))}</text></g>`;
      svg.innerHTML = out;
      const kt = svg.querySelector('.bdkt'); if (kt && p.key != null) { const w = kt.getComputedTextLength ? kt.getComputedTextLength() : 0;
        kt.insertAdjacentHTML('beforebegin', `<circle class="bdo" cx="${(kx - w - 15).toFixed(1)}" cy="${ky - 6}" r="7"/>`); }
      svg.querySelectorAll('.bdr').forEach(e => glow(e, R.cols[+e.dataset.m]));
      svg.querySelectorAll('.bdh').forEach(e => { const i = +e.parentNode.dataset.m; tipOn(e, i);
        e.addEventListener('pointerenter', () => R.hover(i)); e.addEventListener('pointerleave', () => R.hover(null)); });
      // the legend row: one entry a ring, from the figure's left edge
      if (!leg.childElementCount) R.keys.forEach((t, m) => { const it = h('span', 'pk dot'); it.style.setProperty('--c', R.cols[m]); it.innerHTML = `<i></i><span>${md(t)}</span>`; it.dataset.m = m; glow(it, R.cols[m]); leg.appendChild(it);
        tipOn(it.lastChild, m); it.lastChild.setAttribute('tabindex', '0'); ['pointerenter', 'focusin'].forEach(ev => it.addEventListener(ev, () => R.hover(m))); ['pointerleave', 'focusout'].forEach(ev => it.addEventListener(ev, () => R.hover(null))); });
      R.paintWl();
      const was = R.leg; R.leg = leg.offsetHeight + 6; return R.leg !== was; };
    R.wl = i => ({ c: R.cols[i], drawn: i < R.keys.length && env.shown() });
    R.paintWl = () => { const on = R.wlOn ?? R.hotM, rest = on == null ? R.rest : null, told = e => !!rest && rest.has(+e.dataset.m); node.classList.toggle('lnk-dim', on != null); node.classList.toggle('lnk-rest', !!rest);
      svg.querySelectorAll('.bdr').forEach(e => { e.classList.toggle('lnk-on', +e.dataset.m === on); e.classList.toggle('told', told(e)); }); leg.querySelectorAll('.pk').forEach(e => { e.classList.toggle('lnk-on', +e.dataset.m === on); e.classList.toggle('told', told(e)); }); };
    R.wlLight = i => { if (R.wlOn !== i) { R.wlOn = i; R.paintWl(); } };
    R.wlRest = set => { R.rest = set; R.paintWl(); };   // the first look (see the board)
    R.hover = i => { if (R.hotM === i) return; R.hotM = i; R.paintWl(); if (R.onHot) R.onHot(i); };
    return R;
  }

  // ---------- recorder: readings taken in time order, as a chart recorder's paper strip (the C10p mock-up, look C, 11 Nov) ----------
  // A strip of dark paper with a soft shadow: feed holes along both margins, a torn left edge, the roll on the right, a fine grid
  // and the value and time rules. Time runs left to right at its true spacing, so uneven gaps stay uneven. The pen trace joins
  // the readings, a dot on each; an ink wash (a fill and fine hatching) runs from the trace down to the floor unless `wash: false`.
  // The pen rests on the last reading, leaning away from the trace, on the paper. A lit reading (pointing, focus, arrows or
  // `mark: row:N`) shows dashed drops to both rules, a bigger dot, its value (the data's decimals or the column's `fmt`) and a
  // readout "time · value" on the top row (no card, which would cover it); the trace dims a little. The trace is one mark named `name`: the key at the
  // bottom right and a linked word light it. The figure is wide (the reading column) and wears no frame
  const RC = { top: 40, foot: 62, hole: 13, inset: 14, edge: 54, roll: 16, left: 24, right: 50, pen: 48, penW: 5, holeGap: 26, ratio: .42, hMin: 360, hMax: 520, ticks: 12 };
  // the decimals a number is written with, from its shortest exact form (2.5 → 1, 0.25 → 2, 0.0000123 → 7, 1e-12 → 12), so a
  // value printed with them reads exactly as stored and two different readings never print the same (recorder and wheel readouts)
  const decOf = v => { const m = /^(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(String(Math.abs(v))); return m ? Math.min(100, Math.max(0, (m[2] || '').length - +(m[3] || 0))) : 0; };
  const exact = v => L.fmt(v, decOf(v));
  let recNo = 0;
  function recorder(p, ctx, at, env) {
    const node = h('div', 'bi recorder'); node.dataset.at = at; node.dataset.from = String(p.from ?? ''); if (p.id) node.dataset.id = p.id;
    const svg = sv('svg', { class: 'rc', role: 'group' }, node), uid = `rc${++recNo}`;
    const R = { node, issues: [], kind: 'recorder', w: 0, h: 0, linked: new Set(), wlOn: null, hotR: null, keyHot: false, focusR: 0 };
    const ax = v => typeof v === 'string' ? { key: v, label: v } : v && typeof v === 'object' ? { label: v.key, ...v } : {};
    const X = ax(p.x), Y = ax(p.y), c = col(p.color || 's1'), name = String(p.name ?? '');
    R.keys = [name]; R.cols = [c];
    const esc = t => L.esc(String(t)), say = t => L.plain(String(t ?? ''), ctx.scope);
    const rows = () => { let v = []; try { v = list(L.val(p.from, ctx.scope, `slide ${ctx.index + 1} recorder from`)); } catch (er) { R.issues.push(`the recorder: ${er.message}`); }
      return v.filter(r => r && typeof r === 'object').map(r => [+r[X.key], +r[Y.key]]); };
    // a round scale: from 0 (or the lowest value) in 1, 2, 2.5 or 5 steps, at most 10 of them; time starts at its first reading's step
    // Every tolerance is a share of the step, so a tiny range gets the same ten-odd ticks as a large one; the ticks are a whole
    // number of steps (`n`, at most RC.ticks), each worked out to the step's own decimals, so its label is its exact value
    const clean = q => +q.toPrecision(12);
    const scale = (vs, from0) => { const lo = Math.min(...vs), hi = Math.max(...vs), base = from0 ? Math.min(0, lo) : lo, span = hi - base || Math.abs(hi) || 1;
      let st = clean(10 ** Math.floor(Math.log10(span / 5))); const nice = s => { const e = 10 ** Math.floor(Math.log10(s) + 1e-9), m = s / e; return clean((m < 1.5 ? 2 : m < 2.2 ? 2.5 : m < 3 ? 5 : 10) * e); };
      while (span / st > 10) st = nice(st);
      const dec = decOf(st), at = k => +(from + k * st).toFixed(dec), from = clean(Math.floor(base / st + 1e-9) * st);
      let n = Math.max(1, Math.ceil((hi - from) / st - 1e-9));
      if (n > RC.ticks) { R.issues.push(`the recorder's scale needs ${n} steps; it draws ${RC.ticks}`); n = RC.ticks; }
      return { from, hi: at(n), step: st, n, dec, at }; };
    const H = W => Math.round(Math.max(RC.hMin, Math.min(RC.hMax, W * RC.ratio)));
    const pen = (pts, seed, closed = false, amp = .6) => (L.ink && L.ink.hand) ? L.ink.hand(pts, seed, closed, amp) : 'M' + pts.map(q => q.join(' ')).join('L') + (closed ? 'Z' : '');
    const tw = (t, cls) => { const e = sv('text', { class: cls }, svg); e.textContent = t; const w = e.getComputedTextLength ? e.getComputedTextLength() : t.length * 9; e.remove(); return w; };
    R.size = room => { R.w = Math.round(room.w - PAD); R.h = H(R.w); node.style.width = R.w + 'px'; svg.setAttribute('width', R.w); svg.setAttribute('height', R.h); return R.w + PAD; };
    R.hOf = W => H(W);
    R.layout = () => {
      R.issues = []; const W = R.w, Hh = H(W); R.h = Hh; svg.setAttribute('height', Hh); svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
      const B = rows(), n = B.length;
      if (n < 3 || B.some(([t, v]) => !Number.isFinite(t) || !Number.isFinite(v))) { R.issues.push(`the recorder draws ${n} readings of \`${X.key}\` and \`${Y.key}\`: it needs 3 or more, each two finite numbers`); svg.innerHTML = ''; return false; }
      if (B.some(([t], i) => i && !(t > B[i - 1][0]))) R.issues.push('the recorder\'s times do not rise in reading order');
      const ts = B.map(r => r[0]), vs = B.map(r => r[1]);
      const sy = scale(vs, true), sx = scale(ts, false), fy = Number.isInteger(Y.fmt) ? Y.fmt : null, fx = Number.isInteger(X.fmt) ? X.fmt : null;
      const yLab = v => L.fmt(v, Math.max(sy.dec, fy ?? 0)), xLab = t => L.fmt(t, Math.max(sx.dec, fx ?? 0));
      const fv = v => Y.fmt != null ? L.fmt(v, Y.fmt) : exact(v), ft = t => X.fmt != null ? L.fmt(t, X.fmt) : exact(t);
      const yt = Array.from({ length: sy.n + 1 }, (_, k) => sy.at(k)), tt = Array.from({ length: sx.n + 1 }, (_, k) => sx.at(k));
      const tickW = Math.max(...yt.map(v => tw(yLab(v), 'rcl')));
      const xa = Math.round(2 + tickW + 14), xb = W - RC.edge, yT = RC.top, yB = Hh - RC.foot, mT = yT + RC.hole + 2, mB = yB - RC.hole - 2;
      const y0 = yT + RC.hole + RC.inset, y1 = yB - RC.hole - RC.inset, x0 = xa + RC.left, x1 = xb - RC.right;
      const XS = t => x0 + (t - sx.from) / (sx.hi - sx.from) * (x1 - x0), YS = v => y1 - (v - sy.from) / (sy.hi - sy.from) * (y1 - y0), f1 = q => q.toFixed(1);
      const gap = Math.min(...ts.slice(1).map((t, i) => XS(t) - XS(ts[i]))), r = Math.max(3, Math.min(5.5, gap * .3));
      if (gap < 6) R.issues.push(`the recorder's closest readings are ${gap.toFixed(1)} px apart: give it more room, or fewer readings`);
      let o = `<defs><filter id="${uid}s" x="-5%" y="-10%" width="110%" height="130%"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#000" flood-opacity=".75"/></filter>` +
        `<pattern id="${uid}h" patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(40)"><line class="rchl" x1="0" y1="0" x2="0" y2="9"/></pattern>` +
        `<linearGradient id="${uid}f" x1="0" y1="0" x2="0" y2="1"><stop class="rcf0" offset="0"/><stop class="rcf1" offset="1"/></linearGradient></defs>`;
      // the paper: its sheet lifted by a shadow, its edges, feed holes and margins, the fine grid (5 squares a step, when 7 px or more), the rules
      o += `<g class="rcp"><rect class="rcs" x="${xa}" y="${yT}" width="${xb - xa}" height="${yB - yT}" filter="url(#${uid}s)"/>` +
        `<path class="rce" d="${pen([[xa, yT], [xb, yT]], uid + 'top', false, .6)}"/><path class="rce" d="${pen([[xa, yB], [xb, yB]], uid + 'bot', false, .6)}"/>`;
      for (let x = xa + 12; x < xb - 6; x += RC.holeGap) o += `<circle class="rch" cx="${f1(x)}" cy="${yT + RC.hole / 2 + 1}" r="3.2"/><circle class="rch" cx="${f1(x)}" cy="${yB - RC.hole / 2 - 1}" r="3.2"/>`;
      o += `<line class="rcm" x1="${xa}" x2="${xb}" y1="${mT}" y2="${mT}"/><line class="rcm" x1="${xa}" x2="${xb}" y1="${mB}" y2="${mB}"/>`;
      const minor = (s, at, horiz) => { if (Math.abs(at(s.from + s.step / 5) - at(s.from)) < 7) return;
        for (let k = 1; k < 5 * s.n; k++) if (k % 5) { const q = f1(at(s.from + k * s.step / 5));
          o += horiz ? `<line class="rcg" x1="${xa}" x2="${xb}" y1="${q}" y2="${q}"/>` : `<line class="rcg" x1="${q}" x2="${q}" y1="${mT}" y2="${mB}"/>`; } };
      minor(sy, YS, true); minor(sx, XS, false);
      const yEvery = (y1 - y0) / Math.max(1, yt.length - 1) < 26 ? 2 : 1;
      yt.forEach((v, k) => { const q = f1(YS(v)); o += `<line class="rcu" x1="${xa}" x2="${xb}" y1="${q}" y2="${q}"/>`;
        if (k % yEvery === 0) o += `<text class="rcl" x="${xa - 12}" y="${f1(YS(v) + 5)}" text-anchor="end">${esc(yLab(v))}</text>`; });
      const stepPx = (x1 - x0) / Math.max(1, tt.length - 1), tEvery = Math.max(1, Math.ceil((Math.max(...tt.map(t => tw(xLab(t), 'rcl'))) + 18) / stepPx));
      tt.forEach((t, k) => { const q = f1(XS(t)); o += `<line class="rcu" x1="${q}" x2="${q}" y1="${mT}" y2="${mB}"/>`;
        if (k % tEvery === 0) o += `<text class="rcl" x="${q}" y="${yB + 24}" text-anchor="middle">${esc(xLab(t))}</text>`; });
      // the paper's ends: torn on the left, wound on its roll on the right
      const tear = []; for (let y = yT, k = 0; y <= yB; y += 7, k++) tear.push([xa + (k % 2 ? 2 + 3 * Math.abs(Math.sin(k * 2.3)) : Math.abs(Math.sin(k * 1.7))), Math.min(y, yB)]);
      const ring = (cx, cy, rx, ry) => Array.from({ length: 24 }, (_, k) => [cx + rx * Math.cos(Math.PI * 2 * k / 24), cy + ry * Math.sin(Math.PI * 2 * k / 24)]);
      o += `<path class="rce" d="${pen(tear, uid + 'tear', false, .3)}"/>` +
        `<path class="rce" d="${pen([[xb, yT - 8], [xb, yB + 8]], uid + 'ra', false, .4)}"/><path class="rce" d="${pen([[xb + RC.roll, yT - 8], [xb + RC.roll, yB + 8]], uid + 'rb', false, .4)}"/>` +
        `<path class="rce" d="${pen(ring(xb + RC.roll / 2, yT - 8, RC.roll / 2, 3.5), uid + 'rt', true, .3)}"/>` +
        `<path class="rce" d="${pen(ring(xb + RC.roll / 2, yB + 8, RC.roll / 2, 3.5).filter(([, y]) => y >= yB + 8), uid + 'rd', false, .3)}"/></g>`;
      // the axis names: the value's over its labels, the time's with an arrow on the bottom line
      o += `<text class="rcn" x="2" y="${yT - 14}">${esc(say(Y.label))}</text><text class="rcn" x="2" y="${Hh - 9}">${esc(say(X.label))} →</text>`;
      // the ink: the wash to the floor, the trace, then each reading (its slice of strip to point at, its drops, value, readout and dot)
      const pts = B.map(([t, v]) => [XS(t), YS(v)]), line = pts.map(q => `${q[0].toFixed(2)} ${q[1].toFixed(2)}`).join('L'), yF = f1(YS(sy.from));
      o += `<g class="rci" style="--c:${c}">`;
      if (p.wash !== false) { const d = `M${f1(pts[0][0])} ${yF}L${line}L${f1(pts[n - 1][0])} ${yF}Z`; o += `<path class="rcw" d="${d}" fill="url(#${uid}f)"/><path class="rcw rcx" d="${d}" fill="url(#${uid}h)"/>`; }
      o += `<path class="rct" d="M${line}"/></g>`;
      // the readout: on the top row, centred over the paper, clear of the value's name (the bottom row holds the time's name and
      // the key). One place for all readings, measured at its widest
      const kx = xb, ky = Hh - 9, ros = B.map(([t, v]) => `${ft(t)} ${say(X.label)} · ${name} ${fv(v)}`), roW = Math.max(...ros.map(q => tw(q, 'rcn')));
      const yNameEnd = 2 + tw(say(Y.label), 'rcn'), rx = Math.max((xa + xb) / 2, yNameEnd + 24 + roW / 2);
      if (rx + roW / 2 > xb) R.issues.push(`the recorder's readout (${Math.round(roW)} px) runs into the name \`${say(Y.label)}\`: shorter names or labels`);
      B.forEach(([t, v], i) => { const [x, y] = pts[i], lo = i ? (pts[i - 1][0] + x) / 2 : xa, hi = i + 1 < n ? (pts[i + 1][0] + x) / 2 : xb, above = y - y0 > 34;
        const ro = ros[i];
        o += `<g class="rcr" data-r="${i}" style="--c:${c}">` +
          `<line class="rcd" x1="${f1(x)}" x2="${f1(x)}" y1="${f1(y)}" y2="${mB}"/><line class="rcd" x1="${xa}" x2="${f1(x)}" y1="${f1(y)}" y2="${f1(y)}"/>` +
          `<text class="rcv" x="${f1(Math.min(Math.max(x, xa + 30), xb - 30))}" y="${f1(above ? y - r - 12 : y + r + 24)}" text-anchor="middle">${esc(fv(v))}</text>` +
          `<text class="rco" x="${f1(rx)}" y="${yT - 14}" text-anchor="middle">${esc(ro)}</text>` +
          `<circle class="rcdot" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}"/>` +
          `<rect class="rchit" x="${lo.toFixed(2)}" y="${yT}" width="${(hi - lo).toFixed(2)}" height="${yB - yT}" tabindex="${i === R.focusR ? 0 : -1}" role="button" aria-label="${esc(ro)}"/></g>`; });
      // the pen: a stylus on the last reading. Of the four diagonal leans that stay on the paper it takes the one farthest from the
      // trace coming in (up and to the right when that is free); then every 15°; never off the paper, so never outside the figure
      const [lx, ly] = pts[n - 1], inA = Math.atan2(pts[n - 2][1] - ly, pts[n - 2][0] - lx), reach = RC.pen + r + 6;
      const onPaper = q => { const ex = lx + Math.cos(q) * reach, ey = ly + Math.sin(q) * reach, sx2 = Math.abs(Math.sin(q)) * RC.penW, sy2 = Math.abs(Math.cos(q)) * RC.penW;
        return ex - sx2 > xa + 6 && ex + sx2 < xb - 6 && ey - sy2 > mT + 2 && ey + sy2 < mB - 2; };
      const apart = q => Math.abs(((q - inA) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
      const best = qs => qs.filter(onPaper).reduce((b, q) => b == null || apart(q) > apart(b) + .3 ? q : b, null);
      let a = best([-1, 1, -3, 3].map(k => k * Math.PI / 4)); if (a == null) a = best(Array.from({ length: 24 }, (_, k) => (k - 12) * Math.PI / 12));
      if (a == null) R.issues.push('the recorder\'s pen does not fit on the paper: give the figure more room');
      else { const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, tip = [lx + ux * (r + 1), ly + uy * (r + 1)], P = (s, q) => [tip[0] + ux * s + nx * q, tip[1] + uy * s + ny * q];
        o += `<g class="rcpen"><path d="${pen([tip, P(12, RC.penW), P(RC.pen, RC.penW), P(RC.pen, -RC.penW), P(12, -RC.penW)], uid + 'pen', true, .3)}"/>` +
          `<path d="${pen([P(RC.pen - 10, RC.penW), P(RC.pen - 10, -RC.penW)], uid + 'band', false, .2)}"/><circle class="rctip" cx="${f1(tip[0])}" cy="${f1(tip[1])}" r="1.6"/></g>`; }
      // the key: a short line in the trace's colour and its words, ending on the strip's right edge
      const kw = say(p.key ?? name), kwW = tw(kw, 'rck');
      o += `<g class="rck0" style="--c:${c}"><line class="rct" x1="${f1(kx - kwW - 34)}" x2="${f1(kx - kwW - 12)}" y1="${ky - 11}" y2="${ky - 3}"/><text class="rck" x="${kx}" y="${ky}" text-anchor="end">${esc(kw)}</text>` +
        `<rect class="rckh" x="${f1(kx - kwW - 38)}" y="${ky - 20}" width="${f1(kwW + 40)}" height="26"/></g>`;
      svg.innerHTML = o; svg.style.setProperty('--c', c); svg.setAttribute('aria-label', `${name}: ${n} readings of ${say(Y.label)} over ${say(X.label)}`);
      // the time's name and the key share the bottom line: the audit says when they meet
      const xNameEnd = 2 + tw(`${say(X.label)} →`, 'rcn');
      if (xNameEnd + 24 > kx - kwW - 38) R.issues.push(`the recorder's name \`${say(X.label)}\` runs into its key: a shorter \`key\` or label`);
      // no card: the readout on the top row says the reading, and a card would cover it
      svg.querySelectorAll('.rcr').forEach(e => { const i = +e.dataset.r, hit = e.querySelector('.rchit');
        hit.addEventListener('pointerenter', () => R.hot(i)); hit.addEventListener('pointerleave', () => R.hot(null));
        hit.addEventListener('focus', () => { R.focusR = i; svg.querySelectorAll('.rchit').forEach(q => q.setAttribute('tabindex', q === hit ? 0 : -1)); R.hot(i); });
        hit.addEventListener('blur', () => R.hot(null));
        // arrows (and Home, End) move to the next reading; Tab leaves the strip
        hit.addEventListener('keydown', ev => { const k = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[ev.key], to = ev.key === 'Home' ? 0 : ev.key === 'End' ? n - 1 : k != null ? Math.max(0, Math.min(n - 1, i + k)) : null;
          if (to == null) return; ev.preventDefault(); const q = svg.querySelector(`.rcr[data-r="${to}"] .rchit`); if (q) q.focus(); }); });
      const key = svg.querySelector('.rck0'); glow(key, c);
      key.addEventListener('pointerenter', () => { R.keyHot = true; R.paintWl(); if (R.onHot) R.onHot(0); });
      key.addEventListener('pointerleave', () => { R.keyHot = false; R.paintWl(); if (R.onHot) R.onHot(R.hotR == null ? null : 0); });
      R.paintWl(); return false; };
    R.wl = i => ({ c, drawn: i === 0 && env.shown() });
    R.paintWl = () => { svg.classList.toggle('lit', R.wlOn === 0 || R.keyHot); svg.classList.toggle('hov', R.hotR != null);
      svg.querySelectorAll('.rcr').forEach(e => e.classList.toggle('on', +e.dataset.r === R.hotR)); };
    R.wlLight = i => { if (R.wlOn !== i) { R.wlOn = i; R.paintWl(); } };
    R.hot = i => { if (R.hotR === i) return; R.hotR = i; R.paintWl(); if (R.onHot) R.onHot(i == null ? null : 0); };
    return R;
  }

  // ---------- wheel: records that each carry their own colour, round a ring (the C10p mock-up, round 3, idea 3, 11 Nov) ----------
  // One slot per record round the ring, one arc per group (a small gap between groups, a larger one at the top for the track
  // names), the group's name outside its arc. The inner ring is each record's chip in its true colour (`rgb`, three whole
  // numbers 0-255). One track per column (1-3) goes out from the chips; each reading is a spoke from its track's inner edge,
  // its length to scale (one scale over all values, from 0). A column labelled red, green or blue takes its plain light colour
  // (--ch-red, --ch-green, --ch-blue: the theme's mint green reads as teal), any other s1, s2, s3 in order. Names start with a
  // capital (the user, 11 Nov). A lit record (pointing, focus, arrows or `mark: row:N`) rings its chip, brightens its spokes and
  // dims the rest; its readout sits on the top row (no card). Each track is a mark named by its label: a linked word or its name
  // lights it. The figure is wide (the reading column) and wears no frame
  const WH = { top: 44, foot: 34, names: 34, side: 190, ratio: .5, hMin: 480, hMax: 640, chip: 22, gap: 1.5, topGap: 5, rMin: 150 };
  function wheel(p, ctx, at, env) {
    const node = h('div', 'bi wheel'); node.dataset.at = at; node.dataset.from = String(p.from ?? ''); if (p.id) node.dataset.id = p.id;
    const svg = sv('svg', { class: 'wh', role: 'group' }, node);
    const R = { node, issues: [], kind: 'wheel', w: 0, h: 0, linked: new Set(), wlOn: null, keyJ: null, hotR: null, hotJ: null, focusR: 0 };
    const ax = v => typeof v === 'string' ? { key: v, label: v } : v && typeof v === 'object' ? { label: v.key, ...v } : {};
    const C = list(p.cols).slice(0, 3).map(ax), ch = j => String(C[j].label ?? '').trim().toLowerCase();
    R.keys = C.map(c => String(c.label ?? '')); R.cols = C.map((_, j) => ['red', 'green', 'blue'].includes(ch(j)) ? `var(--ch-${ch(j)})` : `var(--s${j + 1})`);
    const esc = t => L.esc(String(t)), say = t => L.plain(String(t ?? ''), ctx.scope), cap = w => w.charAt(0).toUpperCase() + w.slice(1);
    const noun = String(p.from ?? '').replace(/([^s])s$/, '$1');   // "pixels" → "pixel": a record's name in the readout, numbered from 0 as row:N
    const tw = (t, cls) => { const e = sv('text', { class: cls }, svg); e.textContent = t; const w = e.getComputedTextLength ? e.getComputedTextLength() : t.length * 9; e.remove(); return w; };
    const rows = () => { let v = []; try { v = list(L.val(p.from, ctx.scope, `slide ${ctx.index + 1} wheel from`)); } catch (er) { R.issues.push(`the wheel: ${er.message}`); }
      return v.filter(r => r && typeof r === 'object'); };
    const H = W => Math.round(Math.max(WH.hMin, Math.min(WH.hMax, W * WH.ratio)));
    R.size = room => { R.w = Math.round(room.w - PAD); R.h = H(R.w); node.style.width = R.w + 'px'; svg.setAttribute('width', R.w); svg.setAttribute('height', R.h); return R.w + PAD; };
    R.hOf = W => H(W);
    R.layout = () => {
      R.issues = []; const W = R.w, Hh = H(W); R.h = Hh; svg.setAttribute('height', Hh); svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
      const B = rows(), n = B.length, k = C.length, vals = B.map(r => C.map(c => +r[c.key]));
      const ok = r => Array.isArray(r[p.rgb]) && r[p.rgb].length === 3 && r[p.rgb].every(q => Number.isInteger(q) && q >= 0 && q <= 255);
      if (!n || !k || !B.every(ok) || vals.flat().some(v => !Number.isFinite(v) || v < 0)) { R.issues.push(`the wheel draws ${n} records and ${k} columns: each record needs \`${p.rgb}\`, three whole numbers 0-255, and readings that are numbers 0 or more`); svg.innerHTML = ''; return false; }
      const grp = B.map(r => p.group != null ? String(r[p.group] ?? '') : ''), top = Math.max(...vals.flat()) || 1;
      const cx = W / 2, cy = WH.top + (Hh - WH.top - WH.foot) / 2, Rout = Math.min((Hh - WH.top - WH.foot) / 2 - WH.names, W / 2 - WH.side);
      if (Rout < WH.rMin) R.issues.push(`the wheel is ${Math.round(2 * Rout)} px across: give it more room`);
      const r0 = Rout * .24, r1 = r0 + WH.chip + 12, tg = 10, Ln = (Rout - r1 - tg * (k - 1)) / k, base = j => r1 + j * (Ln + tg);
      // the slots: one a record, WH.gap more between groups, WH.topGap at the top for the track names. A group's records sit
      // together in one arc, the arcs in the order of each group's first row and the records in row order inside it; `ang`,
      // `row:N`, the readout's number and the DOM (Tab) order stay the data's row N. `ord` is the ring order, for the arrows
      const gs = [...new Set(grp)], ord = B.map((_, i) => i).sort((a, b) => gs.indexOf(grp[a]) - gs.indexOf(grp[b]) || a - b), pos = [];
      ord.forEach((i, q) => { pos[i] = q; });
      const dt = 2 * Math.PI / (n + WH.gap * (gs.length - 1) + WH.topGap), ang = [];
      let s = WH.topGap / 2 + .5; ord.forEach((i, q) => { if (q && grp[i] !== grp[ord[q - 1]]) s += WH.gap; ang[i] = -Math.PI / 2 + s * dt; s += 1; });
      if (r0 * dt < 4) R.issues.push(`the wheel's chips are ${(Math.floor(r0 * dt * 10) / 10).toFixed(1)} px wide: give it more room, or fewer records`);
      const pt = (a, r) => [cx + r * Math.cos(a), cy + r * Math.sin(a)], f2 = q => q.toFixed(2), sw = Math.max(2, Math.min(5, r1 * dt * .45));
      const sector = (a0, a1, ra, rb) => { const [x0, y0] = pt(a0, ra), [x1, y1] = pt(a1, ra), [x2, y2] = pt(a1, rb), [x3, y3] = pt(a0, rb);
        return `M${f2(x0)},${f2(y0)}A${f2(ra)},${f2(ra)} 0 0 1 ${f2(x1)},${f2(y1)}L${f2(x2)},${f2(y2)}A${f2(rb)},${f2(rb)} 0 0 0 ${f2(x3)},${f2(y3)}Z`; };
      const fv = (j, v) => (C[j].fmt ?? p.fmt) != null ? L.fmt(v, C[j].fmt ?? p.fmt) : exact(v);   // `fmt` wins; else the data's decimals
      let o = '';
      // the arcs: each group's track lines, and its name outside the ring
      const runs = gs.map(g => { const m = ord.filter(i => grp[i] === g); return { g, a0: ang[m[0]] - dt / 2, a1: ang[m[m.length - 1]] + dt / 2 }; });
      runs.forEach(u => { for (let j = 0; j < k; j++) { const r = base(j), [x0, y0] = pt(u.a0, r), [x1, y1] = pt(u.a1, r);
        o += `<path class="wt" data-j="${j}" style="--c:${R.cols[j]}" d="M${f2(x0)},${f2(y0)}A${f2(r)},${f2(r)} 0 ${u.a1 - u.a0 > Math.PI ? 1 : 0} 1 ${f2(x1)},${f2(y1)}"/>`; } });
      // the names sit at their arc's middle; names that touch are pushed apart along the ring, step by step, and one pushed
      // more than a slot from its arc gets a short line back to it
      const gl = runs.filter(u => u.g).map(u => { const t = cap(say(u.g)), am = (u.a0 + u.a1) / 2; return { t, am, a: am, gw: tw(t, 'wg') }; });
      const box = q => { const [tx, ty] = pt(q.a, Rout + 18), c = Math.cos(q.a), anc = c > .3 ? 'start' : c < -.3 ? 'end' : 'middle', y = ty + 6 + Math.sin(q.a) * 6;
        const x0 = anc === 'start' ? tx : anc === 'end' ? tx - q.gw : tx - q.gw / 2; return { tx, y, anc, x0, x1: x0 + q.gw, y0: y - 17, y1: y + 5 }; };   // the 18 px font's box
      const touch = (q, u) => { const e = box(q), f = box(u); return e.x0 < f.x1 + 6 && f.x0 < e.x1 + 6 && e.y0 < f.y1 + 2 && f.y0 < e.y1 + 2; };
      const nb = i => (i < gl.length - 1 || gl.length > 2) && gl.length > 1 ? gl[(i + 1) % gl.length] : null;   // the next name round the ring
      for (let it = 0, moved = true; moved && it < 400; it++) { moved = false; gl.forEach((q, i) => { const u = nb(i); if (u && touch(q, u)) { q.a -= .004; u.a += .004; moved = true; } }); }
      gl.forEach((q, i) => { const e = box(q), u = nb(i);
        if (e.x0 < 0 || e.x1 > W || e.y0 < 0 || e.y1 > Hh) R.issues.push(`the wheel's group name \`${q.t}\` runs out of the figure: a shorter name`);
        if (u && touch(q, u)) R.issues.push(`the wheel's group names \`${q.t}\` and \`${u.t}\` overlap: fewer groups or shorter names`);
        if (Math.abs(q.a - q.am) > dt) { const [x0, y0] = pt(q.am, Rout + 3), [x1, y1] = pt(q.a, Rout + 9); o += `<line class="wgl" x1="${f2(x0)}" y1="${f2(y0)}" x2="${f2(x1)}" y2="${f2(y1)}"/>`; }
        o += `<text class="wg" x="${f2(e.tx)}" y="${f2(e.y)}" text-anchor="${e.anc}">${esc(q.t)}</text>`; });
      // the track names, in the gap at the top, each in its track's colour
      C.forEach((c, j) => { o += `<text class="wtn" data-j="${j}" style="--c:${R.cols[j]}" x="${f2(cx)}" y="${f2(cy - base(j) - Ln / 2 + 5)}" text-anchor="middle">${esc(cap(say(c.label)))}</text>`; });
      // each record: its chip, a spoke a reading, hit areas over the chip and each track's slot, and the readouts (the chip's and
      // each spoke's), which show on the top row when lit
      const nm = i => `${noun} ${i}${grp[i] ? ' · ' + say(grp[i]) : ''}`, ros = B.map((_, i) => `${nm(i)} | ` + C.map((c, j) => `${say(c.label)} ${fv(j, vals[i][j])}`).join(' · '));
      if (Math.max(...ros.map(q => tw(q, 'wo'))) > cx - 40) R.issues.push('the wheel\'s readout runs past the middle of the top row: shorter labels or group names');
      B.forEach((r, i) => { const a = ang[i];
        o += `<g class="wr" data-r="${i}"><path class="wc" d="${sector(a - dt * .42, a + dt * .42, r0, r0 + WH.chip)}" fill="rgb(${r[p.rgb].join(',')})"/><text class="wo" x="0" y="22">${esc(ros[i])}</text>`;
        C.forEach((c, j) => { const [x0, y0] = pt(a, base(j)), [x1, y1] = pt(a, base(j) + vals[i][j] / top * Ln);
          o += `<g class="ws" data-j="${j}" style="--c:${R.cols[j]}"><line class="wsl" x1="${f2(x0)}" y1="${f2(y0)}" x2="${f2(x1)}" y2="${f2(y1)}" stroke-width="${f2(sw)}"/>` +
            `<text class="wo" x="0" y="22">${esc(`${nm(i)} · ${say(c.label)} ${fv(j, vals[i][j])}`)}</text><path class="wx" d="${sector(a - dt / 2, a + dt / 2, base(j) - 2, base(j) + Ln + 2)}"/></g>`; });
        o += `<path class="wx wch" d="${sector(a - dt / 2, a + dt / 2, r0 - 2, r0 + WH.chip + 2)}" tabindex="${i === R.focusR ? 0 : -1}" role="button" aria-label="${esc(ros[i])}"/></g>`; });
      // the key: a short grey spoke and its words, ending on the bottom right
      if (p.key != null) { const kw = say(p.key), kl = W - 8 - tw(kw, 'wkt') - 12;
        o += `<line class="wkl" x1="${f2(kl - 22)}" x2="${f2(kl)}" y1="${Hh - 14}" y2="${Hh - 14}" stroke-width="${f2(sw)}"/><text class="wkt" x="${W - 8}" y="${Hh - 8}" text-anchor="end">${esc(kw)}</text>`; }
      svg.innerHTML = o; svg.setAttribute('aria-label', `${n} ${p.from} round a wheel: ${C.map(c => say(c.label)).join(', ')}`);
      svg.querySelectorAll('.wr').forEach(e => { const i = +e.dataset.r, hit = e.querySelector('.wch');
        e.querySelectorAll('.wx').forEach(q => { const j = q === hit ? null : +q.parentNode.dataset.j;
          q.addEventListener('pointerenter', () => R.hot(i, j)); q.addEventListener('pointerleave', () => R.hot(null, null)); });
        hit.addEventListener('focus', () => { R.focusR = i; svg.querySelectorAll('.wch').forEach(q => q.setAttribute('tabindex', q === hit ? 0 : -1)); R.hot(i, null); });
        hit.addEventListener('blur', () => R.hot(null, null));
        // arrows (and Home, End) move round the ring; Tab leaves it
        hit.addEventListener('keydown', ev => { const d = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[ev.key], to = ev.key === 'Home' ? ord[0] : ev.key === 'End' ? ord[n - 1] : d != null ? ord[(pos[i] + d + n) % n] : null;
          if (to == null) return; ev.preventDefault(); const q = svg.querySelector(`.wr[data-r="${to}"] .wch`); if (q) q.focus(); }); });
      svg.querySelectorAll('.wtn').forEach(e => { const j = +e.dataset.j;
        e.addEventListener('pointerenter', () => { R.keyJ = j; R.paintWl(); if (R.onHot) R.onHot(j); });
        e.addEventListener('pointerleave', () => { R.keyJ = null; R.paintWl(); if (R.onHot) R.onHot(R.hotJ); }); });
      R.paintWl(); return false; };
    R.wl = j => ({ c: R.cols[j], drawn: j < R.keys.length && env.shown() });
    R.paintWl = () => { const lt = R.wlOn ?? R.keyJ; svg.classList.toggle('hov', R.hotR != null); svg.classList.toggle('lnk-dim', lt != null);
      svg.querySelectorAll('.wr').forEach(e => { const on = +e.dataset.r === R.hotR; e.classList.toggle('on', on); e.querySelector(':scope > .wo').classList.toggle('vis', on && R.hotJ == null);
        e.querySelectorAll('.ws').forEach(q => q.querySelector('.wo').classList.toggle('vis', on && +q.dataset.j === R.hotJ)); });
      svg.querySelectorAll('[data-j]').forEach(e => e.classList.toggle('lnk-on', +e.dataset.j === lt)); };
    R.wlLight = j => { if (R.wlOn !== j) { R.wlOn = j; R.paintWl(); } };
    R.hot = (i, j) => { if (R.hotR === i && R.hotJ === j) return; R.hotR = i; R.hotJ = j; R.paintWl(); if (R.onHot) R.onHot(j); };
    return R;
  }

  // ---------- pileup: counts in two runs as a genome browser's read pileup (the C10p S6 mock-up, "2, read pileup", 12 Nov) ----------
  // One chromosome line across the figure, a tick for every base; on it a bar per group (a gene) in its colour with its name over it,
  // and a cut mark per row (a guide) with the row's name under the line. The first run's counts pile up above the line and the
  // second run's hang below it, one stack of dots per repeat; a small culture dish sits before each run's name. One dot is `per`
  // counts: the smallest 1, 2 or 5 × 10^k that keeps the fullest stack to PU.most dots. Dots are packed, so a stack's height reads at
  // a glance and its dots can still be counted. No count shows at rest (the user, 11 Nov). A lit stack (pointing, focus, arrows,
  // `mark: cell:N:key`) shows its readout on the top row, a lit row (`mark: row:N`) its counts, and `mark: col:key` lights one
  // sample's stacks; the rest dim. Each group is a mark named by its value: a linked word. No frame and no card. The lint's limits
  // (lesson_lint.py PILEUP_*) keep a stack's dots and names readable
  const PU = { top: 46, foot: 46, band: 72, gap: 30, sGap: 7, right: 30, dish: 26, most: 30, pitch: 16, dot: 5.5, dotMin: 2.2, half: 240, halfMin: 72, char: 9.5 };
  const puPer = top => { if (!(top > 0) || !Number.isFinite(top)) return 1; for (let e = 1; ; e *= 10) for (const m of [1, 2, 5]) if (Math.ceil(top / (m * e)) <= PU.most) return m * e; };
  let puNo = 0;
  function pileup(p, ctx, at, env) {
    const node = h('div', 'bi pileup'); node.dataset.at = at; node.dataset.from = String(p.from ?? ''); if (p.id) node.dataset.id = p.id;
    const svg = sv('svg', { class: 'pu', role: 'group' }, node), uid = `pu${++puNo}`;
    const R = { node, issues: [], kind: 'pileup', w: 0, h: 0, linked: new Set(), wlOn: null, hotS: null, hotG: null, focusS: 0, S: [], gi: [] };
    const runs = p.runs && typeof p.runs === 'object' && !Array.isArray(p.runs) ? Object.entries(p.runs).map(([n, cs]) => ({ name: n, cols: list(cs).map(String) })) : [];
    const unit = String(p.unit ?? 'reads'), esc = t => L.esc(String(t)), say = t => L.plain(String(t ?? ''), ctx.scope);
    const rows = () => { let v = []; try { v = list(L.val(p.from, ctx.scope, `slide ${ctx.index + 1} pileup from`)); } catch (er) { R.issues.push(`the pileup: ${er.message}`); }
      return v.filter(r => r && typeof r === 'object'); };
    const gOf = r => String(r[p.group] ?? '').trim();
    R.keys = [...new Set(rows().map(gOf))]; R.cols = R.keys.map((_, i) => col(list(p.colors)[i] || `s${i + 1}`));
    const pen = (pts, seed, closed = false, amp = .6) => (L.ink && L.ink.hand) ? L.ink.hand(pts, seed, closed, amp) : 'M' + pts.map(q => q.join(' ')).join('L') + (closed ? 'Z' : '');
    const ring = (cx, cy, r) => Array.from({ length: 20 }, (_, k) => [cx + r * Math.cos(Math.PI * k / 10), cy + r * Math.sin(Math.PI * k / 10)]);
    const tw = (t, cls) => { const e = sv('text', { class: cls }, svg); e.textContent = t; e.style.display = 'inline'; const w = e.getComputedTextLength ? e.getComputedTextLength() : t.length * 9; e.remove(); return w; };
    // the shape, from the width alone (so a size pass and the drawing agree): the slots and stack widths, then the pack (the number
    // of dots across a stack whose pitch is largest while the fullest stack stays within PU.half), then the height, which is the
    // tallest first-run stack above the band and the tallest second-run stack below it
    const geo = W => { const B = rows(), n = B.length, reps = runs.length ? runs[0].cols.length : 0;
      if (runs.length !== 2 || !reps || runs[1].cols.length !== reps || !n) return { bad: `the pileup needs rows in \`${p.from}\` and two runs of the same number of columns`, H: PU.top + PU.foot + PU.band + 2 * PU.halfMin };
      const V = B.map(r => runs.map(run => run.cols.map(c => +r[c])));
      if (V.flat(2).some(v => !(Number.isInteger(v) && v >= 0))) return { bad: 'the pileup\'s counts are not all whole numbers from 0', H: PU.top + PU.foot + PU.band + 2 * PU.halfMin };
      const per = puPer(Math.max(0, ...V.flat(2))), dots = v => Math.round(v / per), most = Math.max(1, ...V.flat(2).map(dots));
      const gi = B.map(r => Math.max(0, R.keys.indexOf(gOf(r))));
      let ch = 0; const gch = gi.map((g, i) => (i && g !== gi[i - 1] ? ++ch : ch));
      const LG = Math.round(2 + PU.dish + Math.max(...runs.map(r => say(r.name).length)) * PU.char + 24), RM = PU.right;
      const slotW = (W - LG - RM - ch * PU.gap) / n, sw = (slotW - 16 - (reps - 1) * PU.sGap) / reps;
      // the pitch only shrinks as more dots go across, so the first count that fits is the best; with none, six across
      let A = 6, pitch = Math.min(PU.pitch, sw / 6);
      for (let a = 1; a <= 6; a++) { const q = Math.min(PU.pitch, sw / a); if (Math.ceil(most / a) * q <= PU.half) { A = a; pitch = q; break; } }
      const tall = a => Math.max(0, ...V.map(r => Math.max(...r[a].map(dots)))), up = Math.max(PU.halfMin, Math.ceil(tall(0) / A) * pitch + 8), down = Math.max(PU.halfMin, Math.ceil(tall(1) / A) * pitch + 8);
      const mid = PU.top + up + PU.band / 2;
      return { B, n, reps, V, per, dots, gi, gch, ch, LG, RM, slotW, sw, A, pitch, rd: Math.min(PU.dot, pitch * .36), up, down, mid, H: Math.round(mid + PU.band / 2 + down + PU.foot) }; };
    R.size = room => { R.w = Math.round(room.w - PAD); R.h = geo(R.w).H; node.style.width = R.w + 'px'; svg.setAttribute('width', R.w); svg.setAttribute('height', R.h); return R.w + PAD; };
    R.hOf = W => geo(W).H;
    R.layout = () => {
      R.issues = []; const W = R.w, G = geo(W), Hh = G.H; R.h = Hh; svg.setAttribute('height', Hh); svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
      if (G.bad) { R.issues.push(G.bad); svg.innerHTML = ''; return false; }
      const { B, n, reps, V, per, gi, gch, LG, RM, slotW, sw, A, pitch, rd, up, down, mid } = G; R.gi = gi;
      const DG = PU.dish, gx = i => LG + (i + .5) * slotW + gch[i] * PU.gap, f1 = q => q.toFixed(1), f2 = q => q.toFixed(2);
      if (!(rd >= PU.dotMin)) R.issues.push(`the pileup's dots are ${(2 * Math.max(0, rd)).toFixed(1)} px: give it more room, or fewer rows or repeats`);
      if (Math.ceil(G.dots(Math.max(...V.flat(2))) / A) * pitch > PU.half) R.issues.push(`the pileup's fullest stack is taller than ${PU.half} px: give it more room, or fewer rows or repeats`);
      const wide = B.map(r => say(r[p.name])).find(t => tw(t, 'pul') > slotW - 4);
      if (wide != null) R.issues.push(`the pileup's row name \`${wide}\` is wider than its slot (${Math.round(slotW)} px): shorter names, or fewer rows`);
      // the chromosome: one long line across, a tick for every base
      let o = `<g class="puchr"><path class="puln" d="${pen([[LG - 10, mid], [W - RM + 6, mid]], uid + 'chr', false, .4)}"/>`;
      for (let x = LG - 6; x < W - RM; x += 7) o += `<line class="putk" x1="${x}" x2="${x}" y1="${mid - 2.5}" y2="${mid + 2.5}"/>`;
      o += '</g>';
      // the runs' names at the left, each after a culture dish, with an arrow out from the line: the first piles up, the second hangs down
      runs.forEach((run, a) => { const s = a ? 1 : -1, y = mid + s * (PU.band / 2 + (a ? down : up) / 2), ya = mid + s * (PU.band / 2 + 6), yb = y + s * 26;
        o += `<g class="purun"><path class="pudsh" d="${pen(ring(13, y, 9), uid + 'd' + a, true, .2)}"/><path class="pudsh pudw" d="${pen(ring(13, y, 6.5), uid + 'w' + a, true, .2)}"/>` +
          [[-.3, -.15], [.25, -.25], [0, .3]].map(([dx, dy]) => `<circle class="pucell" cx="${f1(13 + dx * 9)}" cy="${f1(y + dy * 9)}" r="1.5"/>`).join('') +
          `<text class="pul" x="${2 + DG}" y="${f1(y + 6)}">${esc(say(run.name))}</text>` +
          `<path class="puar" d="${pen([[LG - 14, ya], [LG - 14, yb]], uid + 'a' + a, false, .2)}"/><path class="puar" d="M${LG - 18} ${f1(yb - s * 5)}L${LG - 14} ${f1(yb)}L${LG - 10} ${f1(yb - s * 5)}"/></g>`; });
      // a bar per group on the line, in its colour, its name over it
      R.keys.forEach((g, k) => { const rs = gi.map((q, i) => (q === k ? i : -1)).filter(i => i >= 0); if (!rs.length) return;
        const x0 = gx(rs[0]) - slotW / 2 + 6, x1 = gx(rs[rs.length - 1]) + slotW / 2 - 6;
        if (tw(say(g), 'pun') > x1 - x0 + slotW / 2) R.issues.push(`the pileup's group name \`${say(g)}\` is wider than its bar: a shorter name`);
        o += `<g class="pug" data-g="${k}" style="--c:${R.cols[k]}"><rect class="pub" x="${f1(x0)}" y="${mid - 5}" width="${f1(x1 - x0)}" height="10" rx="3"/>` +
          `<text class="pun" x="${f1((x0 + x1) / 2)}" y="${f1(mid - 14)}" text-anchor="middle">${esc(say(g))}</text></g>`; });
      // each row: its cut mark and name; its stacks, each with its readout (shown only when lit) and its own touch area
      const stackSays = (i, a, k) => `${say(B[i][p.name])} · ${say(R.keys[gi[i]])} · ${say(runs[a].name)}${reps > 1 ? ' ' + (k + 1) : ''}: ${L.fmt(V[i][a][k])} ${unit}`;
      const rowSays = i => `${say(B[i][p.name])} · ${say(R.keys[gi[i]])} · ` + runs.map((run, a) => `${say(run.name)} ${V[i][a].map(v => L.fmt(v)).join(', ')}`).join(' · ') + ` ${unit}`;
      const ry = PU.top - 20; let j = 0, roW = 0; R.S = [];
      B.forEach((r, i) => { const x = gx(i);
        roW = Math.max(roW, tw(rowSays(i), 'puo'));
        o += `<g class="pur" data-r="${i}" data-g="${gi[i]}" style="--c:${R.cols[gi[i]]}">` +
          `<path class="puc" d="M${f1(x - 2)} ${mid - 6}L${f1(x + 2)} ${mid + 6}"/><text class="pul puname" x="${f1(x)}" y="${f1(mid + 28)}" text-anchor="middle">${esc(say(r[p.name]))}</text>` +
          `<text class="puo puro" x="${f1(W / 2)}" y="${ry}" text-anchor="middle">${esc(rowSays(i))}</text>`;
        runs.forEach((run, a) => { const s = a ? 1 : -1, y0 = mid + s * PU.band / 2;
          run.cols.forEach((key, k) => { const v = V[i][a][k], nd = Math.round(v / per), sx = x - slotW / 2 + 8 + k * (sw + PU.sGap), off = (sw - A * pitch) / 2, t = stackSays(i, a, k);
            R.S.push({ i, a, k }); roW = Math.max(roW, tw(t, 'puo'));
            o += `<g class="pus" data-r="${i}" data-col="${esc(key)}" data-s="${j}" data-n="${nd}"><line class="puf" x1="${f1(sx)}" x2="${f1(sx + sw)}" y1="${y0}" y2="${y0}"/>`;
            for (let q = 0; q < nd; q++) o += `<circle class="pud" cx="${f2(sx + off + (q % A + .5) * pitch)}" cy="${f2(y0 + s * (Math.floor(q / A) + .5) * pitch)}" r="${f2(rd)}"/>`;
            o += `<text class="puo" x="${f1(W / 2)}" y="${ry}" text-anchor="middle">${esc(t)}</text>` +
              `<rect class="puh" x="${f1(sx - 2)}" y="${f1(a ? y0 : y0 - up)}" width="${f1(sw + 4)}" height="${f1(a ? down : up)}" tabindex="${j === R.focusS ? 0 : -1}" role="button" aria-label="${esc(t)}"/></g>`;
            j++; }); });
        o += '</g>'; });
      if (roW > W - 8) R.issues.push(`the pileup's readout (${Math.round(roW)} px) is wider than the figure: shorter names`);
      // the key: one dot and what it stands for, at the bottom right
      const kw = per === 1 ? `Each dot is one of the ${unit}.` : `One dot is ${L.fmt(per)} ${unit}.`, kx = W - RM, ky = Hh - 12, kwW = tw(kw, 'puk');
      if (kwW + 24 > W - 8) R.issues.push(`the pileup's key (${Math.round(kwW)} px) is wider than the figure: a shorter unit`);
      o += `<g class="pukey"><circle class="pud0" cx="${f1(kx - kwW - 10)}" cy="${ky - 6}" r="${f2(Math.max(rd, 3))}"/><text class="puk" x="${kx}" y="${ky}" text-anchor="end">${esc(kw)}</text></g>`;
      svg.innerHTML = o; svg.setAttribute('aria-label', `${say(unit)} for ${n} rows on one line: ${say(runs[0].name)} above, ${say(runs[1].name)} below. ${kw}`);
      svg.querySelectorAll('.pur, .pug').forEach(e => glow(e, R.cols[+e.dataset.g]));
      // pointing, focus and arrows: left and right step through the stacks in order, up and down cross to the other run's stack
      const hits = [...svg.querySelectorAll('.puh')];
      hits.forEach((hit, q) => { hit.addEventListener('pointerenter', () => R.hot(q)); hit.addEventListener('pointerleave', () => R.hot(hits.indexOf(document.activeElement) >= 0 ? hits.indexOf(document.activeElement) : null));
        hit.addEventListener('focus', () => { R.focusS = q; hits.forEach(e => e.setAttribute('tabindex', e === hit ? 0 : -1)); R.hot(q); });
        hit.addEventListener('blur', () => R.hot(null));
        hit.addEventListener('keydown', ev => { const S = R.S[q], d = { ArrowLeft: -1, ArrowRight: 1 }[ev.key];
          const up = { ArrowUp: 0, ArrowDown: 1 }[ev.key], to = ev.key === 'Home' ? 0 : ev.key === 'End' ? hits.length - 1 : d != null ? Math.max(0, Math.min(hits.length - 1, q + d))
            : up != null ? R.S.findIndex(o2 => o2.i === S.i && o2.k === S.k && o2.a === up) : null;
          if (to == null || to < 0) return; ev.preventDefault(); hits[to].focus(); }); });
      svg.querySelectorAll('.pug').forEach(e => { const k = +e.dataset.g; e.addEventListener('pointerenter', () => R.hoverG(k)); e.addEventListener('pointerleave', () => R.hoverG(null)); });
      R.paintWl(); return false; };
    R.wl = i => ({ c: R.cols[i], drawn: i < R.keys.length && env.shown() });
    R.paintWl = () => { const g = R.wlOn ?? R.hotG; svg.classList.toggle('lnk', g != null); svg.classList.toggle('hov', R.hotS != null);
      svg.querySelectorAll('.pug, .pur').forEach(e => e.classList.toggle('lnk-on', +e.dataset.g === g));
      svg.querySelectorAll('.pus').forEach(e => e.classList.toggle('on', +e.dataset.s === R.hotS)); };
    R.wlLight = i => { if (R.wlOn !== i) { R.wlOn = i; R.paintWl(); } };
    const gNow = () => (R.hotS != null && R.S[R.hotS] ? R.gi[R.S[R.hotS].i] : R.hotG);
    R.hot = q => { if (R.hotS === q) return; R.hotS = q; R.paintWl(); if (R.onHot) R.onHot(gNow() ?? null); };
    R.hoverG = k => { if (R.hotG === k) return; R.hotG = k; R.paintWl(); if (R.onHot) R.onHot(gNow() ?? null); };
    return R;
  }

  // ---------- space: a 3D coordinate space the learner turns by dragging, the plane's sibling ----------
  // An orbit about the middle of the axes box (yaw free, pitch held between −10° and 80°), mild perspective and a depth fade.
  // Every piece is drawn far to near (the painter's rule): lines are cut into pieces and the sheet into cells, so a dot in front
  // of the sheet and one behind it sort right. One unit is one length on every axis, so a right angle looks right. The kit sizes
  // the axes: just past the farthest point any mark reaches at every control's ends, so a slider never rescales the space.
  // It never turns on its own. The figure carries no names but the axes'; the legend names the marks and lights them.
  const vadd = (u, w) => u.map((v, i) => v + w[i]), vsub = (u, w) => u.map((v, i) => v - w[i]), vmul = (u, k) => u.map(v => v * k);
  const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], vlen = a => Math.sqrt(vdot(a, a)), vlerp = (u, w, k) => u.map((v, i) => v + (w[i] - v) * k);
  const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], vunit = a => vmul(a, 1 / (vlen(a) || 1));
  // an orthonormal basis of the line along U, or of the plane spanned by U and V (Gram–Schmidt, done twice for accuracy).
  // null when U is zero, or when V lies so close to U's line (sine of their angle under THIN) that the plane cannot be trusted
  const THIN = 1e-6;
  const span = (U, V) => { const lu = vlen(U); if (!(lu > 0)) return null; const e1 = vmul(U, 1 / lu); if (!V) return [e1];
    let w = vsub(V, vmul(e1, vdot(V, e1))); w = vsub(w, vmul(e1, vdot(w, e1))); const lv = vlen(V), lw = vlen(w);
    return lv > 0 && lw / lv >= THIN ? [e1, vmul(w, 1 / lw)] : null; };
  // the least-squares drop of p onto that line or plane, the same point as c = (SᵀS)⁻¹ Sᵀ p with S = [U V], without forming SᵀS
  const footOn = (p, U, V) => { const B = span(U, V); return B && B.reduce((f, e) => vadd(f, vmul(e, vdot(p, e))), [0, 0, 0]); };
  // a dot's true colour from its optical density: 255·10^(−OD) per channel, clipped to 0–255
  const odHex = od => toHex(od.map(v => 10 ** -v), 1);
  const rgbs = {}, cssRGB = c => { if (!(c in rgbs)) { const q = document.createElement('span'); q.style.color = c; document.body.appendChild(q);
    const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(q).color); q.remove(); rgbs[c] = m ? m[1].split(',').slice(0, 3).map(Number) : [162, 159, 151]; } return rgbs[c]; };
  const glowOf = c => { glow(document.createElement('span'), c); return glows[c]; };
  const SPACE = ['points', 'point', 'ring', 'vector', 'sheet', 'foot', 'segment', 'text', 'guess', 'split'];   // a mark's kind; `ring: true` on a point is a field
  // a foot is teal, not accent, so its linked word is told apart from a ringed point's accent ring
  const SDEF = { points: 'mist', point: 'ink', ring: 'ink', vector: 'ink', sheet: 'mist', foot: 's2', segment: 'mist', text: 'mist', guess: 's4', split: 'mist' };
  // the look was picked at the bench's size, a longest axis of 2.6 OD units: perspective (focal 5), the depth fade and the
  // right-angle mark are in those units, and scale with each space
  const OD0 = 2.6, FOCAL = 5, RAD = Math.PI / 180, PMIN = -10, PMAX = 80, HOME = [38, 20], SHAPE3 = 4 / 3;
  const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tw = (() => { let cv = null; return (t, fs) => { cv = cv || document.createElement('canvas').getContext('2d'); cv.font = `500 ${fs}px Inter, system-ui, sans-serif`; return cv.measureText(t).width; }; })();
  let spaceNo = 0;

  function space(p, ctx, clickOf, at) {
    const no = spaceNo++, node = h('div', 'bi space fr'); node.dataset.at = at; if (p.id) node.dataset.id = p.id;
    const leg = h('div', 'plegend'); node.appendChild(leg);
    const wrap = h('div', 'pwrap swrap'), axn = list(p.axes).map(t => L.plain(String(t ?? ''), ctx.scope)); node.appendChild(wrap);
    wrap.tabIndex = 0; wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', `a 3D space of ${axn.join(', ')}: drag or press the arrow keys to turn it, + and − to zoom, 0 to fit`);
    const svg = sv('svg', { class: 'pl', 'aria-hidden': 'true' }, wrap);
    const marks = list(p.marks).map((mk, i) => ({ mk: mk && typeof mk === 'object' ? mk : {}, i }));
    const kindOf = mk => SPACE.find(k => mk[k] != null && !(k === 'ring' && mk.point != null));
    const tools = h('div', 'stools', '<button type="button" data-z="in" aria-label="zoom in">+</button><button type="button" data-z="out" aria-label="zoom out">−</button>' +
      '<button type="button" class="wd" data-z="fit" aria-label="fit the space to the figure">fit</button>' +
      (marks.some(m => m.mk.sheet != null) ? '<button type="button" class="wd" data-z="edge" aria-label="look along the sheet">edge</button>' : '') + '<span class="zl"></span>');
    const R = { node, issues: [], later: [], past: new Set(), kind: 'space', w: 0, h: 0, leg: LEG, c: 1e9 };
    const where = `slide ${ctx.index + 1} space`, scene = (ctx.deck.slides || [])[ctx.index] || {}, S = ctx.symbols || {};
    const symOfV = v => typeof v === 'string' && /^[A-Za-z_]\w*$/.test(v) && S[v] ? S[v] : null;
    // a position: a name or expression that gives 3 numbers, or a written triple of expressions
    const pos = (v, sc, bad, what) => { const xv = Array.isArray(v) ? v.map(q => L.val(q, sc, where)) : L.val(v, sc, where);
      if (Array.isArray(xv) && xv.length === 3 && xv.every(q => typeof q === 'number' && Number.isFinite(q))) return xv;
      if (bad) bad.push(`${what} ${JSON.stringify(v)} is not 3 numbers`); return null; };
    // what a mark draws, worked out at a scope: its kind, its points in space (`pts`, for sizing) and what drawing it needs
    const outRange = (f, U, V, names, what, bad) => { if (!f) return; const uu = vdot(U, U), uv = vdot(U, V), vv = vdot(V, V), pu = vdot(f, U), pv = vdot(f, V), det = uu * vv - uv * uv;
      const am = [(vv * pu - uv * pv) / det, (uu * pv - uv * pu) / det];
      names.forEach((n, j) => { const [lo, hi] = rangeOf(ctx, n); if (Number.isFinite(lo) && Number.isFinite(hi) && !(am[j] >= lo - 1e-9 && am[j] <= hi + 1e-9)) bad.push(`${what} needs ${L.fmt(am[j], 3)} of ${j ? 'the second' : 'the first'} direction, outside the drag range ${L.fmt(lo, 3)} to ${L.fmt(hi, 3)}: the learner cannot reach it`); }); };
    const geo = (mk, sc, bad) => { const k = kindOf(mk), q = (v, w) => pos(v, sc, bad, w), g = { k, pts: [] };
      if (k === 'points') { const P = mk.points || {}, rows = list(L.val(P.from, sc, where));
        g.rows = rows.map(r => ({ r, at: r && typeof r === 'object' ? pos(r[P.at], sc) : null })).filter(row => row.at); g.pts = g.rows.map(row => row.at);
        if (bad && g.rows.length < rows.length) bad.push(`${rows.length - g.rows.length} of ${rows.length} rows of ${P.from} have no 3 numbers under \`${P.at}\``); }
      else if (k === 'point' || k === 'ring' || k === 'text') { g.p = q(k === 'text' ? mk.at : mk[k], k === 'text' ? 'text at' : k); if (g.p) g.pts = [g.p]; }
      else if (k === 'vector') { g.o = mk.from != null ? q(mk.from, 'from') : [0, 0, 0]; const v = q(mk.vector, 'vector'); if (g.o && v) { g.e = vadd(g.o, v); g.pts = [g.o, g.e]; } }
      else if (k === 'segment') { const [a, b] = list(mk.segment).map(x => q(x, 'segment end')); if (a && b) Object.assign(g, { a, b, pts: [a, b] }); }
      else if (k === 'sheet') { const [U, V] = list(mk.sheet).map(x => q(x, 'sheet vector')), ab = [...list(mk.min ?? [0, 0]), ...list(mk.max)].map(x => L.val(x, sc, where));
        if (U && V && ab.length === 4 && ab.every(Number.isFinite)) { Object.assign(g, { U, V, ab, thin: !span(U, V), at: (a, b) => vadd(vmul(U, a), vmul(V, b)) }); g.pts = [g.at(ab[0], ab[1]), g.at(ab[2], ab[1]), g.at(ab[2], ab[3]), g.at(ab[0], ab[3])];
          if (g.thin && bad) bad.push(`its two vectors are zero or nearly point the same way (sine of their angle under ${THIN}): the sheet is a line, and \`edge\` cannot look along it`); } }
      else if (k === 'foot') { const F = mk.foot || {}, P = q(F.from, 'foot from'), ws = (Array.isArray(F.onto) && F.onto.length === 2 ? F.onto : [F.onto]).map(x => q(x, 'foot onto'));
        if (P && ws.every(Boolean)) { const f = footOn(P, ws[0], ws[1]); if (f && f.every(Number.isFinite)) Object.assign(g, { P, f, ws, pts: [P, f] });
          else if (bad) bad.push(ws[1] ? `it drops onto two vectors that are zero or nearly point the same way (sine of their angle under ${THIN}), so their plane cannot be trusted: no drop is drawn` : 'it drops onto a zero vector: no drop is drawn'); } }
      // a guess a·U + b·V on the sheet (a, b are controls) with its line from P; a split of a·U + b·V into its two parts
      else if (k === 'guess') { const [U, V] = list(mk.on).map(x => q(x, 'guess on')), ab = list(mk.guess).map(x => L.val(x, sc, where)), P = q(mk.from, 'guess from'), wv = mk.was != null ? list(mk.was).map(x => L.val(x, sc, where)) : null;
        if (U && V && !span(U, V)) { if (bad) bad.push('its two directions are zero or nearly parallel, so they make no sheet: no guess and no nearest point are drawn'); }
        else if (U && V && P && ab.length === 2 && ab.every(Number.isFinite)) { if (bad) outRange(footOn(P, U, V), U, V, list(mk.guess), 'the nearest point', bad); Object.assign(g, { U, V, P, ab, p: vadd(vmul(U, ab[0]), vmul(V, ab[1])), f: footOn(P, U, V), w: wv && wv.every(Number.isFinite) ? vadd(vmul(U, wv[0]), vmul(V, wv[1])) : null }); g.pts = [g.p, P]; } }
      else if (k === 'split') { const [U, V] = list(mk.split).map(x => q(x, 'split vector')), ab = list(mk.by).map(x => L.val(x, sc, where));
        if (U && V && !span(U, V)) { if (bad) bad.push('its two directions are zero or nearly parallel: no parts are drawn'); }
        else if (U && V && ab.length === 2 && ab.every(Number.isFinite)) { const T0 = mk.to != null ? q(mk.to, 'split to') : null, f0 = T0 && footOn(T0, U, V);
          if (bad && f0) { const off = vlen(vsub(T0, f0)); if (off > 1e-9 * Math.max(1, vlen(T0))) bad.push(`its point ${mk.to} sits ${L.fmt(off, 3)} off the sheet, so no two parts reach it: split its foot instead`); else outRange(f0, U, V, list(mk.by), `${mk.to}`, bad); }
          Object.assign(g, { U, V, ab, A: vmul(U, ab[0]), B: vmul(V, ab[1]) }); g.T = vadd(g.A, g.B); g.pts = [[0, 0, 0], g.A, g.B, g.T]; } }
      return g; };

    // the axes: from 0 (lower if a mark goes below 0) to just past the farthest point any mark reaches, rounded up to the floor
    // grid's step. Each control takes 5 evenly spaced values on its step (a toggle its 2); all combinations when they are 4096
    // or fewer, else every corner (up to 10 controls), each control's values alone and 2000 combinations drawn with a fixed
    // seed. A later redraw that still finds a mark outside warns (R.past). An axis no mark leaves 0 on gets the longest's length
    const ctls = list(scene.controls).filter(c => c && c.name != null && Number.isFinite(+c.min) && Number.isFinite(+c.max)), v0 = c => +(c.value ?? c.min);
    const valsOf = c => { const a = +c.min, b = +c.max, st = +c.step > 0 ? +c.step : 0;
      return [...new Set([0, 1, 2, 3, 4].map(k => { const v = a + (b - a) * k / 4; return +(st ? Math.min(b, a + Math.round((v - a) / st) * st) : v).toFixed(12); }))]; };
    const axesOf = () => { const n = ctls.length, lo = [0, 0, 0], hi = [0, 0, 0], V = ctls.map(valsOf), all = V.reduce((s, v) => s * v.length, 1);
      let sets = [];
      if (all <= 4096) sets = Array.from({ length: all }, (_, m) => V.map(v => { const x = v[m % v.length]; m = Math.floor(m / v.length); return x; }));
      else { let seed = 20251109; const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
        if (n <= 10) sets = Array.from({ length: 2 ** n }, (_, m) => ctls.map((c, j) => m >> j & 1 ? +c.max : +c.min));
        V.forEach((v, j) => v.forEach(x => sets.push(ctls.map((d, q) => q === j ? x : v0(d)))));
        for (let r = 0; r < 2000; r++) sets.push(V.map(v => v[Math.floor(rnd() * v.length)])); }
      [...sets, ctls.map(v0)].forEach(vs => { const sc = L.scope(ctx.scope, {}); ctls.forEach((c, j) => { sc[c.name] = vs[j]; }); L.derive(sc, scene.derive, where);
        marks.forEach(({ mk }) => geo(mk, sc).pts.forEach(pt => pt.forEach((v, a) => { if (Number.isFinite(v)) { lo[a] = Math.min(lo[a], v); hi[a] = Math.max(hi[a], v); } }))); });
      if (ctx.stripAll && marks.some(({ mk }) => mk.points && mk.points.from === 'window')) { const sc = L.scope(ctx.scope, ctx.stripAll()); L.derive(sc, scene.derive, where);   // a strip's window can go anywhere on the drawing
        marks.forEach(({ mk }) => geo(mk, sc).pts.forEach(pt => pt.forEach((v, a) => { if (Number.isFinite(v)) { lo[a] = Math.min(lo[a], v); hi[a] = Math.max(hi[a], v); } }))); }
      const most = Math.max(...hi.map((v, a) => v - lo[a])) || 1; hi.forEach((v, a) => { if (!(v - lo[a] > 1e-12 * most)) hi[a] = lo[a] + most; });
      const big = Math.max(...hi.map((v, a) => v - lo[a])), nice = q => [1, 2, 5, 10].map(m => m * 10 ** Math.floor(Math.log10(q))).find(s => s >= q - 1e-12);
      const grid = nice(big / 14), tick = nice(big / 6), r = v => +v.toFixed(10), own = p.max != null ? list(p.max).map(x => L.val(x, ctx.scope, where)) : null;
      const top = own && own.length === 3 && own.every(Number.isFinite) ? own : hi.map(v => r(Math.ceil(v / grid - 1e-9) * grid)), bot = lo.map(v => r(Math.floor(v / grid + 1e-9) * grid));
      return { lo: bot, hi: top, grid, tick, own: !!own, unit: Math.max(...top.map((v, a) => v - bot[a])) / OD0 }; };

    // the view: yaw, pitch, scale (pixels per unit) and pan. Fitted, the axes box fills the figure; turning keeps the scale
    // pp is how much perspective there is: 1 (mild) normally, 0 in the edge view, where only a camera at infinity sees a plane
    // as a line; the first turn after it glides back to 1
    const vw = { yaw: HOME[0], pitch: HOME[1], S: 1, ox: 0, oy: 0, vy: 0, vp: 0, pp: 1 };
    let box = null, W = 0, HT = 0, fitS = 1, mid = [0, 0, 0], G = [], hot = null, raf = 0, tween = null, drag = null, toPP = false;
    const orbit = (q0, yw, pt) => { const y = yw * RAD, t = pt * RAD, q = vsub(q0, mid), x1 = q[0] * Math.cos(y) - q[1] * Math.sin(y), y1 = q[0] * Math.sin(y) + q[1] * Math.cos(y);
      return { sx: x1, sy: q[2] * Math.cos(t) + y1 * Math.sin(t), d: (y1 * Math.cos(t) - q[2] * Math.sin(t)) / box.unit }; };   // d > 0 is away from the viewer
    const proj = q => { const o = orbit(q, vw.yaw, vw.pitch), k = FOCAL / (FOCAL + o.d * vw.pp);
      return { x: W / 2 + vw.ox + o.sx * k * vw.S, y: HT / 2 + vw.oy - o.sy * k * vw.S, d: o.d, k: k * (1 - .08 * o.d * vw.pp), fade: Math.max(.5, Math.min(1, 1 - .28 * o.d)) }; };
    const fitFor = (yaw, pitch, pp = vw.pp) => { let u0 = 1e9, u1 = -1e9, w0 = 1e9, w1 = -1e9;
      const cs = (R.focus && R.focus()) || [box.lo[0], box.hi[0]].flatMap(a => [box.lo[1], box.hi[1]].flatMap(b => [box.lo[2], box.hi[2]].map(c => [a, b, c])));
      for (const P0 of cs) { const o = orbit(P0, yaw, pitch), k = FOCAL / (FOCAL + o.d * pp);
        u0 = Math.min(u0, o.sx * k); u1 = Math.max(u1, o.sx * k); w0 = Math.min(w0, o.sy * k); w1 = Math.max(w1, o.sy * k); }
      const s = Math.min((W - 140) / (u1 - u0 || 1), (HT - 68) / (w1 - w0 || 1)); return { yaw, pitch, pp, S: s, ox: -s * (u0 + u1) / 2, oy: s * (w0 + w1) / 2 }; };
    // look along the first sheet, so it shows as a line and a drop onto it meets it at a right angle: of the directions in the
    // sheet (every half degree round it), the one whose pitch is allowed and nearest a gentle 15°, then nearest the yaw now.
    // A view direction D = (sin yaw·cos pitch, cos yaw·cos pitch, −sin pitch)
    const edgeView = () => { const g = G.find(q => q && q.k === 'sheet' && q.U && !q.thin), B = g && span(g.U, g.V); if (!B) return null; let best = null;
      for (let a = 0; a < 720; a++) { const th = a / 2 * RAD, D = vadd(vmul(B[0], Math.cos(th)), vmul(B[1], Math.sin(th))), t = Math.asin(Math.max(-1, Math.min(1, -D[2]))) / RAD;
        if (t < PMIN || t > PMAX || Math.abs(D[2]) > .99999) continue; const y = Math.atan2(D[0], D[1]) / RAD, s = Math.abs(t - 15) + .001 * Math.abs(((y - vw.yaw) % 360 + 540) % 360 - 180);
        if (!best || s < best[2]) best = [y, t, s]; }
      return best && best.slice(0, 2); };

    // `face` looks square on to the first sheet (lengths on it read true); the view direction; how far off edge-on
    const vunit = a => vmul(a, 1 / (vlen(a) || 1));
    const sheetG = () => G.find(q => q && q.k === 'sheet' && q.U && !q.thin);
    const faceView = () => { const g = sheetG(); if (!g) return null; const n = vunit(vcross(g.U, g.V)); let best = null;
      [n, vmul(n, -1)].forEach(D => { const t0 = Math.asin(Math.max(-1, Math.min(1, -D[2]))) / RAD, t = Math.max(-90, Math.min(90, t0)), y = Math.hypot(D[0], D[1]) < 1e-6 ? vw.yaw : Math.atan2(D[0], D[1]) / RAD;
        const off = Math.abs(t - t0); if (!best || off < best[2] - 1e-9 || (Math.abs(off - best[2]) < 1e-9 && Math.abs(t - 45) < Math.abs(best[1] - 45))) best = [y, t, off]; });
      return best && best.slice(0, 2); };   // a named view reaches the exact pitch (a level sheet needs 90°)
    R.dir = () => { const y = vw.yaw * RAD, t = vw.pitch * RAD; return [Math.sin(y) * Math.cos(t), Math.cos(y) * Math.cos(t), -Math.sin(t)]; };
    R.offEdge = () => { const g = sheetG(); return g ? Math.asin(Math.min(1, Math.abs(vdot(R.dir(), vunit(vcross(g.U, g.V)))))) / RAD : 90; };
    // a pointer to the sheet: the a, b whose point a·U + b·V draws nearest it (damped Gauss–Newton from where it is, so seen
    // edge-on it moves only along the line the sheet makes); and to a line: the s whose base + s·D draws nearest
    const solveAB = (U, V, ab0, X, Y) => { let [a, b] = ab0; const at = (p, q) => proj(vadd(vmul(U, p), vmul(V, q)));
      for (let it = 0; it < 10; it++) { const p0 = at(a, b), ex = X - p0.x, ey = Y - p0.y, d = 1e-4, pa = at(a + d, b), pb = at(a, b + d), j11 = (pa.x - p0.x) / d, j21 = (pa.y - p0.y) / d, j12 = (pb.x - p0.x) / d, j22 = (pb.y - p0.y) / d;
        const A11 = j11 * j11 + j21 * j21, A12 = j11 * j12 + j21 * j22, A22 = j12 * j12 + j22 * j22, lam = 1e-4 * (A11 + A22) + 1e-9, g1 = j11 * ex + j21 * ey, g2 = j12 * ex + j22 * ey, det = (A11 + lam) * (A22 + lam) - A12 * A12;
        if (!(Math.abs(det) > 0)) break; const da = ((A22 + lam) * g1 - A12 * g2) / det, db = ((A11 + lam) * g2 - A12 * g1) / det; a += da; b += db; if (Math.hypot(da, db) < 1e-8) break; }
      return [a, b]; };
    const solveS = (base, D, s0, X, Y) => { let s = s0; for (let it = 0; it < 10; it++) { const at = q => proj(vadd(base, vmul(D, q))), p0 = at(s), d = 1e-4, p1 = at(s + d), jx = (p1.x - p0.x) / d, jy = (p1.y - p0.y) / d, jj = jx * jx + jy * jy;
      if (!(jj > 1e-12)) break; const ds = (jx * (X - p0.x) + jy * (Y - p0.y)) / jj; s += ds; if (Math.abs(ds) < 1e-8) break; } return s; };
    const amountsOf = (U, V, f) => { const uu = vdot(U, U), uv = vdot(U, V), vv = vdot(V, V), fu = vdot(f, U), fv = vdot(f, V), det = uu * vv - uv * uv; return Math.abs(det) > 1e-15 ? [(vv * fu - uv * fv) / det, (uu * fv - uv * fu) / det] : null; };
    // a mark that arrives fades in over --m-state (450 ms) on the kit's curve; an axis's tick numbers fade over --m-hover
    const appear = {}; let tkT = 0; R.tk = [1, 1, 1];
    R.alpha = m => { const t0 = appear[m]; if (t0 == null) return 1; if (STILL()) { delete appear[m]; return 1; } const q = (performance.now() - t0) / MSTATE(); if (q >= 1) { delete appear[m]; return 1; } req(); return Math.max(0, easeK()(q)); };
    // the first look's step back multiplies a piece's own opacity (its fade in, a split's faint part), never replaces it; orange never steps back
    const fadeS = (str, m) => { const a = m == null ? 1 : R.alpha(m) * (hot == null && R.rest && !R.rest.has(m) && !str.includes('var(--accent)') ? .4 : 1); if (a >= 1) return str;
      return str.replace(/style="([^"]*)"/, (_, css) => { const o = /(^|;)\s*opacity:([\d.]+)/.exec(css); return `style="${o ? css.replace(o[0], `${o[1]}opacity:${(+o[2] * a).toFixed(3)}`) : `${css};opacity:${a.toFixed(3)}`}"`; }); };
    // ---- drawing: every piece is [depth, svg, mark], sorted far to near; the floor first, ticks, names and hit areas on top
    const n1 = v => v.toFixed(1), lineS = (u0, u1, sty) => `<line x1="${n1(u0.x)}" y1="${n1(u0.y)}" x2="${n1(u1.x)}" y2="${n1(u1.y)}" style="${sty}"/>`;
    const ptsS = qs => qs.map(z => n1(z.x) + ',' + n1(z.y)).join(' ');
    const draw = () => {
      if (!box || W < 40) return;
      const out = [], dots = [], segs = [], u = box.unit, put = (d, s, m) => out.push([d, s, m]);
      const seg = (a, b, n, sty, m, w) => { for (let j = 0; j < n; j++) { const p0 = proj(vlerp(a, b, j / n)), p1 = proj(vlerp(a, b, (j + 1) / n)); put((p0.d + p1.d) / 2, lineS(p0, p1, sty), m); }
        const p0 = proj(a), p1 = proj(b); segs.push([p0.x, p0.y, p1.x, p1.y, w, m]); };   // m: an axis (null) is told from a mark
      const dot = (q, r, sty, m, dz = 0) => { const p0 = proj(q), rr = few ? Math.max(4.5, r * p0.k) : r * p0.k; dots.push([p0.x, p0.y, rr + 2]); put(p0.d - dz, `<circle cx="${n1(p0.x)}" cy="${n1(p0.y)}" r="${n1(rr)}" style="${sty};opacity:${p0.fade.toFixed(2)}"/>`, m); };
      const [x0, y0] = box.lo, [xh, yh] = box.hi, F0 = (x, y) => proj([x, y, 0]);
      let back = `<polygon points="${ptsS([F0(x0, y0), F0(xh, y0), F0(xh, yh), F0(x0, yh)])}" style="fill:rgba(255,255,255,.025);stroke:var(--line-dim);stroke-width:1"/>`;
      for (let v = x0 + box.grid; v < xh - 1e-6; v += box.grid) back += lineS(F0(v, y0), F0(v, yh), 'stroke:var(--grid);stroke-width:1');
      for (let v = y0 + box.grid; v < yh - 1e-6; v += box.grid) back += lineS(F0(x0, v), F0(xh, v), 'stroke:var(--grid);stroke-width:1');
      [0, 1, 2].forEach(a => { const e0 = [0, 0, 0], e1 = [0, 0, 0]; e0[a] = box.lo[a]; e1[a] = box.hi[a]; seg(e0, e1, 8, 'stroke:var(--mist);stroke-width:1;stroke-linecap:square', null, 3); });
      const on = G.filter(g => g && g.st <= R.c);
      // an arrow from o to e, as the vector mark draws one
      const arrow3 = (o, e, cc, w, m, extra = '') => { const L0 = vlen(vsub(e, o)); if (L0 < 1e-12) return; const tip = proj(e), bk = proj(vlerp(o, e, Math.max(0, 1 - .1 * u / L0))), qd = Math.hypot(tip.x - bk.x, tip.y - bk.y) || 1, dx = (tip.x - bk.x) / qd, dy = (tip.y - bk.y) / qd, hl = 16 * headOf(w) * tip.k, hw = 7 * headOf(w) * tip.k, bx = tip.x - dx * hl, by = tip.y - dy * hl;
        seg(o, vlerp(o, e, Math.max(0, 1 - .1 * u / L0 * Math.min(1, .8 * hl / qd))), 6, `stroke:${cc};stroke-width:${w};stroke-linecap:round${extra}`, m, w + 2);
        put(tip.d - .001, `<polygon points="${n1(tip.x)},${n1(tip.y)} ${n1(bx - dy * hw)},${n1(by + dx * hw)} ${n1(bx + dy * hw)},${n1(by - dx * hw)}" style="fill:${cc}${extra}"/>`, m); };
      // a dot shrinks with distance, but never under --dot-min (9 px) across while the figure draws 50 dots or fewer now (rings are not dots)
      const few = on.reduce((n, g) => n + (g.k === 'points' ? g.rows.length : (g.k === 'point' && g.p) || (g.k === 'foot' && g.f) ? 1 : 0), 0) <= 50;
      on.forEach(g => { const { mk, i: m, c } = g;
        if (g.k === 'sheet' && g.U) { const N = 6, [a0, b0, a1, b1] = g.ab;
          for (let p1 = 0; p1 < N; p1++) for (let q1 = 0; q1 < N; q1++) {
            const A0 = a0 + (a1 - a0) * p1 / N, A1 = a0 + (a1 - a0) * (p1 + 1) / N, B0 = b0 + (b1 - b0) * q1 / N, B1 = b0 + (b1 - b0) * (q1 + 1) / N;
            const qs = [g.at(A0, B0), g.at(A1, B0), g.at(A1, B1), g.at(A0, B1)].map(proj), hm = (p1 + .5) / N, em = (q1 + .5) / N, w = hm / (hm + em);
            put(qs.reduce((sum, z) => sum + z.d, 0) / 4 + .004, `<polygon points="${ptsS(qs)}" style="fill:rgba(${g.cV.map((v, j) => Math.round(v + (g.cU[j] - v) * w)).join(',')},${(.05 + .1 * Math.max(hm, em)).toFixed(3)})"/>`, m); }
          g.pts.forEach((z, j) => seg(z, g.pts[(j + 1) % 4], N, `stroke:var(--mist);stroke-width:${lw('data')};stroke-opacity:.75`, m, 2)); }
        else if (g.k === 'vector' && g.e) { const L0 = vlen(vsub(g.e, g.o)); if (L0 < 1e-12) return;
          const w = wOf(c), tip = proj(g.e), bk = proj(vlerp(g.o, g.e, Math.max(0, 1 - .1 * u / L0))), q = Math.hypot(tip.x - bk.x, tip.y - bk.y) || 1, dx = (tip.x - bk.x) / q, dy = (tip.y - bk.y) / q, hl = 16 * headOf(w) * tip.k, hw = 7 * headOf(w) * tip.k, bx = tip.x - dx * hl, by = tip.y - dy * hl;
          seg(g.o, vlerp(g.o, g.e, Math.max(0, 1 - .1 * u / L0 * Math.min(1, .8 * hl / q))), 6, `stroke:${c};stroke-width:${w};stroke-linecap:round`, m, 8);   // the line stops under its head
          put(tip.d - .001, `<polygon points="${n1(tip.x)},${n1(tip.y)} ${n1(bx - dy * hw)},${n1(by + dx * hw)} ${n1(bx + dy * hw)},${n1(by - dx * hw)}" style="fill:${c}"/>`, m); }
        else if (g.k === 'points') g.rows.forEach(row => dot(row.at, 5.5, `fill:${row.hex};stroke:var(--ink);stroke-opacity:.55;stroke-width:1.1`, m));
        else if (g.k === 'point' && g.p && mk.centre === true) { const q = proj(g.p), r = Math.max(9, 11 * q.k), a = r * .55, op = q.fade.toFixed(2);
          dot(g.p, 11, `fill:var(--bg);fill-opacity:.7;stroke:${c};stroke-width:2.6`, m, .002);
          put(q.d - .0025, `<path d="M${n1(q.x - a)},${n1(q.y)}H${n1(q.x + a)}M${n1(q.x)},${n1(q.y - a)}V${n1(q.y + a)}" style="stroke:${c};stroke-width:2.6;stroke-linecap:round;opacity:${op}"/>`, m); }
        else if (g.k === 'point' && g.p) { if (mk.ring === true) dot(g.p, 12.5, `fill:none;stroke:${g.rc};stroke-width:${wOf(g.rc)}`, m, .001); dot(g.p, 8, `fill:${c};stroke:var(--ink);stroke-opacity:.55;stroke-width:1.1`, m, .002); }
        else if (g.k === 'ring' && g.p) dot(g.p, 11.5, `fill:none;stroke:${c};stroke-width:${wOf(c)}`, m, .0005);
        else if (g.k === 'segment' && g.a) seg(g.a, g.b, 6, `stroke:${c};stroke-width:${wOf(c)};stroke-linecap:round${mk.dash ? ';stroke-dasharray:6 4' : ''}`, m, 3);
        else if (g.k === 'foot' && g.f) { const r = vsub(g.P, g.f), n = vlen(r), pa = proj(g.P), pb = proj(g.f);
          if (n >= .015 * u) { put((pa.d + pb.d) / 2, lineS(pa, pb, `stroke:${c};stroke-width:${wOf(c)};stroke-dasharray:6 4`), m); segs.push([pa.x, pa.y, pb.x, pb.y, 3]); }
          if (n >= .02 * u) { const ra = vmul(r, .1 * u / n), fl = vlen(g.f), rb = vmul(fl > 1e-9 ? g.f : g.ws[0], -.1 * u / (fl > 1e-9 ? fl : vlen(g.ws[0]))), qs = [vadd(g.f, ra), vadd(vadd(g.f, ra), rb), vadd(g.f, rb)].map(proj);
            put(qs[1].d, `<polyline points="${ptsS(qs)}" style="fill:none;stroke:${g.c2};stroke-width:${lw('data')}"/>`, m); }
          dot(g.f, 4.7, `fill:var(--bg);stroke:${c};stroke-width:2`, m, .001); }
        // the guess: its line from P (the witness: 3.5 px, a soft glow) and, once revealed, a dashed ghost where it was.
        // The split: h·U from the origin and e·V tip to tail, in their own colours, over the faint parallelogram with e·V from the origin
        else if (g.k === 'guess' && g.p) { const ww = lw('wit');
          seg(g.P, g.p, 6, `stroke:${c};stroke-width:${ww};stroke-linecap:round;filter:drop-shadow(0 0 5px ${glowOf(c)})`, m, ww);
          if (R.revealed && g.w) dot(g.w, 8, `fill:none;stroke:${c};stroke-width:2.5;stroke-dasharray:3 3;stroke-opacity:.6`, m, .001);
          // the gap from the ghost to the foot at the witness's weight, drawn over the sheet: edge-on it lies along the sheet's line
          if (R.revealed && g.w && g.f && vlen(vsub(g.w, g.f)) > 1e-9) { const q0 = proj(g.w), q1 = proj(g.f); put(Math.min(q0.d, q1.d) - .02, lineS(q0, q1, `stroke:var(--mist);stroke-width:${ww};stroke-linecap:round;stroke-dasharray:7 6`), m); } }
        else if (g.k === 'split' && g.A) { const W2 = lw('wit'), O = [0, 0, 0], faint = 'stroke:var(--mist);stroke-width:1.2;stroke-dasharray:4 4;stroke-opacity:.8';
          arrow3(O, g.A, g.cU2, W2, m); arrow3(O, g.B, g.cV2, lw('data'), m, ';opacity:.4'); seg(g.A, g.T, 4, faint, m, 1); seg(g.B, g.T, 4, faint, m, 1);
          arrow3(g.A, g.T, g.cV2, W2, m); dot(g.T, 4.2, 'fill:var(--ink);stroke:none', m, .003); } });
      out.sort((a, b) => b[0] - a[0]);
      // every piece carries its mark's number, so a linked word can dim the other marks
      const told = m => hot == null && !!R.rest && R.rest.has(m); node.classList.toggle('lnk-rest', hot == null && !!R.rest); leg.querySelectorAll('.pk').forEach(e => e.classList.toggle('told', told(+e.dataset.m)));   // the first look
      const lit = (str, m) => m == null ? str : m === hot || told(m) ? str.replace(/^<(\w+) /, `<$1 class="${m === hot ? 'lit' : 'told'}" data-m="${m}" `).replace('style="', `style="--hg:${G[m].hg};`) : str.replace(/^<(\w+) /, `<$1 data-m="${m}" `);
      // tick numbers along each axis, every `tick`, and the boxes the names must clear
      let top = ''; const o0 = proj([0, 0, 0]), placed = [], dec = box.tick < 1 ? Math.max(1, -Math.floor(Math.log10(box.tick) + 1e-9)) : 0;
      const TK = [[], [], []];   // each axis's tick numbers, shown or faded below
      [0, 1, 2].forEach(a => { for (let v = Math.ceil(box.lo[a] / box.tick - 1e-9) * box.tick; v <= box.hi[a] - box.grid + 1e-9; v += box.tick) { if (Math.abs(v) < 1e-9) continue;
        const q = [0, 0, 0]; q[a] = v; const pt = proj(q), L1 = Math.hypot(pt.x - o0.x, pt.y - o0.y) || 1, dx = (pt.x - o0.x) / L1 * Math.sign(v), dy = (pt.y - o0.y) / L1 * Math.sign(v);
        let nx = -dy, ny = dx; if (ny < 0 || (Math.abs(ny) < .2 && nx > 0)) { nx = -nx; ny = -ny; }
        const tx = pt.x + nx * 16, ty = pt.y + ny * 16 + 4; top += lineS(pt, { x: pt.x + nx * 5, y: pt.y + ny * 5 }, 'stroke:var(--mist);stroke-width:1');
        // a number the frame would cut (a zoomed view puts the far ticks outside it) is not drawn
        if (tx - 13 < 4 || tx + 13 > W - 4 || ty - 13 < 4 || ty + 3 > HT - 4) continue;
        TK[a].push({ v: v.toFixed(dec), tx, ty, b: { x: tx - 13, y: ty - 13, w: 26, h: 16 } }); } });
      // a name in a plain word with a halo in the ground colour: the first spot round its anchor that covers no mark, number or name
      const cross = (q, r) => { let t0 = 0, t1 = 1; const dx = q[2] - q[0], dy = q[3] - q[1], ps = [-dx, dx, -dy, dy], qs = [q[0] - r.x, r.x + r.w - q[0], q[1] - r.y, r.y + r.h - q[1]];
        for (let j = 0; j < 4; j++) { if (!ps[j]) { if (qs[j] < 0) return false; continue; } const t = qs[j] / ps[j]; if (ps[j] < 0) { if (t > t1) return false; t0 = Math.max(t0, t); } else { if (t < t0) return false; t1 = Math.min(t1, t); } } return true; };
      const clear = r => r.x >= 6 && r.y >= 6 && r.x + r.w <= W - 6 && r.y + r.h <= HT - 6 && !placed.some(q => r.x < q.x + q.w + 5 && q.x < r.x + r.w + 5 && r.y < q.y + q.h + 3 && q.y < r.y + r.h + 3)
        && !dots.some(([cx, cy, cr]) => Math.hypot(cx - Math.max(r.x, Math.min(cx, r.x + r.w)), cy - Math.max(r.y, Math.min(cy, r.y + r.h))) < cr + 1)
        && !segs.some(q => cross(q, { x: r.x - q[4] / 2 - 3, y: r.y - q[4] / 2 - 3, w: r.w + q[4] + 6, h: r.h + q[4] + 6 }));
      const crowd = [], label = (t, q, pref, cls, fs, centre) => { const pt = proj(q), w = tw(t, fs) + 2, hh = fs + 2; let best = null;
        for (const dist of centre ? [-1, 8, 20, 34] : [6, 14, 26, 40]) { for (let j = 0; j < 16 && !best; j++) { const an = pref + (j % 2 ? 1 : -1) * Math.ceil(j / 2) * Math.PI / 8;
            const r = dist < 0 ? { x: pt.x - w / 2, y: pt.y - hh / 2, w, h: hh } : { x: pt.x + Math.cos(an) * (dist + w / 2) - w / 2, y: pt.y + Math.sin(an) * (dist + hh / 2) - hh / 2, w, h: hh }; if (clear(r)) best = r; } if (best) break; }
        if (!best) { crowd.push(t); best = { x: pt.x + 8, y: pt.y - hh / 2, w, h: hh }; } placed.push(best);
        top += `<text class="${cls}" x="${n1(best.x + 1)}" y="${n1(best.y + fs * .86)}">${L.esc(t)}</text>`; };
      // an axis's numbers fade out while any two of them overlap, one overlaps a number of an axis already kept, or one comes
      // within 8 px of a mark; and back in when the clash ends. Each change takes --m-hover (180 ms); at once with reduced motion
      { const over = (r, o, pad) => r.x < o.x + o.w + pad && o.x < r.x + r.w + pad && r.y < o.y + o.h + pad && o.y < r.y + r.h + pad;
        const nearMark = r => dots.some(([cx, cy, cr]) => Math.hypot(cx - Math.max(r.x, Math.min(cx, r.x + r.w)), cy - Math.max(r.y, Math.min(cy, r.y + r.h))) < cr - 2 + 8)
          || segs.some(sq => sq[5] !== null && cross(sq, { x: r.x - sq[4] / 2 - 8, y: r.y - sq[4] / 2 - 8, w: r.w + sq[4] + 16, h: r.h + sq[4] + 16 }));
        const kept = [], now = performance.now(), dt = Math.min(100, tkT ? now - tkT : 0), still = STILL(); tkT = now;
        [0, 1, 2].forEach(a => { const bs = TK[a].map(t => t.b);
          const tgt = bs.some((r, i) => bs.some((s2, j) => j > i && over(r, s2, 2))) || bs.some(r => kept.some(s2 => over(r, s2, 2))) || bs.some(nearMark) ? 0 : 1;
          if (tgt) kept.push(...bs);
          if (still) R.tk[a] = tgt; else if (dt) { const st = dt / 180; R.tk[a] = tgt > R.tk[a] ? Math.min(tgt, R.tk[a] + st) : Math.max(tgt, R.tk[a] - st); }
          if (R.tk[a] !== tgt) req();
          const al = R.tk[a]; if (al > .01) TK[a].forEach(tk => { top += `<text class="stk" data-ax="${a}" x="${n1(tk.tx)}" y="${n1(tk.ty)}" text-anchor="middle"${al < 1 ? ` style="opacity:${al.toFixed(3)}"` : ''}>${tk.v}</text>`; if (al > .5) placed.push(tk.b); }); }); }
      const framed = !!R.focus(), nearM = r => dots.some(([cx, cy, cr]) => Math.hypot(cx - Math.max(r.x, Math.min(cx, r.x + r.w)), cy - Math.max(r.y, Math.min(cy, r.y + r.h))) < cr - 2 + 8)
        || segs.some(sq => sq[5] !== null && cross(sq, { x: r.x - sq[4] / 2 - 8, y: r.y - sq[4] / 2 - 8, w: r.w + sq[4] + 16, h: r.h + sq[4] + 16 }));
      [0, 1, 2].forEach(a => { if (!axn[a]) return; const e = [0, 0, 0]; e[a] = box.hi[a]; const pt = proj(e), c0 = crowd.length, t0 = top.length; label(axn[a], e, Math.atan2(pt.y - o0.y, pt.x - o0.x), 'sax', 14);
        if (!framed) return; const r = placed[placed.length - 1], bad = crowd.length > c0 || r.x < 0 || r.y < 0 || r.x + r.w > W || r.y + r.h > HT || nearM(r); crowd.length = c0;
        const ax = R.ax || (R.ax = [1, 1, 1]), tgt = bad ? 0 : 1, dt = Math.min(100, R.axT ? performance.now() - R.axT : 0);
        ax[a] = STILL() ? tgt : tgt > ax[a] ? Math.min(tgt, ax[a] + dt / 180) : Math.max(tgt, ax[a] - dt / 180); if (ax[a] !== tgt) req();
        if (ax[a] <= .01) { top = top.slice(0, t0); placed.pop(); } else if (ax[a] < 1) top = top.slice(0, t0) + top.slice(t0).replace('<text ', `<text style="opacity:${ax[a].toFixed(3)}" `); });
      R.axT = performance.now();
      on.forEach(g => { if (g.k === 'text' && g.p) label(L.plain(String(g.mk.text), ctx.scope), g.p, -Math.PI / 4, 'stx', 14, true); });
      // the hit areas, see-through, over everything: the sheet, then lines, then dots, so a dot wins over the sheet it sits on
      const hit = (m, str) => str.replace(/^<(\w+) /, `<$1 class="shit vt says" data-m="${m}" data-vk="sp${no}-${m}" `);
      let hits = '';
      [['sheet'], ['vector', 'segment', 'foot', 'guess', 'split'], ['points', 'point', 'ring']].forEach(ks => on.forEach(g => { if (!g.card || !ks.includes(g.k)) return;
        if (g.k === 'sheet' && g.U) hits += hit(g.i, `<polygon points="${ptsS(g.pts.map(proj))}" style="fill:transparent;stroke:none"/>`);
        else if (g.k === 'vector' && g.e) hits += hit(g.i, lineS(proj(g.o), proj(g.e), 'stroke:transparent;stroke-width:14'));
        else if (g.k === 'segment' && g.a) hits += hit(g.i, lineS(proj(g.a), proj(g.b), 'stroke:transparent;stroke-width:14'));
        else if (g.k === 'foot' && g.f) hits += hit(g.i, lineS(proj(g.P), proj(g.f), 'stroke:transparent;stroke-width:14'));
        else if (g.k === 'guess' && g.p) hits += hit(g.i, lineS(proj(g.P), proj(g.p), 'stroke:transparent;stroke-width:14'));
        else if (g.k === 'split' && g.A) hits += hit(g.i, lineS(proj([0, 0, 0]), proj(g.T), 'stroke:transparent;stroke-width:14'));
        else (g.k === 'points' ? g.pts : g.p ? [g.p] : []).forEach(q => { const pt = proj(q); hits += hit(g.i, `<circle cx="${n1(pt.x)}" cy="${n1(pt.y)}" r="${g.k === 'points' ? 8 : 13}" style="fill:transparent;stroke:none"/>`); }); }));
      const html = back + out.map(([, s, m]) => fadeS(lit(s, m), m)).join('') + top + hits; svg.innerHTML = html;
      // the handles sit on their points: the guess's on the guess, the split's on its two arrow tips
      if (R.hg) { const g = G[R.hgi], shown = !!(g && g.p && g.st <= R.c); R.hg.style.display = shown ? '' : 'none';
        if (shown) { const pt = proj(g.p); R.hg.style.left = n1(pt.x) + 'px'; R.hg.style.top = n1(pt.y) + 'px'; R.hg.classList.toggle('lit', hot === g.i); } }
      if (R.hs) { const g = G.find(q => q && q.k === 'split'), shown = !!(g && g.A && g.st <= R.c);
        R.hs.forEach((b, j) => { b.style.display = shown ? '' : 'none'; if (!shown) return; const pt = proj(j === 0 ? g.A : g.T); b.style.left = n1(pt.x) + 'px'; b.style.top = n1(pt.y) + 'px'; }); }
      svg.querySelectorAll('.shit').forEach(e => { e._pd = G[+e.dataset.m].pd; });
      R.issues = R.base.concat(/NaN|Infinity/.test(html) ? ['the space drew a point that is not a number'] : [], crowd.length ? [`the space's name${crowd.length > 1 ? 's' : ''} ${crowd.map(t => `"${t}"`).join(', ')} cover${crowd.length > 1 ? '' : 's'} a mark at this view`] : []);
      tools.querySelector('.zl').textContent = Math.round(100 * vw.S / fitS) + '%'; };

    // ---- motion: draw only when something changed; a short glide after a drag (none with reduced motion); a tween to a view
    const clampP = q => Math.max(PMIN, Math.min(PMAX, q)), clampH = (cur, nx) => nx > PMAX ? Math.max(PMAX, Math.min(cur, nx)) : nx < PMIN ? Math.min(PMIN, Math.max(cur, nx)) : nx, req = () => { if (!raf) raf = requestAnimationFrame(frame); };
    function frame(now) { raf = 0;
      // the glide: GLIDE ms on the even curve, pulled back PULL at the middle of the move so the figure stays in the plate
      if (tween) { const q = Math.max(0, Math.min(1, (now - tween.t0) / GLIDE)), e = EVEN(q), pull = 1 - PULL * Math.sin(Math.PI * e);
        ['yaw', 'pitch', 'S', 'ox', 'oy', 'pp'].forEach(k => { vw[k] = tween.a[k] + (tween.b[k] - tween.a[k]) * e; }); vw.S *= pull; vw.ox *= pull; vw.oy *= pull; if (q < 1) req(); else { tween = null; if (R.endH) { const e2 = R.endH; R.endH = null; setH(e2); } } }
      if (toPP && !tween) { vw.pp = REDUCED ? 1 : Math.min(1, vw.pp + .05); if (vw.pp < 1) req(); else toPP = false; }
      else if (!drag && (Math.abs(vw.vy) > .02 || Math.abs(vw.vp) > .02)) { vw.yaw += vw.vy; vw.pitch = clampH(vw.pitch, vw.pitch + vw.vp); vw.vy *= .92; vw.vp *= .92; req(); }
      else if (!drag) vw.vy = vw.vp = 0;
      draw(); }
    const goTo = v => { vw.vy = vw.vp = 0; const b = { ...v, yaw: vw.yaw + (((v.yaw - vw.yaw) % 360 + 540) % 360 - 180) };   // the short way round
      if (STILL() || R.instant) { tween = null; Object.assign(vw, b); req(); return; } tween = { a: { ...vw }, b, t0: performance.now() }; req(); };
    // a named view: fit (the start), edge (along the sheet), face (square on to it), or {yaw, pitch}. `instant` jumps (the start view)
    R.goView = (v, instant) => { const nm = v == null ? 'fit' : v; if (!box || !W) { R.pendingView = nm; return; } let yp = null;
      if (nm === 'fit') yp = [...HOME, 1]; else if (nm === 'edge') { const ev = edgeView(); yp = ev && [...ev, 0]; } else if (nm === 'face') { const fv = faceView(); yp = fv && [...fv, 0]; }
      else if (typeof nm === 'object') yp = [+nm.yaw, Math.max(-90, Math.min(90, +nm.pitch)), 1];
      if (!yp) return; R.instant = !!instant; fitNow(...yp); R.instant = false; R.atView = JSON.stringify(nm); R.markWords();
      if (!instant && R.turned) { R.turned = false; R.offer(false); } };   // a chosen view ends the hand-turn hold
    // the camera moves on a press, never because a step arrived. A think's answer that names a view turns the figure, unless the
    // learner has turned it by hand since: then the answer offers its view as a word, as a say step always does
    const sceneOf = () => node.closest('.s-board');
    R.markWords = () => { const sc = sceneOf(); if (sc) sc.querySelectorAll('.vword').forEach(b => { if (!b.spec || b.spec === R.spec) b.classList.toggle('on', b.dataset.view === R.atView); }); };
    R.offer = on => { const sc = sceneOf(); if (sc) sc.querySelectorAll('.ta .vword').forEach(b => { if (b.spec === R.spec) b.classList.toggle('offer', on); }); };
    R.byHand = () => { if (!R.turned) { R.turned = true; R.offer(true); } R.atView = null; R.markWords(); };
    R.answerView = at => { const x = (R.views || []).find(q => q.at === at && q.think); if (x && !R.turned) R.goView(x.v); };
    // in a strip the space is only as tall as the chosen view needs at its width (200 px up to 4:3; the C10j look): a wide, shallow
    // cloud edge-on in a 4:3 box left an empty band. A named view sets it; the box grows before the glide and shrinks when it lands,
    // so nothing is cut on the way. Turning by hand, zooming and dragging the window keep it, so the page below never moves under the learner
    const stripFit = () => !!ctx.stripAll && G.some(g => g && g.k === 'points' && g.mk.points.from === 'window');
    const hFor = (yaw, pitch, pp) => { const ps = R.focus(); if (!ps) return null; let u0 = 1e9, u1 = -1e9, w0 = 1e9, w1 = -1e9;
      for (const P0 of ps) { const o = orbit(P0, yaw, pitch), k = FOCAL / (FOCAL + o.d * pp); u0 = Math.min(u0, o.sx * k); u1 = Math.max(u1, o.sx * k); w0 = Math.min(w0, o.sy * k); w1 = Math.max(w1, o.sy * k); }
      return Math.round(Math.max(200, Math.min(W / SHAPE3, (W - 140) / (u1 - u0 || 1) * (w1 - w0) + 68))); };
    const setH = hh => { if (Math.abs(hh - HT) <= 2) return; vw.oy += (HT - hh) / 2; R.fitH = R.h = HT = hh; wrap.style.height = hh + 'px'; svg.setAttribute('viewBox', `0 0 ${W} ${HT}`); req(); };
    const fitNow = (yaw = vw.yaw, pitch = vw.pitch, pp = vw.pp, keepH) => { if (!box) return; R.endH = null;
      const hh = !keepH && stripFit() ? hFor(yaw, pitch, pp) : null; if (hh) { R.hView = [yaw, pitch, pp]; if (hh > HT) setH(hh); }
      let v; if (hh && hh < HT) { const was = HT; HT = hh; v = fitFor(yaw, pitch, pp); HT = was; v.oy += (hh - was) / 2; } else v = fitFor(yaw, pitch, pp);
      fitS = v.S; toPP = false; goTo(v); if (hh && hh < HT) { if (tween) R.endH = hh; else setH(hh); } };
    R.refit = () => fitNow(vw.yaw, vw.pitch, vw.pp, true);
    const turned = () => { if (vw.pp < 1) { toPP = true; req(); } };   // leaving the edge view: perspective comes back
    // zoom toward a point in the figure: up to 400%; down to the fitted size, or to 50% by pinch, ctrl / ⌘ + scroll or the buttons
    const zoomBy = (f, cx = W / 2, cy = HT / 2, least = .5) => { const S2 = Math.max(Math.min(vw.S, fitS * least), Math.min(fitS * 4, vw.S * f)); f = S2 / vw.S;
      vw.ox = (cx - W / 2) - (cx - W / 2 - vw.ox) * f; vw.oy = (cy - HT / 2) - (cy - HT / 2 - vw.oy) * f; vw.S = S2; tween = null; req(); };
    // what lights a mark: a linked word (pointed, focused or tapped), its legend entry, or the figure under the pointer. Each
    // source holds its own mark, so one letting go leaves the others lit; the pointer wins over a word
    const holds = { word: null, leg: null, fig: null };
    const setHot = (m, by) => { const was = holds.fig ?? holds.leg; holds[by] = m; const now = holds.fig ?? holds.leg ?? holds.word, ptr = holds.fig ?? holds.leg;
      if (now !== hot) { hot = now; req(); } if (by !== 'word' && R.onHot && ptr !== was) R.onHot(ptr); };
    const local = e => { const b = wrap.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    // a drag turns it: no text selection, no focus ring and no highlight from the mouse; the hit areas let go while it turns
    wrap.addEventListener('pointerdown', e => { if (e.button !== 0 || e.target.closest('.stools')) return; e.preventDefault();
      drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), moved: false, id: e.pointerId }; vw.vy = vw.vp = 0; tween = null; });
    // the drawing is redrawn under the pointer, so the page never hears it leave a mark: close this figure's own card here
    const figCard = () => cur && cur !== pinned && cur.classList.contains('shit') && (cur.dataset.vk || '').startsWith(`sp${no}-`);
    wrap.addEventListener('pointermove', e => {
      if (drag && e.buttons === 0) end();   // the button came up where this figure could not hear it
      if (!drag) { const ht = e.target.closest('.stools') ? null : e.target.closest('.shit'); setHot(ht ? +ht.dataset.m : null, 'fig');
        if (figCard() && (!ht || ht.dataset.vk !== cur.dataset.vk)) { popHide(); if (ht && !hoverOff) popShow(ht); } return; }
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 4) return;
      if (!drag.moved) { R.byHand(); drag.moved = true; wrap.classList.add('drag'); try { wrap.setPointerCapture(drag.id); } catch (_) { /* a synthetic pointer */ } if (cur && node.contains(cur)) popHide(); setHot(null, 'fig'); setHot(null, 'leg'); }
      turned(); const dx = e.clientX - drag.x, dy = e.clientY - drag.y; vw.yaw += dx * .4; vw.pitch = clampH(vw.pitch, vw.pitch + dy * .3); vw.vy = dx * .4; vw.vp = dy * .3;
      drag.x = e.clientX; drag.y = e.clientY; drag.t = performance.now(); req(); });
    function end() { if (!drag) return; if (!drag.moved || REDUCED || performance.now() - drag.t > 90) vw.vy = vw.vp = 0; drag = null; wrap.classList.remove('drag'); req(); }
    // a press is only a drag while the button is down: a release anywhere, or the window losing focus, ends it
    wrap.addEventListener('pointercancel', end); window.addEventListener('pointerup', end); window.addEventListener('blur', end);
    wrap.addEventListener('pointerleave', () => { if (!drag) { setHot(null, 'fig'); if (figCard()) popHide(); } });
    // a plain scroll zooms toward the pointer; at the fitted size a scroll down goes on to the page, so reading down never sticks here
    wrap.addEventListener('wheel', e => { const mod = e.ctrlKey || e.metaKey, dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      if (!mod && dy > 0 && vw.S <= fitS * 1.001) return; e.preventDefault(); const [x, y] = local(e); zoomBy(Math.exp(-dy * (e.ctrlKey ? .01 : .002)), x, y, mod ? .5 : 1); }, { passive: false });
    wrap.addEventListener('dblclick', e => { if (!e.target.closest('.stools')) fitNow(); });
    wrap.addEventListener('keydown', e => { if (e.metaKey || e.ctrlKey || e.altKey || e.target !== wrap) return; const k = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] }[e.key];
      if (k) { R.byHand(); vw.yaw += k[0]; vw.pitch = clampH(vw.pitch, vw.pitch + k[1]); tween = null; turned(); req(); }
      else if (e.key === '+' || e.key === '=') zoomBy(1.2); else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.2); else if (e.key === '0') fitNow(); else return;
      e.preventDefault(); e.stopPropagation(); });   // the page's ← → step a figure: here they turn this one
    tools.addEventListener('pointerdown', e => e.preventDefault());   // a button pressed by mouse takes no focus ring
    tools.addEventListener('click', e => { const b = e.target.closest('button'), z = b && b.dataset.z;
      if (z === 'in') zoomBy(1.25); else if (z === 'out') zoomBy(1 / 1.25); else if (z === 'fit') fitNow(...HOME, 1); else if (z === 'edge') { const ev = edgeView(); if (ev) fitNow(...ev, 0); } });

    // ---- sizing and the marks at the current values
    // the figure is 4:3, sized like a plane: from the layout's width and height limit
    R.size = room => { const ah = room.h - PAD - R.leg, aw = aim(room, ah) - PAD, ww = Math.max(40, Math.min(aw, ah * SHAPE3));
      if (Math.round(ww) !== R.w) R.fitH = null; R.w = Math.round(ww); R.h = R.fitH || Math.round(ww / SHAPE3); node.style.width = R.w + 'px'; wrap.style.width = R.w + 'px'; wrap.style.height = R.h + 'px'; return R.w + PAD; };
    // a mark that arrives fades in, and the guess's handle pulses once; the first show takes the start view (a view on step 1)
    R.show = c => { const was = R.c;
      if (was !== 1e9 && c > was) G.forEach(g => { if (g && g.st <= c && g.st > was) { appear[g.i] = performance.now(); if (g.k === 'guess') setTimeout(() => pulse(R.hg), 30); } });
      R.c = c; leg.querySelectorAll('[data-step]').forEach(e => e.classList.toggle('shown', +e.dataset.step <= c));
      if (!R.started) { R.started = true; if (R.startView != null) R.goView(R.startView, true); }
      draw(); };
    // drag the guess on the sheet, nudge it with the keys; drag a split's tips along their own arrows
    // the learner's own move: it takes the control from any tween, and counts as an attempt only if the value changes
    const ctlSet = (nm, v) => { if (!ctx.ctl[nm]) return; untween(ctx, nm); const was = ctx.scope[nm], to = clampTo(ctx, nm, v); ctx.ctl[nm](to); if (Math.abs(to - was) > 1e-9) R.touched(); };
    R.touched = () => { R.dragged = true; node.dispatchEvent(new CustomEvent('hands-dragged', { bubbles: true })); };
    R.dragTo = (i, cx, cy) => { const g = G[i], [x, y] = local({ clientX: cx, clientY: cy }), [a, b] = solveAB(g.U, g.V, g.ab, x, y), [na, nb] = list(g.mk.guess); ctlSet(na, a); ctlSet(nb, b); };
    R.nudge = (i, dx, dy) => { const g = G[i], [na, nb] = list(g.mk.guess); ctlSet(na, g.ab[0] + dx * .02); ctlSet(nb, g.ab[1] + dy * .02); };
    R.dragTip = (i, j, cx, cy) => { const g = G[i], [x, y] = local({ clientX: cx, clientY: cy }); ctlSet(list(g.mk.by)[j], solveS(j === 0 ? [0, 0, 0] : g.A, j ? g.V : g.U, g.ab[j], x, y)); };
    R.nudgeTip = (i, j, d) => { const g = G[i]; ctlSet(list(g.mk.by)[j], g.ab[j] + d * .02); };
    // the hunt's answer: the guess's place is kept (was), the guess glides to the foot and leaves its ghost; Hide answer glides it back
    R.reveal = on => { const g = G.find(q => q && q.k === 'guess'); if (!g) return; const [na, nb] = list(g.mk.guess), wn = g.mk.was != null ? list(g.mk.was) : null;
      if (on && !R.revealed) { R.revealed = true; if (wn) { ctx.ctl[wn[0]](ctx.scope[na]); ctx.ctl[wn[1]](ctx.scope[nb]); } const ft = g.f && amountsOf(g.U, g.V, g.f); if (ft) tweenCtl(ctx, { [na]: ft[0], [nb]: ft[1] }); }
      else if (!on && R.revealed) { R.revealed = false; if (wn) tweenCtl(ctx, { [na]: ctx.scope[wn[0]], [nb]: ctx.scope[wn[1]] }); } };
    // for the checks: what each mark draws now, and the camera
    R.probe = () => G.filter(Boolean).map(g => ({ k: g.k, i: g.i, p: g.p, P: g.P, f: g.f, U: g.U, V: g.V, A: g.A, B: g.B, T: g.T, ab: g.ab, scr: g.p ? (({ x, y }) => [x, y])(proj(g.p)) : null }));
    R.view = () => ({ ...vw, off: R.offEdge(), tk: [...R.tk] });
    // a figure with a guess or a split is framed on what it is about, the sheet's corners and the guess's point; the axes may run off
    R.badAt = sc => marks.reduce((n, { mk }) => { const b = []; try { geo(mk, sc, b); } catch (_) { return n + 1; } return n + b.length; }, 0);
    // in a strip, the camera frames what the window holds: its points, the sheet and the drop
    R.focus = () => { if (ctx.stripAll && G.some(g => g && g.k === 'points' && g.mk.points.from === 'window')) { const ps = G.filter(g => g && g.st <= R.c).flatMap(g => g.pts || []); return ps.length > 1 ? ps : null; }
      if (!G.some(g => g && (g.k === 'guess' || g.k === 'split'))) return null; const sh = sheetG(); if (!sh || !sh.pts) return null;
      return [...sh.pts, ...G.filter(g => g && g.k === 'guess' && g.P).map(g => g.P)]; };
    R.focusFill = () => { const ps = R.focus(); if (!ps) return null; const q = ps.map(proj), xs = q.map(z => z.x), ys = q.map(z => z.y);
      return [(Math.min(W, Math.max(...xs)) - Math.max(0, Math.min(...xs))) / W, (Math.min(HT, Math.max(...ys)) - Math.max(0, Math.min(...ys))) / HT]; };
    // a linked word (see the board): the colour it takes, a sheet's two tints, and whether its mark is drawn at this stop
    R.wl = i => { const g = G[i]; return !g ? { drawn: false } : { c: g.lc, grad: g.k === 'sheet' && g.mk.color == null && g.cU ? [g.cV, g.cU].map(q => `rgb(${q})`) : null, drawn: g.st <= R.c && g.pts.length > 0 }; };
    // the word's mark lights as its legend entry lights it; the other marks and entries dim
    // repainted on every call: a layout rebuilds the legend, and its lit entry must come back
    R.wlRest = set => { const k = set ? [...set].join() : ''; if (k !== R.restK) { R.restK = k; R.rest = set; req(); } };   // the first look (see the board)
    R.wlLight = i => { R.wlOn = i; node.classList.toggle('lnk-dim', i != null); leg.querySelectorAll('.pk').forEach(e => e.classList.toggle('lnk-on', +e.dataset.m === i)); setHot(i, 'word'); };
    R.layout = () => {
      leg.innerHTML = ''; R.later = []; const base = R.base = [];
      if (R.w < 40 || R.h < 40) { R.issues = ['the picture has no room']; return false; }
      if (!box) box = axesOf(); mid = box.lo.map((v, a) => (v + box.hi[a]) / 2);
      const pendV = R.pendingView;
      if (tween && (R.w !== W || R.h !== HT)) { const b = tween.b; tween = null; W = R.w; HT = R.h; svg.setAttribute('viewBox', `0 0 ${W} ${HT}`); const v = fitFor(b.yaw, b.pitch, b.pp); fitS = v.S; Object.assign(vw, v); }   // a resize mid-glide lands on the glide's end, fitted anew
      if (R.w !== W || R.h !== HT) { const keep = W ? vw.S / fitS : 1; W = R.w; HT = R.h; svg.setAttribute('viewBox', `0 0 ${W} ${HT}`);
        const v = fitFor(vw.yaw, vw.pitch); fitS = v.S; Object.assign(vw, { S: v.S * keep, ox: v.ox * keep, oy: v.oy * keep }); }
      G = marks.map(({ mk, i }) => { const k = kindOf(mk), w = `space mark ${i + 1}`;
        if (!k) { base.push(`${w} is none of ${SPACE.join(', ')}`); return null; }
        if (mk.when != null && !L.val(mk.when, ctx.scope, where)) return null;
        const bad = [], g = Object.assign(geo(mk, ctx.scope, bad), { mk, i, st: mk.step != null ? clickOf(mk.step) - (mk.guess != null ? 1 : 0) : at }); base.push(...bad.map(b => `${w} (${k}): ${b}`));
        // a mark outside the axes at the values now: remembered, so the check warns even after the slider moves back
        const tol = 1e-9 * Math.max(...box.hi.map((v, a) => v - box.lo[a]));
        if (g.pts.some(q => q.some((v, a) => v > box.hi[a] + tol || v < box.lo[a] - tol))) R.past.add(box.own ? `${w} (${k}) reaches past the axes' \`max\`: widen it, or leave \`max\` out so the kit sizes the axes`
          : `${w} (${k}) reaches past the axes at ${ctls.map(c => `${c.name} = ${L.fmt(ctx.scope[c.name], 3)}`).join(', ')}, a value the kit's sizing did not try: give the space \`max: [x, y, z]\``);
        const sym = symOfV(k === 'text' ? null : mk[k]), spec = mk.rgb ?? (mk.points || {}).rgb, c = col(mk.color ?? (sym && sym.color && sym.color !== 'ink' ? sym.color : SDEF[k]));
        // a dot's true colour: `rgb: od` from optical density; `rgb: 10` reads x, y, z as red, green, blue, full at 10; `{r, g, b, max}` (row keys on points)
        const hx = (q, row) => { let lv, mx = 1; if (spec === 'od') return odHex(q);
          if (spec && typeof spec === 'object') { lv = ['r', 'g', 'b'].map(ch => spec[ch] == null ? 0 : row ? row[spec[ch]] : L.val(spec[ch], ctx.scope, where)); mx = spec.max == null ? 1 : L.val(spec.max, ctx.scope, where); }
          else { lv = q; mx = L.val(spec, ctx.scope, where); }
          if (![...lv, mx].every(Number.isFinite) || !(mx > 0)) { base.push(`${w} (${k}): its rgb does not work out to numbers with a max above 0`); return '#000000'; } return toHex(lv, mx); };
        g.c = k === 'point' && spec != null && g.p ? hx(g.p) : c; if (k === 'points') g.rows.forEach(row => { row.hex = spec != null ? hx(row.at, row.r) : c; });
        g.rc = mk.color != null ? c : 'var(--accent)'; g.c2 = c;
        if (k === 'sheet') { const [su, sv2] = list(mk.sheet).map(symOfV), cs = q => cssRGB(mk.color != null ? c : q && q.color && q.color !== 'ink' ? col(q.color) : 'var(--mist)'); g.cU = cs(su); g.cV = cs(sv2); }
        g.lk = k === 'vector' ? 'arrow' : k === 'sheet' ? 'area' : k === 'foot' || (k === 'segment' && mk.dash) ? 'dash' : k === 'segment' || k === 'guess' ? 'line' : k === 'ring' || mk.ring === true ? 'ring' : mk.centre === true ? 'centre' : 'dot';
        if (k === 'split') { g.lk = 'arrow'; const [a1, b1] = list(mk.split).map(symOfV); g.cU2 = col(a1 && a1.color || 's5'); g.cV2 = col(b1 && b1.color || 's3'); }   // each part in its vector's colour
        g.lc = mk.ring === true ? g.rc : k === 'sheet' && mk.color == null ? 'var(--mist)' : k === 'points' && spec != null ? 'var(--mist)' : g.c;
        const cc = g.lc === 'var(--ink)' ? 'var(--mist)' : g.lc; g.hg = glowOf(cc);
        // a colour word in a true-coloured mark's label must fit the colour drawn (checked once the mark shows)
        if (spec != null && mk.label) { const wrong = (k === 'points' ? g.rows.map(row => row.hex) : [g.c]).map(hc => [hc, wrongWords(mk.label, hc)]).find(([, b]) => b.length);
          if (wrong) R.later.push({ st: g.st, msg: `${w}: label “${mk.label}” says ${wrong[1][0]}, but its colour reads as ${readAs(hsvOf(wrong[0]))} (${wrong[0]})` }); }
        g.says = mk.says ?? (sym && sym.says); g.card = !!(mk.label || g.says);
        const f2 = xs => `(${xs.map(v => L.fmt(v, 2)).join(', ')})`;
        g.pd = () => { const q = G[i] || g, val = q.k === 'point' || q.k === 'ring' ? q.p && f2(q.p) : q.k === 'vector' ? q.e && f2(vsub(q.e, q.o)) : q.k === 'foot' && q.f ? L.fmt(vlen(vsub(q.P, q.f)), 's3') : q.k === 'guess' && q.p ? L.fmt(vlen(vsub(q.P, q.p)), 's3') : null;
          return { swatch: swatch(g.lk, g.lc), c: cc, name: mk.label ?? null, says: g.says, value: val ?? null, shape: q.k === 'point' || q.k === 'ring' ? 'one point' : q.k === 'foot' ? 'its length' : null, scope: ctx.scope }; };
        return g; });
      // the legend: one entry per mark with a `label`; pointing at it (or the mark) lights the mark and opens its card
      G.forEach(g => { if (!g || g.mk.label == null) return; const ent = h('span', 'pk ' + g.lk), lab = h('span', '', md(String(g.mk.label))); ent.style.setProperty('--c', g.lc); ent.dataset.m = g.i; glow(ent, g.lc === 'var(--ink)' ? 'var(--mist)' : g.lc); ent.append(h('i'), lab);
        if (g.st > at) { ent.dataset.step = g.st; ent.classList.toggle('shown', g.st <= R.c); } leg.appendChild(ent);
        ['pointerenter', 'focusin'].forEach(ev => ent.addEventListener(ev, () => setHot(g.i, 'leg'))); ['pointerleave', 'focusout'].forEach(ev => ent.addEventListener(ev, () => setHot(null, 'leg')));
        if (g.card) { lab.classList.add('says', 'vt'); lab.tabIndex = 0; lab.dataset.vk = `sp${no}-${g.i}-k`; glow(lab, g.lc === 'var(--ink)' ? 'var(--mist)' : g.lc);
          lab.setAttribute('aria-description', L.plain(String(g.says ?? g.mk.label), ctx.scope)); lab._pd = g.pd; pauseButton(); } });
      leg.appendChild(tools);   // the view buttons: a row at the legend's right end, on the figure's top rule
      // the guess's handle and the split's two tip handles (made once; they outlive every redraw)
      G.forEach(g => { if (!g) return;
        if (g.k === 'guess' && !R.hg) { R.hgi = g.i; R.hg = handle(wrap, g.c, 'your guess: drag it on the sheet, or press the arrow keys');
          dragHandle(R.hg, (x, y) => R.dragTo(g.i, x, y), (dx, dy) => R.nudge(g.i, dx, dy), () => {}); }
        if (g.k === 'split' && !R.hs) { R.hs = [[g.cU2, 'the first part: drag along its arrow'], [g.cV2, 'the second part: drag along its arrow']].map(([c2, t]) => handle(wrap, c2, t));
          R.hs.forEach((b, j) => dragHandle(b, (x, y) => R.dragTip(g.i, j, x, y), (dx, dy) => R.nudgeTip(g.i, j, dx + dy), () => {})); } });
      // in a strip the space is only as tall as its parts need at the start and edge-on views, at its width (the C10j look):
      // a wide, shallow cloud in a 4:3 box left an empty band. Set once per layout, so dragging the window never moves the page
      if (ctx.stripAll && G.some(g => g && g.k === 'points' && g.mk.points.from === 'window')) {
        const all = G.filter(Boolean).flatMap(g => g.pts || []), ev = edgeView();
        const need = (yaw, pitch, pp) => { let u0 = 1e9, u1 = -1e9, w0 = 1e9, w1 = -1e9;
          for (const P0 of all) { const o = orbit(P0, yaw, pitch), k = FOCAL / (FOCAL + o.d * pp); u0 = Math.min(u0, o.sx * k); u1 = Math.max(u1, o.sx * k); w0 = Math.min(w0, o.sy * k); w1 = Math.max(w1, o.sy * k); }
          return (W - 140) / (u1 - u0 || 1) * (w1 - w0) + 68; };
        const hh = Math.round(Math.max(200, W * .45, Math.min(W / SHAPE3, Math.max(need(...HOME, 1), ev ? need(...ev, 0) : 0))));
        if (all.length > 1 && Math.abs(hh - HT) > 2) { R.h = HT = hh; wrap.style.height = hh + 'px'; svg.setAttribute('viewBox', `0 0 ${W} ${HT}`);
          const v = fitFor(vw.yaw, vw.pitch, vw.pp); fitS = v.S; Object.assign(vw, v); } }
      if (!R.fitH && R.hView && W && stripFit()) { const hh = hFor(...R.hView); if (hh) { setH(hh); const v = fitFor(vw.yaw, vw.pitch, vw.pp); fitS = v.S; Object.assign(vw, v); } }
      if (pendV !== undefined && W) { R.pendingView = undefined; R.goView(pendV, true); }
      if (!R.framed && W && R.focus()) { R.framed = true; R.goView(R.startView, true); }   // G is in now: frame on the sheet
      L.fill(leg, ctx.scope); base.push(...R.past); R.issues = base; draw();
      const was = R.leg; R.leg = leg.offsetHeight + 6; return R.leg !== was; };
    return R;
  }

  // ---------- how much room a figure gets ----------
  // ---------- strip: a drawing, a window the learner drags over it, and the window's contents as rows (board.md) ----------
  // strip.py samples the start window at build time and checks the art; here the same hit map gives the same rows. Every move
  // writes `window`, `window_<f>` and `picked_<f>` into the scene's scope and redraws, so the other items read them by name.
  // The art (left, pinned) carries the window; the sampler (the window as a grid of spots and its table of shapes) heads
  // the step's lines on the right. One pointer: a spot, its table row and its shape light together; a press picks
  function strip(p, ctx) {
    const K = p._kit, [x0, y0, vw, vh] = K.vb, G = K.grid, size = K.size, take = K.take, cols = K.cols, recs = K.recs, ids = K.ids, slots = K.slots || {};
    const cells = new Int32Array(G * G); let q = 0; K.hits.forEach(row => { for (let k = 0; k < row.length; k += 2) { cells.fill(row[k], q, q + row[k + 1]); q += row[k + 1]; } });
    const rec = k => { if (k < 0) return { id: null, part: 'nothing' }; const o = { id: ids[k] }; cols.forEach((c, j) => { o[c] = recs[k][j]; }); return o; };
    const cellAt = (x, y) => { const i = Math.floor((x - x0) / vw * G), j = Math.floor((y - y0) / vh * G); return i >= 0 && i < G && j >= 0 && j < G ? cells[j * G + i] : -1; };
    const n = take === 'shapes' ? 0 : take, R = { kind: 'strip', issues: [], stops: [], w: 0, h: 0, c: 1e9 };
    let cx = K.at[0], cy = K.at[1], pick = K.pick, hot = null, rows = [];
    const sample = () => {
      if (n) { rows = []; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const o = { ...rec(cellAt(cx - size / 2 + (c + .5) * size / n, cy - size / 2 + (r + .5) * size / n)), row: r, col: c };
          Object.entries(slots).forEach(([nm, v]) => { o[nm] = v[r * n + c]; }); rows.push(o); } return; }
      const cnt = new Map(); let tot = 0;
      for (let j = 0; j < G; j++) { const y = y0 + (j + .5) / G * vh; if (Math.abs(y - cy) > size / 2) continue;
        for (let i = 0; i < G; i++) { const x = x0 + (i + .5) / G * vw, k = cells[j * G + i]; if (Math.abs(x - cx) > size / 2 || k < 0) continue; cnt.set(k, (cnt.get(k) || 0) + 1); tot++; } }
      rows = [...cnt.keys()].sort((a, b) => cnt.get(b) - cnt.get(a) || a - b).map(k => ({ ...rec(k), share: +(cnt.get(k) / (tot || 1)).toFixed(4) })); };
    // what the other items read: the rows, each field as a list, and the picked row's fields
    const publish = () => { const sc = ctx.scope, r0 = rows[0] || {}, fs = Object.keys(r0).filter(f => f !== 'rgb').concat('rgb'); sc.window = rows;
      fs.forEach(f => { sc[`window_${f}`] = rows.map(r => r[f]); sc[`picked_${f}`] = (rows[pick] || {})[f]; }); };
    // for sizing a space: every shape at once, so its axes hold any window the learner can drag to
    ctx.stripAll = () => { const all = recs.map((_, k) => rec(k)), o = { window: all };
      Object.keys(all[0] || {}).forEach(f => { o[`window_${f}`] = all.map(r => r[f]); }); return o; };
    const hexOf = r => r && Array.isArray(r.rgb) ? '#' + r.rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('') : 'var(--bg)';

    // the art: the drawing, a dimmed outside, the window and the picked spot
    const node = h('div', 'bi strip fr'), art = h('div', 'sart'); node.appendChild(art);
    const img = h('img'); img.alt = ''; img.src = (window.VIZOS_ASSETS || {})[p.image] || p.image; img.draggable = false; art.appendChild(img);
    const ov = sv('svg', { class: 'sov', viewBox: `${x0} ${y0} ${vw} ${vh}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' }, art);
    art.tabIndex = 0; art.setAttribute('role', 'group');
    art.setAttribute('aria-label', `the drawing with a window on it: drag the window, or press the arrow keys to move it`);
    // the sampler: its head, the grid of spots (spots only) and the table of shapes
    const side = h('div', 'bi ssamp'), head = h('div', 'shead2'), grid = h('div', 'sgrid'), tbl = h('div', 'stab');
    side.append(head, ...(n ? [grid] : []), tbl);
    const unit = K.unit && K.unit.per ? ` · ${+(size * K.unit.per).toPrecision(3)} ${K.unit.name || ''}` : '';
    const fields = list(p.table), fmt3 = (v, f) => { const own = f && ((ctx.symbols || {})[f] || {}).fmt; return typeof v === 'number' ? L.fmt(v, own ?? (Math.abs(v) < 1 ? 3 : Math.abs(v) < 100 ? 2 : 0)) : Array.isArray(v) ? v.map(x => fmt3(x)).join(', ') : String(v ?? ''); };
    const sid = () => (rows[pick] || {}).id;
    const draw = () => {
      const r0 = rows[pick] || {}, sq = size / (n || 1), hr = hot != null ? rows[hot] : null;
      let o = `<path class="sdim" fill-rule="evenodd" d="M${x0} ${y0}h${vw}v${vh}h${-vw}Z M${cx - size / 2} ${cy - size / 2}v${size}h${size}v${-size}Z"/>`;
      o += `<rect class="swin" x="${cx - size / 2}" y="${cy - size / 2}" width="${size}" height="${size}"/>`;
      if (n && rows[pick]) o += `<rect class="spk" x="${cx - size / 2 + r0.col * sq}" y="${cy - size / 2 + r0.row * sq}" width="${sq}" height="${sq}"/>`;
      ov.innerHTML = o;
      head.innerHTML = `<b>Window</b> <span class="mute">${n ? `${n} × ${n} spots` : `${rows.length} shapes`}${unit}</span><span class="stag">${L.esc((hr || r0).part || '')}</span>`;
      if (n) { const W = 100, c = W / n, g = 0.06 * c;
        grid.innerHTML = `<svg viewBox="0 0 ${W} ${W}" role="grid" tabindex="0" aria-label="the window, ${n} by ${n} spots: press one, or use the arrow keys">${rows.map((r, i) =>
          `<rect data-i="${i}" x="${r.col * c + g / 2}" y="${r.row * c + g / 2}" width="${c - g}" height="${c - g}" fill="${hexOf(r)}" class="${i === pick ? 'on' : ''}${hr && r.id === hr.id && r.id != null ? ' hot' : ''}"/>`).join('')}</svg>`; }
      // one row per shape in the window: the most spots first, and the picked spot's shape always shown
      const by = new Map(); rows.forEach((r, i) => { const k = r.id ?? '—'; if (!by.has(k)) by.set(k, { r, i, m: 0 }); by.get(k).m += n ? 1 : r.share; });
      let list6 = [...by.values()].sort((a, b) => b.m - a.m).slice(0, 6); const pk = by.get(sid() ?? '—'); if (pk && !list6.includes(pk)) list6 = [...list6.slice(0, 5), pk];
      tbl.innerHTML = `<table class="t stt"><thead><tr><th></th><th>${n ? 'spots' : 'share'}</th>${fields.map(f => `<th>${md(shortOf(ctx, f))}</th>`).join('')}</tr></thead><tbody>${list6.map(x =>
        `<tr data-i="${x.i}" class="${x.r.id === sid() ? 'on' : ''}${hr && hr.id === x.r.id ? ' hot' : ''}"><td><i class="ssw" style="background:${hexOf(x.r)}"></i></td><td>${n ? x.m : L.fmt(x.m * 100, 0) + '%'}</td>${fields.map(f => `<td>${fmt3(x.r[f], f)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      L.fill(tbl, ctx.scope); };
    const go = (redraw = true) => { sample(); if (pick >= rows.length) pick = 0; publish(); draw(); if (redraw) ctx.refresh(); };
    // moving the window: drag it (or press anywhere on the drawing to bring it there), or the arrow keys
    const clamp = () => { cx = Math.min(Math.max(cx, x0 + size / 2), x0 + vw - size / 2); cy = Math.min(Math.max(cy, y0 + size / 2), y0 + vh - size / 2); };
    const toArt = e => { const b = art.getBoundingClientRect(); return [x0 + (e.clientX - b.left) / b.width * vw, y0 + (e.clientY - b.top) / b.height * vh]; };
    let drag = null;
    art.addEventListener('pointerdown', e => { const [x, y] = toArt(e); if (Math.abs(x - cx) > size / 2 || Math.abs(y - cy) > size / 2) { cx = x; cy = y; clamp(); go(); }
      drag = { dx: x - cx, dy: y - cy }; art.setPointerCapture(e.pointerId); art.classList.add('drag'); e.preventDefault(); });
    art.addEventListener('pointermove', e => { if (!drag) return; const [x, y] = toArt(e); cx = x - drag.dx; cy = y - drag.dy; clamp(); go(); });
    const end = () => { if (!drag) return; drag = null; art.classList.remove('drag'); if (R.moved) R.moved(); };
    art.addEventListener('pointerup', end); art.addEventListener('pointercancel', end);
    art.addEventListener('keydown', e => { const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!d) return;
      e.preventDefault(); cx += d[0] * size / 4; cy += d[1] * size / 4; clamp(); go(); if (R.moved) R.moved(); });
    // pointing at a spot or a row lights its shape in both; a press picks it
    const idx = e => { const t = e.target.closest('[data-i]'); return t ? +t.dataset.i : null; };
    [grid, tbl].forEach(el => { el.addEventListener('pointerover', e => { const i = idx(e); if (i !== hot) { hot = i; draw(); } });
      el.addEventListener('pointerleave', () => { hot = null; draw(); });
      el.addEventListener('click', e => { const i = idx(e); if (i != null) { pick = i; go(); } }); });
    grid.addEventListener('keydown', e => { const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -n, ArrowDown: n }[e.key]; if (!d || !n) return;
      e.preventDefault(); const t = pick + d; if (t >= 0 && t < rows.length && (Math.abs(d) === n || Math.floor(t / n) === Math.floor(pick / n))) { pick = t; go(); grid.querySelector('svg').focus(); } });
    R.node = node; R.side = side; R.rows = () => rows; R.pick = () => pick; R.setPick = i => { pick = i; go(); }; R.at = () => [cx, cy];
    R.moveTo = (x, y) => { cx = x; cy = y; clamp(); go(); if (R.moved) R.moved(); };
    // the art is square to the drawing: as wide as the room allows, and no taller than the room
    R.size = room => { const w = Math.max(200, Math.min(room.w - PAD, (room.h - PAD) * vw / vh)); R.w = Math.round(w); R.h = Math.round(w * vh / vw);
      art.style.width = R.w + 'px'; art.style.height = R.h + 'px'; return R.w + PAD; };
    R.show = c => { R.c = c; }; R.paint = () => {};
    sample(); publish(); draw();
    return R;
  }

  // Cold 8: a viewer that shows the page at its full height inside a box it scrolls (a side pane) leaves position: sticky
  // nothing to pin to, and the window never scrolls. Then the table follows the part of the page on show, read from thin
  // tiles down its scene that an IntersectionObserver watches (it sees the top window's edges even from inside a frame)
  const stretched = () => { const se = document.scrollingElement || document.documentElement;
    return se.scrollHeight <= innerHeight + 2 && innerHeight > ((typeof screen !== 'undefined' && screen.availHeight) || 900) * 1.2; };
  function pinFollow(pair, col) {
    let io = null, tiles = [];
    const seen = new Map(), TILE = 40;
    const place = () => { const vis = [...seen.values()]; if (!vis.length) return;
      const top = Math.min(...vis.map(r => r.top)), box = pair.getBoundingClientRect(), h = col.offsetHeight, pad = pair.classList.contains('stacked') ? 0 : 24;
      const off = col.classList.contains('nostick') ? 0 : Math.max(0, Math.min(top + pad - box.top, box.height - h));
      col.style.transform = off > 0 ? `translateY(${Math.round(off)}px)` : ''; };
    const off = () => { if (io) io.disconnect(); io = null; tiles.forEach(tl => tl.remove()); tiles = []; seen.clear(); col.style.transform = ''; pair.classList.remove('follow'); };
    return () => {
      if (typeof IntersectionObserver !== 'function' || !stretched()) return off();
      off(); pair.classList.add('follow');
      io = new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting) seen.set(e.target, e.intersectionRect); else seen.delete(e.target); }); place(); },
        { threshold: [0, .125, .25, .375, .5, .625, .75, .875, 1] });
      for (let y = 0; y < pair.offsetHeight; y += TILE) { const tl = h('i', 'ftile'); tl.style.top = y + 'px'; tl.style.height = Math.min(TILE, pair.offsetHeight - y) + 'px'; pair.appendChild(tl); tiles.push(tl); io.observe(tl); } };
  }

  const FIG = 520, SIDE = 300, GAP = 20, UNDER = 1280, READ = 1100;   // beside needs 520 px of figure and 300 of side column; a wide figure's column is 1100, and a figure in it may reach 1280
  const sideOf = W => Math.max(SIDE, Math.ceil(W * .3));              // the figure is sized from the 70%; the text then takes all that is left
  const SHAPE = 16 / 9, WIDEST = 2, FIGH = 820;                       // a chart's shape unless it has a ratio; how wide it may go in a short window; the tallest figure
  // the width a figure aims for: 16:9 at the height it may take, never short of its column, never past its room
  const aim = (room, hh) => Math.min(room.w, Math.max(room.col, hh * SHAPE));
  const ratioOf = (r, dflt) => { if (typeof r === 'number' && r > 0) return r; const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(String(r ?? '')); return m && +m[2] ? +m[1] / +m[2] : dflt; };
  const PAD = 16, LEG = 38;   // a figure's frame: its padding, both sides; a plane's legend row
  const STUCK = 24;           // where a sticky figure stops, as board.css has it
  const WORDS = '.say, .tqt, .ta > span:last-child, .note', same = e => e.textContent.replace(/\s+/g, ' ').trim();   // the lines the line by the buttons could repeat
  const inWindow = e => { const r = e.getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight && getComputedStyle(e).visibility === 'visible'; };
  const PROSE = new Set(['label', 'name', 'caption', 'alt', 'text', 'say', 'title', 'verdict']);
  // the expressions in a figure's spec: all its strings, but only the {{…}} parts of its words
  const exprsOf = o => typeof o === 'string' ? o : Array.isArray(o) ? o.map(exprsOf).join(' ')
    : o && typeof o === 'object' ? Object.entries(o).map(([k, v]) => PROSE.has(k) && typeof v === 'string' ? (v.match(/\{\{.*?\}\}/g) || []).join(' ') : exprsOf(v)).join(' ') : '';

  // a stepped figure: Back, a dot per stop, Next
  function stageBar(stops, go) {
    const bar = h('div', 'stage', `<button type="button" class="sb back" aria-label="Back">‹</button><span class="dots">${stops.map((_, i) => `<button type="button" class="sdot" aria-label="stop ${i + 1}"></button>`).join('')}</span><button type="button" class="sb next" aria-label="Next">›</button>`), line = h('div', 'stopl');
    const bs = bar.querySelectorAll('.sb'), ds = [...bar.querySelectorAll('.sdot')];
    bs[0].onclick = () => go(-1, true); bs[1].onclick = () => go(1, true); ds.forEach((d, i) => { d.onclick = () => go(i, false); });
    return { bar, line, set: (i, asking) => { bs[0].disabled = i === 0 && !asking; bs[1].disabled = i === stops.length - 1; ds.forEach((d, q) => { d.classList.toggle('on', q < i); d.classList.toggle('now', q === i); }); } };
  }

  // ---------- the board ----------
  L.types.board = (s, ctx) => {
    bookOf(); const node = h('section', 'slide s-board'); node.appendChild(L.head(s, beatLabel(s.beat)));
    const steps = list(s.steps);
    // each step's clicks: a think step counts as two (its question, its answer), so the check sees both
    let n = 0; const map = steps.map(st => st && st.think ? { q: ++n, at: ++n } : { at: ++n });
    const clickOf = j => (map[Math.max(1, Math.min(steps.length, j)) - 1] || { at: 1 }).at;
    // a space figure's `views` by step (adv.md): each becomes a word in its step's line, and on a think its answer's
    const VW = {}; steps.forEach(st => list(st && st.add).forEach(it => { const vs = it && it.space && it.space.views; if (vs) Object.entries(vs).forEach(([k, v]) => { (VW[+k - 1] = VW[+k - 1] || []).push({ v, spec: it.space }); }); }));
    const waits = new Set(steps.flatMap((st, j) => st && st.think ? [map[j].at] : []));   // what a think step adds waits for its answer
    const root = h('div', 'body board'); node.appendChild(root);
    // with the scene's head at the top of the window, the figure and all that goes under it stay on screen
    const figH = () => Math.min(FIGH, innerHeight - (root.getBoundingClientRect().top - node.getBoundingClientRect().top) - 12);
    // a figure beside its text is pinned while the text scrolls past, the head long gone
    const pinH = () => Math.min(FIGH, innerHeight - 2 * STUCK - 1);
    const zl = s.table ? h('div', 'tcol') : null, zt = s.table ? h('div', 'tcard g plate') : null;   // the pinned column: the table, then side notes
    if (zl) zl.appendChild(zt);
    // a slope table (adv.md §9d) draws the same rows as lines: each group of rows is a mark (a key entry and a linked word)
    const SLOPE = !!(zt && s.table.style === 'slope');
    const slopeRows = () => { try { return list(L.val(s.table.from, ctx.scope, `slide ${ctx.index + 1} table.from`)).filter(r => r && typeof r === 'object'); } catch (_) { return []; } };
    // its groups in order of first appearance. A group the lesson already colours keeps that colour and its words: a plane's
    // `points` with `by:` the same key and a `colors` entry for it (board.md). The others take the kit colours left, in order.
    // lesson_lint.py slope_groups works this out the same way: change both together
    const slopeGroups = () => { const key = s.table.group, gk = [], given = {};
      slopeRows().forEach(r => { const g = r[key]; if (g != null && !gk.includes(String(g))) gk.push(String(g)); });
      list((ctx.deck || {}).slides).forEach(sl => list(sl && sl.steps).forEach(st => list(st && st.add).forEach(it => list(it && it.plane && it.plane.marks).forEach(mk => {
        const P = mk && mk.points; if (!P || P.by !== key || !P.colors || typeof P.colors !== 'object') return;
        Object.entries(P.colors).forEach(([g, v]) => { const c = typeof v === 'string' ? { color: v } : v || {}; if (!(g in given) && c.color) given[g] = c; }); }))));
      const free = PALETTE.filter(c => !gk.some(g => given[g] && given[g].color === c));
      return gk.map(g => { const own = given[g]; return { g, c: col(own ? own.color : free.shift() || 'ink'), label: String((own && own.label) ?? g) }; }); };
    const slopeFig = SLOPE ? { kind: 'slope', node: zt, wrap: zt, spec: {}, stops: [], at: 0, issues: [], keys: slopeGroups().map(q => q.g), linked: new Set(), paint: () => {}, wlOn: null, hotG: null, hotR: null } : null;

    // where steps go. `seg` is the running column: beside the table until something full-width ends it, then the full width
    let seg = null, cur = null, pending = null, zone = null, pair = null; const blocks = [];
    const column = () => { if (seg) return seg; seg = h('div', 'lines');
      if (zl && !pair) { pair = h('div', 'bpair'); pair.append(zl, seg); root.appendChild(pair); } else root.appendChild(seg); return seg; };
    const block = () => { const b = { node: h('div', 'fb'), fig: h('div', 'ffig'), side: h('div', 'fside'), figs: [] }; b.node.append(b.fig, b.side); column().appendChild(b.node); blocks.push(b); return b; };

    const lines = [], cols = [], vis = [], asm = [], thinks = [], stepEls = [], figs = [];
    const symColor = q => { const c = ((ctx.symbols || {})[q] || {}).color; return c ? col(c) : null; };
    const SIDEVIS = ['chart', 'image', 'stat', 'units'], WIDEVIS = ['dist', 'parts', 'flow'];
    const isFig = it => it && (it.strip || it.plane || it.space || it.chance || SIDEVIS.some(k => it[k] != null));
    const isWide = it => it && (it.assemble || it.compare || it.ops || it.fork || it.beads || it.recorder || it.wheel || it.pileup || WIDEVIS.some(k => it[k] != null));
    const tag = (e, at, id) => { e.dataset.at = at; if (waits.has(at)) e.dataset.wait = at; if (id) e.dataset.id = id; return e; };
    // a chart mark's or an image label's `step` counts board steps, as everywhere on the board; the kit counts clicks
    const clicks = v => { const c = JSON.parse(JSON.stringify(v)), m = o => { if (o && o.step != null) o.step = clickOf(o.step); };
      if (c.chart) { list(c.chart.series).forEach(m); list(c.chart.marks).forEach(m); } list(c.labels).forEach(m); return c; };
    const visual = v => { const c = clicks(v); ctx.chartOpts = c.chart ? markHooks(c.chart) : null;
      // a dist builds its chart spec inside the deck kit: the kit asks for the same hooks once the spec exists
      if (c.dist) ctx.distHooks = spec => (ctx.chartOpts = markHooks(spec));
      try { const V = L.visual(c, ctx); V.hooks = ctx.chartOpts; vis.push(V); return V; } finally { ctx.chartOpts = null; ctx.distHooks = null; } };
    // a chart's marks on a board: no tag on the plot. A named mark (its `name`, or the `short` of the symbol that is its value)
    // takes a legend entry after the series, with a swatch drawn as the mark is; the mark (a hit area at least 14 px wide, 24 px
    // round a point) and its entry open the board's card: the symbol's card, or the name, the value now and `says`
    let chartNo = 0;
    const reals = {};
    const realColor = c => { if (!(c in reals)) { const tmp = document.createElement('span'); tmp.style.color = c; document.body.appendChild(tmp); reals[c] = getComputedStyle(tmp).color; tmp.remove(); } return reals[c]; };
    // a data dot wins inside its own radius: there the marks' hit areas let the pointer through to the chart's data pop-up
    const dotsWin = sv => { if (!sv || sv._dots) return; sv._dots = true;
      sv.addEventListener('pointermove', e => { const on = [...sv.querySelectorAll('g.mk:not(.mkm):not(.off) circle')].some(c => { const b = c.getBoundingClientRect();
          return Math.hypot(e.clientX - (b.left + b.right) / 2, e.clientY - (b.top + b.bottom) / 2) <= b.width / 2 + 1; });
        sv.classList.toggle('ondot', on); }, true);
      sv.addEventListener('pointerleave', () => sv.classList.remove('ondot')); };
    const markHooks = spec => { const no = chartNo++, S = ctx.symbols || {}, xs = spec.x || {}, ys = spec.y || {};
      const bare = v => typeof v === 'string' && /^[A-Za-z_]\w*$/.test(v) && S[v] ? v : null;
      const symOfMk = mk => mk.kind === 'hline' ? bare(mk.y) : mk.kind === 'vline' ? bare(mk.x) : mk.kind === 'point' ? bare((mk.at || [])[1] ?? mk.y) : null;
      const nameOf = mk => mk.name ?? (symOfMk(mk) ? S[symOfMk(mk)].short : null);
      const kindOf = mk => ['band', 'area'].includes(mk.kind) ? 'area' : mk.kind === 'point' ? 'dot' : mk.kind === 'arrow' ? 'arrow' : mk.dash === false || mk.kind === 'span' ? 'line' : 'dash';
      // a mark with no `color` whose value is a symbol with a colour is drawn in that colour, as the symbol is everywhere else.
      // Set on the board's copy of the spec before the chart draws, as a real colour (the chart knows only some names)
      list(spec.marks).forEach(m => { const q = m && !m.color && symOfMk(m), B = q && bookOf(), sc = B && B.S[q] && B.S[q].color; if (sc && sc !== 'ink') m.color = realColor(col(sc)); });
      const colOf = mk => col(mk.color || (['point', 'area', 'arrow'].includes(mk.kind) ? 'accent' : 'mist'));
      const marks = list(spec.marks).map((m, i) => ({ ...m, i }));
      // a legend swatch as the chart's own legend draws one (no svg inside a chart: its rule stretches every svg to the plot)
      const chip = (kind, c) => kind === 'dot' ? `<i class="dot" style="background:${c}"></i>` : kind === 'area' ? `<i class="blk" style="background:${c}"></i>`
        : kind === 'arrow' ? `<i class="arw" style="color:${c}">→</i>` : kind === 'dash' ? `<i style="background:repeating-linear-gradient(90deg,${c} 0 7px,transparent 7px 11px)"></i>` : `<i style="background:${c}"></i>`;
      const valueOf = (mk, scope) => { const q = symOfMk(mk), f = (v, ax, own) => { const x = L.val(v, scope, `mark ${mk.kind}`); return Number.isFinite(x) ? L.fmt(x, ((own && S[own]) || {}).fmt ?? ax.fmt) : '?'; };
        if (mk.kind === 'hline') return f(mk.y, ys, q); if (mk.kind === 'vline') return f(mk.x, xs, q);
        if (mk.kind === 'point') { const a = mk.at || [mk.x, mk.y]; return `(${f(a[0], xs, bare(a[0]))}, ${f(a[1], ys, bare(a[1]))})`; }
        if (mk.kind === 'band') { const r = mk.x ? [mk.x, xs] : [mk.y, ys]; return Array.isArray(r[0]) ? `${f(r[0][0], r[1])} – ${f(r[0][1], r[1])}` : null; }
        return null; };
      // a mark has a card when its value is a symbol with `says` (that card wins over the mark's own `says`), or when it has `says`
      const hasCard = mk => { const q = symOfMk(mk); return q ? !!S[q].says : mk.says != null; };
      // a target: the symbol's card (a point still shows its pair), or the mark's own (a name and `says`)
      const target = (el, mk, gg) => { const q = symOfMk(mk), c = colOf(mk);
        if (!hasCard(mk)) return false;
        el.classList.add('vt', 'says'); el.setAttribute('tabindex', '0'); el.dataset.vk = `${ctx.index}-${no}-${mk.i}-${el.tagName === 'SPAN' ? 'k' : 'm'}`;
        glow(el, c); if (gg) glow(gg, c); pauseButton();
        if (!q) { el.setAttribute('aria-description', L.plain(String(mk.says), ctx.scope)); el._pd = () => ({ swatch: swatch(kindOf(mk), c), c, name: nameOf(mk), says: mk.says, value: valueOf(mk, ctx.scope), shape: null, scope: ctx.scope }); }
        else { el.dataset.sym = q; el.setAttribute('aria-description', L.plain(String(S[q].says), ctx.scope));   // the symbol's card, without its class: one colour per symbol stays true
          el._pd = () => mk.kind === 'point' ? { ...symCard(el, q), value: valueOf(mk, ctx.scope), shape: 'one point' } : symCard(el, q); }
        return true; };
      // pointing at a mark lights its legend entry; pointing at or focusing an entry lifts its mark
      const pair = (host, i) => [host.querySelector(`.legend [data-mi="${i}"]`), host.querySelector(`.chart > svg g.mkm[data-mi="${i}"]`)];
      const light = (host, i, on) => { pair(host, i).forEach(e => e && e.classList.toggle('lit', on)); if (H.fg && H.fg.onHot) H.fg.onHot(on ? i : null); };
      const H = {
        linked: new Set(), fg: null,
        // a linked word (see the board): its mark's colour and whether it is drawn at this stop; lighting it dims the rest
        wl: (host, i) => { const gg = host.querySelector(`.chart > svg g.mkm[data-mi="${i}"]`); return { c: colOf(marks[i] || {}), drawn: !!gg && !gg.classList.contains('off') }; },
        wlLight: (host, i) => { host.classList.toggle('lnk-dim', i != null);
          host.querySelectorAll('.chart > svg g.mkm, .legend [data-mi]').forEach(e => e.classList.toggle('lnk-on', i != null && +e.dataset.mi === i)); },
        wlRest: (host, set) => { host.classList.toggle('lnk-rest', !!set);   // the first look (see the board)
          host.querySelectorAll('.chart > svg g.mkm, .legend [data-mi]').forEach(e => e.classList.toggle('told', !!set && set.has(+e.dataset.mi))); },
        legend: () => { const es = marks.filter(nameOf);
          return { n: es.length, html: es.map(mk => `<span class="mk mkx" data-mi="${mk.i}">${chip(kindOf(mk), colOf(mk))}<span class="mkn">${md(String(nameOf(mk)))}</span></span>`).join('') }; },
        // a mark the chart has just drawn
        mark: (mk, gg) => { const host = gg.closest('.vis'), entry = host && host.querySelector(`.legend [data-mi="${mk.i}"]`), en = entry && entry.querySelector('.mkn'), c = colOf(mk);
          gg.classList.add('mkm'); gg.dataset.mi = mk.i; void c;
          if (en) { L.fill(en, ctx.scope); target(en, mk, null);
            // the entry takes the mark's step: hidden, with no pointer, tap or Tab, until the mark shows
            const sync = () => entry.classList.toggle('off', gg.classList.contains('off')); sync();
            new MutationObserver(sync).observe(gg, { attributes: true, attributeFilter: ['class'] });
            if (!entry.dataset.lit) { entry.dataset.lit = 1; ['pointerenter', 'focusin'].forEach(t => entry.addEventListener(t, () => light(host, mk.i, true))); ['pointerleave', 'focusout'].forEach(t => entry.addEventListener(t, () => light(host, mk.i, false))); } }
          if (H.linked.has(mk.i)) glow(gg, c);
          if (!hasCard(mk) && !H.linked.has(mk.i)) return;   // no card and no linked word, no hit area: a plain reference never covers a mark that has one
          const hits = [...gg.children].filter(e => /^(line|path|rect|circle)$/.test(e.tagName)).map(e => { const k = e.cloneNode(false);
            if (e.tagName === 'circle') k.setAttribute('r', Math.max(12, +e.getAttribute('r') || 0));
            // a band or an area answers on its outline, so the data inside it keep their own pop-up
            k.setAttribute('fill', e.tagName === 'circle' ? 'transparent' : 'none'); k.setAttribute('stroke', 'transparent'); k.setAttribute('stroke-width', 16);
            ['opacity', 'stroke-dasharray'].forEach(a => k.removeAttribute(a)); k.setAttribute('class', 'mhit'); gg.appendChild(k); return k; });
          // only the first hit area takes Tab; the rest open the same card by pointer
          hits.forEach((k, j) => { if (target(k, mk, gg) && j) k.removeAttribute('tabindex');
            // the mark's card wins over the chart's data pop-up: the chart's own hide() (on pointerleave) drops its pop-up and guide
            k.addEventListener('pointerenter', () => { light(host, mk.i, true); const sv = gg.ownerSVGElement; if (sv && sv.onpointerleave) sv.onpointerleave(new PointerEvent('pointerleave')); });
            k.addEventListener('pointerleave', () => light(host, mk.i, false));
            k.addEventListener('pointermove', e => e.stopPropagation()); });
          dotsWin(gg.ownerSVGElement); },
      };
      return H; };
    const stepsIn = o => list(o).map(m => m && m.step).filter(x => x != null).map(clickOf);
    // a figure and what goes under it: its Back and Next, then its controls
    const holder = (fg, at, spec) => { fg.wrap = tag(h('div', 'fg'), at); fg.wrap.appendChild(fg.node); fg.at = at; fg.spec = spec; fg.zone = zone; figs.push(fg); return fg; };
    // a deck visual on the board: its shape comes from its `ratio` (an image's from the image); the room only limits its size
    const figure = (it, at) => { const { id, ratio, ...v0 } = it, v = JSON.parse(JSON.stringify(v0)), kind = [...SIDEVIS, ...WIDEVIS].find(k => v[k] != null), e = h('div', `bi bvis ${kind}`); if (id) e.dataset.id = id;
      if (v.parts) delete v.parts.build; if (v.flow) delete v.flow.build;   // both are shown complete
      // a legend that only repeats the x-axis labels gives its room to the plot
      if (v.chart && v.chart.x && list(v.chart.x.cats).length) { const nm = list(v.chart.series).filter(q => q.name).map(q => q.name); if (nm.length && nm.every(q => v.chart.x.cats.includes(q))) v.chart.legend = false; }
      const markKeys = v.chart ? list(v.chart.marks).filter(q => q && (q.name || ['hline', 'vline', 'point'].some(k => q.kind === k) && [q.y, q.x, (q.at || [])[1]].some(x => typeof x === 'string' && ((ctx.symbols || {})[x] || {}).short))).length : 0;
      if (v.chart && !markKeys && (v.chart.legend === false || list(v.chart.series).filter(q => q.name && q.legend !== false).length < 2)) e.classList.add('bare');   // no legend, so no legend row
      const V = visual(v), body = V.node; e.appendChild(body); if (kind !== 'flow') body.classList.add('fr');
      const fg = { node: e, V, kind, issues: [], w: 0, h: 0, stops: [...stepsIn((v.chart || {}).series), ...stepsIn((v.chart || {}).marks), ...stepsIn(v.labels)] };
      const pick = sel => body.querySelector(sel), rr = ratioOf(ratio ?? (v.chart || v.dist || {}).ratio, SHAPE);
      // the widest size that keeps the shape: `over` is what sits round the shape inside the plate (a caption, a legend)
      const short = kind === 'chart' && ratio == null && (v.chart || {}).ratio == null;   // a chart with no ratio of its own may go to 2:1 in a short window
      const fit = (room, r, over) => { const ww = aim(room, room.h - over) - PAD, hh = Math.round(Math.min(ww / r, room.h - over)); return [Math.round(short ? Math.min(ww, hh * WIDEST) : hh * r) + PAD, hh]; };
      fg.size = room => {
        const shaped = (sel, r) => { const box = pick(sel); [fg.w, fg.h] = fit(room, r, 0); e.style.width = fg.w + 'px'; box.style.height = fg.h + 'px';
          const over = e.offsetHeight - fg.h; if (over + fg.h > room.h) { [fg.w, fg.h] = fit(room, r, over); e.style.width = fg.w + 'px'; box.style.height = fg.h + 'px'; } };
        if (kind === 'chart') shaped('.chart', rr);
        else if (kind === 'units') shaped('.units', rr);
        else if (kind === 'image') { const im = pick('img'), r = im && im.naturalWidth ? im.naturalWidth / im.naturalHeight : rr; [fg.w, fg.h] = fit(room, r, 0); e.style.width = fg.w + 'px'; if (im) { im.style.width = fg.w - PAD + 'px'; im.style.height = fg.h + 'px'; } }
        else if (kind === 'stat') { fg.w = Math.min(room.w, 460); fg.h = 240; e.style.width = fg.w + 'px'; }
        else if (kind === 'flow') { fg.w = room.w; fg.h = 196; e.style.width = fg.w + 'px'; pick('.flow').style.height = fg.h + 'px'; }
        else if (kind === 'parts') { fg.w = room.w; fg.h = v.parts.rows ? 74 + 96 * v.parts.rows.length : 286; e.style.width = fg.w + 'px'; pick('.parts').style.height = fg.h + 'px'; }
        else { const card = pick('.famcard'), cw = card ? card.offsetWidth + 30 : 0; [fg.w, fg.h] = fit({ w: room.w - cw, col: room.w - cw, h: room.h }, rr, 0); fg.w = room.w; e.style.width = fg.w + 'px'; pick('.chart').style.height = fg.h + 'px'; }
        return fg.w; };
      const im = pick('img'); if (im && !im.complete) im.addEventListener('load', () => ctx.refresh());
      fg.paint = c => { shown(e, c); V.show(c); };
      if (V.hooks) { V.hooks.fg = fg; fg.linked = V.hooks.linked; fg.wl = i => V.hooks.wl(e, i); fg.wlLight = i => V.hooks.wlLight(e, i); fg.wlRest = set => V.hooks.wlRest(e, set); }
      return holder(fg, at, it); };
    // the plan is its picture: numbered squares on one line, a title under each and a sub-label under that
    const track = (f, at) => { const N = list(f.nodes).map(x => typeof x === 'string' ? { label: x } : x), n = N.length, e = h('div', 'bi track', `<div class="tkl" style="left:${50 / n}%;right:${50 / n}%"></div>${N.map((x, i) => `<div class="tkc"><div class="tks${i ? '' : ' on'}">${i + 1}</div><div class="tkt">${md(x.label || '')}</div>${x.sub ? `<div class="tku">${md(x.sub)}</div>` : ''}</div>`).join('')}`);
      e.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
      return holder({ node: e, kind: 'track', issues: [], stops: [], w: 0, h: 0, size: room => { e.style.width = room.w + 'px'; return room.w; }, paint: () => {} }, at, f); };
    const planeFig = (p, at) => { const fg = plane(p, ctx, clickOf, at); fg.stops = stepsIn(p.marks); fg.paint = c => { fg.cNow = c; shown(fg.node, c); }; return holder(fg, at, p); };
    const spaceFig = (p, at) => { const fg = space(p, ctx, clickOf, at); fg.stops = stepsIn(p.marks); fg.paint = c => fg.show(c);
      // its views (a think's at its answer, which is a stop), its start view (step 1's), and a think that moves the controls
      const pv = p.views || {}; fg.views = Object.entries(pv).map(([k, v]) => ({ at: clickOf(+k), v, think: !!(steps[+k - 1] || {}).think })); fg.startView = pv[1];
      fg.stops = [...fg.stops, ...fg.views.filter(x => x.think).map(x => x.at)];
      steps.forEach((st, j) => { if (st && st.think && st.think.set) fg.stops = [...fg.stops, map[j].at]; });
      // a hunt's guess comes with its think's question; the think waits for a drag
      const gm = list(p.marks).find(m => m && m.guess != null); if (gm) fg.huntAt = clickOf(gm.step);
      return holder(fg, at, p); };
    // a chance figure's tally follows the scene's run: the frame on show
    // its words wait until the reading reaches it (on the scene's first step it is there from the lead on)
    const runC = (s.controls || []).find(c => c && c.run) || {}, runName = runC.name;
    // and the drawing waits with them: hidden, its room kept, as a plane mark on a later step is
    const stripFig = (p, at) => { const fg = strip(p, ctx); fg.stops = []; return holder(fg, at, p); };
    const chanceFig = (p, at, ratio) => { const env = { frame: () => runName == null ? null : ctx.scope[runName], frames: runName == null ? 0 : runC.run, name: runName, derive: s.derive, shown: () => at <= (map[0] || {}).at || read >= at };
      const fg = chance(p, ctx, at, env, ratio); fg.stops = []; fg.paint = c => shown(fg.node, c); fg.wait = () => fg.node.classList.toggle('cwait', !env.shown()); return holder(fg, at, p); };
    // a fork waits the same way; it is a wide figure, in the reading column
    const forkFig = (p, at) => { const env = { shown: () => at <= (map[0] || {}).at || read >= at };
      const fg = fork(p, ctx, at, env); fg.stops = []; fg.paint = c => shown(fg.node, c); fg.wait = () => fg.node.classList.toggle('cwait', !env.shown()); return holder(fg, at, p); };
    // bead rings too
    const beadsFig = (p, at) => { const env = { shown: () => at <= (map[0] || {}).at || read >= at };
      const fg = beads(p, ctx, at, env); fg.stops = []; fg.paint = c => shown(fg.node, c); fg.wait = () => fg.node.classList.toggle('cwait', !env.shown()); return holder(fg, at, p); };
    // and a recorder strip
    const recorderFig = (p, at) => { const env = { shown: () => at <= (map[0] || {}).at || read >= at };
      const fg = recorder(p, ctx, at, env); fg.stops = []; fg.paint = c => shown(fg.node, c); fg.wait = () => fg.node.classList.toggle('cwait', !env.shown()); return holder(fg, at, p); };
    // and a colour wheel
    const wheelFig = (p, at) => { const env = { shown: () => at <= (map[0] || {}).at || read >= at };
      const fg = wheel(p, ctx, at, env); fg.stops = []; fg.paint = c => shown(fg.node, c); fg.wait = () => fg.node.classList.toggle('cwait', !env.shown()); return holder(fg, at, p); };
    // and a read pileup
    const pileupFig = (p, at) => { const env = { shown: () => at <= (map[0] || {}).at || read >= at };
      const fg = pileup(p, ctx, at, env); fg.stops = []; fg.paint = c => shown(fg.node, c); fg.wait = () => fg.node.classList.toggle('cwait', !env.shown()); return holder(fg, at, p); };

    const makeStep = (st, j) => {
      const c = map[j], el = h('div', 'st'); el.dataset.at = c.at; el.dataset.q = c.q || c.at; el.stages = []; el.zone = zone;
      if (st.say) { const line = h('p', 'say', md(st.say)); if (st.why) line.append(' ', h('span', 'swhy', md(st.why))); el.appendChild(line); }   // the step's reason, in grey at the end of its line
      // a refresher at the end of the lesson: a quiet line under the say, and a back button once it is read (lesson.js L.refresh)
      if (st.refresh) { const k = (ctx.deck.slides || []).findIndex(x => x.id === st.refresh), rs = ctx.deck.slides[k] || {};
        const r = h('p', 'lref', `<span class="lra">${md(rs.ask || '')}</span> <a href="#scene-${k + 1}">Refresher ▸</a>`);
        r.querySelector('a').onclick = e => { e.preventDefault(); L.refresh && L.refresh(k); }; el.appendChild(r); }
      if (st.think) { const t = typeof st.think === 'string' ? { q: st.think } : st.think, e = h('div', 'think g thin' + (t.transfer ? ' ttr' : ''), `<div class="tq"><span class="btag">${t.transfer ? 'Elsewhere' : 'Think'}</span><span class="tqt">${t.transfer ? `<span class="tfield">${md(String(t.transfer).replace(/^./, c => c.toUpperCase()))}.</span> ` : ''}${md(t.q || '')}</span><button type="button" class="tb">Show answer</button></div><div class="ta"><span class="btag so">So</span><span>${md(t.a || '')}</span></div>`);
        e.dataset.at = c.at; e.querySelector('.tb').onclick = () => answer(e); el.appendChild(e); thinks.push(e); }
      // extra reading for this step: a closed fold with its question, paragraphs and sources (lesson.js L.fold)
      if (st.more) { const m = st.more; el.fold = L.fold(md(m.ask || ''), [].concat(m.answer || []).map(t => `<p>${md(t)}</p>`).join('') + L.sources(m.sources)); el.fold.dataset.at = c.at; }
      // the step's view as a word at the end of its line (its answer's, on a think), in the toggle words' look; pressing it turns the figure
      (VW[j] || []).forEach(({ v, spec }) => { const nm = typeof v === 'object' ? 'across' : v === 'fit' ? 'from the start' : `${v}-on`, b = h('button', 'vword', md(nm)); b.type = 'button'; b.dataset.view = JSON.stringify(v); b.spec = spec;
        b.title = 'turn the figure to this view'; b.onclick = () => { const fg = figs.find(f => f.spec === spec); if (fg && fg.goView) fg.goView(v); };
        const host = st.think ? el.querySelector('.ta > span:last-child') : el.querySelector(':scope > .say'); if (host) host.append(' ', b); });
      stepEls.push(el); el.addEventListener('mouseenter', () => R.hover(c.at)); el.addEventListener('mouseleave', () => R.hover(null));
      el.addEventListener('click', e => { if (e.target.closest('button, input, label, a, .vt, .lnk, details') || String(getSelection())) return; el.stages.forEach(S => S.jump(c.at)); });
      return el;
    };

    const addItem = (it, j, slot, b) => {
      const at = map[j].at;
      if (it.calc) { const row = tag(h('div', 'cline bi'), at, it.calc.id);
        row.innerHTML = `<div class="num">${lines.filter(x => x.c).length + 1}</div><div class="say">${md(it.calc.say || '')}${it.calc.why ? `<span class="cwhy">${md(it.calc.why)}</span>` : ''}</div><div class="math"></div>`;
        lines.push({ c: it.calc, at, row, el: row }); slot.appendChild(row); }
      // a matrix or vector from the data, in brackets: its symbol = its numbers (\mat in slides.js draws them)
      else if (it.matrix || it.vec) { const q = it.matrix || it.vec, e = tag(h('div', it.vec && it.row ? 'fline bi mrow' : 'fline bi'), at, it.id);
        e.innerHTML = '<div class="math"></div>'; lines.push({ f: { mat: q, row: !!(it.vec && it.row) }, at, el: e }); slot.appendChild(e); }
      else if (it.eqn) { const e = tag(h('div', 'fline bi'), at, it.eqn.id);
        e.innerHTML = `${it.eqn.say ? `<div class="say">${md(it.eqn.say)}</div>` : ''}<div class="math"></div>`; lines.push({ f: it.eqn, at, el: e }); slot.appendChild(e); }
      // the formula built from our numbers (R4): the numbers row, the next step's line, then the symbols row with each term named
      else if (it.assemble) { const a = it.assemble, e = tag(h('div', 'asm bi g fr'), at, a.id);
        e.innerHTML = `${a.say ? `<div class="say">${md(a.say)}</div>` : ''}<div class="arow nums"><span class="atag">Our numbers</span><div class="math"></div></div><div class="abridge"></div>` +
          `<div class="arow syms"><span class="atag">In symbols</span><div class="math"></div></div>`;
        asm.push({ a, e }); slot.appendChild(e); pending = e.querySelector('.abridge'); }
      else if (it.plane) { const fg = planeFig(it.plane, at); b.fig.appendChild(fg.wrap); b.figs.push(fg); }
      // a strip: the drawing pins at the left; its sampler, then its space, head the step's lines on the right
      else if (it.strip) { const fg = stripFig(it.strip, at); b.fig.appendChild(fg.wrap); b.figs.push(fg); b.strip = fg; slot.prepend(tag(fg.side, at)); }
      else if (it.space && b && b.strip) { const fg = spaceFig(it.space, at); b.strip.side.after(fg.wrap); (b.sfigs = b.sfigs || []).push(fg); b.strip.moved = () => fg.refit && fg.refit(); }
      else if (it.space) { const fg = spaceFig(it.space, at); b.fig.appendChild(fg.wrap); b.figs.push(fg); }
      else if (it.chance) { const fg = chanceFig({ ...it.chance, id: it.chance.id ?? it.id }, at, it.ratio ?? it.chance.ratio); b.fig.appendChild(fg.wrap); b.figs.push(fg); }
      else if (SIDEVIS.some(k => it[k] != null)) { const fg = figure(it, at); b.fig.appendChild(fg.wrap); b.figs.push(fg); }
      else if (it.fork) { const w = { wide: true, figs: [] }; zone = w; const fg = forkFig({ ...it.fork, id: it.fork.id ?? it.id }, at); w.figs.push(fg); slot.appendChild(fg.wrap); blocks.push(w); }
      else if (it.beads) { const w = { wide: true, figs: [] }; zone = w; const fg = beadsFig({ ...it.beads, id: it.beads.id ?? it.id }, at); w.figs.push(fg); slot.appendChild(fg.wrap); blocks.push(w); }
      else if (it.recorder) { const w = { wide: true, figs: [] }; zone = w; const fg = recorderFig({ ...it.recorder, id: it.recorder.id ?? it.id }, at); w.figs.push(fg); slot.appendChild(fg.wrap); blocks.push(w); }
      else if (it.wheel) { const w = { wide: true, figs: [] }; zone = w; const fg = wheelFig({ ...it.wheel, id: it.wheel.id ?? it.id }, at); w.figs.push(fg); slot.appendChild(fg.wrap); blocks.push(w); }
      else if (it.pileup) { const w = { wide: true, figs: [] }; zone = w; const fg = pileupFig({ ...it.pileup, id: it.pileup.id ?? it.id }, at); w.figs.push(fg); slot.appendChild(fg.wrap); blocks.push(w); }
      else if (WIDEVIS.some(k => it[k] != null)) { const w = { wide: true, figs: [] }; zone = w; const fg = it.flow && s.beat === 'plan' ? track(it.flow, at) : figure(it, at); w.figs.push(fg); slot.appendChild(fg.wrap); blocks.push(w); }
      else if (it.col) cols.push({ ...it.col, at });
      else if (it.params) { const pr = it.params, e = tag(h('div', 'bi params g rl'), at, pr.id);
        e.innerHTML = (pr.say ? `<div class="ph">${md(pr.say)}</div>` : '') + list(pr.names).map(q => `<div class="pr" data-n="${L.esc(q)}"><span class="ps"></span><b class="pv"></b><span class="pn">${md(shortOf(ctx, q))}</span></div>`).join('');
        lines.push({ params: e, at, el: e }); (pr.side && zl ? zl : slot).appendChild(e); }
      else if (it.compare) { const cp = it.compare, e = tag(h('div', 'bcmp bi'), at, cp.id);
        ['a', 'b'].forEach(k => { const x = cp[k] || {}, side = h('div', 'side g');
          side.innerHTML = `${x.tone ? `<div class="tone ${x.tone}"><i>${x.tone === 'good' ? '✓' : '✗'}</i>${md(x.verdict || (x.tone === 'good' ? 'works' : 'fails'))}</div>` : ''}<h3>${md(x.title || '')}</h3>${x.text ? `<div class="p">${md(x.text)}</div>` : ''}`;
          if (x.visual) side.appendChild(visual(x.visual).node);
          e.appendChild(side); });
        lines.push({ el: e, at }); slot.appendChild(e); }
      // a matrix step from the deck's ops renderer: its steps land on this step and the next ones, with its own Back and Next
      else if (it.ops) { const O = L.types.ops({ ...it.ops, title: '' }, ctx), T = O.steps - 1, clk = t => clickOf(j + 1 + t), body = O.node.querySelector('.body');
        ['i', 'j'].forEach(q => { const c = symColor(q); if (c) body.style.setProperty(`--c${q}`, c); });   // rows take i's colour, columns j's
        const e = h('div', 'bops bi'); if (it.ops.id) e.dataset.id = it.ops.id; e.appendChild(body); body.querySelectorAll('.opsw, .opcard').forEach(q => q.classList.add('fr')); lines.push({ el: e, at });
        const stops = Array.from({ length: T + 1 }, (_, t) => clk(t)), rows = list(L.val(it.ops.matrix && (it.ops.matrix.values ?? it.ops.matrix.from), ctx.scope, 'ops')).length || 4;
        const w = { wide: true, figs: [] }; zone = w; const fg = { node: e, O, kind: 'ops', issues: [], stops: stops.slice(1), w: 0, h: 0 };
        fg.paint = c => O.show(1 + stops.slice(1).filter(q => q <= c).length);
        fg.size = room => { fg.w = room.w; body.style.height = ''; O.layout(); const vecs = list(it.ops.steps).length; fg.h = Math.max(body.offsetHeight, Math.round(46 * (rows + 3 + Math.min(vecs, 2))));
          // with the scene's head at the top of the window, the card, the line above it and its buttons stay on screen
          const st = fg.wrap && fg.wrap.closest('.st'), rc = x => x.getBoundingClientRect(), above = st ? rc(e).top - rc(st).top : 0, foot = fg.wrap ? fg.wrap.offsetHeight - e.offsetHeight : 0;
          if (room.h && st) fg.h = Math.min(fg.h, Math.max(Math.round(46 * (rows + 2)), room.h - above - foot));
          body.style.height = fg.h + 'px'; return fg.w; };
        holder(fg, at, it.ops); w.figs.push(fg); blocks.push(w); slot.appendChild(fg.wrap); }
      else if (it.note != null) { const nt = typeof it.note === 'string' ? { text: it.note } : it.note;
        const e = tag(h('div', 'bi note g rl', md(nt.text || '')), at, nt.id); lines.push({ note: e, at, el: e }); (nt.side && zl ? zl : slot).appendChild(e); }
    };

    steps.forEach((st, j) => { if (!st) return;
      const items = list(st.add).filter(it => it && typeof it === 'object').sort((a, b) => (b.strip ? 1 : 0) - (a.strip ? 1 : 0)), fig = items.find(isFig), wide = items.find(isWide), bridge = pending; pending = null;
      if (fig) { cur = block(); zone = cur; }
      const el = makeStep(st, j); let slot = el;
      // the line that leads from the numbers to the symbols stands between the two rows; what it adds comes after the plate
      if (fig && st.say && !bridge) el.classList.add('intro');   // a figure above its lines keeps this one above it
      if (bridge) { bridge.appendChild(el); slot = fig ? cur.side : wide ? root : (cur ? cur.side : items.length ? column() : el); }
      else if (fig) cur.side.appendChild(el);
      else if (wide) { root.appendChild(el); el.classList.add('wide'); }
      else (cur ? cur.side : column()).appendChild(el);
      if (wide && !fig) zone = null;
      items.forEach(it => addItem(it, j, wide && fig && isWide(it) ? root : slot, cur));
      if (el.fold) slot.appendChild(el.fold);   // the step's extra reading comes after what the step writes
      el.zone = zone; if (wide) seg = cur = null; });
    if (zl && !pair) root.prepend(zl);
    const broad = steps.some(st => st && list(st.add).some(it => it && it.ops)); root.classList.toggle('broad', broad);

    // ---------- linked words: ==pixel== in the scene's text names a mark of its plane, space or chart ----------
    // by its `label`, a chart mark's `name`, its `id`, or the symbol it draws; ==pixel:Your pixel== shows other words. The word
    // takes the mark's colour (a symbol's is its TeX). Pointing at it, or Tab, lights the mark and dims the rest; pointing at the
    // mark or its legend entry washes its words. A word whose mark is not drawn at this stop waits at 75%, with no light and no
    // Tab, so it never shows a think stop's answer early. A tap keeps a word lit until the next tap. It opens no card (a card
    // would cover the lines being read). Text that names no mark keeps ==text==, the orange underline
    const lkeys = new Map();
    if (slopeFig) figs.push(slopeFig);
    figs.forEach((fg, f) => { if (!['plane', 'space', 'chart', 'chance', 'fork', 'beads', 'slope', 'recorder', 'wheel', 'pileup'].includes(fg.kind)) return;
      list(fg.kind === 'chart' ? (fg.spec.chart || {}).marks : ['chance', 'beads', 'slope', 'recorder', 'wheel', 'pileup'].includes(fg.kind) ? fg.keys.map(k => ({ label: k })) : fg.kind === 'fork' ? list(fg.spec.ends).map(e => e && typeof e === 'object' ? { label: e.via, id: e.name } : null) : fg.spec.marks).forEach((mk, i) => { if (!mk || typeof mk !== 'object') return;
        const q = fg.kind === 'chart' ? (mk.kind === 'hline' ? mk.y : mk.kind === 'vline' ? mk.x : mk.kind === 'point' ? (mk.at || [])[1] ?? mk.y : null) : mk.vector ?? mk.point;
        const sym = typeof q === 'string' && (ctx.symbols || {})[q] ? q : null;   // first mark wins a shared key (the lint stops a link to one)
        [mk.label, fg.kind === 'chart' ? mk.name : null, mk.id, sym].forEach(k => { if (k != null && String(k).trim() && !lkeys.has(String(k).trim())) lkeys.set(String(k).trim(), [f, i, String(k).trim() === sym]); }); }); });
    if (lkeys.size) node.querySelectorAll('mark.hi:not(.tc)').forEach(el => { if (el.closest('.plegend, .legend, .chart, table, svg')) return;
      const tx = el.textContent, c = tx.indexOf(':'), whole = tx.trim(), pre = tx.slice(0, Math.max(0, c)).trim(), key = lkeys.has(whole) ? whole : c > 0 && lkeys.has(pre) ? pre : null; if (key == null) return;
      const [f, i, drawsSym] = lkeys.get(key), S = drawsSym ? (ctx.symbols || {})[key] : null;   // TeX only when the mark draws that symbol
      if (key !== whole) el.innerHTML = el.innerHTML.replace(/^[^:<]*:\s*/, '');
      else if (S) el.innerHTML = `<span class="tx" data-tex="${L.esc(S.tex || L.autoSym(key))}"></span>`;   // a symbol's word is its TeX
      el.classList.add('tc', 'lnk'); el.dataset.lnk = `${f}:${i}`; if (figs[f].linked) figs[f].linked.add(i); });
    let wOver = null, wFocus = null, wPin = null, wFig = null, wTouch = false;   // the word pointed at, focused or tapped; the mark pointed at
    const wInfo = k => { const [f, i] = k.split(':').map(Number); return figs[f] && figs[f].wl ? figs[f].wl(i) : { drawn: false }; };
    // the first look (C10p S3, a kit default): at rest, with no word or mark pointed at, focused or tapped, the drawn marks a
    // lead, say or think question links glow (told) and the figure's other marks step back. A think answer does not count, so
    // it never shows early. A figure whose every linked mark is told keeps its plain look: nothing would step back
    const restOf = () => { const by = new Map();
      node.querySelectorAll('.lnk').forEach(el => { if (el.closest('.stopl, .ta') || !wInfo(el.dataset.lnk).drawn) return; const [f, i] = el.dataset.lnk.split(':').map(Number); (by.get(f) || by.set(f, new Set()).get(f)).add(i); });
      by.forEach((set, f) => { const fg = figs[f]; if (!fg.wlRest) { by.delete(f); return; }
        const N = Math.max(list((fg.spec || {}).marks).length, (fg.keys || []).length), n = fg.kind === 'chart' ? Infinity : [...Array(N).keys()].filter(i => fg.wl(i).drawn).length;
        if (set.size >= n) by.delete(f); });   // a chart's series always step back
      return by; };
    const wsync = () => { waitSync(); figs.forEach(fg => fg.wait && fg.wait()); if (!lkeys.size) return; let act = wOver ?? wFocus ?? wPin; if (act && !wInfo(act).drawn) act = null;
      const rest = act || wFig ? null : restOf();
      figs.forEach((fg, f) => { if (fg.wlLight) fg.wlLight(act && +act.split(':')[0] === f ? +act.split(':')[1] : null); if (fg.wlRest) fg.wlRest(rest && rest.get(f) || null); });
      node.querySelectorAll('.lnk').forEach(el => { const k = el.dataset.lnk, d = wInfo(k);
        if (d.c) el.style.setProperty('--hc', d.c); el.classList.toggle('lnk-grad', !!d.grad); if (d.grad) { el.style.setProperty('--g0', d.grad[0]); el.style.setProperty('--g1', d.grad[1]); }
        el.classList.toggle('lnk-wait', !d.drawn); if (d.drawn && !el.closest('.stopl')) el.tabIndex = 0; else el.removeAttribute('tabindex');   // the copy by the buttons is no second Tab stop
        el.classList.toggle('lnk-on', d.drawn && (k === act || k === wFig)); }); };
    const wordAt = e => { const w = e.target.closest && e.target.closest('.lnk'); return w && !w.classList.contains('lnk-wait') ? w.dataset.lnk : null; };
    figs.forEach((fg, f) => { fg.onHot = i => { const k = i == null ? null : `${f}:${i}`; if (k !== wFig) { wFig = k; wsync(); } }; });
    if (lkeys.size) {
      node.addEventListener('mousedown', e => { if (e.target.closest('.lnk')) e.preventDefault(); });   // a click makes no selection and no focus ring
      node.addEventListener('pointerover', e => { if (e.pointerType === 'touch') return; const k = wordAt(e); if (k !== wOver) { wOver = k; wsync(); } });
      node.addEventListener('pointerleave', () => { if (wOver) { wOver = null; wsync(); } });
      node.addEventListener('focusin', e => { const k = wordAt(e); if (k !== wFocus) { wFocus = k; wsync(); } });
      node.addEventListener('focusout', () => { if (wFocus) { wFocus = null; wsync(); } });
      node.addEventListener('click', e => { const k = wordAt(e); if (k && wTouch) { wPin = wPin === k ? null : k; wsync(); } });
      document.addEventListener('pointerdown', e => { wTouch = e.pointerType === 'touch'; const w = wTouch && wPin && e.target.closest && e.target.closest('.lnk');
        if (wTouch && wPin && !(w && node.contains(w) && w.dataset.lnk === wPin)) { wPin = null; wsync(); } }, true);
    }

    const tcols = s.table ? list(s.table.cols).map(c => typeof c === 'string' ? { key: c } : c).concat(cols) : [];
    const tkeys = new Set(tcols.map(c => c.key));
    const rowsOf = () => s.table ? list(L.val(s.table.from, ctx.scope, `slide ${ctx.index + 1} table.from`)) : [];
    const kindOf = q => ((ctx.symbols || {})[q] || {}).kind;
    // a value data.json (or the top-level derive) already holds must come out the same on the board (KTD21)
    const given = Object.getPrototypeOf(ctx.scope) || {}, clash = [], pclash = [];   // pclash: products, kept from the last check at the start
    const store = (q, v) => { if (!q) return; ctx.scope[q] = v;
      if (typeof given[q] === 'number' && typeof v === 'number' && Math.abs(given[q] - v) > 1e-9 * Math.max(1, Math.abs(v)))
        clash.push(`\`${q}\` works out to ${L.fmt(v, 's4')} on the board but the data says ${L.fmt(given[q], 's4')}: make_data.py and the page disagree`); };
    // each worked line's numbers, in order, so a later line (and the first {{}} fill) can read an earlier result
    const work = () => {
      const rows = rowsOf(); clash.length = 0;
      // a worked product's result (lesson.py writes it as `name: matmul(m, v)`) must match the data's copy too; the copy
      // holds the starting numbers, so compare only while every control is where it starts
      const atStart = (s.controls || []).every(c => !c || ctx.scope[c.name] === +(c.value ?? c.min));
      if (atStart) pclash.length = 0;
      if (atStart) Object.entries(s.derive || {}).forEach(([q, x]) => { const a = ctx.scope[q], b = given[q]; if (!/^matmul\(/.test(String(x)) || !Array.isArray(a) || !Array.isArray(b)) return;
        const fa = [].concat(...a), fb = [].concat(...b); if (fa.length !== fb.length || fa.some((y, k) => Math.abs(y - fb[k]) > 1e-9 * Math.max(1, Math.abs(y))))
          pclash.push(`\`${q}\` works out to [${fa.map(y => L.fmt(y, 's4')).join(', ')}] on the board but the data says [${fb.map(y => L.fmt(y, 's4')).join(', ')}]: make_data.py and the page disagree`); });
      lines.forEach(ln => { if (!ln.c) return; const c = ln.c, where = `slide ${ctx.index + 1} board line`;
        ln.sc = c.row != null && rows[c.row] ? L.scope(ctx.scope, rows[c.row]) : ctx.scope;
        ln.val = c.expr ? L.try(c.expr, ln.sc, where) : null; store(c.name, ln.val);
        ln.reads = L.names(c.expr || '').filter(q => c.row != null && tkeys.has(q));
      });
    };
    work();
    // a formula from an expression or from TeX with [name] terms, each input's symbol wrapped for its colour and name
    const sym = q => symOf(ctx, q), lt = (q, tx) => `\\htmlClass{lt lt-${q}}{${tx}}`;
    const formTex = f => {
      if (f.mat) return { tex: `${lt(f.mat, sym(f.mat))} = ${L.matTex(f.mat, ctx.scope, undefined, f.row)}`, ids: [] };
      // only the author's own tex is read for {{…}}: kit-made TeX can hold {{ (a wrapped {x}_{3}) that is not a number
      const ids = [], body = f.expr ? L.tex(f.expr, { sym, wrap: lt }) : L.interp(String(f.tex || ''), ctx.scope, true).replace(/\[([A-Za-z_]\w*)\]/g, (_, q) => { if (!ids.includes(q)) ids.push(q); return lt(q, sym(q)); });
      if (f.expr) ids.push(...L.names(f.expr));
      return { tex: f.lhs ? `${lt(f.lhs, sym(f.lhs))} = ${body}` : body, ids: ids.filter(q => q !== f.lhs) };
    };
    // a term's name is on its pop-up card, not under the formula (the user's pick: names live in pop-ups only)
    const drawAsm = () => asm.forEach(A => {
      const a = A.a, [nm, sy] = A.e.querySelectorAll('.arow .math'), { tex, ids } = formTex(a);
      let nums;
      if (a.expr) { const v = L.try(a.expr, ctx.scope, `slide ${ctx.index + 1} assemble`); store(a.lhs, v);
        const { tex: sub, eq } = L.work(a.expr, { slash: true, val: q => typeof ctx.scope[q] === 'number' ? ctx.scope[q] : null, arr: q => Array.isArray(ctx.scope[q]) ? ctx.scope[q] : null, wrap: lt, fmt: a.fmt, lit: null, fmtOf: (q, x) => subFmt(ctx, q, x) }, v, a.fmt, ctx.scope);
        nums = `${sub} ${eq} \\htmlClass{res}{${L.numTex(v, a.fmt)}}`; }
      else nums = L.interp(String(a.plug || ''), ctx.scope, true).replace(/\[([A-Za-z_]\w*):([^\]]*)\]/g, (_, q, x) => q === a.lhs ? `\\htmlClass{res}{${x}}` : lt(q, x)).replace(/\[([A-Za-z_]\w*)\]/g, (_, q) => lt(q, sym(q)));
      L.renderTex(nm, nums, false); L.renderTex(sy, tex, false); tint(nm, symColor); tint(sy, symColor); fitMath([nm, sy]);
    });
    // write each worked line: symbol = formula, = numbers, = result (stacked at the = signs when too long for a row)
    const drawLines = () => {
      work();
      const shownFmt = {};
      lines.forEach(ln => {
        if (ln.f) { const m = ln.el.querySelector('.math'), { tex, ids } = formTex(ln.f); L.renderTex(m, tex, false); tint(m, symColor); fitMath([m]); return; }
        if (!ln.c) return; const c = ln.c, math = ln.row.querySelector('.math'); math.innerHTML = ''; math.classList.remove('wrapped');
        if (!c.expr) return;
        const f = L.tex(c.expr, { sym, wrap: (q, tx) => lt(q, tx) });
        const { tex: sub, eq } = L.work(c.expr, { slash: true, val: q => typeof ln.sc[q] === 'number' ? ln.sc[q] : null, arr: q => Array.isArray(ln.sc[q]) ? ln.sc[q] : null, wrap: (q, tx) => lt(q, tx),
          fmt: c.fmt, lit: null, fmtOf: (q, x) => subFmt(ctx, q, x, shownFmt[q]) }, ln.val, c.fmt, ln.sc);
        const parts = [[c.name ? `${lt(c.name, sym(c.name))} = ${f}` : f, 'f'], [`= ${sub}`, 'sub'], [`${eq} \\htmlClass{res}{${L.numTex(ln.val, c.fmt)}}`, 'r']];
        parts.forEach(([tx, cls]) => { const sp = h('span', 'part ' + cls); math.appendChild(sp); L.renderTex(sp, tx, false); });
        const ps = [...math.children]; ps.slice(0, 2).forEach(q => tint(q, symColor)); fitMath([math]); if (ps.some((e, q) => q && e.offsetTop >= ps[q - 1].offsetTop + ps[q - 1].offsetHeight - 2)) math.classList.add('wrapped');
        if (c.name) shownFmt[c.name] = c.fmt;
      });
    };
    // a parameter card: each named number with its symbol in its colour, its value now and its name (it follows the sliders)
    const drawParams = () => lines.forEach(ln => ln.params && ln.params.querySelectorAll('.pr').forEach(r => { const q = r.dataset.n, v = ctx.scope[q];
      r.style.setProperty('--tc', symColor(q) || 'var(--ink)'); L.renderTex(r.querySelector('.ps'), symOf(ctx, q), false);
      r.querySelector('.pv').textContent = typeof v === 'number' ? L.fmt(v, ((ctx.symbols || {})[q] || {}).fmt ?? 's4') : '?'; }));

    // controls, registered in ctx.ctl so the check moves each to both ends (lesson.py writes a run or a toggle as a plain
    // slider first): a slider; a run (frames 0..n-1: a scrubber, a play button that is off until pressed and never runs
    // under ?check); a toggle (two buttons, 0 and 1). Each sits under the figure it drives. Its label is its symbol (the run's
    // `show:` symbol), in its colour, opening that symbol's card; else one word, whose card is its own `says:`. The value
    // column shows the bare value: a slider's, a run's `show:` name now, else the run's frame. All rows in one box share one
    // grid (play | label | track | value), so every track starts and ends at the same place.
    const CHECK = new URLSearchParams(location.search).has('check');
    let run = null, flowBox = null;
    const readouts = [], ctlBad = new Set();   // ctlBad: a run's `show:` that is not a number, for the audit
    const drawCtl = () => readouts.forEach(f => f());
    const driven = name => { const seen = new Set([name]), d = Object.entries(s.derive || {}); let more = true;
      while (more) { more = false; d.forEach(([k, x]) => { if (!seen.has(k) && L.names(String(x)).some(q => seen.has(q))) { seen.add(k); more = true; } }); } return seen; };
    const driverOf = name => { const set = driven(name), fs = figs.filter(fg => fg.kind !== 'slope');   // a slope table takes no controls
      return fs.find(fg => (exprsOf(fg.spec).match(/[A-Za-z_]\w*/g) || []).some(w => set.has(w))) || fs[fs.length - 1] || null; };
    const boxOf = fg => { if (fg) { if (!fg.box) { fg.box = h('div', 'controls np'); fg.wrap.appendChild(fg.box); } return fg.box; }
      if (!flowBox) { flowBox = h('div', 'controls np'); (seg || cur && cur.side || root).appendChild(flowBox); } return flowBox; };
    // the label: a symbol (its TeX, its colour, its card) or one word (its card from the control's own `says`)
    const ctlLabel = (c, now) => { const q = c.toggle ? c.name : (c.show || c.name), B = bookOf(), S = B && B.S[q];
      const el = h('span', 'clab');
      if (S) { el.classList.add('vt', 'says', 'lt-' + q); L.renderTex(el, S.tex || L.autoSym(q), false); el.style.color = hue(S.color) === 'var(--mist)' ? 'var(--ink)' : hue(S.color);
        glow(el, hue(S.color)); el.tabIndex = 0; if (S.says) el.setAttribute('aria-description', L.plain(String(S.says))); pauseButton(); return [el, S.short || q]; }
      const word = c.label ?? c.name; el.innerHTML = md(String(word));
      if (c.says) { el.classList.add('vt', 'says'); el.tabIndex = 0; glow(el, 'var(--mist)'); el.setAttribute('aria-description', L.plain(String(c.says))); pauseButton();
        el._pd = () => ({ tex: null, c: 'var(--mist)', ink: true, name: String(word), says: c.says, value: now(), shape: null, scope: ctx.scope }); }
      return [el, L.plain(String(word))]; };
    (s.controls || []).forEach(c => {
      const id = `ctl-${ctx.index}-${c.name}`, v0 = c.value ?? c.min, fg = driverOf(c.name), k = c.run || 0;
      // the value now, as the value column shows it
      const now = () => { const v = ctx.scope[c.name];
        if (c.toggle) return c.toggle[+v] ?? null;
        if (k && !c.show) return Math.abs(+v - Math.round(+v)) < 1e-9 ? String(Math.round(+v)) : (+v).toFixed(1);   // a run moving smoothly is between frames
        const q = k ? c.show : c.name, x = ctx.scope[q], S = ((ctx.symbols || {})[q]) || {};
        if (typeof x === 'number') return L.fmt(x, k ? (S.fmt ?? 's4') : (c.fmt ?? S.fmt));
        if (k) ctlBad.add(`the run's show: ${q} is ${Array.isArray(x) ? 'a list' : 'not a number'}, so its value column has no value: show a number the run moves`);
        return '—'; };
      const [lab, aria] = ctlLabel(c, now);
      let w, set;
      if (c.toggle) {
        w = h('div', 'ctl g pill thin tog');
        w.innerHTML = `<div class="seg2" role="group">${c.toggle.map((t, q) => `<button type="button" data-v="${q}">${md(t)}</button>`).join('')}</div>`;
        w.prepend(lab); w.querySelector('.seg2').setAttribute('aria-label', aria);
        const bs = [...w.querySelectorAll('button')];
        set = v => { ctx.scope[c.name] = +v; bs.forEach(b => b.classList.toggle('on', +b.dataset.v === +v)); };
        bs.forEach(b => b.addEventListener('click', () => { untween(ctx, c.name); set(b.dataset.v); ctx.refresh(); }));
      } else {
        w = h('div', 'ctl g pill thin' + (k ? ' run' : ''));
        w.innerHTML = `${k ? '<button type="button" class="play" aria-label="play"></button>' : ''}<input id="${id}" type="range" min="${c.min}" max="${c.max}" step="${c.step ?? (c.max - c.min) / 100}" value="${v0}"><output for="${id}"></output>`;
        w.insertBefore(lab, w.querySelector('input'));
        const inp = w.querySelector('input'), out = w.querySelector('output'); inp.setAttribute('aria-label', aria);
        readouts.push(() => { out.textContent = now(); });
        // the value column changes now for a slider or a bare frame; a run's `show:` name waits for the redraw that works it out
        set = v => { ctx.scope[c.name] = +v; inp.value = v; if (!(k && c.show)) out.textContent = now(); inp.style.setProperty('--fill', ((v - c.min) / (c.max - c.min) * 100) + '%'); };
        inp.addEventListener('input', () => { stop(); untween(ctx, c.name); set(inp.value); if (k) follow(); ctx.refresh(); });
        if (k) {
          const btn = w.querySelector('.play');
          const halt = () => { if (run.raf) { cancelAnimationFrame(run.raf); run.raf = null; inp.step = c.step ?? 1; } if (run.timer) { clearInterval(run.timer); run.timer = null; btn.classList.remove('on'); btn.setAttribute('aria-label', 'play'); } };
          run = { c, n: k, set, fg, stop: halt, timer: null };
          const fin = v => typeof v === 'number' ? Number.isFinite(v) : Array.isArray(v) ? v.every(fin) : typeof v !== 'undefined';
          const okAt = f => { try { const sc = L.scope(ctx.scope, { [c.name]: f }); L.derive(sc, (((ctx.deck.slides || [])[ctx.index] || {}).derive), `slide ${ctx.index + 1} run`); return Object.keys(sc).every(q => fin(sc[q])) && figs.every(fg => !fg.badAt || fg.badAt(sc) <= fg.badAt(ctx.scope)); } catch (_) { return false; } };
          const between = () => { for (let f = 0; f < k - 1; f++) if (!okAt(f + .5)) return false; return true; };
          const whole = () => { if (L.slides[L.i] && L.slides[L.i].ctx !== ctx) return halt(); const f = ctx.scope[c.name] + 1; set(f); follow(); ctx.refresh(); if (f >= k - 1) halt(); };
          btn.addEventListener('click', () => { if (run.timer) return halt(); if (CHECK) return;
            if (ctx.scope[c.name] >= k - 1) { set(0); follow(); ctx.refresh(); }
            btn.classList.add('on'); btn.setAttribute('aria-label', 'pause');
            // the frame number moves on every animation frame at the run's own pace (`every` seconds a frame), so each mark passes
            // through the worked-out states between frames. It steps a whole frame at a time with reduced motion, or when the
            // scene's formulas do not work between frames (one picks a frame's row of the data: `at(list, t)`)
            if (!STILL() && between()) { const per = 1000 * (c.every || 1.3), f0 = +ctx.scope[c.name], t0 = performance.now(); inp.step = 'any'; run.timer = -1;
              const tickR = now => { if (!run.raf) return; if (L.slides[L.i] && L.slides[L.i].ctx !== ctx) return halt(); const f = Math.min(k - 1, f0 + (now - t0) / per);
                if (!okAt(f)) { cancelAnimationFrame(run.raf); run.raf = null; inp.step = c.step ?? 1; set(Math.floor(f)); follow(); ctx.refresh(); run.timer = setInterval(whole, per); return; }   // not a number here: whole frames from now on
                set(f); follow(); ctx.refresh(); if (f >= k - 1) { set(k - 1); halt(); } else run.raf = requestAnimationFrame(tickR); };
              run.raf = requestAnimationFrame(tickR); return; }
            run.timer = setInterval(whole, 1000 * (c.every || 1.3)); });
        }
      }
      set(v0); if (c.drag) w.classList.add('hid');   // a hunt's or a split's controls are its handles: no row
      ctx.ctl[c.name] = v => { set(v); ctx.refresh(); };
      const box = boxOf(fg); if (k) box.classList.remove('np'); box.appendChild(w);
    });
    drawCtl();
    function stop() { if (run) run.stop(); }
    // the frame each click shows: the latest step's `frame:` at or before it, else the run's stops in click order
    const framed = steps.some(st => st && st.frame != null), rstops = run ? list(run.c.stops) : [];
    const frameAt = k => { if (!run) return null; let f = framed ? (run.c.value ?? 0) : null;
      steps.forEach((st, j) => { if (map[j].at > k) return;
        if (framed) { if (st && st.frame != null) f = st.frame; } else f = rstops[Math.min(j, rstops.length - 1)]; });
      return f ?? rstops[0] ?? 0; };
    const frameStops = run ? (framed ? steps.flatMap((st, j) => st && st.frame != null ? [map[j].at] : []) : steps.slice(0, rstops.length).map((_, j) => map[j].at)) : [];

    // ---------- figures that change ----------
    const shown = (nd, c) => nd.querySelectorAll('[data-step]').forEach(e => e.classList.toggle('shown', +e.dataset.step <= c));
    // a sticky figure past its top is held up by the foot of its block. When the text column grows the foot drops and the figure
    // would drop with it, and the next click would miss Next. So the figure holds its place, and lets go as the reader scrolls back
    const held = new Map();
    const hold = fn => { const fs = [...node.querySelectorAll('.fb.beside > .ffig:not(.nostick)')], was = fs.map(f => f.getBoundingClientRect().top), out = fn();
      fs.forEach((f, i) => { if (was[i] < STUCK && f.getBoundingClientRect().top > was[i] + .5) { f.style.top = was[i] + 'px'; held.set(f, [was[i], scrollY]); } });
      return out; };
    const letGo = () => held.forEach((p, f) => { p[1] = Math.max(p[1], scrollY); const y = p[0] + p[1] - scrollY; if (y < STUCK) f.style.top = y + 'px'; else { f.style.top = ''; held.delete(f); } });   // p: where it holds, the deepest scroll since
    const stages = [];
    const makeStage = (host, stops0, paint, zoneOf, frames) => {
      const uniq = [...new Set(stops0)].sort((a, b) => a - b); if (uniq.length < 2) return null;
      const S = { node: host, stops: uniq, i: 0, frames, ask: null };
      const stopOf = at => { let i = 0; uniq.forEach((c, q) => { if (c <= at) i = q; }); return i; };
      const unanswered = c => thinks.some(e => +e.dataset.at === c && !e.classList.contains('open'));
      const stepAt = c => stepEls.find(e => +e.dataset.at === c);
      // a stop on a think step takes two presses: the first asks and leaves the figure alone, the second answers and moves it
      const qOf = c => +(stepAt(c) || { dataset: {} }).dataset.q || c;   // a think's question click: asking shows what comes with it (a hunt's guess)
      const asked = j => { S.ask = j; S.show(); const c = j == null ? uniq[S.i] : +stepAt(uniq[j]).dataset.q; light(c); mark(c); };
      const go = (v, rel) => hold(() => {
        if (rel && v < 0 && S.ask != null) { asked(null); return true; }
        const j = rel ? S.i + v : v; if (j < 0 || j >= uniq.length || j === S.i) return false;
        if (j > S.i && S.ask !== j && unanswered(uniq[j])) { if (j > S.i + 1) S.to(j - 1); asked(j); return true; }
        if (j > S.i && unanswered(uniq[j]) && gated(uniq[j])) return true;   // a hunt's answer waits for a drag
        S.to(j); return true; });
      const ui = stageBar(uniq, go);
      // the line by the buttons, from the second stop on (the first is the line just read): the step's own words, or for a think step its question and then its answer
      const lineOf = (c, answered) => { const e = stepAt(c), ta = e && e.querySelector('.ta > span:last-child'), q = e && e.querySelector('.tqt'), say = e && e.querySelector(':scope > .say');
        return (answered ? ta || say : say || q) || q; };
      S.show = () => { const on = S.ask != null, c = uniq[on ? S.ask : S.i], e = lineOf(c, !on && !unanswered(c));
        paint(on ? Math.max(uniq[S.i], qOf(c)) : uniq[S.i]); ui.set(S.i, on); ui.line.innerHTML = e && (on || S.i) ? e.innerHTML : '';
        S.lines.forEach(q => q.classList.toggle('atstop', on ? +q.dataset.at === c : stopOf(+q.dataset.at) === S.i)); S.quiet(); wsync(); };
      // the line is there for when a step's own words are out of sight: with those words on screen it steps aside, and keeps its room
      S.quiet = () => { const l = ui.line, t = same(l); l.style.visibility = t && [...node.querySelectorAll(WORDS)].some(e => same(e) === t && inWindow(e)) ? 'hidden' : ''; };
      // its room is the tallest words it will hold, so the page under it does not jump
      S.fit = () => { const l = ui.line; if (!l.clientWidth) return; const now = l.innerHTML; l.style.minHeight = ''; let most = 0;
        uniq.slice(1).forEach(c => [true, false].forEach(a => { const e = lineOf(c, a); if (e) { l.innerHTML = e.innerHTML; most = Math.max(most, l.offsetHeight); } }));
        l.innerHTML = now; l.style.minHeight = most + 'px'; };
      // go to a stop: the run takes its frame, the think stop there opens, the table lights up for that step
      S.to = j => { if (j < S.i) thinks.forEach(e => { const a = +e.dataset.at; if (a > uniq[j] && uniq.includes(a) && e.classList.contains('open')) setThink(e, false); });
        S.i = j; S.ask = null; const c = uniq[j];
        if (frames) { stop(); const f = frameAt(c); if (f != null && f !== ctx.scope[run.c.name]) ctx.ctl[run.c.name](f); }
        thinks.forEach(e => { if (+e.dataset.at === c) setThink(e, true); });
        S.show(); light(c); mark(c); };
      S.move = d => go(d, true);
      S.jump = at => go(stopOf(at), false);
      S.stopOf = stopOf;
      S.lines = stepEls.filter(e => (zoneOf && e.zone === zoneOf) || uniq.includes(+e.dataset.at));
      S.lines.forEach(e => { e.stages.push(S); e.classList.add('line'); });
      host.append(ui.bar, ui.line); stages.push(S); return S;
    };
    const setThink = (e, on) => { e.classList.toggle('open', on); e.querySelector('.tb').textContent = on ? 'Hide answer' : 'Show answer'; node.querySelectorAll(`[data-wait="${e.dataset.at}"]`).forEach(x => x.classList.toggle('open', on)); onAnswer(+e.dataset.at, on); };
    // a think's answer reveals a hunt's guess, turns a figure to the view it names, and moves the controls its `set:` names
    // (a split's tips); Hide answer undoes the reveal and the set. A hunt's Show answer stays dim until the learner has dragged
    const opened = new Set(), setWas = new Map();   // per think, in the order opened: the values its set replaced
    function gated(c) { return figs.some(f => f.huntAt === c) && !node.classList.contains('dragged'); }
    function onAnswer(at, on) { if (on === opened.has(at)) return; if (on) opened.add(at); else opened.delete(at);
      const st = steps[map.findIndex(q => q.at === at)]; if (!st) return;
      figs.forEach(f => { if (f.huntAt === at && f.reveal) f.reveal(on); if (on && f.answerView) f.answerView(at); });
      const t = typeof st.think === 'object' ? st.think : {}; if (!t.set) return;
      if (on) { const was = {}, to = {}; setWas.delete(at); setWas.set(at, was); Object.entries(t.set).forEach(([k, x]) => { const mv = ctx.tw && ctx.tw[k]; was[k] = mv ? mv.to[k] : ctx.scope[k]; to[k] = L.val(x, ctx.scope, `slide ${ctx.index + 1} think set`); }); tweenCtl(ctx, to); }
      else if (setWas.has(at)) { const was = setWas.get(at), back = {}, rest = [...setWas.keys()], later = rest.slice(rest.indexOf(at) + 1).map(a => setWas.get(a)); setWas.delete(at);
        Object.keys(was).forEach(k => { const w = later.find(q => k in q); if (w) w[k] = was[k]; else back[k] = was[k]; });   // an answer opened after this one still holds k: it inherits the value to go back to
        tweenCtl(ctx, back); } }
    function waitSync() { thinks.forEach(e => { e.querySelector('.tb').disabled = gated(+e.dataset.at) && !e.classList.contains('open'); }); }
    node.addEventListener('hands-dragged', () => { if (!node.classList.contains('dragged')) { node.classList.add('dragged'); waitSync(); } });
    // Show answer brings in all the step adds, a stage stop too; Hide answer takes it away again
    function answer(e) { hold(() => { const on = !e.classList.contains('open'), at = +e.dataset.at; if (on && gated(at)) return false; setThink(e, on);
      stages.forEach(S => { const j = S.stops.indexOf(at); if (j < 0) return; if (on && S.i < j) S.to(j); else if (!on && S.i >= j && j > 0) { S.to(j - 1); setThink(e, false); } });
      fill(Math.max(read, on ? at : 0)); }); }
    // the run's stage follows the scrubber: the line and the dot of the frame on show
    function follow() { const S = stages.find(x => x.frames); if (!S) return; let i = 0; S.stops.forEach((c, q) => { if (frameAt(c) <= ctx.scope[run.c.name]) i = q; }); S.i = i; S.show(); }

    // ---------- the table ----------
    // the pinned table: the given columns, plus any column a step adds: it holds its place, and fills in when the reading gets there
    // A slope table (the C10p mock-up, approved 11 Nov; a style of the table, the user's 13 Nov pick): the first column names
    // each line; every other column is an upright ink stem, all on one scale from 0 (or the lowest value) to a round top. One
    // line a row joins its values, in its group's colour, a dot on each stem. The outer stems carry each value and name, pushed
    // apart when ends are close (a short lead back to the end); a middle stem shows its values only while the line is lit. A
    // stem a step adds stands faint, its label showing, until the reading gets there; then its dots and the segments to it come in.
    // Each row lights by `row:N`, a worked line's `row:` (its dots, on the stems it reads), pointing (a card with its values),
    // and its group's key entry or linked word
    const SL = { top: 78, foot: 64, lead: 24, gap: 10, sp: 150, lmin: 240, lmax: 380, near: 24, floor: 20, dot: 5.5 };
    const slopeDraw = Wfix => {
      const SF = slopeFig, tb = s.table, rows = slopeRows(), [nc, ...stems] = tcols, k = stems.length, ink = L.ink || {}, G = ink.GLYPHS || {}, gm = tb.glyphs || {};
      SF.issues = []; if (!nc || !k) return 0;
      const groups = slopeGroups(), gOf = r => groups.findIndex(q => q.g === String(r[tb.group]));
      const esc = t => L.esc(String(t)), lab = c => L.plain(String(c.label ?? c.key), ctx.scope), names = rows.map(r => String(r[nc.key] ?? ''));
      const V = rows.map((r, i) => stems.map(c => { let v = r[c.key]; if (c.expr) v = L.try(c.expr, L.scope(ctx.scope, r), `slide ${ctx.index + 1} column ${c.key}`);
        if (typeof v === 'number' && Number.isFinite(v)) return v; SF.issues.push(`the slope table: ${names[i]}'s ${lab(c)} is ${typeof v === 'number' ? v : JSON.stringify(v)}, not a number`); return NaN; }));
      // the scale holds 0 and every value; values all equal (all 0) still get a span of 1, so the ticks stay on the stem
      const all = V.flat().filter(Number.isFinite), lo = Math.min(0, ...all), hi = Math.max(0, ...all), span = hi - lo || 1, stp = niceStep(span);
      const from = Math.floor(lo / stp + 1e-9) * stp, top = from + Math.max(1, Math.ceil((Math.max(hi, lo + span) - from) / stp - 1e-9)) * stp;
      // the scale's words: as many decimals as the finest stem or the step needs, so the two ends never read the same
      const dec = Math.max(0, Math.ceil(-Math.log10(stp) - 1e-9), ...stems.map(c => /^\d+$/.test(String(c.fmt ?? '')) ? +c.fmt : 0));
      const fm = (v, j) => L.fmt(v, stems[j].fmt), words = `One scale, ${L.fmt(from, dec)} to ${L.fmt(top, dec)}.`;
      // what each text takes, measured in its own class
      const meter = sv('svg', { class: 'sltab', width: 0, height: 0, style: 'position:absolute;visibility:hidden' }, zt);
      const tw = (t, cls) => { const e = sv('text', { class: cls }, meter); e.textContent = t; const w = e.getComputedTextLength(); e.remove(); return w; };
      const vw = Math.max(0, ...V.flatMap(r => [0, k - 1].map(j => Number.isFinite(r[j]) ? tw(fm(r[j], j), 'slv') : 0)));
      const nwOf = names.map(t => tw(t, 'sln')), nw = Math.max(0, ...nwOf);
      const glOf = a => G[gm[groups[a] && groups[a].g]] || null, gr = Math.max(0, ...groups.map((_, a) => (glOf(a) || {}).r || 0)), mr = gr || SL.dot;
      const side = SL.lead + vw + SL.gap + nw + 8 + 2 * mr + 4;
      const kw = groups.map(q => tw(q.label, 'skt')), keyW = kw.reduce((w, x) => w + 1.6 * mr + 8 + x + 28, 0) + tw(words, 'slk') + 24;
      meter.remove();
      // a stem a later stem follows may carry the end labels for a while: then the stems stand far enough apart for them
      const ends0 = stems.map((_, j) => j > 0 && (j === k - 1 || stems.slice(j + 1).some(c => c.at))), sp = ends0.some((e, j) => e && j < k - 1) ? Math.max(SL.sp, Math.ceil(side + 16)) : SL.sp;
      SF.minW = Math.ceil(Math.max(2 * side + (k - 1) * sp, keyW));
      // the end labels of all rows must fit between the stem names and the key: closer together down to SL.floor (glyphs
      // shrink to match), then a taller figure
      let Lh = Math.max(SL.lmin, Math.min(SL.lmax, innerHeight - 420)), gap = Math.max(SL.near, 2 * gr + 4); const nr = rows.length;
      if ((nr - 1) * gap > Lh + 24) { gap = Math.max(SL.floor, (Lh + 24) / (nr - 1)); Lh = Math.max(Lh, Math.ceil((nr - 1) * gap - 24)); }
      const gk = gr ? Math.min(1, (gap - 4) / (2 * gr)) : 1;
      const W = Math.max(SF.minW, Math.round(Wfix || 0)), y0 = SL.top + Lh, H = y0 + SL.foot;
      const xs = stems.map((_, j) => side + j * (W - 2 * side) / (k - 1)), yOf = v => y0 - (v - from) / (top - from) * Lh;
      const at = c => c && c.at ? ` data-step="${c.at}"` + (waits.has(c.at) ? ` data-wait="${c.at}"` : '') : '';
      const later = (a, b) => (a && a.at || 0) >= (b && b.at || 0) ? a : b;   // a segment comes in with the later of its two stems
      const pen = (pts, seed, amp = .6) => ink.hand ? ink.hand(pts, seed, false, amp) : 'M' + pts.map(q => q.join(' ')).join('L');
      const n2 = Math.round((top - from) / stp), tick = n2 <= 5 ? stp / 2 : stp, nt = Math.round((top - from) / tick);
      let out = '';
      stems.forEach((c, j) => { const x = xs[j]; let tk = '';
        for (let t = 0; t <= nt; t++) { const y = yOf(from + t * tick).toFixed(1); tk += `<line class="stk" x1="${x - 4}" x2="${x + 4}" y1="${y}" y2="${y}"/>`; }
        out += `<g class="ss" data-col="${esc(c.key)}"${at(c)}><path class="ssl" d="${pen([[x, y0 + 8], [x, SL.top - 8]], 'stem' + j)}"/>${tk}` +
          `<text class="sst" x="${x}" y="${SL.top - 34}" text-anchor="middle">${esc(lab(c))}</text></g>`; });
      // the outer labels: those nearer than SL.near (or two glyphs) join a cluster centred on its values, until none overlap
      const spread = (ys, gap, lo2 = SL.top - 6, hi2 = y0 + 18) => { let cl = ys.map((y, i) => ({ y, i })).filter(q => Number.isFinite(q.y)).sort((a, b) => a.y - b.y || a.i - b.i).map(q => ({ m: [q], sum: q.y, at: q.y }));
        for (let moved = true; moved;) { moved = false;
          for (let q = 1; q < cl.length; q++) { const A = cl[q - 1], C = cl[q];
            if (A.at + A.m.length * gap > C.at + 1e-6) { const m = [...A.m, ...C.m], sum = A.sum + C.sum; cl.splice(q - 1, 2, { m, sum, at: sum / m.length - (m.length - 1) * gap / 2 }); moved = true; break; } } }
        const o = [];
        cl.forEach(c => { const a = Math.min(Math.max(c.at, lo2), hi2 - (c.m.length - 1) * gap); c.m.forEach((q, n) => { o[q.i] = a + n * gap; }); }); return o; };
      const ends = stems.map((_, j) => j === 0 || ends0[j] ? spread(V.map(r => yOf(r[j])), gap) : null);
      // a middle stem's values show only on lit lines: a group's word lights all its lines, so its values step apart too
      const mids = stems.map((_, j) => { const o = []; if (j === 0) return o;
        groups.forEach((_, a) => { const ii = rows.map((r, i) => gOf(r) === a ? i : -1).filter(i => i >= 0), ys = spread(ii.map(i => yOf(V[i][j]) - 10), 20, SL.top - 6, y0 + 10);
          ii.forEach((i, n) => { o[i] = ys[n]; }); }); return o; });
      const mark = (a, x, y, seed, sc = 1) => { const q = glOf(a); return q ? ink.glyph(gm[groups[a].g], x, y, seed, sc) : `<circle class="skd" cx="${x}" cy="${y}" r="${(SL.dot * sc).toFixed(1)}"/>`; };
      V.forEach((r, i) => { const a = gOf(rows[i]), c = (groups[a] || {}).c || 'var(--mist)', pts = r.map((v, j) => [xs[j], yOf(v)]);
        let body = '';
        for (let j = 1; j < k; j++) { if (!Number.isFinite(r[j - 1]) || !Number.isFinite(r[j])) continue;
          const d = `M${pts[j - 1][0].toFixed(1)} ${pts[j - 1][1].toFixed(1)}L${pts[j][0].toFixed(1)} ${pts[j][1].toFixed(1)}`;
          body += `<g class="sgs"${at(later(stems[j - 1], stems[j]))}><path class="slh" d="${d}"/><path class="sll" d="${d}"/></g>`; }
        const endAt = (j, sd) => { const [x, y] = pts[j], v = r[j], ly = ends[j][i], lx = x + sd * SL.lead, an = sd > 0 ? 'start' : 'end', nx = lx + sd * (vw + SL.gap);
          return (Math.abs(ly - y) > 1 ? `<path class="sle" d="M${(x + sd * 8).toFixed(1)} ${y.toFixed(1)}L${(lx - sd * 5).toFixed(1)} ${ly.toFixed(1)}"/>` : '') +
            `<text class="slv" x="${lx.toFixed(1)}" y="${(ly + 6).toFixed(1)}" text-anchor="${an}">${esc(fm(v, j))}</text>` +
            `<text class="sln" x="${nx.toFixed(1)}" y="${(ly + 6).toFixed(1)}" text-anchor="${an}">${esc(names[i])}</text>` + mark(a, nx + sd * (nwOf[i] + 8 + mr * gk), ly, `r${i}e${j}`, gk); };
        r.forEach((v, j) => { if (!Number.isFinite(v)) return; const [x, y] = pts[j];
          let e = `<circle class="sd" data-r="${i}" data-col="${esc(stems[j].key)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${SL.dot}"/>`;
          if (j === 0) e += endAt(0, -1);
          else { e += `<text class="slm" data-j="${j}" x="${(x + 12).toFixed(1)}" y="${(mids[j][i] ?? y - 10).toFixed(1)}">${esc(fm(v, j))}</text>`;
            if (ends0[j]) e += `<g class="sre" data-j="${j}">${endAt(j, 1)}</g>`; }
          body += `<g${at(stems[j])}>${e}</g>`; });
        out += `<g class="sl vt says" data-r="${i}" data-g="${a}" tabindex="0" style="--c:${c}">${body}</g>`; });
      // the bottom line: the groups at the left, each its glyph (or a dot) and its words, the scale's words at the right
      let gx = 0;
      groups.forEach((q, a) => { const cx = gx + .8 * mr, w = kw[a];
        out += `<g class="sk" data-g="${a}" style="--c:${q.c}">${mark(a, cx, H - 20, 'key' + a, .8)}<text class="skt" x="${(gx + 1.6 * mr + 8).toFixed(1)}" y="${H - 13}">${esc(q.label)}</text></g>`;
        gx += 1.6 * mr + 8 + w + 28; });
      out += `<text class="slk" x="${W}" y="${H - 13}" text-anchor="end">${esc(words)}</text>`;
      zt.innerHTML = `<svg class="sltab" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="group" aria-label="${esc(`${names.length} rows, one line each; ${words}`)}">${out}</svg>`;
      SF.w = W; SF.h = H;
      // pointing at a line (or Tab) lights it and opens its card; pointing at a key entry lights its group
      const hotRow = i => { if (SF.hotR === i) return; SF.hotR = i; SF.paintWl(); if (SF.onHot) SF.onHot(i == null ? null : +zt.querySelector(`g.sl[data-r="${i}"]`).dataset.g); };
      const hotKey = a => { if (SF.hotG === a) return; SF.hotG = a; SF.paintWl(); if (SF.onHot) SF.onHot(a); };
      zt.querySelectorAll('g.sl').forEach(e => { const i = +e.dataset.r, a = +e.dataset.g, q = groups[a] || { c: 'var(--mist)', label: '' }; glow(e, q.c); pauseButton();
        e._pd = () => ({ swatch: swatch('line', q.c), c: q.c, name: `${names[i]} · ${q.label}`, says: says(i, ' · '), value: null, shape: null, scope: ctx.scope });
        ['pointerenter', 'focusin'].forEach(ev => e.addEventListener(ev, () => hotRow(i))); ['pointerleave', 'focusout'].forEach(ev => e.addEventListener(ev, () => hotRow(null))); });
      zt.querySelectorAll('g.sk').forEach(e => { const a = +e.dataset.g; glow(e, groups[a].c); e.addEventListener('pointerenter', () => hotKey(a)); e.addEventListener('pointerleave', () => hotKey(null)); });
      // what a row says: only the stems filled so far, so a card never shows a value the reading has not reached
      const says = (i, sep) => V[i].map((v, j) => (SF.filled || [])[j] ? `${lab(stems[j])} ${Number.isFinite(v) ? fm(v, j) : '?'}` : null).filter(Boolean).join(sep);
      SF.aria = i => `${names[i]}, ${(groups[gOf(rows[i])] || {}).label || ''}: ${says(i, ', ')}`;
      SF.sig = null; SF.wait(); SF.paintWl(); return W;
    };
    if (slopeFig) { const SF = slopeFig;
      SF.paintWl = () => { const g = zt.querySelector('svg.sltab'); if (!g) return; const r = SF.hotR, a = r == null ? SF.wlOn ?? SF.hotG : null, rg = r == null ? null : +(g.querySelector(`g.sl[data-r="${r}"]`) || { dataset: {} }).dataset.g;
        g.classList.toggle('dim', r != null || a != null);
        g.querySelectorAll('g.sl').forEach(e => e.classList.toggle('on', r != null ? +e.dataset.r === r : +e.dataset.g === a));
        g.querySelectorAll('g.sk').forEach(e => e.classList.toggle('on', +e.dataset.g === (r != null ? rg : a))); };
      SF.wl = a => ({ c: (slopeGroups()[a] || {}).c, drawn: a < SF.keys.length });
      // the end labels sit on the rightmost stem filled so far, and move when a later stem fills; the rows' words follow
      SF.wait = () => { const g = zt.querySelector('svg.sltab'); if (!g) return;
        const filled = [...g.querySelectorAll('g.ss')].map(e => !e.matches('[data-step]:not(.shown), [data-wait]:not(.open)')), sig = filled.join();
        if (sig === SF.sig) return; SF.sig = sig; SF.filled = filled; const end = filled.lastIndexOf(true);
        g.querySelectorAll('[data-j]').forEach(e => e.classList.toggle('isend', +e.dataset.j === end));
        if (SF.aria) g.querySelectorAll('g.sl').forEach(e => e.setAttribute('aria-label', SF.aria(+e.dataset.r))); };
      SF.wlLight = a => { if (SF.wlOn !== a) { SF.wlOn = a; SF.paintWl(); } }; }
    const drawTable = () => {
      if (!zt) return;
      // a slope table takes the room its stems and labels need, at least the table's 30%; with under 520 px left, it goes on top
      if (SLOPE) { zt.classList.add('slope'); slopeDraw(0); if (!pair) return;
        pair.classList.add('stacked', 'measure'); const W = pair.clientWidth, w = Math.max(zt.offsetWidth, sideOf(W)), cs = getComputedStyle(zt);
        const pad = ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce((q, p) => q + parseFloat(cs[p]), 0);
        pair.classList.remove('measure'); pair.style.setProperty('--tcw', w + 'px'); const up = W - w - GAP < FIG; pair.classList.toggle('stacked', up);
        slopeDraw(up ? Math.min(W - pad, Math.max(slopeFig.minW, 640)) : w - pad); return; }
      const rows = rowsOf(), colHead = q => ((ctx.symbols || {})[q] || {}).color === 'ink' ? null : symColor(q);
      const cell = (c, r) => { let v = r[c.key]; if (c.expr) v = L.try(c.expr, L.scope(ctx.scope, r), `slide ${ctx.index + 1} column ${c.key}`); return typeof v === 'number' ? L.fmt(v, c.fmt) : md(v); };
      const stp = c => (c.at ? ` data-step="${c.at}"` : '') + (waits.has(c.at) ? ` data-wait="${c.at}"` : ''), wt = c => waits.has(c.at) ? ` data-wait="${c.at}"` : '';
      zt.innerHTML = `<table class="t"><thead><tr>${tcols.map(c => `<th class="${c.expr ? 'der' : ''}${colHead(c.key) ? ' tsy' : ''}"${colHead(c.key) ? ` style="--sc:${colHead(c.key)}"` : ''} data-col="${L.esc(c.key)}"${wt(c)}><span class="cv">${md(c.label || c.key)}</span></th>`).join('')}</tr></thead>
        <tbody>${rows.map((r, i) => `<tr data-r="${i}">${tcols.map(c => `<td class="${c.expr ? 'der' : ''}" data-r="${i}" data-col="${L.esc(c.key)}"${stp(c)}><span class="cv">${cell(c, r)}</span></td>`).join('')}</tr>`).join('')}</tbody></table>`;
      // the table fills its 30%; one too wide for that takes what it needs, and if that leaves the work too little it goes above it
      if (pair) { pair.classList.add('stacked', 'measure'); const W = pair.clientWidth, w = Math.max(zt.offsetWidth, sideOf(W)); pair.classList.remove('measure'); pair.style.setProperty('--tcw', w + 'px'); pair.classList.toggle('stacked', W - w - GAP < FIG); }   // measured at full size: the strip's smaller type is not the size beside
    };

    // highlights, on the things themselves: the row a worked line reads (its cells in the line's colours), and any
    // `mark:` (row:i, col:key, cell:i:key, #id). They follow the reading, a hovered line, or a figure's Next.
    const marksAt = k => { const out = []; steps.forEach((st, j) => { if (st && (map[j].at === k || map[j].q === k)) list(st.mark).forEach(m => out.push(String(m))); }); return out; };
    const targetOf = t => {
      let m;
      // a slope table's row is its line (g.sl), its column its stem (g.ss), its cell the row's dot on that stem (.sd). A recorder's
      // reading is a row too when the scene has no table, or the table reads the recorder's own `from`; else row:N is the table's
      // A colour wheel's record likewise; a pileup's row is a guide (g.pur), its column one sample's stacks and its cell one stack (g.pus), on the same terms
      const own = k => s.table ? `.bi.${k}[data-from="${CSS.escape(String(s.table.from))}"]` : `.bi.${k}`, rec = own('recorder'), pu = own('pileup');
      if ((m = /^row:(\d+)$/.exec(t))) return { els: [...(zt ? zt.querySelectorAll(`tbody tr[data-r="${m[1]}"], g.sl[data-r="${m[1]}"]`) : []), ...node.querySelectorAll(`${rec} g.rcr[data-r="${m[1]}"], ${own('wheel')} g.wr[data-r="${m[1]}"], ${pu} g.pur[data-r="${m[1]}"]`)], cls: 'wrow' };
      if ((m = /^col:(.+)$/.exec(t))) return { els: [...(zt ? zt.querySelectorAll(`[data-col="${CSS.escape(m[1])}"]:not(.sd)`) : []), ...node.querySelectorAll(`${pu} g.pus[data-col="${CSS.escape(m[1])}"]`)], cls: 'hcol' };
      if ((m = /^cell:(\d+):(.+)$/.exec(t))) return { els: [...(zt ? zt.querySelectorAll(`:is(td, .sd)[data-r="${m[1]}"][data-col="${CSS.escape(m[2])}"]`) : []), ...node.querySelectorAll(`${pu} g.pus[data-r="${m[1]}"][data-col="${CSS.escape(m[2])}"]`)], cls: 'src' };
      if ((m = /^#(.+)$/.exec(t))) return { els: [...node.querySelectorAll(`[data-id="${CSS.escape(m[1])}"]`)], cls: 'hl' };
      return { els: [], cls: '' };
    };
    let missing = [], lit = 0, read = 0, over = null;
    const light = k => { lit = k;
      node.querySelectorAll('.wrow, .hcol, .src, .hl').forEach(e => { e.classList.remove('wrow', 'hcol', 'src', 'hl'); e.style.removeProperty('--tc'); });
      missing = [];
      lines.forEach(ln => { if (!ln.c || ln.at !== k || ln.c.row == null || !zt) return;
        zt.querySelector(`tbody tr[data-r="${ln.c.row}"], g.sl[data-r="${ln.c.row}"]`)?.classList.add('wrow');
        // a grid cell takes the term's colour; a slope dot lights in its line's colour
        ln.reads.forEach(q => { const td = zt.querySelector(`:is(td, .sd)[data-r="${ln.c.row}"][data-col="${CSS.escape(q)}"]`), c = symColor(q);
          if (td && td.matches('.sd')) td.classList.add('src'); else if (td && c) { td.classList.add('src'); td.style.setProperty('--tc', c); } }); });
      marksAt(k).forEach(t => { const { els, cls } = targetOf(t); if (!els.length) { missing.push(t); return; }
        els.forEach(e => { e.classList.add(cls); if (cls === 'src' && !e.matches('.sd')) e.style.setProperty('--tc', 'var(--accent)'); }); });
    };
    const fill = k => { if (zt) shown(zt, k); if (slopeFig) slopeFig.wait(); };
    const mark = k => { stepEls.forEach(e => e.classList.toggle('now', +e.dataset.at === k || +e.dataset.q === k)); root.querySelectorAll('.rl').forEach(e => e.classList.toggle('now', +e.dataset.at === k)); };   // a callout left outside its step lights with it

    // a strip: the drawing takes what the side column leaves (the side is 46% of the page, at least 300 px), no taller than the
    // window less the pin; its space takes the side column's width. Too narrow for both: the drawing stands above, full width
    const stripPlace = b => { const W = b.node.parentElement.clientWidth, sw0 = Math.max(SIDE, Math.round(W * .46)), beside = W - sw0 - GAP >= 360;
      b.node.classList.toggle('beside', beside); b.node.classList.add('stripb'); b.node.classList.remove('many');
      const w = sized(b.strip, { w: beside ? W - sw0 - GAP : W, col: W, h: beside ? pinH() : Math.min(figH(), W) });
      b.fig.style.width = w + 'px'; b.node.style.setProperty('--fig', w + 'px');
      const sw = beside ? W - w - GAP : W; (b.sfigs || []).forEach(fg => sized(fg, { w: sw, col: sw, h: Math.round((sw - PAD) * .75) + PAD + 60 })); };
    // a figure's rows take its width
    const sized = (fg, room) => { const w = fg.size(room); fg.wrap.style.width = w + 'px'; return w; };
    // the figures: how each sizes itself. Two figures on one step stand in a row above their lines
    // A wide figure's column is 1100 px, or a matrix panel's page; a figure wider than that widens it for the whole scene. Text takes the page
    const place = () => { const page = root.clientWidth, read0 = broad ? page : Math.min(READ, page); let read = read0; root.style.setProperty('--read', read0 + 'px'); root.style.setProperty('--col', page + 'px');
      blocks.forEach(b => { if (b.wide) return;
      if (b.strip) { stripPlace(b); return; }
      const W = b.node.parentElement.clientWidth, side = sideOf(W), many = b.figs.length > 1, inPair = b.node.closest('.bpair:not(.stacked)');
      const beside = !b.over && !inPair && !many && b.side.children.length > 0 && W - side - GAP >= FIG;
      b.node.classList.toggle('beside', beside); b.node.classList.toggle('many', many);
      const own = many ? (W - GAP * (b.figs.length - 1)) / b.figs.length : beside ? W - side - GAP : inPair ? W : Math.min(W, UNDER);
      // beside, it may grow to its text's height with every answer open (taller would not pin; open, so an answer never resizes it),
      // up to the window less the pin's 24 px at top and foot
      const full = () => { node.classList.add('allopen'); const hh = b.side.offsetHeight; node.classList.remove('allopen'); return hh; };
      const tall = beside ? () => Math.min(pinH(), Math.max(figH(), full())) : figH;
      const room = { w: own, col: beside || many || inPair ? own : read0, h: tall() };
      const size = () => { const w = Math.max(...b.figs.map(fg => sized(fg, room))); b.fig.style.width = many ? '' : w + 'px'; b.node.style.setProperty('--fig', w + 'px'); if (!beside && !many && !inPair) read = Math.max(read, w); };
      // what the figure must share the window with: the line above it, and its slider and button rows, if it has any
      const shared = () => { const say = beside ? null : b.side.querySelector(':scope > .st.intro > .say'); let foot = 0;
        b.figs.forEach(fg => { if (fg.stage) fg.stage.fit(); foot = Math.max(foot, fg.wrap.offsetHeight - fg.node.offsetHeight); });
        return (say ? say.offsetHeight + 12 : 0) + foot; };
      size(); for (let pass = 0; pass < 3; pass++) { read = read0; room.h = tall() - shared(); size(); } });
      root.style.setProperty('--read', read + 'px');
      blocks.forEach(b => { if (b.wide) b.figs.forEach(fg => sized(fg, { w: read, col: read, h: figH() })); });
      node.querySelectorAll('.bcmp .chart').forEach(c => { c.style.height = Math.round(c.clientWidth / SHAPE) + 'px'; }); };
    // a worked line too long to sit beside the table, even at the floor, sends the table above the work
    const widen = () => { if (!pair || pair.classList.contains('stacked')) return; const edge = pair.getBoundingClientRect().right;
      if ([...pair.querySelectorAll('.katex')].some(e => e.getBoundingClientRect().right > edge + 1)) { pair.classList.add('stacked'); place(); drawLines(); } };
    // anything sticky taller than the window would hide its own foot
    // a formula that runs past the text column at the floor sends that one figure above its text
    const overrun = () => { let moved = false; blocks.forEach(b => { if (b.wide || !b.node.classList.contains('beside')) return; const edge = b.side.getBoundingClientRect().right;
      if ([...b.side.querySelectorAll('.katex')].some(e => e.getBoundingClientRect().right > edge + 1)) b.over = moved = true; });
      if (moved) { place(); drawLines(); } };
    // a table stacked above its work pins as a strip at the top: only while it takes at most half the window
    const stick = () => { node.querySelectorAll('.tcol, .ffig').forEach(e => e.classList.toggle('nostick', e.offsetHeight > (e.closest('.bpair.stacked') && e.classList.contains('tcol') ? innerHeight * .5 : innerHeight - 48)));
      if (pair && zl) (pair._follow = pair._follow || pinFollow(pair, zl))(); };

    const R = {
      node, steps: n, stages,
      stick: () => { held.forEach((_, f) => { f.style.top = ''; }); held.clear(); stick(); stages.forEach(S => S.quiet()); },
      watch: () => { letGo(); stages.forEach(S => S.quiet()); },
      // a layout may move lines between columns, which drops the focus: the focused word or entry gets it back
      layout: () => { const fa = node.contains(document.activeElement) ? document.activeElement : null; blocks.forEach(b => { b.over = false; }); drawTable(); place(); drawLines(); widen(); overrun(); drawAsm(); drawParams(); drawCtl(); if (figs.map(fg => fg.layout && fg.layout()).some(Boolean)) { place(); figs.forEach(fg => fg.layout && fg.layout()); } vis.forEach(V => V.layout()); figs.forEach(fg => fg.O && fg.O.layout()); stick(); if (fa && fa.isConnected && document.activeElement !== fa) fa.focus({ preventScroll: true }); wsync(); },
      // what the page shows now, after a redraw or a move
      repaint: () => { fill(read); thinks.forEach(e => setThink(e, e.classList.contains('open'))); figs.forEach(fg => { if (!fg.stage) fg.paint(1e9); }); vis.forEach(V => { if (!figs.some(fg => fg.V === V)) V.show(1e9); }); stages.forEach(S => S.show()); light(lit); mark(lit); wsync(); },
      // everything up to click k, as the check and the printer see it
      show: k => { read = lit = k; thinks.forEach(e => setThink(e, +e.dataset.at <= k)); stages.forEach(S => S.to(S.stopOf(k))); R.repaint(); },
      reset: () => { stages.forEach(S => S.to(0)); thinks.forEach(e => setThink(e, false)); read = lit = 0; R.repaint(); },
      figs,   // for the checks: a space figure's probe() and view()
      // the reading line, in window pixels: every step whose top has passed it counts as read
      // A stacked table pinned as a strip at the top moves the line to just under it, so the step being read is never behind it
      spy: y => { const b = node.getBoundingClientRect(); let k = 0;
        if (y !== Infinity && pair && zl && pair.classList.contains('stacked') && !zl.classList.contains('nostick')) { const tb = zl.getBoundingClientRect(); if (tb.top <= 1) y = Math.max(y, tb.bottom + 24); }
        if (y === Infinity || b.bottom < y) k = n; else if (b.top <= y) stepEls.forEach(e => { if (e.getBoundingClientRect().top <= y) k = Math.max(k, +e.dataset.at); });
        if (k === read) return; read = k; fill(k); if (over == null) { light(k); mark(k); } wsync(); },
      hover: k => { over = k; const c = k ?? read; fill(Math.max(read, c)); light(c); mark(c); },
      audit: () => {
        const out = [];
        missing.forEach(t => out.push(`mark target not found: ${t}`));
        figs.forEach(fg => { out.push(...(fg.issues || []), ...(fg.later || []).filter(e => e.st <= read).map(e => e.msg));
          if (['plane', 'space', 'chart', 'image', 'units', 'chance'].includes(fg.kind) && (fg.w < 340 || fg.h < 220)) out.push(`a ${fg.kind} is only ${fg.w} × ${fg.h} px: give it more room, or split the scene`); });
        node.querySelectorAll('.board .vis .chart').forEach(c => { const r = c.getBoundingClientRect(), q = r.width / (r.height || 1); if (q < 1 || q > 2.2) out.push(`a chart is ${Math.round(r.width)} × ${Math.round(r.height)} px: its shape must stay between 1:1 and 2.2:1, so set its \`ratio\``); });
        root.querySelectorAll('.cline .math, .fline .math, .asm .math').forEach(m => { if (parseFloat(getComputedStyle(m).fontSize) < FLOOR) out.push(`a formula renders under ${FLOOR}px`); });
        node.querySelectorAll('table.t td').forEach(c => { if (parseFloat(getComputedStyle(c).fontSize) < 18) out.push('a table cell renders under 18px'); });
        vis.forEach(V => out.push(...V.audit())); figs.forEach(fg => fg.O && out.push(...fg.O.audit()));
        root.querySelectorAll('.approx').length && out.push('a worked line does not add up by hand at the rounding shown (it reads ≈): give its inputs a finer fmt');
        root.querySelectorAll('.fline .math, .asm .math, .cline .part').forEach(m => { const kx = m.querySelector('.katex'), box = m.closest('.st, .asm'); if (kx && box && kx.getBoundingClientRect().right > box.getBoundingClientRect().right + 2) out.push(`a formula is wider than its box at ${FLOOR}px: shorten it or split the line`); });
        out.push(...clash, ...pclash, ...ctlBad);
        return out;
      },
    };

    // which figures change, and how: a figure's stops are the clicks where something new comes in
    figs.forEach(fg => { const own = fg.stops.filter(c => c > fg.at), runs = run && run.fg === fg ? frameStops : [];
      fg.stage = makeStage(fg.wrap, [fg.at, ...own, ...runs], fg.paint, fg.zone, !!runs.length); });
    if (run && !run.fg) makeStage(flowBox, frameStops, () => {}, null, true);
    // a run starts on its first stop's frame
    if (run && stages.some(S => S.frames)) { const f = frameAt(stages.find(S => S.frames).stops[0]); if (f != null && f !== ctx.scope[run.c.name]) { run.set(f); L.derive(ctx.scope, s.derive, `slide ${ctx.index + 1}`); } }
    return R;
  };
})();
