"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import { measureGrid, FONT, LINE_HEIGHT } from "./pretextMeasure";

export interface ExclusionZone {
  col: number;
  row: number;
  width: number;
  height: number;
}

interface Props {
  exclusionZones?: ExclusionZone[];
  onGridReady?: (charWidth: number, charHeight: number, cols: number, rows: number) => void;
}

// --- Kerr tunables ---
const A_SPIN = 0.85;
const M = 1.0;
const K_SPEED = 1.6;
const ASPECT = 0.5; // char aspect (chars ~2x tall as wide)

const R_H = M + Math.sqrt(Math.max(0, M * M - A_SPIN * A_SPIN));
const R_ISCO = 6.0 * M * (1 - 0.5 * A_SPIN);
const B_CRIT = 3 * Math.sqrt(3) * M; // ~5.196M — critical impact parameter
const R_OUTER = 15 * M;

const RAMP = " .,:;-=+*#%@";
const STAR_CHARS = ".·*+✦⋆";

// Pseudo-noise
function hash2(a: number, b: number): number {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Color: hot white → orange → deep red
function getDiskColor(heat: number, brightness: number): string {
  const b = Math.min(1, brightness);
  if (heat > 0.8) {
    return `hsl(42, ${15 + b * 25}%, ${75 + b * 25}%)`;
  } else if (heat > 0.55) {
    const t = (heat - 0.55) / 0.25;
    return `hsl(${30 + t * 12}, ${55 + b * 35}%, ${55 + b * 35}%)`;
  } else if (heat > 0.3) {
    const t = (heat - 0.3) / 0.25;
    return `hsl(${18 + t * 12}, ${70 + b * 25}%, ${38 + b * 35}%)`;
  } else if (heat > 0.1) {
    const t = (heat - 0.1) / 0.2;
    return `hsl(${8 + t * 10}, ${80 + b * 15}%, ${22 + b * 30}%)`;
  } else {
    return `hsl(${3 + heat * 50}, 75%, ${12 + b * 20}%)`;
  }
}

// --- Orbit table: precompute r_hit at equatorial crossing for each impact parameter b ---
// Uses the Schwarzschild orbit equation: (du/dφ)² = 1/b² - u² + 2Mu³, u = 1/r
// The equatorial crossing determines where a lensed ray hits the disk plane.

interface OrbitEntry {
  b: number;
  rHit: number; // radius at equatorial crossing
  alpha: number; // total deflection angle
}

function buildOrbitTable(): OrbitEntry[] {
  const N = 500;
  const bMin = B_CRIT * 1.0003;
  const bMax = 18 * M;
  const table: OrbitEntry[] = [];

  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const b = bMin * Math.exp(t * Math.log(bMax / bMin));
    const b2 = b * b;
    const V = (u: number) => 1 / b2 - u * u + 2 * M * u * u * u;

    // Find turning point u_max: root of V(u) = 0 in [0, 1/(3M))
    let lo = 0, hi = 1 / (3 * M) - 1e-10;
    for (let j = 0; j < 60; j++) {
      const mid = (lo + hi) / 2;
      if (V(mid) > 0) lo = mid; else hi = mid;
    }
    const uMax = lo;

    // Integrate ascending half: u from ε to uMax, accumulate angle
    const STEPS = 1500;
    const du = uMax / STEPS;
    let phiAccum = 0;
    const phiArr: number[] = [0];
    const uArr: number[] = [0];

    for (let s = 1; s <= STEPS; s++) {
      const u = s * du;
      const Vu = V(u);
      if (Vu < 1e-20) break;
      phiAccum += du / Math.sqrt(Vu);
      phiArr.push(phiAccum);
      uArr.push(u);
    }

    const phiHalf = phiAccum;
    const alpha = Math.max(0, 2 * phiHalf - Math.PI);

    // Equatorial crossing at Φ_cross = α/2 in the ascending half
    const phiCross = alpha / 2;
    let rHit = -1;

    for (let k = 0; k < phiArr.length - 1; k++) {
      if (phiArr[k] <= phiCross && phiArr[k + 1] >= phiCross) {
        const frac = (phiCross - phiArr[k]) / (phiArr[k + 1] - phiArr[k]);
        const uHit = uArr[k] + frac * (uArr[k + 1] - uArr[k]);
        rHit = uHit > 1e-10 ? 1 / uHit : -1;
        break;
      }
    }

    table.push({ b, rHit, alpha });
  }

  return table;
}

