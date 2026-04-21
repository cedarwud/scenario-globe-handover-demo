import {
  Cartesian2,
  Cartesian3,
  Color,
  CustomDataSource,
  DistanceDisplayCondition,
  JulianDate,
  LabelStyle,
  ConstantPositionProperty,
  type Entity,
  type Viewer
} from "cesium";

const EARTH_RADIUS_KM = 6378.137;
const EARTH_ROTATION_RATE_RAD_PER_SEC = 7.2921159e-5;
const ORBIT_SAMPLE_COUNT = 160;
const SATELLITE_MODEL_URI = "models/sat.glb";
const SATELLITE_MODEL_IBL_FACTOR = new Cartesian2(1.0, 1.0);
const SATELLITE_MODEL_LIGHT_COLOR = Color.fromCssColorString("#fff6e6");

export interface ConstellationSatelliteSample {
  altitudeKm: number;
  id: string;
  label: string;
  positionM: Cartesian3;
}

interface SyntheticSatelliteDefinition {
  altitudeKm: number;
  colorCss: string;
  id: string;
  inclinationRad: number;
  label: string;
  periodSec: number;
  phaseRad: number;
  raanRad: number;
}

interface SatelliteEntityRecord {
  definition: SyntheticSatelliteDefinition;
  entity: Entity;
  orbitLineEntity?: Entity;
  positionProperty: ConstantPositionProperty;
}

export interface SyntheticConstellationRuntime {
  getSatelliteCount(): number;
  getGlobePreviewOrbitIds(): readonly string[];
  sampleAtTime(time: JulianDate): ReadonlyArray<ConstellationSatelliteSample>;
  setHighlightedOrbitIds(ids: readonly string[]): void;
  setVisible(visible: boolean): void;
  dispose(): Promise<void>;
}

function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

function buildSyntheticConstellation(): SyntheticSatelliteDefinition[] {
  const shellConfigs = [
    {
      altitudeKm: 560,
      inclinationDeg: 53,
      planeCount: 3,
      satsPerPlane: 3,
      baseRaanDeg: 0,
      basePhaseDeg: 0,
      colorCss: "#78d8ff",
      periodSec: 5760
    },
    {
      altitudeKm: 590,
      inclinationDeg: 70,
      planeCount: 3,
      satsPerPlane: 3,
      baseRaanDeg: 20,
      basePhaseDeg: 18,
      colorCss: "#c4f1ff",
      periodSec: 6060
    }
  ] as const;

  const satellites: SyntheticSatelliteDefinition[] = [];
  let nextIndex = 1;

  for (const shell of shellConfigs) {
    for (let planeIndex = 0; planeIndex < shell.planeCount; planeIndex += 1) {
      for (
        let satelliteIndex = 0;
        satelliteIndex < shell.satsPerPlane;
        satelliteIndex += 1
      ) {
        const id = `G${String(nextIndex).padStart(2, "0")}`;
        satellites.push({
          altitudeKm: shell.altitudeKm,
          colorCss: shell.colorCss,
          id,
          label: `sat[${nextIndex - 1}]`,
          inclinationRad: degToRad(shell.inclinationDeg),
          periodSec: shell.periodSec + planeIndex * 55,
          phaseRad: degToRad(
            shell.basePhaseDeg +
              satelliteIndex * (360 / shell.satsPerPlane) +
              planeIndex * 22
          ),
          raanRad: degToRad(
            shell.baseRaanDeg + planeIndex * (360 / shell.planeCount)
          )
        });
        nextIndex += 1;
      }
    }
  }

  return satellites;
}

function computeOrbitPoint(
  definition: SyntheticSatelliteDefinition,
  secondsSinceAnchor: number,
  result?: Cartesian3
): Cartesian3 {
  const orbitRadiusM = (EARTH_RADIUS_KM + definition.altitudeKm) * 1000;
  const orbitalAngle =
    definition.phaseRad + (secondsSinceAnchor / definition.periodSec) * Math.PI * 2;
  const orbitalX = orbitRadiusM * Math.cos(orbitalAngle);
  const orbitalY = orbitRadiusM * Math.sin(orbitalAngle);
  const cosInclination = Math.cos(definition.inclinationRad);
  const sinInclination = Math.sin(definition.inclinationRad);
  const inclinedX = orbitalX;
  const inclinedY = orbitalY * cosInclination;
  const inclinedZ = orbitalY * sinInclination;
  const cosRaan = Math.cos(definition.raanRad);
  const sinRaan = Math.sin(definition.raanRad);
  const inertialX = inclinedX * cosRaan - inclinedY * sinRaan;
  const inertialY = inclinedX * sinRaan + inclinedY * cosRaan;
  const earthRotation = -EARTH_ROTATION_RATE_RAD_PER_SEC * secondsSinceAnchor;
  const cosEarthRotation = Math.cos(earthRotation);
  const sinEarthRotation = Math.sin(earthRotation);

  const output = result ?? new Cartesian3();
  output.x = inertialX * cosEarthRotation - inertialY * sinEarthRotation;
  output.y = inertialX * sinEarthRotation + inertialY * cosEarthRotation;
  output.z = inclinedZ;
  return output;
}

