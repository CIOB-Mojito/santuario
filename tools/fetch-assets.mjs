#!/usr/bin/env node
// Descargador de assets reales (secciones 3, 4, 13, 14 y 22 de o.txt).
// Solo fuentes con licencia verificada y descarga directa: Poly Haven (CC0) y
// ambientCG (CC0). Verifica md5 cuando el origen lo publica, nunca inventa
// datos y continua ante fallos individuales.
//
// Uso: node tools/fetch-assets.mjs [--only=id1,id2]

import { createHash } from 'node:crypto';
import { mkdir, writeFile, rm, readdir, readFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public', 'assets');
const DOCS = join(ROOT, 'docs');

const POLY_API = 'https://api.polyhaven.com';

// Set inicial curado: pequeno, coherente y de alta calidad (seccion 21).
const SOURCES = [
  // --- Poly Haven: texturas PBR (CC0) ---
  { id: 'stone_wall_slates', kind: 'polyhaven-texture', phId: 'castle_wall_slates', category: 'architecture', target: 'textures/stone_wall_slates', res: '1k', maps: ['Diffuse', 'nor_gl', 'Rough'], license: 'CC0-1.0', author: 'Poly Haven' },
  { id: 'floor_cobblestone', kind: 'polyhaven-texture', phId: 'cobblestone_floor_08', category: 'architecture', target: 'textures/floor_cobblestone', res: '1k', maps: ['Diffuse', 'nor_gl', 'Rough'], license: 'CC0-1.0', author: 'Poly Haven' },
  { id: 'wood_dark_planks', kind: 'polyhaven-texture', phId: 'dark_wooden_planks', category: 'materials', target: 'textures/wood_dark_planks', res: '1k', maps: ['Diffuse', 'nor_gl', 'Rough'], license: 'CC0-1.0', author: 'Poly Haven' },
  { id: 'plaster_wall', kind: 'polyhaven-texture', phId: 'clay_plaster', category: 'materials', target: 'textures/plaster_wall', res: '1k', maps: ['Diffuse', 'nor_gl', 'Rough'], license: 'CC0-1.0', author: 'Poly Haven' },
  // --- Poly Haven: HDRI para iluminacion ambiental (CC0) ---
  { id: 'sky_citrus', kind: 'polyhaven-hdri', phId: 'citrus_orchard_puresky', category: 'sky', target: 'sky/sky_citrus', res: '1k', license: 'CC0-1.0', author: 'Poly Haven' },
  // --- ambientCG: materiales PBR (CC0) ---
  { id: 'marble_012', kind: 'ambientcg-zip', acgId: 'Marble012', category: 'materials', target: 'textures/marble_012', res: '1K', license: 'CC0-1.0', author: 'Lennart Demes (ambientCG)' },
  { id: 'metal_gold_base', kind: 'ambientcg-zip', acgId: 'Metal048A', category: 'materials', target: 'textures/metal_gold_base', res: '1K', license: 'CC0-1.0', author: 'Lennart Demes (ambientCG)' }
];

const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? new Set(onlyArg.slice(7).split(',').filter(Boolean)) : null;

const manifest = [];
const errors = [];

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

async function download(url, dest, expectedMd5) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (expectedMd5) {
    const md5 = createHash('md5').update(buf).digest('hex');
    if (md5 !== expectedMd5) throw new Error(`md5 no coincide para ${dest} (${md5})`);
  }
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return buf.length;
}

async function fetchPolyTexture(src) {
  const files = await fetchJson(`${POLY_API}/files/${src.phId}`);
  const downloaded = [];
  for (const map of src.maps) {
    const node = files?.[map]?.[src.res]?.jpg;
    if (!node?.url) throw new Error(`sin mapa ${map} @${src.res}`);
    const name = `${src.id}_${map}_${src.res}.jpg`;
    const dest = join(PUBLIC, src.target, name);
    const bytes = await download(node.url, dest, node.md5);
    downloaded.push({ map, file: `public/assets/${src.target}/${name}`, bytes, md5: node.md5, url: node.url });
  }
  manifest.push({ id: src.id, kind: 'texture', category: src.category, source: 'Poly Haven', assetPage: `https://polyhaven.com/a/${src.phId}`, author: src.author, license: src.license, attributionRequired: false, resolution: src.res, files: downloaded, totalBytes: downloaded.reduce((s, d) => s + d.bytes, 0), status: 'downloaded' });
  return downloaded.reduce((s, d) => s + d.bytes, 0);
}

