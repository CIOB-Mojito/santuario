import * as THREE from 'three';
import { SETTINGS } from '../config/settings';
import type { AssetRegistry } from '../assets/assetRegistry';
import type { MaterialSet } from '../assets/materials';

/**
 * Primera nave (seccion 21, fases 7-9). Fija la escala, el recorrido y el
 * contraste interior/exterior. Los materiales PBR reales (piedra, yeso, suelo,
 * madera, marmol, oro) se inyectan desde MaterialSet y reciben sus texturas
 * CC0 cuando el sistema de assets las carga. La geometria sigue siendo modular
 * y sustituible pieza a pieza.
 */
export class World {
  readonly root = new THREE.Group();
  readonly colliders: THREE.Box3[] = [];
  readonly interiorLights: THREE.PointLight[] = [];
  readonly landmarks: { object: THREE.Object3D; label: string }[] = [];
  /** Objetos agrupados seleccionables desde el Modo Constructor (panel y rayo). */
  readonly selectables: { object: THREE.Object3D; label: string }[] = [];
  /**
   * Cascara de la nave (muros, contrafuertes, fachadas, cubierta, armazon,
   * columnas y roseton) agrupada como UNA sola entrada seleccionable, en
   * lugar de exponer cada malla interna. Suelos y peana quedan fuera y en
   * layer 1 para que el rayo de seleccion no los marque.
   */
  readonly shell = new THREE.Group();

  private readonly scene: THREE.Scene;
  private readonly registry: AssetRegistry;
  private readonly mat: MaterialSet;

