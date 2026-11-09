"use client";
import { useEffect, useRef } from "react";

/**
 * Decorative HUD dials: concentric rings that turn at different speeds, in the
 * style of the reference art. Each ring is one SVG circle. A thick stroke with
 * a dash pattern reads as a segmented band; short dashes read as tick marks.
 */
type Layer = {
  r: number;
  /** Stroke width, i.e. how thick the band or how long the ticks are. */
  sw: number;
  /** Dash pattern in units of `len`; omitted for a solid hairline. */
  dash?: string;
  /** Path length the dash pattern is measured against. */
  len?: number;
  /** Seconds per turn; omitted for a ring that stays still. */
  dur?: number;
  /** Turn anticlockwise. */
  rev?: boolean;
  /** Brand-blue ring instead of the pale one. */
  accent?: boolean;
  o?: number;
};

/** Band made of `segs`, separated by `gap`, scaled to fill 100 units exactly. */
const band = (segs: number[], gap: number) => {
  const k = 100 / (segs.reduce((a, b) => a + b, 0) + gap * segs.length);
  return segs.map((s) => `${(s * k).toFixed(3)} ${(gap * k).toFixed(3)}`).join(" ");
};
const ticks = (on: number, off: number) => `${on} ${off}`;

const VARIANTS = {
  // Dense dial: fine ticks, bold bands, a dotted ring.
  a: [
    {
      r: 192,
      sw: 6,
      len: 360,
      dash: ticks(0.45, 2.55),
      dur: 160,
      rev: true,
      o: 0.5,
    },
    {
      r: 178,
      sw: 9,
      len: 100,
      dash: band([34, 10, 22, 6, 16], 2.5),
      dur: 90,
      accent: true,
      o: 0.6,
    },
    { r: 166, sw: 1, o: 0.5 },
    {
      r: 150,
      sw: 14,
      len: 100,
      dash: band([5, 3, 7, 3, 5, 8, 3, 4, 6, 3], 1.2),
      dur: 70,
      rev: true,
      o: 0.5,
    },
    { r: 132, sw: 3, len: 100, dash: "0.01 1.6", dur: 110, o: 0.7 },
    { r: 118, sw: 1.5, o: 0.5 },
    { r: 106, sw: 8, len: 240, dash: ticks(0.5, 1.5), dur: 50, o: 0.5 },
    {
      r: 88,
      sw: 5,
      len: 100,
      dash: band([40, 25, 15], 5),
      dur: 40,
      rev: true,
      accent: true,
      o: 0.7,
    },
    { r: 72, sw: 1, o: 0.45 },
    { r: 54, sw: 1, o: 0.35 },
  ],
  // Light dial: long hairline arcs around thick, slow bands.
  b: [
    {
      r: 190,
      sw: 1.5,
      len: 100,
      dash: band([28, 6, 18, 10, 14, 4, 12], 3),
      dur: 120,
      o: 0.6,
    },
    {
      r: 178,
      sw: 7,
      len: 180,
      dash: ticks(0.6, 1.4),
      dur: 100,
      rev: true,
      o: 0.5,
    },
    {
      r: 160,
      sw: 16,
      len: 100,
      dash: band([20, 8, 14, 20, 10], 3),
      dur: 75,
      o: 0.45,
    },
    {
      r: 140,
      sw: 3,
      len: 100,
      dash: band([60, 25], 6),
      dur: 55,
      rev: true,
      accent: true,
      o: 0.7,
    },
    { r: 124, sw: 3, len: 100, dash: "0.01 1.2", dur: 90, o: 0.7 },
    { r: 110, sw: 10, len: 300, dash: ticks(0.5, 1.5), dur: 45, o: 0.5 },
    {
      r: 92,
      sw: 2,
      len: 100,
      dash: band([30, 20, 35], 4),
      dur: 35,
      rev: true,
      accent: true,
      o: 0.7,
    },
    { r: 76, sw: 1, o: 0.45 },
    { r: 62, sw: 5, len: 120, dash: ticks(0.6, 1.4), dur: 30, o: 0.5 },
  ],
  // Heavy dial: chunky outer blocks, a fine dial scale inside.
  c: [
    {
      r: 178,
      sw: 26,
      len: 100,
      dash: band([3, 6, 2, 9, 3, 5, 7, 2, 4, 6, 3], 1.5),
      dur: 100,
      o: 0.4,
    },
    { r: 154, sw: 1, o: 0.5 },
    {
      r: 146,
      sw: 12,
      len: 480,
      dash: ticks(0.6, 2.4),
      dur: 130,
      rev: true,
      o: 0.5,
    },
    {
      r: 130,
      sw: 3,
      len: 100,
      dash: band([45, 30], 6),
      dur: 60,
      accent: true,
      o: 0.7,
    },
    {
      r: 112,
      sw: 14,
      len: 100,
      dash: band([8, 3, 10, 4, 6], 2),
      dur: 80,
      rev: true,
      o: 0.45,
    },
    { r: 98, sw: 1, len: 100, dash: "2 1", o: 0.5 },
    { r: 86, sw: 6, len: 300, dash: ticks(0.4, 1.6), dur: 200, o: 0.55 },
    { r: 64, sw: 1, o: 0.4 },
    { r: 40, sw: 1, o: 0.3 },
  ],
} satisfies Record<string, Layer[]>;

export type HudVariant = keyof typeof VARIANTS;

/**
 * Sits behind a section's content: give the section `relative isolate
 * overflow-hidden`, and size and place the dial with `className`.
 */
export default function HudRings({
  variant = "a",
  className = "",
}: {
  variant?: HudVariant;
  className?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);

  // Rings that are off screen stand still, so the page animates one section
  // at a time next to the 3D scene.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) =>
      el.toggleAttribute("data-paused", !e.isIntersecting),
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <svg
      ref={ref}
      viewBox="0 0 400 400"
      aria-hidden
      focusable="false"
      className={`hud ${className}`}
      fill="none"
    >
      {VARIANTS[variant].map((l: Layer, i) => (
        <circle
          key={i}
          cx={200}
          cy={200}
          r={l.r}
          strokeWidth={l.sw}
          stroke={l.accent ? "var(--hero-accent)" : "currentColor"}
          opacity={l.o}
          pathLength={l.len}
          strokeDasharray={l.dash}
          strokeLinecap={l.dash === "0.01 1.6" || l.dash === "0.01 1.2" ? "round" : "butt"}
          className={l.dur ? "hud-spin" : undefined}
          style={
            l.dur
              ? ({
                  "--dur": `${l.dur}s`,
                  "--dir": l.rev ? "reverse" : "normal",
                  // Start each ring at a different angle.
                  animationDelay: `${-(i * 13)}s`,
                } as React.CSSProperties)
              : undefined
          }
        />
      ))}
    </svg>
  );
}
