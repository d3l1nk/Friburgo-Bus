"""Testes do patch_android.py. Rode com: python3 -m unittest discover -s scripts -p "test_*.py" """

import json
import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import patch_android as pa  # noqa: E402

MANIFEST = """<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:label="@string/app_name" android:allowBackup="true">
    </application>
    <uses-permission android:name="android.permission.INTERNET" />
</manifest>
"""
GRADLE = 'android {\n defaultConfig {\n  versionCode 1\n  versionName "1.0"\n }\n}\n'
REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent


def make_project(root: pathlib.Path, manifest: str = MANIFEST, gradle: str = GRADLE, icons: bool = True) -> None:
    app = root / "android/app/src/main"
    (app / "res/drawable-v24").mkdir(parents=True)
    (app / "AndroidManifest.xml").write_text(manifest, encoding="utf-8")
    (app / "res/drawable-v24/ic_launcher_foreground.xml").write_text("<vector/>", encoding="utf-8")
    (root / "android/app/build.gradle").write_text(gradle, encoding="utf-8")
    (root / "package.json").write_text(json.dumps({"version": "2.3.4"}), encoding="utf-8")
    if icons:
        for d in pa.DENSITIES:
            folder = root / "resources/android/res" / ("mipmap-" + d)
            folder.mkdir(parents=True)
            for name in pa.ICON_FILES:
                (folder / name).write_bytes(b"png")


class ManifestTests(unittest.TestCase):
    def test_adds_permissions_and_cleartext(self):
        out = pa.patch_manifest(MANIFEST)
        for perm in pa.PERMISSIONS:
            self.assertEqual(out.count('android:name="%s"' % perm), 1, perm)
        self.assertIn('android:usesCleartextTraffic="true"', out)

    def test_idempotent(self):
        once = pa.patch_manifest(MANIFEST)
        self.assertEqual(pa.patch_manifest(once), once)

    def test_forces_cleartext_true_when_false(self):
        xml = MANIFEST.replace("<application ", '<application android:usesCleartextTraffic="false" ')
        out = pa.patch_manifest(xml)
        self.assertEqual(out.count("usesCleartextTraffic"), 1)
        self.assertIn('usesCleartextTraffic="true"', out)

    def test_fails_without_manifest_close_tag(self):
        with self.assertRaisesRegex(pa.PatchError, "</manifest>"):
            pa.patch_manifest("<manifest><application/>")

    def test_fails_without_application(self):
        with self.assertRaisesRegex(pa.PatchError, "<application>"):
            pa.patch_manifest("<manifest></manifest>")

    def test_fails_on_invalid_xml(self):
        with self.assertRaisesRegex(pa.PatchError, "inválido"):
            pa.patch_manifest("<manifest><application></manifest>")


class GradleTests(unittest.TestCase):
    def test_sets_version(self):
        out = pa.patch_gradle(GRADLE, "1.3.0", 42)
        self.assertIn("versionCode 42", out)
        self.assertIn('versionName "1.3.0"', out)

    def test_idempotent(self):
        once = pa.patch_gradle(GRADLE, "1.3.0", 42)
        self.assertEqual(pa.patch_gradle(once, "1.3.0", 42), once)

    def test_fails_when_patterns_missing(self):
        with self.assertRaisesRegex(pa.PatchError, "versionCode"):
            pa.patch_gradle('versionName "1"', "1", 1)
        with self.assertRaisesRegex(pa.PatchError, "versionName"):
            pa.patch_gradle("versionCode 1", "1", 1)


class MainTests(unittest.TestCase):
    def run_main(self, root, env=None):
        pa.main(root, env if env is not None else {"GITHUB_RUN_NUMBER": "7"})

    def test_full_run_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            make_project(root)
            self.run_main(root)
            files = [root / "android/app/src/main/AndroidManifest.xml", root / "android/app/build.gradle"]
            first = [f.read_text(encoding="utf-8") for f in files]
            self.run_main(root)
            self.assertEqual(first, [f.read_text(encoding="utf-8") for f in files])
            self.assertIn("versionCode 7", first[1])
            self.assertIn('versionName "2.3.4"', first[1])

    def test_copies_icons_and_removes_legacy(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            make_project(root)
            self.run_main(root)
            res = root / "android/app/src/main/res"
            self.assertTrue((res / "mipmap-xxhdpi/ic_launcher_foreground.png").is_file())
            self.assertFalse((res / "drawable-v24/ic_launcher_foreground.xml").exists())

    def test_fails_without_android_project(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(pa.PatchError, "cap add android"):
                self.run_main(pathlib.Path(tmp))

    def test_fails_without_icons_and_leaves_files_untouched(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            make_project(root, icons=False)
            with self.assertRaisesRegex(pa.PatchError, "ícones"):
                self.run_main(root)
            manifest = root / "android/app/src/main/AndroidManifest.xml"
            self.assertEqual(manifest.read_text(encoding="utf-8"), MANIFEST)

    def test_fails_when_one_icon_is_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            make_project(root)
            (root / "resources/android/res/mipmap-hdpi/ic_launcher_round.png").unlink()
            with self.assertRaisesRegex(pa.PatchError, "ic_launcher_round.png"):
                self.run_main(root)

    def test_fails_on_bad_run_number(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            make_project(root)
            with self.assertRaisesRegex(pa.PatchError, "GITHUB_RUN_NUMBER"):
                self.run_main(root, {"GITHUB_RUN_NUMBER": "abc"})

    def test_fails_without_package_version(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            make_project(root)
            (root / "package.json").write_text("{}", encoding="utf-8")
            with self.assertRaisesRegex(pa.PatchError, "version"):
                self.run_main(root)


class RepositoryAssetsTests(unittest.TestCase):
    def test_repo_ships_all_required_icons(self):
        for d in pa.DENSITIES:
            for name in pa.ICON_FILES:
                self.assertTrue((REPO_ROOT / "resources/android/res" / ("mipmap-" + d) / name).is_file(), (d, name))


if __name__ == "__main__":
    unittest.main()
