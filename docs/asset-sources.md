# Fuentes de assets — Santuario Primordio

Estado 2026-10-12. Solo se registra lo que se ha consultado de verdad.

## Poly Haven — https://polyhaven.com  (todas las texturas/HDRI son CC0, sin atribución)

| categoría | encontrado | seleccionado | estado |
|---|---|---|---|
| Texturas piedra/pizarra | decenas (castle_wall_slates, cobblestone_*, brick_*, …) | stone_wall_slates | descargada + integrada |
| Suelos | cobblestone_floor_01..13 y más | cobblestone_floor_08 | descargada + integrada |
| Madera | dark_wooden_planks, brown_planks_*, … | dark_wooden_planks | descargada + integrada |
| Yeso | clay_plaster, blue_plaster_* | clay_plaster | descargada + integrada |
| HDRI cielo | puresky/clear/midday varios | citrus_orchard_puresky | descargado + entorno |
| Mármol/Oro | no disponibles como textura en Poly Haven | — | pasar a ambientCG |

Verificación: API `api.polyhaven.com/assets` y `files` responden 200; las URL de
descarga se han comprobado y los md5 publicados coinciden con lo descargado.

## ambientCG — https://ambientcg.com  (CC0, sin atribución)

| categoría | encontrado | seleccionado | estado |
|---|---|---|---|
| Mármol | Marble006/012/016/021, Travertine009, … | Marble012 | descargado + integrado |
| Metal (base de oro tintada en material) | Metal007/034/042A/048A/B/C | Metal048A | descargado + integrado |
| Yeso/Plaster | Plaster001/002/007, PaintedPlaster017 | (cubierto por Poly Haven) | — |

Descarga por URL directa estable: `https://ambientcg.com/get?file=<Id>_1K-JPG.zip`.

## Sketchfab — https://sketchfab.com

- Candidatos localizados: "Stone Angel Statue / Cemetery Angel / Gothic Statue /
  Medieval Altar" (incl. el modelo de Jim Wing sugerido en o.txt).
- No descargado: requiere cuenta con autorización por parte del autor para
  descargas; no se puede verificar licencia ni descargar sin autenticación.
  **Bloqueo registrado** (sec. 22); alternativa: OpenGameArt / Smithsonian / CC
  Search.

## Smithsonian 3D — https://3d.si.edu

- Endpoint de paquete 3D consultado directamente dio 404 (requiere el UUID
  correcto del objet de colección). Pendiente de re-verificar con el catálogo.
  Prioridad: modelos con licencia CC0 confirmada.

## Fab — https://www.fab.com

- "Gothic Cathedral Environment" y "Dark Fantasy Gothic Cathedral Environment"
  identificados. Requieren cuenta/login y licencia por título; no se puede
  reutilizar sin compra/licencia explícita. **Bloqueado por autenticación.**

## OpenGameArt — https://opengameart.org  (accesible, HTTP 200)

Búsqueda por tipo "3D Art" (acceso sin autenticación). Candidatos revisados y
descargados (todos CC0):

| id | página | autor | archivo origen | formato | conversión |
|---|---|---|---|---|---|
| statue.effigy | /content/knight-lying | yd | knight_statue_lying.blend | blend | assimp→glb |
| statue.marble | /content/medieval-statue | Daniel Andersson (hreikin) | InnansorraStatueUpload.blend | blend | assimp→glb |
| props.candles | /content/medieval-candles | AnyRPG | medievalcandles.blend | blend | assimp→glb |
| props.tomb | /content/tomb | zerberros | tomb.blend | blend | assimp→glb |
| props.mausoleum | /content/mausoleum1 | Paul Wortmann | export_obj/mausoleum_1_001.obj | obj | assimp→glb |
| props.grave.1..6 | /content/cemetery | Savino | grave1..6.obj | obj | assimp→glb |

Pipeline reproducible (`assimp` no trae CLI en Termux; se usa `libassimp.so` vía
ctypes en `tools/convert-model.py`):

```bash
python3 tools/convert-model.py entrada.blend salida.glb   # conversión
npx gltf-transform optimize salida.glb final.glb --simplify true \
    --simplify-ratio 0.03 --texture-size 1024 --compress false
```

Resultados: estatua 66.4 MB → 581 KB (16.987 tris); yacente 1.03 MB → 477 KB
(6.238 tris); mausoleo 208 KB → 133 KB; props menores < 11 KB.

Pendiente (no descargable sin cuenta): un ángel funerario de mayor calidad
(Sketchfab/Fab). La alternativa CC0 ya integrada es el caballero yacente `yd` y
la estatua `Daniel Andersson`. Fuentes aún por rastrear: Smithsonian (403 desde
este entorno; requiere clave de API o User-Agent no bloqueado).

## Modelos aportados por el usuario (home)

El usuario dejó en el home cinco GLB (escaneos) para integrar. Se optimizaron
con `tools/optimize-glb.sh` (gltf-transform; decimado + texturas a 512 px):

| id | archivo origen (home) | tris | GLB final | notas |
|---|---|---|---|---|
| statue.angel_vcu | angel_for_linda_sizer_grave_vcu_3d_5697.glb | 33.951 | 1.19 MB | angel de sepultura |
| statue.angel_frances | cemetery_angel_-_frances.glb | 34.954 | 2.38 MB | angel de cementerio |
| statue.wooden_angel | wooden_angel_sculpture.glb | 27.761 | 1.76 MB | angel de madera |
| statue.monument_angel | angel_good_pics_only.glb | 66.066 | 3.97 MB | monumento grande |
| props.fountain_putti | fountain_with_three_putts_brno_luzanky.glb | 31.176 | 3.13 MB | fuente con putti |

**Licencia por verificar**: el usuario aportó los ficheros (parecen escaneos,
alguno de colecciones abiertas tipo VCU 3D), pero no se ha registrado aún la
página y licencia de origen de cada uno. Queda pendiente confirmarlo antes de
publicar. Se documenta en `docs/asset-license-report.md`.

## Audio — OpenGameArt (CC0)

| id | página | autor | archivo origen | formato |
|---|---|---|---|---|
| audio.wind_exterior | /content/wind-whoosh-loop | SketchMan3 | wind woosh loop.ogg | ogg |
| audio.interior | /content/loopable-dungeon-ambience | JaggedStone | dungeon_ambient_1_0.ogg | ogg |
| audio.candles | /content/fire-crackling | AntumDeluge | fire-1_0.ogg | ogg |

Se reproducen en bucle por capas en `AudioSystem` (viento exterior, drone de
interior y crepitar de velas), con ganancia interpolada segun la zona. Se
descartaron `wind-loop` y `background-rumble-noise` por ser CC-BY 3.0
(atribucion obligatoria) prefiriendo alternativas CC0.

## Criterio de selección (sec. 4 de o.txt)

Combinación de calidad visual, polígonos, texturas PBR, escala, licencia,
comercial permitido y rendimiento previsto en Android. No se elige algo solo por
ser gratuito.