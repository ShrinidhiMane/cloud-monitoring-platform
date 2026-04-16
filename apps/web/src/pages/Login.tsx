import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useWebEndpointSession } from "../providers/WebEndpointSessionProvider";

export default function Login() {
  const navigate = useNavigate();
  const { connectToEndpoint } = useWebEndpointSession();
  const [endpointInput, setEndpointInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Enter the monitoring endpoint to start a web session. The URL is not saved after refresh or sign out.",
  );
  const statusItems = [
    {
      label: "Storage",
      value: "This session only",
    },
    {
      label: "Required",
      value: "Monitoring URL",
    },
    {
      label: "Biometrics",
      value: "Unavailable",
    },
  ];

  function applyExample(endpoint: string): void {
    setErrorMessage(null);
    setStatusMessage("Paste the backend URL and open a monitoring session.");
    setEndpointInput(endpoint);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!endpointInput.trim()) {
      setErrorMessage("Enter the monitoring endpoint before continuing.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage("Checking the endpoint and opening the monitoring session...");

    try {
      await connectToEndpoint(endpointInput);
      setStatusMessage("Endpoint accepted. Opening the fleet view.");
      navigate("/instances", { replace: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Couldn't reach that monitoring endpoint.",
      );
      setStatusMessage(
        "Use the backend base URL or the full /monitoring endpoint. The app does not save it after this session ends.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page endpoint-access-page">
      <section className="endpoint-access-shell">
        <div className="endpoint-access-rail">
          <div className="eyebrow">Web Access</div>
          <h1 className="page-title">Start a monitoring session</h1>
          <p className="page-subtitle">
            The web console does not keep a local PIN. Each time you open it,
            enter the monitoring endpoint for the environment you want to use.
          </p>

          <div className="endpoint-access-status-grid">
            {statusItems.map((item) => (
              <div key={item.label} className="endpoint-access-status-card">
                <span className="endpoint-access-status-label">{item.label}</span>
                <strong className="endpoint-access-status-value">{item.value}</strong>
              </div>
            ))}
          </div>

          <div className="endpoint-access-notes">
            <div className="endpoint-access-note">
              Paste either the server base URL or the full monitoring URL.
            </div>
            <div className="endpoint-access-note">
              The session resets on refresh or sign out, so the endpoint is
              always entered again when the web app reopens.
            </div>
            <div className="endpoint-access-note">
              If the site runs over HTTPS, the monitoring endpoint also needs
              HTTPS to avoid browser mixed-content blocking.
            </div>
          </div>
        </div>

        <form className="endpoint-access-card" onSubmit={handleSubmit}>
          <div className="endpoint-access-card-header">
            <div>
              <div className="eyebrow">Endpoint Gate</div>
              <h2 className="endpoint-access-title">Connect the web console</h2>
            </div>
            <div className="endpoint-access-stage">Required every login</div>
          </div>

          <label className="endpoint-field" htmlFor="monitoring-endpoint">
            <span className="endpoint-label">Monitoring endpoint</span>
            <input
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              className="endpoint-input"
              id="monitoring-endpoint"
              inputMode="url"
              onChange={(event) => {
                setErrorMessage(null);
                setEndpointInput(event.target.value);
              }}
              placeholder="http://16.59.20.106:5000 or /monitoring"
              spellCheck={false}
              type="url"
              value={endpointInput}
            />
          </label>

          <p className="endpoint-help">
            The app strips a trailing <code>/monitoring</code> path
            automatically, then checks the endpoint before loading instances.
          </p>

          <div className="endpoint-example-list" aria-label="Endpoint examples">
            <button
              className="endpoint-example-chip"
              onClick={() => applyExample("http://localhost:5000/monitoring")}
              type="button"
            >
              localhost example
            </button>
            <button
              className="endpoint-example-chip"
              onClick={() =>
                applyExample("http://16.59.20.106:5000/monitoring")
              }
              type="button"
            >
              team endpoint example
            </button>
          </div>

          <div className="endpoint-feedback" aria-live="polite">
            {errorMessage ? (
              <p className="endpoint-error">{errorMessage}</p>
            ) : (
              <p className="endpoint-status-text">{statusMessage}</p>
            )}
          </div>

          <div className="endpoint-actions">
            <button
              className="btn ghost"
              onClick={() => setEndpointInput("")}
              type="button"
            >
              Clear
            </button>
            <button
              className="btn primary"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Connecting..." : "Open Monitoring Console"}
            </button>
          </div>

          <div className="endpoint-session-summary">
            <span className="endpoint-summary-label">Session behavior</span>
            <p className="endpoint-summary-text">
              This URL is kept in memory only for the current web session.
              Closing or refreshing the page sends the user back here.
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}
