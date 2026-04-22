import { Cartesian3, type Viewer } from "cesium";
import type { HandoverFocusDemoController } from "./handover-focus-demo";
import { lookupLocalDensityByLatitude } from "./local-density-lookup";
import {
  NTPU_DISPLAY_NAME,
  NTPU_SITE
} from "../globe/ntpu-shortcut";
import type { SkyModeController } from "../globe/sky-mode";

const SMOKE_SCENARIO_QUERY_PARAM = "smokeScenario";
const LOCAL_FOCUS_REGRESSION_SCENARIO = "local-focus-regression";
const EXPECTED_NTPU_BACKGROUND_COUNT = String(
  lookupLocalDensityByLatitude(NTPU_SITE.latitudeDeg).suggestedBackgroundSatelliteCount
);

interface SmokeScenarioState {
  backgroundCount: string;
  handoverPhase: string;
  hoPanelActive: string;
  pending: string;
  serving: string;
  skyMode: string;
  uePanelActive: string;
}

function readSmokeScenarioSelection(): string | null {
  return new URLSearchParams(window.location.search).get(
    SMOKE_SCENARIO_QUERY_PARAM
  );
}

function setSmokeDatasetValue(key: string, value: string): void {
  document.documentElement.dataset[key] = value;
}

function readDemoState(): SmokeScenarioState {
  return {
    backgroundCount:
      document.querySelector("[data-demo-handover-panel]")?.getAttribute(
        "data-background-satellite-count"
      ) ?? "missing",
    handoverPhase:
      document
        .querySelector("[data-demo-handover-phase]")
        ?.textContent?.trim() ?? "missing",
    hoPanelActive:
      document.querySelector("[data-demo-handover-panel]")?.getAttribute(
        "data-active"
      ) ?? "missing",
    pending:
      document
        .querySelector("[data-demo-pending-satellite]")
        ?.textContent?.trim() ?? "missing",
    serving:
      document
        .querySelector("[data-demo-serving-satellite]")
        ?.textContent?.trim() ?? "missing",
    skyMode:
      document.querySelector("[data-sky-toggle]")?.getAttribute("data-sky-mode") ??
      "missing",
    uePanelActive:
      document.querySelector("[data-demo-ue-panel]")?.getAttribute("data-active") ??
      "missing"
  };
}

function recordState(prefix: string, state: SmokeScenarioState): void {
  setSmokeDatasetValue(`${prefix}BackgroundCount`, state.backgroundCount);
  setSmokeDatasetValue(`${prefix}HandoverPhase`, state.handoverPhase);
  setSmokeDatasetValue(`${prefix}HoPanelActive`, state.hoPanelActive);
  setSmokeDatasetValue(`${prefix}Pending`, state.pending);
  setSmokeDatasetValue(`${prefix}Serving`, state.serving);
  setSmokeDatasetValue(`${prefix}SkyMode`, state.skyMode);
  setSmokeDatasetValue(`${prefix}UePanelActive`, state.uePanelActive);
}

function assertScenarioCondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNoSelectionState(label: string, state: SmokeScenarioState): void {
  assertScenarioCondition(
    state.uePanelActive === "false",
    `${label}: expected UE panel inactive, received ${JSON.stringify(state)}`
  );
  assertScenarioCondition(
    state.hoPanelActive === "false",
    `${label}: expected handover panel inactive, received ${JSON.stringify(state)}`
  );
  assertScenarioCondition(
    state.handoverPhase === "Waiting for UE anchor",
    `${label}: expected no-selection phase, received ${JSON.stringify(state)}`
  );
}

function assertLocalFocusState(label: string, state: SmokeScenarioState): void {
  assertScenarioCondition(
    state.uePanelActive === "true",
    `${label}: expected UE panel active, received ${JSON.stringify(state)}`
  );
  assertScenarioCondition(
    state.hoPanelActive === "true",
    `${label}: expected handover panel active, received ${JSON.stringify(state)}`
  );
  assertScenarioCondition(
    state.handoverPhase !== "Waiting for UE anchor",
    `${label}: expected local-focus phase, received ${JSON.stringify(state)}`
  );
  assertScenarioCondition(
    state.serving !== "—" && state.serving !== "missing",
    `${label}: expected serving satellite text, received ${JSON.stringify(state)}`
  );
  assertScenarioCondition(
    state.pending !== "—" && state.pending !== "missing",
    `${label}: expected pending satellite text, received ${JSON.stringify(state)}`
  );
}

