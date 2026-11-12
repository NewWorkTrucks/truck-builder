/** Lets the printable spec sheet ask the 3D builder view for a picture of the truck. */
let capture: (() => string | null) | null = null;

/** Registers the scene's capture function; returns the cleanup. */
export function registerSnapshot(fn: () => string | null) {
  capture = fn;
  return () => {
    if (capture === fn) capture = null;
  };
}

/** PNG data URL of the truck with its parts separated, or null when no scene is mounted. */
export const takeSnapshot = () => capture?.() ?? null;
