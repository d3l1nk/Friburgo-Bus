"""Compatibilidade: workflows antigos chamam este nome. A lógica está em patch_android.py."""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import patch_android  # noqa: E402

if __name__ == "__main__":
    try:
        patch_android.main()
    except patch_android.PatchError as exc:
        print("ERRO: %s" % exc, file=sys.stderr)
        sys.exit(1)