async function fetchPolyHdri(src) {
  const files = await fetchJson(`${POLY_API}/files/${src.phId}`);
  const node = files?.hdri?.[src.res]?.hdr;
  if (!node?.url) throw new Error('sin hdr @' + src.res);
  const name = `${src.id}_${src.res}.hdr`;
  const dest = join(PUBLIC, src.target, name);
  const bytes = await download(node.url, dest, node.md5);
  manifest.push({ id: src.id, kind: 'hdri', category: src.category, source: 'Poly Haven', assetPage: `https://polyhaven.com/a/${src.phId}`, author: src.author, license: src.license, attributionRequired: false, resolution: src.res, files: [{ map: 'hdri', file: `public/assets/${src.target}/${name}`, bytes, md5: node.md5, url: node.url }], totalBytes: bytes, status: 'downloaded' });
  return bytes;
}

async function fetchAmbientCg(src) {
  const want = `${src.res}-JPG`;
  // ambientCG publica URLs directas estables por id. Se comprueba la respuesta.
  const link = `https://ambientcg.com/get?file=${src.acgId}_${want}.zip`;
  const head = await fetch(link, { method: 'HEAD' });
  if (!head.ok) throw new Error(`ambientCG sin ${want} para ${src.acgId} (HTTP ${head.status})`);
  const zip = join(PUBLIC, src.target, `${src.acgId}_${want}.zip`);
  const zipBytes = await download(link, zip);
  const outDir = join(PUBLIC, src.target);
  await run('unzip', ['-o', '-q', zip, '-d', outDir]);
  await rm(zip, { force: true });
  // Conserva solo los mapas utiles; descarta formatos de DCC.
  const keep = /_Color\.jpg$|_NormalGL\.jpg$|_Roughness\.jpg$|_AmbientOcclusion\.jpg$/i;
  for (const f of await readdir(outDir)) {
    const full = join(outDir, f);
    if ((await stat(full)).isDirectory() || !keep.test(f)) await rm(full, { recursive: true, force: true });
  }
  const kept = await readdir(outDir);
  manifest.push({ id: src.id, kind: 'texture', category: src.category, source: 'ambientCG', assetPage: `https://ambientcg.com/view?id=${src.acgId}`, author: src.author, license: src.license, attributionRequired: false, resolution: src.res, files: kept.map((f) => ({ map: f.replace(/^.*_/, '').replace(/\.jpg$/, ''), file: `public/assets/${src.target}/${f}` })), zipBytes, status: 'downloaded' });
  return zipBytes;
}

async function main() {
  await mkdir(DOCS, { recursive: true });
  const list = only ? SOURCES.filter((s) => only.has(s.id)) : SOURCES;
  let total = 0;
  for (const src of list) {
    try {
      process.stdout.write(`- ${src.id} ... `);
      let bytes = 0;
      if (src.kind === 'polyhaven-texture') bytes = await fetchPolyTexture(src);
      else if (src.kind === 'polyhaven-hdri') bytes = await fetchPolyHdri(src);
      else if (src.kind === 'ambientcg-zip') bytes = await fetchAmbientCg(src);
      total += bytes;
      console.log(`ok (${(bytes / 1024).toFixed(0)} KB)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ id: src.id, error: message });
      console.log(`FALLO: ${message}`);
    }
  }
  const out = {
    generatedBy: 'tools/fetch-assets.mjs',
    generatedAt: new Date().toISOString(),
    policy: 'Solo CC0 verificable con descarga directa. Sin datos inventados.',
    totalBytes: total,
    assets: manifest,
    errors
  };
  await writeFile(join(DOCS, 'asset-manifest.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`\n${manifest.length} assets descargados, ${errors.length} fallos, ${(total / 1048576).toFixed(1)} MB.`);
  console.log('Manifiesto: docs/asset-manifest.json');
  if (errors.length && manifest.length === 0) process.exit(1);
}

main();
