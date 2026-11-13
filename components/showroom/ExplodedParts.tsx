"use client";
import {
  EXPLODE_TIMING,
  SLIDE_TIMING,
  slideDelays,
  type ExplodePart,
  type ExplodeRole,
} from "@/lib/explode";
import { Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import type { Line2, LineMaterial, OrbitControls } from "three-stdlib";
import type { HeroTheme } from "./scene-config";
import { isLightBeam } from "./TruckLights";

export const easeInOut = (k: number) =>
  k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

/**
 * Explode progress per part (0 mounted, 1 exploded), mutated outside React's
 * render like the turntable's Spin. Progress is stepped by wall-clock time:
 * R3F's frame delta is not in seconds under RenderGate.
 */
const NO_OFFSET = [0, 0, 0] as const;

export class Explosion {
  exploded = false;
  parts: ExplodePart[] = [];
  /** Mounted (unexploded) bounds per part id, for lines, labels and framing, in `frame`'s space. */
  boxes = new Map<string, THREE.Box3>();
  /** The truck group: boxes and part offsets are in its space, which the turntable moves. */
  frame: THREE.Object3D | null = null;
  private progress = new Map<string, number>();
  private startAt = new Map<string, number>();
  private last = 0;
  private changed = false;
  /** Parts a pose() holds mounted, as if they never moved. */
  private held = new Set<string>();

  setParts(parts: ExplodePart[]) {
    this.parts = parts;
  }

  /** Record a part's bounds; `group` is the part's group, at its mounted position. */
  measure(id: string, group: THREE.Object3D) {
    this.frame = group.parent;
    this.boxes.set(id, partBounds(group));
  }

  /** Start separating (true) or reassembling (false) from wherever each part is now. */
  toggle(exploded: boolean, now: number, reduced: boolean) {
    this.exploded = exploded;
    this.changed = true;
    this.last = now;
    const moving = this.parts.filter((p) => p.rank >= 0);
    for (const p of moving) {
      // Separate in order; put back in reverse.
      const slot = exploded ? p.rank : moving.length - 1 - p.rank;
      this.startAt.set(p.id, now + slot * EXPLODE_TIMING.staggerMs);
      // A part that has never moved is at the opposite end from where it is going.
      if (!this.progress.has(p.id)) this.progress.set(p.id, exploded ? 0 : 1);
      if (reduced) this.progress.set(p.id, this.target);
    }
  }

  /**
   * Place every part for an overall progress `p` (0 mounted, 1 exploded), as
   * when scroll drives the explosion instead of time. Parts overlap: each moves
   * over most of the range, the first to separate starting at 0 and the last
   * finishing at 1. Played backwards, the order reverses, as in toggle().
   */
  scrub(p: number) {
    const moving = this.parts.filter((q) => q.rank >= 0);
    const n = moving.length;
    const span = n > 1 ? 0.6 : 1;
    for (const q of moving) {
      const start = n > 1 ? ((1 - span) * q.rank) / (n - 1) : 0;
      this.progress.set(q.id, Math.min(1, Math.max(0, (p - start) / span)));
    }
    this.exploded = p > 0;
  }

  /**
   * Holds every part at progress `p` (as scrub), except those `hold` keeps
   * mounted, until the returned function puts the previous pose back.
   */
  pose(p: number, hold: (part: ExplodePart) => boolean = () => false) {
    const progress = new Map(this.progress);
    const exploded = this.exploded;
    this.scrub(p);
    for (const q of this.parts) {
      if (!hold(q)) continue;
      this.progress.set(q.id, 0);
      this.held.add(q.id);
    }
    return () => {
      this.progress = progress;
      this.exploded = exploded;
      this.held.clear();
    };
  }

  /** Where a part sits once fully separated, from its mount: none for a part a pose holds mounted. */
  offsetOf(part: ExplodePart): readonly number[] {
    return this.held.has(part.id) ? NO_OFFSET : part.offset;
  }

  private get target() {
    return this.exploded ? 1 : 0;
  }

  /** A part seen for the first time starts where the others are heading, e.g. one added while exploded. */
  raw(id: string) {
    return this.progress.get(id) ?? this.target;
  }

  eased(id: string) {
    return easeInOut(this.raw(id));
  }

  /** Advance to `now`. True while any part is still moving. */
  step(now: number) {
    const dt = now - this.last;
    this.last = now;
    let moving = false;
    for (const p of this.parts) {
      if (p.rank < 0) continue;
      const cur = this.raw(p.id);
      if (cur === this.target) continue;
      moving = true;
      const active = Math.min(dt, now - (this.startAt.get(p.id) ?? 0));
      if (active <= 0) continue;
      const delta = active / EXPLODE_TIMING.durationMs;
      this.progress.set(
        p.id,
        this.exploded ? Math.min(1, cur + delta) : Math.max(0, cur - delta),
      );
    }
    return moving;
  }

  /** True once after each toggle, when every part has arrived. */
  takeSettled(moving: boolean) {
    if (moving || !this.changed) return false;
    this.changed = false;
    return true;
  }

  /** Every part is at its exploded position. */
  get fullyExploded() {
    return this.exploded && this.parts.every((p) => p.rank < 0 || this.raw(p.id) === 1);
  }

  /** Total time from toggle to the last part arriving. */
  get durationMs() {
    const n = this.parts.filter((p) => p.rank >= 0).length;
    return EXPLODE_TIMING.durationMs + EXPLODE_TIMING.staggerMs * Math.max(0, n - 1);
  }
}

/**
 * Slide progress per upfit (0 away, 1 mounted) while one is added or removed,
 * stepped by wall-clock time like Explosion. A part with no entry is simply
 * mounted. Entries are dropped when a removed part has finished leaving.
 */
export class Presence {
  private progress = new Map<string, number>();
  private target = new Map<string, 0 | 1>();
  private startAt = new Map<string, number>();
  private last = 0;
  private reduced = false;
  private changed = false;

  setReduced(reduced: boolean) {
    this.reduced = reduced;
  }

  /** Forget everything: a different vehicle appears whole, nothing slides. */
  reset() {
    this.progress.clear();
    this.target.clear();
    this.startAt.clear();
  }

  /** A part has mounted. With `enterDelay` it slides in after that many ms, from the start of its slide. */
  mount(id: string, now: number, enterDelay?: number) {
    if (this.progress.has(id)) return; // e.g. remounted by Suspense mid-slide
    this.target.set(id, 1);
    if (enterDelay === undefined || this.reduced) {
      this.progress.set(id, 1);
      return;
    }
    this.changed = true;
    this.last = now;
    this.progress.set(id, 0);
    this.startAt.set(id, now + enterDelay);
  }

  /** Slide out after `delay` ms (the part is no longer in the build). */
  hide(id: string, now: number, delay: number) {
    this.changed = true;
    this.last = now;
    if (!this.progress.has(id)) this.progress.set(id, 1);
    this.target.set(id, 0);
    this.startAt.set(id, now + delay);
    if (this.reduced) this.progress.set(id, 0);
  }

  /** Put back in the build while still sliding out: slide back in from where it is. */
  show(id: string, now: number) {
    if (this.target.get(id) !== 0) return;
    this.changed = true;
    this.last = now;
    this.target.set(id, 1);
    this.startAt.set(id, now);
    if (this.reduced) this.progress.set(id, 1);
  }

  /** 1 mounted, 0 slid fully away. */
  eased(id: string) {
    return easeInOut(this.progress.get(id) ?? 1);
  }

  /** Advance to `now`: whether any part is still moving, and the ids that finished sliding out. */
  step(now: number) {
    const dt = now - this.last;
    this.last = now;
    let moving = false;
    const gone: string[] = [];
    for (const [id, cur] of this.progress) {
      const target = this.target.get(id) ?? 1;
      let next = cur;
      if (cur !== target) {
        moving = true;
        const active = Math.min(dt, now - (this.startAt.get(id) ?? 0));
        if (active > 0) {
          const delta = active / SLIDE_TIMING.durationMs;
          next = target === 1 ? Math.min(1, cur + delta) : Math.max(0, cur - delta);
          this.progress.set(id, next);
        }
      }
      if (target === 0 && next === 0) gone.push(id);
    }
    for (const id of gone) {
      this.progress.delete(id);
      this.target.delete(id);
      this.startAt.delete(id);
    }
    return { moving, gone };
  }

  /** True once after each build change, when everything has stopped. */
  takeSettled(moving: boolean) {
    if (moving || !this.changed) return false;
    this.changed = false;
    return true;
  }
}

/** Upfits sliding out of the build; still drawn until they finish. */
export type Slide<T> = {
  /** Ms after the change at which each arriving upfit starts sliding in. */
  enter: Record<string, number>;
  /** Ms after the change at which each leaving upfit starts sliding out. */
  leave: Record<string, number>;
  leaving: { part: T; plan: ExplodePart }[];
};

export const NO_SLIDE: Slide<never> = { enter: {}, leave: {}, leaving: [] };

type BuildView<T> = { vehicleId: string; parts: T[]; plan: ExplodePart[] };

const upfitIds = (plan: ExplodePart[]) => plan.filter((p) => p.role !== "chassis").map((p) => p.id);

/**
 * What slides when the build goes from `prev` to `next`. A different vehicle
 * replaces everything at once; the same vehicle slides only its changed upfits.
 */
export function nextSlide<T extends { id?: string }>(
  prev: BuildView<T>,
  next: BuildView<T>,
  slide: Slide<T>,
): Slide<T> {
  if (prev.vehicleId !== next.vehicleId) return NO_SLIDE;
  const before = upfitIds(prev.plan);
  const after = upfitIds(next.plan);
  const added = after.filter((id) => !before.includes(id));
  const removed = before.filter((id) => !after.includes(id));
  const delays = slideDelays(added, removed);
  const stillLeaving = slide.leaving.filter((l) => !after.includes(l.part.id!));
  return {
    enter: delays.enter,
    leave: {
      ...Object.fromEntries(stillLeaving.map((l) => [l.part.id!, slide.leave[l.part.id!] ?? 0])),
      ...delays.leave,
    },
    leaving: [
      ...stillLeaving,
      ...removed.map((id) => ({
        part: prev.parts.find((p) => p.id === id)!,
        plan: prev.plan.find((p) => p.id === id)!,
      })),
    ],
  };
}

/** Steps the slides and asks for frames only while something moves. */
export function PresenceDriver({
  presence,
  onGone,
  onSettled,
}: {
  presence: Presence;
  onGone: (ids: string[]) => void;
  onSettled: () => void;
}) {
  const invalidate = useThree((s) => s.invalidate);
  useFrame(() => {
    const { moving, gone } = presence.step(performance.now());
    if (moving) invalidate();
    if (gone.length) onGone(gone);
    if (presence.takeSettled(moving)) onSettled();
  }, -3);
  return null;
}

/**
 * Steps the explosion before anything else in the frame. Requests frames only
 * while parts move, so the canvas returns to on-demand rendering (0 idle frames).
 */
export function ExplodeDriver({
  explosion,
  onSettled,
}: {
  explosion: Explosion;
  onSettled: (exploded: boolean) => void;
}) {
  const invalidate = useThree((s) => s.invalidate);
  useFrame(() => {
    const moving = explosion.step(performance.now());
    if (moving) invalidate();
    if (explosion.takeSettled(moving)) onSettled(explosion.exploded);
  }, -3);
  return null;
}

/**
 * Each upfit GLB carries a small marker cube at the origin. Left in, it would
 * stretch a part's bounds to the origin (e.g. a rear bumper reaching the cab).
 */
const MARKER_MAX_SIZE = 0.3;

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();
const isOriginMarker = (b: THREE.Box3) =>
  b.getSize(_size).length() < MARKER_MAX_SIZE && b.getCenter(_center).length() < MARKER_MAX_SIZE;

/** Bounds of a part's meshes, without the origin marker, in the truck group's space. */
function partBounds(root: THREE.Object3D) {
  const box = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  // The truck group is re-centred and turned on the turntable after this runs,
  // so measure in its space rather than the world's.
  _toFrame.copy(root.parent!.matrixWorld).invert();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || isLightBeam(mesh)) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    _box
      .copy(mesh.geometry.boundingBox!)
      .applyMatrix4(_meshToFrame.multiplyMatrices(_toFrame, mesh.matrixWorld));
    if (!isOriginMarker(_box)) box.union(_box);
  });
  return box;
}
const _toFrame = new THREE.Matrix4();
const _meshToFrame = new THREE.Matrix4();

