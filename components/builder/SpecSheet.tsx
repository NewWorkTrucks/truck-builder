"use client";
import { paintTargets } from "@/lib/builder";
import { useBuilderStore } from "@/lib/builder-store";
import { getCategory, getUpfit, getVehicle } from "@/lib/catalog";
import { registerPrint, takeSnapshot } from "@/lib/spec-snapshot";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import PaintChip from "./PaintChip";

type Build = ReturnType<typeof useBuilderStore.getState>["build"];

/**
 * The current build as a printable sheet. Hidden on screen; the only thing printed from the builder.
 * With `preview`, prints that fixed build instead, headed with its quote's request ID.
 * `showPaint` false leaves out the paint rows (a quote that recorded no colors).
 */
export default function SpecSheet({
  preview,
  requestId,
  showPaint = true,
}: {
  preview?: Build;
  requestId?: string;
  showPaint?: boolean;
}) {
  const storeBuild = useBuilderStore((s) => s.build);
  const build = preview ?? storeBuild;
  const setSpecShotReady = useBuilderStore((s) => s.setSpecShotReady);
  // Exploded-view picture and the build it shows.
  const [shot, setShot] = useState<{ build: Build; url: string } | null>(null);
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
    const url = takeSnapshot();
    if (url) flushSync(() => setShot({ build, url }));
  };

  // Pre-capture: an <img> set during beforeprint can miss the print layout. Retries while the scene loads.
  useEffect(() => {
    let retry: ReturnType<typeof setTimeout>;
    const attempt = () => {
      try {
        const url = takeSnapshot();
        if (url) return setShot({ build, url });
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
    <article className="hidden p-8 text-black print:block">
      <header className="mb-6 border-b-2 border-black pb-3">
        <h1 className="text-2xl font-extrabold">New Work Trucks · Build spec sheet</h1>
        <p className="text-base">
          {requestId && <>Request ID {requestId} · </>}
          {new Date().toLocaleDateString()}
        </p>
      </header>
      {shot && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={shot.url}
          alt="The build with its parts separated"
          className="mb-6 max-h-96 w-full object-contain"
        />
      )}
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
