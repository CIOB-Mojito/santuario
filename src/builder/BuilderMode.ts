import * as THREE from 'three';
import type { Hud } from '../ui/Hud';
import { BuilderGizmo, angleInBasis, axisParam, rayPlaneHit, snapAngle, uniformScaleFactor } from './BuilderGizmo';
import type { GizmoAxis, GizmoTool } from './BuilderGizmo';

export interface BuilderEntry {
  readonly object: THREE.Object3D;
  readonly name: string;
}

/** Herramienta activa de la barra contextual (los gizmo cubren 3, borrar 1). */
type BuilderTool = GizmoTool | 'delete';

interface DragState {
  pointerId: number;
  tool: GizmoTool;
  axis: GizmoAxis;
  startPos: THREE.Vector3;
  startEuler: THREE.Euler;
  startScale: THREE.Vector3;
  groundStart: number;
  startAngle: number;
  accumAngle: number;
  startClientY: number;
  startFactor: number;
}

interface BuilderOptions {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly container: HTMLElement;
  readonly hud: Hud;
  /** Raiz de la escena contra la que lanzar el rayo de seleccion. */
  readonly raycastRoots: () => THREE.Object3D[];
  /**
   * Objetos seleccionables del momento. Cada entrada es un objeto agrupado:
   * los modelos cargados aparecen una sola vez (se ignora su malla interna).
   */
  readonly entries: () => BuilderEntry[];
  readonly onEnter: () => void;
  readonly onExit: () => void;
  /** Permite borrar la entrada de la escena (opcional; si falta no se borra). */
  readonly onDelete?: (entry: BuilderEntry) => void;
  /** Decide si una entrada se puede borrar (opcional; falta = todo borrable). */
  readonly canDelete?: (entry: BuilderEntry) => boolean;
  /** Altura del suelo en (x, z) para seguir el terreno al mover (opcional). */
  readonly groundHeightAt?: (x: number, z: number) => number;
}

const ORBIT_PX = 0.0042;
const PAN_PX = 0.0018;
const ZOOM_WHEEL = 0.0011;
const MIN_RADIUS = 1.2;
const MAX_RADIUS = 130;
const MIN_PHI = 0.08;
const MAX_PHI = Math.PI - 0.08;
const START_RADIUS = 7;
const PICK_PX = 7;
const PICK_MS = 350;
const RADIUS_DAMP = 9;
const TARGET_DAMP = 12;
const KEY_MOVE = 12;
const KEY_TURN = 1.7;
const PICK_COLOR = 0xffd36e;
const LIST_REFRESH_SECONDS = 0.5;
const ROTATE_SNAP = Math.PI / 12;
const SCALE_MIN = 0.05;
const SCALE_MAX = 20;
const SCALE_SPEED = 0.04;
const TOOLBAR_TOP = 96;

interface PointerState {
  x: number;
  y: number;
  moved: boolean;
  t: number;
  button: number;
}

interface PinchState {
  cx: number;
  cy: number;
  d: number;
}

/**
 * Fases 1 y 2 del Modo Constructor. Un modo de edicion independiente del juego
 * que reutiliza el mismo renderizador, escena, camara y bucle de animacion (no
 * duplica el motor): solo cambia QUIEN mueve la camara y que eventos hay
 * activos.
 *
 * Fase 1 (camara y seleccion): al entrar se congela al jugador y sus
 * interacciones (Engine deja de llamar a sus updates y desactiva
 * TouchControls/KeyboardControls) y se toma el control de la camara en primera
 * persona: la reutilizamos como camara libre orbital alrededor de un pivote.
 * Gestos: 1 dedo (o clic) gira, 2 dedos mueve/pellizca para acercar, rueda
 * acerca, un toque SIN arrastre selecciona el objeto bajo el dedo.
 *
 * Fase 2 (panel de objetos): boton "Objetos" (solo en modo constructor) que
 * despliega un panel tactil con las entradas seleccionables. La lista y la
 * seleccion 3D comparten la misma fuente de registros, asi que ambas se
 * mantienen sincronizadas; la lista se refresca cuando un objeto se añade o
 * retira de la escena.
 *
 * La seleccion (tanto por rayo como por la lista) se marca con una caja
 * envolvente dorada y su nombre en el HUD.
 */
export class BuilderMode {
  active = false;

  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly container: HTMLElement;
  private readonly hud: Hud;
  private readonly raycastRoots: () => THREE.Object3D[];
  private readonly entries: () => BuilderEntry[];
  private readonly onEnter: () => void;
  private readonly onExit: () => void;
  private readonly onDelete?: (entry: BuilderEntry) => void;
  private readonly canDelete?: (entry: BuilderEntry) => boolean;
  private readonly groundHeightAt?: (x: number, z: number) => number;

