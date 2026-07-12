"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type StepId = "graphic" | "size" | "components" | "summary" | "studio";
type StageId = "build" | "style" | "review" | "studio";
type ComponentKey = "groupset" | "crankset" | "cassette" | "wheel" | "cockpit" | "saddle";
type ToneMappingKey = "none" | "linear" | "reinhard" | "cineon" | "aces" | "agx" | "neutral";

type PaintOption = {
  id: string;
  name: string;
  finish: string;
  frame: string;
  accent: string;
  decal: string;
  priceDelta: number;
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
};

type StudioSurfaces = {
  backdropMaterial: THREE.MeshBasicMaterial;
  contactAoMaterial: THREE.MeshBasicMaterial;
  floorGlowMaterial: THREE.MeshBasicMaterial;
  floorMaterial: THREE.MeshStandardMaterial;
  group: THREE.Group;
  stageRingMaterial: THREE.MeshBasicMaterial;
  stageRingHighlight: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
};

type NumericViewerSettingKey = {
  [Key in keyof ViewerSettings]: ViewerSettings[Key] extends number ? Key : never;
}[keyof ViewerSettings];

const paintOptions: PaintOption[] = [
  {
    id: "racing-red",
    name: "Racing Red",
    finish: "Gloss carbon / red gloss",
    frame: "#1c1f1d",
    accent: "#e63737",
    decal: "#f8f4ed",
    priceDelta: 0,
  },
  {
    id: "electric-teal",
    name: "Electric Teal",
    finish: "Satin black / teal pearl",
    frame: "#111716",
    accent: "#20d4be",
    decal: "#f2efe7",
    priceDelta: 180,
  },
  {
    id: "champagne",
    name: "Champagne Fade",
    finish: "Warm silver / black fade",
    frame: "#c5bba5",
    accent: "#111111",
    decal: "#f4efe2",
    priceDelta: 260,
  },
  {
    id: "lime-team",
    name: "Lime Team",
    finish: "Graphite / lime race stripe",
    frame: "#161818",
    accent: "#b5f336",
    decal: "#f7f7f0",
    priceDelta: 120,
  },
  {
    id: "white-ink",
    name: "White Ink",
    finish: "Pearl white / black logo",
    frame: "#f0eee7",
    accent: "#111111",
    decal: "#111111",
    priceDelta: 90,
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

const defaultViewerSettings: ViewerSettings = {
  ambientIntensity: 0,
  aoIntensity: 0,
  backdropGlow: 0,
  cameraFov: 35,
  environmentColor: "#d3e5f8",
  environmentContrast: 1.08,
  environmentIntensity: 1.06,
  environmentRotation: 22,
  exposure: 0.61,
  fillIntensity: 1.9,
  floorGlow: 0.75,
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
        name: "Shimano 105 Di2",
        subtitle: "Electronic 12 speed",
        priceDelta: 0,
        visual: { metal: "#b9bec4" },
      },
      {
        id: "ultegra-di2",
        name: "Shimano Ultegra Di2",
        subtitle: "Electronic 12 speed",
        priceDelta: 520,
        visual: { metal: "#d5d8dc" },
      },
      {
        id: "sram-force-axs",
        name: "SRAM Force AXS",
        subtitle: "Wireless 12 speed",
        priceDelta: 720,
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
    label: "Wheel",
    focus: "front",
    options: [
      {
        id: "level-db40",
        name: "LEVEL DB40 Sport",
        subtitle: "Carbon 40 mm",
        priceDelta: 0,
        visual: { rimDepth: 40 },
      },
      {
        id: "mavic-cosmic",
        name: "Mavic Cosmic SLR 45",
        subtitle: "Carbon 45 mm",
        priceDelta: 640,
        visual: { rimDepth: 45 },
      },
      {
        id: "zipp-404",
        name: "Zipp 404 Firecrest",
        subtitle: "Carbon 58 mm",
        priceDelta: 1150,
        visual: { rimDepth: 58 },
      },
    ],
  },
  {
    key: "cockpit",
    label: "Handlebar",
    focus: "cockpit",
    options: [
      {
        id: "alloy-compact",
        name: "Alloy Compact Bar",
        subtitle: "100 mm stem",
        priceDelta: 0,
        visual: { cockpit: "#191b1d" },
      },
      {
        id: "carbon-integrated",
        name: "Carbon Integrated Bar",
        subtitle: "Aero one-piece cockpit",
        priceDelta: 380,
        visual: { cockpit: "#050607" },
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
const bikeModelUrl = publicAsset("models/ultra-road-red-axs-zipp.glb");
const startupCameraDistance = 3.7;
const startupCameraX = 0.48;

const defaultConfig: ConfigState = {
  paint: "racing-red",
  size: "M",
  components: {
    groupset: "shimano-105-di2",
    crankset: "compact-50-34",
    cassette: "11-30",
    wheel: "level-db40",
    cockpit: "alloy-compact",
    saddle: "prologo",
  },
};

const railItems = [
  { id: "frame", label: "Frame" },
  { id: "wheel", label: "Wheels" },
  { id: "groupset", label: "Groupset" },
  { id: "cockpit", label: "Cockpit" },
  { id: "components", label: "Components" },
  { id: "paint", label: "Paint & Decals" },
];

function getPaint(id: string) {
  return paintOptions.find((option) => option.id === id) ?? paintOptions[0];
}

function getComponent(group: ComponentGroup, id: string) {
  return group.options.find((option) => option.id === id) ?? group.options[0];
}

function getFocusForGroup(groupKey: ComponentKey | null) {
  if (!groupKey) {
    return "default";
  }

  return componentGroups.find((group) => group.key === groupKey)?.focus ?? "default";
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
  const wheelOption = getComponent(componentGroups[3], config.components.wheel);
  const groupsetOption = getComponent(componentGroups[0], config.components.groupset);
  const cockpitOption = getComponent(componentGroups[4], config.components.cockpit);
  const saddleOption = getComponent(componentGroups[5], config.components.saddle);

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: paint.frame,
    emissive: paint.frame,
    emissiveIntensity: 0.08,
    metalness: 0.62,
    roughness: paint.id === "champagne" ? 0.28 : 0.36,
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

function prepareViewportModel(model: THREE.Object3D, anisotropy = 1) {
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;

    if (!mesh.isMesh) {
      return;
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => tuneStudioMaterial(material, anisotropy));
    } else if (mesh.material) {
      tuneStudioMaterial(mesh.material, anisotropy);
    }
  });

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
  group.position.y = -0.82 + (size.y * scale) / 2;

  const look = new THREE.Vector3(startupCameraX, group.position.y, 0);
  const camera = new THREE.Vector3(
    startupCameraX,
    group.position.y + Math.max(size.y * scale * 0.06, 0.12),
    startupCameraDistance,
  );

  return { camera, group, look };
}

function getFrameSizeMorphValue(sizeId: string) {
  return frameSizeMorphValues[sizeId] ?? frameSizeMorphValues.S;
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
  const nameTrail = getObjectNameTrail(mesh);
  return (
    nameTrail.includes("body-frame") ||
    nameTrail.includes("body frame") ||
    nameTrail.includes("body_frame")
  );
}

function getPrimaryMorphTargetIndex(mesh: THREE.Mesh) {
  const namedIndex = mesh.morphTargetDictionary?.["Key 1"];

  if (typeof namedIndex === "number") {
    return namedIndex;
  }

  const firstIndex = Object.values(mesh.morphTargetDictionary ?? {})[0];
  return typeof firstIndex === "number" ? firstIndex : 0;
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
    vertical.addColorStop(0, "#070707");
    vertical.addColorStop(0.44, "#20201d");
    vertical.addColorStop(0.74, "#11110f");
    vertical.addColorStop(1, "#030303");
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
    centerGlow.addColorStop(0, "rgba(245, 242, 235, 0.15)");
    centerGlow.addColorStop(0.45, "rgba(222, 197, 117, 0.06)");
    centerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = centerGlow;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const edgeShade = context.createLinearGradient(0, 0, canvas.width, 0);
    edgeShade.addColorStop(0, "rgba(0, 0, 0, 0.72)");
    edgeShade.addColorStop(0.32, "rgba(0, 0, 0, 0)");
    edgeShade.addColorStop(0.68, "rgba(0, 0, 0, 0)");
    edgeShade.addColorStop(1, "rgba(0, 0, 0, 0.76)");
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
    glow.addColorStop(0.32, "rgba(222, 197, 117, 0.12)");
    glow.addColorStop(0.7, "rgba(222, 197, 117, 0.035)");
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
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");

  if (context) {
    const ao = context.createRadialGradient(256, 256, 20, 256, 256, 250);
    ao.addColorStop(0, "rgba(255, 255, 255, 0.92)");
    ao.addColorStop(0.28, "rgba(255, 255, 255, 0.58)");
    ao.addColorStop(0.56, "rgba(255, 255, 255, 0.18)");
    ao.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = ao;
    context.fillRect(0, 0, canvas.width, canvas.height);
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
    color: "#2d2d2a",
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
  floor.position.y = -0.82;
  floor.renderOrder = 0;
  floor.receiveShadow = true;
  group.add(floor);

  const contactAoMaterial = new THREE.MeshBasicMaterial({
    alphaMap: contactAoTexture,
    color: "#000000",
    depthWrite: false,
    opacity: defaultViewerSettings.aoIntensity,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    transparent: true,
  });
  const contactAo = new THREE.Mesh(
    new THREE.PlaneGeometry(5.9, 2.6),
    contactAoMaterial,
  );
  contactAo.rotation.x = -Math.PI / 2;
  contactAo.position.set(0, -0.812, 0.16);
  contactAo.renderOrder = 1;
  group.add(contactAo);

  const floorGlowMaterial = new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    map: floorGlowTexture,
    opacity: defaultViewerSettings.floorGlow,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
    transparent: true,
  });
  const floorGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(8.4, 3.7),
    floorGlowMaterial,
  );
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.set(0, -0.816, 0.2);
  floorGlow.renderOrder = 2;
  group.add(floorGlow);

  const stageRingRadius = 1.72;
  const stageRingMaterial = new THREE.MeshBasicMaterial({
    color: "#c7a550",
    depthWrite: false,
    opacity: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const stageRing = new THREE.Mesh(
    new THREE.RingGeometry(stageRingRadius, stageRingRadius + 0.028, 192),
    stageRingMaterial,
  );
  stageRing.rotation.x = -Math.PI / 2;
  stageRing.position.y = -0.808;
  stageRing.renderOrder = 3;
  group.add(stageRing);

  const stageRingHighlight = new THREE.Mesh(
    new THREE.RingGeometry(stageRingRadius - 0.004, stageRingRadius + 0.05, 96, 1, 0, Math.PI * 0.34),
    new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: "#f2d982",
      depthWrite: false,
      opacity: 0.13,
      polygonOffset: true,
      polygonOffsetFactor: -5,
      polygonOffsetUnits: -5,
      side: THREE.DoubleSide,
      transparent: true,
    }),
  );
  stageRingHighlight.rotation.x = -Math.PI / 2;
  stageRingHighlight.position.y = -0.806;
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
    contactAoMaterial,
    floorGlowMaterial,
    floorMaterial,
    group,
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
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  const colorValue = /^#[0-9a-f]{6}$/i.test(value) ? value : defaultViewerSettings.environmentColor;

  const updateHexValue = (nextValue: string) => {
    const trimmedValue = nextValue.trim();
    const nextDraft = trimmedValue.startsWith("#") ? trimmedValue : `#${trimmedValue}`;

    if (/^#[0-9a-f]{6}$/i.test(nextDraft)) {
      onChange(nextDraft.toUpperCase());
    }
  };

  return (
    <div className="studio-color-control">
      <span>
        <em>Environment Color</em>
        <strong>{colorValue.toUpperCase()}</strong>
      </span>
      <label className="studio-color-picker">
        <input
          aria-label="Environment color palette"
          onChange={(event) => onChange(event.currentTarget.value)}
          type="color"
          value={colorValue}
        />
        <input
          aria-label="Environment color hex value"
          defaultValue={colorValue.toUpperCase()}
          key={colorValue}
          maxLength={7}
          onBlur={(event) => {
            if (!/^#[0-9a-f]{6}$/i.test(event.currentTarget.value)) {
              event.currentTarget.value = colorValue.toUpperCase();
            }
          }}
          onChange={(event) => updateHexValue(event.currentTarget.value)}
          spellCheck={false}
          type="text"
        />
      </label>
    </div>
  );
}

function BikeScene({
  config,
  focus,
  viewerSettings,
}: {
  config: ConfigState;
  focus: string;
  viewerSettings: ViewerSettings;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const bikeRef = useRef<THREE.Group | null>(null);
  const frameMorphMeshesRef = useRef<THREE.Mesh[]>([]);
  const sizeRef = useRef(config.size);
  const viewerSettingsRef = useRef(viewerSettings);
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
  const targetCameraRef = useRef(new THREE.Vector3(startupCameraX, 1.12, startupCameraDistance));
  const targetLookRef = useRef(new THREE.Vector3(0, 1.1, 0));
  const lookRef = useRef(new THREE.Vector3(0, 1.1, 0));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050505");
    scene.fog = new THREE.Fog("#050505", 7.5, 16);
    sceneRef.current = scene;

    const initialSettings = viewerSettingsRef.current;
    const camera = new THREE.PerspectiveCamera(initialSettings.cameraFov, 1, 0.1, 100);
    camera.position.set(startupCameraX, 1.12, startupCameraDistance);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    rendererRef.current = renderer;
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
    scene.environment = environmentMap;
    scene.environmentIntensity = initialSettings.environmentIntensity;
    scene.environmentRotation.y = THREE.MathUtils.degToRad(initialSettings.environmentRotation);
    studioEnvironment.dispose();
    pmremGenerator.dispose();

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

    const replaceBike = (nextBike: THREE.Group) => {
      if (bikeRef.current) {
        scene.remove(bikeRef.current);
        disposeObject(bikeRef.current);
      }

      bikeRef.current = nextBike;
      modelMaterialsRef.current = collectModelMaterials(nextBike);
      applyModelAmbientOcclusion(modelMaterialsRef.current, viewerSettingsRef.current.modelAoIntensity);
      scene.add(nextBike);
    };

    let cancelled = false;
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(publicAsset("draco/gltf/"));

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    loader.load(
      bikeModelUrl,
      (gltf) => {
        if (cancelled) {
          return;
        }

        const { camera: assetCamera, group, look } = prepareViewportModel(
          gltf.scene,
          renderer.capabilities.getMaxAnisotropy(),
        );
        modelLoadedRef.current = true;
        fallbackRef.current = false;
        assetCameraRef.current = { camera: assetCamera, look };
        targetCameraRef.current.copy(assetCamera);
        targetLookRef.current.copy(look);
        lookRef.current.copy(look);
        camera.position.copy(assetCamera);
        controls.target.copy(look);
        controls.update();
        frameMorphMeshesRef.current = collectFrameMorphMeshes(group);
        applyFrameSizeMorph(frameMorphMeshesRef.current, sizeRef.current);
        replaceBike(group);
      },
      undefined,
      () => {
        if (cancelled) {
          return;
        }

        fallbackRef.current = true;
        frameMorphMeshesRef.current = [];
        replaceBike(buildBike(defaultConfig, "default"));
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

      if (controlsRef.current) {
        controlsRef.current.update();
      } else if (activeCamera) {
        activeCamera.position.lerp(targetCameraRef.current, 0.065);
        lookRef.current.lerp(targetLookRef.current, 0.07);
        activeCamera.lookAt(lookRef.current);
      }

      studioSurfaces.stageRingHighlight.rotation.z = elapsed * 0.22;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      if (bikeRef.current) {
        disposeObject(bikeRef.current);
      }
      disposeObject(studioSurfaces.group);
      frameMorphMeshesRef.current = [];
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
      controls.dispose();
      controlsRef.current = null;
      dracoLoader.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      scene.clear();
    };
  }, []);

  useEffect(() => {
    sizeRef.current = config.size;
    applyFrameSizeMorph(frameMorphMeshesRef.current, config.size);
  }, [config.size]);

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
    const environmentColor = new THREE.Color(viewerSettings.environmentColor);
    if (scene) {
      scene.environmentIntensity = viewerSettings.environmentIntensity;
      scene.environmentRotation.y = THREE.MathUtils.degToRad(viewerSettings.environmentRotation);
      scene.background = getTintedColor("#050505", viewerSettings.environmentColor, 0.055);

      if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.copy(getTintedColor("#050505", viewerSettings.environmentColor, 0.12));
      }
    }

    if (ambientLightRef.current) {
      ambientLightRef.current.color.copy(getTintedColor("#f7f1e4", viewerSettings.environmentColor, 0.12));
      ambientLightRef.current.intensity = viewerSettings.ambientIntensity;
    }

    if (keyLightRef.current) {
      keyLightRef.current.intensity = viewerSettings.keyIntensity;
      keyLightRef.current.castShadow = viewerSettings.shadows;
      keyLightRef.current.shadow.blurSamples = viewerSettings.vsmBlurSamples;
      keyLightRef.current.shadow.needsUpdate = true;
    }

    if (fillLightRef.current) {
      fillLightRef.current.color.copy(getTintedColor("#f7f1e4", viewerSettings.environmentColor, 0.18));
      fillLightRef.current.intensity = viewerSettings.fillIntensity;
    }

    if (rimLightRef.current) {
      rimLightRef.current.color.copy(getTintedColor("#f1413c", viewerSettings.environmentColor, 0.25));
      rimLightRef.current.intensity = viewerSettings.rimIntensity;
    }

    applyModelAmbientOcclusion(modelMaterialsRef.current, viewerSettings.modelAoIntensity);

    if (floorMaterialRef.current) {
      floorMaterialRef.current.color.copy(getTintedColor("#2d2d2a", viewerSettings.environmentColor, 0.08));
      floorMaterialRef.current.needsUpdate = true;
    }

    if (floorGlowMaterialRef.current) {
      floorGlowMaterialRef.current.color.copy(environmentColor);
      floorGlowMaterialRef.current.opacity = viewerSettings.floorGlow;
    }

    if (contactAoMaterialRef.current) {
      contactAoMaterialRef.current.opacity = viewerSettings.aoIntensity;
    }

    if (backdropMaterialRef.current) {
      backdropMaterialRef.current.color.copy(getTintedColor("#ffffff", viewerSettings.environmentColor, 0.16));
      backdropMaterialRef.current.opacity = viewerSettings.backdropGlow;
    }

    if (stageRingMaterialRef.current) {
      stageRingMaterialRef.current.color.copy(environmentColor);
    }

    if (stageRingHighlightMaterialRef.current) {
      stageRingHighlightMaterialRef.current.color.copy(getTintedColor("#ffffff", viewerSettings.environmentColor, 0.72));
    }

    if (cameraRef.current) {
      cameraRef.current.fov = viewerSettings.cameraFov;
      cameraRef.current.updateProjectionMatrix();
    }
  }, [viewerSettings]);

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
      default: [new THREE.Vector3(startupCameraX, 1.12, startupCameraDistance), new THREE.Vector3(startupCameraX, 1.05, 0)],
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
    <div className="bike-stage" ref={containerRef} />
  );
}