function dispatchCanvasCenterDoubleClick(viewer: Viewer): void {
  const canvas = viewer.scene.canvas;
  const rect = canvas.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;

  canvas.dispatchEvent(
    new MouseEvent("dblclick", {
      bubbles: true,
      button: 0,
      buttons: 1,
      cancelable: true,
      clientX,
      clientY,
      detail: 2,
      view: window
    })
  );
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function datasetKeyToAttributeName(key: string): string {
  return `data-${key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`;
}

function replaceWithSmokeResultDocument(): void {
  const attributes = Object.entries(document.documentElement.dataset)
    .map(
      ([key, value]) =>
        `${datasetKeyToAttributeName(key)}="${escapeHtmlAttribute(value ?? "")}"`
    )
    .join(" ");
  const html = `<!doctype html><html ${attributes}><head><meta charset="utf-8"><title>Local Focus Smoke Result</title></head><body>local-focus-smoke</body></html>`;
  window.location.replace(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

export function maybeRunLocalFocusSmokeScenario({
  handoverDemo,
  skyMode,
  viewer
}: {
  handoverDemo: HandoverFocusDemoController;
  skyMode: SkyModeController;
  viewer: Viewer;
}): void {
  const selection = readSmokeScenarioSelection();
  if (selection !== LOCAL_FOCUS_REGRESSION_SCENARIO) {
    return;
  }

  setSmokeDatasetValue("smokeScenario", selection);
  setSmokeDatasetValue("smokeScenarioState", "running");

  void (async () => {
    try {
      const initialState = readDemoState();
      recordState("smokeInitial", initialState);
      assertNoSelectionState("initial", initialState);
      assertScenarioCondition(
        initialState.skyMode === "blue",
        `initial: expected sky mode blue, received ${JSON.stringify(initialState)}`
      );

      skyMode.setMode("space");

      const afterSkyToggleState = readDemoState();
      recordState("smokeAfterSkyToggle", afterSkyToggleState);
      assertScenarioCondition(
        afterSkyToggleState.skyMode === "space",
        `afterSkyToggle: expected sky mode space, received ${JSON.stringify(
          afterSkyToggleState
        )}`
      );

      handoverDemo.placeUeAnchorAt(
        Cartesian3.fromDegrees(
          NTPU_SITE.longitudeDeg,
          NTPU_SITE.latitudeDeg,
          NTPU_SITE.altitudeM
        ),
        {
          displayName: NTPU_DISPLAY_NAME,
          transition: "glide"
        }
      );

      const afterNtpuState = readDemoState();
      recordState("smokeAfterNtpu", afterNtpuState);
      assertLocalFocusState("afterNtpu", afterNtpuState);
      assertScenarioCondition(
        afterNtpuState.skyMode === "space",
        `afterNtpu: expected sky mode space, received ${JSON.stringify(afterNtpuState)}`
      );
      assertScenarioCondition(
        afterNtpuState.backgroundCount === EXPECTED_NTPU_BACKGROUND_COUNT,
        `afterNtpu: expected background count ${EXPECTED_NTPU_BACKGROUND_COUNT}, received ${JSON.stringify(
          afterNtpuState
        )}`
      );

      const homeCommand = viewer.homeButton?.viewModel.command;
      assertScenarioCondition(
        Boolean(homeCommand),
        "Missing Cesium Home command during smoke scenario."
      );
      (homeCommand as unknown as () => void)();

      const afterHomeState = readDemoState();
      recordState("smokeAfterHome", afterHomeState);
      assertNoSelectionState("afterHome", afterHomeState);
      assertScenarioCondition(
        afterHomeState.skyMode === "space",
        `afterHome: expected sky mode space, received ${JSON.stringify(afterHomeState)}`
      );

      dispatchCanvasCenterDoubleClick(viewer);

      const afterDoubleClickState = readDemoState();
      recordState("smokeAfterDoubleClick", afterDoubleClickState);
      assertLocalFocusState("afterDoubleClick", afterDoubleClickState);
      assertScenarioCondition(
        afterDoubleClickState.skyMode === "space",
        `afterDoubleClick: expected sky mode space, received ${JSON.stringify(
          afterDoubleClickState
        )}`
      );

      viewer.clock.shouldAnimate = false;
      setSmokeDatasetValue("smokeScenarioState", "passed");
      replaceWithSmokeResultDocument();
    } catch (error) {
      viewer.clock.shouldAnimate = false;
      setSmokeDatasetValue("smokeScenarioState", "error");
      setSmokeDatasetValue(
        "smokeScenarioError",
        error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240)
      );
      replaceWithSmokeResultDocument();
    }
  })();
}
