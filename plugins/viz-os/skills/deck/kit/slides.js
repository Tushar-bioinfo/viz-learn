/* viz-os slides: one renderer per slide type, plus visuals (chart, stat, units, parts, flow, code, image, eqn, svg).
   A renderer returns { node, steps, show(k), layout(), audit(), more }. Steps reveal with data-step="k" (1-based);
   `more` is HTML the renderer moved off the slide's face into the more sheet. */
(function () {
  'use strict';
  const L = window.VizOS;
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  L.h = h;
  const md = s => L.md(s);
  const TERMC = ['s1', 's2', 's3', 'mist'];

  // ---------- TeX ----------
  const TRUST = c => c.command === '\\htmlClass' || c.command === '\\htmlData';
  const GREEKU = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', nu: 'ν', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
    Sigma: 'Σ', Delta: 'Δ', Phi: 'Φ', Pi: 'Π', Omega: 'Ω', times: '×', cdot: '·', le: '≤', ge: '≥', ne: '≠', approx: '≈', sim: '∼', sum: 'Σ', prod: 'Π', infty: '∞', pm: '±', to: '→', ln: 'ln', log: 'log', dots: '…', ldots: '…' };
  const SUPC = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '+': '⁺', n: 'ⁿ', i: 'ⁱ' };
  const SUBC = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', n: 'ₙ', '-': '₋', '+': '₊' };
  L.texPlain = function (t) {
    let s = String(t);
    for (let i = 0; i < 4; i++) s = s.replace(/\\htmlClass\{[^}]*\}\{((?:[^{}]|\{[^{}]*\})*)\}/g, '$1');
    s = s.replace(/\\d?frac\{((?:[^{}]|\{[^{}]*\})*)\}\{((?:[^{}]|\{[^{}]*\})*)\}/g, '($1)/($2)').replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
      .replace(/\\(?:mathrm|text|operatorname|mathit|mathbf)\{([^{}]*)\}/g, '$1').replace(/\\left|\\right/g, '').replace(/\\bar\{([^{}]*)\}/g, '$1̄')
      .replace(/\^\{([^{}]*)\}|\^(\w)/g, (_, a, b) => [...(a ?? b)].map(c => SUPC[c] ?? c).join(''))
      .replace(/_\{([^{}]*)\}|_(\w)/g, (_, a, b) => [...(a ?? b)].map(c => SUBC[c] ?? c).join(''))
      .replace(/\\([A-Za-z]+)/g, (_, w) => GREEKU[w] ?? w).replace(/\\[,;!: ]/g, ' ').replace(/[{}]/g, '').replace(/\s+/g, ' ');
    return s.trim();
  };
  L.renderTex = function (el, tex, display) {
    if (window.katex) {
      try { window.katex.render(tex, el, { displayMode: !!display, throwOnError: false, strict: 'ignore', trust: TRUST, output: 'html' }); return true; }
      catch (e) { L.err('formula', `${e.message} in "${tex}"`); }
    }
    el.textContent = L.texPlain(tex); el.classList.add('tex-fallback'); return false;
  };
  // interpolate {{expr|fmt}} inside a string; inTex = numbers formatted for TeX
  const FMT = /^(\d+|s\d+|%\d*|e\d*|,|int)$/;
  const splitFmt = raw => { const k = raw.lastIndexOf('|'); if (k > 0 && FMT.test(raw.slice(k + 1).trim())) { const f = raw.slice(k + 1).trim(); return [raw.slice(0, k), /^\d+$/.test(f) ? +f : f]; } return [raw, undefined]; };
  L.interp = function (s, scope, inTex) {
    return String(s ?? '').replace(/\{\{([\s\S]+?)\}\}/g, (_, raw) => { const [x, f] = splitFmt(raw); const v = L.try(x, scope, `text {{${raw}}}`); return inTex ? L.numTex(v, f) : L.fmt(v, f); });
  };
  L.plain = (s, scope) => L.texPlain(L.interp(String(s ?? ''), scope).replace(/\$([^$]+)\$/g, '$1')).replace(/\*\*|==|`/g, '').replace(/(?<!\w)\*(\S.*?\S|\S)\*(?!\w)/g, '$1');
  L.fill = function (root, scope) {
    root.querySelectorAll('.iv').forEach(sp => { const [x, f] = splitFmt(sp.dataset.x); try { sp.textContent = L.fmt(L.eval(x, scope), f); sp.classList.remove('bad'); } catch (e) { sp.textContent = '⟨?⟩'; sp.classList.add('bad'); L.err('text', `${e.message} in {{${sp.dataset.x}}}`); } });
    root.querySelectorAll('.tx').forEach(sp => { const raw = sp.dataset.tex; if (sp.dataset.done && !raw.includes('{{')) return; L.renderTex(sp, L.interp(raw, scope, true), false); sp.dataset.done = 1; });
  };

  // ---------- symbols ----------
  const symOf = (ctx, n) => { const s = (ctx.symbols || {})[n] || (ctx.terms || {})[n]; return s && s.tex ? s.tex : L.autoSym(n); };
  const saysOf = (ctx, n) => { const s = (ctx.terms || {})[n] || (ctx.symbols || {})[n]; return s && s.says ? s.says : null; };
  // the label under a number: `short` if given, else `says`
  // how a number substituted into working is written: the rounding it is shown with elsewhere (an earlier line, its
  // column, its symbol's `fmt`), else 4 significant figures (whole numbers in full), so a reader can redo the
  // arithmetic by hand (a line's own `fmt` rounds only its result)
  const subFmt = (ctx, n, v, own) => own ?? (((ctx.terms || {})[n] || (ctx.symbols || {})[n] || {}).fmt) ?? (Number.isInteger(v) ? ',' : 's4');
  const shortOf = (ctx, n) => { const s = (ctx.terms || {})[n] || (ctx.symbols || {})[n]; return (s && (s.short || s.says)) || n; };

  // ---------- notation: the first slide that uses a symbol says what it means, in plain words, once per deck ----------
  const NOTATION = [
    [/\\sum\b/, '\\sum', 'add up every term'],
    [/\\prod\b/, '\\prod', 'multiply every term'],
    [/\\bar\{/, '\\bar{x}', 'the average of x'],
    [/\\hat\{/, '\\hat{x}', 'x estimated from the data'],
    [/_\{\s*i\s*,?\s*j\s*\}/, 'x_{ij}', 'row i, column j of a table'],
    [/\\log_\{?2\b/, '\\log_2', 'how many doublings'],
    [/\\log_\{10\}/, '\\log_{10}', 'how many powers of ten'],
    [/\\ln\b/, '\\ln', 'log to base e (natural log)'],
    [/(?<![A-Za-z\\])e\^/, 'e^{x}', 'e (about 2.718) to the power x'],
    [/\\sqrt\b/, '\\sqrt{v}', 'square root: back to the units of x'],
    [/\\Phi\b/, '\\Phi(z)', 'normal area to the left of z'],
    [/\\varphi\b/, '\\varphi(z)', 'height of the normal curve at z'],
    [/\\sim\b/, 'X \\sim', 'X is drawn from'],
    [/\\mid\b/, 'P(A \\mid B)', 'chance of A once B is known'],
    [/\\binom\b/, '\\tbinom{n}{k}', 'ways to choose k of n'],
    [/\\Gamma\b/, '\\Gamma(r)', 'factorial stretched to any number'],
    [/[\w)}]!/, 'n!', 'n × (n − 1) × … × 1'],
    [/median/, '\\operatorname{median}', 'the middle value after sorting'],
    [/\\operatorname\{rank\}|\\mathrm\{rank\}/, '\\operatorname{rank}', 'position after sorting'],
    [/\\in\b/, 'j \\in S', 'j is one of the items in S'],
    [/\\min\b/, '\\min', 'the smallest'],
    [/\\max\b/, '\\max', 'the largest'],
    [/\\operatorname\{Var\}|\\mathrm\{Var\}/, '\\operatorname{Var}', 'variance: spread around the mean'],
    [/\\mathbb\{E\}|\\operatorname\{E\}/, '\\mathbb{E}', 'expected value: the long-run average'],
    [/\\propto\b/, '\\propto', 'grows in step with'],
    [/\\approx\b/, '\\approx', 'about equal to'],
    [/\\int\b/, '\\int', 'area under a curve'],
    [/\\infty\b/, '\\infty', 'without end'],
  ];
  // the plain words for symbols a slide uses for the first time in the deck (at most 4), plus any the slide lists itself
  function notationEl(texs, s, cls = '') {
    if (s.notation === false || (L.deck && L.deck.notation === false)) return null;
    const src = texs.filter(Boolean).join(' '), hits = [];
    (Array.isArray(s.notation) ? s.notation : []).forEach(n => { if (!L.seenNotation.has(n.tex)) { L.seenNotation.add(n.tex); hits.push([n.tex, n.says]); } });
    NOTATION.forEach(([re, tex, words]) => { if (hits.length < 4 && re.test(src) && !L.seenNotation.has(tex)) { L.seenNotation.add(tex); hits.push([tex, words]); } });
    if (!hits.length) return null;
    return h('div', 'notation ' + cls, `<span class="wtag">New notation</span>` + hits.map(([t, w]) => `<span class="nt"><span class="ns tx" data-tex="${L.esc(t)}"></span><span class="nw">${md(w)}</span></span>`).join(''));
  }
  L.notationEl = notationEl;

  // ---------- distributions by name: shape, parameters, mean and variance ----------
  // pmf/mean/var are expressions; {p} is replaced by the author's expression for parameter p (so sliders move them)
  const DIST = {
    poisson: { name: 'Poisson', disc: true, p: ['mu'], pmf: 'poisPmf(x, {mu})', cdf: 'poisCdf(x, {mu})', mean: '{mu}', var: '{mu}', mt: '\\mu', vt: '\\mu' },
    nb: { name: 'Negative binomial', disc: true, p: ['mu', 'alpha'], pmf: 'nbPmf(x, {mu}, {alpha})', cdf: 'nbCdf(x, {mu}, {alpha})', mean: '{mu}', var: '{mu} + {alpha} * {mu}^2', mt: '\\mu', vt: '\\mu + \\alpha\\mu^2' },
    binomial: { name: 'Binomial', disc: true, p: ['n', 'p'], pmf: 'binomPmf(x, {n}, {p})', cdf: 'binomCdf(x, {n}, {p})', mean: '{n} * {p}', var: '{n} * {p} * (1 - {p})', mt: 'np', vt: 'np(1-p)' },
    normal: { name: 'Normal', p: ['mu', 'sigma'], pmf: 'normPdf(x, {mu}, {sigma})', cdf: 'normCdf(x, {mu}, {sigma})', mean: '{mu}', var: '{sigma}^2', mt: '\\mu', vt: '\\sigma^2' },
    gamma: { name: 'Gamma', p: ['shape', 'rate'], pmf: 'gammaPdf(x, {shape}, {rate})', mean: '{shape} / {rate}', var: '{shape} / {rate}^2', mt: 'k/\\beta', vt: 'k/\\beta^2' },
    beta: { name: 'Beta', p: ['a', 'b'], pmf: 'betaPdf(x, {a}, {b})', cdf: 'betaCdf(x, {a}, {b})', mean: '{a} / ({a} + {b})', var: '{a} * {b} / (({a} + {b})^2 * ({a} + {b} + 1))', mt: '\\tfrac{a}{a+b}', vt: '\\tfrac{ab}{(a+b)^2(a+b+1)}' },
    uniform: { name: 'Uniform', p: ['a', 'b'], pmf: 'where(x >= {a}, where(x <= {b}, 1 / ({b} - {a}), 0), 0)', cdf: 'clamp((x - {a}) / ({b} - {a}), 0, 1)', mean: '({a} + {b}) / 2', var: '({b} - {a})^2 / 12', mt: '\\tfrac{a+b}{2}', vt: '\\tfrac{(b-a)^2}{12}' },
  };
  const PSYM = { mu: '\\mu', alpha: '\\alpha', sigma: '\\sigma', n: 'n', p: 'p', shape: 'k', rate: '\\beta', a: 'a', b: 'b' };
  L.DIST = DIST;
  // a dist visual becomes a chart: bars (counts) or a curve, the mean, plus or minus one SD, an optional tail in orange,
  // and an optional second family drawn as a dashed line for comparison
  function distOf(d, where) {
    const F = DIST[d.family]; if (!F) throw new Error(`${where}: unknown distribution family "${d.family}" (use ${Object.keys(DIST).join(', ')})`);
    const P = d.params || {}; F.p.forEach(k => { if (P[k] == null) throw new Error(`${where}: ${d.family} needs params.${k}`); });
    const sub = t => t.replace(/\{(\w+)\}/g, (_, k) => `(${P[k]})`);
    return { F, P, pmf: sub(F.pmf), cdf: F.cdf ? sub(F.cdf) : null, mean: sub(F.mean), sd: `sqrt(${sub(F.var)})`, var: sub(F.var) };
  }
  function distSpec(d, scope, where) {
    const A = distOf(d, where), B = d.vs ? distOf(d.vs, where) : null, disc = A.F.disc;
    let [lo, hi] = d.x || [NaN, NaN];
    if (!d.x) { const m = L.try(A.mean, scope, where), sd = L.try(A.sd, scope, where), sdB = B ? L.try(B.sd, scope, where) : 0, w = 4 * Math.max(sd, sdB);
      lo = d.family === 'beta' || d.family === 'uniform' ? 0 : Math.max(disc || d.family === 'gamma' ? 0 : -Infinity, m - w); hi = d.family === 'beta' ? 1 : m + w;
      if (disc) { lo = Math.floor(lo); hi = Math.ceil(hi); } }
    const many = disc && hi - lo > 120, kind = disc && !many ? 'bars' : 'area';
    const series = [{ name: d.label || A.F.name, kind, fn: A.pmf, discrete: disc, color: d.color || 's1' }];
    if (B) series.push({ name: d.vs.label || B.F.name, kind: 'line', fn: B.pmf, discrete: B.F.disc && !many, dash: true, color: d.vs.color || 's2', width: 3.5 });
    const t = d.tail;
    if (t) { const cond = t.below != null ? `x <= (${t.below})` : `x >= (${t.above})`;
      series.push({ name: t.label || 'tail', legend: false, kind, fn: `where(${cond}, ${A.pmf}, 0)`, discrete: disc, color: 'accent' }); }
    const show = d.show || ['mean', 'sd'], marks = [];
    if (show.includes('mean')) marks.push({ kind: 'vline', x: A.mean, color: 'ink', label: d.meanLabel || 'mean' });
    if (show.includes('sd')) { marks.push({ kind: 'span', x: [`${A.mean} - ${A.sd}`, `${A.mean} + ${A.sd}`], yf: B ? .1 : .14, color: d.color || 's1', label: B ? `±1 SD, ${d.label || A.F.name}` : '±1 SD' });
      if (B) marks.push({ kind: 'span', x: [`${B.mean} - ${B.sd}`, `${B.mean} + ${B.sd}`], yf: .26, color: d.vs.color || 's2', label: `±1 SD, ${d.vs.label || B.F.name}` }); }
    if (t && t.at !== false) marks.push({ kind: 'vline', x: t.below ?? t.above, color: 'accent', dash: false, label: t.mark || null });
    return { A, B, spec: { x: { label: d.xlabel || (disc ? 'count' : 'x'), min: lo, max: hi, fmt: d.xfmt }, y: { label: d.ylabel || (disc ? 'probability' : 'density'), fmt: d.yfmt }, series, marks, table: false, alt: d.alt || `${A.F.name} distribution` } };
  }

  // ---------- common head ----------
  const LEADW = /^(But|So|Now|Why|Yet|Then|Therefore|Next|Wait|First|Finally|Notice|Here|Still|Instead|Remember|Recall|Back)\b/;
  function head(s, extra) {
    const hd = h('div', 'head enter');
    if (s.eyebrow || extra) hd.appendChild(h('div', 'eyebrow', md(s.eyebrow || extra)));
    if (s.lead) hd.appendChild(h('div', 'lead', md(s.lead).replace(LEADW, '<span class="lw">$1</span>')));
    if (s.title) hd.appendChild(h('div', 'h1', md(s.title)));
    // why this step: what the slide is for, so no calculation is a procedure without a reason (a predict slide's `why` is its answer)
    if (s.why && s.type !== 'predict') hd.appendChild(h('div', 'purpose', `<span class="wtag">Why</span><span>${md(s.why)}</span>`));
    return hd;
  }
  L.head = head;
  function points(list, from = 1, build = true) {
    const ul = h('ul', 'pts');
    (list || []).forEach((p, i) => { const li = h('li', '', `<span class="pip"></span><span>${md(p)}</span>`); if (build) li.dataset.step = from + i; ul.appendChild(li); });
    return ul;
  }

  // ---------- controls ----------
  function controls(list, slideCtx) {
    const box = h('div', 'controls');
    (list || []).forEach(c => {
      const w = h('div', 'ctl g pill thin'); w.dataset.name = c.name;
      const id = `ctl-${slideCtx.index}-${c.name}`;
      w.innerHTML = `<label for="${id}">${md(c.label || c.name)}</label><input id="${id}" type="range" min="${c.min}" max="${c.max}" step="${c.step ?? (c.max - c.min) / 100}" value="${c.value ?? c.min}"><output></output>`;
      const inp = w.querySelector('input'), out = w.querySelector('output');
      const set = v => { slideCtx.scope[c.name] = +v; out.textContent = L.fmt(+v, c.fmt); inp.style.setProperty('--fill', ((v - c.min) / (c.max - c.min) * 100) + '%'); };
      set(c.value ?? c.min);
      inp.addEventListener('input', () => { set(inp.value); slideCtx.refresh(); });
      inp.addEventListener('pointerdown', e => e.stopPropagation());
      slideCtx.ctl[c.name] = v => { inp.value = v; set(v); slideCtx.refresh(); };
      box.appendChild(w);
    });
    return box;
  }

  // ---------- visuals ----------
  L.visual = function (v, ctx) {
    const vis = h('div', 'vis g plate enter');
    const R = { node: vis, steps: 0, show() {}, layout() {}, audit: () => [] };
    if (!v) return R;
    if (v.chart) {
      const C = L.chart(vis, v.chart, () => ctx.scope, { vis });
      R.steps = C.steps; R.layout = () => C.render(); R.show = k => C.setStep(k); R.audit = () => C.audit(); ctx.charts.push(C);
    } else if (v.stat) {
      const st = v.stat; const box = h('div', 'stat');
      box.innerHTML = `<div class="num">${md(st.value)}</div>${st.label ? `<div class="lab">${md(st.label)}</div>` : ''}${st.sub ? `<div class="sub">${md(st.sub)}</div>` : ''}`;
      vis.appendChild(box); vis.classList.remove('plate');
    } else if (v.units) {
      const u = v.units, box = h('div', 'units'); vis.appendChild(box);
      const svg = L.svgEl('svg', {}); box.appendChild(svg); if (u.label) box.appendChild(h('div', 'ulab', md(u.label)));
      R.layout = () => {
        const n = Math.round(L.val(u.n, ctx.scope, 'units.n')), hi = Math.round(L.val(u.hi ?? 0, ctx.scope, 'units.hi')), W = svg.clientWidth || 600, H = svg.clientHeight || 300;
        let cols = u.cols || Math.ceil(Math.sqrt(n * W / H)); const rows = Math.ceil(n / cols), cell = Math.min(W / cols, H / rows), r = cell * .36;
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = '';
        const ox = (W - cols * cell) / 2, oy = (H - rows * cell) / 2, A = L.colors.accent;
        // a lit unit is a solid orange dot; the others are grey rings
        for (let i = 0; i < n; i++) { const cx = ox + (i % cols + .5) * cell, cy = oy + (Math.floor(i / cols) + .5) * cell, on = i < hi;
          L.svgEl('circle', { cx, cy, r, fill: on ? A : 'none', stroke: on ? 'none' : L.colors.haze, 'stroke-width': on ? 0 : 2, opacity: on ? 1 : .7 }, svg); }
      };
      vis.classList.remove('plate');
    } else if (v.parts) {
      const p = v.parts, box = h('div', 'parts'); vis.appendChild(box); vis.classList.remove('plate');
      const svg = L.svgEl('svg', {}); box.appendChild(svg);
      const items = (p.items || []).map(it => typeof it === 'string' ? { label: it } : it), multi = !!p.rows;
      if (p.build) R.steps = multi ? p.rows.length : items.length;
      // pieces that are not the focus are flat greys at four strengths, neighbours never the same; the focus is orange
      const GREYS = ['#8e8c86', '#5b5a56', '#b3b0a8', '#6f6d68'];
      const fillOf = (it, i) => it.color ? (L.colors[it.color] || it.color) : it.focus ? L.colors.accent : GREYS[i % GREYS.length];
      R.layout = () => {
        const W = box.clientWidth, H = box.clientHeight; if (!W || !H) return;
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = '';
        const val = x => L.val(x, ctx.scope, `slide ${ctx.index + 1} parts`), fmt = x => L.fmt(x, p.fmt);
        const g = st => L.svgEl('g', st ? { 'data-pstep': st } : {}, svg);
        const text = (par, cls, x, y, t, anchor = 'middle') => { const e = L.svgEl('text', { class: cls, x, y, 'text-anchor': anchor }, par); e.textContent = t; return e; };
        // one bar per row; each piece's width is its share of the row's total. parOf(i) is the group piece i is drawn in
        const bar = (parOf, vals, x0, w, y, bh) => { const sum = vals.reduce((a, b) => a + b, 0) || 1; let x = x0; return vals.map((v, i) => {
          const ww = Math.max(0, w * v / sum), r = { x, w: ww, cx: x + ww / 2, v, share: v / sum };
          if (ww > 0.5) { const xx = x + (i ? 2 : 0), w2 = Math.max(1, ww - (i ? 2 : 0) - (i < vals.length - 1 ? 2 : 0));
            L.svgEl('rect', { x: xx, y, width: w2, height: bh, fill: fillOf(items[i] || {}, i) }, parOf(i)); }
          x += ww; return r; }); };
        if (!multi) {
          const vals = items.map(it => val(it.value)), sum = vals.reduce((a, b) => a + b, 0);
          const tot = p.total ? (p.total.value != null ? val(p.total.value) : sum) : null;
          const bh = Math.min(112, H * .26), topH = tot != null ? 92 : 0, labH = 76, y0 = Math.max(0, (H - (topH + bh + 26 + labH)) / 2) + topH;
          const last = p.build ? items.length : 0;
          if (tot != null) { const gt = g(last); const t = L.svgEl('text', { class: 'pt', x: W / 2, y: y0 - 50, 'text-anchor': 'middle' }, gt);
            t.innerHTML = `<tspan class="pk">${L.esc(L.plain(p.total.label || 'total', ctx.scope))}  </tspan><tspan class="pv">${L.esc(fmt(tot))}</tspan>`;
            L.svgEl('path', { d: `M2,${y0 - 14}V${y0 - 26}H${W - 2}V${y0 - 14}M${W / 2},${y0 - 26}V${y0 - 34}`, class: 'lead-line', fill: 'none' }, gt); }
          const gs = items.map((_, i) => g(p.build ? i + 1 : 0)), segs = bar(i => gs[i], vals, 0, W, y0, bh); segs.forEach((sg, i) => sg.g = gs[i]);
          // labels under their piece; a narrow piece's label slides along and keeps a leader to it
          const lab = items.map((it, i) => { const a = p.share ? L.fmt(vals[i] / (sum || 1) * 100, 0) + '%' : fmt(vals[i]), b = L.plain(it.label || '', ctx.scope);
            return { a, b, w: Math.max(L.measure(a, 30, 700), L.measure(b, 24, 560)) + 18, x: segs[i].cx }; });
          for (let i = 1; i < lab.length; i++) lab[i].x = Math.max(lab[i].x, lab[i - 1].x + (lab[i - 1].w + lab[i].w) / 2);
          for (let i = lab.length - 1; i >= 0; i--) lab[i].x = Math.min(lab[i].x, i < lab.length - 1 ? lab[i + 1].x - (lab[i + 1].w + lab[i].w) / 2 : W - lab[i].w / 2);
          lab.forEach((l, i) => { l.x = Math.max(l.w / 2, l.x); const gi = segs[i].g, yb = y0 + bh;
            if (Math.abs(l.x - segs[i].cx) > 6) L.svgEl('path', { d: `M${segs[i].cx},${yb + 4}L${l.x},${yb + 18}`, class: 'lead-line', fill: 'none' }, gi);
            text(gi, 'pv', l.x, yb + 52, l.a); text(gi, 'pk', l.x, yb + 84, l.b); });
        } else {
          const n = p.rows.length, legH = 54, rowH = Math.min(96, (H - legH) / n), bh = rowH * .58;
          const lw = Math.max(...p.rows.map(r => L.measure(L.plain(r.label || '', ctx.scope), 24, 640))) + 26, endW = p.share ? 96 : 120, bw = Math.max(40, W - lw - endW);
          const fi = Math.max(0, items.findIndex(it => it.focus));
          let lx = 0; items.forEach((it, i) => { L.svgEl('rect', { x: lx, y: 10, width: 22, height: 22, fill: fillOf(it, i) }, svg); const t = text(svg, 'pk', lx + 32, 29, L.plain(it.label || '', ctx.scope), 'start'); lx += 32 + L.measure(t.textContent, 24, 560) + 34; });
          const y0 = legH + Math.max(0, (H - legH - n * rowH) / 2);
          p.rows.forEach((r, j) => { const gj = g(p.build ? j + 1 : 0), y = y0 + j * rowH + (rowH - bh) / 2, vals = (r.values || []).map(val);
            text(gj, 'pr', 0, y + bh / 2 + 9, L.plain(r.label || '', ctx.scope), 'start');
            const sg = bar(() => gj, vals, lw, bw, y, bh), sum = vals.reduce((a, b) => a + b, 0);
            text(gj, 'pt', lw + bw + 14, y + bh / 2 + 9, p.share ? L.fmt(sg[fi].share * 100, 0) + '%' : fmt(sum), 'start'); });
        }
        R.show(ctx.k);
      };
      R.show = k => svg.querySelectorAll('[data-pstep]').forEach(e => e.classList.toggle('off', +e.dataset.pstep > k));
      R.audit = () => (!multi && items.some(it => it.value == null)) ? ['every part needs a `value`'] : [];
    } else if (v.flow) {
      const f = v.flow, box = h('div', 'flow'); vis.appendChild(box); vis.classList.remove('plate');
      const nodes = (f.nodes || []).map((n, i) => { const o = typeof n === 'string' ? { label: n } : n; const e = h('div', 'node g thin' + (f.focus === i ? ' focus' : ''), `<div class="nl">${md(o.label)}</div>${o.sub ? `<div class="ns">${md(o.sub)}</div>` : ''}`);
        if (f.build) e.dataset.step = i + 1; box.appendChild(e); return e; });
      if (f.build) R.steps = nodes.length;
      const svg = L.svgEl('svg', {}); box.prepend(svg);
      R.layout = () => {
        const W = box.clientWidth, H = box.clientHeight, n = nodes.length; if (!n || !W) return;
        const port = document.body.classList.contains('port'), dir = f.dir || (port ? 'col' : 'row');
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = '';
        const vw = Math.max(0, ...(f.verbs || []).map(t => L.measure(L.plain(t, ctx.scope), 22, 500)));
        const gap = dir === 'row' ? Math.max(Math.min(150, W * .08), Math.min(W * .2, vw + 34)) : Math.min(70, H * .08);
        const nw = dir === 'row' ? (W - gap * (n - 1)) / n : Math.min(W * .78, 560), nh = dir === 'row' ? Math.min(H * .62, 220) : (H - gap * (n - 1)) / n;
        nodes.forEach((e, i) => { const x = dir === 'row' ? i * (nw + gap) : (W - nw) / 2, y = dir === 'row' ? (H - nh) / 2 : i * (nh + gap);
          Object.assign(e.style, { left: x + 'px', top: y + 'px', width: nw + 'px', height: nh + 'px' });
          if (i) { const x1 = dir === 'row' ? x - gap + 8 : W / 2, y1 = dir === 'row' ? y + nh / 2 : y - gap + 8, x2 = dir === 'row' ? x - 10 : W / 2, y2 = dir === 'row' ? y + nh / 2 : y - 10;
            const g = L.svgEl('g', { 'data-fstep': f.build ? i + 1 : 0 }, svg);
            L.svgEl('path', { d: `M${x1},${y1}L${x2},${y2}`, class: 'edge' }, g);
            const a = dir === 'row' ? 0 : Math.PI / 2; L.svgEl('path', { d: `M${x2},${y2}l${-12 * Math.cos(a - .5)},${-12 * Math.sin(a - .5)}M${x2},${y2}l${-12 * Math.cos(a + .5)},${-12 * Math.sin(a + .5)}`, class: 'edge' }, g);
            const verb = (f.verbs || [])[i - 1]; if (verb) { const t = L.svgEl('text', { class: 'verb', x: dir === 'row' ? (x1 + x2) / 2 : W / 2 + 18, y: dir === 'row' ? y1 - 16 : (y1 + y2) / 2 + 7, 'text-anchor': dir === 'row' ? 'middle' : 'start' }, g); t.textContent = L.plain(verb, ctx.scope); } } });
        R.show(ctx.k);
      };
      R.show = k => { svg.querySelectorAll('[data-fstep]').forEach(g => { g.style.opacity = +g.dataset.fstep <= k ? 1 : 0; g.style.transition = 'opacity .5s'; }); };
    } else if (v.code) {
      vis.classList.remove('plate'); vis.classList.add('vis-code'); const pre = h('div', 'codebox', codeHTML(v.code, v.terms)); vis.appendChild(pre);
      R.layout = () => fitCode(pre);
    } else if (v.image) {
      const box = h('div', 'imgbox'); const img = h('img'); img.src = (window.VIZOS_ASSETS || {})[v.image] || v.image; img.alt = v.alt || ''; box.appendChild(img); vis.appendChild(box);
      // the picture carries no words: labels sit on it at fractions of its width and height, optionally one per step
      const labs = (v.labels || []).map(lb => { const e = h('div', 'il', md(lb.text)); if (lb.step) e.dataset.step = lb.step; box.appendChild(e); return { lb, e }; });
      if (labs.length) {
        R.steps = Math.max(0, ...labs.map(x => x.lb.step || 0));
        const place = () => { const b = box.getBoundingClientRect(), r = img.getBoundingClientRect(), sc = b.width / (box.offsetWidth || 1) || 1; if (!r.width) return;
          labs.forEach(({ lb, e }) => { const [fx, fy] = lb.at || [.5, .5]; e.style.left = ((r.left - b.left) / sc + fx * r.width / sc) + 'px'; e.style.top = ((r.top - b.top) / sc + fy * r.height / sc) + 'px'; }); };
        R.layout = place; img.addEventListener('load', () => requestAnimationFrame(place));
        R.show = k => labs.forEach(({ lb, e }) => e.classList.toggle('now', lb.step === k));
      }
    } else if (v.dist) {
      const where = `slide ${ctx.index + 1} dist`; let D;
      try { D = distSpec(v.dist, ctx.scope, where); } catch (e) { L.err(where, e.message); D = null; }
      if (D) {
        // the chart, and beside it the family card: its name, each parameter with its meaning and live value (or its slider), then mean and variance
        vis.classList.add('vis-dist'); const row = h('div', 'distrow'), col = h('div', 'distchart'); row.appendChild(col); vis.appendChild(row);
        const C = L.chart(col, D.spec, () => ctx.scope, { vis });
        const d = v.dist, says = d.says || {}, card = h('div', 'famcard');
        const val = x => `<span class="pv2 iv" data-x="${L.esc(String(x))}"></span>`;
        const eq = (key, tex, x, cls = '') => `<div class="mrow${cls}"><span class="mk">${key}</span><span class="tx" data-tex="${L.esc(tex)}"></span><span class="eqs">=</span>${val(x)}</div>`;
        const tail = d.tail && D.A.cdf ? (d.tail.below != null ? D.A.cdf.replace(/\bx\b/g, `(${d.tail.below})`) : `1 - ${D.A.cdf.replace(/\bx\b/g, `((${d.tail.above}) - ${D.A.F.disc ? 1 : 0})`)}`) : null;
        card.innerHTML = `<div class="fn">${L.esc(d.label || D.A.F.name)}</div>` +
          D.A.F.p.map(k => `<div class="prow" data-px="${L.esc(String(d.params[k]).trim())}"><div class="pl"><span class="ps tx" data-tex="${L.esc(PSYM[k] || k)}"></span>${says[k] ? `<span class="pw">${md(says[k])}</span>` : ''}${val(d.params[k])}</div></div>`).join('') +
          `<div class="msep"></div>` + eq('mean', D.A.F.mt, D.A.mean) + eq('variance', D.A.F.vt, D.A.var) +
          (D.B ? eq(`${L.esc(d.vs.label || D.B.F.name)} variance`, D.B.F.vt, D.B.var, ' vs') : '') +
          (tail ? `<div class="mrow tl"><span class="mk">${L.esc(d.tail.label || 'tail')}</span><span class="eqs">=</span>${val(tail)}</div>` : '');
        row.appendChild(card);
        // a slider that sets one parameter moves into that parameter's row
        R.adopt = box => { box.querySelectorAll('.ctl').forEach(c => { const r = [...card.querySelectorAll('.prow')].find(p => p.dataset.px === c.dataset.name); if (r) { c.classList.remove('g', 'pill', 'thin'); r.appendChild(c); } }); if (!box.children.length) box.remove(); };
        R.steps = C.steps; R.layout = () => C.render(); R.show = k => C.setStep(k); R.audit = () => C.audit(); ctx.charts.push(C);
      }
    } else if (v.eqn) {
      const box = h('div', 'eqmain'); vis.appendChild(box); const tex = v.eqn;
      R.layout = () => { L.renderTex(box, L.interp(tex, ctx.scope, true), true); fitEq(box); };
    } else if (v.svg) {
      const box = h('div', 'imgbox'); box.innerHTML = v.svg; vis.appendChild(box);
    } else L.err(`slide ${ctx.index + 1}`, `visual needs one of chart, dist, stat, units, parts, flow, code, image, eqn, svg`);
    const tg = (v.chart || v.dist) && ctx.charts.length && ctx.charts[ctx.charts.length - 1].toggle;
    // a dist's caption sits under its chart, so the family card beside it can use the plate's full height
    if (v.caption || tg) { const f = h('div', 'vfoot'); if (v.caption) f.appendChild(h('div', 'cap', md(v.caption))); if (tg) f.appendChild(tg); (vis.querySelector('.distchart') || vis).appendChild(f); }
    return R;
  };

  function codeHTML(code, termColors) {
    const kw = /\b(def|return|import|from|for|in|if|else|lambda|np|import|as|print|None|True|False)\b/g;
    return L.esc(code).split('\n').map(line => {
      const ci = line.indexOf('#'); const body = ci >= 0 ? line.slice(0, ci) : line, comment = ci >= 0 ? line.slice(ci) : '';
      let b = body.replace(/\b(\d+\.?\d*(?:e-?\d+)?)\b/g, '<span class="cn">$1</span>').replace(kw, '<span class="ck">$1</span>');
      if (termColors) for (const [name, c] of Object.entries(termColors)) b = b.replace(new RegExp(`(?<![\\w.])${name}(?![\\w(])`, 'g'), `<span class="tu" style="--tc:${L.colors[c] || c}">${name}</span>`);
      return b + (comment ? `<span class="cc">${comment}</span>` : '');
    }).join('\n');
  }
  // shrink a display formula until it fits its box
  function fitEq(box) {
    const k = box.querySelector('.katex-display > .katex, .katex'); if (!k) return;
    box.style.fontSize = ''; let fs = parseFloat(getComputedStyle(box).fontSize), guard = 0;
    while (k.scrollWidth > box.clientWidth - 8 && fs > 26 && guard++ < 30) { fs -= 3; box.style.fontSize = fs + 'px'; }
  }
  L.fitEq = fitEq;
  // shrink code until its longest line fits; below 20px it wraps instead, so it stays readable on a phone
  function fitCode(box) {
    box.style.fontSize = ''; box.style.whiteSpace = ''; let fs = parseFloat(getComputedStyle(box).fontSize), guard = 0;
    while (box.scrollWidth > box.clientWidth + 1 && fs > 20 && guard++ < 30) { fs -= 1; box.style.fontSize = fs + 'px'; }
    if (box.scrollWidth > box.clientWidth + 1) { box.style.whiteSpace = 'pre-wrap'; box.style.overflowWrap = 'anywhere'; }
  }

  // underline overlays under \htmlClass{lt lt-<id>} spans (terms) inside a container
  function overlays(container, colorOf, cls = 'lt', halos = true) {
    container.querySelectorAll('.ul,.halo').forEach(e => e.remove());
    const base = container.getBoundingClientRect(), sc = base.width / (container.offsetWidth || 1) || L.scale || 1, out = [];
    container.querySelectorAll(`.${cls}`).forEach(sp => {
      const id = [...sp.classList].find(c => c.startsWith(cls + '-'))?.slice(cls.length + 1); if (!id) return;
      const r = sp.getBoundingClientRect(); if (!r.width) return;
      const x = (r.left - base.left) / sc, y = (r.bottom - base.top) / sc, w = r.width / sc, hh = r.height / sc;
      const ul = h('div', 'ul'); Object.assign(ul.style, { left: x + 'px', top: (y + 6) + 'px', width: w + 'px', '--tc': colorOf(id) }); ul.style.setProperty('--tc', colorOf(id)); ul.dataset.term = id;
      const halo = h('div', 'halo off'); Object.assign(halo.style, { left: (x - 10) + 'px', top: (y - hh - 6) + 'px', width: (w + 20) + 'px', height: (hh + 12) + 'px' }); halo.style.setProperty('--tc', colorOf(id)); halo.dataset.term = id;
      if (halos) container.append(halo); container.append(ul); out.push(ul);
    });
    return out;
  }
  // small labels under substituted numbers (\htmlClass{op op-i}{...}) so no number is anonymous.
  // They sit under the whole formula (never inside a fraction), wrap when long, and stay inside their card.
  function opLabels(container, names) {
    container.querySelectorAll('.oplab').forEach(e => e.remove());
    container.style.paddingBottom = '';
    const base = container.getBoundingClientRect(), sc = base.width / (container.offsetWidth || 1) || L.scale || 1;
    const row = container.closest('.math') || container;   // labels go under the tallest piece of the whole row
    // an inline .katex box is only a line tall; its .base boxes carry the real height of fractions and roots
    // (only pieces on the container's own line: when a row wraps, the next line's pieces come after the labels)
    const cr = container.getBoundingClientRect();
    const kb = [...row.querySelectorAll('.katex .base, .katex')].map(k => k.getBoundingClientRect()).filter(b => b.top < cr.bottom - 1 && b.bottom > cr.top + 1)
      .reduce((a, b) => (b.bottom > a.bottom ? b : a), (container.querySelector('.katex') || container).getBoundingClientRect());
    const card = container.closest('.calc, .recipe, .eqwrap, .g') || container, cb = card.getBoundingClientRect();
    const lo = (cb.left - base.left) / sc + 14, hi = (cb.right - base.left) / sc - 14;
    const top0 = (kb.bottom - base.top) / sc + 8, rows = [];
    container.querySelectorAll('.op').forEach(sp => {
      const i = +([...sp.classList].find(c => /^op-\d+$/.test(c)) || 'op-0').slice(3), name = names[i]; if (!name) return;
      const r = sp.getBoundingClientRect(); if (!r.width) return;
      const lab = h('div', 'oplab', L.esc(name)); container.appendChild(lab);
      const w = lab.offsetWidth, hh = lab.offsetHeight;
      let cx = (r.left + r.width / 2 - base.left) / sc;
      cx = Math.max(lo + w / 2, Math.min(hi - w / 2, cx));
      let row = 0; while (rows.some(b => b.row === row && Math.abs(b.cx - cx) < (b.w + w) / 2 + 12) && row < 4) row++;
      const y = top0 + rows.filter(b => b.row < row).reduce((m, b) => Math.max(m, b.bottom - top0), 0) + (row ? 6 : 0);
      rows.push({ cx, w, row, bottom: y + hh });
      lab.style.left = cx + 'px'; lab.style.top = y + 'px';
    });
    // reserve room under the content itself; CSS padding already there counts toward it
    const pad0 = parseFloat(getComputedStyle(container).paddingBottom) || 0;
    const need = rows.length ? Math.max(...rows.map(b => b.bottom)) - (container.offsetHeight - pad0) + 8 : 0;
    if (need > pad0) container.style.paddingBottom = need + 'px';
  }

  // the name of each term, on the formula itself: the formula is the figure, so its labels sit on it.
  // Terms in the top half of the formula (numerators, powers) are named above it, the rest below, so a fraction's
  // labels never stack on one leader. A label may slide sideways as long as its leader still lands inside it;
  // only then does it drop a row, and a label already placed slides aside so a deeper leader never cuts through it.
  function termLabels(container, items) {
    container.querySelectorAll('.tlab').forEach(e => e.remove());
    container.style.paddingTop = container.style.paddingBottom = '';
    const sc = () => container.getBoundingClientRect().width / (container.offsetWidth || 1) || L.scale || 1, W = container.offsetWidth;
    const bases = () => [...container.querySelectorAll('.katex .base')].map(e => e.getBoundingClientRect()).filter(r => r.height);
    const kb = bases(); if (!kb.length) return;
    const base0 = container.getBoundingClientRect(), s0 = sc(), top = Math.min(...kb.map(r => r.top)), bot = Math.max(...kb.map(r => r.bottom));
    // a label that wraps keeps its box at the full max-width; shrink it to its longest line so neighbours fit
    const tight = lab => { const rg = document.createRange(); rg.selectNodeContents(lab.lastChild); const lines = [...rg.getClientRects()];
      if (lines.length > 1) lab.style.width = Math.ceil((Math.max(...lines.map(q => q.right)) - Math.min(...lines.map(q => q.left))) / s0) + 2 + 'px'; };
    // the formula's axis is the middle of its = sign; terms clearly above it (numerators, powers) are named above
    const rel = container.querySelector('.katex .mrel'), rr = rel && rel.getBoundingClientRect(), mid = rr && rr.height ? (rr.top + rr.bottom) / 2 : (top + bot) / 2;
    const labs = items.map(it => {
      const sp = container.querySelector(`.lt-${CSS.escape(it.id)}`); if (!sp || !it.text) return null;
      const r = sp.getBoundingClientRect(); if (!r.width) return null;
      const lab = h('div', 'tlab', `<span class="lk"></span>${L.esc(it.text)}`); lab.dataset.term = it.id; container.appendChild(lab);
      tight(lab);
      return { lab, tx: (r.left + r.width / 2 - base0.left) / s0, w: lab.offsetWidth, hh: lab.offsetHeight, up: (r.top + r.bottom) / 2 < mid - 8 && bot - top > 40 };
    }).filter(Boolean);
    const M = 12, GAP = 16; let crowded = false;
    const place = list => {
      const P = [], x0 = p => p.cx - p.l.w / 2, x1 = p => p.cx + p.l.w / 2;
      const lo = l => Math.max(l.w / 2, l.tx - (l.w / 2 - M)), hi = l => Math.min(W - l.w / 2, l.tx + (l.w / 2 - M));
      // move p left until its right edge is at most `right`, pushing its left-hand neighbours along; each keeps its leader
      // inside it, and none may come to cover a deeper label's leader. Fills `moves` and says whether it can be done.
      const at = (q, moves) => moves.has(q) ? moves.get(q) : q.cx;
      const pushLeft = (p, right, moves) => {
        const nx = Math.min(at(p, moves), right - p.l.w / 2); if (nx < lo(p.l) - .5) return false;
        if (P.some(q => q.row > p.row && q.l.tx > nx - p.l.w / 2 - 4 && q.l.tx < nx + p.l.w / 2 + 4)) return false;
        moves.set(p, nx);
        const q = P.filter(q => q !== p && q.row === p.row && q.cx < p.cx).sort((u, v) => v.cx - u.cx)[0];
        return !q || at(q, moves) + q.l.w / 2 + GAP <= nx - p.l.w / 2 || pushLeft(q, nx - p.l.w / 2 - GAP, moves);
      };
      [...list].sort((a, b) => a.tx - b.tx).forEach(l => {
        for (let row = 0; row < 4; row++) {
          let cx = Math.max(lo(l), Math.min(hi(l), l.tx));
          P.filter(q => q.row === row).forEach(q => { if (x1(q) + GAP > cx - l.w / 2) cx = Math.max(cx, x1(q) + GAP + l.w / 2); });
          P.filter(q => q.row > row).forEach(q => { if (q.l.tx > cx - l.w / 2 - 4 && q.l.tx < cx + l.w / 2 + 4) cx = Math.max(cx, q.l.tx + 4 + l.w / 2); });
          const moves = new Map();
          if (cx > hi(l) + .5) {   // no room on the right: push the labels in this row to the left, if they can go
            const q = P.filter(q => q.row === row).sort((a, b) => b.cx - a.cx)[0];
            if (!q || !pushLeft(q, hi(l) - l.w / 2 - GAP, moves)) continue;
            cx = hi(l);
          }
          // this leader must not cut through a label nearer the formula: push that one (and its neighbours) left
          const blockers = P.filter(q => q.row < row && l.tx > x0(q) - 4 && l.tx < x1(q) + 4);
          if (!blockers.every(q => pushLeft(q, l.tx - 4, moves))) continue;
          moves.forEach((nx, q) => { q.cx = nx; }); P.push({ l, row, cx }); return;
        }
        // nowhere clean (its leader would cross a label): at least keep it off the other labels; the audit says so
        crowded = true; const cx = Math.max(lo(l), Math.min(hi(l), l.tx));
        P.push({ l, cx, row: [0, 1, 2, 3].find(r => P.every(q => q.row !== r || x1(q) + GAP <= cx - l.w / 2 || x0(q) - GAP >= cx + l.w / 2)) ?? 3 });
      });
      return P;
    };
    let below = place(labs.filter(l => !l.up)), above = place(labs.filter(l => l.up));
    // still crowded: put each label of two or more words on two lines, which makes it about half as wide, and try again
    const wide = labs.filter(l => !l.lab.style.width && /\S\s+\S/.test(l.lab.lastChild.textContent));
    if (crowded && wide.length) {
      wide.forEach(l => { l.lab.style.width = Math.ceil(l.w * .6) + 'px'; tight(l.lab); l.w = l.lab.offsetWidth; l.hh = l.lab.offsetHeight; });
      crowded = false; below = place(labs.filter(l => !l.up)); above = place(labs.filter(l => l.up));
    }
    const RH = Math.max(0, ...labs.map(l => l.hh)) + 10, nb = below.length ? Math.max(...below.map(p => p.row)) + 1 : 0, na = above.length ? Math.max(...above.map(p => p.row)) + 1 : 0;
    // room above the formula for the labels that go there; then measure again, since the formula moved down
    if (na) container.style.paddingTop = (na * RH + 14) + 'px';
    // clear of the formula and of the underlines that go 6px under each term (6px tall)
    const base = container.getBoundingClientRect(), s1 = sc(), kb2 = bases(), terms = [...container.querySelectorAll('.lt')].map(e => e.getBoundingClientRect()).filter(r => r.height);
    const topA = (Math.min(...kb2.map(r => r.top), ...terms.map(r => r.top)) - base.top) / s1 - 10;
    const top0 = (Math.max(...kb2.map(r => r.bottom), ...terms.map(r => r.bottom + 12 * s1)) - base.top) / s1 + 14;
    const put = (p, up) => { const l = p.l, y = up ? topA - (p.row + 1) * RH + 10 : top0 + p.row * RH, lk = l.lab.querySelector('.lk');
      Object.assign(l.lab.style, { left: p.cx + 'px', top: y + 'px' }); if (up) l.lab.classList.add('up');
      lk.style.left = (l.tx - (p.cx - l.w / 2) - 1) + 'px'; lk.style.height = Math.max(0, up ? topA + 6 - (y + l.hh) : y - top0 + 14) + 'px';
      return y + l.hh; };
    const lowest = Math.max(0, ...below.map(p => put(p, false))); above.forEach(p => put(p, true));
    const need = nb ? lowest - container.offsetHeight + 6 : 0;
    if (need > 0) container.style.paddingBottom = need + 'px';
    container.dataset.crowded = crowded ? 1 : '';
  }

  // ---------- slide types ----------
  const T = {};
  L.types = T;

  T.title = (s, ctx) => {
    const d = ctx.deck, node = h('section', 'slide s-title');
    const kicker = s.kicker || d.kicker; if (kicker) node.appendChild(h('div', 'kicker enter', md(kicker)));
    node.appendChild(h('div', 'display enter', md(s.title || d.title)));
    if (s.subtitle || d.subtitle) node.appendChild(h('div', 'subtitle enter', md(s.subtitle || d.subtitle)));
    const q = s.question || d.question; if (q) node.appendChild(h('div', 'question g enter', `<div class="qmark">?</div><div class="qt">${md(q)}</div>`));
    const chs = L.chapters || []; if (chs.length > 1 && s.chips !== false) { const c = h('div', 'pipe enter');
      c.innerHTML = chs.map((x, i) => `<span class="pp"><b><i>${i + 1}</i>${L.esc(x)}</b>${L.chapterShape[x] ? `<span>${L.esc(L.chapterShape[x])}</span>` : ''}</span>`).join('<span class="pa">→</span>'); node.appendChild(c); }
    return { node, steps: 0 };
  };

  T.chapter = (s, ctx) => {
    const node = h('section', 'slide s-statement s-chapter');
    const n = (L.chapters || []).indexOf(s.title) + 1;
    const g = h('div', 'g enter');
    const out = L.chapterShape[s.title], inn = n > 1 ? L.chapterShape[L.chapters[n - 2]] : null;
    const flow = out ? `<div class="flowline">${inn ? `<span class="shape"><span class="sx">in</span> ${L.esc(inn)}</span><span class="arr">→</span>` : ''}<span class="shape out"><span class="sx">out</span> ${L.esc(out)}</span></div>` : '';
    g.innerHTML = `<div class="eyebrow" style="margin-bottom:22px">${n ? `Part ${n} of ${L.chapters.length}` : 'Next part'}</div><div class="big">${md(s.title)}</div>${s.q ? `<div class="sub">${md(s.q)}</div>` : ''}${flow}`;
    node.appendChild(g); return { node, steps: 0 };
  };

  T.statement = (s) => {
    const node = h('section', 'slide s-statement');
    if (s.lead) node.appendChild(h('div', 'lead enter', md(s.lead).replace(LEADW, '<span class="lw">$1</span>')));
    const g = h('div', 'g enter'); g.innerHTML = `<div class="big">${md(s.text || s.title)}</div>${s.sub ? `<div class="sub">${md(s.sub)}</div>` : ''}`;
    node.appendChild(g); return { node, steps: 0 };
  };

  T.idea = (s, ctx) => {
    const node = h('section', 'slide s-idea'); node.appendChild(head(s));
    const v = s.visual ? L.visual(s.visual, ctx) : null, pts = s.points || [];
    const layout = s.layout || (v && pts.length > 1 ? 'split' : v ? 'wide' : 'text-only');   // one point: above a full-width visual
    const body = h('div', 'body ' + layout + (s.layout === 'vis-left' ? ' split vis-left' : '')); node.appendChild(body);
    let nPts = 0;
    if (pts.length || s.text) {
      const col = h('div', 'col-text enter');
      const card = layout === 'text-only' ? h('div', 'g textcard') : col;
      if (s.text) card.appendChild(h('div', 'p', md(s.text)));
      if (pts.length) { card.appendChild(points(pts, 1, s.build !== false)); nPts = s.build !== false ? pts.length : 0; }
      if (layout === 'text-only') { col.appendChild(card); }
      body.appendChild(col);
    }
    if (v) { const cv = h('div', 'col-vis'); cv.appendChild(v.node); body.appendChild(cv); }
    const ctl = (s.controls || (s.visual && s.visual.chart && s.visual.chart.controls)); if (ctl && v) { const hd = v.node.querySelector('.vhead'); let f = hd || v.node.querySelector('.vfoot'); if (!f) { f = h('div', 'vfoot'); v.node.appendChild(f); } const c = controls(ctl, ctx); if (hd) hd.appendChild(c); else f.appendChild(c); v.adopt && v.adopt(c); }
    return { node, steps: Math.max(nPts, v ? v.steps : 0), show: k => { node.querySelectorAll('.pts li').forEach((li, i) => li.classList.toggle('now', i + 1 === k)); v && v.show(k); }, layout: () => v && v.layout(), audit: () => v ? v.audit() : [] };
  };

  T.predict = (s, ctx) => {
    const node = h('section', 'slide s-predict');
    const eyebrow = s.eyebrow || (s.kind === 'check' ? 'Check yourself' : 'Guess first');
    node.appendChild(head({ ...s, title: s.q || s.title }, eyebrow));
    const body = h('div', 'predict enter'); node.appendChild(body);
    const opts = h('div', 'opts'); body.appendChild(opts);
    const right = h('div', 'col'); body.appendChild(right);
    const why = h('div', 'why g warm'); why.innerHTML = `<div class="eyebrow">${s.answer != null ? 'Why' : 'What happens'}</div><div class="p">${md(s.why || '')}</div>`;
    const hint = h('div', 'hint', 'Pick one before you read on.');
    right.append(hint, why);
    if (s.visual) { const v = L.visual(s.visual, ctx); v.node.style.marginTop = '22px'; v.node.style.minHeight = '260px'; why.appendChild(v.node); ctx.later.push(v); }
    const L8 = 'ABCDEFGH';
    const btns = (s.options || []).map((o, i) => { const b = h('button', 'opt g thin', `<span class="ol">${L8[i]}</span><span>${md(o)}</span><span class="om"></span>`); opts.appendChild(b); return b; });
    const choose = i => { if (body.dataset.done) return; body.dataset.done = 1;
      btns.forEach((b, j) => { b.disabled = true; if (j === s.answer) { b.classList.add('right'); b.querySelector('.om').textContent = '✓'; } });
      if (s.answer != null && i !== s.answer) { btns[i].classList.add('wrong'); btns[i].querySelector('.om').textContent = '✗'; }
      why.classList.add('open'); hint.style.display = 'none'; ctx.later.forEach(v => v.layout()); L.refit && L.refit(); };
    btns.forEach((b, i) => b.addEventListener('click', e => { e.stopPropagation(); choose(i); }));
    ctx.keys = e => { const i = '1234abcd'.indexOf(e.key.toLowerCase()) % 4; if (i >= 0 && i < btns.length) { choose(i); return true; } };
    ctx.reveal = () => choose(s.answer ?? 0);
    return { node, steps: 0, layout: () => ctx.later.forEach(v => why.classList.contains('open') && v.layout()) };
  };

  T.equation = (s, ctx) => {
    const node = h('section', 'slide s-equation'); node.appendChild(head(s));
    const wrap = h('div', 'eqwrap g plate enter'); node.appendChild(wrap);
    // a term's meaning: equation `terms` override deck `symbols`
    const T0 = s.terms || {}, term = n => ({ ...((ctx.symbols || {})[n] || {}), ...(T0[n] || {}) });
    ctx.terms = Object.fromEntries(Object.keys({ ...(ctx.symbols || {}), ...T0 }).map(n => [n, term(n)]));
    const sym = n => term(n).tex || L.autoSym(n);
    const wrapT = (n, tex) => `\\htmlClass{lt lt-${n}}{${tex}}`;
    const computable = !!s.expr;
    let main = '', ids = [];
    if (computable) {
      ids = L.names(s.expr);
      const rhs = L.tex(s.expr, { sym, wrap: (n, t) => wrapT(n, t) });
      main = s.lhs ? `${wrapT(s.lhs, sym(s.lhs))} = ${rhs}` : rhs;
    } else if (s.tex) {
      main = String(s.tex).replace(/\[([A-Za-z_][\w]*)\]/g, (_, n) => { if (!ids.includes(n)) ids.push(n); return wrapT(n, sym(n)); });
    } else L.err(`slide ${ctx.index + 1}`, 'equation needs expr or tex');
    const inputs = (s.order || ids).filter(n => n !== s.lhs);
    const order = s.lhs ? [s.lhs, ...inputs] : inputs;   // reading order: the result, then its parts
    const colorOf = n => n === s.lhs ? L.colors.accent : L.colors[TERMC[Math.min(Math.max(0, inputs.indexOf(n)), 3)]] || L.colors.mist;
    // the numbers a computable equation runs on: a term's `value`, else the name in scope
    const eqScope = () => { const sc = L.scope(ctx.scope, {}); inputs.forEach(n => { const t = term(n); if (t.value != null) sc[n] = L.val(t.value, ctx.scope, `term ${n}`); }); return sc; };
    // where the formula comes from: a form the learner already knows, and the one move that turns it into this one;
    // a chain of two or three such links sketches a derivation without doing all of it (story.md §7)
    const chain = s.from ? (Array.isArray(s.from) ? s.from : [s.from]) : [];
    const chip = (c, cls) => `<div class="${cls} g thin">${c.where || c.name ? `<span class="lg-name">${md([c.where, c.name].filter(Boolean).join(' · '))}</span>` : ''}${c.tex ? `<span class="lg-tex" data-tex="${L.esc(c.tex)}"></span>` : ''}</div>`;
    // one band across the top, like a family tree: the parent form on the left, relatives in other topics on the right
    const fam = (chain.length || (s.kin && s.kin.length)) ? h('div', 'family') : null; if (fam) { wrap.appendChild(fam); wrap.classList.add('has-fam'); }
    if (chain.length) fam.appendChild(h('div', 'lineage', `<div class="lg-tag">Comes from</div>` + chain.map(c => chip(c, 'lg-chip') + (c.move ? `<div class="lg-move"><span class="lg-arr"></span><span class="lg-verb">${md(c.move)}</span></div>` : '')).join('')));
    const eqb = h('div', 'eqbody'); wrap.appendChild(eqb);   // the formula, its numbers and its note; the family sits beside or above
    const eq = h('div', 'eqmain'); eqb.appendChild(eq);
    // step 1 is the bare formula; then each term gets its name (one per step, or all at once when there are many)
    const build = s.build ?? order.length <= 4, termSteps = {};
    let step = 1; order.forEach(n => { termSteps[n] = build ? ++step : 2; }); if (!build && order.length) step = 2;
    let numRow = null;
    if (s.plug !== false && (computable || s.plug)) { numRow = h('div', 'eqnum'); numRow.dataset.step = ++step; numRow.innerHTML = `<span class="tag">With our numbers</span><span class="val"></span>`; eqb.appendChild(numRow); }
    if (s.note) { const r = h('div', 'eqso'); r.dataset.step = ++step; r.innerHTML = md(s.note); eqb.appendChild(r); }
    if (s.hook) { const r = h('div', 'hook', `<span class="wtag">Remember</span><span>${md(s.hook)}</span>`); r.dataset.step = ++step; eqb.appendChild(r); }
    const nt = notationEl([main], s); if (nt) eqb.appendChild(nt);
    // the same shape in other topics: this formula is one more member of a family the learner may know
    if (s.kin && s.kin.length) { const k = h('div', 'kin', `<div class="lg-tag">Same shape</div>` + s.kin.map(c => chip(c, 'kin-chip')).join('')); k.dataset.step = ++step; fam.appendChild(k); }
    // said aloud, and in code: one tap away in the more sheet, so the face stays the formula and its names
    const tc = {}; order.forEach(n => tc[n] = colorOf(n));
    const more = (s.read ? `<div class="eyebrow">Say it</div><div class="p say">“${md(s.read)}”</div>` : '') + (s.code ? `<div class="eyebrow">In code</div><div class="codebox">${codeHTML(s.code, tc)}</div>` : '');
    const draw = () => {
      wrap.querySelectorAll('.lg-tex').forEach(e => L.renderTex(e, L.interp(e.dataset.tex, ctx.scope, true).replace(/\\dfrac/g, '\\tfrac'), false));   // one line tall in a chip
      L.renderTex(eq, L.interp(main, ctx.scope, true), true); fitEq(eq);
      const sc = computable ? eqScope() : ctx.scope;
      let result = null;
      if (computable) { result = L.try(s.expr, sc, `slide ${ctx.index + 1} equation`); if (s.lhs && s.store !== false) { ctx.scope[s.lhs] = result; sc[s.lhs] = result; } }
      if (numRow) {
        const v = numRow.querySelector('.val');
        if (computable) {
          const { tex: sub, eq } = L.work(s.expr, { slash: true, val: n => typeof sc[n] === 'number' ? sc[n] : null, wrap: (n, t) => wrapT(n, t), fmt: s.fmt, lit: null, fmtOf: (n, x) => subFmt(ctx, n, x, ((s.terms || {})[n] || {}).fmt) }, result, s.fmt, sc);
          L.renderTex(v, `${sub} ${eq} \\htmlClass{res}{${L.numTex(result, s.fmt)}}`, false);
        } else L.renderTex(v, L.interp(String(s.plug).replace(/\[([A-Za-z_]\w*)\]/g, (_, n) => wrapT(n, sym(n))), ctx.scope, true), false);
        numRow.style.fontSize = ''; let fs = parseFloat(getComputedStyle(numRow).fontSize), guard = 0;   // one line: shrink to fit, never wrap
        while (numRow.scrollWidth > numRow.clientWidth + 2 && fs > 24 && guard++ < 20) { fs -= 2; numRow.style.fontSize = fs + 'px'; }
      }
      L.fill(node, ctx.scope);
      requestAnimationFrame(() => {
        termLabels(eq, order.map(n => ({ id: n, text: L.plain(term(n).short || term(n).says || '', ctx.scope) })));
        overlays(eq, colorOf, 'lt', false); if (numRow) overlays(numRow, colorOf, 'lt', false);   // after the labels: they may move the formula
        R.show(ctx.k);
      });
    };
    const R = {
      node, steps: step, more,
      layout: draw,
      show: k => {
        node.querySelectorAll('.ul').forEach(u => u.classList.toggle('off', eq.contains(u) ? k < (termSteps[u.dataset.term] ?? 1) : false));
        eq.querySelectorAll('.tlab').forEach(t => t.classList.toggle('off', k < (termSteps[t.dataset.term] ?? 1)));
      },
      audit: () => { const out = []; const kx = eq.querySelector('.katex'); if (kx && kx.scrollWidth > eq.clientWidth + 4) out.push('formula is wider than its box');
        if (eq.dataset.crowded) out.push('term labels are crowded (a leader crosses a label): give long meanings a `short:`');
        const miss = order.filter(n => !term(n).says); if (miss.length) out.push(`a term has no meaning: ${miss.join(', ')}`); return out; },
    };
    return R;
  };

  T.calc = (s, ctx) => {
    const node = h('section', 'slide s-calc'); node.appendChild(head(s));
    const body = h('div', 'body ' + (s.visual ? 'split vis-left' : 'text-only')); node.appendChild(body);
    const box = h('div', 'calc g plate enter'); body.appendChild(box);
    const top = h('div', 'ctop'); if (s.given) top.appendChild(h('div', 'small', md(s.given)));
    const sym = n => symOf(ctx, n);
    const nt = notationEl((s.lines || []).map(ln => { try { return ln.expr ? L.tex(ln.expr, { sym }) : ln.tex || ''; } catch (e) { return ''; } }), s, 'left'); if (nt) top.appendChild(nt);
    if (top.children.length) box.appendChild(top);
    const lines = (s.lines || []).map((ln, i) => {
      const row = h('div', 'cline'); row.dataset.step = i + 1;
      row.innerHTML = `<div class="num">${i + 1}</div><div class="say">${md(ln.say || '')}${ln.why ? `<span class="cwhy">${md(ln.why)}</span>` : ''}</div><div class="math"></div>`; box.appendChild(row); return { ln, row };
    });
    let v = null; if (s.visual) { v = L.visual(s.visual, ctx); const cv = h('div', 'col-vis'); cv.appendChild(v.node); body.appendChild(cv); }
    const draw = () => {
      const labelled = new Set();   // each name is labelled once per slide: the first time its number appears
      const shownFmt = {};          // a number worked out on an earlier line keeps the rounding it was shown with
      lines.forEach(({ ln, row }, i) => {
        const math = row.querySelector('.math'); math.innerHTML = '';
        const where = `slide ${ctx.index + 1} calc line ${i + 1}`;
        if (ln.expr) {
          const val = L.try(ln.expr, ctx.scope, where); if (ln.name) ctx.scope[ln.name] = val;
          const names = [], seen = new Set(); const { tex: sub, eq } = L.work(ln.expr, { slash: true, val: n => { const x = ctx.scope[n]; return typeof x === 'number' ? x : null; }, arr: n => Array.isArray(ctx.scope[n]) ? ctx.scope[n] : null,
            wrap: (n, t) => { if (seen.has(n) || labelled.has(n)) return t; seen.add(n); labelled.add(n); names.push(shortOf(ctx, n)); return `\\htmlClass{op op-${names.length - 1}}{${t}}`; },
            fmt: ln.fmt, lit: null, fmtOf: (n, x) => subFmt(ctx, n, x, shownFmt[n]) }, val, ln.fmt, ctx.scope);
          if (ln.name) { labelled.add(ln.name); shownFmt[ln.name] = ln.fmt; }   // a result named on its own line needs no label later
          const symb = L.tex(ln.expr, { sym });
          const parts = [ln.name ? `${sym(ln.name)} = ${symb}` : symb, sub !== symb ? `= ${sub}` : null, `${eq} \\htmlClass{res}{${L.numTex(val, ln.fmt)}}`].filter(Boolean);
          parts.forEach((tex, pi) => { const span = h('span', 'part' + (pi === 1 && sub !== symb ? ' sub' : '')); math.appendChild(span); L.renderTex(span, tex, false); });
          // a line too long for one row stacks its parts at the = signs, so no '= result' is left alone at the edge
          math.classList.remove('wrapped'); const ps = [...math.children];
          if (ps.some((e, q) => q && e.offsetTop >= ps[q - 1].offsetTop + ps[q - 1].offsetHeight - 2)) math.classList.add('wrapped');
          row._names = names;
        } else if (ln.tex) { const span = h('span'); math.appendChild(span); L.renderTex(span, L.interp(ln.tex, ctx.scope, true), false); }
      });
      requestAnimationFrame(() => lines.forEach(({ row }) => { const sub = row.querySelector('.part.sub'); if (row._names && sub) opLabels(sub, row._names); }));
      v && v.layout();
    };
    return { node, steps: lines.length, layout: draw, show: k => { lines.forEach(({ row }, i) => row.classList.toggle('now', i + 1 === k)); v && v.show(k); }, audit: () => v ? v.audit() : [] };
  };

  // table: the given columns first, then one computed column (or row, or cell) per step. On each step the recipe card
  // works the numbers, and the cells the formula reads light up in the colour their symbol wears in the formula.
  // build: cols (default) | rows | cells | false. Any computed number can be tapped to see its own working.
  T.table = (s, ctx) => {
    const node = h('section', 'slide s-table'); node.appendChild(head(s));
    const body = h('div', 'body'); node.appendChild(body);
    const tw = h('div', 'tblwrap g plate enter'); body.appendChild(tw);
    const rec = h('div', 'recipe g plate enter'); body.appendChild(rec);
    const cols = s.cols || [];
    const rowsSrc = s.rows ? s.rows : s.from ? L.val(s.from, ctx.scope, 'table.from') : [];
    const der = cols.filter(c => c.expr), keys = new Set(cols.map(c => c.key));
    const focus = typeof s.focus === 'number' ? s.focus : Math.max(0, rowsSrc.findIndex(r => Object.values(r).includes(s.focus)));
    const colOf = n => cols.find(x => x.key === n);
    const sym = n => { const c = colOf(n); return c && c.tex ? c.tex : (ctx.symbols || {})[n] ? ctx.symbols[n].tex || L.autoSym(n) : c ? `\\text{${c.label || n}}` : L.autoSym(n); };
    // a column shows its symbol in the header when it has one, unless the symbol only repeats the label (CPM, CPM)
    const realSym = n => { const c = colOf(n); if (!(c && c.tex) && !(ctx.symbols || {})[n]) return false; return L.texPlain(sym(n)).toLowerCase() !== label(n).toLowerCase(); };
    const says = n => { const c = colOf(n); return (c && c.says) || saysOf(ctx, n) || (c && c.label) || n; };
    const label = n => { const c = colOf(n); return L.plain((c && c.label) || n, ctx.scope); };
    // in a column's formula: the result is orange; what it reads takes s1, s2, s3 in order
    const tcOf = (c, n) => n === c.key ? L.colors.accent : L.colors[TERMC[Math.min(3, Math.max(0, L.names(c.expr).indexOf(n)))]] || L.colors.mist;
    const reads = c => L.names(c.expr).filter(n => keys.has(n) && n !== c.key);
    const mode = s.build === false ? 'none' : s.build === true || s.build == null ? 'cols' : s.build;
    if (!der.length) rec.remove();
    // the plan: each step names the cells it fills, the row being worked and the columns worked on it
    const plan = [];
    if (der.length && mode !== 'none') {
      if (s.given !== false) plan.push({ cells: [], row: focus, cols: [] });
      if (mode === 'rows') rowsSrc.forEach((_, r) => plan.push({ cells: der.map(c => [r, c.key]), row: r, cols: der.map(c => c.key) }));
      else if (mode === 'cells') der.forEach(c => rowsSrc.forEach((_, r) => plan.push({ cells: [[r, c.key]], row: r, cols: [c.key] })));
      else der.forEach(c => plan.push({ cells: rowsSrc.map((_, r) => [r, c.key]), row: focus, cols: [c.key] }));
    }
    const nWork = plan.filter(p => p.cols.length).length;
    let computed = [], blocks = {};
    const rowName = r => { const c0 = cols[0], v0 = (computed[r] || {})[c0 && c0.key]; return typeof v0 === 'number' ? `${label(c0.key)} = ${L.fmt(v0, c0.fmt)}` : L.plain(String(v0 ?? `row ${r + 1}`), ctx.scope); };
    // one line of working: symbol = formula = numbers = result, each term underlined in its colour
    const working = (c, r, withSym = true) => {
      const fr = computed[r] || {}, sc = L.scope(ctx.scope, fr), names = [], seen = new Set();
      const lt = (n, t) => `\\htmlClass{lt lt-${n}}{${t}}`;
      const f = L.tex(c.expr, { sym, wrap: (n, t) => keys.has(n) ? lt(n, t) : t });
      const { tex: sub, eq } = L.work(c.expr, { slash: true, val: n => typeof sc[n] === 'number' ? sc[n] : null,
        wrap: (n, t) => { if (keys.has(n)) return lt(n, t); if (seen.has(n)) return t; seen.add(n); names.push(says(n)); return `\\htmlClass{op op-${names.length - 1}}{${t}}`; },
        lit: null, fmtOf: (n, x) => subFmt(ctx, n, x, (colOf(n) || {}).fmt) }, fr[c.key], c.fmt, sc);
      return { f: `${lt(c.key, sym(c.key))} = ${f}`, sub: `${sub} ${eq} \\htmlClass{res}{${L.numTex(fr[c.key], c.fmt)}}`, names, withSym };
    };
    const block = (k, html) => { const b0 = h('div', 'rk', html); b0.dataset.k = k; rec.appendChild(b0); blocks[k] = b0; return b0; };
    const draw = () => {
      computed = rowsSrc.map(r => { const sc = L.scope(ctx.scope, r); const out = { ...r }; der.forEach(c => { out[c.key] = L.try(c.expr, sc, `slide ${ctx.index + 1} column ${c.key}`); sc[c.key] = out[c.key]; }); return out; });
      const th = cols.map(c => `<th class="${c.expr ? 'der' : ''}" data-col="${L.esc(c.key)}">${c.expr ? '<span class="fx">f</span>' : ''}${md(c.label || c.key)}${realSym(c.key) ? '<span class="sy"></span>' : ''}</th>`).join('');
      const tb = computed.map((r, i) => `<tr data-r="${i}" style="--ri:${i}">${cols.map(c => `<td class="${c.expr ? 'der' : ''}" data-col="${L.esc(c.key)}" data-r="${i}">${typeof r[c.key] === 'number' ? L.fmt(r[c.key], c.fmt) : md(r[c.key])}</td>`).join('')}</tr>`).join('');
      tw.innerHTML = `<table class="t"><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table>`;
      tw.querySelectorAll('th .sy').forEach(e => L.renderTex(e, sym(e.parentElement.dataset.col), false));
      // the recipe card holds every block in one grid cell, so it is as tall as its tallest step and never jumps
      rec.innerHTML = ''; blocks = {};
      if (der.length) {
        const inputs = [...new Set(der.flatMap(reads))].filter(n => !colOf(n).expr);
        const per = mode === 'rows' ? 'row' : mode === 'cells' ? 'number' : 'column';
        block('given', `<div class="eyebrow">Start here</div><div class="rname">What each column holds</div>` +
          inputs.map(n => `<div class="gl"><span class="gs" data-n="${L.esc(n)}"></span><b>${L.esc(label(n))}</b><span class="gm">${md(says(n))}</span></div>`).join('') +
          `<div class="small">Then one new ${per} per step.</div>`);
        rec.querySelectorAll('.gs').forEach(e => L.renderTex(e, sym(e.dataset.n), false));
        const one = (c, r, eyebrow) => { const w = working(c, r), b0 = block(`${r}:${c.key}`, `<div class="eyebrow">${eyebrow}</div><div class="rname">${md(c.label || c.key)}</div><div class="rsays">${md(c.says || saysOf(ctx, c.key) || '')}</div>${c.why ? `<div class="rwhy">${md(c.why)}</div>` : ''}<div class="rf"></div><div class="rw"><div class="small">For ${L.esc(rowName(r))}:</div><span></span></div>`);
          L.renderTex(b0.querySelector('.rf'), w.f, false); L.renderTex(b0.querySelector('.rw span'), w.sub, false); b0._names = w.names; b0._c = c; };
        der.forEach((c, i) => rowsSrc.forEach((_, r) => one(c, r, mode === 'cells' ? `Column ${i + 1} of ${der.length} · row ${r + 1} of ${rowsSrc.length}` : `Step ${i + 1} of ${der.length} · how it is made`)));
        if (mode === 'rows') rowsSrc.forEach((_, r) => { const b0 = block(`${r}:*`, `<div class="eyebrow">Row ${r + 1} of ${rowsSrc.length}</div><div class="rname">${L.esc(rowName(r))}</div>` + der.map(c => `<div class="rline" data-col="${L.esc(c.key)}"><span class="rl">${md(c.label || c.key)}</span><span class="rm"></span></div>`).join(''));
          b0.querySelectorAll('.rline').forEach(e => { const c = colOf(e.dataset.col), w = working(c, r); L.renderTex(e.querySelector('.rm'), `${w.f} = ${w.sub}`, false); }); b0._multi = true; });
      }
      // too wide for its column: put the recipe under the table; still too wide: shrink the table to fit
      const o = document.body.classList.contains('port') ? 'port' : 'land';
      if (R.orient !== o) { R.orient = o; body.classList.remove('stacked'); }
      const t = tw.querySelector('table'); t.style.zoom = '';
      const need = t.scrollWidth + 60, room = body.clientWidth - (body.classList.contains('stacked') ? 0 : rec.offsetWidth + 30);
      if (need > room && der.length) body.classList.add('stacked');
      if (t.scrollWidth > tw.clientWidth - 8) t.style.zoom = Math.max(.6, (tw.clientWidth - 8) / t.scrollWidth);
      // a line of working stays on one line: shrink it to fit the card rather than let it wrap
      rec.querySelectorAll('.rf, .rm, .rw > span').forEach(e => { e.style.fontSize = ''; const box = e.closest('.rk'); let fs = parseFloat(getComputedStyle(e).fontSize), guard = 0;
        while (e.scrollWidth > box.clientWidth + 1 && fs > 20 && guard++ < 20) { fs -= 2; e.style.fontSize = fs + 'px'; } });
      tw.querySelectorAll('td.der').forEach(td => td.addEventListener('click', e => { e.stopPropagation(); pick(+td.dataset.r, [td.dataset.col]); }));
      tw.querySelectorAll('th.der').forEach(th0 => th0.addEventListener('click', e => { e.stopPropagation(); pick(focus, [th0.dataset.col]); }));
      R.show(ctx.k);
    };
    // light the row being worked, the cells it reads (in their formula colours) and the cell it fills; show its working
    const pick = (row, ck) => {
      tw.querySelectorAll('.wrow, .src, .cur, .now').forEach(e => e.classList.remove('wrow', 'src', 'cur', 'now'));
      const cell = (r, k) => tw.querySelector(`td[data-r="${r}"][data-col="${CSS.escape(k)}"]`);
      if (ck.length || mode === 'none') tw.querySelector(`tr[data-r="${row}"]`)?.classList.add('wrow');
      ck.forEach(k => { const c = colOf(k); tw.querySelector(`th[data-col="${CSS.escape(k)}"]`)?.classList.add('now'); cell(row, k)?.classList.add('cur');
        reads(c).forEach(n => { const e = cell(row, n); if (e && !e.classList.contains('pend')) { e.classList.add('src'); e.style.setProperty('--tc', tcOf(c, n)); } }); });
      const k = !ck.length ? 'given' : ck.length > 1 ? `${row}:*` : `${row}:${ck[0]}`;
      Object.values(blocks).forEach(b0 => b0.classList.toggle('shown', b0 === blocks[k]));
      const b0 = blocks[k]; if (!b0) return;
      // underlines in the formula colours; a deck value (not a column) gets its name written under its number
      const c = colOf(ck[0] || '');
      const colorOf = n => (b0._multi ? tcOf(colOf([...b0.querySelectorAll('.rline')].find(e => e.querySelector(`.lt-${CSS.escape(n)}`))?.dataset.col || ck[0]), n) : c ? tcOf(c, n) : L.colors.mist);
      requestAnimationFrame(() => { if (!b0.isConnected) return;
        if (b0._multi) b0.querySelectorAll('.rline').forEach(e => { const cc = colOf(e.dataset.col); overlays(e.querySelector('.rm'), n => tcOf(cc, n), 'lt', false); });
        else if (b0.querySelector('.rf')) { overlays(b0.querySelector('.rf'), colorOf, 'lt', false); overlays(b0.querySelector('.rw'), colorOf, 'lt', false); opLabels(b0.querySelector('.rw'), b0._names || []); } });
    };
    const R = {
      node, steps: plan.length, layout: draw,
      show: k => {
        const upto = mode === 'none' ? null : plan.slice(0, Math.max(0, k)), cur = plan[k - 1];
        const shown = new Set(upto ? upto.flatMap(p => p.cells.map(([r, c]) => `${r}:${c}`)) : computed.flatMap((_, r) => der.map(c => `${r}:${c.key}`)));
        tw.querySelectorAll('td.der').forEach(td => td.classList.toggle('pend', !shown.has(`${td.dataset.r}:${td.dataset.col}`)));
        tw.querySelectorAll('th.der').forEach(th0 => th0.classList.toggle('pend', !der.some(c => c.key === th0.dataset.col && computed.some((_, r) => shown.has(`${r}:${c.key}`)))));
        if (cur) pick(cur.row, cur.cols); else if (der.length) pick(focus, mode === 'none' ? [der[0].key] : []);
      },
      audit: () => plan.length > 15 ? [`the table takes ${plan.length} steps: use build: cols, or fewer rows`] : [],
    };
    return R;
  };

  T.bridge = (s, ctx) => {
    const node = h('section', 'slide s-bridge'); node.appendChild(head(s));
    const b = h('div', 'bridge enter'); node.appendChild(b);
    const from = typeof s.from === 'string' ? { name: s.from } : s.from || {}, to = typeof s.to === 'string' ? { name: s.to } : s.to || {};
    b.appendChild(h('div', 'worlds', `<div class="world">${md(from.name || 'what you know')}</div><div></div><div class="world to">${md(to.name || 'the new idea')}</div>`));
    (s.pairs || []).forEach((p, i) => { const row = h('div', 'pair'); row.dataset.step = i + 1; row.innerHTML = `<div class="cell g thin">${md(p[0])}</div><div class="eqv">≈</div><div class="cell g thin">${md(p[1])}</div>`; b.appendChild(row); });
    let steps = (s.pairs || []).length;
    if (s.breaks) { const br = h('div', 'breaks g thin coolbad'); br.dataset.step = ++steps; br.innerHTML = `<span class="bi">!</span><div class="bt"><b>Where it breaks:</b> ${md(s.breaks)}</div>`; b.appendChild(br); }
    return { node, steps };
  };

  T.compare = (s, ctx) => {
    const node = h('section', 'slide s-compare'); node.appendChild(head(s));
    const c = h('div', 'compare enter'); node.appendChild(c);
    const vs = [];
    ['a', 'b'].forEach((k, i) => { const x = s[k] || {}; const side = h('div', 'side g' + (x.tone === 'bad' ? ' coolbad' : x.tone === 'good' ? '' : '')); side.dataset.step = i + 1;
      const tone = x.tone ? `<div class="tone ${x.tone}"><i>${x.tone === 'good' ? '✓' : '✗'}</i>${md(x.verdict || (x.tone === 'good' ? 'works' : 'fails'))}</div>` : '';
      side.innerHTML = `${tone}<h3>${md(x.title || '')}</h3>`; if (x.text) side.appendChild(h('div', 'p', md(x.text))); if (x.points) side.appendChild(points(x.points, 0, false));
      if (x.visual) { const v = L.visual(x.visual, ctx); side.appendChild(v.node); vs.push(v); }
      c.appendChild(side); });
    let steps = 2;
    if (s.verdict) { const v = h('div', 'verdict g thin warm'); v.dataset.step = ++steps; v.innerHTML = md(s.verdict); node.appendChild(v); }
    return { node, steps, layout: () => vs.forEach(v => v.layout()), show: k => vs.forEach(v => v.show(k)), audit: () => vs.flatMap(v => v.audit()) };
  };

  T.quiz = (s) => {
    const node = h('section', 'slide s-quiz'); node.appendChild(head({ ...s, title: s.title || 'Say it before you flip it' }, s.eyebrow || 'Recall'));
    const q = h('div', 'quiz enter'); q.style.setProperty('--n', Math.min(3, (s.cards || []).length || 1)); node.appendChild(q);
    (s.cards || []).forEach(c => { const f = h('div', 'flip'); f.innerHTML = `<div class="in"><div class="face front g">${c.tag ? `<div class="tag">${md(c.tag)}</div>` : ''}<div class="q">${md(c.q)}</div><div class="hint">answer out loud, then tap</div></div><div class="face back g warm"><div class="a">${md(c.a)}</div></div></div>`;
      f.addEventListener('click', e => { e.stopPropagation(); f.classList.toggle('on'); }); q.appendChild(f); });
    return { node, steps: 0 };
  };

  T.recap = (s, ctx) => {
    const node = h('section', 'slide s-recap'); node.appendChild(head({ ...s, title: s.title || 'So, the answer' }));
    const r = h('div', 'recap enter'); node.appendChild(r);
    r.appendChild(h('div', 'answer g warm', `<div class="at">Answer</div><div class="ap">${md(s.answer || '')}</div>`));
    const box = (title, list, i) => { if (!list || !list.length) return; const b = h('div', 'box g thin'); b.dataset.step = i; b.appendChild(h('div', 'eyebrow', title)); b.appendChild(points(list, 0, false)); r.appendChild(b); };
    box('Keep these', s.points, 1); box('Where it breaks', s.breaks, 2);
    const more = s.next && s.next.length ? `<div class="eyebrow">Go next</div><ul class="pts">${s.next.map(x => `<li><span class="pip"></span><span>${md(x)}</span></li>`).join('')}</ul>` : '';
    return { node, steps: [s.points, s.breaks].filter(x => x && x.length).length, more };
  };

  T.map = (s, ctx) => {
    const node = h('section', 'slide s-map'); node.appendChild(head({ ...s, title: s.title || 'How this connects' }, s.eyebrow || 'Connections'));
    const w = h('div', 'mapw enter'); node.appendChild(w);
    const svg = L.svgEl('svg', {}); w.appendChild(svg);
    const c = h('div', 'mn center g', `<div class="mt">${md(s.center || '')}</div>`); w.appendChild(c);
    const KIND = { prereq: 'built on', sibling: 'cousin', next: 'leads to', analogy: 'like', uses: 'used in', special: 'special case' };
    const links = (s.links || []).map((l, i) => { const n = h('div', 'mn g thin', `<div class="mk2">${L.esc(KIND[l.kind] || l.kind || '')}</div><div class="mt">${md(l.to)}</div>${l.how ? `<div class="mh">${md(l.how)}</div>` : ''}`); n.dataset.step = i + 1; w.appendChild(n); return { l, n }; });
    const layout = () => {
      const W = w.clientWidth, H = w.clientHeight; if (!W) return; svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = '';
      if (document.body.classList.contains('port')) {   // phone: centre on top, links in a column
        c.style.left = W / 2 + 'px'; c.style.top = (c.offsetHeight / 2 + 4) + 'px';
        let y = c.offsetHeight + 26; links.forEach(({ n: e }) => { e.style.left = W / 2 + 'px'; e.style.top = (y + e.offsetHeight / 2) + 'px'; e.style.width = (W - 20) + 'px'; y += e.offsetHeight + 14; });
        return;
      }
      const cx = W / 2, cy = H / 2; c.style.left = cx + 'px'; c.style.top = cy + 'px';
      const n = links.length, rx = W * .36, ry = H * .36;
      links.forEach(({ l, n: e }, i) => { const a = -Math.PI / 2 + (i + .5) * 2 * Math.PI / n, x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
        e.style.width = ''; e.style.left = x + 'px'; e.style.top = y + 'px';
        const g = L.svgEl('g', { 'data-fstep': i + 1 }, svg); L.svgEl('path', { d: `M${cx},${cy}L${x},${y}`, class: 'edge' + (l.kind === 'analogy' ? ' analogy' : '') }, g); });
    };
    return { node, steps: links.length, layout, show: k => svg.querySelectorAll('[data-fstep]').forEach(g => { g.style.opacity = +g.dataset.fstep <= k ? 1 : 0; g.style.transition = 'opacity .5s'; }) };
  };
})();
