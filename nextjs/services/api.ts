import axios from "axios";

export const resolveApiBaseUrl = () => {
  const envBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envBaseUrl) return envBaseUrl.replace(/\/+$/, "");

  // Fallback to same-origin API when deployed behind a reverse proxy.
  if (typeof window !== "undefined") return `${window.location.origin}/api`;

  return "http://localhost:5000/api";
};

const API = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

API.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      const requestUrl = String(error.config?.url || "");
      const isAuthAttempt =
        requestUrl.includes("/auth/login") || requestUrl.includes("/auth/register");

      if (!isAuthAttempt) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);

export const resolveAssetUrl = (assetPath?: string | null): string | null => {
  if (!assetPath) return null;
  if (/^https?:\/\//i.test(assetPath)) return assetPath;

  const apiBaseUrl = resolveApiBaseUrl();
  const rootBaseUrl = apiBaseUrl.endsWith("/api") ? apiBaseUrl.slice(0, -4) : apiBaseUrl;
  const normalizedPath = assetPath.startsWith("/") ? assetPath : `/${assetPath}`;
  return `${rootBaseUrl}${normalizedPath}`;
};

export default API;
