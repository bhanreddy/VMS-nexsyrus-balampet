# Parent diary: Ask Gemini in Telugu

Parents can tap **Ask Gemini · Telugu** under a diary photo or in its full-screen viewer. The guide previews the selected photo, includes an editable Telugu question, and explains how to finish the request in Gemini. No school API key or Gemini API billing is involved.

- **Android:** Copy the question, create a JPEG, and use an Android `ACTION_SEND` intent containing `EXTRA_STREAM`, `EXTRA_TEXT`, `ClipData`, and temporary read permission. Resolve installed Gemini share targets in the Gemini app or a Gemini-labelled target in the Google app. Do not hardcode private activity names. If no direct target is available, show the system share menu. Some versions ignore the text extra; parents can paste the copied question.
- **iOS:** Copy the question and open the photo share sheet. Choose Gemini if its extension is available; otherwise save the photo and attach it in Gemini's app or website.
- **Web:** Provide separate Copy question, Save photo, and Open Gemini website actions. Attaching a local image and pasting the question remain user actions. No undocumented prompt or image URL parameters are used.

The parent reviews and submits the request in Gemini. Only the selected image and the parent's question are handed off; student identifiers and other diary pages are not appended. Gemini is disabled by default in the shared staff/admin viewer and enabled explicitly by the parent diary screen.

## Release and validation

`modules/diary-gemini-share` is an optional local Expo Android module discovered by Expo autolinking. Direct Android launching requires a new native app build; an OTA JavaScript update alone cannot add the module. Older binaries and Expo Go use the share menu. No new app-wide storage permission is needed.

Before release, smoke-test with Gemini installed, absent, disabled, and hosted by the Google app. Verify the image attachment, Telugu clipboard fallback, and final manual submission on a physical Android phone. Test iOS share-extension availability separately. Automated tests cover service fallbacks, cancellation, platform isolation, selected-page handoff, editable questions, and the optional module bridge; they do not establish how a particular installed Gemini version handles `EXTRA_TEXT`.

## References checked on 28 October 2026

- [Google: Upload and analyze files in Gemini](https://support.google.com/gemini/answer/14903178?hl=en&co=GENIE.Platform%3DAndroid)
- [Google: Upload files on iPhone/iPad](https://support.google.com/gemini/answer/14903178?hl=en&co=GENIE.Platform%3DiOS)
- [Android: Send data to other apps](https://developer.android.com/training/sharing/send)
- [Google Gemini's official Play Store listing](https://play.google.com/store/apps/details?id=com.google.android.apps.bard)
