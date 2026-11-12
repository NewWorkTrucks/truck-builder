/** Lets the printable spec sheet ask the 3D builder view for a picture of the truck. */
let capture: (() => string | null) | null = null;
let printer: (() => Promise<void>) | null = null;

/** Registers the scene's capture function; returns the cleanup. */
export function registerSnapshot(fn: () => string | null) {
  capture = fn;
  return () => {
    if (capture === fn) capture = null;
  };
}

/** PNG data URL of the truck with its parts separated, or null when no scene is mounted. */
export const takeSnapshot = () => capture?.() ?? null;

/** Registers the spec sheet's printer (it makes sure the picture is in the sheet first); returns the cleanup. */
export function registerPrint(fn: () => Promise<void>) {
  printer = fn;
  return () => {
    if (printer === fn) printer = null;
  };
}

/** Prints the spec sheet, picture included. Falls back to a plain print when no sheet is mounted. */
export const printSpecSheet = () => (printer ? printer() : void window.print());
