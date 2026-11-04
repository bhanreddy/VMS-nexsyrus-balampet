import type { Session } from '@supabase/supabase-js';
import { SecureTokenStore } from './secureTokenStore';
import { supabase } from './supabaseConfig';
import { AuthSession, ValidatedUser } from '../types/auth';
import { api, APIError, registerSessionRecoveryCallback } from './apiClient';
import { SCHOOL_NAME, SCHOOL_ID } from '../constants/school';
import { normalizeLoginEmail } from '../utils/roleHelpers';
import * as accountVault from './accountVault';
import type { VaultAccount } from './accountVault';
import type { AccessContext, PortalContextsPayload } from '../types/context';
import { refreshAccessTokenStandalone } from './pushFanout';
import { staffBiometricService } from './staffBiometricService';
import { clearStaffPortalSession, getStaffPortalSession } from './staffPortalSession';

const TOKEN_SKEW_SECONDS = 60;

function mapRoleCodeForFrontend(code: string): string {
  return code === 'accounts' ? 'accountant' : code;
}

/** Single-flight refresh so TOKEN_REFRESHED storms don't stack validate calls */
let refreshSessionInFlight: Promise<AuthSession | null> | null = null;
/** Single-flight cold-start repair so native and web screens cannot race session setup. */
let restorePersistedSessionInFlight: Promise<AuthSession | null> | null = null;
let authStateRevision = 0;

// ─────────────────────────────────────────────────────────────────────────
// Phase 2 — internal session-swap guard + serialization
//
// `internalSwapDepth` is a module-level counter (NOT a boolean) that is held > 0
// for the entire duration of any internal supabase.auth.setSession() /
// signInWithPassword() we perform during switchAccount or the addAccount-restore
// step. useAuth's onAuthStateChange checks isInternalSessionSwap() and suppresses
// the events those calls emit (SIGNED_IN / TOKEN_REFRESHED) so they don't trip
// the "a brand-new login just happened" path. A counter (not a flag) keeps
// suppression on across nested/overlapping swaps until the LAST one completes.
//
// `enqueueSwap` serializes all live-client mutations (switchAccount + addAccount)
// onto a single promise chain, so two switches in quick succession (A→B→A) run
// sequentially and the vault's active pointer can never disagree with the live
// client's actual session. The shared core `doSwitchAccount` is intentionally
// NOT enqueued so addAccount can call it directly without self-deadlocking.
// ─────────────────────────────────────────────────────────────────────────
let internalSwapDepth = 0;
function beginInternalSwap(): void { internalSwapDepth += 1; }
function endInternalSwap(): void { internalSwapDepth = Math.max(0, internalSwapDepth - 1); }

/** True while we are performing an internal session swap; checked by useAuth. */
export function isInternalSessionSwap(): boolean { return internalSwapDepth > 0; }

let swapChain: Promise<unknown> = Promise.resolve();
/** Serialize all live-client mutations onto one chain (race-safe ordering). */
function enqueueSwap<T>(fn: () => Promise<T>): Promise<T> {
  const run = swapChain.then(fn, fn); // run regardless of the previous result
  swapChain = run.then(() => undefined, () => undefined); // keep the chain alive
  return run;
}

function shouldForceSignOutOnValidateError(err: unknown): boolean {
  if (!(err instanceof APIError) || err.statusCode !== 403) return false;
  const denied = new Set([
    'ACCOUNT_LOCKED', 'ACCOUNT_NOT_ACTIVE', 'ACCOUNT_NOT_IN_SCHOOL',
    'SCHOOL_MISMATCH', 'DEVICE_OWNED_BY_ANOTHER_STAFF',
  ]);
  return denied.has((err.code || '').toUpperCase()) || [
    'account_locked', 'account_not_active', 'account_not_in_school',
    'Account is not active', 'User does not belong to this school',
  ].includes(err.message);
}

function isConfirmedRefreshRejection(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const value = err as { status?: number; code?: string; message?: string };
  const code = (value.code || '').toLowerCase();
  const message = (value.message || '').toLowerCase();
  return (
    (value.status === 400 || value.status === 401) &&
    (
      code.includes('refresh_token') ||
      code.includes('invalid_grant') ||
      message.includes('refresh token') ||
      message.includes('invalid grant')
    )
  );
}

function liveSessionUserId(
  supabaseSession: NonNullable<AuthSession['supabaseSession']>
): string | undefined {
  return supabaseSession.user?.id;
}

function validatedUserMatchesLiveSession(
  supabaseSession: NonNullable<AuthSession['supabaseSession']>,
  validatedUser: ValidatedUser | null | undefined
): boolean {
  const liveId = liveSessionUserId(supabaseSession);
  return Boolean(liveId && validatedUser?.userId && liveId === validatedUser.userId);
}

async function persistSessionFromRefresh(
  supabaseSession: NonNullable<AuthSession['supabaseSession']>,
  validatedUser: ValidatedUser
): Promise<AuthSession> {
  const authSession: AuthSession = {
    supabaseSession,
    validatedUser,
    tokenExpiresAt: supabaseSession.expires_at
      ? supabaseSession.expires_at * 1000
      : Date.now() + 3600000,
  };
  await setSecureItem(STORAGE_KEY, JSON.stringify(authSession));
  try {
    await accountVault.addAccount(accountVault.buildVaultAccount(authSession));
  } catch {
    // Vault sync is best-effort — never block session persistence.
  }
  return authSession;
}

/**
 * Last-resort recovery. Refresh tokens remain the primary mechanism; the
 * stored password is touched only after a refresh token is missing or
 * rejected. Credentials are persisted on every platform so switches do not
 * silently die when a dormant account's refresh token expires.
 */
async function recoverSessionWithSavedLogin(
  prior: Pick<AuthSession, 'validatedUser'>
): Promise<Session | null> {
  const credential = await accountVault.getLoginRecoveryCredential(
    prior.validatedUser.userId
  );
  if (!credential) return null;

  beginInternalSwap();
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credential.email,
      password: credential.password,
    });
    if (
      error ||
      !data.session ||
      data.session.user.id !== prior.validatedUser.userId
    ) {
      return null;
    }
    return data.session;
  } finally {
    endInternalSwap();
  }
}

type SavedSessionRecovery = {
  session: Session | null;
  method: 'password' | 'qr' | null;
  error?: string;
  code?: string;
};

