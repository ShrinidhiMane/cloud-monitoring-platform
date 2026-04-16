import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMonitoring, type MonitoringInstance } from "api-client";

function formatTimestamp(value?: string) {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleString();
}

export default function Instances() {
  const [instances, setInstances] = useState<MonitoringInstance[]>([]);
  const [search, setSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadMonitoring = async () => {
      try {
        if (isMounted && !instances.length) {
          setIsLoading(true);
        }

        const response = await fetchMonitoring("1h");

        if (!isMounted) {
          return;
        }

        setInstances(response.instances);
        setLastUpdated(response.timestamp);
        setError("");
      } catch (err) {
        if (!isMounted) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load monitoring data.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadMonitoring();
    const intervalId = window.setInterval(loadMonitoring, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [instances.length]);

  const filteredInstances = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return instances;
    }

    return instances.filter((instance) => {
      return [
        instance.name,
        instance.id,
        instance.instanceId,
        instance.type,
        instance.availabilityZone ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [instances, search]);

  const stats = useMemo(() => {
    const running = instances.filter((item) => item.state === "running").length;
    const stopped = instances.filter((item) => item.state === "stopped").length;
    const pending = instances.filter((item) => item.state === "pending").length;
    const alerts = instances.filter((item) => item.statusCheckFailed > 0).length;

    return [
      { label: "Running", value: String(running) },
      { label: "Stopped", value: String(stopped) },
      { label: "Pending", value: String(pending) },
      { label: "Alerts", value: String(alerts) },
    ];
  }, [instances]);

  return (
    <div className="page">
      <section className="section">
        <div className="page-header">
          <div>
            <div className="eyebrow">Infrastructure Overview</div>
            <h1 className="page-title">Instance Control Center</h1>
            <p className="page-subtitle">
              Monitor health, usage, and performance across your EC2 fleet.
            </p>
            <p className="page-subtitle" style={{ marginTop: 8 }}>
              Last refreshed: {formatTimestamp(lastUpdated)}
            </p>
          </div>
          <div className="header-actions">
            <button className="btn ghost" type="button">
              Auto refresh: 30s
            </button>
            <button className="btn primary" type="button">
              Live Monitoring
            </button>
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
          <div className="panel-title">Instances</div>
          <input
            className="search"
            placeholder="Search by name, type, zone, or ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {isLoading ? <p className="page-subtitle">Loading live monitoring data...</p> : null}
        {error ? <p className="page-subtitle" style={{ color: "#B91C1C" }}>{error}</p> : null}

        {!isLoading && !filteredInstances.length ? (
          <p className="page-subtitle">No instances matched your search.</p>
        ) : null}

        <div className="card-grid">
          {filteredInstances.map((instance) => (
            <article key={instance.id} className="instance-card">
              <div className="instance-header">
                <div>
                  <div className="instance-name">{instance.name}</div>
                  <div className="instance-id">{instance.instanceId}</div>
                </div>
                <span className="status-pill" data-state={instance.state}>
                  {instance.state}
                </span>
              </div>

              <div className="instance-meta">
                <div>Type: {instance.type}</div>
                <div>Zone: {instance.availabilityZone ?? "N/A"}</div>
                <div>Public IP: {instance.publicIp ?? "Private only"}</div>
                <div>Status checks: {instance.statusCheckFailed}</div>
              </div>

              <div className="meter">
                <div>CPU</div>
                <div>{instance.cpuPercent}%</div>
                <div className="meter-bar">
                  <span style={{ width: `${Math.min(instance.cpuPercent, 100)}%` }} />
                </div>
              </div>

              <div className="meter">
                <div>Memory</div>
                <div>{instance.memoryPercent}%</div>
                <div className="meter-bar">
                  <span
                    style={{ width: `${Math.min(instance.memoryPercent, 100)}%` }}
                  />
                </div>
              </div>

              <div className="card-actions">
                <button className="btn ghost" type="button">
                  Net In: {instance.networkInBytes}
                </button>
                <button className="btn ghost" type="button">
                  Net Out: {instance.networkOutBytes}
                </button>
                <Link className="btn primary" to={`/instances/${instance.id}`}>
                  Details
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
