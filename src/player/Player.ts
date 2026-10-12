import * as THREE from 'three';
import { SETTINGS } from '../config/settings';

/**
 * Estado fisico del jugador (seccion 7): posicion, velocidad con inercia real
 * (aceleracion + amortiguacion), gravedad/salto y resolucion de colision contra
 * cajas AABB. La colision tiene en cuenta la altura: los obstaculos bajos
 * (<= stepHeight) se superan automaticamente y los altos se bloquean o saltan.
 * No conoce la camara ni el DOM; recibe una direccion de movimiento y un yaw.
 */
export class Player {
  readonly position = new THREE.Vector3(0, SETTINGS.player.eyeHeight, 46);
  readonly velocity = new THREE.Vector3();
  /** x = desplazamiento lateral, y = avance. Magnitud <= 1. */
  readonly moveInput = new THREE.Vector2();

  running = false;
  yaw = 0;
  grounded = true;

  private verticalVelocity = 0;
  private jumpRequested = false;

  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private readonly touched = new Set<THREE.Box3>();
  private bounds = SETTINGS.world.groundSize / 2 - 12;

  get speed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  setWorldBounds(halfExtent: number): void {
    this.bounds = halfExtent;
  }

  /** Encola un salto; se consume en el proximo update si esta en el suelo. */
  requestJump(): void {
    this.jumpRequested = true;
  }

  update(dt: number, colliders: readonly THREE.Box3[]): boolean {
    const p = SETTINGS.player;
    const input = this.moveInput;
    const magnitude = input.length();
    const feet = this.position.y - p.eyeHeight;

    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    this.desired.set(0, 0, 0);
    if (magnitude > 1e-4) {
      const scale = Math.min(magnitude, 1) / magnitude;
      this.desired
        .copy(this.forward).multiplyScalar(input.y * scale)
        .addScaledVector(this.right, input.x * scale);
      this.desired.normalize().multiplyScalar(this.running ? p.runSpeed : p.walkSpeed);
    }

    // Velocidad objetivo suavizada: alcanza la velocidad pedida sin pasarse y
    // frena con inercia al soltar. Estable a cualquier framerate.
    const k = 1 - Math.exp(-p.smoothing * dt);
    this.velocity.x += (this.desired.x - this.velocity.x) * k;
    this.velocity.z += (this.desired.z - this.velocity.z) * k;

    let speed = this.speed;
    if (magnitude < 1e-4 && speed < 0.02 && this.grounded) {
      this.velocity.set(0, 0, 0);
      speed = 0;
    } else if (speed > 0.001) {
      this.position.x += this.velocity.x * dt;
      this.position.z += this.velocity.z * dt;
      this.resolveCollisions(colliders, feet);
      this.clampToBounds();
      speed = this.speed;
    }

    this.updateVertical(dt, colliders, feet);
    return speed > 0.01 || !this.grounded;
  }

  /**
   * Colision horizontal consciente de la altura: una caja cuya parte superior
   * queda al alcance de un escalon no bloquea (se sube al caminar por encima);
   * las cajas por encima de la cabeza se ignoran; el resto empuja al jugador.
   */
  private resolveCollisions(colliders: readonly THREE.Box3[], feet: number): void {
    this.touched.clear();
    const p = SETTINGS.player;
    const r = p.radius;
    const stepTop = feet + p.stepHeight;
    const head = feet + p.bodyHeight;
    for (const box of colliders) {
      if (box.max.y <= stepTop || box.min.y >= head) continue;
      if (this.position.x + r < box.min.x || this.position.x - r > box.max.x) continue;
      if (this.position.z + r < box.min.z || this.position.z - r > box.max.z) continue;

      const pushLeft = this.position.x - (box.min.x - r);
      const pushRight = box.max.x + r - this.position.x;
      const pushBack = this.position.z - (box.min.z - r);
      const pushFront = box.max.z + r - this.position.z;
      const min = Math.min(pushLeft, pushRight, pushBack, pushFront);

      if (min === pushLeft) this.position.x = box.min.x - r;
      else if (min === pushRight) this.position.x = box.max.x + r;
      else if (min === pushBack) this.position.z = box.min.z - r;
      else this.position.z = box.max.z + r;

      this.velocity.set(0, 0, 0);
    }
  }

  /** Gravedad, salto y soporte: sube escalones bajos y cae hasta el suelo. */
  private updateVertical(dt: number, colliders: readonly THREE.Box3[], feet: number): void {
    const p = SETTINGS.player;
    const r = p.radius * 0.5;
    const stepTop = feet + p.stepHeight;

    let groundY: number = SETTINGS.world.floorHeight;
    for (const box of colliders) {
      if (box.max.y > stepTop) continue;
      if (this.position.x + r < box.min.x || this.position.x - r > box.max.x) continue;
      if (this.position.z + r < box.min.z || this.position.z - r > box.max.z) continue;
      if (box.max.y > groundY) groundY = box.max.y;
    }

    if (this.jumpRequested && this.grounded) {
      this.verticalVelocity = p.jumpSpeed;
      this.grounded = false;
    }
    this.jumpRequested = false;

    let nextFeet = feet + this.verticalVelocity * dt - 0.5 * p.gravity * dt * dt;
    this.verticalVelocity -= p.gravity * dt;

    if (nextFeet <= groundY) {
      nextFeet = groundY;
      this.verticalVelocity = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }
    this.position.y = nextFeet + p.eyeHeight;
  }

  private clampToBounds(): void {
    this.position.x = Math.max(-this.bounds, Math.min(this.bounds, this.position.x));
    this.position.z = Math.max(-this.bounds, Math.min(this.bounds, this.position.z));
  }
}
