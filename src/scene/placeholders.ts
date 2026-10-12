import * as THREE from 'three';

/**
 * Convencion de nombres. Un asset real que reemplace a un placeholder debe
 * conservar el mismo `userData.kind` y los mismos sockets para no romper la escena.
 */
export const PLACEHOLDER = {
  ANGEL: 'PLACEHOLDER_ANGEL',
  ALTAR: 'PLACEHOLDER_ALTAR',
  RELIC: 'PLACEHOLDER_RELIC',
  DOOR: 'PLACEHOLDER_DOOR',
  CHARACTER: 'PLACEHOLDER_CHARACTER',
  TOWER: 'PLACEHOLDER_TOWER',
  COLUMN: 'PLACEHOLDER_COLUMN',
  CANDLE: 'PLACEHOLDER_CANDLE'
} as const;

export type PlaceholderKind = (typeof PLACEHOLDER)[keyof typeof PLACEHOLDER];

/** Materiales provisorios, compartidos para no inflar el estado GPU. */
export const MAT = {
  stone: new THREE.MeshStandardMaterial({ color: 0x8f887b, roughness: 0.95, metalness: 0 }),
  stoneDark: new THREE.MeshStandardMaterial({ color: 0x635d54, roughness: 1, metalness: 0 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xcaa64a, roughness: 0.35, metalness: 0.9 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.9, metalness: 0 }),
  wax: new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.7, metalness: 0 }),
  flame: new THREE.MeshStandardMaterial({
    color: 0xffbb66,
    emissive: 0xff8a2a,
    emissiveIntensity: 1.5,
    roughness: 1
  }),
  saint: new THREE.MeshStandardMaterial({ color: 0xbfc4c9, roughness: 0.6, metalness: 0.05 }),
  relic: new THREE.MeshStandardMaterial({
    color: 0xffe08a,
    emissive: 0x6b4a12,
    emissiveIntensity: 0.9,
    roughness: 0.3,
    metalness: 0.6
  })
} as const;

function tag(object: THREE.Object3D, kind: PlaceholderKind, interactive = false): THREE.Object3D {
  object.name = kind;
  object.userData = { kind, interactive, placeholder: true };
  return object;
}

export function buildColumn(height = 6, radius = 0.55): THREE.Group {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 14), MAT.stone);
  shaft.position.y = height / 2;
  const base = new THREE.Mesh(new THREE.BoxGeometry(radius * 3, 0.4, radius * 3), MAT.stoneDark);
  base.position.y = 0.2;
  const capital = new THREE.Mesh(new THREE.BoxGeometry(radius * 3.2, 0.5, radius * 3.2), MAT.stoneDark);
  capital.position.y = height + 0.1;
  g.add(shaft, base, capital);
  tag(g, PLACEHOLDER.COLUMN);
  return g;
}

export function buildTower(height = 20): THREE.Group {
  const g = new THREE.Group();
  const segments = 3;
  let y = 0;
  for (let i = 0; i < segments; i++) {
    const w = 6 - i * 1.2;
    const h = height / segments;
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), MAT.stone);
    box.position.y = y + h / 2;
    g.add(box);
    y += h;
  }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.2, 6, 4), MAT.stoneDark);
  spire.position.y = y + 3;
  spire.rotation.y = Math.PI / 4;
  g.add(spire);
  tag(g, PLACEHOLDER.TOWER);
  return g;
}

export function buildAltar(): THREE.Group {
  const g = new THREE.Group();
  const step = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 3.4), MAT.stoneDark);
  step.position.y = 0.3;
  const top = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 1.6), MAT.stone);
  top.position.y = 1.3;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.25, 2), MAT.gold);
  slab.position.y = 2.1;
  g.add(step, top, slab);
  tag(g, PLACEHOLDER.ALTAR, true);
  g.userData.socket = new THREE.Vector3(0, 2.1, 0);
  return g;
}

export function buildRelic(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), MAT.relic);
  m.position.y = 0.9;
  tag(m, PLACEHOLDER.RELIC, true);
  m.userData.socket = new THREE.Vector3(0, 0.9, 0);
  return m;
}

export function buildAngel(): THREE.Group {
  const g = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 10), MAT.saint);
  robe.position.y = 1.3;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 1, 10), MAT.saint);
  torso.position.y = 3;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), MAT.saint);
  head.position.y = 3.85;
  const wingGeo = new THREE.BoxGeometry(0.15, 1.8, 1.1);
  const wingL = new THREE.Mesh(wingGeo, MAT.saint);
  wingL.position.set(0.6, 3.1, -0.35);
  wingL.rotation.set(0, 0.5, -0.35);
  const wingR = new THREE.Mesh(wingGeo, MAT.saint);
  wingR.position.set(0.6, 3.1, 0.35);
  wingR.rotation.set(0, -0.5, -0.35);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 8), MAT.saint);
  arm.position.set(0.55, 3.2, 0);
  arm.rotation.z = -1;
  g.add(robe, torso, head, wingL, wingR, arm);
  tag(g, PLACEHOLDER.ANGEL, true);
  g.userData.socket = new THREE.Vector3(0, 2.2, 0.6);
  return g;
}

export function buildCandleMesh(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.6, 8), MAT.wax);
  m.position.y = 0.3;
  tag(m, PLACEHOLDER.CANDLE);
  return m;
}

export function buildFlameMesh(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 8), MAT.flame.clone());
  m.position.y = 0.72;
  m.name = 'FLAME';
  return m;
}

export function buildDoor(): THREE.Group {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 4, 0.4), MAT.stoneDark);
  frame.position.y = 2;
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.9, 3.4, 0.2), MAT.wood);
  leaf.position.set(0, 1.8, 0.25);
  g.add(frame, leaf);
  tag(g, PLACEHOLDER.DOOR, true);
  return g;
}

/** Libera geometria y materiales de un subarbol. */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = (mesh as THREE.Mesh).material;
    if (Array.isArray(mat)) {
      for (const m of mat) m.dispose();
    } else if (mat) {
      (mat as THREE.Material).dispose();
    }
  });
}
