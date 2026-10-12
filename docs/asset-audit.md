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
| statue.marble | GLB | public/assets/statues/marble_statue.glb | 0.58 MB (16.987 tris) | CC0 |
| statue.effigy | GLB | public/assets/statues/knight_effigy.glb | 0.48 MB (6.238 tris) | CC0 |
| props.mausoleum | GLB | public/assets/props/mausoleum.glb | 0.13 MB | CC0 |
| props.tomb | GLB | public/assets/props/tomb.glb | 9.5 KB | CC0 |
| props.candles | GLB | public/assets/props/candles.glb | 10.6 KB | CC0 |
| props.grave.1..6 | GLB | public/assets/props/grave_1..6.glb | 1.8–3.8 KB | CC0 |

Los modelos se descargan de OpenGameArt (CC0), se convierten a GLB con
`libassimp.so` vía `tools/convert-model.py` y se optimizan con
`gltf-transform` (la estatua pasa de 66 MB / 425k tris a 0.58 MB / 17k tris).
Se colocan desde `src/world/placements.ts` y sustituyen las esculturas y velas
provisionales.

Las 6 texturas PBR están **integradas**: se aplican a los materiales de la nave
(muros, suelo, madera, yeso, mármol, oro) al arrancar y el HDRI alimenta la
iluminación ambiental (`scene.environment`). Verificación: `npm run check` ok
(typecheck + build + smoke); en navegador pendiente (sin binario local).

### EXISTENTE PERO NO IMPLEMENTADO

- Ninguno documentado hasta el momento.

### PLACEHOLDER

- Geometría de la nave (muros, columnas, altar, techo): volumetría modular
  provisional, **con** materiales PBR reales ya asignados. Las esculturas y
  velas provisionales ya fueron sustituidas por modelos reales CC0.
- Cielo procedural (gradiente + sol): intencional y adaptado (no skybox bruto).
- Partículas de polvo: efecto autoral, no relleno.

### DESCARGA PENDIENTE

- Ángel funerario de mayor calidad (protagonista) que el caballero yacente.
- Props ornamentales adicionales (relicarios, incensarios).
- Audio ambiental con licencia verificada.
- Modelos de arquitectura complementaria (arcos, nervaduras, frisos).

### LICENCIA PENDIENTE DE VERIFICACIÓN

- Sketchfab (Jim Wing "Stone Angel Statue" y similares): requiere cuenta de
  autorización; **bloqueado** hasta confirmar licencia y descarga.
- Fab (Gothic Cathedral Environment): requiere cuenta/login; no se puede
  verificar ni descargar sin autenticación.
- Smithsonian 3D: HTTP 403 desde este entorno (probable filtrado de red); se
  intentó con User-Agent de navegador sin éxito.

### INCOMPATIBLE

- (vacío por el momento).

### DESCARTADO, CON MOTIVO

- ejemplos de HDRI de Poly Haven de media/caída de luz (no encajan con la
  dirección artística de verano luminoso).
- `sgangel.obj` (angel OGA): licencia CC-BY 3.0 y geometría de baja calidad;
  se prefiere CC0 con mejor acabado (yacente + estatua).

## Errores y bloqueos

- ambientCG: la búsqueda por id (`q=Marble012`) no devuelve resultados (busca
  por nombre legible); resuelto usando la URL directa estable
  `https://ambientcg.com/get?file=<Id>_<res>-JPG.zip`.
- `assimp` en Termux instala sólo `libassimp.so` (sin CLI); resuelto con
  `tools/convert-model.py` (ctypes) que invoca el C API directamente.
- `gltf-transform` falla en android-arm64 por `sharp`; resuelto instalando
  `@img/sharp-wasm32`.
- El DAE de la estatua (`statue.dae`) dio «malformed XML» en assimp; resuelto
  convirtiendo el `.blend` fuente.
- Sketchfab, Fab y Smithsonian exigen autenticación / están filtrados: sin API
  de descarga inventada, se registra el bloqueo (sec. 22).
- No hay navegador headless en el entorno: la verificación visual final y la
  prueba FASE 11 quedan pendientes de abrir la URL en Chrome Android.

## Próximas acciones

1. Conseguir un ángel funerario de calidad (fuentes accesibles) si se desea.
2. Verificación visual en el dispositivo y ajustes de calidad/exposición.
3. Ampliar props y arquitectura; completar audio.