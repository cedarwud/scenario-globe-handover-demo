import { SkyBox, type Viewer } from "cesium";

export function applyStarBackground(viewer: Viewer): void {
  const { scene } = viewer;

  // Keep the sky on Cesium's upstream Earth sky box instead of a repo-local
  // texture system or a pure background-color fallback.
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/mars/main.js:4-12
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/google-streetview-panorama/main.js:264-268
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/scene-rendering-performance/main.js:34-41
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/SkyBox.js:139-158
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/Scene.js:284-334
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Specs/Scene/SkyBoxSpec.js:33-47
  scene.skyBox = SkyBox.createEarthSkyBox();
}
