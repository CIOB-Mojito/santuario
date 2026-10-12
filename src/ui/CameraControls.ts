import type { CameraMode, MoveDirection } from '../core/CameraRig';

export interface CameraControlsHandlers {
  onToggleMode(): void;
  onMove(direction: MoveDirection, active: boolean): void;
}

const BUTTON_BASE =
  'pointer-events:auto;display:flex;align-items:center;justify-content:center;' +
  'width:clamp(46px,12vw,58px);height:clamp(46px,12vw,58px);border-radius:50%;' +
  'background:rgba(10,16,22,.55);border:1px solid rgba(160,190,220,.28);color:#dfe7f0;' +
  'font-size:clamp(18px,5vw,22px);line-height:1;padding:0;cursor:pointer;' +
  'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);' +
  'touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none';

const BUTTON_IDLE_BG = 'rgba(10,16,22,.55)';
const BUTTON_IDLE_BORDER = 'rgba(160,190,220,.28)';
const BUTTON_ACTIVE_BG = 'rgba(232,196,106,.30)';
const BUTTON_ACTIVE_BORDER = 'rgba(232,196,106,.75)';

const CAMERA_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ' +
  'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M4 8.2A2.2 2.2 0 0 1 6.2 6h1.1l.9-1.5A1 1 0 0 1 9 4h6a1 1 0 0 1 .8.5l.9 1.5h1.1A2.2 2.2 0 0 1 20 8.2v8.6A2.2 ' +
  '2.2 0 0 1 17.8 19H6.2A2.2 2.2 0 0 1 4 16.8z"/><circle cx="12" cy="12.5" r="3.1"/></svg>';

/**
 * Interfaz de la camara: alterna ORBIT/FREE, indica el modo activo y muestra
 * los controles de desplazamiento solo en FREE. No conoce la camara ni el
 * renderer: solo emite intenciones a traves de sus handlers.
 */
export class CameraControls {
  private readonly handlers: CameraControlsHandlers;
  private readonly root: HTMLElement;
  private readonly modeLabel: HTMLElement;
  private readonly freeLayer: HTMLElement;
  private readonly held = new Set<MoveDirection>();
  private readonly holdButtons = new Map<MoveDirection, HTMLButtonElement>();

  constructor(handlers: CameraControlsHandlers) {
    this.handlers = handlers;

    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:fixed;inset:0;z-index:11;pointer-events:none;' +
      'font-family:system-ui,"Segoe UI",sans-serif;color:#dfe7f0;' +
      'user-select:none;-webkit-user-select:none';

    const top = document.createElement('div');
    top.style.cssText =
      'position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);right:10px;' +
      'display:flex;align-items:center;gap:8px;pointer-events:none';

    this.modeLabel = document.createElement('span');
    this.modeLabel.style.cssText =
      'font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;' +
      'padding:6px 9px;border-radius:999px;background:rgba(10,16,22,.6);' +
      'border:1px solid rgba(160,190,220,.3);color:#dfe7f0;' +
      'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'Cambiar modo de camara');
    toggle.innerHTML = CAMERA_ICON;
    toggle.style.cssText = BUTTON_BASE;
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handlers.onToggleMode();
    });

    top.append(this.modeLabel, toggle);

    this.freeLayer = document.createElement('div');
    this.freeLayer.style.cssText =
      'position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);' +
      'display:none;justify-content:center;align-items:flex-end;gap:clamp(14px,5vw,40px);' +
      'padding:0 14px;pointer-events:none';

    const pad = document.createElement('div');
    pad.style.cssText =
      'display:grid;grid-template-areas:". forward ." "left center right" ". back .";' +
      'gap:clamp(6px,2vw,10px);pointer-events:none';

    const forward = this.makeHold('forward', '\u25B2', 'Avanzar');
    const back = this.makeHold('back', '\u25BC', 'Retroceder');
    const left = this.makeHold('left', '\u25C0', 'Desplazar a la izquierda');
    const right = this.makeHold('right', '\u25B6', 'Desplazar a la derecha');
    forward.style.gridArea = 'forward';
    back.style.gridArea = 'back';
    left.style.gridArea = 'left';
    right.style.gridArea = 'right';
    pad.append(forward, back, left, right);

    const vertical = document.createElement('div');
    vertical.style.cssText = 'display:flex;flex-direction:column;gap:clamp(6px,2vw,10px);pointer-events:none';
    const up = this.makeHold('up', '\uFF0B', 'Subir');
    const down = this.makeHold('down', '\u2212', 'Bajar');
    vertical.append(up, down);

    const exit = document.createElement('button');
    exit.type = 'button';
    exit.textContent = '\u00D3rbita';
    exit.setAttribute('aria-label', 'Volver a la camara orbital');
    exit.style.cssText = BUTTON_BASE + ';width:auto;height:auto;border-radius:999px;' +
      'padding:11px 16px;font-size:13px;letter-spacing:.04em';
    exit.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handlers.onToggleMode();
    });

    this.freeLayer.append(pad, vertical, exit);
    this.root.append(top, this.freeLayer);
    document.body.appendChild(this.root);

    window.addEventListener('blur', this.releaseAll);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  setMode(mode: CameraMode): void {
    this.modeLabel.textContent = mode;
    this.modeLabel.style.color = mode === 'FREE' ? '#ffe9ad' : '#dfe7f0';
    this.modeLabel.style.borderColor = mode === 'FREE' ? 'rgba(232,196,106,.6)' : 'rgba(160,190,220,.3)';
    this.freeLayer.style.display = mode === 'FREE' ? 'flex' : 'none';
    if (mode !== 'FREE') this.releaseAll();
  }

  dispose(): void {
    this.releaseAll();
    window.removeEventListener('blur', this.releaseAll);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.holdButtons.clear();
    this.held.clear();
    this.root.remove();
  }

  private makeHold(direction: MoveDirection, glyph: string, label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = glyph;
    button.setAttribute('aria-label', label);
    button.style.cssText = BUTTON_BASE;

    const press = (e: PointerEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      button.setPointerCapture(e.pointerId);
      this.held.add(direction);
      this.handlers.onMove(direction, true);
      button.style.background = BUTTON_ACTIVE_BG;
      button.style.borderColor = BUTTON_ACTIVE_BORDER;
    };
    const release = (e: PointerEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      this.held.delete(direction);
      this.handlers.onMove(direction, false);
      button.style.background = BUTTON_IDLE_BG;
      button.style.borderColor = BUTTON_IDLE_BORDER;
    };

    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('contextmenu', (e) => e.preventDefault());

    this.holdButtons.set(direction, button);
    return button;
  }

  private readonly releaseAll = (): void => {
    if (this.held.size === 0) return;
    for (const direction of this.held) this.handlers.onMove(direction, false);
    this.held.clear();
    for (const button of this.holdButtons.values()) {
      button.style.background = BUTTON_IDLE_BG;
      button.style.borderColor = BUTTON_IDLE_BORDER;
    }
  };

  private readonly onVisibility = (): void => {
    if (document.hidden) this.releaseAll();
  };
}
