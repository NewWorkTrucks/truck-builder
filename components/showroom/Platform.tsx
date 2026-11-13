"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { isCapturing } from "@/lib/spec-snapshot";
import type { Explosion } from "./ExplodedParts";

/**
 * The floor the truck stands on: a soft pool of light, so the truck and its
 * shadow have a lighter ground to read against, and a thin platform ring at
 * its edge in the brand accent. Two flat quads, no lights or extra passes.
 */
const PLATFORM = {
  /** Radius of the light pool on the floor, metres. */
  poolRadius: 6,
  /** Pool colour at its centre and how strong it is there (0–1); it fades to nothing at the rim. */
  poolColor: "#9fb6d4",
  poolOpacity: 0.4,
  /** Platform ring: radius and width in metres, colour and strength (0–1). */
  ringRadius: 5.2,
  ringWidth: 0.025,
  ringColor: "#3EA6FF",
  ringOpacity: 0.3,
  /** Separated parts stay this far inside the ring, metres. */
  explodedMargin: 0.6,
} as const;

/** Soft radial pool: white at the centre, fading out at the rim (tinted by the material). */
const poolTexture = () => {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.45, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const _footprint = new THREE.Box3();
const _corner = new THREE.Vector2();
const _center = new THREE.Vector2();

/**
 * Centres the platform on the assembled truck's footprint, and grows it while
 * the parts separate so they always stand inside the ring (as far as `k`, 0–1,
 * of the way there).
 */
function placeOnFootprint(group: THREE.Group, explosion: Explosion) {
  _footprint.makeEmpty();
  let k = 0;
  for (const p of explosion.parts) {
    const box = explosion.boxes.get(p.id);
    if (!box) continue;
    _footprint.union(box);
    k = Math.max(k, explosion.eased(p.id));
  }
  if (_footprint.isEmpty()) return;
  _center.set((_footprint.min.x + _footprint.max.x) / 2, (_footprint.min.z + _footprint.max.z) / 2);
  // Farthest corner of any part once fully separated, seen from above.
  let reach = 0;
  for (const p of explosion.parts) {
    const box = explosion.boxes.get(p.id);
    if (!box) continue;
    for (const x of [box.min.x, box.max.x]) {
      for (const z of [box.min.z, box.max.z]) {
        _corner.set(x + p.offset[0], z + p.offset[2]);
        reach = Math.max(reach, _corner.distanceTo(_center));
      }
    }
  }
  const grown = Math.max(1, (reach + PLATFORM.explodedMargin) / PLATFORM.ringRadius);
  group.position.set(_center.x, 0, _center.y);
  group.scale.setScalar(1 + (grown - 1) * k);
}

/**
 * The truck's floor. On its own it sits fixed at the scene's centre (the
 * landing story). With `explosion` (builder, preview) it follows the truck's
 * footprint, grows as the parts separate, and stays out of the spec sheet's
 * picture.
 */
export default function Platform({ explosion }: { explosion?: Explosion }) {
  const ref = useRef<THREE.Group>(null);
  const pool = useMemo(() => poolTexture(), []);
  useEffect(() => () => pool.dispose(), [pool]);

  useFrame(() => {
    const group = ref.current;
    if (!group || !explosion) return;
    // The spec sheet's picture is the truck alone, on white.
    group.visible = !isCapturing();
    placeOnFootprint(group, explosion);
  });

  return (
    <group ref={ref}>
      {/* Drawn first (renderOrder -2) and without depth, so shadows and the truck land on top. */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.004} renderOrder={-2}>
        <circleGeometry args={[PLATFORM.poolRadius, 64]} />
        <meshBasicMaterial
          map={pool}
          color={PLATFORM.poolColor}
          opacity={PLATFORM.poolOpacity}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.006} renderOrder={-2}>
        <ringGeometry
          args={[PLATFORM.ringRadius - PLATFORM.ringWidth, PLATFORM.ringRadius, 128]}
        />
        <meshBasicMaterial
          color={PLATFORM.ringColor}
          opacity={PLATFORM.ringOpacity}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
