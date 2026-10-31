# Google Play updates

The Android app checks Google Play on launch and whenever it returns to the foreground. Only a release available to the installed application's package and the current Play account produces the optional update banner. No Play Store scraping or backend release-version entry is needed for normal updates.

## User flow

- Normal releases: **Update now** opens Google's flexible update consent flow. After acceptance, the app stays usable while the download progresses in the banner. **Restart** completes installation.
- Required releases: the existing school `minimum_app_version` / `force_update_enabled` policy displays the blocking screen. **Update Now** requests Google's immediate update flow. If that flow is disallowed but flexible updates are allowed, the blocking screen displays download progress and a restart action instead.
- Only flows Google allows are started. If the native flow cannot start, the user-initiated action opens this installed school's Play Store listing, with an HTTPS fallback when there is no market handler. Opening a listing does **not** automatically press its Update button.
- Cancelling Google's confirmation does not redirect the user or immediately reopen the prompt. Required updates remain on the blocking screen; optional updates remain available in the banner.
- Returning to the app recovers completed flexible downloads and resumes accepted immediate updates that Google reports as interrupted. Availability-check failures are silent. Installation failures retain the restart action for retry.
- The optional reminder can be dismissed for the current version during this app session. A new version or a pending download makes it visible again.
- iOS, web, Expo Go, and older Android binaries without the native module safely skip native availability checks. Existing required-update actions retain their store-link fallback.

## Implementation

`modules/play-store-updates` is an Android-only local Expo module, automatically discovered from Expo's default `./modules` directory. It uses `com.google.android.play:app-update:2.1.0`, listens for install-state changes, and obtains fresh single-use `AppUpdateInfo` objects on every update attempt. It needs no app-specific package name: Play uses the running Android context. Store fallback links prefer `Application.applicationId` so each school opens its own listing.

`usePlayStoreUpdate` owns one update controller in the root layout. `AppUpdateBanner` appears above the navigator for every role. `ForceUpdateScreen` shares that controller and selects immediate mode via the existing school policy. `useVersionCheck` also refreshes policy when the app returns to the foreground. The native module is optional at runtime so an OTA update cannot crash an older binary.

## Build and release

1. Build a **new Android binary** using the school's existing production EAS profile. This native integration cannot be installed solely through an Expo OTA update. Existing production profiles already use `autoIncrement: true` and remote version codes. Preserve the school's application ID and signing configuration.
2. Publish the AAB through the usual Google Play release process. The first release containing this integration enables the feature; a later release with a higher Android `versionCode` exercises detection.
3. Routine releases require no backend policy change. Google Play decides availability, including release-track membership, staged rollouts, country/device targeting, and account eligibility. Detection is not guaranteed at the instant an AAB is uploaded.
4. For a mandatory release, update the school's existing minimum-version settings only after the required binary is actually available to **all affected users**. Avoid setting a minimum above the releases users can receive during a staged rollout. Keep the binary's user-facing Expo version consistent with the backend minimum; Android update eligibility itself uses `versionCode`.

## Verify on Google Play

Use Play internal testing or [internal app sharing](https://developer.android.com/guide/playcore/in-app-updates/test). Expo Go, emulators without Google Play, and an arbitrary sideloaded debug APK do not validate real store updates.

1. Install version A **containing this integration** from the chosen Google Play test mechanism. Use an account that owns the app and is eligible for its test release.
2. Make version B available with the same application ID and signing identity and a higher `versionCode`. For internal app sharing, open B's sharing link on the test device, but leave its Play Store page without installing B.
3. Open A. Confirm the optional banner appears. Cancel once and confirm the app remains usable. Tap Update now again, accept, and verify progress followed by **Restart**. Tap Restart and confirm B is installed.
4. Repeat with a new A/B version pair and the school's minimum version set to B. Confirm the blocking screen and immediate update consent, installation, and restart. Cancel once and confirm that the required screen remains visible.
5. During a flexible download, background or close the app. Reopen it and verify the progress/restart state recovers. Interrupt an accepted immediate update and confirm Google resumes it on reopening.
6. Verify two different school application IDs open their own listings. Test offline launch, declined consent, unavailable native flow, download failure, and restart retry. Restore any test minimum-version policy afterward.

## Local verification

```sh
npx jest --runInBand src/hooks/usePlayStoreUpdate.test.tsx src/hooks/useVersionCheck.test.tsx src/components/AppUpdateBanner.test.tsx src/utils/openPlayStore.test.ts modules/play-store-updates/index.test.ts
npm run typecheck
npx expo-modules-autolinking resolve --platform android
cd android
./gradlew :play-store-updates:compileDebugKotlin :app:processDebugMainManifest
```

Local tests verify controller/UI behavior with mocked Play responses. A successful native compile and manifest merge verify integration. Actual Play consent, downloads, installation and rollout eligibility still require the two-version device test above.

References: [Google Play update flows](https://developer.android.com/guide/playcore/in-app-updates), [Android integration](https://developer.android.com/guide/playcore/in-app-updates/kotlin-java), [AppUpdateManager API](https://developer.android.com/reference/com/google/android/play/core/appupdate/AppUpdateManager).
