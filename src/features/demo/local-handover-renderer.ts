import {
  ArcType,
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ConstantPositionProperty,
  ConstantProperty,
  CustomDataSource,
  Ellipsoid,
  LabelStyle,
  Matrix3,
  PolylineDashMaterialProperty,
  PolylineGlowMaterialProperty,
  Quaternion,
  Entity,
  type Viewer
} from "cesium";

import type { AppShellMount } from "../app/app-shell";
import { LOCAL_DENSITY_LOOKUP } from "./local-density-lookup";
import {
  STAGE_BACKGROUND_SATELLITE_COUNT,
  UE_ANCHOR_ENDPOINT_OUTLINE_WIDTH,
  UE_ANCHOR_ENDPOINT_PIXEL_SIZE,
  colorForRole,
  formatUeAnchorMarkerLabel,
  type DemoPhase,
  type FocusCandidate,
  type FocusRole,
  type LocalHandoverBeamCue,
  type LocalHandoverPresentationFrame,
  type LocalHandoverShellFrame,
  type UeAnchor
} from "./local-handover-model";
import type { SyntheticConstellationRuntime } from "./synthetic-constellation";

export interface StageEntities {
  backgroundSatellites: Entity[];
  beamCones: Entity[];
  beamCoreLinks: Entity[];
  beamLinks: Entity[];
  beamTags: Entity[];
  proxySatellites: Entity[];
  sitePendingHalo: Entity;
  siteMarker: Entity;
}

const SITE_STAGE_PROXY_MODEL_URI = "models/sat.glb";
const SAT_MODEL_IBL_FACTOR = new Cartesian2(1.0, 1.0);
const SAT_MODEL_LIGHT_COLOR = Color.fromCssColorString("#fff6e6");

const polylinePositionsCache = new WeakMap<Entity, Cartesian3[]>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function setPanelActive(shell: AppShellMount, active: boolean): void {
  shell.ueAnchorPanel.hidden = true;
  shell.ueAnchorPanel.dataset.active = active ? "true" : "false";
  shell.handoverPanel.dataset.active = active ? "true" : "false";
  shell.handoverPanel.hidden = true;
}

export function setNoSelectionState(
  shell: AppShellMount,
  satelliteCount: number
): void {
  shell.ueAnchorState.textContent = "Double-click the globe to place a UE anchor";
  shell.ueAnchorCoordinates.textContent = "No UE anchor placed.";
  shell.globalSatelliteCount.textContent = String(satelliteCount);
  shell.globalHint.textContent =
    "The orbit layer stays global. Double-click any point on the Earth to create a local stage with enlarged proxy satellites and a synthetic handover loop.";
  shell.handoverPhase.textContent = "Waiting for UE anchor";
  shell.handoverProgressBar.style.transform = "scaleX(0)";
  shell.servingSatellite.textContent = "—";
  shell.servingMetric.textContent = "—";
  shell.pendingSatellite.textContent = "—";
  shell.pendingMetric.textContent = "—";
  shell.contextSatellite.textContent = "—";
  shell.recentEvent.textContent = "—";
  shell.localDensitySummary.textContent = "Waiting for UE anchor.";
  shell.localDensityNote.textContent =
    `Demo lookup uses a repo-owned static table. Research baseline ${LOCAL_DENSITY_LOOKUP.researchBaselineElevationDeg}° stays separate from the local-view ${LOCAL_DENSITY_LOOKUP.demoLookupElevationDeg}° presentation lookup.`;
  shell.handoverPanel.dataset.backgroundSatelliteCount = "0";
  shell.handoverPanel.dataset.lookupSuggestedBackgroundSatelliteCount = "0";
  shell.detail.textContent =
    "No local focus is active. Double-click the globe to place a UE anchor and see the same-page handover presentation.";
  setPanelActive(shell, false);
}

function setConstantPropertyValue(
  holder: Record<string, unknown>,
  key: string,
  value: unknown
): void {
  const existing = holder[key];

  if (existing instanceof ConstantProperty) {
    existing.setValue(value);
    return;
  }

  holder[key] = new ConstantProperty(value);
}

