import * as THREE from 'three';
import type { QualityProfile } from '../config/quality';
import { Lighting } from './Lighting';
import {
  MAT,
  buildAltar,
  buildAngel,
  buildCandleMesh,
  buildColumn,
  buildDoor,
  buildFlameMesh,
  buildRelic,
  buildTower,
  disposeObject
} from './placeholders';

export interface ZoneInfo {
  readonly id: string;
  readonly label: string;
  readonly center: THREE.Vector3;
  readonly radius: number;
}

/**
 * Primera escena del santuario: placeholders deliberadamente simples pero con
 * escala, posicion y zonas reales. El mundo NO decide calidad ni camara: solo
 * construye y mantiene el contenido.
 */
export class World {
  readonly scene = new THREE.Scene();
  readonly zones: ZoneInfo[] = [];
  readonly fog: THREE.Fog;

  private readonly lighting: Lighting;
  private readonly flames: { mesh: THREE.Mesh; material: THREE.MeshStandardMaterial; phase: number }[] = [];
  private time = 0;

  constructor(profile: QualityProfile) {
    this.scene.background = new THREE.Color(0x0a0e14);
    this.fog = new THREE.Fog(0x0a0e14, profile.fogNear, profile.fogFar);
    this.scene.fog = this.fog;

    this.lighting = new Lighting(this.scene, profile);
    this.build();
  }

  private build(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.buildNave();
    this.buildChapel();
    this.buildTower();
  }

  private buildNave(): void {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(22, 0.5, 44), MAT.stoneDark);
    floor.position.set(0, -0.25, -4);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Dos filas de columnas.
    for (let i = 0; i < 5; i++) {
      const z = 14 - i * 7;
      for (const x of [-7, 7]) {
        const col = buildColumn(7, 0.6);
        col.position.set(x, 0, z);
        col.castShadow = true;
        this.scene.add(col);
      }
    }

    // Muros laterales (segmentados para sugerir ventanas).
    for (const x of [-11, 11]) {
      for (let i = 0; i < 6; i++) {
        const z = 16 - i * 7;
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, 5), MAT.stone);
        seg.position.set(x, 4.5, z);
        seg.castShadow = true;
        seg.receiveShadow = true;
        this.scene.add(seg);
      }
    }

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(23, 12, 1), MAT.stone);
    backWall.position.set(0, 6, -26);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    // Plataforma y altar.
    const platform = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 8), MAT.stoneDark);
    platform.position.set(0, 0.1, -20);
    platform.receiveShadow = true;
    this.scene.add(platform);

    const altar = buildAltar();
    altar.position.set(0, 0.7, -20);
    altar.traverse((o) => {
      (o as THREE.Mesh).castShadow = true;
    });
    this.scene.add(altar);

    const relic = buildRelic();
    relic.position.set(0, 2.2, -20);
    this.scene.add(relic);

    // Angel funerario placeholder.
    const angel = buildAngel();
    angel.position.set(-4.5, 0, 4);
    angel.rotation.y = 0.4;
    angel.traverse((o) => {
      (o as THREE.Mesh).castShadow = true;
    });
    this.scene.add(angel);

    // Puerta placeholder en el muro oeste.
    const door = buildDoor();
    door.position.set(-10.6, 0, 6);
    door.rotation.y = Math.PI / 2;
    this.scene.add(door);

    // Velas cerca del altar.
    for (let i = 0; i < 8; i++) {
      const x = -3 + (i % 4) * 2;
      const z = -17.5 - Math.floor(i / 4) * 1.5;
      this.addCandle(x, 1.2, z);
    }
    for (let i = 0; i < 10; i++) {
      this.addCandle(-9.5 + i * 2.1, 0, -24.2);
    }

    this.zones.push(
      { id: 'nave', label: 'Nave central', center: new THREE.Vector3(0, 3, -4), radius: 26 },
      { id: 'altar', label: 'Altar mayor', center: new THREE.Vector3(0, 3, -20), radius: 12 }
    );
  }

  private buildChapel(): void {
    const base = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 12), MAT.stoneDark);
    base.position.set(-26, -0.25, 6);
    base.receiveShadow = true;
    this.scene.add(base);

    for (const [dx, dz] of [
      [-5.5, -5.5],
      [5.5, -5.5]
    ]) {
      const col = buildColumn(5, 0.45);
      col.position.set(-26 + dx, 0, 6 + dz);
      col.castShadow = true;
      this.scene.add(col);
    }

    const altar = buildAltar();
    altar.position.set(-26, 0.4, 6);
    altar.scale.setScalar(0.7);
    this.scene.add(altar);

    const angel = buildAngel();
    angel.position.set(-26, 0, 10);
    angel.scale.setScalar(0.85);
    angel.rotation.y = Math.PI;
    this.scene.add(angel);

    this.zones.push({ id: 'capilla_norte', label: 'Capilla norte', center: new THREE.Vector3(-26, 2, 6), radius: 10 });
  }

  private buildTower(): void {
    const tower = buildTower(26);
    tower.position.set(24, -0.5, -14);
    tower.traverse((o) => {
      (o as THREE.Mesh).castShadow = true;
    });
    this.scene.add(tower);
    this.zones.push({ id: 'torre', label: 'Torre', center: new THREE.Vector3(24, 12, -14), radius: 14 });
  }

  private addCandle(x: number, y: number, z: number): void {
    const candle = buildCandleMesh();
    candle.position.set(x, y, z);
    this.scene.add(candle);

    const flame = buildFlameMesh();
    flame.position.set(x, y, z);
    const material = flame.material as THREE.MeshStandardMaterial;
    this.scene.add(flame);
    this.flames.push({ mesh: flame, material, phase: Math.random() * Math.PI * 2 });
  }

  update(dt: number): void {
    this.time += dt;
    for (const f of this.flames) {
      const n = Math.sin(this.time * 11 + f.phase) * 0.5 + Math.sin(this.time * 23 + f.phase * 1.7) * 0.5;
      f.material.emissiveIntensity = 1.3 + n * 0.35;
      f.mesh.scale.set(1, 1 + n * 0.08, 1);
    }
    this.lighting.update(this.time);
  }

  setQuality(profile: QualityProfile): void {
    this.fog.near = profile.fogNear;
    this.fog.far = profile.fogFar;
    this.lighting.applyProfile(profile);
  }

  dispose(): void {
    this.lighting.dispose();
    disposeObject(this.scene);
    this.scene.clear();
    this.flames.length = 0;
  }
}
