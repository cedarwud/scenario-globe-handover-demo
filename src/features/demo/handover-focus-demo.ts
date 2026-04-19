import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  ColorMaterialProperty,
  ConstantPositionProperty,
  ConstantProperty,
  CustomDataSource,
  EasingFunction,
  Ellipsoid,
  HeadingPitchRange,
  JulianDate,
  LabelStyle,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  PolylineGlowMaterialProperty,
  Quaternion,
  ScreenSpaceEventType,
  Transforms,
  type Entity,
  type Viewer
} from "cesium";

import type { AppShellMount } from "../app/app-shell";
import type {
  ConstellationSatelliteSample,
  SyntheticConstellationRuntime
} from "./synthetic-constellation";

type FocusRole = "serving" | "pending" | "context";
type DemoPhase = "tracking" | "prepared" | "switching" | "post";

interface FocusSite {
  displayName?: string;
  latitudeDeg: number;
  longitudeDeg: number;
  positionM: Cartesian3;
  selectedAt: JulianDate;
  surfaceHeightM: number;
}

interface FocusSiteSelectionOptions {
  displayName?: string;
  transition?: "fly" | "glide";
}

interface ClearSiteFocusOptions {
  cancelFlight?: boolean;
}

interface FocusCandidate {
  azimuthRad: number;
  elevationDeg: number;
  id: string;
  label: string;
  localEastM: number;
  localNorthM: number;
  localUpM: number;
  metricDb: number;
  positionM: Cartesian3;
  proxyPositionM: Cartesian3;
  rangeKm: number;
  score: number;
}

interface DemoFrame {
  context: FocusCandidate;
  detail: string;
  phase: DemoPhase;
  phaseLabel: string;
  phaseProgress: number;
  pending: FocusCandidate;
  recentEvent: string;
  serving: FocusCandidate;
  stageHeadingRad: number;
}

interface CameraLocalFrame {
  forwardLocal: Cartesian3;
  offsetLocal: Cartesian3;
  upLocal: Cartesian3;
}

interface FocusCameraPose {
  destinationM: Cartesian3;
  directionM: Cartesian3;
  focusRadiusM: number;
  rangeM: number;
  targetPositionM: Cartesian3;
  upM: Cartesian3;
}

interface StageEntities {
  beamCones: Entity[];
  beamLinks: Entity[];
  buildingBoxes: Entity[];
  footprint: Entity;
  proxySatellites: Entity[];
  siteHalo: Entity;
  siteMarker: Entity;
}

const DEMO_CYCLE_DURATION_SEC = 12;
const SITE_STAGE_PROXY_MODEL_URI = "models/sat.glb";
const SAT_MODEL_IBL_FACTOR = new Cartesian2(1.0, 1.0);
const SAT_MODEL_LIGHT_COLOR = Color.fromCssColorString("#fff6e6");
const DISPLAY_STAGE_HEADING_RAD = 0;
const SITE_CAMERA_PITCH_RAD = -0.12;
const SITE_CAMERA_MIN_RANGE_M = 620;
const SITE_CAMERA_SITE_FROM_BOTTOM_RATIO = 0.12;
const SITE_CAMERA_FOCUS_RADIUS_MIN_M = 560;
const SITE_CAMERA_FOCUS_RADIUS_SCALE = 0.76;
const SITE_CAMERA_RANGE_MULTIPLIER = 1.28;
const SITE_CAMERA_GLIDE_DURATION_MS = 980;
const SHOW_DEMO_BUILDING_BOXES = false;
const PROXY_RADIUS_MIN_M = 700;
const PROXY_RADIUS_MAX_M = 1_700;
const PROXY_HEIGHT_MIN_M = 1_500;
const PROXY_HEIGHT_MAX_M = 3_400;
const BUILDING_LAYOUT = [
  { eastM: -980, northM: -720, heightM: 120, widthM: 260, depthM: 200 },
  { eastM: -640, northM: -120, heightM: 150, widthM: 190, depthM: 160 },
  { eastM: -280, northM: 520, heightM: 96, widthM: 180, depthM: 150 },
  { eastM: 100, northM: -880, heightM: 110, widthM: 180, depthM: 140 },
  { eastM: 260, northM: -320, heightM: 220, widthM: 310, depthM: 220 },
  { eastM: 420, northM: 260, heightM: 180, widthM: 240, depthM: 180 },
  { eastM: 760, northM: -120, heightM: 140, widthM: 200, depthM: 180 },
  { eastM: 880, northM: 520, heightM: 160, widthM: 220, depthM: 170 },
  { eastM: -220, northM: -260, heightM: 72, widthM: 110, depthM: 90 },
  { eastM: 40, northM: 160, heightM: 88, widthM: 120, depthM: 110 },
  { eastM: 180, northM: 820, heightM: 132, widthM: 190, depthM: 150 },
  { eastM: -820, northM: 220, heightM: 104, widthM: 160, depthM: 140 }
] as const;
const ROLE_COLORS = {
  serving: Color.fromCssColorString("#54c7ff"),
  pending: Color.fromCssColorString("#ffb347"),
  context: Color.fromCssColorString("#dce7f2")
} as const satisfies Record<FocusRole, Color>;
const STAGE_PROXY_SLOTS = {
  serving: { forwardM: 1_020, lateralM: 120, upM: 980 },
  pending: { forwardM: 900, lateralM: -520, upM: 900 },
  context: { forwardM: 1_260, lateralM: 620, upM: 1_180 }
} as const satisfies Record<
  FocusRole,
  { forwardM: number; lateralM: number; upM: number }
