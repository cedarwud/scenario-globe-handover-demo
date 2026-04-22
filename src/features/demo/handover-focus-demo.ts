import {
  Cartesian2,
  Cartesian3,
  CustomDataSource,
  JulianDate,
  ScreenSpaceEventType,
  type Viewer
} from "cesium";

import type { AppShellMount } from "../app/app-shell";
import {
  buildFocusCandidateCache,
  buildLocalHandoverSemanticFrame,
  buildLocalHandoverTruthFrame,
  createPresentationClockState,
  deriveLocalHandoverPresentationFrame,
  deriveLocalHandoverShellFrame,
  initializeBackgroundLanes,
  initializeProxyLanes,
  toUeAnchor,
  type LocalHandoverRuntimeState,
  type UeAnchor
} from "./local-handover-model";
import {
  applySelectionState,
  createStageEntities,
  hideProxyElements,
  renderLocalHandoverPresentationFrame,
  setNoSelectionState,
  syncLocalHandoverShellFrame,
  syncUeAnchorStage
} from "./local-handover-renderer";
import {
  flyToUeAnchor,
  glideToUeAnchor,
  pickEarthPosition
} from "./local-handover-camera";
import {
  createLocalHandoverSelectionPassthrough
} from "./local-handover-selection";
import type { SyntheticConstellationRuntime } from "./synthetic-constellation";

interface UeAnchorSelectionOptions {
  displayName?: string;
  transition?: "fly" | "glide";
}

interface ClearUeAnchorOptions {
  cancelFlight?: boolean;
}

export interface HandoverFocusDemoController {
  clearUeAnchor(options?: ClearUeAnchorOptions): void;
  dispose(): Promise<void>;
  placeUeAnchorAt(positionM: Cartesian3, options?: UeAnchorSelectionOptions): void;
}

