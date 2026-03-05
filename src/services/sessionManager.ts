import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { supabase } from './supabaseConfig';
import { AppState, AppStateStatus } from 'react-native';

/**
 * SessionManager — Network-aware session refresh engine.
 *
 * Designed for rural networks with intermittent connectivity:
 * - Detects network state using NetInfo
 * - Retries failed refreshes with exponential backoff
 * - NEVER logs out on network failure
 * - Only logs out on confirmed auth rejection (invalid token, revoked session)
 * - Proactively refreshes tokens before expiry
 */

// ─── Configuration ───────────────────────────────────────────────────
const MAX_RETRY_ATTEMPTS = 10;
const INITIAL_BACKOFF_MS = 2000; // 2 seconds
const MAX_BACKOFF_MS = 30000; // 30 seconds cap
const PROACTIVE_REFRESH_MS = 5 * 60 * 1000; // 5 minutes before expiry

// ─── Error Classification ────────────────────────────────────────────
// These errors indicate the refresh token is permanently invalid
const FATAL_AUTH_ERRORS = [
'invalid_grant',
'Invalid Refresh Token',
'invalid refresh token',
'Refresh Token Not Found',
'refresh_token_not_found',
'User not found',
'user_not_found',
'session_not_found'];

// These errors indicate a network/server issue that should be retried
const TRANSIENT_ERROR_PATTERNS = [
'network',
'Network',
'NETWORK',
'fetch',
'timeout',
'Timeout',
'ECONNREFUSED',
'ENOTFOUND',
'socket',
'abort',
'Failed to fetch',
'Network request failed',
'ERR_NETWORK'];

/**
 * Classify an error as fatal (logout) or transient (retry).
 */
function isFatalAuthError(error: any): boolean {
  const message = error?.message || error?.error_description || error?.msg || '';
  const code = error?.code || error?.error || '';

  for (const fatal of FATAL_AUTH_ERRORS) {
    if (message.includes(fatal) || code.includes(fatal)) {
      return true;
    }
  }

  // HTTP 401 from Supabase Auth specifically (not from our backend)
  if (error?.status === 401 || error?.statusCode === 401) {
    return true;
  }

  return false;
}

function isTransientError(error: any): boolean {
  const message = error?.message || error?.error_description || '';

  for (const pattern of TRANSIENT_ERROR_PATTERNS) {
    if (message.includes(pattern)) {
      return true;
    }
  }

  return false;
}

// ─── Session Manager Singleton ───────────────────────────────────────

type LogoutCallback = (reason: string) => void;

class SessionManagerClass {
  private isMonitoring = false;
  private retryCount = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private netInfoUnsubscribe: (() => void) | null = null;
  private appStateSubscription: any = null;
  private logoutCallback: LogoutCallback | null = null;
  private isOnline = true;
  private lastRefreshAttempt = 0;
  private failedRefreshCount = 0;

  /**
   * Register a callback to be called when session is fatally invalid.
   * This should trigger a full logout.
   */
  setLogoutCallback(callback: LogoutCallback): void {
    this.logoutCallback = callback;
  }

