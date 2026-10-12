import * as THREE from 'three';
import { SETTINGS } from '../config/settings';
import type { Player } from './Player';

/**
 * Camara en primera persona con control por mirada y balanceo de cabeza
 * (seccion 7). El orden de rotacion YXZ evita el "roll" tipico de una camara
 * de juego y mantiene el horizonte recto.
 */
export class CameraController {
  readonly camera: THREE.PerspectiveCamera;

  yaw = 0;
  pitch = 0;
  private bobPhase = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(SETTINGS.render.fov, aspect, SETTINGS.render.near, SETTINGS.render.far);
    this.camera.rotation.order = 'YXZ';
  }

  /** dx, dy en pixeles de desplazamiento del puntero/dedo. */
  look(dx: number, dy: number): void {
    const p = SETTINGS.player;
    this.yaw -= dx * p.lookSpeed;
    this.pitch -= dy * p.lookSpeed;
    this.pitch = Math.max(p.minPitch, Math.min(p.maxPitch, this.pitch));
  }

  update(dt: number, player: Player): void {
    const p = SETTINGS.player;
    const speedFactor = Math.min(player.speed / p.runSpeed, 1);
    if (player.speed > 0.25) {
      this.bobPhase += dt * p.headBobFrequency * (0.55 + speedFactor);
    } else {
      this.bobPhase += dt * 1.5;
    }
    const bob = Math.sin(this.bobPhase) * p.headBobAmplitude * speedFactor;

    this.camera.position.set(player.position.x, player.position.y + bob, player.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
