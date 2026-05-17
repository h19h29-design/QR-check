from __future__ import annotations

from PIL import Image

from app.resources import resource_path


def test_app_icon_has_windows_desktop_sizes():
    icon = Image.open(resource_path("app_icon.ico"))

    assert (256, 256) in icon.ico.sizes()
    assert (48, 48) in icon.ico.sizes()
    assert (32, 32) in icon.ico.sizes()
    assert (16, 16) in icon.ico.sizes()


def test_app_icon_png_is_high_resolution():
    icon = Image.open(resource_path("app_icon.png"))

    assert icon.size == (256, 256)
    assert icon.mode in {"RGBA", "LA", "P"}
