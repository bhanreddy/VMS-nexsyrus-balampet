import { supabase } from './supabaseConfig';
import { User, Role } from '../types/models';
import { api, setTokens, clearTokens, registerLogoutCallback } from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Alert, Platform } from 'react-native';
import { EnrollmentService } from './enrollmentService';
import { notificationManager } from './notificationManager';
import BiometricService from './biometricService';
import { SessionManager } from './sessionManager';
import { SessionPolicy } from './sessionPolicyService';
import { clearBackupRefreshToken } from './secureTokenStore';
import { AccessControlService } from './accessControlService';

const mapBackendRole = (roles: string[], hasStudentProfile: boolean = false, hasStaffProfile: boolean = false): Role => {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('accounts') || roles.includes('accountant')) return 'accountant';

  // Strict Profile Check
  // Only return 'staff', 'teacher', or 'driver' if they actually have a staff profile
  if (hasStaffProfile) {
    if (roles.includes('driver')) return 'driver';
    if (roles.includes('teacher')) return 'teacher';
    if (roles.includes('staff')) return 'staff';
  }

  // Only return 'student' if they explicitly have a student profile
  if (hasStudentProfile) return 'student';

  // Fallback for users with no profile (will be caught by AuthGuard)

  Alert.alert("Access Denied", "You do not have a valid role assigned. Please contact support.");
  throw new Error('NO_ACCESS');
};

const USER_CACHE_KEY = 'user_profile_cache';

// Module-level trackers for deduplication and lockouts
let isLoggingOut = false;
let isUserInitiatedLogout = false;
let isFetchingProfile = false;
let lastValidatedUserId: string | null = null;

