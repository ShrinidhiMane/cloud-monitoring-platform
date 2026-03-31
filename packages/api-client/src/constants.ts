export const API_URL = "http://3.134.116.3:5000";
export const MONITORING_PATH = "/monitoring";
export const MONITORING_URL = `${API_URL}${MONITORING_PATH}`;

let apiBaseUrl = API_URL;

export function setApiBaseUrl(url: string) {
  apiBaseUrl = url.replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  return apiBaseUrl;
}

export function getMonitoringUrl(range?: string) {
  const baseUrl = getApiBaseUrl().replace(/\/+$/, "");
  const query = range ? `?range=${encodeURIComponent(range)}` : "";

  return `${baseUrl}${MONITORING_PATH}${query}`;
}
