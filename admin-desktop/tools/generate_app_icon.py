from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
RESOURCE_DIR = ROOT / "src" / "resources"
PNG_PATH = RESOURCE_DIR / "app_icon.png"
ICO_PATH = RESOURCE_DIR / "app_icon.ico"
WINDOWS_ICON_SIZES = [
    (256, 256),
    (128, 128),
    (64, 64),
    (48, 48),
    (40, 40),
    (32, 32),
    (24, 24),
    (20, 20),
    (16, 16),
]


def main() -> None:
    if not PNG_PATH.exists():
        raise FileNotFoundError(PNG_PATH)

    icon = Image.open(PNG_PATH).convert("RGBA")
    icon.save(ICO_PATH, sizes=WINDOWS_ICON_SIZES)
    print(f"rebuilt {ICO_PATH} from {PNG_PATH}")


if __name__ == "__main__":
    main()
