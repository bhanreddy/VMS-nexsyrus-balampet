import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import { supabase } from './supabaseConfig';
import NetInfo from '@react-native-community/netinfo';

const getApiBaseUrl = () => {
  const url = (process.env.EXPO_PUBLIC_API_URL || '').trim();
  if (!url) {
    throw new Error(
      '[FATAL] Missing required environment variable: EXPO_PUBLIC_API_URL\n' +
      'Set this to your Express backend API URL (e.g. https://your-server.onrender.com/api/v1).\n' +
      'This must point to the correct school\'s backend server.'
    );
  }
  if (Platform.OS === 'web' && url.includes('10.0.2.2')) {
    return url.replace('10.0.2.2', 'localhost');
  }
  return url;
};

const API_BASE_URL = getApiBaseUrl();

const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// ── SecureStore helpers with web fallback ──────────────────────────────
async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}
async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') { await AsyncStorage.setItem(key, value); return; }
  await SecureStore.setItemAsync(key, value);
}
async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') { await AsyncStorage.removeItem(key); return; }
  await SecureStore.deleteItemAsync(key);
}

// Token management — all stored in SecureStore (hardware-encrypted on device)
export async function getAccessToken(): Promise<string | null> {
  return await secureGet(TOKEN_KEY);
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await secureSet(TOKEN_KEY, accessToken);
  await secureSet(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await secureDelete(TOKEN_KEY);
  await secureDelete(REFRESH_TOKEN_KEY);
  // Also clear additional auth fields stored in SecureStore
  await secureDelete('user_id').catch(() => { });
  await secureDelete('user_role').catch(() => { });
  await secureDelete('session_expiry').catch(() => { });
}

// Global Logout Callback to avoid circular dependency
let logoutCallback: (() => Promise<void>) | null = null;

export const registerLogoutCallback = (fn: () => Promise<void>) => {
  logoutCallback = fn;
};

// Single-flight refresh promise to prevent parallel redundant refreshes
let refreshPromise: Promise<any> | null = null;

// API Error class
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errors?: Record<string, string[]>,
    public requestId?: string) {
    super(message);
    this.name = 'APIError';
  }

  // Compatibility getter
  get status() {
    return this.statusCode;
  }
}

// Generic API request function
export interface APIOptions extends RequestInit {
  silent?: boolean;
  _isRetry?: boolean;
  _retryCount?: number; // tracks 503 retry attempts
}

