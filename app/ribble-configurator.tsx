"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

type StepId = "graphic" | "size" | "components" | "summary" | "studio";
type StageId = "build" | "style" | "review" | "studio";
type IntroPhase = "loading" | "cinematic" | "ready";
type ComponentKey =
  | "groupset"
  | "crankset"
  | "cassette"
  | "wheel"
  | "cockpit"
  | "pedals"
  | "storage"
  | "seatAdjustment"
  | "saddle";
type ComponentIconKey = "frame" | "wheel" | "groupset" | "cockpit" | "pedals" | "saddle" | "storage";
type ToneMappingKey = "none" | "linear" | "reinhard" | "cineon" | "aces" | "agx" | "neutral";
type HdriAssetKind = "exr" | "hdr" | "image";
type BackgroundMode = "color" | "hdri";

type PaintOption = {
  id: string;
  name: string;
  finish: string;
  frame: string;
  accent: string;
  decal: string;
  priceDelta: number;
};

const stageTabOffsets: Record<StageId, string> = {
  build: "0%",
  style: "100%",
  review: "200%",
  studio: "300%",
};

type ComponentOption = {
  id: string;
  name: string;
  subtitle: string;
  priceDelta: number;
  visual: {
    metal?: string;
    rimDepth?: number;
    saddle?: string;
    cockpit?: string;
  };
};

type ComponentGroup = {
  key: ComponentKey;
  label: string;
  focus: "drivetrain" | "rear" | "front" | "cockpit" | "saddle";
  options: ComponentOption[];
};

type ConfigState = {
  paint: string;
  size: string;
  components: Record<ComponentKey, string>;
};

type ViewerSettings = {
  toneMapping: ToneMappingKey;
  exposure: number;
  environmentIntensity: number;
  environmentRotation: number;
  environmentContrast: number;
  environmentColor: string;
  ambientIntensity: number;
  keyIntensity: number;
  fillIntensity: number;
  rimIntensity: number;
  shadows: boolean;
  vsmBlurSamples: number;
  aoIntensity: number;
  modelAoIntensity: number;
  cameraFov: number;
  pixelRatio: number;
  floorGlow: number;
  backdropGlow: number;
  hdriIntensity: number;
  hdriRotation: number;
  hdriScale: number;
};

type StudioSurfaces = {
  backdropMaterial: THREE.MeshBasicMaterial;
  contactAo: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  contactAoMaterial: THREE.MeshBasicMaterial;
  floor: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  floorGlow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  floorGlowMaterial: THREE.MeshBasicMaterial;
  floorMaterial: THREE.MeshStandardMaterial;
  group: THREE.Group;
  stageRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  stageRingMaterial: THREE.MeshBasicMaterial;
  stageRingHighlight: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
};

type BodyFramePaintMaterial = {
  defaultMap: THREE.Texture | null;
  material: THREE.MeshStandardMaterial;
};

type HdriAsset = {
  kind: HdriAssetKind;
  name: string;
  url: string;
};

type HdriPreset = HdriAsset & {
  id: string;
  label: string;
  settings: Pick<ViewerSettings, "hdriIntensity" | "hdriRotation" | "hdriScale">;
  swatch: string;
};

type ViewerHotspot = {
  anchor: [number, number, number];
  description?: string;
  id: string;
  label: string;
};

type HdriDomeMaterial = THREE.ShaderMaterial & {
  uniforms: {
    hdriIntensity: { value: number };
    hdriMap: { value: THREE.Texture | null };
    hdriRotation: { value: number };
    hdriScale: { value: number };
  };
};

type ModelAssetId =
  | "baseFrame"
  | "bottle01"
  | "duraAce105Di2"
  | "keoClassic3"
  | "vittoriaRubino32Mm"
  | "mavicCosmicSl45"
  | "zipp303SwCarbon";

type ModelAsset = {
  id: ModelAssetId;
  path: string;
  preload?: boolean;
  sourceGroundY?: number;
};

type NumericViewerSettingKey = {
  [Key in keyof ViewerSettings]: ViewerSettings[Key] extends number ? Key : never;
}[keyof ViewerSettings];

const paintOptions: PaintOption[] = [
  {
    id: "iridescent-white-metallic",
    name: "Iridescent White Metallic",
    finish: "Iridescent white metallic",
    frame: "#f1eee6",
    accent: "#d9e7f4",
    decal: "#9d998f",
    priceDelta: 0,
  },
  {
    id: "damson-metallic",
    name: "Damson Metallic",
    finish: "Damson metallic",
    frame: "#3a1426",
    accent: "#7b3048",
    decal: "#f0e8df",
    priceDelta: 0,
  },
  {
    id: "slate-grey-metallic",
    name: "Slate Grey Metallic",
    finish: "Slate grey metallic",
    frame: "#555d5f",
    accent: "#22272a",
    decal: "#f3efe6",
    priceDelta: 0,
  },
];

const sizeOptions = [
  { dimensions: "5'9\" / 167 - 176 CM", id: "S", label: "Small" },
  { dimensions: "5'9\" / 174 - 181 CM", id: "M", label: "Medium" },
  { dimensions: "6'1\" / 179 - 188 CM", id: "L", label: "Large" },
];

const frameSizeMorphValues: Record<string, number> = {
  L: 1,
  M: 0.5,
  S: 0,
};

const handlebarSizeMorphValues: Record<string, number> = {
  "handlebar-38-80": 0,
  "handlebar-42-110": 1,
  "handlebar-42-120": 0.5,
};

const seatAdjustmentMorphValues: Record<string, number> = {
  "seat-high": 1,
  "seat-low": 0,
  "seat-med": 0.5,
};

const viewerHotspots: ViewerHotspot[] = [
  { anchor: [0.5, 0.58, 0.58], id: "body-frame", label: "Body Frame" },
  {
    anchor: [0.82, 0.8, 0.62],
    description:
      "Crafted from high-grade carbon, the Ribble integrated bar and stem pairs aerodynamic efficiency with a clean, refined aesthetic.",
    id: "handle",
    label: "Handle",
  },
  {
    anchor: [0.82, 0.26, 0.6],
    description:
      "Carbon wheels deliver real-world speed, control and versatility across smooth roads and rougher surfaces alike.",
    id: "wheels",
    label: "Wheels",
  },
  {
    anchor: [0.22, 0.93, 0.58],
    description:
      "A newly designed proprietary carbon aero seatpost introduces controlled vertical movement to absorb road vibration and reduce fatigue over long rides.",
    id: "saddle",
    label: "Saddle",
  },
  {
    anchor: [0.43, 0.25, 0.66],
    description:
      "The pinnacle of Shimano road technology, delivers lightning-fast wireless shifting that redefines what electronic performance feels like at every pace.",
    id: "groupset",
    label: "Groupset",
  },
  {
    anchor: [0.55, 0.42, 0.64],
    description:
      "ULTRA-ROAD features a dedicated internal downtube storage compartment, built to keep your essentials such as spares, nutrition, tools accessible mid-ride without saddlebags.",
    id: "bottle-cage",
    label: "Bottle Cage",
  },
];

const defaultViewerSettings: ViewerSettings = {
  ambientIntensity: 0,
  aoIntensity: 0,
  backdropGlow: 0,
  cameraFov: 35,
  environmentColor: "#ddd9d3",
  environmentContrast: 1.08,
  environmentIntensity: 1.06,
  environmentRotation: 22,
  exposure: 0.61,
  fillIntensity: 1.9,
  floorGlow: 0.75,
  hdriIntensity: 1.1,
  hdriRotation: 0,
  hdriScale: 0.5,
  keyIntensity: 1.55,
  modelAoIntensity: 0.89,
  pixelRatio: 3,
  rimIntensity: 0.95,
  shadows: true,
  toneMapping: "aces",
  vsmBlurSamples: 24,
};

const toneMappingValues: Record<ToneMappingKey, number> = {
  aces: THREE.ACESFilmicToneMapping,
  agx: THREE.AgXToneMapping,
  cineon: THREE.CineonToneMapping,
  linear: THREE.LinearToneMapping,
  neutral: THREE.NeutralToneMapping,
  none: THREE.NoToneMapping,
  reinhard: THREE.ReinhardToneMapping,
};

const toneMappingLabels: Array<{ id: ToneMappingKey; label: string }> = [
  { id: "aces", label: "ACES Filmic" },
  { id: "agx", label: "AgX" },
  { id: "neutral", label: "Neutral" },
  { id: "reinhard", label: "Reinhard" },
  { id: "cineon", label: "Cineon" },
  { id: "linear", label: "Linear" },
  { id: "none", label: "None" },
];

const getSizeLabel = (sizeId: string) => {
  return sizeOptions.find((size) => size.id === sizeId)?.label ?? sizeId;
};

const componentGroups: ComponentGroup[] = [
  {
    key: "groupset",
    label: "Groupset",
    focus: "drivetrain",
    options: [
      {
        id: "shimano-105-di2",
        name: "Dura-Ace 105 Di2",
        subtitle: "Electronic 12 speed",
        priceDelta: 0,
        visual: { metal: "#b9bec4" },
      },
      {
        id: "sram-force-axs",
        name: "SRAM RED AXS E1",
        subtitle: "Wireless 12 speed",
        priceDelta: 0,
        visual: { metal: "#1f2428" },
      },
    ],
  },
  {
    key: "crankset",
    label: "Crankset",
    focus: "drivetrain",
    options: [
      {
        id: "compact-50-34",
        name: "Compact 50/34T",
        subtitle: "Balanced climbing setup",
        priceDelta: 0,
        visual: {},
      },
      {
        id: "semi-compact-52-36",
        name: "Semi Compact 52/36T",
        subtitle: "Fast road gearing",
        priceDelta: 90,
        visual: {},
      },
      {
        id: "power-meter",
        name: "Power Meter 52/36T",
        subtitle: "Integrated dual-sided meter",
        priceDelta: 420,
        visual: { metal: "#202126" },
      },
    ],
  },
  {
    key: "cassette",
    label: "Cassette",
    focus: "rear",
    options: [
      {
        id: "11-30",
        name: "11-30T",
        subtitle: "Fast rolling road range",
        priceDelta: 0,
        visual: {},
      },
      {
        id: "11-34",
        name: "11-34T",
        subtitle: "Extra climbing range",
        priceDelta: 65,
        visual: {},
      },
    ],
  },
  {
    key: "wheel",
    label: "Wheels",
    focus: "front",
    options: [
      {
        id: "level-db40",
        name: "Vittoria Rubino 32",
        subtitle: "32 mm road tire",
        priceDelta: 0,
        visual: { rimDepth: 32 },
      },
      {
        id: "mavic-cosmic",
        name: "Mavic Cosmic SL 45",
        subtitle: "45 mm carbon wheelset",
        priceDelta: 0,
        visual: { rimDepth: 45 },
      },
      {
        id: "zipp-404",
        name: "Zipp 303 SW Carbon",
        subtitle: "Carbon road wheelset",
        priceDelta: 0,
        visual: { rimDepth: 40 },
      },
    ],
  },
  {
    key: "pedals",
    label: "Pedals",
    focus: "drivetrain",
    options: [
      {
        id: "keo-classic-3",
        name: "Keo Classic 3",
        subtitle: "Road clip-in pedals",
        priceDelta: 0,
        visual: {},
      },
      {
        id: "wahoo-speedplay-comp",
        name: "Wahoo Speedplay Comp Pedals",
        subtitle: "Dual-sided road pedals",
        priceDelta: 0,
        visual: {},
      },
    ],
  },
  {
    key: "storage",
    label: "Bottle & Cage",
    focus: "drivetrain",
    options: [
      {
        id: "bottle-cage",
        name: "AERO BOTTLE CAGE BUNDLE",
        subtitle: "Cage Bundle",
        priceDelta: 0,
        visual: {},
      },
      {
        id: "water-bottle-500ml",
        name: "Water Bottle 500 ML",
        subtitle: "Bottle and cage add-on",
        priceDelta: 0,
        visual: {},
      },
    ],
  },
  {
    key: "cockpit",
    label: "Handlebar Size",
    focus: "cockpit",
    options: [
      {
        id: "handlebar-38-80",
        name: "38CM x 80MM",
        subtitle: "Compact reach",
        priceDelta: 0,
        visual: { cockpit: "#191b1d" },
      },
      {
        id: "handlebar-42-120",
        name: "42CM x 120MM",
        subtitle: "Extended race fit",
        priceDelta: 0,
        visual: { cockpit: "#050607" },
      },
      {
        id: "handlebar-42-110",
        name: "42CM x 110MM",
        subtitle: "Balanced road fit",
        priceDelta: 0,
        visual: { cockpit: "#050607" },
      },
    ],
  },
  {
    key: "seatAdjustment",
    label: "Seat Adjustment",
    focus: "saddle",
    options: [
      {
        id: "seat-low",
        name: "LOW",
        subtitle: "Low saddle position",
        priceDelta: 0,
        visual: {},
      },
      {
        id: "seat-med",
        name: "MED",
        subtitle: "Medium saddle position",
        priceDelta: 0,
        visual: {},
      },
      {
        id: "seat-high",
        name: "HIGH",
        subtitle: "High saddle position",
        priceDelta: 0,
        visual: {},
      },
    ],
  },
  {
    key: "saddle",
    label: "Saddle",
    focus: "saddle",
    options: [
      {
        id: "prologo",
        name: "Prologo Dimension",
        subtitle: "Short-fit performance saddle",
        priceDelta: 0,
        visual: { saddle: "#161616" },
      },
      {
        id: "selle-italia",
        name: "Selle Italia SLR Boost",
        subtitle: "Carbon rail upgrade",
        priceDelta: 210,
        visual: { saddle: "#f1eee7" },
      },
    ],
  },
];

