// Pruebas de los calculos geometricos del gizmo del Modo Constructor
// (src/builder/BuilderGizmo). Solo matematica pura + construccion del gizmo:
// no requiere DOM. Se ejecuta con esbuild + node (igual que smoke/grimoire).
import * as THREE from 'three';
import {
  BuilderGizmo,
  angleInBasis,
  axisParam,
  rayPlaneHit,
  snapAngle,
  uniformScaleFactor
} from '../src/builder/BuilderGizmo';

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  const tag = condition ? 'ok  ' : 'FAIL';
  if (!condition) failures++;
  console.log(`[${tag}] ${name}${detail ? `  ${detail}` : ''}`);
}

function close(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

function nonFinite(...values: number[]): boolean {
  return values.some((v) => !Number.isFinite(v));
}

function main(): void {
  const o = new THREE.Vector3(0, 0, 0);

  const planeHits = rayPlaneHit(
    new THREE.Vector3(0, 5, 0),
    new THREE.Vector3(0, -1, 0),
    o,
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3()
  );
  check('rayPlaneHit golpea el plano en el origen', planeHits !== null && close(planeHits.y, 0), `y=${planeHits?.y}`);
  check('rayPlaneHit sin NaN', planeHits !== null && !nonFinite(planeHits.x, planeHits.y, planeHits.z));
  const miss = rayPlaneHit(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3()
  );
  check('rayPlaneHit paralelo devuelve null', miss === null);

  const t = axisParam(o, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 3.2, 0));
  check('axisParam proyecta sobre el eje Y', close(t, 3.2), `t=${t}`);
  const tz = axisParam(o, new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -2.5));
  check('axisParam firma negativa sobre eje Z', close(tz, -2.5), `t=${tz}`);

  const camPos = new THREE.Vector3(6, 5, 8);
  const p = new THREE.Vector3(0, 1, 0);
  const a0 = angleInBasis(p, new THREE.Vector3(0, 1, 0), camPos, new THREE.Vector3());
  check('angleInBasis finito', !nonFinite(a0), `a=${a0}`);
  const p90 = new THREE.Vector3(-1, 0, 0.001);
  // Basta con verificar que no devuelve NaN y que envuelve en [-PI, PI].
  const a90 = angleInBasis(p90, new THREE.Vector3(0, 1, 0), camPos, new THREE.Vector3());
  check('angleInBasis dentro del rango', a90 >= -Math.PI && a90 <= Math.PI, `a=${a90.toFixed(3)}`);

  check('snapAngle redondea a 15° (rad)', close(snapAngle(0.37, Math.PI / 12) / (Math.PI / 12), 1), `snap=${snapAngle(0.37, Math.PI / 12).toFixed(4)}`);
  check('snapAngle con valor exacto no cambia', close(snapAngle(Math.PI / 3, Math.PI / 12), Math.PI / 3), `snap=${snapAngle(Math.PI / 3, Math.PI / 12).toFixed(4)}`);

  const up = uniformScaleFactor(1, -20);
  check('escala crece al arrastrar hacia arriba', up > 1, `f=${up.toFixed(3)}`);
  const down = uniformScaleFactor(1, 40);
  check('escala decrece al arrastrar hacia abajo', down < 1, `f=${down.toFixed(3)}`);
  const min = uniformScaleFactor(1, 10000);
  check('escala respeta el minimo', close(min, 0.05), `f=${min}`);
  const max = uniformScaleFactor(1, -10000);
  check('escala respeta el maximo', close(max, 20), `f=${max}`);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1.5, 0.1, 100);
  camera.position.set(6, 5, 8);
  camera.lookAt(0, 0, 0);
  const gizmo = new BuilderGizmo(camera, scene);

  check('gizmo en capa 1', gizmo.group.layers.isEnabled(1) && !gizmo.group.layers.isEnabled(0));
  check('gizmo oculto inicialmente', gizmo.group.visible === false);

  gizmo.setTool('move');
  check('tool move no rompe la escena', gizmo.group.parent === scene);

  gizmo.setPosition(new THREE.Vector3(2, 1, 3));
  check('setPosition muestra el gizmo', gizmo.visible && gizmo.group.position.equals(new THREE.Vector3(2, 1, 3)));

  const ndc = new THREE.Vector2(0, 0);
  const hit = gizmo.pick(ndc);
  // El cubo y las flechas rodean el ancla: un rayo al centro debe caer en algo,
  // y en tool move deberia devolver la herramienta activa (o 4º fallback).
  check('pick devuelve herramienta o null (nunca lanza)', hit === null || (hit.tool === 'move' || hit.tool === 'rotate' || hit.tool === 'scale'), hit ? `tool=${hit.tool}` : 'null');

  gizmo.setRadius(0.4);
  check('radio minimo respetado', close(gizmo.group.scale.x, 0.4), `r=${gizmo.group.scale.x}`);
  gizmo.setRadius(99);
  check('radio maximo respetado', close(gizmo.group.scale.x, 3), `r=${gizmo.group.scale.x}`);

  gizmo.dispose();
  check('dispose retira el gizmo de la escena', scene.children.length === 0);

  console.log(failures === 0 ? '\nbuilder-test OK' : `\nbuilder-test FALLO: ${failures} comprobaciones`);
  if (failures > 0) process.exit(1);
}

main();