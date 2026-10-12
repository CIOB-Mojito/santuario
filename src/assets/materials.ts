import * as THREE from 'three';

/**
 * Materiales PBR del santuario (seccion 7 de o.txt). Cada material empieza con
 * valores plausibles y recibe sus texturas reales cuando el sistema de assets
 * las carga. Al ser instancias compartidas, el mundo las ve actualizadas sin
 * reconstruir nada.
 */
export interface MaterialSet {
  stoneWall: THREE.MeshStandardMaterial;
  stoneCool: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  marble: THREE.MeshStandardMaterial;
  ground: THREE.MeshStandardMaterial;
  candle: THREE.MeshStandardMaterial;
}

export function createMaterialSet(): MaterialSet {
  return {
    stoneWall: new THREE.MeshStandardMaterial({ color: 0xc9b18a, roughness: 0.92, metalness: 0 }),
    stoneCool: new THREE.MeshStandardMaterial({ color: 0x8f938f, roughness: 0.95, metalness: 0 }),
    floor: new THREE.MeshStandardMaterial({ color: 0xb7a582, roughness: 0.85, metalness: 0 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.8, metalness: 0 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.35, metalness: 0.85 }),
    marble: new THREE.MeshStandardMaterial({ color: 0xe6ded0, roughness: 0.5, metalness: 0.05 }),
    ground: new THREE.MeshStandardMaterial({ color: 0x9b8a63, roughness: 1, metalness: 0 }),
    candle: new THREE.MeshStandardMaterial({ color: 0xf2e2b8, emissive: 0xffa53a, emissiveIntensity: 0.9, roughness: 0.6 })
  };
}

export function disposeMaterialSet(set: MaterialSet): void {
  for (const material of Object.values(set)) {
    for (const key of ['map', 'normalMap', 'roughnessMap', 'aoMap'] as const) {
      material[key]?.dispose();
    }
    material.dispose();
  }
}
