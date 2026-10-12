# Santuario

Motor de un santuario 3D cinematográfico interactivo, pensado **mobile-first** (Android). El objetivo no es una escena, es un **sistema modular**: hoy todo se ve con placeholders simples, pero la arquitectura está preparada para absorber assets de alta calidad (streaming, LOD, instancing, presupuesto de memoria) sin rehacer el motor.

> Estado: **Fase 1 completa** — arquitectura base + renderer + primera escena.

## Requisitos

- Node.js 20 o superior.

## Cómo correrlo

```bash
npm install
npm run dev            # http://localhost:8080
```

Abrí esa dirección en el navegador (o desde el mismo teléfono). El servidor recompila al guardar.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga. |
| `npm run build` | Genera el bundle de producción en `dist/`. |
| `npm run typecheck` | Chequeo de tipos estricto (`tsc --noEmit`). |
| `npm run smoke` | Prueba de humo sin WebGL: construye, actualiza y libera la escena. |
| `npm run check` | `typecheck` + `smoke` + `build`. Es lo que conviene correr antes de subir. |

## Controles

- **Arrastrar** (mouse o un dedo): orbita la cámara.
- **Pellizcar** o **rueda**: acerca y aleja.
- **Flechas** y **+ / -**: mismo control por teclado.
- Botón **panel** (arriba a la izquierda): muestra FPS, frame time, draw calls, triángulos, memoria y la zona actual. Desde ahí también se cambia la calidad a mano (`LOW`, `MEDIUM`, `HIGH`, `ULTRA`).

## Arquitectura

```
src/
├── main.ts                 Arranque, detección de WebGL y manejo de errores.
├── config/
│   └── quality.ts          Perfiles LOW/MEDIUM/HIGH/ULTRA y sondeo del equipo.
├── core/
│   ├── Engine.ts           Orquestador: posee los subsistemas y los actualiza.
│   ├── Renderer.ts         Envuelve WebGLRenderer. No conoce el mundo.
│   ├── Ticker.ts           Bucle RAF con dt clampeado y métricas de frame.
│   └── CameraRig.ts        Cámara orbital con ratón, táctil y teclado.
├── scene/
│   ├── World.ts            Construye la escena y declara las zonas.
│   ├── placeholders.ts     Builders provisorios + convención PLACEHOLDER_*.
│   └── Lighting.ts         Luz placeholder (sol, cielo, altar).
└── ui/
    └── Hud.ts              Panel de debug y selector de calidad.
```

Principios que ya respeta el código:

- **Separación estricta**: el renderer no construye geometría; el mundo no decide cámara ni calidad. Eso es lo que permite crecer por fases.
- **Interfaces mínimas** y TypeScript estricto (sin `any`).
- **Placeholders con contrato**: cada uno lleva `userData.kind`, `interactive` y un `socket`, para que reemplazarlos por un asset real no rompa nada.
- **Sin dependencias innecesarias**: sólo `three`. El build es `esbuild`.

## Convención de placeholders

Los objetos provisorios se nombran y etiquetan así:

```
PLACEHOLDER_ANGEL      PLACEHOLDER_ALTAR      PLACEHOLDER_RELIC
PLACEHOLDER_DOOR       PLACEHOLDER_CHARACTER  PLACEHOLDER_TOWER
PLACEHOLDER_COLUMN     PLACEHOLDER_CANDLE
```

Un asset final que los reemplace debe conservar el mismo `userData.kind` y los mismos sockets.

## Zonas del mundo

`nave`, `altar`, `capilla_norte`, `torre` (y en fases siguientes: `capilla_sur`, `cripta`, `jardin`, `subterraneo`).

## Roadmap por fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Arquitectura base + renderer + primera escena | ✅ |
| 2 | Asset Registry + streaming | pendiente |
| 3 | Memory Manager | pendiente |
| 4 | LOD + instancing + culling | pendiente |
| 5 | World partitioning | pendiente |
| 6 | Sistema de altares | pendiente |
| 7 | Sistema narrativo | pendiente |
| 8 | Audio | pendiente |
| 9 | Iluminación | pendiente |
| 10 | Assets prerenderizados / híbridos | pendiente |
| 11 | Calidad adaptativa | pendiente |
| 12 | Pruebas de estrés | pendiente |
| 13 | Optimización móvil | pendiente |
| 14 | Pulido | pendiente |

Después de cada fase: se ejecuta, se corrigen errores, se evalúa rendimiento y recién entonces se pasa a la siguiente.

## Limitaciones conocidas (honestas)

- El cambio de **antialias** no se aplica en caliente: `three` lo fija al crear el renderer, así que un cambio de perfil extremo se ve del todo recién al recargar. El resto del perfil (resolución, sombras, niebla) sí se aplica al instante.
- La prueba visual en navegador no se puede automatizar en este entorno; `npm run smoke` valida la lógica del motor, no el dibujo.
- Todavía no hay streaming ni LOD: es la Fase 2 en adelante.
