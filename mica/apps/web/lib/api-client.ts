import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { getAccessToken, setAccessToken } from "@/lib/auth/token-store";

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<{ accessToken: string }>(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .then((res) => res.data.accessToken)
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isAuthEndpoint = original?.url?.includes("/auth/login") || original?.url?.includes("/auth/refresh");

    if (error.response?.status === 401 && original && !original._retried && !isAuthEndpoint) {
      original._retried = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        setAccessToken(newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }
      setAccessToken(null);
    }

    return Promise.reject(error);
  },
);
