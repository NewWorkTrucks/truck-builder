"use client";
import BuilderHeader from "@/components/builder/BuilderHeader";
import BuilderPanel from "@/components/builder/BuilderPanel";
import Scene from "@/components/builder/Scene";
import SpecSheet from "@/components/builder/SpecSheet";
import { useBuilderStore } from "@/lib/builder-store";
import { getVehicle } from "@/lib/catalog";
import { Lightbulb, PanelRightClose, PanelRightOpen, Rotate3d } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function TruckBuilder() {
  const [panelHidden, setPanelHidden] = useState(false);
  // The toggle fades out, jumps to its other corner, then fades back in.
  const [fading, setFading] = useState(false);
  const fadeTimer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(fadeTimer.current), []);
  const togglePanel = () => {
    if (fading) return;
    setFading(true);
    fadeTimer.current = window.setTimeout(() => {
      setPanelHidden((h) => !h);
      setFading(false);
    }, 150);
  };
  const vehicleId = useBuilderStore((s) => s.build.vehicleId);
  const lightsOn = useBuilderStore((s) => s.lightsOn);
  const setLightsOn = useBuilderStore((s) => s.setLightsOn);

  return (
    <>
    <SpecSheet />
    <div className="flex h-dvh w-full flex-col print:hidden">
      <BuilderHeader title={getVehicle(vehicleId)?.name} />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-0 flex-1 bg-gradient-to-b from-primary/10 to-background">
          <Scene />
          <p className={`pointer-events-none absolute bottom-3 left-3 flex items-center sm:left-1/2 sm:-translate-x-1/2 gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-base text-muted-foreground whitespace-nowrap backdrop-blur ${panelHidden ? "" : "max-sm:hidden"}`}>
            <Rotate3d className="size-4" /> Pick a view above, or drag to rotate
          </p>
          <button
            type="button"
            aria-expanded={!panelHidden}
            aria-controls="builder-panel"
            aria-label="Options panel"
            title={panelHidden ? "Show options" : "Hide options to preview the truck"}
            onClick={togglePanel}
            className={`absolute flex size-12 items-center justify-center rounded-full border bg-background/90 shadow-sm backdrop-blur transition-[opacity,colors] duration-150 outline-none hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none ${
              // Open: top-left corner of the sidebar (the 3D area's top-right on large
              // screens, the bottom sheet's top-left on phones). Closed: top-right.
              panelHidden ? "top-3 right-3" : "max-lg:bottom-3 max-lg:left-3 lg:top-3 lg:right-3"
            } ${fading ? "opacity-0" : "opacity-100"}`}
          >
            {panelHidden ? (
              <PanelRightOpen className="size-5 max-lg:rotate-90" aria-hidden />
            ) : (
              <PanelRightClose className="size-5 max-lg:rotate-90" aria-hidden />
            )}
          </button>
          <button
            type="button"
            aria-pressed={lightsOn}
            aria-label="Truck lights"
            title={lightsOn ? "Turn lights off" : "Turn lights on"}
            onClick={() => setLightsOn(!lightsOn)}
            className="absolute right-3 bottom-3 flex size-12 items-center justify-center rounded-full border bg-background/90 shadow-sm backdrop-blur transition-colors outline-none hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            <Lightbulb className="size-5" aria-hidden />
          </button>
        </div>

        {/* Bottom sheet on phones, sidebar on large screens. */}
        {/* Hidden, not unmounted, so the panel keeps its open dropdowns and scroll. */}
        <aside
          id="builder-panel"
          hidden={panelHidden}
          className="sm:max-h-[52dvh] lg:max-h-full shrink-0 overflow-y-auto rounded-t-2xl border-t bg-background shadow-[0_-8px_24px_rgba(0,0,0,0.08)] lg:h-auto lg:w-96 lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-none"
        >
          <BuilderPanel />
        </aside>
      </div>
    </div>
    </>
  );
}