function setEntityPosition(entity: Entity, position: Cartesian3): void {
  if (entity.position instanceof ConstantPositionProperty) {
    entity.position.setValue(position);
    return;
  }

  entity.position = new ConstantPositionProperty(position);
}

function setEntityOrientation(entity: Entity, orientation: Quaternion): void {
  if (entity.orientation instanceof ConstantProperty) {
    entity.orientation.setValue(orientation);
    return;
  }

  entity.orientation = new ConstantProperty(orientation);
}

function setLabelText(entity: Entity, value: string): void {
  if (entity.label) {
    setConstantPropertyValue(
      entity.label as unknown as Record<string, unknown>,
      "text",
      value
    );
  }
}

function setLabelColor(entity: Entity, color: Color): void {
  if (entity.label) {
    setConstantPropertyValue(
      entity.label as unknown as Record<string, unknown>,
      "fillColor",
      color
    );
  }
}

function setPointValue(
  entity: Entity,
  key: "color" | "outlineColor" | "outlineWidth" | "pixelSize",
  value: Color | number
): void {
  if (entity.point) {
    setConstantPropertyValue(
      entity.point as unknown as Record<string, unknown>,
      key,
      value
    );
  }
}

function setModelMinimumPixelSize(entity: Entity, value: number): void {
  if (entity.model) {
    setConstantPropertyValue(
      entity.model as unknown as Record<string, unknown>,
      "minimumPixelSize",
      value
    );
  }
}

function setModelMaximumScale(entity: Entity, value: number): void {
  if (entity.model) {
    setConstantPropertyValue(
      entity.model as unknown as Record<string, unknown>,
      "maximumScale",
      value
    );
  }
}

function setPolylinePositions(entity: Entity, positions: Cartesian3[]): void {
  if (!entity.polyline) {
    return;
  }

  let cachedPositions = polylinePositionsCache.get(entity);
  if (!cachedPositions) {
    cachedPositions = positions.slice();
    polylinePositionsCache.set(entity, cachedPositions);
    entity.polyline.positions = new CallbackProperty(() => cachedPositions!, false);
    return;
  }

  cachedPositions.length = positions.length;
  for (let i = 0; i < positions.length; i += 1) {
    const position = positions[i];
    if (!position) {
      continue;
    }
    const cached = cachedPositions[i];
    if (cached) {
      Cartesian3.clone(position, cached);
      continue;
    }
    cachedPositions[i] = Cartesian3.clone(position);
  }
}

function setPolylineWidth(entity: Entity, value: number): void {
  if (entity.polyline) {
    setConstantPropertyValue(
      entity.polyline as unknown as Record<string, unknown>,
      "width",
      value
    );
  }
}

function getOrCreatePolylineGlowMaterial(
  entity: Entity,
  key: "material" | "depthFailMaterial"
): PolylineGlowMaterialProperty {
  if (!entity.polyline) {
    throw new Error("Beam link entity is missing polyline graphics");
  }

  const existing = entity.polyline[key];

  if (existing instanceof PolylineGlowMaterialProperty) {
    return existing;
  }

  const material = new PolylineGlowMaterialProperty();
  entity.polyline[key] = material;
  return material;
}

function getOrCreatePolylineDashMaterial(
  entity: Entity,
  key: "material" | "depthFailMaterial"
): PolylineDashMaterialProperty {
  if (!entity.polyline) {
    throw new Error("Beam link entity is missing polyline graphics");
  }

  const existing = entity.polyline[key];

  if (existing instanceof PolylineDashMaterialProperty) {
    return existing;
  }

  const material = new PolylineDashMaterialProperty();
  entity.polyline[key] = material;
  return material;
}

function setGlowMaterialProperty(
  material: PolylineGlowMaterialProperty,
  color: Color,
  glowPower: number,
  taperPower: number
): void {
  setConstantPropertyValue(
    material as unknown as Record<string, unknown>,
    "color",
    color
  );
  setConstantPropertyValue(
    material as unknown as Record<string, unknown>,
    "glowPower",
    glowPower
  );
  setConstantPropertyValue(
    material as unknown as Record<string, unknown>,
    "taperPower",
    taperPower
  );
}

