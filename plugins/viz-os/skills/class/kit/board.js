/* viz-os class: the board scene. One board grows click by click: a pinned table on the left, worked lines and
   pictures in the work area, the teacher's one line per click in a band at the foot. Items reveal by opacity
   (data-step), so the board never reflows as it grows and the deck's fit measures it once, full.
   The current item is orange (`now`), earlier ones turn grey (`past`). Attention goes by text colour on the thing itself:
   a worked line's terms take the deck's term colours on the symbol, on its number and on the table cell it came from,
   and `mark:` lights a table row, column, cell or item for one click. Nothing is drawn over the board; underlines stay
   for plain ==text== only. A scene that builds a formula gets a strip under both columns: its numbers row first,
   its symbols row (each term named) on the next click.
   A step with `think` takes two clicks: the question, then the answer (with whatever the step adds). */
(function () {
  'use strict';
  const L = window.VizOS, h = L.h;
  // ==text== is the deck's orange underline; ==s1:text== (s2, s3, good, bad) is bold text in that colour, no underline
  const md = s => L.md(s).replace(/<mark class="hi">(s1|s2|s3|good|bad|mist):/g, (_, c) => `<mark class="hi tc" style="--hc:var(--${c})">`);
  const SVG = 'http://www.w3.org/2000/svg';
  const sv = (tag, attrs, parent) => { const e = document.createElementNS(SVG, tag); for (const k in attrs || {}) if (attrs[k] != null) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const list = x => Array.isArray(x) ? x : x == null ? [] : [x];
  const COLOR = { accent: 1, tint: 1, s1: 1, s2: 1, s3: 1, ink: 1, mist: 1, haze: 1, line: 1, good: 1, bad: 1 };
  const col = c => COLOR[c] ? `var(--${c})` : c || 'var(--mist)';
  const BEAT = { 'by-hand': 'By hand', 'what-if': 'What if', misconception: 'A common mix-up' };
  const beatLabel = b => BEAT[b] || (b ? b[0].toUpperCase() + b.slice(1).replace(/-/g, ' ') : '');

  // ---------- worked lines: formula = numbers = result, each input in its colour ----------
  // A symbol's `color` wins; otherwise the table columns a line reads take s1, s2, s3 in order. The symbol, its number
  // and the table cell it came from are written in that colour while the line is the one being worked; once it is past,
  // the colour goes and the line turns grey. Restraint: colour the text, never box or underline it.
  const TERMC = ['s1', 's2', 's3'];
  const symOf = (ctx, n) => { const s = (ctx.symbols || {})[n]; return s && s.tex ? s.tex : L.autoSym(n); };
  const shortOf = (ctx, n) => { const s = (ctx.symbols || {})[n]; return (s && (s.short || s.says)) || n; };
  const subFmt = (ctx, n, v, own) => own ?? (((ctx.symbols || {})[n] || {}).fmt) ?? (Number.isInteger(v) ? ',' : 's4');   // as the deck's calc
  const scaleOf = e => e.getBoundingClientRect().width / (e.offsetWidth || 1) || 1;
  // every \htmlClass{lt lt-<name>} span of a part takes its colour (the CSS shows it on the current line only)
  const tint = (part, colorOf) => part.querySelectorAll('.lt').forEach(sp => {
    const c = colorOf([...sp.classList].find(x => x.startsWith('lt-')).slice(3)); if (c) { sp.classList.add('tc'); sp.style.setProperty('--tc', c); } });
  // names under the formula's symbols: centred on the symbol, sliding or dropping a row to clear each other
  function names(part, items) {
    part.style.paddingBottom = '';
    const base = part.getBoundingClientRect(), sc = scaleOf(part), top0 = (base.height / sc) + 14, placed = [];
    items.forEach(({ n, text }) => {
      const sp = part.querySelector(`.lt-${CSS.escape(n)}`); if (!sp) return; const r = sp.getBoundingClientRect(); if (!r.width) return;
      const lab = h('div', 'wl', L.esc(text)); part.appendChild(lab);
      const w = lab.offsetWidth, hh = lab.offsetHeight, cx = (r.left + r.width / 2 - base.left) / sc;
      // the first row where it fits, sliding right by up to a third of its width past the name before it
      let row = 0, x = cx;
      for (; row < 3; row++) { const prev = placed.filter(b => b.row === row).reduce((m, b) => Math.max(m, b.cx + b.w / 2 + 10), -1e9);
        if (prev <= cx - w / 2) { x = cx; break; } if (prev - (cx - w / 2) <= w / 3) { x = prev + w / 2; break; } }
      const y = top0 + row * (hh + 2), cxp = x; placed.push({ cx: cxp, w, row, bottom: y + hh });
      Object.assign(lab.style, { left: cxp + 'px', top: y + 'px' });
    });
    if (placed.length) part.style.paddingBottom = Math.max(...placed.map(b => b.bottom)) - base.height / sc + 4 + 'px';
  }

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

  function plane(p, ctx, clickOf, at) {
    const node = h('div', 'bi plane'); node.dataset.at = at; node.dataset.step = at;
    if (p.id) node.dataset.id = p.id;
    const leg = h('div', 'plegend'); node.appendChild(leg);
    const wrap = h('div', 'pwrap'); node.appendChild(wrap);
    const svg = sv('svg', { class: 'pl' }, wrap);
    const R = { node, issues: [] };
    const num = (x, where) => L.val(x, ctx.scope, where);
    R.layout = () => {
      svg.innerHTML = ''; leg.innerHTML = ''; R.issues = [];
      const W = wrap.clientWidth, H = wrap.clientHeight; if (W < 40 || H < 40) { R.issues.push('the picture has no room'); return; }
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const X = p.x || {}, Y = p.y || {}, box = [num(X.min ?? 0), num(X.max ?? 10), num(Y.min ?? 0), num(Y.max ?? 10)];
      const m = { l: 62, r: 18, t: 14, b: 60 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
      const u = Math.min(pw / (box[1] - box[0]), ph / (box[3] - box[2]));      // pixels per unit, the same on both axes
      const gw = u * (box[1] - box[0]), gh = u * (box[3] - box[2]), ox = m.l + (pw - gw) / 2, oy = m.t + (ph - gh) / 2;
      const sx = x => ox + (x - box[0]) * u, sy = y => oy + gh - (y - box[2]) * u;
      R.unit = [u, u];
      const grid = sv('g', { class: 'pgrid' }, svg);
      const tx = niceStep(box[1] - box[0]), ty = niceStep(box[3] - box[2]);
      for (let v = Math.ceil(box[0] / tx) * tx; v <= box[1] + 1e-9; v += tx) { sv('line', { x1: sx(v), x2: sx(v), y1: oy, y2: oy + gh }, grid); sv('text', { class: 'tick', x: sx(v), y: oy + gh + 26, 'text-anchor': 'middle' }, grid).textContent = L.fmt(+v.toFixed(6)); }
      for (let v = Math.ceil(box[2] / ty) * ty; v <= box[3] + 1e-9; v += ty) { sv('line', { x1: ox, x2: ox + gw, y1: sy(v), y2: sy(v) }, grid); sv('text', { class: 'tick', x: ox - 12, y: sy(v) + 7, 'text-anchor': 'end' }, grid).textContent = L.fmt(+v.toFixed(6)); }
      sv('rect', { class: 'pbox', x: ox, y: oy, width: gw, height: gh }, svg);
      if (X.label) sv('text', { class: 'axt', x: ox + gw / 2, y: oy + gh + 54, 'text-anchor': 'middle' }, svg).textContent = L.plain(X.label, ctx.scope);
      if (Y.label) sv('text', { class: 'axt', x: 0, y: 0, 'text-anchor': 'middle', transform: `translate(${ox - 44} ${oy + gh / 2}) rotate(-90)` }, svg).textContent = L.plain(Y.label, ctx.scope);
      const legend = [], dots = [], placed = [], segs = [], inBox = (x, y) => x >= box[0] - 1e-9 && x <= box[1] + 1e-9 && y >= box[2] - 1e-9 && y <= box[3] + 1e-9;
      const pt = (v, where) => list(v).map(x => num(x, where));
      // a name beside its dot: the first spot that clears every dot, line and name already placed; none clear is an issue
      const cross = (b, [X0, Y0, X1, Y1]) => { const n = Math.ceil(Math.hypot(X1 - X0, Y1 - Y0) / 4);
        for (let q = 0; q <= n; q++) { const x = X0 + (X1 - X0) * q / n, y = Y0 + (Y1 - Y0) * q / n; if (x > b.x0 - 3 && x < b.x1 + 3 && y > b.y0 - 3 && y < b.y1 + 3) return true; } return false; };
      const hit = b => placed.some(q => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0) || dots.some(([cx, cy, r = 11]) => cx + r > b.x0 && cx - r < b.x1 && cy + r > b.y0 && cy - r < b.y1) || segs.some(sg => cross(b, sg));
      const name = (t, cx, cy, g, cls, free) => { t = L.plain(String(t ?? ''), ctx.scope); if (!t) return; const tw = t.length * 10.5 + 4;
        const opts = [...(free ? [[-tw / 2, 6, 2]] : []), [14, -10, 0], [14, 24, 0], [-14, -10, 1], [-14, 24, 1], [-tw / 2, -18, 2], [-tw / 2, 36, 2], [27, -18, 0], [27, 32, 0], [-27, -18, 1], [-27, 32, 1], [-tw / 2, -30, 2], [-tw / 2, 48, 2]].map(([dx, dy, a]) => {
          const x0 = a === 1 ? cx + dx - tw : cx + dx; return { x0, x1: x0 + tw, y0: cy + dy - 16, y1: cy + dy + 3, a, dx, dy }; });
        let b = opts.find(o => !hit(o)); if (!b) { b = opts[0]; R.issues.push(`the plane label "${t}" overlaps another label or dot`); } placed.push(b);
        sv('text', { class: cls || 'plab', x: b.a === 1 ? cx + b.dx : b.x0, y: cy + b.dy, 'text-anchor': b.a === 1 ? 'end' : 'start' }, g).textContent = t; };
      const seg = (a, b, g, c, dash, w) => sv('line', { x1: sx(a[0]), y1: sy(a[1]), x2: sx(b[0]), y2: sy(b[1]), style: `stroke:${c};stroke-width:${w || (dash ? 3 : 4.5)}${dash ? ';stroke-dasharray:10 8' : ''}` }, g);
      const outside = (i, kind, ...ps) => { if (ps.some(([x, y]) => !inBox(x, y))) R.issues.push(`plane mark ${i + 1} (${kind}) is outside the box: widen x/y or move it`); };
      const key = (mk, c, kind, st) => { if (mk.label && !mk.name) legend.push({ text: mk.label, c, kind, st }); };
      // dots, named points and lines first, so every name placed after them clears them
      list(p.marks).forEach(mk => { const where = `slide ${ctx.index + 1} plane`; if (mk.when != null && !num(mk.when, where)) return;
        if (mk.points) list(L.val(mk.points.from, ctx.scope, where)).forEach(r => dots.push([sx(r[mk.points.x]), sy(r[mk.points.y])]));
        if (mk.point) { const [x, y] = pt(mk.point, where); dots.push([sx(x), sy(y)]); }
        if (mk.ring) { const [x, y] = pt(mk.ring, where); dots.push([sx(x), sy(y), 23]); }
        const L2 = mk.line ? clipLine(pt(mk.line, where), box) : mk.segment ? list(mk.segment).map(q => pt(q, where)) : null;
        if (L2) segs.push([sx(L2[0][0]), sy(L2[0][1]), sx(L2[1][0]), sy(L2[1][1])]);
        if (mk.square) { const [a, b] = list(mk.square).map(q => pt(q, where)), sg = mk.side === 'right' ? -1 : 1, dx = b[0] - a[0], dy = b[1] - a[1];
          const cs = [a, b, [b[0] - sg * dy, b[1] + sg * dx], [a[0] - sg * dy, a[1] + sg * dx]]; cs.forEach((q, j) => { const r = cs[(j + 1) % 4]; segs.push([sx(q[0]), sy(q[1]), sx(r[0]), sy(r[1])]); }); } });
      list(p.marks).forEach((mk, i) => {
        const where = `slide ${ctx.index + 1} plane mark ${i + 1}`;
        const g = sv('g', { class: 'pm' }, svg); const st = mk.step != null ? clickOf(mk.step) : at; if (st > at) g.dataset.step = st;
        const c = col(mk.color);
        if (mk.when != null && !num(mk.when, where)) return;
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
          rows.forEach(r => { const x = r[P.x], y = r[P.y], gk = P.by ? r[P.by] : null;
            if (!inBox(x, y)) R.issues.push(`point ${r[P.label] ?? ''} is outside the picture`);
            sv('circle', { cx: sx(x), cy: sy(y), r: 10, style: `fill:${col(colors[gk] && colors[gk].color || colors[gk] || mk.color || 's1')}` }, g); });
          if (P.label) rows.forEach(r => name(r[P.label], sx(r[P.x]), sy(r[P.y]), g));
          Object.entries(colors).forEach(([k, v]) => legend.push({ text: (v && v.label) || k, c: col(v && v.color || v), kind: 'dot', st }));
        } else if (mk.point) {
          const [x, y] = pt(mk.point, where); outside(i, 'point', [x, y]);
          sv('circle', { cx: sx(x), cy: sy(y), r: 10, style: `fill:${mk.color ? c : 'var(--s1)'}` }, g); name(mk.name, sx(x), sy(y), g); key(mk, c, 'dot', st);
        } else if (mk.segment) {
          const [a, b] = list(mk.segment).map(q => pt(q, where)); outside(i, 'segment', a, b);
          seg(a, b, g, c, mk.dash); if (mk.name) name(mk.name, sx((a[0] + b[0]) / 2), sy((a[1] + b[1]) / 2), g); key(mk, c, mk.dash ? 'dash' : 'line', st);
        } else if (mk.vector) {
          // an arrow from `from` (the origin by default) to from + vector, its head drawn in screen units
          const o = mk.from ? pt(mk.from, where) : [0, 0], v = pt(mk.vector, where), e = [o[0] + v[0], o[1] + v[1]]; outside(i, 'vector', o, e);
          const X0 = sx(o[0]), Y0 = sy(o[1]), X1 = sx(e[0]), Y1 = sy(e[1]), L0 = Math.hypot(X1 - X0, Y1 - Y0) || 1, ux = (X1 - X0) / L0, uy = (Y1 - Y0) / L0, hd = Math.min(18, L0 / 2);
          sv('line', { x1: X0, y1: Y0, x2: X1 - ux * hd * .8, y2: Y1 - uy * hd * .8, style: `stroke:${c};stroke-width:4.5` }, g);
          sv('polygon', { points: `${X1},${Y1} ${X1 - ux * hd - uy * hd * .55},${Y1 - uy * hd + ux * hd * .55} ${X1 - ux * hd + uy * hd * .55},${Y1 - uy * hd - ux * hd * .55}`, style: `fill:${c}` }, g);
          name(mk.name, X1, Y1, g); key(mk, c, 'line', st);
        } else if (mk.foot) {
          // the projection of a point onto a line (w0 + w1 x + w2 y = 0) or onto a direction through the origin: a dashed drop and a right-angle tick
          const F = mk.foot, q = pt(F.from, where); let f, d;
          if (F.line) { const w = pt(F.line, where), nn = w[1] * w[1] + w[2] * w[2], k = (w[0] + w[1] * q[0] + w[2] * q[1]) / nn; f = [q[0] - k * w[1], q[1] - k * w[2]]; d = [-w[2], w[1]]; }
          else { d = pt(F.dir, where); const dd = d[0] * d[0] + d[1] * d[1], k = (q[0] * d[0] + q[1] * d[1]) / dd; f = [k * d[0], k * d[1]]; }
          outside(i, 'foot', q, f);
          seg(q, f, g, c, true, 3); sv('circle', { cx: sx(f[0]), cy: sy(f[1]), r: 6, style: `fill:${c};stroke:none` }, g);
          const Ld = Math.hypot(d[0], -d[1]) || 1, ax = d[0] / Ld, ay = -d[1] / Ld, Lq = Math.hypot(sx(q[0]) - sx(f[0]), sy(q[1]) - sy(f[1]));
          if (Lq > 20) { const bx = (sx(q[0]) - sx(f[0])) / Lq, by = (sy(q[1]) - sy(f[1])) / Lq, r = 12, X = sx(f[0]), Y = sy(f[1]);
            sv('polyline', { points: `${X + ax * r},${Y + ay * r} ${X + ax * r + bx * r},${Y + ay * r + by * r} ${X + bx * r},${Y + by * r}`, style: `fill:none;stroke:${c};stroke-width:2.5` }, g); }
          name(mk.name, sx(f[0]), sy(f[1]), g); key(mk, c, 'dash', st);
        } else if (mk.square) {
          // the square built on a segment (a squared distance you can see), on its left unless side: right
          const [a, b] = list(mk.square).map(q => pt(q, where)), sgn = mk.side === 'right' ? -1 : 1, dx = b[0] - a[0], dy = b[1] - a[1];
          const cs = [a, b, [b[0] - sgn * dy, b[1] + sgn * dx], [a[0] - sgn * dy, a[1] + sgn * dx]]; outside(i, 'square', ...cs);
          sv('polygon', { points: cs.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' '), style: `fill:${c};fill-opacity:.16;stroke:${c};stroke-width:2.5` }, g); key(mk, c, 'area', st);
        } else if (mk.text) {
          const [x, y] = pt(mk.at, where); outside(i, 'text', [x, y]); name(mk.text, sx(x), sy(y), g, 'plab ink', true);   // a free label: centred on its point first
        } else if (mk.ring) {
          const [x, y] = pt(mk.ring, where);
          sv('circle', { class: 'pring', cx: sx(x), cy: sy(y), r: 20 }, g);
        }
      });
      leg.style.paddingLeft = `${Math.max(0, ox - 8)}px`;   // the legend starts where the plot does
      legend.forEach(e => { const it = h('span', 'pk ' + e.kind); it.style.setProperty('--c', e.c); it.innerHTML = `<i></i>${md(e.text)}`; if (e.st > at) it.dataset.step = e.st; leg.appendChild(it); });
      L.fill(leg, ctx.scope);
    };
    return R;
  }

  // ---------- the board ----------
  L.types.board = (s, ctx) => {
    const node = h('section', 'slide s-board'); node.appendChild(L.head(s, beatLabel(s.beat)));
    const steps = list(s.steps);
    // each step's clicks: a think step asks on one click (q) and answers on the next (at)
    let n = 0; const map = steps.map(st => st && st.think ? { q: ++n, at: ++n } : { at: ++n });
    const clickOf = j => (map[Math.max(1, Math.min(steps.length, j)) - 1] || { at: 1 }).at;
    const firstOf = j => { const m = map[Math.max(1, Math.min(steps.length, j)) - 1] || { at: 1 }; return m.q || m.at; };
    const strip = steps.some(st => list(st && st.add).some(it => it && it.assemble));
    // the strip sits under the work it sums up, or on top when the scene opens with it (its later lines then read below it)
    const first = steps.flatMap(st => list(st && st.add)).find(it => it && typeof it === 'object'), top = strip && !!(first && first.assemble);
    const root = h('div', 'body board' + (s.table ? '' : ' no-table') + (strip ? ' has-strip' : '') + (top ? ' strip-top' : '')); node.appendChild(root);
    const zl = s.table ? h('div', 'zone zl') : null, zt = s.table ? h('div', 'tcard g plate enter') : null;   // the left column: the table, then side notes
    if (zl) { zl.appendChild(zt); root.appendChild(zl); }
    const zw = h('div', 'zone zw'); root.appendChild(zw);
    const wtext = h('div', 'wcol wtext'), wpic = h('div', 'wcol wpic');
    const zf = strip ? h('div', 'zone zf') : null; if (zf) root.appendChild(zf);   // the formula strip, full width
    const zs = h('div', 'zone zs g'); root.appendChild(zs);

    // the teacher band: one line per click
    steps.forEach((st, j) => {
      if (!st) return; const c = map[j];
      const line = (k, html, cls) => { const e = h('div', 'tline ' + (cls || ''), html); e.dataset.only = k; zs.appendChild(e); };
      if (st.think) {
        const t = typeof st.think === 'string' ? { q: st.think } : st.think;
        line(c.q, `${st.say ? `<span class="tsay">${md(st.say)}</span> ` : ''}<span class="btag">Pause · think</span><span>${md(t.q || '')}</span>`, 'ask');
        line(c.at, `<span class="btag so">So</span><span>${md(t.a || '')}</span>`, 'ans');
      } else line(c.at, `<span>${md(st.say || '')}</span>`);
    });

    // items, in reading order: worked lines, formulas, notes, comparisons and matrix steps in the text column; pictures
    // (planes, charts, images) in the picture column; an assembled formula in the strip under both
    const lines = [], planes = [], cols = [], vis = [], asm = [], opsl = [];
    const VIS = ['chart', 'image', 'dist', 'stat', 'units', 'parts', 'flow'];
    const tag = (e, at, id, until) => { e.dataset.at = e.dataset.step = at; if (until > at) e.dataset.until = until; if (id) e.dataset.id = id; return e; };
    // a chart mark's or an image label's `step` counts board steps, as everywhere on the board; the kit counts clicks
    const clicks = v => { const c = JSON.parse(JSON.stringify(v)), m = o => { if (o && o.step != null) o.step = clickOf(o.step); };
      if (c.chart) { list(c.chart.series).forEach(m); list(c.chart.marks).forEach(m); } list(c.labels).forEach(m); return c; };
    const visual = v => { const V = L.visual(clicks(v), ctx); vis.push(V); return V.node; };
    steps.forEach((st, j) => list(st && st.add).forEach(it => {
      const at = map[j].at, next = map[j + 1] ? (map[j + 1].q || map[j + 1].at) : at;
      if (it.calc) { const row = tag(h('div', 'cline bi'), at, it.calc.id);
        row.innerHTML = `<div class="num">${lines.filter(x => x.c).length + 1}</div><div class="say">${md(it.calc.say || '')}${it.calc.why ? `<span class="cwhy">${md(it.calc.why)}</span>` : ''}</div><div class="math"></div>`;
        lines.push({ c: it.calc, at, row, el: row }); }
      else if (it.eqn) { const e = tag(h('div', 'fline bi'), at, it.eqn.id);
        e.innerHTML = `${it.eqn.say ? `<div class="say">${md(it.eqn.say)}</div>` : ''}<div class="math"></div>`; lines.push({ f: it.eqn, at, el: e }); }
      // the formula built from our numbers (R4): the numbers row on this click, the symbols row and the names on the next
      else if (it.assemble) { const a = it.assemble, e = tag(h('div', 'asm bi g'), at, a.id, next);
        e.innerHTML = `${a.say ? `<div class="say">${md(a.say)}</div>` : ''}<div class="arow nums"><span class="atag">Our numbers</span><div class="math"></div></div>` +
          `<div class="arow syms" data-step="${next}"><span class="atag">In symbols</span><div class="math"></div></div>`;
        asm.push({ a, e }); }
      else if (it.plane) planes.push(plane(it.plane, ctx, clickOf, at));
      else if (VIS.some(k => it[k] != null)) { const { id, ...v } = it, e = tag(h('div', 'bi bvis'), at, id); e.appendChild(visual(v)); planes.push({ node: e, issues: [] }); }
      else if (it.col) cols.push({ ...it.col, at });
      else if (it.params) { const pr = it.params, e = tag(h('div', 'bi params g'), at, pr.id);
        e.innerHTML = (pr.say ? `<div class="ph">${md(pr.say)}</div>` : '') + list(pr.names).map(n => `<div class="pr" data-n="${L.esc(n)}"><span class="ps"></span><b class="pv"></b><span class="pn">${md(shortOf(ctx, n))}</span></div>`).join('');
        lines.push({ params: e, at, el: e, side: !!pr.side && !!zl }); }
      else if (it.compare) { const cp = it.compare, e = tag(h('div', 'bcmp bi'), at, cp.id);
        ['a', 'b'].forEach(k => { const x = cp[k] || {}, side = h('div', 'side g');
          side.innerHTML = `${x.tone ? `<div class="tone ${x.tone}"><i>${x.tone === 'good' ? '✓' : '✗'}</i>${md(x.verdict || (x.tone === 'good' ? 'works' : 'fails'))}</div>` : ''}<h3>${md(x.title || '')}</h3>${x.text ? `<div class="p">${md(x.text)}</div>` : ''}`;
          if (x.visual) side.appendChild(visual(x.visual));
          e.appendChild(side); });
        lines.push({ el: e, at }); }
      // a matrix step from the deck's ops renderer: its own steps land on this click and the next ones, one per click
      else if (it.ops) { const O = L.types.ops({ ...it.ops, title: '' }, ctx), T = O.steps - 1, clk = t => clickOf(j + 1 + t);
        const e = tag(h('div', 'bops bi'), at, it.ops.id, clk(T)); e.appendChild(O.node.querySelector('.body'));
        opsl.push({ O, k: k => 1 + Array.from({ length: T }, (_, t) => clk(t + 1)).filter(c => c <= k).length }); lines.push({ el: e, at }); }
      else if (it.note != null) { const nt = typeof it.note === 'string' ? { text: it.note } : it.note;
        const e = tag(h('div', 'bi note g', md(nt.text || '')), at, nt.id); lines.push({ note: e, at, el: e, side: !!nt.side && !!zl }); }
    }));
    const tcols = s.table ? list(s.table.cols).map(c => typeof c === 'string' ? { key: c } : c).concat(cols) : [];
    const tkeys = new Set(tcols.map(c => c.key));
    const rowsOf = () => s.table ? list(L.val(s.table.from, ctx.scope, `slide ${ctx.index + 1} table.from`)) : [];
    const symColor = n => { const c = ((ctx.symbols || {})[n] || {}).color; return c ? col(c) : null; };
    const kindOf = n => ((ctx.symbols || {})[n] || {}).kind;
    // a value data.json (or the top-level derive) already holds must come out the same on the board (KTD21)
    const given = Object.getPrototypeOf(ctx.scope) || {}, clash = [];
    const store = (n, v) => { if (!n) return; ctx.scope[n] = v;
      if (typeof given[n] === 'number' && typeof v === 'number' && Math.abs(given[n] - v) > 1e-9 * Math.max(1, Math.abs(v)))
        clash.push(`\`${n}\` works out to ${L.fmt(v, 's4')} on the board but the data says ${L.fmt(given[n], 's4')}: make_data.py and the page disagree`); };
    // each worked line's numbers, in order, so a later line (and the first {{}} fill) can read an earlier result
    const work = () => {
      const rows = rowsOf(); clash.length = 0;
      lines.forEach(ln => { if (!ln.c) return; const c = ln.c, where = `slide ${ctx.index + 1} board line`;
        ln.sc = c.row != null && rows[c.row] ? L.scope(ctx.scope, rows[c.row]) : ctx.scope;
        ln.val = c.expr ? L.try(c.expr, ln.sc, where) : null; store(c.name, ln.val);
        const fromTable = L.names(c.expr || '').filter(n => c.row != null && tkeys.has(n) && !symColor(n));
        ln.color = n => n === c.name ? null : symColor(n) || (fromTable.includes(n) ? col(TERMC[Math.min(2, fromTable.indexOf(n))]) : null);
        ln.reads = L.names(c.expr || '').filter(n => c.row != null && tkeys.has(n));
      });
    };
    work();
    // a formula from an expression or from TeX with [name] terms, each input's symbol wrapped for its colour and name
    const sym = n => symOf(ctx, n), lt = (n, tx) => `\\htmlClass{lt lt-${n}}{${tx}}`;
    const formTex = f => {
      // only the author's own tex is read for {{…}}: kit-made TeX can hold {{ (a wrapped {x}_{3}) that is not a number
      const ids = [], body = f.expr ? L.tex(f.expr, { sym, wrap: lt }) : L.interp(String(f.tex || ''), ctx.scope, true).replace(/\[([A-Za-z_]\w*)\]/g, (_, n) => { if (!ids.includes(n)) ids.push(n); return lt(n, sym(n)); });
      if (f.expr) ids.push(...L.names(f.expr));
      return { tex: f.lhs ? `${lt(f.lhs, sym(f.lhs))} = ${body}` : body, ids: ids.filter(n => n !== f.lhs) };
    };
    // a symbol's own colour wins; the other inputs take s1, s2, s3 in reading order; the result and indices stay ink
    const termColor = ids => { const free = ids.filter(n => !symColor(n) && !kindOf(n)); return n => symColor(n) || (free.indexOf(n) >= 0 && free.indexOf(n) < 3 ? col(TERMC[free.indexOf(n)]) : null); };
    const termNames = (ids, skip) => ids.filter(n => !kindOf(n) && !(skip && skip.has(n))).map(n => { if (skip) skip.add(n); return { n, text: L.plain(shortOf(ctx, n), ctx.scope) }; });
    const drawAsm = () => asm.forEach(A => {
      const a = A.a, [nm, sy] = A.e.querySelectorAll('.math'), { tex, ids } = formTex(a), colorOf = termColor(ids);
      let nums;
      if (a.expr) { const v = L.try(a.expr, ctx.scope, `slide ${ctx.index + 1} assemble`); store(a.lhs, v);
        const { tex: sub, eq } = L.work(a.expr, { slash: true, val: n => typeof ctx.scope[n] === 'number' ? ctx.scope[n] : null, arr: n => Array.isArray(ctx.scope[n]) ? ctx.scope[n] : null, wrap: lt, fmt: a.fmt, lit: null, fmtOf: (n, x) => subFmt(ctx, n, x) }, v, a.fmt, ctx.scope);
        nums = `${sub} ${eq} \\htmlClass{res}{${L.numTex(v, a.fmt)}}`; }
      else nums = L.interp(String(a.plug || ''), ctx.scope, true).replace(/\[([A-Za-z_]\w*):([^\]]*)\]/g, (_, n, x) => n === a.lhs ? `\\htmlClass{res}{${x}}` : lt(n, x)).replace(/\[([A-Za-z_]\w*)\]/g, (_, n) => lt(n, sym(n)));
      L.renderTex(nm, nums, false); L.renderTex(sy, tex, false); tint(nm, colorOf); tint(sy, colorOf);
      A.label = termNames(ids);   // every term gets its plain name here (R4), even one named earlier in the scene
    });
    // write each worked line: symbol = formula, = numbers, = result (stacked at the = signs when too long for a row)
    const drawLines = () => {
      work();
      const named = new Set(), shownFmt = {};
      lines.forEach(ln => {
        if (ln.f) { const m = ln.el.querySelector('.math'), { tex, ids } = formTex(ln.f); L.renderTex(m, tex, false); tint(m, termColor(ids)); ln.label = termNames(ids, named); return; }
        if (!ln.c) return; const c = ln.c, math = ln.row.querySelector('.math'); math.innerHTML = ''; math.classList.remove('wrapped');
        if (!c.expr) return;
        const f = L.tex(c.expr, { sym, wrap: (n, tx) => lt(n, tx) });
        const { tex: sub, eq } = L.work(c.expr, { slash: true, val: n => typeof ln.sc[n] === 'number' ? ln.sc[n] : null, arr: n => Array.isArray(ln.sc[n]) ? ln.sc[n] : null, wrap: (n, tx) => lt(n, tx),
          fmt: c.fmt, lit: null, fmtOf: (n, x) => subFmt(ctx, n, x, shownFmt[n]) }, ln.val, c.fmt, ln.sc);
        const parts = [[c.name ? `${sym(c.name)} = ${f}` : f, 'f'], [`= ${sub}`, 'sub'], [`${eq} \\htmlClass{res}{${L.numTex(ln.val, c.fmt)}}`, 'r']];
        parts.forEach(([tx, cls]) => { const sp = h('span', 'part ' + cls); math.appendChild(sp); L.renderTex(sp, tx, false); });
        const ps = [...math.children]; ps.slice(0, 2).forEach(p => tint(p, ln.color)); if (ps.some((e, q) => q && e.offsetTop >= ps[q - 1].offsetTop + ps[q - 1].offsetHeight - 2)) math.classList.add('wrapped');
        if (c.name) shownFmt[c.name] = c.fmt;
        ln.label = L.names(c.expr).filter(n => !named.has(n) && n !== c.name).map(n => { named.add(n); return { n, text: L.plain(shortOf(ctx, n), ctx.scope) }; });
      });
      requestAnimationFrame(() => {
        lines.forEach(ln => { const f = ln.c ? ln.c.expr && ln.row.querySelector('.part.f') : ln.f && ln.el.querySelector('.math'); if (f) names(f, ln.label || []); });
        asm.forEach(A => names(A.e.querySelector('.syms .math'), A.label || [])); });
    };
    lines.forEach(ln => (ln.side ? zl : wtext).appendChild(ln.el));
    asm.forEach(A => zf.appendChild(A.e));
    // a parameter card: each named number with its symbol in its colour, its value now and its name (it follows the sliders)
    const drawParams = () => lines.forEach(ln => ln.params && ln.params.querySelectorAll('.pr').forEach(r => { const n = r.dataset.n, v = ctx.scope[n];
      r.style.setProperty('--tc', symColor(n) || 'var(--ink)'); L.renderTex(r.querySelector('.ps'), symOf(ctx, n), false);
      r.querySelector('.pv').textContent = typeof v === 'number' ? L.fmt(v, ((ctx.symbols || {})[n] || {}).fmt ?? 's4') : '?'; }));
    planes.forEach(P => wpic.appendChild(P.node));
    // controls, registered in ctx.ctl so the check moves each to both ends (lesson.py writes a run or a toggle as a plain
    // slider first): a slider; a run (frames 0..n-1: a scrubber, the frame count and a play button that is off until
    // pressed and never runs under ?check); a toggle (two buttons, 0 and 1)
    const CHECK = new URLSearchParams(location.search).has('check');
    let run = null;
    if ((s.controls || []).length) {
      const box = h('div', 'controls');
      s.controls.forEach(c => {
        const id = `ctl-${ctx.index}-${c.name}`, v0 = c.value ?? c.min;
        let w, set;
        if (c.toggle) {
          w = h('div', 'ctl g pill thin tog');
          w.innerHTML = `<label>${md(c.label || c.name)}</label><div class="seg2">${c.toggle.map((t, q) => `<button type="button" data-v="${q}">${md(t)}</button>`).join('')}</div>`;
          const bs = [...w.querySelectorAll('button')];
          set = v => { ctx.scope[c.name] = +v; bs.forEach(b => b.classList.toggle('on', +b.dataset.v === +v)); };
          bs.forEach(b => { b.addEventListener('click', e => { e.stopPropagation(); set(b.dataset.v); ctx.refresh(); }); b.addEventListener('pointerdown', e => e.stopPropagation()); });
        } else {
          const n = c.run || 0;
          w = h('div', 'ctl g pill thin' + (n ? ' run' : ''));
          w.innerHTML = `${n ? '<button type="button" class="play" aria-label="play"></button>' : ''}<label for="${id}">${md(c.label || c.name)}</label><input id="${id}" type="range" min="${c.min}" max="${c.max}" step="${c.step ?? (c.max - c.min) / 100}" value="${v0}"><output></output>`;
          const inp = w.querySelector('input'), out = w.querySelector('output');
          set = v => { ctx.scope[c.name] = +v; inp.value = v; out.textContent = n ? `${+v} / ${n - 1}` : L.fmt(+v, c.fmt); inp.style.setProperty('--fill', ((v - c.min) / (c.max - c.min) * 100) + '%'); };
          inp.addEventListener('input', () => { stop(); set(inp.value); ctx.refresh(); });
          inp.addEventListener('pointerdown', e => e.stopPropagation());
          if (n) {
            const btn = w.querySelector('.play');
            const stop = () => { if (run.timer) { clearInterval(run.timer); run.timer = null; btn.classList.remove('on'); } };
            run = { c, n, stop, timer: null };
            btn.addEventListener('pointerdown', e => e.stopPropagation());
            btn.addEventListener('click', e => { e.stopPropagation(); if (run.timer) return stop(); if (CHECK) return;
              if (ctx.scope[c.name] >= n - 1) { set(0); ctx.refresh(); }
              btn.classList.add('on');
              run.timer = setInterval(() => { if (L.slides[L.i] && L.slides[L.i].ctx !== ctx) return stop();
                const f = ctx.scope[c.name] + 1; set(f); ctx.refresh(); if (f >= n - 1) stop(); }, 1000 * (c.every || 1.3)); });
          }
        }
        set(v0);
        ctx.ctl[c.name] = v => { set(v); ctx.refresh(); };
        if (c.step_at != null) w.dataset.step = firstOf(c.step_at);   // a control a question asks you to use shows with the question
        box.appendChild(w);
      });
      (wtext.children.length || !planes.length ? wtext : wpic).appendChild(box);
    }
    function stop() { if (run) run.stop(); }
    // the frame each click shows: the latest step's `frame:` at or before it, else the run's stops in click order
    const framed = steps.some(st => st && st.frame != null), stops = run ? list(run.c.stops) : [];
    const frameAt = k => { if (!run) return null; let f = framed ? (run.c.value ?? 0) : null;
      steps.forEach((st, j) => { if (map[j].at > k && (map[j].q || map[j].at) > k) return;
        if (framed) { if (st && st.frame != null) f = st.frame; } else f = stops[Math.min(j, stops.length - 1)]; });
      return f ?? stops[0] ?? 0; };
    if (wtext.children.length) zw.appendChild(wtext);
    if (wpic.children.length) zw.appendChild(wpic);
    zw.classList.toggle('two', wtext.children.length > 0 && wpic.children.length > 0);

    // the pinned table: the given columns, plus any column a step adds (it takes its space from the start)
    const drawTable = () => {
      if (!zt) return;
      const rows = rowsOf();
      const cell = (c, r) => { let v = r[c.key]; if (c.expr) v = L.try(c.expr, L.scope(ctx.scope, r), `slide ${ctx.index + 1} column ${c.key}`); return typeof v === 'number' ? L.fmt(v, c.fmt) : md(v); };
      const stp = c => c.at ? ` data-step="${c.at}" data-at="${c.at}"` : '';
      zt.innerHTML = `<table class="t"><thead><tr>${tcols.map(c => `<th class="${c.expr ? 'der bi' : ''}" data-col="${L.esc(c.key)}"${stp(c)}>${md(c.label || c.key)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r, i) => `<tr data-r="${i}">${tcols.map(c => `<td class="${c.expr ? 'der bi' : ''}" data-r="${i}" data-col="${L.esc(c.key)}"${stp(c)}>${cell(c, r)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    };

    // highlights for the current click, on the things themselves: the row a worked line reads (its cells in the line's
    // colours), and any `mark:` (row:i, col:key, cell:i:key, #id). A target not on the board yet is left alone.
    const marksAt = k => { const out = []; steps.forEach((st, j) => { if (st && (map[j].at === k || map[j].q === k)) list(st.mark).forEach(m => out.push(String(m))); }); return out; };
    const targetOf = t => {
      let m;
      if ((m = /^row:(\d+)$/.exec(t)) && zt) return { els: [...zt.querySelectorAll(`tbody tr[data-r="${m[1]}"]`)], cls: 'wrow' };
      if ((m = /^col:(.+)$/.exec(t)) && zt) return { els: [...zt.querySelectorAll(`[data-col="${CSS.escape(m[1])}"]`)], cls: 'hcol' };
      if ((m = /^cell:(\d+):(.+)$/.exec(t)) && zt) return { els: [...zt.querySelectorAll(`td[data-r="${m[1]}"][data-col="${CSS.escape(m[2])}"]`)], cls: 'src' };
      if ((m = /^#(.+)$/.exec(t))) return { els: [...root.querySelectorAll(`[data-id="${CSS.escape(m[1])}"]`)], cls: 'hl' };
      return { els: [], cls: '' };
    };
    let missing = [];
    const light = k => {
      root.querySelectorAll('.wrow, .hcol, .src, .hl').forEach(e => { e.classList.remove('wrow', 'hcol', 'src', 'hl'); e.style.removeProperty('--tc'); });
      missing = [];
      const up = e => !e.dataset.step || +e.dataset.step <= k;
      lines.forEach(ln => { if (!ln.c || ln.at !== k || ln.c.row == null || !zt) return;
        zt.querySelector(`tbody tr[data-r="${ln.c.row}"]`)?.classList.add('wrow');
        ln.reads.forEach(n => { const td = zt.querySelector(`td[data-r="${ln.c.row}"][data-col="${CSS.escape(n)}"]`), c = ln.color(n);
          if (td && c && up(td)) { td.classList.add('src'); td.style.setProperty('--tc', c); } }); });
      marksAt(k).forEach(t => { const { els, cls } = targetOf(t); if (!els.length) { missing.push(t); return; }
        els.filter(up).forEach(e => { e.classList.add(cls); if (cls === 'src') e.style.setProperty('--tc', 'var(--accent)'); }); });
    };

    let tableBox = null, redraw = false;
    const R = {
      node, steps: n,
      layout: () => { redraw = true; drawTable(); drawLines(); drawAsm(); drawParams(); planes.forEach(P => P.layout && P.layout()); vis.forEach(V => V.layout()); opsl.forEach(o => o.O.layout()); },
      show: k => {
        // a click puts the run on that click's frame; a redraw (a slider moved, a refit) leaves the frame where it is
        if (run && !redraw) { stop(); const f = frameAt(k); if (f != null && f !== ctx.scope[run.c.name]) { ctx.ctl[run.c.name](f); return; } }
        redraw = false;
        root.querySelectorAll('[data-step]').forEach(e => e.classList.toggle('shown', +e.dataset.step <= k));   // redrawn parts need it again
        root.querySelectorAll('[data-only]').forEach(e => e.classList.toggle('shown', +e.dataset.only === k));
        root.querySelectorAll('.bi').forEach(e => { const a = +e.dataset.at, u = +(e.dataset.until || a); e.classList.toggle('now', a <= k && k <= u); e.classList.toggle('past', u < k); });
        vis.forEach(V => V.show(k)); opsl.forEach(o => o.O.show(o.k(k)));
        light(k);
      },
      audit: () => {
        const out = [], sc = scaleOf(root);
        if (zt) { const r = zt.getBoundingClientRect(), b = { x0: r.left / sc, y0: r.top / sc, x1: r.right / sc, y1: r.bottom / sc };
          if (!tableBox) tableBox = b; else if (['x0', 'y0', 'x1', 'y1'].some(q => Math.abs(b[q] - tableBox[q]) > 1.5)) out.push('the pinned table moved between steps (keep its rows and widths fixed)'); }
        // measured without the 8px rise of items still to come, which is not overflow
        root.classList.add('fitting');
        [[zl, 'table column'], [zw, 'work area'], [zs, 'teacher band']].forEach(([z, nm]) => { if (z && (z.scrollHeight > z.clientHeight + 3 || z.scrollWidth > z.clientWidth + 3)) out.push(`the ${nm} overflows: split the scene or cut an item`); });
        root.querySelectorAll('.wcol').forEach(w => { if (w.scrollHeight > w.clientHeight + 3) out.push('the work area overflows: split the scene or cut an item'); });
        root.classList.remove('fitting');
        missing.forEach(t => out.push(`mark target not found: ${t}`));
        root.querySelectorAll('.approx').length && out.push('a worked line does not add up by hand at the rounding shown (it reads ≈): give its inputs a finer fmt');
        planes.forEach(P => out.push(...P.issues));
        vis.forEach(V => out.push(...V.audit())); opsl.forEach(o => out.push(...o.O.audit()));
        root.querySelectorAll('.fline .math, .asm .math').forEach(m => { const kx = m.querySelector('.katex'); if (kx && kx.scrollWidth > m.clientWidth + 4) out.push('a formula is wider than its box: shorten it or split the line'); });
        out.push(...clash);
        const sl = L.slides[ctx.index]; if (sl && sl.zoom && sl.zoom < .8) out.push(`the board is too full for one scene (shrunk to ${Math.round(sl.zoom * 100)}%): split it into two scenes`);
        return out;
      },
    };
    return R;
  };
})();
