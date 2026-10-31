/* viz-os sketch: what goes on a sheet. Each figure item has two halves: real HTML text over the sheet, in units of the
   host's width (1cqw = 1 unit), and ink on the canvas. Marks that encode data use the exact pens and sit at their scaled
   positions; frames, arrows and art wobble. Labels attach to the named anchors each figure publishes. */
(function () {
  'use strict';
  const L = window.VizOS, K = L.sketch, h = L.h, md = s => L.md(s), list = x => Array.isArray(x) ? x : x == null ? [] : [x];
  const val = (e, scope) => typeof e === 'string' ? L.eval(e, scope) : e;
  const col = (pal, c, fb) => !c ? fb : pal[c] || c;
  const pct = (v, of) => `${v / of * 100}%`;
  K.thinksOf = s => [...list(s.frames).filter(f => f && f.think).map(f => f.think), ...list(s.think)];
  const place = (e, x, y, w, hh, H) => { e.style.left = pct(x, 100); e.style.top = pct(y, H); if (w != null) e.style.width = pct(w, 100); if (hh != null) e.style.height = pct(hh, H); return e; };

  // ---------- tables and matrices ----------
  function grid(it, spec, ctx, host, H, matrix) {
    const rows = spec.rows ? val(spec.rows, ctx.scope) : null, cols = list(spec.cols), n = rows ? rows.length : L.eval(cols[0].key, ctx.scope).length;
    const foot = list(spec.foot), head = spec.head ?? '', [x, y] = it.at || [0, 0], w = it.width || 40, nc = cols.length + (rows ? 1 : 0), nr = n + 1 + foot.length, rh = spec.rh || it.rh || 6;
    const e = place(h('div', 'tbl' + (matrix ? ' mx' : '')), x, y, w, rh * nr, H); e.style.setProperty('--rh', rh); e.style.gridTemplateColumns = `repeat(${nc}, 1fr)`;
    const cell = (html, cls) => { const c = h('span', 'c ' + (cls || ''), html); e.appendChild(c); return c; };
    if (rows) cell(md(String(head)), 'hd rl');
    cols.forEach(c => cell(md(String(c.label ?? c.key)), 'hd'));
    for (let r = 0; r < n; r++) {
      if (rows) cell(L.esc(String(rows[r])), 'rl');
      cols.forEach(c => cell(md(`{{at(${c.key}, ${r})${c.fmt != null ? '|' + c.fmt : ''}}}`), 'num'));
    }
    foot.forEach(f => { if (rows) cell(md(String(f.label ?? '')), 'rl ft'); cols.forEach(c => cell(f.cols && f.cols[c.key] != null ? md(String(f.cols[c.key])) : '', 'num ft')); });
    host.appendChild(e);
    const part = { n, cols, rows, x, y, w, rh, nr, nc, foot };
    const shape = matrix && spec.shape !== false ? place(h('div', 'lab dims', ''), x + w / 2, y + rh * nr + 1, null, null, H) : null;
    if (shape) { shape.textContent = `${n} × ${cols.length}`; host.appendChild(shape); }
    const name = spec.name ? place(h('div', 'lab name', md(spec.name)), x, y - rh * .95, null, null, H) : null;
    if (name) host.appendChild(name);
    return { draw(E) {
      const cw = w / nc, X = i => x + i * cw, Y = i => y + i * rh, c0 = rows ? 1 : 0, ci = key => c0 + cols.findIndex(c => c.key === key);
      const box = (a, b, c, d) => [E.u(a, b), E.u(c, b), E.u(c, d), E.u(a, d)];
      for (const m of list(spec.mark)) {
        const r = m.row != null ? m.row : null, k = m.col != null ? ci(m.col) : null;
        const R = r != null && k == null ? box(X(0), Y(r + 1), x + w, Y(r + 2)) : k != null && r == null ? box(X(k), Y(0), X(k + 1), Y(n + 1)) : box(X(k), Y(r + 1), X(k + 1), Y(r + 2));
        E.wash(R, m.color);
      }
      const T = E.pen(E.ink);
      if (matrix) {
        const a = c0 ? X(1) : x, top = Y(1), bot = Y(n + 1), b = .9;
        T.exact([E.u(a + b, top), E.u(a, top), E.u(a, bot), E.u(a + b, bot)], { wmul: 1.4 }); T.exact([E.u(x + w - b, top), E.u(x + w, top), E.u(x + w, bot), E.u(x + w - b, bot)], { wmul: 1.4 });
      } else {
        for (let r = 0; r <= nr; r++) T.exact([E.u(x, Y(r)), E.u(x + w, Y(r))], { wmul: r === 1 || r === n + 1 ? 1.5 : 1 });
        for (let c = 0; c <= nc; c++) T.exact([E.u(X(c), y), E.u(X(c), y + rh * nr)]);
      }
      for (let r = 0; r < n; r++) { E.pub(`row.${r}`, x + w, Y(r + 1.5)); if (rows) E.pub(`row.${rows[r]}`, x + w, Y(r + 1.5)); cols.forEach((c, j) => E.pub(`cell.${r}.${c.key}`, X(c0 + j + .5), Y(r + 1.5))); }
      cols.forEach((c, j) => E.pub(`col.${c.key}`, X(c0 + j + .5), y));
      E.pub('top', x + w / 2, y); E.pub('bottom', x + w / 2, y + rh * nr); E.pub('left', x, y + rh * nr / 2); E.pub('right', x + w, y + rh * nr / 2);
    } };
  }

  // ---------- plots: exact ink on computed scales ----------
  const NICE = [1, 2, 2.5, 5, 10];
  function ticks(lo, hi, n = 5) {
    const raw = (hi - lo) / n, p = 10 ** Math.floor(Math.log10(raw)), step = NICE.find(s => s * p >= raw) * p, out = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-6; v += step) out.push(Math.abs(v) < step * 1e-6 ? 0 : v);
    const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9)) + (String(step / p).includes('.') ? 1 : 0);
    return { list: out, fmt: v => v.toFixed(d) };
  }
  function plot(it, spec, ctx, host, H) {
    const [x, y] = it.at || [0, 0], w = it.width || 40, hh = it.height || w * .75, e = place(h('div', 'plot'), x, y, w, hh, H), ml = spec.ml ?? 7, mb = spec.mb ?? 6.5, mt = 1.5, mr = 2;
    host.appendChild(e);
    const X0 = x + ml, Y0 = y + hh - mb, PW = w - ml - mr, PH = hh - mb - mt, layers = list(spec.layers).flat(), sp = ctx.scope;   // flat: a YAML alias can bring in a shared list of layers
    return { draw(E) {
      const pts = { x: [], y: [] }, num = v => val(v, sp), seq = v => list(num(v));
      for (const l of layers) {
        if (l.dots) { pts.x.push(...seq(l.dots[0])); pts.y.push(...seq(l.dots[1])); }
        if (l.path) { pts.x.push(...seq(l.path[0])); pts.y.push(...seq(l.path[1])); }
        for (const k of ['line', 'arrow']) if (l[k]) { pts.x.push(num(l[k][0][0]), num(l[k][1][0])); pts.y.push(num(l[k][0][1]), num(l[k][1][1])); }
        if (l.bars) { pts.y.push(0, ...seq(l.bars[1])); }
      }
      const range = (ax, data) => { const lo0 = data.length ? Math.min(...data) : 0, hi0 = data.length ? Math.max(...data) : 1, pad = (hi0 - lo0 || 1) * .08; return [ax.min != null ? num(ax.min) : lo0 - pad, ax.max != null ? num(ax.max) : hi0 + pad]; };
      const ax = spec.x || {}, ay = spec.y || {}; let [x0, x1] = range(ax, pts.x), [y0, y1] = range(ay, pts.y);
      if (spec.equal) { const per = Math.max((x1 - x0) / PW, (y1 - y0) / PH), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; x0 = cx - per * PW / 2; x1 = cx + per * PW / 2; y0 = cy - per * PH / 2; y1 = cy + per * PH / 2; }
      const bars = layers.find(l => l.bars), nb = bars ? seq(bars.bars[1]).length : 0;
      if (bars) { x0 = 0; x1 = nb; }
      const sx = v => X0 + (v - x0) / (x1 - x0) * PW, sy = v => Y0 - (v - y0) / (y1 - y0) * PH, m = (a, b) => E.u(sx(a), sy(b));
      const T = E.pen(E.soft || E.ink), I = E.pen(E.ink), zx = x0 <= 0 && x1 >= 0 && !bars ? 0 : null, zy = y0 <= 0 && y1 >= 0 ? 0 : null;
      const axes = spec.axes !== false;    // `axes: false` lays a plot over another one on the same scales
      if (axes) I.exact([E.u(X0, Y0 - PH), E.u(X0, Y0), E.u(X0 + PW, Y0)], { wmul: 1.2 });
      if (axes && zx != null && x0 !== 0) T.exact([m(0, y0), m(0, y1)], { wmul: .7 }); if (axes && zy != null && y0 !== 0) T.exact([m(x0, 0), m(x1, 0)], { wmul: .7 });
      const tk = (v, cls, a, b) => { const t = h('span', 'tk ' + cls, v); t.style.left = pct(a - x, w); t.style.top = pct(b - y, hh); e.appendChild(t); };
      e.innerHTML = '';
      const tx = bars ? null : ticks(x0, x1, ax.ticks), ty = ticks(y0, y1, ay.ticks);
      if (axes && tx) tx.list.forEach(v => { I.exact([E.u(sx(v), Y0), E.u(sx(v), Y0 + .9)]); tk(tx.fmt(v), 'bx', sx(v), Y0 + 1.1); });
      if (axes) ty.list.forEach(v => { I.exact([E.u(X0, sy(v)), E.u(X0 - .9, sy(v))]); tk(ty.fmt(v), 'ly', X0 - 1.1, sy(v)); });
      if (axes && ax.label) { const t = h('span', 'axl bx', md(ax.label)); t.style.left = pct(X0 + PW / 2 - x, w); t.style.top = pct(Y0 + 3.6 - y, hh); e.appendChild(t); }
      if (axes && ay.label) { const t = h('span', 'axl', md(ay.label)); t.style.left = pct(X0 + 1 - x, w); t.style.top = pct(Y0 - PH - .4 - y, hh); e.appendChild(t); }
      L.fill(e, sp);
      for (const l of layers) {
        const c = col(E.pal, l.color, E.main), P = E.pen(c, l.nib ?? .4), id = l.id ? l.id + '.' : '';
        if (l.hline != null) { P.exact([m(x0, num(l.hline)), m(x1, num(l.hline))]); E.pub(id + 'line', sx(x1), sy(num(l.hline))); }
        if (l.vline != null) { P.exact([m(num(l.vline), y0), m(num(l.vline), y1)]); E.pub(id + 'line', sx(num(l.vline)), sy(y1)); }
        if (l.curve) { const n = 96, sc = L.scope(sp, {}), line = []; for (let i = 0; i <= n; i++) { const v = x0 + (x1 - x0) * i / n; sc.x = v; const q = L.eval(l.curve, sc); if (Number.isFinite(q)) line.push(m(v, q)); } if (line.length > 1) P.exact(line, { wmul: 1.4 }); }
        if (l.path) { const a = seq(l.path[0]), b = seq(l.path[1]); P.exact(a.map((v, i) => m(v, b[i])), { wmul: l.w ?? 1.4 }); E.pub(id + 'line', sx(a[a.length - 1]), sy(b[b.length - 1])); }
        if (l.line) { const a = l.line[0], b = l.line[1]; P.exact([m(num(a[0]), num(a[1])), m(num(b[0]), num(b[1]))], { wmul: l.w ?? 1.4 }); E.pub(id + 'line', sx(num(b[0])), sy(num(b[1]))); }
        if (l.arrow) { const a = l.arrow[0], b = l.arrow[1], p = m(num(a[0]), num(a[1])), q = m(num(b[0]), num(b[1])); P.exact([p, q], { wmul: 1.6 }); K.arrowhead(E.S, q, p, { c1: c, edge: c }, 3); E.pub(id + 'arrow', sx(num(b[0])), sy(num(b[1]))); }
        if (l.sticks) { const [a, b, c2, d] = l.sticks.map(seq); a.forEach((_, i) => P.exact([m(a[i], b[i]), m(c2[i], d[i])], { wmul: .8 })); }
        if (l.bars) { const vs = seq(l.bars[1]), ns = seq(l.bars[0]), g = .18; vs.forEach((v, i) => { const a = E.u(sx(i + g), sy(0)), b = E.u(sx(i + 1 - g), sy(v)), R = [a, [b[0], a[1]], b, [a[0], b[1]]]; P.exact([...R, R[0]]); P.hatch(R, { angle: 45, pitch: 1.1, pressure: .7 }); tk(L.esc(String(ns[i] ?? '')), 'bx', sx(i + .5), Y0 + 1.1); E.pub(`${id}bar.${i}`, sx(i + .5), sy(v)); }); }
        if (l.dots) { const a = seq(l.dots[0]), b = seq(l.dots[1]), names = l.names ? seq(l.names) : null, r = l.size ?? 1.2; a.forEach((v, i) => { P.exactDot(m(v, b[i]), r, { pressure: .9 }); E.pub(`${id}point.${i}`, sx(v), sy(b[i])); if (names) E.pub(`${id}${names[i]}`, sx(v), sy(b[i])); E.mark(sx(v), sy(b[i])); }); }
      }
      E.pub('origin', sx(Math.max(0, x0)), sy(Math.max(0, y0))); E.pub('top', x + w / 2, y); E.pub('bottom', x + w / 2, y + hh); E.pub('left', x, y + hh / 2); E.pub('right', x + w, y + hh / 2);
    } };
  }

  // ---------- formulas ----------
  const symOf = ctx => n => ((ctx.symbols[n] || {}).tex) || L.autoSym(n);
  const fmtOf = ctx => (n, v) => ((ctx.symbols[n] || {}).fmt) ?? (Number.isInteger(v) ? ',' : 's4');
  function textBox(cls, it, host, H, fill) {
    const [x, y] = it.at || [0, 0], e = place(h('div', cls), x, y, it.width ?? null, null, H);
    if (it.size) e.style.setProperty('--fs', it.size);
    host.appendChild(e);
    return { e, x, y, W: it.width || 30, refresh: fill };
  }
  function eqn(it, spec, ctx, host, H) {
    const tex = typeof spec === 'string' ? spec : spec.tex, b = textBox('eq', it, host, H);
    b.e.innerHTML = md(`$\\displaystyle ${(spec.lhs ? symOf(ctx)(spec.lhs) + ' = ' : '') + tex}$`);
    return { draw(E) { E.pub('top', b.x, b.y); } };
  }
  function calc(it, spec, ctx, host, H) {
    const b = textBox('calc', it, host, H), sc = ctx.scope, f = spec.fmt;
    const fill = () => { const v = L.try(spec.expr, sc, `sheet ${ctx.index + 1} calc`); if (spec.name) sc[spec.name] = L.global[spec.name] = v;   // later sheets read it too
      const sym = L.tex(spec.expr, { sym: symOf(ctx) }), nums = L.tex(spec.expr, { val: n => (typeof sc[n] === 'number' ? sc[n] : null), fmtOf: fmtOf(ctx), sym: symOf(ctx) }), res = L.numTex(v, f ?? 's4');
      b.e.innerHTML = `${spec.say ? `<span class="say">${md(spec.say)}</span>` : ''}<span class="m">${md(`$${spec.name ? symOf(ctx)(spec.name) + ' = ' : ''}${sym} = ${nums} = ${res}$`)}</span>`; L.fill(b.e, sc); };
    fill();
    return { refresh: fill, draw(E) { E.pub('top', b.x, b.y); } };
  }
  // the formula from the numbers just worked: a row of those numbers, then the same shape in symbols
  function assemble(it, spec, ctx, host, H) {
    const b = textBox('asm', it, host, H), sc = ctx.scope, sym = symOf(ctx), lhs = spec.lhs ? sym(spec.lhs) + ' = ' : '';
    const fill = () => { const plug = String(spec.plug ?? spec.tex).replace(/\[([A-Za-z_]\w*)(?::([^\]]*))?\]/g, (m, n, f, at, all) => { const v = L.try(n, sc, `sheet ${ctx.index + 1} assemble`), t = L.numTex(v, f ? (/^\d+$/.test(f) ? +f : f) : fmtOf(ctx)(n, sc[n])); return v < 0 && all[at + m.length] === '^' ? `(${t})` : t; });
      const tex = String(spec.tex).replace(/\[([A-Za-z_]\w*)\]/g, (_, n) => sym(n)), val0 = spec.lhs && typeof sc[spec.lhs] === 'number' ? ` = ${L.numTex(sc[spec.lhs], spec.fmt ?? 's4')}` : '';
      b.e.innerHTML = `${spec.say ? `<span class="say">${md(spec.say)}</span>` : ''}<span class="m nums">${md(`$\\displaystyle ${lhs}${plug}${val0}$`)}</span><span class="m syms">${md(`$\\displaystyle ${lhs}${tex}$`)}</span>`; L.fill(b.e, sc); };
    fill();
    return { refresh: fill, draw(E) { E.pub('top', b.x, b.y); } };
  }
  function text(it, ctx, host, H) {
    const b = textBox('txt' + (it.letter ? ' lt' : ''), it, host, H);
    b.e.innerHTML = md(it.text); if (it.color) b.e.dataset.color = it.color;
    return { draw(E) { if (it.color) b.e.style.color = col(E.pal, it.color); E.pub('top', b.x, b.y); } };
  }

  function make(it, ctx, host, H) {
    if (it.table) return grid(it, it.table, ctx, host, H, false);
    if (it.matrix) return grid(it, it.matrix, ctx, host, H, true);
    if (it.plot) return plot(it, it.plot, ctx, host, H);
    if (it.eqn) return eqn(it, it.eqn, ctx, host, H);
    if (it.calc) return calc(it, it.calc, ctx, host, H);
    if (it.assemble) return assemble(it, it.assemble, ctx, host, H);
    if (it.text != null) return text(it, ctx, host, H);
    if (it.part) return K.partFigure(it, ctx, host, H);
    if (it.code) return K.customFigure(it, ctx, host, H);
    throw new Error('a figure with no kind: ' + JSON.stringify(it).slice(0, 60));
  }

  K.buildFigure = function (s, ctx, R, thinkBlock) {
    const fig = R.fig, H = R.figH, add = (items, host, HH, k, ox, oy, newest, tag) => list(items).forEach(it => { if (!it || typeof it !== 'object') return;
      const p = make(it, ctx, host, HH); R.parts.push({ ...p, id: it.id || tag, k, ox, oy, newest: !!newest }); });
    fig.classList.add('units');
    add(s.figure, fig, H, 1, 0, 0, false, 'fig');
    const frames = list(s.frames).filter(f => f && typeof f === 'object');
    if (frames.length) {
      const cols = s.cols || Math.min(frames.length, 3), rows = Math.ceil(frames.length / cols), gx = 3, gy = 3, pw = (100 - gx * (cols - 1)) / cols, ph = (H - gy * (rows - 1)) / rows;
      R.frames = [];
      frames.forEach((f, j) => {
        const ox = (j % cols) * (pw + gx), oy = Math.floor(j / cols) * (ph + gy), p = place(h('div', 'panel'), ox, oy, pw, ph, H), hh = ph / pw * 100, cap = h('div', 'fsay', `<b>${j + 1}</b> ${md(f.say)}`), art = h('div', 'units fart');
        p.append(art, cap); fig.appendChild(p); R.frames.push({ ox, oy, pw, ph, cap });
        frames.slice(0, j + 1).forEach((g, m) => add(g.add, art, hh * .72, pw / 100, ox, oy, m === j, 'f' + m));
      });
      const th = frames.filter(f => f.think);
      if (th.length) { let w = R.sheet.querySelector('.thinks'); if (!w) { w = h('div', 'thinks'); R.sheet.querySelector('.notes').after(w); } th.reverse().forEach((f, m) => { const t = thinkBlock(f.think); t.dataset.k = th.length - m; w.prepend(t); }); }
    }
    list(s.label).forEach(lb => { const e = h('div', 'lab', md(lb.say)); e.style.visibility = 'hidden'; fig.appendChild(e); R.labels.push({ ...lb, e }); });
  };

  // the wash behind a marked row or column: a marker on pale paper, pastel on dark
  const washer = (S, pal, penOf) => (poly, c) => {
    if (pal.name === 'navy') S.tool('pastelpencil', { color: col(pal, c, pal.wash), point: 'blunt' }).fillWith(poly, { pressure: .9 });
    else S.tool('pastelpencil', { color: col(pal, c, pal.wash), point: 'blunt' }).fillWith(poly, { angle: 12, pressure: 1 });
  };

  K.drawFigure = function (sl, S, pal, box, penOf) {
    const R = sl.r, unit = box.w / 100, scope = sl.ctx.scope, anchors = {}, marks = [];
    sl.anchors = anchors; sl.marks = marks;
    const base = { S, pal, scope, wash: washer(S, pal, penOf) };
    (R.frames || []).forEach(f => { const a = [box.x + f.ox * unit, box.y + f.oy * unit], b = [a[0] + f.pw * unit, a[1] + f.ph * unit];
      S.tool(pal.pen, pal.pen === 'gel' ? { color: pal.soft, nib: .3 } : { color: pal.soft, nib: .25, kind: 'technical' }).poly([a, [b[0], a[1]], b, [a[0], b[1]]], true); });
    R.parts.forEach(p => {
      if (p.refresh) p.refresh();
      const k = p.k * unit, u = (x, y) => [box.x + p.ox * unit + x * k, box.y + p.oy * unit + y * k];
      p.draw({ ...base, u, unit: k, id: p.id, ink: p.newest ? pal.accent : pal.ink, soft: p.newest ? pal.accent : pal.soft, main: p.newest ? pal.accent : pal.s1, pen: (c, n) => penOf(S, pal, c, n),
        pub: (name, x, y) => { anchors[`${p.id}.${name}`] = [p.ox + x * p.k, p.oy + y * p.k]; }, mark: (x, y) => marks.push(u(x, y)) });
    });
    const fw = R.fig.getBoundingClientRect().width;
    Object.assign(anchors, { 'sheet.left': [0, R.figH / 2], 'sheet.right': [100, R.figH / 2], 'sheet.top': [50, 0], 'sheet.bottom': [50, R.figH] });
    R.labels.forEach(lb => {
      const a = anchors[lb.on];
      if (!a) { sl.anchorErrors.push(lb.on); lb.e.style.visibility = 'hidden'; return; }
      const dx = lb.dx ?? 1.6, dy = lb.dy ?? -2.6, e = lb.e;
      e.style.left = pct(a[0] + dx, 100); e.style.top = pct(a[1] + dy, R.figH); e.style.transform = `translate(${dx < 0 ? '-100%' : '0'}, -50%)`; e.style.visibility = '';
      if (lb.color) e.style.color = col(pal, lb.color);
      if (Math.hypot(dx, dy) > 5) { const r = e.getBoundingClientRect(), f = R.fig.getBoundingClientRect(), mm = box.w / fw, cx = r.left + r.width / 2 - f.left, cy = r.top + r.height / 2 - f.top, ax = a[0] * fw / 100, ay = a[1] * fw / 100, t = Math.min(r.width / 2 / Math.abs(ax - cx || 1), r.height / 2 / Math.abs(ay - cy || 1), 1);
        K.leader(S, [box.x + (cx + (ax - cx) * t) * mm, box.y + (cy + (ay - cy) * t) * mm], [box.x + a[0] * unit, box.y + a[1] * unit], pal.soft); }
    });
  };

  // ---------- audits: what the eyes would otherwise have to catch ----------
  K.audit = function (sl, T) {
    const out = [], R = sl.r, sheet = R.sheet, s = sl.s, name = e => `"${(e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34)}"`;
    if (!sl.drawn) out.push('the sheet did not draw');
    if (sl.failed) out.push('drawing failed: ' + sl.failed);
    sheet.querySelectorAll('.katex-error').forEach(e => out.push(`formula error: ${e.title || e.textContent.slice(0, 40)}`));
    sheet.querySelectorAll('.iv.bad').forEach(e => out.push(`could not compute {{${e.dataset.x}}}`));
    (sl.anchorErrors || []).forEach(a => out.push(`a label names "${a}", which is not on this sheet (anchors: ${Object.keys(sl.anchors || {}).slice(0, 6).join(', ')}…)`));
    const box = e => T.rectIn(e, sheet), W = sheet.offsetWidth, H = sheet.offsetHeight, shown = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
    const texts = [...sheet.querySelectorAll('.lab, .ttl, .lead, .n p, .n h4, .tag, .tbl, .eq, .calc, .asm, .txt, .fsay, .tq, .tk, .axl, .cn')].filter(shown);
    for (const e of texts) {
      const b = box(e);
      if (b.x0 < 2 || b.y0 < 2 || b.x1 > W - 2 || b.y1 > H - 2) out.push(`${name(e)} runs off the sheet`);
      const leaf = e.matches('.tbl') ? e.querySelector('.c') : e;
      const fs = leaf ? parseFloat(getComputedStyle(leaf).fontSize) : 99;
      if (fs < 12) out.push(`${name(e)} renders at ${fs.toFixed(1)}px on screen (too small)`);
      if (e.scrollWidth > e.clientWidth + 3 && !e.matches('.tk, .axl, .lab')) out.push(`${name(e)} is wider than its box`);
    }
    if (R.fig) sheet.querySelectorAll('.tbl .c').forEach(c => { if (c.scrollWidth > c.clientWidth + 2) out.push(`table cell ${name(c)} is wider than its column`); });
    // labels against labels, and labels against the other text on the figure
    const ink = e => [...e.children].map(box).reduce((p, q) => ({ x0: Math.min(p.x0, q.x0), y0: Math.min(p.y0, q.y0), x1: Math.max(p.x1, q.x1), y1: Math.max(p.y1, q.y1) }));   // a worked line's box runs past its last line
    const labs = [...sheet.querySelectorAll('.ttl, .lead, .lab, .tbl, .eq, .calc, .asm, .txt, .fsay, .plot .tk, .plot .axl')].filter(shown).map(e => ({ e, b: e.matches('.calc, .asm') ? ink(e) : box(e) }));
    for (let i = 0; i < labs.length; i++) for (let j = i + 1; j < labs.length; j++) {
      const a = labs[i], b = labs[j]; const plot = a.e.closest('.plot'); if (plot && !a.e.matches('.lab') && !b.e.matches('.lab') && plot === b.e.closest('.plot')) continue;
      if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
      const ov = Math.max(0, Math.min(a.b.x1, b.b.x1) - Math.max(a.b.x0, b.b.x0) - 2) * Math.max(0, Math.min(a.b.y1, b.b.y1) - Math.max(a.b.y0, b.b.y0) - 2);
      if (ov > 30) out.push(`text overlaps: ${name(a.e)} × ${name(b.e)}`);
    }
    // labels and other text against the thread; the tag sits on it by design
    const k = 1 / T.mmPerPx(), line = (sl.threadPts || []).map(p => [p[0] * k, p[1] * k]);
    for (const e of [...texts].filter(e => !e.matches('.tag, .ttl, .tk'))) {
      const b = box(e); if (line.some(p => p[0] > b.x0 - 5 && p[0] < b.x1 + 5 && p[1] > b.y0 - 5 && p[1] < b.y1 + 5)) out.push(`${name(e)} sits on the thread (sheet ${sl.ctx.index + 1})`);
    }
    // data marks under a label
    const mm = 1 / T.mmPerPx();
    for (const e of sheet.querySelectorAll('.lab')) { if (!shown(e)) continue; const b = box(e); if ((sl.marks || []).some(p => p[0] * mm > b.x0 && p[0] * mm < b.x1 && p[1] * mm > b.y0 && p[1] * mm < b.y1)) out.push(`label ${name(e)} covers a data mark`); }
    if (R.fig && sl.S) {   // a figure with neither ink nor text is a drawing that came out empty
      const S = sl.S, f = T.rectIn(R.fig, sheet), m = T.mmPerPx() * S.ppm, b = S.base.rgb; let ink = 0;
      for (let y = Math.floor(f.y0 * m); y < f.y1 * m && y < S.H; y += 3) for (let x = Math.floor(f.x0 * m); x < f.x1 * m && x < S.W; x += 3) { const j = 3 * (y * S.W + x); if (S.rgb[j] !== b[j] || S.rgb[j + 1] !== b[j + 1] || S.rgb[j + 2] !== b[j + 2]) ink++; }
      if (!ink && !R.fig.textContent.trim()) out.push('the figure is blank');
    }
    if (R.fig && !s.tall) {
      const top = box(R.fig).y0, n = sheet.querySelector('.notes'), bot = n ? box(n).y1 : box(R.fig).y1, need = bot - top + 20;
      if (need > T.VIEW) out.push(`the figure and its notes need ${Math.round(need)}px, so they cannot be seen together at 1440×900: lower the figure, or set \`tall: true\` when it must be tall`);
    }
    if (!sl.twice && sl.S) {   // once per sheet: a fresh draw must give the same pixels
      sl.twice = true; const was = sl.hash, S = T.paintBase(sl); sl.S = S; T.paintFigures(sl, S);
      if (sl.hash !== was) out.push('the sheet draws differently on a second draw');
    }
    return [...new Set(out)];
  };
})();
