"use client";

import { useState, useCallback, useMemo } from "react";
import AsciiEarth from "@/app/components/AsciiEarth";
import AsciiGalaxy from "@/app/components/AsciiGalaxy";
import AsciiBlackhole from "@/app/components/AsciiBlackhole";
import { homepageProjects } from "@/data/homepage-projects";
import type { ExclusionZone } from "@/app/components/AsciiEarth";

const STATUS_COLORS: Record<string, string> = {
  Live: "text-emerald-400",
  Building: "text-amber-400",
  Paused: "text-yellow-500",
  Failed: "text-rose-400",
};

type Scene = "earth" | "galaxy" | "blackhole";

// Layout in grid characters
const CARD_WIDTH_CHARS = 36;
const ITEM_HEIGHT_CHARS = 2; // each item (name or project)
const GAP_CHARS = 3; // gap between items
const PADDING_TOP_CHARS = 4;
const PADDING_BOTTOM_CHARS = 1;

export default function Page() {
  const [scene, setScene] = useState<Scene>("galaxy");
  const [gridInfo, setGridInfo] = useState<{
    charWidth: number;
    charHeight: number;
    cols: number;
    rows: number;
  } | null>(null);

  const onGridReady = useCallback(
    (charWidth: number, charHeight: number, cols: number, rows: number) => {
      setGridInfo({ charWidth, charHeight, cols, rows });
    },
    []
  );

  const totalItems = 1 + homepageProjects.length;

  const cardLayout = useMemo(() => {
    if (!gridInfo) return null;
    const { cols } = gridInfo;

    const contentCol = Math.floor((cols - CARD_WIDTH_CHARS) / 2);
    const startRow = PADDING_TOP_CHARS;

    // All items stacked from the top
    const items: { col: number; row: number }[] = [];
    let currentRow = startRow;
    for (let i = 0; i < totalItems; i++) {
      items.push({ col: contentCol, row: currentRow });
      currentRow += ITEM_HEIGHT_CHARS + GAP_CHARS;
    }

    // Single exclusion zone covering all items
    const totalHeight = currentRow - startRow - GAP_CHARS + PADDING_BOTTOM_CHARS;

    return {
      items, // [0] = name, [1..n] = projects
      contentCol,
      startRow,
      totalHeight,
    };
  }, [gridInfo, totalItems]);

  // Per-item exclusion zones — galaxy flows through the gaps
  const exclusionZones: ExclusionZone[] = useMemo(() => {
    if (!cardLayout) return [];
    return cardLayout.items.map((item) => ({
      col: item.col - 1,
      row: item.row,
      width: CARD_WIDTH_CHARS + 2,
      height: ITEM_HEIGHT_CHARS,
    }));
  }, [cardLayout]);

  const toPixels = (col: number, row: number) => {
    if (!gridInfo) return { left: 0, top: 0 };
    return {
      left: col * gridInfo.charWidth,
      top: row * gridInfo.charHeight,
    };
  };

  const Background = scene === "galaxy" ? AsciiGalaxy : scene === "blackhole" ? AsciiBlackhole : AsciiEarth;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Background exclusionZones={exclusionZones} onGridReady={onGridReady} />

      {/* Scene toggle */}
      <div className="fixed top-4 right-4 z-20 flex gap-2">
        {(["earth", "galaxy", "blackhole"] as Scene[]).map((s) => (
          <button
            key={s}
            onClick={() => setScene(s)}
            className={`px-3 py-1 text-xs rounded-full border transition ${
              scene === s
                ? "border-white/30 text-white bg-white/10"
                : "border-white/10 text-white/40 hover:text-white/70"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {gridInfo && cardLayout && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 1 }}>
          {/* Name */}
          {(() => {
            const item = cardLayout.items[0];
            const pos = toPixels(item.col, item.row);
            return (
              <div
                className="absolute pointer-events-auto flex items-center h-full"
                style={{
                  left: pos.left,
                  top: pos.top,
                  width: CARD_WIDTH_CHARS * gridInfo.charWidth,
                  height: ITEM_HEIGHT_CHARS * gridInfo.charHeight,
                }}
              >
                <h1 className="text-lg md:text-md font-bold text-white tracking-tight">
                  Adrian Axenie
                </h1>
              </div>
            );
          })()}

          {/* Project cards */}
          {homepageProjects.map((project, i) => {
            const item = cardLayout.items[i + 1];
            const pos = toPixels(item.col, item.row);
            return (
              <div
                key={project.name}
                className="absolute pointer-events-auto flex items-center justify-between"
                style={{
                  left: pos.left,
                  top: pos.top,
                  width: CARD_WIDTH_CHARS * gridInfo.charWidth,
                  height: ITEM_HEIGHT_CHARS * gridInfo.charHeight,
                }}
              >
                <a
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-white/80 hover:text-white transition-colors duration-150 hover:underline underline-offset-2"
                >
                  {project.name}
                </a>
                <span
                  className={`text-xs font-medium ${STATUS_COLORS[project.status] ?? "text-white/60"}`}
                >
                  {project.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