  private readonly button = document.createElement('button');
  private readonly objectsButton = document.createElement('button');
  private readonly panel = document.createElement('div');
  private readonly list = document.createElement('div');
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly gizmo: BuilderGizmo;

  private readonly toolbar = document.createElement('div');
  private readonly moveButton = document.createElement('button');
  private readonly rotateButton = document.createElement('button');
  private readonly scaleButton = document.createElement('button');
  private readonly deleteButton = document.createElement('button');
  private readonly deleteOverlay = document.createElement('div');

  private tool: BuilderTool = 'move';
  private drag: DragState | null = null;

  private readonly scratchA = new THREE.Vector3();
  private readonly scratchB = new THREE.Vector3();
  private readonly scratchHit = new THREE.Vector3();
  private readonly scratchBox = new THREE.Box3();
  private readonly scratchSize = new THREE.Vector3();
  private readonly axisVectors: Record<GizmoAxis, THREE.Vector3> = {
    X: new THREE.Vector3(1, 0, 0),
    Y: new THREE.Vector3(0, 1, 0),
    Z: new THREE.Vector3(0, 0, 1)
  };

  private readonly spherical = new THREE.Spherical();
  private readonly goalTarget = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();
  private readonly vRight = new THREE.Vector3();
  private readonly vFwd = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private goalRadius = START_RADIUS;

  private selection: BuilderEntry | null = null;
  private readonly highlight: THREE.BoxHelper;
  private readonly pressed = new Set<string>();
  private readonly pointers = new Map<number, PointerState>();
  private pinch: PinchState | null = null;

  /** Ultima lista mostrada en el panel (para detectar cambios sin repintar). */
  private listEntries: BuilderEntry[] = [];
  private listAccumulator = 0;

  private readonly onPointerDown: (e: PointerEvent) => void;
  private readonly onPointerMove: (e: PointerEvent) => void;
  private readonly onPointerUp: (e: PointerEvent) => void;
  private readonly onWheel: (e: WheelEvent) => void;
  private readonly onContextMenu: (e: Event) => void;
  private readonly onKeyDown: (e: KeyboardEvent) => void;
  private readonly onKeyUp: (e: KeyboardEvent) => void;

