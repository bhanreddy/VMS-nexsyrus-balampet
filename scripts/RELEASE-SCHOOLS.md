# Batch school releases

Run from `SchoolIMS-Frontend`. Requires Node.js 20+, Git, npm, the SSD mounted at
`/Volumes/PortableSSD`, GitHub push access through Git, and the project's dependencies
installed with `npm ci`. The runner uses the installed local EAS CLI. No `gh` command
is needed.

## Configure

Edit `scripts/school-release.config.json`:

- `sourceDir`, `ssdRoot`, and `outputRoot` are resolved relative to the config file.
- Each school has a key, SSD folder, GitHub repository, account group, production
  profile, and optional branch. `branch: null` discovers the remote default branch.
- Set `enabled: false` on a school to omit it from batches.
- `groupByAccount: true` groups schools to reduce account switching. Set it to false
  to follow the order of `schools` in the config.
- `accounts.<group>.username` is the actual Expo **login username**. Defaults were
  inferred from each SSD `app.json` owner. If you log in as an organization member,
  replace this with your member username. A project owner and a login username may
  differ.
- Assign a school's `account` to another configured group to use a different login.
  Add as many account groups as needed. GitHub authentication is separate and uses
  the normal Git credential helper or SSH agent.
- `preserveSourceVersion: true` keeps the master `app.json`'s `expo.version` while
  applying each school's app configuration. Android version codes use the school's
  existing EAS remote version and `autoIncrement: true`.
- Each school has an `expected` identity: owner, Expo project ID, Android package,
  and school ID. These are checked against the SSD app/profile files before any
  release work. Update these deliberately when moving or reconfiguring a school.

Account-specific files extend this shared configuration and restrict the batch to
one account. They contain only `extends` and `account`; school settings and login
usernames remain in the shared file. Paths continue to resolve relative to the
shared file. An account file cannot be overridden to release another account.

- `scripts/school-release.nexsyrus.json`: GHS, Global, Samskruthe, Slate, VMS.
- `scripts/school-release.nexsyrus1.json`: Bhashayam, Chaitanya, NMMS, Chanakya.
- `scripts/school-release.bhan_reddy.json`: Default/demo.

Signing credentials must already be configured for each school's EAS project;
noninteractive builds stop if credentials or access are missing. To configure them
manually, use `eas credentials --platform android` in that school's prepared workspace
while logged in to an account with access.

Logging into another account does not transfer an existing Expo project or change
its owner/billing. Its `extra.eas.projectId` must belong to the intended owner.
If a project has been transferred, update its SSD configuration to the actual
owner/project information first. The runner checks access with `eas project:info`
before pushing.

## Preview first

```bash
node scripts/release-schools.cjs --dry-run
```

This validates local inputs for the selected schools without changing login,
creating release folders, accessing GitHub, running prebuild, or submitting builds.
It cannot verify network access or remote signing credentials.

Preview checks the PNG signatures of the effective source and SSD assets. A JPEG
renamed to `.png` fails Android resource compilation; convert the file to PNG
before releasing. SSD overlays take precedence over source assets during this check.

## Run

Each account has its own command. All commands preview by default:

```bash
npm run release:nexsyrus
npm run release:nexsyrus1
npm run release:bhan-reddy
```

Append `-- --execute` to push and submit builds for that account:

```bash
npm run release:nexsyrus -- --execute
npm run release:nexsyrus1 -- --execute
npm run release:bhan-reddy -- --execute
```

For example, the `bhan_reddy` command:

```bash
# Preview only
npm run release:bhan-reddy

# Push and submit production AAB builds
npm run release:bhan-reddy -- --execute
```

This selects enabled schools whose `account` is `bhan_reddy` in the shared config.
Currently that is only `default` (`Default File` → `bhanreddy/IMS-frontend`, profile
`school-1-production`). It uses manual login as `bhan_reddy`. If a different username
is logged in, the script pauses for logout/login or a recheck. No password or token
needs to be added to the config.

To add another school to this batch, change its `account` in the shared config to
`bhan_reddy` after ensuring that login has access to the existing Expo project.
This does not change the project's SSD owner or project ID.

The equivalent generic command supports any configured account group:

```bash
node scripts/release-schools.cjs --account bhan_reddy --execute
```

An optional `--schools` list further narrows the batch. Schools outside the selected
account cause an error before any release work starts.

One school:

```bash
node scripts/release-schools.cjs --schools ghs --execute
```

Selected schools:

```bash
node scripts/release-schools.cjs --schools ghs,slate,samskruthe --execute
```

All enabled schools:

```bash
node scripts/release-schools.cjs --execute
```

Without `--execute`, the command always previews. With it, the command pushes to
the configured branches and submits production builds, which may consume EAS quota.
It does not submit AABs to Google Play.

The default config covers `ghs`, `global`, `samskruthe`, `slate`, `vms`, `bhashayam`,
`chaitanya`, `nmms`, `chanakya`, and `default`.

## Manual account switching

Before processing a school, the runner checks `eas whoami` against the configured
login username. When they differ, it pauses:

```text
[l] run EAS logout/login, [r] recheck after logging in elsewhere, [q] stop:
```

Type `l` to have the script run `eas logout` and `eas login`. Complete the standard
Expo login in the terminal/browser; the script never handles or stores your
password. It rechecks the username before continuing. Schools sharing the same
login continue without another checkpoint.

Alternatively, log in from another terminal, then type `r`. Use the same local
EAS CLI, for example from the frontend:

```bash
npx --no-install eas logout
npx --no-install eas login
```