export const listenAuth = (callback: (user: User | null) => void) => {

  // ─── Wire up SessionManager fatal logout ─────────────────────────
  SessionManager.setLogoutCallback(async () => {
    if (__DEV__) { }
    // This is NOT user-initiated (it's a server revocation)
    await performLogout(false);
    callback(null);
  });

  // ─── Wire up SessionPolicy TTL logout ────────────────────────────
  SessionPolicy.setLogoutCallback(async (reason: string) => {
    if (__DEV__) { }
    Alert.alert('Session Expired', reason);
    await performLogout(false);
    callback(null);
  });

  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (__DEV__) { }

    // STRICT GUARD: If we are effectively logging out, IGNORE any "signed in" or "token refreshed" events
    // that might be firing from pending promises or background timers.
    if (isLoggingOut) {
      if (event === 'SIGNED_OUT') {

        // Allow the sign-out event to proceed as it helps cleanup
      } else {
        if (__DEV__) { }
        return;
      }
    }

    // Sync tokens to AsyncStorage whenever Supabase updates the session (Refreshes, Login, etc.)
    if (session?.access_token && session?.refresh_token) {
      await setTokens(session.access_token, session.refresh_token);

      // Keep biometric session fresh with latest refresh token
      const biometricEnabled = await BiometricService.isBiometricEnabled();
      if (biometricEnabled) {
        const existingSession = await BiometricService.getBiometricSession();
        if (existingSession) {
          await BiometricService.storeBiometricSession(
            session.refresh_token,
            existingSession.userId
          );
        }
      }

      // ─── CRITICAL: On TOKEN_REFRESHED, ONLY sync tokens. ─────────
      // Do NOT re-fetch profile or call callback(user).
      // The user was already validated during INITIAL_SESSION.
      // Re-triggering the callback causes cascading React re-renders
      // that corrupt React Navigation's internal state ('stale' crash).
      if (event === 'TOKEN_REFRESHED') {
        if (__DEV__) { }
        return;
      }

      // On INITIAL_SESSION (app launch), ensure we start standard tracking
      if (event === 'INITIAL_SESSION' && session.user) {
        if (__DEV__) { }
        // The actual setup happens in the block below, we just log it here
      }
    } else if (event === 'SIGNED_OUT') {

      // Prevent recursive loop by NOT calling AuthService.logout() here.
      // Just ensure local tokens are cleared so the UI reacts.
      await clearTokens();
      // Also need to clear user cache so next load doesn't show stale data
      await AsyncStorage.removeItem(USER_CACHE_KEY);
      // Stop session monitoring
      SessionManager.stopMonitoring();
      SessionPolicy.stopPeriodicCheck();
      callback(null);
      return;
    }

    if (session?.user) {
      let loadedFromCache = false;

      // 1. Try to load from cache immediately so App opens FAST
      try {
        const cachedUser = await AsyncStorage.getItem(USER_CACHE_KEY);
        if (cachedUser) {
          const parsedUser = JSON.parse(cachedUser);
          callback(parsedUser);
          loadedFromCache = true;

          // Start session monitoring immediately with cached data
          SessionManager.startMonitoring();

          // Start policy check for non-students
          if (parsedUser.role !== 'student') {
            SessionPolicy.startPeriodicCheck();
          }
        }
      } catch (e) {

        // Ignore cache error
      }
      // 2. Validate with Backend (Background)
      // DEDUPLICATION: 
      // - Skip if already fetching
      // - Skip on TOKEN_REFRESHED if we already validated this specific user
      if (isFetchingProfile) {
        if (__DEV__) { }
        return;
      }

      if (event === 'TOKEN_REFRESHED' && lastValidatedUserId === session.user.id) {
        if (__DEV__) { }
        return;
      }

      try {
        isFetchingProfile = true;
        // FORCE re-validation via backend /auth/me
        const backendUser = await api.get<any>('/auth/me');
        lastValidatedUserId = backendUser.id;

        const user: User = {
          id: backendUser.id,
          email: backendUser.email || session.user.email,
          first_name: backendUser.first_name,
          last_name: backendUser.last_name,
          display_name: backendUser.display_name,
          photo_url: backendUser.photo_url,
          role: mapBackendRole(
            backendUser.roles || [],
            backendUser.has_student_profile,
            backendUser.has_staff_profile
          ),
          roles: backendUser.roles || [],
          permissions: backendUser.permissions || [],
          admission_no: backendUser.admission_no,
          has_student_profile: backendUser.has_student_profile,
          has_staff_profile: backendUser.has_staff_profile,
          staff_id: backendUser.staff_id,
          staff_code: backendUser.staff_code,
          class_section_id: backendUser.class_section_id,
          classId: backendUser.class_section_id,
          notification_sound: backendUser.notification_sound || 'custom',
          gender: backendUser.gender
        };

        // AUTO-ENROLLMENT CHECK
        // Only attempt auto-enrollment if the user does NOT already have a class section assigned.
        if ((user.role === 'student' || user.roles.includes('student')) && !user.class_section_id) {
          EnrollmentService.ensureEnrollment(user.id).
            then((res) => {
              if (res?.status === 'created') { }
            }).
            catch(() => {

            });
        }

        // Update cache
        await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));

        // Start session monitoring if not already started
        SessionManager.startMonitoring();

        // Start policy check
        if (user.role !== 'student') {
          SessionPolicy.startPeriodicCheck();
        }

        // If this is the initial session load and we don't have a started_at timestamp, make sure to start one
        // This covers the case where students kill the app and re-launch
        const existingRole = await SessionPolicy.getStoredRole();
        if (!existingRole) {
          await SessionPolicy.startSession(user.role);
        }

        if (!isLoggingOut) {
          callback(user);
        }
      } catch (error: any) {
        if (error.message === 'NO_ACCESS') {

          await clearTokens();
          await supabase.auth.signOut();
          callback(null);
          return;
        }

        // ─── NETWORK RESILIENCE: Do NOT logout on network errors ─────

        const status = error?.status || error?.statusCode || error?.response?.status;

        // Only logout on confirmed 401 auth rejection (NOT network failure)
        if (status === 401) {
          // Check if this is a network error masquerading as a failure
          const isNetworkError = !SessionManager.isNetworkAvailable() ||
            error?.message?.includes('Network') ||
            error?.message?.includes('network') ||
            error?.message?.includes('timeout') ||
            error?.message?.includes('fetch');

          if (isNetworkError) {
            if (__DEV__) { }
            // Keep cached data, don't logout
            if (!loadedFromCache) {
              // If we have no cache AND no backend, we can't authenticate
              // but still don't logout if we have a valid Supabase session
              if (__DEV__) { }
            }
          } else {

            await clearTokens();
            await supabase.auth.signOut();
            callback(null);
          }
        } else if (!loadedFromCache) {
          // If we have no cache and backend failed, we can't authenticate the user reliably
          // We must unblock the loader by returning null (logged out state)
          callback(null);
        }
        // Otherwise, keep the user logged in (with cached data if available)
      } finally {
        isFetchingProfile = false;
      }
    } else {
      callback(null);
    }
  });
};

