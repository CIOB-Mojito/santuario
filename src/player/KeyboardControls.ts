import type { InputState } from './InputState';
import type { CameraController } from './CameraController';
import type { InteractionSystem } from '../interaction/InteractionSystem';

/**
 * Entrada de escritorio: WASD/flechas para mover, Shift para correr, arrastre
 * del raton para mirar, E para interactuar. No escribe en el jugador: solo
 * actualiza su vector dentro de InputState, para no pisar el control tactil.
 */
export class KeyboardControls {
  private readonly camera: CameraController;
  private readonly input: InputState;
  private readonly pressed = new Set<string>();
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private readonly onPointerMove: (e: PointerEvent) => void;
  private readonly onPointerDown: (e: PointerEvent) => void;
  private readonly onPointerUp: (e: PointerEvent) => void;
  private readonly onKeyDown: (e: KeyboardEvent) => void;
  private readonly onKeyUp: (e: KeyboardEvent) => void;

  constructor(target: HTMLElement, camera: CameraController, input: InputState, interaction: InteractionSystem, onGesture?: () => void) {
    this.camera = camera;
    this.input = input;

    this.onKeyDown = (e) => {
      this.pressed.add(e.code);
      if (e.code === 'KeyE') interaction.trigger();
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    };
    this.onKeyUp = (e) => this.pressed.delete(e.code);

    this.onPointerDown = (e) => {
      if (e.pointerType === 'touch') return;
      onGesture?.();
      if (e.button !== 0) return;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    };
    this.onPointerMove = (e) => {
      if (!this.dragging) return;
      this.camera.look(e.clientX - this.lastX, e.clientY - this.lastY);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    };
    this.onPointerUp = () => {
      this.dragging = false;
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('pointerdown', this.onPointerDown);
    target.addEventListener('pointermove', this.onPointerMove);
    target.addEventListener('pointerup', this.onPointerUp);
    target.addEventListener('pointercancel', this.onPointerUp);
  }

  update(): void {
    let x = 0;
    let y = 0;
    if (this.pressed.has('KeyW') || this.pressed.has('ArrowUp')) y += 1;
    if (this.pressed.has('KeyS') || this.pressed.has('ArrowDown')) y -= 1;
    if (this.pressed.has('KeyD') || this.pressed.has('ArrowRight')) x += 1;
    if (this.pressed.has('KeyA') || this.pressed.has('ArrowLeft')) x -= 1;

    this.input.keyboard.set(x, y);
    this.input.keyboardActive = x !== 0 || y !== 0;
    this.input.setKeyboardRunning(this.input.keyboardActive && (this.pressed.has('ShiftLeft') || this.pressed.has('ShiftRight')));
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
