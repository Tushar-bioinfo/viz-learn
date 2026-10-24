/* Lucid core: formatting, markdown-lite, the expression engine (parse, evaluate, to TeX, substitute), statistics, seeded random numbers.
   One expression language serves derive:, table columns, calc lines, equations, chart functions and {{...}} text. */
(function () {
  'use strict';
  const L = window.Lucid = window.Lucid || {};
  L.errors = []; L.notes = [];
  const err = (where, msg) => { const m = `${where}: ${msg}`; if (!L.errors.includes(m)) L.errors.push(m); console.warn('lucid', m); };
  L.err = err;

  // ---------- numbers ----------
  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  const minus = s => String(s).replace(/^-/, '−').replace(/(\s|\()-/g, '$1−');
  const group = (s) => { const [a, b] = s.split('.'); const g = a.replace(/\B(?=(\d{3})+(?!\d))/g, ','); return b != null ? g + '.' + b : g; };
  const strip0 = s => s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
  function sci(v, sig = 2) {
    const [m, e] = v.toExponential(sig - 1).split('e');
    return `${strip0(m)}×10${[...String(+e)].map(c => SUP[c] || c).join('')}`;
  }
  // fmt(v, spec): spec = undefined (auto) | n decimals | 'sN' significant | '%' or '%N' | 'e' | ',' (integer) | 'int'
  L.fmt = function fmt(v, spec) {
    if (Array.isArray(v)) return v.length > 8 ? `[${v.slice(0, 6).map(x => fmt(x, spec)).join(', ')}, … ${v.length} values]` : `[${v.map(x => fmt(x, spec)).join(', ')}]`;
    if (typeof v === 'string') return v;
    if (typeof v === 'boolean') return v ? 'yes' : 'no';
    if (v == null || Number.isNaN(v)) return '–';
    if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
    let s;
    if (spec === undefined || spec === null || spec === '') {
      const a = Math.abs(v);
      if (a !== 0 && (a >= 1e7 || a < 1e-3)) s = sci(v, 2);
      else if (Number.isInteger(v)) s = group(String(v));
      else if (a >= 1000) s = group(v.toFixed(0));
      else if (a >= 100) s = group(strip0(v.toFixed(1)));
      else if (a >= 1) s = strip0(v.toFixed(2));
      else s = strip0(v.toPrecision(3));
    } else if (typeof spec === 'number' || /^\d+$/.test(spec)) s = group(v.toFixed(+spec));
    else if (spec === ',' || spec === 'int') s = group(Math.round(v).toString());
    else if (/^s\d+$/.test(spec)) { const a = Math.abs(v); s = a !== 0 && (a >= 1e7 || a < 1e-3) ? sci(v, +spec.slice(1)) : group(strip0((+v.toPrecision(+spec.slice(1))).toString())); }
    else if (/^%\d*$/.test(spec)) s = (v * 100).toFixed(spec.length > 1 ? +spec.slice(1) : 1) + '%';
    else if (/^e\d*$/.test(spec)) s = sci(v, spec.length > 1 ? +spec.slice(1) : 2);
    else s = String(v);
    return minus(s);
  };

  // ---------- html + markdown-lite ----------
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  L.esc = esc;
  // inline: $tex$, {{expr|fmt}}, **bold**, *italic*, `code`, ==highlight==. Interpolations become live spans.
  L.md = function md(s) {
    if (s == null) return '';
    const keep = [];
    let t = String(s).replace(/\{\{([\s\S]+?)\}\}/g, (_, x) => { keep.push(`<span class="iv" data-x="${esc(x)}"></span>`); return `\u0001${keep.length - 1}\u0002`; })
      .replace(/(?<![\\$\w])\$(?!\s)([^$\n]+?)(?<!\s)\$(?![\w$])/g, (_, x) => { keep.push(`<span class="tx" data-tex="${esc(x)}"></span>`); return `\u0001${keep.length - 1}\u0002`; });
    t = esc(t).replace(/\\\$/g, '$')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/==(.+?)==/g, '<mark class="hi">$1</mark>')
      .replace(/(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?!\w)/g, '<i>$1</i>');
    return t.replace(/\u0001(\d+)\u0002/g, (_, i) => keep[+i]);
  };

  // ---------- expression engine ----------
  const OPS = { '×': '*', '·': '*', '÷': '/', '−': '-', '≤': '<=', '≥': '>=' };
  function tokenize(src) {
    const s = String(src), out = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      const num = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i));
      if (num) { out.push({ k: 'num', v: parseFloat(num[0]) }); i += num[0].length; continue; }
      const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
      if (id) { out.push({ k: 'id', v: id[0] }); i += id[0].length; continue; }
      const two = s.slice(i, i + 2);
      if (['<=', '>=', '==', '!=', '**'].includes(two)) { out.push({ k: 'op', v: two === '**' ? '^' : two }); i += 2; continue; }
      if ('+-*/^(),[]<>'.includes(c)) { out.push({ k: 'op', v: c }); i++; continue; }
      if (OPS[c]) { out.push({ k: 'op', v: OPS[c] }); i++; continue; }
      throw new Error(`cannot read "${c}" in "${s}"`);
    }
    return out;
  }
  const BP = { '<': 5, '>': 5, '<=': 5, '>=': 5, '==': 5, '!=': 5, '+': 10, '-': 10, '*': 20, '/': 20, '^': 30 };
  function parse(src) {
    const tk = tokenize(src); let p = 0;
    const peek = () => tk[p], next = () => tk[p++];
    const expect = v => { const t = next(); if (!t || t.v !== v) throw new Error(`expected "${v}" in "${src}"`); };
    function nud(t) {
      if (!t) throw new Error(`unexpected end of "${src}"`);
      if (t.k === 'num') return { t: 'num', v: t.v };
      if (t.k === 'id') {
        if (peek() && peek().v === '(') { next(); const args = []; if (peek() && peek().v !== ')') { do { args.push(expr(0)); } while (peek() && peek().v === ',' && next()); } expect(')'); return { t: 'call', f: t.v, args }; }
        return { t: 'id', n: t.v };
      }
      if (t.v === '(') { const e = expr(0); expect(')'); return { t: 'par', a: e }; }
      if (t.v === '[') { const items = []; if (peek() && peek().v !== ']') { do { items.push(expr(0)); } while (peek() && peek().v === ',' && next()); } expect(']'); return { t: 'arr', items }; }
      if (t.v === '-') return { t: 'neg', a: expr(25) };
      if (t.v === '+') return expr(25);
      throw new Error(`unexpected "${t.v}" in "${src}"`);
    }
    function expr(rbp) {
      let left = nud(next());
      while (peek() && peek().k === 'op' && BP[peek().v] > rbp) { const op = next().v; left = { t: 'bin', op, a: left, b: expr(op === '^' ? BP[op] - 1 : BP[op]) }; }
      return left;
    }
    const tree = expr(0);
    if (p < tk.length) throw new Error(`unexpected "${tk[p].v}" in "${src}"`);
    return tree;
  }
  const cache = new Map();
  L.parse = src => { const k = String(src); if (!cache.has(k)) cache.set(k, parse(k)); return cache.get(k); };

  // names an expression uses (not functions)
  L.names = function names(ast, out = []) {
    if (typeof ast === 'string') ast = L.parse(ast);
    if (!ast) return out;
    if (ast.t === 'id' && !out.includes(ast.n)) out.push(ast.n);
    for (const k of ['a', 'b']) if (ast[k]) names(ast[k], out);
    if (ast.args) ast.args.forEach(x => names(x, out));
    if (ast.items) ast.items.forEach(x => names(x, out));
    return out;
  };

  // ---------- statistics ----------
  const lgamma = x => { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, .1208650973866179e-2, -.5395239384953e-5];
    let y = x, t = x + 5.5; t -= (x + .5) * Math.log(t); let s = 1.000000000190015; for (const k of c) s += k / ++y; return -t + Math.log(2.5066282746310005 * s / x); };
  const erf = x => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + .3275911 * x);
    return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x)); };
  function betacf(a, b, x) { // continued fraction for the incomplete beta (Numerical Recipes)
    const MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300; let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
    for (let m = 1; m <= MAXIT; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
      const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break; }
    return h;
  }
  const ibeta = (x, a, b) => { if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; };
  const normInv = p => { // Acklam
    if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239],
      b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572],
      c = [-.007784894002430293, -.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783],
      d = [.007784695709041462, .3224671290700398, 2.445134137142996, 3.754408661907416], pl = .02425;
    if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    const q = p - .5, r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  };
  const isInt = k => Number.isInteger(k) && k >= 0;
  const S = {
    normPdf: (x, m = 0, s = 1) => Math.exp(-.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI)),
    normCdf: (x, m = 0, s = 1) => .5 * (1 + erf((x - m) / (s * Math.SQRT2))),
    normInv: (p, m = 0, s = 1) => m + s * normInv(p),
    tPdf: (x, v) => Math.exp(lgamma((v + 1) / 2) - lgamma(v / 2)) / Math.sqrt(v * Math.PI) * (1 + x * x / v) ** (-(v + 1) / 2),
    tCdf: (x, v) => { const ib = ibeta(v / (v + x * x), v / 2, .5); return x >= 0 ? 1 - ib / 2 : ib / 2; },
    binomPmf: (k, n, p) => !isInt(k) || k > n ? 0 : Math.exp(lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1) + k * Math.log(p) + (n - k) * Math.log(1 - p)),
    poisPmf: (k, l) => !isInt(k) ? 0 : l === 0 ? (k === 0 ? 1 : 0) : Math.exp(k * Math.log(l) - l - lgamma(k + 1)),
    // negative binomial with mean mu and dispersion alpha: variance = mu + alpha * mu^2 (alpha = 0 gives Poisson)
    nbPmf: (k, mu, a) => { if (!isInt(k)) return 0; if (a <= 1e-9) return S.poisPmf(k, mu); const r = 1 / a;
      return Math.exp(lgamma(k + r) - lgamma(r) - lgamma(k + 1) + r * Math.log(r / (r + mu)) + k * Math.log(mu / (r + mu))); },
    gammaPdf: (x, shape, rate) => x <= 0 ? 0 : Math.exp(shape * Math.log(rate) - lgamma(shape) + (shape - 1) * Math.log(x) - rate * x),
    betaPdf: (x, a, b) => x <= 0 || x >= 1 ? 0 : Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + (a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x)),
    betaCdf: (x, a, b) => ibeta(x, a, b),
  };
  const cdf = pmf => (k, ...a) => { let s = 0; for (let i = 0; i <= Math.floor(k); i++) s += pmf(i, ...a); return Math.min(1, s); };
  S.poisCdf = cdf(S.poisPmf); S.binomCdf = cdf(S.binomPmf); S.nbCdf = cdf(S.nbPmf);
  L.stat = S;

  // seeded random numbers (mulberry32); every generator takes a seed so decks are reproducible
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const gauss = r => () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const rgamma1 = (r, shape) => { // Marsaglia–Tsang, scale 1
    if (shape < 1) return rgamma1(r, shape + 1) * Math.pow(r(), 1 / shape);
    const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d), n = gauss(r);
    for (;;) { let x, v; do { x = n(); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = r();
      if (u < 1 - .0331 * x ** 4 || Math.log(u) < .5 * x * x + d * (1 - v + Math.log(v))) return d * v; } };
  const rpois1 = (r, l) => { if (l > 400) { let s = 0, rest = l; while (rest > 0) { const part = Math.min(400, rest); s += rpois1(r, part); rest -= part; } return s; }
    let k = 0, p = Math.exp(-l), F = p; const u = r(); while (u > F && k < 1e6) { k++; p *= l / k; F += p; } return k; };
  L.rng = rng;

  // ---------- functions available in expressions ----------
  const vec = f => (...a) => Array.isArray(a[0]) ? a[0].map((x, i) => f(x, ...a.slice(1).map(v => Array.isArray(v) ? v[i] : v))) : f(...a);
  const flat = a => a.flat(Infinity).filter(x => typeof x === 'number' && !Number.isNaN(x));
  const agg = f => (...a) => f(flat(a));
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  const variance = a => { const m = mean(a); return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1); };
  const quant = (a, p) => { const s = [...a].sort((x, y) => x - y), h = (s.length - 1) * p, lo = Math.floor(h); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (h - lo); };
  const F = {
    abs: vec(Math.abs), sqrt: vec(Math.sqrt), exp: vec(Math.exp), log: vec(Math.log), ln: vec(Math.log), log2: vec(Math.log2), log10: vec(Math.log10),
    log1p: vec(Math.log1p), floor: vec(Math.floor), ceil: vec(Math.ceil), sign: vec(Math.sign),
    round: vec((x, d = 0) => Math.round(x * 10 ** d) / 10 ** d), pow: vec(Math.pow),
    sum: agg(a => a.reduce((s, x) => s + x, 0)), mean: agg(mean), var: agg(variance), sd: agg(a => Math.sqrt(variance(a))),
    min: agg(a => Math.min(...a)), max: agg(a => Math.max(...a)), median: agg(a => quant(a, .5)), count: agg(a => a.length), len: a => Array.isArray(a) ? a.length : 1,
    quantile: (a, p) => quant(flat([a]), p), cumsum: a => { let s = 0; return a.map(x => s += x); }, sort: a => [...a].sort((x, y) => x - y),
    rank: a => { const s = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = []; s.forEach(([, i], k) => r[i] = k + 1); return r; },
    at: (a, i) => a[i], first: a => a[0], last: a => a[a.length - 1],
    seq: (a, b, step = 1) => { const out = []; for (let x = a; step > 0 ? x <= b + 1e-9 : x >= b - 1e-9; x += step) out.push(+x.toFixed(10)); return out; },
    where: vec((c, a, b) => c ? a : b), clamp: vec((x, a, b) => Math.max(a, Math.min(b, x))),
    choose: (n, k) => Math.round(Math.exp(lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1))), factorial: n => Math.round(Math.exp(lgamma(n + 1))),
    normPdf: vec(S.normPdf), normCdf: vec(S.normCdf), normInv: vec(S.normInv), tPdf: vec(S.tPdf), tCdf: vec(S.tCdf),
    binomPmf: vec(S.binomPmf), poisPmf: vec(S.poisPmf), nbPmf: vec(S.nbPmf), gammaPdf: vec(S.gammaPdf), betaPdf: vec(S.betaPdf), betaCdf: vec(S.betaCdf),
    poisCdf: vec(S.poisCdf), binomCdf: vec(S.binomCdf), nbCdf: vec(S.nbCdf),
    rnorm: (n, m = 0, s = 1, seed = 1) => { const g = gauss(rng(seed)); return Array.from({ length: n }, () => m + s * g()); },
    runif: (n, a = 0, b = 1, seed = 1) => { const r = rng(seed); return Array.from({ length: n }, () => a + (b - a) * r()); },
    rpois: (n, l, seed = 1) => { const r = rng(seed); return Array.from({ length: n }, (_, i) => rpois1(r, Array.isArray(l) ? l[i] : l)); },
    rgamma: (n, shape, rate = 1, seed = 1) => { const r = rng(seed); return Array.from({ length: n }, () => rgamma1(r, shape) / rate); },
    // negative binomial as a gamma–Poisson mixture: each draw gets its own rate, then a Poisson count
    rnb: (n, mu, a, seed = 1) => { const r = rng(seed); return Array.from({ length: n }, () => rpois1(r, a <= 1e-9 ? mu : rgamma1(r, 1 / a) * mu * a)); },
    rbinom: (n, size, p, seed = 1) => { const r = rng(seed); return Array.from({ length: n }, () => { let k = 0; for (let i = 0; i < size; i++) if (r() < p) k++; return k; }); },
  };
  L.functions = F;
  const CONST = { pi: Math.PI, e: Math.E, inf: Infinity };

  function lookup(scope, n) {
    if (scope && n in scope) return scope[n];
    if (n in CONST) return CONST[n];
    throw new Error(`unknown name "${n}"`);
  }
  const bin = (op, a, b) => {
    if (Array.isArray(a) || Array.isArray(b)) {
      const n = Array.isArray(a) ? a.length : b.length;
      if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) throw new Error(`lists of different length (${a.length} and ${b.length})`);
      return Array.from({ length: n }, (_, i) => bin(op, Array.isArray(a) ? a[i] : a, Array.isArray(b) ? b[i] : b));
    }
    switch (op) {
      case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return a / b; case '^': return Math.pow(a, b);
      case '<': return +(a < b); case '>': return +(a > b); case '<=': return +(a <= b); case '>=': return +(a >= b); case '==': return +(a === b); case '!=': return +(a !== b);
    }
  };
  function ev(ast, scope) {
    switch (ast.t) {
      case 'num': return ast.v;
      case 'id': return lookup(scope, ast.n);
      case 'par': return ev(ast.a, scope);
      case 'arr': return ast.items.map(x => ev(x, scope));
      case 'neg': { const v = ev(ast.a, scope); return Array.isArray(v) ? v.map(x => -x) : -v; }
      case 'bin': return bin(ast.op, ev(ast.a, scope), ev(ast.b, scope));
      case 'call': { const f = F[ast.f]; if (!f) throw new Error(`unknown function "${ast.f}()"`); return f(...ast.args.map(x => ev(x, scope))); }
    }
  }
  L.eval = (src, scope) => ev(typeof src === 'string' || typeof src === 'number' ? L.parse(String(src)) : src, scope);
  // safe evaluation: returns NaN and records the error once
  L.try = (src, scope, where = 'expression') => { try { return L.eval(src, scope); } catch (e) { err(where, `${e.message} (in "${src}")`); return NaN; } };
  // a value written in YAML may be a number, a list, or an expression string
  L.val = (x, scope, where) => typeof x === 'number' || Array.isArray(x) ? x : x == null ? NaN : L.try(x, scope, where);

  // ---------- expressions to TeX ----------
  const GREEK = new Set(['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma', 'tau', 'phi', 'chi', 'psi', 'omega',
    'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi', 'Omega']);
  L.autoSym = n => {
    const [base, ...sub] = n.split('_');
    const b = GREEK.has(base) ? `\\${base}` : base.length === 1 ? base : `\\mathrm{${base}}`;
    return sub.length ? `${b}_{\\mathrm{${sub.join(',')}}}` : b;
  };
  const PREC = { '<': 1, '>': 1, '<=': 1, '>=': 1, '==': 1, '!=': 1, '+': 2, '-': 2, '*': 3, '/': 3, neg: 4, '^': 5 };
  const TEXOP = { '<': '<', '>': '>', '<=': '\\le', '>=': '\\ge', '==': '=', '!=': '\\ne' };
  const FN = { log: x => `\\ln ${x}`, ln: x => `\\ln ${x}`, log2: x => `\\log_2 ${x}`, log10: x => `\\log_{10} ${x}`, log1p: x => `\\ln(1 + ${x.replace(/^\\left\(|\\right\)$/g, '')})`,
    exp: x => `e^{${x.replace(/^\\left\((.*)\\right\)$/, '$1')}}`, sqrt: x => `\\sqrt{${x.replace(/^\\left\((.*)\\right\)$/, '$1')}}`, abs: x => `\\left|${x.replace(/^\\left\((.*)\\right\)$/, '$1')}\\right|`,
    normCdf: x => `\\Phi${x}`, normPdf: x => `\\varphi${x}`, floor: x => `\\lfloor ${x.replace(/^\\left\((.*)\\right\)$/, '$1')} \\rfloor`, ceil: x => `\\lceil ${x.replace(/^\\left\((.*)\\right\)$/, '$1')} \\rceil` };
  // opts: { sym: name -> tex, val: name -> number (substitute), wrap: (name, tex, i) -> tex, fmt }
  L.tex = function tex(src, opts = {}) {
    const ast = typeof src === 'string' ? L.parse(src) : src; let occ = 0;
    const isNumLike = a => a.t === 'num' || (opts.val && a.t === 'id' && opts.val(a.n) != null);
    const go = (a, ctx = 0) => {
      let s, p = 9;
      switch (a.t) {
        case 'num': s = a.v >= 1e4 && Number.isInteger(Math.log10(a.v)) ? `10^{${Math.log10(a.v)}}` : numTex(a.v, opts.fmt); if (a.v < 0) p = 4; break;
        case 'id': {
          const v = opts.val ? opts.val(a.n) : null;
          if (v != null) { s = numTex(v, opts.fmt); if (typeof v === 'number' && v < 0) { s = `\\left(${s}\\right)`; } }
          else s = (opts.sym && opts.sym(a.n)) || L.autoSym(a.n);
          if (opts.wrap) s = opts.wrap(a.n, s, occ++);
          break;
        }
        case 'par': return go(a.a, ctx);
        case 'arr': s = `[${a.items.map(x => go(x)).join(',\\ ')}]`; break;
        case 'neg': s = `-${go(a.a, PREC.neg)}`; p = PREC.neg; break;
        case 'bin': {
          p = PREC[a.op];
          if (a.op === '/' && !opts.slash) { s = `\\dfrac{${go(a.a)}}{${go(a.b)}}`; p = 9; break; }
          if (a.op === '/') { s = `${go(a.a, 3)} \\mathbin{/} ${go(a.b, 3.5)}`; p = 3; break; }
          if (a.op === '^') { const base = go(a.a, 6); s = `{${base}}^{${go(a.b)}}`; break; }
          const L1 = go(a.a, p), R1 = go(a.b, a.op === '-' || a.op === '/' ? p + .5 : p);
          if (a.op === '*') {
            const juxt = !opts.val && !isNumLike(a.b) && !(a.b.t === 'neg') && (isNumLike(a.a) || a.a.t === 'id' || a.a.t === 'par');
            s = juxt ? `${L1}\\,${R1}` : `${L1} \\times ${R1}`;
          } else s = `${L1} ${TEXOP[a.op] || a.op} ${R1}`;
          break;
        }
        case 'call': {
          // aggregates over a list show their recipe: symbolic -> (1/n) Σ x_i ; substituted -> (8 + 34 + … ) / 6
          const one = a.args.length === 1 && a.args[0].t === 'id' ? a.args[0].n : null;
          const arr = one && opts.arr ? opts.arr(one) : null;
          if (one && ['mean', 'sum', 'var', 'sd'].includes(a.f) && !(opts.val && !arr)) {
            const base = (opts.sym && opts.sym(one)) || L.autoSym(one), xi = `${base}_i`, xbar = `\\bar{${base}}`;
            if (!arr) {
              const ss = `\\sum_i (${xi} - ${xbar})^2`;
              s = { mean: `\\tfrac{1}{n}\\sum_i ${xi}`, sum: `\\sum_i ${xi}`, var: `\\tfrac{1}{n-1}${ss}`, sd: `\\sqrt{\\tfrac{1}{n-1}${ss}}` }[a.f];
            } else {
              const n = arr.length, f = v => numTex(v, opts.fmt), list = n <= 8 ? arr.map(f).join(' + ') : `${f(arr[0])} + ${f(arr[1])} + \\dots + ${f(arr[n - 1])}`;
              const mean = arr.reduce((u, v) => u + v, 0) / n, SS = arr.reduce((u, v) => u + (v - mean) ** 2, 0);
              const wrapL = t => opts.wrap ? opts.wrap(one, t, occ++) : t;
              s = { mean: `\\dfrac{${wrapL(list)}}{${n}}`, sum: wrapL(list),
                var: `\\dfrac{${wrapL(n <= 4 ? arr.map(v => `(${f(v)} - ${f(mean)})^2`).join(' + ') : f(SS))}}{${n} - 1}`,
                sd: `\\sqrt{\\dfrac{${wrapL(f(SS))}}{${n} - 1}}` }[a.f];
            }
            break;
          }
          const args = a.args.map(x => go(x));
          if (a.f === 'choose') { s = `\\binom{${args[0]}}{${args[1]}}`; break; }
          if (a.f === 'factorial') { s = `${args[0]}!`; break; }
          if (a.f === 'pow') { s = `{${args[0]}}^{${args[1]}}`; break; }
          if (a.f === 'mean' && a.args.length === 1 && a.args[0].t === 'id' && !(opts.val && opts.val(a.args[0].n) != null)) { s = `\\bar{${args[0]}}`; break; }
          const inner = `\\left(${args.join(',\\ ')}\\right)`;
          s = FN[a.f] && a.args.length === 1 ? FN[a.f](inner) : `\\operatorname{${a.f}}${inner}`;
          break;
        }
      }
      return p < ctx ? `\\left(${s}\\right)` : s;
    };
    return go(ast);
  };
  function numTex(v, f) {
    if (Array.isArray(v)) return `[\\dots]`;
    const s = L.fmt(v, f);
    return s.replace(/−/g, '-').replace(/,/g, '{,}').replace(/×10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)/, (_, e) => `\\times 10^{${[...e].map(c => Object.keys(SUP).find(k => SUP[k] === c)).join('')}}`).replace(/%/g, '\\%');
  }
  L.numTex = numTex;

  // ---------- scope ----------
  // global: data + derive; a slide scope adds the slide's controls and its own derive; a row scope adds row fields
  L.scope = (parent, extra) => Object.assign(Object.create(parent || null), extra || {});
  L.derive = function (scope, derive, where) {
    for (const [k, x] of Object.entries(derive || {})) scope[k] = L.val(x, scope, `${where} derive.${k}`);
    return scope;
  };
})();