  constructor(options: BuilderOptions) {
    this.scene = options.scene;
    this.camera = options.camera;
    this.container = options.container;
    this.hud = options.hud;
    this.raycastRoots = options.raycastRoots;
    this.entries = options.entries;
    this.onEnter = options.onEnter;
    this.onExit = options.onExit;
    this.onDelete = options.onDelete;
    this.canDelete = options.canDelete;
    this.groundHeightAt = options.groundHeightAt;

    this.gizmo = new BuilderGizmo(this.camera, this.scene);
    this.gizmo.setTool('move');

    this.highlight = new THREE.BoxHelper(new THREE.Object3D(), PICK_COLOR);
    this.highlight.visible = false;
    this.highlight.layers.set(1);
    this.scene.add(this.highlight);

    this.styleButton();
    this.styleObjectsButton();
    this.stylePanel();
    this.styleToolbar();
    this.styleDeleteOverlay();

    this.onPointerDown = (e) => {
      if (!this.active) return;
      if (this.drag) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('button') || this.panel.contains(target)) return;
      // Prioridad 1: arrastrar el gizmo de transformacion (no orbita ni pico).
      const gizmoHit = this.gizmo.pick(this.screenToNdc(e.clientX, e.clientY));
      if (gizmoHit && this.selection) {
        this.startDrag(e.pointerId, gizmoHit.tool, gizmoHit.axis, e.clientX, e.clientY);
        return;
      }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: false, t: performance.now(), button: e.button });
      if (this.pointers.size === 2) this.snapshotPinch();
    };

    this.onPointerMove = (e: PointerEvent) => {
      if (!this.active) return;
      if (this.drag) {
        if (this.drag.pointerId === e.pointerId) this.updateDrag(e.clientX, e.clientY);
        return;
      }
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (Math.hypot(dx, dy) > PICK_PX) p.moved = true;

      if (this.pointers.size === 1) {
        if (e.pointerType === 'touch') {
          this.orbit(dx, dy);
        } else if (e.pointerType === 'mouse') {
          if (e.buttons === 2 || e.shiftKey) this.pan(dx, dy);
          else if (e.buttons === 1) this.orbit(dx, dy);
        }
      } else if (this.pointers.size === 2 && this.pinch) {
        this.updatePinch();
      }
    };

    this.onPointerUp = (e: PointerEvent) => {
      if (!this.active) return;
      if (this.drag) {
        if (this.drag.pointerId === e.pointerId) this.endDrag();
        return;
      }
      const p = this.pointers.get(e.pointerId);
      if (p && !p.moved && p.button === 0 && performance.now() - p.t < PICK_MS) {
        this.pick(e.clientX, e.clientY);
      }
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 2) this.snapshotPinch();
      else this.pinch = null;
    };

    this.onWheel = (e: WheelEvent) => {
      if (!this.active) return;
      e.preventDefault();
      this.zoom(Math.exp(e.deltaY * ZOOM_WHEEL));
    };

    this.onContextMenu = (e: Event) => {
      if (this.active) e.preventDefault();
    };

    this.onKeyDown = (e: KeyboardEvent) => {
      if (!this.active) return;
      if (e.code === 'Escape') {
        // Un Escape activo cancela primero la confirmacion de borrado.
        if (this.deleteOverlay.style.display === 'flex') {
          this.closeDeleteConfirm();
          return;
        }
        this.exit();
        return;
      }
      this.pressed.add(e.code);
      if (e.code.startsWith('Arrow')) e.preventDefault();
    };

    this.onKeyUp = (e: KeyboardEvent) => {
      this.pressed.delete(e.code);
    };
  }

  mount(parent: HTMLElement): void {
    parent.append(this.button, this.objectsButton, this.panel, this.toolbar, this.deleteOverlay);
    this.container.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    this.container.addEventListener('pointermove', this.onPointerMove, { passive: false });
    this.container.addEventListener('pointerup', this.onPointerUp);
    this.container.addEventListener('pointercancel', this.onPointerUp);
    this.container.addEventListener('wheel', this.onWheel, { passive: false });
    this.container.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private styleButton(): void {
    this.button.type = 'button';
    const b = this.button.style;
    b.position = 'fixed';
    b.top = 'max(14px, env(safe-area-inset-top))';
    b.right = '14px';
    b.zIndex = '42';
    b.padding = '7px 13px';
    b.borderRadius = '999px';
    b.border = '1px solid rgba(255,240,214,0.4)';
    b.background = 'rgba(20,26,34,0.55)';
    b.color = '#e8e2d4';
    b.font = '12px system-ui, sans-serif';
    b.fontWeight = '600';
    b.cursor = 'pointer';
    b.userSelect = 'none';
    b.touchAction = 'none';
    this.button.textContent = 'Constructor';
    this.button.addEventListener('click', () => this.toggle());
  }

  /** Boton "Objetos": solo visible dentro del Modo Constructor. */
  private styleObjectsButton(): void {
    this.objectsButton.type = 'button';
    const b = this.objectsButton.style;
    b.position = 'fixed';
    b.top = 'max(52px, calc(env(safe-area-inset-top) + 38px))';
    b.right = '14px';
    b.zIndex = '42';
    b.display = 'none';
    b.padding = '7px 13px';
    b.borderRadius = '999px';
    b.border = '1px solid rgba(255,240,214,0.4)';
    b.background = 'rgba(20,26,34,0.55)';
    b.color = '#e8e2d4';
    b.font = '12px system-ui, sans-serif';
    b.fontWeight = '600';
    b.cursor = 'pointer';
    b.userSelect = 'none';
    b.touchAction = 'none';
    this.objectsButton.textContent = 'Objetos';
    this.objectsButton.addEventListener('click', () => this.togglePanel());
  }

  /** Panel tactil compacto: lista desplazable de objetos seleccionables. */
  private stylePanel(): void {
    const p = this.panel.style;
    p.position = 'fixed';
    p.left = '12px';
    p.bottom = 'max(12px, env(safe-area-inset-bottom))';
    p.width = 'min(86vw, 320px)';
    p.maxHeight = 'min(46vh, 380px)';
    p.display = 'none';
    p.flexDirection = 'column';
    p.background = 'rgba(8,11,16,0.92)';
    p.border = '1px solid rgba(255,240,214,0.3)';
    p.borderRadius = '12px';
    p.overflow = 'hidden';
    p.boxShadow = '0 6px 22px rgba(0,0,0,0.5)';
    p.zIndex = '43';

    const header = document.createElement('div');
    header.textContent = 'Objetos de la escena';
    const hs = header.style;
    hs.padding = '10px 12px 8px';
    hs.borderBottom = '1px solid rgba(255,240,214,0.15)';
    hs.color = '#ffe6b8';
    hs.font = '12px system-ui, sans-serif';
    hs.fontWeight = '600';
    hs.letterSpacing = '0.06em';
    this.panel.append(header);

    const ls = this.list.style;
    ls.overflowY = 'auto';
    ls.padding = '6px';
    ls.flex = '1 1 auto';
    this.panel.append(this.list);
  }

  /** Barra de herramientas contextual: solo visible con un objeto seleccionado. */
  private styleToolbar(): void {
    const t = this.toolbar.style;
    t.position = 'fixed';
    t.top = `${TOOLBAR_TOP}px`;
    t.right = '14px';
    t.zIndex = '44';
    t.display = 'none';
    t.flexDirection = 'column';
    t.gap = '8px';
    t.padding = '6px';
    t.borderRadius = '12px';
    t.background = 'rgba(8,11,16,0.9)';
    t.border = '1px solid rgba(255,240,214,0.3)';
    this.toolbar.addEventListener('pointerdown', (e) => e.stopPropagation());

    const styleTool = (button: HTMLButtonElement, label: string, onActivate: () => void): void => {
      button.type = 'button';
      button.textContent = label;
      const b = button.style;
      b.padding = '7px 13px';
      b.borderRadius = '999px';
      b.border = '1px solid rgba(255,240,214,0.4)';
      b.background = 'rgba(20,26,34,0.55)';
      b.color = '#e8e2d4';
      b.font = '12px system-ui, sans-serif';
      b.fontWeight = '600';
      b.cursor = 'pointer';
      b.userSelect = 'none';
      b.touchAction = 'none';
      button.addEventListener('click', onActivate);
    };
    styleTool(this.moveButton, 'Mover', () => this.setTool('move'));
    styleTool(this.rotateButton, 'Rotar', () => this.setTool('rotate'));
    styleTool(this.scaleButton, 'Escalar', () => this.setTool('scale'));
    styleTool(this.deleteButton, 'Eliminar', () => this.requestDelete());
    this.toolbar.append(this.moveButton, this.rotateButton, this.scaleButton, this.deleteButton);
  }

  /** Confirma el borrado antes de eliminar; los gestos del constructor lo ignoran. */
  private styleDeleteOverlay(): void {
    const o = this.deleteOverlay.style;
    o.position = 'fixed';
    o.inset = '0';
    o.display = 'none';
    o.alignItems = 'center';
    o.justifyContent = 'center';
    o.background = 'rgba(0,0,0,0.6)';
    o.zIndex = '60';
    o.padding = '24px';
    this.deleteOverlay.addEventListener('pointerdown', (e) => e.stopPropagation());

    const box = document.createElement('div');
    const bs = box.style;
    bs.background = 'rgba(8,11,16,0.96)';
    bs.border = '1px solid rgba(255,240,214,0.3)';
    bs.borderRadius = '12px';
    bs.padding = '18px';
    bs.maxWidth = 'min(86vw, 320px)';
    bs.display = 'flex';
    bs.flexDirection = 'column';
    bs.gap = '14px';

    const text = document.createElement('div');
    text.className = 'builder-confirm-text';
    const ts = text.style;
    ts.color = '#ffe6b8';
    ts.font = '13px system-ui, sans-serif';
    ts.fontWeight = '600';
    ts.lineHeight = '1.4';
    box.append(text);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.justifyContent = 'flex-end';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancelar';
    const cb = cancel.style;
    cb.padding = '8px 14px';
    cb.borderRadius = '999px';
    cb.border = '1px solid rgba(255,240,214,0.4)';
    cb.background = 'rgba(20,26,34,0.55)';
    cb.color = '#e8e2d4';
    cb.font = '12px system-ui, sans-serif';
    cb.fontWeight = '600';
    cb.cursor = 'pointer';
    cancel.addEventListener('click', () => this.closeDeleteConfirm());

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.textContent = 'Eliminar';
    const yb = confirm.style;
    yb.padding = '8px 14px';
    yb.borderRadius = '999px';
    yb.border = '1px solid rgba(255,111,97,0.8)';
    yb.background = 'rgba(180,48,40,0.55)';
    yb.color = '#ffd9d4';
    yb.font = '12px system-ui, sans-serif';
    yb.fontWeight = '600';
    yb.cursor = 'pointer';
    confirm.addEventListener('click', () => this.confirmDelete());

    actions.append(cancel, confirm);
    box.append(actions);
    this.deleteOverlay.append(box);
  }

  toggle(): void {
    if (this.active) this.exit();
    else this.enter();
  }

  private enter(): void {
    if (this.active) return;
    this.initCamera();
    this.active = true;
    this.pressed.clear();
    this.pointers.clear();
    this.pinch = null;
    this.drag = null;
    this.refreshButton();
    this.onEnter();
    this.hud.setBuilderMode(true);
    this.hud.setPrompt(null);
    this.objectsButton.style.display = 'block';
    this.toolbar.style.display = 'flex';
    this.refreshToolbar();
  }

  exit(): void {
    if (!this.active) return;
    this.closePanel();
    this.closeDeleteConfirm();
    this.endDrag();
    this.setSelection(null);
    this.active = false;
    this.pressed.clear();
    this.pointers.clear();
    this.pinch = null;
    this.refreshButton();
    this.hud.setBuilderMode(false);
    this.objectsButton.style.display = 'none';
    this.toolbar.style.display = 'none';
    this.onExit();
  }

  private refreshButton(): void {
    this.button.textContent = this.active ? 'Salir del Constructor' : 'Constructor';
    if (this.active) {
      this.button.style.borderColor = 'rgba(255,230,184,0.9)';
      this.button.style.background = 'rgba(255,230,184,0.16)';
      this.button.style.color = '#ffe6b8';
    } else {
      this.button.style.borderColor = 'rgba(255,240,214,0.4)';
      this.button.style.background = 'rgba(20,26,34,0.55)';
      this.button.style.color = '#e8e2d4';
    }
  }

  private togglePanel(): void {
    if (this.panel.style.display === 'flex') this.closePanel();
    else this.openPanel();
  }

  private openPanel(): void {
    this.refreshList();
    this.panel.style.display = 'flex';
  }

  private closePanel(): void {
    this.panel.style.display = 'none';
    this.listEntries = [];
    this.list.replaceChildren();
  }

  /** Arranca la camara desde la vista actual, orbitando un pivote al frente. */
  private initCamera(): void {
    this.camera.getWorldDirection(this.dir);
    this.target.copy(this.camera.position).addScaledVector(this.dir, START_RADIUS);
    this.goalTarget.copy(this.target);
    this.offset.copy(this.camera.position).sub(this.target);
    this.spherical.setFromVector3(this.offset);
    this.spherical.phi = Math.max(MIN_PHI, Math.min(MAX_PHI, this.spherical.phi));
    const radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, this.spherical.radius));
    this.spherical.radius = radius;
    this.goalRadius = radius;
  }

  update(dt: number): void {
    if (!this.active) return;
    const dampR = 1 - Math.exp(-RADIUS_DAMP * dt);
    this.spherical.radius += (this.goalRadius - this.spherical.radius) * dampR;
    this.target.lerp(this.goalTarget, 1 - Math.exp(-TARGET_DAMP * dt));
    this.camera.position.setFromSpherical(this.spherical).add(this.target);
    this.camera.lookAt(this.target);
    this.updateKeyboard(dt);
    this.updateHighlight();
    this.updateGizmo();
    this.refreshListTimer(dt);
  }

  private refreshListTimer(dt: number): void {
    this.listAccumulator += dt;
    if (this.listAccumulator < LIST_REFRESH_SECONDS) return;
    this.listAccumulator = 0;
    this.refreshList();
  }

  /**
   * Refresca la lista cuando cambian las entradas (objects alias distintos o
   * nuevo orden). Las entradas fuera de la escena se descartan y, si el objeto
   * seleccionado desaparecio, la seleccion se limpia.
   */
  private refreshList(): void {
    const next = this.entries().filter((entry) => this.isInScene(entry.object));
    const same =
      next.length === this.listEntries.length && next.every((entry, i) => entry.object === this.listEntries[i].object);
    if (same) return;

    this.listEntries = next;
    this.rebuildRows();
    if (this.selection && !this.isInScene(this.selection.object)) this.setSelection(null);
    this.refreshPanelHighlight();
  }

  private isInScene(object: THREE.Object3D): boolean {
    let node: THREE.Object3D | null = object.parent;
    while (node) {
      if (node === this.scene) return true;
      node = node.parent;
    }
    return false;
  }

  private rebuildRows(): void {
    this.list.replaceChildren();
    if (this.listEntries.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'Sin objetos disponibles';
      const es = empty.style;
      es.padding = '10px 12px';
      es.color = 'rgba(232,226,212,0.5)';
      es.font = '13px system-ui, sans-serif';
      this.list.append(empty);
      return;
    }
    for (const entry of this.listEntries) {
      const row = document.createElement('button');
      row.type = 'button';
      row.textContent = entry.name;
      const rs = row.style;
      rs.display = 'block';
      rs.width = '100%';
      rs.textAlign = 'left';
      rs.padding = '10px 12px';
      rs.margin = '2px 0';
      rs.borderRadius = '8px';
      rs.border = 'none';
      rs.background = 'transparent';
      rs.color = '#e8e2d4';
      rs.font = '13px system-ui, sans-serif';
      rs.cursor = 'pointer';
      rs.userSelect = 'none';
      rs.touchAction = 'manipulation';
      rs.transition = 'background 0.15s ease';
      row.addEventListener('click', () => this.setSelection(entry));
      this.list.append(row);
    }
  }

  /** Sincroniza el resaltado de la lista con la seleccion actual. */
  private refreshPanelHighlight(): void {
    const rows = this.list.children;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as HTMLButtonElement;
      const selected = this.selection !== null && this.listEntries[i]?.object === this.selection.object;
      row.style.background = selected ? 'rgba(255,230,184,0.18)' : 'transparent';
      row.style.color = selected ? '#ffe6b8' : '#e8e2d4';
      row.style.borderLeft = selected ? '3px solid #ffd36e' : '3px solid transparent';
      if (selected) row.scrollIntoView({ block: 'nearest' });
    }
  }

  private updateKeyboard(dt: number): void {
    const move = KEY_MOVE * dt;
    const turn = KEY_TURN * dt;
    if (this.pressed.has('KeyW') || this.pressed.has('ArrowUp')) this.goalRadius = this.clampRadius(this.goalRadius - move);
    if (this.pressed.has('KeyS') || this.pressed.has('ArrowDown')) this.goalRadius = this.clampRadius(this.goalRadius + move);
    if (this.pressed.has('KeyA') || this.pressed.has('ArrowLeft')) this.spherical.theta -= turn;
    if (this.pressed.has('KeyD') || this.pressed.has('ArrowRight')) this.spherical.theta += turn;
    if (this.pressed.has('KeyQ')) this.spherical.phi -= turn;
    if (this.pressed.has('KeyE')) this.spherical.phi += turn;
    this.spherical.phi = Math.max(MIN_PHI, Math.min(MAX_PHI, this.spherical.phi));
  }

  private updateHighlight(): void {
    if (!this.selection) return;
    this.highlight.visible = this.selection.object.visible;
    if (this.highlight.visible) this.highlight.update();
  }

  /** Orden de los controles: gira la camara alrededor del pivote. */
  private orbit(dx: number, dy: number): void {
    this.spherical.theta -= dx * ORBIT_PX;
    this.spherical.phi -= dy * ORBIT_PX;
    this.spherical.phi = Math.max(MIN_PHI, Math.min(MAX_PHI, this.spherical.phi));
  }

  /** Mueve el pivote por el suelo (XZ), conservando la altura de la camara. */
  private pan(dx: number, dy: number): void {
    this.vRight.setFromMatrixColumn(this.camera.matrixWorld, 0).setY(0).normalize();
    this.vFwd.setFromMatrixColumn(this.camera.matrixWorld, 2).setY(0).normalize();
    const scale = this.spherical.radius * PAN_PX;
    this.goalTarget.addScaledVector(this.vRight, -dx * scale);
    this.goalTarget.addScaledVector(this.vFwd, -dy * scale);
  }

  private zoom(scale: number): void {
    this.goalRadius = this.clampRadius(this.goalRadius * scale);
  }

  private clampRadius(value: number): number {
    return Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, value));
  }

  /** Tocado sin arrastre: rayo desde el punto y seleccion del objeto real. */
  private pick(screenX: number, screenY: number): void {
    this.refreshList();
    this.raycaster.setFromCamera(this.screenToNdc(screenX, screenY), this.camera);
    const hits = this.raycaster.intersectObjects(this.raycastRoots(), true);
    this.setSelection(hits.length > 0 ? this.findEntry(hits[0].object) : null);
  }

  private screenToNdc(screenX: number, screenY: number): THREE.Vector2 {
    const rect = this.container.getBoundingClientRect();
    this.ndc.set(
      ((screenX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
      -(((screenY - rect.top) / Math.max(rect.height, 1)) * 2 - 1)
    );
    return this.ndc;
  }

  /**
   * Busca la entrada mas especifica (la mas profunda) que contiene al objeto
   * golpeado: una malla interna de un modelo resuelve a la entrada del modelo.
   */
  private findEntry(object: THREE.Object3D): BuilderEntry | null {
    let node: THREE.Object3D | null = object;
    while (node) {
      const entry = this.listEntries.find((candidate) => candidate.object === node);
      if (entry) return entry;
      node = node.parent;
    }
    return null;
  }

  private setSelection(selection: BuilderEntry | null): void {
    if (selection && this.selection && selection.object === this.selection.object) return;
    this.selection = selection;
    if (selection) {
      this.highlight.object = selection.object;
      this.highlight.update();
      this.highlight.visible = selection.object.visible;
    } else {
      this.highlight.visible = false;
    }
    this.hud.setSelectionName(selection ? selection.name : null);
    this.refreshPanelHighlight();
    this.refreshToolbar();
    this.updateGizmo();
  }

  /** El gizmo ancla en el objeto y se redimensiona a su caja envolvente. */
  private updateGizmo(): void {
    if (!this.selection || this.tool === 'delete') {
      this.gizmo.setPosition(null);
      return;
    }
    const object = this.selection.object;
    if (!this.isInScene(object) || !object.visible) {
      this.gizmo.setPosition(null);
      return;
    }
    this.gizmo.setPosition(object.position);
    this.scratchBox.setFromObject(object);
    this.scratchBox.getSize(this.scratchSize);
    this.gizmo.setRadius(Math.max(this.scratchSize.x, this.scratchSize.y, this.scratchSize.z) * 0.5);
  }

  private eulerComponent(euler: THREE.Euler, axis: GizmoAxis): number {
    return axis === 'X' ? euler.x : axis === 'Y' ? euler.y : euler.z;
  }

  private setEulerComponent(euler: THREE.Euler, axis: GizmoAxis, value: number): void {
    if (axis === 'X') euler.x = value;
    else if (axis === 'Y') euler.y = value;
    else euler.z = value;
  }

  /** Arrastre del gizmo: congela posicion/rotacion/escala iniciales. */
  private startDrag(pointerId: number, tool: GizmoTool, axis: GizmoAxis, clientX: number, clientY: number): void {
    if (!this.selection) return;
    const object = this.selection.object;
    const startPos = object.position.clone();
    this.drag = {
      pointerId,
      tool,
      axis,
      startPos,
      startEuler: object.rotation.clone(),
      startScale: object.scale.clone(),
      groundStart: this.groundHeightAt ? this.groundHeightAt(startPos.x, startPos.z) : startPos.y,
      startAngle: 0,
      accumAngle: 0,
      startClientY: clientY,
      startFactor: object.scale.x || 1
    };
    if (tool === 'rotate') {
      const angle = this.rotateAngleAt(clientX, clientY);
      if (angle !== null) this.drag.startAngle = angle;
    }
  }

  private endDrag(): void {
    this.drag = null;
    this.updateGizmo();
  }

  private rotateAngleAt(clientX: number, clientY: number): number | null {
    const drag = this.drag;
    if (!drag || !drag.startPos) return null;
    this.raycaster.setFromCamera(this.screenToNdc(clientX, clientY), this.camera);
    const normal = this.axisVectors[drag.axis];
    const hit = rayPlaneHit(this.raycaster.ray.origin, this.raycaster.ray.direction, drag.startPos, normal, this.scratchHit);
    if (!hit) return null;
    this.scratchA.copy(hit).sub(drag.startPos);
    return angleInBasis(this.scratchA, normal, this.camera.position, this.scratchB);
  }

  /**
   * Aplica el gesto en curso: mover (restringido al eje, opcionalmente
   * siguiendo el suelo), rotar (ejes mundo con snap de 15°) y escala uniforme
   * con limites seguros.
   */
  private updateDrag(clientX: number, clientY: number): void {
    const drag = this.drag;
    const selection = this.selection;
    if (!drag || !selection) return;
    const object = selection.object;

    if (drag.tool === 'move') {
      this.raycaster.setFromCamera(this.screenToNdc(clientX, clientY), this.camera);
      this.scratchA.copy(this.camera.position).sub(drag.startPos).normalize();
      const hit = rayPlaneHit(this.raycaster.ray.origin, this.raycaster.ray.direction, drag.startPos, this.scratchA, this.scratchHit);
      if (!hit) return;
      const axis = this.axisVectors[drag.axis];
      const t = axisParam(drag.startPos, axis, hit);
      this.scratchB.copy(drag.startPos).addScaledVector(axis, t);
      if (this.groundHeightAt && (drag.axis === 'X' || drag.axis === 'Z')) {
        const offset = drag.startPos.y - drag.groundStart;
        this.scratchB.y = this.groundHeightAt(this.scratchB.x, this.scratchB.z) + offset;
      }
      object.position.copy(this.scratchB);
    } else if (drag.tool === 'rotate') {
      const angle = this.rotateAngleAt(clientX, clientY);
      if (angle === null) return;
      const delta = angle - drag.startAngle;
      let wrapped = delta;
      const full = Math.PI * 2;
      wrapped -= Math.round(wrapped / full) * full;
      drag.accumAngle += wrapped;
      drag.startAngle = angle;
      const snapped = snapAngle(this.eulerComponent(drag.startEuler, drag.axis) + drag.accumAngle, ROTATE_SNAP);
      this.setEulerComponent(object.rotation, drag.axis, snapped);
    } else if (drag.tool === 'scale') {
      const factor = uniformScaleFactor(drag.startFactor, clientY - drag.startClientY, SCALE_SPEED, SCALE_MIN, SCALE_MAX);
      object.scale.copy(drag.startScale).multiplyScalar(factor);
    }
    this.updateGizmo();
  }

  private canDeleteSelection(): boolean {
    if (!this.selection) return false;
    if (!this.canDelete) return true;
    return this.canDelete(this.selection);
  }

  private requestDelete(): void {
    if (!this.canDeleteSelection() || !this.selection) return;
    const message = this.deleteOverlay.querySelector('.builder-confirm-text');
    if (message) message.textContent = `Eliminar «${this.selection.name}» del mundo?`;
    this.deleteOverlay.style.display = 'flex';
  }

  private confirmDelete(): void {
    const entry = this.selection;
    this.closeDeleteConfirm();
    if (!entry) return;
    if (!this.canDeleteSelection()) return;
    if (this.onDelete) this.onDelete(entry);
    this.refreshList();
    this.setSelection(null);
  }

  private closeDeleteConfirm(): void {
    this.deleteOverlay.style.display = 'none';
  }

  private setTool(tool: BuilderTool): void {
    if (this.tool === tool) return;
    this.tool = tool;
    if (tool === 'delete') this.gizmo.setPosition(null);
    else this.gizmo.setTool(tool);
    this.refreshToolbar();
    this.updateGizmo();
  }

  /** Resalta la herramienta activa y habilita "Eliminar" solo si procede. */
  private refreshToolbar(): void {
    const setActive = (button: HTMLButtonElement, active: boolean): void => {
      button.style.borderColor = active ? 'rgba(255,230,184,0.9)' : 'rgba(255,240,214,0.4)';
      button.style.background = active ? 'rgba(255,230,184,0.16)' : 'rgba(20,26,34,0.55)';
      button.style.color = active ? '#ffe6b8' : '#e8e2d4';
    };
    setActive(this.moveButton, this.tool === 'move');
    setActive(this.rotateButton, this.tool === 'rotate');
    setActive(this.scaleButton, this.tool === 'scale');
    setActive(this.deleteButton, this.tool === 'delete');
    const deletable = this.canDeleteSelection();
    this.deleteButton.disabled = !deletable;
    this.deleteButton.style.opacity = deletable ? '1' : '0.35';
    this.deleteButton.style.cursor = deletable ? 'pointer' : 'default';
  }

  private snapshotPinch(): void {
    const [p1, p2] = [...this.pointers.values()];
    this.pinch = {
      cx: (p1.x + p2.x) / 2,
      cy: (p1.y + p2.y) / 2,
      d: Math.hypot(p2.x - p1.x, p2.y - p1.y)
    };
  }

  private updatePinch(): void {
    const [p1, p2] = [...this.pointers.values()];
    const cx = (p1.x + p2.x) / 2;
    const cy = (p1.y + p2.y) / 2;
    const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (this.pinch) {
      this.pan(cx - this.pinch.cx, cy - this.pinch.cy);
      if (d > 0 && this.pinch.d > 0) this.zoom(this.pinch.d / d);
    }
    this.pinch = { cx, cy, d };
  }

  dispose(): void {
    if (this.active) this.exit();
    this.closeDeleteConfirm();
    this.button.remove();
    this.objectsButton.remove();
    this.panel.remove();
    this.toolbar.remove();
    this.deleteOverlay.remove();
    this.container.removeEventListener('pointerdown', this.onPointerDown);
    this.container.removeEventListener('pointermove', this.onPointerMove);
    this.container.removeEventListener('pointerup', this.onPointerUp);
    this.container.removeEventListener('pointercancel', this.onPointerUp);
    this.container.removeEventListener('wheel', this.onWheel);
    this.container.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.scene.remove(this.highlight);
    this.gizmo.dispose();
  }
}