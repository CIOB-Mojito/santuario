import * as THREE from 'three';
import { SETTINGS } from '../config/settings';
import type { AssetRegistry } from '../assets/AssetRegistry';

/**
 * Masa provisional de la Nave de la Primera Memoria (seccion 15/40-fase 9).
 * NO es la version final: es la vertical slice geometrica que fija la escala,
 * el recorrido y el contraste interior/exterior. Los materiales ya llevan
 * intencion (arenisca, piedra fria, madera, oro) aunque todavia no tengan
 * textura. Todo lo sustituible se registra en el AssetRegistry.
 */
export class World {
  readonly root = new THREE.Group();
  readonly colliders: THREE.Box3[] = [];
  readonly interiorLights: THREE.PointLight[] = [];
  readonly landmarks: { object: THREE.Object3D; label: string }[] = [];

  private readonly scene: THREE.Scene;
  private readonly registry: AssetRegistry;

  private readonly stoneWarm = new THREE.MeshStandardMaterial({ color: 0xc9b18a, roughness: 0.92, metalness: 0.0 });
  private readonly stoneCool = new THREE.MeshStandardMaterial({ color: 0x8f938f, roughness: 0.95, metalness: 0.0 });
  private readonly floorMat = new THREE.MeshStandardMaterial({ color: 0xb7a582, roughness: 0.85, metalness: 0.0 });
  private readonly woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.8, metalness: 0.0 });
  private readonly goldMat = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.35, metalness: 0.75 });
  private readonly marbleMat = new THREE.MeshStandardMaterial({ color: 0xe6ded0, roughness: 0.55, metalness: 0.05 });
  private readonly groundMat = new THREE.MeshStandardMaterial({ color: 0x9b8a63, roughness: 1.0, metalness: 0.0 });
  private readonly candleMat = new THREE.MeshStandardMaterial({ color: 0xf2e2b8, emissive: 0xffa53a, emissiveIntensity: 0.9, roughness: 0.6 });

  constructor(scene: THREE.Scene, registry: AssetRegistry) {
    this.scene = scene;
    this.registry = registry;
    scene.add(this.root);
  }

  build(): void {
    this.buildExterior();
    this.buildNave();
    this.registerAssets();
  }

  private registerAssets(): void {
    this.registry.registerMany([
      { id: 'nave.shell', kind: 'architecture', url: null, priority: 'critical', bytes: 0, maxDistance: 200, notes: 'Cascara de la nave; pendiente de modelo real' },
      { id: 'nave.columns', kind: 'architecture', url: null, priority: 'high', bytes: 0, maxDistance: 120 },
      { id: 'nave.altar', kind: 'altar', url: null, priority: 'high', bytes: 0, maxDistance: 90 },
      { id: 'sculptures.two', kind: 'statue', url: null, priority: 'medium', bytes: 0, maxDistance: 90 },
      { id: 'environment.ground', kind: 'environment', url: null, priority: 'critical', bytes: 0, maxDistance: 600 }
    ]);
  }

  private buildExterior(): void {
    const size = SETTINGS.world.groundSize;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = SETTINGS.world.floorHeight - 0.02;
    ground.receiveShadow = true;
    this.root.add(ground);

    // Terrado que sostiene la nave: da un borde claro al recorrido.
    this.addBox(150, 0.5, 150, 0, -0.26, 0, this.stoneCool, false);
  }

  private buildNave(): void {
    const halfWidth = 9;
    const wallHeight = 14;
    const length = 64;
    const halfLength = length / 2;

    // Suelo interior, ligeramente elevado.
    this.addBox(halfWidth * 2, 0.4, length, 0, 0.2, 0, this.floorMat, false);

    // Muros laterales con contrafuertes.
    for (const side of [-1, 1]) {
      this.addBox(0.9, wallHeight, length, side * (halfWidth + 0.45), wallHeight / 2, 0, this.stoneWarm, true);
      for (let z = -halfLength + 4; z <= halfLength - 4; z += 8) {
        this.addBox(1.4, wallHeight * 0.8, 1.4, side * (halfWidth + 1.1), wallHeight * 0.4, z, this.stoneCool, true);
      }
    }

    // Fachada frontal con puerta: dos jambas y un dintel alto.
    const doorHalf = 3.2;
    const sideSeg = halfWidth - doorHalf;
    this.addBox(sideSeg, wallHeight, 1.2, -(doorHalf + sideSeg / 2), wallHeight / 2, halfLength, this.stoneWarm, true);
    this.addBox(sideSeg, wallHeight, 1.2, doorHalf + sideSeg / 2, wallHeight / 2, halfLength, this.stoneWarm, true);
    this.addBox(doorHalf * 2, wallHeight - 7, 1.2, 0, 7 + (wallHeight - 7) / 2, halfLength, this.stoneWarm, true);

    // Muro del fondo.
    this.addBox(halfWidth * 2 + 2, wallHeight, 1.2, 0, wallHeight / 2, -halfLength, this.stoneWarm, true);

    // Cubierta a dos aguas.
    const roofLen = length + 2;
    const slope = Math.atan2(6, halfWidth + 1);
    for (const side of [-1, 1]) {
      const panel = this.addBox(11.4, 0.6, roofLen, 0, 0, 0, this.woodMat, false);
      panel.position.set(side * (halfWidth / 2 + 0.6), wallHeight + 2.6, 0);
      panel.rotation.z = -side * slope;
    }

    // Columnas de dos filas.
    for (const side of [-1, 1]) {
      for (let z = -halfLength + 8; z <= halfLength - 8; z += 8) {
        this.addColumn(side * 5.2, 0, z, 11.5, true);
      }
    }

    // Altar al fondo, sobre plataforma.
    this.addBox(7, 0.5, 4, 0, 0.65, -halfLength + 5, this.stoneCool, true);
    const altar = this.addBox(3.2, 1.4, 1.6, 0, 1.6, -halfLength + 5, this.goldMat, true);
    this.landmarks.push({ object: altar, label: 'Altar de la Primera Memoria' });

    // Dos esculturas flanqueando el altar.
    this.addSculpture(-3.2, -halfLength + 7);
    this.addSculpture(3.2, -halfLength + 7);

    // Velas: calor local del interior.
    for (const x of [-2.4, 2.4]) {
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.1, 10), this.candleMat);
      candle.position.set(x, 1.35, -halfLength + 4.2);
      candle.castShadow = false;
      this.root.add(candle);

      const light = new THREE.PointLight(0xffb066, 6, 14, 2);
      light.position.set(x, 1.9, -halfLength + 4.2);
      this.root.add(light);
      this.interiorLights.push(light);
    }
  }

  private addSculpture(x: number, z: number): void {
    const base = this.addBox(1.4, 1.6, 1.4, x, 1.3, z, this.stoneCool, true);
    base.castShadow = true;
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 2.4, 12), this.marbleMat);
    torso.position.set(x, 3.3, z);
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.root.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), this.marbleMat);
    head.position.set(x, 4.75, z);
    head.castShadow = true;
    this.root.add(head);
    this.colliders.push(new THREE.Box3().setFromObject(torso));
    this.landmarks.push({ object: torso, label: 'Vigilante de piedra' });
  }

  private addColumn(x: number, y: number, z: number, height: number, collide: boolean): void {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, height, 16), this.stoneWarm);
    shaft.position.set(x, y + height / 2, z);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    this.root.add(shaft);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 1.8), this.stoneCool);
    cap.position.set(x, y + height + 0.25, z);
    cap.castShadow = true;
    this.root.add(cap);

    if (collide) {
      this.colliders.push(new THREE.Box3().setFromObject(shaft));
    }
  }

  private addBox(w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, collide: boolean): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    if (collide) {
      mesh.updateMatrixWorld(true);
      this.colliders.push(new THREE.Box3().setFromObject(mesh));
    }
    return mesh;
  }

  /** Relaciona una posicion con una zona (usada por audio, niebla y narrativa). */
  dispose(): void {
    this.scene.remove(this.root);
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
  }

  get meshCount(): number {
    let n = 0;
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) n++;
    });
    return n;
  }
}
