/**
 * roleHelpers.ts — Single source of truth for role identification checks.
 *
 * The "student" role in the database represents the parent/family login
 * that shows the child's data. There is no separate parent account.
 *
 * Gate ALL student/parent-specific persistence code behind isStudentRole()
 * so there are no scattered inline `role === 'student'` comparisons.
 */

/** Login roles assignable when creating staff (Contact & Login section). */
export const STAFF_ADD_LOGIN_ROLE_OPTIONS = [
  { code: 'staff', label: 'Staff / Teacher', portal: 'staff' as const },
  { code: 'principal', label: 'Principal', portal: 'staff' as const },
  { code: 'admin', label: 'Administrator', portal: 'admin' as const },
  { code: 'driver', label: 'Driver', portal: 'driver' as const },
  { code: 'librarian', label: 'Librarian', portal: 'library' as const },
  { code: 'gate_keeper', label: 'Gate Keeper', portal: 'gatekeeper' as const },
] as const;

export type StaffAddLoginRoleCode = (typeof STAFF_ADD_LOGIN_ROLE_OPTIONS)[number]['code'];

/** Role codes that may access /staff/* routes after login. */
export const STAFF_PORTAL_ROLE_CODES: readonly string[] = [
  ...STAFF_ADD_LOGIN_ROLE_OPTIONS.filter((o) => o.portal === 'staff').map((o) => o.code),
  'teacher',
];

/**
 * Map a staff designation name to the login role assigned on create.
 * Keeps add-staff role assignment in sync with the roles the portals expect.
 */
export function resolveRoleFromDesignation(designationName: string | null | undefined): StaffAddLoginRoleCode {
  const name = String(designationName || '').trim().toLowerCase();
  if (name === 'principal') return 'principal';
  if (name.includes('admin')) return 'admin';
  if (name === 'driver') return 'driver';
  if (name.includes('librarian')) return 'librarian';
  if (name.includes('gate') || name.includes('security')) return 'gate_keeper';
  return 'staff';
}

/**
 * Check if a role code represents a student/parent account.
 * Student accounts are the parent-facing login used by families.
 * The explicit `parent` role is used by the unified portal switcher.
 */
export function isStudentRole(roleCode: string | null | undefined): boolean {
  return roleCode === 'student' || roleCode === 'students' || roleCode === 'parent';
}

/**
 * Check if a role code represents a gatekeeper account.
 */
export function isGatekeeperRole(roleCode: string | null | undefined): boolean {
  return roleCode === 'gate_keeper' || roleCode === 'gatekeeper';
}

/**
 * Roles that may keep cached UI state while retrying a transient refresh.
 *
 * Parent (student), admin, driver, gatekeeper, and staff/teacher/principal logins stay
 * A network/5xx refresh failure may be retried without immediately clearing
 * their cached UI state. Confirmed 401/403, school mismatch, invalid refresh
 * tokens, and SIGNED_OUT always revoke local authority regardless of role.
 *
 * The ONLY role deliberately excluded is `accountant` (Accounts department
 * login), which retains its school-hours / short-lived session restrictions.
 *
 * Unknown/empty roles are not trusted as persistent.
 */
export function isPersistentSessionRole(roleCode: string | null | undefined): boolean {
  if (!roleCode) return false;
  return [
    'student',
    'students',
    'parent',
    'admin',
    'driver',
    'gate_keeper',
    'gatekeeper',
    'staff',
    'teacher',
    'principal',
    'applicant',
    'librarian',
  ].includes(roleCode);
}

export function isApplicantRole(roleCode: string | null | undefined): boolean {
  return roleCode === 'applicant';
}

/** Roles allowed to access /staff/* app routes. */
export function isStaffPortalRole(roleCode: string | null | undefined): boolean {
  if (!roleCode) return false;
  return STAFF_PORTAL_ROLE_CODES.includes(roleCode);
}

/**
 * The ONLY role codes permitted to use fingerprint login / app unlock.
 *
 * Deliberately narrower than isStaffPortalRole(): `driver` is a staff-portal
 * login but is NOT a higher-authority role and must never see the feature.
 * Every other role — student, parent, accountant/accounts, driver, and any
 * unknown or missing role — is forbidden.
 */
export const FINGERPRINT_ELIGIBLE_ROLE_CODES: readonly string[] = [
  'staff',
  'teacher',
  'admin',
  'principal',
];

/**
 * Single source of truth for "may this account use fingerprint authentication?".
 *
 * Every fingerprint decision — the settings switch, the saved-account row on
 * the login screen, the cold-start/resume lock gate, and the biometric service
 * itself — must call this. Never inline a role comparison for this feature:
 * UI hiding alone is not a security boundary, so the service re-checks with
 * this same helper before any prompt, storage write, or session restore.
 *
 * Matching is exact and allow-list based, so an unrecognised role code always
 * fails closed.
 */
export function isFingerprintEligibleRole(roleCode: string | null | undefined): boolean {
  if (!roleCode) return false;
  return FINGERPRINT_ELIGIBLE_ROLE_CODES.includes(roleCode);
}

export function normalizeLoginEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

/** Deduplicate designation rows by name (defensive if API ever returns duplicates). */
export function dedupeDesignationsByName<T extends { id: number; name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
