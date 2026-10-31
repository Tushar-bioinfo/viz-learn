/* viz-os sketch: the marks that join sheets: the twisted thread, its tags, arrowheads and leader lines.
   Adapted from statechart-art's art/marks.js (MIT, see NOTICE), for the browser pens in pens.js. All units are mm. */
(function () {
  'use strict';
  const K = window.VizOS.sketch;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], len = v => Math.hypot(v[0], v[1]);

  function lengthOf(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += len(sub(pts[i], pts[i - 1])); return s; }
  function at(pts, t) {
    const total = lengthOf(pts) * t; let s = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = len(sub(pts[i], pts[i - 1]));
      if (s + d >= total) { const u = d ? (total - s) / d : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u]; }
      s += d;
    }
    return pts[pts.length - 1];
  }
  function resample(pts, step) { const n = Math.max(2, Math.ceil(lengthOf(pts) / step)), out = []; for (let i = 0; i <= n; i++) out.push(at(pts, i / n)); return out; }
  function strands(pts, amp, period) {
    const s = resample(pts, .25), A = [], B = []; let acc = 0;
    for (let i = 0; i < s.length; i++) {
      const p = s[i], q = s[Math.min(s.length - 1, i + 1)], r = s[Math.max(0, i - 1)], d = sub(q, r), l = len(d) || 1, n = [-d[1] / l, d[0] / l];
      if (i) acc += len(sub(s[i], s[i - 1]));
      const w = amp * Math.sin(acc / period * K.TAU);
      A.push({ p: [p[0] + n[0] * w, p[1] + n[1] * w], s: acc }); B.push({ p: [p[0] - n[0] * w, p[1] - n[1] * w], s: acc });
    }
    return { A, B };
  }

  // two strands that swap front and back every half turn, each over a dark edge, so the cord reads as twisted
  function cord(S, pts, th) {
    const amp = th.amp ?? .95, period = th.period ?? 5, half = period / 2, { A, B } = strands(K.catmull(pts, .5), amp, period), segs = [];
    const split = (St, which) => { let cur = [], idx = 0; for (const q of St) { const i = Math.floor(q.s / half); if (i !== idx && cur.length) { segs.push({ pts: cur, front: (idx + which) % 2 === 0, c: which }); cur = [cur[cur.length - 1]]; idx = i; } cur.push(q.p); } if (cur.length > 1) segs.push({ pts: cur, front: (idx + which) % 2 === 0, c: which }); };
    split(A, 0); split(B, 1);
    const edge = S.tool('fineliner', { nib: 1.7, color: th.edge, kind: 'technical' }), t1 = S.tool('pastelpencil', { color: th.c1, point: 'blunt' }), t2 = S.tool('pastelpencil', { color: th.c2, point: 'blunt' });
    for (const pass of [false, true]) for (const g of segs) if (g.front === pass && g.pts.length > 1) {
      edge.stroke(g.pts, { tremor: .15, profile: 'even', smooth: .1 });
      (g.c ? t2 : t1).stroke(g.pts, { tremor: .15, profile: 'even', pressure: .95, smooth: .1 });
    }
  }

  function arrowhead(S, tip, from, th, size = 4.2) {
    const d = sub(tip, from), l = len(d) || 1, u = [d[0] / l, d[1] / l], n = [-u[1], u[0]], w = size * .46;
    const base = [tip[0] - u[0] * size, tip[1] - u[1] * size], notch = [tip[0] - u[0] * size * .72, tip[1] - u[1] * size * .72];
    const tri = [tip, [base[0] + n[0] * w, base[1] + n[1] * w], notch, [base[0] - n[0] * w, base[1] - n[1] * w]];
    const t = S.tool('pencil', { color: th.c1 }); t.fillWith(tri, { pressure: 1 }); t.fillWith(tri, { angle: 60, pressure: 1 });
    S.tool('fineliner', { nib: .22, color: th.edge, kind: 'technical' }).poly(tri, true);
  }

  // a paper label: a soft shadow, three passes of pastel, a thin edge
  function tag(S, r, pal, seed) {
    const R = K.rng('tag:' + seed), pts = [], j = .35;
    const edge = (a, b, n) => { for (let i = 0; i < n; i++) { const t = i / n; pts.push([a[0] + (b[0] - a[0]) * t + (R() - .5) * j, a[1] + (b[1] - a[1]) * t + (R() - .5) * j]); } };
    const { x, y, w, h } = r;
    edge([x, y], [x + w, y], 10); edge([x + w, y], [x + w, y + h], 4); edge([x + w, y + h], [x, y + h], 10); edge([x, y + h], [x, y], 4);
    S.tool('pencil', { color: pal.edge }).fillWith(pts.map(p => [p[0] + .7, p[1] + .9]), { pressure: .5 });
    const t = S.tool('pastelpencil', { color: pal.tag, point: 'blunt' });
    [15, -50, 65].forEach(angle => t.fillWith(pts, { angle, pressure: 1 }));
    S.tool('fineliner', { nib: .25, color: pal.edge, kind: 'technical' }).poly(pts, true);
  }

  // the line from a label to what it names; it stops short of both, so it points without touching
  function leader(S, a, b, color) {
    const d = sub(b, a), l = len(d); if (l < 3) return;
    const u = [d[0] / l, d[1] / l], from = [a[0] + u[0], a[1] + u[1]], to = [b[0] - u[0] * 1.4, b[1] - u[1] * 1.4], n = [-u[1], u[0]], m = l * .06;
    S.tool('fineliner', { nib: .22, color, kind: 'technical' }).stroke(K.catmull([from, [(from[0] + to[0]) / 2 + n[0] * m, (from[1] + to[1]) / 2 + n[1] * m], to], .6), { tremor: .25, smooth: .3 });
  }

  // the small cross that ends a red branch
  function breakMark(S, c, r, pal) {
    const T = S.tool(pal.pen, { color: pal.red, nib: .7, kind: 'technical' });
    T.line([c[0] - r, c[1] - r], [c[0] + r, c[1] + r], { smooth: .4 }); T.line([c[0] + r, c[1] - r], [c[0] - r, c[1] + r], { smooth: .4 });
  }

  const themes = (pal) => ({
    gold: { c1: pal.gold, c2: pal.gold2, edge: pal.cord }, red: { c1: pal.red, c2: pal.red2, edge: pal.edge }, pale: { c1: pal.pale, c2: pal.pale, edge: pal.edge, amp: .6 },
  });
  Object.assign(K, { cord, arrowhead, tag, leader, breakMark, themes, lengthOf, pointAt: at, resample });
})();
