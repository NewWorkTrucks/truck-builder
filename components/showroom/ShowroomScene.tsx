"use client";
import { getUpfit, getVehicle, upfitsForVehicle } from "@/lib/catalog";
import {
  AdaptiveDpr,
  ContactShadows,
  Environment,
  Lightformer,
  OrbitControls,
  PerformanceMonitor,
  useGLTF,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Suspense,
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { EXPLODE_TIMING, explodePlan, type ExplodePart } from "@/lib/explode";
import { PAINT_MATERIAL } from "@/lib/paint";
import { registerSnapshot } from "@/lib/spec-snapshot";
import { TRUCK_LIGHTS } from "@/lib/truck-lights";
import { ScrollDirector, type ScrollStory } from "./ScrollDirector";
import TruckLights, { isLightBeam } from "./TruckLights";
import { getRenderBudget } from "@/lib/render-budget";
import RenderStats, { statsEnabled } from "../three/RenderStats";
import {
  FrameCap,
  FrameRateIndependentDamping,
  RenderGate,
} from "../three/render-loop";
import {
  rememberFadeBase,
  CenterLines,
  ExplodeCamera,
  ExplodeDriver,
  ExplodeLabels,
  LabelOverlay,
  fitExplodedRadius,
  toolbarInset,
  ExplodeGroup,
  Explosion,
  NO_SLIDE,
  Presence,
  PresenceDriver,
  easeInOut,
  nextSlide,
  type Slide,
} from "./ExplodedParts";
import {
  CAMERA,
  DISC,
  AUTO_ROTATE_FPS,
  FILL_POSITION,
  KEY_POSITION,
  MOTION,
  RIM_POSITION,
  SCENE_THEMES,
  SHADOW,
  type HeroTheme,
} from "./scene-config";

const TICK_COUNT = 36 * 2;

/** `id` is the catalog id, absent for a `model` override. */
type Part = { id?: string; url: string; position?: [number, number, number] };

/** Paint material name -> sRGB hex. Materials not listed keep their GLB color. */
type MaterialColors = Record<string, string>;

const PAINT_MATERIALS = new Set<string>(Object.values(PAINT_MATERIAL));

const partFor = (item: {
  id: string;
  fileName: string;
  position?: [number, number, number];
}): Part => ({
  id: item.id,
  url: `/models/${item.fileName}`,
  position: item.position,
});

type Props = {
  /** The vehicle and its installed upfits, rendered in catalog order. */
  vehicleId: string;
  upfitIds: string[];
  /** Per catalog id, repaints that part's paint material; parts not listed keep their GLB colors. */
  partColors?: Record<string, MaterialColors>;
  /** Orbit only: parts separated ("Show parts"). Omitted, the truck stays assembled. */
  exploded?: boolean;
  /** Shows the "Show parts" toggle in the orbit toolbar. */
  onExplodedChange?: (exploded: boolean) => void;
  /** Optional GLB URL replacing the catalog build. */
  model?: string;
  theme: HeroTheme;
  /** Lighting theme when it differs from the disc and ticks. */
  lightsTheme?: HeroTheme;
  /**
   * "turntable": fixed camera, the model spins on the disc (drag / arrow keys).
   * "orbit": free OrbitControls around a stationary model.
   */
  interaction: "turntable" | "orbit";
  /** Narrow (<768px) layout: pulled-back camera. Turntable only. */
  mobile?: boolean;
  /** False stops rendering (off-screen or hidden tab). */
  active?: boolean;
  /** Element that receives drag and arrow-key input. Turntable only. */
  inputTarget?: HTMLElement | null;
  /** Poster rendering: hold the initial rotation. */
  still?: boolean;
  /** Headlights and taillights (lib/truck-lights.ts). Omitted, the truck has no lamps at all. */
  lightsOn?: boolean;
  /**
   * Turntable only: page scroll drives the camera, the turntable angle and the
   * parts (see ScrollDirector), in place of auto-rotate and drag.
   */
  story?: ScrollStory;
  /** True after the first frame with every model shown; false while loading. */
  onReady: (ready: boolean) => void;
};

/** Turntable angle plus the idle/auto-rotate rules. Mutated outside React's render. */
class Spin {
  angle = MOTION.initialRotation;
  private reduced = false;
  /** -Infinity holds still until start(). */
  private lastInput = -Infinity;

  setReducedMotion(v: boolean) {
    this.reduced = v;
  }
  /** Auto-rotate now (the model just appeared), with no post-input pause. */
  start() {
    this.lastInput = performance.now() - MOTION.resumeAfterMs;
  }
  /** Held by something else (scroll story) that sets the angle every frame. */
  setAngle(radians: number) {
    this.angle = radians;
  }
  nudge(radians: number) {
    this.angle += radians;
    this.lastInput = performance.now();
  }
  hold() {
    this.lastInput = performance.now();
  }
  step(delta: number) {
    const since = performance.now() - this.lastInput;
    if (!this.reduced && since > MOTION.resumeAfterMs && since < MOTION.stopAfterMs)
      this.angle += MOTION.autoRotate * Math.min(delta, 0.1);
  }
}

/**
 * True until `ms` after the last restart() while `armed`, so the auto-rotate
 * frame loop stops with the rotation instead of rendering still frames.
 */
function useAutoRotateWindow(armed: boolean, ms: number) {
  const [run, setRun] = useState(0);
  const [expired, setExpired] = useState(-1);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setExpired(run), ms);
    return () => clearTimeout(id);
  }, [armed, run, ms]);
  const restart = useCallback(() => setRun((r) => r + 1), []);
  return [expired !== run, restart] as const;
}

