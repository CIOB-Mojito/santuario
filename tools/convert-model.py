#!/usr/bin/env python3
"""Convierte modelos 3D a GLB usando el C API de libassimp.so via ctypes.

No hay CLI de assimp en Termux (solo la libreria), asi que la invocamos
directamente. Soporta entrada .blend/.obj/.dae/.fbx/.gltf/... y salida glb2.

Uso:
  python3 tools/convert-model.py entrada.ext salida.glb
  python3 tools/convert-model.py entrada.ext            # salida = entrada.glb
"""
import ctypes
import os
import sys

LIB = "/data/data/com.termux/files/usr/lib/libassimp.so"

AI_PROCESS_JOIN_IDENTICAL_VERTICES = 0x2
AI_PROCESS_TRIANGULATE = 0x8
AI_PROCESS_GEN_SMOOTH_NORMALS = 0x40
FLAGS = AI_PROCESS_JOIN_IDENTICAL_VERTICES | AI_PROCESS_TRIANGULATE | AI_PROCESS_GEN_SMOOTH_NORMALS

AI_SUCCESS = 0x0


def load_lib():
    lib = ctypes.CDLL(LIB)
    lib.aiImportFile.argtypes = [ctypes.c_char_p, ctypes.c_uint]
    lib.aiImportFile.restype = ctypes.c_void_p
    lib.aiExportScene.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_char_p, ctypes.c_uint]
    lib.aiExportScene.restype = ctypes.c_int
    lib.aiReleaseImport.argtypes = [ctypes.c_void_p]
    lib.aiReleaseImport.restype = None
    lib.aiGetErrorString.argtypes = []
    lib.aiGetErrorString.restype = ctypes.c_char_p
    return lib


def convert(src: str, dst: str, fmt: bytes = b"glb2") -> int:
    lib = load_lib()
    if not os.path.isfile(src):
        print(f"ERROR: no existe {src}", file=sys.stderr)
        return 2
    scene = lib.aiImportFile(src.encode("utf-8"), FLAGS)
    if not scene:
        err = lib.aiGetErrorString()
        print(f"ERROR importando {src}: {err.decode() if err else 'desconocido'}", file=sys.stderr)
        return 3
    rc = lib.aiExportScene(scene, fmt, dst.encode("utf-8"), 0)
    lib.aiReleaseImport(scene)
    if rc != AI_SUCCESS:
        print(f"ERROR exportando {dst}: codigo {rc}", file=sys.stderr)
        return 4
    return 0


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 1
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(src)[0] + ".glb"
    rc = convert(src, dst)
    if rc == 0:
        print(f"OK  {dst}  ({os.path.getsize(dst)} bytes)")
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