function buildOrbitPolylinePositions(
  definition: SyntheticSatelliteDefinition
): Cartesian3[] {
  const positions: Cartesian3[] = [];

  for (let sampleIndex = 0; sampleIndex <= ORBIT_SAMPLE_COUNT; sampleIndex += 1) {
    const sampleSeconds = (definition.periodSec * sampleIndex) / ORBIT_SAMPLE_COUNT;
    positions.push(computeOrbitPoint(definition, sampleSeconds));
  }

  return positions;
}

function createSatelliteEntity(
  dataSource: CustomDataSource,
  definition: SyntheticSatelliteDefinition,
  positionProperty: ConstantPositionProperty
): Entity {
  return dataSource.entities.add({
    id: definition.id,
    label: {
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      distanceDisplayCondition: new DistanceDisplayCondition(0, 40_000_000),
      eyeOffset: undefined,
      fillColor: Color.fromCssColorString("#f5f2a6"),
      font: '600 17px "Trebuchet MS", sans-serif',
      outlineColor: Color.fromCssColorString("#0a1017"),
      outlineWidth: 5,
      pixelOffset: new Cartesian2(0, -18),
      showBackground: false,
      style: LabelStyle.FILL_AND_OUTLINE,
      text: definition.label
    },
    model: {
      imageBasedLightingFactor: SATELLITE_MODEL_IBL_FACTOR,
      lightColor: SATELLITE_MODEL_LIGHT_COLOR,
      maximumScale: 5000,
      minimumPixelSize: 56,
      uri: SATELLITE_MODEL_URI
    },
    path: undefined,
    polyline: undefined,
    position: positionProperty
  });
}

function createOrbitLineEntity(
  dataSource: CustomDataSource,
  definition: SyntheticSatelliteDefinition
): Entity {
  const orbitPositions = buildOrbitPolylinePositions(definition);
  const orbitColor = Color.fromCssColorString(definition.colorCss);

  return dataSource.entities.add({
    id: `${definition.id}-orbit-line`,
    polyline: {
      distanceDisplayCondition: new DistanceDisplayCondition(0, 80_000_000),
      material: orbitColor.withAlpha(0.34),
      positions: orbitPositions,
      width: 2.4
    },
    show: false
  });
}

function toJulianDateSeconds(
  time: JulianDate,
  anchor: JulianDate
): number {
  return JulianDate.secondsDifference(time, anchor);
}

function createGlobePreviewOrbitIds(
  definitions: readonly SyntheticSatelliteDefinition[]
): string[] {
  const previewIds: string[] = [];
  const selectedIds = new Set<string>();
  const seenInclinations = new Set<string>();

  for (const definition of definitions) {
    const inclinationKey = definition.inclinationRad.toFixed(4);
    if (seenInclinations.has(inclinationKey)) {
      continue;
    }

    seenInclinations.add(inclinationKey);
    selectedIds.add(definition.id);
    previewIds.push(definition.id);
  }

  for (const definition of definitions) {
    if (previewIds.length >= 3) {
      break;
    }

    if (selectedIds.has(definition.id)) {
      continue;
    }

    selectedIds.add(definition.id);
    previewIds.push(definition.id);
  }

  return previewIds.slice(0, 3);
}

function orbitIdsMatch(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>
): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

