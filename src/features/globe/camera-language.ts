import {
  Camera,
  Cartesian3,
  EasingFunction,
  Math as CesiumMath,
  Rectangle,
  SceneMode,
  type Viewer
} from "cesium";

const HOME_RECTANGLE = Rectangle.fromDegrees(-170.0, -60.0, 170.0, 60.0);
const HOME_VIEW_FACTOR = 0.42;
const HOME_DURATION_SECONDS = 2.6;
const HOME_MAXIMUM_HEIGHT = 22_000_000.0;
const HOME_PITCH_ADJUST_HEIGHT = 8_500_000.0;
const HOME_ORIENTATION = {
  heading: CesiumMath.toRadians(0.0),
  pitch: CesiumMath.toRadians(-90.0),
  roll: 0.0
};

const scaledDestinationScratch = new Cartesian3();
const normalizedDestinationScratch = new Cartesian3();

function resolveHomeDestination(viewer: Viewer): Rectangle | Cartesian3 {
  const destination = viewer.camera.getRectangleCameraCoordinates(
    HOME_RECTANGLE,
    scaledDestinationScratch
  );
  let magnitude = Cartesian3.magnitude(destination);
  magnitude += magnitude * HOME_VIEW_FACTOR;

  return Cartesian3.multiplyByScalar(
    Cartesian3.normalize(destination, normalizedDestinationScratch),
    magnitude,
    scaledDestinationScratch
  );
}

function flyBaselineHome(viewer: Viewer, duration: number): void {
  viewer.camera.flyTo({
    destination: resolveHomeDestination(viewer),
    orientation: HOME_ORIENTATION,
    duration,
    maximumHeight: HOME_MAXIMUM_HEIGHT,
    pitchAdjustHeight: HOME_PITCH_ADJUST_HEIGHT,
    easingFunction: EasingFunction.CUBIC_IN_OUT,
    complete: () => {
      viewer.scene.requestRender();
    }
  });
}

export function applyCameraLanguage(viewer: Viewer): void {
  // Keep the demo's wide-globe camera language on Cesium's own home-view and
  // flyTo surfaces: tighten the shared home extent, then tune the 3D flight
  // with heading/pitch/duration instead of inventing a parallel camera stack.
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/mars/main.js:180-184
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/Camera.js:290-303
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/Camera.js:1542-1573
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/Camera.js:3310-3367
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/widgets/Source/HomeButton/HomeButtonViewModel.js:13-24
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Specs/Scene/CameraSpec.js:3621-3662
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Specs/Scene/CameraSpec.js:4318-4344
  Camera.DEFAULT_VIEW_RECTANGLE = HOME_RECTANGLE;
  Camera.DEFAULT_VIEW_FACTOR = HOME_VIEW_FACTOR;

  if (viewer.homeButton) {
    viewer.homeButton.viewModel.duration = HOME_DURATION_SECONDS;
    viewer.homeButton.viewModel.command.beforeExecute.addEventListener((commandInfo) => {
      if (viewer.scene.mode !== SceneMode.SCENE3D) {
        return;
      }

      commandInfo.cancel = true;
      flyBaselineHome(viewer, viewer.homeButton?.viewModel.duration ?? HOME_DURATION_SECONDS);
    });
  }

  if (viewer.scene.mode === SceneMode.SCENE3D) {
    flyBaselineHome(viewer, HOME_DURATION_SECONDS);
  }
}
