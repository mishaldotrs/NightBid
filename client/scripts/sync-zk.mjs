// Copies the compiled ZK artifacts (prover/verifier keys + ZKIR) from the
// contract package into client/public/nightbid so the dApp can serve them to
// the wallet / proof server at runtime.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '../../contract/src/managed/nightbid');
const target = resolve(here, '../public/nightbid');

for (const dir of ['keys', 'zkir']) {
  if (!existsSync(resolve(source, dir))) {
    console.error(`Missing ${dir}/ — run \`npm run compact\` first.`);
    process.exit(1);
  }
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(resolve(source, 'keys'), resolve(target, 'keys'), { recursive: true });
cpSync(resolve(source, 'zkir'), resolve(target, 'zkir'), { recursive: true });
console.log(`ZK artifacts synced to ${target}`);
