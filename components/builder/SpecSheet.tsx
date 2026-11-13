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
  const { profile } = quote;
  const customer: [string, string][] = [
    ["Name", `${profile.firstName} ${profile.lastName}`],
    ["Company", profile.companyName],
    ["Email", profile.email],
    ["Phone", profile.phone],
  ];

  return (
    <article
      // The page has no margin (globals.css): this padding repeats on every printed page instead.
      className="relative isolate hidden box-decoration-clone p-10 text-black print:block"
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
      <header className="mb-6 border-b-2 border-black pb-3">
        <h1 className="text-2xl font-extrabold">New Work Trucks · Build spec sheet</h1>
        <p className="text-base">
          Request ID {quote.request_id} · Submitted {submittedOn(quote.created_at)}
        </p>
      </header>
      {shot && <Picture snap={shot.snap} imgRef={imgRef} />}
      <table className="w-full text-lg">
        <tbody>
          {rows.map(({ id, category, name }) => {
            const color = paint.get(id);
            return (
              <tr key={id} className="border-b">
                <th className="w-48 py-2 text-left font-semibold">{category}</th>
                <td className="py-2">{name}</td>
                {showPaint && (
                  <td className="py-2">
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
      <SheetSection title="Customer">
        <table className="w-full text-lg">
          <tbody>
            {customer.map(([label, value]) => (
              <tr key={label} className="border-b">
                <th className="w-48 py-2 text-left font-semibold">{label}</th>
                <td className="py-2 break-all">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SheetSection>
      <SheetSection title="Delivery address">
        <p className="py-2 text-lg">{quote.deliveryAddress}</p>
      </SheetSection>
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
    <section className="mt-6 break-inside-avoid">
      <h2 className="border-b-2 border-black pb-1 text-sm font-semibold tracking-wider uppercase">{title}</h2>
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
