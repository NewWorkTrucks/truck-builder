"use client";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import Platform from "./Platform";

/**
 * Showroom dressing for the landing page's scroll story, added to the shared
 * turntable scene. Kept cheap for every device: no extra render passes.
 *
 * - The platform (light pool and ring) the builder also stands on, fixed here.
 * - Two rim lights behind the truck (the story's camera never leaves the
 *   front-right, see ScrollDirector), outlining the white truck against the
 *   dark page.
 * - Stronger studio reflections, so the clearcoat picks up highlights.
 */
const STAGE = {
  /** Rim lights behind the truck, opposite the camera. */
  rims: [
    { position: [-9, 5, -3] as const, color: "#cfe6ff", intensity: 2.4 },
    { position: [-3, 5, -9] as const, color: "#9cc8ff", intensity: 2 },
  ],
  /** Multiplier on the studio reflections (1 = as in the builder). */
  envIntensity: 1.2,
} as const;

export default function StoryStage() {
  const get = useThree((s) => s.get);

  useEffect(() => {
    const { scene, invalidate } = get();
    const before = scene.environmentIntensity;
    scene.environmentIntensity = STAGE.envIntensity;
    invalidate();
    return () => {
      scene.environmentIntensity = before;
    };
  }, [get]);

  return (
    <>
      <Platform />
      {STAGE.rims.map((r, i) => (
        <directionalLight key={i} position={r.position} color={r.color} intensity={r.intensity} />
      ))}
    </>
  );
}
