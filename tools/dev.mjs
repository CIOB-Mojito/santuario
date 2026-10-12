import { context } from 'esbuild';

const ctx = await context({
  entryPoints: ['src/main.ts'],
  outdir: 'dist',
  bundle: true,
  sourcemap: true,
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

await ctx.watch();

const result = await ctx.serve({ servedir: '.', host: '0.0.0.0', port: 8080 });
console.log(`\n  Santuario listo en http://localhost:${result.port}/\n`);
