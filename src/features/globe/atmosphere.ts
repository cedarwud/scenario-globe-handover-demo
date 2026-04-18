import type { Viewer } from "cesium";

export function applyAtmosphereBaseline(viewer: Viewer): void {
  const { scene } = viewer;
  const { globe } = scene;
  const skyAtmosphere = scene.skyAtmosphere;

  // Keep the first globe-quality step on Cesium's built-in atmosphere path
  // instead of inventing a custom render layer.
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/atmosphere/main.js:6-10
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/atmosphere/main.js:60-97
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/Globe.js:191-246
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/SkyAtmosphere.js:51-154
  globe.showGroundAtmosphere = true;
  globe.atmosphereLightIntensity = 13.0;
  globe.atmosphereRayleighCoefficient.x = 6.0e-6;
  globe.atmosphereRayleighCoefficient.y = 13.8e-6;
  globe.atmosphereRayleighCoefficient.z = 29.6e-6;
  globe.atmosphereRayleighScaleHeight = 11000.0;
  globe.atmosphereMieScaleHeight = 3600.0;
  globe.atmosphereSaturationShift = 0.12;
  globe.atmosphereBrightnessShift = -0.08;

  if (!skyAtmosphere) {
    return;
  }

  skyAtmosphere.show = true;
  skyAtmosphere.perFragmentAtmosphere = true;
  skyAtmosphere.atmosphereLightIntensity = 45.0;
  skyAtmosphere.atmosphereRayleighCoefficient.x = 5.8e-6;
  skyAtmosphere.atmosphereRayleighCoefficient.y = 13.4e-6;
  skyAtmosphere.atmosphereRayleighCoefficient.z = 29.0e-6;
  skyAtmosphere.atmosphereRayleighScaleHeight = 11000.0;
  skyAtmosphere.atmosphereMieScaleHeight = 3600.0;
  skyAtmosphere.saturationShift = 0.1;
  skyAtmosphere.brightnessShift = -0.12;
}
