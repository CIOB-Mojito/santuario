import * as THREE from 'three';
import type { QualityProfile } from '../config/quality';

/**
 * Envuelve WebGLRenderer. No conoce el mundo ni la camara: solo recibe ambos.
 * Documenta una limitacion real: el antialias se fija al crear el contexto y
 * no puede cambiarse en caliente; el resto del perfil si se aplica en vivo.
 */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;

  constructor(profile: QualityProfile) {
    this.gl = new THREE.WebGLRenderer({
      antialias: profile.antialias,
      powerPreference: 'high-performance',
      stencil: false
    });
    this.canvas = this.gl.domElement;
    this.gl.setClearColor(0x0a0e14, 1);
    this.applyProfile(profile);
  }

  applyProfile(profile: QualityProfile): void {
    const dpr = Math.min(window.devicePixelRatio || 1, profile.pixelRatioCap);
    this.gl.setPixelRatio(dpr);
    this.gl.shadowMap.enabled = profile.shadows;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  setSize(width: number, height: number): void {
    this.gl.setSize(width, height, false);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.gl.render(scene, camera);
  }

  get drawCalls(): number {
    return this.gl.info.render.calls;
  }

  get triangles(): number {
    return this.gl.info.render.triangles;
  }

  get geometries(): number {
    return this.gl.info.memory.geometries;
  }

  get textures(): number {
    return this.gl.info.memory.textures;
  }

  get programs(): number {
    return this.gl.info.programs?.length ?? 0;
  }

  get pixelRatio(): number {
    return this.gl.getPixelRatio();
  }

  dispose(): void {
    this.gl.dispose();
  }
}
