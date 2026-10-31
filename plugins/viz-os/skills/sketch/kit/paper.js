/* viz-os sketch paper: a sheet as a height field the pens touch, plus a near-flat scanned tone.
   Ported from statechart-art tools/kit (util.js, paper.js) by Kevin T. Ngo, MIT, see NOTICE. */
(function () {
  'use strict';
  const K = (window.VizOS = window.VizOS || {}).sketch = (window.VizOS.sketch || {});

  // ---------- numbers ----------
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

function hashStr(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}
// mulberry32 with the helper methods the contract wants
function rng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hashStr(String(seed));
  const R = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < 8; i++) R();
  R.range = (lo, hi) => lo + R() * (hi - lo);
  R.int = (lo, hi) => Math.floor(lo + R() * (hi - lo + 1));
  R.pick = (arr) => arr[Math.floor(R() * arr.length)];
  R.chance = (p) => R() < p;
  R.gauss = (m = 0, sd = 1) => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
  R.shuffle = (arr) => { const o = arr.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };
  R.fork = (tag) => rng(hashStr(String(tag)) ^ Math.floor(R() * 4294967296));
  return R;
}

// band-limited 1-D wander: a handful of incommensurate sinusoids. f(s) in about [-1,1].
function wander(R, lamMin, lamMax, n = 4) {
  const A = [], L = [], P = [];
  let norm = 0;
  for (let i = 0; i < n; i++) {
    const lam = lamMin * Math.pow(lamMax / lamMin, (i + R() * 0.8) / n);
    const amp = Math.pow(lam / lamMax, 0.35) * (0.6 + 0.8 * R());
    A.push(amp); L.push(TAU / lam); P.push(R() * TAU); norm += amp * amp;
  }
  norm = 1 / Math.sqrt(norm / 2 * 1.0);
  return (s) => { let v = 0; for (let i = 0; i < n; i++) v += A[i] * Math.sin(s * L[i] + P[i]); return v * norm * 0.5; };
}

function hexToRgb(h) {
  if (Array.isArray(h)) return h;
  h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// centripetal-ish Catmull-Rom through pts (mm), sampled roughly every `step`
function catmull(pts, step) {
  const n = pts.length;
  if (n === 1) return [pts[0].slice()];
  if (n === 2) {
    const d = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), m = Math.max(2, Math.ceil(d / step));
    const o = []; for (let i = 0; i <= m; i++) { const t = i / m; o.push([pts[0][0] + (pts[1][0] - pts[0][0]) * t, pts[0][1] + (pts[1][1] - pts[0][1]) * t]); }
    return o;
  }
  const P = [pts[0].map((v, i) => 2 * v - pts[1][i]), ...pts, pts[n - 1].map((v, i) => 2 * v - pts[n - 2][i])];
  const out = [];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
    const seg = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), m = Math.max(1, Math.ceil(seg / step));
    for (let k = 0; k < m; k++) {
      const t = k / m, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((c) => 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  out.push(pts[n - 1].slice());
  return out;
}

  // ---------- papers ----------
  const PAPERS = {
    cream: { base: [240, 231, 208], depth: 0.52, fibre: 0.55, tone: 2.6 },
    graph: { base: [241, 245, 241], depth: 0.45, fibre: 0.45, tone: 2.0, grid: true },
    navy:  { base: [25, 37, 68],    depth: 0.55, fibre: 0.55, tone: 2.6 },
  };

function boxH(src, dst, W, H, r) {
  const k = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++) {
    const o = y * W; let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[o + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) {
      dst[o + x] = acc * k;
      acc += src[o + Math.min(W - 1, x + r + 1)] - src[o + Math.max(0, x - r)];
    }
  }
}
function boxV(src, dst, W, H, r) {
  const k = 1 / (2 * r + 1);
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += src[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      dst[y * W + x] = acc * k;
      acc += src[Math.min(H - 1, y + r + 1) * W + x] - src[Math.max(0, y - r) * W + x];
    }
  }
}
function stats(f) {
  const n = f.length; let m = 0; for (let i = 0; i < n; i += 7) m += f[i]; m /= Math.ceil(n / 7);
  let v = 0; for (let i = 0; i < n; i += 7) v += (f[i] - m) * (f[i] - m); v = Math.sqrt(v / Math.ceil(n / 7));
  return [m, v || 1];
}
// smooth value-noise upsampled from a coarse grid (cell px), unit-ish std, added into out * amp
function coarseInto(out, W, H, cell, amp, R) {
  const gw = Math.ceil(W / cell) + 3, gh = Math.ceil(H / cell) + 3;
  const g = new Float32Array(gw * gh); for (let i = 0; i < g.length; i++) g[i] = R() * 2 - 1;
  const inv = 1 / cell;
  for (let y = 0; y < H; y++) {
    const fy = y * inv, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < W; x++) {
      const fx = x * inv, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx);
      const a = g[y0 * gw + x0], b = g[y0 * gw + x0 + 1], c = g[(y0 + 1) * gw + x0], d = g[(y0 + 1) * gw + x0 + 1];
      out[y * W + x] += amp * ((a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy);
    }
  }
}

