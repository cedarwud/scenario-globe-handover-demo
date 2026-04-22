import assert from "node:assert/strict";

import {
  buildTileFeatureDescriptionTable,
  selectTileFeatureName,
  type TileFeaturePropertyReader
} from "../../src/features/demo/tile-feature-infobox.ts";

function createMockFeature(
  properties: Record<string, unknown>
): TileFeaturePropertyReader {
  return {
    getProperty(propertyId: string): unknown {
      return properties[propertyId];
    },
    getPropertyIds(): string[] {
      return Object.keys(properties);
    }
  };
}

function main(): void {
  const feature = createMockFeature({
    'name<script>alert("x")</script>': 'Tower <img src=x onerror="alert(1)">',
    identifier: 'site-<42>',
    metadata: {
      html: "<b>unsafe</b>",
      nested: ['<tag attr="x">', "&value"]
    },
    skippedNull: null,
    skippedUndefined: undefined
  });

  const description = buildTileFeatureDescriptionTable(feature);

  assert(description.startsWith('<table class="cesium-infoBox-defaultTable"><tbody>'));
  assert(description.endsWith("</tbody></table>"));
  assert(!description.includes('<script>alert("x")</script>'));
  assert(!description.includes('<img src=x onerror="alert(1)">'));
  assert(description.includes("name&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"));
  assert(description.includes("Tower &lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  assert(
    description.includes(
      '{&quot;html&quot;:&quot;&lt;b&gt;unsafe&lt;/b&gt;&quot;,&quot;nested&quot;:[' +
        '&quot;&lt;tag attr=\\&quot;x\\&quot;&gt;&quot;,&quot;&amp;value&quot;]}'
    )
  );
  assert(!description.includes("skippedNull"));
  assert(!description.includes("skippedUndefined"));

  assert.equal(selectTileFeatureName(feature), 'Tower <img src=x onerror="alert(1)">');
  assert.equal(
    selectTileFeatureName(createMockFeature({ id: 42 })),
    "42"
  );
  assert.equal(selectTileFeatureName(createMockFeature({})), "Unnamed Feature");

  console.log("Tile feature InfoBox sanitization verification passed.");
}

main();
