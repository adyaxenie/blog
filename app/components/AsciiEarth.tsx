"use client";

import { useEffect, useRef, useCallback } from "react";
import { measureGrid, FONT, LINE_HEIGHT } from "./pretextMeasure";

// Higher resolution continent map — 36 rows × 72 cols
const LAND_MAP = [
  "000000000000000000000000000000000000000000000000000000000000000000000000",
  "000000000000000000000000000000000000000000000000000000000000000000000000",
  "000000000000000011111111100000000000001111000000000000000000000000000000",
  "000000000000000111111111110000000000011111100000000000000000000000000000",
  "000000000000001111111111111000000001111111110000000000000000000000000000",
  "000000000000011111111111111100000011111111111000000000000000000000000000",
  "000000000000111111111111111110000111111111111100000000000000000000000000",
  "000000000001111111111111111111001111111111111110000000000000000000000000",
  "000000000011111111111111111111011111111111111111000000000000000000000000",
  "000000000011111111111111111111111111111111111111000000000000000000000000",
  "000000000001111111111111111111101111111111111110000000000000000000000000",
  "000000000000111111111111111111000111111111111100000000000000000000000000",
  "000000000000011111111111111110000011111111111000000000000000000000000000",
  "000000000000001111111111111100000001111111110000000000000000000000000000",
  "000000000000000111111111111000000000111111100000000000000000000000000000",
  "000000000000000011111111110000000000011111000000000000000000000000000000",
  "000000000000000001111111100000000000001110000000001100000000000000000000",
  "000000000000000000111111000000000000000100000000011110000000000000000000",
  "000000000000000000011110000000000000000000000000111111000000000000000000",
  "000000000000000000001100000000000000000000000001111111100000000000000000",
  "000000000000000000001100000000000000000000000011111111110000000000000000",
  "000000000000000000000100000000000000000000000111111111111000000000000000",
  "000000000000000000000000000000000000000000001111111111111100000000000000",
  "000000000000000000000000000000000000000000001111111111111100000000000000",
  "000000000000000000000000000000000000000000000111111111111000000000000000",
  "000000000000000000000000000000000000000000000011111111110000000000000000",
  "000000000000000000000000000000000000000000000001111111100000000000000000",
  "000000000000000000000000000000000000000000000000111111000000000000000000",
  "000000000000000000000000000000000000000000000000011110000000000000000000",
  "000000000000000000000000000000000000000000000000001100000000000000000000",
  "000000000000000000000000000000000000000000000000000000000000000000000000",
  "000000000000000000000000000000000000000000000000000000000000000000000000",
  "000000000000000000000000000011111111111111111100000000000000000000000000",
  "000000000000000000000000000011111111111111111100000000000000000000000000",
  "000000000000000000000000000001111111111111111000000000000000000000000000",
  "000000000000000000000000000000011111111111100000000000000000000000000000",
];

const MAP_ROWS = LAND_MAP.length;
const MAP_COLS = LAND_MAP[0].length;

const OCEAN_CHARS = " .·:;~";
const LAND_CHARS = "░▒▓▓██";
const STAR_CHARS = ".·*+✦⋆";

function isLand(lat: number, lon: number): boolean {
  const row = Math.floor(((Math.PI / 2 - lat) / Math.PI) * MAP_ROWS);
  const col = Math.floor((lon / (2 * Math.PI)) * MAP_COLS);
  const r = Math.max(0, Math.min(MAP_ROWS - 1, row));
  const c = ((col % MAP_COLS) + MAP_COLS) % MAP_COLS;
  return LAND_MAP[r][c] === "1";
}

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

export default function AsciiEarth({ exclusionZones = [], onGridReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const angleRef = useRef(0);
  const gridRef = useRef<{ cols: number; rows: number; charWidth: number; charHeight: number }>({
    cols: 80, rows: 40, charWidth: 8.4, charHeight: 16,
  });
  const starsRef = useRef<{ x: number; y: number; char: string; twinkle: number }[]>([]);
  const exclusionRef = useRef<ExclusionZone[]>(exclusionZones);
  const onGridReadyRef = useRef(onGridReady);

  exclusionRef.current = exclusionZones;
  onGridReadyRef.current = onGridReady;

  const generateStars = useCallback((cols: number, rows: number) => {
    const stars: { x: number; y: number; char: string; twinkle: number }[] = [];
    const count = Math.floor((cols * rows) * 0.03);
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
    const angle = angleRef.current;
    const stars = starsRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = FONT;
    ctx.textBaseline = "top";

    const color = "rgba(52, 211, 153, 0.7)"; // emerald-400/70
    const starColor = "rgba(52, 211, 153, 0.5)";

    // Draw stars
    ctx.fillStyle = starColor;
    for (const star of stars) {
      if (star.y < rows && star.x < cols && !isInExclusion(star.x, star.y)) {
        const twinkle = Math.sin(time * 0.001 + star.twinkle);
        if (twinkle > -0.3) {
          ctx.fillText(star.char, star.x * charWidth, star.y * charHeight);
        }
      }
    }

    // Sphere
    const centerX = cols / 2;
    const centerY = rows / 2;
    const radius = Math.min(cols / 4, rows / 2) * 0.9;

    ctx.fillStyle = color;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (isInExclusion(x, y)) continue;

        const dx = (x - centerX) / 2;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < radius) {
          const normX = dx / radius;
          const normY = dy / radius;
          const normZ = Math.sqrt(Math.max(0, 1 - normX * normX - normY * normY));

          const lat = Math.asin(normY);
          const lon = Math.atan2(normX, normZ) + angle;
          const normalizedLon = ((lon % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

          const edgeFade = Math.pow(normZ, 0.4);
          const light = normZ * 0.6 + normX * 0.25 + 0.15;
          const brightness = Math.max(0, Math.min(1, light * edgeFade));

          let char: string;
          if (isLand(-lat, normalizedLon)) {
            const idx = Math.floor(brightness * (LAND_CHARS.length - 1));
            char = LAND_CHARS[idx];
          } else {
            const idx = Math.floor(brightness * (OCEAN_CHARS.length - 1));
            char = OCEAN_CHARS[idx];
          }

          const alpha = 0.4 + brightness * 0.5;
          if (isLand(-lat, normalizedLon)) {
            ctx.fillStyle = `rgba(52, 211, 153, ${alpha})`;
          } else {
            ctx.fillStyle = `rgba(59, 130, 246, ${alpha})`;
          }
          ctx.fillText(char, x * charWidth, y * charHeight);
        }
      }
    }
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
      angleRef.current += 0.006;
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
    <div className="fixed inset-0 bg-[#0a0a14] overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0"
      />
    </div>
  );
}
