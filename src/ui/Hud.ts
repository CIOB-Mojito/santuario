import type { QualityLevel } from '../config/quality';

export interface HudStats {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  zone: string;
}

const LEVELS: QualityLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'ULTRA'];

/**
 * Panel de desarrollo discreto. Se oculta por defecto; el boton superior
 * permite abrirlo y cambiar la calidad a mano, util sobre todo en movil.
 */
export class Hud {
  private readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly statsEl: HTMLElement;
  private readonly zoneEl: HTMLElement;
  private readonly buttons = new Map<QualityLevel, HTMLButtonElement>();
  private readonly onQuality: (level: QualityLevel) => void;
  private open = false;

  constructor(onQuality: (level: QualityLevel) => void) {
    this.onQuality = onQuality;

    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:fixed;top:calc(env(safe-area-inset-top,0px) + 10px);left:10px;z-index:10;' +
      'font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#dfe7f0;' +
      'pointer-events:none;user-select:none;-webkit-user-select:none';

    const toggle = document.createElement('button');
    toggle.textContent = 'panel';
    toggle.style.cssText =
      'pointer-events:auto;font:inherit;color:#dfe7f0;background:rgba(10,16,22,.6);' +
      'border:1px solid rgba(160,190,220,.35);border-radius:8px;padding:6px 10px;' +
      'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)';
    toggle.addEventListener('click', () => this.toggle());

    const panel = document.createElement('div');
    panel.style.cssText =
      'margin-top:8px;padding:10px 12px;max-width:min(78vw,320px);display:none;' +
      'background:rgba(8,12,17,.72);border:1px solid rgba(160,190,220,.25);border-radius:10px;' +
      'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);white-space:pre-line';

    this.statsEl = document.createElement('div');

    const zoneLine = document.createElement('div');
    zoneLine.style.cssText = 'margin-top:8px;opacity:.85';
    this.zoneEl = document.createElement('span');

    const qual = document.createElement('div');
    qual.style.cssText = 'margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;pointer-events:auto';
    for (const level of LEVELS) {
      const b = document.createElement('button');
      b.textContent = level;
      b.style.cssText =
        'font:inherit;color:#dfe7f0;background:rgba(30,42,56,.7);border:1px solid rgba(160,190,220,.3);' +
        'border-radius:7px;padding:5px 9px';
      b.addEventListener('click', () => this.onQuality(level));
      this.buttons.set(level, b);
      qual.appendChild(b);
    }

    zoneLine.append('Zona: ', this.zoneEl);
    panel.append(this.statsEl, zoneLine, qual);
    this.root.append(toggle, panel);
    document.body.appendChild(this.root);
    this.panel = panel;
  }

  toggle(): void {
    this.open = !this.open;
    this.panel.style.display = this.open ? 'block' : 'none';
  }

  setQualityLevel(level: QualityLevel): void {
    for (const [lvl, button] of this.buttons) {
      button.style.borderColor = lvl === level ? '#e8c46a' : 'rgba(160,190,220,.3)';
      button.style.color = lvl === level ? '#ffe9ad' : '#dfe7f0';
    }
  }

  setStats(stats: HudStats): void {
    if (!this.open) return;
    this.statsEl.textContent =
      `fps        ${stats.fps.toFixed(0).padStart(3)}\n` +
      `frame      ${stats.frameMs.toFixed(1)} ms\n` +
      `draw calls ${stats.drawCalls}\n` +
      `triangles  ${stats.triangles.toLocaleString('es')}\n` +
      `geometrias ${stats.geometries}\n` +
      `texturas   ${stats.textures}`;
    this.zoneEl.textContent = stats.zone;
  }

  dispose(): void {
    this.root.remove();
    this.buttons.clear();
  }
}
