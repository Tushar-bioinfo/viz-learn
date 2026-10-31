/* viz-os sketch: the box of drawn parts, and the wrapper for custom drawings.
   Each part draws in its own box, -1..1 across, so size and rotation live in one place and its anchors stay right.
   The cell, nucleus, helix and chromosome are adapted from statechart-art's art/bio.js (MIT, see NOTICE). */
(function () {
  'use strict';
  const L = window.VizOS, K = L.sketch, h = L.h, TAU = K.TAU;
  const list = x => Array.isArray(x) ? x : x == null ? [] : [x];
  const val = (e, scope) => typeof e === 'string' ? L.eval(e, scope) : e;
  const col = (pal, c, fb) => !c ? fb : pal[c] || c;

  // the part's box on the sheet: local -1..1 -> figure units -> mm
  function frame(it, E) {
    const [ax, ay] = it.at || [50, 30], r = (it.size || 20) / 2, a = (it.rotate || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), c = col(E.pal, it.color, E.main);
    const T = (x, y) => [ax + (x * ca - y * sa) * r, ay + (x * sa + y * ca) * r], mm = p => E.u(...T(p[0], p[1])), mms = ps => ps.map(mm);
    const G = { c, ink: E.ink, pal: E.pal, R: K.rng(`part:${it.part}:${it.id || ''}:${it.at}`), mm, mms, scale: r * E.unit,
      pub: (n, x, y) => { const t = T(x, y); E.pub(n, t[0], t[1]); },
      fill: (ps, color, o = {}) => E.S.tool('pastelpencil', { color, point: 'blunt' }).fillWith(mms(ps), { angle: (o.angle ?? 35) + (it.rotate || 0), pressure: o.pressure ?? .75 }),
      outline: (ps, color, nib = .35) => E.pen(color, nib).poly(mms(ps), true, { tremor: .2 }),
      line: (ps, color, nib = .35, o = {}) => E.pen(color, nib).stroke(mms(ps), { tremor: .2, ...o }),
      dot: (x, y, rr, color) => E.pen(color, .3).exactDot(mm([x, y]), rr * r * E.unit, { pressure: .9 }), mark: (x, y) => { const t = T(x, y); E.mark(t[0], t[1]); } };
    [['top', 0, -1], ['bottom', 0, 1], ['left', -1, 0], ['right', 1, 0], ['center', 0, 0]].forEach(([n, x, y]) => G.pub(n, x, y));
    return G;
  }
  function blob(R, rx, ry, cx = 0, cy = 0, n = 12, wob = .05) {
    const c = []; for (let i = 0; i < n; i++) { const a = (i + (R() - .5) * .25) / n * TAU, k = 1 + (R() - .5) * 2 * wob; c.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
    const s = K.catmull([...c, ...c, ...c], .04), m = s.length; return s.slice(Math.floor(m / 3), Math.floor(2 * m / 3));
  }
  const ell = (cx, cy, rx, ry = rx, n = 28) => Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * TAU) * rx, cy + Math.sin(i / n * TAU) * ry]);
  function tube(pts, r) {
    const s = K.catmull(pts, .05), a = [], b = [];
    s.forEach((p, i) => { const q = s[Math.min(s.length - 1, i + 1)], o = s[Math.max(0, i - 1)], d = [q[0] - o[0], q[1] - o[1]], l = Math.hypot(...d) || 1, n = [-d[1] / l, d[0] / l], w = typeof r === 'function' ? r(i / (s.length - 1)) : r; a.push([p[0] + n[0] * w, p[1] + n[1] * w]); b.push([p[0] - n[0] * w, p[1] - n[1] * w]); });
    return [...a, ...b.reverse()];
  }
  function squiggle(R, cx, cy, rx, ry, steps) {
    const pts = []; let x = cx + (R() - .5) * rx, y = cy + (R() - .5) * ry, a = R() * TAU, st = Math.min(rx, ry) * .3;
    for (let i = 0; i < steps; i++) { a += (R() - .5) * 1.6; let nx = x + Math.cos(a) * st, ny = y + Math.sin(a) * st; if (((nx - cx) / rx) ** 2 + ((ny - cy) / ry) ** 2 > .8) { a = Math.atan2(cy - y, cx - x); nx = x + Math.cos(a) * st; ny = y + Math.sin(a) * st; } x = nx; y = ny; pts.push([x, y]); }
    return K.catmull(pts, .03);
  }
  function nucleusIn(G, cx, cy, rx, ry, threads = 5) {
    const s = blob(G.R, rx, ry, cx, cy); G.fill(s, G.c, { pressure: .8 });
    for (let i = 0; i < threads; i++) G.line(squiggle(G.R, cx, cy, rx * .8, ry * .8, 9), G.ink, .22);
    G.outline(s, G.ink, .3);
  }
  // values from the page shade the wells: darker ink is more
  function shades(it, ctx, n) {
    if (it.values == null) return null;
    const v = list(val(it.values, ctx.scope)), lo = Math.min(...v), hi = Math.max(...v);
    if (v.length !== n) throw new Error(`${it.part}: \`values\` has ${v.length} numbers for ${n} places`);
    return v.map(x => hi > lo ? (x - lo) / (hi - lo) : 1);
  }

  const P = K.parts = {
    cell(G, it) {
      const st = it.state || 'plain', R = G.R;
      if (st === 'dividing') {
        const s = [], n = 64; for (let i = 0; i < n; i++) { const a = i / n * TAU, c = Math.cos(a), w = .62 - .34 * Math.exp(-((c * 1.05) ** 2) / .08); s.push([c, Math.sin(a) * (w + .1)]); }
        G.fill(s, G.pal.wash, { pressure: .85 }); nucleusIn(G, -.52, 0, .23, .27, 3); nucleusIn(G, .52, 0, .23, .27, 3); G.outline(s, G.ink, .4);
        G.pub('a', -.52, 0); G.pub('b', .52, 0); G.pub('waist', 0, 0); return;
      }
      const s = blob(R, 1, .94, 0, 0, 12, st === 'dead' ? .17 : .05);
      G.fill(s, G.pal.wash, { pressure: .85 });
      if (st === 'dead') { G.line(s.filter((_, i) => i % 7 < 4), G.ink, .3); for (let i = 0; i < 5; i++) G.outline(ell(-.5 + i * .25 + (R() - .5) * .1, (R() - .5) * .8, .1), G.c, .3); G.pub('nucleus', 0, 0); return; }
      nucleusIn(G, .04, .02, .38, .4); G.outline(s, G.ink, .42); G.pub('nucleus', .04, .02); G.pub('membrane', .94, -.3);
    },
    nucleus(G) { nucleusIn(G, 0, 0, 1, .92, 9); const n = blob(G.R, .2, .18, .32, .2); G.fill(n, G.ink, { pressure: .95 }); G.pub('nucleolus', .32, .2); },
    dna(G, it) {
      const turns = it.turns || 3, A = .3, step = .02, open = it.state === 'open', xs = []; for (let x = -1; x <= 1.0001; x += step) xs.push(x);
      const gape = x => open ? .42 * Math.max(0, 1 - (x / .5) ** 2) : 0, y = (x, ph) => Math.sin((x + 1) / 2 * turns * TAU + ph) * A * (1 - gape(x)) + (ph ? gape(x) : -gape(x));
      for (let x = -.97; x < 1; x += 1 / (5 * turns)) if (!gape(x)) G.line([[x, y(x, 0)], [x, y(x, Math.PI)]], G.c, .4);
      for (const ph of [0, Math.PI]) G.line(xs.map(x => [x, y(x, ph)]), G.ink, .9);
      G.pub('start', -1, 0); G.pub('end', 1, 0); G.pub('middle', 0, 0);
    },
    chromosome(G, it) {
      const single = it.state === 'single', arm = (sd, a, l) => tube([[sd * .1, 0], [sd * .1 + Math.cos(a) * l * .5, Math.sin(a) * l * .5], [sd * .1 + Math.cos(a) * l, Math.sin(a) * l]], t => .14 * (.72 + .28 * Math.sin(Math.min(1, t * 1.6) * Math.PI / 2)));
      for (const sd of single ? [0] : [-1, 1]) for (const [a, l] of [[-Math.PI / 2 + sd * .28, .7], [Math.PI / 2 - sd * .28, 1]]) { const p = arm(sd, a, l); G.fill(p, G.c, { pressure: .95, angle: 70 }); G.outline(p, G.ink, .28); }
      G.dot(0, 0, .07, G.ink); G.pub('centromere', 0, 0); G.pub('shortarm', 0, -.7); G.pub('longarm', 0, 1);
    },
    tissue(G, it) {
      const R = G.R, out = blob(R, 1, .74, 0, 0, 14, .1), n = 13, cs = []; G.fill(out, G.pal.wash, { pressure: .7 });
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const x = -1 + 2 * (i + .5 + (R() - .5) * .5) / n, y = -.74 + 1.48 * (j + .5 + (R() - .5) * .5) / n; if ((x / .94) ** 2 + (y / .68) ** 2 < 1) cs.push([x, y]); }
      const two = it.state === 'regions', other = col(G.pal, it.other, G.pal.s2);
      cs.forEach(([x, y]) => G.dot(x, y, .032, two && x + y * .5 + Math.sin(y * 3) * .15 > .1 ? other : G.c));
      G.outline(out, G.ink, .4); G.pub('a', -.5, 0); G.pub('b', .55, 0);
    },
    spots(G, it, ctx) {
      const rows = it.rows || 6, cols = it.cols || 8, gap = 2 / Math.max(rows, cols), r = gap * .34, X = c => (c - (cols - 1) / 2) * gap, Y = q => (q - (rows - 1) / 2) * gap, lit = shades(it, ctx, rows * cols), on = it.state === 'captured';
      for (let q = 0; q < rows; q++) for (let c = 0; c < cols; c++) { const v = lit ? lit[q * cols + c] : on ? 1 : 0;
        G.outline(ell(X(c), Y(q), r, r, 16), G.ink, .25); if (v > .02) G.dot(X(c), Y(q), r * (.35 + .55 * v), G.c); G.pub(`spot.${q}.${c}`, X(c), Y(q)); G.mark(X(c), Y(q)); }
    },
    tube(G, it) {
      const body = [[-.42, -.6], [.42, -.6], [.34, .3], [.08, .96], [-.08, .96], [-.34, .3]], cap = [[-.5, -.74], [.5, -.74], [.5, -.6], [-.5, -.6]];
      if (it.state !== 'empty') { const lv = .05; G.fill([[-.38, lv], [.38, lv], [.34, .3], [.08, .93], [-.08, .93], [-.34, .3]], G.c, { pressure: .85 }); G.line([[-.38, lv], [.38, lv]], G.ink, .25); }
      G.outline(body, G.ink, .42); G.fill(cap, G.pal.wash, { pressure: 1 }); G.outline(cap, G.ink, .42);
      G.pub('cap', 0, -.74); G.pub('liquid', 0, .4); G.pub('tip', 0, .96);
    },
    plate(G, it, ctx) {
      const rows = it.rows || 8, cols = it.cols || 12, gx = 1.72 / cols, gy = gx, H = gy * rows / 2 + .14, r = gx * .36, X = c => (c - (cols - 1) / 2) * gx, Y = q => (q - (rows - 1) / 2) * gy, lit = shades(it, ctx, rows * cols), full = it.state === 'filled';
      G.outline([[-1, -H], [.94, -H], [1, -H + .06], [1, H], [-1, H]], G.ink, .42);
      for (let q = 0; q < rows; q++) for (let c = 0; c < cols; c++) { const v = lit ? lit[q * cols + c] : full ? 1 : 0;
        G.outline(ell(X(c), Y(q), r, r, 14), G.ink, .22); if (v > .02) G.dot(X(c), Y(q), r * (.3 + .6 * v), G.c); G.pub(`well.${q}.${c}`, X(c), Y(q)); G.mark(X(c), Y(q)); }
    },
    gene(G, it) {
      const on = it.state !== 'off', ex = (it.exons || 3), w = 1.5 / (ex * 2 - 1), c0 = on ? G.c : G.pal.pale;
      G.line([[-1, 0], [1, 0]], G.ink, .5);
      for (let i = 0; i < ex; i++) { const x0 = -.75 + i * 2 * w, b = [[x0, -.18], [x0 + w, -.18], [x0 + w, .18], [x0, .18]]; G.fill(b, c0, { pressure: .95 }); G.outline(b, G.ink, .32); G.pub(`exon.${i}`, x0 + w / 2, -.18); }
      if (on) { G.line([[-.86, 0], [-.86, -.34], [-.62, -.34]], G.ink, .42); G.line([[-.7, -.42], [-.62, -.34], [-.7, -.26]], G.ink, .42); }
      G.pub('start', -1, 0); G.pub('end', 1, 0);
    },
    read(G, it) {
      const bar = (a, b, c) => { const r = [[a, -.1], [b, -.1], [b, .1], [a, .1]]; G.fill(r, c, { pressure: .95 }); G.outline(r, G.ink, .28); };
      bar(-1, -.62, G.pal.s3); bar(-.62, -.36, G.pal.s2); bar(-.36, it.state === 'short' ? .3 : .92, G.c);
      G.pub('barcode', -.81, -.1); G.pub('umi', -.49, -.1); G.pub('insert', .28, -.1); G.pub('start', -1, 0); G.pub('end', it.state === 'short' ? .3 : .92, 0);
    },
    droplet(G, it) {
      const st = it.state || 'empty', s = blob(G.R, 1, 1, 0, 0, 10, .025); G.fill(s, G.pal.wash, { pressure: .5 });
      if (st === 'cell' || st === 'both') { nucleusIn(G, st === 'both' ? -.3 : 0, 0, .28, .28, 3); G.pub('cell', st === 'both' ? -.3 : 0, 0); }
      if (st === 'bead' || st === 'both') { G.dot(st === 'both' ? .38 : 0, .1, .2, G.c); G.pub('bead', st === 'both' ? .38 : 0, .1); }
      G.outline(s, G.ink, .4); G.line(K.catmull([[-.62, -.42], [-.48, -.62], [-.26, -.74]], .04), G.ink, .25);
    },
    arrow(G, it, ctx, E) {
      const pts = it.state === 'bent' ? [[-1, .2], [0, -.28], [.92, .2]] : [[-1, 0], [0, -.05], [.92, 0]], ps = K.catmull(pts, .04);
      G.line(ps, G.c, .55); K.arrowhead(E.S, G.mm([1, it.state === 'bent' ? .25 : 0]), G.mm(ps[ps.length - 8]), { c1: G.c, edge: G.c }, Math.max(2.4, G.scale * .22));
      G.pub('start', -1, pts[0][1]); G.pub('end', 1, 0); G.pub('middle', 0, pts[1][1]);
    },
    bracket(G) {
      G.line([[-.14, -1], [0, -1], [0, 1], [-.14, 1]], G.ink, .42); G.line([[0, 0], [.14, 0]], G.ink, .42);
      G.pub('start', 0, -1); G.pub('end', 0, 1); G.pub('middle', .14, 0);
    },
    lens(G) {
      const o = ell(-.16, -.16, .74, .74, 40), i = ell(-.16, -.16, .67, .67, 40);
      G.outline(o, G.ink, .5); G.outline(i, G.ink, .22); G.line([[-.56, -.48], [-.42, -.58]], G.ink, .25);
      const hd = tube([[.38, .38], [.96, .96]], .07); G.fill(hd, G.c, { pressure: .95 }); G.outline(hd, G.ink, .32);
      G.pub('lens', -.16, -.16); G.pub('handle', .96, .96);
    },
  };

  K.partFigure = (it, ctx) => {
    const draw = P[it.part];
    if (!draw) throw new Error(`no part named "${it.part}"; the box has ${Object.keys(P).join(', ')}`);
    return { draw(E) { draw(frame(it, E), it, ctx, E); } };
  };

  // ---------- custom drawing: pens, scales and data, and nothing else ----------
  const SHUT = ['window', 'document', 'globalThis', 'self', 'fetch', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage', 'navigator', 'location'];
  K.customFigure = (it, ctx, host, H) => {
    const [x0, y0] = it.at || [0, 0], W = it.width || 60, HH = it.height || W * .5, id = it.id || 'custom', box = h('div', 'custom');
    box.style.cssText = `left:${x0}%;top:${y0 / H * 100}%;width:${W}%;height:${HH / H * 100}%`; host.appendChild(box);
    const run = new Function(...SHUT, 'api', `"use strict"; const { line, curve, dot, ring, fill, text, arrow, part, pub, x, y, w, h, data, fmt, sin, cos, PI, TAU } = api;\n${it.code}`);
    return { draw(E) {
      box.innerHTML = '';
      const sc = it.scale || {}, range = v => list(v).map(e => val(e, ctx.scope)), [a, b] = range(sc.x || [0, W]), [c, d] = range(sc.y || [HH, 0]);
      const x = v => (v - a) / (b - a) * W, y = v => HH - (v - c) / (d - c) * HH, at = p => E.u(x0 + p[0], y0 + p[1]), color = o => col(E.pal, o && o.color, E.ink);
      const stroke = (pts, o = {}) => { const P2 = E.pen(color(o), o.nib ?? .35); o.exact ? P2.exact(pts, { wmul: o.wmul ?? 1 }) : P2.stroke(pts, { tremor: .2 }); };
      const api = { x, y, w: W, h: HH, sin: Math.sin, cos: Math.cos, PI: Math.PI, TAU, fmt: (v, n = 2) => (+v).toFixed(n),
        data: new Proxy({}, { get: (_, k) => { if (typeof k !== 'string' || !(k in ctx.scope)) throw new Error(`no data named "${String(k)}"`); return ctx.scope[k]; } }),
        line: (pts, o) => stroke(pts.map(at), o), curve: (pts, o) => stroke(K.catmull(pts.map(at), .4), o), dot: (p, r = 1, o) => { E.pen(color(o), .3).exactDot(at(p), r * E.unit, { pressure: .9 }); E.mark(x0 + p[0], y0 + p[1]); },
        ring: (p, r, o) => E.pen(color(o), (o && o.nib) ?? .35).circle(at(p), r * E.unit, { tremor: .2 }), fill: (pts, o = {}) => E.S.tool('pastelpencil', { color: col(E.pal, o.color, E.pal.wash), point: 'blunt' }).fillWith(pts.map(at), { angle: o.angle ?? 30, pressure: o.pressure ?? .8 }),
        arrow: (p, q, o) => { const A = at(p), B = at(q); stroke([A, B], o); K.arrowhead(E.S, B, A, { c1: color(o), edge: color(o) }, (o && o.size) ?? 3); },
        text: (px, py, s, o = {}) => { const t = h('div', 'lab', L.md(String(s))); t.style.left = `${px / W * 100}%`; t.style.top = `${py / HH * 100}%`; t.style.transform = `translate(${o.align === 'center' ? '-50%' : o.align === 'right' ? '-100%' : '0'}, -50%)`; if (o.size) t.style.setProperty('--fs', o.size * 100 / W); if (o.color) t.style.color = col(E.pal, o.color); box.appendChild(t); },
        part: (name, o) => { if (!P[name]) throw new Error(`no part named "${name}"`); const q = { ...o, part: name, at: [x0 + o.at[0], y0 + o.at[1]] }; P[name](frame(q, E), q, ctx, E); },
        pub: (n, px, py) => E.pub(n, x0 + px, y0 + py) };
      try { run(...SHUT.map(() => undefined), api); } catch (e) { throw new Error(`custom drawing "${id}": ${e.message}`); }
      L.fill(box, ctx.scope);
    } };
  };
})();
