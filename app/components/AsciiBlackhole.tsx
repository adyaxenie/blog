"use client";

import { useEffect, useRef, useCallback } from "react";
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

const RAMP = " .,:;-=+*#%@";
const STAR_CHARS = ".·*+✦⋆";

// --- Kerr black hole tunables ---
const A_SPIN = 0.9;           // 0..1 spin parameter (0.9 = fast Kerr)
const M = 1.0;                // mass
const K_SPEED = 1.6;          // visual rotation speed
const ASPECT = 0.5;           // char aspect correction (chars ~2x tall as wide)

// Derived constants
const R_H = M + Math.sqrt(Math.max(0, M * M - A_SPIN * A_SPIN)); // event horizon
const R_ISCO = 6.0 * M * (1 - 0.5 * A_SPIN);                     // ISCO

// Cheap deterministic pseudo-noise [0,1)
function hash2(a: number, b: number): number {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Color: map heat (0=cold red, 1=hot white) + brightness to orange/white palette
function getDiskColor(heat: number, brightness: number): string {
  const b = Math.min(1, brightness);
  if (heat > 0.8) {
    const l = 75 + b * 25;
    return `hsl(42, ${15 + b * 25}%, ${l}%)`;
  } else if (heat > 0.6) {
    const t = (heat - 0.6) / 0.2;
    const h = 35 + t * 10;
    const s = 55 + b * 35;
    const l = 55 + b * 35;
    return `hsl(${h}, ${s}%, ${l}%)`;
  } else if (heat > 0.35) {
    const t = (heat - 0.35) / 0.25;
    const h = 20 + t * 15;
    const s = 70 + b * 25;
    const l = 40 + b * 35;
    return `hsl(${h}, ${s}%, ${l}%)`;
  } else if (heat > 0.12) {
    const t = (heat - 0.12) / 0.23;
    const h = 8 + t * 12;
    const s = 80 + b * 15;
    const l = 25 + b * 30;
    return `hsl(${h}, ${s}%, ${l}%)`;
  } else {
    const h = 3 + heat * 40;
    const s = 75;
    const l = 12 + b * 20;
    return `hsl(${h}, ${s}%, ${l}%)`;
  }
}

export default function AsciiBlackhole({ exclusionZones = [], onGridReady }: Props) {
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

  const generateStars = useCallback((cols: number, rows: number) => {
    const stars: { x: number; y: number; char: string; twinkle: number }[] = [];
    const count = Math.floor((cols * rows) * 0.02);
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
      if (x >= zone.col && x < zone.col + zone.width && y >= zone.row && y < zone.row + zone.height) {
        return true;
      }
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
    const t = (time - t0Ref.current) * 0.001; // seconds

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = FONT;
    ctx.textBaseline = "top";

    const cx = cols / 2;
    const cy = rows / 2;
    // Scale: world units per cell. Smaller = more zoomed in.
    const scale = Math.min(cols, rows / ASPECT) / 28.0;

    // Background stars
    ctx.fillStyle = "rgba(180, 160, 140, 0.25)";
    for (const star of stars) {
      if (star.y < rows && star.x < cols && !isInExclusion(star.x, star.y)) {
        // Hide stars behind the disk region
        const sx = (star.x - cx) / scale;
        const sy = (star.y - cy) / scale / ASPECT;
        const sr = Math.hypot(sx, sy);
        if (sr < R_ISCO * 1.5) continue;
        const twinkle = Math.sin(time * 0.0008 + star.twinkle);
        if (twinkle > -0.3) {
          ctx.fillText(star.char, star.x * charWidth, star.y * charHeight);
        }
      }
    }

    // Batch by color
    const colorBatch: Map<string, { char: string; px: number; py: number }[]> = new Map();
    const addToBatch = (color: string, char: string, px: number, py: number) => {
      let batch = colorBatch.get(color);
      if (!batch) { batch = []; colorBatch.set(color, batch); }
      batch.push({ char, px, py });
    };

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        if (isInExclusion(i, j)) continue;

        // World coords (y stretched for terminal aspect)
        const x = (i - cx) / scale;
        const y = (j - cy) / scale / ASPECT;
        const r = Math.hypot(x, y);

        // Inside event horizon: black
        if (r < R_H) continue;
        // Too close to singularity
        if (r < 0.35) continue;

        const theta = Math.atan2(y, x);

        // Total angular velocity: Keplerian + frame dragging
        const omega = K_SPEED / Math.pow(r, 1.5) + 2.0 * A_SPIN * M / Math.pow(r, 3);
        const thetaSrc = theta - omega * t;

        // Disk texture: rings + azimuthal streaks + noise
        const ring = 0.5 + 0.5 * Math.sin(r * 1.8 - t * 0.5);
        const streak = 0.5 + 0.5 * Math.sin(thetaSrc * 6.0 + r * 0.7);
        const n = hash2(Math.floor(r * 3), Math.floor(((thetaSrc % 1000) + 1000) % 1000));
        const tex = 0.45 * ring + 0.35 * streak + 0.20 * n;

        // Radial falloff: brightest near ISCO, fades outward & inside
        let fall: number;
        if (r < R_ISCO) {
          fall = Math.max(0, (r - R_H) / Math.max(1e-6, R_ISCO - R_H)) * 0.6;
        } else {
          fall = Math.pow(R_ISCO / r, 0.8);
        }

        // Relativistic Doppler beaming
        const vOrb = Math.min(0.9, Math.sqrt(M / Math.max(r, 1e-3)));
        const vLos = vOrb * Math.sin(theta); // line-of-sight velocity
        const boost = 1.0 / Math.pow(Math.max(0.05, 1.0 - vLos), 3);

        const bright = tex * fall * boost * 0.55;

        // Map to ASCII ramp
        const idx = Math.max(0, Math.min(RAMP.length - 1, Math.floor(bright * (RAMP.length - 1))));
        if (idx === 0) continue; // space = skip

        const char = RAMP[idx];

        // Heat: inner orbits are hotter (whiter), outer are cooler (redder)
        const heat = Math.min(1, Math.max(0, 1.0 - (r - R_H) / (R_ISCO * 2.5)));

        const qH = Math.round(heat * 20) / 20;
        const qB = Math.round(bright * 10) / 10;
        const color = getDiskColor(qH, Math.min(1, qB));

        addToBatch(color, char, i * charWidth, j * charHeight);
      }
    }

    // Render batched by color
    colorBatch.forEach((chars, color) => {
      ctx.fillStyle = color;
      for (const { char, px, py } of chars) {
        ctx.fillText(char, px, py);
      }
    });
  }, [isInExclusion]);

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
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0"
      />
    </div>
  );
}