function setDashMaterialProperty(
  material: PolylineDashMaterialProperty,
  color: Color,
  gapColor: Color,
  dashLength: number,
  dashPattern: number
): void {
  setConstantPropertyValue(
    material as unknown as Record<string, unknown>,
    "color",
    color
  );
  setConstantPropertyValue(
    material as unknown as Record<string, unknown>,
    "gapColor",
    gapColor
  );
  setConstantPropertyValue(
    material as unknown as Record<string, unknown>,
    "dashLength",
    dashLength
  );
  setConstantPropertyValue(
    material as unknown as Record<string, unknown>,
    "dashPattern",
    dashPattern
  );
}

function getOrCreatePolylineColorMaterial(
  entity: Entity,
  key: "material" | "depthFailMaterial"
): ColorMaterialProperty {
  if (!entity.polyline) {
    throw new Error("Beam link entity is missing polyline graphics");
  }

  const existing = entity.polyline[key];

  if (existing instanceof ColorMaterialProperty) {
    return existing;
  }

  const material = new ColorMaterialProperty();
  entity.polyline[key] = material;
  return material;
}

function setColorMaterialColor(
  material: ColorMaterialProperty,
  color: Color
): void {
  setConstantPropertyValue(
    material as unknown as Record<string, unknown>,
    "color",
    color
  );
}

function setPolylineMaterialColor(
  entity: Entity,
  key: "material" | "depthFailMaterial",
  color: Color
): void {
  const material = getOrCreatePolylineColorMaterial(entity, key);
  setColorMaterialColor(material, color);
}

function getOrCreateCylinderColorMaterial(entity: Entity): ColorMaterialProperty {
  if (!entity.cylinder) {
    throw new Error("Beam cone entity is missing cylinder graphics");
  }

  const existing = entity.cylinder.material;

  if (existing instanceof ColorMaterialProperty) {
    return existing;
  }

  const material = new ColorMaterialProperty();
  entity.cylinder.material = material;
  return material;
}

function setCylinderMaterialColor(entity: Entity, color: Color): void {
  const material = getOrCreateCylinderColorMaterial(entity);
  setColorMaterialColor(material, color);
}

function setCylinderValue(
  entity: Entity,
  key: "bottomRadius" | "length" | "topRadius",
  value: number
): void {
  if (entity.cylinder) {
    setConstantPropertyValue(
      entity.cylinder as unknown as Record<string, unknown>,
      key,
      value
    );
  }
}

