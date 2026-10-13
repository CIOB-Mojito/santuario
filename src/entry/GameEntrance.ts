import type { PerspectiveCamera, Scene } from 'three';
import type { GrimoireScene } from './GrimoireScene';

/** Opciones del menu principal tras abrir el grimorio. */
export type MenuChoice = 'play' | 'build';

/**
 * Pantalla de entrada/menu que antecede al juego (Fase 2). Recrea la estetica
 * de la pantalla de carga del Grimorio original (velo con viñeta radial, sigilo
 * SVG dorado girando, barra de progreso dorada) adaptada a SANTUARIO. Ahora es
 * el menu principal: cuando el libro abrio su animacion unica y los recursos
 * del mundo estan listos, muestra JUGAR y CONSTRUCCION.
 *
 * No crea renderer ni bucle propios (reutiliza los del motor) y NO libera el
 * grimorio al salir: el velo se oculta (clase `gone`) pero la escena y el
 * DOM permanecen vivos para volver al menu sin repetir la apertura ni perder
 * la sesion. Solo dispose() libera todo (se llama al apagar el motor).
 */
export class GameEntrance {
  private readonly container: HTMLElement;
  private readonly grimoire: GrimoireScene;
  private readonly onChoose: (choice: MenuChoice) => void;
  private readonly onDisposed?: () => void;

  private readonly veil = document.createElement('div');
  private readonly sigil = document.createElement('div');
  private readonly brand = document.createElement('div');
  private readonly subtitle = document.createElement('div');
  private readonly track = document.createElement('div');
  private readonly bar = document.createElement('div');
  private readonly status = document.createElement('div');
  private readonly choices = document.createElement('div');
  private readonly playButton = document.createElement('button');
  private readonly buildButton = document.createElement('button');
  private readonly style = document.createElement('style');

  private readonly onKeyDown: (e: KeyboardEvent) => void;

  private mounted = false;
  private ready = false;
  private opened = false;
  private hidden = true;
  private disposed = false;
  active = false;

