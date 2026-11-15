/* viz-os class: the opening page. It wraps the deck's title slide (deck/kit/slides.js T.title stays as decks use it) with
   a kicker line made from `series`, `episode` and `home`, and draws the title slide's `cover:` picture under the title.
   The cover is drawn in the "inks on black" look (the user's pick, N11 and N12a look B, 15 Nov): a felt-tip line in the ink
   colour, solid fills set 4 px off the line, halftone dots for shade and tone, two dim halftone blooms in the corners.
   Every mark is seeded, so the same lesson draws the same bytes. No SVG filter, no raster, no Math.random.
   VizOS.cover.scene(W, H, seed) -> S; S.fill / line / shade / dot / text; S.part(name, x, y, size, color); S.svg(). */
(() => {
  const L = window.VizOS, h = L.h, TAU = Math.PI * 2, f = v => Math.round(v * 10) / 10;
  function rng(seed) { let a = 0; for (const ch of String(seed)) a = Math.imul(a ^ ch.charCodeAt(0), 2654435761) >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const hex = h => /^#[0-9a-f]{6}$/i.test(h) ? [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) : [128, 128, 128];
  const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v * (1 - t) + hex(b)[i] * t).toString(16).padStart(2, '0')).join('');
  const C = k => { const c = (L.colors || {})[k] || getComputedStyle(document.documentElement).getPropertyValue('--' + k).trim(); return /^#[0-9a-f]{6}$/i.test(c) ? c : null; };   // a colour token (s1 … s5, accent, ink, bg) as hex
  // the look's settings: line width, wobble, fill offset, halftone screen
  const LOOK = { w: 2.2, wob: .8, off: [2.83, 2.83], step: 7, ang: 45, dot: 1.6 };

  // ---- geometry: dense points, a slow wobble, a felt ribbon, compact path data
  const crPt = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return [0, 1].map(k => .5 * (2 * b[k] + (c[k] - a[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t2 + (3 * b[k] - a[k] - 3 * c[k] + d[k]) * t3)); };
  function dense(P, closed, smooth, step = 4) {
    const n = P.length, out = [], segs = closed ? n : n - 1, g = i => closed ? P[((i % n) + n) % n] : P[Math.max(0, Math.min(n - 1, i))];
    for (let i = 0; i < segs; i++) {
      const b = g(i), c = g(i + 1), m = Math.max(1, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) / step));
      for (let j = 0; j < m; j++) { const t = j / m; out.push(smooth ? crPt(g(i - 1), b, c, g(i + 2), t) : [b[0] + (c[0] - b[0]) * t, b[1] + (c[1] - b[1]) * t]); }
    }
    if (!closed) out.push(P[n - 1].slice());
    return out;
  }
  function normals(p, closed) {
    const n = p.length;
    return p.map((_, i) => { const a = p[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = p[closed ? (i + 1) % n : Math.min(n - 1, i + 1)]; const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; });
  }
  function arclen(p) { const s = [0]; for (let i = 1; i < p.length; i++) s.push(s[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])); return s; }
  // two seeded sine waves along the normal; on a closed shape they wrap so the seam does not jump; open strokes land on their ends
  function wobble(p, closed, amp, R) {
    const N = normals(p, closed), S = arclen(p), Ln = S[S.length - 1] || 1;
    let k1 = TAU / (70 + R() * 60), k2 = TAU / (16 + R() * 14); const p1 = R() * TAU, p2 = R() * TAU;
    if (closed) { k1 = TAU * Math.max(1, Math.round(Ln * k1 / TAU)) / Ln; k2 = TAU * Math.max(2, Math.round(Ln * k2 / TAU)) / Ln; }
    const env = closed ? () => 1 : s => Math.min(1, s / 10, (Ln - s) / 10);
    return p.map((q, i) => { const d = amp * env(S[i]) * (.7 * Math.sin(S[i] * k1 + p1) + .3 * Math.sin(S[i] * k2 + p2)); return [q[0] + N[i][0] * d, q[1] + N[i][1] * d]; });
  }
  const num = v => String(v).replace(/^(-?)0\./, '$1.');
  function nums(a) { let s = ''; for (const v of a) { const t = num(v); s += (s && t[0] !== '-' ? ' ' : '') + t; } return s; }
  function pathD(p, closed) {
    const r = p.map(q => [Math.round(q[0] * 10), Math.round(q[1] * 10)]), d = [];
    for (let i = 1; i < r.length; i++) d.push((r[i][0] - r[i - 1][0]) / 10, (r[i][1] - r[i - 1][1]) / 10);
    return 'M' + nums([r[0][0] / 10, r[0][1] / 10]) + (d.length ? 'l' + nums(d) : '') + (closed ? 'Z' : '');
  }
  // felt-tip: a filled ribbon round the centre line; the width swells slowly and an open stroke pools ink at both ends
  function ribbon(p, closed, w0, R) {
    const N = normals(p, closed), S = arclen(p), Ln = S[S.length - 1] || 1, k = TAU / (45 + R() * 45), ph = R() * TAU;
    const W = S.map(s => { let w = w0 * (1 + .2 * Math.sin(s * k + ph)); if (!closed) w *= 1 + .45 * Math.exp(-s / 5) + .3 * Math.exp(-(Ln - s) / 6) - .12 * s / Ln; return w / 2; });
    const side = sg => p.map((q, i) => [q[0] + sg * N[i][0] * W[i], q[1] + sg * N[i][1] * W[i]]);
    if (closed) return pathD(side(1), true) + pathD(side(-1).reverse(), true);
    const l = side(1), r = side(-1).reverse(), we = f(W[W.length - 1]), ws = f(W[0]);
    return pathD(l, false) + `A${we} ${we} 0 0 0 ${f(r[0][0])} ${f(r[0][1])}` + pathD(r, false).replace(/^M[^l]*/, '') + `A${ws} ${ws} 0 0 0 ${f(l[0][0])} ${f(l[0][1])}Z`;
  }
  const circ = (cx, cy, r, n = 18, a0 = 0, a1 = TAU) => Array.from({ length: n }, (_, i) => { const a = a0 + (a1 - a0) * i / (n - (a1 - a0 < TAU ? 1 : 0)); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
  const blob = (R, cx, cy, rx, ry, n = 11, wob = .06) => Array.from({ length: n }, (_, i) => { const a = (i + (R() - .5) * .3) / n * TAU, k = 1 + (R() - .5) * 2 * wob; return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]; });
  const bbox = p => { const xs = p.map(q => q[0]), ys = p.map(q => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };

  // ---- one picture
  let nScene = 0;
  function scene(W, H, seed) {
    const bg = C('bg') || '#0b0c0e', key = C('ink') || '#f2f2f0', uid = 'cv' + (++nScene) + '_';
    const defs = [], pats = {}, Ly = { fill: [], shade: [], line: [], text: [] };
    let n = 0; const id = c => uid + c + (n++);
    function pat(c, r) {
      r = Math.max(.3, Math.round(r * 10) / 10); const k = c + r;
      if (!pats[k]) { pats[k] = id('p'); defs.push(`<pattern id="${pats[k]}" patternUnits="userSpaceOnUse" width="${LOOK.step}" height="${LOOK.step}" patternTransform="rotate(${LOOK.ang})"><circle cx="${LOOK.step / 2}" cy="${LOOK.step / 2}" r="${r}" fill="${c}"/></pattern>`); }
      return `url(#${pats[k]})`;
    }
    const toneR = t => LOOK.step * Math.sqrt(Math.max(0, Math.min(1, t)) / Math.PI);   // dot area = tone
    // a filled ink region set off the line; o.tone fills it with halftone dots whose area is the tone
    function fill(sh, c, o = {}) {
      const R = rng(seed + ':f' + n++), [dx, dy] = LOOK.off;
      const p = wobble(dense(sh, true, o.smooth !== false, 6), true, LOOK.wob * .7, R).map(q => [q[0] + dx, q[1] + dy]);
      Ly.fill.push(`<path d="${pathD(p, true)}" fill="${o.tone != null ? pat(c, toneR(o.tone)) : c}" style="mix-blend-mode:screen"/>`);
    }
    // the key line, felt-tip; a thin inner line is a plain round stroke (smaller file)
    function line(sh, o = {}) {
      const closed = o.closed !== false, w = LOOK.w * (o.wk || 1), c = o.ink || key, R = rng(seed + ':l' + n++);
      const p = wobble(dense(sh, closed, o.smooth !== false, 5), closed, LOOK.wob * (w < 1.6 ? .5 : .6), R);
      Ly.line.push(w < 1.6 ? `<path d="${pathD(p, closed)}" fill="none" stroke="${c}" stroke-width="${f(w * 1.1)}"/>`
        : `<path d="${ribbon(p, closed, w * 1.15, R)}" fill="${c}"${closed ? ' fill-rule="evenodd"' : ''}/>`);
    }
    // halftone shade on the side away from the light: the shape minus itself moved toward the light, clipped to the shape
    function shade(sh, o = {}) {
      const p = dense(sh, true, o.smooth !== false, 8), [x0, y0, x1, y1] = bbox(p), k = Math.max(x1 - x0, y1 - y0) * .22, cid = id('c');
      defs.push(`<clipPath id="${cid}"><path d="${pathD(p, true)}"/></clipPath>`);
      Ly.shade.push(`<path d="${pathD(p, true)}${pathD(p.map(q => [q[0] - k, q[1] - k]), true)}" fill-rule="evenodd" clip-path="url(#${cid})" fill="${pat(mix(key, bg, .45), LOOK.dot * .75)}"/>`);
    }
    const dot = (x, y, r, c) => Ly.line.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${c || key}"/>`);
    const text = (x, y, s, o = {}) => Ly.text.push(`<text x="${f(x)}" y="${f(y)}" font-size="${o.size || 15}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''} font-weight="${o.weight || 600}" fill="${o.ink || key}" stroke="${bg}" stroke-width="4" paint-order="stroke">${L.esc(s)}</text>`);
    function blooms() {   // two seeded corners, three nested blobs on one screen, so bigger dots sit on smaller ones
      const R = rng(seed + ':bg'), m = Math.min(W, H), c = mix(C('s3') || key, bg, .6); let s = '';
      for (const [cx, cy] of [[W * (.86 + R() * .08), H * (.1 + R() * .1)], [W * (.04 + R() * .08), H * (.88 + R() * .08)]])
        for (const [rad, rk] of [[.62, .45], [.42, .75], [.24, 1.05]]) s += `<path d="${pathD(dense(blob(R, cx, cy, m * rad * 1.3, m * rad, 9, .12), true, true, 10), true)}" fill="${pat(c, LOOK.dot * rk)}"/>`;
      return s;
    }
    const S = { W, H, key, bg, fill, line, shade, dot, text, R: k => rng(seed + ':' + k) };
    S.part = (name, x, y, size, c, sd) => { PARTS[name].draw(S, x, y, size, c, rng(seed + name + (sd || '') + f(x) + f(y))); return S; };
    S.svg = label => { const back = blooms(); return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(W)} ${f(H)}" width="${f(W)}" height="${f(H)}" role="img"${label ? ` aria-label="${L.esc(label)}"` : ''} style="isolation:isolate" font-family="Inter,system-ui,sans-serif" stroke-linecap="round" stroke-linejoin="round">`
      + `<defs>${defs.join('')}</defs><rect width="${f(W)}" height="${f(H)}" fill="${bg}"/>${back}${Ly.fill.join('')}${Ly.shade.join('')}${Ly.line.join('')}${Ly.text.join('')}</svg>`; };   // the blooms first, so their dot patterns are in defs
    return S;
  }

  // ---- the parts. Each draws round (x, y); size is its height in px; c its colour (hex). The lint keeps the names (lesson_lint.py COVER_PARTS)
  const PARTS = {
    // a T cell (a lymphocyte): a round cell, its round nucleus fills most of it, two CD3 receptors stand on its membrane
    tcell: { kind: 'item', says: 'a T cell: a round cell with a large nucleus and two CD3 receptors', draw(S, x, y, size, c, R) {
      const r = size / 2, m = blob(R, x, y, r, r * .95), nu = blob(R, x + r * .1, y + r * .06, r * .64, r * .6, 10, .07);
      S.fill(m, c); S.fill(nu, c, { tone: .9 }); S.shade(m); S.line(m); S.line(nu, { wk: .6 });
      for (const a of [-2.35, -1.75]) {
        const ux = Math.cos(a), uy = Math.sin(a), bx = x + ux * r * .97, by = y + uy * r * .92, tx = bx + ux * r * .3, ty = by + uy * r * .3, k = r * .14;
        S.line([[bx, by], [tx, ty]], { closed: false, wk: .5 });
        S.line([[tx - uy * k + ux * k, ty + ux * k + uy * k], [tx, ty], [tx + uy * k + ux * k, ty - ux * k + uy * k]], { closed: false, smooth: false, wk: .5 });
      } } },
    // a round-bottom flow tube with a cap, half full of the sample (cells as dots)
    flowtube: { kind: 'source', says: 'a round-bottom flow tube with a cap, half full', draw(S, x, y, size, c, R) {
      const h = size / 2, w = h * .2, top = y - h * .78, bot = y + h, lq = y + h * .05, end = circ(x, bot - w, w, 12, Math.PI, 0).slice(1, -1);
      const body = [[x - w, top], [x - w, bot - w], ...end, [x + w, bot - w], [x + w, top]], liq = [[x - w, lq], [x - w, bot - w], ...end, [x + w, bot - w], [x + w, lq]];
      const cap = [[x - w * 1.3, top - h * .3], [x + w * 1.3, top - h * .3], [x + w * 1.3, top + 3], [x - w * 1.3, top + 3]];
      S.fill(liq, c, { smooth: false }); S.fill(cap, c, { tone: .35, smooth: false }); S.shade(body, { smooth: false });
      S.line(body, { closed: false, smooth: false }); S.line(cap, { smooth: false }); S.line([[x - w, lq], [x + w, lq]], { closed: false, wk: .5 });
      for (let i = 0; i < 7; i++) S.dot(x + (R() - .5) * w * 1.3, lq + h * .12 + R() * (bot - lq - h * .25), 1.8);
    } },
  };

  // ---- the cover: each row a source part (left, with its label) pouring copies of a part placed along a data list, the
  // copies stacked upward where they would touch (a swarm on the row's line); `mark` is one orange line through every row
  // at a value, `reach` a thin line from it to each copy. All rows share one scale, so positions compare across rows
  function cover(cv, W, H, scope, where) {
    const rows = cv.rows || [], n = rows.length || 1, top = cv.mark && cv.mark.label ? 34 : 0, rh = (H - top) / n, val = x => L.val(x, scope, where);
    const lists = rows.map(r => { const v = val((r.pour || {}).along); return Array.isArray(v) ? v.map(Number) : []; }), all = lists.flat();
    const lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * .1 || 1, x0 = 330, x1 = W - 70, sc = v => x0 + (v - lo + pad) / (hi - lo + 2 * pad) * (x1 - x0);
    const cs = Math.min(rh * .23, 70), cr = cs / 2, mk = cv.mark ? +val(cv.mark.at) : null, S = scene(W, H, 'cover');
    rows.forEach((r, i) => {
      const y = top + rh * (i + .5), by = y + rh * .3, ink = C(r.color || 's1') || S.key, th = Math.min(rh * .36, 92) * 2;
      S.line([[x0 - 30, by + cr * 1.1], [x1 + 30, by + cr * 1.1]], { closed: false, wk: .35, ink: mix(S.key, S.bg, .8) });
      S.part(r.part || 'flowtube', 130, y - 4, th, ink, 'row' + i);
      if (r.label) S.text(130, y - 4 + th / 2 + 26, r.label, { size: 18, weight: 650, anchor: 'middle', ink });
      for (let k = 1; k <= 6; k++) { const t = k / 7, px = (1 - t) ** 2 * 175 + 2 * (1 - t) * t * (x0 - 80) + t * t * (x0 - 30), py = (1 - t) ** 2 * (y - th * .35) + 2 * (1 - t) * t * (y - th * .35) + t * t * by; S.dot(px, py, 2.4 - t, ink); }
      const done = [];
      lists[i].map((v, j) => [v, j]).sort((a, b) => a[0] - b[0]).forEach(([v, j]) => {
        const x = sc(v); let yy = by;
        for (const t of [0, -1, -2, -3, -4]) { yy = by + t * cs * .62; if (done.every(p => Math.hypot(p[0] - x, p[1] - yy) > cs * .98)) break; }
        done.push([x, yy]);
        if (mk != null && cv.mark.reach && Math.abs(sc(mk) - x) > cr) S.line([[sc(mk), yy], [x - Math.sign(x - sc(mk)) * cr, yy]], { closed: false, wk: .45, ink });
        S.part(r.pour.part || 'tcell', x, yy, cs, ink, `${i}.${j}`);
      });
    });
    if (mk != null && isFinite(mk)) { const x = sc(mk); S.line([[x, top || 16], [x, H - 16]], { closed: false, ink: C('accent') || '#ff5a36', wk: 1.5 }); if (cv.mark.label) S.text(x, 24, cv.mark.label, { weight: 650, anchor: 'middle', ink: C('accent') || '#ff5a36' }); }
    return S.svg(cv.line);
  }
  L.cover = { scene, PARTS, rng, C, mix };   // pictures.js draws the scene pictures with the same engine

  // ---- the title slide: the deck's, plus a kicker line and the cover. The title stays the lesson's question
  const deckTitle = L.types.title;
  L.types.title = (s, ctx) => {
    const r = deckTitle(s, ctx), node = r.node, d = ctx.deck;
    if (!node.querySelector('.kicker')) {
      const k = [d.series && `<b>${L.esc(d.series)}</b>`, d.episode && `lesson ${L.esc(d.episode)}`, d.home && `your ${L.esc(d.home)}`].filter(Boolean);
      if (k.length) node.insertBefore(h('div', 'kicker lkick', k.join(' · ')), node.firstChild);
    }
    if (!s.cover) return r;
    node.classList.add('has-cover');
    const fr = h('div', 'cover'); node.appendChild(fr);
    if (s.cover.line) node.appendChild(h('div', 'cover-line', L.md(s.cover.line)));
    r.layout = () => { const W = fr.clientWidth, H = fr.clientHeight; if (W > 50 && H > 50) fr.innerHTML = cover(s.cover, W, H, ctx.scope, `slide ${ctx.index + 1} cover`); };
    return r;
  };
})();
