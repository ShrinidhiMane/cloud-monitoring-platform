import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchMonitoringOverview,
  getInstanceAlarms,
  isAlarmActive,
  sortMonitoringAlarms,
  type MonitoringAlarm,
  type MonitoringInstance,
} from "api-client";
import CpuLineChart from "../components/CpuLineChart";

type TimeRangeOption = "15m" | "1h" | "6h" | "24h";

const RANGE_OPTIONS: Array<{ label: string; value: TimeRangeOption }> = [
  { label: "15m", value: "15m" },
  { label: "1h", value: "1h" },
  { label: "6h", value: "6h" },
  { label: "24h", value: "24h" },
];
const POLL_INTERVAL_MS = 15000;

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatThreshold(value: number | null) {
  if (typeof value !== "number") {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatAge(timestamp?: string) {
  if (!timestamp) {
    return "waiting for the first sample";
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

export default function InstanceDetail() {
  const { instanceId } = useParams();
  const [timeRange, setTimeRange] = useState<TimeRangeOption>("1h");
  const [monitoring, setMonitoring] = useState<MonitoringInstance | null>(null);
  const [instanceAlarms, setInstanceAlarms] = useState<MonitoringAlarm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deferredCpuSeries = useDeferredValue(monitoring?.cpuSeries ?? []);

  const loadMonitoring = useEffectEvent(async (backgroundRefresh = false) => {
    if (!instanceId) {
      setMonitoring(null);
      setInstanceAlarms([]);
      setError("Missing instance id.");
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (backgroundRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const response = await fetchMonitoringOverview(timeRange);
      const result =
        response.instances.find((instance) => instance.id === instanceId) ??
        null;
      const nextInstanceAlarms = sortMonitoringAlarms(
        getInstanceAlarms(response.alarms, instanceId),
      );

      startTransition(() => {
        setMonitoring(result);
        setInstanceAlarms(nextInstanceAlarms);
        setError(
          result
            ? null
            : `No monitoring samples were returned for ${instanceId}.`,
        );
      });
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Couldn't load monitoring data.";

      startTransition(() => {
        setError(
          backgroundRefresh
            ? `Refresh failed. Showing the last successful sample. ${message}`
            : message,
        );
      });
    } finally {
      if (backgroundRefresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  });

  useEffect(() => {
    void loadMonitoring(false);

    if (!instanceId) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void loadMonitoring(true);
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [instanceId, timeRange]);

  const sampleCount = deferredCpuSeries.length;
  const averageCpu = sampleCount
    ? deferredCpuSeries.reduce((sum, point) => sum + point.value, 0) /
      sampleCount
    : 0;
  const peakCpu = sampleCount
    ? Math.max(...deferredCpuSeries.map((point) => point.value))
    : 0;
  const activeInstanceAlarms = instanceAlarms.filter(isAlarmActive);
  const title = monitoring?.name ?? instanceId ?? "Instance";
  const refreshLabel = isRefreshing
    ? "Refreshing now"
    : `Last sample ${formatAge(monitoring?.updatedAt)}`;
  const recentMetrics = [
    {
      label: "AWS Alarms",
      value: `${activeInstanceAlarms.length} active / ${instanceAlarms.length} total`,
    },
    {
      label: "Network Out",
      value: formatCompactNumber(monitoring?.networkOutBytes ?? 0),
    },
    {
      label: "Disk Reads",
      value: formatCompactNumber(monitoring?.diskReadOps ?? 0),
    },
    {
      label: "Disk Writes",
      value: formatCompactNumber(monitoring?.diskWriteOps ?? 0),
    },
    {
      label: "Last Updated",
      value: formatAge(monitoring?.updatedAt),
    },
  ];

  return (
    <div className="page">
      <section className="section" id="instance-summary">
        <div className="breadcrumbs" aria-label="Breadcrumb">
          <Link to="/instances">Instances</Link>
          <span>/</span>
          <span className="breadcrumb-current">{title}</span>
        </div>

        <div className="page-header">
          <div>
            <div className="eyebrow">Instance Detail</div>
            <h1 className="page-title">{title}</h1>
            <p className="page-subtitle">
              Near real-time metric history with automatic refreshes every 15
              seconds and AWS alarm context for this EC2 instance.
            </p>
          </div>
          <div className="header-actions">
            <Link className="btn ghost" to="/instances">
              Back to Fleet
            </Link>
            <Link className="btn ghost" to="/instances?view=alerts">
              Alert Queue
            </Link>
            <span className="live-pill">
              {isRefreshing ? "Refreshing" : "Live"}
            </span>
            <span className="live-pill muted">{refreshLabel}</span>
          </div>
        </div>

        <nav className="page-nav" aria-label="Instance detail sections">
          <a className="page-nav-link" href="#instance-summary">
            Summary
          </a>
          <a className="page-nav-link" href="#cpu-chart">
            CPU Graph
          </a>
          <a className="page-nav-link" href="#alarm-status">
            Alarm Status
          </a>
          <a className="page-nav-link" href="#recent-metrics">
            Recent Metrics
          </a>
        </nav>

        <div className="detail-grid">
          <div className="detail-card">
            <div className="panel-title">State</div>
            <div className="detail-value">{monitoring?.state ?? "loading"}</div>
            <p className="detail-caption">
              Status from the latest monitoring read.
            </p>
          </div>
          <div className="detail-card">
            <div className="panel-title">Instance Type</div>
            <div className="detail-value">{monitoring?.type ?? "--"}</div>
            <p className="detail-caption">Current compute profile.</p>
          </div>
          <div className="detail-card">
            <div className="panel-title">Availability Zone</div>
            <div className="detail-value">{monitoring?.zone ?? "--"}</div>
            <p className="detail-caption">Placement reported by EC2.</p>
          </div>
          <div className="detail-card">
            <div className="panel-title">Memory</div>
            <div className="detail-value">
              {formatPercent(monitoring?.memoryPercent ?? 0)}
            </div>
            <p className="detail-caption">Latest CWAgent memory percentage.</p>
          </div>
          <div className="detail-card">
            <div className="panel-title">AWS Alarms</div>
            <div className="detail-value">{activeInstanceAlarms.length}</div>
            <p className="detail-caption">
              Firing CloudWatch alarms currently attached to this instance.
            </p>
          </div>
        </div>
      </section>

      <section className="panel" id="cpu-chart">
        <div className="panel-header">
          <div>
            <div className="panel-title">CPU Utilization</div>
            <p className="page-subtitle">
              Polling CloudWatch on a short interval and redrawing the graph as
              new samples land.
            </p>
          </div>
          <div className="range-selector" aria-label="CPU range selector">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`range-chip${timeRange === option.value ? " active" : ""}`}
                onClick={() => setTimeRange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`status-banner${error ? " error" : ""}`}>
          {error
            ? error
            : isLoading && !monitoring
              ? "Loading monitoring data..."
              : `${sampleCount} CPU samples loaded. ${activeInstanceAlarms.length} active AWS alarm${activeInstanceAlarms.length === 1 ? "" : "s"}. ${refreshLabel}.`}
        </div>

        {isLoading && !monitoring ? (
          <div className="cpu-chart-empty">Loading CPU samples...</div>
        ) : (
          <CpuLineChart data={deferredCpuSeries} />
        )}

        <div className="metric-grid">
          <div className="metric-card">
            <div className="metric-label">Current CPU</div>
            <div className="metric-value">
              {formatPercent(monitoring?.cpuPercent ?? 0)}
            </div>
            <div className="metric-note">Latest datapoint</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Average</div>
            <div className="metric-value">{formatPercent(averageCpu)}</div>
            <div className="metric-note">Across the selected range</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Peak</div>
            <div className="metric-value">{formatPercent(peakCpu)}</div>
            <div className="metric-note">Highest observed spike</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Network In</div>
            <div className="metric-value">
              {formatCompactNumber(monitoring?.networkInBytes ?? 0)}
            </div>
            <div className="metric-note">Bytes in the latest period</div>
          </div>
        </div>
      </section>

      <section className="panel" id="alarm-status">
        <div className="panel-header">
          <div>
            <div className="panel-title">AWS Alarm Status</div>
            <p className="page-subtitle">
              These CloudWatch alarms are linked to the current EC2 instance by
              its alarm dimensions.
            </p>
          </div>
          <div className={`status-inline${activeInstanceAlarms.length ? " error" : ""}`}>
            {activeInstanceAlarms.length} active / {instanceAlarms.length} total
          </div>
        </div>

        {instanceAlarms.length ? (
          <div className="alarm-list">
            {instanceAlarms.map((alarm) => (
              <article
                key={`${alarm.alarmName}-${alarm.updatedAt ?? "unknown"}`}
                className="alarm-card"
              >
                <div className="alarm-header">
                  <div>
                    <div className="instance-name">{alarm.alarmName}</div>
                    <div className="instance-id">
                      {alarm.namespace} / {alarm.metric}
                    </div>
                  </div>
                  <span
                    className="alarm-state-pill"
                    data-alarm-state={alarm.state}
                  >
                    {alarm.state}
                  </span>
                </div>
                <div className="instance-meta">
                  <div>Threshold: {formatThreshold(alarm.threshold)}</div>
                  <div>
                    Operator: {alarm.comparisonOperator ?? "not provided"}
                  </div>
                  <div>
                    Periods: {alarm.evaluationPeriods ?? "not provided"}
                  </div>
                  <div>Updated: {formatAge(alarm.updatedAt)}</div>
                </div>
                {alarm.stateReason ? (
                  <div className="alarm-reason">{alarm.stateReason}</div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="cpu-chart-empty">
            No CloudWatch alarms are currently attached to this instance.
          </div>
        )}
      </section>

      <section className="panel" id="recent-metrics">
        <div className="panel-header">
          <div className="panel-title">Recent Metrics</div>
          <span className="status-inline">Auto-refresh every 15s</span>
        </div>
        <div className="event-list">
          {recentMetrics.map((metric) => (
            <div key={metric.label} className="event-item">
              <div>{metric.label}</div>
              <div>{metric.value}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
