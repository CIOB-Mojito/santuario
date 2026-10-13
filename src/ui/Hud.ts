import type { QualityLevel } from '../config/quality';

/**
 * Interfaz minima y no intrusiva (seccion 36): nombre de la zona, linea de
 * narrativa y boton de calidad. Nada de menus que tapen la vista.
 */
export class Hud {
  private readonly root = document.createElement('div');
  private readonly zoneLabel = document.createElement('div');
  private readonly narrative = document.createElement('div');
  private readonly prompt = document.createElement('div');
  private readonly qualityButton = document.createElement('button');
  private readonly menuButton = document.createElement('button');
  private readonly builderBadge = document.createElement('div');
  private readonly builderHint = document.createElement('div');
  private readonly selectionChip = document.createElement('div');
  private hideTimer = 0;
  private builderActive = false;

  constructor(onCycleQuality: (event: Event) => void, onOpenMenu: () => void) {
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

    this.menuButton.type = 'button';
    this.menuButton.style.display = 'none';
    this.menuButton.style.position = 'fixed';
    this.menuButton.style.right = '14px';
    this.menuButton.style.bottom = 'max(14px, env(safe-area-inset-bottom))';
    this.menuButton.style.padding = '8px 16px';
    this.menuButton.style.borderRadius = '999px';
    this.menuButton.style.border = '1px solid rgba(255,240,214,0.4)';
    this.menuButton.style.background = 'rgba(20,26,34,0.5)';
    this.menuButton.style.color = '#e8e2d4';
    this.menuButton.style.font = '12px system-ui, sans-serif';
    this.menuButton.style.fontWeight = '600';
    this.menuButton.style.cursor = 'pointer';
    this.menuButton.style.zIndex = '30';
    this.menuButton.textContent = 'Menú';
    this.menuButton.addEventListener('click', onOpenMenu);

    this.root.append(this.zoneLabel, this.narrative, this.qualityButton);

    const prompt = this.prompt.style;
    prompt.position = 'fixed';
    prompt.left = '0';
    prompt.right = '0';
    prompt.bottom = 'max(26px, env(safe-area-inset-bottom))';
    prompt.textAlign = 'center';
    prompt.font = '14px system-ui, sans-serif';
    prompt.fontWeight = '600';
    prompt.letterSpacing = '0.03em';
    prompt.color = '#ffe6b8';
    prompt.textShadow = '0 1px 4px rgba(0,0,0,0.8)';
    prompt.pointerEvents = 'none';
    prompt.opacity = '0';
    prompt.transition = 'opacity 0.25s ease';
    prompt.zIndex = '30';

    const badge = this.builderBadge.style;
    badge.display = 'none';
    badge.position = 'fixed';
    badge.left = '0';
    badge.right = '0';
    badge.top = 'max(14px, calc(env(safe-area-inset-top) + 0px))';
    badge.margin = '0 auto';
    badge.width = 'fit-content';
    badge.padding = '5px 14px';
    badge.borderRadius = '999px';
    badge.background = 'rgba(10,13,18,0.78)';
    badge.border = '1px solid rgba(255,230,184,0.65)';
    badge.color = '#ffe6b8';
    badge.font = '12px system-ui, sans-serif';
    badge.fontWeight = '600';
    badge.letterSpacing = '0.08em';
    badge.textAlign = 'center';
    badge.pointerEvents = 'none';
    badge.zIndex = '31';
    this.builderBadge.textContent = 'MODO CONSTRUCTOR';

    const hint = this.builderHint.style;
    hint.display = 'none';
    hint.position = 'fixed';
    hint.left = '0';
    hint.right = '0';
    hint.top = 'max(46px, calc(env(safe-area-inset-top) + 32px))';
    hint.textAlign = 'center';
    hint.font = '12px system-ui, sans-serif';
    hint.color = 'rgba(232,226,212,0.85)';
    hint.textShadow = '0 1px 3px rgba(0,0,0,0.8)';
    hint.pointerEvents = 'none';
    hint.zIndex = '31';
    this.builderHint.textContent = '1 dedo: girar · 2 dedos: mover / pellizco: acerca · toque: seleccionar · Esc: salir';

    const chip = this.selectionChip.style;
    chip.display = 'none';
    chip.position = 'fixed';
    chip.left = '0';
    chip.right = '0';
    chip.top = 'max(76px, calc(env(safe-area-inset-top) + 62px))';
    chip.margin = '0 auto';
    chip.width = 'fit-content';
    chip.maxWidth = 'min(86vw, 420px)';
    chip.padding = '4px 12px';
    chip.borderRadius = '999px';
    chip.background = 'rgba(10,13,18,0.7)';
    chip.border = '1px solid rgba(255,240,214,0.35)';
    chip.color = '#e8e2d4';
    chip.font = '12px system-ui, sans-serif';
    chip.fontWeight = '600';
    chip.textAlign = 'center';
    chip.pointerEvents = 'none';
    chip.zIndex = '31';
  }

  mount(parent: HTMLElement): void {
    parent.append(this.root, this.prompt, this.builderBadge, this.builderHint, this.selectionChip, this.menuButton);
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

  /** Aviso de interaccion (objeto enfocado). `null` lo oculta. */
  setPrompt(text: string | null): void {
    if (!text) {
      this.prompt.style.opacity = '0';
      return;
    }
    this.prompt.textContent = text;
    this.prompt.style.opacity = '1';
  }

  /** Entra/sale del Modo Constructor: muestra el aval y la ayuda. */
  setBuilderMode(active: boolean): void {
    this.builderActive = active;
    this.builderBadge.style.display = active ? 'block' : 'none';
    this.builderHint.style.display = active ? 'block' : 'none';
    if (!active) this.setSelectionName(null);
  }

  /** Muestra/oculta el botón "Menú" (visible en juego; oculto en menú). */
  setMenuMode(visible: boolean): void {
    this.menuButton.style.display = visible ? 'block' : 'none';
  }

  /** Nombre del objeto seleccionado en el Modo Constructor. `null` lo oculta. */
  setSelectionName(name: string | null): void {
    if (!this.builderActive || !name) {
      this.selectionChip.style.display = 'none';
      return;
    }
    this.selectionChip.textContent = `Seleccionado: ${name}`;
    this.selectionChip.style.display = 'block';
  }

  update(dt: number): void {
    if (this.hideTimer <= 0) return;
    this.hideTimer -= dt;
    if (this.hideTimer <= 0) this.narrative.style.opacity = '0';
  }

  dispose(): void {
    this.root.remove();
    this.prompt.remove();
    this.builderBadge.remove();
    this.builderHint.remove();
    this.selectionChip.remove();
    this.menuButton.remove();
  }
}
