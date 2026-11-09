"use client";
import BuilderPanel from "@/components/builder/BuilderPanel";
import Scene from "@/components/builder/Scene";
import SpecSheet from "@/components/builder/SpecSheet";
import { useBuilderStore } from "@/lib/builder-store";
import { getVehicle } from "@/lib/catalog";
import { Lightbulb, Rotate3d, Truck } from "lucide-react";
import Link from "next/link";

export default function TruckBuilder() {
  const vehicleId = useBuilderStore((s) => s.build.vehicleId);
  const lightsOn = useBuilderStore((s) => s.lightsOn);
  const setLightsOn = useBuilderStore((s) => s.setLightsOn);

  return (
    <>
    <SpecSheet />
    <div className="flex h-dvh w-full flex-col print:hidden">
      <header className="z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-extrabold"
          aria-label="New Work Trucks home"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Truck className="size-4" />
          </span>
          <span className="hidden sm:inline">New Work Trucks</span>
        </Link>
        <span aria-hidden className="h-5 w-px bg-border" />
        <h1 className="truncate text-base font-semibold sm:text-lg">
          {getVehicle(vehicleId)?.name}
        </h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-0 flex-1 bg-gradient-to-b from-primary/10 to-background">
          <Scene />
          <p className="pointer-events-none absolute bottom-3 left-3 flex items-center sm:left-1/2 sm:-translate-x-1/2 gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-base text-muted-foreground whitespace-nowrap backdrop-blur">
            <Rotate3d className="size-4" /> Pick a view above, or drag to rotate
          </p>
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
        <aside className="sm:max-h-[52dvh] lg:max-h-full shrink-0 overflow-y-auto rounded-t-2xl border-t bg-background shadow-[0_-8px_24px_rgba(0,0,0,0.08)] lg:h-auto lg:w-96 lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-none">
          <BuilderPanel />
        </aside>
      </div>
    </div>
    </>
  );
}
