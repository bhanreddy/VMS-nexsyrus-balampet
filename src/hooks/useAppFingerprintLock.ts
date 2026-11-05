import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { SCHOOL_ID } from '../constants/school';
import {
  getFingerprintOptInState,
  isFingerprintPlatformSupported,
  verifyFingerprintForAccount,
} from '../services/biometricService';
import {
  describeFingerprintFailure,
  getFingerprintPromptCopy,
} from '../services/fingerprintGate';
import { isFingerprintEligibleRole } from '../utils/roleHelpers';
import { useAuth } from './useAuth';
import { withStartupDeadline } from '../utils/withStartupDeadline';

/**
 * useAppFingerprintLock — cold-start and resume protection for an opted-in
 * staff/admin account.
 *
 * Lifecycle:
 *   - Cold start begins in `resolving`, which the overlay renders as an
 *     opaque cover, so nothing protected is on screen while we work out
 *     whether this account is locked.
 *   - Returning from a true `background` state always re-locks and re-prompts
 *     (BACKGROUND_LOCK_MS = 0). Brief `inactive` only (notification shade,
 *     permission dialog) still gets a privacy cover but does not re-prompt.
 *   - A refused or cancelled scan leaves the app locked with "Try again" and
 *     "Use email and password". It never signs the user out on its own and
 *     never touches sibling saved accounts.
 *
 * It adds its own AppState subscription rather than editing the one in
 * useAuth, which exists to re-arm Supabase's token auto-refresh and is left
 * exactly as it was.
 */

/** Minimum time in `background` before resume re-locks. 0 = every resume. */
export const BACKGROUND_LOCK_MS = 0;

export type FingerprintLockStatus = 'resolving' | 'unlocked' | 'locked';

export interface AppFingerprintLock {
  status: FingerprintLockStatus;
  /** A native prompt is on screen. */
  prompting: boolean;
  /** Localized explanation after a refused scan. */
  failureMessage: string | null;
  /** Opaque cover used immediately while the app is not active. */
  privacyCovered: boolean;
  retry: () => Promise<void>;
  /** Not named `use*`: it is a plain action, not a React hook. */
  fallbackToPassword: () => Promise<void>;
}