const basePrice = 4299;
const formatter = new Intl.NumberFormat("en-GB", {
  currency: "GBP",
  maximumFractionDigits: 0,
  style: "currency",
});
const modelName = "NEW ULTRA-ROAD";
const publicAsset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
const hdriPresets: HdriPreset[] = [
  {
    id: "german-town-street",
    kind: "hdr",
    label: "German Town",
    name: "german_town_street_2k.hdr",
    settings: { hdriIntensity: 1.1, hdriRotation: 0, hdriScale: 0.5 },
    swatch: "linear-gradient(145deg, #d8e7f2 0%, #8a9da4 46%, #39464a 100%)",
    url: publicAsset("hdri/german_town_street_2k.hdr"),
  },
  {
    id: "tief-etz",
    kind: "hdr",
    label: "Tief Etz",
    name: "tief_etz_2k.hdr",
    settings: { hdriIntensity: 1, hdriRotation: 0, hdriScale: 0.5 },
    swatch: "linear-gradient(145deg, #c9d1bf 0%, #6e7a5d 48%, #243022 100%)",
    url: publicAsset("hdri/tief_etz_2k.hdr"),
  },
  {
    id: "studio-small",
    kind: "hdr",
    label: "Studio Small",
    name: "studio_small_08_2k.hdr",
    settings: { hdriIntensity: 1.15, hdriRotation: 0, hdriScale: 0.5 },
    swatch: "linear-gradient(145deg, #f1ede3 0%, #9a958c 48%, #2d2c2a 100%)",
    url: publicAsset("hdri/studio_small_08_2k.hdr"),
  },
];
const defaultHdriAsset = hdriPresets[0];
const backgroundColorPresets = [
  { color: defaultViewerSettings.environmentColor, id: "default", label: "Default" },
  { color: "#000000", id: "black", label: "Black" },
  { color: "#296E85", id: "teal-blue", label: "Teal Blue" },
];
const bodyFramePaintMaterialName = "Plane.012_QB_Baked_Material.004";
const bodyFrameDiffuseMaps: Partial<Record<string, string>> = {
  "damson-metallic": "textures/skins/damson-metallic.jpg",
  "slate-grey-metallic": "textures/skins/slate-grey-metallic.jpg",
};
function getHdriAssetKind(fileName: string): HdriAssetKind {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "hdr") {
    return "hdr";
  }

  if (extension === "exr") {
    return "exr";
  }

  return "image";
}
const modelAssets = {
  baseFrame: {
    id: "baseFrame",
    path: "models/base/frame.glb",
  },
  bottle01: {
    id: "bottle01",
    path: "models/storage/bottle-01.glb",
    preload: true,
  },
  duraAce105Di2: {
    id: "duraAce105Di2",
    path: "models/groupset/dura-ace-105-di2.glb",
    preload: true,
  },
  keoClassic3: {
    id: "keoClassic3",
    path: "models/pedals/keo-classic-3.glb",
    preload: true,
  },
  mavicCosmicSl45: {
    id: "mavicCosmicSl45",
    path: "models/wheels/mavic-cosmic-sl-45.glb",
    preload: true,
    sourceGroundY: -2.2691,
  },
  vittoriaRubino32Mm: {
    id: "vittoriaRubino32Mm",
    path: "models/wheels/vittoria-rubino-32-mm.glb",
    preload: true,
    sourceGroundY: -2.2691,
  },
  zipp303SwCarbon: {
    id: "zipp303SwCarbon",
    path: "models/wheels/zipp-303-sw-carbon.glb",
    preload: true,
    sourceGroundY: -2.2886,
  },
} satisfies Record<ModelAssetId, ModelAsset>;
const bikeModelUrl = publicAsset(modelAssets.baseFrame.path);
const componentAddonAssets: Partial<Record<ComponentKey, Partial<Record<string, ModelAsset>>>> = {
  groupset: {
    "shimano-105-di2": modelAssets.duraAce105Di2,
  },
  pedals: {
    "keo-classic-3": modelAssets.keoClassic3,
  },
  storage: {
    "water-bottle-500ml": modelAssets.bottle01,
  },
  wheel: {
    "level-db40": modelAssets.vittoriaRubino32Mm,
    "mavic-cosmic": modelAssets.mavicCosmicSl45,
    "zipp-404": modelAssets.zipp303SwCarbon,
  },
};
const startupCameraDistance = 4.85;
const startupCameraX = 1.02;
const startupCameraHeightOffset = 0.48;
const startupLookHeightOffset = 0.02;
// Authored GLB wheel-contact height. Keep the studio floor fixed and move assets to this line.
const bikeSourceGroundY = -2.28;
const modelGroundY = -0.82;
const studioFloorClearance = 0.012;
const studioFloorY = modelGroundY - studioFloorClearance;
const modelRenderOrder = 10;

const defaultConfig: ConfigState = {
  paint: "iridescent-white-metallic",
  size: "M",
  components: {
    groupset: "shimano-105-di2",
    crankset: "compact-50-34",
    cassette: "11-30",
    wheel: "level-db40",
    cockpit: "handlebar-38-80",
    pedals: "keo-classic-3",
    storage: "bottle-cage",
    seatAdjustment: "seat-low",
    saddle: "prologo",
  },
};

function getPaint(id: string) {
  return paintOptions.find((option) => option.id === id) ?? paintOptions[0];
}

function getComponent(group: ComponentGroup, id: string) {
  return group.options.find((option) => option.id === id) ?? group.options[0];
}

function getComponentGroup(groupKey: ComponentKey) {
  return componentGroups.find((group) => group.key === groupKey) ?? componentGroups[0];
}

function getFocusForGroup(groupKey: ComponentKey | null) {
  if (!groupKey) {
    return "default";
  }

  return componentGroups.find((group) => group.key === groupKey)?.focus ?? "default";
}

function getComponentIconKey(key: ComponentKey | "frame"): ComponentIconKey {
  if (key === "wheel") {
    return "wheel";
  }

  if (key === "cockpit") {
    return "cockpit";
  }

  if (key === "pedals") {
    return "pedals";
  }

  if (key === "storage") {
    return "storage";
  }

  if (key === "seatAdjustment" || key === "saddle") {
    return "saddle";
  }

  if (key === "groupset" || key === "crankset" || key === "cassette") {
    return "groupset";
  }

  return "frame";
}

function PartIcon({ kind }: { kind: ComponentIconKey }) {
  if (kind === "wheel") {
    return (
      <svg aria-hidden="true" className="part-icon-svg" focusable="false" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="15" />
        <circle cx="24" cy="24" r="3.4" />
        <path d="M24 9v30M9 24h30M13.4 13.4l21.2 21.2M34.6 13.4 13.4 34.6" />
      </svg>
    );
  }

  if (kind === "cockpit") {
    return (
      <svg aria-hidden="true" className="part-icon-svg" focusable="false" viewBox="0 0 48 48">
        <path d="M13 25h10c3.8 0 5.4-3.7 8.9-3.7H36" />
        <path d="M13 25c-4.2 0-6.7 2.6-6.7 6.3 0 3.1 2.1 5.1 5 5.1" />
        <path d="M36 21.3c4 0 6.7 2.9 6.7 6.8 0 3.4-2 5.7-5.1 5.7" />
        <path d="M22.5 25v-7h8.8" />
      </svg>
    );
  }

  if (kind === "saddle") {
    return (
      <svg aria-hidden="true" className="part-icon-svg" focusable="false" viewBox="0 0 48 48">
        <path d="M8 23.5c5.4-4.5 17.3-5.5 29.5-1.8 2.4.7 3.4 3.6 1.6 5.4-3.5 3.4-13.3 4.2-25.5.8-3.8-1.1-6-2.3-5.6-4.4Z" />
        <path d="M20 29.4 17.4 38M29 29.8 32.2 38M17.4 38h14.8" />
      </svg>
    );
  }

  if (kind === "groupset") {
    return (
      <svg aria-hidden="true" className="part-icon-svg" focusable="false" viewBox="0 0 48 48">
        <circle cx="20" cy="25" r="10.5" />
        <circle cx="20" cy="25" r="4" />
        <path d="M20 14.5v21M9.5 25h21M12.6 17.6l14.8 14.8M27.4 17.6 12.6 32.4" />
        <path d="M28.3 30.8 38.8 37M38.8 37l2.4-4.2" />
      </svg>
    );
  }

  if (kind === "pedals") {
    return (
      <svg aria-hidden="true" className="part-icon-svg" focusable="false" viewBox="0 0 48 48">
        <path d="M24 14v20M14 18h20M14 30h20" />
        <path d="M7.5 14.5h12v7h-12zM28.5 26.5h12v7h-12z" />
        <path d="M19.5 18h9M19.5 30h9" />
      </svg>
    );
  }

  if (kind === "storage") {
    return (
      <svg aria-hidden="true" className="part-icon-svg" focusable="false" viewBox="0 0 48 48">
        <path d="M20 12h8l2.5 6h-13L20 12Z" />
        <path d="M17.5 18h13l1.5 17c.2 2.4-1.7 4.5-4.1 4.5h-7.8c-2.4 0-4.3-2.1-4.1-4.5l1.5-17Z" />
        <path d="M14 23c2.8 2.4 17.2 2.4 20 0M15 33c3.2 2.7 14.8 2.7 18 0" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="part-icon-svg" focusable="false" viewBox="0 0 48 48">
      <path d="M8 32h12.8L32 14H16.3L8 32Z" />
      <path d="M16.3 14 20.8 32 32 14l8 18H20.8" />
      <circle cx="20.8" cy="32" r="3.4" />
      <circle cx="40" cy="32" r="3.4" />
    </svg>
  );
}

function tubeBetween(
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  material: THREE.Material,
) {
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 24, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createLabelSprite(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");

  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = color;
    context.font = "700 58px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.65, 0.42, 1);
  return sprite;
}

function createWheel(x: number, rimDepth: number, materials: Record<string, THREE.Material>) {
  const group = new THREE.Group();
  const rimScale = 1 + Math.max(0, rimDepth - 40) / 260;
  const tire = new THREE.Mesh(
    new THREE.TorusGeometry(0.86, 0.045, 20, 96),
    materials.tire,
  );
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.78, 0.025 * rimScale, 16, 96),
    materials.rim,
  );
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.18, 24), materials.metal);

  tire.rotation.y = Math.PI / 2;
  rim.rotation.y = Math.PI / 2;
  hub.rotation.z = Math.PI / 2;
  group.add(tire, rim, hub);

  for (let index = 0; index < 20; index += 1) {
    const angle = (Math.PI * 2 * index) / 20;
    const y = Math.sin(angle) * 0.73;
    const z = Math.cos(angle) * 0.73;
    group.add(tubeBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, y, z), 0.005, materials.spoke));
  }

  group.position.set(x, 0.86, 0);
  return group;
}

function buildBike(config: ConfigState, focus: string) {
  const paint = getPaint(config.paint);
  const wheelOption = getComponent(getComponentGroup("wheel"), config.components.wheel);
  const groupsetOption = getComponent(getComponentGroup("groupset"), config.components.groupset);
  const cockpitOption = getComponent(getComponentGroup("cockpit"), config.components.cockpit);
  const saddleOption = getComponent(getComponentGroup("saddle"), config.components.saddle);

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: paint.frame,
    emissive: paint.frame,
    emissiveIntensity: 0.08,
    metalness: 0.62,
    roughness: 0.32,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: paint.accent,
    metalness: 0.42,
    roughness: 0.26,
  });
  const blackMaterial = new THREE.MeshStandardMaterial({
    color: "#121313",
    emissive: "#101010",
    emissiveIntensity: 0.05,
    metalness: 0.55,
    roughness: 0.44,
  });
  const tireMaterial = new THREE.MeshStandardMaterial({
    color: "#0c0c0c",
    emissive: "#080808",
    emissiveIntensity: 0.04,
    metalness: 0.12,
    roughness: 0.7,
  });
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: groupsetOption.visual.metal ?? "#c9ced2",
    metalness: 0.85,
    roughness: 0.26,
  });
  const cockpitMaterial = new THREE.MeshStandardMaterial({
    color: cockpitOption.visual.cockpit ?? "#141515",
    metalness: 0.5,
    roughness: 0.32,
  });
  const saddleMaterial = new THREE.MeshStandardMaterial({
    color: saddleOption.visual.saddle ?? "#161616",
    metalness: 0.12,
    roughness: 0.52,
  });

  const group = new THREE.Group();
  const rear = new THREE.Vector3(-1.72, 0.86, 0);
  const front = new THREE.Vector3(1.72, 0.86, 0);
  const bottom = new THREE.Vector3(-0.16, 0.92, 0);
  const seatTop = new THREE.Vector3(-0.86, 2.1, 0);
  const headTop = new THREE.Vector3(0.96, 2.0, 0);
  const headLow = new THREE.Vector3(1.16, 1.45, 0);

  group.add(createWheel(rear.x, wheelOption.visual.rimDepth ?? 40, {
    metal: metalMaterial,
    rim: blackMaterial,
    spoke: metalMaterial,
    tire: tireMaterial,
  }));
  group.add(createWheel(front.x, wheelOption.visual.rimDepth ?? 40, {
    metal: metalMaterial,
    rim: blackMaterial,
    spoke: metalMaterial,
    tire: tireMaterial,
  }));

  [
    [bottom, seatTop, 0.055, frameMaterial],
    [bottom, headLow, 0.065, frameMaterial],
    [seatTop, headTop, 0.055, frameMaterial],
    [headTop, headLow, 0.06, frameMaterial],
    [seatTop, rear, 0.038, frameMaterial],
    [bottom, rear, 0.04, frameMaterial],
    [headLow, front, 0.045, frameMaterial],
    [headTop, front, 0.038, frameMaterial],
  ].forEach(([from, to, radius, material]) => {
    group.add(tubeBetween(from as THREE.Vector3, to as THREE.Vector3, radius as number, material as THREE.Material));
  });

  group.add(tubeBetween(new THREE.Vector3(-0.9, 2.06, 0), new THREE.Vector3(-0.85, 2.45, 0), 0.035, blackMaterial));
  group.add(tubeBetween(new THREE.Vector3(0.95, 2.0, 0), new THREE.Vector3(1.22, 2.34, 0), 0.032, cockpitMaterial));
  group.add(tubeBetween(new THREE.Vector3(1.22, 2.34, -0.58), new THREE.Vector3(1.22, 2.34, 0.58), 0.032, cockpitMaterial));
  group.add(tubeBetween(new THREE.Vector3(1.22, 2.34, -0.58), new THREE.Vector3(1.3, 2.12, -0.7), 0.028, cockpitMaterial));
  group.add(tubeBetween(new THREE.Vector3(1.22, 2.34, 0.58), new THREE.Vector3(1.3, 2.12, 0.7), 0.028, cockpitMaterial));

  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.28), saddleMaterial);
  saddle.position.set(-0.93, 2.52, 0);
  saddle.rotation.z = -0.08;
  group.add(saddle);

  const chainring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.018, 16, 60), metalMaterial);
  chainring.position.copy(bottom);
  chainring.rotation.y = Math.PI / 2;
  group.add(chainring);

  const crank = tubeBetween(bottom, new THREE.Vector3(-0.16, 0.48, 0.06), 0.015, blackMaterial);
  group.add(crank);
  group.add(tubeBetween(new THREE.Vector3(-1.7, 0.86, 0.06), new THREE.Vector3(-0.16, 0.92, 0.06), 0.012, metalMaterial));
  group.add(tubeBetween(new THREE.Vector3(-1.7, 0.8, 0.06), new THREE.Vector3(-0.16, 0.86, 0.06), 0.012, metalMaterial));

  const cassette = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.018, 12, 48), metalMaterial);
  cassette.position.set(-1.72, 0.86, 0.08);
  cassette.rotation.y = Math.PI / 2;
  group.add(cassette);

  const logo = createLabelSprite("RIBBLE", paint.decal);
  logo.position.set(0.21, 1.28, 0.075);
  logo.rotation.z = -0.56;
  group.add(logo);

  for (let index = 0; index < 3; index += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.018), accentMaterial);
    stripe.position.set(0.78 + index * 0.08, 1.82 - index * 0.03, 0.076);
    stripe.rotation.z = -0.58;
    group.add(stripe);
  }

  const forkStripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.02), accentMaterial);
  forkStripe.position.set(1.2, 1.38, 0.08);
  forkStripe.rotation.z = -0.3;
  group.add(forkStripe);

  group.position.y = -0.78;
  group.rotation.x = focus === "saddle" ? -0.05 : 0;
  return group;
}

