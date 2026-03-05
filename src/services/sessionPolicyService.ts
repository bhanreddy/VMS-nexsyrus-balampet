import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Role } from '../types/models';

/**
 * SessionPolicyService — Role-based session lifetime enforcement.
 *
 * Session TTL by role:
 *   student     → 365 days (managed by Supabase refresh token lifetime)
 *   staff       → 90 days  (client-side enforcement)
 *   teacher     → 90 days  (client-side enforcement)
 *   accountant  → 1 day  (client-side enforcement)
 *   driver      → 90 days  (client-side enforcement)
 *   admin       → 30 days  (client-side enforcement)
 *
 * Students are NEVER force-logged-out by TTL.
 * They can only be logged out by:
 *   - Manual logout
 *   - Password change (Supabase revokes refresh token)
 *   - Admin disables account
 *   - Refresh token revocation
 */

// ─── Configuration ───────────────────────────────────────────────────

const SESSION_MAX_AGE: Record<string, number> = {
  student: 365 * 24 * 60 * 60 * 1000, // 365 days in ms
  staff: 90 * 24 * 60 * 60 * 1000, // 90 days
  teacher: 90 * 24 * 60 * 60 * 1000, // 90 days
  accountant: 1 * 24 * 60 * 60 * 1000, // 1 day
  driver: 90 * 24 * 60 * 60 * 1000, // 90 days
  admin: 30 * 24 * 60 * 60 * 1000 // 30 days
};

const SESSION_ROLE_KEY = 'session_policy_role';
const SESSION_STARTED_KEY = 'session_policy_started_at';

// Periodic check interval (1 hour)
const POLICY_CHECK_INTERVAL_MS = 60 * 60 * 1000;

// ─── Storage Helpers ─────────────────────────────────────────────────

async function storeValue(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (error) {
    if (__DEV__) {}
  }
}

async function getValue(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function removeValue(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch {

    // Silent fail
  }}

// ─── Session Policy Manager ──────────────────────────────────────────

type PolicyLogoutCallback = (reason: string) => void;

class SessionPolicyServiceClass {
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private logoutCallback: PolicyLogoutCallback | null = null;

  /**
   * Register a callback for when session policy forces a logout.
   */
  setLogoutCallback(callback: PolicyLogoutCallback): void {
    this.logoutCallback = callback;
  }

  /**
   * Record the start of a new session.
   * Call this immediately after successful login.
   */
  async startSession(role: Role): Promise<void> {
    const now = Date.now().toString();

    await storeValue(SESSION_ROLE_KEY, role);
    await storeValue(SESSION_STARTED_KEY, now);

    if (__DEV__) {
      const maxAge = SESSION_MAX_AGE[role] || SESSION_MAX_AGE.staff;

    }
  }

  /**
   * Check if the current session has exceeded the role-based TTL.
   * Returns true if session is still valid, false if expired.
   *
   * Students always return true (no TTL enforcement).
   */
  async checkSessionExpiry(): Promise<boolean> {
    const role = await getValue(SESSION_ROLE_KEY);
    const startedAt = await getValue(SESSION_STARTED_KEY);

    // No policy data stored → session is valid (first-time or migrating user)
    // Let the authService correct this on next boot by calling startSession
    if (!role || !startedAt) {
      if (__DEV__) {}
      return true;
    }

    // Students: NEVER force logout by TTL. They live or die by the Supabase refresh token.
    if (role === 'student' || role === 'parent') {
      if (__DEV__) {}
      return true;
    }

    const maxAge = SESSION_MAX_AGE[role] || SESSION_MAX_AGE.staff;
    const elapsed = Date.now() - parseInt(startedAt, 10);

    if (elapsed >= maxAge) {

      return false;
    }

    if (__DEV__) {

    }

    return true;
  }

  /**
   * Start periodic session expiry checks.
   * Only relevant for non-student roles.
   * Checks every hour while the app is active.
   */
  startPeriodicCheck(): void {
    // Already running — skip restart to avoid log noise
    if (this.checkTimer) return;

    this.checkTimer = setInterval(async () => {
      const isValid = await this.checkSessionExpiry();

      if (!isValid) {
        if (__DEV__) {}
        if (this.logoutCallback) {
          this.logoutCallback('Session has expired based on your role policy. Please log in again.');
        }
        this.stopPeriodicCheck();
      }
    }, POLICY_CHECK_INTERVAL_MS);

    if (__DEV__) {}
  }

  /**
   * Stop periodic checks. Call on logout.
   */
  stopPeriodicCheck(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * Clear all session policy data. Call on logout.
   */
  async clearSession(): Promise<void> {
    this.stopPeriodicCheck();
    await removeValue(SESSION_ROLE_KEY);
    await removeValue(SESSION_STARTED_KEY);
    if (__DEV__) {}
  }

  /**
   * Get the stored session role (for checking if policy data exists).
   */
  async getStoredRole(): Promise<string | null> {
    return await getValue(SESSION_ROLE_KEY);
  }

  /**
   * Get remaining session time in milliseconds.
   * Returns Infinity for students.
   */
  async getRemainingTime(): Promise<number> {
    const role = await getValue(SESSION_ROLE_KEY);
    const startedAt = await getValue(SESSION_STARTED_KEY);

    if (!role || !startedAt) return Infinity;
    if (role === 'student') return Infinity;

    const maxAge = SESSION_MAX_AGE[role] || SESSION_MAX_AGE.staff;
    const elapsed = Date.now() - parseInt(startedAt, 10);
    return Math.max(0, maxAge - elapsed);
  }
}

export const SessionPolicy = new SessionPolicyServiceClass();