export interface DebugStats {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  pixelRatio: number;
  meshes: number;
  zone: string;
  position: string;
  assets: string;
  audio: string;
  quality: string;
  textureMapStatus: string;
  envStatus: string;
}

/**
 * Panel de debug (seccion 28). Se oculta por defecto y se abre con el boton
 * "stats". Muestra metricas reales del renderer y del estado del mundo, no
 * valores inventados.
 */
export class DebugPanel {
  private readonly root = document.createElement('pre');
  private readonly toggle = document.createElement('button');
  private visible = false;

  constructor() {
    const style = this.root.style;
    style.position = 'fixed';
    style.top = 'max(14px, env(safe-area-inset-top))';
    style.right = '14px';
    style.margin = '0';
    style.padding = '10px 12px';
    style.borderRadius = '10px';
    style.background = 'rgba(8,11,16,0.82)';
    style.border = '1px solid rgba(255,240,214,0.25)';
    style.color = '#dfe7ee';
    style.font = '11px ui-monospace, monospace';
    style.lineHeight = '1.45';
    style.whiteSpace = 'pre';
    style.display = 'none';
    style.zIndex = '40';
    style.pointerEvents = 'none';

    this.toggle.type = 'button';
    this.toggle.textContent = 'stats';
    this.toggle.style.position = 'fixed';
    this.toggle.style.bottom = 'max(14px, env(safe-area-inset-bottom))';
    this.toggle.style.right = '14px';
    this.toggle.style.zIndex = '41';
    this.toggle.style.padding = '8px 12px';
    this.toggle.style.borderRadius = '999px';
    this.toggle.style.border = '1px solid rgba(255,240,214,0.4)';
    this.toggle.style.background = 'rgba(20,26,34,0.55)';
    this.toggle.style.color = '#e8e2d4';
    this.toggle.style.font = '12px system-ui, sans-serif';
    this.toggle.style.cursor = 'pointer';
    this.toggle.addEventListener('click', () => this.toggleVisible());
  }

  mount(parent: HTMLElement): void {
    parent.append(this.root, this.toggle);
  }

  toggleVisible(): void {
    this.visible = !this.visible;
    this.root.style.display = this.visible ? 'block' : 'none';
  }

  update(stats: DebugStats): void {
    if (!this.visible) return;
    this.root.textContent =
      `fps        ${stats.fps.toFixed(0)}  (${stats.frameMs.toFixed(1)} ms)\n` +
      `draw calls ${stats.drawCalls}\n` +
      `triangles  ${stats.triangles.toLocaleString('es')}\n` +
      `geometries ${stats.geometries}   textures ${stats.textures}\n` +
      `programs   ${stats.programs}   dpr ${stats.pixelRatio.toFixed(2)}\n` +
      `meshes     ${stats.meshes}\n` +
      `zona       ${stats.zone}\n` +
      `posicion   ${stats.position}\n` +
      `assets     ${stats.assets}\n` +
      `PBR        ${stats.textureMapStatus}\n` +
      `entorno    ${stats.envStatus}\n` +
      `audio      ${stats.audio}\n` +
      `calidad    ${stats.quality}`;
  }

  dispose(): void {
    this.root.remove();
    this.toggle.remove();
  }
}
