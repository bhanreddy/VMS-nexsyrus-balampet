import { stopDriverLocationUpdates, reconcileDriverTracking } from '../services/driverLocationTask';
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { supabase } from '../services/supabaseConfig';
import { AuthService, isInternalSessionSwap } from '../services/authService';
import { AuthSession, ValidatedUser } from '../types/auth';
import { SCHOOL_ID } from '../constants/school';
import { suppressTransientApiAlerts } from '../services/apiClient';
import { isStudentRole } from '../utils/roleHelpers';
import { clearBackupRefreshToken } from '../services/secureTokenStore';
import { requireFingerprintForVaultAccount } from '../services/fingerprintGate';
import {
  clearFingerprintTickets,
} from '../services/biometricService';
import { SessionPolicy } from '../services/sessionPolicyService';
import { notificationManager } from '../services/notificationManager';
import { fetchFeatures, resetFeatures } from '../services/featuresStore';
import * as accountVault from '../services/accountVault';
import { invalidateApiQueryCache } from './useApiQuery';
import { persistentQueryCache } from '../services/persistentQueryCache';
import { StorageService } from '../services/storageService';
import type { PortalContextsPayload } from '../types/context';
import {
  fetchPortalContexts,
  switchPortalContext as switchPortalContextApi,
} from '../services/contextService';
import {
  clearActiveContextStore,
  getCachedPortalContexts,
} from '../services/activeContextStore';

/** Synchronous session read for role guards during account switch (RN has no flushSync). */
const authSessionSnapshotRef = { current: null as AuthSession | null };

export function getAuthSessionSnapshot(): AuthSession | null {
  return authSessionSnapshotRef.current;
}

interface AuthContextType {
  session: AuthSession | null;
  loading: boolean;
  user: ValidatedUser | null;
  role: string | null;
  isStudent: boolean;
  schoolId: number | null;

  signIn: typeof AuthService.signIn;
  signInWithQr: typeof AuthService.signInWithQr;
  signOut: () => Promise<void>;
  /**
   * End the live session but keep this account (and every sibling) in the
   * vault. Used by the fingerprint lock's "Use email and password" escape so a
   * cancelled scan can never cost the user their saved logins.
   */
  signOutKeepAccount: () => Promise<void>;
  refreshSession: () => Promise<void>;
  /** Update the active user's profile picture URL in-memory + persisted storage. */
  updateUserPhoto: (photoUrl: string | null) => Promise<void>;
  /** Phase 2 — seamlessly switch the live + active account (no password prompt). */
  switchAccount: (userId: string) => Promise<{ session?: AuthSession; error?: string }>;
  /** Phase 1/2 — add another account to the vault; active account stays unchanged. */
  addAccount: (email: string, password: string) => Promise<{ session?: AuthSession; error?: string }>;
  /** Additive QR login for the multi-account vault; does not replace the live session. */
  addAccountWithQr: (qrPayload: string) => Promise<{ session?: AuthSession; error?: string }>;
  /** Portal switcher — contexts available under this login. */
  portalContexts: PortalContextsPayload | null;
  refreshPortalContexts: () => Promise<PortalContextsPayload>;
  switchPortalContext: (contextId: string) => Promise<PortalContextsPayload>;
  authChecked: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  user: null,
  role: null,
  isStudent: false,
  schoolId: null,

  signIn: async () => ({ error: 'Not initialized' }),
  signInWithQr: async () => ({ error: 'Not initialized' }),
  signOut: async () => {},
  signOutKeepAccount: async () => {},
  refreshSession: async () => {},
  updateUserPhoto: async () => {},
  switchAccount: async () => ({ error: 'Not initialized' }),
  addAccount: async () => ({ error: 'Not initialized' }),
  addAccountWithQr: async () => ({ error: 'Not initialized' }),
  portalContexts: null,
  refreshPortalContexts: async () => ({ activeContextId: null, activeContext: null, groups: [], total: 0 }),
  switchPortalContext: async () => ({ activeContextId: null, activeContext: null, groups: [], total: 0 }),
  authChecked: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [portalContexts, setPortalContexts] = useState<PortalContextsPayload | null>(null);