/** A material's own opacity settings, restored exactly once a fade ends. */
type FadeBase = { opacity: number; transparent: boolean; alphaTest: number };

export const rememberFadeBase = (m: THREE.Material): FadeBase => ({
  opacity: m.opacity,
  transparent: m.transparent,
  alphaTest: m.alphaTest,
});

/**
 * Fades every material under `root` to `f` (0 gone, 1 as authored). While
 * fading, materials blend (the models' alpha-test cutoff would otherwise drop
 * everything below half opacity); at 1 they return to exactly as loaded. A
 * mostly faded part stops casting its shadow.
 */
function applyFade(root: THREE.Object3D, f: number, wasOpaque: boolean) {
  const opaque = f >= 1;
  root.visible = f > 0.001;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.Material;
    const base = mat.userData.fadeBase as FadeBase | undefined;
    if (!base) return;
    if (opaque) {
      mat.opacity = base.opacity;
      mat.transparent = base.transparent;
      mat.alphaTest = base.alphaTest;
    } else {
      mat.opacity = base.opacity * f;
      mat.transparent = true;
      mat.alphaTest = 0;
    }
    // Blending and the alpha test change the shader; opacity alone is a uniform.
    if (wasOpaque !== opaque) mat.needsUpdate = true;
    mesh.castShadow = opaque || f > 0.5;
  });
}

