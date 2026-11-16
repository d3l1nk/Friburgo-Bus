"""Prepara o projeto Android gerado pelo Capacitor (idempotente):
- permissões e cleartext no AndroidManifest.xml
- ícones do app (resources/android/res -> android/app/src/main/res)
- versionName / versionCode no build.gradle
"""
import json
import os
import pathlib
import re
import shutil
import sys

manifest = pathlib.Path("android/app/src/main/AndroidManifest.xml")
if not manifest.exists():
    sys.exit("AndroidManifest.xml nao encontrado. Rode 'npx cap add android' antes.")

xml = manifest.read_text(encoding="utf-8")
permissions = [
    "android.permission.INTERNET",
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.SCHEDULE_EXACT_ALARM",
    "android.permission.VIBRATE",
    "android.permission.RECEIVE_BOOT_COMPLETED",
]
for perm in permissions:
    if perm not in xml:
        xml = xml.replace("</manifest>", '    <uses-permission android:name="%s" />\n</manifest>' % perm)
if "usesCleartextTraffic" not in xml:
    xml = xml.replace("<application", '<application\n        android:usesCleartextTraffic="true"', 1)
manifest.write_text(xml, encoding="utf-8")

# ícones
src = pathlib.Path("resources/android/res")
dst = pathlib.Path("android/app/src/main/res")
if src.exists():
    shutil.copytree(src, dst, dirs_exist_ok=True)
    # remove ícones antigos que poderiam sobrepor o adaptativo
    for old in ["drawable-v24/ic_launcher_foreground.xml", "drawable/ic_launcher_background.xml"]:
        p = dst / old
        if p.exists():
            p.unlink()
    print("Icones aplicados.")

# versão
gradle = pathlib.Path("android/app/build.gradle")
if gradle.exists():
    version = json.load(open("package.json"))["version"]
    code = int(os.environ.get("GITHUB_RUN_NUMBER", "1"))
    g = gradle.read_text(encoding="utf-8")
    g = re.sub(r"versionCode\s+\d+", "versionCode %d" % code, g)
    g = re.sub(r'versionName\s+"[^"]*"', 'versionName "%s"' % version, g)
    gradle.write_text(g, encoding="utf-8")
    print("versionName=%s versionCode=%d" % (version, code))
print(xml)
