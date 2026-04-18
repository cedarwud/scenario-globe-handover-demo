import {
  DynamicAtmosphereLightingType,
  SceneMode,
  type ImageryLayer,
  type Viewer
} from "cesium";

const DEFAULT_SUN_GLOW_FACTOR = 1.0;
const FLATTENED_LIGHTS_OFF_BRIGHTNESS_MULTIPLIER = 1.18;
const FLATTENED_LIGHTS_OFF_CONTRAST_MULTIPLIER = 1.03;
const FLATTENED_LIGHTS_OFF_GAMMA_MULTIPLIER = 1.08;

interface ImageryLayerVisualBaseline {
  brightness: number;
  contrast: number;
  gamma: number;
}

const originalImageryVisuals = new WeakMap<ImageryLayer, ImageryLayerVisualBaseline>();

function syncWaterEffect(viewer: Viewer, lightingEnabled: boolean): void {
  viewer.scene.globe.showWaterEffect = lightingEnabled;
}

function getImageryLayerBaseline(layer: ImageryLayer): ImageryLayerVisualBaseline | undefined {
  const brightness = layer.brightness;
  const contrast = layer.contrast;
  const gamma = layer.gamma;

  if (
    typeof brightness !== "number" ||
    typeof contrast !== "number" ||
    typeof gamma !== "number"
  ) {
    return undefined;
  }

  let baseline = originalImageryVisuals.get(layer);
  if (!baseline) {
    baseline = { brightness, contrast, gamma };
    originalImageryVisuals.set(layer, baseline);
  }

  return baseline;
}

function restoreImageryLayerBaseline(layer: ImageryLayer): void {
  const baseline = getImageryLayerBaseline(layer);
  if (!baseline) {
    return;
  }

  layer.brightness = baseline.brightness;
  layer.contrast = baseline.contrast;
  layer.gamma = baseline.gamma;
}

function syncFlattenedImageryCompensation(viewer: Viewer, lightingEnabled: boolean): void {
  const brightenFlattenedScene =
    !lightingEnabled &&
    (viewer.scene.mode === SceneMode.SCENE2D ||
      viewer.scene.mode === SceneMode.COLUMBUS_VIEW);

  // ImageryLayer exposes native brightness/contrast/gamma controls, so use the
  // base-layer path Cesium already supports instead of adding a repo-local post pass.
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/ImageryLayer.js:67-103
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/imagery-adjustment/main.js:20-46
  // Evidence: /home/u24/papers/scenario-globe-handover-demo/node_modules/@cesium/engine/Source/Scene/ImageryLayerCollection.js:28-36
  // Evidence: /home/u24/papers/scenario-globe-handover-demo/node_modules/@cesium/engine/Source/Scene/ImageryLayerCollection.js:114
  const { imageryLayers } = viewer;
  for (let index = 0; index < imageryLayers.length; index += 1) {
    const layer = imageryLayers.get(index);
    const baseline = getImageryLayerBaseline(layer);

    if (!baseline) {
      continue;
    }

    if (brightenFlattenedScene && index === 0) {
      layer.brightness =
        baseline.brightness * FLATTENED_LIGHTS_OFF_BRIGHTNESS_MULTIPLIER;
      layer.contrast =
        baseline.contrast * FLATTENED_LIGHTS_OFF_CONTRAST_MULTIPLIER;
      layer.gamma = baseline.gamma * FLATTENED_LIGHTS_OFF_GAMMA_MULTIPLIER;
      continue;
    }

    restoreImageryLayerBaseline(layer);
  }
}

export function isLightingEnabled(viewer: Viewer): boolean {
  return viewer.scene.globe.enableLighting;
}

export function setLightingEnabled(viewer: Viewer, enabled: boolean): void {
  const { scene } = viewer;
  const { atmosphere, globe, sun } = scene;
  globe.enableLighting = enabled;
  globe.dynamicAtmosphereLighting = enabled;
  globe.dynamicAtmosphereLightingFromSun = enabled;
  syncWaterEffect(viewer, enabled);
  syncFlattenedImageryCompensation(viewer, enabled);
  atmosphere.dynamicLighting = enabled
    ? DynamicAtmosphereLightingType.SUNLIGHT
    : DynamicAtmosphereLightingType.NONE;
  if (sun) {
    sun.show = enabled;
    sun.glowFactor = enabled ? DEFAULT_SUN_GLOW_FACTOR : 0.0;
  }
  scene.sunBloom = enabled;
  scene.requestRender();
}

export function refreshLightingForSceneMode(viewer: Viewer): void {
  const lightingEnabled = isLightingEnabled(viewer);
  syncWaterEffect(viewer, lightingEnabled);
  syncFlattenedImageryCompensation(viewer, lightingEnabled);
  viewer.scene.requestRender();
}

export function applyLightingBaseline(viewer: Viewer): void {
  // Use Cesium's built-in globe-lighting controls so the day-night boundary
  // comes from upstream scene lighting instead of a repo-local shadow system.
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/lighting/main.js:1-11
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/lighting/main.js:126-139
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/Globe.js:153-188
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Specs/Scene/DynamicAtmosphereLightingTypeSpec.js:3-42
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Specs/Scene/GlobeSpec.js:52-103
  setLightingEnabled(viewer, false);
}