export function createStageEntities(
  dataSource: CustomDataSource
): StageEntities {
  const siteMarker = dataSource.entities.add({
    id: "site-marker",
    label: {
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      fillColor: Color.fromCssColorString("#d7e7f6").withAlpha(0.92),
      font: '600 13px "Trebuchet MS", sans-serif',
      outlineColor: Color.fromCssColorString("#061018"),
      outlineWidth: 3,
      pixelOffset: new Cartesian2(0, -18),
      style: LabelStyle.FILL_AND_OUTLINE,
      text: "UE"
    },
    point: {
      color: Color.fromCssColorString("#c8e6fb").withAlpha(0.88),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      outlineColor: Color.fromCssColorString("#54c7ff"),
      outlineWidth: UE_ANCHOR_ENDPOINT_OUTLINE_WIDTH,
      pixelSize: UE_ANCHOR_ENDPOINT_PIXEL_SIZE
    },
    show: false
  });
  const sitePendingHalo = dataSource.entities.add({
    id: "site-pending-halo",
    ellipse: {
      fill: true,
      material: Color.fromCssColorString("#ffb347").withAlpha(0.1),
      outline: false,
      semiMajorAxis: 240,
      semiMinorAxis: 240
    },
    show: false
  });

  const proxySatellites = ["serving", "pending", "context"].map((role) =>
    dataSource.entities.add({
      id: `proxy-satellite-${role}`,
      label: {
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        fillColor: Color.fromCssColorString("#ffffff"),
        font: '600 15px "Trebuchet MS", sans-serif',
        outlineColor: Color.fromCssColorString("#071018"),
        outlineWidth: 5,
        pixelOffset: new Cartesian2(0, -34),
        style: LabelStyle.FILL_AND_OUTLINE,
        text: role
      },
      model: {
        imageBasedLightingFactor: SAT_MODEL_IBL_FACTOR,
        lightColor: SAT_MODEL_LIGHT_COLOR,
        maximumScale: 8000,
        minimumPixelSize: 96,
        uri: SITE_STAGE_PROXY_MODEL_URI
      },
      show: false
    })
  );

  const backgroundSatellites = Array.from(
    { length: STAGE_BACKGROUND_SATELLITE_COUNT },
    (_, index) =>
      dataSource.entities.add({
        id: `background-satellite-${index}`,
        model: {
          imageBasedLightingFactor: SAT_MODEL_IBL_FACTOR,
          lightColor: SAT_MODEL_LIGHT_COLOR,
          maximumScale: 6400,
          minimumPixelSize: 64,
          uri: SITE_STAGE_PROXY_MODEL_URI
        },
        show: false
      })
  );

  const beamCones = ["serving", "pending", "context"].map((role) =>
    dataSource.entities.add({
      id: `beam-cone-${role}`,
      cylinder: {
        length: 1,
        material: colorForRole(role as FocusRole).withAlpha(
          role === "serving" ? 0.18 : role === "pending" ? 0.12 : 0.06
        ),
        topRadius: role === "serving" ? 380 : role === "pending" ? 460 : 260,
        bottomRadius: role === "serving" ? 4200 : role === "pending" ? 5200 : 2600
      },
      show: false
    })
  );

  const beamLinks = ["serving", "pending", "context"].map((role) =>
    dataSource.entities.add({
      id: `beam-link-${role}`,
      polyline: {
        arcType: ArcType.NONE,
        material: new PolylineGlowMaterialProperty({
          color: colorForRole(role as FocusRole),
          glowPower: role === "serving" ? 0.25 : 0.14,
          taperPower: 0.4
        }),
        width: role === "serving" ? 8 : role === "pending" ? 6 : 3
      },
      show: false
    })
  );

  const beamCoreLinks = ["serving", "pending", "context"].map((role) =>
    dataSource.entities.add({
      id: `beam-core-link-${role}`,
      polyline: {
        arcType: ArcType.NONE,
        material: colorForRole(role as FocusRole).withAlpha(0.9),
        width: role === "serving" ? 5 : role === "pending" ? 3 : 2
      },
      show: false
    })
  );

  const beamTags = ["serving", "pending", "context"].map((role) =>
    dataSource.entities.add({
      id: `beam-tag-${role}`,
      label: {
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        fillColor: colorForRole(role as FocusRole),
        font: '700 12px "Trebuchet MS", sans-serif',
        outlineColor: Color.fromCssColorString("#071018"),
        outlineWidth: 5,
        pixelOffset: new Cartesian2(0, -8),
        style: LabelStyle.FILL_AND_OUTLINE,
        text: role
      },
      show: false
    })
  );

  return {
    backgroundSatellites,
    beamCones,
    beamCoreLinks,
    beamLinks,
    beamTags,
    proxySatellites,
    sitePendingHalo,
    siteMarker
  };
}

export function applySelectionState(
  ueAnchor: UeAnchor | null,
  entities: StageEntities
): void {
  entities.siteMarker.show = Boolean(ueAnchor);
  entities.sitePendingHalo.show = false;
}

export function syncUeAnchorStage(
  ueAnchor: UeAnchor,
  entities: StageEntities
): void {
  setEntityPosition(entities.siteMarker, ueAnchor.positionM);
  setLabelText(entities.siteMarker, formatUeAnchorMarkerLabel(ueAnchor));
  setEntityPosition(entities.sitePendingHalo, ueAnchor.positionM);
}

