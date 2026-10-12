import type { ZoneDef } from '../world/zones';
import { SOUND_URLS, loadSound, type SoundId } from './soundLibrary';

export type AudioLayer = 'wind' | 'interior' | 'windExterior' | 'reverb' | 'candles';

/** Ganancia relativa de cada muestra sobre el objetivo de su capa. */
const SAMPLE_GAIN: Readonly<Record<SoundId, number>> = {
  windExterior: 0.55,
  interior: 0.5,
  candles: 0.45
};

/**
 * Audio por capas y por zona (secciones 30 y 33). El contexto se crea solo
 * tras el primer gesto del usuario (politica de moviles). Las capas reproducen
 * muestras reales CC0 en bucle; el nivel objetivo de cada zona se interpola y
 * se aplica a los GainNode. Sin muestras decodificadas, el sistema sigue vivo
 * y en silencio.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly sources = new Map<SoundId, AudioBufferSourceNode>();
  private readonly gains = new Map<SoundId, GainNode>();
  private readonly targets = new Map<AudioLayer, number>();
  private readonly current = new Map<AudioLayer, number>();
  private loading = false;

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
    void this.loadSamples();
  }

  private async loadSamples(): Promise<void> {
    if (!this.ctx || this.loading) return;
    this.loading = true;
    const entries = Object.entries(SOUND_URLS) as [SoundId, string][];
    await Promise.all(
      entries.map(async ([id, url]) => {
        const buffer = await loadSound(this.ctx as AudioContext, url);
        if (!buffer || !this.ctx) return;
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(this.master as GainNode);
        source.start();
        this.sources.set(id, source);
        this.gains.set(id, gain);
      })
    );
  }

  /** Mezcla objetivo segun la zona actual. */
  setZone(zone: ZoneDef): void {
    this.currentZone = zone;
    if (zone.interior) {
      this.set('interior', 0.9);
      this.set('reverb', 0.6);
      this.set('windExterior', 0.05);
      this.set('candles', 0.4);
      this.set('wind', 0.0);
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
    this.applyGains();
  }

  private applyGains(): void {
    const gap = (id: SoundId): number => {
      const gain = this.gains.get(id);
      if (!gain || !this.ctx) return 0;
      let level = 0;
      if (id === 'windExterior') level = this.level('wind') + this.level('windExterior');
      else if (id === 'interior') level = this.level('interior') + this.level('reverb') * 0.5;
      else level = this.level('candles');
      return Math.min(1, level) * SAMPLE_GAIN[id];
    };
    const now = this.ctx?.currentTime ?? 0;
    for (const [id, gain] of this.gains) {
      gain.gain.setTargetAtTime(gap(id), now, 0.15);
    }
  }

  level(layer: AudioLayer): number {
    return this.current.get(layer) ?? 0;
  }

  get sampleCount(): number {
    return this.sources.size;
  }

  dispose(): void {
    for (const source of this.sources.values()) {
      try {
        source.stop();
      } catch {
        // ya detenido
      }
    }
    this.sources.clear();
    this.gains.clear();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.unlocked = false;
  }
}
