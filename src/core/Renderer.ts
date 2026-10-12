import * as THREE from 'three';
import type { QualityProfile } from '../config/quality';

/**
 * Envuelve WebGLRenderer. El renderer no conoce nada del mundo: solo recibe
 * escena y camara. El cambio de antialias requiere recrear, por eso applyProfile
 * lo documenta en vez de mentir cambiandolo en caliente.
 */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;

  constructor(profile: QualityProfile) {
    this.gl = new THREE.WebGLRenderer({
      antialias: profile.antialias,
      powerPreference: 'high-performance',
      stencil: false
    });
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

  get programs(): number {
    return this.gl.info.programs?.length ?? 0;
  }

  get geometries(): number {
    return this.gl.info.memory.geometries;
  }

  get textures(): number {
    return this.gl.info.memory.textures;
  }

  dispose(): void {
    this.gl.dispose();
  }
}
