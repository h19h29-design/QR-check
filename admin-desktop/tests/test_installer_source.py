from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_installer_source_shows_wizard_before_extracting_payload():
    source = (ROOT / "installer" / "SetupProgram.cs").read_text(encoding="utf-8")

    assert "InstallerForm" in source
    assert "Application.Run(form)" in source
    assert "설치 위치와 바로가기 옵션" in source
    assert "desktopShortcutBox" in source
    assert "startMenuShortcutBox" in source

    run_form_index = source.index("Application.Run(form)")
    install_package_index = source.index("InstallPackage(")
    assert run_form_index < install_package_index


def test_package_script_uses_installer_source_file():
    script = (ROOT / "scripts" / "package_installer.ps1").read_text(encoding="utf-8-sig")

    assert "installer\\SetupProgram.cs" in script
    assert "Copy-Item -LiteralPath $SetupProgram" in script
