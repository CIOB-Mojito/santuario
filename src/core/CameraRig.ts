import * as THREE from 'three';

export type CameraMode = 'ORBIT' | 'FREE';

export type MoveDirection = 'forward' | 'back' | 'left' | 'right' | 'up' | 'down';

interface PointerState {
  x: number;
  y: number;
}

/** Limites de seguridad del modo FREE para no perder la escena. */
const FREE_BOUNDS = {
  min: new THREE.Vector3(-60, 0.5, -70),
  max: new THREE.Vector3(60, 45, 70)
};

const FREE_MIN_PITCH = -1.4;
const FREE_MAX_PITCH = 1.4;

/**
 * Camara del santuario. Conserva el modo ORBIT original (orbita con inercia,
 * mouse, tactil y teclado) y suma un modo FREE de exploracion: mirada con
 * arrastre y desplazamiento relativo a la orientacion. Hay una sola camara, un
 * solo juego de listeners y un unico punto de actualizacion por frame.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;

  private mode: CameraMode = 'ORBIT';

  // Estado ORBIT.
  private theta = 0.6;
  private phi = 1.32;
  private radius = 30;
  private targetRadius = 30;
  private readonly target = new THREE.Vector3(0, 3.5, 0);
  private readonly pointers = new Map<number, PointerState>();
  private readonly dom: HTMLElement;
  private readonly minRadius = 6;
  private readonly maxRadius = 70;
  private readonly minPhi = 0.35;
  private readonly maxPhi = 1.55;

  // Estado FREE.
  private freeYaw = 0;
  private freePitch = 0;
  private targetYaw = 0;
  private targetPitch = 0;
  private moveSpeed = 9;
  private readonly velocity = new THREE.Vector3();
  private readonly intent: Record<MoveDirection, boolean> = {
    forward: false,
    back: false,
    left: false,
    right: false,
    up: false,
    down: false
  };
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly forwardVec = new THREE.Vector3();
  private readonly rightVec = new THREE.Vector3();
  private readonly desiredVel = new THREE.Vector3();
  private readonly worldUp = new THREE.Vector3(0, 1, 0);

  constructor(dom: HTMLElement, aspect: number) {
    this.dom = dom;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 400);

    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('pointercancel', this.onPointerUp);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.releaseAll);
    document.addEventListener('visibilitychange', this.onVisibility);

    this.update(0);
  }

  get currentMode(): CameraMode {
    return this.mode;
  }

  /**
   * Cambia de modo conservando la posicion y, en lo posible, la orientacion.
   * ORBIT -> FREE: deriva yaw/pitch de la orientacion actual de la camara.
   * FREE -> ORBIT: recalcula la esfera orbital desde la posicion actual.
   */
  setMode(mode: CameraMode): void {
    if (mode === this.mode) return;
    if (mode === 'FREE') {
      this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
      this.freeYaw = this.targetYaw = this.euler.y;
      this.freePitch = this.targetPitch = clamp(this.euler.x, FREE_MIN_PITCH, FREE_MAX_PITCH);
      this.velocity.set(0, 0, 0);
    } else {
      const offset = new THREE.Vector3().subVectors(this.camera.position, this.target);
      const r = Math.max(offset.length(), 0.001);
      this.theta = Math.atan2(offset.x, offset.z);
      this.phi = clamp(Math.acos(clamp(offset.y / r, -1, 1)), this.minPhi, this.maxPhi);
      this.radius = this.targetRadius = clamp(r, this.minRadius, this.maxRadius);
    }
    this.releaseAll();
    this.mode = mode;
  }

  setMoveSpeed(speed: number): void {
    this.moveSpeed = Math.max(0.1, speed);
  }

  pressMove(direction: MoveDirection): void {
    this.intent[direction] = true;
  }

  releaseMove(direction: MoveDirection): void {
    this.intent[direction] = false;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    if (this.mode === 'FREE') {
      this.updateFree(dt);
      return;
    }

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
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.releaseAll);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.pointers.clear();
  }

  private updateFree(dt: number): void {
    const look = Math.min(1, dt * 15);
    this.freeYaw += (this.targetYaw - this.freeYaw) * look;
    this.freePitch += (this.targetPitch - this.freePitch) * look;
    this.euler.set(this.freePitch, this.freeYaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this.euler);

    const forwardSign = (this.intent.forward ? 1 : 0) - (this.intent.back ? 1 : 0);
    const rightSign = (this.intent.right ? 1 : 0) - (this.intent.left ? 1 : 0);
    const upSign = (this.intent.up ? 1 : 0) - (this.intent.down ? 1 : 0);

    this.desiredVel.set(0, 0, 0);
    if (forwardSign !== 0) {
      this.camera.getWorldDirection(this.forwardVec);
      this.desiredVel.addScaledVector(this.forwardVec, forwardSign);
    }
    if (rightSign !== 0) {
      this.camera.getWorldDirection(this.forwardVec);
      this.rightVec.crossVectors(this.forwardVec, this.worldUp).normalize();
      this.desiredVel.addScaledVector(this.rightVec, rightSign);
    }
    if (upSign !== 0) {
      this.desiredVel.addScaledVector(this.worldUp, upSign);
    }
    if (this.desiredVel.lengthSq() > 0) {
      this.desiredVel.normalize().multiplyScalar(this.moveSpeed);
    }

    this.velocity.lerp(this.desiredVel, Math.min(1, dt * 8));
    this.camera.position.addScaledVector(this.velocity, dt);
    this.camera.position.clamp(FREE_BOUNDS.min, FREE_BOUNDS.max);
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;

    if (this.mode === 'FREE') {
      this.targetYaw -= (e.clientX - p.x) * 0.005;
      this.targetPitch = clamp(
        this.targetPitch - (e.clientY - p.y) * 0.005,
        FREE_MIN_PITCH,
        FREE_MAX_PITCH
      );
      p.x = e.clientX;
      p.y = e.clientY;
      return;
    }

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
    if (this.mode === 'FREE') return;
    this.targetRadius = clamp(
      this.targetRadius * (1 + e.deltaY * 0.001),
      this.minRadius,
      this.maxRadius
    );
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.mode === 'FREE') {
      switch (e.key.toLowerCase()) {
        case 'w':
          this.intent.forward = true;
          break;
        case 's':
          this.intent.back = true;
          break;
        case 'a':
          this.intent.left = true;
          break;
        case 'd':
          this.intent.right = true;
          break;
        case 'e':
          this.intent.up = true;
          break;
        case 'q':
          this.intent.down = true;
          break;
        case 'arrowleft':
          this.targetYaw += 0.08;
          break;
        case 'arrowright':
          this.targetYaw -= 0.08;
          break;
        case 'arrowup':
          this.targetPitch = clamp(this.targetPitch + 0.06, FREE_MIN_PITCH, FREE_MAX_PITCH);
          break;
        case 'arrowdown':
          this.targetPitch = clamp(this.targetPitch - 0.06, FREE_MIN_PITCH, FREE_MAX_PITCH);
          break;
        default:
          return;
      }
      e.preventDefault();
      return;
    }

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

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    if (this.mode !== 'FREE') return;
    switch (e.key.toLowerCase()) {
      case 'w':
        this.intent.forward = false;
        break;
      case 's':
        this.intent.back = false;
        break;
      case 'a':
        this.intent.left = false;
        break;
      case 'd':
        this.intent.right = false;
        break;
      case 'e':
        this.intent.up = false;
        break;
      case 'q':
        this.intent.down = false;
        break;
      default:
        break;
    }
  };

  /** Corta cualquier movimiento en curso (blur, focus perdido, cambio de modo). */
  private readonly releaseAll = (): void => {
    this.intent.forward = false;
    this.intent.back = false;
    this.intent.left = false;
    this.intent.right = false;
    this.intent.up = false;
    this.intent.down = false;
  };

  private readonly onVisibility = (): void => {
    if (document.hidden) this.releaseAll();
  };
}

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
