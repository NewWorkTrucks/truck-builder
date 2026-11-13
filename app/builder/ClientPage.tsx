"use client";
import BuilderHeader from "@/components/builder/BuilderHeader";
import BuilderPanel from "@/components/builder/BuilderPanel";
import Scene from "@/components/builder/Scene";
import { useBuilderStore } from "@/lib/builder-store";
import { getVehicle } from "@/lib/catalog";
import { Lightbulb, PanelRightClose, PanelRightOpen, Rotate3d } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * The builder. Two layouts, picked by CSS (see the `wide` and `compact` variants
 * in globals.css), so a phone never flashes the desktop layout first:
 * - wide (large screens, any landscape screen): the options sidebar beside the
 *   truck, which a corner button hides to preview the truck.
 * - compact (phones and tablets upright): the truck fills the screen over a
 *   one-line summary bar; "Edit" opens the options below the truck.
 */
export default function TruckBuilder() {
  // Wide: the sidebar is hidden. Compact: the options are open.
  const [panelHidden, setPanelHidden] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The toggle fades out, swaps its icon, then fades back in.
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
    <div className="flex h-dvh w-full flex-col print:hidden">
      <BuilderHeader title={getVehicle(vehicleId)?.name} />

      <div className="flex min-h-0 flex-1 flex-col wide:flex-row">
        <div className="relative min-h-0 flex-1 bg-gradient-to-b from-primary/10 to-background">
          <Scene />
          <p className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-base whitespace-nowrap text-muted-foreground backdrop-blur sm:left-1/2 sm:-translate-x-1/2">
            <Rotate3d className="size-4" />
            <span className="sm:hidden">Drag to rotate</span>
            <span className="max-sm:hidden">Pick a view above, or drag to rotate</span>
          </p>
          <button
            type="button"
            aria-expanded={!panelHidden}
            aria-controls="builder-panel"
            aria-label="Options panel"
            title={panelHidden ? "Show options" : "Hide options to preview the truck"}
            onClick={togglePanel}
            // Wide only: the 3D area's top-right, which is the sidebar's top-left while it is open.
            className={`absolute top-3 right-3 flex size-12 items-center justify-center rounded-full border bg-background/90 shadow-sm backdrop-blur transition-[opacity,colors] duration-150 outline-none hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none compact:hidden ${fading ? "opacity-0" : "opacity-100"}`}
          >
            {panelHidden ? (
              <PanelRightOpen className="size-5" aria-hidden />
            ) : (
              <PanelRightClose className="size-5" aria-hidden />
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

        {/* Hidden with CSS, not unmounted, so the panel keeps its open dropdowns, scroll and form. */}
        <aside
          id="builder-panel"
          className={`shrink-0 overflow-y-auto bg-background wide:w-96 wide:border-l compact:rounded-t-2xl compact:border-t compact:shadow-[0_-8px_24px_rgba(0,0,0,0.08)] max-lg:landscape:w-80 ${
            panelHidden ? "wide:hidden" : ""
          } ${sheetOpen ? "compact:max-h-[60dvh]" : ""}`}
        >
          <BuilderPanel sheetOpen={sheetOpen} onSheetOpenChange={setSheetOpen} />
        </aside>
      </div>
    </div>
  );
}
