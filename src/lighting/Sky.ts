import * as THREE from 'three';

/**
 * Cielo procedural (seccion 4). Direccion artistica: exterior luminoso tipo
 * verano, horizonte calido y cenit azul limpio, con un sol bajo que marca la
 * direccion de toda la iluminacion. No es una textura generica: el shader
 * mezcla cenit, horizonte y disco solar segun la direccion de vision.
 */
export class Sky {
  readonly mesh: THREE.Mesh;
  readonly sunDirection = new THREE.Vector3(-0.45, 0.28, -0.55).normalize();
  private readonly material: THREE.ShaderMaterial;

  constructor(radius = 460) {
    const geometry = new THREE.SphereGeometry(radius, 32, 16);
    this.material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        zenithColor: { value: new THREE.Color(0x2f74c0) },
        horizonColor: { value: new THREE.Color(0xffe2b8) },
        groundColor: { value: new THREE.Color(0xc9a877) },
        sunColor: { value: new THREE.Color(0xfff4d6) },
        sunDirection: { value: this.sunDirection.clone() },
        sunSharpness: { value: 900.0 }
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform vec3 zenithColor;
        uniform vec3 horizonColor;
        uniform vec3 groundColor;
        uniform vec3 sunColor;
        uniform vec3 sunDirection;
        uniform float sunSharpness;

        void main() {
          vec3 dir = normalize(vDir);
          float h = dir.y;
          float up = pow(clamp(h, 0.0, 1.0), 0.45);
          vec3 col = mix(horizonColor, zenithColor, up);
          float below = clamp(-h * 3.5, 0.0, 1.0);
          col = mix(col, groundColor, below);
          float sun = max(dot(dir, normalize(sunDirection)), 0.0);
          col += sunColor * pow(sun, sunSharpness) * 0.9;
          col += sunColor * pow(sun, 8.0) * 0.12;
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
  }

  /** El domo sigue a la camara para que nunca se atraviese. */
  follow(camera: THREE.Camera): void {
    this.mesh.position.copy(camera.position);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
