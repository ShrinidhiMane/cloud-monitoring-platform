import { startTransition, useEffect, useEffectEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  fetchMonitoringOverview,
  getInstanceAlarms,
  isAlarmActive,
  sortMonitoringAlarms,
  type MonitoringAlarm,
  type MonitoringInstance,
  type MonitoringStatus,
} from "api-client";

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
      "Monitor live instance health, review AWS CloudWatch alarm state, and jump directly into the detail graph.",
    emptyState: "No running instances were returned by the monitoring API.",
  },
  alerts: {
    eyebrow: "CloudWatch Alarms",
    title: "Instances With Active AWS Alarms",
    subtitle:
      "This queue is driven by live CloudWatch alarm state instead of inferred CPU thresholds so you can work from the real AWS signal first.",
    emptyState:
      "No instance-linked CloudWatch alarms are firing right now.",
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

function formatThreshold(value: number | null) {
  if (typeof value !== "number") {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatAlarmTarget(alarm: MonitoringAlarm) {
  return (
    alarm.instanceName ??
    alarm.instanceId ??
    `${alarm.namespace} / ${alarm.metric}`
  );
}

function formatFleetStatus(status: MonitoringStatus) {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "degraded":
      return "Degraded";
    default:
      return "Unknown";
  }
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
  const [alarms, setAlarms] = useState<MonitoringAlarm[]>([]);
  const [fleetStatus, setFleetStatus] = useState<MonitoringStatus>("unknown");
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
        setAlarms(response.alarms);
        setFleetStatus(response.status);
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
  const sortedAlarms = sortMonitoringAlarms(alarms);
  const activeAlarms = sortedAlarms.filter(isAlarmActive);
  const alertedInstances = sortedByActivity.filter((instance) => {
    return getInstanceAlarms(activeAlarms, instance.id).length > 0;
  });
  const activeAlarmCountByInstance = new Map(
    alertedInstances.map((instance) => [
      instance.id,
      getInstanceAlarms(activeAlarms, instance.id).length,
    ]),
  );
  const displayInstances =
    currentView === "alerts"
      ? alertedInstances
      : currentView === "activity"
        ? sortedByActivity
        : instances;
  const recentActivity = sortedByActivity.slice(0, 4);
  const topAlarm = activeAlarms[0] ?? null;
  const runningCount = instances.filter(
    (instance) => instance.state === "running",
  ).length;
  const stoppedCount = instances.filter(
    (instance) => instance.state === "stopped",
  ).length;
  const statCards = [
    { label: "Running", value: String(runningCount) },
    { label: "Stopped", value: String(stoppedCount) },
    { label: "Alarmed Instances", value: String(alertedInstances.length) },
    { label: "AWS Alarms", value: String(activeAlarms.length) },
  ];
  const viewCopy = VIEW_COPY[currentView];
  const emptyQueueText =
    currentView === "alerts" && activeAlarms.length > 0
      ? "AWS alarms are active, but none of the firing alarms currently include an EC2 instance dimension that matches this fleet view."
      : error ?? viewCopy.emptyState;
  const statusText = error
    ? error
    : isLoading && !instances.length
      ? "Loading live EC2 metrics..."
      : `${formatFleetStatus(fleetStatus)} status. Last sync ${formatAge(lastUpdated)}. ${activeAlarms.length} active AWS alarm${activeAlarms.length === 1 ? "" : "s"}.`;

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
          <a className="page-nav-link" href="#aws-alarm-feed">
            Alarm Feed
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
                  {activeAlarms.length} active
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
              <div className="panel-title">Alarm Spotlight</div>
              <span className="status-inline">Highest priority AWS alarm</span>
            </div>
            {topAlarm ? (
              <div className="spotlight-card">
                <div className="alarm-header">
                  <div>
                    <div className="instance-name">{topAlarm.alarmName}</div>
                    <div className="instance-id">
                      {formatAlarmTarget(topAlarm)}
                    </div>
                  </div>
                  <span
                    className="alarm-state-pill"
                    data-alarm-state={topAlarm.state}
                  >
                    {topAlarm.state}
                  </span>
                </div>
                <div className="instance-meta">
                  <div>Metric: {topAlarm.metric}</div>
                  <div>Namespace: {topAlarm.namespace}</div>
                  <div>Threshold: {formatThreshold(topAlarm.threshold)}</div>
                  <div>Updated: {formatAge(topAlarm.updatedAt)}</div>
                </div>
                {topAlarm.stateReason ? (
                  <div className="alarm-reason">{topAlarm.stateReason}</div>
                ) : null}
                <div className="card-actions">
                  {topAlarm.instanceId ? (
                    <>
                      <Link
                        className="btn ghost"
                        to={`/instances/${topAlarm.instanceId}#alarm-status`}
                      >
                        Alarm Status
                      </Link>
                      <Link
                        className="btn primary"
                        to={`/instances/${topAlarm.instanceId}#cpu-chart`}
                      >
                        Open Instance
                      </Link>
                    </>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="cpu-chart-empty compact-empty">
                No active AWS alarms are firing right now.
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
          <div className="cpu-chart-empty">{emptyQueueText}</div>
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
                {(activeAlarmCountByInstance.get(instance.id) ?? 0) > 0 ? (
                  <div className="alarm-inline-badge">
                    {activeAlarmCountByInstance.get(instance.id)} active AWS
                    alarm
                    {activeAlarmCountByInstance.get(instance.id) === 1
                      ? ""
                      : "s"}
                  </div>
                ) : null}
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

      <section className="panel" id="aws-alarm-feed">
        <div className="panel-header">
          <div>
            <div className="panel-title">AWS Alarm Feed</div>
            <p className="page-subtitle">
              CloudWatch metric alarms are sorted with firing alarms first so
              you can review the AWS signal before drilling into metrics.
            </p>
          </div>
          <div className="status-inline">
            {sortedAlarms.length} alarm{sortedAlarms.length === 1 ? "" : "s"}
          </div>
        </div>

        {sortedAlarms.length ? (
          <div className="alarm-list">
            {sortedAlarms.map((alarm) => (
              <article
                key={`${alarm.alarmName}-${alarm.updatedAt ?? "unknown"}-${alarm.instanceId ?? "resource"}`}
                className="alarm-card"
              >
                <div className="alarm-header">
                  <div>
                    <div className="instance-name">{alarm.alarmName}</div>
                    <div className="instance-id">{formatAlarmTarget(alarm)}</div>
                  </div>
                  <span
                    className="alarm-state-pill"
                    data-alarm-state={alarm.state}
                  >
                    {alarm.state}
                  </span>
                </div>
                <div className="instance-meta">
                  <div>Metric: {alarm.metric}</div>
                  <div>Namespace: {alarm.namespace}</div>
                  <div>Threshold: {formatThreshold(alarm.threshold)}</div>
                  <div>Updated: {formatAge(alarm.updatedAt)}</div>
                </div>
                {alarm.stateReason ? (
                  <div className="alarm-reason">{alarm.stateReason}</div>
                ) : null}
                <div className="card-actions">
                  {alarm.instanceId ? (
                    <Link
                      className="btn ghost"
                      to={`/instances/${alarm.instanceId}#alarm-status`}
                    >
                      Open Instance
                    </Link>
                  ) : (
                    <span className="status-inline">
                      No linked EC2 instance
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="cpu-chart-empty">
            No CloudWatch alarms were returned by the monitoring API.
          </div>
        )}
      </section>
    </div>
  );
}
