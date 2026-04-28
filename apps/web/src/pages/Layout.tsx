import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

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
      title: "Operator Sign In",
      subtitle:
        "Authenticate before taking any control-plane action or reviewing protected infrastructure data.",
      actions: [{ label: "Browse Fleet", to: "/instances", primary: true }],
    };
  }

  if (view === "alerts") {
    return {
      eyebrow: "CloudWatch Queue",
      title: "Alert Queue",
      subtitle:
        "Review live AWS CloudWatch alarms first, then move straight into the affected instance and its metric history.",
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
      "Use the web console to move from the fleet overview into live CloudWatch alarms, detail graphs, and recent operational activity.",
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

export default function Layout() {
  const location = useLocation();
  const activeView = getShellView(location.search);
  const shellContext = getShellContext(location.pathname, activeView);

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
          {navItems.map((item) => (
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
          ))}
        </nav>
        <div className="meta">
          <div className="meta-item">
            <span className="meta-label">Region</span>
            <span className="meta-value">us-east-1</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Env</span>
            <span className="meta-value">Staging</span>
          </div>
        </div>
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
        <strong>Cloud Infrastructure Monitoring</strong> - AWS CloudWatch alarm
        feed enabled
      </footer>
    </div>
  );
}
