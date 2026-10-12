import * as THREE from 'three';
import type { QualityProfile } from '../config/quality';
import type { Sky } from './Sky';

/**
 * Iluminacion atmosferica (secciones 4 y 9). El sol direccional comparte la
 * direccion con el cielo para que sombras y cielo cuenten la misma historia.
 * La luz de interior (velas) se anade mas adelante, por zona.
 */
export class LightingSystem {
  readonly sun: THREE.DirectionalLight;
  readonly ambient: THREE.HemisphereLight;
  private readonly sunTarget = new THREE.Object3D();

  constructor(scene: THREE.Scene, sky: Sky, profile: QualityProfile) {
    this.ambient = new THREE.HemisphereLight(0xbfd8ff, 0x6b5a3e, 0.55);
    scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xfff0d0, 2.1);
    this.sun.position.copy(sky.sunDirection).multiplyScalar(120);
    this.sun.target = this.sunTarget;
    scene.add(this.sun);
    scene.add(this.sunTarget);

    this.applyProfile(profile);
  }

  applyProfile(profile: QualityProfile): void {
    const cast = profile.shadows;
    this.sun.castShadow = cast;
    if (!cast) return;

    this.sun.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
    const cam = this.sun.shadow.camera;
    cam.near = 1;
    cam.far = 220;
    cam.left = -60;
    cam.right = 60;
    cam.top = 60;
    cam.bottom = -60;
    cam.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
  }

  dispose(): void {
    this.ambient.dispose();
    this.sun.dispose();
  }
}
