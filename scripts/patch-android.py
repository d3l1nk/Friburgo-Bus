"""Injeta permissoes e cleartext no AndroidManifest.xml (idempotente)."""
import pathlib
import sys

path = pathlib.Path("android/app/src/main/AndroidManifest.xml")
if not path.exists():
    sys.exit("AndroidManifest.xml nao encontrado. Rode 'npx cap add android' antes.")

xml = path.read_text(encoding="utf-8")

permissions = [
    "android.permission.INTERNET",
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.ACCESS_FINE_LOCATION",
]
for perm in permissions:
    if perm not in xml:
        xml = xml.replace(
            "</manifest>",
            '    <uses-permission android:name="%s" />\n</manifest>' % perm,
        )

if "usesCleartextTraffic" not in xml:
    xml = xml.replace(
        "<application",
        '<application\n        android:usesCleartextTraffic="true"',
        1,
    )

path.write_text(xml, encoding="utf-8")
print(xml)