function resolvePaper(spec) {
  if (!PAPERS[spec]) throw new Error('unknown paper ' + spec);
  return { name: spec, ...PAPERS[spec] };
}

function buildPaper(S, specIn) {
  const spec = resolvePaper(specIn);
  const { W, H, ppm } = S, N = W * H;
  const R = rng(S.seed + ':paper:' + spec.name);
  const t = new Float32Array(N), tmp = new Float32Array(N);
  // fine tooth: white noise, three box passes ≈ σ 1.4 px, slightly anisotropic (longer along x, the machine direction)
  for (let i = 0; i < N; i++) t[i] = R();
  for (let pass = 0; pass < 2; pass++) { boxH(t, tmp, W, H, 1); boxV(tmp, t, W, H, 1); }
  let [m, sd] = stats(t); const kf = 1 / sd; for (let i = 0; i < N; i++) t[i] = (t[i] - m) * kf * 0.62;
  // pulp bands
  const cellA = Math.max(3, Math.round(0.5 * ppm)), cellB = Math.max(8, Math.round(2.6 * ppm)), cellC = Math.round(9 * ppm);
  coarseInto(t, W, H, cellA, 0.42, R);
  coarseInto(t, W, H, cellB, 0.30, R);
  coarseInto(t, W, H, cellC, 0.16, R);
  // fibres
  const area = S.w * S.h, nFib = Math.round(area * 0.75 * spec.fibre), main = R() * 0.5 - 0.25;
  const fibre = (x, y, a, len, da, amp) => {
    const steps = Math.max(2, Math.ceil(len * ppm * 1.4)), dx = 0.7, ca = Math.cos, sa = Math.sin;
    for (let s = 0; s < steps; s++) {
      const q = s / steps, env = Math.sin(Math.PI * q) ** 0.6 * amp;
      const xi = Math.floor(x), yi = Math.floor(y);
      if (xi >= 0 && yi >= 0 && xi < W - 1 && yi < H - 1) {
        const fx = x - xi, fy = y - yi, i = yi * W + xi;
        t[i] += env * (1 - fx) * (1 - fy); t[i + 1] += env * fx * (1 - fy); t[i + W] += env * (1 - fx) * fy; t[i + W + 1] += env * fx * fy;
      }
      x += ca(a) * dx; y += sa(a) * dx; a += da;
    }
  };
  for (let k = 0; k < nFib; k++) {
    const raised = R() < 0.62;
    const len = Math.exp(R.gauss(Math.log(1.6), 0.55));
    const a = main + R.gauss(0, 0.75) + (R() < 0.15 ? (R() - 0.5) * 3 : 0);
    fibre(R() * W, R() * H, a, Math.min(9, len), R.gauss(0, 0.05), (raised ? 1 : -0.8) * (0.55 + R() * 0.6));
  }
  // a few long dark channels / creases in the sheet: very shallow
  const nCh = Math.round(area / 9000 * spec.fibre);
  for (let k = 0; k < nCh; k++) fibre(R() * W, R() * H, main + R.gauss(0, 0.4), 6 + R() * 12, R.gauss(0, 0.012), -0.5 * (0.5 + R()));
  [m, sd] = stats(t);
  const kk = 0.21 / sd; // std 0.21 around 0.5
  for (let i = 0; i < N; i++) { const v = 0.5 + (t[i] - m) * kk; t[i] = v < 0 ? 0 : v > 1 ? 1 : v; }

  // ---- tone (near flat): base + pulp mottle + tooth catching the light a hair
  const rgb = new Float32Array(N * 3);
  const mot = new Float32Array(N);
  coarseInto(mot, W, H, Math.round(45 * ppm), 0.55, R); coarseInto(mot, W, H, Math.round(11 * ppm), 0.5, R);
  const lum = (spec.base[0] * 0.3 + spec.base[1] * 0.59 + spec.base[2] * 0.11) / 255;
  const tscale = spec.tone * (0.55 + 0.45 * lum);
  const mscale = (spec.mottle ?? 1.0) * (0.5 + 0.9 * lum);
  for (let i = 0; i < N; i++) {
    const d = (t[i] - 0.5) * tscale + mot[i] * mscale;
    rgb[3 * i] = spec.base[0] + d; rgb[3 * i + 1] = spec.base[1] + d * 0.97; rgb[3 * i + 2] = spec.base[2] + d * 0.92;
  }
  S.tooth = t; S.rgb = rgb; S.depth = spec.depth; S.paperSpec = spec;

  if (spec.grid) printGrid(S, rgb, t, R);
  S.paper0 = new Uint8ClampedArray(N * 3); for (let i = 0; i < N * 3; i++) S.paper0[i] = rgb[i];
  return spec;
}

