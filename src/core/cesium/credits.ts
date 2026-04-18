export interface CreditElements {
  container: HTMLDivElement;
  viewport: HTMLElement;
}

export function resolveCreditElements(root: ParentNode): CreditElements {
  const container = root.querySelector<HTMLDivElement>("[data-credit-container]");
  const viewport = root.querySelector<HTMLElement>("[data-credit-viewport]");

  if (!container) {
    throw new Error("Missing credit container");
  }

  if (!viewport) {
    throw new Error("Missing credit viewport");
  }

  // Keep attribution inside repo-owned DOM slots while still routing the
  // actual credit rendering through Cesium's CreditDisplay pipeline.
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/3d-tiles-nga-gpm-visualization/main.js:4-14
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/widgets/Source/Viewer/Viewer.js:316-317
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/widgets/Source/Viewer/Viewer.js:500-503
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/CreditDisplay.js:284-347
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Specs/Scene/CreditDisplaySpec.js:111-125
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Specs/Scene/CreditDisplaySpec.js:535-558
  return { container, viewport };
}
