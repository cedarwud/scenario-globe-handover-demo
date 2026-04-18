import { Ion, buildModuleUrl } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

type BuildModuleUrlWithSetter = typeof buildModuleUrl & {
  setBaseUrl(value: string): void;
};

function readCesiumBaseUrl(): string {
  const baseUrl = window.CESIUM_BASE_URL;

  if (!baseUrl) {
    throw new Error("Missing window.CESIUM_BASE_URL before Cesium bootstrap");
  }

  return baseUrl;
}

function readCesiumIonToken(): string | undefined {
  const rawToken = import.meta.env.VITE_CESIUM_ION_TOKEN?.trim();

  return rawToken ? rawToken : undefined;
}

export function initializeCesiumBootstrap(): void {
  const baseUrl = readCesiumBaseUrl();
  const ionToken = readCesiumIonToken();
  const buildModuleUrlWithSetter = buildModuleUrl as BuildModuleUrlWithSetter;

  // Reserve Cesium's shared module base URL before the first Viewer exists so
  // native assets, workers, and provider catalogs stay on the upstream runtime
  // path regardless of which deployment profile is active.
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Core/buildModuleUrl.js:42-46
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Core/buildModuleUrl.js:139-143
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Specs/Core/buildModuleUrlSpec.js:42-70
  // The installed Cesium runtime exposes setBaseUrl even though the published
  // type surface omits it.
  // Evidence: /home/u24/papers/scenario-globe-handover-demo/node_modules/@cesium/engine/Source/Core/buildModuleUrl.js:139-143
  // Evidence: /home/u24/papers/scenario-globe-handover-demo/node_modules/cesium/Source/Cesium.d.ts:18692
  buildModuleUrlWithSetter.setBaseUrl(baseUrl);

  if (ionToken) {
    // Cesium only emits the default-token warning when requests still use the
    // bundled demo token; overriding Ion.defaultAccessToken before Viewer
    // startup keeps the same ion-backed runtime path without that warning.
    // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Core/Ion.js:29-54
    // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Core/IonResource.js:233-240
    // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Specs/Core/IonResourceSpec.js:164-176
    Ion.defaultAccessToken = ionToken;
  }
}
