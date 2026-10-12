import * as THREE from 'three';
import type { QualityProfile } from '../config/quality';

/**
 * Motas de polvo suspendidas en la luz (seccion 4 y 29). Es un efecto barato
 * (un solo BufferGeometry + PointsMaterial) pero cumple una funcion de arte:
 * hacer visible el aire del interior. La cantidad depende del perfil.
 */
export class Particles {
  readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly speeds: Float32Array;
  private readonly geometry: THREE.BufferGeometry;
  private count: number;

  constructor(profile: QualityProfile, volume: { x: number; y: number; z: number }, origin = new THREE.Vector3(0, 6, -8)) {
    this.count = profile.particleCount;
    this.positions = new Float32Array(this.count * 3);
    this.speeds = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      this.positions[i * 3] = origin.x + (Math.random() - 0.5) * volume.x;
      this.positions[i * 3 + 1] = Math.random() * volume.y;
      this.positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * volume.z;
      this.speeds[i] = 0.1 + Math.random() * 0.25;
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xffe6b8,
      size: 0.045,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false
    });
    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
  }

  setProfile(profile: QualityProfile): void {
    this.count = Math.min(this.count, profile.particleCount);
    this.geometry.setDrawRange(0, this.count);
  }

  update(dt: number, origin: THREE.Vector3): void {
    const top = origin.y + 14;
    for (let i = 0; i < this.count; i++) {
      const iy = i * 3 + 1;
      this.positions[iy] += this.speeds[i] * dt;
      this.positions[i * 3] += Math.sin(origin.x + i) * dt * 0.05;
      if (this.positions[iy] > top) this.positions[iy] = 0;
    }
    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
