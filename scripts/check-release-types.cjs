#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Clean release copies do not include Expo's gitignored development types.
// Generate them from this school's routes before checking the overlaid source.
const projectRoot = process.cwd();
const envTypes = path.join(projectRoot, 'expo-env.d.ts');
if (!fs.existsSync(envTypes)) fs.writeFileSync(envTypes, '/// <reference types="expo/types" />\n');
const app = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf8'));
if (app.expo?.experiments?.typedRoutes) {
  const fromProject = (name) => require(require.resolve(name, { paths: [projectRoot] }));
  const { getTypedRoutesDeclarationFile } = fromProject('expo-router/build/typed-routes/generate');
  const requireContext = fromProject('expo-router/build/testing-library/require-context-ponyfill').default;
  const routes = path.join(projectRoot, fs.existsSync(path.join(projectRoot, 'src/app')) ? 'src/app' : 'app');
  const output = path.join(projectRoot, '.expo/types');
  fs.mkdirSync(output, { recursive: true });
  const declaration = getTypedRoutesDeclarationFile(requireContext(routes));
  if (!declaration) throw new Error('Could not generate Expo Router release types');
  fs.writeFileSync(path.join(output, 'router.d.ts'), declaration);
}

const result = spawnSync(path.join(projectRoot, 'node_modules/.bin/tsc'), ['--noEmit'], { stdio: 'inherit' });
if (result.error || result.status !== 0) {
  console.error(`tsc --noEmit failed (${result.status ?? result.error?.message})`);
  process.exitCode = 1;
}
