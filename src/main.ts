import { initializeCesiumBootstrap } from "./core/cesium/bootstrap";
import { createViewer } from "./core/cesium/viewer-factory";
import { mountAppShell } from "./features/app/app-shell";
import {
  createHandoverFocusDemoController
} from "./features/demo/handover-focus-demo";
import {
  createSyntheticConstellationRuntime
} from "./features/demo/synthetic-constellation";
import { refreshLightingForSceneMode } from "./features/globe/lighting";
import { mountLightingToggle } from "./features/globe/lighting-toggle";
import { mountNtpuShortcut } from "./features/globe/ntpu-shortcut";
import { mountOptionalOsmBuildingsShowcase } from "./features/globe/osm-buildings-showcase";
import { mountSkyModeToggle } from "./features/globe/sky-mode";
import "./styles.css";

type BootstrapState = "booting" | "ready" | "error";

function setBootstrapState(state: BootstrapState, detail?: string): void {
  document.documentElement.dataset.bootstrapState = state;

  if (detail) {
    document.documentElement.dataset.bootstrapDetail = detail.slice(0, 240);
  } else {
    delete document.documentElement.dataset.bootstrapDetail;
  }
}

function serializeBootstrapError(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }

  if (typeof reason === "string") {
    return reason;
  }

  try {
    return JSON.stringify(reason);
  } catch {
    return "Unknown bootstrap error";
  }
}

setBootstrapState("booting");

window.addEventListener("error", (event) => {
  setBootstrapState("error", serializeBootstrapError(event.error ?? event.message));
});

window.addEventListener("unhandledrejection", (event) => {
  setBootstrapState("error", serializeBootstrapError(event.reason));
});

initializeCesiumBootstrap();

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root");
}

const shell = mountAppShell(app);
const viewer = createViewer({ container: shell.viewerRoot });
viewer.clock.shouldAnimate = true;
viewer.clock.multiplier = 36;

const constellation = createSyntheticConstellationRuntime(viewer);
const unmountLightingToggle = mountLightingToggle(viewer);
const skyMode = mountSkyModeToggle(viewer);
const handoverDemo = createHandoverFocusDemoController({
  constellation,
  onSelectSite: () => {
    skyMode.setMode("space");
  },
  shell,
  viewer
});
const removeHomeResetListener = viewer.homeButton?.viewModel.command.beforeExecute.addEventListener(() => {
  handoverDemo.clearSiteFocus({ cancelFlight: false });
  skyMode.setMode("blue");
});
const unmountNtpuShortcut = mountNtpuShortcut(viewer, handoverDemo, skyMode);
const removeMorphCompleteListener = viewer.scene.morphComplete.addEventListener(() => {
  refreshLightingForSceneMode(viewer);
});
const removeImageryLayerAddedListener = viewer.imageryLayers.layerAdded.addEventListener(() => {
  refreshLightingForSceneMode(viewer);
});
const removeImageryLayerRemovedListener = viewer.imageryLayers.layerRemoved.addEventListener(() => {
  refreshLightingForSceneMode(viewer);
});

setBootstrapState("ready");

// Keep bootstrap success tied to the native viewer shell and local demo seams.
// OSM Buildings remain a best-effort visual layer that can load, degrade, or
// fail independently without flipping the app out of the ready state.
const unmountOsmBuildingsShowcase = mountOptionalOsmBuildingsShowcase(viewer);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    removeImageryLayerRemovedListener();
    removeImageryLayerAddedListener();
    removeMorphCompleteListener();
    unmountOsmBuildingsShowcase();
    unmountNtpuShortcut();
    removeHomeResetListener?.();
    skyMode.dispose();
    unmountLightingToggle();
    void handoverDemo.dispose();
    void constellation.dispose();
    viewer.destroy();
  });
}
