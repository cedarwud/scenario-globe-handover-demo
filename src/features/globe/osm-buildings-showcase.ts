import {
  createOsmBuildingsAsync,
  type Cesium3DTileset,
  type Viewer
} from "cesium";

type BuildingShowcaseKey = "off" | "osm";
type BuildingShowcaseSource = "default-on" | "query-param" | "env";
type BuildingShowcaseState =
  | "disabled"
  | "loading"
  | "ready"
  | "degraded"
  | "error";

interface BuildingShowcaseSelection {
  key: BuildingShowcaseKey;
  source: BuildingShowcaseSource;
}

const BUILDING_SHOWCASE_QUERY_PARAM = "buildingShowcase";

function resolveBuildingShowcaseKey(
  value: string | null | undefined
): BuildingShowcaseKey | undefined {
  switch (value?.trim().toLowerCase()) {
    case "0":
    case "false":
    case "none":
    case "off":
      return "off";
    case "osm":
    case "osm-buildings":
      return "osm";
    default:
      return undefined;
  }
}

function serializeShowcaseError(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }

  if (typeof reason === "string") {
    return reason;
  }

  try {
    return JSON.stringify(reason);
  } catch {
    return "Unknown OSM Buildings showcase error";
  }
}

function syncBuildingShowcaseDataset(
  selection: BuildingShowcaseSelection,
  state: BuildingShowcaseState,
  detail?: string
): void {
  const { dataset } = document.documentElement;
  dataset.buildingShowcase = selection.key;
  dataset.buildingShowcaseSource = selection.source;
  dataset.buildingShowcaseState = state;

  if (detail) {
    dataset.buildingShowcaseDetail = detail.slice(0, 240);
  } else {
    delete dataset.buildingShowcaseDetail;
  }
}

function syncBuildingShowcaseState(
  viewer: Viewer,
  selection: BuildingShowcaseSelection,
  state: BuildingShowcaseState,
  detail?: string
): void {
  syncBuildingShowcaseDataset(selection, state, detail);

  if (!viewer.isDestroyed()) {
    viewer.scene.requestRender();
  }
}

function destroyTileset(viewer: Viewer, tileset: Cesium3DTileset): void {
  if (!viewer.isDestroyed()) {
    viewer.scene.primitives.remove(tileset);
  }

  if (!tileset.isDestroyed()) {
    tileset.destroy();
  }
}

function serializeTileFailure(reason: { message?: unknown; url?: unknown }): string {
  const message =
    typeof reason.message === "string"
      ? reason.message
      : serializeShowcaseError(reason.message);
  const url = typeof reason.url === "string" ? reason.url : undefined;

  return url ? `${message} (${url})` : message;
}

export function resolveBuildingShowcaseSelection(): BuildingShowcaseSelection {
  const queryValue = new URLSearchParams(window.location.search).get(
    BUILDING_SHOWCASE_QUERY_PARAM
  );

  if (queryValue !== null) {
    return {
      key: resolveBuildingShowcaseKey(queryValue) ?? "off",
      source: "query-param"
    };
  }

  const envValue = import.meta.env.VITE_CESIUM_BUILDING_SHOWCASE?.trim();

  if (envValue) {
    return {
      key: resolveBuildingShowcaseKey(envValue) ?? "off",
      source: "env"
    };
  }

  // This demo is intentionally city-scale and visual-first, so keep OSM
  // Buildings on by default while still allowing a narrow opt-out path.
  return {
    key: "osm",
    source: "default-on"
  };
}

export function mountOptionalOsmBuildingsShowcase(viewer: Viewer): () => void {
  const selection = resolveBuildingShowcaseSelection();

  if (selection.key !== "osm") {
    syncBuildingShowcaseDataset(selection, "disabled");
    return () => {};
  }

  let disposed = false;
  let mountedTileset: Cesium3DTileset | undefined;
  let hasVisibleTileContent = false;
  let initialTilesLoaded = false;
  let failureCount = 0;
  let latestFailureDetail: string | undefined;
  let removeTileLoadListener: (() => void) | undefined;
  let removeInitialTilesLoadedListener: (() => void) | undefined;
  let removeTileFailedListener: (() => void) | undefined;

  const removeTilesetListeners = () => {
    removeTileFailedListener?.();
    removeInitialTilesLoadedListener?.();
    removeTileLoadListener?.();
    removeTileFailedListener = undefined;
    removeInitialTilesLoadedListener = undefined;
    removeTileLoadListener = undefined;
  };

  syncBuildingShowcaseDataset(selection, "loading");

  void (async () => {
    try {
      const tileset = await createOsmBuildingsAsync();

      if (disposed || viewer.isDestroyed()) {
        tileset.destroy();
        return;
      }

      mountedTileset = tileset;
      removeTileLoadListener = tileset.tileLoad.addEventListener(() => {
        hasVisibleTileContent = true;
      });
      removeInitialTilesLoadedListener = tileset.initialTilesLoaded.addEventListener(() => {
        if (disposed || viewer.isDestroyed()) {
          return;
        }

        initialTilesLoaded = true;
        if (failureCount > 0) {
          syncBuildingShowcaseState(
            viewer,
            selection,
            hasVisibleTileContent ? "degraded" : "error",
            latestFailureDetail
          );
          return;
        }

        syncBuildingShowcaseState(viewer, selection, "ready");
      });
      removeTileFailedListener = tileset.tileFailed.addEventListener((failure) => {
        if (disposed || viewer.isDestroyed()) {
          return;
        }

        failureCount += 1;
        latestFailureDetail =
          failureCount > 1
            ? `Encountered ${failureCount} OSM Buildings tile/content failures. Last: ${serializeTileFailure(
                failure
              )}`
            : `Tile/content failure after attachment: ${serializeTileFailure(failure)}`;
        syncBuildingShowcaseState(
          viewer,
          selection,
          initialTilesLoaded || hasVisibleTileContent ? "degraded" : "error",
          latestFailureDetail
        );
        console.warn(
          "Optional Cesium OSM Buildings showcase reported tile/content failure after attachment.",
          failure
        );
      });

      viewer.scene.primitives.add(tileset);
      viewer.scene.requestRender();
    } catch (error) {
      if (disposed || viewer.isDestroyed()) {
        return;
      }

      syncBuildingShowcaseState(
        viewer,
        selection,
        "error",
        serializeShowcaseError(error)
      );
      console.warn("Failed to load optional Cesium OSM Buildings showcase.", error);
    }
  })();

  return () => {
    disposed = true;
    removeTilesetListeners();

    if (mountedTileset) {
      destroyTileset(viewer, mountedTileset);
      mountedTileset = undefined;
    }

    syncBuildingShowcaseDataset(selection, "disabled");
  };
}