// printed graph grid: 1 mm hairline, 5 mm medium, 10 mm heavier; machine-perfect, but the ink breaks up on the tooth
function printGrid(S, rgb, t, R) {
  const { W, H, ppm } = S;
  const ink = [188, 214, 212];
  const band = (px, horizontal, width, dens) => {
    const p0 = Math.floor(px - width / 2 - 1), p1 = Math.ceil(px + width / 2 + 1);
    for (let p = p0; p <= p1; p++) {
      const cov = Math.max(0, Math.min(1, width / 2 + 0.5 - Math.abs(p + 0.5 - px)));
      if (cov <= 0) continue;
      const lim = horizontal ? H : W, len = horizontal ? W : H;
      if (p < 0 || p >= lim) continue;
      for (let q = 0; q < len; q++) {
        const i = horizontal ? p * W + q : q * W + p;
        const a = cov * dens * (0.55 + 0.9 * t[i]);
        const j = 3 * i; rgb[j] += (ink[0] - rgb[j]) * a; rgb[j + 1] += (ink[1] - rgb[j + 1]) * a; rgb[j + 2] += (ink[2] - rgb[j + 2]) * a;
      }
    }
  };
  const ox = ((S.w % 5) / 2), oy = ((S.h % 5) / 2); // printed grid does not start exactly at the trim
  for (let mm = 0, k = 0; mm * ppm < W; mm += 1, k++) { const x = (mm + ox) * ppm; band(x, false, k % 5 === 0 ? 0.24 * ppm : 0.11 * ppm, k % 5 === 0 ? 0.55 : 0.26); }
  for (let mm = 0, k = 0; mm * ppm < H; mm += 1, k++) { const y = (mm + oy) * ppm; band(y, true, k % 5 === 0 ? 0.24 * ppm : 0.11 * ppm, k % 5 === 0 ? 0.55 : 0.26); }
}

  Object.assign(K, { TAU, clamp, lerp, smooth, hashStr, rng, wander, hexToRgb, catmull, buildPaper, PAPERS });
})();
