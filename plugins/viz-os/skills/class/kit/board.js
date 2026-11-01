/* viz-os class: the board scene, on a page that scrolls. A scene is written top to bottom and stays written, the way a
   teacher fills a tablet page: each step is its teacher line and what it adds, and nothing is hidden behind a click.
   A table is pinned beside the work; its derived columns fill in as the reading line reaches the step that adds them, and
   the row in use is lit. A picture sits beside the lines that talk about it and stays in view while they scroll past.
   Every figure owns its shape: a plane's comes from its axis ranges (one scale for both axes), a chart's from its `ratio`,
   an image's from the image. The layout gives each a width and a height limit, never a box to fill.
   Next and Back appear only on a figure that really changes: marks that come in on a step, a run's frames, a matrix step.
   A step with `think` shows its question with a Show answer button. The answer takes no room until pressed: the card grows
   and its top stays. What the step adds waits behind the answer, in its own space. Attention goes by text colour on the thing itself: a worked line's terms take the
   deck's term colours on the symbol, on its number and on the table cell it came from. */
(function () {
  'use strict';
  const L = window.VizOS, h = L.h;
  // ==text== is the deck's orange underline; ==s1:text== (s2, s3, good, bad) is bold text in that colour, no underline
  const md = s => L.md(s).replace(/<mark class="hi">(accent|s1|s2|s3|good|bad|mist):/g, (_, c) => `<mark class="hi tc" style="--hc:var(--${c})">`);
  const SVG = 'http://www.w3.org/2000/svg';
  // what follows the window on every board: a held figure lets go, and the line by the buttons steps aside
  let watching = false;
  addEventListener('scroll', () => { if (watching) return; watching = true; requestAnimationFrame(() => { watching = false; (L.slides || []).forEach(sl => sl.r.watch && sl.r.watch()); }); }, { passive: true });
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
  // every \htmlClass{lt lt-<name>} span of a part takes its colour
  const tint = (part, colorOf) => part.querySelectorAll('.lt').forEach(sp => {
    const c = colorOf([...sp.classList].find(x => x.startsWith('lt-')).slice(3)); if (c) { sp.classList.add('tc'); sp.style.setProperty('--tc', c); } });
  // names under the formula's symbols: centred on the symbol, sliding or dropping a row to clear each other
  function names(part, items) {
    part.style.paddingBottom = '';
    part.querySelectorAll(':scope > .wl').forEach(e => e.remove());
    const base = part.getBoundingClientRect(), top0 = base.height + 14, placed = [], edge = part.closest('.slide').getBoundingClientRect().right - base.left;   // a name stays on the page
    items.forEach(({ n, text }) => {
      const sp = part.querySelector(`.lt-${CSS.escape(n)}`); if (!sp) return; const r = sp.getBoundingClientRect(); if (!r.width) return;
      const lab = h('div', 'wl', L.esc(text)); part.appendChild(lab);
      const w = lab.offsetWidth, hh = lab.offsetHeight, cx = r.left + r.width / 2 - base.left;
      // the first row where it fits, sliding right by up to a third of its width past the name before it
      let row = 0, x = cx;
      for (; row < 3; row++) { const prev = placed.filter(b => b.row === row).reduce((m, b) => Math.max(m, b.cx + b.w / 2 + 10), -1e9);
        if (prev <= cx - w / 2) { x = cx; break; } if (prev - (cx - w / 2) <= w / 3) { x = prev + w / 2; break; } }
      const y = top0 + row * (hh + 2), cxp = Math.min(x, edge - w / 2); placed.push({ cx: cxp, w, row, bottom: y + hh });
      Object.assign(lab.style, { left: cxp + 'px', top: y + 'px' });
    });
    if (placed.length) part.style.paddingBottom = Math.max(...placed.map(b => b.bottom)) - base.height + 4 + 'px';
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
    const node = h('div', p.fill ? 'bi plane fr fill' : 'bi plane fr'); node.dataset.at = at;
    if (p.id) node.dataset.id = p.id;
    const leg = h('div', 'plegend'); node.appendChild(leg);
    const wrap = h('div', 'pwrap'); node.appendChild(wrap);
    const svg = sv('svg', { class: 'pl' }, wrap);
    const R = { node, issues: [], kind: 'plane', w: 0, h: 0, leg: LEG, view: null };
    const num = (x, where) => L.val(x, ctx.scope, where);
    const m = { l: 62, r: 18, t: 14, b: 60 }, boxOf = () => { const X = p.x || {}, Y = p.y || {}; return [num(X.min ?? 0), num(X.max ?? 10), num(Y.min ?? 0), num(Y.max ?? 10)]; };
    // the picture takes its room. An equal plane keeps one scale on both axes and shows more of the plane on both sides, so the
    // data stay at true scale in any shape. With `fill` the plot holds 16:9, going to 2:1 if the window is short, each axis at its own scale
    R.size = room => { const b = boxOf(), ah = room.h - PAD - R.leg, aw = aim(room, ah) - PAD, hh = Math.min(ah, aw / SHAPE), ww = p.fill ? Math.min(aw, hh * WIDEST) : aw;
      R.w = Math.round(ww); R.h = Math.round(hh); node.style.width = R.w + 'px'; wrap.style.width = R.w + 'px'; wrap.style.height = R.h + 'px';
      const gw = R.w - m.l - m.r, gh = R.h - m.t - m.b, xs = b[1] - b[0], ys = b[3] - b[2], u = Math.min(gw / xs, gh / ys), cx = (b[0] + b[1]) / 2, cy = (b[2] + b[3]) / 2;
      R.view = p.fill ? b : [cx - gw / u / 2, cx + gw / u / 2, cy - gh / u / 2, cy + gh / u / 2]; return R.w + PAD; };
    R.layout = () => {
      svg.innerHTML = ''; leg.innerHTML = ''; R.issues = [];
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
      const legend = [], dots = [], placed = [], segs = [], inBox = (x, y) => x >= own[0] - 1e-9 && x <= own[1] + 1e-9 && y >= own[2] - 1e-9 && y <= own[3] + 1e-9;
      const pt = (v, where) => list(v).map(x => num(x, where));
      // a name beside its dot: the first spot that clears every dot, line and name already placed; none clear is an issue
      const cross = (b, [X0, Y0, X1, Y1]) => { const n = Math.ceil(Math.hypot(X1 - X0, Y1 - Y0) / 4);
        for (let q = 0; q <= n; q++) { const x = X0 + (X1 - X0) * q / n, y = Y0 + (Y1 - Y0) * q / n; if (x > b.x0 - 3 && x < b.x1 + 3 && y > b.y0 - 3 && y < b.y1 + 3) return true; } return false; };
      const hit = b => placed.some(q => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0) || dots.some(([cx, cy, r = 11]) => cx + r > b.x0 && cx - r < b.x1 && cy + r > b.y0 && cy - r < b.y1) || segs.some(sg => cross(b, sg));
      const name = (t, cx, cy, g, cls, free) => { t = L.plain(String(t ?? ''), ctx.scope); if (!t) return; const tw = t.length * 13 + 4;
        const opts = [...(free ? [[-tw / 2, 6, 2]] : []), [14, -10, 0], [14, 24, 0], [-14, -10, 1], [-14, 24, 1], [-tw / 2, -18, 2], [-tw / 2, 36, 2], [27, -18, 0], [27, 32, 0], [-27, -18, 1], [-27, 32, 1], [-tw / 2, -30, 2], [-tw / 2, 48, 2]].map(([dx, dy, a]) => {
          const x0 = a === 1 ? cx + dx - tw : cx + dx; return { x0, x1: x0 + tw, y0: cy + dy - 19, y1: cy + dy + 4, a, dx, dy }; });
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
      const was = R.leg; R.leg = leg.offsetHeight + 6; return R.leg !== was;   // a legend on two rows takes its room from the plot: the caller sizes again
    };
    return R;
  }

  // ---------- how much room a figure gets ----------
  const FIG = 520, SIDE = 300, GAP = 20, UNDER = 1280, READ = 1100;   // beside needs 520 px of figure and 300 of side column; the reading column is 1100, a figure in it may reach 1280
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
    const node = h('section', 'slide s-board'); node.appendChild(L.head(s, beatLabel(s.beat)));
    const steps = list(s.steps);
    // each step's clicks: a think step counts as two (its question, its answer), so the check sees both
    let n = 0; const map = steps.map(st => st && st.think ? { q: ++n, at: ++n } : { at: ++n });
    const clickOf = j => (map[Math.max(1, Math.min(steps.length, j)) - 1] || { at: 1 }).at;
    const waits = new Set(steps.flatMap((st, j) => st && st.think ? [map[j].at] : []));   // what a think step adds waits for its answer
    const root = h('div', 'body board'); node.appendChild(root);
    // with the scene's head at the top of the window, the figure and all that goes under it stay on screen
    const figH = () => Math.min(FIGH, innerHeight - (root.getBoundingClientRect().top - node.getBoundingClientRect().top) - 12);
    const zl = s.table ? h('div', 'tcol') : null, zt = s.table ? h('div', 'tcard g plate') : null;   // the pinned column: the table, then side notes
    if (zl) zl.appendChild(zt);

    // where steps go. `seg` is the running column: beside the table until something full-width ends it, then the full width
    let seg = null, cur = null, pending = null, zone = null, pair = null; const blocks = [];
    const column = () => { if (seg) return seg; seg = h('div', 'lines');
      if (zl && !pair) { pair = h('div', 'bpair'); pair.append(zl, seg); root.appendChild(pair); } else root.appendChild(seg); return seg; };
    const block = () => { const b = { node: h('div', 'fb'), fig: h('div', 'ffig'), side: h('div', 'fside'), figs: [] }; b.node.append(b.fig, b.side); column().appendChild(b.node); blocks.push(b); return b; };

    const lines = [], cols = [], vis = [], asm = [], thinks = [], stepEls = [], figs = [];
    const SIDEVIS = ['chart', 'image', 'stat', 'units'], WIDEVIS = ['dist', 'parts', 'flow'];
    const isFig = it => it && (it.plane || SIDEVIS.some(k => it[k] != null));
    const isWide = it => it && (it.assemble || it.compare || it.ops || WIDEVIS.some(k => it[k] != null));
    const tag = (e, at, id) => { e.dataset.at = at; if (waits.has(at)) e.dataset.wait = at; if (id) e.dataset.id = id; return e; };
    // a chart mark's or an image label's `step` counts board steps, as everywhere on the board; the kit counts clicks
    const clicks = v => { const c = JSON.parse(JSON.stringify(v)), m = o => { if (o && o.step != null) o.step = clickOf(o.step); };
      if (c.chart) { list(c.chart.series).forEach(m); list(c.chart.marks).forEach(m); } list(c.labels).forEach(m); return c; };
    const visual = v => { const V = L.visual(clicks(v), ctx); vis.push(V); return V; };
    const stepsIn = o => list(o).map(m => m && m.step).filter(x => x != null).map(clickOf);
    // a figure and what goes under it: its Back and Next, then its controls
    const holder = (fg, at, spec) => { fg.wrap = tag(h('div', 'fg'), at); fg.wrap.appendChild(fg.node); fg.at = at; fg.spec = spec; fg.zone = zone; figs.push(fg); return fg; };
    // a deck visual on the board: its shape comes from its `ratio` (an image's from the image); the room only limits its size
    const figure = (it, at) => { const { id, ratio, ...v0 } = it, v = JSON.parse(JSON.stringify(v0)), kind = [...SIDEVIS, ...WIDEVIS].find(k => v[k] != null), e = h('div', `bi bvis ${kind}`); if (id) e.dataset.id = id;
      if (v.parts) delete v.parts.build; if (v.flow) delete v.flow.build;   // both are shown complete
      // a legend that only repeats the x-axis labels gives its room to the plot
      if (v.chart && v.chart.x && list(v.chart.x.cats).length) { const nm = list(v.chart.series).filter(q => q.name).map(q => q.name); if (nm.length && nm.every(q => v.chart.x.cats.includes(q))) v.chart.legend = false; }
      if (v.chart && (v.chart.legend === false || list(v.chart.series).filter(q => q.name && q.legend !== false).length < 2)) e.classList.add('bare');   // no legend, so no legend row
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
      return holder(fg, at, it); };
    // the plan is its picture: numbered squares on one line, a title under each and a sub-label under that
    const track = (f, at) => { const N = list(f.nodes).map(x => typeof x === 'string' ? { label: x } : x), n = N.length, e = h('div', 'bi track', `<div class="tkl" style="left:${50 / n}%;right:${50 / n}%"></div>${N.map((x, i) => `<div class="tkc"><div class="tks${i ? '' : ' on'}">${i + 1}</div><div class="tkt">${md(x.label || '')}</div>${x.sub ? `<div class="tku">${md(x.sub)}</div>` : ''}</div>`).join('')}`);
      e.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
      return holder({ node: e, kind: 'track', issues: [], stops: [], w: 0, h: 0, size: room => { e.style.width = room.w + 'px'; return room.w; }, paint: () => {} }, at, f); };
    const planeFig = (p, at) => { const fg = plane(p, ctx, clickOf, at); fg.stops = stepsIn(p.marks); fg.paint = c => shown(fg.node, c); return holder(fg, at, p); };

    const makeStep = (st, j) => {
      const c = map[j], el = h('div', 'st'); el.dataset.at = c.at; el.dataset.q = c.q || c.at; el.stages = []; el.zone = zone;
      if (st.say) el.appendChild(h('p', 'say', md(st.say)));
      if (st.think) { const t = typeof st.think === 'string' ? { q: st.think } : st.think, e = h('div', 'think g thin', `<div class="tq"><span class="btag">Think</span><span class="tqt">${md(t.q || '')}</span><button type="button" class="tb">Show answer</button></div><div class="ta"><span class="btag so">So</span><span>${md(t.a || '')}</span></div>`);
        e.dataset.at = c.at; e.querySelector('.tb').onclick = () => answer(e); el.appendChild(e); thinks.push(e); }
      stepEls.push(el); el.addEventListener('mouseenter', () => R.hover(c.at)); el.addEventListener('mouseleave', () => R.hover(null));
      el.addEventListener('click', e => { if (e.target.closest('button, input, label, a') || String(getSelection())) return; el.stages.forEach(S => S.jump(c.at)); });
      return el;
    };

    const addItem = (it, j, slot, b) => {
      const at = map[j].at;
      if (it.calc) { const row = tag(h('div', 'cline bi'), at, it.calc.id);
        row.innerHTML = `<div class="num">${lines.filter(x => x.c).length + 1}</div><div class="say">${md(it.calc.say || '')}${it.calc.why ? `<span class="cwhy">${md(it.calc.why)}</span>` : ''}</div><div class="math"></div>`;
        lines.push({ c: it.calc, at, row, el: row }); slot.appendChild(row); }
      else if (it.eqn) { const e = tag(h('div', 'fline bi'), at, it.eqn.id);
        e.innerHTML = `${it.eqn.say ? `<div class="say">${md(it.eqn.say)}</div>` : ''}<div class="math"></div>`; lines.push({ f: it.eqn, at, el: e }); slot.appendChild(e); }
      // the formula built from our numbers (R4): the numbers row, the next step's line, then the symbols row with each term named
      else if (it.assemble) { const a = it.assemble, e = tag(h('div', 'asm bi g fr'), at, a.id);
        e.innerHTML = `${a.say ? `<div class="say">${md(a.say)}</div>` : ''}<div class="arow nums"><span class="atag">Our numbers</span><div class="math"></div></div><div class="abridge"></div>` +
          `<div class="arow syms"><span class="atag">In symbols</span><div class="math"></div></div>`;
        asm.push({ a, e }); slot.appendChild(e); pending = e.querySelector('.abridge'); }
      else if (it.plane) { const fg = planeFig(it.plane, at); b.fig.appendChild(fg.wrap); b.figs.push(fg); }
      else if (SIDEVIS.some(k => it[k] != null)) { const fg = figure(it, at); b.fig.appendChild(fg.wrap); b.figs.push(fg); }
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
        const e = h('div', 'bops bi'); if (it.ops.id) e.dataset.id = it.ops.id; e.appendChild(body); body.querySelectorAll('.opsw, .opcard').forEach(q => q.classList.add('fr')); lines.push({ el: e, at });
        const stops = Array.from({ length: T + 1 }, (_, t) => clk(t)), rows = list(L.val(it.ops.matrix && (it.ops.matrix.values ?? it.ops.matrix.from), ctx.scope, 'ops')).length || 4;
        const w = { wide: true, figs: [] }; zone = w; const fg = { node: e, O, kind: 'ops', issues: [], stops: stops.slice(1), w: 0, h: 0 };
        fg.paint = c => O.show(1 + stops.slice(1).filter(q => q <= c).length);
        fg.size = room => { fg.w = room.w; body.style.height = ''; O.layout(); const vecs = list(it.ops.steps).length; fg.h = Math.max(body.offsetHeight, Math.round(46 * (rows + 3 + Math.min(vecs, 2)))); body.style.height = fg.h + 'px'; return fg.w; };
        holder(fg, at, it.ops); w.figs.push(fg); blocks.push(w); slot.appendChild(fg.wrap); }
      else if (it.note != null) { const nt = typeof it.note === 'string' ? { text: it.note } : it.note;
        const e = tag(h('div', 'bi note g rl', md(nt.text || '')), at, nt.id); lines.push({ note: e, at, el: e }); (nt.side && zl ? zl : slot).appendChild(e); }
    };

    steps.forEach((st, j) => { if (!st) return;
      const items = list(st.add).filter(it => it && typeof it === 'object'), fig = items.find(isFig), wide = items.find(isWide), bridge = pending; pending = null;
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
      el.zone = zone; if (wide) seg = cur = null; });
    if (zl && !pair) root.prepend(zl);
    const broad = steps.some(st => st && list(st.add).some(it => it && it.ops)); root.classList.toggle('broad', broad);

    const tcols = s.table ? list(s.table.cols).map(c => typeof c === 'string' ? { key: c } : c).concat(cols) : [];
    const tkeys = new Set(tcols.map(c => c.key));
    const rowsOf = () => s.table ? list(L.val(s.table.from, ctx.scope, `slide ${ctx.index + 1} table.from`)) : [];
    const symColor = q => { const c = ((ctx.symbols || {})[q] || {}).color; return c ? col(c) : null; };
    const kindOf = q => ((ctx.symbols || {})[q] || {}).kind;
    // a value data.json (or the top-level derive) already holds must come out the same on the board (KTD21)
    const given = Object.getPrototypeOf(ctx.scope) || {}, clash = [];
    const store = (q, v) => { if (!q) return; ctx.scope[q] = v;
      if (typeof given[q] === 'number' && typeof v === 'number' && Math.abs(given[q] - v) > 1e-9 * Math.max(1, Math.abs(v)))
        clash.push(`\`${q}\` works out to ${L.fmt(v, 's4')} on the board but the data says ${L.fmt(given[q], 's4')}: make_data.py and the page disagree`); };
    // each worked line's numbers, in order, so a later line (and the first {{}} fill) can read an earlier result
    const work = () => {
      const rows = rowsOf(); clash.length = 0;
      lines.forEach(ln => { if (!ln.c) return; const c = ln.c, where = `slide ${ctx.index + 1} board line`;
        ln.sc = c.row != null && rows[c.row] ? L.scope(ctx.scope, rows[c.row]) : ctx.scope;
        ln.val = c.expr ? L.try(c.expr, ln.sc, where) : null; store(c.name, ln.val);
        const fromTable = L.names(c.expr || '').filter(q => c.row != null && tkeys.has(q) && !symColor(q));
        ln.color = q => q === c.name ? null : symColor(q) || (fromTable.includes(q) ? col(TERMC[Math.min(2, fromTable.indexOf(q))]) : null);
        ln.reads = L.names(c.expr || '').filter(q => c.row != null && tkeys.has(q));
      });
    };
    work();
    // a formula from an expression or from TeX with [name] terms, each input's symbol wrapped for its colour and name
    const sym = q => symOf(ctx, q), lt = (q, tx) => `\\htmlClass{lt lt-${q}}{${tx}}`;
    const formTex = f => {
      // only the author's own tex is read for {{…}}: kit-made TeX can hold {{ (a wrapped {x}_{3}) that is not a number
      const ids = [], body = f.expr ? L.tex(f.expr, { sym, wrap: lt }) : L.interp(String(f.tex || ''), ctx.scope, true).replace(/\[([A-Za-z_]\w*)\]/g, (_, q) => { if (!ids.includes(q)) ids.push(q); return lt(q, sym(q)); });
      if (f.expr) ids.push(...L.names(f.expr));
      return { tex: f.lhs ? `${lt(f.lhs, sym(f.lhs))} = ${body}` : body, ids: ids.filter(q => q !== f.lhs) };
    };
    // a symbol's own colour wins; the other inputs take s1, s2, s3 in reading order; the result and indices stay ink
    const termColor = ids => { const free = ids.filter(q => !symColor(q) && !kindOf(q)); return q => symColor(q) || (free.indexOf(q) >= 0 && free.indexOf(q) < 3 ? col(TERMC[free.indexOf(q)]) : null); };
    const termNames = (ids, skip) => ids.filter(q => !kindOf(q) && !(skip && skip.has(q))).map(q => { if (skip) skip.add(q); return { n: q, text: L.plain(shortOf(ctx, q), ctx.scope) }; });
    const drawAsm = () => asm.forEach(A => {
      const a = A.a, [nm, sy] = A.e.querySelectorAll('.arow .math'), { tex, ids } = formTex(a), colorOf = termColor(ids);
      let nums;
      if (a.expr) { const v = L.try(a.expr, ctx.scope, `slide ${ctx.index + 1} assemble`); store(a.lhs, v);
        const { tex: sub, eq } = L.work(a.expr, { slash: true, val: q => typeof ctx.scope[q] === 'number' ? ctx.scope[q] : null, arr: q => Array.isArray(ctx.scope[q]) ? ctx.scope[q] : null, wrap: lt, fmt: a.fmt, lit: null, fmtOf: (q, x) => subFmt(ctx, q, x) }, v, a.fmt, ctx.scope);
        nums = `${sub} ${eq} \\htmlClass{res}{${L.numTex(v, a.fmt)}}`; }
      else nums = L.interp(String(a.plug || ''), ctx.scope, true).replace(/\[([A-Za-z_]\w*):([^\]]*)\]/g, (_, q, x) => q === a.lhs ? `\\htmlClass{res}{${x}}` : lt(q, x)).replace(/\[([A-Za-z_]\w*)\]/g, (_, q) => lt(q, sym(q)));
      L.renderTex(nm, nums, false); L.renderTex(sy, tex, false); tint(nm, colorOf); tint(sy, colorOf);
      names(sy, termNames(ids));   // every term gets its plain name here (R4), even one named earlier in the scene
    });
    // write each worked line: symbol = formula, = numbers, = result (stacked at the = signs when too long for a row)
    const drawLines = () => {
      work();
      const named = new Set(), shownFmt = {};
      lines.forEach(ln => {
        if (ln.f) { const m = ln.el.querySelector('.math'), { tex, ids } = formTex(ln.f); L.renderTex(m, tex, false); tint(m, termColor(ids)); names(m, termNames(ids, named)); return; }
        if (!ln.c) return; const c = ln.c, math = ln.row.querySelector('.math'); math.innerHTML = ''; math.classList.remove('wrapped');
        if (!c.expr) return;
        const f = L.tex(c.expr, { sym, wrap: (q, tx) => lt(q, tx) });
        const { tex: sub, eq } = L.work(c.expr, { slash: true, val: q => typeof ln.sc[q] === 'number' ? ln.sc[q] : null, arr: q => Array.isArray(ln.sc[q]) ? ln.sc[q] : null, wrap: (q, tx) => lt(q, tx),
          fmt: c.fmt, lit: null, fmtOf: (q, x) => subFmt(ctx, q, x, shownFmt[q]) }, ln.val, c.fmt, ln.sc);
        const parts = [[c.name ? `${sym(c.name)} = ${f}` : f, 'f'], [`= ${sub}`, 'sub'], [`${eq} \\htmlClass{res}{${L.numTex(ln.val, c.fmt)}}`, 'r']];
        parts.forEach(([tx, cls]) => { const sp = h('span', 'part ' + cls); math.appendChild(sp); L.renderTex(sp, tx, false); });
        const ps = [...math.children]; ps.slice(0, 2).forEach(q => tint(q, ln.color)); if (ps.some((e, q) => q && e.offsetTop >= ps[q - 1].offsetTop + ps[q - 1].offsetHeight - 2)) math.classList.add('wrapped');
        if (c.name) shownFmt[c.name] = c.fmt;
        names(ps[0], L.names(c.expr).filter(q => !named.has(q) && q !== c.name).map(q => { named.add(q); return { n: q, text: L.plain(shortOf(ctx, q), ctx.scope) }; }));
      });
    };
    // a parameter card: each named number with its symbol in its colour, its value now and its name (it follows the sliders)
    const drawParams = () => lines.forEach(ln => ln.params && ln.params.querySelectorAll('.pr').forEach(r => { const q = r.dataset.n, v = ctx.scope[q];
      r.style.setProperty('--tc', symColor(q) || 'var(--ink)'); L.renderTex(r.querySelector('.ps'), symOf(ctx, q), false);
      r.querySelector('.pv').textContent = typeof v === 'number' ? L.fmt(v, ((ctx.symbols || {})[q] || {}).fmt ?? 's4') : '?'; }));

    // controls, registered in ctx.ctl so the check moves each to both ends (lesson.py writes a run or a toggle as a plain
    // slider first): a slider; a run (frames 0..n-1: a scrubber, the frame count and a play button that is off until
    // pressed and never runs under ?check); a toggle (two buttons, 0 and 1). Each sits under the figure it drives.
    const CHECK = new URLSearchParams(location.search).has('check');
    let run = null, flowBox = null;
    const driven = name => { const seen = new Set([name]), d = Object.entries(s.derive || {}); let more = true;
      while (more) { more = false; d.forEach(([k, x]) => { if (!seen.has(k) && L.names(String(x)).some(q => seen.has(q))) { seen.add(k); more = true; } }); } return seen; };
    const driverOf = name => { const set = driven(name); return figs.find(fg => (exprsOf(fg.spec).match(/[A-Za-z_]\w*/g) || []).some(w => set.has(w))) || figs[figs.length - 1] || null; };
    const boxOf = fg => { if (fg) { if (!fg.box) { fg.box = h('div', 'controls'); fg.wrap.appendChild(fg.box); } return fg.box; }
      if (!flowBox) { flowBox = h('div', 'controls'); (seg || cur && cur.side || root).appendChild(flowBox); } return flowBox; };
    (s.controls || []).forEach(c => {
      const id = `ctl-${ctx.index}-${c.name}`, v0 = c.value ?? c.min, fg = driverOf(c.name);
      let w, set;
      if (c.toggle) {
        w = h('div', 'ctl g pill thin tog');
        w.innerHTML = `<label>${md(c.label || c.name)}</label><div class="seg2">${c.toggle.map((t, q) => `<button type="button" data-v="${q}">${md(t)}</button>`).join('')}</div>`;
        const bs = [...w.querySelectorAll('button')];
        set = v => { ctx.scope[c.name] = +v; bs.forEach(b => b.classList.toggle('on', +b.dataset.v === +v)); };
        bs.forEach(b => b.addEventListener('click', () => { set(b.dataset.v); ctx.refresh(); }));
      } else {
        const k = c.run || 0;
        w = h('div', 'ctl g pill thin' + (k ? ' run' : ''));
        w.innerHTML = `${k ? '<button type="button" class="play" aria-label="play"></button>' : ''}<label for="${id}">${md(c.label || c.name)}</label><input id="${id}" type="range" min="${c.min}" max="${c.max}" step="${c.step ?? (c.max - c.min) / 100}" value="${v0}"><output></output>`;
        const inp = w.querySelector('input'), out = w.querySelector('output');
        set = v => { ctx.scope[c.name] = +v; inp.value = v; out.textContent = k ? `${+v} / ${k - 1}` : L.fmt(+v, c.fmt); inp.style.setProperty('--fill', ((v - c.min) / (c.max - c.min) * 100) + '%'); };
        inp.addEventListener('input', () => { stop(); set(inp.value); if (k) follow(); ctx.refresh(); });
        if (k) {
          const btn = w.querySelector('.play');
          const halt = () => { if (run.timer) { clearInterval(run.timer); run.timer = null; btn.classList.remove('on'); btn.setAttribute('aria-label', 'play'); } };
          run = { c, n: k, set, fg, stop: halt, timer: null };
          btn.addEventListener('click', () => { if (run.timer) return halt(); if (CHECK) return;
            if (ctx.scope[c.name] >= k - 1) { set(0); follow(); ctx.refresh(); }
            btn.classList.add('on'); btn.setAttribute('aria-label', 'pause');
            run.timer = setInterval(() => { if (L.slides[L.i] && L.slides[L.i].ctx !== ctx) return halt();
              const f = ctx.scope[c.name] + 1; set(f); follow(); ctx.refresh(); if (f >= k - 1) halt(); }, 1000 * (c.every || 1.3)); });
        }
      }
      set(v0);
      ctx.ctl[c.name] = v => { set(v); ctx.refresh(); };
      boxOf(fg).appendChild(w);
    });
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
      const asked = j => { S.ask = j; S.show(); const c = j == null ? uniq[S.i] : +stepAt(uniq[j]).dataset.q; light(c); mark(c); };
      const go = (v, rel) => hold(() => {
        if (rel && v < 0 && S.ask != null) { asked(null); return true; }
        const j = rel ? S.i + v : v; if (j < 0 || j >= uniq.length || j === S.i) return false;
        if (j > S.i && S.ask !== j && unanswered(uniq[j])) { if (j > S.i + 1) S.to(j - 1); asked(j); return true; }
        S.to(j); return true; });
      const ui = stageBar(uniq, go);
      // the line by the buttons, from the second stop on (the first is the line just read): the step's own words, or for a think step its question and then its answer
      const lineOf = (c, answered) => { const e = stepAt(c), ta = e && e.querySelector('.ta > span:last-child'), q = e && e.querySelector('.tqt'), say = e && e.querySelector(':scope > .say');
        return (answered ? ta || say : say || q) || q; };
      S.show = () => { const on = S.ask != null, c = uniq[on ? S.ask : S.i], e = lineOf(c, !on && !unanswered(c));
        paint(uniq[S.i]); ui.set(S.i, on); ui.line.innerHTML = e && (on || S.i) ? e.innerHTML : '';
        S.lines.forEach(q => q.classList.toggle('atstop', on ? +q.dataset.at === c : stopOf(+q.dataset.at) === S.i)); S.quiet(); };
      // the line is there for when a step's own words are out of sight: with those words on screen it steps aside, and keeps its room
      S.quiet = () => { const l = ui.line, t = same(l); l.style.visibility = t && [...node.querySelectorAll(WORDS)].some(e => same(e) === t && inWindow(e)) ? 'hidden' : ''; };
      // its room is the tallest words it will hold, so the page under it does not jump
      S.fit = () => { const l = ui.line; if (!l.clientWidth) return; const now = l.innerHTML; l.style.minHeight = ''; let most = 0;
        uniq.slice(1).forEach(c => [true, false].forEach(a => { const e = lineOf(c, a); if (e) { l.innerHTML = e.innerHTML; most = Math.max(most, l.offsetHeight); } }));
        l.innerHTML = now; l.style.minHeight = most + 'px'; };
      // go to a stop: the run takes its frame, the think stop there opens, the table lights up for that step
      S.to = j => { S.i = j; S.ask = null; const c = uniq[j];
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
    const setThink = (e, on) => { e.classList.toggle('open', on); e.querySelector('.tb').textContent = on ? 'Hide answer' : 'Show answer'; node.querySelectorAll(`[data-wait="${e.dataset.at}"]`).forEach(x => x.classList.toggle('open', on)); };
    // Show answer brings in all the step adds, a stage stop too; Hide answer takes it away again
    function answer(e) { hold(() => { const on = !e.classList.contains('open'), at = +e.dataset.at; setThink(e, on);
      stages.forEach(S => { const j = S.stops.indexOf(at); if (j < 0) return; if (on && S.i < j) S.to(j); else if (!on && S.i >= j && j > 0) { S.to(j - 1); setThink(e, false); } });
      fill(Math.max(read, on ? at : 0)); }); }
    // the run's stage follows the scrubber: the line and the dot of the frame on show
    function follow() { const S = stages.find(x => x.frames); if (!S) return; let i = 0; S.stops.forEach((c, q) => { if (frameAt(c) <= ctx.scope[run.c.name]) i = q; }); S.i = i; S.show(); }

    // ---------- the table ----------
    // the pinned table: the given columns, plus any column a step adds: it holds its place, and fills in when the reading gets there
    const drawTable = () => {
      if (!zt) return;
      const rows = rowsOf();
      const cell = (c, r) => { let v = r[c.key]; if (c.expr) v = L.try(c.expr, L.scope(ctx.scope, r), `slide ${ctx.index + 1} column ${c.key}`); return typeof v === 'number' ? L.fmt(v, c.fmt) : md(v); };
      const stp = c => (c.at ? ` data-step="${c.at}"` : '') + (waits.has(c.at) ? ` data-wait="${c.at}"` : ''), wt = c => waits.has(c.at) ? ` data-wait="${c.at}"` : '';
      zt.innerHTML = `<table class="t"><thead><tr>${tcols.map(c => `<th class="${c.expr ? 'der' : ''}" data-col="${L.esc(c.key)}"${wt(c)}><span class="cv">${md(c.label || c.key)}</span></th>`).join('')}</tr></thead>
        <tbody>${rows.map((r, i) => `<tr data-r="${i}">${tcols.map(c => `<td class="${c.expr ? 'der' : ''}" data-r="${i}" data-col="${L.esc(c.key)}"${stp(c)}><span class="cv">${cell(c, r)}</span></td>`).join('')}</tr>`).join('')}</tbody></table>`;
      // the table fills its 30%; one too wide for that takes what it needs, and if that leaves the work too little it goes above it
      if (pair) { pair.classList.add('stacked'); const W = pair.clientWidth, w = Math.max(zt.offsetWidth, sideOf(W)); pair.style.setProperty('--tcw', w + 'px'); pair.classList.toggle('stacked', W - w - GAP < FIG); }
    };

    // highlights, on the things themselves: the row a worked line reads (its cells in the line's colours), and any
    // `mark:` (row:i, col:key, cell:i:key, #id). They follow the reading, a hovered line, or a figure's Next.
    const marksAt = k => { const out = []; steps.forEach((st, j) => { if (st && (map[j].at === k || map[j].q === k)) list(st.mark).forEach(m => out.push(String(m))); }); return out; };
    const targetOf = t => {
      let m;
      if ((m = /^row:(\d+)$/.exec(t)) && zt) return { els: [...zt.querySelectorAll(`tbody tr[data-r="${m[1]}"]`)], cls: 'wrow' };
      if ((m = /^col:(.+)$/.exec(t)) && zt) return { els: [...zt.querySelectorAll(`[data-col="${CSS.escape(m[1])}"]`)], cls: 'hcol' };
      if ((m = /^cell:(\d+):(.+)$/.exec(t)) && zt) return { els: [...zt.querySelectorAll(`td[data-r="${m[1]}"][data-col="${CSS.escape(m[2])}"]`)], cls: 'src' };
      if ((m = /^#(.+)$/.exec(t))) return { els: [...node.querySelectorAll(`[data-id="${CSS.escape(m[1])}"]`)], cls: 'hl' };
      return { els: [], cls: '' };
    };
    let missing = [], lit = 0, read = 0, over = null;
    const light = k => { lit = k;
      node.querySelectorAll('.wrow, .hcol, .src, .hl').forEach(e => { e.classList.remove('wrow', 'hcol', 'src', 'hl'); e.style.removeProperty('--tc'); });
      missing = [];
      lines.forEach(ln => { if (!ln.c || ln.at !== k || ln.c.row == null || !zt) return;
        zt.querySelector(`tbody tr[data-r="${ln.c.row}"]`)?.classList.add('wrow');
        ln.reads.forEach(q => { const td = zt.querySelector(`td[data-r="${ln.c.row}"][data-col="${CSS.escape(q)}"]`), c = ln.color(q);
          if (td && c) { td.classList.add('src'); td.style.setProperty('--tc', c); } }); });
      marksAt(k).forEach(t => { const { els, cls } = targetOf(t); if (!els.length) { missing.push(t); return; }
        els.forEach(e => { e.classList.add(cls); if (cls === 'src') e.style.setProperty('--tc', 'var(--accent)'); }); });
    };
    const fill = k => { if (zt) shown(zt, k); };
    const mark = k => stepEls.forEach(e => e.classList.toggle('now', +e.dataset.at === k || +e.dataset.q === k));

    // a figure's rows take its width
    const sized = (fg, room) => { const w = fg.size(room); fg.wrap.style.width = w + 'px'; return w; };
    // the figures: how each sizes itself. Two figures on one step stand in a row above their lines
    // The reading column is 1100 px, or a matrix panel's page; a figure wider than that widens it for the whole scene, so the edges stay one
    const place = () => { const page = root.clientWidth, read0 = broad ? page : Math.min(READ, page); let read = read0; root.style.setProperty('--read', read0 + 'px');
      blocks.forEach(b => { if (b.wide) return;
      const W = b.node.parentElement.clientWidth, side = sideOf(W), many = b.figs.length > 1, inPair = b.node.closest('.bpair:not(.stacked)');
      const beside = !b.over && !inPair && !many && b.side.children.length > 0 && W - side - GAP >= FIG;
      b.node.classList.toggle('beside', beside); b.node.classList.toggle('many', many);
      const own = many ? (W - GAP * (b.figs.length - 1)) / b.figs.length : beside ? W - side - GAP : inPair ? W : Math.min(W, UNDER);
      const room = { w: own, col: beside || many || inPair ? own : read0, h: figH() };
      const size = () => { const w = Math.max(...b.figs.map(fg => sized(fg, room))); b.fig.style.width = many ? '' : w + 'px'; b.node.style.setProperty('--fig', w + 'px'); if (!beside && !many && !inPair) read = Math.max(read, w); };
      // what the figure must share the window with: the line above it, and its slider and button rows, if it has any
      const shared = () => { const say = beside ? null : b.side.querySelector(':scope > .st.intro > .say'); let foot = 0;
        b.figs.forEach(fg => { if (fg.stage) fg.stage.fit(); foot = Math.max(foot, fg.wrap.offsetHeight - fg.node.offsetHeight); });
        return (say ? say.offsetHeight + 14 : 0) + foot; };
      size(); for (let pass = 0; pass < 3; pass++) { read = read0; room.h = figH() - shared(); size(); } });
      root.style.setProperty('--read', read + 'px');
      blocks.forEach(b => { if (b.wide) b.figs.forEach(fg => sized(fg, { w: read, col: read, h: figH() })); });
      node.querySelectorAll('.bcmp .chart').forEach(c => { c.style.height = Math.round(c.clientWidth / SHAPE) + 'px'; }); };
    // a worked line too long to sit beside the table sends the table above the work: a formula is never shrunk or cut
    const widen = () => { if (!pair || pair.classList.contains('stacked')) return; const edge = pair.getBoundingClientRect().right;
      if ([...pair.querySelectorAll('.katex')].some(e => e.getBoundingClientRect().right > edge + 1)) { pair.classList.add('stacked'); place(); drawLines(); } };
    // anything sticky taller than the window would hide its own foot
    // a formula that runs past the text column sends that one figure above its text
    const overrun = () => { let moved = false; blocks.forEach(b => { if (b.wide || !b.node.classList.contains('beside')) return; const edge = b.side.getBoundingClientRect().right;
      if ([...b.side.querySelectorAll('.katex')].some(e => e.getBoundingClientRect().right > edge + 1)) b.over = moved = true; });
      if (moved) { place(); drawLines(); } };
    const stick = () => node.querySelectorAll('.tcol, .ffig').forEach(e => e.classList.toggle('nostick', e.offsetHeight > innerHeight - 48));

    const R = {
      node, steps: n, stages,
      stick: () => { held.forEach((_, f) => { f.style.top = ''; }); held.clear(); stick(); stages.forEach(S => S.quiet()); },
      watch: () => { letGo(); stages.forEach(S => S.quiet()); },
      layout: () => { blocks.forEach(b => { b.over = false; }); drawTable(); place(); drawLines(); widen(); overrun(); drawAsm(); drawParams(); if (figs.map(fg => fg.layout && fg.layout()).some(Boolean)) { place(); figs.forEach(fg => fg.layout && fg.layout()); } vis.forEach(V => V.layout()); figs.forEach(fg => fg.O && fg.O.layout()); stick(); },
      // what the page shows now, after a redraw or a move
      repaint: () => { fill(read); thinks.forEach(e => setThink(e, e.classList.contains('open'))); figs.forEach(fg => { if (!fg.stage) fg.paint(1e9); }); vis.forEach(V => { if (!figs.some(fg => fg.V === V)) V.show(1e9); }); stages.forEach(S => S.show()); light(lit); mark(lit); },
      // everything up to click k, as the check and the printer see it
      show: k => { read = lit = k; thinks.forEach(e => setThink(e, +e.dataset.at <= k)); stages.forEach(S => S.to(S.stopOf(k))); R.repaint(); },
      reset: () => { stages.forEach(S => S.to(0)); thinks.forEach(e => setThink(e, false)); read = lit = 0; R.repaint(); },
      // the reading line, in window pixels: every step whose top has passed it counts as read
      spy: y => { const b = node.getBoundingClientRect(); let k = 0;
        if (y === Infinity || b.bottom < y) k = n; else if (b.top <= y) stepEls.forEach(e => { if (e.getBoundingClientRect().top <= y) k = Math.max(k, +e.dataset.at); });
        if (k === read) return; read = k; fill(k); if (over == null) { light(k); mark(k); } },
      hover: k => { over = k; const c = k ?? read; fill(Math.max(read, c)); light(c); mark(c); },
      audit: () => {
        const out = [];
        missing.forEach(t => out.push(`mark target not found: ${t}`));
        figs.forEach(fg => { out.push(...(fg.issues || []));
          if (['plane', 'chart', 'image', 'units'].includes(fg.kind) && (fg.w < 340 || fg.h < 220)) out.push(`a ${fg.kind} is only ${fg.w} × ${fg.h} px: give it more room, or split the scene`); });
        node.querySelectorAll('.board .vis .chart').forEach(c => { const r = c.getBoundingClientRect(), q = r.width / (r.height || 1); if (q < 1 || q > 2.2) out.push(`a chart is ${Math.round(r.width)} × ${Math.round(r.height)} px: its shape must stay between 1:1 and 2.2:1, so set its \`ratio\``); });
        root.querySelectorAll('.cline .math, .fline .math, .asm .math').forEach(m => { if (parseFloat(getComputedStyle(m).fontSize) < 26) out.push('a formula renders under 26px'); });
        node.querySelectorAll('table.t td').forEach(c => { if (parseFloat(getComputedStyle(c).fontSize) < 18) out.push('a table cell renders under 18px'); });
        vis.forEach(V => out.push(...V.audit())); figs.forEach(fg => fg.O && out.push(...fg.O.audit()));
        root.querySelectorAll('.approx').length && out.push('a worked line does not add up by hand at the rounding shown (it reads ≈): give its inputs a finer fmt');
        root.querySelectorAll('.fline .math, .asm .math, .cline .part').forEach(m => { const kx = m.querySelector('.katex'), box = m.closest('.st, .asm'); if (kx && box && kx.getBoundingClientRect().right > box.getBoundingClientRect().right + 2) out.push('a formula is wider than its box: shorten it or split the line'); });
        out.push(...clash);
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