export default function ConfiguratorClient() {
  const [activeStep, setActiveStep] = useState<StepId>("components");
  const [config, setConfig] = useState<ConfigState>(defaultConfig);
  const [editingGroup, setEditingGroup] = useState<ComponentKey | null>(null);
  const [status, setStatus] = useState("");
  const [viewerSettings, setViewerSettings] = useState<ViewerSettings>(defaultViewerSettings);

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
  const focus =
    activeStep === "components"
      ? getFocusForGroup(editingGroup)
      : activeStep === "size"
        ? "default"
        : activeStep === "summary"
          ? "default"
          : "default";

  const summaryRows = [
    ["Model", modelName],
    ["Graphic", paint.name],
    ["Finish", paint.finish],
    ["Size", getSizeLabel(config.size)],
    ...componentGroups.map((group) => [
      group.label,
      getComponent(group, config.components[group.key]).name,
    ]),
  ];

  const configSeed = JSON.stringify(config);

  const buildCards = [
    {
      id: "frame",
      label: "Frame",
      value: getSizeLabel(config.size),
      meta: `${modelName} Disc`,
      thumb: "frame",
      onClick: () => {
        setEditingGroup(null);
        setActiveStep("size");
      },
    },
    ...componentGroups
      .filter((group) => ["groupset", "wheel", "cockpit", "saddle"].includes(group.key))
      .map((group) => {
        const selected = getComponent(group, config.components[group.key]);

        return {
          id: group.key,
          label: group.label === "Wheel" ? "Wheels" : group.label,
          value: selected.name,
          meta: selected.priceDelta ? `+${formatter.format(selected.priceDelta)}` : "Included",
          thumb: group.key,
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

    if (group.key === "groupset" && optionId === "sram-force-axs") {
      setConfig((current) => ({
        ...current,
        components: {
          ...current.components,
          crankset:
            current.components.crankset === "power-meter"
              ? current.components.crankset
              : "semi-compact-52-36",
        },
      }));
    }
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
    setViewerSettings((current) => ({
      ...current,
      environmentColor,
    }));
  };

  const nextStep = () => {
    if (editingGroup) {
      setEditingGroup(null);
      return;
    }

    if (activeStep === "summary") {
      setStatus("Cart payload ready for Fynd Commerce.");
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

  const openRailItem = (id: string) => {
    setStatus("");

    if (id === "paint") {
      setEditingGroup(null);
      setActiveStep("graphic");
      return;
    }

    if (id === "frame") {
      setEditingGroup(null);
      setActiveStep("size");
      return;
    }

    if (id === "components") {
      setEditingGroup(null);
      setActiveStep("components");
      return;
    }

    setActiveStep("components");
    setEditingGroup(id as ComponentKey);
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

  const saveConfiguration = () => {
    const encoded = window.btoa(configSeed);
    window.localStorage.setItem("ribble-glamar-config", configSeed);
    setStatus(`Saved configuration ${encoded.slice(0, 12)}.`);
  };

  return (
    <main className="configurator-shell">
      <section className="studio-area" aria-label="3D cycle preview">
        <BikeScene config={config} focus={focus} viewerSettings={viewerSettings} />

        <header className="brand-block">
          <div className="brand-wordmark glamar-wordmark" aria-label="Fynd GlamAR">
            {/* Static GitHub Pages build cannot use next/image here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={publicAsset("fynd-glamar-logo.svg")} alt="Fynd GlamAR" width={180} height={30} />
          </div>
        </header>

        <nav className="side-rail" aria-label="Build categories">
          {railItems.map((item) => {
            const active =
              (item.id === "paint" && activeStep === "graphic") ||
              (item.id === "frame" && activeStep === "size") ||
              item.id === editingGroup ||
              (item.id === "components" && activeStep === "components" && !editingGroup);

            return (
              <button
                className={active ? "active" : ""}
                key={item.id}
                onClick={() => openRailItem(item.id)}
                type="button"
              >
                <span className={`rail-icon ${item.id}-icon`}>
                  {item.id === "frame" && (
                    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
                      <path d="M4.5 17.5h6.2l5.4-9H8.2L4.5 17.5Z" />
                      <path d="M8.2 8.5l2.5 9 5.4-9 3.4 9h-8.8" />
                      <circle cx="10.7" cy="17.5" r="1.35" />
                    </svg>
                  )}
                </span>
                <small>{item.label}</small>
              </button>
            );
          })}
        </nav>

        <div className="help-card">
          <span className="help-icon" />
          <strong>Need Help?</strong>
          <small>Chat with an expert</small>
        </div>
      </section>

      <aside className="control-panel" aria-label="Ribble cycle configurator">
        <header className="panel-header">
          <span>{modelName}</span>
          <button type="button" aria-label="Select model">
            v
          </button>
        </header>

        <nav className="stage-tabs" aria-label="Configuration stages">
          <button
            className={activeStage === "build" ? "active" : ""}
            onClick={() => setStage("build")}
            type="button"
          >
            1. Build
          </button>
          <button
            className={activeStage === "style" ? "active" : ""}
            onClick={() => setStage("style")}
            type="button"
          >
            2. Style
          </button>
          <button
            className={activeStage === "review" ? "active" : ""}
            onClick={() => setStage("review")}
            type="button"
          >
            3. Review
          </button>
          <button
            className={activeStage === "studio" ? "active" : ""}
            onClick={() => setStage("studio")}
            type="button"
          >
            4. Studio
          </button>
        </nav>

        <div className="panel-body">
          {activeStage === "build" && !editingGroup && activeStep !== "size" && (
            <section className="build-list" aria-label="Build selections">
              {buildCards.map((card) => (
                <button
                  className="build-card"
                  key={card.id}
                  onClick={card.onClick}
                  type="button"
                >
                  <span className={`part-thumb ${card.thumb}-thumb`} />
                  <span>
                    <strong>{card.label}</strong>
                    <small>{card.value}</small>
                  </span>
                  <em>{card.meta}</em>
                  <i className="edit-icon" />
                </button>
              ))}

              <article className="paint-card">
                <div>
                  <strong>Paint & Decals</strong>
                  <small>{paint.name}</small>
                </div>
                <div className="compact-swatches">
                  {paintOptions.map((option) => (
                    <button
                      aria-label={option.name}
                      className={config.paint === option.id ? "selected" : ""}
                      key={option.id}
                      onClick={() => setConfig((current) => ({ ...current, paint: option.id }))}
                      style={{
                        background: `linear-gradient(135deg, ${option.frame} 0 48%, ${option.accent} 48% 64%, ${option.decal} 64%)`,
                      }}
                      type="button"
                    />
                  ))}
                </div>
              </article>
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
                      background: `linear-gradient(135deg, ${option.frame} 0 48%, ${option.accent} 48% 64%, ${option.decal} 64%)`,
                    }}
                    title={option.name}
                    type="button"
                  />
                ))}
              </div>
              <div className="detail-strip">
                <span>Finish</span>
                <strong>{paint.finish}</strong>
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

          {activeStep === "components" && !editingGroup && (
            <section className="component-list" aria-label="Component groups">
              {componentGroups.map((group) => {
                const selected = getComponent(group, config.components[group.key]);

                return (
                  <button
                    className="component-row"
                    key={group.key}
                    onClick={() => setEditingGroup(group.key)}
                    type="button"
                  >
                    <span>
                      <strong>{group.label}</strong>
                      <small>{selected.name}</small>
                    </span>
                    <em>{selected.priceDelta ? `+${formatter.format(selected.priceDelta)}` : "Included"}</em>
                  </button>
                );
              })}
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
                      Back to {group.label}
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
                            <i />
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
                <p>Environment</p>
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
                <StudioColorPalette
                  onChange={updateViewerColor}
                  value={viewerSettings.environmentColor}
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
                  label="AO"
                  max={1}
                  min={0}
                  onChange={(value) => updateViewerNumber("aoIntensity", value)}
                  step={0.01}
                  value={viewerSettings.aoIntensity}
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
                    : "Next ->"}
            </button>
          </div>
        </footer>
        <div className="panel-actions">
          <button onClick={saveConfiguration} type="button">
            Save Build
          </button>
          <button onClick={() => setStatus("Share payload ready.")} type="button">
            Share
          </button>
        </div>
        {status && <p className="status-line">{status}</p>}
      </aside>

    </main>
  );
}
