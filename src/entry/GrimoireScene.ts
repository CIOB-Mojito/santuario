// Escena de entrada "Grimorio" portada de Libro.html (Grimorium Arcanum).
// Se conservan los visuales (libro, hojas deformables, texturas procedurales,
// iluminacion, PMREM, particulas, accesorios y animaciones ambientales) y se
// eliminan las interacciones, secretos, controles, interfaz y pantalla de
// carga. No crea renderer propio: solo escena, camara, update(dt) y dispose().
import * as THREE from 'three';

export interface GrimoireOptions {
  /** Anisotropia maxima para las CanvasTextures (default 4). */
  anisotropy?: number;
  /** Escala de las texturas procedurales (default 1, o 0.75 en moviles modestos). */
  textureScale?: number;
  /** Aspecto inicial de la camara (default 0.75, vertical). */
  aspect?: number;
  /** Fabrica de canvas 2D para las texturas (inyectable para pruebas headless). */
  canvas?: (width: number, height: number) => HTMLCanvasElement;
  /** Renderer del motor: solo se usa para generar el entorno PMREM original. */
  renderer?: THREE.WebGLRenderer;
  /** Entorno propio. Si viene undefined y no hay renderer, se genera un fallback procedural. */
  environment?: THREE.Texture | null;
  /** Habilita el entorno de reflejos procedural (sin renderer). Default true. */
  proceduralEnvironment?: boolean;
  /**
   * Aviso pasivo cuando el libro termina su apertura unica (state -> 'open').
   * No altera la animacion: solo notifica para que la interfaz pueda mostrarse.
   */
  onOpen?: () => void;
}

export interface GrimoireScene {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  update(dt: number): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

type LeatherTex = { color: HTMLCanvasElement; normal: HTMLCanvasElement };
type CamState = { yaw: number; pitch: number; dist: number; tx: number; ty: number; tz: number };

interface BookFace {
  geo: THREE.BufferGeometry;
  fm: THREE.Mesh;
  bm: THREE.Mesh;
  p: number;
  shapeP: number;
  y: number;
}

const TAU = Math.PI * 2;
const PI = Math.PI;
/** Espera (s) antes de que el grimorio se abra solo al entrar. */
const OPEN_DELAY = 1.0;
const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const sm = (t: number): number => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};

