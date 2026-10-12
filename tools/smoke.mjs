import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { rmSync } from 'node:fs';

const outfile = '.smoke.mjs';

await build({
  entryPoints: ['tools/smoke.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: ['node20'],
  outfile,
  logLevel: 'warning'
});

try {
  await import(pathToFileURL(process.cwd() + '/' + outfile).href);
} finally {
  rmSync(outfile, { force: true });
}
