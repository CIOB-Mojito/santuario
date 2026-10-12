import type { ZoneDef } from '../world/zones';

export type AudioLayer = 'wind' | 'interior' | 'windExterior' | 'reverb' | 'candles';

/**
 * Audio por capas y por zona (secciones 30 y 33). El contexto se crea solo
 * tras el primer gesto del usuario (politica de los navegadores moviles). Hoy
 * no hay muestras: el sistema mantiene la mezcla objetivo de cada capa y la
 * aproxima, de modo que al anadir audio real solo haya que registrar fuentes.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly targets = new Map<AudioLayer, number>();
  private readonly current = new Map<AudioLayer, number>();

  unlocked = false;
  currentZone: ZoneDef | null = null;

  async unlock(): Promise<void> {
    if (this.unlocked) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    this.unlocked = true;
  }

  /** Mezcla objetivo segun la zona actual. */
  setZone(zone: ZoneDef): void {
    this.currentZone = zone;
    if (zone.interior) {
      this.set('interior', 0.9);
      this.set('reverb', 0.6);
      this.set('windExterior', 0.05);
      this.set('candles', 0.4);
    } else {
      this.set('wind', 0.6);
      this.set('windExterior', 0.8);
      this.set('interior', 0.0);
      this.set('reverb', 0.1);
      this.set('candles', 0.0);
    }
  }

  private set(layer: AudioLayer, value: number): void {
    this.targets.set(layer, value);
    if (!this.current.has(layer)) this.current.set(layer, value);
  }

  update(dt: number): void {
    const k = Math.min(1, dt * 2);
    for (const [layer, target] of this.targets) {
      const value = this.current.get(layer) ?? 0;
      this.current.set(layer, value + (target - value) * k);
    }
  }

  level(layer: AudioLayer): number {
    return this.current.get(layer) ?? 0;
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.unlocked = false;
  }
}
