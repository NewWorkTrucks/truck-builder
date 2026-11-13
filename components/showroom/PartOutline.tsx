"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { isCapturing } from "@/lib/spec-snapshot";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { isLightBeam } from "./TruckLights";

/** A white stroke with a soft glow, traced around the part's whole silhouette. */
const OUTLINE = {
  color: new THREE.Color(1, 1, 1),
  /** Brightness of the stroke. */
  strength: 8,
  /** Width of the stroke and its glow, in (half-resolution) pixels. */
  thickness: 4,
  /** Fades the glow out away from the edge. */
  glow: 1,
} as const;

/**
 * Not part of a model's shape: lamp beams and the dashed centre lines. They
 * are left out of the outline, so they are neither stroked themselves nor cut
 * into the stroke of the part behind them.
 */
const isOverlay = (o: THREE.Object3D) => isLightBeam(o) || (o as { isLine2?: boolean }).isLine2 === true;
const _hidden: THREE.Object3D[] = [];

/**
 * Draws a white outline with a soft glow around `root` (the vehicle or an upfit). While mounted
 * it renders the frame itself: the scene exactly as usual, then three's
 * OutlinePass blends the outline on top. Unmounted, the canvas goes back to
 * drawing the scene alone, at no extra cost.
 */
export default function PartOutline({ root }: { root: THREE.Object3D }) {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const invalidate = useThree((s) => s.invalidate);

  const pass = useMemo(() => {
    const p = new OutlinePass(new THREE.Vector2(1, 1), scene, camera, [root]);
    p.visibleEdgeColor.copy(OUTLINE.color);
    // Where other parts hide the upfit, draw nothing (the pass adds light, so black is none).
    p.hiddenEdgeColor.set(0, 0, 0);
    p.edgeStrength = OUTLINE.strength;
    p.edgeThickness = OUTLINE.thickness;
    p.edgeGlow = OUTLINE.glow;
    return p;
  }, [scene, camera, root]);

  useLayoutEffect(() => {
    pass.setSize(size.width * dpr, size.height * dpr);
    invalidate();
  }, [pass, size, dpr, invalidate]);

  // Show the outline now, and redraw without it once it goes.
  useLayoutEffect(
    () => () => {
      pass.dispose();
      invalidate();
    },
    [pass, invalidate],
  );

  // Priority 1 takes over this canvas's render while mounted.
  useFrame(({ gl, scene }) => {
    gl.render(scene, camera);
    // The spec sheet's picture shows the build, not what the pointer is on.
    if (isCapturing()) return;
    // The pass draws the scene again for its masks: the shadows are already up to date.
    const shadows = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    // Only the models count: hide beams and centre lines while the pass draws its masks.
    scene.traverse((o) => {
      if (o.visible && isOverlay(o)) _hidden.push(o);
    });
    for (const o of _hidden) o.visible = false;
    try {
      // A null read buffer is the screen: the outline is blended onto the frame just drawn.
      pass.render(gl, null!, null!, 0, false);
    } finally {
      for (const o of _hidden) o.visible = true;
      _hidden.length = 0;
      gl.shadowMap.autoUpdate = shadows;
    }
  }, 1);
  return null;
}