function disposeMaterial(material: THREE.Material) {
  Object.values(material as unknown as Record<string, unknown>).forEach((value) => {
    const texture = value as THREE.Texture | null | undefined;

    if (texture?.isTexture) {
      texture.dispose();
    }
  });

  material.dispose();
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    const material = mesh.material;

    mesh.geometry?.dispose();

    if (Array.isArray(material)) {
      material.forEach((item) => disposeMaterial(item));
    } else if (material) {
      disposeMaterial(material);
    }
  });
}

function tuneStudioMaterial(material: THREE.Material, anisotropy: number) {
  const pbrMaterial = material as THREE.MeshStandardMaterial;

  if ("envMapIntensity" in pbrMaterial) {
    pbrMaterial.envMapIntensity = 1.45;
  }

  const texturedMaterial = material as unknown as Record<string, THREE.Texture | null | undefined>;
  ["aoMap", "map", "metalnessMap", "normalMap", "roughnessMap"].forEach((key) => {
    const texture = texturedMaterial[key];

    if (texture?.isTexture) {
      texture.anisotropy = Math.min(anisotropy, 8);
      texture.needsUpdate = true;
    }
  });

  material.needsUpdate = true;
}

function collectModelMaterials(object: THREE.Object3D) {
  const materials = new Set<THREE.Material>();

  object.traverse((child) => {
    const mesh = child as THREE.Mesh;

    if (!mesh.isMesh || !mesh.material) {
      return;
    }

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => materials.add(material));
    } else {
      materials.add(mesh.material);
    }
  });

  return Array.from(materials);
}

function applyModelAmbientOcclusion(materials: THREE.Material[], intensity: number) {
  const occlusion = THREE.MathUtils.clamp(intensity, 0, 2);
  const shadowColor = new THREE.Color("#14130f");

  materials.forEach((material) => {
    const pbrMaterial = material as THREE.MeshStandardMaterial;
    const materialState = material.userData as {
      studioBaseAoMapIntensity?: number;
      studioBaseColor?: string;
      studioBaseEmissiveIntensity?: number;
      studioBaseEnvMapIntensity?: number;
      studioBaseRoughness?: number;
    };

    if ("aoMapIntensity" in pbrMaterial) {
      materialState.studioBaseAoMapIntensity ??= pbrMaterial.aoMapIntensity;
      pbrMaterial.aoMapIntensity = materialState.studioBaseAoMapIntensity + occlusion;
    }

    if ("envMapIntensity" in pbrMaterial) {
      materialState.studioBaseEnvMapIntensity ??= pbrMaterial.envMapIntensity;
      pbrMaterial.envMapIntensity = materialState.studioBaseEnvMapIntensity * (1 - occlusion * 0.06);
    }

    if ("roughness" in pbrMaterial) {
      materialState.studioBaseRoughness ??= pbrMaterial.roughness;
      pbrMaterial.roughness = Math.min(1, materialState.studioBaseRoughness + occlusion * 0.025);
    }

    if ("emissiveIntensity" in pbrMaterial) {
      materialState.studioBaseEmissiveIntensity ??= pbrMaterial.emissiveIntensity;
      pbrMaterial.emissiveIntensity = materialState.studioBaseEmissiveIntensity * (1 - occlusion * 0.1);
    }

    if ("color" in pbrMaterial && pbrMaterial.color?.isColor) {
      materialState.studioBaseColor ??= `#${pbrMaterial.color.getHexString()}`;
      pbrMaterial.color.set(materialState.studioBaseColor).lerp(shadowColor, occlusion * 0.035);
    }

    material.needsUpdate = true;
  });
}

function getTintedColor(baseColor: string, tintColor: string, amount: number) {
  return new THREE.Color(baseColor).lerp(new THREE.Color(tintColor), amount);
}

function updateViewerHotspots({
  bounds,
  camera,
  container,
  elements,
  point,
}: {
  bounds: THREE.Box3 | null;
  camera: THREE.PerspectiveCamera;
  container: HTMLElement;
  elements: Map<string, HTMLDivElement>;
  point: THREE.Vector3;
}) {
  const width = container.clientWidth;
  const height = container.clientHeight;

  if (!bounds || width <= 0 || height <= 0) {
    elements.forEach((element) => {
      element.style.opacity = "0";
      element.style.visibility = "hidden";
    });
    return;
  }

  viewerHotspots.forEach((hotspot) => {
    const element = elements.get(hotspot.id);
    if (!element) {
      return;
    }

    point.set(
      THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, hotspot.anchor[0]),
      THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, hotspot.anchor[1]),
      THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, hotspot.anchor[2]),
    );
    point.project(camera);

    const screenX = (point.x * 0.5 + 0.5) * width;
    const screenY = (-point.y * 0.5 + 0.5) * height;
    const isVisible =
      point.z > -1 &&
      point.z < 1 &&
      screenX > -80 &&
      screenX < width + 80 &&
      screenY > -60 &&
      screenY < height + 60;

    element.style.opacity = isVisible ? "1" : "0";
    element.style.transform = `translate3d(${screenX}px, ${screenY}px, 0)`;
    element.style.visibility = isVisible ? "visible" : "hidden";
  });
}

function createHdriDomeMaterial(settings: ViewerSettings): HdriDomeMaterial {
  const material = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fog: false,
    fragmentShader: `
      uniform sampler2D hdriMap;
      uniform float hdriIntensity;
      uniform float hdriRotation;
      uniform float hdriScale;
      varying vec3 vWorldDirection;
      #include <common>

      void main() {
        vec3 direction = normalize(vWorldDirection);
        float rotationCos = cos(hdriRotation);
        float rotationSin = sin(hdriRotation);
        direction.xz = mat2(rotationCos, -rotationSin, rotationSin, rotationCos) * direction.xz;

        vec2 sampleUV = equirectUv(direction);
        float scale = clamp(hdriScale, 0.5, 2.5);
        sampleUV = (sampleUV - 0.5) / scale + 0.5;
        sampleUV.x = fract(sampleUV.x);
        sampleUV.y = clamp(sampleUV.y, 0.0, 1.0);

        gl_FragColor = texture2D(hdriMap, sampleUV);
        gl_FragColor.rgb *= hdriIntensity;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    uniforms: {
      hdriIntensity: { value: settings.hdriIntensity },
      hdriMap: { value: null },
      hdriRotation: { value: THREE.MathUtils.degToRad(settings.hdriRotation) },
      hdriScale: { value: settings.hdriScale },
    },
    vertexShader: `
      varying vec3 vWorldDirection;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldDirection = normalize(worldPosition.xyz - cameraPosition);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  });

  material.toneMapped = true;
  return material as HdriDomeMaterial;
}

function applyViewerEnvironment({
  backgroundMode,
  backdropMaterial,
  hdriBackgroundMap,
  defaultEnvironmentMap,
  hdriDome,
  hdriDomeMaterial,
  hdriEnvironmentMap,
  scene,
  viewerSettings,
}: {
  backgroundMode: BackgroundMode;
  backdropMaterial: THREE.MeshBasicMaterial | null;
  defaultEnvironmentMap: THREE.Texture | null;
  hdriBackgroundMap: THREE.Texture | null;
  hdriDome: THREE.Mesh<THREE.SphereGeometry, HdriDomeMaterial> | null;
  hdriDomeMaterial: HdriDomeMaterial | null;
  hdriEnvironmentMap: THREE.Texture | null;
  scene: THREE.Scene;
  viewerSettings: ViewerSettings;
}) {
  const hasHdri = backgroundMode === "hdri" && Boolean(hdriBackgroundMap && hdriEnvironmentMap);
  const environmentColor = new THREE.Color(viewerSettings.environmentColor);
  const activeEnvironmentColor = hasHdri ? new THREE.Color("#ffffff") : environmentColor;

  scene.environment = hasHdri ? hdriEnvironmentMap : defaultEnvironmentMap;
  scene.environmentIntensity = hasHdri
    ? viewerSettings.hdriIntensity
    : viewerSettings.environmentIntensity;
  scene.environmentRotation.y = THREE.MathUtils.degToRad(
    hasHdri ? viewerSettings.hdriRotation : viewerSettings.environmentRotation,
  );

  if (hasHdri) {
    scene.background = null;
    scene.backgroundIntensity = 1;
    scene.backgroundRotation.y = 0;
    scene.backgroundBlurriness = 0;
    scene.fog = null;
  } else {
    scene.background = getTintedColor("#f4f1ea", viewerSettings.environmentColor, 0.62);
    scene.backgroundIntensity = 1;
    scene.backgroundRotation.y = 0;
    scene.backgroundBlurriness = 0;

    if (!(scene.fog instanceof THREE.Fog)) {
      scene.fog = new THREE.Fog(
        getTintedColor("#c3c7c7", viewerSettings.environmentColor, 0.38),
        7.5,
        16,
      );
    } else {
      scene.fog.color.copy(getTintedColor("#c3c7c7", viewerSettings.environmentColor, 0.38));
    }
  }

  if (hdriDome) {
    hdriDome.visible = hasHdri;
    hdriDome.scale.setScalar(32 * viewerSettings.hdriScale);
  }

  if (hdriDomeMaterial) {
    hdriDomeMaterial.uniforms.hdriMap.value = hasHdri ? hdriBackgroundMap : null;
    hdriDomeMaterial.uniforms.hdriIntensity.value = Math.max(0.05, viewerSettings.hdriIntensity);
    hdriDomeMaterial.uniforms.hdriRotation.value = THREE.MathUtils.degToRad(
      viewerSettings.hdriRotation,
    );
    hdriDomeMaterial.uniforms.hdriScale.value = viewerSettings.hdriScale;
  }

  if (backdropMaterial) {
    backdropMaterial.color.copy(getTintedColor("#ffffff", viewerSettings.environmentColor, 0.36));
    backdropMaterial.opacity = hasHdri ? 0 : viewerSettings.backdropGlow;
  }

  return activeEnvironmentColor;
}

function prepareModelForViewport(model: THREE.Object3D, anisotropy = 1) {
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;

    if (!mesh.isMesh) {
      return;
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.renderOrder = modelRenderOrder;

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => tuneStudioMaterial(material, anisotropy));
    } else if (mesh.material) {
      tuneStudioMaterial(mesh.material, anisotropy);
    }
  });
}

function prepareViewportModel(model: THREE.Object3D, anisotropy = 1) {
  prepareModelForViewport(model, anisotropy);

  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z) || 1;
  const viewportFit = 2.35;
  const scale = viewportFit / maxAxis;
  const group = new THREE.Group();

  model.position.sub(center);
  group.add(model);
  group.scale.setScalar(scale);
  group.position.y = modelGroundY - (bikeSourceGroundY - center.y) * scale;

  const look = new THREE.Vector3(startupCameraX, group.position.y + startupLookHeightOffset, 0);
  const camera = new THREE.Vector3(
    startupCameraX,
    group.position.y + startupCameraHeightOffset,
    startupCameraDistance,
  );

  return { camera, group, look, sourceCenter: center };
}

function prepareAttachedModel(
  model: THREE.Object3D,
  sourceCenter: THREE.Vector3,
  asset: ModelAsset,
  anisotropy = 1,
) {
  prepareModelForViewport(model, anisotropy);
  model.position.sub(sourceCenter);

  if (typeof asset.sourceGroundY === "number") {
    model.position.y += bikeSourceGroundY - asset.sourceGroundY;
  }

  return model;
}

function getModelAssetUrl(asset: ModelAsset) {
  return publicAsset(asset.path);
}

function getModelCacheKey(asset: ModelAsset, sourceCenter: THREE.Vector3) {
  const centerKey = sourceCenter
    .toArray()
    .map((value) => value.toFixed(4))
    .join(":");

  return `${asset.id}:${centerKey}`;
}

function getPreloadAddonAssets() {
  const assets = new Map<ModelAssetId, ModelAsset>();

  Object.values(componentAddonAssets).forEach((componentAssets) => {
    Object.values(componentAssets ?? {}).forEach((asset) => {
      if (asset.preload) {
        assets.set(asset.id, asset);
      }
    });
  });

  return Array.from(assets.values());
}

function getFrameSizeMorphValue(sizeId: string) {
  return frameSizeMorphValues[sizeId] ?? frameSizeMorphValues.S;
}

function getHandlebarSizeMorphValue(optionId: string) {
  return handlebarSizeMorphValues[optionId] ?? handlebarSizeMorphValues["handlebar-38-80"];
}

function getSeatAdjustmentMorphValue(optionId: string) {
  return seatAdjustmentMorphValues[optionId] ?? seatAdjustmentMorphValues["seat-low"];
}