function CameraRig({ mobile }: { mobile: boolean }) {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    const [x, y, z] = mobile ? CAMERA.mobile : CAMERA.desktop;
    camera.position.set(x, y, z);
    camera.lookAt(CAMERA.target[0], CAMERA.target[1], CAMERA.target[2]);
    camera.updateProjectionMatrix();
  }, [camera, mobile]);
  return null;
}

export function Lights({ theme }: { theme: HeroTheme }) {
  const c = SCENE_THEMES[theme];
  const map = SHADOW.map;
  return (
    <>
      <hemisphereLight args={[c.hemi.sky, c.hemi.ground, c.hemi.intensity]} />
      <directionalLight
        color={c.key.color}
        intensity={c.key.intensity}
        position={KEY_POSITION}
        castShadow
        shadow-mapSize={[map, map]}
        shadow-camera-left={-SHADOW.extent}
        shadow-camera-right={SHADOW.extent}
        shadow-camera-top={SHADOW.extent}
        shadow-camera-bottom={-SHADOW.extent}
        shadow-bias={SHADOW.bias}
      />
      <directionalLight
        color={c.rim.color}
        intensity={c.rim.intensity}
        position={RIM_POSITION}
      />
      <directionalLight
        color={c.fill.color}
        intensity={c.fill.intensity}
        position={FILL_POSITION}
      />
    </>
  );
}

export function Turntable({ theme }: { theme: HeroTheme }) {
  const c = SCENE_THEMES[theme];
  return (
    <>
      <mesh position={[0, DISC.height / 2, 0]} receiveShadow>
        <cylinderGeometry args={[DISC.radius, DISC.radius, DISC.height, 96]} />
        <meshStandardMaterial {...c.disc} />
      </mesh>
      <mesh position={[0, DISC.height, 0]} rotation={[Math.PI / 2, 0, 0]}>
        {/* <torusGeometry args={[DISC.radius - 0.05, 0.04, 12, 160]} /> */}
        <meshStandardMaterial {...c.ring} />
      </mesh>
    </>
  );
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    for (const m of Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]) {
      for (const v of Object.values(m)) {
        if (v instanceof THREE.Texture) v.dispose();
      }
      m.dispose();
    }
  });
}

/**
 * Paint (vehicle and upfit) as lacquer (3D-MODELING-GUIDELINES §3, §4): the GLB's
 * standard material becomes a physical one with a clearcoat, so the studio strips
 * read as sharp highlight lines over the colour. Deliberately glossier than the
 * guidelines' satin powder coat for upfits.
 */
const glossyPaint = (mat: THREE.MeshStandardMaterial) => {
  const gloss = new THREE.MeshPhysicalMaterial();
  // Standard's copy: Physical's own would read clearcoat fields the source lacks.
  THREE.MeshStandardMaterial.prototype.copy.call(gloss, mat);
  gloss.roughness = 0.4;
  gloss.metalness = 0.2;
  gloss.clearcoat = 1;
  gloss.clearcoatRoughness = 0.05;
  return gloss;
};

const Model = ({ url, position, colors }: Part & { colors?: MaterialColors }) => {
  const { scene } = useGLTF(url);
  const invalidate = useThree((s) => s.invalidate);
  // Clone so the same GLB can be re-mounted without stealing the cached scene.
  // scene.clone shares materials with the cache, so every material gets its own
  // copy: repainting or fading this truck's part never touches another truck's
  // (hero vs builder). Paint materials are tracked for recolouring.
  const { object, paint } = useMemo(() => {
    const o = scene.clone(true);
    const own = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    const paint: THREE.MeshStandardMaterial[] = [];
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = m.receiveShadow = true;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (!own.has(mat)) {
        const copy = PAINT_MATERIALS.has(mat.name) ? glossyPaint(mat) : mat.clone();
        copy.userData.fadeBase = rememberFadeBase(copy);
        own.set(mat, copy);
        if (PAINT_MATERIALS.has(mat.name)) paint.push(copy);
      }
      m.material = own.get(mat)!;
    });
    return { object: o, paint };
  }, [scene]);
  useEffect(() => () => disposeObject(object), [object]);

  // Before the frame is drawn, so a new model never flashes its GLB color.
  useLayoutEffect(() => {
    if (!colors) return;
    const next = new THREE.Color();
    let changed = false;
    for (const mat of paint) {
      const hex = colors[mat.name];
      if (!hex) continue;
      // Hex is sRGB; Color stores linear (ColorManagement), as the renderer expects.
      next.setStyle(hex, THREE.SRGBColorSpace);
      if (mat.color.equals(next)) continue;
      mat.color.copy(next);
      changed = true;
    }
    // One frame, not a loop: RenderGate merges the models' requests.
    if (changed) invalidate();
  }, [paint, colors, invalidate]);

  return <primitive object={object} position={position} />;
};