  constructor(container: HTMLElement, grimoire: GrimoireScene, onChoose: (choice: MenuChoice) => void, onDisposed?: () => void) {
    this.container = container;
    this.grimoire = grimoire;
    this.onChoose = onChoose;
    this.onDisposed = onDisposed;

    this.buildDom();

    this.onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter') this.choose('play');
    };
  }

  get scene(): Scene {
    return this.grimoire.scene;
  }

  get camera(): PerspectiveCamera {
    return this.grimoire.camera;
  }

  private buildDom(): void {
    this.style.textContent = `
      .santuario-entrance{position:fixed;inset:0;z-index:55;pointer-events:auto;cursor:default;
        background:radial-gradient(ellipse at 50% 44%, rgba(20,14,30,0.14) 0%, rgba(20,14,30,0.42) 48%, rgba(7,5,11,0.9) 100%);
        opacity:0;transition:opacity .9s ease}
      .santuario-entrance.show{opacity:1}
      .santuario-entrance.gone{opacity:0;pointer-events:none}
      .santuario-entrance .top{position:absolute;left:0;right:0;text-align:center;
        top:max(9vh, calc(env(safe-area-inset-top) + 34px));display:flex;flex-direction:column;align-items:center;gap:12px}
      .santuario-entrance .sigil{width:74px;height:74px;stroke:#d9b25a;fill:none;stroke-width:1.2;
        filter:drop-shadow(0 0 10px rgba(217,178,90,.45));animation:santuario-spin 18s linear infinite}
      .santuario-entrance .brand{color:#e8c880;font-size:19px;font-weight:600;letter-spacing:.34em;margin-left:.34em;
        text-shadow:0 1px 3px #000,0 0 16px rgba(217,178,90,.35)}
      .santuario-entrance .subtitle{font-style:italic;font-size:13px;letter-spacing:.06em;color:#e9d6a0;
        text-shadow:0 1px 3px #000;opacity:.85}
      .santuario-entrance .panel{position:absolute;left:0;right:0;bottom:max(18vh, calc(env(safe-area-inset-bottom) + 72px));
        display:flex;flex-direction:column;align-items:center;gap:12px;padding:0 24px}
      .santuario-entrance .track{width:min(220px,60vw);height:3px;border-radius:999px;overflow:hidden;
        background:rgba(217,178,90,.22)}
      .santuario-entrance .bar{height:100%;width:0;border-radius:999px;
        background:linear-gradient(90deg,#a8802f,#ffe39a);box-shadow:0 0 12px rgba(217,178,90,.55);
        transition:width .35s ease}
      .santuario-entrance .status{font-size:13px;color:#e9d6a0;letter-spacing:.05em;min-height:18px;
        text-shadow:0 1px 4px #000;text-align:center}
      .santuario-entrance .choices{margin-top:8px;width:min(260px,72vw);display:flex;flex-direction:column;
        gap:12px;opacity:0;transition:opacity .7s ease;pointer-events:none}
      .santuario-entrance .choices.on{opacity:1;pointer-events:auto;cursor:pointer}
      .santuario-entrance .choice{display:block;width:100%;padding:14px 20px;border-radius:12px;border:1px solid rgba(217,178,90,.55);
        background:linear-gradient(180deg,rgba(46,34,20,.72),rgba(24,17,10,.82));
        color:#ffe6b8;font:600 16px system-ui,sans-serif;letter-spacing:.14em;text-align:center;
        text-shadow:0 1px 3px #000;user-select:none;touch-action:manipulation;
        box-shadow:0 4px 16px rgba(0,0,0,.45), inset 0 0 18px rgba(217,178,90,.08);
        transition:transform .12s ease, box-shadow .2s ease, background .2s ease}
      .santuario-entrance .choice:active{transform:scale(.97);background:linear-gradient(180deg,rgba(66,48,28,.82),rgba(32,22,12,.9))}
      @keyframes santuario-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    `;

    this.veil.className = 'santuario-entrance';
    this.sigil.className = 'sigil';
    this.sigil.innerHTML =
      '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="32" cy="32" r="29"/><circle cx="32" cy="32" r="22"/>' +
      '<path d="M32 4v8M32 52v8M4 32h8M52 32h8"/><path d="M32 14l12 22H20z"/>' +
      '<circle cx="32" cy="30" r="3"/></svg>';
    this.brand.className = 'brand';
    this.brand.textContent = 'SANTUARIO PRIMORDIO';
    this.subtitle.className = 'subtitle';
    this.subtitle.textContent = 'Cruza el umbral del grimorio hacia la estancia';

    const top = document.createElement('div');
    top.className = 'top';
    top.append(this.sigil, this.brand, this.subtitle);

    this.track.className = 'track';
    this.bar.className = 'bar';
    this.track.append(this.bar);
    this.status.className = 'status';

    this.choices.className = 'choices';
    this.playButton.className = 'choice';
    this.playButton.type = 'button';
    this.playButton.textContent = 'JUGAR';
    this.playButton.addEventListener('click', () => this.choose('play'));
    this.buildButton.className = 'choice';
    this.buildButton.type = 'button';
    this.buildButton.textContent = 'CONSTRUCCIÓN';
    this.buildButton.addEventListener('click', () => this.choose('build'));
    this.choices.append(this.playButton, this.buildButton);

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.append(this.track, this.status, this.choices);

    this.veil.append(top, panel);
  }

  /** Muestra el velo sobre la escena del grimorio y arranca su animacion. */
  begin(): void {
    if (this.mounted) return;
    this.mounted = true;
    this.container.append(this.veil);
    document.head.appendChild(this.style);
    this.setStatus('Invocando una estancia antigua…');
    this.show();
  }

  /**
   * Re-muestra el menu en una visita posterior (desde el juego o el
   * constructor) SIN volver a crear nada: la escena del grimorio sigue viva y
   * el libro ya esta abierto, asi que las opciones aparecen de inmediato.
   */
  show(): void {
    if (!this.mounted || this.disposed) return;
    this.hidden = false;
    this.active = true;
    this.veil.classList.remove('gone');
    this.veil.classList.add('show');
    window.addEventListener('keydown', this.onKeyDown);
    this.maybeShowChoices();
  }

  /** Actualiza la escena del grimorio (el bucle del motor la llama). */
  update(dt: number): void {
    if (!this.active || this.hidden || this.disposed) return;
    this.grimoire.update(dt);
  }

  resize(width: number, height: number): void {
    this.grimoire.resize(width, height);
  }

  /**
   * Estado descriptivo y, cuando existe, progreso granular real (0..1).
   * `progress === null` oculta la barra: nada de porcentajes inventados.
   */
  setStatus(label: string, progress?: number | null): void {
    if (this.disposed) return;
    this.status.textContent = label;
    if (typeof progress === 'number') {
      this.track.style.display = 'block';
      this.bar.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
    } else {
      this.track.style.display = 'none';
    }
  }

  /** Los recursos del mundo estan listos: ya se pueden mostrar las opciones. */
  setReady(): void {
    if (this.disposed || this.ready) return;
    this.ready = true;
    this.maybeShowChoices();
  }

  /** El grimorio termino su apertura unica (lo avisa el puerto via options.onOpen). */
  onBookOpened(): void {
    if (this.disposed || this.opened) return;
    this.opened = true;
    this.maybeShowChoices();
  }

  /** Muestra JUGAR / CONSTRUCCION cuando el libro abrio y el mundo esta listo. */
  private maybeShowChoices(): void {
    if (!this.ready || !this.opened || this.hidden || !this.active) return;
    this.status.textContent = 'La estancia esta lista';
    this.choices.classList.add('on');
  }

  /** Salida a un modo: oculta el velo y avisa al motor. No libera el grimorio. */
  choose(choice: MenuChoice): void {
    if (!this.ready || !this.opened || this.hidden || this.disposed) return;
    this.hidden = true;
    this.active = false;
    this.veil.classList.add('gone');
    window.removeEventListener('keydown', this.onKeyDown);
    this.onChoose(choice);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.active = false;
    window.removeEventListener('keydown', this.onKeyDown);
    this.veil.classList.remove('show', 'gone');
    this.veil.remove();
    this.style.remove();
    this.grimoire.dispose();
    this.onDisposed?.();
  }
}