export function useAppFingerprintLock(): AppFingerprintLock {
  const { user, authChecked, signOutKeepAccount } = useAuth();

  const [status, setStatus] = useState<FingerprintLockStatus>(() =>
    isFingerprintPlatformSupported() ? 'resolving' : 'unlocked'
  );
  const [prompting, setPrompting] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [privacyCovered, setPrivacyCovered] = useState(false);

  const mountedRef = useRef(true);
  /** Serializes lock evaluation so two triggers cannot both open a dialog. */
  const busyRef = useRef(false);
  /** True while the system biometric sheet is up — its AppState blips must not re-lock. */
  const promptingRef = useRef(false);
  /** userId currently behind the lock, so a scan can only unlock that account. */
  const lockedUserIdRef = useRef<string | null>(null);
  const lastEvaluatedTargetRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** The lock applies only to a live, authenticated session. Saved accounts on
   *  the signed-out login screen are protected by the switch gate instead. */
  const resolveTargetAccount = useCallback(async (): Promise<{
    userId: string;
    roleCode: string | null | undefined;
  } | null> => {
    if (user?.userId) return { userId: user.userId, roleCode: user.role?.code };
    return null;
  }, [user?.role?.code, user?.userId]);

  /** Prompt for the account already behind the lock. */
  const runPrompt = useCallback(
    async (target: { userId: string; roleCode: string | null | undefined }) => {
      promptingRef.current = true;
      setPrompting(true);
      try {
        const result = await verifyFingerprintForAccount(
          { schoolId: SCHOOL_ID, userId: target.userId, roleCode: target.roleCode },
          getFingerprintPromptCopy()
        );
        if (!mountedRef.current) return;

        if (result.success) {
          lockedUserIdRef.current = null;
          setPrivacyCovered(false);
          setFailureMessage(null);
          setStatus('unlocked');
          return;
        }

        // The record vanished or the account stopped being eligible while we
        // were prompting — there is nothing left to protect, so let the normal
        // session continue rather than stranding the user behind a dead lock.
        if (result.reason === 'not_enabled' || result.reason === 'ineligible_role') {
          lockedUserIdRef.current = null;
          setPrivacyCovered(false);
          setStatus('unlocked');
          return;
        }

        setPrivacyCovered(false);
        setFailureMessage(describeFingerprintFailure(result.reason));
      } finally {
        promptingRef.current = false;
        if (mountedRef.current) setPrompting(false);
      }
    },
    []
  );

  /** Decide whether the app should be locked, and prompt once if it should. */
  const evaluate = useCallback(async (force = false) => {
    if (!isFingerprintPlatformSupported()) {
      setStatus('unlocked');
      return;
    }
    if (!authChecked) {
      setStatus('resolving');
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const target = await resolveTargetAccount();
      if (!target) {
        // Keep the cold-start cover until auth restoration has conclusively
        // finished instead of treating a temporary null as "unprotected".
        if (mountedRef.current && authChecked) {
          lastEvaluatedTargetRef.current = null;
          setPrivacyCovered(false);
          setStatus('unlocked');
        }
        return;
      }
      const targetKey = `${target.userId}:${target.roleCode ?? ''}`;
      if (!force && lastEvaluatedTargetRef.current === targetKey) return;

      // 'unknown' (SecureStore unreadable for an eligible account) locks too:
      // we cannot prove this account is unprotected, so we fail closed and let
      // the user fall back to email and password.
      const state = await withStartupDeadline(getFingerprintOptInState({
        schoolId: SCHOOL_ID,
        userId: target.userId,
        roleCode: target.roleCode,
      }).catch(() => 'unknown' as const), 5000, 'unknown');
      if (state === 'off') {
        lastEvaluatedTargetRef.current = targetKey;
        lockedUserIdRef.current = null;
        if (mountedRef.current) {
          setPrivacyCovered(false);
          setStatus('unlocked');
        }
        return;
      }

      if (!mountedRef.current) return;
      lastEvaluatedTargetRef.current = targetKey;
      lockedUserIdRef.current = target.userId;
      setFailureMessage(null);
      setStatus('locked');
      if (state === 'unknown') {
        // A stalled/unreadable keychain must offer password recovery rather
        // than leave an empty resolving cover or bypass fingerprint protection.
        setPrivacyCovered(false);
        setFailureMessage(describeFingerprintFailure('storage_error'));
        return;
      }
      await runPrompt(target);
    } finally {
      busyRef.current = false;
    }
  }, [authChecked, resolveTargetAccount, runPrompt]);

  // Kept in a ref so the AppState subscription below can be registered once
  // and still call the latest closure. Re-subscribing on every session change
  // would reset the "when did we go to the background" timestamp and could
  // silently skip a re-lock.
  const evaluateRef = useRef(evaluate);
  evaluateRef.current = evaluate;

  // Cold start and the later auth-restoration transition. Re-evaluating when
  // authChecked/user changes closes the race where the first render had no
  // live user yet.
  useEffect(() => {
    void evaluateRef.current();
  }, [authChecked, user?.role?.code, user?.userId]);

  // Signing out clears the lock so the login screen is reachable.
  useEffect(() => {
    if (!user && lockedUserIdRef.current) {
      lockedUserIdRef.current = null;
      lastEvaluatedTargetRef.current = null;
      setPrivacyCovered(false);
      setFailureMessage(null);
      setStatus('unlocked');
    }
  }, [user]);

  // Resume protection.
  useEffect(() => {
    if (!isFingerprintPlatformSupported()) return;

    let lastState: AppStateStatus = AppState.currentState;
    let backgroundedAt: number | null = null;

    const onChange = (nextState: AppStateStatus) => {
      // Android and iOS both emit repeats of the same state; only transitions
      // matter here, so an echoed 'active' can never open a second prompt.
      if (nextState === lastState) return;
      lastState = nextState;

      // Paint the cover on inactive/background before the OS captures the
      // app-switcher snapshot. Covering every eligible live role is
      // intentionally conservative and avoids an async SecureStore read here.
      const shouldCover =
        !!lockedUserIdRef.current ||
        isFingerprintEligibleRole(user?.role?.code);

      if (nextState === 'inactive') {
        if (shouldCover) setPrivacyCovered(true);
        return;
      }

      if (nextState === 'background') {
        // System biometric UI can briefly background the app; ignore that so a
        // successful unlock does not immediately re-lock.
        if (promptingRef.current) return;
        // Only a true background counts toward re-lock. iOS inactive-only
        // (notification shade / permission sheet) must not re-prompt.
        if (backgroundedAt === null) backgroundedAt = Date.now();
        if (shouldCover) setPrivacyCovered(true);
        return;
      }

      if (nextState !== 'active') return;
      const wasBackgrounded = backgroundedAt !== null;
      const awayFor = wasBackgrounded ? Date.now() - (backgroundedAt as number) : 0;
      backgroundedAt = null;
      if (promptingRef.current) {
        setPrivacyCovered(false);
        return;
      }
      // inactive → active without ever hitting background: drop the cover only.
      if (!wasBackgrounded || awayFor < BACKGROUND_LOCK_MS) {
        setPrivacyCovered(false);
        return;
      }
      setStatus((current) => (current === 'locked' ? current : 'resolving'));
      setPrivacyCovered(false);
      if (lockedUserIdRef.current) return; // already locked and waiting
      void evaluateRef.current(true);
    };

    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, [user?.role?.code]);

  const retry = useCallback(async () => {
    const lockedUserId = lockedUserIdRef.current;
    if (!lockedUserId || prompting) return;
    const target = await resolveTargetAccount();
    // Only ever re-prompt for the exact account the lock was raised for.
    if (!target || target.userId !== lockedUserId) return;
    setFailureMessage(null);
    await runPrompt(target);
  }, [prompting, resolveTargetAccount, runPrompt]);

  const fallbackToPassword = useCallback(async () => {
    lockedUserIdRef.current = null;
    setFailureMessage(null);
    // Ends the live session but keeps this account (and every sibling) saved,
    // so it is still offered on the login screen for a password sign-in.
    // Routing is left to the existing useAuthGuard, which sends a signed-out
    // user on a protected route to /welcome exactly as any other logout does.
    await signOutKeepAccount();
    if (mountedRef.current) {
      setPrivacyCovered(false);
      setStatus('unlocked');
    }
  }, [signOutKeepAccount]);

  return {
    status,
    prompting,
    failureMessage,
    privacyCovered,
    retry,
    fallbackToPassword,
  };
}
