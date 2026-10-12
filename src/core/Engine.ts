import { Renderer } from './Renderer';
import { Ticker } from './Ticker';
import { CameraRig } from './CameraRig';
import { World } from '../scene/World';
import { Hud } from '../ui/Hud';
import { CameraControls } from '../ui/CameraControls';
import {
  QUALITY_PROFILES,
  detectDeviceProfile,
  type QualityLevel,
  type QualityProfile
} from '../config/quality';

/**
 * Orquestador. Posee los subsistemas y los actualiza en orden. No construye
 * geometria ni dibuja: eso es de World y Renderer. Esta separacion es la que
 * permite crecer por fases sin reescribir el motor.
 */
export class Engine {
  private readonly container: HTMLElement;
  private readonly renderer: Renderer;
  private readonly ticker: Ticker;
  private readonly rig: CameraRig;
  private readonly world: World;
  private readonly hud: Hud;
  private readonly controls: CameraControls;
  private resizeObserver: ResizeObserver | null = null;
  private profile: QualityProfile;
  private statsAccum = 0;

  constructor(container: HTMLElement) {
    this.container = container;

    const level = detectDeviceProfile();
    this.profile = QUALITY_PROFILES[level];

    this.renderer = new Renderer(this.profile);
    container.appendChild(this.renderer.gl.domElement);

    const { width, height } = this.size();
    this.renderer.setSize(width, height);

    this.rig = new CameraRig(this.renderer.gl.domElement, width / height);
    this.world = new World(this.profile);
    void this.world.loadStatues().catch((error) => {
      console.error('[santuario] fallo al cargar las estatuas del santuario.', error);
    });
    this.hud = new Hud((next) => this.setQuality(next));
    this.hud.setQualityLevel(level);

    this.controls = new CameraControls({
      onToggleMode: () => this.toggleCameraMode(),
      onMove: (direction, active) => {
        if (active) this.rig.pressMove(direction);
        else this.rig.releaseMove(direction);
      }
    });
    this.controls.setMode(this.rig.currentMode);

    this.ticker = new Ticker();
    this.ticker.add((dt) => this.update(dt));
    this.ticker.add(() => this.report());

    this.observeResize();
    this.resize();

    this.ticker.start();
  }

  setQuality(level: QualityLevel): void {
    this.profile = QUALITY_PROFILES[level];
    this.renderer.applyProfile(this.profile);
    this.world.setQuality(this.profile);
    this.hud.setQualityLevel(level);
    this.resize();
  }

  toggleCameraMode(): void {
    const next = this.rig.currentMode === 'ORBIT' ? 'FREE' : 'ORBIT';
    this.rig.setMode(next);
    this.controls.setMode(next);
  }

  dispose(): void {
    this.ticker.dispose();
    this.resizeObserver?.disconnect();
    this.rig.dispose();
    this.world.dispose();
    this.controls.dispose();
    this.hud.dispose();
    this.renderer.dispose();
  }

  private update(dt: number): void {
    this.rig.update(dt);
    this.world.update(dt);
    this.renderer.render(this.world.scene, this.rig.camera);
  }

  private report(): void {
    this.statsAccum += this.ticker.frameMs;
    if (this.statsAccum < 250) return;
    this.statsAccum = 0;
    this.hud.setStats({
      fps: this.ticker.fps,
      frameMs: this.ticker.smoothFrameMs,
      drawCalls: this.renderer.drawCalls,
      triangles: this.renderer.triangles,
      geometries: this.renderer.geometries,
      textures: this.renderer.textures,
      zone: this.currentZone()
    });
  }

  private currentZone(): string {
    const pos = this.rig.camera.position;
    let best = 'exterior';
    let bestDist = Infinity;
    for (const zone of this.world.zones) {
      const d = pos.distanceTo(zone.center);
      if (d < bestDist) {
        bestDist = d;
        best = zone.label;
      }
    }
    return best;
  }

  private observeResize(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
    } else {
      window.addEventListener('resize', this.resize);
    }
  }

  private size(): { width: number; height: number } {
    const width = this.container.clientWidth || window.innerWidth || 1;
    const height = this.container.clientHeight || window.innerHeight || 1;
    return { width, height };
  }

  private readonly resize = (): void => {
    const { width, height } = this.size();
    this.renderer.setSize(width, height);
    this.rig.resize(width / height);
  };
}
