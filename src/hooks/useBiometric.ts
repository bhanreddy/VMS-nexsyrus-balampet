import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import BiometricService from '../services/biometricService';
import { useAuth } from './useAuth';
import { supabase } from '../services/supabaseConfig';

/**
 * useBiometric — React hook for biometric toggle in Settings screens.
 *
 * Provides:
 * - isBiometricAvailable: device supports + has enrolled biometrics
 * - isBiometricEnabled: user has toggled biometric on
 * - isLoading: async init / toggle in progress
 * - toggleBiometric: handles enable/disable flow
 *
 * Only usable by eligible roles (admin, staff, teacher, accountant).
 */
export function useBiometric() {
  const { user } = useAuth();
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ─── Init: Check device capability + current toggle state ─────────
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // 1. Check device capability
        const available = await BiometricService.isBiometricAvailable();

        // 2. Check if already enabled
        const enabled = await BiometricService.isBiometricEnabled();

        if (mounted) {
          setIsBiometricAvailable(available);
          setIsBiometricEnabled(enabled && available); // Auto-disable if device lost biometrics
        }
      } catch (error) {

      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    init();
    return () => {mounted = false;};
  }, []);

  // ─── Toggle Handler ───────────────────────────────────────────────
  const toggleBiometric = useCallback(async () => {
    if (!user) return;

    // Role guard
    if (!BiometricService.isEligibleRole(user.role)) {
      Alert.alert('Not Available', 'Biometric login is only available for staff and admin accounts.');
      return;
    }

    // Device guard
    if (!isBiometricAvailable) {
      Alert.alert(
        'Biometric Not Available',
        'Your device does not have biometric authentication set up. Please enroll a fingerprint or face in your device settings.'
      );
      return;
    }

    setIsLoading(true);

    try {
      if (isBiometricEnabled) {
        // ── DISABLE ─────────────────────────────────────────
        await BiometricService.clearBiometricSession();
        setIsBiometricEnabled(false);
        if (__DEV__) {}
      } else {
        // ── ENABLE ──────────────────────────────────────────
        // 1. Verify identity first
        const { success } = await BiometricService.promptBiometric(
          'Verify your identity to enable biometric login'
        );

        if (!success) {
          if (__DEV__) {}
          Alert.alert('Verification Failed', 'Could not verify your identity. Please try again.');
          return;
        }

        // 2. Get current Supabase session to store the refresh token
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.refresh_token) {
          Alert.alert('Session Error', 'Could not retrieve your current session. Please log in again.');
          return;
        }

        // 3. Store session securely
        await BiometricService.storeBiometricSession(
          session.refresh_token,
          user.id
        );

        setIsBiometricEnabled(true);
        if (__DEV__) {}
      }
    } catch (error) {

      Alert.alert('Error', 'An error occurred while updating biometric settings.');
    } finally {
      setIsLoading(false);
    }
  }, [user, isBiometricAvailable, isBiometricEnabled]);

  return {
    isBiometricAvailable,
    isBiometricEnabled,
    isLoading,
    toggleBiometric
  };
}