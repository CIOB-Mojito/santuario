import * as THREE from 'three';
import type { Player } from './Player';

/**
 * Estado de entrada unico. Antes el teclado escribia directamente en el
 * jugador cada frame y pisaba al joystick tactil (por eso el personaje no se
 * movia en el telefono). Aqui cada fuente escribe su propio vector y solo la
 * fuente activa controla al jugador.
 */
export class InputState {
  readonly keyboard = new THREE.Vector2();
  readonly touch = new THREE.Vector2();

  keyboardActive = false;
  touchActive = false;
  private keyboardRunning = false;
  private touchRunning = false;

  get running(): boolean {
    if (this.touchActive) return this.touchRunning;
    return this.keyboardRunning;
  }

  setKeyboardRunning(value: boolean): void {
    this.keyboardRunning = value;
  }

  setTouchRunning(value: boolean): void {
    this.touchRunning = value;
  }

  /** Aplica la fuente activa al jugador (el tactil manda si esta en uso). */
  applyTo(player: Player): void {
    if (this.touchActive) player.moveInput.copy(this.touch);
    else if (this.keyboardActive) player.moveInput.copy(this.keyboard);
    else player.moveInput.set(0, 0);
    player.running = this.running;
  }
}
