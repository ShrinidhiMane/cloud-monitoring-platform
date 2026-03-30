export const API_URL = "http://3.134.116.3:5000/";

let apiBaseUrl = API_URL;

export function setApiBaseUrl(url: string) {
  apiBaseUrl = url.replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  return apiBaseUrl;
}
