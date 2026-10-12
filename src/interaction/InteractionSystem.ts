import * as THREE from 'three';

export interface Interactable {
  readonly object: THREE.Object3D;
  readonly label: string;
  readonly onClick: () => void;
}

/**
 * Interaccion por mirada (seccion 24). Proyecta un rayo desde el centro de la
 * camara y marca el objeto interactuable mas cercano. En movil el "clic" puede
 * venir del toque o de mantener la mirada; aqui se expone el objetivo actual y
 * la accion se dispara desde el controlador de entrada.
 */
export class InteractionSystem {
  private readonly raycaster = new THREE.Raycaster();
  private readonly center = new THREE.Vector2(0, 0);
  private readonly items: Interactable[] = [];
  private readonly maxDistance: number;

  current: Interactable | null = null;

  constructor(maxDistance = 6) {
    this.maxDistance = maxDistance;
  }

  add(item: Interactable): void {
    this.items.push(item);
  }

  update(camera: THREE.Camera): void {
    this.raycaster.setFromCamera(this.center, camera);
    this.raycaster.far = this.maxDistance;
    const objects = this.items.map((i) => i.object);
    const hits = this.raycaster.intersectObjects(objects, true);
    if (hits.length === 0) {
      this.current = null;
      return;
    }
    let node: THREE.Object3D | null = hits[0].object;
    while (node && !this.items.some((i) => i.object === node)) node = node.parent;
    this.current = this.items.find((i) => i.object === node) ?? null;
  }

  trigger(): boolean {
    if (!this.current) return false;
    this.current.onClick();
    return true;
  }

  get size(): number {
    return this.items.length;
  }
}
