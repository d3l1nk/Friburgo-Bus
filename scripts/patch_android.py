"""Prepara o projeto Android gerado pelo Capacitor (`npx cap add android`).

Idempotente (pode rodar várias vezes sem duplicar nada) e fail-fast (se um trecho esperado
não existir, termina com erro claro em vez de seguir com um projeto meio configurado):

- permissões e `usesCleartextTraffic` no AndroidManifest.xml
- ícones do app (resources/android/res -> android/app/src/main/res)
- versionName / versionCode no android/app/build.gradle
"""

from __future__ import annotations

import json
import os
import pathlib
import re
import shutil
import sys
import xml.etree.ElementTree as ET

ANDROID_NS = "{http://schemas.android.com/apk/res/android}"

PERMISSIONS = [
    "android.permission.INTERNET",
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.SCHEDULE_EXACT_ALARM",
    "android.permission.VIBRATE",
    "android.permission.RECEIVE_BOOT_COMPLETED",
]
DENSITIES = ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]
ICON_FILES = ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"]
LEGACY_ICON_FILES = ["drawable-v24/ic_launcher_foreground.xml", "drawable/ic_launcher_background.xml"]


class PatchError(Exception):
    """Falha esperada de configuração: mensagem pensada para quem lê o log do CI."""


# ---------------------------------------------------------------------------
# AndroidManifest.xml
# ---------------------------------------------------------------------------
def patch_manifest(xml: str) -> str:
    if "</manifest>" not in xml:
        raise PatchError("AndroidManifest.xml sem a tag </manifest>: arquivo inesperado.")
    if not re.search(r"<application\b", xml):
        raise PatchError("AndroidManifest.xml sem a tag <application>: arquivo inesperado.")

    for perm in PERMISSIONS:
        if not re.search(r'android:name="%s"' % re.escape(perm), xml):
            xml = xml.replace(
                "</manifest>",
                '    <uses-permission android:name="%s" />\n</manifest>' % perm,
                1,
            )

    if "android:usesCleartextTraffic" in xml:
        xml = re.sub(r'android:usesCleartextTraffic="[^"]*"', 'android:usesCleartextTraffic="true"', xml)
    else:
        xml = re.sub(r"<application\b", '<application\n        android:usesCleartextTraffic="true"', xml, count=1)

    verify_manifest(xml)
    return xml


def verify_manifest(xml: str) -> None:
    """Confere o resultado: XML válido, permissões presentes e cleartext ligado."""
    try:
        root = ET.fromstring(xml.encode("utf-8"))
    except ET.ParseError as exc:
        raise PatchError("AndroidManifest.xml inválido após o patch: %s" % exc) from exc
    declared = [el.attrib.get(ANDROID_NS + "name") for el in root.iter("uses-permission")]
    missing = [p for p in PERMISSIONS if p not in declared]
    if missing:
        raise PatchError("Permissões ausentes após o patch: %s" % ", ".join(missing))
    app = root.find("application")
    if app is None or app.attrib.get(ANDROID_NS + "usesCleartextTraffic") != "true":
        raise PatchError("usesCleartextTraffic não ficou como true em <application>.")


# ---------------------------------------------------------------------------
# build.gradle
# ---------------------------------------------------------------------------
def patch_gradle(text: str, version: str, code: int) -> str:
    text, n_code = re.subn(r"versionCode\s+\d+", "versionCode %d" % code, text)
    if n_code == 0:
        raise PatchError("versionCode não encontrado em android/app/build.gradle.")
    text, n_name = re.subn(r'versionName\s+"[^"]*"', 'versionName "%s"' % version, text)
    if n_name == 0:
        raise PatchError("versionName não encontrado em android/app/build.gradle.")
    return text


# ---------------------------------------------------------------------------
# Ícones
# ---------------------------------------------------------------------------
def apply_icons(src: pathlib.Path, dst: pathlib.Path) -> None:
    if not src.is_dir():
        raise PatchError("Pasta de ícones ausente: %s (não apague a pasta resources/)." % src)
    for density in DENSITIES:
        for name in ICON_FILES:
            if not (src / ("mipmap-%s" % density) / name).is_file():
                raise PatchError("Ícone ausente em %s: mipmap-%s/%s" % (src, density, name))
    shutil.copytree(src, dst, dirs_exist_ok=True)
    for legacy in LEGACY_ICON_FILES:
        path = dst / legacy
        if path.exists():
            path.unlink()


# ---------------------------------------------------------------------------
# Orquestração
# ---------------------------------------------------------------------------
def read_version(root: pathlib.Path) -> str:
    pkg = root / "package.json"
    if not pkg.is_file():
        raise PatchError("package.json não encontrado em %s." % root)
    version = json.loads(pkg.read_text(encoding="utf-8")).get("version")
    if not isinstance(version, str) or not version:
        raise PatchError("package.json sem o campo 'version'.")
    return version


def read_version_code(env: dict[str, str]) -> int:
    raw = env.get("GITHUB_RUN_NUMBER", "1")
    if not raw.isdigit() or int(raw) < 1:
        raise PatchError("GITHUB_RUN_NUMBER inválido: %r (esperado inteiro >= 1)." % raw)
    return int(raw)


def main(root: str | os.PathLike[str] = ".", env: dict[str, str] | None = None) -> None:
    base = pathlib.Path(root)
    env = dict(os.environ) if env is None else env

    manifest = base / "android/app/src/main/AndroidManifest.xml"
    if not manifest.is_file():
        raise PatchError("%s não encontrado. Rode 'npx cap add android' antes." % manifest)
    gradle = base / "android/app/build.gradle"
    if not gradle.is_file():
        raise PatchError("%s não encontrado." % gradle)

    version = read_version(base)
    code = read_version_code(env)

    # calcula tudo antes de gravar: se algo falhar, nenhum arquivo fica pela metade
    new_manifest = patch_manifest(manifest.read_text(encoding="utf-8"))
    new_gradle = patch_gradle(gradle.read_text(encoding="utf-8"), version, code)

    apply_icons(base / "resources/android/res", base / "android/app/src/main/res")
    manifest.write_text(new_manifest, encoding="utf-8")
    gradle.write_text(new_gradle, encoding="utf-8")
    print("OK: manifest, ícones e versão aplicados (versionName=%s, versionCode=%d)." % (version, code))


if __name__ == "__main__":
    try:
        main()
    except PatchError as exc:
        print("ERRO: %s" % exc, file=sys.stderr)
        sys.exit(1)
