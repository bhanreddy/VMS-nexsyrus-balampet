# Android blank startup screen

## Confirmed fresh-install crash in 5.1.9

The Geetanjali release bundle `5c3ac0a8-c692-44a3-b799-7b59228c44fc` (version 5.1.9, Android version code 28) reproduced a blank screen on a clean Android 15 / API 35 ARM64 emulator. Logcat reported `TypeError: Cannot convert undefined value to object` in `useAdminScreenUsage`, mounted by the root `NavigationReady` component before login.

The shared hook spread `ADMIN_CORE_QUICK_ACTIONS` imported from `src/constants/adminQuickActions.ts`. School release overlays replaced that module with an older file exporting only `buildAdminQuickActions`, so the imported array was undefined. The retained Geetanjali, Global, Samskruthe, Slate, VMS, Bhashayam, Chaitanya, NMMS, Chanakya, and default-school snapshots have this missing export. The root's incompatible error fallback then rendered no content, hiding the failure behind an empty screen.

The shared core actions now live in `src/config/adminCoreQuickActions.ts`, outside the overlaid directory. Both the root tracking hook and admin dashboard import that shared file. The hook skips admin-catalogue construction for signed-out and non-admin users. The release runner now typechecks the composed school workspace before pushing or submitting a build; its helper generates Expo's ignored environment and route types for clean workspaces.

All 10 configured school folders on `/Volumes/PortableSSD` were also updated to re-export `ADMIN_CORE_QUICK_ACTIONS` from the shared config, preserving compatibility with existing imports. Each school's original catalogue is preserved. School-composed validation also found Global and Samskruthe missing `theme.ribbonTagline`; that field was added using each school's existing ribbon accent colour. School identities, existing branding values, app/EAS settings and environment files were preserved. Originals and checksum manifests are under the SSD's `.schoolims-backups/startup-fix-2026-11-05_09-44-15/`. These are overlay folders and must be combined with the current shared frontend containing `src/config/adminCoreQuickActions.ts`; they do not update an already frozen build snapshot.

Verification used the released native code/resources with only the corrected production JavaScript substituted into a debug-signed test APK. Installing it over the reproducing APK reached the welcome screen. Clearing that test app's data and cold-opening it also reached welcome without the startup TypeError. This isolates the JavaScript startup regression; it is not a new Play-signed binary or a published release. The composed Geetanjali source, including its older constants overlay, also passed the release typecheck.

Evidence is retained in [verification/android-startup-5.1.9](verification/android-startup-5.1.9/verification.json), including before/after screenshots and the original exception excerpt.

## Startup safeguards

The startup flow had several paths that could leave Android displaying an empty screen:

- The root layout exported a class-based React boundary as an Expo Router route fallback. Expo Router supplies `error` and `retry` props rather than children; the class returned no content when invoked this way.
- Font loading had no deadline, and theme restoration returned `null` while waiting for storage. The native splash was dismissed before the app's content had laid out.
- Auth initialization awaited live SDK recovery and session-policy metadata without a deadline. While it waited, the fingerprint privacy overlay intentionally rendered no content.

The root now uses a route fallback with a working retry action. Startup renders a native spinner and system-font text, and hides the splash only after a view has laid out. Icon fonts may delay the main app for at most three seconds; theme preferences apply without blocking rendering. Live session recovery may delay startup for at most eight seconds after the local session is read, then continues in the background with the remembered login intact.

Fingerprint preference reads have a five-second deadline. An unreadable or stalled preference remains locked and offers password recovery; it never unlocks a protected account by timeout. The resolving/privacy surface shows the native loader. Authentication storage that throws remains subject to the existing local-read retry policy; credentials are not deleted or treated as an empty login.

## Verification

```sh
npx jest --runInBand src/hooks/useAdminScreenUsage.test.tsx src/__tests__/appStartup.test.tsx src/hooks/useAuth.session.test.tsx src/hooks/useAppFingerprintLock.test.tsx src/context/ThemeContext.test.tsx src/components/RouteErrorBoundary.test.tsx
node --test scripts/release-schools.test.cjs
node scripts/check-release-types.cjs
npm run typecheck
npx expo export --platform android --output-dir /tmp/schoolims-startup-android-export
```

Before releasing, test a signed Android build on a physical device:

1. Cold-open a fresh install and verify the welcome/login screen appears.
2. Update an existing installation without clearing app data; verify the remembered account reaches its dashboard.
3. Repeat offline with an expired access token, then reconnect and verify background session recovery.
4. Test an opted-in fingerprint account: successful scan, cancellation, password fallback, and background/resume. Protected content must remain covered until unlock.
5. Verify mandatory update policy still shows the update screen and a newly installed version satisfying the minimum opens normally.

Local checks pass 30 Jest tests and 18 release-runner tests. The release bundle reproduced the crash on an emulator, and the corrected JavaScript passed both update-in-place and cleared-data cold-start checks. Physical devices, signed production rebuilds, logged-in dashboard restoration, and real Play updates still need release validation. No store release was published. Rebuild each affected school from the corrected shared source and its school overlay, preserving its package ID and signing identity; an already frozen release snapshot still contains the defective code.

Expo references: [route error handling](https://docs.expo.dev/router/error-handling/), [splash-screen lifecycle](https://docs.expo.dev/versions/latest/sdk/splash-screen/).
