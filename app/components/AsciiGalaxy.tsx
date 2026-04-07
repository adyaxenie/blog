"use client";

import { useEffect, useRef, useCallback } from "react";
import { measureGrid, FONT } from "./pretextMeasure";

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

const DENSITY_CHARS = " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
const CORE_RAMP = ".:;*oO#%@$$$";
const STAR_CHARS = ".·*+✦⋆˚°";

const NUM_ARMS = 2;
const ARM_TIGHTNESS = 0.28;
const ARM_SPREAD_BASE = 0.35;
const SECONDARY_ARMS = 2;

const TILT_X = 1.1;
const TILT_Z = 0.3;

// Color zones: white center → pink → purple → blue edges
function getColor(normR: number, brightness: number): string {
  const b = Math.min(1, brightness);
  if (normR < 0.06) {
    const l = 85 + b * 15;
    return `hsl(0,0%,${l}%)`;
  } else if (normR < 0.15) {
    const t = (normR - 0.06) / 0.09;
    const s = t * 30;
    const l = 70 + b * 25;
    return `hsl(340,${s}%,${l}%)`;
  } else if (normR < 0.35) {
    const t = (normR - 0.15) / 0.2;
    const h = 330 - t * 20;
    const s = 30 + t * 35;
    const l = 50 + b * 30;
    return `hsl(${h},${s}%,${l}%)`;
  } else if (normR < 0.6) {
    const t = (normR - 0.35) / 0.25;
    const h = 310 - t * 40;
    const s = 40 + t * 20;
    const l = 40 + b * 30;
    return `hsl(${h},${s}%,${l}%)`;
  } else {
    const t = Math.min(1, (normR - 0.6) / 0.4);
    const h = 270 - t * 40;
    const s = 45 + t * 15;
    const l = 30 + b * 25;
    return `hsl(${h},${s}%,${l}%)`;
  }
}

