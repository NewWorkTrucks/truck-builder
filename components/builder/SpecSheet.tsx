"use client";
import { paintTargets } from "@/lib/builder";
import { useBuilderStore } from "@/lib/builder-store";
import { getCategory, getUpfit, getVehicle } from "@/lib/catalog";
import { registerPrint, takeSnapshot, type Snapshot } from "@/lib/spec-snapshot";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import PaintChip from "./PaintChip";

type Build = ReturnType<typeof useBuilderStore.getState>["build"];

/**
 * A quote's build as a printable sheet, headed with its request ID. Hidden on
 * screen; the only thing printed from the page. `showPaint` false leaves out
 * the paint rows (a quote that recorded no colors).
 */
export default function SpecSheet({
  build,
  requestId,
  showPaint = true,
}: {
  build: Build;
  requestId?: string;
  showPaint?: boolean;
}) {
  const setSpecShotReady = useBuilderStore((s) => s.setSpecShotReady);
  // Exploded-view picture and the build it shows.
  const [shot, setShot] = useState<{ build: Build; snap: Snapshot } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  // Read through a ref so the print listeners are registered once.
  const latest = useRef({ build, shot });
  useEffect(() => {
    latest.current = { build, shot };
  });

  // Takes a shot if the stored one isn't for the current build; synchronous, so it lands before print layout.
  const ensureShot = () => {
    const { build, shot } = latest.current;
    if (shot?.build === build) return;
    const snap = takeSnapshot();
    if (snap) flushSync(() => setShot({ build, snap }));
  };

  // Pre-capture: an <img> set during beforeprint can miss the print layout. Retries while the scene loads.
  useEffect(() => {
    let retry: ReturnType<typeof setTimeout>;
    const attempt = () => {
      try {
        const snap = takeSnapshot();
        if (snap) return setShot({ build, snap });
      } catch {}
      retry = setTimeout(attempt, 500);
    };
    retry = setTimeout(attempt, 800);
    return () => clearTimeout(retry);
  }, [build]);

  useEffect(() => {
    setSpecShotReady(shot?.build === build);
    return () => setSpecShotReady(false);
  }, [shot, build, setSpecShotReady]);

  // Ctrl/Cmd+P.
  useEffect(() => {
    const before = () => {
      try {
        ensureShot();
      } catch {}
    };
    window.addEventListener("beforeprint", before);
    return () => window.removeEventListener("beforeprint", before);
  }, []);

  // The button. Printing straight from the click would fire beforeprint inside React's click handler,
  // where the image misses the print layout, so leave the handler first.
  useEffect(
    () =>
      registerPrint(async () => {
        await null;
        try {
          ensureShot();
          await imgRef.current?.decode().catch(() => {});
        } catch {}
        window.print();
      }),
    [],
  );
  const rows: [string, string][] = [
    ["Vehicle", getVehicle(build.vehicleId)?.name ?? build.vehicleId],
    ...build.upfitIds.map((id): [string, string] => {
      const upfit = getUpfit(id);
      return [upfit ? getCategory(upfit.category).label : "Upfit", upfit?.name ?? id];
    }),
  ];

  return (
    <article className="relative isolate hidden p-8 text-black print:block">
      {/* Watermark: fixed, so it sits in the middle of every printed page, behind the content. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-black.webp"
        alt=""
        aria-hidden
        className="pointer-events-none fixed top-1/2 left-1/2 -z-10 w-2/3 -translate-x-1/2 -translate-y-1/2 opacity-10"
      />
      <header className="mb-6 border-b-2 border-black pb-3">
        <h1 className="text-2xl font-extrabold">New Work Trucks · Build spec sheet</h1>
        <p className="text-base">
          {requestId && <>Request ID {requestId} · </>}
          {new Date().toLocaleDateString()}
        </p>
      </header>
      {shot && <Picture snap={shot.snap} imgRef={imgRef} />}
      <table className="w-full text-lg">
        <tbody>
          {rows.map(([label, value], i) => (
            <tr key={i} className="border-b">
              <th className="w-48 py-2 text-left font-semibold">{label}</th>
              <td className="py-2">{value}</td>
            </tr>
          ))}
          {showPaint &&
            paintTargets(build).map(({ id, label, color }) => (
              <tr key={id} className="border-b">
                <th className="w-48 py-2 text-left font-semibold">{label}</th>
                <td className="py-2">
                  <span className="flex items-center gap-2">
                    <PaintChip hex={color.hex} />
                    {color.name} ({color.hex})
                  </span>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </article>
  );
}

/**
 * The picture's printed size, in rem: fixed (not stretched to the page), so
 * the labels can be laid out before printing, when the sheet is still hidden.
 * The widest fits A4 and Letter with the browser's default margins.
 */
const PICTURE = { maxWidth: 38, maxHeight: 22 };

/** Label box, in rem: text height (one line) plus padding and borders, and the gaps kept around it. */
const LABEL = { height: 2.375, padX: 1.625, gap: 0.5 };

type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w + LABEL.gap && b.x < a.x + a.w + LABEL.gap && a.y < b.y + b.h + LABEL.gap && b.y < a.y + a.h + LABEL.gap;

/** Width of a label's text in rem, in the sheet's font. */
function textWidth(text: string) {
  const ctx = document.createElement("canvas").getContext("2d");
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  if (!ctx) return text.length * 0.6;
  ctx.font = `600 ${root}px ${getComputedStyle(document.body).fontFamily}`;
  return ctx.measureText(text).width / root;
}

/**
 * Places each label just above its part on a picture `width` × `height` rem.
 * Top-most first; a label that would touch one already placed moves up or
 * down (whichever is closer) until it is clear, never below the picture, so
 * every label is shown.
 */
function placeLabels(labels: Snapshot["labels"], width: number, height: number) {
  const placed: (Rect & { id: string; label: string })[] = [];
  const order = [...labels].sort((a, b) => a.y - b.y);
  for (const l of order) {
    const w = textWidth(l.label) + LABEL.padX;
    const h = LABEL.height;
    const x = Math.min(Math.max(l.x * width - w / 2, 0), Math.max(0, width - w));
    const want = l.y * height - LABEL.gap - h;
    // Where it wants to be, or just above or below any label already there.
    const tries = [want, ...placed.flatMap((r) => [r.y - LABEL.gap - h - 0.01, r.y + r.h + LABEL.gap + 0.01])]
      .filter((y) => y + h <= height)
      .sort((a, b) => Math.abs(a - want) - Math.abs(b - want));
    const y = tries.find((y) => !placed.some((r) => overlaps(r, { x, y, w, h })))!;
    placed.push({ id: l.id, label: l.label, x, y, w, h });
  }
  return placed;
}

/**
 * The picture at its own aspect ratio and a fixed size, with a label by each
 * upfit. The labels are page text, so they print as sharp as the table.
 */
function Picture({ snap, imgRef }: { snap: Snapshot; imgRef: RefObject<HTMLImageElement | null> }) {
  const aspect = snap.width / snap.height;
  const height = Math.min(PICTURE.maxHeight, PICTURE.maxWidth / aspect);
  const width = height * aspect;
  const labels = useMemo(() => placeLabels(snap.labels, width, height), [snap, width, height]);
  // Room above the picture for labels that sit higher than its top edge.
  const above = Math.max(0, ...labels.map((l) => -l.y));
  return (
    <figure className="relative mx-auto mb-3" style={{ width: `${width}rem`, height: `${height}rem`, marginTop: `${above + 0.5}rem` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={snap.url}
        alt="The build with its racks and bumpers separated"
        className="absolute inset-0 size-full"
      />
      {labels.map((l) => (
        <span
          key={l.id}
          aria-hidden
          className="absolute flex items-center justify-center rounded-lg border border-neutral-300 bg-white text-base leading-6 font-semibold whitespace-nowrap text-neutral-900"
          style={{ left: `${l.x}rem`, top: `${l.y}rem`, width: `${l.w}rem`, height: `${l.h}rem` }}
        >
          {l.label}
        </span>
      ))}
    </figure>
  );
}