const ROOM_URL = "/models/nwt_workshop_room.glb";

/** Linear multiplier on the room's vertex colours. */
const ROOM_BRIGHTNESS = 0.42;

/** Behind this colour the open front of the room shows; close to the room's wall tone. */
const ROOM_BACKDROP = "#2a3038";

/**
 * Room nodes that stand in the camera's way when it orbits outside the room
 * (phones and the exploded view pull back past the walls): each is hidden
 * while the camera is beyond its side. Coordinates are the room's, in metres.
 */
const ROOM_WALLS: { nodes: RegExp; hiddenWhen: (c: THREE.Vector3) => boolean }[] = [
  // three.js turns the spaces in node names into underscores, hence [ _].
  { nodes: /^Left[ _]wall$/, hiddenWhen: (c) => c.x < -11.7 },
  { nodes: /^(Right[ _]wall|Garage[ _]door)/, hiddenWhen: (c) => c.x > 11.5 },
  { nodes: /^(Rear[ _]wall|NWT[ _])|^Website[ _]sign/, hiddenWhen: (c) => c.z < -8.5 },
];

const setVisible = (objects: THREE.Object3D[], visible: boolean) => {
  for (const o of objects) o.visible = visible;
};

/** Soft dark ellipse: black in the middle, fading to nothing at the rim. */
const footprintTexture = () => {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(0,0,0,0.85)");
  g.addColorStop(0.55, "rgba(0,0,0,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
};

/**
 * The turntable's shadow. A shadow baked once would stay put while the truck
 * spins, so this one is a part of the spinning group: same ground footprint
 * at every angle, as the truck is a rigid shape. Sized by Truck once the parts
 * are measured.
 */
const FootprintShadow = forwardRef<THREE.Mesh>(function FootprintShadow(_, ref) {
  const map = useMemo(() => footprintTexture(), []);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position-y={0.01} renderOrder={-1}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={map} transparent depthWrite={false} />
    </mesh>
  );
});

