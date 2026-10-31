/* viz-os sketch pens: pencil, ballpoint, fineliner, gel and marker as per-pixel deposit on paper.
   Free marks wobble like a hand. Exact marks (T.exact, T.exactDot) keep the ink but sit at their scaled position.
   Units are millimetres, origin top-left, y down.
   Ported from statechart-art tools/kit (media, hand, raster, index, shapes) by Kevin T. Ngo, MIT, see NOTICE. */
(function () {
  'use strict';
  const K = window.VizOS.sketch;
  const { TAU, clamp, smooth, rng, wander, hexToRgb, catmull, buildPaper } = K;

  // ---------- what each tool does ----------
const NAMED = {
  blue: [24, 52, 150], black: [24, 24, 28], red: [200, 42, 36], white: [246, 245, 238], gold: [204, 168, 84], silver: [200, 204, 210],
  green: [40, 128, 76], orange: [238, 128, 30], yellow: [244, 206, 60], grey: [110, 112, 112], cyan: [30, 150, 190],
};
const col = (c, dflt) => (c === undefined ? dflt : NAMED[c] ? NAMED[c] : hexToRgb(c));
// absorbance for a translucent ink: transmittance = colour / 255 (floored)
const absorb = (c, strength = 1) => c.map((v) => -Math.log(Math.max(0.035, v / 255)) * strength);

const GRADES = {
  HB: { r0: 0.17, opac: 0.74, col: [78, 78, 84], reachB: 0.30, reachK: 0.90, sheen: 0.20, fillRate: 38 },
  '2B': { r0: 0.20, opac: 0.84, col: [62, 62, 68], reachB: 0.32, reachK: 0.92, sheen: 0.22, fillRate: 44 },
  '4B': { r0: 0.26, opac: 0.92, col: [46, 46, 52], reachB: 0.34, reachK: 0.94, sheen: 0.24, fillRate: 52 },
  '6B': { r0: 0.32, opac: 0.97, col: [36, 36, 42], reachB: 0.36, reachK: 0.96, sheen: 0.26, fillRate: 60 },
};

// Contact model for dry media: the paper's height h (0 pit .. 1 crest) against how far the tip reaches into the tooth.
// Light pressure touches only the crests (grain shows); pressure fills the valleys. `film` is a smooth underlayer that
// does not depend on the tooth (graphite smears a little); `ft` is how much of that film still notices the tooth.
function contactAmount(P) {
  const { reachB, reachK, edgeReach, soft, film = 0, ft = 1, dep = 1 } = P;
  return (p, d, r, v, s, h, fl) => {
    let cov = r + 0.5 - d; if (cov <= 0) return 0; if (cov > 1) cov = 1;
    const q = d / r, rch = (reachB + reachK * p) * (1 - edgeReach * (q > 1 ? 1 : q * q));
    let c = (h - (1 - rch)) / soft + 0.5; c = c < 0 ? 0 : c > 1 ? 1 : c;
    if (film) { let tt = rch > 0.02 ? (1 - ft) + ft * (h > 0.85 ? 1 : h * 1.18) : 0; tt = tt > 1 ? 1 : tt; c = film * tt + (1 - film) * c; }
    return cov * c * dep * fl;
  };
}
const normLane = (n, R, lamMin, lamMax, nw, step) => { const a = new Float32Array(n); const w = wander(R, lamMin, lamMax, nw); let m = 1e-6; for (let i = 0; i < n; i++) { a[i] = w(i * step); m = Math.max(m, Math.abs(a[i])); } for (let i = 0; i < n; i++) a[i] /= m; return a; };

function make(S, kind, o = {}) {
  const depth = S.depth;
  const M = { kind, mode: 'sweep', p0: 0.5, rp0: 0.85, rp1: 0.3, smooth: 0.35, tremor: 1, dry: false, flowKind: 'none', wearRate: 0, sheen: 0, fillRate: 0, opac: 1, opts: o };
  switch (kind) {
    case 'graphite': {
      const g = GRADES[o.grade || 'HB'] || GRADES.HB;
      Object.assign(M, { comp: 0, dry: true, r0: g.r0, opac: g.opac, col: g.col, sheen: g.sheen, sheenCol: [128, 132, 142], fillRate: g.fillRate, fillCap: 0.84, wearRate: 0.00035, p0: 0.45, rp0: 0.72, rp1: 0.55, tremor: 1.0 });
      M.amount = contactAmount({ reachB: g.reachB, reachK: g.reachK, edgeReach: 0.32, soft: 0.4, film: 0.34, ft: 0.9 });
      if (o.side) { M.mode = 'stamp'; M.nibW = o.sideWidth || 5.5; M.nibH = 0.9; M.r0 = g.r0; M.p0 = 0.32; M.opac *= 0.8; M.wick = 1.8; M.amount = contactAmount({ reachB: 0.05, reachK: 1.15, edgeReach: 0.5, soft: 0.3, film: 0.28, ft: 0.9 }); }
      break;
    }
    case 'pencil': case 'colerase': case 'pastelpencil': {
      const isCE = kind === 'colerase', isPP = kind === 'pastelpencil';
      const c = col(o.color, isCE ? [60, 110, 200] : [60, 60, 60]);
      const point = o.point === 'blunt' ? 1.6 : 1;
      const lighten = (k) => c.map((v) => Math.min(255, v + (255 - v) * k));
      Object.assign(M, { comp: isPP ? 2 : 0, dry: true, r0: (isCE ? 0.3 : isPP ? 0.45 : 0.22) * point, opac: isPP ? 0.92 : isCE ? 0.66 : 0.86, col: c, fillRate: isPP ? 50 : isCE ? 26 : 30, fillCap: isPP ? 0.7 : 0.58, sheen: isPP ? 0 : 0.14, sheenCol: lighten(0.38), wearRate: 0.0004, p0: 0.5, rp0: 0.75, rp1: 0.5 });
      M.amount = contactAmount(isPP ? { reachB: 0.08, reachK: 1.0, edgeReach: 0.6, soft: 0.28, film: 0.2, ft: 0.8 } : isCE ? { reachB: 0.24, reachK: 0.95, edgeReach: 0.5, soft: 0.3, film: 0.22, ft: 0.8 } : { reachB: 0.28, reachK: 0.95, edgeReach: 0.45, soft: 0.3, film: 0.3, ft: 0.8 });
      if (o.side) { M.mode = 'stamp'; M.nibW = o.sideWidth || 4.4; M.nibH = 1.1; M.p0 = 0.34; M.wick = 1.8; M.amount = contactAmount({ reachB: 0.05, reachK: 1.1, edgeReach: 0.55, soft: 0.3, film: 0.25, ft: 0.9 }); }
      break;
    }
    case 'ballpoint': {
      const c = col(o.color, NAMED.blue);
      Object.assign(M, { comp: 1, r0: 0.18, k: absorb(c, 1.0), p0: 0.55, rp0: 0.9, rp1: 0.22, smooth: 0.3, tremor: 0.9, flowKind: 'ballpoint', pvar: 0.4 });
      M.amount = (p, d, r, v, s, h, fl) => {
        const cv = r + 0.5 - d + (h - 0.5) * 0.9; if (cv <= 0) return 0;
        const q = d / r;
        let a = (cv > 1 ? 1 : cv) * fl * (0.22 + 0.98 * p) * (0.86 + 0.24 * q * q);
        a *= 1 - 0.5 * Math.max(0, 0.62 - p) * (1 - h) * 1.6;
        return a;
      };
      break;
    }
    case 'fineliner': {
      const c = col(o.color, NAMED.black); const nib = o.nib || 0.3;
      Object.assign(M, { comp: 1, r0: nib / 2, k: absorb(c, 1.05), p0: 0.6, rp0: 0.97, rp1: 0.06, smooth: 0.25, tremor: 0.7, flowKind: o.kind === 'technical' ? 'technical' : 'felt', swell: true });
      const soft = o.kind === 'technical' ? 0.6 : 1.5;
      M.pvar = 0.06;
      M.amount = (p, d, r, v, s, h, fl) => {
        const cv = (r + soft * 0.62 - d + (h - 0.5) * (o.kind === 'technical' ? 0.85 : 1.9)) / soft; if (cv <= 0) return 0;
        return (cv > 1 ? 1 : cv) * fl * (0.86 + 0.14 * p) * (1 - 0.1 * (1 - h) * (1 - p));
      };
      break;
    }
    case 'gel': {
      const c = col(o.color, NAMED.white); const nib = o.nib || 0.7;
      Object.assign(M, { comp: 2, r0: nib / 2, col: c, opac: 0.985, p0: 0.6, rp0: 0.95, rp1: 0.1, smooth: 0.3, tremor: 0.8, flowKind: 'gel', pvar: 0.2, fillRate: 0 });
      const lane = normLane(512, rng('gel:' + (o.color || '') + nib), 1.5, 40, 4, 0.1);
      M.lane = lane; M.laneShift = 0;
      // opaque gel: solid where the ball rolled, a hair of the paper's pits left dry at the rim and where the flow thins; the edge is
      // a fraction dimmer on one side where the bead dries lower
      M.amount = (p, d, r, v, s, h, fl) => {
        let cv = r + 0.5 - d + (h - 0.5) * 0.7; if (cv <= 0) return 0; cv = cv > 1 ? 1 : cv;
        const q = d / r, reach = 1.02 - 0.28 * q * q - 0.35 * Math.max(0, 0.55 - p);
        let c = (h - (1 - reach)) / 0.1 + 0.5; c = c < 0 ? 0 : c > 1 ? 1 : c;
        const ln = lane[((((v * 0.5 + 0.5) * 60 + M.laneShift + s * 0.03) | 0) % 512 + 512) % 512];
        const side = 1 - 0.07 * (v > 0.35 ? (v - 0.35) / 0.65 : 0);
        return cv * c * (fl > 1 ? 1 : fl) * side * (0.93 + 0.07 * ln) * (0.9 + 0.1 * p);
      };
      break;
    }
    case 'marker': {
      const c = col(o.color, NAMED.black); const tip = o.tip || 'chisel', width = o.width || (tip === 'chisel' ? 4 : 1.2);
      Object.assign(M, { comp: 1, k: absorb(c, (c[0] + c[1] + c[2]) < 160 ? 1.5 : 1.0), p0: 0.6, smooth: 0.5, tremor: 1.1, flowKind: 'marker', lanes: true });
      if (tip === 'chisel') { M.mode = 'stamp'; M.nibW = width; M.nibH = Math.max(0.5, width * 0.17); M.nibAng = (o.angle ?? 40) * Math.PI / 180; M.r0 = width / 2; M.rp0 = 1; M.rp1 = 0; M.wick = 2.4; M.nibRot = 0.05; }
      else { M.r0 = width / 2; M.rp0 = 0.95; M.rp1 = 0.1; }
      const Rl = rng('lane:' + (o.color || '') + width);
      const laneC = normLane(512, Rl, 2, 60, 5, 0.12), laneF = normLane(512, Rl, 0.4, 5, 4, 0.05);
      M.lane = laneC; M.laneShift = 0;
      // felt marker: streak lanes (coarse + fine) along the stroke, wet rim darker at both edges, ends pool, fast or starved strokes
      // leave dry lanes, edges bleed a little along the fibres
      M.amount = (p, d, r, v, s, h, fl, i, wv) => {
        const av = v < 0 ? -v : v; if (av > 1.04) return 0;
        const idx = ((v * 0.5 + 0.5) * 300 + M.laneShift + s * 0.04) | 0, m = ((idx % 512) + 512) % 512;
        const lc = laneC[m], lf = laneF[(m * 3 + (M.laneShift >> 2)) % 512];
        const rim = 1 + 0.42 * smooth(0.6, 1.0, av);
        const L = M.L || 1e9;
        const ends = 1 + 0.42 * Math.exp(-s / 10) + 0.55 * Math.exp(-(L - s) / 8);
        const speed = 0.8 + 0.2 * p;
        const starve = smooth(0.25, 0.85, -lf * (0.45 + 2.6 * (1 - fl)) - 0.3 + 0.35 * (1 - p));
        let a = 0.7 * (0.82 + 0.3 * lc + 0.14 * lf) * rim * ends * speed * fl * (1 - 0.8 * starve);
        a *= 1 - 0.28 * (1 - h) * (1 - p);
        if (av > 0.9) a *= 0.84 + 0.32 * h > 1 ? 1 : 0.84 + 0.32 * h; // bleeding edge follows the fibres
        return a;
      };
      break;
    }
    default: throw new Error('unknown tool kind ' + kind);
  }
  M.rp = (p) => M.rp0 + M.rp1 * p;
  return M;
}

  // ---------- what the hand does ----------
function resampleMM(pts, ds) {
  if (pts.length < 2) return pts;
  const out = [pts[0].slice()]; let need = ds;
  for (let i = 1; i < pts.length; i++) {
    let x0 = pts[i - 1][0], y0 = pts[i - 1][1]; const x1 = pts[i][0], y1 = pts[i][1]; let d = Math.hypot(x1 - x0, y1 - y0);
    while (d >= need && d > 0) { const t = need / d; x0 += (x1 - x0) * t; y0 += (y1 - y0) * t; out.push([x0, y0]); d = Math.hypot(x1 - x0, y1 - y0); need = ds; }
    need -= d;
  }
  const l = pts[pts.length - 1], e = out[out.length - 1];
  if (Math.hypot(l[0] - e[0], l[1] - e[1]) > ds * 0.3) out.push(l.slice());
  return out;
}

// exact pens: straight runs between the given points, every given point kept
function straight(pts, ds) {
  const out = [pts[0].slice()];
  for (let i = 1; i < pts.length; i++) out.push(...catmull([pts[i - 1], pts[i]], ds).slice(1));
  return out;
}

function follow(tgt, L, ds, zeta) {
  const m = tgt.length; if (m < 3 || L <= 0) return tgt;
  const w = Math.min(0.5, ds / L), k = w * w, c = 2 * zeta * w, lag = Math.max(0, Math.round(2 * zeta / w));
  let x = tgt[0][0], y = tgt[0][1];
  let vx = (tgt[1][0] - tgt[0][0]), vy = (tgt[1][1] - tgt[0][1]);
  const out = [[x, y]]; const total = m - 1 + lag + Math.round(0.35 / w);
  for (let i = 1; i <= total; i++) {
    const tar = tgt[Math.min(m - 1, i + lag - 1 > m - 1 ? m - 1 : i + lag - 1)];
    vx += k * (tar[0] - x) - c * vx; vy += k * (tar[1] - y) - c * vy;
    x += vx; y += vy; out.push([x, y]);
  }
  return out;
}

function ramp(x, len) { return len <= 0 ? 1 : smooth(0, len, x); }

function profileAt(kind, sMm, Lmm, nt0, nt1) {
  switch (kind) {
    case 'taper': { const a = Math.min(4, 0.3 * Lmm), b = Math.min(8, 0.5 * Lmm); return 0.12 + 0.88 * Math.min(ramp(sMm, a), ramp(Lmm - sMm, b)); }
    case 'hatch': { const a = nt0 ? 0 : Math.min(2, 0.25 * Lmm), b = nt1 ? 0 : Math.min(5, 0.4 * Lmm); return 0.24 + 0.76 * Math.min(ramp(sMm, a), ramp(Lmm - sMm, b)); }
    case 'swell': { const q = sMm / Lmm; return 0.25 + 0.75 * Math.sin(Math.PI * q) ** 0.7; }
    case 'flick': { const b = Lmm * 0.9; return 0.06 + 0.94 * Math.min(ramp(sMm, 0.4), ramp(Lmm - sMm, b)); }
    case 'rise': { const a = Lmm * 0.85; return 0.15 + 0.85 * Math.min(ramp(sMm, a), ramp(Lmm - sMm, 0.4)); }
    default: return 0.55 + 0.45 * Math.min(ramp(sMm, 0.5), ramp(Lmm - sMm, 0.6));
  }
}

const SPEED = { slow: { p: 1.06, drop: 0.25, trem: 1.25 }, normal: { p: 1, drop: 1, trem: 1 }, fast: { p: 0.86, drop: 4.2, trem: 0.8 } };

function buildPath(S, T, pts, o = {}) {
  const M = T.med, R = S.R, ppm = S.ppm;
  const sp = SPEED[o.speed || 'normal'];
  const smoothL = o.smooth ?? M.smooth;
  const ds = Math.max(0.05, Math.min(0.25, smoothL / 5));
  let tgt = pts.length === 1 ? [pts[0].slice(), [pts[0][0] + 0.01, pts[0][1]]] : o.exact ? straight(pts, ds) : resampleMM(catmull(pts, ds), ds);
  if (tgt.length < 2) tgt = [tgt[0], [tgt[0][0] + 0.02, tgt[0][1]]];
  if (!o.exact) tgt = follow(tgt, smoothL, ds, 0.72);
  // arc length (mm)
  const m0 = tgt.length, cum = new Float32Array(m0); for (let i = 1; i < m0; i++) cum[i] = cum[i - 1] + Math.hypot(tgt[i][0] - tgt[i - 1][0], tgt[i][1] - tgt[i - 1][1]);
  const Lmm = cum[m0 - 1] || 0.001;
  // wander offsets: bow (low frequency) + tremor (mid/high)
  const trem = (o.tremor ?? 1) * M.tremor * sp.trem * (T.tremorMul || 1);
  const wBow = wander(R, Math.max(6, Lmm * 0.9), Math.max(20, Lmm * 3.5), 2), wMid = wander(R, 2.5, 14, 3), wHi = wander(R, 0.5, 2.6, 3);
  const bowAmp = Math.min(1.6, Lmm * 0.0042) * trem * (o.bow ?? 1), midAmp = 0.07 * trem, hiAmp = 0.02 * trem;
  const nodes = [];
  // nodes at px spacing
  const rmeanPx = M.r0 * ppm;
  const stepPx = M.mode === 'stamp' || o.exact ? 1.0 : clamp(0.7 * rmeanPx, 1.1, 4.5);
  const stepMm = stepPx / ppm;
  let ni = 1, sMm = 0;
  const pos = (i, j, u) => [tgt[i][0] + (tgt[j][0] - tgt[i][0]) * u, tgt[i][1] + (tgt[j][1] - tgt[i][1]) * u];
  const nCount = Math.max(2, Math.floor(Lmm / stepMm) + 1);
  const xs = new Float32Array(nCount + 1), ys = new Float32Array(nCount + 1), ss = new Float32Array(nCount + 1);
  let cnt = 0, seg = 0;
  for (let q = 0; q <= nCount; q++) {
    const target = Math.min(Lmm, q * stepMm);
    while (seg < m0 - 2 && cum[seg + 1] < target) seg++;
    const span = cum[seg + 1] - cum[seg] || 1e-6, u = clamp((target - cum[seg]) / span);
    const p = pos(seg, seg + 1, u);
    // direction for normal offset
    const a = tgt[Math.max(0, seg - 1)], b = tgt[Math.min(m0 - 1, seg + 2)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const off = o.exact ? 0 : bowAmp * wBow(target) + midAmp * wMid(target) + hiAmp * wHi(target);
    xs[cnt] = (p[0] - dy * off) * ppm; ys[cnt] = (p[1] + dx * off) * ppm; ss[cnt] = target * ppm; cnt++;
    if (target >= Lmm) break;
  }
  const n = cnt;
  const P = { n, x: xs.subarray(0, n), y: ys.subarray(0, n), s: ss.subarray(0, n), r: new Float32Array(n), p: new Float32Array(n), flow: new Float32Array(n), Lpx: Lmm * ppm, Lmm, ang0: 0, angMean: 0 };
  P.angMean = Math.atan2(tgt[m0 - 1][1] - tgt[0][1], tgt[m0 - 1][0] - tgt[0][0]);
  // pressure, radius, flow along the stroke
  const prof = o.profile || M.defProfile || 'even';
  const pBase = (o.pressure ?? M.p0) * sp.p * T.pbias;
  const wP = wander(R, 5, 40, 3), wR = wander(R, 1.5, 12, 3);
  const flowFn = makeFlow(S, T, M, Lmm, o, sp);
  const wearMul = 1 + T.wear;
  for (let i = 0; i < n; i++) {
    const s = ss[i] / ppm;
    let p = pBase * profileAt(prof, s, Lmm, o.joinStart, o.joinEnd) * (1 + (M.pvar ?? 0.16) * (o.pwalk ?? 1) * wP(s)); p = clamp(p, 0.02, 1);
    P.p[i] = p;
    let r = M.r0 * wearMul * M.rp(p) * (1 + 0.045 * wR(s)) * T.wmul * (o.wmul ?? 1);
    const f = flowFn(s);
    if (M.swell) r *= 1 + 0.28 * Math.exp(-s / 0.45) + (T.blobEnd ? 0.25 * Math.exp(-(Lmm - s) / 0.4) : 0);
    r *= f.rmul;
    P.r[i] = Math.max(0.55, r * ppm); P.flow[i] = f.flow;
  }
  T.wear += M.wearRate * Lmm * 0.5; // point wears with use
  T.drawn += Lmm;
  return P;
}

// ink flow along a stroke: returns s(mm) -> {flow, rmul}
function makeFlow(S, T, M, Lmm, o, sp) {
  const R = S.R;
  const k = M.flowKind;
  if (k === 'none') return () => ({ flow: 1, rmul: 1 });
  if (k === 'felt' || k === 'technical') {
    const w = wander(R, 3, 30, 3), tech = k === 'technical';
    return (s) => ({ flow: clamp(1 + (tech ? 0.02 : 0.05) * w(s), 0.85, 1.05), rmul: 1 + (tech ? 0.012 : 0.04) * w(s * 1.7 + 9) });
  }
  if (k === 'marker') {
    const w = wander(R, 8, 50, 3), fast = (o.speed === 'fast') ? 0.16 : 0;
    return (s) => ({ flow: clamp(0.93 + 0.13 * w(s) - fast, 0.45, 1.06), rmul: 1 });
  }
  // ballpoint and gel: dropouts, start skip, surges, blobs
  const gel = k === 'gel';
  const rate = (gel ? 0.035 : 0.055) * sp.drop * (o.skips ?? 1) * (1 + 1.6 * Math.max(0, 0.55 - (o.pressure ?? M.p0)));
  const drops = []; { let x = -Math.log(1 - R()) / rate * 0.6; while (x < Lmm) { const len = (gel ? 0.2 + R() * 0.7 : 0.1 + R() * 0.6) * (sp.drop > 2 ? 1.8 : 1); drops.push([x, x + len, R() * (gel ? 0.35 : 0.3)]); x += len + -Math.log(1 - R()) / rate; } }
  const startSkip = R() < (gel ? 0.32 : 0.36) * (o.skips ?? 1) ? [0.15 + R() * (gel ? 0.9 : 0.55)] : null;
  const blobStart = R() < (o.blob ?? (gel ? 0.2 : 0.32) * (Lmm < 6 ? 1.7 : 1)); const blobEnd = R() < (o.blob ?? 0.14) * 0.6;
  T.blobEnd = false;
  const base = clamp(T.flow, 0.6, 1.05);
  const wF = wander(R, 2.2, 26, 4);
  return (s) => {
    let f = base * (1 + (gel ? 0.10 : 0.16) * wF(s)), rm = 1;
    for (const d of drops) {
      if (s > d[0] - 0.12 && s < d[1] + 0.35) {
        const inside = smooth(d[0] - 0.12, d[0] + 0.05, s) * (1 - smooth(d[1] - 0.05, d[1] + 0.1, s));
        f = f * (1 - inside * (1 - d[2]));
        if (s > d[1] + 0.05) f *= 1 + 0.16 * Math.exp(-(s - d[1]) / 0.35); // ink surge after the skip
      }
    }
    if (startSkip) { const q = smooth(0, startSkip[0], s); f *= 0.2 + 0.8 * q; }
    if (blobStart) { const b = Math.exp(-s / (gel ? 0.22 : 0.2)); rm *= 1 + (gel ? 0.24 : 0.4) * b; f *= 1 + 0.35 * b; }
    if (blobEnd) { const b = Math.exp(-(Lmm - s) / 0.18); rm *= 1 + 0.35 * b; f *= 1 + 0.3 * b; }
    return { flow: clamp(f, 0, 1.45), rmul: rm };
  };
}

  // ---------- ink onto paper ----------
function compose(S, med, x0, y0, x1, y1) {
  const { W, cov, rgb, fill } = S;
  const mode = med.comp;
  for (let y = y0; y <= y1; y++) {
    let i = y * W + x0;
    for (let x = x0; x <= x1; x++, i++) {
      const c = cov[i]; if (c <= 0) continue; cov[i] = 0;
      const j = 3 * i;
      if (mode === 0) { // dry pigment: lerp toward pigment colour; heavy build-up cools and lightens (graphite sheen)
        const f = fill[i], al = c * med.opac;
        let cr = med.col[0], cg = med.col[1], cb = med.col[2];
        if (med.sheen) { const b = Math.min(1, f / 255) * med.sheen; cr += (med.sheenCol[0] - cr) * b; cg += (med.sheenCol[1] - cg) * b; cb += (med.sheenCol[2] - cb) * b; }
        rgb[j] += (cr - rgb[j]) * al; rgb[j + 1] += (cg - rgb[j + 1]) * al; rgb[j + 2] += (cb - rgb[j + 2]) * al;
        const nf = f + c * med.fillRate; fill[i] = nf > 255 ? 255 : nf;
      } else if (mode === 1) { // translucent ink: Beer-Lambert, layers deepen
        rgb[j] *= Math.exp(-med.k[0] * c); rgb[j + 1] *= Math.exp(-med.k[1] * c); rgb[j + 2] *= Math.exp(-med.k[2] * c);
      } else { // opaque (gel, pastel, crayon): lerp; also fills the tooth
        const f = fill[i], al = c * med.opac;
        rgb[j] += (med.col[0] - rgb[j]) * al; rgb[j + 1] += (med.col[1] - rgb[j + 1]) * al; rgb[j + 2] += (med.col[2] - rgb[j + 2]) * al;
        if (med.fillRate) { const nf = f + c * med.fillRate; fill[i] = nf > 255 ? 255 : nf; }
      }
    }
  }
}

// round-tip sweep along nodes P {n,x,y,r,p,s,flow} (px)
function sweep(S, P, med) {
  const { W, H, tooth, fill, cov } = S;
  const n = P.n, X = P.x, Y = P.y, RR = P.r, PP = P.p, SS = P.s, FL = P.flow, amount = med.amount, dry = med.dry, cap = med.fillCap ?? 0.84;
  let bx0 = W, by0 = H, bx1 = -1, by1 = -1;
  const segs = n === 1 ? 1 : n - 1;
  for (let k = 0; k < segs; k++) {
    const k1 = n === 1 ? 0 : k + 1;
    const ax = X[k], ay = Y[k], bx = X[k1], by = Y[k1], ra = RR[k], rb = RR[k1];
    const rmax = Math.max(ra, rb) + 1.5;
    const xa = Math.max(0, Math.floor(Math.min(ax, bx) - rmax)), xb = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + rmax));
    const ya = Math.max(0, Math.floor(Math.min(ay, by) - rmax)), yb = Math.min(H - 1, Math.ceil(Math.max(ay, by) + rmax));
    if (xa > xb || ya > yb) continue;
    if (xa < bx0) bx0 = xa; if (xb > bx1) bx1 = xb; if (ya < by0) by0 = ya; if (yb > by1) by1 = yb;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, il2 = l2 > 0 ? 1 / l2 : 0, il = Math.sqrt(il2);
    const pa = PP[k], pb = PP[k1], sa = SS[k], sb = SS[k1], fa = FL[k], fb = FL[k1];
    for (let y = ya; y <= yb; y++) {
      const py = y + 0.5 - ay; let i = y * W + xa;
      for (let x = xa; x <= xb; x++, i++) {
        const px = x + 0.5 - ax;
        let t = (px * dx + py * dy) * il2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = px - t * dx, cy = py - t * dy;
        const d = Math.sqrt(cx * cx + cy * cy), r = ra + (rb - ra) * t;
        if (d > r + 1) continue;
        let h = tooth[i]; if (dry) { const f = fill[i] * 0.0033; h = h + (1 - h) * (f > cap ? cap : f); }
        const v = (dx * cy - dy * cx) * il >= 0 ? d / r : -d / r;
        const a = amount(pa + (pb - pa) * t, d, r, v, sa + (sb - sa) * t, h, fa + (fb - fa) * t, i);
        if (a > cov[i]) cov[i] = a;
      }
    }
  }
  if (bx1 >= 0) compose(S, med, bx0, by0, bx1, by1);
}

// chisel / broad nib stamped along nodes: nib is a rectangle halfW × halfH rotated by `ang` (fixed to the page)
function stamp(S, P, med, nib) {
  const { W, H, tooth, fill, cov } = S;
  const n = P.n, X = P.x, Y = P.y, PP = P.p, SS = P.s, FL = P.flow, amount = med.amount, dry = med.dry, cap = med.fillCap ?? 0.84;
  const hw = nib.hw, hh = nib.hh, rotK = nib.rot || 0, wick = nib.wick ?? 1.4;
  const ext = Math.hypot(hw, hh) + 1.5, exty = ext;
  let bx0 = W, by0 = H, bx1 = -1, by1 = -1;
  for (let k = 0; k < n; k++) {
    const cx = X[k], cy = Y[k], p = PP[k], s = SS[k], fl = FL[k];
    const an = nib.ang + (n > 1 ? rotK * (k / (n - 1) - 0.5) : 0), ca = Math.cos(an), sa = Math.sin(an);
    const xa = Math.max(0, Math.floor(cx - ext)), xb = Math.min(W - 1, Math.ceil(cx + ext));
    const ya = Math.max(0, Math.floor(cy - exty)), yb = Math.min(H - 1, Math.ceil(cy + exty));
    if (xa > xb || ya > yb) continue;
    if (xa < bx0) bx0 = xa; if (xb > bx1) bx1 = xb; if (ya < by0) by0 = ya; if (yb > by1) by1 = yb;
    for (let y = ya; y <= yb; y++) {
      const py = y + 0.5 - cy; let i = y * W + xa;
      for (let x = xa; x <= xb; x++, i++) {
        const px = x + 0.5 - cx;
        const u = px * ca + py * sa, w = -px * sa + py * ca; // u across the nib width, w across its thickness
        const hj = (tooth[i] - 0.5) * wick, cu = hw + 0.5 - Math.abs(u) + hj, cw = hh + 0.5 - Math.abs(w) + hj * 0.5;
        if (cu <= 0 || cw <= 0) continue;
        const cover = (cu > 1 ? 1 : cu) * (cw > 1 ? 1 : cw);
        let h = tooth[i]; if (dry) { const f = fill[i] * 0.0033; h = h + (1 - h) * (f > cap ? cap : f); }
        const a = amount(p, Math.abs(u), hw, u / hw, s, h, fl, i, w / hh) * cover;
        if (a > cov[i]) cov[i] = a;
      }
    }
  }
  if (bx1 >= 0) compose(S, med, bx0, by0, bx1, by1);
}

  // ---------- tools ----------
const DEF_PROFILE = { graphite: 'taper', pencil: 'taper', colerase: 'taper', pastelpencil: 'taper', crayon: 'taper', ballpoint: 'even', fineliner: 'even', gel: 'even', marker: 'even' };
const deg = (d) => d * Math.PI / 180;

function makeNoise(seed) {
  const R = rng('noise:' + seed), p = new Uint8Array(512), perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i; for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const G = []; for (let i = 0; i < 16; i++) G.push([Math.cos(i / 16 * TAU), Math.sin(i / 16 * TAU)]);
  const f = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const n2 = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
    const g = (a, b, dx, dy) => { const v = G[p[p[a] + b] & 15]; return v[0] * dx + v[1] * dy; };
    const u = f(xf), v = f(yf);
    const a = g(X, Y, xf, yf), b = g(X + 1, Y, xf - 1, yf), c = g(X, Y + 1, xf, yf - 1), d = g(X + 1, Y + 1, xf - 1, yf - 1);
    return (a + (b - a) * u + ((c + (d - c) * u) - (a + (b - a) * u)) * v) * 1.4;
  };
  const fbm2 = (x, y, oct = 4) => { let s = 0, a = 1, fr = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * n2(x * fr, y * fr); n += a; a *= 0.5; fr *= 2; } return s / n; };
  return { n2, fbm2 };
}

