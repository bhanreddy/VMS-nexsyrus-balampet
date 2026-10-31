# Building SchoolIMS APK/AAB Files (Multi-Tenant Guide)

For Android update banners, in-app downloads, required-update policy, and the two-version Google Play verification procedure, see [Google Play updates](docs/PLAY_STORE_UPDATES.md).

This guide takes NexSyrus developers step-by-step through the process of compiling Android Application Packages (APKs) for preview builds or App Bundles (AABs) for store deployment after seeding a new school in the Super Admin console.

## 1. Prerequisites
**Install Expo EAS CLI**
Ensure you have the EAS CLI globally configured on your machine.
```bash
npm install -g eas-cli
```

**Set Shared Environment Variables**
NexSyrus global API and Database values must be set in your terminal's shell profile (`~/.bashrc`, `~/.zshrc`, or Windows equivalent environment variables) so that they apply to all school builds.

```bash
export API_URL="https://api.nexsyrus.com"
export SUPABASE_URL="YOUR_GLOBAL_SUPABASE_URL"
export SUPABASE_ANON_KEY="YOUR_GLOBAL_SUPABASE_ANON_KEY"
```

> [!INFO]
> Ensure you run `source ~/.zshrc` (or restart your terminal) after saving those exports.

## 2. Compiling the School Build

After creating a new school in the Super Admin console (e.g. ID `5`, code `SMHS`, name `St. Mary's High School`), run the build script from the `testapp/` root directory.

### Preview Build (Internal APK)
```powershell
.\scripts\build-school.ps1 `
  -SchoolId 5 `
  -SchoolCode SMHS `
  -SchoolName "St. Mary's High School" `
  -Profile preview
```

### Production Build (Store AAB)
```powershell
.\scripts\build-school.ps1 `
  -SchoolId 5 `
  -SchoolCode SMHS `
  -SchoolName "St. Mary's High School" `
  -Profile production
```

> [!IMPORTANT]
> The script will temporarily overwrite your local `app.json` and `.env` files to inject the school's credentials into the build runtime, then restore `app.template.json` automatically once the payload is queued.

## 3. Delivering the Build

Once the EAS command is triggered, it will queue the build on Expo's remote servers. 
- You can monitor the progress directly in the terminal output.
- Or, track the live link provided by Expo (e.g. `https://expo.dev/accounts/nexsyrus/projects/schoolims/...`).
- When the compilation is done, you can download the generated `.apk` artifact to share internally, or deploy the `.aab` output to the Google Play Store console.

## 4. Troubleshooting

* **Missing API/Supabase URL Error:** Verify that your shell `export` profile works correctly. You can type `echo $API_URL` into your shell to confirm the value is active.
* **EAS Authentication Error:** You might not be logged in. Run `eas login` with the NexSyrus official organization credentials.
* **app.json Not Restored:** If the script fails catastrophically before firing the `trap EXIT`, you can manually restore `app.json` by copying it back from the template: `cp app.template.json app.json`.
