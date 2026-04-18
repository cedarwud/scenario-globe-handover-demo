import { Viewer } from "cesium";
import { applyCameraLanguage } from "../../features/globe/camera-language";
import { applyLightingBaseline } from "../../features/globe/lighting";
import { resolveImagerySelection } from "../../features/globe/offline-imagery";
import { resolveTerrainSelection } from "../../features/globe/offline-terrain";

export interface ViewerElements {
  container: Element | string;
  creditContainer?: Element | string;
  creditViewport?: Element | string;
}

export function createViewer({
  container,
  creditContainer,
  creditViewport
}: ViewerElements): Viewer {
  const imagerySelection = resolveImagerySelection();
  const terrainSelection = resolveTerrainSelection();

  // Keep the runtime on Cesium's higher-level Viewer shell and preserve its
  // native controls, imagery, terrain, and credits by default. Only override
  // providers when this repo is explicitly configured to do so.
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/offline/main.js:10-17
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/widgets/Source/Viewer/Viewer.js:280-290
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/widgets/Source/Viewer/Viewer.js:316-317
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/widgets/Source/Viewer/Viewer.js:332-339
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/widgets/Source/Viewer/Viewer.js:500-503
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/widgets/Source/Viewer/Viewer.js:396-404
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/widgets/Specs/Viewer/ViewerSpec.js:85-117
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/widgets/Specs/Viewer/ViewerSpec.js:146-151
  const viewer = new Viewer(container, {
    creditContainer,
    creditViewport,
    ...imagerySelection,
    ...terrainSelection
  });

  applyLightingBaseline(viewer);
  applyCameraLanguage(viewer);

  return viewer;
}
