import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const distRoot = path.join(repoRoot, "dist");

const LOCAL_FOCUS_SMOKE_QUERY = "?smokeScenario=local-focus-regression";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function ensureDistBuildExists() {
  assert(existsSync(distRoot), "Missing dist/. Run `npm run build` before this smoke test.");
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
    "Missing a supported headless browser. Install google-chrome or chromium to run the local-focus smoke."
  );
}

function startHeadlessBrowser(browserCommand, extraArgs = []) {
  const userDataDir = mkdtempSync(
    path.join(tmpdir(), "scenario-globe-handover-demo-local-focus-")
  );

  return new Promise((resolve, reject) => {
    const browserProcess = spawn(
      browserCommand,
      [
        "--headless",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-dev-shm-usage",
        "--disable-sync",
        "--metrics-recording-only",
        "--remote-debugging-port=0",
        `--user-data-dir=${userDataDir}`,
        ...extraArgs,
        "about:blank"
      ],
      {
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    let settled = false;
    let browserLog = "";
    const readyPattern = /DevTools listening on (ws:\/\/[^\s]+)/;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      browserProcess.kill("SIGTERM");
      rmSync(userDataDir, { recursive: true, force: true });
      reject(new Error(`Timed out waiting for headless browser. Output: ${browserLog}`));
    }, 10000);

    const handleOutput = (chunk) => {
      browserLog += chunk.toString();
      const match = browserLog.match(readyPattern);

      if (match && !settled) {
        settled = true;
        clearTimeout(timeout);
        resolve({
          browserProcess,
          browserWebSocketUrl: match[1],
          userDataDir
        });
      }
    };

    browserProcess.stdout.on("data", handleOutput);
    browserProcess.stderr.on("data", handleOutput);
    browserProcess.once("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      rmSync(userDataDir, { recursive: true, force: true });
      reject(error);
    });
    browserProcess.once("exit", (code) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      rmSync(userDataDir, { recursive: true, force: true });
      reject(
        new Error(
          `Headless browser exited before readiness. Code: ${code}. Output: ${browserLog}`
        )
      );
    });
  });
}

async function stopHeadlessBrowser(browserProcess, userDataDir) {
  if (!browserProcess.killed) {
    browserProcess.kill("SIGTERM");
  }

  await new Promise((resolve) => {
    browserProcess.once("exit", () => {
      resolve();
    });

    setTimeout(() => {
      if (!browserProcess.killed) {
        browserProcess.kill("SIGKILL");
      }

      resolve();
    }, 1000);
  });

  rmSync(userDataDir, { recursive: true, force: true });
}

async function resolvePageWebSocketUrl(browserWebSocketUrl) {
  const browserUrl = new URL(browserWebSocketUrl);
  const inspectorBaseUrl = `${
    browserUrl.protocol === "wss:" ? "https" : "http"
  }://${browserUrl.host}`;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${inspectorBaseUrl}/json/list`);
    const targets = await response.json();
    const pageTarget = targets.find((target) => target.type === "page");

    if (pageTarget?.webSocketDebuggerUrl) {
      return pageTarget.webSocketDebuggerUrl;
    }

    await sleep(100);
  }

  throw new Error(`Failed to resolve page websocket from ${browserWebSocketUrl}`);
}

function connectCdp(pageWebSocketUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(pageWebSocketUrl);
    const pending = new Map();
    let nextId = 0;
    let settled = false;

    const rejectPending = (error) => {
      for (const deferred of pending.values()) {
        deferred.reject(error);
      }

      pending.clear();
    };

    socket.addEventListener("open", () => {
      if (settled) {
        return;
      }

      settled = true;
      resolve({
        async send(method, params = {}) {
          const id = ++nextId;

          return await new Promise((commandResolve, commandReject) => {
            pending.set(id, {
              resolve: commandResolve,
              reject: commandReject
            });
            socket.send(JSON.stringify({ id, method, params }));
          });
        },
        async close() {
          if (socket.readyState === WebSocket.CLOSED) {
            return;
          }

          socket.close();
        }
      });
    });

    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);

      if (typeof payload.id !== "number") {
        return;
      }

      const deferred = pending.get(payload.id);

      if (!deferred) {
        return;
      }

      pending.delete(payload.id);

      if (payload.error) {
        deferred.reject(new Error(payload.error.message));
        return;
      }

      deferred.resolve(payload.result);
    });

    socket.addEventListener("error", () => {
      const error = new Error("CDP websocket error.");
      rejectPending(error);

      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    socket.addEventListener("close", () => {
      rejectPending(new Error("CDP websocket closed."));
    });
  });
}

async function evaluateValue(client, expression) {
  const evaluation = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true
  });

  return evaluation.result.value;
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
      reject(new Error("Timed out waiting for local-focus smoke server."));
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
          baseUrl: `http://127.0.0.1:${match[1]}`,
          server: serverProcess
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
      reject(
        new Error(
          `Local-focus smoke server exited before readiness. Code: ${code}. Output: ${serverLog}`
        )
      );
    });
  });
}