function lookupOrbit(table: OrbitEntry[], b: number): OrbitEntry {
  if (b <= table[0].b) return table[0];
  if (b >= table[table.length - 1].b) return table[table.length - 1];
  let lo = 0, hi = table.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (table[mid].b <= b) lo = mid; else hi = mid;
  }
  const t = (b - table[lo].b) / (table[hi].b - table[lo].b);
  return {
    b,
    rHit: table[lo].rHit + t * (table[hi].rHit - table[lo].rHit),
    alpha: table[lo].alpha + t * (table[hi].alpha - table[lo].alpha),
  };
}

export default function AsciiBlackhole2({ exclusionZones = [], onGridReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const gridRef = useRef<{ cols: number; rows: number; charWidth: number; charHeight: number }>({
    cols: 80, rows: 40, charWidth: 8.4, charHeight: 16,
  });
  const starsRef = useRef<{ x: number; y: number; char: string; twinkle: number }[]>([]);
  const exclusionRef = useRef<ExclusionZone[]>(exclusionZones);
  const onGridReadyRef = useRef(onGridReady);
  const t0Ref = useRef<number>(0);

  exclusionRef.current = exclusionZones;
  onGridReadyRef.current = onGridReady;

  const orbitTable = useMemo(() => buildOrbitTable(), []);

  const generateStars = useCallback((cols: number, rows: number) => {
    const stars: { x: number; y: number; char: string; twinkle: number }[] = [];
    const count = Math.floor(cols * rows * 0.02);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows),
        char: STAR_CHARS[Math.floor(Math.random() * STAR_CHARS.length)],
        twinkle: Math.random() * Math.PI * 2,
      });
    }
    return stars;
  }, []);

  const isInExclusion = useCallback((x: number, y: number): boolean => {
    for (const zone of exclusionRef.current) {
      if (x >= zone.col && x < zone.col + zone.width && y >= zone.row && y < zone.row + zone.height) return true;
    }
    return false;
  }, []);

  const renderFrame = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { cols, rows, charWidth, charHeight } = gridRef.current;
    const stars = starsRef.current;
    const t = (time - t0Ref.current) * 0.001;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = FONT;
    ctx.textBaseline = "top";

    const cx = cols / 2;
    const cy = rows / 2;
    const scale = Math.min(cols, rows / ASPECT) / 28.0;

    // Background stars
    ctx.fillStyle = "rgba(180, 160, 140, 0.25)";
    for (const star of stars) {
      if (star.y < rows && star.x < cols && !isInExclusion(star.x, star.y)) {
        const su = (star.x - cx) / scale;
        const sv = (star.y - cy) / scale / ASPECT;
        if (Math.hypot(su, sv) < B_CRIT * 1.3) continue;
        const twinkle = Math.sin(time * 0.0008 + star.twinkle);
        if (twinkle > -0.3) {
          ctx.fillText(star.char, star.x * charWidth, star.y * charHeight);
        }
      }
    }

    const colorBatch: Map<string, { char: string; px: number; py: number }[]> = new Map();
    const addToBatch = (color: string, char: string, px: number, py: number) => {
      let batch = colorBatch.get(color);
      if (!batch) { batch = []; colorBatch.set(color, batch); }
      batch.push({ char, px, py });
    };

    type Sample =
      | { kind: "photon"; fade: number }
      | { kind: "disk"; bright: number; heat: number };

    const sampleAt = (u: number, v: number): Sample | null => {
      const b = Math.hypot(u, v);
      if (b < B_CRIT) return null;

      let rHit = -1;
      let phiHit = 0;
      let isLensed = false;

      // Front disc — apparent thickness grows near BH due to lensing
      const bSafe = Math.max(b - B_CRIT, 0.05 * M);
      const apparentHalf = 0.6 + 3.0 * M / bSafe;
      let frontEdgeSoft = 1;

      if (Math.abs(v) < apparentHalf) {
        const rCandidate = Math.abs(u);
        if (rCandidate >= R_ISCO && rCandidate <= R_OUTER) {
          rHit = rCandidate;
          phiHit = u > 0 ? Math.PI / 2 : -Math.PI / 2;
          const vt = Math.abs(v) / apparentHalf;
          frontEdgeSoft = 1 - vt * vt;
        }
      }

      // Lensed secondary image — soft vertical taper so top/bottom aren't cut off
      let lensedTaper = 1;
      if (rHit < 0) {
        const orbit = lookupOrbit(orbitTable, b);
        if (orbit.rHit > 0 && orbit.rHit >= R_ISCO && orbit.rHit <= R_OUTER) {
          rHit = orbit.rHit;
          phiHit = u > 0 ? -Math.PI / 2 : Math.PI / 2;
          isLensed = true;
          // Taper from 75% of R_OUTER outward so disc stays ~2× wider than tall
          const V_TAPER = R_OUTER * 0.75;
          if (Math.abs(v) > V_TAPER) {
            lensedTaper = Math.max(0, 1 - (Math.abs(v) - V_TAPER) / (R_OUTER - V_TAPER));
          }
        }
      }

      // Photon ring
      if (rHit < 0) {
        if (Math.abs(b - B_CRIT) < 0.35 * M) {
          const fade = Math.pow(1 - Math.abs(b - B_CRIT) / (0.35 * M), 0.6);
          return { kind: "photon", fade };
        }
        return null;
      }

      const omega = K_SPEED / Math.pow(rHit, 1.5) + 2.0 * A_SPIN * M / Math.pow(rHit, 3);
      const phiRotated = phiHit - omega * t;

      const ring1 = 0.5 + 0.5 * Math.sin(rHit * 1.8 - t * 0.5);
      const ring2 = 0.5 + 0.5 * Math.sin(rHit * 0.6 + t * 0.22);
      const ring  = 0.65 * ring1 + 0.35 * ring2;

      // Horizontal flow: matter on the right flows inward, left flows outward.
      // vTang gives differential rotation — inner disc scrolls faster than outer.
      const vTang = Math.sqrt(M / Math.max(rHit, 1e-3));
      const flowDir = u > 0 ? -1.0 : 1.0;
      const flowPhase = flowDir * rHit * 0.3 + vTang * t * 5.0;
      const streak = 0.5 + 0.5 * Math.sin(phiRotated * 3.0 + flowPhase);

      const n = hash2(Math.floor(rHit * 3), Math.floor(((phiRotated * 8) % 1000 + 1000) % 1000));
      const tex = 0.40 * ring + 0.40 * streak + 0.20 * n;

      let fall = rHit < R_ISCO
        ? Math.max(0, (rHit - R_H) / Math.max(1e-6, R_ISCO - R_H)) * 0.6
        : Math.pow(R_ISCO / rHit, 0.8);
      const fadeStart = R_OUTER * 0.82;
      if (rHit > fadeStart) fall *= Math.max(0, 1 - (rHit - fadeStart) / (R_OUTER - fadeStart));

      const vOrb = Math.min(0.9, Math.sqrt(M / Math.max(rHit, 1e-3)));
      const vLos = vOrb * Math.sin(phiRotated);
      const delta = Math.sqrt(1 - vOrb * vOrb) / Math.max(0.05, 1 - vLos);
      const g = Math.sqrt(Math.max(0.01, 1 - 2 * M / rHit));

      let bright = tex * fall * Math.pow(delta, 3) * Math.pow(g, 4) * frontEdgeSoft;
      if (isLensed) bright *= 0.7 * lensedTaper;
      else bright *= 2.0; // front disc boost
      if (Math.abs(b - B_CRIT) < 0.3 * M) {
        bright *= 1 + 2.0 * (1 - Math.abs(b - B_CRIT) / (0.3 * M));
      }
      bright *= 3.5;

      const heat = Math.pow(Math.max(0, 1 - (rHit - R_H) / (R_ISCO * 1.5)), 0.7);
      return { kind: "disk", bright, heat };
    };

    const dU = 0.25 / scale;
    const dV = 0.25 / scale / ASPECT;

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        if (isInExclusion(i, j)) continue;

        const u0 = (i - cx) / scale;
        const v0 = (j - cy) / scale / ASPECT;

        const s1 = sampleAt(u0 - dU, v0 - dV);
        const s2 = sampleAt(u0 + dU, v0 + dV);

        const photonFade =
          (s1?.kind === "photon" ? s1.fade : 0) +
          (s2?.kind === "photon" ? s2.fade : 0);
        const diskBright =
          (s1?.kind === "disk" ? s1.bright : 0) +
          (s2?.kind === "disk" ? s2.bright : 0);

        if (diskBright > 0) {
          const b1 = s1?.kind === "disk" ? s1.bright : 0;
          const b2 = s2?.kind === "disk" ? s2.bright : 0;
          const bMax = Math.max(b1, b2);
          const bMin = Math.min(b1, b2);
          const bright = Math.min(1, bMax * 0.7 + bMin * 0.3);
          if (bright < 0.012) continue;

          let heat = 0;
          if (s1?.kind === "disk" && s2?.kind === "disk") {
            heat = s1.bright > s2.bright ? s1.heat : s2.heat;
          } else if (s1?.kind === "disk") heat = s1.heat;
          else if (s2?.kind === "disk") heat = s2.heat;

          const dither = (hash2(i * 1.31, j * 1.77) - 0.5) / RAMP.length;
          const idx = Math.max(0, Math.min(RAMP.length - 1, Math.floor((bright + dither) * (RAMP.length - 1))));
          if (idx === 0) continue;

          const qH = Math.round(heat * 40) / 40;
          const qB = Math.round(bright * 24) / 24;
          addToBatch(getDiskColor(qH, qB), RAMP[idx], i * charWidth, j * charHeight);
        } else if (photonFade > 0) {
          const fade = Math.min(1, photonFade / 2);
          const idx = Math.max(0, Math.min(RAMP.length - 1, Math.floor(fade * (RAMP.length - 1))));
          if (idx > 0) {
            const qB = Math.round(fade * 24) / 24;
            addToBatch(getDiskColor(0.95, qB), RAMP[idx], i * charWidth, j * charHeight);
          }
        }
      }
    }

    colorBatch.forEach((chars, color) => {
      ctx.fillStyle = color;
      for (const { char, px, py } of chars) {
        ctx.fillText(char, px, py);
      }
    });
  }, [isInExclusion, orbitTable]);

  useEffect(() => {
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const metrics = measureGrid(w, h);
      const dpr = window.devicePixelRatio || 1;

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.scale(dpr, dpr);
      }

      gridRef.current = {
        cols: metrics.cols,
        rows: metrics.rows,
        charWidth: metrics.charWidth,
        charHeight: metrics.charHeight,
      };
      starsRef.current = generateStars(metrics.cols, metrics.rows);
      onGridReadyRef.current?.(metrics.charWidth, metrics.charHeight, metrics.cols, metrics.rows);
    };

    resize();
    window.addEventListener("resize", resize);
    t0Ref.current = performance.now();

    const animate = (time: number) => {
      renderFrame(time);
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [renderFrame, generateStars]);

  return (
    <div className="fixed inset-0 bg-[#050508] overflow-hidden">
      <canvas ref={canvasRef} className="absolute top-0 left-0" />
    </div>
  );
}