>;
const STAGE_PROXY_MOTION_ENVELOPES = {
  serving: { forwardM: 170, lateralM: 180, upM: 280 },
  pending: { forwardM: 210, lateralM: 220, upM: 240 },
  context: { forwardM: 240, lateralM: 260, upM: 320 }
} as const satisfies Record<
  FocusRole,
  { forwardM: number; lateralM: number; upM: number }
>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createStageProxyPosition(
  site: FocusSite,
  candidate: FocusCandidate,
  role: FocusRole,
  stageHeadingRad: number
): Cartesian3 {
  const slot = STAGE_PROXY_SLOTS[role];
  const envelope = STAGE_PROXY_MOTION_ENVELOPES[role];
  const relativeAzimuthRad = CesiumMath.negativePiToPi(candidate.azimuthRad - stageHeadingRad);
  const elevationNorm = clamp((candidate.elevationDeg + 8) / 88, 0, 1);
  const forwardEast = Math.sin(stageHeadingRad);
  const forwardNorth = Math.cos(stageHeadingRad);
  const rightEast = Math.cos(stageHeadingRad);
  const rightNorth = -Math.sin(stageHeadingRad);
  const forwardM = slot.forwardM + Math.cos(relativeAzimuthRad) * envelope.forwardM;
  const lateralM = slot.lateralM + Math.sin(relativeAzimuthRad) * envelope.lateralM;
  const upM = slot.upM + CesiumMath.lerp(-envelope.upM * 0.38, envelope.upM, elevationNorm);
  const eastM = rightEast * lateralM + forwardEast * forwardM;
  const northM = rightNorth * lateralM + forwardNorth * forwardM;

  return createLocalOffsetPosition(site, eastM, northM, upM);
}

function stageCandidate(
  site: FocusSite,
  candidate: FocusCandidate,
  role: FocusRole,
  stageHeadingRad: number
): FocusCandidate {
  return {
    ...candidate,
    proxyPositionM: createStageProxyPosition(site, candidate, role, stageHeadingRad)
  };
}

function setPanelActive(shell: AppShellMount, active: boolean): void {
  shell.handoverPanel.dataset.active = active ? "true" : "false";
}

function setNoSelectionState(shell: AppShellMount, satelliteCount: number): void {
  shell.siteState.textContent = "Double-click the globe to stage a local handover scene";
  shell.siteCoordinates.textContent = "No site selected.";
  shell.globalSatelliteCount.textContent = String(satelliteCount);
  shell.globalHint.textContent =
    "The orbit layer stays global. Double-click any point on the Earth to create a local stage with enlarged proxy satellites and a synthetic handover loop.";
  shell.handoverPhase.textContent = "Waiting for site selection";
  shell.handoverProgressBar.style.transform = "scaleX(0)";
  shell.servingSatellite.textContent = "—";
  shell.servingMetric.textContent = "—";
  shell.pendingSatellite.textContent = "—";
  shell.pendingMetric.textContent = "—";
  shell.contextSatellite.textContent = "—";
  shell.recentEvent.textContent = "—";
  shell.detail.textContent =
    "No local focus is active. Double-click a site to see the same-page handover presentation.";
  setPanelActive(shell, false);
}

function formatCoordinates(site: FocusSite): string {
  return `${site.latitudeDeg.toFixed(4)}°, ${site.longitudeDeg.toFixed(
    4
  )}° • ${site.surfaceHeightM.toFixed(0)} m`;
}

function formatSiteHeading(site: FocusSite): string {
  return site.displayName
    ? `Site focus active at ${site.displayName}`
    : `Site focus active at ${site.latitudeDeg.toFixed(2)}°, ${site.longitudeDeg.toFixed(2)}°`;
}

function formatSiteMarkerLabel(site: FocusSite): string {
  return site.displayName
    ? site.displayName
    : `Site Focus • ${site.latitudeDeg.toFixed(2)}°, ${site.longitudeDeg.toFixed(2)}°`;
}

function colorForRole(role: FocusRole): Color {
  return ROLE_COLORS[role];
}

function setEntityPosition(entity: Entity, position: Cartesian3): void {
  entity.position = new ConstantPositionProperty(position);
}

function setEntityOrientation(entity: Entity, orientation: Quaternion): void {
  entity.orientation = new ConstantProperty(orientation);
}

function setLabelText(entity: Entity, value: string): void {
  if (entity.label) {
    entity.label.text = new ConstantProperty(value);
  }
}

function setLabelColor(entity: Entity, color: Color): void {
  if (entity.label) {
    entity.label.fillColor = new ConstantProperty(color);
  }
}