The runner deliberately ignores an inherited `EXPO_TOKEN` for manual-login groups,
because a token overrides session login and prevents EAS logout/login from selecting
the intended account. The login selected at the end remains the active local login.

## Optional: avoid logout/login with one token per account

Set `tokenEnv` to an environment variable name, for example:

```json
"accounts": {
  "nexsyrus": { "username": "nexsyrus", "tokenEnv": "EXPO_TOKEN_NEXSYRUS" },
  "nexsyrus1": { "username": "nexsyrus1", "tokenEnv": "EXPO_TOKEN_NEXSYRUS1" },
  "bhan_reddy": { "username": "bhan_reddy", "tokenEnv": "EXPO_TOKEN_BHAN" }
}
```

Export the variables in the terminal using your Expo tokens. Store token values in
your password manager or environment, never in this JSON file. The selected token
is passed as `EXPO_TOKEN` only to that account's child processes. The script checks
the token's username and stops on a mismatch. Token groups can run without an
interactive terminal; manual groups require a terminal whenever login must change.

## What happens per release

1. Freeze the latest working frontend files, including tracked modifications and
   untracked files not ignored by Git. Deleted files stay deleted. The master source
   and its Git index are never changed. Avoid editing source/SSD files during this
   initial snapshot.
2. Freeze each school's overlays. `constants/` maps to `src/constants/`, `assets/`
   merges into `assets/`, and `app.json`, `eas.json`, optional `wrangler.jsonc`, and
   optional `google-services.json` replace their counterparts. Shared files absent
   from the SSD remain in the master copy. Every SSD constant overrides the matching
   master constant, so keep those school-scoped copies current too.
3. Read `.env` or, for VMS, `env`. SSD environment files must contain public Expo
   values only. The production profile wins on conflicting values. The resolved
   public values go into both a private workspace `.env` and the selected EAS
   profile, so local prebuild and remote compilation receive the same values.
4. Check the selected login. Clone the school's repo and preserve its history.
   Replace the clone's source with the frozen frontend plus school overlays.
   Files only present in the destination repo are removed from the new commit.
   Changes are committed and pushed normally; there is no force push. A concurrent
   remote change makes Git reject the push.
5. Install with `npm ci`, verify project access, push, then run the workspace's local
   `expo prebuild --platform android --clean --no-install`. Prebuild changing source
   files stops the run for inspection rather than uploading different source from
   the pushed commit.
6. Run `eas build --platform android --profile <school-profile> --non-interactive
   --no-wait --json`. Wait for upload and submission, save the build response, and
   continue. Cloud compilation can overlap with later submissions, subject to the
   account's EAS concurrency limits. Submitted does not mean successfully compiled.

Root generated native folders are excluded from Git and the EAS upload; EAS
regenerates native projects from the app configuration. Tracked native code inside
custom `modules/` is retained. `.env` files, `secrets/`, signing files, `credentials.json`,
`node_modules`, generated build output, `.DS_Store`, and AppleDouble files are excluded.
Other Git-tracked files and nonignored new files are included; inspect the frontend's
Git status before releases. A tracked `.npmrc` is excluded as well; private package
registry authentication needs to be provided separately.

## Resume and inspect

Each execution prints a run directory under `SchoolIMS/.school-releases/`. It holds
the frozen source and overlays, per-school Git working directories, private env
files, `<school>.build.json` responses, and `state.json` with commits, stages and build
links. Keep it private; completed run directories may be deleted once no longer
needed.

```bash
node scripts/release-schools.cjs --resume "/absolute/path/to/run-directory" --execute
```

Resume uses frozen inputs and selection, even if the SSD or master source changes.
It checks a snapshot digest, skips submitted schools, and continues incomplete
steps. Do not combine `--resume` with `--config`, `--schools` or `--account`. For an
account-scoped run, resume using the generic command above rather than the npm
account shortcut. To fix the login
mapping of an existing run, edit `config.accounts` in its `state.json`.

For an EAS build that was accepted and then failed during compilation, fix the
source/SSD inputs and start a new release run. Resume skips submitted schools and
retains their frozen assets, so it will not rebuild them with your corrections.

If a process was killed and left `running.lock`, inspect the PID/hostname in that
file and remove it only after verifying that process is no longer active.

If EAS was interrupted during submission, the build might already be queued. The
runner recovers a valid saved build response automatically. Otherwise it stops
instead of creating a duplicate. Check the Expo dashboard:

- If accepted, enter the known build in `state.json` under `progress.<key>.builds`
  as `[{"id":"actual-build-id","url":"actual-build-url","status":"IN_QUEUE"}]`
  and change that school's `phase` to `submitted`, then resume.
- Only after confirming **no build was accepted**, explicitly retry:

```bash
node scripts/release-schools.cjs --resume "/absolute/path/to/run-directory" \
  --retry-school ghs --execute
```

For a push rejected because the remote branch advanced, inspect the prepared
workspace and resolve its Git history normally, then set its new commit hash in
`state.json` at `progress.<key>.commit` before resuming. For source changes made by
prebuild, review/commit/push those changes in that workspace and update the same
commit field. The runner never force-pushes or silently discards a remote update.

## Verification

```bash
node --test scripts/release-schools.test.cjs
```

Tests use disposable local Git repositories and simulated EAS/npm commands. They
cover dirty-source capture, private file exclusion, custom native module preservation,
version preservation, environment precedence, safe dry runs, wrong-account blocking,
successful submission, resume skipping, and uncertain-upload recovery. They perform
no real GitHub pushes or Expo builds.
