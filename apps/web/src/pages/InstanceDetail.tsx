import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchInstanceMonitoring, type MonitoringInstance } from "api-client";

const RANGE_OPTIONS = ["1h", "6h", "24h", "7d"] as const;
type RangeOption = (typeof RANGE_OPTIONS)[number];

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleString();
}

export default function InstanceDetail() {
  const { instanceId } = useParams();
  const [range, setRange] = useState<RangeOption>("24h");
  const [instance, setInstance] = useState<MonitoringInstance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadInstance = async () => {
      if (!instanceId) {
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetchInstanceMonitoring(instanceId, range);

        if (!isMounted) {
          return;
        }

        setInstance(response);
        setError(response ? "" : "Instance not found in monitoring response.");
      } catch (err) {
        if (!isMounted) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load instance monitoring.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadInstance();

    return () => {
      isMounted = false;
    };
  }, [instanceId, range]);

  const chartPoints = useMemo(() => {
    return (instance?.cpuSeries ?? []).slice(-12);
  }, [instance]);

  return (
    <div className="page">
      <section className="section">
        <div className="page-header">
          <div>
            <div className="eyebrow">Instance Detail</div>
            <h1 className="page-title">{instance?.name ?? instanceId ?? "Instance"}</h1>
            <p className="page-subtitle">
              Live metrics, extended AWS details, and recent utilization.
            </p>
          </div>
          <div className="header-actions">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option}
                className={`btn${range === option ? " primary" : " ghost"}`}
                type="button"
                onClick={() => setRange(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? <p className="page-subtitle">Loading instance monitoring...</p> : null}
        {error ? <p className="page-subtitle" style={{ color: "#B91C1C" }}>{error}</p> : null}

        {instance ? (
          <div className="detail-grid">
            <div className="detail-card">
              <div className="panel-title">Health</div>
              <p className="page-subtitle">
                State: {instance.state}, Status checks failed: {instance.statusCheckFailed}
              </p>
            </div>
            <div className="detail-card">
              <div className="panel-title">Configuration</div>
              <p className="page-subtitle">
                {instance.type} · {instance.availabilityZone ?? "N/A"} · Image:{" "}
                {instance.imageId ?? "N/A"}
              </p>
            </div>
            <div className="detail-card">
              <div className="panel-title">Network</div>
              <p className="page-subtitle">
                Public IP: {instance.publicIp ?? "Private only"}<br />
                Launched: {formatDate(instance.launchedAt)}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="panel-title">CPU Utilization</div>
          <button className="btn ghost" type="button">
            Range: {range}
          </button>
        </div>

        {instance ? (
          <>
            <div className="detail-grid" style={{ marginBottom: 16 }}>
              <div className="detail-card">
                <div className="panel-title">CPU</div>
                <p className="page-subtitle">{instance.cpuPercent}% current usage</p>
              </div>
              <div className="detail-card">
                <div className="panel-title">Memory</div>
                <p className="page-subtitle">{instance.memoryPercent}% current usage</p>
              </div>
              <div className="detail-card">
                <div className="panel-title">Disk</div>
                <p className="page-subtitle">
                  Read: {instance.diskReadOps}, Write: {instance.diskWriteOps}
                </p>
              </div>
            </div>

            <div
              className="chart-placeholder"
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
                padding: 20,
              }}
            >
              {chartPoints.length ? (
                chartPoints.map((point) => (
                  <div
                    key={`${point.timestamp}-${point.label}`}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      gap: 8,
                      height: "100%",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        maxWidth: 26,
                        borderRadius: 999,
                        background:
                          "linear-gradient(180deg, rgba(28,139,122,0.95), rgba(224,122,47,0.9))",
                        height: `${Math.max(point.value, 4)}%`,
                        minHeight: 12,
                      }}
                    />
                    <span style={{ fontSize: 11, color: "#5B554B" }}>{point.label}</span>
                  </div>
                ))
              ) : (
                <div className="page-subtitle">No CPU series available for this range.</div>
              )}
            </div>
          </>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="panel-title">Traffic Summary</div>
          <button className="btn ghost" type="button">
            Live
          </button>
        </div>

        {instance ? (
          <div className="event-list">
            <div className="event-item">
              <div>Network In</div>
              <div>{instance.networkInBytes}</div>
            </div>
            <div className="event-item">
              <div>Network Out</div>
              <div>{instance.networkOutBytes}</div>
            </div>
            <div className="event-item">
              <div>Monitoring ID</div>
              <div>{instance.instanceId}</div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
