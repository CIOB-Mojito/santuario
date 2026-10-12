import * as THREE from 'three';
import { SETTINGS } from '../config/settings';

/**
 * Estado fisico del jugador (seccion 7): posicion, velocidad con inercia real
 * (aceleracion + amortiguacion), y resolucion de colision contra cajas AABB.
 * No conoce la camara ni el DOM; recibe una direccion de movimiento y un yaw.
 */
export class Player {
  readonly position = new THREE.Vector3(0, SETTINGS.player.eyeHeight, 46);
  readonly velocity = new THREE.Vector3();
  /** x = desplazamiento lateral, y = avance. Magnitud <= 1. */
  readonly moveInput = new THREE.Vector2();

  running = false;
  yaw = 0;

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

  update(dt: number, colliders: readonly THREE.Box3[]): boolean {
    const p = SETTINGS.player;
    const input = this.moveInput;
    const magnitude = input.length();

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
    if (magnitude < 1e-4 && Math.hypot(this.velocity.x, this.velocity.z) < 0.02) {
      this.velocity.set(0, 0, 0);
      return false;
    }

    const speed = this.speed;
    if (speed > 0.001) {
      this.position.x += this.velocity.x * dt;
      this.position.z += this.velocity.z * dt;
      this.resolveCollisions(colliders);
      this.clampToBounds();
    }
    return speed > 0.01;
  }

  private resolveCollisions(colliders: readonly THREE.Box3[]): void {
    this.touched.clear();
    const r = SETTINGS.player.radius;
    for (const box of colliders) {
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

  private clampToBounds(): void {
    this.position.x = Math.max(-this.bounds, Math.min(this.bounds, this.position.x));
    this.position.z = Math.max(-this.bounds, Math.min(this.bounds, this.position.z));
  }
}