  const backoffDelay = useRef(1000); // Start at 1s
  const refreshRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signingOut = useRef(false);
  const sessionRef = useRef<AuthSession | null>(null);
  sessionRef.current = session;
  authSessionSnapshotRef.current = session;

  const user = session?.validatedUser || null;
  const role = user?.role?.code || null;
  const isStudent = isStudentRole(role);
  const schoolId = user ? SCHOOL_ID : null;

  useEffect(() => {
    if (!authChecked) return;
    if (role !== 'driver') { void stopDriverLocationUpdates().catch(() => {}); return; }
    const reconcile = () => { void reconcileDriverTracking().catch(() => {}); };
    reconcile();
    const timer = setInterval(reconcile, 30000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') reconcile(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [authChecked, user?.userId, role]);

  // Load per-school feature flags once auth is ready (useFeatures also fetches on mount).
  useEffect(() => {
    if (!session?.supabaseSession?.access_token || !isStudent) return;
    fetchFeatures({ force: true }).catch(() => {});
  }, [session?.supabaseSession?.access_token, isStudent]);

  const signOut = async () => {
    signingOut.current = true;
    if (refreshRetryTimer.current) clearTimeout(refreshRetryTimer.current);
    await stopDriverLocationUpdates();
    console.log('[AUTH_OUT]', 'manual_logout', new Date().toISOString());
    // Deferred SDK events and recovery retries are suppressed until the user
    // explicitly signs in or selects a saved account again.
    setLoading(true);
    // Drop any unlock ticket so it cannot authorize a later switch.
    // The account's fingerprint opt-in record is deleted by the vault removal
    // below (accountVault.removeAccount owns that cleanup for every caller).
    clearFingerprintTickets();
    // Clear cached feature flags so the next account doesn't inherit them.
    resetFeatures().catch(() => {});
    // Capture the signing-out account's userId BEFORE the session is cleared —
    // this is the exact key the vault is stored under (buildVaultAccount uses
    // validatedUser.userId). sessionRef.current is always the latest session
    // (the 401 logout-callback closure may otherwise be stale).
    const signingOutUserId = sessionRef.current?.validatedUser?.userId ?? null;

    // Phase 3a stopgap (two independent, best-effort cleanups — each in its own
    // try/catch so a failure in one never skips the other, and neither blocks logout):
    //
    //  (1) Remove THIS account's push-token registration from the backend. The
    //      /notifications/unregister route derives user_id from the bearer and
    //      deletes WHERE user_id = <this user> AND fcm_token — siblings untouched.
    //      Must run BEFORE AuthService.signOut() clears the session, else there is
    //      no bearer and the DELETE is skipped.
    //
    //  (2) Remove THIS account from the local vault entirely. Without this, a later
    //      fan-out re-trigger (cold start / FCM rotation / addAccount) would rebuild
    //      the registration we just deleted in (1), because the signed-out account
    //      would still be sitting in the vault. removeAccount() is scoped to this one
    //      userId only — never the whole vault, never siblings.
    //
    // This is intentionally NARROWER than full Phase 3b (account-removal UX): it just
    // means "this device is no longer logged into this specific account at all". Wired
    // ONLY here — never in switchAccount/addAccount, which stay purely additive.
    try {
      await notificationManager.unregisterPushToken();
    } catch (e) {
      if (__DEV__) console.warn('[useAuth] push unregister on sign-out failed (non-fatal):', e);
    }
    if (signingOutUserId) {
      try {
        await accountVault.removeAccount(signingOutUserId);
      } catch (e) {
        if (__DEV__) console.warn('[useAuth] vault removeAccount on sign-out failed (non-fatal):', e);
      }
    }

    try {
      invalidateApiQueryCache();
    } catch (e) {
      if (__DEV__) console.warn('[useAuth] query cache purge on sign-out failed (non-fatal):', e);
    }
    try {
      await clearActiveContextStore();
      setPortalContexts(null);
    } catch (e) {
      if (__DEV__) console.warn('[useAuth] active context clear on sign-out failed (non-fatal):', e);
    }
    if (signingOutUserId) {
      try {
        await persistentQueryCache.removeMatching(signingOutUserId);
      } catch (e) {
        if (__DEV__) console.warn('[useAuth] disk query cache purge on sign-out failed (non-fatal):', e);
      }
      try {
        await StorageService.clear(signingOutUserId);
      } catch (e) {
        if (__DEV__) console.warn('[useAuth] StorageService.clear on sign-out failed (non-fatal):', e);
      }
    }

    await AuthService.signOut();
    // Clear student backup keys on explicit sign-out
    await clearBackupRefreshToken();
    setSession(null);

    setLoading(false);
  };

  // Sign out of the live session WITHOUT removing anything from the vault.
  // Deliberately narrower than signOut(): no push unregister and no vault
  // removal. Active-user caches are still purged so the signed-out login screen
  // cannot retain privileged data.
  const signOutKeepAccount = async () => {
    signingOut.current = true;
    if (refreshRetryTimer.current) clearTimeout(refreshRetryTimer.current);
    await stopDriverLocationUpdates();
    const signingOutUserId = sessionRef.current?.validatedUser?.userId ?? null;
    clearFingerprintTickets();
    resetFeatures().catch(() => {});
    invalidateApiQueryCache();
    if (signingOutUserId) {
      await persistentQueryCache.removeMatching(signingOutUserId).catch(() => undefined);
    }
    await clearActiveContextStore().catch(() => undefined);
    setPortalContexts(null);
    try {
      await AuthService.signOut();
    } catch (e) {
      if (__DEV__) console.warn('[useAuth] signOutKeepAccount failed (non-fatal):', e);
    }
    setSession(null);
  };

  // A refresh failure must never erase an otherwise valid locally persisted
  // identity. Retry forever with capped backoff; API requests still require a
  // fresh server-accepted token, so preserving UI does not bypass authorization.
  const handleRefreshFailure = (currentRole: string | null) => {
    if (signingOut.current || !sessionRef.current) return;
    const nextDelay = Math.min(backoffDelay.current * 2, 60000);
    backoffDelay.current = nextDelay;
    if (__DEV__) {
      console.warn(
        `[useAuth] Refresh pending for "${currentRole || 'unknown'}"; retrying in ${nextDelay}ms`
      );
    }
    if (refreshRetryTimer.current) {
      clearTimeout(refreshRetryTimer.current);
    }
    refreshRetryTimer.current = setTimeout(() => {
      refreshRetryTimer.current = null;
      void handleRefresh(currentRole);
    }, nextDelay);
  };

  // Core refresh logic invoked internally or explicitly.
  const handleRefresh = async (currentRole: string | null) => {
    if (signingOut.current) return;
    const userId = sessionRef.current?.validatedUser.userId;
    try {
      const newSession = await AuthService.refreshSession({ force: false });
      if (signingOut.current || sessionRef.current?.validatedUser.userId !== userId) return;
      if (newSession) {
        if (refreshRetryTimer.current) {
          clearTimeout(refreshRetryTimer.current);
          refreshRetryTimer.current = null;
        }
        setSession(newSession);
        backoffDelay.current = 1000; // Reset on success
      } else {
        // A null result can be a temporary recovery failure. Keep the current
        // identity and retry; confirmed account rejection clears it via SDK events.
        handleRefreshFailure(currentRole);
      }
    } catch {
      handleRefreshFailure(currentRole);
    }
  };

  useEffect(() => {
    let disposed = false;
    let bootRetryTimer: ReturnType<typeof setTimeout> | null = null;
    const authEventTimers = new Set<ReturnType<typeof setTimeout>>();
    // ── Layer A: lifecycle listeners for Supabase auto-refresh ──
    // Android process recreation and browser tab/page restoration can both
    // leave a durable UI identity without a usable live SDK session.
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        if (Platform.OS !== 'web') supabase.auth.startAutoRefresh();
        const roleCode = sessionRef.current?.validatedUser?.role?.code || null;
        if (sessionRef.current) void handleRefresh(roleCode);
      } else if (nextState === 'background' || nextState === 'inactive') {
        if (Platform.OS !== 'web') supabase.auth.stopAutoRefresh();
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    // Start auto-refresh immediately (app is active on mount)
    if (Platform.OS !== 'web' && AppState.currentState === 'active') supabase.auth.startAutoRefresh();

    // React Native Web maps most visibility changes to AppState, but it does
    // not cover every browser lifecycle. `pageshow` repairs pages restored from
    // the back/forward cache; `online` repairs a tab that resumed while offline.
    // refreshSession() now rehydrates the live client before rotating tokens.
    const handleBrowserResume = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const roleCode = sessionRef.current?.validatedUser?.role?.code || null;
      if (sessionRef.current) void handleRefresh(roleCode);
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('pageshow', handleBrowserResume);
      window.addEventListener('online', handleBrowserResume);
      document.addEventListener('visibilitychange', handleBrowserResume);
    }

    let authSubscription: { unsubscribe: () => void } | null = null;

    const initializeAuth = async () => {
      if (disposed) return;
      try {
        // Durable local state decides whether the app has a remembered login.
        // Network speed and access-token age do not participate in this boot gate.
        const storedSession = await AuthService.getSession();
        if (storedSession) {
          // Publish the remembered identity immediately, then block the startup
          // overlay until the live Supabase client has been rebuilt. This
          // prevents mounted screens from firing requests against a null SDK
          // session after Android recreation or a browser reload.
          sessionRef.current = storedSession;
          authSessionSnapshotRef.current = storedSession;
          setSession(storedSession);
          const restoredRole = storedSession.validatedUser?.role?.code;
          if (restoredRole && !(await SessionPolicy.getStoredRole())) {
            await SessionPolicy.startSession(restoredRole as any);
          }
          const liveSession = await AuthService.restorePersistedSession();
          if (liveSession) {
            sessionRef.current = liveSession;
            authSessionSnapshotRef.current = liveSession;
            setSession(liveSession);
            backoffDelay.current = 1000;
          } else {
            // Offline or a temporarily unavailable auth server: keep the local
            // identity and let the existing capped retry loop repair it later.
            void handleRefresh(restoredRole || null);
          }
        } else {
          setSession(null);
        }
      } catch (e) {
        console.error('[AUTH_BOOT_FAIL]', e);
        // A temporarily locked keychain is not an empty login. Keep the boot
        // gate until a read succeeds instead of redirecting to the login page.
        if (!disposed) bootRetryTimer = setTimeout(() => { void initializeAuth(); }, 2000);
        return;
      }
      if (disposed) return;
      setLoading(false);
      setAuthChecked(true);

      // 4. Subscribe to auth state changes from Supabase directly
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, refreshedSession) => {
        // Phase 2: suppress events fired as a side effect of OUR OWN internal
        // setSession()/signInWithPassword() during switchAccount / addAccount-
        // restore. Without this, an expired-token setSession emits TOKEN_REFRESHED
        // which would trigger handleRefresh mid-switch (a stray refresh + state
        // write that fights the switch). The guard is a module-level counter held
        // for the exact duration of the swap, so it is precise (no arbitrary
        // timer) and stays raised across rapid/nested swaps until the last ends.
        if (isInternalSessionSwap()) {
          if (__DEV__) console.log(`[useAuth] Suppressing ${event} during internal session swap`);
          return;
        }
        if (signingOut.current || (event !== 'SIGNED_OUT' && event !== 'TOKEN_REFRESHED')) return;
        // Supabase awaits subscribers while holding its auth lock. Defer all
        // storage/recovery work so it cannot block the token refresh itself.
        const timer = setTimeout(() => {
          authEventTimers.delete(timer);
          if (disposed || signingOut.current || isInternalSessionSwap()) return;
          void (async () => {
            if (event === 'SIGNED_OUT') {
              // Supabase also emits SIGNED_OUT while rejecting a refresh token.
              // Preserve a remembered app identity during silent credential
              // recovery. Explicit logout removes auth_session before emitting,
              // so it still reaches the null branch.
              const remembered = await AuthService.getStoredSession();
              if (disposed || signingOut.current) return;
              if (remembered) {
                setSession(remembered);
                void handleRefresh(
                  remembered.validatedUser?.role?.code || null
                );
              } else {
                setSession(null);
              }
            } else if (event === 'TOKEN_REFRESHED') {
              if (refreshedSession) {
                const adopted = await AuthService.adoptRefreshedSession(
                  refreshedSession
                );
                if (adopted && !disposed && !signingOut.current &&
                    adopted.validatedUser.userId === sessionRef.current?.validatedUser.userId) {
                  if (refreshRetryTimer.current) {
                    clearTimeout(refreshRetryTimer.current);
                    refreshRetryTimer.current = null;
                  }
                  backoffDelay.current = 1000;
                  setSession(adopted);
                }
              }
            }
          })().catch(() => {
            if (!disposed) handleRefreshFailure(sessionRef.current?.validatedUser.role?.code || null);
          });
        }, 0);
        authEventTimers.add(timer);
      });
      authSubscription = subscription;
    };

    initializeAuth();

    return () => {
      disposed = true;
      if (bootRetryTimer) clearTimeout(bootRetryTimer);
      authEventTimers.forEach(clearTimeout);
      appStateSubscription.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('pageshow', handleBrowserResume);
        window.removeEventListener('online', handleBrowserResume);
        document.removeEventListener('visibilitychange', handleBrowserResume);
      }
      authSubscription?.unsubscribe();
      if (refreshRetryTimer.current) {
        clearTimeout(refreshRetryTimer.current);
        refreshRetryTimer.current = null;
      }
      if (Platform.OS !== 'web') supabase.auth.stopAutoRefresh();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    signingOut.current = false;
    setLoading(true);
    try {
      const result = await AuthService.signIn(email, pass);
      if (result.session) {
        setSession(result.session);
        // Record the role so the role-based session policy + the student
        // 401-suppression guard in apiClient/sessionManager work. Without this
        // the policy layer stays empty and parents (student role) get evicted
        // on the first transient 401.
        const roleCode = result.session.validatedUser?.role?.code;
        if (roleCode) {
          await SessionPolicy.startSession(roleCode as any);
        }
      }
      return result;
    } finally {
      setLoading(false);
    }
  };

  const signInWithQr = async (qrPayload: string) => {
    signingOut.current = false;
    setLoading(true);
    try {
      const result = await AuthService.signInWithQr(qrPayload);
      if (result.session) {
        setSession(result.session);
        const roleCode = result.session.validatedUser?.role?.code;
        if (roleCode) await SessionPolicy.startSession(roleCode as any);
      }
      return result;
    } finally {
      setLoading(false);
    }
  };

  const refreshSession = async () => {
    await handleRefresh(role);
  };

  // Profile picture change (any portal). Patches the persisted auth_session +
  // vault via AuthService, then mirrors the result into in-memory state so every
  // avatar bound to user.photoUrl updates immediately — no re-login needed.
  const updateUserPhoto = async (photoUrl: string | null) => {
    const updated = await AuthService.updateActivePhotoUrl(photoUrl);
    if (updated) {
      setSession(updated);
    }
  };

  // Phase 2 — seamless account switch. The heavy lifting (setSession, silent
  // refresh-token recovery, vault pointer update, auth_session persistence,
  // serialization, and event suppression) lives in AuthService.switchAccount.
  // Here we only mirror the result into the provider's in-memory state. We do
  // NOT toggle global `loading` — that would gate the router/_layout and cause a
  // full-screen flash, defeating the "seamless" goal; the session swap itself is
  // what the UI re-renders against.
  const switchAccount = async (userId: string) => {
    // Fingerprint gate. Every route into another account — the login screen's
    // saved-account rows, the account switcher, quick switch, and
    // notification-triggered switching — lands here, so this one check covers
    // them all. It re-reads the target's role from the vault immediately
    // before the swap, and returns "allowed" without prompting for any account
    // that is not an eligible, opted-in staff/admin login.
    const gate = await requireFingerprintForVaultAccount(userId);
    if (!gate.allowed) {
      // Refusing a switch leaves the current session and every saved account
      // exactly as they were.
      return { error: gate.message || 'Fingerprint verification failed' };
    }

    // While the session flips to the new account, the outgoing portal's screens
    // are still mounted+focused and briefly refetch under the new identity,
    // producing expected cross-role 4xx (e.g. 404 "Staff profile not found").
    // Suppress the blocking error dialogs for those until navigation settles.
    suppressTransientApiAlerts();
    // Non-driver sessions were already cleaned up by the tracking effect.
    // Avoid scanning all local storage and querying native GPS on every switch.
    if (sessionRef.current?.validatedUser.role?.code === 'driver') {
      await stopDriverLocationUpdates();
    }
    const result = await AuthService.switchAccount(userId);
    if (result.session) {
      signingOut.current = false;
      try {
        await clearActiveContextStore();
        setPortalContexts(null);
      } catch {
        // non-fatal — vault switch uses its own JWT, not server context
      }
      // Re-arm the suppression window right before the session flips, so it fully
      // covers the post-flip cross-role refetch storm even if the swap above was
      // slow (the outgoing portal's screens refetch under the new identity here).
      suppressTransientApiAlerts();
      // Update snapshot before React state so layout role guards see the new
      // account before AccountSwitcherSheet navigates (flushSync unavailable on RN).
      authSessionSnapshotRef.current = result.session;
      sessionRef.current = result.session;
      setSession(result.session);
      const roleCode = result.session.validatedUser?.role?.code;
      if (roleCode) {
        // Diagnostic metadata must not delay navigation after auth is committed.
        void SessionPolicy.startSession(roleCode as any).catch(() => {});
      }
      try {
        invalidateApiQueryCache();
      } catch {
        // non-fatal
      }
    }
    // NOTE: cold start / login / switch already re-trigger push fan-out via
    // useNotifications' [user] dependency (session change → user change). No
    // explicit fan-out needed here.
    return result;
  };

  // Phase 3a — adding an account does NOT change the active `user`, so
  // useNotifications won't re-fire. Trigger the multi-account push fan-out
  // explicitly (fire-and-forget) so the newly-added child starts receiving
  // notifications immediately. AuthService.addAccount itself is unchanged.
  const addAccount = async (email: string, password: string) => {
    const result = await AuthService.addAccount(email, password);
    if (result.session) {
      void notificationManager.fanOutRegister();
    }
    return result;
  };

  const addAccountWithQr = async (qrPayload: string) => {
    const result = await AuthService.addAccountWithQr(qrPayload);
    if (result.session) {
      void notificationManager.fanOutRegister();
    }
    return result;
  };

  const refreshPortalContexts = async (): Promise<PortalContextsPayload> => {
    const payload = await fetchPortalContexts();
    setPortalContexts(payload);
    if (payload.activeContext && sessionRef.current) {
      const updated = await AuthService.applyPortalContext(payload.activeContext, payload);
      if (updated) setSession(updated);
    }
    return payload;
  };

  const switchPortalContext = async (contextId: string): Promise<PortalContextsPayload> => {
    suppressTransientApiAlerts();
    await stopDriverLocationUpdates();
    const payload = await switchPortalContextApi(contextId);
    setPortalContexts(payload);
    if (payload.activeContext) {
      const updated = await AuthService.applyPortalContext(payload.activeContext, payload);
      if (updated) {
        setSession(updated);
        const roleCode = updated.validatedUser?.role?.code;
        if (roleCode) {
          await SessionPolicy.startSession(roleCode as any);
        }
      }
    }
    try {
      invalidateApiQueryCache();
    } catch {
      // non-fatal
    }
    return payload;
  };

  useEffect(() => {
    if (!session) {
      setPortalContexts(null);
      return;
    }
    void (async () => {
      const cached = await getCachedPortalContexts();
      if (cached) setPortalContexts(cached);
      if (session.validatedUser?.portalContexts) {
        setPortalContexts(session.validatedUser.portalContexts);
      }
    })();
  }, [session?.validatedUser?.userId]);

  return (
    <AuthContext.Provider value={{
      session, loading, authChecked, user, role, isStudent, schoolId,
      signIn, signInWithQr, signOut, signOutKeepAccount, refreshSession, updateUserPhoto, switchAccount, addAccount, addAccountWithQr,
      portalContexts, refreshPortalContexts, switchPortalContext,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
