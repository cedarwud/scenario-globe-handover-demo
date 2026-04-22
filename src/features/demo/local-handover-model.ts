import {
  Cartesian3,
  Cartographic,
  Color,
  JulianDate,
  Math as CesiumMath,
  Matrix4,
  Transforms
} from "cesium";

import {
  LOCAL_DENSITY_LOOKUP_MAX_BACKGROUND_COUNT,
  lookupLocalDensityByLatitude
} from "./local-density-lookup";
import type { LocalDensityLookupResult } from "./local-density-lookup";
import type { ConstellationSatelliteSample } from "./synthetic-constellation";

export type FocusRole = "serving" | "pending" | "context";
export type DemoPhase = "tracking" | "prepared" | "switching" | "post";

export interface UeAnchor {
  displayName?: string;
  latitudeDeg: number;
  localDensityLookup: LocalDensityLookupResult;
  longitudeDeg: number;
  positionM: Cartesian3;
  selectedAt: JulianDate;
  surfaceHeightM: number;
}

export interface FocusCandidate {
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

export interface FocusCandidateCache {
  candidateById: Map<string, FocusCandidate>;
  localFrame: Matrix4;
  rankedCandidates: FocusCandidate[];
}

interface FocusEvaluationContext {
  inverseLocalFrame: Matrix4;
  localFrame: Matrix4;
}

export interface ProxyLaneState {
  boundCandidateId: string;
  laneAzimuthBiasEastM: number;
  traverseEnteredAtPresentationSec: number;
}

interface ProxyFrame {
  candidate: FocusCandidate;
  role: FocusRole;
}

export interface LocalHandoverSemanticFrame {
  baselinePending: FocusCandidate;
  baselineServing: FocusCandidate;
  context: FocusCandidate;
  phase: DemoPhase;
  phaseProgress: number;
  pending: FocusCandidate;
  proxyFrames: readonly ProxyFrame[];
  serving: FocusCandidate;
}

export interface LocalHandoverTruthFrame extends LocalHandoverSemanticFrame {
  backgroundCandidates: readonly FocusCandidate[];
  handoverCount: number;
  highlightedOrbitIds: readonly string[];
  servingBhMultiplier: number;
  ueAnchor: UeAnchor;
}

export interface PresentationClockState {
  elapsedSec: number;
  lastCesiumTime: JulianDate;
}

export interface LocalHandoverBeamCue {
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

export interface LocalHandoverPresentationProxyFrame {
  beamBhMultiplier: number;
  beamCue: LocalHandoverBeamCue | null;
  candidate: FocusCandidate;
  role: FocusRole;
}

export interface LocalHandoverPresentationFrame {
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

export interface LocalHandoverShellFrame {
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

export interface LocalHandoverFocusTargets {
  context: FocusCandidate;
  pending: FocusCandidate;
  serving: FocusCandidate;
}

export interface LocalHandoverRuntimeState {
  backgroundLanes: ProxyLaneState[];
  handoverCount: number;
  lastServingId: string | null;
  presentationClockState: PresentationClockState | null;
  proxyLanes: ProxyLaneState[];
}

const LOCAL_DEMO_CYCLE_DURATION_REAL_SEC = 8;
const PROXY_RADIUS_MIN_M = 700;
const PROXY_RADIUS_MAX_M = 1_700;
const PROXY_HEIGHT_MIN_M = 1_500;
const PROXY_HEIGHT_MAX_M = 3_400;
const ROLE_COLORS = {
  serving: Color.fromCssColorString("#54c7ff"),
  pending: Color.fromCssColorString("#ffb347"),
  context: Color.fromCssColorString("#dce7f2")
} as const satisfies Record<FocusRole, Color>;
const STAGE_CORRIDOR_SPAN_M = 2_200;
const STAGE_CORRIDOR_CENTER_NORTH_M = 620;
const STAGE_CORRIDOR_DIAGONAL_NORTH_M = 95;
const STAGE_CORRIDOR_BASE_HEIGHT_M = 500;
const STAGE_CORRIDOR_MIN_HEIGHT_M = 420;
const STAGE_CORRIDOR_HEIGHT_WOBBLE_M = 70;
const STAGE_CORRIDOR_AZIMUTH_BIAS_M = 180;
const STAGE_CORRIDOR_LANE_NORTH_OFFSETS_M = [0, 90, -90] as const;
const STAGE_CORRIDOR_LANE_HEIGHT_OFFSETS_M = [0, 80, -80] as const;
export const STAGE_BACKGROUND_SATELLITE_COUNT =
  LOCAL_DENSITY_LOOKUP_MAX_BACKGROUND_COUNT;
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
const STAGE_CORRIDOR_CYCLE_SEC = 90;
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
const STAGE_BH_CYCLE_SEC = 3.2;
const STAGE_BH_DWELL_FRACTION = 0.65;
const STAGE_BH_GUARD_MULTIPLIER = 0.82;
const LOCAL_PRESENTATION_BASE_RATE = 1 / 36;
const LOCAL_PRESENTATION_MULTIPLIER_EXPONENT = 1.0;
const LOCAL_PRESENTATION_MAX_EFFECTIVE_MULTIPLIER = 10;
export const UE_ANCHOR_ENDPOINT_PIXEL_SIZE = 24;
export const UE_ANCHOR_ENDPOINT_OUTLINE_WIDTH = 5;
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
    CesiumMath.lerp(-halfSpanM, halfSpanM, traversePhase) +
      lane.laneAzimuthBiasEastM,
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

function formatLocalDensitySummary(
  localDensityLookup: LocalDensityLookupResult
): string {
  return `UE latitude ${localDensityLookup.latitudeDeg.toFixed(
    2
  )}° • demo lookup baseline ${
    localDensityLookup.demoLookupElevationDeg
  }° • suggested background satellites ${
    localDensityLookup.suggestedBackgroundSatelliteCount
  }`;
}

function formatLocalDensityNote(
  localDensityLookup: LocalDensityLookupResult
): string {
  return `${localDensityLookup.band.label} band from the repo-owned latitude table. Research baseline ${localDensityLookup.researchBaselineElevationDeg}° remains separate from the local-view ${localDensityLookup.demoLookupElevationDeg}° presentation lookup.`;
}

function formatCoordinates(ueAnchor: UeAnchor): string {
  return `${ueAnchor.latitudeDeg.toFixed(4)}°, ${ueAnchor.longitudeDeg.toFixed(
    4
  )}° • ${ueAnchor.surfaceHeightM.toFixed(0)} m`;
}

function formatUeAnchorHeading(ueAnchor: UeAnchor): string {
  return ueAnchor.displayName
    ? `UE anchored at ${ueAnchor.displayName}`
    : `UE anchored at ${ueAnchor.latitudeDeg.toFixed(
        2
      )}°, ${ueAnchor.longitudeDeg.toFixed(2)}°`;
}

export function formatUeAnchorMarkerLabel(ueAnchor: UeAnchor): string {
  return ueAnchor.displayName ? `UE • ${ueAnchor.displayName}` : "UE";
}

export function colorForRole(role: FocusRole): Color {
  return ROLE_COLORS[role];
}

export function toUeAnchor(
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

export function createLocalFrame(ueAnchor: UeAnchor): Matrix4 {
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

export function createLocalOffsetPosition(
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
    PROXY_RADIUS_MAX_M -
    elevationNorm * (PROXY_RADIUS_MAX_M - PROXY_RADIUS_MIN_M);
  const proxyHeightM =
    PROXY_HEIGHT_MIN_M +
    elevationNorm * (PROXY_HEIGHT_MAX_M - PROXY_HEIGHT_MIN_M);
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

export function buildFocusCandidateCache(
  ueAnchor: UeAnchor,
  samples: ReadonlyArray<ConstellationSatelliteSample>
): FocusCandidateCache {
  const context = createFocusEvaluationContext(ueAnchor);
  const candidates = samples.map((sample) => evaluateCandidate(context, sample));

  return {
    candidateById: new Map(
      candidates.map((candidate) => [candidate.id, candidate])
    ),
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

export function initializeProxyLanes(
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

export function initializeBackgroundLanes(
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
        lane.laneAzimuthBiasEastM = computeCorridorAzimuthBiasEastM(
          rotated.azimuthRad
        );
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

export function buildLocalHandoverSemanticFrame(
  candidateCache: FocusCandidateCache,
  lanes: ReadonlyArray<ProxyLaneState>,
  presentationElapsedSec: number
): LocalHandoverSemanticFrame {
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

export function createPresentationClockState(
  time: JulianDate
): PresentationClockState {
  return {
    elapsedSec: 0,
    lastCesiumTime: JulianDate.clone(time)
  };
}

function computeBeamHopModulation(presentationElapsedSec: number): number {
  const raw = presentationElapsedSec / STAGE_BH_CYCLE_SEC;
  const bhPhase = ((raw % 1) + 1) % 1;
  return bhPhase < STAGE_BH_DWELL_FRACTION ? 1.0 : STAGE_BH_GUARD_MULTIPLIER;
}

export function buildLocalHandoverTruthFrame({
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
        ? Color.fromCssColorString("#ffffff").withAlpha(
            ROLE_CORE_LINK_ALPHA[role]
          )
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

export function deriveLocalHandoverPresentationFrame(
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
      recentEventText: `${truthFrame.baselineServing.id} -> ${truthFrame.baselinePending.id}`
    };
  }

  return {
    detailText:
      "Post-switch settling keeps the previous satellite on the stage briefly so you can read the transition without losing context.",
    handoverPhaseText: "Post-Handover Settle",
    recentEventText: `${truthFrame.baselineServing.id} released UE anchor focus`
  };
}

export function deriveLocalHandoverShellFrame(
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
