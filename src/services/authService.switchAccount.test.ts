/* eslint-disable import/first, @typescript-eslint/no-require-imports */
jest.mock('../constants/school', () => ({ SCHOOL_ID: 12, SCHOOL_NAME: 'Test School' }));
jest.mock('./secureTokenStore', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getBackupRefreshToken: jest.fn(async () => null),
    SecureTokenStore: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => { store.set(key, value); }),
      removeItem: jest.fn(async (key: string) => { store.delete(key); }),
    },
  };
});
jest.mock('./biometricService', () => ({ disableFingerprintForAccount: jest.fn() }));
jest.mock('./staffBiometricService', () => ({ staffBiometricService: { getStoredRegistration: jest.fn(async () => ({})) } }));
jest.mock('./supabaseConfig', () => ({ supabase: { auth: {
  getSession: jest.fn(), setSession: jest.fn(), signInWithPassword: jest.fn(), signOut: jest.fn(),
} } }));
jest.mock('./apiClient', () => ({
  APIError: class extends Error {},
  api: { post: jest.fn() },
  registerSessionRecoveryCallback: jest.fn(),
}));
jest.mock('./pushFanout', () => ({ refreshAccessTokenStandalone: jest.fn() }));

import type { Session } from '@supabase/supabase-js';
import { AuthService, isInternalSessionSwap } from './authService';
import * as vault from './accountVault';
import type { VaultAccount } from './accountVault';
import { supabase } from './supabaseConfig';
import { api } from './apiClient';
import { refreshAccessTokenStandalone } from './pushFanout';
import { staffBiometricService } from './staffBiometricService';
const { __store: store, SecureTokenStore } = require('./secureTokenStore');