class Tool {
  constructor(S, kind, opts) {
    this.S = S; this.kind = kind; this.opts = opts || {};
    this.med = make(S, kind, this.opts); this.med.defProfile = DEF_PROFILE[kind] || 'even';
    this.sharpen();
    this.dirSame = true; this.tremorMul = 1;
  }
  sharpen() { const R = this.S.R; this.wear = 0; this.wmul = 1 + R.gauss(0, 0.035); this.pbias = clamp(1 + R.gauss(0, 0.06), 0.85, 1.15); this.flow = clamp(0.93 + R.gauss(0, 0.04), 0.8, 1.02); this.drawn = 0; }
  reload() { this.sharpen(); }
  _drift() { const R = this.S.R; this.pbias = clamp(this.pbias + R.gauss(0, 0.014) + 0.03 * (1 - this.pbias), 0.8, 1.2); this.flow = clamp(this.flow + R.gauss(0, 0.02) - 0.0004, 0.6, 1.05); this.wmul = clamp(this.wmul + R.gauss(0, 0.008) + 0.05 * (1 - this.wmul), 0.9, 1.12); }
  _paint(P, o = {}) {
    const S = this.S, M = this.med;
    M.L = P.Lpx; M.laneShift = (S.R() * 512) | 0;
    if (M.mode === 'sweep') sweep(S, P, M);
    else {
      const ppm = S.ppm; let hw = M.nibW * 0.5 * ppm, hh = M.nibH * 0.5 * ppm;
      const ang = M.nibAng !== undefined ? M.nibAng + (o.nibJitter ?? S.R.gauss(0, 0.05)) : P.angMean + Math.PI / 2 + S.R.gauss(0, 0.18);
      stamp(S, P, M, { hw, hh, ang, wick: M.wick, rot: (M.nibRot || 0) * (S.R.gauss(0, 1)) });
    }
    this._drift();
  }
  // ---- marks
  stroke(pts, o = {}) {
    if (pts.length < 1) return;
    if (pts.length === 1) return this.dot(pts[0], o);
    const P = buildPath(this.S, this, pts, o); this._paint(P, o); return P;
  }
  line(a, b, o = {}) { return this.stroke([a, b], o); }
  ruled(a, b, o = {}) {
    const S = this.S, R = S.R, len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 0.05) return;
    const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len, nx = -uy, ny = ux;
    const lean0 = R.gauss(0, 0.04), lean1 = R.gauss(0, 0.05);
    const over0 = Math.max(-0.3, R.gauss(0.05, 0.22)), over1 = Math.max(-0.3, R.gauss(0.28, 0.3)) * (o.overshoot ?? 1);
    const A = [a[0] - ux * over0 + nx * lean0, a[1] - uy * over0 + ny * lean0], B = [b[0] + ux * over1 + nx * lean1, b[1] + uy * over1 + ny * lean1];
    const oo = { tremor: 0.3, bow: 0.06, smooth: 0.12, speed: 'normal', ...o };
    const splitP = len > 45 ? Math.min(0.5, 0.12 + len / 800) : 0;
    if (R() < splitP) {
      const t = 0.35 + R() * 0.3, M0 = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t], sh = R.gauss(0, 0.07), ov = 0.6 + R() * 2.2;
      this.stroke([A, [M0[0] + ux * ov * 0.2, M0[1] + uy * ov * 0.2]], oo);
      this.stroke([[M0[0] - ux * ov + nx * sh, M0[1] - uy * ov + ny * sh], B], { ...oo, profile: oo.profile === 'even' || !oo.profile ? 'even' : oo.profile });
    } else this.stroke([A, B], oo);
  }
  poly(pts, closed = false, o = {}) {
    const n = pts.length, R = this.S.R, m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const a = pts[i], b = pts[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
      const e0 = R.gauss(0.05, 0.3), e1 = R.gauss(0.1, 0.32);
      this.stroke([[a[0] - ux * e0, a[1] - uy * e0], [b[0] + ux * e1, b[1] + uy * e1]], o);
    }
  }
  ruledPoly(pts, closed = false, o = {}) {
    const n = pts.length, m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) this.ruled(pts[i], pts[(i + 1) % n], o);
  }
  circle(c, r, o = {}) { return this.ellipse(c, r, r, 0, o); }
  ellipse(c, rx, ry, rot = 0, o = {}) {
    const S = this.S, R = S.R, rmax = Math.max(rx, ry);
    const start = R() * TAU, dir = R() < 0.78 ? -1 : 1;
    const turn = 1 + (o.gap !== undefined ? -o.gap : R.range(-0.025, 0.09)), spiral = R.gauss(0, 0.012) + (o.spiral || 0);
    const wb = wander(R, 0.6, 3.2, 3), sq = 1 + R.gauss(0, 0.02), tilt = R() * Math.PI;
    const n = Math.max(14, Math.ceil(turn * TAU * rmax / 1.8)), pts = [];
    for (let i = 0; i <= n; i++) {
      const q = i / n * turn, th = start + dir * q * TAU;
      const k = 1 + spiral * q + 0.006 * wb(q * TAU * rmax * 0.5) * 2;
      let x = Math.cos(th) * rx * k, y = Math.sin(th) * ry * k;
      // slight egg / squash
      const xe = x * Math.cos(tilt) + y * Math.sin(tilt), ye = -x * Math.sin(tilt) + y * Math.cos(tilt);
      x = xe * sq; y = ye / sq; const xr = x * Math.cos(-tilt) + y * Math.sin(-tilt) - 0, yr = -x * Math.sin(-tilt) + y * Math.cos(-tilt);
      pts.push([c[0] + xr * Math.cos(rot) - yr * Math.sin(rot), c[1] + xr * Math.sin(rot) + yr * Math.cos(rot)]);
    }
    return this.stroke(pts, { smooth: Math.min(0.35, rmax * 0.12), ...o });
  }
  dot(p, o = {}) {
    const S = this.S, M = this.med, ppm = S.ppm, R = S.R;
    const k = o.size ?? 1;
    const r = M.r0 * (M.kind === 'ballpoint' || M.kind === 'gel' ? 1.35 : M.kind === 'fineliner' ? 1.5 : 1.1) * this.wmul * (1 + this.wear) * k * ppm * (1 + R.gauss(0, 0.08));
    const P = { n: 1, x: Float32Array.of(p[0] * ppm), y: Float32Array.of(p[1] * ppm), r: Float32Array.of(Math.max(0.7, r)), p: Float32Array.of(clamp((o.pressure ?? M.p0) * 1.05, 0.05, 1)), s: Float32Array.of(0), flow: Float32Array.of(M.flowKind === 'none' ? 1 : 1.15), Lpx: 1, angMean: 0 };
    if (M.mode === 'stamp') { P.n = 2; P.x = Float32Array.of(P.x[0], P.x[0] + 0.01); P.y = Float32Array.of(P.y[0], P.y[0]); P.r = Float32Array.of(r, r); P.p = Float32Array.of(P.p[0], P.p[0]); P.s = Float32Array.of(0, 0.1); P.flow = Float32Array.of(1, 1); }
    this._paint(P, o);
  }
  // ---- exact marks: same ink texture, zero offset, for anything that encodes data
  exact(pts, o = {}) { return this.stroke(pts, { profile: 'even', ...o, exact: true }); }
  exactDot(p, r, o = {}) {
    const S = this.S, ppm = S.ppm, px = p[0] * ppm, py = p[1] * ppm, rr = r * ppm, v = clamp(o.pressure ?? this.med.p0, 0.05, 1);
    const P = { n: 2, x: Float32Array.of(px, px), y: Float32Array.of(py, py), r: Float32Array.of(rr, rr), p: Float32Array.of(v, v), s: Float32Array.of(0, 0.1), flow: Float32Array.of(1, 1), Lpx: 1, angMean: 0 };
    sweep(S, P, this.med); this._drift();
  }
  // ---- regions (a polygon is a ring [[x,y],...] or an array of rings for holes, even-odd)
  _rot(poly, ang) { const c = Math.cos(ang), s = Math.sin(ang), f = (r) => r.map((p) => [p[0] * c + p[1] * s, -p[0] * s + p[1] * c]); return Array.isArray(poly[0][0]) ? poly.map(f) : [f(poly)]; }
  _unrot(pt, ang) { const c = Math.cos(ang), s = Math.sin(ang); return [pt[0] * c - pt[1] * s, pt[0] * s + pt[1] * c]; }
  _rows(rings, y) { const xs = []; for (const poly of rings) { const n = poly.length; for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; if ((a[1] <= y) !== (b[1] <= y)) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); } } xs.sort((p, q) => p - q); const iv = []; for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > 0.05) iv.push([xs[i], xs[i + 1]]); return iv; }
  _yrange(rings) { let ymin = 1e9, ymax = -1e9; for (const r of rings) for (const p of r) { if (p[1] < ymin) ymin = p[1]; if (p[1] > ymax) ymax = p[1]; } return [ymin, ymax]; }
  hatch(polygon, o = {}) {
    const S = this.S, R = S.R, M = this.med;
    const sets = 1 + Math.round(o.cross || 0), pitch0 = o.pitch ?? 1.0, drift = o.drift ?? 1, over = o.over ?? 0.55, lenMax = o.length ?? 14;
    const a0 = o.angle ?? 45, angles = [a0, a0 + 62 + R.gauss(0, 4), a0 + 118 + R.gauss(0, 5), a0 - 28 + R.gauss(0, 4), a0 + 90 + R.gauss(0, 3), a0 + 150 + R.gauss(0, 4)];
    const curve0 = (o.curve ?? 0.022) * (R() < 0.5 ? 1 : -1), vary = o.vary ?? 1;
    for (let k = 0; k < sets; k++) {
      const ang = deg(angles[k]), rings = this._rot(polygon, ang), [ymin, ymax] = this._yrange(rings);
      let y = ymin + R() * pitch0 * 0.6, w = 0, aw = 0, pw = 0, dirFlip = R() < 0.5, up = true;
      const pr0 = (o.pressure ?? M.p0) * (k === 0 ? 1 : 0.92);
      while (y < ymax) {
        const ivs = this._rows(rings, y);
        pw = 0.85 * pw + R.gauss(0, 0.06) * drift; pw = clamp(pw, -0.3, 0.3);
        for (const [xa, xb] of ivs) {
          let xs = xa - Math.max(-0.5, R.gauss(0.1, 0.4)) * over, xe = xb + Math.max(-0.5, R.gauss(0.15, 0.4)) * over;
          let pos = xs, first = true;
          while (pos < xe - 0.15) {
            const remain = xe - pos, last = remain <= lenMax * 1.25, cl = last ? remain : lenMax * (0.55 + R() * 0.7);
            const x0 = pos, x1 = pos + cl;
            const sag = (curve0 + R.gauss(0, 0.012)) * cl, slope = Math.tan(aw + R.gauss(0, 0.012 * drift)) * cl;
            const pts = [[x0, y], [x0 + cl * 0.5, y - sag + slope * 0.5], [x1, y + slope]];
            if (R() < 0.045) pts.push([x1 + R.gauss(0, 0.3), y + slope + (R() < 0.5 ? -1 : 1) * (0.35 + R() * 0.5)]);
            const flip = (dirFlip !== up);
            const arr = (flip ? pts.slice().reverse() : pts).map((q) => this._unrot(q, ang));
            // stroke-to-stroke character: a heavier stroke now and then, a lighter one, width following pressure
            let pm = 1 + 0.13 * vary * R.gauss(0, 1); const rr = R(); if (rr < 0.05) pm *= 1.32; else if (rr < 0.12) pm *= 0.7;
            const jS = !first, jE = !last;
            this.stroke(arr, { pressure: clamp(pr0 * (1 + pw) * pm, 0.05, 1), wmul: clamp(0.94 + 0.1 * (pm - 1) * 4 * vary, 0.82, 1.3), profile: o.profile || (M.dry ? 'hatch' : 'taper'), speed: R() < (o.fast ?? 0.22) ? 'fast' : 'normal', tremor: o.tremor, joinStart: flip ? jE : jS, joinEnd: flip ? jS : jE });
            first = false;
            if (last) break;
            pos = x1 - (0.9 + R() * 1.2);
          }
        }
        y += pitch0 * (1 + w); w = clamp(0.9 * w + R.gauss(0, 0.07) * drift, -0.4, 0.4); aw = 0.92 * aw + R.gauss(0, 0.012) * drift; aw = clamp(aw, -0.12, 0.12);
        if (R() < 0.35) up = !up; else if (o.zig) up = !up;
      }
    }
  }
  // Layered hatch sets until the *measured* coverage of the region reaches value * toneMax. value 0..1 is roughly linear in
  // the fraction of full pigment contrast (see S.coverage). The sum of marks; never a fill.
  tone(polygon, o = {}) {
    const S = this.S, M = this.med, R = S.R, v = clamp(o.value ?? 0.5, 0, 1);
    const target = v * (o.toneMax ?? M.toneMax ?? 0.9); if (target < 0.015) return 0;
    const lw = M.r0 * 2 * (M.rp0 + M.rp1 * M.p0) * (M.mode === 'stamp' ? 6 : 1);
    const a0 = o.angle ?? 40 + R.gauss(0, 5);
    const angs = [a0, a0 + 62 + R.gauss(0, 4), a0 + 118 + R.gauss(0, 5), a0 - 28 + R.gauss(0, 4), a0 + 90 + R.gauss(0, 3), a0 + 150 + R.gauss(0, 4), a0 + 45, a0 + 10];
    let cur = S.coverage(polygon, M), fEst = o.f ?? 0.55;
    for (let k = 0; k < angs.length && cur < target - 0.02; k++) {
      let pass = 1 - (1 - target) / Math.max(0.05, 1 - cur); pass = clamp(pass, 0.04, 0.82);
      const pitch = clamp(o.pitch && k === 0 ? o.pitch : fEst * lw / pass, lw * 0.75, lw * 3.6);
      const before = cur;
      this.hatch(polygon, { angle: angs[k], pitch, pressure: (o.pressure ?? M.p0) * (0.6 + 0.6 * pass), over: o.over ?? 0.45, ...o.hatch });
      cur = S.coverage(polygon, M);
      const g = 1 - (1 - cur) / Math.max(0.05, 1 - before);
      if (g > 0.01) fEst = clamp(0.5 * fEst + 0.5 * g * pitch / lw, 0.15, 1.2);
    }
    return cur;
  }
  stipple(polygon, o = {}) { // dots scattered inside a polygon: density per mm², pressure/size vary; clumps and gaps by a noise field
    const S = this.S, R = S.R, rings = Array.isArray(polygon[0][0]) ? polygon : [polygon], [ymin, ymax] = this._yrange(rings);
    let xmin = 1e9, xmax = -1e9; for (const r of rings) for (const p of r) { if (p[0] < xmin) xmin = p[0]; if (p[0] > xmax) xmax = p[0]; }
    const inside = (x, y) => { let c = false; for (const r of rings) { for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } } return c; };
    const dens = o.density ?? 2, n = Math.round((xmax - xmin) * (ymax - ymin) * dens * 1.6), nz = S.noise(S.seed + 'st'), sc = o.clump ?? 0.08;
    for (let i = 0; i < n; i++) { const x = xmin + R() * (xmax - xmin), y = ymin + R() * (ymax - ymin); if (!inside(x, y)) continue; if (o.clump !== 0 && R() > 0.5 + 0.55 * nz.n2(x * sc, y * sc)) continue; if (R() > 0.62) continue; this.dot([x, y], { size: (o.size ?? 1) * (0.7 + 0.7 * R()), pressure: (o.pressure ?? this.med.p0) * (0.7 + 0.5 * R()) }); }
  }
  scribble(polygon, o = {}) {
    const S = this.S, R = S.R, pitch = o.pitch ?? 1.1, ang = deg(o.angle ?? 30 + R.gauss(0, 8)), poly = this._rot(polygon, ang);
    const [ymin, ymax] = this._yrange(poly);
    let y = ymin + R() * pitch, dir = 1, pts = [], lastIv = null, w = 0;
    const flush = () => { if (pts.length > 2) this.stroke(pts.map((q) => this._unrot(q, ang)), { smooth: o.smooth ?? 0.5, pressure: o.pressure, profile: 'even', tremor: 1.2 }); pts = []; };
    while (y < ymax) {
      const ivs = this._rows(poly, y);
      if (!ivs.length) { flush(); y += pitch; continue; }
      const iv = ivs.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
      if (lastIv && (iv[1] < lastIv[0] || iv[0] > lastIv[1])) flush();
      const xa = iv[0] - R() * 0.4, xb = iv[1] + R() * 0.4;
      const yy = y + R.gauss(0, 0.15);
      if (dir > 0) { pts.push([xa, yy], [xb, yy + pitch * 0.5]); } else { pts.push([xb, yy], [xa, yy + pitch * 0.5]); }
      dir = -dir; lastIv = iv; w = 0.85 * w + R.gauss(0, 0.08); y += pitch * clamp(1 + w, 0.6, 1.5);
    }
    flush();
  }
  fillWith(polygon, o = {}) {
    const S = this.S, R = S.R, M = this.med, ang = deg(o.angle ?? 0), poly = this._rot(polygon, ang);
    let eff;
    if (M.mode === 'stamp') { const na = (M.nibAng ?? 0), dirA = ang; eff = M.nibW * Math.abs(Math.sin(dirA - na)) + M.nibH * Math.abs(Math.cos(dirA - na)); eff = Math.max(eff, M.nibH); }
    else eff = M.r0 * 2;
    const pitch = o.pitch ?? eff * (o.overlap === undefined ? 0.82 : 1 - o.overlap);
    const [ymin, ymax] = this._yrange(poly);
    let y = ymin + pitch * 0.4, dir = R() < 0.5 ? 1 : -1, w = 0;
    while (y < ymax + pitch * 0.4) {
      const ivs = this._rows(poly, clamp(y, ymin + 0.01, ymax - 0.01));
      for (const [xa, xb] of ivs) {
        const jx = M.mode === 'stamp' || M.r0 > 1 ? 1.6 : 0.6, a = xa - R.range(-jx * 0.6, jx), b = xb + R.range(-jx * 0.6, jx), yy = y + R.gauss(0, 0.04 * pitch);
        const pts = dir > 0 ? [[a, yy], [(a + b) / 2, yy + R.gauss(0, 0.05)], [b, yy]] : [[b, yy], [(a + b) / 2, yy + R.gauss(0, 0.05)], [a, yy]];
        this.stroke(pts.map((q) => this._unrot(q, ang)), { profile: o.profile || (M.dry ? 'hatch' : 'even'), pressure: o.pressure, speed: o.speed, tremor: 0.6 });
      }
      dir = o.zig === false ? dir : -dir; w = 0.85 * w + R.gauss(0, 0.06); y += pitch * clamp(1 + w, 0.7, 1.35);
    }
  }
}

  // ---------- the sheet ----------
  const MAX_MP = 18.5e6;
  function sheet(cfg) {
    const { id = 'sheet', w = 240, h = 135, ppm = 6, paper = 'cream', seed = id } = cfg;
    const W = Math.round(w * ppm), H = Math.round(h * ppm);
    if (W * H > MAX_MP) throw new Error(`sheet too big: ${W}x${H}`);
    const S = { id, w, h, ppm, W, H, seed: String(seed) };
    S.R = rng('draw:' + S.seed);
    S.noise = makeNoise;
    buildPaper(S, paper);
    S.fill = new Uint8Array(W * H); S.cov = new Float32Array(W * H);
    S.tool = (kind, opts) => new Tool(S, kind, opts);
    S.coverage = (polygon, tool, step) => coverage(S, polygon, tool.med || tool, step);
    S.toCanvas = (canvas) => toCanvas(S, canvas);
    return S;
  }

