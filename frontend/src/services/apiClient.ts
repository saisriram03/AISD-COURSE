import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorPayload, LoginResponse } from '@/types/auth';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

type TokenGetter = () => {
  accessToken: string | null;
  refreshToken: string | null;
  isDemoSession: boolean;
};

type TokenUpdater = (tokens: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}) => void;

type SessionClearer = () => void;

let getTokens: TokenGetter = () => ({
  accessToken: null,
  refreshToken: null,
  isDemoSession: false,
});
let updateTokens: TokenUpdater = () => {};
let clearSession: SessionClearer = () => {};

export function registerAuthHandlers(handlers: {
  getTokens: TokenGetter;
  updateTokens: TokenUpdater;
  clearSession: SessionClearer;
}): void {
  getTokens = handlers.getTokens;
  updateTokens = handlers.updateTokens;
  clearSession = handlers.clearSession;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function flushQueue(error: unknown, token: string | null): void {
  pendingQueue.forEach((item) => {
    if (error || !token) {
      item.reject(error);
    } else {
      item.resolve(token);
    }
  });
  pendingQueue = [];
}

apiClient.interceptors.request.use((config) => {
  const { accessToken } = getTokens();
  if (accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorPayload>) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const { refreshToken, isDemoSession } = getTokens();
    if (isDemoSession || !refreshToken) {
      clearSession();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((newToken) => {
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const response = await axios.post<LoginResponse>(`${API_BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });
      const { access_token, refresh_token, expires_in } = response.data;
      updateTokens({
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in,
      });
      flushQueue(null, access_token);
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
      }
      return apiClient(originalRequest);
    } catch (refreshError) {
      flushQueue(refreshError, null);
      clearSession();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
