import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * SecureTokenStore — Hybrid storage adapter for Supabase Auth.
 *
 * Strategy:
 * - Full session JSON → AsyncStorage (large payload, no size limits)
 * - Refresh token backup → SecureStore (small, hardware-encrypted)
 *
 * This avoids the Android SecureStore chunking corruption bug (expo-secure-store
 * has a 2048-byte limit per item) while still securing the critical refresh token
 * in hardware-backed storage.
 *
 * Fallback: If AsyncStorage fails on read, attempts to recover using the
 * SecureStore-backed refresh token via Supabase's refreshSession().
 */

const SECURE_REFRESH_TOKEN_KEY = 'sb_secure_refresh_token';
const SECURE_SESSION_STARTED_KEY = 'sb_session_started_at';
const SESSION_HEARTBEAT_KEY = 'sb_last_session_write';

/**
 * Extract refresh_token from the Supabase session JSON string.
 * Supabase stores session as: { "access_token": "...", "refresh_token": "...", ... }
 */
function extractRefreshToken(sessionJson: string): string | null {
  try {
    const parsed = JSON.parse(sessionJson);
    return parsed?.refresh_token || null;
  } catch {
    return null;
  }
}

/**
 * Store the refresh token securely in SecureStore.
 * Safe to call repeatedly — small payload, no chunking risk.
 */
async function backupRefreshToken(refreshToken: string): Promise<void> {
  try {
    if (Platform.OS === 'web') return; // SecureStore not available on web
    await SecureStore.setItemAsync(SECURE_REFRESH_TOKEN_KEY, refreshToken);
  } catch (error) {
    // Non-fatal: SecureStore backup is a safety net, not primary storage
    if (__DEV__) {}
  }
}

/**
 * Retrieve the backup refresh token from SecureStore.
 */
async function getBackupRefreshToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return null;
    return await SecureStore.getItemAsync(SECURE_REFRESH_TOKEN_KEY);
  } catch (error) {
    if (__DEV__) {}
    return null;
  }
}

/**
 * Clear the backup refresh token from SecureStore.
 */
async function clearBackupRefreshToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') return;
    await SecureStore.deleteItemAsync(SECURE_REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(SECURE_SESSION_STARTED_KEY);
  } catch (error) {
    if (__DEV__) {}
  }
}

/**
 * The adapter object that Supabase uses for session persistence.
 * Implements the required { getItem, setItem, removeItem } interface.
 */
export const SecureTokenStore = {
  /**
   * Read session from AsyncStorage.
   * If AsyncStorage returns null but we have a backup refresh token,
   * return a minimal session JSON that Supabase can use to call refreshSession().
   */
  getItem: async (key: string): Promise<string | null> => {
    try {
      const value = await AsyncStorage.getItem(key);

      if (value) {
        // Diagnostic: check how old the last session write was
        try {
          const lastWrite = await AsyncStorage.getItem(SESSION_HEARTBEAT_KEY);
          if (lastWrite) {
            const ageMs = Date.now() - parseInt(lastWrite, 10);
            const ageHours = Math.round(ageMs / 3600000);
            if (ageHours > 24) {

            }
          }
        } catch {/* diagnostic only */}
        return value;
      }

      // AsyncStorage returned null — try SecureStore backup

      const backupToken = await getBackupRefreshToken();
      if (backupToken) {

        // Return a minimal session that Supabase will use to trigger a refresh
        const recoverySession = JSON.stringify({
          access_token: '',
          refresh_token: backupToken,
          expires_at: 0, // Force Supabase to refresh immediately
          expires_in: 0,
          token_type: 'bearer'
        });
        return recoverySession;
      }

      return null;
    } catch (error) {

      // Last resort: try SecureStore backup
      const backupToken = await getBackupRefreshToken();
      if (backupToken) {

        return JSON.stringify({
          access_token: '',
          refresh_token: backupToken,
          expires_at: 0,
          expires_in: 0,
          token_type: 'bearer'
        });
      }

      return null;
    }
  },

  /**
   * Write session to AsyncStorage + backup refresh token to SecureStore.
   */
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      // 1. Primary: Store full session in AsyncStorage
      await AsyncStorage.setItem(key, value);

      // 2. Write heartbeat timestamp for diagnostics
      await AsyncStorage.setItem(SESSION_HEARTBEAT_KEY, Date.now().toString());

      // 3. Backup: Extract and store refresh token in SecureStore
      const refreshToken = extractRefreshToken(value);
      if (refreshToken) {
        await backupRefreshToken(refreshToken);
      }

      if (__DEV__) {}
    } catch (error) {

      // Even if AsyncStorage fails, try to save the refresh token at minimum
      const refreshToken = extractRefreshToken(value);
      if (refreshToken) {
        await backupRefreshToken(refreshToken);
      }
    }
  },

  /**
   * Remove session from both AsyncStorage and SecureStore backup.
   */
  removeItem: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
      await clearBackupRefreshToken();
      if (__DEV__) {}
    } catch (error) {

      // Best effort: try to clear SecureStore even if AsyncStorage fails
      await clearBackupRefreshToken();
    }
  }
};

// ----- Utility exports for other services -----

/**
 * Store the session start timestamp (for role-based TTL checks).
 */
export async function setSessionStartTimestamp(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(SECURE_SESSION_STARTED_KEY, Date.now().toString());
      return;
    }
    await SecureStore.setItemAsync(SECURE_SESSION_STARTED_KEY, Date.now().toString());
  } catch (error) {
    if (__DEV__) {}
  }
}

/**
 * Get the session start timestamp.
 */
export async function getSessionStartTimestamp(): Promise<number | null> {
  try {
    let value: string | null;
    if (Platform.OS === 'web') {
      value = await AsyncStorage.getItem(SECURE_SESSION_STARTED_KEY);
    } else {
      value = await SecureStore.getItemAsync(SECURE_SESSION_STARTED_KEY);
    }
    return value ? parseInt(value, 10) : null;
  } catch {
    return null;
  }
}

/**
 * Get the backup refresh token (for external recovery flows like biometric).
 */
export { getBackupRefreshToken, clearBackupRefreshToken };