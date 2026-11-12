import { PAINT_COLORS, PAINT_MATERIAL, type PaintColorId } from "@/lib/paint";
import type { Pose } from "../showroom/ScrollDirector";
import { HERO_BUILD } from "../showroom/scene-config";

/**
 * The scroll story's timeline. Scroll progress (0 at the top of the story,
 * 1 at its end) maps to a pose of the 3D scene, like frames of a video.
 * Beats follow the chapters in ScrollStory, and the scene eases between
 * neighbouring beats. The upfits chapter has two beats with the parts held
 * apart, so their labels stay up while it is read.
 */
export type Beat = Pose & {
  /** Position on the timeline, 0–1. */
  at: number;
};

const beat = (at: number, pose: Pose): Beat => ({ at, ...pose });

export const BEATS: Beat[] = [
  // Hero: the whole truck, front three-quarter, as in the old hero.
  beat(0, { spin: -2.7, dist: 12, elev: 0.33, ty: 1.2, shift: 0.2, lift: -0.2, explode: 0 }),
  // Chassis: push in on the cab, truck to the right of the text.
  beat(0.3, { spin: -3.3, dist: 9.5, elev: 0.2, ty: 1.5, shift: -0.2, lift: 0.2, explode: 0 }),
  // Upfits lift away, camera pulls back and swings to the side.
  beat(0.4, { spin: -4.2, dist: 15, elev: 0.4, ty: 1.5, shift: 0.1, lift: 0.2, explode: 1 }),
  // Held apart and labelled while the camera keeps turning.
  beat(0.56, { spin: -5.0, dist: 17.5, elev: 0.45, ty: 1.5, shift: 0.1, lift: 0.2, explode: 1 }),
  // Fit: back together, from the other side.
  beat(0.65, { spin: -8.0, dist: 12.5, elev: 0.28, ty: 1.2, shift: -0.20, lift: 0.2, explode: 0 }),
  // Finished truck, front three-quarter again, centred for the call to action.
  beat(1, { spin: -3 - 2 * Math.PI, dist: 13.5, elev: 0, ty: 2.5, shift: 0, lift: 0.2, explode: 0 }),
];

const smooth = (k: number) => k * k * (3 - 2 * k);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** The pose at `progress`: each pair of beats eased, so the scene settles on every beat. */
export function samplePose(progress: number): Pose {
  const p = Math.min(1, Math.max(0, progress));
  let i = 0;
  while (i < BEATS.length - 2 && p > BEATS[i + 1].at) i++;
  const a = BEATS[i];
  const b = BEATS[i + 1];
  const k = smooth(Math.min(1, Math.max(0, (p - a.at) / (b.at - a.at))));
  return {
    spin: lerp(a.spin, b.spin, k),
    dist: lerp(a.dist, b.dist, k),
    elev: lerp(a.elev, b.elev, k),
    ty: lerp(a.ty, b.ty, k),
    shift: lerp(a.shift, b.shift, k),
    lift: lerp(a.lift, b.lift, k),
    explode: lerp(a.explode, b.explode, k),
  };
}

/** The hero build's paint materials set to one colour, in the scene's `partColors` shape. */
export function heroColors(id: PaintColorId): Record<string, Record<string, string>> {
  const hex = PAINT_COLORS.find((c) => c.id === id)!.hex;
  const colors: Record<string, Record<string, string>> = {
    [HERO_BUILD.vehicleId]: { [PAINT_MATERIAL.vehicle]: hex },
  };
  // Bumpers are unpainted; the body and rack follow the vehicle.
  for (const upfit of HERO_BUILD.upfitIds) {
    if (!upfit.includes("bumper")) colors[upfit] = { [PAINT_MATERIAL.upfit]: hex };
  }
  return colors;
}
