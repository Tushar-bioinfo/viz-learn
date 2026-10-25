/* viz-os ops: a small matrix and what one operation does to it, one step at a time.
   rows: each row → one number (a new column on the right); cols: each column → one number (a new row underneath);
   map: one rule for every cell, which may borrow a row's or a column's number; dot: one weight per column, summed per row;
   sort: rank the rows by a number; vec: arithmetic on the new columns. The grid keeps its place on every step (what a
   later step makes is reserved from the start). One row (or column) is worked in the card, which says the shape change,
   the rule, the numbers and why. Colours: tint = what the step reads, orange = what it makes, teal = a number it borrows. */
(function () {
  'use strict';
  const L = window.VizOS, h = L.h, md = s => L.md(s);
  const NS = 'http://www.w3.org/2000/svg';
  const sv = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const KIND = { rows: 'Row-wise', cols: 'Column-wise', map: 'Every cell', dot: 'Dot product', sort: 'Rank', vec: 'New from new' };
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  // variance divides by n − 1 (at least 1); center: median measures the spread around the median, as MAGeCK does,
  // and center: <a column made earlier> uses that column's number for each row (shown as borrowed)
  const AGG = {
    sum: a => a.reduce((s, x) => s + x, 0), mean, median, min: a => Math.min(...a), max: a => Math.max(...a),
    geomean: a => Math.exp(mean(a.map(Math.log))),
    var: (a, c) => { const m = typeof c === 'number' ? c : c === 'median' ? median(a) : mean(a); return a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(a.length - 1, 1); },
    sd: (a, c) => Math.sqrt(AGG.var(a, c)),
  };
  const tt = s => `\\text{${String(s).replace(/[\\^~]/g, '').replace(/[{}_#$%&]/g, '\\$&')}}`;
  const sub = (t, s) => /[_^']/.test(t) ? `{${t}}_{${s}}` : `${t}_{${s}}`;
  const ij = (a, b) => a.length > 1 || b.length > 1 ? `${a},${b}` : a + b;
  const plural = w => /s$/.test(w) ? w : w + 's';
  const runs = ks => { const out = []; [...ks].sort((a, b) => a - b).forEach(k => { const r = out[out.length - 1]; if (r && k === r[1] + 1) r[1] = k; else out.push([k, k]); }); return out; };

  L.types.ops = (s, ctx) => {
    const node = h('section', 'slide s-ops'); node.appendChild(L.head(s));
    const body = h('div', 'body'); node.appendChild(body);
    const wrap = h('div', 'opsw g plate enter'), card = h('div', 'opcard g plate enter'); body.append(wrap, card);
    const where = `slide ${ctx.index + 1}`, mx = s.matrix || {}, ops = s.steps || [], T = ops.length;
    const arr = (x, w) => Array.isArray(x) ? x : x == null ? null : L.val(x, ctx.scope, `${where} ${w}`);

    // ---------- the given matrix: a list of rows of numbers, or of records with the listed columns ----------
    let raw = arr(mx.values ?? mx.from, 'matrix'), colKeys = arr(mx.cols, 'matrix.cols'), recLab = null;
    if (!Array.isArray(raw) || !raw.length) { L.err(where, 'ops needs matrix.values or matrix.from: a list of rows'); raw = [[0]]; }
    if (!Array.isArray(raw[0])) {
      const keys = colKeys || Object.keys(raw[0]).filter(k => typeof raw[0][k] === 'number');
      const rk = mx.rowKey || Object.keys(raw[0]).find(k => typeof raw[0][k] === 'string');
      if (rk) recLab = raw.map(r => r[rk]);
      raw = raw.map(r => keys.map(k => r[k])); colKeys = keys;
    }
    raw = raw.map(r => r.map(Number));
    const n = raw.length, m = raw[0].length;
    if (raw.some(r => r.length !== m)) L.err(where, 'the matrix rows have different lengths');
    const rowLab = (arr(mx.rows, 'matrix.rows') || recLab || raw.map((_, i) => `${i + 1}`)).map(String);
    const colLab = (colKeys || raw[0].map((_, j) => `${j + 1}`)).map(String);
    if (rowLab.length !== n) L.err(where, `matrix.rows has ${rowLab.length} labels for ${n} rows`);
    if (colLab.length !== m) L.err(where, `matrix.cols has ${colLab.length} labels for ${m} columns`);
    const at = (f, labs) => f == null ? 0 : typeof f === 'number' ? Math.max(0, Math.min(labs.length - 1, f)) : Math.max(0, labs.indexOf(String(f)));
    const fr = at(mx.focus, rowLab), fc = at(mx.focusCol, colLab);   // the row and the column worked in the card
    const rowN = mx.row || 'row', colN = mx.col || 'column';

    // ---------- every state up front: the matrix after step t, the vectors made so far, the row order ----------
    const mats = {}, vecs = [], byName = {};
    const S0 = { t: 0, M: raw, tex: mx.tex || 'x', name: mx.name || '', fmt: mx.fmt, order: raw.map((_, i) => i) };
    if (mx.key) mats[mx.key] = S0;
    const states = [S0];
    // inside a per-cell rule: x is this cell, a matrix's name its cell, a new column its row's number, a new row its column's
    const cellScope = (st, i, j) => { const sc = L.scope(ctx.scope, { x: st.M[i][j] }); for (const k in mats) sc[k] = mats[k].M[i][j]; vecs.forEach(v => sc[v.name] = v.values[v.kind === 'row' ? i : j]); return sc; };
    const symIn = (st, a, b) => nm => nm === 'x' ? `\\htmlClass{inp}{${sub(st.tex, ij(a, b))}}` : mats[nm] ? `\\htmlClass{inp}{${sub(mats[nm].tex, ij(a, b))}}`
      : byName[nm] ? `\\htmlClass{use}{${sub(byName[nm].tex, byName[nm].kind === 'row' ? a : b)}}` : ((ctx.symbols || {})[nm] || {}).tex || L.autoSym(nm);
    const valIn = (st, i, j) => nm => { const v = cellScope(st, i, j)[nm]; return typeof v === 'number' ? v : null; };
    const fmtIn = st => nm => nm === 'x' ? st.fmt : mats[nm] ? mats[nm].fmt : byName[nm] ? byName[nm].fmt : undefined;
    const wrapIn = (nm, t) => byName[nm] ? `\\htmlClass{use}{${t}}` : nm === 'x' || mats[nm] ? `\\htmlClass{inp}{${t}}` : t;
    let cur = S0;
    ops.forEach((op, k) => {
      const t = k + 1, w = `${where} step ${t}`, kind = op.op || 'rows';
      if (!KIND[kind]) L.err(w, `op "${kind}" is not one of ${Object.keys(KIND).join(', ')}`);
      const st = { ...cur, t, op, kind, prev: cur, uses: [], res: null, w: null, inc: null, tr: null, by: null };
      const cell = (i, j) => op.expr ? L.try(op.expr, cellScope(cur, i, j), w) : cur.M[i][j];
      const usesOf = e => e ? L.names(e).filter(nm => byName[nm]).map(nm => byName[nm]) : [];
      const make = (kd, values, dflt) => { const nm = op.name || dflt, v = { name: nm, kind: kd, values, tex: op.tex || L.autoSym(nm), label: op.label || nm, fmt: op.fmt, t }; vecs.push(v); byName[nm] = v; st.res = v; return v; };
      if (kind === 'rows' || kind === 'cols') {
        const byRow = kind === 'rows', other = byRow ? colLab : rowLab;
        const inc = op.over == null ? other.map((_, q) => q) : [].concat(op.over).map(o => typeof o === 'number' ? o : other.indexOf(String(o)));
        if (inc.some(q => q < 0 || q >= other.length)) L.err(w, `over: names a ${byRow ? colN : rowN} that is not in the matrix`);
        st.inc = inc.filter(q => q >= 0 && q < other.length); st.uses = usesOf(op.expr);
        st.tr = (byRow ? rowLab : colLab).map((_, a) => st.inc.map(b => byRow ? cell(a, b) : cell(b, a)));
        const fn = op.fn || 'sum', cv = byName[op.center];
        if (cv) { if (cv.kind !== (byRow ? 'row' : 'col')) L.err(w, `center: ${op.center} needs one number per ${byRow ? rowN : colN}`); else { st.cv = cv; st.uses.push(cv); } }
        const one = AGG[fn] ? (a, q) => AGG[fn](a, st.cv ? st.cv.values[q] : op.center) : a => L.try(fn, L.scope(ctx.scope, { x: a }), w);
        make(byRow ? 'row' : 'col', st.tr.map(one), byRow ? 'r' : 'c');
      } else if (kind === 'map') {
        st.uses = usesOf(op.expr);
        st.M = cur.M.map((r, i) => r.map((_, j) => L.try(op.expr || 'x', cellScope(cur, i, j), w)));
        st.tex = op.tex || (op.name ? L.autoSym(op.name) : `${cur.tex}'`); st.name = op.label || cur.name; st.fmt = op.fmt ?? cur.fmt;
        if (op.name) mats[op.name] = st;
        if (op.store) L.global[op.store] = st.M.map(r => [...r]);
      } else if (kind === 'dot') {
        const wv = Array.isArray(op.with) ? op.with : byName[op.with] ? byName[op.with].values : arr(op.with, 'with');
        const ok = Array.isArray(wv) && wv.length === m; if (!ok) L.err(w, `with: needs ${m} weights, one per ${colN}`);
        st.w = { values: ok ? wv.map(Number) : Array(m).fill(0), tex: op.wtex || (typeof op.with === 'string' ? L.autoSym(op.with) : 'w'), label: op.withLabel || (typeof op.with === 'string' ? op.with : 'weights'), t };
        make('row', cur.M.map(r => r.reduce((a, x, j) => a + x * st.w.values[j], 0)), 'd');
      } else if (kind === 'sort') {
        const by = byName[op.by] ? byName[op.by].values : arr(op.by, 'by'), ok = Array.isArray(by) && by.length === n;
        if (!ok) L.err(w, `by: needs ${n} numbers, one per ${rowN}`);
        const b = ok ? by : rowLab.map((_, i) => i), sg = op.desc ? -1 : 1, ord = b.map((_, i) => i).sort((p, q) => sg * (b[p] - b[q]) || p - q), rank = Array(n);
        for (let p = 0; p < n;) { let q = p; while (q + 1 < n && b[ord[q + 1]] === b[ord[p]]) q++; for (let r = p; r <= q; r++) rank[ord[r]] = (p + q) / 2 + 1; p = q + 1; }   // ties share the middle rank
        st.order = ord; st.by = byName[op.by] || { tex: L.autoSym(String(op.by)), values: b };
        make('row', rank, 'rank'); if (!op.tex) st.res.tex = '\\operatorname{rank}';
      } else if (kind === 'vec') {
        const used = usesOf(op.expr), kinds = [...new Set(used.map(v => v.kind))];
        if (kinds.length > 1) L.err(w, 'vec: the rule must use new columns only, or new rows only');
        const kd = kinds[0] || 'row'; st.uses = used;
        make(kd, (kd === 'row' ? rowLab : colLab).map((_, a) => { const sc = L.scope(ctx.scope, {}); used.forEach(v => sc[v.name] = v.values[a]); return L.try(op.expr, sc, w); }), 'v');
      }
      states.push(st); cur = st;
    });
    // what the steps made is there for later slides, under its name
    vecs.forEach(v => { if (ops[v.t - 1].store !== false) L.global[v.name] = v.values; });

    // ---------- the grid ----------
    const hd = h('div', 'mxhead'), box = h('div', 'mxbox'); wrap.append(hd, box);
    hd.innerHTML = `<span class="shape"></span><span class="mname"></span>` + (mx.row || mx.col ? `<span class="mkey">row <b>i</b> = a ${L.esc(rowN)} · column <b>j</b> = a ${L.esc(colN)}</span>` : '');
    const svg = sv('svg', { 'aria-hidden': 'true' }, box);
    const add = (cls, html) => { const e = h('div', cls, html); box.appendChild(e); return e; };
    const corner = add('mh corner', L.esc(mx.corner || rowN));
    const mh = colLab.map(c => add('mh', L.esc(c)));
    const mr = rowLab.map(r => add('mr', L.esc(r)));
    const mc = raw.map(r => r.map(() => add('mc')));
    const right = vecs.filter(v => v.kind === 'row').map(v => ({ v, head: add('vh', L.esc(v.label)), cells: v.values.map(() => add('vc')) }));
    const below = vecs.filter(v => v.kind === 'col').map(v => ({ v, head: add('mr vlab', L.esc(v.label)), cells: v.values.map(() => add('vc')) }));
    const tops = states.filter(st => st.kind === 'dot').map(st => ({ v: st.w, head: add('mr vlab', L.esc(st.w.label)), cells: st.w.values.map(() => add('vc top')) }));
    const strip = v => right.find(r => r.v === v) || below.find(b => b.v === v);

    let G = null, cardMin = 99;
    const layout = () => {
      // the head shows each step's matrix name in turn: it keeps the tallest, so the grid never loses room between steps
      const nm = hd.querySelector('.mname'), now = nm.innerHTML; hd.querySelector('.shape').textContent = `${n} × ${m}`; hd.style.minHeight = '';
      const hmax = Math.max(...[...new Set(states.map(st => st.name || ''))].map(t => { nm.innerHTML = md(t); return hd.offsetHeight; }));
      nm.innerHTML = now; hd.style.minHeight = hmax + 'px';
      const W = box.clientWidth, H = box.clientHeight; if (!W || !H) return;
      const ui = (t, f) => L.measure(String(t).replace(/\d/g, '0'), f, 500) * 1.02, mono = (t, f) => L.measure(t, f, 600, L.fontMono);
      const colTexts = colLab.map((_, j) => [...new Set(states.flatMap(st => st.M.map(r => L.fmt(r[j], st.fmt))))]
        .concat(tops.map(tp => L.fmt(tp.v.values[j], tp.v.fmt)), below.map(b => L.fmt(b.v.values[j], b.v.fmt))));
      const port = document.body.classList.contains('port');
      const geom = (f, wrap) => {
        const lo = port ? Math.min(20, f) : 0, hf = Math.max(Math.round(f * .73), lo), rf = Math.max(Math.round(f * .84), lo), pad = Math.round(f * (port ? .55 : .95)), rh = Math.round(f * (port ? 1.55 : 1.75));
        const col = (texts, label) => { const nw = Math.max(0, ...texts.map(x => ui(x, f))) + pad, lw = mono(label, hf) + 14;
          if (!wrap || lw <= nw) return { w: Math.ceil(Math.max(nw, lw)), lines: 1 };
          const word = Math.max(...label.split(/\s+/).map(x => mono(x, hf))) + 14, w = Math.ceil(Math.max(nw, word, lw / 2 + 14));
          return { w, lines: lw > w ? 2 : 1 }; };
        const C1 = colLab.map((c, j) => col(colTexts[j], c)), C2 = right.map(r => col(r.v.values.map(x => L.fmt(x, r.v.fmt)), r.v.label));
        const hh = Math.round(hf * 1.15 * Math.max(1, ...C1.concat(C2).map(c => c.lines)) + 13), cw = C1.map(c => c.w), vw = C2.map(c => c.w);
        const rl = Math.ceil(Math.max(...rowLab.map(x => ui(x, rf)), ...below.concat(tops).map(b => mono(b.v.label, hf) + 14), mono(mx.corner || rowN, hf)) + f * .6);
        const gx = right.length ? Math.round(f * (port ? 1 : 1.9)) : 0, gv = Math.round(f * .4), gy = below.length ? Math.round(f * 1.3) : 0, th = tops.length ? tops.length * rh + Math.round(f * .45) : 0;
        const sum = a => a.reduce((x, y) => x + y, 0);
        return { f, hf, rf, rh, hh, cw, vw, rl, gx, gv, gy, th, w: rl + sum(cw) + (right.length ? gx + sum(vw) + gv * (right.length - 1) : 0), h: th + hh + n * rh + (below.length ? gy + below.length * rh : 0) };
      };
      const fits = g => g.w <= W && g.h <= H;
      let g; for (let f = port ? 24 : 26; ; f--) { g = geom(f, false); if (fits(g)) break; g = geom(f, true); if (fits(g) || f <= 14) break; }
      g.over = !fits(g);
      g.ox = Math.max(0, Math.round((W - g.w) / 2)); g.oy = Math.max(0, Math.round((H - g.h) / 2));   // centred in its card
      g.x = []; let x = g.ox + g.rl; g.cw.forEach((c, j) => { g.x[j] = x; x += c; }); g.xe = x;
      g.vx = []; x = g.xe + g.gx; g.vw.forEach((c, k) => { g.vx[k] = x; x += c + g.gv; });
      g.yh = g.oy + g.th; g.y0 = g.yh + g.hh; g.ye = g.y0 + n * g.rh;
      g.by = below.map((_, q) => g.ye + g.gy + q * g.rh); g.ty = tops.map((_, q) => g.oy + q * g.rh);
      G = g;
      box.style.setProperty('--mf', g.f + 'px'); box.style.setProperty('--mhf', g.hf + 'px'); box.style.setProperty('--mrf', g.rf + 'px');
      const put = (e, l, t, w, ht) => { e.style.left = l + 'px'; if (t != null) e.style.top = t + 'px'; e.style.width = w + 'px'; e.style.height = ht + 'px'; };
      put(corner, g.ox, g.yh, g.rl, g.hh);
      mh.forEach((e, j) => put(e, g.x[j], g.yh, g.cw[j], g.hh));
      right.forEach((r, k) => { put(r.head, g.vx[k], g.yh, g.vw[k], g.hh); r.cells.forEach(e => put(e, g.vx[k], null, g.vw[k], g.rh - 4)); });
      below.forEach((b, q) => { put(b.head, g.ox, g.by[q], g.rl, g.rh); b.cells.forEach((e, j) => put(e, g.x[j] + 3, g.by[q] + 2, g.cw[j] - 6, g.rh - 4)); });
      tops.forEach((tp, q) => { put(tp.head, g.ox, g.ty[q], g.rl, g.rh); tp.cells.forEach((e, j) => put(e, g.x[j] + 3, g.ty[q] + 2, g.cw[j] - 6, g.rh - 4)); });
      mr.forEach(e => put(e, g.ox, null, g.rl, g.rh));
      mc.forEach(r => r.forEach((e, j) => put(e, g.x[j], null, g.cw[j], g.rh)));
      // a line of working stays on one line: shrink it to fit the card rather than wrap; a line that would need text
      // under 18px switches to its short form (a long list cut to its ends, and the middle for a median) first
      cardMin = 99;
      card.querySelectorAll('.of, .ow > span').forEach(e => { const ok = e.closest('.ok'); let fs = 0;
        const fit = () => { e.style.fontSize = ''; fs = parseFloat(getComputedStyle(e).fontSize); let guard = 0;
          while (e.scrollWidth > ok.clientWidth + 1 && fs > 16 && guard++ < 30) { fs -= 1; e.style.fontSize = fs + 'px'; } };
        if (e.dataset.full) L.renderTex(e, e.dataset.full, false);
        fit(); if (fs < 18 && e.dataset.short) { L.renderTex(e, e.dataset.short, false); fit(); }
        cardMin = Math.min(cardMin, fs); });
    };

    // rows sit in the order of the latest sort; everything on a row moves with it
    const place = st => {
      if (!G) return;
      st.order.forEach((i, p) => { const y = G.y0 + p * G.rh;
        mr[i].style.top = y + 'px'; mc[i].forEach(e => { e.style.top = y + 'px'; e.classList.toggle('r0', p === 0); });
        right.forEach(r => r.cells[i].style.top = (y + 2) + 'px'); });
    };
    // outlines round what is read, short arrows in the gaps for where a number goes or comes from (no text in the drawing)
    const overlay = st => {
      svg.innerHTML = ''; const g = G; if (!g || !st.t) return;
      const C = L.colors, ypos = i => g.y0 + st.order.indexOf(i) * g.rh;
      const frame = (x, y, w, ht, col) => sv('rect', { x: x + 1.5, y: y + 1.5, width: w - 3, height: ht - 3, fill: 'none', stroke: col, 'stroke-width': 3 }, svg);
      const arrow = (x1, y1, x2, y2, col) => { const a = Math.atan2(y2 - y1, x2 - x1), s = 11;
        sv('line', { x1, y1, x2: x2 - Math.cos(a) * s * .7, y2: y2 - Math.sin(a) * s * .7, stroke: col, 'stroke-width': 3 }, svg);
        sv('polygon', { points: [[x2, y2], [x2 - s * Math.cos(a - .5), y2 - s * Math.sin(a - .5)], [x2 - s * Math.cos(a + .5), y2 - s * Math.sin(a + .5)]].map(p => p.join(',')).join(' '), fill: col }, svg); };
      const rowMid = ypos(fr) + g.rh / 2, colMid = g.x[fc] + g.cw[fc] / 2;
      if (st.kind === 'rows' || st.kind === 'dot') {
        (st.kind === 'dot' ? [[0, m - 1]] : runs(st.inc)).forEach(([a, b]) => frame(g.x[a], ypos(fr), g.x[b] + g.cw[b] - g.x[a], g.rh, C.tint));
        if (right.length) arrow(g.xe + 6, rowMid, g.vx[0] - 6, rowMid, C.accent);
        if (st.kind === 'dot') { const q = tops.findIndex(tp => tp.v === st.w); frame(g.x[0], g.ty[q], g.xe - g.x[0], g.rh, C.s2); }
      } else if (st.kind === 'cols') {
        runs(st.inc.map(i => st.order.indexOf(i))).forEach(([a, b]) => frame(g.x[fc], g.y0 + a * g.rh, g.cw[fc], (b - a + 1) * g.rh, C.tint));
        if (below.length) arrow(colMid, g.ye + 5, colMid, g.by[0] - 5, C.accent);
      } else if (st.kind === 'map') {
        if (right.length && st.uses.some(v => v.kind === 'row')) arrow(g.vx[0] - 6, rowMid, g.xe + 6, rowMid, C.s2);
        if (below.length && st.uses.some(v => v.kind === 'col')) arrow(colMid, g.by[0] - 5, colMid, g.ye + 5, C.s2);
      }
    };

    // ---------- the card: one block per step, all in one grid cell so the card never jumps ----------
    const F = (v, f, k = 0) => L.numTex(v, L.more(f, v, Math.max(k, 0))), res = t => `\\htmlClass{res}{${t}}`;
    // sh: the short form a card falls back to when the full line would need small text (first, …, last); k: extra digits (adds)
    const list = (a, sep, f, sh, k = 0) => (a.length <= (sh ? 3 : 6) ? a.map(v => F(v, f, k)) : sh ? [F(a[0], f, k), '\\dots', F(a[a.length - 1], f, k)] : [F(a[0], f, k), F(a[1], f, k), '\\dots', F(a[a.length - 1], f, k)]).join(sep);
    // a list worked by hand must give the result shown (as L.work): if it would not, its numbers get one more digit, twice at
    // most; -1 means the line reads ≈. A list too long to show in full cannot be redone by hand, so it is not checked
    const adds = (a, f, comb, want, rf) => { if (a.length > 6) return 0;
      for (let k = 0; k <= 2; k++) if (L.fmt(comb(a.map(x => L.shown(x, L.more(f, x, k)))), rf) === L.fmt(want, rf)) return k; return -1; };
    const eqOf = k => k < 0 ? '\\htmlClass{approx}{\\approx}' : '=', tot = a => a.reduce((p, q) => p + q, 0);
    const shape = (a, b, out) => `<span class="shape${out ? ' out' : ''}">${a} × ${b}</span>`;
    const arrowH = '<span class="arr">→</span>';
    const nota = (texs, extra = []) => L.notationEl(texs, s.notation === false ? s : { ...s, notation: [...(Array.isArray(s.notation) ? s.notation : []), ...extra] }, 'left');
    const blocks = [];
    const block = (t, html) => { const b = h('div', 'ok', html); card.appendChild(b); blocks[t] = b; return b; };
    {
      const cx = sub(S0.tex, 'ij');
      // on a phone the slide's why moves down here (owhy0), so the matrix keeps the height
      const b = block(0, `<div class="otop"><div class="eyebrow">Start here</div><div class="oshape">${shape(n, m)}<span class="sx">${L.esc(plural(rowN))} × ${L.esc(plural(colN))}</span></div></div>` +
        (mx.name ? `<div class="oname">${md(mx.name)}</div>` : '') + `<div class="ocell"><span class="cx"></span>${mx.says ? ` = ${md(mx.says)}` : ''}</div>` + (mx.why ? `<div class="owhy">${md(mx.why)}</div>` : '') +
        (s.why ? `<div class="owhy owhy0">${md(s.why)}</div>` : ''));
      L.renderTex(b.querySelector('.cx'), cx, false);
      const nt = nota([cx]); if (nt) b.appendChild(nt);
    }
    states.slice(1).forEach(st => {
      const op = st.op, t = st.t, pv = st.prev, v = st.res, extra = [];
      let f = '', lines = [], shorts = [], label = '', same = '', shapes = '';
      const R = v ? res(sub(v.tex, v.kind === 'row' ? 'i' : 'j')) : '';
      if (st.kind === 'rows' || st.kind === 'cols') {
        const byRow = st.kind === 'rows', a = byRow ? fr : fc, I = byRow ? 'j' : 'i', K = st.inc.length, other = byRow ? colLab : rowLab, all = K === other.length;
        const E = op.expr ? L.tex(op.expr, { sym: symIn(pv, 'i', 'j') }) : `\\htmlClass{inp}{${sub(pv.tex, 'ij')}}`;
        const set = all ? `${I}=1` : `${I}\\,\\in\\,\\{${st.inc.map(q => tt(other[q])).join(',\\,')}\\}`, top = all ? `^{${K}}` : '', set1 = all ? I : set;
        const cv = st.cv, den = K > 1 ? `${K}-1` : '1';
        const ctr = q => cv ? `\\htmlClass{use}{${sub(cv.tex, q)}}` : `${op.center === 'median' ? '\\tilde' : '\\bar'}{${pv.tex}}_{${q}}`;
        if (op.center === 'median') extra.push({ tex: '\\tilde{x}', says: 'the median of x' });
        const TPL = { sum: `\\sum_{${set}}${top} ${E}`, mean: `\\frac{1}{${K}}\\sum_{${set}}${top} ${E}`, median: `\\operatorname{median}_{${set1}}\\, ${E}`,
          geomean: `\\Big(\\prod_{${set}}${top} ${E}\\Big)^{1/${K}}`, var: `\\frac{1}{${den}}\\sum_{${set}}${top}\\big(${E} - ${ctr(byRow ? 'i' : 'j')}\\big)^2`,
          sd: `\\sqrt{\\frac{1}{${den}}\\sum_{${set}}${top}\\big(${E} - ${ctr(byRow ? 'i' : 'j')}\\big)^2}`, min: `\\min_{${set1}} ${E}`, max: `\\max_{${set1}} ${E}` };
        const fn = op.fn || 'sum';
        f = `${R} = ${op.formula || TPL[fn] || '\\dots'}`;
        const vals = st.tr[a], ff = op.expr ? undefined : pv.fmt, out = res(F(v.values[a], v.fmt));
        label = `For ${L.esc(byRow ? rowN : colN)} ${L.esc((byRow ? rowLab : colLab)[a])}`;
        const inLine = sh => `${L.tex(op.expr, { sym: symIn(pv, byRow ? String(fr + 1) : 'i', byRow ? 'j' : String(fc + 1)) })} \\;\\to\\; ${list(vals, ',\\ ', undefined, sh)}`;
        if (op.expr) { lines.push(inLine(false)); if (inLine(true) !== lines[0]) shorts[0] = inLine(true); }
        // spread in three short lines: the center, each value's squared distance from it, their average
        const spread = () => { const c = cv ? cv.values[a] : op.center === 'median' ? median(vals) : mean(vals), sq = vals.map(x => (x - c) ** 2), q1 = String(a + 1);
          const xa = op.expr ? L.tex(op.expr, { sym: symIn(pv, byRow ? q1 : 'i', byRow ? 'j' : q1) }) : `\\htmlClass{inp}{${sub(pv.tex, byRow ? ij(q1, 'j') : ij('i', q1))}}`;
          lines.push(`${ctr(q1)} = ${F(c)}`);
          const kq = adds(sq, v.fmt, x => { const m2 = tot(x) / Math.max(K - 1, 1); return fn === 'sd' ? Math.sqrt(m2) : m2; }, v.values[a], v.fmt);
          lines.push(`\\big(${xa} - ${ctr(q1)}\\big)^2 \\;\\to\\; ${list(sq, ',\\ ', v.fmt, false, kq)}`);
          const inner = `\\tfrac{1}{${den}}\\left(${list(sq, ' + ', v.fmt, false, kq)}\\right)`; return `${fn === 'sd' ? `\\sqrt{${inner}}` : inner} ${eqOf(kq)} ${out}`; };
        const kS = adds(vals, ff, { sum: tot, mean: x => tot(x) / K, geomean: x => x.reduce((p, q) => p * q, 1) ** (1 / K) }[fn] || (() => NaN), v.values[a], v.fmt);
        const WK = { sum: sh => `${list(vals, ' + ', ff, sh, kS)} ${eqOf(kS)} ${out}`, mean: sh => `\\tfrac{1}{${K}}\\left(${list(vals, ' + ', ff, sh, kS)}\\right) ${eqOf(kS)} ${out}`,
          // a long list keeps both ends and the middle, so the line still reads "sort, take the middle"
          median: sh => { const so = [...vals].sort((p, q) => p - q), k2 = so.length, mid = k2 % 2 ? [(k2 - 1) / 2] : [k2 / 2 - 1, k2 / 2];
            const keep = sh ? [...new Set([0, ...mid, k2 - 1])] : k2 <= 7 ? so.map((_, q) => q) : [0, 1, ...mid, k2 - 2, k2 - 1], parts = [];
            keep.forEach((q, p) => { if (p && q - keep[p - 1] > 1) parts.push('\\dots'); parts.push(mid.includes(q) ? `\\htmlClass{mid}{${F(so[q], ff)}}` : F(so[q], ff)); });
            if (!sh) label += k2 <= 7 ? ', sorted' : `, sorted, the middle of ${k2}`;
            return `\\operatorname{median}\\left(${parts.join(',\\ ')}\\right) = ${out}`; },
          geomean: sh => `\\left(${list(vals, ' \\times ', ff, sh, kS)}\\right)^{1/${K}} ${eqOf(kS)} ${out}`,
          min: sh => `\\min\\left(${list(vals, ',\\ ', ff, sh)}\\right) = ${out}`, max: sh => `\\max\\left(${list(vals, ',\\ ', ff, sh)}\\right) = ${out}`, var: spread, sd: spread };
        if (!WK[fn]) lines.push(`${R} = ${out}`);
        else { const full = WK[fn](false), q0 = lines.length; lines.push(full);
          if (!/^(var|sd)$/.test(fn) && WK[fn](true) !== full) shorts[q0] = WK[fn](true); }
        same = `Same rule for each of the ${byRow ? n : m} ${L.esc(plural(byRow ? rowN : colN))}.`;
        shapes = byRow ? shape(n, K) + arrowH + shape(n, 1, true) : shape(K, m) + arrowH + shape(1, m, true);
      } else if (st.kind === 'map') {
        f = `${res(sub(st.tex, 'ij'))} = ${L.tex(op.expr || 'x', { sym: symIn(pv, 'i', 'j') })}`;
        label = `For ${L.esc(rowN)} ${L.esc(rowLab[fr])}, ${L.esc(colN)} ${L.esc(colLab[fc])}`;
        const wk = L.work(op.expr || 'x', { val: valIn(pv, fr, fc), fmtOf: fmtIn(pv), wrap: wrapIn }, st.M[fr][fc], st.fmt, cellScope(pv, fr, fc));
        lines.push(`${wk.tex} ${wk.eq} ${res(F(st.M[fr][fc], st.fmt))}`);
        same = `Same rule for all ${n * m} cells.`; shapes = shape(n, m) + arrowH + shape(n, m, true);
      } else if (st.kind === 'dot') {
        const wt = st.w, xs = pv.M[fr];
        f = `${R} = \\sum_{j=1}^{${m}} \\htmlClass{inp}{${sub(pv.tex, 'ij')}}\\, \\htmlClass{use}{${sub(wt.tex, 'j')}}`;
        label = `For ${L.esc(rowN)} ${L.esc(rowLab[fr])}`;
        const pr = xs.map((x, q) => x * wt.values[q]), sig = pr.length <= 6 ? pr : [pr[0], pr[1], NaN, pr[pr.length - 1]], kd = adds(pr, undefined, tot, v.values[fr], v.fmt);
        lines.push(`\\htmlClass{inp}{${sub(pv.tex, ij(String(fr + 1), 'j'))}} \\times \\htmlClass{use}{${sub(wt.tex, 'j')}} \\;\\to\\; ${list(pr, ',\\ ', undefined, false, kd)}`);
        lines.push(sig.map((x, q) => Number.isNaN(x) ? ' + \\dots' : q === 0 ? F(x, undefined, kd) : x < 0 ? ` - ${F(-x, undefined, kd)}` : ` + ${F(x, undefined, kd)}`).join('') + ` ${eqOf(kd)} ${res(F(v.values[fr], v.fmt))}`);
        same = `Same rule for each of the ${n} ${L.esc(plural(rowN))}.`; shapes = shape(n, m) + '<span class="arr">·</span>' + shape(m, 1) + arrowH + shape(n, 1, true);
      } else if (st.kind === 'sort') {
        const by = st.by;
        f = `${R} = \\text{place of } \\htmlClass{use}{${sub(by.tex, 'i')}} \\text{ in the sorted list${op.desc ? ', largest first' : ''}}`;
        label = `For ${L.esc(rowN)} ${L.esc(rowLab[fr])}`;
        lines.push(`\\htmlClass{use}{${sub(by.tex, String(fr + 1))}} = ${F(by.values[fr], by.fmt)} \\;\\Rightarrow\\; ${res(`\\text{rank } ${F(v.values[fr])}`)} \\text{ of } ${n}`);
        same = `All ${n} ${L.esc(plural(rowN))} sorted at once.`; shapes = shape(n, 1) + arrowH + shape(n, 1, true);
      } else if (st.kind === 'vec') {
        const row = v.kind === 'row', a = row ? fr : fc, N = row ? n : m;
        f = `${R} = ${L.tex(op.expr, { sym: nm => byName[nm] ? `\\htmlClass{use}{${sub(byName[nm].tex, row ? 'i' : 'j')}}` : ((ctx.symbols || {})[nm] || {}).tex || L.autoSym(nm) })}`;
        label = `For ${L.esc(row ? rowN : colN)} ${L.esc((row ? rowLab : colLab)[a])}`;
        const wk = L.work(op.expr, { val: nm => byName[nm] && byName[nm] !== v ? byName[nm].values[a] : typeof ctx.scope[nm] === 'number' ? ctx.scope[nm] : null,
          fmtOf: nm => byName[nm] ? byName[nm].fmt : undefined, wrap: (nm, t0) => byName[nm] ? `\\htmlClass{use}{${t0}}` : t0 }, v.values[a], v.fmt, ctx.scope);
        lines.push(`${wk.tex} ${wk.eq} ${res(F(v.values[a], v.fmt))}`);
        same = `Same rule for each of the ${N} ${L.esc(plural(row ? rowN : colN))}.`; shapes = row ? shape(n, 1) + arrowH + shape(n, 1, true) : shape(1, m) + arrowH + shape(1, m, true);
      }
      const b = block(t, `<div class="otop"><div class="eyebrow">Step ${t} of ${T} · ${KIND[st.kind] || st.kind}</div><div class="oshape">${shapes}</div></div>${op.say ? `<div class="oname">${md(op.say)}</div>` : ''}` +
        `<div class="of"></div><div class="ow"><div class="small">${label}:</div>${lines.map(() => '<span></span>').join('')}</div>${same ? `<div class="osame">${same}</div>` : ''}${op.why ? `<div class="owhy">${md(op.why)}</div>` : ''}`);
      L.renderTex(b.querySelector('.of'), f, false);
      b.querySelectorAll('.ow > span').forEach((e, q) => { L.renderTex(e, lines[q], false); if (shorts[q]) { e.dataset.full = lines[q]; e.dataset.short = shorts[q]; } });
      const nt = nota([f, ...lines], extra); if (nt) b.appendChild(nt);
    });

    const show = k => {
      const t = Math.max(0, Math.min(T, k - 1)), st = states[t];
      box.querySelectorAll('.band, .cur, .in, .on, .dim, .chg').forEach(e => e.classList.remove('band', 'cur', 'in', 'on', 'dim', 'chg'));
      mc.forEach((r, i) => r.forEach((e, j) => { e.textContent = L.fmt(st.M[i][j], st.fmt); if (st.kind === 'map') e.classList.add('chg'); }));
      right.concat(below, tops).forEach(r => { const pend = r.v.t > t; r.head.classList.toggle('pend', pend); r.cells.forEach((e, q) => { e.classList.toggle('pend', pend); e.textContent = L.fmt(r.v.values[q], r.v.fmt); }); });
      place(st);
      const mark = v => { const r = strip(v); if (!r) return; r.head.classList.add(v.kind === 'row' ? 'in' : 'on'); r.cells[v.kind === 'row' ? fr : fc].classList.add('in'); };
      const made = () => { const r = strip(st.res); if (r) r.cells[st.res.kind === 'row' ? fr : fc].classList.add('cur'); };
      if (st.kind === 'rows') {
        st.inc.forEach(j => mc[fr][j].classList.add('band')); mr[fr].classList.add('on');
        colLab.forEach((_, j) => { if (!st.inc.includes(j)) { mh[j].classList.add('dim'); mc.forEach(r => r[j].classList.add('dim')); } });
        st.uses.forEach(mark); made();
      } else if (st.kind === 'cols') {
        st.inc.forEach(i => mc[i][fc].classList.add('band')); mh[fc].classList.add('on');
        rowLab.forEach((_, i) => { if (!st.inc.includes(i)) { mr[i].classList.add('dim'); mc[i].forEach(e => e.classList.add('dim')); } });
        st.uses.forEach(mark); made();
      } else if (st.kind === 'map') {
        mc[fr][fc].classList.remove('chg'); mc[fr][fc].classList.add('cur'); mr[fr].classList.add('on'); mh[fc].classList.add('on'); st.uses.forEach(mark);
      } else if (st.kind === 'dot') {
        mc[fr].forEach(e => e.classList.add('band')); mr[fr].classList.add('on'); tops.find(tp => tp.v === st.w).cells.forEach(e => e.classList.add('in')); made();
      } else if (st.kind === 'sort') {
        mr[fr].classList.add('on'); const r = strip(st.by); if (r) { r.head.classList.add('in'); r.cells.forEach(e => e.classList.add('in')); } made();
      } else if (st.kind === 'vec') { st.uses.forEach(mark); made(); }
      hd.querySelector('.shape').textContent = `${n} × ${m}`; hd.querySelector('.mname').innerHTML = md(st.name || '');
      blocks.forEach((b, q) => b.classList.toggle('shown', q === t));
      overlay(st);
    };

    return {
      node, steps: T + 1, layout, show,
      audit: () => { const out = []; if (G && G.over) out.push('the matrix does not fit its card: show fewer rows or columns, or shorter labels');
        else if (G && G.f < 18) out.push(`the matrix is crowded (numbers at ${G.f}px): shorten step labels (≤ 8 letters), or show fewer rows or columns`);
        if (cardMin < 18) out.push(`a line in the step card shrank to ${cardMin}px: use fewer columns or a shorter rule`); return out; },
    };
  };
})();