  /**
   * Start monitoring network state and proactively refreshing tokens.
   * Call this after confirming the user has a valid session.
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    this.retryCount = 0;

    if (__DEV__) {}

    // 1. Monitor network state
    this.netInfoUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected === true && state.isInternetReachable !== false;

      if (__DEV__) {}

      // When coming back online, attempt a refresh immediately
      if (wasOffline && this.isOnline) {
        if (__DEV__) {}
        this.retryCount = 0; // Reset retry counter on network restore
        this.failedRefreshCount = 0; // Reset fatal error counter
        this.attemptRefresh();
      }
    });

    // 2. Monitor app state for foreground/background transitions
    this.appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        if (__DEV__) {}
        this.attemptRefresh();
      }
    });

    // 3. Schedule proactive refresh based on current session
    this.scheduleProactiveRefresh();
  }

  /**
   * Stop all monitoring. Call on logout.
   */
  stopMonitoring(): void {
    if (__DEV__) {}

    this.isMonitoring = false;
    this.retryCount = 0;
    this.failedRefreshCount = 0;

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.proactiveRefreshTimer) {
      clearTimeout(this.proactiveRefreshTimer);
      this.proactiveRefreshTimer = null;
    }

    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  /**
   * Attempt to refresh the session.
   * Classifies errors and either retries or triggers fatal logout.
   *
   * @returns true if refresh succeeded, false otherwise
   */
  async attemptRefresh(): Promise<boolean> {
    if (!this.isMonitoring) return false;

    // Debounce: don't refresh more than once per 5 seconds
    const now = Date.now();
    if (now - this.lastRefreshAttempt < 5000) {
      if (__DEV__) {}
      return false;
    }
    this.lastRefreshAttempt = now;

    // If offline, don't even try — just stay quiet
    if (!this.isOnline) {
      if (__DEV__) {}
      return false;
    }

    try {
      if (__DEV__) {}

      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        return this.handleRefreshError(error);
      }

      if (data?.session) {
        if (__DEV__) {}
        this.retryCount = 0; // Reset on success
        this.failedRefreshCount = 0;
        this.scheduleProactiveRefresh();
        return true;
      }

      // No error but no session — shouldn't happen, treat as transient
      if (__DEV__) {}
      this.scheduleRetry();
      return false;

    } catch (error: any) {
      return this.handleRefreshError(error);
    }
  }

  /**
   * Handle a refresh error: classify and either retry or logout.
   */
  private handleRefreshError(error: any): boolean {
    if (__DEV__) {}

    // FATAL: Token is permanently invalid → must logout
    if (isFatalAuthError(error)) {
      // Fault Tolerance: Allow 1 retry for "fatal" errors in case it was a network glitch misclassified by Supabase
      if (this.failedRefreshCount < 1) {
        this.failedRefreshCount++;

        this.scheduleRetry();
        return false;
      }

      if (this.logoutCallback) {
        this.logoutCallback(error?.message || 'Session expired');
      }
      this.stopMonitoring();
      return false;
    }

    // TRANSIENT: Network or server issue → retry with backoff
    if (isTransientError(error) || !this.isOnline) {
      this.failedRefreshCount = 0; // Reset fatal count on clear transient error
      if (__DEV__) {}
      this.scheduleRetry();
      return false;
    }

    // UNKNOWN: Default to retry (never logout on ambiguous errors)
    if (__DEV__) {}
    this.scheduleRetry();
    return false;
  }

  /**
   * Schedule a retry with exponential backoff.
   */
  private scheduleRetry(): void {
    if (!this.isMonitoring) return;

    if (this.retryCount >= MAX_RETRY_ATTEMPTS) {
      if (__DEV__) {}
      // Don't logout! Just wait for network to come back (netinfo listener will trigger refresh)
      this.retryCount = 0;
      return;
    }

    const backoff = Math.min(
      INITIAL_BACKOFF_MS * Math.pow(2, this.retryCount),
      MAX_BACKOFF_MS
    );
    this.retryCount++;

    if (__DEV__) {}

    if (this.retryTimer) clearTimeout(this.retryTimer);

    this.retryTimer = setTimeout(() => {
      this.attemptRefresh();
    }, backoff);
  }

  /**
   * Schedule a proactive refresh 5 minutes before the access token expires.
   */
  private async scheduleProactiveRefresh(): Promise<void> {
    if (!this.isMonitoring) return;

    if (this.proactiveRefreshTimer) {
      clearTimeout(this.proactiveRefreshTimer);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.expires_at) return;

      const expiresAtMs = session.expires_at * 1000;
      const refreshAt = expiresAtMs - PROACTIVE_REFRESH_MS;
      const delay = refreshAt - Date.now();

      if (delay > 0) {
        if (__DEV__) {}

        this.proactiveRefreshTimer = setTimeout(() => {
          if (__DEV__) {}
          this.attemptRefresh();
        }, delay);
      } else {
        // Token already about to expire or expired — refresh now
        if (__DEV__) {}
        this.attemptRefresh();
      }
    } catch (error) {
      if (__DEV__) {}
    }
  }

  /**
   * Check if the network is currently available.
   * Used by other services to decide whether to make network calls.
   */
  isNetworkAvailable(): boolean {
    return this.isOnline;
  }

  /**
   * Expose a way to force a refresh outside of the normal loop.
   * Used by useAuth.tsx for foreground recovery.
   */
  async forceRecoverSession(): Promise<boolean> {
    if (__DEV__) {}
    this.retryCount = 0;
    this.failedRefreshCount = 0;
    return this.attemptRefresh();
  }
}

export const SessionManager = new SessionManagerClass();