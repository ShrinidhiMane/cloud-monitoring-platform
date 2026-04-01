import { startTransition, useEffect, useEffectEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchMonitoringOverview, type MonitoringInstance } from "api-client";

const POLL_INTERVAL_MS = 30000;

type InstancesView = "fleet" | "alerts" | "activity";

const VIEW_COPY: Record<
  InstancesView,
  {
    eyebrow: string;
    title: string;
    subtitle: string;
    emptyState: string;
  }
> = {
  fleet: {
    eyebrow: "Infrastructure Overview",
    title: "Instance Control Center",
    subtitle:
      "Monitor live instance health, follow CPU and memory pressure, and jump directly into the detail graph.",
    emptyState: "No running instances were returned by the monitoring API.",
  },
  alerts: {
    eyebrow: "Focused Queue",
    title: "Instances Requiring Attention",
    subtitle:
      "This view filters the fleet down to CPU or memory hotspots so the next click takes you straight to the right graph.",
    emptyState:
      "No instances are currently breaching the CPU or memory watch threshold.",
  },
  activity: {
    eyebrow: "Recent Activity",
    title: "Most Recently Updated Instances",
    subtitle:
      "This queue is sorted by the freshest monitoring updates so you can inspect the most active instances first.",
    emptyState: "No recent instance activity is available yet.",
  },
};