/** Sits the parts on the disc with the ticks; the turntable also spins them. */
function Truck({
  vehicleId,
  parts,
  partColors,
  explosion,
  presence,
  plan,
  onSlideSettled,
  theme,
  spin,
  still,
  lightsOn,
}: {
  vehicleId: string;
  parts: Part[];
  partColors?: Record<string, MaterialColors>;
  /** Present when parts can be separated; `plan` gives each part's offset. */
  explosion?: Explosion;
  /** Present with `explosion`: upfits slide in and out as the build changes. */
  presence?: Presence;
  plan?: ExplodePart[];
  onSlideSettled?: () => void;
  theme: HeroTheme;
  /** Present for the turntable: centers the parts and rotates the group. */
  spin?: Spin;
  still: boolean;
  lightsOn?: boolean;
}) {
  const spinner = useRef<THREE.Group>(null);
  const truck = useRef<THREE.Group>(null);
  const footprint = useRef<THREE.Mesh>(null);
  const key = parts.map((p) => p.url).join("|");

  // Upfits that just left the build stay mounted until they have slid out.
  // Derived while rendering (React's way to adjust state when a prop changes).
  const [slide, setSlide] = useState<Slide<Part>>(NO_SLIDE);
  const [seen, setSeen] = useState({ vehicleId, parts, plan: plan ?? [] });
  if (plan && seen.plan !== plan) {
    setSeen({ vehicleId, parts, plan });
    setSlide(nextSlide(seen, { vehicleId, parts, plan }, slide));
  }
  const onGone = useCallback(
    (ids: string[]) =>
      setSlide((s) => ({ ...s, leaving: s.leaving.filter((l) => !ids.includes(l.part.id!)) })),
    [],
  );
  // A different vehicle appears whole.
  useLayoutEffect(() => presence?.reset(), [presence, vehicleId]);
  const leavingIds = new Set(slide.leaving.map((l) => l.part.id));
  const shown = [
    ...parts.map((p) => ({ p, ex: plan?.find((x) => x.id === p.id), leaving: false })),
    ...slide.leaving
      .filter((l) => !parts.some((q) => q.id === l.part.id))
      .map((l) => ({ p: l.part, ex: l.plan, leaving: true })),
  ];
  // Center on the disc and rest the lowest point on its top face. Re-runs when
  // the parts change or the Suspense boundary reveals them again.
  useLayoutEffect(() => {
    if (!spin) return;
    const g = truck.current!;
    g.position.set(0, 0, 0);
    // Precise: the corners of a rotated part's local box hang far below its
    // vertices, which would lift the truck off the disc. Center lines are Line2
    // meshes whose quad geometry spans ±1 m: they are not part of the truck.
    const box = new THREE.Box3();
    const part = new THREE.Box3();
    g.updateWorldMatrix(true, true);
    g.traverse((o) => {
      const mesh = o as THREE.Mesh & { isLine2?: boolean };
      if (mesh.isMesh && !mesh.isLine2 && !isLightBeam(mesh))
        box.union(part.makeEmpty().expandByObject(mesh, true));
    });
    const center = box.getCenter(new THREE.Vector3());
    g.position.set(-center.x, DISC.height - box.min.y, -center.z);
    // The shadow spans the truck, a little wider than its footprint.
    const size = box.getSize(new THREE.Vector3());
    footprint.current?.scale.set(size.x * 1.25, size.z * 1.12, 1);
  }, [spin, key]);

  // Before the labels (priority 0) project the parts, so they use this frame's angle.
  useFrame((_, delta) => {
    if (!spin) return;
    if (!still) spin.step(delta);
    spinner.current!.rotation.y = spin.angle;
  }, -2);

  return (
    <group ref={spinner}>
      {spin && <FootprintShadow ref={footprint} />}
      <group ref={truck}>
        {shown.map(({ p, ex, leaving }) => {
          const lamps = lightsOn !== undefined && p.id ? TRUCK_LIGHTS[p.id] : undefined;
          const model = (
            <>
              <Model {...p} colors={p.id ? partColors?.[p.id] : undefined} />
              {/* Lamps are in the part's model space, so they share its placement. */}
              {lamps && (
                <group position={p.position}>
                  <TruckLights lamps={lamps} on={lightsOn!} />
                </group>
              )}
            </>
          );
          return explosion && presence && ex ? (
            <ExplodeGroup
              key={p.url}
              explosion={explosion}
              presence={presence}
              part={ex}
              enterDelay={slide.enter[ex.id]}
              leaveDelay={leaving || leavingIds.has(ex.id) ? (slide.leave[ex.id] ?? 0) : undefined}
            >
              {model}
            </ExplodeGroup>
          ) : (
            <group key={p.url}>{model}</group>
          );
        })}
        {explosion && plan && <CenterLines explosion={explosion} plan={plan} />}
        {presence && onSlideSettled && (
          <PresenceDriver presence={presence} onGone={onGone} onSettled={onSlideSettled} />
        )}
      </group>
    </group>
  );
}

/**
 * Mounted inside the models' Suspense boundary, so it only reports ready once
 * every model is loaded and a frame has been drawn. Layout effects are cleaned
 * up when the boundary suspends again (e.g. on a vehicle change).
 */
function ReadySignal({ onReady }: { onReady: (ready: boolean) => void }) {
  const done = useRef(false);
  useLayoutEffect(() => {
    done.current = false;
    return () => onReady(false);
  }, [onReady]);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    onReady(true);
  });
  return null;
}

const ORBIT_CAMERA: [number, number, number] = [10, 5, 5];
/** Narrowest aspect ratio at which the whole truck fits at the base distance. */
const FIT_ASPECT = 1.5;
/** Zoom range around the fitted distance: never inside the truck, never losing it. */
const ZOOM = { in: 0.6, out: 1.6 };

/**
 * The camera's field of view is vertical, so a tall, narrow viewport (a phone
 * in portrait) crops the truck's length. This pulls the camera back to compensate.
 */
const fitDistance = (aspect: number) =>
  Math.hypot(...ORBIT_CAMERA) * Math.max(1, FIT_ASPECT / aspect);

/** OrbitControls fitted to the viewport, with zoom limited around that distance. */
function OrbitRig({
  explodeFit,
  toolbarRef,
}: {
  explodeFit: number | null;
  toolbarRef: React.RefObject<HTMLElement | null>;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const fit = fitDistance(size.width / size.height);
  useEffect(() => {
    camera.position.setLength(fit);
  }, [camera, fit]);

  // The toolbar covers the top of the canvas, so the truck sits optically high.
  // Shift the image down by half the toolbar's height to center it in the free area.
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const shift = toolbarInset(toolbarRef.current, gl.domElement) * 1.5;
    cam.setViewOffset(size.width, size.height, 0, -shift, size.width, size.height);
    invalidate();
    return () => cam.clearViewOffset();
  }, [camera, gl, size, toolbarRef, invalidate]);

  return (
    <OrbitControls
      makeDefault
      enableDamping
      enableZoom
      minDistance={fit * ZOOM.in}
      maxDistance={Math.max(fit, explodeFit ?? 0) * ZOOM.out}
      enablePan={false}
      minPolarAngle={POLAR.min}
      maxPolarAngle={POLAR.max}
    />
  );
}

