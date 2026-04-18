import { type Viewer } from "cesium";
import { applyAtmosphereBaseline } from "./atmosphere";
import { applyStarBackground } from "./star-background";

export type SkyMode = "blue" | "space";
export interface SkyModeController {
  dispose(): void;
  getMode(): SkyMode;
  setMode(mode: SkyMode): void;
}

const SKY_BLUE_ICON = `
<svg class="viewer-sky-toggle-icon" viewBox="0 0 32 32" aria-hidden="true">
  <circle cx="22" cy="11" r="4.5" />
  <path d="M7.5 23.5h15a4.5 4.5 0 0 0 0-9 6.5 6.5 0 0 0-12.38-1.82A4.2 4.2 0 0 0 7.5 23.5Z" />
</svg>
`;

const SKY_SPACE_ICON = `
<svg class="viewer-sky-toggle-icon" viewBox="0 0 32 32" aria-hidden="true">
  <path d="M18.5 6.5c-4.6.9-8 4.97-8 9.75 0 5.44 4.4 9.85 9.85 9.85 2.67 0 5.09-1.05 6.88-2.77-1 .2-2.04.31-3.11.31-8.03 0-14.55-6.52-14.55-14.55 0-.88.08-1.74.23-2.59 2.04-1.65 4.64-2.64 7.47-2.64.4 0 .82.03 1.23.09Z" />
  <path d="M9 7.5v3" />
  <path d="M7.5 9h3" />
  <path d="M24.5 7v2" />
  <path d="M23.5 8h2" />
  <path d="M25.5 15.5v1.5" />
  <path d="M24.75 16.25h1.5" />
</svg>
`;

function setButtonLabel(button: HTMLButtonElement, mode: SkyMode): void {
  button.dataset.skyMode = mode;
  button.innerHTML = mode === "blue" ? SKY_BLUE_ICON : SKY_SPACE_ICON;
  button.ariaPressed = String(mode === "space");
  button.ariaLabel = mode === "blue" ? "Switch to space sky" : "Switch to blue sky";
  button.title = mode === "blue" ? "Switch to space sky" : "Switch to blue sky";
}

export function setSkyMode(viewer: Viewer, mode: SkyMode): void {
  const { scene } = viewer;
  const { globe } = scene;

  applyStarBackground(viewer);

  if (mode === "space") {
    globe.showGroundAtmosphere = false;
    if (scene.skyAtmosphere) {
      scene.skyAtmosphere.show = false;
    }
    scene.requestRender();
    return;
  }

  applyAtmosphereBaseline(viewer);
  scene.requestRender();
}

function getToolbar(viewer: Viewer): HTMLElement | null {
  return viewer.container.querySelector<HTMLElement>(".cesium-viewer-toolbar");
}

function getInsertBeforeNode(toolbar: HTMLElement): ChildNode | null {
  const lightingButton = toolbar.querySelector<HTMLElement>("[data-lighting-toggle='true']");
  if (lightingButton) {
    return lightingButton;
  }

  const geocoderContainer = toolbar.querySelector(".cesium-viewer-geocoderContainer");
  if (!(geocoderContainer instanceof HTMLElement)) {
    return toolbar.firstChild;
  }

  return geocoderContainer.nextElementSibling;
}

export function mountSkyModeToggle(viewer: Viewer): SkyModeController {
  const toolbar = getToolbar(viewer);
  let mode: SkyMode = "blue";
  const button = toolbar ? document.createElement("button") : null;

  const applyMode = (nextMode: SkyMode) => {
    mode = nextMode;
    setSkyMode(viewer, mode);
    if (button) {
      setButtonLabel(button, mode);
    }
  };

  applyMode(mode);

  if (button && toolbar) {
    button.type = "button";
    button.className = "cesium-button cesium-toolbar-button viewer-sky-toggle";
    button.dataset.skyToggle = "true";

    const handleClick = () => {
      applyMode(mode === "blue" ? "space" : "blue");
    };

    button.addEventListener("click", handleClick);
    toolbar.insertBefore(button, getInsertBeforeNode(toolbar));

    return {
      dispose(): void {
        button.removeEventListener("click", handleClick);
        button.remove();
      },
      getMode(): SkyMode {
        return mode;
      },
      setMode(nextMode: SkyMode): void {
        applyMode(nextMode);
      }
    };
  }

  return {
    dispose(): void {},
    getMode(): SkyMode {
      return mode;
    },
    setMode(nextMode: SkyMode): void {
      applyMode(nextMode);
    }
  };
}