function getObjectNameTrail(object: THREE.Object3D) {
  const names = [object.name];
  let parent = object.parent;

  while (parent) {
    names.push(parent.name);
    parent = parent.parent;
  }

  const mesh = object as THREE.Mesh;
  names.push(mesh.geometry?.name ?? "");

  return names.join(" ").toLowerCase();
}

function isBodyFrameMesh(mesh: THREE.Mesh) {
  if (typeof mesh.morphTargetDictionary?.Frame === "number") {
    return true;
  }

  const nameTrail = getObjectNameTrail(mesh);
  return (
    nameTrail.includes("body-frame") ||
    nameTrail.includes("body frame") ||
    nameTrail.includes("body_frame") ||
    nameTrail.includes("body-mesh") ||
    nameTrail.includes("body mesh") ||
    nameTrail.includes("cycle_combined") ||
    nameTrail.includes("cycle combined")
  );
}

function getPrimaryMorphTargetIndex(mesh: THREE.Mesh) {
  const frameIndex = mesh.morphTargetDictionary?.Frame;

  if (typeof frameIndex === "number") {
    return frameIndex;
  }

  const namedIndex = mesh.morphTargetDictionary?.["Key 1"];

  if (typeof namedIndex === "number") {
    return namedIndex;
  }

  const firstIndex = Object.values(mesh.morphTargetDictionary ?? {})[0];
  return typeof firstIndex === "number" ? firstIndex : 0;
}

function getNamedMorphTargetIndex(mesh: THREE.Mesh, targetName: string) {
  const targetIndex = mesh.morphTargetDictionary?.[targetName];
  return typeof targetIndex === "number" ? targetIndex : -1;
}

function collectFrameMorphMeshes(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;

    if (!mesh.isMesh || !mesh.morphTargetInfluences?.length || !isBodyFrameMesh(mesh)) {
      return;
    }

    meshes.push(mesh);
  });

  return meshes;
}

function cloneMaterialForPaintEditing(material: THREE.Material) {
  const clonedMaterial = material.clone();
  clonedMaterial.needsUpdate = true;
  return clonedMaterial;
}

function prepareBodyFramePaintMaterials(root: THREE.Object3D) {
  const materials: BodyFramePaintMaterial[] = [];

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;

    if (!mesh.isMesh || !mesh.material) {
      return;
    }

    const sourceMaterial = mesh.material;

    if (!sourceMaterial) {
      return;
    }

    const hasTargetMaterial = Array.isArray(sourceMaterial)
      ? sourceMaterial.some((material) => material.name === bodyFramePaintMaterialName)
      : sourceMaterial.name === bodyFramePaintMaterialName;

    if (!hasTargetMaterial) {
      return;
    }

    const clonedMaterial = Array.isArray(sourceMaterial)
      ? sourceMaterial.map((material) =>
          material.name === bodyFramePaintMaterialName
            ? cloneMaterialForPaintEditing(material)
            : material,
        )
      : cloneMaterialForPaintEditing(sourceMaterial);

    mesh.material = clonedMaterial;

    const meshMaterials = Array.isArray(clonedMaterial) ? clonedMaterial : [clonedMaterial];

    meshMaterials.forEach((material) => {
      const pbrMaterial = material as THREE.MeshStandardMaterial;

      if (pbrMaterial.name !== bodyFramePaintMaterialName || !("map" in pbrMaterial)) {
        return;
      }

      materials.push({
        defaultMap: pbrMaterial.map ?? null,
        material: pbrMaterial,
      });
    });
  });

  return materials;
}

function configureBodyFrameDiffuseTexture(texture: THREE.Texture, anisotropy: number) {
  texture.anisotropy = Math.min(anisotropy, 8);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.needsUpdate = true;
}

function applyBodyFramePaintTexture(
  materials: BodyFramePaintMaterial[],
  paintId: string,
  textures: Partial<Record<string, THREE.Texture>>,
) {
  const diffuseMapPath = bodyFrameDiffuseMaps[paintId];
  const diffuseMap = diffuseMapPath ? textures[paintId] : null;

  if (diffuseMapPath && !diffuseMap) {
    return false;
  }

  materials.forEach((paintMaterial) => {
    const { material } = paintMaterial;
    material.map = diffuseMap ?? paintMaterial.defaultMap;
    material.needsUpdate = true;
  });

  return materials.length > 0;
}

function collectHandleMorphMeshes(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;

    if (
      !mesh.isMesh ||
      !mesh.morphTargetInfluences?.length ||
      getNamedMorphTargetIndex(mesh, "Handle") < 0
    ) {
      return;
    }

    meshes.push(mesh);
  });

  return meshes;
}

function collectSeatMorphMeshes(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;

    if (
      !mesh.isMesh ||
      !mesh.morphTargetInfluences?.length ||
      getNamedMorphTargetIndex(mesh, "Seat") < 0
    ) {
      return;
    }

    meshes.push(mesh);
  });

  return meshes;
}

function applyFrameSizeMorph(meshes: THREE.Mesh[], sizeId: string) {
  const value = getFrameSizeMorphValue(sizeId);

  meshes.forEach((mesh) => {
    const influences = mesh.morphTargetInfluences;

    if (!influences?.length) {
      return;
    }

    const targetIndex = getPrimaryMorphTargetIndex(mesh);

    if (targetIndex >= 0 && targetIndex < influences.length) {
      influences[targetIndex] = value;
    }
  });
}

function applyHandlebarSizeMorph(meshes: THREE.Mesh[], optionId: string) {
  const value = getHandlebarSizeMorphValue(optionId);

  meshes.forEach((mesh) => {
    const influences = mesh.morphTargetInfluences;

    if (!influences?.length) {
      return;
    }

    const targetIndex = getNamedMorphTargetIndex(mesh, "Handle");

    if (targetIndex >= 0 && targetIndex < influences.length) {
      influences[targetIndex] = value;
    }
  });
}

function applySeatAdjustmentMorph(meshes: THREE.Mesh[], optionId: string) {
  const value = getSeatAdjustmentMorphValue(optionId);

  meshes.forEach((mesh) => {
    const influences = mesh.morphTargetInfluences;

    if (!influences?.length) {
      return;
    }

    const targetIndex = getNamedMorphTargetIndex(mesh, "Seat");

    if (targetIndex >= 0 && targetIndex < influences.length) {
      influences[targetIndex] = value;
    }
  });
}

function createGroundFadeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 768;
  const context = canvas.getContext("2d");

  if (context) {
    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const radialFade = context.createRadialGradient(384, 430, 28, 384, 430, 265);
    radialFade.addColorStop(0, "rgba(255, 255, 255, 1)");
    radialFade.addColorStop(0.28, "rgba(255, 255, 255, 0.96)");
    radialFade.addColorStop(0.48, "rgba(255, 255, 255, 0.5)");
    radialFade.addColorStop(0.64, "rgba(255, 255, 255, 0.12)");
    radialFade.addColorStop(0.8, "rgba(255, 255, 255, 0.025)");
    radialFade.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = radialFade;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const rearFade = context.createLinearGradient(0, 0, 0, canvas.height);
    rearFade.addColorStop(0, "rgba(0, 0, 0, 1)");
    rearFade.addColorStop(0.18, "rgba(0, 0, 0, 0.82)");
    rearFade.addColorStop(0.36, "rgba(0, 0, 0, 0.24)");
    rearFade.addColorStop(0.56, "rgba(0, 0, 0, 0)");
    rearFade.addColorStop(0.76, "rgba(0, 0, 0, 0.24)");
    rearFade.addColorStop(1, "rgba(0, 0, 0, 0.9)");
    context.globalCompositeOperation = "destination-out";
    context.fillStyle = rearFade;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = "source-over";
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

function createStudioGradientTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 640;
  const context = canvas.getContext("2d");

  if (context) {
    const vertical = context.createLinearGradient(0, 0, 0, canvas.height);
    vertical.addColorStop(0, "#d9d7d2");
    vertical.addColorStop(0.44, "#c8cdcd");
    vertical.addColorStop(0.74, "#b9c0bf");
    vertical.addColorStop(1, "#9fa8a8");
    context.fillStyle = vertical;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const centerGlow = context.createRadialGradient(
      canvas.width * 0.5,
      canvas.height * 0.52,
      20,
      canvas.width * 0.5,
      canvas.height * 0.52,
      canvas.width * 0.52,
    );
    centerGlow.addColorStop(0, "rgba(255, 255, 255, 0.32)");
    centerGlow.addColorStop(0.45, "rgba(47, 131, 200, 0.08)");
    centerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = centerGlow;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const edgeShade = context.createLinearGradient(0, 0, canvas.width, 0);
    edgeShade.addColorStop(0, "rgba(16, 24, 33, 0.2)");
    edgeShade.addColorStop(0.32, "rgba(0, 0, 0, 0)");
    edgeShade.addColorStop(0.68, "rgba(0, 0, 0, 0)");
    edgeShade.addColorStop(1, "rgba(16, 24, 33, 0.24)");
    context.fillStyle = edgeShade;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createFloorGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");

  if (context) {
    const glow = context.createRadialGradient(256, 256, 16, 256, 256, 248);
    glow.addColorStop(0, "rgba(255, 255, 245, 0.28)");
    glow.addColorStop(0.32, "rgba(47, 131, 200, 0.1)");
    glow.addColorStop(0.7, "rgba(47, 131, 200, 0.035)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createContactAoTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 512;
  const context = canvas.getContext("2d");

  if (context) {
    const drawSoftEllipse = (x: number, y: number, radiusX: number, radiusY: number, strength: number) => {
      context.save();
      context.translate(x, y);
      context.rotate(-0.05);
      context.scale(radiusX, radiusY);
      const shadow = context.createRadialGradient(0, 0, 0.02, 0, 0, 1);
      shadow.addColorStop(0, `rgba(255, 255, 255, ${strength})`);
      shadow.addColorStop(0.35, `rgba(255, 255, 255, ${strength * 0.48})`);
      shadow.addColorStop(0.72, `rgba(255, 255, 255, ${strength * 0.12})`);
      shadow.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.fillStyle = shadow;
      context.fillRect(-1, -1, 2, 2);
      context.restore();
    };

    drawSoftEllipse(384, 282, 345, 105, 0.42);
    drawSoftEllipse(220, 292, 138, 42, 0.34);
    drawSoftEllipse(548, 292, 146, 42, 0.34);
    drawSoftEllipse(382, 292, 118, 38, 0.22);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildStudioSurfaces(): StudioSurfaces {
  const group = new THREE.Group();
  const groundFadeTexture = createGroundFadeTexture();
  const backdropTexture = createStudioGradientTexture();
  const floorGlowTexture = createFloorGlowTexture();
  const contactAoTexture = createContactAoTexture();

  const floorMaterial = new THREE.MeshStandardMaterial({
    alphaMap: groundFadeTexture,
    color: "#b9bfbd",
    depthWrite: false,
    metalness: 0,
    opacity: 0.68,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
    roughness: 0.94,
    transparent: true,
  });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 30),
    floorMaterial,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = studioFloorY;
  floor.renderOrder = 0;
  floor.receiveShadow = true;
  group.add(floor);

  const contactAoMaterial = new THREE.MeshBasicMaterial({
    alphaMap: contactAoTexture,
    color: "#000000",
    depthTest: true,
    depthWrite: false,
    opacity: defaultViewerSettings.aoIntensity,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
    transparent: true,
  });
  const contactAo = new THREE.Mesh(
    new THREE.PlaneGeometry(6.15, 2.75),
    contactAoMaterial,
  );
  contactAo.rotation.x = -Math.PI / 2;
  contactAo.position.set(0, studioFloorY + 0.003, 0.16);
  contactAo.renderOrder = 1;
  group.add(contactAo);

  const floorGlowMaterial = new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    map: floorGlowTexture,
    opacity: defaultViewerSettings.floorGlow,
    polygonOffset: true,
    polygonOffsetFactor: 3,
    polygonOffsetUnits: 3,
    transparent: true,
  });
  const floorGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(8.4, 3.7),
    floorGlowMaterial,
  );
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.set(0, studioFloorY + 0.005, 0.2);
  floorGlow.renderOrder = 2;
  group.add(floorGlow);

  const stageRingRadius = 1.72;
  const stageRingMaterial = new THREE.MeshBasicMaterial({
    color: "#c7a550",
    depthTest: true,
    depthWrite: false,
    opacity: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: 4,
    polygonOffsetUnits: 4,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const stageRing = new THREE.Mesh(
    new THREE.RingGeometry(stageRingRadius, stageRingRadius + 0.028, 192),
    stageRingMaterial,
  );
  stageRing.rotation.x = -Math.PI / 2;
  stageRing.position.y = studioFloorY + 0.007;
  stageRing.renderOrder = 3;
  group.add(stageRing);

  const stageRingHighlight = new THREE.Mesh(
    new THREE.RingGeometry(stageRingRadius - 0.004, stageRingRadius + 0.05, 96, 1, 0, Math.PI * 0.34),
    new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: "#f2d982",
      depthTest: true,
      depthWrite: false,
      opacity: 0.13,
      polygonOffset: true,
      polygonOffsetFactor: 5,
      polygonOffsetUnits: 5,
      side: THREE.DoubleSide,
      transparent: true,
    }),
  );
  stageRingHighlight.rotation.x = -Math.PI / 2;
  stageRingHighlight.position.y = studioFloorY + 0.009;
  stageRingHighlight.renderOrder = 4;
  group.add(stageRingHighlight);

  const backdropMaterial = new THREE.MeshBasicMaterial({
    map: backdropTexture,
    opacity: defaultViewerSettings.backdropGlow,
    toneMapped: false,
    transparent: true,
  });
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 10.5),
    backdropMaterial,
  );
  backdrop.position.set(0, 2.7, -5.6);
  group.add(backdrop);

  return {
    backdropMaterial,
    contactAo,
    contactAoMaterial,
    floor,
    floorGlow,
    floorGlowMaterial,
    floorMaterial,
    group,
    stageRing,
    stageRingMaterial,
    stageRingHighlight,
  };
}

