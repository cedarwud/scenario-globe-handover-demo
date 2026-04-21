import {
  ArcType,
  BoundingSphere,
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Cesium3DTileFeature,
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
  PolylineDashMaterialProperty,
  PolylineGlowMaterialProperty,
  Quaternion,
  ScreenSpaceEventType,
  Transforms,
  Entity,
  type Viewer
} from "cesium";

import type { AppShellMount } from "../app/app-shell";
import {
  LOCAL_DENSITY_LOOKUP,
  LOCAL_DENSITY_LOOKUP_MAX_BACKGROUND_COUNT,
  lookupLocalDensityByLatitude
} from "./local-density-lookup";
import type { LocalDensityLookupResult } from "./local-density-lookup";
import type {
  ConstellationSatelliteSample,
  SyntheticConstellationRuntime
} from "./synthetic-constellation";

type FocusRole = "serving" | "pending" | "context";
type DemoPhase = "tracking" | "prepared" | "switching" | "post";

interface UeAnchor {
  displayName?: string;
  latitudeDeg: number;
  localDensityLookup: LocalDensityLookupResult;
  longitudeDeg: number;
  positionM: Cartesian3;
  selectedAt: JulianDate;
  surfaceHeightM: number;
}

interface UeAnchorSelectionOptions {
  displayName?: string;
  transition?: "fly" | "glide";
}