function stopServer(server) {
  return new Promise((resolve) => {
    if (!server || server.exitCode !== null) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      if (server.exitCode === null) {
        server.kill("SIGKILL");
      }
    }, 4000);

    server.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    server.kill("SIGTERM");
  });
}

async function readLocalFocusSmokeState(client) {
  return await evaluateValue(
    client,
    `(() => {
      return {
        dataset: { ...document.documentElement.dataset },
        hasViewerShell: Boolean(document.querySelector(".cesium-viewer")),
        readyState: document.readyState
      };
    })()`
  );
}

async function captureDocumentHtml(client) {
  return await evaluateValue(client, "document.documentElement.outerHTML");
}

async function waitForLocalFocusSmokeResult(client, timeoutMs = 30000) {
  const startedAt = Date.now();
  let lastSnapshot = null;

  while (Date.now() - startedAt < timeoutMs) {
    lastSnapshot = await readLocalFocusSmokeState(client);
    const dataset = lastSnapshot?.dataset ?? {};

    if (dataset.bootstrapState === "error") {
      throw new Error(
        `Bootstrap entered error state: ${dataset.bootstrapDetail ?? "missing"}`
      );
    }

    if (dataset.smokeScenarioState === "error") {
      throw new Error(
        `Smoke scenario error: ${dataset.smokeScenarioError ?? "missing"}`
      );
    }

    if (
      dataset.bootstrapState === "ready" &&
      dataset.smokeScenarioState === "passed"
    ) {
      return await captureDocumentHtml(client);
    }

    await sleep(100);
  }

  const dataset = lastSnapshot?.dataset ?? {};
  throw new Error(
    `Timed out waiting for local-focus smoke. bootstrapState=${
      dataset.bootstrapState ?? "missing"
    } smokeState=${dataset.smokeScenarioState ?? "missing"} bootstrapDetail=${
      dataset.bootstrapDetail ?? "missing"
    } smokeError=${dataset.smokeScenarioError ?? "missing"} hasViewerShell=${String(
      lastSnapshot?.hasViewerShell ?? false
    )} readyState=${lastSnapshot?.readyState ?? "missing"}`
  );
}

function getDataAttribute(dom, attributeName) {
  const match = dom.match(new RegExp(`${attributeName}="([^"]*)"`, "i"));
  return match?.[1];
}

