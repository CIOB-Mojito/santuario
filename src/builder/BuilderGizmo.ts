import * as THREE from 'three';

export type GizmoTool = 'move' | 'rotate' | 'scale';

export const GIZMO_TOOLS: readonly GizmoTool[] = ['move', 'rotate', 'scale'];
export const GIZMO_AXES = ['X', 'Y', 'Z'] as const;
export type GizmoAxis = (typeof GIZMO_AXES)[number];

export interface GizmoHit {
  readonly tool: GizmoTool;
  readonly axis: GizmoAxis;
}

export const AXIS_COLORS: Record<GizmoAxis, number> = { X: 0xff5252, Y: 0x6bde6b, Z: 0x66a3ff };
export const SCALE_COLOR = 0xffd36e;

export function rayPlaneHit(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  planePoint: THREE.Vector3,
  planeNormal: THREE.Vector3,
  out: THREE.Vector3
): THREE.Vector3 | null {
  const nd = dir.dot(planeNormal);
  if (Math.abs(nd) < 1e-6) return null;
  const t = new THREE.Vector3().copy(planePoint).sub(origin).dot(planeNormal) / nd;
  if (t < 0) return null;
  return out.copy(origin).addScaledVector(dir, t);
}

/** Proyeccion de un punto sobre un eje (distancia con signo desde el origen). */
export function axisParam(start: THREE.Vector3, axis: THREE.Vector3, hit: THREE.Vector3): number {
  return new THREE.Vector3().copy(hit).sub(start).dot(axis);
}

/**
 * Angulo (radianes) del punto alrededor del eje, medido desde una base viva
 * anclada a la camara (u perpendicular a camara|eje, v perpendicular a ambos).
 */
export function angleInBasis(
  point: THREE.Vector3,
  axis: THREE.Vector3,
  cameraPos: THREE.Vector3,
  out: THREE.Vector3
): number {
  const u = new THREE.Vector3().crossVectors(cameraPos, axis);
  if (u.lengthSq() < 1e-8) u.set(0, 1, 0);
  u.normalize();
  const v = new THREE.Vector3().crossVectors(axis, u).normalize();
  out.copy(point).normalize();
  return Math.atan2(out.dot(u), out.dot(v));
}

export function snapAngle(value: number, snap: number): number {
  return Math.round(value / snap) * snap;
}

export function uniformScaleFactor(base: number, dy: number, k = 0.04, min = 0.05, max = 20): number {
  return Math.max(min, Math.min(max, base * Math.exp(-dy * k)));
}

/**
 * Gizmo de transformaciones del Modo Constructor. Vive en la capa 1 para que el
 * rayo de seleccion de la escena (capa 0) nunca lo "toque"; se recoge con un
 * Raycaster propio de capa 1. Anclado en la posicion del objeto seleccionado y
 * alineado a los ejes del mundo.
 */
export class BuilderGizmo {
  readonly group = new THREE.Group();

  private readonly camera: THREE.PerspectiveCamera;
  private readonly raycaster = new THREE.Raycaster();

  constructor(camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    this.camera = camera;
    this.scene = scene;
    this.group.layers.set(1);
    this.group.traverse((o) => o.layers.set(1));
    this.buildHandles();
    this.setTool('move');
    this.setPosition(null);
    this.scene.add(this.group);
  }

  private readonly scene: THREE.Scene;

  /**
   * 3 flechas (mover) + 3 anillos (rotar) + 1 cubo (escalar). Las geometrias de
   * cada tool se agrupan para mostrarse/ocultarse como un solo set.
   */
  private buildHandles(): void {
    const arrowGroups: Record<GizmoAxis, THREE.Group> = { X: new THREE.Group(), Y: new THREE.Group(), Z: new THREE.Group() };
    const ringGroups: Record<GizmoAxis, THREE.Group> = { X: new THREE.Group(), Y: new THREE.Group(), Z: new THREE.Group() };

    for (const axis of GIZMO_AXES) {
      const color = AXIS_COLORS[axis];

      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 12), new THREE.MeshBasicMaterial({ color }));
      shaft.position.y = 0.5;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.34, 16), new THREE.MeshBasicMaterial({ color }));
      tip.position.y = 1.22;
      const axisGroup = arrowGroups[axis];
      axisGroup.add(shaft, tip);
      axisGroup.children.forEach((c) => c.layers.set(1));
      axisGroup.userData = { tool: 'move', axis };
      this.group.add(axisGroup);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 10, 48), new THREE.MeshBasicMaterial({ color }));
      ring.layers.set(1);
      ring.userData = { tool: 'rotate', axis };
      ringGroups[axis].add(ring);
      this.group.add(ringGroups[axis]);
    }

    // Alinear: Y ya apuntan hacia arriba; X = -90º en Z; Z = +90º en X.
    arrowGroups.X.rotation.z = -Math.PI / 2;
    arrowGroups.Z.rotation.x = Math.PI / 2;
    // Torus: normal +Z. X -> giro en Y; Y -> giro en X.
    ringGroups.X.rotation.y = Math.PI / 2;
    ringGroups.Y.rotation.x = Math.PI / 2;

    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), new THREE.MeshBasicMaterial({ color: SCALE_COLOR }));
    cube.userData = { tool: 'scale', axis: 'Y' };
    cube.layers.set(1);
    this.group.add(cube);

    this.toolSets = {
      move: [...arrowGroups.X.children, ...arrowGroups.Y.children, ...arrowGroups.Z.children],
      rotate: [ringGroups.X, ringGroups.Y, ringGroups.Z],
      scale: [cube]
    };
  }

  private toolSets: Record<GizmoTool, THREE.Object3D[]> = {
    move: [],
    rotate: [],
    scale: []
  };

  setTool(tool: GizmoTool): void {
    for (const key of GIZMO_TOOLS) {
      for (const o of this.toolSets[key]) o.visible = key === tool;
    }
  }

  setPosition(position: THREE.Vector3 | null): void {
    if (!position) {
      this.group.visible = false;
      return;
    }
    this.group.position.copy(position);
    this.group.visible = true;
  }

  setRadius(radius: number): void {
    const r = Math.max(0.4, Math.min(3, radius));
    this.group.scale.setScalar(r);
  }

  pick(ndc: THREE.Vector2): GizmoHit | null {
    if (!this.group.visible) return null;
    this.raycaster.layers.set(1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.group.children, true);
    for (const hit of hits) {
      let node: THREE.Object3D | null = hit.object;
      let chainVisible = true;
      while (node && node !== this.group) {
        if (!node.visible) {
          chainVisible = false;
          break;
        }
        const ud = node.userData as { tool?: GizmoTool; axis?: GizmoAxis } | undefined;
        if (chainVisible && ud?.tool && ud.axis) return { tool: ud.tool, axis: ud.axis };
        node = node.parent;
      }
    }
    return null;
  }

  get visible(): boolean {
    return this.group.visible;
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) for (const m of material) m.dispose();
      else material?.dispose();
    });
  }
}