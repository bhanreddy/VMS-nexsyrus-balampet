# Android rendering crashes

## Change

Upgrade `react-native-reanimated` from the locked version 4.1.6 to 4.1.7, with a minimum dependency range of `~4.1.7`. Keep React Native 0.81.5, Worklets 0.5.2, and Expo SDK 54 unchanged; they are supported by this Reanimated patch.

Reanimated 4.1.7 includes the upstream fix for commits made during Android's draw pass. Previously, handling an animation or scroll event could synchronously apply pending view hierarchy changes while Android was drawing children. The resulting crash can appear as:

- `NullPointerException` reading `android.view.View.mViewFlags` in `ViewGroup.dispatchGetDisplayList`.
- `IllegalStateException` reporting a null child during `dispatchGetDisplayList`.

The patch detects the draw pass and defers operations that could change the hierarchy. This addresses the known upstream failure without removing scrolling or screen animations. The supplied framework-only stack trace cannot establish that every crash cluster has this cause; investigate any remaining clusters independently.

## Refresh control drawing-order crash

The separate `IndexOutOfBoundsException: getChildDrawingOrder() returned invalid index 2 (child count is 2)` matches an upstream `react-native-screens` defect in refresh controls during screen removal. Screens 4.16.0 inserts a temporary filler before the refresh spinner, moving the spinner's cached drawing index. If content is then removed before another measure pass, that cached index can exceed the remaining child count.

`patches/react-native-screens+4.16.0.patch` backports upstream PR #4519: append the filler rather than inserting it before the spinner. The filler remains necessary to preserve valid drawing indices during transitions. Pull-to-refresh and navigation animations remain enabled.

Screens is pinned to exactly 4.16.0 so the backport targets a reproducible source version. `postinstall` runs `patch-package --error-on-fail` to apply the patch after `npm install` / `npm ci`, including EAS installs. Include the `patches/` directory when copying shared source into school releases. Do not install with `--ignore-scripts` or omit the development dependency containing `patch-package` in native build jobs. Remove this backport only when upgrading to a compatible Screens release that contains the upstream fix.

### Native regression tests

With Java 17 and the Android SDK configured, and the Android project generated, run:

```sh
npm run test:android-rendering
```

This adds Robolectric tests to the Screens module through a Gradle init script, without editing generated Android files. One test reproduces the exception using the old filler placement and AndroidX's actual drawing-order cache. The other runs the installed Screens removal path and checks that the refresh control still draws after its content is removed before another measure pass. Both use real Android view behavior, rather than JavaScript animation mocks.

## Release

1. Install dependencies with `npm ci`; the lockfile must resolve Reanimated to 4.1.7.
   Confirm postinstall reports `react-native-screens@4.16.0` as successfully patched.
2. Build a **new Android binary** using the affected school's existing production EAS profile. Preserve that school's application ID and signing identity, and use a higher Android version code.
3. Test the binary through an internal testing track before the production rollout.
4. Release the fixed binary for every affected school application; changing the shared source does not update existing installations.

These fixes change Java, Kotlin, and C++ native code. An Expo OTA JavaScript update cannot deliver them to existing binaries. Do not treat an OTA publication as deployment of these fixes; `runtimeVersion` based on `sdkVersion` alone does not distinguish binaries containing different native dependency patches.

## Device verification

Use release builds on affected device models and Android versions from the Play issue details, including Android 15 and 16 where available.

- Repeatedly open Attendance, Students, Finance, Notifications, and the admin dashboard. Fling each list, then immediately press Back or change screens while scrolling continues.
- Open and close animated sheets or modals, then immediately navigate. Repeat while data is refreshing or list items are being added or removed.
- Start pull-to-refresh on a list and immediately navigate to another screen or press Back. Repeat with tabbed lists and while refreshing data removes or reorders rows; verify there is no invalid drawing-index exception.
- Check that headers still react to scrolling, touch targets remain usable, and back navigation works normally.
- Inspect Logcat for the two exceptions above and the separate `ReactViewGroup.drawChild` / `dispatchDraw` issues. Passing this test does not establish that those separate clusters share this cause.
- After rollout, filter Play Console crash reports by the **new version code**. Check whether affected users and new events drop for each cluster; the overall 28-day rate still contains older builds and historical crashes.

## Upstream references

- [Reanimated 4.1.7 release](https://github.com/software-mansion/react-native-reanimated/releases/tag/4.1.7)
- [Android draw-pass fix, PR #9072](https://github.com/software-mansion/react-native-reanimated/pull/9072)
- [4.1 backport, PR #9124](https://github.com/software-mansion/react-native-reanimated/pull/9124)
- [Matching animated-scroll reproduction, issue #8907](https://github.com/software-mansion/react-native-reanimated/issues/8907)
- [Screens refresh-control filler fix, PR #4519](https://github.com/software-mansion/react-native-screens/pull/4519)
- [Matching invalid drawing-index report, issue #4513](https://github.com/software-mansion/react-native-screens/issues/4513)
