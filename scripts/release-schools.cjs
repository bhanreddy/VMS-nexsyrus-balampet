#!/usr/bin/env node
'use strict';

// No external dependencies. All commands use argument arrays, never a shell.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const readline = require('node:readline/promises');

function assert(ok, message) { if (!ok) throw new Error(message); }
function json(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function save(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(`${file}.tmp`, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(`${file}.tmp`, file);
}
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function inside(root, relative) {
  assert(typeof relative === 'string' && relative.length && !path.isAbsolute(relative), `Expected relative path: ${relative}`);
  const result = path.resolve(root, relative);
  assert(result.startsWith(`${path.resolve(root)}${path.sep}`), `Path escapes root: ${relative}`);
  return result;
}
function skip(file) {
  return file.split(/[\\/]/).some(p => p === '.DS_Store' || p.startsWith('._') ||
    ['.git', 'node_modules', '.expo', 'secrets', '.school-releases'].includes(p)) ||
    /^(android|ios|dist|web-build)\//.test(file) ||
    /(^|\/)(\.env(?:\..*)?|env|credentials\.json|\.npmrc)$/.test(file) ||
    /\.(?:jks|keystore|p8|p12|key|pem|mobileprovision)$/i.test(file);
}
function listFiles(root, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.name.startsWith('._') || entry.name === '.DS_Store') continue;
    assert(!entry.isSymbolicLink(), `Symlink not supported in release input: ${relative}`);
    if (entry.isDirectory()) out.push(...listFiles(root, relative));
    else if (entry.isFile()) out.push(relative);
  }
  return out;
}
function copyFile(from, to) {
  assert(fs.lstatSync(from).isFile(), `Not a regular file: ${from}`);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  fs.chmodSync(to, fs.statSync(from).mode & 0o777);
}
function copyTree(from, to) {
  if (fs.statSync(from).isFile()) return copyFile(from, to);
  for (const file of listFiles(from)) copyFile(inside(from, file), inside(to, file));
}
function command(bin, args, { cwd, env = process.env, capture = false, allowFailure = false } = {}) {
  const result = spawnSync(bin, args, { cwd, env, encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', maxBuffer: 64 * 1024 * 1024 });
  if (!allowFailure) assert(!result.error && result.status === 0,
    `${path.basename(bin)} ${args[0] || ''} failed (${result.status ?? result.error?.message}).${capture ? `\n${result.stderr || ''}` : ''}`);
  return result;
}
function git(cwd, args, options = {}) { return command('git', ['-C', cwd, ...args], { capture: true, ...options }); }
function sourceFiles(source) {
  const files = git(source, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).stdout.split('\0');
  return [...new Set(files)].filter(f => f && !skip(f) && fs.existsSync(inside(source, f))).sort();
}
function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    assert(match, 'Unsupported .env syntax; use one KEY=value per line.');
    let value = match[2].trim();
    if (value.startsWith('"')) {
      assert(/^".*"\s*(?:#.*)?$/.test(value), 'Multiline .env values are unsupported.');
      value = value.slice(1, value.lastIndexOf('"')).replace(/\\([\\"nr])/g,
        (_, escaped) => ({ n: '\n', r: '\r', '\\': '\\', '"': '"' })[escaped]);
    } else if (value.startsWith("'")) {
      assert(/^'.*'\s*(?:#.*)?$/.test(value), 'Multiline .env values are unsupported.');
      value = value.slice(1, value.lastIndexOf("'"));
    } else value = value.replace(/\s*#.*$/, '').trim();
    out[match[1]] = value;
  }
  return out;
}
function profileFor(eas, name, visited = new Set()) {
  assert(!visited.has(name), `EAS profile inheritance cycle: ${name}`);
  const own = eas.build?.[name];
  assert(own, `Missing EAS profile: ${name}`);
  visited.add(name);
  const parent = own.extends ? profileFor(eas, own.extends, visited) : {};
  return { ...parent, ...own, env: { ...parent.env, ...own.env }, android: { ...parent.android, ...own.android } };
}
function validatePngAssets(config, mapped, schoolKey) {
  // Validate the effective files: SSD overlays replace matching source assets.
  const files = new Map(sourceFiles(config.sourceDir).filter(f => /\.png$/i.test(f))
    .map(f => [f, inside(config.sourceDir, f)]));
  for (const { from, to } of mapped) if (/\.png$/i.test(to)) files.set(to, from);
  const signature = Buffer.from('89504e470d0a1a0a', 'hex');
  for (const [to, from] of files) {
    const header = Buffer.alloc(8);
    const fd = fs.openSync(from, 'r');
    let bytes;
    try { bytes = fs.readSync(fd, header, 0, header.length, 0); }
    finally { fs.closeSync(fd); }
    assert(bytes === signature.length && header.equals(signature),
      `${schoolKey}: ${to} is named .png but does not contain PNG data (${from}). Convert it to PNG; renaming a JPEG is insufficient.`);
  }
}
function inspectSchool(config, school) {
  assert(/^[a-z0-9][a-z0-9_-]*$/i.test(school.key), `Invalid school key: ${school.key}`);
  assert(config.accounts[school.account], `Unknown account group: ${school.account}`);
  assert(/^(https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?|git@github\.com:[\w.-]+\/[\w.-]+(?:\.git)?)$/.test(school.repo), `Invalid GitHub repo: ${school.key}`);
  const folder = inside(config.ssdRoot, school.folder);
  const overlays = school.overlays || config.overlays;
  const mapped = [];
  for (const overlay of overlays) {
    const from = inside(folder, overlay.from);
    inside(config.sourceDir, overlay.to);
    if (!fs.existsSync(from)) { assert(overlay.optional, `Missing overlay: ${from}`); continue; }
    assert(!fs.lstatSync(from).isSymbolicLink(), `Symlink overlay: ${from}`);
    const files = fs.statSync(from).isDirectory() ? listFiles(from) : [''];
    for (const file of files) {
      const to = file ? path.posix.join(overlay.to, file) : overlay.to;
      assert(!skip(to), `Excluded or private overlay destination: ${to}`);
      mapped.push({ from: file ? inside(from, file) : from, to });
    }
  }
  assert(mapped.some(f => f.to === 'app.json') && mapped.some(f => f.to === 'eas.json'), `${school.key}: app.json and eas.json overlays required`);
  validatePngAssets(config, mapped, school.key);
  const app = json(mapped.find(f => f.to === 'app.json').from).expo;
  const eas = json(mapped.find(f => f.to === 'eas.json').from);
  const profile = profileFor(eas, school.profile);
  assert(app?.android?.package && app?.extra?.eas?.projectId && app?.owner && app?.slug, `${school.key}: missing Android package, owner, slug or EAS project ID`);
  assert(profile.distribution === 'store' && profile.android.buildType === 'app-bundle' &&
    (!profile.android.gradleCommand || /bundle.*Release/.test(profile.android.gradleCommand)), `${school.key}: profile must produce a store AAB`);
  assert(eas.cli?.appVersionSource === 'remote' && profile.autoIncrement === true, `${school.key}: require remote versions and autoIncrement=true`);
  const envPath = ['.env', 'env'].map(f => inside(folder, f)).find(f => fs.existsSync(f));
  assert(envPath, `${school.key}: missing .env or env on SSD`);
  const diskEnv = parseEnv(fs.readFileSync(envPath, 'utf8'));
  assert(Object.keys(diskEnv).every(k => k.startsWith('EXPO_PUBLIC_')), `${school.key}: SSD env contains private variables; configure those in EAS instead`);
  const env = { ...diskEnv, ...profile.env };
  assert(/^\d+$/.test(env.EXPO_PUBLIC_SCHOOL_ID || '') && Number(env.EXPO_PUBLIC_SCHOOL_ID) > 0 &&
    env.EXPO_PUBLIC_SCHOOL_CODE && env.EXPO_PUBLIC_SCHOOL_NAME, `${school.key}: invalid school identity in profile/env`);
  const identity = { owner: app.owner, projectId: app.extra.eas.projectId,
    androidPackage: app.android.package, schoolId: String(env.EXPO_PUBLIC_SCHOOL_ID) };
  for (const [field, expected] of Object.entries(school.expected || {})) {
    assert(Object.hasOwn(identity, field), `${school.key}: unknown expected identity field ${field}`);
    assert(identity[field] === String(expected), `${school.key}: ${field} differs from the configured identity; check the SSD files and school mapping`);
  }
  const mismatches = Object.keys(profile.env).filter(k => k in diskEnv && String(profile.env[k]) !== diskEnv[k]);
  // EAS profile values win for both local prebuild and cloud build.
  const gsPath = mapped.find(f => f.to === (app.android.googleServicesFile || './google-services.json').replace(/^\.\//, ''))?.from ||
    path.resolve(config.sourceDir, app.android.googleServicesFile || 'google-services.json');
  assert(fs.existsSync(gsPath), `${school.key}: Firebase google-services.json missing`);
  assert(json(gsPath).client?.some(c => c.client_info?.android_client_info?.package_name === app.android.package),
    `${school.key}: no matching Android package in Firebase configuration`);
  return { ...school, folderPath: folder, app, env, mapped, mismatches };
}
function loadConfig(file, visited = new Set()) {
  file = path.resolve(file);
  assert(!visited.has(file), 'Release configuration inheritance cycle');
  visited.add(file);
  const config = json(file);
  const base = path.dirname(file);
  if (config.extends) {
    assert(typeof config.extends === 'string', 'Config extends must be a filename');
    assert(Object.keys(config).every(key => ['extends', 'account'].includes(key)), 'Account configs may only contain extends and account; edit school settings in the shared config');
    const parent = loadConfig(path.resolve(base, config.extends), visited);
    assert(!parent.account || !config.account || parent.account === config.account, 'Cannot override the account scope of a parent config');
    const account = config.account || parent.account;
    assert(account && Object.hasOwn(parent.accounts, account), `Unknown account group in config: ${account}`);
    return { ...parent, account };
  }
  for (const name of ['sourceDir', 'ssdRoot', 'outputRoot']) config[name] = path.resolve(base, config[name]);
  assert(config.outputRoot !== config.sourceDir && !config.outputRoot.startsWith(`${config.sourceDir}${path.sep}`), 'outputRoot must be outside the frontend source');
  assert(new Set(config.schools.map(s => s.key)).size === config.schools.length, 'Duplicate school keys');
  if (config.account) assert(Object.hasOwn(config.accounts, config.account), `Unknown account group in config: ${config.account}`);
  return config;
}
function snapshot(config, root, schools) {
  const dest = path.join(root, 'source');
  fs.mkdirSync(dest);
  for (const file of sourceFiles(config.sourceDir)) copyFile(inside(config.sourceDir, file), inside(dest, file));
  for (const school of schools) {
    const dir = path.join(root, 'overlays', school.key);
    for (const file of school.mapped) copyFile(file.from, inside(dir, file.to));
    fs.writeFileSync(path.join(dir, '.env'), Object.entries(school.env).map(([k, v]) => `${k}=${JSON.stringify(String(v))}`).join('\n') + '\n', { mode: 0o600 });
  }
  return dest;
}
function snapshotDigest(root) {
  const h = crypto.createHash('sha256');
  for (const dir of ['source', 'overlays']) {
    for (const file of listFiles(path.join(root, dir)).sort()) {
      h.update(`${dir}/${file}\0`); h.update(fs.readFileSync(path.join(root, dir, file)));
    }
  }
  return h.digest('hex');
}
function childEnv(extra = {}, token) {
  const env = { ...process.env };
  // A shell's previous school variables or EXPO_TOKEN must not leak into another school.
  for (const key of Object.keys(env)) if (key.startsWith('EXPO_PUBLIC_') || key.startsWith('EXPO_TOKEN') || key.startsWith('EAS_')) delete env[key];
  if (token) env.EXPO_TOKEN = token;
  return { ...env, EXPO_NO_TELEMETRY: '1', NO_COLOR: '1', ...extra };
}
async function ask(question) {
  assert(process.stdin.isTTY, 'Account switch requires an interactive terminal, or configure tokenEnv for this account.');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { return (await rl.question(question)).trim().toLowerCase(); } finally { rl.close(); }
}
function username(output) { return output.replace(/\x1b\[[0-9;]*m/g, '').trim().split(/\r?\n/)[0]?.split(/\s+/)[0]; }
async function authenticate(config, school, easBin) {
  const account = config.accounts[school.account];
  assert(account.username, `Set accounts.${school.account}.username to the Expo login username (which may differ from project owner)`);
  const token = account.tokenEnv ? process.env[account.tokenEnv] : undefined;
  assert(!account.tokenEnv || token, `Set the environment variable ${account.tokenEnv}`);
  const env = childEnv({}, token);
  for (;;) {
    const result = command(easBin, ['whoami'], { cwd: config.sourceDir, env, capture: true, allowFailure: true });
    if (result.status === 0 && username(result.stdout) === account.username) return env;
    assert(!token, `Token for ${school.account} must authenticate as ${account.username}; check ${account.tokenEnv}`);
    console.log(`\nAccount group: ${school.account}; required login: ${account.username}; project owner: ${school.app.owner}`);
    console.log(`Current login: ${result.status === 0 ? username(result.stdout) : 'not logged in / unavailable'}`);
    const answer = await ask('[l] run EAS logout/login, [r] recheck after logging in elsewhere, [q] stop: ');
    if (answer === 'q') throw new Error('Stopped at account checkpoint; resume this run later.');
    if (answer === 'l') {
      command(easBin, ['logout'], { cwd: config.sourceDir, env, allowFailure: true });
      command(easBin, ['login'], { cwd: config.sourceDir, env });
    }
  }
}
function prepare(config, root, school) {
  const work = path.join(root, 'work', school.key);
  assert(!fs.existsSync(work), `Workspace already exists: ${work}. Use --resume.`);
  fs.mkdirSync(path.dirname(work), { recursive: true });
  command('git', ['clone', '--single-branch', ...(school.branch ? ['--branch', school.branch] : []), school.repo, work]);
  const branch = git(work, ['branch', '--show-current']).stdout.trim();
  assert(branch, `${school.key}: remote has no default branch; create it or configure branch`);
  for (const entry of fs.readdirSync(work)) if (entry !== '.git') fs.rmSync(path.join(work, entry), { recursive: true, force: true });
  copyTree(path.join(root, 'source'), work);
  copyTree(path.join(root, 'overlays', school.key), work);
  // .env is private to the workspace. Persist its public values in the selected
  // EAS profile too, so remote compilation sees the same values as prebuild.
  const easFile = path.join(work, 'eas.json');
  const eas = json(easFile);
  eas.build[school.profile].env = { ...eas.build[school.profile].env,
    ...parseEnv(fs.readFileSync(path.join(work, '.env'), 'utf8')) };
  fs.writeFileSync(easFile, `${JSON.stringify(eas, null, 2)}\n`);
  if (config.preserveSourceVersion) {
    const app = json(path.join(work, 'app.json'));
    app.expo.version = json(path.join(root, 'source', 'app.json')).expo.version;
    fs.writeFileSync(path.join(work, 'app.json'), `${JSON.stringify(app, null, 2)}\n`);
  }
  // Ensure no environment files enter Git or the EAS upload, even with a custom .easignore.
  for (const name of ['.gitignore', '.easignore']) {
    const p = path.join(work, name);
    if (name === '.easignore' && !fs.existsSync(p)) continue;
    fs.appendFileSync(p, '\n# Batch release private/generated files\n.env\n.env.*\n/secrets/\n/credentials.json\n/node_modules/\n/android/\n/ios/\n');
  }
  git(work, ['add', '-A']);
  const staged = git(work, ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']).stdout.split('\0').filter(Boolean);
  assert(!staged.some(skip), 'Private or generated files staged; inspect the release workspace.');
  if (git(work, ['diff', '--cached', '--quiet'], { allowFailure: true }).status !== 0) {
    git(work, ['commit', '-m', `Release ${school.key} from SchoolIMS (${path.basename(root)})`], { capture: false });
  }
  return { work, branch, commit: git(work, ['rev-parse', 'HEAD']).stdout.trim() };
}
function parseBuilds(stdout, school) {
  const builds = JSON.parse(stdout);
  assert(Array.isArray(builds) && builds.length > 0, 'EAS did not return a build array');
  for (const build of builds) {
    assert(build.id && build.platform === 'ANDROID', 'EAS returned an invalid Android build');
    if (build.project?.id) assert(build.project.id === school.app.extra.eas.projectId, 'EAS returned a different project');
  }
  return builds.map(b => ({ id: b.id, status: b.status,
    url: `https://expo.dev/accounts/${school.app.owner}/projects/${school.app.slug}/builds/${b.id}` }));
}
function options(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (['--config', '--account', '--schools', '--resume', '--retry-school'].includes(arg)) {
      assert(argv[i + 1] && !argv[i + 1].startsWith('--'), `Missing value for ${arg}`);
      out[arg.slice(2)] = argv[++i];
    } else {
      assert(['--execute', '--dry-run', '--help'].includes(arg), `Unknown argument: ${arg}`);
      out[arg.slice(2)] = true;
    }
  }
  assert(!(out.execute && out['dry-run']), 'Use either --execute or --dry-run');
  assert(!out['retry-school'] || (out.resume && out.execute), '--retry-school requires --resume and --execute');
  return out;
}
async function main(argv = process.argv.slice(2)) {
  const opt = options(argv);
  if (opt.help) {
    console.log('Usage: node scripts/release-schools.cjs [--config FILE] [--account GROUP] [--schools ghs,slate] [--execute]\n' +
      'Default: validate and print plan only.\n' +
      'Resume: --resume /absolute/run-directory --execute\n' +
      'After verifying an uncertain EAS submission was NOT accepted: --resume DIR --retry-school KEY --execute');
    return;
  }
  let config; let schools; let state; let root;
  if (opt.resume) {
    assert(!opt.config && !opt.schools && !opt.account, 'Resume uses the original frozen configuration and selection; omit --config, --schools and --account');
    root = path.resolve(opt.resume);
    state = json(path.join(root, 'state.json'));
    config = state.config; schools = state.schools;
    assert(state.digest === snapshotDigest(root), 'Release snapshot changed; refuse to resume');
  } else {
    config = loadConfig(path.resolve(opt.config || path.join(__dirname, 'school-release.config.json')));
    assert(!config.account || !opt.account || config.account === opt.account,
      `This config is scoped to ${config.account}; cannot select account ${opt.account}`);
    opt.account ||= config.account;
    if (opt.account) assert(Object.hasOwn(config.accounts, opt.account), `Unknown account group: ${opt.account}`);
    const selected = opt.schools?.split(',');
    if (selected) for (const key of selected) {
      const school = config.schools.find(s => s.key === key);
      assert(school, `Unknown school: ${key}`);
      assert(!opt.account || school.account === opt.account, `${key} is assigned to ${school.account}, outside selected account ${opt.account}`);
    }
    schools = config.schools.filter(s => s.enabled !== false && (!opt.account || s.account === opt.account) &&
      (!selected || selected.includes(s.key))).map(s => inspectSchool(config, s));
    assert(schools.length, `No enabled schools selected${opt.account ? ` for account ${opt.account}` : ''}`);
    if (config.groupByAccount) schools.sort((a, b) => a.account.localeCompare(b.account));
    sourceFiles(config.sourceDir); // Validate source Git checkout before any mutation.
    assert(fs.existsSync(path.join(config.sourceDir, 'package-lock.json')), 'package-lock.json required for npm ci');
  }
  if (opt.account) console.log(`Account scope: ${opt.account} (${schools.length} school${schools.length === 1 ? '' : 's'})\n`);
  for (const s of schools) {
    console.log(`${s.key}: ${s.repo}\n  owner=${s.app.owner}; login=${config.accounts[s.account]?.username}; profile=${s.profile}; package=${s.app.android.package}`);
    if (s.mismatches.length) console.log(`  SSD .env differs from EAS profile: ${s.mismatches.join(', ')}. Profile values win.`);
  }
  if (!opt.execute) { console.log('\nDry run complete. No login changes, GitHub pushes, prebuilds or EAS builds performed.'); return; }
  const easBin = path.join(config.sourceDir, 'node_modules', '.bin', 'eas');
  assert(fs.existsSync(easBin), 'Run npm ci in SchoolIMS-Frontend first (local EAS CLI required).');
  command('npm', ['--version'], { capture: true });
  if (!root) {
    fs.mkdirSync(config.outputRoot, { recursive: true, mode: 0o700 });
    root = fs.mkdtempSync(path.join(config.outputRoot, `${new Date().toISOString().replace(/[:.]/g, '-')}-`));
    fs.chmodSync(root, 0o700);
    snapshot(config, root, schools);
    // Do not persist public env or source SSD paths in state; those are in the frozen overlay files.
    schools = schools.map(({ env, mapped, ...s }) => s);
    state = { version: 1, config, schools, digest: snapshotDigest(root), progress: {} };
    save(path.join(root, 'state.json'), state);
  }
  console.log(`\nRelease run: ${root}`);
  const lock = path.join(root, 'running.lock');
  assert(!fs.existsSync(lock), `Run is locked: ${lock}. If its process is no longer running, remove this lock before resuming.`);
  fs.writeFileSync(lock, `${process.pid}\n${os.hostname()}\n`, { flag: 'wx', mode: 0o600 });
  const persist = () => save(path.join(root, 'state.json'), state);
  try {
    for (const school of schools) {
      let progress = state.progress[school.key] ||= {};
      if (progress.phase === 'submitted') { console.log(`Skip ${school.key}: already submitted ${progress.builds.map(b => b.url).join(', ')}`); continue; }
      if (progress.phase === 'submitting') {
        const output = path.join(root, `${school.key}.build.json`);
        if (fs.existsSync(output)) {
          try {
            progress.builds = parseBuilds(fs.readFileSync(output, 'utf8'), school);
            progress.phase = 'submitted'; persist(); console.log(`Recovered submitted build: ${school.key}`); continue;
          } catch { /* Uncertain submission: never blindly retry. */ }
        }
        assert(opt['retry-school'] === school.key, `${school.key}: previous EAS submission may have succeeded. Check Expo dashboard and ${output}. If NOT accepted, resume with --retry-school ${school.key}; otherwise record its build in the state file as documented.`);
        progress.phase = 'prebuilt'; persist();
      }
      console.log(`\n=== ${school.key} ===`);
      const authEnv = await authenticate(config, school, easBin);
      if (!progress.work) {
        progress.phase = 'preparing'; persist();
        const unfinishedWork = path.join(root, 'work', school.key);
        // Nothing has been pushed in this phase. A failed clone/commit can be
        // rebuilt solely from the frozen inputs without touching the source.
        if (fs.existsSync(unfinishedWork)) fs.rmSync(unfinishedWork, { recursive: true, force: true });
        Object.assign(progress, prepare(config, root, school), { phase: 'prepared' }); persist();
      }
      const work = progress.work;
      assert(git(work, ['rev-parse', 'HEAD']).stdout.trim() === progress.commit, 'Release commit changed; refusing to continue');
      if (progress.phase === 'prepared') {
        command('npm', ['ci', '--no-audit', '--no-fund'], { cwd: work, env: authEnv });
        // Check access to the existing project before pushing or consuming build credits.
        command(easBin, ['project:info'], { cwd: work, env: authEnv });
        command('git', ['-C', work, 'push', 'origin', `HEAD:refs/heads/${progress.branch}`]);
        progress.phase = 'pushed'; persist();
      }
      const buildEnv = { ...authEnv, ...parseEnv(fs.readFileSync(path.join(work, '.env'), 'utf8')), CI: '1' };
      if (progress.phase === 'pushed') {
        command(path.join(work, 'node_modules', '.bin', 'expo'), ['prebuild', '--platform', 'android', '--clean', '--no-install'], { cwd: work, env: buildEnv });
        progress.phase = 'prebuilt'; persist();
      }
      if (progress.phase === 'prebuilt') {
        assert(git(work, ['status', '--porcelain', '--untracked-files=all']).stdout.trim() === '',
          `Prebuild changed tracked/untracked source in ${work}. Review changes, commit/push them, and update state.commit before resuming.`);
        progress.phase = 'submitting'; persist();
        const output = path.join(root, `${school.key}.build.json`);
        const fd = fs.openSync(output, 'w', 0o600);
        console.log(`Uploading ${school.key}; build response: ${output}`);
        let result;
        try {
          result = spawnSync(easBin, ['build', '--platform', 'android', '--profile', school.profile,
            '--non-interactive', '--no-wait', '--json'], { cwd: work, env: buildEnv, stdio: ['ignore', fd, 'inherit'] });
        } finally { fs.closeSync(fd); }
        assert(!result.error && result.status === 0, `${school.key}: EAS failed or was interrupted. Resume will require checking whether Expo accepted the build.`);
        progress.builds = parseBuilds(fs.readFileSync(output, 'utf8'), school);
        progress.phase = 'submitted'; persist();
        for (const build of progress.builds) console.log(`Submitted: ${build.url}`);
      }
    }
    console.log(`\nAll selected schools submitted. Build links and progress: ${path.join(root, 'state.json')}`);
  } finally { fs.rmSync(lock, { force: true }); }
}
module.exports = { parseEnv, profileFor, inspectSchool, loadConfig, options, childEnv, parseBuilds, sourceFiles, prepare, snapshot, snapshotDigest, main };
if (require.main === module) main().catch(error => { console.error(`\nStopped: ${error.message}`); process.exitCode = 1; });
