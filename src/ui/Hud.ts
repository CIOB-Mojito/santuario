import type { QualityLevel } from '../config/quality';

/**
 * Interfaz minima y no intrusiva (seccion 36): nombre de la zona, linea de
 * narrativa y boton de calidad. Nada de menus que tapen la vista.
 */
export class Hud {
  private readonly root = document.createElement('div');
  private readonly zoneLabel = document.createElement('div');
  private readonly narrative = document.createElement('div');
  private readonly qualityButton = document.createElement('button');
  private hideTimer = 0;

  constructor(onCycleQuality: (event: Event) => void) {
    const style = this.root.style;
    style.position = 'fixed';
    style.top = 'max(14px, env(safe-area-inset-top))';
    style.left = '14px';
    style.zIndex = '30';
    style.pointerEvents = 'none';
    style.font = '13px system-ui, sans-serif';
    style.color = '#e8e2d4';
    style.textShadow = '0 1px 3px rgba(0,0,0,0.7)';

    this.zoneLabel.style.fontWeight = '600';
    this.zoneLabel.style.letterSpacing = '0.04em';

    this.narrative.style.marginTop = '6px';
    this.narrative.style.maxWidth = 'min(78vw, 420px)';
    this.narrative.style.lineHeight = '1.45';
    this.narrative.style.opacity = '0';
    this.narrative.style.transition = 'opacity 0.8s ease';

    this.qualityButton.type = 'button';
    this.qualityButton.style.marginTop = '10px';
    this.qualityButton.style.pointerEvents = 'auto';
    this.qualityButton.style.padding = '6px 12px';
    this.qualityButton.style.borderRadius = '999px';
    this.qualityButton.style.border = '1px solid rgba(255,240,214,0.4)';
    this.qualityButton.style.background = 'rgba(20,26,34,0.5)';
    this.qualityButton.style.color = '#e8e2d4';
    this.qualityButton.style.font = 'inherit';
    this.qualityButton.style.cursor = 'pointer';
    this.qualityButton.addEventListener('click', onCycleQuality);

    this.root.append(this.zoneLabel, this.narrative, this.qualityButton);
  }

  mount(parent: HTMLElement): void {
    parent.append(this.root);
  }

  setZone(name: string): void {
    this.zoneLabel.textContent = name;
  }

  setQuality(level: QualityLevel): void {
    this.qualityButton.textContent = `Calidad: ${level.replace('QUALITY_', '').toLowerCase()}`;
  }

  showNarrative(text: string): void {
    this.narrative.textContent = text;
    this.narrative.style.opacity = '1';
    this.hideTimer = 9;
  }

  update(dt: number): void {
    if (this.hideTimer <= 0) return;
    this.hideTimer -= dt;
    if (this.hideTimer <= 0) this.narrative.style.opacity = '0';
  }

  dispose(): void {
    this.root.remove();
  }
}
