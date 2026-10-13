import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { detectDeviceProfile, nextQuality, QUALITY_PROFILES, type QualityLevel } from '../config/quality';
import { Ticker } from './Ticker';
import { Renderer } from './Renderer';
import { Sky } from '../lighting/Sky';
import { LightingSystem } from '../lighting/LightingSystem';
import { World } from '../world/World';
import { zoneAt, type ZoneDef } from '../world/zones';
import { PLACEMENTS, type Placement } from '../world/placements';
import { PremiumBox } from '../world/PremiumBox';
import { AssetRegistry } from '../assets/assetRegistry';
import { ASSETS, MOBILE_BUDGET_BYTES } from '../assets/manifest';
import { createMaterialSet, disposeMaterialSet, type MaterialSet } from '../assets/materials';
import { applyPbrTextures, loadEnvironment } from '../assets/textureLibrary';
import { StreamingManager } from '../streaming/StreamingManager';
import { InteractionSystem } from '../interaction/InteractionSystem';
import type { Interactable } from '../interaction/InteractionSystem';
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
import { BuilderMode, type BuilderEntry } from '../builder/BuilderMode';
import { GameEntrance, type MenuChoice } from '../entry/GameEntrance';
import { createGrimoireScene, type GrimoireScene } from '../entry/GrimoireScene';

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
  private readonly materials: MaterialSet = createMaterialSet();
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
  private readonly builder: BuilderMode;

  private quality: QualityLevel;
  private readonly fog = new THREE.FogExp2(0xcdb99a, 0.0016);
  private fogTarget = 0.0016;
  private currentZone: ZoneDef;
  private streamAccumulator = 0;
  private lodAccumulator = 0;
  private readonly placedModels: THREE.Object3D[] = [];
  private premiumBox: PremiumBox | null = null;
  private textureStatus = 'pendiente';
  private envStatus = 'pendiente';

  /**
   * Estado del ciclo de la experiencia: 'menu' (grimorio activo), 'play'
   * (mundo del jugador) o 'build' (constructor orbital). Un cambio de modo no
   * reconstruye nada: solo decide que se actualiza/rendiriza cada frame.
   */
  private mode: 'menu' | 'play' | 'build' = 'menu';
  /** La sesion de juego se monta una sola vez (controles y caja premium). */
  private sessionStarted = false;
  /** Origen del constructor: Esc/"Salir" vuelve al modo del que se entro. */
  private builderCameFrom: 'menu' | 'play' = 'play';
  /** Velo y escena del menú: viven todo el arranque (no se liberan al salir). */
  private entrance: GameEntrance | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.quality = detectDeviceProfile();
    const profile = QUALITY_PROFILES[this.quality];

    this.renderer = new Renderer(profile);
    container.appendChild(this.renderer.canvas);

    this.scene.fog = this.fog;
    this.world = new World(this.scene, this.registry, this.materials);
    this.world.build();
    this.lighting = new LightingSystem(this.scene, this.sky, profile);
    this.scene.add(this.sky.mesh);

    this.particles = new Particles(profile, { x: 40, y: 14, z: 64 }, new THREE.Vector3(0, 0, 0));
    this.scene.add(this.particles.points);

    this.camera = new CameraController(this.aspect());
    // Capa 1 para objetos que se renderizan pero no se seleccionan con el rayo
    // (suelos, cielo, particulas, contorno de seleccion).
    this.camera.camera.layers.enable(1);
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

    this.hud = new Hud(() => this.cycleQuality(), () => this.showMenu());
    this.debug = new DebugPanel();
    this.keyboard = new KeyboardControls(this.renderer.canvas, this.camera, this.inputState, this.interaction, () => void this.audio.unlock());
    this.touch = new TouchControls(this.inputState, this.camera, this.interaction);

    // El Modo Constructor reutiliza escena, camara y renderizador: solo cambia
    // quien controla la camara y que eventos estan activos. Cielo y particulas
    // se mueven a la capa 1 para no ser seleccionables con el rayo.
    this.sky.mesh.layers.set(1);
    this.particles.points.layers.set(1);
    this.builder = new BuilderMode({
      scene: this.scene,
      camera: this.camera.camera,
      container,
      hud: this.hud,
      raycastRoots: () => this.scene.children,
      entries: () => this.builderEntries(),
      onEnter: () => {
        this.builderCameFrom = this.mode === 'menu' ? 'menu' : 'play';
        this.keyboard.setEnabled(false);
        this.touch.setEnabled(false);
      },
      onExit: () => {
        if (this.builderCameFrom === 'menu') {
          this.goMenu();
        } else {
          this.mode = 'play';
          this.keyboard.setEnabled(true);
          this.touch.setEnabled(true);
          this.hud.setMenuMode(this.entrance !== null);
        }
      },
      canDelete: (entry) => this.canDeletePlaced(entry),
      onDelete: (entry) => this.removePlaced(entry),
      groundHeightAt: (x, z) => this.world.surfaceHeightAt(x, z, 0.6)
    });

    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pointerdown', this.onFirstGesture, { once: true });
  }

  start(): void {
    this.hud.mount(this.container);
    this.hud.setQuality(this.quality);
    this.hud.setZone(this.currentZone.name);
    this.debug.mount(this.container);
    this.audio.setZone(this.currentZone);
    this.applyQuality();
    this.resize();
    this.ticker.add(this.update);
    this.ticker.start();
    void this.loadAssets();

    // El menu del grimorio se muestra al arrancar salvo que se pida entrar
    // directo al mundo (util para depurar o demos). El resto del arranque
    // (controles, constructor, premios) se monta en el primer "JUGAR".
    const params = new URLSearchParams(location.search);
    if (params.get('entrada') === '0' || params.has('autostart')) this.startPlay();
    else this.beginEntrance();
  }

  /**
   * Menu principal: el grimorio se reconstruye desde Libro.html sobre el
   * renderer y el bucle del juego (sin crear otro renderer ni rAF) y se
   * mantiene VIVO toda la sesion: al elegir JUGAR/CONSTRUCCION el velo se
   * oculta pero la escena no se libera, de forma que volver al menu no repite
   * la apertura del libro ni reconstruye el mundo.
   */
  private beginEntrance(): void {
    let grimoire: GrimoireScene;
    try {
      grimoire = createGrimoireScene({
        renderer: this.renderer.gl,
        aspect: this.aspect(),
        textureScale: this.quality === 'QUALITY_LOW' ? 0.75 : 1,
        onOpen: () => this.entrance?.onBookOpened()
      });
    } catch (error) {
      console.warn(`Menu del grimorio no disponible: ${error instanceof Error ? error.message : String(error)}`);
      this.startPlay();
      return;
    }
    this.mode = 'menu';
    this.keyboard.setEnabled(false);
    this.entrance = new GameEntrance(this.container, grimoire, (choice) => this.choose(choice), () => {
      this.entrance = null;
    });
    this.entrance.begin();
  }

  /** Eleccion del menu: oculta el velo (ya lo hizo GameEntrance) y conmuta. */
  private choose(choice: MenuChoice): void {
    if (choice === 'build') this.enterBuilderFromMenu();
    else this.startPlay();
  }

  /**
   * Monta una sola vez los controles y la Caja Premium de la sesion. Evita
   * listeners duplicados al alternar menu/juego/constructor.
   */
  private startSession(): void {
    if (this.sessionStarted) return;
    this.sessionStarted = true;
    this.touch.mount(this.container);
    this.builder.mount(this.container);
    this.loadPremiumBox();
  }

  /** Jugar: reanuda el mundo (o lo arranca) y muestra el HUD de juego. */
  private startPlay(): void {
    if (this.mode === 'play') return;
    this.mode = 'play';
    this.startSession();
    this.keyboard.setEnabled(true);
    this.touch.setEnabled(true);
    // El boton "Menu" solo tiene sentido si existe el velo del grimorio.
    this.hud.setMenuMode(this.entrance !== null);
    this.resize();
  }

  /**
   * Entrada directa al constructor desde el menu, sin pasar por el juego:
   * monta la sesion y activa el modo orbital (elige la camara por defecto).
   */
  private enterBuilderFromMenu(): void {
    this.startSession();
    if (!this.builder.active) this.builder.toggle();
    this.mode = 'build';
    this.hud.setMenuMode(false);
  }

  /**
   * Vuelve al menu sin reconstruir el mundo: congela jugador e interacciones,
   * reapaga los controles y re-muestra el velo sobre el grimorio (ya abierto).
   */
  private goMenu(): void {
    if (this.mode === 'menu') return;
    // Sin escena de menu (arranque `?entrada=0`/`?autostart`), no hay a donde ir.
    if (!this.entrance) {
      this.mode = 'play';
      return;
    }
    this.mode = 'menu';
    this.keyboard.setEnabled(false);
    this.touch.setEnabled(false);
    this.hud.setPrompt(null);
    this.hud.setMenuMode(false);
    this.entrance.show();
  }

  /** Boton "Menu" del HUD. Desde el constructor sale primero al modo previo. */
  private showMenu(): void {
    if (!this.entrance) return;
    if (this.builder.active) {
      this.builder.exit();
      return;
    }
    this.goMenu();
  }

  /**
   * Carga progresiva de assets reales (secciones 8, 15 y 21). No bloquea el
   * arranque: las texturas y el HDRI llegan cuando estan listos. Reporta a la
   * pantalla de entrada solo progreso real (x/6 PBR); el HDRI usa estados.
   */
  private async loadAssets(): Promise<void> {
    if (this.entrance) this.entrance.setStatus('Tejiendo la luz del ambiente…');
    try {
      const envFile = await loadEnvironment(this.scene);
      this.envStatus = `HDRI ${envFile}`;
    } catch (error) {
      this.envStatus = `fallo: ${error instanceof Error ? error.message : String(error)}`;
    }

    if (this.entrance) this.entrance.setStatus('Vistiendo la estancia…', 0);
    const report = await applyPbrTextures(this.materials, (done, total) => {
      if (this.entrance) this.entrance.setStatus(`Materiales PBR ${done}/${total}`, done / total);
    });
    this.textureStatus = report.failed.length === 0
      ? `${report.applied.length}/6 PBR`
      : `${report.applied.length}/6 PBR (${report.failed.length} fallos)`;
    if (this.entrance) {
      this.entrance.setStatus('La estancia esta lista', null);
      this.entrance.setReady();
    }
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
    this.entrance?.resize(w, h);
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
    // En el menu, ni el mundo, el jugador ni las interacciones se actualizan:
    // solo el grimorio y su camara, renderizados con el mismo renderer.
    // Al volver al menu no se repite la apertura (la escena sigue viva).
    if (this.mode === 'menu' && this.entrance) {
      this.entrance.update(dt);
      this.renderer.render(this.entrance.scene, this.entrance.camera);
      this.updateDebug();
      return;
    }

    const editing = this.builder.active;

    if (editing) {
      // Modo Constructor: camara libre + seleccion. El jugador queda congelado.
      this.builder.update(dt);
    } else {
      this.keyboard.update();
      this.inputState.applyTo(this.player);
      this.player.yaw = this.camera.yaw;
      this.player.update(dt, this.world.colliders);
      this.camera.update(dt, this.player);

      const zone = zoneAt(this.player.position);
      if (zone.id !== this.currentZone.id) this.enterZone(zone);
      this.fog.density += (this.fogTarget - this.fog.density) * Math.min(1, dt * 1.5);
      this.lighting.ambient.intensity += (zone.ambientLevel * 0.55 - this.lighting.ambient.intensity) * Math.min(1, dt * 1.5);

      this.interaction.update(this.camera.camera);
    }

    this.sky.follow(this.camera.camera);
    this.particles.update(dt, this.camera.camera.position);
    this.hud.setPrompt(editing ? null : (this.interaction.current?.label ?? null));
    this.premiumBox?.update(dt);
    this.audio.update(dt);
    this.hud.update(dt);

    this.streamAccumulator += dt;
    if (this.streamAccumulator > 0.5) {
      this.streamAccumulator = 0;
      this.streaming.update(editing ? this.camera.camera.position : this.player.position);
    }

    this.lodAccumulator += dt;
    if (this.lodAccumulator > 0.25) {
      this.lodAccumulator = 0;
      this.updateLod();
    }

    this.renderer.render(this.scene, this.camera.camera);
    this.updateDebug();
  };

  /**
   * LOD por distancia (seccion 8): las piezas lejanas dejan de proyectar sombra
   * (caro) y se ocultan cuando superan su alcance, aunque sigan en memoria. El
   * streaming ya se encarga de la carga/descarga; esto reduce draw calls.
   */
  private updateLod(): void {
    const cam = this.camera.camera.position;
    for (const object of this.placedModels) {
      const dist = cam.distanceTo(object.position);
      const near = dist < 45;
      const visible = dist < 220;
      if (object.visible !== visible) object.visible = visible;
      object.traverse((node) => {
        if (node instanceof THREE.Mesh && node.castShadow !== near) node.castShadow = near;
      });
    }
  }

  private enterZone(zone: ZoneDef): void {
    this.currentZone = zone;
    this.hud.setZone(zone.name);
    this.audio.setZone(zone);
    this.fogTarget = zone.fogDensity;
    const fragment = this.narrative.next(zone);
    if (fragment) this.hud.showNarrative(fragment.text);
  }

  /** Coloca un recurso cargado en el mundo segun su tabla de colocacion. */
  private placeLoadedAsset(id: string, object: unknown): void {
    if (!(object instanceof THREE.Object3D)) return;
    // El streaming puede reencolar un recurso ya colocado (releaseFar lo marca
    // como placeholder sin retirarlo); evita duplicados descartando la copia.
    if (this.placedModels.some((model) => model.name === id)) {
      this.disposeObject(object);
      return;
    }
    const placement = PLACEMENTS[id];
    this.applyPlacement(id, object, placement);
    if (placement?.label) {
      this.interaction.add({
        object,
        label: placement.label,
        onClick: () => this.hud.showNarrative(placement.label ?? id)
      });
    }
  }

  /**
   * Normaliza, orienta y apoya un modelo. La orientacion se fija ANTES de medir
   * la caja (girar despues de centrar desplazaria el modelo) y los pies se
   * apoyan en la superficie real bajo (x, z), no en un cero fijo.
   */
  private applyPlacement(id: string, object: THREE.Object3D, placement: Placement | undefined): void {
    const [px, py, pz] = placement ? placement.position : [3, 0, -6];
    const target = placement ? placement.targetHeight ?? null : null;

    if (placement?.remove) {
      for (const name of placement.remove) {
        const node = object.getObjectByName(name);
        if (node?.parent) node.parent.remove(node);
      }
    }

    object.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    if (target !== null) {
      const size = new THREE.Vector3();
      new THREE.Box3().setFromObject(object).getSize(size);
      if (size.y > 0.0001) object.scale.multiplyScalar(target / size.y);
    }

    if (placement?.rotationX) object.rotation.x = placement.rotationX;
    if (placement?.rotationY) object.rotation.y = placement.rotationY;
    object.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(object);
    const center = new THREE.Vector3();
    box.getCenter(center);
    object.position.x += px - center.x;
    object.position.z += pz - center.z;
    const radius = Math.min(1.5, Math.max(0.5, (box.max.x - box.min.x) * 0.5));
    const ground = this.world.surfaceHeightAt(px, pz, radius);
    object.position.y += ground + py - box.min.y;

    object.name = id;
    this.scene.add(object);
    this.placedModels.push(object);
  }

  private disposeObject(object: THREE.Object3D): void {
    object.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry.dispose();
        const material = node.material;
        if (Array.isArray(material)) for (const m of material) m.dispose();
        else material.dispose();
      }
    });
  }

  /**
   * El borrado del constructor solo aplica a modelos colocados por el streaming
   * (Caja Premium y estructurales como casco/altar nunca aparecen aquí).
   */
  private canDeletePlaced(entry: BuilderEntry): boolean {
    if (this.premiumBox && entry.object === this.premiumBox.object) return false;
    return this.placedModels.includes(entry.object);
  }

  /** Retira un modelo del mundo y libera solo sus recursos (no compartidos). */
  private removePlaced(entry: BuilderEntry): void {
    if (!this.canDeletePlaced(entry)) return;
    const index = this.placedModels.indexOf(entry.object);
    if (index >= 0) this.placedModels.splice(index, 1);
    this.scene.remove(entry.object);
    this.interaction.remove(entry.object);
    this.disposeObject(entry.object);
  }

  /**
   * Entradas seleccionables del Modo Constructor, en el orden del panel: los
   * modelos colocados por el streaming (cada GLB como una sola entrada, con el
   * nombre de su colocacion) y luego los objetos de la nave registrados por el
   * mundo como grupos (cascara y altar). Esta lista es la MISMA fuente para el
   * rayo de seleccion y para el panel, garantizando que ambos queden
   * sincronizados. Suelos y peana viven en layer 1, así que el rayo nunca los
   * golpea y no entran en estas entradas.
   */
  private builderEntries(): BuilderEntry[] {
    const entries: BuilderEntry[] = [];
    for (const object of this.placedModels) {
      if (!object.parent || !object.visible) continue;
      const placement = PLACEMENTS[object.name];
      entries.push({ object, name: placement?.label ?? (object.name || 'Objeto') });
    }
    for (const selectable of this.world.selectables) {
      if (selectable.object.parent) entries.push({ object: selectable.object, name: selectable.label });
    }
    return entries;
  }

  /**
   * La Caja Premium se carga aparte del streaming: pesa mas que el presupuesto
   * movil y es una pieza unica con animacion e interaccion propias.
   */
  private loadPremiumBox(): void {
    const id = 'props.mystery_box_premium';
    const url = 'assets/props/mystery_box_premium.glb';
    this.gltf.load(
      url,
      (gltf) => {
        // Se coloca ANTES de montar el contenido: asi la caja se mide sin el
        // soporte de recompensa (halo/luz) que inflaria su caja envolvente.
        this.applyPlacement(id, gltf.scene, PLACEMENTS[id]);
        try {
          const box = new PremiumBox(gltf.scene, gltf.animations, this.camera.camera);
          this.premiumBox = box;
          const item: Interactable = {
            object: box.object,
            label: box.promptLabel(),
            onClick: () => box.toggle()
          };
          box.onPrompt = (label) => {
            item.label = label;
            if (this.interaction.current === item) this.hud.setPrompt(label);
          };
          this.interaction.add(item);
        } catch (error) {
          const index = this.placedModels.indexOf(gltf.scene);
          if (index >= 0) this.placedModels.splice(index, 1);
          this.scene.remove(gltf.scene);
          this.disposeObject(gltf.scene);
          console.warn(`Caja Premium no disponible: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
      undefined,
      (error) => console.warn(`No se pudo cargar la Caja Premium: ${error instanceof Error ? error.message : String(error)}`)
    );
  }

  private updateDebug(): void {
    const stats = this.debugStats();
    this.debug.update(stats);
  }

  private debugStats() {
    const p = this.player.position;
    const audio = `int ${this.audio.level('interior').toFixed(2)} ext ${this.audio.level('windExterior').toFixed(2)} · ${this.audio.sampleCount} mues`;
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
      quality: this.quality.replace('QUALITY_', '').toLowerCase(),
      textureMapStatus: this.textureStatus,
      envStatus: this.envStatus
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
    this.builder.dispose();
    this.entrance?.dispose();
    this.entrance = null;
    this.premiumBox?.dispose();
    this.premiumBox = null;
    this.particles.dispose();
    this.lighting.dispose();
    this.sky.dispose();
    this.world.dispose();
    this.audio.dispose();
    disposeMaterialSet(this.materials);
    this.renderer.dispose();
    this.scene.clear();
  }
}
