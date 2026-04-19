export interface AppShellMount {
  viewerRoot: HTMLDivElement;
  ueAnchorState: HTMLElement;
  ueAnchorCoordinates: HTMLElement;
  globalSatelliteCount: HTMLElement;
  globalHint: HTMLElement;
  handoverPanel: HTMLElement;
  handoverPhase: HTMLElement;
  handoverProgressBar: HTMLDivElement;
  servingSatellite: HTMLElement;
  servingMetric: HTMLElement;
  pendingSatellite: HTMLElement;
  pendingMetric: HTMLElement;
  contextSatellite: HTMLElement;
  recentEvent: HTMLElement;
  detail: HTMLElement;
}

function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
  label: string
): T {
  const element = root.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing app-shell element: ${label}`);
  }

  return element;
}

export function mountAppShell(root: HTMLDivElement): AppShellMount {
  root.innerHTML = `
    <main class="app-shell">
      <div class="viewer-root" data-viewer-root></div>
      <section
        class="demo-panel demo-panel--left"
        aria-label="UE anchor summary"
        hidden
      >
        <p class="demo-panel-label">UE anchor</p>
        <h2 class="demo-panel-title" data-demo-ue-anchor-state>
          Double-click the globe to place a UE anchor
        </h2>
        <p class="demo-panel-copy" data-demo-ue-anchor-coordinates>
          No UE anchor placed.
        </p>
        <div class="demo-chip-row">
          <span class="demo-chip">
            Global satellites:
            <strong data-demo-global-satellite-count>0</strong>
          </span>
        </div>
        <p class="demo-panel-hint" data-demo-global-hint>
          The orbit layer stays global. Double-click any point on the globe
          to place a UE anchor and stage a local handover scene without
          leaving the page.
        </p>
      </section>
      <aside class="demo-panel demo-panel--right" data-demo-handover-panel hidden>
        <p class="demo-panel-label">Handover Focus</p>
        <div class="demo-progress">
          <div class="demo-progress-bar" data-demo-handover-progress></div>
        </div>
        <p class="demo-panel-title" data-demo-handover-phase>
          Waiting for UE anchor
        </p>
        <div class="demo-stat-grid">
          <article class="demo-stat-card demo-stat-card--serving">
            <p class="demo-stat-label">Serving</p>
            <h3 class="demo-stat-title" data-demo-serving-satellite>—</h3>
            <p class="demo-stat-value" data-demo-serving-metric>—</p>
          </article>
          <article class="demo-stat-card demo-stat-card--pending">
            <p class="demo-stat-label">Pending</p>
            <h3 class="demo-stat-title" data-demo-pending-satellite>—</h3>
            <p class="demo-stat-value" data-demo-pending-metric>—</p>
          </article>
        </div>
        <div class="demo-summary-grid">
          <div>
            <p class="demo-summary-label">Context</p>
            <p class="demo-summary-value" data-demo-context-satellite>—</p>
          </div>
          <div>
            <p class="demo-summary-label">Recent HO</p>
            <p class="demo-summary-value" data-demo-recent-event>—</p>
          </div>
        </div>
        <p class="demo-panel-copy" data-demo-detail>
          Place a UE anchor to start the synthetic handover loop.
        </p>
      </aside>
    </main>
  `;

  return {
    viewerRoot: requireElement(root, "[data-viewer-root]", "viewer root"),
    ueAnchorState: requireElement(
      root,
      "[data-demo-ue-anchor-state]",
      "UE anchor state"
    ),
    ueAnchorCoordinates: requireElement(
      root,
      "[data-demo-ue-anchor-coordinates]",
      "UE anchor coordinates"
    ),
    globalSatelliteCount: requireElement(
      root,
      "[data-demo-global-satellite-count]",
      "global satellite count"
    ),
    globalHint: requireElement(root, "[data-demo-global-hint]", "global hint"),
    handoverPanel: requireElement(
      root,
      "[data-demo-handover-panel]",
      "handover panel"
    ),
    handoverPhase: requireElement(
      root,
      "[data-demo-handover-phase]",
      "handover phase"
    ),
    handoverProgressBar: requireElement(
      root,
      "[data-demo-handover-progress]",
      "handover progress bar"
    ),
    servingSatellite: requireElement(
      root,
      "[data-demo-serving-satellite]",
      "serving satellite"
    ),
    servingMetric: requireElement(
      root,
      "[data-demo-serving-metric]",
      "serving metric"
    ),
    pendingSatellite: requireElement(
      root,
      "[data-demo-pending-satellite]",
      "pending satellite"
    ),
    pendingMetric: requireElement(
      root,
      "[data-demo-pending-metric]",
      "pending metric"
    ),
    contextSatellite: requireElement(
      root,
      "[data-demo-context-satellite]",
      "context satellite"
    ),
    recentEvent: requireElement(root, "[data-demo-recent-event]", "recent event"),
    detail: requireElement(root, "[data-demo-detail]", "detail")
  };
}
