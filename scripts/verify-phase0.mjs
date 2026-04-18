import { createHash } from "node:crypto";
import { readFileSync, existsSync, lstatSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const fixtureHash = "015f0d68d1eced80263da5af79b6c7cc80e204f41d9a1d9491e99ecec34f4b5c";
const bannedTerms = [
  String.fromCharCode(73, 84, 82, 73),
  String.fromCodePoint(0x5de5, 0x7814, 0x9662)
];
const checkedTextRoots = [
  "README.md",
  "package.json",
  "vite.config.ts",
  "src",
  "docs",
  "tests",
  "scripts"
];

function resolveRepoPath(relativePath) {
  return path.join(repoRoot, relativePath);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readText(relativePath) {
  return readFileSync(resolveRepoPath(relativePath), "utf8");
}

function assertExists(relativePath) {
  assert(existsSync(resolveRepoPath(relativePath)), `Missing required path: ${relativePath}`);
}

function assertFile(relativePath) {
  const absolutePath = resolveRepoPath(relativePath);
  assertExists(relativePath);
  assert(statSync(absolutePath).isFile(), `Expected file: ${relativePath}`);
}

function assertNotSymlink(relativePath) {
  const absolutePath = resolveRepoPath(relativePath);
  assertExists(relativePath);
  assert(!lstatSync(absolutePath).isSymbolicLink(), `Expected repo-owned file, found symlink: ${relativePath}`);
}

function assertIncludes(relativePath, expected) {
  const text = readText(relativePath);
  assert(text.includes(expected), `Expected ${relativePath} to include: ${expected}`);
}

function sha256(relativePath) {
  return createHash("sha256")
    .update(readFileSync(resolveRepoPath(relativePath)))
    .digest("hex");
}

function collectTextFiles(relativePath) {
  const absolutePath = resolveRepoPath(relativePath);
  const entry = statSync(absolutePath);

  if (entry.isFile()) {
    return [relativePath];
  }

  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((dirent) => {
    const childRelativePath = path.join(relativePath, dirent.name);
    if (dirent.isDirectory()) {
      return collectTextFiles(childRelativePath);
    }
    return [childRelativePath];
  });
}

function verifyNeutralWording() {
  for (const root of checkedTextRoots) {
    for (const relativePath of collectTextFiles(root)) {
      const text = readText(relativePath);
      for (const bannedTerm of bannedTerms) {
        assert(
          !text.includes(bannedTerm),
          `Found banned delivery term "${bannedTerm}" in ${relativePath}`
        );
      }
    }
  }
}

function verifyBuiltOutput() {
  const requiredFiles = [
    "dist/index.html",
    "dist/cesium/Assets/approximateTerrainHeights.json",
    "dist/cesium/Workers/createTaskProcessorWorker.js",
    "dist/cesium/Widgets/widgets.css",
    "dist/cesium/ThirdParty/draco_decoder.wasm",
    "dist/fixtures/satellites/walker-o6-s3-i45-h698.tle",
    "docs/cesium-evidence.md"
  ];

  for (const file of requiredFiles) {
    assertFile(file);
    assertNotSymlink(file);
  }

  const distIndexHtml = readText("dist/index.html");
  assert(
    distIndexHtml.includes('window.CESIUM_BASE_URL = "/cesium/";'),
    "dist/index.html is missing the CESIUM_BASE_URL reservation"
  );

  assert(
    sha256("dist/fixtures/satellites/walker-o6-s3-i45-h698.tle") === fixtureHash,
    "The built walker fixture does not match the expected copied asset hash"
  );
}

function verifyInstalledCesiumEvidence() {
  const requiredFiles = [
    "node_modules/cesium/package.json",
    "node_modules/@cesium/engine/Source/Core/buildModuleUrl.js",
    "node_modules/@cesium/engine/Source/Core/TaskProcessor.js",
    "node_modules/@cesium/engine/Source/Scene/Scene.js",
    "node_modules/@cesium/widgets/Source/Viewer/Viewer.js",
    "node_modules/@cesium/widgets/Source/widgets.css"
  ];

  for (const file of requiredFiles) {
    assertFile(file);
  }

  assertIncludes("node_modules/cesium/package.json", '"version": "1.140.0"');
  assertIncludes("node_modules/cesium/package.json", '"@cesium/engine": "^24.0.0"');
  assertIncludes("node_modules/cesium/package.json", '"@cesium/widgets": "^14.5.0"');

  assertIncludes(
    "node_modules/@cesium/engine/Source/Core/buildModuleUrl.js",
    'typeof CESIUM_BASE_URL !== "undefined"'
  );
  assertIncludes(
    "node_modules/@cesium/engine/Source/Core/buildModuleUrl.js",
    "Unable to determine Cesium base URL automatically"
  );
  assertIncludes(
    "node_modules/@cesium/engine/Source/Core/buildModuleUrl.js",
    "buildModuleUrl.setBaseUrl = function"
  );

  assertIncludes(
    "node_modules/@cesium/engine/Source/Core/TaskProcessor.js",
    "TaskProcessor._workerModulePrefix"
  );
  assertIncludes(
    "node_modules/@cesium/engine/Source/Core/TaskProcessor.js",
    "baseUrl: buildModuleUrl.getCesiumBaseUrl().url"
  );

  assertIncludes(
    "node_modules/@cesium/widgets/Source/Viewer/Viewer.js",
    "@property {boolean} [baseLayerPicker=true]"
  );
  assertIncludes(
    "node_modules/@cesium/widgets/Source/Viewer/Viewer.js",
    "@property {boolean|IonGeocodeProviderType|GeocoderService[]} [geocoder=IonGeocodeProviderType.DEFAULT]"
  );
  assertIncludes(
    "node_modules/@cesium/widgets/Source/Viewer/Viewer.js",
    "geocoder = new Geocoder"
  );
  assertIncludes(
    "node_modules/@cesium/widgets/Source/Viewer/Viewer.js",
    "baseLayerPicker = new BaseLayerPicker"
  );

  assertIncludes(
    "node_modules/@cesium/widgets/Source/widgets.css",
    "@import url(./Viewer/Viewer.css);"
  );

  assertIncludes(
    "node_modules/@cesium/engine/Source/Scene/Scene.js",
    "this.requestRenderMode = options.requestRenderMode ?? false;"
  );
  assertIncludes(
    "node_modules/@cesium/engine/Source/Scene/Scene.js",
    "this.maximumRenderTimeChange = options.maximumRenderTimeChange ?? 0.0;"
  );
}

function main() {
  verifyBuiltOutput();
  verifyInstalledCesiumEvidence();
  verifyNeutralWording();
  console.log("Build verification passed.");
}

main();