function applyProxy(
  entity: Entity,
  candidate: FocusCandidate,
  role: FocusRole,
  phase: DemoPhase
): void {
  const color = colorForRole(role);
  const pendingEmphasis =
    role === "pending" && (phase === "prepared" || phase === "switching");
  const roleLabel =
    role === "serving" ? "SERVING" : role === "pending" ? "PENDING" : "CONTEXT";

  entity.show = true;
  setEntityPosition(entity, candidate.proxyPositionM);
  setLabelText(entity, `${roleLabel} • ${candidate.id}`);
  setLabelColor(
    entity,
    color.withAlpha(
      role === "serving" ? 1.0 : pendingEmphasis ? 0.88 : role === "pending" ? 0.62 : 0.3
    )
  );
  setModelMinimumPixelSize(
    entity,
    role === "serving" ? 126 : pendingEmphasis ? 108 : role === "pending" ? 96 : 76
  );
  setModelMaximumScale(
    entity,
    role === "serving" ? 11_200 : role === "pending" ? 9_200 : 8_400
  );
}

function applyBackgroundSatellite(entity: Entity, candidate: FocusCandidate): void {
  entity.show = true;
  setEntityPosition(entity, candidate.proxyPositionM);
  setModelMinimumPixelSize(entity, 68);
  setModelMaximumScale(entity, 6800);
}

export function hideProxyElements(entities: StageEntities): void {
  for (const background of entities.backgroundSatellites) {
    background.show = false;
  }

  for (const proxy of entities.proxySatellites) {
    proxy.show = false;
  }

  for (const link of entities.beamLinks) {
    link.show = false;
  }

  for (const coreLink of entities.beamCoreLinks) {
    coreLink.show = false;
  }

  for (const cone of entities.beamCones) {
    cone.show = false;
  }

  for (const tag of entities.beamTags) {
    tag.show = false;
  }
}

// Synthetic beam-hopping modulation (§9.2). Returns 1.0 during dwell and
// STAGE_BH_GUARD_MULTIPLIER during guard. The cadence is a presentation
// cue only; it does not drive scheduler state or affect HO semantics.
function withScaledAlpha(color: Color, multiplier: number): Color {
  return color.withAlpha(color.alpha * multiplier);
}

function createBeamTagPosition(
  ueAnchorPositionM: Cartesian3,
  proxyPositionM: Cartesian3,
  t: number
): Cartesian3 {
  return Cartesian3.lerp(
    ueAnchorPositionM,
    proxyPositionM,
    clamp(t, 0.15, 0.85),
    new Cartesian3()
  );
}

function createBeamOrientation(
  proxyPositionM: Cartesian3,
  ueAnchorPositionM: Cartesian3
): Quaternion {
  const midpoint = Cartesian3.midpoint(
    proxyPositionM,
    ueAnchorPositionM,
    new Cartesian3()
  );
  const zAxis = Cartesian3.normalize(
    Cartesian3.subtract(proxyPositionM, ueAnchorPositionM, new Cartesian3()),
    new Cartesian3()
  );
  const surfaceUp = Ellipsoid.WGS84.geodeticSurfaceNormal(
    midpoint,
    new Cartesian3()
  );
  let xAxis = Cartesian3.cross(surfaceUp, zAxis, new Cartesian3());

  if (Cartesian3.magnitudeSquared(xAxis) < 1e-6) {
    xAxis = Cartesian3.cross(Cartesian3.UNIT_X, zAxis, xAxis);
  }
  if (Cartesian3.magnitudeSquared(xAxis) < 1e-6) {
    xAxis = Cartesian3.cross(Cartesian3.UNIT_Y, zAxis, xAxis);
  }

  Cartesian3.normalize(xAxis, xAxis);
  const yAxis = Cartesian3.normalize(
    Cartesian3.cross(zAxis, xAxis, new Cartesian3()),
    new Cartesian3()
  );
  const rotation = new Matrix3(
    xAxis.x,
    yAxis.x,
    zAxis.x,
    xAxis.y,
    yAxis.y,
    zAxis.y,
    xAxis.z,
    yAxis.z,
    zAxis.z
  );

  return Quaternion.fromRotationMatrix(rotation, new Quaternion());
}