function RNG(seed: number) {
  let s = (seed >>> 0) || 1;
  const f = (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.r = (a: number, b: number): number => a + f() * (b - a);
  f.i = (a: number, b: number): number => Math.floor(a + f() * (b - a + 1));
  f.p = <T>(a: T[]): T => a[Math.floor(f() * a.length)];
  return f;
}

export function createGrimoireScene(options: GrimoireOptions = {}): GrimoireScene {
  const ownedTextures: THREE.Texture[] = [];

  const makeCanvas =
    options.canvas ??
    ((width: number, height: number): HTMLCanvasElement => {
      if (typeof document === 'undefined') {
        throw new Error('createGrimoireScene necesita options.canvas fuera del navegador');
      }
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      return c;
    });
  const cv = (w: number, h: number): HTMLCanvasElement => {
    const c = makeCanvas(w, h);
    c.width = w;
    c.height = h;
    return c;
  };

  const lowEnd =
    (typeof navigator !== 'undefined' &&
      ((typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4) ||
        (typeof (navigator as unknown as { deviceMemory?: number }).deviceMemory === 'number' &&
          (navigator as unknown as { deviceMemory: number }).deviceMemory <= 3))) ||
    false;
  const Q = {
    shadow: !lowEnd,
    dust: lowEnd ? 70 : 160,
    tex: options.textureScale ?? (lowEnd ? 0.75 : 1)
  };
  const sz = (v: number): number => Math.max(64, Math.round((v * Q.tex) / 8) * 8);

  const maxAn = Math.max(
    1,
    Math.min(8, options.anisotropy ?? (options.renderer ? options.renderer.capabilities.getMaxAnisotropy() : 4))
  );

  /* ---- ruido teselable ---- */
  function valueTile(n: number, g: number, rng: ReturnType<typeof RNG>): Float32Array {
    const L = new Float32Array(g * g);
    for (let i = 0; i < L.length; i++) L[i] = rng();
    const o = new Float32Array(n * n);
    for (let y = 0; y < n; y++) {
      const fy = (y / n) * g;
      const y0 = Math.floor(fy);
      const ty = sm(fy - y0);
      const y1 = (y0 + 1) % g;
      for (let x = 0; x < n; x++) {
        const fx = (x / n) * g;
        const x0 = Math.floor(fx);
        const tx = sm(fx - x0);
        const x1 = (x0 + 1) % g;
        o[y * n + x] = lerp(lerp(L[y0 * g + x0], L[y0 * g + x1], tx), lerp(L[y1 * g + x0], L[y1 * g + x1], tx), ty);
      }
    }
    return o;
  }
  function fbmTile(n: number, rng: ReturnType<typeof RNG>, oct: number, base: number): Float32Array {
    const o = new Float32Array(n * n);
    let a = 0.5;
    let t = 0;
    for (let k = 0; k < oct; k++) {
      const v = valueTile(n, base << k, rng);
      for (let i = 0; i < o.length; i++) o[i] += v[i] * a;
      t += a;
      a *= 0.5;
    }
    for (let i = 0; i < o.length; i++) o[i] /= t;
    return o;
  }
  function cellTile(n: number, g: number, rng: ReturnType<typeof RNG>): Float32Array {
    const P: Array<[number, number]> = [];
    for (let i = 0; i < g * g; i++) P.push([rng(), rng()]);
    const o = new Float32Array(n * n);
    const cs = n / g;
    for (let y = 0; y < n; y++) {
      const cy = Math.floor(y / cs);
      for (let x = 0; x < n; x++) {
        const cx = Math.floor(x / cs);
        let d1 = 1e9;
        let d2 = 1e9;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const p = P[(((cy + oy + g) % g) * g + ((cx + ox + g) % g)) % P.length];
            const d = Math.hypot(x - (cx + ox + p[0]) * cs, y - (cy + oy + p[1]) * cs);
            if (d < d1) {
              d2 = d1;
              d1 = d;
            } else if (d < d2) d2 = d;
          }
        }
        o[y * n + x] = clamp((d2 - d1) / (cs * 0.5), 0, 1);
      }
    }
    return o;
  }
  function normalFromHeight(hc: HTMLCanvasElement, k: number): HTMLCanvasElement {
    const w = hc.width;
    const h = hc.height;
    const s = hc.getContext('2d')!.getImageData(0, 0, w, h).data;
    const out = cv(w, h);
    const og = out.getContext('2d')!;
    const dst = og.createImageData(w, h);
    const d = dst.data;
    const H = new Float32Array(w * h);
    for (let i = 0; i < H.length; i++) H[i] = s[i * 4] / 255;
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - 1) * w;
      const y1 = y * w;
      const y2 = Math.min(h - 1, y + 1) * w;
      for (let x = 0; x < w; x++) {
        const xa = Math.max(0, x - 1);
        const xb = Math.min(w - 1, x + 1);
        const dx = H[y0 + xb] + 2 * H[y1 + xb] + H[y2 + xb] - (H[y0 + xa] + 2 * H[y1 + xa] + H[y2 + xa]);
        const dy = H[y2 + xa] + 2 * H[y2 + x] + H[y2 + xb] - (H[y0 + xa] + 2 * H[y0 + x] + H[y0 + xb]);
        const nx = -dx * k;
        const ny = dy * k;
        const l = Math.hypot(nx, ny, 1);
        const i = (y * w + x) * 4;
        d[i] = (nx / l) * 0.5 * 255 + 0.5 * 255;
        d[i + 1] = (ny / l) * 0.5 * 255 + 0.5 * 255;
        d[i + 2] = (1 / l) * 0.5 * 255 + 0.5 * 255;
        d[i + 3] = 255;
      }
    }
    og.putImageData(dst, 0, 0);
    return out;
  }
  function blurCanvas(c: HTMLCanvasElement, px: number): HTMLCanvasElement {
    const t = cv(c.width, c.height);
    const g = t.getContext('2d')!;
    g.filter = `blur(${px}px)`;
    g.drawImage(c, 0, 0);
    g.filter = 'none';
    return t;
  }

  /* ---- glifos arcanos ---- */
  function glyphPath(g: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
    const h = s / 2;
    switch (((t % 10) + 10) % 10) {
      case 0:
        g.moveTo(x, y - h);
        g.lineTo(x, y + h);
        g.moveTo(x - h * 0.5, y - h * 0.2);
        g.lineTo(x, y - h * 0.7);
        g.lineTo(x + h * 0.5, y - h * 0.2);
        break;
      case 1:
        g.moveTo(x + h * 0.7, y);
        g.arc(x, y, h * 0.7, 0, TAU);
        g.moveTo(x, y - h * 0.7);
        g.lineTo(x, y + h * 0.7);
        break;
      case 2:
        g.arc(x, y + h * 0.1, h * 0.7, PI, TAU);
        g.moveTo(x - h * 0.7, y + h * 0.1);
        g.lineTo(x - h * 0.7, y + h * 0.8);
        g.moveTo(x + h * 0.7, y + h * 0.1);
        g.lineTo(x + h * 0.7, y + h * 0.8);
        break;
      case 3:
        g.moveTo(x, y - h);
        g.lineTo(x + h * 0.85, y + h * 0.7);
        g.lineTo(x - h * 0.85, y + h * 0.7);
        g.closePath();
        g.moveTo(x, y - h * 0.2);
        g.lineTo(x, y + h * 0.7);
        break;
      case 4:
        g.moveTo(x - h, y);
        g.lineTo(x + h, y);
        g.moveTo(x, y - h);
        g.lineTo(x, y + h);
        g.moveTo(x - h * 0.35, y - h * 0.55);
        g.arc(x - h * 0.55, y - h * 0.55, h * 0.2, 0, TAU);
        break;
      case 5:
        for (let a = 0; a < TAU * 1.5; a += 0.25) {
          const r = h * 0.1 + a * h * 0.1;
          const px = x + Math.cos(a) * r;
          const py = y + Math.sin(a) * r;
          if (a) g.lineTo(px, py);
          else g.moveTo(px, py);
        }
        break;
      case 6:
        g.moveTo(x - h, y);
        for (let i = 1; i <= 6; i++) g.lineTo(x - h + (i * h) / 3, y + (i % 2 ? -1 : 1) * h * 0.5);
        break;
      case 7:
        g.moveTo(x, y - h);
        g.lineTo(x + h * 0.7, y);
        g.lineTo(x, y + h);
        g.lineTo(x - h * 0.7, y);
        g.closePath();
        g.moveTo(x + h * 0.12, y);
        g.arc(x, y, h * 0.12, 0, TAU);
        break;
      case 8:
        g.moveTo(x - h * 0.8, y - h);
        g.quadraticCurveTo(x + h * 1.2, y - h * 0.3, x - h * 0.2, y + h * 0.2);
        g.quadraticCurveTo(x - h * 0.9, y + h * 0.6, x + h * 0.7, y + h);
        break;
      default:
        g.moveTo(x - h * 0.8, y + h);
        g.lineTo(x - h * 0.8, y - h);
        g.lineTo(x + h * 0.8, y - h * 0.2);
        g.lineTo(x - h * 0.8, y + h * 0.3);
    }
  }
  function glyph(g: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
    g.beginPath();
    glyphPath(g, x, y, s, t);
    g.stroke();
  }

  /* ---- relieve de cuero ---- */
  function emboss(cg: CanvasRenderingContext2D, hg: CanvasRenderingContext2D, path: (g: CanvasRenderingContext2D) => void, lw: number, gold?: boolean): void {
    hg.save();
    hg.lineCap = hg.lineJoin = 'round';
    hg.strokeStyle = 'rgba(255,255,255,.32)';
    hg.lineWidth = lw * 2.8;
    path(hg);
    hg.stroke();
    hg.strokeStyle = 'rgba(255,255,255,.9)';
    hg.lineWidth = lw;
    path(hg);
    hg.stroke();
    hg.restore();
    cg.save();
    cg.lineCap = cg.lineJoin = 'round';
    cg.strokeStyle = 'rgba(18,9,4,.5)';
    cg.lineWidth = lw * 2.4;
    path(cg);
    cg.stroke();
    cg.strokeStyle = gold === false ? 'rgba(28,14,7,.65)' : 'rgba(205,160,72,.92)';
    cg.lineWidth = lw * 0.85;
    path(cg);
    cg.stroke();
    cg.restore();
  }
  function embossText(
    cg: CanvasRenderingContext2D,
    hg: CanvasRenderingContext2D,
    txt: string,
    cx: number,
    y: number,
    font: string,
    gap: number,
    px: number
  ): void {
    for (const g of [cg, hg]) {
      g.font = font;
      g.textBaseline = 'middle';
    }
    let tot = 0;
    const ws: number[] = [...txt].map((ch) => {
      const w = cg.measureText(ch).width;
      tot += w + gap;
      return w;
    });
    tot -= gap;
    let x = cx - tot / 2;
    let i = 0;
    for (const ch of txt) {
      hg.fillStyle = 'rgba(255,255,255,.28)';
      hg.fillText(ch, x - 1, y - 1);
      hg.fillText(ch, x + 1, y + 1);
      hg.fillStyle = 'rgba(255,255,255,.95)';
      hg.fillText(ch, x, y);
      cg.fillStyle = 'rgba(15,7,3,.6)';
      cg.fillText(ch, x + px, y + px);
      cg.fillStyle = 'rgba(212,168,78,.95)';
      cg.fillText(ch, x, y);
      x += ws[i++] + gap;
    }
  }

  function leatherBase(w: number, h: number, seed: number, base: number[], wear: boolean) {
    const rng = RNG(seed);
    const N = 256;
    const peb = cellTile(N, 22, rng);
    const gr = fbmTile(N, rng, 3, 16);
    const big = fbmTile(128, rng, 4, 3);
    const cc = cv(w, h);
    const cg = cc.getContext('2d')!;
    const ci = cg.createImageData(w, h);
    const cd = ci.data;
    const hc = cv(w, h);
    const hg = hc.getContext('2d')!;
    const hi = hg.createImageData(w, h);
    const hd = hi.data;
    for (let y = 0; y < h; y++) {
      const ty = (y % N) * N;
      const by = ((y / h) * 128 | 0) * 128;
      for (let x = 0; x < w; x++) {
        const tx = x % N;
        const p = peb[ty + tx];
        const g2 = gr[ty + tx];
        const b = big[by + ((x / w) * 128 | 0)];
        let ed = 1;
        if (wear) {
          const ex = Math.min(x, w - 1 - x) / w;
          const ey = Math.min(y, h - 1 - y) / h;
          ed = Math.min(ex, ey * (h / w));
        }
        const ww = wear ? clamp(1 - ed / 0.055, 0, 1) * (0.35 + 0.65 * b) : 0;
        const k = clamp(0.5 + 0.38 * p + 0.22 * g2 + 0.5 * (b - 0.5), 0.25, 1.3) * (1 + ww * 0.55);
        const i = (y * w + x) * 4;
        cd[i] = base[0] * k + ww * 46;
        cd[i + 1] = base[1] * k + ww * 32;
        cd[i + 2] = base[2] * k + ww * 20;
        cd[i + 3] = 255;
        const hv = clamp(0.5 + (p - 0.5) * 0.6 + (g2 - 0.5) * 0.25, 0, 1) * 255;
        hd[i] = hd[i + 1] = hd[i + 2] = hv;
        hd[i + 3] = 255;
      }
    }
    cg.putImageData(ci, 0, 0);
    hg.putImageData(hi, 0, 0);
    return { cc, cg, hc, hg };
  }
  function ageCanvas(cg: CanvasRenderingContext2D, hg: CanvasRenderingContext2D, w: number, h: number, rng: ReturnType<typeof RNG>, n: number): void {
    for (let i = 0; i < n * 3; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const a = rng() * TAU;
      const l = rng.r(20, 110);
      cg.strokeStyle = `rgba(215,185,140,${rng.r(0.04, 0.16)})`;
      cg.lineWidth = rng.r(0.6, 1.6);
      cg.beginPath();
      cg.moveTo(x, y);
      cg.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      cg.stroke();
      hg.strokeStyle = 'rgba(0,0,0,.28)';
      hg.lineWidth = 1;
      hg.beginPath();
      hg.moveTo(x, y);
      hg.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      hg.stroke();
    }
    for (let i = 0; i < n; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const r = rng.r(30, 110);
      const g = cg.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(40,24,14,${rng.r(0.18, 0.4)})`);
      g.addColorStop(1, 'rgba(40,24,14,0)');
      cg.fillStyle = g;
      cg.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < n * 2; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const r = rng.r(12, 40);
      const g = cg.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(70,45,28,.5)');
      g.addColorStop(1, 'rgba(70,45,28,0)');
      cg.fillStyle = g;
      cg.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  function makeCover(w: number, h: number, seed: number, ornate: boolean): LeatherTex {
    const rng = RNG(seed + 7);
    const L = leatherBase(w, h, seed, [66, 40, 25], true);
    const cg = L.cg;
    const hg = L.hg;
    const u = w / 800;
    const cx = w / 2;
    const cy = h / 2;
    const rr = (x: number, y: number, ww: number, hh: number, r: number) => (g: CanvasRenderingContext2D) => {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + ww, y, x + ww, y + hh, r);
      g.arcTo(x + ww, y + hh, x, y + hh, r);
      g.arcTo(x, y + hh, x, y, r);
      g.arcTo(x, y, x + ww, y, r);
      g.closePath();
    };
    emboss(cg, hg, rr(34 * u, 34 * u, w - 68 * u, h - 68 * u, 18 * u), 5 * u);
    emboss(cg, hg, rr(62 * u, 62 * u, w - 124 * u, h - 124 * u, 10 * u), 3 * u);
    emboss(cg, hg, rr(76 * u, 76 * u, w - 152 * u, h - 152 * u, 6 * u), 1.6 * u);
    const circ = (x: number, y: number, r: number) => (g: CanvasRenderingContext2D) => {
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
    };
    emboss(cg, hg, circ(cx, cy, 300 * u), 3.4 * u);
    emboss(cg, hg, circ(cx, cy, 312 * u), 1.6 * u);
    emboss(cg, hg, circ(cx, cy, 196 * u), 4 * u);
    emboss(cg, hg, circ(cx, cy, 184 * u), 1.8 * u);
    for (let k = 0; k < 48; k++) {
      const a = (k * TAU) / 48;
      const r0 = 206 * u;
      const r1 = (k % 2 ? 250 : 278) * u;
      emboss(cg, hg, (g) => {
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      }, 1.8 * u);
    }
    for (let k = 0; k < 32; k++) {
      const a = (k * TAU) / 32;
      const x = cx + Math.cos(a) * 330 * u;
      const y = cy + Math.sin(a) * 330 * u;
      emboss(cg, hg, (g) => {
        g.save();
        g.translate(x, y);
        g.rotate(a + PI / 2);
        g.beginPath();
        glyphPath(g, 0, 0, 24 * u, rng.i(0, 9));
        g.restore();
      }, 2 * u);
    }
    for (const [sx, sy] of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1]
    ]) {
      const px = sx > 0 ? 0 : w;
      const py = sy > 0 ? 0 : h;
      emboss(cg, hg, (g) => {
        g.beginPath();
        for (let a = 0; a < TAU * 2.3; a += 0.12) {
          const r = 3 * u + a * 3.3 * u;
          const x = px + sx * (132 * u + Math.cos(a) * r);
          const y = py + sy * (132 * u + Math.sin(a) * r);
          if (a) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
      }, 2.6 * u);
      emboss(cg, hg, (g) => {
        g.beginPath();
        g.moveTo(px + sx * 90 * u, py + sy * 92 * u);
        g.quadraticCurveTo(px + sx * 250 * u, py + sy * 96 * u, px + sx * 330 * u, py + sy * 126 * u);
        g.moveTo(px + sx * 92 * u, py + sy * 90 * u);
        g.quadraticCurveTo(px + sx * 96 * u, py + sy * 250 * u, px + sx * 126 * u, py + sy * 330 * u);
      }, 2.4 * u);
      emboss(cg, hg, circ(px + sx * 132 * u, py + sy * 132 * u, 6 * u), 2.4 * u);
    }
    if (ornate) {
      embossText(cg, hg, 'GRIMORIUM', cx, 148 * u, `700 ${66 * u}px Georgia,"Times New Roman",serif`, 14 * u, 3 * u);
      embossText(cg, hg, 'ARCANUM', cx, h - 150 * u, `600 ${46 * u}px Georgia,"Times New Roman",serif`, 24 * u, 2.4 * u);
      for (let i = 0; i < 9; i++) {
        const y = 250 * u + i * ((h - 500 * u) / 8);
        for (const x of [118 * u, w - 118 * u])
          emboss(cg, hg, (g) => {
            g.beginPath();
            glyphPath(g, x, y, 30 * u, i * 3 + (x < cx ? 0 : 5));
          }, 2.2 * u);
      }
      emboss(cg, hg, (g) => {
        g.beginPath();
        g.moveTo(190 * u, 196 * u);
        g.lineTo(w - 190 * u, 196 * u);
        g.moveTo(190 * u, h - 200 * u);
        g.lineTo(w - 190 * u, h - 200 * u);
      }, 2 * u);
    }
    ageCanvas(cg, hg, w, h, rng, ornate ? 16 : 10);
    const hb = blurCanvas(L.hc, 1.1);
    return { color: L.cc, normal: normalFromHeight(hb, 2.4) };
  }
  function makeLeatherTile(n: number, seed: number): LeatherTex {
    const L = leatherBase(n, n, seed, [52, 32, 20], false);
    ageCanvas(L.cg, L.hg, n, n, RNG(seed), 4);
    return { color: L.cc, normal: normalFromHeight(L.hc, 2.2) };
  }

  /* ---- madera de la mesa ---- */
  function makeWood(n: number, seed: number): LeatherTex {
    const rng = RNG(seed);
    const T = fbmTile(256, rng, 4, 4);
    const T2 = fbmTile(256, rng, 3, 8);
    const cc = cv(n, n);
    const cg = cc.getContext('2d')!;
    const id = cg.createImageData(n, n);
    const d = id.data;
    const hc = cv(n, n);
    const hg = hc.getContext('2d')!;
    const hd = hg.createImageData(n, n);
    const hh = hd.data;
    const planks = 4;
    const ph = n / planks;
    for (let y = 0; y < n; y++) {
      const pl = Math.floor(y / ph);
      const off = pl * 53;
      for (let x = 0; x < n; x++) {
        const gx = ((x * 0.18 + off) | 0) % 256;
        const gy = ((y * 2.6) | 0) % 256;
        const g1 = T[gy * 256 + gx];
        const g2 = T2[(((y * 0.9) | 0) % 256) * 256 + (((x * 0.5) + off * 3) | 0) % 256];
        const ring = 0.5 + 0.5 * Math.sin(g1 * 11 + y * 0.04) * PI;
        const k = clamp(0.34 + 0.34 * g1 + 0.26 * ring * g2, 0.15, 1);
        const edge = Math.min(y % ph, ph - 1 - (y % ph));
        const dark = edge < 3 ? 0.45 : 1;
        const i = (y * n + x) * 4;
        d[i] = 92 * k * dark;
        d[i + 1] = 58 * k * dark;
        d[i + 2] = 35 * k * dark;
        d[i + 3] = 255;
        const v = clamp(0.45 + 0.4 * (ring - 0.5) + 0.2 * (g2 - 0.5), 0, 1) * (edge < 3 ? 0.2 : 1) * 255;
        hh[i] = hh[i + 1] = hh[i + 2] = v;
        hh[i + 3] = 255;
      }
    }
    cg.putImageData(id, 0, 0);
    hg.putImageData(hd, 0, 0);
    for (let i = 0; i < 40; i++) {
      const x = rng() * n;
      const y = rng() * n;
      const r = rng.r(20, 80);
      const g = cg.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(12,6,3,.35)');
      g.addColorStop(1, 'rgba(12,6,3,0)');
      cg.fillStyle = g;
      cg.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return { color: cc, normal: normalFromHeight(blurCanvas(hc, 0.8), 1.8) };
  }

  /* ---- papel, tinta, ornamentos ---- */
  const PT: { ready: boolean; fine?: Float32Array; big?: Float32Array } = { ready: false };
  function paperTiles(): void {
    if (PT.ready) return;
    const r = RNG(991);
    PT.fine = fbmTile(256, r, 3, 32);
    PT.big = fbmTile(128, r, 4, 3);
    PT.ready = true;
  }
  const PW = 512;
  const PH = 720;
  const INK = '44,26,14';
  function inkS(g: CanvasRenderingContext2D, a: number | undefined, lw?: number): void {
    g.strokeStyle = `rgba(${INK},${a === undefined ? 0.9 : a})`;
    g.fillStyle = g.strokeStyle;
    g.lineWidth = lw || 1.5;
    g.lineCap = g.lineJoin = 'round';
    g.shadowColor = `rgba(${INK},.35)`;
    g.shadowBlur = 1.2;
  }
  function paperCanvas(w: number, h: number, rng: ReturnType<typeof RNG>, right: boolean): HTMLCanvasElement {
    paperTiles();
    const c = cv(w, h);
    const g = c.getContext('2d')!;
    const id = g.createImageData(w, h);
    const d = id.data;
    const N = 256;
    const ox = rng.i(0, N - 1);
    const oy = rng.i(0, N - 1);
    const bx = rng.i(0, 127);
    const by = rng.i(0, 127);
    const fine = PT.fine!;
    const big = PT.big!;
    for (let y = 0; y < h; y++) {
      const ty = ((y + oy) % N) * N;
      const gy = ((((y / h) * 128) | 0) + by) % 128 * 128;
      for (let x = 0; x < w; x++) {
        const f = fine[ty + ((x + ox) % N)];
        const b = big[gy + (((((x / w) * 128) | 0) + bx) % 128)];
        const k = 0.84 + 0.2 * (b - 0.5) + 0.08 * (f - 0.5);
        const i = (y * w + x) * 4;
        d[i] = 228 * k;
        d[i + 1] = 206 * k;
        d[i + 2] = 158 * k;
        d[i + 3] = 255;
      }
    }
    g.putImageData(id, 0, 0);
    let r = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.72);
    r.addColorStop(0, 'rgba(120,80,30,0)');
    r.addColorStop(1, 'rgba(105,66,22,.55)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, h);
    const gx = right ? 0 : w;
    const gr = g.createLinearGradient(gx, 0, right ? w * 0.2 : w * 0.8, 0);
    gr.addColorStop(0, 'rgba(45,24,8,.72)');
    gr.addColorStop(0.35, 'rgba(70,40,15,.25)');
    gr.addColorStop(1, 'rgba(70,40,15,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'multiply';
    for (let i = 0, n = rng.i(3, 6); i < n; i++) {
      const sx = rng() * w;
      const sy = rng() * h;
      const sr = rng.r(24, 80);
      const rg = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
      rg.addColorStop(0, `rgba(150,108,58,${rng.r(0.16, 0.36)})`);
      rg.addColorStop(0.7, 'rgba(150,108,58,.07)');
      rg.addColorStop(1, 'rgba(150,108,58,0)');
      g.fillStyle = rg;
      g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    }
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 280; i++) {
      g.fillStyle = `rgba(90,60,30,${rng.r(0.04, 0.2)})`;
      g.fillRect(rng() * w, rng() * h, rng.r(0.6, 2.4), rng.r(0.6, 1.6));
    }
    g.shadowBlur = 0;
    return c;
  }
  function ring(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, lw: number, a?: number): void {
    inkS(g, a, lw);
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.stroke();
  }
  function polyStar(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, n: number, k: number, rot?: number, lw?: number, a?: number): void {
    inkS(g, a, lw || 1.3);
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const an = (rot === undefined ? -PI / 2 : rot) + (i * k * TAU) / n;
      const x = cx + Math.cos(an) * r;
      const y = cy + Math.sin(an) * r;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
  }
  function tri(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot: number, lw: number | undefined, a?: number): void {
    inkS(g, a, lw || 1.4);
    g.beginPath();
    for (let i = 0; i <= 3; i++) {
      const an = rot + (i * TAU) / 3;
      const x = cx + Math.cos(an) * r;
      const y = cy + Math.sin(an) * r;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
  }
  function runeRing(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, s: number, n: number, rng: ReturnType<typeof RNG>, a?: number): void {
    for (let i = 0; i < n; i++) {
      const an = (i * TAU) / n;
      g.save();
      g.translate(cx + Math.cos(an) * r, cy + Math.sin(an) * r);
      g.rotate(an + PI / 2);
      inkS(g, a || 0.85, 1.2);
      glyph(g, 0, 0, s, rng.i(0, 9));
      g.restore();
    }
  }
  function eye(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, a?: number): void {
    inkS(g, a, 1.7);
    g.beginPath();
    g.moveTo(cx - r, cy);
    g.quadraticCurveTo(cx, cy - r * 0.95, cx + r, cy);
    g.quadraticCurveTo(cx, cy + r * 0.95, cx - r, cy);
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, r * 0.38, 0, TAU);
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, r * 0.15, 0, TAU);
    g.fill();
    for (let i = -3; i <= 3; i++) {
      const x = cx + i * r * 0.26;
      g.beginPath();
      g.moveTo(x, cy - r * 0.6 + Math.abs(i) * r * 0.08);
      g.lineTo(x + i * 2, cy - r * 0.85 + Math.abs(i) * r * 0.1);
      g.stroke();
    }
  }
  function spaced(g: CanvasRenderingContext2D, t: string, cx: number, y: number, font: string, gap: number): void {
    g.font = font;
    g.textBaseline = 'middle';
    let tot = -gap;
    const ws: number[] = [...t].map((c) => {
      const w = g.measureText(c).width;
      tot += w + gap;
      return w;
    });
    let x = cx - tot / 2;
    let i = 0;
    for (const c of t) {
      g.fillText(c, x, y);
      x += ws[i++] + gap;
    }
  }
  function ital(g: CanvasRenderingContext2D, t: string, x: number, y: number, s: number, align?: CanvasTextAlign): void {
    g.font = `italic ${s}px Georgia,"Times New Roman",serif`;
    g.textAlign = align || 'center';
    g.textBaseline = 'middle';
    g.fillText(t, x, y);
    g.textAlign = 'left';
  }
  function divider(g: CanvasRenderingContext2D, cx: number, y: number, w: number): void {
    inkS(g, 0.7, 1.1);
    g.beginPath();
    g.moveTo(cx - w / 2, y);
    g.lineTo(cx - 8, y);
    g.moveTo(cx + 8, y);
    g.lineTo(cx + w / 2, y);
    g.stroke();
    g.beginPath();
    g.moveTo(cx, y - 5);
    g.lineTo(cx + 5, y);
    g.lineTo(cx, y + 5);
    g.lineTo(cx - 5, y);
    g.closePath();
    g.fill();
  }
  function frame(g: CanvasRenderingContext2D, w: number, h: number, m: number): void {
    inkS(g, 0.85, 2.2);
    g.strokeRect(m, m, w - 2 * m, h - 2 * m);
    inkS(g, 0.65, 1);
    g.strokeRect(m + 8, m + 8, w - 2 * m - 16, h - 2 * m - 16);
    for (const [cx, cy, sx, sy] of [
      [m, m, 1, 1],
      [w - m, m, -1, 1],
      [m, h - m, 1, -1],
      [w - m, h - m, -1, -1]
    ]) {
      inkS(g, 0.8, 1.4);
      g.beginPath();
      g.moveTo(cx + sx * 8, cy + sy * 8);
      g.quadraticCurveTo(cx + sx * 40, cy + sy * 10, cx + sx * 34, cy + sy * 40);
      g.moveTo(cx + sx * 8, cy + sy * 8);
      g.quadraticCurveTo(cx + sx * 10, cy + sy * 40, cx + sx * 40, cy + sy * 34);
      g.stroke();
      g.beginPath();
      g.arc(cx + sx * 22, cy + sy * 22, 3, 0, TAU);
      g.fill();
    }
  }
  function script(g: CanvasRenderingContext2D, x: number, y: number, w: number, n: number, s: number, rng: ReturnType<typeof RNG>, a?: number): void {
    inkS(g, a || 0.82, 1.1);
    for (let l = 0; l < n; l++) {
      let cx = x;
      const yy = y + l * s * 1.55;
      const last = l === n - 1 ? w * rng.r(0.3, 0.8) : w;
      while (cx < x + last - s) {
        const wl = rng.i(2, 6);
        for (let k = 0; k < wl && cx < x + last - s; k++) {
          glyph(g, cx + s / 2, yy, s * 0.78, rng.i(0, 9));
          cx += s * 0.95;
        }
        cx += s * 0.7;
      }
    }
  }
  function dropCap(g: CanvasRenderingContext2D, x: number, y: number, s: number, ch: string, _rng: ReturnType<typeof RNG>): void {
    inkS(g, 0.9, 2);
    g.strokeRect(x, y, s, s);
    inkS(g, 0.6, 1);
    g.strokeRect(x + 4, y + 4, s - 8, s - 8);
    g.beginPath();
    for (let a = 0; a < TAU * 1.6; a += 0.2) {
      const r = 2 + a * 3;
      const px = x + s - 14 + Math.cos(a) * r * 0.6;
      const py = y + s - 14 + Math.sin(a) * r * 0.6;
      if (a) g.lineTo(px, py);
      else g.moveTo(px, py);
    }
    g.stroke();
    g.fillStyle = `rgba(${INK},.95)`;
    g.font = `700 ${s * 0.78}px Georgia,serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, x + s / 2, y + s * 0.54);
    g.textAlign = 'left';
  }
  function glow(g: CanvasRenderingContext2D, fn: (q: CanvasRenderingContext2D) => void, col: string, blur: number, lw: number): void {
    g.save();
    g.shadowColor = col;
    g.shadowBlur = blur;
    g.strokeStyle = col;
    g.fillStyle = col;
    g.lineWidth = lw;
    g.lineCap = g.lineJoin = 'round';
    fn(g);
    g.restore();
  }
  function latin(g: CanvasRenderingContext2D, lines: string[], x: number, y: number, s: number, lh: number, a?: number): void {
    g.fillStyle = `rgba(${INK},${a || 0.92})`;
    g.shadowBlur = 0.8;
    lines.forEach((t, i) => {
      g.font = `italic ${s}px Georgia,"Times New Roman",serif`;
      g.textBaseline = 'middle';
      g.fillText(t, x, y + i * lh);
    });
  }

  /* ---- 16 paginas ---- */
  const GOLD = '255,214,120';
  type PageState = { lit: number[]; moon: boolean; written: boolean; circle: boolean };
  function P0(g: CanvasRenderingContext2D, w: number, h: number, r: ReturnType<typeof RNG>): void {
    frame(g, w, h, 26);
    g.textAlign = 'left';
    inkS(g, 0.92, 1.4);
    spaced(g, 'GRIMORIUM', w / 2, 118, `700 48px Georgia,"Times New Roman",serif`, 10);
    spaced(g, 'ARCANUM', w / 2, 178, `600 30px Georgia,serif`, 18);
    const cx = w / 2;
    const cy = 398;
    ring(g, cx, cy, 156, 2.4);
    ring(g, cx, cy, 144, 1);
    ring(g, cx, cy, 116, 1.4);
    runeRing(g, cx, cy, 130, 16, 24, r);
    polyStar(g, cx, cy, 112, 8, 3, undefined, 1.5);
    polyStar(g, cx, cy, 86, 8, 2, undefined, 1.2);
    eye(g, cx, cy, 36);
    for (let k = 0; k < 8; k++) {
      const a = (k * TAU) / 8;
      inkS(g, 0.9, 1);
      g.beginPath();
      g.arc(cx + Math.cos(a) * 156, cy + Math.sin(a) * 156, 5, 0, TAU);
      g.fill();
    }
    inkS(g, 0.85, 1);
    ital(g, 'Liber Primus', w / 2, 622, 28);
    divider(g, w / 2, 650, 150);
  }
  function P1(g: CanvasRenderingContext2D, w: number, h: number, r: ReturnType<typeof RNG>): void {
    frame(g, w, h, 30);
    inkS(g, 0.9, 1);
    ital(g, 'Praefatio', w / 2, 92, 36);
    divider(g, w / 2, 120, 140);
    dropCap(g, 56, 150, 76, 'Q', r);
    latin(g, ['ui hunc librum aperit, noctem', 'invocat; qui legit, vivit.'], 146, 172, 22, 32);
    script(g, 56, 262, w - 112, 15, 17, r);
    inkS(g, 0.8, 1);
    for (let i = 0; i < 3; i++) glyph(g, w / 2 - 30 + i * 30, h - 72, 22, i * 4 + 1);
  }
  function P2(g: CanvasRenderingContext2D, w: number, h: number, _r: ReturnType<typeof RNG>): void {
    frame(g, w, h, 30);
    inkS(g, 0.9, 1);
    ital(g, 'Alphabetum', w / 2, 88, 34);
    divider(g, w / 2, 114, 120);
    const L = 'ABCDEFGHIKLMNOPRSTUVXYZ';
    const cols = 5;
    const cw = (w - 120) / cols;
    const ch = 96;
    for (let i = 0; i < 25; i++) {
      const cx = 60 + cw * (i % cols) + cw / 2;
      const cy = 170 + ch * Math.floor(i / cols) + 30;
      inkS(g, 0.75, 1.6);
      glyph(g, cx, cy, 42, i * 7 + 3);
      inkS(g, 0.55, 1);
      g.font = 'italic 17px Georgia,serif';
      g.textAlign = 'center';
      g.fillText(`${L[i % L.length].toLowerCase()}·`, cx, cy + 38);
      g.textAlign = 'left';
    }
  }
  const CIRC = { x: 256, y: 372, R: 186 };
  function P3(g: CanvasRenderingContext2D, w: number, h: number, _r: ReturnType<typeof RNG>, st: PageState): void {
    frame(g, w, h, 26);
    inkS(g, 0.9, 1);
    ital(g, 'Circulus Octo', w / 2, 76, 32);
    const { x: cx, y: cy, R } = CIRC;
    ring(g, cx, cy, R + 22, 2);
    ring(g, cx, cy, R, 1.6);
    ring(g, cx, cy, R - 26, 1.1);
    ring(g, cx, cy, R - 150, 1.6);
    polyStar(g, cx, cy, R - 26, 8, 3, -PI / 2, 1.3);
    polyStar(g, cx, cy, R - 60, 8, 2, -PI / 2, 1.1);
    eye(g, cx, cy, 30);
    for (let k = 0; k < 8; k++) {
      const a = -PI / 2 + (k * TAU) / 8;
      const x = cx + Math.cos(a) * (R - 1);
      const y = cy + Math.sin(a) * (R - 1);
      ring(g, x, y, 26, 1.8);
      inkS(g, 0.9, 1.6);
      glyph(g, x, y, 26, k * 2 + 1);
      if (st.lit && st.lit[k]) {
        glow(g, (q) => {
          q.beginPath();
          q.arc(x, y, 27, 0, TAU);
          q.stroke();
          q.beginPath();
          glyphPath(q, x, y, 28, k * 2 + 1);
          q.stroke();
        }, `rgba(${GOLD},1)`, 16, 3);
        const rg = g.createRadialGradient(x, y, 0, x, y, 40);
        rg.addColorStop(0, `rgba(${GOLD},.5)`);
        rg.addColorStop(1, `rgba(${GOLD},0)`);
        g.fillStyle = rg;
        g.fillRect(x - 40, y - 40, 80, 80);
      }
    }
    if (st.circle) {
      glow(g, (q) => {
        q.beginPath();
        q.arc(cx, cy, R - 150, 0, TAU);
        q.stroke();
        q.beginPath();
        q.arc(cx, cy, R + 22, 0, TAU);
        q.stroke();
      }, `rgba(${GOLD},1)`, 20, 3);
      const rg = g.createRadialGradient(cx, cy, 0, cx, cy, 150);
      rg.addColorStop(0, `rgba(${GOLD},.45)`);
      rg.addColorStop(1, `rgba(${GOLD},0)`);
      g.fillStyle = rg;
      g.fillRect(cx - 150, cy - 150, 300, 300);
    }
    inkS(g, 0.8, 1);
    ital(g, st.circle ? 'Sigillum apertum est' : 'Octo claves, una porta', w / 2, h - 92, 22);
    divider(g, w / 2, h - 62, 120);
  }
  function P4(g: CanvasRenderingContext2D, w: number, h: number, r: ReturnType<typeof RNG>): void {
    frame(g, w, h, 30);
    inkS(g, 0.9, 1);
    ital(g, 'Invocatio', w / 2, 92, 36);
    divider(g, w / 2, 120, 140);
    latin(
      g,
      ['Per umbram et lucem,', 'per lunam et solem,', 'per portam clausam,', 'aperi quod occultum est.', '', 'Ignis in corde, aqua in oculis,', 'terra sub pedibus,', 'aer in verbis meis.'],
      64,
      176,
      24,
      38
    );
    inkS(g, 0.8, 1.2);
    ring(g, w / 2, h - 170, 52, 1.6);
    polyStar(g, w / 2, h - 170, 48, 8, 3);
    eye(g, w / 2, h - 170, 16);
    script(g, 64, h - 100, w - 128, 2, 15, r);
  }
  function P5(g: CanvasRenderingContext2D, w: number, h: number, r: ReturnType<typeof RNG>, st: PageState): void {
    frame(g, w, h, 28);
    inkS(g, 0.9, 1);
    ital(g, 'Luna', w / 2, 84, 36);
    divider(g, w / 2, 112, 100);
    for (let i = 0; i < 8; i++) {
      const cx = 70 + (i % 4) * ((w - 140) / 3);
      const cy = 190 + Math.floor(i / 4) * 96;
      const R = 30;
      ring(g, cx, cy, R, 1.6);
      g.save();
      g.beginPath();
      g.arc(cx, cy, R - 1, 0, TAU);
      g.clip();
      inkS(g, 0.8, 1);
      g.fillStyle = `rgba(${INK},.78)`;
      const ph = (i / 8) * TAU;
      const k = Math.cos(ph);
      g.beginPath();
      g.arc(cx, cy, R, -PI / 2, PI / 2, i > 4);
      g.ellipse(cx, cy, Math.abs(k) * R, R, 0, PI / 2, -PI / 2, k > 0 ? true : false);
      g.fill();
      g.restore();
    }
    const sx = 256;
    const sy = 470;
    ring(g, sx, sy, 86, 1.6);
    ring(g, sx, sy, 76, 0.9);
    inkS(g, 0.35 + (st.moon ? 0.5 : 0), 2);
    g.beginPath();
    g.arc(sx, sy, 38, PI * 0.5, PI * 1.5);
    g.arc(sx + 14, sy, 30, PI * 1.5, PI * 0.5, true);
    g.stroke();
    if (st.moon) {
      const pts = [[150, 560], [212, 520], [262, 548], [330, 500], [372, 430], [300, 402], [226, 420]];
      glow(g, (q) => {
        q.beginPath();
        pts.forEach((p, i) => (i ? q.lineTo(p[0], p[1]) : q.moveTo(p[0], p[1])));
        q.stroke();
        pts.forEach((p) => {
          q.beginPath();
          q.arc(p[0], p[1], 5, 0, TAU);
          q.fill();
        });
      }, `rgba(${GOLD},1)`, 14, 2.2);
      g.fillStyle = `rgba(${GOLD},.95)`;
      g.shadowColor = `rgba(${GOLD},1)`;
      g.shadowBlur = 12;
      ital(g, 'Stella Occulta', w / 2, 632, 28);
    } else {
      inkS(g, 0.55, 1);
      ital(g, 'quae latet, lucet', w / 2, 630, 22);
    }
    script(g, 70, 664, w - 140, 1, 14, r, 0.6);
  }
  function P6(g: CanvasRenderingContext2D, w: number, h: number, _r: ReturnType<typeof RNG>): void {
    frame(g, w, h, 28);
    inkS(g, 0.9, 1);
    ital(g, 'Arbor Vitae', w / 2, 84, 34);
    divider(g, w / 2, 110, 110);
    const N = [[0, 0], [-1, 0.12], [1, 0.12], [-1, 0.3], [1, 0.3], [0, 0.4], [-1, 0.55], [1, 0.55], [0, 0.67], [0, 0.8]];
    const cx = w / 2;
    const top = 170;
    const ht = 440;
    const P: Array<[number, number]> = N.map((n) => [cx + n[0] * 128, top + n[1] * ht]);
    const E = [[0, 1], [0, 2], [0, 5], [1, 2], [1, 3], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5], [3, 6], [4, 5], [4, 7], [5, 6], [5, 7], [5, 8], [6, 7], [6, 8], [7, 8], [6, 9], [7, 9], [8, 9]];
    inkS(g, 0.65, 1.4);
    E.forEach((e) => {
      g.beginPath();
      g.moveTo(P[e[0]][0], P[e[0]][1]);
      g.lineTo(P[e[1]][0], P[e[1]][1]);
      g.stroke();
    });
    P.forEach((p, i) => {
      g.fillStyle = 'rgba(222,200,150,1)';
      g.beginPath();
      g.arc(p[0], p[1], 27, 0, TAU);
      g.fill();
      ring(g, p[0], p[1], 27, 1.8);
      ring(g, p[0], p[1], 22, 0.8);
      inkS(g, 0.9, 1.4);
      glyph(g, p[0], p[1], 20, i * 3 + 2);
    });
    script(g, 64, h - 72, w - 128, 2, 14, _r, 0.7);
  }
  function plant(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, depth: number, r: ReturnType<typeof RNG>): void {
    if (depth <= 0 || len < 10) return;
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    g.lineWidth = depth * 0.7 + 0.6;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo((x + x2) / 2 + r.r(-8, 8), (y + y2) / 2, x2, y2);
    g.stroke();
    if (depth <= 3) {
      const s = 14 + depth * 3;
      g.beginPath();
      g.moveTo(x2, y2);
      g.quadraticCurveTo(x2 + Math.cos(ang - 0.9) * s, y2 + Math.sin(ang - 0.9) * s, x2 + Math.cos(ang - 0.2) * s * 1.6, y2 + Math.sin(ang - 0.2) * s * 1.6);
      g.quadraticCurveTo(x2 + Math.cos(ang + 0.7) * s, y2 + Math.sin(ang + 0.7) * s, x2, y2);
      g.stroke();
      if (r() < 0.55) {
        g.beginPath();
        g.arc(x2 + r.r(-6, 6), y2 + 8, 5, 0, TAU);
        g.fill();
      }
    }
    plant(g, x2, y2, len * 0.74, ang - r.r(0.3, 0.6), depth - 1, r);
    plant(g, x2, y2, len * 0.7, ang + r.r(0.3, 0.6), depth - 1, r);
    if (depth > 3 && r() < 0.6) plant(g, (x + x2) / 2, (y + y2) / 2, len * 0.55, ang + r.r(-1, 1), depth - 2, r);
  }
  function P7(g: CanvasRenderingContext2D, w: number, h: number, r: ReturnType<typeof RNG>): void {
    frame(g, w, h, 28);
    inkS(g, 0.9, 1);
    ital(g, 'Herbarium', w / 2, 84, 34);
    ital(g, 'Atropa nocturna', w / 2, 116, 22);
    inkS(g, 0.85, 1.2);
    plant(g, w / 2, 610, 120, -PI / 2, 6, r);
    inkS(g, 0.6, 1);
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.moveTo(w / 2, 606);
      g.quadraticCurveTo(w / 2 + r.r(-60, 60), 626 + i * 3, w / 2 + r.r(-110, 110), 652 + r.r(0, 18));
      g.stroke();
    }
    script(g, 64, 150, 100, 5, 13, r, 0.6);
    script(g, w - 164, 150, 100, 5, 13, r, 0.6);
  }
  function P8(g: CanvasRenderingContext2D, w: number, h: number, r: ReturnType<typeof RNG>): void {
    frame(g, w, h, 26);
    inkS(g, 0.9, 1);
    ital(g, 'Rota Siderum', w / 2, 80, 34);
    const cx = w / 2;
    const cy = 390;
    const R = 190;
    ring(g, cx, cy, R, 2);
    ring(g, cx, cy, R - 34, 1.2);
    ring(g, cx, cy, R - 90, 1.2);
    ring(g, cx, cy, R - 140, 1.2);
    for (let k = 0; k < 12; k++) {
      const a = (k * TAU) / 12;
      inkS(g, 0.7, 1);
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (R - 140), cy + Math.sin(a) * (R - 140));
      g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      g.stroke();
      const m = a + TAU / 24;
      inkS(g, 0.9, 1.3);
      glyph(g, cx + Math.cos(m) * (R - 17), cy + Math.sin(m) * (R - 17), 22, k * 3 + 1);
    }
    for (let i = 0; i < 6; i++) {
      const a = r() * TAU;
      const rd = R - 115 + i * 10;
      inkS(g, 0.9, 1);
      g.beginPath();
      g.arc(cx + Math.cos(a) * rd, cy + Math.sin(a) * rd, 4 + (i % 3), 0, TAU);
      g.fill();
    }
    for (let i = 0; i < 46; i++) {
      const x = r.r(40, w - 40);
      const y = r.r(130, h - 60);
      if (Math.hypot(x - cx, y - cy) < R + 14) continue;
      inkS(g, 0.7, 1);
      g.beginPath();
      g.moveTo(x - 4, y);
      g.lineTo(x + 4, y);
      g.moveTo(x, y - 4);
      g.lineTo(x, y + 4);
      g.stroke();
    }
    eye(g, cx, cy, 22);
  }
  function P9(g: CanvasRenderingContext2D, w: number, h: number, r: ReturnType<typeof RNG>): void {
    frame(g, w, h, 30);
    script(g, 64, 84, w - 128, 12, 17, r);
    inkS(g, 0.7, 1.2);
    for (let i = 0; i < 5; i++) {
      const y = 100 + i * 120;
      g.beginPath();
      g.moveTo(40, y);
      g.lineTo(52, y + 10);
      g.moveTo(40, y + 10);
      g.lineTo(52, y);
      g.stroke();
    }
    eye(g, w - 76, h - 110, 16);
    polyStar(g, 70, h - 110, 16, 5, 2, undefined, 1.3);
    script(g, 64, h - 150, w - 128, 3, 16, r);
  }
  function P10(g: CanvasRenderingContext2D, w: number, h: number, r: ReturnType<typeof RNG>): void {
    frame(g, w, h, 26);
    inkS(g, 0.9, 1);
    ital(g, 'Oculus Vigilans', w / 2, 86, 34);
    const cx = w / 2;
    const cy = 372;
    for (let k = 0; k < 36; k++) {
      const a = (k * TAU) / 36;
      inkS(g, 0.55, k % 3 ? 0.8 : 1.4);
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * 120, cy + Math.sin(a) * 120);
      g.lineTo(cx + Math.cos(a) * (k % 2 ? 190 : 222), cy + Math.sin(a) * (k % 2 ? 190 : 222));
      g.stroke();
    }
    tri(g, cx, cy + 6, 166, -PI / 2, 2.4);
    tri(g, cx, cy + 6, 150, -PI / 2, 1);
    eye(g, cx, cy + 22, 56);
    ring(g, cx, cy + 22, 28, 1);
    script(g, 64, h - 110, w - 128, 3, 15, r);
  }
  function P11(g: CanvasRenderingContext2D, w: number, h: number, r: ReturnType<typeof RNG>): void {
    frame(g, w, h, 28);
    inkS(g, 0.9, 1);
    ital(g, 'Opus Magnum', w / 2, 84, 34);
    divider(g, w / 2, 110, 110);
    inkS(g, 0.9, 2);
    g.beginPath();
    g.arc(116, 210, 34, 0, TAU);
    g.stroke();
    g.beginPath();
    g.arc(116, 210, 6, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(256, 210, 34, PI * 0.55, PI * 1.45);
    g.arc(272, 210, 28, PI * 1.45, PI * 0.55, true);
    g.stroke();
    g.beginPath();
    g.arc(396, 224, 24, 0, TAU);
    g.moveTo(374, 186);
    g.quadraticCurveTo(396, 162, 418, 186);
    g.moveTo(396, 248);
    g.lineTo(396, 288);
    g.moveTo(376, 268);
    g.lineTo(416, 268);
    g.stroke();
    inkS(g, 0.9, 2);
    g.beginPath();
    g.arc(176, 470, 82, 0, TAU);
    g.stroke();
    g.beginPath();
    g.moveTo(150, 392);
    g.lineTo(150, 336);
    g.lineTo(202, 336);
    g.lineTo(202, 392);
    g.stroke();
    g.beginPath();
    g.moveTo(202, 346);
    g.quadraticCurveTo(290, 320, 350, 366);
    g.lineTo(350, 430);
    g.stroke();
    g.beginPath();
    g.arc(350, 478, 56, 0, TAU);
    g.stroke();
    inkS(g, 0.45, 1);
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.arc(176, 470, 20 + i * 8, 0.3, PI - 0.3);
      g.stroke();
    }
    polyStar(g, 350, 478, 38, 6, 2);
    script(g, 64, h - 96, w - 128, 3, 15, r);
  }
  function P12(g: CanvasRenderingContext2D, w: number, h: number, _r: ReturnType<typeof RNG>): void {
    frame(g, w, h, 26);
    inkS(g, 0.9, 1);
    ital(g, 'Ouroboros', w / 2, 84, 36);
    const cx = w / 2;
    const cy = 378;
    const R = 140;
    g.lineWidth = 26;
    g.strokeStyle = `rgba(${INK},.85)`;
    g.beginPath();
    g.arc(cx, cy, R, -PI * 0.45, PI * 1.45);
    g.stroke();
    g.strokeStyle = 'rgba(222,200,150,1)';
    g.lineWidth = 20;
    g.beginPath();
    g.arc(cx, cy, R, -PI * 0.45, PI * 1.45);
    g.stroke();
    inkS(g, 0.8, 1);
    for (let i = 0; i < 46; i++) {
      const a = -PI * 0.4 + (i * (PI * 1.8)) / 46;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      g.beginPath();
      g.arc(x, y, 7, a + PI * 0.7, a + PI * 1.3);
      g.stroke();
    }
    const hx = cx + Math.cos(-PI * 0.45) * R;
    const hy = cy + Math.sin(-PI * 0.45) * R;
    inkS(g, 0.95, 2);
    g.beginPath();
    g.ellipse(hx, hy, 18, 12, -0.5, 0, TAU);
    g.stroke();
    g.beginPath();
    g.arc(hx + 4, hy - 2, 2.6, 0, TAU);
    g.fill();
    polyStar(g, cx, cy, 96, 6, 2, undefined, 1.4);
    tri(g, cx, cy, 70, -PI / 2, 1.2);
    tri(g, cx, cy, 70, PI / 2, 1.2);
    ring(g, cx, cy, 24, 1.4);
    glyph(g, cx, cy, 22, 5);
    script(g, 64, h - 120, w - 128, 3, 15, _r);
  }
  function P13(g: CanvasRenderingContext2D, w: number, h: number, r: ReturnType<typeof RNG>): void {
    frame(g, w, h, 26);
    inkS(g, 0.9, 1);
    ital(g, 'Sigillum Maius', w / 2, 84, 34);
    const cx = w / 2;
    const cy = 384;
    const R = 176;
    ring(g, cx, cy, R + 20, 2);
    ring(g, cx, cy, R + 8, 1);
    tri(g, cx, cy, R, -PI / 2, 2.2);
    tri(g, cx, cy, R, PI / 2, 2.2);
    ring(g, cx, cy, R * 0.5, 1.4);
    runeRing(g, cx, cy, R + 34, 18, 18, r);
    for (let k = 0; k < 6; k++) {
      const a = -PI / 2 + (k * TAU) / 6;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      ring(g, x, y, 18, 1.6);
      inkS(g, 0.9, 1.4);
      glyph(g, x, y, 16, k * 3 + 4);
    }
    eye(g, cx, cy, 34);
    script(g, 64, h - 96, w - 128, 2, 15, r);
  }
  function P14(g: CanvasRenderingContext2D, w: number, h: number, r: ReturnType<typeof RNG>): void {
    frame(g, w, h, 30);
    script(g, 64, 84, w - 128, 9, 17, r);
    ital(g, 'Caveat lector', w / 2, 346, 28);
    divider(g, w / 2, 372, 120);
    script(g, 64, 410, w - 128, 8, 17, r);
    g.globalCompositeOperation = 'multiply';
    let rg = g.createRadialGradient(w - 60, h - 50, 0, w - 60, h - 50, 230);
    rg.addColorStop(0, 'rgba(20,10,4,.85)');
    rg.addColorStop(0.5, 'rgba(60,30,10,.4)');
    rg.addColorStop(1, 'rgba(60,30,10,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
    rg = g.createRadialGradient(150, 300, 0, 150, 300, 34);
    rg.addColorStop(0, 'rgba(20,10,4,.7)');
    rg.addColorStop(1, 'rgba(20,10,4,0)');
    g.fillStyle = rg;
    g.fillRect(100, 250, 100, 100);
    g.globalCompositeOperation = 'source-over';
  }
  function P15(g: CanvasRenderingContext2D, w: number, h: number, _r: ReturnType<typeof RNG>, st: PageState): void {
    frame(g, w, h, 30);
    inkS(g, 0.9, 1);
    ital(g, 'Finis', w / 2, 150, 60);
    divider(g, w / 2, 196, 160);
    inkS(g, 0.3, 1);
    for (let i = 0; i < 14; i++) {
      g.beginPath();
      g.moveTo(70, 260 + i * 30);
      g.lineTo(w - 70, 260 + i * 30);
      g.stroke();
    }
    if (st.written) {
      const L = ['Hic liber meus est.', 'Qui legit, vigilat.', 'Lux in tenebris manet.'];
      g.fillStyle = `rgba(${GOLD},.96)`;
      g.shadowColor = `rgba(${GOLD},1)`;
      g.shadowBlur = 14;
      L.forEach((t) => ital(g, t, w / 2, 288 + L.indexOf(t) * 60, 30));
      g.shadowBlur = 0;
    }
    inkS(g, 0.6, 1);
    eye(g, w / 2, h - 96, 20);
  }
  const PAGES: Array<(g: CanvasRenderingContext2D, w: number, h: number, r: ReturnType<typeof RNG>, st: PageState) => void> = [P0, P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15];
  const PBASE: Record<number, HTMLCanvasElement> = {};
  function paintPage(i: number, st: PageState): HTMLCanvasElement {
    const right = i % 2 === 0;
    const rng = RNG(1000 + i * 77);
    const c = cv(PW, PH);
    const g = c.getContext('2d')!;
    const base = PBASE[i] || paperCanvas(PW, PH, RNG(5000 + i * 13), right);
    if (i === 3 || i === 5 || i === 15) PBASE[i] = base;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.shadowBlur = 0;
    g.globalCompositeOperation = 'source-over';
    g.drawImage(base, 0, 0);
    g.textAlign = 'left';
    PAGES[i](g, PW, PH, rng, st);
    g.fillStyle = `rgba(${INK},.55)`;
    g.shadowBlur = 0;
    g.font = 'italic 14px Georgia,serif';
    g.textAlign = 'center';
    const rom = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI'][i];
    if (i > 0) g.fillText(rom, right ? PW - 48 : 48, PH - 26);
    g.textAlign = 'left';
    return c;
  }
  function makeEndpaper(w: number, h: number, seed: number): HTMLCanvasElement {
    const rng = RNG(seed);
    const c = cv(w, h);
    const g = c.getContext('2d')!;
    g.fillStyle = '#2a1520';
    g.fillRect(0, 0, w, h);
    const cols = ['107,31,43', '31,58,90', '201,162,74', '52,26,58', '90,60,30'];
    for (let b = 0; b < 110; b++) {
      g.strokeStyle = `rgba(${rng.p(cols)},${rng.r(0.18, 0.45)})`;
      g.lineWidth = rng.r(4, 20);
      const y0 = rng() * h;
      const f = rng.r(0.004, 0.02);
      const am = rng.r(10, 60);
      const ph = rng() * TAU;
      g.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y = y0 + Math.sin(x * f + ph) * am + Math.sin(x * f * 3.1 + ph * 2) * am * 0.3;
        if (x) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
    }
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(225,190,100,${rng.r(0.15, 0.6)})`;
      g.fillRect(rng() * w, rng() * h, rng.r(1, 3), rng.r(1, 3));
    }
    const lw = w * 0.5;
    const lh = h * 0.2;
    const lx = (w - lw) / 2;
    const ly = h * 0.38;
    g.fillStyle = 'rgba(222,200,152,.96)';
    g.fillRect(lx, ly, lw, lh);
    inkS(g, 0.8, 2);
    g.strokeRect(lx + 6, ly + 6, lw - 12, lh - 12);
    inkS(g, 0.9, 1);
    g.fillStyle = `rgba(${INK},.9)`;
    ital(g, 'Ex Libris', w / 2, ly + lh * 0.38, w * 0.075);
    eye(g, w / 2, ly + lh * 0.72, w * 0.05);
    return c;
  }
  function makeEdgeTex(): HTMLCanvasElement {
    const c = cv(64, 256);
    const g = c.getContext('2d')!;
    const rng = RNG(33);
    g.fillStyle = '#cdb88a';
    g.fillRect(0, 0, 64, 256);
    for (let y = 0; y < 256; y += 2) {
      g.fillStyle = `rgba(90,64,30,${rng.r(0.15, 0.5)})`;
      g.fillRect(0, y, 64, 1);
    }
    const gr = g.createLinearGradient(0, 0, 64, 0);
    gr.addColorStop(0, 'rgba(60,35,15,.5)');
    gr.addColorStop(0.3, 'rgba(60,35,15,0)');
    gr.addColorStop(1, 'rgba(60,35,15,.35)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 256);
    return c;
  }

  /* ---- entorno, luces, texturas ---- */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07050b);
  scene.fog = new THREE.FogExp2(0x07050b, 0.055);
  const camera = new THREE.PerspectiveCamera(36, options.aspect ?? 0.75, 0.1, 60);

  function T2(c: HTMLCanvasElement, o: { lin?: boolean; rep?: [number, number] } = {}): THREE.CanvasTexture {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = o.lin ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    t.anisotropy = maxAn;
    if (o.rep) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(o.rep[0], o.rep[1]);
    }
    ownedTextures.push(t);
    return t;
  }

  function makeEnvCanvas(): HTMLCanvasElement {
    const w = 512;
    const h = 256;
    const c = cv(w, h);
    const g = c.getContext('2d')!;
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0c0912');
    bg.addColorStop(1, '#05030a');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    const blob = (x: number, y: number, r: number, col: string): void => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, col);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    };
    blob(398, 84, 130, 'rgba(255,190,110,.95)');
    blob(84, 74, 116, 'rgba(130,150,255,.85)');
    blob(462, 196, 108, 'rgba(190,110,255,.7)');
    blob(168, 214, 96, 'rgba(210,200,170,.55)');
    g.globalCompositeOperation = 'source-over';
    return c;
  }

  if (options.renderer) {
    const es = new THREE.Scene();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(30, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.04, 0.09), side: THREE.BackSide }));
    es.add(dome);
    const blob = (c: THREE.Color, x: number, y: number, z: number, r: number): void => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color: c }));
      m.position.set(x, y, z);
      es.add(m);
    };
    blob(new THREE.Color(5, 3.4, 1.8), 8, 9, 6, 2.4);
    blob(new THREE.Color(1.4, 1.8, 4.5), -12, 6, -9, 3);
    blob(new THREE.Color(2.2, 1.2, 3.6), 10, 3, -10, 2);
    blob(new THREE.Color(0.9, 0.7, 0.5), -6, 2, 10, 3);
    const pm = new THREE.PMREMGenerator(options.renderer);
    const tex = pm.fromScene(es, 0.03).texture;
    pm.dispose();
    scene.environment = tex;
    ownedTextures.push(tex);
  } else if (options.environment !== undefined) {
    if (options.environment) scene.environment = options.environment;
  } else if (options.proceduralEnvironment !== false) {
    const t = new THREE.CanvasTexture(makeEnvCanvas());
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    ownedTextures.push(t);
    scene.environment = t;
  }

  scene.add(new THREE.HemisphereLight(0x3a3060, 0x140c06, 0.62));
  const key = new THREE.DirectionalLight(0xffd9a8, 1.15);
  key.position.set(3.4, 6.4, 4);
  key.castShadow = Q.shadow;
  key.shadow.mapSize.set(1024, 1024);
  {
    const c = key.shadow.camera;
    c.left = -4.6;
    c.right = 4.6;
    c.top = 4.6;
    c.bottom = -4.6;
    c.near = 1;
    c.far = 18;
    c.updateProjectionMatrix();
    key.shadow.bias = -0.0007;
    key.shadow.normalBias = 0.025;
  }
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6f80ff, 0.55);
  rim.position.set(-4, 3, -5);
  scene.add(rim);
  const candleL = new THREE.PointLight(0xff9a50, 1.7, 11, 2);
  scene.add(candleL);
  const crystalL = new THREE.PointLight(0x8f66ff, 1.0, 8, 2);
  scene.add(crystalL);
  const bookL = new THREE.PointLight(0xffd080, 0, 5, 2);
  bookL.position.set(0, 1.1, 0);
  scene.add(bookL);

  /* ---- texturas procedurales ---- */
  const TX = {} as {
    cover: LeatherTex;
    back: LeatherTex;
    tile: LeatherTex;
    wood: LeatherTex;
    end: HTMLCanvasElement;
    edge: HTMLCanvasElement;
    eye: { color: HTMLCanvasElement; glow: HTMLCanvasElement };
    brass: HTMLCanvasElement;
    glow: THREE.CanvasTexture;
    flame: THREE.CanvasTexture;
    sigil: HTMLCanvasElement;
  };
  TX.cover = makeCover(sz(720), sz(1012), 11, true);
  TX.back = makeCover(sz(512), sz(720), 23, false);
  TX.tile = makeLeatherTile(sz(256), 5);
  TX.wood = makeWood(sz(768), 5);
  TX.end = makeEndpaper(sz(512), sz(720), 4);
  TX.edge = makeEdgeTex();
  const PST: PageState = { lit: [0, 0, 0, 0, 0, 0, 0, 0], moon: false, written: false, circle: false };
  const PG: HTMLCanvasElement[] = [];
  for (let i = 0; i < 16; i++) PG.push(paintPage(i, PST));

  function makeEyeTex(): { color: HTMLCanvasElement; glow: HTMLCanvasElement } {
    const c = cv(256, 256);
    const g = c.getContext('2d')!;
    const e = cv(256, 256);
    const h = e.getContext('2d')!;
    let r = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    r.addColorStop(0, '#2a1740');
    r.addColorStop(1, '#0b0814');
    g.fillStyle = r;
    g.fillRect(0, 0, 256, 256);
    h.fillStyle = '#000';
    h.fillRect(0, 0, 256, 256);
    for (const x of [g, h]) {
      x.lineCap = 'round';
      for (let k = 0; k < 24; k++) {
        const a = (k * TAU) / 24;
        x.strokeStyle = x === g ? 'rgba(214,170,80,.55)' : 'rgba(255,190,80,.9)';
        x.lineWidth = k % 2 ? 2 : 3;
        x.beginPath();
        x.moveTo(128 + Math.cos(a) * 86, 128 + Math.sin(a) * 86);
        x.lineTo(128 + Math.cos(a) * (k % 2 ? 106 : 120), 128 + Math.sin(a) * (k % 2 ? 106 : 120));
        x.stroke();
      }
      x.strokeStyle = x === g ? '#d9b25a' : '#ffc860';
      x.lineWidth = 3;
      x.beginPath();
      x.moveTo(34, 128);
      x.quadraticCurveTo(128, 40, 222, 128);
      x.quadraticCurveTo(128, 216, 34, 128);
      x.stroke();
      x.beginPath();
      x.arc(128, 128, 38, 0, TAU);
      x.fillStyle = x === g ? '#8a4a14' : '#ff9a30';
      x.fill();
      x.stroke();
      x.beginPath();
      x.arc(128, 128, 16, 0, TAU);
      x.fillStyle = x === g ? '#050308' : '#150a00';
      x.fill();
      x.fillStyle = x === g ? 'rgba(255,230,160,.9)' : '#fff';
      x.beginPath();
      x.arc(120, 120, 5, 0, TAU);
      x.fill();
    }
    return { color: c, glow: e };
  }
  TX.eye = makeEyeTex();
  function brassTex(): HTMLCanvasElement {
    const c = cv(256, 256);
    const g = c.getContext('2d')!;
    const r = RNG(8);
    g.fillStyle = '#d8c490';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) {
      const x = r() * 256;
      const y = r() * 256;
      const rd = r.r(8, 40);
      const q = g.createRadialGradient(x, y, 0, x, y, rd);
      q.addColorStop(0, r() < 0.4 ? 'rgba(60,110,90,.45)' : 'rgba(70,45,15,.4)');
      q.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = q;
      g.fillRect(x - rd, y - rd, rd * 2, rd * 2);
    }
    for (let i = 0; i < 120; i++) {
      g.strokeStyle = `rgba(255,240,200,${r.r(0.05, 0.25)})`;
      g.lineWidth = 0.7;
      g.beginPath();
      const x = r() * 256;
      const y = r() * 256;
      g.moveTo(x, y);
      g.lineTo(x + r.r(-30, 30), y + r.r(-10, 10));
      g.stroke();
    }
    return c;
  }
  TX.brass = brassTex();
  function dotTex(kind: 'flame' | 'glow'): THREE.CanvasTexture {
    const c = cv(128, 128);
    const g = c.getContext('2d')!;
    if (kind === 'flame') {
      const r = g.createRadialGradient(64, 86, 2, 64, 76, 60);
      r.addColorStop(0, 'rgba(255,250,220,1)');
      r.addColorStop(0.25, 'rgba(255,200,90,.95)');
      r.addColorStop(0.6, 'rgba(255,110,30,.5)');
      r.addColorStop(1, 'rgba(255,60,0,0)');
      g.fillStyle = r;
      g.beginPath();
      g.moveTo(64, 6);
      g.quadraticCurveTo(112, 64, 98, 96);
      g.quadraticCurveTo(64, 132, 30, 96);
      g.quadraticCurveTo(16, 64, 64, 6);
      g.fill();
    } else {
      const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(0.3, 'rgba(255,255,255,.55)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 128, 128);
    }
    return T2(c);
  }
  TX.glow = dotTex('glow');
  TX.flame = dotTex('flame');
  function tableSigil(): HTMLCanvasElement {
    const c = cv(1024, 1024);
    const g = c.getContext('2d')!;
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    const cx = 512;
    const cy = 512;
    const r = RNG(3);
    const rg = (rad: number, a: number, lw: number): void => {
      g.strokeStyle = `rgba(190,150,255,${a})`;
      g.lineWidth = lw;
      g.beginPath();
      g.arc(cx, cy, rad, 0, TAU);
      g.stroke();
    };
    rg(500, 0.5, 3);
    rg(486, 0.3, 1.4);
    rg(420, 0.35, 2);
    rg(330, 0.45, 2.4);
    rg(250, 0.25, 1.4);
    g.strokeStyle = 'rgba(255,210,120,.5)';
    g.lineWidth = 2.2;
    for (const [n, k, rad] of [
      [8, 3, 328],
      [8, 2, 250],
      [12, 5, 410]
    ]) {
      g.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = -PI / 2 + (i * k * TAU) / n;
        if (i) g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
        else g.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      }
      g.stroke();
    }
    for (let i = 0; i < 36; i++) {
      const a = (i * TAU) / 36;
      g.save();
      g.translate(cx + Math.cos(a) * 453, cy + Math.sin(a) * 453);
      g.rotate(a + PI / 2);
      g.strokeStyle = 'rgba(255,215,140,.6)';
      g.lineWidth = 2.4;
      glyph(g, 0, 0, 34, r.i(0, 9));
      g.restore();
    }
    for (let i = 0; i < 64; i++) {
      const a = (i * TAU) / 64;
      g.strokeStyle = 'rgba(190,150,255,.4)';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (i % 4 ? 478 : 468), cy + Math.sin(a) * (i % 4 ? 478 : 468));
      g.lineTo(cx + Math.cos(a) * 494, cy + Math.sin(a) * 494);
      g.stroke();
    }
    return c;
  }
  TX.sigil = tableSigil();

  /* ---- geometria auxiliar ---- */
  function rrShape(x: number, y: number, w: number, h: number, r: number, s?: THREE.Shape | THREE.Path): THREE.Shape {
    const sh = (s ?? new THREE.Shape()) as THREE.Shape;
    sh.moveTo(x + r, y);
    sh.lineTo(x + w - r, y);
    sh.quadraticCurveTo(x + w, y, x + w, y + r);
    sh.lineTo(x + w, y + h - r);
    sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    sh.lineTo(x + r, y + h);
    sh.quadraticCurveTo(x, y + h, x, y + h - r);
    sh.lineTo(x, y + r);
    sh.quadraticCurveTo(x, y, x + r, y);
    return sh;
  }
  function makeBoard(w: number, h: number, t: number, bt: number, r: number): THREE.ExtrudeGeometry {
    const g = new THREE.ExtrudeGeometry(rrShape(0, -h / 2, w, h, r), {
      depth: t - 2 * bt,
      bevelEnabled: true,
      bevelThickness: bt,
      bevelSize: bt,
      bevelOffset: -bt,
      bevelSegments: 3,
      curveSegments: 8
    });
    g.translate(0, 0, bt);
    const p = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w, (p.getY(i) + h / 2) / h);
    g.rotateX(-PI / 2);
    return g;
  }
  function flatExtrude(shape: THREE.Shape, depth: number, bev: number): THREE.ExtrudeGeometry {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: bev,
      bevelSize: bev,
      bevelOffset: -bev,
      bevelSegments: 2,
      curveSegments: 10
    });
    g.translate(0, 0, bev);
    g.rotateX(-PI / 2);
    return g;
  }
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a050, map: T2(TX.brass), metalness: 0.9, roughness: 0.36, envMapIntensity: 1.35 });
  const brassDark = new THREE.MeshStandardMaterial({ color: 0x8a6a2e, map: T2(TX.brass), metalness: 0.85, roughness: 0.5, envMapIntensity: 1.1 });
  function leatherMat(tx: LeatherTex, rep: [number, number] | undefined, tint: number | undefined, rough: number | undefined): THREE.MeshStandardMaterial {
    const o: THREE.MeshStandardMaterialParameters = {
      map: T2(tx.color, rep ? { rep } : {}),
      normalMap: T2(tx.normal, { lin: true, rep }),
      roughness: rough || 0.72,
      metalness: 0.05,
      envMapIntensity: 0.3
    };
    const m = new THREE.MeshStandardMaterial(o);
    m.normalScale.set(1.15, 1.15);
    if (tint) m.color.set(tint);
    return m;
  }

  /* ---- mesa y circulo ritual ---- */
  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 18),
    new THREE.MeshStandardMaterial({
      map: T2(TX.wood.color, { rep: [4, 4] }),
      normalMap: T2(TX.wood.normal, { lin: true, rep: [4, 4] }),
      roughness: 0.62,
      metalness: 0,
      envMapIntensity: 0.25
    })
  );
  table.rotation.x = -PI / 2;
  table.position.y = -0.002;
  table.receiveShadow = true;
  scene.add(table);
  const sigilMat = new THREE.MeshBasicMaterial({ map: T2(TX.sigil), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const sigil = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 7.4), sigilMat);
  sigil.rotation.x = -PI / 2;
  sigil.position.y = 0.003;
  scene.add(sigil);

  /* ---- EL LIBRO ---- */
  const D = { W: 1.5, H: 2.1, N: 8, GAP: 0.026, T: 0.06 };
  const W = D.W;
  const H = D.H;
  const N = D.N;
  const GAP = D.GAP;
  const T = D.T;
  const WC = W + 0.08;
  const HC = H + 0.12;
  const HS = 2 * T + N * GAP;
  const RS = HS / 2;
  const BK = {} as {
    root: THREE.Group;
    spine: THREE.Mesh;
    pivot: THREE.Group;
    board: THREE.Mesh;
    strap: THREE.Group;
    eyeMat: THREE.MeshStandardMaterial;
    eye: THREE.Mesh;
    medal: THREE.Group;
    gems: THREE.MeshStandardMaterial[];
    bR: THREE.Mesh;
    bL: THREE.Mesh;
    leaves: BookFace[];
    pageTex: THREE.CanvasTexture[];
  };
  const root = new THREE.Group();
  scene.add(root);
  BK.root = root;
  const sideMat = leatherMat(TX.tile, [6, 1], 0x9a8878, 0.8);
  const backMat = leatherMat(TX.tile, [2, 3], 0xb8a898, 0.78);
  const coverMat = leatherMat(TX.cover, undefined, undefined, 0.68);
  const endMat = new THREE.MeshStandardMaterial({ map: T2(TX.end), roughness: 0.85, metalness: 0, envMapIntensity: 0.2 });
  const backB = new THREE.Mesh(makeBoard(WC, HC, T, 0.012, 0.06), [backMat, sideMat]);
  backB.castShadow = true;
  backB.receiveShadow = true;
  root.add(backB);
  {
    const e = new THREE.Mesh(new THREE.PlaneGeometry(WC - 0.05, HC - 0.05), endMat);
    e.rotation.x = -PI / 2;
    e.position.set(WC / 2, T + 0.001, 0);
    root.add(e);
  }
  {
    const g = new THREE.CylinderGeometry(RS, RS, HC - 0.02, 28, 1, true, PI, PI);
    g.rotateX(PI / 2);
    const m = leatherMat(TX.tile, [1, 5], 0xb0a090, 0.7);
    m.side = THREE.DoubleSide;
    const s = new THREE.Mesh(g, m);
    s.position.set(0, HS / 2, 0);
    s.castShadow = true;
    root.add(s);
    BK.spine = s;
    for (let i = 1; i <= 4; i++) {
      const b = new THREE.Mesh(new THREE.TorusGeometry(RS + 0.008, 0.017, 8, 22, PI), brassDark);
      b.rotation.z = PI / 2;
      b.position.set(0, HS / 2, -HC / 2 + (HC * i) / 5);
      b.castShadow = true;
      root.add(b);
    }
    for (const z of [-HC / 2 + 0.012, HC / 2 - 0.012]) {
      const b = new THREE.Mesh(new THREE.TorusGeometry(RS + 0.004, 0.02, 8, 22, PI), brassDark);
      b.rotation.z = PI / 2;
      b.position.set(0, HS / 2, z);
      root.add(b);
    }
  }
  function cornerGeo(): THREE.ExtrudeGeometry {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0.36, 0);
    s.quadraticCurveTo(0.345, 0.05, 0.28, 0.08);
    s.quadraticCurveTo(0.215, 0.105, 0.19, 0.17);
    s.quadraticCurveTo(0.165, 0.215, 0.125, 0.235);
    s.quadraticCurveTo(0.095, 0.26, 0.082, 0.33);
    s.lineTo(0, 0.36);
    s.lineTo(0, 0);
    const h = new THREE.Path();
    h.absarc(0.082, 0.082, 0.022, 0, TAU, true);
    s.holes.push(h);
    const h2 = new THREE.Path();
    h2.moveTo(0.14, 0.05);
    h2.quadraticCurveTo(0.2, 0.06, 0.17, 0.115);
    h2.quadraticCurveTo(0.12, 0.12, 0.14, 0.05);
    s.holes.push(h2);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelOffset: -0.004, bevelSegments: 2, curveSegments: 8 });
    g.rotateX(PI / 2);
    g.translate(0, 0.02, 0);
    return g;
  }
  const cGeo = cornerGeo();
  const rivetG = new THREE.SphereGeometry(0.018, 8, 6);
  function addCorners(parent: THREE.Object3D, y: number, w: number, h: number): void {
    for (const [sx, sz] of [
      [1, -1],
      [-1, -1],
      [1, 1],
      [-1, 1]
    ]) {
      const g = new THREE.Group();
      g.position.set(sx > 0 ? 0.012 : w - 0.012, y, sz < 0 ? -h / 2 + 0.012 : h / 2 - 0.012);
      g.scale.set(sx, 1, -sz);
      const m = new THREE.Mesh(cGeo, brass);
      m.castShadow = true;
      g.add(m);
      for (const p of [
        [0.082, 0.082],
        [0.22, 0.03],
        [0.03, 0.22]
      ]) {
        const r = new THREE.Mesh(rivetG, brass);
        r.position.set(p[0], 0.022, p[1]);
        r.scale.y = 0.7;
        g.add(r);
      }
      parent.add(g);
    }
  }
  addCorners(root, T + 0.0005, WC, HC);
  const pivot = new THREE.Group();
  pivot.position.set(0, HS / 2, 0);
  root.add(pivot);
  BK.pivot = pivot;
  const cg = new THREE.Group();
  cg.position.set(0, HS / 2 - T, 0);
  pivot.add(cg);
  const board = new THREE.Mesh(makeBoard(WC, HC, T, 0.012, 0.06), [coverMat, sideMat]);
  board.castShadow = true;
  board.receiveShadow = true;
  cg.add(board);
  BK.board = board;
  {
    const e = new THREE.Mesh(new THREE.PlaneGeometry(WC - 0.04, HC - 0.04), endMat);
    e.rotation.set(PI / 2, 0, PI);
    e.position.set(WC / 2, -0.0015, 0);
    cg.add(e);
  }
  {
    const sh = rrShape(0.045, -HC / 2 + 0.045, WC - 0.09, HC - 0.09, 0.05);
    sh.holes.push(rrShape(0.08, -HC / 2 + 0.08, WC - 0.16, HC - 0.16, 0.04, new THREE.Path()));
    const rg = flatExtrude(sh, 0.006, 0.003);
    const r = new THREE.Mesh(rg, brass);
    r.position.y = T;
    r.castShadow = true;
    cg.add(r);
  }
  addCorners(cg, T + 0.0005, WC, HC);
  {
    const m = new THREE.Group();
    m.position.set(WC / 2, T, 0);
    cg.add(m);
    BK.medal = m;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.43, 0.026, 48), brassDark);
    base.position.y = 0.013;
    base.castShadow = true;
    m.add(base);
    const tor = new THREE.Mesh(new THREE.TorusGeometry(0.385, 0.019, 10, 56), brass);
    tor.rotation.x = PI / 2;
    tor.position.y = 0.03;
    m.add(tor);
    const ss = new THREE.Shape();
    for (let i = 0; i < 16; i++) {
      const a = (i * PI) / 8;
      const rr = i % 2 ? 0.25 : 0.37;
      if (i) ss.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ss.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ss.closePath();
    const star = new THREE.Mesh(flatExtrude(ss, 0.012, 0.004), brass);
    star.position.y = 0.026;
    star.castShadow = true;
    m.add(star);
    const eyeMat = new THREE.MeshStandardMaterial({
      map: T2(TX.eye.color),
      emissiveMap: T2(TX.eye.glow),
      emissive: 0xffffff,
      emissiveIntensity: 0.12,
      roughness: 0.35,
      metalness: 0.2,
      envMapIntensity: 0.8
    });
    BK.eyeMat = eyeMat;
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.215, 40), eyeMat);
    eye.rotation.x = -PI / 2;
    eye.position.y = 0.048;
    m.add(eye);
    BK.eye = eye;
    const er = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.012, 8, 40), brass);
    er.rotation.x = PI / 2;
    er.position.y = 0.048;
    m.add(er);
    BK.gems = [];
    for (let i = 0; i < 8; i++) {
      const a = (i * PI) / 4;
      const gm = new THREE.MeshStandardMaterial({
        color: i % 2 ? 0x8a1020 : 0x1a6a80,
        emissive: i % 2 ? 0x500010 : 0x0a4050,
        emissiveIntensity: 0.5,
        roughness: 0.15,
        metalness: 0.1,
        envMapIntensity: 1.6
      });
      const g2 = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), gm);
      g2.position.set(Math.cos(a) * 0.385, 0.052, Math.sin(a) * 0.385);
      g2.scale.y = 0.7;
      m.add(g2);
      BK.gems.push(gm);
    }
  }
  {
    const sp = new THREE.Group();
    sp.position.set(WC + 0.004, T * 0.5, 0);
    cg.add(sp);
    BK.strap = sp;
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.29, 0.15), leatherMat(TX.tile, [1, 1], 0x806050, 0.75));
    strap.position.y = -0.145;
    strap.castShadow = true;
    sp.add(strap);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.17), brass);
    plate.position.y = -0.27;
    plate.castShadow = true;
    sp.add(plate);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.17), brass);
    top.position.y = -0.01;
    sp.add(top);
    for (const z of [-0.055, 0.055]) {
      const r = new THREE.Mesh(rivetG, brass);
      r.position.set(0.012, -0.27, z);
      sp.add(r);
    }
    const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 10), brass);
    stud.rotation.z = PI / 2;
    stud.position.set(WC + 0.016, 0.03, 0);
    root.add(stud);
  }
  const edgeBase = T2(TX.edge, { rep: [1, 1] });
  function blockMesh(): THREE.Mesh {
    const t = edgeBase.clone();
    ownedTextures.push(t);
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ map: t }));
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    return m;
  }
  BK.bR = blockMesh();
  BK.bL = blockMesh();
  const NX = 14;
  const NZ = 3;
  const zs: number[] = [];
  for (let j = 0; j <= NZ; j++) zs.push(-H / 2 + (H * j) / NZ);
  function leafGeo(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array((NX + 1) * (NZ + 1) * 3);
    const uv = new Float32Array((NX + 1) * (NZ + 1) * 2);
    const idx: number[] = [];
    for (let j = 0; j <= NZ; j++) {
      for (let i = 0; i <= NX; i++) {
        const k = j * (NX + 1) + i;
        uv[k * 2] = i / NX;
        uv[k * 2 + 1] = 1 - j / NZ;
      }
    }
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const a = j * (NX + 1) + i;
        const b = a + 1;
        const c = a + NX + 1;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }
  const leaves: BookFace[] = [];
  BK.leaves = leaves;
  BK.pageTex = [];
  for (let j = 0; j < N; j++) {
    const geo = leafGeo();
    const tf = T2(PG[2 * j]);
    const tb = T2(PG[2 * j + 1]);
    tb.repeat.x = -1;
    tb.offset.x = 1;
    BK.pageTex[2 * j] = tf;
    BK.pageTex[2 * j + 1] = tb;
    const fm = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tf }));
    const bm = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tb, side: THREE.BackSide }));
    fm.castShadow = true;
    root.add(fm, bm);
    leaves.push({ geo, fm, bm, p: 0, shapeP: -9, y: 0 });
  }
  const BEND = 1.05;
  function poseLeaf(L: BookFace): void {
    const pos = L.geo.attributes.position.array as Float32Array;
    const ds = W / NX;
    const ang = L.p * PI;
    const b = BEND * Math.sin(L.p * PI);
    let x = 0;
    let y = 0;
    for (let i = 0; i <= NX; i++) {
      if (i > 0) {
        const s = (i - 0.5) / NX;
        const th = ang - b * Math.pow(s, 1.15);
        x += Math.cos(th) * ds;
        y += Math.sin(th) * ds;
      }
      for (let j = 0; j <= NZ; j++) {
        const k = (j * (NX + 1) + i) * 3;
        pos[k] = x;
        pos[k + 1] = y;
        pos[k + 2] = zs[j];
      }
    }
    L.geo.attributes.position.needsUpdate = true;
    L.geo.computeVertexNormals();
    L.geo.computeBoundingSphere();
    L.shapeP = L.p;
  }
  function layout(): void {
    const sufR = new Array(N + 1).fill(0);
    const preL = new Array(N).fill(0);
    let a = 0;
    for (let j = N - 1; j >= 0; j--) {
      a += 1 - leaves[j].p;
      sufR[j] = a;
    }
    a = 0;
    for (let j = 0; j < N; j++) {
      a += leaves[j].p;
      preL[j] = a;
    }
    for (let j = 0; j < N; j++) {
      const L = leaves[j];
      if (Math.abs(L.p - L.shapeP) > 1e-4) poseLeaf(L);
      const yR = T + GAP * sufR[j];
      const yL = T + GAP * preL[j];
      L.y = lerp(yR, yL, L.p) + Math.sin(L.p * PI) * 0.015 - 0.0006;
      L.fm.position.y = L.bm.position.y = L.y;
    }
    const hR = Math.max(0, GAP * sufR[0] - GAP * 0.6);
    const hL = Math.max(0, GAP * preL[N - 1] - GAP * 0.6);
    const setB = (m: THREE.Mesh, h: number, x: number): void => {
      m.visible = h > 0.004;
      m.scale.set(W - 0.014, Math.max(h, 0.0001), H - 0.006);
      m.position.set(x, T + h / 2, 0);
      const t = (m.material as THREE.MeshStandardMaterial).map!;
      t.repeat.set(1, Math.max(0.02, h * 7));
    };
    setB(BK.bR, hR, (W - 0.014) / 2 + 0.012);
    setB(BK.bL, hL, -((W - 0.014) / 2 + 0.012));
  }
  for (const L of leaves) poseLeaf(L);
  layout();

  /* ---- objetos magicos ---- */
  const waxMat = new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.55, emissive: 0x3a2210, emissiveIntensity: 0.5 });
  const candle = new THREE.Group();
  candle.position.set(-2.75, 0, -1.5);
  scene.add(candle);
  {
    const prof = [
      [0, 0],
      [0.34, 0],
      [0.35, 0.025],
      [0.3, 0.055],
      [0.14, 0.085],
      [0.1, 0.16],
      [0.15, 0.21],
      [0.19, 0.235],
      [0.09, 0.25]
    ].map((p) => new THREE.Vector2(p[0], p[1]));
    const hold = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), brass);
    hold.castShadow = true;
    candle.add(hold);
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.1, 0.6, 18), waxMat);
    wax.position.y = 0.55;
    wax.castShadow = true;
    candle.add(wax);
    for (const d of [
      [0.4, 0.14, 0.026],
      [2.2, 0.2, 0.02],
      [4.1, 0.1, 0.022]
    ]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(d[2], 8, 6), waxMat);
      m.scale.y = 2.6;
      m.position.set(Math.cos(d[0]) * 0.097, 0.85 - d[1], Math.sin(d[0]) * 0.097);
      candle.add(m);
    }
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.088, 12, 6, 0, TAU, 0, PI / 2), waxMat);
    top.position.y = 0.85;
    top.scale.y = 0.45;
    candle.add(top);
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.07, 5), new THREE.MeshBasicMaterial({ color: 0x120a05 }));
    wick.position.y = 0.9;
    candle.add(wick);
  }
  const flame = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: TX.flame, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
  );
  flame.scale.set(0.2, 0.34, 1);
  flame.position.set(0, 1.06, 0);
  candle.add(flame);
  candleL.position.set(-2.75, 1.15, -1.5);

  const crystal = new THREE.Group();
  crystal.position.set(2.7, 0, -1.4);
  scene.add(crystal);
  const cMat = new THREE.MeshStandardMaterial({
    color: 0x8f66ff,
    emissive: 0x5b3cff,
    emissiveIntensity: 0.9,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.9,
    envMapIntensity: 1.7
  });
  const cMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), cMat);
  cMesh.scale.set(1, 1.9, 1);
  cMesh.position.y = 1.05;
  cMesh.castShadow = true;
  crystal.add(cMesh);
  const cGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: TX.glow, color: 0x8f66ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })
  );
  cGlow.scale.set(1.5, 1.5, 1);
  cGlow.position.y = 1.05;
  crystal.add(cGlow);
  {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.08, 20), brass);
    b.position.y = 0.04;
    b.castShadow = true;
    crystal.add(b);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.5, 10), brassDark);
    st.position.y = 0.3;
    crystal.add(st);
  }
  const cRings = [0, 1].map((i) => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.46 + i * 0.1, 0.008, 6, 48), brass);
    r.position.y = 1.05;
    crystal.add(r);
    return r;
  });
  crystalL.position.set(2.7, 1.25, -1.4);

  const ink = new THREE.Group();
  ink.position.set(2.45, 0, 1.5);
  scene.add(ink);
  const quill = new THREE.Group();
  {
    const prof = [
      [0, 0],
      [0.15, 0],
      [0.17, 0.02],
      [0.17, 0.16],
      [0.12, 0.22],
      [0.08, 0.25],
      [0.085, 0.29],
      [0.1, 0.3]
    ].map((p) => new THREE.Vector2(p[0], p[1]));
    const gl = new THREE.Mesh(
      new THREE.LatheGeometry(prof, 22),
      new THREE.MeshStandardMaterial({ color: 0x182030, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.86, envMapIntensity: 1.8 })
    );
    gl.castShadow = true;
    ink.add(gl);
    const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.14, 18), new THREE.MeshStandardMaterial({ color: 0x05040a, roughness: 0.1, metalness: 0.3 }));
    liq.position.y = 0.1;
    ink.add(liq);
    quill.position.set(0, 0.3, 0);
    ink.add(quill);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.011, 1.05, 6), new THREE.MeshStandardMaterial({ color: 0xe8e0cc, roughness: 0.6 }));
    sh.position.y = 0.52;
    quill.add(sh);
    const vane = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xefeadc, roughness: 0.9 }));
    vane.scale.set(0.85, 4.6, 0.16);
    vane.position.set(0.03, 0.68, 0);
    quill.add(vane);
    quill.rotation.set(0.1, 0.4, -0.95);
  }

  function miniBook(w: number, h: number, t: number, tint: number, rotY: number, x: number, y: number, z: number): THREE.Group {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    inner.position.x = -w / 2;
    g.add(inner);
    const m = leatherMat(TX.tile, [2, 3], tint, 0.7);
    const bm = new THREE.MeshStandardMaterial({ map: T2(TX.edge), roughness: 0.9, envMapIntensity: 0.2 });
    const a = new THREE.Mesh(makeBoard(w, h, 0.03, 0.008, 0.04), [m, m]);
    const b = new THREE.Mesh(makeBoard(w, h, 0.03, 0.008, 0.04), [m, m]);
    b.position.y = t - 0.03;
    a.castShadow = b.castShadow = true;
    a.receiveShadow = b.receiveShadow = true;
    const blk = new THREE.Mesh(new THREE.BoxGeometry(w - 0.05, t - 0.06, h - 0.03), bm);
    blk.position.set(w / 2 + 0.012, t / 2, 0);
    blk.castShadow = true;
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(t / 2, t / 2, h - 0.02, 14, 1, true, PI, PI).rotateX(PI / 2), m);
    sp.position.set(0, t / 2, 0);
    m.side = THREE.DoubleSide;
    const band = new THREE.Mesh(new THREE.TorusGeometry(t / 2 + 0.004, 0.012, 6, 14, PI), brassDark);
    band.rotation.z = PI / 2;
    band.position.set(0, t / 2, 0);
    inner.add(a, b, blk, sp, band);
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    scene.add(g);
    return g;
  }
  miniBook(1.25, 1.7, 0.3, 0x6a3a3a, 0.35, -3.3, 0, 1.25);
  miniBook(1.05, 1.45, 0.22, 0x2e4a5a, -0.2, -3.25, 0.3, 1.2);

  /* ---- particulas ---- */
  const dr = RNG(77);
  function mkPts(n: number, size: number) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size, map: TX.glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    p.frustumCulled = false;
    scene.add(p);
    return { p, pos, col, n, vel: new Float32Array(n * 3), c: new Float32Array(n * 3), g };
  }
  const dust = mkPts(Q.dust, 0.05);
  for (let i = 0; i < dust.pos.length / 3; i++) {
    dust.pos.set([dr.r(-7, 7), dr.r(0.1, 4.2), dr.r(-6, 5)], i * 3);
    dust.vel.set([dr.r(-0.02, 0.02), dr.r(0.005, 0.04), dr.r(-0.02, 0.02)], i * 3);
    const b = dr.r(0.25, 0.8);
    dust.col.set([b * 0.9, b * 0.75, b * 0.5], i * 3);
  }

  /* ---- camara orbital ---- */
  const cam: CamState = { yaw: 0, pitch: 0.95, dist: 6.4, tx: 0, ty: 0.18, tz: 0.15 };
  const cur: CamState = { yaw: 0, pitch: 0.95, dist: 9, tx: 0, ty: 0.18, tz: 0.15 };
  const CK: Array<keyof CamState> = ['yaw', 'pitch', 'dist', 'tx', 'ty', 'tz'];
  const vel = { yaw: 0, pitch: 0 };
  function fitDist(width: number, depth: number): number {
    const v = (camera.fov * PI) / 180;
    const asp = camera.aspect;
    const dw = (width * 1.1) / (2 * Math.tan(v / 2) * asp);
    const dh = (depth * 1.15) / (2 * Math.tan(v / 2));
    return Math.max(dw, dh);
  }
  function viewDefault(): void {
    const asp = camera.aspect;
    if (S.state === 'open' || S.state === 'opening') {
      cam.dist = asp < 0.9 ? fitDist(3.1, H * 0.82) : fitDist(3.5, H * 0.82);
      cam.pitch = asp < 0.9 ? 1.0 : 0.92;
      cam.tx = 0;
      cam.tz = 0.1;
    } else {
      cam.dist = asp < 0.9 ? fitDist(2.15, H * 0.9) : fitDist(2.3, H * 0.95);
      cam.pitch = 0.95;
      cam.tx = 0;
      cam.tz = 0.1;
    }
    cam.yaw = 0;
    cam.ty = 0.18;
  }
  function camApply(dt: number): void {
    const k = 1 - Math.exp(-dt * 7);
    if (Math.abs(vel.yaw) > 1e-4 || Math.abs(vel.pitch) > 1e-4) {
      cam.yaw += vel.yaw * dt;
      cam.pitch = clamp(cam.pitch + vel.pitch * dt, 0.2, 1.5);
      const d = Math.exp(-dt * 4.5);
      vel.yaw *= d;
      vel.pitch *= d;
    }
    for (const q of CK) cur[q] += (cam[q] - cur[q]) * k;
    const cp = Math.cos(cur.pitch);
    const sn = Math.sin(cur.pitch);
    camera.position.set(cur.tx + Math.sin(cur.yaw) * cp * cur.dist, cur.ty + sn * cur.dist, cur.tz + Math.cos(cur.yaw) * cp * cur.dist);
    camera.lookAt(cur.tx, cur.ty, cur.tz);
  }

  function applyOpen(co: number): void {
    const lock = sm(clamp(co / 0.22, 0, 1));
    const rot = sm(clamp((co - 0.16) / 0.84, 0, 1));
    BK.pivot.rotation.z = PI * rot;
    BK.strap.rotation.z = (lock * PI) / 2;
    root.position.x = lerp(-(WC - RS) / 2, 0, rot);
    root.position.y = Math.sin(PI * rot) * 0.035;
    BK.pivot.position.y = HS / 2;
  }

  /* ---- estado ambiental ---- */
  const S: { time: number; state: 'closed' | 'opening' | 'open'; co: number; coT: number; eyeT: number; flameOn: boolean } = { time: 0, state: 'closed', co: 0, coT: 0, eyeT: 0, flameOn: true };

  applyOpen(0);

  function updBook(dt: number): void {
    S.time += dt;
    // Apertura automatica unica: tras un breve instante el libro se abre solo
    // (sin interaccion). El velo del cierre inicial se funde en applyOpen y la
    // camara retrocede con el ease suave de camApply (viewDefault para 'opening').
    if (S.state === 'closed' && S.time >= OPEN_DELAY) {
      S.state = 'opening';
      S.coT = 1;
      bookL.userData.pulse = 1.2;
      viewDefault();
    }
    if (S.state === 'opening') {
      const rate = 1 / 2.6;
      S.co += clamp(S.coT - S.co, -rate * dt, rate * dt);
      if (Math.abs(S.co - S.coT) < 1e-4) {
        S.co = S.coT;
        S.state = 'open';
        options.onOpen?.();
      }
    }
    applyOpen(S.co);
    S.eyeT = Math.max(0, S.eyeT - dt * 0.25);
    const pulse = 0.12 + 0.1 * Math.sin(S.time * 1.6) + S.eyeT * 1.7;
    BK.eyeMat.emissiveIntensity = S.state === 'open' ? pulse : 0.14 + S.eyeT * 1.2;
    BK.gems.forEach((g, i) => {
      g.emissiveIntensity = 0.5 + 0.5 * Math.sin(S.time * 2 + i) * (0.3 + S.eyeT) + S.eyeT * 1.5;
    });
    const bp = bookL.userData.pulse || 0;
    bookL.userData.pulse = Math.max(0, bp - dt * 0.7);
    bookL.position.set(root.position.x, 1.1 + root.position.y, 0);
    bookL.intensity = 0.22 + bp * 2.2;
    layout();
  }
  function updProps(_dt: number): void {
    const t = S.time;
    const fl = 1 + 0.14 * Math.sin(t * 11) + 0.09 * Math.sin(t * 23 + 1.3) + 0.05 * Math.sin(t * 37);
    if (S.flameOn) {
      flame.visible = true;
      flame.scale.set(0.19 * (1 + 0.1 * Math.sin(t * 9)), 0.33 * fl, 1);
      candleL.intensity += (1.7 * fl - candleL.intensity) * 0.4;
      waxMat.emissiveIntensity = 0.5;
    } else {
      flame.visible = false;
      candleL.intensity += (0 - candleL.intensity) * 0.12;
      waxMat.emissiveIntensity = 0.08;
    }
    cMesh.position.y = 1.05 + Math.sin(t * 1.2) * 0.05;
    cGlow.position.y = cMesh.position.y;
    cMesh.rotation.y = t * 0.5;
    cRings[0].rotation.set(t * 0.7, t * 0.3, 0);
    cRings[1].rotation.set(PI / 2 + t * 0.4, 0, t * 0.6);
    cRings.forEach((r) => (r.position.y = cMesh.position.y));
    cMat.emissiveIntensity = 0.8 + 0.3 * Math.sin(t * 2);
    cGlow.material.opacity = 0.6 + 0.2 * Math.sin(t * 2);
    crystalL.position.y = cMesh.position.y + 0.2;
    sigilMat.opacity = 0.42 + 0.14 * Math.sin(t * 0.8);
    sigil.rotation.z = t * 0.02;
  }
  function updParticles(dt: number): void {
    const d = dust;
    for (let i = 0; i < d.pos.length / 3; i++) {
      const k = i * 3;
      d.pos[k] += d.vel[k] * dt + Math.sin(S.time * 0.3 + i) * 0.002;
      d.pos[k + 1] += d.vel[k + 1] * dt;
      d.pos[k + 2] += d.vel[k + 2] * dt;
      if (d.pos[k + 1] > 4.4) {
        d.pos[k + 1] = 0.1;
        d.pos[k] = dr.r(-7, 7);
        d.pos[k + 2] = dr.r(-6, 5);
      }
    }
    d.g.attributes.position.needsUpdate = true;
    d.g.attributes.color.needsUpdate = true;
  }

  function update(dt: number): void {
    dt = Math.min(dt, 0.05);
    updBook(dt);
    updProps(dt);
    updParticles(dt);
    camApply(dt);
  }
  function resize(width: number, height: number): void {
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    viewDefault();
    for (const q of CK) cur[q] = cam[q];
  }
  function dispose(): void {
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    const texs = new Set<THREE.Texture>();
    scene.traverse((o) => {
      const obj = o as THREE.Mesh & THREE.Points;
      if (obj.geometry) geos.add(obj.geometry as THREE.BufferGeometry);
      if (obj.material) {
        const mm = obj.material;
        (Array.isArray(mm) ? mm : [mm]).forEach((m) => mats.add(m));
      }
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => {
      const rec = m as unknown as Record<string, unknown>;
      for (const k of ['map', 'normalMap', 'emissiveMap', 'lightMap', 'aoMap', 'bumpMap', 'roughnessMap', 'metalnessMap', 'alphaMap']) {
        const t = rec[k];
        if (t instanceof THREE.Texture) texs.add(t);
      }
      m.dispose();
    });
    for (const t of ownedTextures) texs.add(t);
    texs.forEach((t) => t.dispose());
    scene.clear();
  }

  viewDefault();
  cur.dist = cam.dist * 1.5;

  return { scene, camera, update, resize, dispose };
}