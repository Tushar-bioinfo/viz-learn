/* viz-os charts: declarative SVG plots in the flat proff theme (plain fills, square bars, square label tags).
   Series: line, area, bars, hist, dots, lollipop, step. Marks: vline, hline, band, point, label, arrow, line, fn, area, span.
   Every series and mark may carry `step`; labels avoid each other and the data; a data table and a hover readout come free. */
(function () {
  'use strict';
  const L = window.VizOS;
  const NS = 'http://www.w3.org/2000/svg';
  let uid = 0;
  const mctx = document.createElement('canvas').getContext('2d');
  L.measure = (s, size = 24, weight = 600, family) => { mctx.font = `${weight} ${size}px ${family || L.fontUI || 'Inter, system-ui, sans-serif'}`; return mctx.measureText(String(s)).width; };
  const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); if (parent) parent.appendChild(e); return e; };
  L.svgEl = el;
  const col = c => (L.colors && L.colors[c]) || c || (L.colors && L.colors.mist);
  // mix a hex colour toward white (t > 0) or black (t < 0); other colour forms pass through
  L.tone = (c, t) => { const m = /^#([0-9a-f]{6})$/i.exec(c || ''); if (!m) return c; const n = parseInt(m[1], 16), to = t > 0 ? 255 : 0, k = Math.abs(t);
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + (to - v) * k).toString(16).padStart(2, '0')).join(''); };

  // nice ticks
  function nice(a, b, n) {
    const span = b - a; if (!(span > 0)) return [a];
    const step0 = span / Math.max(1, n), mag = 10 ** Math.floor(Math.log10(step0)), r = step0 / mag;
    const st = (r >= 7.5 ? 10 : r >= 3.5 ? 5 : r >= 1.5 ? 2 : 1) * mag, out = [];
    for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + st * 1e-9; v += st) out.push(+v.toFixed(10));
    return out;
  }
  function logTicks(a, b, room = 99) { const out = []; const e0 = Math.ceil(Math.log10(a) - 1e-9), e1 = Math.floor(Math.log10(b) + 1e-9), st = Math.max(1, Math.ceil((e1 - e0 + 1) / room));
    for (let e = e0; e <= e1; e += st) out.push(10 ** e);
    if (out.length < 3) { const more = []; for (let e = Math.floor(Math.log10(a)); e <= Math.ceil(Math.log10(b)); e++) for (const m of [1, 2, 5]) { const v = m * 10 ** e; if (v >= a * .999 && v <= b * 1.001) more.push(v); } return more; }
    return out; }
  const logFmt = v => { const e = Math.round(Math.log10(v)); return Math.abs(Math.log10(v) - e) < 1e-9 && (e >= 5 || e <= -3) ? `10${String(e).split('').map(c => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]).join('')}` : L.fmt(v); };

  // resolve series into drawable data
  function seriesData(s, scope, xs, xdom) {
    const where = `series "${s.name || s.kind}"`;
    if (s.fn) {
      const discrete = s.discrete ?? ['bars', 'lollipop', 'step'].includes(s.kind);
      const [a, b] = xdom; const pts = [];
      if (discrete) { const st = s.dx || 1; for (let x = Math.ceil(a); x <= b + 1e-9; x += st) pts.push(x); }
      else { const n = s.n || 240; for (let i = 0; i <= n; i++) pts.push(a + (b - a) * i / n); }
      const ast = L.parse(s.fn), sc = L.scope(scope, {});
      return pts.map(x => { sc.x = x; let y; try { y = L.eval(ast, sc); } catch (e) { L.err(where, e.message); y = NaN; } return [x, y]; }).filter(p => Number.isFinite(p[1]));
    }
    if (s.values != null) { // histogram
      const vals = L.val(s.values, scope, where); if (!Array.isArray(vals)) { L.err(where, 'values must be a list'); return []; }
      const [a, b] = xdom, discrete = s.discrete ?? vals.every(Number.isInteger);
      let edges = [];
      if (discrete) { const w = s.binwidth || Math.max(1, Math.ceil((b - a) / (s.bins || 30))); for (let e = Math.floor(a) - .5; e <= b + .5; e += w) edges.push(e); }
      else { const n = s.bins || 24; for (let i = 0; i <= n; i++) edges.push(a + (b - a) * i / n); }
      const counts = new Array(edges.length - 1).fill(0);
      vals.forEach(v => { const i = edges.findIndex((e, k) => k < edges.length - 1 && v >= e && v < edges[k + 1]); if (i >= 0) counts[i]++; });
      const tot = vals.length;
      return counts.map((c, i) => { const w = edges[i + 1] - edges[i]; return { x0: edges[i], x1: edges[i + 1], y: s.density ? c / tot / w : c, n: c }; });   // density: per unit of x, so it sits on a pmf or pdf
    }
    const X = L.val(s.x, scope, where), Y = s.y == null ? 0 : L.val(s.y, scope, where);
    if (Array.isArray(X)) return X.map((x, i) => [x, Array.isArray(Y) ? Y[i] : Y]).filter(p => p[1] != null && !Number.isNaN(p[1]));
    if (Array.isArray(Y)) return Y.map((y, i) => [i, y]);
    return [];
  }

  L.chart = function (host, spec, scopeOf, opts = {}) {
    const id = 'c' + (++uid);
    const C = { host, spec, steps: 0, k: 0 };
    const series = (spec.series || []).map((s, i) => ({ ...s, i }));
    const marks = (spec.marks || []).map((m, i) => ({ ...m, i }));
    C.steps = Math.max(0, ...series.map(s => s.step || 0), ...marks.map(m => m.step || 0));
    // colours: focus -> accent, then s1, s2, s3 in order; extra series fall back to mist (lint warns)
    let slot = 0; const SL = ['s1', 's2', 's3'];
    series.forEach(s => { s.c = s.color ? s.color : s.focus ? 'accent' : SL[slot++] || 'mist'; });

    // head row: legend on the left, sliders and the data toggle on the right (the plot keeps the height)
    const vhead = opts.vis ? document.createElement('div') : null;
    if (vhead) { vhead.className = 'vhead'; host.appendChild(vhead); }
    const wrap = document.createElement('div'); wrap.className = 'chart'; host.appendChild(wrap);
    const legend = document.createElement('div'); legend.className = 'legend';
    const tip = document.createElement('div'); tip.className = 'tip';
    const table = document.createElement('div'); table.className = 'datatable';
    wrap.append(tip, table);
    if (vhead) vhead.appendChild(legend); else wrap.appendChild(legend);
    C.vhead = vhead;
    if (vhead && spec.table !== false) {   // the data toggle sits at the right end of the caption row (L.visual adds the row)
      const b = document.createElement('button'); b.className = 'datatoggle'; b.textContent = 'data'; b.title = 'show the numbers behind the chart';
      b.onclick = e => { e.stopPropagation(); opts.vis.classList.toggle('showdata'); b.textContent = opts.vis.classList.contains('showdata') ? 'chart' : 'data'; };
      C.toggle = b;
    }
    let svg = null, state = null;

    C.render = function () {
      const W = wrap.clientWidth, H = wrap.clientHeight;
      if (!W || !H) return false;
      const scope = scopeOf();
      if (svg) svg.remove();
      svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': spec.alt || spec.title || 'chart' });
      wrap.insertBefore(svg, tip);
      const defs = el('defs', {}, svg), made = {};

      // domains
      const xs = spec.x || {}, ys = spec.y || {};
      const cats = Array.isArray(xs.cats) ? xs.cats : null;
      let xdom = [L.val(xs.min, scope, 'x.min'), L.val(xs.max, scope, 'x.max')];
      const raw = series.map(s => ({ s, d: s.fn || s.values != null ? null : seriesData(s, scope) }));
      if (!cats && (Number.isNaN(xdom[0]) || Number.isNaN(xdom[1]))) {
        const allx = []; raw.forEach(r => r.d && r.d.forEach(p => allx.push(p[0])));
        series.forEach(s => { if (s.values != null) { const v = L.val(s.values, scope); if (Array.isArray(v)) allx.push(...v); } });
        if (allx.length) { let a = Math.min(...allx), b = Math.max(...allx); const pad = (b - a || 1) * .06; if (Number.isNaN(xdom[0])) xdom[0] = xs.log ? a / 1.3 : a - pad; if (Number.isNaN(xdom[1])) xdom[1] = xs.log ? b * 1.3 : b + pad; }
        else { if (Number.isNaN(xdom[0])) xdom[0] = 0; if (Number.isNaN(xdom[1])) xdom[1] = 1; }
      }
      const data = series.map((s, i) => raw[i].d || seriesData(s, scope, xs, xdom));
      let ydom = [L.val(ys.min, scope, 'y.min'), L.val(ys.max, scope, 'y.max')];
      if (Number.isNaN(ydom[0]) || Number.isNaN(ydom[1])) {
        const ally = []; data.forEach((d, i) => d.forEach(p => ally.push(Array.isArray(p) ? p[1] : p.y)));
        marks.forEach(m => { if (m.kind === 'point' || m.kind === 'label') { const at = m.at || [m.x, m.y]; const v = L.val(at[1], scope); if (Number.isFinite(v)) ally.push(v); } if (m.kind === 'hline') { const v = L.val(m.y, scope); if (Number.isFinite(v)) ally.push(v); } });
        const fin = ally.filter(Number.isFinite);
        const lo = fin.length ? Math.min(...fin) : 0, hi = fin.length ? Math.max(...fin) : 1;
        const zero = !ys.log && (ys.zero ?? true);
        if (Number.isNaN(ydom[0])) ydom[0] = ys.log ? lo / 1.4 : zero ? Math.min(0, lo) : lo - (hi - lo) * .08;
        if (Number.isNaN(ydom[1])) ydom[1] = ys.log ? hi * 1.6 : hi + (hi - ydom[0]) * (ys.head ?? .16);
      }
      // layout
      const port = document.body.classList.contains('port');
      const fT = 22, fA = 24;
      const yfmt = v => ys.log ? logFmt(v) : L.fmt(v, ys.fmt);
      const xfmt = v => xs.log ? logFmt(v) : L.fmt(v, xs.fmt);
      const yt = ys.ticks && Array.isArray(ys.ticks) ? ys.ticks : ys.log ? logTicks(ydom[0], ydom[1], Math.max(3, Math.round(H / 70))) : nice(ydom[0], ydom[1], ys.ticks || Math.max(3, Math.round(H / 110)));
      const ytw = Math.max(...yt.map(v => L.measure(yfmt(v), fT, 500)), 10);
      const hasLegend = series.filter(s => s.name && s.legend !== false).length >= 2 && spec.legend !== false;
      legend.innerHTML = hasLegend ? series.filter(s => s.name && s.legend !== false).map(s =>
        `<span class="mk${s.step ? ' st' : ''}" data-mstep="${s.step || 0}"><i class="${['dots', 'lollipop'].includes(s.kind) ? 'dot' : ['bars', 'hist'].includes(s.kind) ? 'bar' : ''}" style="background:${col(s.c)}${s.dash ? ';background:repeating-linear-gradient(90deg,' + col(s.c) + ' 0 7px,transparent 7px 11px)' : ''}"></i>${L.md(s.name)}</span>`).join('') : '';
      const legH = hasLegend && !vhead ? legend.offsetHeight + 14 : 0;
      if (vhead) vhead.classList.toggle('empty', !hasLegend && !vhead.querySelector('.controls, .famcard') && spec.table === false);
      const endLabels = !hasLegend || W < 760 ? [] : series.filter(s => ['line', 'area', 'step'].includes(s.kind || 'line') && s.name && s.label !== false && series.length <= 3);
      const endW = endLabels.length ? Math.max(...endLabels.map(s => L.measure(L.plain(s.label || s.name, scope), 24, 600))) + 30 : 0;
      const lastX = cats ? '' : (xs.log ? logFmt(xdom[1]) : L.fmt(xdom[1], xs.fmt));   // the last tick label is centred on the plot edge
      const m = { l: ytw + 20, r: Math.max(18, L.measure(lastX, fT, 500) / 2 + 6, Math.min(endW, W * .3)), t: legH + (ys.label ? 46 : 18), b: 34 + fT + (xs.label ? 40 : 6) };
      const pw = W - m.l - m.r, ph = H - m.t - m.b;
      if (pw < 120 || ph < 80) { L.err('chart', `too small to draw (${Math.round(W)}×${Math.round(H)})`); return false; }
      const lx = v => xs.log ? Math.log10(v) : v, ly = v => ys.log ? Math.log10(v) : v;
      const [xa, xb] = cats ? [0, cats.length] : xdom.map(lx), [ya, yb] = ydom.map(ly);
      const sx = v => m.l + ((cats ? v : lx(v)) - xa) / (xb - xa) * pw;
      const sy = v => m.t + ph - (ly(v) - ya) / (yb - ya) * ph;
      const clampY = y => Math.max(m.t - 2, Math.min(m.t + ph, y));
      state = { sx, sy, m, pw, ph, data, xdom, ydom, cats };
      const g = el('g', {}, svg);
      // grid + ticks
      yt.forEach(v => { const y = sy(v); if (y < m.t - 1 || y > m.t + ph + 1) return; el('line', { x1: m.l, x2: m.l + pw, y1: y, y2: y, class: 'grid' }, g);
        const t = el('text', { x: m.l - 14, y: y + 7, 'text-anchor': 'end', class: 'tick' }, g); t.textContent = yfmt(v); });
      el('line', { x1: m.l, x2: m.l + pw, y1: m.t + ph, y2: m.t + ph, class: 'base' }, g);
      if (cats) cats.forEach((c, i) => { const t = el('text', { x: sx(i + .5), y: m.t + ph + 32, 'text-anchor': 'middle', class: 'tick' }, g); t.textContent = c; });
      else { const xt = xs.ticks && Array.isArray(xs.ticks) ? xs.ticks : xs.log ? logTicks(xdom[0], xdom[1], Math.max(3, Math.round(pw / 120))) : nice(xdom[0], xdom[1], xs.ticks || Math.max(3, Math.round(pw / (port ? 120 : 150))));
        xt.forEach(v => { const x = sx(v); if (x < m.l - 1 || x > m.l + pw + 1) return; el('line', { x1: x, x2: x, y1: m.t + ph, y2: m.t + ph + 7, class: 'base' }, g);
          const t = el('text', { x, y: m.t + ph + 32, 'text-anchor': 'middle', class: 'tick' }, g); t.textContent = xfmt(v); }); }
      if (ys.label) { const t = el('text', { x: m.l - ytw - 14 > 0 ? m.l - ytw - 6 : 0, y: m.t - 22, class: 'axt' }, g); t.innerHTML = ''; t.textContent = ys.label; }
      if (xs.label) { const t = el('text', { x: m.l + pw, y: m.t + ph + 34 + fT + 22, 'text-anchor': 'end', class: 'axt' }, g); t.textContent = xs.label; }

      const obstacles = []; // boxes labels must avoid: [x0,y0,x1,y1]
      const segs = [];      // drawn polylines (for the audit and label placement)
      const dense = [];     // dots too many to avoid one by one: labels avoid the cloud as a whole
      const layerS = el('g', {}, svg), layerM = el('g', {}, svg), layerL = el('g', {}, svg);
      const markG = (step, parent) => { const gg = el('g', { class: 'mk', 'data-mstep': step || 0 }, parent); return gg; };

      // bands, areas and reference marks under the data
      const under = marks.filter(mk => ['band', 'area'].includes(mk.kind));
      const over = marks.filter(mk => !['band', 'area'].includes(mk.kind));
      const labels = []; // {text, ax, ay, pref, color, step, kind}
      const drawMark = (mk, parent) => { const n0 = labels.length; drawMark1(mk, parent); if (mk.place) labels.slice(n0).forEach(lb => lb.pref = [mk.place]); };
      const drawMark1 = (mk, parent) => {
        const gg = markG(mk.step, parent), c = col(mk.color || (['point', 'area', 'arrow'].includes(mk.kind) ? 'accent' : 'mist'));
        const V = x => L.val(x, scope, `mark ${mk.kind}`);
        switch (mk.kind) {
          case 'vline': { const x = sx(V(mk.x)); el('line', { x1: x, x2: x, y1: m.t + 4, y2: m.t + ph, stroke: c, 'stroke-width': 2.5, 'stroke-dasharray': mk.dash === false ? null : '9 8', 'stroke-linecap': 'round' }, gg);
            segs.push([[x, m.t], [x, m.t + ph]]); if (mk.label) labels.push({ text: mk.label, ax: x, ay: m.t + 6, alts: [[x, m.t + 6, 0], [x, m.t + ph * .3, .8], [x, m.t + ph * .55, 1.6]], own: segs[segs.length - 1], pref: ['tr', 'tl', 'r', 'l'], step: mk.step, c }); break; }
          case 'hline': { const y = sy(V(mk.y)); el('line', { x1: m.l, x2: m.l + pw, y1: y, y2: y, stroke: c, 'stroke-width': 2.5, 'stroke-dasharray': mk.dash === false ? null : '9 8' }, gg);
            segs.push([[m.l, y], [m.l + pw, y]]); if (mk.label) labels.push({ text: mk.label, ax: m.l + pw - 4, ay: y, pref: ['al', 'bl'], step: mk.step, c }); break; }
          case 'band': { if (mk.x) { const [a, b] = mk.x.map(V); const x0 = sx(Math.max(a, xdom[0])), x1 = sx(Math.min(b, xdom[1]));
              el('rect', { x: x0, y: m.t, width: Math.max(0, x1 - x0), height: ph, fill: c, opacity: .13 }, gg);
              if (mk.label) labels.push({ text: mk.label, ax: (x0 + x1) / 2, ay: m.t + 4, pref: ['b', 'bc'], step: mk.step, c, inside: true }); }
            else if (mk.y) { const [a, b] = mk.y.map(V); const y0 = sy(b), y1 = sy(a); el('rect', { x: m.l, y: y0, width: pw, height: Math.max(0, y1 - y0), fill: c, opacity: .13 }, gg);
              if (mk.label) labels.push({ text: mk.label, ax: m.l + pw - 6, ay: y0 + 4, pref: ['bl'], step: mk.step, c }); } break; }
          case 'area': { const [a, b] = mk.x.map(V), ast = L.parse(mk.fn), sc = L.scope(scope, {}); const n = 120, pts = [];
            for (let i = 0; i <= n; i++) { const x = Math.max(xdom[0], a) + (Math.min(xdom[1], b) - Math.max(xdom[0], a)) * i / n; sc.x = x; const y = L.try(ast, sc, 'mark area'); pts.push([sx(x), clampY(sy(Math.max(ydom[0], y)))]); }
            if (mk.discrete) { /* bars-style area: shade bars from a to b */ }
            const d = `M${pts[0][0]},${m.t + ph}` + pts.map(p => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('') + `L${pts[pts.length - 1][0]},${m.t + ph}Z`;
            el('path', { d, fill: c, opacity: .32 }, gg);
            if (mk.label) { const mid = pts[Math.floor(pts.length / 2)]; labels.push({ text: mk.label, ax: mid[0], ay: (mid[1] + m.t + ph) / 2, pref: ['tr', 'tl', 'r', 'l', 't'], step: mk.step, c, lead: true }); } break; }
          case 'line': case 'fn': {
            let pts;
            if (mk.kind === 'fn') { const ast = L.parse(mk.fn), sc = L.scope(scope, {}); pts = []; const n = 160; for (let i = 0; i <= n; i++) { const x = xs.log ? 10 ** (xa + (xb - xa) * i / n) : xdom[0] + (xdom[1] - xdom[0]) * i / n; sc.x = x; const y = L.try(ast, sc, 'mark fn'); if (Number.isFinite(y) && (!ys.log || y > 0)) pts.push([sx(x), sy(y)]); } pts = pts.filter(p => p[1] >= m.t - 1 && p[1] <= m.t + ph + 1); }
            else pts = [mk.from, mk.to].map(p => [sx(V(p[0])), sy(V(p[1]))]);
            if (pts.length < 2) break;
            el('path', { d: 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L'), fill: 'none', stroke: c, 'stroke-width': 2.5, 'stroke-dasharray': mk.dash === false ? null : '9 8', 'stroke-linecap': 'round' }, gg);
            segs.push(pts); if (mk.label) { const at = f => pts[Math.max(0, Math.min(pts.length - 1, Math.round(pts.length * f) - 1))], f0 = mk.labelAt ?? .82, p = at(f0);
              const alts = pts.length < 3 ? null : [f0, .15, .25, .35, .45, .55, .65, .75, .85, .95].filter((f, i) => !i || Math.abs(f - f0) > .04).map(f => [...at(f), Math.abs(f - f0) * 2]);
              labels.push({ text: mk.label, ax: p[0], ay: p[1], alts, own: pts, pref: ['tl', 'br', 'l', 'r'], step: mk.step, c, lead: true }); } break; }
          case 'point': { const at = mk.at || [mk.x, mk.y], x = sx(V(at[0])), y = sy(V(at[1]));
            el('circle', { cx: x, cy: y, r: mk.r || 10, fill: c, stroke: L.colors.plate, 'stroke-width': 3 }, gg);
            obstacles.push([x - 12, y - 12, x + 12, y + 12]); if (mk.label) labels.push({ text: mk.label, ax: x, ay: y, pref: mk.place ? [mk.place] : ['tr', 'tl', 'br', 'bl', 'r', 'l', 't'], step: mk.step, c, lead: true, strong: true }); break; }
          case 'label': { const at = mk.at; labels.push({ text: mk.text || mk.label, ax: sx(V(at[0])), ay: sy(V(at[1])), pref: mk.place ? [mk.place] : ['c'], step: mk.step, c, plain: true }); break; }
          case 'arrow': { const [x1, y1] = [sx(V(mk.from[0])), sy(V(mk.from[1]))], [x2, y2] = [sx(V(mk.to[0])), sy(V(mk.to[1]))];
            const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, bend = mk.bend ?? .18, cx = (x1 + x2) / 2 - dy * bend, cy = (y1 + y2) / 2 + dx * bend;
            el('path', { d: `M${x1},${y1}Q${cx},${cy} ${x2},${y2}`, fill: 'none', stroke: c, 'stroke-width': 3, 'stroke-linecap': 'round' }, gg);
            const ang = Math.atan2(y2 - cy, x2 - cx), h = 14; el('path', { d: `M${x2},${y2}L${x2 - h * Math.cos(ang - .45)},${y2 - h * Math.sin(ang - .45)}L${x2 - h * Math.cos(ang + .45)},${y2 - h * Math.sin(ang + .45)}Z`, fill: c }, gg);
            segs.push([[x1, y1], [cx, cy], [x2, y2]]); if (mk.label) labels.push({ text: mk.label, ax: cx, ay: cy, pref: ['t', 'b', 'r', 'l'], step: mk.step, c }); break; }
          case 'span': { const [a, b] = mk.x.map(V), y = mk.y != null ? sy(V(mk.y)) : m.t + (mk.yf != null ? ph * mk.yf : 18), x0 = sx(Math.max(a, xdom[0])), x1 = sx(Math.min(b, xdom[1]));
            el('path', { d: `M${x0},${y - 9}V${y + 9}M${x0},${y}H${x1}M${x1},${y - 9}V${y + 9}`, stroke: c, 'stroke-width': 2.5, fill: 'none', 'stroke-linecap': 'round' }, gg);
            segs.push([[x0, y], [x1, y]]); if (mk.label) labels.push({ text: mk.label, ax: (x0 + x1) / 2, ay: y - 6, pref: ['t', 'b'], step: mk.step, c }); break; }
          default: L.err('chart', `unknown mark kind "${mk.kind}"`);
        }
      };
      under.forEach(mk => drawMark(mk, layerM));

      // series
      series.forEach((s, si) => {
        const d = data[si], c = col(s.c), gg = markG(s.step, layerS), kind = s.kind || 'line';
        if (!d.length) return;
        if (kind === 'line' || kind === 'area' || kind === 'step') {
          let pts = d.map(p => [sx(p[0]), sy(p[1])]);
          if (ys.log) pts = pts.filter((p, i) => d[i][1] > 0);
          pts = pts.filter(p => p[0] >= m.l - 1 && p[0] <= m.l + pw + 1);
          if (kind === 'step') { const st = []; pts.forEach((p, i) => { if (i) st.push([p[0], pts[i - 1][1]]); st.push(p); }); pts = st; }
          const clipped = pts.map(p => [p[0], clampY(p[1])]);
          const path = 'M' + clipped.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');
          if (kind === 'area') {
            el('path', { d: path + `L${clipped[clipped.length - 1][0]},${m.t + ph}L${clipped[0][0]},${m.t + ph}Z`, fill: c, 'fill-opacity': .18 }, gg);
          }
          el('path', { d: path, fill: 'none', stroke: c, 'stroke-width': s.width || (s.focus ? 4 : 3.5), 'stroke-linecap': 'square', 'stroke-linejoin': 'miter', 'stroke-dasharray': s.dash ? '10 9' : null, opacity: s.opacity }, gg);
          segs.push(clipped);
          if (endLabels.includes(s) && clipped.length) { const p = clipped[clipped.length - 1]; labels.push({ text: s.label || s.name, ax: p[0] + 6, ay: p[1], pref: ['r'], step: s.step, c, end: true, plain: true }); }
        } else if (kind === 'bars' || kind === 'lollipop') {
          const xsArr = d.map(p => p[0]);
          let band = cats ? pw / cats.length : xsArr.length > 1 ? Math.min(...xsArr.slice(1).map((x, i) => Math.abs(sx(x) - sx(xsArr[i])))) : pw / 8;
          const bw = Math.max(2, Math.min(band * (s.bw ?? .64), 64));
          d.forEach(p => { const cx = cats ? sx(p[0] + .5) : sx(p[0]), y0 = sy(Math.max(ydom[0], ys.log ? ydom[0] : 0)), y1 = clampY(sy(p[1]));
            if (kind === 'lollipop') { el('line', { x1: cx, x2: cx, y1: y0, y2: y1, stroke: c, 'stroke-width': 3, opacity: .9 }, gg); el('circle', { cx, cy: y1, r: Math.min(7, Math.max(4, bw / 3)), fill: c, stroke: L.colors.plate, 'stroke-width': 2 }, gg); }
            else { const h = y0 - y1; if (h <= .5) return; const x = cx - bw / 2;
              el('rect', { x, y: y1, width: bw, height: h, fill: c, opacity: s.opacity ?? (s.focus ? 1 : .92) }, gg); }
            obstacles.push([cx - bw / 2, y1, cx + bw / 2, y0]); });
          if (s.highlight != null) { const hv = L.val(s.highlight, scope); const hi = d.find(p => p[0] === hv); if (hi) { const cx = cats ? sx(hi[0] + .5) : sx(hi[0]); const y1 = sy(hi[1]);
            el('rect', { x: cx - bw / 2 - 4, y: y1 - 4, width: bw + 8, height: sy(0) - y1 + 4, fill: 'none', stroke: col('accent'), 'stroke-width': 3 }, gg); } }
        } else if (kind === 'hist') {
          d.forEach(b => { if (b.y <= 0) return; const x0 = sx(Math.max(b.x0, xdom[0])) + 1, x1 = sx(Math.min(b.x1, xdom[1])) - 1, y1 = clampY(sy(b.y)), y0 = sy(0), w = x1 - x0;
            if (w <= 0) return; el('rect', { x: x0, y: y1, width: w, height: y0 - y1, fill: c, opacity: s.opacity ?? .9 }, gg);
            obstacles.push([x0, y1, x1, y0]); });
        } else if (kind === 'dots') {
          const many = d.length > 300, r = s.r || (many ? 4.5 : 8);
          d.forEach(p => { const x = sx(p[0]), y = sy(p[1]); if (x < m.l - 2 || x > m.l + pw + 2 || y < m.t - 2 || y > m.t + ph + 2) return;
            el('circle', { cx: x, cy: y, r, fill: c, stroke: L.colors.plate, 'stroke-width': many ? 1.2 : 2.5, opacity: s.opacity ?? (many ? .75 : 1) }, gg); if (!many) obstacles.push([x - r, y - r, x + r, y + r]); else dense.push([x, y]); });
        }
      });
      over.forEach(mk => drawMark(mk, layerM));

      // labels: flat square tags placed clear of other labels, data and the plot edge
      const placed = [];
      // axis titles and tick labels are taken space: labels must not land on them
      g.querySelectorAll('text').forEach(t => { const b = t.getBBox(); placed.push([b.x - 4, b.y - 2, b.x + b.width + 4, b.y + b.height + 2]); });
      if (hasLegend && !vhead) placed.push([0, 0, legend.offsetWidth + 8, legH - 6]);
      const plotBox = [m.l - 4, m.t - legH - 4, m.l + pw + m.r, m.t + ph];
      labels.sort((a, b) => (b.end ? 1 : 0) - (a.end ? 1 : 0));
      const hitSeg = (b) => segs.some(pts => pts.some((p, i) => i && segBox(pts[i - 1], p, b)));
      const over2 = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
      const leadEnd = (ax, ay, [x0, y0, x1, y1]) => [Math.max(x0, Math.min(x1, ax)), ay < y0 ? y0 : ay > y1 ? y1 : (y0 + y1) / 2];   // where a leader meets its label
      const cuts = (a, b, own) => segs.some(pts => pts !== own && pts.some((p, i) => i && crossSeg(a, b, pts[i - 1], p)));
      labels.forEach(lb => {
        const text = L.plain(lb.text, scope), w = L.measure(text, 23, lb.strong ? 650 : 600) + (lb.plain ? 4 : 26), h = lb.plain ? 28 : 40, gap = lb.lead ? 26 : 12;
        let best = null, bestScore = Infinity;
        (lb.alts || [[lb.ax, lb.ay, 0]]).forEach(([ax, ay, away]) => {   // away: cost of sliding off the preferred anchor
          if (bestScore < 1) return;
          const cand = { tr: [ax + gap, ay - gap - h], tl: [ax - gap - w, ay - gap - h], br: [ax + gap, ay + gap], bl: [ax - gap - w, ay + gap],
            r: [ax + gap, ay - h / 2], l: [ax - gap - w, ay - h / 2], t: [ax - w / 2, ay - gap - h], b: [ax - w / 2, ay + gap], c: [ax - w / 2, ay - h / 2],
            bc: [ax - w / 2, ay + 8], al: [ax - w, ay - h - 8] };
          if (lb.end) { for (let dy = 0; dy < 140; dy += 8) for (const sgn of [1, -1]) { const y = ay - h / 2 + sgn * dy; cand['r' + sgn * dy] = [ax + gap, y]; } }
          const order = lb.end ? Object.keys(cand).filter(k => /^r-?\d/.test(k)) : [...lb.pref, ...['tr', 'tl', 'r', 'l', 't', 'b', 'br', 'bl'].filter(k => !lb.pref.includes(k))];
          // a tag may also slide sideways along its side (a little cost per pixel), so a crowded corner does not force an overlap
          const slides = lb.end || lb.plain ? [0] : [0, 40, -40, 90, -90, w / 2, -w / 2];
          for (const k of order) { for (const dx of slides) {
            const [x0, y] = cand[k] || cand.tr, x = x0 + dx, box = [x, y, x + w, y + h];
            let score = (lb.end ? order.indexOf(k) * .05 : order.indexOf(k) * .5) + away + Math.abs(dx) / 80;
            if (box[0] < plotBox[0] - (lb.end ? 0 : 2) || box[2] > W - 2 || box[1] < 2 || box[3] > m.t + ph + (lb.end ? 4 : 0)) score += 100;
            if (placed.some(p => over2(p, box))) score += 60;
            if (obstacles.some(o => over2(o, box))) score += 14;
            if (hitSeg(box)) score += 10;
            if (dense.length) { let n = 0; for (const p of dense) if (p[0] > box[0] && p[0] < box[2] && p[1] > box[1] && p[1] < box[3]) n++; score += Math.min(16, n * .5); }
            if (lb.lead && k !== 'c' && cuts([ax, ay], leadEnd(ax, ay, box), lb.own)) score += 8;
            if (score < bestScore) { bestScore = score; best = { box, k, ax, ay }; }
            if (score < 1) break;
          } if (bestScore < 1) break; }
        });
        const [x0, y0, x1, y1] = best.box, { ax, ay } = best; placed.push(best.box);
        const gg = markG(lb.step, layerL);
        if (lb.end && Math.abs((best.box[1] + best.box[3]) / 2 - ay) > 10) el('line', { x1: ax - 4, y1: ay, x2: best.box[0], y2: (best.box[1] + best.box[3]) / 2, stroke: lb.c, 'stroke-width': 1.5, opacity: .7 }, markG(lb.step, layerL));
        if (lb.lead && best.k !== 'c') { const [tx, ty] = leadEnd(ax, ay, best.box);
          el('line', { x1: ax, y1: ay, x2: tx, y2: ty, stroke: lb.c, 'stroke-width': 2, opacity: .85 }, gg); }
        if (!lb.plain) el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: L.colors.pill || '#242526', stroke: L.colors.line || '#565653', 'stroke-width': 2 }, gg);
        if (!lb.plain) el('circle', { cx: x0 + 14, cy: (y0 + y1) / 2, r: 0 }, gg);
        const t = el('text', { x: lb.plain ? x0 + 2 : (x0 + x1) / 2, y: (y0 + y1) / 2 + 8, 'text-anchor': lb.plain ? 'start' : 'middle', class: 'lbl' + (lb.end ? ' dim' : ''), 'data-lbl': 1 }, gg);
        t.textContent = text;
      });
      C.segs = segs; C.placed = placed; C.W = W; C.H = H; C.plot = [m.l, m.t, m.l + pw, m.t + ph];
      // data table
      table.innerHTML = dataTable(series, data, cats, xs, ys);
      C.setStep(C.k);
      bindTip(scope);
      return true;
    };

    C.setStep = function (k) {
      C.k = k;
      wrap.querySelectorAll('[data-mstep]').forEach(e => { const s = +e.dataset.mstep; e.classList.toggle('off', s > k); });
    };

    function dataTable(series, data, cats, xs, ys) {
      const rows = []; const head = ['<th>' + L.esc(xs.label || 'x') + '</th>'];
      series.forEach((s, i) => head.push('<th>' + L.esc(s.name || `series ${i + 1}`) + '</th>'));
      const xsAll = [...new Set(data.flatMap(d => d.map(p => Array.isArray(p) ? p[0] : (p.x0 + p.x1) / 2)))].sort((a, b) => a - b);
      const pick = xsAll.length > 24 ? xsAll.filter((_, i) => i % Math.ceil(xsAll.length / 24) === 0) : xsAll;
      pick.forEach(x => { const r = ['<td>' + (cats ? L.esc(cats[x] ?? x) : L.fmt(x, xs.fmt)) + '</td>'];
        data.forEach(d => { const p = d.find(q => Array.isArray(q) ? Math.abs(q[0] - x) < 1e-9 : Math.abs((q.x0 + q.x1) / 2 - x) < 1e-9); r.push('<td>' + (p ? L.fmt(Array.isArray(p) ? p[1] : p.y, ys.fmt) : '') + '</td>'); });
        rows.push('<tr>' + r.join('') + '</tr>'); });
      return `<table><thead><tr>${head.join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
    }

    function bindTip() {
      if (!svg || !state) return;
      const { sx, sy, m, pw, ph, data } = state;
      let guide = null;
      const hide = () => { tip.classList.remove('on'); if (guide) guide.remove(); guide = null; };
      svg.onpointerleave = hide;
      svg.onpointermove = e => {
        const r = svg.getBoundingClientRect(), k = r.width / C.W, x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k;
        if (x < m.l || x > m.l + pw || y < m.t - 10 || y > m.t + ph) return hide();
        const rows = []; let gx = null;
        series.forEach((s, i) => { if (s.step && s.step > C.k) return; const d = data[i]; if (!d.length) return;
          if (Array.isArray(d[0])) { let best = null, bd = Infinity; d.forEach(p => { const dd = Math.abs(sx(p[0]) - x) + (s.kind === 'dots' ? Math.abs(sy(p[1]) - y) : 0); if (dd < bd) { bd = dd; best = p; } });
            if (best && bd < (s.kind === 'dots' ? 36 : 60)) { rows.push([s, best]); gx = gx ?? sx(best[0]); } }
          else { const b = d.find(q => x >= sx(q.x0) && x <= sx(q.x1)); if (b) rows.push([s, [`${L.fmt(b.x0)}–${L.fmt(b.x1)}`, b.y]]); } });
        if (!rows.length) return hide();
        if (gx != null) { if (!guide) guide = el('line', { class: 'grid', y1: m.t, y2: m.t + ph, 'stroke-width': 2, stroke: L.colors.line || '#565653' }, svg); guide.setAttribute('x1', gx); guide.setAttribute('x2', gx); }
        const xs = spec.x || {}, ys = spec.y || {};
        tip.innerHTML = `<div>${L.esc(xs.label || 'x')}: <b>${typeof rows[0][1][0] === 'string' ? rows[0][1][0] : state.cats ? L.esc(state.cats[rows[0][1][0]]) : L.fmt(rows[0][1][0], xs.fmt)}</b></div>` +
          rows.map(([s, p]) => `<div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${col(s.c)};margin-right:8px"></span>${L.esc(L.plain(s.name || ys.label || 'y'))}: <b>${L.fmt(p[1], ys.fmt)}</b></div>`).join('');
        tip.classList.add('on');
        const tw = tip.offsetWidth, th = tip.offsetHeight; let tx = x + 18, ty = y - th - 12; if (tx + tw > C.W) tx = x - tw - 18; if (ty < 0) ty = y + 18;
        tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
      };
    }

    C.audit = function () {
      const out = [];
      if (!svg) return out;
      const texts = [...svg.querySelectorAll('text')].filter(t => !t.closest('.off'));
      const boxes = texts.map(t => { const b = t.getBBox(); return { t, b: [b.x, b.y, b.x + b.width, b.y + b.height] }; });
      for (let i = 0; i < boxes.length; i++) {
        const a = boxes[i].b;
        if (a[0] < -3 || a[1] < -3 || a[2] > C.W + 3 || a[3] > C.H + 3) out.push(`chart text "${boxes[i].t.textContent.slice(0, 30)}" leaves the chart`);
        for (let j = i + 1; j < boxes.length; j++) { const b = boxes[j].b; const ov = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
          if (ov > 12) out.push(`chart labels overlap: "${boxes[i].t.textContent.slice(0, 24)}" × "${boxes[j].t.textContent.slice(0, 24)}"`); }
      }
      return out;
    };
    return C;
  };

  // segment-box intersection
  // do segments a–b and c–d cross?
  function crossSeg(a, bb, c, d) { const den = (bb[0] - a[0]) * (d[1] - c[1]) - (bb[1] - a[1]) * (d[0] - c[0]); if (!den) return false;
    const u = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den, v = ((c[0] - a[0]) * (bb[1] - a[1]) - (c[1] - a[1]) * (bb[0] - a[0])) / den; return u > 0 && u < 1 && v > 0 && v < 1; }
  function segBox(p, q, b) {
    const [x0, y0, x1, y1] = b, inside = (x, y) => x > x0 && x < x1 && y > y0 && y < y1;
    if (inside(p[0], p[1]) || inside(q[0], q[1])) return true;
    const c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    return [0, 1, 2, 3].some(i => crossSeg(p, q, c[i], c[(i + 1) % 4]));
  }
})();
