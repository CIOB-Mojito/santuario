# Auditoría de assets — Santuario Primordio

Fecha: 2026-10-12. Generada a partir del estado real del repositorio
(`git rev-parse HEAD`), no de supuestos.

## Proyecto

- Motor: three.js 0.186 (+ Vite 8, TypeScript 5.9 estricto). *Nota: o.txt
  indica Babylon.js; pendiente de decisión, ver README.*
- Estructura: `src/core`, `src/assets`, `src/streaming`, `src/world`,
  `src/lighting`, `src/effects`, `src/interaction`, `src/audio`,
  `src/player`, `src/narrative`, `src/ui`, `src/debug`, `src/config`.
- `public/assets/`: árbol real de assets (ver abajo).

## Inventario

### EXISTENTE Y FUNCIONAL (descargados, en el árbol, md5 verificado donde aplica)

| id | tipo | archivo | tamaño | licencia |
|---|---|---|---|---|
| stone_wall_slates | textura PBR | public/assets/textures/stone_wall_slates/ | ~2.1 MB | CC0 |
| floor_cobblestone | textura PBR | public/assets/textures/floor_cobblestone/ | ~1.9 MB | CC0 |
| wood_dark_planks | textura PBR | public/assets/textures/wood_dark_planks/ | ~2.0 MB | CC0 |
| plaster_wall | textura PBR | public/assets/textures/plaster_wall/ | ~1.5 MB | CC0 |
| marble_012 | textura PBR | public/assets/textures/marble_012/ | ~4.6 MB | CC0 |
| metal_gold_base | textura PBR | public/assets/textures/metal_gold_base/ | ~2.5 MB | CC0 |
| sky_citrus | HDRI | public/assets/sky/sky_citrus/ | ~1.2 MB | CC0 |
| character.huesped | GLB | public/assets/characters/Huesped.glb | 0.98 MB | (colaborador) |
| character.huesped.v2 | GLB | public/assets/characters/Huesped-v2.glb | 5.5 MB | (colaborador) |

Las 6 texturas PBR están **integradas**: se aplican a los materiales de la nave
(muros, suelo, madera, yeso, mármol, oro) al arrancar y el HDRI alimenta la
iluminación ambiental (`scene.environment`). Verificación: `npm run build` ok;
en navegador pendiente (sin binario local).

### EXISTENTE PERO NO IMPLEMENTADO

- Ninguno documentado hasta el momento.

### PLACEHOLDER

- Geometría de la nave (muros, columnas, altar, techo, esculturas de cilindro):
  volumetría modular provisional, **con** materiales PBR reales ya asignados.
- Cielo procedural (gradiente + sol): intencional y adaptado (no skybox bruto).
- Partículas de polvo: efecto autoral, no relleno.

### DESCARGA PENDIENTE

- Escultura funeraria / ángel CC0 de calidad (protagonista).
- Props ornamentales (velas, relicarios, candelabros, lápidas).
- Audio ambiental con licencia verificada.
- Modelos de arquitectura complementaria (arcos, nervaduras, frisos).

### LICENCIA PENDIENTE DE VERIFICACIÓN

- Sketchfab (Jim Wing "Stone Angel Statue" y similares): requiere cuenta de
  autorización; **bloqueado** hasta confirmar licencia y descarga.
- Fab (Gothic Cathedral Environment): requiere cuenta/login; no se puede
  verificar ni descargar sin autenticación.

### INCOMPATIBLE

- (vacío por el momento).

### DESCARTADO, CON MOTIVO

- ejemplos de HDRI de Poly Haven de media/caída de luz (no encajan con la
  dirección artística de verano luminoso).

## Errores y bloqueos

- ambientCG: la búsqueda por id (`q=Marble012`) no devuelve resultados (busca
  por nombre legible); resuelto usando la URL directa estable
  `https://ambientcg.com/get?file=<Id>_<res>-JPG.zip`.
- Sketchfab y Fab exigen autenticación humana: sin API de descarga inventada,
  se registra el bloqueo (sec. 22).
- No hay navegador headless en el entorno: la verificación visual final y la
  prueba FASE 11 quedan pendientes de abrir la URL en Chrome Android.

## Próximas acciones

1. Decidir motor (three.js actual vs Babylon.js según o.txt).
2. Conseguir escultura/ángel CC0 y objetos ornamentales.
3. Verificación visual en el dispositivo y ajustes de calidad.