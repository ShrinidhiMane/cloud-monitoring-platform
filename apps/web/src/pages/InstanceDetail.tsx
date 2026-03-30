import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import { fetchInstanceMonitoring, type MonitoringInstance } from "api-client";
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
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deferredCpuSeries = useDeferredValue(monitoring?.cpuSeries ?? []);

  const loadMonitoring = useEffectEvent(async (backgroundRefresh = false) => {
    if (!instanceId) {
      setMonitoring(null);
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
      const result = await fetchInstanceMonitoring(instanceId, timeRange);

      startTransition(() => {
        setMonitoring(result);
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
  const title = monitoring?.name ?? instanceId ?? "Instance";
  const refreshLabel = isRefreshing
    ? "Refreshing now"
    : `Last sample ${formatAge(monitoring?.updatedAt)}`;

  return (
    <div className="page">
      <section className="section">
        <div className="page-header">
          <div>
            <div className="eyebrow">Instance Detail</div>
            <h1 className="page-title">{title}</h1>
            <p className="page-subtitle">
              Near real-time CPU graph with automatic refreshes every 15
              seconds.
            </p>
          </div>
          <div className="header-actions">
            <span className="live-pill">
              {isRefreshing ? "Refreshing" : "Live"}
            </span>
            <span className="live-pill muted">{refreshLabel}</span>
          </div>
        </div>

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
        </div>
      </section>

      <section className="panel">
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
              : `${sampleCount} CPU samples loaded. ${refreshLabel}.`}
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

      <section className="panel">
        <div className="panel-header">
          <div className="panel-title">Recent Metrics</div>
          <span className="status-inline">Auto-refresh every 15s</span>
        </div>
        <div className="event-list">
          <div className="event-item">
            <div>Network Out</div>
            <div>{formatCompactNumber(monitoring?.networkOutBytes ?? 0)}</div>
          </div>
          <div className="event-item">
            <div>Disk Reads</div>
            <div>{formatCompactNumber(monitoring?.diskReadOps ?? 0)}</div>
          </div>
          <div className="event-item">
            <div>Disk Writes</div>
            <div>{formatCompactNumber(monitoring?.diskWriteOps ?? 0)}</div>
          </div>
          <div className="event-item">
            <div>Last Updated</div>
            <div>{formatAge(monitoring?.updatedAt)}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
