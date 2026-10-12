import * as THREE from 'three';
import type { QualityProfile } from '../config/quality';

/**
 * Iluminacion placeholder: un sol frio que entra de costado (simula vitrales),
 * un relleno de cielo y una luz calida de altar. Nada de iluminacion dinamica
 * pesada; en fases posteriores se sumara baked + emissive + dynamic combinado.
 */
export class Lighting {
  readonly hemi: THREE.HemisphereLight;
  readonly sun: THREE.DirectionalLight;
  readonly altar: THREE.PointLight;

  private readonly scene: THREE.Scene;

  constructor(scene: THREE.Scene, profile: QualityProfile) {
    this.scene = scene;

    this.hemi = new THREE.HemisphereLight(0x9fb8d6, 0x241a12, 0.55);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xcfe0ff, 1.1);
    this.sun.position.set(-14, 22, 10);
    scene.add(this.sun);

    this.altar = new THREE.PointLight(0xffa64d, 2.2, 26, 2);
    this.altar.position.set(0, 4, -14);
    scene.add(this.altar);

    scene.add(new THREE.AmbientLight(0x2a2f3a, 0.6));

    this.applyProfile(profile);
  }

  applyProfile(profile: QualityProfile): void {
    if (profile.shadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
      this.sun.shadow.camera.near = 1;
      this.sun.shadow.camera.far = 90;
      const d = 30;
      this.sun.shadow.camera.left = -d;
      this.sun.shadow.camera.right = d;
      this.sun.shadow.camera.top = d;
      this.sun.shadow.camera.bottom = -d;
      this.sun.shadow.bias = -0.0006;
    } else {
      this.sun.castShadow = false;
    }
  }

  /** Parpadeo suave de la luz de altar. */
  update(elapsed: number): void {
    this.altar.intensity = 2.0 + Math.sin(elapsed * 6.1) * 0.25 + Math.sin(elapsed * 13.7) * 0.12;
  }

  dispose(): void {
    this.scene.remove(this.hemi, this.sun, this.altar);
    this.sun.shadow.map?.dispose();
  }
}
