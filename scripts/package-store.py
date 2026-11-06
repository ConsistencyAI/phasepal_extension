#!/usr/bin/env python3
"""Package the checked extension for a Chrome Web Store draft; no native binaries."""
import base64
import hashlib
import json
from pathlib import Path
import re
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
ALLOWED = {".js", ".json", ".html", ".css", ".png"}


def main():
    manifest = json.loads((DIST / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("manifest_version") != 3 or len(manifest["description"]) > 132:
        raise ValueError("Expected a valid Manifest V3 extension with a short description")
    development_key = manifest.pop("key", None)
    if not development_key:
        raise ValueError("Development public key is required to record the current native-host identity")
    public_hash = hashlib.sha256(base64.b64decode(development_key, validate=True)).hexdigest()[:32]
    development_id = "".join(chr(ord("a") + int(character, 16)) for character in public_hash)
    manifest["homepage_url"] = "https://consistencyai.github.io/phasepal_extension/"
    output = ROOT / "BuildArtifacts/chrome-web-store" / manifest["version"]
    output.mkdir(parents=True, exist_ok=True)
    archive = output / ("phasepal-music-bridge-" + manifest["version"] + ".zip")
    records = {}
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
        def add(name, data):
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            bundle.writestr(info, data)
            records[name] = hashlib.sha256(data).hexdigest()

        for file in sorted(DIST.rglob("*")):
            if file.is_symlink():
                raise ValueError("Symlinks are not allowed in store output")
            if not file.is_file() or file.name == "manifest.json":
                continue
            if file.suffix == ".map":
                continue
            if file.suffix not in ALLOWED:
                raise ValueError("Unexpected build file: " + str(file.relative_to(DIST)))
            data = file.read_bytes()
            if file.suffix == ".js":
                data = re.sub(rb"\n?//# sourceMappingURL=[^\r\n]*", b"", data)
            add(file.relative_to(DIST).as_posix(), data)
        add("manifest.json", (json.dumps(manifest, indent=2) + "\n").encode())
        for name in ("LICENSE", "NOTICE"):
            add(name, (ROOT / name).read_bytes())
        add("THIRD_PARTY_NOTICES.txt", b"Vite build runtime license notices\n\n" + (ROOT / "node_modules/vite/LICENSE.md").read_bytes())

    with zipfile.ZipFile(archive) as bundle:
        if bundle.testzip() is not None or "manifest.json" not in bundle.namelist():
            raise ValueError("Invalid store ZIP")
        for name in [manifest["background"]["service_worker"], manifest["action"]["default_popup"],
                     *manifest["icons"].values(), *manifest["content_scripts"][0]["js"],
                     "src/offscreen.html", "assets/offscreen.js", "assets/audio-worklet.js"]:
            if name not in bundle.namelist():
                raise ValueError("Missing packaged runtime resource: " + name)
    # Keep the public development identity in the separately labeled unpacked
    # preview. The store upload above intentionally lets Google assign its ID.
    preview = output / ("phasepal-music-bridge-preview-" + manifest["version"] + ".zip")
    preview_manifest = {**manifest, "key": development_key}
    with zipfile.ZipFile(archive) as source, zipfile.ZipFile(preview, "w") as bundle:
        for entry in source.infolist():
            data = source.read(entry.filename)
            if entry.filename == "manifest.json":
                data = (json.dumps(preview_manifest, indent=2) + "\n").encode()
            bundle.writestr(entry, data)
    with zipfile.ZipFile(preview) as bundle:
        if bundle.testzip() is not None:
            raise ValueError("Invalid unpacked preview ZIP")
    identity = {
        "version": manifest["version"], "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "developmentExtensionId": development_id,
        "storeExtensionId": None, "storeIdentityVerified": False,
        "previewArchive": preview.name,
        "previewSha256": hashlib.sha256(preview.read_bytes()).hexdigest(),
        "note": "Draft upload only. Confirm the store ID/public key and coordinate the native host before publication.",
        "files": records,
    }
    (output / "package-report.json").write_text(json.dumps(identity, indent=2) + "\n", encoding="utf-8")
    (output / "SHA256SUMS.txt").write_text(
        identity["sha256"] + "  " + archive.name + "\n" +
        identity["previewSha256"] + "  " + preview.name + "\n", encoding="utf-8")
    for name in ("LISTING.md", "PRIVACY_FIELDS.md", "REVIEWER_INSTRUCTIONS.md", "RELEASE_CHECKLIST.md"):
        shutil.copy2(ROOT / "store" / name, output / name)
    shutil.copy2(DIST / "icons/icon-128.png", output / "store-icon-128.png")
    print("Prepared Chrome Web Store draft package:", archive)
    print("SHA-256:", identity["sha256"])
    print("Unpacked development preview:", preview)
    print("Preview SHA-256:", identity["previewSha256"])
    print("The native host is separate. Store identity, live URLs and player QA remain release gates.")


if __name__ == "__main__":
    main()