/**
 * Moves one part along its offset as the explosion progresses, and while it
 * slides in (`enterDelay`) or out (`leaveDelay`, set while it is leaving),
 * fading with the slide.
 */
export function ExplodeGroup({
  explosion,
  presence,
  part,
  enterDelay,
  leaveDelay,
  children,
}: {
  explosion: Explosion;
  presence: Presence;
  part: ExplodePart;
  enterDelay?: number;
  leaveDelay?: number;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const fade = useRef(1);
  const place = () => {
    // Separated, plus however far it still has to slide in (or has slid out): same direction.
    const present = presence.eased(part.id);
    const k = explosion.eased(part.id) + (1 - present);
    ref.current!.position.set(part.offset[0] * k, part.offset[1] * k, part.offset[2] * k);
    if (present !== fade.current) {
      applyFade(ref.current!, present, fade.current >= 1);
      fade.current = present;
    }
  };

  useLayoutEffect(() => {
    const g = ref.current!;
    // Measure mounted, then place: a part added while exploded never shows mounted.
    g.position.set(0, 0, 0);
    explosion.measure(part.id, g);
    presence.mount(part.id, performance.now(), enterDelay);
    place();
    return () => {
      explosion.boxes.delete(part.id);
    };
    // enterDelay is read once, when the part mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explosion, presence, part]);

  // Leaving (or coming back before it has gone).
  useLayoutEffect(() => {
    const now = performance.now();
    if (leaveDelay === undefined) presence.show(part.id, now);
    else presence.hide(part.id, now, leaveDelay);
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaveDelay === undefined]);

  useFrame(place, -2);
  return <group ref={ref}>{children}</group>;
}

/**
 * Where a part meets the truck: its box centre pushed back against the
 * direction it moves (bottom for parts lifted up, front face for a bumper).
 */
export function mountAnchor(box: THREE.Box3, offset: readonly number[], out: THREE.Vector3) {
  const dir = _dir.fromArray(offset).normalize();
  const half = box.getSize(_size).multiplyScalar(0.5);
  const reach = Math.abs(dir.x) * half.x + Math.abs(dir.y) * half.y + Math.abs(dir.z) * half.z;
  return box.getCenter(out).addScaledVector(dir, -reach);
}

const _dir = new THREE.Vector3();
const _a = new THREE.Vector3();

const LINE = { color: "#8A93A1", width: 1.5, dash: 0.08, gap: 0.06 };
const PLACEHOLDER: [number, number, number][] = [
  [0, 0, 0],
  [0, 0.01, 0],
];

/** Dashed line from a part's mount to where it sits now; grows with the explosion and fades on the way back. */
function CenterLine({ explosion, part }: { explosion: Explosion; part: ExplodePart }) {
  const ref = useRef<Line2>(null);
  useFrame(() => {
    const line = ref.current!;
    const box = explosion.boxes.get(part.id);
    const e = explosion.eased(part.id);
    line.visible = !!box && e > 0.001;
    if (!line.visible) return;
    const a = mountAnchor(box!, part.offset, _a);
    const [ox, oy, oz] = part.offset;
    // Rewrite the one segment in place (no new GPU buffers per frame).
    const g = line.geometry;
    const pos = (g.attributes.instanceStart as THREE.InterleavedBufferAttribute).data;
    pos.array.set([a.x, a.y, a.z, a.x + ox * e, a.y + oy * e, a.z + oz * e]);
    pos.needsUpdate = true;
    const dist = (g.attributes.instanceDistanceStart as THREE.InterleavedBufferAttribute).data;
    dist.array[0] = 0;
    dist.array[1] = Math.hypot(ox, oy, oz) * e;
    dist.needsUpdate = true;
    (line.material as LineMaterial).opacity = e;
  }, -1);
  return (
    <Line
      ref={ref}
      points={PLACEHOLDER}
      color={LINE.color}
      lineWidth={LINE.width}
      dashed
      dashSize={LINE.dash}
      gapSize={LINE.gap}
      transparent
      depthWrite={false}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
      raycast={() => null}
    />
  );
}

/** One centerline per moving part. */
export function CenterLines({ explosion, plan }: { explosion: Explosion; plan: ExplodePart[] }) {
  return plan
    .filter((p) => p.rank >= 0)
    .map((p) => <CenterLine key={p.id} explosion={explosion} part={p} />);
}

const ROLE_TITLE: Record<ExplodeRole, string> = {
  chassis: "Chassis",
  body: "Body",
  rack: "Rack",
  bumper: "Bumper",
};

const CARD_MOTION =
  "invisible translate-y-2 opacity-0 transition-[opacity,visibility,translate] duration-300 ease-out data-[shown=true]:visible data-[shown=true]:translate-y-0 data-[shown=true]:opacity-100 motion-reduce:translate-y-0 motion-reduce:transition-none";

/** Hover (mouse) and tap (touch) outlining of parts while they are separated. */
export type Picking = {
  /** The part drawn with an outline, if any. */
  outlined: string | null;
  /** The mouse entered (`over` true) or left a part or its label. */
  hover: (id: string, over: boolean) => void;
  /** A tap on a part or its label: outlines it, or clears it when it is already outlined. */
  tap: (id: string) => void;
};

/**
 * DOM labels (no draw calls), positioned by ExplodeLabels. With `picking`, a
 * shown label outlines its part like the part itself does (hover or tap). Hidden from screen
 * readers: the live region (builder) or the stage's label (landing) describes them.
 * The dark theme is the landing page's callout: what the part is, then its name,
 * with a leader down to the part.
 */
export function LabelOverlay({
  plan,
  overlayRef,
  theme = "light",
  picking,
}: {
  plan: ExplodePart[];
  overlayRef: RefObject<HTMLDivElement | null>;
  theme?: HeroTheme;
  picking?: Picking;
}) {
  const isMouse = (e: { nativeEvent: Event }) => (e.nativeEvent as PointerEvent).pointerType === "mouse";
  return (
    <div ref={overlayRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {plan.map((p) => (
        // The outer box is moved to the part; the inner card fades and rises in.
        <div key={p.id} data-part={p.id} className="absolute top-0 left-0 whitespace-nowrap">
          {theme === "dark" ? (
            <div
              data-card
              data-shown="false"
              className={`${CARD_MOTION} relative flex flex-col rounded-lg border border-[#2a3644] bg-[#0a0b0d]/85 px-3 py-1.5 backdrop-blur-sm after:absolute after:top-full after:left-1/2 after:h-2 after:w-px after:bg-[#7cc4ff]`}
            >
              <span className="text-xs font-medium tracking-[0.18em] text-[#7cc4ff] uppercase">
                {ROLE_TITLE[p.role]}
              </span>
              <span className="text-base font-semibold text-[#f2f4f7]">{p.label}</span>
            </div>
          ) : (
            <div
              data-card
              data-shown="false"
              // Faded-out labels stay where they were: they must not catch the pointer.
              className={`${CARD_MOTION} rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-base font-semibold text-neutral-900 shadow-sm ${
                picking ? "pointer-events-auto data-[shown=false]:pointer-events-none" : ""
              }`}
              onPointerEnter={picking && ((e) => isMouse(e) && e.buttons === 0 && picking.hover(p.id, true))}
              onPointerLeave={picking && ((e) => isMouse(e) && picking.hover(p.id, false))}
              onClick={picking && ((e) => !isMouse(e) && picking.tap(p.id))}
            >
              {p.label}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Canvas pixels covered by the camera toolbar along the top edge. */
export function toolbarInset(toolbar: HTMLElement | null, canvas: HTMLCanvasElement) {
  if (!toolbar) return 0;
  return Math.max(0, toolbar.getBoundingClientRect().bottom - canvas.getBoundingClientRect().top);
}

const LABEL_GAP_PX = 8;
const LABEL_STAGGER_MS = 120;

/**
 * Fades a label in (staggered by the part's order, unless `stagger` is off) or
 * out; the CSS transition does the rest.
 */
function setShown(card: HTMLElement, shown: boolean, part: ExplodePart, stagger: boolean) {
  const value = String(shown);
  if (card.dataset.shown === value) return;
  card.dataset.shown = value;
  card.style.transitionDelay = shown && stagger ? `${Math.max(0, part.rank) * LABEL_STAGGER_MS}ms` : "0ms";
}
const _top = new THREE.Vector3();
const _ndc = new THREE.Vector3();

type Placed = { x: number; y: number; w: number; h: number };
const overlaps = (a: Placed, b: Placed) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Positions the labels once every part has arrived, on each rendered frame
 * (orbiting, resizing). Nearest labels win; any label that would overlap one
 * already placed, or leave the canvas, is hidden.
 *
 * With `focus` (the builder), only that part's label shows, at once, and it is
 * nudged inside the canvas rather than hidden; `null` shows none.
 */
export function ExplodeLabels({
  explosion,
  plan,
  front,
  overlayRef,
  toolbarRef,
  focus,
}: {
  explosion: Explosion;
  plan: ExplodePart[];
  /** Vehicle facing [x, z]: the chassis label sits over the cab, clear of the body's. */
  front: [number, number];
  overlayRef: RefObject<HTMLDivElement | null>;
  /** Labels never sit under the camera toolbar. */
  toolbarRef: RefObject<HTMLElement | null>;
  /** The one part whose label shows (hovered or tapped); omitted, all can show. */
  focus?: string | null;
}) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const focused = focus !== undefined;
  // Show or hide the label as soon as the pointer moves on or off a part.
  useEffect(() => invalidate(), [focus, invalidate]);
  useFrame(() => {
    const root = overlayRef.current;
    if (!root) return;
    const top = toolbarInset(toolbarRef.current, gl.domElement);
    const show = explosion.fullyExploded;
    const frame = explosion.frame;
    frame?.updateWorldMatrix(true, false);
    const cards: { card: HTMLElement; part: ExplodePart }[] = [];
    const items: { el: HTMLElement; card: HTMLElement; part: ExplodePart; x: number; y: number; dist: number }[] = [];
    for (const p of plan) {
      const el = root.querySelector<HTMLElement>(`[data-part="${CSS.escape(p.id)}"]`);
      const card = el?.querySelector<HTMLElement>("[data-card]");
      if (!el || !card) continue;
      const box = explosion.boxes.get(p.id);
      cards.push({ card, part: p });
      if (!show || !box || (focused && p.id !== focus)) continue;
      // Top centre of the part where it sits now.
      box.getCenter(_top).setY(box.max.y);
      _top.x += p.offset[0];
      _top.y += p.offset[1];
      _top.z += p.offset[2];
      if (p.rank < 0) {
        const len = box.getSize(_size);
        _top.x += front[0] * len.x * 0.3;
        _top.z += front[1] * len.z * 0.3;
      }
      if (frame) _top.applyMatrix4(frame.matrixWorld);
      _ndc.copy(_top).project(camera);
      if (_ndc.z > 1) continue;
      items.push({
        el,
        card,
        part: p,
        x: ((_ndc.x + 1) / 2) * size.width,
        y: ((1 - _ndc.y) / 2) * size.height,
        dist: camera.position.distanceTo(_top),
      });
    }
    items.sort((a, b) => a.dist - b.dist);
    const placed: Placed[] = [];
    const shown = new Set<HTMLElement>();
    for (const it of items) {
      const w = it.el.offsetWidth;
      const h = it.el.offsetHeight;
      const r = { x: it.x - w / 2, y: it.y - h - LABEL_GAP_PX, w, h };
      if (focused) {
        r.x = Math.min(Math.max(r.x, 0), size.width - w);
        r.y = Math.min(Math.max(r.y, top), size.height - h);
      }
      const inside = r.x >= 0 && r.y >= top && r.x + w <= size.width && r.y + h <= size.height;
      if (!inside || placed.some((q) => overlaps(q, r))) continue;
      it.el.style.transform = `translate(${Math.round(r.x)}px, ${Math.round(r.y)}px)`;
      shown.add(it.card);
      placed.push(r);
    }
    // Labels that are hidden fade out where they were; shown ones fade in.
    for (const { card, part } of cards) setShown(card, shown.has(card), part, !focused);
  });
  return null;
}

const FIT_MARGIN = 1.1;
const _rel = new THREE.Vector3();
const _right = new THREE.Vector3();
const _upv = new THREE.Vector3();
const _back = new THREE.Vector3();
const _corner = new THREE.Vector3();

/**
 * Smallest camera distance from `target`, along `toCamera` (target to camera;
 * defaults to the current view), at which every exploded part fits the view
 * with a 10% margin.
 */
export function fitExplodedRadius(
  explosion: Explosion,
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  /** Share of the view's upper half left free by the toolbar (1 = all of it). */
  topFree = 1,
  toCamera?: THREE.Vector3,
) {
  if (toCamera) _back.copy(toCamera).normalize();
  else _back.subVectors(camera.position, target).normalize();
  _right.crossVectors(camera.up, _back).normalize();
  _upv.crossVectors(_back, _right);
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const tanH = tanV * camera.aspect;
  let need = 0;
  for (const p of explosion.parts) {
    const box = explosion.boxes.get(p.id);
    if (!box) continue;
    for (let i = 0; i < 8; i++) {
      const offset = explosion.offsetOf(p);
      _corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      _corner.x += offset[0];
      _corner.y += offset[1];
      _corner.z += offset[2];
      _rel.subVectors(_corner, target);
      const along = _rel.dot(_back);
      const y = _rel.dot(_upv);
      need = Math.max(
        need,
        along + (FIT_MARGIN * Math.abs(_rel.dot(_right))) / tanH,
        along + (FIT_MARGIN * Math.abs(y)) / (tanV * (y > 0 ? topFree : 1)),
      );
    }
  }
  return need;
}

/**
 * Reframes the orbit camera with the explosion: pulls back (never in) to fit
 * the exploded parts, over the animation's length, and returns to the saved
 * distance on reassembly. Keeps the user's angle; never fights a drag.
 * `onFit` reports the distance zoom limits and view presets must allow.
 */
export function ExplodeCamera({
  explosion,
  exploded,
  reduced,
  onFit,
  assembledFit,
  toolbarRef,
}: {
  explosion: Explosion;
  exploded: boolean;
  reduced: boolean;
  onFit: (radius: number | null) => void;
  /** The orbit rig's assembled distance for an aspect ratio. */
  assembledFit: (aspect: number) => number;
  /** Parts are framed below the camera toolbar. */
  toolbarRef: RefObject<HTMLElement | null>;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as OrbitControls | null;
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const aspect = size.width / size.height;
  const fitNow = () => {
    const topFree = 1 - (2 * toolbarInset(toolbarRef.current, gl.domElement)) / size.height;
    return fitExplodedRadius(explosion, camera, controls!.target, Math.max(0.2, topFree));
  };
  const dragging = useRef(false);
  const saved = useRef<number | null>(null);
  const tween = useRef<{ from: number; to: number; t0: number; ms: number; done?: () => void } | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (!controls) return;
    const start = () => {
      dragging.current = true;
      tween.current = null; // the user takes over
    };
    const end = () => (dragging.current = false);
    controls.addEventListener("start", start);
    controls.addEventListener("end", end);
    return () => {
      controls.removeEventListener("start", start);
      controls.removeEventListener("end", end);
    };
  }, [controls]);

  useEffect(() => {
    if (!controls) return;
    if (first.current) {
      first.current = false;
      if (!exploded) return; // mounted assembled: nothing to frame
    }
    const current = camera.position.distanceTo(controls.target);
    const ms = reduced ? 0 : explosion.durationMs;
    if (exploded) {
      saved.current ??= current;
      const to = Math.max(current, fitNow());
      onFit(to);
      if (!dragging.current) tween.current = { from: current, to, t0: performance.now(), ms };
    } else {
      const to = saved.current ?? current;
      saved.current = null;
      // Lower the zoom limit only once the camera is back, so it never clamps mid-way.
      const done = () => onFit(null);
      if (dragging.current) done();
      else tween.current = { from: current, to, t0: performance.now(), ms, done };
    }
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploded, controls]);

  // A resize resets the orbit rig to its assembled distance: refit while separated.
  const lastAspect = useRef(aspect);
  useEffect(() => {
    if (lastAspect.current === aspect) return;
    lastAspect.current = aspect;
    if (!controls || !explosion.exploded) return;
    tween.current = null;
    saved.current = assembledFit(aspect);
    const r = Math.max(saved.current, fitNow());
    onFit(r);
    _rel.subVectors(camera.position, controls.target).setLength(r);
    camera.position.copy(controls.target).add(_rel);
    controls.update();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect, controls]);

  useFrame(() => {
    const tw = tween.current;
    if (!tw || !controls) return;
    const k = tw.ms ? Math.min(1, (performance.now() - tw.t0) / tw.ms) : 1;
    const r = tw.from + (tw.to - tw.from) * easeInOut(k);
    _rel.subVectors(camera.position, controls.target).setLength(r);
    camera.position.copy(controls.target).add(_rel);
    controls.update();
    if (k < 1) invalidate();
    else {
      tween.current = null;
      tw.done?.();
    }
  }, -1);
  return null;
}
