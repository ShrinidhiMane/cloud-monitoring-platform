import { startTransition, useEffect, useEffectEvent, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMonitoringOverview, type MonitoringInstance } from "api-client";

const POLL_INTERVAL_MS = 30000;

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

export default function Instances() {
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

  const runningCount = instances.filter(
    (instance) => instance.state === "running",
  ).length;
  const stoppedCount = instances.filter(
    (instance) => instance.state === "stopped",
  ).length;
  const pendingCount = instances.filter(
    (instance) => instance.state === "pending",
  ).length;
  const alertCount = instances.filter((instance) => {
    return instance.cpuPercent >= 80 || instance.memoryPercent >= 80;
  }).length;
  const statCards = [
    { label: "Running", value: String(runningCount) },
    { label: "Stopped", value: String(stoppedCount) },
    { label: "Pending", value: String(pendingCount) },
    { label: "Alerts", value: String(alertCount) },
  ];
  const statusText = error
    ? error
    : isLoading && !instances.length
      ? "Loading live EC2 metrics..."
      : `Last sync ${formatAge(lastUpdated)}. Refreshes every 30s.`;

  return (
    <div className="page">
      <section className="section">
        <div className="page-header">
          <div>
            <div className="eyebrow">Infrastructure Overview</div>
            <h1 className="page-title">Instance Control Center</h1>
            <p className="page-subtitle">
              Monitor live instance health, follow CPU and memory pressure, and
              drill into a near real-time graph from the detail page.
            </p>
          </div>
          <div className="header-actions">
            <span className="live-pill">Live Fleet</span>
            <span className="live-pill muted">{statusText}</span>
          </div>
        </div>

        <div className="stat-grid">
          {stats.map((card) => (
            <div key={card.label} className="stat-card">
              <div className="stat-label">{card.label}</div>
              <div className="stat-value">{card.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Instances</div>
            <p className="page-subtitle">
              Cards refresh in the background so you can jump into a live graph
              without a manual reload.
            </p>
          </div>
          <div className={`status-inline${error ? " error" : ""}`}>
            {statusText}
          </div>
        </div>

        {isLoading && !instances.length ? (
          <div className="cpu-chart-empty">Loading instances...</div>
        ) : null}

        {!isLoading && !instances.length ? (
          <div className="cpu-chart-empty">
            {error ??
              "No running instances were returned by the monitoring API."}
          </div>
        ) : null}

        {instances.length ? (
          <div className="card-grid">
            {instances.map((instance) => (
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
                  <button className="btn ghost" type="button">
                    Start
                  </button>
                  <button className="btn ghost" type="button">
                    Stop
                  </button>
                  <button className="btn" type="button">
                    Reboot
                  </button>
                  <Link
                    className="btn primary"
                    to={`/instances/${instance.id}`}
                  >
                    Details
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