function verifyLocalFocusScenario(dom) {
  const domSnippet = dom.slice(0, 320).replace(/\s+/g, " ");
  const bootstrapState = getDataAttribute(dom, "data-bootstrap-state");
  const smokeState = getDataAttribute(dom, "data-smoke-scenario-state");
  const smokeError = getDataAttribute(dom, "data-smoke-scenario-error");

  assert(
    bootstrapState === "ready",
    `Expected bootstrap ready state in local-focus smoke, received ${
      bootstrapState ?? "missing"
    }. DOM snippet: ${domSnippet}`
  );
  assert(
    smokeState === "passed",
    `Expected local-focus smoke to pass, received ${smokeState ?? "missing"}${
      smokeError ? ` (${smokeError})` : ""
    }. DOM snippet: ${domSnippet}`
  );

  const requiredExactAttributes = {
    "data-smoke-initial-sky-mode": "blue",
    "data-smoke-initial-ue-panel-active": "false",
    "data-smoke-initial-ho-panel-active": "false",
    "data-smoke-after-sky-toggle-sky-mode": "space",
    "data-smoke-after-ntpu-sky-mode": "space",
    "data-smoke-after-ntpu-ue-panel-active": "true",
    "data-smoke-after-ntpu-ho-panel-active": "true",
    "data-smoke-after-ntpu-background-count": "6",
    "data-smoke-after-home-sky-mode": "space",
    "data-smoke-after-home-ue-panel-active": "false",
    "data-smoke-after-home-ho-panel-active": "false",
    "data-smoke-after-home-handover-phase": "Waiting for UE anchor",
    "data-smoke-after-double-click-sky-mode": "space",
    "data-smoke-after-double-click-ue-panel-active": "true",
    "data-smoke-after-double-click-ho-panel-active": "true"
  };

  for (const [attributeName, expectedValue] of Object.entries(
    requiredExactAttributes
  )) {
    const actualValue = getDataAttribute(dom, attributeName);
    assert(
      actualValue === expectedValue,
      `Expected ${attributeName}=${expectedValue}, received ${actualValue ?? "missing"}`
    );
  }

  const populatedAttributes = [
    "data-smoke-after-ntpu-serving",
    "data-smoke-after-ntpu-pending",
    "data-smoke-after-double-click-serving",
    "data-smoke-after-double-click-pending"
  ];

  for (const attributeName of populatedAttributes) {
    const actualValue = getDataAttribute(dom, attributeName);
    assert(
      actualValue && actualValue !== "—" && actualValue !== "missing",
      `Expected ${attributeName} to be populated, received ${actualValue ?? "missing"}`
    );
  }

  const finalPhase = getDataAttribute(
    dom,
    "data-smoke-after-double-click-handover-phase"
  );
  assert(
    finalPhase &&
      finalPhase !== "Waiting for UE anchor" &&
      finalPhase !== "missing",
    `Expected final double-click phase to reflect local focus, received ${finalPhase ?? "missing"}`
  );
}

async function runLocalFocusAttempt(browserCommand, requestUrl, attempt) {
  const { browserProcess, browserWebSocketUrl, userDataDir } =
    await startHeadlessBrowser(browserCommand, attempt.extraArgs);
  let client = null;

  try {
    const pageWebSocketUrl = await resolvePageWebSocketUrl(browserWebSocketUrl);
    client = await connectCdp(pageWebSocketUrl);
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Page.navigate", { url: requestUrl });
    const dom = await waitForLocalFocusSmokeResult(client);
    verifyLocalFocusScenario(dom);
  } finally {
    await client?.close?.();
    await stopHeadlessBrowser(browserProcess, userDataDir);
  }
}

async function main() {
  ensureDistBuildExists();
  const browserCommand = findHeadlessBrowser();
  const { server, baseUrl } = await startStaticServer();
  const attempts = [
    { extraArgs: [], label: "default-headless" },
    { extraArgs: ["--enable-unsafe-swiftshader"], label: "swiftshader-fallback" }
  ];
  let lastFailure = "Local-focus smoke did not run.";

  try {
    for (const attempt of attempts) {
      try {
        await runLocalFocusAttempt(
          browserCommand,
          `${baseUrl}/${LOCAL_FOCUS_SMOKE_QUERY}`,
          attempt
        );
        console.log(`Local-focus interaction smoke passed (${attempt.label}).`);
        return;
      } catch (error) {
        lastFailure = `${attempt.label}: ${
          error instanceof Error ? error.message : String(error)
        }`;
      }
    }
  } finally {
    await stopServer(server);
  }

  throw new Error(lastFailure);
}

await main();