// BH modulation stays on the serving channel only, but it should not make
// the resident UE path blink aggressively. Keep line alpha stable and use
// the multiplier mainly for cone intensity plus glow strength.
function applyBeam(
  lineEntity: Entity,
  coreLineEntity: Entity,
  coneEntity: Entity,
  tagEntity: Entity,
  ueAnchorPositionM: Cartesian3,
  candidate: FocusCandidate,
  cue: LocalHandoverBeamCue,
  bhMultiplier: number
): void {
  const lineStartPositionM = candidate.proxyPositionM;
  const lineEndPositionM = ueAnchorPositionM;
  const beamMidpointM = Cartesian3.midpoint(
    lineStartPositionM,
    lineEndPositionM,
    new Cartesian3()
  );
  const beamLengthM = Math.max(
    Cartesian3.distance(lineStartPositionM, lineEndPositionM),
    1
  );
  const scaledLineColor = cue.lineColor;
  const scaledLineGapColor = cue.lineGapColor;
  const scaledDepthFailColor = cue.lineDepthFailColor;
  const scaledCoreLineColor = cue.coreLineColor;
  const scaledConeColor = withScaledAlpha(cue.coneColor, bhMultiplier);

  lineEntity.show = true;
  coreLineEntity.show = cue.coreLineVisible;
  setPolylinePositions(lineEntity, [lineStartPositionM, lineEndPositionM]);
  if (cue.coreLineVisible) {
    setPolylinePositions(coreLineEntity, [lineStartPositionM, lineEndPositionM]);
  }
  setPolylineWidth(lineEntity, cue.lineWidth);
  if (cue.coreLineVisible) {
    setPolylineWidth(coreLineEntity, cue.coreLineWidth);
  }

  if (cue.lineStyle === "dash") {
    setDashMaterialProperty(
      getOrCreatePolylineDashMaterial(lineEntity, "material"),
      scaledLineColor,
      scaledLineGapColor,
      cue.lineDashLength,
      cue.lineDashPattern
    );
    setDashMaterialProperty(
      getOrCreatePolylineDashMaterial(lineEntity, "depthFailMaterial"),
      scaledDepthFailColor,
      scaledLineGapColor,
      cue.lineDashLength,
      cue.lineDashPattern
    );
  } else {
    setGlowMaterialProperty(
      getOrCreatePolylineGlowMaterial(lineEntity, "material"),
      scaledLineColor,
      cue.lineGlowPower * bhMultiplier,
      cue.lineTaperPower
    );
    setGlowMaterialProperty(
      getOrCreatePolylineGlowMaterial(lineEntity, "depthFailMaterial"),
      scaledDepthFailColor,
      (cue.lineGlowPower + 0.08) * bhMultiplier,
      0.08
    );
  }

  if (cue.coreLineVisible) {
    setPolylineMaterialColor(coreLineEntity, "material", scaledCoreLineColor);
    setPolylineMaterialColor(
      coreLineEntity,
      "depthFailMaterial",
      scaledCoreLineColor
    );
  }

  coneEntity.show = true;
  setEntityPosition(coneEntity, beamMidpointM);
  setEntityOrientation(
    coneEntity,
    createBeamOrientation(lineStartPositionM, lineEndPositionM)
  );
  setCylinderValue(coneEntity, "length", beamLengthM);
  setCylinderMaterialColor(coneEntity, scaledConeColor);
  setCylinderValue(coneEntity, "topRadius", cue.coneTopRadius);
  setCylinderValue(coneEntity, "bottomRadius", cue.coneBottomRadius);

  tagEntity.show = true;
  setEntityPosition(
    tagEntity,
    createBeamTagPosition(
      ueAnchorPositionM,
      candidate.proxyPositionM,
      cue.tagPositionT
    )
  );
  setLabelText(tagEntity, cue.tagText);
  setLabelColor(tagEntity, cue.tagColor);
}

function hideBeam(
  lineEntity: Entity,
  coreLineEntity: Entity,
  coneEntity: Entity,
  tagEntity: Entity
): void {
  lineEntity.show = false;
  coreLineEntity.show = false;
  coneEntity.show = false;
  tagEntity.show = false;
}

