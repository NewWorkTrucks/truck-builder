"use client";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { Lamp } from "@/lib/truck-lights";

/**
 * Beams are drawn on their own layer. The main camera draws it; the contact
 * shadow camera (layer 0 only) does not, so a beam never darkens the floor.
 */
export const BEAM_LAYER = 1;

/** Beams are effects, not truck: bounds, centring and framing skip them. */
export const isLightBeam = (o: THREE.Object3D) => o.userData.lightBeam === true;

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Visible beam: brightest at the lens, fading towards its far end, and softer
 * at the cone's edges than through its middle, like light in hazy air.
 */
const beamVertex = /* glsl */ `
  varying float vAlong;
  varying float vFacing;
  void main() {
    // CylinderGeometry: uv.y is 1 at the lens end, 0 at the far end.
    vAlong = uv.y;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFacing = abs(dot(n, normalize(-view.xyz)));
    gl_Position = projectionMatrix * view;
  }
`;
const beamFragment = /* glsl */ `
  uniform vec3 color;
  uniform float opacity;
  varying float vAlong;
  varying float vFacing;
  void main() {
    float alpha = opacity * pow(vAlong, 1.6) * pow(vFacing, 1.5);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

/**
 * One lamp: a spot light that lights what is in front of it, and a visible beam
 * along the same direction. Values come from lib/truck-lights.ts, which
 * explains each one.
 *
 * Switching off sets the intensity to 0 and hides the beam instead of removing
 * the light: changing how many lights a scene has makes three.js recompile
 * every material, which would stall the frame on each toggle.
 */
function LampLight({ lamp, on }: { lamp: Lamp; on: boolean }) {
  // The spot light points at this object; it sits `aim` away from the lamp.
  const [target] = useState(() => new THREE.Object3D());

  // A cone from the lens out along `aim`. The cylinder's top is the lens end;
  // it is moved to the lamp and turned from "down" to the aim direction.
  const geometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(
      lamp.lensRadius,
      lamp.beamRadius,
      lamp.beamLength,
      32,
      1,
      true,
    );
    g.translate(0, -lamp.beamLength / 2, 0);
    return g;
  }, [lamp.lensRadius, lamp.beamRadius, lamp.beamLength]);
  const rotation = useMemo(() => {
    const dir = new THREE.Vector3(...lamp.aim).normalize();
    return new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion().setFromUnitVectors(UP.clone().negate(), dir),
    );
  }, [lamp.aim]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          // Color converts the CSS (sRGB) value to the linear space shaders work in.
          color: { value: new THREE.Color(lamp.color) },
          opacity: { value: lamp.beamOpacity },
        },
        vertexShader: beamVertex,
        fragmentShader: beamFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        // Light adds to what is behind it.
        blending: THREE.AdditiveBlending,
      }),
    [lamp.color, lamp.beamOpacity],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  return (
    <group position={lamp.position}>
      <primitive object={target} position={lamp.aim} />
      <spotLight
        target={target}
        color={lamp.color}
        intensity={on ? lamp.intensity : 0}
        angle={lamp.angle}
        penumbra={lamp.penumbra}
        distance={lamp.distance}
        decay={2}
      />
      {lamp.beamLength > 0 && (
        <mesh
          geometry={geometry}
          material={material}
          rotation={rotation}
          visible={on}
          layers={BEAM_LAYER}
          userData={{ lightBeam: true }}
          raycast={() => null}
          renderOrder={1}
        />
      )}
    </group>
  );
}

/** Every lamp of one part, in that part's model space. */
export default function TruckLights({ lamps, on }: { lamps: Lamp[]; on: boolean }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.layers.enable(BEAM_LAYER);
  }, [camera]);
  return lamps.map((l, i) => <LampLight key={i} lamp={l} on={on} />);
}
