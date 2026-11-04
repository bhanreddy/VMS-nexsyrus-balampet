import type { VaultAccount } from '../services/accountVault';
import { isStudentRole } from './roleHelpers';

/**
 * Home route after a successful login / account switch, keyed by role.
 *
 * The return type is intentionally left to inference so it resolves to the union
 * of literal route strings (not the wide `string`), which is what expo-router's
 * typed `router.replace` / `<Redirect>` require. Do NOT add a `: string`
 * annotation here — it would widen the type and break every typed call site.
 */
export function getHomeRouteForRole(roleCode: string | null | undefined): any {
  switch (roleCode) {
    case 'admin':
    case 'principal':
      return '/admin/dashboard';
    case 'accountant':
    case 'accounts':
      return '/accounts/dashboard';
    case 'staff':
    case 'teacher':
      return '/staff/dashboard';
    case 'librarian':
      return '/library/dashboard';
    case 'driver':
      return '/driver/dashboard';
    case 'gate_keeper':
    case 'gatekeeper':
      return '/gatekeeper/dashboard';
    case 'applicant':
      return '/admission/dashboard';
    case 'parent':
    case 'student':
    default:
      return '/(tabs)/home';
  }
}

/** Human-readable portal label shown in the account switcher. */
export function getPortalLabelForRole(roleCode: string | null | undefined): string {
  switch (roleCode) {
    case 'applicant':
      return 'Applicant';
    case 'student':
    case 'parent':
      return 'Parent';
    case 'staff':
    case 'teacher':
      return 'Staff';
    case 'admin':
    case 'principal':
      return 'Admin';
    case 'accountant':
    case 'accounts':
      return 'Accounts';
    case 'librarian':
      return 'Librarian';
    case 'driver':
      return 'Driver';
    case 'gate_keeper':
    case 'gatekeeper':
      return 'Gate Keeper';
    default:
      return 'Account';
  }
}

export function getVaultAccountSubtitle(acct: VaultAccount): string {
  const roleCode = acct.validatedUser?.role?.code;
  const portal = getPortalLabelForRole(roleCode);
  if (isStudentRole(roleCode)) {
    const detail = acct.classLabel || acct.admissionNo;
    return detail ? `${portal} · ${detail}` : portal;
  }
  const staffCode = acct.validatedUser?.staff_code;
  if (staffCode && (roleCode === 'staff' || roleCode === 'teacher')) {
    return `${portal} · ${staffCode}`;
  }
  return portal;
}
