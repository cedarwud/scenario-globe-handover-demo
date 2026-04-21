import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const distRoot = path.join(repoRoot, "dist");

const requiredDistFiles = [
  "index.html",
  "cesium/Assets/approximateTerrainHeights.json",
  "cesium/Assets/Images/ion-credit.png",
  "cesium/Workers/createTaskProcessorWorker.js"
];

const smokeFetches = [
  {
    pathname: "/",
    verify: async (response) => {
      const html = await response.text();
      assert(
        html.includes('window.CESIUM_BASE_URL = "/cesium/";'),
        "Expected dist index.html to reserve CESIUM_BASE_URL"
      );
    }
  },
  {
    pathname: "/cesium/Assets/approximateTerrainHeights.json"
  },
  {
    pathname: "/cesium/Assets/Images/ion-credit.png"
  },
  {
    pathname: "/cesium/Workers/createTaskProcessorWorker.js",
    verify: async (response) => {
      const workerScript = await response.text();
      assert(
        workerScript.includes("Cesium - https://github.com/CesiumGS/cesium"),
        "Expected worker smoke target to be a Cesium worker module"
      );
    }
  }
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function findHeadlessBrowser() {
  const candidates = ["google-chrome", "chromium", "chromium-browser"];

  for (const command of candidates) {
    const probe = spawnSync(command, ["--version"], { encoding: "utf8" });

    if (probe.status === 0) {
      return command;
    }
  }

  throw new Error(
    "Missing a supported headless browser. Install google-chrome or chromium to run the browser bootstrap smoke."
  );
}

function dumpDomInHeadlessBrowser(browserCommand, baseUrl, extraArgs = []) {
  const userDataDir = mkdtempSync(path.join(tmpdir(), "scenario-globe-handover-demo-chrome-"));

  try {
    return spawnSync(
      browserCommand,
      [
        "--headless",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-sync",
        "--metrics-recording-only",
        "--timeout=8000",
        `--user-data-dir=${userDataDir}`,
        "--dump-dom",
        ...extraArgs,
        `${baseUrl}/`
      ],
      {
        encoding: "utf8",
        timeout: 20000,
        maxBuffer: 5 * 1024 * 1024
      }
    );
  } finally {
    rmSync(userDataDir, { recursive: true, force: true });
  }
}

function resolveDistPath(pathname) {
  const normalizedPath = pathname === "/" ? "/index.html" : pathname;
  const relativePath = normalizedPath.replace(/^\/+/, "");
  const absolutePath = path.join(distRoot, relativePath);
  const relativeFromDist = path.relative(distRoot, absolutePath);

  assert(!relativeFromDist.startsWith(".."), `Refused path traversal: ${pathname}`);
  return absolutePath;
}

function ensureDistBuildExists() {
  assert(existsSync(distRoot), "Missing dist/. Run `npm run build` before this smoke test.");

  for (const relativePath of requiredDistFiles) {
    const absolutePath = path.join(distRoot, relativePath);
    assert(existsSync(absolutePath), `Missing smoke fixture: dist/${relativePath}`);
    assert(statSync(absolutePath).isFile(), `Expected dist/${relativePath} to be a file`);
  }
}

async function verifyFetches(baseUrl) {
  for (const target of smokeFetches) {
    const response = await fetch(`${baseUrl}${target.pathname}`);
    assert(response.ok, `Expected ${target.pathname} to return 200, received ${response.status}`);

    if (target.verify) {
      await target.verify(response);
    }
  }
}

function verifyBootstrapInHeadlessBrowser(baseUrl) {
  const browserCommand = findHeadlessBrowser();
  const attempts = [
    {
      label: "default-headless",
      extraArgs: []
    },
    {
      label: "swiftshader-fallback",
      extraArgs: ["--enable-unsafe-swiftshader"]
    }
  ];

  let lastFailure = "Headless browser smoke did not run.";

  for (const attempt of attempts) {
    const result = dumpDomInHeadlessBrowser(browserCommand, baseUrl, attempt.extraArgs);
    assert(
      result.status === 0,
      `Headless browser smoke failed during ${attempt.label}: ${result.stderr || result.stdout}`
    );

    const dom = result.stdout;
    const hasReadyState = dom.includes('data-bootstrap-state="ready"');
    const hasErrorState = dom.includes('data-bootstrap-state="error"');
    const hasViewerShell = dom.includes("cesium-viewer");
    const hasLightingToggle = dom.includes('data-lighting-toggle="true"');
    const hasLightingToggleDisabled = dom.includes('data-lighting-enabled="false"');
    const hasUnpressedLightingToggle = dom.includes('aria-pressed="false"');
    const bootstrapStateMatch = dom.match(/data-bootstrap-state="([^"]+)"/);
    const bootstrapDetailMatch = dom.match(/data-bootstrap-detail="([^"]+)"/);

    if (
      hasReadyState &&
      !hasErrorState &&
      hasViewerShell &&
      hasLightingToggle &&
      hasLightingToggleDisabled &&
      hasUnpressedLightingToggle
    ) {
      return;
    }

    lastFailure =
      `Browser bootstrap smoke did not reach a ready viewer during ${attempt.label}. ` +
      `status=${result.status} signal=${result.signal ?? "none"} stdoutLength=${dom.length} ` +
      `bootstrapState=${bootstrapStateMatch?.[1] ?? "missing"} ` +
      `bootstrapDetail=${bootstrapDetailMatch?.[1] ?? "missing"} ` +
      `hasViewerShell=${hasViewerShell} hasLightingToggle=${hasLightingToggle} ` +
      `hasLightingToggleDisabled=${hasLightingToggleDisabled} ` +
      `hasUnpressedLightingToggle=${hasUnpressedLightingToggle}.`;
  }

  throw new Error(lastFailure);
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const serverScript = [
      "import functools, http.server",
      "class SilentHandler(http.server.SimpleHTTPRequestHandler):",
      "    def log_message(self, format, *args):",
      "        pass",
      `server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(SilentHandler, directory=${JSON.stringify(
        distRoot
      )}))`,
      "print(server.server_port, flush=True)",
      "try:",
      "    server.serve_forever()",
      "finally:",
      "    server.server_close()"
    ].join("\n");
    const serverProcess = spawn("python3", ["-u", "-c", serverScript], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"]
    });

    const timeout = setTimeout(() => {
      serverProcess.kill("SIGTERM");
      reject(new Error("Timed out waiting for smoke server."));
    }, 5000);

    let settled = false;
    let serverLog = "";

    const handleOutput = (chunk) => {
      serverLog += chunk.toString();
      const match = serverLog.match(/(\d+)/);

      if (match && !settled) {
        settled = true;
        clearTimeout(timeout);
        resolve({
          server: serverProcess,
          baseUrl: `http://127.0.0.1:${match[1]}`
        });
      }
    };

    serverProcess.stdout.on("data", handleOutput);
    serverProcess.stderr.on("data", handleOutput);
    serverProcess.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    serverProcess.once("exit", (code) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      reject(new Error(`Smoke server exited before readiness. Code: ${code}. Output: ${serverLog}`));
    });
  });
}

async function main() {
  ensureDistBuildExists();

  // Cesium resolves runtime assets from CESIUM_BASE_URL and derives worker
  // module imports from the Workers/ prefix under that same base path.
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/offline/main.js:10-17
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Core/buildModuleUrl.js:42-46
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Core/TaskProcessor.js:91-125
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Core/TaskProcessor.js:237-245
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Specs/Core/buildModuleUrlSpec.js:42-70
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Specs/Core/TaskProcessorSpec.js:48-90
  const { server, baseUrl } = await startStaticServer();

  try {
    await verifyFetches(baseUrl);
    verifyBootstrapInHeadlessBrowser(baseUrl);
    console.log("Browser bootstrap smoke passed.");
  } finally {
    await new Promise((resolve) => {
      server.once("exit", () => {
        resolve();
      });
      server.kill("SIGTERM");
    });
  }
}

await main();
