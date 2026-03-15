export const API_URL = "http://192.168.0.65:4000/";

let apiBaseUrl = API_URL;

export function setApiBaseUrl(url: string) {
  apiBaseUrl = url.replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  return apiBaseUrl;
}