  constructor(scene: THREE.Scene, registry: AssetRegistry, materials: MaterialSet) {
    this.scene = scene;
    this.registry = registry;
    this.mat = materials;
    this.shell.name = 'nave.estructura';
    scene.add(this.root);
    this.root.add(this.shell);
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
      { id: 'environment.ground', kind: 'environment', url: null, priority: 'critical', bytes: 0, maxDistance: 600 }
    ]);
  }

  private buildExterior(): void {
    const size = SETTINGS.world.groundSize;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.mat.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = SETTINGS.world.floorHeight - 0.02;
    ground.receiveShadow = true;
    ground.layers.set(1);
    ground.name = 'suelo.exterior';
    this.root.add(ground);

    // Terrado que sostiene la nave: da un borde claro al recorrido.
    const terrace = this.addBox(150, 0.5, 150, 0, -0.26, 0, this.mat.stoneCool, false, this.root);
    terrace.layers.set(1);
    terrace.name = 'suelo.terrado';
  }

  private buildNave(): void {
    const halfWidth = 9;
    const wallHeight = 14;
    const length = 64;
    const halfLength = length / 2;

    // Suelo interior, ligeramente elevado. Es colisionable para que el jugador
    // y los modelos colocados queden apoyados en su cara superior (y=0.4).
    const floor = this.addBox(halfWidth * 2, 0.4, length, 0, 0.2, 0, this.mat.floor, true, this.root);
    floor.layers.set(1);
    floor.name = 'suelo.nave';

    // Muros laterales con contrafuertes (escalonados hacia el exterior).
    for (const side of [-1, 1]) {
      this.addBox(0.9, wallHeight, length, side * (halfWidth + 0.45), wallHeight / 2, 0, this.mat.stoneWall, true);
      for (let z = -halfLength + 4; z <= halfLength - 4; z += 8) {
        this.addBox(1.4, wallHeight * 0.8, 1.4, side * (halfWidth + 1.1), wallHeight * 0.4, z, this.mat.stoneCool, true);
        this.addBox(1.7, wallHeight * 0.55, 1.7, side * (halfWidth + 1.35), wallHeight * 0.275, z, this.mat.stoneCool, false);
        this.addBox(1.0, 1.2, 1.6, side * (halfWidth + 1.55), 0.8, z, this.mat.stoneCool, false);
      }
    }

    // Fachada frontal con puerta: dos jambas y un dintel alto.
    const doorHalf = 3.2;
    const sideSeg = halfWidth - doorHalf;
    this.addBox(sideSeg, wallHeight, 1.2, -(doorHalf + sideSeg / 2), wallHeight / 2, halfLength, this.mat.stoneWall, true);
    this.addBox(sideSeg, wallHeight, 1.2, doorHalf + sideSeg / 2, wallHeight / 2, halfLength, this.mat.stoneWall, true);
    this.addBox(doorHalf * 2, wallHeight - 7, 1.2, 0, 7 + (wallHeight - 7) / 2, halfLength, this.mat.stoneWall, true);

    // Muro del fondo.
    this.addBox(halfWidth * 2 + 2, wallHeight, 1.2, 0, wallHeight / 2, -halfLength, this.mat.stoneWall, true);

    // Cubierta a dos aguas.
    const roofLen = length + 2;
    const slope = Math.atan2(6, halfWidth + 1);
    for (const side of [-1, 1]) {
      const panel = this.addBox(11.4, 0.6, roofLen, 0, 0, 0, this.mat.wood, false);
      panel.position.set(side * (halfWidth / 2 + 0.6), wallHeight + 2.6, 0);
      panel.rotation.z = -side * slope;
    }

    // Columnas de dos filas.
    for (const side of [-1, 1]) {
      for (let z = -halfLength + 8; z <= halfLength - 8; z += 8) {
        this.addColumn(side * 5.2, 0, z, 11.5, true);
      }
    }

    this.buildVault(halfWidth, wallHeight, halfLength);
    this.addRoseWindow(halfLength, wallHeight);

    // Altar al fondo, sobre plataforma.
    const dais = this.addBox(7, 0.5, 4, 0, 0.65, -halfLength + 5, this.mat.stoneCool, true, this.root);
    dais.layers.set(1);
    const altar = this.addBox(3.2, 1.4, 1.6, 0, 1.6, -halfLength + 5, this.mat.gold, true, this.root);
    altar.userData.builderName = 'Altar de la Primera Memoria';
    this.landmarks.push({ object: altar, label: 'Altar de la Primera Memoria' });
    this.selectables.push({ object: this.shell, label: 'Nave (estructura)' });
    this.selectables.push({ object: altar, label: 'Altar de la Primera Memoria' });

    // Las esculturas y el candelabro son modelos reales (OpenGameArt, CC0)
    // cargados por el streaming y colocados desde src/world/placements.ts.

    // Luz calida del interior (las velas reales se colocan aparte).
    for (const x of [-2.4, 2.4]) {
      const light = new THREE.PointLight(0xffb066, 6, 14, 2);
      light.position.set(x, 1.9, -halfLength + 4.2);
      this.root.add(light);
      this.interiorLights.push(light);
    }
  }


  /** Armazon de madera bajo la cubierta: vigas transversales y correas. */
  private buildVault(halfWidth: number, wallHeight: number, halfLength: number): void {
    const beamY = wallHeight - 2.4;
    for (let z = -halfLength + 8; z <= halfLength - 8; z += 8) {
      const tie = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2 + 1, 0.35, 0.45), this.mat.wood);
      tie.position.set(0, beamY, z);
      tie.castShadow = true;
      this.shell.add(tie);
    }
    for (const side of [-1, 1]) {
      const purlin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, halfLength * 2 - 4), this.mat.wood);
      purlin.position.set(side * 4.6, beamY + 0.6, 0);
      purlin.castShadow = true;
      this.shell.add(purlin);
    }
  }

  /** Roseton en la fachada frontal, sobre la puerta. */
  private addRoseWindow(halfLength: number, wallHeight: number): void {
    const z = halfLength + 0.7;
    const y = wallHeight - 3.4;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.35, 10, 32), this.mat.stoneCool);
    ring.position.set(0, y, z);
    ring.castShadow = true;
    this.shell.add(ring);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 16), this.mat.stoneCool);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(0, y, z);
    this.shell.add(hub);

    for (let i = 0; i < 6; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.22, 5, 0.3), this.mat.stoneCool);
      spoke.position.set(0, y, z - 0.05);
      spoke.rotation.z = (i * Math.PI) / 6;
      this.shell.add(spoke);
    }
  }

  private addColumn(x: number, y: number, z: number, height: number, collide: boolean): void {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, height, 16), this.mat.stoneWall);
    shaft.position.set(x, y + height / 2, z);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    this.shell.add(shaft);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 1.8), this.mat.stoneCool);
    cap.position.set(x, y + height + 0.25, z);
    cap.castShadow = true;
    this.shell.add(cap);

    if (collide) {
      this.colliders.push(new THREE.Box3().setFromObject(shaft));
    }
  }

  private addBox(w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, collide: boolean, parent: THREE.Object3D = this.shell): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    if (collide) {
      mesh.updateMatrixWorld(true);
      this.colliders.push(new THREE.Box3().setFromObject(mesh));
    }
    return mesh;
  }

  /**
   * Altura de la superficie pisable en (x, z). Solo considera obstaculos bajos
   * (losas, plataformas, escalones) y nunca muros ni columnas, para poder
   * apoyar encima personajes, estatuas y props de forma automatica.
   */
  surfaceHeightAt(x: number, z: number, radius = 0.6): number {
    let top: number = SETTINGS.world.floorHeight;
    for (const box of this.colliders) {
      if (box.max.y - box.min.y > 2) continue;
      if (x + radius < box.min.x || x - radius > box.max.x) continue;
      if (z + radius < box.min.z || z - radius > box.max.z) continue;
      if (box.max.y > top) top = box.max.y;
    }
    return top;
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
