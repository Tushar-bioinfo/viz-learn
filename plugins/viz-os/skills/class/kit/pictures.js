/* viz-os class: a scene's picture (N12c, the user's Review 11: every page after the opening has a figure that gives the idea
   at a glance, like a blog post's picture). `picture:` on a board scene draws one wide drawing under the scene's head, above
   its table and steps, in the cover's "inks on black" look (cover.js VizOS.cover.scene: felt-tip line, fills set off the
   line, halftone shade, two dim corner blooms). Every position and number in it is worked from the data, the scene's derive
   and the symbols, never typed; colours and number formats are the symbols'. It does not move: no Next, no control.
   Kinds (board.md, Scene pictures; the lint keeps their fields, lesson_lint.py PICTURE):
     ruler    rows on one axis, balanced on a pin (the mean), an arm from the pin to each row
     cast     each row as a drawn cell carrying the square of an expression
     machine  the formula's steps as stations (`stations`), or its terms as a running total (`terms`)
     grid     one row's shadow on an arrow, its square opened into four tiles, the 2 × 2 sum they come from
     pair     two lists on one shared scale, each value's squared distance from its list's mean, one number each
     ghost    a cloud and its line, and the same cloud rescaled with its line, dashed: how far the line turns */
(() => {
  const L = window.VizOS, h = L.h, CV = L.cover, list = x => Array.isArray(x) ? x : x == null ? [] : [x];
  const READ = 1100;   // a wide item's column (board.js READ)

  // ---- reading the lesson: names, rows, colours, formats
  function reader(s, ctx, issues) {
    const where = k => `slide ${ctx.index + 1} picture ${k}`;
    const sym = n => (typeof n === 'string' && (ctx.symbols || {})[n]) || {};
    const val = (x, k) => L.val(x, ctx.scope, where(k));
    const num = (x, k) => { const v = +val(x, k); if (!Number.isFinite(v)) issues.push(`the picture's \`${k}\` (${x}) is not a number`); return v; };
    const rows = (from, k = 'from') => { const v = val(from, k); if (!Array.isArray(v) || !v.some(r => r && typeof r === 'object')) { issues.push(`the picture's \`${k}: ${from}\` is not a list of rows`); return []; } return v.filter(r => r && typeof r === 'object'); };
    const onRow = (x, r, k) => +L.val(x, L.scope(ctx.scope, r), where(k));   // a column expression on one row: the row's keys first
    const nums = (x, k) => { const v = val(x, k); if (!Array.isArray(v)) { issues.push(`the picture's \`${k}: ${x}\` is not a list of numbers`); return []; } return v.map(Number); };
    const C = k => (k && CV.C(k)) || null;
    // a name's colour as hex: the symbol's, else the first coloured symbol the expression reads
    const ink = x => { if (typeof x !== 'string') return null; const own = C(sym(x).color); if (own) return own;
      try { for (const n of L.names(L.parse(x))) { const c = C(sym(n).color); if (c) return c; } } catch (e) { /* not an expression */ } return null; };
    const fmtOf = (x, own) => own ?? sym(x).fmt ?? 2;
    const fmt = (v, x, own) => L.fmt(v, fmtOf(x, own));
    const short = x => sym(x).short || String(x);
    const tex = x => L.tex(String(x), { sym: n => sym(n).tex || L.autoSym(n) });
    const words = t => L.plain(String(t ?? ''), ctx.scope);
    return { sym, val, num, rows, onRow, nums, C, ink, fmt, fmtOf, short, tex, words, issues };
  }

  // ---- drawing helpers on the cover engine
  const box = (x, y, w, hh) => [[x, y], [x + w, y], [x + w, y + hh], [x, y + hh]];
  const ring = (x, y, r, n = 14) => Array.from({ length: n }, (_, i) => [x + Math.cos(i / n * Math.PI * 2) * r, y + Math.sin(i / n * Math.PI * 2) * r]);
  const seg = (S, a, b, o = {}) => S.line([a, b], { closed: false, smooth: false, ...o });
  function arrow(S, a, b, o = {}) {
    seg(S, a, b, o); const t = Math.atan2(b[1] - a[1], b[0] - a[0]), k = o.head || 8;
    S.line([[b[0] - k * Math.cos(t - .5), b[1] - k * Math.sin(t - .5)], b, [b[0] - k * Math.cos(t + .5), b[1] - k * Math.sin(t + .5)]], { closed: false, smooth: false, wk: o.wk, ink: o.ink });
  }
  function dashed(S, a, b, o = {}) {   // short felt dashes, 7 on and 6 off
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(d / 13));
    for (let i = 0; i < n; i++) { const t0 = i / n, t1 = t0 + 7 / 13 / n, p = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; seg(S, p(t0), p(t1), { wk: .45, ...o }); }
  }
  function dot(S, x, y, r, c) { S.fill(ring(x, y, r, 12), c); S.line(ring(x, y, r, 12), { wk: .45 }); }
  function ticks(lo, hi, want = 6) {
    const span = hi - lo || 1, mag = 10 ** Math.floor(Math.log10(span / want)), step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(q => span / q <= want) || 10 * mag, out = [];
    for (let t = Math.ceil(lo / step - 1e-9) * step; t <= hi + 1e-9; t += step) out.push(+t.toFixed(10));
    return { out, dec: Math.max(0, -Math.floor(Math.log10(step) + 1e-9) + (step / mag === 2.5 ? 1 : 0)) };
  }
  function axis(S, X, lo, hi, y, label, mute) {   // a felt rule with ticks and their numbers
    seg(S, [X(lo), y], [X(hi), y], { wk: .9 }); const T = ticks(lo, hi);
    T.out.forEach(t => { seg(S, [X(t), y], [X(t), y + 7], { wk: .4 }); S.text(X(t), y + 25, L.fmt(t, T.dec), { size: 14, anchor: 'middle', weight: 500, ink: mute }); });
    if (label) S.text(X(hi), y + 50, label, { size: 14, anchor: 'end', weight: 500, ink: mute });
  }
  const span = (vs, padK = .08) => { const lo = Math.min(...vs), hi = Math.max(...vs), p = (hi - lo) * padK || 1; return [lo - p, hi + p]; };

  // ---------- ruler: rows on one axis, balanced on a pin; an arm from the pin to each row, its signed distance at the tip ----------
  function ruler(p, E, W, S0) {
    const R = E.rows(p.from), lab = p.label || 'id', xs = R.map(r => E.onRow(p.x, r, 'x')), pin = E.num(p.pin, 'pin'), n = R.length;
    const [lo, hi] = span([...xs, pin]), X = v => 90 + (v - lo) / (hi - lo) * (W - 180), top = 30, beam = top + n * 26 + 70, H = beam + 70;
    const S = S0(H), mute = CV.mix(S.key, S.bg, .4), cx = E.ink(p.x) || S.key, cp = E.ink(p.pin) || S.key, acc = E.C('accent'), lit = p.lit != null ? E.num(p.lit, 'lit') : null;
    R.forEach((r, i) => { const y = top + i * 26, d = xs[i] - pin, on = i === lit, c = on ? acc : S.key, x0 = X(pin), x1 = X(xs[i]), right = x1 >= x0;
      if (Math.abs(x1 - x0) > 6) arrow(S, [x0, y], [x1, y], { wk: on ? .75 : .5, ink: c, head: 7 });
      S.text(x1 + (right ? 12 : -12), y + 5, `${r[lab] ?? i + 1}  ${E.fmt(d, p.pin, p.fmt)}`, { size: 14, anchor: right ? 'start' : 'end', weight: on ? 700 : 500, ink: on ? acc : mute }); });
    dashed(S, [X(pin), top - 14], [X(pin), beam - 6], { ink: cp });
    const done = [];
    xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]).forEach(([v, i]) => { let y = beam - 24; for (const t of [0, 1, 2, 3]) { y = beam - 24 - t * 34; if (done.every(q => Math.hypot(q[0] - X(v), q[1] - y) > 36)) break; }
      done.push([X(v), y]); S.part('tcell', X(v), y, 38, i === lit ? acc : cx, 'r' + i); });
    seg(S, [X(lo), beam], [X(hi), beam], { wk: 1 });
    const T = ticks(lo, hi);
    T.out.forEach(t => { seg(S, [X(t), beam], [X(t), beam + 7], { wk: .4 }); if (Math.abs(X(t) - X(pin)) > 34) S.text(X(t), beam + 25, L.fmt(t, T.dec), { size: 14, anchor: 'middle', weight: 500, ink: mute }); });
    const tri = [[X(pin), beam + 3], [X(pin) + 15, beam + 30], [X(pin) - 15, beam + 30]];
    S.fill(tri, cp, { smooth: false }); S.line(tri, { smooth: false, wk: .7 });
    S.text(X(pin), beam + 54, typeof p.pin === 'number' ? E.fmt(pin, null, p.fmt ?? 2) : `${E.short(p.pin)} ${E.fmt(pin, p.pin)}`,   // a bare number has no name to show
      { size: 15, anchor: 'middle', weight: 650, ink: cp });
    S.text(X(hi), beam + 54, p.axis != null ? E.words(p.axis) : E.short(p.x), { size: 14, anchor: 'end', weight: 500, ink: mute });
    return S;
  }

  // ---------- cast: each row a drawn cell, carrying the square of `square` (worked on its row) above it ----------
  function cast(p, E, W, S0) {
    const R = E.rows(p.from), lab = p.label || 'id', n = R.length, H = 330, S = S0(H), mute = CV.mix(S.key, S.bg, .4), acc = E.C('accent');
    const ds = R.map(r => E.onRow(p.square, r, 'square')), lit = new Set(p.lit != null ? list(E.val(p.lit, 'lit')).map(String) : []);
    const gap = (W - 80) / Math.max(1, n), most = Math.max(...ds.map(Math.abs), 1e-9), k = Math.min(gap * .82, 150) / most, base = 214, c0 = E.ink(p.square) || S.key;
    R.forEach((r, i) => { const cx = 40 + gap * (i + .5), sd = Math.abs(ds[i]) * k, on = lit.has(String(r[lab])), sq = box(cx - sd / 2, base - sd, sd, sd);
      if (sd > 1) { S.fill(sq, on ? acc : c0, { smooth: false, tone: on ? null : .45 }); S.line(sq, { smooth: false, wk: .6 }); }
      S.text(cx, base - sd - 12, E.fmt(ds[i] * ds[i], null, p.fmt ?? 's3'), { size: 15, anchor: 'middle', weight: on ? 700 : 500, ink: on ? acc : S.key });
      S.part('tcell', cx, base + 40, 44, on ? acc : c0, 'c' + i);
      S.text(cx, base + 96, String(r[lab] ?? i + 1), { size: 14, anchor: 'middle', weight: 600, ink: mute }); });
    return S;
  }

  // ---------- machine: the formula's steps as stations a list passes through, or its terms added as a running total ----------
  // Station ops: values (the list), minus (each value less `of`), square, sum, share (the sum cut into `by` equal shares).
  // `out` on a station names the symbol its result is: the kit checks they agree and shows its number in its colour
  const HEADS = { values: (q, E, x) => E.tex(x), minus: (q, E, x) => E.tex(`${x} - ${q.of}`), square: () => '(\\,\\cdot\\,)^2', sum: () => '\\sum', share: (q, E) => `\\div\\,(${E.tex(q.by)})` };
  function machine(p, E, W, S0, heads, issues) {
    return p.terms ? terms(p, E, W, S0, heads, issues) : chain(p, E, W, S0, heads, issues);
  }
  function chain(p, E, W, S0, heads, issues) {
    const st = list(p.stations).filter(q => q && typeof q === 'object'), k = st.length, ga = 40, cw = (W - ga * (k - 1)) / Math.max(1, k), bh = 176, H = bh + 40, S = S0(H);
    const mute = CV.mix(S.key, S.bg, .4), cx = E.ink(p.x) || S.key, acc = E.C('accent');
    const xs = p.from != null ? E.rows(p.from).map(r => E.onRow(p.x, r, 'x')) : E.nums(p.x, 'x'), n = xs.length, mid = bh / 2;
    let cur = xs, total = null, devs = null;
    const spread = Math.max(...xs.map(v => Math.abs(v - xs.reduce((a, b) => a + b, 0) / n)), 1e-9), ky = 62 / spread;
    const px = (c, i) => c + (i - (n - 1) / 2) * Math.min(28, (cw - 24) / Math.max(1, n));
    st.forEach((q, j) => { const x0 = j * (cw + ga), c = x0 + cw / 2, oc = E.ink(q.out) || E.ink(q.of) || acc;
      if (j) arrow(S, [x0 - ga + 8, mid], [x0 - 8, mid], { wk: .5, ink: mute, head: 7 });
      let res = null;
      if (q.op === 'values') { const m = cur.reduce((a, b) => a + b, 0) / n; cur.forEach((v, i) => dot(S, px(c, i), mid - (v - m) * ky, 6, cx)); }
      else if (q.op === 'minus') { const o = E.num(q.of, 'of'), co = E.ink(q.of) || S.key; devs = cur.map(v => v - o); cur = devs;
        dashed(S, [x0 + 6, mid], [x0 + cw - 6, mid], { ink: co });
        devs.forEach((d, i) => { if (Math.abs(d * ky) > 2) seg(S, [px(c, i), mid], [px(c, i), mid - d * ky], { wk: .9 }); dot(S, px(c, i), mid - d * ky, 4, cx); }); }
      else if (q.op === 'square') { const tot = cur.reduce((a, d) => a + Math.abs(d), 0) || 1, ks = Math.min((cw - 16 - 4 * (n - 1)) / tot, 90 / Math.max(...cur.map(Math.abs), 1e-9)), b0 = mid + 46;
        let x = c - (tot * ks + 4 * (n - 1)) / 2;   // side by side, bottoms on one line: the squares' sizes compare at a glance
        cur.forEach(d => { const sd = Math.abs(d) * ks; if (sd > 1) { const sq = box(x, b0 - sd, sd, sd); S.fill(sq, cx, { smooth: false, tone: .55 }); S.line(sq, { smooth: false, wk: .45 }); } x += sd + 4; });
        seg(S, [x0 + 8, b0], [x0 + cw - 8, b0], { wk: .4, ink: mute }); cur = cur.map(d => d * d); }
      else if (q.op === 'sum') { total = cur.reduce((a, b) => a + b, 0); res = total; let x = x0 + 10; const wpu = (cw - 20) / (total || 1);
        cur.forEach((v, i) => { const w = v * wpu; if (w > .5) { const b = box(x, mid - 14, w, 28); S.fill(b, cx, { smooth: false, tone: i % 2 ? .35 : .65 }); S.line(b, { smooth: false, wk: .4 }); } x += w; }); }
      else if (q.op === 'share') { const by = E.num(q.by, 'by'), m = Math.max(1, Math.min(30, Math.round(by))), sw = (cw - 20) / m; total = total ?? cur.reduce((a, b) => a + b, 0); res = total / by;
        if (Math.abs(by - m) > 1e-9) issues.push(`the machine's share \`by: ${q.by}\` is ${by}: cut into a whole number of shares`);
        for (let i = 0; i < m; i++) { const b = box(x0 + 10 + i * sw, mid - 14, sw - 4, 28); S.fill(b, i ? S.key : oc, { smooth: false, tone: i ? .12 : null }); S.line(b, { smooth: false, wk: .4 }); } }
      if (res != null) { if (q.out != null) { const want = E.num(q.out, 'out'); if (Math.abs(want - res) > 1e-9 * Math.max(1, Math.abs(res))) issues.push(`the machine's ${q.op} gives ${res}, but \`${q.out}\` is ${want}: they must agree`); }
        S.text(q.op === 'share' ? x0 + 10 + (cw - 20) / Math.max(1, Math.round(E.num(q.by, 'by'))) / 2 : c, mid - 28, E.fmt(res, q.out, q.fmt ?? 3), { size: 16, anchor: 'middle', weight: 700, ink: oc }); }
      if (q.say != null) S.text(c, bh + 26, E.words(q.say), { size: 15, anchor: 'middle', weight: 500, ink: mute });
      heads.push({ x: c, tex: (HEADS[q.op] || (() => ''))(q, E, p.x) + (q.out != null ? ` = ${E.tex(q.out)}` : '') }); });
    return S;
  }
  function terms(p, E, W, S0, heads, issues) {
    const T = list(p.terms).filter(q => q && typeof q === 'object'), n = T.length, cw = (W - 40) / (n + 1), acc = E.C('accent');
    const raw = T.map(q => E.num(q.of, 'of')), wt = T.map(q => E.num(q.w, 'w')), part = raw.map((v, i) => v * wt[i]), run = [0];
    part.forEach(v => run.push(run[run.length - 1] + v));
    const total = run[n], all = [0, ...raw, ...run], lo = Math.min(...all), hi = Math.max(...all), k = 190 / ((hi - lo) || 1), y0 = 30 + hi * k, H = 30 + (hi - lo) * k + 74, S = S0(H), mute = CV.mix(S.key, S.bg, .4);
    const Y = v => y0 - v * k, oc = E.ink(p.out) || acc;
    if (p.out != null) { const want = E.num(p.out, 'out'); if (Math.abs(want - total) > 1e-9 * Math.max(1, Math.abs(total))) issues.push(`the machine's terms add to ${total}, but \`${p.out}\` is ${want}: they must agree`); }
    seg(S, [20, y0], [W - 20, y0], { wk: .45, ink: mute });
    T.forEach((q, i) => { const x = 20 + cw * i, c = E.ink(q.of) || S.key, gx = x + cw * .14, gw = cw * .22, bx = x + cw * .46, bw = cw * .3;
      const g = box(gx, Math.min(Y(0), Y(raw[i])), gw, Math.abs(Y(raw[i]) - Y(0))); S.line(g, { smooth: false, wk: .4, ink: mute });
      S.text(gx + gw / 2, raw[i] >= 0 ? Y(raw[i]) - 8 : Y(raw[i]) + 20, E.fmt(raw[i], q.of), { size: 14, anchor: 'middle', weight: 500, ink: mute });
      const a = Y(run[i]), b = Y(run[i + 1]), bar = box(bx, Math.min(a, b), bw, Math.max(1, Math.abs(b - a)));
      S.fill(bar, c, { smooth: false, tone: part[i] < 0 ? .5 : null }); S.line(bar, { smooth: false, wk: .55 });
      S.text(bx + bw / 2, part[i] >= 0 ? Math.min(a, b) - 9 : Math.max(a, b) + 21, E.fmt(part[i], p.out, p.fmt ?? 3), { size: 15, anchor: 'middle', weight: 650, ink: c });
      dashed(S, [bx + bw, b], [20 + cw * (i + 1) + cw * .46, b], { ink: mute, wk: .35 });
      S.text(x + cw * .45, H - 14, `${E.fmt(raw[i], q.of)} × ${E.fmt(wt[i], q.w, 2)}`, { size: 14, anchor: 'middle', weight: 500, ink: mute });
      heads.push({ x: x + cw * .45, tex: `${E.tex(q.w)}\\,${E.tex(q.of)}` }); });
    const x = 20 + cw * n, bx = x + cw * .3, bw = cw * .36, bar = box(bx, Math.min(Y(0), Y(total)), bw, Math.max(1, Math.abs(Y(total) - Y(0))));
    S.fill(bar, oc, { smooth: false }); S.shade(bar, { smooth: false }); S.line(bar, { smooth: false, wk: .8 });
    S.text(bx + bw / 2, total >= 0 ? Y(total) - 10 : Y(total) + 22, E.fmt(total, p.out, p.fmt), { size: 17, anchor: 'middle', weight: 750, ink: oc });
    if (p.out != null) { S.text(bx + bw / 2, H - 14, E.short(p.out), { size: 14, anchor: 'middle', weight: 600, ink: oc }); heads.push({ x: bx + bw / 2, tex: E.tex(p.out) }); }
    return S;
  }

  // ---------- grid: one row's shadow on an arrow; the shadow squared, opened into four tiles; the 2 × 2 sum it feeds ----------
  function grid(p, E, W, S0) {
    const H = 340, S = S0(H), mute = CV.mix(S.key, S.bg, .4), acc = E.C('accent'), r = E.rows(p.from)[+(p.row ?? 0)] || {}, lab = p.label || 'id';
    const x = E.onRow(p.x, r, 'x'), y = E.onRow(p.y, r, 'y'), [a1, a2] = list(p.arrow).map((q, i) => E.num(q, `arrow ${i + 1}`)), cxx = E.ink(p.x) || S.key, cyy = E.ink(p.y) || S.key;
    const sh = a1 * x + a2 * y, a = a1 * x, b = a2 * y, w1 = W * .34, w2 = W * .3;
    // panel 1: the plane, the arrow, the row's dot and its shadow
    const ox = w1 / 2, oy = 170, k = 118 / Math.max(Math.abs(x), Math.abs(y), Math.abs(sh), 1), P = (u, v) => [ox + u * k, oy - v * k];
    seg(S, [ox - 150, oy], [ox + 150, oy], { wk: .35, ink: mute }); seg(S, [ox, oy - 140], [ox, oy + 140], { wk: .35, ink: mute });
    S.text(ox + 150, oy + 20, E.short(p.x), { size: 14, anchor: 'end', weight: 500, ink: cxx }); S.text(ox + 8, oy - 128, E.short(p.y), { size: 14, weight: 500, ink: cyy });
    const ul = Math.hypot(a1, a2) || 1, ux = a1 / ul, uy = a2 / ul;
    if (Math.abs(ul - 1) > 1e-3) E.issues.push(`the grid's \`arrow\` has length ${L.fmt(ul, 3)}: the shadow is a dot product with a unit arrow, so give one of length 1`);
    dashed(S, P(-ux * 1.25 * 118 / k, -uy * 1.25 * 118 / k), P(ux * 1.25 * 118 / k, uy * 1.25 * 118 / k), { ink: mute, wk: .35 });
    dashed(S, P(x, y), P(sh * ux, sh * uy), { ink: S.key, wk: .4 });
    seg(S, P(0, 0), P(sh * ux, sh * uy), { wk: 2.2, ink: acc });
    arrow(S, P(0, 0), P(a1 * .7 * 118 / k, a2 * .7 * 118 / k), { wk: .8, head: 9 });
    S.part('tcell', ...P(x, y), 30, cxx, 'g');
    { const [px, py] = P(x, y), [fx, fy] = P(sh * ux, sh * uy), dl = Math.hypot(px - fx, py - fy), nx = dl > 8 ? (px - fx) / dl : 0, ny = dl > 8 ? (py - fy) / dl : -1;   // the cell's name, off the side away from the arrow's line
      S.text(px + nx * 30, py + ny * 30 + 5, String(r[lab] ?? ''), { size: 14, anchor: nx > .3 ? 'start' : nx < -.3 ? 'end' : 'middle', weight: 600, ink: S.key }); }
    S.text(P(sh * ux, sh * uy)[0] + (ux >= 0 ? 12 : -12), P(sh * ux, sh * uy)[1] + (sh * uy >= 0 ? -10 : 26), E.fmt(sh, null, p.fmt ?? 2), { size: 15, anchor: ux >= 0 ? 'start' : 'end', weight: 700, ink: acc });
    // panel 2: (a + b)² as four tiles; a tile is solid when its piece adds, halftone when it takes away
    const q = 168 / ((Math.abs(a) + Math.abs(b)) || 1), A = Math.abs(a) * q, B = Math.abs(b) * q, gx = w1 + (w2 - A - B) / 2 + 10, gy = 60;
    const tile = (tx, ty, tw, th, c, v) => { if (tw < 1 || th < 1) return; const t = box(tx, ty, tw, th); S.fill(t, c, { smooth: false, tone: v < 0 ? .5 : null }); S.line(t, { smooth: false, wk: .5 }); };
    seg(S, [gx, gy - 14], [gx + A, gy - 14], { wk: 1.1, ink: cxx }); seg(S, [gx + A + 4, gy - 14], [gx + A + B, gy - 14], { wk: 1.1, ink: cyy });
    seg(S, [gx - 14, gy], [gx - 14, gy + A], { wk: 1.1, ink: cxx }); seg(S, [gx - 14, gy + A + 4], [gx - 14, gy + A + B], { wk: 1.1, ink: cyy });
    S.text(gx + A / 2, gy - 26, E.fmt(a, null, p.fmt ?? 2), { size: 14, anchor: 'middle', weight: 600, ink: cxx });
    S.text(gx + A + B / 2 + (B < 40 ? 16 : 0), gy - 26, E.fmt(b, null, p.fmt ?? 2), { size: 14, anchor: B < 40 ? 'start' : 'middle', weight: 600, ink: cyy });
    const cm = E.C('s3') || S.key;
    tile(gx, gy, A, A, cxx, 1); tile(gx + A, gy, B, A, cm, a * b); tile(gx, gy + A, A, B, cm, a * b); tile(gx + A, gy + A, B, B, cyy, 1);
    const tl = (tx, ty, v, c, anchor = 'middle') => S.text(tx, ty, E.fmt(v, null, p.fmt ?? 2), { size: 14, anchor, weight: 650, ink: c });
    tl(gx + A / 2, gy + A / 2 + 5, a * a, S.key); tl(gx + A + B + 8, gy + A / 2 + 5, a * b, cm, 'start'); tl(gx + A / 2, gy + A + B + 20, a * b, cm); tl(gx + A + B + 8, gy + A + B / 2 + 5, b * b, cyy, 'start');
    S.text(w1 + w2 / 2 + 10, H - 16, `= ${E.fmt(sh * sh, null, p.fmt ?? 2)}`, { size: 16, anchor: 'middle', weight: 700, ink: acc });
    // panel 3: the 2 × 2 sum, each cell a square whose area is its size, in brackets
    const M = list(p.sum).map(row => list(row)), mx = w1 + w2 + 60, cell = (W - mx - 40) / 2, big = Math.max(...M.flat().map(v => Math.abs(E.num(v, 'sum'))), 1e-9);
    arrow(S, [w1 + w2 - 10, 170], [mx - 24, 170], { wk: .5, ink: mute, head: 7 });
    const top = 170 - cell;
    seg(S, [mx - 4, top], [mx - 12, top], { wk: .7 }); seg(S, [mx - 12, top], [mx - 12, top + 2 * cell], { wk: .7 }); seg(S, [mx - 12, top + 2 * cell], [mx - 4, top + 2 * cell], { wk: .7 });
    seg(S, [mx + 2 * cell + 4, top], [mx + 2 * cell + 12, top], { wk: .7 }); seg(S, [mx + 2 * cell + 12, top], [mx + 2 * cell + 12, top + 2 * cell], { wk: .7 }); seg(S, [mx + 2 * cell + 12, top + 2 * cell], [mx + 2 * cell + 4, top + 2 * cell], { wk: .7 });
    M.forEach((row, i) => row.forEach((nm, j) => { const v = E.num(nm, 'sum'), sd = Math.sqrt(Math.abs(v) / big) * cell * .78, cx = mx + cell * (j + .5), cy = top + cell * (i + .5), c = E.ink(nm) || S.key;
      if (sd > 1) { const t = box(cx - sd / 2, cy - sd / 2, sd, sd); S.fill(t, c, { smooth: false, tone: v < 0 ? .5 : null }); S.line(t, { smooth: false, wk: .5 }); }
      S.text(cx, cy + 6, E.fmt(v, nm), { size: 15, anchor: 'middle', weight: 700, ink: S.key }); }));
    return S;
  }

  // ---------- pair: two lists on one shared scale; each value's squared distance from its list's mean; one number each ----------
  function pair(p, E, W, S0) {
    const sides = ['a', 'b'].map((k, i) => { const q = p[k] || {}; return { q, vs: E.nums(q.values, `${k} values`), c: E.C(q.color || (i ? 's2' : 's1')) }; });
    const all = sides.flatMap(sd => sd.vs), [lo, hi] = span(all), X = v => 190 + (v - lo) / (hi - lo) * (W - 420), H = 400, S = S0(H), mute = CV.mix(S.key, S.bg, .4);
    sides.forEach(sd => { sd.m = sd.vs.reduce((a, b) => a + b, 0) / (sd.vs.length || 1); });
    const big = Math.max(...sides.flatMap(sd => sd.vs.map(v => Math.abs(v - sd.m))), 1e-9), ks = 92 / big;
    sides.forEach((sd, k) => { const base = 158 + k * 168;
      if (k) axis(S, X, lo, hi, base, p.axis != null ? E.words(p.axis) : '', mute); else seg(S, [X(lo), base], [X(hi), base], { wk: .7, ink: mute });   // the shared scale's numbers under the second list
      dashed(S, [X(sd.m), base - 130], [X(sd.m), base + 4], { ink: sd.c });
      if (p.square !== false) sd.vs.forEach(v => { const s = Math.abs(v - sd.m) * ks; if (s > 1) { const b = box(X(v) - s / 2, base - 30 - s, s, s); S.fill(b, sd.c, { smooth: false, tone: .45 }); S.line(b, { smooth: false, wk: .4 }); } });
      sd.vs.forEach((v, i) => S.part('tcell', X(v), base - 14, 26, sd.c, `${k}.${i}`));
      S.text(24, base - 8, E.words(sd.q.name), { size: 17, weight: 700, ink: sd.c });
      if (sd.q.value != null) { const v = E.num(sd.q.value, 'value'); S.text(W - 200, base - 40, E.short(sd.q.value), { size: 14, weight: 500, ink: mute }); S.text(W - 200, base - 8, E.fmt(v, sd.q.value), { size: 26, weight: 750, ink: sd.c }); } });
    return S;
  }

  // ---------- ghost: a cloud and its line; the same cloud read another way, dashed, and its line; the turn between ----------
  function ghost(p, E, W, S0) {
    const R = E.rows(p.from), fo = p.foil || {}, H = 440, S = S0(H), mute = CV.mix(S.key, S.bg, .4), acc = E.C('accent'), bad = E.C('bad') || acc;
    const pts = R.map(r => [E.onRow(p.x, r, 'x'), E.onRow(p.y, r, 'y')]), gh = R.map(r => [E.onRow(fo.x ?? p.x, r, 'foil x'), E.onRow(fo.y ?? p.y, r, 'foil y')]);
    const xs = [0, ...pts.map(q => q[0]), ...gh.map(q => q[0])], ys = [0, ...pts.map(q => q[1]), ...gh.map(q => q[1])], [x0, x1] = span(xs, .06), [y0, y1] = span(ys, .1);
    const pw = W * .7, k = Math.min((pw - 40) / (x1 - x0), (H - 50) / (y1 - y0)), ox = 20 + (pw - (x1 - x0) * k) / 2 - x0 * k, oy = 25 + y1 * k, P = (u, v) => [ox + u * k, oy - v * k];
    seg(S, P(x0, 0), P(x1, 0), { wk: .35, ink: mute }); seg(S, P(0, y0), P(0, y1), { wk: .35, ink: mute });
    S.text(...P(x1, 0).map((v, i) => v + (i ? 20 : 0)), E.short(p.x), { size: 14, anchor: 'end', weight: 500, ink: E.ink(p.x) || mute });
    S.text(P(0, y1)[0] + 8, P(0, y1)[1] + 10, E.short(p.y), { size: 14, weight: 500, ink: E.ink(p.y) || mute });
    const th = E.num(p.line, 'line'), tg = E.num(fo.line, 'foil line');
    // a line through the middle at angle t (degrees), clipped to the drawn box
    const ln = (t, o, dash) => { const a = t * Math.PI / 180, d = [Math.cos(a), Math.sin(a)], lo = [x0, y0], hi = [x1, y1]; let t0 = -Infinity, t1 = Infinity;
      [0, 1].forEach(i => { if (Math.abs(d[i]) < 1e-9) return; const u = lo[i] / d[i], v = hi[i] / d[i]; t0 = Math.max(t0, Math.min(u, v)); t1 = Math.min(t1, Math.max(u, v)); });
      (dash ? dashed : seg)(S, P(d[0] * t0, d[1] * t0), P(d[0] * t1, d[1] * t1), o); };
    pts.forEach((q, i) => dashed(S, P(...q), P(...gh[i]), { ink: mute, wk: .3 }));
    ln(tg, { ink: bad, wk: .9 }, true); ln(th, { ink: acc, wk: 1.3 });
    gh.forEach(q => { const [gx, gy] = P(...q); for (let j = 0; j < 8; j++) { const a0 = j / 8 * Math.PI * 2, a1 = a0 + Math.PI / 8; S.line([[gx + 11 * Math.cos(a0), gy + 11 * Math.sin(a0)], [gx + 11 * Math.cos((a0 + a1) / 2), gy + 11 * Math.sin((a0 + a1) / 2)], [gx + 11 * Math.cos(a1), gy + 11 * Math.sin(a1)]], { closed: false, wk: .45, ink: bad }); } });
    pts.forEach((q, i) => S.part('tcell', ...P(...q), 24, E.ink(p.x) || S.key, 'p' + i));
    // the turn: an arc between the two lines, its size in degrees beside it
    const rr = Math.min(110, .42 * Math.min(H, pw)), arc = [], A0 = th * Math.PI / 180, A1 = tg * Math.PI / 180;
    for (let j = 0; j <= 12; j++) { const t = A0 + (A1 - A0) * j / 12; arc.push([ox + Math.cos(t) * rr, oy - Math.sin(t) * rr]); }
    S.line(arc, { closed: false, wk: .55 }); const am = (A0 + A1) / 2;
    S.text(ox + Math.cos(am) * (rr + 16), oy - Math.sin(am) * (rr + 16) + 5, `${L.fmt(Math.abs(tg - th), 0)}°`, { size: 15, anchor: Math.cos(am) < 0 ? 'end' : 'start', weight: 700, ink: S.key });
    // the key: what each line is
    const kx = pw + 30; seg(S, [kx, 80], [kx + 44, 80], { wk: 1.3, ink: acc }); S.text(kx + 56, 85, E.words(p.name ?? ''), { size: 15, weight: 600, ink: S.key });
    dashed(S, [kx, 116], [kx + 44, 116], { ink: bad, wk: .9 }); S.text(kx + 56, 121, E.words(fo.name ?? ''), { size: 15, weight: 600, ink: S.key });
    return S;
  }

  const KINDS = { ruler, cast, machine, grid, pair, ghost };
  L.pictureKinds = Object.keys(KINDS);

  // ---- the board scene: its picture under the head, above the table and steps
  const board = L.types.board;
  L.types.board = (s, ctx) => {
    const R = board(s, ctx), pic = s.picture;
    if (!pic || typeof pic !== 'object') return R;
    const kind = Object.keys(KINDS).find(k => pic[k] != null), root = R.node.querySelector(':scope > .body.board');
    const fig = h('figure', 'bpic'), hd = h('div', 'bpic-heads'), art = h('div', 'bpic-art'); fig.append(hd, art); root.prepend(fig);
    let issues = [], drawnW = 0;
    const draw = () => {
      const W = Math.round(Math.min(root.clientWidth || READ, READ)); if (W < 300 || W === drawnW) return; drawnW = W; issues = []; hd.innerHTML = '';
      if (!kind) { issues.push(`the picture names no kind: use one of ${Object.keys(KINDS).join(', ')}`); return; }
      const E = reader(s, ctx, issues), heads = [];
      try {
        const S = KINDS[kind](pic[kind], E, W, H => CV.scene(W, H, `pic${ctx.index}`), heads, issues);
        art.innerHTML = S.svg(pic.alt ? E.words(pic.alt) : `${kind} picture`);
        fig.style.width = W + 'px';
        heads.forEach(q => { const e = h('div', 'bph'); e.style.left = `${(q.x / W * 100).toFixed(2)}%`; L.renderTex(e, q.tex, false); hd.appendChild(e); });
        hd.hidden = !heads.length;
      } catch (e) { issues.push(`the ${kind} picture could not be drawn: ${e.message}`); console.error(e); }
    };
    const lay = R.layout; R.layout = () => { draw(); return lay(); };
    // the check: words in the picture never meet or leave it
    const audit = R.audit; R.audit = () => { const out = audit ? audit() : [], svg = art.querySelector('svg');
      if (svg && svg.getBBox) { const vb = svg.viewBox.baseVal, T = [...svg.querySelectorAll('text')].map(t => ({ t: t.textContent, b: t.getBBox() }));
        T.forEach(({ t, b }) => { if (b.x < -1 || b.y < -1 || b.x + b.width > vb.width + 1 || b.y + b.height > vb.height + 1) out.push(`the ${kind} picture's words “${t}” run off it`); });
        T.forEach((A, i) => T.slice(i + 1).forEach(B => { const a = A.b, b = B.b; if (a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 2 && b.y < a.y + a.height - 2) out.push(`the ${kind} picture's words “${A.t}” and “${B.t}” overlap`); })); }
      hd.querySelectorAll('.bph').forEach((e, i, all) => { const r = e.getBoundingClientRect(), n = all[i + 1] && all[i + 1].getBoundingClientRect(); if (n && r.right > n.left + 1) out.push(`the ${kind} picture's formula heads ${i + 1} and ${i + 2} overlap`); });
      return [...out, ...issues]; };
    return R;
  };
})();
