import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { REWARDS, type Reward } from './rewards';

/**
 * Caja Premium. Reutiliza la animacion que trae el propio GLB
 * (`Flap_Open_Close`, 5.4 s) con las cuatro compuertas reales
 * (Flap_Front/Back/Left/Right): un AnimationMixer reproduce el clip y se
 * reposiciona por fases (abrir 0 -> 0.45, cerrar viaja hasta 0) en lugar de
 * inventar el movimiento.
 *
 * Al abrir revela la siguiente recompensa de `REWARDS` con una secuencia de
 * tres tiempos heredada del visor (sube desde el hueco -> se acerca a la camara
 * -> flota); al cerrar hace el camino inverso. Los modelos se cargan de forma
 * diferida y se guardan en una cache acotada.
 */

const FLAPS = ['Flap_Front', 'Flap_Back', 'Flap_Left', 'Flap_Right'] as const;
const CYCLE = 5.4;
const HOLD_OPEN = 0.45;
const TRAVEL_SPEED = 1 / 3.4;

const CACHE_MAX = 3;
const OPEN_DELAY = 1100;
const RISE_MS = 1000;
const RISE_BOOST = 0.3;
const APPROACH_FRAC = 0.2;
const APPROACH_MS = 850;
const DISPLAY_SCALE = 1.12;
const CURVE = 0.14;
const ARC_LIFT = 0.1;
const FLOAT_AMP = 0.1;
const FLOAT_MS = 4200;
const PAUSE_MS = 800;
const RETREAT_MS = 300;
const SINK_MS = 600;

const WALL_THICKNESS = 0.003;
const UP = new THREE.Vector3(0, 1, 0);

type ContentPhase = 'hidden' | 'prep' | 'rising' | 'approach' | 'present' | 'retreat' | 'sinking';

interface Cavity {
  cx: number;
  cz: number;
  cavW: number;
  cavD: number;
  cavH: number;
  openingY: number;
  floorTop: number;
}

interface PreparedReward {
  root: THREE.Object3D;
  scale0: number;
  contentH: number;
  insideY: number;
  showY: number;
}

interface ContentState {
  root: THREE.Object3D | null;
  cavity: Cavity | null;
  phase: ContentPhase;
  active: boolean;
  failed: boolean;
  pendingToken: number;
  t0: number;
  t1: number;
  fromY: number;
  toY: number;
  scale0: number;
  contentH: number;
  insideY: number;
  showY: number;
  fromScale: number;
  floatAmp: number;
  floatTick: number;
  pStart: THREE.Vector3;
  pCtrl: THREE.Vector3;
  pEnd: THREE.Vector3;
  floatBase: THREE.Vector3;
  floatPerp: THREE.Vector3;
  retreatFrom: THREE.Vector3;
  retreatCtrl: THREE.Vector3;
  retreatTo: THREE.Vector3;
}

function easeOutCubic(u: number): number {
  return 1 - Math.pow(1 - u, 3);
}

