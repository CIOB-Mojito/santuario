import * as THREE from 'three';
import { AssetRegistry } from '../src/assets/assetRegistry';
import { StreamingManager } from '../src/streaming/StreamingManager';
import { zoneAt } from '../src/world/zones';
import { Player } from '../src/player/Player';
import { InputState } from '../src/player/InputState';
import { NarrativeSystem } from '../src/narrative/NarrativeSystem';
import { FRAGMENTS } from '../src/narrative/fragments';
import { nextQuality, QUALITY_PROFILES } from '../src/config/quality';
import { SETTINGS } from '../src/config/settings';

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  const tag = condition ? 'ok  ' : 'FAIL';
  if (!condition) failures++;
  console.log(`[${tag}] ${name}${detail ? `  ${detail}` : ''}`);
}

async function main(): Promise<void> {
  // 1. Registro de assets
  const registry = new AssetRegistry();
  registry.register({ id: 'a', kind: 'architecture', url: null, priority: 'critical', bytes: 1024, maxDistance: 100 });
  registry.register({ id: 'b', kind: 'statue', url: 'model.glb', priority: 'low', bytes: 4096, maxDistance: 50 });
  check('registry cuenta entradas', registry.size === 2, `size=${registry.size}`);
  check('registry cuenta por tipo', registry.countByKind('statue') === 1);
  check('residentBytes ignora placeholders', registry.residentBytes() === 0);

  // 2. Streaming: sin URL no se encola nada; con URL se carga y se mide.
  const streaming = new StreamingManager(registry, async () => ({}));
  streaming.update(new THREE.Vector3(0, 0, 0));
  check('streaming no encola placeholders sin URL', streaming.queueLength === 0, `cola=${streaming.queueLength}`);
  registry.register({ id: 'c', kind: 'prop', url: 'prop.glb', priority: 'high', bytes: 2048, maxDistance: 30 });
  streaming.update(new THREE.Vector3(0, 0, 0));
  await new Promise((r) => setTimeout(r, 10));
  // b (4096) y c (2048) tienen URL; a sigue siendo placeholder.
  check('streaming carga assets con URL', streaming.loadedCount === 2, `cargados=${streaming.loadedCount}`);
  check('presupuesto de memoria contabilizado', registry.residentBytes() === 6144, `bytes=${registry.residentBytes()}`);

  // 3. Zonas
  check('zona exterior fuera', zoneAt(new THREE.Vector3(0, 0, 50)).id === 'exterior');
  check('zona nave dentro', zoneAt(new THREE.Vector3(0, 0, 0)).id === 'nave');

  // 4. Colision del jugador contra un muro
  const player = new Player();
  player.setWorldBounds(300);
  player.position.set(0, 1.65, 46);
  player.yaw = 0;
  const wall = new THREE.Box3(new THREE.Vector3(-6, 0, 41), new THREE.Vector3(6, 5, 42));
  player.moveInput.set(0, 1);
  const dt = 1 / 60;
  for (let i = 0; i < 600; i++) player.update(dt, [wall]);
  check('el jugador avanza hacia el muro', player.position.z < 44, `z=${player.position.z.toFixed(2)}`);
  check('el jugador no atraviesa el muro', player.position.z > 42, `z=${player.position.z.toFixed(2)}`);

  // 5. Entrada combinada: el teclado no debe pisar el joystick
  const input = new InputState();
  const mover = new Player();
  input.keyboardActive = false; // sin teclas
  input.keyboard.set(0, 0);
  input.touchActive = true;
  input.touch.set(0.8, 0.6);
  input.applyTo(mover);
  check('el joystick mueve aunque el teclado no tenga teclas', mover.moveInput.x === 0.8 && mover.moveInput.y === 0.6, `move=${mover.moveInput.x},${mover.moveInput.y}`);
  input.touchActive = false;
  input.applyTo(mover);
  check('sin fuentes activas el jugador se detiene', mover.moveInput.length() === 0);
  input.keyboardActive = true;
  input.keyboard.set(-1, 0);
  input.applyTo(mover);
  check('el teclado mueve cuando el tactil esta inactivo', mover.moveInput.x === -1);

  // 5b. Movimiento real: avanzar mirando a la nave reduce z
  const walker = new Player();
  walker.setWorldBounds(300);
  walker.position.set(0, 1.65, 46);
  walker.yaw = 0;
  walker.moveInput.set(0, 1);
  const startZ = walker.position.z;
  for (let i = 0; i < 120; i++) walker.update(1 / 60, []);
  check('el jugador camina hacia delante', walker.position.z < startZ - 3, `dz=${(startZ - walker.position.z).toFixed(2)}`);

  // 5c. Superar obstaculos: escalon bajo y salto
  const climber = new Player();
  climber.setWorldBounds(300);
  climber.position.set(0, SETTINGS.player.eyeHeight, 10);
  climber.yaw = 0;
  climber.moveInput.set(0, 1);
  const step = new THREE.Box3(new THREE.Vector3(-4, 0, 4), new THREE.Vector3(4, SETTINGS.player.stepHeight - 0.1, 5));
  let maxFeet = 0;
  for (let i = 0; i < 240; i++) {
    climber.update(dt, [step]);
    maxFeet = Math.max(maxFeet, climber.position.y - SETTINGS.player.eyeHeight);
  }
  check('el jugador supera un escalon bajo', climber.position.z < 4, `z=${climber.position.z.toFixed(2)}`);
  check('el jugador se sube al escalon', maxFeet > 0.3, `feet=${maxFeet.toFixed(2)}`);

  const jumper = new Player();
  jumper.setWorldBounds(300);
  jumper.position.set(0, SETTINGS.player.eyeHeight, 0);
  jumper.requestJump();
  let peak = 0;
  for (let i = 0; i < 120; i++) {
    jumper.update(dt, []);
    peak = Math.max(peak, jumper.position.y);
  }
  check('el salto eleva al jugador', peak > SETTINGS.player.eyeHeight + 0.6, `peak=${peak.toFixed(2)}`);
  check('el jugador vuelve al suelo tras el salto', jumper.grounded && Math.abs(jumper.position.y - SETTINGS.player.eyeHeight) < 0.01);

  // 6. Narrativa sin repeticiones
  const narrative = new NarrativeSystem();
  narrative.load(FRAGMENTS);
  const zone = zoneAt(new THREE.Vector3(0, 0, 0));
  const f1 = narrative.next(zone);
  const f2 = narrative.next(zone);
  check('narrativa devuelve fragmentos', f1 !== null && f2 !== null);
  check('narrativa no repite el mismo texto', f1?.text !== f2?.text);
  check('narrativa registra visitas', narrative.visitCount('nave') === 2, `visitas=${narrative.visitCount('nave')}`);

  // 6. Calidad
  check('nextQuality rota perfiles', nextQuality('QUALITY_LOW') === 'QUALITY_MEDIUM');
  check('perfiles con sombras distintas', QUALITY_PROFILES.QUALITY_LOW.shadowMapSize < QUALITY_PROFILES.QUALITY_HIGH.shadowMapSize);

  console.log(failures === 0 ? '\nsmoke OK' : `\nsmoke FALLO: ${failures} comprobaciones`);
  if (failures > 0) process.exit(1);
}

void main();