export function createHandoverFocusDemoController({
  constellation,
  shell,
  viewer
}: {
  constellation: SyntheticConstellationRuntime;
  shell: AppShellMount;
  viewer: Viewer;
}): HandoverFocusDemoController {
  const dataSource = new CustomDataSource("handover-focus-demo");
  const entities = createStageEntities(dataSource);
  const attachPromise = viewer.dataSources.add(dataSource);
  const viewerHandler = viewer.cesiumWidget.screenSpaceEventHandler;
  const originalLeftClickAction = viewerHandler.getInputAction(
    ScreenSpaceEventType.LEFT_CLICK
  ) as ((event: { position: Cartesian2 }) => void) | undefined;
  const originalLeftDoubleClickAction = viewerHandler.getInputAction(
    ScreenSpaceEventType.LEFT_DOUBLE_CLICK
  );
  let disposed = false;
  let ueAnchor: UeAnchor | null = null;
  const runtimeState: LocalHandoverRuntimeState = {
    backgroundLanes: [],
    handoverCount: 0,
    lastServingId: null,
    presentationClockState: null,
    proxyLanes: []
  };
  let cancelActiveGlide: (() => void) | null = null;
  const selectionPassthrough = createLocalHandoverSelectionPassthrough({
    dataSource,
    viewer
  });

  // Reserve double-click for UE anchor placement and keep the rest of
  // Cesium's native drag / rotate / zoom behavior untouched.
  viewerHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  setNoSelectionState(shell, constellation.getSatelliteCount());
  applySelectionState(null, entities);
  constellation.setHighlightedOrbitIds([]);

  function updateAtTime(time: JulianDate): void {
    if (disposed || !ueAnchor) {
      hideProxyElements(entities);
      constellation.setHighlightedOrbitIds([]);
      return;
    }

    const samples = constellation.sampleAtTime(time);
    const truthFrame = buildLocalHandoverTruthFrame({
      runtimeState,
      samples,
      time,
      ueAnchor,
      viewerClockMultiplier: viewer.clock.multiplier
    });
    const presentationFrame = deriveLocalHandoverPresentationFrame(truthFrame);
    const shellFrame = deriveLocalHandoverShellFrame(truthFrame);
    renderLocalHandoverPresentationFrame({
      constellation,
      entities,
      presentationFrame,
      viewer
    });
    syncLocalHandoverShellFrame(shell, shellFrame);
  }

  function placeUeAnchor(positionM: Cartesian3, options?: UeAnchorSelectionOptions): void {
    ueAnchor = toUeAnchor(positionM, viewer.clock.currentTime, options?.displayName);
    constellation.setVisible(true);
    constellation.setHighlightedOrbitIds([]);
    const previewTime = viewer.clock.currentTime;
    const previewSamples = constellation.sampleAtTime(previewTime);
    const previewCandidateCache = buildFocusCandidateCache(ueAnchor, previewSamples);
    runtimeState.backgroundLanes = [];
    runtimeState.handoverCount = 0;
    runtimeState.lastServingId = null;
    runtimeState.presentationClockState = createPresentationClockState(previewTime);
    runtimeState.proxyLanes = initializeProxyLanes(
      previewCandidateCache.rankedCandidates,
      runtimeState.presentationClockState.elapsedSec
    );
    runtimeState.backgroundLanes = initializeBackgroundLanes(
      previewCandidateCache.rankedCandidates,
      runtimeState.presentationClockState.elapsedSec,
      ueAnchor.localDensityLookup.suggestedBackgroundSatelliteCount,
      new Set(runtimeState.proxyLanes.map((lane) => lane.boundCandidateId))
    );
    const previewFrame = buildLocalHandoverSemanticFrame(
      previewCandidateCache,
      runtimeState.proxyLanes,
      runtimeState.presentationClockState.elapsedSec
    );
    cancelActiveGlide?.();
    cancelActiveGlide = null;
    applySelectionState(ueAnchor, entities);
    syncUeAnchorStage(ueAnchor, entities);
    if (options?.transition === "glide") {
      cancelActiveGlide = glideToUeAnchor(viewer, ueAnchor, previewFrame);
    } else {
      flyToUeAnchor(viewer, ueAnchor, previewFrame);
    }
    updateAtTime(previewTime);
  }

  viewerHandler.setInputAction((event: { position: Cartesian2 }) => {
    if (disposed) {
      return;
    }

    const primaryPick = viewer.scene.pick(event.position);
    if (!selectionPassthrough.isStagePick(primaryPick)) {
      originalLeftClickAction?.(event);
      return;
    }

    viewer.selectedEntity = selectionPassthrough.pickThroughStageOverlays(
      event.position
    );
  }, ScreenSpaceEventType.LEFT_CLICK);

  viewerHandler.setInputAction((event: { position: Cartesian2 }) => {
    if (disposed) {
      return;
    }

    const positionM = pickEarthPosition(viewer, event.position);

    if (!positionM) {
      return;
    }

    placeUeAnchor(positionM, { transition: "glide" });
  }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  const removeTickListener = viewer.clock.onTick.addEventListener((clock) => {
    updateAtTime(clock.currentTime);
  });

  return {
    clearUeAnchor(options?: ClearUeAnchorOptions): void {
      ueAnchor = null;
      constellation.setVisible(true);
      constellation.setHighlightedOrbitIds([]);
      runtimeState.backgroundLanes = [];
      runtimeState.proxyLanes = [];
      runtimeState.presentationClockState = null;
      runtimeState.lastServingId = null;
      runtimeState.handoverCount = 0;
      cancelActiveGlide?.();
      cancelActiveGlide = null;
      if (options?.cancelFlight !== false) {
        viewer.camera.cancelFlight();
      }
      applySelectionState(null, entities);
      hideProxyElements(entities);
      setNoSelectionState(shell, constellation.getSatelliteCount());
    },

    placeUeAnchorAt(positionM: Cartesian3, options?: UeAnchorSelectionOptions): void {
      placeUeAnchor(positionM, options);
    },

    async dispose(): Promise<void> {
      disposed = true;
      cancelActiveGlide?.();
      cancelActiveGlide = null;
      viewer.camera.cancelFlight();
      if (originalLeftDoubleClickAction) {
        viewerHandler.setInputAction(
          originalLeftDoubleClickAction,
          ScreenSpaceEventType.LEFT_DOUBLE_CLICK
        );
      } else {
        viewerHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
      }
      if (originalLeftClickAction) {
        viewerHandler.setInputAction(
          originalLeftClickAction,
          ScreenSpaceEventType.LEFT_CLICK
        );
      } else {
        viewerHandler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
      }
      removeTickListener();
      await attachPromise;

      if (!viewer.isDestroyed() && viewer.dataSources.contains(dataSource)) {
        viewer.dataSources.remove(dataSource);
      }
    }
  };
}