/**
 * Core logout logic shared between user-initiated and system-initiated logout.
 * @param userInitiated — true if user tapped "Logout", false if forced by system
 */
async function performLogout(userInitiated: boolean): Promise<void> {
  if (isLoggingOut) return;
  isLoggingOut = true;
  isUserInitiatedLogout = userInitiated;

  try {

    // Stop session monitoring FIRST
    SessionManager.stopMonitoring();
    SessionPolicy.stopPeriodicCheck();
    await SessionPolicy.clearSession();

    // Race network calls with a STRICT 800ms timeout
    await Promise.race([
      Promise.all([
        // Only unregister FCM token if user explicitly logged out
        userInitiated ?
          notificationManager.unregisterPushToken().catch(() => { }) :
          Promise.resolve(), // Skip FCM unregister on system logout
        api.post('/auth/logout', {}, { silent: true }).catch(() => { }),
        // Wait for Supabase SignOut too, but don't let it hang forever
        supabase.auth.signOut().catch(() => { })]
      ),
      new Promise((resolve) => setTimeout(resolve, 800))]
    );
  } catch (e) {

    // Suppress errors
  }
  // Always Clean Local State Aggressively
  await clearTokens();

  // Clear SecureStore backup
  await clearBackupRefreshToken();

  // Clear biometric session and saved credentials ONLY on user-initiated logout
  if (userInitiated) {
    await BiometricService.clearBiometricSession();
    await AsyncStorage.removeItem('student_saved_email');
    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync('student_saved_password');
    } else {
      await AsyncStorage.removeItem('student_saved_password');
    }
  }

  // Exhaustive Cleanup (EXCEPT internal Supabase keys - let Supabase handle those)
  // Clearing `@supabase.auth.token` manually can cause permanent unrecoverable state if this is a false-positive logout
  const keysToClear = [
    USER_CACHE_KEY,
    'user_role',
    'user_profile',
    'auth_state',
    'loglevel:webpack-dev-server'];

  try {
    await AsyncStorage.multiRemove(keysToClear);
    // Double check user cache
    await AsyncStorage.removeItem(USER_CACHE_KEY);
  } catch (e) {

    // Ignore storage errors
  } finally {// Small delay before allowing login again to ensure all listeners have settled
    setTimeout(() => {
      isLoggingOut = false;
      isUserInitiatedLogout = false;
    }, 1000);
  }
}

