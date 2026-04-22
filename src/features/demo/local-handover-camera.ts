import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Cartographic,
  EasingFunction,
  Ellipsoid,
  HeadingPitchRange,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  Quaternion,
  Transforms,
  type Viewer
} from "cesium";

import {
  createLocalOffsetPosition,
  type LocalHandoverFocusTargets,
  type UeAnchor
} from "./local-handover-model";

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function pickEarthPosition(
  viewer: Viewer,
  screenPosition: Cartesian2
): Cartesian3 | undefined {
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
  const heading =
    CesiumMath.zeroToTwoPi(DISPLAY_STAGE_HEADING_RAD) - CesiumMath.PI_OVER_TWO;
  const pitchQuat = Quaternion.fromAxisAngle(
    Cartesian3.UNIT_Y,
    -pitch,
    new Quaternion()
  );
  const headingQuat = Quaternion.fromAxisAngle(
    Cartesian3.UNIT_Z,
    -heading,
    new Quaternion()
  );
  const rotationQuat = Quaternion.multiply(
    headingQuat,
    pitchQuat,
    new Quaternion()
  );
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

function createFocusTargetPosition(
  viewer: Viewer,
  ueAnchor: UeAnchor,
  rangeM: number
): Cartesian3 {
  const siteFromTopRatio = 1 - clamp(SITE_CAMERA_SITE_FROM_BOTTOM_RATIO, 0.05, 0.45);
  const normalizedVerticalOffset = 1 - siteFromTopRatio * 2;
  const screenShiftMagnitudeM =
    Math.abs(normalizedVerticalOffset) *
    rangeM *
    Math.tan(getCameraVerticalFovRad(viewer) / 2);
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
  const rangeM = Math.max(
    focusRadiusM * SITE_CAMERA_RANGE_MULTIPLIER,
    SITE_CAMERA_MIN_RANGE_M
  );
  const targetPositionM = createFocusTargetPosition(viewer, ueAnchor, rangeM);
  const targetFrame = Transforms.eastNorthUpToFixedFrame(targetPositionM);
  const cameraLocalFrame = createCameraLocalFrame(rangeM);
  const destinationM = Matrix4.multiplyByPoint(
    targetFrame,
    cameraLocalFrame.offsetLocal,
    new Cartesian3()
  );
  const directionM = Cartesian3.normalize(
    Matrix4.multiplyByPointAsVector(
      targetFrame,
      cameraLocalFrame.forwardLocal,
      new Cartesian3()
    ),
    new Cartesian3()
  );
  const upM = Cartesian3.normalize(
    Matrix4.multiplyByPointAsVector(
      targetFrame,
      cameraLocalFrame.upLocal,
      new Cartesian3()
    ),
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
  const center = new Cartesian2(
    viewer.canvas.clientWidth / 2,
    viewer.canvas.clientHeight / 2
  );
  return (
    pickEarthPosition(viewer, center) ??
    Cartesian3.add(
      viewer.camera.positionWC,
      Cartesian3.multiplyByScalar(
        viewer.camera.directionWC,
        fallbackRangeM,
        new Cartesian3()
      ),
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
  const surfaceUp = Ellipsoid.WGS84.geodeticSurfaceNormal(
    targetPositionM,
    new Cartesian3()
  );
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
    up: Cartesian3.normalize(
      Cartesian3.cross(right, direction, new Cartesian3()),
      new Cartesian3()
    )
  };
}

export function glideToUeAnchor(
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
    const destinationM = interpolateSurfacePosition(
      startDestinationM,
      endPose.destinationM,
      eased
    );
    const targetPositionM = interpolateSurfacePosition(
      startTargetM,
      endPose.targetPositionM,
      eased
    );
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

export function flyToUeAnchor(
  viewer: Viewer,
  ueAnchor: UeAnchor,
  frame: LocalHandoverFocusTargets
): void {
  const endPose = createFocusPose(viewer, ueAnchor, frame);

  viewer.camera.cancelFlight();
  viewer.camera.flyToBoundingSphere(
    new BoundingSphere(endPose.targetPositionM, endPose.focusRadiusM),
    {
      duration: 1.15,
      easingFunction: EasingFunction.QUADRATIC_IN_OUT,
      offset: new HeadingPitchRange(
        DISPLAY_STAGE_HEADING_RAD,
        SITE_CAMERA_PITCH_RAD,
        endPose.rangeM
      ),
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
    }
  );
}