export async function apiRequest<T>(
  endpoint: string,
  options: APIOptions = {})
  : Promise<T> {
  const { silent, _isRetry, _retryCount = 0, ...fetchOptions } = options;
  const token = await getAccessToken();

  // Add a 60-second timeout to prevent fetch from hanging indefinitely on Android but allow Render backend to wake up
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>)
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      // @ts-ignore - React Native setup might not have full AbortSignal types
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const requestId = response.headers.get('x-request-id') || response.headers.get('request-id') || undefined;

    // Handle different status codes
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Handle unauthorized (401)
      if (response.status === 401) {

        // 1. IGNORE Login/Refresh endpoints (invalid credentials, not session expiry)
        if (endpoint.includes('/login') || endpoint.includes('/refresh')) {
          if (!silent) Alert.alert('Login Failed', errorData.error || 'Invalid credentials');
          throw new APIError(
            errorData.error || 'Invalid credentials',
            401,
            undefined,
            requestId
          );
        }

        // 2. TOKEN REFRESH LOGIC (Infinity Session)
        // If it's a 401 and NOT a retry, attempt to refresh the session
        if (!_isRetry) {
          if (__DEV__) { }

          try {
            // Try backend refresh FIRST (single source of truth for session validity)
            const storedRefreshToken = await secureGet(REFRESH_TOKEN_KEY);
            if (storedRefreshToken) {
              try {
                const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ refresh_token: storedRefreshToken }),
                });
                if (refreshResponse.ok) {
                  const refreshData = await refreshResponse.json();
                  await setTokens(refreshData.token, refreshData.refresh_token);
                  // Sync with Supabase client
                  await supabase.auth.setSession({
                    access_token: refreshData.token,
                    refresh_token: refreshData.refresh_token,
                  });
                  if (__DEV__) { }
                  // Retry the original request with new token
                  return await apiRequest<T>(endpoint, {
                    ...options,
                    _isRetry: true,
                    headers: {
                      ...options.headers,
                      'Authorization': `Bearer ${refreshData.token}`
                    }
                  });
                }
              } catch (backendRefreshErr) {
                if (__DEV__) { }
                // Fall through to Supabase client-side refresh
              }
            }

            // Fallback: Use Supabase client-side refresh (single-flight)
            if (!refreshPromise) {
              refreshPromise = supabase.auth.refreshSession().finally(() => {
                refreshPromise = null;
              });
            }

            const { data, error: refreshError } = await refreshPromise;

            if (!refreshError && data.session) {
              if (__DEV__) { }

              // Update local storage tokens
              await setTokens(data.session.access_token, data.session.refresh_token);

              // Retry the original request with new token
              return await apiRequest<T>(endpoint, {
                ...options,
                _isRetry: true,
                headers: {
                  ...options.headers,
                  'Authorization': `Bearer ${data.session.access_token}`
                }
              });
            } else {

              if (!data?.session) { }
            }
          } catch (refreshErr) {

          }
        }

        // 3. Network-aware logout decision
        // CRITICAL: Do NOT logout if the device is offline

        // Do a fresh active check just in case the cached state is wrong
        const netState = await NetInfo.fetch();
        const isOnline = netState.isConnected && netState.isInternetReachable !== false;

        if (!isOnline) {
          if (__DEV__) { }
          if (silent) return null as T;
          throw new APIError('Network unavailable. Logging suspended.', 0, undefined, requestId);
        }

        // Only trigger logout if we are genuinely online and the token is rejected
        if (logoutCallback) {
          if (!silent) { }
          // Small delay to ensure no inflight token writes are happening
          setTimeout(() => {
            logoutCallback?.();
          }, 1000);
        }

        if (silent) {
          return null as T;
        }

        throw new APIError('Session expired. Please login again.', 401, undefined, requestId);
      }

      // Handle Service Unavailable (503) — transient backend timeout
      if (response.status === 503) {
        if (_retryCount < 2) {
          if (__DEV__) { }
          await new Promise((r) => setTimeout(r, 1500));
          return await apiRequest<T>(endpoint, {
            ...options,
            _retryCount: _retryCount + 1
          });
        }
        const message = errorData.error || 'Server temporarily unavailable. Please try again.';
        if (!silent) Alert.alert('Service Unavailable', message);
        throw new APIError(message, 503, undefined, requestId);
      }

      // Handle validation errors (422)
      if (response.status === 422 || response.status === 400) {
        const message = errorData.message || errorData.error || 'Validation failed';
        if (!silent) {
          Alert.alert('Error', message);
        }
        throw new APIError(
          message,
          response.status,
          errorData.errors,
          requestId
        );
      }

      // Handle Rate Limit (429)
      if (response.status === 429) {
        const message = errorData.error || errorData.message || 'Rate limit exceeded. Please try again later.';
        if (!silent) Alert.alert('Too Many Requests', message);

        throw new APIError(message, 429, undefined, requestId);
      }

      // Handle forbidden (403)
      if (response.status === 403) {
        const message = errorData.error || errorData.message || 'Access denied';
        if (!silent) Alert.alert('Access Denied', message);
        throw new APIError(message, 403, undefined, requestId);
      }

      // Generic error
      const genericMsg = errorData.message || errorData.error || 'Request failed';

      if (!silent) Alert.alert('Error', `${genericMsg}\n\nCode: ${response.status}\nID: ${requestId || 'N/A'}`);
      throw new APIError(
        genericMsg,
        response.status,
        undefined,
        requestId
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null as T;
    }

    return await response.json();
  } catch (error: any) {
    if (error instanceof APIError) {
      throw error;
    }

    if (error?.name === 'AbortError') {
      if (!silent) Alert.alert('Network Timeout', 'The server took too long to respond. Please check your internet connection or try again later.');
      throw new APIError('Request timed out. Please try again.');
    }

    // Network error
    if (!silent) Alert.alert('Network Error', 'Please check your internet connection.');
    throw new APIError('Network error. Please check your connection.');
  }
}

// Helper methods for common HTTP verbs
export const api = {
  get: <T,>(endpoint: string, params?: Record<string, any>, options?: APIOptions): Promise<T> => {
    let queryString = '';
    if (params) {
      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined)
      );
      queryString = '?' + new URLSearchParams(cleanParams).toString();
    }
    return apiRequest<T>(`${endpoint}${queryString}`, { method: 'GET', ...options });
  },

  post: <T,>(endpoint: string, data?: any, options?: APIOptions): Promise<T> => {
    return apiRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options
    });
  },

  put: <T,>(endpoint: string, data?: any, options?: APIOptions): Promise<T> => {
    return apiRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      ...options
    });
  },

  patch: <T,>(endpoint: string, data?: any, options?: APIOptions): Promise<T> => {
    return apiRequest<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
      ...options
    });
  },

  delete: <T,>(endpoint: string, options?: APIOptions): Promise<T> => {
    return apiRequest<T>(endpoint, { method: 'DELETE', ...options });
  }
};