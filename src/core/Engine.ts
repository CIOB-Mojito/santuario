import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { detectDeviceProfile, nextQuality, QUALITY_PROFILES, type QualityLevel } from '../config/quality';
import { Ticker } from './Ticker';
import { Renderer } from './Renderer';
import { Sky } from '../lighting/Sky';
import { LightingSystem } from '../lighting/LightingSystem';
import { World } from '../world/World';
import { zoneAt, type ZoneDef } from '../world/zones';
import { AssetRegistry } from '../assets/AssetRegistry';
import { ASSETS, MOBILE_BUDGET_BYTES } from '../assets/manifest';
import { StreamingManager } from '../streaming/StreamingManager';
import { InteractionSystem } from '../interaction/InteractionSystem';
import { AudioSystem } from '../audio/AudioSystem';
import { NarrativeSystem } from '../narrative/NarrativeSystem';
import { FRAGMENTS } from '../narrative/fragments';
import { Particles } from '../effects/Particles';
import { Player } from '../player/Player';
import { CameraController } from '../player/CameraController';
import { InputState } from '../player/InputState';
import { KeyboardControls } from '../player/KeyboardControls';
import { TouchControls } from '../ui/TouchControls';
import { Hud } from '../ui/Hud';
import { DebugPanel } from '../debug/DebugPanel';

/**
 * Orquestador (seccion 27). Une todos los sistemas, no contiene logica de
 * juego propia: solo decide el orden en que se actualizan y reacciona a los
 * cambios de zona (audio, niebla, narrativa).
 */
export class Engine {
  private readonly container: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly ticker = new Ticker();
  private readonly renderer: Renderer;
  private readonly registry = new AssetRegistry();
  private readonly streaming: StreamingManager;
  private readonly gltf = new GLTFLoader();
  private readonly interaction = new InteractionSystem(6);
  private readonly audio = new AudioSystem();
  private readonly narrative = new NarrativeSystem();
  private readonly camera: CameraController;
  private readonly player = new Player();
  private readonly inputState = new InputState();
  private readonly world: World;
  private readonly lighting: LightingSystem;
  private readonly sky = new Sky();
  private readonly particles: Particles;
  private readonly keyboard: KeyboardControls;
  private readonly touch: TouchControls;
  private readonly hud: Hud;
  private readonly debug: DebugPanel;

  private quality: QualityLevel;
  private readonly fog = new THREE.FogExp2(0xcdb99a, 0.0016);
  private fogTarget = 0.0016;
  private currentZone: ZoneDef;
  private streamAccumulator = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.quality = detectDeviceProfile();
    const profile = QUALITY_PROFILES[this.quality];

    this.renderer = new Renderer(profile);
    container.appendChild(this.renderer.canvas);

    this.scene.fog = this.fog;
    this.world = new World(this.scene, this.registry);
    this.world.build();
    this.lighting = new LightingSystem(this.scene, this.sky, profile);
    this.scene.add(this.sky.mesh);

    this.particles = new Particles(profile, { x: 40, y: 14, z: 64 }, new THREE.Vector3(0, 0, 0));
    this.scene.add(this.particles.points);

    this.camera = new CameraController(this.aspect());
    this.currentZone = zoneAt(this.player.position);

    this.registry.registerMany(ASSETS);
    this.streaming = new StreamingManager(
      this.registry,
      (entry) =>
        new Promise((resolve, reject) => {
          if (!entry.url) {
            resolve(null);
            return;
          }
          this.gltf.load(entry.url, (gltf) => resolve(gltf.scene), undefined, reject);
        }),
      MOBILE_BUDGET_BYTES,
      140,
      (entry, object) => this.placeLoadedAsset(entry.id, object)
    );
    this.narrative.load(FRAGMENTS);

    for (const landmark of this.world.landmarks) {
      this.interaction.add({
        object: landmark.object,
        label: landmark.label,
        onClick: () => this.hud.showNarrative(landmark.label)
      });
    }