function getInstancesView(view: string | null): InstancesView {
  if (view === "alerts" || view === "activity") {
    return view;
  }

  return "fleet";
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatAge(timestamp?: string | null) {
  if (!timestamp) {
    return "waiting for the first sync";
  }

  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffSeconds = Math.max(Math.round(diffMs / 1000), 0);

  if (diffSeconds < 60) {
    return "just now";
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return `${Math.floor(diffHours / 24)}d ago`;
}

function isAlerting(instance: MonitoringInstance) {
  return instance.cpuPercent >= 80 || instance.memoryPercent >= 80;
}

function parseUpdatedAt(timestamp?: string) {
  if (!timestamp) {
    return 0;
  }

  const parsedTimestamp = Date.parse(timestamp);
  return Number.isNaN(parsedTimestamp) ? 0 : parsedTimestamp;
}

export default function Instances() {
  const [searchParams] = useSearchParams();
  const currentView = getInstancesView(searchParams.get("view"));
  const [instances, setInstances] = useState<MonitoringInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadInstances = useEffectEvent(async (backgroundRefresh = false) => {
    if (!backgroundRefresh) {
      setIsLoading(true);
    }

    try {
      const response = await fetchMonitoringOverview("1h");

      startTransition(() => {
        setInstances(response.instances);
        setLastUpdated(response.timestamp);
        setError(null);
      });
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Couldn't refresh the instance overview.";

      startTransition(() => {
        setError(message);
      });
    } finally {
      if (!backgroundRefresh) {
        setIsLoading(false);
      }
    }
  });

  useEffect(() => {
    void loadInstances(false);

    const intervalId = window.setInterval(() => {
      void loadInstances(true);
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const sortedByActivity = [...instances].sort((left, right) => {
    return (
      parseUpdatedAt(right.updatedAt) - parseUpdatedAt(left.updatedAt) ||
      right.cpuPercent - left.cpuPercent
    );
  });
  const alertedInstances = sortedByActivity.filter(isAlerting);
  const displayInstances =
    currentView === "alerts"
      ? alertedInstances
      : currentView === "activity"
        ? sortedByActivity
        : instances;
  const recentActivity = sortedByActivity.slice(0, 4);
  const topAlert = alertedInstances[0] ?? null;
  const runningCount = instances.filter(
    (instance) => instance.state === "running",
  ).length;
  const stoppedCount = instances.filter(
    (instance) => instance.state === "stopped",
  ).length;
  const pendingCount = instances.filter(
    (instance) => instance.state === "pending",
  ).length;
  const statCards = [
    { label: "Running", value: String(runningCount) },
    { label: "Stopped", value: String(stoppedCount) },
    { label: "Pending", value: String(pendingCount) },
    { label: "Alerts", value: String(alertedInstances.length) },
  ];
  const statusText = error
    ? error
    : isLoading && !instances.length
      ? "Loading live EC2 metrics..."
      : `Last sync ${formatAge(lastUpdated)}. Refreshes every 30s.`;
  const viewCopy = VIEW_COPY[currentView];

  return (
    <div className="page">
      <section className="section" id="fleet-summary">
        <div className="page-header">
          <div>
            <div className="eyebrow">{viewCopy.eyebrow}</div>
            <h1 className="page-title">{viewCopy.title}</h1>
            <p className="page-subtitle">{viewCopy.subtitle}</p>
          </div>
          <div className="header-actions">
            <span className="live-pill">Live Fleet</span>
            <span className="live-pill muted">{statusText}</span>
          </div>
        </div>

        <nav className="page-nav" aria-label="Instances page sections">
          <a className="page-nav-link" href="#fleet-summary">
            Overview
          </a>
          <a className="page-nav-link" href="#fleet-list">
            Instance Queue
          </a>
          <a className="page-nav-link" href="#activity-stream">
            Activity Stream
          </a>
        </nav>

        <div className="stat-grid">
          {statCards.map((card) => (
            <div key={card.label} className="stat-card">
              <div className="stat-label">{card.label}</div>
              <div className="stat-value">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="overview-grid">
          <article className="panel compact-panel">
            <div className="panel-header">
              <div className="panel-title">Quick Navigation</div>
              <span className="status-inline">Switch list modes</span>
            </div>
            <div className="shortcut-list">
              <Link className="shortcut-link" to="/instances">
                <span>All Instances</span>
                <span className="shortcut-hint">
                  {instances.length} tracked
                </span>
              </Link>
              <Link className="shortcut-link" to="/instances?view=alerts">
                <span>Alert Queue</span>
                <span className="shortcut-hint">
                  {alertedInstances.length} flagged
                </span>
              </Link>
              <Link className="shortcut-link" to="/instances?view=activity">
                <span>Recent Activity</span>
                <span className="shortcut-hint">
                  {recentActivity.length} recent updates
                </span>
              </Link>
            </div>
          </article>

          <article className="panel compact-panel" id="activity-stream">
            <div className="panel-header">
              <div className="panel-title">Recent Activity</div>
              <span className="status-inline">Freshest monitoring samples</span>
            </div>
            {recentActivity.length ? (
              <div className="event-list">
                {recentActivity.map((instance) => (
                  <Link
                    key={instance.id}
                    className="event-item shortcut-item"
                    to={`/instances/${instance.id}#cpu-chart`}
                  >
                    <div>
                      <strong>{instance.name}</strong>
                      <div className="status-inline">{instance.id}</div>
                    </div>
                    <div className="shortcut-hint">
                      Updated {formatAge(instance.updatedAt)}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="cpu-chart-empty compact-empty">
                No recent activity has been recorded yet.
              </div>
            )}
          </article>

          <article className="panel compact-panel">
            <div className="panel-header">
              <div className="panel-title">Alert Spotlight</div>
              <span className="status-inline">Highest pressure right now</span>
            </div>
            {topAlert ? (
              <div className="spotlight-card">
                <div className="instance-header">
                  <div>
                    <div className="instance-name">{topAlert.name}</div>
                    <div className="instance-id">{topAlert.id}</div>
                  </div>
                  <span className="status-pill" data-state={topAlert.state}>
                    {topAlert.state}
                  </span>
                </div>
                <div className="instance-meta">
                  <div>CPU: {formatPercent(topAlert.cpuPercent)}</div>
                  <div>Memory: {formatPercent(topAlert.memoryPercent)}</div>
                  <div>Zone: {topAlert.zone ?? "unknown"}</div>
                  <div>Updated: {formatAge(topAlert.updatedAt)}</div>
                </div>
                <div className="card-actions">
                  <Link
                    className="btn ghost"
                    to={`/instances/${topAlert.id}#instance-summary`}
                  >
                    Summary
                  </Link>
                  <Link
                    className="btn primary"
                    to={`/instances/${topAlert.id}#cpu-chart`}
                  >
                    Open CPU Graph
                  </Link>
                </div>
              </div>
            ) : (
              <div className="cpu-chart-empty compact-empty">
                No alerting instances are active right now.
              </div>
            )}
          </article>
        </div>
      </section>

      <section className="panel" id="fleet-list">
        <div className="panel-header">
          <div>
            <div className="panel-title">Instance Queue</div>
            <p className="page-subtitle">
              {currentView === "alerts"
                ? "Only alerting instances are shown here."
                : currentView === "activity"
                  ? "Instances are sorted by the freshest monitoring update."
                  : "Cards refresh in the background so you can jump into a live graph without a manual reload."}
            </p>
          </div>
          <div className={`status-inline${error ? " error" : ""}`}>
            {statusText}
          </div>
        </div>

        {isLoading && !instances.length ? (
          <div className="cpu-chart-empty">Loading instances...</div>
        ) : null}

        {!isLoading && !displayInstances.length ? (
          <div className="cpu-chart-empty">{error ?? viewCopy.emptyState}</div>
        ) : null}

        {displayInstances.length ? (
          <div className="card-grid">
            {displayInstances.map((instance) => (
              <article key={instance.id} className="instance-card">
                <div className="instance-header">
                  <div>
                    <div className="instance-name">{instance.name}</div>
                    <div className="instance-id">{instance.id}</div>
                  </div>
                  <span className="status-pill" data-state={instance.state}>
                    {instance.state}
                  </span>
                </div>
                <div className="instance-meta">
                  <div>Type: {instance.type}</div>
                  <div>Zone: {instance.zone ?? "unknown"}</div>
                  <div>Updated: {formatAge(instance.updatedAt)}</div>
                  <div>Samples: {instance.cpuSeries.length}</div>
                </div>
                <div className="meter">
                  <div>CPU</div>
                  <div>{formatPercent(instance.cpuPercent)}</div>
                  <div className="meter-bar">
                    <span
                      style={{
                        width: `${Math.min(instance.cpuPercent, 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="meter">
                  <div>Memory</div>
                  <div>{formatPercent(instance.memoryPercent)}</div>
                  <div className="meter-bar">
                    <span
                      style={{
                        width: `${Math.min(instance.memoryPercent, 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="card-actions">
                  <Link
                    className="btn ghost"
                    to={`/instances/${instance.id}#instance-summary`}
                  >
                    Summary
                  </Link>
                  <Link
                    className="btn ghost"
                    to={`/instances/${instance.id}#recent-metrics`}
                  >
                    Recent Metrics
                  </Link>
                  <Link
                    className="btn primary"
                    to={`/instances/${instance.id}#cpu-chart`}
                  >
                    Open CPU Graph
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