export default function AsciiGalaxy({ exclusionZones = [], onGridReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const angleRef = useRef(0);
  const gridRef = useRef<{ cols: number; rows: number; charWidth: number; charHeight: number }>({
    cols: 80, rows: 40, charWidth: 8.4, charHeight: 16,
  });
  const starsRef = useRef<{ x: number; y: number; char: string; twinkle: number }[]>([]);
  const dustRef = useRef<Float32Array>(new Float32Array(0));
  const exclusionRef = useRef<ExclusionZone[]>(exclusionZones);
  const onGridReadyRef = useRef(onGridReady);

  exclusionRef.current = exclusionZones;
  onGridReadyRef.current = onGridReady;

  const generateStars = useCallback((cols: number, rows: number) => {
    const stars: { x: number; y: number; char: string; twinkle: number }[] = [];
    const count = Math.floor((cols * rows) * 0.025);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows),
        char: STAR_CHARS[Math.floor(Math.random() * STAR_CHARS.length)],
        twinkle: Math.random() * Math.PI * 2,
      });
    }
    const dust = new Float32Array(cols * rows);
    for (let i = 0; i < dust.length; i++) {
      dust[i] = Math.random();
    }
    dustRef.current = dust;
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
    const rotation = angleRef.current;
    const stars = starsRef.current;
    const dust = dustRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = FONT;
    ctx.textBaseline = "top";

    // Background stars
    ctx.fillStyle = "hsl(220,10%,45%)";
    for (const star of stars) {
      if (star.y < rows && star.x < cols && !isInExclusion(star.x, star.y)) {
        const twinkle = Math.sin(time * 0.0008 + star.twinkle);
        if (twinkle > -0.4) {
          ctx.fillText(star.char, star.x * charWidth, star.y * charHeight);
        }
      }
    }

    const centerX = cols / 2;
    const centerY = rows / 2;
    const galaxyRadius = Math.min(cols / 3, rows / 1.2) * 0.95;

    const cosX = Math.cos(TILT_X);
    const cosZ = Math.cos(TILT_Z);
    const sinZ = Math.sin(TILT_Z);

    // Batch chars by color to minimize fillStyle changes
    const colorBatch: Map<string, { char: string; px: number; py: number }[]> = new Map();

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (isInExclusion(x, y)) continue;

        const sx = (x - centerX) / 2;
        const sy = y - centerY;

        const rx = sx * cosZ + sy * sinZ;
        const ry = -sx * sinZ + sy * cosZ;

        const gx = rx;
        const gy = ry / cosX;

        const r = Math.sqrt(gx * gx + gy * gy);
        if (r > galaxyRadius * 1.1) continue;

        const normR = r / galaxyRadius;
        if (normR > 1.15) continue;

        const theta = Math.atan2(gy, gx);
        const logR = Math.log(normR + 0.001);

        // Main arms
        let maxArmDensity = 0;
        for (let arm = 0; arm < NUM_ARMS; arm++) {
          const armOffset = (arm / NUM_ARMS) * Math.PI * 2;
          const expectedTheta = logR / ARM_TIGHTNESS + armOffset + rotation;
          let angleDiff = theta - expectedTheta;
          angleDiff = ((angleDiff % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
          const armDist = Math.abs(angleDiff);
          const armWidth = ARM_SPREAD_BASE * (0.6 + normR * 0.8);
          if (armDist < armWidth) {
            maxArmDensity = Math.max(maxArmDensity, Math.pow(1 - armDist / armWidth, 1.5));
          }
        }

        // Secondary arms
        let secondaryDensity = 0;
        for (let arm = 0; arm < SECONDARY_ARMS; arm++) {
          const armOffset = ((arm + 0.5) / SECONDARY_ARMS) * Math.PI * 2;
          const expectedTheta = logR / (ARM_TIGHTNESS * 0.9) + armOffset + rotation;
          let angleDiff = theta - expectedTheta;
          angleDiff = ((angleDiff % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
          const armDist = Math.abs(angleDiff);
          const armWidth = ARM_SPREAD_BASE * 0.6 * (0.5 + normR * 0.6);
          if (armDist < armWidth) {
            secondaryDensity = Math.max(secondaryDensity, Math.pow(1 - armDist / armWidth, 2) * 0.35);
          }
        }

        const coreBrightness = Math.exp(-normR * normR * 25);
        const bulgeBrightness = Math.exp(-normR * normR * 5) * 0.5;
        const diskGlow = Math.exp(-normR * 1.8) * 0.15;

        const dustIdx = (y * cols + x) % dust.length;
        const dustNoise = dust[dustIdx] ?? 0.5;
        const dustModulation = 0.7 + dustNoise * 0.6;

        const armBrightness = (maxArmDensity + secondaryDensity) * (1 - normR * 0.4) * dustModulation;
        const totalBrightness = Math.min(1, coreBrightness + bulgeBrightness + armBrightness + diskGlow);

        const edgeFade = normR > 0.85 ? 1 - (normR - 0.85) / 0.3 : 1;
        const finalBrightness = Math.max(0, totalBrightness * Math.max(0, edgeFade));

        if (finalBrightness > 0.015) {
          let char: string;
          if (coreBrightness > 0.4) {
            const idx = Math.floor(finalBrightness * (CORE_RAMP.length - 1));
            char = CORE_RAMP[Math.min(idx, CORE_RAMP.length - 1)];
          } else {
            const idx = Math.floor(finalBrightness * (DENSITY_CHARS.length - 1));
            char = DENSITY_CHARS[Math.min(idx, DENSITY_CHARS.length - 1)];
          }

          // Quantize color to reduce unique fillStyle changes
          const qR = Math.round(normR * 20) / 20;
          const qB = Math.round(finalBrightness * 10) / 10;
          const color = getColor(qR, qB);

          let batch = colorBatch.get(color);
          if (!batch) {
            batch = [];
            colorBatch.set(color, batch);
          }
          batch.push({ char, px: x * charWidth, py: y * charHeight });
        }
      }
    }

    // Render batched by color — minimizes ctx.fillStyle changes
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

    const animate = (time: number) => {
      angleRef.current += 0.002;
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
    <div className="fixed inset-0 bg-[#08080f] overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0"
      />
    </div>
  );
}