function pickEarthPosition(viewer: Viewer, screenPosition: Cartesian2) {
  const pickRay = viewer.camera.getPickRay(screenPosition);

  if (pickRay) {
    const globeSurfacePick = viewer.scene.globe.pick(pickRay, viewer.scene);

    if (globeSurfacePick) {
      return globeSurfacePick;
    }
  }

  return viewer.camera.pickEllipsoid(
    screenPosition,
    viewer.scene.globe.ellipsoid ?? Ellipsoid.WGS84
  );
}

function toFocusSite(
  positionM: Cartesian3,
  time: JulianDate,
  displayName?: string
): FocusSite {
  const cartographic = Cartographic.fromCartesian(positionM);
  const stagedSurfaceHeightM = Math.max(cartographic.height, 0);
  const stagedPositionM = Cartesian3.fromRadians(
    cartographic.longitude,
    cartographic.latitude,
    stagedSurfaceHeightM
  );

  return {
    displayName,
    latitudeDeg: (cartographic.latitude * 180) / Math.PI,
    longitudeDeg: (cartographic.longitude * 180) / Math.PI,
    positionM: stagedPositionM,
    selectedAt: JulianDate.clone(time),
    surfaceHeightM: stagedSurfaceHeightM
  };
}

function createLocalFrame(site: FocusSite): Matrix4 {
  return Transforms.eastNorthUpToFixedFrame(site.positionM);
}

function createLocalOffsetPosition(
  site: FocusSite,
  eastM: number,
  northM: number,
  upM: number
): Cartesian3 {
  const localFrame = createLocalFrame(site);
  return Matrix4.multiplyByPoint(
    localFrame,
    new Cartesian3(eastM, northM, upM),
    new Cartesian3()
  );
}

function evaluateCandidate(site: FocusSite, sample: ConstellationSatelliteSample): FocusCandidate {
  const localFrame = createLocalFrame(site);
  const inverseFrame = Matrix4.inverseTransformation(localFrame, new Matrix4());
  const localPoint = Matrix4.multiplyByPoint(
    inverseFrame,
    sample.positionM,
    new Cartesian3()
  );
  const rangeM = Cartesian3.magnitude(localPoint);
  const azimuthRad = Math.atan2(localPoint.x, localPoint.y);
  const elevationRad = Math.asin(localPoint.z / Math.max(rangeM, 1));
  const elevationDeg = (elevationRad * 180) / Math.PI;
  const rangeKm = rangeM / 1000;
  const metricDb = -12.6 + elevationDeg * 0.13 - rangeKm * 0.0024;
  const score =
    elevationDeg * 5.5 +
    clamp(localPoint.z / 1000, -2500, 2500) * 0.08 -
    rangeKm * 0.02;
  const elevationNorm = clamp((elevationDeg + 8) / 88, 0, 1);
  const proxyRadiusM =
    PROXY_RADIUS_MAX_M - elevationNorm * (PROXY_RADIUS_MAX_M - PROXY_RADIUS_MIN_M);
  const proxyHeightM =
    PROXY_HEIGHT_MIN_M + elevationNorm * (PROXY_HEIGHT_MAX_M - PROXY_HEIGHT_MIN_M);
  const proxyPositionM = createLocalOffsetPosition(
    site,
    Math.sin(azimuthRad) * proxyRadiusM,
    Math.cos(azimuthRad) * proxyRadiusM,
    proxyHeightM
  );

  return {
    azimuthRad,
    elevationDeg,
    id: sample.id,
    label: sample.label,
    localEastM: localPoint.x,
    localNorthM: localPoint.y,
    localUpM: localPoint.z,
    metricDb,
    positionM: sample.positionM,
    proxyPositionM,
    rangeKm,
    score
  };
}