type View = "front34" | "side" | "rear" | "top" | "reset";

/** Preset buttons, always visible in the orbit view (3D-MODELING-GUIDELINES §5). */
const VIEWS: { id: View; label: string }[] = [
  { id: "front34", label: "Front 3/4" },
  { id: "side", label: "Side" },
  { id: "rear", label: "Rear" },
  { id: "top", label: "Top" },
  { id: "reset", label: "Reset view" },
];

/** Polar limits; the top preset sits just inside the upper one. */
const POLAR = { min: 0.05, max: Math.PI / 2.5 };

/** Camera direction for a preset. Side is the driver's (left) side. */
function viewSpherical(view: View, front: [number, number], radius: number) {
  const ahead = Math.atan2(front[0], front[1]);
  const at = (polar: number, azimuth: number) =>
    new THREE.Spherical(radius, polar, azimuth);
  switch (view) {
    case "front34":
      return at(1.05, ahead + Math.PI / 4);
    case "side":
      return at(1.2, ahead + Math.PI / 2);
    case "rear":
      return at(1.2, ahead + Math.PI);
    case "top":
      return at(POLAR.min, ahead + Math.PI / 2);
    case "reset":
      return new THREE.Spherical().setFromVector3(
        new THREE.Vector3(...ORBIT_CAMERA).setLength(radius),
      );
  }
}

