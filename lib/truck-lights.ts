/**
 * Lamps on the truck models: headlights, taillights. Each lamp is a spot light
 * that lights the scene, plus a visible beam (a soft cone) along the same aim.
 * Rendered by components/showroom/TruckLights.tsx and switched by the builder's
 * lights button.
 *
 * Lamps belong to the catalog item whose model carries them: headlights to the
 * vehicle, taillights to the body upfit (a chassis cab has no rear lamps until a
 * body is fitted). They move with that part when it slides or is shown apart.
 *
 * HOW TO ADJUST A LAMP
 * - Position: `position` is in the part's own model space, in metres, the space
 *   the GLB was authored in. Axes differ per model:
 *     RAM 2500HD CC + 696J parts: x = left/right (0 is the centreline), y = up
 *       (0 is the ground), z = front/back with the FRONT at -z.
 *     Chevrolet Express 3500: the front is at +x and the centreline is z = -0.09.
 *   To find a spot, read a mesh's bounds from the GLB (e.g. with glTF-Transform's
 *   getBounds) and put the lamp a couple of centimetres in front of the lens face,
 *   so the beam starts at the lens rather than inside it.
 * - Direction: `aim` is where the lamp points, relative to `position`. Its length
 *   does not matter, only its direction: [0, -0.6, -6] is "straight ahead and a
 *   little down" on the RAM. Point it further down to light the floor closer in.
 *   Both the light and the visible beam follow it.
 * - Color: any CSS color. It tints both the light and the visible beam.
 * - Brightness: `intensity` is the light's luminous intensity in candela (three.js
 *   physical light units). What the floor receives falls with the square of the
 *   distance, so doubling it is a modest change; try 2x or 0.5x steps. 0 lights
 *   nothing and leaves only the visible beam.
 * - Light shape: `angle` is the half-width of the lit cone in radians (0.5 is
 *   about 29 degrees each side), `penumbra` softens its edge (0 hard, 1 very
 *   soft), `distance` is where the light stops reaching in metres (0 = no limit).
 *   These shape what gets lit, not the visible beam.
 * - Visible beam: a cone `beamLength` metres long, `lensRadius` wide at the lamp
 *   and `beamRadius` wide at its far end (wider = more spread). `beamOpacity`
 *   (0–1) is how strong it looks; it fades out towards the far end on its own.
 *   `beamLength: 0` hides the beam and keeps only the light.
 *
 * To add lamps to another part, add an entry under its catalog id below.
 */
export type Lamp = {
  position: [number, number, number];
  aim: [number, number, number];
  color: string;
  intensity: number;
  angle: number;
  penumbra: number;
  distance: number;
  lensRadius: number;
  beamLength: number;
  beamRadius: number;
  beamOpacity: number;
};

/** Shared looks; each lamp below only says where it is and where it points. */
const HEADLIGHT = {
  color: "#fff4e0", // warm white
  intensity: 50,
  angle: 0.5,
  penumbra: 1,
  distance: 25,
  lensRadius: 0,
  beamLength: 1,
  beamRadius: 2,
  beamOpacity: 0.55,
} as const;

const TAILLIGHT = {
  color: "#ff1a1a",
  intensity: 3, // a red wash behind the truck, much weaker than the headlights
  angle: 0.9,
  penumbra: 1,
  distance: 4,
  lensRadius: 0.08,
  beamLength: 0.55,
  beamRadius: 1,
  beamOpacity: 1,
} as const;

type Look = Omit<Lamp, "position" | "aim">;
const lamp = (look: Look, position: Lamp["position"], aim: Lamp["aim"]): Lamp => ({
  ...look,
  position,
  aim,
});

/** Lamps per catalog id (vehicle or upfit). */
export const TRUCK_LIGHTS: Record<string, Lamp[]> = {
  // Headlights: the lens ("lente farol") is centred at x ±0.72, y 1.01, its face
  // at z -2.59; the pink reflector parts sit just inside it.
  "ram-2500hd-cc": [
    lamp(HEADLIGHT, [-0.72, 1.03, -2.52], [0, -0.6, -6]),
    lamp(HEADLIGHT, [0.72, 1.03, -2.52], [0, -0.6, -6]),
  ],
  // Taillights: the red lamps on the body's rear posts, x ±0.82, y 1.15, face at z 3.43.
  "ram-696j-body": [
    lamp(TAILLIGHT, [-0.82, 1.15, 3.42], [0, -0.4, 3]),
    lamp(TAILLIGHT, [0.82, 1.15, 3.42], [0, -0.4, 3]),
  ],
  // Headlights: the cluster either side of the grille, face at x 2.74, y 0.88.
  // The KUV129SU body has no taillight lens in its model, so it has no lamps yet.
  "chevy-express-3500": [
    lamp(HEADLIGHT, [2.78, 0.88, -0.78], [6, -0.6, 0]),
    lamp(HEADLIGHT, [2.78, 0.88, 0.6], [6, -0.6, 0]),
  ],
};
