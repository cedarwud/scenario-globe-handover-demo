import {
  Cartesian2,
  Cesium3DTileFeature,
  CustomDataSource,
  Entity,
  type Viewer
} from "cesium";

import {
  buildTileFeatureDescriptionTable,
  selectTileFeatureName,
  type TileFeaturePropertyReader
} from "./tile-feature-infobox";

export interface LocalHandoverSelectionPassthrough {
  isStagePick(picked: unknown): boolean;
  pickThroughStageOverlays(windowPosition: Cartesian2): Entity | undefined;
}

function isStageEntity(
  dataSource: CustomDataSource,
  entity: Entity | null | undefined
): boolean {
  return Boolean(entity && dataSource.entities.contains(entity));
}

export function getPickedEntity(picked: unknown): Entity | undefined {
  if (!picked || typeof picked !== "object") {
    return undefined;
  }

  const maybePicked = picked as { id?: unknown; primitive?: { id?: unknown } };
  const candidate = maybePicked.id ?? maybePicked.primitive?.id;
  return candidate instanceof Entity ? candidate : undefined;
}

export function createTileFeatureSelectionEntity(
  feature: TileFeaturePropertyReader
): Entity {
  return new Entity({
    description: buildTileFeatureDescriptionTable(feature),
    name: selectTileFeatureName(feature)
  });
}

export function createLocalHandoverSelectionPassthrough({
  dataSource,
  viewer
}: {
  dataSource: CustomDataSource;
  viewer: Viewer;
}): LocalHandoverSelectionPassthrough {
  function isStagePick(picked: unknown): boolean {
    const entity = getPickedEntity(picked);
    return isStageEntity(dataSource, entity);
  }

  return {
    isStagePick,

    pickThroughStageOverlays(windowPosition: Cartesian2): Entity | undefined {
      const picks = viewer.scene.drillPick(windowPosition);

      for (const picked of picks) {
        if (isStagePick(picked)) {
          continue;
        }

        const entity = getPickedEntity(picked);
        if (entity) {
          return entity;
        }

        if (picked instanceof Cesium3DTileFeature) {
          return createTileFeatureSelectionEntity(picked);
        }
      }

      return undefined;
    }
  };
}
