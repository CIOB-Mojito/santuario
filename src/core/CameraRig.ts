import * as THREE from 'three';

interface PointerState {
  x: number;
  y: number;
}

/**
 * Camara orbital con inercia. Es deliberadamente simple para la Fase 1: permite
 * recorrer el santuario con mouse, dedo (uno y dos) y teclado. En una fase
 * posterior se le puede sumar un modo caminata sin tocar el resto del motor.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;

  private theta = 0.6;
  private phi = 1.32;
  private radius = 30;
  private targetRadius = 30;

  private readonly target = new THREE.Vector3(0, 3.5, 0);
  private readonly pointers = new Map<number, PointerState>();
  private readonly dom: HTMLElement;

  private minRadius = 6;
  private maxRadius = 70;
  private minPhi = 0.35;
  private maxPhi = 1.55;

  constructor(dom: HTMLElement, aspect: number) {
    this.dom = dom;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 400);

    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('pointercancel', this.onPointerUp);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);

    this.update(0);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    this.radius += (this.targetRadius - this.radius) * Math.min(1, dt * 8);
    const sinPhi = Math.sin(this.phi);
    this.camera.position.set(
      this.target.x + this.radius * sinPhi * Math.sin(this.theta),
      this.target.y + this.radius * Math.cos(this.phi),
      this.target.z + this.radius * sinPhi * Math.cos(this.theta)
    );
    this.camera.lookAt(this.target);
  }

  dispose(): void {
    this.dom.removeEventListener('pointerdown', this.onPointerDown);
    this.dom.removeEventListener('pointermove', this.onPointerMove);
    this.dom.removeEventListener('pointerup', this.onPointerUp);
    this.dom.removeEventListener('pointercancel', this.onPointerUp);
    this.dom.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    this.pointers.clear();
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;

    if (this.pointers.size === 1) {
      this.theta -= (e.clientX - p.x) * 0.006;
      this.phi = clamp(
        this.phi - (e.clientY - p.y) * 0.004,
        this.minPhi,
        this.maxPhi
      );
      p.x = e.clientX;
      p.y = e.clientY;
    } else if (this.pointers.size === 2) {
      let ox = 0;
      let oy = 0;
      for (const id of this.pointers.keys()) {
        if (id !== e.pointerId) {
          const other = this.pointers.get(id);
          if (other) {
            ox = other.x;
            oy = other.y;
          }
        }
      }
      const d0 = Math.hypot(p.x - ox, p.y - oy);
      const d1 = Math.hypot(e.clientX - ox, e.clientY - oy);
      if (d1 > 0) {
        this.targetRadius = clamp(
          this.targetRadius * (d0 / d1),
          this.minRadius,
          this.maxRadius
        );
      }
      p.x = e.clientX;
      p.y = e.clientY;
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.targetRadius = clamp(
      this.targetRadius * (1 + e.deltaY * 0.001),
      this.minRadius,
      this.maxRadius
    );
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    switch (e.key) {
      case 'ArrowLeft':
        this.theta += 0.07;
        break;
      case 'ArrowRight':
        this.theta -= 0.07;
        break;
      case 'ArrowUp':
        this.phi = clamp(this.phi - 0.05, this.minPhi, this.maxPhi);
        break;
      case 'ArrowDown':
        this.phi = clamp(this.phi + 0.05, this.minPhi, this.maxPhi);
        break;
      case '+':
      case '=':
        this.targetRadius = clamp(this.targetRadius * 0.9, this.minRadius, this.maxRadius);
        break;
      case '-':
      case '_':
        this.targetRadius = clamp(this.targetRadius * 1.1, this.minRadius, this.maxRadius);
        break;
      default:
        return;
    }
    e.preventDefault();
  };
}

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
