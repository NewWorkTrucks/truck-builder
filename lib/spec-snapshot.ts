/** The spec sheet's picture of the build, with where each upfit's label goes on it. */
export type Snapshot = {
  url: string;
  /** Picture size in pixels. */
  width: number;
  height: number;
  /** Top centre of each upfit as fractions of the picture (0–1 from its top-left); a label sits above it. */
  labels: { id: string; label: string; x: number; y: number }[];
};

/** Lets the printable spec sheet ask the 3D builder view for a picture of the truck. */
let capture: (() => Snapshot | null) | null = null;
let printer: (() => Promise<void>) | null = null;

/** Registers the scene's capture function; returns the cleanup. */
export function registerSnapshot(fn: () => Snapshot | null) {
  capture = fn;
  return () => {
    if (capture === fn) capture = null;
  };
}

let capturing = false;

/** True while the spec sheet's picture is being drawn: on-screen extras (outlines) stay out of it. */
export const isCapturing = () => capturing;

/** Picture of the truck with its parts separated, or null when no scene is mounted. */
export function takeSnapshot() {
  capturing = true;
  try {
    return capture?.() ?? null;
  } finally {
    capturing = false;
  }
}

/** Transparent margin kept around the truck when trimming its picture, in pixels. */
const TRIM_PADDING = 8;

/**
 * PNG data URL of `canvas` cropped to its non-transparent pixels, so the
 * picture on the sheet carries no empty space around the truck, and the crop
 * in canvas pixels. Read straight after drawing, while the WebGL canvas still
 * holds the frame.
 */
export function trimmedPng(canvas: HTMLCanvasElement) {
  const { width, height } = canvas;
  const copy = document.createElement("canvas");
  copy.width = width;
  copy.height = height;
  const ctx = copy.getContext("2d", { willReadFrequently: true });
  const whole = () => ({ url: canvas.toDataURL("image/png"), left: 0, top: 0, width, height });
  if (!ctx) return whole();
  ctx.drawImage(canvas, 0, 0);
  const alpha = ctx.getImageData(0, 0, width, height).data;
  let top = height, left = width, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[(y * width + x) * 4 + 3] === 0) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (right < 0) return whole();
  left = Math.max(0, left - TRIM_PADDING);
  top = Math.max(0, top - TRIM_PADDING);
  const w = Math.min(width, right + TRIM_PADDING + 1) - left;
  const h = Math.min(height, bottom + TRIM_PADDING + 1) - top;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(copy, left, top, w, h, 0, 0, w, h);
  return { url: out.toDataURL("image/png"), left, top, width: w, height: h };
}

/** Registers the spec sheet's printer (it makes sure the picture is in the sheet first); returns the cleanup. */
export function registerPrint(fn: () => Promise<void>) {
  printer = fn;
  return () => {
    if (printer === fn) printer = null;
  };
}

/** Prints the spec sheet, picture included. Falls back to a plain print when no sheet is mounted. */
export const printSpecSheet = () => (printer ? printer() : void window.print());