interface ClearUeAnchorOptions {
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

interface FocusCandidateCache {
  candidateById: Map<string, FocusCandidate>;
  localFrame: Matrix4;
  rankedCandidates: FocusCandidate[];
}

interface FocusEvaluationContext {
  inverseLocalFrame: Matrix4;
  localFrame: Matrix4;
}

// Per-proxy corridor-lane binding state. Each proxy keeps one bound
// satellite id and traverses a shared elevated local sky corridor (§6.2).
// The bound id only changes at lane exit via identity rotation (§6.4).
interface ProxyLaneState {
  boundCandidateId: string;
  laneAzimuthBiasEastM: number;
  traverseEnteredAtPresentationSec: number;
}

// One proxy's per-tick render input: which candidate is visually on this
// corridor lane and which role label it currently carries.
interface ProxyFrame {
  candidate: FocusCandidate;
  role: FocusRole;
}

interface LocalHandoverSemanticFrame {
  baselinePending: FocusCandidate;
  baselineServing: FocusCandidate;
  context: FocusCandidate;
  phase: DemoPhase;
  phaseProgress: number;
  pending: FocusCandidate;
  proxyFrames: readonly ProxyFrame[];
  serving: FocusCandidate;
}

interface LocalHandoverTruthFrame extends LocalHandoverSemanticFrame {
  backgroundCandidates: readonly FocusCandidate[];
  handoverCount: number;
  highlightedOrbitIds: readonly string[];
  servingBhMultiplier: number;
  ueAnchor: UeAnchor;
}

interface CameraLocalFrame {
  forwardLocal: Cartesian3;
  offsetLocal: Cartesian3;
  upLocal: Cartesian3;
}

interface PresentationClockState {
  elapsedSec: number;
  lastCesiumTime: JulianDate;
}

interface FocusCameraPose {
  destinationM: Cartesian3;
  directionM: Cartesian3;
  focusRadiusM: number;
  rangeM: number;
  targetPositionM: Cartesian3;
  upM: Cartesian3;
}

interface LocalHandoverPresentationProxyFrame {
  beamBhMultiplier: number;
  beamCue: LocalHandoverBeamCue | null;
  candidate: FocusCandidate;
  role: FocusRole;
}

interface LocalHandoverBeamCue {
  coneBottomRadius: number;
  coneColor: Color;
  coneTopRadius: number;
  coreLineColor: Color;
  coreLineVisible: boolean;
  coreLineWidth: number;
  lineColor: Color;
  lineDashLength: number;
  lineDashPattern: number;
  lineGapColor: Color;
  lineDepthFailColor: Color;
  lineGlowPower: number;
  lineStyle: "dash" | "glow";
  lineTaperPower: number;
  lineWidth: number;
  tagColor: Color;
  tagPositionT: number;
  tagText: string;
}

interface LocalHandoverPresentationFrame {
  backgroundCandidates: readonly FocusCandidate[];
  highlightedOrbitIds: readonly string[];
  phase: DemoPhase;
  proxyFrames: readonly LocalHandoverPresentationProxyFrame[];
  siteMarkerColor: Color;
  siteMarkerOutlineColor: Color;
  siteMarkerOutlineWidth: number;
  siteMarkerPixelSize: number;
  ueAnchorPositionM: Cartesian3;
}

interface LocalHandoverShellFrame {
  backgroundSatelliteCount: number;
  contextSatelliteText: string;
  detailText: string;
  globalHintText: string;
  handoverPhaseText: string;
  handoverProgress: number;
  localDensityNoteText: string;
  localDensitySummaryText: string;
  lookupSuggestedBackgroundSatelliteCount: number;
  pendingMetricText: string;
  pendingSatelliteText: string;
  recentEventText: string;
  servingMetricText: string;
  servingSatelliteText: string;
  ueAnchorCoordinatesText: string;
  ueAnchorStateText: string;
}

interface LocalHandoverFocusTargets {
  context: FocusCandidate;
  pending: FocusCandidate;
  serving: FocusCandidate;
}

interface LocalHandoverRuntimeState {
  backgroundLanes: ProxyLaneState[];
  handoverCount: number;
  lastServingId: string | null;
  presentationClockState: PresentationClockState | null;
  proxyLanes: ProxyLaneState[];
}

interface StageEntities {
  backgroundSatellites: Entity[];
  beamCones: Entity[];
  beamCoreLinks: Entity[];
  beamLinks: Entity[];
  beamTags: Entity[];
  buildingBoxes: Entity[];
  footprint: Entity;
  proxySatellites: Entity[];
  sitePendingHalo: Entity;
  siteHalo: Entity;
  siteLockStem: Entity;
  siteMarker: Entity;
}

const LOCAL_DEMO_CYCLE_DURATION_REAL_SEC = 8;
const SITE_STAGE_PROXY_MODEL_URI = "models/sat.glb";
const SAT_MODEL_IBL_FACTOR = new Cartesian2(1.0, 1.0);
const SAT_MODEL_LIGHT_COLOR = Color.fromCssColorString("#fff6e6");
const DISPLAY_STAGE_HEADING_RAD = 0;
// Pull the local-focus camera back into a slight down-look so OSM and
// terrain context read more clearly again, while keeping the broader
// P4 framing envelope from the existing site-from-bottom and range
// constants. This slice intentionally tunes pitch only; entry paths,
// corridor motion, and HO/BH presentation contracts stay unchanged.
const SITE_CAMERA_PITCH_RAD = -0.055;
const SITE_CAMERA_MIN_RANGE_M = 620;
const SITE_CAMERA_SITE_FROM_BOTTOM_RATIO = 0.18;
const SITE_CAMERA_FOCUS_RADIUS_MIN_M = 560;
const SITE_CAMERA_FOCUS_RADIUS_SCALE = 0.76;
const SITE_CAMERA_RANGE_MULTIPLIER = 1.5;
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
// Stage-local sky-corridor geometry (§6.2). These are readability
// compressions, not orbit projections. The corridor is front-facing in
// the UE E/N/U frame and is tuned to stay inside the current double-
// click local-view sky envelope.
const STAGE_CORRIDOR_SPAN_M = 2_200;
const STAGE_CORRIDOR_CENTER_NORTH_M = 620;
const STAGE_CORRIDOR_DIAGONAL_NORTH_M = 95;
const STAGE_CORRIDOR_BASE_HEIGHT_M = 500;
const STAGE_CORRIDOR_MIN_HEIGHT_M = 420;
const STAGE_CORRIDOR_HEIGHT_WOBBLE_M = 70;
const STAGE_CORRIDOR_AZIMUTH_BIAS_M = 180;
const STAGE_CORRIDOR_LANE_NORTH_OFFSETS_M = [0, 90, -90] as const;
const STAGE_CORRIDOR_LANE_HEIGHT_OFFSETS_M = [0, 80, -80] as const;
const STAGE_BACKGROUND_SATELLITE_COUNT = LOCAL_DENSITY_LOOKUP_MAX_BACKGROUND_COUNT;
const STAGE_BACKGROUND_LANE_NORTH_OFFSETS_M = [
  -180,
  180,
  -310,
  310,
  -450,
  450,
  -590,
  590
] as const;
const STAGE_BACKGROUND_LANE_HEIGHT_OFFSETS_M = [
  -120,
  120,
  -210,
  210,
  -290,
  290,
  -360,
  360
] as const;
// One full left-edge → right-edge traverse, in local presentation
// seconds. Cesium time remains authoritative; the presentation mapping
// below preserves readability under the repo's default 36x globe clock.
const STAGE_CORRIDOR_CYCLE_SEC = 90;
// Initial traverse phases per lane so the first visible frame already
// reads as one centered proxy, one entering, and one trailing (§6.3).
const STAGE_CORRIDOR_INITIAL_PHASE_FRACTIONS = [0.5, 0.28, 0.78] as const;
const STAGE_BACKGROUND_INITIAL_PHASE_FRACTIONS = [
  0.06,
  0.16,
  0.28,
  0.38,
  0.52,
  0.64,
  0.78,
  0.88
] as const;
const STAGE_CORRIDOR_PROXY_COUNT = STAGE_CORRIDOR_INITIAL_PHASE_FRACTIONS.length;

// Synthetic beam-hopping cadence (§9). This is a within-serving time-share
// cue, orthogonal to handover. It must stay clearly faster than
// LOCAL_DEMO_CYCLE_DURATION_REAL_SEC so the two cues remain visually
// distinguishable (§7.3 channel separation: BH rides opacity/glow only).
const STAGE_BH_CYCLE_SEC = 3.2;
const STAGE_BH_DWELL_FRACTION = 0.65;
// Non-zero floor — the serving beam dims in guard but is never fully
// invisible (§9.2).
const STAGE_BH_GUARD_MULTIPLIER = 0.82;
const LOCAL_PRESENTATION_BASE_RATE = 1 / 36;
const LOCAL_PRESENTATION_MULTIPLIER_EXPONENT = 1.0;
const LOCAL_PRESENTATION_MAX_EFFECTIVE_MULTIPLIER = 10;
const UE_ANCHOR_ENDPOINT_PIXEL_SIZE = 24;
const UE_ANCHOR_ENDPOINT_OUTLINE_WIDTH = 5;
const ROLE_LINK_WIDTH = {
  context: 2,
  pending: 4.5,
  serving: 5.5
} as const satisfies Record<FocusRole, number>;
const ROLE_CORE_LINK_WIDTH = {
  context: 1.5,
  pending: 2.25,
  serving: 2.75
} as const satisfies Record<FocusRole, number>;
const ROLE_LINK_GLOW_POWER = {
  context: 0.07,
  pending: 0.14,
  serving: 0.24
} as const satisfies Record<FocusRole, number>;
const ROLE_LINK_ALPHA = {
  context: 0.28,
  pending: 0.62,
  serving: 0.94
} as const satisfies Record<FocusRole, number>;
const ROLE_LINK_DEPTH_FAIL_ALPHA = {
  context: 0.34,
  pending: 0.72,
  serving: 0.98
} as const satisfies Record<FocusRole, number>;
const ROLE_CORE_LINK_ALPHA = {
  context: 0.32,
  pending: 0.68,
  serving: 0.92
} as const satisfies Record<FocusRole, number>;
const ROLE_CONE_ALPHA = {
  context: 0.045,
  pending: 0.11,
  serving: 0.18
} as const satisfies Record<FocusRole, number>;
const ROLE_CONE_TOP_RADIUS = {
  context: 260,
  pending: 460,
  serving: 380
} as const satisfies Record<FocusRole, number>;
const ROLE_CONE_BOTTOM_RADIUS = {
  context: 2600,
  pending: 5200,
  serving: 4200
} as const satisfies Record<FocusRole, number>;
const ROLE_TAG_ALPHA = {
  context: 0.42,
  pending: 0.74,
  serving: 0.98
} as const satisfies Record<FocusRole, number>;
const ROLE_TAG_POSITION_T = {
  context: 0.44,
  pending: 0.58,
  serving: 0.72
} as const satisfies Record<FocusRole, number>;

const polylinePositionsCache = new WeakMap<Entity, Cartesian3[]>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeTraversePhase(
  lane: ProxyLaneState,
  presentationElapsedSec: number
): number {
  const elapsedSec =
    presentationElapsedSec - lane.traverseEnteredAtPresentationSec;
  const raw = elapsedSec / STAGE_CORRIDOR_CYCLE_SEC;
  return ((raw % 1) + 1) % 1;
}

function computeCorridorAzimuthBiasEastM(azimuthRad: number): number {
  return clamp(Math.sin(azimuthRad), -1, 1) * STAGE_CORRIDOR_AZIMUTH_BIAS_M;
}

// Stage-local corridor position (§6.2). Every lane shares the same
// front-facing left-to-right traverse. Candidate azimuth only nudges the
// lateral bias inside that corridor; it never fans each proxy onto a
// separate sky path.
function createStageCorridorPosition(
  localFrame: Matrix4,
  lane: ProxyLaneState,
  northOffsetM: number,
  heightOffsetM: number,
  presentationElapsedSec: number
): Cartesian3 {
  const traversePhase = computeTraversePhase(lane, presentationElapsedSec);
  const lateralNormalized = traversePhase * 2 - 1;
  const halfSpanM = STAGE_CORRIDOR_SPAN_M / 2;
  const eastM = clamp(
    CesiumMath.lerp(-halfSpanM, halfSpanM, traversePhase) + lane.laneAzimuthBiasEastM,
    -halfSpanM,
    halfSpanM
  );
  const northM =
    STAGE_CORRIDOR_CENTER_NORTH_M +
    northOffsetM -
    lateralNormalized * STAGE_CORRIDOR_DIAGONAL_NORTH_M;
  const upM = Math.max(
    STAGE_CORRIDOR_MIN_HEIGHT_M,
    STAGE_CORRIDOR_BASE_HEIGHT_M +
      heightOffsetM +
      Math.sin(traversePhase * Math.PI * 2) * STAGE_CORRIDOR_HEIGHT_WOBBLE_M
  );

  return createLocalOffsetPositionFromFrame(localFrame, eastM, northM, upM);
}

function createPrimaryCorridorPosition(
  localFrame: Matrix4,
  lane: ProxyLaneState,
  laneIndex: number,
  presentationElapsedSec: number
): Cartesian3 {
  return createStageCorridorPosition(
    localFrame,
    lane,
    STAGE_CORRIDOR_LANE_NORTH_OFFSETS_M[laneIndex] ?? 0,
    STAGE_CORRIDOR_LANE_HEIGHT_OFFSETS_M[laneIndex] ?? 0,
    presentationElapsedSec
  );
}

function createBackgroundCorridorPosition(
  localFrame: Matrix4,
  lane: ProxyLaneState,
  laneIndex: number,
  presentationElapsedSec: number
): Cartesian3 {
  return createStageCorridorPosition(
    localFrame,
    lane,
    STAGE_BACKGROUND_LANE_NORTH_OFFSETS_M[laneIndex] ?? 0,
    STAGE_BACKGROUND_LANE_HEIGHT_OFFSETS_M[laneIndex] ?? 0,
    presentationElapsedSec
  );
}

function setPanelActive(shell: AppShellMount, active: boolean): void {
  shell.ueAnchorPanel.hidden = true;
  shell.ueAnchorPanel.dataset.active = active ? "true" : "false";
  shell.handoverPanel.dataset.active = active ? "true" : "false";
  shell.handoverPanel.hidden = true;
}

function formatLocalDensitySummary(
  localDensityLookup: LocalDensityLookupResult
): string {
  return `UE latitude ${localDensityLookup.latitudeDeg.toFixed(
    2
  )}° • demo lookup baseline ${localDensityLookup.demoLookupElevationDeg}° • suggested background satellites ${localDensityLookup.suggestedBackgroundSatelliteCount}`;
}

function formatLocalDensityNote(
  localDensityLookup: LocalDensityLookupResult
): string {
  return `${localDensityLookup.band.label} band from the repo-owned latitude table. Research baseline ${localDensityLookup.researchBaselineElevationDeg}° remains separate from the local-view ${localDensityLookup.demoLookupElevationDeg}° presentation lookup.`;
}

function setNoSelectionState(shell: AppShellMount, satelliteCount: number): void {
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

function formatCoordinates(ueAnchor: UeAnchor): string {
  return `${ueAnchor.latitudeDeg.toFixed(4)}°, ${ueAnchor.longitudeDeg.toFixed(
    4
  )}° • ${ueAnchor.surfaceHeightM.toFixed(0)} m`;
}

function formatUeAnchorHeading(ueAnchor: UeAnchor): string {
  return ueAnchor.displayName
    ? `UE anchored at ${ueAnchor.displayName}`
    : `UE anchored at ${ueAnchor.latitudeDeg.toFixed(2)}°, ${ueAnchor.longitudeDeg.toFixed(2)}°`;
}

function formatUeAnchorMarkerLabel(ueAnchor: UeAnchor): string {
  return ueAnchor.displayName ? `UE • ${ueAnchor.displayName}` : "UE";
}

function colorForRole(role: FocusRole): Color {
  return ROLE_COLORS[role];
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

function toUeAnchor(
  positionM: Cartesian3,
  time: JulianDate,
  displayName?: string
): UeAnchor {
  const cartographic = Cartographic.fromCartesian(positionM);
  const latitudeDeg = (cartographic.latitude * 180) / Math.PI;
  const stagedSurfaceHeightM = Math.max(cartographic.height, 0);
  const stagedPositionM = Cartesian3.fromRadians(
    cartographic.longitude,
    cartographic.latitude,
    stagedSurfaceHeightM
  );

  return {
    displayName,
    latitudeDeg,
    localDensityLookup: lookupLocalDensityByLatitude(latitudeDeg),
    longitudeDeg: (cartographic.longitude * 180) / Math.PI,
    positionM: stagedPositionM,
    selectedAt: JulianDate.clone(time),
    surfaceHeightM: stagedSurfaceHeightM
  };
}

function createLocalFrame(ueAnchor: UeAnchor): Matrix4 {
  return Transforms.eastNorthUpToFixedFrame(ueAnchor.positionM);
}

function createFocusEvaluationContext(ueAnchor: UeAnchor): FocusEvaluationContext {
  const localFrame = createLocalFrame(ueAnchor);
  return {
    inverseLocalFrame: Matrix4.inverseTransformation(localFrame, new Matrix4()),
    localFrame
  };
}

function mapCesiumDeltaToPresentationDeltaSec(
  cesiumDeltaSec: number,
  clockMultiplier: number
): number {
  if (!Number.isFinite(cesiumDeltaSec) || cesiumDeltaSec === 0) {
    return 0;
  }

  const multiplierMagnitude = Math.abs(clockMultiplier);
  if (!Number.isFinite(multiplierMagnitude) || multiplierMagnitude <= 1e-6) {
    return 0;
  }

  const baseRealtimeDeltaSec = cesiumDeltaSec / multiplierMagnitude;
  const effectiveMultiplier = clamp(
    LOCAL_PRESENTATION_BASE_RATE *
      Math.pow(multiplierMagnitude, LOCAL_PRESENTATION_MULTIPLIER_EXPONENT),
    LOCAL_PRESENTATION_BASE_RATE,
    LOCAL_PRESENTATION_MAX_EFFECTIVE_MULTIPLIER
  );
  return baseRealtimeDeltaSec * effectiveMultiplier;
}

function createLocalOffsetPositionFromFrame(
  localFrame: Matrix4,
  eastM: number,
  northM: number,
  upM: number
): Cartesian3 {
  return Matrix4.multiplyByPoint(
    localFrame,
    new Cartesian3(eastM, northM, upM),
    new Cartesian3()
  );
}

function createLocalOffsetPosition(
  ueAnchor: UeAnchor,
  eastM: number,
  northM: number,
  upM: number
): Cartesian3 {
  return createLocalOffsetPositionFromFrame(
    createLocalFrame(ueAnchor),
    eastM,
    northM,
    upM
  );
}

function evaluateCandidate(
  context: FocusEvaluationContext,
  sample: ConstellationSatelliteSample
): FocusCandidate {
  const localPoint = Matrix4.multiplyByPoint(
    context.inverseLocalFrame,
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
  const proxyPositionM = createLocalOffsetPositionFromFrame(
    context.localFrame,
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

function buildFocusCandidateCache(
  ueAnchor: UeAnchor,
  samples: ReadonlyArray<ConstellationSatelliteSample>
): FocusCandidateCache {
  const context = createFocusEvaluationContext(ueAnchor);
  const candidates = samples.map((sample) => evaluateCandidate(context, sample));

  return {
    candidateById: new Map(candidates.map((candidate) => [candidate.id, candidate])),
    localFrame: context.localFrame,
    rankedCandidates: [...candidates].sort((left, right) => right.score - left.score)
  };
}

function pickRotationCandidate(
  rankedCandidates: ReadonlyArray<FocusCandidate>,
  excludedIds: ReadonlySet<string>,
  preferredDifferentFromId?: string
): FocusCandidate | null {
  let fallback: FocusCandidate | null = null;
  for (const candidate of rankedCandidates) {
    if (excludedIds.has(candidate.id)) {
      continue;
    }
    if (!preferredDifferentFromId || candidate.id !== preferredDifferentFromId) {
      return candidate;
    }
    if (!fallback) {
      fallback = candidate;
    }
  }
  return fallback;
}

// Seed per-proxy corridor lanes at UE placement (§6.1, §6.3). Initial
// phase fractions give an instant "center / entering / trailing"
// composition even before the first tick.
function initializeProxyLanes(
  rankedCandidates: ReadonlyArray<FocusCandidate>,
  presentationElapsedSec: number
): ProxyLaneState[] {
  const lanes: ProxyLaneState[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < STAGE_CORRIDOR_PROXY_COUNT; i += 1) {
    const phaseFraction = STAGE_CORRIDOR_INITIAL_PHASE_FRACTIONS[i] ?? 0;
    const candidate =
      pickRotationCandidate(rankedCandidates, seenIds) ?? rankedCandidates[0];
    if (!candidate) {
      break;
    }
    seenIds.add(candidate.id);
    lanes.push({
      boundCandidateId: candidate.id,
      laneAzimuthBiasEastM: computeCorridorAzimuthBiasEastM(candidate.azimuthRad),
      traverseEnteredAtPresentationSec:
        presentationElapsedSec - phaseFraction * STAGE_CORRIDOR_CYCLE_SEC
    });
  }

  return lanes;
}

function initializeBackgroundLanes(
  rankedCandidates: ReadonlyArray<FocusCandidate>,
  presentationElapsedSec: number,
  count: number,
  excludedIds: ReadonlySet<string>
): ProxyLaneState[] {
  const lanes: ProxyLaneState[] = [];
  const seenIds = new Set<string>(excludedIds);

  for (let i = 0; i < count; i += 1) {
    const phaseFraction = STAGE_BACKGROUND_INITIAL_PHASE_FRACTIONS[i] ?? 0;
    const candidate = pickRotationCandidate(rankedCandidates, seenIds);
    if (!candidate) {
      break;
    }
    seenIds.add(candidate.id);
    lanes.push({
      boundCandidateId: candidate.id,
      laneAzimuthBiasEastM: computeCorridorAzimuthBiasEastM(candidate.azimuthRad),
      traverseEnteredAtPresentationSec:
        presentationElapsedSec - phaseFraction * STAGE_CORRIDOR_CYCLE_SEC
    });
  }

  return lanes;
}

// Identity rotation hook (§6.4). When a lane reaches its exit edge,
// rebind to the next ranked candidate not currently bound on another
// proxy and advance traverseEnteredAtPresentationSec by exactly one cycle
// so the phase stagger (§6.3) is preserved across rotations.
// This never modifies the HO counter — §8.3's counting rule is driven
// by serving-id changes in buildDemoFrame output, not by this hook.
function advanceProxyLanes(
  lanes: ProxyLaneState[],
  otherLanes: ReadonlyArray<ProxyLaneState>,
  rankedCandidates: ReadonlyArray<FocusCandidate>,
  presentationElapsedSec: number
): void {
  for (let i = 0; i < lanes.length; i += 1) {
    const lane = lanes[i];
    while (
      presentationElapsedSec - lane.traverseEnteredAtPresentationSec >=
      STAGE_CORRIDOR_CYCLE_SEC
    ) {
      const otherIds = new Set<string>();
      for (const otherLane of otherLanes) {
        otherIds.add(otherLane.boundCandidateId);
      }
      for (let j = 0; j < lanes.length; j += 1) {
        if (j !== i) {
          otherIds.add(lanes[j].boundCandidateId);
        }
      }
      const rotated =
        pickRotationCandidate(
          rankedCandidates,
          otherIds,
          lane.boundCandidateId
        ) ?? rankedCandidates[0];
      if (rotated) {
        lane.boundCandidateId = rotated.id;
        lane.laneAzimuthBiasEastM = computeCorridorAzimuthBiasEastM(rotated.azimuthRad);
      }
      lane.traverseEnteredAtPresentationSec += STAGE_CORRIDOR_CYCLE_SEC;
    }
  }
}

function buildBackgroundFrames(
  candidateCache: FocusCandidateCache,
  lanes: ReadonlyArray<ProxyLaneState>,
  presentationElapsedSec: number
): FocusCandidate[] {
  const backgroundCandidates: FocusCandidate[] = [];

  for (let laneIndex = 0; laneIndex < lanes.length; laneIndex += 1) {
    const lane = lanes[laneIndex];
    const candidate = candidateCache.candidateById.get(lane.boundCandidateId);
    if (!candidate) {
      continue;
    }

    backgroundCandidates.push({
      ...candidate,
      proxyPositionM: createBackgroundCorridorPosition(
        candidateCache.localFrame,
        lane,
        laneIndex,
        presentationElapsedSec
      )
    });
  }

  return backgroundCandidates;
}

function buildLocalHandoverSemanticFrame(
  candidateCache: FocusCandidateCache,
  lanes: ReadonlyArray<ProxyLaneState>,
  presentationElapsedSec: number
): LocalHandoverSemanticFrame {
  // Per-proxy FocusCandidate with corridor-derived proxyPositionM (§6.2).
  // The slot-based proxyPositionM produced by evaluateCandidate is
  // intentionally overwritten here — under the current demo contract
  // the proxy position comes from the shared corridor lane, never from
  // the role label.
  const proxyCandidates: FocusCandidate[] = [];
  for (let laneIndex = 0; laneIndex < lanes.length; laneIndex += 1) {
    const lane = lanes[laneIndex];
    const candidate = candidateCache.candidateById.get(lane.boundCandidateId);
    if (!candidate) {
      continue;
    }
    proxyCandidates.push({
      ...candidate,
      proxyPositionM: createPrimaryCorridorPosition(
        candidateCache.localFrame,
        lane,
        laneIndex,
        presentationElapsedSec
      )
    });
  }

  const safeCandidates =
    proxyCandidates.length >= STAGE_CORRIDOR_PROXY_COUNT
      ? proxyCandidates
      : [
          ...proxyCandidates,
          ...proxyCandidates.slice(
            0,
            Math.max(0, STAGE_CORRIDOR_PROXY_COUNT - proxyCandidates.length)
          )
        ];

  const rankedByScore = [...safeCandidates].sort(
    (left, right) => right.score - left.score
  );
  const phaseProgress =
    (((presentationElapsedSec % LOCAL_DEMO_CYCLE_DURATION_REAL_SEC) +
      LOCAL_DEMO_CYCLE_DURATION_REAL_SEC) %
      LOCAL_DEMO_CYCLE_DURATION_REAL_SEC) /
    LOCAL_DEMO_CYCLE_DURATION_REAL_SEC;
  const baseIndex =
    Math.floor(presentationElapsedSec / LOCAL_DEMO_CYCLE_DURATION_REAL_SEC) %
    rankedByScore.length;
  const baselineServing =
    rankedByScore[(baseIndex + rankedByScore.length) % rankedByScore.length];
  const baselinePending = rankedByScore[(baseIndex + 1) % rankedByScore.length];
  const baselineContext = rankedByScore[(baseIndex + 2) % rankedByScore.length];

  // Switching / post identity swap (§8.3 — HO contract unchanged). Only
  // the role LABEL moves between proxies; proxy corridor positions do not
  // teleport (§6.5).
  const swapped = phaseProgress >= 0.72;
  const displayedServing = swapped ? baselinePending : baselineServing;
  const displayedPending = swapped ? baselineServing : baselinePending;
  const displayedContext = baselineContext;

  const proxyFrames: ProxyFrame[] = safeCandidates.map((candidate) => ({
    candidate,
    role:
      candidate.id === displayedServing.id
        ? "serving"
        : candidate.id === displayedPending.id
          ? "pending"
          : "context"
  }));

  let phase: DemoPhase;

  if (phaseProgress < 0.42) {
    phase = "tracking";
  } else if (phaseProgress < 0.72) {
    phase = "prepared";
  } else if (phaseProgress < 0.88) {
    phase = "switching";
  } else {
    phase = "post";
  }

  return {
    baselinePending,
    baselineServing,
    context: displayedContext,
    phase,
    phaseProgress,
    pending: displayedPending,
    proxyFrames,
    serving: displayedServing
  };
}

function createPresentationClockState(time: JulianDate): PresentationClockState {
  return {
    elapsedSec: 0,
    lastCesiumTime: JulianDate.clone(time)
  };
}

function buildLocalHandoverTruthFrame({
  runtimeState,
  samples,
  time,
  ueAnchor,
  viewerClockMultiplier
}: {
  runtimeState: LocalHandoverRuntimeState;
  samples: ReadonlyArray<ConstellationSatelliteSample>;
  time: JulianDate;
  ueAnchor: UeAnchor;
  viewerClockMultiplier: number;
}): LocalHandoverTruthFrame {
  const candidateCache = buildFocusCandidateCache(ueAnchor, samples);
  const presentationClockState =
    runtimeState.presentationClockState ?? createPresentationClockState(time);
  runtimeState.presentationClockState = presentationClockState;

  const presentationClockDeltaSec = JulianDate.secondsDifference(
    time,
    presentationClockState.lastCesiumTime
  );
  JulianDate.clone(time, presentationClockState.lastCesiumTime);
  presentationClockState.elapsedSec = Math.max(
    presentationClockState.elapsedSec +
      mapCesiumDeltaToPresentationDeltaSec(
        presentationClockDeltaSec,
        viewerClockMultiplier
      ),
    0
  );
  const presentationElapsedSec = presentationClockState.elapsedSec;

  // Identity rotation hook (§6.4) — runs before the frame so any
  // lane exit recast is already reflected in boundCandidateId when
  // buildLocalHandoverSemanticFrame reads it.
  advanceProxyLanes(
    runtimeState.proxyLanes,
    runtimeState.backgroundLanes,
    candidateCache.rankedCandidates,
    presentationElapsedSec
  );
  advanceProxyLanes(
    runtimeState.backgroundLanes,
    runtimeState.proxyLanes,
    candidateCache.rankedCandidates,
    presentationElapsedSec
  );

  const semanticFrame = buildLocalHandoverSemanticFrame(
    candidateCache,
    runtimeState.proxyLanes,
    presentationElapsedSec
  );

  // HO counter rule (§8.3) — unchanged. Serving id changes from either
  // ranking-driven role swap or serving-proxy identity rotation both
  // increment the counter exactly once.
  if (semanticFrame.serving.id !== runtimeState.lastServingId) {
    if (runtimeState.lastServingId !== null) {
      runtimeState.handoverCount += 1;
    }
    runtimeState.lastServingId = semanticFrame.serving.id;
  }

  return {
    ...semanticFrame,
    backgroundCandidates: buildBackgroundFrames(
      candidateCache,
      runtimeState.backgroundLanes,
      presentationElapsedSec
    ),
    handoverCount: runtimeState.handoverCount,
    highlightedOrbitIds: [],
    servingBhMultiplier: computeBeamHopModulation(presentationElapsedSec),
    ueAnchor
  };
}

function deriveLocalHandoverPresentationFrame(
  truthFrame: LocalHandoverTruthFrame
): LocalHandoverPresentationFrame {
  return {
    backgroundCandidates: truthFrame.backgroundCandidates,
    highlightedOrbitIds: truthFrame.highlightedOrbitIds,
    phase: truthFrame.phase,
    proxyFrames: truthFrame.proxyFrames.map(({ candidate, role }) => ({
      beamBhMultiplier: role === "serving" ? truthFrame.servingBhMultiplier : 1.0,
      beamCue: createBeamCue(role, truthFrame.phase),
      candidate,
      role
    })),
    siteMarkerColor: Color.fromCssColorString("#ffffff"),
    siteMarkerOutlineColor: colorForRole("serving"),
    siteMarkerOutlineWidth: UE_ANCHOR_ENDPOINT_OUTLINE_WIDTH,
    siteMarkerPixelSize: UE_ANCHOR_ENDPOINT_PIXEL_SIZE,
    ueAnchorPositionM: truthFrame.ueAnchor.positionM
  };
}

function describeLocalHandoverPhase(
  truthFrame: LocalHandoverTruthFrame
): {
  detailText: string;
  handoverPhaseText: string;
  recentEventText: string;
} {
  if (truthFrame.phase === "tracking") {
    return {
      detailText:
        "The UE anchor stays locked while the global orbit layer keeps moving. The local stage compresses the geometry into one elevated sky corridor so the handover narrative stays readable at city scale.",
      handoverPhaseText: "Tracking Stable Beam",
      recentEventText: "Monitoring candidate offset"
    };
  }

  if (truthFrame.phase === "prepared") {
    return {
      detailText:
        "The pending satellite is promoted inside the shared corridor before the visual switch. This is a demo cue, not a real handover decision path.",
      handoverPhaseText: "Prepared Target Window",
      recentEventText: `${truthFrame.baselineServing.id} preparing ${truthFrame.baselinePending.id}`
    };
  }

  if (truthFrame.phase === "switching") {
    return {
      detailText:
        "The serving role flips across the corridor cast while the global satellites keep their original orbit motion. This is the core dual-scale demo behavior.",
      handoverPhaseText: "Synthetic Handover Switch",
      recentEventText: `${truthFrame.baselineServing.id} → ${truthFrame.baselinePending.id}`
    };
  }

  return {
    detailText:
      "Post-switch settling keeps the previous satellite on the stage briefly so you can read the transition without losing context.",
    handoverPhaseText: "Post-Handover Settle",
    recentEventText: `${truthFrame.baselineServing.id} released UE anchor focus`
  };
}

function deriveLocalHandoverShellFrame(
  truthFrame: LocalHandoverTruthFrame
): LocalHandoverShellFrame {
  const phaseCopy = describeLocalHandoverPhase(truthFrame);
  const recentEventText =
    truthFrame.handoverCount > 0
      ? `${phaseCopy.recentEventText} • HO count ${truthFrame.handoverCount}`
      : phaseCopy.recentEventText;

  return {
    backgroundSatelliteCount: truthFrame.backgroundCandidates.length,
    contextSatelliteText: `${truthFrame.context.id} • ${truthFrame.context.elevationDeg.toFixed(
      1
    )}°`,
    detailText: phaseCopy.detailText,
    globalHintText:
      "The orbit layer remains global while the UE anchor runs a compressed local focus stage derived from the strongest synthetic candidates.",
    handoverPhaseText: phaseCopy.handoverPhaseText,
    handoverProgress: truthFrame.phaseProgress,
    localDensityNoteText: formatLocalDensityNote(truthFrame.ueAnchor.localDensityLookup),
    localDensitySummaryText: formatLocalDensitySummary(
      truthFrame.ueAnchor.localDensityLookup
    ),
    lookupSuggestedBackgroundSatelliteCount:
      truthFrame.ueAnchor.localDensityLookup.suggestedBackgroundSatelliteCount,
    pendingMetricText: `${truthFrame.pending.metricDb.toFixed(
      1
    )} dB • ${truthFrame.pending.elevationDeg.toFixed(
      1
    )}° • ${truthFrame.pending.rangeKm.toFixed(0)} km`,
    pendingSatelliteText: truthFrame.pending.id,
    recentEventText,
    servingMetricText: `${truthFrame.serving.metricDb.toFixed(
      1
    )} dB • ${truthFrame.serving.elevationDeg.toFixed(
      1
    )}° • ${truthFrame.serving.rangeKm.toFixed(0)} km`,
    servingSatelliteText: truthFrame.serving.id,
    ueAnchorCoordinatesText: formatCoordinates(truthFrame.ueAnchor),
    ueAnchorStateText: formatUeAnchorHeading(truthFrame.ueAnchor)
  };
}

function createStageEntities(dataSource: CustomDataSource): StageEntities {
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
  const siteHalo = dataSource.entities.add({
    id: "site-halo",
    ellipse: {
      fill: true,
      material: Color.fromCssColorString("#7ecdf8").withAlpha(0.055),
      outline: false,
      semiMajorAxis: 115,
      semiMinorAxis: 115
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
  const footprint = dataSource.entities.add({
    id: "focus-footprint",
    ellipse: {
      fill: true,
      material: Color.fromCssColorString("#90d8ff").withAlpha(0.028),
      outline: false,
      semiMajorAxis: 420,
      semiMinorAxis: 420
    },
    show: false
  });
  const siteLockStem = dataSource.entities.add({
    id: "site-lock-stem",
    polyline: {
      arcType: ArcType.NONE,
      material: new PolylineGlowMaterialProperty({
        color: colorForRole("serving").withAlpha(0.82),
        glowPower: 0.18,
        taperPower: 0.08
      }),
      width: 4
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

  const backgroundSatellites = Array.from({ length: STAGE_BACKGROUND_SATELLITE_COUNT }, (_, index) =>
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
    backgroundSatellites,
    beamCones,
    beamCoreLinks,
    beamLinks,
    beamTags,
    buildingBoxes,
    footprint,
    proxySatellites,
    sitePendingHalo,
    siteHalo,
    siteLockStem,
    siteMarker
  };
}

function applySelectionState(ueAnchor: UeAnchor | null, entities: StageEntities): void {
  const visible = Boolean(ueAnchor);
  entities.siteMarker.show = visible;
  entities.siteHalo.show = false;
  entities.sitePendingHalo.show = false;
  entities.siteLockStem.show = false;
  entities.footprint.show = false;

  for (const building of entities.buildingBoxes) {
    building.show = visible && SHOW_DEMO_BUILDING_BOXES;
  }
}

function syncUeAnchorStage(ueAnchor: UeAnchor, entities: StageEntities): void {
  setEntityPosition(entities.siteMarker, ueAnchor.positionM);
  setLabelText(entities.siteMarker, formatUeAnchorMarkerLabel(ueAnchor));
  setEntityPosition(entities.siteHalo, ueAnchor.positionM);
  setEntityPosition(entities.sitePendingHalo, ueAnchor.positionM);
  setEntityPosition(entities.footprint, ueAnchor.positionM);

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
      ueAnchor,
      layout.eastM,
      layout.northM,
      layout.heightM / 2
    ));
  }
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

function hideProxyElements(entities: StageEntities): void {
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
function computeBeamHopModulation(presentationElapsedSec: number): number {
  const raw = presentationElapsedSec / STAGE_BH_CYCLE_SEC;
  const bhPhase = ((raw % 1) + 1) % 1;
  return bhPhase < STAGE_BH_DWELL_FRACTION ? 1.0 : STAGE_BH_GUARD_MULTIPLIER;
}

function createBeamCue(
  role: FocusRole,
  phase: DemoPhase
): LocalHandoverBeamCue | null {
  const roleColor = colorForRole(role);
  const pendingEmphasis =
    role === "pending" && (phase === "prepared" || phase === "switching");

  if (role === "context") {
    return null;
  }

  if (role === "pending" && pendingEmphasis) {
    return {
      coneBottomRadius: 5_600,
      coneColor: roleColor.withAlpha(0.16),
      coneTopRadius: 520,
      coreLineColor: Color.fromCssColorString("#fff2db").withAlpha(0.84),
      coreLineVisible: false,
      coreLineWidth: 2.5,
      lineColor: roleColor.withAlpha(0.86),
      lineDashLength: 18,
      lineDashPattern: 0b1111000011110000,
      lineGapColor: roleColor.withAlpha(0.08),
      lineDepthFailColor: roleColor.withAlpha(0.9),
      lineGlowPower: 0.2,
      lineStyle: "dash",
      lineTaperPower: 0.14,
      lineWidth: 4.25,
      tagColor: roleColor.withAlpha(0.9),
      tagPositionT: ROLE_TAG_POSITION_T.pending,
      tagText: "PENDING"
    };
  }

  if (role === "pending") {
    return null;
  }

  return {
    coneBottomRadius: ROLE_CONE_BOTTOM_RADIUS[role],
    coneColor: roleColor.withAlpha(ROLE_CONE_ALPHA[role]),
    coneTopRadius: ROLE_CONE_TOP_RADIUS[role],
    coreLineColor:
      role === "serving"
        ? Color.fromCssColorString("#ffffff").withAlpha(ROLE_CORE_LINK_ALPHA[role])
        : roleColor.withAlpha(ROLE_CORE_LINK_ALPHA[role]),
    coreLineVisible: true,
    coreLineWidth: ROLE_CORE_LINK_WIDTH[role],
    lineColor: roleColor.withAlpha(ROLE_LINK_ALPHA[role]),
    lineDashLength: 16,
    lineDashPattern: 0b1111111111111111,
    lineGapColor: Color.TRANSPARENT,
    lineDepthFailColor: roleColor.withAlpha(ROLE_LINK_DEPTH_FAIL_ALPHA[role]),
    lineGlowPower: ROLE_LINK_GLOW_POWER[role],
    lineStyle: "glow",
    lineTaperPower: 0.18,
    lineWidth: ROLE_LINK_WIDTH[role],
    tagColor: roleColor.withAlpha(ROLE_TAG_ALPHA[role]),
    tagPositionT: ROLE_TAG_POSITION_T[role],
    tagText: role.toUpperCase()
  };
}

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

function syncLocalHandoverShellFrame(
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

function renderLocalHandoverPresentationFrame({
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

function createFocusTargetPosition(viewer: Viewer, ueAnchor: UeAnchor, rangeM: number): Cartesian3 {
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
    ueAnchor,
    targetOffsetLocal.x,
    targetOffsetLocal.y,
    targetOffsetLocal.z
  );
}

function createFocusPose(
  viewer: Viewer,
  ueAnchor: UeAnchor,
  frame: LocalHandoverFocusTargets
): FocusCameraPose {
  const maxProxyDistanceM = Math.max(
    Cartesian3.distance(ueAnchor.positionM, frame.serving.proxyPositionM),
    Cartesian3.distance(ueAnchor.positionM, frame.pending.proxyPositionM),
    Cartesian3.distance(ueAnchor.positionM, frame.context.proxyPositionM)
  );

  const focusRadiusM = Math.max(
    maxProxyDistanceM * SITE_CAMERA_FOCUS_RADIUS_SCALE,
    SITE_CAMERA_FOCUS_RADIUS_MIN_M
  );
  const rangeM = Math.max(focusRadiusM * SITE_CAMERA_RANGE_MULTIPLIER, SITE_CAMERA_MIN_RANGE_M);
  const targetPositionM = createFocusTargetPosition(viewer, ueAnchor,rangeM);
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

function glideToUeAnchor(
  viewer: Viewer,
  ueAnchor: UeAnchor,
  frame: LocalHandoverFocusTargets
): () => void {
  const endPose = createFocusPose(viewer, ueAnchor, frame);
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

function flyToUeAnchor(
  viewer: Viewer,
  ueAnchor: UeAnchor,
  frame: LocalHandoverFocusTargets
): void {
  const endPose = createFocusPose(viewer, ueAnchor, frame);

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

  function isStageEntity(entity: Entity | null | undefined): boolean {
    return Boolean(entity && dataSource.entities.contains(entity));
  }

  function getPickedEntity(picked: unknown): Entity | undefined {
    if (!picked || typeof picked !== "object") {
      return undefined;
    }

    const maybePicked = picked as { id?: unknown; primitive?: { id?: unknown } };
    const candidate = maybePicked.id ?? maybePicked.primitive?.id;
    return candidate instanceof Entity ? candidate : undefined;
  }

  function isStagePick(picked: unknown): boolean {
    const entity = getPickedEntity(picked);
    return isStageEntity(entity);
  }

  function getCesium3DTileFeatureDescription(feature: Cesium3DTileFeature): string {
    const propertyIds = feature.getPropertyIds();
    let html = "";

    propertyIds.forEach((propertyId) => {
      const value = feature.getProperty(propertyId);
      if (value !== undefined && value !== null) {
        html += `<tr><th>${propertyId}</th><td>${value}</td></tr>`;
      }
    });

    if (html.length > 0) {
      html = `<table class="cesium-infoBox-defaultTable"><tbody>${html}</tbody></table>`;
    }

    return html;
  }

  function getCesium3DTileFeatureName(feature: Cesium3DTileFeature): string {
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
        return String(item);
      }
    }

    return "Unnamed Feature";
  }

  function createTileFeatureSelectionEntity(feature: Cesium3DTileFeature): Entity {
    return new Entity({
      description: getCesium3DTileFeatureDescription(feature),
      name: getCesium3DTileFeatureName(feature)
    });
  }

  function pickThroughStageOverlays(windowPosition: Cartesian2): Entity | undefined {
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
    if (!isStagePick(primaryPick)) {
      originalLeftClickAction?.(event);
      return;
    }

    viewer.selectedEntity = pickThroughStageOverlays(event.position);
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
