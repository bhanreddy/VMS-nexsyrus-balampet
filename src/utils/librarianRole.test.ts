import { resolveRoleFromDesignation, STAFF_ADD_LOGIN_ROLE_OPTIONS, isStaffPortalRole, isPersistentSessionRole } from './roleHelpers';
import { getHomeRouteForRole, getPortalLabelForRole } from './portalRoutes';
import { notificationHomeForRole, notificationPortalForRole } from './notificationRoutes';

it('assigns librarian logins and routes saved logins and notifications to the library', () => {
  expect(STAFF_ADD_LOGIN_ROLE_OPTIONS.find((v) => v.code === 'librarian')?.portal).toBe('library');
  expect(resolveRoleFromDesignation('Librarian')).toBe('librarian');
  expect(getHomeRouteForRole('librarian')).toBe('/library/dashboard');
  expect(getPortalLabelForRole('librarian')).toBe('Librarian');
  expect(isPersistentSessionRole('librarian')).toBe(true);
  expect(isStaffPortalRole('librarian')).toBe(false);
  expect(notificationPortalForRole('librarian')).toBe('library');
  expect(notificationHomeForRole('librarian')).toBe('/library/dashboard');
});