/** Eases the orbit camera to the requested preset; jumps under reduced motion. */
function ViewTransition({
  request,
  front,
  reduced,
  explodeFit,
  explosion,
  toolbarRef,
  onExplodeFit,
}: {
  request: { view: View; n: number } | null;
  front: [number, number];
  reduced: boolean;
  /** While exploded, presets keep every part in view. */
  explodeFit: number | null;
  explosion?: Explosion;
  toolbarRef: React.RefObject<HTMLElement | null>;
  onExplodeFit: (radius: number) => void;
}) {
  const gl = useThree((s) => s.gl);
  const height = useThree((s) => s.size.height);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const aspect = useThree((s) => s.size.width / s.size.height);
  const invalidate = useThree((s) => s.invalidate);
  const handled = useRef(0);
  const tween = useRef<{ from: THREE.Spherical; to: THREE.Spherical; t0: number } | null>(
    null,
  );

  useEffect(() => {
    if (!request || !controls || handled.current === request.n) return;
    handled.current = request.n;
    const from = new THREE.Spherical().setFromVector3(
      camera.position.clone().sub(controls.target),
    );
    const to = viewSpherical(request.view, front, Math.max(fitDistance(aspect), explodeFit ?? 0));
    if (explosion?.exploded) {
      // Fit the separated parts from the new direction, not the old one.
      const topFree = 1 - (2 * toolbarInset(toolbarRef.current, gl.domElement)) / height;
      const r = fitExplodedRadius(
        explosion,
        camera as THREE.PerspectiveCamera,
        controls.target,
        Math.max(0.2, topFree),
        new THREE.Vector3().setFromSpherical(to),
      );
      if (r > to.radius) {
        to.radius = r;
        onExplodeFit(r);
      }
    }
    // Go the short way round.
    to.theta = from.theta + Math.atan2(Math.sin(to.theta - from.theta), Math.cos(to.theta - from.theta));
    tween.current = { from, to, t0: performance.now() };
    invalidate();
    // explodeFit is read when a preset is chosen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, controls, camera, front, aspect, invalidate]);

  useFrame(() => {
    const tw = tween.current;
    if (!tw || !controls) return;
    const k = reduced ? 1 : Math.min(1, (performance.now() - tw.t0) / MOTION.viewTransitionMs);
    const e = easeInOut(k);
    const lerp = (a: number, b: number) => a + (b - a) * e;
    camera.position
      .setFromSpherical(
        new THREE.Spherical(
          lerp(tw.from.radius, tw.to.radius),
          lerp(tw.from.phi, tw.to.phi),
          lerp(tw.from.theta, tw.to.theta),
        ),
      )
      .add(controls.target);
    controls.update();
    if (k < 1) invalidate();
    else tween.current = null;
  }, -1);
  return null;
}

/**
 * Registers a capture of the truck with its parts separated, framed from the
 * front 3/4 with every part in view. It poses the scene, draws one frame and
 * puts everything back within the same task, so the user never sees it.
 */
function SnapshotRig({
  explosion,
  front,
  loaded,
}: {
  explosion: Explosion;
  front: [number, number];
  loaded: boolean;
}) {
  const get = useThree((s) => s.get);
  useEffect(
    () =>
      registerSnapshot(() => {
        const { gl, scene, camera, advance } = get();
        const controls = get().controls as OrbitControlsImpl | null;
        const cam = camera as THREE.PerspectiveCamera;
        if (!controls || !loaded) return null;
        const savedPosition = cam.position.clone();
        const savedView = cam.view ? { ...cam.view } : null;
        const savedBackground = scene.background;
        const restore = explosion.pose(1);
        try {
          // Fit from the preset direction, with no toolbar offset.
          cam.clearViewOffset();
          const dir = new THREE.Vector3().setFromSpherical(viewSpherical("front34", front, 1));
          const radius = fitExplodedRadius(explosion, cam, controls.target, 1, dir);
          cam.position.copy(dir.multiplyScalar(radius)).add(controls.target);
          cam.lookAt(controls.target);
          scene.background = null; // transparent: the sheet is white, not the dark room
          advance(performance.now());
          return gl.domElement.toDataURL("image/png");
        } finally {
          // Never leave the live view exploded or re-framed, even if drawing threw.
          scene.background = savedBackground;
          restore();
          cam.position.copy(savedPosition);
          cam.lookAt(controls.target);
          if (savedView) {
            cam.setViewOffset(
              savedView.fullWidth,
              savedView.fullHeight,
              savedView.offsetX,
              savedView.offsetY,
              savedView.width,
              savedView.height,
            );
          }
          advance(performance.now());
        }
      }),
    [get, explosion, front, loaded],
  );
  return null;
}

/** Orbit speed in rad/s (OrbitControls' autoRotateSpeed 1: one turn a minute). */
const ORBIT_RATE = (2 * Math.PI) / 60;

/**
 * OrbitControls' own autoRotate re-invalidates every frame, which would run
 * at the display rate. Drive the orbit from the auto-rotate FrameCap instead.
 */
function AutoRotate({ enabled }: { enabled: boolean }) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const get = useThree((s) => s.get);
  const onTick = useCallback(
    (dt: number) => {
      const c = get().controls as OrbitControlsImpl | null;
      if (!c) return;
      // Undamped step: with damping, each tick leaves most of its rotation
      // pending, so after auto-rotate stops every later frame (a paint change)
      // would nudge the camera and request extra frames.
      const damping = c.enableDamping;
      c.enableDamping = false;
      c.setAzimuthalAngle(c.getAzimuthalAngle() - ORBIT_RATE * dt);
      c.enableDamping = damping;
    },
    [get],
  );
  return (
    <FrameCap enabled={enabled && !!controls} fps={AUTO_ROTATE_FPS} onTick={onTick} />
  );
}

/** Extra fill for the orbit view, which has no theme exposure. */
function OrbitFill() {
  return (
    <>
      <ambientLight intensity={1} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
    </>
  );
}

/**
 * Studio reflections for both views (3D-MODELING-GUIDELINES §4): overhead and
 * side strips, rendered once, never shown as background. Memoized: drei
 * re-renders the cubemap whenever its children change identity, i.e. on every
 * parent render (a paint change, a view preset).
 */
const StudioEnvironment = memo(function StudioEnvironment() {
  return (
    <>
      <Environment resolution={256} frames={1} 
      files="/hdri/main.hdr" background={false}
      >
        {/* dim grey room: where no strip is, mirrors and clearcoat reflect this, not black */}
        <color attach="background" args={["#5a6270"]} />
        {/* overhead softbox: long highlight along the roof and service body */}
        <Lightformer
          form="rect"
          intensity={3}
          position={[0, 6, 0]}
          rotation-x={Math.PI / 2}
          scale={[12, 2, 1]}
        />
        {/* side strips: highlight lines along the doors */}
        <Lightformer
          form="rect"
          intensity={2}
          position={[-6, 2, 0]}
          rotation-y={Math.PI / 2}
          scale={[10, 1.2, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2}
          position={[6, 2, 0]}
          rotation-y={-Math.PI / 2}
          scale={[10, 1.2, 1]}
        />
        {/* cool rim from behind: pick out the silhouette */}
        <Lightformer
          form="ring"
          color="#3EA6FF"
          intensity={1.5}
          position={[-5, 3, -6]}
          scale={3}
        />
      </Environment>
    </>
  );
});

/**
 * Contact shadows baked in one frame. drei restarts the bake on every render,
 * so render only when `version` changes: when the parts change or finish loading.
 */
const BakedShadows = memo(function BakedShadows({ version }: { version: string }) {
  return <ContactShadows key={version} frames={1} />;
});

export default function ShowroomScene({
  vehicleId,
  upfitIds,
  partColors,
  exploded = false,
  onExplodedChange,
  model,
  theme,
  lightsTheme = theme,
  interaction,
  mobile = false,
  active = true,
  inputTarget = null,
  still = false,
  lightsOn,
  story,
  onReady,
}: Props) {
  const turntable = interaction === "turntable";
  const parts = useMemo<Part[]>(() => {
    if (model) return [{ url: model }];
    const vehicle = getVehicle(vehicleId);
    return [vehicle, ...upfitIds.map(getUpfit)]
      .filter((i) => i !== undefined)
      .map(partFor);
  }, [model, vehicleId, upfitIds]);
  const [spin] = useState(() => new Spin());
  const explodable = !model && (!turntable || !!story);
  const plan = useMemo(() => explodePlan(vehicleId, upfitIds), [vehicleId, upfitIds]);
  const [explosion] = useState(() => new Explosion());
  const [presence] = useState(() => new Presence());
  /** Bumped when parts arrive, so baked shadows re-render once per animation. */
  const [settleCount, setSettleCount] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [explodeFit, setExplodeFit] = useState<number | null>(null);
  /** Screen-reader announcement; empty until the first toggle so nothing is read on load. */
  const [announcement, setAnnouncement] = useState("");
  const toggleExploded = () => {
    const next = !exploded;
    setAnnouncement(next ? "Parts separated" : "Parts put back together");
    onExplodedChange?.(next);
  };
  const firstToggle = useRef(true);
  const [reduced, setReduced] = useState(false);
  // Orbit auto-rotate stops on click and resumes for the next vehicle.
  const [stoppedFor, setStoppedFor] = useState<string | null>(null);
  const [budget] = useState(getRenderBudget);
  const invalidateRef = useRef<() => void>(() => {});
  const [loaded, setLoaded] = useState(false);
  const [autoWindow, restartAuto] = useAutoRotateWindow(loaded, MOTION.stopAfterMs);
  const [viewRequest, setViewRequest] = useState<{ view: View; n: number } | null>(null);
  const front = getVehicle(vehicleId)?.front ?? [1, 0];

  const handleReady = useCallback(
    (r: boolean) => {
      setLoaded(r);
      if (r) {
        spin.start();
        restartAuto();
      }
      onReady(r);
    },
    [spin, restartAuto, onReady],
  );

  const selectView = (view: View) => {
    setStoppedFor(vehicleId);
    setViewRequest((prev) => ({ view, n: (prev?.n ?? 0) + 1 }));
  };

  // Free the GLB cache with the scene.
  const urlsRef = useRef<string[]>([]);
  useEffect(() => {
    urlsRef.current = parts.map((p) => p.url);
  }, [parts]);
  useEffect(() => () => useGLTF.clear(urlsRef.current), []);

  // Once the truck is up, fetch the vehicle's other upfits in the background so
  // picking one is instant: a part that isn't cached suspends the whole scene.
  const preloadedRef = useRef<string[]>([]);
  useEffect(() => {
    if (!loaded || !explodable || story) return;
    const urls = upfitsForVehicle(vehicleId).map((u) => partFor(u).url);
    urls.forEach((url) => useGLTF.preload(url));
    preloadedRef.current = urls;
  }, [loaded, explodable, story, vehicleId]);
  useEffect(() => () => useGLTF.clear(preloadedRef.current), []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      spin.setReducedMotion(mq.matches);
      presence.setReduced(mq.matches);
      setReduced(mq.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [spin, presence]);

  // Horizontal drag and ←/→ keys rotate the turntable.
  useEffect(() => {
    const el = inputTarget;
    if (!el || !turntable) return;
    let dragging = false;
    let lastX = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      el.setPointerCapture(e.pointerId);
      spin.hold();
      restartAuto();
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      spin.nudge((e.clientX - lastX) * MOTION.dragSensitivity);
      invalidateRef.current();
      lastX = e.clientX;
    };
    const up = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      el.releasePointerCapture(e.pointerId);
      spin.hold();
      restartAuto();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      spin.nudge((e.key === "ArrowRight" ? 1 : -1) * MOTION.keyStep);
      restartAuto();
      invalidateRef.current();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("keydown", key);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("keydown", key);
    };
  }, [inputTarget, turntable, spin, restartAuto]);

  useLayoutEffect(() => explosion.setParts(plan), [explosion, plan]);

  // Separate or reassemble. Reduced motion: no movement, a short cross-fade instead.
  useEffect(() => {
    if (!explodable || story) return;
    explosion.toggle(exploded, performance.now(), reduced);
    if (reduced && !firstToggle.current) {
      wrapperRef.current?.animate([{ opacity: 0.3 }, { opacity: 1 }], {
        duration: EXPLODE_TIMING.fadeMs,
        easing: "ease-out",
      });
    }
    firstToggle.current = false;
    invalidateRef.current();
    // `reduced` is read at toggle time only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploded, explodable, story, explosion]);

  const handleSettled = useCallback(() => setSettleCount((n) => n + 1), []);

  // A scroll story moves the turntable itself; nothing auto-rotates.
  const frozen = still || !!story;
  const animate = active && !frozen && !reduced && autoWindow;

  return (
    <div ref={wrapperRef}>
    <Canvas
      frameloop="never"
      // Size changes only: tracking scroll re-measures the canvas on any scroll
      // in the page (e.g. the builder panel) and draws a frame for nothing.
      // Pointer events use offsetX/Y, so the canvas position isn't needed.
      resize={{ scroll: false }}
      shadows="soft"
      dpr={[1, budget.maxDpr]}
      onClick={turntable ? undefined : () => setStoppedFor(vehicleId)}
      onCreated={({ get }) => {
        // RenderGate swaps `invalidate`, so always call the current one.
        invalidateRef.current = () => get().invalidate();
      }}
      gl={{
        antialias: true,
        alpha: true,
        // ACES shifts hue and saturation, so the builder's paint would not match its
        // swatches; Neutral keeps colors true. The hero keeps its ACES look.
        toneMapping: turntable ? THREE.ACESFilmicToneMapping : THREE.NeutralToneMapping,
        toneMappingExposure: turntable ? SCENE_THEMES[theme].exposure : 1,
      }}
      camera={{ position: ORBIT_CAMERA, fov: 30 }}
      style={{ position: "absolute", inset: 0 }}
    >
      {!turntable && <color attach="background" args={[ROOM_BACKDROP]} />}
      <AdaptiveDpr />
      <PerformanceMonitor />
      {!turntable && <BakedShadows version={`${parts.map((p) => p.url).join("|")}:${loaded}:${settleCount}`} />}
      <RenderGate fps={budget.fps} active={active} />
      {statsEnabled() && <RenderStats />}
      <Lights theme={lightsTheme} />
      {/* <Turntable theme={theme} /> */}
      {turntable ? (
        <>
          <CameraRig mobile={mobile} />
          <FrameCap enabled={animate} fps={AUTO_ROTATE_FPS} />
          {story && (
            <>
              <ScrollDirector story={story} spin={spin} explosion={explosion} reduced={reduced} />
              <ExplodeLabels
                explosion={explosion}
                plan={plan}
                front={front}
                overlayRef={labelsRef}
                toolbarRef={toolbarRef}
              />
            </>
          )}
        </>
      ) : (
        <>
          <OrbitRig explodeFit={explodeFit} toolbarRef={toolbarRef} />
          <FrameRateIndependentDamping />
          <AutoRotate enabled={animate && stoppedFor !== vehicleId} />
          <ViewTransition
            request={viewRequest}
            front={front}
            reduced={reduced}
            explodeFit={explodeFit}
            explosion={explodable ? explosion : undefined}
            toolbarRef={toolbarRef}
            onExplodeFit={setExplodeFit}
          />
          {explodable && (
            <>
              <ExplodeDriver explosion={explosion} onSettled={handleSettled} />
              <ExplodeCamera
                explosion={explosion}
                exploded={exploded}
                reduced={reduced}
                onFit={setExplodeFit}
                assembledFit={fitDistance}
                toolbarRef={toolbarRef}
              />
              <ExplodeLabels
                explosion={explosion}
                plan={plan}
                front={front}
                overlayRef={labelsRef}
                toolbarRef={toolbarRef}
              />
              {!model && <SnapshotRig explosion={explosion} front={front} loaded={loaded} />}
            </>
          )}
        </>
      )}
      <Suspense fallback={null}>
        <StudioEnvironment />
        {!turntable && <OrbitFill />}
        {/* {!turntable && <Room />} */}
        <Truck
          vehicleId={vehicleId}
          parts={parts}
          partColors={partColors}
          explosion={explodable ? explosion : undefined}
          presence={explodable ? presence : undefined}
          onSlideSettled={handleSettled}
          plan={plan}
          theme={theme}
          spin={turntable ? spin : undefined}
          still={frozen}
          lightsOn={lightsOn}
        />
        <ReadySignal onReady={handleReady} />
      </Suspense>
    </Canvas>
    {explodable && <LabelOverlay plan={plan} overlayRef={labelsRef} theme={theme} />}
    {!turntable && (
      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label="Camera view"
        className="absolute inset-x-0 top-3 flex flex-wrap justify-center gap-2 px-3"
      >
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => selectView(v.id)}
            className="min-h-12 rounded-full border bg-background/90 px-4 text-base font-semibold shadow-sm backdrop-blur transition-colors hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
          >
            {v.label}
          </button>
        ))}
        {explodable && onExplodedChange && (
          <button
            type="button"
            aria-pressed={exploded}
            onClick={toggleExploded}
            className="min-h-12 rounded-full border bg-background/90 px-4 text-base font-semibold shadow-sm backdrop-blur transition-colors hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 outline-none aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            {exploded ? "Put back together" : "Show parts"}
          </button>
        )}
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </div>
    )}
    </div>
  );
}
