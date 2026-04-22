export interface TileFeaturePropertyReader {
  getProperty(propertyId: string): unknown;
  getPropertyIds(): string[];
}

const HTML_ESCAPE_LOOKUP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
} as const satisfies Record<string, string>;

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      HTML_ESCAPE_LOOKUP[character as keyof typeof HTML_ESCAPE_LOOKUP] ?? character
  );
}

function serializeFeatureValue(value: unknown): string {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  if (Array.isArray(value) || typeof value === "object") {
    try {
      const serialized = JSON.stringify(value);
      if (typeof serialized === "string") {
        return serialized;
      }
    } catch {
      // Fall back to string coercion for values that JSON cannot serialize.
    }
  }

  return String(value);
}

export function buildTileFeatureDescriptionTable(
  feature: TileFeaturePropertyReader
): string {
  const rows: string[] = [];

  for (const propertyId of feature.getPropertyIds()) {
    const value = feature.getProperty(propertyId);
    if (value === undefined || value === null) {
      continue;
    }

    rows.push(
      `<tr><th>${escapeHtml(String(propertyId))}</th><td>${escapeHtml(
        serializeFeatureValue(value)
      )}</td></tr>`
    );
  }

  if (rows.length === 0) {
    return "";
  }

  return `<table class="cesium-infoBox-defaultTable"><tbody>${rows.join("")}</tbody></table>`;
}

export function selectTileFeatureName(
  feature: TileFeaturePropertyReader
): string {
  const possibleIds: unknown[] = [];
  const propertyIds = feature.getPropertyIds();

  for (let i = 0; i < propertyIds.length; i += 1) {
    const propertyId = propertyIds[i];
    if (/^name$/i.test(propertyId)) {
      possibleIds[0] = feature.getProperty(propertyId);
    } else if (/name/i.test(propertyId)) {
      possibleIds[1] = feature.getProperty(propertyId);
    } else if (/^title$/i.test(propertyId)) {
      possibleIds[2] = feature.getProperty(propertyId);
    } else if (/^(id|identifier)$/i.test(propertyId)) {
      possibleIds[3] = feature.getProperty(propertyId);
    } else if (/element/i.test(propertyId)) {
      possibleIds[4] = feature.getProperty(propertyId);
    } else if (/(id|identifier)$/i.test(propertyId)) {
      possibleIds[5] = feature.getProperty(propertyId);
    }
  }

  for (const item of possibleIds) {
    if (item !== undefined && item !== null && item !== "") {
      return serializeFeatureValue(item);
    }
  }

  return "Unnamed Feature";
}