function account(userId: string, role = 'student'): VaultAccount {
  return {
    userId, displayName: userId, photoUrl: null, admissionNo: userId,
    supabaseSession: {
      access_token: `${userId}-access`, refresh_token: `${userId}-refresh`,
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, user: { id: userId },
    } as Session,
    validatedUser: { userId, schoolId: 12, displayName: userId, admission_no: userId, role: { code: role }, classId: `${userId}-class` } as VaultAccount['validatedUser'],
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

let accounts: VaultAccount[];
let live: Session | null;
beforeEach(async () => {
  jest.clearAllMocks();
  store.clear();
  accounts = [account('a'), account('b', 'admin'), account('c', 'staff')];
  for (const entry of accounts) {
    await vault.addAccount(entry);
    await vault.saveLoginRecoveryCredential(entry.userId, `${entry.userId}@example.com`, `${entry.userId}-password`);
  }
  await vault.saveQrRecoveryCredential('a', 'a-qr');
  await vault.setActiveAccountId('a');
  live = accounts[0].supabaseSession;
  store.set('auth_session', JSON.stringify({ supabaseSession: live, validatedUser: accounts[0].validatedUser }));
  (supabase.auth.getSession as jest.Mock).mockImplementation(async () => ({ data: { session: live } }));
  (supabase.auth.setSession as jest.Mock).mockImplementation(async ({ access_token, refresh_token }) => {
    const entry = accounts.find((a) => a.userId === access_token.split('-')[0])!;
    live = { ...entry.supabaseSession, access_token, refresh_token, expires_in: 3500 };
    return { data: { session: live }, error: null };
  });
  (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({ data: { session: null }, error: { message: 'rejected' } });
  (api.post as jest.Mock).mockImplementation(async (_path, _body, options) => {
    const userId = options.headers.Authorization.replace('Bearer ', '').split('-')[0];
    return accounts.find((a) => a.userId === userId)!.validatedUser;
  });
  (refreshAccessTokenStandalone as jest.Mock).mockResolvedValue(null);
  (staffBiometricService.getStoredRegistration as jest.Mock).mockResolvedValue({});
  SecureTokenStore.setItem.mockClear();
});

it('starts school validation while live session setup is still pending, then waits for both', async () => {
  const setup = deferred<any>();
  const validation = deferred<any>();
  const setupStarted = deferred<void>();
  const validationStarted = deferred<void>();
  (supabase.auth.setSession as jest.Mock).mockImplementationOnce(() => { setupStarted.resolve(); return setup.promise; });
  (api.post as jest.Mock).mockImplementationOnce(() => { validationStarted.resolve(); return validation.promise; });
  let completed = false;
  const switching = AuthService.switchAccount('b').then((result) => { completed = true; return result; });
  await Promise.all([setupStarted.promise, validationStarted.promise]);
  expect(completed).toBe(false);
  expect(isInternalSessionSwap()).toBe(true);
  expect(api.post).toHaveBeenCalledWith('/auth/validate-school-user', { includePortalContexts: false }, expect.objectContaining({
    headers: { Authorization: 'Bearer b-access' }, omitAuth: true,
  }));
  validation.resolve(accounts[1].validatedUser);
  expect(await vault.getActiveAccountId()).toBe('a');
  setup.resolve({ data: { session: accounts[1].supabaseSession }, error: null });
  expect((await switching).session?.validatedUser.userId).toBe('b');
  expect(isInternalSessionSwap()).toBe(false);
});

it('preserves all accounts, backup tokens and recovery credentials across A → B → A', async () => {
  const dormant = (await vault.listAccounts())[2];
  expect((await AuthService.switchAccount('b')).error).toBeUndefined();
  expect((await AuthService.switchAccount('a')).error).toBeUndefined();
  expect(await vault.getActiveAccountId()).toBe('a');
  expect(await vault.listAccounts()).toHaveLength(3);
  expect((await vault.listAccounts())[2]).toEqual(dormant);
  for (const entry of accounts) {
    expect(await vault.getBackupRefreshTokenForUser(entry.userId)).toBe(`${entry.userId}-refresh`);
    expect((await vault.getLoginRecoveryCredential(entry.userId))?.password).toBe(`${entry.userId}-password`);
  }
  expect((await vault.getQrRecoveryCredential('a'))?.qrPayload).toBe('a-qr');
  expect(supabase.auth.signOut).not.toHaveBeenCalled();
  expect(SecureTokenStore.removeItem).not.toHaveBeenCalled();
  // Fresh server validation still runs, but unchanged encrypted records need no rewrite.
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(SecureTokenStore.setItem.mock.calls.filter(([key]: [string]) =>
    key === 'vault_accounts_v1' || key === 'vault_refresh_tokens_v1'
  )).toHaveLength(0);
});

it('validates the target while saving rotated outgoing tokens, before changing the live client', async () => {
  live = { ...accounts[0].supabaseSession, refresh_token: 'a-rotated-refresh' };
  const saved = deferred<void>();
  const saving = deferred<void>();
  const validationStarted = deferred<void>();
  const write = SecureTokenStore.setItem.getMockImplementation();
  SecureTokenStore.setItem.mockImplementation(async (key: string, value: string) => {
    if (key === 'vault_accounts_v1') { saving.resolve(); await saved.promise; }
    return write(key, value);
  });
  (api.post as jest.Mock).mockImplementationOnce(async () => {
    validationStarted.resolve();
    return accounts[1].validatedUser;
  });
  try {
    const switching = AuthService.switchAccount('b');
    await Promise.all([saving.promise, validationStarted.promise]);
    expect(supabase.auth.setSession).not.toHaveBeenCalled();
    saved.resolve();
    expect((await switching).session?.validatedUser.userId).toBe('b');
    expect(await vault.getBackupRefreshTokenForUser('a')).toBe('a-rotated-refresh');
  } finally {
    saved.resolve();
    SecureTokenStore.setItem.mockImplementation(write);
  }
});

it('persists refreshed profile data alongside the active session, committing the pointer only after both', async () => {
  await vault.patchAccountMetadata('b', { classLabel: 'Class 5', schoolName: 'Test School' });
  const saved = deferred<void>();
  const saving = deferred<void>();
  const vaultSaved = deferred<void>();
  const write = SecureTokenStore.setItem.getMockImplementation();
  SecureTokenStore.setItem.mockImplementation(async (key: string, value: string) => {
    if (key === 'auth_session') { saving.resolve(); await saved.promise; }
    await write(key, value);
    if (key === 'vault_accounts_v1') vaultSaved.resolve();
  });
  (api.post as jest.Mock).mockResolvedValueOnce({ ...accounts[1].validatedUser, classId: 'new-class' });
  try {
    const switching = AuthService.switchAccount('b');
    await Promise.all([saving.promise, vaultSaved.promise]);
    expect(await vault.getActiveAccountId()).toBe('a');
    saved.resolve();
    expect((await switching).session?.validatedUser.classId).toBe('new-class');
    const target = (await vault.listAccounts()).find((entry) => entry.userId === 'b');
    expect(target).toMatchObject({ schoolName: 'Test School', validatedUser: { classId: 'new-class' } });
    expect(target?.classLabel).toBeUndefined();
    expect(await vault.getActiveAccountId()).toBe('b');
  } finally {
    saved.resolve();
    SecureTokenStore.setItem.mockImplementation(write);
  }
});

it('snapshots rotated outgoing tokens before leaving that account', async () => {
  live = { ...accounts[0].supabaseSession, access_token: 'a-rotated-access', refresh_token: 'a-rotated-refresh' };
  await AuthService.switchAccount('b');
  const outgoing = (await vault.listAccounts()).find((a) => a.userId === 'a')!;
  expect(outgoing.supabaseSession.refresh_token).toBe('a-rotated-refresh');
  expect(await vault.getBackupRefreshTokenForUser('a')).toBe('a-rotated-refresh');
});

it('settles a concurrent vault save before rolling back a failed active-session write', async () => {
  const vaultSave = deferred<void>();
  const vaultStarted = deferred<void>();
  const persistenceFailed = deferred<void>();
  const write = SecureTokenStore.setItem.getMockImplementation();
  SecureTokenStore.setItem.mockImplementation(async (key: string, value: string) => {
    if (key === 'auth_session' && JSON.parse(value).validatedUser.userId === 'b') {
      persistenceFailed.resolve();
      throw new Error('storage unavailable');
    }
    if (key === 'vault_accounts_v1') { vaultStarted.resolve(); await vaultSave.promise; }
    return write(key, value);
  });
  (api.post as jest.Mock).mockResolvedValueOnce({ ...accounts[1].validatedUser, classId: 'new-class' });
  let completed = false;
  try {
    const switching = AuthService.switchAccount('b').then((result) => { completed = true; return result; });
    await Promise.all([vaultStarted.promise, persistenceFailed.promise]);
    expect(completed).toBe(false);
    expect(isInternalSessionSwap()).toBe(true);
    expect(await vault.getActiveAccountId()).toBe('a');
    vaultSave.resolve();
    expect((await switching).error).toBe('storage unavailable');
    expect(live?.user.id).toBe('a');
    expect(JSON.parse(store.get('auth_session')).validatedUser.userId).toBe('a');
    expect(await vault.listAccounts()).toHaveLength(3);
    expect(isInternalSessionSwap()).toBe(false);
  } finally {
    vaultSave.resolve();
    SecureTokenStore.setItem.mockImplementation(write);
  }
});

it('refreshes an expired account with its own token and preserves dormant logins', async () => {
  accounts[1].supabaseSession.expires_at = Math.floor(Date.now() / 1000) - 60;
  await vault.addAccount(accounts[1]);
  (refreshAccessTokenStandalone as jest.Mock).mockResolvedValue({
    access_token: 'b-new-access', refresh_token: 'b-new-refresh', expires_at: Math.floor(Date.now() / 1000) + 7200,
  });
  const result = await AuthService.switchAccount('b');
  expect(refreshAccessTokenStandalone).toHaveBeenCalledWith('b-refresh');
  expect(result.session?.supabaseSession.refresh_token).toBe('b-new-refresh');
  expect(await vault.getBackupRefreshTokenForUser('b')).toBe('b-new-refresh');
  expect(await vault.getBackupRefreshTokenForUser('c')).toBe('c-refresh');
  expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
});

it('uses the per-account backup when a legacy vault session lacks its refresh token', async () => {
  accounts[1].supabaseSession.refresh_token = '';
  await vault.addAccount(accounts[1]);
  expect((await AuthService.switchAccount('b')).session?.validatedUser.userId).toBe('b');
  expect(supabase.auth.setSession).toHaveBeenCalledWith({ access_token: 'b-access', refresh_token: 'b-refresh' });
});

it('recovers a dormant account with its saved password after refresh rejection', async () => {
  accounts[1].supabaseSession.expires_at = Math.floor(Date.now() / 1000) - 60;
  await vault.addAccount(accounts[1]);
  const recovered = { ...accounts[1].supabaseSession, access_token: 'b-recovered-access', refresh_token: 'b-recovered-refresh' };
  (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({ data: { session: recovered }, error: null });
  expect((await AuthService.switchAccount('b')).session?.supabaseSession.refresh_token).toBe('b-recovered-refresh');
  expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'b@example.com', password: 'b-password' });
  expect(await vault.listAccounts()).toHaveLength(3);
});

it('revalidates the recovered session when the SDK rejects the initial session setup', async () => {
  (supabase.auth.setSession as jest.Mock).mockResolvedValueOnce({ data: { session: null }, error: { message: 'Invalid Refresh Token' } });
  const recovered = { ...accounts[1].supabaseSession, access_token: 'b-recovered-access', refresh_token: 'b-recovered-refresh' };
  (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({ data: { session: recovered }, error: null });
  expect((await AuthService.switchAccount('b')).session?.supabaseSession.refresh_token).toBe('b-recovered-refresh');
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post).toHaveBeenLastCalledWith('/auth/validate-school-user', { includePortalContexts: false }, expect.objectContaining({
    headers: { Authorization: 'Bearer b-recovered-access' },
  }));
});

it('validates the new token if the SDK rotates it while establishing the session', async () => {
  const rotated = { ...accounts[1].supabaseSession, access_token: 'b-sdk-access', refresh_token: 'b-sdk-refresh' };
  (supabase.auth.setSession as jest.Mock).mockResolvedValueOnce({ data: { session: rotated }, error: null });
  (api.post as jest.Mock).mockRejectedValueOnce(new Error('old token expired'));
  expect((await AuthService.switchAccount('b')).session?.supabaseSession.refresh_token).toBe('b-sdk-refresh');
  expect(api.post).toHaveBeenLastCalledWith('/auth/validate-school-user', { includePortalContexts: false }, expect.objectContaining({
    headers: { Authorization: 'Bearer b-sdk-access' },
  }));
});

it('keeps the current account and all recovery credentials when dormant recovery fails', async () => {
  accounts[1].supabaseSession.expires_at = Math.floor(Date.now() / 1000) - 60;
  await vault.addAccount(accounts[1]);
  expect((await AuthService.switchAccount('b')).error).toBeTruthy();
  expect(await vault.getActiveAccountId()).toBe('a');
  expect(live?.user.id).toBe('a');
  expect((await vault.getLoginRecoveryCredential('b'))?.password).toBe('b-password');
  expect(await vault.getBackupRefreshTokenForUser('b')).toBe('b-refresh');
  expect(await vault.listAccounts()).toHaveLength(3);
});

it('rolls back to the outgoing account when school validation rejects the target', async () => {
  (api.post as jest.Mock).mockRejectedValueOnce(new Error('account_locked'));
  expect((await AuthService.switchAccount('b')).error).toBe('account_locked');
  expect(live?.user.id).toBe('a');
  expect(await vault.getActiveAccountId()).toBe('a');
  expect(JSON.parse(store.get('auth_session')).validatedUser.userId).toBe('a');
  expect(await vault.listAccounts()).toHaveLength(3);
  expect(supabase.auth.signOut).not.toHaveBeenCalled();
  expect(isInternalSessionSwap()).toBe(false);
});

it('keeps the queue guarded until session setup settles after an early validation failure', async () => {
  const setup = deferred<any>();
  const validationStarted = deferred<void>();
  (supabase.auth.setSession as jest.Mock).mockImplementationOnce(() => setup.promise);
  (api.post as jest.Mock).mockImplementationOnce(() => {
    validationStarted.resolve();
    return Promise.reject(new Error('account_not_active'));
  });
  const first = AuthService.switchAccount('b');
  const next = AuthService.switchAccount('c');
  await validationStarted.promise;
  expect(isInternalSessionSwap()).toBe(true);
  expect(supabase.auth.setSession).toHaveBeenCalledTimes(1);
  setup.resolve({ data: { session: accounts[1].supabaseSession }, error: null });
  expect((await first).error).toBe('account_not_active');
  expect((await next).session?.validatedUser.userId).toBe('c');
  expect(await vault.getActiveAccountId()).toBe('c');
});

it('serializes rapid switches across all saved accounts without losing an account', async () => {
  const results = await Promise.all(['b', 'c', 'a'].map((id) => AuthService.switchAccount(id)));
  expect(results.map((result) => result.session?.validatedUser.userId)).toEqual(['b', 'c', 'a']);
  expect(await vault.getActiveAccountId()).toBe('a');
  expect(live?.user.id).toBe('a');
  expect(await vault.listAccounts()).toHaveLength(3);
});

it.each(['school', 'identity', 'live identity'])('rejects a mismatched %s before committing', async (mismatch) => {
  if (mismatch === 'live identity') {
    (supabase.auth.setSession as jest.Mock).mockResolvedValueOnce({ data: { session: accounts[0].supabaseSession }, error: null });
  } else {
    (api.post as jest.Mock).mockResolvedValueOnce({
      ...accounts[1].validatedUser,
      ...(mismatch === 'school' ? { schoolId: 99 } : { userId: 'c' }),
    });
  }
  expect((await AuthService.switchAccount('b')).error).toBeTruthy();
  expect(await vault.getActiveAccountId()).toBe('a');
  expect(await vault.listAccounts()).toHaveLength(3);
});

it('keeps device ownership restrictions before establishing another staff session', async () => {
  accounts[2].validatedUser.personId = 'person-c';
  accounts[2].validatedUser.has_staff_profile = true;
  await vault.addAccount(accounts[2]);
  (staffBiometricService.getStoredRegistration as jest.Mock).mockResolvedValue({ status: 'approved', personId: 'person-a' });
  expect((await AuthService.switchAccount('c')).error).toContain('another staff member');
  expect(supabase.auth.setSession).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
  expect(await vault.getActiveAccountId()).toBe('a');
});
