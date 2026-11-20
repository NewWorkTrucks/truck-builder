import type { PaintColorId } from "./paint";

export type UpfitCategory = "body" | "rack" | "bumper";

export type Vehicle = {
  id: string;
  name: string;
  fileName: string;
  /**
   * Direction the cab faces in model space, as [x, z]. Camera presets aim from
   * it. The modelling spec wants +X forward ([1, 0]); RAM files predate it.
   */
  front: [number, number];
  /** Upfits selected when this vehicle is first chosen. */
  defaultUpfitIds: string[];
  /** Factory colors offered for it and its bodies and racks; the first is the default. */
  paints: readonly PaintColorId[];
};

export type Upfit = {
  id: string;
  name: string;
  category: UpfitCategory;
  fileName: string;
  position?: [number, number, number];
  /** Vehicles this upfit fits. */
  vehicleIds: string[];
  /** Upfits that must be installed first (pre-requisites). */
  requires?: string[];
  /** Upfits that can never be combined with this one, beyond slot exclusivity. */
  conflictsWith?: string[];
};

export type CategoryInfo = {
  id: UpfitCategory;
  label: string;
  /** Only one upfit from an exclusive category can be installed at a time. */
  exclusive: boolean;
  /** Its models carry the "upfit-paint" material and follow the upfit paint color. */
  painted: boolean;
};

export const CATEGORIES: CategoryInfo[] = [
  { id: "body", label: "Body", exclusive: true, painted: true },
  { id: "rack", label: "Racks", exclusive: false, painted: true },
  { id: "bumper", label: "Bumpers", exclusive: true, painted: false },
];

export const VEHICLES: Vehicle[] = [
  {
    id: "ram-2500hd-cc",
    name: "RAM 2500HD CC",
    fileName: "RAM 2500HD CC.glb",
    front: [0, -1],
    defaultUpfitIds: ["ram-696j-body"],
    paints: [
      "ram-bright-white",
      "ram-diamond-black",
      "ram-forged-blue",
      "ram-granite-crystal",
      "ram-molten-red",
      "ram-serrano-green",
      "ram-silver-zynith",
    ],
  },
  {
    id: "chevy-express-3500",
    name: "Chevrolet Express 3500",
    fileName: "Chevrolet express 3500.glb",
    front: [1, 0],
    defaultUpfitIds: [],
    paints: [
      "chevy-summit-white",
      "chevy-black",
      "chevy-sterling-gray",
      "chevy-cypress-gray",
      "chevy-riptide-blue",
      "chevy-lakeshore-blue",
      "chevy-red-hot",
      "chevy-radiant-red",
      "chevy-white-sands",
      "chevy-polar-white",
    ],
  },
];

export const UPFITS: Upfit[] = [
  {
    id: "ram-696j-body",
    name: "696J Body",
    category: "body",
    fileName: "RAM 2500HD CC 696j Body.glb",
    vehicleIds: ["ram-2500hd-cc"],
  },
  {
    id: "ram-696j-utility-rack",
    name: "696J Utility Rack",
    category: "rack",
    fileName: "RAM 2500HD CC 696j Utility Rack.glb",
    vehicleIds: ["ram-2500hd-cc"],
    requires: ["ram-696j-body"],
  },
  {
    id: "ram-696j-hitch-recess-bumper",
    name: "696J Hitch Recess Bumper",
    category: "bumper",
    fileName: "RAM 2500HD CC 696j Hitch Recess Bumper.glb",
    vehicleIds: ["ram-2500hd-cc"],
    requires: ["ram-696j-body"],
  },
  {
    id: "ram-696j-step-bumper",
    name: "696J Step Bumper",
    category: "bumper",
    fileName: "RAM 2500HD CC 696j Step Bumper.glb",
    vehicleIds: ["ram-2500hd-cc"],
    requires: ["ram-696j-body"],
  },
  {
    id: "ram-696j-straight-bumper",
    name: "696J Straight Bumper",
    category: "bumper",
    fileName: "RAM 2500HD CC 696j Straight Bumper.glb",
    vehicleIds: ["ram-2500hd-cc"],
    requires: ["ram-696j-body"],
  },
  {
    id: "chevy-kuv129su-body",
    name: "KUV129SU Body",
    category: "body",
    fileName: "Chev express 3500 - KUV129SU.glb",
    vehicleIds: ["chevy-express-3500"],
  },
  {
    id: "chevy-kuv129su-tri-wing-ladder-rack",
    name: "KUV129SU Tri-Wing Ladder Rack",
    category: "rack",
    fileName: "Chev express 3500 - KUV129SU - Tri wing ladder rack.glb",
    vehicleIds: ["chevy-express-3500"],
    requires: ["chevy-kuv129su-body"],
  },
];

export const getVehicle = (id: string) => VEHICLES.find((v) => v.id === id);

/** The colors a vehicle offers (for it and its bodies and racks); the first is its default. */
export const vehiclePaints = (vehicleId: string): readonly PaintColorId[] =>
  getVehicle(vehicleId)?.paints ?? VEHICLES[0].paints;
export const getUpfit = (id: string) => UPFITS.find((u) => u.id === id);
export const getCategory = (id: UpfitCategory) =>
  CATEGORIES.find((c) => c.id === id)!;

export const upfitsForVehicle = (vehicleId: string) =>
  UPFITS.filter((u) => u.vehicleIds.includes(vehicleId));