function easeInOutCubic(u: number): number {
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

function quadBezier(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  const m = 1 - t;
  return out
    .set(0, 0, 0)
    .addScaledVector(p0, m * m)
    .addScaledVector(p1, 2 * m * t)
    .addScaledVector(p2, t * t);
}

export class PremiumBox {
  readonly object: THREE.Object3D;
  onPrompt?: (label: string) => void;

  private readonly root: THREE.Object3D;
  private readonly clip: THREE.AnimationClip;
  private readonly camera: THREE.Camera;
  private readonly mixer: THREE.AnimationMixer;
  private readonly loader = new GLTFLoader();
  private readonly holder = new THREE.Group();
  private readonly light: THREE.PointLight;
  private readonly halo: THREE.Sprite;
  private readonly cache = new Map<string, PreparedReward>();
  private readonly content: ContentState;

  private seqIndex = 0;
  private now = 0;
  private phase = 0;
  private openState = false;
  private animating = false;

  /**
   * @param root escena cargada del GLB `mystery_box-premium.glb` (sin colocar).
   * @param animations clips del GLB; debe traer `Flap_Open_Close`.
   * @param camera camara del jugador, usada para orientar el acercamiento.
   */
  constructor(root: THREE.Object3D, animations: readonly THREE.AnimationClip[], camera: THREE.Camera) {
    const missing = FLAPS.filter((name) => !root.getObjectByName(name));
    if (missing.length > 0) {
      throw new Error(`PremiumBox: faltan compuertas ${missing.join(', ')}`);
    }
    const clip = animations.find((a) => a.tracks.some((track) => /Flap_/.test(track.name)));
    if (!clip || clip.tracks.length === 0) {
      throw new Error('PremiumBox: el GLB no trae el clip Flap_Open_Close');
    }

    this.root = root;
    this.object = root;
    this.camera = camera;
    this.clip = clip;
    this.mixer = new THREE.AnimationMixer(root);
    const action = this.mixer.clipAction(clip);
    action.play();
    this.mixer.setTime(0);

    this.holder.name = 'BoxContentHolder';
    this.holder.visible = false;
    root.add(this.holder);

    this.light = new THREE.PointLight(0xffd9a0, 0, 1.6, 2);
    this.light.name = 'BoxContentGlow';
    this.light.visible = false;
    this.holder.add(this.light);

    this.halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: PremiumBox.makeGlowTexture(),
        color: 0xffcf7f,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    this.halo.name = 'BoxContentHalo';
    this.halo.scale.set(0.42, 0.42, 1);
    this.holder.add(this.halo);

    const cavity = this.cavityMetrics(root);
    this.content = {
      root: null,
      cavity,
      phase: 'hidden',
      active: false,
      failed: false,
      pendingToken: 0,
      t0: 0,
      t1: 0,
      fromY: 0,
      toY: 0,
      scale0: 1,
      contentH: 0,
      insideY: 0,
      showY: 0,
      fromScale: 1,
      floatAmp: 0,
      floatTick: 0,
      pStart: new THREE.Vector3(),
      pCtrl: new THREE.Vector3(),
      pEnd: new THREE.Vector3(),
      floatBase: new THREE.Vector3(),
      floatPerp: new THREE.Vector3(),
      retreatFrom: new THREE.Vector3(),
      retreatCtrl: new THREE.Vector3(),
      retreatTo: new THREE.Vector3()
    };
    if (cavity) this.holder.position.set(cavity.cx, cavity.floorTop, cavity.cz);
  }

  get isOpen(): boolean {
    return this.openState;
  }

  get busy(): boolean {
    return this.animating || this.content.active;
  }

  promptLabel(): string {
    return this.openState ? 'Cerrar la Caja Premium' : 'Abrir la Caja Premium';
  }

  toggle(): void {
    if (this.animating) return;
    this.openState = !this.openState;
    this.animating = true;
    const c = this.content;
    if (this.openState) {
      c.phase = 'prep';
      c.t0 = this.now + OPEN_DELAY;
      c.failed = false;
      c.active = true;
      this.requestReward();
    } else {
      c.pendingToken++;
      c.failed = false;
      this.holder.visible = true;
      this.beginRetreat();
      c.active = true;
    }
    this.onPrompt?.(this.promptLabel());
  }

  update(dt: number): void {
    this.now += dt * 1000;
    this.root.updateWorldMatrix(true, false);

    let phaseReached = false;
    if (this.animating) {
      const step = Math.min(dt, 0.05) * TRAVEL_SPEED;
      const target = this.openState ? HOLD_OPEN : 0;
      const forward = target >= this.phase ? target - this.phase : 1 - this.phase + target;
      phaseReached = forward < 1e-6 || step >= forward;
      this.phase = phaseReached ? target : (this.phase + step) % 1;
      this.mixer.setTime(this.phase * (this.clip.duration || CYCLE));
    }

    const motionDone = this.updateContent();
    if (this.animating && phaseReached && motionDone) {
      this.animating = false;
      this.onPrompt?.(this.promptLabel());
    }
  }

  dispose(): void {
    this.content.pendingToken++;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    for (const entry of this.cache.values()) this.disposeObject(entry.root);
    this.cache.clear();
    if (this.content.root) this.disposeObject(this.content.root);
    this.content.root = null;
    this.halo.material.map?.dispose();
    this.halo.material.dispose();
    this.light.dispose();
    if (this.root.parent) this.root.parent.remove(this.root);
  }

  /* ---------------------------- content loading ---------------------------- */

  private requestReward(): void {
    const c = this.content;
    if (!c.cavity) {
      c.failed = true;
      return;
    }
    c.failed = false;
    c.pendingToken++;
    const token = c.pendingToken;
    let attempts = 0;

    const tryOnce = (): void => {
      if (c.pendingToken !== token || !this.openState) return;
      if (attempts >= REWARDS.length) {
        c.failed = true;
        return;
      }
      attempts++;
      const reward = this.nextReward();
      const cached = this.cache.get(reward.id);
      if (cached) {
        this.applyReward(cached);
        return;
      }
      this.loader.load(
        reward.url,
        (gltf) => {
          if (c.pendingToken !== token) {
            this.disposeObject(gltf.scene);
            return;
          }
          const prepared = this.prepareReward(gltf.scene);
          if (!prepared) {
            this.disposeObject(gltf.scene);
            tryOnce();
            return;
          }
          this.cache.set(reward.id, prepared);
          this.evictCache();
          this.applyReward(prepared);
        },
        undefined,
        () => tryOnce()
      );
    };
    tryOnce();
  }

  private nextReward(): Reward {
    const reward = REWARDS[this.seqIndex % REWARDS.length];
    this.seqIndex = (this.seqIndex + 1) % REWARDS.length;
    return reward;
  }

  private evictCache(): void {
    while (this.cache.size > CACHE_MAX) {
      let removed = false;
      for (const [key, entry] of this.cache) {
        if (this.content.root === entry.root) continue;
        this.disposeObject(entry.root);
        this.cache.delete(key);
        removed = true;
        break;
      }
      if (!removed) break;
    }
  }

  private prepareReward(root: THREE.Object3D): PreparedReward | null {
    const cavity = this.content.cavity;
    if (!cavity) return null;
    root.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    this.centerAtOrigin(root);
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
    if (size.x < 1e-6 || size.y < 1e-6 || size.z < 1e-6) return null;
    const scale = Math.min(cavity.cavW / size.x, cavity.cavD / size.z, cavity.cavH / size.y);
    root.scale.setScalar(scale);
    this.centerAtOrigin(root);
    const contentH = size.y * scale;
    const insideY = cavity.floorTop + contentH / 2 + 0.002;
    const baseShowY = cavity.openingY + contentH / 2 + Math.max(0.03, cavity.cavH * 0.25);
    return { root, scale0: scale, contentH, insideY, showY: baseShowY + RISE_BOOST * (baseShowY - insideY) };
  }

  private applyReward(entry: PreparedReward): void {
    const c = this.content;
    if (c.root && c.root !== entry.root && c.root.parent) c.root.parent.remove(c.root);
    c.root = entry.root;
    c.scale0 = entry.scale0;
    c.contentH = entry.contentH;
    c.insideY = entry.insideY;
    c.showY = entry.showY;
    entry.root.scale.setScalar(entry.scale0);
    this.holder.add(entry.root);
    this.holder.position.set(c.cavity?.cx ?? 0, entry.insideY, c.cavity?.cz ?? 0);
    this.holder.visible = false;
    c.failed = false;
  }

  /* --------------------------- content choreography ------------------------ */

  private updateContent(): boolean {
    const c = this.content;
    const cavity = c.cavity;
    if (!cavity) return true;
    const clamp01 = (): number => (c.t1 > c.t0 ? Math.max(0, Math.min(1, (this.now - c.t0) / (c.t1 - c.t0))) : 1);

    if (c.phase === 'prep') {
      c.active = true;
      if (c.failed && !c.root) {
        c.phase = 'hidden';
        c.active = false;
        return true;
      }
      if (!c.root) return false;
      if (this.now < c.t0) return false;
      c.phase = 'rising';
      c.t0 = this.now;
      c.t1 = this.now + RISE_MS;
      c.fromY = c.insideY;
      c.toY = c.showY;
      this.holder.visible = true;
    }
    if (c.phase === 'rising') {
      c.active = true;
      const u = clamp01();
      const e = easeOutCubic(u);
      this.holder.position.set(cavity.cx, c.fromY + (c.toY - c.fromY) * e, cavity.cz);
      if (c.root) c.root.scale.setScalar(c.scale0 * (1 + 0.12 * Math.sin(Math.PI * u)));
      this.setGlow(0.5 * Math.sin(Math.PI * u));
      if (u >= 1) {
        this.holder.position.set(cavity.cx, c.showY, cavity.cz);
        if (c.root) c.root.scale.setScalar(c.scale0);
        this.beginApproach();
      }
      return false;
    }
    if (c.phase === 'approach') {
      c.active = true;
      const u = clamp01();
      const e = easeInOutCubic(u);
      quadBezier(c.pStart, c.pCtrl, c.pEnd, e, this.holder.position);
      if (c.root) c.root.scale.setScalar(c.scale0 * (1 + (DISPLAY_SCALE - 1) * e));
      this.setGlow(0.28 * (1 - u));
      if (u >= 1) this.enterPresent();
      return false;
    }
    if (c.phase === 'present') {
      c.floatTick = (c.floatTick + 1) % 2;
      if (c.floatTick !== 0) {
        c.active = false;
        return true;
      }
      const t = (this.now - c.t0) / FLOAT_MS;
      this.holder.position
        .copy(c.floatBase)
        .addScaledVector(UP, c.floatAmp * Math.sin(t * Math.PI * 2))
        .addScaledVector(c.floatPerp, c.floatAmp * 0.5 * Math.cos(t * Math.PI * 2));
      this.setGlow(0.2 * Math.max(0, 1 - (this.now - c.t0) / PAUSE_MS));
      c.active = true;
      return true;
    }
    if (c.phase === 'retreat') {
      c.active = true;
      const u = clamp01();
      const e = easeInOutCubic(u);
      quadBezier(c.retreatFrom, c.retreatCtrl, c.retreatTo, e, this.holder.position);
      if (c.root) c.root.scale.setScalar(c.scale0 * (c.fromScale + (1 - c.fromScale) * e));
      this.setGlow(0.12 * (1 - u));
      if (u >= 1) {
        this.holder.position.set(cavity.cx, c.showY, cavity.cz);
        c.phase = 'sinking';
        c.t0 = this.now;
        c.t1 = this.now + SINK_MS;
        c.fromY = c.showY;
        c.toY = c.insideY;
      }
      return false;
    }
    if (c.phase === 'sinking') {
      c.active = true;
      const u = clamp01();
      const e = easeOutCubic(u);
      this.holder.position.set(cavity.cx, c.fromY + (c.toY - c.fromY) * e, cavity.cz);
      if (c.root) c.root.scale.setScalar(c.scale0 * (1 - 0.05 * u));
      this.setGlow(0.08 * (1 - u));
      if (u >= 1) {
        this.holder.visible = false;
        this.holder.position.set(cavity.cx, c.insideY, cavity.cz);
        c.phase = 'hidden';
        c.active = false;
        this.setGlow(0);
        return true;
      }
      return false;
    }
    this.holder.visible = false;
    if (c.root) c.root.scale.setScalar(c.scale0);
    this.holder.position.set(cavity.cx, c.insideY, cavity.cz);
    this.setGlow(0);
    c.active = false;
    return true;
  }

  private beginApproach(): void {
    const c = this.content;
    const cavity = c.cavity;
    if (!cavity) return;
    this.root.updateWorldMatrix(true, false);
    const startWorld = this.root.localToWorld(new THREE.Vector3(cavity.cx, c.showY, cavity.cz));
    c.pStart.set(cavity.cx, c.showY, cavity.cz);
    const toCamera = this.camera.position.clone().sub(startWorld);
    const dist = toCamera.length();
    if (dist > 1e-4) {
      toCamera.multiplyScalar(1 / dist);
      const endWorld = startWorld.clone().addScaledVector(toCamera, dist * APPROACH_FRAC);
      if (endWorld.y < startWorld.y) endWorld.y = startWorld.y;
      c.pEnd.copy(this.root.worldToLocal(endWorld));
    } else {
      c.pEnd.copy(c.pStart);
    }
    const dir = c.pEnd.clone().sub(c.pStart);
    const len = Math.max(dir.length(), 1e-6);
    const perp = new THREE.Vector3().crossVectors(dir, UP);
    if (perp.lengthSq() < 1e-8) perp.set(1, 0, 0);
    perp.normalize();
    c.pCtrl
      .copy(c.pStart)
      .addScaledVector(dir, 0.5)
      .addScaledVector(perp, len * CURVE)
      .addScaledVector(UP, len * ARC_LIFT);
    c.phase = 'approach';
    c.t0 = this.now;
    c.t1 = this.now + APPROACH_MS;
  }

  private enterPresent(): void {
    const c = this.content;
    c.phase = 'present';
    c.t0 = this.now;
    c.floatBase.copy(c.pEnd);
    const perp = new THREE.Vector3().crossVectors(c.pEnd.clone().sub(c.pStart), UP);
    if (perp.lengthSq() < 1e-8) perp.set(1, 0, 0);
    c.floatPerp.copy(perp.normalize());
    c.floatAmp = c.contentH * FLOAT_AMP;
    c.floatTick = 0;
    if (c.root) c.root.scale.setScalar(c.scale0 * DISPLAY_SCALE);
  }

  private beginRetreat(): void {
    const c = this.content;
    const cavity = c.cavity;
    if (!cavity) return;
    c.retreatFrom.copy(this.holder.position);
    c.retreatTo.set(cavity.cx, c.showY, cavity.cz);
    const dir = c.retreatTo.clone().sub(c.retreatFrom);
    const len = Math.max(dir.length(), 1e-6);
    c.retreatCtrl
      .copy(c.retreatFrom)
      .addScaledVector(dir, 0.5)
      .addScaledVector(UP, len * ARC_LIFT);
    c.phase = 'retreat';
    c.t0 = this.now;
    c.t1 = this.now + RETREAT_MS;
    if (c.root) {
      const cur = c.root.scale.x / c.scale0;
      c.fromScale = Number.isFinite(cur) ? cur : 1;
    }
  }

  private setGlow(value: number): void {
    const on = value > 0.01;
    this.light.visible = on;
    if (on) this.light.intensity = value * 0.45;
    this.halo.visible = value > 0.02;
    if (this.halo.visible) this.halo.material.opacity = Math.min(1, value * 0.75);
  }

  /* ------------------------------- geometry -------------------------------- */

  private cavityMetrics(root: THREE.Object3D): Cavity | null {
    const b = this.meshBoxInRoot(root, 'Box_Base');
    if (!b) return null;
    const openingY = b.max.y;
    const floorTop = b.min.y + WALL_THICKNESS;
    return {
      cx: (b.min.x + b.max.x) / 2,
      cz: (b.min.z + b.max.z) / 2,
      cavW: b.size.x * 0.88,
      cavD: b.size.z * 0.88,
      cavH: (openingY - floorTop) * 0.85,
      openingY,
      floorTop
    };
  }

  /** Caja AABB de un nodo expresada en el sistema local de `root`. */
  private meshBoxInRoot(root: THREE.Object3D, name: string): { min: THREE.Vector3; max: THREE.Vector3; size: THREE.Vector3 } | null {
    const node = root.getObjectByName(name);
    if (!node) return null;
    root.updateWorldMatrix(true, true);
    const world = new THREE.Box3().setFromObject(node);
    const v = new THREE.Vector3();
    const box = new THREE.Box3();
    for (const x of [world.min.x, world.max.x]) {
      for (const y of [world.min.y, world.max.y]) {
        for (const z of [world.min.z, world.max.z]) {
          box.expandByPoint(root.worldToLocal(v.set(x, y, z)));
        }
      }
    }
    return { min: box.min, max: box.max, size: box.getSize(new THREE.Vector3()) };
  }

  private centerAtOrigin(root: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(root);
    root.position.sub(box.getCenter(new THREE.Vector3()));
  }

  private disposeObject(root: THREE.Object3D): void {
    if (root.parent) root.parent.remove(root);
    root.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry.dispose();
        const material = node.material;
        if (Array.isArray(material)) for (const m of material) m.dispose();
        else material.dispose();
      }
    });
  }

  private static makeGlowTexture(): THREE.Texture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.35, 'rgba(255,220,150,0.55)');
      gradient.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}
