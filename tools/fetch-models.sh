#!/usr/bin/env bash
# Descarga los modelos CC0 de OpenGameArt, los convierte a GLB (libassimp via
# tools/convert-model.py) y los optimiza (gltf-transform). Reproducible.
#
# Requisitos: bash, curl, unzip, python3, pkg 'assimp' (libassimp.so),
#             y @gltf-transform/cli + @img/sharp-wasm32 instalados (npm).
#
# Uso:  bash tools/fetch-models.sh [dir_trabajo]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="${1:-/data/data/com.termux/files/usr/tmp/opencode/oga}"
DEST="$ROOT/public/assets"
UA="Mozilla/5.0 (Linux; Android 15) Chrome/130.0 Mobile Safari/537.36"
B="https://opengameart.org/sites/default/files"
GT="$ROOT/node_modules/.bin/gltf-transform"
CONV="$ROOT/tools/convert-model.py"

mkdir -p "$STAGE" "$DEST/statues" "$DEST/props"

fetch() { # url archivo
  echo "  descargando $2"
  curl -s -A "$UA" -L --max-time 120 -o "$STAGE/$2" "$B/$1"
}

convert() { # entrada.glX salida.glb
  python3 "$CONV" "$1" "$2"
}

optimize() { # entrada.glb salida.glb [simplify_ratio]
  if [ -n "${3:-}" ]; then
    "$GT" optimize "$1" "$2" --simplify true --simplify-ratio "$3" \
      --simplify-error 0.001 --texture-size 1024 --compress false >/dev/null
  else
    "$GT" weld "$1" "$2" >/dev/null
  fi
}

echo "[1/3] Estatuas"
fetch "knight_statue_lying.blend" knight_lying.blend
convert "$STAGE/knight_lying.blend" "$STAGE/knight_lying.glb"
optimize "$STAGE/knight_lying.glb" "$DEST/statues/knight_effigy.glb"

fetch "75885_InnansorraStatueUpload_blend.zip" statue.zip
unzip -oq "$STAGE/statue.zip" -d "$STAGE/statue_ex"
convert "$STAGE/statue_ex/75885_InnansorraStatueUpload_blend/InnansorraStatueUpload.blend" "$STAGE/statue_src.glb"
optimize "$STAGE/statue_src.glb" "$DEST/statues/marble_statue.glb" 0.03

echo "[2/3] Props"
fetch "medievalcandles.blend" candles.blend
convert "$STAGE/candles.blend" "$STAGE/candles.glb"
optimize "$STAGE/candles.glb" "$DEST/props/candles.glb"

fetch "tomb.blend" tomb.blend
convert "$STAGE/tomb.blend" "$STAGE/tomb.glb"
optimize "$STAGE/tomb.glb" "$DEST/props/tomb.glb"

fetch "mausoleum_1.zip" mausoleum.zip
unzip -oq "$STAGE/mausoleum.zip" -d "$STAGE/maus_ex"
convert "$STAGE/maus_ex/mausoleum_1/export_obj/mausoleum_1_001.obj" "$STAGE/mausoleum_src.glb"
optimize "$STAGE/mausoleum_src.glb" "$DEST/props/mausoleum.glb"

echo "[3/3] Lapidas"
fetch "cemetery.zip" cemetery.zip
unzip -oq "$STAGE/cemetery.zip" -d "$STAGE/cemetery_ex"
for i in 1 2 3 4 5 6; do
  convert "$STAGE/cemetery_ex/grave$i.obj" "$STAGE/grave_$i.glb"
  optimize "$STAGE/grave_$i.glb" "$DEST/props/grave_$i.glb"
done

echo "Listo. Modelos en $DEST"
