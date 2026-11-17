import json
import os
import re
import tempfile
from pathlib import Path

from PySide6.QtCore import QStandardPaths
from themes.manager import PRESETS

ROOT = Path(__file__).resolve().parents[1]
HEX = re.compile(r"#[0-9a-fA-F]{6}")


def defaults():
    return {"version": 1, "theme": "Purple Night", "colors": list(PRESETS["Purple Night"]),
            "font": 10, "scale": 100, "opacity": 100,
            "shortcuts": json.loads((ROOT / "config/shortcuts.json").read_text("utf-8"))}


def validate(data):
    base = defaults()
    if not isinstance(data, dict) or data.get("version") != 1:
        raise ValueError("Expected a version 1 Relay configuration.")
    base.update({k: data[k] for k in base if k in data})
    for key, lo, hi in [("font", 9, 14), ("scale", 85, 125), ("opacity", 75, 100)]:
        if type(base[key]) is not int or not lo <= base[key] <= hi:
            raise ValueError(f"{key} must be between {lo} and {hi}.")
    if base["theme"] not in (*PRESETS, "Custom"):
        raise ValueError("Unknown theme.")
    colors = base["colors"]
    if not isinstance(colors, list) or len(colors) != 3 or not all(isinstance(c,str) and HEX.fullmatch(c) for c in colors):
        raise ValueError("Expected three hex theme colors.")
    if not isinstance(base["shortcuts"], list):
        raise ValueError("Expected a list of shortcuts.")
    for entry in base["shortcuts"]:
        if not isinstance(entry, dict) or not all(isinstance(entry.get(k), str) and entry[k].strip()
                for k in ("name", "category", "target", "icon", "color")) or not HEX.fullmatch(entry["color"]):
            raise ValueError("Invalid shortcut entry.")
    return base


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as f:
        tmp = Path(f.name)
        try:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        finally:
            f.close()
    try:
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


class ConfigManager:
    def __init__(self, path=None):
        self.path = path or Path(QStandardPaths.writableLocation(QStandardPaths.StandardLocation.AppConfigLocation)) / "settings.json"
        self.warning = ""
        self.data = defaults()
        if self.path.exists():
            try:
                self.data = self.read(self.path)
            except (ValueError, OSError, TypeError) as e:
                self.warning = f"Could not load settings. Defaults are in use.\n{e}"

    @staticmethod
    def read(path):
        return validate(json.loads(Path(path).read_text("utf-8-sig")))

    def save(self, data):
        clean = validate(data)
        write_json(self.path, clean)
        self.data = clean

