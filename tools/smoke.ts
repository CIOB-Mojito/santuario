import * as THREE from 'three';
import { World } from '../src/scene/World';
import { QUALITY_PROFILES } from '../src/config/quality';

/**
 * Prueba de humo sin WebGL: valida que la escena se construye, se actualiza y se
 * libera sin excepciones. No reemplaza la prueba visual en navegador.
 */
const world = new World(QUALITY_PROFILES.LOW);

let meshes = 0;
let lights = 0;
let placeholders = 0;

world.scene.traverse((obj) => {
  if ((obj as THREE.Mesh).isMesh) meshes++;
  if ((obj as THREE.Light).isLight) lights++;
  if (obj.userData && typeof obj.userData === 'object' && 'kind' in obj.userData) placeholders++;
});

for (let i = 0; i < 180; i++) world.update(1 / 60);

console.log('zonas      :', world.zones.map((z) => z.id).join(', '));
console.log('meshes     :', meshes);
console.log('luces      :', lights);
console.log('placeholders:', placeholders);

if (meshes < 40) throw new Error(`esperaba mas meshes, hay ${meshes}`);
if (lights < 3) throw new Error(`esperaba mas luces, hay ${lights}`);
if (placeholders < 10) throw new Error(`esperaba mas placeholders, hay ${placeholders}`);
if (world.zones.length < 4) throw new Error('faltan zonas');

world.dispose();
console.log('smoke OK');
