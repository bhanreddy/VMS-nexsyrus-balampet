import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { View, AppState, AppStateStatus } from 'react-native';
import AuthService, { listenAuth } from '../services/authService';
import BiometricService from '../services/biometricService';
import { supabase } from '../services/supabaseConfig';
import { SessionPolicy } from '../services/sessionPolicyService';
import { SessionManager } from '../services/sessionManager';
import { User } from '../types/models';
import LogoLoader from '../components/LogoLoader';

const MAX_BIOMETRIC_ATTEMPTS = 3;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAppLocked: boolean;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAppLocked: false,
  logout: async () => {},
  refreshSession: async () => {}
});

export function AuthProvider({ children }: {children: React.ReactNode;}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const biometricAttempted = useRef(false);

  // Track if we are currently prompting in foreground to avoid duplicates
  const isPromptingForeground = useRef(false);

  useEffect(() => {
    if (__DEV__) {

    }

    let authSubscription: any = null;

    // Sequence: 1. Session Policy Check → 2. Biometric Check → 3. Auth Listener
    const initializeAuth = async () => {

      // ─── Step 0: Check session policy BEFORE anything else ────────
      // If a non-student session has expired based on role TTL, force logout
      const policyValid = await SessionPolicy.checkSessionExpiry();
      if (!policyValid) {
        if (__DEV__) {}
        await supabase.auth.signOut();
        setUser(null);
        setLoading(false);
        return;
      }

      // ─── Step 1: Biometric Check ─────────────────────────────────
      // Block completely until biometric resolves (either success, failure, or not enabled)
      await attemptBiometricLogin();

      // ─── Step 2: Auth Listener ───────────────────────────────────
      // After biometric is verified or skipped, start listening to Supabase auth state
      const { data: { subscription } } = listenAuth((u) => {
        if (__DEV__) {}
        setUser(u);
        setLoading(false);
      });
      authSubscription = subscription;
    };

    initializeAuth();

    // SAFETY NET: Extended timeout to account for biometric prompt + cold start backend
    const safetyTimeout = setTimeout(() => {
      setLoading((currentLoading) => {
        if (currentLoading) {
          if (__DEV__) {}
          return false;
        }
        return currentLoading;
      });
    }, 30000); // 30s to accommodate biometric prompt + Render cold start

    return () => {
      if (authSubscription) authSubscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  // ─── Foreground Recovery: Re-validate session when app returns from background ───
  useEffect(() => {
    let lastActiveTime = Date.now();

    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        const idleMs = Date.now() - lastActiveTime;

        // Check Biometric Lock on App Open BEFORE background fetch
        // Read safely without causing an update trap
        let needsLogout = false;
        try {
          const enabled = await BiometricService.isBiometricEnabled();
          // We check if we have memory state (which implies logged in) or token
          const sessionExists = (await supabase.auth.getSession()).data.session !== null;

          if (enabled && sessionExists && !isPromptingForeground.current) {
            isPromptingForeground.current = true;
            setIsAppLocked(true); // Lock the UI visually

            const available = await BiometricService.isBiometricAvailable();
            if (available) {
              const result = await BiometricService.promptBiometric('Unlock with biometrics to continue');

              if (result.success) {
                if (__DEV__) {}
                setIsAppLocked(false);
              } else {
                if (__DEV__) {}
                needsLogout = true;
              }
            } else {
              if (__DEV__) {}
              needsLogout = true;
            }

            isPromptingForeground.current = false;
          }
        } catch (err) {

          isPromptingForeground.current = false;
        }

        if (needsLogout) {
          await AuthService.systemLogout();
          setIsAppLocked(false);
          return; // Stop processing background sync
        }

        // Only re-validate if idle for more than 60 seconds
        if (idleMs > 60000) {
          if (__DEV__) {}

          try {
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
              // Session still alive — check if access_token is expired and needs refresh
              const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
              if (expiresAt && Date.now() > expiresAt) {
                if (__DEV__) {}
                const { error } = await supabase.auth.refreshSession();
                if (error) {

                }
              } else {
                if (__DEV__) {}
              }
            } else if (user) {
              // We think we're logged in (user state exists) but getSession returned null
              // This means AsyncStorage session was lost — try SecureStore backup recovery
              if (__DEV__) {}
              // SessionManager's attemptRefresh will handle backup recovery via SecureTokenStore
              SessionManager.attemptRefresh();
            }
          } catch (err) {
            if (__DEV__) {}
            // Non-fatal — don't logout
          }
        }

        lastActiveTime = Date.now();
      } else if (nextState === 'background' || nextState === 'inactive') {
        lastActiveTime = Date.now();
      }
    });

    return () => subscription.remove();
  }, [user]);

  /**
   * Attempt biometric login on app launch.
   *
   * Flow:
   * 1. Check if biometric is enabled in SecureStore
   * 2. Retrieve stored refresh_token + user_id
   * 3. Verify device still has enrolled biometrics
   * 4. Prompt biometric (max 3 attempts)
   * 5. On success: restore Supabase session → triggers onAuthStateChange → normal flow
   * 6. On failure: clear biometric data, fall back to manual login
   */
  const attemptBiometricLogin = async () => {
    // Prevent re-prompt during same session
    if (biometricAttempted.current) return;
    biometricAttempted.current = true;

    try {
      // 1. Is biometric enabled?
      const enabled = await BiometricService.isBiometricEnabled();
      if (!enabled) {
        if (__DEV__) {}
        return;
      }

      // 2. Get stored session
      const session = await BiometricService.getBiometricSession();
      if (!session) {
        if (__DEV__) {}
        await BiometricService.clearBiometricSession();
        return;
      }

      // 3. Check device biometrics still available
      const available = await BiometricService.isBiometricAvailable();
      if (!available) {
        if (__DEV__) {}
        await BiometricService.clearBiometricSession();
        return;
      }

      // 4. Prompt biometric (up to 3 attempts)
      let authenticated = false;
      for (let attempt = 1; attempt <= MAX_BIOMETRIC_ATTEMPTS; attempt++) {
        if (__DEV__) {}

        const result = await BiometricService.promptBiometric(
          'Unlock with biometrics to continue'
        );

        if (result.success) {
          authenticated = true;
          break;
        }

        // If user cancelled (not a failed scan), don't retry
        if (result.error === 'user_cancel' || result.error === 'system_cancel' || result.error === 'app_cancel') {
          if (__DEV__) {}
          break;
        }

        if (__DEV__) {}
      }

      if (!authenticated) {
        if (__DEV__) {}
        // 1. Force logout so background session is destroyed and UI reverts to Login.
        // 2. Use systemLogout so it DOES NOT wipe the user's BIOMETRIC_ENABLED preference.
        await AuthService.systemLogout();
        return;
      }

      // 5. Restore Supabase session using stored refresh token (ONLY IF NEEDED)
      if (__DEV__) {}

      const { data: { session: currentSession } } = await supabase.auth.getSession();

      // If standard storage already recovered the session perfectly, we don't need to manually inject the token!
      if (currentSession) {
        if (__DEV__) {}
        // Also ensure the refresh token stays synced
        await BiometricService.storeBiometricSession(currentSession.refresh_token, user?.id || session.userId);
        return;
      }

      // If storage missed it, fallback to the securely stored biometric token
      if (__DEV__) {}
      const { error } = await supabase.auth.refreshSession({ refresh_token: session.refreshToken });

      if (error) {

        // Token expired or invalidated — clear biometric data
        await BiometricService.clearBiometricSession();
        return;
      }

      // Session restored → onAuthStateChange will fire → normal flow continues
      if (__DEV__) {}

    } catch (error) {

    }
  };

  const logout = async () => {
    // 1. Stop session monitoring
    SessionManager.stopMonitoring();
    SessionPolicy.stopPeriodicCheck();

    // 2. Immediate State Update (UI Feedback)
    setUser(null);
    setLoading(false);

    // 3. Background Cleanup (includes biometric session clearing, FCM unregister)
    AuthService.logout().catch(() => {

    });
  };

  const refreshSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // Re-fetch user from backend to pick up changes like notification_sound
      const backendUser = (await AuthService.getCurrentUser()) as User;
      setUser(backendUser);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
                <LogoLoader size={60} color="#4F46E5" />
            </View>);

  }

  return (
    <AuthContext.Provider value={{ user, loading, isAppLocked, logout, refreshSession }}>
            {children}
        </AuthContext.Provider>);

}

export function useAuth() {
  return useContext(AuthContext);
}