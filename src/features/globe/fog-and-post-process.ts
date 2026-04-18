import type { Viewer } from "cesium";

export function applyFogAndPostProcessBaseline(viewer: Viewer): void {
  const { scene } = viewer;
  const { fog } = scene;
  const bloom = scene.postProcessStages.bloom;

  // Stay on Cesium's built-in fog model and bloom stage instead of adding a
  // repo-local post-process chain.
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/fog/main.js:20-64
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/mars/main.js:37-40
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/Fog.js:11-164
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/PostProcessStageCollection.js:32-56
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Specs/Scene/FogSpec.js:18-58
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Specs/Scene/PostProcessStageCollectionSpec.js:13-31
  fog.enabled = true;
  fog.density = 7.0e-4;
  fog.visualDensityScalar = 0.3;
  fog.heightScalar = 0.0015;
  fog.heightFalloff = 0.4;
  fog.maxHeight = 15_000_000.0;
  fog.minimumBrightness = 0.05;

  bloom.enabled = true;
  bloom.uniforms.brightness = 0.15;
  bloom.uniforms.stepSize = 2.0;
}