/**
 * Replay a previously scanned school QR only after refresh-token and password
 * recovery are unavailable. The backend still enforces expiry, revocation,
 * school ownership, and active-student status on every replay.
 */
async function recoverSessionWithSavedQr(
  prior: Pick<AuthSession, 'validatedUser'>
): Promise<SavedSessionRecovery> {
  const credential = await accountVault.getQrRecoveryCredential(
    prior.validatedUser.userId
  );
  if (!credential) return { session: null, method: null };

  beginInternalSwap();
  try {
    const exchange = await api.post<{
      token?: string;
      refresh_token?: string;
      tokenHash?: string;
      type?: 'magiclink' | 'email';
    }>(
      '/auth/qr/resolve',
      { qrPayload: credential.qrPayload },
      {
        silent: true,
        timeoutMs: 20000,
        omitAuth: true,
        headers: { 'X-Request-Id': createQrLoginRequestId() },
      }
    );
    const established = await establishQrSupabaseSession(exchange);
    if (
      !established?.session ||
      established.userId !== prior.validatedUser.userId
    ) {
      return {
        session: null,
        method: 'qr',
        error: "We couldn't restore this saved QR login. Scan the QR again.",
        code: 'QR_SESSION_CREATE_FAILED',
      };
    }
    return { session: established.session, method: 'qr' };
  } catch (error: any) {
    const mapped = mapQrExchangeError(error);
    return { session: null, method: 'qr', ...mapped };
  } finally {
    endInternalSwap();
  }
}

async function recoverSessionWithSavedCredential(
  prior: Pick<AuthSession, 'validatedUser'>
): Promise<SavedSessionRecovery> {
  const passwordSession = await recoverSessionWithSavedLogin(prior);
  if (passwordSession) {
    return { session: passwordSession, method: 'password' };
  }
  return recoverSessionWithSavedQr(prior);
}

function vaultAccountAsPrior(target: VaultAccount): Pick<AuthSession, 'validatedUser'> {
  return { validatedUser: target.validatedUser };
}

async function saveRecoveryCredentialReliably(
  userId: string,
  email: string,
  password: string
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await accountVault.saveLoginRecoveryCredential(
        userId,
        email,
        password
      );
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) =>
          setTimeout(resolve, 50 * Math.pow(2, attempt))
        );
      }
    }
  }
  throw lastError;
}

async function saveQrRecoveryCredentialReliably(
  userId: string,
  qrPayload: string
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await accountVault.saveQrRecoveryCredential(userId, qrPayload);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) =>
          setTimeout(resolve, 50 * Math.pow(2, attempt))
        );
      }
    }
  }
  throw lastError;
}

async function syncVaultFromAuthSession(authSession: AuthSession): Promise<void> {
  await accountVault.addAccount(accountVault.buildVaultAccount(authSession));
}

function mapAdditiveValidationError(err: any): string {
  const errMsg = err?.message || '';
  const errMsgLc = errMsg.toLowerCase();
  let errorMsg = errMsg || 'Validation failed. Contact support.';

  if (errMsgLc.includes('account_not_in_school') || errMsgLc.includes('is not registered with')) {
    errorMsg = `This account is not registered with ${SCHOOL_NAME}.\nContact your school administrator.`;
  } else if (err?.code === 'SCHOOL_MISMATCH' || errMsgLc.includes('user does not belong to this school')) {
    errorMsg = `This account does not belong to ${SCHOOL_NAME}.\nContact your school administrator.`;
  } else if (errMsgLc.includes('account_locked')) {
    errorMsg = `Your account has been locked. Contact ${SCHOOL_NAME} admin.`;
  } else if (errMsgLc.includes('account_not_active')) {
    errorMsg = `Your account is not active. Contact ${SCHOOL_NAME} admin.`;
  }
  return errorMsg;
}

function mapQrExchangeError(error: any): { error: string; code?: string } {
  const code = typeof error?.code === 'string' ? error.code : undefined;
  if (error instanceof APIError && (error.statusCode === 0 || error.statusCode === 408)) {
    const timeout = error.statusCode === 408 || /timed out|timeout/i.test(error.message || '');
    return {
      error: timeout
        ? 'SchoolIMS took too long to respond. Please try again.'
        : 'Unable to reach SchoolIMS. Check your internet connection and try again.',
      code: timeout ? 'QR_SERVER_ERROR' : 'NETWORK_ERROR',
    };
  }
  if (code) {
    return { error: error?.message || 'QR login failed.', code };
  }
  if (error?.code === 'NOT_SCHOOLIMS_LOGIN_QR' || error?.code === 'UNSUPPORTED_LOGIN_QR_VERSION' || error?.code === 'INVALID_LOGIN_QR') {
    return { error: 'This QR code is not a valid SchoolIMS login QR.', code: 'QR_INVALID' };
  }
  if (error instanceof APIError && (error.statusCode === 503 || error.statusCode === 429 || error.statusCode === 502 || error.statusCode === 504)) {
    return { error: "We couldn't complete QR login right now. Please try again.", code: error.code || 'QR_LOGIN_UNAVAILABLE' };
  }
  if (error instanceof APIError && error.statusCode === 401) {
    return {
      error: error.message || 'This QR code has expired. Please generate a new QR.',
      code: error.code || 'QR_TOKEN_EXPIRED',
    };
  }
  return { error: "We couldn't complete QR login right now. Please try again.", code: 'UNKNOWN_ERROR' };
}

