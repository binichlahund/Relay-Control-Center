"""Build the portable Windows launcher using stock x64 CPython and .NET Framework."""
import hashlib
import shutil
import os
import struct
import subprocess
import sys
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

HERE = Path(__file__).resolve().parent
APP = HERE.parent
OUTPUT = APP / "Relay Control Center.exe"


def create_icon(path):
    size = 64
    pixels = bytearray()
    for y in reversed(range(size)):
        for x in range(size):
            along = x + (y - 32) * 0.57
            mark = 14 < y < 49 and (17 < along < 28 or 35 < along < 44)
            pixels.extend((255, 173, 190, 255) if mark else (43, 27, 34, 255))
    bmp = struct.pack("<IiiHHIIiiII", 40, size, size*2, 1, 32, 0, len(pixels), 0, 0, 0, 0)
    data = bmp + pixels + bytes(size * size // 8)
    path.write_bytes(struct.pack("<HHH", 0, 1, 1) +
                     struct.pack("<BBBBHHII", size, size, 0, 0, 1, 32, len(data), 22) + data)


def bundle(target):
    release = APP / "src-tauri/target/release"
    desktop = APP / "desktop"
    desktop.mkdir(exist_ok=True)
    shutil.copy2(release / "relay-desktop.exe", desktop / "Relay.exe")
    loader = release / "WebView2Loader.dll"
    if not loader.exists():
        cargo = Path(os.environ.get("CARGO_HOME", Path.home() / ".cargo"))
        matches = sorted(cargo.glob("registry/src/*/webview2-com-sys-*/x64/WebView2Loader.dll"))
        if not matches:
            raise SystemExit("Build the native application first.")
        loader = matches[-1]
    shutil.copy2(loader, desktop / loader.name)
    checksums = []
    with ZipFile(target, "w", ZIP_DEFLATED, compresslevel=7) as archive:
        for name in ("Relay.exe", "WebView2Loader.dll"):
            source = desktop / name
            archive.write(source, name)
            checksums.append(hashlib.sha256(source.read_bytes()).hexdigest() + " " + name)
        archive.writestr("checksums.txt", "\n".join(checksums))


if __name__ == "__main__":
    if os.name != "nt" or sys.maxsize <= 2**32:
        raise SystemExit("Build using 64-bit Windows CPython.")
    csc = Path(os.environ["WINDIR"]) / "Microsoft.NET/Framework64/v4.0.30319/csc.exe"
    with tempfile.TemporaryDirectory() as temp:
        work = Path(temp)
        bundle(work / "payload.zip")
        create_icon(work / "relay.ico")
        subprocess.run([str(csc), "/nologo", "/optimize+", "/target:winexe", "/platform:x64",
                        "/reference:System.IO.Compression.dll", "/reference:System.IO.Compression.FileSystem.dll",
                        "/resource:" + str(work / "payload.zip") + ",payload.zip",
                        "/win32icon:" + str(work / "relay.ico"), "/out:" + str(OUTPUT),
                        str(HERE / "Launcher.cs"), str(HERE / "Installation.cs")], check=True)
    shutil.copy2(OUTPUT, APP.parent / OUTPUT.name)
    print(OUTPUT)