export function createSyntheticConstellationRuntime(
  viewer: Viewer
): SyntheticConstellationRuntime {
  const definitions = buildSyntheticConstellation();
  const globePreviewOrbitIds = createGlobePreviewOrbitIds(definitions);
  const sampleBuffer: ConstellationSatelliteSample[] = definitions.map((definition) => ({
    altitudeKm: definition.altitudeKm,
    id: definition.id,
    label: definition.label,
    positionM: computeOrbitPoint(definition, 0)
  }));
  const dataSource = new CustomDataSource("synthetic-constellation-demo");
  const satelliteEntities: SatelliteEntityRecord[] = [];
  const clockAnchor = JulianDate.clone(viewer.clock.currentTime);
  let cachedSampleTime: JulianDate | undefined;
  let disposed = false;
  let entitySyncEnabled = true;
  let highlightedOrbitIds = new Set<string>();

  for (const definition of definitions) {
    const positionProperty = new ConstantPositionProperty(
      sampleBuffer[satelliteEntities.length]?.positionM ?? new Cartesian3()
    );
    satelliteEntities.push({
      definition,
      entity: createSatelliteEntity(dataSource, definition, positionProperty),
      positionProperty
    });
  }

  const attachPromise = viewer.dataSources.add(dataSource).then(() => {
    if (disposed || viewer.isDestroyed()) {
      if (!viewer.isDestroyed() && viewer.dataSources.contains(dataSource)) {
        viewer.dataSources.remove(dataSource);
      }
      return;
    }
  });

  function sampleAtTime(time: JulianDate): ReadonlyArray<ConstellationSatelliteSample> {
    if (cachedSampleTime && JulianDate.equals(cachedSampleTime, time)) {
      return sampleBuffer;
    }

    const secondsSinceAnchor = toJulianDateSeconds(time, clockAnchor);

    for (let index = 0; index < definitions.length; index += 1) {
      const definition = definitions[index];
      const sample = sampleBuffer[index];

      if (!definition || !sample) {
        continue;
      }

      computeOrbitPoint(definition, secondsSinceAnchor, sample.positionM);
    }

    cachedSampleTime = JulianDate.clone(time, cachedSampleTime);
    return sampleBuffer;
  }

  function syncEntities(time: JulianDate, options?: { force?: boolean }): void {
    if (
      disposed ||
      viewer.isDestroyed() ||
      (!options?.force && !entitySyncEnabled)
    ) {
      return;
    }

    const samples = sampleAtTime(time);

    for (let index = 0; index < satelliteEntities.length; index += 1) {
      const sample = samples[index];
      const entity = satelliteEntities[index]?.entity;

      if (!sample || !entity) {
        continue;
      }

      satelliteEntities[index]?.positionProperty.setValue(sample.positionM);
    }
  }

  function syncOrbitLineVisibility(): void {
    for (const record of satelliteEntities) {
      const shouldShow = highlightedOrbitIds.has(record.definition.id);

      if (shouldShow && !record.orbitLineEntity) {
        record.orbitLineEntity = createOrbitLineEntity(dataSource, record.definition);
      }

      if (record.orbitLineEntity) {
        record.orbitLineEntity.show = shouldShow;
      }
    }
  }

  function syncSatelliteVisibility(visible: boolean): void {
    for (const record of satelliteEntities) {
      record.entity.show = visible;
    }
  }

  syncEntities(viewer.clock.currentTime);
  syncSatelliteVisibility(true);
  const removeTickListener = viewer.clock.onTick.addEventListener((clock) => {
    syncEntities(clock.currentTime);
  });

  return {
    getSatelliteCount(): number {
      return definitions.length;
    },

    getGlobePreviewOrbitIds(): readonly string[] {
      return globePreviewOrbitIds;
    },

    sampleAtTime(time: JulianDate): ReadonlyArray<ConstellationSatelliteSample> {
      return sampleAtTime(time);
    },

    setHighlightedOrbitIds(ids: readonly string[]): void {
      const nextIds = new Set(ids);
      if (orbitIdsMatch(highlightedOrbitIds, nextIds)) {
        return;
      }

      highlightedOrbitIds = nextIds;
      syncOrbitLineVisibility();
      viewer.scene.requestRender();
    },

    setVisible(visible: boolean): void {
      entitySyncEnabled = visible;
      if (visible) {
        syncEntities(viewer.clock.currentTime, { force: true });
      }
      syncSatelliteVisibility(visible);
      syncOrbitLineVisibility();
      viewer.scene.requestRender();
    },

    async dispose(): Promise<void> {
      disposed = true;
      removeTickListener();
      await attachPromise;

      if (!viewer.isDestroyed() && viewer.dataSources.contains(dataSource)) {
        viewer.dataSources.remove(dataSource);
      }
    }
  };
}
