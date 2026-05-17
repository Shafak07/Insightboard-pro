import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

/**
 * Browser: `/api/backend` — Next.js route reads Supabase cookies and adds Bearer token.
 * Server components: call FastAPI directly.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "/api/backend";
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 120000,
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (config.data instanceof FormData && config.headers) {
      delete config.headers["Content-Type"];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

function formatApiError(
  error: AxiosError<{ message?: string; error?: string; detail?: string | unknown }>
): string {
  if (error.code === "ERR_NETWORK" || error.message === "Network Error") {
    return (
      "Cannot reach the API. Start the backend with: " +
      "cd backend && .\\venv\\Scripts\\uvicorn main:app --reload --port 8000"
    );
  }

  const detail = error.response?.data?.detail;
  const detailText = Array.isArray(detail)
    ? detail
        .map((d) =>
          typeof d === "object" && d && "msg" in d ? String(d.msg) : JSON.stringify(d)
        )
        .join("; ")
    : typeof detail === "string"
      ? detail
      : undefined;

  const status = error.response?.status;
  const statusHint =
    status === 500
      ? "Server error — check the FastAPI terminal logs."
      : status
        ? `Request failed (${status}).`
        : "";

  return (
    [statusHint, error.response?.data?.message, error.response?.data?.error, detailText, error.message]
      .filter(Boolean)
      .join(" ") || "An unexpected error occurred"
  );
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; error?: string; detail?: string }>) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      const next = encodeURIComponent(window.location.pathname);
      window.location.href = `/auth/login?next=${next}`;
    }
    return Promise.reject(new Error(formatApiError(error)));
  }
);

export async function fetchHealth() {
  const { data } = await apiClient.get("/api/v1/health");
  return data;
}

export async function fetchCurrentUser() {
  const { data } = await apiClient.get("/api/v1/auth/me");
  return data;
}