function createQrLoginRequestId(): string {
  return `qr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function establishQrSupabaseSession(exchange: {
  token?: string;
  refresh_token?: string;
  tokenHash?: string;
  type?: string;
}): Promise<{ session: Session; userId: string } | null> {
  if (exchange.token && exchange.refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token: exchange.token,
      refresh_token: exchange.refresh_token,
    });
    if (!error && data.session?.user?.id) {
      return { session: data.session, userId: data.session.user.id };
    }
  }
  if (exchange.tokenHash) {
    const otpType = !exchange.type || exchange.type === 'magiclink' || exchange.type === 'signup'
      ? 'email'
      : exchange.type;
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: exchange.tokenHash,
      type: otpType as 'email' | 'magiclink' | 'signup' | 'recovery' | 'invite' | 'email_change',
    });
    if (!error && data.session?.user?.id) {
      return { session: data.session, userId: data.session.user.id };
    }
  }
  return null;
}

/**
 * Validate + vault a newly authenticated Supabase session without making it
 * the live account when another account is already active.
 */
async function completeAdditiveVaultLogin(
  supabaseSession: Session,
  previousActiveUserId: string | null,
  recovery?: { email: string; password: string } | { qrPayload: string }
): Promise<{ session?: AuthSession; error?: string }> {
  try {
    const validatedUser = await api.post<ValidatedUser>('/auth/validate-school-user', {}, {
      headers: { Authorization: `Bearer ${supabaseSession.access_token}` },
      silent: true,
    });

    if (!validatedUser) {
      if (previousActiveUserId) await doSwitchAccount(previousActiveUserId);
      return { error: 'Verification failed. Your session could not be validated.' };
    }

    if (Number(validatedUser.schoolId) !== Number(SCHOOL_ID)) {
      if (previousActiveUserId) await doSwitchAccount(previousActiveUserId);
      return { error: `This account does not belong to ${SCHOOL_NAME}.\nContact your school administrator.` };
    }

    const authSession: AuthSession = {
      supabaseSession,
      validatedUser,
      tokenExpiresAt: supabaseSession.expires_at ? supabaseSession.expires_at * 1000 : Date.now() + 3600000,
    };

    await accountVault.addAccount(accountVault.buildVaultAccount(authSession));
    if (recovery && 'email' in recovery) {
      await saveRecoveryCredentialReliably(
        authSession.validatedUser.userId,
        recovery.email,
        recovery.password
      );
    } else if (recovery && 'qrPayload' in recovery) {
      await saveQrRecoveryCredentialReliably(
        authSession.validatedUser.userId,
        recovery.qrPayload
      );
    }

    const newUserId = validatedUser.userId;
    if (previousActiveUserId && previousActiveUserId !== newUserId) {
      await doSwitchAccount(previousActiveUserId);
    } else if (!previousActiveUserId) {
      await setSecureItem(STORAGE_KEY, JSON.stringify(authSession));
      await accountVault.setActiveAccountId(newUserId);
    }

    return { session: authSession };
  } catch (err: any) {
    if (previousActiveUserId) {
      try { await doSwitchAccount(previousActiveUserId); } catch { /* best-effort */ }
    }
    return { error: mapAdditiveValidationError(err) };
  }
}

/** Persist the live Supabase client's session for the account we're switching away from. */
async function snapshotLiveAccountToVault(
  account: VaultAccount,
  liveSession: Session | null
): Promise<void> {
  if (!liveSession?.refresh_token || liveSession.user?.id !== account.userId) return;
  if (
    liveSession.access_token === account.supabaseSession?.access_token &&
    liveSession.refresh_token === account.supabaseSession?.refresh_token &&
    liveSession.expires_at === account.supabaseSession?.expires_at
  ) return;
  const authSession: AuthSession = {
    supabaseSession: liveSession,
    validatedUser: account.validatedUser,
    tokenExpiresAt: liveSession.expires_at
      ? liveSession.expires_at * 1000
      : Date.now() + 3600000,
  };
  try {
    await syncVaultFromAuthSession(authSession);
  } catch {
    /* best-effort */
  }
}

function mergeRefreshedTokensIntoSession(
  base: Session,
  refreshed: { access_token: string; refresh_token: string; expires_at: number }
): Session {
  const nowS = Math.floor(Date.now() / 1000);
  return {
    ...base,
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at: refreshed.expires_at,
    expires_in: Math.max(0, refreshed.expires_at - nowS),
  };
}

/**
 * Resolve usable access + refresh tokens for a vaulted account.
 * Uses standalone refresh (no live-client mutation) when tokens are missing or stale.
 * Does not touch the live client or stored passwords — callers handle password
 * recovery under the internal-swap guard.
 */
async function resolveTargetSessionTokens(
  target: VaultAccount,
  userId: string
): Promise<{ accessToken: string; refreshToken: string; needsRecovery: boolean }> {
  let refreshToken =
    target.supabaseSession?.refresh_token ||
    (await accountVault.getBackupRefreshTokenForUser(userId)) ||
    '';
  let accessToken = target.supabaseSession?.access_token ?? '';

  const expiresAt = target.supabaseSession?.expires_at ?? 0;
  const nowS = Math.floor(Date.now() / 1000);
  const needsRefresh =
    !refreshToken || !accessToken || !expiresAt || expiresAt <= nowS + TOKEN_SKEW_SECONDS;

  if (needsRefresh && refreshToken) {
    const refreshed = await refreshAccessTokenStandalone(refreshToken);
    if (refreshed) {
      accessToken = refreshed.access_token;
      refreshToken = refreshed.refresh_token;
      const prefetchedSession = mergeRefreshedTokensIntoSession(
        target.supabaseSession ?? ({} as Session),
        refreshed
      );
      try {
        await syncVaultFromAuthSession({
          supabaseSession: prefetchedSession,
          validatedUser: target.validatedUser,
          tokenExpiresAt: refreshed.expires_at * 1000,
        });
      } catch {
        /* best-effort */
      }
      return { accessToken, refreshToken, needsRecovery: false };
    }
    return { accessToken, refreshToken, needsRecovery: true };
  }

  const tokensLookUsable =
    !!accessToken &&
    !!refreshToken &&
    !!expiresAt &&
    expiresAt > nowS + TOKEN_SKEW_SECONDS;
  return {
    accessToken,
    refreshToken,
    needsRecovery: !tokensLookUsable,
  };
}

async function restorePreviousLiveSession(
  previousActive: VaultAccount | null,
  previousLiveSession: Session | null
): Promise<void> {
  const sessionToRestore = previousLiveSession ?? previousActive?.supabaseSession ?? null;
  if (!sessionToRestore?.access_token) return;

  const refreshToken =
    sessionToRestore.refresh_token ||
    (previousActive ? await accountVault.getBackupRefreshTokenForUser(previousActive.userId) : null) ||
    '';
  if (!refreshToken) return;

  const { data, error } = await supabase.auth.setSession({
    access_token: sessionToRestore.access_token,
    refresh_token: refreshToken,
  });

  if (error || !data?.session) {
    if (__DEV__) {
      console.warn('[AuthService] failed to restore previous live session after switch failure:', error?.message);
    }
    return;
  }

  if (!previousActive) return;

  await persistSessionFromRefresh(data.session, previousActive.validatedUser);
  await accountVault.setActiveAccountId(previousActive.userId);
}

function mapSwitchErrorMessage(message?: string): string {
  const raw = message || "Could not restore this account's session";
  const lower = raw.toLowerCase();
  if (lower.includes('refresh token') || lower.includes('invalid') || lower.includes('expired')) {
    return 'This saved login expired. Add it again with email and password, or scan its school QR.';
  }
  if (lower.includes('could not restore')) {
    return 'This saved login expired. Add it again with email and password, or scan its school QR.';
  }
  return raw;
}

const STORAGE_KEY = 'auth_session';

async function setSecureItem(key: string, value: string) {
  await SecureTokenStore.setItem(key, value);
}

async function getSecureItem(key: string): Promise<string | null> {
  return await SecureTokenStore.getItem(key);
}

async function removeSecureItem(key: string) {
  await SecureTokenStore.removeItem(key);
}

async function readPersistedAuthSession(): Promise<AuthSession | null> {
  const raw = await getSecureItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    return parsed?.validatedUser && parsed?.supabaseSession ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Rebuild the live Supabase client from SchoolIMS's durable auth_session.
 *
 * Android can kill the JavaScript process and browsers can rebuild or restore a
 * page while leaving durable app data intact. In that state the UI identity
 * still exists, but the newly-created Supabase client can temporarily report
 * no session. refreshSession() without a live refresh token then returns
 * AuthSessionMissingError and every screen appears disconnected until a manual
 * login.
 *
 * This repair is deliberately non-destructive:
 *   1. reuse a matching live session when one already exists;
 *   2. explicitly set the persisted access + refresh tokens on the new client;
 *   3. if those tokens are dead, silently use the saved recovery credential.
 *
 * No failure in this function removes the remembered identity.
 */
async function restorePersistedSessionCore(): Promise<AuthSession | null> {
  const revision = authStateRevision;
  const prior = await readPersistedAuthSession();
  if (!prior?.validatedUser || !prior.supabaseSession) return null;

  let liveSession: Session | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    liveSession = data.session;
  } catch {
    // Fall through to the independently persisted SchoolIMS session.
  }

  const liveMatchesRememberedUser =
    !!liveSession?.access_token &&
    !!liveSession?.refresh_token &&
    liveSession.user?.id === prior.validatedUser.userId;
  const liveExpiresAt = liveSession?.expires_at ?? 0;
  const liveIsUsable =
    liveMatchesRememberedUser &&
    liveExpiresAt > Math.floor(Date.now() / 1000) + TOKEN_SKEW_SECONDS;

  if (liveIsUsable && liveSession) {
    if (revision !== authStateRevision) return null;
    const liveDiffersFromPersisted =
      liveSession.access_token !== prior.supabaseSession.access_token ||
      liveSession.refresh_token !== prior.supabaseSession.refresh_token ||
      liveSession.expires_at !== prior.supabaseSession.expires_at;
    return liveDiffersFromPersisted
      ? persistSessionFromRefresh(liveSession, prior.validatedUser)
      : prior;
  }

  const candidate = liveMatchesRememberedUser
    ? liveSession
    : prior.supabaseSession;

  if (candidate?.access_token && candidate?.refresh_token) {
    beginInternalSwap();
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: candidate.access_token,
        refresh_token: candidate.refresh_token,
      });
      // Offline/unavailable auth must retry the refresh token later. Replaying
      // a password here would turn every connection failure into a new login.
      if (error && !isConfirmedRefreshRejection(error)) return null;
      if (
        !error &&
        data?.session &&
        data.session.user.id === prior.validatedUser.userId &&
        revision === authStateRevision
      ) {
        return persistSessionFromRefresh(
          data.session,
          prior.validatedUser
        );
      }
    } catch {
      return null;
    } finally {
      endInternalSwap();
    }
  }

  if (revision !== authStateRevision) return null;
  const recovered = await recoverSessionWithSavedCredential(prior);
  if (!recovered.session || revision !== authStateRevision) return null;
  return persistSessionFromRefresh(recovered.session, prior.validatedUser);
}

export const clearAuthState = async (): Promise<void> => {
  authStateRevision += 1;
  await removeSecureItem(STORAGE_KEY);
};

// ─────────────────────────────────────────────────────────────────────────
// Phase 2 — shared switch core
// ─────────────────────────────────────────────────────────────────────────

/**
 * Shared switch core (NOT enqueued — callers serialize via enqueueSwap).
 *
 * Pulls the target's stored session from the vault, sets it on the live
 * Supabase client (silently recovering an expired access token via its stored
 * refresh token), persists it as the active `auth_session`, updates the vault's
 * active pointer. School authorization must pass before the switch commits.
 *
 * INVARIANT 1: never calls clearAuthState()/signIn()/SecureTokenStore.removeItem.
 * Only setItem-based writes are used, so the account being switched AWAY from is
 * never wiped. Its latest live tokens are saved before switching, and password
 * and QR recovery remain available for dormant accounts.
 */
async function doSwitchAccount(
  userId: string
): Promise<{ session?: AuthSession; error?: string }> {
  clearStaffPortalSession();
  const [accounts, reg, previousActiveId, live] = await Promise.all([
    accountVault.listAccounts(),
    staffBiometricService.getStoredRegistration(),
    accountVault.getActiveAccountId(),
    supabase.auth.getSession(),
  ]);
  const target = accounts.find((a) => a.userId === userId);
  if (!target) return { error: 'Account not found in vault' };

  // Guard: If device is registered to another staff person, block switching into this staff account
  if (
    (reg.status === 'pending' || reg.status === 'approved') &&
    reg.personId &&
    target.validatedUser.personId &&
    reg.personId !== target.validatedUser.personId &&
    target.validatedUser.has_staff_profile
  ) {
    return {
      error: 'This device is registered to another staff member. Multi-staff account switching is not permitted on registered devices.'
    };
  }

  const previousActive =
    previousActiveId && previousActiveId !== userId
      ? accounts.find((a) => a.userId === previousActiveId) ?? null
      : null;
  const previousLiveSession = live.data.session;

  const { accessToken, refreshToken, needsRecovery } = await resolveTargetSessionTokens(
    target,
    userId
  );

  beginInternalSwap();
  try {
    // Preserve outgoing tokens before changing the live client, while allowing
    // the independent school authorization request to run during this disk write.
    const snapshot = previousActive && previousLiveSession?.refresh_token
      ? snapshotLiveAccountToVault(previousActive, previousLiveSession)
      : Promise.resolve();
    let liveSession: Session | null = null;
    let validatedUser: ValidatedUser | undefined;
    let setSessionError: string | undefined;

    if (!needsRecovery && refreshToken) {
      // Both services independently check the same target token. Explicit
      // authorization avoids reading the live client while setSession holds
      // its SDK lock, and excludes the outgoing account's portal context.
      // Settle both requests before rollback or the next serialized switch.
      const [established, validation] = await Promise.allSettled([
        snapshot.then(() => supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })),
        validateUserForAccountSwitch(accessToken),
      ]);
      if (established.status === 'rejected') throw established.reason;
      const { data, error } = established.value;
      if (!error && data?.session) {
        liveSession = data.session;
        // If the SDK rotated tokens during setup, validate the new token.
        if (liveSession.access_token === accessToken) {
          if (validation.status === 'rejected') throw validation.reason;
          validatedUser = validation.value;
        }
      } else {
        setSessionError = error?.message;
      }
    }

    // Refresh dead or setSession rejected → rebuild from the saved password
    // or school QR credential, depending on how this account was added.
    if (!liveSession) {
      await snapshot;
      const recovered = await recoverSessionWithSavedCredential(vaultAccountAsPrior(target));
      if (recovered.session) {
        liveSession = recovered.session;
      } else if (recovered.method === 'qr') {
        setSessionError = recovered.error || setSessionError;
      }
    }

    if (!liveSession) {
      await restorePreviousLiveSession(previousActive, previousLiveSession);
      return {
        error: mapSwitchErrorMessage(
          setSessionError ||
            (refreshToken ? 'Could not restore this account\'s session' : 'No saved session for this account')
        ),
      };
    }

    if (!validatedUser) {
      validatedUser = await validateUserForAccountSwitch(liveSession.access_token);
    }
    return await finalizeSwitchedSession(
      liveSession,
      target,
      previousActive,
      previousLiveSession,
      validatedUser
    );
  } catch (e: any) {
    await restorePreviousLiveSession(previousActive, previousLiveSession);
    return { error: mapSwitchErrorMessage(e?.message || 'Account switch failed') };
  } finally {
    endInternalSwap();
  }
}

function validateUserForAccountSwitch(accessToken: string): Promise<ValidatedUser> {
  return api.post<ValidatedUser>(
    '/auth/validate-school-user',
    // The portal picker refreshes its own list on open. Account switches only
    // need the authorized identity (including the current student class).
    { includePortalContexts: false },
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      omitAuth: true,
      silent: true,
      timeoutMs: 20000,
    }
  );
}

async function finalizeSwitchedSession(
  liveSession: Session,
  target: VaultAccount,
  previousActive: VaultAccount | null,
  previousLiveSession: Session | null,
  validatedUser: ValidatedUser
): Promise<{ session?: AuthSession; error?: string }> {
  if (
    !validatedUser ||
    liveSession.user?.id !== target.userId ||
    validatedUser.userId !== target.userId ||
    validatedUser.schoolId !== SCHOOL_ID
  ) {
    await restorePreviousLiveSession(previousActive, previousLiveSession);
    return { error: 'This saved account is no longer authorized. Sign in again.' };
  }

  const newActive: AuthSession = {
    supabaseSession: liveSession,
    validatedUser,
    tokenExpiresAt: liveSession.expires_at
      ? liveSession.expires_at * 1000
      : Date.now() + 3600000,
  };

  // These write different storage keys. Settle both before committing the
  // pointer (or rolling back), so a slow vault write cannot outlive this swap.
  const [persisted] = await Promise.allSettled([
    setSecureItem(STORAGE_KEY, JSON.stringify(newActive)),
    syncVaultFromAuthSession(newActive), // best-effort, as on refresh
  ]);
  if (persisted.status === 'rejected') throw persisted.reason;
  await accountVault.setActiveAccountId(target.userId);

  return { session: newActive };
}

type RecoveryCredential =
  | { email: string; password: string }
  | { qrPayload: string };

/** Shared post-auth pipeline. Supabase issues the session; SchoolIMS validates
 * its tenant, account status, role, profile, and device ownership. */
async function finalizeSupabaseSignIn(
  supabaseSession: Session,
  userId: string,
  recoveryCredential?: RecoveryCredential,
  options?: { requestId?: string; omitAuth?: boolean },
): Promise<{ session?: AuthSession; error?: string; code?: string }> {
  try {
    const validatedUser = await api.post<ValidatedUser>('/auth/validate-school-user', {}, {
      headers: {
        Authorization: `Bearer ${supabaseSession.access_token}`,
        ...(options?.requestId ? { 'X-Request-Id': options.requestId } : {}),
      },
      silent: true,
      omitAuth: options?.omitAuth === true,
    });
    if (!validatedUser) throw new Error('Verification failed. Your session could not be validated.');
    if (validatedUser.userId !== userId) throw new Error('Session identity verification failed.');
    if (Number(validatedUser.schoolId) !== Number(SCHOOL_ID)) {
      await AuthService.signOut();
      return {
        error: `This account does not belong to ${SCHOOL_NAME}.\nContact your school administrator.`,
        code: 'QR_SCHOOL_MISMATCH',
      };
    }

    const reg = await staffBiometricService.getStoredRegistration();
    if (
      (reg.status === 'pending' || reg.status === 'approved') &&
      reg.personId && validatedUser.personId && reg.personId !== validatedUser.personId &&
      validatedUser.has_staff_profile
    ) {
      await AuthService.signOut();
      return { error: 'This device is registered to another staff member. Multi-staff sharing on a registered mobile installation is not permitted.' };
    }

    const authSession: AuthSession = {
      supabaseSession,
      validatedUser,
      tokenExpiresAt: supabaseSession.expires_at ? supabaseSession.expires_at * 1000 : Date.now() + 3600000,
    };
    await setSecureItem(STORAGE_KEY, JSON.stringify(authSession));
    try {
      await accountVault.addAccount(accountVault.buildVaultAccount(authSession));
      await accountVault.setActiveAccountId(authSession.validatedUser.userId);
      if (recoveryCredential && 'email' in recoveryCredential) {
        await saveRecoveryCredentialReliably(
          authSession.validatedUser.userId,
          recoveryCredential.email,
          recoveryCredential.password,
        );
      } else if (recoveryCredential && 'qrPayload' in recoveryCredential) {
        await saveQrRecoveryCredentialReliably(
          authSession.validatedUser.userId,
          recoveryCredential.qrPayload,
        );
      }
    } catch (vaultErr) {
      if (__DEV__) console.warn('[AuthService] vault registration failed:', vaultErr);
    }
    return { session: authSession };
  } catch (err: any) {
    const errCode = err?.code;
    const errMsg = err?.message || '';
    if (
      errCode === 'OUT_OF_HOURS_NO_ACCESS' ||
      errMsg.includes('Accounts department access is restricted to school hours') ||
      errMsg.includes('OUT_OF_HOURS_NO_ACCESS')
    ) {
      await AuthService.signOut();
      const outOfHoursError: any = new Error(errMsg || 'Access restricted to school hours');
      outOfHoursError.code = 'OUT_OF_HOURS_NO_ACCESS';
      outOfHoursError.userId = userId;
      throw outOfHoursError;
    }

    let errorMsg = errMsg || 'Validation failed. Contact support.';
    const lower = errMsg.toLowerCase();
    if (lower.includes('account_not_in_school') || lower.includes('is not registered with')) {
      errorMsg = `This account is not registered with ${SCHOOL_NAME}.\nContact your school administrator.`;
    } else if (errCode === 'SCHOOL_MISMATCH' || lower.includes('user does not belong to this school')) {
      errorMsg = `This account does not belong to ${SCHOOL_NAME}.\nContact your school administrator.`;
    } else if (lower.includes('account_locked')) {
      errorMsg = `Your account has been locked. Contact ${SCHOOL_NAME} admin.`;
    } else if (lower.includes('account_not_active')) {
      errorMsg = `Your account is not active. Contact ${SCHOOL_NAME} admin.`;
    } else if (lower.includes('school_id is required')) {
      errorMsg = 'Tenant context missing. Please restart the app and try again.';
    }
    await AuthService.signOut();
    return {
      error: errorMsg,
      code: errCode || 'QR_SESSION_CREATE_FAILED',
    };
  }
}

export const AuthService = {
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    const email = currentSession?.user?.email;
    const userId = currentSession?.user?.id;
    if (!email || !userId || !currentPassword) {
      throw new Error('Current password is required.');
    }

    beginInternalSwap();
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      }, { silent: true });
      await saveRecoveryCredentialReliably(
        userId,
        email,
        newPassword
      );
    } finally {
      endInternalSwap();
    }
  },

  /**
   * Patch the active user's photoUrl in the persisted auth_session AND the
   * multi-account vault, then return the updated in-memory session so the
   * provider can re-render every avatar that reads validatedUser.photoUrl.
   * Tokens are never touched. Returns null if there is no stored session.
   */
  updateActivePhotoUrl: async (photoUrl: string | null): Promise<AuthSession | null> => {
    const raw = await getSecureItem(STORAGE_KEY);
    if (!raw) return null;
    let parsed: AuthSession;
    try {
      parsed = JSON.parse(raw) as AuthSession;
    } catch {
      return null;
    }
    if (!parsed?.validatedUser) return null;

    const updated: AuthSession = {
      ...parsed,
      validatedUser: { ...parsed.validatedUser, photoUrl },
    };

    await setSecureItem(STORAGE_KEY, JSON.stringify(updated));
    try {
      await accountVault.addAccount(accountVault.buildVaultAccount(updated));
    } catch {
      // Vault update is best-effort — never block the photo change on it.
    }
    return updated;
  },

  applyPortalContext: async (
    activeContext: AccessContext,
    portalContexts?: PortalContextsPayload | null
  ): Promise<AuthSession | null> => {
    const raw = await getSecureItem(STORAGE_KEY);
    if (!raw) return null;
    let parsed: AuthSession;
    try {
      parsed = JSON.parse(raw) as AuthSession;
    } catch {
      return null;
    }
    if (!parsed?.validatedUser) return null;

    // Opening a staff member's portal from Manage Staff is not a portal-context
    // switch. Applying the viewed teacher's context here permanently turned the
    // signed-in admin into that staff account.
    if (getStaffPortalSession().staffId) {
      return parsed;
    }

    const primaryRole = activeContext.role_codes[0] || parsed.validatedUser.role?.code || 'student';
    const roleCode = mapRoleCodeForFrontend(primaryRole);

    const updated: AuthSession = {
      ...parsed,
      validatedUser: {
        ...parsed.validatedUser,
        role: { code: roleCode, name: roleCode },
        roles: (activeContext.role_codes || []).map(mapRoleCodeForFrontend),
        permissions: activeContext.permissions ?? parsed.validatedUser.permissions,
        staffId: activeContext.staff_id ?? parsed.validatedUser.staffId,
        portalContexts: portalContexts ?? parsed.validatedUser.portalContexts,
      },
    };

    await setSecureItem(STORAGE_KEY, JSON.stringify(updated));
    try {
      await accountVault.addAccount(accountVault.buildVaultAccount(updated));
    } catch {
      // best-effort
    }
    return updated;
  },

  signIn: async (email: string, password: string): Promise<{ session?: AuthSession; error?: string }> => {
    await clearAuthState();
    const canonicalEmail = normalizeLoginEmail(email);
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: canonicalEmail,
      password,
    });
    if (signInError || !signInData.session) {
      return { error: 'Invalid credentials' };
    }
    return finalizeSupabaseSignIn(signInData.session, signInData.user.id, {
      email: canonicalEmail,
      password,
    });
  },

  signInWithQr: async (qrPayload: string): Promise<{ session?: AuthSession; error?: string; code?: string }> => {
    await clearAuthState();
    const requestId = createQrLoginRequestId();
    console.info('[qr-login]', { event: 'qr_login_request', requestId, endpoint: '/auth/qr/resolve' });
    try {
      const exchange = await api.post<{
        token?: string;
        refresh_token?: string;
        tokenHash?: string;
        type?: 'magiclink' | 'email';
      }>(
        '/auth/qr/resolve',
        { qrPayload },
        {
          silent: true,
          timeoutMs: 20000,
          omitAuth: true,
          headers: { 'X-Request-Id': requestId },
        },
      );
      const established = await establishQrSupabaseSession(exchange);
      if (!established) {
        return {
          error: "We couldn't complete the login. Please try again.",
          code: 'QR_SESSION_CREATE_FAILED',
        };
      }
      const result = await finalizeSupabaseSignIn(established.session, established.userId, { qrPayload }, {
        requestId,
        omitAuth: true,
      });
      return result.session
        ? result
        : {
            error: result.error || "We couldn't complete the login. Please try again.",
            code: result.code || 'QR_SESSION_CREATE_FAILED',
          };
    } catch (error: any) {
      return mapQrExchangeError(error);
    }
  },

  /**
   * addAccount — additive login for the multi-account vault, with Phase-2
   * live-client reconciliation.
   *
   * Same login + validation as signIn(), but never calls clearAuthState() and
   * never writes the active `auth_session` slot for an *existing* multi-account
   * setup. The whole operation is serialized onto the swap chain and held under
   * the internal-swap guard so the events emitted by signInWithPassword (and the
   * restore) are suppressed in useAuth.
   *
   * Active-account reconciliation (case determined from the vault pointer BEFORE
   * the login mutates anything):
   *   - A different account was active  → restore it as the live + active account
   *     via the shared doSwitchAccount() (no duplicated setSession logic).
   *   - No account was active (very first add on this device) → the new account
   *     becomes and stays active; persist it as `auth_session` + pointer.
   *   - The active account was re-added  → no-op (already live + active).
   */
  addAccount: (email: string, password: string): Promise<{ session?: AuthSession; error?: string }> =>
    enqueueSwap(async () => {
      const canonicalEmail = normalizeLoginEmail(email);
      // Capture the active pointer BEFORE signInWithPassword mutates the client.
      const previousActiveUserId = await accountVault.getActiveAccountId();

      beginInternalSwap();
      try {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: canonicalEmail,
          password,
        });

        if (signInError || !signInData.session) {
          // signInWithPassword does not set a session on failure; restore the
          // previous active account if the client state was disturbed.
          if (previousActiveUserId) {
            try { await doSwitchAccount(previousActiveUserId); } catch { /* best-effort */ }
          }
          return { error: 'Invalid credentials' };
        }

        return completeAdditiveVaultLogin(signInData.session, previousActiveUserId, {
          email: canonicalEmail,
          password,
        });
      } finally {
        endInternalSwap();
      }
    }),

  /**
   * addAccountWithQr — same additive vault behaviour as addAccount, using a
   * school-issued login QR instead of email/password. Never calls clearAuthState().
   */
  addAccountWithQr: (qrPayload: string): Promise<{ session?: AuthSession; error?: string }> =>
    enqueueSwap(async () => {
      const previousActiveUserId = await accountVault.getActiveAccountId();

      beginInternalSwap();
      try {
        const exchange = await api.post<{
          token?: string;
          refresh_token?: string;
          tokenHash?: string;
          type?: 'magiclink' | 'email';
        }>(
          '/auth/qr/resolve',
          { qrPayload },
          { silent: true, timeoutMs: 20000, omitAuth: true, headers: { 'X-Request-Id': createQrLoginRequestId() } },
        );
        const established = await establishQrSupabaseSession(exchange);
        if (!established) {
          if (previousActiveUserId) {
            try { await doSwitchAccount(previousActiveUserId); } catch { /* best-effort */ }
          }
          return {
            error: "We couldn't complete the login. Please try again.",
            code: 'QR_SESSION_CREATE_FAILED',
          };
        }
        return completeAdditiveVaultLogin(established.session, previousActiveUserId, { qrPayload });
      } catch (error: any) {
        if (previousActiveUserId) {
          try { await doSwitchAccount(previousActiveUserId); } catch { /* best-effort */ }
        }
        return mapQrExchangeError(error);
      } finally {
        endInternalSwap();
      }
    }),

  /**
   * switchAccount — seamlessly make a vaulted account the live + active account.
   * Serialized onto the swap chain (race-safe under rapid A→B→A). Delegates to
   * the shared doSwitchAccount core. Never prompts for a password; if the
   * stored refresh token is dead it silently rebuilds the session from the
   * durable password or QR credential saved at sign-in / add-account time.
   */
  switchAccount: (userId: string): Promise<{ session?: AuthSession; error?: string }> =>
    enqueueSwap(() => doSwitchAccount(userId)),

  signOut: async (): Promise<void> => {
    authStateRevision += 1;
    clearStaffPortalSession();
    // 1. Remove from SecureStore
    await removeSecureItem(STORAGE_KEY);
    // 2. supabase.auth.signOut()
    await supabase.auth.signOut({ scope: 'local' });
    // 3. Clear any in-memory cache (handled by useAuth state wiping)
  },

  getSession: async (): Promise<AuthSession | null> => {
    const session = await readPersistedAuthSession();
    if (!session) return null;
    // Restore the locally validated app identity immediately, even when its
    // short-lived access token is stale. AuthProvider explicitly awaits live
    // client hydration during boot; this local read never starts a second,
    // unobserved recovery job.
    return session;
  },

  /** Local-only read used while handling Supabase auth events. */
  getStoredSession: async (): Promise<AuthSession | null> => {
    return readPersistedAuthSession();
  },

  /**
   * Ensure the live Supabase client is usable after process death. Concurrent
   * boot, foreground, and API recovery calls all share the same repair.
   */
  restorePersistedSession: async (): Promise<AuthSession | null> => {
    if (restorePersistedSessionInFlight) {
      return restorePersistedSessionInFlight;
    }
    restorePersistedSessionInFlight = restorePersistedSessionCore().finally(() => {
      restorePersistedSessionInFlight = null;
    });
    return restorePersistedSessionInFlight;
  },

  /**
   * Persist the session Supabase already rotated. Calling refreshSession()
   * from TOKEN_REFRESHED would rotate twice and can race the SDK storage write.
   */
  adoptRefreshedSession: async (
    refreshed: Session
  ): Promise<AuthSession | null> => {
    const revision = authStateRevision;
    const prior = await readPersistedAuthSession();
    if (
      !prior?.validatedUser ||
      refreshed.user.id !== prior.validatedUser.userId ||
      revision !== authStateRevision
    ) {
      return null;
    }
    return persistSessionFromRefresh(refreshed, prior.validatedUser);
  },

  refreshSession: async (options?: { force?: boolean }): Promise<AuthSession | null> => {
    if (refreshSessionInFlight) {
      return refreshSessionInFlight;
    }

    refreshSessionInFlight = (async (): Promise<AuthSession | null> => {
      const revision = authStateRevision;
      const prior = await readPersistedAuthSession();

      if (options?.force === false) {
        const restored = await AuthService.restorePersistedSession();
        if (restored?.supabaseSession.expires_at &&
            restored.supabaseSession.expires_at > Math.floor(Date.now() / 1000) + TOKEN_SKEW_SECONDS) {
          return restored;
        }
      }

      let { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (revision !== authStateRevision) return null;

      if (refreshError || !refreshData.session) {
        if (isConfirmedRefreshRejection(refreshError)) {
          // Refresh-token rejection is recoverable on native when the user
          // previously completed a successful password login on this device.
          // Do not erase the cached app session before trying that recovery.
          if (prior?.validatedUser) {
            const recovered = await recoverSessionWithSavedCredential(prior);
            if (recovered.session) {
              refreshData = { ...refreshData, session: recovered.session };
              refreshError = null;
            } else {
              console.warn(
                '[AUTH_REFRESH] Refresh token rejected and saved-login recovery was unavailable; cached session preserved'
              );
              return null;
            }
          } else {
            return null;
          }
        } else if (prior?.validatedUser) {
          // A newly-created native or browser client may not yet have a live
          // session even though SchoolIMS's durable auth_session survived.
          // Rehydrate it explicitly instead of retrying "session missing"
          // forever behind an apparently logged-in UI.
          const restored = await AuthService.restorePersistedSession();
          if (restored?.supabaseSession) {
            refreshData = {
              ...refreshData,
              session: restored.supabaseSession,
            };
            refreshError = null;
          }
        }
      }

      if (revision !== authStateRevision) return null;

      if (refreshError || !refreshData.session) {
        // Keep the remembered identity for every role. The provider retries
        // recovery with capped backoff without deleting saved device credentials.
        if (prior?.validatedUser) {
          console.warn('[AUTH_REFRESH] Supabase refresh failed but prior session exists — preserving for retry');
          return null; // Return null to signal failure without clearing storage
        }
        console.warn('[AUTH_REFRESH] No cached identity is available for recovery');
        return null;
      }

      let validatedUser: ValidatedUser | null = null;
      // Commit newly rotated tokens before a backend validation request. An
      // outage or policy denial must not leave the old refresh token on disk.
      const remembered = prior?.validatedUser &&
        validatedUserMatchesLiveSession(refreshData.session, prior.validatedUser)
        ? await persistSessionFromRefresh(refreshData.session, prior.validatedUser)
        : null;
      try {
        validatedUser = await api.post<ValidatedUser>(
          '/auth/validate-school-user',
          {},
          {
            headers: {
              Authorization: `Bearer ${refreshData.session.access_token}`,
            },
            silent: true,
          }
        );
      } catch (err) {
        if (revision !== authStateRevision) return null;
        if (shouldForceSignOutOnValidateError(err)) {
          console.log('[AUTH_OUT]', 'api_403_confirmed', new Date().toISOString());
          await AuthService.signOut();
          return null;
        }
        // Backend authorization still rejects restricted requests. Keep the
        // login on ordinary 401/403 responses and transient service failures.
        return remembered;
      }

      if (revision !== authStateRevision) return null;

      if (!validatedUser) {
        console.warn('[AUTH_REFRESH] Empty validation response; cached session preserved');
        return null;
      }

      if (Number(validatedUser.schoolId) !== Number(SCHOOL_ID)) {
        console.log('[AUTH_OUT]', 'school_mismatch', new Date().toISOString());
        await AuthService.signOut();
        return null;
      }

      if (!validatedUserMatchesLiveSession(refreshData.session, validatedUser)) {
        if (prior?.validatedUser && validatedUserMatchesLiveSession(refreshData.session, prior.validatedUser)) {
          console.warn('[AUTH_REFRESH] Ignoring impersonated identity; keeping signed-in account');
          return persistSessionFromRefresh(refreshData.session, prior.validatedUser);
        }
        console.warn('[AUTH_REFRESH] Validated identity did not match the live session');
        return null;
      }

      return persistSessionFromRefresh(refreshData.session, validatedUser);
    })().finally(() => {
      refreshSessionInFlight = null;
    });

    return refreshSessionInFlight;
  },

  // Role check helpers
  isAdmin: async (): Promise<boolean> => {
    const session = await AuthService.getSession();
    return session?.validatedUser?.role?.code === 'admin';
  },
  isStaff: async (): Promise<boolean> => {
    const session = await AuthService.getSession();
    const c = session?.validatedUser?.role?.code;
    return c === 'staff' || c === 'teacher' || c === 'principal';
  },
  isStudent: async (): Promise<boolean> => {
    const session = await AuthService.getSession();
    return session?.validatedUser?.role?.code === 'student';
  },
  isAccounts: async (): Promise<boolean> => {
    const session = await AuthService.getSession();
    return session?.validatedUser?.role?.code === 'accountant';
  },
  isPrincipal: async (): Promise<boolean> => {
    const session = await AuthService.getSession();
    return session?.validatedUser?.role?.code === 'principal';
  },
  isDriver: async (): Promise<boolean> => {
    const session = await AuthService.getSession();
    return session?.validatedUser?.role?.code === 'driver';
  }
};

// Register at module initialization, before any screen effect can issue an API
// request. The callback returns only the Supabase session required for retry;
// AuthService remains the single owner of persistence and backend validation.
registerSessionRecoveryCallback(async (reason, rejectedAccessToken) => {
  const restored = await AuthService.restorePersistedSession();
  if (!restored) return null;

  // setSession may already have rotated an expired token. Late 401 responses
  // for an older token should reuse that rotation instead of rotating again.
  const tokenIsFresh = (restored.supabaseSession.expires_at ?? 0) >
    Math.floor(Date.now() / 1000) + TOKEN_SKEW_SECONDS;
  if (reason === 'missing' || (tokenIsFresh && (
    reason === 'expired' || restored.supabaseSession.access_token !== rejectedAccessToken
  ))) return restored.supabaseSession;

  const refreshed = await AuthService.refreshSession();
  return refreshed?.supabaseSession ?? null;
});
