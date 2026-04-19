import { Cartesian3, type Viewer } from "cesium";
import type { HandoverFocusDemoController } from "../demo/handover-focus-demo";
import type { SkyModeController } from "./sky-mode";

const NTPU_ICON = `
<svg class="viewer-ntpu-shortcut-icon" viewBox="0 0 32 32" aria-hidden="true">
  <path d="M16 27.5s-6.75-6.3-6.75-12.75a6.75 6.75 0 1 1 13.5 0C22.75 21.2 16 27.5 16 27.5Z" />
  <circle cx="16" cy="14.75" r="2.9" />
</svg>
`;

const NTPU_SITE = {
  altitudeM: 50,
  latitudeDeg: 24.94004,
  longitudeDeg: 121.37136
} as const;

function getToolbar(viewer: Viewer): HTMLElement | null {
  return viewer.container.querySelector<HTMLElement>(".cesium-viewer-toolbar");
}

function getInsertBeforeNode(toolbar: HTMLElement): ChildNode | null {
  const lightingButton = toolbar.querySelector<HTMLElement>("[data-lighting-toggle='true']");
  if (lightingButton) {
    return lightingButton.nextSibling;
  }

  return null;
}

export function mountNtpuShortcut(
  viewer: Viewer,
  handoverDemo: HandoverFocusDemoController,
  skyMode: SkyModeController
): () => void {
  const toolbar = getToolbar(viewer);
  if (!toolbar) {
    return () => {};
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "cesium-button cesium-toolbar-button viewer-ntpu-shortcut";
  button.dataset.ntpuShortcut = "true";
  button.ariaLabel = "Place UE anchor at NTPU preset";
  button.title = "Place UE anchor at NTPU preset";
  button.innerHTML = NTPU_ICON;

  const handleClick = () => {
    skyMode.setMode("space");
    handoverDemo.placeUeAnchorAt(
      Cartesian3.fromDegrees(
        NTPU_SITE.longitudeDeg,
        NTPU_SITE.latitudeDeg,
        NTPU_SITE.altitudeM
      ),
      {
        displayName: "National Taipei University, Taiwan",
        transition: "fly"
      }
    );
  };

  button.addEventListener("click", handleClick);
  toolbar.insertBefore(button, getInsertBeforeNode(toolbar));

  return () => {
    button.removeEventListener("click", handleClick);
    button.remove();
  };
}
