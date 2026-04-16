import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useWebEndpointSession } from "../providers/WebEndpointSessionProvider";

type ShellView = "fleet" | "alerts" | "activity";

const navItems: Array<{ label: string; to: string; view: ShellView }> = [
  { label: "Fleet", to: "/instances", view: "fleet" },
  { label: "Alerts", to: "/instances?view=alerts", view: "alerts" },
  { label: "Activity", to: "/instances?view=activity", view: "activity" },
];

function getShellView(search: string): ShellView {
  const view = new URLSearchParams(search).get("view");

  if (view === "alerts" || view === "activity") {
    return view;
  }

  return "fleet";
}

function getShellContext(pathname: string, view: ShellView) {
  if (pathname.startsWith("/instances/")) {
    return {
      eyebrow: "Instance Drill Down",
      title: "Telemetry Navigation",
      subtitle:
        "Jump between the summary, CPU chart, and recent metrics without losing the live refresh context.",
      actions: [
        { label: "Back to Fleet", to: "/instances", primary: false },
        {
          label: "Open Alert Queue",
          to: "/instances?view=alerts",
          primary: true,
        },
      ],
    };
  }

  if (pathname === "/login") {
    return {
      eyebrow: "Access",
      title: "Session Endpoint Access",
      subtitle:
        "The web console does not use device-local auth. Enter the monitoring endpoint each time you open a session.",
      actions: [{ label: "Enter Endpoint", to: "/login", primary: true }],
    };
  }

  if (view === "alerts") {
    return {
      eyebrow: "Priority View",
      title: "Alert Queue",
      subtitle:
        "Focus on instances with elevated CPU or memory pressure and jump directly into the detail graph from there.",
      actions: [
        { label: "Fleet Overview", to: "/instances", primary: false },
        {
          label: "Recent Activity",
          to: "/instances?view=activity",
          primary: true,
        },
      ],
    };
  }

  if (view === "activity") {
    return {
      eyebrow: "Recent Changes",
      title: "Activity Stream",
      subtitle:
        "Track the most recently updated instances and use anchored navigation to move between hotspots quickly.",
      actions: [
        { label: "Alert Queue", to: "/instances?view=alerts", primary: false },
        { label: "Full Fleet", to: "/instances", primary: true },
      ],
    };
  }

  return {
    eyebrow: "Command Surface",
    title: "Fleet Navigation",
    subtitle:
      "Use the web console to move from the fleet overview into live instance graphs and recent operational activity.",
    actions: [
      { label: "Open Alerts", to: "/instances?view=alerts", primary: false },
      {
        label: "Recent Activity",
        to: "/instances?view=activity",
        primary: true,
      },
    ],
  };
}

function isNavItemActive(
  pathname: string,
  activeView: ShellView,
  itemView: ShellView,
): boolean {
  if (pathname.startsWith("/instances/")) {
    return itemView === "fleet";
  }

  if (pathname !== "/instances") {
    return false;
  }

  return activeView === itemView;
}

export default function Layout({
  accessMode = "private",
}: {
  accessMode?: "private" | "public";
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearEndpoint, endpointLabel } = useWebEndpointSession();
  const activeView = getShellView(location.search);
  const shellContext = getShellContext(location.pathname, activeView);
  const isPublicAccessMode = accessMode === "public";

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const element = document.getElementById(location.hash.slice(1));
      element?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [location.hash, location.pathname, location.search]);

  function handleChangeEndpoint(): void {
    clearEndpoint();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">CM</div>
          <div>
            <div className="brand-title">Cloud Monitor</div>
            <div className="brand-sub">AWS Control Plane</div>
          </div>
        </div>
        <nav className="topnav" aria-label="Primary">
          {isPublicAccessMode ? (
            <span className="nav-link session-mode-pill">
              Endpoint required each session
            </span>
          ) : (
            navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className={`nav-link${
                  isNavItemActive(location.pathname, activeView, item.view)
                    ? " active"
                    : ""
                }`}
              >
                {item.label}
              </Link>
            ))
          )}
        </nav>
        {isPublicAccessMode ? (
          <div className="meta">
            <div className="meta-item">
              <span className="meta-label">Access</span>
              <span className="meta-value">Endpoint gate</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Storage</span>
              <span className="meta-value">Session only</span>
            </div>
          </div>
        ) : (
          <div className="meta">
            <div className="meta-item">
              <span className="meta-label">Endpoint</span>
              <span className="meta-value meta-value-wide">
                {endpointLabel ?? "Not connected"}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Session</span>
              <span className="meta-value">Current tab only</span>
            </div>
            <button
              className="btn ghost shell-session-button"
              onClick={handleChangeEndpoint}
              type="button"
            >
              Change Endpoint
            </button>
          </div>
        )}
      </header>
      <section className="shell-banner">
        <div className="shell-copy">
          <div className="eyebrow">{shellContext.eyebrow}</div>
          <h1 className="shell-title">{shellContext.title}</h1>
          <p className="shell-subtitle">{shellContext.subtitle}</p>
        </div>
        <div className="shell-actions">
          {shellContext.actions.map((action) => (
            <Link
              key={action.label}
              className={`btn${action.primary ? " primary" : " ghost"}`}
              to={action.to}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </section>
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="footer">
        <strong>Cloud Infrastructure Monitoring</strong> - Sprint 1 UI scaffold
      </footer>
    </div>
  );
}