function polyMask(S, poly, fn, step = 1) { // scanline (even-odd, rings allowed) over a polygon in mm; fn(x,y,i)
  const ppm = S.ppm, rings = (Array.isArray(poly[0][0]) ? poly : [poly]).map((r) => r.map((p) => [p[0] * ppm, p[1] * ppm])); let y0 = 1e9, y1 = -1e9;
  for (const r of rings) for (const p of r) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(S.H - 1, Math.ceil(y1)); y += step) {
    const yc = y + 0.5, xs = [];
    for (const P of rings) for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; if ((a[1] <= yc) !== (b[1] <= yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(S.W - 1, Math.floor(xs[k + 1] - 0.5)); x += step) fn(x, y, y * S.W + x);
  }
}
// How much of a medium's full pigment contrast a region has reached (0 = bare paper, 1 = solid pigment): the projection of
// (pixel - paper) on (pigment - paper), averaged over the polygon. tone() closes its loop on this.
function coverage(S, poly, med, step = 2) {
  if (!S._pm) { let a = 0, b = 0, c = 0, n = 0; for (let i = 0; i < S.W * S.H; i += 97) { a += S.paper0[3 * i]; b += S.paper0[3 * i + 1]; c += S.paper0[3 * i + 2]; n++; } S._pm = [a / n, b / n, c / n]; }
  const pm = S._pm; let e;
  if (med.comp === 1) e = [0, 1, 2].map((c) => pm[c] * (Math.exp(-med.k[c]) - 1)); else e = [0, 1, 2].map((c) => med.col[c] - pm[c]);
  const ee = e[0] * e[0] + e[1] * e[1] + e[2] * e[2]; if (ee < 1) return 0;
  let sum = 0, n = 0, rgb = S.rgb;
  polyMask(S, poly, (x, y, i) => { const j = 3 * i; sum += ((rgb[j] - S.paper0[j]) * e[0] + (rgb[j + 1] - S.paper0[j + 1]) * e[1] + (rgb[j + 2] - S.paper0[j + 2]) * e[2]) / ee; n++; }, step);
  return n ? clamp(sum / n, 0, 1.2) : 0;
}

  function toCanvas(S, canvas) {
    const { W, H } = S, c = canvas || document.createElement('canvas');
    c.width = W; c.height = H;
    const buf = new Uint8ClampedArray(W * H * 4);
    for (let i = 0, n = W * H; i < n; i++) { buf[4 * i] = S.rgb[3 * i]; buf[4 * i + 1] = S.rgb[3 * i + 1]; buf[4 * i + 2] = S.rgb[3 * i + 2]; buf[4 * i + 3] = 255; }
    c.getContext('2d').putImageData(new ImageData(buf, W, H), 0, 0);
    return c;
  }

  Object.assign(K, { sheet, Tool, makeNoise, NAMED });
})();
