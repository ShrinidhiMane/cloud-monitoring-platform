import React, { createContext, useContext, useState } from "react";
import {
  API_URL,
  fetchMonitoringOverview,
  getApiBaseUrl,
  setApiBaseUrl,
} from "api-client";

interface WebEndpointSessionContextValue {
  connectToEndpoint: (input: string) => Promise<string>;
  clearEndpoint: () => void;
  endpointLabel: string | null;
  endpointUrl: string | null;
  hasSessionEndpoint: boolean;
}

const WebEndpointSessionContext =
  createContext<WebEndpointSessionContextValue | null>(null);

function normalizeMonitoringEndpoint(input: string): string {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    throw new Error("Enter the monitoring endpoint URL.");
  }

  const candidateUrl = /^https?:\/\//i.test(trimmedInput)
    ? trimmedInput
    : `http://${trimmedInput}`;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(candidateUrl);
  } catch {
    throw new Error("Enter a valid http or https URL.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("Use an http or https URL.");
  }

  parsedUrl.search = "";
  parsedUrl.hash = "";

  const pathname = parsedUrl.pathname.replace(/\/+$/, "");
  parsedUrl.pathname = pathname.replace(/\/monitoring$/i, "") || "/";

  return parsedUrl.toString().replace(/\/$/, "");
}

function formatEndpointLabel(endpointUrl: string | null): string | null {
  if (!endpointUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(endpointUrl);
    return `${parsedUrl.host}${parsedUrl.pathname === "/" ? "" : parsedUrl.pathname}`;
  } catch {
    return endpointUrl;
  }
}

export function WebEndpointSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [endpointUrl, setEndpointUrlState] = useState<string | null>(null);

  async function connectToEndpoint(input: string): Promise<string> {
    const normalizedEndpoint = normalizeMonitoringEndpoint(input);
    const previousBaseUrl = getApiBaseUrl();

    setApiBaseUrl(normalizedEndpoint);

    try {
      await fetchMonitoringOverview("1h");
      setEndpointUrlState(normalizedEndpoint);
      return normalizedEndpoint;
    } catch (error) {
      setApiBaseUrl(previousBaseUrl);
      throw error;
    }
  }

  function clearEndpoint(): void {
    setEndpointUrlState(null);
    setApiBaseUrl(API_URL);
  }

  return (
    <WebEndpointSessionContext.Provider
      value={{
        connectToEndpoint,
        clearEndpoint,
        endpointLabel: formatEndpointLabel(endpointUrl),
        endpointUrl,
        hasSessionEndpoint: endpointUrl !== null,
      }}
    >
      {children}
    </WebEndpointSessionContext.Provider>
  );
}

export function useWebEndpointSession(): WebEndpointSessionContextValue {
  const context = useContext(WebEndpointSessionContext);

  if (!context) {
    throw new Error(
      "useWebEndpointSession must be used within a WebEndpointSessionProvider.",
    );
  }

  return context;
}
