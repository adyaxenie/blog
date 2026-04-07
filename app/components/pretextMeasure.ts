import { prepareWithSegments, layout, layoutWithLines } from "@chenglou/pretext";

export interface GridMetrics {
  charWidth: number;
  charHeight: number;
  cols: number;
  rows: number;
}

const FONT = "14px monospace";
const LINE_HEIGHT = 16;

let cachedCharWidth: number | null = null;
let cachedCharHeight: number | null = null;

/**
 * Use pretext's prepareWithSegments + layoutWithLines to accurately measure
 * monospace character dimensions. We measure a known string and divide by
 * character count to get the per-character width.
 */
export function measureChar(): { charWidth: number; charHeight: number } {
  if (cachedCharWidth !== null && cachedCharHeight !== null) {
    return { charWidth: cachedCharWidth, charHeight: cachedCharHeight };
  }

  const testChars = "MMMMMMMMMM"; // 10 identical wide chars
  const prepared = prepareWithSegments(testChars, FONT);

  // layoutWithLines returns per-line { text, width } — use the first line's width
  const result = layoutWithLines(prepared, 100000, LINE_HEIGHT);

  let charWidth = 8.4; // fallback
  if (result.lines.length > 0 && result.lines[0].width > 0) {
    charWidth = result.lines[0].width / testChars.length;
  }

  const charHeight = result.height > 0 ? result.height : LINE_HEIGHT;

  cachedCharWidth = charWidth;
  cachedCharHeight = charHeight;

  return { charWidth, charHeight };
}

/**
 * Calculate grid dimensions for the viewport using pretext measurements.
 */
export function measureGrid(viewportWidth: number, viewportHeight: number): GridMetrics {
  const { charWidth, charHeight } = measureChar();
  const cols = Math.floor(viewportWidth / charWidth);
  const rows = Math.floor(viewportHeight / charHeight);
  return { charWidth, charHeight, cols, rows };
}

export { FONT, LINE_HEIGHT };