    this.hud = new Hud(() => this.cycleQuality());
    this.debug = new DebugPanel();
    this.keyboard = new KeyboardControls(this.renderer.canvas, this.camera, this.inputState, this.interaction, () => void this.audio.unlock());
    this.touch = new TouchControls(this.inputState, this.camera, this.interaction);

    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pointerdown', this.onFirstGesture, { once: true });
  }

  start(): void {
    this.hud.mount(this.container);
    this.hud.setQuality(this.quality);
    this.hud.setZone(this.currentZone.name);
    this.debug.mount(this.container);
    this.touch.mount(this.container);
    this.audio.setZone(this.currentZone);
    this.applyQuality();
    this.resize();
    this.ticker.add(this.update);
    this.ticker.start();
  }

  private readonly onFirstGesture = (): void => {
    void this.audio.unlock();
  };

  private readonly onVisibility = (): void => {
    if (document.hidden) this.ticker.stop();
    else this.ticker.start();
  };

  private readonly onResize = (): void => {
    this.resize();
  };

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.camera.aspect = w / Math.max(h, 1);
    this.camera.camera.updateProjectionMatrix();
  }

  private aspect(): number {
    return window.innerWidth / Math.max(window.innerHeight, 1);
  }

  private cycleQuality(): void {
    this.quality = nextQuality(this.quality);
    this.hud.setQuality(this.quality);
    this.applyQuality();
  }

  private applyQuality(): void {
    const profile = QUALITY_PROFILES[this.quality];
    this.renderer.applyProfile(profile);
    this.lighting.applyProfile(profile);
    this.particles.setProfile(profile);
    this.renderer.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.gl.toneMappingExposure = 1.05;
    this.renderer.gl.outputColorSpace = THREE.SRGBColorSpace;
  }

  private readonly update = (dt: number): void => {
    this.keyboard.update();
    this.inputState.applyTo(this.player);
    this.player.yaw = this.camera.yaw;
    this.player.update(dt, this.world.colliders);
    this.camera.update(dt, this.player);
    this.sky.follow(this.camera.camera);
    this.particles.update(dt, this.camera.camera.position);

    const zone = zoneAt(this.player.position);
    if (zone.id !== this.currentZone.id) this.enterZone(zone);
    this.fog.density += (this.fogTarget - this.fog.density) * Math.min(1, dt * 1.5);
    this.lighting.ambient.intensity += (zone.ambientLevel * 0.55 - this.lighting.ambient.intensity) * Math.min(1, dt * 1.5);

    this.interaction.update(this.camera.camera);
    this.audio.update(dt);
    this.hud.update(dt);

    this.streamAccumulator += dt;
    if (this.streamAccumulator > 0.5) {
      this.streamAccumulator = 0;
      this.streaming.update(this.player.position);
    }

    this.renderer.render(this.scene, this.camera.camera);
    this.updateDebug();
  };

  private enterZone(zone: ZoneDef): void {
    this.currentZone = zone;
    this.hud.setZone(zone.name);
    this.audio.setZone(zone);
    this.fogTarget = zone.fogDensity;
    const fragment = this.narrative.next(zone);
    if (fragment) this.hud.showNarrative(fragment.text);
  }

  /** Coloca un recurso cargado en el mundo, normalizado a escala humana. */
  private placeLoadedAsset(id: string, object: unknown): void {
    if (!(object instanceof THREE.Object3D)) return;
    object.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(object).getSize(size);
    if (size.y > 0.0001) object.scale.multiplyScalar(1.85 / size.y);

    const box = new THREE.Box3().setFromObject(object);
    const center = new THREE.Vector3();
    box.getCenter(center);
    object.position.x += 3 - center.x;
    object.position.z += -6 - center.z;
    object.position.y += -box.min.y;

    object.name = id;
    this.scene.add(object);
  }

  private updateDebug(): void {
    const stats = this.debugStats();
    this.debug.update(stats);
  }

  private debugStats() {
    const p = this.player.position;
    const audio = `int ${this.audio.level('interior').toFixed(2)} ext ${this.audio.level('windExterior').toFixed(2)}`;
    return {
      fps: this.ticker.fps,
      frameMs: this.ticker.frameMs,
      drawCalls: this.renderer.drawCalls,
      triangles: this.renderer.triangles,
      geometries: this.renderer.geometries,
      textures: this.renderer.textures,
      programs: this.renderer.programs,
      pixelRatio: this.renderer.pixelRatio,
      meshes: this.world.meshCount,
      zone: this.currentZone.name,
      position: `${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`,
      assets: `${this.registry.size} reg · ${this.streaming.loadedCount} carg · ${this.streaming.queueLength} en cola`,
      audio,
      quality: this.quality.replace('QUALITY_', '').toLowerCase()
    };
  }

  dispose(): void {
    this.ticker.dispose();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointerdown', this.onFirstGesture);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.keyboard.dispose();
    this.touch.dispose();
    this.hud.dispose();
    this.debug.dispose();
    this.particles.dispose();
    this.lighting.dispose();
    this.sky.dispose();
    this.world.dispose();
    this.audio.dispose();
    this.renderer.dispose();
    this.scene.clear();
  }
}
