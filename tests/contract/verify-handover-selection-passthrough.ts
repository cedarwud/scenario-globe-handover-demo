import assert from "node:assert/strict";

import { Cartesian2, CustomDataSource, Entity } from "cesium";

import {
  createLocalHandoverSelectionPassthrough,
  createTileFeatureSelectionEntity,
  getPickedEntity
} from "../../src/features/demo/local-handover-selection.ts";

function main(): void {
  const dataSource = new CustomDataSource("selection-contract");
  const stageEntity = dataSource.entities.add({ id: "stage-entity" });
  const externalEntity = new Entity({ id: "external-entity" });

  assert.equal(getPickedEntity({ id: stageEntity }), stageEntity);
  assert.equal(getPickedEntity({ primitive: { id: externalEntity } }), externalEntity);
  assert.equal(getPickedEntity({ id: "not-an-entity" }), undefined);
  assert.equal(getPickedEntity(null), undefined);

  const selectionPassthrough = createLocalHandoverSelectionPassthrough({
    dataSource,
    viewer: {
      scene: {
        drillPick(): unknown[] {
          return [
            { id: stageEntity },
            { primitive: { id: externalEntity } }
          ];
        }
      }
    } as never
  });

  assert.equal(selectionPassthrough.isStagePick({ id: stageEntity }), true);
  assert.equal(selectionPassthrough.isStagePick({ id: externalEntity }), false);
  assert.equal(
    selectionPassthrough.pickThroughStageOverlays(new Cartesian2(320, 180)),
    externalEntity
  );

  const stageOnlyPassthrough = createLocalHandoverSelectionPassthrough({
    dataSource,
    viewer: {
      scene: {
        drillPick(): unknown[] {
          return [{ id: stageEntity }];
        }
      }
    } as never
  });

  assert.equal(
    stageOnlyPassthrough.pickThroughStageOverlays(new Cartesian2(0, 0)),
    undefined
  );

  const tileFeatureEntity = createTileFeatureSelectionEntity({
    getProperty(propertyId: string): unknown {
      return {
        name: 'Building <alpha>',
        identifier: 'id-<42>'
      }[propertyId];
    },
    getPropertyIds(): string[] {
      return ["name", "identifier"];
    }
  });

  assert.equal(tileFeatureEntity.name, "Building <alpha>");
  assert.equal(
    tileFeatureEntity.description?.getValue(),
    '<table class="cesium-infoBox-defaultTable"><tbody><tr><th>name</th><td>Building &lt;alpha&gt;</td></tr><tr><th>identifier</th><td>id-&lt;42&gt;</td></tr></tbody></table>'
  );

  console.log("Handover selection passthrough verification passed.");
}

main();