function buildDemoFrame(
  site: FocusSite,
  samples: ReadonlyArray<ConstellationSatelliteSample>,
  time: JulianDate
): DemoFrame {
  const rankedCandidates = samples
    .map((sample) => evaluateCandidate(site, sample))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);

  const safeCandidates =
    rankedCandidates.length >= 3
      ? rankedCandidates
      : [
          ...rankedCandidates,
          ...rankedCandidates.slice(0, Math.max(0, 3 - rankedCandidates.length))
        ];
  const elapsedSec = JulianDate.secondsDifference(time, site.selectedAt);
  const phaseProgress = ((elapsedSec % DEMO_CYCLE_DURATION_SEC) + DEMO_CYCLE_DURATION_SEC) %
    DEMO_CYCLE_DURATION_SEC /
    DEMO_CYCLE_DURATION_SEC;
  const baseIndex = Math.floor(elapsedSec / DEMO_CYCLE_DURATION_SEC) % safeCandidates.length;
  const servingCandidate = safeCandidates[(baseIndex + safeCandidates.length) % safeCandidates.length];
  const pendingCandidate = safeCandidates[(baseIndex + 1) % safeCandidates.length];
  const contextCandidate = safeCandidates[(baseIndex + 2) % safeCandidates.length];
  const stageHeadingRad = DISPLAY_STAGE_HEADING_RAD;
  const stagedServingCandidate = stageCandidate(
    site,
    servingCandidate,
    "serving",
    stageHeadingRad
  );
  const stagedPendingCandidate = stageCandidate(
    site,
    pendingCandidate,
    "pending",
    stageHeadingRad
  );
  const stagedContextCandidate = stageCandidate(
    site,
    contextCandidate,
    "context",
    stageHeadingRad
  );

  if (phaseProgress < 0.42) {
    return {
      context: stagedContextCandidate,
      detail:
        "The selected site stays locked while the global orbit layer keeps moving. The local stage compresses the geometry so the handover narrative stays readable at city scale.",
      phase: "tracking",
      phaseLabel: "Tracking Stable Beam",
      phaseProgress,
      pending: stagedPendingCandidate,
      recentEvent: "Monitoring candidate offset",
      serving: stagedServingCandidate,
      stageHeadingRad
    };
  }

  if (phaseProgress < 0.72) {
    return {
      context: stagedContextCandidate,
      detail:
        "The pending satellite is promoted on the local stage before the visual switch. This is a demo cue, not a real handover decision path.",
      phase: "prepared",
      phaseLabel: "Prepared Target Window",
      phaseProgress,
      pending: stagedPendingCandidate,
      recentEvent: `${servingCandidate.id} preparing ${pendingCandidate.id}`,
      serving: stagedServingCandidate,
      stageHeadingRad
    };
  }

  if (phaseProgress < 0.88) {
    return {
      context: stagedContextCandidate,
      detail:
        "The serving role flips on the site-stage proxies while the global satellites keep their original orbit motion. This is the core dual-scale demo behavior.",
      phase: "switching",
      phaseLabel: "Synthetic Handover Switch",
      phaseProgress,
      pending: stageCandidate(site, servingCandidate, "pending", stageHeadingRad),
      recentEvent: `${servingCandidate.id} → ${pendingCandidate.id}`,
      serving: stageCandidate(site, pendingCandidate, "serving", stageHeadingRad),
      stageHeadingRad
    };
  }

  return {
    context: stagedContextCandidate,
    detail:
      "Post-switch settling keeps the previous satellite on the stage briefly so you can read the transition without losing context.",
    phase: "post",
    phaseLabel: "Post-Handover Settle",
    phaseProgress,
    pending: stageCandidate(site, servingCandidate, "pending", stageHeadingRad),
    recentEvent: `${servingCandidate.id} released site focus`,
    serving: stageCandidate(site, pendingCandidate, "serving", stageHeadingRad),
    stageHeadingRad
  };
}

function buildBeamOrientation(
  startM: Cartesian3,
  endM: Cartesian3
): { lengthM: number; orientation: Quaternion; positionM: Cartesian3 } {
  const direction = Cartesian3.normalize(
    Cartesian3.subtract(startM, endM, new Cartesian3()),
    new Cartesian3()
  );
  const fallbackAxis =
    Math.abs(Cartesian3.dot(direction, Cartesian3.UNIT_Z)) > 0.92
      ? Cartesian3.UNIT_X
      : Cartesian3.UNIT_Z;
  const xAxis = Cartesian3.normalize(
    Cartesian3.cross(fallbackAxis, direction, new Cartesian3()),
    new Cartesian3()
  );
  const yAxis = Cartesian3.normalize(
    Cartesian3.cross(direction, xAxis, new Cartesian3()),
    new Cartesian3()
  );
  const rotationMatrix = Matrix3.clone(Matrix3.IDENTITY);
  Matrix3.setColumn(rotationMatrix, 0, xAxis, rotationMatrix);
  Matrix3.setColumn(rotationMatrix, 1, yAxis, rotationMatrix);
  Matrix3.setColumn(rotationMatrix, 2, direction, rotationMatrix);

  return {
    lengthM: Cartesian3.distance(startM, endM),
    orientation: Quaternion.fromRotationMatrix(rotationMatrix),
    positionM: Cartesian3.midpoint(startM, endM, new Cartesian3())
  };
}

