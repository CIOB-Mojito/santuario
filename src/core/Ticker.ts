export type TickHandler = (dt: number, elapsed: number) => void;

/**
 * Bucle de animacion. Clampea dt para evitar saltos cuando la pestana vuelve
 * o el dispositivo se traba, y expone metricas de frame para el panel de debug.
 */
export class Ticker {
  private readonly handlers: TickHandler[] = [];
  private rafId = 0;
  private last = 0;
  private running = false;

  /** Tope de dt: 50ms (equivale a 20 fps). Evita saltos fisicos tras un freeze. */
  private readonly maxDt = 0.05;

  elapsed = 0;
  frameMs = 16.7;
  smoothFrameMs = 16.7;
  fps = 60;

  constructor() {
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  add(handler: TickHandler): void {
    this.handlers.push(handler);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  dispose(): void {
    this.stop();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.handlers.length = 0;
  }

  private readonly onVisibility = (): void => {
    if (!document.hidden) this.last = performance.now();
  };

  private readonly loop = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    if (document.hidden) {
      this.last = now;
      return;
    }
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > this.maxDt) dt = this.maxDt;
    this.elapsed += dt;

    this.frameMs = dt * 1000;
    this.smoothFrameMs += (this.frameMs - this.smoothFrameMs) * 0.1;
    this.fps = 1000 / Math.max(this.smoothFrameMs, 0.001);

    for (let i = 0; i < this.handlers.length; i++) {
      this.handlers[i](dt, this.elapsed);
    }
  };
}
