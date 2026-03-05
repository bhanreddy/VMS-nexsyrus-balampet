import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

// ─── SecureStore Keys ───────────────────────────────────────────────
const BIOMETRIC_REFRESH_TOKEN_KEY = 'biometric_refresh_token';
const BIOMETRIC_USER_ID_KEY = 'biometric_user_id';
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

// ─── Allowed Roles ──────────────────────────────────────────────────
const BIOMETRIC_ELIGIBLE_ROLES = ['admin', 'staff', 'teacher', 'accountant'];

/**
 * BiometricService — Pure utility functions for biometric authentication.
 *
 * Security design:
 * - Refresh tokens stored in hardware-backed SecureStore (Keychain / Android Keystore)
 * - Device-bound: tokens cannot be extracted or migrated
 * - Biometric prompt uses device-enrolled credentials only (no registration)
 * - User ID check prevents cross-account session reuse
 */
const BiometricService = {

  // ─── Device Capability ────────────────────────────────────────────

  /**
   * Check if device hardware supports biometric authentication.
   */
  isDeviceBiometricCapable: async (): Promise<boolean> => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      return compatible;
    } catch (error) {

      return false;
    }
  },

  /**
   * Check if user has enrolled biometrics on this device.
   * Returns false if no fingerprints / face is registered.
   */
  hasEnrolledBiometrics: async (): Promise<boolean> => {
    try {
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      return enrolled;
    } catch (error) {

      return false;
    }
  },

  /**
   * Full availability check: device capable AND biometrics enrolled.
   */
  isBiometricAvailable: async (): Promise<boolean> => {
    const capable = await BiometricService.isDeviceBiometricCapable();
    if (!capable) return false;
    const enrolled = await BiometricService.hasEnrolledBiometrics();
    return enrolled;
  },

  /**
   * Get supported biometric types (fingerprint, face, iris).
   */
  getSupportedTypes: async (): Promise<LocalAuthentication.AuthenticationType[]> => {
    try {
      return await LocalAuthentication.supportedAuthenticationTypesAsync();
    } catch {
      return [];
    }
  },

  // ─── Biometric Prompt ─────────────────────────────────────────────

  /**
   * Prompt the user for biometric authentication.
   * Returns { success, error? }.
   * Uses device-enrolled biometrics only (no new registration).
   *
   * @param promptMessage - Custom message shown in the biometric dialog
   */
  promptBiometric: async (
  promptMessage: string = 'Verify your identity to continue')
  : Promise<{success: boolean;error?: string;}> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Cancel',
        disableDeviceFallback: true, // Don't allow PIN/pattern fallback
        fallbackLabel: '' // Hide "Use Password" button
      });

      if (result.success) {
        return { success: true };
      }

      return {
        success: false,
        error: result.error || 'Authentication failed'
      };
    } catch (error: any) {

      return {
        success: false,
        error: error.message || 'Biometric prompt failed'
      };
    }
  },

  // ─── Role Guard ───────────────────────────────────────────────────

  /**
   * Check if a role is eligible for biometric authentication.
   */
  isEligibleRole: (role: string): boolean => {
    return BIOMETRIC_ELIGIBLE_ROLES.includes(role);
  },

  // ─── Secure Session Storage ───────────────────────────────────────

  /**
   * Store biometric session data in SecureStore.
   * Called after user enables biometric toggle and verifies identity.
   *
   * @param refreshToken - Supabase refresh token
   * @param userId - User's UUID for cross-account check
   */
  storeBiometricSession: async (refreshToken: string, userId: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY, refreshToken);
      await SecureStore.setItemAsync(BIOMETRIC_USER_ID_KEY, userId);
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
      if (__DEV__) {}
    } catch (error) {

      throw new Error('Failed to securely store biometric session');
    }
  },

  /**
   * Retrieve stored biometric session.
   * Returns null if no session or data is incomplete.
   */
  getBiometricSession: async (): Promise<{refreshToken: string;userId: string;} | null> => {
    try {
      const refreshToken = await SecureStore.getItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY);
      const userId = await SecureStore.getItemAsync(BIOMETRIC_USER_ID_KEY);

      if (!refreshToken || !userId) {
        return null;
      }

      return { refreshToken, userId };
    } catch (error) {

      return null;
    }
  },

  /**
   * Check if biometric login is enabled.
   */
  isBiometricEnabled: async (): Promise<boolean> => {
    try {
      const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch {
      return false;
    }
  },

  /**
   * Set biometric enabled flag.
   */
  setBiometricEnabled: async (enabled: boolean): Promise<void> => {
    try {
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
    } catch (error) {

    }
  },

  // ─── Cleanup ──────────────────────────────────────────────────────

  /**
   * Clear all biometric data from SecureStore.
   * Called on: logout, toggle disable, session invalidation.
   */
  clearBiometricSession: async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_USER_ID_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
      if (__DEV__) {}
    } catch (error) {

    }
  }
};

export default BiometricService;