const AuthService = {
  login: async (email: string, password: string): Promise<{ user: User; }> => {
    try {
      // 1. Call Backend Login API
      const response = await api.post<any>('/auth/login', { email, password });

      // 2. Set Tokens
      if (response.token && response.refresh_token) {
        await setTokens(response.token, response.refresh_token);

        // 3. Sync with Supabase Client
        await supabase.auth.setSession({
          access_token: response.token,
          refresh_token: response.refresh_token
        });
      }

      const backendUser = response.user;

      // 4. Construct User Object with strict mapping
      const user: User = {
        id: backendUser.id,
        email: backendUser.email,
        first_name: backendUser.first_name,
        last_name: backendUser.last_name,
        display_name: backendUser.display_name,
        photo_url: backendUser.photo_url,
        role: mapBackendRole(
          backendUser.roles || [],
          backendUser.has_student_profile,
          backendUser.has_staff_profile
        ),
        roles: backendUser.roles || [],
        permissions: backendUser.permissions || [],
        admission_no: backendUser.admission_no,
        has_student_profile: backendUser.has_student_profile,
        has_staff_profile: backendUser.has_staff_profile,
        staff_id: backendUser.staff_id,
        staff_code: backendUser.staff_code,
        class_section_id: backendUser.class_section_id,
        classId: backendUser.class_section_id,
        gender: backendUser.gender
      };

      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));

      // Save credentials for pre-fill if user is a student
      if (user.role === 'student' || user.roles.includes('student')) {
        await AsyncStorage.setItem('student_saved_email', email);
        if (Platform.OS !== 'web') {
          await SecureStore.setItemAsync('student_saved_password', password);
        } else {
          await AsyncStorage.setItem('student_saved_password', password);
        }
      }

      // OUT_OF_HOURS_NO_ACCESS logic for accounts
      if (user.role === 'accountant' || user.roles.includes('accounts') || user.roles.includes('accountant')) {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 1=Mon, 5=Fri
        const currentHours = now.getHours();
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
        // School hours: 08:00 to 17:00
        const isOutsideSchoolHours = !isWeekday || currentHours < 8 || currentHours >= 17;

        if (isOutsideSchoolHours) {
          const hasTempAccess = await AccessControlService.checkTempAccess('accounts');
          if (!hasTempAccess) {
            await clearTokens();
            await supabase.auth.signOut();
            const error: any = new Error('Access denied. Accounts department access is restricted to school hours.');
            error.code = 'OUT_OF_HOURS_NO_ACCESS';
            error.userId = user.id;
            throw error;
          }
        }
      }

      // 5. Start session policy tracking (role-based TTL)
      await SessionPolicy.startSession(user.role);

      // 6. Start session monitoring (network-aware refresh)
      SessionManager.startMonitoring();

      // 7. Start periodic policy check for non-students
      if (user.role !== 'student') {
        SessionPolicy.startPeriodicCheck();
      }

      return { user };
    } catch (error) {

      throw error;
    }
  },

  /**
   * User-initiated logout. Clears FCM token and all session data.
   */
  logout: async () => {
    await performLogout(true);
  },

  /**
   * System-initiated logout. Forced logout, clears cache but KEEPS biometric enablement preference.
   */
  systemLogout: async () => {
    await performLogout(false);
  },

  getCurrentUser: async (): Promise<User | null> => {
    // Check session policy first
    const policyValid = await SessionPolicy.checkSessionExpiry();
    if (!policyValid) {
      if (__DEV__) { }
      await performLogout(false);
      return null;
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      try {
        // Always fetch fresh profile to ensure role integrity
        const backendUser = await api.get<any>('/auth/me');

        return {
          id: backendUser.id,
          email: backendUser.email || session.user.email,
          first_name: backendUser.first_name,
          last_name: backendUser.last_name,
          display_name: backendUser.display_name,
          photo_url: backendUser.photo_url,
          role: mapBackendRole(
            backendUser.roles || [],
            backendUser.has_student_profile,
            backendUser.has_staff_profile
          ),
          roles: backendUser.roles || [],
          permissions: backendUser.permissions || [],
          admission_no: backendUser.admission_no,
          has_student_profile: backendUser.has_student_profile,
          has_staff_profile: backendUser.has_staff_profile,
          staff_id: backendUser.staff_id,
          staff_code: backendUser.staff_code,
          class_section_id: backendUser.class_section_id,
          classId: backendUser.class_section_id,
          gender: backendUser.gender
        };

      } catch (err: any) {
        // ─── NETWORK RESILIENCE: Don't force logout on network errors ───
        const isNetworkError = !SessionManager.isNetworkAvailable() ||
          err?.message?.includes('Network') ||
          err?.message?.includes('network') ||
          err?.message?.includes('timeout');

        if (isNetworkError) {
          if (__DEV__) { }
          // Try to return cached user
          try {
            const cached = await AsyncStorage.getItem(USER_CACHE_KEY);
            if (cached) return JSON.parse(cached);
          } catch { }
          return null;
        }

        await clearTokens();
        await supabase.auth.signOut();
        return null;
      }
    }
    return null;
  },

  changePassword: async (current_password: string, new_password: string): Promise<void> => {
    try {
      await api.post('/auth/change-password', { current_password, new_password });
    } catch (error) {

      throw error;
    }
  }
};

export default AuthService;

// Register the logout callback to handle API 401s
registerLogoutCallback(AuthService.systemLogout);