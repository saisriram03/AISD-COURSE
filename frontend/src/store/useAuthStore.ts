import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient, registerAuthHandlers } from '@/services/apiClient';
import { IS_DEMO_MODE_ENABLED } from '@/features/auth/demoAccounts';
import type { LoginCredentials, LoginResponse, User, UserRole } from '@/types/auth';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
  isDemoSession: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<User>;
  register: (payload: {
    full_name: string;
    email: string;
    password: string;
    role: 'DEPT_ADMIN' | 'FACULTY' | 'STUDENT';
  }) => Promise<User>;
  logout: () => Promise<void>;
  enterDemoMode: (role: UserRole) => Promise<User>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      isAuthenticated: false,
      isDemoSession: false,
      isLoading: false,
      error: null,

      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
          const { user, access_token, refresh_token, expires_in } = response.data;
          set({
            user,
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: Date.now() + expires_in * 1000,
            isAuthenticated: true,
            isDemoSession: false,
            isLoading: false,
            error: null,
          });
          return user;
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : 'Unable to sign in. Verify your credentials and backend connection.';
          set({ isLoading: false, error: message });
          throw err;
        }
      },

      register: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.post<LoginResponse>('/auth/register', payload);
          const { user, access_token, refresh_token, expires_in } = response.data;
          set({
            user,
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: Date.now() + expires_in * 1000,
            isAuthenticated: true,
            isDemoSession: false,
            isLoading: false,
            error: null,
          });
          return user;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Unable to create account.';
          set({ isLoading: false, error: message });
          throw err;
        }
      },

      logout: async () => {
        const { refreshToken } = get();
        if (refreshToken) {
          try {
            await apiClient.post('/auth/logout', { refresh_token: refreshToken });
          } catch {
            // Always clear client session state even if server revocation fails
          }
        }
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          isAuthenticated: false,
          isDemoSession: false,
          error: null,
        });
      },

      enterDemoMode: async (role) => {
        if (!IS_DEMO_MODE_ENABLED) {
          throw new Error('Demo mode is disabled outside development environments.');
        }
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.post<LoginResponse>('/auth/demo-login', { role });
          const { user, access_token, refresh_token, expires_in } = response.data;
          set({
            user,
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: Date.now() + expires_in * 1000,
            isAuthenticated: true,
            isDemoSession: true,
            isLoading: false,
            error: null,
          });
          return user;
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : 'Could not reach backend demo auth endpoint.';
          set({ isLoading: false, error: message });
          throw err;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'smartsched-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
        isAuthenticated: state.isAuthenticated,
        isDemoSession: state.isDemoSession,
      }),
    },
  ),
);

registerAuthHandlers({
  getTokens: () => {
    const state = useAuthStore.getState();
    return {
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
      isDemoSession: state.isDemoSession,
    };
  },
  updateTokens: ({ accessToken, refreshToken, expiresIn }) => {
    useAuthStore.setState({
      accessToken,
      refreshToken,
      expiresAt: Date.now() + expiresIn * 1000,
    });
  },
  clearSession: () => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      isAuthenticated: false,
      isDemoSession: false,
    });
  },
});
