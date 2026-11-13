"use client";
import { paintTargets } from "@/lib/builder";
import { useBuilderStore } from "@/lib/builder-store";
import { getCategory, getUpfit, getVehicle } from "@/lib/catalog";
import { submittedOn, type QuotePreview } from "@/lib/quote-log";
import { registerPrint, takeSnapshot, type Snapshot } from "@/lib/spec-snapshot";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { flushSync } from "react-dom";
import PaintChip from "./PaintChip";

type Build = ReturnType<typeof useBuilderStore.getState>["build"];

/**
 * A quote's build as a printable sheet: the picture, each item with its paint,
 * then the customer and delivery address. Hidden on screen; the only thing
 * printed from the page. A quote that recorded no colors has no paint column.
 */
export default function SpecSheet({
  build,
  quote,
}: {
  build: Build;
  quote: QuotePreview;
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

  // "Save as PDF" names the file after the page title: use the sheet's name while it prints.
  useEffect(() => {
    let saved: string | null = null;
    const before = () => {
      saved ??= document.title;
      document.title = specSheetName(quote);
    };
    const after = () => {
      if (saved !== null) document.title = saved;
      saved = null;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      after();
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [quote]);

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
  // Painted parts by id; unpainted upfits (e.g. bumpers) have none.
  const showPaint = quote.paint !== null;
  const paint = new Map(paintTargets(build).map((t) => [t.id, t.color]));
  const rows = [
    { id: build.vehicleId, category: "Vehicle", name: getVehicle(build.vehicleId)?.name ?? build.vehicleId },
    ...build.upfitIds.map((id) => {
      const upfit = getUpfit(id);
      return { id, category: upfit ? getCategory(upfit.category).label : "Upfit", name: upfit?.name ?? id };
    }),
  ];
  // Upfits are numbered in table order: the picture's markers, the table and the legend agree.
  const numbers = useMemo(() => new Map(build.upfitIds.map((id, i) => [id, i + 1])), [build.upfitIds]);
  const upfitRows = rows.filter((r) => numbers.has(r.id));
  const { profile } = quote;
  const customer: [string, string][] = [
    ["Name", `${profile.firstName} ${profile.lastName}`],
    ["Company", profile.companyName],
    ["Email", profile.email],
    ["Phone", profile.phone],
  ];

  return (
    <article
      // The page has no margin (globals.css): this padding repeats on every printed page instead,
      // with room at the bottom for the legend.
      className="relative isolate hidden box-decoration-clone p-8 pb-24 text-black print:block"
    >
      {/* Watermark: fixed, so it sits in the middle of every printed page, rising
          across it and laid over everything, like a stamped document. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-black.webp"
        alt=""
        aria-hidden
        className="pointer-events-none fixed top-1/2 left-1/2 z-50 w-[90%] -translate-x-1/2 -translate-y-1/2 -rotate-[45deg] opacity-10"
      />
      <header className="mb-3 border-b-2 border-black pb-2">
        <h1 className="text-xl font-extrabold">New Work Trucks · Build spec sheet</h1>
        <p className="text-sm">
          Request ID {quote.request_id} · Submitted {submittedOn(quote.created_at)}
        </p>
      </header>
      {shot && <Picture snap={shot.snap} numbers={numbers} imgRef={imgRef} />}
      <table className="w-full text-sm">
        <tbody>
          {rows.map(({ id, category, name }) => {
            const color = paint.get(id);
            return (
              <tr key={id} className="border-b">
                <th className="w-32 py-1 text-left font-semibold">
                  <span className="flex items-center gap-2">
                    {numbers.has(id) && <Marker n={numbers.get(id)!} className="size-5 text-xs" />}
                    {category}
                  </span>
                </th>
                <td className="py-1">{name}</td>
                {showPaint && (
                  <td className="py-1">
                    {color && (
                      <span className="flex items-center gap-2">
                        <PaintChip hex={color.hex} />
                        {color.name} <span className="text-neutral-600">{color.hex}</span>
                      </span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* Side by side, so the whole sheet fits one page. */}
      <div className="grid grid-cols-2 gap-6">
        <SheetSection title="Customer">
          <table className="w-full text-sm">
            <tbody>
              {customer.map(([label, value]) => (
                <tr key={label} className="border-b">
                  <th className="w-32 py-1 text-left font-semibold">{label}</th>
                  <td className="py-1 break-all">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SheetSection>
        <SheetSection title="Delivery address">
          <p className="py-1 text-sm">{quote.deliveryAddress}</p>
        </SheetSection>
      </div>
      {/* Legend: fixed, so it sits along the bottom edge of every printed page. */}
      {upfitRows.length > 0 && (
        <footer className="fixed inset-x-0 bottom-0 z-10 px-8 pb-6">
          <ul className="flex flex-wrap gap-x-6 gap-y-1 border-t border-black pt-2 text-sm">
            {upfitRows.map(({ id, category, name }) => (
              <li key={id} className="flex items-center gap-2">
                <Marker n={numbers.get(id)!} className="size-5 text-xs" />
                <span>
                  <span className="font-semibold">{category}:</span> {name}
                </span>
              </li>
            ))}
          </ul>
        </footer>
      )}
    </article>
  );
}

/**
 * The saved PDF's name, e.g. "NWT Spec Sheet TB-20005 - Acme Fleet - RAM 2500HD CC".
 * Characters that file systems reject become dashes; an empty company is left out.
 */
function specSheetName(quote: QuotePreview) {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  return [`NWT Spec Sheet ${clean(quote.request_id)}`, clean(quote.profile.companyName), clean(quote.truck_name)]
    .filter(Boolean)
    .join(" - ");
}

/** A headed block under the build table, kept whole on one page. */
function SheetSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 break-inside-avoid">
      <h2 className="border-b-2 border-black pb-1 text-xs font-semibold tracking-wider uppercase">{title}</h2>
      {children}
    </section>
  );
}

/**
 * The picture's printed size, in rem: fixed (not stretched to the page), so
 * the labels can be laid out before printing, when the sheet is still hidden.
 * The widest fits A4 and Letter with the browser's default margins.
 */
const PICTURE = { maxWidth: 38, maxHeight: 22 };

/** Number marker on the picture, in rem: its diameter and the gap kept around it. */
const MARKER = { size: 1.75, gap: 0.375 };

type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w + MARKER.gap && b.x < a.x + a.w + MARKER.gap && a.y < b.y + b.h + MARKER.gap && b.y < a.y + a.h + MARKER.gap;

/**
 * Places each numbered upfit's marker just above its part on a picture
 * `width` × `height` rem. Top-most first; a marker that would touch one
 * already placed moves up or down (whichever is closer) until it is clear,
 * never below the picture, so every marker is shown.
 */
function placeMarkers(labels: Snapshot["labels"], numbers: Map<string, number>, width: number, height: number) {
  const placed: (Rect & { id: string; n: number })[] = [];
  const order = labels.filter((l) => numbers.has(l.id)).sort((a, b) => a.y - b.y);
  const w = MARKER.size;
  const h = MARKER.size;
  for (const l of order) {
    const x = Math.min(Math.max(l.x * width - w / 2, 0), Math.max(0, width - w));
    const want = l.y * height - MARKER.gap - h;
    // Where it wants to be, or just above or below any marker already there.
    const tries = [want, ...placed.flatMap((r) => [r.y - MARKER.gap - h - 0.01, r.y + r.h + MARKER.gap + 0.01])]
      .filter((y) => y + h <= height)
      .sort((a, b) => Math.abs(a - want) - Math.abs(b - want));
    const y = tries.find((y) => !placed.some((r) => overlaps(r, { x, y, w, h })))!;
    placed.push({ id: l.id, n: numbers.get(l.id)!, x, y, w, h });
  }
  return placed;
}

/** An upfit's number: white on a black circle, the same on the picture, in the table and in the legend. */
function Marker({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-black font-bold text-white tabular-nums ${className}`}
    >
      {n}
    </span>
  );
}

/**
 * The picture at its own aspect ratio and a fixed size, with each upfit's
 * number by it (see the legend). The markers are page text, so they print sharp.
 */
function Picture({
  snap,
  numbers,
  imgRef,
}: {
  snap: Snapshot;
  numbers: Map<string, number>;
  imgRef: RefObject<HTMLImageElement | null>;
}) {
  const aspect = snap.width / snap.height;
  const height = Math.min(PICTURE.maxHeight, PICTURE.maxWidth / aspect);
  const width = height * aspect;
  const markers = useMemo(() => placeMarkers(snap.labels, numbers, width, height), [snap, numbers, width, height]);
  // Room above the picture for markers that sit higher than its top edge.
  const above = Math.max(0, ...markers.map((m) => -m.y));
  return (
    <figure className="relative mx-auto mb-3" style={{ width: `${width}rem`, height: `${height}rem`, marginTop: `${above + 0.5}rem` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={snap.url}
        alt="The build with its racks and bumpers separated"
        className="absolute inset-0 size-full"
      />
      {markers.map((m) => (
        <span
          key={m.id}
          aria-hidden
          className="absolute flex"
          style={{ left: `${m.x}rem`, top: `${m.y}rem`, width: `${m.w}rem`, height: `${m.h}rem` }}
        >
          <Marker n={m.n} className="size-full text-sm" />
        </span>
      ))}
    </figure>
  );
}
