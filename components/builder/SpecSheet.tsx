"use client";
import { paintTargets } from "@/lib/builder";
import { useBuilderStore } from "@/lib/builder-store";
import { getCategory, getUpfit, getVehicle } from "@/lib/catalog";
import { takeSnapshot } from "@/lib/spec-snapshot";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import PaintChip from "./PaintChip";

/** The current build as a printable sheet. Hidden on screen; the only thing printed from the builder. */
export default function SpecSheet() {
  const build = useBuilderStore((s) => s.build);
  // Shot taken when printing starts (button or Ctrl/Cmd+P), so it matches the build as it is then.
  const [image, setImage] = useState<string | null>(null);
  useEffect(() => {
    const before = () => flushSync(() => setImage(takeSnapshot()));
    window.addEventListener("beforeprint", before);
    return () => window.removeEventListener("beforeprint", before);
  }, []);
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
        <p className="text-base">{new Date().toLocaleDateString()}</p>
      </header>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
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
          {paintTargets(build).map(({ id, label, color }) => (
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