function formatStudioValue(value: number, suffix = "") {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2)}${suffix}`;
}

function StudioRange({
  label,
  max,
  min,
  onChange,
  step,
  suffix = "",
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  suffix?: string;
  value: number;
}) {
  return (
    <label className="studio-control">
      <span>
        <em>{label}</em>
        <strong>{formatStudioValue(value, suffix)}</strong>
      </span>
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}

function StudioToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="studio-toggle">
      <span>{label}</span>
      <input
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        type="checkbox"
      />
    </label>
  );
}

function StudioColorPalette({
  active,
  onChange,
  value,
}: {
  active: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const colorValue = /^#[0-9a-f]{6}$/i.test(value) ? value : defaultViewerSettings.environmentColor;

  return (
    <div className={active ? "studio-color-control active" : "studio-color-control"}>
      <span>
        <em>Environment Color</em>
        <strong>{colorValue.toUpperCase()}</strong>
      </span>
      <div className="studio-background-presets" aria-label="Background color presets">
        {backgroundColorPresets.map((preset) => {
          const presetColor = preset.color.toUpperCase();
          const isActive = active && colorValue.toUpperCase() === presetColor;

          return (
            <button
              aria-label={`${preset.label} background color`}
              aria-pressed={isActive}
              className={isActive ? "studio-background-preset active" : "studio-background-preset"}
              key={preset.id}
              onClick={() => onChange(presetColor)}
              title={preset.label}
              type="button"
            >
              <span style={{ backgroundColor: preset.color }} />
              <em>{preset.label}</em>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BikeScene({
  backgroundMode,
  config,
  focus,
  hdriAsset,
  introPhase,
  onIntroComplete,
  onSceneReady,
  showHotspots,
  viewerSettings,
}: {
  backgroundMode: BackgroundMode;
  config: ConfigState;
  focus: string;
  hdriAsset: HdriAsset | null;
  introPhase: IntroPhase;
  onIntroComplete: () => void;
  onSceneReady: () => void;
  showHotspots: boolean;
  viewerSettings: ViewerSettings;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const defaultEnvironmentMapRef = useRef<THREE.Texture | null>(null);
  const hdriBackgroundMapRef = useRef<THREE.Texture | null>(null);
  const hdriEnvironmentMapRef = useRef<THREE.Texture | null>(null);
  const hdriDomeRef = useRef<THREE.Mesh<THREE.SphereGeometry, HdriDomeMaterial> | null>(null);
  const hdriDomeMaterialRef = useRef<HdriDomeMaterial | null>(null);
  const bikeRef = useRef<THREE.Group | null>(null);
  const frameMorphMeshesRef = useRef<THREE.Mesh[]>([]);
  const handleMorphMeshesRef = useRef<THREE.Mesh[]>([]);
  const seatMorphMeshesRef = useRef<THREE.Mesh[]>([]);
  const bodyFramePaintMaterialsRef = useRef<BodyFramePaintMaterial[]>([]);
  const bodyFrameDiffuseTexturesRef = useRef<Partial<Record<string, THREE.Texture>>>({});
  const activeAddonRefs = useRef(new Map<ComponentKey, THREE.Object3D>());
  const addonModelCacheRef = useRef(new Map<string, THREE.Object3D>());
  const addonModelLoadCacheRef = useRef(new Map<string, Promise<THREE.Object3D>>());
  const addonRequestCountersRef = useRef(new Map<ComponentKey, number>());
  const hotspotBoundsRef = useRef<THREE.Box3 | null>(null);
  const hotspotElementsRef = useRef(new Map<string, HTMLDivElement>());
  const hotspotProjectionPointRef = useRef(new THREE.Vector3());
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const paintRef = useRef(config.paint);
  const sizeRef = useRef(config.size);
  const handlebarSizeRef = useRef(config.components.cockpit);
  const seatAdjustmentRef = useRef(config.components.seatAdjustment);
  const componentOptionsRef = useRef(config.components);
  const viewerSettingsRef = useRef(viewerSettings);
  const addonLoaderRef = useRef<GLTFLoader | null>(null);
  const anisotropyRef = useRef(1);
  const assetSourceCenterRef = useRef<THREE.Vector3 | null>(null);
  const syncAddonModelRef = useRef<(componentKey: ComponentKey, optionId: string) => void>(
    () => undefined,
  );
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const ambientLightRef = useRef<THREE.HemisphereLight | null>(null);
  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
  const fillLightRef = useRef<THREE.PointLight | null>(null);
  const rimLightRef = useRef<THREE.DirectionalLight | null>(null);
  const modelMaterialsRef = useRef<THREE.Material[]>([]);
  const floorMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const floorGlowMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const contactAoMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const backdropMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const stageRingMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const stageRingHighlightMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const assetCameraRef = useRef<{ camera: THREE.Vector3; look: THREE.Vector3 } | null>(null);
  const modelLoadedRef = useRef(false);
  const fallbackRef = useRef(false);
  const targetCameraRef = useRef(
    new THREE.Vector3(startupCameraX, modelGroundY + startupCameraHeightOffset, startupCameraDistance),
  );
  const targetLookRef = useRef(
    new THREE.Vector3(startupCameraX, modelGroundY + startupLookHeightOffset, 0),
  );
  const lookRef = useRef(new THREE.Vector3(startupCameraX, modelGroundY + startupLookHeightOffset, 0));
  const introPhaseRef = useRef(introPhase);
  const introStartedRef = useRef(false);
  const introCompletedRef = useRef(false);
  const introStartTimeRef = useRef(0);
  const introBaseCameraRef = useRef<THREE.Vector3 | null>(null);
  const introBaseLookRef = useRef<THREE.Vector3 | null>(null);
  const onIntroCompleteRef = useRef(onIntroComplete);
  const onSceneReadyRef = useRef(onSceneReady);

  const refreshHotspotBounds = () => {
    const bike = bikeRef.current;

    if (!bike) {
      hotspotBoundsRef.current = null;
      return;
    }

    const bounds = new THREE.Box3().setFromObject(bike);
    const size = bounds.getSize(new THREE.Vector3());
    hotspotBoundsRef.current = size.lengthSq() > 0 ? bounds : null;
  };

  useEffect(() => {
    introPhaseRef.current = introPhase;

    if (introPhase === "loading") {
      introStartedRef.current = false;
      introCompletedRef.current = false;
      introBaseCameraRef.current = null;
      introBaseLookRef.current = null;
    }
  }, [introPhase]);

  useEffect(() => {
    onIntroCompleteRef.current = onIntroComplete;
  }, [onIntroComplete]);

  useEffect(() => {
    onSceneReadyRef.current = onSceneReady;
  }, [onSceneReady]);

  useEffect(() => {
    if (!showHotspots) {
      const frame = window.requestAnimationFrame(() => setActiveHotspotId(null));

      return () => window.cancelAnimationFrame(frame);
    }

    return undefined;
  }, [showHotspots]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const addonModelCache = addonModelCacheRef.current;
    const addonModelLoadCache = addonModelLoadCacheRef.current;
    const addonRequestCounters = addonRequestCountersRef.current;
    const hotspotElements = hotspotElementsRef.current;
    const scene = new THREE.Scene();
    scene.background = getTintedColor("#f4f1ea", viewerSettingsRef.current.environmentColor, 0.62);
    scene.fog = new THREE.Fog(
      getTintedColor("#c3c7c7", viewerSettingsRef.current.environmentColor, 0.38),
      7.5,
      16,
    );
    sceneRef.current = scene;

    const initialSettings = viewerSettingsRef.current;
    const camera = new THREE.PerspectiveCamera(initialSettings.cameraFov, 1, 0.1, 100);
    camera.position.set(startupCameraX, modelGroundY + startupCameraHeightOffset, startupCameraDistance);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    rendererRef.current = renderer;
    anisotropyRef.current = renderer.capabilities.getMaxAnisotropy();
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = toneMappingValues[initialSettings.toneMapping];
    renderer.toneMappingExposure = initialSettings.exposure;
    renderer.setPixelRatio(initialSettings.pixelRatio);
    renderer.shadowMap.enabled = initialSettings.shadows;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const studioEnvironment = new RoomEnvironment();
    const environmentMap = pmremGenerator.fromScene(studioEnvironment, 0.04).texture;
    defaultEnvironmentMapRef.current = environmentMap;
    scene.environment = environmentMap;
    scene.environmentIntensity = initialSettings.environmentIntensity;
    scene.environmentRotation.y = THREE.MathUtils.degToRad(initialSettings.environmentRotation);
    studioEnvironment.dispose();
    pmremGenerator.dispose();

    const hdriDomeMaterial = createHdriDomeMaterial(initialSettings);
    const hdriDome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 48),
      hdriDomeMaterial,
    );
    hdriDome.renderOrder = -100;
    hdriDome.visible = false;
    hdriDome.scale.setScalar(32 * initialSettings.hdriScale);
    hdriDomeRef.current = hdriDome;
    hdriDomeMaterialRef.current = hdriDomeMaterial;
    scene.add(hdriDome);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.maxDistance = 12;
    controls.minDistance = 1.2;
    controls.panSpeed = 0.55;
    controls.rotateSpeed = 0.65;
    controls.screenSpacePanning = true;
    controls.target.copy(lookRef.current);
    controls.update();
    controlsRef.current = controls;

    const ambient = new THREE.HemisphereLight("#f7f1e4", "#151615", initialSettings.ambientIntensity);
    ambientLightRef.current = ambient;
    scene.add(ambient);

    const key = new THREE.DirectionalLight("#ffffff", initialSettings.keyIntensity);
    key.position.set(3.4, 5.2, 3.6);
    key.castShadow = initialSettings.shadows;
    key.shadow.bias = -0.00008;
    key.shadow.blurSamples = initialSettings.vsmBlurSamples;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.normalBias = 0.025;
    const keyShadowCamera = key.shadow.camera as THREE.OrthographicCamera;
    keyShadowCamera.left = -5;
    keyShadowCamera.right = 5;
    keyShadowCamera.top = 5;
    keyShadowCamera.bottom = -5;
    keyShadowCamera.near = 0.4;
    keyShadowCamera.far = 18;
    keyShadowCamera.updateProjectionMatrix();
    keyLightRef.current = key;
    scene.add(key);

    const rim = new THREE.DirectionalLight("#f1413c", initialSettings.rimIntensity);
    rim.position.set(-4, 2.4, -3);
    rimLightRef.current = rim;
    scene.add(rim);

    const fill = new THREE.PointLight("#f7f1e4", initialSettings.fillIntensity, 7);
    fill.position.set(-1.5, 1.8, 2.8);
    fillLightRef.current = fill;
    scene.add(fill);

    const studioSurfaces = buildStudioSurfaces();
    floorMaterialRef.current = studioSurfaces.floorMaterial;
    floorGlowMaterialRef.current = studioSurfaces.floorGlowMaterial;
    contactAoMaterialRef.current = studioSurfaces.contactAoMaterial;
    backdropMaterialRef.current = studioSurfaces.backdropMaterial;
    stageRingMaterialRef.current = studioSurfaces.stageRingMaterial;
    stageRingHighlightMaterialRef.current = studioSurfaces.stageRingHighlight.material;
    scene.add(studioSurfaces.group);

    const refreshModelMaterials = () => {
      modelMaterialsRef.current = bikeRef.current ? collectModelMaterials(bikeRef.current) : [];
      applyModelAmbientOcclusion(modelMaterialsRef.current, viewerSettingsRef.current.modelAoIntensity);
    };

    const applyCurrentFramePaintTexture = () => {
      const didApply = applyBodyFramePaintTexture(
        bodyFramePaintMaterialsRef.current,
        paintRef.current,
        bodyFrameDiffuseTexturesRef.current,
      );

      if (didApply) {
        applyModelAmbientOcclusion(modelMaterialsRef.current, viewerSettingsRef.current.modelAoIntensity);
      }
    };

    const detachActiveAddonModels = () => {
      activeAddonRefs.current.forEach((addon) => {
        addon.parent?.remove(addon);
      });
      activeAddonRefs.current.clear();
    };

    const replaceBike = (nextBike: THREE.Group) => {
      if (bikeRef.current) {
        detachActiveAddonModels();
        scene.remove(bikeRef.current);
        disposeObject(bikeRef.current);
      }

      bikeRef.current = nextBike;
      refreshModelMaterials();
      scene.add(nextBike);
      refreshHotspotBounds();
    };

    let cancelled = false;
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(publicAsset("draco/gltf/"));

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    addonLoaderRef.current = loader;
    const textureLoader = new THREE.TextureLoader();
    Object.entries(bodyFrameDiffuseMaps).forEach(([paintId, texturePath]) => {
      textureLoader.load(publicAsset(texturePath), (texture) => {
        if (cancelled) {
          texture.dispose();
          return;
        }

        configureBodyFrameDiffuseTexture(texture, anisotropyRef.current);
        bodyFrameDiffuseTexturesRef.current[paintId] = texture;
        applyCurrentFramePaintTexture();
      });
    });
    let preloadTimer: number | undefined;

    const removeAddonModel = (componentKey: ComponentKey) => {
      const addon = activeAddonRefs.current.get(componentKey);

      if (!addon) {
        return;
      }

      addon.parent?.remove(addon);
      activeAddonRefs.current.delete(componentKey);
      refreshModelMaterials();
      refreshHotspotBounds();
    };

    const loadCachedAddonModel = (
      asset: ModelAsset,
      sourceCenter: THREE.Vector3,
    ): Promise<THREE.Object3D> => {
      const cacheKey = getModelCacheKey(asset, sourceCenter);
      const cachedModel = addonModelCacheRef.current.get(cacheKey);

      if (cachedModel) {
        return Promise.resolve(cachedModel);
      }

      const pendingModel = addonModelLoadCacheRef.current.get(cacheKey);

      if (pendingModel) {
        return pendingModel;
      }

      if (!addonLoaderRef.current) {
        return Promise.reject(new Error("3D add-on loader is not ready."));
      }

      const modelPromise = new Promise<THREE.Object3D>((resolve, reject) => {
        addonLoaderRef.current?.load(
          getModelAssetUrl(asset),
          (gltf) => {
            if (cancelled) {
              disposeObject(gltf.scene);
              reject(new Error("3D add-on load was cancelled."));
              return;
            }

            const addon = prepareAttachedModel(gltf.scene, sourceCenter, asset, anisotropyRef.current);
            addon.name = `addon-${asset.id}`;
            addonModelCacheRef.current.set(cacheKey, addon);
            resolve(addon);
          },
          undefined,
          reject,
        );
      }).finally(() => {
        addonModelLoadCacheRef.current.delete(cacheKey);
      });

      addonModelLoadCacheRef.current.set(cacheKey, modelPromise);
      return modelPromise;
    };

    const syncAddonModel = (componentKey: ComponentKey, optionId: string) => {
      const asset = componentAddonAssets[componentKey]?.[optionId];
      const requestId = (addonRequestCountersRef.current.get(componentKey) ?? 0) + 1;
      addonRequestCountersRef.current.set(componentKey, requestId);
      removeAddonModel(componentKey);

      if (!asset || !bikeRef.current || !assetSourceCenterRef.current) {
        return;
      }

      loadCachedAddonModel(asset, assetSourceCenterRef.current.clone())
        .then((addon) => {
          if (
            cancelled ||
            requestId !== addonRequestCountersRef.current.get(componentKey) ||
            componentOptionsRef.current[componentKey] !== optionId ||
            !bikeRef.current
          ) {
            return;
          }

          activeAddonRefs.current.set(componentKey, addon);
          bikeRef.current.add(addon);
          refreshModelMaterials();
          refreshHotspotBounds();
        })
        .catch(() => {
          if (requestId === addonRequestCountersRef.current.get(componentKey)) {
            activeAddonRefs.current.delete(componentKey);
          }
        });
    };

    const preloadAddonModels = () => {
      const sourceCenter = assetSourceCenterRef.current;

      if (!sourceCenter) {
        return;
      }

      getPreloadAddonAssets().forEach((asset) => {
        loadCachedAddonModel(asset, sourceCenter.clone()).catch(() => undefined);
      });
    };

    syncAddonModelRef.current = syncAddonModel;

    loader.load(
      bikeModelUrl,
      (gltf) => {
        if (cancelled) {
          return;
        }

        const { camera: assetCamera, group, look, sourceCenter } = prepareViewportModel(
          gltf.scene,
          anisotropyRef.current,
        );
        modelLoadedRef.current = true;
        fallbackRef.current = false;
        assetSourceCenterRef.current = sourceCenter;
        assetCameraRef.current = { camera: assetCamera, look };
        targetCameraRef.current.copy(assetCamera);
        targetLookRef.current.copy(look);
        lookRef.current.copy(look);
        camera.position.copy(assetCamera);
        controls.target.copy(look);
        controls.update();
        frameMorphMeshesRef.current = collectFrameMorphMeshes(group);
        bodyFramePaintMaterialsRef.current = prepareBodyFramePaintMaterials(group);
        handleMorphMeshesRef.current = collectHandleMorphMeshes(group);
        seatMorphMeshesRef.current = collectSeatMorphMeshes(group);
        applyFrameSizeMorph(frameMorphMeshesRef.current, sizeRef.current);
        applyHandlebarSizeMorph(handleMorphMeshesRef.current, handlebarSizeRef.current);
        applySeatAdjustmentMorph(seatMorphMeshesRef.current, seatAdjustmentRef.current);
        applyBodyFramePaintTexture(
          bodyFramePaintMaterialsRef.current,
          paintRef.current,
          bodyFrameDiffuseTexturesRef.current,
        );
        replaceBike(group);
        syncAddonModel("groupset", componentOptionsRef.current.groupset);
        syncAddonModel("pedals", componentOptionsRef.current.pedals);
        syncAddonModel("storage", componentOptionsRef.current.storage);
        syncAddonModel("wheel", componentOptionsRef.current.wheel);
        preloadTimer = window.setTimeout(preloadAddonModels, 450);
        onSceneReadyRef.current();
      },
      undefined,
      () => {
        if (cancelled) {
          return;
        }

        fallbackRef.current = true;
        frameMorphMeshesRef.current = [];
        bodyFramePaintMaterialsRef.current = [];
        handleMorphMeshesRef.current = [];
        seatMorphMeshesRef.current = [];
        assetSourceCenterRef.current = null;
        replaceBike(buildBike(defaultConfig, "default"));
        onSceneReadyRef.current();
      },
    );

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      renderer.setSize(clientWidth, clientHeight);
      camera.fov = clientWidth < 560 ? Math.max(viewerSettingsRef.current.cameraFov, 40) : viewerSettingsRef.current.cameraFov;
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      camera.updateProjectionMatrix();
      controls.update();
    };

    window.addEventListener("resize", resize);
    resize();

    const clock = new THREE.Clock();
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const activeCamera = cameraRef.current;
      const elapsed = clock.getElapsedTime();

      if (introPhaseRef.current === "cinematic" && activeCamera) {
        if (!introStartedRef.current) {
          introStartedRef.current = true;
          introStartTimeRef.current = elapsed;
          introBaseCameraRef.current = targetCameraRef.current.clone();
          introBaseLookRef.current = targetLookRef.current.clone();

          if (controlsRef.current) {
            controlsRef.current.enabled = false;
          }
        }

        const baseCamera = introBaseCameraRef.current ?? targetCameraRef.current;
        const baseLook = introBaseLookRef.current ?? targetLookRef.current;
        const duration = 0.85;
        const progress = THREE.MathUtils.clamp((elapsed - introStartTimeRef.current) / duration, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const orbitOffset = baseCamera.clone().sub(baseLook);
        const revealAngle = THREE.MathUtils.degToRad(30 * (1 - eased));
        const revealDistance = THREE.MathUtils.lerp(1.08, 1, eased);
        const rotatedOffset = orbitOffset
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), revealAngle)
          .multiplyScalar(revealDistance);

        activeCamera.position.copy(baseLook).add(rotatedOffset);
        activeCamera.position.y = THREE.MathUtils.lerp(baseCamera.y + 0.16, baseCamera.y, eased);
        lookRef.current.copy(baseLook);
        activeCamera.lookAt(baseLook);

        if (controlsRef.current) {
          controlsRef.current.target.copy(baseLook);
          controlsRef.current.update();
        }

        if (progress >= 1 && !introCompletedRef.current) {
          introCompletedRef.current = true;
          activeCamera.position.copy(baseCamera);
          activeCamera.lookAt(baseLook);
          targetCameraRef.current.copy(baseCamera);
          targetLookRef.current.copy(baseLook);

          if (controlsRef.current) {
            controlsRef.current.enabled = true;
            controlsRef.current.target.copy(baseLook);
            controlsRef.current.update();
          }

          onIntroCompleteRef.current();
        }
      } else if (controlsRef.current) {
        controlsRef.current.enabled = true;
        controlsRef.current.update();
      } else if (activeCamera) {
        activeCamera.position.lerp(targetCameraRef.current, 0.065);
        lookRef.current.lerp(targetLookRef.current, 0.07);
        activeCamera.lookAt(lookRef.current);
      }

      if (activeCamera) {
        updateViewerHotspots({
          bounds: hotspotBoundsRef.current,
          camera: activeCamera,
          container,
          elements: hotspotElements,
          point: hotspotProjectionPointRef.current,
        });
      }

      studioSurfaces.stageRingHighlight.rotation.z = elapsed * 0.22;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelled = true;
      if (preloadTimer) {
        window.clearTimeout(preloadTimer);
      }
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      detachActiveAddonModels();
      if (bikeRef.current) {
        disposeObject(bikeRef.current);
      }
      if (hdriDomeRef.current) {
        disposeObject(hdriDomeRef.current);
      }
      addonModelCache.forEach((addon) => disposeObject(addon));
      addonModelCache.clear();
      addonModelLoadCache.clear();
      addonRequestCounters.clear();
      disposeObject(studioSurfaces.group);
      hdriBackgroundMapRef.current?.dispose();
      hdriBackgroundMapRef.current = null;
      hdriEnvironmentMapRef.current?.dispose();
      hdriEnvironmentMapRef.current = null;
      hdriDomeRef.current = null;
      hdriDomeMaterialRef.current = null;
      frameMorphMeshesRef.current = [];
      bodyFramePaintMaterialsRef.current = [];
      Object.values(bodyFrameDiffuseTexturesRef.current).forEach((texture) => texture?.dispose());
      bodyFrameDiffuseTexturesRef.current = {};
      handleMorphMeshesRef.current = [];
      seatMorphMeshesRef.current = [];
      rendererRef.current = null;
      ambientLightRef.current = null;
      keyLightRef.current = null;
      fillLightRef.current = null;
      rimLightRef.current = null;
      modelMaterialsRef.current = [];
      floorMaterialRef.current = null;
      floorGlowMaterialRef.current = null;
      contactAoMaterialRef.current = null;
      backdropMaterialRef.current = null;
      stageRingMaterialRef.current = null;
      stageRingHighlightMaterialRef.current = null;
      environmentMap.dispose();
      defaultEnvironmentMapRef.current = null;
      syncAddonModelRef.current = () => undefined;
      addonLoaderRef.current = null;
      assetSourceCenterRef.current = null;
      hotspotBoundsRef.current = null;
      hotspotElements.clear();
      controls.dispose();
      controlsRef.current = null;
      dracoLoader.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      scene.clear();
    };
  }, []);

  useEffect(() => {
    componentOptionsRef.current = config.components;
  }, [config.components]);

  useEffect(() => {
    paintRef.current = config.paint;
    const didApply = applyBodyFramePaintTexture(
      bodyFramePaintMaterialsRef.current,
      config.paint,
      bodyFrameDiffuseTexturesRef.current,
    );

    if (didApply) {
      applyModelAmbientOcclusion(modelMaterialsRef.current, viewerSettingsRef.current.modelAoIntensity);
    }
  }, [config.paint]);

  useEffect(() => {
    sizeRef.current = config.size;
    applyFrameSizeMorph(frameMorphMeshesRef.current, config.size);
    refreshHotspotBounds();
  }, [config.size]);

  useEffect(() => {
    handlebarSizeRef.current = config.components.cockpit;
    applyHandlebarSizeMorph(handleMorphMeshesRef.current, config.components.cockpit);
    refreshHotspotBounds();
  }, [config.components.cockpit]);

  useEffect(() => {
    seatAdjustmentRef.current = config.components.seatAdjustment;
    applySeatAdjustmentMorph(seatMorphMeshesRef.current, config.components.seatAdjustment);
    refreshHotspotBounds();
  }, [config.components.seatAdjustment]);

  useEffect(() => {
    syncAddonModelRef.current("wheel", config.components.wheel);
  }, [config.components.wheel]);

  useEffect(() => {
    syncAddonModelRef.current("groupset", config.components.groupset);
  }, [config.components.groupset]);

  useEffect(() => {
    syncAddonModelRef.current("pedals", config.components.pedals);
  }, [config.components.pedals]);

  useEffect(() => {
    syncAddonModelRef.current("storage", config.components.storage);
  }, [config.components.storage]);

  useEffect(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;

    if (!scene || !renderer) {
      return undefined;
    }

    let cancelled = false;

    const disposeUploadedHdri = () => {
      hdriBackgroundMapRef.current?.dispose();
      hdriBackgroundMapRef.current = null;
      hdriEnvironmentMapRef.current?.dispose();
      hdriEnvironmentMapRef.current = null;

      if (hdriDomeMaterialRef.current) {
        hdriDomeMaterialRef.current.uniforms.hdriMap.value = null;
      }
    };

    const refreshEnvironment = () => {
      applyViewerEnvironment({
        backgroundMode,
        backdropMaterial: backdropMaterialRef.current,
        defaultEnvironmentMap: defaultEnvironmentMapRef.current,
        hdriBackgroundMap: hdriBackgroundMapRef.current,
        hdriDome: hdriDomeRef.current,
        hdriDomeMaterial: hdriDomeMaterialRef.current,
        hdriEnvironmentMap: hdriEnvironmentMapRef.current,
        scene,
        viewerSettings: viewerSettingsRef.current,
      });
    };

    if (!hdriAsset) {
      disposeUploadedHdri();
      refreshEnvironment();
      return undefined;
    }

    const applyLoadedHdriTexture = (sourceTexture: THREE.Texture) => {
      if (cancelled) {
        sourceTexture.dispose();
        return;
      }

      if (hdriAsset.kind === "image") {
        sourceTexture.colorSpace = THREE.SRGBColorSpace;
      }

      sourceTexture.mapping = THREE.EquirectangularReflectionMapping;
      sourceTexture.needsUpdate = true;

      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const hdriEnvironmentMap = pmremGenerator.fromEquirectangular(sourceTexture).texture;
      pmremGenerator.dispose();

      const hdriBackgroundMap = sourceTexture;

      disposeUploadedHdri();

      hdriBackgroundMapRef.current = hdriBackgroundMap;
      hdriEnvironmentMapRef.current = hdriEnvironmentMap;

      if (hdriDomeMaterialRef.current) {
        hdriDomeMaterialRef.current.uniforms.hdriMap.value = hdriBackgroundMap;
      }

      refreshEnvironment();
    };

    const handleLoadError = () => {
      if (!cancelled) {
        refreshEnvironment();
      }
    };

    if (hdriAsset.kind === "hdr") {
      new RGBELoader().load(hdriAsset.url, applyLoadedHdriTexture, undefined, handleLoadError);
    } else if (hdriAsset.kind === "exr") {
      new EXRLoader().load(hdriAsset.url, applyLoadedHdriTexture, undefined, handleLoadError);
    } else {
      new THREE.TextureLoader().load(hdriAsset.url, applyLoadedHdriTexture, undefined, handleLoadError);
    }

    return () => {
      cancelled = true;
    };
  }, [backgroundMode, hdriAsset]);

  useEffect(() => {
    viewerSettingsRef.current = viewerSettings;

    const renderer = rendererRef.current;
    if (renderer) {
      renderer.toneMapping = toneMappingValues[viewerSettings.toneMapping];
      renderer.toneMappingExposure = viewerSettings.exposure;
      renderer.setPixelRatio(viewerSettings.pixelRatio);
      renderer.shadowMap.enabled = viewerSettings.shadows;
      renderer.shadowMap.type = THREE.VSMShadowMap;
      renderer.shadowMap.needsUpdate = true;
      renderer.domElement.style.filter = `contrast(${viewerSettings.environmentContrast})`;

      const container = containerRef.current;
      if (container) {
        renderer.setSize(container.clientWidth, container.clientHeight);
      }
    }

    const scene = sceneRef.current;
    let environmentColor = new THREE.Color(viewerSettings.environmentColor);
    if (scene) {
      environmentColor = applyViewerEnvironment({
        backgroundMode,
        backdropMaterial: backdropMaterialRef.current,
        defaultEnvironmentMap: defaultEnvironmentMapRef.current,
        hdriBackgroundMap: hdriBackgroundMapRef.current,
        hdriDome: hdriDomeRef.current,
        hdriDomeMaterial: hdriDomeMaterialRef.current,
        hdriEnvironmentMap: hdriEnvironmentMapRef.current,
        scene,
        viewerSettings,
      });
    }

    if (ambientLightRef.current) {
      const tintColor = backgroundMode === "color" ? viewerSettings.environmentColor : "#ffffff";

      ambientLightRef.current.color.copy(getTintedColor("#f7f1e4", tintColor, 0.12));
      ambientLightRef.current.intensity = viewerSettings.ambientIntensity;
    }

    if (keyLightRef.current) {
      keyLightRef.current.intensity = viewerSettings.keyIntensity;
      keyLightRef.current.castShadow = viewerSettings.shadows;
      keyLightRef.current.shadow.blurSamples = viewerSettings.vsmBlurSamples;
      keyLightRef.current.shadow.needsUpdate = true;
    }

    if (fillLightRef.current) {
      const tintColor = backgroundMode === "color" ? viewerSettings.environmentColor : "#ffffff";

      fillLightRef.current.color.copy(getTintedColor("#f7f1e4", tintColor, 0.18));
      fillLightRef.current.intensity = viewerSettings.fillIntensity;
    }

    if (rimLightRef.current) {
      const tintColor = backgroundMode === "color" ? viewerSettings.environmentColor : "#ffffff";

      rimLightRef.current.color.copy(getTintedColor("#f1413c", tintColor, 0.25));
      rimLightRef.current.intensity = viewerSettings.rimIntensity;
    }

    applyModelAmbientOcclusion(modelMaterialsRef.current, viewerSettings.modelAoIntensity);

    if (floorMaterialRef.current) {
      const tintColor = backgroundMode === "color" ? viewerSettings.environmentColor : "#ffffff";

      floorMaterialRef.current.color.copy(getTintedColor("#b9bfbd", tintColor, 0.34));
      floorMaterialRef.current.needsUpdate = true;
    }

    if (floorGlowMaterialRef.current) {
      floorGlowMaterialRef.current.color.copy(environmentColor);
      floorGlowMaterialRef.current.opacity = viewerSettings.floorGlow;
    }

    if (contactAoMaterialRef.current) {
      contactAoMaterialRef.current.opacity = viewerSettings.aoIntensity;
    }

    if (stageRingMaterialRef.current) {
      stageRingMaterialRef.current.color.copy(environmentColor);
    }

    if (stageRingHighlightMaterialRef.current) {
      const tintColor = backgroundMode === "color" ? viewerSettings.environmentColor : "#ffffff";

      stageRingHighlightMaterialRef.current.color.copy(getTintedColor("#ffffff", tintColor, 0.72));
    }

    if (cameraRef.current) {
      cameraRef.current.fov = viewerSettings.cameraFov;
      cameraRef.current.updateProjectionMatrix();
    }
  }, [backgroundMode, viewerSettings]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || modelLoadedRef.current || !fallbackRef.current) {
      return;
    }

    if (bikeRef.current) {
      scene.remove(bikeRef.current);
      disposeObject(bikeRef.current);
    }

    const bike = buildBike(config, focus);
    bikeRef.current = bike;
    scene.add(bike);
    refreshHotspotBounds();
  }, [config, focus]);

  useEffect(() => {
    if (assetCameraRef.current) {
      targetCameraRef.current.copy(assetCameraRef.current.camera);
      targetLookRef.current.copy(assetCameraRef.current.look);
      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.copy(assetCameraRef.current.camera);
        controlsRef.current.target.copy(assetCameraRef.current.look);
        controlsRef.current.update();
      }
      return;
    }

    const cameraTargets: Record<string, [THREE.Vector3, THREE.Vector3]> = {
      cockpit: [new THREE.Vector3(1.28, 1.8, 3.15), new THREE.Vector3(1.05, 1.48, 0)],
      default: [
        new THREE.Vector3(startupCameraX, modelGroundY + startupCameraHeightOffset, startupCameraDistance),
        new THREE.Vector3(startupCameraX, modelGroundY + startupLookHeightOffset, 0),
      ],
      drivetrain: [new THREE.Vector3(-0.55, 0.74, 2.35), new THREE.Vector3(-0.38, 0.38, 0)],
      front: [new THREE.Vector3(1.28, 0.9, 2.65), new THREE.Vector3(1.36, 0.2, 0)],
      rear: [new THREE.Vector3(-1.35, 0.85, 2.55), new THREE.Vector3(-1.35, 0.18, 0)],
      saddle: [new THREE.Vector3(-1.05, 1.72, 2.5), new THREE.Vector3(-0.86, 1.72, 0)],
    };
    const [cameraTarget, lookTarget] = cameraTargets[focus] ?? cameraTargets.default;
    targetCameraRef.current.copy(cameraTarget);
    targetLookRef.current.copy(lookTarget);
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.copy(cameraTarget);
      controlsRef.current.target.copy(lookTarget);
      controlsRef.current.update();
    }
  }, [focus]);

  return (
    <div className="bike-stage" ref={containerRef}>
      <div
        aria-hidden={!showHotspots}
        aria-label="Model hotspots"
        className="viewer-hotspots"
        hidden={!showHotspots}
      >
        {viewerHotspots.map((hotspot) => (
          <div
            aria-label={
              hotspot.description
                ? `${hotspot.label}: ${hotspot.description}`
                : hotspot.label
            }
            aria-expanded={hotspot.description ? activeHotspotId === hotspot.id : undefined}
            className={`viewer-hotspot ${hotspot.id}-hotspot ${
              activeHotspotId === hotspot.id ? "active" : ""
            }`}
            key={hotspot.id}
            onClick={() => {
              if (!hotspot.description) {
                return;
              }

              setActiveHotspotId((current) => current === hotspot.id ? null : hotspot.id);
            }}
            onKeyDown={(event) => {
              if (!hotspot.description || (event.key !== "Enter" && event.key !== " ")) {
                return;
              }

              event.preventDefault();
              setActiveHotspotId((current) => current === hotspot.id ? null : hotspot.id);
            }}
            ref={(element) => {
              if (element) {
                hotspotElementsRef.current.set(hotspot.id, element);
              } else {
                hotspotElementsRef.current.delete(hotspot.id);
              }
            }}
            role={hotspot.description ? "button" : undefined}
            tabIndex={hotspot.description ? 0 : -1}
          >
            <span className="viewer-hotspot-dot" />
            <span className="viewer-hotspot-label">{hotspot.label}</span>
            {hotspot.description ? (
              <span className="viewer-hotspot-card">
                <strong>{hotspot.label}</strong>
                <span>{hotspot.description}</span>
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ConfiguratorClient() {
  const [activeStep, setActiveStep] = useState<StepId>("components");
  const [config, setConfig] = useState<ConfigState>(defaultConfig);
  const [editingGroup, setEditingGroup] = useState<ComponentKey | null>(null);
  const [status, setStatus] = useState("");
  const [hdriAsset, setHdriAsset] = useState<HdriAsset | null>(null);
  const [hasUploadedHdri, setHasUploadedHdri] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("color");
  const [showHotspots, setShowHotspots] = useState(false);
  const [introPhase, setIntroPhase] = useState<IntroPhase>("loading");
  const [loaderProgress, setLoaderProgress] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const hdriObjectUrlRef = useRef<string | null>(null);
  const [viewerSettings, setViewerSettings] = useState<ViewerSettings>(defaultViewerSettings);

  useEffect(() => {
    if (introPhase !== "loading") {
      return undefined;
    }

    let frame = 0;
    const start = performance.now();
    const duration = 1800;

    const tick = (time: number) => {
      const progress = Math.min(100, Math.round(((time - start) / duration) * 100));
      setLoaderProgress(progress);

      if (progress < 100) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [introPhase]);

  useEffect(() => {
    if (introPhase !== "loading" || !sceneReady || loaderProgress < 100) {
      return undefined;
    }

    const timer = window.setTimeout(() => setIntroPhase("cinematic"), 40);

    return () => window.clearTimeout(timer);
  }, [introPhase, loaderProgress, sceneReady]);

  useEffect(() => {
    return () => {
      if (hdriObjectUrlRef.current) {
        URL.revokeObjectURL(hdriObjectUrlRef.current);
      }
    };
  }, []);

  const paint = getPaint(config.paint);
  const total = useMemo(() => {
    const componentTotal = componentGroups.reduce((sum, group) => {
      return sum + getComponent(group, config.components[group.key]).priceDelta;
    }, 0);

    return basePrice + paint.priceDelta + componentTotal;
  }, [config, paint]);

  const activeStage: StageId =
    activeStep === "summary"
      ? "review"
      : activeStep === "graphic"
        ? "style"
        : activeStep === "studio"
          ? "studio"
          : "build";
  const stageTabStyle = {
    "--active-tab-offset": stageTabOffsets[activeStage],
  } as CSSProperties;
  const focus =
    activeStep === "components"
      ? getFocusForGroup(editingGroup)
      : activeStep === "size"
        ? "default"
        : activeStep === "summary"
          ? "default"
          : "default";

  const visibleComponentOrder: ComponentKey[] = [
    "cockpit",
    "seatAdjustment",
    "wheel",
    "groupset",
    "pedals",
    "storage",
  ];

  const summaryRows = [
    ["Model", modelName],
    ["Graphic", paint.name],
    ["Finish", paint.finish],
    ["Size", getSizeLabel(config.size)],
    ...visibleComponentOrder
      .map((groupKey) => getComponentGroup(groupKey))
      .map((group) => [
        group.label,
        getComponent(group, config.components[group.key]).name,
      ]),
  ];

  const buildComponentOrder = visibleComponentOrder;

  const buildCards = [
    {
      id: "frame",
      icon: getComponentIconKey("frame"),
      label: "Frame",
      value: getSizeLabel(config.size),
      meta: `${modelName} Disc`,
      thumb: "frame",
      onClick: () => {
        setEditingGroup(null);
        setActiveStep("size");
      },
    },
    ...buildComponentOrder
      .map((groupKey) => getComponentGroup(groupKey))
      .map((group) => {
        const selected = getComponent(group, config.components[group.key]);

        return {
          id: group.key,
          icon: getComponentIconKey(group.key),
          label: group.label === "Wheel" ? "Wheels" : group.label,
          value: selected.name,
          meta: selected.priceDelta ? `+${formatter.format(selected.priceDelta)}` : "Included",
          thumb: group.key === "seatAdjustment" ? "saddle" : group.key,
          onClick: () => {
            setActiveStep("components");
            setEditingGroup(group.key);
          },
        };
      }),
  ];
  const updateComponent = (group: ComponentGroup, optionId: string) => {
    setConfig((current) => ({
      ...current,
      components: {
        ...current.components,
        [group.key]: optionId,
      },
    }));
  };

  const updateViewerNumber = (key: NumericViewerSettingKey, value: number) => {
    setViewerSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateViewerBoolean = (key: keyof Pick<ViewerSettings, "shadows">, value: boolean) => {
    setViewerSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateToneMapping = (toneMapping: ToneMappingKey) => {
    setViewerSettings((current) => ({
      ...current,
      toneMapping,
    }));
  };

  const updateViewerColor = (environmentColor: string) => {
    if (hdriObjectUrlRef.current) {
      URL.revokeObjectURL(hdriObjectUrlRef.current);
      hdriObjectUrlRef.current = null;
    }

    setBackgroundMode("color");
    setHdriAsset(null);
    setHasUploadedHdri(false);
    setViewerSettings((current) => ({
      ...current,
      environmentColor,
    }));
    setStatus("");
  };

  const applyHdriPreset = (preset: HdriPreset) => {
    if (hdriObjectUrlRef.current) {
      URL.revokeObjectURL(hdriObjectUrlRef.current);
      hdriObjectUrlRef.current = null;
    }

    setBackgroundMode("hdri");
    setHdriAsset({
      kind: preset.kind,
      name: preset.name,
      url: preset.url,
    });
    setHasUploadedHdri(false);
    setViewerSettings((current) => ({
      ...current,
      ...preset.settings,
    }));
    setStatus("");
  };

  const restoreDefaultHdriAsset = () => {
    applyHdriPreset(hdriPresets[0]);
  };

  const disableHdriAsset = () => {
    if (hdriObjectUrlRef.current) {
      URL.revokeObjectURL(hdriObjectUrlRef.current);
      hdriObjectUrlRef.current = null;
    }

    setHdriAsset(null);
    setHasUploadedHdri(false);
    setBackgroundMode("color");
    setStatus("HDRI disabled. Default studio background restored.");
  };

  const uploadHdriAsset = (file: File) => {
    if (hdriObjectUrlRef.current) {
      URL.revokeObjectURL(hdriObjectUrlRef.current);
    }

    const url = URL.createObjectURL(file);
    hdriObjectUrlRef.current = url;
    setHdriAsset({
      kind: getHdriAssetKind(file.name),
      name: file.name,
      url,
    });
    setBackgroundMode("hdri");
    setHasUploadedHdri(true);
    setStatus(`HDRI loaded: ${file.name}`);
  };

  const nextStep = () => {
    if (editingGroup) {
      setEditingGroup(null);
      return;
    }

    if (activeStep === "summary") {
      setStatus("");
      return;
    }

    if (activeStep === "studio") {
      setStatus("Studio renderer settings applied.");
      return;
    }

    setEditingGroup(null);
    if (activeStep === "graphic") {
      setActiveStep("summary");
    } else if (activeStep === "size") {
      setActiveStep("components");
    } else {
      setActiveStep("graphic");
    }
  };

  const previousStep = () => {
    if (editingGroup) {
      setEditingGroup(null);
      return;
    }

    if (activeStep === "studio") {
      setActiveStep("summary");
    } else if (activeStep === "summary") {
      setActiveStep("graphic");
    } else if (activeStep === "graphic") {
      setActiveStep("components");
    } else {
      setActiveStep("components");
    }
  };

  const setStage = (stage: StageId) => {
    setEditingGroup(null);
    setStatus("");

    if (stage === "studio") {
      setActiveStep("studio");
      return;
    }

    if (stage === "style") {
      setActiveStep("graphic");
      return;
    }

    if (stage === "review") {
      setActiveStep("summary");
      return;
    }

    setActiveStep("components");
  };

  const activeHdriPreset = backgroundMode === "hdri" && !hasUploadedHdri && hdriAsset
    ? hdriPresets.find((preset) => preset.url === hdriAsset.url)
    : null;
  const isDefaultHdriActive = backgroundMode === "hdri" && activeHdriPreset?.id === defaultHdriAsset.id;
  const isHdriDisabled = backgroundMode !== "hdri" || !hdriAsset;

  return (
    <main className={`configurator-shell intro-${introPhase}`} aria-busy={introPhase !== "ready"}>
      <section className="studio-area" aria-label="3D cycle preview">
        <BikeScene
          backgroundMode={backgroundMode}
          config={config}
          focus={focus}
          hdriAsset={hdriAsset}
          introPhase={introPhase}
          onIntroComplete={() => setIntroPhase("ready")}
          onSceneReady={() => setSceneReady(true)}
          showHotspots={showHotspots}
          viewerSettings={viewerSettings}
        />

        <header className="brand-block" aria-hidden={introPhase !== "ready"}>
          <div className="brand-wordmark glamar-wordmark" aria-label="Fynd GlamAR">
            {/* Static GitHub Pages build cannot use next/image here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={publicAsset("fynd-glamar-logo.svg")} alt="Fynd GlamAR" width={180} height={30} />
          </div>
        </header>

        <div className="help-card" aria-hidden={introPhase !== "ready"}>
          <span className="help-icon" />
          <strong>Need Help?</strong>
          <small>Chat with an expert</small>
        </div>
      </section>

      <aside className="control-panel" aria-hidden={introPhase === "loading"} aria-label="Ribble cycle configurator">
        <header className="panel-header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="panel-brand-logo" src={publicAsset("ribble-logo-source.png")} alt="Ribble" width={105} height={22} />
          <span>{modelName}</span>
        </header>

        <nav className="stage-tabs" aria-label="Configuration stages" style={stageTabStyle}>
          <button
            className={activeStage === "build" ? "active" : ""}
            onClick={() => setStage("build")}
            type="button"
          >
            Build
          </button>
          <button
            className={activeStage === "style" ? "active" : ""}
            onClick={() => setStage("style")}
            type="button"
          >
            Style
          </button>
          <button
            className={activeStage === "review" ? "active" : ""}
            onClick={() => setStage("review")}
            type="button"
          >
            Review
          </button>
          <button
            className={activeStage === "studio" ? "active" : ""}
            onClick={() => setStage("studio")}
            type="button"
          >
            Studio
          </button>
        </nav>

        <div className="panel-body">
          {activeStage === "build" && !editingGroup && activeStep !== "size" && (
            <section className="build-list" aria-label="Build selections">
              <button
                aria-pressed={showHotspots}
                className={`hotspot-toggle ${showHotspots ? "active" : ""}`}
                onClick={() => setShowHotspots((current) => !current)}
                type="button"
              >
                <span className="hotspot-toggle-dot" />
                {showHotspots ? "Hide Hotspots" : "Show Hotspots"}
              </button>
              {buildCards.map((card) => (
                <button
                  className="build-card"
                  key={card.id}
                  onClick={card.onClick}
                  type="button"
                >
                  <span className={`part-thumb ${card.thumb}-thumb`}>
                    <PartIcon kind={card.icon} />
                  </span>
                  <span>
                    <strong>{card.label}</strong>
                    <small>{card.value}</small>
                  </span>
                  <em>{card.meta}</em>
                  <i className="edit-icon" />
                </button>
              ))}

            </section>
          )}

          {activeStep === "graphic" && (
            <section className="step-content" aria-label="Graphic selection">
              <div className="section-title">
                <p>Paint & Decals</p>
                <strong>{paint.name}</strong>
              </div>
              <div className="paint-grid">
                {paintOptions.map((option) => (
                  <button
                    aria-label={option.name}
                    className={config.paint === option.id ? "paint-swatch selected" : "paint-swatch"}
                    key={option.id}
                    onClick={() => setConfig((current) => ({ ...current, paint: option.id }))}
                    style={{
                      "--paint-accent": option.accent,
                      "--paint-decal": option.decal,
                      "--paint-frame": option.frame,
                    } as CSSProperties}
                    title={option.name}
                    type="button"
                  >
                    <span className="paint-swatch-preview" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeStep === "size" && (
            <section className="step-content" aria-label="Size selection">
              <div className="section-title">
                <p>Frame</p>
                <strong>{getSizeLabel(config.size)}</strong>
              </div>
              <div className="size-grid">
                {sizeOptions.map((size) => (
                  <button
                    aria-pressed={config.size === size.id}
                    className={config.size === size.id ? "selected" : ""}
                    key={size.id}
                    onClick={() => setConfig((current) => ({ ...current, size: size.id }))}
                    type="button"
                  >
                    <strong>{size.label}</strong>
                    <span>{size.dimensions}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeStep === "components" && editingGroup && (
            <section className="step-content" aria-label="Component options">
              {(() => {
                const group = componentGroups.find((item) => item.key === editingGroup);

                if (!group) {
                  return null;
                }

                return (
                  <>
                    <button className="back-link" onClick={previousStep} type="button">
                      Back
                    </button>
                    <div className="option-stack">
                      {group.options.map((option) => (
                        <button
                          className={
                            config.components[group.key] === option.id
                              ? "option-row selected"
                              : "option-row"
                          }
                          key={option.id}
                          onClick={() => updateComponent(group, option.id)}
                          type="button"
                        >
                          <span className="option-thumb">
                            <PartIcon kind={getComponentIconKey(group.key)} />
                          </span>
                          <span>
                            <strong>{option.name}</strong>
                            <small>{option.subtitle}</small>
                          </span>
                          <em>{option.priceDelta ? `+${formatter.format(option.priceDelta)}` : "Included"}</em>
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
            </section>
          )}

          {activeStep === "summary" && (
            <section className="summary-list" aria-label="Configuration summary">
              {summaryRows.map(([label, value]) => (
                <div className="summary-row" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </section>
          )}

          {activeStep === "studio" && (
            <section className="studio-settings" aria-label="Studio environment settings">
              <div className="section-title">
                <p>Studio</p>
                <strong>Render Setup</strong>
              </div>

              <div className="studio-select-row">
                <label>
                  <span>Tone Mapping</span>
                  <select
                    onChange={(event) => updateToneMapping(event.currentTarget.value as ToneMappingKey)}
                    value={viewerSettings.toneMapping}
                  >
                    {toneMappingLabels.map((mode) => (
                      <option key={mode.id} value={mode.id}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="studio-reset"
                  onClick={() => setViewerSettings(defaultViewerSettings)}
                  type="button"
                >
                  Reset
                </button>
              </div>

              <div className="studio-group">
                <p>HDRI Dome</p>
                <div className="studio-hdri-presets" aria-label="Preset HDRI domes">
                  <span>Preset HDRI</span>
                  <div className="studio-hdri-preset-row">
                    {hdriPresets.map((preset) => {
                      const isActivePreset = activeHdriPreset?.id === preset.id;

                      return (
                        <button
                          aria-label={`${preset.label} HDRI preset. Intensity ${preset.settings.hdriIntensity.toFixed(2)}, scale ${preset.settings.hdriScale.toFixed(2)}, rotation ${preset.settings.hdriRotation} degrees`}
                          aria-pressed={isActivePreset}
                          className={isActivePreset ? "studio-hdri-preset active" : "studio-hdri-preset"}
                          key={preset.id}
                          onClick={() => applyHdriPreset(preset)}
                          style={{ "--preset-swatch": preset.swatch } as CSSProperties}
                          title={`${preset.label}: ${preset.settings.hdriIntensity.toFixed(2)} intensity, ${preset.settings.hdriScale.toFixed(2)}x scale, ${preset.settings.hdriRotation} deg`}
                          type="button"
                        >
                          <span aria-hidden="true" />
                          <em>{preset.label}</em>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="studio-upload-control">
                  <span>
                    <em>HDRI File</em>
                    <strong>{hdriAsset?.name ?? "None"}</strong>
                  </span>
                  <div className="studio-upload-actions">
                    <label>
                      Upload HDRI
                      <input
                        accept=".hdr,.exr,image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];

                          if (file) {
                            uploadHdriAsset(file);
                            event.currentTarget.value = "";
                          }
                        }}
                        type="file"
                      />
                    </label>
                    <button
                      disabled={isDefaultHdriActive}
                      onClick={restoreDefaultHdriAsset}
                      type="button"
                    >
                      Restore Default
                    </button>
                    <button
                      disabled={isHdriDisabled}
                      onClick={disableHdriAsset}
                      type="button"
                    >
                      None
                    </button>
                  </div>
                </div>
                <StudioRange
                  label="HDRI Intensity"
                  max={4}
                  min={0}
                  onChange={(value) => updateViewerNumber("hdriIntensity", value)}
                  step={0.01}
                  value={viewerSettings.hdriIntensity}
                />
                <StudioRange
                  label="HDRI Scale"
                  max={2.5}
                  min={0.5}
                  onChange={(value) => updateViewerNumber("hdriScale", value)}
                  step={0.01}
                  suffix="x"
                  value={viewerSettings.hdriScale}
                />
                <StudioRange
                  label="HDRI Rotation"
                  max={180}
                  min={-180}
                  onChange={(value) => updateViewerNumber("hdriRotation", value)}
                  step={1}
                  suffix=" deg"
                  value={viewerSettings.hdriRotation}
                />
              </div>

              <div className="studio-group">
                <p>Environment</p>
                <StudioColorPalette
                  active={backgroundMode === "color"}
                  onChange={updateViewerColor}
                  value={viewerSettings.environmentColor}
                />
                <StudioRange
                  label="Exposure"
                  max={2.4}
                  min={0.2}
                  onChange={(value) => updateViewerNumber("exposure", value)}
                  step={0.01}
                  value={viewerSettings.exposure}
                />
                <StudioRange
                  label="Environment Intensity"
                  max={3}
                  min={0}
                  onChange={(value) => updateViewerNumber("environmentIntensity", value)}
                  step={0.01}
                  value={viewerSettings.environmentIntensity}
                />
                <StudioRange
                  label="Environment Rotation"
                  max={180}
                  min={-180}
                  onChange={(value) => updateViewerNumber("environmentRotation", value)}
                  step={1}
                  suffix=" deg"
                  value={viewerSettings.environmentRotation}
                />
                <StudioRange
                  label="Environment Contrast"
                  max={1.7}
                  min={0.7}
                  onChange={(value) => updateViewerNumber("environmentContrast", value)}
                  step={0.01}
                  value={viewerSettings.environmentContrast}
                />
                <StudioRange
                  label="Ambient Light"
                  max={4}
                  min={0}
                  onChange={(value) => updateViewerNumber("ambientIntensity", value)}
                  step={0.01}
                  value={viewerSettings.ambientIntensity}
                />
              </div>

              <div className="studio-group">
                <p>Lighting</p>
                <StudioRange
                  label="Key Intensity"
                  max={12}
                  min={0}
                  onChange={(value) => updateViewerNumber("keyIntensity", value)}
                  step={0.05}
                  value={viewerSettings.keyIntensity}
                />
                <StudioRange
                  label="Fill Intensity"
                  max={18}
                  min={0}
                  onChange={(value) => updateViewerNumber("fillIntensity", value)}
                  step={0.05}
                  value={viewerSettings.fillIntensity}
                />
                <StudioRange
                  label="Rim Intensity"
                  max={6}
                  min={0}
                  onChange={(value) => updateViewerNumber("rimIntensity", value)}
                  step={0.05}
                  value={viewerSettings.rimIntensity}
                />
              </div>

              <div className="studio-group">
                <p>Shadows & AO</p>
                <StudioToggle
                  checked={viewerSettings.shadows}
                  label="Shadow"
                  onChange={(value) => updateViewerBoolean("shadows", value)}
                />
                <StudioRange
                  label="VSM Blur Samples"
                  max={24}
                  min={0}
                  onChange={(value) => updateViewerNumber("vsmBlurSamples", value)}
                  step={1}
                  value={viewerSettings.vsmBlurSamples}
                />
                <StudioRange
                  label="Model AO"
                  max={2}
                  min={0}
                  onChange={(value) => updateViewerNumber("modelAoIntensity", value)}
                  step={0.01}
                  value={viewerSettings.modelAoIntensity}
                />
              </div>

              <div className="studio-group">
                <p>Composition</p>
                <StudioRange
                  label="Camera FOV"
                  max={55}
                  min={20}
                  onChange={(value) => updateViewerNumber("cameraFov", value)}
                  step={1}
                  suffix=" deg"
                  value={viewerSettings.cameraFov}
                />
                <StudioRange
                  label="Pixel Ratio"
                  max={3}
                  min={0.75}
                  onChange={(value) => updateViewerNumber("pixelRatio", value)}
                  step={0.25}
                  suffix="x"
                  value={viewerSettings.pixelRatio}
                />
                <StudioRange
                  label="Floor Glow Fade"
                  max={1}
                  min={0}
                  onChange={(value) => updateViewerNumber("floorGlow", value)}
                  step={0.01}
                  value={viewerSettings.floorGlow}
                />
                <StudioRange
                  label="Backdrop Glow"
                  max={1.6}
                  min={0}
                  onChange={(value) => updateViewerNumber("backdropGlow", value)}
                  step={0.01}
                  value={viewerSettings.backdropGlow}
                />
              </div>
            </section>
          )}
        </div>

        <footer className="panel-footer">
          <div className="price-block">
            <span>{modelName}</span>
            <strong>{formatter.format(total)}</strong>
            <small>Delivery in 4-6 weeks</small>
          </div>
          <div className="footer-actions">
            <button className="primary-action" onClick={nextStep} type="button">
              {activeStep === "summary"
                ? "Buy it now"
                : activeStep === "studio"
                  ? "Done"
                  : editingGroup
                    ? "Confirm"
                    : "Next"}
            </button>
          </div>
        </footer>
        {status && <p className="status-line">{status}</p>}
      </aside>

      {introPhase === "loading" ? (
        <div className="experience-loader" role="status" aria-label="Loading Fynd GlamAR configurator">
          <div className="loader-mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={publicAsset("fynd-glamar-logo.svg")} alt="Fynd GlamAR" width={214} height={36} />
          </div>
          <div className="loader-track" aria-hidden="true">
            <span style={{ width: `${loaderProgress}%` }} />
          </div>
        </div>
      ) : null}

    </main>
  );
}
