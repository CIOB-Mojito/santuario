import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import type { MaterialSet } from './materials';

/**
 * Carga las texturas PBR reales (Poly Haven y ambientCG, CC0) y el HDRI de
 * iluminacion ambiental. Todo se sirve desde public/assets. Las rutas usan
 * import.meta.env.BASE_URL para funcionar igual en dev y en build relativo.
 */

const base = (): string => {
  const b = (import.meta.env?.BASE_URL as string | undefined) ?? './';
  return b.endsWith('/') ? b : `${b}/`;
};

const TEX = () => `${base()}assets/textures`;
const SKY = () => `${base()}assets/sky`;

function configure(texture: THREE.Texture, srgb: boolean, repeatX: number, repeatY: number): THREE.Texture {
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  return texture;
}

interface MapSpec {
  dir: string;
  diffuse: string;
  normal: string;
  rough: string;
}

async function applyPbr(loader: THREE.TextureLoader, material: THREE.MeshStandardMaterial, spec: MapSpec, rx: number, ry: number): Promise<void> {
  const [map, normalMap, roughnessMap] = await Promise.all([
    loader.loadAsync(`${TEX()}/${spec.dir}/${spec.diffuse}`),
    loader.loadAsync(`${TEX()}/${spec.dir}/${spec.normal}`),
    loader.loadAsync(`${TEX()}/${spec.dir}/${spec.rough}`)
  ]);
  material.map = configure(map, true, rx, ry);
  material.normalMap = configure(normalMap, false, rx, ry);
  material.roughnessMap = configure(roughnessMap, false, rx, ry);
  material.color.set(0xffffff);
  material.needsUpdate = true;
}

const SPECS = {
  stone: { dir: 'stone_wall_slates', diffuse: 'stone_wall_slates_Diffuse_1k.jpg', normal: 'stone_wall_slates_nor_gl_1k.jpg', rough: 'stone_wall_slates_Rough_1k.jpg' },
  plaster: { dir: 'plaster_wall', diffuse: 'plaster_wall_Diffuse_1k.jpg', normal: 'plaster_wall_nor_gl_1k.jpg', rough: 'plaster_wall_Rough_1k.jpg' },
  floor: { dir: 'floor_cobblestone', diffuse: 'floor_cobblestone_Diffuse_1k.jpg', normal: 'floor_cobblestone_nor_gl_1k.jpg', rough: 'floor_cobblestone_Rough_1k.jpg' },
  wood: { dir: 'wood_dark_planks', diffuse: 'wood_dark_planks_Diffuse_1k.jpg', normal: 'wood_dark_planks_nor_gl_1k.jpg', rough: 'wood_dark_planks_Rough_1k.jpg' },
  marble: { dir: 'marble_012', diffuse: 'Marble012_1K-JPG_Color.jpg', normal: 'Marble012_1K-JPG_NormalGL.jpg', rough: 'Marble012_1K-JPG_Roughness.jpg' },
  metal: { dir: 'metal_gold_base', diffuse: 'Metal048A_1K-JPG_Color.jpg', normal: 'Metal048A_1K-JPG_NormalGL.jpg', rough: 'Metal048A_1K-JPG_Roughness.jpg' }
} satisfies Record<string, MapSpec>;

export interface TextureReport {
  applied: string[];
  failed: { material: string; error: string }[];
}

/** Aplica las texturas reales a los materiales. Nunca lanza: registra fallos. */
export async function applyPbrTextures(
  materials: MaterialSet,
  onProgress?: (done: number, total: number) => void
): Promise<TextureReport> {
  const loader = new THREE.TextureLoader();
  const report: TextureReport = { applied: [], failed: [] };
  const jobs: { key: string; material: THREE.MeshStandardMaterial; spec: MapSpec; rx: number; ry: number }[] = [
    { key: 'stoneWall', material: materials.stoneWall, spec: SPECS.stone, rx: 6, ry: 3 },
    { key: 'stoneCool', material: materials.stoneCool, spec: SPECS.plaster, rx: 3, ry: 3 },
    { key: 'floor', material: materials.floor, spec: SPECS.floor, rx: 8, ry: 20 },
    { key: 'wood', material: materials.wood, spec: SPECS.wood, rx: 2, ry: 8 },
    { key: 'marble', material: materials.marble, spec: SPECS.marble, rx: 1, ry: 1 },
    { key: 'gold', material: materials.gold, spec: SPECS.metal, rx: 3, ry: 2 }
  ];
  const total = jobs.length;
  let done = 0;
  await Promise.all(
    jobs.map(async (job) => {
      try {
        await applyPbr(loader, job.material, job.spec, job.rx, job.ry);
        report.applied.push(job.key);
      } catch (error) {
        report.failed.push({ material: job.key, error: error instanceof Error ? error.message : String(error) });
      }
      done++;
      onProgress?.(done, total);
    })
  );
  return report;
}

/** HDRI de Poly Haven como entorno de iluminacion (no como fondo literal). */
export async function loadEnvironment(scene: THREE.Scene, file = 'sky_citrus/sky_citrus_1k.hdr'): Promise<string> {
  const loader = new RGBELoader();
  const texture = await loader.loadAsync(`${SKY()}/${file}`);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = texture;
  scene.environmentIntensity = 0.6;
  return file;
}
