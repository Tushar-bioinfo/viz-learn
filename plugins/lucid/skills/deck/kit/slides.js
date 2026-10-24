/* Lucid slides: one renderer per slide type, plus visuals (chart, stat, units, flow, code, image, eqn, svg).
   A renderer returns { node, steps, show(k), layout(), audit() }. Steps reveal with data-step="k" (1-based). */
(function () {
  'use strict';
  const L = window.Lucid;
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
  const shortOf = (ctx, n) => { const s = (ctx.terms || {})[n] || (ctx.symbols || {})[n]; return (s && (s.short || s.says)) || n; };

  // ---------- common head ----------
  const LEADW = /^(But|So|Now|Why|Yet|Then|Therefore|Next|Wait|First|Finally|Notice|Here|Still|Instead|Remember|Recall|Back)\b/;
  function head(s, extra) {
    const hd = h('div', 'head enter');
    if (s.eyebrow || extra) hd.appendChild(h('div', 'eyebrow', md(s.eyebrow || extra)));
    if (s.lead) hd.appendChild(h('div', 'lead', md(s.lead).replace(LEADW, '<span class="lw">$1</span>')));
    if (s.title) hd.appendChild(h('div', 'h1', md(s.title)));
    return hd;
  }
  function points(list, from = 1, build = true) {
    const ul = h('ul', 'pts');
    (list || []).forEach((p, i) => { const li = h('li', '', `<span class="pip"></span><span>${md(p)}</span>`); if (build) li.dataset.step = from + i; ul.appendChild(li); });
    return ul;
  }

  // ---------- controls ----------
  function controls(list, slideCtx) {
    const box = h('div', 'controls');
    (list || []).forEach(c => {
      const w = h('div', 'ctl g pill thin');
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
        const ox = (W - cols * cell) / 2, oy = (H - rows * cell) / 2;
        for (let i = 0; i < n; i++) { const cx = ox + (i % cols + .5) * cell, cy = oy + (Math.floor(i / cols) + .5) * cell, on = i < hi;
          L.svgEl('circle', { cx, cy, r, fill: on ? L.colors.lantern : 'none', stroke: on ? L.colors.lantern : L.colors.haze, 'stroke-width': on ? 0 : 2, opacity: on ? 1 : .7 }, svg); }
      };
      vis.classList.remove('plate');
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
    } else if (v.image) {
      const box = h('div', 'imgbox'); const img = h('img'); img.src = (window.LUCID_ASSETS || {})[v.image] || v.image; img.alt = v.alt || ''; box.appendChild(img); vis.appendChild(box);
    } else if (v.eqn) {
      const box = h('div', 'eqmain'); vis.appendChild(box); const tex = v.eqn;
      R.layout = () => { L.renderTex(box, L.interp(tex, ctx.scope, true), true); fitEq(box); };
    } else if (v.svg) {
      const box = h('div', 'imgbox'); box.innerHTML = v.svg; vis.appendChild(box);
    } else L.err(`slide ${ctx.index + 1}`, `visual needs one of chart, stat, units, flow, code, image, eqn, svg`);
    const tg = v.chart && ctx.charts.length && ctx.charts[ctx.charts.length - 1].toggle;
    if (v.caption || tg) { const f = h('div', 'vfoot'); if (v.caption) f.appendChild(h('div', 'cap', md(v.caption))); if (tg) f.appendChild(tg); vis.appendChild(f); }
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
    const kb = [...row.querySelectorAll('.katex .base, .katex')].map(k => k.getBoundingClientRect()).reduce((a, b) => (b.bottom > a.bottom ? b : a), (container.querySelector('.katex') || container).getBoundingClientRect());
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
    const need = rows.length ? Math.max(...rows.map(b => b.bottom)) - container.offsetHeight + 8 : 0;   // reserve room under the part itself
    if (need > 0) container.style.paddingBottom = need + 'px';
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
    const chs = L.chapters || []; if (chs.length > 1 && s.chips !== false) { const c = h('div', 'chips enter'); chs.forEach((x, i) => c.appendChild(h('span', 'g pill thin', `${i + 1} · ${L.esc(x)}`))); node.appendChild(c); }
    return { node, steps: 0 };
  };

  T.chapter = (s, ctx) => {
    const node = h('section', 'slide s-statement');
    const n = (L.chapters || []).indexOf(s.title) + 1;
    const g = h('div', 'g enter');
    g.innerHTML = `<div class="eyebrow" style="margin-bottom:22px">${n ? `Part ${n} of ${L.chapters.length}` : 'Next part'}</div><div class="big">${md(s.title)}</div>${s.q ? `<div class="sub">${md(s.q)}</div>` : ''}`;
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
    const layout = s.layout || (v && pts.length ? 'split' : v ? 'wide' : 'text-only');
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
    const ctl = (s.controls || (s.visual && s.visual.chart && s.visual.chart.controls)); if (ctl && v) { const hd = v.node.querySelector('.vhead'); let f = hd || v.node.querySelector('.vfoot'); if (!f) { f = h('div', 'vfoot'); v.node.appendChild(f); } const c = controls(ctl, ctx); if (hd) hd.appendChild(c); else f.appendChild(c); }
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
      why.classList.add('open'); hint.style.display = 'none'; ctx.later.forEach(v => v.layout()); };
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
    const order = s.lhs ? [...inputs, s.lhs] : inputs;
    const colorOf = n => n === s.lhs ? L.colors.lantern : L.colors[TERMC[Math.min(Math.max(0, inputs.indexOf(n)), 3)]] || L.colors.mist;
    // the numbers a computable equation runs on: a term's `value`, else the name in scope
    const eqScope = () => { const sc = L.scope(ctx.scope, {}); inputs.forEach(n => { const t = term(n); if (t.value != null) sc[n] = L.val(t.value, ctx.scope, `term ${n}`); }); return sc; };
    const eq = h('div', 'eqmain'); wrap.appendChild(eq);
    const left = h('div', 'eqleft'); wrap.appendChild(left);
    const termBox = h('div', 'terms'); wrap.appendChild(termBox);
    let step = 1;
    if (s.read) { const r = h('div', 'eqrow'); r.dataset.step = ++step; r.innerHTML = `<span class="tag">Say it</span><span class="read">“${md(s.read)}”</span>`; left.appendChild(r); }
    const termSteps = {};
    const cards = order.map(n => {
      const card = h('div', 'term'); card.style.setProperty('--tc', colorOf(n)); card.dataset.step = ++step; termSteps[n] = step;
      card.innerHTML = `<span class="sw"></span><span class="sym"></span><span class="says">${md(term(n).says || '<i>meaning missing</i>')}</span><div class="eg"></div>`;
      L.renderTex(card.querySelector('.sym'), sym(n), false); termBox.appendChild(card); return [n, card];
    });
    let plugRow = null;
    if (s.plug !== false && (computable || s.plug)) { plugRow = h('div', 'eqrow'); plugRow.dataset.step = ++step; plugRow.innerHTML = `<span class="tag">With numbers</span><span class="val"></span>`; left.appendChild(plugRow); }
    if (s.code) { const r = h('div', 'eqrow'); r.dataset.step = ++step; const tc = {}; order.forEach(n => tc[n] = colorOf(n)); r.innerHTML = `<span class="tag">In code</span>`; r.appendChild(h('div', 'codebox', codeHTML(s.code, tc))); left.appendChild(r); }
    if (s.note) { const r = h('div', 'eqrow'); r.dataset.step = ++step; r.innerHTML = `<span class="tag">So</span><span class="p">${md(s.note)}</span>`; left.appendChild(r); }
    if (!left.children.length) left.remove();
    if (left.children.length || order.length) wrap.classList.add('two');
    const draw = () => {
      L.renderTex(eq, L.interp(main, ctx.scope, true), true); fitEq(eq);
      const sc = computable ? eqScope() : ctx.scope;
      let result = null;
      if (computable) { result = L.try(s.expr, sc, `slide ${ctx.index + 1} equation`); if (s.lhs && s.store !== false) { ctx.scope[s.lhs] = result; sc[s.lhs] = result; } }
      cards.forEach(([n, card]) => { const t = term(n), v = n === s.lhs ? result : t.value != null ? sc[n] : typeof sc[n] === 'number' ? sc[n] : null;
        card.querySelector('.eg').innerHTML = v != null && !Number.isNaN(v) ? `e.g. <b>${L.esc(L.fmt(v, t.fmt))}</b>${t.eg ? ' · ' + md(t.eg) : ''}` : t.eg ? `e.g. ${md(t.eg)}` : ''; });
      if (plugRow) {
        const v = plugRow.querySelector('.val');
        if (computable) {
          const sub = L.tex(s.expr, { slash: true, val: n => typeof sc[n] === 'number' ? sc[n] : null, wrap: (n, t) => wrapT(n, t), fmt: s.fmt });
          L.renderTex(v, `${sub} = \\htmlClass{res}{${L.numTex(result, s.fmt)}}`, false);
        } else L.renderTex(v, L.interp(String(s.plug).replace(/\[([A-Za-z_]\w*)\]/g, (_, n) => wrapT(n, sym(n))), ctx.scope, true), false);
      }
      L.fill(node, ctx.scope);
      requestAnimationFrame(() => { overlays(eq, colorOf); if (plugRow) overlays(plugRow, colorOf, 'lt', false); R.show(ctx.k); });
    };
    const R = {
      node, steps: step,
      layout: draw,
      show: k => {
        node.querySelectorAll('.ul').forEach(u => { const st = termSteps[u.dataset.term] ?? 1; u.classList.toggle('off', eq.contains(u) ? k < st : false); });
        node.querySelectorAll('.halo').forEach(hh => { const st = termSteps[hh.dataset.term]; hh.classList.toggle('off', !(st && k === st && eq.contains(hh))); });
        node.querySelectorAll('.term').forEach(t => t.classList.toggle('now', +t.dataset.step === k));
      },
      audit: () => { const out = []; const kx = eq.querySelector('.katex'); if (kx && kx.scrollWidth > eq.clientWidth + 4) out.push('formula is wider than its box');
        const miss = order.filter(n => !term(n).says); if (miss.length) out.push(`a term has no meaning: ${miss.join(', ')}`); return out; },
    };
    return R;
  };

  T.calc = (s, ctx) => {
    const node = h('section', 'slide s-calc'); node.appendChild(head(s));
    const body = h('div', 'body ' + (s.visual ? 'split vis-left' : 'text-only')); node.appendChild(body);
    const box = h('div', 'calc g plate enter'); body.appendChild(box);
    if (s.given) box.appendChild(h('div', 'small', md(s.given)));
    const sym = n => symOf(ctx, n);
    const lines = (s.lines || []).map((ln, i) => {
      const row = h('div', 'cline'); row.dataset.step = i + 1;
      row.innerHTML = `<div class="num">${i + 1}</div><div class="say">${md(ln.say || '')}</div><div class="math"></div>`; box.appendChild(row); return { ln, row };
    });
    let v = null; if (s.visual) { v = L.visual(s.visual, ctx); const cv = h('div', 'col-vis'); cv.appendChild(v.node); body.appendChild(cv); }
    const draw = () => {
      const labelled = new Set();   // each name is labelled once per slide: the first time its number appears
      lines.forEach(({ ln, row }, i) => {
        const math = row.querySelector('.math'); math.innerHTML = '';
        const where = `slide ${ctx.index + 1} calc line ${i + 1}`;
        if (ln.expr) {
          const val = L.try(ln.expr, ctx.scope, where); if (ln.name) ctx.scope[ln.name] = val;
          const names = [], seen = new Set(); const sub = L.tex(ln.expr, { slash: true, val: n => { const x = ctx.scope[n]; return typeof x === 'number' ? x : null; }, arr: n => Array.isArray(ctx.scope[n]) ? ctx.scope[n] : null,
            wrap: (n, t) => { if (seen.has(n) || labelled.has(n)) return t; seen.add(n); labelled.add(n); names.push(shortOf(ctx, n)); return `\\htmlClass{op op-${names.length - 1}}{${t}}`; }, fmt: ln.fmt });
          if (ln.name) labelled.add(ln.name);   // a result named on its own line needs no label later
          const symb = L.tex(ln.expr, { sym });
          const parts = [ln.name ? `${sym(ln.name)} = ${symb}` : symb, sub !== symb ? `= ${sub}` : null, `= \\htmlClass{res}{${L.numTex(val, ln.fmt)}}`].filter(Boolean);
          parts.forEach((tex, pi) => { const span = h('span', 'part' + (pi === 1 && sub !== symb ? ' sub' : '')); math.appendChild(span); L.renderTex(span, tex, false); });
          row._names = names;
        } else if (ln.tex) { const span = h('span'); math.appendChild(span); L.renderTex(span, L.interp(ln.tex, ctx.scope, true), false); }
      });
      requestAnimationFrame(() => lines.forEach(({ row }) => { const sub = row.querySelector('.part.sub'); if (row._names && sub) opLabels(sub, row._names); }));
      v && v.layout();
    };
    return { node, steps: lines.length, layout: draw, show: k => { lines.forEach(({ row }, i) => row.classList.toggle('now', i + 1 === k)); v && v.show(k); }, audit: () => v ? v.audit() : [] };
  };

  T.table = (s, ctx) => {
    const node = h('section', 'slide s-table'); node.appendChild(head(s));
    const body = h('div', 'body'); node.appendChild(body);
    const tw = h('div', 'tblwrap g plate enter'); body.appendChild(tw);
    const rec = h('div', 'recipe g plate enter'); body.appendChild(rec);
    const cols = s.cols || [];
    const rowsSrc = s.rows ? s.rows : s.from ? L.val(s.from, ctx.scope, 'table.from') : [];
    const der = cols.filter(c => c.expr);
    const focus = typeof s.focus === 'number' ? s.focus : Math.max(0, rowsSrc.findIndex(r => Object.values(r).includes(s.focus)));
    const sym = n => { const c = cols.find(x => x.key === n); return c && c.tex ? c.tex : (ctx.symbols || {})[n] ? ctx.symbols[n].tex || L.autoSym(n) : c ? `\\text{${c.label || n}}` : L.autoSym(n); };
    const says = n => { const c = cols.find(x => x.key === n); return (c && c.says) || saysOf(ctx, n) || (c && c.label) || n; };
    const recipes = der.map((c, i) => { const r = h('div', 'rk'); r.dataset.only = i + 1; r.innerHTML = `<div class="eyebrow">Column ${cols.indexOf(c) + 1} · how it is made</div><div class="rname">${md(c.label || c.key)}</div><div class="rsays">${md(c.says || saysOf(ctx, c.key) || '')}</div><div class="rf"></div><div class="rw"></div>`; rec.appendChild(r); return r; });
    if (!der.length) rec.remove();
    let computed = [];
    const draw = () => {
      computed = rowsSrc.map(r => { const sc = L.scope(ctx.scope, r); const out = { ...r }; der.forEach(c => { out[c.key] = L.try(c.expr, sc, `slide ${ctx.index + 1} column ${c.key}`); sc[c.key] = out[c.key]; }); return out; });
      const th = cols.map(c => `<th class="${c.expr ? 'der' : ''}" data-col="${L.esc(c.key)}">${c.expr ? '<span class="fx">f</span>' : ''}${md(c.label || c.key)}</th>`).join('');
      const tb = computed.map((r, i) => `<tr class="${i === focus ? 'focus' : ''}">${cols.map(c => `<td class="${c.expr ? 'der' : ''}" data-col="${L.esc(c.key)}">${typeof r[c.key] === 'number' ? L.fmt(r[c.key], c.fmt) : md(r[c.key])}</td>`).join('')}</tr>`).join('');
      tw.innerHTML = `<table class="t"><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table>`;
      der.forEach((c, i) => {
        const r = recipes[i], fr = computed[focus] || {}, sc = L.scope(ctx.scope, fr);
        L.renderTex(r.querySelector('.rf'), `${sym(c.key)} = ${L.tex(c.expr, { sym })}`, false);
        const names = [], seen = new Set(); const sub = L.tex(c.expr, { slash: true, val: n => typeof sc[n] === 'number' ? sc[n] : null, wrap: (n, t) => { if (seen.has(n)) return t; seen.add(n); names.push(says(n)); return `\\htmlClass{op op-${names.length - 1}}{${t}}`; } });
        const c0 = cols[0], v0 = fr[c0 && c0.key];
        const who = typeof v0 === 'number' ? `${L.esc(L.plain(c0.label || c0.key))} = ${L.fmt(v0, c0.fmt)}` : md(String(v0 ?? 'the first row'));
        const rw = r.querySelector('.rw'); rw.innerHTML = `<div class="small" style="margin-bottom:6px">For ${who}:</div><span></span>`;
        L.renderTex(rw.querySelector('span'), `${sub} = \\htmlClass{res}{${L.numTex(fr[c.key], c.fmt)}}`, false); r._names = names;
      });
      // too wide for its column: put the recipe under the table; still too wide: shrink the table to fit
      const o = document.body.classList.contains('port') ? 'port' : 'land';
      if (R.orient !== o) { R.orient = o; body.classList.remove('stacked'); }
      const t = tw.querySelector('table'); t.style.zoom = '';
      const need = t.scrollWidth + 60, room = body.clientWidth - (body.classList.contains('stacked') ? 0 : rec.offsetWidth + 30);
      if (need > room && der.length) body.classList.add('stacked');
      if (t.scrollWidth > tw.clientWidth - 8) t.style.zoom = Math.max(.6, (tw.clientWidth - 8) / t.scrollWidth);
      requestAnimationFrame(() => recipes.forEach(r => opLabels(r.querySelector('.rw'), r._names || [])));
      R.show(ctx.k);
    };
    const R = {
      node, steps: der.length, layout: draw,
      show: k => {
        der.forEach((c, i) => tw.querySelectorAll(`[data-col="${CSS.escape(c.key)}"]`).forEach(e => { e.classList.toggle('pend', i + 1 > k); e.classList.toggle('now', i + 1 === k && e.tagName === 'TH'); }));
        recipes.forEach((r, i) => r.classList.toggle('shown', i + 1 === Math.max(1, Math.min(k, der.length))));
      },
    };
    tw.addEventListener('click', e => { const t = e.target.closest('th.der'); if (!t) return; e.stopPropagation(); const i = der.findIndex(c => c.key === t.dataset.col); recipes.forEach((r, j) => r.classList.toggle('shown', j === i)); requestAnimationFrame(() => recipes.forEach(r => opLabels(r.querySelector('.rw'), r._names || []))); });
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
    box('Keep these', s.points, 1); box('Where it breaks', s.breaks, 2); box('Go next', s.next, 3);
    return { node, steps: [s.points, s.breaks, s.next].filter(x => x && x.length).length };
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
