import type { Player } from '../player/Player';
import type { CameraController } from '../player/CameraController';
import type { InteractionSystem } from '../interaction/InteractionSystem';

/**
 * Controles tactiles (seccion 7). Mitad izquierda: joystick que aparece donde
 * tocas y que mueve con inercia. Mitad derecha: area de mirada. Un toque sin
 * desplazamiento interactua. Se activa solo si el dispositivo tiene pantalla
 * tactil, para no tapar la vista en escritorio.
 */
export class TouchControls {
  private readonly player: Player;
  private readonly camera: CameraController;
  private readonly interaction: InteractionSystem;

  private readonly base = document.createElement('div');
  private readonly knob = document.createElement('div');
  private readonly hint = document.createElement('div');

  private moveId: number | null = null;
  private lookId: number | null = null;
  private readonly origin = { x: 0, y: 0 };
  private lookLast = { x: 0, y: 0 };
  private lookMoved = false;
  private moveMoved = false;
  private readonly maxRadius = 52;

  constructor(player: Player, camera: CameraController, interaction: InteractionSystem) {
    this.player = player;
    this.camera = camera;
    this.interaction = interaction;
    this.style();
  }

  get active(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  mount(parent: HTMLElement): void {
    if (!this.active) return;
    parent.append(this.base, this.knob, this.hint);
    parent.addEventListener('pointerdown', this.onDown);
    parent.addEventListener('pointermove', this.onMove);
    parent.addEventListener('pointerup', this.onUp);
    parent.addEventListener('pointercancel', this.onUp);
  }

  private style(): void {
    const base = this.base.style;
    base.position = 'fixed';
    base.width = '116px';
    base.height = '116px';
    base.borderRadius = '50%';
    base.border = '1.5px solid rgba(255,240,214,0.5)';
    base.background = 'rgba(20,26,34,0.28)';
    base.display = 'none';
    base.pointerEvents = 'none';
    base.zIndex = '20';

    const knob = this.knob.style;
    knob.position = 'fixed';
    knob.width = '52px';
    knob.height = '52px';
    knob.borderRadius = '50%';
    knob.background = 'rgba(255,226,184,0.55)';
    knob.display = 'none';
    knob.pointerEvents = 'none';
    knob.zIndex = '21';

    const hint = this.hint.style;
    hint.position = 'fixed';
    hint.left = '0';
    hint.right = '0';
    hint.bottom = '18px';
    hint.textAlign = 'center';
    hint.font = '12px system-ui, sans-serif';
    hint.color = 'rgba(232,226,212,0.6)';
    hint.pointerEvents = 'none';
    hint.zIndex = '20';
    this.hint.textContent = 'izquierda: mover · derecha: mirar · toque: interactuar';
  }

  private readonly onDown = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') return;
    const w = window.innerWidth;
    if (e.clientX < w * 0.5 && this.moveId === null) {
      this.moveId = e.pointerId;
      this.moveMoved = false;
      this.origin.x = e.clientX;
      this.origin.y = e.clientY;
      const { style } = this.base;
      style.display = 'block';
      style.left = `${e.clientX - 58}px`;
      style.top = `${e.clientY - 58}px`;
      this.knob.style.display = 'block';
      this.placeKnob(0, 0);
    } else if (this.lookId === null) {
      this.lookId = e.pointerId;
      this.lookMoved = false;
      this.lookLast.x = e.clientX;
      this.lookLast.y = e.clientY;
    }
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (e.pointerId === this.moveId) {
      let dx = e.clientX - this.origin.x;
      let dy = e.clientY - this.origin.y;
      const dist = Math.hypot(dx, dy);
      if (dist > this.maxRadius) {
        dx = (dx / dist) * this.maxRadius;
        dy = (dy / dist) * this.maxRadius;
      }
      this.placeKnob(dx, dy);
      this.player.moveInput.set(dx / this.maxRadius, -dy / this.maxRadius);
      this.player.running = dist > this.maxRadius * 0.92;
      if (dist > 8) this.moveMoved = true;
    } else if (e.pointerId === this.lookId) {
      const dx = e.clientX - this.lookLast.x;
      const dy = e.clientY - this.lookLast.y;
      this.camera.look(dx, dy);
      this.lookLast.x = e.clientX;
      this.lookLast.y = e.clientY;
      if (Math.hypot(dx, dy) > 1) this.lookMoved = true;
    }
  };

  private readonly onUp = (e: PointerEvent): void => {
    if (e.pointerId === this.moveId) {
      this.moveId = null;
      this.base.style.display = 'none';
      this.knob.style.display = 'none';
      this.player.moveInput.set(0, 0);
      this.player.running = false;
      if (!this.moveMoved) this.interaction.trigger();
    } else if (e.pointerId === this.lookId) {
      this.lookId = null;
      if (!this.lookMoved) this.interaction.trigger();
    }
  };

  private placeKnob(dx: number, dy: number): void {
    const { style } = this.knob;
    style.left = `${this.origin.x + dx - 26}px`;
    style.top = `${this.origin.y + dy - 26}px`;
  }

  dispose(): void {
    this.base.remove();
    this.knob.remove();
    this.hint.remove();
  }
}
