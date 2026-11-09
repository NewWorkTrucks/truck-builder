"use client";
import { useBuilderStore } from "@/lib/builder-store";
import { getVehicle } from "@/lib/catalog";
import { paintTargets } from "@/lib/builder";
import { PAINT_MATERIAL } from "@/lib/paint";
import { useProgress } from "@react-three/drei";
import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import ShowroomScene from "../showroom/ShowroomScene";

const LoadingOverlay = () => {
  // Download progress; parsing time after the download is not counted.
  const { active, progress } = useProgress();
  const pct = active ? Math.round(progress) : 100;
  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-lg text-muted-foreground"
    >
      <div className="w-48 rounded-full bg-background/80 p-1 shadow-sm backdrop-blur">
        <div
          className="h-1.5 animate-pulse rounded-full bg-primary transition-[width]"
          style={{ width: `${Math.max(5, pct)}%` }}
        />
      </div>
      {active ? `Loading your truck… ${pct}%` : "Getting your truck ready…"}
    </div>
  );
};

export default function Scene() {
  const vehicleId = useBuilderStore((s) => s.build.vehicleId);
  const upfitIds = useBuilderStore((s) => s.build.upfitIds);
  const build = useBuilderStore((s) => s.build);
  const exploded = useBuilderStore((s) => s.exploded);
  const setExploded = useBuilderStore((s) => s.setExploded);
  const lightsOn = useBuilderStore((s) => s.lightsOn);
  const [ready, setReady] = useState(false);
  // Catalog id -> its paint material's sRGB hex, e.g. { "ram-696j-body": { "upfit-paint": "#1F5EFF" } }.
  const partColors = useMemo(
    () =>
      Object.fromEntries(
        paintTargets(build).map((t) => [
          t.id,
          { [t.upfit ? PAINT_MATERIAL.upfit : PAINT_MATERIAL.vehicle]: t.color.hex },
        ]),
      ),
    [build],
  );

  return (
    <>
      <Helmet>
        <title>{getVehicle(vehicleId)?.name || "Showroom"} | NWT Truck Builder</title>
      </Helmet>
      <div className="absolute inset-0 z-0">
        <ShowroomScene
          vehicleId={vehicleId}
          upfitIds={upfitIds}
          partColors={partColors}
          exploded={exploded}
          onExplodedChange={setExploded}
          lightsOn={lightsOn}
          interaction="orbit"
          theme="light"
          lightsTheme="dark"
          onReady={setReady}
        />
      </div>
      {!ready && <LoadingOverlay />}
    </>
  );
}
