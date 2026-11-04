'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { parseEnv, profileFor, childEnv, parseBuilds, loadConfig, inspectSchool } = require('./release-schools.cjs');
const runner = path.join(__dirname, 'release-schools.cjs');

function write(file, content, executable = false) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  if (executable) fs.chmodSync(file, 0o755);
}
function run(bin, args, opts = {}) {
  const result = spawnSync(bin, args, { encoding: 'utf8', ...opts });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout.trim();
}
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'school-release-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source');
  const ssd = path.join(root, 'ssd');
  const bin = path.join(root, 'bin');
  const remote = path.join(root, 'remote.git');
  const repo = 'https://github.com/test/school.git';
  const app = { expo: { name: 'School', owner: 'owner', slug: 'school', version: '1.0.0',
    android: { package: 'com.test.school' }, extra: { eas: { projectId: 'project-id' } } } };
  const eas = { cli: { appVersionSource: 'remote' }, build: {
    tenant: { env: { EXPO_PUBLIC_SCHOOL_ID: '7', EXPO_PUBLIC_SCHOOL_CODE: 'S7', EXPO_PUBLIC_SCHOOL_NAME: 'School' } },
    production: { extends: 'tenant', distribution: 'store', autoIncrement: true, android: { buildType: 'app-bundle' } }
  } };
  write(path.join(source, 'app.json'), { expo: { ...app.expo, version: '5.1.9' } });
  write(path.join(source, 'eas.json'), eas);
  write(path.join(source, 'package.json'), { name: 'test', version: '1.0.0' });
  write(path.join(source, 'package-lock.json'), {});
  write(path.join(source, '.gitignore'), 'node_modules/\n.env\n/android/\n');
  write(path.join(source, 'google-services.json'), { client: [{ client_info: { android_client_info: { package_name: 'com.test.school' } } }] });
  write(path.join(source, 'common.txt'), 'original');
  write(path.join(source, 'obsolete.txt'), 'remove in next release');
  write(path.join(source, 'modules', 'custom', 'android', 'NativeModule.kt'), 'native module code');
  run('git', ['init', '-b', 'main', source]);
  run('git', ['-C', source, 'config', 'user.name', 'Fixture']);
  run('git', ['-C', source, 'config', 'user.email', 'fixture@example.invalid']);
  run('git', ['-C', source, 'add', '.']);
  run('git', ['-C', source, 'commit', '-m', 'base']);
  run('git', ['clone', '--bare', source, remote]);
  // Release must include uncommitted and untracked source, without committing it.
  write(path.join(source, 'common.txt'), 'dirty latest code');
  fs.unlinkSync(path.join(source, 'obsolete.txt'));
  write(path.join(source, 'new-module.txt'), 'untracked feature');
  write(path.join(source, '.env'), 'EXPO_PUBLIC_SCHOOL_ID=WRONG\nPRIVATE_SECRET=do-not-copy');
  write(path.join(ssd, 'school', 'app.json'), app);
  write(path.join(ssd, 'school', 'eas.json'), eas);
  write(path.join(ssd, 'school', 'env'), 'EXPO_PUBLIC_SCHOOL_ID=99\nEXPO_PUBLIC_EXTRA="logo value"');
  write(path.join(ssd, 'school', 'constants', 'schoolConfig.ts'), 'export const school = 7;');
  write(path.join(ssd, 'school', 'constants', '._junk'), 'ignore AppleDouble');
  const config = { sourceDir: source, ssdRoot: ssd, outputRoot: path.join(root, 'runs'), groupByAccount: true, preserveSourceVersion: true,
    accounts: { group: { username: 'tester', tokenEnv: 'RELEASE_TEST_TOKEN' } },
    overlays: [{ from: 'app.json', to: 'app.json' }, { from: 'eas.json', to: 'eas.json' }, { from: 'constants', to: 'src/constants' }],
    schools: [{ key: 'test', folder: 'school', repo, account: 'group', profile: 'production', branch: null }] };
  const configFile = path.join(root, 'config.json'); write(configFile, config);
  const realGit = run('which', ['git']);
  write(path.join(bin, 'git'), `#!/usr/bin/env node
const {spawnSync}=require('node:child_process');
const args=process.argv.slice(2).map(a=>a===${JSON.stringify(repo)}?process.env.MOCK_REMOTE:a);
const r=spawnSync(${JSON.stringify(realGit)},args,{stdio:'inherit'});process.exit(r.status??1);
`, true);
  write(path.join(bin, 'npm'), `#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path');
if(process.argv[2]==='--version'){console.log('10.0');process.exit(0);}
const p=path.join(process.cwd(),'node_modules/.bin/expo');fs.mkdirSync(path.dirname(p),{recursive:true});
fs.writeFileSync(p,'#!/usr/bin/env node\\nprocess.exit(0);\\n');fs.chmodSync(p,0o755);
`, true);
  write(path.join(source, 'node_modules', '.bin', 'eas'), `#!/usr/bin/env node
const fs=require('node:fs');
const cmd=process.argv[2];
if(cmd==='whoami'){console.log(process.env.EXPO_TOKEN==='good-token'?'tester':'wrong-user');}
else if(cmd==='project:info'){console.log('existing project');}
else if(cmd==='build'){
 fs.appendFileSync(process.env.MOCK_BUILD_CALLS,JSON.stringify({args:process.argv.slice(2),envSchool:process.env.EXPO_PUBLIC_SCHOOL_ID})+'\\n');
 if(process.env.MOCK_FAIL_BUILD==='1'){console.log('partial response');process.exit(1);}
 console.log(JSON.stringify([{id:'build-id',platform:'ANDROID',project:{id:'project-id'},status:'IN_QUEUE'}]));
}else{console.error('Unexpected EAS command');process.exit(1);}
`, true);
  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, MOCK_REMOTE: remote,
    RELEASE_TEST_TOKEN: 'good-token', MOCK_BUILD_CALLS: path.join(root, 'build-calls'),
    GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' };
  return { root, source, remote, configFile, env, config };
}
test('profile inheritance and dotenv parsing, including quoted comments', () => {
  assert.deepEqual(parseEnv('export A="value # literal"\nB=unquoted # comment\nC=\'single\'\n'), { A: 'value # literal', B: 'unquoted', C: 'single' });
  assert.deepEqual(profileFor({ build: { a: { env: { ID: '1', X: 'base' }, android: { buildType: 'apk' } }, b: { extends: 'a', env: { X: 'child' }, android: { buildType: 'app-bundle' } } } }, 'b').env, { ID: '1', X: 'child' });
  assert.throws(() => profileFor({ build: { a: { extends: 'a' } } }, 'a'), /cycle/);
});
test('inherited auth and school environment are removed', () => {
  const old = process.env.EXPO_TOKEN;
  process.env.EXPO_TOKEN = 'stale-token';
  try { assert.equal(childEnv().EXPO_TOKEN, undefined); assert.equal(childEnv({}, 'selected').EXPO_TOKEN, 'selected'); }
  finally { if (old === undefined) delete process.env.EXPO_TOKEN; else process.env.EXPO_TOKEN = old; }
});
test('build response must contain the expected Android project', () => {
  assert.throws(() => parseBuilds('[{"id":"x","platform":"IOS"}]', {}), /Android/);
  assert.throws(() => parseBuilds('[{"id":"x","platform":"ANDROID","project":{"id":"wrong"}}]', { app: { extra: { eas: { projectId: 'expected' } } } }), /different project/);
});
test('dry run performs no external commands or creates release workspaces', t => {
  const f = fixture(t);
  const result = spawnSync(process.execPath, [runner, '--config', f.configFile], { env: f.env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Dry run complete/);
  assert.equal(fs.existsSync(path.join(f.root, 'runs')), false);
  assert.equal(fs.existsSync(f.env.MOCK_BUILD_CALLS), false);
});
test('PNG validation follows overlay precedence and blocks mislabeled assets before release', t => {
  const f = fixture(t);
  const relative = 'assets/images/icon.png';
  const sourceIcon = path.join(f.source, relative);
  const overlayIcon = path.join(f.config.ssdRoot, 'school', relative);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
  fs.mkdirSync(path.dirname(sourceIcon), { recursive: true });
  fs.writeFileSync(sourceIcon, jpeg);
  assert.throws(() => inspectSchool(f.config, f.config.schools[0]), /does not contain PNG data/);
  fs.mkdirSync(path.dirname(overlayIcon), { recursive: true });
  fs.writeFileSync(overlayIcon, png);
  f.config.overlays.push({ from: 'assets', to: 'assets' });
  inspectSchool(f.config, f.config.schools[0]); // The valid overlay replaces the invalid source.
  fs.writeFileSync(sourceIcon, png);
  fs.writeFileSync(overlayIcon, jpeg);
  write(f.configFile, f.config);
  for (const args of [[], ['--execute']]) {
    const result = spawnSync(process.execPath, [runner, '--config', f.configFile, ...args], { env: f.env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /assets\/images\/icon\.png.*does not contain PNG data/);
  }
  assert.equal(fs.existsSync(path.join(f.root, 'runs')), false);
  assert.equal(fs.existsSync(f.env.MOCK_BUILD_CALLS), false);
});
test('full release preserves source, pushes overlay, submits once, resumes without duplicates', t => {
  const f = fixture(t);
  const accountConfig = path.join(f.root, 'accounts', 'group.json');
  write(accountConfig, { extends: '../config.json', account: 'group' });
  const before = run('git', ['-C', f.source, 'status', '--porcelain']);
  const result = spawnSync(process.execPath, [runner, '--config', accountConfig, '--execute'], { env: f.env, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const dir = path.join(f.root, 'runs', fs.readdirSync(path.join(f.root, 'runs'))[0]);
  const state = JSON.parse(fs.readFileSync(path.join(dir, 'state.json')));
  const narrowedResume = spawnSync(process.execPath, [runner, '--resume', dir, '--account', 'group', '--execute'], { env: f.env, encoding: 'utf8' });
  assert.equal(narrowedResume.status, 1);
  assert.match(narrowedResume.stderr, /original frozen configuration and selection/);
  assert.equal(state.progress.test.phase, 'submitted');
  assert.equal(run('git', ['--git-dir', f.remote, 'show', 'main:common.txt']), 'dirty latest code');
  assert.equal(run('git', ['--git-dir', f.remote, 'show', 'main:new-module.txt']), 'untracked feature');
  assert.equal(run('git', ['--git-dir', f.remote, 'show', 'main:modules/custom/android/NativeModule.kt']), 'native module code');
  assert.equal(JSON.parse(run('git', ['--git-dir', f.remote, 'show', 'main:app.json'])).expo.version, '5.1.9');
  const eas = JSON.parse(run('git', ['--git-dir', f.remote, 'show', 'main:eas.json']));
  assert.equal(eas.build.production.env.EXPO_PUBLIC_SCHOOL_ID, '7');
  assert.equal(eas.build.production.env.EXPO_PUBLIC_EXTRA, 'logo value');
  const releasedFiles = run('git', ['--git-dir', f.remote, 'ls-tree', '-r', '--name-only', 'main']).split('\n');
  assert.equal(releasedFiles.includes('.env'), false);
  assert.equal(releasedFiles.includes('obsolete.txt'), false);
  assert.equal(run('git', ['-C', f.source, 'status', '--porcelain']), before);
  const calls = fs.readFileSync(f.env.MOCK_BUILD_CALLS, 'utf8').trim().split('\n').map(JSON.parse);
  assert.ok(calls[0].args.includes('--no-wait'));
  assert.equal(calls[0].envSchool, '7');
  run(process.execPath, [runner, '--resume', dir, '--execute'], { env: f.env });
  assert.equal(fs.readFileSync(f.env.MOCK_BUILD_CALLS, 'utf8').trim().split('\n').length, 1);
});
test('uncertain upload requires explicit retry after reconciliation', t => {
  const f = fixture(t);
  const failed = spawnSync(process.execPath, [runner, '--config', f.configFile, '--execute'], { env: { ...f.env, MOCK_FAIL_BUILD: '1' }, encoding: 'utf8' });
  assert.equal(failed.status, 1);
  const dir = path.join(f.root, 'runs', fs.readdirSync(path.join(f.root, 'runs'))[0]);
  const refused = spawnSync(process.execPath, [runner, '--resume', dir, '--execute'], { env: f.env, encoding: 'utf8' });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /may have succeeded/);
  assert.equal(fs.readFileSync(f.env.MOCK_BUILD_CALLS, 'utf8').trim().split('\n').length, 1);
  run(process.execPath, [runner, '--resume', dir, '--retry-school', 'test', '--execute'], { env: f.env });
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'state.json'))).progress.test.phase, 'submitted');
});
test('wrong-account token blocks push and build', t => {
  const f = fixture(t);
  const original = run('git', ['--git-dir', f.remote, 'rev-parse', 'main']);
  const result = spawnSync(process.execPath, [runner, '--config', f.configFile, '--execute'], { env: { ...f.env, RELEASE_TEST_TOKEN: 'bad-token' }, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must authenticate as/);
  assert.equal(run('git', ['--git-dir', f.remote, 'rev-parse', 'main']), original);
  assert.equal(fs.existsSync(f.env.MOCK_BUILD_CALLS), false);
});
test('resume refuses modified frozen inputs', t => {
  const f = fixture(t);
  const result = spawnSync(process.execPath, [runner, '--config', f.configFile, '--execute'], { env: { ...f.env, RELEASE_TEST_TOKEN: 'bad-token' }, encoding: 'utf8' });
  assert.equal(result.status, 1);
  const dir = path.join(f.root, 'runs', fs.readdirSync(path.join(f.root, 'runs'))[0]);
  write(path.join(dir, 'source', 'common.txt'), 'tampered');
  const resumed = spawnSync(process.execPath, [runner, '--resume', dir, '--execute'], { env: f.env, encoding: 'utf8' });
  assert.equal(resumed.status, 1);
  assert.match(resumed.stderr, /snapshot changed/);
  assert.equal(fs.existsSync(f.env.MOCK_BUILD_CALLS), false);
});
test('account selection skips unrelated SSD inputs and includes newly assigned schools', t => {
  const f = fixture(t);
  f.config.accounts.other = { username: 'someone' };
  f.config.schools.push({ ...f.config.schools[0], key: 'unrelated', account: 'other', folder: 'not-mounted' });
  write(f.configFile, f.config);
  const preview = run(process.execPath, [runner, '--config', f.configFile, '--account', 'group'], { env: f.env });
  assert.match(preview, /Account scope: group \(1 school\)/);
  assert.doesNotMatch(preview, /unrelated:/);
  f.config.schools.push({ ...f.config.schools[0], key: 'newly-assigned' });
  write(f.configFile, f.config);
  const updated = run(process.execPath, [runner, '--config', f.configFile, '--account', 'group'], { env: f.env });
  assert.match(updated, /Account scope: group \(2 schools\)/);
  assert.match(updated, /newly-assigned:/);
  assert.equal(fs.existsSync(path.join(f.root, 'runs')), false);
});
test('unknown account and explicit schools outside account fail before execution', t => {
  const f = fixture(t);
  f.config.accounts.other = { username: 'someone' };
  write(f.configFile, f.config);
  for (const [args, expected] of [
    [['--account', 'missing'], /Unknown account group/],
    [['--account', 'other', '--schools', 'test'], /outside selected account/],
    [['--account', 'other'], /No enabled schools selected for account other/],
  ]) {
    const result = spawnSync(process.execPath, [runner, '--config', f.configFile, ...args, '--execute'], { env: f.env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, expected);
  }
  assert.equal(fs.existsSync(path.join(f.root, 'runs')), false);
  assert.equal(fs.existsSync(f.env.MOCK_BUILD_CALLS), false);
});
test('account config paths resolve against the shared config and scope cannot be overridden', t => {
  const f = fixture(t);
  const child = path.join(f.root, 'accounts', 'group.json');
  f.config.sourceDir = './source'; f.config.ssdRoot = './ssd'; f.config.outputRoot = './runs';
  f.config.accounts.other = { username: 'someone' };
  f.config.schools.push({ ...f.config.schools[0], key: 'unrelated', account: 'other', folder: 'not-mounted' });
  write(f.configFile, f.config);
  write(child, { extends: '../config.json', account: 'group' });
  const resolved = loadConfig(child);
  assert.equal(resolved.sourceDir, f.source);
  assert.equal(resolved.ssdRoot, path.join(f.root, 'ssd'));
  assert.equal(resolved.outputRoot, path.join(f.root, 'runs'));
  const preview = run(process.execPath, [runner, '--config', child], { env: f.env });
  assert.match(preview, /Account scope: group \(1 school\)/);
  assert.doesNotMatch(preview, /unrelated:/);
  const refused = spawnSync(process.execPath, [runner, '--config', child, '--account', 'other', '--execute'], { env: f.env, encoding: 'utf8' });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /cannot select account other/);
  assert.equal(fs.existsSync(path.join(f.root, 'runs')), false);
});
test('account configs reject invalid groups, inheritance cycles and ambiguous overrides', t => {
  const f = fixture(t);
  const child = path.join(f.root, 'account.json');
  write(child, { extends: './config.json', account: 'typo' });
  assert.throws(() => loadConfig(child), /Unknown account group/);
  write(child, { extends: './account.json', account: 'group' });
  assert.throws(() => loadConfig(child), /inheritance cycle/);
  write(child, { extends: './config.json', account: 'group', schools: [] });
  assert.throws(() => loadConfig(child), /only contain extends and account/);
});
test('pinned identities reject wrong owners, project IDs, Android packages and school IDs', t => {
  const f = fixture(t);
  const valid = { owner: 'owner', projectId: 'project-id', androidPackage: 'com.test.school', schoolId: '7' };
  inspectSchool(f.config, { ...f.config.schools[0], expected: valid });
  for (const field of Object.keys(valid)) {
    assert.throws(() => inspectSchool(f.config, { ...f.config.schools[0], expected: { ...valid, [field]: 'wrong' } }),
      new RegExp(`${field} differs`));
  }
});
test('checked-in account configs cover each school once with unique pinned identities', () => {
  const shared = loadConfig(path.join(__dirname, 'school-release.config.json'));
  const groups = { nexsyrus: ['ghs', 'global', 'samskruthe', 'slate', 'vms'],
    nexsyrus1: ['bhashayam', 'chaitanya', 'nmms', 'chanakya'], bhan_reddy: ['default'] };
  const all = [];
  for (const [account, keys] of Object.entries(groups)) {
    const config = loadConfig(path.join(__dirname, `school-release.${account}.json`));
    assert.equal(config.account, account);
    assert.equal(config.accounts[account].username, account);
    assert.equal(config.accounts[account].tokenEnv, null);
    assert.equal(config.sourceDir, path.dirname(__dirname));
    const schools = config.schools.filter(s => s.account === account);
    assert.deepEqual(schools.map(s => s.key), keys);
    for (const s of schools) {
      assert.equal(s.expected.owner, account);
      assert.match(s.expected.projectId, /^[0-9a-f-]{36}$/);
      assert.equal(s.profile, `school-${s.expected.schoolId}-production`);
      assert.ok(s.expected.androidPackage);
    }
    all.push(...schools);
  }
  assert.equal(all.length, shared.schools.length);
  for (const field of ['key', 'folder', 'repo']) assert.equal(new Set(all.map(s => s[field])).size, all.length);
  for (const field of ['projectId', 'androidPackage', 'schoolId']) assert.equal(new Set(all.map(s => s.expected[field])).size, all.length);
});
test('Git-only pushes school files without EAS, npm or prebuild and resume remains Git-only', t => {
  const f = fixture(t);
  const before = run('git', ['-C', f.source, 'status', '--porcelain']);
  fs.rmSync(path.join(f.source, 'node_modules'), { recursive: true, force: true });
  // Any attempted npm invocation fails; Expo/EAS executables do not exist.
  write(path.join(f.root, 'bin', 'npm'), '#!/usr/bin/env node\nprocess.exit(99);\n', true);
  const result = spawnSync(process.execPath, [runner, '--config', f.configFile, '--account', 'group', '--git-only', '--execute'],
    { env: { ...f.env, RELEASE_TEST_TOKEN: '' }, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /All selected schools pushed/);
  const dir = path.join(f.root, 'runs', fs.readdirSync(path.join(f.root, 'runs'))[0]);
  const state = JSON.parse(fs.readFileSync(path.join(dir, 'state.json')));
  assert.equal(state.mode, 'git-only');
  assert.equal(state.progress.test.phase, 'pushed');
  assert.equal(run('git', ['--git-dir', f.remote, 'show', 'main:common.txt']), 'dirty latest code');
  assert.equal(run('git', ['--git-dir', f.remote, 'show', 'main:src/constants/schoolConfig.ts']), 'export const school = 7;');
  assert.equal(run('git', ['-C', f.source, 'status', '--porcelain']), before);
  const work = state.progress.test.work;
  assert.equal(fs.existsSync(path.join(work, 'node_modules')), false);
  assert.equal(fs.existsSync(path.join(work, 'android')), false);
  assert.equal(fs.existsSync(f.env.MOCK_BUILD_CALLS), false);
  assert.equal(fs.existsSync(path.join(dir, 'test.build.json')), false);
  const commit = run('git', ['--git-dir', f.remote, 'rev-parse', 'main']);
  const resumed = run(process.execPath, [runner, '--resume', dir, '--execute'], { env: f.env });
  assert.match(resumed, /already pushed/);
  assert.equal(run('git', ['--git-dir', f.remote, 'rev-parse', 'main']), commit);
  assert.equal(fs.existsSync(f.env.MOCK_BUILD_CALLS), false);
});
test('a frozen build run cannot be resumed as Git-only', t => {
  const f = fixture(t);
  const failed = spawnSync(process.execPath, [runner, '--config', f.configFile, '--execute'],
    { env: { ...f.env, RELEASE_TEST_TOKEN: 'bad-token' }, encoding: 'utf8' });
  assert.equal(failed.status, 1);
  const dir = path.join(f.root, 'runs', fs.readdirSync(path.join(f.root, 'runs'))[0]);
  const refused = spawnSync(process.execPath, [runner, '--resume', dir, '--git-only', '--execute'], { env: f.env, encoding: 'utf8' });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /Cannot change an existing build run to Git-only/);
  assert.equal(fs.existsSync(f.env.MOCK_BUILD_CALLS), false);
});
