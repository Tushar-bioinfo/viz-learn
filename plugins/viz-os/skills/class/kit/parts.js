/* viz-os class: the box of drawn parts, as ink on the black board (SVG). The parts are the sketch skill's, redrawn
   (sketch/kit/parts.js); a `fork` draws them (board.js). Each part draws in its own box, -1..1 across, so size and turn
   live in one place. Colours are the kit's tokens (board.css), so a colour changed there reaches the parts.
   VizOS.ink.part(name, {x, y, size, state, color, rot, id, chroms}) -> an SVG <g> string; `chroms` is a list of {c, mut}. */
(() => {
  const TAU = Math.PI * 2;
  const pal = { ink: 'var(--ink)', mist: 'var(--mist)', wash: 'var(--ink)', s1: 'var(--s1)', s2: 'var(--s2)', s3: 'var(--s3)', s4: 'var(--s4)', s5: 'var(--s5)', red: 'var(--bad)', bg: 'var(--bg)' };
  const f = v => +v.toFixed(2);
  function rng(seed) { let a = 0; for (const ch of String(seed)) a = Math.imul(a ^ ch.charCodeAt(0), 2654435761) >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // closed smooth path through points (Catmull-Rom as cubic Beziers)
  function closed(P) {
    const n = P.length, g = i => P[(i + n) % n]; let d = `M${f(P[0][0])} ${f(P[0][1])}`;
    for (let i = 0; i < n; i++) { const a = g(i - 1), b = g(i), c = g(i + 1), e = g(i + 2); d += `C${f(b[0] + (c[0] - a[0]) / 6)} ${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)} ${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])} ${f(c[1])}`; }
    return d + 'Z';
  }
  function open(P) {
    let d = `M${f(P[0][0])} ${f(P[0][1])}`;
    for (let i = 0; i < P.length - 1; i++) { const a = P[Math.max(0, i - 1)], b = P[i], c = P[i + 1], e = P[Math.min(P.length - 1, i + 2)]; d += `C${f(b[0] + (c[0] - a[0]) / 6)} ${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)} ${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])} ${f(c[1])}`; }
    return d;
  }
  const blob = (R, rx, ry, cx = 0, cy = 0, n = 12, wob = .05) => Array.from({ length: n }, (_, i) => { const a = (i + (R() - .5) * .25) / n * TAU, k = 1 + (R() - .5) * 2 * wob; return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]; });
  const ell = (cx, cy, rx, ry = rx) => `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
  // stroke widths and dashes are in screen px: each is divided by the part's scale (`px`, set by part()), so a part needs no
  // vector-effect and draws the same in any page. A page's own svg rules can still reach a part: see `dot`
  let px = 1; const fw = v => +(v * px).toFixed(4);
  // colours go in style, so the kit's var(--…) tokens resolve
  const P = (d, o = {}) => `<path d="${d}" style="fill:${o.fill || 'none'};stroke:${o.stroke || 'none'}"${o.fo != null ? ` fill-opacity="${o.fo}"` : ''} stroke-width="${fw(o.w || 1.5)}"${o.so != null ? ` stroke-opacity="${o.so}"` : ''}${o.dash ? ` stroke-dasharray="${String(o.dash).split(/[\s,]+/).map(v => fw(+v)).join(' ')}"` : ''} stroke-linecap="round" stroke-linejoin="round"/>`;
  const dot = (x, y, r, c, o = 1) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" style="fill:${c};stroke:none" fill-opacity="${o}"/>`;   // stroke none: the board strokes bare circles (its plane points)
  // a rod (one chromatid) from a to b, round at both ends, pinched where the centromere sits
  function rod(a, b, w) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, n = [-dy / l * w, dx / l * w], t = [dx / l * w, dy / l * w];
    return `M${f(a[0] + n[0])} ${f(a[1] + n[1])}L${f(b[0] + n[0])} ${f(b[1] + n[1])}C${f(b[0] + n[0] + t[0] * 1.3)} ${f(b[1] + n[1] + t[1] * 1.3)} ${f(b[0] - n[0] + t[0] * 1.3)} ${f(b[1] - n[1] + t[1] * 1.3)} ${f(b[0] - n[0])} ${f(b[1] - n[1])}L${f(a[0] - n[0])} ${f(a[1] - n[1])}C${f(a[0] - n[0] - t[0] * 1.3)} ${f(a[1] - n[1] - t[1] * 1.3)} ${f(a[0] + n[0] - t[0] * 1.3)} ${f(a[1] + n[1] - t[1] * 1.3)} ${f(a[0] + n[0])} ${f(a[1] + n[1])}Z`;
  }
  function specks(R, rx, ry, n, cx = 0, cy = 0) { let s = ''; for (let i = 0; i < n; i++) { const a = R() * TAU, r = Math.sqrt(R()) * .92; s += dot(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r, .012, pal.mist, .5); } return s; }
  function chromatin(R, rx, ry, k, c) { let s = ''; for (let j = 0; j < k; j++) { const pts = []; let x = (R() - .5) * rx, y = (R() - .5) * ry, a = R() * TAU; for (let i = 0; i < 7; i++) { a += (R() - .5) * 1.7; x = Math.max(-rx * .7, Math.min(rx * .7, x + Math.cos(a) * rx * .22)); y = Math.max(-ry * .7, Math.min(ry * .7, y + Math.sin(a) * ry * .22)); pts.push([x, y]); } s += P(open(pts), { stroke: c, w: 1, so: .55 }); } return s; }

  // ---- the parts. Each returns inner SVG in -1..1 units; G holds the seeded random and the colour
  const D = {};
  // one X chromosome (two sister rods), or one rod when `single`. Bands across the arms; a red band where the damage sits
  D.chromosome = (G, it) => {
    const c = G.c, w = .17, mut = it.mut, single = it.state === 'single';
    let s = '';
    const arms = single ? [[[0, 0], [0, -.62]], [[0, 0], [0, .95]]] : [[[0, 0], [-.3, -.66]], [[0, 0], [.3, -.66]], [[0, 0], [-.24, .95]], [[0, 0], [.24, .95]]];
    for (const [a, b] of arms) s += P(rod(a, b, w), { fill: c, fo: .42, stroke: c, w: 1.4 });
    for (const [a, b] of arms) for (const t of [.45, .72]) { const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, l = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / l * w * .85, ny = (b[0] - a[0]) / l * w * .85; s += P(`M${f(x + nx)} ${f(y + ny)}L${f(x - nx)} ${f(y - ny)}`, { stroke: pal.bg, w: 1.2, so: .7 }); }
    if (mut) { const [a, b] = arms[single ? 1 : 2], x = a[0] + (b[0] - a[0]) * .6, y = a[1] + (b[1] - a[1]) * .6; s += dot(x, y, .22, pal.red) + P(ell(x, y, .22), { stroke: pal.ink, w: 1 }); }
    s += dot(0, 0, .11, pal.bg) + P(ell(0, 0, .11), { stroke: c, w: 1.2 });
    return s;
  };
  // a cell: membrane, specks, a few organelles in grey, a nucleus. `chroms` puts rods in the nucleus instead of chromatin.
  // states: plain, metaphase (no envelope; X chromosomes in a column; spindle from two poles), dividing (two nuclei), dead
  D.cell = (G, it) => {
    const R = G.R, st = it.state || 'plain', out = blob(R, 1, .94, 0, 0, 13, st === 'dead' ? .14 : .045);
    let s = P(closed(out), { fill: pal.wash, fo: .045, stroke: 'none' }) + specks(R, .9, .84, 46);
    const mito = (x, y, a) => { const c = Math.cos(a) * .17, d = Math.sin(a) * .17; return P(rod([x - c, y - d], [x + c, y + d], .065), { stroke: pal.mist, w: 1, so: .7 }) + P(`M${f(x - c * .7)} ${f(y - d * .7)}l${f(c * .35)} ${f(d * .35 + .04)}l${f(c * .35)} ${f(d * .35 - .08)}l${f(c * .35)} ${f(d * .35 + .08)}l${f(c * .35)} ${f(d * .35 - .04)}`, { stroke: pal.mist, w: .8, so: .6 }); };
    if (st === 'dead') {
      s += P(open(out.slice(0, 5)), { stroke: pal.ink, w: 1.5 }) + P(open(out.slice(6, 10)), { stroke: pal.ink, w: 1.5 });
      for (let i = 0; i < 6; i++) s += P(ell(-.55 + i * .22 + (R() - .5) * .1, (R() - .5) * .9, .07 + R() * .05), { stroke: G.c, w: 1.2, fill: G.c, fo: .25 });
      return s;
    }
    const org = st === 'metaphase' ? [[-.62, -.5, .6], [.6, .52, 2.4], [-.58, .55, 2.1], [.62, -.48, .9]] : [[-.62, -.38, .5], [.58, .5, 2.4], [-.4, .66, 2.9], [.66, -.3, 1.2]];
    for (const [x, y, a] of org) s += mito(x, y, a);
    if (st === 'metaphase') {
      const poles = [[-.78, 0], [.78, 0]], ch = it.chroms || [];
      for (const [px] of poles) for (let k = -3; k <= 3; k++) s += P(open([[px, 0], [px * .5, k * .13], [0, k * .17]]), { stroke: pal.mist, w: .8, so: .4 });
      for (const [px, py] of poles) s += dot(px, py, .05, pal.ink) + P(ell(px, py, .09), { stroke: pal.ink, w: .8, so: .6 });
      const n = ch.length, gap = 1.3 / Math.max(n, 1);
      ch.forEach((q, i) => { s += `<g transform="translate(0 ${f(-0.65 + gap * (i + .5))}) rotate(90) scale(${f(gap * .55)})">${D.chromosome({ c: q.c, R }, { mut: q.mut })}</g>`; });
    } else if (st === 'dividing') {
      const wst = [], n = 64; for (let i = 0; i < n; i++) { const a = i / n * TAU, c = Math.cos(a); wst.push([c, Math.sin(a) * (.68 - .36 * Math.exp(-((c * 1.05) ** 2) / .08))]); }
      s = P(closed(wst.filter((_, i) => i % 2 === 0)), { fill: pal.wash, fo: .045, stroke: pal.ink, w: 1.6 }) + specks(R, .85, .4, 30);
      for (const x of [-.52, .52]) s += P(closed(blob(R, .24, .28, x, 0, 10)), { fill: G.c, fo: .18, stroke: G.c, w: 1.3 }) + `<g transform="translate(${x} 0)">${chromatin(R, .3, .34, 3, G.c)}</g>`;
      return s;
    } else {
      const nr = it.chroms ? .62 : .4, nu = blob(R, nr, nr * .92, .02, .02, 11, .04);
      s += P(closed(nu), { fill: G.c, fo: .14, stroke: G.c, w: 1.3, dash: '5 3' });
      if (it.chroms) {
        const ch = it.chroms, n = ch.length, sp = Math.min(.26, .95 / n);
        ch.forEach((q, i) => { const x = (i - (n - 1) / 2) * sp, y = (R() - .5) * .14, a = (R() - .5) * 24; s += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)}) scale(.36)">${D.chromosome({ c: q.c, R }, { state: 'single', mut: q.mut })}</g>`; });
      } else { s += chromatin(R, nr, nr, 4, G.c) + dot(.14, .1, .07, G.c, .9); }
    }
    s += P(closed(out), { stroke: pal.ink, w: 1.7 });
    return s;
  };
  D.nucleus = G => { const R = G.R, nu = blob(R, 1, .92, 0, 0, 12, .04); return P(closed(nu), { fill: G.c, fo: .14, stroke: G.c, w: 1.6, dash: '6 3' }) + chromatin(R, 1, .92, 9, G.c) + P(closed(blob(R, .2, .18, .32, .2, 9)), { fill: G.c, fo: .7, stroke: pal.ink, w: 1 }); };
  // a slab of tissue: cells packed in a rounded section; `regions` paints part of it in a second colour
  D.tissue = (G, it) => {
    const R = G.R, out = blob(R, 1, .74, 0, 0, 14, .08), two = it.state === 'regions', other = pal[it.other] || it.other || pal.s3;
    let s = P(closed(out), { fill: pal.wash, fo: .04, stroke: 'none' }); const n = 15;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const x = -1 + 2 * (i + .5 + (R() - .5) * .5) / n, y = -.74 + 1.48 * (j + .5 + (R() - .5) * .5) / n; if ((x / .92) ** 2 + (y / .66) ** 2 >= 1) continue; const c = two && x + y * .5 + Math.sin(y * 3) * .15 > .1 ? other : G.c; s += P(ell(x, y, .045, .038), { fill: c, fo: .5, stroke: c, w: .8, so: .8 }); }
    return s + P(closed(out), { stroke: pal.ink, w: 1.6 });
  };
  // a small tube with a hinged cap; the liquid in the part's colour, with ticks for volume
  D.tube = (G, it) => {
    const body = [[-.36, -.55], [.36, -.55], [.3, .32], [.06, .96], [-.06, .96], [-.3, .32]];
    let s = '';
    if (it.state !== 'empty') { const lv = -.08; s += P(`M-.34 ${lv}Q0 ${lv + .05} .34 ${lv}L.3 .32L.06 .93L-.06 .93L-.3 .32Z`, { fill: G.c, fo: .32, stroke: 'none' }) + P(`M-.34 ${lv}Q0 ${lv + .05} .34 ${lv}`, { stroke: G.c, w: 1.3 });
      const R = G.R; for (let i = 0; i < 9; i++) s += dot((R() - .5) * .4, lv + .1 + R() * .45 * (1 - R() * .3), .022, pal.ink, .55); }
    s += P(`M${body.map(p => p.join(' ')).join('L')}Z`, { stroke: pal.ink, w: 1.7, fill: pal.wash, fo: .03 });
    for (let i = 0; i < 4; i++) s += P(`M.36 ${f(-.42 + i * .18)}l-.1 0`, { stroke: pal.mist, w: 1 });
    s += P('M-.44 -.7L.44 -.7L.44 -.55L-.44 -.55Z', { stroke: pal.ink, w: 1.6, fill: pal.wash, fo: .08 }) + P('M-.44 -.62C-.7 -.62 -.78 -.85 -.6 -.95', { stroke: pal.ink, w: 1.4 });
    return s;
  };
  // a well plate: the corner cut on the top right; wells hold the colour, larger for more (values 0..1, or all full)
  D.plate = (G, it) => {
    const rows = it.rows || 4, cols = it.cols || 6, gx = 1.7 / cols, H = gx * rows / 2 + .14, r = gx * .36, v = it.values;
    let s = P(`M-1 ${f(-H)}L.9 ${f(-H)}L1 ${f(-H + .1)}L1 ${f(H)}L-1 ${f(H)}Z`, { stroke: pal.ink, w: 1.7, fill: pal.wash, fo: .03 });
    for (let q = 0; q < rows; q++) for (let c = 0; c < cols; c++) { const x = (c - (cols - 1) / 2) * gx, y = (q - (rows - 1) / 2) * gx, k = v ? v[q * cols + c] : it.state === 'filled' ? 1 : 0;
      s += P(ell(x, y, r), { stroke: pal.mist, w: 1 }); if (k > .02) s += P(ell(x, y, r * (.3 + .62 * k)), { fill: G.c, fo: .55, stroke: G.c, w: 1 }); }
    return s;
  };
  // one sequencing read: barcode, UMI, then the insert with a tick per base
  D.read = (G, it) => {
    const end = it.state === 'short' ? .3 : .92, bar = (a, b, c) => P(`M${a} -.1L${b} -.1L${b} .1L${a} .1Z`, { fill: c, fo: .35, stroke: c, w: 1.3 });
    let s = bar(-1, -.62, pal.s3) + bar(-.6, -.36, pal.s2) + bar(-.34, end, G.c);
    for (let x = -.28; x < end - .03; x += .06) s += P(`M${f(x)} -.1L${f(x)} -.04`, { stroke: G.c, w: .8, so: .6 });
    return s;
  };
  // a droplet in oil: empty, cell, bead, both (a cell and a bead) or two (two cells and a bead: a doublet)
  D.droplet = (G, it) => {
    const R = G.R, st = it.state || 'empty', s0 = blob(R, 1, .97, 0, 0, 10, .02);
    let s = P(closed(s0), { fill: G.c, fo: .07, stroke: 'none' });
    const cell = (x, y, r) => P(closed(blob(R, r, r * .94, x, y, 9, .05)), { fill: pal.wash, fo: .06, stroke: pal.ink, w: 1.3 }) + P(ell(x + .02, y, r * .45), { fill: pal.s2, fo: .3, stroke: pal.s2, w: 1 });
    const bead = (x, y) => { let b = P(ell(x, y, .2), { fill: pal.s4, fo: .55, stroke: pal.s4, w: 1.3 }) + dot(x - .07, y - .07, .04, pal.ink, .8); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; b += P(`M${f(x + Math.cos(a) * .2)} ${f(y + Math.sin(a) * .2)}l${f(Math.cos(a) * .09)} ${f(Math.sin(a) * .09)}`, { stroke: pal.s4, w: .9 }); } return b; };
    if (st === 'cell') s += cell(0, 0, .34);
    if (st === 'bead') s += bead(0, .05);
    if (st === 'both') s += cell(-.3, -.02, .3) + bead(.4, .14);
    if (st === 'two') s += cell(-.34, -.22, .27) + cell(-.12, .36, .27) + bead(.42, .02);
    s += P(closed(s0), { stroke: G.c, w: 1.7 }) + P(open([[-.62, -.44], [-.5, -.6], [-.28, -.72]]), { stroke: pal.ink, w: 1.2, so: .7 });
    return s;
  };
  D.lens = G => P(ell(-.16, -.16, .74), { stroke: pal.ink, w: 2, fill: pal.wash, fo: .03 }) + P(ell(-.16, -.16, .66), { stroke: pal.mist, w: .9 }) + P('M-.58 -.44Q-.5 -.62 -.32 -.7', { stroke: pal.ink, w: 1.2, so: .7 }) + P(rod([.38, .38], [.92, .92], .08), { fill: G.c, fo: .5, stroke: G.c, w: 1.4 });

  // the states each part draws (the lint keeps its own copy: lesson_lint.py PARTS)
  const STATES = { cell: ['plain', 'metaphase', 'dividing', 'dead'], nucleus: ['plain'], chromosome: ['pair', 'single'], tissue: ['plain', 'regions'], tube: ['filled', 'empty'],
    plate: ['filled', 'empty'], read: ['full', 'short'], droplet: ['empty', 'cell', 'bead', 'both', 'two'], lens: ['plain'] };
  function part(name, o) {
    if (!D[name]) throw new Error(`no part named "${name}"; the box has ${Object.keys(D).join(', ')}`);
    const r = (o.size || 100) / 2; px = 1 / r; const G = { R: rng(`${name}:${o.id || ''}`), c: pal[o.color] || o.color || pal.s5 };
    return `<g class="pt" data-part="${name}" transform="translate(${f(o.x)} ${f(o.y)}) rotate(${o.rot || 0}) scale(${f(r)})">${D[name](G, o)}</g>`;
  }
  window.VizOS.ink = { part, STATES };
})();