export function syncLocalHandoverShellFrame(
  shell: AppShellMount,
  shellFrame: LocalHandoverShellFrame
): void {
  shell.ueAnchorState.textContent = shellFrame.ueAnchorStateText;
  shell.ueAnchorCoordinates.textContent = shellFrame.ueAnchorCoordinatesText;
  shell.globalHint.textContent = shellFrame.globalHintText;
  shell.handoverPhase.textContent = shellFrame.handoverPhaseText;
  shell.handoverProgressBar.style.transform = `scaleX(${shellFrame.handoverProgress.toFixed(3)})`;
  shell.servingSatellite.textContent = shellFrame.servingSatelliteText;
  shell.servingMetric.textContent = shellFrame.servingMetricText;
  shell.pendingSatellite.textContent = shellFrame.pendingSatelliteText;
  shell.pendingMetric.textContent = shellFrame.pendingMetricText;
  shell.contextSatellite.textContent = shellFrame.contextSatelliteText;
  shell.recentEvent.textContent = shellFrame.recentEventText;
  shell.localDensitySummary.textContent = shellFrame.localDensitySummaryText;
  shell.localDensityNote.textContent = shellFrame.localDensityNoteText;
  shell.handoverPanel.dataset.backgroundSatelliteCount = String(
    shellFrame.backgroundSatelliteCount
  );
  shell.handoverPanel.dataset.lookupSuggestedBackgroundSatelliteCount = String(
    shellFrame.lookupSuggestedBackgroundSatelliteCount
  );
  shell.detail.textContent = shellFrame.detailText;
  setPanelActive(shell, true);
}

export function renderLocalHandoverPresentationFrame({
  constellation,
  entities,
  presentationFrame,
  viewer
}: {
  constellation: SyntheticConstellationRuntime;
  entities: StageEntities;
  presentationFrame: LocalHandoverPresentationFrame;
  viewer: Viewer;
}): void {
  constellation.setHighlightedOrbitIds(presentationFrame.highlightedOrbitIds);
  entities.sitePendingHalo.show =
    presentationFrame.phase === "prepared" ||
    presentationFrame.phase === "switching";

  for (let i = 0; i < presentationFrame.backgroundCandidates.length; i += 1) {
    const backgroundEntity = entities.backgroundSatellites[i];
    const candidate = presentationFrame.backgroundCandidates[i];
    if (backgroundEntity && candidate) {
      applyBackgroundSatellite(backgroundEntity, candidate);
    }
  }
  for (
    let i = presentationFrame.backgroundCandidates.length;
    i < entities.backgroundSatellites.length;
    i += 1
  ) {
    const backgroundEntity = entities.backgroundSatellites[i];
    if (backgroundEntity) {
      backgroundEntity.show = false;
    }
  }

  for (let i = 0; i < presentationFrame.proxyFrames.length; i += 1) {
    const proxyEntity = entities.proxySatellites[i];
    const beamLink = entities.beamLinks[i];
    const beamCoreLink = entities.beamCoreLinks[i];
    const beamCone = entities.beamCones[i];
    const beamTag = entities.beamTags[i];
    const { beamBhMultiplier, beamCue, candidate, role } =
      presentationFrame.proxyFrames[i];

    if (proxyEntity) {
      applyProxy(proxyEntity, candidate, role, presentationFrame.phase);
    }
    if (beamLink && beamCoreLink && beamCone && beamTag) {
      if (beamCue) {
        applyBeam(
          beamLink,
          beamCoreLink,
          beamCone,
          beamTag,
          presentationFrame.ueAnchorPositionM,
          candidate,
          beamCue,
          beamBhMultiplier
        );
      } else {
        hideBeam(beamLink, beamCoreLink, beamCone, beamTag);
      }
    }
  }

  setPointValue(entities.siteMarker, "color", presentationFrame.siteMarkerColor);
  setPointValue(
    entities.siteMarker,
    "pixelSize",
    presentationFrame.siteMarkerPixelSize
  );
  setPointValue(
    entities.siteMarker,
    "outlineColor",
    presentationFrame.siteMarkerOutlineColor
  );
  setPointValue(
    entities.siteMarker,
    "outlineWidth",
    presentationFrame.siteMarkerOutlineWidth
  );

  viewer.scene.requestRender();
}