function createStageEntities(dataSource: CustomDataSource): StageEntities {
  const siteMarker = dataSource.entities.add({
    id: "site-marker",
    label: {
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      fillColor: Color.fromCssColorString("#f7f1cf"),
      font: '600 16px "Trebuchet MS", sans-serif',
      outlineColor: Color.fromCssColorString("#061018"),
      outlineWidth: 4,
      pixelOffset: new Cartesian2(0, -26),
      style: LabelStyle.FILL_AND_OUTLINE,
      text: "Selected Site"
    },
    point: {
      color: Color.fromCssColorString("#f4cb67"),
      outlineColor: Color.fromCssColorString("#05121d"),
      outlineWidth: 2,
      pixelSize: 14
    },
    show: false
  });
  const siteHalo = dataSource.entities.add({
    id: "site-halo",
    ellipse: {
      fill: false,
      outline: true,
      outlineColor: Color.fromCssColorString("#73c9ff").withAlpha(0.82),
      outlineWidth: 2,
      semiMajorAxis: 260,
      semiMinorAxis: 260
    },
    show: false
  });
  const footprint = dataSource.entities.add({
    id: "focus-footprint",
    ellipse: {
      fill: false,
      outline: true,
      outlineColor: Color.fromCssColorString("#90d8ff").withAlpha(0.34),
      outlineWidth: 1,
      semiMajorAxis: 540,
      semiMinorAxis: 540
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
      point: {
        color: Color.fromCssColorString("#f3f7fb").withAlpha(0.9),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        outlineColor: Color.fromCssColorString("#09131b").withAlpha(0.84),
        outlineWidth: 2,
        pixelSize: 18
      },
      show: false
    })
  );

  const beamLinks = ["serving", "pending", "context"].map((role) =>
    dataSource.entities.add({
      id: `beam-link-${role}`,
      polyline: {
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

  const buildingBoxes = BUILDING_LAYOUT.map((layout, index) =>
    dataSource.entities.add({
      id: `focus-building-${index}`,
      box: {
        dimensions: new Cartesian3(layout.widthM, layout.depthM, layout.heightM),
        material: Color.fromCssColorString("#c48f45").withAlpha(0.86),
        outline: true,
        outlineColor: Color.fromCssColorString("#73532b").withAlpha(0.55)
      },
      show: false
    })
  );

  return {
    beamCones,
    beamLinks,
    buildingBoxes,
    footprint,
    proxySatellites,
    siteHalo,
    siteMarker
  };
}

function applySelectionState(site: FocusSite | null, entities: StageEntities): void {
  const visible = Boolean(site);
  entities.siteMarker.show = visible;
  entities.siteHalo.show = visible;
  entities.footprint.show = visible;

  for (const building of entities.buildingBoxes) {
    building.show = visible && SHOW_DEMO_BUILDING_BOXES;
  }
}

function syncSiteStage(site: FocusSite, entities: StageEntities): void {
  setEntityPosition(entities.siteMarker, site.positionM);
  setLabelText(entities.siteMarker, formatSiteMarkerLabel(site));
  setEntityPosition(entities.siteHalo, site.positionM);
  setEntityPosition(entities.footprint, site.positionM);

  if (!SHOW_DEMO_BUILDING_BOXES) {
    return;
  }

  for (let index = 0; index < entities.buildingBoxes.length; index += 1) {
    const entity = entities.buildingBoxes[index];
    const layout = BUILDING_LAYOUT[index];

    if (!entity || !layout) {
      continue;
    }

    setEntityPosition(
      entity,
      createLocalOffsetPosition(
      site,
      layout.eastM,
      layout.northM,
      layout.heightM / 2
    ));
  }
}

function applyProxy(
  entity: Entity,
  candidate: FocusCandidate,
  role: FocusRole
): void {
  const color = colorForRole(role);
  const roleLabel =
    role === "serving" ? "SERVING" : role === "pending" ? "PENDING" : "CONTEXT";

  entity.show = true;
  setEntityPosition(entity, candidate.proxyPositionM);
  setLabelText(entity, `${roleLabel} • ${candidate.id}`);
  setLabelColor(entity, color);
  if (entity.model) {
    entity.model.minimumPixelSize = new ConstantProperty(
      role === "serving" ? 124 : role === "pending" ? 108 : 88
    );
    entity.model.maximumScale = new ConstantProperty(
      role === "serving" ? 11_200 : 9_400
    );
  }
  if (entity.point) {
    entity.point.color = new ConstantProperty(Color.fromCssColorString("#f3f7fb").withAlpha(0.92));
    entity.point.pixelSize = new ConstantProperty(
      role === "serving" ? 24 : role === "pending" ? 20 : 16
    );
  }
}

function hideProxyElements(entities: StageEntities): void {
  for (const proxy of entities.proxySatellites) {
    proxy.show = false;
  }

  for (const link of entities.beamLinks) {
    link.show = false;
  }

  for (const cone of entities.beamCones) {
    cone.show = false;
  }
}

function applyBeam(
  lineEntity: Entity,
  coneEntity: Entity,
  site: FocusSite,
  candidate: FocusCandidate,
  role: FocusRole
): void {
  const beam = buildBeamOrientation(candidate.proxyPositionM, site.positionM);
  const color = colorForRole(role);

  lineEntity.show = true;
  lineEntity.polyline!.positions = new ConstantProperty([
    candidate.proxyPositionM,
    site.positionM
  ]);
  lineEntity.polyline!.width = new ConstantProperty(
    role === "serving" ? 8 : role === "pending" ? 6 : 3
  );
  lineEntity.polyline!.material = new PolylineGlowMaterialProperty({
    color,
    glowPower: role === "serving" ? 0.28 : role === "pending" ? 0.18 : 0.1,
    taperPower: 0.35
  });

  coneEntity.show = true;
  setEntityPosition(coneEntity, beam.positionM);
  setEntityOrientation(coneEntity, beam.orientation);
  coneEntity.cylinder!.length = new ConstantProperty(beam.lengthM);
  coneEntity.cylinder!.topRadius = new ConstantProperty(
    role === "serving" ? 360 : role === "pending" ? 460 : 220
  );
  coneEntity.cylinder!.bottomRadius = new ConstantProperty(
    role === "serving" ? 4200 : role === "pending" ? 5200 : 2000
  );
  coneEntity.cylinder!.material = new ColorMaterialProperty(
    color.withAlpha(role === "serving" ? 0.18 : role === "pending" ? 0.12 : 0.05)
  );
}

function syncUi(shell: AppShellMount, site: FocusSite, frame: DemoFrame): void {
  shell.siteState.textContent = formatSiteHeading(site);
  shell.siteCoordinates.textContent = formatCoordinates(site);
  shell.globalHint.textContent =
    "The orbit layer remains global while the selected site runs a compressed local focus stage derived from the strongest synthetic candidates.";
  shell.handoverPhase.textContent = frame.phaseLabel;
  shell.handoverProgressBar.style.transform = `scaleX(${frame.phaseProgress.toFixed(3)})`;
  shell.servingSatellite.textContent = frame.serving.id;
  shell.servingMetric.textContent = `${frame.serving.metricDb.toFixed(
    1
  )} dB • ${frame.serving.elevationDeg.toFixed(1)}° • ${frame.serving.rangeKm.toFixed(
    0
  )} km`;
  shell.pendingSatellite.textContent = frame.pending.id;
  shell.pendingMetric.textContent = `${frame.pending.metricDb.toFixed(
    1
  )} dB • ${frame.pending.elevationDeg.toFixed(1)}° • ${frame.pending.rangeKm.toFixed(
    0
  )} km`;
  shell.contextSatellite.textContent = `${frame.context.id} • ${frame.context.elevationDeg.toFixed(
    1
  )}°`;
  shell.recentEvent.textContent = frame.recentEvent;
  shell.detail.textContent = frame.detail;
  setPanelActive(shell, true);
}

function getCameraVerticalFovRad(viewer: Viewer): number {
  const frustum = viewer.camera.frustum as { fovy?: number };

  if (typeof frustum.fovy === "number" && Number.isFinite(frustum.fovy)) {
    return frustum.fovy;
  }

  return Math.PI / 3;
}

function createCameraLocalOffset(rangeM: number): Cartesian3 {
  const pitch = CesiumMath.clamp(
    SITE_CAMERA_PITCH_RAD,
    -CesiumMath.PI_OVER_TWO,
    CesiumMath.PI_OVER_TWO
  );
  const heading = CesiumMath.zeroToTwoPi(DISPLAY_STAGE_HEADING_RAD) - CesiumMath.PI_OVER_TWO;
  const pitchQuat = Quaternion.fromAxisAngle(Cartesian3.UNIT_Y, -pitch, new Quaternion());
  const headingQuat = Quaternion.fromAxisAngle(Cartesian3.UNIT_Z, -heading, new Quaternion());
  const rotationQuat = Quaternion.multiply(headingQuat, pitchQuat, new Quaternion());
  const rotationMatrix = Matrix3.fromQuaternion(rotationQuat, new Matrix3());
  const offset = Cartesian3.clone(Cartesian3.UNIT_X, new Cartesian3());

  Matrix3.multiplyByVector(rotationMatrix, offset, offset);
  Cartesian3.negate(offset, offset);

  return Cartesian3.multiplyByScalar(offset, rangeM, offset);
}

function createCameraLocalFrame(rangeM: number): CameraLocalFrame {
  const offsetLocal = createCameraLocalOffset(rangeM);
  const forwardLocal = Cartesian3.normalize(
    Cartesian3.negate(offsetLocal, new Cartesian3()),
    new Cartesian3()
  );
  const rightLocal = Cartesian3.normalize(
    Cartesian3.cross(forwardLocal, Cartesian3.UNIT_Z, new Cartesian3()),
    new Cartesian3()
  );
  const upLocal = Cartesian3.normalize(
    Cartesian3.cross(rightLocal, forwardLocal, new Cartesian3()),
    new Cartesian3()
  );

  return {
    forwardLocal,
    offsetLocal,
    upLocal
  };
}

function createFocusTargetPosition(viewer: Viewer, site: FocusSite, rangeM: number): Cartesian3 {
  const siteFromTopRatio = 1 - clamp(SITE_CAMERA_SITE_FROM_BOTTOM_RATIO, 0.05, 0.45);
  const normalizedVerticalOffset = 1 - siteFromTopRatio * 2;
  const screenShiftMagnitudeM =
    Math.abs(normalizedVerticalOffset) * rangeM * Math.tan(getCameraVerticalFovRad(viewer) / 2);
  const cameraLocalFrame = createCameraLocalFrame(rangeM);
  const directionSign = normalizedVerticalOffset < 0 ? 1 : -1;
  const targetOffsetLocal = Cartesian3.multiplyByScalar(
    cameraLocalFrame.upLocal,
    screenShiftMagnitudeM * directionSign,
    new Cartesian3()
  );

  return createLocalOffsetPosition(
    site,
    targetOffsetLocal.x,
    targetOffsetLocal.y,
    targetOffsetLocal.z
  );
}

function createFocusPose(
  viewer: Viewer,
  site: FocusSite,
  frame: DemoFrame
): FocusCameraPose {
  const maxProxyDistanceM = Math.max(
    Cartesian3.distance(site.positionM, frame.serving.proxyPositionM),
    Cartesian3.distance(site.positionM, frame.pending.proxyPositionM),
    Cartesian3.distance(site.positionM, frame.context.proxyPositionM)
  );

  const focusRadiusM = Math.max(
    maxProxyDistanceM * SITE_CAMERA_FOCUS_RADIUS_SCALE,
    SITE_CAMERA_FOCUS_RADIUS_MIN_M
  );
  const rangeM = Math.max(focusRadiusM * SITE_CAMERA_RANGE_MULTIPLIER, SITE_CAMERA_MIN_RANGE_M);
  const targetPositionM = createFocusTargetPosition(viewer, site, rangeM);
  const targetFrame = Transforms.eastNorthUpToFixedFrame(targetPositionM);
  const cameraLocalFrame = createCameraLocalFrame(rangeM);
  const destinationM = Matrix4.multiplyByPoint(
    targetFrame,
    cameraLocalFrame.offsetLocal,
    new Cartesian3()
  );
  const directionM = Cartesian3.normalize(
    Matrix4.multiplyByPointAsVector(targetFrame, cameraLocalFrame.forwardLocal, new Cartesian3()),
    new Cartesian3()
  );
  const upM = Cartesian3.normalize(
    Matrix4.multiplyByPointAsVector(targetFrame, cameraLocalFrame.upLocal, new Cartesian3()),
    new Cartesian3()
  );

  return {
    destinationM,
    directionM,
    focusRadiusM,
    rangeM,
    targetPositionM,
    upM
  };
}

function interpolateLongitudeRad(start: number, end: number, t: number): number {
  const delta = CesiumMath.negativePiToPi(end - start);
  return start + delta * t;
}

function interpolateSurfacePosition(
  startPositionM: Cartesian3,
  endPositionM: Cartesian3,
  t: number
): Cartesian3 {
  const start = Cartographic.fromCartesian(startPositionM);
  const end = Cartographic.fromCartesian(endPositionM);
  if (!start || !end) {
    return Cartesian3.lerp(startPositionM, endPositionM, t, new Cartesian3());
  }

  return Cartesian3.fromRadians(
    interpolateLongitudeRad(start.longitude, end.longitude, t),
    CesiumMath.lerp(start.latitude, end.latitude, t),
    CesiumMath.lerp(Math.max(start.height, 0), Math.max(end.height, 0), t)
  );
}

function getCurrentCameraTarget(viewer: Viewer, fallbackRangeM: number): Cartesian3 {
  const center = new Cartesian2(viewer.canvas.clientWidth / 2, viewer.canvas.clientHeight / 2);
  return (
    pickEarthPosition(viewer, center) ??
    Cartesian3.add(
      viewer.camera.positionWC,
      Cartesian3.multiplyByScalar(viewer.camera.directionWC, fallbackRangeM, new Cartesian3()),
      new Cartesian3()
    )
  );
}

function createOrientationFromTarget(
  destinationM: Cartesian3,
  targetPositionM: Cartesian3
): { direction: Cartesian3; up: Cartesian3 } {
  const direction = Cartesian3.normalize(
    Cartesian3.subtract(targetPositionM, destinationM, new Cartesian3()),
    new Cartesian3()
  );
  const surfaceUp = Ellipsoid.WGS84.geodeticSurfaceNormal(targetPositionM, new Cartesian3());
  const right = Cartesian3.cross(direction, surfaceUp, new Cartesian3());

  if (Cartesian3.magnitudeSquared(right) < 1e-8) {
    return {
      direction,
      up: surfaceUp
    };
  }

  Cartesian3.normalize(right, right);

  return {
    direction,
    up: Cartesian3.normalize(Cartesian3.cross(right, direction, new Cartesian3()), new Cartesian3())
  };
}

function glideToSite(viewer: Viewer, site: FocusSite, frame: DemoFrame): () => void {
  const endPose = createFocusPose(viewer, site, frame);
  const startDestinationM = Cartesian3.clone(viewer.camera.positionWC, new Cartesian3());
  const startTargetM = getCurrentCameraTarget(viewer, endPose.rangeM);
  const startedAtMs = performance.now();
  let frameRequestId = 0;
  let cancelled = false;

  viewer.camera.cancelFlight();

  const step = (timestampMs: number) => {
    if (cancelled || viewer.isDestroyed()) {
      return;
    }

    const elapsedMs = timestampMs - startedAtMs;
    const progress = clamp(elapsedMs / SITE_CAMERA_GLIDE_DURATION_MS, 0, 1);
    const eased = EasingFunction.QUADRATIC_IN_OUT(progress);
    const destinationM = interpolateSurfacePosition(startDestinationM, endPose.destinationM, eased);
    const targetPositionM = interpolateSurfacePosition(startTargetM, endPose.targetPositionM, eased);
    const orientation = createOrientationFromTarget(destinationM, targetPositionM);

    viewer.camera.setView({
      destination: destinationM,
      orientation
    });
    viewer.scene.requestRender();

    if (progress < 1) {
      frameRequestId = window.requestAnimationFrame(step);
      return;
    }

    viewer.camera.setView({
      destination: endPose.destinationM,
      orientation: {
        direction: endPose.directionM,
        up: endPose.upM
      }
    });
    viewer.scene.requestRender();
  };

  frameRequestId = window.requestAnimationFrame(step);

  return () => {
    cancelled = true;
    if (frameRequestId !== 0) {
      window.cancelAnimationFrame(frameRequestId);
    }
  };
}

function flyToSite(viewer: Viewer, site: FocusSite, frame: DemoFrame): void {
  const endPose = createFocusPose(viewer, site, frame);

  viewer.camera.cancelFlight();
  viewer.camera.flyToBoundingSphere(new BoundingSphere(endPose.targetPositionM, endPose.focusRadiusM), {
    duration: 1.15,
    easingFunction: EasingFunction.QUADRATIC_IN_OUT,
    offset: new HeadingPitchRange(DISPLAY_STAGE_HEADING_RAD, SITE_CAMERA_PITCH_RAD, endPose.rangeM),
    complete: () => {
      viewer.camera.setView({
        destination: endPose.destinationM,
        orientation: {
          direction: endPose.directionM,
          up: endPose.upM
        }
      });
      viewer.scene.requestRender();
    }
  });
}

export interface HandoverFocusDemoController {
  clearSiteFocus(options?: ClearSiteFocusOptions): void;
  dispose(): Promise<void>;
  focusSitePosition(positionM: Cartesian3, options?: FocusSiteSelectionOptions): void;
}

export function createHandoverFocusDemoController({
  constellation,
  onSelectSite,
  shell,
  viewer
}: {
  constellation: SyntheticConstellationRuntime;
  onSelectSite?: () => void;
  shell: AppShellMount;
  viewer: Viewer;
}): HandoverFocusDemoController {
  const dataSource = new CustomDataSource("handover-focus-demo");
  const entities = createStageEntities(dataSource);
  const attachPromise = viewer.dataSources.add(dataSource);
  const viewerHandler = viewer.cesiumWidget.screenSpaceEventHandler;
  const originalLeftDoubleClickAction = viewerHandler.getInputAction(
    ScreenSpaceEventType.LEFT_DOUBLE_CLICK
  );
  let disposed = false;
  let selectedSite: FocusSite | null = null;
  let lastServingId: string | null = null;
  let handoverCount = 0;
  let cancelActiveGlide: (() => void) | null = null;

  // Reserve double-click for site selection and keep the rest of Cesium's
  // native drag / rotate / zoom behavior untouched.
  viewerHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  setNoSelectionState(shell, constellation.getSatelliteCount());
  applySelectionState(null, entities);

  function updateAtTime(time: JulianDate): void {
    if (disposed || !selectedSite) {
      hideProxyElements(entities);
      return;
    }

    const samples = constellation.sampleAtTime(time);
    const frame = buildDemoFrame(selectedSite, samples, time);

    if (frame.serving.id !== lastServingId) {
      if (lastServingId !== null) {
        handoverCount += 1;
      }
      lastServingId = frame.serving.id;
    }

    applyProxy(entities.proxySatellites[0], frame.serving, "serving");
    applyProxy(entities.proxySatellites[1], frame.pending, "pending");
    applyProxy(entities.proxySatellites[2], frame.context, "context");
    applyBeam(entities.beamLinks[0], entities.beamCones[0], selectedSite, frame.serving, "serving");
    applyBeam(entities.beamLinks[1], entities.beamCones[1], selectedSite, frame.pending, "pending");
    applyBeam(entities.beamLinks[2], entities.beamCones[2], selectedSite, frame.context, "context");
    syncUi(shell, selectedSite, {
      ...frame,
      recentEvent:
        handoverCount > 0 ? `${frame.recentEvent} • HO count ${handoverCount}` : frame.recentEvent
    });
  }

  function selectSite(positionM: Cartesian3, options?: FocusSiteSelectionOptions): void {
    onSelectSite?.();
    selectedSite = toFocusSite(positionM, viewer.clock.currentTime, options?.displayName);
    const previewTime = viewer.clock.currentTime;
    const previewFrame = buildDemoFrame(
      selectedSite,
      constellation.sampleAtTime(previewTime),
      previewTime
    );
    lastServingId = null;
    handoverCount = 0;
    cancelActiveGlide?.();
    cancelActiveGlide = null;
    applySelectionState(selectedSite, entities);
    syncSiteStage(selectedSite, entities);
    if (options?.transition === "glide") {
      cancelActiveGlide = glideToSite(viewer, selectedSite, previewFrame);
    } else {
      flyToSite(viewer, selectedSite, previewFrame);
    }
    updateAtTime(previewTime);
  }

  viewerHandler.setInputAction((event: { position: Cartesian2 }) => {
    if (disposed) {
      return;
    }

    const positionM = pickEarthPosition(viewer, event.position);

    if (!positionM) {
      return;
    }

    selectSite(positionM, { transition: "glide" });
  }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  const removeTickListener = viewer.clock.onTick.addEventListener((clock) => {
    updateAtTime(clock.currentTime);
  });

  return {
    clearSiteFocus(options?: ClearSiteFocusOptions): void {
      selectedSite = null;
      lastServingId = null;
      handoverCount = 0;
      cancelActiveGlide?.();
      cancelActiveGlide = null;
      if (options?.cancelFlight !== false) {
        viewer.camera.cancelFlight();
      }
      applySelectionState(null, entities);
      hideProxyElements(entities);
      setNoSelectionState(shell, constellation.getSatelliteCount());
    },

    focusSitePosition(positionM: Cartesian3, options?: FocusSiteSelectionOptions): void {
      selectSite(positionM, options);
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
      removeTickListener();
      await attachPromise;

      if (!viewer.isDestroyed() && viewer.dataSources.contains(dataSource)) {
        viewer.dataSources.remove(dataSource);
      }
    }
  };
}
