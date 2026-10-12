import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts'],
  outdir: 'dist',
  bundle: true,
  minify: true,
  sourcemap: false,
  format: 'esm',
  target: ['es2020'],
  logLevel: 'info',
  loader: {
    '.glb': 'file',
    '.gltf': 'file',
    '.bin': 'file',
    '.ktx2': 'file',
    '.hdr': 'file',
    '.png': 'file',
    '.jpg': 'file',
    '.mp3': 'file',
    '.ogg': 'file',
    '.wav': 'file'
  }
});

console.log('Build listo en dist/');
