import { create } from "zustand";
import { changeVehicle, toggleUpfit, type Build } from "./builder";
import { VEHICLES } from "./catalog";
import type { PaintColorId } from "./paint";

type BuilderState = {
  build: Build;
  /** Side effects of the last change, e.g. "Added 696J Body (required)". */
  notices: string[];
  changeVehicle: (id: string) => void;
  toggleUpfit: (id: string) => void;
  /** Paints the vehicle (its id) or one upfit (its id). */
  setPaint: (targetId: string, color: PaintColorId) => void;
  /** "Show parts": upfits separated from the chassis. */
  exploded: boolean;
  setExploded: (exploded: boolean) => void;
  /** Headlights and taillights on the 3D truck. */
  lightsOn: boolean;
  setLightsOn: (on: boolean) => void;
  /** The spec sheet's exploded-view picture matches the current build, so printing is ready. */
  specShotReady: boolean;
  setSpecShotReady: (ready: boolean) => void;
  dismissNotices: () => void;
};

export const useBuilderStore = create<BuilderState>((set, get) => ({
  build: changeVehicle(VEHICLES[0].id),
  notices: [],
  changeVehicle: (id) => {
    if (id === get().build.vehicleId) return;
    set({ build: changeVehicle(id, get().build.paint), notices: [] });
  },
  toggleUpfit: (id) => {
    const { build, notices } = toggleUpfit(get().build, id);
    set({ build, notices });
  },
  setPaint: (targetId, color) => {
    const { build } = get();
    const { paint } = build;
    const next =
      targetId === build.vehicleId
        ? { ...paint, vehicle: color }
        : { ...paint, upfits: { ...paint.upfits, [targetId]: color } };
    if (next.vehicle === paint.vehicle && next.upfits[targetId] === paint.upfits[targetId]) return;
    set({ build: { ...build, paint: next } });
  },
  exploded: false,
  setExploded: (exploded) => set({ exploded }),
  lightsOn: false,
  setLightsOn: (lightsOn) => set({ lightsOn }),
  specShotReady: false,
  setSpecShotReady: (specShotReady) => set({ specShotReady }),
  dismissNotices: () => set({ notices: [] }),
}));
