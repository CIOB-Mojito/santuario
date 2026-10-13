// Prueba independiente de la escena de entrada "Grimorio".
// Crea la escena con un stub de canvas 2D (sin renderer ni DOM), la actualiza
// 100 frames y verifica que no aparezcan valores numericos invalidos, y que
// dispose() libera la escena. Se ejecuta con esbuild + node (igual que smoke).
import * as THREE from 'three';
import { createGrimoireScene } from '../src/entry/GrimoireScene';

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  const tag = condition ? 'ok  ' : 'FAIL';
  if (!condition) failures++;
  console.log(`[${tag}] ${name}${detail ? `  ${detail}` : ''}`);
}

function makeCtx(): CanvasRenderingContext2D {
  const grad = { addColorStop: (): void => undefined } as unknown as CanvasGradient;
  const ctx = {
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    direction: 'ltr',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    shadowColor: 'rgba(0,0,0,0)',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    filter: 'none',
    beginPath: (): void => undefined,
    closePath: (): void => undefined,
    moveTo: (): void => undefined,
    lineTo: (): void => undefined,
    quadraticCurveTo: (): void => undefined,
    bezierCurveTo: (): void => undefined,
    arc: (): void => undefined,
    arcTo: (): void => undefined,
    ellipse: (): void => undefined,
    rect: (): void => undefined,
    stroke: (): void => undefined,
    fill: (): void => undefined,
    fillRect: (): void => undefined,
    strokeRect: (): void => undefined,
    clearRect: (): void => undefined,
    save: (): void => undefined,
    restore: (): void => undefined,
    translate: (): void => undefined,
    rotate: (): void => undefined,
    scale: (): void => undefined,
    setTransform: (): void => undefined,
    transform: (): void => undefined,
    clip: (): void => undefined,
    drawImage: (): void => undefined,
    createImageData: (w: number, h: number): ImageData =>
      ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) as unknown as ImageData,
    getImageData: (w: number, h: number): ImageData =>
      ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) as unknown as ImageData,
    putImageData: (): void => undefined,
    createLinearGradient: (): CanvasGradient => grad as CanvasGradient,
    createRadialGradient: (): CanvasGradient => grad as CanvasGradient,
    createPattern: (): CanvasPattern | null => null,
    fillText: (): void => undefined,
    strokeText: (): void => undefined,
    measureText: (text: string): TextMetrics =>
      ({ width: text.length * 8 }) as unknown as TextMetrics
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const el = {
    width,
    height,
    style: {},
    getContext: (kind: string): CanvasRenderingContext2D | null => (kind === '2d' ? makeCtx() : null),
    addEventListener: (): void => undefined,
    removeEventListener: (): void => undefined
  };
  return el as unknown as HTMLCanvasElement;
}

function isFiniteNum(v: number): boolean {
  return typeof v === 'number' && Number.isFinite(v);
}

function vecOk(v: THREE.Vector3 | THREE.Euler | THREE.Quaternion): boolean {
  if (!v) return false;
  const comps = [v.x, v.y, v.z];
  const w = (v as THREE.Quaternion).w;
  if (typeof w === 'number') comps.push(w);
  return comps.every(isFiniteNum);
}

let badVals = 0;
function scanScene(label: string, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
  const bads: string[] = [];
  scene.traverse((o) => {
    const name = o.name || o.type || 'obj';
    if (!vecOk(o.position) || !vecOk(o.scale) || !vecOk(o.rotation) || !vecOk(o.quaternion)) {
      bads.push(`${name} transform`);
    }
    const m = o as THREE.Mesh & THREE.Points;
    if (m.geometry) {
      const g = m.geometry as THREE.BufferGeometry;
      const pos = g.getAttribute('position');
      if (pos) {
        for (let i = 0; i < pos.count; i++) {
          if (!isFiniteNum(pos.getX(i)) || !isFiniteNum(pos.getY(i)) || !isFiniteNum(pos.getZ(i))) {
            bads.push(`${name} position attr`);
            break;
          }
        }
      }
    }
  });
  if (!vecOk(camera.position)) bads.push('camera transform');
  badVals += bads.length;
  if (bads.length) console.log(`  valores invalidos en ${label}: ${bads.slice(0, 5).join(', ')}${bads.length > 5 ? '...' : ''}`);
}

function main(): void {
  const api = createGrimoireScene({ textureScale: 0.25, canvas: makeCanvas, aspect: 0.75 });

  check('scene es THREE.Scene', api.scene instanceof THREE.Scene);
  check('camera es THREE.PerspectiveCamera', api.camera instanceof THREE.PerspectiveCamera);
  check('camera con fov valido', api.camera.fov > 0 && api.camera.fov < 180);

  let meshes = 0;
  api.scene.traverse((o) => {
    const m = o as THREE.Mesh & THREE.Points;
    if (m.geometry && m.material) meshes++;
  });
  check('escena tiene objetos con geometria', meshes > 40, `meshes=${meshes}`);
  check('la escena no esta vacia', api.scene.children.length > 0, `children=${api.scene.children.length}`);

  scanScene('frame 0', api.scene, api.camera);
  for (let i = 0; i < 100; i++) api.update(1 / 60);
  scanScene('frame 100', api.scene, api.camera);
  api.update(0.2); // dt mayor que el clamp interno (0.05) tambien debe ser seguro
  api.update(0);
  scanScene('dt extremos', api.scene, api.camera);
  check('update no genera NaN/Infinity', badVals === 0, `bad=${badVals}`);

  const camPos = api.camera.position;
  check('camara en rango razonable', isFiniteNum(camPos.length()) && camPos.length() < 100, `dist=${camPos.length().toFixed(2)}`);

  api.dispose();
  check('dispose vacia la escena', api.scene.children.length === 0, `children=${api.scene.children.length}`);
  api.dispose(); // idempotente
  check('dispose es idempotente', api.scene.children.length === 0);

  console.log(failures === 0 ? '\ngrimoire-test OK' : `\ngrimoire-test FALLO: ${failures} comprobaciones`);
  if (failures > 0) process.exit(1);
}

main();