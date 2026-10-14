import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') {
  throw new Error('Verification requires the local Firestore Emulator at 127.0.0.1:8080.');
}
for (const args of [
  ...readdirSync('js').filter(name => name.endsWith('.js')).map(name => ['--check', `js/${name}`]),
  ['--test', 'tests/utils.test.mjs'],
  ['--test', 'tests/firestore.rules.test.mjs'],
  ['node_modules/playwright/cli.js', 'test'],
  ['--test', 'tests/avatar-preview.test.mjs'],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Verified: syntax, unit tests, Firestore Rules and browser flows.');
